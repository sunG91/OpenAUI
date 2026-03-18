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

  // ---------- 浏览器网页操作模块（2.3：会话/DOM/脚本/多态识别）----------
  const { mountBrowserRoutes } = require('../browser');
  mountBrowserRoutes(app);

  // ---------- 本地离线视觉检测（YOLO/ONNX）----------
  const { mountVisionRoutes } = require('../vision');
  mountVisionRoutes(app);

  // ---------- Windows 系统定位（UIA，坐标永不偏差，仅 Windows）----------
  const { locate: winuiLocate, isWindows: isWin } = require('../services/winui-locate');
  const { readSection } = require('../config-store');
  app.post('/api/tools/winui/locate', async (req, res) => {
    try {
      if (!isWin()) return fail(res, '系统定位仅支持 Windows');
      const { name, automationId } = req.body || {};
      const result = await winuiLocate({ name, automationId });
      if (!result.ok) return fail(res, result.error);
      let x = result.x;
      let y = result.y;
      // UIA 返回物理坐标，RobotJS/nut 使用逻辑坐标，需按 DPI 缩放转换
      const tools = readSection('tools') || {};
      const provider = (tools.guiProvider || 'nut').toLowerCase();
      if (result.x != null && result.y != null) {
        try {
          const screenshotDesktop = require('screenshot-desktop');
          const buf = await screenshotDesktop({ format: 'png' });
          const dims = getPngDimensions(buf);
          if (dims) {
            let logicalW = dims.width;
            let logicalH = dims.height;
            if (provider === 'robotjs') {
              const robotjs = require('robotjs');
              if (robotjs) {
                const size = robotjs.getScreenSize();
                logicalW = size.width;
                logicalH = size.height;
              }
            } else {
              const nut = require('@nut-tree/nut-js');
              if (nut) {
                const { screen } = nut;
                logicalW = await screen.width();
                logicalH = await screen.height();
              }
            }
            const scaleX = logicalW / dims.width;
            const scaleY = logicalH / dims.height;
            if (scaleX > 0 && scaleY > 0) {
              x = Math.round(result.x * scaleX);
              y = Math.round(result.y * scaleY);
            }
          }
        } catch (_) { /* 转换失败则使用原始坐标 */ }
      }
      return ok(res, { x, y, name: result.name, automationId: result.automationId, rect: result.rect });
    } catch (e) {
      return fail(res, e?.message || '系统定位失败');
    }
  });

  // ---------- 视觉定位（用于验证码/人机校验等，需 GUI 模拟点击）----------
  const { locateWithVision, verifyLocateWithVision, verifyClickEffect } = require('../browser/visionIdentify');
  app.post('/api/tools/vision/locate', async (req, res) => {
    try {
      const { image, prompt, vendorId, modelId } = req.body || {};
      if (!image || typeof image !== 'string') return fail(res, '缺少 image（base64 data URL）');
      if (!vendorId || !modelId) return fail(res, '缺少 vendorId 或 modelId');
      const result = await locateWithVision(image, prompt || '确认您是真人的复选框', vendorId, modelId);
      if (!result.ok) return fail(res, result.error);
      return ok(res, { x: result.x, y: result.y, element: result.element, confidence: result.confidence });
    } catch (e) {
      return fail(res, e?.message || '视觉定位失败');
    }
  });
  /** 点击坐标审核：接收已标注坐标的截图，AI 验证或修正坐标 */
  app.post('/api/tools/vision/locate/verify', async (req, res) => {
    try {
      const { image, prompt, vendorId, modelId } = req.body || {};
      if (!image || typeof image !== 'string') return fail(res, '缺少 image（base64 data URL，需已标注坐标）');
      if (!vendorId || !modelId) return fail(res, '缺少 vendorId 或 modelId');
      const result = await verifyLocateWithVision(image, prompt || '确认您是真人的复选框', vendorId, modelId);
      if (!result.ok) return fail(res, result.error);
      return ok(res, { correct: result.correct, x: result.x, y: result.y });
    } catch (e) {
      return fail(res, e?.message || '视觉审核失败');
    }
  });
  /** 点击效果校验：点击后截图，判断目标是否已消失/状态改变（OpenClaw 闭环校验） */
  app.post('/api/tools/vision/click/verify', async (req, res) => {
    try {
      const { image, prompt, vendorId, modelId } = req.body || {};
      if (!image || typeof image !== 'string') return fail(res, '缺少 image（base64 data URL，点击后截图）');
      if (!vendorId || !modelId) return fail(res, '缺少 vendorId 或 modelId');
      const result = await verifyClickEffect(image, prompt || '目标元素', vendorId, modelId);
      if (!result.ok) return fail(res, result.error);
      return ok(res, { success: result.success });
    } catch (e) {
      return fail(res, e?.message || '点击效果校验失败');
    }
  });
}

