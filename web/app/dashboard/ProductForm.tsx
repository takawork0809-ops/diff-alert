"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { addProduct, type FormState } from "./actions";
import Link from "next/link";
import { CATEGORY_LABELS, type Category } from "@/lib/types";

const initial: FormState = { ok: false, message: "" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full sm:w-auto">
      {pending ? "登録中…" : "登録する"}
    </button>
  );
}

export default function ProductForm({ disabled }: { disabled: boolean }) {
  const [state, formAction] = useFormState(addProduct, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="card p-5 sm:p-6">
      <h2 className="text-base font-black">商品を登録</h2>
      <p className="mt-1 text-xs text-slate-400">
        監視したいAmazon商品と、同じ商品の楽天ページを登録します。
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="asin" className="label">
            ASIN
          </label>
          <input
            id="asin"
            name="asin"
            required
            maxLength={10}
            minLength={10}
            placeholder="B0CPL68SZN"
            className="input font-num uppercase"
            autoComplete="off"
          />
          <p className="mt-1 text-[11px] text-slate-500">AmazonのURLの「/dp/」の後ろの10桁</p>
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
        <div className="md:col-span-2">
          <label htmlFor="rakuten_url" className="label">
            楽天URL
          </label>
          <input
            id="rakuten_url"
            name="rakuten_url"
            type="url"
            required
            placeholder="https://item.rakuten.co.jp/shop/item/"
            className="input"
          />
          <p className="mt-1 text-[11px] text-slate-500">楽天市場(item.rakuten.co.jp)の同じ商品のページ</p>
        </div>
        <div>
          <label htmlFor="target_margin" className="label">
            目標純利益(円)
          </label>
          <input
            id="target_margin"
            name="target_margin"
            type="number"
            min={0}
            step={1}
            required
            defaultValue={1000}
            className="input font-num"
          />
          <p className="mt-1 text-[11px] text-slate-500">手数料を引いた後に、最低いくら残したいか</p>
        </div>
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
            監視の上限に達しています。
            <Link href="/dashboard/billing" className="ml-1 underline">
              プランを見る
            </Link>
          </span>
        )}
      </div>
    </form>
  );
}
