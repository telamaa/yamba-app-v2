"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useTranslations } from "next-intl";
import TripSearchBar from "./TripSearchBar";
import TripResultCard from "./TripResultCard";
import TripResultCardMobile from "./TripResultCardMobile";
import TransportModeTabs from "./TransportModeTabs";
import SearchFiltersSidebar from "./SearchFiltersSidebar";
import { MOCK_YAMBA_TRIPS } from "./search-results.mock";
import MobileSearchExperience from "./MobileSearchExperience";
import TripSearchBarSkeleton from "./TripSearchBarSkeleton";
import MobileSearchExperienceSkeleton from "./MobileSearchExperienceSkeleton";
import { Skeleton } from "@/components/ui/Skeleton";
import { useFixedSidebarPosition } from "@/hooks/useFixedSidebarPosition";
import {
  DepartureTimeBucket,
  ParcelCategory,
  SortOption,
  TransportMode,
} from "./search-results.types";
import { matchesDepartureBuckets } from "./getDepartureTimeBucket";
import type { DateValue } from "@/components/ui/SmartDatePicker";

type FilterMode = "all" | TransportMode;

const BATCH_SIZE = 10;
const LOAD_MORE_DELAY = 600;

// ⚠️ Hauteurs des éléments fixed
const HEADER_HEIGHT = 78;
const SEARCH_BAR_FIXED_HEIGHT = 96;
const SIDEBAR_TOP = HEADER_HEIGHT + SEARCH_BAR_FIXED_HEIGHT + 16; // 190

// ⚠️ Animation sidebar
const SIDEBAR_TRANSITION_MS = 500;
const SIDEBAR_SLIDE_DISTANCE = 12;

// ── Helpers de tri ──

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

// ── Skeletons inline (spécifiques à search) ──
// Ces skeletons utilisent la primitive `Skeleton` extraite dans `ui/`.
// Ils restent inline ici car spécifiques à la page search.

function TransportModeTabsSkeleton() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex gap-1.5">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-9 w-20 rounded-full" />
        ))}
      </div>
      <Skeleton className="hidden h-4 w-20 rounded-md md:block" />
    </div>
  );
}

