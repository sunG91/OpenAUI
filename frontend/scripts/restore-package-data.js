/**
 * 打包后：恢复开发者的本地配置（apikeys、config 等）
 */
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..', '..');
const backendData = path.join(projectRoot, 'backend', 'data');
const backendSrcData = path.join(projectRoot, 'backend', 'src', 'data');
const BACKUP_META = path.join(projectRoot, 'frontend', '.pack-backup-meta.json');

function main() {
  if (!fs.existsSync(BACKUP_META)) {
    console.log('[restore-package-data] 无备份元数据，跳过恢复');
    return;
  }
  let meta;
  try {
    meta = JSON.parse(fs.readFileSync(BACKUP_META, 'utf8'));
  } catch {
    console.log('[restore-package-data] 备份元数据无效，跳过恢复');
    fs.unlinkSync(BACKUP_META);
    return;
  }
  const { backupDir } = meta;
  if (!backupDir || !fs.existsSync(backupDir)) {
    console.log('[restore-package-data] 备份目录不存在，跳过恢复');
    fs.unlinkSync(BACKUP_META);
    return;
  }
  for (const item of meta.backedUp || []) {
    const src = item.from || path.join(backupDir, item);
    const dest = item.to;
    if (dest && fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
    }
  }
  try {
    fs.rmSync(backupDir, { recursive: true });
  } catch {}
  fs.unlinkSync(BACKUP_META);
  console.log('[restore-package-data] 已恢复本地配置');
}

main();
