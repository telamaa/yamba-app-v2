/**
 * BookingDisputedMobile.tsx — « Signalement en cours » (DISPUTED), mobile (B4-PR2, A74)
 */
"use client";

import { useTranslations } from "next-intl";
import type { Booking } from "@/components/booking/booking-tracker/booking-tracker.types";
import BookingAcceptedHeader from "../accepted/BookingAcceptedHeader";
import BookingCarrierCard from "../accepted/BookingCarrierCard";
import { DisputeFileCard, DisputeProcessCard, DisputeSupportCard, DisputedBanner, DisputedPaymentCard } from "./DisputedCards";

type Props = {
  booking: Booking;
  onCloseAction: () => void;
};

export default function BookingDisputedMobile({ booking, onCloseAction }: Props) {
  const t = useTranslations("bookingTracker.disputed");
  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-slate-950">
      <BookingAcceptedHeader booking={booking} onBackAction={onCloseAction} variant="mobile" />
      <DisputedBanner booking={booking} compact />
      <div className="flex-1 space-y-3 px-4 pb-10 pt-4">
        <header>
          <h2 className="text-[19px] font-black tracking-tight text-slate-900 dark:text-white">{t("h1")}</h2>
          <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">{t("h1SubtitleShort")}</p>
        </header>
        <DisputeFileCard booking={booking} compact />
        <DisputeProcessCard booking={booking} compact />
        <DisputedPaymentCard booking={booking} compact />
        <DisputeSupportCard booking={booking} compact />
        <BookingCarrierCard booking={booking} compact />
        <button
          type="button"
          onClick={onCloseAction}
          className="inline-flex min-h-[46px] w-full items-center justify-center rounded-xl bg-[#FF9900] px-4 text-[14px] font-bold text-slate-950 hover:bg-[#F08700]"
        >
          {t("backToShipments")}
        </button>
      </div>
    </div>
  );
}
