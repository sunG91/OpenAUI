import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function ChangelogModal({ open, onClose, title = '更新记录', src = '/docs/CHANGELOG.md' }) {
  const PAGE_SIZE = 20;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [allLines, setAllLines] = useState([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const scrollerRef = useRef(null);

  const canRender = open && !loading && !error;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setVisibleCount(PAGE_SIZE);
    fetch(src, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error(`加载失败（${r.status}）`);
        return await r.text();
      })
      .then((text) => {
        if (cancelled) return;
        const raw = (text || '# 更新记录\n\n暂无记录。').replace(/\r\n/g, '\n');
        setAllLines(raw.split('\n'));
        queueMicrotask(() => {
          scrollerRef.current?.scrollTo({ top: 0, behavior: 'auto' });
        });
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message || '加载失败');
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, src]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const content = useMemo(() => {
    if (!allLines.length) return '';
    return allLines.slice(0, visibleCount).join('\n');
  }, [allLines, visibleCount]);

  const hasMore = visibleCount < allLines.length;

  const maybeLoadMore = () => {
    const el = scrollerRef.current;
    if (!el || !hasMore) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceToBottom < 120) {
      setVisibleCount((c) => Math.min(c + PAGE_SIZE, allLines.length));
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        type="button"
        aria-label="关闭弹窗"
        className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
        onClick={() => onClose?.()}
      />
      <div className="relative flex w-[min(720px,calc(100vw-2rem))] max-h-[min(78vh,720px)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--input-bar-border)] px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-[var(--skill-btn-text)]">{title}</h2>
            <p className="mt-0.5 text-xs text-[var(--input-placeholder)]">每次改完核心代码，请同步更新此文档</p>
          </div>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--skill-btn-text)] hover:bg-[var(--skill-btn-bg)]"
            onClick={() => onClose?.()}
          >
            关闭
          </button>
        </div>

        <div
          ref={scrollerRef}
          className="min-h-0 flex-1 overflow-y-auto px-5 py-4"
          onScroll={maybeLoadMore}
        >
          {loading && <div className="text-xs text-[var(--input-placeholder)]">正在加载更新记录…</div>}
          {!!error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
          {canRender && (
            <div className="text-xs leading-relaxed text-[var(--skill-btn-text)]">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  // 这是用户看的更新记录：尽量朴素，不强调代码块样式
                  pre: ({ node, ...p }) => <pre className="my-1.5 whitespace-pre-wrap break-words" {...p} />,
                  code: ({ node, inline, ...p }) => <code className={inline ? 'px-1' : ''} {...p} />,
                  p: ({ node, ...p }) => <p className="my-1.5" {...p} />,
                  ul: ({ node, ...p }) => <ul className="my-2 list-inside list-disc space-y-1" {...p} />,
                  ol: ({ node, ...p }) => <ol className="my-2 list-inside list-decimal space-y-1" {...p} />,
                  h1: ({ node, ...p }) => <h1 className="mt-2.5 mb-1 text-sm font-semibold" {...p} />,
                  h2: ({ node, ...p }) => <h2 className="mt-2 mb-1 text-xs font-semibold" {...p} />,
                  h3: ({ node, ...p }) => <h3 className="mt-2 mb-1 text-xs font-medium" {...p} />,
                  blockquote: ({ node, ...p }) => <blockquote className="border-l-2 border-gray-300 pl-2 my-1.5 text-[var(--input-placeholder)]" {...p} />,
                  a: ({ node, ...p }) => <a className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer" {...p} />,
                }}
              >
                {content}
              </ReactMarkdown>

              {hasMore && (
                <div className="mt-3 text-[11px] text-[var(--input-placeholder)]">
                  向下滚动加载更多…
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

