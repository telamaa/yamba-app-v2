/**
 * TrackingBanner.tsx
 * ==================
 * Banner teal "En transit vers Brazzaville" + compte à rebours du vol
 * ("Vol dans 1h15") — plus utile que l'heure courante.
 */

"use client";

import { PlaneTakeoff } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { DealRequest } from "@/components/carrier/deal/deal.types";

type Props = {
  deal: DealRequest;
  variant?: "inset" | "flush";
};

export default function TrackingBanner({ deal, variant = "inset" }: Props) {
  const t = useTranslations("carrierDealTracking");
  const locale = useLocale();
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Re-render toutes les 60s pour le compte à rebours
  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const departureMs = new Date(deal.trip.departureDate).getTime();
  const diffMin = Math.round((departureMs - nowMs) / 60_000);
  const flightHour = formatHour(new Date(deal.trip.departureDate), locale);

  const pickedUpAgo = deal.pickup
    ? formatAgo(nowMs - new Date(deal.pickup.pickedUpAt).getTime(), locale)
    : "";

  const countdown =
    diffMin > 0
      ? t("banner.flightIn", { countdown: formatCountdown(diffMin, locale) })
      : t("banner.flightPast");

  const containerClass =
    variant === "flush"
      ? "flex items-center gap-3 border-y border-teal-300 bg-teal-50 px-4 py-3 dark:border-teal-900/50 dark:bg-teal-950/30"
      : "flex items-center gap-3 rounded-2xl border border-teal-200 bg-teal-50 px-5 py-4 dark:border-teal-900/40 dark:bg-teal-950/30";

  return (
    <div className={containerClass} role="status">
      <div
        className={`flex flex-shrink-0 items-center justify-center rounded-full bg-teal-700 text-white dark:bg-teal-600 ${
          variant === "flush" ? "h-7 w-7" : "h-9 w-9"
        }`}
      >
        <PlaneTakeoff size={variant === "flush" ? 14 : 18} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={`font-semibold text-teal-950 dark:text-teal-100 ${
            variant === "flush" ? "text-[13px]" : "text-[14px] sm:text-[15px]"
          }`}
        >
          {t("banner.title", { destinationCity: deal.trip.destinationCity })}
        </div>
        <div
          className={`text-teal-800 dark:text-teal-300 ${
            variant === "flush" ? "text-[11px]" : "mt-0.5 text-[12px] sm:text-[13px]"
          }`}
        >
          {variant === "flush"
            ? t("banner.subtitleShort", { flightHour })
            : t("banner.subtitle", { ago: pickedUpAgo, flightHour })}
        </div>
      </div>
      {diffMin > 0 && (
        <div
          className={`flex-shrink-0 rounded-full bg-teal-700 px-3 py-1 font-bold text-white dark:bg-teal-600 ${
            variant === "flush" ? "text-[11px]" : "text-[12px]"
          }`}
        >
          {countdown}
        </div>
      )}
    </div>
  );
}

function formatHour(date: Date, locale: string): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const mm = m > 0 ? m.toString().padStart(2, "0") : "00";
  return locale === "fr" ? `${h}h${mm}` : `${h}:${mm}`;
}

function formatCountdown(totalMin: number, locale: string): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return locale === "fr" ? `${m} min` : `${m} min`;
  return locale === "fr" ? `${h}h${m.toString().padStart(2, "0")}` : `${h}h ${m}m`;
}

function formatAgo(diffMs: number, locale: string): string {
  const min = Math.max(1, Math.round(diffMs / 60_000));
  if (min < 60) return locale === "fr" ? `${min} min` : `${min} min`;
  const h = Math.round(min / 60);
  return locale === "fr" ? `${h}h` : `${h}h`;
}
