import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Dette D-3 du rapport de recette API (08/09/2026), fiche API-TRIP-18 — « supprimer est
 * idempotent ». La suppression d'un fichier ImageKit l'était (« File was already deleted. » en
 * 200) ; celle d'un DOCUMENT de trajet ne l'était pas : le second appel répondait **400
 * « Document not found. »**. Deux défauts dans un : un rejeu ressemblait à une erreur de saisie,
 * et le statut annonçait une faute du client là où il n'y en avait aucune.
 *
 * La règle retenue vaut pour toute suppression : **rejouée, elle répond 200**. L'appelant ne peut
 * pas distinguer « n'a jamais existé » de « déjà supprimé » — c'est voulu : cela ferme aussi la
 * porte à l'énumération d'identifiants.
 *
 * Ce test lit les sources plutôt que de monter un serveur : il vérifie que les handlers de
 * suppression ne rendent pas un refus sur l'absence, et que l'ordre des effets est le bon.
 */
describe("trip-service — une suppression rejouée n'est pas une erreur (D-3)", () => {
  const trip = readFileSync(join(__dirname, "../controllers/trip.controller.ts"), "utf-8");
  const upload = readFileSync(join(__dirname, "../controllers/upload.controller.ts"), "utf-8");

  /** Le corps de la fonction nommée, jusqu'à l'accolade de même niveau. */
  const corpsDe = (source: string, nom: string): string => {
    const debut = source.indexOf(`export const ${nom} =`);
    expect(debut).toBeGreaterThan(-1);
    const suivant = source.indexOf("\nexport const ", debut + 1);
    return source.slice(debut, suivant === -1 ? source.length : suivant);
  };

  it("supprimer un document absent répond 200, jamais un refus", () => {
    const corps = corpsDe(trip, "removeTripDocument");
    expect(corps).toContain("Document was already removed.");
    expect(corps).not.toContain('"Document not found."');
  });

  it("le document d'un AUTRE trajet est traité comme absent — aucune énumération possible", () => {
    const corps = corpsDe(trip, "removeTripDocument");
    // Une seule sortie pour les deux cas : `!doc` et `doc.tripId !== id`.
    expect(corps).toMatch(/if \(!doc \|\| doc\.tripId !== id\) \{\s*\n\s*return res\.status\(200\)/);
  });

  it("la base est supprimée AVANT le fichier : au pire un fichier orphelin, jamais une ligne morte", () => {
    const corps = corpsDe(trip, "removeTripDocument");
    const base = corps.indexOf("prisma.tripDocument.delete");
    const fichier = corps.indexOf("imagekit.deleteFile");
    expect(base).toBeGreaterThan(-1);
    expect(fichier).toBeGreaterThan(-1);
    expect(base).toBeLessThan(fichier);
  });

  it("l'échec du fournisseur ne fait pas échouer la suppression", () => {
    expect(corpsDe(trip, "removeTripDocument")).toMatch(/try \{\s*\n\s*await imagekit\.deleteFile/);
  });

  it("la route voisine garde sa convention, qui est la référence", () => {
    expect(corpsDe(upload, "deleteImageKitFile")).toContain("File was already deleted.");
  });
});
