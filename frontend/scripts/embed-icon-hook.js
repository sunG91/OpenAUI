/**
 * electron-builder afterPack 钩子：嵌入 exe 图标
 * 将图标复制到纯 ASCII 临时路径再传给 rcedit，避免中文路径导致失败
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { rcedit } = require('rcedit');

module.exports = async function (context) {
  if (context.electronPlatformName !== 'win32') return;
  const exeName = context.packager.appInfo.productFilename + '.exe';
  const exePath = path.join(context.appOutDir, exeName);
  const iconPath = path.join(context.packager.projectDir, 'dist-app', 'images', 'icon', 'icon256.ico');
  if (!fs.existsSync(exePath) || !fs.existsSync(iconPath)) return;
  const tmpIcon = path.join(os.tmpdir(), `openaui-icon-${Date.now()}.ico`);
  try {
    fs.copyFileSync(iconPath, tmpIcon);
    await rcedit(exePath, { icon: tmpIcon });
    console.log('[afterPack] 已嵌入 exe 图标');
  } catch (e) {
    console.warn('[afterPack] 嵌入图标失败:', e.message);
  } finally {
    try {
      if (fs.existsSync(tmpIcon)) fs.unlinkSync(tmpIcon);
    } catch {}
  }
};
