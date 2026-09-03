/**
 * BookingInTransitMobile.tsx
 * ==========================
 * Écran 6 mobile : header sticky · banner flush · code compact ·
 * timeline · communication · recap (colis/débité/assurance/paiement) ·
 * signaler. Pas de bottom-bar (lecture, rien d'urgent).
 */

"use client";

import DisputeInTransitLink from "../../shared/DisputeInTransitLink";

import { useLocale, useTranslations } from "next-intl";
import type { Booking } from "@/components/booking/booking-tracker/booking-tracker.types";
import BookingAcceptedHeader from "../accepted/BookingAcceptedHeader";
import {
  SenderCarrierContact,
  SenderRecipientContact,
} from "./SenderCommunicationCards";
import SenderCodeCard from "./SenderCodeCard";
import SenderTrackingBanner from "./SenderTrackingBanner";
import SenderTrackingTimeline from "./SenderTrackingTimeline";

type Props = {
  booking: Booking;
  onCloseAction: () => void;
  onCodeRegeneratedAction: (newCode: string, regeneratedCount: number) => void;
};

export default function BookingInTransitMobile({
                                                 booking,
                                                 onCloseAction,
                                                 onCodeRegeneratedAction,
                                               }: Props) {
  const t = useTranslations("bookingTracker");
  const tBooking = useTranslations("booking");
  const locale = useLocale();

  const insuredAmount = booking.insurance === "EXTENDED_500" ? 500 : 100;

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-slate-950">
      <BookingAcceptedHeader
        booking={booking}
        onBackAction={onCloseAction}
        variant="mobile"
      />

      <SenderTrackingBanner booking={booking} variant="flush" />

      <div className="flex-1 space-y-3 px-4 pb-10 pt-4">
        <SenderCodeCard
          booking={booking}
          onCodeRegeneratedAction={onCodeRegeneratedAction}
          compact
        />

        <SenderTrackingTimeline booking={booking} compact />

        <h3 className="pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {t("senderTracking.communication.label")}
        </h3>
        <SenderCarrierContact booking={booking} />
        <SenderRecipientContact booking={booking} />

        {/* Recap compact */}
        <section className="rounded-xl bg-slate-100 p-4 dark:bg-slate-900">
          <div className="space-y-1.5 text-[12px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400">
                {t("senderTracking.sidebar.parcelLabel")}
              </span>
              <span className="font-medium text-slate-900 dark:text-white">
                {tBooking("categories." + booking.parcel.category)} ·{" "}
                {formatNumber(booking.parcel.weightKg, locale)} kg
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400">
                {t("senderTracking.sidebar.debitedLabel")}
              </span>
              <span className="font-medium text-slate-900 dark:text-white">
                {formatEur(booking.payment.totalPaidEur, locale)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400">
                {t("senderTracking.sidebar.insuranceLabel")}
              </span>
              <span className="font-medium text-emerald-700 dark:text-emerald-400">
                {t("senderTracking.sidebar.insuranceValue", {
                  amount: formatEur(insuredAmount, locale),
                })}
              </span>
            </div>
          </div>
        </section>

        {/* B4-PR2 (A72) : « non livré » — actif 48 h après le départ, sinon désactivé avec la date servie. */}
        <DisputeInTransitLink booking={booking} align="center" />
      </div>
    </div>
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
