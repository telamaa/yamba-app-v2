"use client";

import type { Step } from "./create-trip.types";
import { cn } from "./TripFormUi";

export default function CreateTripWizardSkeleton({
                                                   step = 1,
                                                 }: {
  step?: Step;
}) {
  const Block = ({ className = "" }: { className?: string }) => (
    <div className={cn("animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800", className)} />
  );

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-[140] border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 md:hidden">
        <div className="px-4 pb-3 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-2">
              <Block className="h-6 w-36" />
              <Block className="h-3 w-28 rounded-full" />
            </div>
            <Block className="h-7 w-12 rounded-full" />
          </div>

          <div className="mt-3">
            <Block className="h-1.5 w-full rounded-full" />
          </div>

          <div className="mt-3 flex gap-2 overflow-hidden">
            <Block className="h-8 w-32 rounded-full" />
            <Block className="h-8 w-24 rounded-full" />
            <Block className="h-8 w-20 rounded-full" />
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6 pt-[154px] pb-[104px] md:py-6 md:pt-6 md:pb-6">
        <div className="mb-6 hidden md:block">
          <div className="space-y-3">
            <Block className="h-8 w-56" />
            <Block className="h-4 w-72" />
            <Block className="h-10 w-full rounded-[24px]" />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="p-0">
            {step === 1 && (
              <>
                <div className="mb-5 space-y-2">
                  <Block className="h-7 w-28" />
                  <Block className="h-4 w-72" />
                </div>

                <div className="space-y-4">
                  <Block className="h-14 w-full rounded-[18px]" />
                  <Block className="h-14 w-56 rounded-[18px]" />
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <Block className="h-14 w-full" />
                  <Block className="h-14 w-full" />
                  <Block className="h-14 w-full" />
                  <Block className="h-14 w-full" />
                  <Block className="h-14 w-full" />
                  <Block className="h-14 w-full" />
                </div>

                <div className="mt-6">
                  <Block className="h-14 w-full" />
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <Block className="h-14 w-full" />
                  <Block className="h-14 w-full" />
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="mb-5 space-y-2">
                  <Block className="h-7 w-36" />
                  <Block className="h-4 w-80" />
                </div>

                <div>
                  <Block className="mb-3 h-4 w-40" />
                  <div className="flex flex-wrap gap-2">
                    <Block className="h-8 w-24 rounded-full" />
                    <Block className="h-8 w-20 rounded-full" />
                    <Block className="h-8 w-28 rounded-full" />
                    <Block className="h-8 w-24 rounded-full" />
                  </div>
                </div>

                <div className="mt-6 grid gap-4">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div
                      key={i}
                      className="rounded-[22px] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"
                    >
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <Block className="h-5 w-32" />
                        <Block className="h-7 w-24 rounded-full" />
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <Block className="h-14 w-full" />
                        <Block className="h-24 w-full rounded-[18px]" />
                      </div>

                      <div className="mt-4">
                        <Block className="h-24 w-full rounded-[18px]" />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6">
                  <Block className="mb-3 h-4 w-44" />
                  <div className="grid gap-3 md:grid-cols-2">
                    <Block className="h-16 w-full" />
                    <Block className="h-16 w-full" />
                  </div>
                </div>

                <div className="mt-6">
                  <Block className="h-24 w-full rounded-[24px]" />
                </div>

                <div className="mt-6">
                  <Block className="h-28 w-full rounded-[18px]" />
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div className="mb-5 space-y-2">
                  <Block className="h-7 w-36" />
                  <Block className="h-4 w-72" />
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
                  <Block className="mb-4 h-4 w-36" />
                  <div className="grid gap-4 md:grid-cols-2">
                    <Block className="h-16 w-full" />
                    <Block className="h-16 w-full" />
                    <Block className="h-16 w-full" />
                    <Block className="h-16 w-full" />
                  </div>
                </div>

                <div className="mt-6">
                  <Block className="mb-3 h-4 w-44" />
                  <div className="grid gap-4 md:grid-cols-2">
                    <Block className="h-36 w-full rounded-[24px]" />
                    <Block className="h-36 w-full rounded-[24px]" />
                  </div>
                </div>

                <div className="mt-6">
                  <Block className="h-24 w-full rounded-[24px]" />
                </div>
              </>
            )}

            <div className="mt-8 hidden items-center justify-between gap-3 md:flex">
              <div className="flex gap-3">
                <Block className="h-12 w-28 rounded-2xl" />
                <Block className="h-12 w-44 rounded-2xl" />
              </div>
              <Block className="h-12 w-32 rounded-2xl" />
            </div>
          </section>

          <aside className="hidden lg:block">
            <div className="p-0">
              <Block className="mb-4 h-7 w-40" />
              <div className="space-y-3">
                <Block className="h-16 w-full" />
                <Block className="h-16 w-full" />
                <Block className="h-16 w-full" />
                <Block className="h-16 w-full" />
              </div>
            </div>
          </aside>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-[120] border-t border-slate-200 bg-white px-4 py-4 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-950 md:hidden">
        <div className="flex gap-3">
          <Block className="h-12 flex-1 rounded-2xl" />
          <Block className="h-12 flex-[1.3] rounded-2xl" />
        </div>
      </div>
    </>
  );
}
