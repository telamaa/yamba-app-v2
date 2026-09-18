"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ShieldCheck, KeyRound, BadgeCheck } from "lucide-react";
import HeroSection from "@/components/home/HeroSection";
import TripSearchBar from "@/components/search/TripSearchBar";
import CorridorsSection from "@/components/home/CorridorsSection";
import HowItWorksSection from "@/components/home/HowItWorksSection";
import TrustSection from "@/components/home/TrustSection";
import FinalCtaSection from "@/components/home/FinalCtaSection";

/**
 * Accueil refondu (18/09) : six blocs, tous VRAIS.
 * Hero compact → recherche en chevauchement, sticky PLEINE TAILLE au scroll →
 * ligne de confiance → corridors réels (API) → comment ça marche (2 faces) →
 * confiance par les mécanismes → CTA double persona.
 *
 * La barre de recherche est un enfant DIRECT du flux de page, pas un enfant
 * du hero : `position: sticky` ne colle que dans les bornes de son parent —
 * ici la colonne pleine page du layout, donc elle reste sous le header sur
 * TOUTE la hauteur. `disableCompact` : au scroll elle garde ses dimensions
 * (labels compris), seul le bandeau translucide apparaît. La marge négative
 * la fait chevaucher la frontière hero sombre / fond clair.
 */
export default function HomePage() {
  const router = useRouter();
  const t = useTranslations("home.hero");

  return (
    <>
      <HeroSection />
      <TripSearchBar
        mode="auto"
        stickyOnScroll={true}
        disableCompact={true}
        wrapperClassName="-mt-10 md:-mt-12"
        onSearchAction={() => router.push("/search")}
      />
      {/* Ligne de confiance sous la barre : des mécanismes réels, pas des chiffres */}
      <div className="mx-auto mt-4 flex max-w-4xl flex-wrap items-center justify-center gap-x-6 gap-y-1.5 px-4 text-[12px] text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck size={14} className="text-[#0F766E] dark:text-teal-400" />
          {t("trust.escrow")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <KeyRound size={14} className="text-[#FF9900]" />
          {t("trust.code")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <BadgeCheck size={14} className="text-[#0F766E] dark:text-teal-400" />
          {t("trust.verified")}
        </span>
      </div>
      <CorridorsSection />
      <HowItWorksSection />
      <TrustSection />
      <FinalCtaSection />
    </>
  );
}
