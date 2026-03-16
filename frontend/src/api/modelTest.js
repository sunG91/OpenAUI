/**
 * 模型测试 API：非流式调用与流式 SSE 调用
 */
import { API_BASE } from './base';

async function parseJsonResponse(res) {
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    if (text.trimStart().startsWith('<')) {
      throw new Error(`接口返回了 HTML 而非 JSON，可能是后端未启动或地址错误（${API_BASE}）`);
    }
    throw new Error(`接口返回了无效 JSON：${text.slice(0, 80)}...`);
  }
  if (!res.ok) throw new Error(data?.error || res.statusText);
  return data;
}

export async function testModel(payload) {
  const res = await fetch(`${API_BASE}/api/test-model`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return parseJsonResponse(res);
}

/**
 * 流式调用：onChunk({ content, reasoning_content })，onDone() / onDone(error)
 * 若后端返回 application/json（非流式），则当作一次性结果处理并调用 onChunk + onDone
 */
export async function testModelStream(payload, { onChunk, onDone }) {
  const TIMEOUT_MS = 120000;
  const ctrl = new AbortController();
  const timeoutId = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  const res = await fetch(`${API_BASE}/api/test-model`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, stream: true }),
    signal: ctrl.signal,
  }).catch((e) => {
    clearTimeout(timeoutId);
    if (e?.name === 'AbortError') onDone(new Error('响应超时，请重试'));
    else onDone(e);
    return null;
  });

  if (!res) return;
  clearTimeout(timeoutId);

  if (!res.ok) {
    try {
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        if (text.trimStart().startsWith('<')) {
          onDone(new Error(`接口返回了 HTML 而非 JSON，可能是后端未启动或地址错误（${API_BASE}）`));
        } else {
          onDone(new Error(res.statusText));
        }
        return;
      }
      onDone(new Error(data?.error || res.statusText));
    } catch (e) {
      onDone(e);
    }
    return;
  }

  const contentType = (res.headers.get('Content-Type') || '').toLowerCase();
  if (contentType.includes('application/json')) {
    try {
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        if (text.trimStart().startsWith('<')) {
          onDone(new Error(`接口返回了 HTML 而非 JSON，可能是后端未启动或地址错误（${API_BASE}）`));
        } else {
          onDone(e);
        }
        return;
      }
      const reasoning = data.reasoning_content ?? '';
      const content = data.content ?? '';
      if (data.error) onDone(new Error(data.error));
      else {
        onChunk({ reasoning_content: reasoning, content });
        onDone();
      }
    } catch (e) {
      onDone(e);
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
        const trimmed = line.trimStart();
        if (!trimmed.startsWith('data: ')) continue;
        const payloadStr = trimmed.slice(6).trim();
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
          onChunk({ reasoning_content: reasoning, content });
        } catch (_) {}
      }
    }
    const trimmedBuf = buffer.trimStart();
    if (trimmedBuf.startsWith('data: ')) {
      const payloadStr = trimmedBuf.slice(6).trim();
      if (payloadStr !== '[DONE]') {
        try {
          const obj = JSON.parse(payloadStr);
          if (obj.error) onDone(new Error(obj.error));
          else onChunk({ reasoning_content: obj.reasoning_content ?? '', content: obj.content ?? '' });
        } catch (_) {}
      }
    }
    onDone();
  } catch (e) {
    if (e?.name === 'AbortError') onDone(new Error('响应超时，请重试'));
    else onDone(e);
  }
}
