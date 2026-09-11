/**
 * web-cod.spec.ts — cahier 01-WEB, chapitre 5.17 « Le code de livraison »
 * ======================================================================
 * L'apparition du code (jamais avant la prise en charge, chez l'Expéditrice seule), sa copie, son
 * partage au destinataire (message pré-rempli, WhatsApp sur le numéro saisi à la réservation), sa
 * régénération (confirmation, compteur, l'écran relit le serveur, email de sécurité sans le code),
 * le plafond de cinq, l'absence de tout bouton côté Voyageur, et sa disparition après la remise.
 *
 * Deals : `bzv-accepted` (Pauline ↔ Thomas) pour « pas encore de code » ; `bzv-picked` (Aminata ↔
 * Thomas, code `742891`) pour tout le reste ; `bzv-delivered` (João ↔ Thomas) pour l'après-remise.
 * Le presse-papiers est observé en mémoire de page ; `window.open` est capturé (WhatsApp) ; les
 * liens `sms:` / `mailto:` ne sont PAS cliqués (ils ouvriraient Messages / Mail du poste) : leur
 * contenu est vérifié sur le catalogue et le message copié.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test, expect, type Navigateur } from "../fixtures/yamba";
import { adresseDeLApi } from "../fixtures/adresses";
import { COMPTES } from "../fixtures/comptes";
import { JeuEssai } from "../fixtures/jeu-essai";
import { lirePressePapiers, observerLePressePapiers } from "../fixtures/presse-papiers";
import { FilMessagerie } from "../pages/fil-messagerie";
import { SuiviExpediteur } from "../pages/suivi-expediteur";
import { normaliserEspaces } from "../pages/reservation";

type Contexte = Navigateur["contexte"];
type Page = Navigateur["page"];
const api = () => adresseDeLApi();

/* ══ Le cahier ═══════════════════════════════════════════════════════════════════════════════ */

const CODE_DU_SEED = "742891";
const AERE = (code: string) => code.replace(/(\d{3})(\d{3})/, "$1 $2");
const NUMERO_CLARISSE = "+242061234567"; // saisi à la réservation (seed RCP_BZV)

/* ══ L'état partagé (mode série) ═════════════════════════════════════════════════════════════ */

let dealId = ""; // bzv-picked — posé par la première fiche qui le lit (chaque fiche reste jouable seule)
let codeCourant = CODE_DU_SEED;
const dealPicked = (jeu: JeuEssai) => (dealId ||= jeu.deal("bzv-picked").id);

/* ══ Aides ═══════════════════════════════════════════════════════════════════════════════════ */

const texte = async (page: Page) => normaliserEspaces(await page.locator("body").innerText());
const copierLeCode = (page: Page) => page.getByRole("button", { name: "Copier le code" });
const regenerer = (page: Page) => page.getByRole("button", { name: "Régénérer le code" });

declare global {
  interface Window {
    __ouverturesYamba?: string[];
  }
}
/** Capture `window.open` (WhatsApp) : aucune fenêtre réelle, l'URL est relue. À poser AVANT la navigation. */
async function observerLesOuvertures(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__ouverturesYamba = [];
    window.open = ((url?: string | URL) => {
      window.__ouverturesYamba!.push(String(url ?? ""));
      return null;
    }) as typeof window.open;
  });
}
const ouvertures = (page: Page) => page.evaluate(() => window.__ouverturesYamba ?? []);

async function ouvrirLeSuivi(page: Page, id: string): Promise<SuiviExpediteur> {
  await observerLePressePapiers(page);
  await observerLesOuvertures(page);
  const suivi = new SuiviExpediteur(page);
  await suivi.ouvrir(id);
  return suivi;
}

const regenererUneFois = (_page: Page, suivi: SuiviExpediteur) => suivi.regenerer(); // page object (5.17 / 5.18)

