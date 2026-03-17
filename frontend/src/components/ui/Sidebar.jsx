/**
 * 左侧边栏 - 对话、历史、设置等
 */
const iconChat = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
  </svg>
);
const iconHistory = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const iconModelTest = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const iconSkills = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);
const iconTools = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);
const iconMcp = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 7h14M5 12h9M5 17h5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11l2 2 4-4" />
  </svg>
);
const iconSkillsLibrary = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
);
const iconSettings = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const iconNew = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);

const OTHER_ITEMS = [
  { id: 'history', icon: iconHistory, label: '历史' },
  { id: 'tools', icon: iconTools, label: '工具' },
  { id: 'skills', icon: iconSkills, label: '技能' },
  { id: 'mcp', icon: iconMcp, label: 'MCP' },
  { id: 'skills-library', icon: iconSkillsLibrary, label: 'Skills库' },
  { id: 'model-test', icon: iconModelTest, label: '模型测试' },
  { id: 'settings', icon: iconSettings, label: '设置' },
];

export function Sidebar({ activeId = 'chat', onSelect, className = '' }) {
  const renderItem = (item, showActive) => (
    <button
      key={item.id}
      type="button"
      onClick={() => onSelect?.(item.id)}
      title={item.label}
      className={`
        flex flex-col items-center justify-center gap-1
        py-2.5 px-2 w-full rounded-lg
        transition-colors duration-200
        ${showActive && activeId === item.id
          ? 'bg-blue-500 text-white'
          : 'text-[var(--skill-btn-text)] hover:bg-[var(--skill-btn-bg)]'
        }
      `}
    >
      {item.icon}
      <span className="text-xs font-medium">{item.label}</span>
    </button>
  );

  return (
    <aside
      className={`
        w-24 flex-shrink-0 flex flex-col
        border-r border-[var(--input-bar-border)]
        bg-white
        ${className}
      `}
    >
      <nav className="flex-1 flex flex-col py-3 gap-3">
        <div className="mx-2 rounded-xl bg-white border border-[var(--input-bar-border)] p-1.5 shadow-sm">
          <button
            type="button"
            onClick={() => onSelect?.('chat')}
            title="对话"
            className={`
              flex flex-col items-center justify-center gap-1 w-full rounded-lg py-2.5 px-2
              transition-colors duration-200
              ${activeId === 'chat'
                ? 'bg-blue-500 text-white'
                : 'text-[var(--skill-btn-text)] hover:bg-[var(--skill-btn-bg)]'
              }
            `}
          >
            {iconChat}
            <span className="text-xs font-medium">对话</span>
          </button>
          <button
            type="button"
            onClick={() => onSelect?.('new')}
            title="新建"
            className="flex flex-row items-center justify-center gap-1 w-full rounded-md py-1.5 px-2 mt-0.5 text-[var(--skill-btn-text)] hover:bg-[var(--skill-btn-bg)] transition-colors duration-200"
          >
            {iconNew}
            <span className="text-[10px] text-[var(--input-placeholder)] whitespace-nowrap">新建</span>
          </button>
        </div>
        <div className="flex flex-col gap-0.5 mx-2">
          {OTHER_ITEMS.map((item) => renderItem(item, true))}
        </div>
      </nav>
    </aside>
  );
}
