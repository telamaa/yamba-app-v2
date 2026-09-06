/**
 * DealDeclineSheet.tsx
 * ====================
 * Bottom-sheet mobile de refus de Deal.
 * - Slide-up animation
 * - Handle bar en haut pour signaler le swipe (visuel uniquement)
 * - Reset différé du state pour ne pas voir le contenu changer pendant fermeture
 */

"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { DeclineReason } from "@/components/carrier/deal/deal.types";

type Props = {
  isOpen: boolean;
  shipperFirstName: string;
  isSubmitting?: boolean;
  onCloseAction: () => void;
  onConfirmAction: (payload: { reason?: DeclineReason }) => void;
};

const REASONS: DeclineReason[] = [
  "CATEGORY_NOT_CARRIED",
  "TOO_HEAVY",
  "PLACES_INCOMPATIBLE",
  "TIMING",
  "OTHER",
];

export default function DealDeclineSheet({
                                           isOpen,
                                           shipperFirstName,
                                           isSubmitting = false,
                                           onCloseAction,
                                           onConfirmAction,
                                         }: Props) {
  const t = useTranslations("carrierDealRequest");
  const [reason, setReason] = useState<DeclineReason | undefined>(undefined);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) return;
    // Reset différé pour éviter de voir le contenu changer pendant la fermeture
    const timeout = setTimeout(() => {
      setReason(undefined);
    }, 200);
    return () => clearTimeout(timeout);
  }, [isOpen]);

  return (
    <div
      className={`fixed inset-0 z-50 transition-opacity duration-200 ${
        isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      }`}
      onClick={() => !isSubmitting && onCloseAction()}
      role="dialog"
      aria-modal="true"
      aria-hidden={!isOpen}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className={`absolute inset-x-0 bottom-0 max-h-[90vh] overflow-y-auto rounded-t-3xl bg-white shadow-2xl transition-transform duration-200 dark:bg-slate-900 ${
          isOpen ? "translate-y-0" : "translate-y-full"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-2.5 pb-1.5">
          <div className="h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        <div className="px-5 pb-2 pt-1">
          <h2 className="text-[16px] font-bold text-slate-900 dark:text-white">
            {t("decline.dialogTitle")}
          </h2>
          <p className="mt-1 text-[12px] text-slate-600 dark:text-slate-400">
            {t("decline.dialogIntro", { shipperFirstName })}
          </p>
        </div>

        <div className="px-5 py-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t("decline.reasonLabel")}
          </div>
          <div className="space-y-2">
            {REASONS.map((r) => (
              <label
                key={r}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3.5 py-3 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
              >
                <input
                  type="radio"
                  name="decline-reason-sheet"
                  checked={reason === r}
                  onChange={() => setReason(r)}
                  className="h-4 w-4 accent-[#FF9900]"
                />
                <span className="text-[13px] text-slate-800 dark:text-slate-200">
                  {t(`decline.reasonOption.${r}`)}
                </span>
              </label>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-400">
            <AlertTriangle size={12} />
            <span>{t("decline.finalWarning")}</span>
          </div>
        </div>

        <div className="sticky bottom-0 flex gap-2.5 border-t border-slate-100 bg-white px-5 py-3.5 pb-[max(env(safe-area-inset-bottom),14px)] dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={onCloseAction}
            disabled={isSubmitting}
            className="flex-1 rounded-full border border-slate-300 bg-white px-4 py-3 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {t("decline.cancel")}
          </button>
          {/* Charte §3.4 : refus = slate (jamais de rouge) */}
          <button
            type="button"
            onClick={() => onConfirmAction({ reason })}
            disabled={isSubmitting}
            className="flex-1 rounded-full bg-slate-900 px-4 py-3 text-[13px] font-bold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {isSubmitting ? t("decline.submitting") : t("decline.confirmDecline")}
          </button>
        </div>
      </div>
    </div>
  );
}
