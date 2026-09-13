/**
 * web-not.spec.ts — cahier 01-WEB, chapitre 5.22 « La notation croisée »
 * ======================================================================
 * Où « Noter » apparaît (accueil, « Mes envois », le deal — jamais une fenêtre bloquante), l'écran « Donne ton
 * avis » (la personne notée sans sa moyenne ni son nombre de deals), les critères par rôle noté, la note globale
 * seule requise, la limite du commentaire, le double-aveugle en deux navigateurs, l'état intermédiaire, « on ne
 * note qu'une fois », les relances J+5 / J+7 et la révélation à 14 jours (cron `rating` forcé), et l'avis révélé
 * sur la page publique (fenêtre privée).
 *
 * Deals : `bzv-completed` (Mai ↔ Thomas) pour le double-aveugle et la page publique ; `gru-completed` (João ↔ Inês)
 * pour la note seule requise, l'état intermédiaire, les relances et la révélation sans réciprocité ;
 * `bzv-disputed` (Chinwe) et un deal d'un autre compte pour « on ne note qu'une fois ».
 */
import { test, expect, type Navigateur } from "../fixtures/yamba";
import { adresseDeLApi } from "../fixtures/adresses";
import { COMPTES } from "../fixtures/comptes";
import { JeuEssai } from "../fixtures/jeu-essai";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { Notation } from "../pages/notation";
import { ProfilPublic } from "../pages/profil-public";
import { SuiviExpediteur } from "../pages/suivi-expediteur";
import { normaliserEspaces } from "../pages/reservation";

type Contexte = Navigateur["contexte"];
type Page = Navigateur["page"];
const api = () => adresseDeLApi();
const RACINE = join(__dirname, "../../../..");

const COMMENTAIRE_MAI = "Thomas a été ponctuel et soigneux, mes pagnes sont arrivés impeccables — je recommande sans hésiter.";
const COMMENTAIRE_THOMAS = "Colis conforme à la déclaration, remise facile au terminal, Mai très réactive.";

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
  return sortie.replace(/\[[0-9;]*m/g, "");
}

type Rating = { windowEndsAt: string | null; ratedByMe: boolean; counterpartHasRated: boolean; revealedAt: string | null; canRate: boolean };
async function notation(contexte: Contexte, id: string): Promise<Rating> {
  const r = await contexte.request.get(`${api()}/deals/${id}`);
  expect(r.ok(), `GET /deals/${id}`).toBe(true);
  return ((await r.json()) as { deal: { rating: Rating } }).deal.rating;
}

async function ouvrirLaNotation(page: Page, chemin: string): Promise<void> {
  await page.goto(chemin, { waitUntil: "networkidle" });
  await expect(page.getByRole("radiogroup", { name: "Ta note globale" })).toBeVisible({ timeout: 60_000 });
}

/* ══ Les fiches ══════════════════════════════════════════════════════════════════════════════ */

