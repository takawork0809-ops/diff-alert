"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getPlanInfo } from "@/lib/billing";
import { parseConditionInput } from "@/lib/watch-conditions";

export type FormState = { ok: boolean; message: string };

// ---- 自動スカウト: 条件の登録・削除・一時停止 ----

export async function addCondition(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "ログインが必要です。" };

  const parsed = parseConditionInput({
    keyword: formData.get("keyword"),
    minProfit: formData.get("min_profit"),
    sources: formData.getAll("sources"),
    category: formData.get("category"),
  });
  if (!parsed.ok) return { ok: false, message: parsed.error };
  const { keyword, minProfit, sources, category } = parsed.value;

  const { count, error: countError } = await supabase
    .from("watch_conditions")
    .select("id", { count: "exact", head: true });
  if (countError) return { ok: false, message: conditionDbMessage(countError.message) };
  const plan = await getPlanInfo(supabase, user.id);
  if ((count ?? 0) >= plan.limit) {
    return {
      ok: false,
      message:
        plan.plan === "pro"
          ? `ご契約のプランの条件数の上限(${plan.limit}件)に達しています。不要な条件を削除してください。`
          : `${plan.name}の条件数の上限(${plan.limit}件)に達しています。不要な条件を削除するか、「プラン」から上位のプランをご検討ください。`,
    };
  }

  const { error } = await supabase.from("watch_conditions").insert({
    user_id: user.id,
    keyword,
    min_profit: minProfit,
    sources,
    category,
  });
  if (error) return { ok: false, message: conditionDbMessage(error.message) };

  revalidatePath("/dashboard");
  return { ok: true, message: "条件を登録しました。次の自動検索(毎朝)から、条件に合う商品を探します。" };
}

export async function deleteCondition(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await supabase.from("watch_conditions").delete().eq("id", id);
  revalidatePath("/dashboard");
}

export async function toggleCondition(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get("id") ?? "");
  const next = String(formData.get("next") ?? "") === "true";
  if (!id) return;
  await supabase.from("watch_conditions").update({ is_active: next }).eq("id", id);
  revalidatePath("/dashboard");
}

function conditionDbMessage(raw: string): string {
  if (raw.includes("watch_conditions") && raw.includes("schema cache")) {
    return "データベースの準備ができていません(watch_conditionsテーブルが未作成です)。";
  }
  return `保存に失敗しました: ${raw}`;
}
