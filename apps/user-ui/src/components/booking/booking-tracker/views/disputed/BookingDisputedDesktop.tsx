/**
 * BookingDisputedDesktop.tsx — « Signalement en cours » (DISPUTED), desktop (B4-PR2, A74)
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

export default function BookingDisputedDesktop({ booking, onCloseAction }: Props) {
  const t = useTranslations("bookingTracker.disputed");
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-4 sm:px-6 sm:pt-6">
        <BookingAcceptedHeader booking={booking} onBackAction={onCloseAction} variant="desktop" />
        <DisputedBanner booking={booking} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            <header>
              <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white sm:text-2xl">{t("h1")}</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("h1Subtitle")}</p>
            </header>
            <DisputeFileCard booking={booking} />
            <DisputeProcessCard booking={booking} />
            <button
              type="button"
              onClick={onCloseAction}
              className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[#FF9900] px-6 py-2.5 text-[13px] font-bold text-slate-950 hover:bg-[#F08700]"
            >
              {t("backToShipments")}
            </button>
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-[88px] space-y-4">
              <DisputedPaymentCard booking={booking} />
              <DisputeSupportCard booking={booking} />
              <BookingCarrierCard booking={booking} compact />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
