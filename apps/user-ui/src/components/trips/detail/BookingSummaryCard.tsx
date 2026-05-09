"use client";

import { useTranslations, useLocale } from "next-intl";
import { Lock, Shield, Leaf } from "lucide-react";
import { toast } from "sonner";
import type { PublicTrip } from "@/lib/public-trip.types";
import {
  getMinPriceCents,
  formatPrice,
  calculateCO2SavedKg,
} from "@/lib/public-trip.helpers";

type Props = {
  trip: PublicTrip;
};

export default function BookingSummaryCard({ trip }: Props) {
  const t = useTranslations("tripDetail");
  const locale = useLocale() as "fr" | "en";

  const minPriceCents = getMinPriceCents(trip);
  const formattedPrice = formatPrice(minPriceCents, trip.currencyCode, locale);
  const co2Saved = calculateCO2SavedKg(trip);

  const handleReserve = () => {
    toast(t("booking.comingSoon"), {
      description: t("booking.comingSoonDescription"),
    });
  };

  return (
    <div
      className="
        overflow-hidden rounded-2xl border border-slate-200 bg-white
        shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06),0_2px_8px_-2px_rgba(0,0,0,0.04)]
        transition-shadow duration-300
        hover:shadow-[0_8px_32px_-4px_rgba(0,0,0,0.08),0_4px_12px_-2px_rgba(0,0,0,0.06)]
        dark:border-slate-800 dark:bg-slate-950
        dark:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.4),0_2px_8px_-2px_rgba(0,0,0,0.3)]
        dark:hover:shadow-[0_8px_32px_-4px_rgba(0,0,0,0.5),0_4px_12px_-2px_rgba(0,0,0,0.4)]
      "
    >
      {/* Prix */}
      <div className="px-5 pt-5 pb-3">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {t("booking.startingFrom")}
        </div>
        <div className="mt-1 text-2xl font-black tabular-nums leading-none text-slate-900 dark:text-white">
          {formattedPrice}
        </div>
        <div className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          {t("booking.priceHint")}
        </div>
      </div>

      {/* CTA */}
      <div className="px-5 pb-4">
        <button
          type="button"
          onClick={handleReserve}
          className="w-full rounded-full bg-[#FF9900] px-4 py-2.5 text-sm font-bold text-slate-950 shadow-sm transition-all hover:bg-[#F08700] active:scale-[0.99]"
        >
          {t("booking.reserve")}
        </button>
      </div>

      {/* Trust strip */}
      <div className="space-y-2 border-t border-slate-100 px-5 py-3 dark:border-slate-800">
        <div className="flex items-start gap-2 text-[11px] leading-snug text-slate-600 dark:text-slate-400">
          <Lock size={11} className="mt-0.5 shrink-0 text-slate-400" />
          <span>
            {t("booking.trust.noCharge", { firstName: trip.tripper.firstName })}
          </span>
        </div>
        <div className="flex items-start gap-2 text-[11px] leading-snug text-slate-600 dark:text-slate-400">
          <Shield size={11} className="mt-0.5 shrink-0 text-slate-400" />
          <span>{t("booking.trust.protection")}</span>
        </div>
        {co2Saved != null && co2Saved > 0 && (
          <div className="flex items-start gap-2 text-[11px] leading-snug text-slate-600 dark:text-slate-400">
            <Leaf
              size={11}
              className="mt-0.5 shrink-0 text-green-600 dark:text-green-500"
            />
            <span>
              {t("booking.trust.co2", {
                kg: co2Saved
                  .toFixed(1)
                  .replace(".", locale === "fr" ? "," : "."),
              })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
