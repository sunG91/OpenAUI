/**
 * 记忆存储 API - 基于 Vectra + Xenova 本地向量存储
 * 向量数据存储在 backend/data/vectra/ 独立目录
 */
const fs = require('fs');
const path = require('path');
const { embed } = require('../embeddings');
const {
  VECTRA_DATA_DIR,
  ensureVectraDataDir,
  checkAvailable,
  insertText,
  queryByText,
  listItems,
  deleteById,
  stats,
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

  /** 列出所有集合（向量数据集） */
  app.get('/api/memory-storage/collections', (req, res) => {
    try {
      ensureVectraDataDir();
      const names = fs.readdirSync(VECTRA_DATA_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .filter((n) => {
          const p = path.join(VECTRA_DATA_DIR, n);
          return fs.existsSync(path.join(p, 'index.json'));
        });
      return res.json({ collections: names });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  /** 列出集合内文档 GET /api/memory-storage/collections/:name/items */
  app.get('/api/memory-storage/collections/:name/items', async (req, res) => {
    try {
      const { name } = req.params;
      const result = await listItems(name);
      return res.json(result);
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  /** 获取集合统计 */
  app.get('/api/memory-storage/collections/:name/stats', async (req, res) => {
    try {
      const { name } = req.params;
      const result = await stats(name);
      return res.json(result);
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  /** 删除集合内文档 DELETE /api/memory-storage/collections/:name/items/:id */
  app.delete('/api/memory-storage/collections/:name/items/:id', async (req, res) => {
    try {
      const { name, id } = req.params;
      await deleteById(name, id);
      return res.json({ success: true });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });
}

module.exports = { mountMemoryStorageRoutes };
