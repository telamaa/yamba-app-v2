/**
 * DealCarrierCharter.tsx
 * ======================
 * Charte Voyageur — encart ambre listant les 6 engagements + disclaimer.
 * Case à cocher en bas (obligatoire pour accepter).
 *
 * Utilise acceptTitle comme label simple de la checkbox (le pavé i18n
 * "acceptDescPrefix + Contract + Join + CGV + Suffix" pourra être branché
 * plus tard avec des liens cliquables).
 */

"use client";

import { AlertTriangle, Check, ScrollText } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

type Props = {
  accepted: boolean;
  onChangeAction: (checked: boolean) => void;
  hasError?: boolean;
  errorMessage?: string;
};

export default function DealCarrierCharter({
                                             accepted,
                                             onChangeAction,
                                             hasError = false,
                                             errorMessage,
                                           }: Props) {
  const t = useTranslations("carrierDealRequest");

  const engagements = [
    t("charter.verifyContent"),
    t("charter.refuseSuspicious"),
    t("charter.transportCarefully"),
    t("charter.deliverWithCode"),
    t("charter.respectCustoms"),
    t("charter.reportIncident"),
  ];

  const borderColor = hasError
    ? "border-red-400 dark:border-red-900"
    : "border-amber-200 dark:border-amber-900/40";

  return (
    <div
      className={`rounded-2xl border-2 bg-amber-50 p-4 transition-colors dark:bg-amber-950/30 ${borderColor}`}
    >
      <div className="mb-1 flex items-center gap-2 text-[13px] font-semibold text-amber-900 dark:text-amber-200">
        <ScrollText size={16} className="text-amber-700 dark:text-amber-400" />
        <span>{t("charter.title")}</span>
      </div>
      <p className="mb-3 text-[11px] uppercase tracking-wider text-amber-800/70 dark:text-amber-300/70">
        {t("charter.subtitle")}
      </p>

      <p className="mb-2 text-[13px] font-medium text-amber-900 dark:text-amber-100">
        {t("charter.intro")}
      </p>

      <ul className="mb-3 space-y-1.5">
        {engagements.map((engagement, i) => (
          <li
            key={i}
            className="flex items-start gap-2 text-[13px] leading-relaxed text-amber-900/90 dark:text-amber-200/90"
          >
            <span className="mt-1.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-700 dark:bg-amber-400" />
            <span>{parseBold(engagement)}</span>
          </li>
        ))}
      </ul>

      <p className="mb-4 text-[11px] italic leading-snug text-amber-800/80 dark:text-amber-300/80">
        {t("charter.disclaimer")}
      </p>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-300 bg-white p-3 hover:bg-amber-100/50 dark:border-amber-900/60 dark:bg-slate-950/70 dark:hover:bg-amber-950/30">
        <span
          className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 transition-colors ${
            accepted
              ? "border-amber-700 bg-amber-700 dark:border-amber-500 dark:bg-amber-500"
              : "border-amber-400 bg-white dark:border-amber-700 dark:bg-slate-900"
          }`}
        >
          {accepted && <Check size={13} className="text-white" strokeWidth={3} />}
        </span>
        <span className="flex-1 text-[13px] leading-snug text-amber-900 dark:text-amber-100">
          {t("charter.acceptTitle")}
        </span>
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => onChangeAction(e.target.checked)}
          className="sr-only"
        />
      </label>

      {hasError && errorMessage && (
        <div className="mt-2.5 flex items-center gap-1.5 text-[12px] text-red-700 dark:text-red-400">
          <AlertTriangle size={12} />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}

function parseBold(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-bold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}
