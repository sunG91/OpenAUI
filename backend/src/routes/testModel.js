/**
 * 模型测试 API：按厂商调用对应 provider，支持流式 / 非流式
 */
const { readApiKeys } = require('../apikeys-store');
const { getProvider } = require('../services/modelProviders');

function mountTestModelRoutes(app) {
  app.post('/api/test-model', async (req, res) => {
    try {
      const { vendorId, modelId, message, messages, stream: useStream } = req.body || {};
      if (!vendorId || !modelId) {
        return res.status(400).json({ success: false, error: '缺少 vendorId 或 modelId' });
      }
      const stored = readApiKeys();
      const apiKey = stored[vendorId];
      if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
        return res.status(400).json({ success: false, error: '请先在「设置」中保存该厂商的 API Key' });
      }

      const provider = getProvider(vendorId);
      if (!provider || typeof provider.chat !== 'function') {
        return res.status(400).json({ success: false, error: `暂不支持的厂商: ${vendorId}` });
      }

      const options = { apiKey, modelId, message, messages, stream: useStream === true };

      if (useStream === true) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders?.();
        try {
          const stream = await provider.chat(options);
          for await (const chunk of stream) {
            const delta = chunk.choices?.[0]?.delta ?? {};
            const reasoning = delta.reasoning_content ?? '';
            const text = delta.content ?? '';
            res.write('data: ' + JSON.stringify({ reasoning_content: reasoning, content: text }) + '\n\n');
            if (typeof res.flush === 'function') res.flush();
          }
          res.write('data: [DONE]\n\n');
          if (typeof res.flush === 'function') res.flush();
        } catch (streamErr) {
          const errMsg = streamErr?.message || String(streamErr);
          res.write('data: ' + JSON.stringify({ error: errMsg }) + '\n\n');
          res.write('data: [DONE]\n\n');
        }
        return res.end();
      }

      const result = await provider.chat(options);
      return res.json({
        success: true,
        content: result.content ?? '',
        reasoning_content: result.reasoning_content ?? ''
      });
    } catch (err) {
      const message = err?.message || err?.error?.message || String(err);
      const code = err?.status || err?.statusCode;
      return res
        .status(code && code >= 400 ? code : 500)
        .json({ success: false, error: message });
    }
  });
}

module.exports = { mountTestModelRoutes };
