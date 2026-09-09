/**
 * litige-voyageur.ts — le litige vu par le Voyageur (cahier 01-WEB, 5.21 et WEB-E2E-2)
 * ====================================================================================
 * Le Voyageur apprend qu'un signalement est ouvert, lit le **motif seul** (jamais le récit ni
 * les photos de l'Expéditeur — A68), donne sa version une seule fois (cinquante caractères au
 * moins, des photos), puis lit la décision et **son** montant — jamais celui de l'autre.
 *
 * Il n'y a pas de bouton « Donner ma version » : le formulaire est déjà ouvert dans la carte
 * « Donne ta version » (le libellé du cahier est celui de l'email).
 */
import { expect, type Page } from "@playwright/test";
import { intercepterImageKit, photo } from "../fixtures/photos";

export class LitigeVoyageur {
  constructor(private readonly page: Page) {}

  /** Étapes 9 et 10 — le deal en litige : dossier, versement en attente, carte « Donne ta version ». */
  async ouvrir(dealId: string, ticket: string): Promise<string> {
    await intercepterImageKit(this.page);
    await this.page.goto(`/fr/carrier/deals/${dealId}`, { waitUntil: "networkidle" });
    await expect(this.page.getByText(`Signalement en cours · dossier ${ticket}`)).toBeVisible({ timeout: 60_000 });
    await expect(this.page.getByText(/Ton versement est mis en attente le temps de l'examen\./)).toBeVisible();
    await expect(this.page.getByRole("heading", { name: "Donne ta version" })).toBeVisible();
    return this.page.locator("body").innerText();
  }

  /** Étape 11 — moins de cinquante caractères : refusé. */
  async ecrireTropCourt(texte: string): Promise<void> {
    await this.page.getByPlaceholder(/^Ex : j'ai récupéré le colis/).fill(texte);
    await expect(this.page.getByText("Au moins 50 caractères.")).toBeVisible();
    await expect(this.page.getByRole("button", { name: "Envoyer ma version" })).toBeDisabled();
  }

  /** Étape 12 — la version, une photo, l'envoi ; puis « Version envoyée » et le bouton ne revient pas. */
  async donnerSaVersion(texte: string, options: { photo?: boolean } = {}): Promise<void> {
    await this.page.getByPlaceholder(/^Ex : j'ai récupéré le colis/).fill(texte);
    if (options.photo) {
      await this.page.locator('input[type="file"]').setInputFiles([photo("version")]);
      await expect(this.page.getByRole("button", { name: "Retirer la photo" })).toHaveCount(1, { timeout: 30_000 });
    }
    const envoyer = this.page.getByRole("button", { name: "Envoyer ma version" });
    await expect(envoyer).toBeEnabled({ timeout: 30_000 });
    const reponse = this.page.waitForResponse((r) => /\/deals\/[^/]+\/dispute\/statement$/.test(r.url()) && r.request().method() === "POST", { timeout: 60_000 });
    await envoyer.click();
    const r = await reponse;
    if (!r.ok()) throw new Error(`Version refusée : ${r.status()} ${await r.text()}`);
    await expect(this.page.getByText("Ta version est enregistrée.")).toBeVisible({ timeout: 15_000 });
    await expect(this.page.getByText("Version envoyée")).toBeVisible({ timeout: 15_000 });
    await this.page.reload({ waitUntil: "networkidle" });
    await expect(this.page.getByText("Version envoyée")).toBeVisible({ timeout: 60_000 });
    await expect(this.page.getByRole("button", { name: "Envoyer ma version" })).toHaveCount(0);
  }

  /** Étape 16 — la décision, telle que le Voyageur la lit. */
  async lireLaDecision(dealId: string): Promise<string> {
    await this.page.goto(`/fr/carrier/deals/${dealId}`, { waitUntil: "networkidle" });
    await expect(this.page.getByText("Décision rendue")).toBeVisible({ timeout: 60_000 });
    await expect(this.page.getByText("Motif de la décision")).toBeVisible();
    return this.page.locator("body").innerText();
  }
}
