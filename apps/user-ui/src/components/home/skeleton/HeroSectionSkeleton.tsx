"use client";

export default function HeroSectionSkeleton() {
  return (
    <>
      {/* Hero skeleton */}
      <section className="yamba-hero-mesh relative overflow-hidden">
        <div className="relative mx-auto max-w-7xl px-4 pt-8 md:pt-12 lg:pt-14">
          <div className="grid items-center gap-8 md:grid-cols-[1.1fr_1fr] md:gap-10 lg:gap-12">
            {/* Colonne gauche skeleton */}
            <div className="space-y-3 text-center md:text-left">
              <div className="mx-auto h-7 w-3/4 animate-pulse rounded-lg bg-white/5 md:mx-0 md:h-9 lg:h-10" />
              <div className="mx-auto h-7 w-2/3 animate-pulse rounded-lg bg-white/5 md:mx-0 md:h-9 lg:h-10" />
              <div className="mx-auto !mt-5 h-4 w-2/3 animate-pulse rounded bg-white/5 md:mx-0" />

              {/* Stats skeleton */}
              <div className="!mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 md:justify-start md:gap-x-6">
                <div className="h-3 w-20 animate-pulse rounded bg-white/5" />
                <div className="h-3 w-16 animate-pulse rounded bg-white/5" />
                <div className="h-3 w-16 animate-pulse rounded bg-white/5" />
                <div className="h-3 w-20 animate-pulse rounded bg-white/5" />
              </div>
            </div>

            {/* Colonne droite skeleton (image) */}
            <div className="hidden md:flex md:items-center">
              <div className="relative aspect-[16/9] w-full animate-pulse rounded-2xl bg-white/5" />
            </div>
          </div>
        </div>

        <div className="h-6 md:h-8" />
      </section>

      {/* Search bar skeleton — fond identique au hero pour continuité */}
      <div className="yamba-hero-mesh-bottom">
        <div className="mx-auto max-w-7xl px-4">
          <div className="h-16 animate-pulse rounded-2xl bg-white/5" />
        </div>
        <div className="h-8 md:h-10" />
      </div>
    </>
  );
}
