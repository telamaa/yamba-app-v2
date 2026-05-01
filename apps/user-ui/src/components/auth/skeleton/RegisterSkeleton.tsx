"use client";

const skel = "animate-pulse rounded-md bg-slate-200 dark:bg-slate-800";

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`${skel} ${className}`} />;
}

export default function RegisterSkeleton() {
  return (
    <main className="lg:grid lg:grid-cols-2 lg:min-h-[calc(100vh-64px)]">
      {/* LEFT */}
      <div className="hidden lg:flex lg:flex-col lg:justify-between lg:gap-4 lg:bg-gradient-to-b lg:from-[#FFF7E8] lg:to-white lg:p-6 dark:lg:from-[#1F1408] dark:lg:to-slate-950">
        <div className="space-y-2">
          <SkeletonBlock className="h-6 w-3/4" />
          <SkeletonBlock className="h-3 w-full" />
          <SkeletonBlock className="h-3 w-2/3" />
        </div>
        <div className="flex items-center justify-center">
          <SkeletonBlock className="h-32 w-60 rounded-xl" />
        </div>
        <div className="grid grid-cols-3 gap-2 border-y border-slate-200 py-3 dark:border-slate-800">
          <SkeletonBlock className="h-8" />
          <SkeletonBlock className="h-8" />
          <SkeletonBlock className="h-8" />
        </div>
        <SkeletonBlock className="h-14 rounded-lg" />
      </div>

      {/* RIGHT */}
      <div className="flex items-center justify-center px-4 py-8 lg:px-8 lg:py-10">
        <div className="w-full max-w-[380px] space-y-3">
          <SkeletonBlock className="h-5 w-28 rounded-full" />
          <SkeletonBlock className="h-7 w-3/4" />
          <SkeletonBlock className="h-3 w-2/3" />

          <div className="pt-3 space-y-2">
            <SkeletonBlock className="h-10 rounded-lg" />
            <SkeletonBlock className="h-10 rounded-lg" />
          </div>

          <SkeletonBlock className="my-3 h-3 w-full" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <SkeletonBlock className="h-3 w-16" />
              <SkeletonBlock className="mt-2 h-10 rounded-lg" />
            </div>
            <div>
              <SkeletonBlock className="h-3 w-12" />
              <SkeletonBlock className="mt-2 h-10 rounded-lg" />
            </div>
          </div>

          <SkeletonBlock className="h-3 w-12" />
          <SkeletonBlock className="h-10 rounded-lg" />

          <SkeletonBlock className="h-3 w-24" />
          <SkeletonBlock className="h-10 rounded-lg" />

          <SkeletonBlock className="h-3 w-32" />
          <SkeletonBlock className="h-10 rounded-lg" />

          <SkeletonBlock className="my-2 h-10 w-full" />

          <SkeletonBlock className="h-10 rounded-lg" />
          <SkeletonBlock className="mx-auto mt-4 h-3 w-2/3" />
        </div>
      </div>
    </main>
  );
}
