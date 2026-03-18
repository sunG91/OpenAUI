/**
 * 工具面板 - 左右布局：左侧工具列表，右侧内容区（查看 / 测试）
 */
import { useState } from 'react';
import { TOOL_MODULES } from './toolModules';
import { ConsoleTools } from './ConsoleTools';
import { SystemTools } from './SystemTools';
import { GuiTools } from './GuiTools';
import { WinuiTools } from './WinuiTools';
import { BrowserTools } from './BrowserTools';
import { VisionTools } from './VisionTools';
import { CanvasTools } from './CanvasTools';

const TOOL_COMPONENTS = {
  ConsoleTools,
  SystemTools,
  GuiTools,
  WinuiTools,
  BrowserTools,
  VisionTools,
  CanvasTools,
};

export function ToolsPanel({ className = '' }) {
  const [selectedId, setSelectedId] = useState(TOOL_MODULES[0]?.id ?? null);

  const current = TOOL_MODULES.find((t) => t.id === selectedId);
  const ContentComponent = current ? TOOL_COMPONENTS[current.component] : null;

  return (
    <div className={`flex-1 w-full flex flex-row min-h-0 overflow-hidden bg-white ${className}`}>
      {/* 左侧：工具列表 */}
      <aside className="w-52 flex-shrink-0 flex flex-col border-r border-[var(--input-bar-border)] bg-[#fafafa]">
        <div className="flex-shrink-0 px-4 py-3 border-b border-[var(--input-bar-border)] bg-white">
          <h2 className="text-base font-medium text-[var(--skill-btn-text)]">工具</h2>
          <p className="text-xs text-[var(--input-placeholder)] mt-0.5">系统级工具，供 AI 操作电脑等</p>
        </div>
        <nav className="flex-1 overflow-y-auto p-2">
          {TOOL_MODULES.map((mod) => (
            <button
              key={mod.id}
              type="button"
              onClick={() => setSelectedId(mod.id)}
              className={`
                w-full text-left px-3 py-2.5 rounded-lg transition-colors
                ${selectedId === mod.id
                  ? 'bg-blue-500 text-white'
                  : 'text-[var(--skill-btn-text)] hover:bg-white/80'
                }
              `}
            >
              <div className="text-sm font-medium truncate">{mod.label}</div>
              {mod.desc && (
                <div className={`text-[10px] mt-0.5 truncate ${selectedId === mod.id ? 'text-blue-100' : 'text-[var(--input-placeholder)]'}`}>
                  {mod.desc}
                </div>
              )}
            </button>
          ))}
        </nav>
      </aside>

      {/* 右侧：内容区（带 Tab：查看 / 测试） */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-white">
        {current && (
          <div className="flex-shrink-0 px-4 py-3 border-b border-[var(--input-bar-border)] bg-white">
            <h3 className="text-sm font-semibold text-[var(--skill-btn-text)]">{current.label}</h3>
            {current.desc && (
              <p className="text-xs text-[var(--input-placeholder)] mt-0.5">{current.desc}</p>
            )}
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-hidden">
          {ContentComponent ? <ContentComponent /> : (
            <div className="p-4 text-sm text-[var(--input-placeholder)]">请从左侧选择工具</div>
          )}
        </div>
      </div>
    </div>
  );
}
