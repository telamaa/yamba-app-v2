/**
 * adm-ses-mes-sessions.spec.ts — cahier 02-ADMIN, § 5.26 « Mes sessions » (ADM-SES-1) + fiches ajoutées
 * =====================================================================================================
 * Le cahier juge un seul point : l'identité de l'admin vit dans la barre latérale, « Mes sessions » liste ses sessions,
 * et le back-office ne propose AUCUN geste de compte (mot de passe, email, codes de secours). Le chapitre se juge
 * pourtant à ce que la page promet elle-même — « Révoque ce que tu ne reconnais pas » :
 *  - **on reconnaît une session** : appareil et adresse IP, comme l'alerte email de connexion les donne ;
 *  - **« Se déconnecter » ne ment jamais** : si le serveur ne répond pas, la session est toujours ouverte — l'écran le
 *    dit au lieu d'afficher /login ;
 *  - **le journal ne compte que ce qui a eu lieu** : une déconnexion rejouée, une session déjà fermée ne font pas de
 *    seconde ligne ;
 *  - **l'écran parle juste** : une panne n'est pas « Aucune session. », un code de secours n'est pas « code(s) ».
 *
 * Comptes : des administrateurs JETABLES enrôlés en base (manœuvre consignée, comme au § 5.25) — une fiche qui se
 * déconnecte ne doit jamais fermer une session mémorisée du harnais. Chaque fiche retire l'accès qu'elle a ouvert.
 */
import { test, expect } from "../fixtures/yamba";
import { connexionAdmin } from "../fixtures/yamba";
import { request as requeteApi, type APIRequestContext, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { adresseDeLApiAdmin, adresseDuBackOffice } from "../fixtures/adresses";
import { MOT_DE_PASSE_SEED, type CompteAdmin } from "../fixtures/comptes";
import { lireLeJournal } from "../pages/journal-admin";
import { debutDuScenario, lireCoteServeur } from "../pages/ecran-admin";
import { totpCode, TOTP_STEP_SECONDS } from "../../../../packages/libs/totp/src";

const api = () => adresseDeLApiAdmin();
const bo = () => adresseDuBackOffice();
type Profil = "SUPER_ADMIN" | "MEDIATOR" | "SUPPORT" | "FINANCE" | "OPS" | "PRIVACY";
type Jetable = { id: string; email: string; secret: string; compte: CompteAdmin };

const UA_MAC_CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const UA_WINDOWS_FIREFOX = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:142.0) Gecko/20100101 Firefox/142.0";

/* ══ Manœuvres base consignées ═══════════════════════════════════════════════════════════════ */

/** Un administrateur ENRÔLÉ posé en base, avec `codes` codes de secours (hachés, inutilisables : seul leur NOMBRE compte ici). */
function creerAdminEnrole(fiche: string, profils: Profil[], codes = 10): Jetable {
  const email = `ses-${fiche.toLowerCase()}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@recette.yamba.dev`;
  const r = lireCoteServeur<{ id: string; secret: string }>(`
    import prisma from "./packages/libs/prisma";
    import bcrypt from "bcryptjs";
    import { encryptTotpSecret, generateTotpSecret } from "./packages/libs/totp/src/index";
    (async () => {
      const secret = generateTotpSecret();
      const u = await prisma.user.create({ data: {
        firstName: "Recette", lastName: ${JSON.stringify(fiche)}, email: ${JSON.stringify(email)}, emailNormalized: ${JSON.stringify(email)},
        publicSlug: ${JSON.stringify(`recette-${email.split("@")[0]}`)}, passwordHash: await bcrypt.hash(${JSON.stringify(MOT_DE_PASSE_SEED)}, 10),
        roles: ["ADMIN"], adminRoles: ${JSON.stringify(profils)}, adminRole: ${JSON.stringify(profils[0])},
        totpSecretEncrypted: encryptTotpSecret(secret), totpEnabledAt: new Date(), totpLastUsedStep: null,
        totpBackupCodeHashes: Array.from({ length: ${codes} }, (_, i) => "recette-inutilisable-" + i), carrierStatus: "NONE",
      } });
      console.log("@@" + JSON.stringify({ id: u.id, secret }));
      process.exit(0);
    })();`);
  process.stdout.write(`   ↳ manœuvre base : administrateur enrôlé ${email} (${profils.join(" + ")}, ${codes} code(s) de secours)\n`);
  return { id: r.id, email, secret: r.secret, compte: { cle: fiche, email, prenom: "Recette", nom: fiche, profils } };
}

