/**
 * MCP 对话测试区（技能模块）：
 * - 左侧输入自然语言
 * - 右侧输出（Markdown 渲染）
 * - 不指定单个 MCP/工具：基于已选择启用的 MCP 服务工具清单，让模型自动选择并调用
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { MODEL_VENDORS, VENDOR_MODELS } from '../../../data/modelVendors';
import { testModel } from '../../../api/modelTest';
import { getMcpSettings, getSkillSettings } from '../../../api/settings';
import { listMcpTools, callMcpTool } from '../../../api/mcp';
import { MarkdownBlock } from '../ModelTestPanel/MarkdownBlock';

function getFirstModelId(vid) {
  const list = VENDOR_MODELS[vid] || [];
  return list[0]?.id ?? '';
}

function isToolsModel(m) {
  return !!(m && Array.isArray(m.tags) && m.tags.includes('tools'));
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractFirstJsonObject(text) {
  if (!text || typeof text !== 'string') return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  const candidate = text.slice(start, end + 1);
  const obj = safeJsonParse(candidate);
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) return obj;
  return null;
}

function summarizeSchemaForPrompt(schema) {
  if (!schema || typeof schema !== 'object') return {};
  const props = schema.properties && typeof schema.properties === 'object' ? schema.properties : {};
  const required = Array.isArray(schema.required) ? schema.required : [];
  const summaryProps = {};
  for (const [k, def] of Object.entries(props)) {
    if (!def || typeof def !== 'object') continue;
    summaryProps[k] = {
      type: def.type,
      description: def.description,
      enum: Array.isArray(def.enum) ? def.enum.slice(0, 20) : undefined,
      default: Object.prototype.hasOwnProperty.call(def, 'default') ? def.default : undefined,
      example: Object.prototype.hasOwnProperty.call(def, 'example') ? def.example : undefined,
    };
  }
  return { required, properties: summaryProps };
}

export function McpTestArea() {
  const toolVendors = useMemo(() => {
    return MODEL_VENDORS.filter((v) => {
      const ms = VENDOR_MODELS[v.id] || [];
      return ms.some(isToolsModel);
    });
  }, []);
  const firstVendor = toolVendors[0]?.id ?? '';
  const [vendorId, setVendorId] = useState(firstVendor);
  const [modelId, setModelId] = useState(() => {
    const ms = (VENDOR_MODELS[firstVendor] || []).filter(isToolsModel);
    return ms[0]?.id ?? '';
  });
  const [question, setQuestion] = useState('中国能建如何？');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [answer, setAnswer] = useState('');
  const [plan, setPlan] = useState(null); // {serverId, toolName, arguments}
  const [toolRaw, setToolRaw] = useState('');
  const [outputView, setOutputView] = useState('ai'); // 'ai' | 'tool'

  const [mcpServers, setMcpServers] = useState([]);
  const [enabledServerIds, setEnabledServerIds] = useState([]);

  const [splitPct, setSplitPct] = useState(42);
  const draggingRef = useRef(false);

  const models = (VENDOR_MODELS[vendorId] || []).filter(isToolsModel);
  const currentModel = models.find((m) => m.id === modelId) || models[0];

  const enabledServerList = useMemo(() => {
    const all = Array.isArray(mcpServers) ? mcpServers : [];
    const enabled = all.filter((s) => s && s.enabled !== false && s.id);
    const ids = Array.isArray(enabledServerIds) ? enabledServerIds : [];
    if (ids.length === 0) return enabled;
    const set = new Set(ids);
    return enabled.filter((s) => set.has(s.id));
  }, [mcpServers, enabledServerIds]);

  const loadMcpSelection = async () => {
    const [mcp, skill] = await Promise.all([getMcpSettings(), getSkillSettings()]);
    const list = Array.isArray(mcp?.servers) ? mcp.servers : [];
    setMcpServers(list);
    const ids = Array.isArray(skill?.mcp?.enabledServerIds) ? skill.mcp.enabledServerIds : [];
    setEnabledServerIds(ids);
  };

  useEffect(() => {
    loadMcpSelection().catch(() => {});
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      if (!draggingRef.current) return;
      const container = document.getElementById('skill-mcp-split');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = Math.max(25, Math.min(70, (x / rect.width) * 100));
      setSplitPct(pct);
    };
    const onUp = () => {
      draggingRef.current = false;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const buildCallableToolsCatalog = async () => {
    const enabledServers = enabledServerList;
    if (enabledServers.length === 0) return [];
    const results = await Promise.all(
      enabledServers.map(async (s) => {
        try {
          const list = await listMcpTools(s.id);
          const toolsList = Array.isArray(list) ? list : [];
          return toolsList.map((t) => ({
            serverId: s.id,
            serverName: s.name || s.id,
            toolName: t.name,
            description: t.description || '',
            schema: summarizeSchemaForPrompt(t.inputSchema),
          }));
        } catch {
          return [];
        }
      })
    );
    return results.flat();
  };

  const run = async () => {
    const vid = vendorId.trim();
    const mid = (modelId || currentModel?.id || '').trim();
    if (!vid || !mid) {
      setError('请选择支持 tools 的厂商和模型');
      return;
    }
    setLoading(true);
    setError('');
    setAnswer('');
    setPlan(null);
    setToolRaw('');
    setOutputView('ai');
    try {
      const catalog = await buildCallableToolsCatalog();
      if (catalog.length === 0) {
        throw new Error('未发现可调用的 MCP 工具：请先在上方 MCP 模块选择服务，并确保 tools/list 正常。');
      }

      const catalogForPrompt = catalog.slice(0, 80).map((x) => ({
        serverId: x.serverId,
        serverName: x.serverName,
        toolName: x.toolName,
        description: x.description,
        schema: x.schema,
      }));

      const q = question.trim() || '你好';
      const baseSelectPrompt =
        '你是一个 MCP 调用编排器。你必须从给定的工具清单中选择一个最合适的 MCP 工具来回答用户问题，并输出一次可执行的调用计划。\n\n' +
        '【强约束】\n' +
        '- 只能选择清单中出现过的 serverId 和 toolName\n' +
        '- 只输出纯 JSON（不要解释、不要 markdown 代码块）\n' +
        '- 输出格式必须为：{"serverId":"...","toolName":"...","arguments":{...}}\n\n' +
        `【用户问题】\n${q}\n\n` +
        `【可用 MCP 工具清单（最多展示 80 项）】\n${JSON.stringify(catalogForPrompt, null, 2)}\n\n` +
        '现在请输出你的调用计划 JSON。';

      let chosen = null;
      let lastErr = '';
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const prompt =
          attempt === 0 ? baseSelectPrompt : `${baseSelectPrompt}\n\n【上一次失败】\n${lastErr}\n\n请修正并再次只输出计划 JSON。`;
        const resp = await testModel({ vendorId: vid, modelId: mid, message: prompt });
        const text = (resp && resp.content) || '';
        const obj = extractFirstJsonObject(text) || safeJsonParse(text);
        const serverId = String(obj?.serverId || '').trim();
        const toolName = String(obj?.toolName || '').trim();
        const args =
          obj?.arguments && typeof obj.arguments === 'object' && !Array.isArray(obj.arguments) ? obj.arguments : {};
        const exists = catalog.find((c) => c.serverId === serverId && c.toolName === toolName);
        if (!exists) {
          lastErr = `计划选择的工具不存在于清单中：serverId=${serverId} toolName=${toolName}`;
          continue;
        }
        chosen = { serverId, toolName, arguments: args };
        break;
      }
      if (!chosen) throw new Error('模型未能生成可执行的 MCP 调用计划。');
      setPlan(chosen);

      let mcpResult = null;
      let execErr = '';
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          mcpResult = await callMcpTool(chosen.serverId, chosen.toolName, chosen.arguments);
          execErr = '';
          break;
        } catch (e) {
          execErr = e?.message || '调用 MCP 工具失败';
          lastErr = `调用失败：${execErr}\n当前计划：${JSON.stringify(chosen)}`;
          if (attempt < 2) {
            const resp = await testModel({
              vendorId: vid,
              modelId: mid,
              message: `${baseSelectPrompt}\n\n【执行失败信息】\n${lastErr}\n\n请给出新的计划 JSON（可以换工具/改参数）。`,
            });
            const text = (resp && resp.content) || '';
            const obj = extractFirstJsonObject(text) || safeJsonParse(text);
            const serverId = String(obj?.serverId || '').trim();
            const toolName = String(obj?.toolName || '').trim();
            const args =
              obj?.arguments && typeof obj.arguments === 'object' && !Array.isArray(obj.arguments) ? obj.arguments : {};
            const exists = catalog.find((c) => c.serverId === serverId && c.toolName === toolName);
            if (exists) chosen = { serverId, toolName, arguments: args };
          }
        }
      }
      if (execErr) throw new Error(execErr);

      const mcpResultText = JSON.stringify(mcpResult ?? {}, null, 2);
      setToolRaw(mcpResultText);
      const finalPrompt =
        `你是一个严谨的助手，需要基于 MCP 工具返回的数据来回答用户的问题。\n\n` +
        `【本次调用的 MCP 工具】\n- serverId：${chosen.serverId}\n- toolName：${chosen.toolName}\n- arguments：${JSON.stringify(chosen.arguments || {})}\n\n` +
        `【MCP 工具原始返回（JSON）】\n${mcpResultText}\n\n` +
        `【用户问题】\n${q}\n\n` +
        '请用 Markdown 输出报告，包含：\n' +
        '- 思考过程（分点）\n' +
        '- 工具调用情况（表格：serverId/toolName/关键字段）\n' +
        '- 最终结论（清晰建议）\n' +
        '禁止重复粘贴完整 JSON，只能引用关键字段名称或关键数值进行解释。';

      const out = await testModel({ vendorId: vid, modelId: mid, message: finalPrompt });
      setAnswer((out && out.content) || '（模型未返回内容）');
    } catch (e) {
      setError(e?.message || '测试失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-[var(--input-bar-border)] bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--input-bar-border)] bg-[#f8f9fa]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[var(--skill-btn-text)]">MCP 对话测试</h3>
            <p className="text-xs text-[var(--input-placeholder)] mt-0.5">
              模型会在「已启用并勾选」的 MCP 服务工具集合中自动挑选并调用（不指定单个工具）。
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadMcpSelection().catch(() => {})}
            className="px-3 py-1.5 text-xs rounded-lg border border-[var(--input-bar-border)] text-[var(--skill-btn-text)] bg-white hover:bg-[var(--skill-btn-bg)]"
          >
            刷新 MCP
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {error && <div className="text-xs text-red-600">{error}</div>}

        {toolVendors.length === 0 ? (
          <div className="text-sm text-[var(--input-placeholder)]">
            当前没有可用于 MCP 测试的模型（需要模型配置带 <code className="font-mono">tools</code> 标签）。
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--input-placeholder)] mb-1">厂商</label>
              <select
                value={vendorId}
                onChange={(e) => {
                  const v = e.target.value;
                  setVendorId(v);
                  const ms = (VENDOR_MODELS[v] || []).filter(isToolsModel);
                  setModelId(ms[0]?.id ?? '');
                }}
                className="w-full px-3 py-2 text-sm border border-[var(--input-bar-border)] rounded-lg bg-white focus:ring-2 focus:ring-blue-400 outline-none"
              >
                {toolVendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--input-placeholder)] mb-1">模型</label>
              <select
                value={modelId || currentModel?.id}
                onChange={(e) => setModelId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[var(--input-bar-border)] rounded-lg bg-white focus:ring-2 focus:ring-blue-400 outline-none"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div id="skill-mcp-split" className="flex min-h-[320px] h-[420px] border border-[var(--input-bar-border)] rounded-lg overflow-hidden">
          {/* 左：输入 */}
          <div className="h-full min-w-0" style={{ width: `${splitPct}%` }}>
            <div className="h-full flex flex-col">
              <div className="px-3 py-2 text-xs text-[var(--input-placeholder)] border-b border-[var(--input-bar-border)] bg-[#fafafa]">
                输入对话
              </div>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                className="flex-1 w-full text-sm px-3 py-2 outline-none resize-none"
                placeholder="像正常对话一样输入问题…"
              />
              <div className="p-2 border-t border-[var(--input-bar-border)] bg-white flex items-center justify-between gap-2">
                <div className="text-[10px] text-[var(--input-placeholder)] truncate">
                  已参与 MCP：{enabledServerList.length} 个
                </div>
                <button
                  type="button"
                  onClick={run}
                  disabled={loading}
                  className={`px-3 py-1.5 text-xs rounded-lg text-white ${
                    loading ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'
                  }`}
                >
                  {loading ? '测试中…' : '开始测试'}
                </button>
              </div>
            </div>
          </div>

          {/* 拖拽条 */}
          <div
            className="w-1 bg-[var(--input-bar-border)] cursor-col-resize"
            onMouseDown={() => {
              draggingRef.current = true;
            }}
            title="拖拽调整左右宽度"
          />

          {/* 右：输出 */}
          <div className="flex-1 min-w-0 h-full">
            <div className="h-full flex flex-col min-h-0">
              <div className="px-3 py-2 text-xs text-[var(--input-placeholder)] border-b border-[var(--input-bar-border)] bg-[#fafafa] flex items-center justify-between gap-2">
                <span>输出内容</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setOutputView('tool')}
                    className={`px-2 py-0.5 rounded text-[11px] border ${
                      outputView === 'tool'
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-white text-[var(--skill-btn-text)] border-[var(--input-bar-border)]'
                    }`}
                  >
                    工具原始返回
                  </button>
                  <button
                    type="button"
                    onClick={() => setOutputView('ai')}
                    className={`px-2 py-0.5 rounded text-[11px] border ${
                      outputView === 'ai'
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-white text-[var(--skill-btn-text)] border-[var(--input-bar-border)]'
                    }`}
                  >
                    AI 回答
                  </button>
                </div>
                {plan && (
                  <span className="text-[10px] text-[var(--input-placeholder)] truncate">
                    {plan.serverId} / {plan.toolName}
                  </span>
                )}
              </div>
              <div className="flex-1 min-h-0 p-3 overflow-y-auto overflow-x-auto">
                {loading ? (
                  <div className="text-sm text-[var(--input-placeholder)]">模型编排并调用 MCP 中…</div>
                ) : outputView === 'tool' ? (
                  <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                    {toolRaw || '暂无工具原始返回。请先开始测试。'}
                  </pre>
                ) : answer ? (
                  <MarkdownBlock>{answer}</MarkdownBlock>
                ) : (
                  <div className="text-sm text-[var(--input-placeholder)]">
                    右侧将展示模型输出（Markdown）。点击左侧「开始测试」开始。
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

