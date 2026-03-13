/**
 * 控制台工具 - 带「查看」与「测试」Tab
 */
import { useState } from 'react';
import { ConsoleToolsView } from './ConsoleToolsView';
import { ConsoleToolsTest } from './ConsoleToolsTest';

const TABS = [
  { id: 'view', label: '查看' },
  { id: 'test', label: '测试' },
];

export function ConsoleTools() {
  const [tab, setTab] = useState('view');

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-shrink-0 flex border-b border-[var(--input-bar-border)] bg-[#f8f9fa]">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`
              px-4 py-2.5 text-sm font-medium transition-colors
              ${tab === t.id
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                : 'text-[var(--input-placeholder)] hover:text-[var(--skill-btn-text)]'
              }
            `}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className={`flex-1 min-h-0 flex flex-col p-4 ${tab === 'test' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        {tab === 'view' && <ConsoleToolsView />}
        {tab === 'test' && (
          <div className="flex-1 min-h-0 overflow-hidden">
            <ConsoleToolsTest />
          </div>
        )}
      </div>
    </div>
  );
}
