"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup";
type Status = "idle" | "sending" | "sent" | "error";

function friendlyError(message: string, mode: Mode, viaLink: boolean): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "メールアドレスまたはパスワードが違います。";
  if (m.includes("email not confirmed")) return "メール認証が完了していません。届いた確認メールのリンクをクリックしてください。";
  if (m.includes("rate") || m.includes("too many")) return "短時間に送信しすぎています。しばらくしてからもう一度お試しください。";
  if (m.includes("password") && m.includes("character")) return "パスワードは8文字以上で入力してください。";
  if (mode === "signup" && m.includes("already")) return "このメールアドレスは登録済みです。ログインしてください。";
  return viaLink ? `送信に失敗しました: ${message}` : `エラーが発生しました: ${message}`;
}

export default function AuthForm({ mode, authError = false }: { mode: Mode; authError?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [viaLink, setViaLink] = useState(false); // ログイン時: パスワードなしでメールのリンクを使う
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState(
    authError ? "認証リンクが無効か期限切れです。もう一度お試しください。" : ""
  );

  const isSignup = mode === "signup";
  const needsPassword = isSignup || !viaLink;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSignup && password !== passwordConfirm) {
      setStatus("error");
      setMessage("パスワードが一致しません。もう一度入力してください。");
      return;
    }
    setStatus("sending");
    setMessage("");
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback`;

    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectTo },
        });
        if (error) throw error;
        if (data.session) {
          router.push("/dashboard");
          router.refresh();
          return;
        }
        setStatus("sent");
        return;
      }

      if (viaLink) {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
        });
        if (error) throw error;
        setStatus("sent");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      const raw = ((err as Error).message ?? String(err)).toLowerCase();
      // 未登録かどうかを画面で出し分けない(アカウントの存在確認に悪用されるため)。
      if (viaLink && (raw.includes("signups not allowed") || raw.includes("not allowed for otp"))) {
        setStatus("sent");
        return;
      }
      setStatus("error");
      setMessage(friendlyError((err as Error).message ?? String(err), mode, viaLink));
    }
  }

  if (status === "sent") {
    return (
      <div className="rounded-xl border border-brand-500/40 bg-brand-500/10 p-5 text-center">
        <p className="text-2xl">📩</p>
        <p className="mt-2 font-bold text-brand-300">
          {isSignup ? "確認メールを送信しました" : "ログイン用のメールを送信しました"}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          <span className="font-semibold text-white">{email}</span> 宛てのメールに記載のリンクをクリックすると、
          {isSignup ? "メール認証が完了し、ダッシュボードが開きます。" : "ダッシュボードが開きます。"}
          届かない場合は迷惑メールフォルダもご確認ください。
        </p>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          {isSignup
            ? "すでに登録済みのメールアドレスの場合は、確認メールは届きません。"
            : "登録済みのメールアドレスの場合のみ、メールが届きます。"}
          <Link href={isSignup ? "/login" : "/signup"} className="ml-1 text-brand-300 underline">
            {isSignup ? "ログインはこちら" : "はじめての方はこちら"}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="label">
          メールアドレス
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="input"
        />
      </div>

      {needsPassword && (
        <div>
          <label htmlFor="password" className="label">
            パスワード{isSignup && "(8文字以上)"}
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={isSignup ? 8 : undefined}
            autoComplete={isSignup ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
        </div>
      )}

      {isSignup && (
        <div>
          <label htmlFor="password-confirm" className="label">
            パスワード(確認用)
          </label>
          <input
            id="password-confirm"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            className="input"
          />
        </div>
      )}

      {!isSignup && !viaLink && (
        <p className="-mt-2 text-right text-xs">
          <Link href="/forgot-password" className="text-slate-400 underline-offset-2 hover:text-brand-300 hover:underline">
            パスワードを忘れた方
          </Link>
        </p>
      )}

      {message && (
        <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {message}
        </p>
      )}

      <button type="submit" disabled={status === "sending"} className="btn-primary w-full">
        {status === "sending"
          ? "送信中…"
          : isSignup
          ? "無料アカウントを作成"
          : viaLink
          ? "ログインリンクをメールで送る"
          : "ログイン"}
      </button>

      {!isSignup && (
        <button
          type="button"
          onClick={() => {
            setViaLink((v) => !v);
            setMessage("");
          }}
          className="w-full text-center text-xs text-slate-400 underline-offset-2 hover:text-brand-300 hover:underline"
        >
          {viaLink ? "パスワードでログインする" : "パスワードなしで、メールのリンクでログインする"}
        </button>
      )}

      <p className="border-t border-white/5 pt-4 text-center text-sm text-slate-400">
        {isSignup ? (
          <>
            すでにアカウントをお持ちの方は{" "}
            <Link href="/login" className="font-bold text-brand-300 hover:underline">
              ログイン
            </Link>
          </>
        ) : (
          <>
            はじめての方は{" "}
            <Link href="/signup" className="font-bold text-brand-300 hover:underline">
              無料で始める
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
