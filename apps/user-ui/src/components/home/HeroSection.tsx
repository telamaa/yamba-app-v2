"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

/**
 * Hero CLAIR (revue 18/09) : la coupure sombre/clair disparaît — la barre de
 * recherche et l'illustration s'intègrent sans couture, le sombre reste la
 * signature du CTA final. Deux colonnes : texte à gauche, illustration à
 * droite qui DESCEND jusqu'à la barre (marge négative : elle se glisse
 * derrière la carte de recherche qui la chevauche). La barre vit dans
 * HomePage : `position: sticky` ne colle que dans les bornes de son parent.
 */
export default function HeroSection() {
  const t = useTranslations("home.hero");

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#FFF6EA] via-white to-[#ECFAF7] dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      {/* Halos décoratifs — discrets sur fond clair, repères de marque */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-0 -z-0 h-80 w-80 rounded-full opacity-20 blur-3xl dark:opacity-25"
        style={{
          background: "radial-gradient(circle, #FF9900, transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-1/4 -z-0 h-80 w-80 rounded-full opacity-15 blur-3xl dark:opacity-20"
        style={{
          background: "radial-gradient(circle, #2DD4BF, transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 pb-12 pt-8 md:pb-6 md:pt-8">
        <div className="grid items-center gap-5 md:grid-cols-[1.2fr_1fr] md:gap-8">
          {/* Colonne texte — alignée à gauche */}
          <div className="pb-2 text-center md:pb-10 md:text-left">
            <h1 className="text-[24px] font-extrabold leading-[1.12] tracking-tight text-slate-900 dark:text-white md:text-3xl lg:text-4xl">
              {t("titleLine1")} {t("titleLine2")}{" "}
              <span className="yamba-grad-text">{t("titleHighlight")}</span>{" "}
              {t("titleEnd")}
            </h1>
            <p className="mx-auto mt-3 max-w-lg text-sm text-slate-600 dark:text-slate-300 md:mx-0 md:mt-4 md:text-base">
              {t("subtitle")}
            </p>

            {/* Passerelle Voyageur : l'autre face de la place de marché, dès le hero */}
            <div className="mt-4 md:mt-5">
              <Link
                href="/carrier/onboarding"
                className="text-[13px] font-semibold text-slate-600 underline-offset-4 transition-colors hover:text-slate-900 hover:underline dark:text-slate-300 dark:hover:text-white"
              >
                {t("travelerLink")} →
              </Link>
            </div>
          </div>

          {/* Illustration (desktop only) — descend jusqu'à la barre de recherche :
              la marge négative la fait plonger derrière la carte qui chevauche le hero */}
          <div className="hidden md:flex md:items-end md:justify-center md:self-end">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/images/home-hero-yamba.svg"
              alt={t("illustrationAlt")}
              className="-mb-10 w-full max-w-[300px] lg:max-w-[330px]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
