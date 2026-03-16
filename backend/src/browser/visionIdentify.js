/**
 * 多态识别：截图 + 视觉模型识别 UI 元素
 * 结合视觉与结构分析，返回可操作的 selector 或描述
 */
const { readApiKeys } = require('../apikeys-store');
const { getProvider } = require('../services/modelProviders');

const IDENTIFY_PROMPT = `这是一张网页截图。请根据用户描述，识别图中对应的可点击/可输入元素。

用户描述：{{PROMPT}}

请仅返回一个 JSON 对象，格式如下（二选一）：
1. 若能推断出 CSS 选择器：{"selector":"button.submit","description":"提交按钮"}
2. 若无法推断：{"selector":null,"description":"位于页面右上角的蓝色登录按钮，文字为「登录」"}

不要输出 markdown、不要解释，仅输出 JSON。`;

async function identifyWithVision(imageDataUrl, prompt, vendorId, modelId) {
  const apiKey = readApiKeys()[vendorId];
  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
    return { ok: false, error: '请先在设置中保存该厂商的 API Key' };
  }
  const provider = getProvider(vendorId);
  if (!provider || typeof provider.chat !== 'function') {
    return { ok: false, error: `暂不支持的厂商: ${vendorId}` };
  }
  const textPrompt = IDENTIFY_PROMPT.replace('{{PROMPT}}', (prompt || '请描述页面上的主要可交互元素').trim());
  const messages = [
    {
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: imageDataUrl, detail: 'high' } },
        { type: 'text', text: textPrompt },
      ],
    },
  ];
  try {
    const result = await provider.chat({
      apiKey,
      modelId,
      messages,
      stream: false,
    });
    const raw = (result?.content ?? '').trim();
    const jsonStr = raw.replace(/^```\w*\n?|\n?```$/g, '').trim();
    let obj;
    try {
      obj = JSON.parse(jsonStr);
    } catch {
      return { ok: true, selector: null, description: raw };
    }
    return {
      ok: true,
      selector: obj.selector || null,
      description: obj.description || raw,
    };
  } catch (e) {
    return { ok: false, error: e?.message || '视觉识别失败' };
  }
}

module.exports = { identifyWithVision };
