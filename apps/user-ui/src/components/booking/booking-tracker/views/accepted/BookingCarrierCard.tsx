/**
 * BookingCarrierCard.tsx
 * ======================
 * Card "Ton Voyageur" avec avatar + nom + rating + Voir profil + Message.
 *
 * Le Voyageur est l'autre acteur du Deal. « Message » ouvre le fil du deal dans la
 * messagerie (A137) ; pas d'appel direct côté Expéditeur — le numéro se révèle dans le
 * fil, 2 h avant le rendez-vous confirmé (D61 3A).
 */

"use client";

import { MessageSquare, User } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Booking } from "@/components/booking/booking-tracker/booking-tracker.types";
import { useOpenDealThread } from "@/hooks/useMessaging";

type Props = {
  booking: Booking;
  compact?: boolean;
};

export default function BookingCarrierCard({ booking, compact = false }: Props) {
  const t = useTranslations("bookingTracker");

  const carrierFirstName = booking.carrier.firstName;
  const carrierFullName = `${booking.carrier.firstName} ${booking.carrier.lastInitial}.`;
  const initials = `${booking.carrier.firstName[0] ?? ""}${booking.carrier.lastInitial}`.toUpperCase();
  // Stats de réputation : B5 (A37) — la ligne disparaît tant que l'API
  // ne les sert pas, on n'invente jamais un 0 étoile.
  const ratingFormatted =
    booking.carrier.rating !== undefined
      ? booking.carrier.rating.toFixed(1)
      : null;

  const thread = useOpenDealThread();
  const handleMessage = () => thread.open(booking.id);

  const handleViewProfile = () => {
    // TODO Phase backend: naviguer vers le profil public du Voyageur
    // eslint-disable-next-line no-console
    console.info("[booking] view carrier profile", booking.carrier.id);
  };

  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 sm:rounded-2xl ${
        compact ? "p-3.5" : "p-4 sm:p-5"
      }`}
    >
      <div className={`flex items-start gap-3 ${compact ? "mb-3" : "mb-4"}`}>
        <div
          className={`flex flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 ${
            compact ? "h-8 w-8" : "h-9 w-9"
          }`}
          aria-hidden="true"
        >
          <User size={compact ? 14 : 16} />
        </div>
        <div className="min-w-0 flex-1">
          <h3
            className={`font-semibold text-slate-900 dark:text-white ${
              compact ? "text-[14px]" : "text-[14px] sm:text-[15px]"
            }`}
          >
            {t("carrierCard.title")}
          </h3>
          <p
            className={`mt-0.5 text-slate-500 dark:text-slate-400 ${
              compact ? "text-[11px]" : "text-[12px] sm:text-[13px]"
            }`}
          >
            {compact
              ? t("carrierCard.subtitleShort", { carrierFirstName })
              : t("carrierCard.subtitle", { carrierFirstName })}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div
          className={`flex flex-shrink-0 items-center justify-center rounded-full text-white ${
            compact ? "h-10 w-10 text-[12px]" : "h-11 w-11 text-[13px]"
          }`}
          style={{ background: "linear-gradient(135deg, #534AB7, #7F77DD)" }}
          aria-hidden="true"
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div
            className={`font-semibold text-slate-900 dark:text-white ${
              compact ? "text-[13px]" : "text-[14px]"
            }`}
          >
            {carrierFullName}
          </div>
          {ratingFormatted !== null && (
            <div
              className={`text-slate-500 dark:text-slate-400 ${
                compact ? "text-[11px]" : "text-[12px]"
              }`}
            >
              ⭐ {ratingFormatted} ·{" "}
              {booking.carrier.dealCount === 1
                ? `${booking.carrier.dealCount} deal`
                : `${booking.carrier.dealCount} deals`}
              {booking.carrier.isVerified && " · Vérifié"}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleViewProfile}
          className={`flex-shrink-0 font-semibold text-[#185FA5] hover:text-[#0C447C] hover:underline dark:text-blue-400 dark:hover:text-blue-300 ${
            compact ? "text-[11px]" : "text-[12px]"
          }`}
        >
          {compact ? t("carrierCard.viewProfileShort") : t("carrierCard.viewProfile")}
        </button>
      </div>

      <button
        type="button"
        onClick={handleMessage}
        disabled={thread.isPending}
        className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-[13px] font-semibold text-slate-800 transition-colors hover:bg-slate-50 active:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800 disabled:opacity-60 sm:text-[14px]"
      >
        <MessageSquare size={14} aria-hidden="true" />
        <span>
          {compact
            ? t("carrierCard.messageButtonShort", { carrierFirstName })
            : t("carrierCard.messageButton", { carrierFirstName })}
        </span>
      </button>
    </section>
  );
}
