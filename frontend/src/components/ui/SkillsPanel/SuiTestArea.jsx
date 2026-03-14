/**
 * SUI（看见 UI）测试区：
 * - 截取当前屏幕或上传图片 → base64 → 仅使用带「视觉」标签的模型进行识别
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { MODEL_VENDORS, VENDOR_MODELS, isVisionModel } from '../../../data/modelVendors';
import { testModelStream } from '../../../api/modelTest';
import { StreamingText } from '../StreamingText';

const hasGetDisplayMedia =
  typeof navigator !== 'undefined' &&
  navigator.mediaDevices != null &&
  typeof navigator.mediaDevices.getDisplayMedia === 'function';

/** Electron 下用 desktopCapturer 后备截屏（getDisplayMedia 失败时） */
const hasElectronDesktopCapturer =
  typeof window !== 'undefined' && window.electronAPI != null && typeof window.electronAPI.getDesktopSources === 'function';

/** 截屏能力可用：浏览器 getDisplayMedia 或 Electron（主进程 handler + preload 后备） */
const canCaptureScreen = hasGetDisplayMedia || hasElectronDesktopCapturer;

const BOTTOM_THRESHOLD = 60;

export function SuiTestArea() {
  const fileInputRef = useRef(null);
  const streamAccumulatedRef = useRef('');
  const resultScrollRef = useRef(null);
  const visionVendors = useMemo(() => {
    return MODEL_VENDORS.filter((v) => {
      const ms = VENDOR_MODELS[v.id] || [];
      return ms.some(isVisionModel);
    });
  }, []);
  const firstVendor = visionVendors[0]?.id ?? '';
  const [vendorId, setVendorId] = useState(firstVendor);
  const [modelId, setModelId] = useState(() => {
    const ms = (VENDOR_MODELS[firstVendor] || []).filter(isVisionModel);
    return ms[0]?.id ?? '';
  });
  const [screenshotDataUrl, setScreenshotDataUrl] = useState('');
  const [prompt, setPrompt] = useState('请描述当前屏幕上的内容，包括主要文字、按钮和布局。');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [answer, setAnswer] = useState('');

  const models = (VENDOR_MODELS[vendorId] || []).filter(isVisionModel);
  const currentModel = models.find((m) => m.id === modelId) || models[0];

  const streamToDataUrl = (stream) => {
    const video = document.createElement('video');
    video.srcObject = stream;
    return new Promise((resolve, reject) => {
      video.onloadedmetadata = () => {
        video
          .play()
          .then(() => {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0);
            stream.getTracks().forEach((t) => t.stop());
            resolve(canvas.toDataURL('image/png'));
          })
          .catch(reject);
      };
      video.onerror = () => reject(new Error('视频流加载失败'));
    });
  };

  const captureScreen = async () => {
    setError('');
    if (!canCaptureScreen) {
      setError('当前环境不支持截屏，请使用「上传图片」');
      return;
    }
    try {
      let stream = null;
      if (hasGetDisplayMedia) {
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
            audio: false,
          });
        } catch (displayErr) {
          if (hasElectronDesktopCapturer && window.electronAPI?.getDesktopSources) {
            const sources = await window.electronAPI.getDesktopSources({ types: ['screen', 'window'] });
            const screen = sources.find((s) => s.id.startsWith('screen:')) || sources[0];
            if (!screen) throw displayErr;
            stream = await navigator.mediaDevices.getUserMedia({
              audio: false,
              video: {
                mandatory: {
                  chromeMediaSource: 'desktop',
                  chromeMediaSourceId: screen.id,
                },
              },
            });
          } else {
            throw displayErr;
          }
        }
      } else if (hasElectronDesktopCapturer && window.electronAPI?.getDesktopSources) {
        const sources = await window.electronAPI.getDesktopSources({ types: ['screen', 'window'] });
        const screen = sources.find((s) => s.id.startsWith('screen:')) || sources[0];
        if (!screen) throw new Error('未找到可截取的屏幕');
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: screen.id,
            },
          },
        });
      } else {
        throw new Error('截屏不可用');
      }
      const dataUrl = await streamToDataUrl(stream);
      setScreenshotDataUrl(dataUrl);
    } catch (e) {
      if (e?.name === 'NotAllowedError') {
        setError('已取消共享或未选择屏幕/窗口');
      } else {
        setError(e?.message || '截屏失败');
      }
    }
  };

  const onFileChange = (e) => {
    setError('');
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      setError('请选择图片文件（PNG/JPG 等）');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result;
      if (dataUrl && typeof dataUrl === 'string') setScreenshotDataUrl(dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const run = async () => {
    const vid = vendorId.trim();
    const mid = (modelId || currentModel?.id || '').trim();
    if (!vid || !mid) {
      setError('请选择支持视觉的厂商和模型');
      return;
    }
    if (!screenshotDataUrl || !screenshotDataUrl.startsWith('data:')) {
      setError('请先点击「截屏」获取当前屏幕画面');
      return;
    }
    setLoading(true);
    setError('');
    setAnswer('');
    streamAccumulatedRef.current = '';
    const messages = [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: screenshotDataUrl, detail: 'high' } },
          { type: 'text', text: (prompt || '').trim() || '请描述当前屏幕上的内容。' },
        ],
      },
    ];
    testModelStream(
      { vendorId: vid, modelId: mid, messages },
      {
        onChunk: ({ reasoning_content = '', content = '' }) => {
          streamAccumulatedRef.current += (reasoning_content || '') + (content || '');
          setAnswer(streamAccumulatedRef.current);
        },
        onDone: (err) => {
          setLoading(false);
          if (err) setError(err?.message || '识别失败');
        },
      }
    );
  };

  // 回答更新时：若用户当前在底部附近则自动滚到底部，否则保持用户滚动位置
  useEffect(() => {
    const el = resultScrollRef.current;
    if (!el || !answer) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceToBottom <= BOTTOM_THRESHOLD) {
      el.scrollTop = el.scrollHeight;
    }
  }, [answer]);

  return (
    <div className="rounded-xl border border-[var(--input-bar-border)] bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--input-bar-border)] bg-[#f8f9fa]">
        <h3 className="text-sm font-semibold text-[var(--skill-btn-text)]">SUI 测试（看见 UI）</h3>
        <p className="text-xs text-[var(--input-placeholder)] mt-0.5">
          仅展示带「视觉识别 / 图片分析」标签的模型。Electron 下支持截屏；也可上传图片，以 base64 发送给模型识别。
        </p>
      </div>

      <div className="p-4 space-y-3">
        {error && <div className="text-xs text-red-600">{error}</div>}

        {visionVendors.length === 0 ? (
          <div className="text-sm text-[var(--input-placeholder)]">
            当前没有支持视觉的模型（需在模型数据中配置「视觉识别」或「图片分析」标签）。
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--input-placeholder)] mb-1">厂商</label>
              <select
                value={vendorId}
                onChange={(e) => {
                  const v = e.target.value;
                  setVendorId(v);
                  const ms = (VENDOR_MODELS[v] || []).filter(isVisionModel);
                  setModelId(ms[0]?.id ?? '');
                }}
                className="w-full px-3 py-2 text-sm border border-[var(--input-bar-border)] rounded-lg bg-white focus:ring-2 focus:ring-blue-400 outline-none"
              >
                {visionVendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--input-placeholder)] mb-1">模型（仅视觉）</label>
              <select
                value={modelId || currentModel?.id}
                onChange={(e) => setModelId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[var(--input-bar-border)] rounded-lg bg-white focus:ring-2 focus:ring-blue-400 outline-none"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3 items-center">
          <button
            type="button"
            onClick={captureScreen}
            className="px-3 py-2 text-sm rounded-lg border border-[var(--input-bar-border)] text-[var(--skill-btn-text)] bg-white hover:bg-[var(--skill-btn-bg)] disabled:opacity-50"
            disabled={!canCaptureScreen}
            title={!canCaptureScreen ? '请使用上传图片' : '截取当前屏幕'}
          >
            截屏
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFileChange}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-2 text-sm rounded-lg border border-[var(--input-bar-border)] text-[var(--skill-btn-text)] bg-white hover:bg-[var(--skill-btn-bg)]"
          >
            上传图片
          </button>
          <button
            type="button"
            onClick={run}
            disabled={loading || !screenshotDataUrl}
            className={`px-3 py-2 text-sm rounded-lg text-white ${
              loading || !screenshotDataUrl ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            {loading ? '识别中…' : '发送识别'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-h-[280px]">
          <div className="border border-[var(--input-bar-border)] rounded-lg overflow-hidden bg-[#fafafa]">
            <div className="px-2 py-1.5 text-xs text-[var(--input-placeholder)] border-b border-[var(--input-bar-border)]">
              截图预览
            </div>
            <div className="p-2 min-h-[200px] flex items-center justify-center">
              {screenshotDataUrl ? (
                <img src={screenshotDataUrl} alt="截屏" className="max-w-full max-h-[360px] object-contain rounded" />
              ) : (
                <span className="text-xs text-[var(--input-placeholder)]">
                  {canCaptureScreen ? '点击「截屏」或「上传图片」' : '点击「上传图片」选择截图文件'}
                </span>
              )}
            </div>
            <div className="px-2 py-1.5 border-t border-[var(--input-bar-border)]">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full text-xs px-2 py-1.5 border border-[var(--input-bar-border)] rounded bg-white resize-none"
                rows={2}
                placeholder="补充说明（可选）"
              />
            </div>
          </div>
          <div className="border border-[var(--input-bar-border)] rounded-lg overflow-hidden bg-white flex flex-col h-[360px]">
            <div className="px-2 py-1.5 text-xs text-[var(--input-placeholder)] border-b border-[var(--input-bar-border)] flex-shrink-0">
              AI 识别结果
            </div>
            <div
              ref={resultScrollRef}
              className="p-3 flex-1 min-h-0 overflow-y-auto overflow-x-auto"
            >
              {answer ? (
                <>
                  <StreamingText text={answer} isStreaming={loading} showCursorWhenCaughtUp={loading} />
                  {loading && <div className="text-xs text-[var(--input-placeholder)] mt-2">正在识别…</div>}
                </>
              ) : loading ? (
                <div className="text-sm text-[var(--input-placeholder)]">正在识别…</div>
              ) : (
                <div className="text-sm text-[var(--input-placeholder)]">
                  截屏并点击「发送识别」后，此处显示模型对画面的描述。
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
