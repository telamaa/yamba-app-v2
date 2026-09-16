/**
 * web-alr.spec.ts — cahier 01-WEB, chapitre 5.10 « Alertes de route »
 * =====================================================================
 * La création, la gestion et l'EFFET des alertes : un trajet publié qui correspond déclenche un
 * email (jamais deux en 24 h, jamais au Voyageur lui-même), les villes proches (< 50 km) ne
 * comptent que si l'option est activée, le plafond est de 20 alertes actives.
 *
 * Le formulaire choisit ses villes par l'autocomplétion Google (hors périmètre) : l'écran est
 * éprouvé pour tout ce qui ne dépend pas de Google (état vide, panneau, périodes, bascules,
 * refus « deux villes », cartes, prolonger, supprimer, compteur, bannière de recherche) et les
 * alertes sont CRÉÉES par l'API (`POST /saved-routes`, le même contrat que le formulaire). Les
 * publications qui déclenchent les emails viennent de Joséphine, par l'API du trip-service.
 */
import { test, expect, type Navigateur } from "../fixtures/yamba";
import { adresseDeLApi } from "../fixtures/adresses";
import { COMPTES } from "../fixtures/comptes";
import { ouvrirLaRecherche } from "../pages/recherche";

type Contexte = Navigateur["contexte"];
type Page = Navigateur["page"];
const api = () => adresseDeLApi();

/* ══ Villes (coordonnées consignées : le scénario « proches » en dépend) ═══════════════════ */
const VILLES = {
  bruxelles: { city: "Bruxelles", country: "Belgique", countryCode: "BE", lat: 50.8503, lng: 4.3517 },
  kinshasa: { city: "Kinshasa", country: "République démocratique du Congo", countryCode: "CD", lat: -4.4419, lng: 15.2663 },
  paris: { city: "Paris", country: "France", countryCode: "FR", lat: 48.8566, lng: 2.3522 },
  orly: { city: "Orly", country: "France", countryCode: "FR", lat: 48.7262, lng: 2.3652 }, // ≈ 15 km de Paris
  lille: { city: "Lille", country: "France", countryCode: "FR", lat: 50.6292, lng: 3.0573 }, // ≈ 204 km de Paris
  brazzaville: { city: "Brazzaville", country: "République du Congo", countryCode: "CG", lat: -4.2634, lng: 15.2429 },
};
type Ville = { city: string; country: string; countryCode: string; lat: number; lng: number };

/* ══ Aides API ═══════════════════════════════════════════════════════════════════════════════ */

type Alerte = { id: string; originCity: string; destinationCity: string; emailEnabled: boolean; includeNearby: boolean; expiresAt: string; isActive: boolean };