function mountGuiRoutes(app, ok, fail) {
  const { readSection } = require('../config-store');

  const guiNotInstalled = (req, res) => fail(res, 'GUI 模块未安装，请执行: npm install @nut-tree/nut-js 或 npm install robotjs');

  let nut;
  let robotjs;
  try {
    nut = require('@nut-tree/nut-js');
  } catch (_) {}
  try {
    robotjs = require('robotjs');
  } catch (_) {}

  function getGuiProvider() {
    const tools = readSection('tools') || {};
    const p = (tools.guiProvider || 'nut').toLowerCase();
    return p === 'robotjs' ? 'robotjs' : 'nut';
  }

  /** GET /api/tools/gui/screen/size — 屏幕宽高（鼠标移动使用的坐标系） */
  app.get('/api/tools/gui/screen/size', async (req, res) => {
    try {
      const provider = getGuiProvider();
      if (provider === 'robotjs' && robotjs) {
        const size = robotjs.getScreenSize();
        return ok(res, { width: size.width, height: size.height });
      }
      if (nut) {
        const { screen } = nut;
        const width = await screen.width();
        const height = await screen.height();
        return ok(res, { width, height });
      }
      return fail(res, 'GUI 模块未安装');
    } catch (e) {
      return fail(res, e?.message || '获取屏幕尺寸失败');
    }
  });

  /** POST /api/tools/gui/mouse/move — 鼠标移动到 (x, y) */
  app.post('/api/tools/gui/mouse/move', async (req, res) => {
    try {
      const x = Number(req.body?.x);
      const y = Number(req.body?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return fail(res, 'x、y 必须为数字');
      const provider = getGuiProvider();
      if (provider === 'robotjs' && robotjs) {
        robotjs.moveMouse(x, y);
        return ok(res, { x, y });
      }
      if (nut) {
        const { mouse, straightTo, Point } = nut;
        await mouse.move(straightTo(new Point(x, y)));
        return ok(res, { x, y });
      }
      return guiNotInstalled(req, res);
    } catch (e) {
      return fail(res, e?.message || '鼠标移动失败');
    }
  });

  /** POST /api/tools/gui/mouse/click — 鼠标点击（左键/右键，支持双击） */
  app.post('/api/tools/gui/mouse/click', async (req, res) => {
    try {
      const button = (req.body?.button || 'left').toLowerCase();
      const doubleClick = req.body?.doubleClick === true;
      const provider = getGuiProvider();
      if (provider === 'robotjs' && robotjs) {
        if (req.body?.x != null && req.body?.y != null) {
          const x = Number(req.body.x);
          const y = Number(req.body.y);
          if (Number.isFinite(x) && Number.isFinite(y)) robotjs.moveMouse(x, y);
        }
        robotjs.mouseClick(button, doubleClick);
        return ok(res, { button, doubleClick });
      }
      if (nut) {
        const { mouse, straightTo, Point, Button } = nut;
        if (req.body?.x != null && req.body?.y != null) {
          const x = Number(req.body.x);
          const y = Number(req.body.y);
          if (Number.isFinite(x) && Number.isFinite(y)) {
            await mouse.move(straightTo(new Point(x, y)));
          }
        }
        const btn = button === 'right' ? Button.RIGHT : Button.LEFT;
        if (doubleClick) {
          await mouse.doubleClick(btn);
        } else {
          await mouse.click(btn);
        }
        return ok(res, { button, doubleClick });
      }
      return guiNotInstalled(req, res);
    } catch (e) {
      return fail(res, e?.message || '鼠标点击失败');
    }
  });

  /** POST /api/tools/gui/keyboard/type — 键盘输入文本 */
  app.post('/api/tools/gui/keyboard/type', async (req, res) => {
    try {
      const text = typeof req.body?.text === 'string' ? req.body.text : '';
      if (!text) return fail(res, '缺少 text');
      const provider = getGuiProvider();
      if (provider === 'robotjs' && robotjs) {
        robotjs.typeString(text);
        return ok(res, { length: text.length });
      }
      if (nut) {
        const { keyboard } = nut;
        await keyboard.type(text);
        return ok(res, { length: text.length });
      }
      return guiNotInstalled(req, res);
    } catch (e) {
      return fail(res, e?.message || '键盘输入失败');
    }
  });

  mountGuiScreenCapture(app, ok, fail);
}

/** 从 PNG buffer 解析宽高（IHDR 在 offset 16-23），与截屏图片完全一致，避免 DPI 缩放导致 CMD 返回逻辑分辨率 */
function getPngDimensions(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 24) return null;
  if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4E) return null;
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  if (width > 0 && width < 65536 && height > 0 && height < 65536) return { width, height };
  return null;
}

/** GUI 截屏：使用 screenshot-desktop，截屏后从 PNG 解析尺寸（与图片一致，避免 DPI 缩放导致 CMD 返回 1920x1200 而非实际 2880x1800） */
function mountGuiScreenCapture(app, ok, fail) {
  app.get('/api/tools/gui/screen/capture', async (req, res) => {
    let screenshotDesktop;
    try {
      screenshotDesktop = require('screenshot-desktop');
    } catch (_) {
      return fail(res, '截屏模块未安装，请执行: npm install screenshot-desktop');
    }
    try {
      const buf = await screenshotDesktop({ format: 'png' });
      const base64 = buf.toString('base64');
      const payload = { image: `data:image/png;base64,${base64}` };
      const dims = getPngDimensions(buf);
      if (dims) {
        payload.screenWidth = dims.width;
        payload.screenHeight = dims.height;
      }
      return ok(res, payload);
    } catch (e) {
      return fail(res, e?.message || '截屏失败');
    }
  });
}

module.exports = { mountToolsRoutes };
