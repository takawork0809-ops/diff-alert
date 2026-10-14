import { SOURCE_LABELS } from "@/lib/watch-conditions";
import type { FoundItem } from "@/lib/types";

const yen = (n: number | null) => (n == null ? "—" : `¥${n.toLocaleString("ja-JP")}`);

function formatFound(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function FoundList({ items, conditionKeywords }: { items: FoundItem[]; conditionKeywords: Record<string, string> }) {
  return (
    <section>
      <h2 className="mb-1 text-base font-black">今日見つかったお宝リスト</h2>
      <p className="mb-3 text-xs text-slate-500">
        直近で見つかった商品を、純利益の高い順に表示します。Amazonの価格は、検索結果から推定した目安です。仕入れる前に、同じ商品か(型番・状態・セット内容)を必ず確認してください。
      </p>
      {items.length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-400">
          まだお宝は見つかっていません。条件を登録すると、毎朝の自動検索で、条件に合う商品がここに並びます。
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {items.map((it) => (
            <li key={it.id} className="card border-brand-500/40 p-5" data-testid="found-card">
              <div className="flex items-start justify-between gap-3">
                <h3 className="line-clamp-2 text-sm font-bold leading-snug">{it.item_title}</h3>
                <span className="shrink-0 rounded-full bg-brand-500/15 px-3 py-1 text-xs font-bold text-brand-300">
                  {SOURCE_LABELS[it.source]}
                </span>
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-navy-800/70 p-2.5">
                  <dt className="text-[10px] text-slate-400">仕入れ価格</dt>
                  <dd className="mt-0.5 font-num text-sm font-bold">{yen(it.item_price)}</dd>
                </div>
                <div className="rounded-lg bg-navy-800/70 p-2.5">
                  <dt className="text-[10px] text-slate-400">Amazon推定</dt>
                  <dd className="mt-0.5 font-num text-sm font-bold">{yen(it.amazon_price)}</dd>
                </div>
                <div className="rounded-lg bg-brand-500/15 p-2.5">
                  <dt className="text-[10px] text-slate-400">純利益</dt>
                  <dd className="mt-0.5 font-num text-sm font-extrabold text-brand-400">+{yen(it.estimated_profit)}</dd>
                </div>
              </dl>
              {it.amazon_title && (
                <p className="mt-3 line-clamp-1 text-[11px] text-slate-500">照合したAmazon商品: {it.amazon_title}</p>
              )}
              <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                <span className="truncate">
                  {conditionKeywords[it.condition_id] ? `条件「${conditionKeywords[it.condition_id]}」 ・ ` : ""}
                  {formatFound(it.found_at)}
                </span>
                <div className="flex shrink-0 items-center gap-3">
                  {it.amazon_asin && (
                    <a
                      href={`https://www.amazon.co.jp/dp/${it.amazon_asin}`}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-brand-300"
                    >
                      Amazon ↗
                    </a>
                  )}
                  <a href={it.item_url} target="_blank" rel="noreferrer" className="font-bold text-brand-300 hover:underline">
                    商品ページ ↗
                  </a>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
