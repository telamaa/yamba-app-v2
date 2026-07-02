/**
 * BookingAcceptedRecap.tsx
 * ========================
 * Récap "Récap de l'envoi" avec 3 rows :
 *  1. Ton colis (catégorie + photos miniatures)
 *  2. Lieu de remise (pickup)
 *  3. Destinataire
 *
 * Photos en gradient violet (= déclaration Shipper), différenciées des
 * photos de pickup Carrier (gradient amber, futures PRs).
 */

"use client";

import { Home, ImageIcon, MapPin, Package } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { Booking } from "@/components/booking/booking-tracker/booking-tracker.types";

type Props = {
  booking: Booking;
  compact?: boolean;
};

export default function BookingAcceptedRecap({ booking, compact = false }: Props) {
  const t = useTranslations("bookingTracker");
  const tBooking = useTranslations("booking");
  const locale = useLocale();

  const carrierFirstName = booking.carrier.firstName;
  const recipient = booking.recipient;

  const departureDate = new Date(booking.trip.departureDate);
  const dateStr = formatShortDate(departureDate, locale);
  const hour = departureDate.getHours();

  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 sm:rounded-2xl ${
        compact ? "px-4 py-3.5" : "px-4 py-4 sm:px-5 sm:py-4"
      }`}
    >
      <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 sm:text-[11px]">
        {compact ? t("recap.titleShort") : t("recap.title")}
      </h3>

      <RecapRow
        icon={<Package size={14} aria-hidden="true" />}
        label={t("recap.parcelLabel")}
        value={t("recap.parcelSummary", {
          category: tBooking(`categories.${booking.parcel.category}`),
          weight: formatNumber(booking.parcel.weightKg, locale),
          value: formatNumber(booking.parcel.declaredValueEur, locale),
        })}
        sub={booking.parcel.description}
        extra={
          booking.parcel.photos.length > 0 ? (
            <div className="mt-2 flex gap-1.5">
              {booking.parcel.photos.slice(0, 3).map((photo, i) => (
                <div
                  key={photo.id}
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md text-white shadow-sm sm:h-12 sm:w-12"
                  style={{
                    background: "linear-gradient(135deg, #534AB7, #7F77DD)",
                  }}
                  aria-label={photo.label || `Photo ${i + 1}`}
                >
                  {photo.context === "DECLARED_PACKAGED" ? (
                    <Package size={16} />
                  ) : (
                    <ImageIcon size={16} />
                  )}
                </div>
              ))}
            </div>
          ) : null
        }
      />

      <RecapRow
        icon={<MapPin size={14} aria-hidden="true" />}
        label={compact ? t("recap.pickupLabelShort") : t("recap.pickupLabel")}
        value={booking.pickupLocation.name}
        sub={
          compact
            ? t("recap.pickupSubShort", { date: dateStr, hour })
            : t("recap.pickupSub", { carrierFirstName, date: dateStr, hour })
        }
      />

      <RecapRow
        icon={<Home size={14} aria-hidden="true" />}
        label={t("recap.recipientLabel")}
        value={`${recipient.firstName} ${recipient.lastName}${
          compact ? "" : " · " + recipient.city
        }`}
        sub={
          compact
            ? t("recap.recipientSubShort", { city: recipient.city })
            : t("recap.recipientSub")
        }
        isLast
      />
    </section>
  );
}

function RecapRow({
                    icon,
                    label,
                    value,
                    sub,
                    extra,
                    isLast = false,
                  }: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  extra?: ReactNode;
  isLast?: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-3 py-2.5 sm:py-3 ${
        isLast ? "" : "border-b border-slate-100 dark:border-slate-800"
      }`}
    >
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 sm:text-[11px]">
          {label}
        </div>
        <div className="mt-0.5 text-[14px] font-semibold text-slate-900 dark:text-white sm:text-[15px]">
          {value}
        </div>
        {sub && (
          <div className="mt-0.5 text-[12px] leading-snug text-slate-500 dark:text-slate-400 sm:text-[13px]">
            {sub}
          </div>
        )}
        {extra}
      </div>
    </div>
  );
}

function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatShortDate(date: Date, locale: string): string {
  const day = date.getDate();
  const month = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
    month: "short",
  }).format(date);
  return locale === "fr" ? `${day} ${month}` : `${month} ${day}`;
}
