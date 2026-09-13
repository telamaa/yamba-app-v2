/**
 * web-cnx.spec.ts — cahier 01-WEB, chapitre 5.3 « Connexion, « Rester connecté », session, appareils »
 * ====================================================================================================
 * Ce fichier commence par la première anomalie que le harnais ait trouvée, avant même d'avoir
 * joué un seul scénario du cahier : `ANO-WEB-01` (trois vérifications, conservées telles quelles).
 * Puis les treize fiches WEB-CNX-1 à 13.
 *
 * Les navigateurs du cahier : **A** et **B** sont deux contextes distincts connectés au MÊME compte
 * (Aminata) — c'est la seule façon de prouver qu'une session révoquée depuis A meurt dans B.
 * Chaque connexion par l'écran est une vraie connexion (`parEcran`), jamais une session mémorisée :
 * les fiches parlent précisément de la naissance et de la mort des sessions.
 *
 * WEB-CNX-4 est marquée `test.fail` : la connexion par mot de passe n'a AUCUN verrou (ANO-WEB-19,
 * ouverte — le limiteur de la passerelle ignore les requêtes en échec, `skipFailedRequests`). Le
 * jour où le verrou existe, la fiche « passe » et Playwright le signale : retirer la marque.
 */
import { test, expect, type Navigateur } from "../fixtures/yamba";
import { adresseDeLApi, adresseDeLApiAdmin } from "../fixtures/adresses";
import { COMPTES, MOT_DE_PASSE_SEED } from "../fixtures/comptes";

type Page = Navigateur["page"];
type Contexte = Navigateur["contexte"];

const MOT_DE_PASSE_FAUX = "MauvaisMotDePasse1!";
/** Mot de passe de passage de WEB-CNX-10 (rétabli dans la même fiche, et en `finally`).
 *  Sans suite « date » (`2026` déclenche PASSWORD_LOOKS_LIKE_DATE), sans donnée personnelle. */
const MOT_DE_PASSE_PROVISOIRE = "Gxq-Mangue-Teal-7!";

/* ══ Aides ═══════════════════════════════════════════════════════════════════════════════════ */

/** Le formulaire de connexion de la PAGE (une fenêtre de connexion en monte un second, mêmes ids). */
const formulaire = (page: Page) => page.locator("main form").first();
const enTete = (page: Page) => page.getByRole("banner");

