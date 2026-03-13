import { useEffect, useState } from 'react';
import { getMcpSettings, saveMcpSettings, getApiKeys } from '../../api/settings';
import { testModel } from '../../api/modelTest';
import {
  getMcpBaseDir,
  listMcpTools,
  callMcpTool,
  getMcpStatus,
  startMcpServer,
  stopMcpServer,
  getMcpHttpCredentials,
  getMcpVendors,
} from '../../api/mcp';
import { MODEL_VENDORS, VENDOR_MODELS } from '../../data/modelVendors';
import { MarkdownBlock } from '../ui/ModelTestPanel/MarkdownBlock';

/**
 * MCP 面板：配置第三方 MCP 服务
 * - 列表中每一项代表一个 MCP 服务器（本地或第三方）
 * - 只负责本地配置保存，不直接发起 MCP 调用
 */

export function McpPanel({ className = '' }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [servers, setServers] = useState([]);
  const [baseDir, setBaseDir] = useState('');
  const [activeServerId, setActiveServerId] = useState('');
  const [toolsLoading, setToolsLoading] = useState(false);
  const [tools, setTools] = useState([]);
  const [selectedTool, setSelectedTool] = useState(null);
  const [toolArgsText, setToolArgsText] = useState('{}');
  const [toolResult, setToolResult] = useState('');
  const [toolCalling, setToolCalling] = useState(false);
  const [statusMap, setStatusMap] = useState({});
  const [startLoadingId, setStartLoadingId] = useState('');
  const [stopLoadingId, setStopLoadingId] = useState('');
  const [httpVendors, setHttpVendors] = useState([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addType, setAddType] = useState('local'); // 'local' | 'http'
  const [addVendorId, setAddVendorId] = useState('');
  const [apiKeys, setApiKeys] = useState({});
  const [toolVendorId, setToolVendorId] = useState('');
  const [toolModelId, setToolModelId] = useState('');
  const [toolQuestion, setToolQuestion] = useState('请根据下面工具返回的数据进行分析并给出结论。');
  const [toolAiAnswer, setToolAiAnswer] = useState('');
  const [toolAiLoading, setToolAiLoading] = useState(false);
  // 调用模式：'mcp' = 直接调用 MCP；'model' = 模型测试（自动调用 MCP + 模型）
  const [callPanelTab, setCallPanelTab] = useState('mcp'); // 'mcp' | 'model'
  // 从 schema 解析出来的表单参数，优先用于「MCP 调用」模式的输入
  const [toolFormValues, setToolFormValues] = useState(null);
  // 结果展示视图：'mcp' = 显示 MCP 返回；'model' = 显示模型回答
  const [resultView, setResultView] = useState('mcp'); // 'mcp' | 'model'
  const [editingServerId, setEditingServerId] = useState('');
  const [configCollapsed, setConfigCollapsed] = useState(false);

  const buildDefaultArgsFromSchema = (schema) => {
    if (!schema || typeof schema !== 'object') return {};
    const props = schema.properties || {};
    const required = Array.isArray(schema.required) ? schema.required : [];
    const result = {};
    Object.entries(props).forEach(([key, def]) => {
      if (!def || typeof def !== 'object') return;
      let value;
      if (Object.prototype.hasOwnProperty.call(def, 'default')) {
        value = def.default;
      } else if (Object.prototype.hasOwnProperty.call(def, 'example')) {
        value = def.example;
      } else if (required.includes(key)) {
        switch (def.type) {
          case 'string':
            value = '';
            break;
          case 'integer':
          case 'number':
            value = 0;
            break;
          case 'boolean':
            value = false;
            break;
          case 'array':
            value = [];
            break;
          case 'object':
            value = {};
            break;
          default:
            value = null;
        }
      } else {
        return;
      }
      result[key] = value;
    });
    return result;
  };

  // 从模型输出中尽量提取出第一个 JSON 对象（用于模型自动生成 MCP 调用参数）
  const extractFirstJsonObject = (text) => {
    if (!text || typeof text !== 'string') return null;
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    const candidate = text.slice(start, end + 1);
    try {
      const obj = JSON.parse(candidate);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        return obj;
      }
    } catch {
      // ignore
    }
    return null;
  };

  const summarizeSchemaForPrompt = (schema) => {
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
  };

  const buildCallableToolsCatalog = async () => {
    const enabledServers = (Array.isArray(servers) ? servers : []).filter((s) => s && s.enabled !== false && s.id);
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

  // 模型测试（模块化）：用户只写自然语言问题，系统保证在「已启用且可用」的 MCP 工具集合中挑选一个最合适的并调用。
  // 流程：
  // 1）汇总所有可用 MCP tools（已启用的 server 中 listTools 成功的）；
  // 2）让模型在工具清单里选择 serverId/toolName，并给出 arguments JSON；
  // 3）按模型选择调用 MCP；失败则带错误信息重试（可换工具/改参数）；
  // 4）成功后再让模型基于返回结果输出分析（含思考过程与工具调用情况）。
  const handleModelTest = async () => {
    if (!toolVendorId || !toolModelId) {
      setError('请先在上方选择支持 tools 的模型厂商与模型。');
      return;
    }
    setToolAiLoading(true);
    setCallPanelTab('model');
    setResultView('model');
    setError('');
    try {
      // 1) 构建可调用工具清单（已启用 server 中 tools/list 成功的集合）
      const catalog = await buildCallableToolsCatalog();
      if (catalog.length === 0) {
        setError('未发现可调用的 MCP 工具：请确认已启用 MCP，并且对应 MCP 已启动且能正常 tools/list。');
        return;
      }

      // 2) 让模型从清单中选择并生成调用参数（带重试）
      const question = toolQuestion || '请根据用户问题调用合适的 MCP 工具并给出结论。';
      const preferredHint =
        selectedTool && selectedTool.name
          ? `【偏好提示】如果清单里有 toolName=${selectedTool.name}，优先使用它。\n\n`
          : '';

      const catalogForPrompt = catalog
        .slice(0, 80)
        .map((x) => ({
          serverId: x.serverId,
          serverName: x.serverName,
          toolName: x.toolName,
          description: x.description,
          schema: x.schema,
        }));

      const baseSelectPrompt =
        '你是一个 MCP 调用编排器。你必须从给定的工具清单中选择一个最合适的 MCP 工具来回答用户问题，并输出一次可执行的调用计划。\n\n' +
        '【强约束】\n' +
        '- 只能选择清单中出现过的 serverId 和 toolName\n' +
        '- 只输出纯 JSON（不要解释、不要 markdown 代码块）\n' +
        '- 输出格式必须为：{"serverId":"...","toolName":"...","arguments":{...}}\n\n' +
        preferredHint +
        `【用户问题】\n${question}\n\n` +
        `【可用 MCP 工具清单（最多展示 80 项）】\n${JSON.stringify(catalogForPrompt, null, 2)}\n\n` +
        '现在请输出你的调用计划 JSON。';

      let chosen = null;
      let lastSelectErr = '';
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const prompt =
          attempt === 0
            ? baseSelectPrompt
            : baseSelectPrompt +
              `\n\n【上一次计划执行失败】\n${lastSelectErr}\n\n请修正 serverId/toolName/arguments，必要时更换工具，然后再次只输出计划 JSON。`;
        const resp = await testModel({
          vendorId: toolVendorId.trim(),
          modelId: toolModelId.trim(),
          message: prompt,
        });
        const text = (resp && resp.content) || '';
        const obj = extractFirstJsonObject(text) || (() => { try { return JSON.parse(text); } catch { return null; } })();
        if (!obj || typeof obj !== 'object') {
          lastSelectErr = '模型未返回合法 JSON 计划。';
          continue;
        }
        const serverId = String(obj.serverId || '').trim();
        const toolName = String(obj.toolName || '').trim();
        const args = obj.arguments && typeof obj.arguments === 'object' && !Array.isArray(obj.arguments) ? obj.arguments : {};
        const exists = catalog.find((c) => c.serverId === serverId && c.toolName === toolName);
        if (!exists) {
          lastSelectErr = `计划选择的工具不存在于清单中：serverId=${serverId} toolName=${toolName}`;
          continue;
        }
        chosen = { serverId, toolName, arguments: args };
        break;
      }

      if (!chosen) {
        setError('模型无法在当前可用工具清单中生成可执行的调用计划，请换一个更明确的问题或检查 MCP 工具是否齐全。');
        return;
      }

      // 3) 执行 MCP 调用（失败则尝试让模型改计划再重试）
      let mcpResult = null;
      let execErr = '';
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          mcpResult = await callMcpTool(chosen.serverId, chosen.toolName, chosen.arguments);
          execErr = '';
          break;
        } catch (e) {
          execErr = e?.message || '调用 MCP 工具失败';
          // 让模型改计划后重试（仅在前两次失败时）
          if (attempt < 2) {
            lastSelectErr = `调用失败：${execErr}\n当前计划：${JSON.stringify(chosen)}`;
            chosen = null;
            for (let inner = 0; inner < 1; inner += 1) {
              const resp = await testModel({
                vendorId: toolVendorId.trim(),
                modelId: toolModelId.trim(),
                message:
                  baseSelectPrompt +
                  `\n\n【执行失败信息】\n${lastSelectErr}\n\n请给出新的计划 JSON（可以换工具/改参数）。`,
              });
              const text = (resp && resp.content) || '';
              const obj = extractFirstJsonObject(text) || (() => { try { return JSON.parse(text); } catch { return null; } })();
              if (!obj || typeof obj !== 'object') continue;
              const serverId = String(obj.serverId || '').trim();
              const toolName = String(obj.toolName || '').trim();
              const args = obj.arguments && typeof obj.arguments === 'object' && !Array.isArray(obj.arguments) ? obj.arguments : {};
              const exists = catalog.find((c) => c.serverId === serverId && c.toolName === toolName);
              if (!exists) continue;
              chosen = { serverId, toolName, arguments: args };
            }
            if (!chosen) break;
          }
        }
      }

      if (execErr) {
        setError(execErr);
        return;
      }

      const mcpResultText = JSON.stringify(mcpResult ?? {}, null, 2);
      setToolResult(mcpResultText);
      setActiveServerId(chosen.serverId);
      setToolFormValues(chosen.arguments || {});

      // 4) 让模型基于 MCP 返回结果输出最终答案（含思考过程与工具调用情况）
      const message =
        `你是一个严谨的投研助手，需要基于 MCP 工具返回的数据来回答用户的问题。\n\n` +
        `【本次调用的 MCP 工具】\n` +
        `- serverId：${chosen.serverId}\n` +
        `- toolName：${chosen.toolName}\n` +
        `- arguments：${JSON.stringify(chosen.arguments || {})}\n\n` +
        `【MCP 工具原始返回（JSON）】\n` +
        `${mcpResultText}\n\n` +
        `【用户问题】\n` +
        `${question}\n\n` +
        '请严格按照下面结构输出：\n' +
        '1. 思考过程：详细说明你是如何理解用户问题、如何结合 MCP 数据进行分析的，可以分点阐述。\n' +
        '2. 工具调用情况：列出本次你参考了哪些 MCP 工具（包括 serverId 和 toolName），以及这些工具各自提供了什么关键信息。\n' +
        '3. 最终结论：基于以上分析，用中文给出清晰结论和可执行建议。\n' +
        '禁止重复粘贴完整 JSON，只能引用关键字段名称或关键数值进行解释。';
      const payload = {
        vendorId: toolVendorId.trim(),
        modelId: toolModelId.trim(),
        message,
      };
      const data = await testModel(payload);
      const content = (data && data.content) || '';
      setToolAiAnswer(content || '（模型未返回内容）');
    } catch (e) {
      setToolAiAnswer('');
      setError(e?.message || '模型测试失败');
    } finally {
      setToolAiLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const dir = await getMcpBaseDir().catch(() => '');
        if (dir && mounted) setBaseDir(dir);
        const [settings, , vendorConfig, keys] = await Promise.all([
          getMcpSettings(),
          getMcpHttpCredentials().catch(() => ({})), // 兼容保留，但不再用于 UI
          getMcpVendors().catch(() => ({ httpVendors: [] })),
          getApiKeys().catch(() => ({})),
        ]);
        if (!mounted) return;
        const list = Array.isArray(settings.servers) ? settings.servers : [];
        // 确保每个 server.id 唯一，尤其是 HTTP MCP，避免多个实例共用同一个 id
        const seenIds = new Set();
        const normalized = list.map((s, index) => {
          const rawId = s.id || `mcp-${Date.now()}-${index}`;
          let id = rawId;
          if (seenIds.has(id)) {
            id = `${rawId}-${index}`;
          }
          seenIds.add(id);
          return { ...s, id };
        });
        setServers(normalized);
        const hv = Array.isArray(vendorConfig.httpVendors) ? vendorConfig.httpVendors : [];
        setHttpVendors(hv);
        const safeKeys = keys && typeof keys === 'object' ? keys : {};
        setApiKeys(safeKeys);
        if (!addVendorId && hv[0]?.id) {
          setAddVendorId(hv[0].id);
        }
        if (list.length > 0) {
          const firstId = list[0].id || '';
          setActiveServerId(firstId);
          setEditingServerId(firstId);
        }
        if (!toolVendorId) {
          const toolVendors = MODEL_VENDORS.filter((v) => {
            if (!safeKeys[v.id]) return false;
            const models = VENDOR_MODELS[v.id] || [];
            return models.some((m) => Array.isArray(m.tags) && m.tags.includes('tools'));
          });
          if (toolVendors.length > 0) {
            const v0 = toolVendors[0];
            const models = (VENDOR_MODELS[v0.id] || []).filter(
              (m) => Array.isArray(m.tags) && m.tags.includes('tools')
            );
            setToolVendorId(v0.id);
            setToolModelId(models[0]?.id || '');
          }
        }
      } catch (e) {
        if (!mounted) return;
        setError(e?.message || '加载 MCP 设置失败');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleChange = (index, key, value) => {
    setServers((prev) => {
      const next = [...prev];
      const item = { ...(next[index] || {}) };
      if (key === 'type') {
        const v = value === 'http' || value === 'streamableHttp' ? 'http' : 'local';
        item.type = v;
        // 类型切换时，保留通用字段，清理无关字段
        if (v === 'http') {
          delete item.command;
          delete item.args;
          delete item.dir;
          delete item.port;
        } else {
          delete item.url;
        }
      } else {
        item[key] = value;
      }
      // 保证有 id 作为稳定标识
      if (!item.id) {
        item.id = `mcp-${Date.now()}-${index}`;
      }
      next[index] = item;
      return next;
    });
  };

  const handleAdd = () => {
    setAddType('local');
    if (httpVendors.length > 0) {
      setAddVendorId(httpVendors[0].id);
    } else {
      setAddVendorId('');
    }
    setShowAddDialog(true);
  };

  const handleRemove = (index) => {
    setServers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const cleaned = servers
        .map((s) => ({
          id: s.id || `mcp-${Date.now()}`,
          name: String(s.name || '').trim(),
          type: s.type === 'http' || s.type === 'streamableHttp' ? 'streamableHttp' : 'stdio',
          url: String(s.url || '').trim(),
          command: String(s.command || '').trim(),
          args: String(s.args || '').trim(),
          dir: String(s.dir || '').trim(),
          port: s.port ? Number(s.port) || 0 : 0,
          enabled: s.enabled !== false,
          notes: String(s.notes || '').trim(),
        }))
        // 允许先只填 name 或 command，不做太严校验
        .filter((s) => s.name || s.command);

      await saveMcpSettings({ servers: cleaned });
    } catch (e) {
      setError(e?.message || '保存 MCP 设置失败');
    } finally {
      setSaving(false);
    }
  };

  // 监听全局 Ctrl+S 保存事件（仅在 MCP 面板激活时触发）
  useEffect(() => {
    const onSave = (e) => {
      const sidebar = e?.detail?.sidebar;
      if (sidebar !== 'mcp') return;
      handleSave();
    };
    window.addEventListener('openaui:save', onSave);
    return () => {
      window.removeEventListener('openaui:save', onSave);
    };
  }, [servers]);

  const loadToolsForServer = async (id) => {
    setActiveServerId(id);
    setSelectedTool(null);
    setToolArgsText('{}');
    setToolResult('');
    if (!id) {
      setTools([]);
      return;
    }
    setToolsLoading(true);
    try {
      const list = await listMcpTools(id);
      setTools(list);
    } catch (e) {
      setError(e?.message || '获取 MCP 工具列表失败');
      setTools([]);
    } finally {
      setToolsLoading(false);
    }
  };

  const refreshStatus = async (id) => {
    const sid = id || activeServerId;
    if (!sid) return;
    try {
      const status = await getMcpStatus(sid);
      setStatusMap((prev) => ({ ...prev, [sid]: status }));
    } catch {
      // 忽略状态错误
    }
  };

  const handleSelectTool = (tool) => {
    setSelectedTool(tool);
    const schema = tool?.inputSchema;
    const initialArgs = buildDefaultArgsFromSchema(schema);
    const text = Object.keys(initialArgs).length > 0 ? JSON.stringify(initialArgs, null, 2) : '{}';
    setToolArgsText(text);
    setToolFormValues(initialArgs);
    setToolResult('');
    setToolAiAnswer('');
    setResultView('mcp');
    setCallPanelTab('mcp');
  };

  const handleCallTool = async () => {
    if (!activeServerId || !selectedTool) return;
    let args = {};
    // 优先使用从表单收集的参数，其次回退到 JSON 文本
    if (toolFormValues && typeof toolFormValues === 'object') {
      args = toolFormValues;
    } else if (toolArgsText && toolArgsText.trim()) {
      try {
        args = JSON.parse(toolArgsText);
      } catch {
        setError('参数必须是合法的 JSON 对象');
        return;
      }
    }
    setToolCalling(true);
    setError('');
    try {
      const result = await callMcpTool(activeServerId, selectedTool.name, args);
      setToolResult(JSON.stringify(result, null, 2));
      setResultView('mcp');
      setToolAiAnswer('');
    } catch (e) {
      setToolResult('');
      setError(e?.message || '调用 MCP 工具失败');
    } finally {
      setToolCalling(false);
    }
  };

  const handleCopyStartCommand = async (s) => {
    if (!s || !s.command) return;
    const dirPart = (baseDir && (s.dir || '').trim())
      ? `${baseDir}\\${(s.dir || '').trim()}`
      : '';
    let argsText = s.args || '';
    const port = s.port ? String(s.port) : '';
    if (port && !argsText.includes('--port')) {
      argsText = `${argsText ? `${argsText} ` : ''}--port ${port}`;
    }
    const cmdCore = `${s.command}${argsText ? ` ${argsText}` : ''}`;
    const cmd = dirPart ? `cd "${dirPart}" && ${cmdCore}` : cmdCore;
    try {
      await navigator.clipboard.writeText(cmd);
      setError('');
    } catch {
      setError('复制启动命令到剪贴板失败，请手动复制。');
    }
  };

  const handleStart = async (id) => {
    if (!id) return;
    setStartLoadingId(id);
    setError('');
    try {
      const status = await startMcpServer(id);
      setStatusMap((prev) => ({ ...prev, [id]: status }));
      // 启动后自动刷新工具列表
      if (activeServerId === id) {
        await handleSelectServer(id);
      }
    } catch (e) {
      setError(e?.message || '启动 MCP 服务失败');
    } finally {
      setStartLoadingId('');
    }
  };

  const handleStop = async (id) => {
    if (!id) return;
    setStopLoadingId(id);
    setError('');
    try {
      await stopMcpServer(id);
      setStatusMap((prev) => ({ ...prev, [id]: { running: false, pid: null } }));
    } catch (e) {
      setError(e?.message || '关闭 MCP 服务失败');
    } finally {
      setStopLoadingId('');
    }
  };

  return (
    <div className={`flex-1 w-full flex flex-row min-h-0 overflow-hidden bg-white ${className}`}>
      {/* 左侧：说明文案 */}
      <aside className="w-64 flex-shrink-0 flex flex-col border-r border-[var(--input-bar-border)] bg-[#fafafa]">
        <div className="flex-shrink-0 px-4 py-3 border-b border-[var(--input-bar-border)] bg-white">
          <h2 className="text-base font-medium text-[var(--skill-btn-text)]">MCP</h2>
          <p className="text-xs text-[var(--input-placeholder)] mt-0.5">
            配置本地或第三方 MCP 服务，信息只保存在本机。
          </p>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 text-xs text-[var(--input-placeholder)] space-y-2">
          <p>MCP（Model Context Protocol）是一套统一的协议，用于让模型安全地调用外部工具和数据源。</p>
          <p>每一个 MCP 服务一般是一个独立进程（例如 node/python 应用），通过标准输入输出与本后端通信。</p>
          <p>本面板只负责把这些 MCP 服务的信息（名称、启动命令等）配置好，方便后续在对话或技能里统一调用。</p>
          {baseDir && (
            <div className="mt-2 rounded-md border border-dashed border-[var(--input-bar-border)] bg-white/60 p-2">
              <div className="text-[10px] text-[var(--input-placeholder)] mb-0.5">
                推荐将 MCP 项目放在此目录下：
              </div>
              <div className="text-[10px] font-mono break-all text-[var(--skill-btn-text)]">
                {baseDir}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* 右侧：配置 + 工具测试 */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-white">
        <div className="flex-shrink-0 px-4 py-3 border-b border-[var(--input-bar-border)] bg-white flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[var(--skill-btn-text)]">MCP 服务列表</h3>
            <p className="text-xs text-[var(--input-placeholder)] mt-0.5">
              例如：本地工具集、知识库服务、第三方 SaaS 提供的 MCP Server 等。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAdd}
              className="px-3 py-1.5 text-xs rounded-lg bg-[var(--skill-btn-bg)] text-[var(--skill-btn-text)] hover:bg-[var(--skill-btn-hover)] transition-colors"
            >
              新增 MCP
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className={`px-3 py-1.5 text-xs rounded-lg text-white transition-colors ${
                saving ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'
              }`}
            >
              {saving ? '保存中...' : '保存配置'}
            </button>
          </div>
        </div>

        {error && (
          <div className="px-4 pt-2 text-xs text-red-500">
            {error}
          </div>
        )}

        <div className="flex-1 flex min-h-0">
          {/* 左侧：配置列表（可折叠） */}
          {!configCollapsed && (
          <div className="w-5/12 border-r border-[var(--input-bar-border)] overflow-y-auto px-4 py-3 space-y-3">
            {loading ? (
              <div className="text-sm text-[var(--input-placeholder)]">加载中...</div>
            ) : servers.length === 0 ? (
              <div className="text-sm text-[var(--input-placeholder)]">
                暂无 MCP 配置，点击右上角「新增 MCP」开始配置。
              </div>
            ) : (
              servers.map((s, index) => {
                const id = s.id || index.toString();
                const isEditing = (s.id || '') === editingServerId;
                const isActiveForTools = (s.id || '') === activeServerId;
                const isHttp = s.type === 'http' || s.type === 'streamableHttp';
                const status = statusMap[s.id || ''] || { running: false, pid: null };
                if (!isEditing) {
                  // 折叠态：只显示名称、备注摘要和基础控制按钮
                  return (
                    <div
                      key={id}
                      className="border border-[var(--input-bar-border)] rounded-lg p-3 flex flex-col gap-1 bg-[#fafafa] hover:border-blue-300 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="w-4 h-4"
                          checked={s.enabled !== false}
                          onChange={(e) => handleChange(index, 'enabled', e.target.checked)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] border border-[var(--input-bar-border)] bg-white text-[var(--input-placeholder)]">
                              {s.type === 'http' || s.type === 'streamableHttp' ? '第三方 MCP' : '本地 MCP'}
                            </span>
                            <span className="text-sm font-medium text-[var(--skill-btn-text)] truncate">
                              {s.name || '未命名 MCP'}
                            </span>
                          </div>
                          {s.notes && (
                            <div className="text-[10px] text-[var(--input-placeholder)] truncate">
                              {s.notes}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemove(index)}
                          className="text-xs text-red-500 hover:text-red-600 px-2 py-1 rounded-md hover:bg-red-50"
                        >
                          删除
                        </button>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        {isHttp ? (
                          <div className="text-[10px] text-[var(--input-placeholder)]">
                            第三方 MCP（云端），通过 HTTP 调用。
                          </div>
                        ) : (
                          <>
                            <div className="text-[10px] text-[var(--input-placeholder)]">
                              {status.running
                                ? `运行中${status.pid ? ` (PID: ${status.pid})` : ''}`
                                : '未运行'}
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleStart(s.id || '')}
                                disabled={startLoadingId === (s.id || '')}
                                className={`px-2 py-1 text-xs rounded-md text-white ${
                                  startLoadingId === (s.id || '')
                                    ? 'bg-green-300 cursor-not-allowed'
                                    : 'bg-green-600 hover:bg-green-700'
                                }`}
                              >
                                {startLoadingId === (s.id || '') ? '启动中...' : '启动'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStop(s.id || '')}
                                disabled={stopLoadingId === (s.id || '')}
                                className={`px-2 py-1 text-xs rounded-md text-white ${
                                  stopLoadingId === (s.id || '')
                                    ? 'bg-red-300 cursor-not-allowed'
                                    : 'bg-red-600 hover:bg-red-700'
                                }`}
                              >
                                {stopLoadingId === (s.id || '') ? '关闭中...' : '关闭'}
                              </button>
                            </div>
                          </>
                        )}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingServerId(s.id || '')}
                            className="px-2 py-1 text-xs rounded-md bg-white text-[var(--skill-btn-text)] border border-[var(--input-bar-border)] hover:bg-[var(--skill-btn-bg)]"
                          >
                            展开配置
                          </button>
                          <button
                            type="button"
                            onClick={() => loadToolsForServer(s.id || '')}
                            className={`px-2 py-1 text-xs rounded-md border text-[var(--skill-btn-text)] ${
                              isActiveForTools
                                ? 'bg-blue-500 text-white border-blue-500'
                                : 'bg-white border-[var(--input-bar-border)] hover:bg-[var(--skill-btn-bg)]'
                            }`}
                          >
                            {isActiveForTools ? '右侧正在使用' : '设为右侧'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                // 展开态：显示完整配置表单
                return (
                  <div
                    key={id}
                    className="border border-[var(--input-bar-border)] rounded-lg p-3 flex flex-col gap-2 bg-[#fafafa] ring-1 ring-blue-400"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="checkbox"
                        className="w-4 h-4"
                        checked={s.enabled !== false}
                        onChange={(e) => handleChange(index, 'enabled', e.target.checked)}
                      />
                      <input
                        type="text"
                        className="flex-1 text-sm px-2 py-1 rounded-md border border-[var(--input-bar-border)] focus:outline-none focus:ring-1 focus:ring-blue-400"
                        placeholder="MCP 名称（如：本地工具集、阿里云百炼 MCP 等）"
                        value={s.name || ''}
                        onChange={(e) => handleChange(index, 'name', e.target.value)}
                      />
                      <select
                        value={s.type === 'http' || s.type === 'streamableHttp' ? 'http' : 'local'}
                        onChange={(e) => handleChange(index, 'type', e.target.value)}
                        className="px-2 py-1 text-[11px] rounded-md border border-[var(--input-bar-border)] bg-white text-[var(--skill-btn-text)]"
                      >
                        <option value="local">本地 MCP</option>
                        <option value="http">第三方 MCP（HTTP）</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => handleRemove(index)}
                        className="text-xs text-red-500 hover:text-red-600 px-2 py-1 rounded-md hover:bg-red-50"
                      >
                        删除
                      </button>
                    </div>
                    {!(s.type === 'http' || s.type === 'streamableHttp') && (
                      <>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-[var(--input-placeholder)]">
                            启动命令（必填）：例如 <code className="font-mono text-[10px] bg-white px-1 rounded">node</code>
                          </label>
                          <input
                            type="text"
                            className="w-full text-sm px-2 py-1 rounded-md border border-[var(--input-bar-border)] focus:outline-none focus:ring-1 focus:ring-blue-400"
                            placeholder="在本机执行的命令（例如 node 或 python）"
                            value={s.command || ''}
                            onChange={(e) => handleChange(index, 'command', e.target.value)}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-[var(--input-placeholder)]">
                            命令参数（可选）：例如 <code className="font-mono text-[10px] bg-white px-1 rounded">./dist/index.js</code> 或其它启动脚本
                          </label>
                          <input
                            type="text"
                            className="w-full text-sm px-2 py-1 rounded-md border border-[var(--input-bar-border)] focus:outline-none focus:ring-1 focus:ring-blue-400"
                            placeholder="可选参数，如 ./dist/index.js --config ./mcp.json"
                            value={s.args || ''}
                            onChange={(e) => handleChange(index, 'args', e.target.value)}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-[var(--input-placeholder)]">
                            端口（可选）：部分 MCP Server 支持通过 --port 指定监听端口
                          </label>
                          <input
                            type="number"
                            min={0}
                            className="w-full text-sm px-2 py-1 rounded-md border border-[var(--input-bar-border)] focus:outline-none focus:ring-1 focus:ring-blue-400"
                            placeholder="例如：3334"
                            value={s.port || ''}
                            onChange={(e) => handleChange(index, 'port', e.target.value)}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-[var(--input-placeholder)]">
                            项目目录名（可选）：将在 <code className="font-mono text-[10px] bg-white px-1 rounded">mcp-services/</code> 下创建/使用
                          </label>
                          <input
                            type="text"
                            className="w-full text-sm px-2 py-1 rounded-md border border-[var(--input-bar-border)] focus:outline-none focus:ring-1 focus:ring-blue-400"
                            placeholder="例如：browser-mcp、my-search-mcp"
                            value={s.dir || ''}
                            onChange={(e) => handleChange(index, 'dir', e.target.value)}
                          />
                          {baseDir && (s.dir || '').trim() && (
                            <div className="text-[10px] text-[var(--input-placeholder)] break-all">
                              实际工作目录：<span className="font-mono">{`${baseDir}\\${(s.dir || '').trim()}`}</span>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {(s.type === 'http' || s.type === 'streamableHttp') && (
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-[var(--input-placeholder)]">
                          第三方 MCP URL（必填）
                        </label>
                        <input
                          type="text"
                          className="w-full text-sm px-2 py-1 rounded-md border border-[var(--input-bar-border)] focus:outline-none focus:ring-1 focus:ring-blue-400"
                          placeholder="例如：https://dashscope.aliyuncs.com/api/v1/mcps/.../mcp"
                          value={s.url || ''}
                          onChange={(e) => handleChange(index, 'url', e.target.value)}
                        />
                      </div>
                    )}
                    {/* 上面已按类型拆分本地 / HTTP，下面统一备注与控制按钮 */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-[var(--input-placeholder)]">
                        备注（可选）：描述这个 MCP 能力，如「读写本地文件」「访问公司内部 API」
                      </label>
                      <textarea
                        className="w-full text-sm px-2 py-1 rounded-md border border-[var(--input-bar-border)] focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                        rows={2}
                        placeholder="该 MCP 的用途说明"
                        value={s.notes || ''}
                        onChange={(e) => handleChange(index, 'notes', e.target.value)}
                      />
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      {isHttp ? (
                        <>
                          <div className="text-[10px] text-[var(--input-placeholder)]">
                            第三方 MCP（云端），通过 HTTP 调用。
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingServerId('')}
                              className="px-2 py-1 text-xs rounded-md bg-white text-[var(--skill-btn-text)] border border-[var(--input-bar-border)] hover:bg-[var(--skill-btn-bg)]"
                            >
                              收起
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-[10px] text-[var(--input-placeholder)]">
                            {status.running
                              ? `运行中${status.pid ? ` (PID: ${status.pid})` : ''}`
                              : '未运行'}
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleCopyStartCommand(s)}
                              className="px-2 py-1 text-xs rounded-md bg-white text-[var(--skill-btn-text)] border border-[var(--input-bar-border)] hover:bg-[var(--skill-btn-bg)]"
                            >
                              复制启动命令
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStart(s.id || '')}
                              disabled={startLoadingId === (s.id || '')}
                              className={`px-2 py-1 text-xs rounded-md text-white ${
                                startLoadingId === (s.id || '')
                                  ? 'bg-green-300 cursor-not-allowed'
                                  : 'bg-green-600 hover:bg-green-700'
                              }`}
                            >
                              {startLoadingId === (s.id || '') ? '启动中...' : '一键启动'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStop(s.id || '')}
                              disabled={stopLoadingId === (s.id || '')}
                              className={`px-2 py-1 text-xs rounded-md text-white ${
                                stopLoadingId === (s.id || '')
                                  ? 'bg-red-300 cursor-not-allowed'
                                  : 'bg-red-600 hover:bg-red-700'
                              }`}
                            >
                              {stopLoadingId === (s.id || '') ? '关闭中...' : '一键关闭'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingServerId('')}
                              className="px-2 py-1 text-xs rounded-md bg-white text-[var(--skill-btn-text)] border border-[var(--input-bar-border)] hover:bg-[var(--skill-btn-bg)]"
                            >
                              收起
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          )}

          {/* 右侧：工具列表 + 调用测试 */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0 px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-[var(--skill-btn-text)]">工具列表 / 调用测试</div>
                <div className="text-xs text-[var(--input-placeholder)] mt-0.5">
                  先在左侧选择一个 MCP，然后在这里查看 tools/list 并测试 tools/call。
                </div>
              </div>
              <div className="flex items-center gap-2">
                {activeServerId && (
                  <button
                    type="button"
                    onClick={() => loadToolsForServer(activeServerId)}
                    disabled={toolsLoading}
                    className={`px-3 py-1.5 text-xs rounded-lg border border-[var(--input-bar-border)] text-[var(--skill-btn-text)] hover:bg-[var(--skill-btn-bg)] ${
                      toolsLoading ? 'opacity-60 cursor-not-allowed' : ''
                    }`}
                  >
                    {toolsLoading ? '刷新中...' : '刷新工具列表'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setConfigCollapsed((v) => !v)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-[var(--input-bar-border)] text-[var(--skill-btn-text)] hover:bg-[var(--skill-btn-bg)]"
                >
                  {configCollapsed ? '展开左侧配置' : '收起左侧配置'}
                </button>
              </div>
            </div>

            {!activeServerId ? (
              <div className="text-sm text-[var(--input-placeholder)]">
                请先在左侧选择一个 MCP 配置。
              </div>
            ) : (
              <div className="flex-1 flex min-h-0 gap-3">
                {/* 工具列表（4） */}
                <div className="basis-2/5 max-w-[45%] border border-[var(--input-bar-border)] rounded-lg overflow-hidden flex flex-col">
                  <div className="px-3 py-2 border-b border-[var(--input-bar-border)] bg-[#fafafa] text-xs text-[var(--input-placeholder)]">
                    tools/list
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {toolsLoading ? (
                      <div className="p-3 text-xs text-[var(--input-placeholder)]">加载 MCP 工具中...</div>
                    ) : tools.length === 0 ? (
                      <div className="p-3 text-xs text-[var(--input-placeholder)]">当前 MCP 未返回任何工具。</div>
                    ) : (
                      tools.map((t) => (
                        <button
                          key={t.name}
                          type="button"
                          onClick={() => handleSelectTool(t)}
                          className={`w-full text-left px-3 py-2 text-xs border-b border-[var(--input-bar-border)] last:border-b-0 hover:bg-[var(--skill-btn-bg)] ${
                            selectedTool && selectedTool.name === t.name ? 'bg-blue-50' : 'bg-white'
                          }`}
                        >
                          <div className="font-medium text-[var(--skill-btn-text)] truncate">{t.name}</div>
                          {t.description && (
                            <div className="text-[10px] text-[var(--input-placeholder)] truncate mt-0.5">
                              {t.description}
                            </div>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* 调用区（6） */}
                <div className="flex-1 flex flex-col min-w-0 min-h-0 border border-[var(--input-bar-border)] rounded-lg">
                  <div className="px-3 py-2 border-b border-[var(--input-bar-border)] bg-[#fafafa] flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-xs text-[var(--input-placeholder)]">
                        <span>
                          tools/call
                          {selectedTool ? ` – ${selectedTool.name}` : ''}
                        </span>
                      </div>
                      {selectedTool && (
                        <div className="flex items-center gap-1 text-[11px]">
                          <span className="text-[var(--input-placeholder)]">调用模式：</span>
                          <button
                            type="button"
                            onClick={() => setCallPanelTab('mcp')}
                            className={`px-2 py-0.5 rounded ${
                              callPanelTab === 'mcp'
                                ? 'bg-blue-500 text-white'
                                : 'bg-white text-[var(--skill-btn-text)] border border-[var(--input-bar-border)]'
                            }`}
                          >
                            MCP 调用
                          </button>
                          <button
                            type="button"
                            onClick={() => setCallPanelTab('model')}
                            className={`px-2 py-0.5 rounded ${
                              callPanelTab === 'model'
                                ? 'bg-blue-500 text-white'
                                : 'bg-white text-[var(--skill-btn-text)] border border-[var(--input-bar-border)]'
                            }`}
                          >
                            模型测试
                          </button>
                        </div>
                      )}
                    </div>
                    {selectedTool && callPanelTab === 'mcp' && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCallTool}
                          disabled={toolCalling}
                          className={`px-3 py-1 text-xs rounded-md text-white ${
                            toolCalling ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'
                          }`}
                        >
                          {toolCalling ? '调用中...' : '执行 MCP 工具'}
                        </button>
                      </div>
                    )}
                    {selectedTool && callPanelTab === 'model' && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleModelTest}
                          disabled={toolAiLoading}
                          className={`px-3 py-1 text-xs rounded-md text-white ${
                            toolAiLoading ? 'bg-green-300 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
                          }`}
                        >
                          {toolAiLoading ? '模型测试中...' : '开始模型测试'}
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 flex min-h-0">
                    {selectedTool ? (
                      <div className="flex-1 flex flex-col min-h-0">
                        <div className="flex-shrink-0 px-3 py-2 border-b border-[var(--input-bar-border)] bg-white flex items-center gap-2">
                          <div className="text-[10px] text-[var(--input-placeholder)]">
                            选择用于「模型测试」的模型（仅展示已配置 API Key 且带 tools 标签的模型）
                          </div>
                          {(() => {
                            const toolVendors = MODEL_VENDORS.filter((v) => {
                              if (!apiKeys[v.id]) return false;
                              const models = VENDOR_MODELS[v.id] || [];
                              return models.some((m) => Array.isArray(m.tags) && m.tags.includes('tools'));
                            });
                            const hasOptions = toolVendors.length > 0;
                            const currentVendorId = toolVendorId || toolVendors[0]?.id || '';
                            const models =
                              (VENDOR_MODELS[currentVendorId] || []).filter(
                                (m) => Array.isArray(m.tags) && m.tags.includes('tools')
                              ) || [];
                            const currentModelId = toolModelId || models[0]?.id || '';
                            if (!hasOptions) {
                              return (
                                <div className="text-[10px] text-[var(--input-placeholder)]">
                                  暂无可用模型，请先在「设置 - API Key 设置」中为支持 tools 的模型厂商配置 API Key。
                                </div>
                              );
                            }
                            return (
                              <>
                                <select
                                  value={currentVendorId}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setToolVendorId(v);
                                    const ms =
                                      (VENDOR_MODELS[v] || []).filter(
                                        (m) => Array.isArray(m.tags) && m.tags.includes('tools')
                                      ) || [];
                                    setToolModelId(ms[0]?.id || '');
                                  }}
                                  className="px-2 py-1 text-[11px] rounded-md border border-[var(--input-bar-border)] bg-white text-[var(--skill-btn-text)]"
                                >
                                  {toolVendors.map((v) => (
                                    <option key={v.id} value={v.id}>
                                      {v.name}
                                    </option>
                                  ))}
                                </select>
                                <select
                                  value={currentModelId}
                                  onChange={(e) => setToolModelId(e.target.value)}
                                  className="px-2 py-1 text-[11px] rounded-md border border-[var(--input-bar-border)] bg-white text-[var(--skill-btn-text)]"
                                >
                                  {models.map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {m.name}
                                    </option>
                                  ))}
                                </select>
                              </>
                            );
                          })()}
                        </div>
                        <div className="flex-1 min-h-0 flex flex-col">
                          {/* 顶部：根据模式展示「参数表单」或「模型问题」 */}
                          {callPanelTab === 'mcp' ? (
                            <div className="flex-shrink-0 border-b border-[var(--input-bar-border)]">
                              <div className="px-3 py-2 text-xs text-[var(--input-placeholder)]">
                                MCP 调用：手动填写工具参数，点击上方「执行 MCP 工具」查看返回结果。
                              </div>
                              <div className="px-3 pb-2 space-y-2 max-h-40 overflow-auto">
                                <div className="text-xs text-[var(--input-placeholder)] mb-1">
                                  工具参数
                                </div>
                                {toolFormValues && Object.keys(toolFormValues).length > 0 ? (
                                  Object.entries(toolFormValues).map(([key, value]) => (
                                    <div key={key} className="flex items-center gap-2">
                                      <div className="w-32 text-xs text-[var(--input-placeholder)] truncate">
                                        {key}
                                      </div>
                                      <input
                                        type="text"
                                        className="flex-1 min-w-0 text-xs px-2 py-1 rounded-md border border-[var(--input-bar-border)] focus:outline-none focus:ring-1 focus:ring-blue-400"
                                        value={value ?? ''}
                                        onChange={(e) => {
                                          const v = e.target.value;
                                          setToolFormValues((prev) => {
                                            const next = { ...(prev || {}) };
                                            next[key] = v;
                                            return next;
                                          });
                                        }}
                                      />
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-xs text-[var(--input-placeholder)]">
                                    当前工具未声明可解析的参数 schema，如需传参请在工具自身文档中查看。
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="flex-shrink-0 border-b border-[var(--input-bar-border)]">
                              <div className="px-3 py-2 text-xs text-[var(--input-placeholder)]">
                                模型测试：只需输入自然语言问题，点击「开始模型测试」，前端会自动调用 MCP 工具并让模型根据返回结果回答。
                              </div>
                              <div className="h-32 flex flex-col">
                                <div className="px-3 py-2 text-xs text-[var(--input-placeholder)] bg-[#fafafa]">
                                  给模型的问题 / 对话内容
                                </div>
                                <textarea
                                  className="flex-1 w-full text-xs px-3 py-2 outline-none resize-none"
                                  value={toolQuestion}
                                  onChange={(e) => setToolQuestion(e.target.value)}
                                  spellCheck={false}
                                />
                              </div>
                            </div>
                          )}

                          {/* 底部：结果展示区 */}
                          <div className="flex-1 flex flex-col min-h-0">
                            {callPanelTab === 'mcp' ? (
                              <>
                                <div className="px-3 py-2 text-xs text-[var(--input-placeholder)] border-b border-[var(--input-bar-border)] flex items-center justify-between">
                                  <span>MCP 调用结果（最近一次）</span>
                                  {/* 在 MCP 调用模式下暂不展示模型结果切换，仅专注看工具返回 */}
                                </div>
                                <div className="flex-1 w-full text-xs px-3 py-2 overflow-y-auto overflow-x-auto whitespace-pre-wrap break-all min-h-0">
                                  {toolResult || '尚未调用 MCP 工具。'}
                                </div>
                              </>
                            ) : (
                              <>
                              <div className="px-3 py-2 text-xs text-[var(--input-placeholder)] border-b border-[var(--input-bar-border)]">
                                模型回答（模型已规划参数并调用 MCP 工具后生成）
                              </div>
                              <div className="flex-1 w-full text-xs px-3 py-2 overflow-y-auto overflow-x-auto min-h-0">
                                {toolAiLoading ? (
                                  '模型测试中……'
                                ) : toolAiAnswer ? (
                                  <MarkdownBlock>{toolAiAnswer}</MarkdownBlock>
                                ) : (
                                  '尚未进行模型测试，请先点击上方「开始模型测试」。'
                                )}
                              </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center text-xs text-[var(--input-placeholder)]">
                        请先在左侧工具列表中选择一个工具。
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 新增 MCP 类型选择弹窗 */}
      {showAddDialog && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--skill-btn-text)]">新增 MCP</h2>
              <button
                type="button"
                className="text-xs text-[var(--input-placeholder)] hover:text-[var(--skill-btn-text)]"
                onClick={() => setShowAddDialog(false)}
              >
                关闭
              </button>
            </div>
            <div className="space-y-2">
              <div className="text-xs text-[var(--input-placeholder)]">请选择 MCP 类型：</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAddType('local')}
                  className={`
                    border rounded-lg p-2 text-left text-xs
                    ${addType === 'local' ? 'border-blue-500 bg-blue-50' : 'border-[var(--input-bar-border)] bg-white'}
                  `}
                >
                  <div className="font-semibold text-[var(--skill-btn-text)] mb-1">本地 MCP</div>
                  <div className="text-[10px] text-[var(--input-placeholder)]">
                    运行在当前电脑上的 MCP 服务，通过命令行启动，可访问本地资源。
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setAddType('http')}
                  className={`
                    border rounded-lg p-2 text-left text-xs
                    ${addType === 'http' ? 'border-blue-500 bg-blue-50' : 'border-[var(--input-bar-border)] bg-white'}
                  `}
                >
                  <div className="font-semibold text-[var(--skill-btn-text)] mb-1">第三方 MCP（云端）</div>
                  <div className="text-[10px] text-[var(--input-placeholder)]">
                    部署在云端的 MCP 服务（如阿里云百炼），通过 HTTP 调用。
                  </div>
                </button>
              </div>
            </div>

            {addType === 'http' && httpVendors.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs text-[var(--input-placeholder)]">选择第三方厂商：</div>
                <select
                  value={addVendorId || httpVendors[0]?.id || ''}
                  onChange={(e) => setAddVendorId(e.target.value)}
                  className="w-full px-2 py-1 text-xs rounded-md border border-[var(--input-bar-border)] bg-white text-[var(--skill-btn-text)]"
                >
                  {httpVendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
                <div className="text-[10px] text-[var(--input-placeholder)]">
                  当前支持的 MCP 厂商来自本地配置文件，可在后端 data/mcp-vendors.json 中扩展。
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddDialog(false)}
                className="px-3 py-1.5 text-xs rounded-lg border border-[var(--input-bar-border)] text-[var(--skill-btn-text)] bg-white hover:bg-[var(--skill-btn-bg)]"
              >
                取消
              </button>
              <button
                type="button"
                className="px-3 py-1.5 text-xs rounded-lg text-white bg-blue-500 hover:bg-blue-600"
                onClick={() => {
                  setServers((prev) => {
                    const next = [...prev];
                    if (addType === 'local') {
                      next.push({
                        id: `local-mcp-${Date.now()}-${next.length}`,
                        name: '',
                        type: 'local',
                        command: '',
                        args: '',
                        dir: '',
                        port: 0,
                        enabled: true,
                        notes: '',
                      });
                    } else if (httpVendors.length > 0) {
                      const preset =
                        httpVendors.find((v) => v.id === addVendorId) || httpVendors[0];
                      // 为每个 HTTP MCP 实例生成唯一 id，避免多个同厂商实例共用同一个 id
                      const uniqueId = `http-mcp-${preset.id}-${Date.now()}-${next.length}`;
                      next.push({
                        id: uniqueId,
                        vendorId: preset.id,
                        name: preset.label,
                        type: 'http',
                        url: preset.url,
                        enabled: true,
                        notes: preset.desc,
                      });
                    }
                    return next;
                  });
                  setShowAddDialog(false);
                }}
              >
                确认创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

