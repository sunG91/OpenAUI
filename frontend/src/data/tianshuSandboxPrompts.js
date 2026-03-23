/**
 * 天枢架构 · 推演与真实执行 — LLM 提示词
 * 步骤中可含 shellCommand，经紫微台审核后由用户确认在本机执行
 */

export const DEPT_IDS = [
  'qiyuan',
  'wenhan',
  'xuanshu',
  'jinkui',
  'jianzheng',
  'tianji',
  'waijiao',
];

/**
 * @param {string} userGoal
 * @param {{ platform: string, projectRoot?: string }} env
 */
/**
 * @param {string} userGoal
 * @param {{ platform?: string, projectRoot?: string, tianshuTestSkillsBlock?: string }} env
 */
export function buildTianshuDianMessages(userGoal, env = {}) {
  const { platform = 'win32', projectRoot = '', tianshuTestSkillsBlock = '' } = env;
  const isWin = platform === 'win32';
  const shellHint = isWin
    ? [
        '每条 shellCommand 为**一行**在默认 cmd 下执行。',
        '一般优先 cmd 内置命令（dir、where、echo、start 等）。',
        '若用户要求在桌面/某目录**新建脚本（如 .py）再执行**：必须先有步骤把文件**真实写入磁盘**，下一步再执行 `python 完整路径`；**禁止**在文件尚不存在时运行 `python xxx.py`。',
        '仅「echo %USERPROFILE%\\Desktop」或打印路径**不等于**已创建文件。',
        '写入多行脚本时允许：powershell -NoProfile -Command 与 Set-Content / Out-File，或 python -c 单行 open(路径,encoding=\"utf-8\").write(源码)；不得省略写文件步骤。',
      ].join(' ')
    : 'shellCommand 使用当前系统 Shell 一条命令；若需先创建脚本再解释执行，必须先有写入文件的步骤，再执行解释器。';

  return [
    {
      role: 'system',
      content: `你是「天枢殿」决策中枢，负责把用户目标拆解为可执行步骤。当前运行环境：${platform}。${projectRoot ? `项目根目录（文件类操作可参考）：${projectRoot}` : ''}
必须只输出一个 JSON 对象，不要 markdown、不要解释。JSON 结构：
{
  "summary": "一句话概括用户意图",
  "steps": [
    {
      "order": 1,
      "deptId": "qiyuan|wenhan|xuanshu|jinkui|jianzheng|tianji|waijiao",
      "title": "步骤标题",
      "detail": "本步要做什么",
      "skillHint": "console|browser|gui|mcp|voice|task-decompose|agent 等，逗号分隔",
      "shellCommand": "必填：凡本步需要在本机完成的操作，必须写一条可执行的 Shell 单行命令；仅当本步纯属「思考/规划/无需动电脑」时才可为空字符串。${shellHint}"
    }
  ]
}
七大执行部：qiyuan=启元部(应用/窗口) wenhan=文翰部(输入/搜索) xuanshu=玄枢部(鼠标) jinkui=金匮部(文件) jianzheng=监正部(重试) tianji=天机部(屏幕/UI) waijiao=外交部(IM)。
步骤 3～8 步为宜。打开网页/程序、列目录、查环境、复制文件等**必须**在对应步骤填写 shellCommand（如 Windows 下 start \"\" url、dir、echo 等），否则后续无法自动执行与汇总输出。
**写文件再执行类任务（重要）**：凡目标含「生成某路径下的脚本/程序并运行」，计划中**必须**包含：(1) 一步将完整源码写入该路径；(2) 其后一步再调用 python/node 等执行。**顺序错误会导致 ENOENT（文件不存在）**。${
        tianshuTestSkillsBlock
          ? `\n\n【天枢测试沉淀 · 模块化注意事项（来自用户多次评价迭代）】\n${tianshuTestSkillsBlock}`
          : ''
      }`,
    },
    {
      role: 'user',
      content: `用户目标：\n${userGoal}`,
    },
  ];
}

/**
 * @param {string} userGoal
 * @param {object} planJson
 * @param {{ tianshuTestSkillsBlock?: string }} [opts]
 */
export function buildZiweiTaiMessages(userGoal, planJson, opts = {}) {
  const { tianshuTestSkillsBlock = '' } = opts;
  return [
    {
      role: 'system',
      content: `你是「紫微台」监督中枢。审核下列计划；若通过，用户可能在确认后在本机真实执行「shellCommand」字段。
只输出一个 JSON，不要 markdown。结构：
{
  "approved": true 或 false,
  "riskLevel": "low|medium|high",
  "notes": "审核说明，须评估每条 shellCommand 是否安全、是否符合用户意图",
  "mustModify": false,
  "revisedSteps": null 或 完整 steps 数组（含 shellCommand 字段）
}
若存在删系统文件、格式化磁盘、恶意下载、窃取隐私等，approved 必须为 false。
若某步缺少 shellCommand 但用户目标需要本机操作，应在 revisedSteps 中补全可执行命令（仍须安全）。
若用户目标为「在桌面等位置写脚本并执行」，但计划中**先执行了 python/script 却未安排写入文件步骤**，应视为计划不完整：可设 approved 为 false 或 mustModify 为 true，在 revisedSteps 中**插入**「写入文件」步骤并排在执行步骤**之前**（仍须安全）。${
        tianshuTestSkillsBlock
          ? `\n\n【天枢测试沉淀 · 模块化注意事项（来自用户多次评价迭代）】\n${tianshuTestSkillsBlock}`
          : ''
      }`,
    },
    {
      role: 'user',
      content: `用户目标：${userGoal}\n\n待审计划（JSON）：\n${JSON.stringify(planJson)}`,
    },
  ];
}

