/**
 * Chat 聊天历史 API
 */
import { API_BASE, wrapNetworkError } from './base';

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...opts.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export async function listChatSessions(page = 1, pageSize = 20) {
  const params = new URLSearchParams({ type: 'chat', page: String(page), pageSize: String(pageSize) });
  return fetchJson(`${API_BASE}/api/chat-history?${params}`);
}

export async function getChatSession(sessionId) {
  return fetchJson(`${API_BASE}/api/chat-history/${sessionId}`);
}

export async function createChatSession() {
  return fetchJson(`${API_BASE}/api/chat-history`, {
    method: 'POST',
    body: JSON.stringify({ type: 'chat' }),
  });
}

export async function appendChatMessage(sessionId, message) {
  return fetchJson(`${API_BASE}/api/chat-history/${sessionId}/messages`, {
    method: 'POST',
    body: JSON.stringify(message),
  });
}

export async function deepenMemory(sessionId, messageId) {
  return fetchJson(`${API_BASE}/api/chat-history/${sessionId}/messages/${messageId}/deepen-memory`, {
    method: 'POST',
  });
}

export async function deleteChatMessage(sessionId, messageId) {
  return fetchJson(`${API_BASE}/api/chat-history/${sessionId}/messages/${messageId}`, {
    method: 'DELETE',
  });
}

export async function rollbackChatMessage(sessionId, messageId) {
  return fetchJson(`${API_BASE}/api/chat-history/${sessionId}/messages/rollback`, {
    method: 'POST',
    body: JSON.stringify({ messageId }),
  });
}

export async function deleteChatSession(sessionId) {
  return fetchJson(`${API_BASE}/api/chat-history/${sessionId}`, {
    method: 'DELETE',
  });
}

/** 获取上次选中的会话 id（持久化到 config.json） */
export async function getLastSelectedSessionId() {
  const res = await fetch(`${API_BASE}/api/config/uiState`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data.uiState?.lastSelectedSessionId || null;
}

/** 保存当前选中的会话 id 到 config.json */
export async function saveLastSelectedSessionId(sessionId) {
  const res = await fetch(`${API_BASE}/api/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ section: 'uiState', updates: { lastSelectedSessionId: sessionId || null } }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
}
