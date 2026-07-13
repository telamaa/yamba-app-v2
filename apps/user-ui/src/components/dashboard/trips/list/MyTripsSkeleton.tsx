"use client";

/**
 * Skeleton de Mes trajets (vue réelle) — miroir de la structure :
 * header + chips filtres + 2 groupes de rows.
 */

function SkeletonRow() {
  return (
    <div className="mb-1.5 flex items-center gap-3 rounded-lg bg-white px-4 py-3 dark:bg-slate-950">
      <div className="h-10 w-10 flex-shrink-0 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-3.5 w-2/5 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
        <div className="h-3 w-3/5 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
      </div>
      <div className="hidden h-5 w-20 animate-pulse rounded-full bg-slate-100 sm:block dark:bg-slate-800" />
      <div className="h-8 w-8 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
    </div>
  );
}

export default function MyTripsSkeleton() {
  return (
    <div aria-hidden>
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div className="h-6 w-32 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
        <div className="h-9 w-40 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
      </div>

      {/* Chips filtres */}
      <div className="mb-6 flex gap-2">
        <div className="h-7 w-16 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
        <div className="h-7 w-24 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
        <div className="h-7 w-20 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
        <div className="h-7 w-24 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
      </div>

      {/* Groupe 1 */}
      <div className="mb-2 h-3 w-24 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
      <SkeletonRow />
      <SkeletonRow />

      {/* Groupe 2 */}
      <div className="mb-2 mt-7 h-3 w-28 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
    </div>
  );
}
