"use client";

import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Skeleton structuré pour TripSearchBar desktop.
 *
 * Mime fidèlement la structure de la barre :
 *  - 4 zones (From, Swap, To, Date) dans un grid 5 colonnes
 *  - Chaque zone a un label (petite ligne) + valeur (ligne plus large)
 *  - Bouton swap circulaire entre From et To
 *  - Bouton Search rectangulaire à droite
 *
 * Affiché uniquement sur md+ (desktop). Sur mobile, utiliser
 * MobileSearchExperienceSkeleton.
 *
 * À utiliser dans le wrapper de positionnement (fixed/sticky) géré par
 * la page parent — ce composant ne gère que le rendu de la barre elle-même.
 */
export default function TripSearchBarSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="grid items-stretch grid-cols-[1fr_36px_1fr_1fr_auto]">
        {/* From */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton className="h-3 w-12 rounded-md" />
          </div>
          <Skeleton className="mt-2 h-5 w-32 rounded-md" />
        </div>

        {/* Swap button */}
        <div className="flex items-center justify-center">
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>

        {/* To */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton className="h-3 w-16 rounded-md" />
          </div>
          <Skeleton className="mt-2 h-5 w-32 rounded-md" />
        </div>

        {/* Date */}
        <div className="px-4 py-3">
          <Skeleton className="h-3 w-10 rounded-md" />
          <div className="mt-2 flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded-md" />
            <Skeleton className="h-5 w-28 rounded-md" />
          </div>
        </div>

        {/* Search button */}
        <div className="flex items-center pr-3">
          <Skeleton className="h-11 w-28 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
