import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Logo from "@/components/Logo";
import AuthForm from "@/components/AuthForm";

export const metadata = { title: "無料で始める | 差益レーダー" };

export default async function SignupPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[40rem] -translate-x-1/2 rounded-full bg-brand-500/15 blur-3xl"
      />
      <div className="relative w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Link href="/">
            <Logo />
          </Link>
        </div>
        <div className="card p-6 shadow-2xl sm:p-8">
          <h1 className="text-xl font-black">無料で始める</h1>
          <p className="mb-6 mt-1 text-sm text-slate-400">
            メールアドレスとパスワードを設定します。確認メールのリンクで登録が完了します。
          </p>
          <AuthForm mode="signup" />
          <p className="mt-4 text-center text-xs text-slate-500">
            クレジットカード不要 ・ 監視3商品まで無料
          </p>
        </div>
        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/" className="hover:text-brand-300">
            ← トップに戻る
          </Link>
        </p>
      </div>
    </main>
  );
}
