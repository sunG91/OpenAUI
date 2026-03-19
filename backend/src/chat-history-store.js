/**
 * Chat 聊天历史存储 - JSON 文件
 * 数据目录：backend/data/chat-history.json
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '../data');
const CHAT_HISTORY_FILE = path.join(DATA_DIR, 'chat-history.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function load() {
  ensureDir();
  try {
    const raw = fs.readFileSync(CHAT_HISTORY_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { sessions: [] };
  }
}

function save(data) {
  ensureDir();
  fs.writeFileSync(CHAT_HISTORY_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function genId() {
  return crypto.randomUUID();
}

/** 列出会话（type: chat | aui），支持分页 */
function listSessions(type = 'chat', page = 1, pageSize = 20) {
  const data = load();
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
  const data = load();
  return (data.sessions || []).find((s) => s.id === sessionId) || null;
}

/** 创建会话 */
function createSession(type = 'chat') {
  const data = load();
  const session = {
    id: genId(),
    type,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
  };
  data.sessions = data.sessions || [];
  data.sessions.unshift(session);
  save(data);
  return session;
}

/** 追加消息 */
function appendMessage(sessionId, message) {
  const data = load();
  const session = (data.sessions || []).find((s) => s.id === sessionId);
  if (!session) return null;
  const msg = {
    id: message.id || genId(),
    role: message.role,
    content: message.content,
    time: message.time || new Date().toLocaleTimeString(),
    memoryId: message.memoryId || null,
  };
  session.messages = session.messages || [];
  const isFirstUserMsg = session.messages.length === 0 && message.role === 'user';
  if (isFirstUserMsg && message.content) {
    session.title = String(message.content).trim().slice(0, 80) || null;
  }
  session.messages.push(msg);
  session.updatedAt = Date.now();
  save(data);
  return msg;
}

/** 删除单条消息 */
function deleteMessage(sessionId, messageId) {
  const data = load();
  const session = (data.sessions || []).find((s) => s.id === sessionId);
  if (!session) return false;
  const idx = (session.messages || []).findIndex((m) => m.id === messageId);
  if (idx < 0) return false;
  session.messages.splice(idx, 1);
  session.updatedAt = Date.now();
  save(data);
  return true;
}

/** 回退：删除指定消息及之后的所有消息 */
function deleteMessagesFrom(sessionId, fromMessageId) {
  const data = load();
  const session = (data.sessions || []).find((s) => s.id === sessionId);
  if (!session) return { ok: false, deleted: 0 };
  const messages = session.messages || [];
  const idx = messages.findIndex((m) => m.id === fromMessageId);
  if (idx < 0) return { ok: false, deleted: 0 };
  const toDelete = messages.slice(idx);
  session.messages = messages.slice(0, idx);
  session.updatedAt = Date.now();
  save(data);
  return { ok: true, deleted: toDelete.length, memoryIds: toDelete.map((m) => m.memoryId).filter(Boolean) };
}

/** 删除整个会话 */
function deleteSession(sessionId) {
  const data = load();
  const idx = (data.sessions || []).findIndex((s) => s.id === sessionId);
  if (idx < 0) return false;
  data.sessions.splice(idx, 1);
  save(data);
  return true;
}

/** 更新消息的 memoryId（加深记忆后） */
function setMessageMemoryId(sessionId, messageId, memoryId) {
  const data = load();
  const session = (data.sessions || []).find((s) => s.id === sessionId);
  if (!session) return false;
  const msg = (session.messages || []).find((m) => m.id === messageId);
  if (!msg) return false;
  msg.memoryId = memoryId;
  session.updatedAt = Date.now();
  save(data);
  return true;
}

module.exports = {
  listSessions,
  getSession,
  createSession,
  appendMessage,
  deleteMessage,
  deleteMessagesFrom,
  deleteSession,
  setMessageMemoryId,
  CHAT_HISTORY_FILE,
};
