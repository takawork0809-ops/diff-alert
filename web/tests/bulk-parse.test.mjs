// 実行: npm test  (Node の組み込みテスト。TypeScript をそのまま読み込む)
import test from "node:test";
import assert from "node:assert/strict";
import {
  extractAsin,
  normalizeRakutenUrl,
  parseCategory,
  parseTarget,
  parseBulkText,
  MAX_BULK_LINES,
} from "../lib/bulk-parse.ts";

test("extractAsin: ASIN そのもの(小文字・前後の空白)", () => {
  assert.equal(extractAsin("B0CPL68SZN"), "B0CPL68SZN");
  assert.equal(extractAsin("  b0cpl68szn \n"), "B0CPL68SZN");
});

test("extractAsin: Amazon の商品URL", () => {
  assert.equal(extractAsin("https://www.amazon.co.jp/dp/B0CPL68SZN"), "B0CPL68SZN");
  assert.equal(extractAsin("https://www.amazon.co.jp/dp/B0CPL68SZN/ref=sr_1_1?crid=XXXX&keywords=abc"), "B0CPL68SZN");
  assert.equal(extractAsin("https://www.amazon.co.jp/%E5%95%86%E5%93%81%E5%90%8D/dp/B0CPL68SZN?th=1"), "B0CPL68SZN");
  assert.equal(extractAsin("https://amazon.co.jp/gp/product/B0CPL68SZN"), "B0CPL68SZN");
});

test("extractAsin: 読み取れないもの", () => {
  assert.equal(extractAsin(""), null);
  assert.equal(extractAsin("B0CPL68SZ"), null); // 9桁
  assert.equal(extractAsin("B0CPL68SZNN"), null); // 11桁
  assert.equal(extractAsin("https://www.amazon.com/dp/B0CPL68SZN"), null); // 日本のAmazonではない
  assert.equal(extractAsin("https://example.com/dp/B0CPL68SZN"), null);
  assert.equal(extractAsin("https://www.amazon.co.jp/"), null);
});

test("normalizeRakutenUrl: 追跡用の末尾を取り除く", () => {
  assert.equal(
    normalizeRakutenUrl("https://item.rakuten.co.jp/bshop03/ec-b0g2q54ltr/?scid=af_pc_etc&sc2id=af_101"),
    "https://item.rakuten.co.jp/bshop03/ec-b0g2q54ltr/"
  );
  assert.equal(normalizeRakutenUrl("https://item.rakuten.co.jp/shop/item#review"), "https://item.rakuten.co.jp/shop/item/");
});

test("normalizeRakutenUrl: 商品ページではないURL", () => {
  assert.equal(normalizeRakutenUrl("https://www.rakuten.co.jp/shop/"), null);
  assert.equal(normalizeRakutenUrl("https://item.rakuten.co.jp/shop/"), null); // 店舗トップ
  assert.equal(normalizeRakutenUrl("https://item.rakuten.co.jp.evil.com/shop/item/"), null);
  assert.equal(normalizeRakutenUrl("javascript:alert(1)"), null);
  assert.equal(normalizeRakutenUrl("not a url"), null);
});

test("parseCategory / parseTarget", () => {
  assert.equal(parseCategory("家電"), "electronics");
  assert.equal(parseCategory("ゲーム"), "game");
  assert.equal(parseCategory("衣類・シューズ"), "apparel");
  assert.equal(parseCategory("Other"), "other");
  assert.equal(parseCategory("食品"), null);
  assert.equal(parseTarget("1000"), 1000);
  assert.equal(parseTarget("¥1,500"), 1500);
  assert.equal(parseTarget("２０００円"), 2000);
  assert.equal(parseTarget("0"), 0);
  assert.equal(parseTarget("-5"), null);
  assert.equal(parseTarget("abc"), null);
  assert.equal(parseTarget("10000001"), null);
});

const R1 = "https://item.rakuten.co.jp/bshop03/ec-b0g2q54ltr/";
const R2 = "https://item.rakuten.co.jp/soukaidrink/8002270055850/";

test("parseBulkText: スペース・カンマ・タブ、省略時の既定値", () => {
  const text = [
    `B0CPL68SZN ${R1}`,
    `B07HB1Z4GQ,${R2},300,家電`,
    `B000MEKG30\t${R1}\t¥800\tゲーム`,
  ].join("\n");
  const { rows, truncated } = parseBulkText(text);
  assert.equal(truncated, false);
  assert.equal(rows.length, 3);
  assert.deepEqual(
    rows.map((r) => [r.ok, r.asin, r.targetMargin, r.category]),
    [
      [true, "B0CPL68SZN", 1000, "other"],
      [true, "B07HB1Z4GQ", 300, "electronics"],
      [true, "B000MEKG30", 800, "game"],
    ]
  );
});

test("parseBulkText: 全角スペース、見出し行、空行、BOM、引用符、Amazon URL", () => {
  const text = `﻿ASIN,楽天URL,目標純利益,カテゴリ\r\n\r\n"https://www.amazon.co.jp/dp/B0CPL68SZN"　"${R1}?scid=x"　500　その他\r\n`;
  const { rows } = parseBulkText(text);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].ok, true);
  assert.equal(rows[0].asin, "B0CPL68SZN");
  assert.equal(rows[0].rakutenUrl, R1);
  assert.equal(rows[0].targetMargin, 500);
  assert.equal(rows[0].line, 3); // 行番号は、元の貼り付けのもの(見出し=1、空行=2、商品=3)
});

test("parseBulkText: AmazonURLと楽天URLの順番が逆でも読める", () => {
  const { rows } = parseBulkText(`${R1} B0CPL68SZN`);
  assert.equal(rows[0].ok, true);
  assert.equal(rows[0].asin, "B0CPL68SZN");
});

test("parseBulkText: エラー行は理由つきで、他の行には影響しない", () => {
  const text = [
    `B0CPL68SZN ${R1}`, // OK
    `XXXX ${R1}`, // ASINが不正
    `B07HB1Z4GQ`, // 楽天URLなし
    `B07HB1Z4GQ https://example.com/a/b`, // 楽天ではない
    `B000MEKG30 ${R2} abc`, // 目標が不正
    `B000MEKG30 ${R2} 100 食品`, // カテゴリが不正
    `B0CPL68SZN ${R2}`, // ASINの重複
    `B0GKMJSYB1 ${R2} 100 家電 余計`, // 項目が多すぎる
  ].join("\n");
  const { rows } = parseBulkText(text);
  assert.deepEqual(rows.map((r) => r.ok), [true, false, false, false, false, false, false, false]);
  assert.match(rows[1].error, /ASIN/);
  assert.match(rows[2].error, /楽天/);
  assert.match(rows[3].error, /item\.rakuten\.co\.jp/);
  assert.match(rows[4].error, /目標純利益/);
  assert.match(rows[5].error, /カテゴリ/);
  assert.match(rows[6].error, /重複/);
  assert.match(rows[7].error, /多すぎ/);
});

test("parseBulkText: 行数の上限", () => {
  const lines = Array.from({ length: MAX_BULK_LINES + 5 }, (_, i) => `B${String(i).padStart(9, "0")} ${R1}`);
  const { rows, truncated } = parseBulkText(lines.join("\n"));
  assert.equal(rows.length, MAX_BULK_LINES);
  assert.equal(truncated, true);
});
