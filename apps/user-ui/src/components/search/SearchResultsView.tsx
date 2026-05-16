"use client";

import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import TripSearchBar, { type TripSearchValue } from "./TripSearchBar";
import TripResultCard from "./TripResultCard";
import TripResultCardMobile from "./TripResultCardMobile";
import TransportModeTabs from "./TransportModeTabs";
import SearchFiltersSidebar from "./SearchFiltersSidebar";
import MobileSearchExperience from "./MobileSearchExperience";
import TripSearchBarSkeleton from "./TripSearchBarSkeleton";
import MobileSearchExperienceSkeleton from "./MobileSearchExperienceSkeleton";
import SavedRouteCTA from "@/components/saved-routes/SavedRouteCTA";
import { Skeleton } from "@/components/ui/Skeleton";
import { useFixedSidebarPosition } from "@/hooks/useFixedSidebarPosition";
import { useTripsSearch } from "@/hooks/useTripsSearch";
import { useSearchFacets } from "@/hooks/useSearchFacets";
import type {
  DepartureTimeBucket,
  ParcelCategory,
  SortOption,
  TransportMode,
} from "./search-results.types";
import type { DateValue } from "@/components/ui/SmartDatePicker";

type FilterMode = "all" | TransportMode;

const HEADER_HEIGHT = 78;
const SEARCH_BAR_FIXED_HEIGHT = 96;
const SIDEBAR_TOP = HEADER_HEIGHT + SEARCH_BAR_FIXED_HEIGHT + 16;

const SIDEBAR_TRANSITION_MS = 500;
const SIDEBAR_SLIDE_DISTANCE = 12;

const PAGE_SIZE = 10;

// ─── Skeletons inline ────────────────────────────────

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
            <div key={index} className="flex items-center justify-between gap-3 px-2 py-2">
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
            <div key={index} className="flex items-center justify-between gap-3 px-2 py-1.5">
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
                className={`h-7 rounded-full ${index % 3 === 0 ? "w-24" : "w-20"}`}
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

// ─── Empty / Error states ────────────────────────────

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

function ErrorState({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("search");

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50 px-6 py-12 text-center dark:border-red-900/40 dark:bg-red-950/20">
      <h3 className="text-[16px] font-semibold text-red-900 dark:text-red-200">
        {t("errorState.title")}
      </h3>
      <p className="mt-1 max-w-md text-[13px] text-red-700 dark:text-red-300">
        {t("errorState.description")}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-red-700"
      >
        {t("errorState.retry")}
      </button>
    </div>
  );
}

// ─── Main view ───────────────────────────────────────

