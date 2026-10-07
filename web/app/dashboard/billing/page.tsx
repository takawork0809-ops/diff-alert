import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Logo from "@/components/Logo";
import { getPlanInfo } from "@/lib/billing";
import { PAID_PLAN_IDS, PLANS, billingConfigured, yen } from "@/lib/plans";

export const metadata = { title: "プラン・お支払い | 差益レーダー" };
export const dynamic = "force-dynamic";

const STATUS_MESSAGES: Record<string, { tone: "ok" | "warn"; text: string }> = {
  success: { tone: "ok", text: "お申し込みありがとうございます。プランの反映までに、数十秒かかることがあります。表示が変わらない場合は、ページを再読み込みしてください。" },
  cancel: { tone: "warn", text: "お申し込みはキャンセルされました。料金は発生していません。" },
  already: { tone: "warn", text: "すでに有料プランをご契約中です。プランの変更・解約は「お支払いの管理」から行えます。" },
  unavailable: { tone: "warn", text: "決済の準備中です。しばらくしてからお試しください。" },
  error: { tone: "warn", text: "処理に失敗しました。時間をおいて、もう一度お試しください。" },
};

export default async function BillingPage({ searchParams }: { searchParams: { status?: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const info = await getPlanInfo(supabase, user.id);
  const { count } = await supabase.from("monitored_products").select("id", { count: "exact", head: true });
  const used = count ?? 0;
  const ready = billingConfigured();
  const notice = searchParams.status ? STATUS_MESSAGES[searchParams.status] : undefined;
  const sub = info.subscription;
  const periodEnd = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })
    : null;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-white/5 bg-navy-950/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/dashboard">
            <Logo />
          </Link>
          <form action="/auth/signout" method="post">
            <button type="submit" className="btn-ghost">
              ログアウト
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        <Link href="/dashboard" className="text-sm text-slate-400 hover:text-brand-300">
          ← ダッシュボードに戻る
        </Link>

        {notice && (
          <p
            role="status"
            className={`rounded-lg px-3 py-2 text-sm ${
              notice.tone === "ok" ? "bg-brand-500/10 text-brand-300" : "bg-amber-400/10 text-amber-200"
            }`}
          >
            {notice.text}
          </p>
        )}

        <section className="card p-5 sm:p-6">
          <h1 className="text-base font-black">現在のプラン</h1>
          <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-2xl font-black">{info.name}</span>
            <span className="text-sm text-slate-400">
              監視中 <span className="font-num text-slate-100">{used}</span> / {info.limit} 商品
            </span>
          </p>
          {sub && info.plan !== "free" && periodEnd && (
            <p className="mt-2 text-xs text-slate-400">
              {sub.cancel_at_period_end
                ? `${periodEnd} までご利用いただけます(以降は自動更新されません)。`
                : `次回の更新日: ${periodEnd}`}
            </p>
          )}
          {sub?.status === "past_due" && (
            <p className="mt-2 text-xs text-amber-300">お支払いの確認ができていません。「お支払いの管理」から、支払い方法をご確認ください。</p>
          )}
          {info.plan !== "free" && sub?.stripe_customer_id && (
            <form action="/api/stripe/portal" method="post" className="mt-4">
              <button type="submit" className="btn-ghost" disabled={!ready}>
                お支払いの管理(支払い方法・プラン変更・解約)
              </button>
            </form>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-base font-black">プラン一覧</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {[PLANS.free, ...PAID_PLAN_IDS.map((id) => PLANS[id])].map((p) => {
              const current = p.id === info.plan;
              return (
                <div
                  key={p.id}
                  className={`flex flex-col rounded-2xl border p-5 ${
                    current ? "border-brand-500/60 bg-navy-800/80" : "border-white/10 bg-navy-900/60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold">{p.name}</h3>
                    {current && (
                      <span className="rounded-full bg-brand-500 px-2 py-0.5 text-[11px] font-black text-navy-950">ご利用中</span>
                    )}
                  </div>
                  <p className="mt-3 flex items-baseline gap-1">
                    <span className="font-num text-3xl font-black">{yen(p.price)}</span>
                    {p.price > 0 && <span className="text-xs text-slate-400">/月(税込)</span>}
                  </p>
                  <p className="mt-1 text-sm font-bold text-brand-300">監視 {p.limit}商品まで</p>
                  <ul className="mt-4 flex-1 space-y-1.5 text-xs text-slate-300">
                    {p.features.map((f) => (
                      <li key={f} className="flex gap-2">
                        <span className="text-brand-400">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  {p.id !== "free" && !current && info.plan === "free" && (
                    <form action="/api/stripe/checkout" method="post" className="mt-5">
                      <input type="hidden" name="plan" value={p.id} />
                      <button type="submit" className="btn-primary w-full" disabled={!ready}>
                        {p.name}で申し込む
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
          {!ready && (
            <p className="mt-4 text-xs text-slate-500">決済機能は準備中です。公開までしばらくお待ちください。</p>
          )}
          <p className="mt-4 text-xs leading-relaxed text-slate-500">
            お支払いにはクレジットカードをご利用いただけます(決済はStripeが安全に処理します)。有料プランはいつでも解約でき、解約後も、お支払い済みの期間の終わりまでご利用いただけます。
          </p>
        </section>
      </main>
    </div>
  );
}
