/**
 * PickupFooter.tsx
 * ================
 * Info + CTAs Refuser / Confirmer la prise en charge.
 *  - desktop : bloc en fin de page (fond slate)
 *  - mobile : bottom-bar FIXE (action urgente → conforme aux standards)
 *
 * Confirmer est désactivé tant que canConfirm est false
 * (5 checks + min 1 photo, validés par le parent).
 */

"use client";

import { Check, Info, X } from "lucide-react";
import { useTranslations } from "next-intl";

type Props = {
  shipperFirstName: string;
  recipientFirstName: string;
  canConfirm: boolean;
  isSubmitting?: boolean;
  onRefuseAction: () => void;
  onConfirmAction: () => void;
  variant: "desktop" | "mobile";
};

export default function PickupFooter({
                                       shipperFirstName,
                                       recipientFirstName,
                                       canConfirm,
                                       isSubmitting = false,
                                       onRefuseAction,
                                       onConfirmAction,
                                       variant,
                                     }: Props) {
  const t = useTranslations("carrierDealPickup");

  if (variant === "mobile") {
    return (
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white px-4 pb-[max(env(safe-area-inset-bottom),14px)] pt-3 dark:border-slate-800 dark:bg-slate-950">
        <div className="mb-2.5 flex items-center justify-center gap-1.5 text-center text-[11px] leading-snug text-slate-500 dark:text-slate-400">
          <Info size={12} className="flex-shrink-0" aria-hidden="true" />
          <span>{t("final.infoShort", { shipperFirstName })}</span>
        </div>
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onRefuseAction}
            disabled={isSubmitting}
            className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-[13px] font-semibold text-slate-700 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-800 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            {t("final.refuseShort")}
          </button>
          <button
            type="button"
            onClick={onConfirmAction}
            disabled={!canConfirm || isSubmitting}
            className="inline-flex flex-[2] items-center justify-center gap-1.5 rounded-xl bg-[#FF9900] px-4 py-3.5 text-[13px] font-bold text-slate-950 transition-colors hover:bg-[#F08700] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
          >
            <Check size={15} strokeWidth={3} aria-hidden="true" />
            {isSubmitting ? t("final.submitting") : t("final.confirm")}
          </button>
        </div>
      </div>
    );
  }

  // Desktop
  return (
    <div className="rounded-2xl bg-slate-50 p-5 dark:bg-slate-900/50">
      <div className="mb-4 flex items-start gap-2.5 text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">
        <Info
          size={16}
          className="mt-0.5 flex-shrink-0 text-blue-600 dark:text-blue-400"
          aria-hidden="true"
        />
        <span>{t("final.info", { shipperFirstName, recipientFirstName })}</span>
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onRefuseAction}
          disabled={isSubmitting}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-[14px] font-semibold text-slate-700 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-800 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
        >
          <X size={14} aria-hidden="true" />
          {t("final.refuse")}
        </button>
        <button
          type="button"
          onClick={onConfirmAction}
          disabled={!canConfirm || isSubmitting}
          className="inline-flex flex-[2] items-center justify-center gap-2 rounded-xl bg-[#FF9900] px-4 py-3.5 text-[14px] font-bold text-slate-950 transition-colors hover:bg-[#F08700] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
        >
          <Check size={15} strokeWidth={3} aria-hidden="true" />
          {isSubmitting ? t("final.submitting") : t("final.confirm")}
        </button>
      </div>
    </div>
  );
}
