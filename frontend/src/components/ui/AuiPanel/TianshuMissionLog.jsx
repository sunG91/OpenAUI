/**
 * 天枢任务侧栏 — 思考过程、消息传递、执行结果统一时间线
 */
import { useState, useRef, useEffect } from 'react';
import { MarkdownBlock } from '../ModelTestPanel/MarkdownBlock';
import { TianshuLedgerPanel } from './TianshuLedgerPanel';

/** 侧栏深色主题：GFM、代码块、表格、中文加粗（MarkdownBlock 内层） */
const MD_BODY =
  'text-[11px] leading-relaxed max-w-full overflow-x-auto ' +
  '[&_p]:text-sky-100/90 [&_p]:my-1.5 ' +
  '[&_li]:text-sky-100/90 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_ul]:pl-4 [&_ol]:pl-4 ' +
  '[&_h1]:text-cyan-100 [&_h1]:text-[13px] [&_h1]:font-semibold [&_h1]:mt-2 [&_h1]:mb-1 ' +
  '[&_h2]:text-cyan-100 [&_h2]:text-[12px] [&_h2]:font-semibold [&_h2]:mt-2 [&_h2]:mb-1 ' +
  '[&_h3]:text-sky-100 [&_h3]:text-[11px] [&_h3]:font-medium [&_h3]:mt-1.5 ' +
  '[&_strong]:text-sky-50 [&_b]:text-sky-50 [&_em]:text-sky-200/95 [&_i]:text-sky-200/95 ' +
  '[&_blockquote]:border-sky-400/45 [&_blockquote]:text-sky-300/90 [&_blockquote]:bg-slate-900/40 [&_blockquote]:border-l-4 [&_blockquote]:pl-3 ' +
  '[&_hr]:border-sky-500/35 [&_hr]:my-3 ' +
  '[&_a]:text-cyan-400 [&_a]:underline [&_a]:underline-offset-2 ' +
  '[&_code]:rounded [&_code]:!bg-slate-800/90 [&_code]:!text-emerald-200/95 [&_code]:px-1 [&_code]:py-px [&_code]:text-[11px] ' +
  '[&_pre]:!bg-slate-950/95 [&_pre]:border [&_pre]:border-sky-500/30 [&_pre]:!text-sky-100/95 [&_pre]:my-2 ' +
  '[&_table]:text-sky-100/90 [&_th]:bg-slate-800/95 [&_th]:text-sky-100 [&_th]:border-sky-500/35 ' +
  '[&_td]:border-sky-500/30 [&_tr:nth-child(even)]:bg-slate-900/50';

/** 青蓝蒙版上的浅色字 + 冷色描边 */
const TYPE_META = {
  system: { icon: '◇', color: 'text-sky-200 border-sky-400/35 bg-slate-950/20' },
  thinking: { icon: '◈', color: 'text-violet-200 border-violet-400/35 bg-slate-950/20' },
  message: { icon: '→', color: 'text-cyan-200 border-cyan-400/40 bg-slate-950/20' },
  llm: { icon: 'AI', color: 'text-amber-200 border-amber-400/35 bg-slate-950/20' },
  exec: { icon: '▶', color: 'text-emerald-200 border-emerald-400/35 bg-slate-950/20' },
  warn: { icon: '!', color: 'text-orange-200 border-orange-400/40 bg-slate-950/20' },
};

function formatTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString(undefined, { hour12: false });
  } catch {
    return '';
  }
}

const FILTERS = [
  { id: 'all', label: '全部' },
  { id: 'thinking', label: '思考' },
  { id: 'message', label: '消息' },
  { id: 'exec', label: '执行' },
  { id: 'plan', label: '计划摘要' },
  { id: 'ledger', label: '赏罚账本' },
];

function deptLabel(arch, deptId) {
  const d = arch?.executionDepts?.find((x) => x.id === deptId);
  return d ? d.name : deptId;
}

