import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Logo from "@/components/Logo";
import { getPlanInfo } from "@/lib/billing";
import { extractAsin } from "@/lib/bulk-parse";
import { buildSearchKeyword, normalizeJan } from "@/lib/search-keyword";
import { rakutenConfigured, searchRakutenItems } from "@/lib/rakuten-search";
import BookmarkletButton from "./BookmarkletButton";
import CandidateList from "./CandidateList";

export const metadata = { title: "楽天の仕入れ候補を探す | 差益レーダー" };
export const dynamic = "force-dynamic";

type Params = { asin?: string; title?: string; jan?: string; q?: string; sort?: string };

export default async function FindPage({ searchParams }: { searchParams: Params }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const asin = extractAsin(searchParams.asin ?? "");
  const title = (searchParams.title ?? "").slice(0, 200);
  const jan = searchParams.jan ? normalizeJan(searchParams.jan) : null;
  const typedQuery = (searchParams.q ?? "").trim().slice(0, 128);
  // 検索語は、入力があればそれを、なければJAN、なければ商品名から作る
  const query = typedQuery || jan || buildSearchKeyword(title);
  const cheapestFirst = searchParams.sort === "price";

  const configured = rakutenConfigured();
  const search = asin && query && configured ? await searchRakutenItems(query, cheapestFirst ? "+itemPrice" : "standard") : null;

  const plan = await getPlanInfo(supabase, user.id);
  const { count } = await supabase.from("monitored_products").select("id", { count: "exact", head: true });
  const full = (count ?? 0) >= plan.limit;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-white/5 bg-navy-950/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/dashboard">
            <Logo />
          </Link>
          <Link href="/dashboard" className="btn-ghost">
            ダッシュボード
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
        <div>
          <h1 className="text-xl font-black">楽天の仕入れ候補を探す</h1>
          <p className="mt-1 text-sm text-slate-400">Amazonの商品ページから、同じ商品を売っている楽天の店を、価格つきで探します。</p>
        </div>

        {!asin && (
          <>
            <section className="card space-y-4 p-5 sm:p-6">
              <h2 className="text-base font-black">使い方(ブックマークの追加は、最初の1回だけ)</h2>
              <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-300">
                <li>下の「差益レーダーに追加」のボタンを、ブラウザの<strong>ブックマークバーに、ドラッグ</strong>して追加します。(ブックマークバーが見えないときは、Chrome は <span className="font-num">Cmd/Ctrl + Shift + B</span>、Safari は「表示 → お気に入りバーを表示」を選びます。)</li>
                <li>AmazonのURL(amazon.co.jp)の商品ページを開きます。</li>
                <li>追加したブックマークを、クリックします。この画面が開いて、楽天の候補が、価格つきで、表示されます。</li>
              </ol>
              <div className="flex flex-wrap items-center gap-3">
                <BookmarkletButton />
                <span className="text-xs text-slate-500">↑ ここを、ブックマークバーへ、ドラッグ</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">
                このブックマークは、いま開いているAmazonのページの、ASIN・商品名・JANを読み取って、この画面を開くだけです。ログイン情報やクッキーは、読み取りません。
              </p>
            </section>

            <section className="card p-5 sm:p-6">
              <h2 className="text-base font-black">ブックマークを使わずに探す</h2>
              <form method="get" className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="asin" className="label">
                    ASIN または AmazonのURL
                  </label>
                  <input id="asin" name="asin" required className="input font-num" placeholder="B0CPL68SZN" autoComplete="off" />
                </div>
                <div>
                  <label htmlFor="q" className="label">
                    楽天で探す言葉(商品名など)
                  </label>
                  <input id="q" name="q" required className="input" placeholder="例: ブリタ マクストラプロ" autoComplete="off" />
                </div>
                <div className="sm:col-span-2">
                  <button type="submit" className="btn-primary">
                    探す
                  </button>
                </div>
              </form>
            </section>
          </>
        )}

        {asin && (
          <section className="card space-y-3 p-4 sm:p-5">
            <p className="text-xs text-slate-400">
              Amazonの商品: <span className="font-num text-slate-200">{asin}</span>
            </p>
            {title && <p className="line-clamp-2 text-sm font-bold">{title}</p>}
            {jan && <p className="text-xs text-slate-400">JANコード: <span className="font-num text-slate-200">{jan}</span>(検索語に使います)</p>}
            <form method="get" className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
              <input type="hidden" name="asin" value={asin} />
              {title && <input type="hidden" name="title" value={title} />}
              {jan && <input type="hidden" name="jan" value={jan} />}
              <div>
                <label htmlFor="q" className="label">
                  楽天で探す言葉(変えて、探し直せます)
                </label>
                <input id="q" name="q" defaultValue={query} className="input" maxLength={128} autoComplete="off" />
              </div>
              <div>
                <label htmlFor="sort" className="label">
                  並び順
                </label>
                <select id="sort" name="sort" defaultValue={cheapestFirst ? "price" : "standard"} className="input">
                  <option value="standard">おすすめ順</option>
                  <option value="price">価格の安い順</option>
                </select>
              </div>
              <button type="submit" className="btn-primary">
                探し直す
              </button>
            </form>
          </section>
        )}

        {asin && !configured && (
          <p role="status" className="rounded-lg bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
            楽天の検索は、準備中です。しばらくお待ちください。
          </p>
        )}

        {search && !search.ok && (
          <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {search.message}
          </p>
        )}

        {search?.ok && search.items.length === 0 && (
          <p className="card p-5 text-sm text-slate-300">
            「{query}」では、候補が見つかりませんでした。言葉を短くしたり、商品名の一部に変えたりして、探し直してみてください。
          </p>
        )}

        {search?.ok && search.items.length > 0 && asin && (
          <>
            <p className="text-xs text-slate-400">
              「{query}」の検索結果(上位{search.items.length}件 / 全{search.total.toLocaleString("ja-JP")}件)
              {full && <span className="ml-2 text-amber-300">監視の上限に達しているため、登録できません。</span>}
            </p>
            <CandidateList asin={asin} items={search.items} cheapestFirst={cheapestFirst} disabled={full} />
          </>
        )}

        {asin && configured && (
          <p className="text-center text-[11px] text-slate-600">
            <a href="https://webservice.rakuten.co.jp/" target="_blank" rel="noopener noreferrer" className="hover:text-slate-400">
              Supported by Rakuten Developers
            </a>
          </p>
        )}
      </main>
    </div>
  );
}
