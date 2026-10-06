"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("same") && m.includes("password")) return "現在と同じパスワードは設定できません。別のパスワードを入力してください。";
  if (m.includes("reauth")) return "セキュリティ上、再ログインが必要です。一度ログアウトして、ログインし直してからお試しください。";
  if (m.includes("password") && (m.includes("character") || m.includes("short") || m.includes("weak")))
    return "パスワードは8文字以上の、推測されにくいものにしてください。";
  if (m.includes("rate") || m.includes("too many")) return "短時間に操作しすぎています。しばらくしてからお試しください。";
  return `設定に失敗しました: ${message}`;
}

export default function PasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    if (password !== confirm) {
      setStatus("error");
      setMessage("パスワードが一致しません。もう一度入力してください。");
      return;
    }
    setStatus("saving");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setStatus("error");
      setMessage(friendlyError(error.message));
      return;
    }
    setPassword("");
    setConfirm("");
    setStatus("done");
    setMessage("パスワードを設定しました。次回からメールアドレスとパスワードでログインできます。");
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
        <p
          role={status === "error" ? "alert" : "status"}
          className={`rounded-lg px-3 py-2 text-sm ${
            status === "done" ? "bg-brand-500/10 text-brand-300" : "bg-red-500/10 text-red-300"
          }`}
        >
          {message}
        </p>
      )}

      <button type="submit" disabled={status === "saving"} className="btn-primary">
        {status === "saving" ? "保存中…" : "パスワードを設定する"}
      </button>
    </form>
  );
}
