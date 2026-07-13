"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  Check,
  ChevronRight,
  Eye,
  Plane,
  PlaneLanding,
} from "lucide-react";
import type {
  CarrierDealItem,
  CarrierDealStatus,
  CarrierTripItem,
} from "./trips.types";
import {
  getTripConfirmedEarnings,
  getTripEngagedCount,
  getTripPendingCount,
} from "./trips.types";
import {
  categoryLabel,
  formatDateShort,
  formatDayMonth,
  formatMoney,
  formatRelativePast,
  formatRemaining,
  formatTimeShort,
  formatWeight,
  type Translator,
} from "./trips.format";

type Props = {
  trip: CarrierTripItem;
  nowMs: number;
  defaultOpen?: boolean;
};

/* ── Badges deal (mapping statique) ─────────────────────────────── */

const BADGE_BASE =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium ";

const BADGE_TONES = {
  slate: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  teal: "bg-teal-50 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  amber: "bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  emerald:
    "bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  red: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",
} as const;

type DealBadge = { label: string; tone: keyof typeof BADGE_TONES; pulse: boolean };

function buildDealBadge(
  deal: CarrierDealItem,
  t: Translator
): DealBadge {
  switch (deal.status) {
    case "PENDING":
      return { label: t("deal.badgePending"), tone: "amber", pulse: true };
    case "ACCEPTED":
      return { label: t("deal.badgeAccepted"), tone: "teal", pulse: false };
    case "PICKED_UP":
      if (deal.lastTrackingStep === "FLIGHT_ARRIVED") {
        return { label: t("deal.badgeReady"), tone: "emerald", pulse: true };
      }
      return { label: t("deal.badgeInTransit"), tone: "teal", pulse: false };
    case "DELIVERED":
      return { label: t("deal.badgeDelivered"), tone: "emerald", pulse: false };
    case "COMPLETED":
      return { label: t("deal.badgeCompleted"), tone: "emerald", pulse: false };
    case "DISPUTED":
      return { label: t("deal.badgeDisputed"), tone: "red", pulse: false };
    case "DECLINED":
    case "EXPIRED":
    case "CANCELLED":
      return { label: t("trip.statusCancelled"), tone: "slate", pulse: false };
  }
}

function buildDealSub(
  deal: CarrierDealItem,
  t: Translator,
  locale: string,
  nowMs: number
): string {
  switch (deal.status) {
    case "PENDING":
      return t("deal.pendingSub", {
        remaining: deal.expiresAt
          ? formatRemaining(deal.expiresAt, nowMs, locale) ?? "—"
          : "—",
      });
    case "ACCEPTED":
      return t("deal.acceptedSub", {
        when: deal.pickupMeetingAt
          ? formatTimeShort(locale, deal.pickupMeetingAt)
          : "",
        location: deal.pickupLocationName ?? "",
      });
    case "PICKED_UP":
      if (deal.lastTrackingStep === "FLIGHT_ARRIVED") {
        return t("deal.readySub", {
          recipientFirstName: deal.recipientFirstName ?? "",
        });
      }
      return t("deal.pickedUpSub");
    case "DELIVERED":
      return t("deal.deliveredSub");
    case "COMPLETED":
      return deal.hasRated
        ? t("deal.completedRatedSub", {
          recipientFirstName: deal.recipientFirstName ?? "",
          earnings: formatMoney(locale, deal.netEarningsEur),
        })
        : t("deal.completedUnratedSub", {
          recipientFirstName: deal.recipientFirstName ?? "",
          firstName: deal.shipper.firstName,
        });
    default:
      return "";
  }
}

const ENGAGED_STATUSES: CarrierDealStatus[] = [
  "ACCEPTED",
  "PICKED_UP",
  "DELIVERED",
  "COMPLETED",
];

/* ── Sous-composant : deal row (Link, pas de CTA imbriqué) ──────── */

