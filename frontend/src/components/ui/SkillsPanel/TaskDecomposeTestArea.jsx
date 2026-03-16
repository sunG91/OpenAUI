/**
 * 自主拆解任务 - 将用户自然语言拆分为可执行的 Plan
 * 含「查看」与「测试」两个 Tab，测试区展示模型思考过程与最终拆解结果
 */
import { useState, useRef, useEffect } from 'react';
import { MODEL_VENDORS, VENDOR_MODELS } from '../../../data/modelVendors';
import { testModel, testModelStream } from '../../../api/modelTest';
import { getSkillSettings } from '../../../api/settings';
import { MarkdownBlock } from '../ModelTestPanel/MarkdownBlock';

function getFirstModelId(vid) {
  const list = VENDOR_MODELS[vid] || [];
  return list[0]?.id ?? '';
}

const THINKING_PROMPT = `请对用户的以下目标进行深度思考和分析：

1. 目标涉及哪些操作类型？（浏览器、GUI 模拟、系统命令、视觉检测、文件操作等）
2. 可能的分步逻辑和依赖关系是什么？
3. 有哪些潜在难点、边界情况或注意事项？
4. 需要哪些工具组合才能完成？

请用自然语言输出你的分析思路，为后续任务拆分提供依据。`;

const PLAN_SCHEMA = `
请将用户的自然语言目标拆分为可执行的步骤计划（Plan）。

输出格式（仅输出 JSON，不要 markdown、不要解释）：
{
  "goal": "用户原始目标简述",
  "steps": [
    { "step": 1, "action": "步骤描述", "tool": "可选：gui_mouse_click|browser_navigate|vision_screen_detect|console_shell|fs_list 等" },
    { "step": 2, "action": "步骤描述", "tool": "..." }
  ]
}

步骤应具体、可执行，tool 字段可选，用于提示后续可调用的工具。
`;

const TABS = [
  { id: 'view', label: '查看' },
  { id: 'test', label: '测试' },
];

export function TaskDecomposeTestArea({ fixedModel }) {
  const [tab, setTab] = useState('test');

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-shrink-0 flex border-b border-[var(--input-bar-border)] bg-[#f8f9fa]">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.id ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-[var(--input-placeholder)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === 'view' && <TaskDecomposeView />}
        {tab === 'test' && <TaskDecomposeTest fixedModel={fixedModel} />}
      </div>
    </div>
  );
}

function TaskDecomposeView() {
  return (
    <div className="p-4 overflow-y-auto text-sm space-y-3 text-[var(--skill-btn-text)]">
      <h3 className="text-base font-semibold">自主拆解任务</h3>
      <p className="text-[var(--input-placeholder)]">
        将用户的<strong>自然语言目标</strong>拆分为可执行的<strong>步骤计划（Plan）</strong>，便于后续按步骤执行或对接工具。
      </p>
      <div className="rounded-lg border border-[var(--input-bar-border)] bg-[#f8f9fa] p-3 space-y-2">
        <div className="text-xs font-medium text-[var(--input-placeholder)]">输出格式</div>
        <ul className="space-y-1 text-xs">
          <li>• <strong>goal</strong> — 目标简述</li>
          <li>• <strong>steps</strong> — 步骤数组，每步含 action、可选 tool</li>
        </ul>
      </div>
      <div className="rounded-lg border border-[var(--input-bar-border)] bg-[#f8f9fa] p-3">
        <div className="text-xs font-medium text-[var(--input-placeholder)] mb-1.5">流程：思考层 + 任务拆分</div>
        <p className="text-xs">1. 深度思考：分析目标涉及的操作类型、分步逻辑、难点</p>
        <p className="text-xs mt-1">2. 任务拆分：基于思考输出可执行的步骤 Plan</p>
      </div>
      <div className="rounded-lg border border-[var(--input-bar-border)] bg-[#f8f9fa] p-3">
        <div className="text-xs font-medium text-[var(--input-placeholder)] mb-1.5">示例</div>
        <p className="text-xs">目标：帮我搜索天气，并整理成文档给我</p>
        <p className="text-xs mt-1 text-[var(--input-placeholder)]">→ 思考：需浏览器搜索、获取结果、写入文件；难点是定位第一个结果、文档格式</p>
        <p className="text-xs mt-1 text-[var(--input-placeholder)]">→ 拆解：打开百度、输入天气、获取第一个结果、创建文档、写入内容</p>
      </div>
    </div>
  );
}

