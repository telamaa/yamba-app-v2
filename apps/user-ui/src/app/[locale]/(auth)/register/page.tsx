import RegisterForm from "@/components/auth/forms/RegisterForm";
import { getHeroVisualById } from "@/lib/auth/hero-visuals";

/**
 * D91 — l'inscription ne tire plus son visuel au hasard.
 *
 * Un visuel different a chaque chargement prive la page d'identite : deux
 * personnes qui la decouvrent ne voient pas le meme produit, et la qualite de
 * l'ecran varie selon le tirage. L'inscription prend donc CELUI qui dit ce
 * qu'on vient y faire — un colis qui voyage entre deux villes.
 *
 * Les autres pages auth gardent le tirage : leur revue n'a pas eu lieu.
 */
export default function RegisterPage() {
  const heroVisual = getHeroVisualById("illu-route");
  // Un identifiant qui ne correspond a rien doit CRIER : sans ce garde-fou, la
  // colonne de gauche s'afficherait vide et le defaut passerait en production.
  if (heroVisual === undefined) {
    throw new Error("Visuel auth introuvable : illu-route");
  }
  return <RegisterForm heroVisual={heroVisual} />;
}
