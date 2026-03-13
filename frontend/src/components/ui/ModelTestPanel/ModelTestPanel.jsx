/**
 * 模型测试主面板：左侧厂商列表，右侧模型列表或单独测试详情
 */
import { useState, useEffect } from 'react';
import { MODEL_VENDORS, VENDOR_MODELS } from '../../../data/modelVendors';
import { getApiKeys } from '../../../api/client';
import { TestDetailView } from './TestDetailView';

const iconVendor = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

export function ModelTestPanel({ className = '' }) {
  const [selectedVendorId, setSelectedVendorId] = useState(MODEL_VENDORS[0]?.id ?? null);
  const [maskedKeys, setMaskedKeys] = useState({});
  const [selectedForTest, setSelectedForTest] = useState(null);

  useEffect(() => {
    getApiKeys().then(setMaskedKeys).catch(() => setMaskedKeys({}));
  }, []);

  const models = selectedVendorId ? (VENDOR_MODELS[selectedVendorId] ?? []) : [];
  const apiKeySet = selectedVendorId ? !!maskedKeys[selectedVendorId] : false;
  const vendorName = MODEL_VENDORS.find((v) => v.id === selectedVendorId)?.name ?? '';

  return (
    <div className={`flex-1 w-full flex overflow-hidden bg-white ${className}`}>
      <aside className="w-52 flex-shrink-0 border-r border-[var(--input-bar-border)] bg-[var(--skill-btn-bg)] flex flex-col">
        <div className="p-3 border-b border-[var(--input-bar-border)]">
          <h2 className="text-xs font-medium text-[var(--input-placeholder)] uppercase tracking-wide">支持的厂商</h2>
        </div>
        <nav className="p-2 flex flex-col gap-1 overflow-y-auto">
          {MODEL_VENDORS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => { setSelectedVendorId(v.id); setSelectedForTest(null); }}
              className={`
                flex items-center gap-2 px-3 py-2.5 rounded-lg text-left text-sm font-medium transition-colors duration-200
                ${selectedVendorId === v.id ? 'bg-blue-500 text-white' : 'text-[var(--skill-btn-text)] hover:bg-[var(--skill-btn-hover)]'}
              `}
            >
              {iconVendor}
              <span>{v.name}</span>
            </button>
          ))}
        </nav>
      </aside>

      {selectedForTest ? (
        <TestDetailView
          vendorId={selectedForTest.vendorId}
          vendorName={selectedForTest.vendorName}
          model={selectedForTest.model}
          apiKeySet={!!maskedKeys[selectedForTest.vendorId]}
          onBack={() => setSelectedForTest(null)}
        />
      ) : (
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex-shrink-0 px-4 py-3 border-b border-[var(--input-bar-border)] bg-white">
            <h2 className="text-sm font-medium text-[var(--skill-btn-text)]">可调用模型</h2>
            {selectedVendorId && (
              <p className="text-xs text-[var(--input-placeholder)] mt-1">
                {apiKeySet ? '已配置 API Key，可对下方模型进行单独测试。' : '请在「设置」中配置该厂商的 API Key 后，即可在此对模型进行单独测试。'}
              </p>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {!selectedVendorId ? (
              <p className="text-sm text-[var(--input-placeholder)]">请从左侧选择厂商</p>
            ) : models.length === 0 ? (
              <p className="text-sm text-[var(--input-placeholder)]">暂无模型数据</p>
            ) : (
              <ul className="space-y-2">
                {models.map((model) => (
                  <li
                    key={model.id}
                    className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-white border border-[var(--input-bar-border)]"
                  >
                    <div className="min-w-0 flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-[var(--skill-btn-text)]">{model.name}</p>
                        {Array.isArray(model.tags) && model.tags.length > 0 &&
                          model.tags.map((t) => (
                            <span key={t} className="inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-600 border border-blue-100">{t}</span>
                          ))}
                        {model.stream === true && (
                          <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-green-50 text-green-700 border border-green-100">支持流式输出</span>
                        )}
                        {model.stream === false && (
                          <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">非流式</span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--input-placeholder)] font-mono">{model.id}</p>
                    </div>
                    <button
                      type="button"
                      disabled={!apiKeySet}
                      onClick={() => setSelectedForTest({ vendorId: selectedVendorId, vendorName, model })}
                      className={`
                        flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-200
                        ${apiKeySet ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-[var(--skill-btn-bg)] text-[var(--input-placeholder)] cursor-not-allowed'}
                      `}
                    >
                      单独测试
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