/** Fin de fiche : l'accès est retiré et ses sessions Redis effacées (la liste des comptes admin reste juste). */
function retirerLAcces(j: Jetable): void {
  lireCoteServeur(`
    import prisma from "./packages/libs/prisma";
    import redis from "./packages/libs/redis";
    (async () => {
      await prisma.user.update({ where: { id: ${JSON.stringify(j.id)} }, data: { roles: [], adminRoles: [], adminRole: null } });
      const cles = await redis.keys("admin_jti:${j.id}:*");
      if (cles.length) await redis.del(...cles);
      console.log("@@true"); process.exit(0);
    })();`);
}

function poserLesCodesDeSecours(j: Jetable, n: number): void {
  lireCoteServeur(`import prisma from "./packages/libs/prisma"; (async () => { await prisma.user.update({ where: { id: ${JSON.stringify(j.id)} }, data: { totpBackupCodeHashes: Array.from({ length: ${n} }, (_, i) => "recette-inutilisable-" + i) } }); console.log("@@true"); process.exit(0); })();`);
}

const sessionsRedis = (j: Jetable): number => lireCoteServeur<number>(`import redis from "./packages/libs/redis"; (async () => { console.log("@@" + (await redis.keys("admin_jti:${j.id}:*")).length); process.exit(0); })();`);

/* ══ Sessions ════════════════════════════════════════════════════════════════════════════════ */

const resteDuPas = () => TOTP_STEP_SECONDS - (Math.floor(Date.now() / 1000) % TOTP_STEP_SECONDS);

async function connecterParApi(requete: APIRequestContext, j: Jetable): Promise<void> {
  const login = await requete.post(`${api()}/auth/admin/login`, { data: { email: j.email, password: MOT_DE_PASSE_SEED } });
  expect(login.status(), `POST /auth/admin/login de ${j.email}`).toBe(200);
  // Anti-rejeu : un pas de 30 s ne sert qu'une fois par compte.
  for (let essai = 0; essai < 2; essai++) {
    if (resteDuPas() < 3) await new Promise((r) => setTimeout(r, (resteDuPas() + 1) * 1000));
    const code = await requete.post(`${api()}/auth/admin/totp/verify`, { data: { code: totpCode(j.secret) } });
    if (code.status() === 200) return;
    await new Promise((r) => setTimeout(r, (resteDuPas() + 1) * 1000));
  }
  throw new Error(`POST /auth/admin/totp/verify de ${j.email} refusé deux fois`);
}

/** Un navigateur neuf, avec son user-agent, connecté par l'écran. */
async function navigateurDe(browser: Browser, j: Jetable, userAgent?: string): Promise<{ page: Page; contexte: BrowserContext }> {
  const contexte = await browser.newContext({ locale: "fr-FR", timezoneId: "Europe/Paris", ...(userAgent ? { userAgent } : {}) });
  const page = await contexte.newPage();
  await connexionAdmin(page, j.compte, j.secret);
  return { page, contexte };
}

const lignesDeSessions = (page: Page) => page.locator("ul li").filter({ hasText: "ouverte le" });

