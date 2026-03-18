/**
 * 百度智能云 OCR 测试视图
 * 支持输入图片 URL 或上传图片进行通用文字识别测试
 */
import { useState } from 'react';
import { testBaiduOcr } from '../../../../api/client';

const DEFAULT_TEST_URL = 'https://baidu-ai.bj.bcebos.com/ocr/general.png';

const iconBack = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);

export function BaiduOcrTestView({ onBack, apiKeySet }) {
  const [imageUrl, setImageUrl] = useState(DEFAULT_TEST_URL);
  const [imageFile, setImageFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        const base64 = dataUrl?.split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleTest = async () => {
    if (!apiKeySet) return;
    setLoading(true);
    setResult(null);
    try {
      let data;
      if (imageFile) {
        const base64 = await fileToBase64(imageFile);
        data = await testBaiduOcr({ image: base64 });
      } else if (imageUrl?.trim()) {
        data = await testBaiduOcr({ url: imageUrl.trim() });
      } else {
        setResult({ success: false, error: '请输入图片 URL 或上传图片' });
        return;
      }
      setResult(data);
    } catch (e) {
      setResult({ success: false, error: e?.message || '请求失败' });
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

  const words = result?.data?.words_result || [];
  const wordsNum = result?.data?.words_result_num ?? 0;

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
        <h2 className="text-sm font-medium text-[var(--skill-btn-text)]">百度智能云 OCR 测试</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {!apiKeySet && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
            请在「设置 → API Key 设置」中配置百度智能云 OCR 的 API Key 和 Secret Key 后再进行测试。
          </div>
        )}

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
          </div>
          <button
            type="button"
            disabled={!apiKeySet || loading}
            onClick={handleTest}
            className={`
              mt-4 px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${apiKeySet && !loading ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-[var(--skill-btn-bg)] text-[var(--input-placeholder)] cursor-not-allowed'}
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
                  共识别 {wordsNum} 行文字
                </p>
                <div className="space-y-1 font-mono text-sm text-[var(--skill-btn-text)] bg-[var(--skill-btn-bg)] rounded-lg p-3 max-h-64 overflow-y-auto">
                  {words.map((item, i) => (
                    <div key={i}>{item.words}</div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
