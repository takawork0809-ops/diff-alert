import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Logo from "@/components/Logo";
import AuthForm from "@/components/AuthForm";

export const metadata = { title: "ログイン | 差益レーダー" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
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
          <h1 className="text-xl font-black">ログイン</h1>
          <p className="mb-6 mt-1 text-sm text-slate-400">
            登録済みのメールアドレスでログインします。
          </p>
          <AuthForm mode="login" authError={searchParams.error === "auth"} />
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
