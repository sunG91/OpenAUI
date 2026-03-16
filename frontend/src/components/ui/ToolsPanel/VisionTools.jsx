/**
 * 本地离线视觉检测工具（YOLO/ONNX）
 * 模型文件下载到本地，完全离线运行，不依赖第三方 API
 */
import { useState, useRef } from 'react';
import { visionListModels, visionDetect, guiScreenCapture } from '../../../api/tools';

const TABS = [
  { id: 'view', label: '查看' },
  { id: 'test', label: '测试' },
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
      <div className={`flex-1 min-h-0 flex flex-col p-4 ${tab === 'test' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        {tab === 'view' && <VisionToolsView />}
        {tab === 'test' && (
          <div className="flex-1 min-h-0 overflow-hidden">
            <VisionToolsTest />
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
          <li>✅ 支持龙虾、通用目标检测等</li>
        </ul>
      </div>
      <div className="rounded-lg border border-[var(--input-bar-border)] bg-[#f8f9fa] p-3">
        <div className="text-xs font-medium text-[var(--input-placeholder)] mb-1.5">使用步骤</div>
        <ol className="space-y-1 text-xs list-decimal list-inside">
          <li>在 backend 目录执行 <code className="px-1 bg-[#e8e8e8] rounded">npm run vision:download-model</code> 下载预训练模型，或手动将 .onnx 放入 <code className="px-1 bg-[#e8e8e8] rounded">backend/data/vision-models/</code></li>
          <li>依赖已包含（onnxruntime-node、sharp），无需额外安装</li>
          <li>在测试区上传图片或截屏，点击「开始检测」</li>
        </ol>
      </div>
    </div>
  );
}

function VisionToolsTest() {
  const fileInputRef = useRef(null);
  const [models, setModels] = useState([]);
  const [modelId, setModelId] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState('');
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
      if (reader.result) setImageDataUrl(reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const captureScreen = async () => {
    setLoading(true);
    try {
      const data = await guiScreenCapture();
      if (data?.image) setImageDataUrl(data.image);
      else setResult('截屏失败');
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
        classNames: ['龙虾', 'lobster'],
      });
      setDetections(data.detections || []);
      setResult(JSON.stringify(data, null, 2));
    } catch (e) {
      setResult(`检测失败：${e?.message || String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 gap-3">
      <div className="flex-shrink-0 flex flex-wrap gap-2 items-center">
        <button type="button" onClick={loadModels} className="px-2 py-1.5 rounded text-[11px] font-medium bg-amber-500 text-white hover:bg-amber-600">
          刷新模型列表
        </button>
        {models.length > 0 && (
          <select value={modelId} onChange={(e) => setModelId(e.target.value)} className="px-2 py-1 text-[11px] border rounded">
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        )}
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

      <div className="flex-1 min-h-0 flex gap-3 overflow-hidden">
        <div className="flex-1 min-w-0 flex flex-col rounded-lg border border-[var(--input-bar-border)] bg-white overflow-hidden">
          <div className="flex-shrink-0 px-2 py-1.5 border-b bg-[#f8f9fa] text-[10px] font-medium text-[var(--input-placeholder)]">图片预览</div>
          <div className="flex-1 min-h-0 p-2 overflow-auto flex items-center justify-center bg-[#fafafa]">
            {imageDataUrl ? (
              <div className="relative">
                <img src={imageDataUrl} alt="输入" className="max-w-full max-h-[300px] object-contain rounded" />
                {detections.length > 0 && (
                  <div className="mt-1 text-[10px] text-green-600 font-medium">
                    检测到 {detections.length} 个目标：{detections.map((d) => `${d.className}(${Math.round(d.confidence * 100)}%)`).join(', ')}
                  </div>
                )}
              </div>
            ) : (
              <span className="text-xs text-[var(--input-placeholder)]">上传图片或截屏</span>
            )}
          </div>
        </div>
        <div className="w-72 flex-shrink-0 flex flex-col rounded-lg border border-[var(--input-bar-border)] bg-white overflow-hidden">
          <div className="flex-shrink-0 px-2 py-1.5 border-b bg-[#f8f9fa] text-[10px] font-medium text-[var(--input-placeholder)]">检测结果</div>
          <pre className="flex-1 min-h-0 p-2 text-[11px] font-mono bg-[#111827] text-[#e5e7eb] overflow-auto whitespace-pre-wrap break-all">
            {result || '检测后显示'}
          </pre>
        </div>
      </div>
    </div>
  );
}
