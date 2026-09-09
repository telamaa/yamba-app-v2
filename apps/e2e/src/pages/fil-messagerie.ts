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
import { expect, type Page } from "@playwright/test";

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
    await expect(this.page.getByText("Le rendez-vous est confirmé.")).toBeVisible();
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
