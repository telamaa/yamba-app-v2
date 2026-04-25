"use client";

import { useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { ChevronRight, AlertCircle, HelpCircle } from "lucide-react";
import { useBottomSheet } from "@/hooks/useBottomSheet";
import TripPricingBottomSheet from "./TripPricingBottomSheet";
import { ParcelCategory, YambaTripResult } from "./search-results.types";
import { formatTripDate } from "./formatTripTimes";

type Props = {
  item: YambaTripResult;
  /** Catégories filtrées dans la sidebar (pour highlight dans le bottom sheet) */
  highlightedCategories?: ParcelCategory[];
};

/**
 * Card mobile (Variante D+ finale) :
 * - Header : pill transport + date + alerte places restantes
 * - Body : heures gros + villes + ligne de durée + prix avec "dès" discret
 * - Footer : avatar + tripper + catégories acceptées
 *
 * Tap sur le `(?)` à côté du prix → ouvre TripPricingBottomSheet
 */
export default function YambaTripResultCardMobile({
                                                    item,
                                                    highlightedCategories = [],
                                                  }: Props) {
  const t = useTranslations("search");
  const locale = useLocale();
  const { isOpen, open, close } = useBottomSheet();

  const transportLabel = t(`transportTabs.${item.transportMode}`);
  const TransportIcon = getTransportIcon(item.transportMode);

  // Date formatée selon la locale active
  const formattedDate = useMemo(
    () => formatTripDate(item.travelDate, locale),
    [item.travelDate, locale]
  );

  const showRemainingAlert =
    typeof item.remainingSlots === "number" && item.remainingSlots <= 3;

  return (
    <>
      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        {/* ── Header : transport + date + alerte ── */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3.5 py-2 dark:border-slate-800/60">
          <div className="flex min-w-0 items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[12px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <TransportIcon size={12} strokeWidth={2} />
              {transportLabel}
            </span>
            <span className="truncate text-[12px] text-slate-500 dark:text-slate-400">
              {formattedDate}
            </span>
          </div>
          {showRemainingAlert && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] text-red-700 dark:bg-red-950/40 dark:text-red-400">
              <AlertCircle size={9} strokeWidth={2.5} />
              {t("card.remainingSlots", { count: item.remainingSlots! })}
            </span>
          )}
        </div>

        {/* ── Body : horaires + prix ── */}
        <div className="px-3.5 py-3">
          <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-start gap-2">
            {/* From */}
            <div className="min-w-0">
              <div className="text-[18px] font-semibold leading-tight tabular-nums text-slate-900 dark:text-white">
                {item.departureTime}
              </div>
              <div className="mt-1 truncate text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                {item.fromCity}
                {item.fromCityCode && (
                  <span className="text-slate-400 dark:text-slate-500">
                    {" "}
                    ({item.fromCityCode})
                  </span>
                )}
              </div>
            </div>

            {/* Duration */}
            <div className="pt-1 text-center">
              {typeof item.durationMinutes === "number" && (
                <div className="mb-1 text-[10px] text-slate-400 dark:text-slate-500">
                  {formatDuration(item.durationMinutes)}
                </div>
              )}
              <div className="relative mx-1.5 h-px bg-slate-200 dark:bg-slate-700">
                <span className="absolute left-0 top-1/2 h-1 w-1 -translate-y-1/2 rounded-full bg-slate-400" />
                <span className="absolute right-0 top-1/2 h-1 w-1 -translate-y-1/2 rounded-full bg-[#FF9900]" />
              </div>
              <div className="mt-1 text-[9px] text-slate-400 dark:text-slate-500">
                {item.stopovers && item.stopovers > 0
                  ? t("card.stopovers", { count: item.stopovers })
                  : t("card.direct")}
              </div>
            </div>

            {/* To */}
            <div className="min-w-0 text-right">
              <div className="text-[18px] font-semibold leading-tight tabular-nums text-slate-900 dark:text-white">
                {item.arrivalTime}
                {item.nextDay && (
                  <sup className="ml-1 inline-block rounded bg-[#FFEDD5] px-1 py-px align-super text-[9px] font-medium text-[#9A3412] dark:bg-[#FF9900]/20 dark:text-[#FFB84D]">
                    +1
                  </sup>
                )}
              </div>
              <div className="mt-1 truncate text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                {item.toCity}
                {item.toCityCode && (
                  <span className="text-slate-400 dark:text-slate-500">
                    {" "}
                    ({item.toCityCode})
                  </span>
                )}
              </div>
            </div>

            {/* Price */}
            <div className="min-w-[50px] text-right">
              <button
                type="button"
                onClick={open}
                className="inline-flex items-center justify-end gap-0.5 text-[9px] leading-none text-slate-400 transition-colors hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                aria-label={t("card.viewPricesByCategory")}
              >
                <HelpCircle size={9} strokeWidth={2} />
                <span>{t("card.fromPrice")}</span>
              </button>
              <div className="mt-1 text-[18px] font-semibold leading-tight text-slate-900 dark:text-white">
                {item.minPrice}
                {item.currency ?? "€"}
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer : tripper + catégories ── */}
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-3.5 py-2 dark:border-slate-800/60">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Avatar item={item} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold leading-tight text-slate-900 dark:text-white">
                {item.travelerFirstName}{" "}
                {item.travelerLastName?.charAt(0)}.
              </div>
              <div className="truncate text-[11px] leading-tight text-slate-500 dark:text-slate-400">
                {typeof item.rating === "number" ? (
                  <>
                    <span className="text-[#FF9900]">★</span>{" "}
                    {item.rating.toFixed(1).replace(".", ",")}{" "}
                    {typeof item.reviewCount === "number" && (
                      <span className="text-slate-400 dark:text-slate-500">
                        ({item.reviewCount})
                      </span>
                    )}
                  </>
                ) : (
                  t("card.newTripper")
                )}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <CategoryPreview categories={item.allowedCategories} />
            <ChevronRight
              size={14}
              strokeWidth={2}
              className="text-slate-400 dark:text-slate-500"
            />
          </div>
        </div>
      </article>

      {/* ── Bottom Sheet Tarifs par catégorie ── */}
      <TripPricingBottomSheet
        isOpen={isOpen}
        onClose={close}
        trip={item}
        highlightedCategories={highlightedCategories}
      />
    </>
  );
}

