/**
 * Agent 模块 - 主协调器
 * 用户指令 → 拆解 → 规划 → 执行 → 反馈
 */
import { decompose } from './decompose';
import { executePlan } from './planExecutor';
import { getToolsPlatform, getToolsProjectRoot } from '../api/tools';

/**
 * 运行完整 Agent 流程
 * @param {object} options
 * @param {string} options.userGoal - 用户目标
 * @param {string} options.vendorId - 模型厂商
 * @param {string} options.modelId - 模型 ID
 * @param {boolean} options.enableThinking - 是否启用深度思考
 * @param {function} options.testModel - 模型调用函数
 * @param {function} options.onPhase - (phase: 'thinking'|'decomposing'|'executing') => void
 * @param {function} options.onPlan - (plan) => void
 * @param {function} options.onStepStart - (index, step) => void
 * @param {function} options.onStepDone - (index, result) => void
 * @param {number} options.stepDelayMs - 每步间隔毫秒
 * @param {boolean} options.captureAfterStep - 每步后截屏
 * @param {string} options.outputMode - 'display' 直接展示 | 'file' 保存为 .md
 * @returns {Promise<{ plan, execution }>}
 */
export async function runAgent(options) {
  const {
    userGoal,
    vendorId,
    modelId,
    enableThinking = true,
    testModel,
    onPhase = () => {},
    onPlan = () => {},
    onStepStart = () => {},
    onStepDone = () => {},
    stepDelayMs = 0,
    captureAfterStep = false,
    outputMode = 'display',
  } = options;

  let platformHint = '';
  let projectRoot = '';
  try {
    const platform = await getToolsPlatform();
    platformHint = platform === 'win32'
      ? '当前为 Windows，命令用 CMD 格式（如 dir、echo）。'
      : '当前为 Unix/Linux/macOS，命令用 bash 格式（如 ls、pwd）。';
  } catch (_) {}
  try {
    const pr = await getToolsProjectRoot();
    projectRoot = pr?.projectRoot ?? '';
  } catch (_) {}

  onPhase('decomposing');
  const plan = await decompose({
    userGoal,
    vendorId,
    modelId,
    enableThinking,
    testModel,
    outputMode,
  });
  onPlan(plan);

  onPhase('executing');
  const execution = await executePlan(plan, {
    vendorId,
    modelId,
    testModel,
    projectRoot,
    platformHint,
    onStepStart,
    onStepDone,
    stepDelayMs,
    captureAfterStep,
  });

  return { plan, execution };
}
