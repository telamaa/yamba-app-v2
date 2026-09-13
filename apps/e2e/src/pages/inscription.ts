/**
 * inscription.ts — créer un compte sur place (cahier 01-WEB, chapitre 5.2)
 * ========================================================================
 * Le formulaire, le mot de passe conforme, la case des conditions (une vraie case), puis le
 * code à six chiffres reçu par email et saisi case par case. Le compte est activé sans ouvrir
 * de session : on revient sur l'écran de connexion avec un bandeau vert.
 */
import { expect, type Page } from "@playwright/test";
import type { CompteNeuf } from "../fixtures/compte-neuf";
import type { Mailpit } from "../fixtures/mailpit";

export class Inscription {
  constructor(private readonly page: Page) {}

  async creer(compte: CompteNeuf, mailpit: Mailpit): Promise<void> {
    await this.page.goto("/fr/register", { waitUntil: "domcontentloaded" });
    await this.page.waitForLoadState("networkidle").catch(() => undefined);
    const formulaire = this.page.locator("main form").first();
    await expect(this.page.getByRole("heading", { name: "Deviens Voyageur" })).toBeVisible({ timeout: 60_000 });
    await formulaire.locator("#firstName").fill(compte.prenom);
    await formulaire.locator("#lastName").fill(compte.nom);
    await formulaire.locator("#email").fill(compte.email);
    await formulaire.locator("#password").fill(compte.motDePasse);
    await formulaire.locator("#passwordConfirm").fill(compte.motDePasse);
    await formulaire.locator('input[type="checkbox"]').check();
    const reponse = this.page.waitForResponse((r) => r.url().includes("/auth/register") && r.request().method() === "POST", { timeout: 30_000 });
    await formulaire.getByRole("button", { name: "Créer mon compte" }).click();
    const r = await reponse;
    if (!r.ok()) throw new Error(`Inscription refusée : ${r.status()} ${await r.text()}`);
    await expect(this.page).toHaveURL(/\/register\/verify/, { timeout: 60_000 });
    await expect(this.page.getByRole("heading", { name: "Plus qu'une étape !" })).toBeVisible({ timeout: 60_000 });

    const email = await mailpit.attendreEmail({ pour: compte.email, sujet: "Ton code d'activation Yamba" });
    const code = /\b(\d{6})\b/.exec(email.texte)?.[1];
    if (!code) throw new Error(`Inscription : aucun code à six chiffres dans l'email « ${email.sujet} »`);
    for (const [i, chiffre] of code.split("").entries()) {
      await this.page.getByLabel(`OTP digit ${i + 1}`).fill(chiffre);
    }
    const verification = this.page.waitForResponse((r) => r.url().includes("/auth/register/verify") && r.request().method() === "POST", { timeout: 30_000 });
    await this.page.getByRole("button", { name: "Valider mon code" }).click();
    const v = await verification;
    if (!v.ok()) throw new Error(`Activation refusée : ${v.status()} ${await v.text()}`);
    await expect(this.page).toHaveURL(/\/fr\/login\?verified=1/, { timeout: 60_000 });
    await expect(this.page.getByText("Compte activé")).toBeVisible({ timeout: 30_000 });
    await mailpit.attendreEmail({ pour: compte.email, sujet: "Bienvenue sur Yamba" });
  }
}
