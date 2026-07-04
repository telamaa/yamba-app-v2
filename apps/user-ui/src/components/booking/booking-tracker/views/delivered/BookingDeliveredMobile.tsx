/**
 * BookingDeliveredMobile.tsx
 * ==========================
 * Vue mobile DELIVERED : header sticky · banner flush · countdown · confirm ·
 * récap · tip · notation · paiement · signaler. Pas de bottom-bar (ton calme).
 */

"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Booking } from "@/components/booking/booking-tracker/booking-tracker.types";
import BookingAcceptedHeader from "../accepted/BookingAcceptedHeader";
import BookingTipList from "../../shared/BookingTipList";
import ConfirmAllGoodCard from "./ConfirmAllGoodCard";
import DeliveryRecapCard from "./DeliveryRecapCard";
import PayoutCountdownCard from "./PayoutCountdownCard";
import { DeliveredPaymentCard, RateCarrierPrompt, ReportIssuePrompt } from "./DeliveredSideCards";
import { useRouter } from "@/i18n/navigation";

type Props = {
  booking: Booking;
  isConfirmed: boolean;
  onCloseAction: () => void;
  onConfirmedAction: (confirmedAt: string) => void;
};

export default function BookingDeliveredMobile({
                                                 booking,
                                                 isConfirmed,
                                                 onCloseAction,
                                                 onConfirmedAction,
                                               }: Props) {
  const t = useTranslations("bookingTracker");

  const router = useRouter();

  const locale = useLocale();

  const carrierFirstName = booking.carrier.firstName;
  const recipientFirstName = booking.recipient.firstName;

  const deliveredAt = booking.delivery
    ? new Date(booking.delivery.deliveredAt)
    : null;
  const timeStr = deliveredAt ? formatTime(deliveredAt, locale) : "";
  const whenLabel = deliveredAt ? relativeDay(deliveredAt, t) : "";

  const tipItems = [
    t("delivered.howItWorks.confirmShort", { carrierFirstName }),
    t("delivered.howItWorks.nothingShort"),
    t("delivered.howItWorks.reportShort"),
  ];

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-slate-950">
      <BookingAcceptedHeader
        booking={booking}
        onBackAction={onCloseAction}
        variant="mobile"
      />

      {/* Banner flush */}
      <div className="flex items-center gap-3 border-y border-emerald-300 bg-emerald-50 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/30">
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white dark:bg-emerald-600">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-emerald-950 dark:text-emerald-100">
            {t("delivered.banner.title", { recipientFirstName })}
          </div>
          <div className="text-[11px] text-emerald-800 dark:text-emerald-300">
            {t("delivered.banner.subtitleShort", {
              when: whenLabel,
              time: timeStr,
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-3 px-4 pb-10 pt-4">
        <header>
          <h2 className="text-[19px] font-black tracking-tight text-slate-900 dark:text-white">
            {t("delivered.h1")}
          </h2>
          <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">
            {t("delivered.h1SubtitleShort")}
          </p>
        </header>

        {!isConfirmed && <PayoutCountdownCard booking={booking} compact />}

        <ConfirmAllGoodCard
          booking={booking}
          isConfirmed={isConfirmed}
          onConfirmedAction={onConfirmedAction}
          compact
        />

        <DeliveryRecapCard booking={booking} compact />

        <BookingTipList
          title={t("delivered.howItWorks.title")}
          items={tipItems}
        />

        <RateCarrierPrompt booking={booking} compact />

        <DeliveredPaymentCard booking={booking} isConfirmed={isConfirmed} />

        {!isConfirmed && (
          <ReportIssuePrompt
            booking={booking}
            onReportAction={() =>
              router.push("/bookings/" + booking.id + "/report")
            }
          />
        )}

      </div>
    </div>
  );
}

function formatTime(date: Date, locale: string): string {
  const h = date.getHours();
  const m = date.getMinutes().toString().padStart(2, "0");
  return locale === "fr" ? h + "h" + m : h + ":" + m;
}

function relativeDay(
  date: Date,
  t: ReturnType<typeof useTranslations<"bookingTracker">>
): string {
  const isToday = date.toDateString() === new Date().toDateString();
  const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  if (isToday) return t("delivered.when.today");
  if (isYesterday) return t("delivered.when.yesterday");
  return "";
}
