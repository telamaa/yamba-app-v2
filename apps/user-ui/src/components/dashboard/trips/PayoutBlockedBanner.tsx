/**
 * PayoutBlockedBanner.tsx — « Versement en attente : finalise ton compte Stripe » (B4-PR3, A75)
 * =============================================================================================
 * Affiché en tête de « Mes trajets » tant qu'AU MOINS un deal COMPLETED porte
 * `payoutBlocker = ACCOUNT_NOT_READY` (servi par l'API — le front reflète).
 * Une erreur fournisseur (RETRYING) ne déclenche PAS le bandeau : rien à faire.
 */
"use client";

import { AlertTriangle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useMyDeals } from "@/hooks/useMyDeals";

export default function PayoutBlockedBanner() {
  const t = useTranslations("myTrips.payoutBanner");
  const locale = useLocale();
  const router = useRouter();
  const { data: views } = useMyDeals();
  const blocked = (views ?? []).filter((v) => v.payoutBlocker === "ACCOUNT_NOT_READY");
  if (blocked.length === 0) return null;
  const totalCents = blocked.reduce((sum, v) => sum + v.pricing.transportCents, 0);
  const amount = new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", { style: "currency", currency: "EUR" }).format(totalCents / 100);

  return (
    <div
      className="mb-5 flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30 sm:flex-row sm:items-center"
      role="status"
    >
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-amber-500 text-white">
        <AlertTriangle size={17} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-bold text-amber-950 dark:text-amber-100">{t("title", { amount, count: blocked.length })}</div>
        <p className="mt-0.5 text-[12.5px] leading-snug text-amber-900/85 dark:text-amber-200/85">{t("text")}</p>
      </div>
      <button
        type="button"
        onClick={() => router.push("/carrier/onboarding")}
        className="inline-flex min-h-[40px] flex-shrink-0 items-center justify-center rounded-xl bg-[#FF9900] px-4 text-[12.5px] font-bold text-slate-950 transition-colors hover:bg-[#F08700]"
      >
        {t("cta")}
      </button>
    </div>
  );
}
