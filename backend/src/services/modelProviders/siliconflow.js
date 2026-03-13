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
 *   stream: boolean
 * }}
 * @returns {Promise<{ content: string, reasoning_content?: string }> | AsyncGenerator}
 */
async function chat(options) {
  const { apiKey, modelId, message, messages, stream = false } = options;
  const client = new OpenAI({ baseURL: SILICONFLOW_BASE_URL, apiKey: apiKey.trim() });

  /** 兼容两种模式：
   * 1）传统纯文本：仅传 message 字符串；
   * 2）多模态：直接传完整 messages 数组（可包含多张 image_url / video_url / audio_url）。
   */
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

  if (stream) {
    const streamResult = await client.chat.completions.create({
      model: modelId,
      messages: finalMessages,
      stream: true
    });
    // 返回 async iterable，由上层 route 使用 SSE 向前端推送
    return streamResult;
  }

  const completion = await client.chat.completions.create({
    model: modelId,
    messages: finalMessages,
    stream: false
  });
  const msg = completion.choices?.[0]?.message ?? {};
  return {
    content: msg.content ?? '',
    reasoning_content: msg.reasoning_content ?? ''
  };
}

module.exports = { chat, id: 'siliconflow' };


