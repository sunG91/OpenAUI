/**
 * Vectra 向量存储路径配置
 * 打包后使用用户可写目录
 */
const path = require('path');
const fs = require('fs');
const { getDataDir } = require('../data-path');

const VECTRA_DATA_DIR = path.join(getDataDir(), 'vectra');

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
