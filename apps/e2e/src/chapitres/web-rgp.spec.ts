/**
 * web-rgp.spec.ts — cahier 01-WEB, chapitre 5.25 « Données personnelles : export et effacement »
 * ==============================================================================================
 * L'écran « Mes données » (deux bascules, deux cartes), le téléchargement derrière la porte par code (sudo, D65),
 * le contenu du fichier (`yamba-data-export/1`, le rôle, SES montants, jamais un code de livraison ni les
 * coordonnées de l'autre partie ou du destinataire côté Voyageur, jamais les signalements qui visent le membre ni
 * les compteurs internes), la règle « un export par 24 h », la suppression bloquée par un deal vivant (liste fermée
 * de motifs, aucun code envoyé), le texte d'avertissement, la suppression réelle d'un compte créé pour l'occasion
 * (déconnexion immédiate, connexion refusée, email sans lien), « Membre supprimé » côté contrepartie, et l'effacement
 * du tiers destinataire à 30 jours (cron forcé) — un deal en litige n'étant jamais concerné.
 *
 * Comptes : Aminata (écran, export, blocage), Thomas (blocage « versement dû ») ; un compte NEUF créé par l'écran
 * pour l'avertissement, la suppression et « Membre supprimé » (il réserve sur `bzv-perkg`, Thomas accepte, un
 * message part, le deal est annulé — remboursement intégral — puis le compte est effacé). `gru-completed` (João)
 * et `bzv-disputed` (Chinwe) pour l'effacement du destinataire. La suppression ne touche JAMAIS un compte du seed.
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { test, expect, connexion, type Navigateur } from "../fixtures/yamba";
import { adresseDeLApi } from "../fixtures/adresses";
import { COMPTES, CODE_LIVRAISON_SEED, type Compte } from "../fixtures/comptes";
import { compteNeuf, type CompteNeuf } from "../fixtures/compte-neuf";
import { JeuEssai } from "../fixtures/jeu-essai";
import { Inscription } from "../pages/inscription";
import { Securite } from "../pages/securite";
import { FilMessagerie } from "../pages/fil-messagerie";
import { SuiviDestinataire } from "../pages/suivi-destinataire";
import { SuiviExpediteur } from "../pages/suivi-expediteur";
import { normaliserEspaces } from "../pages/reservation";

type Contexte = Navigateur["contexte"];
type Page = Navigateur["page"];
const api = () => adresseDeLApi();
const RACINE = join(__dirname, "../../../..");
const SUJET_SUDO = "Ton code de confirmation Yamba";

/* ══ Aides ═══════════════════════════════════════════════════════════════════════════════════ */

const texte = async (page: Page) => normaliserEspaces(await page.locator("body").innerText());
const codeDe = (t: string): string => {
  const code = /\b(\d{6})\b/.exec(t)?.[1];
  if (!code) throw new Error("aucun code à six chiffres dans l'email");
  return code;
};

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

async function ouvrirMesDonnees(page: Page): Promise<void> {
  await new Securite(page).ouvrir();
  await expect(page.getByRole("heading", { name: "Mes données" })).toBeVisible({ timeout: 60_000 });
}

async function bloqueurs(contexte: Contexte): Promise<string[]> {
  const r = await contexte.request.get(`${api()}/auth/me/erasure/blockers`);
  expect(r.ok(), await r.text()).toBe(true);
  return ((await r.json()) as { blockers: string[] }).blockers;
}

