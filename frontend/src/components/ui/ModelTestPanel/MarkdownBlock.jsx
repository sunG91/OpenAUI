/**
 * 响应内容 Markdown 渲染（代码块、列表、标题等）
 * remark-cjk-friendly：解决 **加粗** 在中文旁不生效的问题（CommonMark 对 CJK 的边界限制）
 */
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkCjkFriendly from 'remark-cjk-friendly';

const ZWSP = '\u200B'; // 零宽空格，用于修复 **"..."** 不被 CommonMark 识别（" 是 punctuation 导致 ** 无法 left-flanking）

function fixBoldWithPunctuation(s) {
  return s
    .replace(/\*\*(["\u201C\u201D'\u2018\u2019])/g, (_, c) => `**${ZWSP}${c}`)
    .replace(/(["\u201C\u201D'\u2018\u2019])\*\*/g, (_, c) => `${c}${ZWSP}**`);
}

export function MarkdownBlock({ children, className = '', mcpCalls, onMcpTagClick }) {
  const raw = (children != null && typeof children === 'string') ? children : '';
  if (!raw) return null;
  const text = fixBoldWithPunctuation(raw);
  const components = {
    pre: ({ node, ...p }) => (
      <pre
        className="my-2 overflow-x-auto rounded-lg bg-[#111827] p-3 text-[12px] text-[#e5e7eb] border border-[#1f2937]"
        {...p}
      />
    ),
    code: ({ node, inline, ...p }) =>
      inline ? (
        <code
          className="rounded bg-[#f3f4f6] px-1.5 py-0.5 font-mono text-[12px] text-[var(--skill-btn-text)]"
          {...p}
        />
      ) : (
        <code className="block" {...p} />
      ),
    p: ({ node, ...p }) => <p className="my-1.5" {...p} />,
    ul: ({ node, ...p }) => <ul className="my-1.5 list-disc space-y-0.5" {...p} />,
    ol: ({ node, ...p }) => <ol className="my-1.5 list-decimal space-y-0.5" {...p} />,
    h1: ({ node, ...p }) => <h1 className="mt-3 mb-1.5 text-[15px] font-semibold" {...p} />,
    h2: ({ node, ...p }) => <h2 className="mt-2.5 mb-1 text-[14px] font-semibold" {...p} />,
    h3: ({ node, ...p }) => <h3 className="mt-2 mb-1 text-[13px] font-medium" {...p} />,
    blockquote: ({ node, ...p }) => <blockquote className="border-l-4 border-gray-300 pl-3 my-1.5 text-gray-600" {...p} />,
    strong: ({ node, ...p }) => <strong className="font-bold" {...p} />,
    b: ({ node, ...p }) => <b className="font-bold" {...p} />,
    a: ({ node, href, children: linkChildren, ...p }) => {
      const m = String(href || '').match(/^mcp:\/\/(\d+)$/);
      if (m && Array.isArray(mcpCalls) && mcpCalls[m[1]]) {
        const call = mcpCalls[m[1]];
        const idx = parseInt(m[1], 10);
        return (
          <button
            type="button"
            className="px-2 py-0.5 rounded-md text-xs font-medium bg-[#e0f2fe] text-[#0369a1] hover:bg-[#bae6fd] border border-[#7dd3fc] transition-colors inline-flex align-baseline mx-0.5"
            onClick={() => onMcpTagClick?.(call, idx)}
            title={call.toolName}
          >
            {`[${call.keyword || call.toolName || ''}]`}
            {call.error && <span className="ml-0.5 text-red-500">×</span>}
          </button>
        );
      }
      return <a className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer" href={href} {...p}>{linkChildren}</a>;
    },
    table: ({ node, ...p }) => (
      <div className="my-2 overflow-x-auto rounded-lg border border-[var(--input-bar-border)]">
        <table className="min-w-[560px]" {...p} />
      </div>
    ),
    thead: ({ node, ...p }) => <thead {...p} />,
    tbody: ({ node, ...p }) => <tbody {...p} />,
    tr: ({ node, ...p }) => <tr {...p} />,
    th: ({ node, ...p }) => <th className="text-[12px]" {...p} />,
    td: ({ node, ...p }) => <td className="text-[12px]" {...p} />,
  };
  return (
    <div
      className={`
        model-test-markdown text-[13px] leading-relaxed space-y-1.5 max-w-full overflow-x-auto
        [&_p]:text-[var(--skill-btn-text)]
        [&_ul]:pl-4 [&_ol]:pl-4
        [&_strong]:font-semibold [&_b]:font-semibold
        [&_em]:italic [&_i]:italic
        [&_hr]:my-3 [&_hr]:border-t [&_hr]:border-[var(--input-bar-border)]
        [&_li>p]:my-0
        [&_table]:border-collapse [&_table]:w-full
        [&_th]:bg-[#f8fafc] [&_th]:text-left [&_th]:font-semibold
        [&_th]:border [&_th]:border-[var(--input-bar-border)] [&_th]:px-2 [&_th]:py-1
        [&_td]:border [&_td]:border-[var(--input-bar-border)] [&_td]:px-2 [&_td]:py-1
        [&_tr:nth-child(even)]:bg-[#fcfcfd]
        ${className}
      `}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkCjkFriendly]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
