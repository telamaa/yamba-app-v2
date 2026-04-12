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

export default function TripSearchBarSkeleton({ overlap = false }: { overlap?: boolean }) {
  return (
    <section className="mx-auto max-w-7xl px-4 overflow-visible">
      <div className={["relative overflow-visible", overlap ? "-mt-10" : ""].join(" ")}>
        <div className="relative z-[80] overflow-visible rounded-[28px] border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-950">
          <div className="grid gap-3 p-3 md:grid-cols-[1.2fr_1.2fr_0.9fr_auto] md:gap-0 md:p-0">
            <div className="px-4 py-3 md:py-4">
              <ShimmerBlock className="h-4 w-16 rounded-sm" />
              <ShimmerBlock className="mt-3 h-6 w-32 rounded-sm" />
            </div>

            <div className="px-4 py-3 md:py-4">
              <ShimmerBlock className="h-4 w-24 rounded-sm" />
              <ShimmerBlock className="mt-3 h-6 w-36 rounded-sm" />
            </div>

            <div className="px-4 py-3 md:py-4">
              <ShimmerBlock className="h-4 w-12 rounded-sm" />
              <ShimmerBlock className="mt-3 h-6 w-28 rounded-sm" />
            </div>

            <div className="flex items-center justify-end md:px-3 md:py-3">
              <ShimmerBlock className="h-10 w-full rounded-xl md:w-[234px]" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
