export type HeroVisualType = "illustration" | "photo";

export type HeroVisual = {
  id: string;
  type: HeroVisualType;
  src: string;
  altFr: string;
  altEn: string;
};

/**
 * Pool des visuels affichés sur la page auth.
 * Pour ajouter/retirer un visuel : modifier ce tableau uniquement.
 * Les fichiers correspondants doivent exister dans /public/auth/visuals/.
 */
export const HERO_VISUALS: HeroVisual[] = [
  {
    id: "illu-route",
    type: "illustration",
    src: "/auth/visuals/illu-route.svg",
    altFr: "Illustration : un colis voyageant entre deux villes",
    altEn: "Illustration: a package travelling between two cities",
  },
  {
    id: "illu-map",
    type: "illustration",
    src: "/auth/visuals/illu-map.svg",
    altFr: "Illustration : une carte de trajets connectés",
    altEn: "Illustration: a map of connected trips",
  },
  {
    id: "illu-connect",
    type: "illustration",
    src: "/auth/visuals/illu-connect.svg",
    altFr: "Illustration : un expéditeur et un transporteur connectés",
    altEn: "Illustration: a shipper and a carrier connected",
  },
  // Les deux photos JPG (photo-route, photo-package) ont été retirées le
  // 03/09/2026 : les fichiers n'existaient pas dans /public/auth/visuals/ →
  // 2 chargements sur 5 affichaient le texte alternatif (recette). À
  // réintroduire UNIQUEMENT avec les fichiers dans la même PR.
];

/**
 * Tirage aléatoire équiprobable côté serveur.
 * Appelé dans le Server Component pour figer le visuel avant l'envoi au client.
 */
export function pickRandomHeroVisual(): HeroVisual {
  if (HERO_VISUALS.length === 0) {
    throw new Error("HERO_VISUALS pool is empty");
  }
  const index = Math.floor(Math.random() * HERO_VISUALS.length);
  return HERO_VISUALS[index];
}

export function getHeroVisualById(id: string): HeroVisual | undefined {
  return HERO_VISUALS.find((v) => v.id === id);
}
