/**
 * Open AUI 后端入口
 * 模块化：config、routes、services/modelProviders、ws 各自独立，便于扩展
 */
const http = require('http');
const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { loadConfig } = require('./config/loadConfig');
const { mountSettingsRoutes } = require('./routes/settings');
const { mountTestModelRoutes } = require('./routes/testModel');
const { mountVoiceRoutes } = require('./routes/voice');
const { mountToolsRoutes } = require('./routes/tools');
const { mountMcpRoutes } = require('./routes/mcp');
const { router: skillsRouter } = require('./routes/skills');
const { createConnectionHandler } = require('./ws/handler');

const config = loadConfig();
const { initTokenOnStartup } = require('./services/baidu-ocr');
const { port, host } = config.server;
const { requireKey, allowedKeys } = config.auth;

const app = express();
app.use(cors({ origin: true }));
// 默认 JSON 体积限制很小（~100KB），多张图片 base64 会触发 Payload Too Large（413）
// 这里放宽到 20MB，便于多模态图片测试使用；如需更大可再按需调整
app.use(express.json({ limit: '20mb' }));

mountSettingsRoutes(app);
mountTestModelRoutes(app);
mountVoiceRoutes(app);
mountToolsRoutes(app);
mountMcpRoutes(app);
app.use('/api/skills', skillsRouter);
const { mountCanvasRoutes } = require('./routes/canvas');
mountCanvasRoutes(app);

const server = http.createServer(app);
const wss = new WebSocket.Server({ server, clientTracking: true });
wss.on('connection', createConnectionHandler({ requireKey, allowedKeys }));

const dataDir = path.join(__dirname, '../data');
const portsToTry = [port, 9528, 9529];
let portIndex = 0;

function onListenError(err) {
  if (err.code === 'EADDRINUSE') {
    portIndex++;
    tryListen();
  } else {
    console.error(err);
    process.exit(1);
  }
}

function tryListen() {
  const p = portsToTry[portIndex];
  if (p == null) {
    console.error('[Open AUI] 端口 9527/9528/9529 均被占用，请关闭占用进程后重试');
    process.exit(1);
  }
  server.once('error', onListenError);
  wss.once('error', onListenError);
  server.listen(p, host, () => {
    server.removeListener('error', onListenError);
    wss.removeListener('error', onListenError);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'port.txt'), String(p), 'utf8');
    console.log(`[Open AUI] 服务已启动: http://${host}:${p}  (HTTP API + WebSocket)`);
    initTokenOnStartup().catch(() => {});
    console.log(`[Open AUI] 密钥验证: ${requireKey ? '已启用' : '已关闭'}`);
  });
}
tryListen();
