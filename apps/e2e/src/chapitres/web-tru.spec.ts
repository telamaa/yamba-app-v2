/**
 * web-tru.spec.ts — cahier 01-WEB, chapitre 5.13 « Les plafonds du compte neuf »
 * ===============================================================================
 * Les trois plafonds d'un compte de moins de 30 jours sans trois envois terminés (CNF-06, D71) :
 * la valeur déclarée (300 €), le poids (10 kg), le nombre d'envois par mois civil (5) — refusés
 * AVANT tout argent, à l'intention de paiement, avec un seul et même message —, un compte ancien
 * qui n'a aucun plafond, et un score interne que le membre ne voit jamais, ni à l'écran, ni dans
 * ses données exportées, ni dans ce que l'API lui répond.
 *
 * Le parcours WEB-E2E-4 en couvre déjà le cœur (450 €, 12 kg, cinq puis six). Ce chapitre le
 * découpe fiche par fiche et ajoute ce que le parcours ne prouvait pas : la valeur corrigée qui
 * PASSE, le poids corrigé qui PASSE, le compte ancien (Aminata) qui réserve 12 kg à 450 € sans
 * refus, le levier du back-office (`[TRU7]` : un OPS relève le plafond mensuel, l'effet est mesuré
 * en secondes, puis remis), le suivi d'envoi parmi les écrans fouillés, et les réponses brutes de
 * l'API au membre. Le compte est créé pendant la session (fiche 1) et sert aux fiches suivantes ;
 * les comptes du jeu d'essai ont 90 jours et n'ont pas de plafond.
 *
 * deal-service tourne avec le fournisseur FAKE (le Payment Element de Stripe ne se monte pas sur
 * l'origine du poste) ; les demandes créées ici restent en base (piège 22 : un compte neuf par
 * exécution, sans conséquence).
 */
import { readFileSync } from "node:fs";
import { test, expect, connexion, type Navigateur } from "../fixtures/yamba";
import type { Compte } from "../fixtures/comptes";
import { compteNeuf, type CompteNeuf } from "../fixtures/compte-neuf";
import { JeuEssai } from "../fixtures/jeu-essai";
import { adresseDeLApi, adresseDeLApiAdmin } from "../fixtures/adresses";
import { Inscription } from "../pages/inscription";
import { AssistantReservation, normaliserEspaces, type Colis } from "../pages/reservation";
import { Finances } from "../pages/finances";
import { Securite } from "../pages/securite";

type Contexte = Navigateur["contexte"];
type Page = Navigateur["page"];
const api = () => adresseDeLApi();

/* ══ Le cahier ═══════════════════════════════════════════════════════════════════════════════ */

const CLARISSE = { prenom: "Clarisse", nom: "Mabiala", indicatif: "+242", telephone: "061234567" };
const REFUS_PLAFOND = "Ton compte est récent : pour l'instant, tes envois sont plafonnés (valeur déclarée, poids et nombre par mois). Le plafond se lève avec tes premiers envois terminés.";
/** Ce qu'un membre ne doit jamais lire : ni à l'écran, ni dans un export, ni dans une réponse d'API. */
const MOTS_INTERDITS_ECRAN = ["trustscore", "trust score", "score de confiance", "niveau de risque", "compte à risque", "high_risk"];
const MOTS_INTERDITS_API = ["trustscore", "trust_score", "\"score\"", "risklevel", "\"caps\"", "capsreason", "high_risk"];
const CLE_PLAFOND_MENSUEL = "trust.newAccount.maxShipmentsPerMonth";

/* ══ L'état partagé du chapitre (mode série : la fiche 1 crée le compte) ════════════════════ */

let neuf: CompteNeuf;
let compte: Compte;
let slugPublic = "";
/** Les demandes créées par le compte neuf, dans l'ordre. */
const demandes: string[] = [];

/* ══ Aides ═══════════════════════════════════════════════════════════════════════════════════ */

/** Un navigateur neuf connecté au compte créé en fiche 1 (par l'écran — le compte n'est pas du seed). */
async function navigateurNeuf(navigateurVisiteur: () => Promise<Navigateur>): Promise<Navigateur> {
  const n = await navigateurVisiteur();
  await connexion(n.page, compte, neuf.motDePasse);
  return n;
}
/** Le nombre de demandes du membre, tel que l'API le sert (« Mes envois »). */
async function mesReservations(contexte: Contexte): Promise<number> {
  const r = await contexte.request.get(`${api()}/me/bookings`);
  expect(r.ok(), "GET /me/bookings").toBe(true);
  const body = (await r.json()) as { bookings?: unknown[]; items?: unknown[]; deals?: unknown[] };
  return (body.bookings ?? body.items ?? body.deals ?? []).length;
}
const vetements = (poidsKg: string, valeurEuros: string, description: string): Colis => ({ famille: "Vêtements & textile", taille: "S", poidsKg, valeurEuros, description });
/** Le bouton « Payer » visible (un seul arbre est rendu : sidebar sur écran large, feuille sur mobile). */
const boutonPayer = (page: Page) => page.getByRole("button", { name: /^Payer/ }).filter({ visible: true }).first();
/** Le texte de la page, espaces normalisées, en minuscules — pour y chercher ce qui ne doit pas y être. */
async function texteDeLaPage(page: Page): Promise<string> {
  await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 60_000 });
  await page.waitForLoadState("networkidle").catch(() => undefined);
  return normaliserEspaces(await page.locator("body").innerText()).toLowerCase();
}

