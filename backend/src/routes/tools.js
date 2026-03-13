/**
 * 系统级工具 API：控制台/Shell 等，供 AI 或用户测试调用
 */
const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const iconv = require('iconv-lite');

const execAsync = promisify(exec);

const DEFAULT_TIMEOUT_MS = 30 * 1000;
const MAX_TIMEOUT_MS = 120 * 1000;
const isWin = process.platform === 'win32';

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

function mountToolsRoutes(app) {
  /** GET /api/tools/platform — 返回服务端系统，供前端提示模型输出对应平台命令 */
  app.get('/api/tools/platform', (req, res) => {
    res.json({ platform: process.platform });
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
}

module.exports = { mountToolsRoutes };
