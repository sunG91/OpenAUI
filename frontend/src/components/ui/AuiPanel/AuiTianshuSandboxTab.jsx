/**
 * 天枢架构 · AUI 画布工作台
 * 三层决策 + 七大执行部 + 赏罚台可视化；侧栏记录思考/消息/执行；确认后可真实执行 shell
 */
import { useState, useMemo, useCallback, useEffect } from 'react';
import { MODEL_VENDORS, VENDOR_MODELS } from '../../../data/modelVendors';
import { getArchitectureById } from '../../../data/architectureConfig';
import {
  buildTianshuDianMessages,
  buildZiweiTaiMessages,
  buildXuanjiFuMessages,
  buildMissionSummaryMessages,
  buildFeedbackAnalysisMessages,
} from '../../../data/tianshuSandboxPrompts';
import {
  loadTianshuTestSkills,
  saveTianshuTestSkills,
  mergeAnalysisIntoStore,
  appendFeedbackHistory,
  formatTianshuTestSkillsForPrompt,
  countTipsInStore,
} from '../../../data/tianshuTestSkillsStore';
import { parseLlmJson } from '../../../utils/parseLlmJson';
import { getApiKeys } from '../../../api/client';
import { testModelStream, testModel } from '../../../api/modelTest';
import { getToolsPlatform, getToolsProjectRoot, runShell } from '../../../api/tools';
import { TianshuArchitectureCanvas } from './TianshuArchitectureCanvas';
import { TianshuMissionLog, nextLogId } from './TianshuMissionLog';
import { TianshuRatingPanel } from './TianshuRatingPanel';

/** public 目录背景图（Vite 根路径） */
const TIANGSHU_PAGE_BG = `/images/${encodeURIComponent('天枢架构背景图.jpg')}`;

const PRESETS = [
  { label: '列出项目根目录', text: '列出当前项目根目录下的文件和文件夹（仅查看）' },
  { label: '系统信息', text: '在命令行输出当前日期和 Windows 版本信息' },
  { label: '打开记事本', text: '启动记事本程序（不输入内容）' },
];

/** plan 为空时勿用内联 []，否则流式日志每次 setState 都会换引用，useMemo 失效导致画布跟着重绘闪屏 */
const EMPTY_STEPS = [];

function deptLabel(arch, deptId) {
  const d = arch?.executionDepts?.find((x) => x.id === deptId);
  return d ? d.name : deptId;
}

/**
 * 流式调用模型：侧栏实时追加 delta，返回完整 content / reasoning（供 parseLlmJson）
 */
function streamModelToLogs({
  vendorId,
  modelId,
  messages,
  thinkingTitle,
  outputTitle,
  pushLog,
  updateLogById,
  setLogs,
}) {
  return new Promise((resolve, reject) => {
    let reasoningAcc = '';
    let contentAcc = '';
    const thinkingId = pushLog({ type: 'thinking', title: thinkingTitle, body: '' });
    const outputId = pushLog({ type: 'llm', title: outputTitle, body: '' });

    testModelStream(
      { vendorId, modelId, messages },
      {
        onChunk: ({ reasoning_content: rc = '', content: c = '' }) => {
          reasoningAcc += rc;
          contentAcc += c;
          updateLogById(thinkingId, { body: reasoningAcc });
          updateLogById(outputId, { body: contentAcc });
        },
        onDone: (err) => {
          if (err) {
            reject(err);
            return;
          }
          if (!String(reasoningAcc).trim()) {
            setLogs((prev) => prev.filter((e) => e.id !== thinkingId));
          }
          resolve({ content: contentAcc, reasoning_content: reasoningAcc });
        },
      },
    );
  });
}

