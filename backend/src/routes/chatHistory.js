/**
 * Chat 聊天历史 API
 * - JSON 存储会话与消息
 * - 可选向量存储（加深记忆）
 */
const express = require('express');
const {
  listSessions,
  getSession,
  createSession,
  appendMessage,
  deleteMessage,
  deleteMessagesFrom,
  deleteSession,
  setMessageMemoryId,
} = require('../chat-history-store');
const { insertText, deleteById } = require('../vectra');

const router = express.Router();
const MEMORY_COLLECTION = 'chat-memory';

/** 列出会话 GET /api/chat-history?type=chat&page=1&pageSize=20 */
router.get('/', (req, res) => {
  try {
    const type = req.query.type || 'chat';
    const page = req.query.page || 1;
    const pageSize = req.query.pageSize || 20;
    const result = listSessions(type, page, pageSize);
    return res.json(result);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/** 获取会话 GET /api/chat-history/:sessionId */
router.get('/:sessionId', (req, res) => {
  try {
    const session = getSession(req.params.sessionId);
    if (!session) return res.status(404).json({ success: false, error: '会话不存在' });
    return res.json(session);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/** 创建会话 POST /api/chat-history { type: 'chat' } */
router.post('/', (req, res) => {
  try {
    const type = req.body?.type || 'chat';
    const session = createSession(type);
    return res.json(session);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/** 追加消息 POST /api/chat-history/:sessionId/messages */
router.post('/:sessionId/messages', (req, res) => {
  try {
    const { role, content, time, id, mcpCalls } = req.body || {};
    if (!role || content == null) {
      return res.status(400).json({ success: false, error: '缺少 role 或 content' });
    }
    const msg = appendMessage(req.params.sessionId, { id, role, content, time, mcpCalls });
    if (!msg) return res.status(404).json({ success: false, error: '会话不存在' });
    return res.json(msg);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/** 回退：删除指定消息及之后的所有消息 POST /api/chat-history/:sessionId/messages/rollback */
router.post('/:sessionId/messages/rollback', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { messageId } = req.body || {};
    if (!messageId) return res.status(400).json({ success: false, error: '缺少 messageId' });
    const session = getSession(sessionId);
    if (!session) return res.status(404).json({ success: false, error: '会话不存在' });
    const result = deleteMessagesFrom(sessionId, messageId);
    if (!result.ok) return res.status(404).json({ success: false, error: '消息不存在' });
    if (result.memoryIds?.length > 0) {
      try {
        await deleteById(MEMORY_COLLECTION, result.memoryIds);
      } catch {}
    }
    return res.json({ success: true, deleted: result.deleted });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/** 加深记忆 POST /api/chat-history/:sessionId/messages/:messageId/deepen-memory */
router.post('/:sessionId/messages/:messageId/deepen-memory', async (req, res) => {
  try {
    const { sessionId, messageId } = req.params;
    const session = getSession(sessionId);
    if (!session) return res.status(404).json({ success: false, error: '会话不存在' });
    const msg = (session.messages || []).find((m) => m.id === messageId);
    if (!msg) return res.status(404).json({ success: false, error: '消息不存在' });
    if (msg.memoryId) return res.json({ success: true, memoryId: msg.memoryId, already: true });

    const text = `${msg.role === 'user' ? '用户' : '助手'}: ${msg.content}`;
    const { id: memoryId } = await insertText(MEMORY_COLLECTION, text, {
      sessionId,
      messageId,
      role: msg.role,
      createdAt: Date.now(),
    });
    setMessageMemoryId(sessionId, messageId, memoryId);
    return res.json({ success: true, memoryId });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/** 删除单条消息 DELETE /api/chat-history/:sessionId/messages/:messageId */
router.delete('/:sessionId/messages/:messageId', async (req, res) => {
  try {
    const { sessionId, messageId } = req.params;
    const session = getSession(sessionId);
    if (!session) return res.status(404).json({ success: false, error: '会话不存在' });
    const msg = (session.messages || []).find((m) => m.id === messageId);
    if (msg?.memoryId) {
      try {
        await deleteById(MEMORY_COLLECTION, msg.memoryId);
      } catch {}
    }
    const ok = deleteMessage(sessionId, messageId);
    if (!ok) return res.status(404).json({ success: false, error: '消息不存在' });
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/** 删除整个会话 DELETE /api/chat-history/:sessionId */
router.delete('/:sessionId', async (req, res) => {
  try {
    const session = getSession(req.params.sessionId);
    if (!session) return res.status(404).json({ success: false, error: '会话不存在' });
    const memoryIds = (session.messages || []).map((m) => m.memoryId).filter(Boolean);
    if (memoryIds.length > 0) {
      try {
        await deleteById(MEMORY_COLLECTION, memoryIds);
      } catch {}
    }
    const ok = deleteSession(req.params.sessionId);
    if (!ok) return res.status(404).json({ success: false, error: '会话不存在' });
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = { router };
