/**
 * Xenova Transformers 向量嵌入实现
 * 使用 @xenova/transformers 的 feature-extraction pipeline
 */
let _pipeline = null;

async function createExtractor(modelId = 'Xenova/all-MiniLM-L6-v2') {
  if (_pipeline) return _pipeline;
  const mod = await import('@xenova/transformers');
  const { pipeline, env } = mod;
  // 国内默认使用 HF 镜像；设置 HF_ENDPOINT="" 或 HF_ENDPOINT=https://huggingface.co 使用官方源
  const hfEndpoint = process.env.HF_ENDPOINT !== undefined
    ? String(process.env.HF_ENDPOINT).trim()
    : 'https://hf-mirror.com';
  if (hfEndpoint) {
    env.remoteHost = hfEndpoint.replace(/\/?$/, '/');
  }
  _pipeline = await pipeline('feature-extraction', modelId, {
    quantized: true,
    progress_callback: null,
  });
  return _pipeline;
}

/**
 * 将文本转为向量（mean pooling + normalize）
 * @param {object} extractor - pipeline 实例
 * @param {string} text - 输入文本
 * @returns {Promise<number[]>} 向量
 */
async function embed(extractor, text) {
  if (!text || typeof text !== 'string') {
    throw new Error('embed 需要非空字符串');
  }
  const output = await extractor(text, {
    pooling: 'mean',
    normalize: true,
  });
  // Tensor { data: Float32Array, dims: [1, 384] }
  if (output?.data) {
    return Array.from(output.data);
  }
  if (Array.isArray(output)) {
    return output.flat();
  }
  if (output?.[0]?.data) {
    return Array.from(output[0].data);
  }
  throw new Error('无法解析 Xenova 嵌入输出');
}

function checkAvailable() {
  try {
    require.resolve('@xenova/transformers');
    return true;
  } catch {
    return false;
  }
}

function reset() {
  _pipeline = null;
}

module.exports = {
  createExtractor,
  embed,
  checkAvailable,
  reset,
};
