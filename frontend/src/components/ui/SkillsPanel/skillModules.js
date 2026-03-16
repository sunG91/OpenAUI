/**
 * 技能配置模块列表 - 模块化维护，对应对话下的快速等配置
 * 每项会在技能面板中渲染为一个配置卡片
 */
export const SKILL_MODULES = [
  {
    id: 'quick',
    label: '快速',
    desc: '对话输入栏下的快速技能配置',
  },
  {
    id: 'mcp',
    label: 'MCP',
    desc: '在技能测试中启用并联动 MCP 服务',
  },
  {
    id: 'sui',
    label: 'SUI',
    desc: '截屏转 base64 发送给视觉模型识别（看见 UI）',
  },
  {
    id: 'task-decompose',
    label: '自主拆解任务',
    desc: '将自然语言目标拆分为可执行的步骤计划（Plan）',
  },
];
