import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// パスワード再設定メールのリンクの受け口。コードをセッションに交換して、新しいパスワードの入力画面へ進む。
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/reset-password`);
    }
  }
  return NextResponse.redirect(`${origin}/forgot-password?error=link`);
}
