import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Logo from "@/components/Logo";
import ResetPasswordForm from "@/components/ResetPasswordForm";

export const metadata = { title: "新しいパスワードの設定 | 差益レーダー" };
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // メールのリンクから来ていない(セッションがない)場合は、再設定のメール送信からやり直す。
  if (!user) redirect("/forgot-password?error=link");

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
          <h1 className="text-xl font-black">新しいパスワードの設定</h1>
          <p className="mb-6 mt-1 text-sm text-slate-400">
            <span className="font-medium text-slate-200">{user.email}</span> の新しいパスワードを入力してください。設定後、ダッシュボードに移動します。
          </p>
          <ResetPasswordForm />
        </div>
      </div>
    </main>
  );
}
