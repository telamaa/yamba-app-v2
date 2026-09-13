/**
 * web-fav.spec.ts — cahier 01-WEB, chapitre 5.11 « Favoris et Voyageurs suivis »
 * ================================================================================
 * Le cœur (porte d'identité pour un visiteur, geste repris après connexion, ajout / retrait
 * immédiats, jamais son propre trajet, jamais un trajet indisponible, un favori survit à la fin du
 * trajet), la liste « Mes favoris » et son état vide ; le suivi d'un Voyageur (bouton, compteur
 * d'abonnés, bascule de notification), l'email d'abonné à la publication (et son silence quand la
 * notification est coupée), le désabonnement, l'état vide de « Voyageurs suivis ».
 */
import { test, expect, type Navigateur } from "../fixtures/yamba";
import { adresseDeLApi, adresseDeLApiAdmin } from "../fixtures/adresses";
import { COMPTES, MOT_DE_PASSE_SEED } from "../fixtures/comptes";
import { carteDuTrajet, ouvrirLaRecherche } from "../pages/recherche";

type Contexte = Navigateur["contexte"];
type Page = Navigateur["page"];
const api = () => adresseDeLApi();

/* ══ Aides API ═══════════════════════════════════════════════════════════════════════════════ */

async function mesFavoris(contexte: Contexte): Promise<string[]> {
  const r = await contexte.request.get(`${api()}/trips/favorites`);
  expect(r.ok(), "GET /trips/favorites").toBe(true);
  return ((await r.json()) as { trips: Array<{ id: string }> }).trips.map((t) => t.id);
}
async function retirerTousLesFavoris(contexte: Contexte): Promise<void> {
  for (const id of await mesFavoris(contexte)) await contexte.request.delete(`${api()}/trips/${id}/favorite`);
}
async function slugDuVoyageur(contexte: Contexte, tripId: string): Promise<string> {
  const r = await contexte.request.get(`${api()}/trips/${tripId}/public`);
  expect(r.ok()).toBe(true);
  const m = /"publicSlug":"([^"]+)"/.exec(await r.text());
  expect(m, "publicSlug du Voyageur dans le DTO public").toBeTruthy();
  return m![1];
}
async function abonnes(contexte: Contexte, slug: string): Promise<number> {
  const r = await contexte.request.get(`${api()}/users/${slug}/public`);
  expect(r.ok(), `GET /users/${slug}`).toBe(true);
  return ((await r.json()) as { user: { follow: { followersCount: number } } }).user.follow.followersCount;
}
async function mesSuivis(contexte: Contexte): Promise<Array<{ publicSlug: string; notifyNextTrip: boolean }>> {
  const r = await contexte.request.get(`${api()}/me/following`);
  expect(r.ok(), "GET /me/following").toBe(true);
  const body = (await r.json()) as { following: Array<{ notifyNextTrip: boolean; user: { publicSlug: string } }> };
  return body.following.map((f) => ({ publicSlug: f.user.publicSlug, notifyNextTrip: f.notifyNextTrip }));
}
async function publierTrajet(contexte: Contexte, de: string, vers: string, codes: [string, string]): Promise<string> {
  const r = await contexte.request.post(`${api()}/trips`, {
    data: {
      transportMode: "PLANE", flightType: "DIRECT", tripType: "ONE_WAY",
      originCity: de, originCountryCode: codes[0], destinationCity: vers, destinationCountryCode: codes[1],
      departureAt: new Date(Date.now() + 22 * 86_400_000).toISOString(), arrivalAt: new Date(Date.now() + 23 * 86_400_000).toISOString(),
      pricePerKgCents: 1150, capacityKg: 23,
      pickupLocations: [{ kind: "AIRPORT", flexibility: "EXACT", details: `${de}, aéroport` }],
      deliveryLocations: [{ kind: "AIRPORT", flexibility: "EXACT", details: `${vers}, aéroport` }],
      publish: true,
    },
  });
  expect(r.status(), `POST /trips → ${await r.text()}`).toBe(201);
  return ((await r.json()) as { trip: { id: string } }).trip.id;
}

/** Le cœur (bouton) de la carte d'un trajet dans une liste — il est DANS le lien de la carte. */
const coeur = (page: Page, tripId: string) => carteDuTrajet(page, tripId).getByRole("button", { name: /Ajouter aux favoris|Retirer des favoris/ }).filter({ visible: true }).first();

