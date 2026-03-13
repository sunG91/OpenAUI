/**
 * 响应内容 Markdown 渲染（代码块、列表、标题等）
 */
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function MarkdownBlock({ children, className = '' }) {
  const text = (children != null && typeof children === 'string') ? children : '';
  if (!text) return null;
  return (
    <div
      className={`
        model-test-markdown text-[13px] leading-relaxed space-y-1.5 max-w-full overflow-x-auto
        [&_p]:text-[var(--skill-btn-text)]
        [&_ul]:pl-4 [&_ol]:pl-4
        [&_strong]:font-semibold
        [&_b]:font-semibold
        [&_em]:italic
        [&_i]:italic
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
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
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
          a: ({ node, ...p }) => <a className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer" {...p} />,
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
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
