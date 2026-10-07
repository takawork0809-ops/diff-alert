// プランの定義(画面・サーバー処理・LPで共通して使う)。金額や上限を変えるときはここだけを直す。
// Stripe側の価格IDは環境変数(STRIPE_PRICE_STANDARD / STRIPE_PRICE_PRO)で渡す。

export type PlanId = "free" | "standard" | "pro";
export type PaidPlanId = Exclude<PlanId, "free">;

export const PLANS: Record<PlanId, { id: PlanId; name: string; price: number; limit: number; features: string[] }> = {
  free: {
    id: "free",
    name: "無料プラン",
    price: 0,
    limit: 3,
    features: ["毎朝の自動チェック", "メール通知", "手数料込みの純利益計算"],
  },
  standard: {
    id: "standard",
    name: "スタンダード",
    price: 980,
    limit: 20,
    features: ["無料プランの全機能", "20商品まで同時監視"],
  },
  pro: {
    id: "pro",
    name: "プロ",
    price: 1980,
    limit: 50,
    features: ["スタンダードの全機能", "50商品まで同時監視"],
  },
};

export const PAID_PLAN_IDS: PaidPlanId[] = ["standard", "pro"];

// 契約中として扱うStripeの状態。支払いに失敗した直後(past_due)は、Stripeの再請求が終わるまで使えるままにする。
const ACTIVE_STATUSES = ["active", "trialing", "past_due"];

export type SubscriptionRow = {
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: PaidPlanId | null;
  status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
};

export function effectivePlan(sub: Pick<SubscriptionRow, "plan" | "status"> | null | undefined): PlanId {
  if (sub?.plan && sub.status && ACTIVE_STATUSES.includes(sub.status)) return sub.plan;
  return "free";
}

export const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

// ---- 以下はサーバー側だけで使う(環境変数を読む) ----

export function priceIdFor(plan: PaidPlanId): string | undefined {
  return plan === "standard" ? process.env.STRIPE_PRICE_STANDARD : process.env.STRIPE_PRICE_PRO;
}

export function planFromPriceId(priceId: string | undefined | null): PaidPlanId | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_STANDARD) return "standard";
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  return null;
}

export function billingConfigured(): boolean {
  return !!(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_PRICE_STANDARD &&
    process.env.STRIPE_PRICE_PRO &&
    process.env.STRIPE_WEBHOOK_SECRET &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
