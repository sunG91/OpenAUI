import { StreamingText } from './StreamingText';

/**
 * 对话气泡
 * @param {object} props
 * @param {string} props.role - user | assistant
 * @param {string} props.content
 * @param {string} props.time
 * @param {number} props.index
 * @param {boolean} [props.streaming] - 是否正在流式输出
 * @param {string} [props.messageId]
 * @param {string} [props.sessionId]
 * @param {string} [props.memoryId] - 已加深记忆时存在
 * @param {boolean} [props.showActions] - 是否显示操作按钮
 * @param {boolean} [props.canRollback] - 是否可回退（非最后一条时可回退）
 * @param {boolean} [props.showDeepenMemory] - 是否显示加深记忆（仅 AI 消息）
 * @param {function} [props.onDeepenMemory]
 * @param {function} [props.onRollback]
 */
export function MessageBubble({
  role,
  content,
  time,
  index,
  streaming,
  messageId,
  sessionId,
  memoryId,
  showActions,
  canRollback,
  showDeepenMemory,
  onDeepenMemory,
  onRollback,
}) {
  const isUser = role === 'user';
  const canAct = showActions && sessionId && messageId && !streaming;

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in-up group/bubble`}
      style={{ animationDelay: `${Math.min(index * 0.04, 0.2)}s`, animationFillMode: 'both' }}
    >
      <div
        className={`
          relative max-w-[85%] rounded-2xl px-4 py-2.5
          transition-all duration-300 hover:shadow-sm
          bg-transparent text-gray-800
          ${isUser ? 'rounded-br-md' : 'rounded-bl-md'}
        `}
      >
        {streaming && role === 'assistant' ? (
          <StreamingText text={content} isStreaming={true} markdown={true} className="text-sm" />
        ) : (
          <p className="text-sm whitespace-pre-wrap">{content}</p>
        )}
        <div className={`flex items-center justify-between gap-2 mt-1 ${isUser ? 'flex-row-reverse' : ''}`}>
          <span className="text-xs opacity-70">{time}</span>
          {canAct && (
            <div className="relative flex items-center gap-0.5 opacity-60 group-hover/bubble:opacity-100 transition-opacity">
              {canRollback && (
                <button
                  type="button"
                  className="p-1 rounded hover:bg-amber-500/20 text-amber-600 text-xs"
                  title="回退到此，清除此后所有消息"
                  onClick={() => onRollback?.()}
                >
                  ↪
                </button>
              )}
              {showDeepenMemory && (
                <button
                  type="button"
                  className="p-1 rounded hover:bg-black/10 text-xs"
                  title="加深记忆（写入向量）"
                  onClick={() => onDeepenMemory?.()}
                  disabled={!!memoryId}
                >
                  {memoryId ? (
                    <span className="text-amber-600" title="已加深记忆">★</span>
                  ) : (
                    <span className="opacity-70" title="加深记忆">☆</span>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
