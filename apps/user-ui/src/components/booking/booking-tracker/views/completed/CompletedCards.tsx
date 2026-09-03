/**
 * CompletedCards.tsx — les cartes de la vue « Envoi terminé » (B4-PR2, A71)
 * =========================================================================
 * Une seule source de vérité pour desktop et mobile. L'Expéditeur lit le
 * SORT DE L'ARGENT (RG-T-03) : « le paiement de {prénom} est libéré »,
 * confirmé par lui ou automatiquement à J+4. Il ne voit JAMAIS un échec de
 * versement du Voyageur (décision 2A) — c'est un sujet entre Yamba et lui.
 * Notation : B5 — aucun bouton « Noter » avant (décision 10).
 */
"use client";

import { CheckCircle2, Star } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { Booking } from "../../booking-tracker.types";

export function CompletedBanner({ booking, compact = false }: { booking: Booking; compact?: boolean }) {
  const t = useTranslations("bookingTracker.completed");
  const format = useFormatter();
  const completedAt = booking.completedAt ? new Date(booking.completedAt) : null;
  const date = completedAt
    ? format.dateTime(completedAt, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
    : "";
  const byShipper = booking.completedBy === "SHIPPER";
  return (
    <div
      className={`flex items-center gap-3 border-teal-200 bg-teal-50 dark:border-teal-900/40 dark:bg-teal-950/30 ${
        compact ? "border-y px-4 py-3" : "my-5 rounded-2xl border px-5 py-4"
      }`}
    >
      <div
        className={`flex flex-shrink-0 items-center justify-center rounded-full bg-[#0F766E] text-white ${
          compact ? "h-7 w-7" : "h-9 w-9"
        }`}
      >
        <CheckCircle2 size={compact ? 15 : 18} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className={`font-semibold text-teal-950 dark:text-teal-100 ${compact ? "text-[13px]" : "text-[14px] sm:text-[15px]"}`}>
          {t("banner.title")}
        </div>
        <div className={`text-teal-800 dark:text-teal-300 ${compact ? "text-[11px]" : "mt-0.5 text-[12px] sm:text-[13px]"}`}>
          {byShipper ? t("banner.byShipper", { date }) : t("banner.bySystem", { date })}
        </div>
      </div>
    </div>
  );
}

export function PaymentReleasedCard({ booking, compact = false }: { booking: Booking; compact?: boolean }) {
  const t = useTranslations("bookingTracker.completed");
  const carrierFirstName = booking.carrier.firstName;
  return (
    <section
      className={`rounded-2xl border border-teal-200 bg-white text-center dark:border-teal-900/50 dark:bg-slate-950 ${
        compact ? "p-4" : "p-5 sm:p-6"
      }`}
    >
      <div
        className={`mx-auto flex items-center justify-center rounded-full bg-teal-50 text-[#0F766E] dark:bg-teal-950/40 dark:text-teal-300 ${
          compact ? "h-10 w-10" : "h-12 w-12"
        }`}
        aria-hidden="true"
      >
        <CheckCircle2 size={compact ? 18 : 22} />
      </div>
      <h3 className={`mt-3 font-bold text-slate-900 dark:text-white ${compact ? "text-[15px]" : "text-[17px]"}`}>
        {t("released.title", { carrierFirstName })}
      </h3>
      <p className={`mx-auto mt-1 max-w-md leading-relaxed text-slate-600 dark:text-slate-400 ${compact ? "text-[12px]" : "text-[13px]"}`}>
        {t("released.text", { carrierFirstName })}
      </p>
      <p className={`mt-3 text-slate-500 dark:text-slate-400 ${compact ? "text-[10.5px]" : "text-[11px]"}`}>
        {t("released.closedNote")}
      </p>
    </section>
  );
}

export function RatingSoonNote({ booking, compact = false }: { booking: Booking; compact?: boolean }) {
  const t = useTranslations("bookingTracker.completed");
  return (
    <section
      className={`flex items-start gap-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-left dark:border-slate-800 dark:bg-slate-900 ${
        compact ? "p-3.5" : "p-4"
      }`}
    >
      <Star size={15} className="mt-0.5 flex-shrink-0 text-amber-500" aria-hidden="true" />
      <p className="text-[12.5px] leading-snug text-slate-600 dark:text-slate-400">
        {t("ratingSoon", { carrierFirstName: booking.carrier.firstName })}
      </p>
    </section>
  );
}
