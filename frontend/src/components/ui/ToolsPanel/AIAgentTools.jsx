/**
 * AI 智能体测试模块（模块化）
 * 通过自然语言控制：GUI 模拟、控制台、系统操作、浏览器、本地视觉检测
 * 可操作用户电脑，支持截屏→检测→模拟点击等流程
 */
import { useState, useEffect } from 'react';
import {
  guiMouseMove,
  guiMouseClick,
  guiKeyboardType,
  guiScreenCapture,
  runShell,
  getToolsPlatform,
  getToolsProjectRoot,
  systemFsList,
  systemFsReadText,
  systemFsWriteText,
  systemProcessList,
  systemProcessKill,
  browserNavigate,
  browserClick,
  browserType,
  browserScreenshot,
  browserDomInteractive,
  browserScroll,
  browserExecute,
  visionListModels,
  visionDetect,
} from '../../../api/tools';
import { testModel } from '../../../api/modelTest';
import { getSkillSettings } from '../../../api/settings';
import { MODEL_VENDORS, VENDOR_MODELS } from '../../../data/modelVendors';

function getFirstModelId(vid) {
  const list = VENDOR_MODELS[vid] || [];
  return list[0]?.id ?? '';
}

function resolvePath(trimmed, projectRoot) {
  if (!trimmed) return projectRoot || '.';
  if (pathIsAbsolute(trimmed)) return trimmed;
  const base = (projectRoot || '').replace(/\\/g, '/');
  const rel = trimmed.replace(/^\/+/, '');
  return base ? `${base}/${rel}` : rel;
}

function pathIsAbsolute(p) {
  if (!p || typeof p !== 'string') return false;
  if (p.startsWith('/')) return true;
  if (/^[A-Za-z]:[\\/]/.test(p)) return true;
  return false;
}

/** YOLOv8 COCO 80 类名称，用于可读的检测结果 */
const COCO_CLASS_NAMES = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat',
  'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat', 'dog', 'horse', 'sheep', 'cow',
  'elephant', 'bear', 'zebra', 'giraffe', 'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee',
  'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard', 'tennis racket',
  'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple', 'sandwich', 'orange',
  'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch', 'potted plant', 'bed',
  'dining table', 'toilet', 'tv', 'laptop', 'mouse', 'remote', 'keyboard', 'cell phone', 'microwave', 'oven',
  'toaster', 'sink', 'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush',
];

const AGENT_TOOL_SCHEMA = `
可选工具（输出 JSON，仅一个 tool 调用；根据用户指令选择最合适的工具）：

重要：当用户询问「屏幕内容、布局、描述、有什么」时，必须用 vision_screen_detect（截屏+YOLO检测），系统会根据检测结果自动生成自然语言描述。

【GUI 模拟】
- gui_mouse_move: 鼠标移动。参数: x, y (数字)
- gui_mouse_click: 鼠标点击。参数: button(left/right), x(可选), y(可选)
- gui_keyboard_type: 键盘输入。参数: text
- gui_screen_capture: 仅截屏（不检测）。参数: region(可选 "x,y,w,h")

【控制台】
- console_shell: 执行命令。参数: command, cwd(可选)

【系统操作】
- fs_list: 列目录。参数: path
- fs_read_text: 读文件。参数: path
- fs_write_text: 写文件。参数: path, content
- process_list: 进程列表。无参数
- process_kill: 结束进程。参数: pid (慎用)

【浏览器】
- browser_navigate: 打开页面。参数: url
- browser_click: 点击元素。参数: url, selector
- browser_type: 输入文本。参数: url, selector, text
- browser_screenshot: 页面截屏。参数: url
- browser_dom_interactive: 解析可交互元素。参数: url
- browser_scroll: 滚动。参数: url, x, y
- browser_execute: 执行脚本。参数: url, script

【视觉检测】
- vision_screen_detect: 截屏+YOLO检测，用于「描述屏幕、内容、布局」等。参数: modelId(可选)
- vision_detect: 对已有图片检测。参数: image(base64 data URL), modelId(可选)
- gui_click_detection: 根据检测结果点击。参数: index(0起)，需先执行 vision_screen_detect

输出格式（仅输出 JSON，不要 markdown）：
{"tool":"工具名","x":0,"y":0,"button":"left","text":"","region":"","command":"","cwd":"","path":"","content":"","pid":0,"url":"","selector":"","script":"","modelId":"","image":"","index":0}
`;

