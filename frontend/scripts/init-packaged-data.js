/**
 * 打包后：初始化 release/win-unpacked/resources/backend/data 为默认空配置
 * 不修改本地开发环境，仅处理打包输出目录
 */
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..', '..');
const packagedData = path.join(projectRoot, 'release', 'win-unpacked', 'resources', 'backend', 'data');
const packagedSrcData = path.join(projectRoot, 'release', 'win-unpacked', 'resources', 'backend', 'src', 'data');

const DATA_DEFAULTS = {
  'apikeys.json': '{}',
  'config.json': '{}',
  'chat-history.json': '{"sessions":[]}',
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
  if (!fs.existsSync(path.join(projectRoot, 'release', 'win-unpacked'))) {
    console.log('[init-packaged-data] 未找到 win-unpacked，跳过');
    return;
  }
  fs.mkdirSync(packagedData, { recursive: true });
  fs.mkdirSync(packagedSrcData, { recursive: true });
  initDir(packagedData, DATA_DEFAULTS);
  initDir(packagedSrcData, SRC_DATA_DEFAULTS);
  console.log('[init-packaged-data] 已初始化 resources/backend/data 为默认空配置');
}

main();
