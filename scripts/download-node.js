#!/usr/bin/env node
/**
 * 下载 Node.js 便携版到指定目录
 * 用于：1) 无 Node 用户通过 install.bat 引导安装  2) 打包时 prepare-package 备用
 *
 * 用法：node scripts/download-node.js [--out-dir <dir>]
 * 默认输出：frontend/build/node（供打包）或 项目根/.node-portable（供开发）
 */
const https = require('https');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const NODE_VERSION = 'v22.12.0';
const BASE_URL = `https://nodejs.org/dist/${NODE_VERSION}`;

function getDownloadUrl() {
  const plat = process.platform;
  const arch = process.arch === 'x64' ? 'x64' : process.arch === 'arm64' ? 'arm64' : 'x64';
  if (plat === 'win32') {
    return `${BASE_URL}/node-${NODE_VERSION.replace('v', '')}-win-${arch}.zip`;
  }
  if (plat === 'darwin') {
    const suffix = arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
    return `${BASE_URL}/node-${NODE_VERSION.replace('v', '')}-${suffix}.tar.gz`;
  }
  if (plat === 'linux') {
    return `${BASE_URL}/node-${NODE_VERSION.replace('v', '')}-linux-${arch}.tar.xz`;
  }
  throw new Error(`不支持的平台: ${plat}`);
}

function getArchiveName() {
  const url = getDownloadUrl();
  return path.basename(url);
}

function download(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { followRedirect: true }, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        return download(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error(`下载失败: ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(120000, () => {
      req.destroy();
      reject(new Error('下载超时'));
    });
  });
}

function extractZip(buf, extractDir) {
  fs.mkdirSync(extractDir, { recursive: true });
  const zipPath = path.join(extractDir, 'node.zip');
  fs.writeFileSync(zipPath, buf);
  const result = spawnSync(
    'powershell',
    ['-NoProfile', '-Command', `Expand-Archive -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${extractDir.replace(/'/g, "''")}' -Force`],
    { stdio: 'inherit', shell: true }
  );
  try {
    fs.unlinkSync(zipPath);
  } catch {}
  if (result.status !== 0) throw new Error('解压失败');
}

function extractTarGz(buf, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const tarPath = path.join(outDir, 'node.tar.gz');
  fs.writeFileSync(tarPath, buf);
  const result = spawnSync('tar', ['-xzf', tarPath, '-C', outDir], { stdio: 'inherit' });
  try {
    fs.unlinkSync(tarPath);
  } catch {}
  if (result.status !== 0) throw new Error('解压失败');
}

function extractTarXz(buf, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const tarPath = path.join(outDir, 'node.tar.xz');
  fs.writeFileSync(tarPath, buf);
  const result = spawnSync('tar', ['-xJf', tarPath, '-C', outDir], { stdio: 'inherit' });
  try {
    fs.unlinkSync(tarPath);
  } catch {}
  if (result.status !== 0) throw new Error('解压失败');
}

function extract(buf, outDir, archiveName) {
  if (archiveName.endsWith('.zip')) {
    extractZip(buf, outDir);
  } else if (archiveName.endsWith('.tar.gz')) {
    extractTarGz(buf, outDir);
  } else if (archiveName.endsWith('.tar.xz')) {
    extractTarXz(buf, outDir);
  } else {
    throw new Error(`不支持的格式: ${archiveName}`);
  }
}

function findNodeExe(dir) {
  const name = process.platform === 'win32' ? 'node.exe' : 'node';
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory()) {
      const sub = path.join(dir, e.name);
      if (e.name.startsWith('node-')) {
        const exe = path.join(sub, name);
        if (fs.existsSync(exe)) return exe;
      }
      const found = findNodeExe(sub);
      if (found) return found;
    } else if (e.name === name) {
      return path.join(dir, e.name);
    }
  }
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  let outDir = path.join(__dirname, '..', '.node-portable');
  const outIdx = args.indexOf('--out-dir');
  if (outIdx >= 0 && args[outIdx + 1]) {
    outDir = path.resolve(args[outIdx + 1]);
  }

  const url = getDownloadUrl();
  const archiveName = getArchiveName();
  console.log('[download-node] 下载 Node.js', NODE_VERSION, '...');
  console.log('[download-node] URL:', url);

  const buf = await download(url);
  console.log('[download-node] 已下载', (buf.length / 1024 / 1024).toFixed(1), 'MB');

  const extractDir = path.join(outDir, 'extract');
  extract(buf, extractDir, archiveName);

  const nodeExe = findNodeExe(extractDir);
  if (!nodeExe) {
    throw new Error('解压后未找到 node 可执行文件');
  }

  fs.mkdirSync(outDir, { recursive: true });
  const destExe = path.join(outDir, process.platform === 'win32' ? 'node.exe' : 'node');
  if (nodeExe !== destExe) {
    fs.copyFileSync(nodeExe, destExe);
    if (process.platform !== 'win32') {
      fs.chmodSync(destExe, 0o755);
    }
  }

  try {
    fs.rmSync(extractDir, { recursive: true, force: true });
  } catch {}

  console.log('[download-node] 已安装到:', destExe);
  return destExe;
}

main().catch((e) => {
  console.error('[download-node] 失败:', e.message);
  process.exit(1);
});
