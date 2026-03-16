/**
 * 浏览器网页操作模块（2.3）
 * - 会话管理 + 多标签页
 * - DOM 解析（可交互元素提取）
 * - 脚本操作（点击、输入、滚动、执行脚本）
 * - 多态识别（截图 + 视觉模型）
 */
const sessionManager = require('./sessionManager');
const domParser = require('./domParser');
const visionIdentify = require('./visionIdentify');

function ok(res, data) {
  return res.json({ success: true, ...data });
}

function fail(res, message, extra = {}) {
  return res.status(200).json({ success: false, error: message, ...extra });
}

function mountBrowserRoutes(app) {
  const { playwright, BROWSER_TIMEOUT_MS, createSession, getOrCreatePage, closeSession, listTabs } = sessionManager;
  const { extractInteractiveElements } = domParser;
  const { identifyWithVision } = visionIdentify;

  const notInstalled = (req, res) => fail(res, '浏览器模块未安装，请执行: npm install playwright');

  if (!playwright) {
    [
      '/api/tools/browser/session/start',
      '/api/tools/browser/session/end',
      '/api/tools/browser/session/tabs',
      '/api/tools/browser/navigate',
      '/api/tools/browser/click',
      '/api/tools/browser/type',
      '/api/tools/browser/screenshot',
      '/api/tools/browser/dom/interactive',
      '/api/tools/browser/scroll',
      '/api/tools/browser/execute',
      '/api/tools/browser/back',
      '/api/tools/browser/wait',
      '/api/tools/browser/identify',
    ].forEach((r) => app.post(r, notInstalled));
    return;
  }

  /** POST /api/tools/browser/session/start — 创建会话 */
  app.post('/api/tools/browser/session/start', async (req, res) => {
    try {
      const sessionId = await createSession();
      return ok(res, { sessionId });
    } catch (e) {
      return fail(res, e?.message || '创建会话失败');
    }
  });

  /** POST /api/tools/browser/session/end — 关闭会话 */
  app.post('/api/tools/browser/session/end', async (req, res) => {
    try {
      const sessionId = req.body?.sessionId;
      if (!sessionId) return fail(res, '缺少 sessionId');
      await closeSession(sessionId);
      return ok(res, {});
    } catch (e) {
      return fail(res, e?.message || '关闭会话失败');
    }
  });

  /** POST /api/tools/browser/session/tabs — 列出标签页 */
  app.post('/api/tools/browser/session/tabs', async (req, res) => {
    try {
      const sessionId = req.body?.sessionId;
      if (!sessionId) return fail(res, '缺少 sessionId');
      const tabs = listTabs(sessionId);
      if (!tabs) return fail(res, '会话不存在或已过期');
      return ok(res, { tabs });
    } catch (e) {
      return fail(res, e?.message || '获取标签页失败');
    }
  });

  /** 获取 page：支持 sessionId+pageId 或 仅 url（一次性） */
  async function resolvePage(req) {
    const { sessionId, pageId, url } = req.body || {};
    if (sessionId) {
      const r = await getOrCreatePage(sessionId, pageId);
      if (!r.ok) return { ok: false, error: r.error };
      const page = r.page;
      return { ok: true, page, pageId: r.pageId, sessionId };
    }
    if (url) {
      const browser = await sessionManager.launchBrowser();
      const page = await browser.newPage();
      await page.goto(url, { timeout: BROWSER_TIMEOUT_MS });
      return { ok: true, page, browser, oneShot: true };
    }
    return { ok: false, error: '缺少 sessionId 或 url' };
  }

  /** POST /api/tools/browser/navigate — 打开页面 */
  app.post('/api/tools/browser/navigate', async (req, res) => {
    let browser;
    try {
      const { sessionId, pageId, url } = req.body || {};
      if (!url) return fail(res, '缺少 url');
      const r = await resolvePage(req);
      if (!r.ok) return fail(res, r.error);
      const { page } = r;
      browser = r.browser;
      await page.goto(url, { timeout: BROWSER_TIMEOUT_MS });
      const title = await page.title();
      if (browser) await browser.close();
      return ok(res, { url, title, pageId: r.pageId, sessionId: r.sessionId });
    } catch (e) {
      if (browser) await browser.close().catch(() => {});
      return fail(res, e?.message || '打开页面失败');
    }
  });

  /** POST /api/tools/browser/click — 点击元素 */
  app.post('/api/tools/browser/click', async (req, res) => {
    let browser;
    try {
      const { selector } = req.body || {};
      if (!selector) return fail(res, '缺少 selector');
      const r = await resolvePage(req);
      if (!r.ok) return fail(res, r.error);
      const { page } = r;
      browser = r.browser;
      await page.click(selector, { timeout: 10_000 });
      if (browser) await browser.close();
      return ok(res, { selector });
    } catch (e) {
      if (browser) await browser.close().catch(() => {});
      return fail(res, e?.message || '点击失败');
    }
  });

  /** POST /api/tools/browser/type — 在元素内输入 */
  app.post('/api/tools/browser/type', async (req, res) => {
    let browser;
    try {
      const { selector, text } = req.body || {};
      if (!selector) return fail(res, '缺少 selector');
      const r = await resolvePage(req);
      if (!r.ok) return fail(res, r.error);
      const { page } = r;
      browser = r.browser;
      await page.fill(selector, String(text || ''), { timeout: 10_000 });
      if (browser) await browser.close();
      return ok(res, { selector, length: String(text || '').length });
    } catch (e) {
      if (browser) await browser.close().catch(() => {});
      return fail(res, e?.message || '输入失败');
    }
  });

  /** POST /api/tools/browser/screenshot — 页面截屏 */
  app.post('/api/tools/browser/screenshot', async (req, res) => {
    let browser;
    try {
      const r = await resolvePage(req);
      if (!r.ok) return fail(res, r.error);
      const { page } = r;
      browser = r.browser;
      const buf = await page.screenshot({ type: 'png' });
      if (browser) await browser.close();
      const base64 = buf.toString('base64');
      return ok(res, { image: `data:image/png;base64,${base64}` });
    } catch (e) {
      if (browser) await browser.close().catch(() => {});
      return fail(res, e?.message || '截屏失败');
    }
  });

  /** POST /api/tools/browser/dom/interactive — DOM 解析，返回可交互元素 */
  app.post('/api/tools/browser/dom/interactive', async (req, res) => {
    let browser;
    try {
      const r = await resolvePage(req);
      if (!r.ok) return fail(res, r.error);
      const { page } = r;
      browser = r.browser;
      const elements = await extractInteractiveElements(page);
      if (browser) await browser.close();
      return ok(res, { elements });
    } catch (e) {
      if (browser) await browser.close().catch(() => {});
      return fail(res, e?.message || 'DOM 解析失败');
    }
  });

  /** POST /api/tools/browser/scroll — 滚动页面 */
  app.post('/api/tools/browser/scroll', async (req, res) => {
    let browser;
    try {
      const { x = 0, y = 0 } = req.body || {};
      const r = await resolvePage(req);
      if (!r.ok) return fail(res, r.error);
      const { page } = r;
      browser = r.browser;
      await page.evaluate((dx, dy) => window.scrollBy(dx, dy), Number(x) || 0, Number(y) || 0);
      if (browser) await browser.close();
      return ok(res, { x: Number(x) || 0, y: Number(y) || 0 });
    } catch (e) {
      if (browser) await browser.close().catch(() => {});
      return fail(res, e?.message || '滚动失败');
    }
  });

  /** POST /api/tools/browser/back — 浏览器后退 */
  app.post('/api/tools/browser/back', async (req, res) => {
    try {
      const r = await resolvePage(req);
      if (!r.ok) return fail(res, r.error);
      const { page } = r;
      if (!r.sessionId) return fail(res, 'browser_back 需在会话内使用（先 browser_session_start）');
      await page.goBack({ timeout: BROWSER_TIMEOUT_MS });
      const url = page.url();
      const title = await page.title();
      return ok(res, { url, title, pageId: r.pageId, sessionId: r.sessionId });
    } catch (e) {
      return fail(res, e?.message || '后退失败');
    }
  });

  /** POST /api/tools/browser/wait — 等待页面加载（selector 出现或固定时长） */
  app.post('/api/tools/browser/wait', async (req, res) => {
    try {
      const { selector, timeout = 3000 } = req.body || {};
      const r = await resolvePage(req);
      if (!r.ok) return fail(res, r.error);
      const { page } = r;
      const ms = Math.min(Math.max(Number(timeout) || 3000, 500), 30000);
      if (selector && typeof selector === 'string' && selector.trim()) {
        await page.waitForSelector(selector.trim(), { timeout: ms });
      } else {
        await new Promise((r) => setTimeout(r, ms));
      }
      const url = page.url();
      return ok(res, { waited: ms, url, selector: selector || null });
    } catch (e) {
      return fail(res, e?.message || '等待超时');
    }
  });

  /** POST /api/tools/browser/execute — 执行脚本（在页面上下文执行，可返回 JSON 可序列化值） */
  app.post('/api/tools/browser/execute', async (req, res) => {
    let browser;
    try {
      const { script } = req.body || {};
      if (typeof script !== 'string' || !script.trim()) return fail(res, '缺少 script');
      const r = await resolvePage(req);
      if (!r.ok) return fail(res, r.error);
      const { page } = r;
      browser = r.browser;
      const result = await page.evaluate((s) => {
        const fn = new Function(s);
        return fn();
      }, script.trim());
      if (browser) await browser.close();
      return ok(res, { result });
    } catch (e) {
      if (browser) await browser.close().catch(() => {});
      return fail(res, e?.message || '执行脚本失败');
    }
  });

  /** POST /api/tools/browser/identify — 多态识别：截图 + 视觉模型 */
  app.post('/api/tools/browser/identify', async (req, res) => {
    let browser;
    try {
      const { prompt, vendorId, modelId } = req.body || {};
      if (!vendorId || !modelId) return fail(res, '缺少 vendorId 或 modelId' );
      const r = await resolvePage(req);
      if (!r.ok) return fail(res, r.error);
      const { page } = r;
      browser = r.browser;
      const buf = await page.screenshot({ type: 'png' });
      const imageDataUrl = `data:image/png;base64,${buf.toString('base64')}`;
      if (browser) await browser.close();
      const visionResult = await identifyWithVision(imageDataUrl, prompt, vendorId, modelId);
      if (!visionResult.ok) return fail(res, visionResult.error);
      return ok(res, {
        selector: visionResult.selector,
        description: visionResult.description,
        image: imageDataUrl,
      });
    } catch (e) {
      if (browser) await browser.close().catch(() => {});
      return fail(res, e?.message || '识别失败');
    }
  });
}

module.exports = { mountBrowserRoutes };