/**
 * @param {string} userGoal
 * @param {object} approvedPlan
 * @param {{ tianshuTestSkillsBlock?: string }} [opts]
 */
export function buildXuanjiFuMessages(userGoal, approvedPlan, opts = {}) {
  const { tianshuTestSkillsBlock = '' } = opts;
  return [
    {
      role: 'system',
      content: `你是「璇玑府」总调度。只输出 JSON：{"dispatchSummary":"2-4句调度说明","deptLoad":[{"deptId":"qiyuan","label":"启元部","taskCount":1}]}
deptLoad 统计各部门任务数。${
        tianshuTestSkillsBlock
          ? `\n\n【天枢测试沉淀 · 模块化注意事项（来自用户多次评价迭代）】\n${tianshuTestSkillsBlock}`
          : ''
      }`,
    },
    {
      role: 'user',
      content: `用户目标：${userGoal}\n\n已通过计划：\n${JSON.stringify(approvedPlan)}`,
    },
  ];
}

/**
 * 推演与执行结束后的中文报告（流式输出到侧栏）
 * @param {string} userGoal
 * @param {{ plan?: object, review?: object, dispatch?: object | null, results?: Array }} ctx
 */
export function buildMissionSummaryMessages(userGoal, ctx = {}) {
  const { plan, review, dispatch, results = [], tianshuTestSkillsBlock = '' } = ctx;
  return [
    {
      role: 'system',
      content:
        '你是任务简报官。根据下列「用户目标 + 天枢推演 + 本机执行结果」，输出一份**中文 Markdown** 报告，必须包含这些小节（用 ## 标题）：\n' +
        '## 目标回顾\n## 计划与审核\n## 调度摘要\n## 执行与输出（逐步说明：命令、退出码、stdout/stderr 要点；若某步无 shellCommand 则说明已跳过）\n## 小结与后续建议\n' +
        '语气客观、可审计；无执行时明确写「未执行本机 Shell」。不要输出 JSON、不要代码块包裹全文。' +
        (tianshuTestSkillsBlock
          ? `\n\n【天枢测试沉淀 · 模块化注意事项（来自用户多次评价迭代，总结时可对照）】\n${tianshuTestSkillsBlock}`
          : ''),
    },
    {
      role: 'user',
      content:
        `【用户目标】\n${userGoal}\n\n【计划】\n${JSON.stringify(plan ?? {}, null, 2)}\n\n【审核】\n${JSON.stringify(review ?? {}, null, 2)}\n\n【调度】\n${JSON.stringify(dispatch ?? {}, null, 2)}\n\n【执行结果数组】\n${JSON.stringify(results, null, 2)}`,
    },
  ];
}

export const TIANSHU_FEEDBACK_MODULE_IDS = [
  'pipeline',
  'tianshu-dian',
  'ziwei-tai',
  'xuanji-fu',
  ...DEPT_IDS.map((id) => `dept:${id}`),
  'shangfa',
  'summary',
];

/**
 * 用户评价 → 归因模块 + 提炼可迭代提示词
 * @param {{ rating: number, comment: string, userGoal: string, planSummary?: string }} input
 */
export function buildFeedbackAnalysisMessages({ rating, comment, userGoal, planSummary = '' }) {
  return [
    {
      role: 'system',
      content: `你是「天枢架构测试」评测分析器。用户刚完成一次推演/执行，并给出主观评分与文字反馈。
只输出一个 JSON 对象，不要 markdown、不要解释。结构：
{
  "targets": [
    {
      "moduleId": "必须是下列之一：${TIANSHU_FEEDBACK_MODULE_IDS.join(' | ')}",
      "weight": 0 到 1 的小数，表示用户对该模块的关注程度,
      "extractedTips": ["一句可写入该模块提示词的注意事项（≤90字）", "…"]
    }
  ],
  "iterationSummary": "一句话：本次评价对后续提示词改进方向"
}
moduleId 说明：
- pipeline：整体流程/未特指某模块
- tianshu-dian / ziwei-tai / xuanji-fu：三层决策
- dept:qiyuan … dept:waijiao：七大执行部（与 deptId 一致）
- shangfa：赏罚台/评分
- summary：任务总结报告
若用户未提某模块，不要强行编造；targets 可为 1～多个。extractedTips 至少 1 条（可针对最主要模块）。`,
    },
    {
      role: 'user',
      content: `评分(1-5)：${rating}\n用户原话：\n${comment}\n\n【用户目标】\n${userGoal}\n\n【计划摘要（若有）】\n${planSummary || '(无)'}`,
    },
  ];
}
