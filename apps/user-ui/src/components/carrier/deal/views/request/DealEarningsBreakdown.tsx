/**
 * DealEarningsBreakdown.tsx
 * =========================
 * Bloc earnings : hero "TU GAGNES 89,30 €" + note de versement.
 *
 * A13 : la vue Carrier réelle n'expose NI le prix payé par l'Expéditeur,
 * NI la commission, NI les frais Stripe (CarrierPricing = gains seulement).
 * L'ancien « détail » venait du mock et violait cette frontière — retiré.
 *
 * Variant "mobile" : version compacte (le hero pleine largeur est déjà
 * affiché en haut de page via DealEarningsHero).
 */

"use client";

import { useLocale, useTranslations } from "next-intl";
import type { DealEarningsBreakdown as Earnings } from "@/components/carrier/deal/deal.types";

type Props = {
  earnings: Earnings;
  variant?: "sidebar" | "mobile";
};

export default function DealEarningsBreakdown({
                                                earnings,
                                                variant = "sidebar",
                                              }: Props) {
  const t = useTranslations("carrierDealRequest");
  const locale = useLocale();

  if (variant === "mobile") {
    return (
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {t("earnings.detailTitle")}
        </div>
        <div className="mt-2.5 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-semibold text-slate-900 dark:text-white">
              {t("earnings.net")}
            </span>
            <span className="text-[18px] font-black tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatEur(earnings.netForCarrier, locale)}
            </span>
          </div>
          <div className="mt-1.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
            {t("earnings.payoutNote", { days: earnings.payoutDelayDays })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30">
      <div className="px-5 pt-5 pb-4">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
          {t("earnings.hero")}
        </div>
        <div className="mt-1.5 flex items-baseline gap-0.5">
          <span className="text-[32px] font-black leading-none tabular-nums text-emerald-700 dark:text-emerald-300">
            {formatAmountNoUnit(earnings.netForCarrier, locale)}
          </span>
          <span className="text-[16px] font-bold text-emerald-700 dark:text-emerald-300">
            {t("earnings.currency")}
          </span>
        </div>
        <div className="mt-1.5 text-[11px] leading-snug text-emerald-700/80 dark:text-emerald-400/80">
          {t("earnings.payoutNote", { days: earnings.payoutDelayDays })}
        </div>
      </div>
    </div>
  );
}

function formatEur(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

function formatAmountNoUnit(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
