/**
 * 打包前：用空配置替换敏感数据，避免 apikeys、config 等被打包进 exe
 * 备份文件来自 backend/data/backup 与 backend/src/data/backup
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const projectRoot = path.join(__dirname, '..', '..');
const backendData = path.join(projectRoot, 'backend', 'data');
const backendSrcData = path.join(projectRoot, 'backend', 'src', 'data');
const backupData = path.join(backendData, 'backup');
const backupSrcData = path.join(backendSrcData, 'backup');
const BACKUP_META = path.join(projectRoot, 'frontend', '.pack-backup-meta.json');

const DATA_FILES = [
  'apikeys.json',
  'config.json',
  'chat-history.json',
  'baidu-ocr-token.json',
  'mcp-settings.json',
  'skill-settings.json',
  'voice-settings.json',
  'skills-library.json',
];
const SRC_DATA_FILES = ['mcp-http-credentials.json', 'mcp-vendors.json'];

function main() {
  const backupDir = path.join(os.tmpdir(), `openaui-pack-backup-${Date.now()}`);
  fs.mkdirSync(path.join(backupDir, 'data'), { recursive: true });
  fs.mkdirSync(path.join(backupDir, 'src-data'), { recursive: true });

  const backedUp = [];
  fs.mkdirSync(backendData, { recursive: true });

  // 备份并替换 backend/data
  for (const name of DATA_FILES) {
    const src = path.join(backendData, name);
    const backup = path.join(backupData, name);
    const destBackup = path.join(backupDir, 'data', name);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, destBackup);
      backedUp.push({ from: path.join(backupDir, 'data', name), to: src });
    }
    if (fs.existsSync(backup)) {
      fs.copyFileSync(backup, src);
    } else if (['apikeys.json', 'config.json', 'chat-history.json'].includes(name)) {
      const empty = name === 'chat-history.json' ? '{"sessions":[]}' : '{}';
      fs.writeFileSync(src, empty, 'utf8');
    }
  }

  // 备份并替换 backend/src/data
  fs.mkdirSync(backendSrcData, { recursive: true });
  fs.mkdirSync(path.join(backupDir, 'src-data'), { recursive: true });
  for (const name of SRC_DATA_FILES) {
    const src = path.join(backendSrcData, name);
    const backup = path.join(backupSrcData, name);
    const destBackup = path.join(backupDir, 'src-data', name);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, destBackup);
      backedUp.push({ from: destBackup, to: src });
    }
    if (fs.existsSync(backup)) {
      fs.copyFileSync(backup, src);
    } else {
      fs.writeFileSync(src, name === 'mcp-vendors.json' ? '{"httpVendors":[]}' : '{}', 'utf8');
    }
  }

  fs.writeFileSync(BACKUP_META, JSON.stringify({ backupDir, backedUp }), 'utf8');
  console.log('[prepare-package-data] 已用空配置替换敏感数据，备份至', backupDir);
}

main();
