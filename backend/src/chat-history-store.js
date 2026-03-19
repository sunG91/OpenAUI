/**
 * Chat 聊天历史存储 - 每个会话单独 JSON 文件，存放在 chat-history 目录
 * 打包后使用用户可写目录
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getDataDir } = require('./data-path');

const CHAT_HISTORY_DIR = path.join(getDataDir(), 'chat-history');
const INDEX_FILE = path.join(CHAT_HISTORY_DIR, 'index.json');

function ensureDir(dir = CHAT_HISTORY_DIR) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadIndex() {
  ensureDir();
  try {
    const raw = fs.readFileSync(INDEX_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { sessions: [] };
  }
}

function saveIndex(data) {
  ensureDir();
  fs.writeFileSync(INDEX_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function genId() {
  return crypto.randomUUID();
}

function getSessionPath(sessionId) {
  return path.join(CHAT_HISTORY_DIR, `${sessionId}.json`);
}

function loadSessionFile(sessionId) {
  const p = getSessionPath(sessionId);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function saveSessionFile(session) {
  ensureDir();
  const p = getSessionPath(session.id);
  fs.writeFileSync(p, JSON.stringify(session, null, 2), 'utf8');
}

/** 列出会话（type: chat | aui），支持分页 */
function listSessions(type = 'chat', page = 1, pageSize = 20) {
  const data = loadIndex();
  const list = (data.sessions || []).filter((s) => s.type === type);
  const sorted = list.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
  const total = sorted.length;
  const p = Math.max(1, Number(page) || 1);
  const size = Math.min(50, Math.max(1, Number(pageSize) || 20));
  const start = (p - 1) * size;
  const sessions = sorted.slice(start, start + size);
  return { sessions, total, page: p, pageSize: size };
}

/** 获取单个会话 */
function getSession(sessionId) {
  return loadSessionFile(sessionId);
}

/** 创建会话 */
function createSession(type = 'chat') {
  const session = {
    id: genId(),
    type,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
  };
  saveSessionFile(session);
  const index = loadIndex();
  index.sessions = index.sessions || [];
  index.sessions.unshift({
    id: session.id,
    type: session.type,
    title: null,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  });
  saveIndex(index);
  return session;
}

/** 追加消息（若已存在同 id 则更新，避免重复） */
function appendMessage(sessionId, message) {
  const session = loadSessionFile(sessionId);
  if (!session) return null;
  session.messages = session.messages || [];
  const msgId = message.id || genId();
  const existingIdx = session.messages.findIndex((m) => m.id === msgId);
  const mcpCallsVal = Array.isArray(message.mcpCalls) ? message.mcpCalls : undefined;
  const msg = {
    id: msgId,
    role: message.role,
    content: message.content,
    time: message.time || new Date().toLocaleTimeString(),
    memoryId: message.memoryId || null,
    mcpCalls: mcpCallsVal,
  };
  if (existingIdx >= 0) {
    const existing = session.messages[existingIdx];
    if (mcpCallsVal == null && Array.isArray(existing?.mcpCalls)) {
      msg.mcpCalls = existing.mcpCalls;
    }
    session.messages[existingIdx] = msg;
  } else {
    const isFirstUserMsg = session.messages.length === 0 && message.role === 'user';
    if (isFirstUserMsg && message.content) {
      session.title = String(message.content).trim().slice(0, 80) || null;
    }
    session.messages.push(msg);
  }
  session.updatedAt = Date.now();
  saveSessionFile(session);
  const index = loadIndex();
  const meta = (index.sessions || []).find((s) => s.id === sessionId);
  if (meta) {
    meta.updatedAt = session.updatedAt;
    meta.title = session.title || meta.title;
    saveIndex(index);
  }
  return msg;
}

