import { useState, useEffect, useRef } from 'react';
import { WebSocketProvider } from './context/WebSocketContext';
import { AuthGate } from './components/AuthGate';
import { MainLayout } from './components/MainLayout';
import { getBackendPort } from './api/client';

const DEFAULT_WS_URL = () =>
  import.meta.env.VITE_WS_URL || `ws://localhost:${getBackendPort()}`;

export default function App() {
  const [config, setConfig] = useState({ wsUrl: DEFAULT_WS_URL() });

  useEffect(() => {
    fetch('/config.json')
      .then((r) => (r.ok ? r.json() : {}))
      .then((c) => setConfig((prev) => ({ ...prev, ...c })))
      .catch(() => {});
  }, []);

  const wsUrl = config.wsUrl || DEFAULT_WS_URL();
  const logged = useRef(false);
  useEffect(() => {
    if (import.meta.env.DEV && wsUrl && !logged.current) {
      console.log('[App] WebSocket 地址:', wsUrl, '| URL 中的 backendPort:', getBackendPort());
      logged.current = true;
    }
  }, [wsUrl]);

  return (
    <WebSocketProvider url={wsUrl}>
      <AuthGate>
        <MainLayout />
      </AuthGate>
    </WebSocketProvider>
  );
}
