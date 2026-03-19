# 更新记录（Changelog）

## 0.1.9（2026-03-19）

- 新增：**记忆存储** 侧边栏新增「记忆存储」模块（Skills 库下方），基于 Vectra + Xenova 本地向量存储，向量数据存于 `backend/data/vectra/` 独立目录。
- 新增：**向量嵌入** 对接 @xenova/transformers，默认 Xenova/all-MiniLM-L6-v2（384 维），国内默认使用 HF 镜像；支持 `insertText`、`queryByText` 文本级记忆。
- 新增：**模型测试 - 向量模型** 工具模块中新增「向量模型」入口，可测试文本→向量嵌入，无需 API Key。
- 新增：**一键安装** `npm run install-all` 支持 `--skip-embeddings`，自动预下载 Embeddings 模型；国内默认 `HF_ENDPOINT=https://hf-mirror.com`。
- 优化：**侧边栏** 导航项超出时支持纵向滚动。
- 优化：**install-all** 移除 zvec（Python），记忆存储改用 Node.js 原生 Vectra。

## 0.1.8（2026-03-18）

- 新增：**AUI 模块** 侧边栏新增 AUI 入口（历史下方），含「AUI 介绍」「架构选择」两个 Tab。
- 新增：**天枢架构** 三层决策中枢 + 七大执行部 + 赏罚台机制；架构配置持久化到系统配置。
- 新增：**架构图** 无连线、主次分明的架构图风格；支持流程图/文档介绍切换。
- 新增：**产品设计文档** 天枢架构图 v0.0.1，标注待开发，欢迎学习讨论。

## 0.1.7（2026-03-18）

- 新增：**Electron 完整打包** 前后端合并为单一可执行程序，`npm run electron:build` 生成 `release/win-unpacked/Open AUI.exe`，内置 Node 与后端，无需系统安装 Node.js。
- 新增：**GUI 节点执行** 配置 `guiExecutor`（`backend` | `node`），Electron 下可将 GUI 工具在主进程执行；GUI 工具「查看」中增加执行位置切换（仅 Electron 显示）。
- 新增：**A2UI 画布** 轻量画布面板，支持 surfaceUpdate、beginRendering 协议；Agent 可调用 `POST /api/canvas/push` 推送并实时渲染。
- 新增：**React Flow Demo**（临时）节点流可视化：可拖动节点、拖拽连线、科技感样式；FlowEdge 含青色线条、边标签、流动光点；TechNode 含 Handle 连接点。
- 新增：**WinuiTools**「精准定位」「系统定位测试」两个 Tab；Plan 提示词精简为 5 个工具；新增 gui_wait_element 轮询定位。
- 优化：**本地 OCR** 命名（原「Tesseract.js 本地」改为「本地 OCR」）。
- 修复：**WinUI 定位** 点击豆包等图标无效：DPI 缩放坐标转换；PowerShell 中文乱码通过 UTF-8 临时文件传递。
- 优化：**Electron 打包** 图标与 AI 头像支持自定义（`public/images/icon/icon.ico`、`public/images/头像/ai.png`）；修复打包后头像路径解析问题。

## 0.1.6（2026-03-17）

- 新增：**GUI 模拟测试** 视觉识别提示词预设（`guiVisionPrompts.js` 技能模块），支持「严格按刻度」「通用描述」「自定义」三种预设，可在此绑定/扩展。
- 优化：**GUI 模拟测试** 带网格截图的视觉对话，默认提示词要求坐标严格按图上刻度读取，不得估算；已知 nut 尺寸时自动注入坐标范围。
- 优化：**GUI 网格绘制** 线条更细（lineW 0.0008）、格子更小（目标 120px/cell，1920×1200 约 16×10 格），刻度更密集便于精确定位。
- 新增：**Skills 库** 详情页「SKILL.md」Tab，点击 skill 进入详情后可单独查看完整 SKILL.md 文档（Markdown 渲染）。
- 优化：**Skills 库** 本地搜索支持文档正文（body），可按名称、描述、文档内容查找 skill。
- 优化：**Skills 库 AI 自动抓取** 四轮关键词搜索（中文、英文、短中文、短英文）始终执行并累加结果，不再因首轮有结果而跳过后续轮次。
- 优化：**Skills 库 AI 自动抓取** Round 2–4 增加兜底：LLM 不可用时使用内置映射（如 自媒体→media/content）与正则提取，确保英文/短中文/短英文搜索仍能执行。
- 优化：**Skills 库 AI 自动抓取** 关键词去重，已搜索过的关键词不再重复请求，节省时间。
- 修复：**ClawHub 导入** 使用 Playwright 渲染 SPA 页面以解析「Download zip」链接，解决 fetch 无法获取动态内容导致的「无法从页面解析出下载地址」问题；需执行 `npm run playwright:install` 安装 Chromium。

