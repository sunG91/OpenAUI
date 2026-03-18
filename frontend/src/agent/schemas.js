/**
 * Agent 模块 - 统一 Schema 定义
 * 供任务拆解、步骤参数补全、工具调用等 prompt 使用
 */

export const TOOL_SCHEMA = `
可选工具（输出 JSON，仅一个 tool 调用）：

【GUI 模拟】
- gui_mouse_move: 鼠标移动。参数: x, y (数字)
- gui_mouse_click: 鼠标点击。参数: button(left/right), x(可选), y(可选)
- gui_keyboard_type: 键盘输入（别名 gui_keyboard_input）。参数: text
- gui_screen_capture: 仅截屏。参数: region(可选 "x,y,w,h")
- winui_locate: 系统级 UI 定位（仅 Windows，坐标永不偏差）。参数: name(元素名称如"确定") 或 automationId。返回 x,y 供 gui_mouse_click 使用。

【控制台】
- console_shell: 仅执行系统命令（dir、echo 等），不能从网页提取数据

【系统操作】
- fs_list: 列目录。参数: path
- fs_read_text: 读文件。参数: path
- fs_write_text: 写文件。参数: path, content
- process_list: 进程列表。无参数
- process_kill: 结束进程。参数: pid (慎用)

【浏览器】网页内操作优先用 browser_*，比 gui_* 更准确
- browser_navigate: 打开页面。参数: url。搜索可选用：必应 https://www.bing.com、谷歌 https://www.google.com、百度 https://www.baidu.com
- browser_click: 点击元素。参数: url, selector。必应第一个结果：#b_results li.b_algo h2 a；谷歌：#search .g h3 a；百度：#content_left h3 a。需 browser_wait 等待结果加载后再点击。
- browser_type: 在元素内输入文本。参数: url, selector, text, pressEnter(搜索提交用 true)。必应：#sb_form_q；谷歌：input[name=q]；百度：#kw。
- browser_screenshot: 页面截屏。参数: url
- browser_dom_interactive: 解析可交互元素，返回链接/按钮等。参数: url
- browser_scroll: 滚动。参数: url, x, y
- browser_execute: 执行 JavaScript 提取页面文字。script 必须 return 字符串。通用提取（任意网页）："return (document.querySelector('main')||document.querySelector('[role=main]')||document.querySelector('.content')||document.querySelector('#content')||document.body).innerText"
- browser_back: 浏览器后退（返回上一页）。无参数，需在会话内使用。
- browser_wait: 等待页面加载。参数: timeout(毫秒，默认3000)、selector(可选，等待该元素出现)

【视觉检测】
- vision_screen_detect: 截屏+YOLO 物体检测。参数: modelId(可选)
- vision_detect: 对已有图片做物体检测。参数: image(base64), modelId(可选)
- vision_locate: 截图+视觉模型定位可点击坐标（用于验证码、人机校验）。参数: image(base64), prompt(如"确认您是真人的复选框"), vendorId, modelId。返回 x,y 供 gui_mouse_click 使用。
- gui_click_detection: 根据检测结果点击。参数: index(0起)

【内容验证与精华提取】
- llm_verify_content: 验证上一步提取的内容是否满足用户目标。无参数，content 和 userGoal 由系统自动传入。
- llm_extract_essence: 验证不通过时，从当前内容中提取与用户目标相关的精华摘要。无参数，由系统自动传入。提取后关闭当前页、尝试下一个结果。
- llm_extract_from_content: 由 AI 从原始页面文本中提取与用户目标相关的信息。无参数，content 和 userGoal 由系统自动传入。适用于任意网页结构，内容过长时会分段处理。

输出格式（仅 JSON，无 markdown）：
{"tool":"工具名","x":0,"y":0,"button":"left","text":"","region":"","name":"","automationId":"","command":"","cwd":"","path":"","content":"","pid":0,"url":"","selector":"","script":"","modelId":"","image":"","index":0,"timeout":3000}
`;

