import test from "node:test";
import assert from "node:assert/strict";
import { parseConditionInput } from "../lib/watch-conditions.ts";

const base = { keyword: "ポケモンカード BOX", minProfit: "1000", sources: ["mercari", "yahuoku"], category: "other" };

test("正しい入力は、そのまま受け付ける", () => {
  const r = parseConditionInput(base);
  assert.equal(r.ok, true);
  assert.deepEqual(r.value, { keyword: "ポケモンカード BOX", minProfit: 1000, sources: ["mercari", "yahuoku"], category: "other" });
});

test("キーワードの全角スペース・連続空白を整える", () => {
  const r = parseConditionInput({ ...base, keyword: "  ポケモンカード　　BOX  " });
  assert.equal(r.value.keyword, "ポケモンカード BOX");
});

test("キーワードが空・長すぎる場合はエラー", () => {
  assert.equal(parseConditionInput({ ...base, keyword: "  " }).ok, false);
  assert.equal(parseConditionInput({ ...base, keyword: "あ".repeat(81) }).ok, false);
});

test("最低純利益は、0以上の数値だけ受け付ける", () => {
  assert.equal(parseConditionInput({ ...base, minProfit: "" }).ok, false);
  assert.equal(parseConditionInput({ ...base, minProfit: "-1" }).ok, false);
  assert.equal(parseConditionInput({ ...base, minProfit: "abc" }).ok, false);
  assert.equal(parseConditionInput({ ...base, minProfit: "0" }).ok, true);
  assert.equal(parseConditionInput({ ...base, minProfit: "999.6" }).value.minProfit, 1000);
});

test("仕入れ先は1つ以上必要。未知の仕入れ先は無視する", () => {
  assert.equal(parseConditionInput({ ...base, sources: [] }).ok, false);
  assert.equal(parseConditionInput({ ...base, sources: ["rakuten"] }).ok, false);
  assert.deepEqual(parseConditionInput({ ...base, sources: ["yahuoku", "x"] }).value.sources, ["yahuoku"]);
});

test("未知のカテゴリはエラー", () => {
  assert.equal(parseConditionInput({ ...base, category: "food" }).ok, false);
});
