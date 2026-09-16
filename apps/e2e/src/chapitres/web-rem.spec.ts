/**
 * web-rem.spec.ts — cahier 01-WEB, chapitre 5.18 « La remise du colis »
 * =====================================================================
 * L'écran de saisie du code côté Voyageur (titre, encart, six cases en 3 + 3, aide repliable), le
 * barème d'essais (« Tentative n sur 3 », « n tentatives restantes », « Dernière tentative »), le verrou
 * de 15 minutes qui vit sur le SERVEUR (survit au rechargement, refuse même le bon code), sa levée par
 * une régénération côté Expéditrice, la photo de remise facultative (deux au plus, envoyées avant la
 * saisie), la livraison contre le bon code (écran de succès, versement, notifications et email), et
 * l'absence de toute annulation après la prise en charge.
 *
 * Deal : `sgn-picked` (Mai ↔ Linh, destinataire Đức, code `742891`) ; `bzv-picked` (Aminata ↔ Thomas)
 * pour l'absence d'annulation. ImageKit intercepté (aucun envoi réel) ; un essai raté ne produit aucun
 * événement (aucune notification côté Expéditrice).
 */
import { test, expect, type Navigateur } from "../fixtures/yamba";
import { adresseDeLApi } from "../fixtures/adresses";
import { COMPTES } from "../fixtures/comptes";
import { JeuEssai } from "../fixtures/jeu-essai";
import { intercepterImageKit, photo } from "../fixtures/photos";
import { MesEnvois } from "../pages/mes-envois";
import { SuiviExpediteur } from "../pages/suivi-expediteur";
import { normaliserEspaces } from "../pages/reservation";

type Contexte = Navigateur["contexte"];
type Page = Navigateur["page"];
const api = () => adresseDeLApi();

/* ══ Le cahier ═══════════════════════════════════════════════════════════════════════════════ */

const CODE_DU_SEED = "742891";
const DESTINATAIRE = "Đức";
const VILLE = "Hô Chi Minh-Ville";

/* ══ L'état partagé (mode série) ═════════════════════════════════════════════════════════════ */

let dealId = ""; // sgn-picked — posé paresseusement (chaque fiche reste jouable seule)
let codeCourant = CODE_DU_SEED;
const dealPicked = (jeu: JeuEssai) => (dealId ||= jeu.deal("sgn-picked").id);

/* ══ Aides ═══════════════════════════════════════════════════════════════════════════════════ */

const texte = async (page: Page) => normaliserEspaces(await page.locator("body").innerText());
const valider = (page: Page) => page.getByRole("button", { name: "Valider la livraison" });

