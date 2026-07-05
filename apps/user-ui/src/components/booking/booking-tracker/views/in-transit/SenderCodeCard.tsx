/**
 * SenderCodeCard.tsx
 * ==================
 * Card code COMPACTE pour la phase voyage (écran 6) : l'urgence de
 * transmission est passée, le code reste accessible sans dominer.
 * Collapsible (ouverte par défaut) · Repartager (wa.me pré-rempli) ·
 * Régénérer (confirmation inline + compteur, même logique qu'écran 4).
 */

"use client";

import { ChevronDown, KeyRound, RefreshCw, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { regenerateDeliveryCode } from "@/components/booking/booking-tracker/booking-tracker.api";
import {
  MAX_CODE_REGENERATIONS,
  type Booking,
} from "@/components/booking/booking-tracker/booking-tracker.types";

type Props = {
  booking: Booking;
  onCodeRegeneratedAction: (newCode: string, regeneratedCount: number) => void;
  compact?: boolean;
};

export default function SenderCodeCard({
                                         booking,
                                         onCodeRegeneratedAction,
                                         compact = false,
                                       }: Props) {
  const t = useTranslations("bookingTracker");
  const [collapsed, setCollapsed] = useState(false);
  const [confirmingRegen, setConfirmingRegen] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const code = booking.deliveryCode.code ?? "";
  const regeneratedCount = booking.deliveryCode.regeneratedCount ?? 0;
  const regenerationsLeft = MAX_CODE_REGENERATIONS - regeneratedCount;
  const recipientFirstName = booking.recipient.firstName;
  const carrierFirstName = booking.carrier.firstName;

  const formattedCode = code.slice(0, 3) + " " + code.slice(3);

  const handleReshare = () => {
    const route =
      booking.trip.originCity + " → " + booking.trip.destinationCity;
    const message = t("pickedUp.share.messageTemplate", {
      recipientFirstName,
      carrierFirstName,
      route,
      code,
    });
    window.open(
      "https://wa.me/?text=" + encodeURIComponent(message),
      "_blank"
    );
  };

  const handleRegenerate = async () => {
    if (isRegenerating) return;
    if (regenerationsLeft <= 0) {
      toast.error(t("pickedUp.code.toastMaxReached"));
      setConfirmingRegen(false);
      return;
    }
    setIsRegenerating(true);
    try {
      const result = await regenerateDeliveryCode(booking.id, regeneratedCount);
      onCodeRegeneratedAction(result.newCode, result.regeneratedCount);
      toast.success(
        t("pickedUp.code.toastRegenerated", { recipientFirstName }),
        { duration: 5000 }
      );
      setConfirmingRegen(false);
    } catch {
      toast.error(t("pickedUp.code.toastError"));
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <section
      className={
        "rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 sm:rounded-2xl " +
        (compact ? "p-4" : "p-4 sm:p-5")
      }
    >
      {/* Header collapsible */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        className="flex w-full items-center gap-3 text-left"
      >
        <div
          className={
            "flex flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 " +
            (compact ? "h-8 w-8" : "h-9 w-9")
          }
          aria-hidden="true"
        >
          <KeyRound size={compact ? 14 : 16} />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className={
              "font-semibold text-slate-900 dark:text-white " +
              (compact ? "text-[14px]" : "text-[14px] sm:text-[15px]")
            }
          >
            {t("senderTracking.code.title")}
          </div>
          <div
            className={
              "text-slate-500 dark:text-slate-400 " +
              (compact ? "text-[11px]" : "text-[12px]")
            }
          >
            {t("senderTracking.code.sub", { recipientFirstName })}
          </div>
        </div>
        <ChevronDown
          size={16}
          className={
            "flex-shrink-0 text-slate-500 transition-transform dark:text-slate-400 " +
            (collapsed ? "-rotate-90" : "")
          }
          aria-hidden="true"
        />
      </button>

      {!collapsed && (
        <div className="mt-3.5">
          {/* Le code */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 py-3 text-center dark:border-amber-900/40 dark:bg-amber-950/25">
            <span
              className={
                "font-black tabular-nums tracking-[0.15em] text-amber-950 dark:text-amber-50 " +
                (compact ? "text-[28px]" : "text-[32px]")
              }
            >
              {formattedCode}
            </span>
          </div>

          {/* Confirmation inline régénération */}
          {confirmingRegen ? (
            <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3.5 dark:border-amber-800 dark:bg-amber-950/40">
              <div className="text-[13px] font-semibold text-amber-950 dark:text-amber-100">
                {t("pickedUp.code.confirmTitle")}
              </div>
              <p className="mt-1 text-[12px] leading-snug text-amber-900/80 dark:text-amber-200/80">
                {t("pickedUp.code.confirmText", { recipientFirstName })} ·{" "}
                {t("pickedUp.code.regenerationsLeft", {
                  count: regenerationsLeft,
                })}
              </p>
              <div className="mt-2.5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmingRegen(false)}
                  disabled={isRegenerating}
                  className="flex-1 rounded-full border border-amber-300 bg-white px-3 py-2 text-[12px] font-semibold text-amber-900 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-800 dark:bg-transparent dark:text-amber-200"
                >
                  {t("pickedUp.code.confirmCancel")}
                </button>
                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={isRegenerating}
                  className="flex-1 rounded-full bg-amber-600 px-3 py-2 text-[12px] font-bold text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {isRegenerating
                    ? t("pickedUp.code.regenerating")
                    : t("pickedUp.code.confirmYes")}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Actions */}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={handleReshare}
                  className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-[12.5px] font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
                >
                  <Share2 size={13} aria-hidden="true" />
                  {compact
                    ? t("senderTracking.code.reshare")
                    : t("senderTracking.code.reshareLong", {
                      recipientFirstName,
                    })}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingRegen(true)}
                  disabled={regenerationsLeft <= 0}
                  className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-[12.5px] font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
                >
                  <RefreshCw size={13} aria-hidden="true" />
                  {t("senderTracking.code.regenerate")}
                </button>
              </div>
              {!compact && (
                <p className="mt-2.5 text-[11.5px] leading-snug text-slate-500 dark:text-slate-400">
                  {t("senderTracking.code.hint", { recipientFirstName })}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
