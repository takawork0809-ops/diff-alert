"use client";

import { useEffect, useRef } from "react";
import { buildBookmarklet } from "@/lib/bookmarklet";
import { SITE_URL } from "@/lib/site";

export default function BookmarkletButton() {
  const ref = useRef<HTMLAnchorElement>(null);
  // javascript: のリンクは、Reactが警告を出すため、描画後に、直接 href を設定する
  useEffect(() => {
    ref.current?.setAttribute("href", buildBookmarklet(SITE_URL));
  }, []);
  return (
    <a
      ref={ref}
      href="#"
      onClick={(e) => {
        // 画面の上で押しても動かない(Amazonの商品ページで押すもの)。ドラッグして、ブックマークバーに追加する。
        if (!(e.currentTarget.getAttribute("href") ?? "").startsWith("javascript:")) return;
        e.preventDefault();
        alert("このボタンは、ブックマークバーに、ドラッグして追加してください。使うのは、Amazonの商品ページです。");
      }}
      draggable
      className="btn-primary cursor-grab px-5 py-3 text-sm"
    >
      📌 差益レーダーに追加
    </a>
  );
}
