/**
 * 记忆存储 - Vectra + Xenova 整合
 * 提供基于文本的记忆写入与检索，自动完成向量化
 */
const crypto = require('crypto');
const { insert, query } = require('./store');
const { embed, checkAvailable: embedAvailable } = require('../embeddings');

/**
 * 插入文本记忆
 * @param {string} collectionName - 集合名
 * @param {string} text - 文本内容
 * @param {object} [metadata] - 元数据，如 { source, created_at }
 * @param {string} [id] - 可选 ID，不传则自动生成
 */
async function insertText(collectionName, text, metadata = {}, id) {
  const vector = await embed(text);
  const docId = id || crypto.randomUUID();
  const meta = {
    ...metadata,
    text: String(text || '').slice(0, 2000),
    created_at: metadata.created_at || new Date().toISOString(),
  };
  await insert(collectionName, docId, vector, meta);
  return { ok: true, id: docId };
}

/**
 * 按文本语义检索
 * @param {string} collectionName - 集合名
 * @param {string} text - 查询文本
 * @param {number} [topk=10] - 返回数量
 * @param {object} [filter] - 元数据过滤
 */
async function queryByText(collectionName, text, topk = 10, filter) {
  const vector = await embed(text);
  const result = await query(collectionName, vector, topk, filter);
  return result;
}

/**
 * 检查完整链路是否可用（Vectra + Embeddings）
 */
async function checkAvailable() {
  try {
    const { checkAvailable: vectraOk } = require('./store');
    const v = await vectraOk();
    const e = await embedAvailable();
    return v && e;
  } catch {
    return false;
  }
}

module.exports = {
  insertText,
  queryByText,
  checkAvailable,
};
