import Link from "next/link";
import Logo from "@/components/Logo";
import ForgotPasswordForm from "@/components/ForgotPasswordForm";

export const metadata = { title: "パスワードを忘れた方 | 差益レーダー" };

export default function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
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
          <h1 className="text-xl font-black">パスワードを忘れた方</h1>
          <p className="mb-6 mt-1 text-sm text-slate-400">
            登録したメールアドレスに、パスワード再設定用のリンクを送ります。
          </p>
          <ForgotPasswordForm linkError={searchParams.error === "link"} />
        </div>
      </div>
    </main>
  );
}
