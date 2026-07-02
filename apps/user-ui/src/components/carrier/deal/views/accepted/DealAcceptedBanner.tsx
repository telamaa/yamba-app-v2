/**
 * DealAcceptedBanner.tsx
 * ======================
 * Banner vert "Tu es engagé sur ce Deal" — confirmation visuelle forte
 * juste après l'acceptation, pleine largeur edge-to-edge.
 *
 * Variant :
 *  - inset (desktop) : marges intégrées au layout
 *  - flush (mobile) : edge-to-edge, pas de border-radius
 */

"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";

type Props = {
  shipperFirstName: string;
  variant?: "inset" | "flush";
};

export default function DealAcceptedBanner({
                                             shipperFirstName,
                                             variant = "inset",
                                           }: Props) {
  const t = useTranslations("carrierDealAccepted");

  const containerClass =
    variant === "flush"
      ? "flex items-center gap-3 border-y border-emerald-300 bg-emerald-50 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/30"
      : "flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 dark:border-emerald-900/40 dark:bg-emerald-950/30";

  const subtitleKey = variant === "flush" ? "banner.subtitleShort" : "banner.subtitle";

  return (
    <div className={containerClass} role="status">
      <div
        className={`flex flex-shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white dark:bg-emerald-600 ${
          variant === "flush" ? "h-7 w-7" : "h-9 w-9"
        }`}
      >
        <Check size={variant === "flush" ? 14 : 18} strokeWidth={3} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={`font-semibold text-emerald-950 dark:text-emerald-100 ${
            variant === "flush" ? "text-[13px]" : "text-[14px] sm:text-[15px]"
          }`}
        >
          {t("banner.title")}
        </div>
        <div
          className={`text-emerald-800 dark:text-emerald-300 ${
            variant === "flush" ? "text-[11px]" : "mt-0.5 text-[12px] sm:text-[13px]"
          }`}
        >
          {t(subtitleKey, { shipperFirstName })}
        </div>
      </div>
    </div>
  );
}
