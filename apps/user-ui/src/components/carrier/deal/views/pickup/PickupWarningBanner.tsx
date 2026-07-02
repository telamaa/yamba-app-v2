/**
 * PickupWarningBanner.tsx
 * =======================
 * Bandeau d'avertissement amber.
 *  - inset (desktop V3) : rounded, comme le banner vert de /bookings
 *  - flush (mobile) : edge-to-edge
 */

"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";

type Props = {
  variant?: "inset" | "flush";
  compact?: boolean;
};

export default function PickupWarningBanner({
                                              variant = "inset",
                                              compact = false,
                                            }: Props) {
  const t = useTranslations("carrierDealPickup");

  const containerClass =
    variant === "flush"
      ? "flex items-start gap-3 border-y border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/30"
      : "flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 dark:border-amber-900/40 dark:bg-amber-950/30";

  return (
    <div className={containerClass} role="alert">
      <AlertTriangle
        size={compact ? 16 : 18}
        className="mt-0.5 flex-shrink-0 text-amber-700 dark:text-amber-400"
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <div
          className={`font-semibold text-amber-950 dark:text-amber-100 ${
            compact ? "text-[13px]" : "text-[14px]"
          }`}
        >
          {compact ? t("warning.titleShort") : t("warning.title")}
        </div>
        <div
          className={`mt-0.5 leading-snug text-amber-900/85 dark:text-amber-200/85 ${
            compact ? "text-[11px]" : "text-[12px]"
          }`}
        >
          {compact ? t("warning.textShort") : t("warning.text")}
        </div>
      </div>
    </div>
  );
}
