/**
 * 向量模型测试视图（Xenova/all-MiniLM-L6-v2）
 * 本地运行，无需 API Key
 */
import { useState, useEffect } from 'react';
import { embedText, checkMemoryAvailable } from '../../../../api/memoryStorage';

const iconBack = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);

export function EmbeddingsTestView({ onBack }) {
  const [text, setText] = useState('这是一段测试文本');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [available, setAvailable] = useState(null);

  useEffect(() => {
    checkMemoryAvailable().then(setAvailable).catch(() => setAvailable(false));
  }, []);

  const handleTest = async () => {
    setLoading(true);
    setResult(null);
    try {
      const data = await embedText(text?.trim() || 'test');
      setResult({ success: true, vector: data.vector, dim: data.dim });
    } catch (e) {
      setResult({ success: false, error: e?.message || '嵌入失败' });
    } finally {
      setLoading(false);
    }
  };

  const vector = result?.vector;
  const preview = vector ? vector.slice(0, 8).map((v) => v.toFixed(4)).join(', ') + (vector.length > 8 ? '...' : '') : '';

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <div className="flex-shrink-0 px-4 py-3 border-b border-[var(--input-bar-border)] bg-white flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-[var(--skill-btn-bg)] text-[var(--skill-btn-text)]"
        >
          {iconBack}
        </button>
        <h2 className="text-sm font-medium text-[var(--skill-btn-text)]">向量模型测试</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm">
          本地运行 Xenova/all-MiniLM-L6-v2（384 维），无需 API Key。首次使用会下载模型，请耐心等待。
        </div>

        {available === false && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
            向量模型暂不可用，请检查后端依赖（@xenova/transformers）是否已安装。
          </div>
        )}

        <div className="rounded-xl border border-[var(--input-bar-border)] p-4 bg-white">
          <h3 className="text-sm font-medium text-[var(--skill-btn-text)] mb-3">文本输入</h3>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="输入文本，将转为向量..."
            rows={3}
            className="w-full px-3 py-2 rounded-lg text-sm bg-[var(--skill-btn-bg)] border border-[var(--input-bar-border)] text-[var(--skill-btn-text)] placeholder:text-[var(--input-placeholder)] outline-none focus:ring-2 focus:ring-blue-400 resize-none"
          />
          <button
            type="button"
            onClick={handleTest}
            disabled={loading || available === false}
            className="mt-3 px-4 py-2 rounded-lg text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '计算中...' : '生成向量'}
          </button>
        </div>

        {result && (
          <div className="rounded-xl border border-[var(--input-bar-border)] p-4 bg-white">
            <h3 className="text-sm font-medium text-[var(--skill-btn-text)] mb-3">结果</h3>
            {result.success ? (
              <div className="space-y-2 text-sm">
                <p className="text-[var(--input-placeholder)]">
                  维度：<span className="font-mono text-[var(--skill-btn-text)]">{result.dim}</span>
                </p>
                <p className="text-[var(--input-placeholder)]">
                  向量预览（前 8 维）：<span className="font-mono text-xs break-all">{preview}</span>
                </p>
              </div>
            ) : (
              <p className="text-red-600">{result.error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
