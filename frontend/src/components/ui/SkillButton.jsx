/**
 * 技能/模块按钮 - 药丸形，图标+文字，可选副标签（Beta/免费）
 * 支持选中态，便于底部标签高亮
 */
export function SkillButton({ icon, label, tag, tagType = 'beta', active = false, onClick, disabled = false, className = '' }) {
  const tagClass = active
    ? 'text-white/90'
    : tagType === 'free'
      ? 'text-[var(--tag-free)]'
      : 'text-[var(--tag-beta)]';

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1.5
        rounded-full text-sm font-medium
        transition-colors duration-200 active:scale-[0.98]
        ${active
          ? 'bg-blue-500 text-white'
          : 'bg-[var(--skill-btn-bg)] text-[var(--skill-btn-text)] hover:bg-[var(--skill-btn-hover)]'
        }
        ${className}
      `}
    >
      {icon && <span className={`flex-shrink-0 ${active ? 'text-white' : 'text-[var(--skill-btn-text)]'}`}>{icon}</span>}
      <span>{label}</span>
      {tag && (
        <span className={`text-xs ${tagClass}`}>{tag}</span>
      )}
    </button>
  );
}
