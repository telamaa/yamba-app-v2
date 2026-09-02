/**
 * BookingCodeCard.tsx
 * ===================
 * LA card du code de livraison révélé — le moment clé du workflow.
 * Code monumental en 2 groupes de 3 chiffres + 2 icônes à droite :
 *  📋 copier · 🔄 régénérer (avec confirmation inline + compteur max 5).
 * Fond amber doux, lisible light/dark.
 */

"use client";

import { Check, Copy, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import {
  MAX_CODE_REGENERATIONS,
  type Booking,
} from "@/components/booking/booking-tracker/booking-tracker.types";
import { regenerateDeliveryCode } from "@/components/booking/booking-tracker/booking-tracker.api";

type Props = {
  booking: Booking;
  onCodeRegeneratedAction: (newCode: string, regeneratedCount: number) => void;
  compact?: boolean;
};

export default function BookingCodeCard({
                                          booking,
                                          onCodeRegeneratedAction,
                                          compact = false,
                                        }: Props) {
  const t = useTranslations("bookingTracker");
  const [copied, setCopied] = useState(false);
  const [confirmingRegen, setConfirmingRegen] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const code = booking.deliveryCode.code ?? "";
  const regeneratedCount = booking.deliveryCode.regeneratedCount ?? 0;
  const regenerationsLeft = MAX_CODE_REGENERATIONS - regeneratedCount;
  const recipientFirstName = booking.recipient.firstName;

  const formattedCode = `${code.slice(0, 3)} ${code.slice(3)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("pickedUp.code.toastError"));
    }
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
      const result = await regenerateDeliveryCode(booking.id);
      onCodeRegeneratedAction(result.newCode, result.regeneratedCount);
      toast.success(t("pickedUp.code.toastRegenerated", { recipientFirstName }), {
        duration: 5000,
      });
      setConfirmingRegen(false);
    } catch {
      toast.error(t("pickedUp.code.toastError"));
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <section
      className={`rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/25 ${
        compact ? "p-4" : "p-5 sm:p-6"
      }`}
    >
      <div className="text-center text-[10px] font-semibold uppercase tracking-widest text-amber-800 dark:text-amber-300 sm:text-[11px]">
        {t("pickedUp.code.label", {
          recipientFirstName: recipientFirstName.toUpperCase(),
        })}
      </div>

      {/* Code + icônes */}
      <div className="mt-2 flex items-center justify-center gap-3 sm:gap-4">
        <div
          className={`font-black tabular-nums tracking-[0.12em] text-amber-950 dark:text-amber-50 ${
            compact ? "text-[38px]" : "text-[44px] sm:text-[52px]"
          }`}
          aria-label={code.split("").join(" ")}
        >
          {formattedCode}
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleCopy}
            aria-label={t("pickedUp.code.copy")}
            title={t("pickedUp.code.copy")}
            className={`flex items-center justify-center rounded-full border transition-colors ${
              compact ? "h-9 w-9" : "h-10 w-10"
            } ${
              copied
                ? "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300"
                : "border-amber-300 bg-white text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200 dark:hover:bg-amber-900/40"
            }`}
          >
            {copied ? (
              <Check size={compact ? 15 : 16} strokeWidth={3} aria-hidden="true" />
            ) : (
              <Copy size={compact ? 15 : 16} aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setConfirmingRegen(true)}
            disabled={isRegenerating || regenerationsLeft <= 0}
            aria-label={t("pickedUp.code.regenerate")}
            title={t("pickedUp.code.regenerate")}
            className={`flex items-center justify-center rounded-full border border-amber-300 bg-white text-amber-900 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200 dark:hover:bg-amber-900/40 ${
              compact ? "h-9 w-9" : "h-10 w-10"
            }`}
          >
            <RefreshCw
              size={compact ? 15 : 16}
              className={isRegenerating ? "animate-spin" : ""}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      {/* Confirmation inline de régénération */}
      {confirmingRegen ? (
        <div className="mx-auto mt-3 max-w-md rounded-xl border border-amber-300 bg-white p-3.5 dark:border-amber-800 dark:bg-amber-950/60">
          <div className="text-[13px] font-semibold text-amber-950 dark:text-amber-100">
            {t("pickedUp.code.confirmTitle")}
          </div>
          <p className="mt-1 text-[12px] leading-snug text-amber-900/80 dark:text-amber-200/80">
            {t("pickedUp.code.confirmText", { recipientFirstName })} ·{" "}
            {t("pickedUp.code.regenerationsLeft", { count: regenerationsLeft })}
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
        <p className="mx-auto mt-3 max-w-md text-center text-[11.5px] leading-snug text-amber-800/90 dark:text-amber-300/90 sm:text-[12px]">
          {t("pickedUp.code.confidentialHint")}
        </p>
      )}
    </section>
  );
}
