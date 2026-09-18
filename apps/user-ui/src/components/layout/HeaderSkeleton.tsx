// apps/user-ui/src/components/layout/HeaderSkeleton.tsx
"use client";

import HeaderLogo from "./header/HeaderLogo";
import HeaderLocaleSwitcher from "./header/HeaderLocaleSwitcher";
import HeaderThemeToggle from "./header/HeaderThemeToggle";
import HeaderShareTripCTA from "./header/HeaderShareTripCTA";
import { HEADER_Z_INDEX } from "./header/header.constants";

type Props = {
  isCompact?: boolean;
};

function ShimmerCircle({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-full bg-slate-200/90 dark:bg-slate-800/80 ${className}`}
    >
      <div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/70 to-transparent dark:via-white/10"
        style={{ animation: "yambaShimmer 1.6s infinite" }}
      />
    </div>
  );
}

/**
 * Skeleton du Header pendant le chargement initial de l'auth.
 *
 * Le logo, la langue, le thème et le CTA « Partager un trajet » sont STATIQUES :
 * ils s'affichent en vrai dès le premier rendu — un logo qui shimme dit « site
 * pas fini » sur toutes les pages (revue du 18/09). Seule la grappe
 * d'authentification (cloche, bulle, avatar OU « Connexion ») est inconnue tant
 * que `useUser` ne s'est pas résolu : trois pastilles rondes à sa place exacte,
 * mêmes conteneurs que le vrai Header (78px) — zéro saut quand il se résout.
 */
export default function HeaderSkeleton({ isCompact = false }: Props) {
  return (
    <header
      className="fixed inset-x-0 top-0 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85"
      style={{ zIndex: HEADER_Z_INDEX }}
    >
      <div
        className={`mx-auto flex h-[78px] max-w-7xl items-center justify-between px-4 transition-all ${
          isCompact ? "py-2" : "py-3"
        }`}
      >
        <div className="hidden md:flex">
          <HeaderLogo compact={isCompact} mobile={false} />
        </div>
        <div className="flex md:hidden">
          <HeaderLogo compact={isCompact} mobile={true} />
        </div>

        {/* Desktop : statique réel + grappe auth en pastilles */}
        <div className="hidden items-center gap-3 md:flex">
          <HeaderLocaleSwitcher variant="header" />
          <HeaderThemeToggle variant="icon" />
          <HeaderShareTripCTA variant="desktop" />
          <ShimmerCircle className="h-9 w-9" />
          <ShimmerCircle className="h-9 w-9" />
          <ShimmerCircle className="h-9 w-9" />
        </div>

        {/* Mobile : mêmes emplacements que le vrai header */}
        <div className="flex items-center gap-2 md:hidden">
          <ShimmerCircle className="h-7 w-7" />
          <ShimmerCircle className="h-7 w-7" />
          <ShimmerCircle className="h-9 w-9" />
        </div>
      </div>
    </header>
  );
}