## 0.1.5（2026-03-16）

- 新增：**llm_extract_from_content** 工具，由 AI 从原始页面文本中提取与用户目标相关的信息，适配任意网页结构；支持长文本分段处理。
- 优化：`browser_execute` 提取逻辑，详情页使用通用选择器，不再依赖单一站点 selector。
- 优化：`browser_click` 支持多标签页，点击新窗口链接时自动切换到新标签页。
- 优化：`browser_type` 先点击聚焦再输入，解决搜索框「element is not visible」问题；新增 `pressEnter` 参数。
- 优化：`browser_click` 增加 force 回退；搜索提交改用 `pressEnter`，不再单独点击搜索按钮。
- 新增：**多搜索引擎支持**，搜索任务优先使用必应或谷歌，百度可选；各引擎 selector 已内置。
- 优化：搜索结果页点击前自动等待加载；schema 与参数补全根据当前搜索引擎动态推荐 selector。
- 优化：Agent 测试区「深度思考」「Plan」「执行结果」可收起；最终结果出现时自动收起并滚动到结果区。
- 优化：最终结果流式展示，状态及时变更（执行中→已完成，展示中→完成）。
- 优化：StreamingText 提速，新增 `instant` 参数。

## 0.1.4（2026-03-16）

- 新增：技能面板「自主拆解任务」模块，支持自然语言目标拆分为可执行步骤 Plan；流程为「深度思考 → 任务拆分」，支持「开启深度思考」开关（可关闭时直接拆分，跳过思考层）。
- 新增：**Agent 完整流程** 模块化实现：toolRegistry、planExecutor、orchestrator、decompose；支持「用户指令 → 拆解 → 规划 → 执行 → 反馈」全链路。
- 新增：**浏览器搜索完整流程**：搜索后点击结果链接打开详情页，再提取内容（不再仅停留在搜索结果页）。
- 新增：**输出方式**：支持「直接展示（Markdown）」与「保存为 .md 文件」两种模式；仅需结果时直接展示，无需生成文件。
- 新增：**内容验证与重试**：`llm_verify_content` 工具，由 LLM 判断提取内容是否满足用户需求；验证不通过时执行 `runIf: prev_verify_failed` 重试块（返回搜索页、点击下一个结果、重新提取、再次验证）。
- 新增：`browser_back` 浏览器后退；`browser_wait` 等待页面加载（避免页面空白）。
- 新增：**Agent 流式输出**：拆解、执行、最终结果均支持流式/增量展示，减少等待感。
- 新增：技能面板「工具」模块，包含系统工具（Shell/FS/进程）、GUI 模拟（nut.js 鼠标/键盘/截屏）、浏览器自动化（Playwright 打开/点击/输入/截屏）。
- 新增：GUI 工具与浏览器工具均支持「查看」「测试」「AI 测试」三个 tab；AI 测试可根据自然语言指令自动选择并调用对应工具。
- 新增：**浏览器网页操作模块（2.3）** 完整实现：DOM 解析（提取按钮、输入框、链接等可交互元素）、脚本操作（滚动、执行脚本）、多态识别（截图 + 视觉模型识别 UI 元素）、多标签页（会话管理 session/start|end|tabs）。
- 新增：浏览器模块化封装（backend/src/browser/：sessionManager、domParser、visionIdentify、index）。
- 修复：GUI 截屏改用 **screenshot-desktop** 实现，直接返回 PNG buffer，解决 nut.js saveImage 报错问题。
- 新增：**本地离线视觉检测** 工具（YOLO/ONNX），模型文件下载到本地，100% 离线运行，支持通用目标检测，不依赖第三方 API。
- 新增：`npm run vision:download-model` 一键下载 YOLOv8n 预训练模型；模型文件已加入 .gitignore，不会随仓库上传。

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

