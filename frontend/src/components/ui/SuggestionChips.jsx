/**
 * 建议话术 - 浅灰圆角矩形，文字 + 箭头，点击可填入或发送
 */
export function SuggestionChips({ items, onSelect, className = '' }) {
  if (!items?.length) return null;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {items.map((text, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSelect?.(text)}
          className="
            w-full max-w-md mx-auto flex items-center justify-between
            px-4 py-2.5 rounded-xl
            bg-[var(--skill-btn-bg)] text-[var(--skill-btn-text)] text-sm font-medium
            hover:bg-[var(--skill-btn-hover)] transition-colors duration-200
            border border-[var(--input-bar-border)] shadow-[var(--shadow-input)]
            active:scale-[0.99]
          "
        >
          <span>{text}</span>
          <svg className="w-4 h-4 flex-shrink-0 ml-2 text-[var(--input-placeholder)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      ))}
    </div>
  );
}
