/**
 * Skeleton fidèle au layout final de la page profil.
 * Affiché pendant le chargement initial via React Query.
 */
export default function UserProfileSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-6 lg:py-8">
      {/* Hero skeleton */}
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950 lg:mb-6">
        <div className="flex items-center gap-5">
          <div className="h-20 w-20 shrink-0 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
          <div className="flex-1 space-y-2">
            <div className="h-7 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-4 w-64 animate-pulse rounded bg-slate-100 dark:bg-slate-900" />
          </div>
        </div>
        <div className="mt-4 h-4 w-3/4 animate-pulse rounded bg-slate-100 dark:bg-slate-900" />
      </div>

      {/* Layout 2 cols */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-6">
        {/* Main */}
        <main className="space-y-4 lg:space-y-5 lg:order-1">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-[68px] animate-pulse rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
              />
            ))}
          </div>

          {/* Tripper block */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-5 h-5 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            <div className="mb-6 flex flex-wrap gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-7 w-32 animate-pulse rounded-full bg-slate-100 dark:bg-slate-900"
                />
              ))}
            </div>
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded-xl border border-slate-200 dark:border-slate-800"
                />
              ))}
            </div>
          </div>

          {/* Shipper block */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-5 h-5 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={i}
                  className="h-20 animate-pulse rounded-xl bg-slate-50 dark:bg-slate-900/40"
                />
              ))}
            </div>
          </div>
        </main>

        {/* Sidebar */}
        <aside className="lg:order-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-2 h-9 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
            <div className="h-9 animate-pulse rounded-full bg-slate-100 dark:bg-slate-900" />
          </div>
        </aside>
      </div>
    </div>
  );
}
