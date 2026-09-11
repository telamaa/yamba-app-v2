/**
 * web-mdp.spec.ts — cahier 01-WEB, chapitre 5.4 « Mot de passe et adresse email »
 * ==============================================================================
 * Le parcours « Mot de passe oublié » d'un visiteur, puis le changement de mot de passe et le
 * changement d'adresse email d'un membre.
 *
 * Tout se joue sur des comptes NEUFS, créés et activés par le harnais (`compteNeuf()`,
 * `neuf-<horodatage>@recette.yamba.dev`), jamais sur le seed : ce chapitre change des mots de
 * passe ET une adresse email de façon définitive — un compte du seed en sortirait abîmé, et sa
 * correspondance `seed-output.json` fausse. Chaque compte ne vit que pour son test.
 *
 * Les codes (activation, réinitialisation, sudo, changement d'adresse) ont chacun leur compteur
 * anti-spam (six par heure, un par minute). Sur une adresse neuve les compteurs sont vierges ;
 * la seule attente est le cooldown d'une minute quand deux codes du MÊME scope se suivent.
 */
import { test, expect, type Navigateur } from "../fixtures/yamba";
import { adresseDeLApi } from "../fixtures/adresses";
import { compteNeuf, type CompteNeuf } from "../fixtures/compte-neuf";
import { COMPTES } from "../fixtures/comptes";
import type { Mailpit } from "../fixtures/mailpit";

type Page = Navigateur["page"];
type Contexte = Navigateur["contexte"];

const NOUVEAU_MOT_DE_PASSE = "Kola-Mangue-7x-Teal!"; // ni prénom (Recette), ni suite « date », ni donnée personnelle

const SUJET_ACTIVATION = "Ton code d'activation Yamba";
const SUJET_RESET = "Ton code de réinitialisation Yamba";
const SUJET_MDP_CHANGE = "Ton mot de passe Yamba a été modifié";
const SUJET_NOUVELLE_ADRESSE = "Confirme ta nouvelle adresse email Yamba";
const SUJET_ANCIENNE_ADRESSE = "L'adresse email de ton compte Yamba a changé";
const SUJET_SUDO = "Ton code de confirmation Yamba";

/* ══ Aides ═══════════════════════════════════════════════════════════════════════════════════ */

const formulaire = (page: Page) => page.locator("main form").first();
const codeDe = (texte: string): string => {
  const code = /\b(\d{6})\b/.exec(texte)?.[1];
  if (!code) throw new Error("aucun code à six chiffres dans l'email");
  return code;
};

async function attendreHydratation(page: Page): Promise<void> {
  await page.waitForResponse((r) => r.url().includes("/api/"), { timeout: 30_000 }).catch(() => undefined);
}

