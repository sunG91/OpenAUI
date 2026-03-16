/**
 * Agent 完整流程测试区
 * 用户指令 → 拆解 → 规划 → 执行 → 反馈
 */
import { useState, useRef, useEffect } from 'react';
import { MODEL_VENDORS, VENDOR_MODELS } from '../../../data/modelVendors';
import { testModel, testModelStream } from '../../../api/modelTest';
import { getSkillSettings } from '../../../api/settings';
import { runAgent } from '../../../agent';
import { MarkdownBlock } from '../ModelTestPanel/MarkdownBlock';
import { StreamingText } from '../StreamingText';

function getFirstModelId(vid) {
  const list = VENDOR_MODELS[vid] || [];
  return list[0]?.id ?? '';
}

export function AgentTestArea({ fixedModel }) {
  const firstVendor = MODEL_VENDORS[0]?.id ?? '';
  const [vendorId, setVendorId] = useState(firstVendor);
  const [modelId, setModelId] = useState(() => getFirstModelId(firstVendor));
  const [userGoal, setUserGoal] = useState('打开百度，搜索天气');
  const [enableThinking, setEnableThinking] = useState(false);
  const [stepDelayMs, setStepDelayMs] = useState(0);
  const [captureAfterStep, setCaptureAfterStep] = useState(true);
  const [outputMode, setOutputMode] = useState('display'); // 'display' 直接展示 | 'file' 保存为 .md
  const [stream, setStream] = useState(true);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState('');
  const [plan, setPlan] = useState(null);
  const [execution, setExecution] = useState(null);
  const [executionResults, setExecutionResults] = useState([]);
  const [thinkingContent, setThinkingContent] = useState('');
  const [decomposeContent, setDecomposeContent] = useState('');
  const [currentStepIndex, setCurrentStepIndex] = useState(null);
  const [totalSteps, setTotalSteps] = useState(0);
  const [error, setError] = useState(null);
  const [collapsed, setCollapsed] = useState({ thinking: false, plan: false, execution: false });
  const [finalContentPreview, setFinalContentPreview] = useState('');
  const resultAreaRef = useRef(null);
  const executionEndRef = useRef(null);
  const streamingEndRef = useRef(null);
  const finalResultRef = useRef(null);

  useEffect(() => {
    if (loading && resultAreaRef.current) {
      resultAreaRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [loading]);

  useEffect(() => {
    streamingEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [thinkingContent, decomposeContent, plan]);

  useEffect(() => {
    executionEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [executionResults, execution]);

  // 完成后收起过程区块，并滚动到最终结果
  useEffect(() => {
    if (!loading && (execution?.finalContent || execution?.finalPath)) {
      setCollapsed((c) => ({ ...c, thinking: true, plan: true, execution: true }));
      setTimeout(() => finalResultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
  }, [loading, execution?.finalContent, execution?.finalPath]);

  const useFixed = fixedModel && fixedModel.vendorId && fixedModel.modelId;
  const vid = useFixed ? fixedModel.vendorId : vendorId;
  const mid = useFixed ? fixedModel.modelId : modelId;
  const models = VENDOR_MODELS[vid] || [];
  const currentModel = models.find((m) => m.id === mid) || models[0];

  const handleRun = async () => {
    const goal = userGoal.trim();
    if (!goal) return;
    setLoading(true);
    setPlan(null);
    setExecution(null);
    setExecutionResults([]);
    setThinkingContent('');
    setDecomposeContent('');
    setCurrentStepIndex(null);
    setTotalSteps(0);
    setError(null);
    setPhase('');
    setCollapsed({ thinking: false, plan: false, execution: false });
    setFinalContentPreview('');
    try {
      let vidTrim = vid;
      let midTrim = mid;
      const settings = await getSkillSettings().catch(() => ({}));
      const q = settings?.quick || {};
      if (q.vendorId && q.modelId) {
        vidTrim = q.vendorId;
        midTrim = q.modelId;
      }

      const streamCapable = currentModel?.stream === true;
      const useStream = streamCapable && stream;

      const { plan: p, execution: e } = await runAgent({
        userGoal: goal,
        vendorId: vidTrim,
        modelId: midTrim,
        enableThinking,
        testModel,
        testModelStream: useStream ? testModelStream : undefined,
        stream: useStream,
        onPhase: setPhase,
        onPlan: (pl) => {
          setPlan(pl);
          setTotalSteps(pl?.steps?.length ?? 0);
          setDecomposeContent('');
        },
        onThinkingChunk: (chunk) => setThinkingContent(chunk?.content ?? ''),
        onDecomposeChunk: (chunk) => setDecomposeContent(chunk?.content ?? ''),
        onStepStart: (idx, step) => setCurrentStepIndex(idx),
        onStepDone: (_, r) => {
          setExecutionResults((prev) => [...prev, r]);
          if (r.tool === 'llm_extract_from_content' && r.result?.extracted) {
            setFinalContentPreview(String(r.result.extracted));
            setCollapsed({ thinking: true, plan: true, execution: true });
          } else if (r.tool === 'browser_execute' && r.success && r.result?.result != null) {
            const content = String(r.result.result);
            setFinalContentPreview((prev) => (prev ? prev : content));
            setCollapsed({ thinking: true, plan: true, execution: true });
          }
        },
        onSupervisorPlan: (newSteps, reason) => {
          setPlan((prev) => prev ? { ...prev, steps: [...(prev.steps || []), ...newSteps] } : prev);
          setTotalSteps((prev) => prev + (newSteps?.length ?? 0));
        },
        stepDelayMs,
        captureAfterStep,
        outputMode,
      });
      setPlan(p);
      setExecution(e);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
      setPhase('');
    }
  };

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
          <label className="flex items-center gap-2 text-sm text-[var(--skill-btn-text)]">
            <input type="checkbox" checked={captureAfterStep} onChange={(e) => setCaptureAfterStep(e.target.checked)} className="rounded border-[var(--input-bar-border)]" />
            每步后截屏（可观察操作过程）
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--skill-btn-text)]">
            <span className="text-[var(--input-placeholder)]">步骤间隔</span>
            <select value={stepDelayMs} onChange={(e) => setStepDelayMs(Number(e.target.value))} className="rounded border border-[var(--input-bar-border)] text-sm py-1 px-2">
              <option value={0}>0 秒</option>
              <option value={1000}>1 秒</option>
              <option value={2000}>2 秒</option>
              <option value={3000}>3 秒</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--skill-btn-text)]">
            <span className="text-[var(--input-placeholder)]">输出方式</span>
            <select value={outputMode} onChange={(e) => setOutputMode(e.target.value)} className="rounded border border-[var(--input-bar-border)] text-sm py-1 px-2">
              <option value="display">直接展示（Markdown）</option>
              <option value="file">保存为 .md 文件</option>
            </select>
          </label>
          {currentModel?.stream && (
            <label className="flex items-center gap-2 text-sm text-[var(--skill-btn-text)]">
              <input type="checkbox" checked={stream} onChange={(e) => setStream(e.target.checked)} className="rounded border-[var(--input-bar-border)]" />
              流式输出
            </label>
          )}
        </div>
        <p className="text-[11px] text-[var(--input-placeholder)]">
          浏览器可见：在 backend/config.yaml 中设置 <code className="bg-[#f0f1f2] px-1 rounded">browser.headed: true</code> 并重启后端，可看到浏览器窗口实际打开。
        </p>
        <div>
          <label className="block text-xs font-medium text-[var(--input-placeholder)] mb-1">自然语言目标</label>
          <textarea
            value={userGoal}
            onChange={(e) => setUserGoal(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 text-sm border border-[var(--input-bar-border)] rounded-lg bg-white placeholder:text-[var(--input-placeholder)] focus:ring-2 focus:ring-blue-400 outline-none resize-none"
            placeholder="例如：打开百度，搜索天气"
          />
        </div>
        <button
          type="button"
          onClick={handleRun}
          disabled={loading}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? (phase === 'thinking' ? '思考中…' : phase === 'decomposing' ? '拆解中…' : phase === 'executing' ? '执行中…' : '运行中…') : '运行 Agent'}
        </button>
      </div>

      <div ref={resultAreaRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 space-y-4">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        {(loading || plan || execution || thinkingContent || decomposeContent) && (
          <div className="space-y-4">
            {thinkingContent && (
              <div className="rounded-xl border border-[var(--input-bar-border)] bg-white overflow-hidden">
                <button
                  type="button"
                  onClick={() => setCollapsed((c) => ({ ...c, thinking: !c.thinking }))}
                  className="w-full px-4 py-2 border-b border-[var(--input-bar-border)] bg-[#f8f9fa] text-xs font-medium text-[var(--input-placeholder)] text-left flex items-center justify-between hover:bg-[#f0f1f2]"
                >
                  <span>深度思考 {phase === 'thinking' && loading && <span className="text-blue-600 ml-1">（思考中…）</span>}</span>
                  <span className="text-[10px]">{collapsed.thinking ? '展开' : '收起'}</span>
                </button>
                {!collapsed.thinking && (
                  <div className="p-4 text-sm min-h-[60px]">
                    <StreamingText text={thinkingContent} isStreaming={loading && phase === 'thinking'} markdown={true} className="text-[var(--skill-btn-text)]" />
                    <div ref={streamingEndRef} />
                  </div>
                )}
              </div>
            )}

            {(plan || decomposeContent || (loading && phase === 'decomposing')) && (
              <div className="rounded-xl border border-[var(--input-bar-border)] bg-white overflow-hidden">
                <button
                  type="button"
                  onClick={() => setCollapsed((c) => ({ ...c, plan: !c.plan }))}
                  className="w-full px-4 py-2 border-b border-[var(--input-bar-border)] bg-[#f8f9fa] text-xs font-medium text-[var(--input-placeholder)] text-left flex items-center justify-between hover:bg-[#f0f1f2]"
                >
                  <span>Plan {phase === 'decomposing' && loading && <span className="text-blue-600 ml-1">（拆解中…）</span>}</span>
                  <span className="text-[10px]">{collapsed.plan ? '展开' : '收起'}</span>
                </button>
                {!collapsed.plan && (
                <div className="p-4 text-sm text-[var(--skill-btn-text)]">
                  {plan ? (
                    <>
                      <p className="text-xs text-[var(--input-placeholder)] mb-3">{plan.goal}</p>
                      <ol className="space-y-3">
                    {plan.steps.map((s, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-medium flex items-center justify-center">
                          {s.step ?? i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm">{s.action || '—'}</div>
                          {s.tool && (
                            <div className="text-[10px] text-[var(--input-placeholder)] mt-0.5 font-mono">{s.tool}</div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                      <div ref={streamingEndRef} />
                    </>
                  ) : (
                    <div className="min-h-[60px] font-mono text-[11px] whitespace-pre-wrap break-all">
                      <StreamingText text={decomposeContent} isStreaming={loading && phase === 'decomposing'} markdown={false} />
                      {loading && phase === 'decomposing' && !decomposeContent && <span className="text-[var(--input-placeholder)]">等待输出…</span>}
                      <div ref={streamingEndRef} />
                    </div>
                  )}
                </div>
                )}
              </div>
            )}

            {(executionResults.length > 0 || execution || (loading && phase === 'executing')) && (
              <div className="rounded-xl border border-[var(--input-bar-border)] bg-white overflow-hidden">
                <button
                  type="button"
                  onClick={() => setCollapsed((c) => ({ ...c, execution: !c.execution }))}
                  className="w-full px-4 py-2 border-b border-[var(--input-bar-border)] bg-[#f8f9fa] text-xs font-medium text-[var(--input-placeholder)] text-left flex items-center justify-between hover:bg-[#f0f1f2]"
                >
                  <span>
                    执行结果{' '}
                    {loading && phase === 'executing' && !finalContentPreview ? (
                      <span className="text-blue-600 ml-1">
                        （步骤 {currentStepIndex != null ? currentStepIndex + 1 : '?'}{totalSteps > 0 ? `/${totalSteps}` : ''} 执行中…）
                      </span>
                    ) : (finalContentPreview || !loading) && totalSteps > 0 ? (
                      <span className="text-green-600 ml-1">（已完成）</span>
                    ) : null}
                  </span>
                  <span className="text-[10px]">{collapsed.execution ? '展开' : '收起'}</span>
                </button>
                {!collapsed.execution && (
                <div className="p-4 space-y-4 max-h-[50vh] overflow-y-auto overflow-x-hidden">
                  {(execution?.results ?? executionResults).map((r, i) => {
                    const skip = r.result?.skipped;
                    const verify = r.tool === 'llm_verify_content' && !skip;
                    return (
                    <div key={i} className={`border-l-2 pl-3 border-b border-[var(--input-bar-border)] last:border-b-0 ${skip ? 'opacity-70' : ''}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-5 h-5 rounded text-xs flex items-center justify-center flex-shrink-0 ${
                          skip ? 'bg-gray-100 text-gray-500' : r.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {skip ? '−' : r.success ? '✓' : '✗'}
                        </span>
                        <span className="text-sm font-medium">步骤 {r.step}</span>
                        <span className="text-[10px] text-[var(--input-placeholder)] font-mono">{r.tool}</span>
                        {skip && <span className="text-[10px] text-gray-500">（已跳过）</span>}
                        {verify && <span className={`text-[10px] ${r.result?.satisfied ? 'text-green-600' : 'text-amber-600'}`}>
                          {r.result?.satisfied ? '✓ 通过' : '✗ 不满足'}
                        </span>}
                        {r.tool === 'llm_extract_essence' && !skip && <span className="text-[10px] text-blue-600">提取精华</span>}
                      </div>
                      <div className="text-xs text-[var(--input-placeholder)] mb-1">{r.action}</div>
                      {(r.result?.screenCapture || r.result?.image) && (
                        <div className="mb-2">
                          <img
                            src={r.result.screenCapture || r.result.image}
                            alt={`步骤 ${r.step} 截图`}
                            className="max-w-full max-h-48 rounded border border-[var(--input-bar-border)] object-contain cursor-pointer hover:opacity-90"
                            onClick={() => window.open(r.result.screenCapture || r.result.image, '_blank')}
                            title="点击放大"
                          />
                        </div>
                      )}
                      <pre className="text-[11px] bg-[#f8f9fa] p-2 rounded overflow-x-auto max-h-32 overflow-y-auto whitespace-pre-wrap break-words">
                        {(() => {
                          const res = r.result;
                          if (res?.skipped) return res.reason || '已跳过';
                          if (res?.satisfied !== undefined) return JSON.stringify({ satisfied: res.satisfied, reason: res.reason }, null, 2);
                          if (res?.essence) return res.essence;
                          if (res?.screenCapture || res?.image) {
                            const { screenCapture, image, ...rest } = res;
                            return typeof rest === 'object' && Object.keys(rest).length > 0 ? JSON.stringify(rest, null, 2) : (res?.error || '成功');
                          }
                          return typeof res === 'object' ? JSON.stringify(res, null, 2) : String(res);
                        })()}
                      </pre>
                    </div>
                  );})}
                  <div ref={executionEndRef} />
                </div>
                )}
              </div>
            )}

            {((!loading && execution?.finalContent) || (loading && finalContentPreview)) && (
              <div ref={finalResultRef} className="rounded-xl border-2 border-blue-200 bg-white overflow-hidden shadow-sm">
                <div className="px-4 py-3 border-b border-[var(--input-bar-border)] bg-blue-50 text-sm font-medium text-[var(--skill-btn-text)] flex items-center justify-between">
                  <span>
                    最终结果（Markdown）{' '}
                    {loading && finalContentPreview ? (
                      <span className="text-amber-600 ml-1 text-xs font-normal">（已生成，验证中…）</span>
                    ) : !loading && (execution?.finalContent || execution?.finalPath) ? (
                      <span className="text-green-600 ml-1 text-xs font-normal">（完成）</span>
                    ) : null}
                  </span>
                  {!loading && execution?.verified === false && (
                    <span className="text-amber-600 text-xs">内容未通过验证，仍展示提取结果</span>
                  )}
                </div>
                <div className="p-4 max-h-[60vh] overflow-y-auto overflow-x-hidden">
                  <StreamingText
                    text={execution?.finalContent ?? finalContentPreview}
                    markdown={true}
                    className="text-sm leading-relaxed"
                    showCursorWhenCaughtUp={false}
                    isStreaming={loading && !!finalContentPreview}
                    instant={!loading}
                  />
                </div>
              </div>
            )}

            {!loading && execution?.finalPath && !execution?.finalContent && (
              <div className="rounded-xl border border-[var(--input-bar-border)] bg-white overflow-hidden">
                <div className="px-4 py-2 border-b border-[var(--input-bar-border)] bg-[#f8f9fa] text-xs font-medium text-[var(--input-placeholder)]">
                  已保存
                </div>
                <div className="p-4 text-sm text-[var(--skill-btn-text)]">
                  已保存到 <code className="bg-[#f0f1f2] px-1 rounded">{execution.finalPath}</code>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
