"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fetchAmazonTitle } from "@/lib/amazon";
import { getPlanInfo } from "@/lib/billing";
import type { Category } from "@/lib/types";

export type FormState = { ok: boolean; message: string };

const CATEGORIES: Category[] = ["electronics", "game", "apparel", "other"];

export async function addProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "ログインが必要です。" };

  const asin = String(formData.get("asin") ?? "").trim().toUpperCase();
  const rakutenUrl = String(formData.get("rakuten_url") ?? "").trim();
  const category = String(formData.get("category") ?? "other") as Category;
  const target = Number(formData.get("target_margin"));

  if (!/^[A-Z0-9]{10}$/.test(asin)) {
    return { ok: false, message: "ASINは英数字10桁で入力してください(例: B0CPL68SZN)。" };
  }
  let host = "";
  try {
    host = new URL(rakutenUrl).hostname;
  } catch {
    return { ok: false, message: "楽天URLの形式が正しくありません。" };
  }
  if (host !== "item.rakuten.co.jp") {
    return { ok: false, message: "楽天URLは item.rakuten.co.jp の商品ページを指定してください。" };
  }
  if (!CATEGORIES.includes(category)) {
    return { ok: false, message: "カテゴリを選択してください。" };
  }
  if (!Number.isFinite(target) || target < 0 || target > 10_000_000) {
    return { ok: false, message: "目標純利益は0以上の数値で入力してください。" };
  }

  const { count, error: countError } = await supabase
    .from("monitored_products")
    .select("id", { count: "exact", head: true });
  if (countError) return { ok: false, message: dbMessage(countError.message) };
  const plan = await getPlanInfo(supabase, user.id);
  if ((count ?? 0) >= plan.limit) {
    return {
      ok: false,
      message:
        plan.plan === "pro"
          ? `ご契約のプランの監視上限(${plan.limit}商品)に達しています。不要な商品を削除してください。`
          : `${plan.name}の監視上限(${plan.limit}商品)に達しています。不要な商品を削除するか、「プラン」から上位のプランをご検討ください。`,
    };
  }

  const productName = await fetchAmazonTitle(asin);

  const { error } = await supabase.from("monitored_products").insert({
    user_id: user.id,
    asin,
    rakuten_url: rakutenUrl,
    category,
    target_margin: Math.round(target),
    product_name: productName,
  });
  if (error) {
    if (error.code === "23505") {
      return { ok: false, message: "このASINは既に登録されています。" };
    }
    return { ok: false, message: dbMessage(error.message) };
  }

  revalidatePath("/dashboard");
  return {
    ok: true,
    message: productName
      ? "登録しました。次回の自動チェックから監視が始まります。"
      : "登録しました。商品名は次回の自動チェックで取得されます。",
  };
}

export async function deleteProduct(formData: FormData) {
  const supabase = createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await supabase.from("monitored_products").delete().eq("id", id);
  revalidatePath("/dashboard");
}

function dbMessage(raw: string): string {
  if (raw.includes("monitored_products") && raw.includes("schema cache")) {
    return "データベースの準備ができていません(monitored_productsテーブルが未作成です)。";
  }
  return `保存に失敗しました: ${raw}`;
}
