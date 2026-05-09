"use client";

import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
import type { PublicTrip } from "@/lib/public-trip.types";
import { getMinPriceCents, formatPrice } from "@/lib/public-trip.helpers";

type Props = {
  trip: PublicTrip;
};

export default function BookingMobileBar({ trip }: Props) {
  const t = useTranslations("tripDetail");
  const locale = useLocale() as "fr" | "en";

  const minPriceCents = getMinPriceCents(trip);
  const formattedPrice = formatPrice(minPriceCents, trip.currencyCode, locale);

  const handleReserve = () => {
    toast(t("booking.comingSoon"), {
      description: t("booking.comingSoonDescription"),
    });
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white px-4 py-3 shadow-[0_-4px_16px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-950 lg:hidden">
      <div className="mx-auto flex max-w-md items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t("booking.startingFrom")}
          </div>
          <div className="text-xl font-black tabular-nums text-slate-900 dark:text-white">
            {formattedPrice}
          </div>
        </div>
        <button
          type="button"
          onClick={handleReserve}
          className="flex-1 rounded-full bg-[#FF9900] px-4 py-3 text-sm font-bold text-slate-950 transition-all active:scale-[0.99]"
        >
          {t("booking.reserve")}
        </button>
      </div>
    </div>
  );
}
