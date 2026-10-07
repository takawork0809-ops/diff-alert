import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Logo from "@/components/Logo";
import ProductForm from "./ProductForm";
import ProductCard from "./ProductCard";
import { GuideSteps } from "@/components/UsageGuide";
import WelcomeModal from "@/components/WelcomeModal";
import { FREE_PLAN_LIMIT, type MonitoredProduct } from "@/lib/types";

export const metadata = { title: "ダッシュボード | 差益レーダー" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("monitored_products")
    .select("*")
    .order("created_at", { ascending: false });

  const products = (data ?? []) as MonitoredProduct[];
  const tableMissing = !!error && error.message.includes("schema cache");
  const chances = products.filter(
    (p) => p.last_net_margin != null && p.last_net_margin >= p.target_margin
  ).length;
  const full = products.length >= FREE_PLAN_LIMIT;

  return (
    <div className="min-h-screen">
      <WelcomeModal />
      <header className="sticky top-0 z-30 border-b border-white/5 bg-navy-950/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <Logo />
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/account"
              className="hidden max-w-[16rem] truncate text-xs text-slate-400 hover:text-brand-300 sm:block"
              title="アカウント設定"
            >
              {user.email}
            </Link>
            <Link href="/dashboard/guide" className="btn-ghost">
              使い方
            </Link>
            <Link href="/dashboard/account" className="btn-ghost">
              設定
            </Link>
            <form action="/auth/signout" method="post">
              <button type="submit" className="btn-ghost">
                ログアウト
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div className="card p-4 sm:p-5">
            <p className="text-xs text-slate-400">監視中の商品</p>
            <p className="mt-1 font-num text-3xl font-black">
              {products.length}
              <span className="text-base font-bold text-slate-500"> / {FREE_PLAN_LIMIT}</span>
            </p>
          </div>
          <div className={`card p-4 sm:p-5 ${chances > 0 ? "border-brand-500/50" : ""}`}>
            <p className="text-xs text-slate-400">仕入れチャンス</p>
            <p className={`mt-1 font-num text-3xl font-black ${chances > 0 ? "text-brand-400" : ""}`}>
              {chances}
              <span className="text-base font-bold text-slate-500"> 件</span>
            </p>
          </div>
        </div>

        {tableMissing && (
          <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm text-amber-200">
            データベースの準備ができていません。<code className="rounded bg-black/30 px-1">web/supabase/monitored_products.sql</code>{" "}
            をSupabaseのSQL Editorで実行してください。
          </div>
        )}

        {products.length === 0 && !tableMissing && (
          <section className="card border-brand-500/40 p-5 sm:p-6">
            <h2 className="text-base font-black">はじめに: 商品を1つ登録してみましょう</h2>
            <p className="mb-4 mt-1 text-xs leading-relaxed text-slate-400">
              Amazonの販売価格と楽天の仕入れ価格の差を毎朝チェックし、利益が出るとメールでお知らせします。
            </p>
            <GuideSteps />
            <Link href="/dashboard/guide" className="mt-4 inline-block text-xs text-slate-400 underline hover:text-brand-300">
              詳しい使い方・純利益の計算を見る
            </Link>
          </section>
        )}

        <ProductForm disabled={full} />

        <section>
          <h2 className="mb-3 text-base font-black">登録商品</h2>
          {products.length === 0 ? (
            <div className="card p-8 text-center text-sm text-slate-400">
              まだ商品がありません。上のフォームから最初の1商品を登録しましょう。
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {products.map((p) => (
                <ProductCard key={p.id} p={p} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
