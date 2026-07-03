/**
 * DeliveryRecapCard.tsx
 * =====================
 * "RÉCAP DE LA LIVRAISON" — 3 rows :
 *  1. Colis livré (catégorie + poids + description)
 *  2. Remis à Marie (ville + quand + "Code validé par Thomas")
 *  3. Photos de traçabilité : 2 groupes (pickup amber / livraison = badge ✓)
 */

"use client";

import { Camera, Check, ImageIcon, Package, User } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { Booking } from "@/components/booking/booking-tracker/booking-tracker.types";

type Props = {
  booking: Booking;
  compact?: boolean;
};

export default function DeliveryRecapCard({ booking, compact = false }: Props) {
  const t = useTranslations("bookingTracker");
  const tBooking = useTranslations("booking");
  const locale = useLocale();

  const carrierFirstName = booking.carrier.firstName;
  const recipient = booking.recipient;
  const recipientFullName = recipient.firstName + " " + recipient.lastName;

  const deliveredAt = booking.delivery
    ? new Date(booking.delivery.deliveredAt)
    : null;
  const whenStr = deliveredAt ? formatWhen(deliveredAt, locale, t) : "";

  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 sm:rounded-2xl ${
        compact ? "p-4" : "p-4 sm:p-5"
      }`}
    >
      <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 sm:text-[11px]">
        {compact ? t("delivered.recap.labelShort") : t("delivered.recap.label")}
      </h3>

      {/* Row 1 — Colis livré */}
      <div className="flex items-start gap-3 border-b border-slate-100 py-2.5 first:pt-0 dark:border-slate-800">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
          <Package size={14} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 sm:text-[11px]">
            {t("delivered.recap.parcelLabel")}
          </div>
          <div className="mt-0.5 text-[14px] font-semibold text-slate-900 dark:text-white">
            {tBooking("categories." + booking.parcel.category)} ·{" "}
            {formatNumber(booking.parcel.weightKg, locale)} kg
          </div>
          <div className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
            {booking.parcel.description}
          </div>
        </div>
      </div>

      {/* Row 2 — Remis à Marie */}
      <div className="flex items-start gap-3 border-b border-slate-100 py-2.5 dark:border-slate-800">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
          <User size={14} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 sm:text-[11px]">
            {t("delivered.recap.recipientLabel", {
              name: recipientFullName.toUpperCase(),
            })}
          </div>
          <div className="mt-0.5 text-[14px] font-semibold text-slate-900 dark:text-white">
            {recipient.city}
            {whenStr ? " · " + whenStr : ""}
          </div>
          <div className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
            {compact
              ? t("delivered.recap.recipientSubShort", { carrierFirstName })
              : t("delivered.recap.recipientSub", { carrierFirstName })}
          </div>
        </div>
      </div>

      {/* Row 3 — Photos de traçabilité */}
      <div className="flex items-start gap-3 pt-2.5">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
          <Camera size={14} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 sm:text-[11px]">
            {compact
              ? t("delivered.recap.photosLabelShort")
              : t("delivered.recap.photosLabel")}
          </div>
          <div className={`mt-2 flex ${compact ? "gap-4" : "gap-5"}`}>
            {/* Groupe pickup */}
            {booking.pickup && booking.pickup.photos.length > 0 && (
              <div>
                <div className="mb-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  {compact
                    ? t("delivered.recap.photosPickupShort", {
                      location: booking.pickup.locationName,
                    })
                    : t("delivered.recap.photosPickup", {
                      location: booking.pickup.locationName,
                    })}
                </div>
                <div className="flex gap-1.5">
                  {booking.pickup.photos.map((photo) => (
                    <div
                      key={photo.id}
                      className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-white"
                      style={{
                        background: "linear-gradient(135deg, #BA7517, #EF9F27)",
                      }}
                      aria-label={photo.label}
                    >
                      {photo.context === "PICKUP_PACKAGED" ? (
                        <Package size={15} aria-hidden="true" />
                      ) : (
                        <ImageIcon size={15} aria-hidden="true" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Groupe livraison : badge code validé */}
            <div>
              <div className="mb-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                {compact
                  ? t("delivered.recap.photosDeliveryShort")
                  : t("delivered.recap.photosDelivery", {
                    city: recipient.city,
                  })}
              </div>
              <div
                className="flex h-11 w-11 items-center justify-center rounded-lg text-white"
                style={{ background: "linear-gradient(135deg, #BA7517, #EF9F27)" }}
                aria-label={t("delivered.recap.codeValidatedBadge")}
                title={t("delivered.recap.codeValidatedBadge")}
              >
                <Check size={18} strokeWidth={3} aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
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
  const dateStr = locale === "fr" ? day + " " + month : month + " " + day;
  return dateStr + " " + t("delivered.when.at") + " " + time;
}

function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 2,
  }).format(value);
}
