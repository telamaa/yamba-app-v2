/**
 * deal-voyageur.ts — la demande vue par le Voyageur (cahier 01-WEB, chapitre 5.14)
 * ================================================================================
 * Le pendant de l'assistant de réservation : ce que le Voyageur lit avant de s'engager, et les
 * deux seules issues qu'il a — accepter, ou refuser sans pénalité.
 */
import { expect, type Page } from "@playwright/test";
import { normaliserEspaces } from "./reservation";

export class DemandeVoyageur {
  constructor(private readonly page: Page) {}

  async ouvrir(dealId: string): Promise<void> {
    await this.page.goto(`/fr/carrier/deals/${dealId}`, { waitUntil: "networkidle" });
    await expect(this.page.getByText("Nouvelle demande de Deal")).toBeVisible({ timeout: 60_000 });
  }

  /**
   * Le gain net du Voyageur, tel que l'écran l'annonce.
   * L'écran écrit « TU GAGNES », puis le nombre et le symbole € dans DEUX nœuds distincts :
   * on lit donc le voisinage textuel, espaces normalisées, plutôt que de parier sur une
   * structure de balises qui n'est pas un contrat.
   */
  async gainAnnonce(): Promise<string> {
    await expect(this.page.getByText("TU GAGNES")).toBeVisible({ timeout: 30_000 });
    const corps = normaliserEspaces(await this.page.locator("body").innerText());
    const debut = corps.indexOf("TU GAGNES");
    return debut === -1 ? "" : corps.slice(debut, debut + 80);

  }

  /**
   * La Charte Voyageur : sans elle, le bouton de confirmation refuse.
   *
   * La case est **habillée** (la vraie `input` est masquée au profit d'un dessin) : `check()`
   * ne peut pas agir dessus. On clique donc le LIBELLÉ, ce que fait un humain — et ce que le
   * cahier décrit (« coche la Charte Voyageur »). L'apostrophe du libellé est typographique
   * dans l'interface : le motif ne parie pas dessus.
   */
  async accepterLaCharte(): Promise<void> {
    await this.page.getByText(/J.accepte la Charte Voyageur/).first().click();
    await expect(this.page.getByText("✓ Charte acceptée")).toBeVisible({ timeout: 15_000 });
  }

  /** Accepte, puis attend l'écran « Mon Deal accepté » — la preuve que l'engagement a pris. */
  async accepter(): Promise<void> {
    await this.page.getByRole("button", { name: /Accepter et confirmer/ }).click();
    await expect(this.page.getByText("Tu es engagé sur ce Deal")).toBeVisible({ timeout: 90_000 });
  }

  async refuser(): Promise<void> {
    await this.page.getByRole("button", { name: /^Refuser$/ }).click();
  }
}
