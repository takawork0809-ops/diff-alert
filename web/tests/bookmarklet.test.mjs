// ブックマークレットを、疑似的なページ(location / document / window)で、実際に実行して確かめる。
import test from "node:test";
import assert from "node:assert/strict";
import { buildBookmarkletCode, buildBookmarklet } from "../lib/bookmarklet.ts";

function run({ host = "www.amazon.co.jp", path, title = "テスト商品  名前", rows = [], popupBlocked = false }) {
  const calls = { alerts: [], opened: [], href: null };
  const location = { hostname: host, pathname: path, set href(v) { calls.href = v; } };
  const document = {
    title: "Amazon.co.jp: タイトル",
    getElementById: (id) => (id === "productTitle" && title !== null ? { innerText: title } : null),
    querySelectorAll: () => rows.map(([th, td]) => ({ querySelector: (s) => (s === "th" ? { innerText: th } : { innerText: td }) })),
  };
  const window = { open: (u) => { calls.opened.push(u); return popupBlocked ? null : {}; } };
  const alert = (m) => calls.alerts.push(m);
  new Function("location", "document", "window", "alert", buildBookmarkletCode("https://example.test"))(location, document, window, alert);
  return calls;
}

test("Amazonの商品ページ: ASINと商品名を読み取って、検索ページを開く", () => {
  const c = run({ path: "/%E5%95%86%E5%93%81/dp/b0cpl68szn/ref=sr_1_1" });
  assert.equal(c.alerts.length, 0);
  assert.equal(c.opened.length, 1);
  const u = new URL(c.opened[0]);
  assert.equal(u.origin, "https://example.test");
  assert.equal(u.pathname, "/dashboard/find");
  assert.equal(u.searchParams.get("asin"), "B0CPL68SZN");
  assert.equal(u.searchParams.get("title"), "テスト商品 名前"); // 連続した空白は、1つにまとまる
  assert.equal(u.searchParams.get("jan"), null);
});

test("商品情報の表に、GTINがあれば、janも渡す", () => {
  const c = run({ path: "/dp/B07HB1Z4GQ", rows: [["ブランド名", "サンペレグリノ"], ["GTIN (Global Trade Identification Number)", "08002270055850"]] });
  assert.equal(new URL(c.opened[0]).searchParams.get("jan"), "08002270055850");
});

test("商品名の要素がなければ、ページのタイトルを使う", () => {
  const c = run({ path: "/gp/product/B0CPL68SZN", title: null });
  assert.equal(new URL(c.opened[0]).searchParams.get("title"), "Amazon.co.jp: タイトル");
});

test("長い商品名は、200文字までに切る", () => {
  const c = run({ path: "/dp/B0CPL68SZN", title: "あ".repeat(500) });
  assert.equal(new URL(c.opened[0]).searchParams.get("title").length, 200);
});

test("Amazon以外のサイトや、商品ページ以外では、案内を出して何も開かない", () => {
  const a = run({ host: "www.example.com", path: "/dp/B0CPL68SZN" });
  assert.equal(a.opened.length, 0);
  assert.equal(a.alerts.length, 1);
  const b = run({ path: "/s" });
  assert.equal(b.opened.length, 0);
  assert.equal(b.alerts.length, 1);
  const c = run({ host: "www.amazon.co.jp.evil.com", path: "/dp/B0CPL68SZN" });
  assert.equal(c.opened.length, 0);
});

test("ポップアップがブロックされたときは、同じタブで移動する", () => {
  const c = run({ path: "/dp/B0CPL68SZN", popupBlocked: true });
  assert.ok(c.href && c.href.startsWith("https://example.test/dashboard/find?asin=B0CPL68SZN"));
});

test("javascript: で始まり、改行を含まない(ブックマークのURLとして使える)", () => {
  const b = buildBookmarklet("https://example.test");
  assert.ok(b.startsWith("javascript:"));
  assert.ok(!/\n/.test(b));
});
