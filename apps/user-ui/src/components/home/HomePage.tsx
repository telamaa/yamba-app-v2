"use client";

import HeroSection from "@/components/home/HeroSection";
import CorridorsSection from "@/components/home/CorridorsSection";
import HowItWorksSection from "@/components/home/HowItWorksSection";
import TrustSection from "@/components/home/TrustSection";
import FinalCtaSection from "@/components/home/FinalCtaSection";

/**
 * Accueil refondu (18/09) : six blocs, tous VRAIS.
 * Hero typographique → corridors réels (API) → comment ça marche (2 faces) →
 * confiance par les mécanismes du produit → CTA double persona.
 * Supprimés : statistiques inventées, témoignages fictifs, carte « en direct »
 * aux compteurs factices, photo iStock filigranée, grille de commission.
 */
export default function HomePage() {
  return (
    <>
      <HeroSection />
      <CorridorsSection />
      <HowItWorksSection />
      <TrustSection />
      <FinalCtaSection />
    </>
  );
}
