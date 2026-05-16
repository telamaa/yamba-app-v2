/**
 * BookingHeader.tsx
 * =================
 * Top header: back button + title + subtitle + close button.
 * Pulls its own translations; only the dynamic `subtitle` is passed in.
 */

"use client";

import { ArrowLeft, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { IconButton } from "./BookingFormUi";

type Props = {
  subtitle?: string;
  onBackAction: () => void;
  onCloseAction: () => void;
};

export default function BookingHeader({
                                        subtitle,
                                        onBackAction,
                                        onCloseAction,
                                      }: Props) {
  const t = useTranslations("booking");

  return (
    <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 md:px-6 md:py-4 dark:border-slate-800">
      <div className="flex items-center gap-3">
        <IconButton onClickAction={onBackAction} ariaLabel={t("back")}>
          <ArrowLeft size={18} />
        </IconButton>
        <div>
          <div className="text-[14px] font-medium md:text-[15px]">
            {t("title")}
          </div>
          {subtitle && (
            <div className="text-[11px] text-slate-400 md:text-[12px] dark:text-slate-500">
              {subtitle}
            </div>
          )}
        </div>
      </div>
      <IconButton onClickAction={onCloseAction} ariaLabel={t("close")}>
        <X size={18} />
      </IconButton>
    </div>
  );
}
