/**
 * 监督模块：根据执行结果动态决定下一步
 * 不预定义重试流程，由 LLM 根据当前状态决定：尝试下一个结果、换关键词、提取精华后放弃等
 */
import { SUPERVISOR_SCHEMA } from './schemas';

/**
 * 当验证失败或执行异常时，由监督模块决定下一步
 * @param {object} options
 * @param {string} options.userGoal - 用户目标
 * @param {Array} options.results - 当前已执行的步骤结果
 * @param {object} options.failure - { type: 'verify_failed'|'click_timeout'|..., reason }
 * @param {number} options.retryCount - 已重试次数
 * @param {function} options.testModel
 * @param {string} options.vendorId
 * @param {string} options.modelId
 * @returns {Promise<{ action: 'retry'|'abort', steps?: Array<{ step, action, tool }>, reason?: string }>}
 */
export async function supervise(options) {
  const {
    userGoal,
    results = [],
    failure = {},
    retryCount = 0,
    testModel,
    vendorId,
    modelId,
  } = options;

  const MAX_RETRIES = 5;
  if (retryCount >= MAX_RETRIES) {
    return { action: 'abort', reason: '已达最大重试次数，停止' };
  }

  const lastFew = results.slice(-6).map((r, i) => {
    const idx = results.length - 6 + i;
    const res = r.result;
    let brief = '';
    if (res?.satisfied === false) brief = `验证不满足: ${res.reason || ''}`;
    else if (res?.essence) brief = `精华: ${String(res.essence).slice(0, 80)}...`;
    else if (res?.error) brief = `失败: ${res.error}`;
    else if (res?.result) brief = `提取${String(res.result).length}字`;
    else brief = r.success ? '成功' : '失败';
    return `步骤${(idx ?? 0) + 1} ${r.tool}: ${brief}`;
  }).join('\n');

  const msg = `用户目标：${userGoal}

当前执行摘要（最近几步）：
${lastFew}

失败信息：${failure.type || 'verify_failed'} - ${failure.reason || '内容不满足需求'}
已重试次数：${retryCount}

${SUPERVISOR_SCHEMA}

请根据当前状态决定下一步。仅输出 JSON，不要 markdown。`;

  try {
    const res = await testModel({ vendorId, modelId, message: msg });
    const raw = (res?.content ?? '').trim();
    const jsonStr = raw.replace(/^```\w*\n?|\n?```$/g, '').trim();
    const parsed = JSON.parse(jsonStr);

    if (parsed.action === 'abort') {
      return { action: 'abort', reason: parsed.reason || '监督决定停止' };
    }

    if (parsed.action === 'retry' && Array.isArray(parsed.steps) && parsed.steps.length > 0) {
      const steps = parsed.steps.map((s, i) => ({
        step: (results.length + i + 1),
        action: s.action || '',
        tool: (s.tool || '').trim(),
      }));
      return { action: 'retry', steps, reason: parsed.reason };
    }

    return { action: 'abort', reason: parsed.reason || '无法解析下一步' };
  } catch (e) {
    return { action: 'abort', reason: `监督解析失败: ${e?.message || e}` };
  }
}
