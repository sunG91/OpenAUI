/**
 * Agent 模块 - Plan 执行器
 * 按 steps 依次执行，每步可调用 LLM 补全参数后执行工具
 */
import { createToolExecutor } from './toolRegistry';
import { TOOL_SCHEMA } from './schemas';
import * as tools from '../api/tools';

const executeTool = createToolExecutor(tools);

/**
 * 执行 llm_verify_content：用 LLM 判断提取内容是否满足用户需求
 */
async function runLlmVerifyContent(prevResults, userGoal, testModel, vendorId, modelId) {
  let content = '';
  for (let i = prevResults.length - 1; i >= 0; i--) {
    const r = prevResults[i];
    if (r.tool === 'browser_execute' && r.success && r.result?.result != null) {
      content = typeof r.result.result === 'string' ? r.result.result : String(r.result.result);
      break;
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
    ? '\n重要：script 必须 return 字符串，例如 "return (document.querySelector(\'#content_left\')||document.body).innerText"'
    : '';

  const msg = `步骤描述：${action}
指定工具：${tool}

${platformHint}
${projectRoot ? `项目根目录：${projectRoot}` : ''}
${prevSummary}
${fsWriteHint}
${browserExecHint}

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
    stepDelayMs = 0,
    captureAfterStep = false,
  } = options;

  const VISUAL_TOOLS = new Set([
    'browser_navigate', 'browser_click', 'browser_type', 'browser_screenshot',
    'browser_dom_interactive', 'browser_scroll', 'browser_execute',
    'gui_mouse_move', 'gui_mouse_click', 'gui_keyboard_type', 'gui_screen_capture',
  ]);

  let lastCapturedImage = null;
  let lastDetections = [];
  let visionModels = [];
  let browserSessionId = null;
  let browserPageId = null;

  const BROWSER_TOOLS = new Set([
    'browser_navigate', 'browser_click', 'browser_type', 'browser_screenshot',
    'browser_dom_interactive', 'browser_scroll', 'browser_execute',
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
  const steps = plan?.steps || [];
  const userGoal = plan?.goal ?? '';

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const tool = step.tool || '';
    const runIf = step.runIf;
    onStepStart(i, step);

    if (!tool) {
      results.push({ step: step.step, action: step.action, tool: '', success: false, result: { error: '步骤未指定 tool' } });
      onStepDone(i, results[results.length - 1]);
      continue;
    }

    if (runIf === 'prev_verify_failed') {
      const prev = results[results.length - 1];
      if (prev?.result?.skipped) {
        results.push({ step: step.step, action: step.action, tool, success: true, result: { skipped: true, reason: '验证已通过，跳过重试块' } });
        onStepDone(i, results[results.length - 1]);
        continue;
      }
      let shouldSkip = false;
      for (let j = results.length - 1; j >= 0; j--) {
        const r = results[j];
        if (r.tool === 'llm_verify_content' && !r.result?.skipped) {
          shouldSkip = r.result?.satisfied !== false;
          break;
        }
      }
      if (shouldSkip) {
        results.push({ step: step.step, action: step.action, tool, success: true, result: { skipped: true, reason: '验证已通过，跳过重试块' } });
        onStepDone(i, results[results.length - 1]);
        continue;
      }
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

    const hasParams = Object.keys(params).some((k) => params[k] != null && params[k] !== '');
    if (!hasParams && testModel && tool !== 'llm_verify_content') {
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
    } else {
      const execCtx = {
      projectRoot,
      lastCapturedImage,
      lastDetections,
      visionModels,
      onCaptureImage: (img) => { lastCapturedImage = img; },
      onDetections: (dets) => { lastDetections = dets; },
      browserSessionId,
      browserPageId,
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
    onStepDone(i, results[results.length - 1]);

    if (stepDelayMs > 0 && i < steps.length - 1) {
      await new Promise((r) => setTimeout(r, stepDelayMs));
    }
  }

  if (browserSessionId) {
    try {
      await tools.browserSessionEnd(browserSessionId);
    } catch (_) {}
  }

  // 提取最终可展示内容：优先用最后一次 browser_execute 的 result，其次用 fs_write_text 前的提取结果
  let finalContent = null;
  let finalPath = null;
  for (let i = results.length - 1; i >= 0; i--) {
    const r = results[i];
    if (r.tool === 'browser_execute' && r.success && r.result?.result != null) {
      finalContent = typeof r.result.result === 'string' ? r.result.result : String(r.result.result);
      break;
    }
    if (r.tool === 'fs_write_text' && r.success && r.result?.path) {
      finalPath = r.result.path;
      // 往前找 browser_execute 的提取内容
      for (let j = i - 1; j >= 0; j--) {
        const prev = results[j];
        if (prev.tool === 'browser_execute' && prev.success && prev.result?.result != null) {
          finalContent = typeof prev.result.result === 'string' ? prev.result.result : String(prev.result.result);
          break;
        }
      }
      break;
    }
  }

  let verified = null;
  for (let i = results.length - 1; i >= 0; i--) {
    const r = results[i];
    if (r.tool === 'llm_verify_content' && !r.result?.skipped) {
      verified = r.result?.satisfied === true;
      break;
    }
  }

  return {
    goal: plan?.goal ?? '',
    results,
    finalContent: finalContent || null,
    finalPath: finalPath || null,
    verified,
  };
}
