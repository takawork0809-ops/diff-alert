import Link from "next/link";
import Logo from "@/components/Logo";
import CountUp from "@/components/CountUp";
import { PLANS, yen } from "@/lib/plans";
import SiteFooter from "@/components/SiteFooter";

const problems = [
  {
    icon: "🔍",
    title: "Keepaだけでは仕入れ価格がわからない",
    body: "Amazonの価格推移は見えても、楽天でいくらで仕入れられるかは別画面。毎回2つのサイトを行き来していませんか？",
  },
  {
    icon: "👀",
    title: "手動チェックでは見逃しが出る",
    body: "商品が増えるほど、全部を毎日見るのは不可能に。チャンスは気づかないうちに通り過ぎていきます。",
  },
  {
    icon: "⏰",
    title: "セール終了後に気づいても手遅れ",
    body: "楽天のセールやポイント倍率は一瞬。気づいたときには、利益の出る価格はもう戻りません。",
  },
];

const steps = [
  {
    n: "01",
    title: "商品を登録",
    body: "監視したい商品のASINと楽天URLを登録します。目標の純利益も設定できます。",
  },
  {
    n: "02",
    title: "毎朝、自動で価格を取得",
    body: "Amazon×楽天の最新価格を毎朝自動で取得。あなたが寝ている間に監視が終わります。",
  },
  {
    n: "03",
    title: "プラスになったらメール通知",
    body: "手数料込みの純利益が目標を超えた商品だけを、すぐにメールでお知らせします。",
  },
];

const compare = [
  { label: "見られる価格", keepa: "Amazon内の価格履歴のみ", ours: "Amazon販売価格 vs 楽天仕入れ価格を連動" },
  { label: "利益の計算", keepa: "手数料計算なし", ours: "FBA手数料・Amazon手数料込みの純利益を計算" },
  { label: "チャンスの発見", keepa: "自分でグラフを見て判断", ours: "目標を超えた瞬間にメール通知" },
];

