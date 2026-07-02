/**
 * BookingDeliveryCodeCard.tsx
 * ===========================
 * Card "Ton code de livraison" avec état verrouillé "En attente".
 *
 * Le code n'est révélé qu'après confirmation pickup par le Voyageur.
 * Tant que le statut est PENDING, on affiche un cadenas + chip "En attente"
 * + description pédagogique.
 *
 * Plus tard (statut AVAILABLE/REVEALED), ce composant affichera le vrai
 * code à 6 chiffres + bouton "Régénérer" (max 5x).
 */

"use client";

import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Booking } from "@/components/booking/booking-tracker/booking-tracker.types";

type Props = {
  booking: Booking;
  compact?: boolean;
};

export default function BookingDeliveryCodeCard({
                                                  booking,
                                                  compact = false,
                                                }: Props) {
  const t = useTranslations("bookingTracker");
  const carrierFirstName = booking.carrier.firstName;
  const recipientFirstName = booking.recipient.firstName;

  // Pour l'instant, on ne gère que l'état PENDING (Phase 3)
  // Les autres états (AVAILABLE, REVEALED, etc.) seront ajoutés dans les PRs suivantes
  const isPending = booking.deliveryCode.status === "PENDING";

  return (
    <section
      className={`flex items-start gap-4 rounded-xl border-2 border-dashed border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 sm:rounded-2xl ${
        compact ? "p-3.5" : "p-4 sm:p-5"
      }`}
    >
      <div
        className={`flex flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 ${
          compact ? "h-10 w-10" : "h-12 w-12"
        }`}
        aria-hidden="true"
      >
        <Lock size={compact ? 16 : 20} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3
            className={`font-semibold text-slate-900 dark:text-white ${
              compact ? "text-[14px]" : "text-[14px] sm:text-[15px]"
            }`}
          >
            {t("deliveryCode.title")}
          </h3>
          {isPending && (
            <span
              className={`inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400 ${
                compact ? "text-[10px]" : "text-[11px]"
              }`}
            >
              {t("deliveryCode.pendingBadge")}
            </span>
          )}
        </div>
        <p
          className={`mt-1 leading-snug text-slate-600 dark:text-slate-400 ${
            compact ? "text-[12px]" : "text-[12px] sm:text-[13px]"
          }`}
        >
          {compact
            ? t("deliveryCode.pendingDescriptionShort", { carrierFirstName })
            : t("deliveryCode.pendingDescription", {
              carrierFirstName,
              recipientFirstName,
            })}
        </p>
      </div>
    </section>
  );
}