const TABS = [
  { id: 'view', label: '查看' },
  { id: 'test', label: 'AI 测试' },
];

export function AIAgentTools() {
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
              ${tab === t.id ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-[var(--input-placeholder)]'}
            `}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className={`flex-1 min-h-0 flex flex-col p-4 ${tab === 'test' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        {tab === 'view' && <AIAgentToolsView />}
        {tab === 'test' && (
          <div className="flex-1 min-h-0 overflow-hidden">
            <AIAgentTestView />
          </div>
        )}
      </div>
    </div>
  );
}

function AIAgentToolsView() {
  return (
    <div className="text-sm space-y-3 text-[var(--skill-btn-text)]">
      <h3 className="text-base font-semibold">AI 智能体测试</h3>
      <p className="text-[var(--input-placeholder)]">
        通过<strong>自然语言</strong>控制电脑：GUI 模拟、控制台、系统操作、浏览器、本地视觉检测。
        支持「截屏→检测→点击」等组合流程。
      </p>
      <div className="rounded-lg border border-[var(--input-bar-border)] bg-[#f8f9fa] p-3 space-y-2">
        <div className="text-xs font-medium text-[var(--input-placeholder)]">可用工具类别</div>
        <ul className="space-y-1 text-xs">
          <li><strong>GUI 模拟</strong> — 鼠标、键盘、截屏</li>
          <li><strong>控制台</strong> — 执行 CMD/Shell 命令</li>
          <li><strong>系统操作</strong> — 文件读写、进程管理</li>
          <li><strong>浏览器</strong> — 打开页面、点击、输入、截屏</li>
          <li><strong>视觉检测</strong> — 截屏 + YOLO 检测，可基于检测结果点击</li>
        </ul>
      </div>
      <div className="rounded-lg border border-[var(--input-bar-border)] bg-[#f8f9fa] p-3">
        <div className="text-xs font-medium text-[var(--input-placeholder)] mb-1.5">示例指令</div>
        <ul className="space-y-1 text-xs text-[var(--skill-btn-text)]">
          <li>• 把鼠标移到 500 300</li>
          <li>• 截屏并检测屏幕上的目标</li>
          <li>• 点击第一个检测到的目标</li>
          <li>• 列出 backend 目录</li>
          <li>• 打开百度并截屏</li>
        </ul>
      </div>
    </div>
  );
}

/** 导出供 VisionTools 等复用 */
export function AIAgentTestView() {
  const [instruction, setInstruction] = useState('截屏并检测屏幕上的目标');
  const [vendorId, setVendorId] = useState(MODEL_VENDORS[0]?.id ?? '');
  const [modelId, setModelId] = useState(() => getFirstModelId(MODEL_VENDORS[0]?.id ?? ''));
  const [loading, setLoading] = useState(false);
  const [aiRaw, setAiRaw] = useState('');
  const [execResult, setExecResult] = useState('');
  const [viewMode, setViewMode] = useState('result');
  const [captureImage, setCaptureImage] = useState('');
  const [lastDetections, setLastDetections] = useState([]);
  const [lastCapturedImage, setLastCapturedImage] = useState('');
  const [visionModels, setVisionModels] = useState([]);
  const [visionModelsLoading, setVisionModelsLoading] = useState(false);
  const [visionModelsError, setVisionModelsError] = useState('');
  const [showRawDetection, setShowRawDetection] = useState(false);
  const [rawToolResult, setRawToolResult] = useState(null);

  const loadVisionModels = async () => {
    setVisionModelsLoading(true);
    setVisionModelsError('');
    try {
      const data = await visionListModels();
      setVisionModels(data.models || []);
    } catch (e) {
      setVisionModelsError(e?.message || String(e));
    } finally {
      setVisionModelsLoading(false);
    }
  };

  useEffect(() => {
    loadVisionModels();
  }, []);

  const run = async () => {
    const prompt = instruction.trim();
    if (!prompt) return;
    setLoading(true);
    setAiRaw('');
    setExecResult('');
    setCaptureImage('');
    setViewMode('result');
    setShowRawDetection(false);
    setRawToolResult(null);
    try {
      let vid = vendorId;
      let mid = modelId;
      const settings = await getSkillSettings().catch(() => ({}));
      const q = settings?.quick || {};
      if (q.vendorId && q.modelId) {
        vid = q.vendorId;
        mid = q.modelId;
      }

      let platformHint = '';
      let projectRoot = '';
      try {
        const platform = await getToolsPlatform();
        if (platform === 'win32') {
          platformHint = '当前为 Windows，命令用 CMD 格式（如 dir、echo）。';
        } else {
          platformHint = '当前为 Unix/Linux/macOS，命令用 bash 格式（如 ls、pwd）。';
        }
      } catch (_) {}
      try {
        projectRoot = await getToolsProjectRoot();
      } catch (_) {}

      const contextParts = [];
      if (lastCapturedImage) contextParts.push('已有上次截屏，vision_detect 可使用。');
      if (lastDetections.length > 0) {
        contextParts.push(`上次检测到 ${lastDetections.length} 个目标，可用 gui_click_detection 的 index 参数点击（0 到 ${lastDetections.length - 1}）。`);
      }

      const message = `用户指令：${prompt}

${platformHint}
${projectRoot ? `项目根目录：${projectRoot}。` : ''}
${contextParts.length ? '上下文：' + contextParts.join(' ') : ''}

${AGENT_TOOL_SCHEMA}

请根据用户指令选择最合适的工具，仅输出一个 JSON 对象，不要 markdown、不要解释。`;

      const modelRes = await testModel({ vendorId: vid, modelId: mid, message });
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
      switch (tool) {
        case 'gui_mouse_move':
          toolResult = await guiMouseMove(Number(obj.x) || 0, Number(obj.y) || 0);
          break;
        case 'gui_mouse_click': {
          const opts = { button: (obj.button || 'left').toLowerCase() };
          if (obj.x != null && obj.y != null) {
            opts.x = Number(obj.x);
            opts.y = Number(obj.y);
          }
          toolResult = await guiMouseClick(opts);
          break;
        }
        case 'gui_keyboard_type':
          toolResult = await guiKeyboardType(obj.text ?? '');
          break;
        case 'gui_screen_capture': {
          toolResult = await guiScreenCapture(obj.region);
          if (toolResult?.image) {
            setLastCapturedImage(toolResult.image);
            setCaptureImage(toolResult.image);
          }
          break;
        }
        case 'console_shell':
          toolResult = await runShell(obj.command ?? '', { cwd: obj.cwd || undefined });
          break;
        case 'fs_list':
          toolResult = await systemFsList(resolvePath(obj.path ?? '', projectRoot));
          break;
        case 'fs_read_text':
          toolResult = await systemFsReadText(resolvePath(obj.path ?? '', projectRoot));
          break;
        case 'fs_write_text':
          toolResult = await systemFsWriteText(resolvePath(obj.path ?? '', projectRoot), obj.content ?? '');
          break;
        case 'process_list':
          toolResult = await systemProcessList();
          break;
        case 'process_kill': {
          const pid = Number(obj.pid);
          if (!Number.isFinite(pid) || pid <= 0) {
            toolResult = { success: false, error: 'pid 不合法' };
          } else if (!window.confirm(`确定结束进程 PID=${pid}？`)) {
            toolResult = { success: false, error: '用户取消' };
          } else {
            toolResult = await systemProcessKill(pid);
          }
          break;
        }
        case 'browser_navigate':
          toolResult = await browserNavigate({ url: obj.url ?? '' });
          break;
        case 'browser_click':
          toolResult = await browserClick({ url: obj.url ?? '', selector: obj.selector ?? '' });
          break;
        case 'browser_type':
          toolResult = await browserType({ url: obj.url ?? '', selector: obj.selector ?? '', text: obj.text ?? '' });
          break;
        case 'browser_screenshot': {
          toolResult = await browserScreenshot({ url: obj.url ?? '' });
          if (toolResult?.image) setCaptureImage(toolResult.image);
          break;
        }
        case 'browser_dom_interactive':
          toolResult = await browserDomInteractive({ url: obj.url ?? '' });
          break;
        case 'browser_scroll':
          toolResult = await browserScroll({ url: obj.url ?? '', x: obj.x ?? 0, y: obj.y ?? 0 });
          break;
        case 'browser_execute':
          toolResult = await browserExecute({ url: obj.url ?? '', script: obj.script ?? 'null' });
          break;
        case 'vision_screen_detect': {
          const cap = await guiScreenCapture();
          if (!cap?.image) {
            toolResult = { success: false, error: '截屏失败' };
            break;
          }
          setLastCapturedImage(cap.image);
          setCaptureImage(cap.image);
          const modelIdToUse = obj.modelId || visionModels[0]?.id;
          const detectRes = await visionDetect({
            image: cap.image,
            modelId: modelIdToUse,
            classNames: COCO_CLASS_NAMES,
          });
          setLastDetections(detectRes.detections || []);
          toolResult = {
            ...detectRes,
            _meta: { modelUsed: detectRes.modelUsed || modelIdToUse, engine: 'YOLO/ONNX' },
          };
          break;
        }
        case 'vision_detect': {
          const img = obj.image || lastCapturedImage;
          if (!img) {
            toolResult = { success: false, error: '无可用图片，请先截屏或使用 vision_screen_detect' };
            break;
          }
          const modelIdToUse = obj.modelId || visionModels[0]?.id;
          const detectRes = await visionDetect({
            image: img,
            modelId: modelIdToUse,
            classNames: COCO_CLASS_NAMES,
          });
          setLastDetections(detectRes.detections || []);
          toolResult = {
            ...detectRes,
            _meta: { modelUsed: detectRes.modelUsed || modelIdToUse, engine: 'YOLO/ONNX' },
          };
          break;
        }
        case 'gui_click_detection': {
          const idx = Number(obj.index) ?? 0;
          const dets = lastDetections;
          if (!dets.length || idx < 0 || idx >= dets.length) {
            toolResult = { success: false, error: `无有效检测结果或 index 越界，当前有 ${dets.length} 个目标` };
            break;
          }
          const d = dets[idx];
          const bbox = d.bbox || [];
          const cx = Math.round(bbox[0] + (bbox[2] || 0) / 2);
          const cy = Math.round(bbox[1] + (bbox[3] || 0) / 2);
          toolResult = await guiMouseClick({ x: cx, y: cy });
          break;
        }
        default:
          toolResult = { success: false, error: `未知工具：${tool}` };
      }

      let detectionsForSynthesis = toolResult?.detections || [];
      if (tool === 'gui_screen_capture' && toolResult?.image && /告诉我|描述|内容|布局|有什么|分析/.test(prompt)) {
        try {
          const dr = await visionDetect({ image: toolResult.image, modelId: visionModels[0]?.id, classNames: COCO_CLASS_NAMES });
          detectionsForSynthesis = dr.detections || [];
        } catch (_) {}
      }

      const isVisionTool = tool === 'vision_screen_detect' || tool === 'vision_detect';
      const needsSynthesis = detectionsForSynthesis.length > 0 && (isVisionTool || /告诉我|描述|内容|布局|有什么|分析|说说|看看/.test(prompt));
      if (needsSynthesis) {
        const formatted = detectionsForSynthesis.map((d, i) => {
          const conf = (d.confidence > 1 ? d.confidence / 1000 : d.confidence) * 100;
          const name = d.className || COCO_CLASS_NAMES[d.class] || `class_${d.class}`;
          return `${i}. ${name} (${Math.round(conf)}%) 位置: x=${d.bbox?.[0] ?? 0} y=${d.bbox?.[1] ?? 0} 宽=${d.bbox?.[2] ?? 0} 高=${d.bbox?.[3] ?? 0}`;
        }).join('\n');
        const synthMsg = `用户的问题是：${prompt}

以下是 YOLO 检测到的屏幕目标（类别、置信度、位置）：
${formatted}

请根据以上检测结果，用自然语言描述屏幕的内容和布局，回答用户的问题。`;
        try {
          const synthRes = await testModel({ vendorId: vid, modelId: mid, message: synthMsg });
          const answer = (synthRes?.content ?? '').trim();
          setExecResult(answer || JSON.stringify(toolResult, null, 2));
          setRawToolResult(toolResult);
          setShowRawDetection(true);
        } catch (e) {
          setExecResult(`合成回答失败：${e?.message || e}\n\n原始结果：\n${JSON.stringify(toolResult, null, 2)}`);
        }
      } else {
        setExecResult(JSON.stringify(toolResult, null, 2));
      }
    } catch (e) {
      setExecResult(`错误：${e?.message || String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 gap-3">
      <div className="flex-shrink-0 rounded-lg border border-[var(--input-bar-border)] bg-white p-3 space-y-2">
        <div className="text-xs font-medium text-[var(--input-placeholder)]">自然语言指令</div>
        <input
          type="text"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="例如：截屏并检测、点击第一个目标、打开百度"
          className="w-full px-2 py-1.5 text-[11px] border border-[var(--input-bar-border)] rounded bg-white focus:ring-1 focus:ring-blue-400 outline-none"
        />
        <div className="flex flex-wrap gap-2 items-center">
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
                className="w-full px-1.5 py-1 text-[11px] border rounded"
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
                className="w-full px-1.5 py-1 text-[11px] border rounded"
              >
                {(VENDOR_MODELS[vendorId] || []).map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>
          <span className="text-[10px] text-[var(--input-placeholder)]">
            {visionModelsLoading ? '加载视觉模型中…' : visionModelsError ? (
              <span className="text-amber-600">加载失败，<button type="button" onClick={loadVisionModels} className="underline hover:no-underline">重试</button></span>
            ) : (
              `视觉模型: ${visionModels.length} 个`
            )}
          </span>
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
        <div className="flex-shrink-0 px-2 py-1.5 border-b bg-[#f8f9fa] text-[10px] font-medium text-[var(--input-placeholder)] flex justify-between items-center">
          <span>{viewMode === 'result' ? '执行结果' : viewMode === 'raw' ? '原始检测结果' : 'AI 原始输出'}</span>
          <div className="flex items-center gap-2">
            {lastDetections.length > 0 && (
              <span className="text-[9px] text-green-600">已缓存 {lastDetections.length} 个检测目标</span>
            )}
            <div className="flex gap-2">
              {aiRaw && (
                <button
                  type="button"
                  onClick={() => setViewMode((v) => (v === 'result' ? 'ai' : 'result'))}
                  className="text-[9px] text-blue-600 hover:underline"
                >
                  {viewMode === 'result' ? '查看 AI 原始输出' : '查看执行结果'}
                </button>
              )}
              {showRawDetection && (
                <button
                  type="button"
                  onClick={() => setViewMode((v) => (v === 'raw' ? 'result' : 'raw'))}
                  className="text-[9px] text-blue-600 hover:underline"
                >
                  {viewMode === 'raw' ? '查看描述' : '查看原始检测结果'}
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="flex-1 min-h-0 flex gap-2 p-2 overflow-auto">
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <pre className="flex-1 min-w-0 text-[11px] font-mono bg-[#111827] text-[#e5e7eb] p-2 rounded overflow-auto whitespace-pre-wrap break-all">
              {(viewMode === 'result' ? execResult : viewMode === 'raw' ? JSON.stringify(rawToolResult, null, 2) : aiRaw) || '输入指令并点击「开始 AI 测试」'}
            </pre>
          </div>
          {captureImage && (
            <img src={captureImage} alt="截屏/检测" className="max-h-48 object-contain rounded border flex-shrink-0" />
          )}
        </div>
      </div>
    </div>
  );
}
