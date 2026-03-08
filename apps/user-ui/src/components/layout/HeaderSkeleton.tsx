"use client";

function ShimmerBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-slate-200/90 dark:bg-slate-800/80 ${className}`}
    >
      <div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/70 to-transparent dark:via-white/10"
        style={{ animation: "yambaShimmer 1.6s infinite" }}
      />
    </div>
  );
}

export default function HeaderSkeleton() {
  return (
    <header className="fixed inset-x-0 top-0 z-[100] border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
      <div className="mx-auto flex h-[78px] max-w-6xl items-center justify-between px-4">
        {/* Left */}
        <div className="flex items-center gap-3">
          <ShimmerBlock className="h-9 w-9 rounded-xl" />
          <div className="flex items-center gap-2">
            <ShimmerBlock className="h-7 w-28 rounded-md" />
            <ShimmerBlock className="h-5 w-12 rounded-full" />
          </div>
        </div>

        {/* Desktop right */}
        <div className="hidden items-center gap-4 md:flex">
          <ShimmerBlock className="h-10 w-32 rounded-xl" />
          <ShimmerBlock className="h-10 w-10 rounded-xl" />
          <ShimmerBlock className="h-5 w-20 rounded-md" />
          <div className="flex items-center">
            <ShimmerBlock className="h-10 w-40 rounded-l-lg" />
            <ShimmerBlock className="h-10 w-11 rounded-r-lg" />
          </div>
        </div>

        {/* Mobile right */}
        <div className="flex items-center gap-2 md:hidden">
          <ShimmerBlock className="h-10 w-10 rounded-xl" />
          <ShimmerBlock className="h-10 w-10 rounded-xl" />
        </div>
      </div>
    </header>
  );
}
