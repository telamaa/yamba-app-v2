"use client";

function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={[
        "rounded-xl bg-slate-200/90 dark:bg-slate-800/80",
        "animate-pulse",
        className,
      ].join(" ")}
    />
  );
}

export default function LoginFormSkeleton() {
  return (
    <main className="px-4">
      <div className="mx-auto flex min-h-[85vh] max-w-6xl items-center justify-center py-10">
        <div className="w-full max-w-[420px]">
          <SkeletonBlock className="h-9 w-64 rounded-md" />
          <SkeletonBlock className="mt-3 h-4 w-72 rounded-md" />

          <div className="mt-8 space-y-5">
            <div>
              <SkeletonBlock className="h-4 w-16 rounded-md" />
              <SkeletonBlock className="mt-2 h-[46px] w-full rounded-lg" />
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <SkeletonBlock className="h-4 w-24 rounded-md" />
                <SkeletonBlock className="h-4 w-28 rounded-md" />
              </div>
              <SkeletonBlock className="mt-2 h-[46px] w-full rounded-lg" />
            </div>

            <div className="flex items-center gap-3">
              <SkeletonBlock className="h-4 w-4 rounded-sm" />
              <SkeletonBlock className="h-4 w-52 rounded-md" />
            </div>

            <SkeletonBlock className="h-[46px] w-full rounded-lg" />

            <div className="flex items-center gap-4 pt-1">
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              <SkeletonBlock className="h-3 w-8 rounded-md" />
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            </div>

            <div className="space-y-3">
              <SkeletonBlock className="h-[46px] w-full rounded-lg" />
              <SkeletonBlock className="h-[46px] w-full rounded-lg" />
            </div>

            <div className="flex justify-center pt-2">
              <SkeletonBlock className="h-4 w-48 rounded-md" />
            </div>
          </div>

          <SkeletonBlock className="mt-6 h-3 w-72 rounded-md" />
        </div>
      </div>
    </main>
  );
}
