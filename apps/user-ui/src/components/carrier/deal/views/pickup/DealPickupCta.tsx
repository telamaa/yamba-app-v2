/**
 * DealPickupCta.tsx
 * =================
 * CTA "Confirmer la prise en charge" sur l'écran ACCEPTED Voyageur.
 * Mène au formulaire /carrier/deals/[dealId]/pickup.
 * (En réel, visible le jour J ; en mock, toujours visible.)
 */

"use client";

import { PackageCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

type Props = {
  dealId: string;
  shipperFirstName: string;
  compact?: boolean;
};

export default function DealPickupCta({ dealId, shipperFirstName, compact = false }: Props) {
  const t = useTranslations("carrierDealPickup");
  const router = useRouter();

  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 sm:rounded-2xl ${
        compact ? "p-3.5" : "p-4 sm:p-5"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 ${
            compact ? "h-8 w-8" : "h-9 w-9"
          }`}
          aria-hidden="true"
        >
          <PackageCheck size={compact ? 14 : 16} />
        </div>
        <div className="min-w-0 flex-1">
          <h3
            className={`font-semibold text-slate-900 dark:text-white ${
              compact ? "text-[14px]" : "text-[14px] sm:text-[15px]"
            }`}
          >
            {t("accessCta.title")}
          </h3>
          <p
            className={`mt-0.5 leading-snug text-slate-500 dark:text-slate-400 ${
              compact ? "text-[11px]" : "text-[12px] sm:text-[13px]"
            }`}
          >
            {t("accessCta.subtitle", { shipperFirstName })}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => router.push(`/carrier/deals/${dealId}/pickup`)}
        className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#FF9900] px-4 text-[13px] font-bold text-slate-950 transition-colors hover:bg-[#F08700] active:bg-[#D97F00] sm:text-[14px]"
      >
        <PackageCheck size={15} aria-hidden="true" />
        {t("accessCta.button")}
      </button>
    </section>
  );
}
