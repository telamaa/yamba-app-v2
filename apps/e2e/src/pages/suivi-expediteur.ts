/**
 * suivi-expediteur.ts — le suivi de l'envoi, vu par l'Expéditeur (cahier 01-WEB, 5.13, 5.17, 5.19)
 * ==============================================================================================
 * Une seule adresse, `/bookings/[id]`, dont le contenu suit le statut du deal : le lien de suivi
 * à partager dès l'acceptation, le **code à six chiffres** dès la prise en charge, la période de
 * vérification après la remise, puis « Transaction close » une fois confirmée.
 *
 * Les messages « Copier le message » ne sont écrits nulle part dans la page : ils partent au
 * presse-papiers, que le harnais observe (`fixtures/presse-papiers.ts`).
 */
import { expect, type Page } from "@playwright/test";
import { lirePressePapiers } from "../fixtures/presse-papiers";

export class SuiviExpediteur {
  constructor(private readonly page: Page) {}

  async ouvrir(dealId: string): Promise<void> {
    await this.page.goto(`/fr/bookings/${dealId}`, { waitUntil: "networkidle" });
    await expect(this.page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 60_000 });
  }

  /** Étape 14 — la carte « Partage le suivi à {prénom} » : le lien apparaît en clair dans la carte. */
  async creerLeLienDeSuivi(prenomDestinataire: string): Promise<{ url: string; message: string }> {
    const carte = this.page.locator("section").filter({ hasText: `Partage le suivi à ${prenomDestinataire}` });
    await expect(carte).toBeVisible({ timeout: 30_000 });
    const reponse = this.page.waitForResponse((r) => r.url().includes("/tracking-link") && r.request().method() === "POST");
    await carte.getByRole("button", { name: "Copier le message" }).click();
    const r = await reponse;
    if (!r.ok()) throw new Error(`Lien de suivi refusé : ${r.status()} ${await r.text()}`);
    const url = (await carte.getByText(/\/track\//).innerText()).trim();
    const message = await lirePressePapiers(this.page);
    return { url, message };
  }

  /** Étape 17 — le code à six chiffres, lu sur la carte « Code à transmettre à … ». */
  async lireLeCode(): Promise<string> {
    // Phase pickup : la carte monumentale « CODE À TRANSMETTRE À … » (aria-label chiffre par chiffre) ;
    // phase voyage (un jalon confirmé) : la carte compacte, le code en texte « 742 891 » (5.18).
    const monumental = this.page.getByLabel(/^\d( \d){5}$/);
    const compact = this.page.getByText(/^\d{3} \d{3}$/);
    await expect(monumental.or(compact).first()).toBeVisible({ timeout: 60_000 });
    if (await monumental.count()) return (await monumental.getAttribute("aria-label"))!.replace(/\s+/g, "");
    return (await compact.first().innerText()).replace(/\s+/g, "");
  }

  /**
   * 5.17 / 5.18 — une régénération complète par l'écran : « Régénérer le code », confirmation, réponse
   * DÉFINITIVE (le client rejoue après un 401 de session expirée), toast, nouveau code relu sur la carte.
   * Les toasts s'empilent cinq secondes : le dernier est le bon.
   */
  async regenerer(): Promise<{ nouveauCode: string; toast: string }> {
    const ancien = await this.lireLeCode();
    // « Régénérer le code » (phase pickup) ou « Régénérer » (carte compacte de la phase voyage).
    await this.page.getByRole("button", { name: /^Régénérer( le code)?$/ }).click();
    await expect(this.page.getByText("Régénérer le code ?")).toBeVisible();
    const reponse = this.page.waitForResponse((r) => /\/deals\/[^/]+\/code\/regenerate$/.test(r.url()) && r.request().method() === "POST" && r.status() !== 401, { timeout: 60_000 });
    await this.page.getByRole("button", { name: "Oui, régénérer" }).click();
    const r = await reponse;
    if (r.status() !== 200) throw new Error(`Régénération refusée : ${r.status()} ${await r.text()}`);
    const toast = this.page.getByText(/Nouveau code généré !/).last();
    await expect(toast).toBeVisible({ timeout: 10_000 });
    const texteToast = (await toast.innerText()).replace(/\s+/g, " ").trim();
    // La carte RELIT le serveur (invalidateQueries) : le nouveau code arrive un instant après le toast.
    await expect.poll(() => this.lireLeCode(), { timeout: 15_000, message: "la carte affiche le nouveau code" }).not.toBe(ancien);
    const nouveauCode = await this.lireLeCode();
    return { nouveauCode, toast: texteToast };
  }

  /** Étape 18 — « Copier le message » de la carte de partage du CODE (pas celle du lien). */
  async copierLeMessageDuCode(prenomDestinataire: string): Promise<string> {
    const carte = this.page.locator("section").filter({ hasText: `Partage le code à ${prenomDestinataire}` });
    await carte.getByRole("button", { name: "Copier le message" }).click();
    await expect(carte.getByRole("button", { name: "Message copié !" })).toBeVisible({ timeout: 10_000 });
    return lirePressePapiers(this.page);
  }

  /** Étape 22 — après la remise : la période de vérification et son compte à rebours. */
  async attendrePeriodeDeVerification(): Promise<void> {
    await expect(this.page.getByRole("heading", { name: "Période de vérification" })).toBeVisible({ timeout: 60_000 });
    await expect(this.page.getByText(/VERSEMENT (AUTOMATIQUE )?DANS/)).toBeVisible();
    await expect(this.page.getByRole("button", { name: "Signaler un problème" })).toBeVisible();
  }

  /** Étape 24 — la confirmation anticipée, en deux clics, puis « Transaction close ». */
  async confirmerLaLivraison(): Promise<void> {
    await this.page.getByRole("button", { name: "Confirmer la livraison" }).click();
    await expect(this.page.getByText("Confirmer définitivement ?")).toBeVisible();
    const reponse = this.page.waitForResponse((r) => /\/deals\/[^/]+\/confirm$/.test(r.url()) && r.request().method() === "POST", { timeout: 60_000 });
    await this.page.getByRole("button", { name: "Oui, tout est OK" }).click();
    const r = await reponse;
    if (!r.ok()) throw new Error(`Confirmation refusée : ${r.status()} ${await r.text()}`);
    await expect(this.page.getByText("Envoi terminé")).toBeVisible({ timeout: 60_000 });
    await expect(this.page.getByRole("heading", { name: "Transaction close" })).toBeVisible();
    await expect(this.page.getByRole("button", { name: "Signaler un problème" })).toHaveCount(0);
    await expect(this.page.getByText("Quelque chose ne va pas avec ce colis ?")).toHaveCount(0);
  }
}
