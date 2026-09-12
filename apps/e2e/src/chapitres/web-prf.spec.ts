/**
 * web-prf.spec.ts — cahier 01-WEB, chapitre 5.26 « Préférences, langue et relances »
 * ==================================================================================
 * La bascule de langue qui écrit sur le COMPTE (et survit à une reconnexion), la langue d'un email qui est celle de
 * son DESTINATAIRE (jamais celle de l'auteur du geste), la langue d'un email sans compte (celle de l'écran), la
 * relance des messages non lus qu'on peut couper (sans perdre la notification), l'écran « Paramètres », et une langue
 * non prise en charge.
 *
 * Trois anomalies closes par ce chapitre : ANO-WEB-86 (l'écran « Paramètres » était une maquette — « Changer » sans
 * gestionnaire et deux bascules à état local), ANO-WEB-87 (le client des flux SANS compte ne posait pas `x-locale` :
 * les emails d'activation partaient toujours en français), ANO-WEB-88 (une adresse inconnue tombait sur le 404
 * interne de Next, en anglais et sans lien de retour, au lieu de la page introuvable de Yamba).
 *
 * Deals et comptes : Aminata (langue, emails, réglages), Thomas (le Voyageur qui accepte), Pauline et `bzv-accepted`
 * pour la relance (cron `unread-reminder` forcé par `scripts/recette/relance-eligible.ts` + `relance.ts`), une adresse
 * libre pour l'inscription. Les PRÉFÉRENCES survivent au seed : le chapitre les pose lui-même (`beforeAll`) et remet
 * celles d'Aminata dans un `afterAll`.
 */
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { test, expect, connexion, type Navigateur } from "../fixtures/yamba";
import { adresseDeLApi } from "../fixtures/adresses";
import { COMPTES, MOT_DE_PASSE_SEED } from "../fixtures/comptes";
import { compteNeuf } from "../fixtures/compte-neuf";
import { JeuEssai } from "../fixtures/jeu-essai";
import { normaliserEspaces } from "../pages/reservation";

type Contexte = Navigateur["contexte"];
type Page = Navigateur["page"];
const api = () => adresseDeLApi();
const RACINE = join(__dirname, "../../../..");

/* ══ Aides ═══════════════════════════════════════════════════════════════════════════════════ */

const texte = async (page: Page) => normaliserEspaces(await page.locator("body").innerText());

