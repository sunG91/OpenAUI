/**
 * Agent 模块 - Plan 执行器
 * 按 steps 依次执行，验证失败时由监督模块动态决定下一步
 */
import { createToolExecutor } from './toolRegistry';
import { TOOL_SCHEMA } from './schemas';
import { supervise } from './supervisor';
import * as tools from '../api/tools';

const executeTool = createToolExecutor(tools);

/**
 * 执行 llm_extract_essence：验证不通过时，从内容中提取与用户目标相关的精华摘要
 */
async function runLlmExtractEssence(prevResults, userGoal, testModel, vendorId, modelId) {
  let content = '';
  for (let i = prevResults.length - 1; i >= 0; i--) {
    const r = prevResults[i];
    if (r.tool === 'browser_execute' && r.success && r.result?.result != null) {
      content = typeof r.result.result === 'string' ? r.result.result : String(r.result.result);
      break;
    }
  }
  const truncated = content.length > 3000 ? content.slice(0, 3000) + '...[截断]' : content;
  const msg = `用户需求：${userGoal}

以下是从网页提取的内容（未完全满足需求，需提取精华后尝试其他结果）：
---
${truncated}
---

请从上述内容中提取与用户需求相关的精华摘要（温度、天气、日期等关键信息），用简洁的 Markdown 或列表输出，便于后续合并。仅输出提取结果，不要解释。`;
  try {
    const res = await testModel({ vendorId, modelId, message: msg });
    const essence = (res?.content ?? '').trim();
    return { success: true, essence: essence || '(无有效精华)' };
  } catch {
    return { success: true, essence: '(提取失败)' };
  }
}

/**
 * 执行 llm_extract_from_content：由 AI 从原始页面文本中提取与用户目标相关的信息
 * 支持长文本分段处理（每段约 6000 字符）
 */
async function runLlmExtractFromContent(prevResults, userGoal, testModel, vendorId, modelId) {
  let content = '';
  for (let i = prevResults.length - 1; i >= 0; i--) {
    const r = prevResults[i];
    if (r.tool === 'browser_execute' && r.success && r.result?.result != null) {
      content = typeof r.result.result === 'string' ? r.result.result : String(r.result.result);
      break;
    }
  }
  if (!content.trim()) {
    return { success: true, extracted: '(无可用内容)' };
  }
  const CHUNK_SIZE = 6000;
  const chunks = [];
  for (let i = 0; i < content.length; i += CHUNK_SIZE) {
    chunks.push(content.slice(i, i + CHUNK_SIZE));
  }
  const extractedParts = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const isLast = i === chunks.length - 1;
    const msg = `用户需求：${userGoal}

以下是从网页提取的原始内容${chunks.length > 1 ? `（第 ${i + 1}/${chunks.length} 段）` : ''}：
---
${chunk}${!isLast ? '\n...[后续还有内容]' : ''}
---

请从上述内容中提取与用户需求直接相关的信息（如天气、温度、日期、关键数据等），用简洁的 Markdown 或列表输出。仅输出提取结果，不要解释。`;
    try {
      const res = await testModel({ vendorId, modelId, message: msg });
      const part = (res?.content ?? '').trim();
      if (part) extractedParts.push(part);
    } catch {
      extractedParts.push(`[第 ${i + 1} 段解析失败]`);
    }
  }
  const extracted = extractedParts.length > 0
    ? (extractedParts.length === 1 ? extractedParts[0] : extractedParts.join('\n\n---\n\n'))
    : '(无有效提取)';
  return { success: true, extracted };
}

/**
 * 执行 llm_verify_content：用 LLM 判断提取内容是否满足用户需求
 */
