import { useState } from 'react';
import { StreamingText } from './StreamingText';
import { ContentWithMcpTags } from './ContentWithMcpTags';

function CopyIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/**
 * 对话气泡
 * @param {object} props
 * @param {string} props.role - user | assistant
 * @param {string} props.content
 * @param {string} props.time
 * @param {number} props.index
 * @param {boolean} [props.streaming] - 是否正在流式输出
 * @param {string} [props.status] - 状态：mcp_retrieving 正在检索、mcp_done 正在生成回答、mcp_summarizing 正在汇总
 * @param {string} [props.mcpToolName] - 当前检索的 MCP 工具名
 * @param {Array<{serverId, toolName, args, result, summary?, keyword?, error?}>} [props.mcpCalls] - MCP 调用记录，keyword 需完整表意
 * @param {function} [props.onMcpTagClick] - 点击 MCP 标签时回调 (call, index) => void
 * @param {string} [props.messageId]
 * @param {string} [props.sessionId]
 * @param {string} [props.memoryId] - 已加深记忆时存在
 * @param {boolean} [props.showActions] - 是否显示操作按钮
 * @param {boolean} [props.canRollback] - 是否可回退（仅 role=user 且非最后一条时显示）
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
  status,
  mcpToolName,
  mcpCalls,
  messageId,
  sessionId,
  memoryId,
  showActions,
  canRollback,
  showDeepenMemory,
  onDeepenMemory,
  onRollback,
  onMcpTagClick,
}) {
  const isUser = role === 'user';
  const canAct = showActions && sessionId && messageId && !streaming;
  const hasMcpCalls = Array.isArray(mcpCalls) && mcpCalls.length > 0;
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

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
          <div className="text-sm space-y-2">
            {/* 流式时内容区不可空：有内容显示内容，无内容则始终显示加载状态 */}
            {(!content || content === '（无内容）') ? (
              status === 'mcp_retrieving' ? (
                <div className="flex items-center gap-1.5 text-[var(--input-placeholder)]">
                  <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  正在检索：{mcpToolName || 'MCP'}
                </div>
              ) : status === 'mcp_summarizing' ? (
                <div className="flex items-center gap-1.5 text-[var(--input-placeholder)]">
                  <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  正在汇总检索结果…
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-[var(--input-placeholder)]">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  正在生成回答…
                </div>
              )
            ) : null}
            {(content && content !== '（无内容）') ? (
              <StreamingText
                text={content}
                isStreaming={true}
                markdown={true}
                className="text-sm"
                mcpCalls={mcpCalls}
                onMcpTagClick={onMcpTagClick}
              />
            ) : null}
            {hasMcpCalls && (
              <div className="flex flex-wrap gap-1.5 pt-1 border-t border-[var(--input-bar-border)]/50">
                {mcpCalls.map((call, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="px-2.5 py-1 rounded-md text-xs font-medium bg-[#e0f2fe] text-[#0369a1] hover:bg-[#bae6fd] border border-[#7dd3fc] transition-colors"
                    onClick={() => onMcpTagClick?.(call, idx)}
                    title={call.toolName}
                  >
                    {`[${call.keyword || call.toolName || ''}]`}
                    {call.error && <span className="ml-0.5 text-red-500">×</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : role === 'assistant' && content ? (
          <div className="space-y-2">
            <ContentWithMcpTags
              content={content}
              mcpCalls={mcpCalls}
              onMcpTagClick={onMcpTagClick}
              className="text-sm"
            />
            {hasMcpCalls && (
              <div className="flex flex-wrap gap-1.5 pt-1 border-t border-[var(--input-bar-border)]/50">
                {mcpCalls.map((call, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="px-2.5 py-1 rounded-md text-xs font-medium bg-[#e0f2fe] text-[#0369a1] hover:bg-[#bae6fd] border border-[#7dd3fc] transition-colors"
                    onClick={() => onMcpTagClick?.(call, idx)}
                    title={call.toolName}
                  >
                    {`[${call.keyword || call.toolName || ''}]`}
                    {call.error && <span className="ml-0.5 text-red-500">×</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm whitespace-pre-wrap">{content}</p>
        )}
        <div className={`flex items-center justify-between gap-2 mt-1 ${isUser ? 'flex-row-reverse' : ''}`}>
          <span className="text-xs opacity-70">{time}</span>
          <div className="relative flex items-center gap-0.5 opacity-60 group-hover/bubble:opacity-100 transition-opacity">
            {content && (
              <button
                type="button"
                className="p-1 rounded hover:bg-black/10 text-xs"
                title={copied ? '已复制' : '复制'}
                onClick={handleCopy}
              >
                {copied ? (
                  <CheckIcon className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <CopyIcon className="w-3.5 h-3.5" />
                )}
              </button>
            )}
            {canAct && (
              <>
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
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
