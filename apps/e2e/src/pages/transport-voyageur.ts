/**
 * transport-voyageur.ts — la prise en charge, les jalons, la remise (cahier 01-WEB, 5.16 à 5.18)
 * ============================================================================================
 * Trois écrans du Voyageur, dans l'ordre du voyage :
 *
 *   - la **prise en charge** (`/carrier/deals/[id]/pickup`) : cinq points à cocher, au moins une
 *     photo, une note libre — c'est elle qui fait naître le code de livraison côté Expéditeur ;
 *   - les **jalons** (aéroport, décollage, atterrissage) : un seul bouton à la fois, et cinq
 *     secondes pour se raviser avant que la requête ne parte — le harnais attend la REQUÊTE,
 *     pas le temps ;
 *   - la **remise** (`/carrier/deals/[id]/deliver`) : six cases pour le code, une photo
 *     facultative, « Livraison validée ! » ;
 *   - le **refus au pickup** (WEB-E2E-5) : depuis l'écran de prise en charge, « Refuser le colis »,
 *     une raison facultative, et une fenêtre qui rappelle que ce refus ne pénalise jamais.
 *
 * Les cases à cocher sont habillées (`button[aria-pressed]`) : on clique le libellé.
 */
import { expect, type Page } from "@playwright/test";
import { intercepterImageKit, photo } from "../fixtures/photos";
import { normaliserEspaces } from "./reservation";

const POINTS_DE_CONTROLE = [/^Le contenu correspond/, /^Le poids me semble correspondre/, /^Aucun produit interdit/, /^L'emballage est correct/, /^J'ai vu et identifié/];

export class TransportVoyageur {
  constructor(private readonly page: Page) {}

  /** Étape 16 — coche les cinq points, ajoute `nbPhotos` photos, note, confirme. Rend le texte du toast. */
  async prendreEnCharge(dealId: string, options: { nbPhotos?: number; note?: string } = {}): Promise<string> {
    await intercepterImageKit(this.page);
    await this.page.goto(`/fr/carrier/deals/${dealId}/pickup`, { waitUntil: "networkidle" });
    await expect(this.page.getByRole("heading", { name: "Prise en charge du colis" })).toBeVisible({ timeout: 60_000 });

    for (const point of POINTS_DE_CONTROLE) {
      const bouton = this.page.getByRole("button", { name: point });
      await bouton.click();
      await expect(bouton).toHaveAttribute("aria-pressed", "true");
    }
    await expect(this.page.getByText("5/5")).toBeVisible();

    const fichier = this.page.locator('input[type="file"]');
    for (let i = 0; i < (options.nbPhotos ?? 1); i++) {
      await fichier.setInputFiles(photo("prise-en-charge"));
      await expect(this.page.getByRole("button", { name: "Retirer cette photo" })).toHaveCount(i + 1);
    }
    if (options.note) await this.page.getByPlaceholder(/^Ex : /).fill(options.note);

    const confirmer = this.page.getByRole("button", { name: "Confirmer la prise en charge" });
    await expect(confirmer).toBeEnabled();
    const reponse = this.page.waitForResponse((r) => /\/deals\/[^/]+\/pickup$/.test(r.url()) && r.request().method() === "POST", { timeout: 60_000 });
    await confirmer.click();
    const r = await reponse;
    if (!r.ok()) throw new Error(`Prise en charge refusée : ${r.status()} ${await r.text()}`);
    const toast = this.page.getByText(/^Prise en charge confirmée ! .+ a reçu son code de livraison\.$/);
    await expect(toast).toBeVisible({ timeout: 15_000 });
    const texte = await toast.innerText();
    // La page bascule d'elle-même sur le suivi du colis (statut PICKED_UP).
    await expect(this.page).toHaveURL(new RegExp(`/carrier/deals/${dealId}$`), { timeout: 60_000 });
    return texte;
  }

