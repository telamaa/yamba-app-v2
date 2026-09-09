/**
 * notation.ts — la note croisée et sa révélation (cahier 01-WEB, chapitre 5.23)
 * =============================================================================
 * Le même écran sert aux deux rôles (`/bookings/[id]/rate` et `/carrier/deals/[id]/rate`) :
 * une note globale sur cinq (des boutons radio nommés « Décevant » … « Excellent »), des pouces
 * par critère, un commentaire facultatif. Les deux avis restent secrets jusqu'à ce que les deux
 * parties aient noté (ou quatorze jours) : le premier notant lit qu'il attend l'autre, le second
 * lit que « vos deux avis sont maintenant visibles ».
 */
import { expect, type Page } from "@playwright/test";

export type Etoiles = "Décevant" | "Moyen" | "Correct" | "Très bien" | "Excellent";

export interface Avis {
  etoiles: Etoiles;
  /** Les critères à marquer « Bien », par leur libellé exact (« Ponctualité au rendez-vous »…). */
  bien?: string[];
  commentaire?: string;
}

export class Notation {
  constructor(private readonly page: Page) {}

  /** Depuis l'écran du deal clos : « Noter {prénom} ». */
  async ouvrirDepuisLeDeal(prenom: string): Promise<void> {
    await this.page.getByRole("button", { name: `Noter ${prenom}` }).click();
    await expect(this.page).toHaveURL(/\/rate$/, { timeout: 60_000 });
    await expect(this.page.getByRole("radiogroup", { name: "Ta note globale" })).toBeVisible({ timeout: 60_000 });
  }

  /** Note, publie, et rend `true` si l'écran annonce que les deux avis sont désormais visibles. */
  async publier(avis: Avis): Promise<{ revele: boolean; texte: string }> {
    await this.page.getByRole("radio", { name: avis.etoiles }).click();
    for (const critere of avis.bien ?? []) {
      const pouce = this.page.getByRole("button", { name: `${critere} — Bien` });
      await pouce.click();
      await expect(pouce).toHaveAttribute("aria-pressed", "true");
    }
    if (avis.commentaire) await this.page.locator("textarea").first().fill(avis.commentaire);

    const reponse = this.page.waitForResponse((r) => /\/deals\/[^/]+\/rating$/.test(r.url()) && r.request().method() === "POST", { timeout: 60_000 });
    await this.page.getByRole("button", { name: "Publier mon avis" }).click();
    const r = await reponse;
    if (!r.ok()) throw new Error(`Avis refusé : ${r.status()} ${await r.text()}`);

    await expect(this.page.getByRole("heading", { name: "Merci pour ton retour !" })).toBeVisible({ timeout: 30_000 });
    const texte = await this.page.locator("body").innerText();
    return { revele: /vos deux avis sont maintenant visibles/.test(texte), texte };
  }
}
