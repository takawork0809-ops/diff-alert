import { deleteCondition, toggleCondition } from "./actions";
import { CATEGORY_LABELS, type WatchCondition } from "@/lib/types";
import { SOURCE_LABELS } from "@/lib/watch-conditions";

export default function ConditionList({ conditions }: { conditions: WatchCondition[] }) {
  return (
    <section>
      <h2 className="mb-3 text-base font-black">登録した条件</h2>
      {conditions.length === 0 ? (
        <div className="card p-6 text-center text-sm text-slate-400">
          まだ条件がありません。上のフォームから、最初の条件を登録しましょう。
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {conditions.map((c) => (
            <li key={c.id} className={`card p-4 ${c.is_active ? "" : "opacity-60"}`} data-testid="condition-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{c.keyword}</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    最低純利益 ¥{c.min_profit.toLocaleString("ja-JP")} ・ {c.sources.map((s) => SOURCE_LABELS[s]).join("・")} ・{" "}
                    {CATEGORY_LABELS[c.category].split(" ")[0]}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    c.is_active ? "bg-brand-500/15 text-brand-300" : "bg-slate-500/15 text-slate-300"
                  }`}
                >
                  {c.is_active ? "探索中" : "停止中"}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-end gap-4 text-xs text-slate-500">
                <form action={toggleCondition}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="next" value={String(!c.is_active)} />
                  <button type="submit" className="transition hover:text-brand-300">
                    {c.is_active ? "一時停止" : "再開"}
                  </button>
                </form>
                <form action={deleteCondition}>
                  <input type="hidden" name="id" value={c.id} />
                  <button type="submit" className="transition hover:text-red-300">
                    削除
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
