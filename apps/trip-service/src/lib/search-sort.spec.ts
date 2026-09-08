import { searchTripsQuerySchema } from "../dto/trip-search.dto";

/**
 * ANO-API-10 (recette API 08/09/2026, fiche API-TRIP-03) — un mode de transport inconnu
 * faisait répondre 400, alors que les catégories et les tranches horaires inconnues sont
 * ignorées silencieusement. Un lien partagé ou une ancienne version de l'application
 * portant un mode retiré du catalogue affichait une erreur au lieu d'une recherche.
 */
describe("filtre `mode` — une recherche dégrade, elle ne casse pas", () => {
  const parse = (q: Record<string, unknown>) => searchTripsQuerySchema.safeParse(q);

  it.each(["teleportation", "PLANE", "", "42"])("un mode inconnu (%p) retombe sur « all »", (mode) => {
    const r = parse({ mode });
    expect(r.success).toBe(true);
    expect(r.success && r.data.mode).toBe("all");
  });

  it.each(["all", "plane", "train", "car"])("un mode valide (%p) est conservé", (mode) => {
    const r = parse({ mode });
    expect(r.success && r.data.mode).toBe(mode);
  });

  it("absent → « all » (défaut inchangé)", () => {
    expect(parse({}).success && searchTripsQuerySchema.parse({}).mode).toBe("all");
  });

  it("les autres filtres restent tolérants, comme avant", () => {
    const r = searchTripsQuerySchema.parse({ categories: "clothes,inventee", departureBuckets: "matin,inconnu" });
    expect(r.categories).not.toContain("inventee");
    expect(r.departureBuckets).not.toContain("inconnu");
  });
});
