/**
 * DealPaymentBlock.tsx
 * ====================
 * Bloc paiement Voyageur — Net + délai de versement.
 *
 * Variants :
 *  - sidebar (desktop) : card complète avec note explicative
 *  - inline (mobile) : bande compacte 2 rows (Net / Versé à J+4 Stripe)
 */

"use client";

import { useLocale, useTranslations } from "next-intl";

type Props = {
  netForCarrier: number;
  payoutDelayDays: number;
  variant: "sidebar" | "inline";
};

export default function DealPaymentBlock({
                                           netForCarrier,
                                           payoutDelayDays,
                                           variant,
                                         }: Props) {
  const t = useTranslations("carrierDealAccepted");
  const locale = useLocale();

  if (variant === "inline") {
    return (
      <section className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-slate-700 dark:text-slate-300">
            {t("payment.netLabel")}
          </span>
          <span className="text-[18px] font-black tabular-nums text-emerald-700 dark:text-emerald-400">
            {formatEur(netForCarrier, locale)}
          </span>
        </div>
        <div className="mt-2.5 border-t border-slate-200 pt-2.5 dark:border-slate-700">
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-slate-600 dark:text-slate-400">
              {t("payment.payoutAtLabel")}
            </span>
            <span className="font-medium text-slate-900 dark:text-white">
              {t("payment.inlineFormat", { days: payoutDelayDays })}
            </span>
          </div>
        </div>
      </section>
    );
  }

  // Sidebar
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {t("payment.title")}
      </h3>

      <div className="flex items-baseline justify-between">
        <span className="text-[13px] text-slate-700 dark:text-slate-300">
          {t("payment.netLabel")}
        </span>
        <span className="text-[20px] font-black tabular-nums text-emerald-700 dark:text-emerald-400">
          {formatEur(netForCarrier, locale)}
        </span>
      </div>

      <div className="my-3 border-t border-slate-100 dark:border-slate-800" />

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-slate-600 dark:text-slate-400">
            {t("payment.payoutAtLabel")}
          </span>
          <span className="font-medium text-slate-900 dark:text-white">
            {t("payment.payoutAtValue", { days: payoutDelayDays })}
          </span>
        </div>
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-slate-600 dark:text-slate-400">
            {t("payment.payoutViaLabel")}
          </span>
          <span className="font-medium text-slate-900 dark:text-white">
            {t("payment.payoutViaValue")}
          </span>
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
        {t("payment.note")}
      </p>
    </section>
  );
}

function formatEur(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}
