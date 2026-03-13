/**
 * 单个技能配置模块卡片 - 标题 + 配置区域（由各模块自行渲染内容）
 */
export function SkillModuleCard({ id, label, desc, children }) {
  return (
    <section
      className="rounded-xl border border-[var(--input-bar-border)] bg-white overflow-hidden"
      data-skill-module={id}
    >
      <div className="flex-shrink-0 px-4 py-3 border-b border-[var(--input-bar-border)] bg-[#f8f9fa]">
        <h3 className="text-sm font-semibold text-[var(--skill-btn-text)]">{label}</h3>
        {desc && <p className="text-xs text-[var(--input-placeholder)] mt-0.5">{desc}</p>}
      </div>
      <div className="p-4 min-h-[120px]">{children}</div>
    </section>
  );
}
