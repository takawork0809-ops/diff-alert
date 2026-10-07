"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("same") && m.includes("password")) return "現在と同じパスワードは設定できません。別のパスワードを入力してください。";
  if (m.includes("password") && (m.includes("character") || m.includes("short") || m.includes("weak")))
    return "パスワードは8文字以上の、推測されにくいものにしてください。";
  if (m.includes("reauth") || m.includes("nonce"))
    return "本人確認の有効期限が切れました。もう一度、再設定のメールを送ってください。";
  if (m.includes("rate") || m.includes("too many")) return "短時間に操作しすぎています。しばらくしてからお試しください。";
  return `パスワードの設定に失敗しました: ${message}`;
}

export default function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    if (password !== confirm) {
      setMessage("パスワードが一致しません。もう一度入力してください。");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setBusy(false);
      setMessage(friendlyError(error.message));
      return;
    }
    // パスワード変更後は、他の端末・ブラウザのログインを無効にする(盗まれたセッションを残さない)。
    await supabase.auth.signOut({ scope: "others" });
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
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

      {message && (
        <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {message}
        </p>
      )}

      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy ? "保存中…" : "パスワードを設定する"}
      </button>
    </form>
  );
}