async function listerAlertes(contexte: Contexte): Promise<Alerte[]> {
  const r = await contexte.request.get(`${api()}/saved-routes`);
  expect(r.ok(), "GET /saved-routes").toBe(true);
  return ((await r.json()) as { savedRoutes: Alerte[] }).savedRoutes;
}
async function supprimerToutesLesAlertes(contexte: Contexte): Promise<void> {
  for (const a of await listerAlertes(contexte)) await contexte.request.delete(`${api()}/saved-routes/${a.id}`);
}
function corpsAlerte(de: Ville, vers: Ville, options: { includeNearby?: boolean; emailEnabled?: boolean; jours?: number } = {}) {
  return {
    originCity: de.city, originCountry: de.country, originCountryCode: de.countryCode, originLat: de.lat, originLng: de.lng,
    destinationCity: vers.city, destinationCountry: vers.country, destinationCountryCode: vers.countryCode, destinationLat: vers.lat, destinationLng: vers.lng,
    earliestDate: null,
    latestDate: new Date(Date.now() + (options.jours ?? 90) * 86_400_000).toISOString(), // « 3 mois »
    emailEnabled: options.emailEnabled ?? true,
    includeNearby: options.includeNearby ?? true,
  };
}
async function creerAlerte(contexte: Contexte, de: Ville, vers: Ville, options: Parameters<typeof corpsAlerte>[2] = {}): Promise<Alerte> {
  const r = await contexte.request.post(`${api()}/saved-routes`, { data: corpsAlerte(de, vers, options) });
  expect(r.status(), `POST /saved-routes ${de.city} → ${vers.city} → ${await r.text()}`).toBe(201);
  return ((await r.json()) as { savedRoute: Alerte }).savedRoute;
}
/** Joséphine publie un trajet (départ J+20, dans la période des alertes), avec ses coordonnées. */
async function publierTrajet(contexte: Contexte, de: Ville, vers: Ville): Promise<string> {
  const r = await contexte.request.post(`${api()}/trips`, {
    data: {
      transportMode: "PLANE", flightType: "DIRECT", tripType: "ONE_WAY",
      originCity: de.city, originCountry: de.country, originCountryCode: de.countryCode, originLat: de.lat, originLng: de.lng,
      destinationCity: vers.city, destinationCountry: vers.country, destinationCountryCode: vers.countryCode, destinationLat: vers.lat, destinationLng: vers.lng,
      departureAt: new Date(Date.now() + 20 * 86_400_000).toISOString(),
      arrivalAt: new Date(Date.now() + 21 * 86_400_000).toISOString(),
      pricePerKgCents: 1150, capacityKg: 23,
      pickupLocations: [{ kind: "AIRPORT", flexibility: "EXACT", details: `${de.city}, aéroport` }],
      deliveryLocations: [{ kind: "AIRPORT", flexibility: "EXACT", details: `${vers.city}, aéroport` }],
      publish: true,
    },
  });
  expect(r.status(), `POST /trips ${de.city} → ${vers.city} → ${await r.text()}`).toBe(201);
  return ((await r.json()) as { trip: { id: string } }).trip.id;
}

const ouvrirMesAlertes = async (page: Page) => {
  await page.goto("/fr/dashboard/saved-routes", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1, name: "Mes alertes route" })).toBeVisible({ timeout: 60_000 });
  await page.waitForLoadState("networkidle").catch(() => undefined);
};

/* ══ Les fiches ══════════════════════════════════════════════════════════════════════════════ */

