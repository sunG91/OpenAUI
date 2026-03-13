/**
 * MCP HTTP 凭据存储（仅本地）：
 * backend/src/data/mcp-http-credentials.json
 * 结构示例：
 * {
 *   "aliyun-bailian": {
 *     "authorization": "Bearer xxx"
 *   }
 * }
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const FILE_PATH = path.join(DATA_DIR, 'mcp-http-credentials.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readAll() {
  ensureDir();
  if (!fs.existsSync(FILE_PATH)) return {};
  try {
    const raw = fs.readFileSync(FILE_PATH, 'utf8');
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' ? obj : {};
  } catch {
    return {};
  }
}

function writeAll(map) {
  ensureDir();
  fs.writeFileSync(FILE_PATH, JSON.stringify(map || {}, null, 2), 'utf8');
}

function readMcpHttpCredentials() {
  return readAll();
}

function writeMcpHttpCredential(serverId, authorization) {
  const all = readAll();
  const id = String(serverId || '').trim();
  if (!id) return all;
  if (!authorization || !String(authorization).trim()) {
    delete all[id];
  } else {
    all[id] = { authorization: String(authorization).trim() };
  }
  writeAll(all);
  return all;
}

function getMcpHttpCredentialsSummary() {
  const all = readAll();
  const summary = {};
  for (const [k, v] of Object.entries(all)) {
    summary[k] = { hasAuthorization: !!(v && typeof v.authorization === 'string' && v.authorization.trim()) };
  }
  return summary;
}

module.exports = {
  readMcpHttpCredentials,
  writeMcpHttpCredential,
  getMcpHttpCredentialsSummary,
};

