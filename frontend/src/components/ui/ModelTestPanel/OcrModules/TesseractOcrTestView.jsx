/**
 * 本地 OCR 测试视图（基于 Tesseract.js）
 * 纯前端运行，无需 API Key
 */
import { useState } from 'react';
import { recognizeTesseract } from '../../../../ocr';

const iconBack = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);

const LANG_OPTIONS = [
  { value: 'chi_sim+eng', label: '简体中文 + 英文' },
  { value: 'chi_sim', label: '简体中文' },
  { value: 'eng', label: '英文' },
];

export function TesseractOcrTestView({ onBack }) {
  const [imageFile, setImageFile] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [lang, setLang] = useState('chi_sim+eng');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleTest = async () => {
    setLoading(true);
    setResult(null);
    try {
      let input;
      if (imageFile) {
        input = imageFile;
      } else if (imageUrl?.trim()) {
        input = imageUrl.trim();
      } else {
        setResult({ success: false, error: '请上传图片或输入图片 URL' });
        return;
      }
      const data = await recognizeTesseract(input, { lang });
      setResult({ success: true, text: data.text, words: data.words });
    } catch (e) {
      setResult({ success: false, error: e?.message || '识别失败' });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    setImageFile(file || null);
    setImageUrl('');
    // eslint-disable-next-line no-param-reassign
    e.target.value = '';
  };

  const words = result?.words || [];
  const text = result?.text || '';

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
        <h2 className="text-sm font-medium text-[var(--skill-btn-text)]">本地 OCR 测试</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm">
          本地运行，无需 API Key。首次使用会下载语言包，请耐心等待。
        </div>

        <div className="rounded-xl border border-[var(--input-bar-border)] p-4 bg-white">
          <h3 className="text-sm font-medium text-[var(--skill-btn-text)] mb-3">图片输入</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-[var(--input-placeholder)] mb-1">图片 URL</label>
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => { setImageUrl(e.target.value); setImageFile(null); }}
                placeholder="https://example.com/image.png"
                className="w-full px-3 py-2 rounded-lg text-sm bg-[var(--skill-btn-bg)] border border-[var(--input-bar-border)] text-[var(--skill-btn-text)] placeholder:text-[var(--input-placeholder)] outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--input-placeholder)]">或</span>
            </div>
            <div>
              <label className="block text-xs text-[var(--input-placeholder)] mb-1">上传图片</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="block w-full text-sm text-[var(--skill-btn-text)] file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100"
              />
              {imageFile && (
                <p className="mt-1 text-xs text-[var(--input-placeholder)]">已选: {imageFile.name}</p>
              )}
            </div>
            <div>
              <label className="block text-xs text-[var(--input-placeholder)] mb-1">识别语言</label>
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm bg-[var(--skill-btn-bg)] border border-[var(--input-bar-border)] text-[var(--skill-btn-text)] outline-none focus:ring-2 focus:ring-blue-400"
              >
                {LANG_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="button"
            disabled={loading || (!imageFile && !imageUrl?.trim())}
            onClick={handleTest}
            className={`
              mt-4 px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${!loading && (imageFile || imageUrl?.trim()) ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-[var(--skill-btn-bg)] text-[var(--input-placeholder)] cursor-not-allowed'}
            `}
          >
            {loading ? '识别中...' : '开始识别'}
          </button>
        </div>

        {result && (
          <div className="rounded-xl border border-[var(--input-bar-border)] p-4 bg-white">
            <h3 className="text-sm font-medium text-[var(--skill-btn-text)] mb-3">识别结果</h3>
            {result.success === false ? (
              <p className="text-sm text-red-600">{result.error}</p>
            ) : (
              <>
                <p className="text-xs text-[var(--input-placeholder)] mb-2">
                  共识别 {words.length} 个词块
                </p>
                <div className="space-y-1 font-mono text-sm text-[var(--skill-btn-text)] bg-[var(--skill-btn-bg)] rounded-lg p-3 max-h-64 overflow-y-auto">
                  {text ? (
                    <pre className="whitespace-pre-wrap break-words">{text}</pre>
                  ) : (
                    words.map((item, i) => (
                      <div key={i}>{item.words}</div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
