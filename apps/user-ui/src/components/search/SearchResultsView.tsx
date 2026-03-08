"use client";

import { useEffect, useMemo, useState } from "react";
import TripSearchBar from "./TripSearchBar";
import YambaTripResultCard from "./YambaTripResultCard";
import TransportModeTabs from "./TransportModeTabs";
import SearchFiltersSidebar from "./SearchFiltersSidebar";
import { MOCK_YAMBA_TRIPS } from "./search-results.mock";
import TripSearchBarSkeleton from "./TripSearchBarSkeleton";
import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";
import { ParcelCategory, SortOption, TransportMode } from "./search-results.types";

type Lang = "fr" | "en";
type FilterMode = "all" | TransportMode;

const BATCH_SIZE = 10;

const MONTHS_FR: Record<string, number> = {
  janvier: 0,
  fevrier: 1,
  février: 1,
  mars: 2,
  avril: 3,
  mai: 4,
  juin: 5,
  juillet: 6,
  aout: 7,
  août: 7,
  septembre: 8,
  octobre: 9,
  novembre: 10,
  decembre: 11,
  décembre: 11,
};

function toSortableTimestamp(travelDate: string, departureTime?: string) {
  if (!travelDate) return Number.MAX_SAFE_INTEGER;

  const normalized = travelDate
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const match = normalized.match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/);

  if (!match) return Number.MAX_SAFE_INTEGER;

  const [, dayStr, monthStr, yearStr] = match;
  const monthIndex = MONTHS_FR[monthStr];

  if (monthIndex === undefined) return Number.MAX_SAFE_INTEGER;

  const [hourStr = "23", minuteStr = "59"] = (departureTime ?? "23:59").split(":");
  const hour = Number(hourStr);
  const minute = Number(minuteStr);

  return new Date(
    Number(yearStr),
    monthIndex,
    Number(dayStr),
    Number.isFinite(hour) ? hour : 23,
    Number.isFinite(minute) ? minute : 59
  ).getTime();
}

function ShimmerBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-slate-200/90 dark:bg-slate-800/80 ${className}`}
    >
      <div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/70 to-transparent dark:via-white/10"
        style={{ animation: "yambaShimmer 1.6s infinite" }}
      />
    </div>
  );
}

function TransportModeTabsSkeleton() {
  return (
    <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="grid grid-cols-2 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="px-4 py-4">
            <div className="flex items-center justify-center gap-2">
              <ShimmerBlock className="h-4 w-4 rounded-md" />
              <ShimmerBlock className="h-4 w-20 rounded-md" />
              <ShimmerBlock className="h-4 w-8 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SearchFiltersSidebarSkeleton() {
  return (
    <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-5 flex items-center justify-between">
        <ShimmerBlock className="h-7 w-28 rounded-md" />
        <ShimmerBlock className="h-5 w-24 rounded-md" />
      </div>

      <div className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <ShimmerBlock className="h-4 w-4 rounded-full" />
              <ShimmerBlock className="h-5 w-36 rounded-md" />
            </div>
            <ShimmerBlock className="h-5 w-5 rounded-md" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <ShimmerBlock className="h-4 w-4 rounded-full" />
              <ShimmerBlock className="h-5 w-28 rounded-md" />
            </div>
            <ShimmerBlock className="h-5 w-5 rounded-md" />
          </div>
        </div>

        <div className="h-px bg-slate-200 dark:bg-slate-800" />

        <div>
          <ShimmerBlock className="mb-3 h-4 w-40 rounded-md" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <ShimmerBlock className="h-4 w-4 rounded-sm" />
                  <ShimmerBlock className="h-5 w-28 rounded-md" />
                </div>
                <div className="flex items-center gap-2">
                  <ShimmerBlock className="h-4 w-4 rounded-md" />
                  <ShimmerBlock className="h-5 w-5 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="h-px bg-slate-200 dark:bg-slate-800" />

        <div>
          <ShimmerBlock className="mb-3 h-4 w-20 rounded-md" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <ShimmerBlock
                key={index}
                className={`h-9 rounded-full ${
                  index % 3 === 0 ? "w-36" : index % 2 === 0 ? "w-28" : "w-24"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

function YambaResultCardSkeleton() {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_auto] md:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <ShimmerBlock className="h-7 w-20 rounded-full" />
            <ShimmerBlock className="h-4 w-28 rounded-md" />
          </div>

          <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div>
              <ShimmerBlock className="mb-2 h-3 w-12 rounded-md" />
              <ShimmerBlock className="h-5 w-28 rounded-md" />
            </div>

            <div className="flex items-center justify-center gap-2 px-3">
              <ShimmerBlock className="h-px flex-1 rounded-full" />
              <ShimmerBlock className="h-4 w-4 rounded-full" />
              <ShimmerBlock className="h-px flex-1 rounded-full" />
            </div>

            <div>
              <ShimmerBlock className="mb-2 h-3 w-12 rounded-md" />
              <ShimmerBlock className="h-5 w-28 rounded-md" />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <ShimmerBlock className="h-11 w-11 rounded-full" />
              <ShimmerBlock className="h-5 w-24 rounded-md" />
            </div>

            <ShimmerBlock className="h-4 w-24 rounded-md" />

            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <ShimmerBlock key={index} className="h-7 w-7 rounded-full" />
              ))}
            </div>
          </div>
        </div>

        <div className="md:text-right">
          <ShimmerBlock className="mb-2 h-3 w-20 rounded-md md:ml-auto" />
          <ShimmerBlock className="h-8 w-24 rounded-md md:ml-auto" />
        </div>
      </div>
    </article>
  );
}

