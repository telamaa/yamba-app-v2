"use client";

import { useTranslations } from "next-intl";
import {
  ParcelCategory,
  PricesByCategory,
  YambaTripResult,
} from "./search-results.types";

type Props = {
  trip: YambaTripResult;
  /** Catégories actuellement filtrées dans la sidebar (highlight orange) */
  highlightedCategories?: ParcelCategory[];
  /** Affiche le titre + sous-titre route+date en haut. Default: true */
  showHeader?: boolean;
  /** Affiche le disclaimer en bas. Default: true */
  showDisclaimer?: boolean;
  /** Variant compact : padding et tailles réduits (popover desktop). Default: false (mobile) */
  variant?: "comfortable" | "compact";
};

/**
 * Composant partagé qui affiche la liste des prix par catégorie d'un trajet.
 *
 * Utilisé par :
 *  - TripPricingBottomSheet (mobile, variant="comfortable")
 *  - TripPricingPopover (desktop, variant="compact")
 *
 * Comportement :
 *  - Catégories triées par prix croissant
 *  - Highlight orange sur catégorie filtrée dans la sidebar
 *  - Header optionnel (titre + route + date)
 *  - Disclaimer optionnel
 */
export default function TripPricingList({
                                          trip,
                                          highlightedCategories = [],
                                          showHeader = true,
                                          showDisclaimer = true,
                                          variant = "comfortable",
                                        }: Props) {
  const t = useTranslations("search");

  const sortedEntries = getSortedPriceEntries(trip.pricesByCategory);
  const isCompact = variant === "compact";

  return (
    <div
      className={isCompact ? "px-4 pt-3" : "px-5 pt-2"}
    >
      {showHeader && (
        <div className={isCompact ? "pb-3" : "pb-4"}>
          <h2
            className={[
              "font-semibold text-slate-900 dark:text-white",
              isCompact ? "text-[15px]" : "text-[18px]",
            ].join(" ")}
          >
            {t("pricingSheet.title")}
          </h2>
          <p
            className={[
              "mt-1 text-slate-500 dark:text-slate-400",
              isCompact ? "text-[12px]" : "text-[13px]",
            ].join(" ")}
          >
            {trip.fromCity} → {trip.toCity} · {trip.travelDate}
          </p>
        </div>
      )}

      <div
        className={[
          "overflow-y-auto",
          isCompact ? "max-h-[300px]" : "max-h-[55vh]",
        ].join(" ")}
      >
        <div className="space-y-1">
          {sortedEntries.length === 0 ? (
            <div className="py-4 text-center text-[13px] text-slate-500 dark:text-slate-400">
              {t("pricingSheet.noPrices")}
            </div>
          ) : (
            sortedEntries.map(([category, price]) => {
              const isHighlighted = highlightedCategories.includes(
                category as ParcelCategory
              );
              return (
                <PriceRow
                  key={category}
                  category={category as ParcelCategory}
                  price={price}
                  currency={trip.currency ?? "€"}
                  isHighlighted={isHighlighted}
                  isCompact={isCompact}
                />
              );
            })
          )}
        </div>
      </div>

      {showDisclaimer && sortedEntries.length > 0 && (
        <p
          className={[
            "leading-relaxed text-slate-500 dark:text-slate-400",
            isCompact ? "mt-3 text-[11px]" : "mt-4 text-[12px]",
          ].join(" ")}
        >
          {t("pricingSheet.disclaimer")}
        </p>
      )}
    </div>
  );
}

// ── Sub-components ──

