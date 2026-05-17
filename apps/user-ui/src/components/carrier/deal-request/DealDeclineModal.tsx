/**
 * DealDeclineModal.tsx
 * ====================
 * Modale de confirmation pour le refus d'un Deal (version desktop).
 * - Backdrop semi-transparent + blur
 * - Esc + clic backdrop ferment la modale
 * - Raison + détails optionnels
 * - Bouton "Refuser le Deal" en rouge (action destructive)
 *
 * Le wrapper parent gère l'état isOpen.
 */

"use client";

import { ChevronDown, ChevronUp, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { DeclineReason } from "./deal-request.types";

const REASON_KEYS: DeclineReason[] = [
  "CATEGORY_NOT_TRANSPORTED",
  "WEIGHT_TOO_HEAVY",
  "LOCATION_INCOMPATIBLE",
  "TIMING_TOO_TIGHT",
  "OTHER",
];

type Props = {
  isOpen: boolean;
  shipperFirstName: string;
  isSubmitting?: boolean;
  onCloseAction: () => void;
  onConfirmAction: (payload: { reason?: DeclineReason; details?: string }) => void;
};

export default function DealDeclineModal({
                                           isOpen,
                                           shipperFirstName,
                                           isSubmitting,
                                           onCloseAction,
                                           onConfirmAction,
                                         }: Props) {
  const t = useTranslations("carrierDealRequest");
  const [reason, setReason] = useState<DeclineReason | "">("");
  const [details, setDetails] = useState("");
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) {
      setReason("");
      setDetails("");
      setDetailsExpanded(false);
    }
  }, [isOpen]);

  // Escape closes
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) onCloseAction();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, isSubmitting, onCloseAction]);

  // Lock body scroll when open
  useEffect(() => {
    if (!isOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirmAction({
      reason: reason || undefined,
      details: details.trim() || undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={() => !isSubmitting && onCloseAction()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="decline-modal-title"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 pb-3 pt-5">
          <h2
            id="decline-modal-title"
            className="text-[18px] font-medium tracking-tight text-slate-900 dark:text-white"
          >
            {t("decline.dialogTitle")}
          </h2>
          <button
            type="button"
            onClick={onCloseAction}
            disabled={isSubmitting}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label={t("close")}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 pb-5">
          <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">
            {t("decline.dialogIntro", { shipperFirstName })}
          </p>

          {/* Reason select */}
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-slate-600 dark:text-slate-300">
              {t("decline.reasonLabel")}
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as DeclineReason | "")}
              disabled={isSubmitting}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-[13px] text-slate-900 transition-colors focus:border-[#FF9900] focus:outline-none focus:ring-1 focus:ring-[#FF9900] disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            >
              <option value="">{t("decline.reasonPlaceholder")}</option>
              {REASON_KEYS.map((key) => (
                <option key={key} value={key}>
                  {t(`decline.reasonOption.${key}`)}
                </option>
              ))}
            </select>
          </div>

          {/* Details toggle + textarea */}
          <div>
            <button
              type="button"
              onClick={() => setDetailsExpanded((v) => !v)}
              disabled={isSubmitting}
              className="flex items-center gap-1 text-[12px] font-medium text-[#185FA5] hover:underline disabled:opacity-50 dark:text-blue-400"
            >
              {detailsExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              <span>
                {detailsExpanded
                  ? t("decline.detailsToggleCollapse")
                  : t("decline.detailsToggleExpand")}
              </span>
            </button>
            {detailsExpanded && (
              <div className="mt-2.5">
                <label className="mb-1.5 block text-[13px] font-medium text-slate-600 dark:text-slate-300">
                  {t("decline.detailsLabel")}
                </label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  disabled={isSubmitting}
                  rows={3}
                  maxLength={500}
                  placeholder={t("decline.detailsPlaceholder", { shipperFirstName })}
                  className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 transition-colors focus:border-[#FF9900] focus:outline-none focus:ring-1 focus:ring-[#FF9900] disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>
            )}
          </div>

          {/* Final warning */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/40 dark:bg-amber-950/30">
            <p className="text-[12px] font-medium text-amber-900 dark:text-amber-200">
              ⚠ {t("decline.finalWarning")}
            </p>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={onCloseAction}
            disabled={isSubmitting}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {t("decline.cancel")}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="rounded-full bg-red-600 px-5 py-2 text-[13px] font-bold text-white shadow-sm transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? t("decline.submitting") : t("decline.confirmDecline")}
          </button>
        </div>
      </div>
    </div>
  );
}
