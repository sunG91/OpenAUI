/**
 * 天枢测试 · 赏罚台打分 + 文字评价（用于 LLM 归因模块并迭代 skills）
 */
import { useState } from 'react';

/** @param {{ disabled?: boolean, busy?: boolean, tipsCount?: number, onSubmit?: (rating: number, comment: string) => void | Promise<void> }} props */
export function TianshuRatingPanel({ disabled = false, busy = false, tipsCount = 0, onSubmit }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  const submit = async () => {
    if (!onSubmit || rating < 1 || rating > 5) return;
    await onSubmit(rating, comment.trim());
    setRating(0);
    setComment('');
  };

  return (
    <div className="flex-shrink-0 border-t border-amber-400/35 bg-slate-950/25 px-2 py-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <div>
          <h4 className="text-[11px] font-bold text-amber-100 tracking-wide">赏罚台 · 测试评价</h4>
          <p className="text-[9px] text-amber-200/75 mt-0.5">
            推演结束后请打分；系统将分析你的反馈针对哪些模块，并沉淀为可迭代的提示词（已存 {tipsCount} 条要点）
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] text-sky-300/90 shrink-0">星级</span>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled || busy}
            onClick={() => setRating(n)}
            className={`text-lg leading-none px-0.5 rounded transition-transform ${
              rating >= n ? 'text-amber-300 scale-110 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]' : 'text-slate-600'
            } ${disabled || busy ? 'opacity-40' : 'hover:text-amber-200'}`}
            aria-label={`${n} 星`}
          >
            ★
          </button>
        ))}
        {rating > 0 && <span className="text-[10px] text-amber-200/90">{rating} / 5</span>}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        disabled={disabled || busy}
        placeholder="可选：具体吐槽或表扬（例如：天枢殿步骤太多、启元部没给打开浏览器的命令…）"
        rows={3}
        className="w-full rounded-lg border border-amber-400/30 bg-slate-950/40 px-2 py-1.5 text-[11px] text-amber-50/95 placeholder:text-amber-200/35 focus:outline-none focus:ring-1 focus:ring-amber-400/45"
      />
      <button
        type="button"
        disabled={disabled || busy || rating < 1}
        onClick={() => void submit()}
        className="w-full text-[11px] py-1.5 rounded-lg border border-amber-400/50 text-amber-100 font-medium bg-amber-950/30 hover:bg-amber-900/35 hover:border-amber-300/50 disabled:opacity-35"
      >
        {busy ? '分析中…' : '提交评价并分析模块'}
      </button>
    </div>
  );
}