export function AuiTianshuSandboxTab() {
  const arch = useMemo(() => getArchitectureById('tianshu'), []);
  const [vendorId, setVendorId] = useState(MODEL_VENDORS[0]?.id ?? 'siliconflow');
  const [modelId, setModelId] = useState(() => VENDOR_MODELS[MODEL_VENDORS[0]?.id]?.[0]?.id ?? '');
  const [goal, setGoal] = useState('');
  const [keysHint, setKeysHint] = useState(null);

  const [phaseIndex, setPhaseIndex] = useState(-1);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState(null);

  const [plan, setPlan] = useState(null);
  const [review, setReview] = useState(null);
  const [dispatch, setDispatch] = useState(null);
  const [rating, setRating] = useState(0);
  const [skillsStore, setSkillsStore] = useState(loadTianshuTestSkills);
  const [sessionAwaitingRating, setSessionAwaitingRating] = useState(false);
  const [analyzingFeedback, setAnalyzingFeedback] = useState(false);

  const [logs, setLogs] = useState([]);
  const [platform, setPlatform] = useState('win32');
  const [projectRoot, setProjectRoot] = useState('');
  const [allowRealExec, setAllowRealExec] = useState(false);
  const [execRunning, setExecRunning] = useState(false);
  const [execStepIdx, setExecStepIdx] = useState(-1);
  const [stepResults, setStepResults] = useState([]);

  const models = VENDOR_MODELS[vendorId] || [];

  const skillsBlock = useMemo(() => formatTianshuTestSkillsForPrompt(skillsStore), [skillsStore]);
  const tipsCount = useMemo(() => countTipsInStore(skillsStore), [skillsStore]);

  const pushLog = useCallback((entry) => {
    const id = nextLogId();
    setLogs((prev) => [...prev, { ts: Date.now(), id, ...entry }]);
    return id;
  }, []);

  const updateLogById = useCallback((logId, patch) => {
    setLogs((prev) => prev.map((e) => (e.id === logId ? { ...e, ...patch } : e)));
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);

  const refreshKeys = useCallback(() => {
    getApiKeys()
      .then((masked) => {
        const has = Object.keys(masked || {}).filter((k) => {
          const v = masked[k];
          return v && String(v).trim().length > 0;
        });
        setKeysHint(has.length ? `已配置厂商：${has.join('、')}` : '请先在「设置」中保存 API Key');
      })
      .catch(() => setKeysHint('无法读取 Key 状态'));
  }, []);

  useEffect(() => {
    refreshKeys();
    getToolsPlatform().then(setPlatform).catch(() => {});
    getToolsProjectRoot()
      .then((root) => setProjectRoot(typeof root === 'string' ? root : ''))
      .catch(() => {});
  }, [refreshKeys]);

  const handleVendorChange = (vid) => {
    setVendorId(vid);
    const list = VENDOR_MODELS[vid] || [];
    setModelId(list[0]?.id ?? '');
  };

  const streamMissionSummary = useCallback(
    async (userGoal, ctx) =>
      streamModelToLogs({
        vendorId,
        modelId,
        messages: buildMissionSummaryMessages(userGoal, ctx),
        thinkingTitle: '任务总结 · 思考',
        outputTitle: '任务总结 · 报告',
        pushLog,
        updateLogById,
        setLogs,
      }),
    [vendorId, modelId, pushLog, updateLogById, setLogs],
  );

  const submitFeedback = useCallback(
    async (stars, comment) => {
      const g = goal.trim();
      if (!g) {
        setErr('请先填写测试目标');
        return;
      }
      setAnalyzingFeedback(true);
      setErr(null);
      try {
        const res = await testModel({
          vendorId,
          modelId,
          messages: buildFeedbackAnalysisMessages({
            rating: stars,
            comment: comment || '（无文字，仅星级）',
            userGoal: g,
            planSummary: plan?.summary ? String(plan.summary) : '',
          }),
        });
        const raw = res?.content || res?.reasoning_content || '';
        if (!String(raw).trim()) throw new Error('模型未返回内容');
        const parsed = parseLlmJson(raw);
        setSkillsStore((prev) => {
          const merged = mergeAnalysisIntoStore(prev, parsed);
          const withHistory = appendFeedbackHistory(merged, {
            ts: Date.now(),
            rating: stars,
            comment,
            analysis: parsed,
          });
          saveTianshuTestSkills(withHistory);
          return withHistory;
        });
        setRating(stars);
        setSessionAwaitingRating(false);
        pushLog({
          type: 'system',
          title: '评价已分析 · 模块归因',
          body:
            typeof parsed?.iterationSummary === 'string'
              ? `${parsed.iterationSummary}\n\n${JSON.stringify(parsed?.targets ?? [], null, 2)}`
              : JSON.stringify(parsed, null, 2),
        });
      } catch (e) {
        setErr(e?.message || String(e));
        pushLog({ type: 'warn', title: '评价分析失败', body: e?.message || String(e) });
      } finally {
        setAnalyzingFeedback(false);
      }
    },
    [vendorId, modelId, goal, plan, pushLog],
  );

  const runRealExecution = async (planData = null, reviewData = null) => {
    const p = planData ?? plan;
    const rev = reviewData ?? review;
    if (!p?.steps?.length || rev?.approved === false) return [];
    if (!allowRealExec) {
      setErr('请先勾选「允许在本机执行 Shell」');
      return [];
    }
    setErr(null);
    setExecRunning(true);
    setStepResults([]);
    const results = [];
    pushLog({ type: 'exec', title: '执行开始', body: '按步骤调用 POST /api/tools/shell（后端即本机）' });

    try {
      for (let i = 0; i < p.steps.length; i++) {
        setExecStepIdx(i);
        const step = p.steps[i];
        const cmd = (step.shellCommand && String(step.shellCommand).trim()) || '';
        const deptId = step.deptId || 'qiyuan';

        if (!cmd) {
          pushLog({
            type: 'exec',
            title: `步骤 ${i + 1} · ${deptLabel(arch, deptId)}`,
            body: '（无 shellCommand，跳过真实执行）',
          });
          results.push({ ok: true, skipped: true, step: i + 1 });
          continue;
        }

        pushLog({
          type: 'message',
          title: `Shell → ${deptLabel(arch, deptId)}`,
          body: cmd,
        });

        const res = await runShell(cmd, { timeout: 60000 });
        results.push({ ok: res.success !== false, step: i + 1, res });
        pushLog({
          type: 'exec',
          title: res.success !== false ? `回执 ${i + 1}` : `失败 ${i + 1}`,
          body: JSON.stringify(
            {
              success: res.success,
              stdout: res.stdout?.slice?.(0, 4000) ?? res.stdout,
              stderr: res.stderr?.slice?.(0, 2000) ?? res.stderr,
              code: res.code,
              error: res.error,
            },
            null,
            2,
          ),
        });
      }
      setStepResults(results);
      pushLog({ type: 'system', title: '执行结束', body: '全部步骤已处理。' });
      return results;
    } catch (e) {
      setErr(e?.message || String(e));
      pushLog({ type: 'warn', title: '执行异常', body: e?.message || String(e) });
      return results;
    } finally {
      setExecRunning(false);
      setExecStepIdx(-1);
    }
  };

  const runPipeline = async () => {
    const g = goal.trim();
    if (!g) {
      setErr('请输入测试目标');
      return;
    }
    setErr(null);
    setRunning(true);
    setPhaseIndex(0);
    setPlan(null);
    setReview(null);
    setDispatch(null);
    setRating(0);
    setStepResults([]);
    setLogs([]);
    setExecStepIdx(-1);
    setSessionAwaitingRating(false);
    setRating(0);

    const env = { platform, projectRoot, tianshuTestSkillsBlock: skillsBlock };
    pushLog({ type: 'system', title: '环境', body: `platform=${platform}\nprojectRoot=${projectRoot || '(未知)'}` });

    try {
      pushLog({ type: 'message', title: '→ 天枢殿', body: '请求意图拆解（流式）…' });
      const r1 = await streamModelToLogs({
        vendorId,
        modelId,
        messages: buildTianshuDianMessages(g, env),
        thinkingTitle: '天枢殿 · 思考',
        outputTitle: '天枢殿 · 输出',
        pushLog,
        updateLogById,
        setLogs,
      });
      const p1 = parseLlmJson(r1.content || '');
      if (!p1.steps || !Array.isArray(p1.steps)) throw new Error('天枢殿返回格式缺少 steps');
      let finalPlan = { ...p1 };
      setPlan(finalPlan);

      setPhaseIndex(1);
      pushLog({ type: 'message', title: '→ 紫微台', body: '请求安全审核（流式）…' });
      const r2 = await streamModelToLogs({
        vendorId,
        modelId,
        messages: buildZiweiTaiMessages(g, p1, { tianshuTestSkillsBlock: skillsBlock }),
        thinkingTitle: '紫微台 · 思考',
        outputTitle: '紫微台 · 输出',
        pushLog,
        updateLogById,
        setLogs,
      });
      const p2 = parseLlmJson(r2.content || '');
      setReview(p2);

      finalPlan = { ...p1 };
      if (Array.isArray(p2.revisedSteps) && p2.revisedSteps.length > 0) {
        finalPlan = { ...p1, steps: p2.revisedSteps };
      }
      setPlan(finalPlan);

      if (p2.approved === false) {
        setDispatch(null);
        setPhaseIndex(4);
        pushLog({ type: 'warn', title: '紫微台', body: '审核未通过，跳过璇玑府调度与真实执行。' });
        setRunning(false);
        try {
          await streamMissionSummary(g, {
            plan: finalPlan,
            review: p2,
            dispatch: null,
            results: [],
            tianshuTestSkillsBlock: skillsBlock,
          });
          pushLog({ type: 'system', title: '全部完成', body: '已生成简报（审核未通过）。' });
          setSessionAwaitingRating(true);
        } catch (se) {
          pushLog({ type: 'warn', title: '总结生成失败', body: se?.message || String(se) });
        }
        return;
      }

      setPhaseIndex(2);
      pushLog({ type: 'message', title: '→ 璇玑府', body: '请求调度摘要（流式）…' });
      const r3 = await streamModelToLogs({
        vendorId,
        modelId,
        messages: buildXuanjiFuMessages(g, finalPlan, { tianshuTestSkillsBlock: skillsBlock }),
        thinkingTitle: '璇玑府 · 思考',
        outputTitle: '璇玑府 · 输出',
        pushLog,
        updateLogById,
        setLogs,
      });
      const p3 = parseLlmJson(r3.content || '');
      setDispatch(p3);
      setPhaseIndex(4);
      pushLog({
        type: 'system',
        title: '推演完成',
        body: allowRealExec
          ? '已通过审核；将自动执行本机 Shell 并流式生成「任务总结 · 报告」。'
          : '推演完成。勾选「允许执行」后，下次点击「开始推演」将在推演结束后自动执行并生成报告。',
      });

      setRunning(false);

      let execResults = [];
      if (allowRealExec && finalPlan?.steps?.length) {
        execResults = (await runRealExecution(finalPlan, p2)) || [];
      } else if (!allowRealExec) {
        pushLog({ type: 'system', title: '提示', body: '未勾选「允许执行」，已跳过本机 Shell；仍将生成文字总结。' });
      }

      try {
        await streamMissionSummary(g, {
          plan: finalPlan,
          review: p2,
          dispatch: p3,
          results: execResults,
          tianshuTestSkillsBlock: skillsBlock,
        });
        pushLog({ type: 'system', title: '全部完成', body: '推演、执行（若已勾选）与总结已结束。请在下方赏罚台打分评价以迭代模块化提示词。' });
        setSessionAwaitingRating(true);
      } catch (se) {
        pushLog({ type: 'warn', title: '总结生成失败', body: se?.message || String(se) });
      }
    } catch (e) {
      setErr(e?.message || String(e));
      pushLog({ type: 'warn', title: '错误', body: e?.message || String(e) });
      setPhaseIndex(-1);
    } finally {
      setRunning(false);
    }
  };

  const steps = useMemo(() => {
    const s = plan?.steps;
    return Array.isArray(s) && s.length > 0 ? s : EMPTY_STEPS;
  }, [plan]);

  const approved = review?.approved !== false;

  /** 仅当前阶段相关的边显示流动粒子，避免全图同时动 */
  const edgeFlowActive = useMemo(() => {
    const m = {};
    if (running && phaseIndex === 0) {
      m['e-user-l1'] = true;
    }
    if (running && phaseIndex === 1) {
      m['e-l0-l1'] = true;
    }
    if (running && phaseIndex === 2) {
      m['e-l1-l2'] = true;
    }
    if (execRunning && execStepIdx >= 0 && steps[execStepIdx]) {
      const dep = steps[execStepIdx].deptId || 'qiyuan';
      m[`e-xuan-${dep}`] = true;
      m[`e-dept-sf-${dep}`] = true;
    }
    return m;
  }, [running, phaseIndex, execRunning, execStepIdx, steps]);

  const nodeStatus = useMemo(() => {
    const o = {};
    if (!arch) return o;

    const usedDeptIds = new Set(steps.map((s) => s?.deptId).filter(Boolean));

    /** 七大执行部始终存在：未纳入计划的为「休息」，纳入后随推演/执行为 idle/active/done */
    arch.executionDepts?.forEach((d) => {
      const id = `node-dept-${d.id}`;
      if (!steps.length || !usedDeptIds.has(d.id)) {
        o[id] = 'rest';
        return;
      }
      let st = 'idle';
      if (execRunning && execStepIdx >= 0 && steps.length) {
        const cur = steps[execStepIdx];
        if (cur?.deptId === d.id) st = 'active';
        else if (steps.slice(0, execStepIdx).some((s) => s.deptId === d.id)) st = 'done';
      } else if (!execRunning && stepResults.length > 0) {
        st = 'done';
      } else if (phaseIndex >= 4) {
        st = 'idle';
      }
      o[id] = st;
    });

    if (phaseIndex < 0 && !running && !execRunning) {
      o['node-user'] = 'idle';
      arch.decisionLayers?.forEach((layer) => {
        o[`node-${layer.id}`] = 'idle';
      });
      o['node-shangfa'] = 'idle';
      o['node-reward'] = 'idle';
      return o;
    }

    o['node-user'] = phaseIndex >= 0 || execRunning ? 'done' : 'idle';

    if (running && phaseIndex === 0) {
      o['node-tianshu-dian'] = 'active';
    } else if (phaseIndex >= 1 || execRunning) {
      o['node-tianshu-dian'] = 'done';
    }

    if (running && phaseIndex === 1) {
      o['node-ziwei-tai'] = 'active';
    } else if (phaseIndex >= 2 || execRunning) {
      o['node-ziwei-tai'] = 'done';
    }

    if (running && phaseIndex === 2) {
      o['node-xuanji-fu'] = 'active';
    } else if (phaseIndex >= 4 || execRunning) {
      o['node-xuanji-fu'] = 'done';
    }

    if (execRunning) {
      o['node-shangfa'] = 'idle';
    } else if (stepResults.length > 0) {
      o['node-shangfa'] = 'done';
      o['node-reward'] = rating > 0 ? 'done' : 'active';
    } else if (phaseIndex >= 4) {
      o['node-shangfa'] = approved ? 'done' : 'skipped';
      o['node-reward'] = 'active';
    }

    return o;
  }, [arch, phaseIndex, running, execRunning, execStepIdx, steps, stepResults.length, rating, approved]);

  return (
    <div className="relative flex flex-col lg:flex-row gap-0 min-h-0 h-full rounded-xl overflow-hidden border border-cyan-400/45 shadow-xl shadow-cyan-950/30 ring-1 ring-sky-400/20">
      {/* 背景图 */}
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-[0.9]"
        style={{ backgroundImage: `url('${TIANGSHU_PAGE_BG}')` }}
      />
      {/* 青蓝系蒙版：仅用渐变，避免全屏 backdrop-blur 与 SVG 动画同帧合成导致整卡闪屏 */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none bg-gradient-to-br from-sky-950/55 via-cyan-950/50 to-indigo-950/58"
      />
      {/* 主区 */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0 min-h-0">
        <div className="flex-shrink-0 px-4 py-3 border-b border-sky-400/30 bg-transparent">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div>
              <h2 className="text-sm font-bold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 via-sky-200 to-indigo-200 drop-shadow-[0_0_12px_rgba(34,211,238,0.25)]">
                天枢架构 · AUI 画布工作台
              </h2>
              <p className="text-[10px] text-sky-200/80 mt-0.5 max-w-2xl">
                全链路可视化 + 侧栏消息帧。勾选「允许执行」后，推演结束将<strong className="text-cyan-200/95">自动</strong>跑本机 Shell，并流式生成
                「任务总结 · 报告」。命令由后端{' '}
                <code className="text-cyan-300/95 bg-sky-950/40 px-1 rounded border border-cyan-500/25">/api/tools/shell</code>{' '}
                执行（请自行承担风险）。
              </p>
            </div>
            {keysHint && (
              <span
                className="text-[10px] text-amber-100/95 border border-amber-400/35 bg-amber-950/25 px-2 py-1 rounded-md max-w-xs truncate shadow-sm shadow-amber-900/20"
                title={keysHint}
              >
                {keysHint}
              </span>
            )}
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] text-sky-300/90 uppercase tracking-wider">厂商</span>
              <select
                value={vendorId}
                onChange={(e) => handleVendorChange(e.target.value)}
                className="rounded-lg border border-cyan-400/40 bg-slate-950/35 px-2 py-1.5 text-xs text-sky-100 shadow-inner shadow-sky-950/50"
              >
                {MODEL_VENDORS.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] text-sky-300/90 uppercase tracking-wider">模型</span>
              <select
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                className="rounded-lg border border-cyan-400/40 bg-slate-950/35 px-2 py-1.5 text-xs text-sky-100 shadow-inner shadow-sky-950/50"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setGoal(p.text)}
                className="text-[10px] px-2 py-0.5 rounded-full border border-cyan-400/45 text-cyan-100 hover:bg-cyan-500/15 hover:border-cyan-300/50"
              >
                {p.label}
              </button>
            ))}
          </div>

          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="描述目标；模型会为可执行步骤填写 shellCommand；勾选允许执行后将自动跑命令并生成总结报告"
            rows={3}
            className="mt-2 w-full rounded-lg border border-sky-400/35 bg-slate-950/30 px-3 py-2 text-xs text-sky-100 placeholder:text-sky-400/55 focus:outline-none focus:ring-1 focus:ring-cyan-400/50"
          />

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={running}
              onClick={runPipeline}
              title="开始推演"
              aria-label="开始推演"
              className="inline-flex items-center justify-center p-0.5 bg-transparent border-0 text-cyan-300 hover:text-cyan-100 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent rounded-sm"
            >
              {running ? (
                <svg className="w-8 h-8 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                  <path
                    className="opacity-90"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : (
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M8 5.14v13.72c0 .89 1 1.43 1.76.94l10.8-6.86a1.14 1.14 0 000-1.88L9.76 4.2A1.14 1.14 0 008 5.14z" />
                </svg>
              )}
            </button>
            <label className="flex items-center gap-2 text-[11px] text-sky-200/90 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allowRealExec}
                onChange={(e) => setAllowRealExec(e.target.checked)}
                className="rounded border-sky-500/50 bg-slate-950/40 text-cyan-500 focus:ring-cyan-400/50"
              />
              允许在本机执行 Shell（推演通过后自动执行，无需再点）
            </label>
            <button
              type="button"
              disabled={execRunning || !plan || phaseIndex < 4 || !approved}
              onClick={() => void runRealExecution()}
              title="未勾选自动时可用；已勾选则推演结束已自动执行，此按钮用于补跑"
              className="text-xs px-3 py-1.5 rounded-lg border border-emerald-400/45 text-emerald-200 hover:bg-emerald-500/15 hover:border-emerald-300/50 disabled:opacity-30"
            >
              {execRunning ? '执行中…' : '手动再执行一遍'}
            </button>
          </div>
          {err && <p className="mt-2 text-xs text-red-300 drop-shadow-sm">{err}</p>}
        </div>

        <div className="flex-1 min-h-0 overflow-hidden p-2 sm:p-3 flex flex-col">
          <TianshuArchitectureCanvas architecture={arch} nodeStatus={nodeStatus} edgeFlowActive={edgeFlowActive} />
        </div>
      </div>

      {/* 侧栏：任务流 + 赏罚台评价 */}
      <div className="relative z-10 w-full lg:w-[380px] lg:max-w-[40vw] flex-shrink-0 flex flex-col min-h-[320px] lg:min-h-0 lg:h-full max-h-[50vh] lg:max-h-none border-t lg:border-t-0 lg:border-l border-sky-400/35 bg-transparent">
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-hidden">
            <TianshuMissionLog
              entries={logs}
              onClear={clearLogs}
              plan={plan}
              architecture={arch}
              skillsStore={skillsStore}
              onSkillsChange={(next) => {
                setSkillsStore(next);
                saveTianshuTestSkills(next);
              }}
            />
          </div>
          <TianshuRatingPanel
            disabled={!sessionAwaitingRating || running || execRunning}
            busy={analyzingFeedback}
            tipsCount={tipsCount}
            onSubmit={submitFeedback}
          />
        </div>
      </div>
    </div>
  );
}
