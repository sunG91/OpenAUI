/**
 * 语音模块面板：后续接入 STT/TTS 与设备选择
 */
import { useEffect, useState } from 'react';
import { getVoiceSettings, saveVoiceSettings, getTtsVoices } from '../../api/client';

export function VoicePanel({ className = '' }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [savedAt, setSavedAt] = useState(0);

  const [enabled, setEnabled] = useState(true);
  const [saveAudioToLocal, setSaveAudioToLocal] = useState(true);

  const [wakeWordEnabled, setWakeWordEnabled] = useState(false);
  const [wakeWord, setWakeWord] = useState('你好小寒');
  const [wakeWordMode, setWakeWordMode] = useState('push-to-talk');

  const [sttEnabled, setSttEnabled] = useState(true);
  const [sttEngine, setSttEngine] = useState('whisper.cpp');
  const [autoSendAfterStt, setAutoSendAfterStt] = useState(true);

  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [ttsEngine, setTtsEngine] = useState('sapi');
  const [autoReadAssistant, setAutoReadAssistant] = useState(false);
  const [ttsVoice, setTtsVoice] = useState('');
  const [ttsRate, setTtsRate] = useState(0);
  const [ttsVoiceOptions, setTtsVoiceOptions] = useState({ sapi: [], piper: [], edge: [], gptsovits: [] });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr('');
    Promise.all([getVoiceSettings(), getTtsVoices().catch(() => ({ sapi: [], piper: [], edge: [], gptsovits: [] }))])
      .then(([s, voices]) => {
        if (cancelled) return;
        setTtsVoiceOptions({
          sapi: Array.isArray(voices?.sapi) ? voices.sapi : [],
          piper: Array.isArray(voices?.piper) ? voices.piper : [],
          edge: Array.isArray(voices?.edge) ? voices.edge : [],
          gptsovits: Array.isArray(voices?.gptsovits) ? voices.gptsovits : [],
        });
        setEnabled(s.enabled ?? true);
        setSaveAudioToLocal(s.saveAudioToLocal ?? true);

        setWakeWordEnabled(s.wakeWordEnabled ?? false);
        setWakeWord(typeof s.wakeWord === 'string' && s.wakeWord.trim() ? s.wakeWord.trim() : '你好小寒');
        setWakeWordMode(s.wakeWordMode === 'always' ? 'always' : 'push-to-talk');

        setSttEnabled(s.sttEnabled ?? true);
        setSttEngine(s.sttEngine === 'vosk' ? 'vosk' : 'whisper.cpp');
        setAutoSendAfterStt(s.autoSendAfterStt ?? true);

        setTtsEnabled(s.ttsEnabled ?? true);
        setTtsEngine(
          s.ttsEngine === 'gptsovits'
            ? 'gptsovits'
            : s.ttsEngine === 'edge'
              ? 'edge'
              : s.ttsEngine === 'piper'
                ? 'piper'
                : 'sapi'
        );
        setAutoReadAssistant(s.autoReadAssistant ?? false);
        setTtsVoice(typeof s.ttsVoice === 'string' ? s.ttsVoice : '');
        setTtsRate(typeof s.ttsRate === 'number' ? s.ttsRate : 0);
      })
      .catch((e) => {
        if (cancelled) return;
        setErr(e?.message || '加载失败');
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (ttsEngine !== 'piper') return;
    if (ttsVoice && ttsVoice.trim()) return;
    const opts = ttsVoiceOptions.piper || [];
    if (!Array.isArray(opts) || opts.length === 0) return;
    const preferred = opts.find((v) => String(v.id).includes('medium')) || opts[0];
    if (preferred?.id) setTtsVoice(preferred.id);
  }, [ttsEngine, ttsVoice, ttsVoiceOptions.piper]);

  const handleSave = async () => {
    setLoading(true);
    setErr('');
    try {
      await saveVoiceSettings({
        enabled,
        saveAudioToLocal,
        wakeWordEnabled,
        wakeWord: wakeWord.trim(),
        wakeWordMode,
        sttEnabled,
        sttEngine,
        autoSendAfterStt,
        ttsEnabled,
        ttsEngine,
        autoReadAssistant,
        ttsVoice,
        ttsRate
      });
      setSavedAt(Date.now());
    } catch (e) {
      setErr(e?.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`w-full flex flex-col ${className}`}>
      <div className="mb-4">
        <p className="text-sm text-[var(--input-placeholder)]">
          在这里配置语音相关能力（录音、识别、朗读等）。当前为基础占位，后续可接入具体服务。
        </p>
      </div>

      {loading && <div className="mb-3 text-xs text-[var(--input-placeholder)]">加载/保存中…</div>}
      {!!err && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {err}
        </div>
      )}

      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={loading}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            loading ? 'bg-[var(--skill-btn-bg)] text-[var(--input-placeholder)]' : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
        >
          保存设置
        </button>
        {savedAt ? <span className="text-xs text-green-700">已保存</span> : null}
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-[var(--input-bar-border)] bg-white p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--skill-btn-text)]">启用语音</p>
              <p className="text-xs text-[var(--input-placeholder)] mt-1">关闭后，将不进行录音/识别/朗读等操作。</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="rounded border-[var(--input-bar-border)] text-blue-500 focus:ring-blue-400"
              />
              <span className="text-sm text-[var(--skill-btn-text)]">{enabled ? '已启用' : '已关闭'}</span>
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--input-bar-border)] bg-white p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--skill-btn-text)]">本地保存语音</p>
              <p className="text-xs text-[var(--input-placeholder)] mt-1">用于语音条回放与历史记录。</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={saveAudioToLocal}
                onChange={(e) => setSaveAudioToLocal(e.target.checked)}
                className="rounded border-[var(--input-bar-border)] text-blue-500 focus:ring-blue-400"
              />
              <span className="text-sm text-[var(--skill-btn-text)]">{saveAudioToLocal ? '开启' : '关闭'}</span>
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--input-bar-border)] bg-white p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--skill-btn-text)]">唤醒词</p>
              <p className="text-xs text-[var(--input-placeholder)] mt-1">开启后会尝试监听唤醒词（后续实现离线检测）。</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={wakeWordEnabled}
                onChange={(e) => setWakeWordEnabled(e.target.checked)}
                className="rounded border-[var(--input-bar-border)] text-blue-500 focus:ring-blue-400"
              />
              <span className="text-sm text-[var(--skill-btn-text)]">{wakeWordEnabled ? '开启' : '关闭'}</span>
            </label>
          </div>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--input-placeholder)] mb-1">唤醒词</label>
              <input
                value={wakeWord}
                onChange={(e) => setWakeWord(e.target.value)}
                placeholder="例如：你好小寒"
                className="w-full px-3 py-2 rounded-lg text-sm bg-white border border-[var(--input-bar-border)] outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--input-placeholder)] mb-1">监听模式</label>
              <select
                value={wakeWordMode}
                onChange={(e) => setWakeWordMode(e.target.value === 'always' ? 'always' : 'push-to-talk')}
                className="w-full px-3 py-2 rounded-lg text-sm bg-white border border-[var(--input-bar-border)] outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              >
                <option value="push-to-talk">按下语音时监听（省资源）</option>
                <option value="always">常驻监听（更像助手）</option>
              </select>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--input-bar-border)] bg-white p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--skill-btn-text)]">语音转文字（STT）</p>
              <p className="text-xs text-[var(--input-placeholder)] mt-1">把用户语音识别成文字后发给 AI（后续接入离线引擎）。</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={sttEnabled}
                onChange={(e) => setSttEnabled(e.target.checked)}
                className="rounded border-[var(--input-bar-border)] text-blue-500 focus:ring-blue-400"
              />
              <span className="text-sm text-[var(--skill-btn-text)]">{sttEnabled ? '开启' : '关闭'}</span>
            </label>
          </div>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--input-placeholder)] mb-1">识别引擎</label>
              <select
                value={sttEngine}
                onChange={(e) => setSttEngine(e.target.value === 'vosk' ? 'vosk' : 'whisper.cpp')}
                className="w-full px-3 py-2 rounded-lg text-sm bg-white border border-[var(--input-bar-border)] outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              >
                <option value="whisper.cpp">Whisper.cpp（离线，效果更好）</option>
                <option value="vosk">Vosk（离线，资源更省）</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoSendAfterStt}
                  onChange={(e) => setAutoSendAfterStt(e.target.checked)}
                  className="rounded border-[var(--input-bar-border)] text-blue-500 focus:ring-blue-400"
                />
                <span className="text-sm text-[var(--skill-btn-text)]">识别完成后自动发送</span>
              </label>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--input-bar-border)] bg-white p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--skill-btn-text)]">文字转语音（TTS）</p>
              <p className="text-xs text-[var(--input-placeholder)] mt-1">把 AI 的回答朗读出来（后续接入离线引擎）。</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={ttsEnabled}
                onChange={(e) => setTtsEnabled(e.target.checked)}
                className="rounded border-[var(--input-bar-border)] text-blue-500 focus:ring-blue-400"
              />
              <span className="text-sm text-[var(--skill-btn-text)]">{ttsEnabled ? '开启' : '关闭'}</span>
            </label>
          </div>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--input-placeholder)] mb-1">朗读引擎</label>
              <select
                value={ttsEngine}
                onChange={(e) =>
                  setTtsEngine(
                    e.target.value === 'gptsovits'
                      ? 'gptsovits'
                      : e.target.value === 'edge'
                        ? 'edge'
                        : e.target.value === 'piper'
                          ? 'piper'
                          : 'sapi'
                  )
                }
                className="w-full px-3 py-2 rounded-lg text-sm bg-white border border-[var(--input-bar-border)] outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              >
                <option value="sapi">Windows 系统朗读（免费）</option>
                <option value="piper">Piper（离线模型，后续可选）</option>
                <option value="edge">Edge TTS（中文音色更自然）</option>
                <option value="gptsovits">GPT-SoVITS（离线，更自然）</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoReadAssistant}
                  onChange={(e) => setAutoReadAssistant(e.target.checked)}
                  className="rounded border-[var(--input-bar-border)] text-blue-500 focus:ring-blue-400"
                />
                <span className="text-sm text-[var(--skill-btn-text)]">AI 回复自动朗读</span>
              </label>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--input-placeholder)] mb-1">音色（可选）</label>
              <select
                value={ttsVoice}
                onChange={(e) => setTtsVoice(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm bg-white border border-[var(--input-bar-border)] outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              >
                <option value="">（默认）</option>
                {(ttsEngine === 'gptsovits'
                  ? ttsVoiceOptions.gptsovits
                  : ttsEngine === 'edge'
                    ? ttsVoiceOptions.edge
                    : ttsEngine === 'piper'
                      ? ttsVoiceOptions.piper
                      : ttsVoiceOptions.sapi
                ).map((v) => (
                  <option key={v.id} value={v.id}>{v.label}</option>
                ))}
              </select>
              {ttsEngine === 'piper' ? (
                <div className="mt-1 text-[11px] text-[var(--input-placeholder)]">
                  提示：`medium` 质量更自然，`x_low` 更省资源但更“机器感”。
                </div>
              ) : ttsEngine === 'edge' ? (
                <div className="mt-1 text-[11px] text-[var(--input-placeholder)]">
                  提示：Edge TTS 需要联网（免费），中文音色更自然。
                </div>
              ) : ttsEngine === 'gptsovits' ? (
                <div className="mt-1 text-[11px] text-[var(--input-placeholder)]">
                  提示：GPT-SoVITS 当前仅保留入口（占位），需要你自行适配后端接口后才能使用。
                </div>
              ) : null}
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--input-placeholder)] mb-1">语速（-10 ~ 10）</label>
              <input
                type="number"
                value={ttsRate}
                min={-10}
                max={10}
                step={1}
                onChange={(e) => setTtsRate(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg text-sm bg-white border border-[var(--input-bar-border)] outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              />
            </div>
          </div>

        </div>

        <div className="rounded-xl border border-dashed border-[var(--input-bar-border)] bg-[var(--skill-btn-bg)] p-4">
          <p className="text-xs text-[var(--input-placeholder)]">
            说明：这些是“用户可勾选配置”，当前仅做保存与读取。后续接入离线录音/唤醒词/STT/TTS 时会按这里的开关生效。
          </p>
        </div>
      </div>
    </div>
  );
}