const ouvrirMesFavoris = async (page: Page) => {
  await page.goto("/fr/dashboard/favorites", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1, name: "Mes favoris" })).toBeVisible({ timeout: 60_000 });
  await page.waitForLoadState("networkidle").catch(() => undefined);
};
const ouvrirVoyageursSuivis = async (page: Page) => {
  await page.goto("/fr/dashboard/following", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1, name: "Voyageurs suivis" })).toBeVisible({ timeout: 60_000 });
  await page.waitForLoadState("networkidle").catch(() => undefined);
};

/* ══ Les fiches ══════════════════════════════════════════════════════════════════════════════ */

test.describe("WEB-FAV — favoris et Voyageurs suivis (chapitre 5.11)", () => {
  test.describe.configure({ mode: "serial" });

  test("WEB-FAV-1 · le cœur ouvre la porte d'identité, et le geste est repris après connexion", async ({ navigateurVisiteur, navigateurConnecte, jeuEssai }) => {
    test.setTimeout(3 * 60_000);
    const id = jeuEssai.trajet("bzv-perkg");
    const aminata = await navigateurConnecte("aminata", { parEcran: true });
    await retirerTousLesFavoris(aminata.contexte);

    const { page } = await navigateurVisiteur();
    await ouvrirLaRecherche(page, { from: "Paris", to: "Brazzaville" });
    await expect(carteDuTrajet(page, id)).toBeVisible({ timeout: 30_000 });
    await coeur(page, id).click();
    await expect(page.getByText("Connecte-toi pour enregistrer un favori")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Tes favoris sont liés à ton compte : ils te suivent sur tous tes appareils. Ce trajet t'attend après connexion.")).toBeVisible();

    // Connexion DANS la fenêtre : on reste sur la recherche et le favori est enregistré.
    const formulaire = page.locator("form").filter({ has: page.locator("#email") }).filter({ visible: true }).last();
    await formulaire.locator("#email").fill(COMPTES.aminata.email);
    await formulaire.locator("#password").fill(MOT_DE_PASSE_SEED);
    const favori = page.waitForResponse((r) => /\/trips\/[^/]+\/favorite$/.test(r.url()) && r.request().method() === "POST", { timeout: 30_000 });
    await formulaire.locator("button[type=submit]").click();
    expect((await favori).status(), "POST /trips/:id/favorite après connexion").toBe(200);
    await expect(page).toHaveURL(/\/fr\/search/);
    await expect(coeur(page, id)).toHaveAttribute("aria-pressed", "true", { timeout: 15_000 });
    expect(await mesFavoris(aminata.contexte), "le geste n'est pas perdu").toContain(id);
    await retirerTousLesFavoris(aminata.contexte);
  });

  test("WEB-FAV-2 · ajouter et retirer un favori", async ({ navigateurConnecte, jeuEssai }) => {
    test.setTimeout(3 * 60_000);
    const id = jeuEssai.trajet("bzv-perkg");
    const { page, contexte } = await navigateurConnecte("aminata", { parEcran: true });
    await retirerTousLesFavoris(contexte);
    await ouvrirLaRecherche(page, { from: "Paris", to: "Brazzaville" });
    await expect(coeur(page, id)).toHaveAttribute("aria-label", "Ajouter aux favoris");
    await coeur(page, id).click();
    // Immédiat : le cœur se remplit sans attendre la réponse.
    await expect(coeur(page, id)).toHaveAttribute("aria-pressed", "true", { timeout: 1_500 });
    await expect.poll(() => mesFavoris(contexte), { timeout: 15_000 }).toContain(id);

    await ouvrirMesFavoris(page);
    await expect(page.getByText("Les trajets que tu as mis de côté. Un favori est privé : le Voyageur n'en est pas informé.")).toBeVisible();
    await expect(carteDuTrajet(page, id), "la même carte que la recherche").toBeVisible({ timeout: 30_000 });
    await expect(carteDuTrajet(page, id)).toContainText("11,50");
    await expect(page.getByText("1 trajet", { exact: true })).toBeVisible();

    await ouvrirLaRecherche(page, { from: "Paris", to: "Brazzaville" });
    await expect(coeur(page, id)).toHaveAttribute("aria-label", "Retirer des favoris", { timeout: 30_000 });
    await coeur(page, id).click();
    await expect(coeur(page, id)).toHaveAttribute("aria-pressed", "false", { timeout: 1_500 });
    await expect(coeur(page, id)).toHaveAttribute("aria-label", "Ajouter aux favoris");
    await expect.poll(() => mesFavoris(contexte), { timeout: 15_000 }).not.toContain(id);
  });

  test("WEB-FAV-3 · on ne met pas son propre trajet en favori", async ({ navigateurConnecte, jeuEssai }) => {
    const id = jeuEssai.trajet("bzv-perkg");
    const { page, contexte } = await navigateurConnecte("thomas", { parEcran: true });
    await ouvrirLaRecherche(page, { from: "Paris", to: "Brazzaville" });
    await expect(carteDuTrajet(page, id)).toBeVisible({ timeout: 30_000 });
    // Le cœur est présent ; le clic est refusé avec le message du cahier (variante « info-bulle » : toast).
    await coeur(page, id).click();
    await expect(page.getByText("Tu ne peux pas mettre ton propre trajet en favori")).toBeVisible({ timeout: 15_000 });
    await expect(coeur(page, id)).toHaveAttribute("aria-pressed", "false");
    const r = await contexte.request.post(`${api()}/trips/${id}/favorite`);
    expect(r.status()).toBe(403);
    expect(((await r.json()) as { details?: { code?: string } }).details?.code).toBe("OWN_TRIP");
    expect(await mesFavoris(contexte)).not.toContain(id);
  });

  test("WEB-FAV-4 · un trajet indisponible ne s'ajoute pas ; le retrait reste possible", async ({ navigateurConnecte, navigateurAdmin, jeuEssai }) => {
    test.setTimeout(4 * 60_000);
    const aminata = await navigateurConnecte("aminata", { parEcran: true });
    const josephine = await navigateurConnecte("josephine", { parEcran: true });
    await retirerTousLesFavoris(aminata.contexte);

    // Un favori dont le trajet est annulé depuis : la fiche répond « plus disponible », le retrait passe.
    const id = await publierTrajet(josephine.contexte, "Bruxelles", "Kinshasa", ["BE", "CD"]);
    expect((await aminata.contexte.request.post(`${api()}/trips/${id}/favorite`)).status()).toBe(200);
    expect((await josephine.contexte.request.post(`${api()}/trips/${id}/cancel`)).ok()).toBe(true);
    expect(await mesFavoris(aminata.contexte), "le favori survit à l'annulation").toContain(id);
    await ouvrirMesFavoris(aminata.page);
    await expect(carteDuTrajet(aminata.page, id)).toBeVisible({ timeout: 30_000 });
    await carteDuTrajet(aminata.page, id).click();
    await expect(aminata.page.getByText("Trajet introuvable")).toBeVisible({ timeout: 60_000 });
    await expect(aminata.page.getByText("Ce trajet n'existe pas ou n'est plus disponible.")).toBeVisible();
    // Ré-ajouter un trajet annulé : refusé avec son code ; le retirer : toujours possible.
    await aminata.contexte.request.delete(`${api()}/trips/${id}/favorite`);
    const ajout = await aminata.contexte.request.post(`${api()}/trips/${id}/favorite`);
    expect(ajout.status(), "un trajet annulé ne se met pas en favori").toBe(409);
    expect(((await ajout.json()) as { details?: { code?: string } }).details?.code).toBe("TRIP_NOT_FAVORITABLE");
    expect((await aminata.contexte.request.delete(`${api()}/trips/${id}/favorite`)).status(), "le retrait passe toujours").toBe(200);

    // Un trajet MASQUÉ par Yamba (statut inchangé) : le cahier attend le même refus.
    const idYul = jeuEssai.trajet("yul");
    const admin = await navigateurAdmin("mediateur");
    const motif = "Recette WEB-FAV-4 : masquage de contrôle, levé par la même fiche.";
    expect((await admin.contexte.request.post(`${adresseDeLApiAdmin()}/admin/trips/${idYul}/hide`, { data: { reason: motif } })).status()).toBe(200);
    try {
      // ANO-WEB-32 : avant correction, l'ajout répondait 200 (le statut reste PUBLISHED sous le masquage).
      const masque = await aminata.contexte.request.post(`${api()}/trips/${idYul}/favorite`);
      expect(masque.status(), "un trajet masqué par Yamba ne se met pas en favori").toBe(409);
      expect(((await masque.json()) as { details?: { code?: string } }).details?.code).toBe("TRIP_NOT_FAVORITABLE");
      expect((await aminata.contexte.request.delete(`${api()}/trips/${idYul}/favorite`)).status(), "le retrait reste possible").toBe(200);
    } finally {
      const levee = await admin.contexte.request.delete(`${adresseDeLApiAdmin()}/admin/trips/${idYul}/hide`, { data: { reason: motif } });
      if (levee.status() !== 200) throw new Error(`Masquage de yul NON levé (${levee.status()}) : le lever à la main.`);
    }
  });

  test("WEB-FAV-5 · un favori survit à la fin du trajet, avec le badge « Trajet passé »", async ({ navigateurConnecte, jeuEssai }) => {
    const idLos = jeuEssai.trajet("los"); // Londres → Lagos, parti depuis 2 jours, toujours PUBLISHED
    const { page, contexte } = await navigateurConnecte("aminata", { parEcran: true });
    await retirerTousLesFavoris(contexte);
    expect((await contexte.request.post(`${api()}/trips/${idLos}/favorite`)).status(), "un trajet parti mais publié se met en favori").toBe(200);
    await ouvrirMesFavoris(page);
    await expect(carteDuTrajet(page, idLos)).toBeVisible({ timeout: 30_000 });
    // ANO-WEB-30 : le badge existait dans les textes, jamais à l'écran (la carte n'exposait pas de date exploitable).
    await expect(page.getByText("Trajet passé", { exact: true }).filter({ visible: true }).first()).toBeVisible();
  });

  test("WEB-FAV-6 · l'état vide des favoris", async ({ navigateurConnecte }) => {
    const { page, contexte } = await navigateurConnecte("aminata", { parEcran: true });
    await ouvrirMesFavoris(page);
    // Retirer par le cœur, depuis la liste elle-même.
    for (const id of await mesFavoris(contexte)) {
      await coeur(page, id).click();
      await expect.poll(() => mesFavoris(contexte), { timeout: 15_000 }).not.toContain(id);
    }
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText("Aucun favori pour l'instant")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Touche le cœur d'un trajet dans la recherche ou sur sa fiche pour le retrouver ici.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Chercher un trajet" }).or(page.getByRole("button", { name: "Chercher un trajet" })).first()).toBeVisible();
  });

  test("WEB-FAV-7 · suivre un Voyageur", async ({ navigateurConnecte, jeuEssai }) => {
    test.setTimeout(3 * 60_000);
    const { page, contexte } = await navigateurConnecte("aminata", { parEcran: true });
    const slug = await slugDuVoyageur(contexte, jeuEssai.trajet("bzv-perkg"));
    await contexte.request.delete(`${api()}/users/${slug}/follow`);
    const avant = await abonnes(contexte, slug);

    await page.goto(`/fr/u/${slug}`, { waitUntil: "domcontentloaded" });
    const suivre = page.getByRole("button", { name: "Suivre", exact: true }).filter({ visible: true }).first();
    await expect(suivre).toBeVisible({ timeout: 60_000 });
    await suivre.click();
    await expect(page.getByRole("button", { name: "Suivi", exact: true }).filter({ visible: true }).first()).toBeVisible({ timeout: 15_000 });
    await expect.poll(() => abonnes(contexte, slug), { timeout: 15_000 }).toBe(avant + 1);
    await expect(page.getByText(new RegExp(`${avant + 1}\\s*abonnés?`)).first()).toBeVisible({ timeout: 15_000 });
    // La bascule de notification, cochée par défaut, avec son aide.
    const bascule = page.getByRole("switch", { name: /Me notifier au prochain trajet/ }).filter({ visible: true }).first();
    await expect(bascule).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText("Recevoir un email dès que Thomas publie un nouveau trajet.")).toBeVisible();
    expect(await mesSuivis(contexte)).toEqual(expect.arrayContaining([{ publicSlug: slug, notifyNextTrip: true }]));

    await ouvrirVoyageursSuivis(page);
    await expect(page.getByText("1 voyageur suivi")).toBeVisible({ timeout: 30_000 });
    const texte = await page.locator("main").innerText();
    // (`innerText` rend les intertitres en capitales CSS : comparaisons sans casse.)
    expect(texte).toMatch(/Thomas/);
    expect(texte).toMatch(/\d+ trajets? publiés?/i);
    expect(texte).toMatch(/Prochain trajet à venir/i);
    expect(texte).toMatch(/\bVoyageur\b/i);
    // La note est écrite « 5.0 » ici, « 5,0 » sur la carte de recherche : constat de cohérence.
    test.info().annotations.push({ type: "constat", description: `note affichée ${/\b5\.0\b/.test(texte) ? "« 5.0 » (point) — la carte de recherche écrit « 5,0 »" : "au format français"}` });
    await expect(page.getByRole("button", { name: "Notifications activées" })).toBeVisible();
  });

  test("WEB-FAV-8 · l'email d'abonné à la publication", async ({ navigateurConnecte, mailpit }) => {
    test.setTimeout(3 * 60_000);
    await mailpit.vider();
    const thomas = await navigateurConnecte("thomas", { parEcran: true });
    const trajet = await publierTrajet(thomas.contexte, "Paris", "Brazzaville", ["FR", "CG"]);
    const email = await mailpit.attendreEmail({ pour: COMPTES.aminata.email, sujet: /vient de publier un nouveau trajet/ });
    expect(email.sujet).toBe("Thomas N. vient de publier un nouveau trajet");
    expect(email.html).toContain(`/trips/${trajet}`);
    expect(email.texte + email.html).toMatch(/Paris → Brazzaville|Paris/);
  });

  test("WEB-FAV-9 · désactiver la notification sans se désabonner", async ({ navigateurConnecte, mailpit, jeuEssai }) => {
    test.setTimeout(3 * 60_000);
    const { page, contexte } = await navigateurConnecte("aminata", { parEcran: true });
    const slug = await slugDuVoyageur(contexte, jeuEssai.trajet("bzv-perkg"));
    await ouvrirVoyageursSuivis(page);
    await page.getByRole("button", { name: "Notifications activées" }).click();
    await expect(page.getByRole("button", { name: "Notifications désactivées" })).toBeVisible({ timeout: 15_000 });
    await expect.poll(() => mesSuivis(contexte), { timeout: 15_000 }).toEqual(expect.arrayContaining([{ publicSlug: slug, notifyNextTrip: false }]));

    await mailpit.vider();
    const thomas = await navigateurConnecte("thomas", { parEcran: true });
    await publierTrajet(thomas.contexte, "Paris", "Brazzaville", ["FR", "CG"]);
    await mailpit.aucunEmailPour(COMPTES.aminata.email, 10_000);
    expect((await mesSuivis(contexte)).map((s) => s.publicSlug), "l'abonnement reste").toContain(slug);
  });

  test("WEB-FAV-10 · se désabonner", async ({ navigateurConnecte, jeuEssai }) => {
    const { page, contexte } = await navigateurConnecte("aminata", { parEcran: true });
    const slug = await slugDuVoyageur(contexte, jeuEssai.trajet("bzv-perkg"));
    const avant = await abonnes(contexte, slug);
    await ouvrirVoyageursSuivis(page);
    await page.getByRole("button", { name: "Ne plus suivre" }).first().click();
    await page.getByRole("button", { name: "Confirmer" }).first().click();
    await expect(page.getByText("Tu ne suis plus ce voyageur")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Ne plus suivre" })).toHaveCount(0, { timeout: 15_000 });
    await expect.poll(() => abonnes(contexte, slug), { timeout: 15_000 }).toBe(avant - 1);
    expect((await mesSuivis(contexte)).map((s) => s.publicSlug)).not.toContain(slug);
  });

  test("WEB-FAV-11 · on ne se suit pas soi-même", async ({ navigateurConnecte, jeuEssai }) => {
    const { page, contexte } = await navigateurConnecte("thomas", { parEcran: true });
    const slug = await slugDuVoyageur(contexte, jeuEssai.trajet("bzv-perkg"));
    await page.goto(`/fr/u/${slug}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "Modifier mon profil" }).filter({ visible: true }).first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("button", { name: "Suivre", exact: true })).toHaveCount(0);
    const r = await contexte.request.post(`${api()}/users/${slug}/follow`, { data: { notifyNextTrip: true } });
    expect(r.status(), "un appel forcé est refusé").toBe(400);
    expect(((await r.json()) as { details?: { code?: string } }).details?.code).toBe("CANNOT_FOLLOW_SELF");
  });

  test("WEB-FAV-12 · l'état vide des Voyageurs suivis", async ({ navigateurConnecte }) => {
    const { page, contexte } = await navigateurConnecte("aminata", { parEcran: true });
    for (const s of await mesSuivis(contexte)) await contexte.request.delete(`${api()}/users/${s.publicSlug}/follow`);
    await ouvrirVoyageursSuivis(page);
    await expect(page.getByText("Aucun voyageur suivi")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Découvre les voyageurs de la communauté et suis ceux qui correspondent à tes besoins/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Découvrir des Voyageurs" }).or(page.getByRole("button", { name: "Découvrir des Voyageurs" })).first()).toBeVisible();
  });
});
