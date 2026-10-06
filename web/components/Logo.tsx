export default function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-black tracking-tight ${className}`}>
      <span className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-navy-950 shadow-glow">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 17l6-6 4 4 8-8" />
          <path d="M15 7h6v6" />
        </svg>
      </span>
      <span className="text-lg">差益レーダー</span>
    </span>
  );
}
