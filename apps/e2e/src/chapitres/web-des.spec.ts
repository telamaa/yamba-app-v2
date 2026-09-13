/**
 * web-des.spec.ts — cahier 01-WEB, chapitre 5.23 « La page destinataire »
 * ========================================================================
 * Le lien de suivi que l'Expéditrice partage (créé une fois, jamais régénéré au second clic), ses canaux
 * (WhatsApp sur le numéro saisi à la réservation, SMS, copie), la page publique vue sans compte (titre, sous-titre,
 * dates, frise, confidentialité, acquisition), ce qu'elle ne montre JAMAIS (adresse, numéro, code, photo, montant —
 * ni à l'écran, ni dans le code source ; `noindex`), sa progression au fil des jalons du Voyageur, l'absence de carte
 * de partage côté Voyageur et avant l'acceptation, le lien invalide (jeton altéré OU destinataire effacé : le même
 * message), et le vrai numéro du destinataire côté Voyageur.
 *
 * Deal : `bzv-picked` (Aminata ↔ Thomas, destinataire Clarisse Mabiala +242 06 123 45 67, code `742891`) ;
 * `bzv-pending` pour « pas de lien avant l'acceptation ». ORDRE DE JEU : 7, 6, 9, 1, 2, 3, 4, 5, 8 (le deal est
 * livré en fiche 5, puis clos et son destinataire effacé pour la fiche 8).
 */
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { test, expect, type Navigateur } from "../fixtures/yamba";
import { adresseDeLApi } from "../fixtures/adresses";
import { CODE_LIVRAISON_SEED } from "../fixtures/comptes";
import { JeuEssai } from "../fixtures/jeu-essai";
import { lirePressePapiers, observerLePressePapiers } from "../fixtures/presse-papiers";
import { CLES_PUBLIQUES_DU_SUIVI, SuiviDestinataire } from "../pages/suivi-destinataire";
import { SuiviExpediteur } from "../pages/suivi-expediteur";
import { TransportVoyageur } from "../pages/transport-voyageur";
import { normaliserEspaces } from "../pages/reservation";

type Contexte = Navigateur["contexte"];
type Page = Navigateur["page"];
const api = () => adresseDeLApi();
const RACINE = join(__dirname, "../../../..");

const DESTINATAIRE = { prenom: "Clarisse", nom: "Mabiala", e164: "+242061234567", local: "061234567" };

declare global {
  interface Window {
    __ouverturesYamba?: string[];
  }
}

/* ══ Aides ═══════════════════════════════════════════════════════════════════════════════════ */

const texte = async (page: Page) => normaliserEspaces(await page.locator("body").innerText());

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

async function dealBrut(contexte: Contexte, id: string): Promise<Record<string, unknown>> {
  const r = await contexte.request.get(`${api()}/deals/${id}`);
  expect(r.ok(), `GET /deals/${id}`).toBe(true);
  return ((await r.json()) as { deal: Record<string, unknown> }).deal;
}

const carteDePartage = (page: Page) => page.locator("section").filter({ hasText: /Partage le suivi à/ });

/* ══ L'état partagé ══════════════════════════════════════════════════════════════════════════ */

let lien = { url: "", token: "", message: "" };

/* ══ Les fiches ══════════════════════════════════════════════════════════════════════════════ */

