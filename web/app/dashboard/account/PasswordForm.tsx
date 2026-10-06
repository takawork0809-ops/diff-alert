"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Step = "request" | "verify" | "done";

// context: "send" = 確認コードの送信時 / "update" = パスワード更新時
function friendlyError(message: string, context: "send" | "update"): string {
  const m = message.toLowerCase();
  if (m.includes("rate") || m.includes("too many") || m.includes("seconds"))
    return "短時間に操作しすぎています。しばらくしてからお試しください。";
  if (context === "send") {
    if (m.includes("email address") && (m.includes("invalid") || m.includes("not authorized")))
      return "このメールアドレスには確認コードを送信できません。";
    return `確認コードの送信に失敗しました: ${message}`;
  }
  if (m.includes("same") && m.includes("password")) return "現在と同じパスワードは設定できません。別のパスワードを入力してください。";
  if (m.includes("nonce") || m.includes("reauth") || m.includes("expired") || m.includes("invalid"))
    return "確認コードが正しくないか、期限切れです。コードを送り直してください。";
  if (m.includes("password") && (m.includes("character") || m.includes("short") || m.includes("weak")))
    return "パスワードは8文字以上の、推測されにくいものにしてください。";
  return `パスワードの設定に失敗しました: ${message}`;
}

export default function PasswordForm({ email }: { email: string }) {
  const [step, setStep] = useState<Step>("request");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function sendCode() {
    setBusy(true);
    setMessage("");
    const { error } = await createClient().auth.reauthenticate();
    setBusy(false);
    if (error) {
      setMessage(friendlyError(error.message, "send"));
      return;
    }
    setStep("verify");
    setMessage(`${email} に確認コードを送信しました。メールに記載のコードを入力してください。`);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    if (password !== confirm) {
      setMessage("パスワードが一致しません。もう一度入力してください。");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password, nonce: code.trim() });
    if (error) {
      setBusy(false);
      setMessage(friendlyError(error.message, "update"));
      return;
    }
    // パスワード変更後は、他の端末・ブラウザのログインを無効にする(盗まれたセッションを残さない)。
    await supabase.auth.signOut({ scope: "others" });
    setBusy(false);
    setPassword("");
    setConfirm("");
    setCode("");
    setStep("done");
    setMessage("パスワードを設定しました。次回からメールアドレスとパスワードでログインできます。他の端末のログインは解除されました。");
  }

  if (step === "done") {
    return (
      <p role="status" className="rounded-lg bg-brand-500/10 px-3 py-2 text-sm text-brand-300">
        {message}
      </p>
    );
  }

  if (step === "request") {
    return (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-slate-300">
          安全のため、パスワードの設定・変更の前に、登録メールアドレス宛ての<strong>確認コード</strong>で本人確認を行います。
        </p>
        {message && (
          <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {message}
          </p>
        )}
        <button type="button" onClick={sendCode} disabled={busy} className="btn-primary">
          {busy ? "送信中…" : "確認コードをメールで送る"}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {message && (
        <p role="status" className="rounded-lg bg-brand-500/10 px-3 py-2 text-sm text-brand-300">
          {message}
        </p>
      )}
      <div>
        <label htmlFor="otp-code" className="label">
          確認コード(メールに記載)
        </label>
        <input
          id="otp-code"
          inputMode="numeric"
          required
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="input font-num tracking-widest"
        />
      </div>
      <div>
        <label htmlFor="new-password" className="label">
          新しいパスワード(8文字以上)
        </label>
        <input
          id="new-password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input"
        />
      </div>
      <div>
        <label htmlFor="new-password-confirm" className="label">
          新しいパスワード(確認用)
        </label>
        <input
          id="new-password-confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="input"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? "保存中…" : "パスワードを設定する"}
        </button>
        <button type="button" onClick={sendCode} disabled={busy} className="text-xs text-slate-400 underline hover:text-brand-300">
          コードを送り直す
        </button>
      </div>
    </form>
  );
}
