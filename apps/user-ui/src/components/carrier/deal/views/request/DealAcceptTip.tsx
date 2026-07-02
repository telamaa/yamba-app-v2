/**
 * DealAcceptTip.tsx
 * =================
 * Bloc bleu "Avant d'accepter" — rappels pratiques pour le Voyageur.
 * Variants : full (desktop) | compact (mobile).
 *
 * Les chaînes du JSON contiennent du **bold markdown** que l'on parse à la volée.
 */

"use client";

import { CheckCircle2, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

type Props = {
  shipperFirstName: string;
  compact?: boolean;
};

export default function DealAcceptTip({ shipperFirstName, compact = false }: Props) {
  const t = useTranslations("carrierDealRequest");

  if (compact) {
    const items = [
      t("acceptTip.checkContentShort"),
      t("acceptTip.refuseIfDiffersShort"),
      t("acceptTip.takePhotosShort"),
      t("acceptTip.codeShort"),
    ];

    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-900/40 dark:bg-blue-950/30">
        <div className="flex items-start gap-2.5">
          <Info size={14} className="mt-0.5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold text-blue-900 dark:text-blue-200">
              {t("acceptTip.titleShort")}
            </div>
            <ul className="mt-1.5 space-y-1">
              {items.map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-1.5 text-[11px] leading-snug text-blue-900/85 dark:text-blue-200/85"
                >
                  <span className="mt-1 inline-block h-1 w-1 flex-shrink-0 rounded-full bg-blue-600 dark:bg-blue-400" />
                  <span>{parseBold(item)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  const items = [
    t("acceptTip.checkContent"),
    t("acceptTip.refuseIfDiffers", { shipperFirstName }),
    t("acceptTip.takePhotos"),
    t("acceptTip.ownRisk"),
  ];

  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/40 dark:bg-blue-950/30">
      <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-blue-900 dark:text-blue-200">
        <Info size={15} className="text-blue-600 dark:text-blue-400" />
        <span>{t("acceptTip.title")}</span>
      </div>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li
            key={i}
            className="flex items-start gap-2 text-[13px] leading-relaxed text-blue-900/90 dark:text-blue-200/90"
          >
            <CheckCircle2
              size={14}
              className="mt-0.5 flex-shrink-0 text-blue-600 dark:text-blue-400"
            />
            <span>{parseBold(item)}</span>
          </li>
        ))}
      </ul>
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
