"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ShieldCheck, KeyRound, BadgeCheck } from "lucide-react";

/**
 * Hero deux colonnes (revue du 18/09) : texte aligné à gauche, illustration
 * SVG à droite (l'asset maison — les photos iStock filigranées sont parties).
 * La ligne de confiance ne cite que des mécanismes réels du produit — aucune
 * statistique inventée. La barre de recherche vit dans HomePage, PAS ici :
 * `position: sticky` ne colle que dans les bornes de son parent, et un hero
 * s'arrête trop tôt pour un collage « toute la page » à la Blablacar.
 */
export default function HeroSection() {
  const t = useTranslations("home.hero");

  return (
    <section className="yamba-hero-mesh relative overflow-hidden">
      {/* Blobs décoratifs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-20 -z-0 h-96 w-96 rounded-full opacity-30 blur-3xl"
        style={{
          background: "radial-gradient(circle, #FF9900, transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 top-1/3 -z-0 h-[500px] w-[500px] rounded-full opacity-20 blur-3xl"
        style={{
          background: "radial-gradient(circle, #2DD4BF, transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 py-10 md:py-14 lg:py-16">
        <div className="grid items-center gap-8 md:grid-cols-[1.15fr_1fr] md:gap-10 lg:gap-14">
          {/* Colonne texte — alignée à gauche */}
          <div className="text-center md:text-left">
            <h1 className="text-[28px] font-extrabold leading-[1.12] tracking-tight text-white md:text-4xl lg:text-5xl">
              {t("titleLine1")} {t("titleLine2")}{" "}
              <span className="yamba-grad-text">{t("titleHighlight")}</span>{" "}
              {t("titleEnd")}
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-sm text-slate-300 md:mx-0 md:mt-5 md:text-base">
              {t("subtitle")}
            </p>

            {/* Ligne de confiance : des mécanismes réels, pas des chiffres */}
            <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[12px] text-slate-300 md:justify-start">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-[#2DD4BF]" />
                {t("trust.escrow")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <KeyRound size={14} className="text-[#FF9900]" />
                {t("trust.code")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <BadgeCheck size={14} className="text-[#2DD4BF]" />
                {t("trust.verified")}
              </span>
            </div>

            {/* Passerelle Voyageur : l'autre face de la place de marché, dès le hero */}
            <div className="mt-5">
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
              className="w-full max-w-[440px]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
