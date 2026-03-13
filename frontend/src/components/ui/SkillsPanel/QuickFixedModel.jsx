/**
 * 快速 - 固定模型：用户选择快速标签时仅使用此处设置的厂商+模型
 */
import { useState, useEffect } from 'react';
import { MODEL_VENDORS, VENDOR_MODELS } from '../../../data/modelVendors';
import { getSkillSettings, saveSkillSettings } from '../../../api/settings';

function getFirstModelId(vid) {
  const list = VENDOR_MODELS[vid] || [];
  return list[0]?.id ?? '';
}

export function QuickFixedModel({ onSaved }) {
  const [vendorId, setVendorId] = useState('');
  const [modelId, setModelId] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadErr, setLoadErr] = useState(null);

  const vendors = MODEL_VENDORS;
  const models = VENDOR_MODELS[vendorId] || [];
  const currentModel = models.find((m) => m.id === modelId) || models[0];

  const load = async () => {
    setLoadErr(null);
    try {
      const s = await getSkillSettings();
      const q = s.quick || {};
      const v = q.vendorId || vendors[0]?.id || '';
      const m = q.modelId || getFirstModelId(v);
      setVendorId(v);
      setModelId(m || getFirstModelId(v));
    } catch (e) {
      setLoadErr(e?.message || '加载失败');
      setVendorId(vendors[0]?.id ?? '');
      setModelId(getFirstModelId(vendors[0]?.id ?? ''));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleVendorChange = (e) => {
    const v = e.target.value;
    setVendorId(v);
    const first = (VENDOR_MODELS[v] || [])[0];
    setModelId(first?.id ?? '');
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await saveSkillSettings({
        quick: {
          vendorId: vendorId.trim(),
          modelId: (modelId || currentModel?.id || '').trim(),
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved?.();
    } catch (e) {
      setLoadErr(e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-[var(--input-bar-border)] bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--input-bar-border)] bg-[#f8f9fa]">
        <h3 className="text-sm font-semibold text-[var(--skill-btn-text)]">快速 - 固定模型</h3>
        <p className="text-xs text-[var(--input-placeholder)] mt-0.5">
          用户选择「快速」标签发送时，仅使用此处设置的厂商与模型，不可选其他模型
        </p>
      </div>
      <div className="p-4 space-y-3">
        {loadErr && <div className="text-xs text-red-600">{loadErr}</div>}
        <div>
          <label className="block text-xs font-medium text-[var(--input-placeholder)] mb-1">厂商</label>
          <select
            value={vendorId}
            onChange={handleVendorChange}
            className="w-full px-3 py-2 text-sm border border-[var(--input-bar-border)] rounded-lg bg-white focus:ring-2 focus:ring-blue-400 outline-none"
          >
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--input-placeholder)] mb-1">模型</label>
          <select
            value={modelId || currentModel?.id}
            onChange={(e) => setModelId(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-[var(--input-bar-border)] rounded-lg bg-white focus:ring-2 focus:ring-blue-400 outline-none"
          >
            {(VENDOR_MODELS[vendorId] || []).map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
        >
          {saving ? '保存中…' : saved ? '已保存' : '保存'}
        </button>
      </div>
    </div>
  );
}
