/**
 * BookingTrackingSidebar.tsx
 * ==========================
 * Card "SUIVI DU COLIS" : pris en charge ✓ · vol · arrivée · livraison estimée.
 * Sidebar desktop + inline mobile.
 */

"use client";

import { Check, Plane } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { Booking } from "@/components/booking/booking-tracker/booking-tracker.types";

type Props = {
  booking: Booking;
};

export default function BookingTrackingSidebar({ booking }: Props) {
  const t = useTranslations("bookingTracker");
  const locale = useLocale();

  const departureDate = new Date(booking.trip.departureDate);
  const arrivalDate = booking.trip.durationHours
    ? new Date(departureDate.getTime() + booking.trip.durationHours * 3600 * 1000)
    : null;
  const pickedUpAt = booking.pickup ? new Date(booking.pickup.pickedUpAt) : null;

  // Livraison estimée : le soir de l'arrivée si même jour, sinon la date d'arrivée
  const isArrivalToday =
    arrivalDate && arrivalDate.toDateString() === new Date().toDateString();

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {t("pickedUp.tracking.label")}
      </h3>

      <div className="mb-3 flex items-center gap-2 text-[14px] font-semibold text-slate-900 dark:text-white">
        <Plane size={14} aria-hidden="true" />
        <span>
          {t("trip.route", {
            originCity: booking.trip.originCity,
            destinationCity: booking.trip.destinationCity,
          })}
        </span>
      </div>

      <div className="space-y-1.5">
        {pickedUpAt && (
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-slate-600 dark:text-slate-400">
              {t("pickedUp.tracking.pickedUpLabel")}
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
              {formatTime(pickedUpAt, locale)}
              <Check size={12} strokeWidth={3} aria-hidden="true" />
            </span>
          </div>
        )}
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-slate-600 dark:text-slate-400">
            {t("pickedUp.tracking.departureLabel")}
          </span>
          <span className="font-medium text-slate-900 dark:text-white">
            {formatDateTime(departureDate, locale)}
          </span>
        </div>
        {arrivalDate && (
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-slate-600 dark:text-slate-400">
              {t("pickedUp.tracking.arrivalLabel")}
            </span>
            <span className="font-medium text-slate-900 dark:text-white">
              {formatDateTime(arrivalDate, locale)}
            </span>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between rounded-xl bg-blue-50 px-3.5 py-2.5 dark:bg-blue-950/30">
        <span className="text-[12px] font-semibold text-blue-900 dark:text-blue-200">
          {t("pickedUp.tracking.estimatedLabel")}
        </span>
        <span className="text-[13px] font-bold text-blue-900 dark:text-blue-100">
          {isArrivalToday
            ? t("pickedUp.tracking.estimatedTonight")
            : arrivalDate
              ? t("pickedUp.tracking.estimatedDate", {
                date: formatShortDate(arrivalDate, locale),
              })
              : "—"}
        </span>
      </div>
    </section>
  );
}

function formatTime(date: Date, locale: string): string {
  const h = date.getHours();
  const m = date.getMinutes().toString().padStart(2, "0");
  return locale === "fr" ? `${h}h${m}` : `${h}:${m}`;
}

function formatShortDate(date: Date, locale: string): string {
  const day = date.getDate();
  const month = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
    month: "short",
  }).format(date);
  return locale === "fr" ? `${day} ${month}` : `${month} ${day}`;
}

function formatDateTime(date: Date, locale: string): string {
  const day = date.getDate();
  const month = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
    month: "short",
  }).format(date);
  const h = date.getHours();
  return locale === "fr" ? `${day} ${month} · ${h}h` : `${month} ${day} · ${h}:00`;
}
