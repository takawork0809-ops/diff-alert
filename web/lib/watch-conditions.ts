// 自動スカウトの「条件」の検証(依存なしの純粋関数。画面とサーバーアクションの両方で使い、テストもできる)。

export type Source = "mercari" | "yahuoku";

export const SOURCE_LABELS: Record<Source, string> = {
  mercari: "メルカリ",
  yahuoku: "ヤフオク",
};
export const SOURCES = Object.keys(SOURCE_LABELS) as Source[];

export const MAX_KEYWORD_LENGTH = 80;
export const MAX_MIN_PROFIT = 10_000_000;

const CATEGORY_IDS = ["electronics", "game", "apparel", "other"] as const;
export type ConditionCategory = (typeof CATEGORY_IDS)[number];

export type ConditionInput = {
  keyword: string;
  minProfit: number;
  sources: Source[];
  category: ConditionCategory;
};

export type ConditionParse = { ok: true; value: ConditionInput } | { ok: false; error: string };

export function parseConditionInput(raw: {
  keyword: unknown;
  minProfit: unknown;
  sources: unknown[];
  category: unknown;
}): ConditionParse {
  // 全角スペースや連続した空白を、半角スペース1つにそろえる
  const keyword = String(raw.keyword ?? "")
    .replace(/[\s　]+/g, " ")
    .trim();
  if (!keyword) return { ok: false, error: "キーワードを入力してください。" };
  if (keyword.length > MAX_KEYWORD_LENGTH) {
    return { ok: false, error: `キーワードは${MAX_KEYWORD_LENGTH}文字以内で入力してください。` };
  }

  const minProfit = Number(raw.minProfit);
  if (raw.minProfit === "" || !Number.isFinite(minProfit) || minProfit < 0 || minProfit > MAX_MIN_PROFIT) {
    return { ok: false, error: "最低純利益は0以上の数値で入力してください。" };
  }

  const sources = SOURCES.filter((s) => raw.sources.includes(s));
  if (sources.length === 0) return { ok: false, error: "仕入れ先を1つ以上、選んでください。" };

  const category = String(raw.category ?? "other") as ConditionCategory;
  if (!CATEGORY_IDS.includes(category)) return { ok: false, error: "カテゴリを選択してください。" };

  return { ok: true, value: { keyword, minProfit: Math.round(minProfit), sources, category } };
}
