import Link from "next/link";
import { LEGAL } from "@/lib/legal";

export default function SiteFooter() {
  return (
    <footer className="border-t border-white/5 py-8 text-center text-xs text-slate-500">
      <nav className="mb-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
        <Link href="/terms" className="hover:text-brand-300">
          利用規約
        </Link>
        <Link href="/privacy" className="hover:text-brand-300">
          プライバシーポリシー
        </Link>
        <Link href="/tokushoho" className="hover:text-brand-300">
          特定商取引法に基づく表記
        </Link>
      </nav>
      © 2026 {LEGAL.service}
    </footer>
  );
}
