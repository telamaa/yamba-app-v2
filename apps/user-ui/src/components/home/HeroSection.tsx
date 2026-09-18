"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

/**
 * Hero compact aux proportions Blablacar, identité sombre Yamba (revue 18/09) :
 * titre à gauche, illustration à droite, et c'est tout — la ligne de confiance
 * vit SOUS la barre de recherche (HomePage), le hero respire. La barre elle-même
 * vit dans HomePage : `position: sticky` ne colle que dans les bornes de son
 * parent, un hero s'arrête trop tôt. Le `pb` supplémentaire réserve la place du
 * chevauchement de la barre (marge négative posée par HomePage).
 */
export default function HeroSection() {
  const t = useTranslations("home.hero");

  return (
    <section className="yamba-hero-mesh relative overflow-hidden">
      {/* Blobs décoratifs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-10 -z-0 h-80 w-80 rounded-full opacity-30 blur-3xl"
        style={{
          background: "radial-gradient(circle, #FF9900, transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 top-1/4 -z-0 h-96 w-96 rounded-full opacity-20 blur-3xl"
        style={{
          background: "radial-gradient(circle, #2DD4BF, transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-8 md:pb-20 md:pt-10">
        <div className="grid items-center gap-6 md:grid-cols-[1.15fr_1fr] md:gap-10">
          {/* Colonne texte — alignée à gauche */}
          <div className="text-center md:text-left">
            <h1 className="text-[26px] font-extrabold leading-[1.12] tracking-tight text-white md:text-4xl lg:text-[44px]">
              {t("titleLine1")} {t("titleLine2")}{" "}
              <span className="yamba-grad-text">{t("titleHighlight")}</span>{" "}
              {t("titleEnd")}
            </h1>
            <p className="mx-auto mt-3 max-w-lg text-sm text-slate-300 md:mx-0 md:mt-4 md:text-base">
              {t("subtitle")}
            </p>

            {/* Passerelle Voyageur : l'autre face de la place de marché, dès le hero */}
            <div className="mt-4 md:mt-5">
              <Link
                href="/carrier/onboarding"
                className="text-[13px] font-semibold text-slate-300 underline-offset-4 transition-colors hover:text-white hover:underline"
              >
                {t("travelerLink")} →
              </Link>
            </div>
          </div>

          {/* Illustration (desktop only) */}
          <div className="hidden md:flex md:items-center md:justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/images/home-hero-yamba.svg"
              alt={t("illustrationAlt")}
              className="w-full max-w-[360px] lg:max-w-[400px]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