async function ouvrirLaConnexion(page: Page): Promise<void> {
  await page.goto("/fr/login", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Connecte-toi" })).toBeVisible({ timeout: 60_000 });
  // Hydraté quand le client a fait son premier appel d'API (sonde de session).
  await page.waitForResponse((r) => r.url().includes("/api/"), { timeout: 30_000 }).catch(() => undefined);
}

/** Envoie le formulaire de connexion de la page et rend la réponse de `POST /auth/login`. */
async function seConnecter(page: Page, email: string, motDePasse: string, memoriser = false) {
  const f = formulaire(page);
  await f.locator("#email").fill(email);
  await f.locator("#password").fill(motDePasse);
  if (memoriser) await f.locator('input[type="checkbox"]').check();
  const reponse = page.waitForResponse((r) => r.url().includes("/auth/login") && r.request().method() === "POST", { timeout: 30_000 });
  await f.locator("button[type=submit]").click();
  return reponse;
}

/** Le message d'erreur principal du formulaire de connexion (rôle alerte, dans la page). */
const erreurDeConnexion = (page: Page) => page.locator("main").locator('[role="alert"]').filter({ visible: true }).first();

/** `POST /auth/login` hors navigateur, avec les cookies du contexte. */
const connexionParApi = (contexte: Contexte, email: string, password: string) =>
  contexte.request.post(`${adresseDeLApi()}/auth/login`, { data: { email, password, rememberMe: false } });

/** La session du contexte répond-elle encore ? Sonde `/auth/me`, puis tente le rafraîchissement. */
async function sessionVivante(contexte: Contexte): Promise<boolean> {
  const api = adresseDeLApi();
  const me = await contexte.request.get(`${api}/auth/me`);
  if (me.ok()) return true;
  const refresh = await contexte.request.post(`${api}/auth/refresh`);
  return refresh.ok();
}

interface SessionApi {
  jti: string;
  device: string;
  ip: string | null;
  rememberMe: boolean;
  current: boolean;
  lastActivityAt: string;
}
async function sessionsParApi(contexte: Contexte): Promise<SessionApi[]> {
  const r = await contexte.request.get(`${adresseDeLApi()}/auth/me/sessions`);
  expect(r.ok(), "GET /auth/me/sessions").toBe(true);
  return ((await r.json()) as { items: SessionApi[] }).items;
}

/** La page Sécurité, sessions chargées. */
async function ouvrirLaSecurite(page: Page): Promise<void> {
  const sessions = page.waitForResponse((r) => r.url().includes("/auth/me/sessions") && r.request().method() === "GET", { timeout: 60_000 });
  await page.goto("/fr/dashboard/security", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Sécurité" })).toBeVisible({ timeout: 60_000 });
  await sessions;
  await expect(lignesAppareils(page).first()).toBeVisible({ timeout: 30_000 });
}

/** Une ligne par appareil connecté : celle qui porte « Dernière activité ». */
const lignesAppareils = (page: Page) => page.locator("main li").filter({ hasText: "Dernière activité" });
const ligneCetAppareil = (page: Page) => lignesAppareils(page).filter({ hasText: "cet appareil" });

const codeDe = (texte: string): string => {
  const code = /\b(\d{6})\b/.exec(texte)?.[1];
  if (!code) throw new Error("aucun code à six chiffres dans l'email");
  return code;
};

/** La fenêtre « Ta session a expiré » (AuthGateModal, nommée par son titre). */
const fenetreSessionExpiree = (page: Page) => page.getByRole("dialog", { name: "Ta session a expiré" });

/**
 * Une action serveur SANS rechargement : un lien de la barre latérale du tableau de bord. La
 * navigation est côté client ; c'est la section qui arrive qui interroge l'API.
 */
async function actionServeurSansRechargement(page: Page): Promise<void> {
  const lien = page.getByRole("link", { name: /Mes favoris/ }).filter({ visible: true }).first();
  await expect(lien).toBeVisible({ timeout: 30_000 });
  await lien.click();
}

/* ══ ANO-WEB-01 (harnais, 09/09) ═════════════════════════════════════════════════════════════ */

test.describe("WEB-CNX — connexion et session", () => {
  test("ANO-WEB-01 · un visiteur n'a jamais « de session expirée » sur l'écran de connexion", async ({ navigateurVisiteur }) => {
    const { page } = await navigateurVisiteur();

    // Le geste le plus banal du produit : un inconnu ouvre la page de connexion.
    await page.goto("/fr/login", { waitUntil: "networkidle" });
    await page.waitForTimeout(2_000); // le temps que /auth/me réponde 401 et que le rafraîchissement échoue

    // Avant correction : une fenêtre « Ta session a expiré » s'ouvrait par-dessus l'écran, et
    // son fond opaque interceptait les clics — le formulaire devenait inutilisable.
    await expect(page.locator('[role="dialog"][aria-modal="true"]')).toHaveCount(0);
    await expect(page.getByText("Ta session a expiré")).toHaveCount(0);

    // Et le formulaire est bel et bien utilisable : c'est la vraie vérification.
    const f = page.locator("main form").first();
    await f.locator("#email").fill(COMPTES.aminata.email);
    await f.locator("#password").fill(MOT_DE_PASSE_SEED);
    await f.locator("button[type=submit]").click({ timeout: 10_000 });
    await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
  });

  test("ANO-WEB-01 · le visiteur ne reçoit aucune fenêtre de session sur les pages publiques", async ({ navigateurVisiteur }) => {
    const { page } = await navigateurVisiteur();
    for (const chemin of ["/fr", "/fr/search", "/fr/register"]) {
      await page.goto(chemin, { waitUntil: "networkidle" });
      await page.waitForTimeout(1_500);
      await expect(page.getByText("Ta session a expiré"), `page ${chemin}`).toHaveCount(0);
    }
  });

  test("ANO-WEB-01 · le marqueur de session n'apparaît que pour un membre connecté", async ({ navigateurVisiteur, navigateurConnecte }) => {
    // Le marqueur est la pièce qui distingue « ta session a expiré » de « tu n'as jamais été
    // connecté ». Sa règle tient en deux lignes, et les deux se vérifient.
    const visiteur = await navigateurVisiteur();
    await visiteur.page.goto("/fr", { waitUntil: "networkidle" });
    await visiteur.page.waitForTimeout(1_500);
    expect(await visiteur.page.evaluate(() => localStorage.getItem("yamba:session"))).toBeNull();

    const membre = await navigateurConnecte("aminata");
    await membre.page.goto("/fr/dashboard/home", { waitUntil: "networkidle" });
    await expect.poll(async () => membre.page.evaluate(() => localStorage.getItem("yamba:session")), { timeout: 20_000 }).toBe("1");
  });
});

/* ══ Les fiches du chapitre 5.3 ══════════════════════════════════════════════════════════════ */

test.describe("WEB-CNX — connexion, « Rester connecté », session, appareils (chapitre 5.3)", () => {
  test("WEB-CNX-1 · l'écran de connexion", async ({ navigateurVisiteur }) => {
    const { page } = await navigateurVisiteur();
    await ouvrirLaConnexion(page);

    await expect(page.getByText("Connexion sécurisée")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Connecte-toi" })).toBeVisible();
    await expect(page.getByText("Reprends là où tu t'es arrêté·e.")).toBeVisible();

    const f = formulaire(page);
    await expect(f.getByText("E-mail", { exact: true })).toBeVisible();
    await expect(f.locator("#email")).toHaveAttribute("placeholder", "prenom@email.com");
    await expect(f.getByText("Mot de passe", { exact: true })).toBeVisible();
    await expect(f.locator("#password")).toHaveAttribute("type", "password");
    await expect(f.getByRole("button", { name: "Afficher le mot de passe" })).toBeVisible();
    await expect(f.getByRole("link", { name: "Oublié ?" })).toHaveAttribute("href", /\/password\/forgot/);

    // La case « Rester connecté » — DÉCOCHÉE à l'ouverture (cochée par défaut = majeure).
    const memoriser = f.locator('input[type="checkbox"]');
    await expect(memoriser).toHaveCount(1);
    await expect(memoriser).not.toBeChecked();
    await expect(f.getByText("Rester connecté sur cet appareil")).toBeVisible();
    await expect(f.getByText("Coché : 7 jours sans activité. Sinon : déconnexion après 60 minutes sans activité.")).toBeVisible();

    await expect(f.getByRole("button", { name: "Se connecter" })).toBeVisible();
    await expect(page.locator("main").getByText("ou par e-mail")).toBeVisible();
    await expect(page.locator("main").getByRole("button", { name: /Google/ })).toBeVisible();
    await expect(page.locator("main").getByRole("button", { name: "Continuer avec Facebook" })).toBeVisible();
    await expect(page.locator("main").getByText("Pas encore membre ?")).toBeVisible();
    await expect(page.locator("main").getByRole("link", { name: "Inscris-toi" })).toHaveAttribute("href", /\/register/);

    // Le bouton d'affichage montre le mot de passe, puis le masque.
    await f.locator("#password").fill("secret");
    await f.getByRole("button", { name: "Afficher le mot de passe" }).click();
    await expect(f.locator("#password")).toHaveAttribute("type", "text");
    await f.getByRole("button", { name: "Masquer le mot de passe" }).click();
    await expect(f.locator("#password")).toHaveAttribute("type", "password");
  });

  test("WEB-CNX-2 · identifiants incorrects : le même message, que le compte existe ou non", async ({ navigateurVisiteur }) => {
    const { page, contexte } = await navigateurVisiteur();
    await ouvrirLaConnexion(page);

    const r1 = await seConnecter(page, COMPTES.aminata.email, MOT_DE_PASSE_FAUX);
    expect(r1.status(), "mauvais mot de passe : refus").toBe(401);
    await expect(erreurDeConnexion(page)).toHaveText("E-mail ou mot de passe incorrect.");
    await expect(page).toHaveURL(/\/fr\/login/);

    const r2 = await seConnecter(page, "inconnu@seed.yamba.dev", MOT_DE_PASSE_FAUX);
    expect(r2.status(), "adresse inconnue : même statut").toBe(401);
    await expect(erreurDeConnexion(page)).toHaveText("E-mail ou mot de passe incorrect.");

    // La preuve va jusqu'au corps de la réponse : identique au caractère près (ANO-API-08 / 18).
    const corps = await Promise.all([
      connexionParApi(contexte, COMPTES.aminata.email, MOT_DE_PASSE_FAUX),
      connexionParApi(contexte, "inconnu@seed.yamba.dev", MOT_DE_PASSE_FAUX),
    ]);
    expect(corps[0].status()).toBe(corps[1].status());
    expect(await corps[0].text(), "corps identiques").toBe(await corps[1].text());
    expect((await contexte.cookies()).some((c) => c.name === "access_token"), "aucun cookie de session").toBe(false);
  });

  test("WEB-CNX-3 · connexion réussie, session standard", async ({ navigateurVisiteur }) => {
    const { page, contexte } = await navigateurVisiteur();
    await ouvrirLaConnexion(page);
    const r = await seConnecter(page, COMPTES.aminata.email, MOT_DE_PASSE_SEED, false);
    expect(r.ok(), "POST /auth/login").toBe(true);

    // Écart consigné : le produit atterrit sur l'accueil connecté (`/fr`), pas sur le tableau de
    // bord — le cahier dit « l'espace membre ». L'en-tête est celui d'un membre.
    await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
    const entete = enTete(page);
    const menu = entete.getByRole("button", { name: "Menu utilisateur" }).filter({ visible: true }).first();
    await expect(menu).toBeVisible({ timeout: 30_000 });
    await expect(entete.getByRole("link", { name: "Notifications" }).or(entete.getByRole("button", { name: "Notifications" })).filter({ visible: true }).first()).toBeVisible();
    await expect(entete.getByRole("link", { name: "Messages" }).filter({ visible: true }).first()).toBeVisible();
    await menu.click();
    await expect(page.getByText("Aminata").first()).toBeVisible();
    await page.keyboard.press("Escape");

    const cookies = await contexte.cookies();
    const acces = cookies.find((c) => c.name === "access_token");
    const rafraichissement = cookies.find((c) => c.name === "refresh_token");
    expect(acces, "cookie access_token").toBeTruthy();
    expect(rafraichissement, "cookie refresh_token").toBeTruthy();
    // Session standard : le cookie de rafraîchissement est un cookie de SESSION (sans date), le
    // profil « 60 minutes » vit côté serveur. « Rester connecté » (WEB-CNX-6) le rend persistant.
    expect(rafraichissement?.expires, "cookie de session (expires = -1)").toBe(-1);
    test.info().annotations.push({ type: "mesure", description: `atterrissage ${new URL(page.url()).pathname} · refresh_token expires=${rafraichissement?.expires} httpOnly=${rafraichissement?.httpOnly}` });
  });

  test("WEB-CNX-4 · trop de tentatives", async ({ navigateurVisiteur }) => {
    test.fail(true, "ANO-WEB-19 ouverte : aucun verrou sur la connexion par mot de passe (ni par compte, ni par adresse — le limiteur de la passerelle ignore les requêtes en échec)");
    const { page, contexte } = await navigateurVisiteur();

    // « Une dizaine de tentatives » : douze, par l'API, avec le mauvais mot de passe.
    const statuts: number[] = [];
    for (let i = 0; i < 12; i++) {
      statuts.push((await connexionParApi(contexte, COMPTES.aminata.email, MOT_DE_PASSE_FAUX)).status());
    }
    test.info().annotations.push({ type: "mesure", description: `statuts des douze tentatives : ${statuts.join(" ")}` });
    expect(statuts.some((s) => s === 429), "à partir d'un certain nombre, 429").toBe(true);

    await ouvrirLaConnexion(page);
    await seConnecter(page, COMPTES.aminata.email, MOT_DE_PASSE_FAUX);
    await expect(erreurDeConnexion(page)).toHaveText("Trop de tentatives. Réessaie dans quelques instants.");
  });

  test("WEB-CNX-5 · session expirée : la fenêtre s'ouvre sur place", async ({ navigateurConnecte }) => {
    const { page, contexte } = await navigateurConnecte("aminata", { parEcran: true });
    await page.goto("/fr/dashboard/shipments", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Mes envois" })).toBeVisible({ timeout: 60_000 });
    await page.waitForLoadState("networkidle").catch(() => undefined);

    // Étape 1 : les cookies `access_token` ET `refresh_token` disparaissent, sans rechargement.
    await contexte.clearCookies();
    expect((await contexte.cookies()).length).toBe(0);

    // Étape 2 : une action serveur, sans recharger.
    const adresseAvant = page.url();
    await actionServeurSansRechargement(page);

    const fenetre = fenetreSessionExpiree(page);
    await expect(fenetre).toBeVisible({ timeout: 30_000 });
    await expect(fenetre.getByText("Par sécurité, une session se ferme après une heure sans activité (coche « Rester connecté » pour 7 jours). Reconnecte-toi : tu restes sur cette page.")).toBeVisible();
    // La page ne change pas : toujours le tableau de bord, pas l'écran de connexion, pas d'erreur.
    await expect(page).toHaveURL(/\/fr\/dashboard\//);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText(/Erreur, réessaye|Une erreur est survenue/)).toHaveCount(0);
    // Le formulaire est DANS la fenêtre.
    await expect(fenetre.locator("form #email")).toBeVisible();
    await expect(fenetre.locator("form #password")).toBeVisible();

    // Reconnexion depuis la fenêtre : elle se ferme, la page reprend.
    await fenetre.locator("form #email").fill(COMPTES.aminata.email);
    await fenetre.locator("form #password").fill(MOT_DE_PASSE_SEED);
    const reponse = page.waitForResponse((r) => r.url().includes("/auth/login") && r.request().method() === "POST", { timeout: 30_000 });
    await fenetre.locator("form button[type=submit]").click();
    expect((await reponse).ok(), "POST /auth/login depuis la fenêtre").toBe(true);
    await expect(fenetre).toBeHidden({ timeout: 30_000 });
    await expect(page).toHaveURL(/\/fr\/dashboard\//);
    await expect(enTete(page).getByRole("button", { name: "Menu utilisateur" }).filter({ visible: true }).first()).toBeVisible({ timeout: 30_000 });
    expect((await contexte.cookies()).some((c) => c.name === "access_token"), "session rouverte").toBe(true);
    test.info().annotations.push({ type: "mesure", description: `page avant ${new URL(adresseAvant).pathname} → après ${new URL(page.url()).pathname}` });
  });

  test("WEB-CNX-6 · « Rester connecté » ouvre l'autre profil de session", async ({ navigateurConnecte }) => {
    // A : la case cochée. B : sans la case. Le même compte, deux profils.
    const A = await navigateurConnecte("aminata", { memoriser: true });
    const rafraichissementA = (await A.contexte.cookies()).find((c) => c.name === "refresh_token");
    // Un cookie PERSISTANT (une date, pas -1) : c'est le fait qui distingue le profil « mémorisé »
    // de la session standard (WEB-CNX-3, cookie de session). Le cookie porte la vie ABSOLUE de la
    // session mémorisée (30 jours, D27/SES-02) ; l'inactivité de 7 jours vit côté serveur.
    expect(rafraichissementA?.expires ?? -1, "cookie persistant").toBeGreaterThan(0);
    const joursA = ((rafraichissementA?.expires ?? 0) * 1000 - Date.now()) / 86_400_000;
    expect(joursA, "vie absolue ≈ 30 jours").toBeGreaterThan(29);
    expect(joursA).toBeLessThanOrEqual(30.1);

    await ouvrirLaSecurite(A.page);
    await expect(ligneCetAppareil(A.page)).toHaveCount(1);
    await expect(ligneCetAppareil(A.page)).toContainText("connexion mémorisée");

    const B = await navigateurConnecte("aminata", { parEcran: true });
    await ouvrirLaSecurite(B.page);
    await expect(ligneCetAppareil(B.page)).toHaveCount(1);
    await expect(ligneCetAppareil(B.page)).not.toContainText("connexion mémorisée");
    // Vu de B, la ligne de A porte la mention : c'est la session, pas l'écran, qui la porte.
    const sessions = await sessionsParApi(B.contexte);
    expect(sessions.find((s) => s.current)?.rememberMe).toBe(false);
    expect(sessions.some((s) => !s.current && s.rememberMe), "la session A est mémorisée").toBe(true);
    test.info().annotations.push({ type: "mesure", description: `refresh_token de A : ${joursA.toFixed(2)} jours (vie absolue)` });
  });

  test("WEB-CNX-7 · la liste des appareils connectés", async ({ navigateurConnecte }) => {
    const { page, contexte } = await navigateurConnecte("aminata", { parEcran: true });
    await ouvrirLaSecurite(page);

    // Écart consigné : la rubrique s'appelle « Sessions actives », le cahier dit « Appareils connectés ».
    await expect(page.getByRole("heading", { name: "Sessions actives" })).toBeVisible();
    expect(await lignesAppareils(page).count()).toBeGreaterThanOrEqual(1);
    const courante = ligneCetAppareil(page);
    await expect(courante).toHaveCount(1);
    // Navigateur et système dérivés de l'agent utilisateur (« Chrome · macOS » — le cahier
    // donne « Chrome sur macOS » en exemple), la dernière activité, l'adresse IP.
    await expect(courante).toContainText(/Chrome · (macOS|Windows|Linux)/);
    await expect(courante).toContainText("Dernière activité");
    await expect(courante).toContainText(/\d{2}\/\d{2}\/\d{4}/);
    await expect(courante).toContainText(/(\d{1,3}\.){3}\d{1,3}|::1|::ffff:/);
    await expect(courante.getByRole("button", { name: "Me déconnecter ici" })).toBeVisible();

    const api = await sessionsParApi(contexte);
    const mienne = api.find((s) => s.current);
    test.info().annotations.push({ type: "mesure", description: `${api.length} session(s) · courante : ${mienne?.device} · ${mienne?.ip}` });
  });

  test("WEB-CNX-8 et 9 · déconnecter un autre appareil, puis tous les autres", async ({ navigateurConnecte }) => {
    test.setTimeout(4 * 60_000);
    const A = await navigateurConnecte("aminata", { parEcran: true });
    // Un état de départ propre : A ferme les sessions laissées par les chapitres précédents, pour
    // que « deux appareils » veuille dire deux. (Le produit le permet : c'est la fiche 9.)
    await A.contexte.request.delete(`${adresseDeLApi()}/auth/me/sessions`);
    const B = await navigateurConnecte("aminata", { parEcran: true });
    await B.page.goto("/fr/dashboard/home", { waitUntil: "domcontentloaded" });
    await expect(enTete(B.page).getByRole("button", { name: "Menu utilisateur" }).filter({ visible: true }).first()).toBeVisible({ timeout: 60_000 });

    await test.step("WEB-CNX-8 · déconnecter un autre appareil", async () => {
      await ouvrirLaSecurite(A.page);
      await expect(lignesAppareils(A.page)).toHaveCount(2);
      await expect(ligneCetAppareil(A.page)).toHaveCount(1);
      await expect(A.page.getByRole("button", { name: "Déconnecter les autres appareils" })).toBeVisible();

      const autre = lignesAppareils(A.page).filter({ hasNotText: "cet appareil" });
      await expect(autre).toHaveCount(1);
      const revocation = A.page.waitForResponse((r) => /\/auth\/me\/sessions\/[^/?]+$/.test(r.url()) && r.request().method() === "DELETE", { timeout: 30_000 });
      await autre.getByRole("button", { name: "Déconnecter" }).click();
      expect((await revocation).ok(), "DELETE /auth/me/sessions/:jti").toBe(true);
      await expect(lignesAppareils(A.page)).toHaveCount(1, { timeout: 30_000 });
      await expect(ligneCetAppareil(A.page)).toHaveCount(1);
      // Un message de confirmation (ANO-WEB-20).
      await expect(A.page.locator("main").getByText("Appareil déconnecté.")).toBeVisible();

      // Dans B : la session est morte côté serveur…
      expect(await sessionVivante(B.contexte), "la session de B ne répond plus").toBe(false);
      // … et une action serveur ouvre « Ta session a expiré » (ou renvoie à la connexion).
      await actionServeurSansRechargement(B.page);
      const fenetre = fenetreSessionExpiree(B.page);
      await expect(fenetre.or(B.page.getByRole("heading", { name: "Connecte-toi" }))).toBeVisible({ timeout: 30_000 });
    });

    await test.step("WEB-CNX-9 · « Déconnecter les autres appareils »", async () => {
      // B se reconnecte (dans la fenêtre, s'il l'a ; par l'écran sinon).
      const fenetre = fenetreSessionExpiree(B.page);
      if (await fenetre.isVisible()) {
        await fenetre.locator("form #email").fill(COMPTES.aminata.email);
        await fenetre.locator("form #password").fill(MOT_DE_PASSE_SEED);
        const r = B.page.waitForResponse((x) => x.url().includes("/auth/login") && x.request().method() === "POST", { timeout: 30_000 });
        await fenetre.locator("form button[type=submit]").click();
        expect((await r).ok()).toBe(true);
        await expect(fenetre).toBeHidden({ timeout: 30_000 });
      } else {
        await ouvrirLaConnexion(B.page);
        expect((await seConnecter(B.page, COMPTES.aminata.email, MOT_DE_PASSE_SEED)).ok()).toBe(true);
      }
      expect(await sessionVivante(B.contexte), "B reconnecté").toBe(true);

      await A.page.reload({ waitUntil: "domcontentloaded" });
      await expect(lignesAppareils(A.page)).toHaveCount(2, { timeout: 60_000 });
      const revocation = A.page.waitForResponse((r) => /\/auth\/me\/sessions$/.test(r.url()) && r.request().method() === "DELETE", { timeout: 30_000 });
      await A.page.getByRole("button", { name: "Déconnecter les autres appareils" }).click();
      const corps = (await (await revocation).json()) as { revoked: number };
      expect(corps.revoked).toBeGreaterThanOrEqual(1);
      await expect(A.page.locator("main").getByText(`${corps.revoked} appareil(s) déconnecté(s).`)).toBeVisible();
      await expect(lignesAppareils(A.page)).toHaveCount(1, { timeout: 30_000 });
      await expect(ligneCetAppareil(A.page)).toHaveCount(1);
      expect(await sessionVivante(B.contexte), "B a perdu sa session").toBe(false);
      test.info().annotations.push({ type: "mesure", description: `révoquées : ${corps.revoked}` });
    });
  });

  test("WEB-CNX-10 et 11 · la porte de confirmation, puis la fenêtre de 15 minutes", async ({ navigateurConnecte, mailpit }) => {
    test.setTimeout(7 * 60_000);
    const { page, contexte } = await navigateurConnecte("aminata", { parEcran: true });
    const api = adresseDeLApi();
    const sujetSudo = "Ton code de confirmation Yamba";
    let motDePasseCourant = MOT_DE_PASSE_SEED;

    /**
     * Ouvre une fenêtre sudo par les endpoints autonomes, avec le code lu dans Mailpit. Un délai
     * d'une minute sépare deux demandes de code (OTP_COOLDOWN, six par heure au plus) : si un code
     * vient d'être envoyé, on ATTEND ce délai puis on redemande UNE fois — jamais en rafale, qui
     * grillerait le quota anti-spam.
     */
    async function ouvrirFenetreSudo(): Promise<void> {
      const avant = await mailpit.compter({ pour: COMPTES.aminata.email, sujet: sujetSudo });
      let statut = (await contexte.request.post(`${api}/auth/me/sudo/request`)).status();
      if (statut === 400) {
        await page.waitForTimeout(62_000); // cooldown d'une minute entre deux codes
        statut = (await contexte.request.post(`${api}/auth/me/sudo/request`)).status();
      }
      expect(statut, "POST /auth/me/sudo/request").toBe(200);
      await expect.poll(() => mailpit.compter({ pour: COMPTES.aminata.email, sujet: sujetSudo }), { timeout: 45_000 }).toBe(avant + 1);
      const email = await mailpit.attendreEmail({ pour: COMPTES.aminata.email, sujet: sujetSudo });
      expect((await contexte.request.post(`${api}/auth/me/sudo/verify`, { data: { code: codeDe(email.texte) } })).ok(), "POST /auth/me/sudo/verify").toBe(true);
    }

    try {
      await test.step("WEB-CNX-10 · la porte de confirmation d'un geste sensible", async () => {
        await ouvrirLaSecurite(page);
        const emailsAvant = await mailpit.compter({ pour: COMPTES.aminata.email, sujet: sujetSudo });

        // « Changer » sur la rubrique du mot de passe. Écart consigné : le produit ouvre d'abord
        // le formulaire, et la porte se présente au moment du geste (403 SUDO_REQUIRED) — le
        // cahier attendait la porte AVANT tout formulaire. La règle (aucun geste sans code) tient.
        await page.locator("main").getByRole("button", { name: "Changer", exact: true }).first().click();
        await expect(page.getByRole("heading", { name: "Nouveau mot de passe" })).toBeVisible();
        await page.getByPlaceholder("Nouveau mot de passe").fill(MOT_DE_PASSE_PROVISOIRE);
        await page.getByPlaceholder("Confirme le mot de passe").fill(MOT_DE_PASSE_PROVISOIRE);
        const refus = page.waitForResponse((r) => r.url().includes("/auth/me/password") && r.request().method() === "POST", { timeout: 30_000 });
        await page.getByRole("button", { name: "Changer le mot de passe" }).click();
        const r403 = await refus;
        expect(r403.status(), "403 SUDO_REQUIRED").toBe(403);
        expect(((await r403.json()) as { details?: { code?: string } }).details?.code).toBe("SUDO_REQUIRED");

        // La porte : titre, explication, « M'envoyer le code ».
        await expect(page.getByText("Confirme que c'est bien toi")).toBeVisible();
        await expect(page.getByText("Pour ce geste sensible, on t'envoie un code à six chiffres par email. Il ouvre une fenêtre de 15 minutes sur cet appareil.")).toBeVisible();
        const envoi = page.waitForResponse((r) => r.url().includes("/auth/me/sudo/request") && r.request().method() === "POST", { timeout: 30_000 });
        await page.getByRole("button", { name: "M'envoyer le code" }).click();
        expect((await envoi).ok(), "POST /auth/me/sudo/request").toBe(true);
        await expect(page.getByText("Code envoyé : regarde ta boîte mail (et les spams).")).toBeVisible();

        await expect.poll(() => mailpit.compter({ pour: COMPTES.aminata.email, sujet: sujetSudo }), { timeout: 45_000 }).toBe(emailsAvant + 1);
        const email = await mailpit.attendreEmail({ pour: COMPTES.aminata.email, sujet: sujetSudo });
        const code = codeDe(email.texte);
        await page.getByLabel("Code reçu par email").fill(code);
        const verification = page.waitForResponse((r) => r.url().includes("/auth/me/sudo/verify") && r.request().method() === "POST", { timeout: 30_000 });
        const changement = page.waitForResponse((r) => r.url().includes("/auth/me/password") && r.request().method() === "POST" && r.status() !== 403, { timeout: 30_000 });
        await page.getByRole("button", { name: "Confirmer" }).click();
        expect((await verification).ok(), "POST /auth/me/sudo/verify").toBe(true);
        // Le code accepté REJOUE le geste (écart : le cahier dit « ouvre le formulaire »).
        expect((await changement).ok(), "POST /auth/me/password rejoué").toBe(true);
        motDePasseCourant = MOT_DE_PASSE_PROVISOIRE;
        await expect(page.locator("main").getByText(/Mot de passe changé/)).toBeVisible();

        // Écart consigné (5.3) : un changement de mot de passe FERME la fenêtre sudo
        // (`closeSudoWindow`, D65) — bonne sécurité : le geste suivant se reconfirme. Le cahier
        // (WEB-CNX-11) supposait la fenêtre encore ouverte après CE geste précis ; elle ne l'est
        // pas. On le vérifie, puis on rétablit le mot de passe par une NOUVELLE porte.
        const statut = (await (await contexte.request.get(`${api}/auth/me/sudo`)).json()) as { active: boolean };
        expect(statut.active, "la fenêtre sudo est fermée après un changement de mot de passe").toBe(false);
      });

      // UNE fenêtre couvre les DEUX gestes qui suivent (l'export de WEB-CNX-11 et le
      // rétablissement du mot de passe) — c'est exactement la propriété que le cahier veut prouver :
      // un seul code, plusieurs gestes sensibles. La demande patiente le cooldown d'une minute.
      await ouvrirFenetreSudo();
      const statut = (await (await contexte.request.get(`${api}/auth/me/sudo`)).json()) as { active: boolean; expiresAt: string | null };
      expect(statut.active, "fenêtre sudo ouverte").toBe(true);
      const minutes = (new Date(statut.expiresAt ?? 0).getTime() - Date.now()) / 60_000;
      expect(minutes).toBeGreaterThan(13);
      expect(minutes).toBeLessThanOrEqual(15.1);
      test.info().annotations.push({ type: "mesure", description: `fenêtre sudo : ${minutes.toFixed(1)} min restantes` });

      await test.step("WEB-CNX-11 · la fenêtre de 15 minutes couvre un second geste", async () => {
        // « Télécharger mes données » dans la fenêtre ouverte ci-dessus : aucun code redemandé.
        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(page.getByRole("heading", { name: "Sécurité" })).toBeVisible({ timeout: 60_000 });
        const emailsAvant = await mailpit.compter({ pour: COMPTES.aminata.email, sujet: sujetSudo });
        await page.locator("main").getByRole("button", { name: "Télécharger", exact: true }).click();
        await expect(page.getByRole("button", { name: "Télécharger le fichier" })).toBeVisible();
        const telechargement = page.waitForEvent("download", { timeout: 30_000 }).catch(() => null);
        const reponse = page.waitForResponse((r) => r.url().includes("/auth/me/data-export") && r.request().method() === "POST", { timeout: 30_000 });
        await page.getByRole("button", { name: "Télécharger le fichier" }).click();
        const r = await reponse;
        // Aucun code redemandé : ni porte à l'écran, ni email, jamais 403 SUDO_REQUIRED.
        await expect(page.getByText("Confirme que c'est bien toi")).toHaveCount(0);
        expect(r.status(), "jamais 403 SUDO_REQUIRED").not.toBe(403);
        expect(await mailpit.compter({ pour: COMPTES.aminata.email, sujet: sujetSudo })).toBe(emailsAvant);
        if (r.ok()) {
          const fichier = await telechargement;
          expect(fichier?.suggestedFilename(), "le téléchargement démarre").toMatch(/\.json$/);
          await expect(page.locator("main").getByText(/Ton fichier est téléchargé/)).toBeVisible();
          test.info().annotations.push({ type: "mesure", description: `fichier : ${fichier?.suggestedFilename()}` });
        } else {
          // Un export par 24 h (D63) : un second passage le même jour est refusé AVANT la porte
          // sudo (le contrôle du délai précède `requireSudo`) — la fiche reste prouvée (aucun
          // code demandé), le fichier est celui du premier passage.
          const corps = (await r.json()) as { details?: { code?: string } };
          expect(corps.details?.code, "second passage du jour").toBe("EXPORT_RATE_LIMITED");
          test.info().annotations.push({ type: "mesure", description: "export déjà fait dans les 24 h : EXPORT_RATE_LIMITED (aucun code demandé)" });
        }
      });

      // Troisième geste dans la même fenêtre : le rétablissement du mot de passe, toujours sans
      // nouveau code (il refermera la fenêtre, lui — c'est le dernier).
      const emailsAvantRetour = await mailpit.compter({ pour: COMPTES.aminata.email, sujet: sujetSudo });
      const retour = await contexte.request.post(`${api}/auth/me/password`, { data: { newPassword: MOT_DE_PASSE_SEED } });
      expect(retour.ok(), "retour au mot de passe du seed dans la même fenêtre").toBe(true);
      expect(await mailpit.compter({ pour: COMPTES.aminata.email, sujet: sujetSudo }), "aucun code pour le troisième geste").toBe(emailsAvantRetour);
      motDePasseCourant = MOT_DE_PASSE_SEED;
    } finally {
      // Quoi qu'il arrive, Aminata garde le mot de passe du jeu d'essai.
      if (motDePasseCourant !== MOT_DE_PASSE_SEED) {
        await ouvrirFenetreSudo().catch(() => undefined);
        const r = await contexte.request.post(`${api}/auth/me/password`, { data: { newPassword: MOT_DE_PASSE_SEED } });
        if (!r.ok()) throw new Error(`Mot de passe d'Aminata NON rétabli (${r.status()}) : rejouer seed-deals.ts.`);
      }
    }
  });

  test("WEB-CNX-12 · la fenêtre sudo est liée à l'appareil", async ({ navigateurConnecte }) => {
    // A ouvre sa fenêtre (par la porte, sur un geste sensible) ; B, même compte, autre appareil,
    // n'en bénéficie pas. Le geste choisi pour B est le mot de passe : « Télécharger mes données »
    // est refusé AVANT la porte quand un export a eu lieu dans les 24 h (WEB-CNX-11) — la règle
    // éprouvée est la même : B redemande un code.
    const A = await navigateurConnecte("aminata", { parEcran: true });
    const B = await navigateurConnecte("aminata", { parEcran: true });
    const api = adresseDeLApi();

    const statutA = (await (await A.contexte.request.get(`${api}/auth/me/sudo`)).json()) as { active: boolean };
    const statutB = (await (await B.contexte.request.get(`${api}/auth/me/sudo`)).json()) as { active: boolean };
    test.info().annotations.push({ type: "mesure", description: `fenêtre sudo à l'ouverture — A : ${statutA.active}, B : ${statutB.active}` });

    await ouvrirLaSecurite(B.page);
    await B.page.locator("main").getByRole("button", { name: "Changer", exact: true }).first().click();
    await B.page.getByPlaceholder("Nouveau mot de passe").fill(MOT_DE_PASSE_PROVISOIRE);
    await B.page.getByPlaceholder("Confirme le mot de passe").fill(MOT_DE_PASSE_PROVISOIRE);
    const refus = B.page.waitForResponse((r) => r.url().includes("/auth/me/password") && r.request().method() === "POST", { timeout: 30_000 });
    await B.page.getByRole("button", { name: "Changer le mot de passe" }).click();
    const r = await refus;
    expect(r.status(), "B : 403 SUDO_REQUIRED").toBe(403);
    expect(((await r.json()) as { details?: { code?: string } }).details?.code).toBe("SUDO_REQUIRED");
    await expect(B.page.getByText("Confirme que c'est bien toi")).toBeVisible();
    await expect(B.page.getByRole("button", { name: "M'envoyer le code" })).toBeVisible();
    // Rien n'a changé : le mot de passe d'Aminata est toujours celui du jeu d'essai.
    expect((await B.contexte.request.post(`${api}/auth/login`, { data: { email: COMPTES.aminata.email, password: MOT_DE_PASSE_SEED } })).ok()).toBe(true);
    await B.page.getByRole("button", { name: "Annuler" }).first().click();
  });

  test("WEB-CNX-13 · un compte suspendu ne se connecte plus", async ({ navigateurConnecte, navigateurVisiteur, navigateurAdmin, mailpit, jeuEssai }) => {
    test.setTimeout(4 * 60_000);
    const cible = COMPTES.marieclaire;
    const idCible = jeuEssai.membre("marieclaire");
    const apiAdmin = adresseDeLApiAdmin();

    // Une session vivante ailleurs, avant la suspension.
    const ailleurs = await navigateurConnecte("marieclaire", { parEcran: true });
    expect(await sessionVivante(ailleurs.contexte)).toBe(true);

    // Le back-office : la médiation suspend (users.suspension.apply — MEDIATOR).
    const admin = await navigateurAdmin("mediateur");
    const motif = "Recette WEB-CNX-13 : suspension de contrôle du chapitre 5.3, levée par la même fiche.";
    const suspension = await admin.contexte.request.post(`${apiAdmin}/admin/users/${idCible}/suspension`, { data: { level: "SUSPENDED", reason: motif } });
    expect(suspension.status(), `POST /admin/users/:id/suspension → ${await suspension.text()}`).toBe(200);

    try {
      // La session vivante ailleurs est révoquée.
      expect(await sessionVivante(ailleurs.contexte), "session révoquée à la suspension").toBe(false);

      // L'écran : le message, aucune session.
      const { page, contexte } = await navigateurVisiteur();
      await ouvrirLaConnexion(page);
      const r = await seConnecter(page, cible.email, MOT_DE_PASSE_SEED);
      expect(r.status()).toBe(401);
      expect(((await r.json()) as { details?: { code?: string } }).details?.code).toBe("ACCOUNT_SUSPENDED");
      await expect(erreurDeConnexion(page)).toHaveText("Ton compte est suspendu. Consulte l'email reçu ou écris au support pour contester.");
      await expect(page).toHaveURL(/\/fr\/login/);
      expect((await contexte.cookies()).some((c) => c.name === "access_token" || c.name === "refresh_token"), "aucune session ouverte").toBe(false);

      // L'email reçu, celui que le message invite à consulter.
      const email = await mailpit.attendreEmail({ pour: cible.email, sujet: "Ton compte Yamba est suspendu" });
      expect(email.texte).toContain(cible.prenom);
      // Marie-Claire est Expéditrice : aucun trajet publié à retirer de la recherche (le filtre
      // `accountStatus ≠ SUSPENDED` de la recherche est celui de WEB-E2E / trip-service).
    } finally {
      const levee = await admin.contexte.request.delete(`${apiAdmin}/admin/users/${idCible}/suspension`, { data: { reason: motif } });
      if (levee.status() !== 200) throw new Error(`Suspension de ${cible.email} NON levée (${levee.status()} ${await levee.text()}) : la lever à la main.`);
    }
    // Levée : la connexion repasse.
    const { page } = await navigateurVisiteur();
    await ouvrirLaConnexion(page);
    expect((await seConnecter(page, cible.email, MOT_DE_PASSE_SEED)).ok(), "connexion après levée").toBe(true);
  });
});
