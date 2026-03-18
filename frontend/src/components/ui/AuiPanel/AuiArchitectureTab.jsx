/**
 * AUI 架构选择 Tab - 架构列表与详情
 * 选中架构会持久化到系统配置 backend/data/config.json
 */
import { useState, useEffect } from 'react';
import { getArchitectureList, getArchitectureById } from '../../../data/architectureConfig';
import { getConfigSection, updateConfigSection } from '../../../api/config';
import { ArchitectureDiagram } from './ArchitectureDiagram';
import { ArchitectureDocView } from './ArchitectureDocView';

const iconFlow = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
);
const iconDoc = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

export function AuiArchitectureTab() {
  const list = getArchitectureList();
  const [selectedId, setSelectedId] = useState(list[0]?.id ?? null);
  const [saving, setSaving] = useState(false);
  const [loadErr, setLoadErr] = useState(null);
  const [viewMode, setViewMode] = useState('flow'); // 'flow' | 'doc'
  const arch = selectedId ? getArchitectureById(selectedId) : null;

  useEffect(() => {
    getConfigSection('aui')
      .then((aui) => {
        const id = aui?.architectureId;
        const ids = list.map((a) => a.id);
        if (id && ids.includes(id)) setSelectedId(id);
      })
      .catch((e) => setLoadErr(e?.message || '加载配置失败'));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- list 来自静态配置，仅需挂载时加载
  }, []);

  const handleSelect = async (id) => {
    if (id === selectedId) return;
    setSaving(true);
    setLoadErr(null);
    try {
      await updateConfigSection('aui', { architectureId: id });
      setSelectedId(id);
    } catch (e) {
      setLoadErr(e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-row gap-4 min-h-0 overflow-hidden">
      {/* 左侧：架构列表（单选） */}
      <aside className="w-48 flex-shrink-0 flex flex-col border-r border-[var(--input-bar-border)] pr-4">
        <h3 className="text-sm font-medium text-[var(--skill-btn-text)] mb-1">可选架构</h3>
        <p className="text-xs text-[var(--input-placeholder)] mb-3">架构决定 AI 的决策与执行流程，选中后保存到系统配置</p>
        {loadErr && <p className="text-xs text-red-500 mb-2">{loadErr}</p>}
        <nav className="flex flex-col gap-1">
          {list.map((a) => (
            <label
              key={a.id}
              className={`
                flex items-start gap-2 cursor-pointer px-3 py-2.5 rounded-lg transition-colors
                ${selectedId === a.id
                  ? 'bg-blue-500 text-white'
                  : 'text-[var(--skill-btn-text)] hover:bg-[var(--skill-btn-bg)]'
                }
                ${saving ? 'opacity-70 pointer-events-none' : ''}
              `}
            >
              <input
                type="radio"
                name="aui-architecture"
                value={a.id}
                checked={selectedId === a.id}
                onChange={() => handleSelect(a.id)}
                className="mt-1.5 flex-shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{a.name}</div>
                <div className={`text-[10px] mt-0.5 truncate ${selectedId === a.id ? 'text-blue-100' : 'text-[var(--input-placeholder)]'}`}>
                  {a.tagline}
                </div>
              </div>
            </label>
          ))}
        </nav>
      </aside>

      {/* 右侧：架构图 / 文档（可切换） */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {arch && (
          <div className="flex-shrink-0 flex items-start justify-between gap-2 mb-2">
            <div>
              <h1 className="text-base font-semibold text-[var(--skill-btn-text)]">{arch.name}</h1>
              <p className="text-xs text-[var(--input-placeholder)]">{arch.tagline}</p>
            </div>
            <button
              type="button"
              onClick={() => setViewMode((m) => (m === 'flow' ? 'doc' : 'flow'))}
              title={viewMode === 'flow' ? '切换为文档介绍' : '切换为流程图'}
              className="p-2 rounded-lg text-[var(--input-placeholder)] hover:bg-[var(--skill-btn-bg)] hover:text-[var(--skill-btn-text)] transition-colors"
            >
              {viewMode === 'flow' ? iconDoc : iconFlow}
            </button>
          </div>
        )}
        <div className="flex-1 min-h-0">
          {viewMode === 'flow' ? (
            <ArchitectureDiagram architecture={arch} />
          ) : (
            <ArchitectureDocView architecture={arch} />
          )}
        </div>
      </div>
    </div>
  );
}
