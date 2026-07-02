/**
 * BookingTrackerSkeleton.tsx
 * ==========================
 * État de chargement du BookingTracker.
 * S'adapte mobile/desktop, sans saut visuel quand les données arrivent.
 */

"use client";

export default function BookingTrackerSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-4 sm:px-6 sm:pt-6">
        {/* Header */}
        <div className="mb-3 h-3 w-12 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-8 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-800 sm:h-9 sm:w-60" />
        <div className="mt-2 h-3 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />

        {/* Banner */}
        <div className="my-5 h-16 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />

        {/* Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <div className="h-24 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-32 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-48 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-40 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
          </div>
          <div className="hidden lg:block">
            <div className="space-y-4">
              <div className="h-40 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
              <div className="h-44 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
