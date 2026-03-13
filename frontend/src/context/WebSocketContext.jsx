import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

const MSG_AUTH_REQUIRED = 'auth_required';
const MSG_AUTH_OK = 'auth_ok';
const MSG_AUTH_FAIL = 'auth_fail';
const MSG_ECHO = 'echo';
const MSG_PONG = 'pong';

const WebSocketContext = createContext(null);

const AUTH_KEY_STORAGE = 'openaui.authKey';
const REMEMBER_AUTH_KEY_STORAGE = 'openaui.rememberAuthKey';

function getStoredAuthKey() {
  try {
    return localStorage.getItem(AUTH_KEY_STORAGE) || '';
  } catch {
    return '';
  }
}

function getRememberAuthKey() {
  try {
    const v = localStorage.getItem(REMEMBER_AUTH_KEY_STORAGE);
    if (v == null) return true; // 默认开启
    return v === '1';
  } catch {
    return true;
  }
}

function setRememberAuthKey(enabled) {
  try {
    localStorage.setItem(REMEMBER_AUTH_KEY_STORAGE, enabled ? '1' : '0');
  } catch {}
}

function setStoredAuthKey(key) {
  try {
    localStorage.setItem(AUTH_KEY_STORAGE, key);
  } catch {}
}

function clearStoredAuthKey() {
  try {
    localStorage.removeItem(AUTH_KEY_STORAGE);
  } catch {}
}

export function WebSocketProvider({ url, children }) {
  const [connected, setConnected] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [requireAuth, setRequireAuth] = useState(false);
  const [error, setError] = useState(null);
  const [lastMessage, setLastMessage] = useState(null);
  const [rememberAuthKey, setRememberAuthKeyState] = useState(() => getRememberAuthKey());
  const wsRef = useRef(null);
  const lastAuthAttemptRef = useRef('');
  const autoAuthTriedRef = useRef(false);

  const send = useCallback((type, payload = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const body = JSON.stringify({ type, ...payload });
      wsRef.current.send(body);
      if (type === 'auth') console.log('[WebSocket] 已发送验证请求 auth');
    }
  }, []);

  const authenticate = useCallback((key) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      console.warn('[WebSocket] 验证失败：连接未就绪', wsRef.current?.readyState);
      setError('连接未就绪，请点击「重试连接」或刷新页面后再验证');
      return;
    }
    setError(null);
    lastAuthAttemptRef.current = key;
    send('auth', { key });
  }, [send]);

  const connect = useCallback(() => {
    if (!url) return;
    setError(null);
    console.log('[WebSocket] 正在连接:', url);

    const ws = new WebSocket(url);
    wsRef.current = ws;
    autoAuthTriedRef.current = false;

    ws.onopen = () => {
      setConnected(true);
      console.log('[WebSocket] 连接成功:', url);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        setLastMessage(msg);
        if (msg.type === 'auth_ok' || msg.type === 'auth_fail' || msg.type === 'auth_required') {
          console.log('[WebSocket] 收到:', msg.type, msg.message || '');
        }
        switch (msg.type) {
          case MSG_AUTH_REQUIRED:
            setRequireAuth(true);
            setAuthenticated(false);
            // 自动登录：如果本机保存过密钥，且当前连接还未尝试过，则自动发起一次认证
            if (!autoAuthTriedRef.current) {
              const stored = rememberAuthKey ? getStoredAuthKey() : '';
              if (stored && rememberAuthKey) {
                autoAuthTriedRef.current = true;
                console.log('[WebSocket] 检测到已保存密钥，自动尝试认证');
                authenticate(stored);
              }
            }
            break;
          case MSG_AUTH_OK:
            setRequireAuth(false);
            setAuthenticated(true);
            setError(null);
            if (rememberAuthKey && lastAuthAttemptRef.current) setStoredAuthKey(lastAuthAttemptRef.current);
            break;
          case MSG_AUTH_FAIL:
            setAuthenticated(false);
            setError(msg.message || '认证失败');
            // 认证失败：若当前设备保存过密钥，且本次尝试与保存的一致，则自动清除，避免下次反复自动失败
            if (rememberAuthKey) {
              const stored = getStoredAuthKey();
              if (stored && lastAuthAttemptRef.current && stored === lastAuthAttemptRef.current) {
                clearStoredAuthKey();
                lastAuthAttemptRef.current = '';
                console.warn('[WebSocket] 认证失败，已自动清除本机保存的密钥');
              }
            }
            break;
          default:
            break;
        }
      } catch {
        setLastMessage({ raw: event.data });
      }
    };

    ws.onclose = () => {
      setConnected(false);
      setAuthenticated(false);
      if (wsRef.current === ws) wsRef.current = null;
      console.log('[WebSocket] 连接已关闭');
    };

    ws.onerror = () => {
      setError('连接失败');
      console.error('[WebSocket] 连接错误，请确认后端已启动且端口正确');
    };
  }, [url]);

  useEffect(() => {
    // 延迟建立连接，避免 React Strict Mode 下首次 effect 的 cleanup 在连接建立前关闭 socket 导致报错
    const t = setTimeout(() => connect(), 50);
    return () => {
      clearTimeout(t);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const value = {
    connected,
    authenticated,
    requireAuth,
    error,
    lastMessage,
    send,
    authenticate,
    reconnect: connect,
    rememberAuthKey,
    setRememberAuthKey: (enabled) => {
      const v = !!enabled;
      setRememberAuthKeyState(v);
      setRememberAuthKey(v);
      if (!v) {
        // 关闭记住：立即清除本机保存的密钥，且后续不再自动登录
        clearStoredAuthKey();
        lastAuthAttemptRef.current = '';
      }
    },
    clearAuthKey: () => {
      clearStoredAuthKey();
      lastAuthAttemptRef.current = '';
    },
    hasStoredAuthKey: () => !!getStoredAuthKey(),
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketContext() {
  const ctx = useContext(WebSocketContext);
  if (!ctx) throw new Error('useWebSocketContext must be used within WebSocketProvider');
  return ctx;
}
