/**
 * Vectra 向量存储模块
 * 向量数据存储在 backend/data/vectra/ 独立目录下
 */
const { VECTRA_DATA_DIR, ensureVectraDataDir, getCollectionPath } = require('./paths');
const {
  createOrOpen,
  insert,
  query,
  fetch,
  deleteById,
  stats,
  checkAvailable,
} = require('./store');

module.exports = {
  VECTRA_DATA_DIR,
  ensureVectraDataDir,
  getCollectionPath,
  createOrOpen,
  insert,
  query,
  fetch,
  deleteById,
  stats,
  checkAvailable,
};
