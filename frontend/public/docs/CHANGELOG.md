# 更新记录（Changelog）

## 0.1.4（2026-03-16）

- 新增：技能面板「工具」模块，包含系统工具（Shell/FS/进程）、GUI 模拟（nut.js 鼠标/键盘/截屏）、浏览器自动化（Playwright 打开/点击/输入/截屏）。
- 新增：GUI 工具与浏览器工具均支持「查看」「测试」「AI 测试」三个 tab；AI 测试可根据自然语言指令自动选择并调用对应工具。
- 新增：**浏览器网页操作模块（2.3）** 完整实现：DOM 解析（提取按钮、输入框、链接等可交互元素）、脚本操作（滚动、执行脚本）、多态识别（截图 + 视觉模型识别 UI 元素）、多标签页（会话管理 session/start|end|tabs）。
- 新增：浏览器模块化封装（backend/src/browser/：sessionManager、domParser、visionIdentify、index）。
- 修复：GUI 截屏改用 <strong>screenshot-desktop</strong> 实现，直接返回 PNG buffer，解决 nut.js saveImage 报错问题。

## 0.1.3（2026-03-14）

- 新增：流式输出模块 `StreamingText`，所有流式回答统一走此组件；逐字吐出、速度随 AI 返回节奏自适应，带渐变光标与最后一字弹出动画。
- 优化：SUI 识别结果区使用 `StreamingText` 展示流式内容；流式时优先显示已返回内容，不再被「正在识别…」遮挡。
- 优化：SUI 右侧「AI 识别结果」高度固定、超出可纵向滚动；回答时自动滚到底部，用户主动上滑查看时保持位置。
- 修复：流式接口支持 Content-Type 为 application/json 时的非流式回包与 120 秒超时，避免长时间卡在「正在识别…」。

## 0.1.2（2026-03-14）

- 新增：技能「SUI」（看见 UI），截屏或上传图片转 base64 发送给视觉模型识别；技能面板内 SUI 测试区仅展示带「视觉识别/图片分析」标签的模型。
- 新增：对话输入栏增加 SUI 技能按钮，点击可跳转技能面板并激活 SUI 模块。
- 优化：Electron 下截屏必须可用，主进程使用 setDisplayMediaRequestHandler + desktopCapturer 接管 getDisplayMedia，preload 暴露 getDesktopSources 作为后备。
- 修复：更新记录弹窗内容区可正常向下滚动、触发「向下滚动加载更多」。
- 新增：首次启动时自动初始化本地配置文件（apikeys.json、voice-settings.json 等），无需手动创建。
- 新增：根目录 .gitignore 与 backend/data/.gitignore 补充，忽略本地配置、API Key、大体积运行时，便于推送 GitHub。
- 新增：README.en.md 英文版说明，便于 GitHub 国际用户阅读。

## 0.1.1（2026-03-13）

- 新增：MCP 配置与测试面板支持「MCP 调用 / 模型测试」两种模式，便于分别手动调试工具和纯模型自动调 tools。
- 优化：MCP 服务列表支持折叠、只展开当前编辑项，并且可以单独指定右侧使用哪个 MCP，不再互相干扰。
- 修复：多个 HTTP MCP（例如多个阿里云百炼实例）现在会使用唯一 id，不会再出现多个实例同时显示为「右侧正在使用」的问题。
- 新增：技能面板新增 MCP 模块，支持在技能测试中进行「MCP 对话测试」（左输入右输出，可切换查看工具原始返回与 AI 回答）。
- 新增：对话输入栏增加 MCP 技能按钮，并与技能开关同步显示。
- 新增：全局快捷键 Ctrl+S / Cmd+S 保存（在对应面板触发保存动作）。
- 优化：Markdown 渲染增强（表格/加粗/斜体/横向滚动），报告展示更稳定。
- 优化：语音模块配置全局生效（STT/TTS/自动朗读按统一设置执行）。

## Unreleased

- 新增：点击底部版本号可查看更新记录
- 优化：AI 头像与应用图标统一为同一张图
- 修复：开源协议显示为 Apache-2.0
- 新增：语音模块设置（STT/TTS/唤醒词开关与参数）
- 新增：离线语音转文字（Whisper.cpp / Vosk 可切换）
- 新增：离线文字转语音（Windows SAPI / Piper 可切换，支持音色下拉）
- 新增：Edge TTS（联网免费，提供更自然的中文音色）
- 预留：第三种朗读引擎 GPT-SoVITS 入口（占位，后续接入）

