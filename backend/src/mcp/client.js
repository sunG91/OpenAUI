/**
 * MCP 客户端：基于 stdio + JSON-RPC 2.0
 * 暴露最常用的几个方法：initialize、tools/list、tools/call
 */
const { StdioTransport } = require('./transport-stdio');

class McpClient {
  /**
   * @param {{ command: string, args?: string[], cwd?: string, env?: NodeJS.ProcessEnv, name?: string }} options
   */
  constructor(options) {
    this.transport = new StdioTransport(options);
    this.initialized = false;
    this.info = {
      name: options.name || 'openaui-mcp-client',
      version: '0.1.0',
    };
  }

  async ensureInitialized() {
    if (this.initialized) return;
    try {
      await this.transport.sendRequest('initialize', {
        client: this.info,
      }, 15000);
    } catch (e) {
      // 某些 MCP 实现可能还不支持 initialize，这里兼容忽略
    }
    this.initialized = true;
  }

  async start() {
    await this.ensureInitialized();
  }

  isRunning() {
    return this.transport.isRunning();
  }

  getPid() {
    return this.transport.getPid();
  }

  async listTools() {
    await this.ensureInitialized();
    const result = await this.transport.sendRequest('tools/list', {}, 15000);
    // 标准返回 { tools: [...], nextCursor?: string }
    return result && Array.isArray(result.tools) ? result.tools : [];
  }

  /**
   * 调用工具
   * @param {string} name
   * @param {object} args
   */
  async callTool(name, args) {
    await this.ensureInitialized();
    const result = await this.transport.sendRequest('tools/call', {
      name,
      arguments: args || {},
    }, 30000);
    return result;
  }

  close() {
    this.transport.close();
  }
}

module.exports = {
  McpClient,
};