function TripDealRow({
                       deal,
                       nowMs,
                     }: {
  deal: CarrierDealItem;
  nowMs: number;
}) {
  const t = useTranslations("myTrips");
  const locale = useLocale();

  const badge = buildDealBadge(deal, t);
  const sub = buildDealSub(deal, t, locale, nowMs);

  const line = deal.recipientFirstName
    ? t("deal.lineWithRecipient", {
      firstName: deal.shipper.firstName,
      lastInitial: deal.shipper.lastInitial,
      category: categoryLabel(t, deal.category),
      weight: formatWeight(locale, deal.weightKg),
      recipientFirstName: deal.recipientFirstName,
    })
    : t("deal.line", {
      firstName: deal.shipper.firstName,
      lastInitial: deal.shipper.lastInitial,
      category: categoryLabel(t, deal.category),
      weight: formatWeight(locale, deal.weightKg),
    });

  const isEngaged = ENGAGED_STATUSES.includes(deal.status);
  const moneyClass =
    "flex-none text-[13px] font-medium " +
    (isEngaged
      ? "text-emerald-700 dark:text-emerald-300"
      : "text-slate-400 dark:text-slate-500");
  const moneyLabel =
    (isEngaged ? "" : "+ ") + formatMoney(locale, deal.netEarningsEur);

  const initials =
    deal.shipper.firstName.charAt(0) + deal.shipper.lastInitial.charAt(0);

  return (
    <Link
      href={"/carrier/deals/" + deal.id}
      className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:hover:bg-slate-100 dark:hover:bg-slate-800/60"
    >
      <div className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-teal-700 text-[11px] font-bold text-white">
        {initials.toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-slate-900 dark:text-white">
          {line}
        </div>
        <div className="mt-0.5 truncate text-[11.5px] text-slate-500 dark:text-slate-400">
          {sub}
        </div>
      </div>
      <span className={BADGE_BASE + BADGE_TONES[badge.tone]}>
        {badge.pulse && (
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
        )}
        {badge.label}
      </span>
      <span className={moneyClass}>{moneyLabel}</span>
    </Link>
  );
}

/* ── Composant principal ────────────────────────────────────────── */

export default function TripCard({ trip, nowMs, defaultOpen = false }: Props) {
  const t = useTranslations("myTrips");
  const locale = useLocale();
  const [open, setOpen] = useState(defaultOpen);

  const isArrived = trip.status === "ARRIVED";
  const engagedCount = getTripEngagedCount(trip);
  const pendingCount = getTripPendingCount(trip);
  const earnings = getTripConfirmedEarnings(trip);
  const toDeliverCount = trip.deals.filter(
    (d) => d.status === "PICKED_UP" && d.lastTrackingStep === "FLIGHT_ARRIVED"
  ).length;

  const statusBadge = isArrived
    ? { label: t("trip.statusArrived"), tone: "emerald" as const }
    : trip.status === "DEPARTED"
      ? { label: t("trip.statusDeparted"), tone: "teal" as const }
      : { label: t("trip.statusPublished"), tone: "teal" as const };

  const TripIcon = isArrived || trip.status === "DEPARTED" ? PlaneLanding : Plane;

  const flight = trip.isDirect
    ? t("trip.flightDirect", { hours: trip.durationHours ?? 0 })
    : t("trip.flightStops", { stops: trip.stopsCount ?? 1 });

  const meta = isArrived
    ? t("trip.metaArrived", {
      date: formatDayMonth(locale, trip.departureAt),
      time: trip.arrivedAt ? formatTimeShort(locale, trip.arrivedAt) : "",
      toDeliver: toDeliverCount,
    })
    : t("trip.metaUpcoming", {
      date: formatDateShort(locale, trip.departureAt),
      flight,
      remaining: formatWeight(locale, trip.remainingKg),
      capacity: formatWeight(locale, trip.capacityKg),
    });

  const iconWrapperClass =
    "grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl " +
    (isArrived
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300"
      : "bg-teal-50 text-teal-700 dark:bg-teal-900/25 dark:text-teal-300");

  return (
    <div className="mb-3 overflow-hidden rounded-xl bg-white dark:bg-slate-950">
      {/* Header dépliable */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3.5 px-4 py-4 text-left transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/60"
      >
        <div className={iconWrapperClass}>
          <TripIcon size={19} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[14px] font-medium text-slate-900 dark:text-white">
            <span className="truncate">
              {trip.originCity}
              {trip.originDetail ? " (" + trip.originDetail + ")" : ""}
              <span className="mx-1 font-normal text-slate-400">→</span>
              {trip.destinationCity}
              {trip.destinationDetail
                ? " (" + trip.destinationDetail + ")"
                : ""}
            </span>
            <span className={BADGE_BASE + BADGE_TONES[statusBadge.tone]}>
              {statusBadge.label}
            </span>
          </div>
          <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
            {meta}
          </div>
        </div>

        {/* KPIs */}
        <div className="hidden flex-shrink-0 items-center gap-5 sm:flex">
          <div className="text-right">
            <div className="text-[14px] font-medium text-slate-900 dark:text-white">
              {engagedCount}
              {pendingCount > 0 && (
                <span className="ml-1 text-amber-600 dark:text-amber-400">
                  +{pendingCount}
                </span>
              )}
            </div>
            <div className="mt-0.5 text-[10.5px] text-slate-400 dark:text-slate-500">
              {pendingCount > 0
                ? t("trip.kpiDealsRequest")
                : isArrived
                  ? t("trip.kpiDealActive")
                  : t("trip.kpiDeals")}
            </div>
          </div>
          <div className="text-right">
            <div
              className={
                "text-[14px] font-medium " +
                (earnings > 0
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-slate-400 dark:text-slate-500")
              }
            >
              {earnings > 0 ? formatMoney(locale, earnings) : "—"}
            </div>
            <div className="mt-0.5 text-[10.5px] text-slate-400 dark:text-slate-500">
              {isArrived
                ? t("trip.kpiEarningsUpcoming")
                : earnings > 0
                  ? t("trip.kpiEarningsConfirmed")
                  : t("trip.kpiEarnings")}
            </div>
          </div>
        </div>

        <ChevronRight
          size={16}
          className={
            "flex-shrink-0 text-slate-300 transition-transform dark:text-slate-600 " +
            (open ? "rotate-90" : "")
          }
        />
      </button>

      {/* Deals imbriqués */}
      {open && (
        <div className="border-t border-slate-100 px-2 py-1.5 dark:border-slate-900">
          {trip.deals.length === 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-3 text-[12.5px] text-slate-400 dark:text-slate-500">
              <span>{t("trip.emptyDeals", { views: trip.viewsCount })}</span>
              <button
                type="button"
                onClick={() =>
                  console.info("[myTrips] share trip mock:", trip.id)
                }
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-white"
              >
                {t("trip.shareTrip")}
              </button>
            </div>
          ) : (
            trip.deals.map((deal) => (
              <TripDealRow key={deal.id} deal={deal} nowMs={nowMs} />
            ))
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-2.5 dark:border-slate-900">
        <span className="flex items-center gap-1.5 text-[11.5px] text-slate-400 dark:text-slate-500">
          <Eye size={13} />
          {t("trip.views", { count: trip.viewsCount })} ·{" "}
          {t("trip.publishedAgo", {
            when: formatRelativePast(locale, trip.publishedAt, nowMs),
          })}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => console.info("[myTrips] share trip mock:", trip.id)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-white"
          >
            {t("trip.share")}
          </button>
          <button
            type="button"
            onClick={() => console.info("[myTrips] edit trip mock:", trip.id)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-white"
          >
            {t("trip.edit")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Row historique compacte (trajets COMPLETED/CANCELLED) ──────── */

export function TripHistoryRow({
                                 trip,
                                 nowMs,
                               }: {
  trip: CarrierTripItem;
  nowMs: number;
}) {
  void nowMs;
  const t = useTranslations("myTrips");
  const locale = useLocale();

  const deliveredCount = trip.deals.filter(
    (d) => d.status === "COMPLETED" || d.status === "DELIVERED"
  ).length;
  const earnings = getTripConfirmedEarnings(trip);

  return (
    <Link
      href={"/dashboard/trips"}
      onClick={(e) => {
        e.preventDefault();
        console.info("[myTrips] trip recap mock:", trip.id);
      }}
      className="mb-1.5 flex items-center gap-3 rounded-lg bg-white px-4 py-3 opacity-70 transition-opacity hover:opacity-100 dark:bg-slate-950"
    >
      <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500">
        <Check size={15} strokeWidth={3} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-slate-900 dark:text-white">
          {t("historyRow.title", {
            origin: trip.originCity,
            destination: trip.destinationCity,
            date: formatDayMonth(locale, trip.departureAt),
          })}
        </div>
        <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
          {t("historyRow.sub", {
            delivered: deliveredCount,
            earnings: formatMoney(locale, earnings),
          })}
        </div>
      </div>
      <span className={BADGE_BASE + BADGE_TONES.emerald}>
        {t("trip.statusCompleted")}
      </span>
    </Link>
  );
}
