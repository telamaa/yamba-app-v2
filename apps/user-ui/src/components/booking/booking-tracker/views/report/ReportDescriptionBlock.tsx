/**
 * ReportDescriptionBlock.tsx
 * ==========================
 * Textarea de description avec compteur doux : gris sous le minimum,
 * emerald ✓ dès 50 caractères. Jamais de rouge (pas de culpabilisation).
 */

"use client";

import { useTranslations } from "next-intl";
import { DISPUTE_MIN_DESCRIPTION_LENGTH } from "@/components/booking/booking-tracker/booking-tracker.types";

type Props = {
  value: string;
  recipientFirstName: string;
  onChangeAction: (value: string) => void;
  compact?: boolean;
};

export default function ReportDescriptionBlock({
                                                 value,
                                                 recipientFirstName,
                                                 onChangeAction,
                                                 compact = false,
                                               }: Props) {
  const t = useTranslations("bookingTracker");

  const count = value.trim().length;
  const isOk = count >= DISPUTE_MIN_DESCRIPTION_LENGTH;

  const counterClass =
    "mt-1.5 text-right " +
    (compact ? "text-[10.5px]" : "text-[11px]") +
    " " +
    (isOk
      ? "font-medium text-emerald-700 dark:text-emerald-400"
      : "text-slate-400 dark:text-slate-500");

  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => onChangeAction(e.target.value)}
        placeholder={t("report.description.placeholder", { recipientFirstName })}
        rows={compact ? 4 : 5}
        className={
          "w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-[#FF9900] focus:outline-none focus:ring-2 focus:ring-[#FF9900]/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500 " +
          (compact ? "text-[13px]" : "text-[14px]")
        }
      />
      <div className={counterClass} aria-live="polite">
        {isOk
          ? t("report.description.counterOk", { count })
          : t("report.description.counterBelow", {
            count,
            min: DISPUTE_MIN_DESCRIPTION_LENGTH,
          })}
      </div>
    </div>
  );
}
