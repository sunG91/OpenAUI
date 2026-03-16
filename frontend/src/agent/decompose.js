/**
 * Agent 模块 - 任务拆解
 * 将用户自然语言目标拆分为可执行的 Plan（steps）
 */
import { PLAN_SCHEMA } from './schemas';

const THINKING_PROMPT = `请对用户的以下目标进行深度思考和分析：

1. 目标涉及哪些操作类型？（浏览器、GUI 模拟、系统命令、视觉检测、文件操作等）
2. 可能的分步逻辑和依赖关系是什么？
3. 有哪些潜在难点、边界情况或注意事项？
4. 需要哪些工具组合才能完成？

请用自然语言输出你的分析思路，为后续任务拆分提供依据。`;

async function runModelWithStream(payload, testModel, testModelStream, stream, onChunk) {
  if (stream && testModelStream && onChunk) {
    let content = '';
    let reasoning = '';
    return new Promise((resolve, reject) => {
      testModelStream(payload, {
        onChunk: (delta) => {
          reasoning += delta.reasoning_content ?? '';
          content += delta.content ?? '';
          onChunk({ content, reasoning });
        },
        onDone: (err) => {
          if (err) reject(err);
          else resolve({ content, reasoning_content: reasoning });
        },
      });
    });
  }
  const res = await testModel(payload);
  return { content: res?.content ?? '', reasoning_content: res?.reasoning_content ?? '' };
}

/**
 * 拆解用户目标为 Plan
 * @param {object} options
 * @param {string} options.userGoal - 用户目标
 * @param {string} options.vendorId - 模型厂商
 * @param {string} options.modelId - 模型 ID
 * @param {boolean} options.enableThinking - 是否启用深度思考
 * @param {function} options.testModel - 模型调用函数
 * @param {function} options.testModelStream - 流式调用函数（可选）
 * @param {boolean} options.stream - 是否启用流式输出
 * @param {function} options.onThinkingChunk - 思考阶段流式回调 (chunk) => void
 * @param {function} options.onDecomposeChunk - 拆解阶段流式回调 (chunk) => void
 * @returns {Promise<{ goal: string, steps: Array<{ step, action, tool }> }>}
 */
export async function decompose(options) {
  const {
    userGoal,
    vendorId,
    modelId,
    enableThinking = true,
    testModel,
    testModelStream,
    stream = false,
    onPhase = () => {},
    onThinkingChunk = () => {},
    onDecomposeChunk = () => {},
    outputMode = 'display',
  } = options;

  let thinkingOutput = '';
  if (enableThinking && testModel) {
    onPhase('thinking');
    const thinkingMsg = `用户目标：${userGoal}\n\n${THINKING_PROMPT}`;
    const thinkingRes = await runModelWithStream(
      { vendorId, modelId, message: thinkingMsg },
      testModel,
      testModelStream,
      stream,
      onThinkingChunk
    );
    thinkingOutput = (thinkingRes?.content ?? '').trim();
  }

  onPhase('decomposing');
  const outputHint = outputMode === 'display'
    ? '\n\n用户选择「直接展示结果」，最后一步用 browser_execute 提取内容即可，不要用 fs_write_text 保存文件。'
    : options?.outputMode === 'file'
    ? '\n\n用户选择「保存为文件」，最后用 fs_write_text 将结果保存为 .md 文件。'
    : '';

  const isSearchTask = /搜索|查找|查询|百度|google|bing/i.test(userGoal);
  const searchHint = isSearchTask
    ? '\n\n涉及搜索任务时，只输出首次尝试的步骤：打开搜索页→输入→点击搜索→点击第一个结果→browser_wait→提取→llm_verify_content。验证不通过时由监督模块根据执行结果动态决定下一步（尝试下一个结果、换关键词等），不要预写 runIf 重试块。'
    : '';

  const decomposeMsg = `用户目标：${userGoal}${outputHint}${searchHint}

${thinkingOutput ? `【模型深度思考】\n${thinkingOutput}\n\n基于以上思考，` : ''}请将目标拆分为可执行的步骤计划。\n\n${PLAN_SCHEMA}`;

  const res = await runModelWithStream(
    { vendorId, modelId, message: decomposeMsg },
    testModel,
    testModelStream,
    stream,
    onDecomposeChunk
  );
  const raw = (res?.content ?? '').trim();
  const jsonStr = raw.replace(/^```\w*\n?|\n?```$/g, '').trim();
  let obj;
  try {
    obj = JSON.parse(jsonStr);
  } catch {
    throw new Error(`无法解析拆解结果为 JSON：\n${raw.slice(0, 200)}...`);
  }

  if (!obj?.steps || !Array.isArray(obj.steps)) {
    throw new Error(`输出缺少 steps 数组：\n${JSON.stringify(obj, null, 2)}`);
  }

  const TOOL_ALIASES = { gui_keyboard_input: 'gui_keyboard_type' };
  return {
    goal: obj.goal ?? userGoal,
    steps: obj.steps.map((s, i) => {
      const rawTool = (s.tool ?? '').trim();
      const tool = TOOL_ALIASES[rawTool] || rawTool;
      return { ...s, step: s.step ?? i + 1, action: s.action ?? '', tool };
    }),
  };
}
