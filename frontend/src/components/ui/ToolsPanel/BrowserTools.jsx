/**
 * 浏览器自动化工具（playwright）：打开页面、点击、输入、截屏
 */
import { useState } from 'react';
import { browserNavigate, browserClick, browserType, browserScreenshot } from '../../../api/tools';
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

const BROWSER_TOOL_SCHEMA = `
可选工具（输出 JSON，仅一个工具调用）：
1. browser_navigate - 打开页面。参数: url
2. browser_click - 点击元素。参数: url, selector (CSS选择器)
3. browser_type - 在元素内输入。参数: url, selector, text
4. browser_screenshot - 页面截屏。参数: url

输出格式（仅输出此 JSON）：{"tool":"工具名","url":"https://...","selector":"选择器","text":"输入内容"}
`;

export function BrowserTools() {
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
        {tab === 'view' && <BrowserToolsView />}
        {tab === 'test' && (
          <div className="flex-1 min-h-0 overflow-hidden">
            <BrowserToolsTest />
          </div>
        )}
        {tab === 'ai' && (
          <div className="flex-1 min-h-0 overflow-hidden">
            <BrowserAiTestView />
          </div>
        )}
      </div>
    </div>
  );
}

function BrowserToolsView() {
  return (
    <div className="text-sm space-y-3 text-[var(--skill-btn-text)]">
      <h3 className="text-base font-semibold text-[var(--skill-btn-text)]">浏览器自动化工具说明</h3>
      <p className="text-[var(--input-placeholder)]">
        基于 <strong>Playwright</strong> 实现无头浏览器自动化：打开页面、点击元素、输入文本、页面截屏。
        优先使用系统已安装的 <strong>Chrome</strong> 或 <strong>Edge</strong>，无需下载 Chromium。仅需 <code className="px-1 bg-[#f0f0f0] rounded">npm install playwright</code>。
      </p>
      <div className="rounded-lg border border-[var(--input-bar-border)] bg-[#f8f9fa] p-3">
        <div className="text-xs font-medium text-[var(--input-placeholder)] mb-1.5">可用接口</div>
        <ul className="space-y-1 text-xs font-mono">
          <li><strong>POST /api/tools/browser/navigate</strong> — 打开页面</li>
          <li><strong>POST /api/tools/browser/click</strong> — 点击元素（url, selector）</li>
          <li><strong>POST /api/tools/browser/type</strong> — 在元素内输入（url, selector, text）</li>
          <li><strong>POST /api/tools/browser/screenshot</strong> — 页面截屏</li>
        </ul>
      </div>
    </div>
  );
}

