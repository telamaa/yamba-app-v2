import RegisterVerifyForm from "@/components/auth/forms/RegisterVerifyForm";
import { getHeroVisualById } from "@/lib/auth/hero-visuals";

export const dynamic = "force-dynamic";

/**
 * D92 — la vérification garde le visuel de l'inscription.
 *
 * Elle le tirait au hasard (`pickRandomHeroVisual`) : deux chances sur trois
 * que le décor CHANGE sous les pieds de l'utilisateur entre « je saisis mon
 * adresse » et « je saisis mon code ». La continuité visuelle est précisément
 * ce qui dit « tu es toujours dans le même geste » — et c'est le moment du
 * parcours où on en a le plus besoin, puisqu'on vient de quitter l'onglet
 * pour aller chercher un code ailleurs.
 *
 * Les autres pages auth gardent le tirage : leur revue n'a pas eu lieu (D91).
 */
export default function RegisterVerifyPage() {
  const heroVisual = getHeroVisualById("illu-route");
  // Un identifiant qui ne correspond a rien doit CRIER : sans ce garde-fou, la
  // colonne de gauche s'afficherait vide et le defaut passerait en production.
  if (heroVisual === undefined) {
    throw new Error("Visuel auth introuvable : illu-route");
  }
  return <RegisterVerifyForm heroVisual={heroVisual} />;
}
