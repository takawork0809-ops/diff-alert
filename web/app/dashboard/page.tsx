import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Logo from "@/components/Logo";
import ConditionForm from "./ConditionForm";
import ConditionList from "./ConditionList";
import FoundList from "./FoundList";
import { GuideSteps } from "@/components/UsageGuide";
import WelcomeModal from "@/components/WelcomeModal";
import { getPlanInfo } from "@/lib/billing";
import type { FoundItem, WatchCondition } from "@/lib/types";

export const metadata = { title: "ダッシュボード | 差益レーダー" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 3つの読み込みは、互いに待たなくてよいので、同時に行う(画面の表示が早くなる)
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); // 直近7日分
  const [{ data, error }, { data: foundData }, plan] = await Promise.all([
    supabase.from("watch_conditions").select("*").order("created_at", { ascending: false }),
    supabase
      .from("found_items")
      .select("*")
      .gte("found_at", since)
      .order("estimated_profit", { ascending: false })
      .limit(50),
    getPlanInfo(supabase, user.id),
  ]);
  const conditions = (data ?? []) as WatchCondition[];
  const tableMissing = !!error && error.message.includes("schema cache");
  const found = (foundData ?? []) as FoundItem[];
  const keywordById = Object.fromEntries(conditions.map((c) => [c.id, c.keyword]));

  const full = conditions.length >= plan.limit;

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
            <Link href="/dashboard/billing" className="btn-ghost">
              プラン
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
            <p className="text-xs text-slate-400">登録した条件</p>
            <p className="mt-1 font-num text-3xl font-black">
              {conditions.length}
              <span className="text-base font-bold text-slate-500"> / {plan.limit}</span>
            </p>
          </div>
          <div className={`card p-4 sm:p-5 ${found.length > 0 ? "border-brand-500/50" : ""}`}>
            <p className="text-xs text-slate-400">お宝(直近7日)</p>
            <p className={`mt-1 font-num text-3xl font-black ${found.length > 0 ? "text-brand-400" : ""}`}>
              {found.length}
              <span className="text-base font-bold text-slate-500"> 件</span>
            </p>
          </div>
        </div>

        {tableMissing && (
          <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm text-amber-200">
            データベースの準備ができていません。<code className="rounded bg-black/30 px-1">web/supabase/scout.sql</code>{" "}
            をSupabaseのSQL Editorで実行してください。
          </div>
        )}

        {conditions.length === 0 && !tableMissing && (
          <section className="card border-brand-500/40 p-5 sm:p-6">
            <h2 className="text-base font-black">はじめに: 探したい商品の条件を、1つ登録してみましょう</h2>
            <p className="mb-4 mt-1 text-xs leading-relaxed text-slate-400">
              キーワードを登録すると、毎朝メルカリ・ヤフオクを自動で探し、Amazonで売ったときに利益が出る商品を、まとめてメールでお知らせします。
            </p>
            <GuideSteps />
            <Link href="/dashboard/guide" className="mt-4 inline-block text-xs text-slate-400 underline hover:text-brand-300">
              詳しい使い方・純利益の計算を見る
            </Link>
          </section>
        )}

        <ConditionForm disabled={full} />

        <FoundList items={found} conditionKeywords={keywordById} />

        <ConditionList conditions={conditions} />
      </main>
    </div>
  );
}
