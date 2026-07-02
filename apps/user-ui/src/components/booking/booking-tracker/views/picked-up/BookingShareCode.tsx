/**
 * BookingShareCode.tsx
 * ====================
 * Card "Partage le code à Marie" — WhatsApp / SMS / Email / Copier le message.
 * Liens natifs (wa.me, sms:, mailto:) avec message pré-rempli → fonctionne
 * réellement dès le mock, sans backend.
 */

"use client";

import { Check, Copy, Mail, MessageCircle, MessageSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { Booking } from "@/components/booking/booking-tracker/booking-tracker.types";

type Props = {
  booking: Booking;
  compact?: boolean;
};

export default function BookingShareCode({ booking, compact = false }: Props) {
  const t = useTranslations("bookingTracker");
  const [messageCopied, setMessageCopied] = useState(false);

  const code = booking.deliveryCode.code ?? "";
  const recipientFirstName = booking.recipient.firstName;
  const carrierFirstName = booking.carrier.firstName;
  const route = `${booking.trip.originCity} → ${booking.trip.destinationCity}`;

  const message = t("pickedUp.share.messageTemplate", {
    recipientFirstName,
    carrierFirstName,
    route,
    code,
  });

  const handleWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
  };

  const handleSms = () => {
    // ?&body= fonctionne iOS + Android
    window.location.href = `sms:?&body=${encodeURIComponent(message)}`;
  };

  const handleEmail = () => {
    const subject = t("pickedUp.share.emailSubject");
    window.location.href = `mailto:?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(message)}`;
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setMessageCopied(true);
      setTimeout(() => setMessageCopied(false), 2000);
    } catch {
      // silencieux
    }
  };

  const channels = [
    {
      id: "whatsapp",
      label: t("pickedUp.share.whatsapp"),
      icon: <MessageCircle size={18} aria-hidden="true" />,
      onClick: handleWhatsApp,
      bg: "bg-emerald-600",
    },
    {
      id: "sms",
      label: t("pickedUp.share.sms"),
      icon: <MessageSquare size={18} aria-hidden="true" />,
      onClick: handleSms,
      bg: "bg-blue-600",
    },
    {
      id: "email",
      label: t("pickedUp.share.email"),
      icon: <Mail size={18} aria-hidden="true" />,
      onClick: handleEmail,
      bg: "bg-[#FF9900]",
    },
    {
      id: "copy",
      label: messageCopied
        ? t("pickedUp.share.messageCopied")
        : t("pickedUp.share.copyMessage"),
      icon: messageCopied ? (
        <Check size={18} strokeWidth={3} aria-hidden="true" />
      ) : (
        <Copy size={18} aria-hidden="true" />
      ),
      onClick: handleCopyMessage,
      bg: messageCopied ? "bg-emerald-600" : "bg-slate-600",
    },
  ];

  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 sm:rounded-2xl ${
        compact ? "p-4" : "p-4 sm:p-5"
      }`}
    >
      <h3
        className={`font-semibold text-slate-900 dark:text-white ${
          compact ? "text-[14px]" : "text-[14px] sm:text-[15px]"
        }`}
      >
        {t("pickedUp.share.title", { recipientFirstName })}
      </h3>
      <p
        className={`mt-0.5 text-slate-500 dark:text-slate-400 ${
          compact ? "text-[11px]" : "text-[12px] sm:text-[13px]"
        }`}
      >
        {t("pickedUp.share.subtitle")}
      </p>

      <div className="mt-3.5 grid grid-cols-4 gap-2.5">
        {channels.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={c.onClick}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-3 transition-colors hover:bg-slate-50 active:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
          >
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-full text-white ${c.bg}`}
              aria-hidden="true"
            >
              {c.icon}
            </span>
            <span className="text-center text-[10.5px] font-medium leading-tight text-slate-700 dark:text-slate-300 sm:text-[11px]">
              {c.label}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
