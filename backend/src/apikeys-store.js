/**
 * API Key 本地存储 - 存到 backend/data/apikeys.json
 * 查看时仅返回脱敏（加密查看）
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const FILE_PATH = path.join(DATA_DIR, 'apikeys.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/** 读取全部（明文，仅后端内部使用） */
function readApiKeys() {
  ensureDir();
  if (!fs.existsSync(FILE_PATH)) return {};
  try {
    const raw = fs.readFileSync(FILE_PATH, 'utf8');
    const data = JSON.parse(raw);
    return typeof data === 'object' && data !== null ? data : {};
  } catch {
    return {};
  }
}

/** 写入（按 vendorId 合并） */
function writeApiKeys(updates) {
  ensureDir();
  const current = readApiKeys();
  const next = { ...current, ...updates };
  fs.writeFileSync(FILE_PATH, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

/** 脱敏展示：前 3 位 + *** + 后 3 位，未配置返回空串 */
function maskKey(key) {
  if (!key || typeof key !== 'string') return '';
  const s = key.trim();
  if (s.length === 0) return '';
  if (s.length <= 6) return '******';
  return s.slice(0, 3) + '***' + s.slice(-3);
}

/** 对外：获取脱敏后的各厂商 Key（用于「查看」） */
function getMaskedKeys() {
  const raw = readApiKeys();
  const out = {};
  for (const [vendorId, value] of Object.entries(raw)) {
    out[vendorId] = maskKey(value);
  }
  return out;
}

module.exports = {
  readApiKeys,
  writeApiKeys,
  getMaskedKeys,
  maskKey
};
