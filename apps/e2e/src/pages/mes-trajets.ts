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
import { expect, type Page } from "@playwright/test";
import { normaliserEspaces } from "./reservation";

export class MesTrajets {
  constructor(private readonly page: Page) {}

  async ouvrir(): Promise<void> {
    await this.page.goto("/fr/dashboard/trips", { waitUntil: "networkidle" });
    await expect(this.page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 60_000 });
  }

  /** La ligne d'un deal sous son trajet (dépliée au besoin), espaces normalisées. */
  async ligneDuDeal(dealId: string): Promise<string> {
    const ligne = this.page.locator(`a[href="/fr/carrier/deals/${dealId}"]`).first();
    if ((await ligne.count()) === 0 || !(await ligne.isVisible())) {
      const bascule = this.page.getByRole("button", { name: /^\d+ colis$/ }).first();
      if (await bascule.count()) await bascule.click();
    }
    await expect(ligne).toBeVisible({ timeout: 30_000 });
    return normaliserEspaces(await ligne.innerText());
  }

  /**
   * Tente d'annuler le trajet par le menu de sa ligne. Rend le toast obtenu : le refus D72
   * (« Ce trajet porte encore n deals en cours … ») ou « Trajet annulé ».
   */
  async tenterDAnnulerLeTrajet(corridor: string): Promise<{ statut: number; toast: string }> {
    const ligne = this.page.locator(`a[aria-label="${corridor}"]`).first().locator("xpath=..");
    await expect(ligne).toBeVisible({ timeout: 30_000 });
    await ligne.locator("button").last().click();
    await this.page.getByRole("button", { name: "Annuler", exact: true }).click();
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