  /**
   * WEB-E2E-5 § 3-4 — ouvre l'écran de prise en charge, « Refuser le colis », choisit la raison,
   * confirme. Rend le texte de la fenêtre (pour le rappel « ne pénalise jamais ta réputation »),
   * le toast, et le remboursement annoncé par le serveur (intégral, D39/A40).
   *
   * Les deux habillages de la fenêtre (modale desktop, tiroir mobile) portent `role="dialog"` :
   * le tiroir fermé est `aria-hidden`, donc invisible aux rôles — on vise la fenêtre OUVERTE par
   * son titre. « Refuser le colis » est AUSSI le bouton du pied de page : on confirme DANS la fenêtre.
   */
  async refuserLeColis(dealId: string, raison: string): Promise<{ fenetre: string; toast: string; refundAmountCents: number; status: string }> {
    await this.page.goto(`/fr/carrier/deals/${dealId}/pickup`, { waitUntil: "networkidle" });
    await expect(this.page.getByRole("heading", { name: "Prise en charge du colis" })).toBeVisible({ timeout: 60_000 });
    await this.page.getByRole("button", { name: /^Refuser( le colis)?$/ }).first().click();

    const fenetre = this.page.getByRole("dialog").filter({ has: this.page.getByRole("heading", { name: "Refuser ce colis ?" }) });
    await expect(fenetre).toBeVisible({ timeout: 15_000 });
    const texte = normaliserEspaces(await fenetre.innerText());
    await fenetre.getByRole("radio", { name: raison }).check();

    const reponse = this.page.waitForResponse((r) => /\/deals\/[^/]+\/pickup\/refuse$/.test(r.url()) && r.request().method() === "POST", { timeout: 60_000 });
    await fenetre.getByRole("button", { name: "Refuser le colis" }).click();
    const r = await reponse;
    if (!r.ok()) throw new Error(`Refus au pickup refusé : ${r.status()} ${await r.text()}`);
    const corps = (await r.json()) as { status: string; refundAmountCents: number };
    const toast = this.page.getByText(/^Colis refusé\. .+ a été notifiée? et sera remboursée?\.$/);
    await expect(toast).toBeVisible({ timeout: 15_000 });
    return { fenetre: texte, toast: normaliserEspaces(await toast.innerText()), refundAmountCents: corps.refundAmountCents, status: corps.status };
  }

  /** Après la prise en charge, le numéro du destinataire est visible côté Voyageur (bouton d'appel). */
  async numeroDuDestinataireVisible(indicatif: string): Promise<void> {
    await expect(this.page.getByRole("button", { name: new RegExp(`\\${indicatif}`) }).first()).toBeVisible({ timeout: 30_000 });
  }

  /**
   * Étape 19 — un jalon : clic, toast « C'est noté ! », puis la requête part cinq secondes plus
   * tard. On attend la requête et on vérifie qu'elle a été acceptée — jamais un simple délai.
   */
  async confirmerJalon(libelle: "Je suis à l'aéroport" | "L'avion décolle" | "J'ai atterri"): Promise<void> {
    const bouton = this.page.getByRole("button", { name: libelle });
    await expect(bouton).toBeVisible({ timeout: 60_000 });
    const reponse = this.page.waitForResponse((r) => /\/deals\/[^/]+\/events$/.test(r.url()) && r.request().method() === "POST", { timeout: 30_000 });
    await bouton.click();
    // Le toast du jalon précédent (5 s) peut encore être affiché : on vise le plus récent.
    await expect(this.page.getByText(/^C'est noté ! .+ a été prévenue?\.$/).last()).toBeVisible({ timeout: 10_000 });
    const r = await reponse;
    if (!r.ok()) throw new Error(`Jalon « ${libelle} » refusé : ${r.status()} ${await r.text()}`);
  }

  async ouvrirSuivi(dealId: string): Promise<void> {
    await this.page.goto(`/fr/carrier/deals/${dealId}`, { waitUntil: "networkidle" });
  }

  /** Étape 21 — depuis le suivi, « Valider la livraison », le code case par case, une photo, validation. */
  async remettreContreLeCode(dealId: string, code: string, options: { photo?: boolean } = {}): Promise<{ versement: string }> {
    await intercepterImageKit(this.page);
    await this.page.getByRole("button", { name: "Valider la livraison" }).click();
    await expect(this.page).toHaveURL(new RegExp(`/carrier/deals/${dealId}/deliver$`), { timeout: 60_000 });
    await expect(this.page.getByRole("heading", { name: "Valide la livraison" })).toBeVisible({ timeout: 60_000 });

    if (options.photo) {
      await this.page.locator('input[type="file"]').setInputFiles(photo("remise"));
      await expect(this.page.getByRole("button", { name: "Retirer cette photo" })).toHaveCount(1);
      await expect(this.page.getByText("Envoi de la photo…")).toHaveCount(0, { timeout: 30_000 });
    }

    for (const [i, chiffre] of code.replace(/\s+/g, "").split("").entries()) {
      await this.page.getByLabel(`Chiffre ${i + 1}`).fill(chiffre);
    }
    const valider = this.page.getByRole("button", { name: "Valider la livraison" });
    await expect(valider).toBeEnabled({ timeout: 30_000 });
    const reponse = this.page.waitForResponse((r) => /\/deals\/[^/]+\/deliver$/.test(r.url()) && r.request().method() === "POST", { timeout: 60_000 });
    await valider.click();
    const r = await reponse;
    if (!r.ok()) throw new Error(`Remise refusée : ${r.status()} ${await r.text()}`);

    await expect(this.page.getByRole("heading", { name: "Livraison validée !" })).toBeVisible({ timeout: 30_000 });
    await expect(this.page.getByText("Ton versement arrive")).toBeVisible();
    const versement = await this.page.getByText(/partiront vers ton compte/).innerText();
    return { versement };
  }
}
