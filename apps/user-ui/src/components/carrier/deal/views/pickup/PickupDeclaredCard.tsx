/**
 * PickupDeclaredCard.tsx
 * ======================
 * Card "Ce qu'Aminata a déclaré" — la RÉFÉRENCE de comparaison.
 * Sans numéro (consultation, pas action).
 *  - Desktop : sidebar sticky (toujours visible pendant la vérification)
 *  - Mobile : card en tête de page
 * Style label uppercase, cohérent avec TON PAIEMENT / TON TRAJET.
 */

"use client";

import { Eye } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { DealRequest } from "@/components/carrier/deal/deal.types";
import PhotoThumbs from "@/components/shared/photos/PhotoThumbs";

type Props = {
  deal: DealRequest;
  compact?: boolean;
};

export default function PickupDeclaredCard({ deal, compact = false }: Props) {
  const t = useTranslations("carrierDealPickup");
  const tBooking = useTranslations("booking");
  const locale = useLocale();

  const shipperFirstName = deal.shipper.firstName;

  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 sm:rounded-2xl ${
        compact ? "p-4" : "p-5"
      }`}
    >
      <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 sm:text-[11px]">
        {t("declared.cardLabel", { shipperFirstName })}
      </h3>

      <div className="mb-3 grid grid-cols-3 gap-3">
        <Field
          label={t("declared.categoryLabel")}
          value={tBooking(`categories.${deal.parcel.category}`)}
        />
        <Field
          label={t("declared.weightLabel")}
          value={`${formatNumber(deal.parcel.weightKg, locale)} ${t("declared.kg")}`}
        />
        <Field
          label={t("declared.valueLabel")}
          value={formatEur(deal.parcel.declaredValueEur, locale)}
        />
      </div>

      <div className="border-t border-slate-100 pt-3 text-[12.5px] leading-relaxed text-slate-700 dark:border-slate-800 dark:text-slate-300">
        {deal.parcel.description}
      </div>

      {deal.parcel.photos.length > 0 && (
        <PhotoThumbs photos={deal.parcel.photos} tone="violet" size="lg" className="mt-3" />
      )}

      {!compact && (
        <div className="mt-3.5 flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2.5 text-[11.5px] leading-snug text-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
          <Eye size={13} className="mt-px flex-shrink-0" aria-hidden="true" />
          <span>{t("declared.compareHint")}</span>
        </div>
      )}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-0.5 text-[13px] font-semibold text-slate-900 dark:text-white">
        {value}
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

function formatEur(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
  }).format(amount);
}
