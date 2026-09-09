/**
 * signalement-expediteur.ts — signaler un problème, et vivre le litige côté Expéditeur
 * ====================================================================================
 * (cahier 01-WEB, chapitre 5.21 et parcours WEB-E2E-2.)
 *
 * L'assistant de signalement (`/bookings/[id]/report`) a quatre blocs : le motif, le récit
 * (cinquante caractères au moins), les photos, la solution souhaitée — puis l'engagement sur
 * l'honneur, une confirmation, et un numéro de dossier `YAM-XXXX`. Ensuite le suivi du deal
 * raconte le litige : le dossier, la version du Voyageur (le fait, jamais le contenu), la
 * décision — et la page Finances porte le remboursement.
 *
 * Les « radios » et la case d'engagement sont habillées (`role=radio` / `role=checkbox` sur des
 * boutons) : on clique, on ne coche pas.
 */
import { expect, type Page } from "@playwright/test";
import { intercepterImageKit, photo } from "../fixtures/photos";

export type MotifSignalement =
  | "Contenu manquant ou différent de la déclaration"
  | "Colis ou contenu endommagé"
  | "Délai significativement dépassé"
  | "Autre problème";

export interface Signalement {
  motif: MotifSignalement;
  description: string;
  nbPhotos?: number;
  /** Le libellé commence par le texte donné (le montant suit dans le nom accessible). */
  solution?: RegExp;
}

export class SignalementExpediteur {
  constructor(private readonly page: Page) {}

  /** Étape 1 — le suivi d'un deal livré : bandeau, compte à rebours. */
  async ouvrirLeSuiviLivre(dealId: string): Promise<void> {
    await this.page.goto(`/fr/bookings/${dealId}`, { waitUntil: "networkidle" });
    await expect(this.page.getByText(/^Ton colis a été livré à /)).toBeVisible({ timeout: 60_000 });
    await expect(this.page.getByText(/VERSEMENT (AUTOMATIQUE )?DANS/)).toBeVisible();
  }

  /** Étape 2 — « Signaler un problème » : l'écran et ses quatre blocs. */
  async ouvrirLeSignalement(): Promise<void> {
    await intercepterImageKit(this.page);
    await this.page.getByRole("button", { name: "Signaler un problème" }).click();
    await expect(this.page).toHaveURL(/\/bookings\/[0-9a-f]{24}\/report$/, { timeout: 60_000 });
    await expect(this.page.getByRole("heading", { level: 1, name: "Signaler un problème" })).toBeVisible({ timeout: 60_000 });
    for (const bloc of ["Quel est le problème ?", "Raconte-nous ce qui s'est passé", "Ajoute des photos", "Ta solution souhaitée"]) {
      await expect(this.page.getByRole("heading", { name: bloc })).toBeVisible();
    }
  }

  /** Étape 3 — le motif. */
  async choisirLeMotif(motif: MotifSignalement): Promise<void> {
    const radio = this.page.getByRole("radio", { name: motif });
    await radio.click();
    await expect(radio).toHaveAttribute("aria-checked", "true");
  }

  /** Étape 4 — un récit trop court : le compteur le dit, et l'envoi est refusé (bouton inactif). */
  async ecrireTropCourt(texte: string): Promise<string> {
    await this.page.locator("textarea").first().fill(texte);
    const compteur = this.page.getByText(/^\d+ \/ minimum 50 caractères$/);
    await expect(compteur).toBeVisible();
    await expect(this.page.getByRole("button", { name: "Envoyer le signalement" })).toBeDisabled();
    return (await compteur.innerText()).trim();
  }

  /** Étape 5 — le dossier complet : récit, photos, solution, engagement ; le bouton devient actif. */
  async completerLeDossier(s: Signalement): Promise<void> {
    await this.page.locator("textarea").first().fill(s.description);
    await expect(this.page.getByText(/^\d+ caractères ✓$/)).toBeVisible();
    const fichier = this.page.locator('input[type="file"]');
    for (let i = 0; i < (s.nbPhotos ?? 0); i++) {
      await fichier.setInputFiles(photo("litige"));
      await expect(this.page.getByRole("button", { name: "Retirer cette photo" })).toHaveCount(i + 1);
    }
    await expect(this.page.getByText("Envoi de la photo…")).toHaveCount(0, { timeout: 30_000 });
    if (s.solution) await this.page.getByRole("radio", { name: s.solution }).click();
    await this.page.getByRole("checkbox", { name: /Je déclare sur l'honneur/ }).click();
    await expect(this.page.getByRole("button", { name: "Envoyer le signalement" })).toBeEnabled();
  }

  /** Étape 6 — envoi, confirmation, et le numéro de dossier. */
  async envoyer(): Promise<string> {
    await this.page.getByRole("button", { name: "Envoyer le signalement" }).click();
    await expect(this.page.getByText("Envoyer le signalement ?")).toBeVisible();
    const reponse = this.page.waitForResponse((r) => /\/deals\/[^/]+\/dispute$/.test(r.url()) && r.request().method() === "POST", { timeout: 60_000 });
    await this.page.getByRole("button", { name: "Oui, envoyer" }).click();
    const r = await reponse;
    if (!r.ok()) throw new Error(`Signalement refusé : ${r.status()} ${await r.text()}`);
    await expect(this.page.getByRole("heading", { name: "Signalement envoyé" })).toBeVisible({ timeout: 30_000 });
    const ticket = (await this.page.getByText(/^YAM-\d{4,6}$/).innerText()).trim();
    const corps = (await r.json()) as { ticketNumber?: string; status?: string };
    expect(corps.ticketNumber, "le numéro affiché est celui du serveur").toBe(ticket);
    expect(corps.status).toBe("DISPUTED");
    return ticket;
  }

  /** Le suivi pendant le litige : le dossier, et ce que l'on sait de la version du Voyageur. */
  async ouvrirLeSuiviEnLitige(dealId: string, ticket: string): Promise<{ texte: string }> {
    await this.page.goto(`/fr/bookings/${dealId}`, { waitUntil: "networkidle" });
    await expect(this.page.getByText(`Signalement en cours · dossier ${ticket}`)).toBeVisible({ timeout: 60_000 });
    await expect(this.page.getByRole("heading", { name: "Ton signalement" })).toBeVisible();
    return { texte: await this.page.locator("body").innerText() };
  }

  /** Étape 15 — la décision, telle que l'Expéditeur la lit. */
  async lireLaDecision(dealId: string): Promise<string> {
    await this.page.goto(`/fr/bookings/${dealId}`, { waitUntil: "networkidle" });
    await expect(this.page.getByText("Décision rendue")).toBeVisible({ timeout: 60_000 });
    await expect(this.page.getByText("Motif de la décision")).toBeVisible();
    return this.page.locator("body").innerText();
  }

  /** Étape 19 — Finances › Paiements : la ligne du deal. */
  async lignePaiement(prenomVoyageur: string): Promise<string> {
    await this.page.goto("/fr/dashboard/finances", { waitUntil: "networkidle" });
    await this.page.getByRole("button", { name: "Paiements" }).click();
    const ligne = this.page.getByRole("link", { name: new RegExp(`Envoi .*→ .*${prenomVoyageur}`) }).first();
    await expect(ligne).toBeVisible({ timeout: 60_000 });
    return ligne.innerText();
  }
}
