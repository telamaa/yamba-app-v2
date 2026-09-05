/**
 * DealContactShipperCard.tsx
 * ==========================
 * Card amber "Contacte {shipper} pour fixer le rendez-vous".
 * Action prioritaire post-acceptation — utilise ContactActions du shared/.
 *
 * Variants :
 *  - full (desktop) : description complète avec contexte (vol + lieu)
 *  - compact (mobile) : description courte
 */

"use client";

import { MessageCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import ContactActions from "@/components/carrier/deal/shared/ContactActions";
import type { DealRequest } from "@/components/carrier/deal/deal.types";
import { useOpenDealThread } from "@/hooks/useMessaging";

type Props = {
  deal: DealRequest;
  compact?: boolean;
};

export default function DealContactShipperCard({ deal, compact = false }: Props) {
  const t = useTranslations("carrierDealAccepted");
  const locale = useLocale();

  const flightDate = formatDateLong(deal.trip.departureDate, locale);
  const pickupLocation = deal.pickupLocation.name;
  const shipperFirstName = deal.shipper.firstName;

  // Les deux boutons ouvrent le fil du deal (A137). « Appeler » y met le numéro en avant :
  // c'est le serveur qui décide de l'heure d'ouverture (2 h avant le rendez-vous, D61 3A).
  const thread = useOpenDealThread();
  const handleMessage = () => thread.open(deal.id);
  const handleCall = () => thread.open(deal.id, "phone");

  return (
    <section
      className={`rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 ${
        compact ? "p-3.5" : "p-4 sm:rounded-2xl sm:p-5"
      }`}
    >
      <div className={`flex items-start gap-3 ${compact ? "mb-3" : "mb-4"}`}>
        <div
          className={`flex flex-shrink-0 items-center justify-center rounded-full bg-amber-700 text-white dark:bg-amber-600 ${
            compact ? "h-8 w-8" : "h-9 w-9"
          }`}
        >
          <MessageCircle size={compact ? 14 : 16} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h3
            className={`font-semibold text-amber-950 dark:text-amber-100 ${
              compact ? "text-[14px]" : "text-[15px] sm:text-[16px]"
            }`}
          >
            {compact
              ? t("contactCard.titleShort", { shipperFirstName })
              : t("contactCard.title", { shipperFirstName })}
          </h3>
          <p
            className={`leading-relaxed text-amber-900/85 dark:text-amber-200/85 ${
              compact ? "mt-1 text-[12px]" : "mt-1.5 text-[13px] sm:text-[14px]"
            }`}
          >
            {compact
              ? t("contactCard.descriptionShort", { shipperFirstName, pickupLocation })
              : t("contactCard.description", {
                shipperFirstName,
                flightDate,
                pickupLocation,
              })}
          </p>
        </div>
      </div>

      <ContactActions
        contactFirstName={shipperFirstName}
        messageLabel={compact ? t("contactCard.messageShort") : t("contactCard.message")}
        callLabel={t("contactCard.call")}
        onMessageAction={handleMessage}
        onCallAction={handleCall}
        variant="amber"
        layout={compact ? "grid" : "row"}
        disabled={thread.isPending}
      />
    </section>
  );
}

function formatDateLong(iso: string, locale: string): string {
  const date = new Date(iso);
  const day = date.getDate();
  const month = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
    month: "long",
  }).format(date);
  return locale === "fr" ? `${day} ${month}` : `${month} ${day}`;
}
