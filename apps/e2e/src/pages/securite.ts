/**
 * securite.ts — « Sécurité » : mes données, sessions actives, suppression du compte (5.30, 5.31)
 * =============================================================================================
 * Trois gestes sensibles sur une même page. L'export passe la porte par code (sudo, D65) et
 * déclenche un vrai téléchargement (ancre `download` sur un blob). La suppression, elle, est
 * bloquée AVANT toute porte quand quelque chose est en cours : le bandeau ambre, les motifs, et
 * aucun code envoyé — c'est le front qui le garantit (il n'appelle jamais la porte).
 *
 * La fenêtre « Ta session a expiré » se pose par-dessus la page : la reconnexion se fait dans
 * la fenêtre, et la page ne bouge pas.
 */
import { expect, type Page } from "@playwright/test";
import type { Mailpit } from "../fixtures/mailpit";
import { normaliserEspaces } from "./reservation";

export class Securite {
  constructor(private readonly page: Page) {}

  async ouvrir(): Promise<void> {
    await this.page.goto("/fr/dashboard/security", { waitUntil: "networkidle" });
    await expect(this.page.getByRole("heading", { name: "Sessions actives" })).toBeVisible({ timeout: 60_000 });
  }

  /** Étape 10 — l'export : la porte par code, puis le fichier téléchargé (chemin local). */
  async telechargerMesDonnees(email: string, mailpit: Mailpit): Promise<string> {
    await this.page.getByRole("button", { name: "Télécharger", exact: true }).click();
    const premier = this.page.waitForResponse((r) => r.url().includes("/auth/me/data-export") && r.request().method() === "POST", { timeout: 30_000 });
    await this.page.getByRole("button", { name: "Télécharger le fichier" }).click();
    const p = await premier;
    expect(p.status(), "un geste sensible passe par la porte (403 SUDO_REQUIRED)").toBe(403);
    await expect(this.page.getByText("Confirme que c'est bien toi")).toBeVisible({ timeout: 15_000 });
    await this.page.getByRole("button", { name: "M'envoyer le code" }).click();
    const courrier = await mailpit.attendreEmail({ pour: email, sujet: "Ton code de confirmation Yamba" });
    const code = /\b(\d{6})\b/.exec(courrier.texte)?.[1];
    if (!code) throw new Error("Porte par code : aucun code à six chiffres dans l'email");
    await this.page.getByLabel("Code reçu par email").fill(code);
    const telechargement = this.page.waitForEvent("download", { timeout: 60_000 });
    await this.page.getByRole("button", { name: "Confirmer", exact: true }).click();
    const fichier = await telechargement;
    await expect(this.page.getByText(/Ton fichier est téléchargé\./)).toBeVisible({ timeout: 30_000 });
    const chemin = await fichier.path();
    if (!chemin) throw new Error("Téléchargement sans fichier local");
    return chemin;
  }

  /** Étape 13 — la ligne « cet appareil » des sessions actives, espaces normalisées. */
  async ligneDeCetAppareil(): Promise<string> {
    const ligne = this.page.locator("li").filter({ hasText: "cet appareil" }).first();
    await expect(ligne).toBeVisible({ timeout: 30_000 });
    return normaliserEspaces(await ligne.innerText());
  }

  /** Le clic « Supprimer » : il interroge les bloqueurs (une requête authentifiée, rien de destructif). */
  async cliquerSupprimer(): Promise<void> {
    await this.page.getByRole("button", { name: "Supprimer", exact: true }).click();
  }

  /** Étape 14 — après le clic : le bandeau ambre, les motifs, et aucune porte. Rend le texte du panneau. */
  async suppressionBloquee(): Promise<string> {
    const bandeau = this.page.getByText("Impossible pour l'instant : termine d'abord ce qui est en cours.");
    await expect(bandeau).toBeVisible({ timeout: 30_000 });
    await expect(this.page.getByRole("button", { name: "M'envoyer le code" })).toHaveCount(0);
    await expect(this.page.getByRole("button", { name: "Supprimer définitivement mon compte" })).toHaveCount(0);
    return normaliserEspaces(await this.page.locator("body").innerText());
  }

  /** Étape 12 — la fenêtre « Ta session a expiré », et la reconnexion sur place. */
  async reconnexionDansLaFenetre(email: string, motDePasse: string): Promise<void> {
    const fenetre = this.page.getByRole("dialog");
    await expect(fenetre.getByText("Ta session a expiré")).toBeVisible({ timeout: 30_000 });
    await expect(fenetre.getByText(/une session se ferme après une heure sans activité/)).toBeVisible();
    await fenetre.locator("#email").fill(email);
    await fenetre.locator("#password").fill(motDePasse);
    const reponse = this.page.waitForResponse((r) => r.url().includes("/auth/login") && r.request().method() === "POST", { timeout: 30_000 });
    await fenetre.getByRole("button", { name: "Se connecter" }).click();
    const r = await reponse;
    if (!r.ok()) throw new Error(`Reconnexion refusée : ${r.status()} ${await r.text()}`);
    await expect(this.page.getByRole("dialog")).toHaveCount(0, { timeout: 30_000 });
  }
}
