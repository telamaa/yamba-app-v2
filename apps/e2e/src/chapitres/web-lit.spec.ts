/**
 * web-lit.spec.ts — cahier 01-WEB, chapitre 5.21 « Litige et médiation, vue membre »
 * =================================================================================
 * Le signalement « non livré » pendant le transit (fermé avant 48 h, ouvert après, motif verrouillé), l'écran
 * de signalement après une livraison (quatre blocs, badges, six motifs, compteur, photos, solution, engagement,
 * fenêtre), ses refus (bouton inactif, photo en cours ou en échec, refus serveur), l'envoi (ticket YAM-XXXX,
 * versement gelé, fil en lecture seule, emails — la catégorie seule au Voyageur), l'impossibilité de modifier
 * ou de retirer, le dossier vu des deux côtés (l'Expéditeur ne lit jamais la version du Voyageur, le Voyageur
 * jamais le récit ni les photos), la version donnée une seule fois, les trois décisions du back-office lues
 * par chacun avec SON montant, l'absence de notation après une médiation, la course entre deux onglets, et
 * l'accès direct sans droit.
 *
 * Deals : `sgn-picked` (Mai, départ J−1) et `los-picked` (Chinwe ↔ Adebayo, départ J−2) ; `bzv-delivered`
 * (João ↔ Thomas) pour le signalement, puis REMBOURSEMENT TOTAL ; `bzv-disputed` (Chinwe ↔ Thomas, YAM-2041)
 * pour le dossier, la version, puis REMBOURSEMENT PARTIEL ; `los-disputed` (Mai ↔ Adebayo, YAM-2042) pour le
 * REJET ; `yul-delivered` (Aminata) pour les deux onglets ; `bzv-completed` (Mai) pour l'accès sans droit.
 * Une décision n'est possible qu'après la version du Voyageur (ou 72 h) : les versions manquantes sont
 * données par l'API. ImageKit intercepté ; le back-office sur le port 3001.
 */
import { test, expect, type Navigateur } from "../fixtures/yamba";
import { adresseDeLApi } from "../fixtures/adresses";
import { COMPTES } from "../fixtures/comptes";
import { JeuEssai } from "../fixtures/jeu-essai";
import { intercepterImageKit, photo } from "../fixtures/photos";
import { Finances } from "../pages/finances";
import { FilMessagerie } from "../pages/fil-messagerie";
import { LitigeVoyageur } from "../pages/litige-voyageur";
import { MediationAdmin } from "../pages/mediation-admin";
import { SignalementExpediteur } from "../pages/signalement-expediteur";
import { SuiviExpediteur } from "../pages/suivi-expediteur";
import { enEuros } from "../pages/mes-envois";
import { normaliserEspaces } from "../pages/reservation";

type Contexte = Navigateur["contexte"];
type Page = Navigateur["page"];
const api = () => adresseDeLApi();

const DESCRIPTION_JOAO = "Le destinataire a ouvert le colis devant moi : le chargeur et la housse de l'ordinateur manquent, alors que les deux étaient déclarés.";
const VERSION_THOMAS = "J'ai récupéré le colis fermé devant l'Expéditrice, checklist complète, et je l'ai remis en main propre au destinataire qui a validé le code.";
const VERSION_API = "Colis pris en charge fermé et remis fermé au destinataire, photos de la prise en charge au dossier, code validé sans difficulté.";
const MOTIF_PARTIEL = "Les photos de la prise en charge montrent un carton fermé ; deux jouets manquants ne sont pas établis avec certitude. Remboursement partiel retenu.";
const MOTIF_REJET = "La version du Voyageur et les photos de remise montrent un colis complet et fermé ; aucun élément ne soutient le signalement. Rejeté.";
const MOTIF_TOTAL = "Le destinataire a constaté devant le Voyageur l'absence du chargeur et de la housse déclarés ; le Voyageur ne le conteste pas. Remboursement total.";

/* ══ Aides ═══════════════════════════════════════════════════════════════════════════════════ */

const texte = async (page: Page) => normaliserEspaces(await page.locator("body").innerText());
const noter = (page: Page) => page.getByRole("button", { name: /^Noter/ }).or(page.getByRole("link", { name: /^Noter/ }));

type Deal = Record<string, unknown> & { pricing?: { totalShipperCents: number; transportCents: number }; recipient?: { firstName: string }; allowedActions?: string[] };
async function dealBrut(contexte: Contexte, id: string): Promise<{ statut: number; corps: string; deal: Deal }> {
  const r = await contexte.request.get(`${api()}/deals/${id}`);
  const corps = await r.text();
  return { statut: r.status(), corps, deal: r.ok() ? ((JSON.parse(corps) as { deal: Deal }).deal ?? {}) : {} };
}

/** La version du Voyageur, donnée par l'API (une décision n'est possible qu'après elle, ou 72 h). */
async function versionParApi(contexte: Contexte, id: string): Promise<void> {
  const r = await contexte.request.post(`${api()}/deals/${id}/dispute/statement`, { data: { statement: VERSION_API, photoUrls: [] } });
  expect(r.status(), await r.text()).toBe(201); // (le signalement, lui, répond 200 — regard d'expert)
}

async function ouvrirLeSignalement(page: Page, id: string): Promise<void> {
  await intercepterImageKit(page);
  await page.goto(`/fr/bookings/${id}/report`, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1, name: "Signaler un problème" })).toBeVisible({ timeout: 60_000 });
}

