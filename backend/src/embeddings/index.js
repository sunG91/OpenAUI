/**
 * 向量嵌入模块 - 对接 @xenova/transformers
 * 提供文本到向量的转换，供记忆存储等模块使用
 */
const xenova = require('./xenova');

const DEFAULT_MODEL = 'Xenova/all-MiniLM-L6-v2';

let _extractor = null;

/**
 * 获取或初始化嵌入模型
 * @param {string} [modelId] - 模型 ID，默认 Xenova/all-MiniLM-L6-v2（384 维）
 */
async function getExtractor(modelId = DEFAULT_MODEL) {
  if (_extractor) return _extractor;
  _extractor = await xenova.createExtractor(modelId);
  return _extractor;
}

/**
 * 将文本转为向量
 * @param {string} text - 输入文本
 * @param {string} [modelId] - 可选模型 ID
 * @returns {Promise<number[]>} 向量数组
 */
async function embed(text, modelId) {
  const extractor = await getExtractor(modelId);
  return xenova.embed(extractor, text);
}

/**
 * 批量将文本转为向量
 * @param {string[]} texts - 文本数组
 * @param {string} [modelId] - 可选模型 ID
 * @returns {Promise<number[][]>} 向量数组的数组
 */
async function embedBatch(texts, modelId) {
  const extractor = await getExtractor(modelId);
  const results = [];
  for (const t of texts) {
    results.push(await xenova.embed(extractor, t));
  }
  return results;
}

/**
 * 获取当前模型向量维度
 * @param {string} [modelId] - 可选模型 ID
 */
async function getDimension(modelId = DEFAULT_MODEL) {
  const v = await embed('test', modelId);
  return v.length;
}

/**
 * 检查 Xenova 嵌入是否可用
 */
async function checkAvailable() {
  return xenova.checkAvailable();
}

/**
 * 重置模型（释放内存，下次调用会重新加载）
 */
function reset() {
  _extractor = null;
  xenova.reset();
}

module.exports = {
  embed,
  embedBatch,
  getExtractor,
  getDimension,
  checkAvailable,
  reset,
  DEFAULT_MODEL,
};
