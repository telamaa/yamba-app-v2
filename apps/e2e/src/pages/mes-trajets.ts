/**
 * mes-trajets.ts — « Mes trajets » du Voyageur : les deals d'un trajet, l'annulation refusée (D72)
 * ==============================================================================================
 * (cahier 01-WEB, chapitres 5.7 et 5.9.)
 *
 * Les deals d'un trajet sont repliés sous un bouton « n colis » ; chaque deal est une ligne vers
 * `/carrier/deals/[id]`. Le menu « … » de la ligne du trajet n'a ni texte ni `aria-label` : on
 * le trouve comme le dernier bouton de la ligne dont le lien porte le corridor. Annuler un
 * trajet qui porte encore un deal vivant est refusé (409 `TRIP_HAS_ACTIVE_DEALS`, D72) et
 * l'écran le dit, avec le nombre de deals.
 */
import { expect, type BrowserContext, type Page } from "@playwright/test";
import { adresseDeLApi } from "../fixtures/adresses";
import { normaliserEspaces } from "./reservation";

/**
 * Les kilos encore disponibles d'un trajet, lus à l'API (« Mes trajets » ne les affiche pas —
 * écart consigné en WEB-E2E-3). La vue du propriétaire (`{ success, trip }`) porte capacité et
 * réservé ; la vue publique porte `remainingKg`.
 */
export async function kilosRestants(contexte: BrowserContext, tripId: string): Promise<number> {
  const r = await contexte.request.get(`${adresseDeLApi()}/trips/${tripId}`);
  if (!r.ok()) throw new Error(`Trajet ${tripId} : ${r.status()} ${await r.text()}`);
  type Kilos = { remainingKg?: number; capacityKg?: number; reservedKg?: number };
  const corps = (await r.json()) as Kilos & { trip?: Kilos };
  const t: Kilos = corps.trip ?? corps;
  const kg = t.remainingKg ?? (typeof t.capacityKg === "number" ? t.capacityKg - (t.reservedKg ?? 0) : undefined);
  if (typeof kg !== "number") throw new Error(`Trajet ${tripId} : ni remainingKg ni capacityKg dans ${JSON.stringify(corps).slice(0, 200)}`);
  return kg;
}

export class MesTrajets {
  constructor(private readonly page: Page) {}

  async ouvrir(): Promise<void> {
    await this.page.goto("/fr/dashboard/trips", { waitUntil: "networkidle" });
    await expect(this.page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 60_000 });
  }

  /** La ligne d'un deal sous son trajet (dépliée au besoin), espaces normalisées. */
  async ligneDuDeal(dealId: string): Promise<string> {
    const ligne = this.page.locator(`a[href="/fr/carrier/deals/${dealId}"]`).first();
    // Chaque trajet replie ses deals derrière « n colis » (à venir, en cours, historique) : on déplie
    // jusqu'à voir la ligne — un deal terminé vit sous un trajet de l'historique (5.19).
    const bascules = this.page.getByRole("button", { name: /^\d+ colis$/ });
    for (let i = 0; i < (await bascules.count()) && !(await ligne.isVisible().catch(() => false)); i++) {
      await bascules.nth(i).click();
    }
    await expect(ligne).toBeVisible({ timeout: 30_000 });
    return normaliserEspaces(await ligne.innerText());
  }

  /**
   * Tente d'annuler le trajet par le menu de sa ligne. Rend le toast obtenu : le refus D72
   * (« Ce trajet porte encore n deals en cours … ») ou « Trajet annulé ».
   */
  async tenterDAnnulerLeTrajet(corridor: string, tripId?: string): Promise<{ statut: number; toast: string }> {
    // Plusieurs trajets peuvent porter le même corridor (Thomas en a trois Paris → Brazzaville) :
    // l'identifiant, quand il est donné, vise la bonne ligne par le `href` du lien.
    const lien = tripId
      ? this.page.locator(`a[aria-label="${corridor}"][href$="/dashboard/trips/${tripId}"]`)
      : this.page.locator(`a[aria-label="${corridor}"]`);
    const ligne = lien.first().locator("xpath=..");
    await expect(ligne).toBeVisible({ timeout: 30_000 });
    // Le menu « … » peut se refermer si la liste se re-rend juste après le clic (rafraîchissement
    // TanStack Query après les mutations des fiches précédentes) : on réessaie jusqu'à le voir.
    const entreeAnnuler = this.page.getByRole("button", { name: "Annuler", exact: true });
    await expect.poll(async () => {
      if (await entreeAnnuler.isVisible()) return true;
      await ligne.locator("button").last().click();
      await this.page.waitForTimeout(400);
      return entreeAnnuler.isVisible();
    }, { timeout: 20_000 }).toBe(true);
    await entreeAnnuler.click();
    await expect(this.page.getByRole("heading", { name: "Annuler ce trajet ?" })).toBeVisible({ timeout: 15_000 });
    // Le front annule par `DELETE /trips/:id` (alias de `POST /trips/:id/cancel`, Lot 2).
    const reponse = this.page.waitForResponse(
      (r) => (/\/trips\/[^/]+$/.test(r.url()) && r.request().method() === "DELETE") || (/\/trips\/[^/]+\/cancel$/.test(r.url()) && r.request().method() === "POST"),
      { timeout: 30_000 }
    );
    await this.page.getByRole("button", { name: "Annuler le trajet" }).click();
    const r = await reponse;
    const toast = this.page.getByText(/^Ce trajet porte encore .* deals? en cours|^Trajet annulé$/);
    await expect(toast.first()).toBeVisible({ timeout: 15_000 });
    return { statut: r.status(), toast: normaliserEspaces(await toast.first().innerText()) };
  }
}
