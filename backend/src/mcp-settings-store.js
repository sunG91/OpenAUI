/**
 * MCP 设置 - 存到 backend/data/mcp-settings.json
 * 用于配置可用的第三方 MCP 服务（仅本地保存，不上云）
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const FILE_PATH = path.join(DATA_DIR, 'mcp-settings.json');

const defaults = {
  servers: [],
};

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readMcpSettings() {
  ensureDir();
  let stored = {};
  if (!fs.existsSync(FILE_PATH)) {
    fs.writeFileSync(FILE_PATH, JSON.stringify(defaults, null, 2), 'utf8');
    return { servers: [] };
  }
  if (fs.existsSync(FILE_PATH)) {
    try {
      stored = JSON.parse(fs.readFileSync(FILE_PATH, 'utf8')) || {};
    } catch {
      stored = {};
    }
  }
  return {
    servers: Array.isArray(stored.servers) ? stored.servers : defaults.servers,
  };
}

function writeMcpSettings(updates) {
  ensureDir();
  const current = readMcpSettings();
  const next = {
    ...current,
    ...(updates || {}),
  };
  fs.writeFileSync(FILE_PATH, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

module.exports = {
  readMcpSettings,
  writeMcpSettings,
};

