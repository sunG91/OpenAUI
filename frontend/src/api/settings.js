/**
 * 设置相关 API：API Key 的获取与保存
 */
import { API_BASE, wrapNetworkError } from './base';

export async function getApiKeys() {
  try {
    const res = await fetch(`${API_BASE}/api/settings/apikeys`);
    if (!res.ok) throw new Error(res.statusText);
    const data = await res.json();
    return data.keys || {};
  } catch (e) {
    throw wrapNetworkError(e);
  }
}

export async function saveApiKey(vendorId, apiKey) {
  try {
    const res = await fetch(`${API_BASE}/api/settings/apikeys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendorId, apiKey: apiKey || '' })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data.keys || {};
  } catch (e) {
    throw wrapNetworkError(e);
  }
}

/** 百度智能云 OCR：获取脱敏的 AK/SK */
export async function getBaiduOcrKeys() {
  try {
    const res = await fetch(`${API_BASE}/api/settings/baidu-ocr`);
    if (!res.ok) throw new Error(res.statusText);
    const data = await res.json();
    return { configured: data.configured, masked: data.masked || {} };
  } catch (e) {
    throw wrapNetworkError(e);
  }
}

/** 百度智能云 OCR：保存 AK/SK */
export async function saveBaiduOcrKeys(apiKey, secretKey) {
  try {
    const res = await fetch(`${API_BASE}/api/settings/baidu-ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: apiKey || '', secretKey: secretKey || '' })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data.masked || {};
  } catch (e) {
    throw wrapNetworkError(e);
  }
}

/** 百度 OCR 测试：传入图片 url 或 base64 */
export async function testBaiduOcr({ url, image }) {
  try {
    const res = await fetch(`${API_BASE}/api/ocr/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url || '', image: image || '' })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data;
  } catch (e) {
    throw wrapNetworkError(e);
  }
}

export async function getVoiceSettings() {
  try {
    const res = await fetch(`${API_BASE}/api/settings/voice`);
    if (!res.ok) throw new Error(res.statusText);
    const data = await res.json();
    return data.settings || {};
  } catch (e) {
    throw wrapNetworkError(e);
  }
}

export async function saveVoiceSettings(updates) {
  try {
    const res = await fetch(`${API_BASE}/api/settings/voice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates || {})
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data.settings || {};
  } catch (e) {
    throw wrapNetworkError(e);
  }
}

export async function getSkillSettings() {
  try {
    const res = await fetch(`${API_BASE}/api/settings/skill-settings`);
    if (!res.ok) throw new Error(res.statusText);
    const data = await res.json();
    return data.settings || {};
  } catch (e) {
    throw wrapNetworkError(e);
  }
}

export async function saveSkillSettings(updates) {
  try {
    const res = await fetch(`${API_BASE}/api/settings/skill-settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates || {})
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data.settings || {};
  } catch (e) {
    throw wrapNetworkError(e);
  }
}

export async function getMcpSettings() {
  try {
    const res = await fetch(`${API_BASE}/api/settings/mcp`);
    if (!res.ok) throw new Error(res.statusText);
    const data = await res.json();
    return data.settings || {};
  } catch (e) {
    throw wrapNetworkError(e);
  }
}

export async function saveMcpSettings(updates) {
  try {
    const res = await fetch(`${API_BASE}/api/settings/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates || {})
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data.settings || {};
  } catch (e) {
    throw wrapNetworkError(e);
  }
}
