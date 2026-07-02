/**
 * BookingTripSidebar.tsx
 * ======================
 * Card "Ton trajet" — sidebar desktop uniquement.
 * Affiche route + dates départ/arrivée + assurance souscrite.
 *
 * Contrairement à DealTripSidebar (Voyageur), inclut l'info assurance
 * (importante côté Sender pour la rassurer sur la couverture).
 */

"use client";

import { Plane } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { Booking } from "@/components/booking/booking-tracker/booking-tracker.types";

type Props = {
  booking: Booking;
};

export default function BookingTripSidebar({ booking }: Props) {
  const t = useTranslations("bookingTracker");
  const locale = useLocale();

  const departureDate = new Date(booking.trip.departureDate);
  const arrivalDate = booking.trip.durationHours
    ? new Date(
      departureDate.getTime() + booking.trip.durationHours * 60 * 60 * 1000
    )
    : null;

  const isExtendedInsurance = booking.insurance === "EXTENDED_500";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {t("trip.title")}
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
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-slate-600 dark:text-slate-400">
            {t("trip.departureLabel")}
          </span>
          <span className="font-medium text-slate-900 dark:text-white">
            {formatDateTime(departureDate, locale)}
          </span>
        </div>
        {arrivalDate && (
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-slate-600 dark:text-slate-400">
              {t("trip.arrivalLabel")}
            </span>
            <span className="font-medium text-slate-900 dark:text-white">
              {formatDateTime(arrivalDate, locale)}
            </span>
          </div>
        )}
        {isExtendedInsurance && (
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-slate-600 dark:text-slate-400">
              Assurance
            </span>
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
              {t("payment.insuranceCovered", { amount: "500" })}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

function formatDateTime(date: Date, locale: string): string {
  const day = date.getDate();
  const month = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
    month: "short",
  }).format(date);
  const hour = date.getHours();
  const dateStr = locale === "fr" ? `${day} ${month}` : `${month} ${day}`;
  return locale === "fr" ? `${dateStr} · ${hour}h` : `${dateStr} · ${hour}:00`;
}
