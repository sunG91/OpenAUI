/**
 * 打包后嵌入 exe 图标（因 signAndEditExecutable: false 时 electron-builder 不会嵌入图标）
 */
const path = require('path');
const fs = require('fs');
const { rcedit } = require('rcedit');

const projectRoot = path.join(__dirname, '..');
const exePath = path.join(projectRoot, 'release', 'win-unpacked', 'Open AUI.exe');
const iconPath = path.join(projectRoot, 'dist-app', 'images', 'icon', 'icon256.ico');

async function main() {
  if (!fs.existsSync(exePath)) {
    console.warn('[embed-icon] 未找到 exe:', exePath);
    return;
  }
  if (!fs.existsSync(iconPath)) {
    console.warn('[embed-icon] 未找到图标:', iconPath);
    return;
  }
  await rcedit(exePath, { icon: iconPath });
  console.log('[embed-icon] 已嵌入图标:', exePath);
}

main().catch((e) => {
  console.error('[embed-icon] 失败:', e.message);
  process.exit(1);
});
