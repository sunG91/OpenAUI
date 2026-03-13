/**
 * 模块化聊天输入栏
 * 第一行：仅输入框 + 语音
 * 第二行：加号 + 最多 3 个标签 + 更多（弹窗展示其余）
 * 「更多」弹框用 Portal 挂到 body，置顶且不受输入栏 overflow 限制
 */
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { SkillButton } from './SkillButton';
import { VoiceButton } from './VoiceButton';
import { getSkillEnabled } from './SkillsPanel/skillsStore';

const iconPlus = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);
const iconQuick = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);
const iconMcp = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <rect x="3" y="4" width="18" height="14" rx="2" />
    <path d="M7 8h10M7 12h6M7 16h4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const iconSuper = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
);
const iconPpt = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);
const iconImage = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);
const iconWrite = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);
const iconVideo = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);
const iconMore = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zm0 10a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2z" />
  </svg>
);

const MAX_VISIBLE_SKILLS = 3;

/** 技能列表：当前仅保留一个「快速」，其他功能后续逐步上线再补充 */
const DEFAULT_SKILLS = [
  { id: 'quick', icon: iconQuick, label: '快速', tag: null, tagType: 'beta' },
  { id: 'mcp', icon: iconMcp, label: 'MCP', tag: null, tagType: 'beta' },
];

export function ChatInputBar({
  value,
  onChange,
  onSend,
  onSkillSelect,
  onPlusClick,
  quickMode = false,
  mcpMode = false,
  placeholder = '发消息或输入「/」选择技能',
  voiceActive,
  onVoiceToggle,
  disabled,
  skills = DEFAULT_SKILLS,
  showPlus = true,
  className = '',
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [morePopupRect, setMorePopupRect] = useState(null);
  const moreButtonRef = useRef(null);
  const morePopupRef = useRef(null);
  const [activeSkillId, setActiveSkillId] = useState(null);

  // 只展示在技能页已开启的技能项，与技能栏开关对应
  const skillsWithoutMore = skills.filter((s) => s.id !== 'more' && getSkillEnabled(s.id));
  const visibleSkills = skillsWithoutMore.slice(0, MAX_VISIBLE_SKILLS);
  const moreSkills = skillsWithoutMore.slice(MAX_VISIBLE_SKILLS);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend?.();
    }
  };

  const updateMorePopupRect = () => {
    if (moreButtonRef.current) {
      const rect = moreButtonRef.current.getBoundingClientRect();
      setMorePopupRect({ left: rect.left, bottom: rect.top });
    }
  };

  useEffect(() => {
    if (!moreOpen) {
      setMorePopupRect(null);
      return;
    }
    updateMorePopupRect();
  }, [moreOpen]);

  useEffect(() => {
    if (!moreOpen) return;
    const onDocClick = (e) => {
      const inButton = moreButtonRef.current?.contains(e.target);
      const inPopup = morePopupRef.current?.contains(e.target);
      if (!inButton && !inPopup) setMoreOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [moreOpen]);

  return (
    <div
      className={`
        rounded-[var(--input-bar-radius)] border border-[var(--input-bar-border)]
        bg-[var(--input-bar-bg)] shadow-[var(--shadow-input)]
        hover:shadow-[var(--shadow-input-hover)] transition-shadow duration-200
        overflow-hidden
        ${className}
      `}
    >
      {/* 第一行：输入框（右侧内嵌语音图标） */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center px-3 py-1.5 rounded-full bg-white/80">
            <input
              type="text"
              value={value}
              onChange={(e) => onChange?.(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              className="flex-1 min-w-0 bg-transparent text-[var(--skill-btn-text)] placeholder:text-[var(--input-placeholder)] text-sm outline-none"
            />
            {onVoiceToggle && (
              <button
                type="button"
                onClick={onVoiceToggle}
                title={voiceActive ? '关闭语音' : '开启语音'}
                className={`
                  ml-2 flex items-center justify-center rounded-full
                  w-7 h-7 text-xs transition-colors duration-200
                  ${voiceActive
                    ? 'bg-blue-500 text-white'
                    : 'text-[var(--input-placeholder)] hover:bg-[var(--skill-btn-hover)]'
                  }
                `}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
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
            )}
          </div>
        </div>
      </div>

      {/* 第二行：加号 + 最多 3 个标签 + 更多 */}
      <div className="px-3 pb-3 pt-0 flex items-center gap-1.5 flex-wrap">
        {showPlus && (
          <button
            type="button"
            onClick={() => onPlusClick?.()}
            className="p-2 rounded-lg text-[var(--skill-btn-text)] hover:bg-[var(--skill-btn-hover)] transition-colors"
            title="技能设置"
          >
            {iconPlus}
          </button>
        )}
        {visibleSkills.map((skill) => (
          <SkillButton
            key={skill.id}
            icon={skill.icon}
            label={skill.label}
            tag={skill.tag}
            tagType={skill.tagType}
            active={
              skill.id === 'quick'
                ? quickMode
                : skill.id === 'mcp'
                ? mcpMode
                : activeSkillId === skill.id
            }
            onClick={() => {
              setActiveSkillId((prev) => (prev === skill.id ? null : skill.id));
              onSkillSelect?.(skill.id);
            }}
          />
        ))}
        {moreSkills.length > 0 && (
          <div ref={moreButtonRef}>
            <SkillButton
              icon={iconMore}
              label="更多"
              tag={null}
              tagType="beta"
              onClick={() => {
                setMoreOpen((o) => !o);
                if (!moreOpen) setTimeout(updateMorePopupRect, 0);
              }}
            />
          </div>
        )}
      </div>

      {moreOpen && morePopupRect && createPortal(
        <div
          ref={morePopupRef}
          role="dialog"
          aria-label="更多技能"
          className="fixed py-2 px-2 rounded-xl bg-white border border-[var(--input-bar-border)] shadow-lg min-w-[160px] animate-fade-in z-[9999]"
          style={{
            left: morePopupRect.left,
            bottom: `calc(100vh - ${morePopupRect.bottom}px + 6px)`,
          }}
        >
          <div className="flex flex-col gap-0.5">
            {moreSkills.map((skill) => (
              <button
                key={skill.id}
                type="button"
                onClick={() => {
                  onSkillSelect?.(skill.id);
                  setMoreOpen(false);
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm text-[var(--skill-btn-text)] hover:bg-[var(--skill-btn-hover)] transition-colors"
              >
                {skill.icon}
                <span>{skill.label}</span>
                {skill.tag && (
                  <span className={`text-xs ml-auto ${skill.tagType === 'free' ? 'text-[var(--tag-free)]' : 'text-[var(--tag-beta)]'}`}>
                    {skill.tag}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
