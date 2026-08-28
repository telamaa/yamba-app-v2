"use client";

import {
  Baby,
  Banknote,
  Check,
  Clock3,
  FileText,
  Medal,
  Package,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Star,
  Ticket,
  Wrench,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  SEARCH_FAMILIES,
  type DepartureTimeBucket,
  type SearchFamily,
  type SortOption,
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

  // ── Familles (D14/D33) ──
  selectedFamilies: SearchFamily[];
  onToggleFamily: (value: SearchFamily) => void;
  familyCounts: Partial<Record<SearchFamily, number>>;

  // ── Actions ──
  onClear: () => void;

  // ── UI options ──
  hideHeader?: boolean;
  className?: string;
};

/** D14 — icônes Lucide des 8 familles (mêmes clés que l'API) */
const FAMILY_ICONS: Record<SearchFamily, React.ReactNode> = {
  DOCUMENTS_PAPERS: <FileText size={14} />,
  CLOTHES_TEXTILE: <Shirt size={14} />,
  FOOD_DRY_SEALED: <Package size={14} />,
  ELECTRONICS_DEVICES: <Smartphone size={14} />,
  COSMETICS_CARE: <Sparkles size={14} />,
  PARTS_TOOLS: <Wrench size={14} />,
  TOYS_CHILDCARE: <Baby size={14} />,
  MISC_ACCESSORIES: <ShoppingBag size={14} />,
};

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
                                               selectedFamilies,
                                               onToggleFamily,
                                               familyCounts,
                                               onClear,
                                               hideHeader = false,
                                               className = "",
                                             }: Props) {
  const t = useTranslations("search");


  // ── Sort options ──
  const sortOptions: Array<{
    value: SortOption;
    label: string;
    hint?: string;
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
      hint: t("filters.lowestPriceHint"),
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
    // D20 v1 — « Réservation instantanée » n'existe plus : toute demande passe
    // par l'accord du Voyageur. Props conservées (API du composant), entrée retirée.
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

  // ── Detect if any filter is active (to show "Clear all") ──
  const hasActiveFilters =
    sort !== "earliest" ||
    superTripperOnly ||
    profileVerifiedOnly ||
    instantBookingOnly ||
    verifiedTicketOnly ||
    selectedFamilies.length > 0;
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
                    {opt.hint && (
                      <span className="ml-1 text-[11px] font-normal text-slate-400 dark:text-slate-500">
                        {opt.hint}
                      </span>
                    )}
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
            {trustOptions.filter((o) => o.count > 0).map((option) => {
              const disabled = false;

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

        {/* ── Familles (D14/D33) : « Que voulez-vous envoyer ? » ── */}
        <div className="space-y-2.5 border-t border-slate-100 pt-4 dark:border-slate-800/60">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {t("filters.families")}
          </h3>

          <div className="flex flex-wrap gap-1.5">
            {SEARCH_FAMILIES.map((family) => {
              const active = selectedFamilies.includes(family);
              const count = familyCounts[family];
              const disabled = count === 0 && !active;
              return (
                <button
                  key={family}
                  type="button"
                  disabled={disabled}
                  aria-pressed={active}
                  onClick={() => onToggleFamily(family)}
                  className={[
                    "inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                    active
                      ? "border-[#FF9900]/40 bg-[#FFF6E8] text-[#B45309] dark:border-[#FF9900]/30 dark:bg-[#FF9900]/10 dark:text-[#FFB84D]"
                      : disabled
                        ? "cursor-not-allowed border-slate-100 text-slate-300 dark:border-slate-800 dark:text-slate-600"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900",
                  ].join(" ")}
                >
                  {FAMILY_ICONS[family]}
                  {t(`families.${family}`)}
                  {typeof count === "number" && (
                    <span className="text-[10px] tabular-nums text-slate-400 dark:text-slate-500">{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}
