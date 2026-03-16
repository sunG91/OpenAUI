/**
 * Agent 模块 - 工具注册表
 * 将 tool 名称映射到实际 API 调用，供 PlanExecutor 使用
 */

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

function pathIsAbsolute(p) {
  if (!p || typeof p !== 'string') return false;
  if (p.startsWith('/')) return true;
  if (/^[A-Za-z]:[\\/]/.test(p)) return true;
  return false;
}

function resolvePath(trimmed, projectRoot) {
  if (!trimmed) return projectRoot || '.';
  if (pathIsAbsolute(trimmed)) return trimmed;
  const base = (projectRoot || '').replace(/\\/g, '/');
  const rel = trimmed.replace(/^\/+/, '');
  return base ? `${base}/${rel}` : rel;
}

/**
 * 创建工具执行器
 * @param {object} tools - 来自 api/tools.js 的 API 函数
 * @returns {(tool: string, params: object, ctx: object) => Promise<object>}
 */
export function createToolExecutor(tools) {
  const {
    guiMouseMove,
    guiMouseClick,
    guiKeyboardType,
    guiScreenCapture,
    runShell,
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
    browserBack,
    browserWait,
    visionDetect,
  } = tools;

  const TOOL_ALIASES = { gui_keyboard_input: 'gui_keyboard_type' };

  return async function executeTool(tool, params, ctx) {
    const toolName = TOOL_ALIASES[tool] || tool;
    const {
      projectRoot = '',
      lastCapturedImage = null,
      lastDetections = [],
      visionModels = [],
      onCaptureImage = () => {},
      onDetections = () => {},
      browserSessionId = null,
      browserPageId = null,
    } = ctx;

    const obj = params || {};
    const useSession = browserSessionId && (toolName.startsWith('browser_'));
    let result;

    switch (toolName) {
      case 'gui_mouse_move':
        result = await guiMouseMove(Number(obj.x) || 0, Number(obj.y) || 0);
        break;
      case 'gui_mouse_click': {
        const opts = { button: (obj.button || 'left').toLowerCase() };
        if (obj.x != null && obj.y != null) {
          opts.x = Number(obj.x);
          opts.y = Number(obj.y);
        }
        result = await guiMouseClick(opts);
        break;
      }
      case 'gui_keyboard_type':
        result = await guiKeyboardType(obj.text ?? '');
        break;
      case 'gui_screen_capture': {
        result = await guiScreenCapture(obj.region);
        if (result?.image) onCaptureImage(result.image);
        break;
      }
      case 'console_shell':
        result = await runShell(obj.command ?? '', { cwd: obj.cwd || undefined });
        break;
      case 'fs_list':
        result = await systemFsList(resolvePath(obj.path ?? '', projectRoot));
        break;
      case 'fs_read_text':
        result = await systemFsReadText(resolvePath(obj.path ?? '', projectRoot));
        break;
      case 'fs_write_text':
        result = await systemFsWriteText(resolvePath(obj.path ?? '', projectRoot), obj.content ?? '');
        break;
      case 'process_list':
        result = await systemProcessList();
        break;
      case 'process_kill': {
        const pid = Number(obj.pid);
        if (!Number.isFinite(pid) || pid <= 0) {
          result = { success: false, error: 'pid 不合法' };
        } else {
          result = await systemProcessKill(pid);
        }
        break;
      }
      case 'browser_navigate':
        result = await browserNavigate(useSession ? { sessionId: browserSessionId, url: obj.url ?? '' } : { url: obj.url ?? '' });
        break;
      case 'browser_click':
        result = await browserClick(useSession ? { sessionId: browserSessionId, pageId: browserPageId, selector: obj.selector ?? '' } : { url: obj.url ?? '', selector: obj.selector ?? '' });
        break;
      case 'browser_type':
        result = await browserType(useSession ? { sessionId: browserSessionId, pageId: browserPageId, selector: obj.selector ?? '', text: obj.text ?? '' } : { url: obj.url ?? '', selector: obj.selector ?? '', text: obj.text ?? '' });
        break;
      case 'browser_screenshot':
        result = await browserScreenshot(useSession ? { sessionId: browserSessionId, pageId: browserPageId } : { url: obj.url ?? '' });
        if (result?.image) onCaptureImage(result.image);
        break;
      case 'browser_dom_interactive':
        result = await browserDomInteractive(useSession ? { sessionId: browserSessionId, pageId: browserPageId } : { url: obj.url ?? '' });
        break;
      case 'browser_scroll':
        result = await browserScroll(useSession ? { sessionId: browserSessionId, pageId: browserPageId, x: obj.x ?? 0, y: obj.y ?? 0 } : { url: obj.url ?? '', x: obj.x ?? 0, y: obj.y ?? 0 });
        break;
      case 'browser_execute':
        result = await browserExecute(useSession ? { sessionId: browserSessionId, pageId: browserPageId, script: obj.script ?? 'null' } : { url: obj.url ?? '', script: obj.script ?? 'null' });
        break;
      case 'browser_back':
        result = await browserBack(useSession ? { sessionId: browserSessionId, pageId: browserPageId } : {});
        break;
      case 'browser_wait':
        result = await browserWait(useSession ? { sessionId: browserSessionId, pageId: browserPageId, selector: obj.selector, timeout: obj.timeout } : { selector: obj.selector, timeout: obj.timeout });
        break;
      case 'vision_screen_detect': {
        const cap = await guiScreenCapture();
        if (!cap?.image) {
          result = { success: false, error: '截屏失败' };
          break;
        }
        onCaptureImage(cap.image);
        const modelIdToUse = obj.modelId || visionModels[0]?.id;
        const detectRes = await visionDetect({
          image: cap.image,
          modelId: modelIdToUse,
          classNames: COCO_CLASS_NAMES,
        });
        const dets = detectRes.detections || [];
        onDetections(dets);
        result = { ...detectRes, _meta: { modelUsed: detectRes.modelUsed || modelIdToUse, engine: 'YOLO/ONNX' } };
        break;
      }
      case 'vision_detect': {
        const img = obj.image || lastCapturedImage;
        if (!img) {
          result = { success: false, error: '无可用图片，请先截屏或使用 vision_screen_detect' };
          break;
        }
        const modelIdToUse = obj.modelId || visionModels[0]?.id;
        const detectRes = await visionDetect({
          image: img,
          modelId: modelIdToUse,
          classNames: COCO_CLASS_NAMES,
        });
        const dets = detectRes.detections || [];
        onDetections(dets);
        result = { ...detectRes, _meta: { modelUsed: detectRes.modelUsed || modelIdToUse, engine: 'YOLO/ONNX' } };
        break;
      }
      case 'gui_click_detection': {
        const idx = Number(obj.index) ?? 0;
        const dets = lastDetections;
        if (!dets.length || idx < 0 || idx >= dets.length) {
          result = { success: false, error: `无有效检测结果或 index 越界，当前有 ${dets.length} 个目标` };
          break;
        }
        const d = dets[idx];
        const bbox = d.bbox || [];
        const cx = Math.round(bbox[0] + (bbox[2] || 0) / 2);
        const cy = Math.round(bbox[1] + (bbox[3] || 0) / 2);
        result = await guiMouseClick({ x: cx, y: cy });
        break;
      }
      default:
        result = { success: false, error: `未知工具：${tool}（正确名称如 gui_keyboard_type、browser_type）` };
    }

    return result;
  };
}

/** 所有支持的工具名称列表 */
export const TOOL_NAMES = [
  'gui_mouse_move', 'gui_mouse_click', 'gui_keyboard_type', 'gui_screen_capture',
  'console_shell', 'fs_list', 'fs_read_text', 'fs_write_text', 'process_list', 'process_kill',
  'browser_navigate', 'browser_click', 'browser_type', 'browser_screenshot',
  'browser_dom_interactive', 'browser_scroll', 'browser_execute', 'browser_back', 'browser_wait',
  'vision_screen_detect', 'vision_detect', 'gui_click_detection',
];
