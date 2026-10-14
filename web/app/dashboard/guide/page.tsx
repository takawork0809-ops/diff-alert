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
            差益レーダーは、キーワードと最低純利益を登録しておくと、毎朝メルカリ・ヤフオクを自動で探し、Amazonで売ったときに手数料を引いても利益が出る商品を、メールでお知らせするサービスです。
          </p>
        </div>

        <section className="card p-5 sm:p-6">
          <h2 className="text-base font-black">条件を登録する(3ステップ)</h2>
          <div className="mt-4">
            <GuideSteps />
          </div>
          <p className="mt-4 text-xs leading-relaxed text-slate-400">
            ヤフオクは、「即決価格」がある出品だけが対象です。Amazonの価格は、商品名から検索して推定した目安なので、同じ商品かどうか(型番・色・容量・セット数・状態)は、必ず両方のページで見比べてください。
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
              <dt className="font-bold">今日見つかったお宝リスト</dt>
              <dd className="mt-0.5 text-xs leading-relaxed text-slate-400">
                直近7日に見つかった商品を、純利益の高い順に並べています。「仕入れ価格」は、メルカリ・ヤフオクの価格(ヤフオクは即決価格)、「Amazon推定」は、商品名から探したAmazonの価格です。
              </dd>
            </div>
            <div>
              <dt className="font-bold">探索中 / 停止中</dt>
              <dd className="mt-0.5 text-xs leading-relaxed text-slate-400">
                「探索中」の条件だけが、毎朝の自動検索の対象です。一時的にお休みしたいときは「一時停止」を押してください。
              </dd>
            </div>
            <div>
              <dt className="font-bold">お宝が見つからないとき</dt>
              <dd className="mt-0.5 text-xs leading-relaxed text-slate-400">
                最低純利益が高すぎる、キーワードが曖昧(「まとめ売り」など)、Amazonで同じ商品が見つからない、などが考えられます。キーワードを、型番や正式な商品名に近づけて、登録し直してみてください。
              </dd>
            </div>
          </dl>
        </section>

        <div className="pb-8 text-center">
          <Link href="/dashboard" className="btn-primary">
            ダッシュボードで条件を登録する
          </Link>
        </div>
      </main>
    </div>
  );
}
