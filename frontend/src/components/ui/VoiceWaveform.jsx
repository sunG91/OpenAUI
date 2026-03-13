/**
 * 语音模式波形动画
 */
export function VoiceWaveform({ className = '' }) {
  const delays = ['0s', '0.12s', '0.24s', '0.36s', '0.48s'];
  return (
    <div
      className={`flex justify-center items-end gap-1 h-5 ${className}`}
      title="语音模式已激活"
    >
      {delays.map((delay, i) => (
        <span
          key={i}
          className="w-1 h-full min-h-[6px] rounded-full bg-blue-400 origin-bottom animate-wave"
          style={{ animationDelay: delay }}
        />
      ))}
    </div>
  );
}
