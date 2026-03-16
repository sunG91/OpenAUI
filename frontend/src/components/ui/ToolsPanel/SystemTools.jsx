/**
 * 系统操作工具（结构化）：
 * - 文件：列目录 / 读写文本
 * - 进程：查看 / 结束进程
 * - AI 测试：自然语言指令，AI 自动选择并调用工具
 *
 * 与「控制台工具」的区别：
 * - 控制台：任意命令，灵活但危险
 * - 系统操作：固定 API，更可控，便于让模型安全调用
 */
import { useState } from 'react';
import {
  systemFsList,
  systemFsReadText,
  systemFsWriteText,
  systemProcessList,
  systemProcessKill,
  getToolsProjectRoot,
} from '../../../api/tools';
import { testModel } from '../../../api/modelTest';
import { getSkillSettings } from '../../../api/settings';
import { MODEL_VENDORS, VENDOR_MODELS } from '../../../data/modelVendors';

function getFirstModelId(vid) {
  const list = VENDOR_MODELS[vid] || [];
  return list[0]?.id ?? '';
}

const TABS = [
  { id: 'fs', label: '文件 / 目录' },
  { id: 'process', label: '进程管理' },
  { id: 'ai', label: 'AI 测试' },
];

const TOOL_SCHEMA = `
可选工具（输出 JSON，仅一个工具调用）：
1. fs_list - 列出目录内容。参数: path (目录绝对路径或相对项目根的路径)
2. fs_read_text - 读取文本文件。参数: path (文件路径)
3. fs_write_text - 写入文本文件。参数: path, content
4. process_list - 获取进程列表。无参数
5. process_kill - 结束进程。参数: pid (数字，慎用)

输出格式（仅输出此 JSON，不要 markdown、不要解释）：
{"tool":"工具名","path":"路径","content":"内容(仅write需要)","pid":数字(仅kill需要)}
`;