async function runLlmVerifyContent(prevResults, userGoal, testModel, vendorId, modelId) {
  let content = '';
  // 优先使用 llm_extract_from_content 的提取结果进行验证
  for (let i = prevResults.length - 1; i >= 0; i--) {
    const r = prevResults[i];
    if (r.tool === 'llm_extract_from_content' && r.success && r.result?.extracted) {
      content = String(r.result.extracted);
      break;
    }
  }
  if (!content) {
    for (let i = prevResults.length - 1; i >= 0; i--) {
      const r = prevResults[i];
      if (r.tool === 'browser_execute' && r.success && r.result?.result != null) {
        content = typeof r.result.result === 'string' ? r.result.result : String(r.result.result);
        break;
      }
    }
  }
  const truncated = content.length > 4000 ? content.slice(0, 4000) + '...[截断]' : content;
  const msg = `用户需求：${userGoal}

以下是从网页提取的内容：
---
${truncated}
---

请判断这段内容是否满足用户需求。仅输出一个 JSON：{"satisfied": true} 或 {"satisfied": false, "reason": "简短原因"}，不要其他文字。`;
  try {
    const res = await testModel({ vendorId, modelId, message: msg });
    const raw = (res?.content ?? '').trim();
    const jsonStr = raw.replace(/^```\w*\n?|\n?```$/g, '').trim();
    const parsed = JSON.parse(jsonStr);
    return { success: true, satisfied: !!parsed.satisfied, reason: parsed.reason };
  } catch {
    return { success: true, satisfied: true, reason: '解析失败，默认采纳' };
  }
}

/**
 * 用 LLM 根据 step.action 补全工具调用参数
 */
async function completeStepParams(step, context, testModel, vendorId, modelId) {
  const { action, tool } = step;
  const { platformHint = '', projectRoot = '', prevResults = [] } = context;

  const prevSummary = prevResults.length
    ? `上一步结果摘要：\n${prevResults.map((r, i) => {
        const s = JSON.stringify(r.result);
        const len = i === prevResults.length - 1 ? 3000 : 150;
        return `步骤${i + 1}: ${r.success ? '成功' : '失败'} ${s.slice(0, len)}${s.length > len ? '...' : ''}`;
      }).join('\n')}`
    : '';

  const fsWriteHint = tool === 'fs_write_text' && prevResults.length > 0
    ? '\n重要：content 必须是上一步提取的**实际文本**（如 browser_execute 的 result 字段值），不要写入步骤摘要或执行日志。'
    : '';
  const browserExecHint = tool === 'browser_execute' && /提取|获取|读取|文字|内容|数据/.test(action)
    ? '\n重要：script 必须 return 字符串。若在百度搜索页用 #content_left；若已进入详情页（天气、新闻等）必须用通用提取：return (document.querySelector(\'main\')||document.querySelector(\'[role=main]\')||document.querySelector(\'.content\')||document.querySelector(\'#content\')||document.body).innerText'
    : '';
  const browserWaitHint = tool === 'browser_wait'
    ? '\n重要：timeout 为毫秒数，建议 2000-3000；若需等待特定元素可填 selector。'
    : '';
  const prevUrl = prevResults.length > 0 && prevResults[prevResults.length - 1].tool === 'browser_navigate'
    ? JSON.stringify(prevResults[prevResults.length - 1].result?.url || '')
    : '';
  const browserNavHint = tool === 'browser_navigate' && /搜索|查询|查找|天气|新闻/.test(action)
    ? '\n重要：搜索任务优先用必应 https://www.bing.com 或谷歌 https://www.google.com（结构稳定）。百度 https://www.baidu.com 可选。'
    : '';
  const browserTypeHint = tool === 'browser_type' && (/回车|提交|搜索|Enter/.test(action) || /bing|google|baidu|必应|谷歌|百度/.test(prevUrl))
    ? '\n重要：搜索必须 pressEnter: true。必应 selector #sb_form_q；谷歌 input[name=q]；百度 #kw。'
    : '';
  const browserClickHint = tool === 'browser_click' && /(第[一二三四五六七八九十\d]+个|搜索结果|第一个|第二个|第三个).*(结果|链接|天气|条目)|点击.*结果|点击.*链接/.test(action)
    ? '\n重要：根据当前搜索页选择 selector。必应第一个：#b_results li.b_algo h2 a；谷歌：#search .g h3 a；百度：#content_left h3 a。不要用 a[href*=\'xxx\']。'
    : '';

  const msg = `步骤描述：${action}
指定工具：${tool}

${platformHint}
${projectRoot ? `项目根目录：${projectRoot}` : ''}
${prevSummary}
${fsWriteHint}
${browserExecHint}
${browserWaitHint}
${browserNavHint}
${browserTypeHint}
${browserClickHint}

${TOOL_SCHEMA}

请根据步骤描述输出该工具调用的 JSON 参数，仅输出 JSON，不要 markdown。`;

  const res = await testModel({ vendorId, modelId, message: msg });
  const raw = (res?.content ?? '').trim();
  const jsonStr = raw.replace(/^```\w*\n?|\n?```$/g, '').trim();
  try {
    const parsed = JSON.parse(jsonStr);
    const { tool: _t, ...params } = parsed;
    return params;
  } catch {
    return {};
  }
}

