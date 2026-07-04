/**
 * BookingDeliveredDesktop.tsx
 * ===========================
 * Vue desktop DELIVERED : période de vérification J+1→J+4.
 * Ton CALME — page d'attente, pas d'urgence.
 * Header + banner emerald + countdown + confirm card + récap + tip ·
 * sidebar : paiement (état) + Voyageur + prompt notation.
 */

"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Booking } from "@/components/booking/booking-tracker/booking-tracker.types";
import BookingAcceptedHeader from "../accepted/BookingAcceptedHeader";
import BookingCarrierCard from "../accepted/BookingCarrierCard";
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

export default function BookingDeliveredDesktop({
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
  const whenStr = deliveredAt ? formatWhen(deliveredAt, locale, t) : "";

  const tipItems = [
    t("delivered.howItWorks.confirm", { carrierFirstName }),
    t("delivered.howItWorks.nothing"),
    t("delivered.howItWorks.report"),
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-4 sm:px-6 sm:pt-6">
        <BookingAcceptedHeader
          booking={booking}
          onBackAction={onCloseAction}
          variant="desktop"
        />

        {/* Banner emerald livré */}
        <div className="my-5 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 dark:border-emerald-900/40 dark:bg-emerald-950/30">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white dark:bg-emerald-600">
            <CheckIcon />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold text-emerald-950 dark:text-emerald-100 sm:text-[15px]">
              {t("delivered.banner.title", { recipientFirstName })}
            </div>
            <div className="mt-0.5 text-[12px] text-emerald-800 dark:text-emerald-300 sm:text-[13px]">
              {t("delivered.banner.subtitle", {
                when: whenStr,
                carrierFirstName,
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Main */}
          <div className="space-y-5">
            <header>
              <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                {t("delivered.h1")}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {t("delivered.h1Subtitle", { carrierFirstName })}
              </p>
            </header>

            {!isConfirmed && <PayoutCountdownCard booking={booking} />}

            <ConfirmAllGoodCard
              booking={booking}
              isConfirmed={isConfirmed}
              onConfirmedAction={onConfirmedAction}
            />

            <DeliveryRecapCard booking={booking} />

            <BookingTipList
              title={t("delivered.howItWorks.title")}
              items={tipItems}
            />

            {/*{!isConfirmed && (*/}
            {/*  <button*/}
            {/*    type="button"*/}
            {/*    onClick={() => router.push("/bookings/" + booking.id + "/report")}*/}
            {/*    className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-500 transition-colors hover:text-red-700 dark:text-slate-400 dark:hover:text-red-400"*/}
            {/*  >*/}
            {/*    <AlertTriangle size={13} aria-hidden="true" />*/}
            {/*    {t("delivered.report")}*/}
            {/*  </button>*/}
            {/*)}*/}
          </div>

          {/* Sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-[88px] space-y-4">
              <DeliveredPaymentCard booking={booking} isConfirmed={isConfirmed} />
              <BookingCarrierCard booking={booking} compact />
              <RateCarrierPrompt booking={booking} />


              {!isConfirmed && (
                <ReportIssuePrompt
                  booking={booking}
                  onReportAction={() =>
                    router.push("/bookings/" + booking.id + "/report")
                  }
                />
              )}

            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      width="18"
      height="18"
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
  );
}

function formatWhen(
  date: Date,
  locale: string,
  t: ReturnType<typeof useTranslations<"bookingTracker">>
): string {
  const isToday = date.toDateString() === new Date().toDateString();
  const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  const h = date.getHours();
  const m = date.getMinutes().toString().padStart(2, "0");
  const time = locale === "fr" ? h + "h" + m : h + ":" + m;

  if (isToday) return t("delivered.when.today") + " " + t("delivered.when.at") + " " + time;
  if (isYesterday)
    return t("delivered.when.yesterday") + " " + t("delivered.when.at") + " " + time;
  const day = date.getDate();
  const month = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
    month: "short",
  }).format(date);
  return (locale === "fr" ? day + " " + month : month + " " + day) + " " + t("delivered.when.at") + " " + time;
}
