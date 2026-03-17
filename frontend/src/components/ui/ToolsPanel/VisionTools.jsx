/**
 * 本地离线视觉检测工具（YOLO/ONNX）
 * 模型文件下载到本地，完全离线运行，不依赖第三方 API
 */
import { useState, useRef, useEffect } from 'react';
import { visionListModels, visionDetect, guiScreenCapture } from '../../../api/tools';
import { AIAgentTestView } from './AIAgentTools';

/** YOLOv8 COCO 80 类（yolov8n 等通用模型用） */
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

/** UI 元素模型类别（UI Detector / Windows UI / Web UI 等专用模型） */
const UI_CLASS_NAMES = [
  'button', 'input', 'checkbox', 'text', 'icon', 'tab', 'slider', 'dropdown',
  'link', 'image', 'list', 'menu', 'window', 'scrollbar', 'label', 'radio',
];

/** 根据模型文件名推断类别预设 */
function getClassNamesForModel(modelId, preset) {
  if (preset === 'ui') return UI_CLASS_NAMES;
  if (preset === 'coco') return COCO_CLASS_NAMES;
  const id = (modelId || '').toLowerCase();
  if (id.includes('ui') || id.includes('button') || id.includes('web-ui') || id.includes('windows-ui')) return UI_CLASS_NAMES;
  return COCO_CLASS_NAMES;
}

/** 在图片上绘制检测框（bbox: [x,y,w,h]） */
function ImageWithBoxes({ src, detections, className = '' }) {
  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const img = imgRef.current;
    if (!img || !detections?.length) return;
    const onLoad = () => {
      const rect = img.getBoundingClientRect();
      const nw = img.naturalWidth || 1;
      const nh = img.naturalHeight || 1;
      setDisplaySize({ w: rect.width, h: rect.height, nw, nh });
    };
    if (img.complete) onLoad();
    else img.addEventListener('load', onLoad);
    return () => img.removeEventListener('load', onLoad);
  }, [src, detections?.length]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !detections?.length || !displaySize.w) return;
    const { w, h, nw, nh } = displaySize;
    const sx = w / nw;
    const sy = h / nh;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    const colors = ['#00ff00', '#ff6600', '#0066ff', '#ff00ff', '#ffff00'];
    detections.forEach((d, i) => {
      const [bx, by, bw, bh] = d.bbox || [0, 0, 0, 0];
      const x = bx * sx;
      const y = by * sy;
      const ww = bw * sx;
      const hh = bh * sy;
      ctx.strokeStyle = colors[i % colors.length];
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, ww, hh);
      const label = `${d.className || ''} ${Math.round((d.confidence > 1 ? d.confidence / 1000 : d.confidence) * 100)}%`;
      ctx.font = '12px sans-serif';
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fillText(label, x, Math.max(14, y - 2));
    });
  }, [detections, displaySize]);

  if (!src) return null;
  return (
    <div className="relative inline-block">
      <img ref={imgRef} src={src} alt="检测输入" className={className} />
      {detections?.length > 0 && (
        <canvas
          ref={canvasRef}
          className="absolute left-0 top-0 pointer-events-none"
          style={{ width: '100%', height: '100%', left: 0, top: 0 }}
        />
      )}
    </div>
  );
}

const TABS = [
  { id: 'view', label: '查看' },
  { id: 'test', label: '测试' },
  { id: 'ai', label: 'AI 测试' },
];

export function VisionTools() {
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
        {tab === 'view' && <VisionToolsView />}
        {tab === 'test' && (
          <div className="flex-1 min-h-0 overflow-hidden">
            <VisionToolsTest />
          </div>
        )}
        {tab === 'ai' && (
          <div className="flex-1 min-h-0 overflow-hidden">
            <AIAgentTestView />
          </div>
        )}
      </div>
    </div>
  );
}

