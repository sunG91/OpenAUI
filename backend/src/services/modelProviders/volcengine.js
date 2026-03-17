/**
 * 火山引擎 / 火山方舟 API（Responses API）
 * @see https://www.volcengine.com/docs/82379/1399008
 * @see https://www.volcengine.com/docs/82379/1958521 多模态理解
 */
const VOLCENGINE_BASE = 'https://ark.cn-beijing.volces.com';

/**
 * 将 OpenAI 风格 messages 转为火山方舟 input 格式
 * - image_url -> input_image, image_url 为字符串
 * - text -> input_text
 */
function toVolcengineInput(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return [];
  return messages.map((m) => {
    const role = m.role === 'system' ? 'system' : m.role === 'assistant' ? 'assistant' : 'user';
    let content = m.content;
    if (typeof content === 'string') {
      return { role, content: [{ type: 'input_text', text: content }] };
    }
    if (!Array.isArray(content)) return { role, content: [{ type: 'input_text', text: String(content || '') }] };
    const parts = content.map((p) => {
      if (p.type === 'image_url' && p.image_url) {
        const url = typeof p.image_url === 'string' ? p.image_url : p.image_url?.url || '';
        return { type: 'input_image', image_url: url };
      }
      if (p.type === 'text' && p.text != null) return { type: 'input_text', text: String(p.text) };
      return null;
    }).filter(Boolean);
    return { role, content: parts.length ? parts : [{ type: 'input_text', text: '' }] };
  });
}

/**
 * 从响应中提取文本内容（兼容多种火山方舟响应格式）
 */
function extractContent(res) {
  if (!res) return '';
  const data = res.data ?? res;
  const o = data.output ?? res.output;
  if (typeof o?.text === 'string') return o.text;
  if (Array.isArray(o) && o[0]) {
    const msg = o[0];
    const c = msg.content;
    if (Array.isArray(c)) {
      for (const x of c) {
        if (x.type === 'output_text' || x.type === 'text') return x.text ?? '';
        if (x.text) return x.text;
      }
    }
    if (typeof c === 'string') return c;
  }
  const choices = res.choices ?? data.choices;
  if (Array.isArray(choices) && choices[0]?.message?.content) return choices[0].message.content;
  return data.text ?? res.text ?? data.content ?? res.content ?? '';
}

/**
 * @param {{
 *   apiKey: string,
 *   modelId: string,
 *   message?: string,
 *   messages?: any[],
 *   stream: boolean
 * }}
 */
async function chat(options) {
  const { apiKey, modelId, message, messages, stream = false } = options;
  const apiKeyTrim = (apiKey || '').trim();
  if (!apiKeyTrim) throw new Error('缺少火山引擎 API Key');

  let input;
  if (Array.isArray(messages) && messages.length > 0) {
    input = toVolcengineInput(messages);
  } else {
    const text = (message && String(message).trim()) || 'Hello';
    input = [{ role: 'user', content: [{ type: 'input_text', text }] }];
  }

  const url = `${VOLCENGINE_BASE}/api/v3/responses`;
  const body = { model: modelId, input };

  if (stream) {
    body.stream = true;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKeyTrim}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err || `HTTP ${res.status}`);
    }
    const reader = res.body?.getReader?.();
    if (!reader) {
      const data = await res.json().catch(() => ({}));
      const content = extractContent(data);
      return (async function* () {
        yield { choices: [{ delta: { content } }] };
      })();
    }
    const decoder = new TextDecoder();
    return (async function* () {
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const j = JSON.parse(line.slice(6));
              const text = j.output?.[0]?.content?.[0]?.text ?? j.choices?.[0]?.delta?.content ?? '';
              if (text) yield { choices: [{ delta: { content: text } }] };
            } catch (_) {}
          }
        }
      }
    })();
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKeyTrim}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data?.error ?? data?.ResponseMetadata?.Error;
    const msg = err?.message ?? err?.Message ?? data?.message ?? res.statusText;
    throw new Error(msg ? String(msg) : `HTTP ${res.status}`);
  }

  const content = extractContent(data);
  return { content: content || '', reasoning_content: '' };
}

module.exports = { chat, id: 'volcengine' };
