/**
 * 记忆存储面板 - 基于 Vectra 的本地向量存储
 * 当前仅展示功能模块介绍，具体功能后续实现
 */
const iconStorage = (
  <svg className="w-16 h-16 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
  </svg>
);

export function MemoryStoragePanel({ className = '' }) {
  return (
    <div className={`flex-1 w-full overflow-y-auto px-6 py-8 ${className}`}>
      <div className="max-w-2xl mx-auto">
        <div className="flex flex-col items-center text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-indigo-50 mb-4">
            {iconStorage}
          </div>
          <h2 className="text-xl font-semibold text-[var(--skill-btn-text)] mb-2">记忆存储</h2>
          <p className="text-sm text-[var(--input-placeholder)]">
            基于 Vectra 的本地向量数据库，为 AI 对话提供持久化记忆能力
          </p>
        </div>

        <div className="rounded-xl border border-[var(--input-bar-border)] bg-white p-6 space-y-6">
          <section>
            <h3 className="text-sm font-medium text-[var(--skill-btn-text)] mb-3">模块介绍</h3>
            <ul className="space-y-2 text-sm text-[var(--input-placeholder)]">
              <li className="flex items-start gap-2">
                <span className="text-indigo-500 mt-0.5">•</span>
                <span><strong className="text-[var(--skill-btn-text)]">Vectra 对接</strong>：Node.js 原生本地向量数据库，零配置、无 Python 依赖</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-500 mt-0.5">•</span>
                <span><strong className="text-[var(--skill-btn-text)]">独立存储目录</strong>：向量数据存储在 <code className="px-1.5 py-0.5 rounded bg-gray-100 text-xs">backend/data/vectra/</code> 目录下，与其它数据隔离</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-500 mt-0.5">•</span>
                <span><strong className="text-[var(--skill-btn-text)]">本地运行</strong>：纯本地运行，无需网络或独立服务，零配置启动</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-500 mt-0.5">•</span>
                <span><strong className="text-[var(--skill-btn-text)]">RAG 支持</strong>：支持语义检索、检索增强生成（RAG）、推荐系统等相似度工作流</span>
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-sm font-medium text-[var(--skill-btn-text)] mb-3">后续规划</h3>
            <p className="text-sm text-[var(--input-placeholder)]">
              记忆的写入、查询、管理等功能将在后续版本中逐步完善。
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
