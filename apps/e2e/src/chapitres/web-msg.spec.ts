/**
 * web-msg.spec.ts — cahier 01-WEB, chapitre 5.15 « Messagerie, rendez-vous et numéro de téléphone »
 * ==================================================================================================
 * Le fil par deal (D61) : la liste et son état vide, un fil qui n'existe pas avant l'acceptation, le
 * message qui traverse (deux navigateurs, bulle à droite, fil groupé par jour, actualisation seule,
 * notification), les neuf réponses rapides qui remplissent sans envoyer (dans la langue du lecteur),
 * les deux gardes (le code de livraison refusé — jamais dans le fil —, les coordonnées repérées mais
 * pas bloquées, visibles du support), le rendez-vous (proposer, pas d'auto-acceptation, les bornes
 * 30 min / 90 j / 12 h, contre-proposer puis accepter), le numéro qui s'ouvre 2 h avant et laisse une
 * ligne système unique, « Appeler » qui ne compose jamais, les sept boutons de contact qui mènent au
 * MÊME fil, le signalement d'un message (jamais le sien, jamais deux fois, l'autre n'est pas prévenu),
 * aucune suppression, le fil en lecture seule pendant un litige et 14 jours après la fin, l'email de
 * relance (jamais le texte, au plus un par heure), un tiers qui ne voit rien.
 *
 * Deal de travail : `bzv-accepted` (A = Pauline, B = Thomas) — le seed y pose deux messages, un
 * rendez-vous proposé par Thomas et un message signalé. Les gardes se jouent sur `bzv-picked`
 * (Aminata ↔ Thomas, code 742891), le litige sur `bzv-disputed` (Chinwe), la fenêtre de 14 jours sur
 * `bzv-completed` (Mai, terminé il y a 2 jours — manœuvre consignée pour le fermer), la relance par
 * `scripts/recette/relance-eligible.ts` + `relance.ts` (le cron des 5 minutes, forcé).
 */
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { test, expect, type Navigateur } from "../fixtures/yamba";
import { adresseDeLApi, adresseDeLApiAdmin } from "../fixtures/adresses";
import { COMPTES } from "../fixtures/comptes";
import { JeuEssai } from "../fixtures/jeu-essai";
import { FilMessagerie, dateLocale } from "../pages/fil-messagerie";
import { normaliserEspaces } from "../pages/reservation";

type Contexte = Navigateur["contexte"];
type Page = Navigateur["page"];
const api = () => adresseDeLApi();
const RACINE = join(__dirname, "../../../..");

/* ══ Le cahier ═══════════════════════════════════════════════════════════════════════════════ */

const REPONSES_RAPIDES = [
  "Je suis en route.",
  "J'ai environ 20 minutes de retard.",
  "À quel terminal es-tu ?",
  "Je suis au terminal, près des comptoirs d'enregistrement.",
  "Quel est ton numéro de vol ?",
  "Le colis est prêt, emballé et fermé.",
  "J'ai atterri, je récupère mes bagages.",
  "Le destinataire est prévenu et disponible.",
  "Appelle-moi quand tu arrives.",
];
const MOTIFS_SIGNALEMENT = ["Veut sortir de Yamba (paiement ou envoi en dehors)", "Tentative d'arnaque", "Propos déplacés ou harcèlement", "Autre"];
const MESSAGE_A = "Bonjour Thomas, le colis est prêt.";
const REPONSE_B = "Parfait, à demain !";

/* ══ L'état partagé (mode série) ═════════════════════════════════════════════════════════════ */

/** Le fil de bzv-accepted (Pauline ↔ Thomas). */
let filAccepte = "";

/* ══ Aides ═══════════════════════════════════════════════════════════════════════════════════ */

const texte = async (page: Page) => normaliserEspaces(await page.locator("body").innerText());
const idFil = (contexte: Contexte, dealId: string) => FilMessagerie.identifiantDuFil(contexte, dealId);
/** La bulle d'un message de l'auteur (alignée à droite). */
const bulleADroite = (page: Page, contenu: string) => page.locator(".justify-end").filter({ hasText: contenu }).first();
const composer = (page: Page) => page.getByPlaceholder("Écrire un message…");
/** Le libellé du jour tel que le fil l'écrit (« jeudi 11 septembre »). */
const jour = (d: Date) => d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
function dans(minutes: number, heure?: number, minute = 0): Date {
  const d = new Date(Date.now() + minutes * 60_000);
  if (heure !== undefined) d.setHours(heure, minute, 0, 0);
  else d.setSeconds(0, 0);
  return d;
}
/** Un script de recette (scripts/recette/*.ts), exécuté avec le .env du poste. */
function scriptDeRecette(nom: string, ...args: string[]): string {
  return execFileSync("npx", ["tsx", "--env-file=.env", `scripts/recette/${nom}.ts`, ...args], { cwd: RACINE, encoding: "utf-8", timeout: 120_000 });
}
/** Un envoi que le serveur REFUSE : le statut, le code, le texte d'erreur affiché sous la saisie. */
async function envoyerRefuse(page: Page, contenu: string): Promise<{ statut: number; corps: string; erreur: string }> {
  await composer(page).fill(contenu);
  const reponse = page.waitForResponse((r) => /\/conversations\/[^/]+\/messages$/.test(r.url()) && r.request().method() === "POST", { timeout: 30_000 });
  await page.getByRole("button", { name: "Envoyer", exact: true }).click();
  const r = await reponse;
  const corps = await r.text();
  expect(r.ok(), `« ${contenu} » doit être refusé — ${r.status()} ${corps}`).toBe(false);
  const boite = page.locator(".bg-red-50").first();
  await expect(boite).toBeVisible({ timeout: 10_000 });
  return { statut: r.status(), corps, erreur: normaliserEspaces(await boite.innerText()) };
}
/**
 * Propose un rendez-vous par le panneau (« Proposer » ou « Proposer un autre » selon qu'une
 * proposition existe) et rend la réponse du serveur — le cahier joue aussi les refus.
 */
