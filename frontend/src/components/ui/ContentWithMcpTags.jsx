/**
 * 将正文中的 [工具名]、[keyword]、【标签名称】识别为可点击的 MCP 标签
 * 用于 AI 回复正文中提及工具时的样式统一
 */
import { MarkdownBlock } from './ModelTestPanel/MarkdownBlock';

function escapeRegex(s) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 将 content 中的 [toolName]、【标签】替换为 [text](mcp://idx)，供 MarkdownBlock 识别
 */
function injectMcpLinks(content, mcpCalls) {
  if (!content || !Array.isArray(mcpCalls) || mcpCalls.length === 0) return content;
  const idToIdx = new Map();
  const identifiers = [];
  for (const c of mcpCalls) {
    if (c.toolName) {
      const key = String(c.toolName).trim();
      if (key && !idToIdx.has(key)) {
        idToIdx.set(key, mcpCalls.indexOf(c));
        identifiers.push(key);
      }
    }
    if (c.keyword && c.keyword !== c.toolName) {
      const key = String(c.keyword).trim();
      if (key && !idToIdx.has(key)) {
        idToIdx.set(key, mcpCalls.indexOf(c));
        identifiers.push(key);
      }
    }
  }
  if (identifiers.length === 0) return content;
  identifiers.sort((a, b) => (b?.length ?? 0) - (a?.length ?? 0));
  const pattern = identifiers.map(escapeRegex).join('|');
  const replaceFn = (_, inner) => {
    const idx = idToIdx.get(inner);
    return idx !== undefined ? `[${inner}](mcp://${idx})` : null;
  };
  let result = content;
  result = result.replace(new RegExp(`\\[(${pattern})\\]`, 'g'), (m, inner) => replaceFn(m, inner) ?? m);
  result = result.replace(new RegExp(`【(${pattern})】`, 'g'), (m, inner) => replaceFn(m, inner) ?? m);
  return result;
}

export function ContentWithMcpTags({ content, mcpCalls, onMcpTagClick, className = '' }) {
  if (!content) return null;
  const processed = injectMcpLinks(content, mcpCalls);
  const hasMcpLinks = processed !== content;
  return (
    <MarkdownBlock
      className={className}
      mcpCalls={hasMcpLinks ? mcpCalls : undefined}
      onMcpTagClick={onMcpTagClick}
    >
      {processed}
    </MarkdownBlock>
  );
}
