/**
 * 技能面板 - 左右布局：左侧技能栏（带开关），右侧固定模型 + 测试
 */
import { useState, useEffect } from 'react';
import { SKILL_MODULES } from './skillModules';
import { SkillToggle } from './SkillToggle';
import { QuickFixedModel } from './QuickFixedModel';
import { SkillTestArea } from './SkillTestArea';
import { getAllSkillsEnabled, setSkillEnabledAndReturnAll } from './skillsStore';
import { getSkillSettings } from '../../../api/settings';
import { SkillModuleCard } from './SkillModuleCard';
import { QuickConfig } from './QuickConfig';
import { McpConfig } from './McpConfig';
import { McpTestArea } from './McpTestArea';

export function SkillsPanel({ className = '' }) {
  const moduleIds = SKILL_MODULES.map((m) => m.id);
  const [enabled, setEnabled] = useState(() => getAllSkillsEnabled(moduleIds));
  const [fixedModel, setFixedModel] = useState(null);
  const [activeModuleId, setActiveModuleId] = useState(() => SKILL_MODULES[0]?.id || 'quick');

  const loadFixedModel = async () => {
    try {
      const s = await getSkillSettings();
      const q = s.quick || {};
      if (q.vendorId && q.modelId) {
        setFixedModel({ vendorId: q.vendorId, modelId: q.modelId });
      } else {
        setFixedModel(null);
      }
    } catch {
      setFixedModel(null);
    }
  };

  useEffect(() => {
    setEnabled(getAllSkillsEnabled(moduleIds));
  }, []);

  useEffect(() => {
    loadFixedModel();
  }, []);

  const handleToggle = (id, value) => {
    setEnabled(setSkillEnabledAndReturnAll(id, value, moduleIds));
  };

  // 响应全局请求，外部点击 MCP 技能按钮时切换到对应模块
  useEffect(() => {
    const onActivate = (e) => {
      const id = e?.detail?.moduleId;
      if (!id) return;
      setActiveModuleId(id);
    };
    window.addEventListener('openaui:skills-activate', onActivate);
    return () => window.removeEventListener('openaui:skills-activate', onActivate);
  }, []);

  return (
    <div className={`flex-1 w-full flex flex-row min-h-0 overflow-hidden bg-white ${className}`}>
      {/* 左侧：技能栏 */}
      <aside className="w-56 flex-shrink-0 flex flex-col border-r border-[var(--input-bar-border)] bg-[#fafafa]">
        <div className="flex-shrink-0 px-4 py-3 border-b border-[var(--input-bar-border)] bg-white">
          <h2 className="text-base font-medium text-[var(--skill-btn-text)]">技能栏</h2>
          <p className="text-xs text-[var(--input-placeholder)] mt-0.5">开启后可在对话与测试中使用</p>
        </div>
        <nav className="flex-1 overflow-y-auto p-2">
          {SKILL_MODULES.map((mod) => (
            <div
              key={mod.id}
              role="button"
              tabIndex={0}
              onClick={() => setActiveModuleId(mod.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setActiveModuleId(mod.id);
              }}
              className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg transition-colors cursor-pointer ${
                activeModuleId === mod.id
                  ? 'bg-white border border-blue-200 shadow-[var(--shadow-input)]'
                  : 'hover:bg-white/80'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-[var(--skill-btn-text)] truncate">{mod.label}</div>
                {mod.desc && (
                  <div className="text-[10px] text-[var(--input-placeholder)] truncate mt-0.5">{mod.desc}</div>
                )}
              </div>
              <SkillToggle
                checked={enabled[mod.id] !== false}
                onChange={(v) => handleToggle(mod.id, v)}
              />
            </div>
          ))}
        </nav>
      </aside>

      {/* 右侧：固定模型 + 测试 */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-y-auto bg-white">
        <div className="p-4 space-y-4">
          {activeModuleId === 'quick' && (
            <>
              <QuickFixedModel onSaved={loadFixedModel} />
              <SkillModuleCard id="quick" label="快速" desc="对话输入栏下的快速技能配置">
                <QuickConfig />
              </SkillModuleCard>
              <div className="flex-1 min-h-0">
                <SkillTestArea fixedModel={fixedModel} />
              </div>
            </>
          )}

          {activeModuleId === 'mcp' && (
            <>
              <SkillModuleCard id="mcp" label="MCP" desc="在技能测试中启用并联动 MCP 服务">
                <McpConfig />
              </SkillModuleCard>
              <div className="flex-1 min-h-0">
                <McpTestArea />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
