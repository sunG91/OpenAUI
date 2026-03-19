/**
 * 打包前准备：下载 Node 便携版 zip 存本地，打包时带进去
 * 用户首次运行只需解压和配置，无需联网下载
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const projectRoot = path.join(__dirname, '..');
const buildDir = path.join(projectRoot, 'build');
const zipPath = path.join(buildDir, 'node-portable.zip');

const NODE_VERSION = '22.12.0';
const BASE_URL = `https://nodejs.org/dist/v${NODE_VERSION}`;

function getDownloadUrl() {
  const plat = process.platform;
  const arch = process.arch === 'x64' ? 'x64' : process.arch === 'arm64' ? 'arm64' : 'x64';
  if (plat === 'win32') return `${BASE_URL}/node-v${NODE_VERSION}-win-${arch}.zip`;
  if (plat === 'darwin') {
    const suffix = arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
    return `${BASE_URL}/node-v${NODE_VERSION}-${suffix}.tar.gz`;
  }
  if (plat === 'linux') return `${BASE_URL}/node-v${NODE_VERSION}-linux-${arch}.tar.xz`;
  throw new Error(`不支持的平台: ${plat}`);
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
      let loaded = 0;
      const total = parseInt(res.headers['content-length'], 10) || 0;
      res.on('data', (c) => {
        chunks.push(c);
        loaded += c.length;
        if (total && loaded % (1024 * 1024) < c.length) {
          process.stdout.write(`\r[prepare-package] 下载中 ${(loaded / 1024 / 1024).toFixed(1)} / ${(total / 1024 / 1024).toFixed(1)} MB`);
        }
      });
      res.on('end', () => {
        process.stdout.write('\n');
        resolve(Buffer.concat(chunks));
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(180000, () => { req.destroy(); reject(new Error('下载超时')); });
  });
}

async function main() {
  if (fs.existsSync(zipPath)) {
    console.log('[prepare-package] 已存在 node-portable.zip，跳过下载');
    return;
  }
  fs.mkdirSync(buildDir, { recursive: true });
  const url = getDownloadUrl();
  console.log('[prepare-package] 下载 Node.js', NODE_VERSION, '...');
  const buf = await download(url);
  fs.writeFileSync(zipPath, buf);
  console.log('[prepare-package] 已保存:', zipPath);
}

main().catch((e) => {
  console.error('[prepare-package] 失败:', e.message);
  process.exit(1);
});
