// 商品の入力(ASIN / Amazon URL / 楽天URL / まとめて登録の貼り付け)を解析する関数。
// 画面とサーバーの両方から使うため、外部への依存を持たない(@/ のパスも使わない)。

export type BulkCategory = "electronics" | "game" | "apparel" | "other";

export const DEFAULT_TARGET_MARGIN = 1000;
export const MAX_TARGET_MARGIN = 10_000_000;
export const MAX_BULK_LINES = 200;

const CATEGORY_ALIASES: Record<string, BulkCategory> = {
  electronics: "electronics",
  家電: "electronics",
  ガジェット: "electronics",
  家電ガジェット: "electronics",
  "家電・ガジェット": "electronics",
  game: "game",
  ゲーム: "game",
  apparel: "apparel",
  衣類: "apparel",
  シューズ: "apparel",
  "衣類・シューズ": "apparel",
  アパレル: "apparel",
  other: "other",
  その他: "other",
  他: "other",
};

/** ASIN(10桁の英数字)か、Amazonの商品URLから、ASINを取り出す。見つからなければ null。 */
export function extractAsin(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  if (/^[A-Za-z0-9]{10}$/.test(text)) return text.toUpperCase();

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (!/(^|\.)amazon\.co\.jp$/i.test(url.hostname)) return null;
  const m = url.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d|exec\/obidos\/ASIN)\/([A-Za-z0-9]{10})(?:[/?]|$)/i);
  return m ? m[1].toUpperCase() : null;
}

/** 楽天市場の商品ページのURLを、追跡用の末尾(?scid=… など)を取り除いて、整える。違うURLなら null。 */
export function normalizeRakutenUrl(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.hostname !== "item.rakuten.co.jp") return null;
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  // 商品ページは「/店舗名/商品管理番号/」の形。店舗名だけ(トップ)のURLは、商品ページではない。
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 2) return null;
  return `https://item.rakuten.co.jp/${segments.join("/")}/`;
}

export function parseCategory(input: string): BulkCategory | null {
  const key = input.trim().replace(/\s+/g, "").toLowerCase();
  return CATEGORY_ALIASES[key] ?? CATEGORY_ALIASES[input.trim()] ?? null;
}

/** 目標純利益。「1,000」「¥1000」「1000円」なども受け付ける。不正なら null。 */
export function parseTarget(input: string): number | null {
  const cleaned = input
    .trim()
    .replace(/[¥￥円,，\s]/g, "")
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  if (!/^\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return n >= 0 && n <= MAX_TARGET_MARGIN ? n : null;
}

export type BulkRow = {
  line: number; // 貼り付けた中での行番号(1始まり)
  raw: string;
  ok: boolean;
  error?: string;
  asin?: string;
  rakutenUrl?: string;
  targetMargin?: number;
  category?: BulkCategory;
};

function isHeader(tokens: string[]): boolean {
  const first = tokens[0]?.toLowerCase();
  return first === "asin" || first === "amazon" || first === "amazon_url" || tokens[0] === "ASIN(またはAmazonのURL)";
}

/**
 * まとめて登録の貼り付けを解析する。
 * 1行に1商品。区切りは、タブ・カンマ・スペース(全角を含む)のどれでもよい。
 *   ASINまたはAmazonのURL  楽天のURL  [目標純利益]  [カテゴリ]
 * AmazonURLと楽天URLの順番が逆でも、受け付ける。
 */
export function parseBulkText(text: string): { rows: BulkRow[]; truncated: boolean } {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  const rows: BulkRow[] = [];
  const seen = new Set<string>();
  let nonEmpty = 0;
  let truncated = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const tokens = raw
      .split(/[\t,，、\s　]+/)
      .map((t) => t.replace(/^["'“”]+|["'“”]+$/g, "").trim())
      .filter(Boolean);
    if (tokens.length === 0) continue;
    if (rows.length === 0 && isHeader(tokens)) continue; // 見出し行は、読み飛ばす

    nonEmpty++;
    if (nonEmpty > MAX_BULK_LINES) {
      truncated = true;
      break;
    }

    const row: BulkRow = { line: i + 1, raw: raw.trim(), ok: false };
    const [t0, t1, targetToken, categoryToken] = tokens;

    // AmazonURLと楽天URLの順番が逆でも、読めるようにする
    const swapped = Boolean(t0 && t1 && normalizeRakutenUrl(t0) && extractAsin(t1));
    const a = swapped ? t1 : t0;
    const b = swapped ? t0 : t1;

    const asin = a ? extractAsin(a) : null;
    if (!asin) {
      row.error = a ? "AmazonのASINまたは商品URLが読み取れません" : "空の行です";
      rows.push(row);
      continue;
    }
    row.asin = asin;

    if (!b) {
      row.error = "楽天市場の商品URLがありません";
      rows.push(row);
      continue;
    }
    const rakutenUrl = normalizeRakutenUrl(b);
    if (!rakutenUrl) {
      row.error = "楽天URLは item.rakuten.co.jp の商品ページを指定してください";
      rows.push(row);
      continue;
    }
    row.rakutenUrl = rakutenUrl;

    if (targetToken !== undefined) {
      const t = parseTarget(targetToken);
      if (t === null) {
        row.error = `目標純利益「${targetToken}」を読み取れません(0以上の数字)`;
        rows.push(row);
        continue;
      }
      row.targetMargin = t;
    } else {
      row.targetMargin = DEFAULT_TARGET_MARGIN;
    }

    if (categoryToken !== undefined) {
      const c = parseCategory(categoryToken);
      if (!c) {
        row.error = `カテゴリ「${categoryToken}」は使えません(家電・ゲーム・衣類・その他)`;
        rows.push(row);
        continue;
      }
      row.category = c;
    } else {
      row.category = "other";
    }

    if (tokens.length > 4) {
      row.error = "項目が多すぎます(ASIN、楽天URL、目標純利益、カテゴリの4つまで)";
      rows.push(row);
      continue;
    }

    if (seen.has(row.asin)) {
      row.error = "このASINは、貼り付けの中で重複しています";
      rows.push(row);
      continue;
    }
    seen.add(row.asin);

    row.ok = true;
    rows.push(row);
  }
  return { rows, truncated };
}