export default function SearchResultsView() {
  const t = useTranslations("search");
  const tCommon = useTranslations("common");
  const locale = useLocale() as "fr" | "en";

  const [activeMode, setActiveMode] = useState<FilterMode>("all");
  const [sort, setSort] = useState<SortOption>("earliest");

  const [superTripperOnly, setSuperTripperOnly] = useState(false);
  const [profileVerifiedOnly, setProfileVerifiedOnly] = useState(false);
  const [instantBookingOnly, setInstantBookingOnly] = useState(false);
  const [verifiedTicketOnly, setVerifiedTicketOnly] = useState(false);

  const [selectedDepartureBuckets, setSelectedDepartureBuckets] = useState<DepartureTimeBucket[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<ParcelCategory[]>([]);

  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const { placeholderRef: sidebarPlaceholderRef, fixedRect } =
    useFixedSidebarPosition(SIDEBAR_TOP);

  const [searchDraft, setSearchDraft] = useState<{
    from: string;
    to: string;
    dateValue: DateValue | null;
  }>({
    from: "",
    to: "",
    dateValue: null,
  });

  const tripsParams = useMemo(
    () => ({
      mode: activeMode,
      from: searchDraft.from || undefined,
      to: searchDraft.to || undefined,
      dateFrom:
        searchDraft.dateValue?.mode === "exact" && searchDraft.dateValue.date
          ? searchDraft.dateValue.date.toISOString()
          : undefined,
      sort,
      superTripper: superTripperOnly,
      profileVerified: profileVerifiedOnly,
      instantBooking: instantBookingOnly,
      verifiedTicket: verifiedTicketOnly,
      categories: selectedCategories,
      departureBuckets: selectedDepartureBuckets,
      limit: PAGE_SIZE,
      locale,
    }),
    [
      activeMode,
      searchDraft.from,
      searchDraft.to,
      searchDraft.dateValue,
      sort,
      superTripperOnly,
      profileVerifiedOnly,
      instantBookingOnly,
      verifiedTicketOnly,
      selectedCategories,
      selectedDepartureBuckets,
      locale,
    ]
  );

  const facetsParams = useMemo(
    () => ({
      mode: activeMode,
      from: searchDraft.from || undefined,
      to: searchDraft.to || undefined,
      dateFrom:
        searchDraft.dateValue?.mode === "exact" && searchDraft.dateValue.date
          ? searchDraft.dateValue.date.toISOString()
          : undefined,
      categories: selectedCategories,
      departureBuckets: selectedDepartureBuckets,
      locale,
    }),
    [
      activeMode,
      searchDraft.from,
      searchDraft.to,
      searchDraft.dateValue,
      selectedCategories,
      selectedDepartureBuckets,
      locale,
    ]
  );

  const tripsQuery = useTripsSearch(tripsParams);
  const facetsQuery = useSearchFacets(facetsParams);

  const trips = useMemo(
    () => tripsQuery.data?.pages.flatMap((p) => p.trips) ?? [],
    [tripsQuery.data]
  );
  const totalCount = tripsQuery.data?.pages[0]?.totalCount ?? 0;

  const isPageLoading = tripsQuery.isLoading;
  const isLoadingMore = tripsQuery.isFetchingNextPage;
  const isError = tripsQuery.isError;
  const hasMore = tripsQuery.hasNextPage;

  const hasSearchedRoute = !!(searchDraft.from || searchDraft.to);

  const dynamicTitle = useMemo(() => {
    const hasFrom = !!searchDraft.from;
    const hasTo = !!searchDraft.to;
    const hasExactDate =
      searchDraft.dateValue?.mode === "exact" &&
      !!searchDraft.dateValue.date;

    const dateStr = hasExactDate && searchDraft.dateValue?.date
      ? new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(searchDraft.dateValue.date)
      : "";

    if (hasFrom && hasTo) {
      return t("dynamicTitle.fromTo", { from: searchDraft.from, to: searchDraft.to });
    }
    if (hasFrom) return t("dynamicTitle.fromOnly", { from: searchDraft.from });
    if (hasTo) return t("dynamicTitle.toOnly", { to: searchDraft.to });
    if (dateStr) return t("dynamicTitle.dateOnly", { date: dateStr });
    return t("dynamicTitle.noFilter");
  }, [searchDraft, t, locale]);

  const showHint = !searchDraft.from && !searchDraft.to;

  const toggleCategory = (category: ParcelCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((item) => item !== category) : [...prev, category]
    );
  };

  const toggleDepartureBucket = (bucket: DepartureTimeBucket) => {
    setSelectedDepartureBuckets((prev) =>
      prev.includes(bucket) ? prev.filter((b) => b !== bucket) : [...prev, bucket]
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
    setSearchDraft({ from: "", to: "", dateValue: null });
  };

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) tripsQuery.fetchNextPage();
  };

  const handleSearchBarSubmit = (value: TripSearchValue) => {
    setSearchDraft({ from: value.from, to: value.to, dateValue: value.dateValue });
  };

  const hasActiveFilters =
    sort !== "earliest" ||
    activeMode !== "all" ||
    superTripperOnly ||
    profileVerifiedOnly ||
    instantBookingOnly ||
    verifiedTicketOnly ||
    selectedCategories.length > 0 ||
    selectedDepartureBuckets.length > 0 ||
    !!searchDraft.from ||
    !!searchDraft.to;

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
    superTripperCount: facetsQuery.data?.superTripperCount ?? 0,
    profileVerifiedCount: facetsQuery.data?.profileVerifiedCount ?? 0,
    instantBookingCount: facetsQuery.data?.instantBookingCount ?? 0,
    verifiedTicketCount: facetsQuery.data?.verifiedTicketCount ?? 0,
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
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .yamba-sidebar-scroll::-webkit-scrollbar { width: 6px; }
        .yamba-sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
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
                onSearchAction={handleSearchBarSubmit}
              />
            )}
          </div>
        </div>

        <section className="sticky top-[78px] z-[100] border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 md:hidden">
          {isPageLoading ? (
            <MobileSearchExperienceSkeleton />
          ) : (
            <MobileSearchExperience
              mode="summary"
              from={searchDraft.from}
              to={searchDraft.to}
              dateValue={searchDraft.dateValue}
              resultsCount={totalCount}
              onFromChange={(value) => setSearchDraft((prev) => ({ ...prev, from: value }))}
              onToChange={(value) => setSearchDraft((prev) => ({ ...prev, to: value }))}
              onDateValueChange={(value) => setSearchDraft((prev) => ({ ...prev, dateValue: value }))}
              onSearch={() => {}}
              onOpenFilters={() => setMobileFiltersOpen(true)}
            />
          )}
        </section>

        <section className="mx-auto max-w-7xl px-3 pb-14">
          <div className="md:hidden" style={{ paddingTop: 16 }} />
          <div className="hidden md:block" style={{ paddingTop: SEARCH_BAR_FIXED_HEIGHT + 24 }} />

          <div className="mb-5">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              {dynamicTitle}
            </h1>
            {showHint && (
              <p className="mt-1.5 text-[13px] text-slate-500 dark:text-slate-400">
                {t("subtitleHint")}
              </p>
            )}
          </div>

          {isPageLoading ? (
            <>
              <div className="mb-6"><TransportModeTabsSkeleton /></div>
              <div className="grid gap-6 md:grid-cols-[280px_1fr] md:items-start">
                <div className="hidden md:block"><SearchFiltersSidebarSkeleton /></div>
                <div className="space-y-3">
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
                  onChange={setActiveMode}
                  counts={facetsQuery.data?.modeCount}
                />
              </div>

              <div className="grid gap-6 md:grid-cols-[280px_1fr] md:items-start">
                <div ref={sidebarPlaceholderRef} className="relative hidden md:block">
                  <div
                    style={{
                      opacity: fixedRect.isFixed ? 0 : 1,
                      visibility: fixedRect.isFixed ? "hidden" : "visible",
                      transition: `opacity ${SIDEBAR_TRANSITION_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`,
                    }}
                  >
                    <SearchFiltersSidebar {...sidebarProps} />
                  </div>

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

                <div className="space-y-3">
                  {isError ? (
                    <ErrorState onRetry={() => tripsQuery.refetch()} />
                  ) : trips.length === 0 ? (
                    hasSearchedRoute ? (
                      <SavedRouteCTA
                        variant="noResults"
                        originCity={searchDraft.from || undefined}
                        destinationCity={searchDraft.to || undefined}
                      />
                    ) : (
                      <EmptyState onClearFilters={clearAll} hasFilters={hasActiveFilters} />
                    )
                  ) : (
                    <>
                      <div className="md:hidden space-y-3">
                        {trips.map((item) => (
                          <TripResultCardMobile
                            key={item.id}
                            item={item}
                            highlightedCategories={selectedCategories}
                          />
                        ))}
                      </div>

                      <div className="hidden md:block space-y-3">
                        {trips.map((item) => (
                          <TripResultCard
                            key={item.id}
                            item={item}
                            highlightedCategories={selectedCategories}
                          />
                        ))}
                      </div>

                      {hasMore && (
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
                            {t("loadMore")}
                          </button>
                        </div>
                      )}

                      {!hasMore && hasSearchedRoute && (
                        <div className="pt-4">
                          <SavedRouteCTA
                            variant="banner"
                            originCity={searchDraft.from || undefined}
                            destinationCity={searchDraft.to || undefined}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </section>

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
                  {t("viewTrips", { count: totalCount })}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