function scriptDeRecette(nom: string, ...args: string[]): string {
  const sortie = execFileSync("npx", ["tsx", "--env-file=.env", `scripts/recette/${nom}.ts`, ...args], {
    cwd: RACINE,
    encoding: "utf-8",
    timeout: 120_000,
    env: { ...process.env, STRIPE_SECRET_KEY: "", FORCE_COLOR: "0", NO_COLOR: "1" },
  });
  // eslint-disable-next-line no-control-regex
  return sortie.replace(/\[[0-9;]*m/g, "");
}

async function langueDuCompte(contexte: Contexte): Promise<string | null> {
  const r = await contexte.request.get(`${api()}/auth/me`);
  expect(r.ok(), "GET /auth/me").toBe(true);
  return ((await r.json()) as { user: { preferredLocale?: string | null } }).user.preferredLocale ?? null;
}

/** La bascule FR / EN de l'en-tête : le clic ÉCRIT sur le compte (PATCH /auth/me/locale, D44). */
async function basculerLaLangue(page: Page, vers: "FR" | "EN"): Promise<number> {
  const reponse = page.waitForResponse((r) => r.url().includes("/auth/me/locale") && r.request().method() === "PATCH", { timeout: 30_000 });
  await page.getByRole("button", { name: vers === "EN" ? "English" : "Français" }).first().click();
  const r = await reponse;
  await page.waitForLoadState("networkidle").catch(() => undefined);
  return r.status();
}

/* ══ Les fiches ══════════════════════════════════════════════════════════════════════════════ */

test.describe("WEB-PRF — préférences, langue et relances (chapitre 5.26)", () => {
  test.describe.configure({ mode: "serial" });

  /**
   * Les PRÉFÉRENCES d'un compte (langue, relance des messages non lus) survivent au seed : il
   * recrée les trajets et les deals, pas les réglages. Le chapitre les pose donc lui-même, sinon
   * une fiche jouée hier décide de l'état de départ de celle d'aujourd'hui (mesuré : Aminata
   * arrivait avec la relance déjà coupée, et la fiche 5 échouait sur son premier constat).
   */
  const reglagesDuSeed = (reglages: Array<{ email: string; champs: Record<string, unknown> }>) =>
    execFileSync(
      "npx",
      ["tsx", "--env-file=.env", "-e", `import p from "./packages/libs/prisma"; (async () => { for (const r of ${JSON.stringify(reglages)}) await p.user.updateMany({ where: { emailNormalized: r.email }, data: r.champs }); process.exit(0); })();`],
      // UN seul processus pour tous les réglages : trois `npx tsx` de suite dépassaient les 60 s
      // sur un poste qui recompile le front en même temps (mesuré : `spawnSync npx ETIMEDOUT`).
      { cwd: RACINE, encoding: "utf-8", timeout: 180_000 },
    );

  test.beforeAll(() => {
    new JeuEssai().rejouer();
    reglagesDuSeed([
      // Aminata arrive avec la relance COUPÉE : la fiche 5 prouve ainsi que l'écran lit le serveur.
      { email: COMPTES.aminata.email, champs: { preferredLocale: "fr", messagingReminderEmails: false } },
      { email: COMPTES.thomas.email, champs: { preferredLocale: "fr", messagingReminderEmails: true } },
      { email: COMPTES.pauline.email, champs: { messagingReminderEmails: true } },
    ]);
  });

  test.afterAll(async () => {
    // Les préférences d'Aminata sont remises à leur valeur par défaut, quoi qu'il arrive (les autres
    // chapitres la lisent en français, avec ses relances).
    // `email` n'est pas unique en base (c'est `emailNormalized` qui l'est) : updateMany, jamais update.
    reglagesDuSeed([{ email: COMPTES.aminata.email, champs: { preferredLocale: "fr", messagingReminderEmails: true } }]);
  });

  test("WEB-PRF-1 · la bascule de langue met à jour le compte", async ({ navigateurConnecte }) => {
    const { page, contexte } = await navigateurConnecte("aminata", { parEcran: true });
    await page.goto("/fr/dashboard/home", { waitUntil: "networkidle" });
    expect(await langueDuCompte(contexte), "français au départ").toBe("fr");
    /* Étape 1 — l'interface passe en anglais, et le compte avec elle. */
    expect(await basculerLaLangue(page, "EN")).toBe(200);
    await expect(page).toHaveURL(/\/en\//, { timeout: 30_000 });
    expect(await langueDuCompte(contexte), "la langue est enregistrée sur le compte").toBe("en");
    /* Étape 2 — rechargement, puis déconnexion / reconnexion : l'anglais tient. */
    await page.reload({ waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/en\//);
    const nouveau = await contexte.browser()!.newContext({ locale: "fr-FR", timezoneId: "Europe/Paris" });
    const page2 = await nouveau.newPage();
    await connexion(page2, COMPTES.aminata, MOT_DE_PASSE_SEED);
    await page2.goto("/en/dashboard/home", { waitUntil: "networkidle" });
    expect(await langueDuCompte(nouveau), "après reconnexion, le compte est toujours en anglais").toBe("en");
    const corps = await texte(page2);
    expect(corps, "l'interface reste en anglais").toMatch(/Hello|Dashboard|My trips|My shipments|To handle/i);
    await nouveau.close();
  });

  test("WEB-PRF-2 · l'email suit la langue du destinataire (deux navigateurs)", async ({ navigateurConnecte, jeuEssai, mailpit }) => {
    test.setTimeout(8 * 60_000);
    await mailpit.vider();
    const A = await navigateurConnecte("aminata"); // en ANGLAIS (fiche 1)
    const B = await navigateurConnecte("thomas"); // en français
    expect(await langueDuCompte(A.contexte)).toBe("en");
    expect(await langueDuCompte(B.contexte), "Thomas reste francophone").toBe("fr");

    /* Étape 1 — Aminata réserve un trajet de Thomas (par l'API : le geste, pas l'assistant). */
    const trajet = jeuEssai.trajet("bzv-perkg");
    const devis = { tripId: trajet, product: "PARCEL", family: "CLOTHES_TEXTILE", sizeClass: "S", weightKg: 2, protection: "BASIC", declaredValueCents: 6000 };
    const sonde = await A.contexte.request.post(`${api()}/deals/payment-intents`, { data: { ...devis, expectedTotalCents: 1 } });
    const totalCents = ((await sonde.json()) as { details: { actualTotalCents: number } }).details.actualTotalCents;
    const intention = await A.contexte.request.post(`${api()}/deals/payment-intents`, { data: { ...devis, expectedTotalCents: totalCents } });
    const { paymentIntentId } = (await intention.json()) as { paymentIntentId: string };
    const creation = await A.contexte.request.post(`${api()}/deals`, {
      data: { ...devis, paymentIntentId, expectedTotalCents: totalCents, description: "Deux pulls (recette PRF-2)", photoUrls: [], recipient: { firstName: "Clarisse", lastName: "Mabiala", phoneE164: "+242061234567" }, charterAccepted: true, termsAccepted: true },
    });
    expect(creation.status(), await creation.text()).toBe(201);
    const dealId = ((await creation.json()) as { bookingId: string }).bookingId;
    /* Thomas, francophone, reçoit la demande EN FRANÇAIS. */
    const demande = await mailpit.attendreEmail({ pour: COMPTES.thomas.email, sujet: /demande/i });
    expect(demande.sujet, "l'email du Voyageur est en français").toMatch(/Nouvelle demande|demande de Deal/i);
    expect(demande.sujet).not.toMatch(/request/i);

    /* Étape 2 — Thomas accepte : Aminata, anglophone, reçoit l'acceptation EN ANGLAIS. */
    expect((await B.contexte.request.post(`${api()}/deals/${dealId}/accept`, { data: { charterAccepted: true } })).status()).toBe(200);
    const acceptation = await mailpit.attendreEmail({ pour: COMPTES.aminata.email, sujet: /accepted|acceptée/i });
    expect(acceptation.sujet, "la langue de l'email est celle du DESTINATAIRE").toMatch(/was accepted|is accepted|accepted/i);
    expect(acceptation.sujet, "jamais le français pour une anglophone").not.toMatch(/acceptée/i);
    expect(normaliserEspaces(acceptation.texte + acceptation.html)).toMatch(/Hello|Hi /);
    test.info().annotations.push({ type: "note", description: `Thomas (fr) : « ${demande.sujet} » ; Aminata (en) : « ${acceptation.sujet} » — le geste est pourtant déclenché par l'autre partie` });
  });

  test("WEB-PRF-3 · les emails sans compte suivent la langue de l'écran", async ({ navigateurVisiteur, mailpit }) => {
    await mailpit.vider();
    const neuf = compteNeuf("Naomi", "Blake");
    const { page } = await navigateurVisiteur();
    /* Inscription depuis l'interface ANGLAISE : le code d'activation arrive en anglais. */
    await page.goto("/en/register", { waitUntil: "networkidle" });
    const formulaire = page.locator("main form").first();
    await formulaire.locator("#firstName").fill(neuf.prenom);
    await formulaire.locator("#lastName").fill(neuf.nom);
    await formulaire.locator("#email").fill(neuf.email);
    await formulaire.locator("#password").fill(neuf.motDePasse);
    await formulaire.locator("#passwordConfirm").fill(neuf.motDePasse);
    await formulaire.locator('input[type="checkbox"]').check();
    const reponse = page.waitForResponse((r) => r.url().includes("/auth/register") && r.request().method() === "POST", { timeout: 30_000 });
    await formulaire.getByRole("button", { name: /Create my account|Créer mon compte/ }).click();
    expect((await reponse).ok(), "inscription acceptée").toBe(true);
    const email = await mailpit.attendreEmail({ pour: neuf.email, sujet: /activation|Yamba/i });
    expect(email.sujet, "sans compte, la langue est celle de la requête").toMatch(/activation code|Your Yamba activation/i);
    expect(email.sujet).not.toMatch(/Ton code d'activation/);
    test.info().annotations.push({ type: "note", description: `inscription en /en → email « ${email.sujet} »` });
  });

  test("WEB-PRF-4 · désactiver la relance des messages non lus", async ({ navigateurConnecte, jeuEssai, mailpit }) => {
    test.setTimeout(6 * 60_000);
    const deal = jeuEssai.deal("bzv-accepted").id; // Pauline ↔ Thomas
    const pauline = await navigateurConnecte("pauline", { parEcran: true });
    const thomas = await navigateurConnecte("thomas");
    /* Étape 1 — Pauline coupe la relance depuis « Mes données ». */
    await pauline.page.goto("/fr/dashboard/security", { waitUntil: "networkidle" });
    await expect(pauline.page.getByRole("heading", { name: "Mes données" })).toBeVisible({ timeout: 60_000 });
    const bascule = pauline.page.getByText("Relance par email des messages non lus", { exact: true }).locator("xpath=../following-sibling::*[@role='switch'][1]");
    if ((await bascule.getAttribute("aria-checked")) === "true") {
      const patch = pauline.page.waitForResponse((r) => r.url().includes("/auth/me/preferences") && r.request().method() === "PATCH", { timeout: 30_000 });
      await bascule.click();
      expect((await patch).ok(), "PATCH /auth/me/preferences").toBe(true);
    }
    await expect(bascule).toHaveAttribute("aria-checked", "false", { timeout: 15_000 });
    const me = (await (await pauline.contexte.request.get(`${api()}/auth/me`)).json()) as { user: { messagingReminderEmails?: boolean } };
    expect(me.user.messagingReminderEmails, "la préférence est enregistrée").toBe(false);

    /* Étape 2 — Thomas écrit, Pauline ne lit pas : le cron ne relance pas. */
    await mailpit.vider();
    const filId = (await (await thomas.contexte.request.get(`${api()}/messages/conversations/by-deal/${deal}`)).json() as { conversation: { id: string } }).conversation.id;
    const envoi = await thomas.contexte.request.post(`${api()}/messages/conversations/${filId}/messages`, { data: { body: "Bonjour Pauline, je passe récupérer le colis samedi matin, est-ce que cela te convient ?" } });
    expect(envoi.status(), await envoi.text()).toBeLessThan(300);
    scriptDeRecette("relance-eligible", filId, "SHIPPER");
    const passe = scriptDeRecette("relance");
    /* Aucun email de relance. */
    await new Promise((r) => setTimeout(r, 3_000));
    expect(await mailpit.compter({ pour: COMPTES.pauline.email }), "aucun email à Pauline").toBe(0);
    /* Mais la notification in-app est bien là. */
    await pauline.page.goto("/fr/dashboard/notifications", { waitUntil: "networkidle" });
    await expect(pauline.page.getByText("Nouveau message").first()).toBeVisible({ timeout: 60_000 });
    test.info().annotations.push({ type: "note", description: `passe de relance : ${passe.trim()} ; aucun email, notification présente` });

    /* On rétablit la préférence (les autres chapitres attendent le réglage par défaut). */
    await pauline.contexte.request.patch(`${api()}/auth/me/preferences`, { data: { messagingReminderEmails: true } });
  });

  test("WEB-PRF-5 · l'écran « Paramètres » (ANO-WEB-86 close)", async ({ navigateurConnecte }) => {
    const { page, contexte } = await navigateurConnecte("aminata", { parEcran: true });
    await page.goto("/fr/dashboard/settings", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: /Paramètres|Settings/ })).toBeVisible({ timeout: 60_000 });
    const corps = await texte(page);
    /* Les quatre entrées annoncées par le cahier sont là. */
    for (const entree of [/Langue/, /Thème/, /Automatique/, /Notifications email/, /Notifications push/]) {
      expect(corps, `entrée ${entree}`).toMatch(entree);
    }
    /** La ligne d'un réglage — pour ne pas viser le sélecteur de langue de l'EN-TÊTE. */
    const ligne = (libelle: string) => page.getByText(libelle, { exact: true }).locator("xpath=ancestor::div[contains(@class,'justify-between')][1]");

    /* 0. L'écran affiche l'état du SERVEUR : Aminata arrive avec la relance coupée (précondition),
          la bascule le montre. C'est aussi la preuve que le profil est chargé — les contrôles de
          langue n'écrivent sur le compte qu'une fois l'utilisateur connu (best-effort, D44). */
    await expect(ligne("Notifications email").getByRole("switch"), "la bascule reflète le serveur").toHaveAttribute("aria-checked", "false", { timeout: 60_000 });

    /* 1. « Langue » : le contrôle écrit sur le COMPTE (D44), pas seulement sur l'écran. */
    const versEn = page.waitForResponse((r) => r.url().includes("/auth/me/locale") && r.request().method() === "PATCH", { timeout: 30_000 });
    await ligne("Langue").getByRole("button", { name: "English" }).click();
    expect((await versEn).status(), "PATCH /auth/me/locale").toBe(200);
    await expect(page).toHaveURL(/\/en\//, { timeout: 30_000 });
    expect(await langueDuCompte(contexte), "la langue est enregistrée sur le compte").toBe("en");
    const versFr = page.waitForResponse((r) => r.url().includes("/auth/me/locale") && r.request().method() === "PATCH", { timeout: 30_000 });
    await ligne("Language").getByRole("button", { name: "Français" }).click();
    expect((await versFr).status()).toBe(200);
    await expect(page).toHaveURL(/\/fr\//, { timeout: 30_000 });

    /* 2. « Thème » : trois choix réels, et l'écran change vraiment de thème. */
    const classe = () => page.locator("html").getAttribute("class");
    await ligne("Thème").getByRole("button", { name: "Sombre" }).click();
    await expect.poll(classe, { timeout: 15_000 }).toContain("dark");
    await ligne("Thème").getByRole("button", { name: "Clair" }).click();
    await expect.poll(classe, { timeout: 15_000 }).not.toContain("dark");
    await ligne("Thème").getByRole("button", { name: "Automatique" }).click();
    await expect(ligne("Thème").getByRole("button", { name: "Automatique" })).toHaveAttribute("aria-pressed", "true");

    /* 3. « Notifications email » : la bascule écrit la préférence du compte, et SURVIT au rechargement. */
    const bascule = ligne("Notifications email").getByRole("switch");
    const patch = page.waitForResponse((r) => r.url().includes("/auth/me/preferences") && r.request().method() === "PATCH", { timeout: 30_000 });
    await bascule.click();
    expect((await patch).ok(), "PATCH /auth/me/preferences").toBe(true);
    const me = (await (await contexte.request.get(`${api()}/auth/me`)).json()) as { user: { messagingReminderEmails?: boolean } };
    expect(me.user.messagingReminderEmails, "la préférence est enregistrée côté serveur").toBe(true);
    await page.reload({ waitUntil: "networkidle" });
    await expect(ligne("Notifications email").getByRole("switch"), "l'état tient après rechargement").toHaveAttribute("aria-checked", "true", { timeout: 30_000 });

    /* 4. « Notifications push » : rien n'est branché — la ligne informe et ne propose AUCUN contrôle. */
    expect(corps, "le push est annoncé pour ce qu'il est").toMatch(/Indisponible pour l'instant/);
    expect(await ligne("Notifications push").getByRole("switch").count(), "aucune bascule décorative").toBe(0);
    expect(await ligne("Notifications push").getByRole("button").count(), "aucun bouton sans effet").toBe(0);
    test.info().annotations.push({ type: "note", description: "langue → PATCH /auth/me/locale ; thème → classe `dark` de <html> ; email → PATCH /auth/me/preferences relu après rechargement ; push → ligne en lecture (préférences email fines et push : candidat registre)" });
  });

  test("WEB-PRF-6 · une langue non prise en charge est refusée (ANO-WEB-88 close)", async ({ navigateurVisiteur }) => {
    const { page } = await navigateurVisiteur();
    const reponse = await page.goto("/es", { waitUntil: "networkidle" });
    const statut = reponse?.status() ?? 0;
    const url = page.url();
    const corps = await texte(page);
    /* Le middleware next-intl retient une langue connue (`/es` → `/fr/es`) : jamais d'espagnol à moitié. */
    const chemin = new URL(url).pathname;
    expect(chemin, "l'adresse retombe sur une langue prise en charge").toMatch(/^\/(fr|en)\//);
    expect(statut, "et la page est bien une 404").toBe(404);
    /* ANO-WEB-88 : c'est LA page introuvable de Yamba, dans la langue de l'URL — pas le 404 interne de Next. */
    expect(corps, "le 404 par défaut de Next ne doit plus apparaître").not.toContain("This page could not be found");
    expect(corps, "la page introuvable du produit, en français").toContain("Cette page n'existe pas");
    expect(corps).toContain("Chercher un trajet");
    expect(corps).toContain("Retour à l'accueil");
    for (const brut of ["NEXT_NOT_FOUND", "Internal Server Error", "Unhandled", "at Object."]) expect(corps, `jamais « ${brut} »`).not.toContain(brut);
    expect(corps, "jamais une clé de traduction brute").not.toMatch(/errors\.notFound/);
    /* En anglais, la même adresse donne la même page, traduite. */
    const anglais = await page.goto("/en/es", { waitUntil: "networkidle" });
    expect(anglais?.status()).toBe(404);
    expect(await texte(page)).toContain("This page does not exist");
    test.info().annotations.push({ type: "note", description: `/es → ${statut} ${chemin} : page introuvable de Yamba (elle servait « This page could not be found. », le 404 interne de Next, en anglais et sans lien de retour)` });
  });
});
