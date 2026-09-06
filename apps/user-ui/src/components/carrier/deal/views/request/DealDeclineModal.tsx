/**
 * DealDeclineModal.tsx
 * ====================
 * Modale desktop de refus de Deal.
 * - Backdrop avec body scroll lock
 * - Esc pour fermer
 * - Raison optionnelle (radio buttons) — les 5 du contrat (spec É2)
 */

"use client";

import { AlertTriangle, X } from "lucide-react";
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

export default function DealDeclineModal({
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
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) onCloseAction();
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, isSubmitting, onCloseAction]);

  useEffect(() => {
    if (!isOpen) {
      setReason(undefined);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      onClick={() => !isSubmitting && onCloseAction()}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h2 className="text-[16px] font-bold text-slate-900 dark:text-white">
            {t("decline.dialogTitle")}
          </h2>
          <button
            type="button"
            onClick={() => !isSubmitting && onCloseAction()}
            disabled={isSubmitting}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"
            aria-label={t("close")}
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="mb-4 text-[13px] text-slate-600 dark:text-slate-400">
            {t("decline.dialogIntro", { shipperFirstName })}
          </p>

          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t("decline.reasonLabel")}
            </div>
            {REASONS.map((r) => (
              <label
                key={r}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
              >
                <input
                  type="radio"
                  name="decline-reason"
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

        <div className="flex gap-2.5 border-t border-slate-100 bg-slate-50 px-5 py-3.5 dark:border-slate-800 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={onCloseAction}
            disabled={isSubmitting}
            className="flex-1 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {t("decline.cancel")}
          </button>
          {/* Charte §3.4 : refus = slate (jamais de rouge) */}
          <button
            type="button"
            onClick={() => onConfirmAction({ reason })}
            disabled={isSubmitting}
            className="flex-1 rounded-full bg-slate-900 px-4 py-2.5 text-[13px] font-bold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {isSubmitting ? t("decline.submitting") : t("decline.confirmDecline")}
          </button>
        </div>
      </div>
    </div>
  );
}
