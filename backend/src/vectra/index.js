/**
 * Vectra 向量存储模块
 * 向量数据存储在 backend/data/vectra/ 独立目录下
 * 整合 embeddings（Xenova）实现文本级记忆
 */
const { VECTRA_DATA_DIR, ensureVectraDataDir, getCollectionPath } = require('./paths');
const {
  createOrOpen,
  insert,
  query,
  fetch,
  deleteById,
  stats,
  listItems,
  checkAvailable,
} = require('./store');
const { insertText, queryByText, checkAvailable: memoryAvailable } = require('./memory');

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
  listItems,
  checkAvailable,
  // 文本级记忆（依赖 embeddings）
  insertText,
  queryByText,
  memoryAvailable,
};
