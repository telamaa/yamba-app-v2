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
  {
    id: "photo-route",
    type: "photo",
    src: "/auth/visuals/photo-route.jpg",
    altFr: "Photo : une route au coucher de soleil",
    altEn: "Photo: a road at sunset",
  },
  {
    id: "photo-package",
    type: "photo",
    src: "/auth/visuals/photo-package.jpg",
    altFr: "Photo : un colis prêt à être expédié",
    altEn: "Photo: a package ready to be shipped",
  },
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
