# 打包用空配置模板

打包 exe 时，`prepare-package-data.js` 会用此目录下的空文件替换 `backend/data/` 中的敏感配置，避免 API Key、聊天历史等被打包进安装包。

- `apikeys.json` - 硅基流动、DeepSeek、火山引擎、百度 OCR 等 API Key（空对象）
- `config.json` - 系统配置（空对象，首次运行会按默认值初始化）
- `chat-history.json` - 聊天历史（空会话列表）
- `baidu-ocr-token.json` - 百度 OCR token 缓存（空对象）

此目录可提交到 Git。
