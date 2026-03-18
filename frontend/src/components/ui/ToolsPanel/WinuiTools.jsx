/**
 * 系统定位工具（Windows UI Automation）
 * - 精准定位：按名称/AutomationId 定位，坐标永不偏差
 * - 系统定位测试：Plan + 百度 OCR + WinUI 精准定位 + RobotJS 执行
 */
import { useState } from 'react';
import {
  winuiLocate,
  guiMouseMove,
  guiMouseClick,
  guiKeyboardType,
  guiScreenCapture,
  visionLocate,
} from '../../../api/tools';
import { testModel } from '../../../api/modelTest';
import { testBaiduOcr } from '../../../api/client';
import { MODEL_VENDORS, VENDOR_MODELS, VISION_TAGS } from '../../../data/modelVendors';

function isToolsModel(m) {
  return !!(m && Array.isArray(m.tags) && m.tags.includes('tools'));
}

function getToolsModels(vid) {
  return (VENDOR_MODELS[vid] || []).filter(isToolsModel);
}

function getToolsVendors() {
  return MODEL_VENDORS.filter((v) => getToolsModels(v.id).length > 0);
}

function getFirstToolsModelId(vid) {
  const list = getToolsModels(vid);
  return list[0]?.id ?? '';
}

function getVisionModelForLocate(formVendorId, fallbackVid, fallbackMid) {
  const list = VENDOR_MODELS[formVendorId] || [];
  const vision = list.find((m) => m.tags?.some((t) => VISION_TAGS.includes(t)));
  if (vision) return { vendorId: formVendorId, modelId: vision.id };
  if (VENDOR_MODELS.siliconflow) {
    const sf = VENDOR_MODELS.siliconflow.find((m) => m.tags?.some((t) => VISION_TAGS.includes(t)));
    if (sf) return { vendorId: 'siliconflow', modelId: sf.id };
  }
  if (VENDOR_MODELS.volcengine) {
    const vol = VENDOR_MODELS.volcengine.find((m) => m.tags?.some((t) => VISION_TAGS.includes(t)));
    if (vol) return { vendorId: 'volcengine', modelId: vol.id };
  }
  return { vendorId: fallbackVid, modelId: fallbackMid };
}

const WINUI_PLAN_SCHEMA = `你是一个专业的任务执行助手，能够根据用户的自然语言指令，生成标准化、可执行的步骤与工具调用。
你只输出结构化结果，不闲聊、不解释、不额外补充文字。

规则：
1. 只使用以下工具：
   - gui_screen_capture：截屏
   - winui_locate：定位控件（name：控件名称）
   - gui_wait_element：等待元素出现（name：元素名，timeout：秒）
   - gui_keyboard_type：键盘输入（text：输入内容）
   - gui_mouse_click：鼠标点击（button：left/right，需先有 winui_locate 的坐标）
2. 步骤必须按顺序：等待 → 定位 → 操作 → 确认
3. 每一步只做一件事
4. 输出严格为 JSON，无其他内容

输出格式：
{"goal":"用户目标简述","steps":[{"step":1,"action":"等待","tool":"gui_wait_element","name":"确定","timeout":5},{"step":2,"action":"定位","tool":"winui_locate","name":"确定"},{"step":3,"action":"点击","tool":"gui_mouse_click","button":"left"}]}`;

const TABS = [
  { id: 'locate', label: '精准定位' },
  { id: 'test', label: '系统定位测试' },
];

export function WinuiTools() {
  const [tab, setTab] = useState('locate');

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
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {tab === 'locate' && <WinuiLocateView />}
        {tab === 'test' && <WinuiSystemTestView />}
      </div>
    </div>
  );
}

