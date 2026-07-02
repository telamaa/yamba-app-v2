/**
 * PickupHeader.tsx
 * ================
 * Header de l'écran pickup : back + titre + contexte lieu/heure + bouton aide.
 *  - Mobile : strip iOS-like 56px
 *  - Desktop : bandeau avec bordure basse
 */

"use client";

import { ArrowLeft, HelpCircle } from "lucide-react";
import { useTranslations } from "next-intl";

type Props = {
  locationName: string;
  timeHint?: string;
  onBackAction: () => void;
  variant: "desktop" | "mobile";
};

export default function PickupHeader({
                                       locationName,
                                       timeHint,
                                       onBackAction,
                                       variant,
                                     }: Props) {
  const t = useTranslations("carrierDealPickup");
  const subtitle = timeHint ? `${locationName} · ${timeHint}` : locationName;

  const handleHelp = () => {
    // TODO PR future : ouvrir le centre d'aide contextuel
    // eslint-disable-next-line no-console
    console.info("[pickup] open help");
  };

  if (variant === "mobile") {
    return (
      <div className="sticky top-0 z-10 flex h-14 items-center gap-1 border-b border-slate-200 bg-white px-2 dark:border-slate-800 dark:bg-slate-950">
        <button
          type="button"
          onClick={onBackAction}
          aria-label={t("back")}
          className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-slate-700 transition-colors hover:bg-slate-100 active:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-[15px] font-semibold text-slate-900 dark:text-white">
            {t("titleShort")}
          </div>
          <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
            {subtitle}
          </div>
        </div>
        <button
          type="button"
          onClick={handleHelp}
          aria-label={t("help")}
          className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <HelpCircle size={19} />
        </button>
      </div>
    );
  }

  // Desktop
  return (
    <div className="flex items-center justify-between border-b border-slate-200 px-6 py-3.5 dark:border-slate-800">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBackAction}
          aria-label={t("back")}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <div className="text-[15px] font-semibold text-slate-900 dark:text-white">
            {t("title")}
          </div>
          <div className="text-[12px] text-slate-500 dark:text-slate-400">
            {subtitle}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={handleHelp}
        aria-label={t("help")}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
      >
        <HelpCircle size={18} />
      </button>
    </div>
  );
}
