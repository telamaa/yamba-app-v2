"use client";

import { useMemo, useState } from "react";
import {
  Banknote,
  BookOpen,
  Briefcase,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  Cpu,
  FileText,
  Footprints,
  Laptop,
  Medal,
  // Moon, // ⚠️ Commenté — utilisé par "Horaires de départ" (réactivable plus bas)
  ShieldCheck,
  Shirt,
  ShoppingBag,
  Smartphone,
  Star,
  // Sun,    // ⚠️ Commenté
  // Sunrise, // ⚠️ Commenté
  // Sunset, // ⚠️ Commenté
  Ticket,
  ToyBrick,
  Zap,
  Package,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  DepartureTimeBucket,
  ParcelCategory,
  SortOption,
} from "./search-results.types";

type Props = {
  // ── Sort ──
  sort: SortOption;
  onSortChange: (value: SortOption) => void;

  // ── Trust & safety ──
  superTripperOnly: boolean;
  onSuperTripperChange: (value: boolean) => void;

  profileVerifiedOnly: boolean;
  onProfileVerifiedChange: (value: boolean) => void;

  instantBookingOnly: boolean;
  onInstantBookingChange: (value: boolean) => void;

  verifiedTicketOnly: boolean;
  onVerifiedTicketChange: (value: boolean) => void;

  superTripperCount: number;
  profileVerifiedCount: number;
  instantBookingCount: number;
  verifiedTicketCount: number;

  // ── Departure times ── (gardé dans l'API pour réactivation future)
  selectedDepartureBuckets?: DepartureTimeBucket[];
  onToggleDepartureBucket?: (bucket: DepartureTimeBucket) => void;

  // ── Categories ──
  selectedCategories: ParcelCategory[];
  onToggleCategory: (value: ParcelCategory) => void;

  // ── Actions ──
  onClear: () => void;

  // ── UI options ──
  hideHeader?: boolean;
  className?: string;
};

const ALL_CATEGORIES: ParcelCategory[] = [
  "clothes",
  "shoes",
  "fashion-accessories",
  "other-accessories",
  "books",
  "documents",
  "small-toys",
  "phone",
  "computer",
  "other-electronics",
  "checked-bag-23kg",
  "cabin-bag-12kg",
];

const TOP_CATEGORIES_COUNT = 6;

function getCategoryMeta(
  category: ParcelCategory,
  t: (k: string) => string
): { label: string; icon: React.ReactNode } {
  const map: Record<ParcelCategory, { label: string; icon: React.ReactNode }> = {
    clothes: { label: t("categories.clothes"), icon: <Shirt size={14} /> },
    shoes: { label: t("categories.shoes"), icon: <Footprints size={14} /> },
    "fashion-accessories": {
      label: t("categories.fashionAccessories"),
      icon: <ShoppingBag size={14} />,
    },
    "other-accessories": {
      label: t("categories.otherAccessories"),
      icon: <Package size={14} />,
    },
    books: { label: t("categories.books"), icon: <BookOpen size={14} /> },
    documents: { label: t("categories.documents"), icon: <FileText size={14} /> },
    "small-toys": { label: t("categories.smallToys"), icon: <ToyBrick size={14} /> },
    phone: { label: t("categories.phone"), icon: <Smartphone size={14} /> },
    computer: { label: t("categories.computer"), icon: <Laptop size={14} /> },
    "other-electronics": {
      label: t("categories.otherElectronics"),
      icon: <Cpu size={14} />,
    },
    "checked-bag-23kg": {
      label: t("categories.checkedBag"),
      icon: <Briefcase size={14} />,
    },
    "cabin-bag-12kg": {
      label: t("categories.cabinBag"),
      icon: <Briefcase size={14} />,
    },
  };

  return map[category] ?? { label: category, icon: <Package size={14} /> };
}