// ── Sub-components ──

function Avatar({ item }: { item: YambaTripResult }) {
  const initials = `${item.travelerFirstName?.charAt(0) ?? ""}${item.travelerLastName?.charAt(0) ?? ""}`;
  const isSuperTripper = item.superTripper;

  return (
    <div className="relative h-7 w-7 shrink-0">
      {isSuperTripper && (
        <div
          aria-hidden
          className="absolute -inset-[1.5px] rounded-full"
          style={{
            background:
              "conic-gradient(from 0deg, #FF9900, #FFB84D, #FF9900)",
          }}
        />
      )}
      <div className="relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-orange-100 text-[10px] font-semibold text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
        {item.travelerAvatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.travelerAvatarUrl}
            alt={`${item.travelerFirstName ?? ""} ${item.travelerLastName ?? ""}`}
            className="h-full w-full object-cover"
          />
        ) : (
          initials
        )}
      </div>
    </div>
  );
}

function CategoryPreview({
                           categories,
                         }: {
  categories: ParcelCategory[];
}) {
  const previewCount = 2;
  const visible = categories.slice(0, previewCount);
  const overflow = categories.length - visible.length;

  return (
    <div className="flex items-center gap-1">
      {visible.map((cat) => (
        <div
          key={cat}
          className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
          aria-hidden
        >
          {renderCategoryMiniIcon(cat)}
        </div>
      ))}
      {overflow > 0 && (
        <span className="px-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
          +{overflow}
        </span>
      )}
    </div>
  );
}

// ── Helpers ──

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}H`;
  return `${h}H ${m.toString().padStart(2, "0")}`;
}

function getTransportIcon(mode: string) {
  return function TransportIconCmp({
                                     size = 14,
                                     strokeWidth = 2,
                                   }: {
    size?: number;
    strokeWidth?: number;
  }) {
    if (mode === "plane") {
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
        </svg>
      );
    }
    if (mode === "train") {
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="4" y="3" width="16" height="16" rx="2" />
          <path d="M4 11h16" />
          <circle cx="8" cy="15" r="1" />
          <circle cx="16" cy="15" r="1" />
        </svg>
      );
    }
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 17h14M5 17l1-7h12l1 7M5 17v3M19 17v3M7 13h10" />
        <circle cx="7" cy="14.5" r="1" />
        <circle cx="17" cy="14.5" r="1" />
      </svg>
    );
  };
}

function renderCategoryMiniIcon(cat: ParcelCategory) {
  const props = {
    width: 11,
    height: 11,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (cat) {
    case "clothes":
      return (
        <svg {...props}>
          <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />
        </svg>
      );
    case "documents":
      return (
        <svg {...props}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      );
    case "books":
      return (
        <svg {...props}>
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
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
