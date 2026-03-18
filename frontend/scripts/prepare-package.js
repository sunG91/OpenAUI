/**
 * 打包前准备：复制 Node 可执行文件，供 Electron 打包后启动后端使用
 * 运行于 npm run electron:build 时，确保后端可在无系统 Node 环境下运行
 */
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const nodeDir = path.join(projectRoot, 'build', 'node');

function main() {
  fs.mkdirSync(nodeDir, { recursive: true });
  const nodeSource = process.execPath; // 当前 Node 可执行文件路径
  const nodeDest = path.join(nodeDir, process.platform === 'win32' ? 'node.exe' : 'node');
  if (!fs.existsSync(nodeSource)) {
    console.warn('[prepare-package] 未找到 Node 可执行文件，打包后将依赖系统 PATH 中的 node');
    return;
  }
  fs.copyFileSync(nodeSource, nodeDest);
  console.log(`[prepare-package] 已复制 Node: ${nodeDest}`);
}

main();
