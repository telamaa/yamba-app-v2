"use client";

import { useTranslations } from "next-intl";
import { Heart, Search } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useFavoriteTrips } from "@/hooks/useFavoriteTrips";
import TripResultCard from "@/components/search/TripResultCard";
import TripResultCardMobile from "@/components/search/TripResultCardMobile";

/** D46 — liste « Mes favoris » : mêmes cartes que la recherche, cœur plein. */
export default function FavoriteTripsList() {
  const t = useTranslations("favorites.list");
  const { data, isLoading, isError } = useFavoriteTrips();

  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-500/30 dark:bg-red-500/10">
        <p className="text-sm text-red-700 dark:text-red-300">{t("errorMessage")}</p>
      </div>
    );
  }

  const trips = data?.trips ?? [];

  if (trips.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-orange-50 text-[#FF9900] dark:bg-orange-500/15">
          <Heart size={22} strokeWidth={2.2} />
        </div>
        <h3 className="mb-2 text-base font-bold text-slate-900 dark:text-white">{t("emptyTitle")}</h3>
        <p className="mx-auto mb-5 max-w-sm text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          {t("emptyDescription")}
        </p>
        <Link
          href="/search"
          className="inline-flex items-center gap-1.5 rounded-full bg-[#FF9900] px-5 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-[#F08700]"
        >
          <Search size={14} />
          {t("emptyCta")}
        </Link>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {t("count", { count: trips.length })}
      </p>
      <div className="space-y-3">
        {trips.map((item) => (
          <div key={item.id}>
            <div className="md:hidden">
              <TripResultCardMobile item={item} />
            </div>
            <div className="hidden md:block">
              <TripResultCard item={item} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
