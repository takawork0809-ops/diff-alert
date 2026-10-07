"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Status = "idle" | "sending" | "sent" | "error";

export default function ForgotPasswordForm({ linkError = false }: { linkError?: boolean }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState(
    linkError ? "再設定リンクが無効か、期限切れです。もう一度メールを送ってください。" : ""
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setMessage("");
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback/reset`,
    });
    // 未登録のメールアドレスでもエラーにならず、画面も変えない(アカウントの存在確認に悪用されないように)。
    if (error) {
      const m = error.message.toLowerCase();
      setStatus("error");
      setMessage(
        m.includes("rate") || m.includes("seconds") || m.includes("too many")
          ? "短時間に送信しすぎています。しばらくしてからもう一度お試しください。"
          : `送信に失敗しました: ${error.message}`
      );
      return;
    }
    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <div className="rounded-xl border border-brand-500/40 bg-brand-500/10 p-5 text-center">
        <p className="text-2xl">📩</p>
        <p className="mt-2 font-bold text-brand-300">再設定用のメールを送信しました</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          <span className="font-semibold text-white">{email}</span> 宛てのメールに記載のリンクをクリックして、新しいパスワードを設定してください。
          届かない場合は迷惑メールフォルダもご確認ください。
        </p>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          登録済みのメールアドレスの場合のみ、メールが届きます。リンクは、メールを送ったこのブラウザで開いてください。
          <Link href="/login" className="ml-1 text-brand-300 underline">
            ログインに戻る
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="label">
          登録したメールアドレス
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

      {message && (
        <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {message}
        </p>
      )}

      <button type="submit" disabled={status === "sending"} className="btn-primary w-full">
        {status === "sending" ? "送信中…" : "再設定用のメールを送る"}
      </button>

      <p className="border-t border-white/5 pt-4 text-center text-sm text-slate-400">
        <Link href="/login" className="font-bold text-brand-300 hover:underline">
          ログインに戻る
        </Link>
      </p>
    </form>
  );
}
