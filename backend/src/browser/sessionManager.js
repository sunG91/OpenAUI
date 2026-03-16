/**
 * 浏览器会话管理：多标签页、持久化连接
 * 每个 session 对应一个 browser 实例，可创建多个 page（标签页）
 */
let playwright = null;
try {
  playwright = require('playwright');
} catch (_) {}

const SESSION_IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 分钟无操作自动关闭
const BROWSER_TIMEOUT_MS = 60_000;

const sessions = new Map(); // sessionId -> { browser, pages: Map<pageId, page>, lastActive }

async function launchBrowser() {
  if (!playwright) return null;
  for (const channel of ['chrome', 'msedge']) {
    try {
      return await playwright.chromium.launch({ headless: true, channel });
    } catch (_) {}
  }
  return await playwright.chromium.launch({ headless: true });
}

function generateId() {
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

async function createSession() {
  if (!playwright) throw new Error('playwright 未安装');
  const browser = await launchBrowser();
  const sessionId = generateId();
  const ctx = { browser, pages: new Map(), lastActive: Date.now() };
  sessions.set(sessionId, ctx);
  return sessionId;
}

function getSession(sessionId) {
  const ctx = sessions.get(sessionId);
  if (!ctx) return null;
  ctx.lastActive = Date.now();
  return ctx;
}

async function getOrCreatePage(sessionId, pageId) {
  const ctx = getSession(sessionId);
  if (!ctx) return { ok: false, error: '会话不存在或已过期' };
  let page = ctx.pages.get(pageId);
  if (!page || page.isClosed()) {
    page = await ctx.browser.newPage();
    const pid = pageId || generateId();
    ctx.pages.set(pid, page);
    return { ok: true, page, pageId: pid };
  }
  return { ok: true, page, pageId: pageId };
}

async function closeSession(sessionId) {
  const ctx = sessions.get(sessionId);
  if (!ctx) return { ok: true };
  try {
    await ctx.browser.close();
  } catch (_) {}
  sessions.delete(sessionId);
  return { ok: true };
}

function listTabs(sessionId) {
  const ctx = getSession(sessionId);
  if (!ctx) return null;
  const tabs = [];
  for (const [pageId, page] of ctx.pages) {
    if (!page.isClosed()) {
      tabs.push({ pageId, url: page.url?.() || '' });
    }
  }
  return tabs;
}

// 定期清理空闲会话
setInterval(() => {
  const now = Date.now();
  for (const [sid, ctx] of sessions) {
    if (now - ctx.lastActive > SESSION_IDLE_TIMEOUT_MS) {
      ctx.browser.close().catch(() => {});
      sessions.delete(sid);
    }
  }
}, 60_000);

module.exports = {
  playwright,
  BROWSER_TIMEOUT_MS,
  launchBrowser,
  createSession,
  getSession,
  getOrCreatePage,
  closeSession,
  listTabs,
};
