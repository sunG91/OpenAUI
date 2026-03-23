/**
 * 赏罚账本 — 各模块沉淀的注意事项（可查阅、可编辑）
 */
import { useState, useCallback } from 'react';
import {
  TIANSHU_TEST_MODULE_IDS,
  getModuleDisplayLabel,
  replaceModuleTips,
} from '../../../data/tianshuTestSkillsStore';

function rowLabel(moduleId, architecture) {
  const id = String(moduleId || '');
  if (id.startsWith('dept:')) {
    const did = id.replace('dept:', '');
    const name = architecture?.executionDepts?.find((x) => x.id === did)?.name;
    return name ? `执行部 · ${name}` : `执行部 · ${did}`;
  }
  return getModuleDisplayLabel(id);
}

/** @param {{ skillsStore: object, onSkillsChange: (next: object) => void, architecture?: object | null }} props */
export function TianshuLedgerPanel({ skillsStore, onSkillsChange, architecture = null }) {
  const [open, setOpen] = useState({});
  /** 展开时的编辑草稿，避免每次 keystroke 写回全局 */
  const [drafts, setDrafts] = useState({});

  const toggle = useCallback((id) => {
    setOpen((prev) => {
      const nextOpen = !prev[id];
      if (nextOpen) {
        const tips = skillsStore?.modules?.[id]?.tips || [];
        setDrafts((d) => ({ ...d, [id]: tips.join('\n') }));
      }
      return { ...prev, [id]: nextOpen };
    });
  }, [skillsStore]);

  const saveModule = useCallback(
    (moduleId) => {
      const raw = drafts[moduleId] ?? '';
      const lines = raw
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      const next = replaceModuleTips(skillsStore, moduleId, lines);
      onSkillsChange(next);
    },
    [drafts, skillsStore, onSkillsChange],
  );

  return (
    <div className="space-y-1.5 pb-2">
      <p className="text-[10px] text-amber-200/85 px-0.5 leading-relaxed">
        以下为各模块从「赏罚台评价」沉淀的要点，可展开查阅或修改；一行一条，保存后写入本地并参与下次推演提示词。
      </p>
      <ul className="space-y-1">
        {TIANSHU_TEST_MODULE_IDS.map((id) => {
          const tips = skillsStore?.modules?.[id]?.tips || [];
          const count = tips.length;
          const label = rowLabel(id, architecture);
          const isOpen = !!open[id];
          return (
            <li key={id} className="rounded-lg border border-amber-400/35 bg-amber-950/20 overflow-hidden">
              <button
                type="button"
                onClick={() => toggle(id)}
                className="w-full flex items-center justify-between gap-2 px-2.5 py-2 text-left hover:bg-amber-900/25 transition-colors"
              >
                <span className="text-[11px] font-medium text-amber-100/95 truncate">{label}</span>
                <span className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[9px] text-amber-300/90 tabular-nums">{count} 条</span>
                  <span className={`text-amber-200/80 text-[10px] transition-transform ${isOpen ? 'rotate-90' : ''}`}>▸</span>
                </span>
              </button>
              {isOpen && (
                <div className="px-2.5 pb-2.5 pt-0 border-t border-amber-400/25 space-y-2">
                  <textarea
                    value={drafts[id] ?? ''}
                    onChange={(e) => setDrafts((d) => ({ ...d, [id]: e.target.value }))}
                    onBlur={() => saveModule(id)}
                    placeholder="一行一条注意事项；留空表示该模块暂无沉淀"
                    rows={8}
                    className="w-full rounded-md border border-amber-400/30 bg-slate-950/50 px-2 py-1.5 text-[11px] text-amber-50/95 placeholder:text-amber-200/35 font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-amber-400/45"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => saveModule(id)}
                      className="text-[10px] px-2 py-1 rounded-md border border-amber-400/45 text-amber-100 hover:bg-amber-900/35"
                    >
                      保存
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
