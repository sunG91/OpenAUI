/**
 * Open AUI - Electron 主进程
 * 启动时同时启动后端 WebSocket 服务
 */
const { app, BrowserWindow, Menu, session, desktopCapturer, ipcMain } = require('electron');
// 开发时关闭控制台安全警告（打包后不会出现该警告）
if (!app.isPackaged) {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = '1';
}
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const guiNode = require('./gui-node');

let backendProcess = null;
let mainWindow = null;

// 开发模式检测
const isDev = !app.isPackaged;

// 打包后：backend 和 node 在 resources 目录；开发时：相对于 main.js
const backendPath = app.isPackaged
  ? path.join(process.resourcesPath, 'backend')
  : path.join(__dirname, '../../backend');
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

// 启动后端（打包后用捆绑的 Node，开发时用系统 Node）
function startBackend() {
  const scriptPath = path.join(backendPath, 'src/index.js');
  let nodeCommand;
  if (app.isPackaged && process.platform === 'win32') {
    const bundledNode = path.join(process.resourcesPath, 'node', 'node.exe');
    nodeCommand = fs.existsSync(bundledNode) ? bundledNode : 'node.exe';
  } else {
    nodeCommand = process.platform === 'win32' ? 'node.exe' : 'node';
  }

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
  const appRoot = app.getAppPath();
  const resourcesPath = process.resourcesPath || appRoot;
  const iconPath1 = path.join(appRoot, 'dist-app', 'images', 'icon', 'icon256.ico');
  const iconPath2 = path.join(appRoot, 'dist-app', 'images', 'icon', 'icon.ico');
  const iconPath3 = path.join(appRoot, 'build', 'icon.ico');
  const iconPath4 = path.join(resourcesPath, 'icon', 'icon256.ico');
  const iconPath5 = path.join(resourcesPath, 'icon', 'icon.ico');
  const iconPath = [iconPath1, iconPath2, iconPath3, iconPath4, iconPath5].find((p) => fs.existsSync(p));
  const hasIcon = !!iconPath;
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 600,
    minHeight: 500,
    ...(hasIcon ? { icon: iconPath } : {}),
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
    // 生产环境：使用 app 根目录的 dist，确保打包后路径正确
    const distPath = path.join(appRoot, 'dist-app', 'index.html');
    mainWindow.loadFile(distPath, {
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
  // 让 getDisplayMedia() 在渲染进程可用：用 desktopCapturer 提供屏幕源，截屏必须支持
  try {
    session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
      desktopCapturer
        .getSources({ types: ['screen', 'window'] })
        .then((sources) => {
          const screen = sources.find((s) => s.id.startsWith('screen:')) || sources[0];
          if (screen) callback({ video: screen });
          else callback({});
        })
        .catch(() => callback({}));
    });
  } catch (e) {
    console.warn('[Open AUI] setDisplayMediaRequestHandler 不可用，截屏将依赖 preload 后备:', e?.message);
  }
  // GUI 节点执行：IPC 处理（当 tools.guiExecutor === 'node' 时由主进程执行 GUI）
  ipcMain.handle('gui:setProvider', (_, p) => guiNode.setProvider(p));
  ipcMain.handle('gui:mouseMove', (_, x, y) => guiNode.mouseMove(x, y));
  ipcMain.handle('gui:mouseClick', (_, opts) => guiNode.mouseClick(opts));
  ipcMain.handle('gui:keyboardType', (_, text) => guiNode.keyboardType(text));
  ipcMain.handle('gui:screenCapture', () => guiNode.screenCapture());
  ipcMain.handle('gui:screenSize', () => guiNode.screenSize());

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
