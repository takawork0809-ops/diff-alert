import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Logo from "@/components/Logo";
import PasswordForm from "./PasswordForm";

export const metadata = { title: "アカウント設定 | 差益レーダー" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-white/5 bg-navy-950/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/dashboard">
            <Logo />
          </Link>
          <form action="/auth/signout" method="post">
            <button type="submit" className="btn-ghost">
              ログアウト
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-6 px-4 py-8 sm:px-6">
        <Link href="/dashboard" className="text-sm text-slate-400 hover:text-brand-300">
          ← ダッシュボードに戻る
        </Link>

        <section className="card p-5 sm:p-6">
          <h1 className="text-base font-black">アカウント</h1>
          <dl className="mt-4 text-sm">
            <dt className="text-xs text-slate-400">メールアドレス</dt>
            <dd className="mt-1 font-medium">{user.email}</dd>
          </dl>
        </section>

        <section className="card p-5 sm:p-6">
          <h2 className="text-base font-black">パスワードの設定・変更</h2>
          <p className="mb-5 mt-1 text-xs leading-relaxed text-slate-400">
            メールのリンクでログインした方は、ここでパスワードを設定すると、次回からメールアドレスとパスワードでもログインできます。
            すでに設定済みの場合は、新しいパスワードに変更されます。
          </p>
          <PasswordForm />
        </section>
      </main>
    </div>
  );
}