function PriceRow({
                    category,
                    price,
                    currency,
                    isHighlighted,
                    isCompact,
                  }: {
  category: ParcelCategory;
  price: number;
  currency: string;
  isHighlighted: boolean;
  isCompact: boolean;
}) {
  const t = useTranslations("search.categories");

  return (
    <div
      className={[
        "flex items-center justify-between rounded-xl transition-colors",
        isCompact ? "px-2.5 py-2" : "px-3 py-3",
        isHighlighted
          ? "bg-[#FFF6E8] dark:bg-[#FF9900]/10"
          : "hover:bg-slate-50 dark:hover:bg-slate-900/40",
      ].join(" ")}
    >
      <div className="flex min-w-0 items-center gap-3">
        <CategoryIcon
          category={category}
          isHighlighted={isHighlighted}
          size={isCompact ? "sm" : "md"}
        />
        <span
          className={[
            "truncate",
            isCompact ? "text-[13px]" : "text-[14px]",
            isHighlighted
              ? "font-semibold text-[#9A3412] dark:text-[#FFB84D]"
              : "text-slate-900 dark:text-slate-100",
          ].join(" ")}
        >
          {t(category)}
        </span>
      </div>
      <span
        className={[
          "ml-2 shrink-0 font-semibold tabular-nums",
          isCompact ? "text-[14px]" : "text-[15px]",
          isHighlighted
            ? "text-[#9A3412] dark:text-[#FFB84D]"
            : "text-slate-900 dark:text-white",
        ].join(" ")}
      >
        {price}
        {currency}
      </span>
    </div>
  );
}

// ── Helpers ──

function getSortedPriceEntries(
  prices: PricesByCategory | undefined
): [string, number][] {
  if (!prices) return [];
  return Object.entries(prices)
    .filter(([, price]) => typeof price === "number")
    .sort(([, a], [, b]) => (a as number) - (b as number)) as [
    string,
    number,
  ][];
}

// ── Category icons ──

const ICON_BG_DEFAULT = "bg-slate-100 dark:bg-slate-800";
const ICON_BG_HIGHLIGHT = "bg-[#FFEDD5] dark:bg-[#FF9900]/20";
const ICON_COLOR_DEFAULT = "text-slate-500 dark:text-slate-400";
const ICON_COLOR_HIGHLIGHT = "text-[#9A3412] dark:text-[#FFB84D]";

function CategoryIcon({
                        category,
                        isHighlighted,
                        size,
                      }: {
  category: ParcelCategory;
  isHighlighted: boolean;
  size: "sm" | "md";
}) {
  const bg = isHighlighted ? ICON_BG_HIGHLIGHT : ICON_BG_DEFAULT;
  const color = isHighlighted ? ICON_COLOR_HIGHLIGHT : ICON_COLOR_DEFAULT;
  const sizeClasses = size === "sm" ? "h-7 w-7" : "h-8 w-8";
  const iconSize = size === "sm" ? 12 : 14;

  return (
    <div
      className={[
        "flex shrink-0 items-center justify-center rounded-full",
        sizeClasses,
        bg,
        color,
      ].join(" ")}
    >
      {renderCategorySvg(category, iconSize)}
    </div>
  );
}

function renderCategorySvg(category: ParcelCategory, size: number) {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (category) {
    case "clothes":
      return (
        <svg {...props}>
          <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />
        </svg>
      );
    case "shoes":
      return (
        <svg {...props}>
          <path d="M3 16h18M5 16V9a4 4 0 0 1 8 0v7M13 9l4 2 4 1v4" />
        </svg>
      );
    case "fashion-accessories":
      return (
        <svg {...props}>
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
          <path d="M3 6h18M16 10a4 4 0 0 1-8 0" />
        </svg>
      );
    case "other-accessories":
      return (
        <svg {...props}>
          <path d="m7.5 4.27 9 5.15M21 8.5v7l-9 5.15-9-5.15v-7L12 3.35l9 5.15z" />
          <path d="M12 12.21 21 8.5M12 22.5v-10M3 8.5l9 3.71" />
        </svg>
      );
    case "books":
      return (
        <svg {...props}>
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      );
    case "documents":
      return (
        <svg {...props}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      );
    case "small-toys":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="4" />
        </svg>
      );
    case "phone":
      return (
        <svg {...props}>
          <rect x="5" y="2" width="14" height="20" rx="2" />
          <path d="M12 18h.01" />
        </svg>
      );
    case "computer":
      return (
        <svg {...props}>
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
      );
    case "other-electronics":
      return (
        <svg {...props}>
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M9 9h6v6H9z" />
        </svg>
      );
    case "checked-bag-23kg":
      return (
        <svg {...props}>
          <rect x="6" y="6" width="12" height="14" rx="2" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M9 22v-2M15 22v-2" />
        </svg>
      );
    case "cabin-bag-12kg":
      return (
        <svg {...props}>
          <rect x="8" y="6" width="8" height="14" rx="2" />
          <path d="M10 6V4a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v2" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
        </svg>
      );
  }
}
