"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Bell, Sparkles, BellRing } from "lucide-react";
import CreateSavedRouteModal from "./CreateSavedRouteModal";
import type { PlaceDetails } from "@/components/search/CityAutocomplete";

type Props = {
  variant: "noResults" | "banner";
  /** Préremplit l'origine dans le modal de création */
  originCity?: string;
  /** Préremplit la destination dans le modal de création */
  destinationCity?: string;
  /** ✨ Si fournis, le modal n'oblige pas à re-sélectionner depuis l'autocomplete */
  originPlace?: PlaceDetails | null;
  destinationPlace?: PlaceDetails | null;
};

export default function SavedRouteCTA({
                                        variant,
                                        originCity,
                                        destinationCity,
                                        originPlace,
                                        destinationPlace,
                                      }: Props) {
  const t = useTranslations("savedRoutes.cta");
  const [modalOpen, setModalOpen] = useState(false);

  if (variant === "noResults") {
    return (
      <>
        <div className="rounded-2xl border-2 border-dashed border-[#FF9900]/40 bg-orange-50/50 p-8 text-center dark:border-orange-500/30 dark:bg-orange-500/5">
          <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#FF9900]/15 text-[#FF9900]">
            <BellRing size={22} strokeWidth={2.2} />
          </div>
          <h3 className="mb-2 text-base font-bold text-slate-900 dark:text-white">
            {t("noResultsTitle")}
          </h3>
          <p className="mx-auto mb-5 max-w-sm text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {t("noResultsDescription")}
          </p>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#FF9900] px-5 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-[#F08700]"
          >
            <Sparkles size={14} />
            {t("noResultsCta")}
          </button>
        </div>
        <CreateSavedRouteModal
          isOpen={modalOpen}
          closeAction={() => setModalOpen(false)}
          initialOriginCity={originCity}
          initialDestinationCity={destinationCity}
          initialOriginPlace={originPlace}
          initialDestinationPlace={destinationPlace}
        />
      </>
    );
  }

  // Variant "banner" — subtle bottom CTA
  return (
    <>
      <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-orange-50 text-[#FF9900] dark:bg-orange-500/15">
            <Bell size={16} strokeWidth={2.2} />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {t("bannerTitle")}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              {t("bannerDescription")}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#FF9900] px-4 py-2 text-xs font-bold text-slate-950 transition-colors hover:bg-[#F08700]"
        >
          <Sparkles size={12} />
          {t("bannerCta")}
        </button>
      </div>
      <CreateSavedRouteModal
        isOpen={modalOpen}
        closeAction={() => setModalOpen(false)}
        initialOriginCity={originCity}
        initialDestinationCity={destinationCity}
        initialOriginPlace={originPlace}
        initialDestinationPlace={destinationPlace}
      />
    </>
  );
}
