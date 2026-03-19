/**
 * 从打包内的 node-portable.zip 解压 Node 到 userData
 * 用户只看到解压和配置过程，无需联网下载
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function extractZip(zipPath, extractDir, sendProgress) {
  fs.mkdirSync(extractDir, { recursive: true });
  const result = spawnSync(
    'powershell',
    ['-NoProfile', '-Command', `Expand-Archive -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${extractDir.replace(/'/g, "''")}' -Force`],
    { stdio: 'pipe', shell: true }
  );
  if (result.status !== 0) throw new Error('解压失败');
}

function findNodeExe(dir) {
  const name = process.platform === 'win32' ? 'node.exe' : 'node';
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory() && e.name.startsWith('node-')) {
      const exe = path.join(dir, e.name, name);
      if (fs.existsSync(exe)) return exe;
    }
  }
  return null;
}

/**
 * 从 resources 内的 zip 解压 Node 到 userData
 * @param {Electron.BrowserWindow} progressWindow - 用于发送进度的窗口
 * @returns {Promise<string>} node.exe 路径
 */
async function extractNode(progressWindow) {
  const { app } = require('electron');
  const userData = app.getPath('userData');
  const outDir = path.join(userData, 'node-portable');
  const nodeExe = path.join(outDir, process.platform === 'win32' ? 'node.exe' : 'node');

  if (fs.existsSync(nodeExe)) return nodeExe;

  const resPath = process.resourcesPath || app.getAppPath();
  const zipPath = path.join(resPath, 'node-portable.zip');
  if (!fs.existsSync(zipPath)) {
    throw new Error('未找到 node-portable.zip，请重新安装');
  }

  const send = (ev, data) => {
    if (progressWindow && !progressWindow.isDestroyed()) {
      progressWindow.webContents.send(ev, data);
    }
  };

  send('node-download-progress', { loaded: 0, total: 1 });
  const extractDir = path.join(outDir, 'extract');
  extractZip(zipPath, extractDir, send);

  const found = findNodeExe(extractDir);
  if (!found) throw new Error('解压后未找到 node');
  fs.mkdirSync(outDir, { recursive: true });
  fs.copyFileSync(found, nodeExe);
  try {
    fs.rmSync(extractDir, { recursive: true, force: true });
  } catch {}
  send('node-download-progress', { loaded: 1, total: 1 });
  send('node-download-done');
  return nodeExe;
}

module.exports = { extractNode };
