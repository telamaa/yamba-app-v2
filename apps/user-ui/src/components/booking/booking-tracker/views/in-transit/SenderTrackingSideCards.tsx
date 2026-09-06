/**
 * SenderTrackingSideCards.tsx
 * ===========================
 * Sidebar de l'écran 6 :
 *  - SenderParcelCard : LE COLIS (photos VIOLETTES — déclarées par Aminata)
 *  - SenderPaymentCard : Débité · Bloqué jusqu'à livraison · Assurance
 *  - SenderCoverageCard : COUVERTURE (assurance souscrite)
 */

"use client";

import { ShieldCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { Booking } from "@/components/booking/booking-tracker/booking-tracker.types";
import PhotoThumbs from "@/components/shared/photos/PhotoThumbs";

export function SenderParcelCard({ booking }: { booking: Booking }) {
  const t = useTranslations("bookingTracker");
  const tBooking = useTranslations("booking");
  const locale = useLocale();

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {t("senderTracking.sidebar.parcelLabel")}
      </h3>
      <div className="text-[14px] font-semibold text-slate-900 dark:text-white">
        {t("senderTracking.sidebar.parcelSummary", {
          category: tBooking("categories." + booking.parcel.category),
          weight: formatNumber(booking.parcel.weightKg, locale),
          value: formatEur(booking.parcel.declaredValueEur, locale),
        })}
      </div>
      <p className="mt-1 text-[12px] leading-snug text-slate-600 dark:text-slate-400">
        {booking.parcel.description}
      </p>
      {booking.parcel.photos.length > 0 && (
        <>
          <PhotoThumbs photos={booking.parcel.photos} tone="violet" size="md" className="mt-3" />
          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            {t("senderTracking.sidebar.parcelPhotosNote")}
          </p>
        </>
      )}
    </section>
  );
}

export function SenderPaymentCard({ booking }: { booking: Booking }) {
  const t = useTranslations("bookingTracker");
  const locale = useLocale();

  const carrierFirstName = booking.carrier.firstName;
  const recipientFirstName = booking.recipient.firstName;
  const insuredAmount = booking.insurance === "EXTENDED_500" ? 500 : 100;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {t("senderTracking.sidebar.paymentLabel")}
      </h3>
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] text-slate-700 dark:text-slate-300">
          {t("senderTracking.sidebar.debitedLabel")}
        </span>
        <span className="text-[20px] font-black tabular-nums text-slate-900 dark:text-white">
          {formatEur(booking.payment.totalPaidEur, locale)}
        </span>
      </div>
      <div className="my-3 border-t border-slate-100 dark:border-slate-800" />
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-slate-600 dark:text-slate-400">
            {t("senderTracking.sidebar.stateLabel")}
          </span>
          <span className="font-semibold text-teal-700 dark:text-teal-400">
            {t("senderTracking.sidebar.stateBlocked")}
          </span>
        </div>
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-slate-600 dark:text-slate-400">
            {t("senderTracking.sidebar.insuranceLabel")}
          </span>
          <span className="font-semibold text-emerald-700 dark:text-emerald-400">
            {t("senderTracking.sidebar.insuranceValue", {
              amount: formatEur(insuredAmount, locale),
            })}
          </span>
        </div>
      </div>
      <p className="mt-3 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
        {t("senderTracking.sidebar.paymentNote", {
          carrierFirstName,
          recipientFirstName,
        })}
      </p>
    </section>
  );
}

export function SenderCoverageCard({ booking }: { booking: Booking }) {
  const t = useTranslations("bookingTracker");
  const locale = useLocale();

  const insuredAmount = booking.insurance === "EXTENDED_500" ? 500 : 100;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {t("senderTracking.sidebar.coverageLabel")}
      </h3>
      <div className="flex items-center gap-2 text-[13px] font-semibold text-emerald-700 dark:text-emerald-400">
        <ShieldCheck size={15} aria-hidden="true" />
        {t("senderTracking.sidebar.coverageTitle", {
          amount: formatEur(insuredAmount, locale),
        })}
      </div>
      <p className="mt-1.5 text-[12px] leading-snug text-slate-500 dark:text-slate-400">
        {t("senderTracking.sidebar.coverageNote")}
      </p>
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

function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 2,
  }).format(value);
}
