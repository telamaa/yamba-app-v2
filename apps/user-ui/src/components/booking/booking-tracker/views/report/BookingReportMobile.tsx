/**
 * BookingReportMobile.tsx
 * =======================
 * Mobile : header sticky · banner flush · formulaire empilé · CTA en bas
 * du flux (pas de bottom-bar fixe : formulaire long, la confirmation
 * inline doit rester près du pledge).
 */

"use client";

import { ArrowLeft, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { BookingReportViewProps } from "./BookingReportClient";
import {
  ReportCtaBar,
  ReportEmpathyBanner,
  ReportFormBody,
} from "./ReportFormBlocks";

export default function BookingReportMobile(props: BookingReportViewProps) {
  const t = useTranslations("bookingTracker");
  const { booking } = props;

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-slate-950">
      {/* Header sticky */}
      <div className="sticky top-0 z-10 flex h-14 items-center gap-1 border-b border-slate-200 bg-white px-2 dark:border-slate-800 dark:bg-slate-950">
        <button
          type="button"
          onClick={props.onBackAction}
          aria-label={t("report.back")}
          className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-[15px] font-semibold text-slate-900 dark:text-white">
            {t("report.title")}
          </div>
          <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
            {t("report.subtitleShort", {
              originCity: booking.trip.originCity,
              destinationCity: booking.trip.destinationCity,
            })}
          </div>
        </div>
        <button
          type="button"
          onClick={props.onBackAction}
          aria-label={t("report.back")}
          className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <X size={19} />
        </button>
      </div>

      <ReportEmpathyBanner
        carrierFirstName={booking.carrier.firstName}
        variant="flush"
      />

      <div className="flex-1 space-y-3 px-4 pb-10 pt-4">
        <header>
          <h2 className="text-[19px] font-black tracking-tight text-slate-900 dark:text-white">
            {t("report.h1Short")}
          </h2>
          <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">
            {t("report.h1SubtitleShort")}
          </p>
        </header>

        <ReportFormBody {...props} compact />

        <ReportCtaBar {...props} variant="mobile" />
      </div>
    </div>
  );
}