/** 删除单条消息 */
function deleteMessage(sessionId, messageId) {
  const session = loadSessionFile(sessionId);
  if (!session) return false;
  const idx = (session.messages || []).findIndex((m) => m.id === messageId);
  if (idx < 0) return false;
  session.messages.splice(idx, 1);
  session.updatedAt = Date.now();
  saveSessionFile(session);
  try {
    const { deleteMcpResultsByMessage } = require('./mcp-results-store');
    deleteMcpResultsByMessage(messageId, sessionId);
  } catch {}
  return true;
}

/** 回退：删除指定消息及之后的所有消息 */
function deleteMessagesFrom(sessionId, fromMessageId) {
  const session = loadSessionFile(sessionId);
  if (!session) return { ok: false, deleted: 0 };
  const messages = session.messages || [];
  const idx = messages.findIndex((m) => m.id === fromMessageId);
  if (idx < 0) return { ok: false, deleted: 0 };
  const toDelete = messages.slice(idx);
  session.messages = messages.slice(0, idx);
  session.updatedAt = Date.now();
  saveSessionFile(session);
  try {
    const { deleteMcpResultsByMessage } = require('./mcp-results-store');
    for (const m of toDelete) {
      if (m?.id) deleteMcpResultsByMessage(m.id, sessionId);
    }
  } catch {}
  return { ok: true, deleted: toDelete.length, memoryIds: toDelete.map((m) => m.memoryId).filter(Boolean) };
}

/** 删除整个会话 */
function deleteSession(sessionId) {
  const session = loadSessionFile(sessionId);
  if (!session) return false;
  const p = getSessionPath(sessionId);
  try {
    fs.unlinkSync(p);
  } catch { /* ignore */ }
  try {
    const { deleteMcpResultsBySessionId } = require('./mcp-results-store');
    deleteMcpResultsBySessionId(sessionId);
  } catch {}
  const index = loadIndex();
  index.sessions = (index.sessions || []).filter((s) => s.id !== sessionId);
  saveIndex(index);
  return true;
}

/** 更新消息的 memoryId（加深记忆后） */
function setMessageMemoryId(sessionId, messageId, memoryId) {
  const session = loadSessionFile(sessionId);
  if (!session) return false;
  const msg = (session.messages || []).find((m) => m.id === messageId);
  if (!msg) return false;
  msg.memoryId = memoryId;
  session.updatedAt = Date.now();
  saveSessionFile(session);
  return true;
}

/** 迁移旧数据：从 chat-history.json 迁移到 chat-history 目录 */
function migrateFromLegacy() {
  const legacyFile = path.join(getDataDir(), 'chat-history.json');
  if (!fs.existsSync(legacyFile)) return;
  const indexExists = fs.existsSync(INDEX_FILE);
  if (indexExists) {
    try {
      const idx = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
      if (Array.isArray(idx.sessions) && idx.sessions.length > 0) return;
    } catch {}
  }
  try {
    const raw = fs.readFileSync(legacyFile, 'utf8');
    const data = JSON.parse(raw);
    const sessions = data.sessions || [];
    if (sessions.length === 0) {
      fs.unlinkSync(legacyFile);
      return;
    }
    ensureDir();
    const index = { sessions: [] };
    for (const s of sessions) {
      if (!s.id) continue;
      const session = { ...s };
      session.messages = (session.messages || []).filter((m, i, arr) => {
        const first = arr.findIndex((x) => x.id === m.id);
        return first === i;
      });
      saveSessionFile(session);
      index.sessions.push({
        id: session.id,
        type: session.type || 'chat',
        title: session.title || null,
        createdAt: session.createdAt || Date.now(),
        updatedAt: session.updatedAt || Date.now(),
      });
    }
    saveIndex(index);
    fs.unlinkSync(legacyFile);
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[chat-history] 迁移旧数据失败:', e?.message);
    }
  }
}

migrateFromLegacy();

module.exports = {
  listSessions,
  getSession,
  createSession,
  appendMessage,
  deleteMessage,
  deleteMessagesFrom,
  deleteSession,
  setMessageMemoryId,
  CHAT_HISTORY_FILE: INDEX_FILE,
};
