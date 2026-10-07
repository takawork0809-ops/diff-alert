"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GuideHow, GuideSteps } from "@/components/UsageGuide";

const STORAGE_KEY = "diffalert_welcome_seen";

// 初めてダッシュボードを開いたブラウザでだけ表示する。閉じた記録はブラウザ(localStorage)に残す。
export default function WelcomeModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);
    } catch {
      // localStorage が使えない環境では表示しない(毎回出て邪魔になるのを避ける)
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // 保存できなくても閉じる
    }
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-white/10 bg-navy-900 p-5 shadow-2xl sm:rounded-2xl sm:p-7">
        <p className="text-xs font-bold tracking-widest text-brand-400">WELCOME</p>
        <h2 id="welcome-title" className="mt-1 text-xl font-black sm:text-2xl">
          差益レーダーへようこそ
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          Amazonで売れる価格と、楽天で仕入れられる価格の差を毎朝チェックして、利益が出るタイミングをメールでお知らせします。使い方は3ステップです。
        </p>

        <div className="mt-5">
          <GuideSteps />
        </div>

        <div className="mt-5 rounded-xl border border-white/10 bg-navy-800/40 p-4">
          <GuideHow />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="button" onClick={close} className="btn-primary">
            はじめる
          </button>
          <Link href="/dashboard/guide" onClick={close} className="text-sm text-slate-400 underline hover:text-brand-300">
            詳しい使い方を見る
          </Link>
        </div>
      </div>
    </div>
  );
}
