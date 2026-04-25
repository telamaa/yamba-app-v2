"use client";

type SkeletonProps = {
  className?: string;
};

/**
 * Primitive skeleton (shimmer block).
 *
 * Composant atomique utilisé comme building block pour composer des skeletons
 * plus complexes (cards, lignes de texte, avatars, boutons, etc.).
 *
 * IMPORTANT : ce composant nécessite que le keyframe CSS `yambaShimmer` soit
 * défini globalement sur la page parent. Définition standard :
 *
 * ```css
 * @keyframes yambaShimmer {
 *   0%   { transform: translateX(-100%); }
 *   100% { transform: translateX(100%); }
 * }
 * ```
 *
 * Tu peux soit l'inclure dans un `<style jsx global>` sur la page (comme
 * SearchResultsView.tsx), soit le mettre dans un CSS global du projet
 * (`apps/user-ui/src/app/globals.css`) pour qu'il soit disponible partout.
 *
 * @example
 * // Ligne de texte
 * <Skeleton className="h-4 w-24 rounded-md" />
 *
 * // Avatar
 * <Skeleton className="h-10 w-10 rounded-full" />
 *
 * // Bouton
 * <Skeleton className="h-9 w-28 rounded-xl" />
 *
 * // Card complète
 * <Skeleton className="h-40 w-full rounded-2xl" />
 */
export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={[
        "relative overflow-hidden rounded-xl",
        "bg-slate-200/90 dark:bg-slate-800/80",
        className,
      ].join(" ")}
    >
      <div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/70 to-transparent dark:via-white/10"
        style={{ animation: "yambaShimmer 1.6s infinite" }}
      />
    </div>
  );
}