function BrowserToolsTest() {
  const [url, setUrl] = useState('https://www.example.com');
  const [selector, setSelector] = useState('input[type="text"]');
  const [typeText, setTypeText] = useState('Hello');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [screenshotImage, setScreenshotImage] = useState('');

  const run = async (fn) => {
    setLoading(true);
    setResult('');
    setScreenshotImage('');
    try {
      const data = await fn();
      setResult(JSON.stringify(data, null, 2));
      if (data?.image) setScreenshotImage(data.image);
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
          <div className="text-xs font-medium text-[var(--input-placeholder)]">打开页面</div>
          <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className="w-full px-2 py-1 text-[11px] border rounded font-mono" />
          <button type="button" disabled={loading} onClick={() => run(() => browserNavigate(url))} className="px-2 py-1 rounded text-[11px] font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50">打开</button>
        </div>

        <div className="rounded-lg border border-[var(--input-bar-border)] bg-white p-3 space-y-2">
          <div className="text-xs font-medium text-[var(--input-placeholder)]">点击元素</div>
          <input type="text" value={selector} onChange={(e) => setSelector(e.target.value)} placeholder="CSS 选择器" className="w-full px-2 py-1 text-[11px] border rounded font-mono" />
          <button type="button" disabled={loading} onClick={() => run(() => browserClick(url, selector))} className="px-2 py-1 rounded text-[11px] font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50">点击</button>
        </div>

        <div className="rounded-lg border border-[var(--input-bar-border)] bg-white p-3 space-y-2">
          <div className="text-xs font-medium text-[var(--input-placeholder)]">输入文本</div>
          <input type="text" value={typeText} onChange={(e) => setTypeText(e.target.value)} placeholder="输入内容" className="w-full px-2 py-1 text-[11px] border rounded font-mono" />
          <button type="button" disabled={loading} onClick={() => run(() => browserType(url, selector, typeText))} className="px-2 py-1 rounded text-[11px] font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50">输入</button>
        </div>

        <div className="rounded-lg border border-[var(--input-bar-border)] bg-white p-3 space-y-2">
          <div className="text-xs font-medium text-[var(--input-placeholder)]">页面截屏</div>
          <button type="button" disabled={loading} onClick={() => run(() => browserScreenshot(url))} className="px-2 py-1 rounded text-[11px] font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">截屏</button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col rounded-lg border border-[var(--input-bar-border)] bg-white overflow-hidden">
        <div className="flex-shrink-0 px-2 py-1.5 border-b border-[var(--input-bar-border)] bg-[#f8f9fa] text-[10px] font-medium text-[var(--input-placeholder)]">执行结果</div>
        <div className="flex-1 min-h-0 flex gap-2 p-2 overflow-auto">
          <pre className="flex-1 min-w-0 text-[11px] font-mono bg-[#111827] text-[#e5e7eb] p-2 rounded overflow-auto whitespace-pre-wrap break-all">
            {result || '执行后结果将显示在此'}
          </pre>
          {screenshotImage && (
            <img src={screenshotImage} alt="页面截屏" className="max-h-48 object-contain rounded border border-[var(--input-bar-border)]" />
          )}
        </div>
      </div>
    </div>
  );
}

function BrowserAiTestView() {
  const [instruction, setInstruction] = useState('打开 https://www.example.com 并截屏');
  const [vendorId, setVendorId] = useState(MODEL_VENDORS[0]?.id ?? '');
  const [modelId, setModelId] = useState(() => getFirstModelId(MODEL_VENDORS[0]?.id ?? ''));
  const [loading, setLoading] = useState(false);
  const [aiRaw, setAiRaw] = useState('');
  const [execResult, setExecResult] = useState('');
  const [viewMode, setViewMode] = useState('result');
  const [screenshotImage, setScreenshotImage] = useState('');

  const run = async () => {
    const prompt = instruction.trim();
    if (!prompt) return;
    setLoading(true);
    setAiRaw('');
    setExecResult('');
    setScreenshotImage('');
    setViewMode('result');
    try {
      let vid = vendorId;
      let mid = modelId;
      const settings = await getSkillSettings().catch(() => ({}));
      const q = settings?.quick || {};
      if (q.vendorId && q.modelId) { vid = q.vendorId; mid = q.modelId; }
      const message = `用户指令：${prompt}\n\n${BROWSER_TOOL_SCHEMA}\n请根据用户指令选择最合适的工具，仅输出一个 JSON 对象，不要 markdown、不要解释。`;
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
      const url = obj.url ?? '';
      let toolResult;
      if (tool === 'browser_navigate') {
        toolResult = await browserNavigate(url);
      } else if (tool === 'browser_click') {
        toolResult = await browserClick(url, obj.selector ?? '');
      } else if (tool === 'browser_type') {
        toolResult = await browserType(url, obj.selector ?? '', obj.text ?? '');
      } else if (tool === 'browser_screenshot') {
        toolResult = await browserScreenshot(url);
        if (toolResult?.image) setScreenshotImage(toolResult.image);
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
        <div className="text-xs font-medium text-[var(--input-placeholder)]">自然语言指令（AI 将自动选择并调用浏览器工具）</div>
        <input type="text" value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="例如：打开百度并截屏、在 example.com 的搜索框输入 hello" className="w-full px-2 py-1.5 text-[11px] border rounded focus:ring-1 focus:ring-blue-400 outline-none" />
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
          {screenshotImage && <img src={screenshotImage} alt="页面截屏" className="max-h-48 object-contain rounded border" />}
        </div>
      </div>
    </div>
  );
}
