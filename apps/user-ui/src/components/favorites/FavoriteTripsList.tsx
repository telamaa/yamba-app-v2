"use client";

import { useTranslations } from "next-intl";
import { Heart, Search } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useFavoriteTrips } from "@/hooks/useFavoriteTrips";
import TripResultCard from "@/components/search/TripResultCard";
import TripResultCardMobile from "@/components/search/TripResultCardMobile";
import { Sk } from "@/components/dashboard/DashboardUI";

/** D46 — liste « Mes favoris » : mêmes cartes que la recherche, cœur plein. */
export default function FavoriteTripsList() {
  const t = useTranslations("favorites.list");
  const { data, isLoading, isError } = useFavoriteTrips();

  if (isLoading) {
    // Skeleton fidèle à la carte trajet (bandeau, corps ville/ligne/prix, pied Voyageur)
    return (
      <div className="space-y-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-2.5 dark:border-slate-800/60">
              <Sk className="h-6 w-20 rounded-full" />
              <Sk className="h-3 w-28" />
            </div>
            <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-4 px-4 py-3">
              <div><Sk className="h-4 w-24" /><Sk className="mt-1.5 h-3 w-14" /></div>
              <Sk className="h-px w-full" />
              <div className="flex flex-col items-end"><Sk className="h-4 w-24" /><Sk className="mt-1.5 h-3 w-14" /></div>
              <div className="flex flex-col items-end"><Sk className="h-6 w-20" /><Sk className="mt-1.5 h-3 w-16" /></div>
            </div>
            <div className="flex items-center gap-2.5 border-t border-slate-100 px-4 py-2.5 dark:border-slate-800/60">
              <div className="h-8 w-8 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
              <Sk className="h-3 w-32" />
            </div>
          </div>
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
            {/* ANO-WEB-30 (recette 5.11) — un favori survit à la fin du trajet, et le DIT */}
            {item.departureAt && new Date(item.departureAt) < new Date() && (
              <span className="mb-1.5 inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {t("pastTrip")}
              </span>
            )}
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
