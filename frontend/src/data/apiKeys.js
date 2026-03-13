/**
 * 各厂商 API Key 的本地存储（localStorage）
 * key: openaui_apikey_${vendorId}
 */

const PREFIX = 'openaui_apikey_';

export function getApiKey(vendorId) {
  if (typeof localStorage === 'undefined') return '';
  return localStorage.getItem(PREFIX + vendorId) || '';
}

export function setApiKey(vendorId, apiKey) {
  if (typeof localStorage === 'undefined') return;
  if (apiKey && apiKey.trim()) {
    localStorage.setItem(PREFIX + vendorId, apiKey.trim());
  } else {
    localStorage.removeItem(PREFIX + vendorId);
  }
}

export function hasApiKey(vendorId) {
  return !!getApiKey(vendorId);
}
