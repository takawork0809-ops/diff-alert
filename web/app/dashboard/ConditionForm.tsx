"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { addCondition, type FormState } from "./actions";
import { CATEGORY_LABELS, type Category } from "@/lib/types";
import { SOURCES, SOURCE_LABELS } from "@/lib/watch-conditions";

const initial: FormState = { ok: false, message: "" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full sm:w-auto">
      {pending ? "登録中…" : "条件を登録する"}
    </button>
  );
}

export default function ConditionForm({ disabled }: { disabled: boolean }) {
  const [state, formAction] = useFormState(addCondition, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="card p-5 sm:p-6">
      <h2 className="text-base font-black">探したい商品の条件を登録</h2>
      <p className="mt-1 text-xs leading-relaxed text-slate-400">
        キーワードと、最低いくら利益が残ってほしいかを登録すると、毎朝メルカリ・ヤフオクを自動で探し、Amazonの価格と比べて、利益が出る商品をお知らせします。
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label htmlFor="keyword" className="label">
            キーワード
          </label>
          <input
            id="keyword"
            name="keyword"
            required
            maxLength={80}
            placeholder="例: ポケモンカード BOX / PS5 コントローラー"
            className="input"
            autoComplete="off"
          />
          <p className="mt-1 text-[11px] text-slate-500">
            Amazonでも売れている、型番や商品名がはっきりした言葉が向いています(「まとめ売り」などの曖昧な言葉は、避けてください)
          </p>
        </div>

        <div>
          <label htmlFor="min_profit" className="label">
            最低純利益(円)
          </label>
          <input
            id="min_profit"
            name="min_profit"
            type="number"
            min={0}
            step={1}
            required
            defaultValue={1000}
            className="input font-num"
          />
          <p className="mt-1 text-[11px] text-slate-500">手数料を引いた後に、最低いくら残したいか</p>
        </div>

        <div>
          <label htmlFor="category" className="label">
            カテゴリ
          </label>
          <select id="category" name="category" defaultValue="other" className="input">
            {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>

        <fieldset className="md:col-span-2">
          <legend className="label">仕入れ先</legend>
          <div className="mt-1 flex flex-wrap gap-4">
            {SOURCES.map((s) => (
              <label key={s} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="sources" value={s} defaultChecked className="h-4 w-4 accent-brand-500" />
                {SOURCE_LABELS[s]}
              </label>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            ヤフオクは「即決価格」がある出品だけが対象です(入札だけの出品は、最終価格が分からないため)
          </p>
        </fieldset>
      </div>

      {state.message && (
        <p
          role="status"
          className={`mt-4 rounded-lg px-3 py-2 text-sm ${
            state.ok ? "bg-brand-500/10 text-brand-300" : "bg-red-500/10 text-red-300"
          }`}
        >
          {state.message}
        </p>
      )}

      <div className="mt-5 flex items-center gap-3">
        <SubmitButton />
        {disabled && (
          <span className="text-xs text-amber-300">
            条件数の上限に達しています。
            <Link href="/dashboard/billing" className="ml-1 underline">
              プランを見る
            </Link>
          </span>
        )}
      </div>
    </form>
  );
}
