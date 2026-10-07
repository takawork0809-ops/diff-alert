import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { planFromPriceId } from "@/lib/plans";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Stripeからの通知を受けて、契約状況(subscriptionsテーブル)を最新にする。
// 署名(STRIPE_WEBHOOK_SECRET)を検証して、Stripe以外からの偽の通知は受け付けない。
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) return NextResponse.json({ error: "not configured" }, { status: 400 });

  const body = await request.text(); // 署名の検証には、加工前の本文が必要
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
        if (subId) await syncSubscription(await stripe.subscriptions.retrieve(subId), session.client_reference_id);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object as Stripe.Subscription, null);
        break;
      default:
        break;
    }
  } catch (e) {
    console.error("webhook handling error", event.type, e);
    // 500を返すと、Stripeが自動で再送してくれる。
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function syncSubscription(sub: Stripe.Subscription, fallbackUserId: string | null) {
  const admin = createAdminClient();
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  let userId = sub.metadata?.user_id || fallbackUserId;
  if (!userId) {
    const { data } = await admin.from("subscriptions").select("user_id").eq("stripe_customer_id", customerId).maybeSingle();
    userId = data?.user_id ?? null;
  }
  if (!userId) {
    console.error("subscription without a known user", sub.id);
    return;
  }

  const item = sub.items.data[0];
  const plan = planFromPriceId(item?.price.id);
  if (!plan) {
    console.error("unknown price id", item?.price.id);
    return;
  }
  // APIのバージョンによって、更新期限の持ち場所が違う(契約本体 / 契約の明細)。両方に対応する。
  const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end ??
    (item as unknown as { current_period_end?: number } | undefined)?.current_period_end;

  const { error } = await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      plan,
      status: sub.status,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: sub.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw error;
}
