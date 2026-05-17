/**
 * DealParcelDetails.tsx
 * =====================
 * "DÉTAILS DU COLIS" — catégorie, poids, valeur, description.
 * Layout : 3 colonnes pour catégorie/poids/valeur, puis description en bas.
 */

"use client";

import { useLocale, useTranslations } from "next-intl";
import type { ParcelCategory } from "./deal-request.types";

type Props = {
  category: ParcelCategory;
  weightKg: number;
  declaredValueEur: number;
  description: string;
};

export default function DealParcelDetails({
                                            category,
                                            weightKg,
                                            declaredValueEur,
                                            description,
                                          }: Props) {
  const t = useTranslations("carrierDealRequest");
  const tBooking = useTranslations("booking"); // pour réutiliser categories.*
  const locale = useLocale();

  return (
    <section>
      <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {t("parcelDetails.title")}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="grid grid-cols-3 gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
          <Field
            label={t("parcelDetails.categoryLabel")}
            value={tBooking(`categories.${category}`)}
          />
          <Field
            label={t("parcelDetails.weightDeclared")}
            value={`${formatWeight(weightKg, locale)} ${t("parcelDetails.kg")}`}
          />
          <Field
            label={t("parcelDetails.valueDeclared")}
            value={formatEur(declaredValueEur, locale)}
          />
        </div>

        <div className="pt-3">
          <div className="mb-1 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t("parcelDetails.descriptionLabel")}
          </div>
          <p className="text-[13px] leading-relaxed text-slate-700 dark:text-slate-300 md:text-[14px]">
            {description}
          </p>
        </div>
      </div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 md:text-[11px]">
        {label}
      </div>
      <div className="mt-0.5 text-[14px] font-semibold text-slate-900 dark:text-white md:text-[15px]">
        {value}
      </div>
    </div>
  );
}

function formatWeight(kg: number, locale: string): string {
  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    minimumFractionDigits: kg % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 2,
  }).format(kg);
}

function formatEur(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
  }).format(amount);
}
