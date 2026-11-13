// apps/user-ui/src/components/layout/HeaderSkeleton.tsx
"use client";

import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import HeaderLogo from "./header/HeaderLogo";
import HeaderLocaleSwitcher from "./header/HeaderLocaleSwitcher";
import HeaderThemeToggle from "./header/HeaderThemeToggle";
import HeaderShareTripCTA from "./header/HeaderShareTripCTA";
import { HEADER_Z_INDEX } from "./header/header.constants";
import type { TunnelMode } from "@/lib/layout/tunnel";

type Props = {
  isCompact?: boolean;
  /**
   * Le régime de navigation de la page (D93). Le squelette DOIT le connaître :
   * il est monté en permanence (le `Header` le cache en `display: none`), donc
   * sans lui le tunnel affiche ses portes de sortie — CTA mangue compris —
   * pendant toute la résolution de `useUser`. Le tunnel de paiement portait ce
   * défaut depuis le 17/10 : la règle avait été posée dans le `Header` et pas
   * ici.
   */
  tunnel?: TunnelMode;
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
 * En tunnel, il n'y a RIEN à attendre : la grappe d'authentification ne s'y
 * affiche pas. Le squelette y rend donc l'en-tête définitif — pas une pastille,
 * pas un shimmer, zéro saut quand `useUser` se résout.
 *
 * Le logo, la langue, le thème et le CTA « Partager un trajet » sont STATIQUES :
 * ils s'affichent en vrai dès le premier rendu — un logo qui shimme dit « site
 * pas fini » sur toutes les pages (revue du 18/09). Seule la grappe
 * d'authentification (cloche, bulle, avatar OU « Connexion ») est inconnue tant
 * que `useUser` ne s'est pas résolu : trois pastilles rondes à sa place exacte,
 * mêmes conteneurs que le vrai Header (78px) — zéro saut quand il se résout.
 */
export default function HeaderSkeleton({
  isCompact = false,
  tunnel = "none",
}: Props) {
  const t = useTranslations("common.header");

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

        {tunnel === "checkout" ? (
          <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-slate-500 dark:text-slate-400">
            <Lock size={13} strokeWidth={2} />
            <span>{t("checkoutSecure")}</span>
          </div>
        ) : tunnel === "auth" ? (
          <div className="flex items-center gap-2 md:gap-3">
            <HeaderLocaleSwitcher variant="header" />
            <HeaderThemeToggle variant="icon" />
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>
    </header>
  );
}