test.describe("WEB-DES — la page destinataire (chapitre 5.23)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(() => {
    new JeuEssai().rejouer();
  });

  test("WEB-DES-7 · pas de lien avant l'acceptation", async ({ navigateurConnecte, jeuEssai }) => {
    const pending = jeuEssai.deal("bzv-pending").id;
    const { page, contexte } = await navigateurConnecte("aminata");
    await new SuiviExpediteur(page).ouvrir(pending);
    await expect(carteDePartage(page), "aucune carte de partage sur une demande en attente").toHaveCount(0);
    await expect(page.getByRole("button", { name: "Copier le message" })).toHaveCount(0);
    const refus = await contexte.request.post(`${api()}/deals/${pending}/tracking-link`);
    expect([403, 409], `l'API refuse aussi (${refus.status()})`).toContain(refus.status());
    test.info().annotations.push({ type: "note", description: `POST /tracking-link sur une demande en attente → ${refus.status()} ${(await refus.text()).slice(0, 120)}` });
  });

  test("WEB-DES-6 · le Voyageur ne crée pas le lien", async ({ navigateurConnecte, jeuEssai }) => {
    const picked = jeuEssai.deal("bzv-picked").id;
    const { page, contexte } = await navigateurConnecte("thomas");
    for (const chemin of [`/fr/carrier/deals/${picked}`, `/fr/carrier/deals/${picked}/deliver`]) {
      await page.goto(chemin, { waitUntil: "networkidle" });
      await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 60_000 });
      await expect(carteDePartage(page), `${chemin} : aucune carte de partage`).toHaveCount(0);
      expect(await texte(page)).not.toMatch(/Partage le suivi|lien de suivi/i);
    }
    const refus = await contexte.request.post(`${api()}/deals/${picked}/tracking-link`);
    expect(refus.status(), "l'API refuse le Voyageur").toBe(403);
  });

  test("WEB-DES-9 · le vrai numéro du destinataire côté Voyageur", async ({ navigateurConnecte, jeuEssai }) => {
    const picked = jeuEssai.deal("bzv-picked").id;
    const { page, contexte } = await navigateurConnecte("thomas");
    const deal = await dealBrut(contexte, picked);
    expect((deal.recipient as { phoneE164: string }).phoneE164, "le numéro saisi à la réservation").toBe(DESTINATAIRE.e164);
    const transport = new TransportVoyageur(page);
    await transport.ouvrirSuivi(picked);
    await expect(page.getByText(`${DESTINATAIRE.prenom} ${DESTINATAIRE.nom} · Destinataire`)).toBeVisible({ timeout: 60_000 });
    await transport.numeroDuDestinataireVisible("+242");
    const corps = await texte(page);
    expect(corps).toMatch(/\+242 ?0?6 ?12 ?34 ?56 ?7|\+242061234567|\+242 06 123 45 67/);
    // Piège 5.16 : le bouton d'appel porte le NUMÉRO comme nom accessible (« Appeler » est son intention, pas son libellé).
    await expect(page.getByRole("button", { name: DESTINATAIRE.e164 })).toBeVisible();
    await expect(page.getByRole("button", { name: "WhatsApp" }).first()).toBeVisible();
    for (const factice of ["+33 6 12 34 56 78", "0612345678", "+1 555"]) expect(corps, `aucun numéro factice « ${factice} »`).not.toContain(factice);
  });

  test("WEB-DES-1 · créer et partager le lien", async ({ navigateurConnecte, jeuEssai }) => {
    const picked = jeuEssai.deal("bzv-picked").id;
    const { page } = await navigateurConnecte("aminata");
    await observerLePressePapiers(page);
    const suivi = new SuiviExpediteur(page);
    await suivi.ouvrir(picked);
    const carte = carteDePartage(page);
    await expect(carte).toBeVisible({ timeout: 30_000 });
    expect(normaliserEspaces(await carte.innerText())).toContain(`Un lien sans compte : ${DESTINATAIRE.prenom} voit où en est le colis, sans ton adresse ni le code.`);
    /* Étapes 2-3 — « Copier le message » : POST une fois, le message au presse-papiers, « Copié ! ». */
    const appels: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/tracking-link") && r.method() === "POST") appels.push(r.url());
    });
    const premier = await suivi.creerLeLienDeSuivi(DESTINATAIRE.prenom);
    await expect(carte.getByRole("button", { name: "Copié !" })).toBeVisible({ timeout: 5_000 });
    expect(premier.message).toMatch(new RegExp(`^Bonjour ${DESTINATAIRE.prenom} ! Ton colis arrive avec Thomas\\. Suis-le ici : https?://\\S+/track/[A-Za-z0-9_-]+$`));
    expect(premier.url).toMatch(/\/track\/[A-Za-z0-9_-]+$/);
    lien = { url: premier.url, token: premier.url.split("/track/")[1], message: premier.message };
    /* Étape 4 — un second clic : le même lien, sans nouvel appel. */
    await expect(carte.getByRole("button", { name: "Copier le message" })).toBeVisible({ timeout: 5_000 });
    await carte.getByRole("button", { name: "Copier le message" }).click();
    await expect(carte.getByRole("button", { name: "Copié !" })).toBeVisible({ timeout: 5_000 });
    const second = await lirePressePapiers(page);
    expect(second, "le même message, le même lien").toBe(premier.message);
    expect(appels, "un seul POST /tracking-link pour deux clics").toHaveLength(1);
    /* Après rechargement : un nouvel appel rend le MÊME jeton (créé une fois par deal). */
    await suivi.ouvrir(picked);
    const apres = await suivi.creerLeLienDeSuivi(DESTINATAIRE.prenom);
    expect(apres.url, "le jeton n'est pas régénéré").toBe(premier.url);
    test.info().annotations.push({ type: "note", description: `lien ${premier.url} ; message « ${premier.message.slice(0, 60)}… » ; ${appels.length} POST pour deux clics, même jeton après rechargement` });
  });

  test("WEB-DES-2 · le partage par WhatsApp et SMS", async ({ navigateurConnecte, jeuEssai }) => {
    const picked = jeuEssai.deal("bzv-picked").id;
    const { page } = await navigateurConnecte("aminata");
    await observerLesOuvertures(page);
    await new SuiviExpediteur(page).ouvrir(picked);
    const carte = carteDePartage(page);
    await expect(carte).toBeVisible({ timeout: 30_000 });
    /* WhatsApp : `window.open` capturé — le numéro saisi à la réservation, le message pré-rempli. Le lien est
       (re)demandé par cette page : la réponse porte le numéro que les DEUX canaux utilisent. */
    const reponse = page.waitForResponse((r) => r.url().includes("/tracking-link") && r.request().method() === "POST", { timeout: 30_000 });
    await carte.getByRole("button", { name: "WhatsApp" }).click();
    const lienServi = (await (await reponse).json()) as { path: string; recipientPhoneE164: string | null };
    await expect.poll(() => ouvertures(page), { timeout: 15_000 }).toHaveLength(1);
    const whatsapp = (await ouvertures(page))[0];
    expect(whatsapp).toMatch(new RegExp(`^https://wa\\.me/${DESTINATAIRE.e164.replace("+", "")}\\?text=`));
    const corpsWhatsapp = decodeURIComponent(whatsapp.split("?text=")[1] ?? "");
    expect(corpsWhatsapp).toContain(`Bonjour ${DESTINATAIRE.prenom} ! Ton colis arrive avec Thomas. Suis-le ici : ${lien.url}`);
    /* SMS : le bouton assigne `window.location.href = sms:{numéro}?&body=…` — un schéma externe que le navigateur du
       poste ne journalise pas et que le harnais ne clique pas (il ouvrirait Messages). La preuve : le numéro que le
       canal SMS utilise est `recipientPhoneE164` de la réponse, le même que WhatsApp — celui de la réservation. */
    expect(lienServi.recipientPhoneE164, "le numéro servi pour SMS / WhatsApp est celui saisi à la réservation").toBe(DESTINATAIRE.e164);
    expect(lienServi.path).toBe(`/track/${lien.token}`);
    await expect(carte.getByRole("button", { name: "SMS" })).toBeEnabled();
    test.info().annotations.push({ type: "constat", description: `WhatsApp → ${whatsapp.split("?")[0]} (message pré-rempli) ; SMS : bouton actif, cible sms:${lienServi.recipientPhoneE164} (non cliqué — schéma externe), numéro servi = celui de la réservation` });
  });

  test("WEB-DES-3 · la page vue par le destinataire (fenêtre privée)", async ({ navigateurVisiteur }) => {
    const c = await navigateurVisiteur();
    const destinataire = new SuiviDestinataire(c.page);
    await destinataire.ouvrir(lien.url, DESTINATAIRE.prenom);
    await expect(c.page.getByText(`Aminata t'envoie un colis avec Thomas N., Voyageur Yamba, de Paris à Brazzaville.`)).toBeVisible();
    await expect(c.page.getByText("Départ", { exact: true })).toBeVisible();
    await expect(c.page.getByText("Arrivée prévue", { exact: true })).toBeVisible();
    await expect(c.page.getByText("Où en est le colis")).toBeVisible();
    const jalons = c.page.locator("ol > li");
    await expect(jalons).toHaveCount(5);
    const libelles = normaliserEspaces(await jalons.allInnerTexts().then((t) => t.join(" | ")));
    for (const j of ["Colis pris en charge", "Colis récupéré par Thomas", "En route", "Arrivé à Brazzaville", "Colis remis"]) expect(libelles, `jalon « ${j} »`).toContain(j);
    expect(await destinataire.mentionDeConfidentialite()).toContain("Aminata a confié ton prénom et ton numéro à Yamba pour cette livraison, et à personne d'autre. Ils sont effacés après la remise.");
    await expect(c.page.getByRole("link", { name: "Politique de confidentialité" })).toBeVisible();
    const bloc = c.page.locator("section").filter({ hasText: "Toi aussi, envoie ou transporte avec Yamba" });
    await expect(bloc).toBeVisible();
    await expect(bloc.getByRole("link", { name: "Envoyer un colis", exact: true })).toBeVisible();
    await expect(bloc.getByRole("link", { name: "Devenir Voyageur", exact: true })).toBeVisible();
    expect(await destinataire.jalonCourant(), "bzv-picked est pris en charge").toBe("Colis récupéré par Thomas");
    await expect(c.page.getByRole("button", { name: /Menu utilisateur/ }), "aucun compte connecté").toHaveCount(0);
  });

  test("WEB-DES-4 · ce que la page ne montre jamais (écran, source, noindex, API)", async ({ navigateurVisiteur, navigateurConnecte, jeuEssai }) => {
    const picked = jeuEssai.deal("bzv-picked").id;
    const aminata = await navigateurConnecte("aminata");
    const deal = await dealBrut(aminata.contexte, picked);
    const total = (deal.pricing as { totalShipperCents: number }).totalShipperCents;
    const montant = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(total / 100).replace(/\s/g, "");
    const c = await navigateurVisiteur();
    const destinataire = new SuiviDestinataire(c.page);
    await destinataire.ouvrir(lien.url, DESTINATAIRE.prenom);
    await destinataire.neReveleRien({ code: CODE_LIVRAISON_SEED, telephone: DESTINATAIRE.local, montant, motsDAdresse: ["Terminal départ", "Hall d'arrivée", "Roissy", "Maya-Maya"] });
    const source = await c.page.content();
    // Le code source d'une page next-intl porte TOUT le catalogue (piège 5.17) : « € » y figure dans des textes
    // génériques ; on cherche les VALEURS du deal (code, numéro, nom, montant), jamais un symbole.
    for (const secret of [CODE_LIVRAISON_SEED, DESTINATAIRE.e164, DESTINATAIRE.local, DESTINATAIRE.nom, montant, `${String(total / 100).replace(".", ",")} €`]) {
      expect(source, `code source sans « ${secret} »`).not.toContain(secret);
    }
    /* Non indexée. */
    const robots = await c.page.locator('meta[name="robots"]').getAttribute("content");
    expect(robots ?? "", "balise robots noindex").toMatch(/noindex/);
    /* L'API sert une liste FERMÉE de clés. */
    expect(await SuiviDestinataire.clesServiesParLApi(c.contexte, lien.token)).toEqual([...CLES_PUBLIQUES_DU_SUIVI]);
    test.info().annotations.push({ type: "note", description: `robots : « ${robots} » ; clés de GET /track/:token : ${CLES_PUBLIQUES_DU_SUIVI.join(", ")}` });
  });

  test("WEB-DES-5 · la page suit la progression (deux navigateurs)", async ({ navigateurVisiteur, navigateurConnecte, jeuEssai }) => {
    test.setTimeout(8 * 60_000);
    const picked = jeuEssai.deal("bzv-picked").id;
    const c = await navigateurVisiteur();
    const destinataire = new SuiviDestinataire(c.page);
    const thomas = await navigateurConnecte("thomas");
    const transport = new TransportVoyageur(thomas.page);
    const secrets = { code: CODE_LIVRAISON_SEED, telephone: DESTINATAIRE.local };

    await destinataire.ouvrir(lien.url, DESTINATAIRE.prenom);
    expect(await destinataire.jalonCourant()).toBe("Colis récupéré par Thomas");
    expect(await destinataire.aideCourante()).toBe("Le colis voyage avec Thomas.");
    expect(await destinataire.jalonsAtteints()).toEqual(["Colis pris en charge", "Colis récupéré par Thomas"]);

    await transport.ouvrirSuivi(picked);
    await transport.confirmerJalon("Je suis à l'aéroport");
    await destinataire.ouvrir(lien.url, DESTINATAIRE.prenom);
    expect(await destinataire.jalonCourant(), "l'aéroport n'est pas un jalon public").toBe("Colis récupéré par Thomas");

    await transport.confirmerJalon("L'avion décolle");
    await destinataire.ouvrir(lien.url, DESTINATAIRE.prenom);
    expect(await destinataire.jalonCourant()).toBe("En route");
    expect(await destinataire.aideCourante()).toBe("Thomas est en route vers Brazzaville.");
    await destinataire.neReveleRien(secrets);

    await transport.confirmerJalon("J'ai atterri");
    await destinataire.ouvrir(lien.url, DESTINATAIRE.prenom);
    expect(await destinataire.jalonCourant()).toBe("Arrivé à Brazzaville");
    expect(await destinataire.aideCourante()).toBe("Thomas est arrivé. Il te contacte pour convenir de la remise : prépare le code que Aminata t'a donné.");
    await destinataire.neReveleRien(secrets);

    await transport.ouvrirSuivi(picked);
    await transport.remettreContreLeCode(picked, CODE_LIVRAISON_SEED, { photo: true });
    await destinataire.ouvrir(lien.url, DESTINATAIRE.prenom);
    expect(await destinataire.jalonCourant()).toBe("Colis remis");
    expect(await destinataire.aideCourante()).toBe("Le colis t'a été remis. Bonne réception !");
    expect(await destinataire.jalonsAtteints()).toHaveLength(5);
    await destinataire.neReveleRien(secrets);
    expect((await dealBrut(thomas.contexte, picked)).status).toBe("DELIVERED");
  });

  test("WEB-DES-8 · un lien invalide : jeton altéré, destinataire effacé — le même message", async ({ navigateurVisiteur, navigateurConnecte, jeuEssai }) => {
    const picked = jeuEssai.deal("bzv-picked").id;
    const c = await navigateurVisiteur();
    const destinataire = new SuiviDestinataire(c.page);
    /* 1 — un caractère du jeton altéré. */
    const dernier = lien.token.slice(-1);
    const altere = lien.token.slice(0, -1) + (dernier === "a" ? "b" : "a");
    const texteAltere = await destinataire.lienInvalide(lien.url.replace(lien.token, altere));
    expect(texteAltere).toContain("Le colis a été remis il y a un moment, ou le lien a été retiré. Rapproche-toi de la personne qui te l'a envoyé.");
    expect(texteAltere).toContain("Toi aussi, envoie ou transporte avec Yamba");
    expect(texteAltere).not.toContain(DESTINATAIRE.prenom);
    expect(texteAltere).not.toContain("Brazzaville");
    const refusAltere = await SuiviDestinataire.refusDeLApi(c.contexte, altere);
    /* 2 — le destinataire effacé (le deal est clos, puis l'effacement de rétention passe). */
    const aminata = await navigateurConnecte("aminata");
    const confirme = await aminata.contexte.request.post(`${api()}/deals/${picked}/confirm`, { data: {} });
    expect(confirme.status(), await confirme.text()).toBe(200);
    scriptDeRecette("destinataire-eligible", picked, "40");
    const effacement = scriptDeRecette("destinataire");
    const apres = await dealBrut(aminata.contexte, picked);
    expect(apres.recipientRedactedAt ?? (apres.recipient as { firstName?: string } | null)?.firstName, "le destinataire est effacé").not.toBe(DESTINATAIRE.prenom);
    const texteEfface = await destinataire.lienInvalide(lien.url);
    expect(texteEfface, "le même message que le jeton altéré").toContain("Le colis a été remis il y a un moment, ou le lien a été retiré. Rapproche-toi de la personne qui te l'a envoyé.");
    expect(texteEfface).toContain("Toi aussi, envoie ou transporte avec Yamba");
    expect(texteEfface).not.toContain(DESTINATAIRE.prenom);
    const refusEfface = await SuiviDestinataire.refusDeLApi(c.contexte, lien.token);
    expect(refusEfface.statut).toBe(404);
    expect(refusEfface.corps, "404 uniforme : les deux causes ne se distinguent pas").toBe(refusAltere.corps);
    test.info().annotations.push({ type: "note", description: `altéré → ${refusAltere.statut} ; effacé → ${refusEfface.statut}, même corps ; effacement : ${effacement.trim().slice(0, 120)}` });
  });
});