function VisionToolsView() {
  return (
    <div className="text-sm space-y-3 text-[var(--skill-btn-text)]">
      <h3 className="text-base font-semibold text-[var(--skill-btn-text)]">本地离线视觉检测</h3>
      <p className="text-[var(--input-placeholder)]">
        使用 <strong>YOLO / ONNX</strong> 等模型，<strong>100% 本地运行</strong>，无需联网、不产生费用、隐私安全。
        与 DeepSeek、豆包等在线 API 完全不同。
      </p>
      <div className="rounded-lg border border-[var(--input-bar-border)] bg-[#f8f9fa] p-3 space-y-2">
        <div className="text-xs font-medium text-[var(--input-placeholder)]">特点</div>
        <ul className="space-y-1 text-xs">
          <li>✅ 模型文件下载到本地（.onnx）</li>
          <li>✅ 断网也能运行</li>
          <li>✅ 不依赖任何第三方平台</li>
          <li>✅ 不产生费用，隐私安全</li>
          <li>✅ 支持通用目标检测等</li>
        </ul>
      </div>
      <div className="rounded-lg border border-[var(--input-bar-border)] bg-[#f8f9fa] p-3">
        <div className="text-xs font-medium text-[var(--input-placeholder)] mb-1.5">使用步骤</div>
        <ol className="space-y-1 text-xs list-decimal list-inside">
          <li>在 backend 目录执行 <code className="px-1 bg-[#e8e8e8] rounded">npm run vision:download-model</code> 下载通用模型，或从 README 中的链接下载 <strong>UI 元素模型</strong>（按钮/输入框识别，电脑自动化首选）</li>
          <li>将 .onnx 放入 <code className="px-1 bg-[#e8e8e8] rounded">backend/data/vision-models/</code></li>
          <li>在测试区选择模型、类别预设（UI 模型选「UI 元素」），上传/截屏后点击「开始检测」</li>
        </ol>
      </div>
    </div>
  );
}

/** 灵敏度 → 置信度阈值：越低越能检测到更多目标（含低置信度） */
const SENSITIVITY_OPTIONS = [
  { label: '高（检测更多）', confThreshold: 0.1 },
  { label: '中', confThreshold: 0.15 },
  { label: '低（仅高置信度）', confThreshold: 0.25 },
];