export default function SearchResultsView() {
  const { lang } = useUiPreferences();

  const [activeMode, setActiveMode] = useState<FilterMode>("all");
  const [sort, setSort] = useState<SortOption>("earliest");

  const [superTripperOnly, setSuperTripperOnly] = useState(false);
  const [profileVerifiedOnly, setProfileVerifiedOnly] = useState(false);
  const [instantBookingOnly, setInstantBookingOnly] = useState(false);
  const [verifiedTicketOnly, setVerifiedTicketOnly] = useState(false);

  const [selectedCategories, setSelectedCategories] = useState<ParcelCategory[]>([]);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const [isPageLoading, setIsPageLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsPageLoading(false);
    }, 1200);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
  }, [
    activeMode,
    sort,
    superTripperOnly,
    profileVerifiedOnly,
    instantBookingOnly,
    verifiedTicketOnly,
    selectedCategories,
  ]);

  const toggleCategory = (category: ParcelCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((item) => item !== category)
        : [...prev, category]
    );
  };

  const clearAll = () => {
    setSort("earliest");
    setSuperTripperOnly(false);
    setProfileVerifiedOnly(false);
    setInstantBookingOnly(false);
    setVerifiedTicketOnly(false);
    setSelectedCategories([]);
    setActiveMode("all");
  };

  const baseFilteredTrips = useMemo(() => {
    let data =
      activeMode === "all"
        ? [...MOCK_YAMBA_TRIPS]
        : MOCK_YAMBA_TRIPS.filter((item) => item.transportMode === activeMode);

    if (selectedCategories.length > 0) {
      data = data.filter((item) =>
        selectedCategories.some((category) => item.allowedCategories.includes(category))
      );
    }

    return data;
  }, [activeMode, selectedCategories]);

  const superTripperCount = useMemo(
    () => baseFilteredTrips.filter((item) => item.superTripper).length,
    [baseFilteredTrips]
  );

  const profileVerifiedCount = useMemo(
    () => baseFilteredTrips.filter((item) => item.profileVerified).length,
    [baseFilteredTrips]
  );

  const instantBookingCount = useMemo(
    () => baseFilteredTrips.filter((item) => item.instantBooking).length,
    [baseFilteredTrips]
  );

  const verifiedTicketCount = useMemo(
    () => baseFilteredTrips.filter((item) => item.verifiedTicket).length,
    [baseFilteredTrips]
  );

  const filteredTrips = useMemo(() => {
    let data = [...baseFilteredTrips];

    if (superTripperOnly) {
      data = data.filter((item) => item.superTripper);
    }

    if (profileVerifiedOnly) {
      data = data.filter((item) => item.profileVerified);
    }

    if (instantBookingOnly) {
      data = data.filter((item) => item.instantBooking);
    }

    if (verifiedTicketOnly) {
      data = data.filter((item) => item.verifiedTicket);
    }

    if (sort === "lowestPrice") {
      data.sort((a, b) => a.minPrice - b.minPrice);
    } else {
      data.sort(
        (a, b) =>
          toSortableTimestamp(a.travelDate, a.departureTime) -
          toSortableTimestamp(b.travelDate, b.departureTime)
      );
    }

    return data;
  }, [
    baseFilteredTrips,
    superTripperOnly,
    profileVerifiedOnly,
    instantBookingOnly,
    verifiedTicketOnly,
    sort,
  ]);

  const visibleTrips = filteredTrips.slice(0, visibleCount);
  const remainingCount = Math.max(filteredTrips.length - visibleTrips.length, 0);

  const copy = useMemo(() => {
    const isFr = (lang as Lang) === "fr";

    return {
      title: isFr ? "Résultats disponibles" : "Available results",
      showing: isFr ? "résultats affichés" : "results shown",
      empty: isFr
        ? "Aucun résultat ne correspond à vos filtres."
        : "No results match your filters.",
      loadMore: isFr ? "Charger plus de résultats" : "Load more results",
    };
  }, [lang]);

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + BATCH_SIZE);
  };

  return (
    <>
      <style jsx global>{`
        @keyframes yambaShimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>

      <main className="pb-14">
        <section className="sticky top-[78px] z-[70] overflow-visible bg-white/95 pt-4 pb-4 backdrop-blur dark:bg-slate-950/95">
          {isPageLoading ? (
            <TripSearchBarSkeleton overlap={false} />
          ) : (
            <TripSearchBar overlap={false} />
          )}
        </section>

        <section className="mx-auto max-w-6xl px-4 py-8">
          <div className="mb-5">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              {copy.title}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {isPageLoading
                ? "..."
                : `${visibleTrips.length}/${filteredTrips.length} ${copy.showing}`}
            </p>
          </div>

          {isPageLoading ? (
            <>
              <div className="mb-6">
                <TransportModeTabsSkeleton />
              </div>

              <div className="grid gap-6 lg:grid-cols-[minmax(0,0.3fr)_minmax(0,0.7fr)]">
                <div className="min-w-0 lg:pr-2">
                  <div className="lg:sticky lg:top-[168px]">
                    <SearchFiltersSidebarSkeleton />
                  </div>
                </div>

                <div className="min-w-0 space-y-3 lg:pl-2">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <YambaResultCardSkeleton key={index} />
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="mb-6">
                <TransportModeTabs
                  active={activeMode}
                  items={MOCK_YAMBA_TRIPS}
                  onChange={setActiveMode}
                />
              </div>

              <div className="grid gap-6 lg:grid-cols-[minmax(0,0.3fr)_minmax(0,0.7fr)]">
                <div className="min-w-0 lg:pr-2">
                  <div className="lg:sticky lg:top-[200px]">
                    <SearchFiltersSidebar
                      sort={sort}
                      onSortChange={setSort}
                      superTripperOnly={superTripperOnly}
                      onSuperTripperChange={setSuperTripperOnly}
                      profileVerifiedOnly={profileVerifiedOnly}
                      onProfileVerifiedChange={setProfileVerifiedOnly}
                      instantBookingOnly={instantBookingOnly}
                      onInstantBookingChange={setInstantBookingOnly}
                      verifiedTicketOnly={verifiedTicketOnly}
                      onVerifiedTicketChange={setVerifiedTicketOnly}
                      superTripperCount={superTripperCount}
                      profileVerifiedCount={profileVerifiedCount}
                      instantBookingCount={instantBookingCount}
                      verifiedTicketCount={verifiedTicketCount}
                      selectedCategories={selectedCategories}
                      onToggleCategory={toggleCategory}
                      onClear={clearAll}
                    />
                  </div>
                </div>

                <div className="min-w-0 space-y-3 lg:pl-2">
                  {visibleTrips.length === 0 ? (
                    <div className="rounded-3xl border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                      {copy.empty}
                    </div>
                  ) : (
                    <>
                      {visibleTrips.map((item) => (
                        <YambaTripResultCard key={item.id} item={item} />
                      ))}

                      {remainingCount > 0 && (
                        <div className="pt-2 text-center">
                          <button
                            type="button"
                            onClick={handleLoadMore}
                            className="inline-flex items-center justify-center rounded-xl border border-[#FF9900]/35 bg-[#FFF6E8] px-5 py-3 text-sm font-semibold text-slate-900 transition-colors hover:bg-[#FFE8BF] dark:border-[#FF9900]/20 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
                          >
                            {copy.loadMore} (+{Math.min(BATCH_SIZE, remainingCount)})
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      </main>
    </>
  );
}
