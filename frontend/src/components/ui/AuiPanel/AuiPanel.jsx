/**
 * AUI 模块 - 产品核心与架构选择
 * Tab1: AUI 介绍 | Tab2: 架构选择 | Tab3: 天枢测试（隔离沙箱）
 */
import { useState } from 'react';
import { AuiIntroTab } from './AuiIntroTab';
import { AuiArchitectureTab } from './AuiArchitectureTab';
import { AuiTianshuSandboxTab } from './AuiTianshuSandboxTab';

const TABS = [
  { id: 'intro', label: 'AUI 介绍' },
  { id: 'architecture', label: '架构选择' },
  { id: 'tianshu-test', label: '天枢测试' },
];

export function AuiPanel({ className = '' }) {
  const [activeTab, setActiveTab] = useState('intro');

  return (
    <div className={`flex-1 w-full flex flex-col overflow-hidden bg-white ${className}`}>
      {/* 顶部 Tab */}
      <div className="flex-shrink-0 border-b border-[var(--input-bar-border)] px-4">
        <div className="flex gap-1 pt-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`
                px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors duration-200
                ${activeTab === tab.id
                  ? 'bg-white text-blue-500 border border-[var(--input-bar-border)] border-b-white -mb-px'
                  : 'text-[var(--input-placeholder)] hover:text-[var(--skill-btn-text)] hover:bg-[var(--skill-btn-bg)]'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab 内容区 */}
      <div
        className={`flex-1 flex flex-col min-h-0 ${
          activeTab === 'tianshu-test'
            ? 'overflow-hidden h-full p-2 sm:p-3 bg-transparent'
            : 'overflow-y-auto px-4 py-6'
        }`}
      >
        {activeTab === 'intro' && <AuiIntroTab />}
        {activeTab === 'architecture' && <AuiArchitectureTab />}
        {activeTab === 'tianshu-test' && <AuiTianshuSandboxTab />}
      </div>
    </div>
  );
}