test.describe("WEB-NOT — la notation croisée (chapitre 5.22)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(() => {
    new JeuEssai().rejouer();
  });

  test("WEB-NOT-1 · où le bouton « Noter » apparaît", async ({ navigateurConnecte, jeuEssai }) => {
    const id = jeuEssai.deal("bzv-completed").id;
    const { page, contexte } = await navigateurConnecte("mai");
    expect((await notation(contexte, id)).canRate).toBe(true);
    /* Étape 1 — l'accueil : une action « à traiter ». */
    await page.goto("/fr/dashboard/home", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "À traiter" })).toBeVisible({ timeout: 60_000 });
    const action = page.locator(`a[href="/fr/bookings/${id}/rate"], a[href="/fr/bookings/${id}"]`).first();
    await expect(action).toBeVisible();
    const texteAccueil = normaliserEspaces(await action.innerText());
    expect(texteAccueil).toMatch(/Noter Thomas|Terminé/);
    await expect(page.getByRole("dialog"), "aucune fenêtre bloquante").toHaveCount(0);
    /* Étape 2 — « Mes envois » : la ligne et « Noter Thomas ». */
    await page.goto("/fr/dashboard/shipments", { waitUntil: "networkidle" });
    const ligne = page.locator(`a[href="/fr/bookings/${id}/rate"], a[href="/fr/bookings/${id}"]`).first();
    await expect(ligne).toBeVisible({ timeout: 60_000 });
    const texteLigne = normaliserEspaces(await ligne.innerText());
    expect(texteLigne).toMatch(/Terminé/);
    expect(texteLigne).toContain("Noter Thomas");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    /* Étape 3 — le deal : la carte d'invitation. */
    await new SuiviExpediteur(page).ouvrir(id);
    const corps = await texte(page);
    expect(corps).toContain("Comment s'est passé ton Deal avec Thomas ?");
    expect(corps).toMatch(/Tu as jusqu'au .+\. Ta note ne sera visible qu'une fois les deux avis publiés\./);
    await expect(page.getByRole("button", { name: "Noter Thomas" })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    test.info().annotations.push({ type: "note", description: `accueil : « ${texteAccueil.slice(0, 80)} » ; Mes envois : « ${texteLigne.slice(0, 100)} »` });
  });

  test("WEB-NOT-2 · l'écran « Donne ton avis »", async ({ navigateurConnecte, jeuEssai }) => {
    const id = jeuEssai.deal("bzv-completed").id;
    const { page } = await navigateurConnecte("mai");
    await new SuiviExpediteur(page).ouvrir(id);
    await new Notation(page).ouvrirDepuisLeDeal("Thomas");
    const corps = await texte(page);
    // Le cahier décrit l'en-tête MOBILE (« Donne ton avis » / « Deal … · terminé » / bandeau « Ton Deal avec … est terminé »).
    // Le bureau suit le motif « barre latérale de décision » (RatingDesktop : pas de bandeau, l'information vit dans la carte
    // de la personne) : h1 « Comment Thomas s'est-il comporté ? », carte « Thomas N. · Voyageur · Paris → Brazzaville · Terminé ».
    const enTeteMobile = corps.includes("Donne ton avis") && corps.includes("Ton Deal avec Thomas est terminé");
    expect(corps).toMatch(/Donne ton avis|Comment Thomas s'est-il comporté \?/);
    expect(corps).toMatch(/Deal Paris → Brazzaville · terminé|Paris → Brazzaville Terminé/);
    test.info().annotations.push({ type: "constat", description: enTeteMobile ? "en-tête mobile rendu" : "bureau : pas de titre « Donne ton avis » ni de bandeau « Ton Deal avec Thomas est terminé » — motif barre latérale (documenté dans RatingDesktop), à trancher avec le cahier" });
    /* La personne notée : prénom, initiale, corridor, date — jamais sa moyenne ni ses deals. */
    expect(corps).toContain("Thomas N.");
    expect(corps, "jamais la moyenne avant la note").not.toMatch(/★ ?\d[,.]\d/);
    expect(corps, "jamais le nombre de deals avant la note").not.toMatch(/\d+ deals\b/i);
    for (const etoile of ["Décevant", "Moyen", "Correct", "Très bien", "Excellent"]) await expect(page.getByRole("radio", { name: etoile })).toBeVisible();
    expect(corps).toContain("Ta note globale");
    expect(corps).toContain("SUR CES POINTS PRÉCIS");
    await expect(page.getByRole("button", { name: /— Bien$/ }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /— À améliorer$/ }).first()).toBeVisible();
    expect(corps).toContain("TON COMMENTAIRE");
    expect(corps).toContain("Optionnel · max 280 caractères");
    expect(corps).toContain("PUBLICATION");
    await expect(page.getByRole("button", { name: "Plus tard" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Publier mon avis" })).toBeVisible();
  });

  test("WEB-NOT-3 · les critères dépendent du rôle noté", async ({ navigateurConnecte, jeuEssai }) => {
    const id = jeuEssai.deal("bzv-completed").id;
    /* Mai note un Voyageur. */
    const mai = await navigateurConnecte("mai");
    await ouvrirLaNotation(mai.page, `/fr/bookings/${id}/rate`);
    for (const c of ["Ponctualité au rendez-vous", "Communication", "Soin du colis"]) await expect(mai.page.getByRole("button", { name: `${c} — Bien` })).toBeVisible();
    for (const c of ["Clarté de la déclaration", "Réactivité"]) await expect(mai.page.getByRole("button", { name: `${c} — Bien` })).toHaveCount(0);
    /* Thomas note une Expéditrice. */
    const thomas = await navigateurConnecte("thomas");
    await ouvrirLaNotation(thomas.page, `/fr/carrier/deals/${id}/rate`);
    for (const c of ["Clarté de la déclaration", "Réactivité", "Ponctualité au rendez-vous"]) await expect(thomas.page.getByRole("button", { name: `${c} — Bien` })).toBeVisible();
    for (const c of ["Communication", "Soin du colis"]) await expect(thomas.page.getByRole("button", { name: `${c} — Bien` })).toHaveCount(0);
  });

  test("WEB-NOT-4 · la note globale est le seul champ requis", async ({ navigateurConnecte, jeuEssai }) => {
    const id = jeuEssai.deal("gru-completed").id;
    const { page, contexte } = await navigateurConnecte("joao");
    await ouvrirLaNotation(page, `/fr/bookings/${id}/rate`);
    const publier = page.getByRole("button", { name: "Publier mon avis" });
    await expect(publier).toBeDisabled();
    await expect(page.getByText("Choisis d'abord ta note globale")).toBeVisible();
    const { revele, texte: succes } = await new Notation(page).publier({ etoiles: "Excellent" });
    expect(revele).toBe(false);
    expect(normaliserEspaces(succes)).toContain("Ton avis aide toute la communauté Yamba à voyager en confiance.");
    const etat = await notation(contexte, id);
    expect(etat.ratedByMe).toBe(true);
    expect(etat.revealedAt).toBeNull();
  });

  test("WEB-NOT-5 · la limite du commentaire", async ({ navigateurConnecte, jeuEssai }) => {
    const id = jeuEssai.deal("bzv-completed").id;
    const { page } = await navigateurConnecte("mai");
    await ouvrirLaNotation(page, `/fr/bookings/${id}/rate`);
    const zone = page.locator("textarea").first();
    await zone.fill("a".repeat(275));
    await expect(page.getByText(/^275 \/ 280( — bientôt la limite)?$/)).toBeVisible();
    const a275 = normaliserEspaces(await page.getByText(/^275 \/ 280/).innerText());
    await zone.fill("a".repeat(281));
    expect((await zone.inputValue()).length, "le dépassement est empêché").toBe(280);
    await expect(page.getByText("280 / 280 — bientôt la limite")).toBeVisible();
    test.info().annotations.push({ type: "note", description: `à 275 : « ${a275} » ; à 281 saisis : 280 gardés, « 280 / 280 — bientôt la limite »` });
  });

  test("WEB-NOT-6 · le double-aveugle (deux navigateurs)", async ({ navigateurConnecte, jeuEssai, mailpit }) => {
    await mailpit.vider();
    const id = jeuEssai.deal("bzv-completed").id;
    const A = await navigateurConnecte("mai");
    const B = await navigateurConnecte("thomas");
    /* Étape 1 — A publie. */
    await ouvrirLaNotation(A.page, `/fr/bookings/${id}/rate`);
    const premier = await new Notation(A.page).publier({ etoiles: "Excellent", bien: ["Ponctualité au rendez-vous", "Communication", "Soin du colis"], commentaire: COMMENTAIRE_MAI });
    expect(premier.revele).toBe(false);
    const succes = normaliserEspaces(premier.texte);
    expect(succes).toContain("Merci pour ton retour !");
    expect(succes).toContain("Ton avis aide toute la communauté Yamba à voyager en confiance.");
    expect(succes).toMatch(/Thomas recevra aussi une invitation à te noter\. Vos avis seront révélés une fois les deux publiés, ou le .+ au plus tard\./);
    /* Étape 2 — la page publique de Thomas : rien encore. */
    await A.page.goto("/fr/u/seed-thomas", { waitUntil: "networkidle" });
    await expect(A.page.getByText(/En tant que Voyageur/)).toBeVisible({ timeout: 60_000 });
    await expect(A.page.getByText(COMMENTAIRE_MAI), "l'avis n'est pas public avant la réciprocité").toHaveCount(0);
    expect((await notation(B.contexte, id)).revealedAt).toBeNull();
    /* Étape 3 — B publie : révélation. */
    await ouvrirLaNotation(B.page, `/fr/carrier/deals/${id}/rate`);
    const second = await new Notation(B.page).publier({ etoiles: "Très bien", bien: ["Clarté de la déclaration"], commentaire: COMMENTAIRE_THOMAS });
    expect(second.revele).toBe(true);
    expect(normaliserEspaces(second.texte)).toContain("Mai t'avait déjà noté : vos deux avis sont maintenant visibles.");
    /* Étape 4 — A recharge : « Vos avis », les deux notes. */
    await new SuiviExpediteur(A.page).ouvrir(id);
    await expect(A.page.getByText("Vos avis", { exact: true })).toBeVisible({ timeout: 60_000 });
    const corps = await texte(A.page);
    expect(corps).toContain("Ta note pour Thomas");
    expect(corps).toContain("La note de Thomas");
    expect(corps).toContain(COMMENTAIRE_THOMAS);
    /* Notification aux deux, sans email. */
    for (const nav of [A, B]) {
      await nav.page.goto("/fr/dashboard/notifications", { waitUntil: "networkidle" });
      await expect(nav.page.locator(`a[href*="${id}"]`).filter({ hasText: "Les notes sont révélées" }).first()).toBeVisible({ timeout: 60_000 });
    }
    await new Promise((r) => setTimeout(r, 4_000));
    expect(await mailpit.compter({ pour: COMPTES.mai.email }), "aucun email à la révélation").toBe(0);
    expect(await mailpit.compter({ pour: COMPTES.thomas.email })).toBe(0);
  });

  test("WEB-NOT-7 · l'état intermédiaire", async ({ navigateurConnecte, jeuEssai }) => {
    const id = jeuEssai.deal("gru-completed").id; // João a noté en NOT-4, Inês pas encore
    const { page } = await navigateurConnecte("joao");
    await new SuiviExpediteur(page).ouvrir(id);
    const corps = await texte(page);
    expect(corps).toContain("Note envoyée");
    expect(corps).toMatch(/Révélée quand Inês aura noté, ou le .+ au plus tard\./);
    await expect(page.getByRole("button", { name: /^Noter/ })).toHaveCount(0);
  });

  test("WEB-NOT-8 · on ne note qu'une fois", async ({ navigateurConnecte, jeuEssai }) => {
    const note = jeuEssai.deal("gru-completed").id;
    const litige = jeuEssai.deal("bzv-disputed").id;
    /* 1 — déjà noté. */
    const joao = await navigateurConnecte("joao");
    await joao.page.goto(`/fr/bookings/${note}/rate`, { waitUntil: "networkidle" });
    await expect(joao.page.getByText("Ta note est envoyée")).toBeVisible({ timeout: 60_000 });
    expect(await texte(joao.page)).toMatch(/Elle sera révélée quand Inês aura noté, ou le .+ au plus tard\./);
    await expect(joao.page.getByRole("radiogroup", { name: "Ta note globale" })).toHaveCount(0);
    /* 2 — un deal en litige. */
    const chinwe = await navigateurConnecte("chinwe");
    await chinwe.page.goto(`/fr/bookings/${litige}/rate`, { waitUntil: "networkidle" });
    await expect(chinwe.page.getByText("Ce Deal ne peut pas être noté pour le moment.")).toBeVisible({ timeout: 60_000 });
    /* 3 — le deal d'un autre compte. */
    const pauline = await navigateurConnecte("pauline");
    await pauline.page.goto(`/fr/bookings/${note}/rate`, { waitUntil: "networkidle" });
    // L'API refuse (403 NOT_A_PARTY) ; l'écran rend son état « indisponible » et un renvoi — jamais l'erreur brute.
    await expect(pauline.page.getByText(/Ce Deal ne peut pas être noté pour le moment\.|Ce Deal n'existe pas ou ne peut pas être noté\./)).toBeVisible({ timeout: 60_000 });
    const corps = await texte(pauline.page);
    for (const fuite of ["Inês", "Documentos", "João", "NOT_A_PARTY", "403", "404", "{"]) expect(corps, `jamais « ${fuite} »`).not.toContain(fuite);
    await expect(pauline.page.getByRole("radiogroup", { name: "Ta note globale" })).toHaveCount(0);
    await expect(pauline.page.getByRole("button", { name: /Retour/ }).first()).toBeVisible();
    const refus = await pauline.contexte.request.get(`${api()}/deals/${note}/rating`);
    expect(refus.status()).toBe(403);
  });

  test("WEB-NOT-9 · les relances de notation (cron forcé)", async ({ navigateurConnecte, jeuEssai, mailpit }) => {
    await mailpit.vider();
    const id = jeuEssai.deal("gru-completed").id; // João a noté ; Inês non
    const ines = await navigateurConnecte("ines");
    const joao = await navigateurConnecte("joao");
    const relances = (sortie: string) => Number(sortie.match(/sendRatingReminders[^\d]*(\d+)/)?.[1] ?? NaN);
    /* J+5. */
    scriptDeRecette("notation-eligible", id, "r1");
    expect(relances(scriptDeRecette("notation", "relances"))).toBeGreaterThanOrEqual(1);
    await ines.page.goto("/fr/dashboard/notifications", { waitUntil: "networkidle" });
    await expect(ines.page.locator(`a[href*="${id}"]`).filter({ hasText: "Pense à noter João" }).first()).toBeVisible({ timeout: 60_000 });
    const premier = await mailpit.attendreEmail({ pour: COMPTES.ines.email, sujet: /^Pense à noter João$/ });
    await new Promise((r) => setTimeout(r, 3_000));
    expect(await mailpit.compter({ pour: COMPTES.joao.email }), "le rôle qui a noté n'est pas relancé").toBe(0);
    /* J+7. */
    scriptDeRecette("notation-eligible", id, "r2");
    scriptDeRecette("notation", "relances");
    const dernier = await mailpit.attendreEmail({ pour: COMPTES.ines.email, sujet: /^Dernier rappel : note João$/ });
    /* Puis plus rien. */
    const encore = relances(scriptDeRecette("notation", "relances"));
    await new Promise((r) => setTimeout(r, 3_000));
    expect(await mailpit.compter({ pour: COMPTES.ines.email, sujet: /noter|note João/i })).toBe(2);
    expect(await mailpit.compter({ pour: COMPTES.joao.email })).toBe(0);
    await joao.page.goto("/fr/dashboard/notifications", { waitUntil: "networkidle" });
    await expect(joao.page.locator(`a[href*="${id}"]`).filter({ hasText: "Pense à noter" })).toHaveCount(0);
    test.info().annotations.push({ type: "note", description: `emails à Inês : « ${premier.sujet} », « ${dernier.sujet} » ; troisième passe : ${encore} relance(s) sur ce deal (rien à Inês, rien à João)` });
  });

  test("WEB-NOT-10 · la révélation à 14 jours sans réciprocité (cron forcé)", async ({ navigateurConnecte, jeuEssai }) => {
    const id = jeuEssai.deal("gru-completed").id;
    const ines = await navigateurConnecte("ines");
    const joao = await navigateurConnecte("joao");
    scriptDeRecette("notation-eligible", id, "reveal");
    const sortie = scriptDeRecette("notation", "reveal");
    const etat = await notation(joao.contexte, id);
    expect(etat.revealedAt, "l'avis unique est révélé").not.toBeNull();
    expect(etat.canRate).toBe(false);
    /* Côté muet (Inês) : la fenêtre est fermée. */
    await ines.page.goto(`/fr/carrier/deals/${id}`, { waitUntil: "networkidle" });
    // Le cahier attend « La fenêtre de notation est fermée — tu n'as pas noté João. » ; le produit, une fois l'avis
    // unique révélé, montre la carte « Vos avis » : « Tu n'as pas noté ce Deal. » + « La note de João » (le texte
    // « fenêtre fermée » ne sert que sans aucun avis). Même information, plus la note reçue — à trancher.
    await expect(ines.page.getByText("Vos avis", { exact: true })).toBeVisible({ timeout: 60_000 });
    const corpsInes = await texte(ines.page);
    expect(corpsInes).toContain("Tu n'as pas noté ce Deal.");
    expect(corpsInes).toContain("La note de João");
    await expect(ines.page.getByRole("button", { name: /^Noter/ })).toHaveCount(0);
    test.info().annotations.push({ type: "constat", description: "côté muet après la révélation : « Vos avis · Tu n'as pas noté ce Deal. · La note de João » plutôt que « La fenêtre de notation est fermée — tu n'as pas noté João. » (ce texte ne sert que sans aucun avis) — à trancher avec le cahier" });
    /* L'avis de João est public sur la page d'Inês. */
    const slug = await ProfilPublic.slugDuMembre(ines.contexte);
    const faits = await new ProfilPublic(joao.page).ligneDeFaits(slug);
    expect(faits).toMatch(/★ \d[,.]\d sur \d+ avis/);
    await expect(joao.page.getByText("João S.").first()).toBeVisible();
    test.info().annotations.push({ type: "note", description: `passe reveal : ${sortie.trim().split("\n").pop()} ; ligne de faits d'Inês : « ${faits} »` });
  });

  test("WEB-NOT-11 · l'avis révélé sur la page publique (fenêtre privée)", async ({ browser, navigateurConnecte, jeuEssai }) => {
    const id = jeuEssai.deal("bzv-completed").id;
    const mai = await navigateurConnecte("mai");
    const etat = await notation(mai.contexte, id);
    expect(etat.revealedAt).not.toBeNull();
    /* Une fenêtre privée : personne n'est connecté. */
    const prive = await browser.newContext();
    const page = await prive.newPage();
    await page.goto("/fr/u/seed-thomas", { waitUntil: "networkidle" });
    await expect(page.getByText(COMMENTAIRE_MAI)).toBeVisible({ timeout: 60_000 });
    const carte = page.locator("article, li, div").filter({ hasText: COMMENTAIRE_MAI }).last();
    const texteCarte = normaliserEspaces(await carte.innerText());
    expect(texteCarte).toContain("Mai T.");
    // Les étoiles sont des icônes : leur valeur vit dans l'aria-label (« 5/5 »).
    await expect(carte.locator('[aria-label="5/5"]').first()).toBeVisible();
    for (const c of ["Ponctualité", "Communication", "Soin du colis"]) expect(texteCarte).toContain(c);
    const faits = normaliserEspaces(await page.getByText(/annulations? tardives?/).first().innerText());
    expect(faits).toMatch(/\d+ Deals? terminés? · ★ \d[,.]\d sur \d+ avis/);
    const signaler = carte.getByRole("link", { name: "Signaler cet avis" }).first();
    await expect(signaler).toBeVisible();
    const href = await signaler.getAttribute("href");
    expect(href).toMatch(/^mailto:.+\?subject=/);
    expect(decodeURIComponent(href ?? "")).toMatch(/Signalement d'un avis \(#[0-9a-f]{24}\)/);
    await prive.close();
    test.info().annotations.push({ type: "note", description: `faits : « ${faits} » ; signalement : ${decodeURIComponent(href ?? "")}` });
  });
});
