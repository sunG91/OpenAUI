/**
 * 测试对话卡片：输入、流式选项、发送、响应结果（含 Markdown）
 */
import { MarkdownBlock } from './MarkdownBlock';

export function TestChatCard({
  message,
  setMessage,
  useStream,
  setUseStream,
  streamCapable,
  voiceReply,
  setVoiceReply,
  onSpeak,
  loading,
  apiKeySet,
  onTest,
  result
}) {
  const iconStream = (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h10" />
    </svg>
  );
  const iconVoice = (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 01-14 0v-2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19v4m-4 0h8" />
    </svg>
  );

  return (
    <section className="rounded-xl border border-[var(--input-bar-border)] bg-white overflow-hidden flex flex-col flex-1 min-h-0">
      <div className="flex-shrink-0 px-4 py-3 border-b border-[var(--input-bar-border)] bg-[#f8f9fa]">
        <h3 className="text-xs font-semibold text-[var(--input-placeholder)] uppercase tracking-wide">测试对话</h3>
      </div>
      <div className="p-4 flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex flex-col md:flex-row gap-4 flex-1 min-h-0 overflow-hidden">
          <div className="md:w-[44%] flex-shrink-0 space-y-3">
            <div>
              <label className="block text-xs font-medium text-[var(--input-placeholder)] mb-1.5">请求内容</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="输入要发送给模型的内容..."
                rows={8}
                className="w-full px-3 py-2.5 text-sm border border-[var(--input-bar-border)] rounded-lg bg-white placeholder:text-[var(--input-placeholder)] focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none resize-none"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {streamCapable && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setUseStream?.(!useStream)}
                  title={useStream ? '流式输出：已开启' : '流式输出：已关闭'}
                  aria-label="流式输出"
                  className={`
                    inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-colors
                    ${useStream
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white text-[var(--input-placeholder)] border-[var(--input-bar-border)] hover:bg-[var(--skill-btn-bg)]'
                    }
                    ${loading ? 'opacity-60 cursor-not-allowed' : ''}
                  `}
                >
                  {iconStream}
                </button>
              )}
              <button
                type="button"
                disabled={loading}
                onClick={() => setVoiceReply?.(!voiceReply)}
                title={voiceReply ? '语音回复：已开启（只朗读回答）' : '语音回复：已关闭'}
                aria-label="语音回复"
                className={`
                  inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-colors
                  ${voiceReply
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white text-[var(--input-placeholder)] border-[var(--input-bar-border)] hover:bg-[var(--skill-btn-bg)]'
                  }
                  ${loading ? 'opacity-60 cursor-not-allowed' : ''}
                `}
              >
                {iconVoice}
              </button>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={!apiKeySet || loading}
                onClick={onTest}
                className={`
                  px-4 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${apiKeySet && !loading
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-[var(--skill-btn-bg)] text-[var(--input-placeholder)] cursor-not-allowed'
                  }
                `}
              >
                {loading ? '请求中…' : '发送'}
              </button>
              {!apiKeySet && (
                <span className="text-xs text-amber-600">请先在「设置」中配置 API Key</span>
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0 min-h-[180px] rounded-lg border border-[var(--input-bar-border)] bg-[#fafafa] overflow-hidden flex flex-col relative">
            <div className="flex-shrink-0 px-3 py-2 border-b border-[var(--input-bar-border)] bg-white">
              <div className="text-xs font-medium text-[var(--input-placeholder)] flex items-center gap-2">
                {result == null ? '结果' : result.success ? '结果' : '错误'}
                {result?.streaming && (
                  <span className="inline-flex items-center gap-1 text-green-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    输出中…
                  </span>
                )}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-3">
              {result == null ? (
                <div className="text-xs text-[var(--input-placeholder)]">右侧展示返回内容（滚动查看更多）</div>
              ) : result.success ? (
                <div className="space-y-3 text-sm">
                  {result.reasoning_content != null && result.reasoning_content.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-[var(--input-placeholder)] mb-1">思考</div>
                      <div className="text-[13px] bg-white rounded-md px-3 py-2 border border-[var(--input-bar-border)]">
                        <MarkdownBlock>{result.reasoning_content}</MarkdownBlock>
                        {result.streaming && (
                          <span className="inline-block w-2 h-4 ml-0.5 bg-amber-500 animate-pulse align-middle" aria-hidden />
                        )}
                      </div>
                    </div>
                  )}
                  <div>
                    {result.reasoning_content != null && result.reasoning_content.length > 0 && (
                      <div className="text-xs font-medium text-[var(--input-placeholder)] mb-1">回答</div>
                    )}
                    <div className="text-[var(--skill-btn-text)]">
                      {(result.content || (result.streaming ? '' : '（无文本内容）')) ? (
                        <MarkdownBlock>{result.content || ''}</MarkdownBlock>
                      ) : (
                        result.streaming ? null : <span className="text-[var(--input-placeholder)]">（无文本内容）</span>
                      )}
                      {result.streaming && (
                        <span className="inline-block w-2 h-4 ml-0.5 bg-blue-500 animate-pulse align-middle" aria-hidden />
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-red-700">{result.error}</div>
              )}
            </div>

            {result?.success && !result?.streaming && String(result?.content || '').trim() && (
              <button
                type="button"
                onClick={() => onSpeak?.(result.content)}
                title="朗读回答"
                aria-label="朗读回答"
                className="absolute right-3 bottom-3 inline-flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--input-bar-border)] bg-white/90 text-[var(--input-placeholder)] hover:bg-[var(--skill-btn-bg)] transition-colors shadow-sm"
              >
                {iconVoice}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
