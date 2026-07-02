/**
 * BookingPickupPhotos.tsx
 * =======================
 * Card "Photos de la prise en charge par Thomas" — preuves du pickup.
 * Gradient AMBER (photos Voyageur), cohérent avec le langage visuel
 * établi (violet = déclaration Shipper / amber = pickup Carrier).
 */

"use client";

import { Check, ImageIcon, Package } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { Booking } from "@/components/booking/booking-tracker/booking-tracker.types";

type Props = {
  booking: Booking;
  compact?: boolean;
};

export default function BookingPickupPhotos({ booking, compact = false }: Props) {
  const t = useTranslations("bookingTracker");
  const locale = useLocale();

  const pickup = booking.pickup;
  if (!pickup || pickup.photos.length === 0) return null;

  const carrierFirstName = booking.carrier.firstName;
  const pickedUpDate = new Date(pickup.pickedUpAt);
  const dateStr = formatShortDate(pickedUpDate, locale);
  const timeStr = formatTime(pickedUpDate, locale);

  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 sm:rounded-2xl ${
        compact ? "p-4" : "p-4 sm:p-5"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex flex-shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white dark:bg-emerald-600 ${
            compact ? "h-8 w-8" : "h-9 w-9"
          }`}
          aria-hidden="true"
        >
          <Check size={compact ? 14 : 16} strokeWidth={3} />
        </div>
        <div className="min-w-0 flex-1">
          <h3
            className={`font-semibold text-slate-900 dark:text-white ${
              compact ? "text-[14px]" : "text-[14px] sm:text-[15px]"
            }`}
          >
            {compact
              ? t("pickedUp.pickupPhotos.titleShort")
              : t("pickedUp.pickupPhotos.title", { carrierFirstName })}
          </h3>
          <p
            className={`mt-0.5 text-slate-500 dark:text-slate-400 ${
              compact ? "text-[11px]" : "text-[12px]"
            }`}
          >
            {compact
              ? t("pickedUp.pickupPhotos.subtitleShort", {
                carrierFirstName,
                time: timeStr,
                location: pickup.locationName,
              })
              : t("pickedUp.pickupPhotos.subtitle", {
                date: dateStr,
                time: timeStr,
                location: pickup.locationName,
              })}
          </p>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        {pickup.photos.map((photo) => (
          <div
            key={photo.id}
            className={`relative flex flex-shrink-0 items-center justify-center rounded-lg text-white ${
              compact ? "h-14 w-14" : "h-16 w-16"
            }`}
            style={{ background: "linear-gradient(135deg, #BA7517, #EF9F27)" }}
            aria-label={photo.label}
          >
            {photo.context === "PICKUP_PACKAGED" ? (
              <Package size={compact ? 18 : 20} aria-hidden="true" />
            ) : (
              <ImageIcon size={compact ? 18 : 20} aria-hidden="true" />
            )}
            {photo.label && (
              <div className="absolute inset-x-1 bottom-1 rounded-sm bg-black/55 px-1 py-px text-center text-[8.5px] font-medium">
                {photo.label}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function formatShortDate(date: Date, locale: string): string {
  const day = date.getDate();
  const month = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
    month: "short",
  }).format(date);
  return locale === "fr" ? `${day} ${month}` : `${month} ${day}`;
}

function formatTime(date: Date, locale: string): string {
  const h = date.getHours();
  const m = date.getMinutes().toString().padStart(2, "0");
  return locale === "fr" ? `${h}h${m}` : `${h}:${m}`;
}
