/**
 * DealDeclineSheet.tsx
 * ====================
 * Bottom-sheet de confirmation pour le refus d'un Deal (version mobile).
 * - Slide-up animation
 * - Tap backdrop pour fermer
 * - Mêmes champs que la modale desktop
 */

"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
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

export default function DealDeclineSheet({
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

  useEffect(() => {
    if (isOpen) return;
    const timeout = setTimeout(() => {
      setReason("");
      setDetails("");
      setDetailsExpanded(false);
    }, 200);
    return () => clearTimeout(timeout);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [isOpen]);

  const handleConfirm = () => {
    onConfirmAction({
      reason: reason || undefined,
      details: details.trim() || undefined,
    });
  };

  return (
    <div
      className={`fixed inset-0 z-50 transition-opacity duration-200 ${
        isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="decline-sheet-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => !isSubmitting && onCloseAction()}
      />

      {/* Sheet */}
      <div
        className={`absolute inset-x-0 bottom-0 max-h-[90vh] overflow-y-auto rounded-t-2xl border-t border-slate-200 bg-white shadow-2xl transition-transform duration-200 ease-out dark:border-slate-700 dark:bg-slate-950 ${
          isOpen ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Handle */}
        <div className="sticky top-0 z-10 bg-white pt-2 pb-1 dark:bg-slate-950">
          <div
            className="mx-auto h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-600"
            aria-hidden="true"
          />
        </div>

        <div className="px-4 pb-5 pt-3">
          {/* Title */}
          <h2
            id="decline-sheet-title"
            className="mb-2 text-[18px] font-medium tracking-tight text-slate-900 dark:text-white"
          >
            {t("decline.dialogTitle")}
          </h2>
          <p className="mb-5 text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">
            {t("decline.dialogIntro", { shipperFirstName })}
          </p>

          {/* Reason select */}
          <div className="mb-4">
            <label className="mb-1.5 block text-[13px] font-medium text-slate-600 dark:text-slate-300">
              {t("decline.reasonLabel")}
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as DeclineReason | "")}
              disabled={isSubmitting}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-[14px] text-slate-900 transition-colors focus:border-[#FF9900] focus:outline-none focus:ring-1 focus:ring-[#FF9900] disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            >
              <option value="">{t("decline.reasonPlaceholder")}</option>
              {REASON_KEYS.map((key) => (
                <option key={key} value={key}>
                  {t(`decline.reasonOption.${key}`)}
                </option>
              ))}
            </select>
          </div>

          {/* Details toggle */}
          <div className="mb-4">
            <button
              type="button"
              onClick={() => setDetailsExpanded((v) => !v)}
              disabled={isSubmitting}
              className="flex items-center gap-1 text-[13px] font-medium text-[#185FA5] disabled:opacity-50 dark:text-blue-400"
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
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  disabled={isSubmitting}
                  rows={3}
                  maxLength={500}
                  placeholder={t("decline.detailsPlaceholder", { shipperFirstName })}
                  className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-[14px] text-slate-900 placeholder:text-slate-400 transition-colors focus:border-[#FF9900] focus:outline-none focus:ring-1 focus:ring-[#FF9900] disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>
            )}
          </div>

          {/* Final warning */}
          <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-900/40 dark:bg-amber-950/30">
            <p className="text-[12px] font-medium text-amber-900 dark:text-amber-200">
              ⚠ {t("decline.finalWarning")}
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="w-full rounded-full bg-red-600 px-4 py-3 text-[14px] font-bold text-white shadow-sm transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? t("decline.submitting") : t("decline.confirmDecline")}
            </button>
            <button
              type="button"
              onClick={onCloseAction}
              disabled={isSubmitting}
              className="w-full rounded-full border border-slate-300 bg-white px-4 py-3 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {t("decline.cancel")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
