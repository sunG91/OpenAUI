/**
 * 记忆存储 API - 基于 Vectra + Xenova 本地向量存储
 * 向量数据存储在 backend/data/vectra/ 独立目录
 */
const { embed } = require('../embeddings');
const {
  VECTRA_DATA_DIR,
  ensureVectraDataDir,
  checkAvailable,
  insertText,
  queryByText,
  memoryAvailable,
} = require('../vectra');

function mountMemoryStorageRoutes(app) {
  app.get('/api/memory-storage/info', (req, res) => {
    try {
      ensureVectraDataDir();
      return res.json({
        dataDir: VECTRA_DATA_DIR,
        description: '向量数据存储在独立目录 backend/data/vectra/',
        embeddingModel: 'Xenova/all-MiniLM-L6-v2',
      });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get('/api/memory-storage/available', async (req, res) => {
    try {
      const available = await checkAvailable();
      return res.json({ available });
    } catch (e) {
      return res.json({ available: false, error: e.message });
    }
  });

  app.get('/api/memory-storage/memory-available', async (req, res) => {
    try {
      const available = await memoryAvailable();
      return res.json({ available });
    } catch (e) {
      return res.json({ available: false, error: e.message });
    }
  });

  app.post('/api/memory-storage/insert', async (req, res) => {
    try {
      const { collection = 'default', text, metadata = {}, id } = req.body || {};
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ success: false, error: '缺少 text 字段' });
      }
      const result = await insertText(collection, text, metadata, id);
      return res.json(result);
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post('/api/memory-storage/embed', async (req, res) => {
    try {
      const { text } = req.body || {};
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ success: false, error: '缺少 text 字段' });
      }
      const vector = await embed(text);
      return res.json({ success: true, vector, dim: vector.length });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post('/api/memory-storage/query', async (req, res) => {
    try {
      const { collection = 'default', text, topk = 10, filter } = req.body || {};
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ success: false, error: '缺少 text 字段' });
      }
      const result = await queryByText(collection, text, topk, filter);
      return res.json(result);
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });
}

module.exports = { mountMemoryStorageRoutes };
