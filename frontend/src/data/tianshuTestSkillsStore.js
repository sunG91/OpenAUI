/**
 * 天枢架构测试 · 模块化 Skills（用户评价沉淀）
 * 持久化 localStorage，可随多次评价迭代
 */
/** 与 architectureConfig.executionDepts.id 一致 */
const DEPT_IDS = ['qiyuan', 'wenhan', 'xuanshu', 'jinkui', 'jianzheng', 'tianji', 'waijiao'];

const STORAGE_KEY = 'openaui_tianshu_test_skills_v1';

const MAX_TIPS_PER_MODULE = 18;
const MAX_HISTORY = 40;

/** 与提示词分析、架构节点对齐的模块 id */
export const TIANSHU_TEST_MODULE_IDS = [
  'pipeline',
  'tianshu-dian',
  'ziwei-tai',
  'xuanji-fu',
  ...DEPT_IDS.map((id) => `dept:${id}`),
  'shangfa',
  'summary',
];

export function isKnownModuleId(id) {
  return TIANSHU_TEST_MODULE_IDS.includes(String(id));
}

function defaultStore() {
  const modules = {};
  TIANSHU_TEST_MODULE_IDS.forEach((id) => {
    modules[id] = { tips: [], lastUpdated: 0 };
  });
  return { version: 1, modules, feedbackHistory: [] };
}

export function loadTianshuTestSkills() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultStore();
    const data = JSON.parse(raw);
    if (!data || data.version !== 1 || typeof data.modules !== 'object') return defaultStore();
    const base = defaultStore();
    for (const id of TIANSHU_TEST_MODULE_IDS) {
      const m = data.modules[id];
      if (m && Array.isArray(m.tips)) {
        base.modules[id] = {
          tips: m.tips.filter((t) => typeof t === 'string' && t.trim()).slice(-MAX_TIPS_PER_MODULE),
          lastUpdated: typeof m.lastUpdated === 'number' ? m.lastUpdated : Date.now(),
        };
      }
    }
    if (Array.isArray(data.feedbackHistory)) {
      base.feedbackHistory = data.feedbackHistory.slice(-MAX_HISTORY);
    }
    return base;
  } catch {
    return defaultStore();
  }
}

export function saveTianshuTestSkills(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {}
}

/**
 * 合并分析结果中的 targets → 各模块 tips（去重、截断）
 * @param {object} store
 * @param {{ targets?: Array<{ moduleId: string, extractedTips?: string[] }> }} analysis
 */
export function mergeAnalysisIntoStore(store, analysis) {
  const next = JSON.parse(JSON.stringify(store));
  const targets = analysis?.targets;
  if (!Array.isArray(targets)) return next;

  for (const t of targets) {
    const id = String(t?.moduleId || '').trim();
    if (!isKnownModuleId(id)) continue;
    const tips = Array.isArray(t.extractedTips) ? t.extractedTips : [];
    if (!next.modules[id]) next.modules[id] = { tips: [], lastUpdated: 0 };
    const set = new Set(next.modules[id].tips.map((x) => x.trim()));
    for (const tip of tips) {
      const s = String(tip || '').trim();
      if (s.length < 4 || s.length > 200) continue;
      if (set.has(s)) continue;
      set.add(s);
      next.modules[id].tips.push(s);
    }
    next.modules[id].tips = next.modules[id].tips.slice(-MAX_TIPS_PER_MODULE);
    next.modules[id].lastUpdated = Date.now();
  }
  return next;
}

export function appendFeedbackHistory(store, entry) {
  const next = { ...store, feedbackHistory: [...(store.feedbackHistory || []), entry] };
  next.feedbackHistory = next.feedbackHistory.slice(-MAX_HISTORY);
  return next;
}

/**
 * 拼成一段注入到各阶段 system 提示的上下文（过长则截断）
 * @param {ReturnType<loadTianshuTestSkills>} store
 * @param {number} [maxChars]
 */
export function formatTianshuTestSkillsForPrompt(store, maxChars = 3800) {
  const parts = [];
  for (const id of TIANSHU_TEST_MODULE_IDS) {
    const tips = store?.modules?.[id]?.tips;
    if (!tips?.length) continue;
    const label =
      id === 'pipeline'
        ? '整体流程'
        : id === 'tianshu-dian'
          ? '天枢殿'
          : id === 'ziwei-tai'
            ? '紫微台'
            : id === 'xuanji-fu'
              ? '璇玑府'
              : id === 'shangfa'
                ? '赏罚台'
                : id === 'summary'
                  ? '任务总结'
                  : id.startsWith('dept:')
                    ? `执行部·${id.replace('dept:', '')}`
                    : id;
    parts.push(`【${label}】\n${tips.map((t) => `- ${t}`).join('\n')}`);
  }
  let text = parts.join('\n\n');
  if (text.length > maxChars) text = `${text.slice(0, maxChars)}\n…（已截断）`;
  return text.trim();
}

export function countTipsInStore(store) {
  let n = 0;
  for (const id of TIANSHU_TEST_MODULE_IDS) {
    n += store?.modules?.[id]?.tips?.length || 0;
  }
  return n;
}

/** 模块 id → 中文展示名（赏罚账本 / 提示词注入共用） */
export function getModuleDisplayLabel(moduleId) {
  const id = String(moduleId || '');
  if (id === 'pipeline') return '整体流程';
  if (id === 'tianshu-dian') return '天枢殿';
  if (id === 'ziwei-tai') return '紫微台';
  if (id === 'xuanji-fu') return '璇玑府';
  if (id === 'shangfa') return '赏罚台';
  if (id === 'summary') return '任务总结';
  if (id.startsWith('dept:')) return `执行部 · ${id.replace('dept:', '')}`;
  return id;
}

/**
 * 替换某模块的全部 tips（用于赏罚账本编辑）
 * @param {ReturnType<loadTianshuTestSkills>} store
 * @param {string} moduleId
 * @param {string[]} tipsArray
 */
export function replaceModuleTips(store, moduleId, tipsArray) {
  const id = String(moduleId || '').trim();
  if (!isKnownModuleId(id)) return store;
  const next = JSON.parse(JSON.stringify(store));
  if (!next.modules[id]) next.modules[id] = { tips: [], lastUpdated: 0 };
  const tips = (Array.isArray(tipsArray) ? tipsArray : [])
    .map((t) => String(t || '').trim())
    .filter(Boolean)
    .slice(-MAX_TIPS_PER_MODULE);
  next.modules[id].tips = tips;
  next.modules[id].lastUpdated = Date.now();
  return next;
}
