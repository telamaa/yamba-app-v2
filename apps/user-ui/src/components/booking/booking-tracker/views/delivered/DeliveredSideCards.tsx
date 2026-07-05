/**
 * DeliveredSideCards.tsx
 * ======================
 * - DeliveredPaymentCard : TON PAIEMENT avec état Bloqué jusqu'à J+4 / Libéré
 * - RateCarrierPrompt : encart amber "Pense à noter Thomas" → /rate
 * - ReportIssuePrompt : encart sobre "Quelque chose ne va pas ?" → /report
 */

"use client";

import { AlertTriangle, Star } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { Booking } from "@/components/booking/booking-tracker/booking-tracker.types";

export function DeliveredPaymentCard({
                                       booking,
                                       isConfirmed,
                                     }: {
  booking: Booking;
  isConfirmed: boolean;
}) {
  const t = useTranslations("bookingTracker");
  const locale = useLocale();

  const carrierFirstName = booking.carrier.firstName;
  const { payment } = booking;
  const paymentMode = t("payment.modeFormat", {
    brand: payment.cardBrand,
    last4: payment.cardLast4,
  });

  const stateClass = isConfirmed
    ? "font-semibold text-emerald-700 dark:text-emerald-400"
    : "font-semibold text-teal-700 dark:text-teal-400";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {t("payment.title")}
      </h3>

      <div className="flex items-baseline justify-between">
        <span className="text-[13px] text-slate-700 dark:text-slate-300">
          {t("payment.debitedLabel")}
        </span>
        <span className="text-[20px] font-black tabular-nums text-slate-900 dark:text-white">
          {formatEur(payment.totalPaidEur, locale)}
        </span>
      </div>

      <div className="my-3 border-t border-slate-100 dark:border-slate-800" />

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-slate-600 dark:text-slate-400">
            {t("payment.modeLabel")}
          </span>
          <span className="font-medium text-slate-900 dark:text-white">
            {paymentMode}
          </span>
        </div>
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-slate-600 dark:text-slate-400">
            {t("delivered.payment.stateLabel")}
          </span>
          <span className={stateClass}>
            {isConfirmed
              ? t("delivered.payment.stateReleased")
              : t("delivered.payment.stateBlocked")}
          </span>
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
        {isConfirmed
          ? t("delivered.payment.noteReleased", { carrierFirstName })
          : t("delivered.payment.note", { carrierFirstName })}
      </p>
    </section>
  );
}

export function RateCarrierPrompt({
                                    booking,
                                    compact = false,
                                  }: {
  booking: Booking;
  compact?: boolean;
}) {
  const t = useTranslations("bookingTracker");
  const router = useRouter();
  const carrierFirstName = booking.carrier.firstName;

  const handleRate = () => {
    router.push("/bookings/" + booking.id + "/rate");
  };

  const padding = compact ? "p-4" : "p-4 sm:p-5";

  return (
    <section
      className={
        "rounded-2xl border border-amber-200 bg-amber-50 text-center dark:border-amber-900/40 dark:bg-amber-950/25 " +
        padding
      }
    >
      <h3 className="text-[13.5px] font-bold text-amber-950 dark:text-amber-100">
        {t("delivered.rate.title", { carrierFirstName })}
      </h3>
      <p className="mx-auto mt-1 max-w-xs text-[11.5px] leading-snug text-amber-800 dark:text-amber-300">
        {compact ? t("delivered.rate.textShort") : t("delivered.rate.text")}
      </p>
      <button
        type="button"
        onClick={handleRate}
        className="mt-3 inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-white px-4 text-[12.5px] font-semibold text-amber-900 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-100 dark:hover:bg-amber-900/40"
      >
        <Star size={13} aria-hidden="true" />
        {t("delivered.rate.button")}
      </button>
    </section>
  );
}

export function ReportIssuePrompt({
                                    booking,
                                    onReportAction,
                                  }: {
  booking: Booking;
  onReportAction: () => void;
}) {
  const t = useTranslations("bookingTracker");

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <h3 className="text-[13.5px] font-bold text-slate-900 dark:text-white">
        {t("delivered.reportCard.title")}
      </h3>
      <p className="mx-auto mt-1 max-w-xs text-[11.5px] leading-snug text-slate-500 dark:text-slate-400">
        {t("delivered.reportCard.text")}
      </p>
      <button
        type="button"
        onClick={onReportAction}
        className="mt-3 inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 text-[12.5px] font-semibold text-slate-700 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-red-800 dark:hover:bg-red-950/30 dark:hover:text-red-300"
      >
        <AlertTriangle size={13} aria-hidden="true" />
        {t("delivered.reportCard.button")}
      </button>
    </section>
  );
}

function formatEur(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}
