import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Logo from "@/components/Logo";
import { GuideFormula, GuideHow, GuideSteps } from "@/components/UsageGuide";

export const metadata = { title: "使い方 | 差益レーダー" };
export const dynamic = "force-dynamic";

export default async function GuidePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

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

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
        <Link href="/dashboard" className="text-sm text-slate-400 hover:text-brand-300">
          ← ダッシュボードに戻る
        </Link>

        <div>
          <h1 className="text-2xl font-black">使い方</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            差益レーダーは、Amazonで売れる価格と、楽天で仕入れられる価格の差を毎朝チェックして、手数料を引いても利益が出るタイミングをメールでお知らせするサービスです。
          </p>
        </div>

        <section className="card p-5 sm:p-6">
          <h2 className="text-base font-black">商品を登録する(3ステップ)</h2>
          <div className="mt-4">
            <GuideSteps />
          </div>
          <p className="mt-4 text-xs leading-relaxed text-slate-400">
            ASINが分からないときは、Amazonの商品ページの「登録情報」(商品の詳細)にも、ASINが載っています。同じ商品かどうか(型番・色・容量・セット数)は、必ず両方のページで見比べてください。
          </p>
        </section>

        <section className="card p-5 sm:p-6">
          <h2 className="text-base font-black">登録したあとの流れ</h2>
          <div className="mt-4">
            <GuideHow />
          </div>
        </section>

        <section className="card p-5 sm:p-6">
          <h2 className="text-base font-black">純利益の計算</h2>
          <div className="mt-4">
            <GuideFormula />
          </div>
        </section>

        <section className="card p-5 sm:p-6">
          <h2 className="text-base font-black">画面の見方</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="font-bold">仕入れチャンス</dt>
              <dd className="mt-0.5 text-xs leading-relaxed text-slate-400">
                純利益が目標以上になっている商品の数です。カードには「✅ チャンスあり」と表示されます。目標に届いていない商品は「❌ 待機中」、まだ価格を取得していない商品は「⏳ 未チェック」です。
              </dd>
            </div>
            <div>
              <dt className="font-bold">「⏳ 未チェック」のカード(価格が「—」)</dt>
              <dd className="mt-0.5 text-xs leading-relaxed text-slate-400">
                まだ価格を取得していません。登録の翌朝までに、自動でチェックされます。
              </dd>
            </div>
            <div>
              <dt className="font-bold">価格が更新されないとき</dt>
              <dd className="mt-0.5 text-xs leading-relaxed text-slate-400">
                ページの構成が変わった、在庫切れ、ASINやURLの入力ミスが考えられます。一度削除して、入力し直してみてください。
              </dd>
            </div>
          </dl>
        </section>

        <div className="pb-8 text-center">
          <Link href="/dashboard" className="btn-primary">
            ダッシュボードで商品を登録する
          </Link>
        </div>
      </main>
    </div>
  );
}
