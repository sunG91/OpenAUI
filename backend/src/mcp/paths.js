const path = require('path');
const fs = require('fs');

// 用于统一存放本地 MCP 服务项目的目录，例如：backend/mcp-services
const MCP_SERVICES_DIR = path.join(__dirname, '..', 'mcp-services');

function ensureMcpServicesDir() {
  try {
    if (!fs.existsSync(MCP_SERVICES_DIR)) {
      fs.mkdirSync(MCP_SERVICES_DIR, { recursive: true });
    }
  } catch {
    // 不阻塞主流程，失败时由具体使用处再报错
  }
}

module.exports = {
  MCP_SERVICES_DIR,
  ensureMcpServicesDir,
};

