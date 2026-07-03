/**
 * DeliverHelpCard.tsx
 * ===================
 * Card d'aide collapsible "Marie ne se souvient plus du code ?" :
 * 3 tips (**bold** parsé) + boutons Écrire / Appeler Aminata.
 * Ouverte par défaut sur desktop, repliée sur mobile (compact).
 */

"use client";

import { ChevronDown, HelpCircle, MessageSquare, Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import type { DealShipper } from "@/components/carrier/deal/deal.types";

type Props = {
  shipper: DealShipper;
  recipientFirstName: string;
  compact?: boolean;
};

export default function DeliverHelpCard({
                                          shipper,
                                          recipientFirstName,
                                          compact = false,
                                        }: Props) {
  const t = useTranslations("carrierDealDeliver");
  const [collapsed, setCollapsed] = useState(compact);

  const shipperFirstName = shipper.firstName;

  const tips = compact
    ? [
      t("helpCard.tip1Short"),
      t("helpCard.tip2Short", { shipperFirstName }),
      t("helpCard.tip3Short"),
    ]
    : [
      t("helpCard.tip1", { shipperFirstName, recipientFirstName }),
      t("helpCard.tip2", { shipperFirstName }),
      t("helpCard.tip3"),
    ];

  const handleWrite = () => {
    // eslint-disable-next-line no-console
    console.info("[deliver] open message thread with", shipper.id);
  };
  const handleCall = () => {
    // eslint-disable-next-line no-console
    console.info("[deliver] call shipper", shipper.id);
  };

  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 sm:rounded-2xl ${
        compact ? "p-3.5" : "p-4 sm:p-5"
      }`}
    >
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        className="flex w-full items-center gap-2 text-left"
      >
        <HelpCircle
          size={15}
          className="flex-shrink-0 text-slate-500 dark:text-slate-400"
          aria-hidden="true"
        />
        <span
          className={`flex-1 font-semibold text-slate-900 dark:text-white ${
            compact ? "text-[13px]" : "text-[14px]"
          }`}
        >
          {t("helpCard.title", { recipientFirstName })}
        </span>
        <ChevronDown
          size={16}
          className={`flex-shrink-0 text-slate-500 transition-transform dark:text-slate-400 ${
            collapsed ? "-rotate-90" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {!collapsed && (
        <>
          <ul className="mt-3 space-y-1.5 sm:space-y-2">
            {tips.map((tip, i) => (
              <li
                key={i}
                className={`flex items-start gap-2 leading-relaxed text-slate-600 dark:text-slate-400 ${
                  compact ? "text-[12px]" : "text-[13px]"
                }`}
              >
                <span className="mt-1.5 inline-block h-1 w-1 flex-shrink-0 rounded-full bg-slate-400 dark:bg-slate-500" />
                <span>{parseBold(tip)}</span>
              </li>
            ))}
          </ul>

          <div className="mt-3.5 flex gap-2">
            <button
              type="button"
              onClick={handleWrite}
              className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-[12.5px] font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
            >
              <MessageSquare size={13} aria-hidden="true" />
              {compact
                ? t("helpCard.writeShort")
                : t("helpCard.writeToShipper", { shipperFirstName })}
            </button>
            <button
              type="button"
              onClick={handleCall}
              className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-[12.5px] font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
            >
              <Phone size={13} aria-hidden="true" />
              {compact
                ? t("helpCard.callShort")
                : t("helpCard.callShipper", { shipperFirstName })}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function parseBold(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold text-slate-800 dark:text-slate-200">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    )
  );
}
