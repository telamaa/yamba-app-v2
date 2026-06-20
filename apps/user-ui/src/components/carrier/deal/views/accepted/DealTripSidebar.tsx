/**
 * DealTripSidebar.tsx
 * ===================
 * Card "Ton voyage" — sidebar desktop uniquement.
 * Affiche route + dates départ/arrivée.
 */

"use client";

import { Plane } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { DealRequest } from "@/components/carrier/deal/deal.types";

type Props = {
  deal: DealRequest;
};

export default function DealTripSidebar({ deal }: Props) {
  const t = useTranslations("carrierDealAccepted");
  const locale = useLocale();

  const departureDate = new Date(deal.trip.departureDate);
  const arrivalDate = deal.trip.durationHours
    ? new Date(departureDate.getTime() + deal.trip.durationHours * 60 * 60 * 1000)
    : null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {t("trip.title")}
      </h3>

      <div className="mb-3 flex items-center gap-2 text-[14px] font-semibold text-slate-900 dark:text-white">
        <Plane size={14} aria-hidden="true" />
        <span>
          {t("trip.route", {
            originCity: deal.trip.originCity,
            destinationCity: deal.trip.destinationCity,
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
