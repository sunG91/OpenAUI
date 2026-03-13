/**
 * 控制台工具 - 测试：直接执行 / 通过模型生成并执行
 */
import { useState } from 'react';
import { runShell, getToolsPlatform } from '../../../api/tools';
import { testModel } from '../../../api/modelTest';
import { getSkillSettings } from '../../../api/settings';
import { MODEL_VENDORS, VENDOR_MODELS } from '../../../data/modelVendors';

function getFirstModelId(vid) {
  const list = VENDOR_MODELS[vid] || [];
  return list[0]?.id ?? '';
}

export function ConsoleToolsTest() {
  const [command, setCommand] = useState('echo Hello');
  const [cwd, setCwd] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [aiRawReply, setAiRawReply] = useState('');
  const [aiGeneratedCommand, setAiGeneratedCommand] = useState('');
  const [rightView, setRightView] = useState('result'); // 'result' | 'ai'

  const [nlPrompt, setNlPrompt] = useState('列出当前目录下的文件');
  const [modelLoading, setModelLoading] = useState(false);
  const [vendorId, setVendorId] = useState(MODEL_VENDORS[0]?.id ?? '');
  const [modelId, setModelId] = useState(() => getFirstModelId(MODEL_VENDORS[0]?.id ?? ''));

  const runDirect = async () => {
    if (!command.trim()) return;
    setLoading(true);
    setResult(null);
    setAiRawReply('');
    setAiGeneratedCommand('');
    setRightView('result');
    try {
      const data = await runShell(command.trim(), { cwd: cwd.trim() || undefined });
      setResult(data);
    } catch (e) {
      setResult({ success: false, error: e?.message || '请求失败', stdout: '', stderr: '', code: -1 });
    } finally {
      setLoading(false);
    }
  };

  const runViaModel = async () => {
    const prompt = nlPrompt.trim();
    if (!prompt) return;
    setModelLoading(true);
    setResult(null);
    setAiRawReply('');
    setAiGeneratedCommand('');
    setRightView('ai');
    try {
      let vid = vendorId;
      let mid = modelId;
      const settings = await getSkillSettings().catch(() => ({}));
      const q = settings?.quick || {};
      if (q.vendorId && q.modelId) {
        vid = q.vendorId;
        mid = q.modelId;
      }
      let osHint = '';
      try {
        const platform = await getToolsPlatform();
        if (platform === 'win32') {
          osHint = '当前运行环境是 Windows，请只输出在 Windows CMD 下可执行的命令（例如用 dir 列出目录、不要用 ls；用 echo 输出、路径用反斜杠）。';
        } else if (platform === 'darwin' || platform === 'linux') {
          osHint = '当前运行环境是 Unix/Linux/macOS，请只输出可在该终端下执行的命令（如 ls、pwd 等）。';
        }
      } catch (_) {}
      const message = osHint
        ? `用户希望执行：${prompt}\n\n${osHint}\n请只输出一条可执行的命令行，不要任何解释、不要 markdown 代码块包裹、不要换行。仅输出命令本身。`
        : `用户希望执行：${prompt}\n\n请只输出一条可执行的命令行，不要任何解释、不要 markdown 代码块包裹，不要换行。仅输出命令本身。`;
      const payload = { vendorId: vid, modelId: mid, message };
      const data = await testModel(payload);
      const raw = (data?.content ?? '').trim();
      setAiRawReply(raw);
      const cmd = raw.replace(/^```\w*\n?|\n?```$/g, '').trim().split('\n')[0].trim();
      setAiGeneratedCommand(cmd);
      if (!cmd) {
        setResult({ success: false, error: '模型未返回有效命令', stdout: raw, stderr: '', code: -1 });
        setRightView('result');
        setModelLoading(false);
        return;
      }
      const execData = await runShell(cmd, { cwd: cwd.trim() || undefined });
      setResult({ ...execData, _generatedCommand: cmd });
      setRightView('result');
    } catch (e) {
      setResult({ success: false, error: e?.message || '请求失败', stdout: '', stderr: '', code: -1 });
      setRightView('result');
    } finally {
      setModelLoading(false);
    }
  };

  const models = VENDOR_MODELS[vendorId] || [];
  const currentModel = models.find((m) => m.id === modelId) || models[0];

  return (
    <div className="flex flex-row gap-3 h-full min-h-0">
      {/* 左侧：操作区 */}
      <div className="w-[42%] min-w-0 flex flex-col gap-2 overflow-y-auto">
        <div className="rounded-lg border border-[var(--input-bar-border)] bg-white overflow-hidden flex-shrink-0">
          <div className="px-2 py-1.5 border-b border-[var(--input-bar-border)] bg-[#f8f9fa] text-[10px] font-medium text-[var(--input-placeholder)]">
            直接执行
          </div>
          <div className="p-2 space-y-1.5">
            <div>
              <label className="block text-[10px] text-[var(--input-placeholder)] mb-0.5">命令</label>
              <input
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="例如: dir 或 ls -la"
                className="w-full px-2 py-1.5 text-[11px] border border-[var(--input-bar-border)] rounded bg-white font-mono focus:ring-1 focus:ring-blue-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] text-[var(--input-placeholder)] mb-0.5">工作目录（可选）</label>
              <input
                type="text"
                value={cwd}
                onChange={(e) => setCwd(e.target.value)}
                placeholder="留空使用默认"
                className="w-full px-2 py-1.5 text-[11px] border border-[var(--input-bar-border)] rounded bg-white font-mono focus:ring-1 focus:ring-blue-400 outline-none"
              />
            </div>
            <button
              type="button"
              onClick={runDirect}
              disabled={loading}
              className="px-2 py-1 rounded text-[11px] font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? '执行中…' : '执行'}
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-[var(--input-bar-border)] bg-white overflow-hidden flex-shrink-0">
          <div className="px-2 py-1.5 border-b border-[var(--input-bar-border)] bg-[#f8f9fa] text-[10px] font-medium text-[var(--input-placeholder)]">
            通过模型生成并执行
          </div>
          <div className="p-2 space-y-1.5">
            <div>
              <label className="block text-[10px] text-[var(--input-placeholder)] mb-0.5">自然语言描述</label>
              <input
                type="text"
                value={nlPrompt}
                onChange={(e) => setNlPrompt(e.target.value)}
                placeholder="例如: 列出当前目录下的文件"
                className="w-full px-2 py-1.5 text-[11px] border border-[var(--input-bar-border)] rounded bg-white focus:ring-1 focus:ring-blue-400 outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
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
                  value={modelId || currentModel?.id}
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
              onClick={runViaModel}
              disabled={modelLoading}
              className="px-2 py-1 rounded text-[11px] font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
            >
              {modelLoading ? '生成并执行中…' : '通过模型生成并执行'}
            </button>
          </div>
        </div>
      </div>

      {/* 右侧：执行结果（始终显示） */}
      <div className="flex-1 min-w-0 flex flex-col rounded-lg border border-[var(--input-bar-border)] bg-white overflow-hidden">
        <div className="flex-shrink-0 px-2 py-1.5 border-b border-[var(--input-bar-border)] bg-[#f8f9fa] text-[10px] font-medium text-[var(--input-placeholder)] flex items-center justify-between">
          <span>
            {rightView === 'ai'
              ? 'AI 回复'
              : (result != null ? (result.success ? '执行结果' : '错误') : '执行结果')
            }
          </span>
          {result?._generatedCommand != null && (
            <span className="font-mono text-[9px] text-blue-600 truncate max-w-[70%]" title={result._generatedCommand}>
              命令: {result._generatedCommand}
            </span>
          )}
        </div>
        <div className="flex-1 min-h-0 flex flex-col p-2 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-hidden">
            {rightView === 'ai' ? (
              <div className="h-full flex flex-col gap-1.5 overflow-hidden">
                <div className="flex-shrink-0 text-[9px] text-[var(--input-placeholder)]">
                  {modelLoading ? '生成命令中…' : (aiGeneratedCommand ? '已生成命令' : '等待生成')}
                </div>
                {aiGeneratedCommand ? (
                  <div className="flex-shrink-0">
                    <div className="text-[9px] text-[var(--input-placeholder)] mb-0.5">命令</div>
                    <pre className="font-mono text-[10px] bg-[#111827] text-[#e5e7eb] p-1.5 rounded overflow-auto whitespace-pre-wrap break-all max-h-20">
                      {aiGeneratedCommand}
                    </pre>
                  </div>
                ) : null}
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                  <div className="flex-shrink-0 text-[9px] text-[var(--input-placeholder)] mb-0.5">AI 原始回复</div>
                  <pre className="flex-1 min-h-0 font-mono text-[10px] bg-[#1f2937] text-[#e5e7eb] p-1.5 rounded overflow-auto whitespace-pre-wrap break-all">
                    {aiRawReply || (modelLoading ? '（等待模型输出…）' : '（暂无）')}
                  </pre>
                </div>
              </div>
            ) : (
              <>
                {result == null ? (
                  <div className="h-full flex items-center justify-center text-[10px] text-[var(--input-placeholder)]">执行后结果将显示在此</div>
                ) : (
                  <div className="h-full flex flex-col gap-1.5 overflow-hidden">
                    {!result.success && result.error && (
                      <div className="flex-shrink-0 text-[10px] text-red-600">{result.error}</div>
                    )}
                    {result.stdout != null && result.stdout !== '' && (
                      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                        <div className="flex-shrink-0 text-[9px] text-[var(--input-placeholder)] mb-0.5">stdout</div>
                        <pre className="flex-1 min-h-0 font-mono text-[10px] bg-[#111827] text-[#e5e7eb] p-1.5 rounded overflow-auto whitespace-pre-wrap break-all">
                          {result.stdout}
                        </pre>
                      </div>
                    )}
                    {result.stderr != null && result.stderr !== '' && (
                      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                        <div className="flex-shrink-0 text-[9px] text-amber-600 mb-0.5">stderr</div>
                        <pre className="flex-1 min-h-0 font-mono text-[10px] bg-[#1f2937] text-amber-200 p-1.5 rounded overflow-auto whitespace-pre-wrap break-all">
                          {result.stderr}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* 底部状态栏：退出码 + 视图切换（icon） */}
          <div className="flex-shrink-0 pt-2 mt-2 border-t border-[var(--input-bar-border)] flex items-center justify-between text-[9px] text-[var(--input-placeholder)]">
            <div className="truncate">
              退出码: {result?.code ?? (loading || modelLoading ? '…' : '—')}
            </div>
            <button
              type="button"
              onClick={() => setRightView((v) => (v === 'ai' ? 'result' : 'ai'))}
              className="p-1 rounded hover:bg-[var(--skill-btn-bg)] text-[var(--skill-btn-text)]"
              title={rightView === 'ai' ? '切换到执行结果' : '切换到 AI 回复'}
            >
              {rightView === 'ai' ? (
                // 切到结果：终端/结果 icon
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              ) : (
                // 切到 AI：对话气泡 icon
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
