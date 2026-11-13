"use client";

/** Les trois mesures de la vague — RECOPIÉES du téléphone, à l'identique. */
const DOT_COUNT = 3;
const DOT_STAGGER_MS = 150;

type Props = {
  className?: string;
};

/**
 * Trois points qui respirent en vague — l'attente des boutons d'action.
 *
 * Le jumeau exact de `LoadingDots` dans `apps/mobile/src/components/auth/
 * auth-kit.tsx` : mêmes trois points, même cycle de 900 ms, même décalage de
 * 150 ms, même course (montée de 4 px, grossissement 0,85 → 1,15, opacité
 * 0,35 → 1). Les deux fronts attendent de la même façon, et une fiche le
 * vérifie — c'est par là que les deux applications se mettent à diverger.
 *
 * La vague PREND la place du libellé (arbitrage à l'écran du 13/11/2026,
 * après cinq dispositions essayées). Le bouton ne change pas de taille pour
 * autant : il est en pleine largeur. Comme le texte s'en va, l'appelant garde
 * le NOM du bouton avec un `sr-only` — sans quoi un lecteur d'écran n'annonce
 * plus que « bouton » pendant toute l'attente.
 *
 * `aria-hidden` : les points sont une décoration, ce qui parle aux lecteurs
 * d'écran est `aria-busy` sur le bouton.
 *
 * L'animation vit dans `app/global.css` (`.yamba-dot` + `@keyframes
 * yambaDot`), comme `yambaShimmer` pour `Skeleton` : ce dépôt ne déclare
 * aucun keyframe dans Tailwind. Une fiche garde les deux ensemble — un
 * composant dont l'animation est déclarée ailleurs se casse en silence.
 */
export default function LoadingDots({ className = "" }: Props) {
  return (
    <span
      className={`pointer-events-none inline-flex items-center gap-[7px] ${className}`}
      aria-hidden="true"
    >
      {Array.from({ length: DOT_COUNT }, (_, i) => (
        <span
          key={i}
          className="yamba-dot"
          style={{ animationDelay: `${i * DOT_STAGGER_MS}ms` }}
        />
      ))}
    </span>
  );
}
