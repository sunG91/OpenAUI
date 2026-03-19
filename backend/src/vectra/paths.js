/**
 * Vectra 向量存储路径配置
 * 向量数据统一存放在 backend/data/vectra/ 目录下，与其它数据隔离
 */
const path = require('path');
const fs = require('fs');

// 向量数据专用目录：backend/data/vectra/
const VECTRA_DATA_DIR = path.join(__dirname, '..', '..', 'data', 'vectra');

function ensureVectraDataDir() {
  if (!fs.existsSync(VECTRA_DATA_DIR)) {
    fs.mkdirSync(VECTRA_DATA_DIR, { recursive: true });
  }
  return VECTRA_DATA_DIR;
}

function getCollectionPath(collectionName) {
  return path.join(VECTRA_DATA_DIR, String(collectionName || 'default'));
}

module.exports = {
  VECTRA_DATA_DIR,
  ensureVectraDataDir,
  getCollectionPath,
};
