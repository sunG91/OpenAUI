/**
 * DOM 解析：提取页面可交互元素（按钮、输入框、链接等）
 * 通过 page.evaluate 在浏览器上下文执行，返回结构化数据
 */
const EXTRACT_SCRIPT = () => {
  const elements = document.querySelectorAll(
    'button, [role="button"], input:not([type="hidden"]), select, textarea, a[href], [onclick], [tabindex]:not([tabindex="-1"])'
  );
  const result = [];
  const tagCount = {};
  elements.forEach((el) => {
    try {
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      const tag = el.tagName.toLowerCase();
      const type = (el.getAttribute('type') || (tag === 'input' ? 'text' : '')).toLowerCase();
      const placeholder = (el.getAttribute('placeholder') || '').slice(0, 50);
      const name = (el.getAttribute('name') || '').slice(0, 50);
      const id = (el.getAttribute('id') || '').trim();
      const href = (el.getAttribute('href') || '').slice(0, 200);
      let text = '';
      if (el.innerText && el.innerText.length < 100) text = el.innerText.trim().slice(0, 80);
      else if (el.value !== undefined) text = String(el.value).slice(0, 50);
      else if (placeholder) text = placeholder;
      let selector = '';
      if (id && /^[a-zA-Z][\w-]*$/.test(id)) selector = `#${id}`;
      else if (tag === 'input' && name) selector = `input[name="${name}"]`;
      else if (tag === 'a' && href) selector = `a[href="${href.split('?')[0]}"]`;
      else {
        tagCount[tag] = (tagCount[tag] || 0) + 1;
        selector = `${tag}:nth-of-type(${tagCount[tag]})`;
      }
      result.push({
        tag,
        type: type || (tag === 'a' ? 'link' : 'button'),
        selector,
        text: (text || placeholder || name || (href ? '链接' : '')).slice(0, 80),
        placeholder: placeholder || undefined,
        name: name || undefined,
        href: href || undefined,
        rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
      });
    } catch (_) {}
  });
  return result;
};

async function extractInteractiveElements(page) {
  const raw = await page.evaluate(EXTRACT_SCRIPT);
  if (!Array.isArray(raw)) return [];
  return raw.map((r, i) => ({ ...r, index: i + 1 }));
}

/**
 * 生成可用的 CSS 选择器（优先 id、name、文本匹配）
 */
function buildSelector(el) {
  if (el.selector && el.selector.startsWith('#')) return el.selector;
  if (el.tag === 'input' && el.name) return `input[name="${el.name}"]`;
  if (el.tag === 'a' && el.href) return `a[href*="${(el.href || '').split('?')[0].slice(-30)}"]`;
  return el.selector || `${el.tag}:nth-of-type(${el.index})`;
}

module.exports = {
  extractInteractiveElements,
  buildSelector,
};
