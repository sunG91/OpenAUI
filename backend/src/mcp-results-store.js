/**
 * MCP 调用结果存储：按 messageId+sessionId 分目录存放
 * 目录名：{messageId}+{sessionId}
 * 文件：{toolName}.json，内容 { result, summary }
 * 清理时机：会话删除、回退、删除单条消息时同步删除对应 MCP 目录
 */
const fs = require('fs');
const path = require('path');
const { getDataDir } = require('./data-path');

const MCP_RESULTS_DIR = path.join(getDataDir(), 'mcp-results');

function ensureDir(dir = MCP_RESULTS_DIR) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** 目录名：messageId+sessionId */
function getDirName(messageId, sessionId) {
  return `${messageId}+${sessionId}`;
}

function getDirPath(messageId, sessionId) {
  ensureDir();
  return path.join(MCP_RESULTS_DIR, getDirName(messageId, sessionId));
}

/** 保存单个 MCP 工具的结果与 AI 总结 */
function saveMcpResult(messageId, sessionId, toolName, data) {
  const dir = getDirPath(messageId, sessionId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const safeName = String(toolName).replace(/[^a-zA-Z0-9_-]/g, '_') || 'unknown';
  const filePath = path.join(dir, `${safeName}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

/** 读取单个 MCP 工具的结果 */
function loadMcpResult(messageId, sessionId, toolName) {
  const dir = getDirPath(messageId, sessionId);
  const safeName = String(toolName).replace(/[^a-zA-Z0-9_-]/g, '_') || 'unknown';
  const filePath = path.join(dir, `${safeName}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

/** 读取某条消息下所有 MCP 结果 */
function loadMcpResultsForMessage(messageId, sessionId) {
  const dir = getDirPath(messageId, sessionId);
  if (!fs.existsSync(dir)) return {};
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  const out = {};
  for (const f of files) {
    const toolName = f.replace(/\.json$/, '');
    try {
      out[toolName] = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    } catch {}
  }
  return out;
}

/** 删除某条消息关联的 MCP 结果（回退/删除单条消息时调用） */
function deleteMcpResultsByMessage(messageId, sessionId) {
  if (!messageId || !sessionId) return;
  const dirPath = path.join(MCP_RESULTS_DIR, getDirName(messageId, sessionId));
  if (fs.existsSync(dirPath)) {
    try {
      fs.rmSync(dirPath, { recursive: true });
    } catch {}
  }
}

/** 删除某会话关联的所有 MCP 结果（会话删除时调用） */
function deleteMcpResultsBySessionId(sessionId) {
  ensureDir();
  const entries = fs.readdirSync(MCP_RESULTS_DIR, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory() && e.name.endsWith(`+${sessionId}`)) {
      const dirPath = path.join(MCP_RESULTS_DIR, e.name);
      try {
        fs.rmSync(dirPath, { recursive: true });
      } catch {}
    }
  }
}

module.exports = {
  saveMcpResult,
  loadMcpResult,
  loadMcpResultsForMessage,
  deleteMcpResultsByMessage,
  deleteMcpResultsBySessionId,
};
