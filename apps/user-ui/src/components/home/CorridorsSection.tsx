"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { searchTrips } from "@/services/trip.api";
import { countryName } from "@/lib/country-name";
import {
  TRIP_SEARCH_STORAGE_KEY,
  SEARCH_VERSION,
  type TripSearchValue,
} from "@/components/search/TripSearchBar";
import { seedPersistedFormState } from "@/hooks/usePersistedFormState";
import type { YambaTripResult } from "@/components/search/search-results.types";

const MAX_CORRIDORS = 6;

type Corridor = {
  fromCity: string;
  toCity: string;
  fromCountry: string | null;
  toCountry: string | null;
  count: number;
};

/**
 * Corridors dérivés des trajets PUBLIÉS réels (refonte accueil 18/09) :
 * remplace la carte « en direct » aux compteurs inventés. Chaque puce
 * préremplit le brouillon de recherche (même clé sessionStorage que la
 * barre, WEB-ACC-9) et ouvre la page de résultats. Aucun trajet → la
 * section disparaît, elle ne montre jamais du faux.
 */
function deriveCorridors(trips: YambaTripResult[], locale: string): Corridor[] {
  const byKey = new Map<string, Corridor>();
  for (const t of trips) {
    const key = `${t.fromCity}→${t.toCity}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      byKey.set(key, {
        fromCity: t.fromCity,
        toCity: t.toCity,
        fromCountry: countryName(t.fromCountryCode, locale, t.fromCountry),
        toCountry: countryName(t.toCountryCode, locale, t.toCountry),
        count: 1,
      });
    }
  }
  return [...byKey.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_CORRIDORS);
}

export default function CorridorsSection() {
  const t = useTranslations("home.corridors");
  const locale = useLocale();
  const router = useRouter();

  const { data } = useQuery({
    queryKey: ["home-corridors"],
    queryFn: () => searchTrips({ limit: 50 }),
    staleTime: 5 * 60 * 1000,
  });

  const corridors = useMemo(
    () => deriveCorridors(data?.trips ?? [], locale),
    [data?.trips, locale]
  );

  if (corridors.length === 0) return null;

  const openSearch = (c: Corridor) => {
    // Le brouillon partagé de la recherche (WEB-ACC-9) : /search le relit en arrivant.
    seedPersistedFormState<TripSearchValue>(
      TRIP_SEARCH_STORAGE_KEY,
      { from: c.fromCity, to: c.toCity, dateValue: null },
      SEARCH_VERSION
    );
    router.push("/search");
  };

  return (
    <section className="bg-white py-12 dark:bg-slate-950 md:py-16">
      <div className="mx-auto max-w-5xl px-4 text-center">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
          {t("label")}
        </span>
        <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white md:text-3xl">
          {t("title")}
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {t("subtitle")}
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {corridors.map((c) => (
            <button
              key={`${c.fromCity}→${c.toCity}`}
              type="button"
              onClick={() => openSearch(c)}
              className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#FF9900]/50 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-[#FF9900]/40"
            >
              <span className="text-[14px] font-semibold text-slate-900 dark:text-white">
                {c.fromCity}
                <span className="mx-1.5 text-[#FF9900]">→</span>
                {c.toCity}
              </span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                {t("tripCount", { count: c.count })}
              </span>
              <ArrowRight
                size={14}
                className="text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-[#FF9900] dark:text-slate-600"
              />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
