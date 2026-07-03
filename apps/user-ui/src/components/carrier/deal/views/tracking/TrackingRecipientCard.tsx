/**
 * TrackingRecipientCard.tsx
 * =========================
 * Card "Marie Mboungou · Destinataire" — LE contact de la phase transport.
 * Appeler (tel:) + WhatsApp (wa.me) réellement fonctionnels dès le mock.
 */

"use client";

import { MessageCircle, Phone, User } from "lucide-react";
import { useTranslations } from "next-intl";
import type { DealRecipient } from "@/components/carrier/deal/deal.types";

type Props = {
  recipient: DealRecipient;
  compact?: boolean;
};

export default function TrackingRecipientCard({ recipient, compact = false }: Props) {
  const t = useTranslations("carrierDealTracking");

  const phoneDigits = recipient.phone.replace(/[^\d+]/g, "");

  const handleCall = () => {
    window.location.href = `tel:${phoneDigits}`;
  };

  const handleWhatsApp = () => {
    // wa.me exige le numéro sans "+" ni espaces
    window.open(`https://wa.me/${phoneDigits.replace("+", "")}`, "_blank");
  };

  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 sm:rounded-2xl ${
        compact ? "p-4" : "p-4 sm:p-5"
      }`}
    >
      <div className="flex items-start gap-3">
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
            {compact
              ? t("recipientCard.titleShort", {
                recipientFirstName: recipient.firstName,
              })
              : t("recipientCard.title", {
                recipientFirstName: recipient.firstName,
                recipientLastName: recipient.lastName,
              })}
          </h3>
          <p
            className={`mt-0.5 leading-snug text-slate-500 dark:text-slate-400 ${
              compact ? "text-[11px]" : "text-[12px]"
            }`}
          >
            {compact
              ? t("recipientCard.subtitleShort", { city: recipient.city })
              : t("recipientCard.subtitle", { city: recipient.city })}
          </p>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={handleCall}
          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-[12.5px] font-semibold text-slate-800 transition-colors hover:bg-slate-50 active:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
        >
          <Phone size={13} aria-hidden="true" />
          <span className="truncate">{recipient.phone}</span>
        </button>
        <button
          type="button"
          onClick={handleWhatsApp}
          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-[12.5px] font-semibold text-slate-800 transition-colors hover:bg-slate-50 active:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
        >
          <MessageCircle size={13} aria-hidden="true" />
          {t("recipientCard.whatsapp")}
        </button>
      </div>
    </section>
  );
}
