/**
 * DealActionsFooter.tsx
 * =====================
 * CTAs Refuser / Accepter et confirmer + indicateur d'état charte.
 *
 * Variants :
 *  - desktop : layout vertical pour la sidebar sticky
 *  - mobile : bottom-bar fixe en bas de l'écran (safe-area inset)
 *
 * Le ✓ pour "Charte acceptée" est déjà dans la string du JSON.
 */

"use client";

import { useTranslations } from "next-intl";

type Props = {
  shipperFirstName: string;
  charterAccepted: boolean;
  onDeclineAction: () => void;
  onAcceptAction: () => void;
  isSubmitting?: boolean;
  variant: "desktop" | "mobile";
};

export default function DealActionsFooter({
                                            charterAccepted,
                                            onDeclineAction,
                                            onAcceptAction,
                                            isSubmitting = false,
                                            variant,
                                          }: Props) {
  const t = useTranslations("carrierDealRequest");

  const charterIndicator = (
    <div
      className={`text-center text-[11px] font-medium ${
        charterAccepted
          ? "text-emerald-700 dark:text-emerald-400"
          : "text-amber-700 dark:text-amber-400"
      }`}
    >
      {charterAccepted
        ? t("actions.charterAcceptedIndicator")
        : t("actions.charterPendingIndicator")}
    </div>
  );

  if (variant === "mobile") {
    return (
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 dark:border-slate-800 dark:bg-slate-950">
        <div className="mb-2.5">{charterIndicator}</div>
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onDeclineAction}
            disabled={isSubmitting}
            className="flex-1 rounded-full border border-slate-300 bg-white px-4 py-3 text-[14px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {t("actions.decline")}
          </button>
          <button
            type="button"
            onClick={onAcceptAction}
            disabled={isSubmitting}
            className="flex-[1.5] rounded-full bg-[#FF9900] px-4 py-3 text-[14px] font-bold text-slate-950 transition-colors hover:bg-[#F08700] disabled:opacity-50"
          >
            {isSubmitting ? t("accept.submitting") : t("actions.acceptConfirm")}
          </button>
        </div>
      </div>
    );
  }

  // Desktop : sidebar
  return (
    <div className="space-y-2.5 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
      <button
        type="button"
        onClick={onAcceptAction}
        disabled={isSubmitting}
        className="w-full rounded-full bg-[#FF9900] px-4 py-3 text-[14px] font-bold text-slate-950 transition-colors hover:bg-[#F08700] disabled:opacity-50"
      >
        {isSubmitting ? t("accept.submitting") : t("actions.acceptConfirm")}
      </button>
      <button
        type="button"
        onClick={onDeclineAction}
        disabled={isSubmitting}
        className="w-full rounded-full border border-slate-300 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        {t("actions.decline")}
      </button>
      <div className="pt-1">{charterIndicator}</div>
    </div>
  );
}
