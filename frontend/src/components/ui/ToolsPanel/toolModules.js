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
    id: 'winui',
    label: '系统定位',
    desc: 'Windows UIA 系统级 UI 定位，坐标永不偏差',
    component: 'WinuiTools',
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
    desc: 'YOLO/ONNX 离线检测，通用目标识别',
    component: 'VisionTools',
  },
  {
    id: 'canvas',
    label: 'A2UI 画布',
    desc: 'Agent 推送可视化，实时渲染 UI 组件',
    component: 'CanvasTools',
  },
];
