/**
 * AUI 架构文档视图 - Markdown 介绍
 */
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { buildArchitectureMarkdown } from '../../../data/architectureConfig';

export function ArchitectureDocView({ architecture }) {
  const md = buildArchitectureMarkdown(architecture);

  if (!architecture || !md) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px] text-[var(--input-placeholder)] text-sm">
        请从左侧选择架构
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-4 bg-white rounded-lg border border-[var(--input-bar-border)]">
      <article className="text-[var(--skill-btn-text)] [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_p]:text-sm [&_p]:leading-relaxed [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_li]:text-sm [&_blockquote]:border-l-2 [&_blockquote]:border-sky-300 [&_blockquote]:pl-3 [&_blockquote]:text-[var(--input-placeholder)] [&_blockquote]:italic">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {md}
        </ReactMarkdown>
      </article>
    </div>
  );
}
