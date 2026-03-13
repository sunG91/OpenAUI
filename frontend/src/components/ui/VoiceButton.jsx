/**
 * 语音开关按钮 - 麦克风图标
 */
export function VoiceButton({ active, onClick, title, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? (active ? '关闭语音' : '开启语音')}
      className={`
        p-3 rounded-xl transition-all duration-300
        active:scale-95
        ${active
          ? 'bg-blue-500 text-white shadow-md shadow-blue-200'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:scale-105'
        }
        ${className}
      `}
    >
      {/* 麦克风图标 */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 10v2a7 7 0 0 1-14 0v-2"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 19v4"
        />
      </svg>
    </button>
  );
}
