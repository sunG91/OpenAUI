/**
 * 流式输出模块：逐字吐出 + 渐变弹出效果，速度随 AI 返回节奏自适应
 * 所有流式回答统一走此组件
 */
import { useEffect, useState } from 'react';
import { MarkdownBlock } from './ModelTestPanel/MarkdownBlock';
import { ContentWithMcpTags } from './ContentWithMcpTags';

const TICK_MS = 18;
const STEP_FAST = 8;
const STEP_MED = 4;
const STEP_SLOW = 2;
const BEHIND_FAST = 50;
const BEHIND_MED = 20;

export function StreamingText({
  text = '',
  markdown = true,
  className = '',
  isStreaming = false,
  /** 完全露出后是否仍显示光标（例如还在 loading） */
  showCursorWhenCaughtUp = false,
  /** 跳过动画，直接展示全文 */
  instant = false,
  /** MCP 调用记录，用于正文中 [工具名] 识别为可点击标签 */
  mcpCalls,
  onMcpTagClick,
}) {
  const [displayedLength, setDisplayedLength] = useState(0);

  useEffect(() => {
    if (!text || text.length === 0) {
      setDisplayedLength(0);
      return;
    }
    if (instant) {
      setDisplayedLength(text.length);
      return;
    }
    const id = setInterval(() => {
      setDisplayedLength((prev) => {
        const target = text.length;
        if (prev >= target) return prev;
        const behind = target - prev;
        const step = behind > BEHIND_FAST ? STEP_FAST : behind > BEHIND_MED ? STEP_MED : STEP_SLOW;
        return Math.min(prev + step, target);
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [text, instant]);

  const caughtUp = displayedLength >= (text?.length ?? 0);
  const showCursor = isStreaming || (showCursorWhenCaughtUp && caughtUp && text?.length > 0);
  const visible = text ? text.slice(0, displayedLength) : '';
  const rest = visible.slice(0, -1);
  const lastChar = visible.length > 0 ? visible.slice(-1) : '';

  if (!visible && !showCursor) return null;

  return (
    <div className={`streaming-text-wrapper ${className}`}>
      {visible ? (
        markdown ? (
          mcpCalls?.length > 0 ? (
            <ContentWithMcpTags
              content={visible}
              mcpCalls={mcpCalls}
              onMcpTagClick={onMcpTagClick}
              className="streaming-text-content"
            />
          ) : (
            <MarkdownBlock className="streaming-text-content">{visible}</MarkdownBlock>
          )
        ) : (
          <>
            {rest ? (
              <span className="streaming-text-content text-[13px] leading-relaxed text-[var(--skill-btn-text)] whitespace-pre-wrap">
                {rest}
              </span>
            ) : null}
            {lastChar ? (
              <span className="streaming-char-pop inline-block animate-streaming-char-pop text-[13px] leading-relaxed text-[var(--skill-btn-text)]">
                {lastChar}
              </span>
            ) : null}
          </>
        )
      ) : null}
      {showCursor && (
        <span
          className="streaming-cursor inline-block w-0.5 h-4 ml-0.5 align-middle rounded-full bg-gradient-to-b from-transparent via-[var(--skill-btn-text)] to-transparent opacity-80 animate-streaming-cursor"
          aria-hidden
        />
      )}
    </div>
  );
}
