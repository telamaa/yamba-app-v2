/**
 * ConfirmAllGoodCard.tsx
 * ======================
 * LA card d'action de la période de vérification : "Tout s'est bien passé ?"
 * B4-PR2 (A71, décision utilisateur 1A) : le bouton est SECONDAIRE (contour,
 * jamais de couleur pleine — un clic trop rapide retire le droit de
 * signaler), confirmation inline « définitif » conservée, conseil « demande
 * au destinataire d'ouvrir le colis ». Après confirmation, l'appelant RELIT
 * le deal : la vue « Envoi terminé » vient du serveur (INV-3).
 */
"use client";

import { Check, HeartHandshake, Lightbulb } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { BookingApiError, confirmDeliveryEarly } from "@/components/booking/booking-tracker/booking-tracker.api";
import type { Booking } from "@/components/booking/booking-tracker/booking-tracker.types";

type Props = {
  booking: Booking;
  onConfirmedAction: () => void;
  compact?: boolean;
};

export default function ConfirmAllGoodCard({ booking, onConfirmedAction, compact = false }: Props) {
  const t = useTranslations("bookingTracker");
  const [confirming, setConfirming] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const carrierFirstName = booking.carrier.firstName;
  const recipientFirstName = booking.recipient.firstName;
  // Le serveur décide : sans `confirmEarly`, pas de bouton (fenêtre close, deal changé).
  const canConfirm = booking.allowedActions?.includes("confirmEarly") ?? false;

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await confirmDeliveryEarly(booking.id);
      toast.success(t("delivered.confirmCard.toastSuccess", { carrierFirstName }), { duration: 5000 });
      onConfirmedAction();
    } catch (e) {
      const code = e instanceof BookingApiError ? e.code : "GENERIC";
      toast.error(
        code === "TRANSITION_NOT_ALLOWED"
          ? t("delivered.confirmCard.toastConflict")
          : t("delivered.confirmCard.toastError")
      );
      if (code === "TRANSITION_NOT_ALLOWED") onConfirmedAction(); // relire : le deal a changé
    } finally {
      setIsSubmitting(false);
      setConfirming(false);
    }
  };

  if (!canConfirm) return null;

  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white text-center dark:border-slate-800 dark:bg-slate-950 ${
        compact ? "p-4" : "p-5 sm:p-6"
      }`}
    >
      <div
        className={`mx-auto flex items-center justify-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 ${
          compact ? "h-10 w-10" : "h-12 w-12"
        }`}
        aria-hidden="true"
      >
        <HeartHandshake size={compact ? 18 : 22} />
      </div>
      <h3 className={`mt-3 font-bold text-slate-900 dark:text-white ${compact ? "text-[16px]" : "text-[18px]"}`}>
        {t("delivered.confirmCard.title")}
      </h3>
      <p
        className={`mx-auto mt-1.5 max-w-md leading-relaxed text-slate-600 dark:text-slate-400 ${
          compact ? "text-[12px]" : "text-[13px]"
        }`}
      >
        {compact
          ? t("delivered.confirmCard.textShort", { carrierFirstName })
          : t("delivered.confirmCard.text", { recipientFirstName, carrierFirstName })}
      </p>

      {/* Conseil (décision 6) : ouvrir avant de confirmer */}
      <p
        className={`mx-auto mt-3 flex max-w-md items-start justify-center gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-left leading-snug text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 ${
          compact ? "text-[11.5px]" : "text-[12px]"
        }`}
      >
        <Lightbulb size={14} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
        <span>{t("delivered.confirmCard.tip", { recipientFirstName })}</span>
      </p>

      {confirming ? (
        <div className="mx-auto mt-4 max-w-sm rounded-xl border border-emerald-300 bg-emerald-50 p-3.5 text-left dark:border-emerald-800 dark:bg-emerald-950/40">
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
              {isSubmitting ? t("delivered.confirmCard.submitting") : t("delivered.confirmCard.inlineYes")}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Bouton SECONDAIRE (A71) */}
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className={`mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white font-semibold text-emerald-800 transition-colors hover:bg-emerald-50 dark:border-emerald-800 dark:bg-transparent dark:text-emerald-200 dark:hover:bg-emerald-950/40 ${
              compact ? "min-h-[44px] w-full px-4 text-[13.5px]" : "min-h-[46px] px-6 text-[14px]"
            }`}
          >
            <Check size={15} strokeWidth={3} aria-hidden="true" />
            {t("delivered.confirmCard.button")}
          </button>
          <p className={`mt-3 text-slate-500 dark:text-slate-400 ${compact ? "text-[10.5px]" : "text-[11px]"}`}>
            {compact ? t("delivered.confirmCard.warningShort") : t("delivered.confirmCard.warning")}
          </p>
        </>
      )}
    </section>
  );
}