// ── Custom radio button ──
// Remplace <input type="radio"> natif pour garantir visibilité en dark mode
// et éviter les bugs d'association label-input.
function CustomRadio({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={[
        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
        checked
          ? "border-[#FF9900]"
          : "border-slate-300 dark:border-slate-600",
      ].join(" ")}
    >
      {checked && (
        <span className="h-2 w-2 rounded-full bg-[#FF9900]" />
      )}
    </span>
  );
}

// ── Custom checkbox ──
// Remplace <input type="checkbox"> natif pour garantir visibilité en dark mode
// et éviter les bugs d'association label-input.
function CustomCheckbox({
                          checked,
                          disabled,
                        }: {
  checked: boolean;
  disabled: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={[
        "flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors",
        disabled
          ? "border-slate-200 dark:border-slate-700"
          : checked
            ? "border-[#FF9900] bg-[#FF9900]"
            : "border-slate-300 dark:border-slate-600",
      ].join(" ")}
    >
      {checked && !disabled && (
        <Check size={11} strokeWidth={3.5} className="text-white" />
      )}
    </span>
  );
}

function RightMeta({
                     count,
                     icon,
                   }: {
  count?: number;
  icon: React.ReactNode;
}) {
  const disabled = typeof count === "number" && count === 0;

  return (
    <span
      className={[
        "flex items-center gap-2.5",
        disabled
          ? "text-slate-300 dark:text-slate-600"
          : "text-slate-500 dark:text-slate-400",
      ].join(" ")}
    >
      {typeof count === "number" && (
        <span className="min-w-[18px] text-right text-[12px] font-semibold tabular-nums">
          {count}
        </span>
      )}
      <span>{icon}</span>
    </span>
  );
}

