/**
 * ConfirmAllGoodCard.tsx
 * ======================
 * LA card d'action de la période de vérification : "Tout s'est bien passé ?"
 * Chemin nominal — sans friction, MAIS avec confirmation inline (action
 * définitive : coupe le droit de signalement).
 * 3 états : initial → confirmation inline → confirmé ("Paiement libéré ✓").
 */

"use client";

import { Check, HeartHandshake } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { confirmDeliveryEarly } from "@/components/booking/booking-tracker/booking-tracker.api";
import type { Booking } from "@/components/booking/booking-tracker/booking-tracker.types";

type Props = {
  booking: Booking;
  isConfirmed: boolean;
  onConfirmedAction: (confirmedAt: string) => void;
  compact?: boolean;
};

export default function ConfirmAllGoodCard({
                                             booking,
                                             isConfirmed,
                                             onConfirmedAction,
                                             compact = false,
                                           }: Props) {
  const t = useTranslations("bookingTracker");
  const [confirming, setConfirming] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const carrierFirstName = booking.carrier.firstName;
  const recipientFirstName = booking.recipient.firstName;

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const result = await confirmDeliveryEarly(booking.id);
      onConfirmedAction(result.confirmedAt);
      toast.success(t("delivered.confirmCard.toastSuccess", { carrierFirstName }), {
        duration: 5000,
      });
    } catch {
      toast.error(t("delivered.confirmCard.toastError"));
    } finally {
      setIsSubmitting(false);
      setConfirming(false);
    }
  };

  // ── État confirmé : "Paiement libéré ✓" ──
  if (isConfirmed) {
    return (
      <section
        className={`rounded-2xl border border-emerald-200 bg-emerald-50 text-center dark:border-emerald-900/50 dark:bg-emerald-950/25 ${
          compact ? "p-4" : "p-5 sm:p-6"
        }`}
      >
        <div
          className={`mx-auto flex items-center justify-center rounded-full bg-emerald-700 text-white dark:bg-emerald-600 ${
            compact ? "h-10 w-10" : "h-12 w-12"
          }`}
          aria-hidden="true"
        >
          <Check size={compact ? 18 : 22} strokeWidth={3} />
        </div>
        <h3
          className={`mt-3 font-bold text-emerald-950 dark:text-emerald-100 ${
            compact ? "text-[15px]" : "text-[17px]"
          }`}
        >
          {t("delivered.confirmedCard.title")}
        </h3>
        <p
          className={`mx-auto mt-1 max-w-sm leading-relaxed text-emerald-800 dark:text-emerald-300 ${
            compact ? "text-[12px]" : "text-[13px]"
          }`}
        >
          {t("delivered.confirmedCard.text", { carrierFirstName })}
        </p>
      </section>
    );
  }

  // ── État initial / confirmation inline ──
  return (
    <section
      className={`rounded-2xl border border-emerald-200 bg-emerald-50 text-center dark:border-emerald-900/50 dark:bg-emerald-950/25 ${
        compact ? "p-4" : "p-5 sm:p-6"
      }`}
    >
      <div
        className={`mx-auto flex items-center justify-center rounded-full bg-emerald-700 text-white dark:bg-emerald-600 ${
          compact ? "h-10 w-10" : "h-12 w-12"
        }`}
        aria-hidden="true"
      >
        <HeartHandshake size={compact ? 18 : 22} />
      </div>

      <h3
        className={`mt-3 font-bold text-emerald-950 dark:text-emerald-100 ${
          compact ? "text-[16px]" : "text-[18px]"
        }`}
      >
        {t("delivered.confirmCard.title")}
      </h3>
      <p
        className={`mx-auto mt-1.5 max-w-md leading-relaxed text-emerald-800 dark:text-emerald-300 ${
          compact ? "text-[12px]" : "text-[13px]"
        }`}
      >
        {compact
          ? t("delivered.confirmCard.textShort", { carrierFirstName })
          : t("delivered.confirmCard.text", {
            recipientFirstName,
            carrierFirstName,
          })}
      </p>

      {confirming ? (
        <div className="mx-auto mt-4 max-w-sm rounded-xl border border-emerald-300 bg-white p-3.5 text-left dark:border-emerald-800 dark:bg-emerald-950/60">
          <div className="text-[13px] font-semibold text-emerald-950 dark:text-emerald-100">
            {t("delivered.confirmCard.inlineTitle")}
          </div>
          <p className="mt-1 text-[12px] leading-snug text-emerald-900/80 dark:text-emerald-200/80">
            {t("delivered.confirmCard.inlineText", { carrierFirstName })}
          </p>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={isSubmitting}
              className="flex-1 rounded-full border border-emerald-300 bg-white px-3 py-2 text-[12px] font-semibold text-emerald-900 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-800 dark:bg-transparent dark:text-emerald-200"
            >
              {t("delivered.confirmCard.inlineCancel")}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="flex-1 rounded-full bg-emerald-700 px-3 py-2 text-[12px] font-bold text-white hover:bg-emerald-800 disabled:opacity-50 dark:bg-emerald-600"
            >
              {isSubmitting
                ? t("delivered.confirmCard.submitting")
                : t("delivered.confirmCard.inlineYes")}
            </button>
          </div>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className={`mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 font-bold text-white transition-colors hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 ${
              compact
                ? "min-h-[46px] w-full px-4 text-[13.5px]"
                : "min-h-[48px] px-6 text-[14px]"
            }`}
          >
            <Check size={15} strokeWidth={3} aria-hidden="true" />
            {t("delivered.confirmCard.button")}
          </button>
          <p
            className={`mt-3 text-emerald-700/90 dark:text-emerald-400/90 ${
              compact ? "text-[10.5px]" : "text-[11px]"
            }`}
          >
            {compact
              ? t("delivered.confirmCard.warningShort")
              : t("delivered.confirmCard.warning")}
          </p>
        </>
      )}
    </section>
  );
}
