/**
 * mediation-admin.ts — la médiation vue du back-office (cahier 02-ADMIN, chapitre 5.9)
 * ===================================================================================
 * La file « À arbitrer », le dossier d'un litige (les deux versions, l'argent, les photos), et
 * le formulaire « Trancher » : un choix, un montant pour le partiel, un motif d'au moins
 * cinquante caractères lu par les deux parties, un récapitulatif des flux, puis la validation
 * définitive. Le remboursement part avant la transaction ; le versement suit (D55).
 *
 * Le back-office n'est pas sur la `baseURL` du projet : adresses absolues.
 */
import { expect, type Page } from "@playwright/test";
import { adresseDuBackOffice } from "../fixtures/adresses";

export type IssueLitige = "PARTIAL_REFUND" | "FULL_REFUND" | "REJECTED";

export interface Decision {
  issue: IssueLitige;
  /** Pour le partiel : le montant en euros tel qu'on le tape (« 15,00 »). */
  montantEuros?: string;
  motif: string;
}

const LIBELLE_CHOIX: Record<IssueLitige, RegExp> = {
  PARTIAL_REFUND: /^Remboursement partiel/,
  FULL_REFUND: /^Remboursement total/,
  REJECTED: /^Rejet/,
};

export class MediationAdmin {
  constructor(private readonly page: Page) {}

  /** Depuis l'accueil, par le menu — comme le cahier le décrit. */
  async ouvrirLaFile(): Promise<void> {
    await this.page.goto(`${adresseDuBackOffice()}/home`, { waitUntil: "networkidle" });
    await this.page.locator("aside").getByRole("link", { name: "À arbitrer" }).click();
    await expect(this.page.getByRole("heading", { level: 1, name: "À arbitrer" })).toBeVisible({ timeout: 60_000 });
  }

  /** Le dossier, retrouvé dans la file par son numéro `YAM-XXXX`. Rend le bandeau de décidabilité. */
  async ouvrirLeDossier(ticket: string): Promise<string> {
    const ligne = this.page.getByRole("row", { name: new RegExp(ticket) });
    await expect(ligne, `le dossier ${ticket} est dans la file`).toBeVisible({ timeout: 30_000 });
    await ligne.getByRole("link", { name: ticket }).click();
    await expect(this.page.getByRole("heading", { level: 1, name: ticket })).toBeVisible({ timeout: 60_000 });
    return (await this.page.getByText(/Version du Voyageur (reçue|attendue)/).innerText()).trim();
  }

  /** Ce que le dossier montre — pour vérifier que les deux versions y sont, et rien de plus. */
  async texteDuDossier(): Promise<string> {
    return this.page.locator("body").innerText();
  }

  /**
   * Trancher : choix, montant (partiel), motif ≥ 50, récapitulatif des flux, validation.
   * Rend le récapitulatif et le panneau « Décision enregistrée », pour le rapport.
   */
  async trancher(decision: Decision): Promise<{ recapitulatif: string; resultat: string }> {
    await this.page.getByRole("radio", { name: LIBELLE_CHOIX[decision.issue] }).check();
    if (decision.issue === "PARTIAL_REFUND") {
      await this.page.getByPlaceholder("ex. 15,00").fill(decision.montantEuros ?? "");
    }
    await this.page.getByPlaceholder("Ce que les preuves montrent, ce qui a pesé, ce qui est décidé.").fill(decision.motif);
    await expect(this.page.getByText(/^\d+ \/ 50 min$/)).toBeVisible();

    await this.page.getByRole("button", { name: "Voir le récapitulatif" }).click();
    const panneau = this.page.getByText("Récapitulatif des flux, avant validation définitive");
    await expect(panneau).toBeVisible();
    const recapitulatif = await panneau.locator("xpath=..").innerText();

    const reponse = this.page.waitForResponse((r) => /\/admin\/disputes\/[^/]+\/resolve$/.test(r.url()) && r.request().method() === "POST", { timeout: 60_000 });
    await this.page.getByRole("button", { name: "Valider définitivement" }).click();
    const r = await reponse;
    if (!r.ok()) throw new Error(`Décision refusée : ${r.status()} ${await r.text()}`);

    await expect(this.page.getByRole("heading", { name: "Décision enregistrée" })).toBeVisible({ timeout: 30_000 });
    await expect(this.page.getByText("Les deux parties sont prévenues (écran, notification, email).")).toBeVisible();
    const resultat = await this.page.getByRole("heading", { name: "Décision enregistrée" }).locator("xpath=..").innerText();
    return { recapitulatif, resultat };
  }
}
