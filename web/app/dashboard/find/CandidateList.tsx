"use client";

import { useFormState } from "react-dom";
import Link from "next/link";
import { addProduct, type FormState } from "../actions";
import { CATEGORY_LABELS, type Category } from "@/lib/types";
import type { RakutenCandidate } from "@/lib/rakuten-search";

const initial: FormState = { ok: false, message: "" };
const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

export default function CandidateList({
  asin,
  items,
  cheapestFirst,
  disabled,
}: {
  asin: string;
  items: RakutenCandidate[];
  cheapestFirst: boolean;
  disabled: boolean;
}) {
  const [state, formAction] = useFormState(addProduct, initial);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="asin" value={asin} />

      <div className="card grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
        <div>
          <label htmlFor="target_margin" className="label">
            目標純利益(円)
          </label>
          <input id="target_margin" name="target_margin" type="number" min={0} step={1} defaultValue={1000} required className="input font-num" />
        </div>
        <div>
          <label htmlFor="category" className="label">
            カテゴリ
          </label>
          <select id="category" name="category" defaultValue="other" className="input">
            {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <p className="text-[11px] leading-relaxed text-slate-500 sm:col-span-2">
          下の候補の「この商品で登録」を押すと、ここの目標純利益とカテゴリで、登録されます。同じ商品かどうか(型番・色・サイズ・セット数)を、必ず、楽天のページで確認してください。
        </p>
      </div>

      {state.message && (
        <p
          role="status"
          className={`rounded-lg px-3 py-2 text-sm ${state.ok ? "bg-brand-500/10 text-brand-300" : "bg-red-500/10 text-red-300"}`}
        >
          {state.message}
          {state.ok && (
            <Link href="/dashboard" className="ml-2 underline">
              ダッシュボードを見る
            </Link>
          )}
        </p>
      )}

      <ul className="space-y-3">
        {items.map((it, i) => (
          <li key={`${it.itemCode}-${i}`} className="card flex gap-3 p-3 sm:gap-4 sm:p-4">
            {it.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={it.imageUrl} alt="" width={80} height={80} loading="lazy" className="h-20 w-20 shrink-0 rounded-lg bg-white object-contain" />
            ) : (
              <div className="h-20 w-20 shrink-0 rounded-lg bg-navy-800" aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-bold leading-snug">{it.name}</p>
              <p className="mt-1 text-xs text-slate-400">
                {it.shopName}
                {it.pointRate ? <span className="ml-2 text-amber-300">ポイント{it.pointRate}倍</span> : null}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="font-num text-lg font-black">{yen(it.price)}</span>
                {cheapestFirst && i === 0 && <span className="rounded-full bg-brand-500/15 px-2 py-0.5 text-[11px] font-bold text-brand-300">最安</span>}
                <a href={it.url} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-400 underline hover:text-brand-300">
                  楽天で見る ↗
                </a>
                <button type="submit" name="rakuten_url" value={it.url} disabled={disabled} className="btn-primary ml-auto px-4 py-2 text-xs">
                  この商品で登録
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </form>
  );
}
