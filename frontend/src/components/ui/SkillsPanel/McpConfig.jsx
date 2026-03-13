/**
 * MCP - 技能模块配置：
 * - 选择哪些已启用的 MCP 服务参与「技能测试」的 MCP 对话编排
 */
import { useEffect, useMemo, useState } from 'react';
import { getMcpSettings } from '../../../api/settings';

export function McpConfig() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [servers, setServers] = useState([]);

  const enabledServers = useMemo(
    () => (Array.isArray(servers) ? servers : []).filter((s) => s && s.enabled !== false && s.id),
    [servers]
  );

  const load = async () => {
    setLoading(true);
    setErr('');
    try {
      const mcp = await getMcpSettings();
      const list = Array.isArray(mcp?.servers) ? mcp.servers : [];
      setServers(list);
    } catch (e) {
      setErr(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-3">
      {err && <div className="text-xs text-red-600">{err}</div>}
      {loading ? (
        <div className="text-sm text-[var(--input-placeholder)]">加载中...</div>
      ) : enabledServers.length === 0 ? (
        <div className="text-sm text-[var(--input-placeholder)]">
          暂无可用 MCP 服务。请先在
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent('openaui:navigate', {
                  detail: { sidebar: 'mcp' },
                })
              );
            }}
            className="mx-1 text-blue-500 hover:underline"
          >
            MCP 面板
          </button>
          配置并启用至少一个服务。
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={load}
              className="px-3 py-1.5 text-xs rounded-lg border border-[var(--input-bar-border)] text-[var(--skill-btn-text)] bg-white hover:bg-[var(--skill-btn-bg)]"
            >
              刷新
            </button>
          </div>
          <div className="text-xs text-[var(--input-placeholder)]">
            右侧「MCP 对话测试」会自动使用所有已启用的 MCP 服务，模型会在这些服务提供的工具集合中自动挑选并调用。
          </div>
          <div className="space-y-2">
            {enabledServers.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-2 rounded-lg border border-[var(--input-bar-border)] bg-white px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-[var(--skill-btn-text)] truncate">
                    {s.name || s.id}
                  </div>
                  <div className="text-[10px] text-[var(--input-placeholder)] truncate">
                    {s.type === 'streamableHttp' ? 'HTTP MCP' : '本地 MCP'} · {s.id}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

