import { deleteProduct } from "./actions";
import CountUp from "@/components/CountUp";
import type { MonitoredProduct } from "@/lib/types";

const yen = (n: number | null) => (n == null ? "—" : `¥${n.toLocaleString("ja-JP")}`);

function formatChecked(iso: string | null): string {
  if (!iso) return "未チェック";
  return new Date(iso).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ProductCard({ p }: { p: MonitoredProduct }) {
  const checked = p.last_net_margin != null;
  const chance = checked && p.last_net_margin! >= p.target_margin;
  const net = p.last_net_margin;

  return (
    <article
      className={`card p-5 transition ${chance ? "border-brand-500/50 shadow-glow" : ""}`}
      data-testid="product-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-sm font-bold leading-snug">
            {p.product_name ?? "商品名は次回のチェックで取得されます"}
          </h3>
          <p className="mt-1 font-num text-[11px] text-slate-500">
            ASIN {p.asin} ・ 目標 {yen(p.target_margin)}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
            !checked
              ? "bg-slate-500/15 text-slate-300"
              : chance
              ? "bg-brand-500/15 text-brand-300"
              : "bg-red-500/10 text-red-300"
          }`}
        >
          {!checked ? "⏳ 未チェック" : chance ? "✅ チャンスあり" : "❌ 待機中"}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-navy-800/70 p-2.5">
          <dt className="text-[10px] text-slate-400">Amazon</dt>
          <dd className="mt-0.5 font-num text-sm font-bold">{yen(p.last_amazon_price)}</dd>
        </div>
        <div className="rounded-lg bg-navy-800/70 p-2.5">
          <dt className="text-[10px] text-slate-400">楽天</dt>
          <dd className="mt-0.5 font-num text-sm font-bold">{yen(p.last_rakuten_price)}</dd>
        </div>
        <div className={`rounded-lg p-2.5 ${chance ? "bg-brand-500/15" : "bg-navy-800/70"}`}>
          <dt className="text-[10px] text-slate-400">純利益</dt>
          <dd
            className={`mt-0.5 font-num text-sm font-extrabold ${
              net == null ? "" : net >= 0 ? "text-brand-400" : "text-red-300"
            }`}
          >
            {net == null ? (
              "—"
            ) : (
              <CountUp value={Math.abs(net)} prefix={net >= 0 ? "+¥" : "-¥"} />
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-500">
        <span>最終チェック: {formatChecked(p.last_checked_at)}</span>
        <div className="flex items-center gap-3">
          <a href={p.rakuten_url} target="_blank" rel="noreferrer" className="hover:text-brand-300">
            楽天ページ ↗
          </a>
          <form action={deleteProduct}>
            <input type="hidden" name="id" value={p.id} />
            <button type="submit" className="text-slate-500 transition hover:text-red-300">
              削除
            </button>
          </form>
        </div>
      </div>
    </article>
  );
}
