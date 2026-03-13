/**
 * 接口与参数卡片：模型名称、接口地址、回答方式、传递参数
 */
export function ApiSpecCard({ model, endpoint, requestBody, streamCapable, useStream }) {
  return (
    <section className="rounded-xl border border-[var(--input-bar-border)] bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--input-bar-border)] bg-[#f8f9fa]">
        <h3 className="text-xs font-semibold text-[var(--input-placeholder)] uppercase tracking-wide">接口调用方式</h3>
      </div>
      <dl className="divide-y divide-[var(--input-bar-border)]">
        <div className="px-4 py-3 flex flex-col gap-1">
          <dt className="text-xs font-medium text-[var(--input-placeholder)]">模型名称</dt>
          <dd className="text-sm font-medium text-[var(--skill-btn-text)]">{model.name}</dd>
          <dd className="text-xs text-[var(--input-placeholder)] font-mono">{model.id}</dd>
        </div>
        <div className="px-4 py-3 flex flex-col gap-1">
          <dt className="text-xs font-medium text-[var(--input-placeholder)]">接口地址</dt>
          <dd className="text-xs font-mono text-[var(--skill-btn-text)] break-all">
            <span className="text-blue-600 font-medium">POST</span> {endpoint}
          </dd>
        </div>
        <div className="px-4 py-3 flex flex-col gap-1">
          <dt className="text-xs font-medium text-[var(--input-placeholder)]">回答方式</dt>
          <dd className="text-sm text-[var(--skill-btn-text)]">
            {streamCapable ? (
              <span className="inline-flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${useStream ? 'bg-green-500' : 'bg-gray-400'}`} />
                {useStream ? '流式输出（逐字展示）' : '非流式（一次性返回）'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-gray-600">
                <span className="w-2 h-2 rounded-full bg-gray-400" /> 非流式（当前接口为一次性返回）
              </span>
            )}
          </dd>
        </div>
        <div className="px-4 py-3 flex flex-col gap-1">
          <dt className="text-xs font-medium text-[var(--input-placeholder)]">传递参数</dt>
          <dd className="text-xs font-mono text-[var(--skill-btn-text)] bg-[#f8f9fa] rounded-lg p-3 overflow-x-auto">
            <pre className="whitespace-pre-wrap break-all">{JSON.stringify(requestBody, null, 2)}</pre>
          </dd>
        </div>
      </dl>
    </section>
  );
}
