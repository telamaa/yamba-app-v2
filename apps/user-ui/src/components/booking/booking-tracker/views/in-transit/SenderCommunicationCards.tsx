/**
 * SenderCommunicationCards.tsx
 * ============================
 * Section COMMUNICATION côté Expéditrice :
 *  - SenderCarrierContact : Thomas ("en vol actuellement") + Message
 *  - SenderRecipientContact : Marie (Appeler / WhatsApp)
 */

"use client";

import { MessageSquare, Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import type {
  Booking,
  BookingTrackingEventId,
} from "@/components/booking/booking-tracker/booking-tracker.types";
import { useOpenDealThread } from "@/hooks/useMessaging";

function hasEvent(booking: Booking, id: BookingTrackingEventId): boolean {
  return (booking.trackingEvents ?? []).some((e) => e.id === id);
}

export function SenderCarrierContact({ booking }: { booking: Booking }) {
  const t = useTranslations("bookingTracker");
  const { carrier } = booking;
  const initials = (carrier.firstName[0] + carrier.lastInitial).toUpperCase();

  const inFlight =
    hasEvent(booking, "FLIGHT_DEPARTED") && !hasEvent(booking, "FLIGHT_ARRIVED");

  const status = inFlight
    ? t("senderTracking.communication.carrierInFlight")
    : t("senderTracking.communication.carrierTraveling");

  const thread = useOpenDealThread();
  const handleMessage = () => thread.open(booking.id);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 sm:rounded-2xl sm:p-5">
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #534AB7, #7F77DD)" }}
          aria-hidden="true"
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold text-slate-900 dark:text-white">
            {carrier.firstName} {carrier.lastInitial}.
          </div>
          <div className="text-[11.5px] text-slate-500 dark:text-slate-400">
            {t("senderTracking.communication.carrierRole")} · {status}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={handleMessage}
        disabled={thread.isPending}
        className="mt-3 inline-flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white text-[12.5px] font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
      >
        <MessageSquare size={13} aria-hidden="true" />
        {t("senderTracking.communication.message")}
      </button>
    </section>
  );
}

export function SenderRecipientContact({ booking }: { booking: Booking }) {
  const t = useTranslations("bookingTracker");
  const { recipient } = booking;
  const initials = (
    (recipient.firstName[0] ?? "") + (recipient.lastName[0] ?? "")
  ).toUpperCase();

  // Le téléphone de Marie n'est pas dans le type Booking côté Sender
  // (Aminata l'a fourni à la réservation) — mock statique cohérent.
  const phone = "+242 06 421 88 12";
  const phoneDigits = phone.replace(/[^\d+]/g, "");
  const telHref = "tel:" + phoneDigits;

  const handleWhatsApp = () => {
    window.open("https://wa.me/" + phoneDigits.replace("+", ""), "_blank");
  };

  const actionClass =
    "inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-[12.5px] font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800";

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 sm:rounded-2xl sm:p-5">
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-teal-700 text-[13px] font-semibold text-white dark:bg-teal-600"
          aria-hidden="true"
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold text-slate-900 dark:text-white">
            {recipient.firstName} {recipient.lastName}
          </div>
          <div className="text-[11.5px] text-slate-500 dark:text-slate-400">
            {t("senderTracking.communication.recipientRole", {
              city: recipient.city,
            })}
          </div>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <a href={telHref} className={actionClass}>
          <Phone size={13} aria-hidden="true" />
          {t("senderTracking.communication.call")}
        </a>
        <button type="button" onClick={handleWhatsApp} className={actionClass}>
          <MessageSquare size={13} aria-hidden="true" />
          {t("senderTracking.communication.whatsapp")}
        </button>
      </div>
    </section>
  );
}
