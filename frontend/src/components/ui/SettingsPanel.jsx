/**
 * 设置面板 - 顶部 Tab：API Key 设置、模型厂商、规则设置
 * API Key 存后端本地 data，查看为脱敏显示，支持修改
 */
import { useState, useEffect } from 'react';
import { MODEL_VENDORS } from '../../data/modelVendors';
import { getApiKeys, saveApiKey } from '../../api/client';
import { useWebSocketContext } from '../../context/WebSocketContext';
import { VoicePanel } from './VoicePanel';

const iconVendor = (
  <svg className="w-5 h-5 text-[var(--input-placeholder)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const TABS = [
  { id: 'apikey', label: 'API Key 设置' },
  { id: 'auth', label: '连接密钥' },
  { id: 'vendors', label: '模型厂商' },
  { id: 'voice', label: '语音模块' },
  { id: 'rules', label: '规则设置' },
];

export function SettingsPanel({ className = '' }) {
  const [activeTab, setActiveTab] = useState('apikey');
  const [maskedKeys, setMaskedKeys] = useState({});
  const [editingVendorId, setEditingVendorId] = useState(null);
  const [editInput, setEditInput] = useState('');
  const [savedId, setSavedId] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const { clearAuthKey, hasStoredAuthKey, rememberAuthKey, setRememberAuthKey } = useWebSocketContext();
  const [authKeyClearedAt, setAuthKeyClearedAt] = useState(0);

  const loadKeys = () => {
    setLoadErr(null);
    getApiKeys()
      .then(setMaskedKeys)
      .catch((e) => setLoadErr(e.message));
  };

  useEffect(() => {
    if (activeTab === 'apikey') loadKeys();
  }, [activeTab]);

  const handleStartEdit = (vendorId) => {
    setEditingVendorId(vendorId);
    setEditInput('');
  };

  const handleSaveApiKey = async (vendorId) => {
    try {
      const keys = await saveApiKey(vendorId, editInput);
      setMaskedKeys(keys);
      setEditingVendorId(null);
      setEditInput('');
      setSavedId(vendorId);
      setTimeout(() => setSavedId(null), 2000);
    } catch (e) {
      setLoadErr(e.message);
    }
  };

  const handleCancelEdit = () => {
    setEditingVendorId(null);
    setEditInput('');
  };

  return (
    <div className={`flex-1 w-full max-w-2xl flex flex-col overflow-hidden bg-white ${className}`}>
      {/* 顶部 Tab */}
      <div className="flex-shrink-0 border-b border-[var(--input-bar-border)] px-4">
        <div className="flex gap-1 pt-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`
                px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors duration-200
                ${activeTab === tab.id
                  ? 'bg-white text-blue-500 border border-[var(--input-bar-border)] border-b-white -mb-px'
                  : 'text-[var(--input-placeholder)] hover:text-[var(--skill-btn-text)] hover:bg-[var(--skill-btn-bg)]'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab 内容区 */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {activeTab === 'apikey' && (
          <section className="animate-fade-in">
            <p className="text-sm text-[var(--input-placeholder)] mb-4">
              API Key 保存在本地 data 目录；查看时为加密脱敏显示，可随时修改并保存。
            </p>

            {loadErr && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200">
                <p className="text-sm text-red-700 mb-2">加载失败：{loadErr}</p>
                <p className="text-xs text-red-600 mb-2">请确认已在项目根目录启动后端：<code className="bg-red-100 px-1 rounded">cd backend && npm run dev</code></p>
                <button
                  type="button"
                  onClick={() => loadKeys()}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  重试
                </button>
              </div>
            )}
            <ul className="space-y-4">
              {MODEL_VENDORS.map((vendor) => (
                <li
                  key={vendor.id}
                  className="
                    rounded-xl border border-[var(--input-bar-border)] bg-white p-4
                    shadow-[var(--shadow-input)] hover:shadow-[var(--shadow-input-hover)] transition-shadow
                  "
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className="w-10 h-10 rounded-lg bg-[var(--skill-btn-bg)] flex items-center justify-center flex-shrink-0">
                      {iconVendor}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-[var(--skill-btn-text)]">{vendor.name}</p>
                      <p className="text-xs text-[var(--input-placeholder)]">{vendor.desc}</p>
                    </div>
                  </div>
                  {editingVendorId === vendor.id ? (
                    <div className="flex gap-2 flex-wrap">
                      <input
                        type="password"
                        placeholder="输入新 API Key 后保存"
                        value={editInput}
                        onChange={(e) => setEditInput(e.target.value)}
                        className="
                          flex-1 min-w-0 px-3 py-2 rounded-lg text-sm
                          bg-[var(--skill-btn-bg)] border border-[var(--input-bar-border)]
                          text-[var(--skill-btn-text)] placeholder:text-[var(--input-placeholder)]
                          outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent
                        "
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveApiKey(vendor.id)}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-500 text-white hover:bg-blue-600"
                      >
                        {savedId === vendor.id ? '已保存' : '保存'}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--skill-btn-bg)] text-[var(--skill-btn-text)] hover:bg-[var(--skill-btn-hover)]"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-[var(--skill-btn-text)] font-mono">
                        {maskedKeys[vendor.id] ? `${maskedKeys[vendor.id]}（加密查看，已脱敏）` : '未配置'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleStartEdit(vendor.id)}
                        className="text-sm text-blue-500 hover:text-blue-600"
                      >
                        修改
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {activeTab === 'auth' && (
          <section className="animate-fade-in">
            <p className="text-sm text-[var(--input-placeholder)] mb-4">
              连接密钥用于本应用连接后端时的密钥验证。验证成功后可保存到本机，下次启动自动登录。
            </p>
            <div className="rounded-xl border border-[var(--input-bar-border)] bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--skill-btn-text)]">连接密钥</p>
                  <p className="text-xs text-[var(--input-placeholder)] mt-1">
                    该密钥与模型厂商 API Key 无关，仅用于后端连接认证。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    clearAuthKey?.();
                    setAuthKeyClearedAt(Date.now());
                  }}
                  className="flex-shrink-0 px-3 py-2 rounded-lg text-sm font-medium bg-[var(--skill-btn-bg)] text-[var(--skill-btn-text)] hover:bg-[var(--skill-btn-hover)]"
                >
                  解除当前密钥
                </button>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberAuthKey !== false}
                    onChange={(e) => setRememberAuthKey?.(e.target.checked)}
                    className="rounded border-[var(--input-bar-border)] text-blue-500 focus:ring-blue-400"
                  />
                  <span className="text-sm text-[var(--skill-btn-text)]">记住密钥（下次自动登录）</span>
                </label>
                <div className="text-xs text-[var(--input-placeholder)]">
                  当前状态：{hasStoredAuthKey?.() ? '已保存' : '未保存'}
                  {authKeyClearedAt ? <span className="ml-2 text-green-700">已解除</span> : null}
                </div>
              </div>

              <div className="mt-3 text-xs text-[var(--input-placeholder)]">
                提示：如密钥错误导致认证失败，应用会自动清除已保存的密钥，避免下次启动反复自动失败。
              </div>
            </div>
          </section>
        )}

        {activeTab === 'vendors' && (
          <section className="animate-fade-in">
            <p className="text-sm text-[var(--input-placeholder)] mb-4">
              当前支持以下厂商的模型调用，仅作告知。
            </p>
            <ul className="space-y-2">
              {MODEL_VENDORS.map((vendor) => (
                <li
                  key={vendor.id}
                  className="
                    w-full flex items-center gap-4 px-4 py-3 rounded-xl
                    bg-[var(--skill-btn-bg)] border border-[var(--input-bar-border)]
                    text-left text-[var(--skill-btn-text)]
                  "
                >
                  <span className="flex-shrink-0 w-10 h-10 rounded-lg bg-white border border-[var(--input-bar-border)] flex items-center justify-center">
                    {iconVendor}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{vendor.name}</p>
                    <p className="text-xs text-[var(--input-placeholder)] mt-0.5">{vendor.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {activeTab === 'voice' && (
          <section className="animate-fade-in">
            <VoicePanel />
          </section>
        )}

        {activeTab === 'rules' && (
          <section className="animate-fade-in">
            <h2 className="text-sm font-medium text-[var(--input-placeholder)] uppercase tracking-wide mb-3">
              规则设置
            </h2>
            <p className="text-sm text-[var(--skill-btn-text)]">
              在此配置对话与行为规则，后续实现。
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
