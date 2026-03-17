/**
 * MCP 设置 - 委托给统一 config-store（config.json）
 */
const { readSection, writeSection } = require('./config-store');

function readMcpSettings() {
  const s = readSection('mcp');
  return { servers: Array.isArray(s.servers) ? s.servers : [] };
}

function writeMcpSettings(updates) {
  const next = writeSection('mcp', updates);
  return next.mcp;
}

module.exports = {
  readMcpSettings,
  writeMcpSettings,
};

