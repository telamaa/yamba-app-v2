"use client";

import { useRouter } from "@/i18n/navigation";
import HeroSection from "@/components/home/HeroSection";
import TripSearchBar from "@/components/search/TripSearchBar";
import CorridorsSection from "@/components/home/CorridorsSection";
import HowItWorksSection from "@/components/home/HowItWorksSection";
import TrustSection from "@/components/home/TrustSection";
import FinalCtaSection from "@/components/home/FinalCtaSection";

/**
 * Accueil refondu (18/09) : six blocs, tous VRAIS.
 * Hero deux colonnes → recherche sticky (à la Blablacar) → corridors réels
 * (API) → comment ça marche (2 faces) → confiance par les mécanismes du
 * produit → CTA double persona.
 *
 * La barre de recherche est un enfant DIRECT du flux de page, pas un enfant
 * du hero : `position: sticky` ne colle que dans les bornes de son parent —
 * ici la colonne pleine page du layout, donc elle reste sous le header sur
 * TOUTE la hauteur de l'accueil (WEB-ACC-9 : le brouillon part avec elle).
 */
export default function HomePage() {
  const router = useRouter();

  return (
    <>
      <HeroSection />
      <TripSearchBar
        mode="auto"
        stickyOnScroll={true}
        onSearchAction={() => router.push("/search")}
      />
      <CorridorsSection />
      <HowItWorksSection />
      <TrustSection />
      <FinalCtaSection />
    </>
  );
}
