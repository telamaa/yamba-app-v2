/**
 * BookingPickedUpBanner.tsx
 * =========================
 * Banner emerald "Thomas a pris ton colis en charge · confirmé à 12h14".
 */

"use client";

import { PackageCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { Booking } from "@/components/booking/booking-tracker/booking-tracker.types";

type Props = {
  booking: Booking;
  variant?: "inset" | "flush";
};

export default function BookingPickedUpBanner({
                                                booking,
                                                variant = "inset",
                                              }: Props) {
  const t = useTranslations("bookingTracker");
  const locale = useLocale();

  const carrierFirstName = booking.carrier.firstName;
  const time = booking.pickup
    ? formatTime(new Date(booking.pickup.pickedUpAt), locale)
    : "";

  const containerClass =
    variant === "flush"
      ? "flex items-center gap-3 border-y border-emerald-300 bg-emerald-50 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/30"
      : "flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 dark:border-emerald-900/40 dark:bg-emerald-950/30";

  return (
    <div className={containerClass} role="status">
      <div
        className={`flex flex-shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white dark:bg-emerald-600 ${
          variant === "flush" ? "h-7 w-7" : "h-9 w-9"
        }`}
      >
        <PackageCheck size={variant === "flush" ? 14 : 18} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={`font-semibold text-emerald-950 dark:text-emerald-100 ${
            variant === "flush" ? "text-[13px]" : "text-[14px] sm:text-[15px]"
          }`}
        >
          {t("pickedUp.banner.title", { carrierFirstName })}
        </div>
        <div
          className={`text-emerald-800 dark:text-emerald-300 ${
            variant === "flush"
              ? "text-[11px]"
              : "mt-0.5 text-[12px] sm:text-[13px]"
          }`}
        >
          {variant === "flush"
            ? t("pickedUp.banner.subtitleShort", { time })
            : t("pickedUp.banner.subtitle", { time })}
        </div>
      </div>
    </div>
  );
}

function formatTime(date: Date, locale: string): string {
  const h = date.getHours();
  const m = date.getMinutes().toString().padStart(2, "0");
  return locale === "fr" ? `${h}h${m}` : `${h}:${m}`;
}