async function ouvrirMesSessions(page: Page): Promise<void> {
  await page.goto(`${bo()}/sessions`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Mes sessions admin" })).toBeVisible({ timeout: 60_000 });
}

/* ══ Les fiches ══════════════════════════════════════════════════════════════════════════════ */

test.describe("ADM-SES — mes sessions (cahier 02-ADMIN § 5.26)", () => {
  test("ADM-SES-1 · mon compte admin : la barre latérale, « Mes sessions », aucun geste de compte, la déconnexion journalisée", async ({ browser, navigateurAdmin }) => {
    test.setTimeout(5 * 60_000);
    const j = creerAdminEnrole("SES-1", ["SUPPORT", "FINANCE"], 2);
    try {
      const { page, contexte } = await navigateurDe(browser, j);
      await expect(page).toHaveURL(/\/home/, { timeout: 60_000 });
      const barre = page.locator("aside");
      /* 1. Pas de page « Mon compte ». */
      await expect(barre.getByRole("link", { name: /mon compte|profil|compte$/i }), "aucune entrée « Mon compte »").toHaveCount(0);
      const inexistante = await page.goto(`${bo()}/account`, { waitUntil: "domcontentloaded" });
      expect(inexistante?.status(), "/account n'existe pas").toBe(404);
      await page.goto(`${bo()}/home`, { waitUntil: "domcontentloaded" });
      /* 2. La barre : marque, prénom et nom, profils cumulés, codes de secours, déconnexion. */
      await expect(barre.getByText("Yamba · Admin", { exact: true })).toBeVisible({ timeout: 60_000 });
      await expect(barre.getByText("Recette SES-1", { exact: true })).toBeVisible();
      await expect(barre.getByText("Support + Finance", { exact: true }), "profils cumulés").toBeVisible();
      // ANO-ADM-84 — « Il te reste 2 code(s) de secours. » : le pluriel est accordé.
      await expect(barre.getByText("Il te reste 2 codes de secours — tu peux les régénérer depuis « Mes sessions ».", { exact: true })).toBeVisible();
      await expect(barre.getByRole("button", { name: "Se déconnecter" })).toBeVisible();
      /* 3. « Mes sessions » : la session courante, marquée. */
      await ouvrirMesSessions(page);
      await expect(lignesDeSessions(page).filter({ hasText: "cette session" })).toHaveCount(1, { timeout: 30_000 });
      /* 4. Aucun geste de compte dans le back-office — sauf, depuis A190 a (§ 6), la régénération des codes de secours. */
      for (const nom of [/mot de passe/i, /e-?mail/i]) {
        await expect(page.getByRole("link", { name: nom }), `aucun lien ${nom}`).toHaveCount(0);
        await expect(page.getByRole("button", { name: nom }), `aucun bouton ${nom}`).toHaveCount(0);
      }
      await expect(page.getByRole("button", { name: "Régénérer mes codes de secours" }), "A190 a").toHaveCount(1);
      await expect(page.getByRole("button", { name: "Révoquer toutes mes autres sessions" }), "une seule session : rien à révoquer").toHaveCount(0);
      /* Se déconnecter : /login, la session Redis n'existe plus, une ligne ADMIN_LOGOUT. */
      const debut = await debutDuScenario();
      await barre.getByRole("button", { name: "Se déconnecter" }).click();
      await expect(page, "déconnexion → /login").toHaveURL(/\/login/, { timeout: 30_000 });
      expect(sessionsRedis(j), "plus aucune session admin en Redis").toBe(0);
      await page.goto(`${bo()}/home`, { waitUntil: "domcontentloaded" });
      await expect(page, "revenir sur /home renvoie à /login").toHaveURL(/\/login/, { timeout: 60_000 });
      const lecteur = await navigateurAdmin("super");
      const lignes = await lireLeJournal(lecteur.contexte.request, { from: debut, adminUserId: j.id });
      expect(lignes.map((l) => `${l.action} · ${l.targetType}`), "une ligne de déconnexion").toEqual(["ADMIN_LOGOUT · SESSION"]);
      await contexte.close();
    } finally {
      retirerLAcces(j);
    }
  });

  test("ADM-SES-2 · on reconnaît une session : appareil et adresse IP, et l'on révoque la bonne (ANO-ADM-81)", async ({ browser }) => {
    test.setTimeout(5 * 60_000);
    const j = creerAdminEnrole("SES-2", ["SUPPORT"]);
    try {
      const A = await navigateurDe(browser, j, UA_MAC_CHROME);
      const B = await navigateurDe(browser, j, UA_WINDOWS_FIREFOX);
      await ouvrirMesSessions(A.page);
      const lignes = lignesDeSessions(A.page);
      await expect(lignes).toHaveCount(2, { timeout: 30_000 });
      const ligneA = lignes.filter({ hasText: "cette session" });
      await expect(ligneA, "la session courante nomme son appareil").toContainText("Chrome · macOS");
      const ligneB = lignes.filter({ hasText: "Firefox · Windows" });
      await expect(ligneB, "l'autre session nomme le sien").toHaveCount(1);
      await expect(ligneB, "et son adresse IP").toContainText(/IP \S+/);
      /* L'appareil survit au renouvellement du jeton (rotation du jti). */
      expect((await B.contexte.request.post(`${api()}/auth/admin/refresh`)).status(), "renouvellement de B").toBe(200);
      await A.page.reload({ waitUntil: "domcontentloaded" });
      await expect(lignesDeSessions(A.page).filter({ hasText: "Firefox · Windows" }), "après rotation, B est toujours reconnaissable").toHaveCount(1, { timeout: 30_000 });
      /* Révoquer « Firefox · Windows » par son bouton : c'est B qui tombe, pas A. */
      await lignesDeSessions(A.page).filter({ hasText: "Firefox · Windows" }).getByRole("button", { name: "Révoquer" }).click();
      await expect(lignesDeSessions(A.page)).toHaveCount(1, { timeout: 30_000 });
      expect((await B.contexte.request.get(`${api()}/admin/me`, { failOnStatusCode: false })).status(), "B est révoquée").toBe(401);
      expect((await A.contexte.request.get(`${api()}/admin/me`)).status(), "A reste ouverte").toBe(200);
      await A.contexte.close();
      await B.contexte.close();
    } finally {
      retirerLAcces(j);
    }
  });

  test("ADM-SES-3 · le serveur ne répond pas : « Se déconnecter » et « Révoquer » disent que la session reste ouverte (ANO-ADM-82)", async ({ browser }) => {
    test.setTimeout(5 * 60_000);
    const j = creerAdminEnrole("SES-3", ["OPS"]);
    try {
      const { page, contexte } = await navigateurDe(browser, j);
      await expect(page).toHaveURL(/\/home/, { timeout: 60_000 });
      /* Déconnexion : le service d'authentification est injoignable (502 du gateway). */
      await page.route("**/auth/admin/logout", (r) => r.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ status: "error", message: "Upstream unreachable", details: { code: "UPSTREAM_UNREACHABLE" } }) }));
      await page.locator("aside").getByRole("button", { name: "Se déconnecter" }).click();
      await expect(page.getByRole("alert").filter({ hasText: "Déconnexion impossible" }), "un refus lisible").toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("alert").filter({ hasText: "Déconnexion impossible" })).toContainText("ta session est toujours ouverte");
      expect(page.url(), "l'écran ne fait pas croire à une déconnexion").not.toMatch(/\/login/);
      expect((await contexte.request.get(`${api()}/admin/me`)).status(), "la session est bien vivante").toBe(200);
      /* Révoquer SA session, même panne : on reste sur la page, même message. */
      await page.route("**/admin/me/sessions/*", (r) => (r.request().method() === "DELETE" ? r.fulfill({ status: 502, contentType: "application/json", body: "{}" }) : r.continue()));
      await ouvrirMesSessions(page);
      await lignesDeSessions(page).filter({ hasText: "cette session" }).getByRole("button", { name: "Révoquer" }).click();
      await expect(page.getByRole("alert").filter({ hasText: "Révocation impossible" }), "révocation : refus lisible").toBeVisible({ timeout: 30_000 });
      expect(page.url()).not.toMatch(/\/login/);
      /* Le service revient : la déconnexion aboutit. */
      await page.unrouteAll({ behavior: "ignoreErrors" });
      await page.locator("aside").getByRole("button", { name: "Se déconnecter" }).click();
      await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
      expect(sessionsRedis(j)).toBe(0);
      await contexte.close();
    } finally {
      retirerLAcces(j);
    }
  });

  test("ADM-SES-4 · le journal ne compte que ce qui a eu lieu : déconnexion rejouée, session déjà fermée (ANO-ADM-83)", async ({ browser, navigateurAdmin }) => {
    test.setTimeout(5 * 60_000);
    const j = creerAdminEnrole("SES-4", ["MEDIATOR"]);
    const debut = await debutDuScenario();
    try {
      /* Une session par l'API ; on garde son jeton de renouvellement. */
      const requete = await requeteApi.newContext();
      await connecterParApi(requete, j);
      const refresh = (await requete.storageState()).cookies.find((c) => c.name === "admin_refresh_token")?.value;
      expect(refresh).toBeTruthy();
      expect((await requete.post(`${api()}/auth/admin/logout`)).status()).toBe(200);
      /* Rejouer la déconnexion avec le même jeton (deuxième onglet, double clic, requête rejouée). */
      const rejeu = await requeteApi.newContext({ extraHTTPHeaders: { cookie: `admin_refresh_token=${refresh}` } });
      expect((await rejeu.post(`${api()}/auth/admin/logout`)).status(), "le rejeu répond 200 (idempotent)").toBe(200);
      /* Révoquer une session qui n'existe pas (déjà fermée, jti inventé) : 404, aucune ligne. */
      const vivante = await requeteApi.newContext();
      await connecterParApi(vivante, j);
      const inconnue = await vivante.delete(`${api()}/admin/me/sessions/${"0".repeat(32)}`, { failOnStatusCode: false });
      expect(inconnue.status(), "session inconnue → 404").toBe(404);
      expect(((await inconnue.json()) as { details?: { code?: string } }).details?.code).toBe("ADMIN_SESSION_NOT_FOUND");
      /* Double clic sur « Révoquer » d'une autre session, dans l'écran : une seule ligne, un message juste. */
      const A = await navigateurDe(browser, j);
      await ouvrirMesSessions(A.page);
      const autre = lignesDeSessions(A.page).filter({ hasNotText: "cette session" }).first();
      await expect(autre).toBeVisible({ timeout: 30_000 });
      await autre.getByRole("button", { name: "Révoquer" }).dblclick();
      await expect(lignesDeSessions(A.page), "la session révoquée disparaît").toHaveCount(1, { timeout: 30_000 });
      const lecteur = await navigateurAdmin("super");
      const actions = (await lireLeJournal(lecteur.contexte.request, { from: debut, adminUserId: j.id })).map((l) => l.action).filter((a) => a !== "ADMIN_LOGIN");
      expect(actions, "une déconnexion et une révocation, pas plus").toEqual(["ADMIN_LOGOUT", "ADMIN_SESSION_REVOKED"]);
      await A.contexte.close();
      await requete.dispose();
      await rejeu.dispose();
      await vivante.dispose();
    } finally {
      retirerLAcces(j);
    }
  });

  test("ADM-SES-5 · l'écran parle juste : une panne n'est pas « Aucune session. », les codes de secours comptés et le recours dit (ANO-ADM-84)", async ({ browser }) => {
    test.setTimeout(5 * 60_000);
    const j = creerAdminEnrole("SES-5", ["PRIVACY"], 1);
    try {
      const { page, contexte } = await navigateurDe(browser, j);
      const barre = page.locator("aside");
      await expect(barre.getByText("Il te reste 1 code de secours — tu peux les régénérer depuis « Mes sessions ».", { exact: true }), "singulier").toBeVisible({ timeout: 60_000 });
      /* Plus aucun code : le recours est dit. */
      poserLesCodesDeSecours(j, 0);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(barre.getByText(/Tu n'as plus de code de secours/), "zéro code : le recours").toBeVisible({ timeout: 60_000 });
      await expect(barre, "A190 a : le recours est la régénération").toContainText("régénère-les depuis « Mes sessions »");
      /* Au-delà de deux codes : aucun avertissement. */
      poserLesCodesDeSecours(j, 3);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(barre.getByText("Recette SES-5", { exact: true })).toBeVisible({ timeout: 60_000 });
      await expect(barre.getByText(/code(s)? de secours/)).toHaveCount(0);
      /* La lecture des sessions tombe : un message et « Réessayer », jamais « Aucune session. ». */
      let panne = true;
      await page.route("**/admin/me/sessions", (r) => (panne ? r.fulfill({ status: 502, contentType: "application/json", body: "{}" }) : r.continue()));
      await ouvrirMesSessions(page);
      await expect(page.getByRole("alert").filter({ hasText: "Impossible de lire tes sessions" })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("Aucune session.", { exact: true })).toHaveCount(0);
      panne = false;
      await page.getByRole("button", { name: "Réessayer" }).click();
      await expect(lignesDeSessions(page).filter({ hasText: "cette session" })).toHaveCount(1, { timeout: 30_000 });
      await contexte.close();
    } finally {
      retirerLAcces(j);
    }
  });

  /* ══ Lots du § 5.26, décidés au § 6 (A190) ══════════════════════════════════════════════════ */

  test("ADM-SES-6 · « Révoquer toutes mes autres sessions » et régénérer ses codes de secours (A190 a, b)", async ({ browser, navigateurAdmin }) => {
    test.setTimeout(6 * 60_000);
    const j = creerAdminEnrole("SES-6", ["SUPPORT"], 1);
    try {
      const autre = await requeteApi.newContext({ userAgent: UA_WINDOWS_FIREFOX });
      await connecterParApi(autre, j);
      const { page } = await navigateurDe(browser, j, UA_MAC_CHROME);
      await ouvrirMesSessions(page);
      await expect(lignesDeSessions(page)).toHaveCount(2, { timeout: 60_000 });
      const debut = await debutDuScenario();
      /* b. Un geste, la session courante reste. */
      await page.getByRole("button", { name: "Révoquer toutes mes autres sessions" }).click();
      await expect(page.getByText("1 autre session fermée. Cette session reste ouverte.")).toBeVisible({ timeout: 30_000 });
      await expect(lignesDeSessions(page)).toHaveCount(1);
      await expect(lignesDeSessions(page).first()).toContainText("cette session");
      await expect(page.getByRole("button", { name: "Révoquer toutes mes autres sessions" }), "plus rien à révoquer").toHaveCount(0);
      expect(sessionsRedis(j)).toBe(1);
      expect((await autre.get(`${api()}/admin/me`, { failOnStatusCode: false })).status(), "l'autre session est coupée").toBe(401);
      /* a. Mauvais code : refus en français, la session reste ouverte (jamais /login). */
      const champ = page.getByLabel("Code de l'application d'authentification");
      await champ.fill("000000");
      await page.getByRole("button", { name: "Régénérer mes codes de secours" }).click();
      await expect(page.getByText(/^Code incorrect : saisis le code à six chiffres/)).toBeVisible({ timeout: 30_000 });
      await expect(page).toHaveURL(/\/sessions$/);
      /* a. Bon code (pas suivant : le pas de la connexion ne sert qu'une fois) → codes montrés une fois. */
      await new Promise((r) => setTimeout(r, (resteDuPas() + 1) * 1000));
      await champ.fill(totpCode(j.secret));
      await page.getByRole("button", { name: "Régénérer mes codes de secours" }).click();
      const liste = page.locator("section").filter({ has: page.getByRole("heading", { name: "Codes de secours" }) }).locator("ul li");
      await expect(liste.first()).toBeVisible({ timeout: 30_000 });
      const codes = (await liste.allInnerTexts()).map((c) => c.trim());
      expect(codes.length).toBeGreaterThanOrEqual(8);
      await page.getByRole("button", { name: "Je les ai notés" }).click();
      await expect(liste, "montrés une seule fois").toHaveCount(0);
      /* Un nouveau code ouvre une session ; l'avertissement « 1 code » a disparu. */
      const neuve = await requeteApi.newContext();
      expect((await neuve.post(`${api()}/auth/admin/login`, { data: { email: j.email, password: MOT_DE_PASSE_SEED } })).status()).toBe(200);
      const parSecours = await neuve.post(`${api()}/auth/admin/totp/verify`, { data: { code: codes[0] } });
      expect(parSecours.status(), "un code régénéré ouvre une session").toBe(200);
      expect(((await parSecours.json()) as { remainingBackupCodes: number }).remainingBackupCodes).toBe(codes.length - 1);
      await neuve.dispose();
      /* Journal : une ligne par geste, jamais un code en clair. */
      const lignes = (await lireLeJournal((await navigateurAdmin("finance")).contexte.request, { from: debut, adminUserId: j.id })).filter((l) => ["ADMIN_SESSIONS_REVOKED", "ADMIN_BACKUP_CODES_REGENERATED"].includes(l.action));
      expect(lignes.map((l) => [l.action, l.after])).toEqual([["ADMIN_SESSIONS_REVOKED", { count: 1 }], ["ADMIN_BACKUP_CODES_REGENERATED", { remaining: codes.length }]]);
      expect(JSON.stringify(lignes)).not.toContain(codes[1]);
      await autre.dispose();
    } finally {
      retirerLAcces(j);
    }
  });

  test("ADM-SES-7 · deux onglets renouvellent au même instant : une seule session, pas de fantôme (A190 d)", async () => {
    test.setTimeout(3 * 60_000);
    const j = creerAdminEnrole("SES-7", ["SUPPORT"]);
    try {
      const requete = await requeteApi.newContext();
      await connecterParApi(requete, j);
      expect(sessionsRedis(j)).toBe(1);
      const jeton = (await requete.storageState()).cookies.find((c) => c.name === "admin_refresh_token")!.value;
      const onglets = [0, 1, 2].map(() => requeteApi.newContext({ extraHTTPHeaders: { cookie: `admin_refresh_token=${jeton}` } }));
      const ctx = await Promise.all(onglets);
      const reponses = await Promise.all(ctx.map((c) => c.post(`${api()}/auth/admin/refresh`, { failOnStatusCode: false })));
      expect(reponses.map((r) => r.status()), "trois renouvellements simultanés du même jeton").toEqual([200, 200, 200]);
      expect(sessionsRedis(j), "une seule session suivante, aucune fantôme").toBe(1);
      const jtis = new Set(reponses.map((r) => /admin_refresh_token=([^;]+)/.exec(r.headers()["set-cookie"] ?? "")?.[1]).map((t) => JSON.parse(Buffer.from(t!.split(".")[1], "base64url").toString()).jti));
      expect(jtis.size, "les trois onglets reçoivent la même session").toBe(1);
      for (const c of ctx) await c.dispose();
      await requete.dispose();
    } finally {
      retirerLAcces(j);
    }
  });
});
