"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fetchAmazonTitle } from "@/lib/amazon";
import { getPlanInfo } from "@/lib/billing";
import { extractAsin, normalizeRakutenUrl, parseBulkText, MAX_BULK_LINES } from "@/lib/bulk-parse";
import type { Category } from "@/lib/types";

export type FormState = { ok: boolean; message: string };

const CATEGORIES: Category[] = ["electronics", "game", "apparel", "other"];

export async function addProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "ログインが必要です。" };

  const asinInput = String(formData.get("asin") ?? "");
  const rakutenInput = String(formData.get("rakuten_url") ?? "");
  const category = String(formData.get("category") ?? "other") as Category;
  const target = Number(formData.get("target_margin"));

  const asin = extractAsin(asinInput);
  if (!asin) {
    return { ok: false, message: "ASIN(英数字10桁)か、Amazonの商品ページのURLを入力してください(例: B0CPL68SZN)。" };
  }
  try {
    new URL(rakutenInput.trim());
  } catch {
    return { ok: false, message: "楽天URLの形式が正しくありません。" };
  }
  const rakutenUrl = normalizeRakutenUrl(rakutenInput);
  if (!rakutenUrl) {
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

export type BulkRowResult = {
  line: number;
  status: "added" | "skipped" | "error";
  message: string;
  asin?: string;
};
export type BulkResult = {
  ok: boolean;
  message: string;
  added: number;
  rows: BulkRowResult[];
};

/**
 * 商品をまとめて登録する。貼り付けの全文をサーバーでもう一度解析して、検証する(画面の検証は信用しない)。
 * プランの残り枠を超える分と、すでに登録済みのASINは、登録しない。
 */
export async function bulkAddProducts(text: string): Promise<BulkResult> {
  const fail = (message: string): BulkResult => ({ ok: false, message, added: 0, rows: [] });

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("ログインが必要です。");
  if (typeof text !== "string" || text.length > 200_000) return fail("貼り付けた内容が大きすぎます。");

  const { rows: parsed, truncated } = parseBulkText(text);
  if (parsed.length === 0) return fail("登録する商品が見つかりません。");

  const { data: existingRows, error: existingError } = await supabase.from("monitored_products").select("asin");
  if (existingError) return fail(dbMessage(existingError.message));
  const existing = new Set((existingRows ?? []).map((r: { asin: string }) => r.asin));

  const plan = await getPlanInfo(supabase, user.id);
  let remaining = Math.max(0, plan.limit - existing.size);

  const results: BulkRowResult[] = [];
  const toInsert: {
    user_id: string;
    asin: string;
    rakuten_url: string;
    category: Category;
    target_margin: number;
  }[] = [];

  for (const r of parsed) {
    if (!r.ok || !r.asin || !r.rakutenUrl || r.targetMargin === undefined || !r.category) {
      results.push({ line: r.line, status: "error", message: r.error ?? "読み取れませんでした", asin: r.asin });
      continue;
    }
    if (existing.has(r.asin)) {
      results.push({ line: r.line, status: "skipped", message: "すでに登録済みです", asin: r.asin });
      continue;
    }
    if (remaining <= 0) {
      results.push({
        line: r.line,
        status: "skipped",
        message: `${plan.name}の上限(${plan.limit}商品)に達しているため、登録しませんでした`,
        asin: r.asin,
      });
      continue;
    }
    remaining -= 1;
    toInsert.push({
      user_id: user.id,
      asin: r.asin,
      rakuten_url: r.rakutenUrl,
      category: r.category,
      target_margin: r.targetMargin,
    });
    results.push({ line: r.line, status: "added", message: "登録しました", asin: r.asin });
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from("monitored_products").insert(toInsert);
    if (error) {
      // 1件でも失敗したら、全体が登録されない。結果を、すべて「登録されなかった」に直す。
      const message = error.code === "23505" ? "すでに登録済みの商品が含まれていました。もう一度お試しください。" : dbMessage(error.message);
      for (const row of results) {
        if (row.status === "added") {
          row.status = "error";
          row.message = "登録に失敗しました";
        }
      }
      return { ok: false, message, added: 0, rows: results };
    }
    revalidatePath("/dashboard");
  }

  const added = toInsert.length;
  const errors = results.filter((r) => r.status === "error").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const parts = [`${added}件を登録しました`];
  if (skipped) parts.push(`${skipped}件は登録しませんでした`);
  if (errors) parts.push(`${errors}件は読み取れませんでした`);
  if (truncated) parts.push(`先頭の${MAX_BULK_LINES}行だけを処理しました`);
  return {
    ok: added > 0,
    message: parts.join("。") + "。" + (added > 0 ? "次回の自動チェックから監視が始まります。" : ""),
    added,
    rows: results,
  };
}
