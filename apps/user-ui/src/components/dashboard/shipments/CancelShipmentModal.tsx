/**
 * CancelShipmentModal.tsx — confirmation d'annulation Expéditeur (B2)
 * ===================================================================
 * Affiche le remboursement ANN-01 tel que SERVI par le serveur
 * (cancellationPreview de la vue Shipper) — le front n'applique jamais
 * le barème lui-même. PENDING : libération intégrale de l'empreinte ;
 * ACCEPTED : 100 % jusqu'à J-2 du départ, sinon retenue 50 %.
 *
 * Charte §3.4 : l'annulation est un chemin « neutre/refus » → slate,
 * jamais de rouge ; l'avertissement définitif reste amber.
 */

"use client";

import { AlertTriangle, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect } from "react";
import type { ShipmentListItem } from "./shipments.types";

type Props = {
  item: ShipmentListItem | null; // null = fermée
  isSubmitting: boolean;
  onCloseAction: () => void;
  onConfirmAction: (item: ShipmentListItem) => void;
};

function formatCents(cents: number, currencyCode: string, locale: string): string {
  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    style: "currency",
    currency: currencyCode,
  }).format(cents / 100);
}

export default function CancelShipmentModal({
  item,
  isSubmitting,
  onCloseAction,
  onConfirmAction,
}: Props) {
  const t = useTranslations("shipments");
  const locale = useLocale();

  const isOpen = item !== null;

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

  if (!item) return null;

  const preview = item.cancellationPreview;
  const fullRefund = !preview || preview.retentionCents === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      onClick={() => !isSubmitting && onCloseAction()}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h2 className="text-[16px] font-bold text-slate-900 dark:text-white">
            {t("cancel.dialogTitle")}
          </h2>
          <button
            type="button"
            onClick={() => !isSubmitting && onCloseAction()}
            disabled={isSubmitting}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"
            aria-label={t("cancel.close")}
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="text-[13px] text-slate-600 dark:text-slate-400">
            {t("cancel.dialogIntro", {
              route: item.originCity + " → " + item.destinationCity,
              carrierFirstName: item.carrier.firstName,
            })}
          </p>

          {preview && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-slate-600 dark:text-slate-400">
                  {t("cancel.refundLabel")}
                </span>
                <span className="font-bold tabular-nums text-slate-900 dark:text-white">
                  {formatCents(preview.refundCents, preview.currencyCode, locale)}
                </span>
              </div>
              {fullRefund ? (
                <p className="mt-1.5 text-[11.5px] leading-snug text-slate-500 dark:text-slate-400">
                  {t("cancel.fullRefundNote")}
                </p>
              ) : (
                <p className="mt-1.5 text-[11.5px] leading-snug text-slate-500 dark:text-slate-400">
                  {t("cancel.retentionNote", {
                    retention: formatCents(
                      preview.retentionCents,
                      preview.currencyCode,
                      locale
                    ),
                    pct: preview.retentionPct,
                  })}
                </p>
              )}
            </div>
          )}

          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-400">
            <AlertTriangle size={12} />
            <span>{t("cancel.finalWarning")}</span>
          </div>
        </div>

        <div className="flex gap-2.5 border-t border-slate-100 bg-slate-50 px-5 py-3.5 dark:border-slate-800 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={onCloseAction}
            disabled={isSubmitting}
            className="flex-1 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {t("cancel.keep")}
          </button>
          <button
            type="button"
            onClick={() => onConfirmAction(item)}
            disabled={isSubmitting}
            className="flex-1 rounded-full bg-slate-900 px-4 py-2.5 text-[13px] font-bold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {isSubmitting ? t("cancel.submitting") : t("cancel.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