export const PLAN_SCHEMA = `
请将用户的自然语言目标拆分为可执行的步骤计划（Plan）。

tool 必须从以下列表精确选择（不要自创名称）：
gui_mouse_move, gui_mouse_click, gui_keyboard_type, gui_screen_capture, winui_locate, console_shell,
fs_list, fs_read_text, fs_write_text, process_list, process_kill,
browser_navigate, browser_click, browser_type, browser_screenshot, browser_dom_interactive, browser_scroll, browser_execute, browser_back, browser_wait,
vision_screen_detect, vision_detect, vision_locate, gui_click_detection, llm_verify_content, llm_extract_essence, llm_extract_from_content

输出格式（仅输出 JSON，不要 markdown、不要解释）：
{
  "goal": "用户原始目标简述",
  "steps": [
    { "step": 1, "action": "步骤描述", "tool": "browser_navigate" },
    { "step": 2, "action": "步骤描述", "tool": "browser_type" }
  ]
}

步骤应具体、可执行。tool 字段必填，必须使用上述列表中的名称。

重要：
- 只输出当前阶段需要的步骤，不要预写重试流程。验证失败、点击超时等由监督模块根据执行结果动态决定下一步。
- 搜索任务：优先使用必应或谷歌（结构更稳定）。流程：browser_navigate(必应/谷歌/百度) → browser_type(搜索框，关键词，pressEnter: true) → browser_wait(等待结果区域) → browser_click 第一个结果 → browser_wait → browser_execute → llm_extract_from_content → llm_verify_content。
- 搜索后需点击结果链接打开详情页再提取；点击结果后插入 browser_wait 等待加载。
- browser_execute 提取时：若在搜索页可提取结果区域；若已进入详情页必须用通用提取：return (document.querySelector('main')||document.querySelector('[role=main]')||document.querySelector('.content')||document.body).innerText
- 提取后建议用 llm_extract_from_content 由 AI 解析页面内容，适配任意网页结构。
- 若用户只需结果：browser_execute 取全文 → llm_extract_from_content 提取关键信息 → 返回，不要用 fs_write_text。
- 若需保存为文件：用 fs_write_text，path 以 .md 结尾。
- 若页面出现验证码/人机校验（如「确认您是真人」「最后一步」「请解决以下难题」）：用 gui_screen_capture 截屏 → vision_locate(image, "确认您是真人的复选框", vendorId, modelId) 获取坐标 → gui_mouse_click(x, y) 模拟点击。
- 若为原生 Windows 对话框（如「确定」「取消」「是」按钮）：优先用 winui_locate(name: "确定") 获取坐标 → gui_mouse_click(x, y)，坐标由系统提供永不偏差。
`;

export const SUPERVISOR_SCHEMA = `
你是执行监督模块。根据当前执行结果和失败信息，动态决定下一步，不要预判。

可选动作：
1) action: "retry" — 继续尝试，输出 steps 数组（下一步要执行的步骤）
2) action: "abort" — 停止，采用已有精华或部分结果

决策原则：
- 若为浏览器搜索任务且验证不满足：可 retry，steps 包含 llm_extract_essence（提取精华）、browser_back、browser_click 下一个结果、browser_wait、browser_execute、llm_extract_from_content、llm_verify_content
- 若页面出现验证码/人机校验（内容含「确认您是真人」「最后一步」「请解决以下难题」）：可 retry，steps 包含 gui_screen_capture、vision_locate（prompt 填「确认您是真人的复选框」）、gui_mouse_click(x,y)、browser_wait、继续原流程
- 若已尝试多个结果仍不满足：可 retry 换关键词，steps 包含 browser_navigate 回搜索页、browser_type 新关键词、再试
- 若重试多次或明显无法满足：abort

输出格式（仅 JSON）：
{"action":"retry","steps":[{"step":8,"action":"提取当前内容精华","tool":"llm_extract_essence"},{"step":9,"action":"后退到搜索页","tool":"browser_back"},{"step":10,"action":"点击第二个结果","tool":"browser_click"},{"step":11,"action":"等待加载","tool":"browser_wait"},{"step":12,"action":"提取内容","tool":"browser_execute"},{"step":13,"action":"验证","tool":"llm_verify_content"}],"reason":"尝试下一个搜索结果"}
或
{"action":"abort","reason":"已尝试多个结果均不满足"}
`;

export const STEP_PARAM_SCHEMA = `
根据步骤描述和上下文，输出该步骤对应的工具调用参数。

${TOOL_SCHEMA}

上下文会包含：平台、项目根目录、上一步结果摘要等。请根据 action 推断具体参数。
`;
