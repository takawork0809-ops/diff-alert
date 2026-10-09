import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { PAID_PLAN_IDS, effectivePlan, paidSalesEnabled, priceIdFor, type PaidPlanId, type SubscriptionRow } from "@/lib/plans";

export const dynamic = "force-dynamic";

// 「このプランで申し込む」ボタンのフォーム送信を受けて、Stripeの決済ページ(Checkout)へ移動させる。
export async function POST(request: Request) {
  const { origin } = new URL(request.url);
  const back = (status: string) => NextResponse.redirect(`${origin}/dashboard/billing?status=${status}`, 303);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`, 303);
  if (!paidSalesEnabled()) return back("unavailable");

  const form = await request.formData();
  const plan = String(form.get("plan") ?? "") as PaidPlanId;
  if (!PAID_PLAN_IDS.includes(plan)) return back("error");
  const price = priceIdFor(plan);
  if (!price) return back("unavailable");

  const { data } = await supabase.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle();
  const sub = (data as SubscriptionRow | null) ?? null;
  // すでに有料プランの契約中なら、二重に申し込ませない(プランの変更・解約は管理画面から)。
  if (effectivePlan(sub) !== "free") return back("already");

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      ...(sub?.stripe_customer_id ? { customer: sub.stripe_customer_id } : { customer_email: user.email ?? undefined }),
      client_reference_id: user.id,
      metadata: { user_id: user.id, plan },
      subscription_data: { metadata: { user_id: user.id, plan } },
      allow_promotion_codes: true,
      locale: "ja",
      success_url: `${origin}/dashboard/billing?status=success`,
      cancel_url: `${origin}/dashboard/billing?status=cancel`,
    });
    if (!session.url) return back("error");
    return NextResponse.redirect(session.url, 303);
  } catch (e) {
    console.error("checkout session error", e);
    return back("error");
  }
}
