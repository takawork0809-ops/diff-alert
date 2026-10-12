import test from "node:test";
import assert from "node:assert/strict";
import { buildSearchKeyword, normalizeJan } from "../lib/search-keyword.ts";

test("buildSearchKeyword: 括弧の中の注記を除き、空白を整える", () => {
  assert.equal(buildSearchKeyword("【新品】ブリタ マクストラプロ  ピュアパフォーマンス（6個入）"), "ブリタ マクストラプロ ピュアパフォーマンス");
  assert.equal(buildSearchKeyword("[送料無料] DualSense　ワイヤレスコントローラー"), "DualSense ワイヤレスコントローラー");
});

test("buildSearchKeyword: 長い商品名は、単語の途中で切らずに短くする", () => {
  const long = "サンペレグリノ 炭酸水 PET 500mlｘ24本 正規輸入品 イタリア・ロンバルディア州産 ミネラルウォーター";
  const k = buildSearchKeyword(long);
  assert.ok(k.length <= 40);
  assert.ok(long.startsWith(k));
  assert.ok(!k.endsWith(" "));
});

test("buildSearchKeyword: 区切り記号より後ろを除く / 空の入力", () => {
  assert.equal(buildSearchKeyword("Fire TV Stick 4K Max：Alexa対応"), "Fire TV Stick 4K Max");
  assert.equal(buildSearchKeyword(""), "");
  assert.equal(buildSearchKeyword("【新品】"), "");
});

test("normalizeJan: 14桁の先頭の0を除く / 不正な値", () => {
  assert.equal(normalizeJan("08002270055850"), "8002270055850");
  assert.equal(normalizeJan("4901234567894"), "4901234567894");
  assert.equal(normalizeJan("49-0123-4567"), "4901234567");
  assert.equal(normalizeJan("12"), null);
  assert.equal(normalizeJan("abc"), null);
});
