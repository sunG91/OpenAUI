/**
 * GUI 模拟工具（nut.js）：鼠标、键盘、截屏
 * AI 测试：用户语言 → 任务拆分(Plan) → 视觉识别 → 获取坐标 → 审核 → 执行
 */
import { useState, useRef, useEffect } from 'react';
import {
  guiMouseMove,
  guiMouseClick,
  guiKeyboardType,
  guiScreenCapture,
  guiScreenSize,
  visionLocate,
  visionLocateVerify,
  visionClickVerify,
} from '../../../api/tools';
import { getConfigSection, updateConfigSection } from '../../../api/config';
import { testModel, testModelStream } from '../../../api/modelTest';
import { getSkillSettings } from '../../../api/settings';
import { MODEL_VENDORS, VENDOR_MODELS, VISION_TAGS } from '../../../data/modelVendors';
import { drawMarkerOnImage, drawNineGridOnImage } from '../../../utils/guiVision';
import { GUI_VISION_PROMPTS, DEFAULT_PROMPT_ID, getPromptById } from '../../../utils/guiVisionPrompts';

function getFirstModelId(vid) {
  const list = VENDOR_MODELS[vid] || [];
  return list[0]?.id ?? '';
}

/** 获取有视觉能力的厂商和模型 */
function getVisionVendorsAndModels() {
  return MODEL_VENDORS.filter((v) => {
    const list = VENDOR_MODELS[v.id] || [];
    return list.some((m) => m.tags?.some((t) => VISION_TAGS.includes(t)));
  }).map((v) => ({
    ...v,
    models: (VENDOR_MODELS[v.id] || []).filter((m) => m.tags?.some((t) => VISION_TAGS.includes(t))),
  }));
}

/** 获取视觉定位用的 vendorId + modelId（vision_locate 需视觉模型，否则报 image_url 错误） */
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

