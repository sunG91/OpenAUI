/**
 * A2UI 画布 API — Agent 推送可视化
 */
import { API_BASE } from './base';

export async function canvasPush(messages) {
  const res = await fetch(`${API_BASE}/api/canvas/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Array.isArray(messages) ? messages : [messages]),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export async function canvasGetState() {
  const res = await fetch(`${API_BASE}/api/canvas/state`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export async function canvasReset() {
  const res = await fetch(`${API_BASE}/api/canvas/reset`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}
