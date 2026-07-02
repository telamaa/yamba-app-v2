/**
 * BookingPaymentBlock.tsx
 * =======================
 * Bloc paiement Expéditeur — montant débité + mode + statement descriptor.
 *
 * Variants :
 *  - sidebar (desktop) : card complète avec note sécurité
 *  - inline (mobile) : bande compacte 3 rows (Débité / Mode / Assurance)
 *
 * À la différence du DealPaymentBlock (Voyageur) qui montre le net à recevoir,
 * ici on montre le total débité (le Sender a déjà payé).
 */

"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Booking } from "@/components/booking/booking-tracker/booking-tracker.types";

type Props = {
  booking: Booking;
  variant: "sidebar" | "inline";
};

export default function BookingPaymentBlock({ booking, variant }: Props) {
  const t = useTranslations("bookingTracker");
  const locale = useLocale();

  const { payment, carrier, insurance } = booking;
  const isExtendedInsurance = insurance === "EXTENDED_500";
  const carrierFirstName = carrier.firstName;
  const paymentMode = t("payment.modeFormat", {
    brand: payment.cardBrand,
    last4: payment.cardLast4,
  });

  if (variant === "inline") {
    return (
      <section className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="flex items-center justify-between">
          <span className="text-[14px] font-semibold text-slate-900 dark:text-white">
            {t("payment.debitedLabel")}
          </span>
          <span className="text-[16px] font-black tabular-nums text-slate-900 dark:text-white">
            {formatEur(payment.totalPaidEur, locale)}
          </span>
        </div>
        <div className="mt-2.5 space-y-1.5 border-t border-slate-200 pt-2.5 dark:border-slate-700">
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-slate-600 dark:text-slate-400">
              {t("payment.modeLabel")}
            </span>
            <span className="font-medium text-slate-900 dark:text-white">
              {paymentMode}
            </span>
          </div>
          {isExtendedInsurance && (
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-slate-600 dark:text-slate-400">
                {t("payment.insuranceLabel")}
              </span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                {t("payment.insuranceCovered", { amount: "500" })}
              </span>
            </div>
          )}
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
          {t("payment.debitedLabel")}
        </span>
        <span className="text-[20px] font-black tabular-nums text-slate-900 dark:text-white">
          {formatEur(payment.totalPaidEur, locale)}
        </span>
      </div>

      <div className="my-3 border-t border-slate-100 dark:border-slate-800" />

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-slate-600 dark:text-slate-400">
            {t("payment.modeLabel")}
          </span>
          <span className="font-medium text-slate-900 dark:text-white">
            {paymentMode}
          </span>
        </div>
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-slate-600 dark:text-slate-400">
            {t("payment.statementLabel")}
          </span>
          <span className="font-medium text-slate-900 dark:text-white">
            {payment.statementDescriptor}
          </span>
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
        {t("payment.note", { carrierFirstName })}
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