export default function SearchFiltersSidebar({
                                               sort,
                                               onSortChange,
                                               superTripperOnly,
                                               onSuperTripperChange,
                                               profileVerifiedOnly,
                                               onProfileVerifiedChange,
                                               instantBookingOnly,
                                               onInstantBookingChange,
                                               verifiedTicketOnly,
                                               onVerifiedTicketChange,
                                               superTripperCount,
                                               profileVerifiedCount,
                                               instantBookingCount,
                                               verifiedTicketCount,
                                               // selectedDepartureBuckets = [],   // ⚠️ Commenté — section désactivée
                                               // onToggleDepartureBucket,         // ⚠️ Commenté — section désactivée
                                               selectedCategories,
                                               onToggleCategory,
                                               onClear,
                                               hideHeader = false,
                                               className = "",
                                             }: Props) {
  const t = useTranslations("search");
  const tCommon = useTranslations("common");

  const [showAllCategories, setShowAllCategories] = useState(false);

  // ── Sort options ──
  const sortOptions: Array<{
    value: SortOption;
    label: string;
    icon: React.ReactNode;
  }> = [
    {
      value: "earliest",
      label: t("filters.earliest"),
      icon: <Clock3 size={18} />,
    },
    {
      value: "lowestPrice",
      label: t("filters.lowestPrice"),
      icon: <Banknote size={18} />,
    },
    {
      value: "bestRated",
      label: t("filters.bestRated"),
      icon: <Star size={18} />,
    },
  ];

  // ── Trust options ──
  const trustOptions = [
    {
      checked: superTripperOnly,
      onChange: onSuperTripperChange,
      label: t("badges.superTripper"),
      icon: <Medal size={18} className="text-[#FF9900]" />,
      count: superTripperCount,
    },
    {
      checked: profileVerifiedOnly,
      onChange: onProfileVerifiedChange,
      label: t("badges.profileVerified"),
      icon: <ShieldCheck size={18} className="text-[#FF9900]" />,
      count: profileVerifiedCount,
    },
    {
      checked: instantBookingOnly,
      onChange: onInstantBookingChange,
      label: t("badges.instantBooking"),
      icon: <Zap size={18} className="text-[#FF9900]" />,
      count: instantBookingCount,
    },
    {
      checked: verifiedTicketOnly,
      onChange: onVerifiedTicketChange,
      label: t("badges.verifiedTicket"),
      icon: <Ticket size={18} className="text-[#FF9900]" />,
      count: verifiedTicketCount,
    },
  ];

  // ⚠️ DÉSACTIVÉ — Bloc "Horaires de départ" masqué pour le MVP.
  // ⚠️ La logique côté SearchResultsView est conservée pour réactivation rapide.
  // ⚠️ Pour réactiver:
  //   1. Décommenter les imports lucide en haut (Sun, Sunrise, Sunset, Moon)
  //   2. Décommenter les déstructurations `selectedDepartureBuckets` et `onToggleDepartureBucket`
  //   3. Décommenter le bloc <DepartureBucketsSection /> dans le rendu plus bas
  //
  // const departureBuckets: Array<{
  //   value: DepartureTimeBucket;
  //   label: string;
  //   range: string;
  //   icon: React.ReactNode;
  // }> = [
  //   { value: "morning",   label: t("departureTimes.morning"),   range: "06h–12h", icon: <Sunrise size={14} /> },
  //   { value: "afternoon", label: t("departureTimes.afternoon"), range: "12h–18h", icon: <Sun size={14} /> },
  //   { value: "evening",   label: t("departureTimes.evening"),   range: "18h–22h", icon: <Sunset size={14} /> },
  //   { value: "night",     label: t("departureTimes.night"),     range: "22h–06h", icon: <Moon size={14} /> },
  // ];

  // ── Categories logic ──
  const visibleCategories = useMemo(
    () =>
      showAllCategories
        ? ALL_CATEGORIES
        : ALL_CATEGORIES.slice(0, TOP_CATEGORIES_COUNT),
    [showAllCategories]
  );

  const hiddenCategoriesCount = ALL_CATEGORIES.length - TOP_CATEGORIES_COUNT;

  // ── Detect if any filter is active (to show "Clear all") ──
  const hasActiveFilters =
    sort !== "earliest" ||
    superTripperOnly ||
    profileVerifiedOnly ||
    instantBookingOnly ||
    verifiedTicketOnly ||
    selectedCategories.length > 0;
  // ⚠️ Réactiver pour "Horaires de départ" :
  // || selectedDepartureBuckets.length > 0;

  return (
    <aside
      className={[
        "h-fit overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950",
        className,
      ].join(" ")}
    >
      {!hideHeader && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800/60">
          <h2 className="text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">
            {t("filters.sortBy")}
          </h2>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onClear}
              className="text-[12px] font-semibold text-[#FF9900] transition-colors hover:text-[#F08700] dark:text-[#FFB84D] dark:hover:text-[#FF9900]"
            >
              {t("filters.clearAll")}
            </button>
          )}
        </div>
      )}

      <div
        className="space-y-5 px-5 py-4"
        // ⚠️ role="group" pour accessibilité — annonce que tout ce bloc est un conteneur de filtres
        role="group"
        aria-label={t("filters.sortBy")}
      >
        {/* ── Sort (custom radio buttons) ── */}
        <div
          className="space-y-2"
          role="radiogroup"
          aria-label={t("filters.sortBy")}
        >
          {sortOptions.map((opt) => {
            const isActive = sort === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => onSortChange(opt.value)}
                className={[
                  "flex w-full items-center justify-between gap-3 rounded-xl px-2.5 py-2 text-left transition-colors",
                  isActive
                    ? "bg-[#FFF6E8] dark:bg-[#FF9900]/10"
                    : "hover:bg-slate-50 dark:hover:bg-slate-900/60",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9900]/40",
                ].join(" ")}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <CustomRadio checked={isActive} />
                  <span
                    className={[
                      "truncate text-[13px]",
                      isActive
                        ? "font-semibold text-slate-900 dark:text-white"
                        : "font-medium text-slate-700 dark:text-slate-300",
                    ].join(" ")}
                  >
                    {opt.label}
                  </span>
                </span>
                <span
                  className={
                    isActive
                      ? "text-[#FF9900]"
                      : "text-slate-400 dark:text-slate-500"
                  }
                >
                  {opt.icon}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Trust & safety (custom checkboxes) ── */}
        <div
          className="space-y-2.5 border-t border-slate-100 pt-4 dark:border-slate-800/60"
          role="group"
          aria-label={t("filters.trustSafety")}
        >
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {t("filters.trustSafety")}
          </h3>

          <div className="space-y-1">
            {trustOptions.map((option) => {
              const disabled = option.count === 0;

              return (
                <button
                  key={option.label}
                  type="button"
                  role="checkbox"
                  aria-checked={option.checked}
                  aria-disabled={disabled}
                  disabled={disabled}
                  onClick={() => option.onChange(!option.checked)}
                  className={[
                    "flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left transition-colors",
                    disabled
                      ? "cursor-not-allowed"
                      : "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/60",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9900]/40",
                  ].join(" ")}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <CustomCheckbox
                      checked={option.checked}
                      disabled={disabled}
                    />
                    <span
                      className={[
                        "truncate text-[13px] font-medium",
                        disabled
                          ? "text-slate-300 dark:text-slate-600"
                          : "text-slate-700 dark:text-slate-300",
                      ].join(" ")}
                    >
                      {option.label}
                    </span>
                  </span>
                  <RightMeta count={option.count} icon={option.icon} />
                </button>
              );
            })}
          </div>
        </div>

        {/* ⚠️ ──────────────────────────────────────────────────────── */}
        {/* ⚠️ DÉSACTIVÉ — Section "Horaires de départ" cachée pour MVP */}
        {/* ⚠️ Pour réactiver : décommenter ce bloc + voir notes en haut */}
        {/* ⚠️ ──────────────────────────────────────────────────────── */}
        {/*
        {onToggleDepartureBucket && (
          <div className="space-y-2.5 border-t border-slate-100 pt-4 dark:border-slate-800/60">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {t("filters.departureTimes")}
            </h3>

            <div className="grid grid-cols-2 gap-2">
              {departureBuckets.map((bucket) => {
                const isActive = selectedDepartureBuckets.includes(bucket.value);
                return (
                  <button
                    key={bucket.value}
                    type="button"
                    onClick={() => onToggleDepartureBucket(bucket.value)}
                    className={[
                      "inline-flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2 text-left transition-colors",
                      isActive
                        ? "border-[#FF9900]/50 bg-[#FFF6E8] dark:border-[#FF9900]/40 dark:bg-[#FF9900]/10"
                        : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-900",
                    ].join(" ")}
                  >
                    <span className={[
                      "inline-flex items-center gap-1.5 text-[12px] font-semibold",
                      isActive ? "text-[#B45309] dark:text-[#FFB84D]" : "text-slate-700 dark:text-slate-300",
                    ].join(" ")}>
                      {bucket.icon}
                      {bucket.label}
                    </span>
                    <span className="text-[10px] text-slate-400 tabular-nums dark:text-slate-500">
                      {bucket.range}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        */}

        {/* ── Categories ── */}
        <div className="space-y-2.5 border-t border-slate-100 pt-4 dark:border-slate-800/60">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {t("filters.categories")}
          </h3>

          <div className="flex flex-wrap gap-1.5">
            {visibleCategories.map((category) => {
              const meta = getCategoryMeta(category, tCommon);
              const active = selectedCategories.includes(category);

              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => onToggleCategory(category)}
                  className={[
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                    active
                      ? "border-[#FF9900]/40 bg-[#FFF6E8] text-[#B45309] dark:border-[#FF9900]/30 dark:bg-[#FF9900]/10 dark:text-[#FFB84D]"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900",
                  ].join(" ")}
                >
                  {meta.icon}
                  {meta.label}
                </button>
              );
            })}
          </div>

          {hiddenCategoriesCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAllCategories((prev) => !prev)}
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#FF9900] transition-colors hover:text-[#F08700] dark:text-[#FFB84D] dark:hover:text-[#FF9900]"
            >
              {showAllCategories
                ? t("filters.showLess")
                : t("filters.showAll", { count: ALL_CATEGORIES.length })}
              {showAllCategories ? (
                <ChevronUp size={14} />
              ) : (
                <ChevronDown size={14} />
              )}
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
