"use client";

import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Skeleton structuré pour MobileSearchExperience mode "summary".
 *
 * Mime la card sticky mobile qui apparaît en haut de la page search :
 *  - Container arrondi (rounded-[22px]) avec ombre légère
 *  - Icône search à gauche
 *  - 2 lignes de texte (route + date)
 *  - Bouton "Filtres" à droite
 *
 * Affiché uniquement sur mobile (< md). Sur desktop, utiliser
 * TripSearchBarSkeleton.
 */
export default function MobileSearchExperienceSkeleton() {
  return (
    <div className="flex items-center gap-2">
      {/* Card principale (search summary) */}
      <div className="flex-1 rounded-[22px] border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center gap-3">
          <Skeleton className="h-[18px] w-[18px] shrink-0 rounded-md" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-40 rounded-md" />
            <Skeleton className="h-3 w-24 rounded-md" />
          </div>
        </div>
      </div>

      {/* Bouton Filtres */}
      <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center gap-2">
          <Skeleton className="h-[18px] w-[18px] rounded-md" />
          <Skeleton className="h-4 w-14 rounded-md" />
        </div>
      </div>
    </div>
  );
}