function WinuiLocateView() {
  const [name, setName] = useState('');
  const [automationId, setAutomationId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [clicking, setClicking] = useState(false);

  const handleLocate = async () => {
    if (!name?.trim() && !automationId?.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const data = await winuiLocate({ name: name.trim() || undefined, automationId: automationId.trim() || undefined });
      setResult(data);
    } catch (e) {
      setResult({ error: e?.message || '定位失败' });
    } finally {
      setLoading(false);
    }
  };

  const handleClickAt = async () => {
    if (result?.x == null || result?.y == null) return;
    setClicking(true);
    try {
      await guiMouseMove(result.x, result.y);
      await guiMouseClick({ x: result.x, y: result.y });
    } catch (e) {
      setResult((r) => ({ ...r, error: r?.error || e?.message }));
    } finally {
      setClicking(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="text-sm space-y-4 text-[var(--skill-btn-text)]">
        <p className="text-[var(--input-placeholder)]">
          基于 Windows UI Automation API，通过元素名称或 AutomationId 定位，坐标由系统提供，<strong>永不偏差</strong>。仅支持 Windows。
        </p>
        <div className="rounded-lg border border-[var(--input-bar-border)] bg-[#f8f9fa] p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-[var(--input-placeholder)] mb-1">元素名称 (Name)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如：确定、OK、关闭"
              className="w-full px-3 py-2 rounded-lg text-sm bg-white border border-[var(--input-bar-border)] outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--input-placeholder)] mb-1">AutomationId（可选）</label>
            <input
              type="text"
              value={automationId}
              onChange={(e) => setAutomationId(e.target.value)}
              placeholder="如：btnOK"
              className="w-full px-3 py-2 rounded-lg text-sm bg-white border border-[var(--input-bar-border)] outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <button
            type="button"
            disabled={loading || (!name?.trim() && !automationId?.trim())}
            onClick={handleLocate}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '定位中...' : '定位'}
          </button>
        </div>
        {result && (
          <div className="rounded-lg border border-[var(--input-bar-border)] bg-white p-4">
            <h4 className="text-sm font-medium mb-2">定位结果</h4>
            {result.error ? (
              <p className="text-red-600 text-sm">{result.error}</p>
            ) : (
              <>
                <p className="text-sm font-mono">中心坐标: ({result.x}, {result.y})</p>
                {result.name && <p className="text-xs text-[var(--input-placeholder)] mt-1">Name: {result.name}</p>}
                {result.rect && (
                  <p className="text-xs text-[var(--input-placeholder)]">区域: {result.rect.left},{result.rect.top} {result.rect.width}×{result.rect.height}</p>
                )}
                <button
                  type="button"
                  disabled={clicking}
                  onClick={handleClickAt}
                  className="mt-3 px-3 py-1.5 rounded-lg text-sm bg-green-500 text-white hover:bg-green-600 disabled:opacity-50"
                >
                  {clicking ? '点击中...' : '在此坐标点击'}
                </button>
              </>
            )}
          </div>
        )}
        <div className="rounded-lg border border-[var(--input-bar-border)] bg-[#f8f9fa] p-3">
          <div className="text-xs font-medium text-[var(--input-placeholder)] mb-1.5">接口</div>
          <p className="text-xs font-mono"><strong>POST /api/tools/winui/locate</strong> — body: {"{ name?, automationId? }"}</p>
        </div>
      </div>
    </div>
  );
}

function WinuiSystemTestView() {
  const toolsVendors = getToolsVendors();
  const [instruction, setInstruction] = useState('点击确定按钮');
  const [vendorId, setVendorId] = useState(() => toolsVendors[0]?.id ?? '');
  const [modelId, setModelId] = useState(() => getFirstToolsModelId(toolsVendors[0]?.id ?? ''));
  const [loading, setLoading] = useState(false);
  const [aiRaw, setAiRaw] = useState('');
  const [execResult, setExecResult] = useState('');
  const [viewMode, setViewMode] = useState('result');
  const [captureImage, setCaptureImage] = useState('');
  const [flowSteps, setFlowSteps] = useState([]);

  const run = async () => {
    const prompt = instruction.trim();
    if (!prompt) return;
    setLoading(true);
    setAiRaw('');
    setExecResult('');
    setCaptureImage('');
    setFlowSteps([]);
    const flow = [];
    let lastImage = null;
    let lastX = null;
    let lastY = null;
    let ocrTexts = [];

    try {
      const planMsg = `用户指令：${prompt}\n\n${WINUI_PLAN_SCHEMA}\n请根据用户指令输出步骤计划，仅输出 JSON，不要 markdown。`;
      const planRes = await testModel({ vendorId, modelId, message: planMsg });
      const planRaw = (planRes?.content ?? '').trim();
      setAiRaw(planRaw);
      const planStr = planRaw.replace(/^```\w*\n?|\n?```$/g, '').trim();
      let plan;
      try {
        plan = JSON.parse(planStr);
      } catch {
        setExecResult(`无法解析 Plan：\n${planRaw}`);
        setLoading(false);
        return;
      }
      const steps = plan?.steps || [];
      if (!steps.length) {
        setExecResult(`Plan 无有效步骤`);
        setLoading(false);
        return;
      }

      for (let i = 0; i < steps.length; i++) {
        const s = steps[i];
        const tool = s.tool || '';
        const action = s.action || tool;

        if (tool === 'gui_screen_capture') {
          const res = await guiScreenCapture(s.region);
          if (res?.image) {
            lastImage = res.image;
            setCaptureImage(res.image);
          }
          flow.push({ step: i + 1, action, tool, success: !!res?.image, result: res, image: res?.image });
        } else if (tool === 'gui_wait_element') {
          const waitName = s.name || '';
          const timeoutSec = Math.max(1, Number(s.timeout) || 5);
          const intervalMs = 800;
          let found = false;
          let waitResult = null;
          for (let elapsed = 0; elapsed < timeoutSec * 1000 && !found; elapsed += intervalMs) {
            try {
              const loc = await winuiLocate({ name: waitName });
              if (loc?.x != null && loc?.y != null) {
                lastX = loc.x;
                lastY = loc.y;
                found = true;
                waitResult = { x: loc.x, y: loc.y, name: loc.name };
              }
            } catch (_) {}
            if (!found) await new Promise((r) => setTimeout(r, intervalMs));
          }
          flow.push({ step: i + 1, action, tool, success: found, result: waitResult || { error: `超时 ${timeoutSec}s 未找到元素：${waitName}` } });
        } else if (tool === 'baidu_ocr') {
          const img = lastImage || (await guiScreenCapture()).image;
          if (!img) {
            flow.push({ step: i + 1, action, tool, success: false, result: { error: '无截屏' } });
            continue;
          }
          const base64 = img?.includes(',') ? img.split(',')[1] : img;
          try {
            const ocrRes = await testBaiduOcr({ image: base64 });
            const words = ocrRes?.data?.words_result || [];
            ocrTexts = words.map((w) => w.words).filter(Boolean);
            flow.push({ step: i + 1, action, tool, success: true, result: { texts: ocrTexts }, image: img });
          } catch (e) {
            flow.push({ step: i + 1, action, tool, success: false, result: { error: e?.message }, image: img });
          }
        } else if (tool === 'winui_locate') {
          const name = s.name || (ocrTexts.length ? ocrTexts[0] : '');
          if (!name) {
            flow.push({ step: i + 1, action, tool, success: false, result: { error: '缺少 name，请在上一步 baidu_ocr 或 Plan 中指定' } });
            continue;
          }
          try {
            const locateRes = await winuiLocate({ name, automationId: s.automationId });
            if (locateRes?.x != null && locateRes?.y != null) {
              lastX = locateRes.x;
              lastY = locateRes.y;
              flow.push({ step: i + 1, action, tool, success: true, result: { x: lastX, y: lastY, name: locateRes.name }, image: lastImage });
            } else {
              flow.push({ step: i + 1, action, tool, success: false, result: locateRes || { error: '定位失败' }, image: lastImage });
            }
          } catch (e) {
            flow.push({ step: i + 1, action, tool, success: false, result: { error: e?.message }, image: lastImage });
          }
        } else if (tool === 'vision_locate') {
          const img = lastImage || (await guiScreenCapture()).image;
          if (!img) {
            flow.push({ step: i + 1, action, tool, success: false, result: { error: '无截屏' } });
            continue;
          }
          const { vendorId: visionVid, modelId: visionMid } = getVisionModelForLocate(vendorId, vendorId, modelId);
          try {
            const locateRes = await visionLocate({ image: img, prompt: s.prompt || prompt, vendorId: visionVid, modelId: visionMid });
            if (locateRes?.x != null && locateRes?.y != null) {
              lastX = locateRes.x;
              lastY = locateRes.y;
              flow.push({ step: i + 1, action, tool, success: true, result: { x: lastX, y: lastY }, image: img });
            } else {
              flow.push({ step: i + 1, action, tool, success: false, result: locateRes || { error: '视觉定位未返回坐标' }, image: img });
            }
          } catch (e) {
            flow.push({ step: i + 1, action, tool, success: false, result: { error: e?.message }, image: img });
          }
        } else if (tool === 'gui_mouse_click') {
          const clickX = lastX ?? s.x;
          const clickY = lastY ?? s.y;
          const doubleClick = s.doubleClick === true;
          const opts = { button: (s.button || 'left').toLowerCase(), doubleClick };
          if (clickX != null && clickY != null) {
            opts.x = Number(clickX);
            opts.y = Number(clickY);
          }
          try {
            const res = await guiMouseClick(opts);
            flow.push({ step: i + 1, action, tool, success: true, result: res });
          } catch (e) {
            flow.push({ step: i + 1, action, tool, success: false, result: { error: e?.message } });
          }
        } else if (tool === 'gui_mouse_move') {
          const x = s.x != null ? Number(s.x) : (lastX ?? 0);
          const y = s.y != null ? Number(s.y) : (lastY ?? 0);
          try {
            const res = await guiMouseMove(x, y);
            flow.push({ step: i + 1, action, tool, success: true, result: res });
          } catch (e) {
            flow.push({ step: i + 1, action, tool, success: false, result: { error: e?.message } });
          }
        } else if (tool === 'gui_keyboard_type') {
          try {
            const res = await guiKeyboardType(s.text ?? '');
            flow.push({ step: i + 1, action, tool, success: true, result: res });
          } catch (e) {
            flow.push({ step: i + 1, action, tool, success: false, result: { error: e?.message } });
          }
        } else {
          flow.push({ step: i + 1, action, tool, success: false, result: { error: `未知工具：${tool}` } });
        }
        setFlowSteps([...flow]);
      }

      const lastFlow = flow[flow.length - 1];
      setExecResult(JSON.stringify(lastFlow?.result ?? { steps: flow.length }, null, 2));
    } catch (e) {
      setExecResult(`错误：${e?.message || String(e)}`);
      setFlowSteps((f) => [...f, { step: -1, action: '异常', tool: '', success: false, result: { error: e?.message } }]);
    } finally {
      setLoading(false);
    }
  };

  const viewLabels = { result: '执行结果', flow: '操作流程', ai: 'AI Plan' };

  return (
    <div className="flex flex-col h-full min-h-0 gap-3 p-4">
      <div className="flex-shrink-0 rounded-lg border border-[var(--input-bar-border)] bg-white p-3 space-y-2">
        <div className="text-xs font-medium text-[var(--input-placeholder)]">技术栈：精准定位(Windows UIA) + 百度 OCR + 执行(RobotJS) + AI 大脑(Plan+视觉模型)</div>
        <input
          type="text"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="例如：点击确定、点击取消、关闭对话框"
          className="w-full px-2 py-1.5 text-sm border rounded focus:ring-1 focus:ring-blue-400 outline-none"
        />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] text-[var(--input-placeholder)] mb-0.5">Plan 模型厂商（仅 tools）</label>
            <select value={vendorId} onChange={(e) => { const v = e.target.value; setVendorId(v); setModelId(getFirstToolsModelId(v)); }} className="w-full px-1.5 py-1 text-[11px] border rounded">
              {toolsVendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-[var(--input-placeholder)] mb-0.5">Plan 模型（必须带 tools 标签）</label>
            <select value={modelId} onChange={(e) => setModelId(e.target.value)} className="w-full px-1.5 py-1 text-[11px] border rounded">
              {getToolsModels(vendorId).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        </div>
        {toolsVendors.length === 0 && (
          <p className="text-xs text-amber-600">暂无带 tools 标签的模型，请在 modelVendors 中配置。</p>
        )}
        <button type="button" disabled={loading || !modelId || toolsVendors.length === 0} onClick={run} className="px-3 py-1.5 rounded text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
          {loading ? 'AI 解析并执行中…' : '开始系统定位测试'}
        </button>
      </div>
      <div className="flex-1 min-h-0 flex flex-col rounded-lg border border-[var(--input-bar-border)] bg-white overflow-hidden">
        <div className="flex-shrink-0 px-2 py-1.5 border-b bg-[#f8f9fa] text-[10px] font-medium text-[var(--input-placeholder)] flex justify-between items-center gap-2">
          <span>{viewLabels[viewMode] || viewMode}</span>
          <div className="flex gap-1">
            {['result', 'flow', 'ai'].map((m) => (
              <button key={m} type="button" onClick={() => setViewMode(m)} className={`px-1.5 py-0.5 rounded text-[9px] ${viewMode === m ? 'bg-blue-500 text-white' : 'text-blue-600 hover:bg-blue-50'}`}>{viewLabels[m]}</button>
            ))}
          </div>
        </div>
        <div className="flex-1 min-h-0 flex gap-2 p-2 overflow-auto">
          {viewMode === 'result' && (
            <>
              <pre className="flex-1 min-w-0 text-[11px] font-mono bg-[#111827] text-[#e5e7eb] p-2 rounded overflow-auto whitespace-pre-wrap break-all">{execResult || '输入指令并点击「开始系统定位测试」'}</pre>
              {captureImage && <img src={captureImage} alt="截屏" className="max-h-48 object-contain rounded border" />}
            </>
          )}
          {viewMode === 'flow' && (
            <div className="flex-1 min-w-0 overflow-auto space-y-2">
              {flowSteps.length ? flowSteps.map((item, i) => (
                <div key={i} className={`text-[11px] rounded p-2 border ${item.success ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}`}>
                  <div className="font-medium">{i + 1}. {item.action || item.tool} {item.success ? '✓' : '✗'}</div>
                  <div className="text-[10px] text-[var(--input-placeholder)]">工具: {item.tool}</div>
                  {item.image && <img src={item.image} alt="" className="mt-1.5 max-h-32 object-contain rounded border" />}
                  {item.result && (
                    <pre className="mt-1 text-[10px] font-mono bg-black/5 p-1.5 rounded overflow-x-auto whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
                      {JSON.stringify(item.result, null, 2)}
                    </pre>
                  )}
                </div>
              )) : <div className="text-[11px] text-[var(--input-placeholder)]">执行后将显示操作流程</div>}
            </div>
          )}
          {viewMode === 'ai' && (
            <pre className="flex-1 min-w-0 text-[11px] font-mono bg-[#111827] text-[#e5e7eb] p-2 rounded overflow-auto whitespace-pre-wrap break-all">{aiRaw || '—'}</pre>
          )}
        </div>
      </div>
    </div>
  );
}
