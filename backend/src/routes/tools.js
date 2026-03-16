/**
 * 系统级工具 API：控制台/Shell 等，供 AI 或用户测试调用
 */
const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fsp = require('fs/promises');
const iconv = require('iconv-lite');

const execAsync = promisify(exec);

const DEFAULT_TIMEOUT_MS = 30 * 1000;
const MAX_TIMEOUT_MS = 120 * 1000;
const isWin = process.platform === 'win32';
const MAX_TEXT_FILE_BYTES = 1024 * 1024; // 1MB
const REPO_ROOT = path.resolve(__dirname, '../../..');

/** Windows 下 CMD 输出多为 GBK，需解码为 UTF-8 再返回前端 */
function decodeOutput(buf) {
  if (buf == null || buf.length === 0) return '';
  if (typeof buf === 'string') return buf;
  if (!Buffer.isBuffer(buf)) return String(buf);
  if (!isWin) return (buf.toString('utf8') || '');
  try {
    return iconv.decode(buf, 'gbk');
  } catch {
    return buf.toString('utf8') || '';
  }
}

function ok(res, data) {
  return res.json({ success: true, ...data });
}

function fail(res, message, extra = {}) {
  return res.status(200).json({ success: false, error: message, ...extra });
}

function safeResolvePath(p) {
  if (typeof p !== 'string' || !p.trim()) return null;
  return path.resolve(p.trim());
}