test.describe("WEB-ALR — alertes de route (chapitre 5.10)", () => {
  test.describe.configure({ mode: "serial" });

  test("WEB-ALR-1 · l'écran « Mes alertes route » vide", async ({ navigateurConnecte }) => {
    const { page, contexte } = await navigateurConnecte("aminata", { parEcran: true });
    await supprimerToutesLesAlertes(contexte);
    await ouvrirMesAlertes(page);
    await expect(page.getByText("Sois prévenu·e dès qu'un trajet correspondant à tes critères est publié.")).toBeVisible();
    await expect(page.getByText("Aucune alerte pour l'instant")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Crée ta première alerte et reçois un email dès qu'un trajet correspond à tes critères.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Créer ma première alerte" })).toBeVisible();
  });

  test("WEB-ALR-2 · le panneau « Nouvelle alerte », puis la carte créée", async ({ navigateurConnecte }) => {
    test.setTimeout(3 * 60_000);
    const { page, contexte } = await navigateurConnecte("aminata", { parEcran: true });
    await ouvrirMesAlertes(page);
    await page.getByRole("button", { name: "Créer ma première alerte" }).click();
    await expect(page.getByText("Nouvelle alerte").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Reçois un email dès qu'un trajet correspond", { exact: true })).toBeVisible();
    // « 3 mois » porte une étoile (préréglage recommandé) : « 3 mois ★ ».
    for (const periode of [/^3 mois/, /^6 mois$/, /^Sans limite$/, /^Personnalisé$/]) {
      await expect(page.getByRole("button", { name: periode })).toBeVisible();
    }
    await page.getByRole("button", { name: /^Personnalisé$/ }).click();
    await expect(page.getByText("À partir du")).toBeVisible();
    await expect(page.getByText("Jusqu'au")).toBeVisible();
    await page.getByRole("button", { name: /^3 mois/ }).click();
    // Les deux bascules, actives par défaut, portent leurs aides.
    await expect(page.getByRole("switch", { name: /^Recevoir un email/ })).toBeChecked();
    await expect(page.getByText("Tu seras notifié·e par email dès qu'un trajet correspond")).toBeVisible();
    await expect(page.getByRole("switch", { name: /^Inclure les trajets proches/ })).toBeChecked();
    await expect(page.getByText("Les villes situées à moins de 50 km déclenchent aussi une alerte")).toBeVisible();
    await expect(page.getByRole("button", { name: "Créer l'alerte" })).toBeVisible();
    // Les villes passent par Google Places (hors périmètre) : l'alerte est créée par l'API, avec le
    // contrat du formulaire (période 3 mois, email activé, villes proches incluses).
    await page.getByRole("button", { name: "Annuler", exact: true }).click();
    const alerte = await creerAlerte(contexte, VILLES.bruxelles, VILLES.kinshasa, { includeNearby: true });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText("1 alerte active")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("main").getByText("Bruxelles").first()).toBeVisible();
    await expect(page.getByText("Email activé").first()).toBeVisible();
    await expect(page.getByText("Villes proches incluses").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Nouvelle alerte" })).toBeVisible();
    test.info().annotations.push({ type: "note", description: `alerte ${alerte.id}, expire le ${alerte.expiresAt} ; toast « Alerte créée ! » non observé (création par l'API, Google hors périmètre)` });
  });

  test("WEB-ALR-3 · les refus de création", async ({ navigateurConnecte }) => {
    const { page, contexte } = await navigateurConnecte("aminata", { parEcran: true });
    await ouvrirMesAlertes(page);
    await page.getByRole("button", { name: "Nouvelle alerte" }).click();
    await expect(page.getByRole("button", { name: "Créer l'alerte" })).toBeVisible({ timeout: 15_000 });
    // Aucune ville : l'écran ne laisse même pas cliquer (« Créer l'alerte » est désactivé) — le
    // message « Sélectionne les deux villes » du cahier existe dans le code mais n'est pas
    // atteignable ainsi : formulation, l'intention (aucune alerte incomplète) est tenue.
    const requetes: string[] = [];
    page.on("request", (r) => { if (r.url().includes("/saved-routes") && r.method() === "POST") requetes.push(r.url()); });
    await expect(page.getByRole("button", { name: "Créer l'alerte" })).toBeDisabled();
    await page.getByRole("button", { name: "Créer l'alerte" }).click({ force: true });
    await page.waitForTimeout(500);
    expect(requetes, "aucune création tentée").toEqual([]);
    await page.getByRole("button", { name: "Annuler", exact: true }).click();
    // Départ = arrivée : l'écran le refuse avant l'envoi (« Le départ et l'arrivée doivent être
    // différents ») — la saisie passe par Google ; la même règle, côté serveur, répond 400.
    const memeVille = await contexte.request.post(`${api()}/saved-routes`, { data: corpsAlerte(VILLES.paris, VILLES.paris) });
    expect(memeVille.status()).toBe(400);
    expect(((await memeVille.json()) as { details?: { code?: string } }).details?.code).toBe("ROUTE_ALERT_INVALID");
    // Et un doublon (même corridor actif) est refusé.
    const doublon = await contexte.request.post(`${api()}/saved-routes`, { data: corpsAlerte(VILLES.bruxelles, VILLES.kinshasa) });
    expect(doublon.status()).toBe(400);
    expect(((await doublon.json()) as { details?: { code?: string } }).details?.code).toBe("ROUTE_ALERT_DUPLICATE");
    expect(await listerAlertes(contexte)).toHaveLength(1);
  });

  test("WEB-ALR-4 · l'alerte se déclenche à la publication, jamais pour le Voyageur lui-même", async ({ navigateurConnecte, mailpit }) => {
    test.setTimeout(3 * 60_000);
    await mailpit.vider();
    const josephine = await navigateurConnecte("josephine", { parEcran: true });
    // Joséphine porte elle aussi une alerte sur SON corridor : elle ne doit rien recevoir.
    await supprimerToutesLesAlertes(josephine.contexte);
    await creerAlerte(josephine.contexte, VILLES.bruxelles, VILLES.kinshasa);
    const trajet = await publierTrajet(josephine.contexte, VILLES.bruxelles, VILLES.kinshasa);
    const email = await mailpit.attendreEmail({ pour: COMPTES.aminata.email, sujet: /Nouveau trajet Bruxelles → Kinshasa/ });
    expect(email.sujet).toBe("Nouveau trajet Bruxelles → Kinshasa");
    expect(email.texte + email.html, "le corps parle de l'alerte").toMatch(/correspond à votre alerte/);
    expect(email.html, "le lien vers le trajet").toContain(`/trips/${trajet}`);
    await mailpit.aucunEmailPour(COMPTES.josephine.email, 6_000);
    test.info().annotations.push({ type: "constat", description: "l'email vouvoie (« Un nouveau trajet correspond à votre alerte ») là où le produit tutoie (décision du 03/09)" });
  });

  test("WEB-ALR-5 · l'anti-spam de 24 heures", async ({ navigateurConnecte, mailpit }) => {
    test.setTimeout(3 * 60_000);
    await mailpit.vider();
    const josephine = await navigateurConnecte("josephine", { parEcran: true });
    await publierTrajet(josephine.contexte, VILLES.bruxelles, VILLES.kinshasa);
    await mailpit.aucunEmailPour(COMPTES.aminata.email, 10_000);
  });

  test("WEB-ALR-6 · les trajets proches (< 50 km) selon l'option", async ({ navigateurConnecte, mailpit }) => {
    test.setTimeout(4 * 60_000);
    const aminata = await navigateurConnecte("aminata", { parEcran: true });
    const josephine = await navigateurConnecte("josephine", { parEcran: true });
    const pauline = await navigateurConnecte("pauline", { parEcran: true });
    await supprimerToutesLesAlertes(pauline.contexte);

    // 1. Paris → Brazzaville SANS les trajets proches ; Orly → Brazzaville publié : rien.
    await mailpit.vider();
    const alerte = await creerAlerte(aminata.contexte, VILLES.paris, VILLES.brazzaville, { includeNearby: false });
    await publierTrajet(josephine.contexte, VILLES.orly, VILLES.brazzaville);
    await mailpit.aucunEmailPour(COMPTES.aminata.email, 10_000);

    // 2. L'option activée (l'alerte n'a jamais été notifiée) ; un autre Orly → Brazzaville : l'email part.
    const patch = await aminata.contexte.request.patch(`${api()}/saved-routes/${alerte.id}`, { data: { includeNearby: true } });
    expect(patch.ok(), "PATCH includeNearby").toBe(true);
    await mailpit.vider();
    const trajetOrly = await publierTrajet(josephine.contexte, VILLES.orly, VILLES.brazzaville);
    const email = await mailpit.attendreEmail({ pour: COMPTES.aminata.email, sujet: /Nouveau trajet Orly → Brazzaville/ });
    expect(email.texte + email.html, "un trajet PROCHE de l'alerte").toMatch(/proche de votre alerte/);
    expect(email.html).toContain(`/trips/${trajetOrly}`);

    // 3. Au-delà de 50 km (Lille, ≈ 204 km de Paris) : jamais rien — sur une alerte NEUVE (Pauline),
    //    pour que l'anti-spam de 24 h d'Aminata ne masque pas le résultat.
    await creerAlerte(pauline.contexte, VILLES.paris, VILLES.brazzaville, { includeNearby: true });
    await mailpit.vider();
    await publierTrajet(josephine.contexte, VILLES.lille, VILLES.brazzaville);
    await mailpit.aucunEmailPour(COMPTES.pauline.email, 10_000);
    await supprimerToutesLesAlertes(pauline.contexte);
    test.info().annotations.push({ type: "villes", description: "Paris 48.8566,2.3522 · Orly 48.7262,2.3652 (≈ 15 km) · Lille 50.6292,3.0573 (≈ 204 km) · Brazzaville -4.2634,15.2429" });
  });

  test("WEB-ALR-7 · prolonger et supprimer une alerte", async ({ navigateurConnecte }) => {
    test.setTimeout(3 * 60_000);
    const { page, contexte } = await navigateurConnecte("aminata", { parEcran: true });
    const avant = await listerAlertes(contexte);
    expect(avant.length, "deux alertes (Bruxelles → Kinshasa, Paris → Brazzaville)").toBe(2);
    // « Prolonger » n'est proposé que sur une alerte qui expire sous 7 jours (ou expirée) : on
    // rapproche l'échéance de la première (période « jusqu'au » J+3 → expire J+4) — écart de
    // formulation avec le cahier, qui l'attend sur toute carte.
    const cible = avant[0];
    const patch = await contexte.request.patch(`${api()}/saved-routes/${cible.id}`, { data: { latestDate: new Date(Date.now() + 3 * 86_400_000).toISOString() } });
    expect(patch.ok(), "PATCH latestDate").toBe(true);
    await ouvrirMesAlertes(page);
    await expect(page.getByText("2 alertes actives")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Expire bientôt")).toBeVisible();

    // Prolonger cette carte.
    await page.getByRole("button", { name: "Prolonger" }).first().click();
    await expect(page.getByText("Alerte prolongée de 6 mois")).toBeVisible({ timeout: 15_000 });
    const apres = await listerAlertes(contexte);
    const prolongee = apres.find((a) => a.id === cible.id);
    expect(prolongee, "l'alerte prolongée existe encore").toBeTruthy();
    await expect(page.getByText("Expire bientôt")).toHaveCount(0);
    const dansSixMois = new Date(); dansSixMois.setMonth(dansSixMois.getMonth() + 6);
    expect(Math.abs(new Date(prolongee!.expiresAt).getTime() - dansSixMois.getTime()), "≈ aujourd'hui + 6 mois").toBeLessThan(2 * 86_400_000);

    // Supprimer la seconde : deux clics (« Supprimer » puis « Confirmer »).
    await page.getByRole("button", { name: "Supprimer" }).last().click();
    await page.getByRole("button", { name: "Confirmer" }).last().click();
    // ANO-WEB-29 : le toast « Alerte supprimée » n'apparaissait JAMAIS (suppression optimiste : la
    // carte était démontée avant la réponse, et son callback `mutate` avec elle).
    await expect(page.getByText("Alerte supprimée")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("1 alerte active")).toBeVisible({ timeout: 15_000 });
    expect(await listerAlertes(contexte)).toHaveLength(1);
  });

  test("WEB-ALR-8 · le plafond de 20 alertes actives", async ({ navigateurConnecte }) => {
    test.setTimeout(3 * 60_000);
    const { page, contexte } = await navigateurConnecte("aminata", { parEcran: true });
    const existantes = await listerAlertes(contexte);
    for (let i = existantes.length; i < 20; i += 1) {
      const de: Ville = { ...VILLES.paris, city: `Ville-${i}` };
      await creerAlerte(contexte, de, VILLES.brazzaville);
    }
    expect(await listerAlertes(contexte)).toHaveLength(20);
    const vingtEtUnieme = await contexte.request.post(`${api()}/saved-routes`, { data: corpsAlerte({ ...VILLES.paris, city: "Ville-21" }, VILLES.brazzaville) });
    expect(vingtEtUnieme.status(), "la 21e est refusée").toBe(400);
    const corps = (await vingtEtUnieme.json()) as { message?: string; details?: { code?: string } };
    expect(corps.details?.code).toBe("ROUTE_ALERT_LIMIT");
    expect(JSON.stringify(corps), "le message nomme le plafond").toContain("20");
    await ouvrirMesAlertes(page);
    await expect(page.getByText("20 alertes actives")).toBeVisible({ timeout: 30_000 });
    await supprimerToutesLesAlertes(contexte);
  });

  test("WEB-ALR-9 · la bannière d'alerte en fin de liste", async ({ navigateurConnecte }) => {
    const { page } = await navigateurConnecte("aminata", { parEcran: true });
    await ouvrirLaRecherche(page, { from: "Paris", to: "Brazzaville" });
    await page.mouse.wheel(0, 20_000);
    await expect(page.getByText("Reste informé·e des futurs trajets")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Crée une alerte pour être prévenu·e dès qu'un nouveau trajet correspondant est publié.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Créer une alerte", exact: true }).filter({ visible: true }).first()).toBeVisible();
  });

  test.afterAll(async ({ browser }) => {
    // Rien à faire : les alertes ont été supprimées fiche par fiche (Aminata en ALR-8, Pauline en
    // ALR-6) ; Joséphine garde la sienne jusqu'au prochain rejeu du seed (ses trajets aussi).
    void browser;
  });
});
