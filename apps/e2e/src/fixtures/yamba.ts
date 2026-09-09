/**
 * yamba.ts — les fixtures du harnais : les navigateurs A, B et C du cahier
 * ========================================================================
 * Le cahier 01-WEB raisonne en **navigateurs**, pas en onglets :
 *
 *   - **Navigateur A** — l'Expéditeur ;
 *   - **Navigateur B** — le Voyageur ;
 *   - **Navigateur C** — le destinataire ou un visiteur, sans aucune session.
 *
 * Ce n'est pas une coquetterie : la moitié des vérifications portent sur ce qu'un rôle **ne
 * voit pas**. Une seule session partagée les rendrait toutes vertes pour de mauvaises raisons.
 * Chaque navigateur est donc un `BrowserContext` distinct, avec ses propres cookies.
 *
 * La connexion se fait **par l'écran**, pas par une injection de cookie : c'est plus lent de
 * deux secondes, et cela vérifie au passage que la porte d'entrée fonctionne à chaque parcours.
 */
import { test as base, expect, type BrowserContext, type Page } from "@playwright/test";
import { COMPTES, MOT_DE_PASSE_SEED, type Compte } from "./comptes";
import { JeuEssai } from "./jeu-essai";
import { Mailpit } from "./mailpit";

export { expect };

/** Un navigateur du cahier : sa page, son contexte, et le compte qui y est connecté. */
export interface Navigateur {
  page: Page;
  contexte: BrowserContext;
  compte: Compte | null;
}

export interface FixturesYamba {
  /** Ouvre un navigateur neuf et y connecte un compte du jeu d'essai. */
  navigateurConnecte: (cle: keyof typeof COMPTES) => Promise<Navigateur>;
  /** Ouvre un navigateur neuf SANS session — le visiteur, le destinataire. */
  navigateurVisiteur: () => Promise<Navigateur>;
  mailpit: Mailpit;
  jeuEssai: JeuEssai;
}

/**
 * Connexion par l'écran de connexion. Rend la page **une fois la session établie** : on attend
 * la disparition de l'écran, pas un délai arbitraire.
 */
export async function connexion(page: Page, compte: Compte, motDePasse = MOT_DE_PASSE_SEED): Promise<void> {
  // Deux pièges se cumulent ici, tous deux mesurés au montage du harnais.
  //
  // 1. Sur une adresse de réseau local, Next 16 sert d'abord un squelette SSR. Cliquer avant
  //    l'hydratation envoie le formulaire en **GET** — le mot de passe part dans l'URL et la
  //    connexion n'a jamais lieu. `networkidle` ne suffit pas : il ne dit rien de React.
  //    Le signal fiable est un appel d'API fait par le CLIENT (`/auth/me`, `/maintenance`) :
  //    tant qu'il n'est pas parti, le JavaScript de la page n'a pas pris la main.
  // 2. Les identifiants `#email` / `#password` existent en double dès qu'une fenêtre de
  //    connexion est montée : on vise donc le formulaire de la PAGE.
  const tenter = async (): Promise<boolean> => {
    await page.goto("/fr/login", { waitUntil: "domcontentloaded" });
    await page.waitForResponse((r) => r.url().includes("/api/"), { timeout: 30_000 }).catch(() => undefined);
    const formulaire = page.locator("main form").first();
    await formulaire.locator("#email").fill(compte.email);
    await formulaire.locator("#password").fill(motDePasse);
    const reponse = page
      .waitForResponse((r) => r.url().includes("/auth/login") && r.request().method() === "POST", { timeout: 20_000 })
      .catch(() => null);
    await formulaire.locator("button[type=submit]").click();
    return (await reponse) !== null;
  };

  // Un premier essai peut tomber pile avant l'hydratation ; le second part d'une page chaude.
  if (!(await tenter())) {
    if (!(await tenter())) {
      throw new Error(`Connexion de ${compte.email} : le formulaire n'a jamais envoyé sa requête (page non hydratée ?).`);
    }
  }

  await expect(page, `connexion de ${compte.email}`).not.toHaveURL(/\/login/, { timeout: 30_000 });
  await expect
    .poll(async () => (await page.context().cookies()).some((c) => c.name === "access_token"), { timeout: 15_000 })
    .toBe(true);
}

export const test = base.extend<FixturesYamba>({
  mailpit: async ({}, use) => {
    const m = new Mailpit();
    if (!(await m.disponible())) {
      throw new Error(
        "Mailpit ne répond pas sur http://localhost:8026 — les parcours du cahier vérifient les emails à chaque étape.\n" +
          "Démarre-le (docker compose up mailpit) ou pointe MAILPIT_URL ailleurs."
      );
    }
    await use(m);
  },

  jeuEssai: async ({}, use) => {
    await use(new JeuEssai());
  },

  navigateurConnecte: async ({ browser }, use) => {
    const ouverts: BrowserContext[] = [];
    await use(async (cle) => {
      const compte = COMPTES[cle];
      const contexte = await browser.newContext({ locale: "fr-FR", timezoneId: "Europe/Paris" });
      ouverts.push(contexte);
      const page = await contexte.newPage();
      await connexion(page, compte);
      return { page, contexte, compte };
    });
    for (const c of ouverts) await c.close();
  },

  navigateurVisiteur: async ({ browser }, use) => {
    const ouverts: BrowserContext[] = [];
    await use(async () => {
      const contexte = await browser.newContext({ locale: "fr-FR", timezoneId: "Europe/Paris" });
      ouverts.push(contexte);
      const page = await contexte.newPage();
      return { page, contexte, compte: null };
    });
    for (const c of ouverts) await c.close();
  },
});