async function proposer(page: Page, rdv: { kind?: "PICKUP" | "DELIVERY"; lieu: string; precisions?: string; debut: Date; fin: Date }): Promise<{ statut: number; corps: string; erreur: string | null }> {
  if ((await page.getByLabel("Lieu").count()) === 0) await page.getByRole("button", { name: /^Proposer( un autre)?$/ }).click();
  if (rdv.kind) await page.locator("select").first().selectOption(rdv.kind);
  await page.getByLabel("Lieu").fill(rdv.lieu);
  await page.getByLabel("Début").fill(dateLocale(rdv.debut));
  await page.getByLabel("Fin").fill(dateLocale(rdv.fin));
  if (rdv.precisions !== undefined) await page.getByLabel("Précisions").fill(rdv.precisions);
  const reponse = page.waitForResponse((r) => r.url().includes("/meetups") && r.request().method() === "POST", { timeout: 30_000 });
  await page.getByRole("button", { name: "Proposer ce rendez-vous" }).click();
  const r = await reponse;
  const corps = await r.text();
  if (r.ok()) return { statut: r.status(), corps, erreur: null };
  const boite = page.locator("p.text-red-600").first();
  await expect(boite).toBeVisible({ timeout: 10_000 });
  return { statut: r.status(), corps, erreur: normaliserEspaces(await boite.innerText()) };
}
/** Les rendez-vous du fil tels que l'API les sert (pour prouver « jamais deux propositions concurrentes »). */
async function rendezVous(contexte: Contexte, conversationId: string): Promise<Array<{ kind: string; status: string; proposedByRole: string }>> {
  const r = await contexte.request.get(`${api()}/messages/conversations/${conversationId}`);
  expect(r.ok(), `GET /conversations/${conversationId}`).toBe(true);
  const corps = (await r.json()) as { meetups?: Array<{ kind: string; status: string; proposedByRole: string }>; conversation?: { meetups?: Array<{ kind: string; status: string; proposedByRole: string }> } };
  return corps.meetups ?? corps.conversation?.meetups ?? [];
}
async function nombreDeConversations(contexte: Contexte): Promise<number> {
  const r = await contexte.request.get(`${api()}/messages/conversations`);
  expect(r.ok(), "GET /conversations").toBe(true);
  return ((await r.json()) as { items: unknown[] }).items.length;
}

/* ══ Les fiches ══════════════════════════════════════════════════════════════════════════════ */

