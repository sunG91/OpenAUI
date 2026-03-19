/**
 * 记忆存储 / 向量嵌入 API
 */
import { API_BASE, wrapNetworkError } from './base';

export async function getMemoryStorageInfo() {
  const res = await fetch(`${API_BASE}/api/memory-storage/info`);
  if (!res.ok) throw new Error((await res.json()).error || res.statusText);
  return res.json();
}

export async function checkMemoryAvailable() {
  const res = await fetch(`${API_BASE}/api/memory-storage/memory-available`);
  const data = await res.json();
  return data.available;
}

export async function embedText(text) {
  const res = await fetch(`${API_BASE}/api/memory-storage/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}