function VisionToolsTest() {
  const fileInputRef = useRef(null);
  const [models, setModels] = useState([]);
  const [modelId, setModelId] = useState('');
  const [classPreset, setClassPreset] = useState('auto');
  const [sensitivity, setSensitivity] = useState(SENSITIVITY_OPTIONS[0]);
  const [imageDataUrl, setImageDataUrl] = useState('');
  const [screenSize, setScreenSize] = useState(null); // 截屏时 CMD 获取的屏幕尺寸
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [detections, setDetections] = useState([]);

  const loadModels = async () => {
    try {
      const data = await visionListModels();
      setModels(data.models || []);
      if (data.models?.length && !modelId) setModelId(data.models[0].id);
    } catch (e) {
      setResult(`获取模型失败：${e?.message || String(e)}`);
    }
  };

  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result) {
        setImageDataUrl(reader.result);
        setScreenSize(null); // 上传图片无屏幕尺寸
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const captureScreen = async () => {
    setLoading(true);
    try {
      const data = await guiScreenCapture();
      if (data?.image) {
        setImageDataUrl(data.image);
        setScreenSize(data.screenWidth != null && data.screenHeight != null
          ? { width: data.screenWidth, height: data.screenHeight }
          : null);
      } else {
        setResult('截屏失败');
      }
    } catch (e) {
      setResult(`截屏失败：${e?.message || String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const runDetect = async () => {
    if (!imageDataUrl) {
      setResult('请先上传图片或截屏');
      return;
    }
    setLoading(true);
    setResult('');
    setDetections([]);
    try {
      const data = await visionDetect({
        image: imageDataUrl,
        modelId: modelId || undefined,
        classNames: getClassNamesForModel(modelId, classPreset),
        confThreshold: sensitivity.confThreshold,
      });
      setDetections(data.detections || []);
      const out = { ...data };
      if (screenSize) out.screenSize = `${screenSize.width}×${screenSize.height}`;
      setResult(JSON.stringify(out, null, 2));
    } catch (e) {
      setResult(`检测失败：${e?.message || String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 gap-3">
      <div className="flex-shrink-0 space-y-2">
        <div className="flex flex-wrap gap-2 items-center">
          <button type="button" onClick={loadModels} className="px-2 py-1.5 rounded text-[11px] font-medium bg-amber-500 text-white hover:bg-amber-600">
            刷新模型列表
          </button>
          <select value={modelId} onChange={(e) => setModelId(e.target.value)} className="px-2 py-1 text-[11px] border rounded min-w-[100px]" title="YOLO 模型：yolov8n/s/m 或 UI 专用，运行 npm run vision:download-all 可下载更多">
            {models.length === 0 ? <option value="">暂无模型</option> : null}
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <select value={classPreset} onChange={(e) => setClassPreset(e.target.value)} className="px-2 py-1 text-[11px] border rounded" title="识别元素类别：UI 模型选 UI 元素">
            <option value="auto">类别: 自动</option>
            <option value="coco">类别: 通用(COCO)</option>
            <option value="ui">类别: UI 元素</option>
          </select>
          {models.length > 0 && models.length < 3 && (
            <span className="text-[9px] text-amber-600" title="backend 目录执行 npm run vision:download-all">可下载 yolov8n/s/m</span>
          )}
          <select value={sensitivity.label} onChange={(e) => setSensitivity(SENSITIVITY_OPTIONS.find((o) => o.label === e.target.value) || SENSITIVITY_OPTIONS[0])} className="px-2 py-1 text-[11px] border rounded" title="置信度阈值，高灵敏度可检测更多目标">
            {SENSITIVITY_OPTIONS.map((o) => (
              <option key={o.label} value={o.label}>{o.label}</option>
            ))}
          </select>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
          <button type="button" onClick={() => fileInputRef.current?.click()} className="px-2 py-1.5 rounded text-[11px] font-medium border border-[var(--input-bar-border)] hover:bg-[#f0f0f0]">
            上传图片
          </button>
          <button type="button" onClick={captureScreen} disabled={loading} className="px-2 py-1.5 rounded text-[11px] font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50">
            截屏
          </button>
          <button type="button" onClick={runDetect} disabled={loading || !imageDataUrl} className="px-2 py-1.5 rounded text-[11px] font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
            {loading ? '检测中…' : '开始检测'}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex gap-3 overflow-hidden">
        <div className="flex-1 min-w-0 flex flex-col rounded-lg border border-[var(--input-bar-border)] bg-white overflow-hidden">
          <div className="flex-shrink-0 px-2 py-1.5 border-b bg-[#f8f9fa] text-[10px] font-medium text-[var(--input-placeholder)] flex justify-between items-center">
            <span>图片预览</span>
            {screenSize && <span className="text-amber-600">屏幕 {screenSize.width}×{screenSize.height}</span>}
          </div>
          <div className="flex-1 min-h-0 p-2 flex items-center justify-center bg-[#fafafa] overflow-hidden">
            {imageDataUrl ? (
              <div className="size-full flex items-center justify-center">
                <ImageWithBoxes src={imageDataUrl} detections={detections} className="max-w-full max-h-full object-contain rounded" />
                {detections.length > 0 && (
                  <div className="mt-1 text-[10px] text-green-600 font-medium">
                    检测到 {detections.length} 个目标：{detections.map((d) => `${d.className}(${Math.round((d.confidence > 1 ? d.confidence / 1000 : d.confidence) * 100)}%)`).join(', ')}
                  </div>
                )}
              </div>
            ) : (
              <span className="text-xs text-[var(--input-placeholder)]">上传图片或截屏</span>
            )}
          </div>
        </div>
        <div className="w-72 flex-shrink-0 flex flex-col rounded-lg border border-[var(--input-bar-border)] bg-white overflow-hidden">
          <div className="flex-shrink-0 px-2 py-1.5 border-b bg-[#f8f9fa] text-[10px] font-medium text-[var(--input-placeholder)]">YOLO 检测结果</div>
          <pre className="flex-1 min-h-0 p-2 text-[11px] font-mono bg-[#111827] text-[#e5e7eb] overflow-auto whitespace-pre-wrap break-all">
            {result || '检测后显示'}
          </pre>
        </div>
      </div>
    </div>
  );
}
