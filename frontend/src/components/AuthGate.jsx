import { useState, useEffect } from 'react';
import { useWebSocketContext } from '../context/WebSocketContext';

/**
 * 密钥验证门控
 * 当服务端要求密钥时，展示输入框；验证通过或无需密钥时渲染 children
 */
export function AuthGate({ children }) {
  const [key, setKey] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const { connected, authenticated, requireAuth, error, authenticate, reconnect } = useWebSocketContext();

  useEffect(() => {
    if (authenticated || error) setIsVerifying(false);
  }, [authenticated, error]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = key.trim();
    if (!trimmed) {
      setSubmitError('请输入密钥');
      return;
    }
    setSubmitError('');
    setIsVerifying(true);
    authenticate(trimmed);
  };

  if (authenticated) return children;

  if (!connected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <div className="text-gray-500">正在连接后端...</div>
          {error && <div className="text-red-500 text-sm">{error}</div>}
          <button
            type="button"
            onClick={reconnect}
            className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
          >
            重试连接
          </button>
        </div>
      </div>
    );
  }

  if (requireAuth) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-gray-800">Open AUI</h1>
            <p className="mt-2 text-sm text-gray-500">请输入密钥以继续</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="password"
              value={key}
              onChange={(e) => {
              setKey(e.target.value);
              if (submitError) setSubmitError('');
            }}
              placeholder="密钥"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition"
              autoFocus
              autoComplete="off"
            />
            {(submitError || error) && (
              <div className="space-y-1">
                <div className="text-sm text-red-500">{submitError || error}</div>
                {error && error.includes('连接未就绪') && (
                  <button
                    type="button"
                    onClick={() => reconnect()}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    重试连接
                  </button>
                )}
              </div>
            )}
            <button
              type="submit"
              disabled={isVerifying}
              className="w-full py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-medium disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isVerifying ? '验证中...' : '验证'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-gray-500">正在验证...</div>
    </div>
  );
}