export function SystemTools() {
  const [tab, setTab] = useState('fs');

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-shrink-0 flex border-b border-[var(--input-bar-border)] bg-[#f8f9fa]">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`
              px-4 py-2.5 text-sm font-medium transition-colors
              ${tab === t.id
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                : 'text-[var(--input-placeholder)] hover:text-[var(--skill-btn-text)]'
              }
            `}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 flex flex-col p-4 overflow-hidden">
        {tab === 'fs' && <FsToolsView />}
        {tab === 'process' && <ProcessToolsView />}
        {tab === 'ai' && <AiTestView />}
      </div>
    </div>
  );
}

function FsToolsView() {
  const [path, setPath] = useState('');
  const [filePath, setFilePath] = useState('');
  const [writePath, setWritePath] = useState('');
  const [writeContent, setWriteContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  const run = async (fn) => {
    setLoading(true);
    setResult('');
    try {
      const data = await fn();
      setResult(JSON.stringify(data, null, 2));
    } catch (e) {
      setResult(`错误：${e?.message || String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 gap-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-shrink-0">
        <div className="rounded-lg border border-[var(--input-bar-border)] bg-white p-3 space-y-2">
          <div className="text-xs font-medium text-[var(--input-placeholder)] mb-1">列出目录（system/fs/list）</div>
          <input
            type="text"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="例如: d:\openAUI\backend\src"
            className="w-full px-2 py-1.5 text-[11px] border border-[var(--input-bar-border)] rounded bg-white font-mono focus:ring-1 focus:ring-blue-400 outline-none"
          />
          <button
            type="button"
            disabled={loading}
            onClick={() => run(() => systemFsList(path))}
            className="px-2 py-1 rounded text-[11px] font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? '执行中…' : '列目录'}
          </button>
        </div>

        <div className="rounded-lg border border-[var(--input-bar-border)] bg-white p-3 space-y-2">
          <div className="text-xs font-medium text-[var(--input-placeholder)] mb-1">读取文本（system/fs/readText）</div>
          <input
            type="text"
            value={filePath}
            onChange={(e) => setFilePath(e.target.value)}
            placeholder="例如: d:\openAUI\README.md"
            className="w-full px-2 py-1.5 text-[11px] border border-[var(--input-bar-border)] rounded bg-white font-mono focus:ring-1 focus:ring-blue-400 outline-none"
          />
          <button
            type="button"
            disabled={loading}
            onClick={() => run(() => systemFsReadText(filePath))}
            className="px-2 py-1 rounded text-[11px] font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? '执行中…' : '读取'}
          </button>
        </div>

        <div className="rounded-lg border border-[var(--input-bar-border)] bg-white p-3 space-y-2 md:col-span-2">
          <div className="text-xs font-medium text-[var(--input-placeholder)] mb-1">写入文本（system/fs/writeText）</div>
          <input
            type="text"
            value={writePath}
            onChange={(e) => setWritePath(e.target.value)}
            placeholder="例如: d:\openAUI\notes\demo.txt"
            className="w-full px-2 py-1.5 text-[11px] border border-[var(--input-bar-border)] rounded bg-white font-mono focus:ring-1 focus:ring-blue-400 outline-none mb-1.5"
          />
          <textarea
            value={writeContent}
            onChange={(e) => setWriteContent(e.target.value)}
            rows={4}
            placeholder="写入内容（1MB 以内）"
            className="w-full px-2 py-1.5 text-[11px] border border-[var(--input-bar-border)] rounded bg-white font-mono focus:ring-1 focus:ring-blue-400 outline-none resize-none mb-1.5"
          />
          <button
            type="button"
            disabled={loading}
            onClick={() => run(() => systemFsWriteText(writePath, writeContent))}
            className="px-2 py-1 rounded text-[11px] font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? '执行中…' : '写入'}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col rounded-lg border border-[var(--input-bar-border)] bg-white overflow-hidden">
        <div className="flex-shrink-0 px-2 py-1.5 border-b border-[var(--input-bar-border)] bg-[#f8f9fa] text-[10px] font-medium text-[var(--input-placeholder)]">
          调用结果（JSON / 文本）
        </div>
        <pre className="flex-1 min-h-0 p-2 text-[11px] font-mono bg-[#111827] text-[#e5e7eb] overflow-auto whitespace-pre-wrap break-all">
          {result || '执行后结果将显示在此'}
        </pre>
      </div>
    </div>
  );
}

function ProcessToolsView() {
  const [loading, setLoading] = useState(false);
  const [raw, setRaw] = useState('');
  const [pid, setPid] = useState('');

  const loadList = async () => {
    setLoading(true);
    try {
      const data = await systemProcessList();
      setRaw(data.raw || JSON.stringify(data, null, 2));
    } catch (e) {
      setRaw(`错误：${e?.message || String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const kill = async () => {
    const n = Number(pid);
    if (!Number.isFinite(n) || n <= 0) return;
    if (!window.confirm(`确定要结束进程 PID=${n} 吗？该操作可能导致程序退出。`)) return;
    setLoading(true);
    try {
      const data = await systemProcessKill(n);
      setRaw(JSON.stringify(data, null, 2));
    } catch (e) {
      setRaw(`错误：${e?.message || String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 gap-3">
      <div className="flex flex-wrap items-end gap-2 flex-shrink-0">
        <button
          type="button"
          disabled={loading}
          onClick={loadList}
          className="px-3 py-1.5 rounded text-[11px] font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? '获取中…' : '获取进程列表'}
        </button>
        <div className="flex items-center gap-1">
          <label className="text-[10px] text-[var(--input-placeholder)]">结束进程 PID</label>
          <input
            type="number"
            value={pid}
            onChange={(e) => setPid(e.target.value)}
            className="w-24 px-2 py-1 text-[11px] border border-[var(--input-bar-border)] rounded bg-white font-mono focus:ring-1 focus:ring-blue-400 outline-none"
          />
          <button
            type="button"
            disabled={loading}
            onClick={kill}
            className="px-2 py-1 rounded text-[11px] font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
          >
            杀死
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col rounded-lg border border-[var(--input-bar-border)] bg-white overflow-hidden">
        <div className="flex-shrink-0 px-2 py-1.5 border-b border-[var(--input-bar-border)] bg-[#f8f9fa] text-[10px] font-medium text-[var(--input-placeholder)]">
          进程列表 / 操作结果
        </div>
        <pre className="flex-1 min-h-0 p-2 text-[11px] font-mono bg-[#111827] text-[#e5e7eb] overflow-auto whitespace-pre-wrap break-all">
          {raw || '点击「获取进程列表」后结果将显示在此'}
        </pre>
      </div>
    </div>
  );
}

function resolvePath(p, projectRoot) {
  if (!p || typeof p !== 'string') return p;
  const trimmed = p.trim();
  if (!trimmed) return p;
  if (!projectRoot) return trimmed;
  if (trimmed.includes(':') || trimmed.startsWith('/')) return trimmed;
  const base = projectRoot.replace(/\\/g, '/');
  const rel = trimmed.replace(/^\/+/, '');
  return `${base}/${rel}`;
}

function AiTestView() {
  const [instruction, setInstruction] = useState('列出 backend 目录下的文件和子目录');
  const [vendorId, setVendorId] = useState(MODEL_VENDORS[0]?.id ?? '');
  const [modelId, setModelId] = useState(() => getFirstModelId(MODEL_VENDORS[0]?.id ?? ''));
  const [loading, setLoading] = useState(false);
  const [aiRaw, setAiRaw] = useState('');
  const [execResult, setExecResult] = useState('');
  const [viewMode, setViewMode] = useState('result'); // 'result' | 'ai'

  const run = async () => {
    const prompt = instruction.trim();
    if (!prompt) return;
    setLoading(true);
    setAiRaw('');
    setExecResult('');
    setViewMode('result');
    try {
      let vid = vendorId;
      let mid = modelId;
      const settings = await getSkillSettings().catch(() => ({}));
      const q = settings?.quick || {};
      if (q.vendorId && q.modelId) {
        vid = q.vendorId;
        mid = q.modelId;
      }
      let projectRoot = '';
      try {
        projectRoot = await getToolsProjectRoot();
      } catch (_) {}
      const rootHint = projectRoot
        ? `项目根目录：${projectRoot}。路径可使用绝对路径或相对项目根的路径（如 backend、frontend/src）。`
        : '路径请使用绝对路径。';
      const message = `用户指令：${prompt}

${rootHint}
${TOOL_SCHEMA}

请根据用户指令选择最合适的工具，仅输出一个 JSON 对象，不要 markdown 代码块、不要解释。`;
      const payload = { vendorId: vid, modelId: mid, message };
      const modelRes = await testModel(payload);
      const raw = (modelRes?.content ?? '').trim();
      setAiRaw(raw);
      const jsonStr = raw.replace(/^```\w*\n?|\n?```$/g, '').trim();
      let obj;
      try {
        obj = JSON.parse(jsonStr);
      } catch {
        setExecResult(`无法解析 AI 输出为 JSON：\n${raw}`);
        setLoading(false);
        return;
      }
      const tool = obj?.tool;
      if (!tool) {
        setExecResult(`AI 未返回有效 tool 字段：\n${JSON.stringify(obj, null, 2)}`);
        setLoading(false);
        return;
      }
      let toolResult;
      if (tool === 'fs_list') {
        const p = resolvePath(obj.path ?? '', projectRoot);
        toolResult = await systemFsList(p);
      } else if (tool === 'fs_read_text') {
        const p = resolvePath(obj.path ?? '', projectRoot);
        toolResult = await systemFsReadText(p);
      } else if (tool === 'fs_write_text') {
        const p = resolvePath(obj.path ?? '', projectRoot);
        toolResult = await systemFsWriteText(p, obj.content ?? '');
      } else if (tool === 'process_list') {
        toolResult = await systemProcessList();
      } else if (tool === 'process_kill') {
        const pid = Number(obj.pid);
        if (!Number.isFinite(pid) || pid <= 0) {
          toolResult = { success: false, error: 'pid 不合法' };
        } else if (!window.confirm(`确定要结束进程 PID=${pid} 吗？`)) {
          toolResult = { success: false, error: '用户取消' };
        } else {
          toolResult = await systemProcessKill(pid);
        }
      } else {
        toolResult = { success: false, error: `未知工具：${tool}` };
      }
      setExecResult(JSON.stringify(toolResult, null, 2));
    } catch (e) {
      setExecResult(`错误：${e?.message || String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 gap-3">
      <div className="flex-shrink-0 rounded-lg border border-[var(--input-bar-border)] bg-white p-3 space-y-2">
        <div className="text-xs font-medium text-[var(--input-placeholder)]">自然语言指令（AI 将自动选择并调用工具）</div>
        <input
          type="text"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="例如：列出 backend 目录下的文件、读取 README.md、获取进程列表"
          className="w-full px-2 py-1.5 text-[11px] border border-[var(--input-bar-border)] rounded bg-white focus:ring-1 focus:ring-blue-400 outline-none"
        />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] text-[var(--input-placeholder)] mb-0.5">厂商</label>
            <select
              value={vendorId}
              onChange={(e) => {
                const v = e.target.value;
                setVendorId(v);
                setModelId(getFirstModelId(v));
              }}
              className="w-full px-1.5 py-1 text-[11px] border border-[var(--input-bar-border)] rounded bg-white"
            >
              {MODEL_VENDORS.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-[var(--input-placeholder)] mb-0.5">模型</label>
            <select
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              className="w-full px-1.5 py-1 text-[11px] border border-[var(--input-bar-border)] rounded bg-white"
            >
              {(VENDOR_MODELS[vendorId] || []).map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={run}
          className="px-3 py-1.5 rounded text-[11px] font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? 'AI 解析并执行中…' : '开始 AI 测试'}
        </button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col rounded-lg border border-[var(--input-bar-border)] bg-white overflow-hidden">
          <div className="flex-shrink-0 px-2 py-1.5 border-b border-[var(--input-bar-border)] bg-[#f8f9fa] text-[10px] font-medium text-[var(--input-placeholder)] flex items-center justify-between">
            <span>{viewMode === 'result' ? '执行结果' : 'AI 原始输出'}</span>
            {aiRaw && (
              <button
                type="button"
                onClick={() => setViewMode((v) => (v === 'result' ? 'ai' : 'result'))}
                className="text-[9px] text-blue-600 hover:underline"
              >
                {viewMode === 'result' ? '查看 AI 原始输出' : '查看执行结果'}
              </button>
            )}
          </div>
          <pre className="flex-1 min-h-0 p-2 text-[11px] font-mono bg-[#111827] text-[#e5e7eb] overflow-auto whitespace-pre-wrap break-all">
            {(viewMode === 'result' ? execResult : aiRaw) || '输入指令并点击「开始 AI 测试」后，结果将显示在此'}
          </pre>
      </div>
    </div>
  );
}

