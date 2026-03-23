/**
 * 从模型返回文本中尽量解析出 JSON 对象
 */
export function parseLlmJson(text) {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('模型返回为空');

  const code = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (code ? code[1] : raw).trim();

  const tryParse = (s) => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };

  let parsed = tryParse(candidate);
  if (parsed && typeof parsed === 'object') return parsed;

  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start >= 0 && end > start) {
    parsed = tryParse(candidate.slice(start, end + 1));
    if (parsed && typeof parsed === 'object') return parsed;
  }

  throw new Error('无法解析为 JSON，请重试或换模型');
}