/** Inscrit puis active un compte neuf par l'écran (registration + code email). */
async function creerCompteActive(page: Page, mailpit: Mailpit, compte: CompteNeuf): Promise<void> {
  await page.goto("/fr/register", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Deviens Voyageur" })).toBeVisible({ timeout: 60_000 });
  await attendreHydratation(page);
  const f = formulaire(page);
  await f.locator("#firstName").fill(compte.prenom);
  await f.locator("#lastName").fill(compte.nom);
  await f.locator("#email").fill(compte.email);
  await f.locator("#password").fill(compte.motDePasse);
  await f.locator("#passwordConfirm").fill(compte.motDePasse);
  await f.locator('input[type="checkbox"]').check();
  const reg = page.waitForResponse((r) => r.url().includes("/auth/register") && !r.url().includes("/register/") && r.request().method() === "POST", { timeout: 30_000 });
  await f.getByRole("button", { name: "Créer mon compte" }).click();
  expect((await reg).ok(), "POST /auth/register").toBe(true);
  await expect(page).toHaveURL(/\/fr\/register\/verify/, { timeout: 60_000 });

  const email = await mailpit.attendreEmail({ pour: compte.email, sujet: SUJET_ACTIVATION });
  const code = codeDe(email.texte);
  for (const [i, c] of code.split("").entries()) await page.getByLabel(`OTP digit ${i + 1}`).fill(c);
  const verif = page.waitForResponse((r) => r.url().includes("/auth/register/verify") && r.request().method() === "POST", { timeout: 30_000 });
  await page.getByRole("button", { name: "Valider mon code" }).click();
  expect((await verif).ok(), "POST /auth/register/verify").toBe(true);
  await expect(page).toHaveURL(/\/fr\/login\?verified=1/, { timeout: 60_000 });
}

/** Connexion par l'écran, dans un contexte donné (compte hors `COMPTES`). */
async function connecter(page: Page, email: string, motDePasse: string): Promise<void> {
  await page.goto("/fr/login", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Connecte-toi" })).toBeVisible({ timeout: 60_000 });
  await attendreHydratation(page);
  const f = formulaire(page);
  await f.locator("#email").fill(email);
  await f.locator("#password").fill(motDePasse);
  const rep = page.waitForResponse((r) => r.url().includes("/auth/login") && r.request().method() === "POST", { timeout: 30_000 });
  await f.locator("button[type=submit]").click();
  expect((await rep).ok(), `connexion de ${email}`).toBe(true);
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

async function sessionVivante(contexte: Contexte): Promise<boolean> {
  const api = adresseDeLApi();
  const me = await contexte.request.get(`${api}/auth/me`);
  if (me.ok()) return true;
  return (await contexte.request.post(`${api}/auth/refresh`)).ok();
}

async function ouvrirLaSecurite(page: Page): Promise<void> {
  const sessions = page.waitForResponse((r) => r.url().includes("/auth/me/sessions") && r.request().method() === "GET", { timeout: 60_000 });
  await page.goto("/fr/dashboard/security", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Sécurité" })).toBeVisible({ timeout: 60_000 });
  await sessions;
}

/** Ouvre une fenêtre sudo par les endpoints autonomes (un code par minute au plus). */
async function ouvrirFenetreSudo(page: Page, contexte: Contexte, mailpit: Mailpit, email: string): Promise<void> {
  const api = adresseDeLApi();
  const avant = await mailpit.compter({ pour: email, sujet: SUJET_SUDO });
  let statut = (await contexte.request.post(`${api}/auth/me/sudo/request`)).status();
  if (statut === 400) {
    await page.waitForTimeout(62_000);
    statut = (await contexte.request.post(`${api}/auth/me/sudo/request`)).status();
  }
  expect(statut, "POST /auth/me/sudo/request").toBe(200);
  await expect.poll(() => mailpit.compter({ pour: email, sujet: SUJET_SUDO }), { timeout: 45_000 }).toBe(avant + 1);
  const mail = await mailpit.attendreEmail({ pour: email, sujet: SUJET_SUDO });
  expect((await contexte.request.post(`${api}/auth/me/sudo/verify`, { data: { code: codeDe(mail.texte) } })).ok(), "POST /auth/me/sudo/verify").toBe(true);
}

/* ══ Les fiches ══════════════════════════════════════════════════════════════════════════════ */

test.describe("WEB-MDP — mot de passe et adresse email (chapitre 5.4)", () => {
  test("WEB-MDP-1 et 3 · mot de passe oublié ne révèle rien, et le retour à la connexion", async ({ navigateurVisiteur, mailpit }) => {
    const { page } = await navigateurVisiteur();
    await page.goto("/fr/login", { waitUntil: "domcontentloaded" });
    await attendreHydratation(page);
    await page.locator("main").getByRole("link", { name: "Oublié ?" }).first().click();
    await expect(page).toHaveURL(/\/fr\/password\/forgot/);
    await expect(page.getByRole("heading", { name: "Mot de passe oublié ?" })).toBeVisible();

    // WEB-MDP-3 d'abord : « Retour à la connexion » ramène sans rien perdre.
    await page.getByRole("link", { name: "Retour à la connexion" }).click();
    await expect(page).toHaveURL(/\/fr\/login/);
    await expect(page.getByRole("heading", { name: "Connecte-toi" })).toBeVisible();

    // WEB-MDP-1 : une adresse inexistante — l'écran avance, aucun email n'est envoyé.
    await page.locator("main").getByRole("link", { name: "Oublié ?" }).first().click();
    await expect(page).toHaveURL(/\/fr\/password\/forgot/);
    const inexistante = `inexistant-${Date.now()}@recette.yamba.dev`;
    await page.locator("#forgot-email").fill(inexistante);
    const rep = page.waitForResponse((r) => r.url().includes("/auth/password/forgot") && r.request().method() === "POST", { timeout: 30_000 });
    await page.getByRole("button", { name: "Envoyer le code" }).click();
    expect((await rep).ok(), "le serveur répond OK sans dire si le compte existe").toBe(true);
    await expect(page).toHaveURL(/\/fr\/password\/verify/, { timeout: 30_000 });
    await mailpit.aucunEmailPour(inexistante);
  });

  test("WEB-MDP-2 · réinitialisation complète d'un mot de passe", async ({ navigateurVisiteur, mailpit }) => {
    test.setTimeout(4 * 60_000);
    const compte = compteNeuf("Recette", "Mdp");
    const creation = await navigateurVisiteur();
    await creerCompteActive(creation.page, mailpit, compte);

    const { page } = await navigateurVisiteur();
    await page.goto("/fr/password/forgot", { waitUntil: "domcontentloaded" });
    await attendreHydratation(page);
    await page.locator("#forgot-email").fill(compte.email);
    const envoi = page.waitForResponse((r) => r.url().includes("/auth/password/forgot") && r.request().method() === "POST", { timeout: 30_000 });
    await page.getByRole("button", { name: "Envoyer le code" }).click();
    expect((await envoi).ok(), "POST /auth/password/forgot").toBe(true);
    await expect(page).toHaveURL(/\/fr\/password\/verify/, { timeout: 30_000 });

    const email = await mailpit.attendreEmail({ pour: compte.email, sujet: SUJET_RESET });
    expect(email.texte, "l'email annonce 10 minutes").toMatch(/10 minutes/);
    const code = codeDe(email.texte);
    for (const [i, c] of code.split("").entries()) await page.getByLabel(`OTP digit ${i + 1}`).fill(c);
    const verif = page.waitForResponse((r) => r.url().includes("/auth/password/verify") && r.request().method() === "POST", { timeout: 30_000 });
    await page.getByRole("button", { name: "Valider mon code" }).click();
    expect((await verif).ok(), "POST /auth/password/verify").toBe(true);
    await expect(page).toHaveURL(/\/fr\/password\/reset/, { timeout: 30_000 });

    // Les règles de force s'appliquent ici aussi : « abc » nomme la règle.
    await page.locator("#new-password").fill("abc");
    await page.locator("#confirm-password").fill("abc");
    await page.getByRole("button", { name: "Réinitialiser le mot de passe" }).click();
    await expect(page.locator("main").getByText(/au moins 8 caractères/)).toBeVisible();
    await expect(page).toHaveURL(/\/fr\/password\/reset/);

    // Le vrai nouveau mot de passe.
    await page.locator("#new-password").fill(NOUVEAU_MOT_DE_PASSE);
    await page.locator("#confirm-password").fill(NOUVEAU_MOT_DE_PASSE);
    const reset = page.waitForResponse((r) => r.url().includes("/auth/password/reset") && r.request().method() === "POST", { timeout: 30_000 });
    await page.getByRole("button", { name: "Réinitialiser le mot de passe" }).click();
    expect((await reset).ok(), "POST /auth/password/reset").toBe(true);
    await expect(page).toHaveURL(/\/fr\/login/, { timeout: 30_000 });

    // Le nouveau mot de passe passe, l'ancien échoue.
    const api = adresseDeLApi();
    const bon = await creation.contexte.request.post(`${api}/auth/login`, { data: { email: compte.email, password: NOUVEAU_MOT_DE_PASSE } });
    expect(bon.ok(), "connexion avec le nouveau mot de passe").toBe(true);
    const mauvais = await creation.contexte.request.post(`${api}/auth/login`, { data: { email: compte.email, password: compte.motDePasse } });
    expect(mauvais.status(), "l'ancien mot de passe échoue").toBe(401);
  });

  test("WEB-MDP-4 · changer son mot de passe ferme les autres sessions", async ({ navigateurVisiteur, mailpit }) => {
    test.setTimeout(5 * 60_000);
    const compte = compteNeuf("Recette", "Pwd");
    const A = await navigateurVisiteur();
    await creerCompteActive(A.page, mailpit, compte);
    await connecter(A.page, compte.email, compte.motDePasse);
    // Un second navigateur, même compte.
    const B = await navigateurVisiteur();
    await connecter(B.page, compte.email, compte.motDePasse);
    expect(await sessionVivante(B.contexte), "B connecté").toBe(true);

    const api = adresseDeLApi();
    await ouvrirLaSecurite(A.page);
    await ouvrirFenetreSudo(A.page, A.contexte, mailpit, compte.email);

    // Le nouveau doit DIFFÉRER de l'actuel (fenêtre ouverte, le refus ne la ferme pas).
    const memeMdp = await A.contexte.request.post(`${api}/auth/me/password`, { data: { newPassword: compte.motDePasse } });
    expect(memeMdp.status(), "refus : identique à l'actuel").toBe(400);
    expect(((await memeMdp.json()) as { details?: { code?: string } }).details?.code).toBe("PASSWORD_SAME_AS_CURRENT");

    // Un nouveau mot de passe valide.
    const emailsAvant = await mailpit.compter({ pour: compte.email, sujet: SUJET_MDP_CHANGE });
    const chg = await A.contexte.request.post(`${api}/auth/me/password`, { data: { newPassword: NOUVEAU_MOT_DE_PASSE } });
    expect(chg.ok(), "changement accepté").toBe(true);

    // L'email « mot de passe modifié ».
    await expect.poll(() => mailpit.compter({ pour: compte.email, sujet: SUJET_MDP_CHANGE }), { timeout: 45_000 }).toBe(emailsAvant + 1);
    // Les autres sessions sont fermées ; la courante reste.
    await expect.poll(() => sessionVivante(B.contexte), { timeout: 30_000 }).toBe(false);
    expect(await sessionVivante(A.contexte), "la session courante reste ouverte").toBe(true);
  });

  test("WEB-MDP-5 et 6 · changer son adresse email", async ({ navigateurVisiteur, mailpit }) => {
    test.setTimeout(6 * 60_000);
    const compte = compteNeuf("Recette", "Mail");
    const nouvelleAdresse = `neuf2-${Date.now()}@recette.yamba.dev`;
    const A = await navigateurVisiteur();
    await creerCompteActive(A.page, mailpit, compte);
    await connecter(A.page, compte.email, compte.motDePasse);
    const B = await navigateurVisiteur();
    await connecter(B.page, compte.email, compte.motDePasse);

    const api = adresseDeLApi();
    await ouvrirLaSecurite(A.page);
    await ouvrirFenetreSudo(A.page, A.contexte, mailpit, compte.email);

    await test.step("WEB-MDP-5 · première étape : refus d'une adresse prise, code sur la nouvelle", async () => {
      // Une adresse déjà utilisée : refus, rien ne change (le contrôle précède tout envoi de code).
      const prise = await A.contexte.request.post(`${api}/auth/me/email/request`, { data: { newEmail: COMPTES.aminata.email } });
      expect(prise.status(), "refus : adresse déjà utilisée").toBeGreaterThanOrEqual(400);
      expect(((await prise.json()) as { details?: { code?: string } }).details?.code).toBe("EMAIL_ALREADY_USED");

      // Une adresse libre : un code part SUR la nouvelle adresse ; l'adresse du compte ne change pas.
      const emailsNouvelleAvant = await mailpit.compter({ pour: nouvelleAdresse, sujet: SUJET_NOUVELLE_ADRESSE });
      const libre = await A.contexte.request.post(`${api}/auth/me/email/request`, { data: { newEmail: nouvelleAdresse } });
      expect(libre.ok(), "demande de changement acceptée").toBe(true);
      await expect.poll(() => mailpit.compter({ pour: nouvelleAdresse, sujet: SUJET_NOUVELLE_ADRESSE }), { timeout: 45_000 }).toBe(emailsNouvelleAvant + 1);
      // L'adresse du compte n'a pas encore changé.
      const me = (await (await A.contexte.request.get(`${api}/auth/me`)).json()) as { user?: { email?: string } };
      expect(me.user?.email).toBe(compte.email);
    });

    await test.step("WEB-MDP-6 · confirmation : l'adresse change, l'ancienne est informée", async () => {
      const email = await mailpit.attendreEmail({ pour: nouvelleAdresse, sujet: SUJET_NOUVELLE_ADRESSE });
      const confirmRep = await A.contexte.request.post(`${api}/auth/me/email/confirm`, { data: { code: codeDe(email.texte) } });
      expect(confirmRep.ok(), "POST /auth/me/email/confirm").toBe(true);

      // L'adresse du compte est la nouvelle.
      const me = (await (await A.contexte.request.get(`${api}/auth/me`)).json()) as { user?: { email?: string } };
      expect(me.user?.email).toBe(nouvelleAdresse);
      // L'ANCIENNE adresse reçoit une information (aucun code n'y a été envoyé).
      await expect.poll(() => mailpit.compter({ pour: compte.email, sujet: SUJET_ANCIENNE_ADRESSE }), { timeout: 45_000 }).toBeGreaterThanOrEqual(1);
      const infoAncienne = await mailpit.attendreEmail({ pour: compte.email, sujet: SUJET_ANCIENNE_ADRESSE });
      expect(/\b\d{6}\b/.test(infoAncienne.texte), "l'ancienne adresse ne reçoit AUCUN code").toBe(false);
      // Les autres sessions sont fermées.
      await expect.poll(() => sessionVivante(B.contexte), { timeout: 30_000 }).toBe(false);
      // La connexion se fait désormais avec la nouvelle adresse.
      const bon = await B.contexte.request.post(`${api}/auth/login`, { data: { email: nouvelleAdresse, password: compte.motDePasse } });
      expect(bon.ok(), "connexion avec la nouvelle adresse").toBe(true);
    });
  });
});
