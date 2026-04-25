"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  Briefcase,
  ChevronRight,
  Cpu,
  FileText,
  Footprints,
  HelpCircle,
  Laptop,
  Package,
  Phone,
  Plane,
  Shirt,
  ShoppingBag,
  Star,
  ToyBrick,
  Train,
  Car,
  Zap,
  BadgeCheck,
  Award,
  Ticket,
} from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import {
  ParcelCategory,
  TransportMode,
  YambaTripResult,
} from "./search-results.types";
import {
  formatLocation,
  formatTripDate,
  formatTripTimes,
} from "./formatTripTimes";
import TripPricingPopover from "./TripPricingPopover";

type Props = {
  item: YambaTripResult;
  /** Max number of categories to show in icons (default: 3). The rest is shown as "+N". */
  maxVisibleCategories?: number;
  /** Catégories filtrées dans la sidebar (highlight orange dans le popover prix) */
  highlightedCategories?: ParcelCategory[];
};

function TransportIcon({ mode, size = 13 }: { mode: TransportMode; size?: number }) {
  if (mode === "plane") return <Plane size={size} strokeWidth={2} />;
  if (mode === "train") return <Train size={size} strokeWidth={2} />;
  return <Car size={size} strokeWidth={2} />;
}

function getCategoryMeta(
  category: ParcelCategory,
  t: (k: string) => string
): { label: string; icon: React.ReactNode } {
  const map: Record<ParcelCategory, { label: string; icon: React.ReactNode }> = {
    clothes: { label: t("clothes"), icon: <Shirt size={12} /> },
    shoes: { label: t("shoes"), icon: <Footprints size={12} /> },
    "fashion-accessories": {
      label: t("fashion-accessories"),
      icon: <ShoppingBag size={12} />,
    },
    "other-accessories": {
      label: t("other-accessories"),
      icon: <Package size={12} />,
    },
    books: { label: t("books"), icon: <BookOpen size={12} /> },
    documents: { label: t("documents"), icon: <FileText size={12} /> },
    "small-toys": { label: t("small-toys"), icon: <ToyBrick size={12} /> },
    phone: { label: t("phone"), icon: <Phone size={12} /> },
    computer: { label: t("computer"), icon: <Laptop size={12} /> },
    "other-electronics": {
      label: t("other-electronics"),
      icon: <Cpu size={12} />,
    },
    "checked-bag-23kg": {
      label: t("checked-bag-23kg"),
      icon: <Briefcase size={12} />,
    },
    "cabin-bag-12kg": {
      label: t("cabin-bag-12kg"),
      icon: <Briefcase size={12} />,
    },
  };

  return map[category] ?? { label: category, icon: <Package size={12} /> };
}