/** Une demande par l'API (FAKE) : intention en deux temps (D17), puis la réservation. */
async function reserverParApi(contexte: Contexte, tripId: string): Promise<string> {
  const devis = { tripId, product: "PARCEL", family: "CLOTHES_TEXTILE", sizeClass: "S", weightKg: 2, protection: "BASIC", declaredValueCents: 6000 };
  const sonde = await contexte.request.post(`${api()}/deals/payment-intents`, { data: { ...devis, expectedTotalCents: 1 } });
  expect(sonde.status(), await sonde.text()).toBe(409);
  const totalCents = ((await sonde.json()) as { details: { actualTotalCents: number } }).details.actualTotalCents;
  const intention = await contexte.request.post(`${api()}/deals/payment-intents`, { data: { ...devis, expectedTotalCents: totalCents } });
  expect(intention.status(), await intention.text()).toBe(201);
  const { paymentIntentId } = (await intention.json()) as { paymentIntentId: string };
  const creation = await contexte.request.post(`${api()}/deals`, {
    data: { ...devis, paymentIntentId, expectedTotalCents: totalCents, description: "Deux pulls (recette RGP, compte neuf)", photoUrls: [], recipient: { firstName: "Clarisse", lastName: "Mabiala", phoneE164: "+242061234567" }, charterAccepted: true, termsAccepted: true },
  });
  expect(creation.status(), await creation.text()).toBe(201);
  return ((await creation.json()) as { bookingId: string }).bookingId;
}

/** Un export par l'API : porte sudo (code lu dans Mailpit), puis le corps du fichier. */
async function exportParApi(contexte: Contexte, email: string, mailpit: { attendreEmail: (c: { pour: string; sujet: string }) => Promise<{ texte: string }> }): Promise<string> {
  expect((await contexte.request.post(`${api()}/auth/me/sudo/request`)).status(), "POST /auth/me/sudo/request").toBe(200);
  const courrier = await mailpit.attendreEmail({ pour: email, sujet: SUJET_SUDO });
  expect((await contexte.request.post(`${api()}/auth/me/sudo/verify`, { data: { code: codeDe(courrier.texte) } })).ok()).toBe(true);
  const r = await contexte.request.post(`${api()}/auth/me/data-export`, { data: {} });
  expect(r.status(), await r.text()).toBe(200);
  return r.text();
}

/* ══ L'état partagé ══════════════════════════════════════════════════════════════════════════ */

let neuf: CompteNeuf;
let compte: Compte;
let exportBrut = ""; // le contenu du fichier (Playwright efface le téléchargement à la fin de SA fiche)
let dealDuNeuf = "";
let filDuNeuf = "";

/* ══ Les fiches ══════════════════════════════════════════════════════════════════════════════ */