/**
 * 执行 Plan
 * @param {object} plan - { goal, steps }
 * @param {object} options
 * @param {string} options.vendorId
 * @param {string} options.modelId
 * @param {function} options.testModel
 * @param {string} options.projectRoot
 * @param {string} options.platformHint
 * @param {function} options.onStepStart - (stepIndex, step) => void
 * @param {function} options.onStepDone - (stepIndex, result) => void
 * @param {number} options.stepDelayMs - 每步间隔毫秒，便于观察
 * @param {boolean} options.captureAfterStep - 每步后截屏并附加到结果
 * @returns {Promise<{ goal, results: Array<{ step, action, tool, success, result }> }>}
 */
export async function executePlan(plan, options) {
  const {
    vendorId,
    modelId,
    testModel,
    projectRoot = '',
    platformHint = '',
    onStepStart = () => {},
    onStepDone = () => {},
    onSupervisorPlan = () => {},
    stepDelayMs = 0,
    captureAfterStep = false,
  } = options;

  const VISUAL_TOOLS = new Set([
    'browser_navigate', 'browser_click', 'browser_type', 'browser_screenshot',
    'browser_dom_interactive', 'browser_scroll', 'browser_execute', 'browser_back', 'browser_wait',
    'gui_mouse_move', 'gui_mouse_click', 'gui_keyboard_type', 'gui_screen_capture',
  ]);

  let lastCapturedImage = null;
  let lastDetections = [];
  let lastImageSize = null;
  let visionModels = [];
  let browserSessionId = null;
  let browserPageId = null;

  const BROWSER_TOOLS = new Set([
    'browser_navigate', 'browser_click', 'browser_type', 'browser_screenshot',
    'browser_dom_interactive', 'browser_scroll', 'browser_execute', 'browser_back', 'browser_wait',
  ]);

  try {
    const modelsRes = await tools.visionListModels();
    visionModels = modelsRes?.models || [];
  } catch (_) {}

  const ctx = {
    projectRoot,
    platformHint,
    lastCapturedImage: () => lastCapturedImage,
    lastDetections: () => lastDetections,
    visionModels,
    onCaptureImage: (img) => { lastCapturedImage = img; },
    onDetections: (dets) => { lastDetections = dets; },
  };

  const results = [];
  let steps = [...(plan?.steps || [])];
  const userGoal = plan?.goal ?? '';
  let supervisorRetryCount = 0;

  let stepIndex = 0;
  while (stepIndex < steps.length) {
    const step = steps[stepIndex];
    const tool = step.tool || '';
    onStepStart(stepIndex, step);

    if (!tool) {
      results.push({ step: step.step, action: step.action, tool: '', success: false, result: { error: '步骤未指定 tool' } });
      onStepDone(stepIndex, results[results.length - 1]);
      stepIndex++;
      continue;
    }

    if (BROWSER_TOOLS.has(tool) && !browserSessionId) {
      try {
        const sess = await tools.browserSessionStart();
        browserSessionId = sess?.sessionId ?? null;
      } catch (_) {}
    }

    let params = { ...step };
    delete params.step;
    delete params.action;
    delete params.tool;
    delete params.runIf;

    // 若上一步是 vision_locate 且成功，gui_mouse_click 可继承其返回的 x,y
    const prev = results[results.length - 1];
    if (tool === 'gui_mouse_click' && prev?.tool === 'vision_locate' && prev?.success && prev?.result?.x != null && prev?.result?.y != null) {
      if (params.x == null && params.y == null) {
        params = { ...params, x: prev.result.x, y: prev.result.y };
      }
    }

    const hasParams = Object.keys(params).some((k) => params[k] != null && params[k] !== '');
    if (!hasParams && testModel && tool !== 'llm_verify_content' && tool !== 'llm_extract_essence' && tool !== 'llm_extract_from_content') {
      params = await completeStepParams(
        step,
        {
          platformHint,
          projectRoot,
          prevResults: results,
        },
        testModel,
        vendorId,
        modelId
      );
    }

    let result;
    if (tool === 'llm_verify_content') {
      result = await runLlmVerifyContent(results, userGoal, testModel, vendorId, modelId);
    } else if (tool === 'llm_extract_essence') {
      result = await runLlmExtractEssence(results, userGoal, testModel, vendorId, modelId);
    } else if (tool === 'llm_extract_from_content') {
      result = await runLlmExtractFromContent(results, userGoal, testModel, vendorId, modelId);
    } else {
      const execCtx = {
        projectRoot,
        lastCapturedImage,
        lastDetections,
        lastImageSize,
        visionModels,
        onCaptureImage: (img) => { lastCapturedImage = img; },
        onDetections: (dets) => { lastDetections = dets; },
        onCaptureImageSize: (dims) => { lastImageSize = dims; },
        browserSessionId,
        browserPageId,
        vendorId,
        modelId,
      };
      try {
        result = await executeTool(tool, params, execCtx);
      } catch (e) {
        result = { success: false, error: e?.message || String(e) };
      }
    }

    if (BROWSER_TOOLS.has(tool) && result?.success && result?.sessionId) {
      browserSessionId = result.sessionId;
      if (result.pageId != null) browserPageId = result.pageId;
    }

    const success = result?.success !== false;
    let finalResult = { ...result };
    if (success && captureAfterStep && VISUAL_TOOLS.has(tool) && !finalResult.image) {
      try {
        const cap = await tools.guiScreenCapture();
        if (cap?.image) finalResult = { ...finalResult, screenCapture: cap.image };
      } catch (_) {}
    }
    if (result?.image) finalResult = { ...finalResult, screenCapture: result.image };
    results.push({ step: step.step, action: step.action, tool, success, result: finalResult });
    onStepDone(stepIndex, results[results.length - 1]);

    if (tool === 'llm_verify_content' && !result?.skipped && result?.satisfied === false) {
      const decision = await supervise({
        userGoal,
        results,
        failure: { type: 'verify_failed', reason: result?.reason },
        retryCount: supervisorRetryCount,
        testModel,
        vendorId,
        modelId,
      });
      if (decision.action === 'retry' && decision.steps?.length) {
        supervisorRetryCount++;
        const baseStep = results.length + 1;
        const newSteps = decision.steps.map((s, i) => ({ ...s, step: baseStep + i }));
        steps = steps.slice(0, stepIndex + 1).concat(newSteps).concat(steps.slice(stepIndex + 1));
        onSupervisorPlan(newSteps, decision.reason);
      } else {
        break;
      }
    }

    // 验证码/人机校验检测：browser_execute 返回内容含验证码提示时，触发模拟操作流程
    const CAPTCHA_INDICATORS = ['确认您是真人', '最后一步', '请解决以下难题', '人机验证', '验证'];
    const isCaptchaContent = (text) => {
      if (!text || typeof text !== 'string') return false;
      const t = text.trim();
      return CAPTCHA_INDICATORS.some((k) => t.includes(k));
    };
    if (tool === 'browser_execute' && success && result?.result != null) {
      const content = typeof result.result === 'string' ? result.result : String(result.result);
      if (isCaptchaContent(content)) {
        const decision = await supervise({
          userGoal,
          results,
          failure: { type: 'captcha', reason: '页面出现人机校验，需用模拟操作点击' },
          retryCount: supervisorRetryCount,
          testModel,
          vendorId,
          modelId,
        });
        if (decision.action === 'retry' && decision.steps?.length) {
          supervisorRetryCount++;
          const baseStep = results.length + 1;
          const newSteps = decision.steps.map((s, i) => ({ ...s, step: baseStep + i }));
          steps = steps.slice(0, stepIndex + 1).concat(newSteps).concat(steps.slice(stepIndex + 1));
          onSupervisorPlan(newSteps, decision.reason);
        }
      }
    }

    if (BROWSER_TOOLS.has(tool) && !success) {
      const errMsg = result?.error || '';
      if (/timeout|Timeout|超时/.test(errMsg)) {
        const decision = await supervise({
          userGoal,
          results,
          failure: { type: 'click_timeout', reason: errMsg },
          retryCount: supervisorRetryCount,
          testModel,
          vendorId,
          modelId,
        });
        if (decision.action === 'retry' && decision.steps?.length) {
          supervisorRetryCount++;
          const baseStep = results.length + 1;
          const newSteps = decision.steps.map((s, i) => ({ ...s, step: baseStep + i }));
          steps = steps.slice(0, stepIndex + 1).concat(newSteps).concat(steps.slice(stepIndex + 1));
          onSupervisorPlan(newSteps, decision.reason);
        }
      }
    }

    if (stepDelayMs > 0 && stepIndex < steps.length - 1) {
      await new Promise((r) => setTimeout(r, stepDelayMs));
    }
    stepIndex++;
  }

  if (browserSessionId) {
    try {
      await tools.browserSessionEnd(browserSessionId);
    } catch (_) {}
  }

  // 计算 verified 状态（需在 finalContent 之前）
  let verified = null;
  for (let i = results.length - 1; i >= 0; i--) {
    const r = results[i];
    if (r.tool === 'llm_verify_content' && !r.result?.skipped) {
      verified = r.result?.satisfied === true;
      break;
    }
  }

  // 提取最终可展示内容：优先 llm_extract_from_content，其次 browser_execute；验证未通过则合并 llm_extract_essence 精华
  let finalContent = null;
  let finalPath = null;
  const essences = [];
  for (const r of results) {
    if (r.tool === 'llm_extract_essence' && r.success && r.result?.essence) {
      essences.push(String(r.result.essence).trim());
    }
  }
  for (let i = results.length - 1; i >= 0; i--) {
    if (results[i].tool === 'fs_write_text' && results[i].success && results[i].result?.path) {
      finalPath = results[i].result.path;
      break;
    }
  }
  for (let i = results.length - 1; i >= 0; i--) {
    const r = results[i];
    if (r.tool === 'llm_extract_from_content' && r.success && r.result?.extracted) {
      finalContent = String(r.result.extracted);
      break;
    }
    if (r.tool === 'browser_execute' && r.success && r.result?.result != null) {
      finalContent = typeof r.result.result === 'string' ? r.result.result : String(r.result.result);
      break;
    }
  }
  if (essences.length > 0 && verified === false) {
    finalContent = `## 各次尝试提取的精华\n\n${essences.map((e, i) => `### 尝试 ${i + 1}\n${e}`).join('\n\n')}`;
  }

  return {
    goal: plan?.goal ?? '',
    results,
    finalContent: finalContent || null,
    finalPath: finalPath || null,
    verified,
  };
}
