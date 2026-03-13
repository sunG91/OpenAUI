/**
 * MCP 管理器：
 * - 读取 mcp-settings.json 的 servers 列表
 * - 为每个启用的 server 维护一个 McpClient 实例
 * - 提供 listTools / callTool 的统一入口
 */
const path = require('path');
const { readMcpSettings } = require('../mcp-settings-store');
const { McpClient } = require('./client');
const { HttpMcpClient } = require('./http-client');
const { MCP_SERVICES_DIR, ensureMcpServicesDir } = require('./paths');

const clients = new Map();

function getServerConfig(serverId) {
  const settings = readMcpSettings();
  const list = Array.isArray(settings.servers) ? settings.servers : [];
  return list.find((s) => (s.id || '').trim() === serverId.trim());
}

function createClientForConfig(config) {
  const type = (config.type || 'stdio').trim();
  if (type === 'streamableHttp' || type === 'http') {
    if (!config.url || !String(config.url).trim()) {
      throw new Error(`HTTP MCP 配置缺少 url：${config.name || config.id || '未知'}`);
    }
    return new HttpMcpClient({
      url: String(config.url).trim(),
      serverId: config.id,
      name: config.name || config.id || 'openaui-http-mcp',
      vendorId: config.vendorId || '',
    });
  }

  // 默认走本地 stdio MCP
  ensureMcpServicesDir();
  const baseCwd = path.join(__dirname, '..');
  const cwd =
    typeof config.dir === 'string' && config.dir.trim()
      ? path.join(MCP_SERVICES_DIR, config.dir.trim())
      : baseCwd;
  let args = typeof config.args === 'string' && config.args.trim()
    ? config.args.trim().split(/\s+/g)
    : [];
  const port = typeof config.port === 'number' && config.port > 0 ? config.port : null;
  if (port && !args.some((a) => String(a).startsWith('--port'))) {
    args = [...args, '--port', String(port)];
  }
  if (!config.command || !String(config.command).trim()) {
    throw new Error(`MCP 配置缺少启动命令：${config.name || config.id || '未知'}`);
  }
  return new McpClient({
    command: config.command,
    args,
    cwd,
    name: config.name || config.id || 'openaui-mcp',
  });
}

function getClient(serverId) {
  const existing = clients.get(serverId);
  if (existing) return existing;
  const cfg = getServerConfig(serverId);
  if (!cfg) {
    throw new Error(`未找到 MCP 配置：${serverId}`);
  }
  if (cfg.enabled === false) {
    throw new Error(`MCP 已被禁用：${cfg.name || serverId}`);
  }
  const client = createClientForConfig(cfg);
  clients.set(serverId, client);
  return client;
}

async function listServerTools(serverId) {
  const client = getClient(serverId);
  const tools = await client.listTools();
  return tools;
}

async function callServerTool(serverId, toolName, args) {
  const client = getClient(serverId);
  const result = await client.callTool(toolName, args || {});
  return result;
}

async function startServer(serverId) {
  const client = getClient(serverId);
  await client.start();
  return {
    running: client.isRunning(),
    pid: client.getPid(),
  };
}

function getServerStatus(serverId) {
  const client = clients.get(serverId);
  if (!client) {
    return { running: false, pid: null };
  }
  return {
    running: client.isRunning(),
    pid: client.getPid(),
  };
}

function disposeClient(serverId) {
  const c = clients.get(serverId);
  if (c) {
    try {
      c.close();
    } catch {
      // ignore
    }
    clients.delete(serverId);
  }
}

function disposeAll() {
  for (const id of clients.keys()) {
    disposeClient(id);
  }
}

module.exports = {
  listServerTools,
  callServerTool,
  disposeClient,
  disposeAll,
  startServer,
  getServerStatus,
};

