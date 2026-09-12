/**
 * yamba.ts — les fixtures du harnais : les navigateurs A, B, C… et l'administrateur du cahier
 * ==========================================================================================
 * Le cahier 01-WEB raisonne en **navigateurs**, pas en onglets :
 *
 *   - **Navigateur A** — l'Expéditeur ;
 *   - **Navigateur B** — le Voyageur ;
 *   - **Navigateur C** — le destinataire ou un visiteur, sans aucune session ;
 *   - et, pour huit de ses chapitres, un **navigateur du back-office** (cahier 02-ADMIN).
 *
 * Ce n'est pas une coquetterie : la moitié des vérifications portent sur ce qu'un rôle **ne
 * voit pas**. Une seule session partagée les rendrait toutes vertes pour de mauvaises raisons.
 * Chaque navigateur est donc un `BrowserContext` distinct, avec ses propres cookies.
 *
 * La session d'un compte s'ouvre **par l'écran** la première fois, puis elle est **mémorisée**
 * (`sessions.ts`) : les contextes suivants repartent des cookies enregistrés, après les avoir
 * sondés. Sans cela, le limiteur de débit de la passerelle finit par refuser les connexions
 * (429) — mesuré le 09/09/2026. `{ parEcran: true }` force la connexion par l'écran : c'est ce
 * que fait `harnais.spec.ts`, pour ne pas perdre la vérification de la porte d'entrée.
 */
