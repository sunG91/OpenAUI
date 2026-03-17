# 更新记录（Changelog）

> 这是项目的**源文档**版本。应用内展示读取的是 `frontend/public/docs/CHANGELOG.md`。
>
> 建议你每次更新本文件后，同步复制到 `frontend/public/docs/CHANGELOG.md`（确保应用内能看到最新内容）。

## 0.1.6（2026-03-17）

- 新增：**Skills 库** 详情页「SKILL.md」Tab，点击 skill 进入详情后可单独查看完整 SKILL.md 文档（Markdown 渲染）。
- 优化：**Skills 库** 本地搜索支持文档正文（body），可按名称、描述、文档内容查找 skill。
- 优化：**Skills 库 AI 自动抓取** 四轮关键词搜索（中文、英文、短中文、短英文）始终执行并累加结果，不再因首轮有结果而跳过后续轮次。
- 优化：**Skills 库 AI 自动抓取** Round 2–4 增加兜底：LLM 不可用时使用内置映射（如 自媒体→media/content）与正则提取，确保英文/短中文/短英文搜索仍能执行。
- 优化：**Skills 库 AI 自动抓取** 关键词去重，已搜索过的关键词不再重复请求，节省时间。
- 修复：**ClawHub 导入** 使用 Playwright 渲染 SPA 页面以解析「Download zip」链接，解决 fetch 无法获取动态内容导致的「无法从页面解析出下载地址」问题；需执行 `npm run playwright:install` 安装 Chromium。

## 0.1.5（2026-03-16）

- 新增：**llm_extract_from_content** 工具，由 AI 从原始页面文本中提取与用户目标相关的信息，适配任意网页结构；支持长文本分段处理（每段约 6000 字符）。
- 优化：**browser_execute** 提取逻辑，详情页使用通用选择器（main、[role=main]、.content、#content、body），不再依赖单一站点 selector。
- 优化：**browser_click** 支持多标签页，点击 `target="_blank"` 链接时自动切换到新标签页并返回新 pageId，避免在错误页面执行提取。
- 优化：**browser_type** 先点击聚焦再输入，解决百度等页面搜索框「element is not visible」问题；新增 `pressEnter` 参数，输入后回车提交。
- 优化：**browser_click** 增加 force 回退，元素不可见时自动重试；搜索提交改用 `browser_type` 的 `pressEnter`，不再单独点击搜索按钮。
- 新增：**多搜索引擎支持**，搜索任务优先使用必应（bing.com）或谷歌（google.com），百度（baidu.com）可选；各引擎 selector 已内置。
- 优化：搜索结果页点击前自动等待加载（必应 #b_results、谷歌 #search、百度 #content_left）。
- 优化：搜索流程 schema 与参数补全提示，根据当前搜索引擎动态推荐 selector。
- 优化：Agent 测试区「深度思考」「Plan」「执行结果」支持点击收起/展开；最终结果出现时自动收起过程区块并滚动到结果区。
- 优化：最终结果支持流式展示，结果生成后立即显示；状态及时变更：执行中→已完成，展示中→完成。
- 优化：StreamingText 动画提速，新增 `instant` 参数可跳过动画直接展示全文。

## 0.1.4（2026-03-16）

- 新增：技能面板「自主拆解任务」模块，支持自然语言目标拆分为可执行步骤 Plan；流程为「深度思考 → 任务拆分」，支持「开启深度思考」开关（可关闭时直接拆分，跳过思考层）。
- 新增：**Agent 完整流程** 模块化实现：`agent/toolRegistry`（工具注册表）、`agent/planExecutor`（Plan 执行器）、`agent/orchestrator`（主协调器）、`agent/decompose`（任务拆解）；支持「用户指令 → 拆解 → 规划 → 执行 → 反馈」全链路。
- 新增：**浏览器搜索完整流程**：搜索后点击结果链接打开详情页，再提取内容（不再仅停留在搜索结果页）。
- 新增：**输出方式**：支持「直接展示（Markdown）」与「保存为 .md 文件」两种模式；仅需结果时直接展示，无需生成文件。
- 新增：**内容验证与重试**：`llm_verify_content` 工具，由 LLM 判断提取内容是否满足用户需求；验证不通过时执行 `runIf: prev_verify_failed` 重试块（返回搜索页、点击下一个结果、重新提取、再次验证）。
- 新增：**browser_back** 浏览器后退，返回搜索页必须用此工具（不能用 browser_navigate 打开首页，会丢失搜索结果）。
- 新增：**browser_wait** 等待页面加载（timeout 毫秒或 selector 出现）；点击结果后、提取前插入等待，避免页面空白；若连续多次等待仍无内容可尝试换其他结果。
- 新增：**Agent 流式输出**：拆解阶段（深度思考、Plan 生成）支持流式展示，执行阶段显示「步骤 X/Y 执行中」，最终结果以打字机效果逐字展示；支持流式的模型可开启「流式输出」开关。
- 新增：技能面板「工具」模块，包含系统工具（Shell/FS/进程）、GUI 模拟（nut.js 鼠标/键盘/截屏）、浏览器自动化（Playwright 打开/点击/输入/截屏）。
- 新增：GUI 工具与浏览器工具均支持「查看」「测试」「AI 测试」三个 tab；AI 测试可根据自然语言指令自动选择并调用对应工具。
- 新增：**浏览器网页操作模块（2.3）** 完整实现：DOM 解析、脚本操作（滚动/执行脚本）、多态识别（截图+视觉模型）、多标签页（会话管理）。
- 新增：浏览器模块化封装（backend/src/browser/：sessionManager、domParser、visionIdentify、index）。
- 修复：GUI 截屏改用 screenshot-desktop 实现，直接返回 PNG buffer，解决 nut.js saveImage 报错问题。
- 新增：**本地离线视觉检测** 工具（YOLO/ONNX），`npm run vision:download-model` 一键下载模型；模型文件已加入 .gitignore。

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
- 新增：首次启动时自动初始化本地配置文件（apikeys.json、voice-settings.json、skill-settings.json、mcp-settings.json、mcp-http-credentials.json），无需手动创建。
- 新增：根目录 .gitignore 与 backend/data/.gitignore 补充，忽略本地配置、API Key、piper/ffmpeg/whisper/vosk 等大体积运行时，便于推送 GitHub。
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

