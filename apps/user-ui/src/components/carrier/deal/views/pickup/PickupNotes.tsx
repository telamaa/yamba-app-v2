/**
 * PickupNotes.tsx
 * ===============
 * Bloc 4 — notes optionnelles du Voyageur (réserves, particularités).
 */

"use client";

import { useTranslations } from "next-intl";
import PickupBlock from "./PickupBlock";

type Props = {
  shipperFirstName: string;
  value: string;
  onChangeAction: (value: string) => void;
  compact?: boolean;
};

export default function PickupNotes({
                                      shipperFirstName,
                                      value,
                                      onChangeAction,
                                      compact = false,
                                    }: Props) {
  const t = useTranslations("carrierDealPickup");

  return (
    <PickupBlock
      num={3}
      state={value.trim().length > 0 ? "done" : "default"}
      title={
        <span>
          {t("notes.title")}{" "}
          <span
            className={`font-normal text-slate-400 dark:text-slate-500 ${
              compact ? "text-[11px]" : "text-[12px]"
            }`}
          >
            {t("notes.optional")}
          </span>
        </span>
      }
      sub={compact ? undefined : t("notes.sub")}
      compact={compact}
    >
      <textarea
        value={value}
        onChange={(e) => onChangeAction(e.target.value)}
        rows={compact ? 2 : 3}
        placeholder={
          compact
            ? t("notes.placeholderShort")
            : t("notes.placeholder", { shipperFirstName })
        }
        className={`w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white ${
          compact ? "min-h-[60px] text-[13px]" : "min-h-[80px] text-[14px]"
        }`}
      />
    </PickupBlock>
  );
}
