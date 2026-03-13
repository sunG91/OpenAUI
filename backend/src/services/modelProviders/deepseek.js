/**
 * DeepSeek 官方 API 调用（OpenAI 兼容）
 * @see https://api-docs.deepseek.com/zh-cn/
 */
const OpenAI = require('openai').default || require('openai');

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';

/**
 * @param {{ apiKey: string, modelId: string, message: string, stream: boolean }}
 * @returns {Promise<{ content: string, reasoning_content?: string }> | AsyncGenerator}
 */
async function chat(options) {
  const { apiKey, modelId, message, stream = false } = options;
  const client = new OpenAI({ baseURL: DEEPSEEK_BASE_URL, apiKey: apiKey.trim() });
  const userContent = (message && String(message).trim()) || 'Hello';
  const messages = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: userContent }
  ];

  if (stream) {
    const streamResult = await client.chat.completions.create({
      model: modelId,
      messages,
      stream: true
    });
    return streamResult; // 返回 async iterable，由 route 层消费并写 SSE
  }

  const completion = await client.chat.completions.create({
    model: modelId,
    messages,
    stream: false
  });
  const msg = completion.choices?.[0]?.message ?? {};
  return {
    content: msg.content ?? '',
    reasoning_content: msg.reasoning_content ?? ''
  };
}

module.exports = { chat, id: 'deepseek' };
