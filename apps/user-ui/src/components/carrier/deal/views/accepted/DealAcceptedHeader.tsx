/**
 * DealAcceptedHeader.tsx
 * ======================
 * Header avec back + titre + sous-titre (route + date).
 *  - Mobile : strip iOS-like 56px (h-14), back en tap target 44pt
 *  - Desktop : zone avec back discret + H1 "Mon Deal accepté" + sous-titre
 */

"use client";

import { ArrowLeft } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { DealRequest } from "@/components/carrier/deal/deal.types";

type Props = {
  deal: DealRequest;
  onBackAction: () => void;
  variant: "desktop" | "mobile";
};

export default function DealAcceptedHeader({
                                             deal,
                                             onBackAction,
                                             variant,
                                           }: Props) {
  const t = useTranslations("carrierDealAccepted");
  const locale = useLocale();

  const dateStr = formatShortDate(deal.trip.departureDate, locale);
  const subtitle = t("subtitle", {
    originCity: deal.trip.originCity,
    destinationCity: deal.trip.destinationCity,
    date: dateStr,
  });

  if (variant === "mobile") {
    return (
      <div className="sticky top-0 z-10 flex h-14 items-center gap-1 border-b border-slate-200 bg-white px-2 dark:border-slate-800 dark:bg-slate-950">
        <button
          type="button"
          onClick={onBackAction}
          aria-label={t("back")}
          className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-slate-700 transition-colors hover:bg-slate-100 active:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 dark:active:bg-slate-700"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0 flex-1 pr-11 text-center">
          <div className="truncate text-[15px] font-semibold text-slate-900 dark:text-white">
            {t("title")}
          </div>
          <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
            {subtitle}
          </div>
        </div>
      </div>
    );
  }

  // Desktop
  return (
    <div>
      <button
        type="button"
        onClick={onBackAction}
        className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
      >
        <ArrowLeft size={14} />
        {t("back")}
      </button>
      <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
        {t("title")}
      </h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {subtitle}
      </p>
    </div>
  );
}

function formatShortDate(iso: string, locale: string): string {
  const date = new Date(iso);
  const day = date.getDate();
  const month = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
    month: "short",
  }).format(date);
  return locale === "fr" ? `${day} ${month}` : `${month} ${day}`;
}
