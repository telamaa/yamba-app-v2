/**
 * DealActionsFooter.tsx
 * =====================
 * Footer avec les 2 CTAs (Refuser / Accepter).
 * - Desktop : taille normale (pas full-width démesuré), dans la sidebar sticky,
 *   avec indicateur d'état charte + footer note de réassurance intégrée.
 * - Mobile : bottom-bar sticky avec 2 CTAs côte à côte + indicateur état.
 */

"use client";

import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";

type Props = {
  shipperFirstName: string;
  charterAccepted: boolean;
  onDeclineAction: () => void;
  onAcceptAction: () => void;
  isSubmitting?: boolean;
  variant: "mobile" | "desktop";
};

export default function DealActionsFooter({
                                            shipperFirstName,
                                            charterAccepted,
                                            onDeclineAction,
                                            onAcceptAction,
                                            isSubmitting,
                                            variant,
                                          }: Props) {
  const t = useTranslations("carrierDealRequest");

  // Indicateur d'état charte (commun aux 2 variants)
  const charterIndicator = charterAccepted ? (
    <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
      {t("actions.charterAcceptedIndicator")}
    </div>
  ) : (
    <div className="text-[11px] font-medium text-amber-600 dark:text-amber-500">
      {t("actions.charterPendingIndicator")}
    </div>
  );

  if (variant === "mobile") {
    return (
      <div className="sticky bottom-0 left-0 right-0 z-10 border-t border-slate-200 bg-white px-4 pb-3 pt-3 shadow-[0_-2px_8px_rgba(0,0,0,0.04)] dark:border-slate-700 dark:bg-slate-950">
        <div className="mb-2 flex items-center justify-center">{charterIndicator}</div>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onDeclineAction}
            disabled={isSubmitting}
            className="flex items-center justify-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 py-3 text-[14px] font-medium text-slate-700 transition-colors hover:bg-slate-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <span>{t("actions.decline")}</span>
          </button>
          <button
            type="button"
            onClick={onAcceptAction}
            disabled={isSubmitting}
            className="flex items-center justify-center gap-1.5 rounded-full bg-[#FF9900] px-4 py-3 text-[14px] font-bold text-slate-950 shadow-sm transition-all hover:bg-[#F08700] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-700 dark:disabled:text-slate-500"
          >
            <Check size={14} />
            <span>{t("actions.accept")}</span>
          </button>
        </div>
      </div>
    );
  }

  // Desktop variant — dans sidebar, taille normale
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-3 text-center">{charterIndicator}</div>

      <button
        type="button"
        onClick={onAcceptAction}
        disabled={isSubmitting}
        className="flex w-full items-center justify-center gap-1.5 rounded-full bg-[#FF9900] px-4 py-2.5 text-[13px] font-bold text-slate-950 shadow-sm transition-all hover:bg-[#F08700] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-700 dark:disabled:text-slate-500"
      >
        <Check size={13} />
        <span>{t("actions.acceptConfirm")}</span>
      </button>

      <button
        type="button"
        onClick={onDeclineAction}
        disabled={isSubmitting}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 py-2 text-[12px] font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <X size={12} />
        <span>{t("actions.decline")}</span>
      </button>

      <p className="mt-3 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
        {t("actions.footerNote", { shipperFirstName })}
      </p>
    </div>
  );
}
