/**
 * 多态识别：截图 + 视觉模型识别 UI 元素
 * 结合视觉与结构分析，返回可操作的 selector 或描述
 */
const { readApiKeys } = require('../apikeys-store');
const { getProvider } = require('../services/modelProviders');
const { getQuickFixedModel } = require('../skill-settings-store');

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

const LOCATE_PROMPT = `这是一张屏幕截图（可能包含浏览器窗口）。请找出图中「{{PROMPT}}」的中心坐标（可点击热区中心）。

以图片左上角为原点，单位像素。仅返回一个 JSON，格式：{"x":数字,"y":数字,"element":"元素描述","confidence":0.0-1.0}
其中 element 为简短描述（如"提交按钮"），confidence 为置信度。不要其他文字。`;

/** 从文本中解析坐标，返回 { ok, obj } 或 { ok: false } */
function parseCoordFromText(raw) {
  const jsonStr = raw.replace(/^```\w*\n?|\n?```$/g, '').trim();
  try {
    const obj = JSON.parse(jsonStr);
    if (obj != null && (obj.x != null || obj.y != null)) {
      return { ok: true, obj: { x: Number(obj.x) || 0, y: Number(obj.y) || 0 } };
    }
  } catch (_) {}
  const xMatch = raw.match(/["']?x["']?\s*:\s*(\d+(?:\.\d+)?)/);
  const yMatch = raw.match(/["']?y["']?\s*:\s*(\d+(?:\.\d+)?)/);
  if (xMatch && yMatch) {
    return { ok: true, obj: { x: Number(xMatch[1]), y: Number(yMatch[1]) } };
  }
  return { ok: false };
}

/** 从文本中解析 verify 结果：{ correct, x?, y? } */
function parseVerifyFromText(raw) {
  const jsonStr = raw.replace(/^```\w*\n?|\n?```$/g, '').trim();
  try {
    const obj = JSON.parse(jsonStr);
    if (obj && typeof obj.correct === 'boolean') {
      if (obj.correct) return { ok: true, correct: true };
      return { ok: true, correct: false, x: Math.round(Number(obj.x) || 0), y: Math.round(Number(obj.y) || 0) };
    }
  } catch (_) {}
  const correctMatch = raw.match(/["']?correct["']?\s*:\s*true/);
  if (correctMatch) return { ok: true, correct: true };
  const coord = parseCoordFromText(raw);
  if (coord.ok) return { ok: true, correct: false, x: coord.obj.x, y: coord.obj.y };
  return { ok: false };
}

const REREPARSE_PROMPT = `以下是一段视觉模型对屏幕截图的描述，其中包含某个 UI 元素的中心坐标（以图片左上角为原点，单位像素）。

请从中提取坐标，仅返回一个 JSON，格式：{"x":数字,"y":数字}。不要输出 markdown、不要解释、不要其他文字。

原文：
---
{{RAW}}
---`;

const REREPARSE_VERIFY_PROMPT = `以下是一段视觉模型的审核结果，需判断坐标是否正确，或提取正确坐标。

请仅返回一个 JSON：若坐标正确则 {"correct":true}；若不正确则 {"correct":false,"x":数字,"y":数字}。不要其他文字。

原文：
---
{{RAW}}
---`;

async function locateWithVision(imageDataUrl, prompt, vendorId, modelId) {
  const apiKey = readApiKeys()[vendorId];
  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
    return { ok: false, error: '请先在设置中保存该厂商的 API Key' };
  }
  const provider = getProvider(vendorId);
  if (!provider || typeof provider.chat !== 'function') {
    return { ok: false, error: `暂不支持的厂商: ${vendorId}` };
  }
  const textPrompt = LOCATE_PROMPT.replace('{{PROMPT}}', (prompt || '确认您是真人的复选框').trim());
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
      // 尝试从文本中提取 {"x":数字,"y":数字} 模式（模型可能附带说明文字）
      const xMatch = raw.match(/["']?x["']?\s*:\s*(\d+(?:\.\d+)?)/);
      const yMatch = raw.match(/["']?y["']?\s*:\s*(\d+(?:\.\d+)?)/);
      if (xMatch && yMatch) {
        obj = { x: Number(xMatch[1]), y: Number(yMatch[1]) };
      } else {
        // 使用快速技能模型重新解析为规范格式
        const quick = getQuickFixedModel();
        if (quick) {
          const quickKey = readApiKeys()[quick.vendorId];
          const quickProvider = getProvider(quick.vendorId);
          if (quickKey && quickProvider?.chat) {
            try {
              const reraw = await quickProvider.chat({
                apiKey: quickKey,
                modelId: quick.modelId,
                message: REREPARSE_PROMPT.replace('{{RAW}}', raw),
                stream: false,
              });
              const rerawText = (reraw?.content ?? '').trim();
              const parsed = parseCoordFromText(rerawText);
              if (parsed.ok) {
                obj = parsed.obj;
              }
            } catch (_) {}
          }
        }
        if (!obj) {
          return { ok: false, error: `无法解析坐标。模型返回：${raw.slice(0, 150)}${raw.length > 150 ? '…' : ''}` };
        }
      }
    }
    const x = Math.round(Number(obj.x) || 0);
    const y = Math.round(Number(obj.y) || 0);
    return { ok: true, x, y, element: obj.element, confidence: obj.confidence };
  } catch (e) {
    return { ok: false, error: e?.message || '视觉定位失败' };
  }
}

/** 点击效果校验：点击后截图，判断目标是否已消失/状态改变（OpenClaw 闭环校验） */
const CLICK_EFFECT_PROMPT = `这是一张点击操作后的屏幕截图。用户目标是点击「{{PROMPT}}」。

请判断：该目标是否已被成功点击（如按钮变灰、弹窗出现、目标消失、界面状态明显改变等）。
仅返回 JSON：{"success":true} 表示点击生效；{"success":false} 表示未生效或无法判断。不要其他文字。`;

async function verifyClickEffect(imageDataUrl, prompt, vendorId, modelId) {
  const apiKey = readApiKeys()[vendorId];
  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
    return { ok: false, error: '请先在设置中保存该厂商的 API Key' };
  }
  const provider = getProvider(vendorId);
  if (!provider || typeof provider.chat !== 'function') {
    return { ok: false, error: `暂不支持的厂商: ${vendorId}` };
  }
  const textPrompt = CLICK_EFFECT_PROMPT.replace('{{PROMPT}}', (prompt || '目标元素').trim());
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
    const result = await provider.chat({ apiKey, modelId, messages, stream: false });
    const raw = (result?.content ?? '').trim().replace(/^```\w*\n?|\n?```$/g, '').trim();
    let obj;
    try {
      obj = JSON.parse(raw);
    } catch {
      const successMatch = raw.match(/["']?success["']?\s*:\s*true/);
      obj = successMatch ? { success: true } : { success: false };
    }
    return { ok: true, success: !!obj.success };
  } catch (e) {
    return { ok: false, error: e?.message || '点击效果校验失败' };
  }
}

const VERIFY_PROMPT = `图中已用红色十字标记了初步定位的点击坐标。用户目标是：{{PROMPT}}

请判断红点是否准确落在目标元素中心。若准确，返回 {"correct":true}。若不准确，请给出正确的中心坐标，返回 {"correct":false,"x":数字,"y":数字}。以图片左上角为原点，单位像素。仅输出 JSON，不要其他文字。`;

async function verifyLocateWithVision(imageDataUrl, prompt, vendorId, modelId) {
  const apiKey = readApiKeys()[vendorId];
  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
    return { ok: false, error: '请先在设置中保存该厂商的 API Key' };
  }
  const provider = getProvider(vendorId);
  if (!provider || typeof provider.chat !== 'function') {
    return { ok: false, error: `暂不支持的厂商: ${vendorId}` };
  }
  const textPrompt = VERIFY_PROMPT.replace('{{PROMPT}}', (prompt || '确认您是真人的复选框').trim());
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
      // 使用快速技能模型重新解析为规范格式
      const quick = getQuickFixedModel();
      if (quick) {
        const quickKey = readApiKeys()[quick.vendorId];
        const quickProvider = getProvider(quick.vendorId);
        if (quickKey && quickProvider?.chat) {
          try {
            const reraw = await quickProvider.chat({
              apiKey: quickKey,
              modelId: quick.modelId,
              message: REREPARSE_VERIFY_PROMPT.replace('{{RAW}}', raw),
              stream: false,
            });
            const parsed = parseVerifyFromText((reraw?.content ?? '').trim());
            if (parsed.ok) {
              if (parsed.correct) return { ok: true, correct: true };
              return { ok: true, correct: false, x: parsed.x, y: parsed.y };
            }
          } catch (_) {}
        }
      }
      return { ok: false, error: '无法解析审核结果' };
    }
    if (obj.correct === true) {
      return { ok: true, correct: true };
    }
    const x = Math.round(Number(obj.x) || 0);
    const y = Math.round(Number(obj.y) || 0);
    return { ok: true, correct: false, x, y };
  } catch (e) {
    return { ok: false, error: e?.message || '视觉审核失败' };
  }
}

module.exports = { identifyWithVision, locateWithVision, verifyLocateWithVision, verifyClickEffect };