const plans = [PLANS.free, PLANS.standard, PLANS.pro].map((p) => ({
  name: p.name,
  price: yen(p.price),
  per: p.price > 0 ? "/月(税込)" : "",
  items: `監視 ${p.limit}商品まで`,
  features: p.features,
  cta: "無料で始める",
  highlight: p.id === "standard",
}));

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-navy-950/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="flex items-center gap-2 sm:gap-4">
            <a href="#pricing" className="hidden text-sm text-slate-300 hover:text-white sm:block">
              料金
            </a>
            <Link href="/login" className="btn-ghost">
              ログイン
            </Link>
            <Link href="/signup" className="btn-primary hidden px-4 py-2 text-sm sm:inline-flex">
              無料で始める
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -top-32 left-1/2 h-[28rem] w-[56rem] -translate-x-1/2 rounded-full bg-brand-500/15 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-2 lg:pb-28 lg:pt-24">
          <div className="animate-fadeUp">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-xs font-bold text-brand-300">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
              寝ている間に仕入れチャンスを見つける
            </p>
            <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              仕入れチャンスを、
              <br />
              <span className="bg-gradient-to-r from-brand-300 to-brand-500 bg-clip-text text-transparent">見逃すな。</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
              Amazon×楽天の差益をリアルタイム監視。
              <br className="hidden sm:block" />
              純利益がプラスになった瞬間、即メール通知。
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/signup" className="btn-primary px-8 py-4 text-lg">
                無料で始める
              </Link>
              <a href="#how" className="text-sm font-medium text-slate-400 hover:text-white">
                仕組みを見る ↓
              </a>
            </div>
            <p className="mt-4 text-xs text-slate-500">クレジットカード不要 ・ 監視3商品まで無料</p>
          </div>

          {/* Mock card */}
          <div className="relative animate-fadeUp [animation-delay:150ms]">
            <div className="card animate-floaty p-5 shadow-2xl shadow-black/40 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-400">Fire TV Stick 4K Max 第2世代</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">ASIN B0G2TXBSWJ ・ 毎朝6:00 更新</p>
                </div>
                <span className="shrink-0 rounded-full bg-brand-500/15 px-3 py-1 text-xs font-bold text-brand-300">✅ チャンスあり</span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-navy-800/80 p-3">
                  <p className="text-[11px] text-slate-400">Amazon販売価格</p>
                  <p className="mt-1 font-num text-xl font-extrabold">
                    <CountUp value={15980} prefix="¥" />
                  </p>
                </div>
                <div className="rounded-xl bg-navy-800/80 p-3">
                  <p className="text-[11px] text-slate-400">楽天仕入れ価格</p>
                  <p className="mt-1 font-num text-xl font-extrabold">
                    <CountUp value={12320} prefix="¥" />
                  </p>
                </div>
              </div>
              <div className="mt-3 rounded-xl border border-brand-500/30 bg-brand-500/10 p-4">
                <p className="text-[11px] text-brand-300">手数料込みの純利益</p>
                <p className="mt-1 font-num text-4xl font-black text-brand-400">
                  <CountUp value={1882} prefix="+¥" />
                </p>
                <p className="mt-1 text-[11px] text-slate-400">Amazon手数料8% + FBA手数料¥500を差し引いた金額</p>
              </div>
            </div>
            <p className="mt-3 text-center text-[11px] text-slate-500">※表示は画面イメージです</p>
          </div>
        </div>
      </section>

      {/* Problems */}
      <section className="border-y border-white/5 bg-navy-900/40 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-black sm:text-3xl">こんな悩み、ありませんか？</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {problems.map((p) => (
              <div key={p.title} className="card p-6 transition hover:border-brand-500/40">
                <p className="text-3xl">{p.icon}</p>
                <h3 className="mt-4 text-lg font-bold leading-snug">{p.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-center text-sm font-bold text-brand-400">HOW IT WORKS</p>
          <h2 className="mt-2 text-center text-2xl font-black sm:text-3xl">3ステップで、監視は自動化</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n} className="relative rounded-2xl border border-white/10 bg-gradient-to-b from-navy-800/70 to-navy-900/70 p-6">
                <span className="font-num text-5xl font-black text-brand-500/25">{s.n}</span>
                <h3 className="mt-2 text-lg font-bold">{s.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Compare */}
      <section className="border-y border-white/5 bg-navy-900/40 py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-black sm:text-3xl">Keepaとの違い</h2>
          <p className="mt-3 text-center text-sm text-slate-400">価格履歴ツールではなく、「仕入れて儲かるか」を判断するためのツールです。</p>
          <div className="mt-10 overflow-hidden rounded-2xl border border-white/10">
            <div className="grid grid-cols-[0.8fr_1fr_1.3fr] bg-navy-800/80 text-xs font-bold sm:text-sm">
              <div className="p-3 sm:p-4" />
              <div className="p-3 text-slate-400 sm:p-4">Keepa</div>
              <div className="p-3 text-brand-300 sm:p-4">差益レーダー</div>
            </div>
            {compare.map((row) => (
              <div key={row.label} className="grid grid-cols-[0.8fr_1fr_1.3fr] border-t border-white/10 text-xs sm:text-sm">
                <div className="bg-navy-900/60 p-3 font-bold text-slate-300 sm:p-4">{row.label}</div>
                <div className="p-3 text-slate-400 sm:p-4">{row.keepa}</div>
                <div className="bg-brand-500/5 p-3 font-medium text-white sm:p-4">
                  <span className="mr-1 text-brand-400">✓</span>
                  {row.ours}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-center text-sm font-bold text-brand-400">PRICING</p>
          <h2 className="mt-2 text-center text-2xl font-black sm:text-3xl">料金プラン</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {plans.map((p) => (
              <div
                key={p.name}
                className={`relative flex flex-col rounded-2xl border p-6 ${
                  p.highlight ? "border-brand-500/60 bg-navy-800/80 shadow-glow" : "border-white/10 bg-navy-900/60"
                }`}
              >
                {p.highlight && (
                  <span className="absolute -top-3 left-6 rounded-full bg-brand-500 px-3 py-0.5 text-xs font-black text-navy-950">人気</span>
                )}
                <h3 className="text-lg font-bold">{p.name}</h3>
                <p className="mt-4 flex items-baseline gap-1">
                  <span className="font-num text-4xl font-black">{p.price}</span>
                  <span className="text-sm text-slate-400">{p.per}</span>
                </p>
                <p className="mt-2 text-sm font-bold text-brand-300">{p.items}</p>
                <ul className="mt-5 flex-1 space-y-2 text-sm text-slate-300">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="text-brand-400">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/signup" className={`mt-6 ${p.highlight ? "btn-primary" : "btn-ghost"}`}>
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-slate-500">まずは無料プランでお試しください。有料プランは、ログイン後の「プラン」からお申し込みいただけます。いつでも解約できます。</p>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-24 sm:px-6">
        <div className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl border border-brand-500/30 bg-gradient-to-br from-navy-800 to-navy-900 p-10 text-center sm:p-14">
          <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand-500/20 blur-3xl" />
          <h2 className="relative text-2xl font-black sm:text-4xl">明日の朝には、最初のチャンスが届くかもしれません。</h2>
          <p className="relative mt-4 text-slate-300">登録は30秒。まずは3商品、無料で監視を始めましょう。</p>
          <Link href="/signup" className="btn-primary relative mt-8 px-10 py-4 text-lg">
            今すぐ無料で始める
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
