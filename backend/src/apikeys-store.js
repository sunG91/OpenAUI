/**
 * API Key 本地存储 - 存到 data/apikeys.json
 * 打包后使用用户可写目录（OPENAUI_DATA_DIR），避免 401 等因 Key 未正确保存
 */
const fs = require('fs');
const path = require('path');
const { getDataDir } = require('./data-path');

const FILE_PATH = path.join(getDataDir(), 'apikeys.json');

function ensureDir() {
  const dir = path.dirname(FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
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

/** 百度 OCR：存储 key 为 baidu_ocr_ak / baidu_ocr_sk */
const BAIDU_OCR_AK = 'baidu_ocr_ak';
const BAIDU_OCR_SK = 'baidu_ocr_sk';

function getBaiduOcrCredentials() {
  const raw = readApiKeys();
  const ak = (raw[BAIDU_OCR_AK] || '').trim();
  const sk = (raw[BAIDU_OCR_SK] || '').trim();
  return ak && sk ? { ak, sk } : null;
}

function getBaiduOcrMasked() {
  const raw = readApiKeys();
  return {
    ak: maskKey(raw[BAIDU_OCR_AK]),
    sk: maskKey(raw[BAIDU_OCR_SK]),
  };
}

function writeBaiduOcrKeys(ak, sk) {
  const updates = {
    [BAIDU_OCR_AK]: typeof ak === 'string' ? ak.trim() : '',
    [BAIDU_OCR_SK]: typeof sk === 'string' ? sk.trim() : '',
  };
  return writeApiKeys(updates);
}

module.exports = {
  readApiKeys,
  writeApiKeys,
  getMaskedKeys,
  maskKey,
  getBaiduOcrCredentials,
  getBaiduOcrMasked,
  writeBaiduOcrKeys,
};
