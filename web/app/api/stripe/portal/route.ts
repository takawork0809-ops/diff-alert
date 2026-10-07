import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { billingConfigured, type SubscriptionRow } from "@/lib/plans";

export const dynamic = "force-dynamic";

// 「支払い方法の変更・プラン変更・解約」ボタン。StripeのカスタマーポータルへIDを渡して移動させる。
export async function POST(request: Request) {
  const { origin } = new URL(request.url);
  const back = (status: string) => NextResponse.redirect(`${origin}/dashboard/billing?status=${status}`, 303);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`, 303);
  if (!billingConfigured()) return back("unavailable");

  const { data } = await supabase.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle();
  const customer = (data as SubscriptionRow | null)?.stripe_customer_id;
  if (!customer) return back("error");

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer,
      return_url: `${origin}/dashboard/billing`,
    });
    return NextResponse.redirect(session.url, 303);
  } catch (e) {
    console.error("portal session error", e);
    return back("error");
  }
}
