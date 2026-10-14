"use client";

import { useState, useTransition } from "react";
import { deleteCondition, toggleCondition } from "./actions";
import { CATEGORY_LABELS, type WatchCondition } from "@/lib/types";
import { SOURCE_LABELS } from "@/lib/watch-conditions";

// 一時停止・削除は、サーバーの処理を待たずに画面を先に更新する(通信の往復で、押してから数秒かかることがあるため)。
// サーバーの処理が終わって、最新のデータが届いたら、仮の表示は取り除く。
export default function ConditionList({ conditions }: { conditions: WatchCondition[] }) {
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [activeOverride, setActiveOverride] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();

  function onDelete(id: string) {
    setRemoved((prev) => new Set(prev).add(id));
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      try {
        await deleteCondition(fd);
      } finally {
        // 失敗したときは、最新のデータで元の表示に戻る
        setRemoved((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    });
  }

  function onToggle(id: string, next: boolean) {
    setActiveOverride((prev) => ({ ...prev, [id]: next }));
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      fd.set("next", String(next));
      try {
        await toggleCondition(fd);
      } finally {
        setActiveOverride((prev) => {
          const rest = { ...prev };
          delete rest[id];
          return rest;
        });
      }
    });
  }

  const visible = conditions.filter((c) => !removed.has(c.id));

  return (
    <section>
      <h2 className="mb-3 text-base font-black">登録した条件</h2>
      {visible.length === 0 ? (
        <div className="card p-6 text-center text-sm text-slate-400">
          まだ条件がありません。上のフォームから、最初の条件を登録しましょう。
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {visible.map((c) => {
            const isActive = activeOverride[c.id] ?? c.is_active;
            return (
              <li key={c.id} className={`card p-4 transition ${isActive ? "" : "opacity-60"}`} data-testid="condition-card">
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
                      isActive ? "bg-brand-500/15 text-brand-300" : "bg-slate-500/15 text-slate-300"
                    }`}
                  >
                    {isActive ? "探索中" : "停止中"}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-end gap-4 text-xs text-slate-500">
                  <button type="button" onClick={() => onToggle(c.id, !isActive)} className="transition hover:text-brand-300">
                    {isActive ? "一時停止" : "再開"}
                  </button>
                  <button type="button" onClick={() => onDelete(c.id)} className="transition hover:text-red-300">
                    削除
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
