/**
 * 打包后：仅初始化 release/win-unpacked/resources/backend/data 为默认空配置
 * 绝不修改本地 backend/data！仅处理打包输出目录
 */
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..', '..');
const releaseDir = path.join(projectRoot, 'release', 'win-unpacked');
const packagedData = path.join(releaseDir, 'resources', 'backend', 'data');
const packagedSrcData = path.join(releaseDir, 'resources', 'backend', 'src', 'data');
const localDataPath = path.join(projectRoot, 'backend', 'data');

const DATA_DEFAULTS = {
  'apikeys.json': '{}',
  'config.json': '{}',
  'baidu-ocr-token.json': '{}',
  'mcp-settings.json': '{}',
  'skill-settings.json': '{}',
  'voice-settings.json': '{}',
  'skills-library.json': '{}',
};

const SRC_DATA_DEFAULTS = {
  'mcp-http-credentials.json': '{}',
  'mcp-vendors.json': '{"httpVendors":[]}',
};

function initDir(dir, defaults) {
  if (!fs.existsSync(dir)) return;
  for (const [name, content] of Object.entries(defaults)) {
    const filePath = path.join(dir, name);
    fs.writeFileSync(filePath, content, 'utf8');
  }
}

function main() {
  if (!fs.existsSync(releaseDir)) {
    console.log('[init-packaged-data] 未找到 win-unpacked，跳过');
    return;
  }
  const normalizedPackaged = path.normalize(packagedData);
  const normalizedLocal = path.normalize(localDataPath);
  if (normalizedPackaged === normalizedLocal || normalizedPackaged.startsWith(normalizedLocal + path.sep)) {
    console.error('[init-packaged-data] 安全校验失败：目标路径不能是本地 backend/data，已跳过');
    return;
  }
  if (!normalizedPackaged.includes(path.sep + 'release' + path.sep)) {
    console.error('[init-packaged-data] 安全校验失败：仅允许操作 release 目录，已跳过');
    return;
  }
  fs.mkdirSync(packagedData, { recursive: true });
  fs.mkdirSync(packagedSrcData, { recursive: true });
  const chatHistoryDir = path.join(packagedData, 'chat-history');
  fs.mkdirSync(chatHistoryDir, { recursive: true });
  fs.writeFileSync(path.join(chatHistoryDir, 'index.json'), '{"sessions":[]}', 'utf8');
  initDir(packagedData, DATA_DEFAULTS);
  initDir(packagedSrcData, SRC_DATA_DEFAULTS);
  console.log('[init-packaged-data] 已初始化打包目录 resources/backend/data（本地 backend/data 未动）');
}

main();
