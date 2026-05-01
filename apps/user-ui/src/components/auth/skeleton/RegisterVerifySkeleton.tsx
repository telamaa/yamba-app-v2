"use client";

const skel = "animate-pulse rounded-md bg-slate-200 dark:bg-slate-800";

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`${skel} ${className}`} />;
}

export default function RegisterVerifySkeleton() {
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
        <div className="w-full max-w-[400px] space-y-4">
          <SkeletonBlock className="h-5 w-32 rounded-full" />
          <SkeletonBlock className="h-7 w-2/3" />
          <SkeletonBlock className="h-3 w-3/4" />

          {/* Email line */}
          <SkeletonBlock className="mt-3 h-12 rounded-lg" />

          {/* Timer */}
          <SkeletonBlock className="h-7 w-32 rounded-full" />

          {/* OTP boxes */}
          <div className="pt-4">
            <SkeletonBlock className="mx-auto mb-3 h-3 w-32" />
            <div className="flex justify-center gap-2 sm:gap-2.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonBlock key={i} className="h-12 w-10 rounded-lg sm:h-13 sm:w-11" />
              ))}
            </div>
            <SkeletonBlock className="mx-auto mt-3 h-3 w-2/3" />
          </div>

          {/* CTA */}
          <SkeletonBlock className="h-11 rounded-lg" />

          {/* Resend section */}
          <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
            <SkeletonBlock className="mx-auto mb-2 h-3 w-3/4" />
            <SkeletonBlock className="mx-auto h-4 w-32" />
          </div>

          {/* Cancel */}
          <SkeletonBlock className="mx-auto h-3 w-32" />
        </div>
      </div>
    </main>
  );
}
