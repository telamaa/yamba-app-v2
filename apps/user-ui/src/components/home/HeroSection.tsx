"use client";

import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { ShieldCheck, KeyRound, BadgeCheck } from "lucide-react";
import TripSearchBar from "@/components/search/TripSearchBar";

/**
 * Hero typographique, sans photo (refonte accueil 18/09) : le titre, la
 * recherche en vedette, et une ligne de confiance qui ne cite QUE des
 * mécanismes réels du produit — aucune statistique inventée.
 */
export default function HeroSection() {
  const router = useRouter();
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

      <div className="relative mx-auto max-w-4xl px-4 pt-12 text-center md:pt-16 lg:pt-20">
        <h1 className="mx-auto max-w-3xl text-[28px] font-extrabold leading-[1.12] tracking-tight text-white md:text-4xl lg:text-5xl">
          {t("titleLine1")} {t("titleLine2")}{" "}
          <span className="yamba-grad-text">{t("titleHighlight")}</span>{" "}
          {t("titleEnd")}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm text-slate-300 md:mt-5 md:text-base">
          {t("subtitle")}
        </p>

        {/* Spacer entre titre et search */}
        <div className="h-8 md:h-10" />
      </div>

      {/* Search bar — sticky avec mode auto + disableCompact pour rester en mode expanded */}
      {/* Recette 01-WEB 5.1 (WEB-ACC-9) : sans `onSearchAction`, « Rechercher » ne faisait qu'un
          console.log — le visiteur restait sur l'accueil. Le brouillon est déjà en sessionStorage
          (clé partagée) : la page de résultats l'interroge en arrivant. */}
      <TripSearchBar mode="auto" stickyOnScroll={true} disableCompact={true} onSearchAction={() => router.push("/search")} />

      {/* Ligne de confiance : des mécanismes réels, pas des chiffres */}
      <div className="relative mx-auto mt-7 flex max-w-3xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 text-[12px] text-slate-300 md:mt-8">
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

      {/* Passerelle Voyageur : l'autre face de la place de marché, visible dès le hero */}
      <div className="relative mt-5 pb-12 text-center md:pb-16">
        <Link
          href="/carrier/onboarding"
          className="text-[13px] font-semibold text-slate-300 underline-offset-4 transition-colors hover:text-white hover:underline"
        >
          {t("travelerLink")} →
        </Link>
      </div>
    </section>
  );
}
