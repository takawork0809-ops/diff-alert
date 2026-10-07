import { createClient } from "@supabase/supabase-js";

// service_role キーを使う管理用クライアント。RLSを無視できるため、Stripeからの通知(webhook)の処理など、
// サーバー側だけで使うこと。ブラウザに渡したり、NEXT_PUBLIC_ を付けたりしてはいけない。
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY が設定されていません。");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
