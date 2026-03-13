/**
 * 滑动开关 - 左关右开样式
 */
export function SkillToggle({ checked, onChange, disabled, className = '' }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={`
        relative inline-flex h-6 w-10 shrink-0 rounded-full transition-colors duration-200
        focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2
        ${checked ? 'bg-blue-500' : 'bg-[var(--input-bar-border)]'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
    >
      <span
        className={`
          pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow
          transform transition-transform duration-200 mt-0.5
          ${checked ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'}
        `}
      />
    </button>
  );
}
