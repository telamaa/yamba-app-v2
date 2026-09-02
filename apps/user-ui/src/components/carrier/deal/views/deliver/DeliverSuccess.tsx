/**
 * DeliverSuccess.tsx
 * ==================
 * Écran de célébration après validation du code 🎉
 * "Livraison validée !" + versement J+4 + CTA notation (primaire) + retours.
 */

"use client";

import { Check, PartyPopper, Star } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { DealRequest } from "@/components/carrier/deal/deal.types";

type Props = {
  deal: DealRequest;
  deliveredAt: string;
  onRateShipperAction: () => void;
  onBackToDealAction: () => void;
  onBackToDashboardAction: () => void;
};

export default function DeliverSuccess({
                                         deal,
                                         deliveredAt,
                                         onRateShipperAction,
                                         onBackToDealAction,
                                         onBackToDashboardAction,
                                       }: Props) {
  const t = useTranslations("carrierDealDeliver");
  const locale = useLocale();

  const recipientFirstName = deal.recipient?.firstName ?? "";
  const shipperFirstName = deal.shipper.firstName;

  const payoutDate = new Date(
    new Date(deliveredAt).getTime() +
    deal.earnings.payoutDelayDays * 24 * 3600 * 1000
  );

  const amount = formatEur(deal.earnings.netForCarrier, locale);
  const dateStr = formatLongDate(payoutDate, locale);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <div className="w-full max-w-md text-center">
        {/* Icône de succès */}
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-700 text-white shadow-lg dark:bg-emerald-600">
          <Check size={38} strokeWidth={3} aria-hidden="true" />
        </div>

        <h1 className="mt-6 text-[22px] font-bold tracking-tight text-slate-900 dark:text-white sm:text-[26px]">
          {t("success.title")}
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-slate-600 dark:text-slate-400">
          {t("success.subtitle", { recipientFirstName, shipperFirstName })}
        </p>

        {/* Card versement */}
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-left dark:border-emerald-900/40 dark:bg-emerald-950/25">
          <div className="flex items-center gap-2">
            <PartyPopper
              size={16}
              className="text-emerald-700 dark:text-emerald-400"
              aria-hidden="true"
            />
            <h2 className="text-[14px] font-bold text-emerald-950 dark:text-emerald-100">
              {t("success.payoutTitle")}
            </h2>
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-emerald-900/85 dark:text-emerald-200/85">
            {t("success.payoutText", { amount, date: dateStr })}
          </p>
        </div>

        {/* CTAs */}
        <div className="mt-6 space-y-2.5">
          <button
            type="button"
            onClick={onRateShipperAction}
            className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#FF9900] px-4 text-[14px] font-bold text-slate-950 transition-colors hover:bg-[#F08700]"
          >
            <Star size={14} aria-hidden="true" />
            {t("success.rateShipper", { shipperFirstName })}
          </button>
          <button
            type="button"
            onClick={onBackToDealAction}
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-[13px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {t("success.backToDeal")}
          </button>
          <button
            type="button"
            onClick={onBackToDashboardAction}
            className="inline-flex min-h-[42px] w-full items-center justify-center px-4 text-[12.5px] font-semibold text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            {t("success.backToDashboard")}
          </button>
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

function formatLongDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}