const TABS = [
  { id: 'view', label: '查看' },
  { id: 'test', label: '测试' },
  { id: 'simulate', label: '模拟测试' },
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

const GUI_PLAN_SCHEMA = `
请将用户的自然语言目标拆分为可执行的 GUI 步骤计划。

tool 必须从以下列表精确选择：
gui_screen_capture, vision_locate, gui_mouse_click, gui_mouse_move, gui_keyboard_type

流程规则：
- 若需点击屏幕某元素（如×、按钮、关闭等）：gui_screen_capture → vision_locate(prompt 填目标描述) → gui_mouse_click。点击会先移动鼠标、截屏验证位置、正确后再单击/双击。
- 若需双击（打开文件、选中文字等）：gui_mouse_click 步骤加 doubleClick: true
- 若仅截屏：gui_screen_capture
- 若仅移动鼠标：gui_mouse_move(x,y)
- 若仅键盘输入：gui_keyboard_type(text)

输出格式（仅 JSON）：
{"goal":"用户目标简述","steps":[{"step":1,"action":"截屏","tool":"gui_screen_capture"},{"step":2,"action":"定位×按钮","tool":"vision_locate","prompt":"×关闭按钮"},{"step":3,"action":"点击","tool":"gui_mouse_click"}]}
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
      <div className={`flex-1 min-h-0 flex flex-col p-4 ${tab === 'test' || tab === 'simulate' || tab === 'ai' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        {tab === 'view' && <GuiToolsView />}
        {tab === 'test' && (
          <div className="flex-1 min-h-0 overflow-hidden">
            <GuiToolsTest />
          </div>
        )}
        {tab === 'simulate' && (
          <div className="flex-1 min-h-0 overflow-hidden">
            <GuiSimulateTest />
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
  const [guiProvider, setGuiProvider] = useState('nut');
  const [guiExecutor, setGuiExecutor] = useState('backend');
  const [saving, setSaving] = useState(false);
  const isElectron = typeof window !== 'undefined' && window.electronAPI?.guiNode;

  useEffect(() => {
    getConfigSection('tools').then((t) => {
      setGuiProvider(t?.guiProvider || 'nut');
      setGuiExecutor(t?.guiExecutor || 'backend');
    }).catch(() => {});
  }, []);

  const handleProviderChange = async (p) => {
    setSaving(true);
    try {
      await updateConfigSection('tools', { guiProvider: p });
      setGuiProvider(p);
    } finally {
      setSaving(false);
    }
  };

  const handleExecutorChange = async (e) => {
    setSaving(true);
    try {
      await updateConfigSection('tools', { guiExecutor: e });
      setGuiExecutor(e);
      const { refreshGuiExecutorCache } = await import('../../../api/tools');
      refreshGuiExecutorCache?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="text-sm space-y-3 text-[var(--skill-btn-text)]">
      <h3 className="text-base font-semibold text-[var(--skill-btn-text)]">GUI 模拟工具说明</h3>

      {isElectron && (
        <div className="rounded-lg border border-[var(--input-bar-border)] bg-[#f0f9ff] p-3">
          <div className="text-xs font-medium text-[var(--input-placeholder)] mb-2">执行位置</div>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="guiExecutor"
                checked={guiExecutor === 'backend'}
                onChange={() => handleExecutorChange('backend')}
                disabled={saving}
                className="rounded border-[var(--input-bar-border)] text-blue-500 focus:ring-blue-400"
              />
              <span>后端执行</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="guiExecutor"
                checked={guiExecutor === 'node'}
                onChange={() => handleExecutorChange('node')}
                disabled={saving}
                className="rounded border-[var(--input-bar-border)] text-blue-500 focus:ring-blue-400"
              />
              <span>节点执行</span>
            </label>
            <span className="text-xs text-[var(--input-placeholder)]">节点 = Electron 主进程执行，便于后端远程部署</span>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-[var(--input-bar-border)] bg-[#f8f9fa] p-3">
        <div className="text-xs font-medium text-[var(--input-placeholder)] mb-2">鼠标/键盘引擎</div>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="guiProvider"
              checked={guiProvider === 'nut'}
              onChange={() => handleProviderChange('nut')}
              disabled={saving}
              className="rounded border-[var(--input-bar-border)] text-blue-500 focus:ring-blue-400"
            />
            <span>nut.js</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="guiProvider"
              checked={guiProvider === 'robotjs'}
              onChange={() => handleProviderChange('robotjs')}
              disabled={saving}
              className="rounded border-[var(--input-bar-border)] text-blue-500 focus:ring-blue-400"
            />
            <span>RobotJS</span>
          </label>
          <span className="text-xs text-[var(--input-placeholder)]">配置已保存至 backend/data/config.json</span>
        </div>
      </div>

      <p className="text-[var(--input-placeholder)]">
        基于 <strong>nut.js</strong> 或 <strong>robotjs</strong> 实现鼠标移动、点击、键盘输入；截屏使用 <strong>screenshot-desktop</strong>。
        需在 backend 目录执行 <code className="px-1 bg-[#f0f0f0] rounded">npm install @nut-tree/nut-js screenshot-desktop</code> 或 <code className="px-1 bg-[#f0f0f0] rounded">npm install robotjs screenshot-desktop</code> 安装依赖。
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

function GuiSimulateTest() {
  const imgRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [gridImage, setGridImage] = useState('');
  const [imgSize, setImgSize] = useState(null);
  const [nutSize, setNutSize] = useState(null);
  const [error, setError] = useState('');
  const [showRatio, setShowRatio] = useState(true);
  const [showCoords, setShowCoords] = useState(true);
  const [clickResult, setClickResult] = useState(null);
  const [clicking, setClicking] = useState(false);
  const [manualX, setManualX] = useState('');
  const [manualY, setManualY] = useState('');
  const [visionVendorId, setVisionVendorId] = useState('');
  const [visionModelId, setVisionModelId] = useState('');
  const [visionPromptPresetId, setVisionPromptPresetId] = useState(DEFAULT_PROMPT_ID);
  const [visionPrompt, setVisionPrompt] = useState(() => getPromptById(DEFAULT_PROMPT_ID));
  const [visionResult, setVisionResult] = useState('');
  const [visionLoading, setVisionLoading] = useState(false);
  const visionOptions = getVisionVendorsAndModels();
  const selectedVendor = visionOptions.find((v) => v.id === visionVendorId) || visionOptions[0];
  const visionModelsList = selectedVendor?.models || [];

  const handleCaptureWithGrid = async () => {
    setLoading(true);
    setError('');
    setGridImage('');
    setImgSize(null);
    setNutSize(null);
    setClickResult(null);
    try {
      const data = await guiScreenCapture();
      if (!data?.image) {
        setError('截屏失败');
        return;
      }
      const w = data.screenWidth ?? 0;
      const h = data.screenHeight ?? 0;
      if (w > 0 && h > 0) setImgSize({ width: w, height: h });
      let nut = null;
      try {
        nut = await guiScreenSize();
      } catch (_) {}
      const nw = nut?.width ?? w;
      const nh = nut?.height ?? h;
      if (nw > 0 && nh > 0) setNutSize({ width: nw, height: nh });
      const withGrid = await drawNineGridOnImage(data.image, {
        nutSize: { width: nw, height: nh },
        showRatio,
        showCoords,
      });
      setGridImage(withGrid);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleImageClick = async (e) => {
    const img = imgRef.current;
    if (!img || !imgSize || !nutSize) return;
    const rect = img.getBoundingClientRect();
    const nw = img.naturalWidth || imgSize.width;
    const nh = img.naturalHeight || imgSize.height;
    const scaleX = nw / rect.width;
    const scaleY = nh / rect.height;
    const imgX = (e.clientX - rect.left) * scaleX;
    const imgY = (e.clientY - rect.top) * scaleY;
    const nutX = Math.round(imgX * (nutSize.width / imgSize.width));
    const nutY = Math.round(imgY * (nutSize.height / imgSize.height));
    setClickResult({
      imgX: Math.round(imgX),
      imgY: Math.round(imgY),
      nutX,
      nutY,
      imgSize: `${imgSize.width}×${imgSize.height}`,
      nutSize: `${nutSize.width}×${nutSize.height}`,
      needConvert: nutSize.width !== imgSize.width || nutSize.height !== imgSize.height,
    });
  };

  const handleExecuteClick = async () => {
    if (clickResult?.nutX == null || clickResult?.nutY == null) return;
    setClicking(true);
    try {
      await guiMouseClick({ x: clickResult.nutX, y: clickResult.nutY });
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setClicking(false);
    }
  };

  const handleManualClick = async () => {
    const x = Number(manualX);
    const y = Number(manualY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      setError('请输入有效坐标');
      return;
    }
    setClicking(true);
    setError('');
    try {
      await guiMouseClick({ x, y });
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setClicking(false);
    }
  };

  const handleVisionChat = async () => {
    if (!gridImage) {
      setVisionResult('请先点击截图获取带网格的图片');
      return;
    }
    const vid = visionVendorId || visionOptions[0]?.id;
    const mid = visionModelId || visionModelsList[0]?.id;
    if (!vid || !mid) {
      setVisionResult('无可用的视觉模型，请配置硅基流动/火山引擎等');
      return;
    }
    const modelMeta = (VENDOR_MODELS[vid] || []).find((m) => m.id === mid);
    const useStream = modelMeta?.stream !== false;
    setVisionLoading(true);
    setVisionResult('');
    try {
      let promptText = visionPrompt;
      if (nutSize?.width != null && nutSize?.height != null) {
        promptText = `【坐标范围】x: 0~${nutSize.width}，y: 0~${nutSize.height}。请严格按图上顶部和左侧的刻度数字取值，不得超出范围。\n\n` + promptText;
      }
      const messages = [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: gridImage, detail: 'high' } },
            { type: 'text', text: promptText },
          ],
        },
      ];
      const payload = { vendorId: vid, modelId: mid, messages };
      if (useStream) {
        let accumulated = '';
        await testModelStream(
          { ...payload, stream: true },
          {
            onChunk: ({ reasoning_content = '', content = '' }) => {
              accumulated += reasoning_content + content;
              setVisionResult(accumulated);
            },
            onDone: (err) => {
              if (err) setVisionResult(`识别失败：${err?.message || String(err)}`);
              setVisionLoading(false);
            },
          }
        );
      } else {
        const data = await testModel({ ...payload, stream: false });
        const text = (data?.reasoning_content ?? '') + (data?.content ?? '');
        setVisionResult(text || '（无返回内容）');
        setVisionLoading(false);
      }
    } catch (e) {
      setVisionResult(`识别失败：${e?.message || String(e)}`);
      setVisionLoading(false);
    }
  };

  useEffect(() => {
    const v = visionOptions[0];
    if (v && !visionVendorId) {
      setVisionVendorId(v.id);
      setVisionModelId(v.models?.[0]?.id ?? '');
    }
  }, [visionOptions.length, visionVendorId]);

  const handleVisionPresetChange = (presetId) => {
    setVisionPromptPresetId(presetId);
    const p = getPromptById(presetId);
    if (p) setVisionPrompt(p);
  };

  return (
    <div className="flex flex-col h-full min-h-0 gap-3">
      <div className="flex-shrink-0 rounded-lg border border-[var(--input-bar-border)] bg-white p-3">
        <div className="text-xs font-medium text-[var(--input-placeholder)] mb-2">截屏并绘制网格（按 nut.js 比例拆分，坐标即 nut 可点击值）</div>
        <div className="flex flex-wrap gap-2 items-center">
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={showRatio} onChange={(e) => setShowRatio(e.target.checked)} />
            <span className="text-[10px]">比例</span>
          </label>
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={showCoords} onChange={(e) => setShowCoords(e.target.checked)} />
            <span className="text-[10px]">坐标（上/左）</span>
          </label>
          <button
            type="button"
            onClick={handleCaptureWithGrid}
            disabled={loading}
            className="px-3 py-1.5 rounded text-[11px] font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? '截图中…' : '点击截图'}
          </button>
          {error && <span className="text-[11px] text-red-600">{error}</span>}
        </div>
      </div>
      <div className="flex-1 min-h-0 flex flex-col rounded-lg border border-[var(--input-bar-border)] bg-white overflow-hidden">
        <div className="flex-shrink-0 px-2 py-1.5 border-b bg-[#f8f9fa] text-[10px] font-medium text-[var(--input-placeholder)] flex justify-between items-center">
          <span>网格预览（点击图片获取 nut.js 可点击坐标）</span>
          {clickResult && (
            <span className="text-amber-700 font-mono">
              nut 坐标: ({clickResult.nutX}, {clickResult.nutY})
            </span>
          )}
        </div>
        <div className="flex-1 min-h-0 p-2 flex flex-col gap-2 bg-[#fafafa] overflow-hidden">
          <div className="flex-1 min-h-0 flex items-center justify-center overflow-auto">
            {gridImage ? (
              <img
                ref={imgRef}
                src={gridImage}
                alt="网格截图"
                className="max-w-full max-h-full object-contain rounded border border-[var(--input-bar-border)] cursor-crosshair"
                onClick={handleImageClick}
              />
            ) : (
              <span className="text-xs text-[var(--input-placeholder)]">点击「点击截图」截取屏幕，网格按 nut.js 比例绘制，坐标即 nut 可点击值</span>
            )}
          </div>
          {clickResult && (
            <div className="flex-shrink-0 flex flex-wrap gap-2 items-center px-2 py-1.5 rounded bg-amber-50 border border-amber-200">
              <span className="text-[11px]">图片 {clickResult.imgSize} 坐标: ({clickResult.imgX}, {clickResult.imgY})</span>
              <span className="text-[11px]">nut.js {clickResult.nutSize} 坐标: ({clickResult.nutX}, {clickResult.nutY})</span>
              <button
                type="button"
                onClick={handleExecuteClick}
                disabled={clicking}
                className="px-2 py-1 rounded text-[10px] font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {clicking ? '点击中…' : '执行点击'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 rounded-lg border border-[var(--input-bar-border)] bg-white p-3 space-y-2">
        <div className="text-xs font-medium text-[var(--input-placeholder)]">输入坐标模拟点击</div>
        <div className="flex flex-wrap gap-2 items-center">
          <input type="number" value={manualX} onChange={(e) => setManualX(e.target.value)} placeholder="x" className="w-16 px-1.5 py-1 text-[11px] border rounded font-mono" />
          <input type="number" value={manualY} onChange={(e) => setManualY(e.target.value)} placeholder="y" className="w-16 px-1.5 py-1 text-[11px] border rounded font-mono" />
          <button type="button" onClick={handleManualClick} disabled={clicking} className="px-2 py-1 rounded text-[10px] font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
            {clicking ? '点击中…' : '模拟点击'}
          </button>
        </div>
      </div>

      <div className="flex-shrink-0 rounded-lg border border-[var(--input-bar-border)] bg-white p-3 space-y-2">
        <div className="text-xs font-medium text-[var(--input-placeholder)]">视觉识别对话（传递带网格的图）</div>
        <div className="flex flex-wrap gap-2 items-center">
          <select value={visionVendorId} onChange={(e) => { setVisionVendorId(e.target.value); setVisionModelId(''); }} className="px-1.5 py-1 text-[11px] border rounded">
            {visionOptions.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
          <select value={visionModelId} onChange={(e) => setVisionModelId(e.target.value)} className="px-1.5 py-1 text-[11px] border rounded min-w-[140px]">
            {visionModelsList.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <select value={visionPromptPresetId} onChange={(e) => handleVisionPresetChange(e.target.value)} className="px-1.5 py-1 text-[11px] border rounded min-w-[100px]" title="提示词预设">
            {GUI_VISION_PROMPTS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
          <input type="text" value={visionPrompt} onChange={(e) => setVisionPrompt(e.target.value)} placeholder={visionPromptPresetId === 'custom' ? '自定义提示词' : '可编辑当前预设'} className="flex-1 min-w-[180px] px-1.5 py-1 text-[11px] border rounded" />
          <button type="button" onClick={handleVisionChat} disabled={visionLoading || !gridImage} className="px-2 py-1 rounded text-[10px] font-medium bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50">
            {visionLoading ? '识别中…' : '视觉对话'}
          </button>
        </div>
        {visionResult && (
          <div className="flex-shrink-0 rounded border border-[var(--input-bar-border)] bg-[#f8f9fa] p-2 max-h-32 overflow-auto">
            <pre className="text-[11px] whitespace-pre-wrap break-words">{visionResult}</pre>
          </div>
        )}
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
  const [nutScreenSize, setNutScreenSize] = useState(null); // nut.js 屏幕尺寸

  const fetchNutScreenSize = async () => {
    try {
      const data = await guiScreenSize();
      if (data?.width != null && data?.height != null) {
        setNutScreenSize({ width: data.width, height: data.height });
      }
    } catch (e) {
      setResult(`获取 nut.js 屏幕尺寸失败：${e?.message || String(e)}`);
    }
  };

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
      <div className="flex-shrink-0 flex flex-wrap gap-2 items-center px-1">
        <button type="button" onClick={fetchNutScreenSize} disabled={loading} className="px-2 py-1 rounded text-[10px] font-medium bg-slate-500 text-white hover:bg-slate-600 disabled:opacity-50">
          获取 nut.js 屏幕尺寸
        </button>
        {nutScreenSize && (
          <span className="text-[11px] text-amber-700 font-medium">
            nut.js 屏幕：{nutScreenSize.width}×{nutScreenSize.height}
            <span className="text-[10px] text-[var(--input-placeholder)] ml-1">（鼠标移动用此坐标系，与截屏 PNG 不一致时需坐标换算）</span>
          </span>
        )}
      </div>
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

/** 序列化 result 用于展示，排除 base64 图片 */
function resultForDisplay(result) {
  if (!result) return '';
  if (typeof result !== 'object') return String(result);
  const copy = { ...result };
  if (copy.image) copy.image = '[截图已省略，见下方预览]';
  if (copy.screenCapture) copy.screenCapture = '[截图已省略，见下方预览]';
  if (Array.isArray(copy.moveVerifyAudits)) copy.moveVerifyAudits = copy.moveVerifyAudits.map((a) => ({ ...a, image: a.image ? '[图]' : undefined }));
  if (Array.isArray(copy.clickVerifyAudits)) copy.clickVerifyAudits = copy.clickVerifyAudits.map((a) => ({ ...a, image: a.image ? '[图]' : undefined }));
  return JSON.stringify(copy, null, 2);
}

/** 操作流程条目 */
function FlowItem({ item, index }) {
  const { step, action, tool, success, result, audit, image, moveVerifyAudits, clickVerifyAudits } = item;
  const hasAudit = audit != null;
  const imgSrc = image || result?.image || result?.screenCapture;
  return (
    <div className={`text-[11px] rounded p-2 border ${success ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}`}>
      <div className="font-medium text-[var(--skill-btn-text)]">
        {index + 1}. {action || tool} {success ? '✓' : '✗'}
      </div>
      <div className="text-[10px] text-[var(--input-placeholder)] mt-0.5">工具: {tool}</div>
      {imgSrc && !moveVerifyAudits?.length && !clickVerifyAudits?.length && (
        <img src={imgSrc} alt={`步骤${index + 1}截图`} className="mt-1.5 max-h-32 object-contain rounded border border-[var(--input-bar-border)]" />
      )}
      {moveVerifyAudits?.length > 0 && (
        <div className="mt-1.5 space-y-2">
          <div className="text-[10px] font-medium text-amber-700">移动→截屏→验证 循环</div>
          {moveVerifyAudits.map((a, j) => (
            <div key={j} className="rounded border border-amber-200 bg-amber-50/50 p-1.5">
              <div className="text-[10px]">第{a.attempt}轮: 移至({a.x},{a.y}) {a.correct ? '✓ 位置正确' : '→ 已修正'}</div>
              {a.image && <img src={a.image} alt={`第${a.attempt}轮`} className="mt-1 max-h-24 object-contain rounded border" />}
            </div>
          ))}
        </div>
      )}
      {clickVerifyAudits?.length > 0 && (
        <div className="mt-1.5 space-y-2">
          <div className="text-[10px] font-medium text-blue-700">点击→截屏→效果校验 循环</div>
          {clickVerifyAudits.map((a, j) => (
            <div key={j} className="rounded border border-blue-200 bg-blue-50/50 p-1.5">
              <div className="text-[10px]">第{a.attempt}轮: {a.effectOk ? '✓ 点击生效' : '→ 未生效，已微调重试'}</div>
              {a.image && <img src={a.image} alt={`点击后第${a.attempt}轮`} className="mt-1 max-h-24 object-contain rounded border" />}
            </div>
          ))}
        </div>
      )}
      {result && (
        <pre className="mt-1 text-[10px] font-mono bg-black/5 p-1.5 rounded overflow-x-auto whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
          {resultForDisplay(result)}
        </pre>
      )}
      {hasAudit && (
        <div className="mt-1 text-[10px] text-amber-700">
          审核: {audit.correct ? '坐标正确' : `已修正为 (${audit.x}, ${audit.y})`}
        </div>
      )}
    </div>
  );
}

function GuiAiTestView() {
  const [instruction, setInstruction] = useState('点击屏幕中的×，关闭当前应用');
  const [vendorId, setVendorId] = useState(MODEL_VENDORS[0]?.id ?? '');
  const [modelId, setModelId] = useState(() => getFirstModelId(MODEL_VENDORS[0]?.id ?? ''));
  const [loading, setLoading] = useState(false);
  const [aiRaw, setAiRaw] = useState('');
  const [execResult, setExecResult] = useState('');
  const [viewMode, setViewMode] = useState('result'); // result | flow | ai
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
    setViewMode('result');
    const flow = [];
    try {
      let vid = vendorId;
      let mid = modelId;
      const settings = await getSkillSettings().catch(() => ({}));
      const q = settings?.quick || {};
      if (q.vendorId && q.modelId) { vid = q.vendorId; mid = q.modelId; }

      // 1. 生成 Plan
      const planMsg = `用户指令：${prompt}\n\n${GUI_PLAN_SCHEMA}\n请根据用户指令输出步骤计划，仅输出 JSON，不要 markdown。`;
      const planRes = await testModel({ vendorId: vid, modelId: mid, message: planMsg });
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
      let steps = plan?.steps || [];
      if (!steps.length && plan?.tool) {
        steps = [{ step: 1, action: plan.tool, tool: plan.tool, ...plan }];
      }
      if (!steps.length) {
        setExecResult(`Plan 无有效步骤：\n${JSON.stringify(plan, null, 2)}`);
        setLoading(false);
        return;
      }

      let lastImage = null;
      let lastX = null;
      let lastY = null;
      let locatePrompt = '';

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
        } else if (tool === 'vision_locate') {
          const img = lastImage || (await guiScreenCapture()).image;
          if (!img) {
            flow.push({ step: i + 1, action, tool, success: false, result: { error: '无截屏，请先 gui_screen_capture' } });
            continue;
          }
          locatePrompt = s.prompt || prompt;
          const { vendorId: visionVid, modelId: visionMid } = getVisionModelForLocate(vendorId, vid, mid);
          const locateRes = await visionLocate({
            image: img,
            prompt: locatePrompt,
            vendorId: visionVid,
            modelId: visionMid,
          });
          if (locateRes?.x != null && locateRes?.y != null) {
            lastX = locateRes.x;
            lastY = locateRes.y;
            flow.push({ step: i + 1, action, tool, success: true, result: { x: lastX, y: lastY }, image: img });
          } else {
            flow.push({ step: i + 1, action, tool, success: false, result: locateRes || { error: '视觉定位未返回坐标' }, image: img });
          }
        } else if (tool === 'gui_mouse_click') {
          let clickX = lastX ?? s.x;
          let clickY = lastY ?? s.y;
          const doubleClick = s.doubleClick === true || /双击|双点|double/i.test(String(s.action || ''));
          const { vendorId: visionVid, modelId: visionMid } = getVisionModelForLocate(vendorId, vid, mid);
          const moveVerifyAudits = [];

          // 移动→截屏→验证 循环：直到位置正确或达到最大重试
          if (clickX != null && clickY != null && locatePrompt) {
            const MAX_MOVE_VERIFY = 5;
            for (let attempt = 0; attempt < MAX_MOVE_VERIFY; attempt++) {
              await guiMouseMove(Number(clickX), Number(clickY));
              await new Promise((r) => setTimeout(r, 150));
              const freshCap = await guiScreenCapture();
              const freshImg = freshCap?.image;
              if (!freshImg) {
                moveVerifyAudits.push({ attempt: attempt + 1, action: 'move', result: { error: '截屏失败' } });
                break;
              }
              const annotated = await drawMarkerOnImage(freshImg, clickX, clickY);
              const verifyRes = await visionLocateVerify({
                image: annotated,
                prompt: locatePrompt,
                vendorId: visionVid,
                modelId: visionMid,
              });
              moveVerifyAudits.push({
                attempt: attempt + 1,
                action: 'move_verify',
                correct: verifyRes?.correct,
                x: clickX,
                y: clickY,
                image: freshImg,
              });
              setFlowSteps([...flow, { step: i + 1, action: `点击（验证第${attempt + 1}轮）`, tool, moveVerifyAudits: [...moveVerifyAudits] }]);
              if (verifyRes?.correct === true) break;
              if (verifyRes?.correct === false && verifyRes?.x != null && verifyRes?.y != null) {
                clickX = verifyRes.x;
                clickY = verifyRes.y;
              } else break;
            }
          }

          const opts = { button: (s.button || 'left').toLowerCase(), doubleClick };
          if (clickX != null && clickY != null) { opts.x = Number(clickX); opts.y = Number(clickY); }
          const clickVerifyAudits = [];
          const MAX_CLICK_VERIFY = 3;
          let clickSuccess = false;
          for (let cv = 0; cv < MAX_CLICK_VERIFY; cv++) {
            if (cv > 0 && clickX != null && clickY != null) {
              clickX += Math.round((Math.random() - 0.5) * 12);
              clickY += Math.round((Math.random() - 0.5) * 12);
              opts.x = Number(clickX);
              opts.y = Number(clickY);
              await guiMouseMove(clickX, clickY);
              await new Promise((r) => setTimeout(r, 150));
            }
            const clickRes = await guiMouseClick(opts);
            await new Promise((r) => setTimeout(r, 280));
            const afterCap = await guiScreenCapture();
            const afterImg = afterCap?.image;
            let effectOk = false;
            if (afterImg && locatePrompt) {
              const effectRes = await visionClickVerify({
                image: afterImg,
                prompt: locatePrompt,
                vendorId: visionVid,
                modelId: visionMid,
              });
              effectOk = effectRes?.success === true;
              clickVerifyAudits.push({
                attempt: cv + 1,
                clickSuccess: clickRes?.success !== false,
                effectOk,
                image: afterImg,
              });
              setFlowSteps([...flow, { step: i + 1, action: `点击（效果校验第${cv + 1}轮）`, tool, moveVerifyAudits: moveVerifyAudits.length ? moveVerifyAudits : undefined, clickVerifyAudits: [...clickVerifyAudits] }]);
            }
            if (effectOk || !locatePrompt) {
              clickSuccess = true;
              break;
            }
          }
          flow.push({
            step: i + 1,
            action,
            tool,
            success: clickSuccess,
            result: { success: clickSuccess, moveVerifyAudits: moveVerifyAudits.length ? moveVerifyAudits : undefined, clickVerifyAudits: clickVerifyAudits.length ? clickVerifyAudits : undefined },
            moveVerifyAudits: moveVerifyAudits.length ? moveVerifyAudits : undefined,
            clickVerifyAudits: clickVerifyAudits.length ? clickVerifyAudits : undefined,
          });
        } else if (tool === 'gui_mouse_move') {
          const x = Number(s.x) ?? lastX ?? 0;
          const y = Number(s.y) ?? lastY ?? 0;
          const res = await guiMouseMove(x, y);
          flow.push({ step: i + 1, action, tool, success: true, result: res });
        } else if (tool === 'gui_keyboard_type') {
          const res = await guiKeyboardType(s.text ?? '');
          flow.push({ step: i + 1, action, tool, success: true, result: res });
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

  const viewLabels = { result: '执行结果', flow: '操作流程', ai: 'AI 原始输出' };

  return (
    <div className="flex flex-col h-full min-h-0 gap-3">
      <div className="flex-shrink-0 rounded-lg border border-[var(--input-bar-border)] bg-white p-3 space-y-2">
        <div className="text-xs font-medium text-[var(--input-placeholder)]">自然语言指令（AI 将自动拆分任务、视觉识别、审核坐标、执行）</div>
        <div className="text-[10px] text-amber-600">vision_locate 需视觉模型，将自动使用 {getVisionModelForLocate(vendorId, vendorId, modelId).modelId}</div>
        <input type="text" value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="例如：点击屏幕中的×关闭应用、截屏、输入 Hello" className="w-full px-2 py-1.5 text-[11px] border rounded focus:ring-1 focus:ring-blue-400 outline-none" />
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
              <pre className="flex-1 min-w-0 text-[11px] font-mono bg-[#111827] text-[#e5e7eb] p-2 rounded overflow-auto whitespace-pre-wrap break-all">{execResult || '输入指令并点击「开始 AI 测试」'}</pre>
              {captureImage && <img src={captureImage} alt="截屏" className="max-h-48 object-contain rounded border" />}
            </>
          )}
          {viewMode === 'flow' && (
            <div className="flex-1 min-w-0 overflow-auto space-y-2">
              {flowSteps.length ? flowSteps.map((item, i) => <FlowItem key={i} item={item} index={i} />) : <div className="text-[11px] text-[var(--input-placeholder)]">执行后将显示操作流程与试错记录</div>}
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
