/**
 * finances.ts — « Finances » : Paiements (Expéditeur) et Portefeuille (Voyageur) (cahier 01-WEB, 5.26)
 * ==================================================================================================
 * Un seul écran, deux onglets ; l'onglet ouvert par défaut dépend du rôle. Chaque ligne est un
 * lien vers le deal : on la vise par ce lien, jamais par son texte — un membre peut avoir
 * plusieurs deals sur le même corridor. « Bloqué chez Yamba » est à la fois une carte de
 * statistique et un état de ligne : toujours lire DANS la ligne.
 */
import { expect, type Page } from "@playwright/test";
import { normaliserEspaces } from "./reservation";

export class Finances {
  constructor(private readonly page: Page) {}

  async ouvrir(onglet: "Paiements" | "Portefeuille"): Promise<void> {
    await this.page.goto("/fr/dashboard/finances", { waitUntil: "networkidle" });
    await expect(this.page.getByRole("heading", { level: 1, name: "Finances" })).toBeVisible({ timeout: 60_000 });
    await this.page.getByRole("button", { name: onglet, exact: true }).click();
  }

  /** Paiements — la ligne d'un envoi (`/bookings/[id]`), espaces normalisées. */
  async lignePaiement(dealId: string): Promise<string> {
    const ligne = this.page.locator(`a[href="/fr/bookings/${dealId}"]`).first();
    await expect(ligne).toBeVisible({ timeout: 60_000 });
    return normaliserEspaces(await ligne.innerText());
  }

  /** Portefeuille — la ligne d'un versement (`/carrier/deals/[id]`), espaces normalisées. */
  async ligneVersement(dealId: string): Promise<string> {
    const ligne = this.page.locator(`a[href="/fr/carrier/deals/${dealId}"]`).first();
    await expect(ligne).toBeVisible({ timeout: 60_000 });
    return normaliserEspaces(await ligne.innerText());
  }
}
