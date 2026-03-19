/**
 * 硅基流动 API 调用（OpenAI 兼容，多模态）
 * @see https://docs.siliconflow.cn/cn/faqs/stream-mode
 * @see https://docs.siliconflow.cn/cn/userguide/capabilities/multimodal-vision
 */
const OpenAI = require('openai').default || require('openai');

const SILICONFLOW_BASE_URL = 'https://api.siliconflow.cn/v1';

/**
 * @param {{
 *   apiKey: string,
 *   modelId: string,
 *   message?: string,
 *   messages?: any[],
 *   stream?: boolean,
 *   tools?: any[]
 * }}
 * @returns {Promise<{ content: string, reasoning_content?: string, tool_calls?: any[] }> | AsyncGenerator}
 */
async function chat(options) {
  const { apiKey, modelId, message, messages, stream = false, tools } = options;
  const client = new OpenAI({ baseURL: SILICONFLOW_BASE_URL, apiKey: apiKey.trim() });

  let finalMessages;
  if (Array.isArray(messages) && messages.length > 0) {
    finalMessages = messages;
  } else {
    const userContent = (message && String(message).trim()) || 'Hello';
    finalMessages = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: userContent }
    ];
  }

  const createOpts = {
    model: modelId,
    messages: finalMessages,
    stream,
  };
  if (Array.isArray(tools) && tools.length > 0) {
    createOpts.tools = tools;
    createOpts.tool_choice = 'auto';
  }

  if (stream) {
    return client.chat.completions.create(createOpts);
  }

  const completion = await client.chat.completions.create(createOpts);
  const msg = completion.choices?.[0]?.message ?? {};
  return {
    content: msg.content ?? '',
    reasoning_content: msg.reasoning_content ?? '',
    tool_calls: msg.tool_calls,
  };
}

module.exports = { chat, id: 'siliconflow' };


