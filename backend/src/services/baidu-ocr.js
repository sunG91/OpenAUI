/**
 * 百度智能云 OCR 模块
 * - 启动时自动获取 token 并缓存到本地
 * - token 过期自动重新获取
 * - 提供通用文字识别 general_basic 接口
 */
const fs = require('fs');
const path = require('path');
const { getBaiduOcrCredentials } = require('../apikeys-store');

const DATA_DIR = path.join(__dirname, '../../data');
const TOKEN_FILE = path.join(DATA_DIR, 'baidu-ocr-token.json');

/** 清除缓存的 token（保存新 AK/SK 时调用） */
function clearCachedToken() {
  try {
    if (fs.existsSync(TOKEN_FILE)) fs.unlinkSync(TOKEN_FILE);
  } catch {}
}
const TOKEN_URL = 'https://aip.baidubce.com/oauth/2.0/token';
const OCR_URL = 'https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic';

// token 提前 5 分钟刷新（百度 token 有效期约 30 天）
const REFRESH_BEFORE_SEC = 5 * 60;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/** 读取缓存的 token */
function readCachedToken() {
  try {
    if (!fs.existsSync(TOKEN_FILE)) return null;
    const raw = fs.readFileSync(TOKEN_FILE, 'utf8');
    const data = JSON.parse(raw);
    if (!data?.access_token || !data?.expires_at) return null;
    const now = Math.floor(Date.now() / 1000);
    if (data.expires_at - REFRESH_BEFORE_SEC <= now) return null; // 即将过期
    return data.access_token;
  } catch {
    return null;
  }
}

/** 写入 token 到本地（expires_in 秒，百度通常返回 2592000） */
function writeCachedToken(accessToken, expiresIn = 2592000) {
  ensureDir();
  const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
  fs.writeFileSync(
    TOKEN_FILE,
    JSON.stringify({ access_token: accessToken, expires_at: expiresAt, expires_in: expiresIn }, null, 2),
    'utf8'
  );
}

/**
 * 获取 Access Token（优先缓存，过期则重新请求）
 * @returns {Promise<string|null>}
 */
async function getAccessToken() {
  const cached = readCachedToken();
  if (cached) return cached;

  const cred = getBaiduOcrCredentials();
  if (!cred?.ak || !cred?.sk) return null;

  const url = `${TOKEN_URL}?grant_type=client_credentials&client_id=${encodeURIComponent(cred.ak)}&client_secret=${encodeURIComponent(cred.sk)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`获取百度 token 失败: ${res.status} ${errText}`);
  }
  const data = await res.json();
  const token = data?.access_token;
  const expiresIn = typeof data?.expires_in === 'number' ? data.expires_in : 2592000;
  if (!token) throw new Error('百度 token 响应无 access_token');
  writeCachedToken(token, expiresIn);
  return token;
}

/**
 * 通用文字识别（支持图片 URL）
 * @param {{ url?: string, image?: string }} options - url 为图片地址，image 为 base64
 * @returns {Promise<{ words_result?: Array<{words: string}>, words_result_num?: number }>}
 */
async function generalBasic(options = {}) {
  const token = await getAccessToken();
  if (!token) throw new Error('未配置百度 OCR API Key 和 Secret Key');

  const apiUrl = `${OCR_URL}?access_token=${encodeURIComponent(token)}`;
  const body = new URLSearchParams();
  if (options.url) body.append('url', options.url);
  if (options.image) body.append('image', options.image);
  body.append('detect_direction', 'false');
  body.append('detect_language', 'false');
  body.append('paragraph', 'false');
  body.append('probability', 'false');

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  });
  const data = await res.json();
  if (data.error_code) {
    // token 过期时重新获取并重试一次
    if (data.error_code === 110 || data.error_code === 111) {
      ensureDir();
      try { fs.unlinkSync(TOKEN_FILE); } catch {}
      const newToken = await getAccessToken();
      if (newToken) return generalBasic(options);
    }
    throw new Error(data.error_msg || `OCR 错误: ${data.error_code}`);
  }
  return data;
}

/**
 * 启动时初始化 token（若已配置 AK/SK 则预获取）
 */
async function initTokenOnStartup() {
  const cred = getBaiduOcrCredentials();
  if (!cred?.ak || !cred?.sk) return;
  try {
    await getAccessToken();
    console.log('[Open AUI] 百度 OCR token 已就绪');
  } catch (e) {
    console.warn('[Open AUI] 百度 OCR token 获取失败:', e.message);
  }
}

module.exports = {
  getAccessToken,
  generalBasic,
  initTokenOnStartup,
  clearCachedToken,
};
