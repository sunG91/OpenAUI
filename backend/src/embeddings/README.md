# Embeddings 向量嵌入模块

基于 **@xenova/transformers** 的本地文本向量化，无需外部 API。

## 依赖

```bash
npm install @xenova/transformers
```

## 模块结构

- `xenova.js` - Xenova feature-extraction 实现
- `index.js` - 统一导出，供 vectra 等模块调用

## 默认模型

- **Xenova/all-MiniLM-L6-v2**：384 维，轻量、中英支持

## 国内网络

脚本内已默认使用 `https://hf-mirror.com` 镜像。若需使用官方源，可设置：

```bash
set HF_ENDPOINT=
```

## 使用示例

```javascript
const { embed, embedBatch, checkAvailable } = require('./embeddings');

const vector = await embed('这是一段测试文本');
// [0.12, -0.34, ...] 384 维

const vectors = await embedBatch(['文本1', '文本2']);
```
