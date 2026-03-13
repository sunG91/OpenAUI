/**
 * MCP 相关 API：
 * - GET /api/mcp/servers        列出所有（或启用的）MCP 配置
 * - GET /api/mcp/:id/tools      调用 MCP 的 tools/list
 * - POST /api/mcp/:id/tools/:name/call  调用 MCP 的 tools/call
 */
const { readMcpSettings } = require('../mcp-settings-store');
const { listServerTools, callServerTool, startServer, disposeClient, getServerStatus } = require('../mcp/manager');
const { MCP_SERVICES_DIR, ensureMcpServicesDir } = require('../mcp/paths');
const { readMcpVendors } = require('../mcp-vendors-store');

function mountMcpRoutes(app) {
  app.get('/api/mcp/base-dir', (req, res) => {
    try {
      ensureMcpServicesDir();
      return res.json({ baseDir: MCP_SERVICES_DIR });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get('/api/mcp/vendors', (req, res) => {
    try {
      const vendors = readMcpVendors();
      return res.json({ vendors });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get('/api/mcp/servers', (req, res) => {
    try {
      const settings = readMcpSettings();
      const list = Array.isArray(settings.servers) ? settings.servers : [];
      return res.json({ servers: list });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get('/api/mcp/:id/tools', async (req, res) => {
    const id = (req.params.id || '').trim();
    if (!id) {
      return res.status(400).json({ success: false, error: '缺少 MCP id' });
    }
    try {
      const tools = await listServerTools(id);
      return res.json({ success: true, tools });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get('/api/mcp/:id/status', (req, res) => {
    const id = (req.params.id || '').trim();
    if (!id) {
      return res.status(400).json({ success: false, error: '缺少 MCP id' });
    }
    try {
      const status = getServerStatus(id);
      return res.json({ success: true, ...status });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post('/api/mcp/:id/start', async (req, res) => {
    const id = (req.params.id || '').trim();
    if (!id) {
      return res.status(400).json({ success: false, error: '缺少 MCP id' });
    }
    try {
      const status = await startServer(id);
      return res.json({ success: true, ...status });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post('/api/mcp/:id/stop', (req, res) => {
    const id = (req.params.id || '').trim();
    if (!id) {
      return res.status(400).json({ success: false, error: '缺少 MCP id' });
    }
    try {
      disposeClient(id);
      return res.json({ success: true });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post('/api/mcp/:id/tools/:name/call', async (req, res) => {
    const id = (req.params.id || '').trim();
    const name = (req.params.name || '').trim();
    if (!id || !name) {
      return res.status(400).json({ success: false, error: '缺少 MCP id 或工具名称' });
    }
    try {
      const args = (req.body && typeof req.body === 'object') ? req.body : {};
      const result = await callServerTool(id, name, args);
      return res.json({ success: true, result });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });
}

module.exports = {
  mountMcpRoutes,
};

