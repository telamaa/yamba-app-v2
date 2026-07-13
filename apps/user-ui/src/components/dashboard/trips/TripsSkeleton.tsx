"use client";

function SkeletonActionRow() {
  return (
    <div className="mb-1.5 flex items-center gap-3 rounded-lg bg-white px-4 py-3 dark:bg-slate-950">
      <div className="h-10 w-10 flex-shrink-0 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-3.5 w-1/2 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
        <div className="h-3 w-3/5 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
      </div>
      <div className="hidden h-5 w-24 animate-pulse rounded-full bg-slate-100 md:block dark:bg-slate-800" />
      <div className="hidden h-7 w-24 animate-pulse rounded-lg bg-slate-100 md:block dark:bg-slate-800" />
    </div>
  );
}

function SkeletonTripCard() {
  return (
    <div className="mb-3 rounded-xl bg-white p-4 dark:bg-slate-950">
      <div className="flex items-center gap-3.5">
        <div className="h-11 w-11 flex-shrink-0 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3.5 w-2/3 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
        </div>
        <div className="hidden h-9 w-32 animate-pulse rounded bg-slate-100 sm:block dark:bg-slate-800" />
      </div>
    </div>
  );
}

export default function TripsSkeleton() {
  return (
    <div aria-hidden>
      <div className="mb-2 h-3 w-24 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
      <SkeletonActionRow />
      <SkeletonActionRow />
      <SkeletonActionRow />

      <div className="mb-2 mt-7 h-3 w-28 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
      <SkeletonTripCard />
      <SkeletonTripCard />
    </div>
  );
}
