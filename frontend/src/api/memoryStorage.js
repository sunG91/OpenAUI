/**
 * 记忆存储 / 向量嵌入 API
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

export async function getMemoryStorageInfo() {
  return fetchJson(`${API_BASE}/api/memory-storage/info`);
}

export async function checkMemoryAvailable() {
  const data = await fetchJson(`${API_BASE}/api/memory-storage/memory-available`);
  return data.available;
}

export async function embedText(text) {
  return fetchJson(`${API_BASE}/api/memory-storage/embed`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export async function listCollections() {
  const data = await fetchJson(`${API_BASE}/api/memory-storage/collections`);
  return data.collections || [];
}

export async function listCollectionItems(collection) {
  const data = await fetchJson(`${API_BASE}/api/memory-storage/collections/${encodeURIComponent(collection)}/items`);
  return data.items || [];
}

export async function getCollectionStats(collection) {
  return fetchJson(`${API_BASE}/api/memory-storage/collections/${encodeURIComponent(collection)}/stats`);
}

export async function queryMemory(collection, text, topk = 10) {
  const res = await fetch(`${API_BASE}/api/memory-storage/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ collection, text, topk }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || res.statusText);
  return json;
}

export async function deleteMemoryItem(collection, id) {
  return fetchJson(`${API_BASE}/api/memory-storage/collections/${encodeURIComponent(collection)}/items/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
