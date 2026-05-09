"use client";

import { useTranslations } from "next-intl";
import { AlertCircle, Plane } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { usePublicTrip } from "@/hooks/usePublicTrip";
import TripDetailView from "@/components/trips/detail/TripDetailView";

type Props = {
  tripId: string;
};

export default function TripDetailClient({ tripId }: Props) {
  const t = useTranslations("tripDetail");
  const { data: trip, isLoading, isError, error } = usePublicTrip(tripId);

  if (isLoading) {
    return <TripDetailSkeleton />;
  }

  if (isError || !trip) {
    const status = (error as any)?.response?.status;
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 py-12 text-center">
        <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-orange-100 text-[#B45309] dark:bg-orange-500/15 dark:text-[#FFB84D]">
          {status === 404 ? <Plane size={24} /> : <AlertCircle size={24} />}
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          {status === 404 ? t("notFound.title") : t("error.title")}
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {status === 404 ? t("notFound.description") : t("error.description")}
        </p>
        <Link
          href="/search"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#FF9900] px-5 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-[#F08700]"
        >
          {t("notFound.backToSearch")}
        </Link>
      </div>
    );
  }

  return <TripDetailView trip={trip} />;
}

/* -------------------------------------------------------------------------- */
/*                                   SKELETON                                  */
/* -------------------------------------------------------------------------- */

/**
 * Skeleton fidèle à la structure réelle de la page :
 * - Header (back + titre + sous-titre)
 * - Grid 1fr_360px en desktop :
 *    - Colonne gauche : bloc unifié avec ItineraryCard / CategoriesCard / ConditionsCard
 *    - Colonne droite (sticky) : BookingSummaryCard
 *
 * IMPORTANT :
 * - Mêmes classes que TripDetailView (max-w-7xl, grid-cols-[minmax(0,1fr)_360px])
 *   pour éviter tout saut de layout au switch skeleton → contenu.
 * - Pas de `lg:items-start` (cf. fix sticky).
 */
function TripDetailSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-32 pt-4 sm:px-6 sm:pt-6 lg:pb-12">
      {/* Back link */}
      <Shimmer className="mb-4 h-3 w-32" />

      {/* Header : titre + sous-titre */}
      <header className="mb-6 space-y-2">
        <Shimmer className="h-9 w-3/4 sm:h-10 sm:w-1/2" />
        <Shimmer className="h-4 w-48" />
      </header>

      {/* Grid principale */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* COLONNE GAUCHE — bloc unifié */}
        <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-950">
          <ItinerarySkeleton />
          <CategoriesSkeleton />
          <ConditionsSkeleton />
        </div>

        {/* COLONNE DROITE — sticky sur desktop */}
        <aside className="hidden lg:block">
          <BookingSummarySkeleton />
        </aside>
      </div>
    </div>
  );
}

/* ---------------------------------- ITINERAIRE ---------------------------- */

function ItinerarySkeleton() {
  return (
    <div className="space-y-6 px-5 py-5">
      {/* Header : date + 2 badges droite */}
      <div className="flex items-start justify-between gap-4">
        <Shimmer className="h-4 w-40" />
        <div className="flex flex-col items-end gap-1.5">
          <Shimmer className="h-5 w-24 rounded-full" />
          <Shimmer className="h-3 w-28" />
        </div>
      </div>

      {/* Timeline (2 points + ligne au milieu) */}
      <div className="flex min-h-40 gap-4">
        {/* Col 1 — heures */}
        <div className="flex w-12 flex-col items-end justify-between">
          <Shimmer className="h-5 w-10" />
          <Shimmer className="h-3 w-8" />
          <Shimmer className="h-5 w-10" />
        </div>

        {/* Col 2 — dots + line */}
        <div className="flex flex-col items-center self-stretch pt-2 pb-2">
          <div className="h-2.5 w-2.5 rounded-full border-2 border-slate-300 dark:border-slate-700" />
          <div className="my-1 w-px flex-1 bg-slate-200 dark:bg-slate-800" />
          <div className="h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        {/* Col 3 — villes */}
        <div className="flex flex-1 flex-col justify-between gap-2">
          <div className="space-y-1.5">
            <Shimmer className="h-5 w-32" />
            <Shimmer className="h-3 w-20" />
          </div>
          <div className="space-y-1.5">
            <Shimmer className="h-5 w-36" />
            <Shimmer className="h-3 w-24" />
          </div>
        </div>
      </div>

      {/* Bloc voyageur (-mx-5 px-5 + border-t qui prend toute la largeur) */}
      <div className="-mx-5 flex items-center gap-3 border-t border-slate-100 px-5 pt-5 dark:border-slate-800">
        <Shimmer className="h-12 w-12 shrink-0 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Shimmer className="h-4 w-40" />
          <Shimmer className="h-3 w-32" />
        </div>
      </div>

      {/* CO2 pill */}
      <Shimmer className="h-8 w-3/4 rounded-full" />

      {/* Bouton "Discuter avec X" */}
      <Shimmer className="h-10 w-full rounded-full" />
    </div>
  );
}

/* ---------------------------------- CATEGORIES ---------------------------- */

function CategoriesSkeleton() {
  return (
    <div className="px-5 py-5">
      {/* Titre + hint */}
      <div className="mb-4 space-y-1.5">
        <Shimmer className="h-4 w-44" />
        <Shimmer className="h-3 w-2/3" />
      </div>

      {/* Grille catégories — 1 col mobile, 2 col desktop */}
      <div className="grid grid-cols-1 gap-x-10 gap-y-4 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={`grid grid-cols-[auto_1fr_auto] items-center gap-3 ${
              i >= 3 ? "hidden sm:grid" : ""
            }`}
          >
            <Shimmer className="h-5 w-5 shrink-0" />
            <Shimmer className="h-4 w-full" />
            <Shimmer className="h-4 w-10" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------- CONDITIONS ---------------------------- */

function ConditionsSkeleton() {
  return (
    <div className="space-y-5 px-5 py-5">
      <Shimmer className="h-4 w-28" />

      {/* Politique d'annulation : 3 items */}
      <div>
        <Shimmer className="mb-3 h-3 w-32" />
        <div className="space-y-2.5">
          <Shimmer className="h-3 w-full" />
          <Shimmer className="h-3 w-5/6" />
          <Shimmer className="h-3 w-4/6" />
        </div>
      </div>

      {/* Objets interdits */}
      <div>
        <Shimmer className="mb-3 h-3 w-28" />
        <div className="space-y-1.5">
          <Shimmer className="h-3 w-full" />
          <Shimmer className="h-3 w-4/5" />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- BOOKING SUMMARY ----------------------- */

function BookingSummarySkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06),0_2px_8px_-2px_rgba(0,0,0,0.04)] dark:border-slate-800 dark:bg-slate-950">
      {/* "À PARTIR DE" + prix + hint */}
      <div className="space-y-2">
        <Shimmer className="h-3 w-20" />
        <Shimmer className="h-7 w-28" />
        <Shimmer className="h-3 w-36" />
      </div>

      {/* Bouton réserver */}
      <Shimmer className="mt-5 h-10 w-full rounded-full" />

      {/* Hint sous bouton */}
      <Shimmer className="mt-3 h-3 w-5/6" />

      {/* Trust strip 3 items */}
      <div className="mt-5 space-y-3 border-t border-slate-100 pt-5 dark:border-slate-800">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <Shimmer className="mt-0.5 h-4 w-4 shrink-0" />
            <Shimmer className="h-3 flex-1" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------- HELPER -------------------------------- */

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-slate-200 dark:bg-slate-800 ${
        className ?? ""
      }`}
    />
  );
}
