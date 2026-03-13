/**
 * 模型测试 API：非流式调用与流式 SSE 调用
 */
import { API_BASE } from './base';

export async function testModel(payload) {
  const res = await fetch(`${API_BASE}/api/test-model`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

/**
 * 流式调用：onChunk({ content, reasoning_content })，onDone() / onDone(error)
 */
export async function testModelStream(payload, { onChunk, onDone }) {
  const res = await fetch(`${API_BASE}/api/test-model`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, stream: true })
  });
  if (!res.ok) {
    try {
      const data = await res.json();
      onDone(new Error(data.error || res.statusText));
    } catch {
      onDone(new Error(res.statusText));
    }
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const payloadStr = line.slice(6).trim();
          if (payloadStr === '[DONE]') {
            onDone();
            return;
          }
          try {
            const obj = JSON.parse(payloadStr);
            if (obj.error) {
              onDone(new Error(obj.error));
              return;
            }
            const reasoning = obj.reasoning_content ?? '';
            const content = obj.content ?? '';
            if (reasoning || content) {
              onChunk({ reasoning_content: reasoning, content });
            }
          } catch (_) {}
        }
      }
    }
    if (buffer.startsWith('data: ')) {
      const payloadStr = buffer.slice(6).trim();
      if (payloadStr !== '[DONE]') {
        try {
          const obj = JSON.parse(payloadStr);
          if (obj.error) onDone(new Error(obj.error));
          else if (obj.reasoning_content || obj.content) {
            onChunk({ reasoning_content: obj.reasoning_content ?? '', content: obj.content ?? '' });
          }
        } catch (_) {}
      }
    }
    onDone();
  } catch (e) {
    onDone(e);
  }
}
