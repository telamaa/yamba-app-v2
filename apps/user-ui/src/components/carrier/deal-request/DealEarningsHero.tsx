/**
 * DealEarningsHero.tsx
 * ====================
 * Bandeau "Tu gagnes 89,30 €" compact pour le MOBILE uniquement.
 * Le desktop utilise DealEarningsBreakdown qui intègre le hero + le détail
 * directement dans la sidebar sticky.
 */

"use client";

import { useLocale, useTranslations } from "next-intl";

type Props = {
  netForCarrier: number;
  payoutDelayDays: number;
};

export default function DealEarningsHero({
                                           netForCarrier,
                                           payoutDelayDays,
                                         }: Props) {
  const t = useTranslations("carrierDealRequest");
  const locale = useLocale();

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 dark:border-emerald-900/40 dark:bg-emerald-950/30">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            {t("earnings.hero")}
          </div>
          <div className="mt-0.5 text-[11px] leading-snug text-emerald-700/80 dark:text-emerald-400/80">
            {t("earnings.heroNoteShort", { days: payoutDelayDays })}
          </div>
        </div>
        <div className="flex items-baseline gap-0.5">
          <span className="text-[26px] font-black leading-none tabular-nums text-emerald-700 dark:text-emerald-300">
            {formatAmount(netForCarrier, locale)}
          </span>
          <span className="text-[14px] font-bold text-emerald-700 dark:text-emerald-300">
            {t("earnings.currency")}
          </span>
        </div>
      </div>
    </div>
  );
}

function formatAmount(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
