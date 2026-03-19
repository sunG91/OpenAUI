/**
 * MCP 厂商配置（仅本地文件）
 * 打包后使用用户可写目录
 * 结构示例：
 * {
 *   "httpVendors": [
 *     { "id": "aliyun-bailian", "label": "...", "url": "...", "desc": "..." }
 *   ]
 * }
 */
const fs = require('fs');
const path = require('path');
const { getDataDir } = require('./data-path');

const FILE_PATH = path.join(getDataDir(), 'mcp-vendors.json');

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
  const dir = path.dirname(FILE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
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