import { test as base, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { totpCode, TOTP_STEP_SECONDS } from "../../../../packages/libs/totp/src";
import { adresseDeLApi, adresseDeLApiAdmin, adresseDuBackOffice } from "./adresses";
import { COMPTES, COMPTES_ADMIN, MOT_DE_PASSE_SEED, type Compte, type CompteAdmin } from "./comptes";
import { JeuEssai } from "./jeu-essai";
import { Mailpit } from "./mailpit";
import { cookieDe, ecrireSession, lireSession, oublierSession, type EtatDeSession } from "./sessions";

export { expect };

/** Un navigateur du cahier : sa page, son contexte, et le compte qui y est connecté. */
export interface Navigateur {
  page: Page;
  contexte: BrowserContext;
  compte: Compte | null;
}

/** Un navigateur du back-office : même chose, avec un compte administrateur. */
export interface NavigateurAdmin {
  page: Page;
  contexte: BrowserContext;
  compte: CompteAdmin;
}

export interface OptionsConnexion {
  /** Ignorer la session mémorisée et passer par l'écran de connexion (puis mémoriser). */
  parEcran?: boolean;
  /** Cocher « Rester connecté sur cet appareil » (profil de session 7 jours, WEB-CNX-6) — implique `parEcran`. */
  memoriser?: boolean;
}

export interface FixturesYamba {
  /** Ouvre un navigateur neuf et y connecte un compte du jeu d'essai. */
  navigateurConnecte: (cle: keyof typeof COMPTES, options?: OptionsConnexion) => Promise<Navigateur>;
  /** Ouvre un navigateur neuf SANS session — le visiteur, le destinataire. */
  navigateurVisiteur: () => Promise<Navigateur>;
  /** Ouvre un navigateur sur le back-office, connexion en deux temps (mot de passe, puis TOTP). */
  navigateurAdmin: (cle: keyof typeof COMPTES_ADMIN, options?: OptionsConnexion) => Promise<NavigateurAdmin>;
  mailpit: Mailpit;
  jeuEssai: JeuEssai;
}

const OPTIONS_CONTEXTE = { locale: "fr-FR", timezoneId: "Europe/Paris" } as const;

/* ══ La connexion d'un membre, par l'écran ═══════════════════════════════════════════════════ */

/**
 * Connexion par l'écran de connexion. Rend la page **une fois la session établie** : on attend
 * la disparition de l'écran, pas un délai arbitraire.
 */
export async function connexion(page: Page, compte: Compte, motDePasse = MOT_DE_PASSE_SEED, options: { memoriser?: boolean } = {}): Promise<void> {
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
    if (options.memoriser) await formulaire.locator('input[type="checkbox"]').check();
    const reponse = page
      .waitForResponse((r) => r.url().includes("/auth/login") && r.request().method() === "POST", { timeout: 20_000 })
      .catch(() => null);
    await formulaire.locator("button[type=submit]").click();
    const r = await reponse;
    if (r?.status() === 429) {
      throw new Error(
        `Connexion de ${compte.email} : la passerelle répond 429 (limiteur de débit). ` +
          "Redémarrer api-gateway remet les compteurs à zéro ; les sessions mémorisées (.sessions/) évitent d'en arriver là."
      );
    }
    return r !== null;
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

/**
 * Une session membre mémorisée répond-elle encore ? Sondée avec les cookies du contexte, sur
 * l'API telle que le navigateur l'appelle. Un jeton d'accès expiré (15 min) est rafraîchi ici
 * même — la rotation met les nouveaux cookies dans le contexte, avant la première page.
 */
async function sessionMembreVivante(contexte: BrowserContext): Promise<boolean> {
  const api = adresseDeLApi();
  try {
    const me = await contexte.request.get(`${api}/auth/me`, { timeout: 15_000 });
    if (me.ok()) return true;
    if (me.status() !== 401) return false;
    const refresh = await contexte.request.post(`${api}/auth/refresh`, { timeout: 15_000 });
    return refresh.ok();
  } catch {
    return false;
  }
}

/* ══ La connexion d'un administrateur, en deux temps ═════════════════════════════════════════ */

/**
 * La connexion en deux temps du back-office (D54) : mot de passe, puis code TOTP **calculé** à
 * partir du secret que `seed-admins.ts` a enrôlé. Un pas de 30 s ne sert qu'une fois par
 * compte (anti-rejeu, `totpLastUsedStep`) : si le code vient d'être consommé, on attend le pas
 * suivant et on recommence une fois.
 */
export async function connexionAdmin(page: Page, compte: CompteAdmin, secret: string, motDePasse = MOT_DE_PASSE_SEED): Promise<void> {
  const backOffice = adresseDuBackOffice();

  const tenter = async (): Promise<boolean> => {
    await page.goto(`${backOffice}/login`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Yamba · Back-office" })).toBeVisible({ timeout: 60_000 });
    // L'écran ne fait aucun appel d'API au chargement : on laisse le réseau se calmer avant de
    // saisir, sinon React n'est pas encore branché sur les champs et le formulaire part VIDE
    // (400 MISSING_FIELDS, mesuré sur une suite complète).
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await page.getByLabel("Email").fill(compte.email);
    await page.getByLabel("Mot de passe").fill(motDePasse);
    const reponse = page
      .waitForResponse((r) => r.url().includes("/auth/admin/login") && r.request().method() === "POST", { timeout: 20_000 })
      .catch(() => null);
    await page.getByRole("button", { name: "Continuer" }).click();
    const r = await reponse;
    if (r && !r.ok()) {
      const corps = await r.text().catch(() => "");
      // Un formulaire parti vide (MISSING_FIELDS) trahit une saisie avant hydratation : on
      // recommence une fois sur une page chaude, comme pour le membre.
      if (r.status() === 400 && corps.includes("MISSING_FIELDS")) return false;
      // Une porte qui refuse doit dire pourquoi dans le rapport : statut ET corps, pas un
      // délai d'attente trente secondes plus loin sur l'écran suivant.
      throw new Error(`Connexion admin de ${compte.email} : POST /auth/admin/login → ${r.status()} ${corps.slice(0, 300)}`);
    }
    return r !== null;
  };
  if (!(await tenter())) {
    if (!(await tenter())) throw new Error(`Connexion admin de ${compte.email} : le formulaire n'a jamais envoyé sa requête (page non hydratée ?).`);
  }

  // Le compte doit être ENRÔLÉ : l'écran de premier enrôlement (QR + secret) est le sujet du
  // scénario ADM-SEC-2, pas de la fixture. Le seed enrôle les sept comptes de recette.
  const enrolement = page.getByText("Première connexion : scanne ce code");
  const saisie = page.getByText("Saisis le code de ton application d'authentification");
  await expect(enrolement.or(saisie)).toBeVisible({ timeout: 30_000 });
  if (await enrolement.isVisible()) {
    throw new Error(`${compte.email} n'est pas enrôlé (2FA) : rejoue \`seed-admins.ts\` (jeuEssai.rejouerAdmins()).`);
  }

  for (let essai = 0; essai < 2; essai++) {
    const champ = page.getByPlaceholder("123 456 ou ABCDE-FGHIJ");
    await champ.fill(totpCode(secret));
    const reponse = page.waitForResponse((r) => r.url().includes("/auth/admin/totp/verify"), { timeout: 20_000 });
    await page.getByRole("button", { name: "Se connecter" }).click();
    const r = await reponse;
    if (r.ok()) break;
    if (essai === 1) throw new Error(`Connexion admin de ${compte.email} : code TOTP refusé deux fois (secret périmé ? rejoue seed-admins.ts).`);
    // Pas de 30 s déjà consommé (anti-rejeu) : on attend le suivant.
    const reste = TOTP_STEP_SECONDS - (Math.floor(Date.now() / 1000) % TOTP_STEP_SECONDS) + 1;
    await page.waitForTimeout(reste * 1000);
  }

  await expect(page, `connexion admin de ${compte.email}`).toHaveURL(/\/home/, { timeout: 60_000 });
  await expect
    .poll(async () => (await page.context().cookies()).some((c) => c.name === "admin_access_token"), { timeout: 15_000 })
    .toBe(true);
}

async function sessionAdminVivante(contexte: BrowserContext): Promise<boolean> {
  const api = adresseDeLApiAdmin();
  try {
    const me = await contexte.request.get(`${api}/admin/me`, { timeout: 15_000 });
    if (me.ok()) return true;
    if (me.status() !== 401) return false;
    const refresh = await contexte.request.post(`${api}/auth/admin/refresh`, { timeout: 15_000 });
    return refresh.ok();
  } catch {
    return false;
  }
}

/* ══ La mécanique commune : mémoire, sonde, écran ════════════════════════════════════════════ */

interface SessionOuverte {
  cleMemoire: string;
  cookie: string;
  contexte: BrowserContext;
}

/**
 * Ouvre un contexte connecté : depuis la mémoire si elle répond, par l'écran sinon. La mémoire
 * est écrite dès la connexion par l'écran, puis **rendue** à la fermeture (rotation des cookies).
 */
async function ouvrirSession(
  browser: Browser,
  cleMemoire: string,
  cookie: string,
  options: OptionsConnexion,
  parEcran: (page: Page) => Promise<void>,
  vivante: (contexte: BrowserContext) => Promise<boolean>
): Promise<{ page: Page; contexte: BrowserContext }> {
  const memoire: EtatDeSession | null = options.parEcran ? null : lireSession(cleMemoire);
  if (memoire && cookieDe(memoire, cookie)) {
    const contexte = await browser.newContext({ ...OPTIONS_CONTEXTE, storageState: memoire });
    if (await vivante(contexte)) {
      return { page: await contexte.newPage(), contexte };
    }
    await contexte.close();
    oublierSession(cleMemoire);
  }
  const contexte = await browser.newContext(OPTIONS_CONTEXTE);
  const page = await contexte.newPage();
  await parEcran(page);
  ecrireSession(cleMemoire, await contexte.storageState());
  return { page, contexte };
}

/** À la fermeture : les cookies les plus récents gagnent ; une session fermée par le scénario est oubliée. */
async function rendreSession(s: SessionOuverte): Promise<void> {
  try {
    const etat = await s.contexte.storageState();
    if (cookieDe(etat, s.cookie)) ecrireSession(s.cleMemoire, etat);
    else oublierSession(s.cleMemoire);
  } catch {
    /* contexte déjà fermé par le scénario : la mémoire reste telle quelle */
  }
  await s.contexte.close().catch(() => undefined);
}

/* ══ Les fixtures ════════════════════════════════════════════════════════════════════════════ */

export const test = base.extend<FixturesYamba>({
  mailpit: async ({}, use) => {
    const m = new Mailpit();
    if (!(await m.disponible())) {
      throw new Error(
        "Mailpit ne répond pas sur http://localhost:8026 — les parcours du cahier vérifient les emails à chaque étape.\n" +
          "Démarre-le (docker start yamba-mailpit) ou pointe MAILPIT_URL ailleurs."
      );
    }
    await use(m);
  },

  jeuEssai: async ({}, use) => {
    await use(new JeuEssai());
  },

  navigateurConnecte: async ({ browser }, use) => {
    const ouverts: SessionOuverte[] = [];
    await use(async (cle, options = {}) => {
      const compte = COMPTES[cle];
      const cleMemoire = `membre-${cle}`;
      const parEcran = { ...options, parEcran: options.parEcran || Boolean(options.memoriser) };
      const { page, contexte } = await ouvrirSession(browser, cleMemoire, "access_token", parEcran, (p) => connexion(p, compte, MOT_DE_PASSE_SEED, { memoriser: options.memoriser }), sessionMembreVivante);
      ouverts.push({ cleMemoire, cookie: "access_token", contexte });
      return { page, contexte, compte };
    });
    for (const s of ouverts) await rendreSession(s);
  },

  navigateurVisiteur: async ({ browser }, use) => {
    const ouverts: BrowserContext[] = [];
    await use(async () => {
      const contexte = await browser.newContext(OPTIONS_CONTEXTE);
      ouverts.push(contexte);
      const page = await contexte.newPage();
      return { page, contexte, compte: null };
    });
    for (const c of ouverts) await c.close();
  },

  navigateurAdmin: async ({ browser, jeuEssai }, use) => {
    const ouverts: SessionOuverte[] = [];
    await use(async (cle, options = {}) => {
      const compte = COMPTES_ADMIN[cle];
      const cleMemoire = `admin-${cle}`;
      const { page, contexte } = await ouvrirSession(
        browser,
        cleMemoire,
        "admin_access_token",
        options,
        (p) => connexionAdmin(p, compte, jeuEssai.admin(cle).secret),
        sessionAdminVivante
      );
      ouverts.push({ cleMemoire, cookie: "admin_access_token", contexte });
      return { page, contexte, compte };
    });
    for (const s of ouverts) await rendreSession(s);
  },
});