async function ouvrirLaRemise(page: Page, id: string): Promise<void> {
  await intercepterImageKit(page);
  await page.goto(`/fr/carrier/deals/${id}/deliver`, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Valide la livraison" })).toBeVisible({ timeout: 60_000 });
}

async function saisirLeCode(page: Page, code: string): Promise<void> {
  for (const [i, chiffre] of code.split("").entries()) {
    await page.getByLabel(`Chiffre ${i + 1}`).fill(chiffre);
  }
}

/** Saisit un code et valide ; rend le statut de la réponse DÉFINITIVE (le client rejoue après un 401). */
async function tenter(page: Page, code: string): Promise<{ statut: number; corps: string }> {
  await saisirLeCode(page, code);
  await expect(valider(page)).toBeEnabled({ timeout: 30_000 });
  const reponse = page.waitForResponse((r) => /\/deals\/[^/]+\/deliver$/.test(r.url()) && r.request().method() === "POST" && r.status() !== 401, { timeout: 60_000 });
  await valider(page).click();
  const r = await reponse;
  return { statut: r.status(), corps: await r.text() };
}

async function notificationsBrutes(contexte: Contexte): Promise<string> {
  const r = await contexte.request.get(`${api()}/me/notifications?limit=100`);
  expect(r.ok(), "GET /notifications").toBe(true);
  return r.text();
}

/* ══ Les fiches ══════════════════════════════════════════════════════════════════════════════ */

test.describe("WEB-REM — la remise du colis (chapitre 5.18)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(() => {
    new JeuEssai().rejouer();
  });

  test("WEB-REM-1 · l'écran « Livraison à Đức »", async ({ navigateurConnecte, jeuEssai }) => {
    dealPicked(jeuEssai);
    const { page } = await navigateurConnecte("linh");
    await intercepterImageKit(page);
    await page.goto(`/fr/carrier/deals/${dealId}`, { waitUntil: "networkidle" });
    await expect(page.getByText(`En transit vers ${VILLE}`)).toBeVisible({ timeout: 60_000 });
    // ANO-WEB-60 : les jalons sont optionnels — « Valider la livraison » est proposé même si le prochain jalon
    // (ici « Ton vol décolle ? », l'aéroport étant confirmé) n'est pas passé.
    await expect(page.getByText("Ton vol décolle ?")).toBeVisible();
    await expect(page.getByText(`${DESTINATAIRE} est déjà devant toi ?`)).toBeVisible();
    await valider(page).click();
    await expect(page).toHaveURL(new RegExp(`/fr/carrier/deals/${dealId}/deliver$`), { timeout: 60_000 });
    await expect(page.getByRole("heading", { name: "Valide la livraison" })).toBeVisible({ timeout: 60_000 });

    const corps = await texte(page);
    expect(corps).toContain(`Livraison à ${DESTINATAIRE}`);
    expect(corps).toContain(`${VILLE} · à valider avec le code`);
    // L'encart (élision calculée : « que Mai », ANO-WEB-49).
    expect(corps).toContain(`${DESTINATAIRE} est devant toi ? Demande-lui le code de livraison que Mai lui a communiqué. Sans ce code, tu ne peux pas remettre le colis. Si elle ne le retrouve pas, propose-lui de contacter Mai.`);
    test.info().annotations.push({ type: "constat", description: "l'encart et l'aide accordent le destinataire au féminin (« Si elle ne le retrouve pas », « Vérifie qu'elle a bien ») quel que soit son prénom — Đức, Étienne… ; le cahier a la même forme" });
    // Six cases en 3 + 3, sous le libellé.
    expect(corps).toContain(`CODE DE LIVRAISON REÇU PAR ${DESTINATAIRE.toUpperCase()}`);
    for (let i = 1; i <= 6; i++) await expect(page.getByLabel(`Chiffre ${i}`)).toBeVisible();
    expect(await page.getByLabel(/^Chiffre \d$/).count()).toBe(6);
    await expect(valider(page), "vide : le bouton reste inactif").toBeDisabled();
    // L'aide repliable et ses trois puces.
    expect(corps).toContain(`${DESTINATAIRE} ne se souvient plus du code ?`);
    expect(corps).toContain("Vérifie qu'elle a bien Mai.");
    expect(corps).toContain("Appelez Mai ensemble.");
    expect(corps).toContain("3 tentatives ratées bloqueront la saisie pendant 15 minutes pour des raisons de sécurité.");
    expect(corps).toContain("Tentative 1 sur 3");
  });

  test("WEB-REM-2 · un code faux et le compteur d'essais", async ({ navigateurConnecte, jeuEssai }) => {
    dealPicked(jeuEssai);
    const mai = await navigateurConnecte("mai");
    const notificationsAvant = await notificationsBrutes(mai.contexte);

    const { page } = await navigateurConnecte("linh");
    await ouvrirLaRemise(page, dealId);
    const premier = await tenter(page, "000000");
    expect(premier.statut).toBe(409);
    expect(JSON.parse(premier.corps).details?.code).toBe("DELIVERY_CODE_INVALID");
    await expect(page.getByText(`Ce code n'est pas le bon. Vérifie avec ${DESTINATAIRE} et réessaye.`)).toBeVisible({ timeout: 10_000 });
    // ANO-WEB-61 : le compteur de tentatives restantes est rendu.
    await expect(page.getByText("2 tentatives restantes")).toBeVisible();
    // Reprendre la saisie efface l'erreur : « Tentative 2 sur 3 ».
    await saisirLeCode(page, "111111");
    expect(await texte(page)).toContain("Tentative 2 sur 3");
    const second = await tenter(page, "111111");
    expect(second.statut).toBe(409);
    await expect(page.getByText(`Ce code n'est pas le bon. Vérifie avec ${DESTINATAIRE} et réessaye.`)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Dernière tentative")).toBeVisible();
    await saisirLeCode(page, "222222");
    expect(await texte(page)).toContain("Tentative 3 sur 3");

    /* Vérification complémentaire — un essai raté n'est pas un événement : Mai n'a rien reçu. */
    await new Promise((r) => setTimeout(r, 3_000));
    expect(await notificationsBrutes(mai.contexte), "aucune notification côté Expéditrice").toBe(notificationsAvant);
  });

  test("WEB-REM-3 · le verrou de 15 minutes", async ({ navigateurConnecte, jeuEssai }) => {
    dealPicked(jeuEssai);
    const { page, contexte } = await navigateurConnecte("linh");
    await ouvrirLaRemise(page, dealId);
    expect(await texte(page)).toContain("Tentative 3 sur 3");

    /* Étape 1 — le troisième code faux. */
    const troisieme = await tenter(page, "333333");
    expect(troisieme.statut).toBe(409);
    expect(JSON.parse(troisieme.corps).details?.code).toBe("DELIVERY_LOCKED");
    await expect(page.getByText("Trop de tentatives. Saisie bloquée pendant 15 min pour des raisons de sécurité.")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Réessaye dans 1[45]:\d{2}/)).toBeVisible();
    await expect(page.getByLabel("Chiffre 1")).toBeDisabled();

    /* Étape 2 — le verrou survit au rechargement : le compteur vit sur le serveur. */
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Valide la livraison" })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Trop de tentatives. Saisie bloquée pendant 15 min pour des raisons de sécurité.")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Réessaye dans 1[45]:\d{2}/)).toBeVisible();
    await expect(page.getByLabel("Chiffre 1")).toBeDisabled();
    await expect(valider(page)).toBeDisabled();

    /* Étape 3 — le BON code est refusé pendant le verrou (les cases sont inertes : par l'API). */
    const force = await contexte.request.post(`${api()}/deals/${dealId}/deliver`, { data: { code: CODE_DU_SEED } });
    expect(force.status()).toBe(409);
    const corps = (await force.json()) as { details?: { code?: string; lockedUntil?: string } };
    expect(corps.details?.code).toBe("DELIVERY_LOCKED");
    expect(corps.details?.lockedUntil).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    const deal = await contexte.request.get(`${api()}/deals/${dealId}`);
    expect(await deal.text(), "le deal n'est pas livré").toContain('"status":"PICKED_UP"');
  });

  test("WEB-REM-4 · une régénération lève le verrou (deux navigateurs)", async ({ navigateurConnecte, jeuEssai }) => {
    dealPicked(jeuEssai);
    /* A — Mai régénère le code. */
    const A = await navigateurConnecte("mai");
    const suivi = new SuiviExpediteur(A.page);
    await suivi.ouvrir(dealId);
    expect(await suivi.lireLeCode()).toBe(codeCourant);
    const { nouveauCode } = await suivi.regenerer();
    expect(nouveauCode).toMatch(/^\d{6}$/);
    expect(nouveauCode).not.toBe(codeCourant);
    codeCourant = nouveauCode;

    /* B — Linh recharge : plus de verrou, le compteur repart à zéro. */
    const B = await navigateurConnecte("linh");
    await ouvrirLaRemise(B.page, dealId);
    const corps = await texte(B.page);
    expect(corps).not.toContain("Trop de tentatives");
    expect(corps).toContain("Tentative 1 sur 3");
    await expect(B.page.getByLabel("Chiffre 1")).toBeEnabled();
    /* L'ancien code ne vaut plus rien ; l'acceptation du nouveau est la fiche 6 (après les photos). */
    const ancien = await tenter(B.page, CODE_DU_SEED);
    expect(ancien.statut).toBe(409);
    expect(JSON.parse(ancien.corps).details?.code).toBe("DELIVERY_CODE_INVALID");
    await expect(B.page.getByText("2 tentatives restantes")).toBeVisible({ timeout: 10_000 });
    test.info().annotations.push({ type: "note", description: `verrou levé par la régénération ; nouveau code ${nouveauCode} ; l'ancien ${CODE_DU_SEED} refusé (1 essai consommé)` });
  });

  test("WEB-REM-5 · la photo de remise est facultative (ImageKit intercepté)", async ({ navigateurConnecte, jeuEssai }) => {
    dealPicked(jeuEssai);
    const { page } = await navigateurConnecte("linh");
    await ouvrirLaRemise(page, dealId);
    const corps = await texte(page);
    expect(corps).toContain("Une photo de la remise ?");
    expect(corps).toContain("Optionnel");
    expect(corps).toContain("Optionnel, mais c'est ton assurance : le colis fermé, dans les mains du destinataire. En cas de litige « endommagé », cette photo parle pour toi.");
    expect(corps).toContain("Jusqu'à 2 photos. Elles sont visibles par l'Expéditeur dans son suivi et par Yamba en cas de litige.");
    // Deux photos, envoyées à la sélection (avant toute saisie du code) ; pas de troisième emplacement.
    const fichier = page.locator('input[type="file"]');
    await fichier.first().setInputFiles(photo("remise"));
    await expect(page.getByRole("button", { name: "Retirer cette photo" })).toHaveCount(1, { timeout: 30_000 });
    await expect(page.getByText("Envoi de la photo…")).toHaveCount(0, { timeout: 30_000 });
    await fichier.first().setInputFiles(photo("remise"));
    await expect(page.getByRole("button", { name: "Retirer cette photo" })).toHaveCount(2, { timeout: 30_000 });
    await expect(page.getByText("Envoi de la photo…")).toHaveCount(0, { timeout: 30_000 });
    // Deux au plus : plus d'emplacement « Ajouter », et une troisième sélection est ignorée.
    await expect(page.getByRole("button", { name: "Ajouter" })).toHaveCount(0);
    if (await fichier.count()) await fichier.first().setInputFiles(photo("remise"));
    await expect(page.getByRole("button", { name: "Retirer cette photo" })).toHaveCount(2);
    await expect(page.getByText("Échec d'envoi")).toHaveCount(0);
  });

  test("WEB-REM-6 · le bon code vaut livraison", async ({ navigateurConnecte, jeuEssai, mailpit }) => {
    dealPicked(jeuEssai);
    await mailpit.vider();
    const { page } = await navigateurConnecte("linh");
    await ouvrirLaRemise(page, dealId);
    const fichier = page.locator('input[type="file"]');
    await fichier.first().setInputFiles(photo("remise"));
    await expect(page.getByText("Envoi de la photo…")).toHaveCount(0, { timeout: 30_000 });
    const remise = await tenter(page, codeCourant);
    expect(remise.statut, remise.corps).toBe(200);

    /* L'écran de succès. */
    await expect(page.getByRole("heading", { name: "Livraison validée !" })).toBeVisible({ timeout: 30_000 });
    const corps = await texte(page);
    expect(corps).toContain(`Bravo, tu as remis le colis à ${DESTINATAIRE}. Mai vient d'être prévenue.`);
    expect(corps).toContain("Ton versement arrive");
    expect(corps).toMatch(/\d+(,\d{2})? € partiront vers ton compte après la période de vérification de l'Expéditeur, le [a-z]+ \d{1,2} [a-zéû]+ au plus tard, puis arriveront sur ton compte bancaire sous 2 à 7 jours\./);
    await expect(page.getByRole("button", { name: "Voir le récap du Deal" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Retour à l'accueil" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Noter/ }), "pas de « Noter » avant la complétion").toHaveCount(0);
    await expect(page.getByRole("link", { name: /^Noter/ })).toHaveCount(0);
    const deal = await page.context().request.get(`${api()}/deals/${dealId}`);
    expect(await deal.text(), "le deal est livré").toContain('"status":"DELIVERED"');

    /* Vérification complémentaire — Mai : notification in-app + email « 3 jours » ; Linh : notification, PAS d'email. */
    const A = await navigateurConnecte("mai");
    await A.page.goto("/fr/dashboard/notifications", { waitUntil: "networkidle" });
    await expect(A.page.getByText(/Colis remis · vérifie avant le/).first()).toBeVisible({ timeout: 60_000 });
    const email = await mailpit.attendreEmail({ pour: COMPTES.mai.email, sujet: /a été livré/ });
    expect(email.texte + email.html).toMatch(/3 jours/);
    expect(email.texte + email.html, "jamais le code").not.toContain(codeCourant);
    await page.goto("/fr/dashboard/notifications", { waitUntil: "networkidle" });
    await expect(page.getByText("Livraison validée", { exact: true }).first()).toBeVisible({ timeout: 60_000 });
    expect(await texte(page)).toMatch(/versement après la vérification de Mai/);
    expect(await mailpit.compter({ pour: COMPTES.linh.email, sujet: /livr/i }), "aucun email au Voyageur à ce stade").toBe(0);
    test.info().annotations.push({ type: "note", description: `livré contre ${codeCourant} avec une photo ; email Mai « ${email.sujet} »` });
  });

  test("WEB-REM-7 · aucune annulation après la prise en charge", async ({ navigateurConnecte, jeuEssai }) => {
    const picked = jeuEssai.deal("bzv-picked").id;
    const annuler = (page: Page) => page.getByRole("button", { name: /annul/i }).or(page.getByRole("link", { name: /annul/i }));

    const A = await navigateurConnecte("aminata");
    const envois = new MesEnvois(A.page);
    await envois.ouvrir();
    // La liste porte « Annuler » sur les AUTRES envois d'Aminata (en attente, acceptés) : on vise la ligne
    // du deal pris en charge, par son lien (jamais par son texte).
    const ligne = A.page.locator(`a[href="/fr/bookings/${picked}"]`).first();
    await expect(ligne).toBeVisible({ timeout: 30_000 });
    await expect(ligne.getByRole("button", { name: /annul/i }), "Mes envois : aucune annulation sur la ligne prise en charge").toHaveCount(0);
    expect(normaliserEspaces(await ligne.innerText())).not.toMatch(/annul/i);
    expect(await annuler(A.page).count(), "les autres envois (en attente / acceptés) gardent leur « Annuler »").toBeGreaterThan(0);
    await new SuiviExpediteur(A.page).ouvrir(picked);
    await expect(annuler(A.page), "suivi : aucune annulation").toHaveCount(0);
    await expect(A.page.getByRole("button", { name: "Signaler un colis non livré" }), "la seule voie : le signalement").toBeVisible();

    const B = await navigateurConnecte("thomas");
    await B.page.goto(`/fr/carrier/deals/${picked}`, { waitUntil: "networkidle" });
    await expect(B.page.getByText("En transit vers Brazzaville")).toBeVisible({ timeout: 60_000 });
    await expect(annuler(B.page), "Voyageur : aucune annulation").toHaveCount(0);
    /* Par l'API : l'Expéditrice reçoit un refus d'état (409), le Voyageur un refus d'acteur (403). */
    const refusA = await A.contexte.request.post(`${api()}/deals/${picked}/cancel`, { data: { reason: "OTHER" } });
    expect(refusA.status()).toBe(409);
    expect(((await refusA.json()) as { details?: { code?: string } }).details?.code).toBe("TRANSITION_NOT_ALLOWED");
    const refusB = await B.contexte.request.post(`${api()}/deals/${picked}/cancel`, { data: { reason: "OTHER" } });
    expect(refusB.status()).toBe(403);
    expect(await B.contexte.request.get(`${api()}/deals/${picked}`).then((r) => r.text())).toContain('"status":"PICKED_UP"');
    test.info().annotations.push({ type: "note", description: "POST /deals/:id/cancel sur un deal pris en charge : 409 TRANSITION_NOT_ALLOWED (Expéditrice), 403 (Voyageur) ; statut inchangé" });
  });
});
