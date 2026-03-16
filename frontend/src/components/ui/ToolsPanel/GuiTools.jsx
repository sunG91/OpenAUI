/**
 * GUI 模拟工具（nut.js）：鼠标、键盘、截屏
 */
import { useState } from 'react';
import { guiMouseMove, guiMouseClick, guiKeyboardType, guiScreenCapture } from '../../../api/tools';
import { testModel } from '../../../api/modelTest';
import { getSkillSettings } from '../../../api/settings';
import { MODEL_VENDORS, VENDOR_MODELS } from '../../../data/modelVendors';

function getFirstModelId(vid) {
  const list = VENDOR_MODELS[vid] || [];
  return list[0]?.id ?? '';
}

const TABS = [
  { id: 'view', label: '查看' },
  { id: 'test', label: '测试' },
  { id: 'ai', label: 'AI 测试' },
];

const GUI_TOOL_SCHEMA = `
可选工具（输出 JSON，仅一个工具调用）：
1. gui_mouse_move - 鼠标移动到坐标。参数: x (数字), y (数字)
2. gui_mouse_click - 鼠标点击。参数: button (left/right，默认left), x (可选), y (可选)
3. gui_keyboard_type - 键盘输入文本。参数: text
4. gui_screen_capture - 截屏。参数: region (可选 "x,y,w,h")

输出格式（仅输出此 JSON）：{"tool":"工具名","x":数字,"y":数字,"button":"left","text":"内容","region":"x,y,w,h"}
`;

