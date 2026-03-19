/**
 * 记忆存储 API - 基于 Vectra 本地向量存储
 * 向量数据存储在 backend/data/vectra/ 独立目录
 */
const { VECTRA_DATA_DIR, ensureVectraDataDir, checkAvailable } = require('../vectra');

function mountMemoryStorageRoutes(app) {
  app.get('/api/memory-storage/info', (req, res) => {
    try {
      ensureVectraDataDir();
      return res.json({
        dataDir: VECTRA_DATA_DIR,
        description: '向量数据存储在独立目录 backend/data/vectra/',
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
}

module.exports = { mountMemoryStorageRoutes };
