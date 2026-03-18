import { VoiceWaveform } from './VoiceWaveform';

/**
 * AI 头像 - 带动画效果
 * compact: 用于 header 小尺寸
 */
export function AIAvatar({ showWaveform = false, compact = false }) {
  const sizeClass = compact ? 'w-10 h-10 text-sm' : 'w-20 h-20 text-2xl';
  return (
    <div className={`flex flex-col items-center ${compact ? 'flex-row gap-2' : ''}`}>
      <div
        className={`
          ${sizeClass} rounded-full
          bg-gradient-to-br from-blue-400 to-blue-600
          flex items-center justify-center
          text-white font-semibold
          shadow-md shadow-blue-200/50
          transition-shadow duration-300
          hover:shadow-lg hover:shadow-blue-300/40
          ${compact ? '' : 'animate-float'}
        `}
      >
        <img
          src={`${import.meta.env.BASE_URL}images/头像/ai.png`}
          alt="AI 头像"
          className="w-full h-full rounded-full object-cover select-none"
          draggable={false}
          loading="lazy"
          decoding="async"
          onError={(e) => {
            e.target.src = `${import.meta.env.BASE_URL}images/icon/icon.ico`;
          }}
        />
      </div>
      {showWaveform && (
        <div className={compact ? 'animate-fade-in' : 'mt-3 animate-fade-in'}>
          <VoiceWaveform className={compact ? 'h-3' : ''} />
        </div>
      )}
    </div>
  );
}