export function GuiTools() {
  const [tab, setTab] = useState('view');

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
      <div className={`flex-1 min-h-0 flex flex-col p-4 ${tab === 'test' || tab === 'ai' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        {tab === 'view' && <GuiToolsView />}
        {tab === 'test' && (
          <div className="flex-1 min-h-0 overflow-hidden">
            <GuiToolsTest />
          </div>
        )}
        {tab === 'ai' && (
          <div className="flex-1 min-h-0 overflow-hidden">
            <GuiAiTestView />
          </div>
        )}
      </div>
    </div>
  );
}

function GuiToolsView() {
  return (
    <div className="text-sm space-y-3 text-[var(--skill-btn-text)]">
      <h3 className="text-base font-semibold text-[var(--skill-btn-text)]">GUI 模拟工具说明</h3>
      <p className="text-[var(--input-placeholder)]">
        基于 <strong>nut.js</strong>（@nut-tree/nut-js）实现鼠标移动、点击、键盘输入、屏幕截取。
        需在 backend 目录执行 <code className="px-1 bg-[#f0f0f0] rounded">npm install @nut-tree/nut-js</code> 安装依赖。
      </p>
      <div className="rounded-lg border border-[var(--input-bar-border)] bg-[#f8f9fa] p-3">
        <div className="text-xs font-medium text-[var(--input-placeholder)] mb-1.5">可用接口</div>
        <ul className="space-y-1 text-xs font-mono">
          <li><strong>POST /api/tools/gui/mouse/move</strong> — 鼠标移动到 (x, y)</li>
          <li><strong>POST /api/tools/gui/mouse/click</strong> — 鼠标点击（button, 可选 x/y）</li>
          <li><strong>POST /api/tools/gui/keyboard/type</strong> — 键盘输入文本</li>
          <li><strong>GET /api/tools/gui/screen/capture</strong> — 截屏（可选 region=x,y,w,h）</li>
        </ul>
      </div>
    </div>
  );
}

function GuiToolsTest() {
  const [mouseX, setMouseX] = useState('100');
  const [mouseY, setMouseY] = useState('100');
  const [clickX, setClickX] = useState('');
  const [clickY, setClickY] = useState('');
  const [keyboardText, setKeyboardText] = useState('Hello');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [captureImage, setCaptureImage] = useState('');

  const run = async (fn) => {
    setLoading(true);
    setResult('');
    setCaptureImage('');
    try {
      const data = await fn();
      setResult(JSON.stringify(data, null, 2));
      if (data?.image) setCaptureImage(data.image);
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
          <div className="text-xs font-medium text-[var(--input-placeholder)]">鼠标移动</div>
          <div className="flex gap-2">
            <input type="number" value={mouseX} onChange={(e) => setMouseX(e.target.value)} placeholder="x" className="w-20 px-2 py-1 text-[11px] border rounded font-mono" />
            <input type="number" value={mouseY} onChange={(e) => setMouseY(e.target.value)} placeholder="y" className="w-20 px-2 py-1 text-[11px] border rounded font-mono" />
          </div>
          <button type="button" disabled={loading} onClick={() => run(() => guiMouseMove(Number(mouseX), Number(mouseY)))} className="px-2 py-1 rounded text-[11px] font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50">移动</button>
        </div>

        <div className="rounded-lg border border-[var(--input-bar-border)] bg-white p-3 space-y-2">
          <div className="text-xs font-medium text-[var(--input-placeholder)]">鼠标点击</div>
          <div className="flex gap-2">
            <input type="number" value={clickX} onChange={(e) => setClickX(e.target.value)} placeholder="x（可选）" className="w-20 px-2 py-1 text-[11px] border rounded font-mono" />
            <input type="number" value={clickY} onChange={(e) => setClickY(e.target.value)} placeholder="y（可选）" className="w-20 px-2 py-1 text-[11px] border rounded font-mono" />
          </div>
          <button type="button" disabled={loading} onClick={() => run(() => guiMouseClick(clickX && clickY ? { x: Number(clickX), y: Number(clickY) } : {}))} className="px-2 py-1 rounded text-[11px] font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50">左键点击</button>
        </div>

        <div className="rounded-lg border border-[var(--input-bar-border)] bg-white p-3 space-y-2">
          <div className="text-xs font-medium text-[var(--input-placeholder)]">键盘输入</div>
          <input type="text" value={keyboardText} onChange={(e) => setKeyboardText(e.target.value)} placeholder="输入内容" className="w-full px-2 py-1 text-[11px] border rounded font-mono" />
          <button type="button" disabled={loading} onClick={() => run(() => guiKeyboardType(keyboardText))} className="px-2 py-1 rounded text-[11px] font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50">输入</button>
        </div>

        <div className="rounded-lg border border-[var(--input-bar-border)] bg-white p-3 space-y-2">
          <div className="text-xs font-medium text-[var(--input-placeholder)]">截屏</div>
          <button type="button" disabled={loading} onClick={() => run(() => guiScreenCapture())} className="px-2 py-1 rounded text-[11px] font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">全屏截屏</button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col rounded-lg border border-[var(--input-bar-border)] bg-white overflow-hidden">
        <div className="flex-shrink-0 px-2 py-1.5 border-b border-[var(--input-bar-border)] bg-[#f8f9fa] text-[10px] font-medium text-[var(--input-placeholder)]">执行结果</div>
        <div className="flex-1 min-h-0 flex gap-2 p-2 overflow-auto">
          <pre className="flex-1 min-w-0 text-[11px] font-mono bg-[#111827] text-[#e5e7eb] p-2 rounded overflow-auto whitespace-pre-wrap break-all">
            {result || '执行后结果将显示在此'}
          </pre>
          {captureImage && (
            <img src={captureImage} alt="截屏" className="max-h-48 object-contain rounded border border-[var(--input-bar-border)]" />
          )}
        </div>
      </div>
    </div>
  );
}

function GuiAiTestView() {
  const [instruction, setInstruction] = useState('截屏');
  const [vendorId, setVendorId] = useState(MODEL_VENDORS[0]?.id ?? '');
  const [modelId, setModelId] = useState(() => getFirstModelId(MODEL_VENDORS[0]?.id ?? ''));
  const [loading, setLoading] = useState(false);
  const [aiRaw, setAiRaw] = useState('');
  const [execResult, setExecResult] = useState('');
  const [viewMode, setViewMode] = useState('result');
  const [captureImage, setCaptureImage] = useState('');

  const run = async () => {
    const prompt = instruction.trim();
    if (!prompt) return;
    setLoading(true);
    setAiRaw('');
    setExecResult('');
    setCaptureImage('');
    setViewMode('result');
    try {
      let vid = vendorId;
      let mid = modelId;
      const settings = await getSkillSettings().catch(() => ({}));
      const q = settings?.quick || {};
      if (q.vendorId && q.modelId) { vid = q.vendorId; mid = q.modelId; }
      const message = `用户指令：${prompt}\n\n${GUI_TOOL_SCHEMA}\n请根据用户指令选择最合适的工具，仅输出一个 JSON 对象，不要 markdown、不要解释。`;
      const modelRes = await testModel({ vendorId: vid, modelId: mid, message });
      const raw = (modelRes?.content ?? '').trim();
      setAiRaw(raw);
      const jsonStr = raw.replace(/^```\w*\n?|\n?```$/g, '').trim();
      let obj;
      try { obj = JSON.parse(jsonStr); } catch {
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
      if (tool === 'gui_mouse_move') {
        toolResult = await guiMouseMove(Number(obj.x) || 0, Number(obj.y) || 0);
      } else if (tool === 'gui_mouse_click') {
        const opts = { button: (obj.button || 'left').toLowerCase() };
        if (obj.x != null && obj.y != null) { opts.x = Number(obj.x); opts.y = Number(obj.y); }
        toolResult = await guiMouseClick(opts);
      } else if (tool === 'gui_keyboard_type') {
        toolResult = await guiKeyboardType(obj.text ?? '');
      } else if (tool === 'gui_screen_capture') {
        toolResult = await guiScreenCapture(obj.region);
        if (toolResult?.image) setCaptureImage(toolResult.image);
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
        <div className="text-xs font-medium text-[var(--input-placeholder)]">自然语言指令（AI 将自动选择并调用 GUI 工具）</div>
        <input type="text" value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="例如：把鼠标移到 500 300、在当前位置点击、输入 Hello、截屏" className="w-full px-2 py-1.5 text-[11px] border rounded focus:ring-1 focus:ring-blue-400 outline-none" />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] text-[var(--input-placeholder)] mb-0.5">厂商</label>
            <select value={vendorId} onChange={(e) => { const v = e.target.value; setVendorId(v); setModelId(getFirstModelId(v)); }} className="w-full px-1.5 py-1 text-[11px] border rounded">
              {MODEL_VENDORS.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-[var(--input-placeholder)] mb-0.5">模型</label>
            <select value={modelId} onChange={(e) => setModelId(e.target.value)} className="w-full px-1.5 py-1 text-[11px] border rounded">
              {(VENDOR_MODELS[vendorId] || []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        </div>
        <button type="button" disabled={loading} onClick={run} className="px-3 py-1.5 rounded text-[11px] font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">{loading ? 'AI 解析并执行中…' : '开始 AI 测试'}</button>
      </div>
      <div className="flex-1 min-h-0 flex flex-col rounded-lg border border-[var(--input-bar-border)] bg-white overflow-hidden">
        <div className="flex-shrink-0 px-2 py-1.5 border-b bg-[#f8f9fa] text-[10px] font-medium text-[var(--input-placeholder)] flex justify-between">
          <span>{viewMode === 'result' ? '执行结果' : 'AI 原始输出'}</span>
          {aiRaw && <button type="button" onClick={() => setViewMode((v) => (v === 'result' ? 'ai' : 'result'))} className="text-[9px] text-blue-600 hover:underline">{viewMode === 'result' ? '查看 AI 原始输出' : '查看执行结果'}</button>}
        </div>
        <div className="flex-1 min-h-0 flex gap-2 p-2 overflow-auto">
          <pre className="flex-1 min-w-0 text-[11px] font-mono bg-[#111827] text-[#e5e7eb] p-2 rounded overflow-auto whitespace-pre-wrap break-all">{(viewMode === 'result' ? execResult : aiRaw) || '输入指令并点击「开始 AI 测试」'}</pre>
          {captureImage && <img src={captureImage} alt="截屏" className="max-h-48 object-contain rounded border" />}
        </div>
      </div>
    </div>
  );
}
