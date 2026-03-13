# 模型厂商提供方（modelProviders）

新增厂商只需两步，无需改路由或入口：

1. 在本目录下新增 `{vendorId}.js`，实现并导出：
   - `id`: 字符串，与前端 `modelVendors.js` 中的厂商 id 一致
   - `chat(options)`: 异步方法
     - `options`: `{ apiKey, modelId, message, stream }`
     - `stream === false`: 返回 `Promise<{ content, reasoning_content? }>`
     - `stream === true`: 返回 `Promise<AsyncIterable>`，每项为 OpenAI 风格 chunk（含 `choices[0].delta.content` / `reasoning_content`）

2. 在 `index.js` 中 `register(require('./你的厂商'))`。

前端在 `data/modelVendors.js` 中维护厂商与模型列表即可。
