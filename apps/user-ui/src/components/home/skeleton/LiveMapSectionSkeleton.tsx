"use client";

export default function LiveMapSectionSkeleton() {
  return (
    <section className="bg-slate-950 py-14 md:py-20">
      <div className="mx-auto max-w-5xl px-4">
        {/* Header skeleton */}
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <div className="mx-auto h-3 w-20 animate-pulse rounded bg-white/10" />
          <div className="mx-auto mt-3 h-9 w-3/4 animate-pulse rounded-lg bg-white/10 md:h-12" />
          <div className="mx-auto mt-3 h-4 w-1/2 animate-pulse rounded bg-white/10" />
        </div>

        {/* Desktop : carte skeleton */}
        <div className="relative hidden md:block">
          <div className="h-[440px] animate-pulse rounded-[20px] bg-slate-900" />
          <div className="absolute left-4 top-4 flex flex-col gap-1.5">
            <div className="h-12 w-24 animate-pulse rounded-xl bg-slate-800" />
            <div className="h-12 w-24 animate-pulse rounded-xl bg-slate-800" />
          </div>
        </div>

        {/* Mobile : stats cards skeleton */}
        <div className="grid grid-cols-2 gap-3 md:hidden">
          <div className="h-32 animate-pulse rounded-2xl bg-slate-900" />
          <div className="h-32 animate-pulse rounded-2xl bg-slate-900" />
          <div className="col-span-2 h-28 animate-pulse rounded-2xl bg-slate-900" />
        </div>

        {/* CTA skeleton */}
        <div className="mt-6 text-center">
          <div className="mx-auto h-5 w-48 animate-pulse rounded bg-white/10" />
        </div>
      </div>
    </section>
  );
}
