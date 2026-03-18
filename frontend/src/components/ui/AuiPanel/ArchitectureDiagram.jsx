/**
 * AUI 架构图 - 无连线、主次分明的架构图风格
 * 机制以虚线框包裹整体，与架构关联但不参与连线
 */
export function ArchitectureDiagram({ architecture }) {
  if (!architecture) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px] text-[var(--input-placeholder)] text-sm">
        请从左侧选择架构
      </div>
    );
  }

  const { decisionLayers = [], executionDepts = [], mechanisms = [] } = architecture;

  return (
    <div className="w-full h-full overflow-y-auto p-6">
      {/* 机制层：虚线框包裹整体，表示跨层约束 */}
      <div className="relative rounded-xl border-2 border-dashed border-emerald-400/60 bg-emerald-50/30 p-6 min-h-[360px]">
        <div className="absolute top-2 right-3 text-xs text-emerald-600/80 font-medium">跨层约束</div>

        {/* 1. 用户意图 - 入口，主位 */}
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="px-6 py-3 rounded-lg border-2 border-sky-400/70 bg-sky-50/95 text-sky-800 text-center shadow-sm">
            <div className="text-sm font-semibold">用户意图</div>
            <div className="text-xs text-sky-600/80 mt-0.5">Input</div>
          </div>
          <span className="text-slate-400 text-lg">↓</span>
        </div>

        {/* 2. 三层决策中枢 - 主区域，横向排列 */}
        <div className="mb-6">
          <div className="text-xs font-medium text-[var(--input-placeholder)] mb-2 uppercase tracking-wider">三层决策中枢</div>
          <div className="flex flex-wrap justify-center gap-4">
            {decisionLayers.map((layer) => (
              <div
                key={layer.id}
                className="flex-1 min-w-[140px] max-w-[200px] px-4 py-3 rounded-lg border-2 border-amber-500/60 bg-amber-50/95 text-amber-900 shadow-sm"
              >
                <div className="text-sm font-semibold">{layer.name}</div>
                <div className="text-xs text-amber-700/80 mt-0.5">{layer.role}</div>
                <div className="text-[11px] text-amber-600/70 mt-1">{layer.desc}</div>
              </div>
            ))}
          </div>
          <div className="flex justify-center mt-2">
            <span className="text-slate-400 text-lg">↓</span>
          </div>
        </div>

        {/* 3. 七大执行部 - 次级区域，网格 */}
        <div>
          <div className="text-xs font-medium text-[var(--input-placeholder)] mb-2 uppercase tracking-wider">七大执行部</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {executionDepts.map((dept) => (
              <div
                key={dept.id}
                className="px-3 py-2.5 rounded-lg border border-slate-300/60 bg-slate-50/95 text-slate-700 text-center"
              >
                <div className="text-sm font-medium">{dept.name}</div>
                <div className="text-[11px] text-slate-500 truncate" title={dept.desc}>{dept.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. 机制 - 底部横条，与整体关联 */}
        {mechanisms.length > 0 && (
          <div className="mt-6 pt-4 border-t border-dashed border-emerald-400/50">
            <div className="flex flex-wrap justify-center gap-3">
              {mechanisms.map((m) => (
                <div
                  key={m.id}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed border-emerald-500/60 bg-emerald-50/90 text-emerald-800"
                >
                  <span className="text-sm font-semibold">{m.name}</span>
                  <span className="text-xs text-emerald-600/80">{m.role}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