export default function TripResultCard({
                                         item,
                                         maxVisibleCategories = 3,
                                         highlightedCategories = [],
                                       }: Props) {
  const t = useTranslations("search");
  const tCategories = useTranslations("search.categories");
  const tTransport = useTranslations("search.transportTabs");
  const locale = useLocale();
  const localeTag = locale === "fr" ? "fr-FR" : "en-US";

  const [avatarError, setAvatarError] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const showAvatarImage = !!item.travelerAvatarUrl && !avatarError;

  // ⚠️ Ref vers le bouton "Starting from ?" pour positionner le popover
  // qui sera rendu via createPortal dans document.body (pour éviter d'être
  // clippé par le overflow:hidden de la card).
  const pricingTriggerRef = useRef<HTMLButtonElement>(null);

  const travelerInitials =
    `${item.travelerFirstName?.slice(0, 1).toUpperCase() ?? "Y"}${
      item.travelerLastName?.slice(0, 1).toUpperCase() ?? ""
    }`;

  const travelerDisplayName = item.travelerFirstName
    ? `${item.travelerFirstName}${
      item.travelerLastName
        ? ` ${item.travelerLastName.slice(0, 1).toUpperCase()}.`
        : ""
    }`
    : "—";

  const times = useMemo(
    () =>
      formatTripTimes({
        departureTime: item.departureTime,
        arrivalTime: item.arrivalTime,
        durationMinutes: item.durationMinutes,
      }),
    [item.departureTime, item.arrivalTime, item.durationMinutes]
  );

  const fromLocation = formatLocation(item.fromCityCode, item.fromCountry);
  const toLocation = formatLocation(item.toCityCode, item.toCountry);

  const formattedDate = useMemo(
    () => formatTripDate(item.travelDate, locale),
    [item.travelDate, locale]
  );

  const transportLabel =
    item.transportMode === "plane"
      ? tTransport("plane")
      : item.transportMode === "train"
        ? tTransport("train")
        : tTransport("car");

  const visibleCategories = item.allowedCategories.slice(0, maxVisibleCategories);
  const hiddenCount = Math.max(
    item.allowedCategories.length - maxVisibleCategories,
    0
  );

  const formattedPrice = item.minPrice
    .toLocaleString(localeTag, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    .replace(/\u00a0/g, "");

  const stopsLabel = useMemo(() => {
    if (item.stopovers === undefined || item.stopovers === null) return null;
    if (item.stopovers === 0) return t("direct");
    if (item.stopovers === 1 && item.stopoverCity) {
      return t("oneStopIn", { city: item.stopoverCity });
    }
    return t("stopsCount", { count: item.stopovers });
  }, [item.stopovers, item.stopoverCity, t]);

  const showLowCapacity =
    typeof item.remainingSlots === "number" &&
    item.remainingSlots > 0 &&
    item.remainingSlots < 3;

  const hasPricesByCategory =
    item.pricesByCategory && Object.keys(item.pricesByCategory).length > 0;

  return (
    <article className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all duration-200 hover:border-[#FF9900]/40 hover:shadow-[0_8px_24px_rgba(255,153,0,0.08)] dark:border-slate-800 dark:bg-slate-950 dark:hover:border-[#FF9900]/30">
      {/* ── Header: transport + date + capacité ── */}
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-2.5 dark:border-slate-800/60">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          <TransportIcon mode={item.transportMode} />
          {transportLabel}
        </span>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          {formattedDate}
        </span>

        <div className="flex-1" />

        {showLowCapacity && (
          <span className="inline-flex items-center gap-1 rounded-full border border-red-300/50 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600 dark:border-red-500/30 dark:bg-red-950/30 dark:text-red-400">
            <AlertCircle size={10} strokeWidth={2.5} />
            {t("remainingSlots", { count: item.remainingSlots! })}
          </span>
        )}
      </div>

      {/* ── Horaires + prix ── */}
      <div className="grid items-center gap-4 px-4 py-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:gap-5">
        {/* Départ */}
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold leading-tight text-slate-950 dark:text-white">
            {item.fromCity}
          </div>
          {times.departure && (
            <div className="mt-0.5 text-[13px] font-semibold tabular-nums text-slate-700 dark:text-slate-200">
              {times.departure}
            </div>
          )}
          {fromLocation && (
            <div className="mt-0.5 truncate text-[10px] text-slate-400 dark:text-slate-500">
              {fromLocation}
            </div>
          )}
        </div>

        {/* Route (durée + ligne + escales) */}
        <div className="flex flex-col items-center gap-1">
          {times.duration && (
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {times.duration}
            </div>
          )}
          <div className="relative flex w-full items-center gap-1.5">
            <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300 dark:bg-slate-600" />
            <div className="relative h-px flex-1 bg-slate-200 dark:bg-slate-800">
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white p-0.5 text-[#FF9900] dark:bg-slate-950">
                <TransportIcon mode={item.transportMode} size={12} />
              </div>
            </div>
            <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF9900]" />
          </div>
          {stopsLabel && (
            <div className="text-[10px] text-slate-400 dark:text-slate-500">
              {stopsLabel}
            </div>
          )}
        </div>

        {/* Arrivée */}
        <div className="min-w-0 text-right">
          <div className="truncate text-[15px] font-semibold leading-tight text-slate-950 dark:text-white">
            {item.toCity}
          </div>
          {times.arrival && (
            <div className="mt-0.5 inline-flex items-baseline gap-1">
              <span className="text-[13px] font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                {times.arrival}
              </span>
              {times.nextDay && (
                <sup className="inline-flex h-3.5 items-center rounded-[3px] bg-[#FF9900]/15 px-1 text-[9px] font-bold text-[#B45309] dark:text-[#FFB84D]">
                  +1
                </sup>
              )}
            </div>
          )}
          {toLocation && (
            <div className="mt-0.5 truncate text-[10px] text-slate-400 dark:text-slate-500">
              {toLocation}
            </div>
          )}
        </div>

        {/* Prix avec popover trigger sur "Starting from" */}
        <div className="whitespace-nowrap text-right">
          {hasPricesByCategory ? (
            <button
              ref={pricingTriggerRef}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPricingOpen((v) => !v);
              }}
              aria-label={t("card.viewPricesByCategory")}
              aria-expanded={pricingOpen}
              className={[
                "group/price inline-flex items-center gap-1 rounded-md px-1 py-0.5 -mx-1",
                "text-[10px] font-medium text-slate-400 dark:text-slate-500",
                "transition-colors",
                "hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800/60 dark:hover:text-slate-300",
                pricingOpen
                  ? "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300"
                  : "",
              ].join(" ")}
            >
              <span>{t("startingFrom")}</span>
              <HelpCircle size={11} strokeWidth={2} />
            </button>
          ) : (
            <div className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
              {t("startingFrom")}
            </div>
          )}

          <div className="text-[22px] font-black leading-none tracking-tight text-slate-950 dark:text-white">
            {formattedPrice} {item.currency ?? "€"}
          </div>

          {hasPricesByCategory && (
            <TripPricingPopover
              isOpen={pricingOpen}
              onCloseAction={() => setPricingOpen(false)}
              trip={item}
              triggerRef={pricingTriggerRef}
              highlightedCategories={highlightedCategories}
              align="bottom-right"
            />
          )}
        </div>
      </div>

      {/* ── Footer: tripper + catégories + chevron ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-4 py-2.5 dark:border-slate-800/60 dark:bg-slate-900/30">
        {/* Tripper info */}
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="relative h-8 w-8 shrink-0">
            {item.superTripper && (
              <>
                <span className="absolute inset-0 rounded-full bg-[repeating-conic-gradient(#FF9900_0deg_14deg,transparent_14deg_28deg)] opacity-90" />
                <span className="absolute inset-[2px] rounded-full bg-white dark:bg-slate-950" />
              </>
            )}
            <div
              className={[
                "absolute overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800",
                item.superTripper ? "inset-[3px]" : "inset-0",
                item.profileVerified || item.superTripper
                  ? "border-2 border-[#FF9900]"
                  : "border border-slate-300 dark:border-slate-700",
              ].join(" ")}
            >
              {showAvatarImage ? (
                <Image
                  src={item.travelerAvatarUrl!}
                  alt={item.travelerFirstName ?? "Traveler"}
                  fill
                  sizes="32px"
                  className="object-cover"
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <div className="grid h-full w-full place-items-center bg-slate-100 text-[9px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {travelerInitials}
                </div>
              )}
            </div>
            {item.profileVerified && !item.superTripper && (
              <div className="absolute -bottom-0.5 -right-0.5 z-10 grid h-4 w-4 place-items-center rounded-full border-2 border-white bg-[#FF9900] text-slate-950 dark:border-slate-900">
                <BadgeCheck size={9} strokeWidth={2.4} />
              </div>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px]">
              <span className="font-semibold text-slate-900 dark:text-white">
                {travelerDisplayName}
              </span>
              {typeof item.rating === "number" ? (
                <span className="inline-flex items-center gap-0.5 text-[11px]">
                  <Star
                    size={11}
                    className="fill-[#FFB84D] text-[#FFB84D]"
                    strokeWidth={0}
                  />
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {item.rating.toFixed(1).replace(".", ",")}
                  </span>
                  {typeof item.reviewCount === "number" && (
                    <span className="text-slate-400 dark:text-slate-500">
                      ({item.reviewCount})
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  {t("newTripper")}
                </span>
              )}
            </div>

            {(item.superTripper || item.instantBooking || item.verifiedTicket) && (
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {item.superTripper && (
                  <span className="inline-flex items-center gap-0.5 rounded-md bg-[#FFF6E8] px-1.5 py-0.5 text-[10px] font-semibold text-[#B45309] dark:bg-[#FF9900]/15 dark:text-[#FFB84D]">
                    <Award size={9} strokeWidth={2.5} />
                    {t("badges.superTripper")}
                  </span>
                )}
                {item.instantBooking && (
                  <span className="inline-flex items-center gap-0.5 rounded-md bg-green-50 px-1.5 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-950/40 dark:text-green-400">
                    <Zap size={9} strokeWidth={2.5} />
                    {t("badges.instant")}
                  </span>
                )}
                {item.verifiedTicket && (
                  <span className="inline-flex items-center gap-0.5 rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
                    <Ticket size={9} strokeWidth={2.5} />
                    {t("badges.verifiedTicket")}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Catégories + chevron */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1">
            {visibleCategories.map((category) => {
              const meta = getCategoryMeta(category, tCategories);
              return (
                <span
                  key={category}
                  title={meta.label}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                >
                  {meta.icon}
                </span>
              );
            })}
            {hiddenCount > 0 && (
              <span
                className="inline-flex h-6 items-center justify-center rounded-full bg-slate-100 px-2 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                title={t("moreCategoriesTooltip", { count: hiddenCount })}
              >
                +{hiddenCount}
              </span>
            )}
          </div>

          <ChevronRight
            size={16}
            className="shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 dark:text-slate-600"
          />
        </div>
      </div>
    </article>
  );
}
