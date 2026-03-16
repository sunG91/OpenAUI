/**
 * 工具模块列表（系统级工具，非技能）
 */
export const TOOL_MODULES = [
  {
    id: 'console',
    label: '控制台工具',
    desc: '执行 CMD / Shell 等命令，供 AI 操作电脑',
    component: 'ConsoleTools',
  },
  {
    id: 'system',
    label: '系统操作工具',
    desc: '结构化文件 / 进程操作，提供更安全的系统调用封装',
    component: 'SystemTools',
  },
  {
    id: 'gui',
    label: 'GUI 模拟工具',
    desc: '鼠标、键盘、截屏（nut.js）',
    component: 'GuiTools',
  },
  {
    id: 'browser',
    label: '浏览器工具',
    desc: '页面打开、点击、输入、截屏（playwright）',
    component: 'BrowserTools',
  },
  {
    id: 'vision',
    label: '本地视觉检测',
    desc: 'YOLO/ONNX 离线检测，龙虾等目标识别',
    component: 'VisionTools',
  },
];
