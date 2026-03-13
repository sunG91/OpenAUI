/**
 * API 基础：后端地址与通用错误处理
 */
export function getBackendPort() {
  if (typeof window === 'undefined') return '9527';
  const params = new URLSearchParams(window.location.search);
  return params.get('backendPort') || '9527';
}

export const API_BASE = import.meta.env.VITE_API_URL || `http://localhost:${getBackendPort()}`;

export function wrapNetworkError(err, apiBase = API_BASE) {
  if (err?.name === 'TypeError' && (err.message === 'Failed to fetch' || err.message?.includes('fetch'))) {
    return new Error(`无法连接后端服务，请确认后端已启动（${apiBase}）`);
  }
  return err;
}
