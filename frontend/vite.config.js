import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version || '0.0.0'),
    __APP_LICENSE__: JSON.stringify(pkg.license || 'Apache-2.0'),
  },
  base: './',
  build: {
    outDir: 'dist-app',
  },
  server: {
    port: 5173,
    strictPort: true, // 端口被占用时直接报错，避免静默改用 5174 导致 Electron 加载错地址
  },
});