function isPathInside(childPath, parentPath) {
  const rel = path.relative(parentPath, childPath);
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function assertAllowedFsPath(absPath) {
  if (!absPath) return { ok: false, reason: 'path 为空' };
  // 仅允许仓库目录内的读写，避免变成任意文件后门
  if (!isPathInside(absPath, REPO_ROOT)) return { ok: false, reason: '仅允许操作项目目录内的路径' };
  return { ok: true };
}

async function runCmd(command, opts = {}) {
  const timeout = typeof opts.timeout === 'number' && opts.timeout > 0
    ? Math.min(Math.floor(opts.timeout), MAX_TIMEOUT_MS)
    : DEFAULT_TIMEOUT_MS;
  const options = { timeout, maxBuffer: 4 * 1024 * 1024 };
  if (opts.cwd) options.cwd = opts.cwd;
  if (isWin) options.encoding = 'buffer';
  try {
    const { stdout, stderr } = await execAsync(String(command).trim(), options);
    return { success: true, stdout: decodeOutput(stdout), stderr: decodeOutput(stderr), code: 0 };
  } catch (err) {
    const code = err.code ?? (err.killed ? 124 : 1);
    return {
      success: false,
      error: err.killed ? '命令执行超时' : (err.message || String(err)),
      stdout: decodeOutput(err.stdout) || '',
      stderr: decodeOutput(err.stderr) || '',
      code: typeof code === 'number' ? code : 1,
    };
  }
}

function mountToolsRoutes(app) {
  /** GET /api/tools/platform — 返回服务端系统，供前端提示模型输出对应平台命令 */
  app.get('/api/tools/platform', (req, res) => {
    res.json({ platform: process.platform });
  });

  /** GET /api/tools/project-root — 返回项目根路径，供 AI 生成正确文件路径 */
  app.get('/api/tools/project-root', (req, res) => {
    res.json({ projectRoot: REPO_ROOT });
  });

  /**
   * POST /api/tools/shell
   * Body: { command: string, cwd?: string, timeout?: number }
   * 在服务端执行 shell 命令，返回 stdout、stderr、code（Windows 下 stderr/stdout 已按 GBK 解码）
   */
  app.post('/api/tools/shell', async (req, res) => {
    try {
      const { command, cwd, timeout: rawTimeout } = req.body || {};
      if (typeof command !== 'string' || !command.trim()) {
        return res.status(400).json({ success: false, error: '缺少 command 或为空' });
      }
      const workDir = typeof cwd === 'string' && cwd.trim() ? path.resolve(cwd.trim()) : undefined;
      let timeout = DEFAULT_TIMEOUT_MS;
      if (typeof rawTimeout === 'number' && rawTimeout > 0) {
        timeout = Math.min(Math.floor(rawTimeout), MAX_TIMEOUT_MS);
      }
      const options = { timeout, maxBuffer: 2 * 1024 * 1024 };
      if (workDir) options.cwd = workDir;
      if (isWin) options.encoding = 'buffer';

      const { stdout, stderr } = await execAsync(command.trim(), options);
      return res.json({
        success: true,
        stdout: decodeOutput(stdout),
        stderr: decodeOutput(stderr),
        code: 0,
      });
    } catch (err) {
      const code = err.code ?? (err.killed ? 124 : 1);
      const stdout = decodeOutput(err.stdout);
      const stderr = decodeOutput(err.stderr);
      const message = err.killed ? '命令执行超时' : (err.message || String(err));
      return res.status(200).json({
        success: false,
        error: message,
        stdout: stdout || '',
        stderr: stderr || '',
        code: typeof code === 'number' ? code : 1,
      });
    }
  });

  /**
   * 系统操作（结构化）：
   * - FS：list/read/write（文本）
   * - Process：list/kill
   *
   * 与 /api/tools/shell 的区别：
   * - shell 是“任意命令”，高自由但风险高
   * - system 是“结构化 API”，更可控、更易审计（并限制在项目目录内）
   */

  // FS: list directory
  app.post('/api/tools/system/fs/list', async (req, res) => {
    const abs = safeResolvePath(req.body?.path);
    const allow = assertAllowedFsPath(abs);
    if (!abs) return fail(res, '缺少 path 或为空');
    if (!allow.ok) return fail(res, allow.reason);
    try {
      const st = await fsp.stat(abs);
      if (!st.isDirectory()) return fail(res, '目标不是目录');
      const entries = await fsp.readdir(abs, { withFileTypes: true });
      return ok(res, {
        path: abs,
        entries: entries.map((e) => ({
          name: e.name,
          type: e.isDirectory() ? 'dir' : (e.isFile() ? 'file' : 'other'),
        })),
      });
    } catch (e) {
      return fail(res, e?.message || '读取目录失败');
    }
  });

  // FS: read text file (bounded)
  app.post('/api/tools/system/fs/readText', async (req, res) => {
    const abs = safeResolvePath(req.body?.path);
    const allow = assertAllowedFsPath(abs);
    if (!abs) return fail(res, '缺少 path 或为空');
    if (!allow.ok) return fail(res, allow.reason);
    try {
      const st = await fsp.stat(abs);
      if (!st.isFile()) return fail(res, '目标不是文件');
      if (st.size > MAX_TEXT_FILE_BYTES) return fail(res, `文件过大（>${MAX_TEXT_FILE_BYTES} bytes），拒绝读取`);
      const content = await fsp.readFile(abs, 'utf8');
      return ok(res, { path: abs, content });
    } catch (e) {
      return fail(res, e?.message || '读取文件失败');
    }
  });

  // FS: write text file (bounded)
  app.post('/api/tools/system/fs/writeText', async (req, res) => {
    const abs = safeResolvePath(req.body?.path);
    const allow = assertAllowedFsPath(abs);
    if (!abs) return fail(res, '缺少 path 或为空');
    if (!allow.ok) return fail(res, allow.reason);
    const content = typeof req.body?.content === 'string' ? req.body.content : null;
    if (content == null) return fail(res, '缺少 content 或类型不正确');
    if (Buffer.byteLength(content, 'utf8') > MAX_TEXT_FILE_BYTES) {
      return fail(res, `内容过大（>${MAX_TEXT_FILE_BYTES} bytes），拒绝写入`);
    }
    try {
      await fsp.mkdir(path.dirname(abs), { recursive: true });
      await fsp.writeFile(abs, content, 'utf8');
      return ok(res, { path: abs });
    } catch (e) {
      return fail(res, e?.message || '写入文件失败');
    }
  });

  // Process: list
  app.get('/api/tools/system/process/list', async (req, res) => {
    try {
      const result = isWin
        ? await runCmd('tasklist /FO CSV', { timeout: 20_000 })
        : await runCmd('ps -eo pid,comm,%cpu,%mem --no-headers', { timeout: 20_000 });
      if (!result.success) return fail(res, result.error, result);
      return ok(res, { raw: result.stdout || '' });
    } catch (e) {
      return fail(res, e?.message || '获取进程列表失败');
    }
  });

  // Process: kill
  app.post('/api/tools/system/process/kill', async (req, res) => {
    const pid = Number(req.body?.pid);
    if (!Number.isFinite(pid) || pid <= 0) return fail(res, 'pid 不合法');
    try {
      const result = isWin
        ? await runCmd(`taskkill /PID ${pid} /T /F`, { timeout: 20_000 })
        : await runCmd(`kill -9 ${pid}`, { timeout: 20_000 });
      if (!result.success) return fail(res, result.error, result);
      return ok(res, { pid, stdout: result.stdout || '' });
    } catch (e) {
      return fail(res, e?.message || '结束进程失败');
    }
  });

  // ---------- GUI 模拟（nut.js）----------
  mountGuiRoutes(app, ok, fail);

  // ---------- 浏览器自动化（playwright）----------
  mountBrowserRoutes(app, ok, fail);
}

function mountGuiRoutes(app, ok, fail) {
  const guiNotInstalled = (req, res) => fail(res, 'GUI 模块未安装，请执行: npm install @nut-tree/nut-js');
  let nut;
  try {
    nut = require('@nut-tree/nut-js');
  } catch (e) {
    ['/api/tools/gui/mouse/move', '/api/tools/gui/mouse/click', '/api/tools/gui/keyboard/type'].forEach((r) => app.post(r, guiNotInstalled));
    app.get('/api/tools/gui/screen/capture', guiNotInstalled);
    return;
  }

  const { mouse, keyboard, screen, saveImage, straightTo, Point, Button } = nut;

  /** POST /api/tools/gui/mouse/move — 鼠标移动到 (x, y) */
  app.post('/api/tools/gui/mouse/move', async (req, res) => {
    try {
      const x = Number(req.body?.x);
      const y = Number(req.body?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return fail(res, 'x、y 必须为数字');
      await mouse.move(straightTo(new Point(x, y)));
      return ok(res, { x, y });
    } catch (e) {
      return fail(res, e?.message || '鼠标移动失败');
    }
  });

  /** POST /api/tools/gui/mouse/click — 鼠标点击（左键/右键） */
  app.post('/api/tools/gui/mouse/click', async (req, res) => {
    try {
      const button = (req.body?.button || 'left').toLowerCase();
      if (req.body?.x != null && req.body?.y != null) {
        const x = Number(req.body.x);
        const y = Number(req.body.y);
        if (Number.isFinite(x) && Number.isFinite(y)) {
          await mouse.move(straightTo(new Point(x, y)));
        }
      }
      if (button === 'right') {
        await mouse.click(Button.RIGHT);
      } else {
        await mouse.click(Button.LEFT);
      }
      return ok(res, { button });
    } catch (e) {
      return fail(res, e?.message || '鼠标点击失败');
    }
  });

  /** POST /api/tools/gui/keyboard/type — 键盘输入文本 */
  app.post('/api/tools/gui/keyboard/type', async (req, res) => {
    try {
      const text = typeof req.body?.text === 'string' ? req.body.text : '';
      if (!text) return fail(res, '缺少 text');
      await keyboard.type(text);
      return ok(res, { length: text.length });
    } catch (e) {
      return fail(res, e?.message || '键盘输入失败');
    }
  });

  /** GET /api/tools/gui/screen/capture — 截屏，返回 base64 PNG */
  app.get('/api/tools/gui/screen/capture', async (req, res) => {
    const dataDir = path.join(REPO_ROOT, 'backend', 'data');
    await fsp.mkdir(dataDir, { recursive: true });
    const tmpFile = path.join(dataDir, `_screenshot_${Date.now()}.png`);
    try {
      const region = req.query?.region; // 可选 "x,y,w,h"
      let regionObj;
      if (region) {
        const [x, y, w, h] = region.split(',').map(Number);
        if ([x, y, w, h].every(Number.isFinite) && w > 0 && h > 0) {
          regionObj = new nut.Region(x, y, w, h);
        }
      }
      const screenshot = regionObj ? await screen.capture(regionObj) : await screen.capture();
      await saveImage({ image: screenshot, path: tmpFile });
      const buf = await fsp.readFile(tmpFile);
      const base64 = buf.toString('base64');
      await fsp.unlink(tmpFile).catch(() => {});
      return ok(res, { image: `data:image/png;base64,${base64}` });
    } catch (e) {
      await fsp.unlink(tmpFile).catch(() => {});
      return fail(res, e?.message || '截屏失败');
    }
  });
}

function mountBrowserRoutes(app, ok, fail) {
  const browserNotInstalled = (req, res) => fail(res, '浏览器模块未安装，请执行: npm install playwright');
  let playwright;
  try {
    playwright = require('playwright');
  } catch (e) {
    ['/api/tools/browser/navigate', '/api/tools/browser/click', '/api/tools/browser/type', '/api/tools/browser/screenshot'].forEach((r) => app.post(r, browserNotInstalled));
    return;
  }

  const BROWSER_TIMEOUT = 60_000;

  /** 优先使用系统 Chrome/Edge，无需下载 Chromium */
  async function launchBrowser() {
    for (const channel of ['chrome', 'msedge']) {
      try {
        return await playwright.chromium.launch({ headless: true, channel });
      } catch (_) {}
    }
    return await playwright.chromium.launch({ headless: true });
  }

  /** POST /api/tools/browser/navigate — 打开页面 */
  app.post('/api/tools/browser/navigate', async (req, res) => {
    let browser;
    try {
      const url = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
      if (!url) return fail(res, '缺少 url');
      browser = await launchBrowser();
      const page = await browser.newPage();
      await page.goto(url, { timeout: BROWSER_TIMEOUT });
      const title = await page.title();
      await browser.close();
      return ok(res, { url, title });
    } catch (e) {
      if (browser) await browser.close().catch(() => {});
      return fail(res, e?.message || '打开页面失败');
    }
  });

  /** POST /api/tools/browser/click — 点击元素 */
  app.post('/api/tools/browser/click', async (req, res) => {
    let browser;
    try {
      const url = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
      const selector = typeof req.body?.selector === 'string' ? req.body.selector.trim() : '';
      if (!url || !selector) return fail(res, '缺少 url 或 selector');
      browser = await launchBrowser();
      const page = await browser.newPage();
      await page.goto(url, { timeout: BROWSER_TIMEOUT });
      await page.click(selector, { timeout: 10_000 });
      await browser.close();
      return ok(res, { url, selector });
    } catch (e) {
      if (browser) await browser.close().catch(() => {});
      return fail(res, e?.message || '点击失败');
    }
  });

  /** POST /api/tools/browser/type — 在元素内输入 */
  app.post('/api/tools/browser/type', async (req, res) => {
    let browser;
    try {
      const url = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
      const selector = typeof req.body?.selector === 'string' ? req.body.selector.trim() : '';
      const text = typeof req.body?.text === 'string' ? req.body.text : '';
      if (!url || !selector) return fail(res, '缺少 url 或 selector');
      browser = await launchBrowser();
      const page = await browser.newPage();
      await page.goto(url, { timeout: BROWSER_TIMEOUT });
      await page.fill(selector, text, { timeout: 10_000 });
      await browser.close();
      return ok(res, { url, selector, length: text.length });
    } catch (e) {
      if (browser) await browser.close().catch(() => {});
      return fail(res, e?.message || '输入失败');
    }
  });

  /** POST /api/tools/browser/screenshot — 页面截屏，返回 base64 */
  app.post('/api/tools/browser/screenshot', async (req, res) => {
    let browser;
    try {
      const url = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
      if (!url) return fail(res, '缺少 url');
      browser = await launchBrowser();
      const page = await browser.newPage();
      await page.goto(url, { timeout: BROWSER_TIMEOUT });
      const buf = await page.screenshot({ type: 'png' });
      await browser.close();
      const base64 = buf.toString('base64');
      return ok(res, { image: `data:image/png;base64,${base64}` });
    } catch (e) {
      if (browser) await browser.close().catch(() => {});
      return fail(res, e?.message || '截屏失败');
    }
  });
}

module.exports = { mountToolsRoutes };
