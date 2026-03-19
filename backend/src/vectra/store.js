/**
 * Vectra 向量存储 - 集合操作
 * 使用 Node.js 原生 vectra 包，向量数据存储在 backend/data/vectra/ 独立目录
 */
const { LocalIndex } = require('vectra');
const { ensureVectraDataDir, getCollectionPath } = require('./paths');

const indexCache = new Map();

async function getIndex(collectionName) {
  ensureVectraDataDir();
  const collPath = getCollectionPath(collectionName);
  let index = indexCache.get(collPath);
  if (!index) {
    index = new LocalIndex(collPath);
    if (!(await index.isIndexCreated())) {
      await index.createIndex();
    }
    indexCache.set(collPath, index);
  }
  return index;
}

/**
 * 创建或打开集合
 * @param {string} collectionName - 集合名
 * @param {number} [dim] - 向量维度（Vectra 无固定 schema，可忽略）
 */
async function createOrOpen(collectionName, dim = 384) {
  ensureVectraDataDir();
  const collPath = getCollectionPath(collectionName);
  const index = new LocalIndex(collPath);
  if (!(await index.isIndexCreated())) {
    await index.createIndex();
  }
  indexCache.set(collPath, index);
  return { ok: true, path: collPath };
}

/**
 * 插入文档
 * @param {string} collectionName - 集合名
 * @param {string} id - 文档 ID
 * @param {number[]} vector - 向量
 * @param {object} [metadata] - 元数据
 */
async function insert(collectionName, id, vector, metadata = {}) {
  const index = await getIndex(collectionName);
  await index.upsertItem({ id, vector, metadata });
  return { ok: true, id };
}

/**
 * 向量相似性检索
 * @param {string} collectionName - 集合名
 * @param {number[]} vector - 查询向量
 * @param {number} [topk=10] - 返回数量
 * @param {object} [filter] - 元数据过滤（MongoDB 风格）
 */
async function query(collectionName, vector, topk = 10, filter) {
  const index = await getIndex(collectionName);
  const results = await index.queryItems(vector, '', topk, filter || undefined);
  return {
    ok: true,
    results: results.map((r) => ({
      id: r.item.id,
      score: r.score,
      metadata: r.item.metadata || {},
    })),
  };
}

/**
 * 按 ID 获取文档
 */
async function fetch(collectionName, ids) {
  const index = await getIndex(collectionName);
  const idList = Array.isArray(ids) ? ids : [ids];
  const docs = [];
  for (const id of idList) {
    const item = await index.getItem(id);
    if (item) docs.push({ id: item.id, metadata: item.metadata || {}, vectors: item.vector ? { embedding: item.vector } : {} });
  }
  return { ok: true, docs };
}

/**
 * 按 ID 删除
 */
async function deleteById(collectionName, ids) {
  const index = await getIndex(collectionName);
  const idList = Array.isArray(ids) ? ids : [ids];
  await index.beginUpdate();
  for (const id of idList) {
    await index.deleteItem(id);
  }
  await index.endUpdate();
  return { ok: true, deleted: idList.length };
}

/**
 * 获取集合统计信息
 */
async function stats(collectionName) {
  const index = await getIndex(collectionName);
  const s = await index.getIndexStats();
  return { ok: true, stats: s };
}

/**
 * 检查 Vectra 是否可用（Node.js 包已安装）
 */
async function checkAvailable() {
  try {
    const { LocalIndex } = require('vectra');
    return !!LocalIndex;
  } catch {
    return false;
  }
}

module.exports = {
  createOrOpen,
  insert,
  query,
  fetch,
  deleteById,
  stats,
  checkAvailable,
};
