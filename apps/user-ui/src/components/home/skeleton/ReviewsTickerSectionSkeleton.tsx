"use client";

export default function ReviewsTickerSectionSkeleton() {
  return (
    <section className="bg-slate-50 py-12 dark:bg-slate-900 md:py-16">
      <div className="mx-auto max-w-7xl px-4">
        {/* Header skeleton (rating + titre) */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 h-5 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          <div className="mx-auto h-7 w-56 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        </div>

        {/* Ticker skeleton — 4 cards visibles */}
        <div className="flex gap-4 overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[160px] w-[320px] shrink-0 animate-pulse rounded-2xl bg-white dark:bg-slate-950"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
