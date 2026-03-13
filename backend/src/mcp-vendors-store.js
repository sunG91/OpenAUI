/**
 * MCP 厂商配置（仅本地文件）：
 * backend/src/data/mcp-vendors.json
 * 结构示例：
 * {
 *   "httpVendors": [
 *     { "id": "aliyun-bailian", "label": "...", "url": "...", "desc": "..." }
 *   ]
 * }
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const FILE_PATH = path.join(DATA_DIR, 'mcp-vendors.json');

const defaults = {
  httpVendors: [
    {
      id: 'aliyun-bailian',
      label: '阿里云百炼 MCP',
      url: '',
      desc: '阿里云百炼 MCP 市场实例，通过 HTTP 方式提供工具调用能力。',
    },
  ],
};

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readMcpVendors() {
  ensureDir();
  if (!fs.existsSync(FILE_PATH)) {
    return defaults;
  }
  try {
    const raw = fs.readFileSync(FILE_PATH, 'utf8');
    const obj = JSON.parse(raw);
    return {
      httpVendors: Array.isArray(obj.httpVendors) && obj.httpVendors.length > 0 ? obj.httpVendors : defaults.httpVendors,
    };
  } catch {
    return defaults;
  }
}

module.exports = {
  readMcpVendors,
};

