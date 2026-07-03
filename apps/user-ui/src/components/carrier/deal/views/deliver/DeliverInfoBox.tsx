/**
 * DeliverInfoBox.tsx
 * ==================
 * - DeliverInfoBox : encart amber "Marie est devant toi ? Demande-lui le code..."
 * - DeliverRecipientRow : bande Marie Mboungou + téléphone + bouton appel
 */

"use client";

import { Info, Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { DealRecipient } from "@/components/carrier/deal/deal.types";

type InfoBoxProps = {
  shipperFirstName: string;
  recipientFirstName: string;
  compact?: boolean;
};

export function DeliverInfoBox({
                                 shipperFirstName,
                                 recipientFirstName,
                                 compact = false,
                               }: InfoBoxProps) {
  const t = useTranslations("carrierDealDeliver");

  const text = compact
    ? t("infoBoxShort", { recipientFirstName, shipperFirstName })
    : t("infoBox", { recipientFirstName, shipperFirstName });

  const boxClass =
    "flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/25 " +
    (compact ? "p-3.5" : "p-4");
  const textClass =
    "leading-relaxed text-amber-900 dark:text-amber-200 " +
    (compact ? "text-[12px]" : "text-[13px]");

  return (
    <div className={boxClass}>
      <Info
        size={15}
        className="mt-0.5 flex-shrink-0 text-amber-700 dark:text-amber-400"
        aria-hidden="true"
      />
      <p className={textClass}>{parseBold(text)}</p>
    </div>
  );
}

type RecipientRowProps = {
  recipient: DealRecipient;
  compact?: boolean;
};

export function DeliverRecipientRow({
                                      recipient,
                                      compact = false,
                                    }: RecipientRowProps) {
  const t = useTranslations("carrierDealDeliver");

  const initials = (
    (recipient.firstName[0] ?? "") + (recipient.lastName[0] ?? "")
  ).toUpperCase();
  const phoneDigits = recipient.phone.replace(/[^\d+]/g, "");
  const telHref = "tel:" + phoneDigits;

  const phoneLabel = compact
    ? recipient.phone
    : t("recipientRole") + " · " + recipient.phone;

  const rowClass =
    "flex items-center justify-between rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 sm:rounded-2xl " +
    (compact ? "p-3" : "p-3.5 sm:p-4");
  const avatarClass =
    "flex flex-shrink-0 items-center justify-center rounded-full bg-teal-700 font-semibold text-white dark:bg-teal-600 " +
    (compact ? "h-9 w-9 text-[12px]" : "h-10 w-10 text-[13px]");
  const nameClass =
    "truncate font-semibold text-slate-900 dark:text-white " +
    (compact ? "text-[13.5px]" : "text-[14px]");
  const metaClass =
    "truncate text-slate-500 dark:text-slate-400 " +
    (compact ? "text-[11px]" : "text-[12px]");
  const btnClass =
    "inline-flex flex-shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 " +
    (compact ? "h-9 w-9" : "h-10 w-10");

  return (
    <div className={rowClass}>
      <div className="flex min-w-0 items-center gap-3">
        <div className={avatarClass} aria-hidden="true">
          {initials}
        </div>
        <div className="min-w-0">
          <div className={nameClass}>
            {recipient.firstName} {recipient.lastName}
          </div>
          <div className={metaClass}>{phoneLabel}</div>
        </div>
      </div>
      <a href={telHref} aria-label={phoneLabel} className={btnClass}>
        <Phone size={compact ? 14 : 15} aria-hidden="true" />
      </a>
    </div>
  );
}

function parseBold(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    )
  );
}
