# 打包用空配置模板

打包 exe 时，`prepare-package-data.js` 会用此目录下的空文件替换 `backend/src/data/` 中的 MCP 凭据等，避免敏感信息被打包。

- `mcp-http-credentials.json` - MCP HTTP 认证凭据（空对象）
- `mcp-vendors.json` - MCP 厂商配置（空数组）

此目录可提交到 Git。