function TaskDecomposeTest({ fixedModel }) {
  const firstVendor = MODEL_VENDORS[0]?.id ?? '';
  const [vendorId, setVendorId] = useState(firstVendor);
  const [modelId, setModelId] = useState(() => getFirstModelId(firstVendor));
  const [userGoal, setUserGoal] = useState('帮我搜索天气，并整理成文档给我');
  const [stream, setStream] = useState(true);
  const [enableThinking, setEnableThinking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState(''); // 'thinking' | 'decomposing' | ''
  const [thinkingOutput, setThinkingOutput] = useState('');
  const [reasoning, setReasoning] = useState('');
  const [streamingContent, setStreamingContent] = useState('');
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState(null);
  const [thinkingCollapsed, setThinkingCollapsed] = useState(false);
  const resultAreaRef = useRef(null);

  useEffect(() => {
    if (loading && resultAreaRef.current) {
      resultAreaRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [loading]);

  const useFixed = fixedModel && fixedModel.vendorId && fixedModel.modelId;
  const vid = useFixed ? fixedModel.vendorId : vendorId;
  const mid = useFixed ? fixedModel.modelId : modelId;
  const models = VENDOR_MODELS[vid] || [];
  const currentModel = models.find((m) => m.id === mid) || models[0];
  const streamCapable = currentModel?.stream === true;

  const handleDecompose = async () => {
    const goal = userGoal.trim();
    if (!goal) return;
    setLoading(true);
    setPlan(null);
    setThinkingOutput('');
    setReasoning('');
    setStreamingContent('');
    setError(null);
    setThinkingCollapsed(false);
    try {
      let vidTrim = vid;
      let midTrim = mid;
      const settings = await getSkillSettings().catch(() => ({}));
      const q = settings?.quick || {};
      if (q.vendorId && q.modelId) {
        vidTrim = q.vendorId;
        midTrim = q.modelId;
      }
      const useStreamReq = streamCapable && stream;

      const runModel = async (msg, onResult) => {
        const payload = { vendorId: vidTrim, modelId: midTrim, message: msg, stream: useStreamReq };
        if (useStreamReq) {
          let content = '';
          let reasoning_content = '';
          return new Promise((resolve, reject) => {
            testModelStream(payload, {
              onChunk: (delta) => {
                reasoning_content += delta.reasoning_content ?? '';
                content += delta.content ?? '';
                setReasoning(reasoning_content);
                setStreamingContent(content);
              },
              onDone: (err) => {
                if (err) reject(err);
                else {
                  onResult(content, reasoning_content);
                  resolve();
                }
              },
            });
          });
        } else {
          const data = await testModel(payload);
          if (data?.success) {
            setReasoning(data.reasoning_content ?? '');
            setStreamingContent(data.content ?? '');
            onResult(data.content ?? '', data.reasoning_content ?? '');
          } else throw new Error(data?.error || '请求失败');
        }
      };

      let thinkingResult = '';
      if (enableThinking) {
        setPhase('thinking');
        setReasoning('');
        setStreamingContent('');
        const thinkingMsg = `用户目标：${goal}\n\n${THINKING_PROMPT}`;
        await runModel(thinkingMsg, (content) => {
          thinkingResult = content.trim();
          setThinkingOutput(thinkingResult);
        });
      } else {
        setThinkingOutput('');
      }

      setPhase('decomposing');
      setReasoning('');
      setStreamingContent('');
      const decomposeMsg = `用户目标：${goal}

${thinkingResult ? `【模型深度思考】\n${thinkingResult}\n\n基于以上思考，` : ''}请将目标拆分为可执行的步骤计划。\n\n${PLAN_SCHEMA}`;
      await runModel(decomposeMsg, (content) => {
        parseAndSetPlan(content, goal);
      });

      setPhase('');
    } catch (e) {
      setError(e?.message || String(e));
      setPhase('');
    } finally {
      setLoading(false);
    }
  };

  function parseAndSetPlan(raw, goal) {
    const jsonStr = raw.trim().replace(/^```\w*\n?|\n?```$/g, '').trim();
    try {
      const obj = JSON.parse(jsonStr);
      if (obj?.steps && Array.isArray(obj.steps)) {
        setPlan({ goal: obj.goal ?? goal, steps: obj.steps });
      } else {
        setError(`输出缺少 steps 数组：\n${JSON.stringify(obj, null, 2)}`);
      }
    } catch {
      setError(`无法解析为 JSON：\n${raw.slice(0, 200)}...`);
    }
  }

  const vendorName = MODEL_VENDORS.find((v) => v.id === vid)?.name ?? vid;
  const modelName = currentModel?.name ?? mid;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-shrink-0 p-4 space-y-3 border-b border-[var(--input-bar-border)] bg-white">
        {!useFixed && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--input-placeholder)] mb-1">厂商</label>
              <select
                value={vendorId}
                onChange={(e) => {
                  setVendorId(e.target.value);
                  setModelId(getFirstModelId(e.target.value));
                }}
                className="w-full px-3 py-2 text-sm border border-[var(--input-bar-border)] rounded-lg bg-white"
              >
                {MODEL_VENDORS.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--input-placeholder)] mb-1">模型</label>
              <select
                value={modelId || currentModel?.id}
                onChange={(e) => setModelId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[var(--input-bar-border)] rounded-lg bg-white"
              >
                {(VENDOR_MODELS[vendorId] || []).map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-[var(--skill-btn-text)]">
            <input type="checkbox" checked={enableThinking} onChange={(e) => setEnableThinking(e.target.checked)} className="rounded border-[var(--input-bar-border)]" />
            开启深度思考
          </label>
          {streamCapable && (
            <label className="flex items-center gap-2 text-sm text-[var(--skill-btn-text)]">
              <input type="checkbox" checked={stream} onChange={(e) => setStream(e.target.checked)} className="rounded border-[var(--input-bar-border)]" />
              流式输出
            </label>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--input-placeholder)] mb-1">自然语言目标</label>
          <textarea
            value={userGoal}
            onChange={(e) => setUserGoal(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 text-sm border border-[var(--input-bar-border)] rounded-lg bg-white placeholder:text-[var(--input-placeholder)] focus:ring-2 focus:ring-blue-400 outline-none resize-none"
            placeholder="例如：打开百度，搜索天气，把第一个结果复制到记事本"
          />
        </div>
        <button
          type="button"
          onClick={handleDecompose}
          disabled={loading}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? '拆解中…' : '拆解为 Plan'}
        </button>
      </div>

      <div ref={resultAreaRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        {(loading || thinkingOutput || reasoning || streamingContent || plan) && (
          <div className="space-y-4">
            {thinkingOutput && (
              <div className="rounded-xl border border-[var(--input-bar-border)] bg-white overflow-hidden">
                <button
                  type="button"
                  onClick={() => setThinkingCollapsed((v) => !v)}
                  className="w-full px-4 py-2 border-b border-[var(--input-bar-border)] bg-[#f8f9fa] text-left text-xs font-medium text-[var(--input-placeholder)] flex items-center justify-between hover:bg-[#f0f1f2]"
                >
                  <span>深度思考</span>
                  <span className="text-[10px]">{thinkingCollapsed ? '展开' : '收起'}</span>
                </button>
                {!thinkingCollapsed && (
                  <div className="p-3 h-[100px] overflow-y-auto">
                    <MarkdownBlock className="text-[11px] text-[var(--input-placeholder)] [&_p]:text-[var(--input-placeholder)] [&_strong]:text-[var(--input-placeholder)]">{thinkingOutput}</MarkdownBlock>
                  </div>
                )}
              </div>
            )}

            <div className="rounded-xl border border-[var(--input-bar-border)] bg-white overflow-hidden">
              <div className="px-4 py-2 border-b border-[var(--input-bar-border)] bg-[#f8f9fa] text-xs font-medium text-[var(--input-placeholder)]">
                {loading && (
                  <span className="text-green-600 mr-2">
                    {phase === 'thinking' ? '思考中…' : phase === 'decomposing' ? '拆分中…' : '输出中…'}
                  </span>
                )}
                拆解结果
              </div>
              <div className="p-4 text-sm text-[var(--skill-btn-text)] min-h-[80px]">
                {plan ? (
                  <div>
                    <p className="text-xs text-[var(--input-placeholder)] mb-3">{plan.goal}</p>
                    <ol className="space-y-3">
                      {plan.steps.map((s, i) => (
                        <li key={i} className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-medium flex items-center justify-center">
                            {s.step ?? i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-[var(--skill-btn-text)]">{s.action || s.description || '—'}</div>
                            {s.tool && (
                              <div className="text-[10px] text-[var(--input-placeholder)] mt-0.5 font-mono">{s.tool}</div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reasoning && (
                      <div className="h-[80px] overflow-y-auto">
                        <div className="text-[10px] text-[var(--input-placeholder)] mb-1">思考过程</div>
                        <MarkdownBlock className="text-[11px] text-[var(--input-placeholder)] [&_p]:text-[var(--input-placeholder)] [&_strong]:text-[var(--input-placeholder)]">{reasoning}</MarkdownBlock>
                      </div>
                    )}
                    <div className="font-mono whitespace-pre-wrap break-all">
                      {streamingContent || (loading ? <span className="text-[var(--input-placeholder)]">等待输出…</span> : null)}
                      {loading && <span className="inline-block w-2 h-4 ml-0.5 bg-blue-500 animate-pulse align-middle" />}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
