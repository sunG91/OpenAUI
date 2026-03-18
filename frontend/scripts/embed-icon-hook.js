/**
 * electron-builder afterPack 钩子：嵌入 exe 图标
 */
const path = require('path');
const fs = require('fs');
const { rcedit } = require('rcedit');

module.exports = async function (context) {
  if (context.electronPlatformName !== 'win32') return;
  const exeName = context.packager.appInfo.productFilename + '.exe';
  const exePath = path.join(context.appOutDir, exeName);
  const iconPath = path.join(context.packager.projectDir, 'dist-app', 'images', 'icon', 'icon256.ico');
  if (!fs.existsSync(exePath) || !fs.existsSync(iconPath)) return;
  try {
    await rcedit(exePath, { icon: iconPath });
    console.log('[afterPack] 已嵌入 exe 图标');
  } catch (e) {
    console.warn('[afterPack] 嵌入图标失败:', e.message);
  }
};
