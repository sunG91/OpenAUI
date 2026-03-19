/**
 * 对话中 MCP 工具调用：收集 MCP 工具、转换为 OpenAI 格式、执行 tool_calls 并继续对话
 * API 限制 tool name 最大 64 字符，使用短名 mcp_0, mcp_1... 并通过 nameMap 解析
 */
const { getMcpEnabledServerIdsForChat } = require('../skill-settings-store');
const { listServerTools, callServerTool } = require('../mcp/manager');

/** 将 MCP 工具转为 OpenAI function 格式，使用短名避免超 64 字符 */
function mcpToolToOpenAI(tool, shortName) {
  const schema = tool.inputSchema || { type: 'object', properties: {}, required: [] };
  return {
    type: 'function',
    function: {
      name: shortName,
      description: (tool.description || tool.title || '').trim() || `MCP 工具：${tool.name}`,
      parameters: {
        type: schema.type || 'object',
        properties: schema.properties || {},
        required: Array.isArray(schema.required) ? schema.required : [],
      },
    },
  };
}

/** 收集所有已启用 MCP 服务的工具，转为 OpenAI 格式；返回 { tools, nameMap } */
async function collectMcpToolsForOpenAI() {
  const serverIds = getMcpEnabledServerIdsForChat();
  if (serverIds.length === 0) return { tools: [], nameMap: {} };
  const tools = [];
  const nameMap = {};
  let idx = 0;
  for (const serverId of serverIds) {
    try {
      const list = await listServerTools(serverId);
      if (Array.isArray(list)) {
        for (const t of list) {
          if (t && t.name) {
            const shortName = `mcp_${idx}`;
            idx++;
            tools.push(mcpToolToOpenAI(t, shortName));
            nameMap[shortName] = { serverId, toolName: (t.name || '').trim() || 'unknown' };
          }
        }
      }
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[MCP] 获取工具失败:', serverId, e?.message);
      }
    }
  }
  return { tools, nameMap };
}

/** 执行单个 MCP 工具调用 */
async function executeMcpToolCall(toolName, argsJson, nameMap = {}) {
  const resolved = nameMap[toolName];
  const serverId = resolved?.serverId;
  const name = resolved?.toolName;
  if (!serverId || !name) {
    throw new Error(`无效的 MCP 工具名：${toolName}`);
  }
  let args = {};
  if (argsJson && typeof argsJson === 'string') {
    try {
      args = JSON.parse(argsJson);
    } catch {
      args = {};
    }
  } else if (argsJson && typeof argsJson === 'object') {
    args = argsJson;
  }
  const result = await callServerTool(serverId, name, args);
  return typeof result === 'string' ? result : JSON.stringify(result);
}

module.exports = {
  collectMcpToolsForOpenAI,
  executeMcpToolCall,
};
