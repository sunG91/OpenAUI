/**
 * 语音相关 API：STT / TTS
 */
import { API_BASE, wrapNetworkError } from './base';

export async function sttFromAudioBlob(audioBlob) {
  try {
    const fd = new FormData();
    fd.append('audio', audioBlob, 'recording.webm');
    const res = await fetch(`${API_BASE}/api/voice/stt`, { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data;
  } catch (e) {
    throw wrapNetworkError(e);
  }
}

export async function ttsFromText(text, options = {}) {
  try {
    const res = await fetch(`${API_BASE}/api/voice/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, ...options }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data;
  } catch (e) {
    throw wrapNetworkError(e);
  }
}

export async function getTtsVoices() {
  try {
    const res = await fetch(`${API_BASE}/api/voice/tts/voices`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data;
  } catch (e) {
    throw wrapNetworkError(e);
  }
}

