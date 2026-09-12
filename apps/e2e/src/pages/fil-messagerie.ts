/**
 * fil-messagerie.ts — le fil du deal, le rendez-vous, le numéro (cahier 01-WEB, chapitre 5.15)
 * ===========================================================================================
 * Le fil vit dans le tableau de bord (`/dashboard/messages?conversation=…`), le même écran pour
 * les deux rôles. Le rendez-vous n'est pas un message : c'est un objet à part, proposé par l'un,
 * accepté par l'autre (D61). Le numéro de téléphone ne s'affiche qu'à partir de deux heures
 * avant le rendez-vous de remise confirmé.
 *
 * Le fil se rafraîchit seul toutes les 3 s : les attentes sur ce que l'AUTRE a fait laissent
 * ce délai passer, sans recharger la page.
 */
import { expect, type BrowserContext, type Page } from "@playwright/test";
import { adresseDeLApi } from "../fixtures/adresses";

export interface RendezVous {
  lieu: string;
  /** Format de l'`input type=datetime-local` : `AAAA-MM-JJTHH:mm`, heure locale. */
  debut: string;
  fin: string;
  precisions?: string;
}

/** Une date locale au format attendu par `datetime-local`. */
export function dateLocale(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export class FilMessagerie {
  constructor(private readonly page: Page) {}

  /**
   * L'identifiant du fil d'un deal, demandé à l'API avec les cookies du contexte — pour les
   * écrans qui n'ont pas de bouton vers le fil (un deal en litige, par exemple).
   */
  static async identifiantDuFil(contexte: BrowserContext, dealId: string): Promise<string> {
    const r = await contexte.request.get(`${adresseDeLApi()}/messages/conversations/by-deal/${dealId}`);
    if (!r.ok()) throw new Error(`Fil du deal ${dealId} : ${r.status()} ${await r.text()}`);
    const corps = (await r.json()) as { conversation?: { id?: string } };
    if (!corps.conversation?.id) throw new Error(`Fil du deal ${dealId} : réponse sans conversation.id`);
    return corps.conversation.id;
  }

  /** Depuis l'écran « Mon Deal accepté » du Voyageur : le bouton ouvre le fil, et on note son identifiant. */
  async ouvrirDepuisDealVoyageur(dealId: string): Promise<string> {
    await this.page.goto(`/fr/carrier/deals/${dealId}`, { waitUntil: "networkidle" });
    await this.page.getByRole("button", { name: /^Envoyer un message/ }).click();
    await expect(this.page).toHaveURL(/\/dashboard\/messages\?conversation=[0-9a-f]{24}/, { timeout: 60_000 });
    return new URL(this.page.url()).searchParams.get("conversation")!;
  }

  /** Ouvre un fil connu ; `focusNumero` reproduit l'arrivée par « Appeler » (bandeau du numéro). */
  async ouvrir(conversationId: string, focusNumero = false): Promise<void> {
    await this.page.goto(`/fr/dashboard/messages?conversation=${conversationId}${focusNumero ? "&focus=phone" : ""}`, { waitUntil: "networkidle" });
    await expect(this.page.getByPlaceholder("Écrire un message…")).toBeVisible({ timeout: 60_000 });
  }

  /** Un fil fermé par un litige : la phrase est là, la saisie n'est pas rendue du tout. */
  async ouvrirFermeParLeLitige(conversationId: string): Promise<void> {
    await this.page.goto(`/fr/dashboard/messages?conversation=${conversationId}`, { waitUntil: "networkidle" });
    await expect(this.page.getByText("Un litige est en cours : les échanges passent par la médiation.")).toBeVisible({ timeout: 60_000 });
    await expect(this.page.getByPlaceholder("Écrire un message…")).toHaveCount(0);
    await expect(this.page.getByRole("button", { name: "Envoyer", exact: true })).toHaveCount(0);
  }

  /** Écrit un message et attend qu'il apparaisse dans le fil (la requête, puis la bulle). */
  async envoyer(texte: string): Promise<void> {
    await this.page.getByPlaceholder("Écrire un message…").fill(texte);
    const reponse = this.page.waitForResponse((r) => /\/conversations\/[^/]+\/messages$/.test(r.url()) && r.request().method() === "POST", { timeout: 30_000 });
    await this.page.getByRole("button", { name: "Envoyer", exact: true }).click();
    const r = await reponse;
    if (!r.ok()) throw new Error(`Message refusé : ${r.status()} ${await r.text()}`);
    // L'aperçu de la liste reprend le texte : la bulle est la dernière occurrence.
    await expect(this.page.getByText(texte, { exact: true }).last()).toBeVisible({ timeout: 15_000 });
  }

  /** Le fil reste ouvert à l'écriture (deal clos depuis moins de 14 jours) : la saisie est là, aucun bandeau. */
  async ouvrirEncoreOuvert(conversationId: string): Promise<void> {
    await this.ouvrir(conversationId);
    await expect(this.page.getByText("Cette conversation est fermée à l'écriture. Vous pouvez toujours la relire.")).toHaveCount(0);
    await expect(this.page.getByText("Cette conversation est en lecture seule.")).toHaveCount(0);
  }

  async proposerRendezVous(rdv: RendezVous): Promise<void> {
    await this.page.getByRole("button", { name: "Proposer", exact: true }).click();
    await this.page.getByLabel("Lieu").fill(rdv.lieu);
    await this.page.getByLabel("Début").fill(rdv.debut);
    await this.page.getByLabel("Fin").fill(rdv.fin);
    if (rdv.precisions) await this.page.getByLabel("Précisions").fill(rdv.precisions);
    const reponse = this.page.waitForResponse((r) => r.url().includes("/meetups") && r.request().method() === "POST");
    await this.page.getByRole("button", { name: "Proposer ce rendez-vous" }).click();
    const r = await reponse;
    if (!r.ok()) throw new Error(`Proposition de rendez-vous refusée : ${r.status()} ${await r.text()}`);
    await expect(this.page.getByText("Un rendez-vous a été proposé.")).toBeVisible({ timeout: 15_000 });
    await expect(this.page.getByText("En attente de l'autre personne")).toBeVisible();
  }

  async accepterRendezVous(): Promise<void> {
    await expect(this.page.getByText("À confirmer par vous")).toBeVisible({ timeout: 15_000 });
    await this.page.getByRole("button", { name: "Accepter", exact: true }).click();
    await expect(this.page.getByText("Confirmé", { exact: true })).toBeVisible({ timeout: 15_000 });
    // Un fil peut porter plusieurs confirmations (re-proposition acceptée, ANO-WEB-47) : la dernière ligne système.
    await expect(this.page.getByText("Le rendez-vous est confirmé.").last()).toBeVisible();
  }

  /**
   * Demande le numéro trop tôt : le bandeau dit à partir de quand, le serveur refuse (400, code `TOO_EARLY`), et
   * aucun numéro ne s'affiche. Rend le texte du bandeau, pour le rapport.
   */
  async demanderLeNumeroTropTot(): Promise<string> {
    const bandeau = this.page.getByText(/Le numéro s'affiche à partir du /);
    await expect(bandeau).toBeVisible({ timeout: 15_000 });
    const reponse = this.page.waitForResponse((r) => r.url().includes("/phone") && r.request().method() === "POST");
    await this.page.getByRole("button", { name: "Voir le numéro" }).first().click();
    const r = await reponse;
    // Un refus métier porte un code, et ce code atteint le client (A146) : `TOO_EARLY`, en 400.
    expect(r.status(), "la révélation anticipée est refusée par le serveur").toBe(400);
    const corps = (await r.json().catch(() => ({}))) as { details?: { code?: string } };
    expect(corps.details?.code).toBe("TOO_EARLY");
    await expect(this.page.getByRole("button", { name: "Voir le numéro" }).first()).toBeVisible();
    return (await bandeau.innerText()).trim();
  }
}
