/**
 * DealEarningsBreakdown.tsx
 * =========================
 * Bloc earnings de la sidebar desktop, intégrant :
 *  - Hero "TU GAGNES 89,30 €"
 *  - Note de versement
 *  - Breakdown détaillé (prix payé, commission, frais Stripe)
 *
 * Variant "mobile" : juste le breakdown (le hero est déjà affiché en haut
 * de page via DealEarningsHero).
 */

"use client";

import { useLocale, useTranslations } from "next-intl";
import type { DealEarningsBreakdown as Earnings } from "./deal-request.types";

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
          <Row label={t("earnings.totalPaid")} amount={earnings.totalPaidByShipper} locale={locale} />
          <Row label={t("earnings.yambaCommission")} amount={-earnings.yambaCommission} locale={locale} />
          <Row label={t("earnings.stripeFees")} amount={-earnings.stripeFees} locale={locale} />
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
            <span className="text-[14px] font-semibold text-slate-900 dark:text-white">
              {t("earnings.net")}
            </span>
            <span className="text-[18px] font-black tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatEur(earnings.netForCarrier, locale)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // sidebar variant — bloc compact, hero intégré
  return (
    <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30">
      {/* Hero */}
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

      {/* Breakdown */}
      <div className="border-t border-emerald-200/60 bg-white/70 px-5 py-4 dark:border-emerald-900/30 dark:bg-slate-950/50">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {t("earnings.breakdownTitle")}
        </div>
        <Row label={t("earnings.totalPaid")} amount={earnings.totalPaidByShipper} locale={locale} />
        <Row label={t("earnings.yambaCommission")} amount={-earnings.yambaCommission} locale={locale} />
        <Row label={t("earnings.stripeFees")} amount={-earnings.stripeFees} locale={locale} />
      </div>
    </div>
  );
}

function Row({
               label,
               amount,
               locale,
             }: {
  label: string;
  amount: number;
  locale: string;
}) {
  const sign = amount < 0 ? "− " : "";
  const formatted = formatEur(Math.abs(amount), locale);
  return (
    <div className="flex items-center justify-between py-1 text-[12px] text-slate-600 dark:text-slate-400">
      <span>{label}</span>
      <span className="tabular-nums">{`${sign}${formatted}`}</span>
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
