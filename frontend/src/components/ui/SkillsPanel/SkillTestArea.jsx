/**
 * 技能测试区 - 若上方已设固定模型则直接测试对话，否则显示厂商/模型选择
 */
import { useState } from 'react';
import { MODEL_VENDORS, VENDOR_MODELS } from '../../../data/modelVendors';
import { testModel, testModelStream } from '../../../api/modelTest';
import { MarkdownBlock } from '../ModelTestPanel/MarkdownBlock';

function getFirstModelId(vid) {
  const list = VENDOR_MODELS[vid] || [];
  return list[0]?.id ?? '';
}

export function SkillTestArea({ fixedModel }) {
  const firstVendor = MODEL_VENDORS[0]?.id ?? '';
  const [vendorId, setVendorId] = useState(firstVendor);
  const [modelId, setModelId] = useState(() => getFirstModelId(firstVendor));
  const [message, setMessage] = useState('你好，请用一句话介绍你自己。');
  const [stream, setStream] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const useFixed = fixedModel && fixedModel.vendorId && fixedModel.modelId;
  const vid = useFixed ? fixedModel.vendorId : vendorId;
  const mid = useFixed ? fixedModel.modelId : modelId;
  const models = VENDOR_MODELS[vid] || [];
  const currentModel = models.find((m) => m.id === mid) || models[0];
  const streamCapable = currentModel?.stream === true;

  const handleVendorChange = (e) => {
    const v = e.target.value;
    setVendorId(v);
    const first = (VENDOR_MODELS[v] || [])[0];
    setModelId(first?.id ?? '');
  };

  const handleModelChange = (e) => {
    setModelId(e.target.value);
  };

  const handleTest = async () => {
    const vidTrim = vid.trim();
    const midTrim = (mid || currentModel?.id || '').trim();
    if (!vidTrim || !midTrim) {
      setResult({ success: false, error: useFixed ? '请先在上方设置固定模型' : '请选择厂商和模型' });
      return;
    }
    setLoading(true);
    setResult(null);
    const useStream = streamCapable && stream;
    const payload = { vendorId: vidTrim, modelId: midTrim, message: message.trim() || 'Hello', stream: useStream };

    if (useStream) {
      let content = '';
      let reasoning_content = '';
      testModelStream(payload, {
        onChunk: (delta) => {
          reasoning_content += delta.reasoning_content ?? '';
          content += delta.content ?? '';
          setResult({ success: true, content, reasoning_content, streaming: true });
        },
        onDone: (err) => {
          setLoading(false);
          if (err) {
            setResult({ success: false, error: err?.message || '流式请求异常' });
          } else {
            setResult((prev) =>
              prev?.success ? { ...prev, streaming: false } : { success: true, content, reasoning_content, streaming: false }
            );
          }
        },
      });
    } else {
      try {
        const data = await testModel(payload);
        if (data?.success) {
          setResult({ success: true, content: data.content, reasoning_content: data.reasoning_content });
        } else {
          setResult({ success: false, error: data?.error || '请求失败' });
        }
      } catch (e) {
        setResult({ success: false, error: e?.message || '网络或服务异常' });
      } finally {
        setLoading(false);
      }
    }
  };

  const vendorName = MODEL_VENDORS.find((v) => v.id === vid)?.name ?? vid;
  const modelName = currentModel?.name ?? mid;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-shrink-0 px-4 py-3 border-b border-[var(--input-bar-border)] bg-[#f8f9fa]">
        <h3 className="text-sm font-semibold text-[var(--skill-btn-text)]">测试</h3>
        <p className="text-xs text-[var(--input-placeholder)] mt-0.5">
          {useFixed
            ? `使用固定模型「${vendorName} / ${modelName}」直接测试对话`
            : '选择已开通的厂商与模型，对当前技能进行调用测试'}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="grid grid-cols-1 gap-3">
          {!useFixed && (
            <>
              <div>
                <label className="block text-xs font-medium text-[var(--input-placeholder)] mb-1">厂商</label>
                <select
                  value={vendorId}
                  onChange={handleVendorChange}
                  className="w-full px-3 py-2 text-sm border border-[var(--input-bar-border)] rounded-lg bg-white focus:ring-2 focus:ring-blue-400 outline-none"
                >
                  {MODEL_VENDORS.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--input-placeholder)] mb-1">模型</label>
                <select
                  value={modelId || currentModel?.id}
                  onChange={handleModelChange}
                  className="w-full px-3 py-2 text-sm border border-[var(--input-bar-border)] rounded-lg bg-white focus:ring-2 focus:ring-blue-400 outline-none"
                >
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          {streamCapable && (
            <label className="flex items-center gap-2 text-sm text-[var(--skill-btn-text)]">
              <input
                type="checkbox"
                checked={stream}
                onChange={(e) => setStream(e.target.checked)}
                className="rounded border-[var(--input-bar-border)]"
              />
              流式输出
            </label>
          )}
          <div>
            <label className="block text-xs font-medium text-[var(--input-placeholder)] mb-1">测试内容</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 text-sm border border-[var(--input-bar-border)] rounded-lg bg-white placeholder:text-[var(--input-placeholder)] focus:ring-2 focus:ring-blue-400 outline-none resize-none"
              placeholder="输入要发送的内容..."
            />
          </div>
          <button
            type="button"
            onClick={handleTest}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '请求中…' : '开始测试'}
          </button>
        </div>

        {result != null && (
          <div className="rounded-xl border border-[var(--input-bar-border)] bg-white overflow-hidden">
            <div className="px-3 py-2 border-b border-[var(--input-bar-border)] bg-[#f8f9fa] text-xs font-medium text-[var(--input-placeholder)]">
              {result.success ? '结果' : '错误'}
              {result.streaming && <span className="ml-2 text-green-600">输出中…</span>}
            </div>
            <div className="p-3 min-h-[80px] text-sm">
              {result.success ? (
                <div className="space-y-2">
                  {result.reasoning_content != null && result.reasoning_content.length > 0 && (
                    <div>
                      <div className="text-xs text-[var(--input-placeholder)] mb-0.5">思考</div>
                      <div className="text-[var(--skill-btn-text)]"><MarkdownBlock>{result.reasoning_content}</MarkdownBlock></div>
                    </div>
                  )}
                  <div>
                    {result.reasoning_content?.length > 0 && <div className="text-xs text-[var(--input-placeholder)] mb-0.5">回答</div>}
                    <div className="text-[var(--skill-btn-text)]">
                      <MarkdownBlock>{result.content ?? ''}</MarkdownBlock>
                      {result.streaming && <span className="inline-block w-2 h-4 ml-0.5 bg-blue-500 animate-pulse align-middle" />}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-red-600">{result.error}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
