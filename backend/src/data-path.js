/**
 * 数据目录：打包后使用用户可写目录（AppData），避免 resources 不可写导致 API Key 等无法保存
 * Electron 启动后端时传入 OPENAUI_DATA_DIR，否则使用 backend/data
 */
const path = require('path');
const fs = require('fs');

function getDataDir() {
  const envDir = process.env.OPENAUI_DATA_DIR;
  if (envDir && typeof envDir === 'string' && envDir.trim()) {
    const dir = path.resolve(envDir.trim());
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  }
  return path.join(process.cwd(), 'data');
}

module.exports = { getDataDir };
