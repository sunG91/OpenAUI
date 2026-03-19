/**
 * 打包后嵌入 exe 图标
 * 使用 resedit（纯 JS）替代 rcedit，避免路径/编码问题
 */
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..', '..');
const frontendRoot = path.resolve(__dirname, '..');
const exePath = path.join(projectRoot, 'release', 'win-unpacked', 'Open AUI.exe');

const ICON_CANDIDATES = [
  path.join(frontendRoot, 'public', 'images', 'icon', 'icon256.ico'),
  path.join(frontendRoot, 'public', 'images', 'icon', 'icon.ico'),
  path.join(frontendRoot, 'dist-app', 'images', 'icon', 'icon256.ico'),
];

function findIcon() {
  for (const p of ICON_CANDIDATES) {
    if (fs.existsSync(p)) return path.resolve(p);
  }
  return null;
}

function clearIconCache() {
  if (process.platform !== 'win32') return;
  try {
    spawnSync('ie4uinit.exe', ['-ClearIconCache'], { stdio: 'ignore', windowsHide: true });
    // 尝试删除图标缓存文件，需重启资源管理器或注销后生效
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
      const iconCache = path.join(localAppData, 'IconCache.db');
      const explorerDir = path.join(localAppData, 'Microsoft', 'Windows', 'Explorer');
      try {
        if (fs.existsSync(iconCache)) fs.unlinkSync(iconCache);
      } catch {}
      try {
        if (fs.existsSync(explorerDir)) {
          fs.readdirSync(explorerDir)
            .filter((f) => f.startsWith('iconcache'))
            .forEach((f) => {
              try {
                fs.unlinkSync(path.join(explorerDir, f));
              } catch {}
            });
        }
      } catch {}
    }
  } catch {}
}

async function main() {
  const iconPath = findIcon();
  if (!fs.existsSync(exePath)) {
    console.warn('[embed-icon] 未找到 exe（electron-builder 可能未成功）:', exePath);
    return;
  }
  if (!iconPath) {
    console.warn('[embed-icon] 未找到图标，已尝试:', ICON_CANDIDATES);
    process.exit(1);
  }

  const { NtExecutable, NtExecutableResource } = await import('pe-library');
  const ResEdit = await import('resedit');

  const exeBuf = fs.readFileSync(exePath);
  const exe = NtExecutable.from(exeBuf, { ignoreCert: true });
  const res = NtExecutableResource.from(exe);

  const iconFile = ResEdit.Data.IconFile.from(fs.readFileSync(iconPath));
  const iconGroups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
  const iconGroupIds = iconGroups.map((g) => g.id);

  const targetId = iconGroupIds.length > 0 ? iconGroupIds[0] : 101;
  const lang = 1033;

  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
    res.entries,
    targetId,
    lang,
    iconFile.icons.map((item) => item.data)
  );

  res.outputResource(exe);
  const newBinary = exe.generate();
  fs.writeFileSync(exePath, Buffer.from(newBinary));

  console.log('[embed-icon] 已嵌入图标 (resedit)');
  clearIconCache();
  console.log('[embed-icon] 已清除图标缓存。若仍显示旧图标：按 F5 刷新，或重启资源管理器，或注销/重启系统');
}

main().catch((e) => {
  console.error('[embed-icon] 失败:', e.message);
  if (e.stack) console.error(e.stack);
  process.exit(1);
});