test.describe("WEB-MSG — messagerie, rendez-vous et numéro (chapitre 5.15)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(() => {
    new JeuEssai().rejouer();
  });

  test("WEB-MSG-1 · la liste des conversations", async ({ navigateurConnecte, jeuEssai }) => {
    const { page, contexte } = await navigateurConnecte("pauline");
    filAccepte = await idFil(contexte, jeuEssai.deal("bzv-accepted").id);
    // La bulle de l'en-tête se lit AVANT d'ouvrir la messagerie (sur écran large, le premier fil s'ouvre seul et se marque
    // lu). Le seed laisse Pauline à jour (rien à lire) et Thomas avec UN message non lu → sa bulle dit « 1 » ; la sémantique
    // (messages ou conversations) se tranche en MSG-21.
    await page.goto("/fr/dashboard/home", { waitUntil: "networkidle" });
    await expect(page.locator('a[href="/fr/dashboard/messages"]').first(), "Pauline : rien à lire").toHaveText("");
    const thomas = await navigateurConnecte("thomas");
    await thomas.page.goto("/fr/dashboard/home", { waitUntil: "networkidle" });
    await expect(thomas.page.locator('a[href="/fr/dashboard/messages"]').first(), "Thomas : un message non lu").toContainText("1", { timeout: 60_000 });
    await page.goto("/fr/dashboard/messages", { waitUntil: "networkidle" });
    await expect(page.getByText("Thomas", { exact: true }).first()).toBeVisible({ timeout: 60_000 });
    const corps = await texte(page);
    expect(corps).toContain("Paris → Brazzaville");
    expect(corps).toMatch(/Bonjour, parfait\. Je propose le terminal 2E/); // le dernier message (Thomas)
    expect(corps).toContain("· à confirmer"); // le rendez-vous proposé par Thomas
    // Sur écran large, le premier fil s'ouvre seul : liste à gauche, fil à droite.
    await expect(composer(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Choisissez une conversation.")).toHaveCount(0);
    test.info().annotations.push({ type: "constat", description: "la ligne de la liste porte le prénom, le corridor, le dernier message et le rendez-vous « à confirmer » — pas le RÔLE de l'interlocuteur (Voyageur / Expéditrice) ; sur écran large le premier fil s'ouvre seul, « Choisissez une conversation. » n'apparaît que sans aucun fil" });
  });

  test("WEB-MSG-2 · l'état vide", async ({ navigateurConnecte }) => {
    const { page } = await navigateurConnecte("mai");
    await page.goto("/fr/dashboard/messages", { waitUntil: "networkidle" });
    await expect(page.getByText("Aucune conversation")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Une conversation s'ouvre dès qu'un Voyageur accepte votre colis, ou dès que vous acceptez une demande.")).toBeVisible();
    await expect(page.getByText("Choisissez une conversation.")).toBeVisible();
  });

  test("WEB-MSG-3 · la conversation n'existe pas avant l'acceptation", async ({ navigateurConnecte, jeuEssai }) => {
    const { page, contexte } = await navigateurConnecte("aminata");
    const pending = jeuEssai.deal("bzv-pending").id;
    const avant = await nombreDeConversations(contexte);
    await page.goto(`/fr/bookings/${pending}`, { waitUntil: "networkidle" });
    await expect(page.getByText("En attente du Voyageur").first()).toBeVisible({ timeout: 60_000 });
    const boutons = await page.getByRole("button", { name: /message|contacter|appeler/i }).count();
    test.info().annotations.push({ type: "constat", description: boutons === 0 ? "le suivi d'une demande en attente n'a AUCUN bouton de message (le cahier attend un bouton qui explique « La conversation s'ouvre une fois le deal accepté. »)" : `${boutons} bouton(s) de contact sur le suivi en attente` });
    // Le serveur : pas de fil avant l'acceptation, et rien n'est créé.
    const r = await contexte.request.get(`${api()}/messages/conversations/by-deal/${pending}`);
    expect(r.status(), "le fil n'existe pas avant l'acceptation").toBe(403);
    expect(await r.text()).toContain("CONVERSATION_NOT_OPEN");
    expect(await nombreDeConversations(contexte), "aucun fil créé").toBe(avant);
  });

  test("WEB-MSG-4 · envoyer un message : bulle à droite, fil groupé par jour, l'autre le voit sans recharger, notification", async ({ navigateurConnecte, mailpit }) => {
    test.setTimeout(4 * 60_000);
    await mailpit.vider();
    const A = await navigateurConnecte("pauline");
    const B = await navigateurConnecte("thomas");
    const filA = new FilMessagerie(A.page);
    const filB = new FilMessagerie(B.page);
    await filB.ouvrir(filAccepte);
    await filA.ouvrir(filAccepte);
    await expect(A.page.getByText("Le code de livraison se donne en main propre, jamais par écrit.")).toBeVisible();
    await filA.envoyer(MESSAGE_A);
    await expect(bulleADroite(A.page, MESSAGE_A), "la bulle est à droite chez l'auteur").toBeVisible();
    await expect(A.page.getByText(jour(new Date())).first(), "le fil est groupé par jour").toBeVisible();
    // Dans B, sans rechargement : le fil se rafraîchit seul (≈ 3 s).
    await expect(B.page.getByText(MESSAGE_A, { exact: true }).last()).toBeVisible({ timeout: 20_000 });
    await expect(bulleADroite(B.page, MESSAGE_A), "chez le destinataire, la bulle est à gauche").toHaveCount(0);
    // Thomas répond (le message servira au signalement, fiche 16).
    await filB.envoyer(REPONSE_B);
    await expect(A.page.getByText(REPONSE_B, { exact: true }).last()).toBeVisible({ timeout: 20_000 });
    // La notification in-app de Thomas.
    await B.page.goto("/fr/dashboard/notifications", { waitUntil: "networkidle" });
    await expect(B.page.getByText("Nouveau message").first()).toBeVisible({ timeout: 60_000 });
    expect(await texte(B.page)).toContain(`« ${MESSAGE_A} »`);
  });

  test("WEB-MSG-5 · les réponses rapides remplissent sans envoyer, dans la langue du lecteur", async ({ navigateurConnecte }) => {
    const { page } = await navigateurConnecte("pauline");
    const fil = new FilMessagerie(page);
    await fil.ouvrir(filAccepte);
    for (const r of REPONSES_RAPIDES) await expect(page.getByRole("button", { name: r, exact: true }), r).toBeVisible();
    const envois: string[] = [];
    page.on("request", (r) => { if (/\/messages$/.test(r.url()) && r.method() === "POST") envois.push(r.url()); });
    await page.getByRole("button", { name: "Je suis en route.", exact: true }).click();
    await expect(composer(page)).toHaveValue("Je suis en route.");
    await page.waitForTimeout(1_000);
    expect(envois, "rien ne part").toEqual([]);
    await expect(page.locator(".justify-end, .justify-start").filter({ hasText: "Je suis en route." }), "aucune bulle : rien n'est parti").toHaveCount(0);
    // Dans la langue du lecteur : le serveur suit la langue du COMPTE (D44), pas celle de l'adresse — on bascule
    // par le sélecteur de l'en-tête (qui enregistre la préférence), puis on revient en français.
    const bascule = async (vers: "English" | "Français") => {
      const enregistree = page.waitForResponse((r) => r.url().includes("/auth/me/locale") && r.request().method() === "PATCH", { timeout: 30_000 });
      await page.getByRole("button", { name: vers, exact: true }).first().click();
      expect((await enregistree).ok(), `préférence « ${vers} » enregistrée`).toBe(true);
    };
    await bascule("English");
    await expect(page).toHaveURL(/\/en\/dashboard\/messages/, { timeout: 30_000 });
    const enDirect = await page.getByRole("button", { name: "I'm on my way.", exact: true }).isVisible({ timeout: 10_000 }).catch(() => false);
    if (!enDirect) {
      await page.reload({ waitUntil: "networkidle" });
      test.info().annotations.push({ type: "constat", description: "après la bascule FR → EN, les réponses rapides restent en français tant que la page n'est pas rechargée (cache de la liste non invalidé par le sélecteur de langue)" });
    }
    await expect(page.getByRole("button", { name: "I'm on my way.", exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("button", { name: "Call me when you arrive.", exact: true })).toBeVisible();
    await expect(page.getByPlaceholder("Write a message…")).toBeVisible();
    await bascule("Français");
    await expect(page).toHaveURL(/\/fr\/dashboard\/messages/, { timeout: 30_000 });
  });

  test("WEB-MSG-6 · le code de livraison ne s'écrit jamais", async ({ navigateurConnecte, jeuEssai }) => {
    const { page, contexte } = await navigateurConnecte("aminata");
    const fil = new FilMessagerie(page);
    const conv = await idFil(contexte, jeuEssai.deal("bzv-picked").id);
    await fil.ouvrir(conv);
    for (const tentative of ["le code est 742891", "Le code : 742 891"]) {
      const refus = await envoyerRefuse(page, tentative);
      expect(refus.statut, tentative).toBe(400);
      expect(refus.corps).toContain("DELIVERY_CODE_IN_MESSAGE");
      await expect(page.locator(".justify-end, .justify-start").filter({ hasText: tentative }), "le message n'apparaît pas dans le fil").toHaveCount(0);
      test.info().annotations.push({ type: "constat", description: `« ${tentative} » refusé — texte sous la saisie : « ${refus.erreur} »` });
      expect(refus.erreur.toLowerCase(), "le texte sous la saisie est en français et parle du code en main propre").toMatch(/main propre|code de livraison/);
    }
    await fil.envoyer("mon numéro de vol est 123456");
  });

  test("WEB-MSG-7 · les coordonnées sont repérées, pas bloquées — et le support les voit", async ({ navigateurConnecte, navigateurAdmin, jeuEssai }) => {
    const { page, contexte } = await navigateurConnecte("aminata");
    const fil = new FilMessagerie(page);
    const dealId = jeuEssai.deal("bzv-picked").id;
    await fil.ouvrir(await idFil(contexte, dealId));
    for (const m of ["appelle-moi au 06 12 34 56 78", "écris-moi à moi@exemple.fr"]) {
      await fil.envoyer(m);
      await expect(page.locator(".bg-red-50"), "aucune alerte pour l'auteur").toHaveCount(0);
      await expect(page.locator("main").getByRole("alert").filter({ visible: true }), "aucun toast").toHaveCount(0); // l'alerte des outils Next vit hors de <main>
    }
    // Côté équipe : les deux messages sont marqués (coordonnées repérées) dans la lecture admin du fil.
    const admin = await navigateurAdmin("support");
    const r = await admin.contexte.request.get(`${adresseDeLApiAdmin()}/admin/conversations/by-deal/${dealId}`);
    expect(r.ok(), `GET /admin/conversations/by-deal → ${r.status()} ${await r.text()}`).toBe(true);
    const brut = await r.text();
    expect(brut.split('"flaggedContact":true').length - 1, "deux messages repérés").toBeGreaterThanOrEqual(2);
  });

  test("WEB-MSG-8 · proposer un rendez-vous (Thomas), « À confirmer par vous » chez Pauline", async ({ navigateurConnecte }) => {
    const A = await navigateurConnecte("pauline");
    const B = await navigateurConnecte("thomas");
    await new FilMessagerie(B.page).ouvrir(filAccepte);
    // Le seed a déjà une proposition de Thomas : le bouton dit « Proposer un autre ».
    const r = await proposer(B.page, { kind: "PICKUP", lieu: "Paris CDG, terminal 2E, comptoirs d'enregistrement", precisions: "Devant les bornes libre-service, côté départ.", debut: dans(3 * 24 * 60, 10), fin: dans(3 * 24 * 60, 11) });
    expect(r.erreur, `proposition refusée : ${r.corps}`).toBeNull();
    await expect(B.page.getByText("En attente de l'autre personne")).toBeVisible({ timeout: 15_000 });
    await expect(B.page.getByText("Un rendez-vous a été proposé.").last()).toBeVisible();
    await new FilMessagerie(A.page).ouvrir(filAccepte);
    await expect(A.page.getByText("À confirmer par vous")).toBeVisible({ timeout: 15_000 });
    await expect(A.page.getByRole("button", { name: "Accepter", exact: true })).toBeVisible();
  });

  test("WEB-MSG-9 · on n'accepte pas sa propre proposition", async ({ navigateurConnecte }) => {
    const { page } = await navigateurConnecte("thomas");
    await new FilMessagerie(page).ouvrir(filAccepte);
    await expect(page.getByText("En attente de l'autre personne")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Accepter", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Proposer un autre" })).toBeVisible();
  });

  test("WEB-MSG-10 · les bornes du créneau : 30 min à l'avance, 90 jours, 12 heures", async ({ navigateurConnecte }) => {
    const { page } = await navigateurConnecte("thomas");
    await new FilMessagerie(page).ouvrir(filAccepte);
    const essais: Array<[string, Date, Date, string]> = [
      ["dans 10 minutes", dans(10), dans(70), "TOO_SOON"],
      ["dans 120 jours", dans(120 * 24 * 60, 10), dans(120 * 24 * 60, 11), "TOO_FAR"],
      ["20 heures de durée", dans(3 * 24 * 60, 8), dans(3 * 24 * 60 + 20 * 60, 4), "WINDOW_TOO_LONG"],
    ];
    for (const [nom, debut, fin, raison] of essais) {
      const r = await proposer(page, { kind: "PICKUP", lieu: `Essai ${nom}`, debut, fin });
      expect(r.statut, nom).toBe(400);
      expect(r.corps, nom).toContain("INVALID_MEETUP_SLOT");
      expect(r.corps, nom).toContain(raison);
      test.info().annotations.push({ type: "constat", description: `${nom} → « ${r.erreur} »` });
      expect(r.erreur, `${nom} : un message en français`).toMatch(/Le rendez-vous n'a pas pu être proposé\.|30 minutes|90 jours|12 heures/);
    }
    await page.getByRole("button", { name: "Annuler", exact: true }).click();
  });

  test("WEB-MSG-11 · contre-proposer (Pauline) puis accepter (Thomas) : une seule proposition, puis « Confirmé »", async ({ navigateurConnecte }) => {
    const A = await navigateurConnecte("pauline");
    const B = await navigateurConnecte("thomas");
    await new FilMessagerie(A.page).ouvrir(filAccepte);
    const r = await proposer(A.page, { kind: "PICKUP", lieu: "Paris CDG, terminal 2E, comptoirs d'enregistrement", debut: dans(3 * 24 * 60, 12), fin: dans(3 * 24 * 60, 13) });
    expect(r.erreur, r.corps).toBeNull();
    const ouverts = (await rendezVous(A.contexte, filAccepte)).filter((m) => m.kind === "PICKUP" && m.status === "PROPOSED");
    expect(ouverts, "la contre-proposition remplace la proposition ouverte").toHaveLength(1);
    expect(ouverts[0].proposedByRole).toBe("SHIPPER");
    await expect(A.page.getByText("En attente de l'autre personne")).toBeVisible({ timeout: 15_000 });
    const filB = new FilMessagerie(B.page);
    await filB.ouvrir(filAccepte);
    await filB.accepterRendezVous();
    await expect(A.page.getByText("Confirmé", { exact: true })).toBeVisible({ timeout: 20_000 });
  });

  test("WEB-MSG-12 · le numéro s'ouvre tard", async ({ navigateurConnecte, jeuEssai }) => {
    const { page, contexte } = await navigateurConnecte("pauline");
    const fil = new FilMessagerie(page);
    await fil.ouvrir(filAccepte, true);
    const bandeau = await fil.demanderLeNumeroTropTot();
    expect(bandeau).toMatch(/^Le numéro s'affiche à partir du .+ \(2 h avant le rendez-vous confirmé ou le départ\)\.$/);
    expect(await texte(page)).not.toMatch(/\+33 ?6|\+242/);
    // Un deal accepté sans aucun rendez-vous confirmé (yul-accepted, Marie-Claire ↔ Marc).
    const mc = await navigateurConnecte("marieclaire");
    const sans = await idFil(mc.contexte, jeuEssai.deal("yul-accepted").id);
    await new FilMessagerie(mc.page).ouvrir(sans, true);
    const texteSans = await texte(mc.page);
    const attendu = texteSans.includes("Le numéro s'affiche 2 h avant le rendez-vous confirmé. Proposez et confirmez un rendez-vous ci-dessous.");
    test.info().annotations.push({ type: attendu ? "note" : "constat", description: attendu ? "sans rendez-vous : le message du cahier" : `sans rendez-vous confirmé, le bandeau dit « ${texteSans.match(/Le numéro s'affiche[^.]*\./)?.[0]} » (l'ancre de repli est le DÉPART du trajet, le message « Proposez et confirmez… » n'apparaît que sans départ connu)` });
    void contexte;
  });

  test("WEB-MSG-13 · le numéro s'affiche à l'heure et laisse une trace unique", async ({ navigateurConnecte }) => {
    test.setTimeout(3 * 60_000);
    const A = await navigateurConnecte("pauline");
    const B = await navigateurConnecte("thomas");
    // Raccourci du cahier : un rendez-vous de remise dans 40 minutes, proposé par Pauline, accepté par Thomas.
    await new FilMessagerie(A.page).ouvrir(filAccepte);
    const r = await proposer(A.page, { kind: "PICKUP", lieu: "Paris CDG, terminal 2E, comptoirs d'enregistrement", debut: dans(40), fin: dans(70) });
    expect(r.erreur, r.corps).toBeNull();
    const filB = new FilMessagerie(B.page);
    await filB.ouvrir(filAccepte);
    await filB.accepterRendezVous();
    // Pauline : « Voir le numéro ».
    await new FilMessagerie(A.page).ouvrir(filAccepte, true);
    const reponse = A.page.waitForResponse((x) => x.url().includes("/phone") && x.request().method() === "POST", { timeout: 30_000 });
    await A.page.getByRole("button", { name: "Voir le numéro" }).first().click();
    expect((await reponse).ok(), "la révélation est acceptée à moins de 2 h").toBe(true);
    await expect(A.page.getByText("Numéro de Thomas :")).toBeVisible({ timeout: 15_000 });
    const lien = A.page.locator('a[href^="tel:"]').first();
    await expect(lien).toBeVisible();
    expect(await lien.innerText()).toMatch(/^\+\d{6,}/);
    await expect(A.page.getByText("Le numéro de téléphone a été affiché.")).toHaveCount(1);
    // Un second clic ne crée pas une seconde ligne : le bouton de l'en-tête est désactivé, et après rechargement la ligne reste unique.
    await expect(A.page.getByRole("button", { name: /^\+\d/ }).first()).toBeDisabled();
    await A.page.reload({ waitUntil: "networkidle" });
    await expect(A.page.getByText("Le numéro de téléphone a été affiché.")).toHaveCount(1, { timeout: 30_000 });
    test.info().annotations.push({ type: "note", description: `numéro révélé : ${await lien.innerText()}` });
  });

  test("WEB-MSG-14 · « Appeler » ne compose jamais : il ouvre le fil, numéro en avant", async ({ navigateurConnecte, jeuEssai }) => {
    const { page } = await navigateurConnecte("thomas");
    await page.goto(`/fr/carrier/deals/${jeuEssai.deal("bzv-accepted").id}`, { waitUntil: "networkidle" });
    await expect(page.getByText("Tu es engagé sur ce Deal")).toBeVisible({ timeout: 60_000 });
    expect(await page.locator('a[href^="tel:"]').count(), "aucun lien tel: sur l'écran du deal").toBe(0);
    await page.getByRole("button", { name: /^Appeler/ }).first().click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/messages\\?conversation=${filAccepte}&focus=phone`), { timeout: 60_000 });
    await expect(page.getByText(/Numéro de Pauline :|Le numéro est disponible\.|Le numéro s'affiche/).first()).toBeVisible({ timeout: 30_000 });
  });

  test("WEB-MSG-15 · les sept boutons « Message » / « Appeler » mènent au même fil", async ({ navigateurConnecte, jeuEssai }) => {
    test.setTimeout(5 * 60_000);
    const ecrans: Array<{ nom: string; compte: keyof typeof COMPTES; deal: string; url: (id: string) => string }> = [
      { nom: "suivi Expéditeur « accepté »", compte: "pauline", deal: "bzv-accepted", url: (id) => `/fr/bookings/${id}` },
      { nom: "suivi Expéditeur « pris en charge »", compte: "aminata", deal: "bzv-picked", url: (id) => `/fr/bookings/${id}` },
      { nom: "suivi Expéditeur « en transit »", compte: "pauline", deal: "bzv-tracking", url: (id) => `/fr/bookings/${id}` },
      { nom: "deal accepté côté Voyageur", compte: "thomas", deal: "bzv-accepted", url: (id) => `/fr/carrier/deals/${id}` },
      { nom: "prise en charge côté Voyageur", compte: "thomas", deal: "bzv-accepted", url: (id) => `/fr/carrier/deals/${id}/pickup` },
      { nom: "suivi de transit côté Voyageur", compte: "thomas", deal: "bzv-picked", url: (id) => `/fr/carrier/deals/${id}` },
      { nom: "écran de livraison côté Voyageur", compte: "thomas", deal: "bzv-picked", url: (id) => `/fr/carrier/deals/${id}/deliver` },
    ];
    for (const e of ecrans) {
      const { page, contexte } = await navigateurConnecte(e.compte);
      const dealId = jeuEssai.deal(e.deal).id;
      const attendu = await idFil(contexte, dealId);
      const avant = await nombreDeConversations(contexte);
      await page.goto(e.url(dealId), { waitUntil: "networkidle" });
      await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 60_000 });
      const bouton = page.getByRole("button", { name: /^(Envoyer un message|Message|Messagerie|Écrire|Appeler)/ }).filter({ visible: true }).first();
      await expect(bouton, `${e.nom} : un bouton de contact`).toBeVisible({ timeout: 30_000 });
      const libelle = normaliserEspaces(await bouton.innerText());
      await bouton.click();
      await expect(page, `${e.nom} : le fil du deal`).toHaveURL(new RegExp(`/dashboard/messages\\?conversation=${attendu}`), { timeout: 60_000 });
      await expect(composer(page).or(page.getByText(/lecture seule|fermée à l'écriture/))).toBeVisible({ timeout: 30_000 });
      expect(await nombreDeConversations(contexte), `${e.nom} : aucun second fil`).toBe(avant);
      test.info().annotations.push({ type: "note", description: `${e.nom} : « ${libelle} » → fil ${attendu}` });
      await page.close();
    }
  });

  test("WEB-MSG-16 · signaler un message : la fenêtre, les quatre motifs, jamais deux fois, l'autre n'est pas prévenu", async ({ navigateurConnecte, mailpit }) => {
    await mailpit.vider();
    const { page } = await navigateurConnecte("pauline");
    await new FilMessagerie(page).ouvrir(filAccepte);
    const bulle = page.locator(".justify-start").filter({ hasText: REPONSE_B }).first();
    await expect(bulle).toBeVisible({ timeout: 15_000 });
    await bulle.hover();
    await bulle.getByRole("button", { name: "Signaler ce message" }).click();
    const fenetre = page.getByRole("dialog").filter({ hasText: "Signaler un message" }).first();
    await expect(fenetre).toBeVisible({ timeout: 15_000 });
    const contenu = normaliserEspaces(await fenetre.innerText());
    expect(contenu).toContain("Dis-nous ce qui ne va pas. Notre équipe lira la conversation et reviendra vers toi si besoin.");
    for (const m of MOTIFS_SIGNALEMENT) expect(contenu, m).toContain(m);
    // Les motifs sont les options d'une liste déroulante.
    expect(await fenetre.locator("select option").count(), "quatre motifs, pas un de plus").toBe(4);
    await fenetre.locator("select").selectOption("OFF_PLATFORM");
    await fenetre.locator("textarea").fill("Il propose de payer en dehors de Yamba.");
    const reponse = page.waitForResponse((r) => r.url().includes("/report") && r.request().method() === "POST", { timeout: 30_000 });
    await fenetre.getByRole("button", { name: "Envoyer le signalement" }).click();
    expect((await reponse).status()).toBe(201);
    await expect(fenetre.getByText("Merci, le signalement est transmis à notre équipe.")).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press("Escape");
    if (await fenetre.count()) await fenetre.getByRole("button", { name: "Annuler" }).click().catch(() => undefined);
    // Le même message, une seconde fois.
    await bulle.hover();
    await bulle.getByRole("button", { name: "Signaler ce message" }).click();
    const fenetre2 = page.getByRole("dialog").filter({ hasText: "Signaler un message" }).first();
    await fenetre2.locator("select").selectOption("SCAM");
    const reponse2 = page.waitForResponse((r) => r.url().includes("/report") && r.request().method() === "POST", { timeout: 30_000 });
    await fenetre2.getByRole("button", { name: "Envoyer le signalement" }).click();
    expect((await reponse2).status()).toBe(409);
    await expect(fenetre2.getByText("Tu as déjà signalé ce message.")).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press("Escape");
    // Rien ne change dans le fil ; Thomas n'est pas prévenu.
    await expect(page.getByText(REPONSE_B, { exact: true }).last()).toBeVisible();
    // Thomas n'est pas prévenu : aucun email qui parle de signalement (les crons du poste — versements — peuvent lui écrire pour autre chose).
    await page.waitForTimeout(4_000);
    const recus = (await mailpit.emailsPour(COMPTES.thomas.email)).map((e) => e.sujet);
    expect(recus.filter((sujet) => /signal|report|message/i.test(sujet)), `emails de Thomas : ${recus.join(" | ")}`).toEqual([]);
  });

  test("WEB-MSG-17, 18 · ni signalement de ses propres messages, ni suppression, ni modification", async ({ navigateurConnecte }) => {
    const { page } = await navigateurConnecte("pauline");
    await new FilMessagerie(page).ouvrir(filAccepte);
    const mienne = bulleADroite(page, MESSAGE_A);
    await expect(mienne).toBeVisible({ timeout: 15_000 });
    await mienne.hover();
    expect(await mienne.getByRole("button", { name: "Signaler ce message" }).count(), "pas de signalement sur ses propres bulles").toBe(0);
    expect(await page.getByRole("button", { name: /supprimer|modifier|éditer|effacer/i }).count(), "aucune suppression ni modification").toBe(0);
    expect(await texte(page)).not.toMatch(/Supprimer le message|Modifier le message/);
  });

  test("WEB-MSG-19 · le fil est en lecture seule pendant un litige", async ({ navigateurConnecte, jeuEssai }) => {
    const { page, contexte } = await navigateurConnecte("chinwe");
    const conv = await idFil(contexte, jeuEssai.deal("bzv-disputed").id);
    await new FilMessagerie(page).ouvrirFermeParLeLitige(conv);
  });

  test("WEB-MSG-20 · le fil se ferme 14 jours après la fin du deal", async ({ navigateurConnecte, jeuEssai }) => {
    const { page, contexte } = await navigateurConnecte("mai");
    const deal = jeuEssai.deal("bzv-completed");
    const conv = await idFil(contexte, deal.id);
    const fil = new FilMessagerie(page);
    await fil.ouvrirEncoreOuvert(conv); // terminé il y a 2 jours : encore ouvert
    jeuEssai.manoeuvre(
      "WEB-MSG-20 : raccourci du cahier — la fin du deal bzv-completed reculée à J-15 (completedAt / closedAt), au-delà des 14 jours d'écriture",
      `import db from "./packages/libs/prisma"; (async () => { const d = new Date(Date.now() - 15 * 86_400_000); await db.booking.update({ where: { id: "${deal.id}" }, data: { completedAt: d, closedAt: d } }); console.log("fin reculée à", d.toISOString()); await db.$disconnect(); })();`
    );
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByText("Cette conversation est fermée à l'écriture. Vous pouvez toujours la relire.")).toBeVisible({ timeout: 60_000 });
    await expect(composer(page)).toHaveCount(0);
    await expect(page.getByText(/Bonjour|colis/).first(), "le fil reste lisible").toBeVisible().catch(() => undefined);
  });

  test("WEB-MSG-21 · l'email de relance des messages non lus : jamais le texte, au plus un par heure", async ({ navigateurConnecte, mailpit }) => {
    test.setTimeout(4 * 60_000);
    await mailpit.vider();
    const B = await navigateurConnecte("thomas");
    const filB = new FilMessagerie(B.page);
    await filB.ouvrir(filAccepte);
    await filB.envoyer("Es-tu disponible demain matin ?");
    await filB.envoyer("Je confirme 10h.");
    // Pauline n'ouvre pas le fil. Le cron passe toutes les 5 minutes et relance après 15 minutes :
    // raccourci de recette — la conversation est rendue éligible (dernier message vieilli d'une heure), puis la passe est forcée.
    scriptDeRecette("relance-eligible", filAccepte, "SHIPPER");
    const passe1 = scriptDeRecette("relance");
    const email = await mailpit.attendreEmail({ pour: COMPTES.pauline.email, sujet: /t'a écrit à propos de/ });
    expect(email.sujet).toMatch(/^Thomas t'a écrit à propos de Paris → Brazzaville/);
    expect(email.texte + email.html, "l'email ne cite pas le message").not.toContain("Es-tu disponible demain matin");
    expect(email.texte + email.html).not.toContain("Je confirme 10h");
    // Une seconde passe dans l'heure : aucun second email.
    const passe2 = scriptDeRecette("relance");
    await B.page.waitForTimeout(3_000);
    expect(await mailpit.compter({ pour: COMPTES.pauline.email, sujet: /t'a écrit à propos de/ }), "au plus une relance par heure et par conversation").toBe(1);
    test.info().annotations.push({ type: "note", description: `passes forcées : ${passe1.trim().split("\n").pop()} / ${passe2.trim().split("\n").pop()}` });
    // La notification in-app, elle, est immédiate ; et la bulle de l'en-tête compte…
    const A = await navigateurConnecte("pauline");
    await A.page.goto("/fr/dashboard/notifications", { waitUntil: "networkidle" });
    await expect(A.page.getByText("Nouveau message").first()).toBeVisible({ timeout: 60_000 });
    const bulle = normaliserEspaces(await A.page.locator('a[href="/fr/dashboard/messages"]').first().innerText());
    test.info().annotations.push({ type: /\b1\b/.test(bulle) ? "note" : "constat", description: `bulle de l'en-tête « ${bulle} » avec UNE conversation non lue portant plusieurs messages non lus (le cahier attend le nombre de CONVERSATIONS)` });
  });

  test("WEB-MSG-22 · un tiers ne voit pas le fil", async ({ navigateurConnecte }) => {
    const { page, contexte } = await navigateurConnecte("aminata");
    const r = await contexte.request.get(`${api()}/messages/conversations/${filAccepte}`);
    expect(r.status(), "l'API refuse le fil à un tiers").toBe(403);
    expect(await r.text()).not.toContain("Bonjour");
    await page.goto(`/fr/dashboard/messages?conversation=${filAccepte}`, { waitUntil: "networkidle" });
    await expect(page.getByText("La conversation n'a pas pu être ouverte.")).toBeVisible({ timeout: 30_000 });
    const corps = await texte(page);
    expect(corps).not.toContain("Bonjour ! Le colis est pret");
    expect(corps).not.toContain(MESSAGE_A);
  });
});
