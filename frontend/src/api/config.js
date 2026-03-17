/**
 * 统一配置 API - 所有配置（MCP、Skills、模型、语音等）集中操作
 */
import { API_BASE, wrapNetworkError } from './base';

const VALID_SECTIONS = ['mcp', 'skill', 'skillsLibrary', 'voice', 'model'];

export async function getConfig() {
  try {
    const res = await fetch(`${API_BASE}/api/config`);
    if (!res.ok) throw new Error(res.statusText);
    const data = await res.json();
    return data.config || {};
  } catch (e) {
    throw wrapNetworkError(e);
  }
}

export async function getConfigSection(section) {
  if (!VALID_SECTIONS.includes(section)) {
    throw new Error(`无效 section: ${section}`);
  }
  try {
    const res = await fetch(`${API_BASE}/api/config/${section}`);
    if (!res.ok) throw new Error(res.statusText);
    const data = await res.json();
    return data[section] || {};
  } catch (e) {
    throw wrapNetworkError(e);
  }
}

export async function updateConfigSection(section, updates) {
  if (!VALID_SECTIONS.includes(section)) {
    throw new Error(`无效 section: ${section}`);
  }
  try {
    const res = await fetch(`${API_BASE}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section, updates: updates || {} }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data.config || {};
  } catch (e) {
    throw wrapNetworkError(e);
  }
}
