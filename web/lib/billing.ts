import type { SupabaseClient } from "@supabase/supabase-js";
import { PLANS, effectivePlan, type PlanId, type SubscriptionRow } from "@/lib/plans";

export type PlanInfo = {
  plan: PlanId;
  name: string;
  limit: number;
  subscription: SubscriptionRow | null;
};

// ログイン中ユーザーの契約状況(RLSで自分の行だけ読める)から、プランと監視上限を求める。
export async function getPlanInfo(supabase: SupabaseClient, userId: string): Promise<PlanInfo> {
  const { data } = await supabase.from("subscriptions").select("*").eq("user_id", userId).maybeSingle();
  const subscription = (data as SubscriptionRow | null) ?? null;
  const plan = effectivePlan(subscription);
  return { plan, name: PLANS[plan].name, limit: PLANS[plan].limit, subscription };
}
