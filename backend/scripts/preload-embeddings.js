#!/usr/bin/env node
/**
 * 预下载 Embeddings 模型（Xenova/all-MiniLM-L6-v2）
 * 供 install-all.js 调用，首次运行会从 HF 下载并缓存
 * 需设置 HF_ENDPOINT（install-all 已默认 https://hf-mirror.com）
 */
const path = require('path');

async function main() {
  const embeddings = require(path.join(__dirname, '../src/embeddings'));
  await embeddings.embed('preload');
  console.log('Embeddings 模型已缓存');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
