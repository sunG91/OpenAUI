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

【控制台】
- console_shell: 仅执行系统命令（dir、echo 等），不能从网页提取数据

【系统操作】
- fs_list: 列目录。参数: path
- fs_read_text: 读文件。参数: path
- fs_write_text: 写文件。参数: path, content
- process_list: 进程列表。无参数
- process_kill: 结束进程。参数: pid (慎用)

【浏览器】网页内操作优先用 browser_*，比 gui_* 更准确
- browser_navigate: 打开页面。参数: url
- browser_click: 点击元素。参数: url, selector（如 #kw、input[name=wd]）
- browser_type: 在元素内输入文本。参数: url, selector, text
- browser_screenshot: 页面截屏。参数: url
- browser_dom_interactive: 解析可交互元素，返回链接/按钮等。参数: url
- browser_scroll: 滚动。参数: url, x, y
- browser_execute: 执行 JavaScript 提取页面文字。script 必须 return 字符串，如 "return (document.querySelector('#content_left')||document.body).innerText"
- browser_back: 浏览器后退（返回上一页）。无参数，需在会话内使用。
- browser_wait: 等待页面加载。参数: timeout(毫秒，默认3000)、selector(可选，等待该元素出现)

【视觉检测】仅检测物体（laptop、person 等），不能识别文字
- vision_screen_detect: 截屏+YOLO 物体检测。参数: modelId(可选)
- vision_detect: 对已有图片做物体检测。参数: image(base64), modelId(可选)
- gui_click_detection: 根据检测结果点击。参数: index(0起)

【内容验证】用于判断提取内容是否满足用户需求
- llm_verify_content: 验证上一步提取的内容是否满足用户目标。无参数，content 和 userGoal 由系统自动传入。

输出格式（仅 JSON，无 markdown）：
{"tool":"工具名","x":0,"y":0,"button":"left","text":"","region":"","command":"","cwd":"","path":"","content":"","pid":0,"url":"","selector":"","script":"","modelId":"","image":"","index":0,"timeout":3000}
`;

export const PLAN_SCHEMA = `
请将用户的自然语言目标拆分为可执行的步骤计划（Plan）。

tool 必须从以下列表精确选择（不要自创名称）：
gui_mouse_move, gui_mouse_click, gui_keyboard_type, gui_screen_capture, console_shell,
fs_list, fs_read_text, fs_write_text, process_list, process_kill,
browser_navigate, browser_click, browser_type, browser_screenshot, browser_dom_interactive, browser_scroll, browser_execute, browser_back, browser_wait,
vision_screen_detect, vision_detect, gui_click_detection, llm_verify_content

输出格式（仅输出 JSON，不要 markdown、不要解释）：
{
  "goal": "用户原始目标简述",
  "steps": [
    { "step": 1, "action": "步骤描述", "tool": "browser_navigate" },
    { "step": 2, "action": "步骤描述", "tool": "browser_type" },
    { "step": 3, "action": "步骤描述", "tool": "llm_verify_content", "runIf": "prev_verify_failed" }
  ]
}

步骤应具体、可执行。tool 字段必填，必须使用上述列表中的名称。
步骤可带 runIf: "prev_verify_failed" 表示仅在上一步 llm_verify_content 返回不满足时执行。

重要：
- 搜索后需点击结果链接（browser_click）打开详情页，再提取内容；不能只停留在搜索结果页。
- 返回搜索页必须用 browser_back 后退，不能用 browser_navigate 打开百度首页（会丢失搜索结果）。
- 点击结果后、提取前插入 browser_wait 等待页面加载（timeout 2000-3000）；若页面空白可多次 browser_wait。
- 从网页提取文字用 browser_execute，不要用 console_shell。
- 若用户只需结果：最后一步用 browser_execute 提取并返回，不要用 fs_write_text。
- 若需保存为文件：用 fs_write_text，path 以 .md 结尾。

浏览器搜索并提取的完整流程（必须包含验证与重试）：
1) browser_navigate 打开搜索页
2) browser_type 输入关键词
3) browser_click 点击搜索按钮
4) browser_click 点击第一个结果链接
5) browser_wait 等待页面加载（timeout: 2500）
6) browser_execute 提取页面内容
7) llm_verify_content 验证内容是否满足用户需求
8) runIf:prev_verify_failed — browser_back 后退到搜索页
9) runIf:prev_verify_failed — browser_click 点击第二个结果链接（selector 如 #content_left .result:nth-of-type(2) a）
10) runIf:prev_verify_failed — browser_wait 等待页面加载
11) runIf:prev_verify_failed — browser_execute 重新提取
12) runIf:prev_verify_failed — llm_verify_content 再次验证
步骤 8-12 仅在步骤 7 验证不通过时执行；若步骤 7 通过则跳过 8-12。
`;

export const STEP_PARAM_SCHEMA = `
根据步骤描述和上下文，输出该步骤对应的工具调用参数。

${TOOL_SCHEMA}

上下文会包含：平台、项目根目录、上一步结果摘要等。请根据 action 推断具体参数。
`;
