/**
 * DealAcceptedRecap.tsx
 * =====================
 * Bloc unifié "Détails du Deal" — 4 rows compactes avec icônes :
 *  1. Expéditeur (avatar + nom + rating)
 *  2. Contenu déclaré (catégorie + photos miniatures)
 *  3. Pickup (lieu choisi par l'expéditeur)
 *  4. Livraison (destinataire + ville + note téléphone)
 *
 * Source de vérité : DealRequest. S'adapte automatiquement aux breakpoints.
 */

"use client";

import { Home, ImageIcon, MapPin, Package, User } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { DealRequest } from "@/components/carrier/deal/deal.types";

type Props = {
  deal: DealRequest;
};

export default function DealAcceptedRecap({ deal }: Props) {
  const t = useTranslations("carrierDealAccepted");
  const tBooking = useTranslations("booking");
  const locale = useLocale();

  const shipperFirstName = deal.shipper.firstName;
  // Stats absentes de l'API réelle (BookingCounterpart) — masquées alors.
  const ratingFormatted = deal.shipper.rating?.toFixed(1);
  const shipmentCount = deal.shipper.shipmentCount;
  const isVerified = deal.shipper.isVerified;
  const hasShipperSub = ratingFormatted != null || shipmentCount != null || isVerified;

  return (
    <section className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 dark:border-slate-800 dark:bg-slate-950 sm:rounded-2xl sm:px-5 sm:py-4">
      <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 sm:text-[11px]">
        {t("recap.title")}
      </h3>

      <RecapRow
        icon={<User size={14} aria-hidden="true" />}
        label={t("recap.shipperLabel")}
        value={`${deal.shipper.firstName} ${deal.shipper.lastInitial}.`}
        sub={
          hasShipperSub ? (
            <span>
              {ratingFormatted != null && `⭐ ${ratingFormatted}`}
              {ratingFormatted != null && shipmentCount != null && " · "}
              {shipmentCount != null &&
                (shipmentCount === 1 ? `${shipmentCount} envoi` : `${shipmentCount} envois`)}
              {isVerified && " · Vérifiée"}
            </span>
          ) : undefined
        }
      />

      <RecapRow
        icon={<Package size={14} aria-hidden="true" />}
        label={t("recap.parcelLabel")}
        value={t("recap.parcelSummary", {
          category: tBooking(`categories.${deal.parcel.category}`),
          weight: formatNumber(deal.parcel.weightKg, locale),
          value: formatNumber(deal.parcel.declaredValueEur, locale),
        })}
        sub={deal.parcel.description}
        extra={
          deal.parcel.photos.length > 0 ? (
            <div className="mt-2 flex gap-1.5">
              {deal.parcel.photos.slice(0, 3).map((photo, i) => (
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
        label={t("recap.pickupLabel", { shipperFirstName })}
        value={deal.pickupLocation.name}
        sub={deal.pickupLocation.detail || deal.pickupLocation.flexibilityNote}
      />

      <RecapRow
        icon={<Home size={14} aria-hidden="true" />}
        label={t("recap.deliveryLabel")}
        value={`${deal.deliveryLocation.name} · ${deal.deliveryLocation.city}`}
        sub={t("recap.deliveryRecipientNote")}
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