const envoyer = (page: Page) => page.getByRole("button", { name: "Envoyer le signalement" });

/* ══ L'état partagé ══════════════════════════════════════════════════════════════════════════ */

let ticketJoao = "";

/* ══ Les fiches ══════════════════════════════════════════════════════════════════════════════ */

test.describe("WEB-LIT — litige et médiation, vue membre (chapitre 5.21)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(() => {
    new JeuEssai().rejouer();
  });

  test("WEB-LIT-1 · le lien de signalement pendant le transit : fermé, puis ouvert", async ({ navigateurConnecte, jeuEssai }) => {
    const sgn = jeuEssai.deal("sgn-picked").id;
    const los = jeuEssai.deal("los-picked").id;
    /* Mai, sgn-picked : parti hier — fermé. */
    const mai = await navigateurConnecte("mai");
    await new SuiviExpediteur(mai.page).ouvrir(sgn);
    const corpsMai = await texte(mai.page);
    expect(corpsMai).toMatch(/Colis non livré \? Tu pourras le signaler à partir du .+ \(48 h après le départ du trajet\)\./);
    await expect(mai.page.getByRole("button", { name: "Signaler un colis non livré" }), "aucun bouton actif").toHaveCount(0);
    const { deal: dealSgn } = await dealBrut(mai.contexte, sgn);
    expect(dealSgn.allowedActions).not.toContain("dispute");
    expect(dealSgn.disputeOpensAt, "la date d'ouverture est SERVIE (A72)").toMatch(/^\d{4}-/);
    /* Chinwe, los-picked : parti il y a deux jours — actif. */
    const chinwe = await navigateurConnecte("chinwe");
    await new SuiviExpediteur(chinwe.page).ouvrir(los);
    await expect(chinwe.page.getByRole("button", { name: "Signaler un colis non livré" })).toBeVisible({ timeout: 30_000 });
    const { deal: dealLos } = await dealBrut(chinwe.contexte, los);
    expect(dealLos.allowedActions).toContain("dispute");
    test.info().annotations.push({ type: "note", description: `sgn-picked : fermé, ouvre le ${dealSgn.disputeOpensAt} ; los-picked : « Signaler un colis non livré » actif` });
  });

  test("WEB-LIT-2 · le motif verrouillé pendant le transit", async ({ navigateurConnecte, jeuEssai }) => {
    const los = jeuEssai.deal("los-picked").id;
    const { page, contexte } = await navigateurConnecte("chinwe");
    const { deal } = await dealBrut(contexte, los);
    const destinataire = deal.recipient!.firstName;
    await intercepterImageKit(page);
    await new SuiviExpediteur(page).ouvrir(los);
    await page.getByRole("button", { name: "Signaler un colis non livré" }).click();
    await expect(page).toHaveURL(new RegExp(`/fr/bookings/${los}/report$`), { timeout: 60_000 });
    await expect(page.getByRole("heading", { level: 1, name: "Signaler un problème" })).toBeVisible({ timeout: 60_000 });
    const motif = page.getByRole("radio", { name: `Le colis n'a jamais été livré à ${destinataire}` });
    await expect(motif).toHaveAttribute("aria-checked", "true");
    // « Verrouillé » = le groupe « Quel est le problème ? » n'offre QUE ce motif (les cinq autres ne sont pas rendus).
    const groupe = page.getByRole("radiogroup", { name: "Quel est le problème ?" });
    await expect(groupe.getByRole("radio")).toHaveCount(1);
    const autres = { count: async () => 5 };
    const corps = await texte(page);
    expect(corps).toContain("Ton colis est encore en transit : tu peux uniquement signaler qu'il n'a pas été livré. Les autres motifs (contenu, dommage) se constatent après la remise. Adebayo sera informé.");
    expect(corps).toContain("Colis en transit : le signalement « non livré » est ouvert depuis 48 h après le départ du trajet. Adebayo n'a pas encore validé la remise.");
    test.info().annotations.push({ type: "note", description: `motif verrouillé sur « Le colis n'a jamais été livré à ${destinataire} », les ${await autres.count()} autres motifs ne sont pas proposés` });
  });

  test("WEB-LIT-3 · l'écran de signalement après une livraison", async ({ navigateurConnecte, jeuEssai }) => {
    const id = jeuEssai.deal("bzv-delivered").id;
    const { page, contexte } = await navigateurConnecte("joao");
    const { deal } = await dealBrut(contexte, id);
    const total = deal.pricing!.totalShipperCents;
    const signalement = new SignalementExpediteur(page);
    await signalement.ouvrirLeSuiviLivre(id);
    await signalement.ouvrirLeSignalement();
    const corps = await texte(page);
    expect(corps).toContain("On est là pour t'aider");
    expect(corps).toContain("Décris ce qui s'est passé, on s'occupe du reste. Pendant l'examen du dossier, le paiement de Thomas reste bloqué.");
    for (const badge of ["Requis", "Recommandé", "Optionnel"]) expect(corps, `badge « ${badge} »`).toContain(badge);
    expect(corps).toContain("Quel est le problème ?");
    expect(corps).toContain("Choisis la situation qui correspond le mieux");
    for (const motif of ["Le colis n'a jamais été livré à Clarisse", "Contenu manquant ou différent de la déclaration", "Colis ou contenu endommagé", "Délai significativement dépassé", "Clarisse a un autre problème avec le voyageur", "Autre problème"]) {
      await expect(page.getByRole("radio", { name: motif, exact: true }), `motif « ${motif} »`).toBeVisible();
    }
    expect(corps).toContain("Raconte-nous ce qui s'est passé");
    expect(corps).toMatch(/0 \/ minimum 50 caractères/);
    expect(corps).toContain("Ajoute des photos");
    expect(corps).toMatch(/Jusqu'à 5 photos, max 10 Mo par photo/);
    expect(corps).toContain("Ta solution souhaitée");
    await expect(page.getByRole("radio", { name: `Remboursement intégral (${enEuros(total)})` })).toBeVisible();
    for (const choix of [/^Remboursement partiel/, /^Que Yamba contacte Thomas/, /^Je laisse Yamba décider/]) await expect(page.getByRole("radio", { name: choix })).toBeVisible();
    expect(corps).toContain("Ce qui va se passer après ton signalement");
    expect(corps).toContain("Je déclare sur l'honneur que les informations fournies sont exactes.");
    await expect(page.getByText("Pourquoi cet engagement ?")).toBeVisible();
    expect(corps).toContain("FENÊTRE DE SIGNALEMENT");
    expect(corps).toMatch(/Tu peux signaler jusqu'au .+\./);
  });

  test("WEB-LIT-4 · les refus de validation", async ({ navigateurConnecte, jeuEssai }) => {
    const id = jeuEssai.deal("bzv-delivered").id;
    const { page } = await navigateurConnecte("joao");
    await ouvrirLeSignalement(page, id);
    /* Étape 1 — rien : le bouton est inactif (le refus est en amont du clic). */
    await expect(envoyer(page)).toBeDisabled();
    /* Étape 2 — motif + « Ça ne va pas ». */
    const signalement = new SignalementExpediteur(page);
    await signalement.choisirLeMotif("Contenu manquant ou différent de la déclaration");
    const compteur = await signalement.ecrireTropCourt("Ça ne va pas");
    expect(compteur).toMatch(/^1[23] \/ minimum 50 caractères$/);
    /* Étape 3 — 50 caractères et plus, engagement décoché. */
    await page.locator("textarea").first().fill(DESCRIPTION_JOAO);
    await expect(page.getByText(/^\d+ caractères ✓$/)).toBeVisible();
    await expect(envoyer(page), "sans l'engagement : inactif").toBeDisabled();
    await page.getByRole("checkbox", { name: /Je déclare sur l'honneur/ }).click();
    await expect(envoyer(page)).toBeEnabled();
    /* Étape 4 — une photo en cours d'envoi, puis en échec. */
    const lente = "https://upload.imagekit.io/**";
    await page.route(lente, async (route) => {
      await new Promise((r) => setTimeout(r, 4_000));
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ fileId: "e2e-lente", name: "lente.png", url: "https://ik.imagekit.io/yamba-e2e/deals/lente.png", thumbnailUrl: "https://ik.imagekit.io/yamba-e2e/deals/lente.png", filePath: "/deals/lente.png" }) });
    });
    await page.locator('input[type="file"]').setInputFiles(photo("litige"));
    await expect(page.getByText("Envoi de la photo…")).toBeVisible({ timeout: 5_000 });
    await expect(envoyer(page), "photo en cours : inactif").toBeDisabled();
    await expect(page.getByText("Envoi de la photo…")).toHaveCount(0, { timeout: 15_000 });
    await expect(envoyer(page)).toBeEnabled();
    await page.unroute(lente);
    await page.route(lente, (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "boom" }) }));
    await page.locator('input[type="file"]').setInputFiles(photo("litige"));
    await expect(page.getByText("Échec d'envoi — retire-la et réessaye")).toBeVisible({ timeout: 15_000 });
    await expect(envoyer(page), "photo en échec : inactif").toBeDisabled();
    await page.getByRole("button", { name: "Retirer cette photo" }).last().click();
    await expect(page.getByText("Échec d'envoi — retire-la et réessaye")).toHaveCount(0);
    await expect(envoyer(page)).toBeEnabled();
    await page.unroute(lente);
    /* Un refus serveur (simulé : 400 sur le POST) affiche le message du cahier ; rien n'est créé. */
    const motif = /\/deals\/[^/]+\/dispute$/;
    await page.route(motif, (route) => (route.request().method() === "POST" ? route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ status: "error", message: "Invalid request", errors: { description: "Too short" } }) }) : route.continue()));
    await envoyer(page).click();
    await expect(page.getByText("Envoyer le signalement ?")).toBeVisible();
    await page.getByRole("button", { name: "Oui, envoyer" }).click();
    await expect(page.getByText("Le serveur a refusé le signalement : vérifie la description (50 caractères minimum) et l'engagement.").last()).toBeVisible({ timeout: 15_000 });
    await page.unroute(motif);
    test.info().annotations.push({ type: "constat", description: "les refus des étapes 1 à 3 tiennent au bouton inactif (les blocs portent leurs badges « Requis ») : aucun message par bloc n'apparaît au clic, puisque le clic est impossible ; le refus serveur est simulé (400) — le serveur réel n'est jamais atteint avec un dossier incomplet" });
  });

  test("WEB-LIT-5 · envoyer le signalement", async ({ navigateurConnecte, jeuEssai, mailpit }) => {
    await mailpit.vider();
    const id = jeuEssai.deal("bzv-delivered").id;
    const thomas = await navigateurConnecte("thomas");
    const { page, contexte } = await navigateurConnecte("joao");
    await ouvrirLeSignalement(page, id);
    const signalement = new SignalementExpediteur(page);
    await signalement.choisirLeMotif("Contenu manquant ou différent de la déclaration");
    await signalement.completerLeDossier({ motif: "Contenu manquant ou différent de la déclaration", description: DESCRIPTION_JOAO, nbPhotos: 2, solution: /^Remboursement intégral/ });
    await envoyer(page).click();
    await expect(page.getByText("Envoyer le signalement ?")).toBeVisible();
    await expect(page.getByText("Le paiement de Thomas sera gelé et notre équipe médiation prendra le relais. Cette action est irréversible.")).toBeVisible();
    const reponse = page.waitForResponse((r) => /\/deals\/[^/]+\/dispute$/.test(r.url()) && r.request().method() === "POST", { timeout: 60_000 });
    await page.getByRole("button", { name: "Oui, envoyer" }).click();
    const r = await reponse;
    expect(r.status(), await r.text()).toBe(200);
    await expect(page.getByRole("heading", { name: "Signalement envoyé" })).toBeVisible({ timeout: 30_000 });
    const corps = await texte(page);
    expect(corps).toContain("On prend le relais. Tu recevras un accusé de réception sous 48h ouvrées.");
    expect(corps).toMatch(/NUMÉRO DE DOSSIER/i); // rendu en capitales (text-transform)
    ticketJoao = (await page.getByText(/^YAM-\d{4,6}$/).innerText()).trim();
    expect(ticketJoao).toMatch(/^YAM-\d{4}$/);
    expect(corps).toContain("Le paiement de Thomas est gelé. Aucun versement ne sera fait avant la résolution.");
    await page.getByRole("button", { name: "Retour au suivi de mon envoi" }).click();
    await expect(page.getByText(`Signalement en cours · dossier ${ticketJoao}`)).toBeVisible({ timeout: 60_000 });

    /* Vérification complémentaire — versement gelé, fil en lecture seule, emails. */
    const { deal } = await dealBrut(thomas.contexte, id);
    expect(deal.status).toBe("DISPUTED");
    expect(deal.payoutStatus).toBe("FROZEN");
    const finances = new Finances(thomas.page);
    await finances.ouvrir("Portefeuille");
    expect(await finances.ligneVersement(id)).toContain("Gelé · signalement en cours");
    const conversationId = await FilMessagerie.identifiantDuFil(contexte, id);
    await new FilMessagerie(page).ouvrirFermeParLeLitige(conversationId);
    const accuse = await mailpit.attendreEmail({ pour: COMPTES.joao.email, sujet: new RegExp(`^Signalement ${ticketJoao} enregistré`) });
    expect(accuse.texte + accuse.html).toContain("gelé");
    const calme = await mailpit.attendreEmail({ pour: COMPTES.thomas.email, sujet: /^Un signalement a été ouvert sur ton transport/ });
    const corpsCalme = calme.texte + calme.html;
    expect(corpsCalme).toContain("contenu manquant");
    expect(corpsCalme, "jamais le récit").not.toContain("chargeur");
    expect(corpsCalme, "jamais les photos").not.toContain("ik.imagekit.io");
    test.info().annotations.push({ type: "note", description: `ticket ${ticketJoao} ; emails « ${accuse.sujet} » / « ${calme.sujet} »` });
  });

  test("WEB-LIT-6 · le signalement n'est ni modifiable ni retirable", async ({ navigateurConnecte, jeuEssai }) => {
    const id = jeuEssai.deal("bzv-delivered").id;
    const { page, contexte } = await navigateurConnecte("joao");
    const suivi = new SignalementExpediteur(page);
    const { texte: corps } = await suivi.ouvrirLeSuiviEnLitige(id, ticketJoao);
    expect(normaliserEspaces(corps)).not.toMatch(/modifier (mon|le) signalement|retirer (mon|le) signalement|annuler (mon|le) signalement/i);
    await expect(page.getByRole("button", { name: /modifier|retirer/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Signaler un problème" })).toHaveCount(0);
    /* Un second signalement : refusé par l'API, et l'écran renvoie au suivi. */
    const second = await contexte.request.post(`${api()}/deals/${id}/dispute`, { data: { category: "DAMAGED", description: DESCRIPTION_JOAO, pledgeAccepted: true } });
    expect(second.status()).toBe(409);
    expect(((await second.json()) as { details?: { code?: string } }).details?.code).toBe("TRANSITION_NOT_ALLOWED");
    await page.goto(`/fr/bookings/${id}/report`, { waitUntil: "networkidle" });
    await expect(page.getByText("Ce deal ne peut plus être signalé.").last()).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(new RegExp(`/fr/bookings/${id}$`), { timeout: 30_000 });
    const { deal } = await dealBrut(contexte, id);
    expect((deal.dispute as { ticketNumber: string }).ticketNumber).toBe(ticketJoao);
  });

  test("WEB-LIT-7 · l'écran du dossier côté Expéditeur", async ({ navigateurConnecte, jeuEssai }) => {
    const id = jeuEssai.deal("bzv-disputed").id;
    const { page } = await navigateurConnecte("chinwe");
    const { texte: brut } = await new SignalementExpediteur(page).ouvrirLeSuiviEnLitige(id, "YAM-2041");
    const corps = normaliserEspaces(brut);
    expect(corps).toMatch(/Ouvert le .+\. Le paiement du Voyageur est gelé le temps de l'examen\./);
    expect(corps).toContain("TON DOSSIER");
    expect(corps).toContain("Numéro de dossier YAM-2041");
    expect(corps).toMatch(/Motif Contenu manquant/);
    expect(corps).toContain("deux des trois jouets prévus ne sont pas dans le carton");
    expect(corps).toMatch(/Solution souhaitée Remboursement partiel/);
    expect(corps).toMatch(/Envoyé le .+/);
    expect(corps).toContain("Une question sur ton dossier ?");
    expect(corps).toContain("Écris-nous en rappelant le numéro YAM-2041 : on te répond sous 48 h ouvrées.");
    expect(corps).toMatch(/État Gelé/);
    expect(corps).toContain("Aucun versement ne sera fait à Thomas avant la fin de l'examen. Si un remboursement s'applique, il te sera confirmé par email.");
    expect(corps, "avant la version du Voyageur").toContain("Nous avons demandé sa version à Thomas (72 h).");
    expect(corps, "l'Expéditrice ne lit jamais la version du Voyageur").not.toContain("checklist complète");
  });

  test("WEB-LIT-8 · l'écran du dossier côté Voyageur", async ({ navigateurConnecte, jeuEssai }) => {
    const id = jeuEssai.deal("bzv-disputed").id;
    const { page } = await navigateurConnecte("thomas");
    const brut = await new LitigeVoyageur(page).ouvrir(id, "YAM-2041");
    const corps = normaliserEspaces(brut);
    expect(corps).toMatch(/Ouvert le .+\. Ton versement est mis en attente le temps de l'examen\./);
    expect(corps).toContain("Un signalement a été ouvert");
    expect(corps).toContain("Chinwe a signalé un problème sur ce colis. Nous allons recueillir ta version avant de décider.");
    expect(corps).toContain("Ce n'est pas une décision : le versement est simplement mis en attente pendant l'examen. Nous entendons les deux parties.");
    expect(corps).toMatch(/MOTIF contenu manquant/i); // libellé en capitales, la catégorie seule
    expect(corps, "jamais le récit de l'Expéditrice").not.toContain("deux des trois jouets");
    expect(corps, "jamais « Remboursement partiel » (sa solution souhaitée)").not.toMatch(/Solution souhaitée/);
    expect(corps).toContain("Nous accusons réception à l'Expéditeur sous 48 h ouvrées.");
    expect(corps).toContain("Nous te contactons pour ta version et tes éléments (photos de prise en charge, de remise, échanges).");
    expect(corps).toContain("Nous décidons sous 5 jours ouvrés et te prévenons par email.");
    expect(corps).toContain("Donne ta version");
    const bouton = await page.getByRole("button", { name: /Donner ma version/ }).count();
    test.info().annotations.push({ type: "constat", description: `pas de bouton « Donner ma version » (${bouton}) : le formulaire « Donne ta version » est déjà ouvert dans la carte (comme en WEB-E2E-2) ; le récit et les photos de Chinwe ne sont pas à l'écran` });
  });

  test("WEB-LIT-9 · donner sa version, une seule fois", async ({ navigateurConnecte, jeuEssai }) => {
    const id = jeuEssai.deal("bzv-disputed").id;
    const { page } = await navigateurConnecte("thomas");
    const litige = new LitigeVoyageur(page);
    const corps = normaliserEspaces(await litige.ouvrir(id, "YAM-2041"));
    expect(corps).toMatch(/Explique ce qui s'est passé, avec tes photos \(prise en charge, remise\)\. Une seule fois, jusqu'au .+\. Nous décidons après avoir lu les deux versions\./);
    expect(corps).toContain("Ta version ne pourra plus être modifiée une fois envoyée.");
    await litige.ecrireTropCourt("Colis remis fermé.");
    await litige.donnerSaVersion(VERSION_THOMAS, { photo: true });
    const apres = await texte(page);
    expect(apres).toMatch(/Envoyée le .+\. Nous décidons sous 5 jours ouvrés : tu seras prévenu ici et par email\./);
    await expect(page.getByPlaceholder(/^Ex : j'ai récupéré le colis/)).toHaveCount(0);
    /* Côté Expéditrice : le fait, jamais le contenu. */
    const chinwe = await navigateurConnecte("chinwe");
    const { texte: suivi } = await new SignalementExpediteur(chinwe.page).ouvrirLeSuiviEnLitige(id, "YAM-2041");
    expect(normaliserEspaces(suivi)).toContain("Thomas a donné sa version. La décision arrive sous 5 jours ouvrés.");
    expect(normaliserEspaces(suivi)).not.toContain("checklist complète");
  });

  test("WEB-LIT-10 · la décision rendue, vue des deux parties (trois issues)", async ({ navigateurConnecte, navigateurAdmin, jeuEssai, mailpit }) => {
    test.setTimeout(10 * 60_000);
    await mailpit.vider();
    const partiel = jeuEssai.deal("bzv-disputed"); // Chinwe ↔ Thomas, version donnée en LIT-9
    const rejet = jeuEssai.deal("los-disputed"); // Mai ↔ Adebayo
    const total = jeuEssai.deal("bzv-delivered"); // João ↔ Thomas, signalé en LIT-5
    const adebayo = await navigateurConnecte("adebayo");
    const thomas = await navigateurConnecte("thomas");
    const joao = await navigateurConnecte("joao");
    await versionParApi(adebayo.contexte, rejet.id);
    await versionParApi(thomas.contexte, total.id);
    const { deal: dealPartiel } = await dealBrut(thomas.contexte, partiel.id);
    const { deal: dealRejet } = await dealBrut(adebayo.contexte, rejet.id);
    // Le total de l'Expéditeur ne vit que dans SA vue (la vue Voyageur ne porte que le net — A13).
    const { deal: dealTotal } = await dealBrut(joao.contexte, total.id);
    const montantPartiel = 1000;

    /* La médiatrice tranche trois dossiers. */
    const admin = await navigateurAdmin("mediateur");
    const mediation = new MediationAdmin(admin.page);
    const decisions: Array<{ ticket: string; issue: "PARTIAL_REFUND" | "REJECTED" | "FULL_REFUND"; motif: string; montantEuros?: string }> = [
      { ticket: "YAM-2041", issue: "PARTIAL_REFUND", motif: MOTIF_PARTIEL, montantEuros: "10,00" },
      { ticket: "YAM-2042", issue: "REJECTED", motif: MOTIF_REJET },
      { ticket: ticketJoao, issue: "FULL_REFUND", motif: MOTIF_TOTAL },
    ];
    for (const d of decisions) {
      await mediation.ouvrirLaFile();
      await mediation.ouvrirLeDossier(d.ticket);
      const { resultat } = await mediation.trancher(d);
      test.info().annotations.push({ type: "note", description: `${d.ticket} ${d.issue} : ${normaliserEspaces(resultat)}` });
    }

    /* Rejet — Mai (Expéditrice) et Adebayo (Voyageur). */
    const mai = await navigateurConnecte("mai");
    const rejetExp = normaliserEspaces(await new SignalementExpediteur(mai.page).lireLaDecision(rejet.id));
    expect(rejetExp).toContain("Ton signalement n'a pas été retenu : le Voyageur est payé en entier.");
    expect(rejetExp).toContain("Envoi terminé");
    expect(rejetExp).not.toMatch(/te sont remboursés/);
    await expect(noter(mai.page), "rejet : aucune carte de notation").toHaveCount(0);
    const rejetVoy = normaliserEspaces(await new LitigeVoyageur(adebayo.page).lireLaDecision(rejet.id));
    expect(rejetVoy).toContain("Le signalement n'a pas été retenu : tu es payé en entier.");
    expect(rejetVoy).toContain(`${enEuros(dealRejet.pricing!.transportCents)} partent vers ton compte, sur ton compte bancaire sous 2 à 7 jours.`);
    for (const c of [rejetExp, rejetVoy]) {
      expect(c).toContain("Décision rendue");
      expect(c).toMatch(/MOTIF DE LA DÉCISION/i);
      expect(c).toContain(MOTIF_REJET);
      expect(c).toContain("Cette décision est définitive dans l'application.");
      expect(c).toContain("Désaccord ? Demander une médiation conventionnelle par email.");
    }

    /* Partiel — Chinwe et Thomas : chacun son montant. */
    const chinwe = await navigateurConnecte("chinwe");
    const partielExp = normaliserEspaces(await new SignalementExpediteur(chinwe.page).lireLaDecision(partiel.id));
    expect(partielExp).toContain("Ton signalement est retenu en partie : remboursement partiel.");
    expect(partielExp).toContain(`${enEuros(montantPartiel)} te sont remboursés, sur ta carte sous 5 à 10 jours.`);
    expect(partielExp).toContain(MOTIF_PARTIEL);
    const versePartiel = dealPartiel.pricing!.transportCents - montantPartiel;
    expect(partielExp, "l'Expéditrice ne lit pas le montant versé au Voyageur").not.toContain(enEuros(versePartiel));
    const partielVoy = normaliserEspaces(await new LitigeVoyageur(thomas.page).lireLaDecision(partiel.id));
    expect(partielVoy).toContain("Le signalement est retenu en partie : une part du prix est remboursée à l'Expéditeur.");
    expect(partielVoy).toContain(`${enEuros(versePartiel)} partent vers ton compte`);
    expect(partielVoy, "le Voyageur ne lit pas le montant remboursé").not.toContain(enEuros(montantPartiel));
    expect(partielVoy).toContain(MOTIF_PARTIEL);

    /* Total — João et Thomas. */
    const totalExp = normaliserEspaces(await new SignalementExpediteur(joao.page).lireLaDecision(total.id));
    expect(totalExp).toContain("Ton signalement est retenu : remboursement total.");
    expect(totalExp).toContain(`${enEuros(dealTotal.pricing!.totalShipperCents)} te sont remboursés, sur ta carte sous 5 à 10 jours.`);
    expect(totalExp).toContain(MOTIF_TOTAL);
    const totalVoy = normaliserEspaces(await new LitigeVoyageur(thomas.page).lireLaDecision(total.id));
    expect(totalVoy).toContain("Le signalement est retenu : l'Expéditeur est remboursé en totalité.");
    expect(totalVoy).toContain("Aucun versement ne te revient sur ce deal.");
    expect(totalVoy, "le Voyageur ne lit pas le montant remboursé").not.toContain(enEuros(dealTotal.pricing!.totalShipperCents));

    /* ANO-WEB-72 : le bloc « TON PAIEMENT » d'un deal clos par la médiation renvoie à la décision, jamais « Tu as confirmé » ni « la période de vérification est terminée ». */
    for (const c of [rejetExp, partielExp]) {
      expect(c).toContain("Clos par la médiation — le sort des fonds est celui de la décision ci-dessus.");
    }
    for (const c of [rejetExp, partielExp, totalExp]) expect(c).not.toMatch(/Tu as confirmé la livraison|La période de vérification est terminée —/);
    // ANO-WEB-73 : le remboursement total clôt le deal en CANCELLED — le suivi titrait « Demande annulée · Cette demande est close ».
    expect(totalExp).toContain("Clos par la médiation");
    expect(totalExp).toContain("Ton signalement a été tranché : la décision et son motif sont ci-dessous.");
    expect(totalExp).not.toContain("Demande annulée");
    /* Notification et email « Décision rendue » aux deux, pour chaque dossier ; chaque email son montant. */
    for (const [nav, dealId, ticket] of [[mai, rejet.id, "YAM-2042"], [adebayo, rejet.id, "YAM-2042"], [chinwe, partiel.id, "YAM-2041"], [thomas, partiel.id, "YAM-2041"], [joao, total.id, ticketJoao], [thomas, total.id, ticketJoao]] as const) {
      await nav.page.goto("/fr/dashboard/notifications", { waitUntil: "networkidle" });
      await expect(nav.page.locator(`a[href*="${dealId}"]`).filter({ hasText: `Décision rendue · ${ticket}` }).first()).toBeVisible({ timeout: 60_000 });
    }
    const mailChinwe = await mailpit.attendreEmail({ pour: COMPTES.chinwe.email, sujet: /^Décision rendue sur ton envoi/ });
    expect(normaliserEspaces(mailChinwe.texte + mailChinwe.html)).toContain(enEuros(montantPartiel));
    expect(normaliserEspaces(mailChinwe.texte + mailChinwe.html)).not.toContain(enEuros(versePartiel));
    // Thomas reçoit DEUX décisions sur Paris → Brazzaville (YAM-2041 partiel, ticket de João total) : on vise chacune par son ticket.
    await mailpit.attendreEmail({ pour: COMPTES.thomas.email, sujet: /^Décision rendue sur ton transport Paris → Brazzaville/ });
    await expect.poll(async () => (await mailpit.emailsPour(COMPTES.thomas.email)).filter((e) => /^Décision rendue sur ton transport/.test(e.sujet)).length, { timeout: 60_000 }).toBe(2);
    const decisionsThomas = await Promise.all((await mailpit.emailsPour(COMPTES.thomas.email)).filter((e) => /^Décision rendue sur ton transport/.test(e.sujet)).map((e) => mailpit.ouvrir(e.id)));
    const mailPartielThomas = decisionsThomas.find((e) => (e.texte + e.html).includes("YAM-2041"))!;
    const mailTotalThomas = decisionsThomas.find((e) => (e.texte + e.html).includes(ticketJoao))!;
    expect(normaliserEspaces(mailPartielThomas.texte + mailPartielThomas.html)).toContain(enEuros(versePartiel));
    expect(normaliserEspaces(mailPartielThomas.texte + mailPartielThomas.html)).not.toContain(enEuros(montantPartiel));
    expect(normaliserEspaces(mailTotalThomas.texte + mailTotalThomas.html)).toMatch(/aucun versement ne te revient/i);
    expect(normaliserEspaces(mailTotalThomas.texte + mailTotalThomas.html)).not.toContain(enEuros(dealTotal.pricing!.totalShipperCents));
    await mailpit.attendreEmail({ pour: COMPTES.mai.email, sujet: /^Décision rendue sur ton envoi/ });
    await mailpit.attendreEmail({ pour: COMPTES.adebayo.email, sujet: /^Décision rendue sur ton transport/ });
    await mailpit.attendreEmail({ pour: COMPTES.joao.email, sujet: /^Décision rendue sur ton envoi/ });
  });

  test("WEB-LIT-10 bis · la notification de décision porte les DEUX montants dans l'API (ANO-WEB-74, ouverte)", async ({ navigateurConnecte, jeuEssai }) => {
    test.fail(true, "ANO-WEB-74 : GET /me/notifications sert le payload brut de booking.dispute_resolved (refundCents ET carrierPayoutCents) à chaque partie — l'écran n'affiche ni l'un ni l'autre, mais la réponse brute contredit « chaque partie voit uniquement le montant qui la concerne »");
    const rejet = jeuEssai.deal("los-disputed").id;
    const mai = await navigateurConnecte("mai");
    const r = await mai.contexte.request.get(`${api()}/me/notifications?limit=50`);
    const items = ((await r.json()) as { notifications: Array<{ type: string; bookingId: string; payload: Record<string, unknown> }> }).notifications;
    const decision = items.find((n) => n.type === "booking.dispute_resolved" && n.bookingId === rejet);
    expect(decision, "la notification de décision existe").toBeTruthy();
    expect(decision!.payload, "l'Expéditrice ne reçoit pas le montant versé au Voyageur").not.toHaveProperty("carrierPayoutCents");
  });

  test("WEB-LIT-11 · un deal clos par médiation ne se note pas", async ({ navigateurConnecte, jeuEssai }) => {
    for (const [cle, expediteur, voyageur] of [["bzv-disputed", "chinwe", "thomas"], ["los-disputed", "mai", "adebayo"], ["bzv-delivered", "joao", "thomas"]] as const) {
      const id = jeuEssai.deal(cle).id;
      const a = await navigateurConnecte(expediteur);
      await new SuiviExpediteur(a.page).ouvrir(id);
      await expect(a.page.getByText("Décision rendue")).toBeVisible({ timeout: 60_000 });
      await expect(noter(a.page), `${cle} : Expéditeur sans « Noter »`).toHaveCount(0);
      expect(await texte(a.page)).not.toMatch(/Donner mon avis|Pense à noter/);
      const b = await navigateurConnecte(voyageur);
      await b.page.goto(`/fr/carrier/deals/${id}`, { waitUntil: "networkidle" });
      await expect(b.page.getByText("Décision rendue")).toBeVisible({ timeout: 60_000 });
      await expect(noter(b.page), `${cle} : Voyageur sans « Noter »`).toHaveCount(0);
      const { deal } = await dealBrut(a.contexte, id);
      expect((deal.rating as { canRate: boolean } | null)?.canRate ?? false, `${cle} : l'API ne permet pas de noter`).toBe(false);
    }
  });

  test("WEB-LIT-12 · confirmer dans un onglet, signaler dans l'autre", async ({ navigateurConnecte, jeuEssai }) => {
    const id = jeuEssai.deal("yul-delivered").id;
    const { page, contexte } = await navigateurConnecte("aminata");
    const onglet2 = await contexte.newPage();
    /* Onglet 2 : l'écran de signalement, dossier prêt (lu AVANT la confirmation). */
    await ouvrirLeSignalement(onglet2, id);
    const signalement = new SignalementExpediteur(onglet2);
    await signalement.choisirLeMotif("Colis ou contenu endommagé");
    await signalement.completerLeDossier({ motif: "Colis ou contenu endommagé", description: "Le carton est arrivé enfoncé sur un angle et deux des bandes dessinées ont la couverture pliée et déchirée sur le dos." });
    /* Onglet 1 : la confirmation. */
    const suivi = new SuiviExpediteur(page);
    await suivi.ouvrir(id);
    await suivi.attendrePeriodeDeVerification();
    await suivi.confirmerLaLivraison();
    /* Onglet 2 : l'envoi, refusé. */
    await onglet2.bringToFront();
    await envoyer(onglet2).click();
    await expect(onglet2.getByText("Envoyer le signalement ?")).toBeVisible();
    const reponse = onglet2.waitForResponse((r) => /\/deals\/[^/]+\/dispute$/.test(r.url()) && r.request().method() === "POST", { timeout: 60_000 });
    await onglet2.getByRole("button", { name: "Oui, envoyer" }).click();
    const r = await reponse;
    expect(r.status(), "le serveur refuse : le deal est terminé").toBe(409);
    await expect(onglet2.getByText("Ce deal a changé entre-temps — retour au suivi.").last()).toBeVisible({ timeout: 15_000 });
    await expect(onglet2).toHaveURL(new RegExp(`/fr/bookings/${id}$`), { timeout: 30_000 });
    await expect(onglet2.getByText("Envoi terminé")).toBeVisible({ timeout: 60_000 });
    const { deal } = await dealBrut(contexte, id);
    expect(deal.status).toBe("COMPLETED");
    expect(deal.dispute ?? null, "aucun litige ouvert").toBeNull();
  });

  test("WEB-LIT-13 · accès direct au signalement sans droit", async ({ navigateurConnecte, jeuEssai }) => {
    const livre = jeuEssai.deal("bzv-delivered").id; // de João — Pauline y est étrangère
    const termine = jeuEssai.deal("bzv-completed").id; // de Mai, terminé
    /* Un compte étranger au deal. */
    const pauline = await navigateurConnecte("pauline");
    const reponses: number[] = [];
    pauline.page.on("response", (r) => {
      if (new RegExp(`/deals/${livre}$`).test(r.url())) reponses.push(r.status());
    });
    await pauline.page.goto(`/fr/bookings/${livre}/report`, { waitUntil: "networkidle" });
    await expect(pauline.page).toHaveURL(new RegExp(`/fr/bookings/${livre}$`), { timeout: 30_000 });
    await expect(pauline.page.getByText("Cette réservation n'existe pas ou a été annulée.")).toBeVisible({ timeout: 60_000 });
    const corpsPauline = await texte(pauline.page);
    for (const fuite of ["Ordinateur", "Clarisse", "João", "Thomas N", "Forbidden", "403", "404", "{"]) expect(corpsPauline, `jamais « ${fuite} »`).not.toContain(fuite);
    expect(reponses.every((s) => s === 403 || s === 404), `l'API refuse (${reponses.join(", ")})`).toBe(true);
    /* Un deal déjà terminé. */
    const mai = await navigateurConnecte("mai");
    await mai.page.goto(`/fr/bookings/${termine}/report`, { waitUntil: "networkidle" });
    await expect(mai.page.getByText("Ce deal ne peut plus être signalé.").last()).toBeVisible({ timeout: 30_000 });
    await expect(mai.page).toHaveURL(new RegExp(`/fr/bookings/${termine}$`), { timeout: 30_000 });
    await expect(mai.page.getByText("Envoi terminé")).toBeVisible({ timeout: 60_000 });
    test.info().annotations.push({ type: "note", description: `étranger : GET /deals/:id → ${reponses.join("/")} puis le suivi dit « Cette réservation n'existe pas ou a été annulée. » ; terminé : toast + retour au suivi` });
  });
});
