/**
 * Open AUI - Electron 主进程
 * 启动时同时启动后端 WebSocket 服务
 */
const { app, BrowserWindow, Menu } = require('electron');
// 开发时关闭控制台安全警告（打包后不会出现该警告）
if (!app.isPackaged) {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = '1';
}
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let backendProcess = null;
let mainWindow = null;

// 开发模式检测
const isDev = !app.isPackaged;

const backendPath = path.join(__dirname, '../../backend');
const backendDataDir = path.join(backendPath, 'data');
const backendPortFile = path.join(backendDataDir, 'port.txt');

function setupAppMenu() {
  // 精简中文菜单：只保留主要功能，去掉无关项
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac
      ? [
          {
            label: 'Open AUI',
            submenu: [
              { label: '关于', role: 'about' },
              { type: 'separator' },
              { label: '隐藏', role: 'hide' },
              { label: '隐藏其他', role: 'hideOthers' },
              { label: '显示全部', role: 'unhide' },
              { type: 'separator' },
              { label: '退出', role: 'quit' },
            ],
          },
        ]
      : []),
    {
      label: '文件',
      submenu: [
        isMac ? { label: '关闭窗口', role: 'close' } : { label: '退出', role: 'quit' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { label: '重新加载', role: 'reload' },
        { label: '强制重新加载', role: 'forceReload' },
        { type: 'separator' },
        { label: '全屏', role: 'togglefullscreen' },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// 读取后端实际监听端口（后端若 9527 被占用会改用 9528/9529 并写入 port.txt）
function readBackendPort(callback) {
  const maxWait = 5000;
  const interval = 200;
  let elapsed = 0;
  const t = setInterval(() => {
    try {
      if (fs.existsSync(backendPortFile)) {
        clearInterval(t);
        const port = fs.readFileSync(backendPortFile, 'utf8').trim() || '9527';
        return callback(null, port);
      }
    } catch (e) {}
    elapsed += interval;
    if (elapsed >= maxWait) {
      clearInterval(t);
      callback(null, '9527');
    }
  }, interval);
}

// 启动后端（必须用系统 Node 运行）
function startBackend() {
  const scriptPath = path.join(backendPath, 'src/index.js');
  const nodeCommand = process.platform === 'win32' ? 'node.exe' : 'node';

  // 避免读取到上一次运行遗留的端口文件，导致前端拿到错误端口（例如 9529）
  try {
    if (fs.existsSync(backendPortFile)) fs.unlinkSync(backendPortFile);
  } catch (e) {}

  backendProcess = spawn(nodeCommand, [scriptPath], {
    cwd: backendPath,
    stdio: 'inherit',
    env: { ...process.env },
    // Windows 下启用 shell 容易导致中文路径/编码被 cmd 误解析成“不是内部或外部命令”
    shell: false,
    windowsHide: true,
  });

  backendProcess.on('error', (err) => {
    console.error('后端启动失败:', err);
  });

  backendProcess.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error('后端异常退出:', code);
    }
  });
}

// 停止后端
function stopBackend() {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
}

function createWindow(backendPort = '9527') {
  const devIconPath = path.join(__dirname, '../build/icon.ico');
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 600,
    minHeight: 500,
    ...(isDev && fs.existsSync(devIconPath) ? { icon: devIconPath } : {}),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: 'default',
    show: false,
    autoHideMenuBar: process.platform === 'win32',
  });

  if (isDev) {
    mainWindow.loadURL(`http://localhost:5173?backendPort=${backendPort}`);
    // 开发环境也不默认打开 DevTools（避免启动就弹 F12 面板）
  } else {
    // 生产环境同样注入 backendPort，避免后端端口回退到 9528/9529 时前端仍固定连 9527
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'), {
      query: { backendPort: String(backendPort || '9527') },
    });
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  setupAppMenu();
  startBackend();
  readBackendPort((_err, port) => {
    createWindow(port);
  });

  app.on('window-all-closed', () => {
    stopBackend();
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