/* ══ Les fiches ══════════════════════════════════════════════════════════════════════════════ */

test.describe("WEB-TRU — les plafonds du compte neuf (chapitre 5.13)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(() => {
    new JeuEssai().rejouer();
  });

  test("WEB-TRU-1 · le plafond de valeur déclarée : 450 € refusé avant tout paiement, 250 € passe", async ({ navigateurVisiteur, jeuEssai, mailpit }) => {
    test.setTimeout(6 * 60_000);
    await mailpit.vider();
    neuf = compteNeuf("Nadège", "Okemba");
    compte = { cle: "neuf", email: neuf.email, prenom: neuf.prenom, nom: neuf.nom, role: "EXPEDITEUR" };
    const { page, contexte } = await navigateurVisiteur();
    await new Inscription(page).creer(neuf, mailpit);
    await connexion(page, compte, neuf.motDePasse);
    const me = (await (await contexte.request.get(`${api()}/auth/me`)).json()) as { user: { id: string; publicSlug: string } };
    slugPublic = me.user.publicSlug;
    await mailpit.vider();

    /* Étapes 1 et 2 — 450 € déclarés : le refus tombe à l'intention de paiement, avant tout argent. */
    const assistant = new AssistantReservation(page);
    const trop = await assistant.tenterDeReserver(jeuEssai.trajet("bzv-perkg"), vetements("2", "450", "Deux manteaux d'hiver"), CLARISSE);
    expect(trop.refus).toBe(REFUS_PLAFOND);
    expect(trop.intentionRefusee, "le refus tombe à l'intention de paiement (ANO-WEB-08)").toBe(true);
    // ANO-WEB-40 : à côté de l'encadré de refus, « Payer » est grisé — il ne contredit plus l'encadré.
    await expect(boutonPayer(page), "« Payer » est grisé après un refus de plafond").toBeDisabled();
    await expect(page.getByRole("button", { name: "Réessayer" })).toBeVisible();

    /* Vérification complémentaire — aucune demande, aucun débit, aucune empreinte, aucun email. */
    expect(await mesReservations(contexte), "aucune demande créée").toBe(0);
    await new Finances(page).ouvrir("Paiements");
    await expect(page.getByText("Aucun paiement pour l'instant")).toBeVisible({ timeout: 30_000 });
    await mailpit.aucunEmailPour(neuf.email, 3_000);

    /* Étape 3 — la valeur corrigée à 250 € : la demande passe, le reçu part. */
    const ok = await assistant.tenterDeReserver(jeuEssai.trajet("bzv-perkg"), vetements("2", "250", "Deux manteaux d'hiver"), CLARISSE);
    expect(ok.refus, "250 € : la demande passe").toBeNull();
    expect(ok.dealId).toMatch(/^[0-9a-f]{24}$/);
    demandes.push(ok.dealId!);
    expect(await mesReservations(contexte)).toBe(1);
    await mailpit.attendreEmail({ pour: neuf.email, sujet: /Reçu : paiement autorisé/ });
    test.info().annotations.push({ type: "note", description: `compte neuf ${neuf.email} ; demande ${ok.dealId} (2 kg, 250 €, bzv-perkg)` });
  });

  test("WEB-TRU-2 · le plafond de poids : 12 kg refusé, 8 kg passe", async ({ navigateurVisiteur, jeuEssai }) => {
    test.setTimeout(5 * 60_000);
    const { page, contexte } = await navigateurNeuf(navigateurVisiteur);
    const assistant = new AssistantReservation(page);
    const fih = jeuEssai.trajet("fih");

    /* Étape 1 — 12 kg : refusé, même message, même moment (l'intention). */
    const lourd = await assistant.tenterDeReserver(fih, vetements("12", "120", "Une valise de vêtements"), CLARISSE);
    expect(lourd.refus).toBe(REFUS_PLAFOND);
    expect(lourd.intentionRefusee).toBe(true);
    await expect(boutonPayer(page)).toBeDisabled();
    expect(await mesReservations(contexte)).toBe(1);

    /* Étape 2 — 8 kg : la demande passe. */
    const ok = await assistant.tenterDeReserver(fih, vetements("8", "120", "Une valise de vêtements"), CLARISSE);
    expect(ok.refus, "8 kg : la demande passe").toBeNull();
    demandes.push(ok.dealId!);
    expect(await mesReservations(contexte)).toBe(2);
  });

  test("WEB-TRU-3 · le plafond d'envois par mois : cinq passent, la sixième est refusée dès l'autorisation — puis le levier du back-office", async ({ navigateurVisiteur, navigateurAdmin, jeuEssai }) => {
    test.setTimeout(12 * 60_000);
    const { page, contexte } = await navigateurNeuf(navigateurVisiteur);
    const assistant = new AssistantReservation(page);

    /* Étape 1 — cinq demandes dans le mois civil (deux existent déjà : fiches 1 et 2), sur plusieurs trajets. */
    const deja = await mesReservations(contexte);
    expect(deja).toBe(2);
    const suite: Array<{ trajet: string; colis: Colis }> = [
      { trajet: "gru", colis: vetements("2", "80", "Un pull et deux écharpes") },
      { trajet: "yul", colis: { famille: "Documents & papiers", taille: "S", poidsKg: "2", valeurEuros: "60", description: "Un dossier administratif" } },
      { trajet: "bzv-upcoming", colis: vetements("2", "90", "Des vêtements d'enfant") },
    ];
    for (const d of suite) {
      const r = await assistant.tenterDeReserver(jeuEssai.trajet(d.trajet), d.colis, CLARISSE);
      expect(r.refus, `la demande sur ${d.trajet} passe`).toBeNull();
      demandes.push(r.dealId!);
    }
    expect(await mesReservations(contexte), "cinq demandes dans le mois").toBe(5);

    /* Étape 2 — la sixième : refusée dès l'autorisation de paiement, même message. */
    const sixieme = await assistant.tenterDeReserver(jeuEssai.trajet("bzv-perkg"), vetements("2", "50", "Un pull"), CLARISSE);
    expect(sixieme.refus).toBe(REFUS_PLAFOND);
    expect(sixieme.intentionRefusee, "le refus intervient dès l'autorisation de paiement").toBe(true);
    expect(await mesReservations(contexte)).toBe(5);

    /* Note du cahier ([TRU7]) — le paramètre depuis le back-office : un OPS relève le plafond mensuel
       à 6 (portée exploitation, motif ≥ 20 caractères, journalisé), et l'effet doit se voir en moins
       de 30 secondes (cache mémoire du lecteur de paramètres, D62). La mesure : « Réessayer » sur la
       carte de paiement, toutes les cinq secondes, jusqu'à ce que l'intention soit acceptée. */
    const admin = await navigateurAdmin("exploitation");
    const lireParametres = async () => {
      const r = await admin.contexte.request.get(`${adresseDeLApiAdmin()}/admin/settings`);
      expect(r.ok(), "GET /admin/settings").toBe(true);
      return (await r.json()) as { values: Record<string, number>; version: number };
    };
    const ecrireParametre = async (valeur: number, motif: string) => {
      const avant = await lireParametres();
      const r = await admin.contexte.request.patch(`${adresseDeLApiAdmin()}/admin/settings`, { data: { changes: { [CLE_PLAFOND_MENSUEL]: valeur }, reason: motif, expectedVersion: avant.version } });
      expect(r.status(), `PATCH /admin/settings ${CLE_PLAFOND_MENSUEL}=${valeur} → ${await r.text()}`).toBe(200);
    };
    expect((await lireParametres()).values[CLE_PLAFOND_MENSUEL], "le plafond mensuel vaut 5 avant la manœuvre").toBe(5);
    await ecrireParametre(6, "Recette WEB-TRU-3 : plafond mensuel relevé à 6 pour prouver le levier du back-office (remis à 5 ensuite)");
    const ecriture = Date.now();
    let delaiSecondes = 0;
    try {
      const reessayer = page.getByRole("button", { name: "Réessayer" });
      await expect
        .poll(
          async () => {
            const intention = page.waitForResponse((r) => r.url().includes("/deals/payment-intents") && r.request().method() === "POST", { timeout: 15_000 });
            await reessayer.click();
            const r = await intention;
            delaiSecondes = Math.round((Date.now() - ecriture) / 1000);
            return r.ok();
          },
          { message: "le plafond relevé prend effet (cache 30 s)", timeout: 90_000, intervals: [5_000] }
        )
        .toBe(true);
      expect(delaiSecondes, "l'effet se voit en moins de 30 secondes").toBeLessThanOrEqual(30);
      await assistant.payer();
      await expect.poll(() => page.url(), { timeout: 90_000 }).toMatch(/\/bookings\/[0-9a-f]{24}$/);
      demandes.push(page.url().split("/bookings/")[1]);
      expect(await mesReservations(contexte), "la sixième passe une fois le plafond relevé").toBe(6);
      test.info().annotations.push({ type: "note", description: `levier [TRU7] : plafond mensuel 5 → 6 par l'OPS, effet observé ${delaiSecondes} s après l'écriture, puis remis à 5` });
    } finally {
      await ecrireParametre(5, "Recette WEB-TRU-3 : plafond mensuel remis à 5 après la preuve du levier du back-office");
      expect((await lireParametres()).values[CLE_PLAFOND_MENSUEL], "le plafond mensuel est remis à 5").toBe(5);
    }
  });

  test("WEB-TRU-4 · un compte ancien n'a aucun plafond : Aminata réserve 12 kg à 450 €", async ({ navigateurConnecte, jeuEssai }) => {
    test.setTimeout(4 * 60_000);
    const { page, contexte } = await navigateurConnecte("aminata");
    const assistant = new AssistantReservation(page);
    const r = await assistant.tenterDeReserver(jeuEssai.trajet("bzv-perkg"), { famille: "Vêtements & textile", taille: "M", poidsKg: "12", valeurEuros: "450", description: "Une grande valise de vêtements" }, CLARISSE);
    expect(r.refus, "aucun refus pour un compte de 90 jours").toBeNull();
    expect(r.dealId).toMatch(/^[0-9a-f]{24}$/);
    // La demande porte bien 12 kg et 450 € déclarés (le DTO de l'Expéditrice).
    const deal = await contexte.request.get(`${api()}/deals/${r.dealId}`);
    expect(deal.ok(), `GET /deals/${r.dealId}`).toBe(true);
    const brut = await deal.text();
    expect(brut).toMatch(/"weightKg":\s*12\b/);
    expect(brut).toMatch(/"declaredValueCents":\s*45000\b/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("En attente du Voyageur").first()).toBeVisible({ timeout: 30_000 });
    test.info().annotations.push({ type: "note", description: `Aminata : demande ${r.dealId} (12 kg, 450 €, bzv-perkg) sans refus` });
  });

  test("WEB-TRU-5 · le score interne n'est jamais visible : écrans, export, réponses de l'API", async ({ navigateurVisiteur, mailpit }) => {
    test.setTimeout(6 * 60_000);
    const { page, contexte } = await navigateurNeuf(navigateurVisiteur);
    expect(demandes.length, "les demandes du compte neuf sont connues").toBeGreaterThanOrEqual(6);

    /* Étape 1 — tous les écrans membre du compte neuf : tableau de bord, profil, mes envois, le suivi
       d'un envoi, la page publique. Aucun score, aucun niveau, aucun « point ». */
    const ecrans = ["/fr/dashboard/home", "/fr/dashboard/profile", "/fr/dashboard/shipments", `/fr/bookings/${demandes[0]}`, `/fr/u/${slugPublic}`];
    for (const url of ecrans) {
      await page.goto(url, { waitUntil: "domcontentloaded" });
      const texte = await texteDeLaPage(page);
      for (const mot of MOTS_INTERDITS_ECRAN) expect(texte, `« ${mot} » sur ${url}`).not.toContain(mot);
      expect(texte, `des points sur ${url}`).not.toMatch(/\b\d+\s*points?\b/);
      expect(texte, `un score chiffré sur ${url}`).not.toMatch(/\bscore\b/);
    }
    // Le seul signal visible d'un compte neuf est le message de plafond — et il n'est pas là sans tentative.
    expect(await texteDeLaPage(page)).not.toContain("ton compte est récent");

    /* Ce que l'API répond au membre : le score est calculé à la lecture et jamais servi (D71). */
    for (const chemin of ["/auth/me", "/me/bookings", `/deals/${demandes[0]}`]) {
      const r = await contexte.request.get(`${api()}${chemin}`);
      expect(r.ok(), `GET ${chemin}`).toBe(true);
      const brut = (await r.text()).toLowerCase();
      for (const mot of MOTS_INTERDITS_API) expect(brut, `« ${mot} » dans GET ${chemin}`).not.toContain(mot);
    }

    /* Étape 2 — l'export de mes données (chapitre 5.25), par la porte sudo : sans trace du score. */
    const securite = new Securite(page);
    await securite.ouvrir();
    const chemin = await securite.telechargerMesDonnees(neuf.email, mailpit);
    const brut = readFileSync(chemin, "utf-8");
    const json = JSON.parse(brut) as { format: string; profile: { email: string }; bookings: unknown[] };
    expect(json.format).toBe("yamba-data-export/1");
    expect(json.profile.email).toBe(neuf.email);
    expect(json.bookings).toHaveLength(demandes.length);
    for (const mot of MOTS_INTERDITS_API) expect(brut.toLowerCase(), `« ${mot} » dans l'export`).not.toContain(mot);
  });
});
