"use client";

import { useMemo, useState, useTransition } from "react";
import { bulkAddProducts, type BulkResult } from "./actions";
import { parseBulkText } from "@/lib/bulk-parse";

const SAMPLE_CSV = [
  "ASIN(またはAmazonのURL),楽天URL,目標純利益,カテゴリ",
  "B0CPL68SZN,https://item.rakuten.co.jp/shop/item-001/,1000,その他",
  "https://www.amazon.co.jp/dp/B07HB1Z4GQ,https://item.rakuten.co.jp/shop/item-002/,500,家電",
].join("\r\n");

// Excel(日本語環境)が書き出すCSVは、Shift_JIS のことが多い。UTF-8 として読めなければ、Shift_JIS で読み直す。
async function readTextFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder("shift_jis").decode(buf);
  }
}

export default function BulkImport({
  remaining,
  planName,
  limit,
  existingAsins,
}: {
  remaining: number;
  planName: string;
  limit: number;
  existingAsins: string[];
}) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<BulkResult | null>(null);
  const [fileError, setFileError] = useState("");
  const [pending, startTransition] = useTransition();

  const parsed = useMemo(() => parseBulkText(text), [text]);
  const existing = useMemo(() => new Set(existingAsins), [existingAsins]);
  const okRows = parsed.rows.filter((r) => r.ok);
  const duplicateCount = okRows.filter((r) => r.asin && existing.has(r.asin)).length; // すでに登録済みの商品
  const newCount = okRows.length - duplicateCount;
  const willAdd = Math.min(newCount, remaining);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFileError("");
    if (file.size > 1_000_000) {
      setFileError("ファイルが大きすぎます(1MBまで)。");
      return;
    }
    try {
      setText(await readTextFile(file));
      setResult(null);
    } catch {
      setFileError("ファイルを読み込めませんでした。");
    }
  }

  function downloadSample() {
    const blob = new Blob(["﻿" + SAMPLE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sagakuradar-sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function submit() {
    startTransition(async () => {
      const r = await bulkAddProducts(text);
      setResult(r);
      if (r.added > 0) setText("");
    });
  }

  return (
    <details className="card group p-5 sm:p-6">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <span>
          <span className="text-base font-black">まとめて登録</span>
          <span className="mt-1 block text-xs text-slate-400">複数の商品を、貼り付けやCSVファイルで、一度に登録します。</span>
        </span>
        <span className="text-xs text-slate-400 transition group-open:rotate-180" aria-hidden>
          ▼
        </span>
      </summary>

      <div className="mt-5 space-y-4">
        <div className="rounded-lg bg-black/20 p-3 text-xs leading-relaxed text-slate-300">
          <p className="font-bold text-slate-200">書き方(1行に1商品)</p>
          <p className="mt-1 font-num text-brand-300">ASINまたはAmazonのURL　楽天のURL　目標純利益　カテゴリ</p>
          <ul className="mt-2 list-disc space-y-0.5 pl-4 text-slate-400">
            <li>区切りは、スペース、タブ、カンマのどれでも構いません。</li>
            <li>目標純利益とカテゴリは、省略できます(省略すると、1,000円・その他になります)。</li>
            <li>カテゴリは、「家電」「ゲーム」「衣類」「その他」のいずれかを書きます(手数料率が、カテゴリごとに違います)。</li>
            <li>
              現在の残り枠は <span className="font-num text-slate-100">{remaining}</span> 商品です({planName}は{limit}商品まで)。
            </li>
          </ul>
        </div>

        <div>
          <label htmlFor="bulk-text" className="label">
            貼り付け
          </label>
          <textarea
            id="bulk-text"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setResult(null);
            }}
            rows={6}
            spellCheck={false}
            placeholder={"B0CPL68SZN https://item.rakuten.co.jp/shop/item-001/ 1000 家電\nhttps://www.amazon.co.jp/dp/B07HB1Z4GQ https://item.rakuten.co.jp/shop/item-002/"}
            className="input font-num text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <label className="btn-ghost cursor-pointer px-4 py-2 text-xs">
            CSVファイルを読み込む
            <input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={onFile} className="sr-only" />
          </label>
          <button type="button" onClick={downloadSample} className="text-slate-400 underline hover:text-brand-300">
            見本のCSVをダウンロード
          </button>
          {fileError && <span className="text-red-300">{fileError}</span>}
        </div>

        {parsed.rows.length > 0 && !result && (
          <div>
            <p className="mb-2 text-xs text-slate-300">
              確認: {parsed.rows.length}行のうち、<span className="font-bold text-brand-300">{willAdd}行が登録されます</span>
              {parsed.rows.length - okRows.length > 0 && (
                <span className="text-red-300">(読み取れない行が{parsed.rows.length - okRows.length}行あります)</span>
              )}
              {duplicateCount > 0 && <span className="text-slate-400">(すでに登録済みの{duplicateCount}行は、登録されません)</span>}
              {newCount > remaining && (
                <span className="text-amber-300">(残り枠が{remaining}商品のため、先頭の{remaining}商品だけを登録します)</span>
              )}
              {parsed.truncated && <span className="text-amber-300">(先頭の200行だけを処理します)</span>}
            </p>
            <div className="max-h-64 overflow-auto rounded-lg border border-white/10">
              <table className="w-full min-w-[34rem] text-left text-xs">
                <thead className="sticky top-0 bg-navy-800 text-slate-400">
                  <tr>
                    <th className="px-3 py-2 font-medium">行</th>
                    <th className="px-3 py-2 font-medium">ASIN</th>
                    <th className="px-3 py-2 font-medium">目標</th>
                    <th className="px-3 py-2 font-medium">状態</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {parsed.rows.map((r) => {
                    const registered = r.ok && !!r.asin && existing.has(r.asin);
                    return (
                      <tr key={r.line}>
                        <td className="px-3 py-1.5 font-num text-slate-500">{r.line}</td>
                        <td className="px-3 py-1.5 font-num">{r.asin ?? "—"}</td>
                        <td className="px-3 py-1.5 font-num">{r.targetMargin !== undefined ? `¥${r.targetMargin.toLocaleString("ja-JP")}` : "—"}</td>
                        <td className={`px-3 py-1.5 ${registered ? "text-slate-400" : r.ok ? "text-brand-300" : "text-red-300"}`}>
                          {registered ? "登録済み(登録されません)" : r.ok ? "OK" : r.error}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-2">
            <p
              role="status"
              className={`rounded-lg px-3 py-2 text-sm ${result.ok ? "bg-brand-500/10 text-brand-300" : "bg-red-500/10 text-red-300"}`}
            >
              {result.message}
            </p>
            {result.rows.some((r) => r.status !== "added") && (
              <ul className="max-h-48 overflow-auto rounded-lg border border-white/10 p-3 text-xs text-slate-300">
                {result.rows
                  .filter((r) => r.status !== "added")
                  .map((r) => (
                    <li key={r.line}>
                      <span className="font-num text-slate-500">{r.line}行目</span>
                      {r.asin && <span className="font-num"> {r.asin}</span>}: {r.message}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}

        <button type="button" onClick={submit} disabled={pending || willAdd === 0} className="btn-primary w-full sm:w-auto">
          {pending ? "登録中…" : willAdd > 0 ? `${willAdd}件を登録する` : "登録できる行がありません"}
        </button>
      </div>
    </details>
  );
}
