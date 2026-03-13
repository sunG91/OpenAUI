/**
 * 设置相关 API：API Key 的读取与保存
 */
const { getMaskedKeys, writeApiKeys } = require('../apikeys-store');
const { readVoiceSettings, writeVoiceSettings } = require('../voice-settings-store');
const { readSkillSettings, writeSkillSettings } = require('../skill-settings-store');
const { readMcpSettings, writeMcpSettings } = require('../mcp-settings-store');
const { getMcpHttpCredentialsSummary, writeMcpHttpCredential } = require('../mcp-http-credentials-store');
const { getFfmpegVersion } = require('../ffmpeg/ffmpeg');

function mountSettingsRoutes(app) {
  app.get('/api/settings/apikeys', (req, res) => {
    try {
      const keys = getMaskedKeys();
      return res.json({ keys });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post('/api/settings/apikeys', (req, res) => {
    try {
      const { vendorId, apiKey } = req.body || {};
      if (!vendorId) {
        return res.status(400).json({ success: false, error: '缺少 vendorId' });
      }
      const value = typeof apiKey === 'string' ? apiKey.trim() : '';
      writeApiKeys({ [vendorId]: value });
      const keys = getMaskedKeys();
      return res.json({ success: true, keys });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get('/api/settings/voice', (req, res) => {
    try {
      const settings = readVoiceSettings();
      return res.json({ settings });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post('/api/settings/voice', (req, res) => {
    try {
      const updates = (req.body && typeof req.body === 'object') ? req.body : {};
      const settings = writeVoiceSettings(updates);
      return res.json({ success: true, settings });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get('/api/settings/ffmpeg', async (req, res) => {
    try {
      const version = await getFfmpegVersion();
      return res.json({ ok: true, version });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/settings/skill-settings', (req, res) => {
    try {
      const settings = readSkillSettings();
      return res.json({ settings });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post('/api/settings/skill-settings', (req, res) => {
    try {
      const updates = (req.body && typeof req.body === 'object') ? req.body : {};
      const settings = writeSkillSettings(updates);
      return res.json({ success: true, settings });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  // MCP 设置：本地保存可用的 MCP 服务列表（名称、命令、参数等）
  app.get('/api/settings/mcp', (req, res) => {
    try {
      const settings = readMcpSettings();
      return res.json({ settings });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post('/api/settings/mcp', (req, res) => {
    try {
      const updates = (req.body && typeof req.body === 'object') ? req.body : {};
      const settings = writeMcpSettings(updates);
      return res.json({ success: true, settings });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  // MCP HTTP 凭据：仅存 Authorization，不回显明文
  app.get('/api/settings/mcp-http-credentials', (req, res) => {
    try {
      const summary = getMcpHttpCredentialsSummary();
      return res.json({ credentials: summary });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post('/api/settings/mcp-http-credentials', (req, res) => {
    try {
      const { serverId, authorization } = req.body || {};
      if (!serverId) {
        return res.status(400).json({ success: false, error: '缺少 serverId' });
      }
      writeMcpHttpCredential(serverId, authorization || '');
      const summary = getMcpHttpCredentialsSummary();
      return res.json({ success: true, credentials: summary });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });
}

module.exports = { mountSettingsRoutes };
