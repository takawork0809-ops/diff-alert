// Stripe(テストモード)に、差益レーダーの商品・価格・webhook・カスタマーポータルを作るスクリプト。
// 何度実行しても重複しないようにしてある(価格は lookup_key で、webhook は URL で、ポータルは metadata で判定)。
//
// 使い方(web フォルダで):
//   1) .env.local に  STRIPE_SECRET_KEY=sk_test_...  を書く(Stripeの「開発者 > APIキー」のテスト用シークレットキー)
//   2) node --env-file=.env.local scripts/stripe-setup.mjs https://diff-alert.vercel.app
//
// 本番(sk_live_)のキーでは動かない。本番用の準備は、別途、内容を確認してから行う。

import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
const siteUrl = (process.argv[2] ?? "").replace(/\/$/, "");

if (!key) {
  console.error("STRIPE_SECRET_KEY が設定されていません(.env.local を確認してください)。");
  process.exit(1);
}
if (!key.startsWith("sk_test_")) {
  console.error("このスクリプトは、テストモードのキー(sk_test_...)でのみ動きます。");
  process.exit(1);
}
if (!/^https:\/\//.test(siteUrl)) {
  console.error("公開URLを引数で指定してください。例: node --env-file=.env.local scripts/stripe-setup.mjs https://diff-alert.vercel.app");
  process.exit(1);
}

const stripe = new Stripe(key);

const PLANS = [
  { id: "standard", name: "差益レーダー スタンダード", amount: 980, lookup: "sagakuradar_standard_monthly" },
  { id: "pro", name: "差益レーダー プロ", amount: 1980, lookup: "sagakuradar_pro_monthly" },
];

const prices = {};
const products = {};

for (const p of PLANS) {
  const found = await stripe.prices.list({ lookup_keys: [p.lookup], limit: 1, expand: ["data.product"] });
  if (found.data[0]) {
    prices[p.id] = found.data[0].id;
    products[p.id] = typeof found.data[0].product === "string" ? found.data[0].product : found.data[0].product.id;
    console.log(`既にあります: ${p.name} (${prices[p.id]})`);
    continue;
  }
  const price = await stripe.prices.create({
    currency: "jpy",
    unit_amount: p.amount, // 円は小数点のない通貨なので、金額をそのまま指定する
    recurring: { interval: "month" },
    tax_behavior: "inclusive", // 表示価格は税込
    lookup_key: p.lookup,
    product_data: { name: p.name },
  });
  prices[p.id] = price.id;
  products[p.id] = price.product;
  console.log(`作成しました: ${p.name} ¥${p.amount}/月 (${price.id})`);
}

// webhook(支払いや解約をこのサイトに知らせる通知先)
const endpointUrl = `${siteUrl}/api/stripe/webhook`;
const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
const existing = endpoints.data.find((e) => e.url === endpointUrl);
let webhookSecret = null;
if (existing) {
  console.log(`webhookは既にあります(${existing.id})。署名シークレットは作成時にしか表示されないため、再表示できません。`);
  console.log("  必要なら、Stripeのダッシュボードで「シークレットを表示」するか、webhookを削除して、このスクリプトを再実行してください。");
} else {
  const created = await stripe.webhookEndpoints.create({
    url: endpointUrl,
    description: "差益レーダー: 契約状況の同期",
    enabled_events: [
      "checkout.session.completed",
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
    ],
  });
  webhookSecret = created.secret;
  console.log(`webhookを作成しました: ${endpointUrl}`);
}

// カスタマーポータル(支払い方法の変更・プラン変更・解約をお客様自身で行う画面)
const configs = await stripe.billingPortal.configurations.list({ limit: 100 });
if (configs.data.some((c) => c.metadata?.app === "sagakuradar")) {
  console.log("カスタマーポータルの設定は既にあります。");
} else {
  await stripe.billingPortal.configurations.create({
    business_profile: { headline: "差益レーダーのお支払いの管理" },
    metadata: { app: "sagakuradar" },
    features: {
      customer_update: { enabled: true, allowed_updates: ["email"] },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: "at_period_end" },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ["price"],
        proration_behavior: "create_prorations",
        products: PLANS.map((p) => ({ product: products[p.id], prices: [prices[p.id]] })),
      },
    },
  });
  console.log("カスタマーポータルの設定を作成しました。");
}

console.log("\n===== Vercel の環境変数に登録する値(Production と Preview の両方) =====");
console.log(`STRIPE_PRICE_STANDARD=${prices.standard}`);
console.log(`STRIPE_PRICE_PRO=${prices.pro}`);
console.log(webhookSecret ? `STRIPE_WEBHOOK_SECRET=${webhookSecret}` : "STRIPE_WEBHOOK_SECRET=(上記のとおり、既存のwebhookのシークレットを使う)");
console.log("STRIPE_SECRET_KEY=(.env.local に書いた sk_test_... と同じ値)");
console.log("SUPABASE_SERVICE_ROLE_KEY=(Supabaseの「Project Settings > API」の service_role キー)");
console.log("※ これらの値は秘密情報です。チャットや公開の場所には貼らないでください。");
