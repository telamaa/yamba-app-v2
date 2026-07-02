/**
 * DealCoverageCard.tsx
 * ====================
 * Affiche l'assurance souscrite par l'expéditeur.
 * - Variant "sidebar" : card compacte pour la sidebar desktop
 * - Variant "inline" : encart vert intégré dans le flow mobile
 */

"use client";

import { Shield, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import type { DealInsurance } from "./deal-request.types";

type Props = {
  insurance: DealInsurance;
  shipperFirstName: string;
  variant?: "sidebar" | "inline";
};

export default function DealCoverageCard({
                                           insurance,
                                           shipperFirstName,
                                           variant = "sidebar",
                                         }: Props) {
  const t = useTranslations("carrierDealRequest");
  const isExtended = insurance === "EXTENDED_500";

  if (variant === "inline") {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900/40 dark:bg-emerald-950/30">
        <div className="flex items-start gap-2">
          <ShieldCheck size={14} className="mt-0.5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
          <p className="text-[11px] leading-snug text-emerald-900 dark:text-emerald-200">
            {t("coverage.shipperNoteExtendedShort", { shipperFirstName })}
          </p>
        </div>
      </div>
    );
  }

  // sidebar variant — plus compact (sans gros titre uppercase)
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-emerald-700 dark:text-emerald-400">
        {isExtended ? <ShieldCheck size={15} /> : <Shield size={15} />}
        <span>{isExtended ? t("coverage.extended") : t("coverage.basic")}</span>
      </div>
      {isExtended && (
        <p className="mt-1.5 text-[11px] leading-snug text-slate-600 dark:text-slate-400">
          {t("coverage.shipperNoteExtended", { shipperFirstName })}
        </p>
      )}
    </div>
  );
}
