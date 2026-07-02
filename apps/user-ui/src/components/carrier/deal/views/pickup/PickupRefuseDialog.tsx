/**
 * PickupRefuseDialog.tsx
 * ======================
 * Flow de refus du colis au pickup.
 *  - variant "modal"  : modale centrée (desktop), Esc pour fermer
 *  - variant "sheet"  : bottom-sheet slide-up (mobile), reset différé
 * Raison optionnelle (5 radio) + détails optionnels + warning "définitif".
 */

"use client";

import { AlertTriangle, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { PickupRefuseReason } from "@/components/carrier/deal/deal.types";

const REASONS: PickupRefuseReason[] = [
  "CONTENT_MISMATCH",
  "SUSPICIOUS_CONTENT",
  "OVERWEIGHT",
  "BAD_PACKAGING",
  "OTHER",
];

type Props = {
  isOpen: boolean;
  shipperFirstName: string;
  isSubmitting?: boolean;
  variant: "modal" | "sheet";
  onCloseAction: () => void;
  onConfirmAction: (payload: { reason?: PickupRefuseReason; details?: string }) => void;
};

export default function PickupRefuseDialog({
                                             isOpen,
                                             shipperFirstName,
                                             isSubmitting = false,
                                             variant,
                                             onCloseAction,
                                             onConfirmAction,
                                           }: Props) {
  const t = useTranslations("carrierDealPickup");
  const [reason, setReason] = useState<PickupRefuseReason | undefined>(undefined);
  const [details, setDetails] = useState("");

  // Body scroll lock + Esc (modal uniquement)
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) onCloseAction();
    };
    if (variant === "modal") window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = "";
      if (variant === "modal") window.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, isSubmitting, onCloseAction, variant]);

  // Reset différé (sheet) / immédiat (modal)
  useEffect(() => {
    if (isOpen) return;
    const timeout = setTimeout(
      () => {
        setReason(undefined);
        setDetails("");
      },
      variant === "sheet" ? 200 : 0
    );
    return () => clearTimeout(timeout);
  }, [isOpen, variant]);

  const formBody = (
    <>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {t("refuse.reasonLabel")}
      </div>
      <div className="space-y-2">
        {REASONS.map((r) => (
          <label
            key={r}
            className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
          >
            <input
              type="radio"
              name={`pickup-refuse-reason-${variant}`}
              checked={reason === r}
              onChange={() => setReason(r)}
              className="h-4 w-4 accent-[#FF9900]"
            />
            <span className="text-[13px] text-slate-800 dark:text-slate-200">
              {t(`refuse.reasonOption.${r}`)}
            </span>
          </label>
        ))}
      </div>

      <div className="mt-4">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {t("refuse.detailsLabel")}
        </label>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={3}
          placeholder={t("refuse.detailsPlaceholder")}
          className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-400">
        <AlertTriangle size={12} aria-hidden="true" />
        <span>{t("refuse.finalWarning")}</span>
      </div>
    </>
  );

  const footerButtons = (
    <>
      <button
        type="button"
        onClick={onCloseAction}
        disabled={isSubmitting}
        className="flex-1 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        {t("refuse.cancel")}
      </button>
      <button
        type="button"
        onClick={() => onConfirmAction({ reason, details: details.trim() || undefined })}
        disabled={isSubmitting}
        className="flex-1 rounded-full bg-red-600 px-4 py-2.5 text-[13px] font-bold text-white hover:bg-red-700 disabled:opacity-50"
      >
        {isSubmitting ? t("refuse.submitting") : t("refuse.confirmRefuse")}
      </button>
    </>
  );

  if (variant === "sheet") {
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
          <div className="flex justify-center pb-1.5 pt-2.5">
            <div className="h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
          </div>
          <div className="px-5 pb-2 pt-1">
            <h2 className="text-[16px] font-bold text-slate-900 dark:text-white">
              {t("refuse.dialogTitle")}
            </h2>
            <p className="mt-1 text-[12px] text-slate-600 dark:text-slate-400">
              {t("refuse.dialogIntro", { shipperFirstName })}
            </p>
          </div>
          <div className="px-5 py-4">{formBody}</div>
          <div className="sticky bottom-0 flex gap-2.5 border-t border-slate-100 bg-white px-5 py-3.5 pb-[max(env(safe-area-inset-bottom),14px)] dark:border-slate-800 dark:bg-slate-900">
            {footerButtons}
          </div>
        </div>
      </div>
    );
  }

  // Modal desktop
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
            {t("refuse.dialogTitle")}
          </h2>
          <button
            type="button"
            onClick={() => !isSubmitting && onCloseAction()}
            disabled={isSubmitting}
            aria-label={t("refuse.cancel")}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="mb-4 text-[13px] text-slate-600 dark:text-slate-400">
            {t("refuse.dialogIntro", { shipperFirstName })}
          </p>
          {formBody}
        </div>
        <div className="flex gap-2.5 border-t border-slate-100 bg-slate-50 px-5 py-3.5 dark:border-slate-800 dark:bg-slate-900/50">
          {footerButtons}
        </div>
      </div>
    </div>
  );
}
