/**
 * HTTP MCP 客户端（streamableHttp）：
 * - 通过 HTTP POST 发送 JSON-RPC 2.0 消息
 * - 当前用于兼容第三方 MCP（例如阿里云百炼）
 */
const { readApiKeys } = require('../apikeys-store');

class HttpMcpClient {
  /**
   * @param {{ url: string, serverId: string, name?: string, vendorId?: string }} options
   */
  constructor(options) {
    const { url, serverId, name, vendorId } = options || {};
    if (!url || typeof url !== 'string') {
      throw new Error('HTTP MCP 配置缺少 url');
    }
    if (!serverId || typeof serverId !== 'string') {
      throw new Error('HTTP MCP 配置缺少 serverId');
    }
    this.url = url;
    this.serverId = serverId;
    this.vendorId = vendorId || '';
    this.info = {
      name: name || 'openaui-http-mcp-client',
      version: '0.1.0',
    };
    this.initialized = false;
  }

  getAuthHeaders() {
    const allKeys = readApiKeys();
    const vid = this.vendorId || 'aliyun-bailian';
    const rawKey = allKeys[vid] && String(allKeys[vid]).trim();
    if (!rawKey) {
      throw new Error(
        `MCP「${this.serverId}」尚未配置 API Key，请在「设置 → API Key 设置」中为「阿里云百炼」或对应厂商填写 API Key。`,
      );
    }
    const authorization = rawKey.startsWith('Bearer ') ? rawKey : `Bearer ${rawKey}`;
    return { Authorization: authorization };
  }

  async sendRequest(method, params, timeoutMs = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
      };
      const body = JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params: params || {},
      });
      const res = await fetch(this.url, { method: 'POST', headers, body, signal: controller.signal });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error?.message || data.error || res.statusText);
      }
      if (data.error) {
        throw new Error(data.error.message || String(data.error));
      }
      return data.result;
    } catch (e) {
      if (e.name === 'AbortError') {
        throw new Error(`MCP HTTP 请求超时：${method}`);
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  async ensureInitialized() {
    if (this.initialized) return;
    try {
      await this.sendRequest('initialize', { client: this.info }, 15000);
    } catch {
      // 某些实现可能未实现 initialize，兼容忽略
    }
    this.initialized = true;
  }

  async start() {
    await this.ensureInitialized();
  }

  isRunning() {
    // 对于 HTTP MCP，只要能正常请求就认为是运行中；此处仅表示客户端已初始化
    return this.initialized;
  }

  getPid() {
    // HTTP MCP 无本地进程概念
    return null;
  }

  async listTools() {
    await this.ensureInitialized();
    const result = await this.sendRequest('tools/list', {}, 15000);
    return result && Array.isArray(result.tools) ? result.tools : [];
  }

  async callTool(name, args) {
    await this.ensureInitialized();
    const result = await this.sendRequest('tools/call', { name, arguments: args || {} }, 30000);
    return result;
  }

  close() {
    // HTTP 模式无需清理进程，标记为未初始化即可
    this.initialized = false;
  }
}

module.exports = {
  HttpMcpClient,
};