function SearchFiltersSidebarSkeleton() {
  return (
    <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800/60">
        <Skeleton className="h-5 w-24 rounded-md" />
      </div>
      <div className="space-y-5 px-5 py-4">
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="flex items-center justify-between gap-3 px-2 py-2"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="h-3.5 w-3.5 rounded-full" />
                <Skeleton className="h-4 w-32 rounded-md" />
              </div>
              <Skeleton className="h-4 w-4 rounded-md" />
            </div>
          ))}
        </div>
        <div className="space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800/60">
          <Skeleton className="h-3 w-24 rounded-md" />
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="flex items-center justify-between gap-3 px-2 py-1.5"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="h-3.5 w-3.5 rounded-sm" />
                <Skeleton className="h-4 w-28 rounded-md" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-3 w-4 rounded-md" />
                <Skeleton className="h-4 w-4 rounded-md" />
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800/60">
          <Skeleton className="h-3 w-32 rounded-md" />
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton
                key={index}
                className={`h-7 rounded-full ${
                  index % 3 === 0 ? "w-24" : "w-20"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

function TripResultCardSkeletonMobile() {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center justify-between border-b border-slate-100 px-3.5 py-2 dark:border-slate-800/60">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-3 w-20 rounded-md" />
        </div>
      </div>
      <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-start gap-2 px-3.5 py-3">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-12 rounded-md" />
          <Skeleton className="h-3 w-16 rounded-md" />
        </div>
        <div className="flex flex-col items-center gap-1.5 pt-1">
          <Skeleton className="h-2 w-8 rounded-md" />
          <Skeleton className="h-px w-full rounded-md" />
          <Skeleton className="h-2 w-10 rounded-md" />
        </div>
        <div className="flex flex-col items-end space-y-1.5">
          <Skeleton className="h-4 w-12 rounded-md" />
          <Skeleton className="h-3 w-16 rounded-md" />
        </div>
        <div className="flex flex-col items-end space-y-1.5">
          <Skeleton className="h-2 w-6 rounded-md" />
          <Skeleton className="h-4 w-12 rounded-md" />
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-slate-100 px-3.5 py-2 dark:border-slate-800/60">
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-7 rounded-full" />
          <div className="space-y-1">
            <Skeleton className="h-3 w-16 rounded-md" />
            <Skeleton className="h-3 w-20 rounded-md" />
          </div>
        </div>
        <div className="flex gap-1">
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-5 w-5 rounded-full" />
        </div>
      </div>
    </article>
  );
}

function TripResultCardSkeleton() {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-2.5 dark:border-slate-800/60">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-3 w-20 rounded-md" />
      </div>
      <div className="grid items-center gap-4 px-4 py-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-20 rounded-md" />
          <Skeleton className="h-3.5 w-12 rounded-md" />
          <Skeleton className="h-2.5 w-16 rounded-md" />
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <Skeleton className="h-2.5 w-10 rounded-md" />
          <Skeleton className="h-px w-full rounded-md" />
          <Skeleton className="h-2.5 w-12 rounded-md" />
        </div>
        <div className="flex flex-col items-end space-y-1.5">
          <Skeleton className="h-4 w-24 rounded-md" />
          <Skeleton className="h-3.5 w-12 rounded-md" />
          <Skeleton className="h-2.5 w-16 rounded-md" />
        </div>
        <div className="flex flex-col items-end space-y-1.5">
          <Skeleton className="h-2.5 w-12 rounded-md" />
          <Skeleton className="h-6 w-20 rounded-md" />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-4 py-2.5 dark:border-slate-800/60 dark:bg-slate-900/30">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="space-y-1">
            <Skeleton className="h-3 w-20 rounded-md" />
            <Skeleton className="h-3 w-32 rounded-md" />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-6 w-6 rounded-full" />
          ))}
        </div>
      </div>
    </article>
  );
}

// ── Empty state ──

function EmptyState({
                      onClearFilters,
                      hasFilters,
                    }: {
  onClearFilters: () => void;
  hasFilters: boolean;
}) {
  const t = useTranslations("search");

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-4 grid h-16 w-16 place-items-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-900 dark:text-slate-600">
        <Search size={28} strokeWidth={1.5} />
      </div>
      <h3 className="text-[16px] font-semibold text-slate-900 dark:text-white">
        {t("emptyState.title")}
      </h3>
      <p className="mt-1 max-w-md text-[13px] text-slate-500 dark:text-slate-400">
        {hasFilters ? t("emptyState.withFilters") : t("emptyState.noResults")}
      </p>
      {hasFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#FF9900] px-4 py-2 text-[13px] font-semibold text-slate-950 transition-colors hover:bg-[#F08700]"
        >
          {t("filters.clearAll")}
        </button>
      )}
    </div>
  );
}

// ── Main view ──

export default function SearchResultsView() {
  const t = useTranslations("search");
  const tCommon = useTranslations("common");

  const [activeMode, setActiveMode] = useState<FilterMode>("all");
  const [sort, setSort] = useState<SortOption>("earliest");

  const [superTripperOnly, setSuperTripperOnly] = useState(false);
  const [profileVerifiedOnly, setProfileVerifiedOnly] = useState(false);
  const [instantBookingOnly, setInstantBookingOnly] = useState(false);
  const [verifiedTicketOnly, setVerifiedTicketOnly] = useState(false);

  const [selectedDepartureBuckets, setSelectedDepartureBuckets] = useState<
    DepartureTimeBucket[]
  >([]);

  const [selectedCategories, setSelectedCategories] = useState<ParcelCategory[]>(
    []
  );

  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const { placeholderRef: sidebarPlaceholderRef, fixedRect } =
    useFixedSidebarPosition(SIDEBAR_TOP);

  // ⚠️ State migrated to use DateValue (not just Date) so the mobile bottom
  // sheet preserves the Exact/Flex mode chosen by the user.
  const [searchDraft, setSearchDraft] = useState<{
    from: string;
    to: string;
    dateValue: DateValue | null;
  }>({
    from: "Paris, France",
    to: "Caen, France",
    dateValue: { mode: "exact", date: new Date() },
  });

  // ── Effects ──

  useEffect(() => {
    const timer = setTimeout(() => setIsPageLoading(false), 1200);
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
    selectedDepartureBuckets,
  ]);

  // ── Handlers ──

  const toggleCategory = (category: ParcelCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((item) => item !== category)
        : [...prev, category]
    );
  };

  const toggleDepartureBucket = (bucket: DepartureTimeBucket) => {
    setSelectedDepartureBuckets((prev) =>
      prev.includes(bucket)
        ? prev.filter((b) => b !== bucket)
        : [...prev, bucket]
    );
  };

  const clearAll = () => {
    setSort("earliest");
    setSuperTripperOnly(false);
    setProfileVerifiedOnly(false);
    setInstantBookingOnly(false);
    setVerifiedTicketOnly(false);
    setSelectedCategories([]);
    setSelectedDepartureBuckets([]);
    setActiveMode("all");
  };

  const handleLoadMore = () => {
    setIsLoadingMore(true);
    setTimeout(() => {
      setVisibleCount((prev) => prev + BATCH_SIZE);
      setIsLoadingMore(false);
    }, LOAD_MORE_DELAY);
  };

  // ── Filtering ──

  const baseFilteredTrips = useMemo(() => {
    let data =
      activeMode === "all"
        ? [...MOCK_YAMBA_TRIPS]
        : MOCK_YAMBA_TRIPS.filter((item) => item.transportMode === activeMode);

    if (selectedCategories.length > 0) {
      data = data.filter((item) =>
        selectedCategories.some((category) =>
          item.allowedCategories.includes(category)
        )
      );
    }

    if (selectedDepartureBuckets.length > 0) {
      data = data.filter((item) =>
        matchesDepartureBuckets(item.departureTime, selectedDepartureBuckets)
      );
    }

    return data;
  }, [activeMode, selectedCategories, selectedDepartureBuckets]);

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

    if (superTripperOnly) data = data.filter((item) => item.superTripper);
    if (profileVerifiedOnly) data = data.filter((item) => item.profileVerified);
    if (instantBookingOnly) data = data.filter((item) => item.instantBooking);
    if (verifiedTicketOnly) data = data.filter((item) => item.verifiedTicket);

    if (sort === "lowestPrice") {
      data.sort((a, b) => a.minPrice - b.minPrice);
    } else if (sort === "bestRated") {
      data.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
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

  const hasActiveFilters =
    sort !== "earliest" ||
    activeMode !== "all" ||
    superTripperOnly ||
    profileVerifiedOnly ||
    instantBookingOnly ||
    verifiedTicketOnly ||
    selectedCategories.length > 0 ||
    selectedDepartureBuckets.length > 0;

  // ⚠️ Props sidebar partagées (utilisées par les 2 instances : flow + fixed)
  const sidebarProps = {
    sort,
    onSortChange: setSort,
    superTripperOnly,
    onSuperTripperChange: setSuperTripperOnly,
    profileVerifiedOnly,
    onProfileVerifiedChange: setProfileVerifiedOnly,
    instantBookingOnly,
    onInstantBookingChange: setInstantBookingOnly,
    verifiedTicketOnly,
    onVerifiedTicketChange: setVerifiedTicketOnly,
    superTripperCount,
    profileVerifiedCount,
    instantBookingCount,
    verifiedTicketCount,
    selectedDepartureBuckets,
    onToggleDepartureBucket: toggleDepartureBucket,
    selectedCategories,
    onToggleCategory: toggleCategory,
    onClear: clearAll,
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

        /* Scrollbar custom pour la sidebar */
        .yamba-sidebar-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .yamba-sidebar-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .yamba-sidebar-scroll::-webkit-scrollbar-thumb {
          background-color: rgba(148, 163, 184, 0.3);
          border-radius: 999px;
        }
        .yamba-sidebar-scroll::-webkit-scrollbar-thumb:hover {
          background-color: rgba(148, 163, 184, 0.5);
        }
        .yamba-sidebar-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(148, 163, 184, 0.3) transparent;
        }
      `}</style>

      <main className="pb-14">
        {/* DESKTOP : TripSearchBar wrapper en position:fixed sous le Header */}
        <div
          className="fixed inset-x-0 z-[80] hidden bg-white/70 backdrop-blur-xl backdrop-saturate-150 dark:bg-slate-950/65 md:block"
          style={{ top: HEADER_HEIGHT }}
        >
          <div className="pb-3 pt-4 transition-all duration-300 ease-out">
            {isPageLoading ? (
              <div className="mx-auto max-w-7xl px-3">
                <TripSearchBarSkeleton />
              </div>
            ) : (
              <TripSearchBar
                stickyOnScroll={false}
                forceCompactOnScroll={true}
              />
            )}
          </div>
        </div>

        {/* ── Mobile: search bar summary sticky ── */}
        <section className="sticky top-[78px] z-[100] border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 md:hidden">
          {isPageLoading ? (
            <MobileSearchExperienceSkeleton />
          ) : (
            <MobileSearchExperience
              mode="summary"
              from={searchDraft.from}
              to={searchDraft.to}
              dateValue={searchDraft.dateValue}
              resultsCount={filteredTrips.length}
              onFromChange={(value) =>
                setSearchDraft((prev) => ({ ...prev, from: value }))
              }
              onToChange={(value) =>
                setSearchDraft((prev) => ({ ...prev, to: value }))
              }
              onDateValueChange={(value) =>
                setSearchDraft((prev) => ({ ...prev, dateValue: value }))
              }
              onSearch={() => {}}
              onOpenFilters={() => setMobileFiltersOpen(true)}
            />
          )}
        </section>

        {/* ── Main content ── */}
        <section className="mx-auto max-w-7xl px-3 pb-14">
          <div className="md:hidden" style={{ paddingTop: 16 }} />
          <div
            className="hidden md:block"
            style={{ paddingTop: SEARCH_BAR_FIXED_HEIGHT + 24 }}
          />

          <div className="mb-5">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              {t("title")}
            </h1>
          </div>

          {isPageLoading ? (
            <>
              <div className="mb-6">
                <TransportModeTabsSkeleton />
              </div>
              {/* ⚠️ Sidebar visible dès md (768px) — était lg avant, créait un trou UX
                  entre 768-1023px (TripSearchBar desktop visible mais pas de filtres). */}
              <div className="grid gap-6 md:grid-cols-[280px_1fr] md:items-start">
                <div className="hidden md:block">
                  <SearchFiltersSidebarSkeleton />
                </div>
                <div className="space-y-3">
                  {/* ⚠️ Skeletons mobile-friendly < md, desktop full sinon */}
                  <div className="md:hidden space-y-3">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <TripResultCardSkeletonMobile key={index} />
                    ))}
                  </div>
                  <div className="hidden md:block space-y-3">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <TripResultCardSkeleton key={index} />
                    ))}
                  </div>
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

              {/* ⚠️ Grid desktop : sidebar + cards dès md (768px) au lieu de lg (1024px)
                  pour combler le trou UX entre tablet et desktop. */}
              <div className="grid gap-6 md:grid-cols-[280px_1fr] md:items-start">
                {/* Sidebar desktop avec animation fluide (fade + slide 500ms) */}
                <div
                  ref={sidebarPlaceholderRef}
                  className="relative hidden md:block"
                >
                  {/* Sidebar dans le flow normal */}
                  <div
                    style={{
                      opacity: fixedRect.isFixed ? 0 : 1,
                      visibility: fixedRect.isFixed ? "hidden" : "visible",
                      transition: `opacity ${SIDEBAR_TRANSITION_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`,
                    }}
                  >
                    <SearchFiltersSidebar {...sidebarProps} />
                  </div>

                  {/* Sidebar fixed avec fade + slide */}
                  <div
                    className="yamba-sidebar-scroll overflow-y-auto rounded-2xl"
                    style={{
                      position: "fixed",
                      top: SIDEBAR_TOP,
                      left: fixedRect.left,
                      width: fixedRect.width,
                      maxHeight: `calc(100vh - ${SIDEBAR_TOP}px - 24px)`,
                      zIndex: 30,
                      opacity: fixedRect.isFixed ? 1 : 0,
                      transform: fixedRect.isFixed
                        ? "translateY(0)"
                        : `translateY(-${SIDEBAR_SLIDE_DISTANCE}px)`,
                      pointerEvents: fixedRect.isFixed ? "auto" : "none",
                      transition: `opacity ${SIDEBAR_TRANSITION_MS}ms cubic-bezier(0.16, 1, 0.3, 1), transform ${SIDEBAR_TRANSITION_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`,
                    }}
                    aria-hidden={!fixedRect.isFixed}
                  >
                    <SearchFiltersSidebar {...sidebarProps} />
                  </div>
                </div>

                {/* Liste de résultats */}
                <div className="space-y-3">
                  {visibleTrips.length === 0 ? (
                    <EmptyState
                      onClearFilters={clearAll}
                      hasFilters={hasActiveFilters}
                    />
                  ) : (
                    <>
                      {/* ⚠️ Mobile : utilise TripResultCardMobile */}
                      <div className="md:hidden space-y-3">
                        {visibleTrips.map((item) => (
                          <TripResultCardMobile
                            key={item.id}
                            item={item}
                            highlightedCategories={selectedCategories}
                          />
                        ))}
                      </div>

                      {/* ⚠️ Desktop : utilise TripResultCard */}
                      <div className="hidden md:block space-y-3">
                        {visibleTrips.map((item) => (
                          <TripResultCard
                            key={item.id}
                            item={item}
                            highlightedCategories={selectedCategories}
                          />
                        ))}
                      </div>

                      {remainingCount > 0 && (
                        <div className="pt-2 text-center">
                          <button
                            type="button"
                            onClick={handleLoadMore}
                            disabled={isLoadingMore}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#FF9900]/35 bg-[#FFF6E8] px-5 py-3 text-sm font-semibold text-slate-900 transition-colors hover:bg-[#FFE8BF] disabled:opacity-60 dark:border-[#FF9900]/20 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
                          >
                            {isLoadingMore && (
                              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            )}
                            {t("loadMore")} (+
                            {Math.min(BATCH_SIZE, remainingCount)})
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

        {/* ── Mobile filters drawer ── */}
        {mobileFiltersOpen && (
          <div className="fixed inset-0 z-[150] bg-white dark:bg-slate-950 md:hidden">
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between px-4 pb-3 pt-4">
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen(false)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-500 dark:text-slate-400"
                  aria-label={tCommon("actions.close")}
                >
                  <X size={28} />
                </button>

                <button
                  type="button"
                  onClick={clearAll}
                  className="text-sm font-semibold text-slate-400 dark:text-slate-500"
                >
                  {t("filters.clearAll")}
                </button>
              </div>

              <div className="px-4 pb-28">
                <h2 className="mb-5 inline-flex items-center gap-2 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  <SlidersHorizontal size={22} />
                  {t("filters.title")}
                </h2>

                <div className="h-[calc(100dvh-180px)] overflow-y-auto">
                  <SearchFiltersSidebar
                    hideHeader
                    className="rounded-none border-0 bg-transparent shadow-none dark:bg-transparent"
                    {...sidebarProps}
                  />
                </div>
              </div>

              <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white px-4 py-4 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-950">
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen(false)}
                  className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-[#FF9900] px-6 text-base font-semibold text-slate-950"
                >
                  {t("viewTrips", { count: filteredTrips.length })}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
