/**
 * AUI 架构配置 - 统一维护各架构定义
 * 用于 AUI 模块的架构选择与展示
 */

/** 架构列表 */
export const ARCHITECTURES = [
  {
    id: 'tianshu',
    name: '天枢架构',
    tagline: 'AI 大脑 · 中性、科技感、安全',
    description: '三层决策中枢 + 七大执行部，让 AI 真正「动手」操作电脑',
    decisionLayers: [
      {
        id: 'tianshu-dian',
        name: '天枢殿',
        role: '决策中心 / 大脑',
        desc: '理解用户意图，生成任务步骤',
      },
      {
        id: 'ziwei-tai',
        name: '紫微台',
        role: '监督、审核、安全',
        desc: '检查步骤是否危险，是否可执行',
      },
      {
        id: 'xuanji-fu',
        name: '璇玑府',
        role: '总指挥、执行分发',
        desc: '把任务分给各个功能模块',
      },
    ],
    executionDepts: [
      { id: 'qiyuan', name: '启元部', desc: '打开软件、窗口管理' },
      { id: 'wenhan', name: '文翰部', desc: '输入、文本、搜索' },
      { id: 'xuanshu', name: '玄枢部', desc: '鼠标、点击、拖拽' },
      { id: 'jinkui', name: '金匮部', desc: '文件、文件夹操作' },
      { id: 'jianzheng', name: '监正部', desc: '错误处理、重试、回滚' },
      { id: 'tianji', name: '天机部', desc: '屏幕识别、UI 自动化、坐标' },
      { id: 'waijiao', name: '外交部', desc: '钉钉、飞书、企微、QQ 等第三方对接' },
    ],
    mechanisms: [
      {
        id: 'shangfa-tai',
        name: '赏罚台',
        role: '反馈激励、跨层约束',
        desc: '用户对决策/审核/调度/执行评分奖励，影响各层策略与优先级',
      },
    ],
  },
];

/** 获取架构列表（供选择器使用） */
export function getArchitectureList() {
  return ARCHITECTURES.map((a) => ({
    id: a.id,
    name: a.name,
    tagline: a.tagline,
  }));
}

/** 根据 id 获取完整架构配置 */
export function getArchitectureById(id) {
  return ARCHITECTURES.find((a) => a.id === id) ?? null;
}

/** 将架构配置转为 Markdown 文档 */
export function buildArchitectureMarkdown(arch) {
  if (!arch) return '';
  const lines = [
    `# ${arch.name}`,
    '',
    `> ${arch.tagline}`,
    '',
    arch.description || '',
    '',
  ];
  if (arch.decisionLayers?.length) {
    lines.push('## 三层决策中枢', '');
    arch.decisionLayers.forEach((layer) => {
      lines.push(`### ${layer.name}`, '', `- **角色**：${layer.role}`, `- **功能**：${layer.desc}`, '');
    });
  }
  if (arch.executionDepts?.length) {
    lines.push('## 七大执行部', '');
    arch.executionDepts.forEach((dept) => {
      lines.push(`- **${dept.name}**：${dept.desc}`);
    });
    lines.push('');
  }
  if (arch.mechanisms?.length) {
    lines.push('## 机制', '');
    lines.push('随架构不同而不同，可约束决策中枢与执行部。', '');
    arch.mechanisms.forEach((m) => {
      lines.push(`### ${m.name}`, '', `- **角色**：${m.role}`, `- **功能**：${m.desc}`, '');
    });
  }
  return lines.join('\n');
}
