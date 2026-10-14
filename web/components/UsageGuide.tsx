import { PLANS } from "@/lib/plans";

// 使い方の説明パーツ。空状態・ウェルカム画面・使い方ページで共通して使う(状態を持たないので Server/Client どちらからでも読み込める)。

const STEPS = [
  {
    title: "探したい商品のキーワードを決める",
    body: "仕入れたい商品の名前や型番を、キーワードとして入力します。Amazonでも売れている、はっきりした商品名が向いています。",
    example: "ポケモンカード BOX",
  },
  {
    title: "最低純利益と仕入れ先を選ぶ",
    body: "手数料を引いた後に、最低いくら残ってほしいかを円で入力し、探す場所(メルカリ・ヤフオク)とカテゴリを選びます。",
    example: "最低純利益 1,000円 / メルカリ・ヤフオク",
  },
  {
    title: "毎朝のお知らせメールを待つ",
    body: "毎朝、自動で探して、利益が出る商品が見つかると、1日1通のまとめメールでお知らせします。",
    example: "【差益レーダー】今日のお宝3件",
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
        登録した条件は、<strong className="text-white">毎朝</strong>、メルカリ・ヤフオクで自動で探し、商品名からAmazonの価格を調べて、純利益を計算します。
      </li>
      <li>
        <span className="mr-1 text-brand-400">●</span>
        手数料を引いた<strong className="text-white">純利益が、最低純利益以上</strong>になる商品が見つかると、登録したメールアドレスに、1日1通のまとめメールでお知らせします。
      </li>
      <li>
        <span className="mr-1 text-brand-400">●</span>
        見つかった商品は、ダッシュボードの「今日見つかったお宝リスト」にも並びます。登録直後は、次回の自動検索の後に表示されます。
      </li>
      <li>
        <span className="mr-1 text-brand-400">●</span>
        無料プランでは、最大{PLANS.free.limit}件の条件を登録できます。
      </li>
      <li>
        <span className="mr-1 text-brand-400">●</span>
        Amazonの価格は、検索結果から推定した目安です。仕入れる前に、同じ商品か(型番・状態・セット内容)を、必ずご自身で確認してください。
      </li>
    </ul>
  );
}

export function GuideFormula() {
  return (
    <div className="space-y-4 text-sm">
      <p className="rounded-lg bg-black/30 px-4 py-3 font-num leading-relaxed text-brand-300">
        純利益 = Amazon価格 − 仕入れ価格 − (Amazon価格 × 手数料率 + 500円)
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
              <th className="px-4 py-2 font-medium text-slate-400">仕入れ価格(メルカリ・ヤフオク)</th>
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