/** @param {{ entries?: Array, onClear?: () => void, plan?: object | null, architecture?: object, skillsStore?: object, onSkillsChange?: (next: object) => void }} props */
export function TianshuMissionLog({
  entries = [],
  onClear,
  plan = null,
  architecture = null,
  skillsStore = null,
  onSkillsChange = null,
}) {
  const [filter, setFilter] = useState('all');
  const scrollAreaRef = useRef(null);

  /** 流式更新时滚到底部；用 scrollTop 代替 scrollIntoView(smooth)，避免与左侧画布同帧抢布局导致闪屏 */
  useEffect(() => {
    if (filter === 'plan' || filter === 'ledger') return;
    const el = scrollAreaRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries, filter]);

  const filtered =
    filter === 'plan' || filter === 'ledger'
      ? []
      : filter === 'all'
        ? entries
        : entries.filter((e) => {
            if (filter === 'thinking') return e.type === 'thinking';
            if (filter === 'message') return e.type === 'message' || e.type === 'llm';
            if (filter === 'exec') return e.type === 'exec' || e.type === 'warn';
            return true;
          });

  const steps = plan?.steps || [];

  return (
    <div className="flex flex-col h-full min-h-0 bg-transparent text-left">
      <div className="flex-shrink-0 px-2 py-2 border-b border-sky-400/30 space-y-2 bg-transparent">
        <div className="flex items-center justify-between gap-2 px-1">
          <div>
            <h3 className="text-xs font-bold text-cyan-200 tracking-wider uppercase drop-shadow-sm">任务流 · 全记录</h3>
            <p className="text-[10px] text-sky-300/80 mt-0.5">思考链 · 消息帧 · 执行回执</p>
          </div>
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="text-[10px] px-2 py-1 rounded-md border border-sky-500/30 text-sky-200 hover:text-white hover:bg-sky-500/20 hover:border-cyan-400/40"
            >
              清空
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`text-[10px] px-2 py-0.5 rounded-md font-medium transition-colors border ${
                filter === f.id
                  ? 'text-cyan-100 border-cyan-400/50 bg-cyan-950/35 shadow-sm shadow-cyan-900/30'
                  : 'text-sky-300/90 hover:text-sky-100 border-transparent hover:border-sky-400/35'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div
        ref={scrollAreaRef}
        className="flex-1 overflow-y-auto px-2 py-2 space-y-2 min-h-0 [scrollbar-width:thin] [scrollbar-gutter:stable]"
      >
        {filter === 'plan' ? (
          plan ? (
            <div className="rounded-lg border border-cyan-400/40 bg-slate-950/25 px-2.5 py-2.5 shadow-inner shadow-sky-950/40">
              <p className="text-[10px] font-bold text-cyan-200 uppercase tracking-wider mb-2">天枢殿 · 摘要</p>
              {plan.summary ? <MarkdownBlock className={MD_BODY}>{String(plan.summary)}</MarkdownBlock> : null}
              <ul className="mt-3 space-y-2">
                {steps.map((s, idx) => (
                  <li key={idx} className="text-[11px] text-sky-200/90 border-l-2 border-cyan-400/45 pl-2.5">
                    <span className="text-cyan-200">{s.deptId ? deptLabel(architecture, s.deptId) : '—'}</span>
                    {' · '}
                    {s.title}
                    {s.shellCommand ? (
                      <span className="block font-mono text-[10px] text-emerald-300/95 mt-1 break-all">{s.shellCommand}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-sky-400/80 text-center py-8 px-2">暂无计划摘要。开始推演后将在此显示天枢殿生成的步骤与摘要。</p>
          )
        ) : filter === 'ledger' ? (
          skillsStore && typeof onSkillsChange === 'function' ? (
            <TianshuLedgerPanel
              skillsStore={skillsStore}
              onSkillsChange={onSkillsChange}
              architecture={architecture}
            />
          ) : (
            <p className="text-xs text-amber-200/70 text-center py-8 px-2">赏罚账本未连接数据。</p>
          )
        ) : (
          <>
            {filtered.length === 0 && (
              <p className="text-xs text-sky-400/80 text-center py-8 px-2">暂无记录。开始推演后将在此显示完整链路。</p>
            )}
            {filtered.map((e, idx) => {
              const meta = TYPE_META[e.type] || TYPE_META.message;
              const body = e.body;
              return (
                <div
                  key={e.id || idx}
                  className={`rounded-lg border px-2.5 py-2 text-[11px] leading-relaxed ${meta.color}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-[10px] text-sky-400/90 shrink-0">{formatTime(e.ts)}</span>
                    <span className="text-[10px] font-bold flex items-center gap-1">
                      <span>{meta.icon}</span> {e.title || e.type}
                    </span>
                  </div>
                  {e.subtitle ? (
                    <MarkdownBlock className={`${MD_BODY} mt-1 opacity-95`}>{String(e.subtitle)}</MarkdownBlock>
                  ) : null}
                  {body != null && body !== '' && (
                    <MarkdownBlock className={`${MD_BODY} mt-1.5 break-words`}>{String(body)}</MarkdownBlock>
                  )}
                </div>
              );
            })}
            <div className="h-px shrink-0" aria-hidden />
          </>
        )}
      </div>
    </div>
  );
}

/** 生成递增 id */
let _id = 0;
export function nextLogId() {
  _id += 1;
  return `log-${Date.now()}-${_id}`;
}
