/**
 * MCP stdio 传输层：
 * - 通过 child_process.spawn 启动 MCP Server
 * - 使用 JSON-RPC 2.0 + 换行分隔的消息协议
 */
const { spawn } = require('child_process');
const readline = require('readline');

class StdioTransport {
  /**
   * @param {{ command: string, args?: string[], cwd?: string, env?: NodeJS.ProcessEnv }} options
   */
  constructor(options) {
    const { command, args = [], cwd, env } = options || {};
    if (!command || typeof command !== 'string') {
      throw new Error('MCP Server 启动命令不能为空');
    }
    this.command = command;
    this.args = args;
    this.cwd = cwd;
    this.env = env;
    this.child = null;
    this.nextId = 1;
    this.pending = new Map();
    this.closed = false;
  }

  ensureStarted() {
    if (this.child || this.closed) return;
    const child = spawn(this.command, this.args, {
      cwd: this.cwd || process.cwd(),
      env: { ...process.env, ...(this.env || {}) },
      stdio: ['pipe', 'pipe', 'inherit'],
    });
    this.child = child;

    const rl = readline.createInterface({ input: child.stdout });
    rl.on('line', (line) => {
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        return;
      }
      if (!msg || typeof msg !== 'object') return;
      const { id, result, error } = msg;
      if (id == null) return;
      const pending = this.pending.get(id);
      if (!pending) return;
      this.pending.delete(id);
      if (error) {
        pending.reject(new Error(error.message || 'MCP 请求失败'));
      } else {
        pending.resolve(result);
      }
    });

    child.on('exit', () => {
      this.child = null;
      if (!this.closed) {
        for (const [, pending] of this.pending) {
          pending.reject(new Error('MCP Server 进程已退出'));
        }
        this.pending.clear();
      }
    });

    child.on('error', (err) => {
      // 避免未捕获错误导致整个后端退出
      this.child = null;
      if (!this.closed) {
        for (const [, pending] of this.pending) {
          pending.reject(err instanceof Error ? err : new Error(String(err)));
        }
        this.pending.clear();
      }
    });
  }

  isRunning() {
    return !!(this.child && !this.closed);
  }

  getPid() {
    return this.child && !this.closed ? this.child.pid : null;
  }

  /**
   * 发送 JSON-RPC 请求
   * @param {string} method
   * @param {object} params
   * @param {number} [timeoutMs=15000]
   * @returns {Promise<any>}
   */
  sendRequest(method, params = {}, timeoutMs = 15000) {
    if (this.closed) {
      return Promise.reject(new Error('MCP 连接已关闭'));
    }
    this.ensureStarted();
    if (!this.child || !this.child.stdin) {
      return Promise.reject(new Error('MCP Server 未启动'));
    }
    const id = this.nextId++;
    const msg = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP 请求超时：${method}`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
      try {
        this.child.stdin.write(JSON.stringify(msg) + '\n');
      } catch (e) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(e);
      }
    });
  }

  close() {
    this.closed = true;
    if (this.child) {
      try {
        this.child.kill();
      } catch {
        // ignore
      }
      this.child = null;
    }
    for (const [, pending] of this.pending) {
      pending.reject(new Error('MCP 连接已关闭'));
    }
    this.pending.clear();
  }
}

module.exports = {
  StdioTransport,
};