async function dealBrut(contexte: Contexte, id: string): Promise<string> {
  const r = await contexte.request.get(`${api()}/deals/${id}`);
  expect(r.ok(), `GET /deals/${id}`).toBe(true);
  return r.text();
}

/* ══ Les fiches ══════════════════════════════════════════════════════════════════════════════ */

test.describe("WEB-COD — le code de livraison (chapitre 5.17)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(() => {
    new JeuEssai().rejouer();
  });

  test("WEB-COD-1 · le code n'existe pas avant la prise en charge", async ({ navigateurConnecte, jeuEssai }) => {
    const accepte = jeuEssai.deal("bzv-accepted").id;
    const { page } = await navigateurConnecte("pauline");
    const suivi = new SuiviExpediteur(page);
    await suivi.ouvrir(accepte);
    const carte = page.locator("section").filter({ hasText: "Ton code de livraison" }).first();
    await expect(carte).toBeVisible({ timeout: 60_000 });
    const corps = normaliserEspaces(await carte.innerText());
    expect(corps).toContain("En attente");
    expect(corps).toContain("Tu recevras ton code à 6 chiffres dès que Thomas confirmera la prise en charge de ton colis. Tu le transmettras à Clarisse pour valider la livraison.");
    // Aucun chiffre du code : ni bloc à six chiffres, ni la carte de partage, ni le code du seed dans la page.
    expect(corps).not.toMatch(/\d{3} ?\d{3}/);
    await expect(page.getByLabel(/^\d( \d){5}$/)).toHaveCount(0);
    await expect(copierLeCode(page)).toHaveCount(0);
    await expect(regenerer(page)).toHaveCount(0);
    expect(await page.content()).not.toContain(CODE_DU_SEED);
  });

  test("WEB-COD-2 · le code apparaît chez l'Expéditrice seule", async ({ navigateurConnecte, jeuEssai }) => {
    dealPicked(jeuEssai);

    /* Étape 1 — Aminata : le code, ses deux boutons, l'avertissement. */
    const A = await navigateurConnecte("aminata");
    const suivi = await ouvrirLeSuivi(A.page, dealId);
    expect(await suivi.lireLeCode()).toBe(CODE_DU_SEED);
    const corps = await texte(A.page);
    expect(corps).toContain("CODE À TRANSMETTRE À CLARISSE");
    expect(corps).toContain(AERE(CODE_DU_SEED));
    await expect(copierLeCode(A.page)).toBeVisible();
    await expect(regenerer(A.page)).toBeVisible();
    expect(corps).toContain("Garde ce code confidentiel. Tu peux le régénérer si tu penses qu'il a fuité.");

    /* Étape 2 — Thomas : nulle part. Le deal, l'écran de livraison, les notifications, le fil, l'API. */
    const B = await navigateurConnecte("thomas");
    const sources: Array<{ ou: string; contenu: string }> = [];
    for (const chemin of [`/fr/carrier/deals/${dealId}`, `/fr/carrier/deals/${dealId}/deliver`, "/fr/dashboard/notifications"]) {
      await B.page.goto(chemin, { waitUntil: "networkidle" });
      await expect(B.page.getByRole("heading").first()).toBeVisible({ timeout: 60_000 });
      sources.push({ ou: `${chemin} (source)`, contenu: await B.page.content() });
      sources.push({ ou: `${chemin} (texte)`, contenu: await texte(B.page) });
    }
    const fil = await FilMessagerie.identifiantDuFil(B.contexte, dealId);
    const messagerie = new FilMessagerie(B.page);
    await messagerie.ouvrir(fil);
    sources.push({ ou: "fil de messagerie (source)", contenu: await B.page.content() });
    sources.push({ ou: "GET /deals/:id (Voyageur)", contenu: await dealBrut(B.contexte, dealId) });
    const notifications = await B.contexte.request.get(`${api()}/me/notifications?limit=100`);
    if (notifications.ok()) sources.push({ ou: "GET /notifications (Voyageur)", contenu: await notifications.text() });
    for (const s of sources) {
      expect(s.contenu, `${s.ou} : le code ne doit pas y figurer`).not.toContain(CODE_DU_SEED);
      expect(s.contenu, `${s.ou} : le code aéré ne doit pas y figurer`).not.toContain(AERE(CODE_DU_SEED));
    }
    test.info().annotations.push({ type: "note", description: `${sources.length} sources fouillées côté Voyageur (pages, sources HTML, fil, API) : aucune occurrence de ${CODE_DU_SEED}` });
  });

  test("WEB-COD-3 · copier le code", async ({ navigateurConnecte, jeuEssai }) => {
    dealPicked(jeuEssai);
    const { page } = await navigateurConnecte("aminata");
    await ouvrirLeSuivi(page, dealId);
    await copierLeCode(page).click();
    await expect(page.getByText("Code copié !").first()).toBeVisible({ timeout: 10_000 });
    expect(await lirePressePapiers(page), "le presse-papiers contient les six chiffres, sans espace").toBe(CODE_DU_SEED);

    /* Sans presse-papiers (contexte non sécurisé : le LAN en http) : l'échec est dit, avec le bon message. */
    const { page: sansPressePapiers } = await navigateurConnecte("aminata");
    await sansPressePapiers.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    });
    await new SuiviExpediteur(sansPressePapiers).ouvrir(dealId);
    await copierLeCode(sansPressePapiers).click();
    await expect(sansPressePapiers.getByText("Copie impossible sur ce navigateur — sélectionne le code et copie-le à la main.")).toBeVisible({ timeout: 10_000 });
    expect(await texte(sansPressePapiers)).not.toContain("Erreur lors de la régénération");
  });

  test("WEB-COD-4 · partager le code au destinataire", async ({ navigateurConnecte, jeuEssai }) => {
    dealPicked(jeuEssai);
    const { page } = await navigateurConnecte("aminata");
    const suivi = await ouvrirLeSuivi(page, dealId);
    const carte = page.locator("section").filter({ hasText: "Partage le code à Clarisse" });
    await expect(carte).toBeVisible({ timeout: 60_000 });
    expect(normaliserEspaces(await carte.innerText())).toContain("Le message est pré-rempli, tu n'as qu'à envoyer");

    /* Étapes 1-2 — le message copié. */
    const message = await suivi.copierLeMessageDuCode("Clarisse");
    expect(message).toBe(`Bonjour Clarisse ! Ton colis arrive avec Thomas (Paris → Brazzaville). Pour le récupérer, donne-lui ce code : ${CODE_DU_SEED}. Bisous !`);

    /* Étape 3 — WhatsApp : sur le numéro saisi à la réservation, message pré-rempli. */
    await carte.getByRole("button", { name: "WhatsApp" }).click();
    const [whatsapp] = await ouvertures(page);
    expect(whatsapp, "WhatsApp a été ouvert").toBeDefined();
    const url = new URL(whatsapp);
    expect(url.hostname).toBe("wa.me");
    expect(url.pathname, "le numéro saisi à la réservation, sans le +").toBe(`/${NUMERO_CLARISSE.replace("+", "")}`);
    expect(url.searchParams.get("text")).toBe(message);

    /* Étape 4 — SMS et Email : les boutons sont là ; les liens `sms:` / `mailto:` ne sont pas cliqués
       (ils ouvriraient Messages / Mail du poste) — l'objet est lu au catalogue. */
    await expect(carte.getByRole("button", { name: "SMS" })).toBeVisible();
    await expect(carte.getByRole("button", { name: "Email" })).toBeVisible();
    const catalogue = JSON.parse(readFileSync(resolve(__dirname, "../../../user-ui/messages/fr/bookingTracker.json"), "utf8")) as { pickedUp: { share: { emailSubject: string } } };
    expect(catalogue.pickedUp.share.emailSubject).toBe("Code de retrait de ton colis Yamba");
    test.info().annotations.push({ type: "constat", description: "SMS et Email non cliqués (liens sms: / mailto: — ouvriraient les applications du poste) ; l'objet « Code de retrait de ton colis Yamba » est vérifié au catalogue" });
  });

  test("WEB-COD-5 · régénérer le code", async ({ navigateurConnecte, mailpit, jeuEssai }) => {
    dealPicked(jeuEssai);
    await mailpit.vider();
    const { page } = await navigateurConnecte("aminata");
    const suivi = await ouvrirLeSuivi(page, dealId);
    expect(await texte(page)).toContain("5 régénérations restantes");

    /* Étapes 1-2 — la confirmation, puis « Oui, régénérer ». */
    await regenerer(page).click();
    await expect(page.getByText("Régénérer le code ?")).toBeVisible();
    expect(await texte(page)).toContain("L'ancien code ne fonctionnera plus. Pense à renvoyer le nouveau à Clarisse.");
    await expect(page.getByRole("button", { name: "Annuler" }).last()).toBeVisible();
    await page.getByRole("button", { name: "Annuler" }).last().click();
    await expect(page.getByText("Régénérer le code ?")).toHaveCount(0);
    const { nouveauCode, toast } = await regenererUneFois(page, suivi);
    expect(toast).toBe("Nouveau code généré ! N'oublie pas de le renvoyer à Clarisse.");

    /* Étape 3 — le nouveau code. */
    expect(nouveauCode).toMatch(/^\d{6}$/);
    expect(nouveauCode).not.toBe(CODE_DU_SEED);
    codeCourant = nouveauCode;
    expect(await texte(page)).toContain("4 régénérations restantes");

    /* Étape 4 — après rechargement, l'écran relit le serveur. */
    await page.reload({ waitUntil: "networkidle" });
    expect(await suivi.lireLeCode()).toBe(nouveauCode);
    expect(await texte(page)).not.toContain(AERE(CODE_DU_SEED));

    /* Vérification complémentaire — l'email de sécurité, sans le code (ni l'ancien, ni le nouveau). */
    const email = await mailpit.attendreEmail({ pour: COMPTES.aminata.email, sujet: /nouveau code/i });
    const contenu = email.texte + email.html;
    expect(contenu).toMatch(/nouveau code (a été|vient d(’|'|&#39;)être) généré/i);
    expect(contenu, "l'email ne contient pas le nouveau code").not.toContain(nouveauCode);
    expect(contenu, "l'email ne contient pas l'ancien code").not.toContain(CODE_DU_SEED);
    expect(contenu).toContain("4 régénération");
    // Les crons écrivent aux comptes du seed (versements) : l'absence se prouve sur le SUJET, pas sur la boîte.
    await new Promise((r) => setTimeout(r, 3_000));
    expect(await mailpit.compter({ pour: COMPTES.thomas.email, sujet: /nouveau code/i }), "Thomas n'est pas prévenu d'une régénération").toBe(0);
    test.info().annotations.push({ type: "note", description: `nouveau code ${nouveauCode} ; email « ${email.sujet} » sans le code ; Thomas rien` });
  });

  test("WEB-COD-6 · le plafond de cinq régénérations", async ({ navigateurConnecte, jeuEssai }) => {
    dealPicked(jeuEssai);
    const { page, contexte } = await navigateurConnecte("aminata");
    const suivi = await ouvrirLeSuivi(page, dealId);
    /* Un second onglet, ouvert avant la dernière régénération : il restera sur « 1 régénération restante ». */
    const enRetard = await contexte.newPage();
    const suiviEnRetard = await ouvrirLeSuivi(enRetard, dealId);
    for (let restantes = 4; restantes >= 1; restantes--) {
      expect(await texte(page)).toContain(restantes === 1 ? "1 régénération restante" : `${restantes} régénérations restantes`);
      if (restantes === 1) await enRetard.reload({ waitUntil: "networkidle" });
      const { nouveauCode } = await regenererUneFois(page, suivi);
      expect(nouveauCode).not.toBe(codeCourant);
      codeCourant = nouveauCode;
    }
    expect(await texte(page)).toContain("Aucune régénération restante");
    await expect(regenerer(page)).toBeDisabled();

    /* Un essai forcé par l'API : refus 409 avec un code métier. */
    const force = await contexte.request.post(`${api()}/deals/${dealId}/code/regenerate`, { data: {} });
    expect(force.status()).toBe(409);
    const corps = (await force.json()) as { details?: { code?: string } };
    expect(corps.details?.code).toBe("CODE_REGENERATION_LIMIT");

    /* Un essai forcé par l'écran : l'onglet en retard croit qu'il en reste une, le serveur dit non. */
    expect(await texte(enRetard)).toContain("1 régénération restante");
    await regenerer(enRetard).click();
    const refus = enRetard.waitForResponse((r) => /\/code\/regenerate$/.test(r.url()) && r.request().method() === "POST" && r.status() !== 401, { timeout: 60_000 });
    await enRetard.getByRole("button", { name: "Oui, régénérer" }).click();
    expect((await refus).status()).toBe(409);
    await expect(enRetard.getByText("Tu as atteint la limite de régénérations. Contacte le support si besoin.")).toBeVisible({ timeout: 10_000 });
    await enRetard.reload({ waitUntil: "networkidle" });
    expect(await suiviEnRetard.lireLeCode(), "le code n'a pas changé").toBe(codeCourant);
    expect(await texte(enRetard)).toContain("Aucune régénération restante");
    await expect(regenerer(enRetard)).toBeDisabled();
    await enRetard.close();
  });

  test("WEB-COD-7 · le Voyageur ne régénère pas", async ({ navigateurConnecte, jeuEssai }) => {
    dealPicked(jeuEssai);
    const { page } = await navigateurConnecte("thomas");
    for (const chemin of [`/fr/carrier/deals/${dealId}`, `/fr/carrier/deals/${dealId}/deliver`, `/fr/carrier/deals/${dealId}/accepted`, `/fr/carrier/deals/${dealId}/pickup`]) {
      await page.goto(chemin, { waitUntil: "networkidle" });
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("button", { name: /régénér/i }), `${chemin} : aucun bouton de régénération`).toHaveCount(0);
      await expect(page.getByRole("link", { name: /régénér/i }), `${chemin} : aucun lien de régénération`).toHaveCount(0);
      expect(await texte(page), `${chemin} : le mot n'est pas rendu`).not.toMatch(/régénér/i);
      // La SOURCE, elle, porte « Régénérer le code » : next-intl sérialise tout l'espace `bookingTracker`
      // (textes de l'Expéditeur compris) dans chaque page — un catalogue, pas une commande.
      expect(await page.content(), `${chemin} : l'appel d'API n'est pas dans la page`).not.toContain("code/regenerate");
    }
    test.info().annotations.push({ type: "constat", description: "la source HTML des pages Voyageur porte le catalogue complet `bookingTracker` (textes de l'Expéditeur compris) — sérialisation next-intl, aucune commande rendue" });
  });

  test("WEB-COD-8 · après la remise, le code disparaît", async ({ navigateurConnecte, jeuEssai }) => {
    const livre = jeuEssai.deal("bzv-delivered").id;
    const { page } = await navigateurConnecte("joao");
    await ouvrirLeSuivi(page, livre);
    const corps = await texte(page);
    expect(corps).toContain("Code de livraison saisi par Thomas et validé");
    await expect(page.getByLabel("Code validé").first()).toBeVisible();
    expect(corps).not.toContain("CODE À TRANSMETTRE");
    await expect(page.getByLabel(/^\d( \d){5}$/)).toHaveCount(0);
    await expect(regenerer(page)).toHaveCount(0);
    await expect(copierLeCode(page)).toHaveCount(0);
    expect(await page.content()).not.toContain(CODE_DU_SEED);
  });
});
