/**
 * DealRequestSkeleton.tsx
 * =======================
 * Skeleton affiché pendant le chargement de la demande de Deal.
 * Mime la structure de la page finale (responsive desktop/mobile) pour
 * éviter le layout shift et donner une impression de réactivité.
 */

"use client";

export default function DealRequestSkeleton() {
  return (
    <div className="min-h-screen animate-pulse bg-slate-50 dark:bg-slate-950">
      {/* Mobile header (hidden lg+) */}
      <div className="border-b border-slate-200 px-4 py-3 lg:hidden dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-slate-200 dark:bg-slate-800" />
          <div className="flex-1 space-y-1.5">
            <Bar w="w-44" h="h-4" />
            <Bar w="w-24" h="h-3" />
          </div>
        </div>
      </div>

      {/* Mobile expiry banner */}
      <div className="h-10 border-b border-slate-200 bg-slate-200/60 lg:hidden dark:border-slate-800 dark:bg-slate-800/60" />

      <div className="mx-auto max-w-7xl px-4 pb-16 pt-4 sm:px-6 sm:pt-6">
        {/* Desktop header (hidden on mobile) */}
        <div className="hidden lg:block">
          <Bar w="w-16" h="h-4" className="mb-4" />
          <Bar w="w-[28rem]" h="h-9" className="mb-2" />
          <Bar w="w-[20rem]" h="h-4" className="mb-6" />
          <div className="mb-6 inline-block h-9 w-48 rounded-lg bg-slate-200 dark:bg-slate-800" />
        </div>

        {/* Grid */}
        <div className="mt-4 grid grid-cols-1 gap-6 lg:mt-0 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* Main column */}
          <div className="space-y-6">
            <Card height="h-[88px]" />      {/* Shipper */}
            <Card height="h-[180px]" />     {/* Parcel details */}
            <PhotosSkeleton />              {/* Photos */}
            <Card height="h-[180px]" />     {/* Locations */}
            <Card height="h-[160px]" />     {/* Tip */}
            <Card height="h-[300px]" />     {/* Charter */}
          </div>

          {/* Sidebar (hidden mobile) */}
          <aside className="hidden space-y-4 lg:block">
            <Card height="h-[260px]" />     {/* Earnings card */}
            <Card height="h-[120px]" />     {/* Coverage */}
            <Card height="h-[180px]" />     {/* Actions */}
          </aside>
        </div>
      </div>

      {/* Mobile bottom-bar */}
      <div className="sticky bottom-0 border-t border-slate-200 bg-white px-4 py-3 lg:hidden dark:border-slate-700 dark:bg-slate-950">
        <div className="mb-2 flex items-center justify-center">
          <Bar w="w-44" h="h-3" />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="h-11 rounded-full bg-slate-200 dark:bg-slate-800" />
          <div className="h-11 rounded-full bg-slate-200 dark:bg-slate-800" />
        </div>
      </div>
    </div>
  );
}

function Bar({
               w,
               h = "h-5",
               className = "",
             }: {
  w: string;
  h?: string;
  className?: string;
}) {
  return (
    <div className={`${h} ${w} rounded bg-slate-200 dark:bg-slate-800 ${className}`} />
  );
}

function Card({ height }: { height: string }) {
  return (
    <div className={`${height} rounded-2xl bg-slate-200 dark:bg-slate-800`} />
  );
}

function PhotosSkeleton() {
  return (
    <div>
      <Bar w="w-48" h="h-3" className="mb-2.5" />
      <div className="flex flex-wrap gap-3">
        <div className="h-[140px] w-[140px] rounded-xl bg-slate-200 sm:h-[150px] sm:w-[150px] dark:bg-slate-800" />
        <div className="h-[140px] w-[140px] rounded-xl bg-slate-200 sm:h-[150px] sm:w-[150px] dark:bg-slate-800" />
      </div>
    </div>
  );
}
