import { PLANS } from "@/lib/plans";

// 使い方の説明パーツ。空状態・ウェルカム画面・使い方ページで共通して使う(状態を持たないので Server/Client どちらからでも読み込める)。

const STEPS = [
  {
    title: "AmazonのURLかASINを用意",
    body: "Amazonの商品ページのURLを、そのまま貼れます。ASIN(URLの「/dp/」の後ろの10桁)でも構いません。",
    example: "amazon.co.jp/dp/B0CPL68SZN → B0CPL68SZN",
  },
  {
    title: "同じ商品の楽天URLを貼る",
    body: "仕入れ先になる、楽天市場の同じ商品のページのURLを貼り付けます。",
    example: "https://item.rakuten.co.jp/shop/item/",
  },
  {
    title: "目標純利益を決めて登録",
    body: "手数料を引いた後に、最低いくら残ってほしいかを円で入力し、カテゴリを選びます。",
    example: "目標純利益 1,000円 / カテゴリ その他",
  },
];

export function GuideSteps() {
  return (
    <ol className="grid gap-3 md:grid-cols-3">
      {STEPS.map((s, i) => (
        <li key={s.title} className="rounded-xl border border-white/10 bg-navy-800/50 p-4">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 font-num text-sm font-black text-navy-950">
            {i + 1}
          </span>
          <p className="mt-3 text-sm font-bold">{s.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">{s.body}</p>
          <p className="mt-2 break-all rounded-md bg-black/30 px-2 py-1 font-num text-[11px] text-brand-300">
            {s.example}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function GuideHow() {
  return (
    <ul className="space-y-2 text-sm leading-relaxed text-slate-300">
      <li>
        <span className="mr-1 text-brand-400">●</span>
        登録した商品は、<strong className="text-white">毎朝6時ごろ</strong>に、Amazonの販売価格と楽天の仕入れ価格を自動でチェックします。
      </li>
      <li>
        <span className="mr-1 text-brand-400">●</span>
        手数料を引いた<strong className="text-white">純利益が目標以上</strong>になると、登録したメールアドレスにお知らせが届きます(同じ状態が続く間は、毎日は送りません)。
      </li>
      <li>
        <span className="mr-1 text-brand-400">●</span>
        価格はダッシュボードのカードにも表示されます。登録直後は、次回のチェック後に数字が入ります。
      </li>
      <li>
        <span className="mr-1 text-brand-400">●</span>
        無料プランでは、最大{PLANS.free.limit}商品まで登録できます。
      </li>
    </ul>
  );
}

export function GuideFormula() {
  return (
    <div className="space-y-4 text-sm">
      <p className="rounded-lg bg-black/30 px-4 py-3 font-num leading-relaxed text-brand-300">
        純利益 = Amazon価格 − 楽天価格 − (Amazon価格 × 手数料率 + 500円)
      </p>
      <p className="text-xs leading-relaxed text-slate-400">
        手数料率はカテゴリごとに決まります(ゲーム・家電 8% / 衣類・シューズ 15% / その他 10%)。500円は、配送・出荷にかかる費用の目安です。
      </p>
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[20rem] text-left text-xs">
          <caption className="bg-navy-800/60 px-4 py-2 text-left font-bold text-slate-200">
            計算例(ゲーム・家電、手数料8%)
          </caption>
          <tbody className="divide-y divide-white/5">
            <tr>
              <th className="px-4 py-2 font-medium text-slate-400">Amazon価格</th>
              <td className="px-4 py-2 text-right font-num">¥9,980</td>
            </tr>
            <tr>
              <th className="px-4 py-2 font-medium text-slate-400">楽天価格(仕入れ値)</th>
              <td className="px-4 py-2 text-right font-num">¥5,680</td>
            </tr>
            <tr>
              <th className="px-4 py-2 font-medium text-slate-400">差額(粗利)</th>
              <td className="px-4 py-2 text-right font-num">¥4,300</td>
            </tr>
            <tr>
              <th className="px-4 py-2 font-medium text-slate-400">手数料(9,980 × 8% + 500)</th>
              <td className="px-4 py-2 text-right font-num">−¥1,298</td>
            </tr>
            <tr className="bg-brand-500/10">
              <th className="px-4 py-2 font-bold text-brand-300">純利益</th>
              <td className="px-4 py-2 text-right font-num font-black text-brand-300">¥3,002</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
