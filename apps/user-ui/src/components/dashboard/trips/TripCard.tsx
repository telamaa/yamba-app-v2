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
import type { CarrierTripItem } from "./trips.types";
import {
  getTripConfirmedEarnings,
  getTripEngagedCount,
  getTripPendingCount,
} from "./trips.types";
import {
  formatDateShort,
  formatDayMonth,
  formatMoney,
  formatRelativePast,
  formatTimeShort,
  formatWeight,
} from "./trips.format";
import TripDealRow, { BADGE_BASE, BADGE_TONES } from "./TripDealRow";

type Props = {
  trip: CarrierTripItem;
  nowMs: number;
  defaultOpen?: boolean;
};

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
