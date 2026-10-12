// Amazonの商品名から、楽天で探すための検索語を作る(外部への依存を持たない)。
// 長すぎる商品名や、括弧の中の注記(【新品】【送料無料】など)を除くと、楽天の検索にかかりやすくなる。

export const MAX_KEYWORD_LENGTH = 40;

export function buildSearchKeyword(title: string, max: number = MAX_KEYWORD_LENGTH): string {
  let t = title
    .replace(/　/g, " ")
    .replace(/【[^】]*】|［[^］]*］|\[[^\]]*\]|（[^）]*）|\([^)]*\)/g, " ") // 括弧の中の注記を除く
    .replace(/[：:｜|].*$/, " ") // 区切り記号より後ろ(販売店名など)を除く
    .replace(/\s+/g, " ")
    .trim();
  if (t.length <= max) return t;
  // 単語の途中で切らないように、max以内の、最後の空白で切る(空白がなければ、そのまま切る)
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  t = lastSpace >= Math.floor(max / 2) ? cut.slice(0, lastSpace) : cut;
  return t.trim();
}

/** AmazonのJAN/GTIN(8〜14桁の数字)を、楽天の検索に使える形にする。14桁で先頭が0なら、13桁に直す。不正なら null。 */
export function normalizeJan(input: string): string | null {
  const digits = input.replace(/[^0-9]/g, "");
  if (digits.length === 14 && digits.startsWith("0")) return digits.slice(1);
  if (digits.length >= 8 && digits.length <= 14) return digits;
  return null;
}