test.describe("WEB-RGP — données personnelles : export et effacement (chapitre 5.25)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(() => {
    const jeu = new JeuEssai();
    jeu.rejouer();
    scriptDeRecette("versement-bloque", jeu.deal("bzv-completed-blocked").id); // le cron FAKE ferait partir le versement de Thomas (RGP-5)
    // Les codes de la porte sudo sont plafonnés (6 par heure, 1 min entre deux — `auth.helper.ts`) : rejouer le
    // chapitre dans la même heure épuiserait le quota et AUCUN email ne partirait, sans message à l'écran.
    for (const email of [COMPTES.aminata.email, COMPTES.thomas.email]) scriptDeRecette("otp-debloquer", email);
  });

  test("WEB-RGP-1 · l'écran « Mes données »", async ({ navigateurConnecte }) => {
    const { page } = await navigateurConnecte("aminata");
    await ouvrirMesDonnees(page);
    const corps = await texte(page);
    expect(corps).toContain("Mes données Ce que Yamba garde, ce que tu peux télécharger ou supprimer");
    expect(corps).toContain("Relance par email des messages non lus");
    expect(corps).toContain("Un email si un message reste sans lecture 15 minutes, au plus un par heure");
    expect(corps).toContain("Mesure d'audience");
    expect(corps).toContain("Pages vues, recherches, étapes de réservation — pour améliorer Yamba, jamais pour la publicité");
    const bascules = page.getByRole("switch");
    expect(await bascules.count(), "deux bascules").toBeGreaterThanOrEqual(2);
    // ANO-WEB-81 : chaque bascule reflète la préférence du COMPTE (servie par /auth/me), pas le navigateur.
    // L'état arrive avec la requête `user` : l'assertion doit être ré-essayée (sinon elle lit l'état initial).
    const servi = (await (await page.context().request.get(`${api()}/auth/me`)).json()) as { user: { analyticsOptIn?: boolean | null; messagingReminderEmails?: boolean } };
    // La bascule est le frère du bloc de texte de SA ligne (un `filter({hasText})` remonterait à la section entière).
    const ligne = (libelle: string) => page.getByText(libelle, { exact: true }).locator("xpath=../following-sibling::*[@role='switch'][1]");
    await expect(ligne("Relance par email des messages non lus")).toHaveAttribute("aria-checked", String(servi.user.messagingReminderEmails === true), { timeout: 15_000 });
    await expect(ligne("Mesure d'audience")).toHaveAttribute("aria-checked", String(servi.user.analyticsOptIn === true), { timeout: 15_000 });
    expect(corps).toContain("Télécharger mes données");
    expect(corps).toContain("Un fichier JSON avec ton profil, tes trajets, tes réservations, tes messages… Une fois par 24 h.");
    await expect(page.getByRole("button", { name: "Télécharger", exact: true })).toBeVisible();
    expect(corps).toContain("Supprimer mon compte");
    expect(corps).toContain("Immédiat et irréversible. Tes réservations et litiges restent, sans ton nom.");
    await expect(page.getByRole("button", { name: "Supprimer", exact: true })).toBeVisible();
  });

  test("WEB-RGP-5 · la suppression est bloquée par un deal vivant (Aminata, puis Thomas)", async ({ navigateurConnecte, jeuEssai, mailpit }) => {
    await mailpit.vider();
    const attendus = ["Un deal est en cours (accepté, en transit, livré ou en litige).", "Une demande de réservation attend une réponse.", "Un versement t'est encore dû ou a échoué.", "Une retenue d'annulation est en médiation.", "Un trajet est encore publié ou en pause : annule-le d'abord.", "Ce compte porte un profil administrateur : demande sa révocation."];
    const libelles: Record<string, string> = { ACTIVE_DEAL: attendus[0], PENDING_REQUEST: attendus[1], PAYOUT_PENDING: attendus[2], RETENTION_HELD: attendus[3], PUBLISHED_TRIP: attendus[4], ADMIN_ACCOUNT: attendus[5] };
    for (const cle of ["aminata", "thomas"] as const) {
      if (cle === "thomas") scriptDeRecette("versement-bloque", jeuEssai.deal("bzv-completed-blocked").id);
      const { page, contexte } = await navigateurConnecte(cle);
      const servis = await bloqueurs(contexte);
      expect(servis.length, `${cle} : au moins un motif`).toBeGreaterThan(0);
      for (const b of servis) expect(Object.keys(libelles), `motif ${b} dans la liste fermée`).toContain(b);
      await ouvrirMesDonnees(page);
      const securite = new Securite(page);
      await securite.cliquerSupprimer();
      const panneau = await securite.suppressionBloquee();
      for (const b of servis) expect(panneau, `${cle} : « ${libelles[b]} »`).toContain(libelles[b]);
      for (const l of attendus.filter((x) => !servis.map((b) => libelles[b]).includes(x))) expect(panneau, `${cle} : jamais un motif non servi`).not.toContain(l);
      if (cle === "thomas") expect(servis, "Thomas : versement en échec").toContain("PAYOUT_PENDING");
      if (cle === "aminata") expect(servis).toContain("ACTIVE_DEAL");
      test.info().annotations.push({ type: "note", description: `${cle} : ${servis.join(", ")}` });
    }
    await new Promise((r) => setTimeout(r, 3_000));
    expect(await mailpit.compter({ sujet: SUJET_SUDO }), "aucun code envoyé").toBe(0);
  });

  test("WEB-RGP-2 · télécharger ses données (porte par code)", async ({ navigateurConnecte, mailpit }) => {
    await mailpit.vider();
    // La fenêtre sudo est liée au `jti` de la session (D65) : une session MÉMORISÉE d'un passage précédent
    // peut encore en porter une ouverte, et la porte ne se présenterait pas. Connexion par l'écran = jti neuf.
    const { page, contexte } = await navigateurConnecte("aminata", { parEcran: true });
    expect(((await (await contexte.request.get(`${api()}/auth/me/sudo`)).json()) as { active: boolean }).active, "aucune fenêtre sudo ouverte").toBe(false);
    await ouvrirMesDonnees(page);
    const securite = new Securite(page);
    const chemin = await securite.telechargerMesDonnees(COMPTES.aminata.email, mailpit);
    const email = await mailpit.attendreEmail({ pour: COMPTES.aminata.email, sujet: SUJET_SUDO });
    expect(codeDe(email.texte)).toMatch(/^\d{6}$/);
    const corps = await texte(page);
    expect(corps).toMatch(/Ton fichier est téléchargé\. \(yamba-mes-donnees-\d{4}-\d{2}-\d{2}\.json\)/);
    exportBrut = readFileSync(chemin, "utf-8"); // lu ICI : l'artefact disparaît à la fin de la fiche
    test.info().annotations.push({ type: "note", description: `fichier ${chemin} (${Math.round(exportBrut.length / 1024)} Ko) ; email « ${email.sujet} »` });
  });

  test("WEB-RGP-3 · le contenu du fichier", async ({ navigateurConnecte, mailpit }) => {
    expect(exportBrut, "le fichier de la fiche 2").not.toBe("");
    const brut = exportBrut;
    const racine = JSON.parse(brut) as Record<string, unknown>;
    const inventaire = Object.entries(racine).map(([k, v]) => `${k}${Array.isArray(v) ? `[${v.length}]` : ""}`).join(", ");
    test.info().annotations.push({ type: "note", description: `clés de l'export : ${inventaire}` });
    const json = JSON.parse(brut) as { format: string; profile: Record<string, unknown>; bookings: Array<Record<string, unknown>>; reviewsReceived?: unknown[]; reports?: unknown[]; reportsMade?: unknown[] };
    expect(json.format, "le format du fichier").toBe("yamba-data-export/1");
    // Constat : le cahier dit « le fichier commence par "format" » ; il commence par `exportedAt`, puis `format`.
    expect(Object.keys(racine).slice(0, 2)).toEqual(["exportedAt", "format"]);
    /* Les réservations : le rôle du membre et SES montants. */
    expect(json.bookings.length).toBeGreaterThan(0);
    for (const b of json.bookings) {
      expect(["SHIPPER", "CARRIER"]).toContain(b.role);
      expect(b.role, "Aminata est toujours Expéditrice").toBe("SHIPPER");
    }
    const cles = new Set(json.bookings.flatMap((b) => Object.keys(b)));
    expect([...cles].some((k) => /amount|Cents|price|total/i.test(k)), "des montants").toBe(true);
    /* Jamais un code de livraison, en clair ou chiffré. */
    const minuscule = brut.toLowerCase();
    for (const mot of ["deliverycode", "deliverycodehash", "deliverycodeencrypted", CODE_LIVRAISON_SEED]) expect(minuscule, `jamais « ${mot} »`).not.toContain(mot.toLowerCase());
    /* Jamais les signalements qui la visent, les notes internes, le détail des médiations, les compteurs de litiges. */
    for (const mot of ["reportsagainst", "reportsreceived", "adminnote", "internalnote", "disputeslostcount", "disputeslost", "trustscore", "risklevel", "resolutionreason", "carrierstatement", "\"resolution\"", "refusalreasons"]) {
      expect(minuscule, `jamais « ${mot} »`).not.toContain(mot);
    }
    /* Les signalements faits et les avis reçus révélés ont leur place (clés présentes). */
    expect(Object.keys(racine), "les signalements FAITS").toContain("reportsMade");
    expect(Object.keys(racine), "les avis reçus").toContain("reviewsReceived");
    expect(Object.keys(racine), "jamais les signalements qui la visent").not.toContain("reportsReceived");
    // Les avis reçus ne sont là que RÉVÉLÉS (double-aveugle D53) : aucun avis sans date de révélation.
    for (const a of (racine.reviewsReceived as Array<Record<string, unknown>>) ?? []) expect(a.revealedAt ?? null, "avis révélé").not.toBeNull();
    /* L'Expéditrice garde SES destinataires (elle les a saisis) mais jamais l'identité de l'autre partie. */
    expect(brut, "jamais le nom de famille du Voyageur").not.toContain("Nkounkou");
    expect(brut, "jamais son email").not.toContain(COMPTES.thomas.email);
    /* Côté VOYAGEUR : l'export de Thomas ne porte ni destinataire ni coordonnées de l'Expéditrice. */
    const thomas = await navigateurConnecte("thomas", { parEcran: true });
    const exportVoyageur = await exportParApi(thomas.contexte, COMPTES.thomas.email, mailpit);
    const jsonVoyageur = JSON.parse(exportVoyageur) as { bookings: Array<Record<string, unknown>> };
    expect(jsonVoyageur.bookings.length).toBeGreaterThan(0);
    for (const b of jsonVoyageur.bookings) {
      expect(b.role, "Thomas est Voyageur").toBe("CARRIER");
      expect(b, "aucun destinataire dans l'export d'un Voyageur").not.toHaveProperty("recipient");
    }
    for (const secret of ["+242061234567", "Clarisse", "Mabiala", COMPTES.aminata.email, "Diallo"]) {
      expect(exportVoyageur, `export Voyageur sans « ${secret} »`).not.toContain(secret);
    }
    for (const mot of ["deliverycode", CODE_LIVRAISON_SEED]) expect(exportVoyageur.toLowerCase(), `jamais « ${mot} »`).not.toContain(mot.toLowerCase());
    test.info().annotations.push({ type: "note", description: `Expéditrice : ${json.bookings.length} réservations (rôle SHIPPER), clés : ${[...cles].slice(0, 22).join(", ")} ; Voyageur : ${jsonVoyageur.bookings.length} réservations, aucune clé recipient` });
  });

  test("WEB-RGP-4 · un export par 24 heures", async ({ navigateurConnecte, mailpit }) => {
    const { page, contexte } = await navigateurConnecte("aminata");
    const avant = await mailpit.compter({ pour: COMPTES.aminata.email, sujet: SUJET_SUDO });
    await ouvrirMesDonnees(page);
    await page.getByRole("button", { name: "Télécharger", exact: true }).click();
    const reponse = page.waitForResponse((r) => r.url().includes("/auth/me/data-export") && r.request().method() === "POST", { timeout: 30_000 });
    const telechargements: string[] = [];
    page.on("download", (d) => telechargements.push(d.suggestedFilename()));
    await page.getByRole("button", { name: "Télécharger le fichier" }).click();
    const r = await reponse;
    expect(r.status(), "refus explicite").toBe(400);
    const corps = (await r.json()) as { message?: string; details?: { code?: string; nextAt?: string } };
    expect(corps.details?.code).toBe("EXPORT_RATE_LIMITED");
    await page.waitForTimeout(1_500);
    const ecran = await texte(page);
    // ANO-WEB-84 : le refus est dit en FRANÇAIS (par son code), jamais le message brut du serveur.
    expect(ecran).toContain("Un seul export par 24 heures : tu pourras en redemander un demain.");
    expect(ecran, "jamais le message anglais du serveur").not.toContain("One export per 24 hours");
    expect(telechargements, "aucun second fichier").toHaveLength(0);
    expect(await mailpit.compter({ pour: COMPTES.aminata.email, sujet: SUJET_SUDO }), "aucun nouveau code").toBe(avant);
    const direct = await contexte.request.post(`${api()}/auth/me/data-export`);
    expect(direct.status()).toBe(400);
    test.info().annotations.push({ type: "constat", description: `refus : ${r.status()} ${corps.details?.code} « ${corps.message} » (nextAt ${corps.details?.nextAt}) ; à l'écran : « ${ecran.match(/[^.]*24 ?h[^.]*\./i)?.[0]?.trim() ?? "?"} »` });
  });

  test("WEB-RGP-6 · le texte d'avertissement de la suppression (compte neuf)", async ({ navigateurVisiteur, mailpit }) => {
    test.setTimeout(6 * 60_000);
    await mailpit.vider();
    neuf = compteNeuf("Nadège", "Okemba");
    compte = { cle: "neuf", email: neuf.email, prenom: neuf.prenom, nom: neuf.nom, role: "EXPEDITEUR" };
    const { page, contexte } = await navigateurVisiteur();
    await new Inscription(page).creer(neuf, mailpit);
    await connexion(page, compte, neuf.motDePasse);
    expect(await bloqueurs(contexte), "un compte neuf n'a rien en cours").toEqual([]);
    await ouvrirMesDonnees(page);
    await new Securite(page).cliquerSupprimer();
    await expect(page.getByText("Ton identité, tes coordonnées, tes adresses, tes alertes, tes favoris et tes justificatifs seront effacés. L'historique de tes réservations et de tes litiges reste (obligations comptables), ainsi que les avis et les messages déjà échangés, sans ton nom. Ton compte Stripe n'est pas supprimé par Yamba.")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Impossible pour l'instant")).toHaveCount(0);
  });

  test("WEB-RGP-7 · supprimer son compte (le compte neuf, après un deal annulé et un message)", async ({ navigateurVisiteur, navigateurConnecte, jeuEssai, mailpit }) => {
    test.setTimeout(8 * 60_000);
    const { page, contexte } = await navigateurVisiteur();
    await connexion(page, compte, neuf.motDePasse);
    /* Un deal accepté, un message, puis l'annulation (remboursement intégral, à plus de 48 h) : le fil survivra au compte. */
    const thomas = await navigateurConnecte("thomas");
    dealDuNeuf = await reserverParApi(contexte, jeuEssai.trajet("bzv-perkg"));
    expect((await thomas.contexte.request.post(`${api()}/deals/${dealDuNeuf}/accept`, { data: { charterAccepted: true } })).status()).toBe(200);
    filDuNeuf = await FilMessagerie.identifiantDuFil(contexte, dealDuNeuf);
    const message = await contexte.request.post(`${api()}/messages/conversations/${filDuNeuf}/messages`, { data: { body: "Bonjour Thomas, je vous confirme le rendez-vous de samedi matin." } });
    expect(message.status(), await message.text()).toBeLessThan(300);
    const annulation = await contexte.request.post(`${api()}/deals/${dealDuNeuf}/cancel`, { data: { reason: "Recette RGP-7 : le compte va être supprimé." } });
    expect(annulation.status(), await annulation.text()).toBe(200);
    expect(await bloqueurs(contexte), "plus rien en cours").toEqual([]);
    await mailpit.vider();

    /* Étapes 1 à 3 — le mot de confirmation, puis la porte par code (elle se présente AU GESTE, comme l'export). */
    await ouvrirMesDonnees(page);
    await new Securite(page).cliquerSupprimer();
    const champ = page.getByPlaceholder("SUPPRIMER");
    await expect(champ).toBeVisible({ timeout: 15_000 });
    const bouton = page.getByRole("button", { name: "Supprimer définitivement mon compte" });
    await champ.fill("supprime");
    await expect(bouton, "un mot incomplet n'active rien").toBeDisabled();
    await champ.fill("supprimer");
    const valeurSaisie = await champ.inputValue(); // le champ met en MAJUSCULES à la frappe
    await expect(bouton).toBeEnabled();
    /* Étape 4 — le geste : 403 SUDO_REQUIRED, la porte, le code, puis la suppression rejouée. */
    const refus = page.waitForResponse((r) => r.url().includes("/auth/me/erasure") && r.request().method() === "POST", { timeout: 30_000 });
    await bouton.click();
    const r403 = await refus;
    expect(r403.status(), "403 SUDO_REQUIRED").toBe(403);
    expect(((await r403.json()) as { details?: { code?: string } }).details?.code).toBe("SUDO_REQUIRED");
    await expect(page.getByText("Confirme que c'est bien toi")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "M'envoyer le code" }).click();
    const email = await mailpit.attendreEmail({ pour: neuf.email, sujet: SUJET_SUDO });
    await page.getByLabel("Code reçu par email").fill(codeDe(email.texte));
    const suppression = page.waitForResponse((r) => r.url().includes("/auth/me/erasure") && r.request().method() === "POST" && r.status() !== 403, { timeout: 60_000 });
    await page.getByRole("button", { name: "Confirmer", exact: true }).click();
    const r = await suppression;
    expect(r.status(), await r.text()).toBeLessThan(300);
    /* Déconnexion immédiate, accueil en visiteur. */
    await expect(page).toHaveURL(/\/fr\/?$/, { timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Menu utilisateur" })).toHaveCount(0, { timeout: 30_000 });
    expect((await contexte.request.get(`${api()}/auth/me`)).status(), "la session est morte").toBe(401);
    /* Connexion refusée. */
    const relogin = await contexte.request.post(`${api()}/auth/login`, { data: { email: neuf.email, password: neuf.motDePasse } });
    expect(relogin.status(), "l'ancienne adresse ne se connecte plus").toBeGreaterThanOrEqual(400);
    /* Email « Ton compte Yamba a été supprimé », sans lien. */
    const adieu = await mailpit.attendreEmail({ pour: neuf.email, sujet: /^Ton compte Yamba a été supprimé$/ });
    expect(adieu.html, "sans lien").not.toMatch(/<a\s+[^>]*href="http/i);
    expect(adieu.texte).not.toMatch(/https?:\/\//);
    test.info().annotations.push({ type: "constat", description: `« supprimer » saisi en minuscules → le champ affiche « ${valeurSaisie} » et le bouton s'active : le champ met en MAJUSCULES à la frappe (le cahier attendait un bouton inactif) ; geste → 403 SUDO_REQUIRED puis ${r.status()} ; connexion ensuite → ${relogin.status()} ; email « ${adieu.sujet} » sans lien` });
  });

  test("WEB-RGP-8 · l'autre partie voit « Membre supprimé »", async ({ navigateurConnecte }) => {
    test.skip(!filDuNeuf, "aucun compte effacé porteur d'un fil");
    const { page, contexte } = await navigateurConnecte("thomas");
    const fil = await contexte.request.get(`${api()}/messages/conversations/${filDuNeuf}`);
    expect(fil.ok(), await fil.text()).toBe(true);
    const brut = await fil.text();
    expect(brut).toContain("je vous confirme le rendez-vous de samedi matin");
    expect(brut, "jamais l'ancien prénom").not.toContain(neuf.prenom);
    expect(brut, "jamais l'ancienne adresse").not.toContain(neuf.email);
    await page.goto(`/fr/dashboard/messages?conversation=${filDuNeuf}`, { waitUntil: "networkidle" });
    await expect(page.getByText("je vous confirme le rendez-vous de samedi matin").last()).toBeVisible({ timeout: 60_000 });
    const corps = await texte(page);
    expect(corps).toMatch(/Membre supprimé|Membre s\./);
    expect(corps).not.toContain(neuf.prenom);
    /* « Voir le numéro » n'a plus rien à montrer : le geste ne révèle AUCUN chiffre. */
    const numero = page.getByRole("button", { name: "Voir le numéro" }).first();
    await expect(numero).toBeVisible({ timeout: 15_000 });
    const reponse = page.waitForResponse((r) => /\/conversations\/[^/]+\/phone$/.test(r.url()) && r.request().method() === "POST", { timeout: 30_000 }).catch(() => null);
    await numero.click();
    const r = await reponse;
    await page.waitForTimeout(1_500);
    const apres = await texte(page);
    expect(apres, "aucun numéro de téléphone").not.toMatch(/\+\d{6,}/);
    expect(apres, "aucun numéro local non plus").not.toMatch(/\b0[1-9](?:[ .-]?\d{2}){4}\b/);
    // ANO-WEB-85 : le refus est DIT à l'écran (il ne vivait que dans l'attribut `title` du bouton).
    const message = apres.match(/Le numéro s'affiche à partir du [^.]*|Numéro indisponible|Propose(z)? un rendez-vous[^.]*/i)?.[0] ?? null;
    expect(message, "le refus de révélation est dit à l'écran").not.toBeNull();
    const deal = await contexte.request.get(`${api()}/deals/${dealDuNeuf}`);
    expect(deal.ok(), "le deal reste").toBe(true);
    test.info().annotations.push({ type: r ? "note" : "constat", description: `contrepartie affichée : « Membre supprimé » ; « Voir le numéro » → ${r ? `${r.status()} ${(await r.text()).slice(0, 120)}` : "aucun appel"} ; message à l'écran : ${message ? `« ${message} »` : "AUCUN (le bouton reste, sans réponse visible)"}` });
  });

  test("WEB-RGP-9 · le tiers destinataire est effacé à 30 jours (cron forcé) — jamais un deal en litige", async ({ navigateurConnecte, navigateurVisiteur, jeuEssai }) => {
    const termine = jeuEssai.deal("gru-completed").id; // João ↔ Inês
    const litige = jeuEssai.deal("bzv-disputed").id; // Chinwe ↔ Thomas
    const joao = await navigateurConnecte("joao");
    const chinwe = await navigateurConnecte("chinwe");
    const lien = await joao.contexte.request.post(`${api()}/deals/${termine}/tracking-link`);
    const cheminLien = lien.ok() ? ((await lien.json()) as { path: string }).path : null;
    scriptDeRecette("destinataire-eligible", termine, "40");
    const passe = scriptDeRecette("destinataire");
    /* Le récapitulatif côté Expéditeur : nom, téléphone, email effacés. */
    const apres = (await (await joao.contexte.request.get(`${api()}/deals/${termine}`)).json()) as { deal: { recipient: { firstName: string; lastName: string; phoneE164: string; email: string | null }; recipientRedactedAt?: string | null } };
    expect(apres.deal.recipient.firstName).toBe("—");
    expect(apres.deal.recipient.lastName).toBe("—");
    expect(apres.deal.recipient.phoneE164).toBe("+00000000000");
    expect(apres.deal.recipient.email ?? null).toBeNull();
    await new SuiviExpediteur(joao.page).ouvrir(termine);
    const corps = await texte(joao.page);
    expect(corps).not.toContain("Beatriz"); // RCP_GRU du seed
    expect(corps).not.toContain("+55");
    expect(corps).toMatch(/REMIS À — —|—/);
    /* Le lien de suivi (s'il a pu être créé sur un deal clos) répond « plus valide ». */
    if (cheminLien) {
      const c = await navigateurVisiteur();
      const texteInvalide = await new SuiviDestinataire(c.page).lienInvalide(`${new URL(joao.page.url()).origin}${cheminLien}`);
      expect(texteInvalide).toContain("Le colis a été remis il y a un moment, ou le lien a été retiré.");
    }
    /* Un deal en litige n'est pas concerné. */
    const encore = (await (await chinwe.contexte.request.get(`${api()}/deals/${litige}`)).json()) as { deal: { status: string; recipient: { firstName: string; phoneE164: string } } };
    expect(encore.deal.status).toBe("DISPUTED");
    expect(encore.deal.recipient.firstName).toBe("Clarisse");
    expect(encore.deal.recipient.phoneE164).toBe("+242061234567");
    test.info().annotations.push({ type: "note", description: `passe : ${passe.trim().slice(0, 140)} ; lien de suivi sur le deal clos : ${cheminLien ?? `refusé (${lien.status()})`}` });
  });
});
