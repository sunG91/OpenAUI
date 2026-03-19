/**
 * 打包前：将 public/images/icon/icon256.ico 复制到 dist-app，供 electron-builder 使用
 * 直接使用你的 icon256.ico，不进行任何转换
 */
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const srcIco = path.join(projectRoot, 'public', 'images', 'icon', 'icon256.ico');
const outDir = path.join(projectRoot, 'dist-app', 'images', 'icon');
const outIco = path.join(outDir, 'icon256.ico');

function main() {
  if (!fs.existsSync(srcIco)) {
    console.warn('[ensure-icon-256] 未找到 public/images/icon/icon256.ico，跳过');
    return;
  }
  fs.mkdirSync(outDir, { recursive: true });
  fs.copyFileSync(srcIco, outIco);
  console.log('[ensure-icon-256] 已复制 icon256.ico:', outIco);
}

main();
