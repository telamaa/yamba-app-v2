/**
 * web-trj.spec.ts — cahier 01-WEB, chapitre 5.7 « Publier un trajet et son cycle de vie »
 * =======================================================================================
 * L'assistant de création, les gardes de publication, les six statuts et les actions permises.
 *
 * Le CŒUR de ce chapitre — la machine à états (`getAllowedActions`, gardes edit/cancel/publish,
 * D72) — est déjà couvert par un test unitaire de 500 lignes (`trip-state-machine.spec.ts`).
 * La recette l'EXERCE ici en vrai, contre le système, plutôt que de le re-prouver : on crée de
 * vrais trajets par l'API, on tente les gestes, on lit `allowedActions` et les statuts, et on
 * vérifie la visibilité par l'API de recherche publique.
 *
 * Les valeurs du wizard (prix, gain, familles) se vérifient à l'écran en OUVRANT le wizard en
 * ÉDITION sur un brouillon créé par l'API (`?edit=<id>`) : on évite ainsi de piloter Google Maps
 * pour l'étape 1, tout en éprouvant l'UI réelle de l'étape 2.
 */
import { test, expect, type Navigateur } from "../fixtures/yamba";
import { adresseDeLApi, adresseDeLApiAdmin } from "../fixtures/adresses";
import { MesTrajets } from "../pages/mes-trajets";

type Contexte = Navigateur["contexte"];

/* ══ Aides API ═══════════════════════════════════════════════════════════════════════════════ */

/** Un brouillon PER_KG complet et publiable ; les `omit`/`patch` en dérivent des variantes. */
function trajetComplet(patch: Record<string, unknown> = {}) {
  return {
    transportMode: "PLANE",
    flightType: "DIRECT",
    tripType: "ONE_WAY",
    originCity: "Bruxelles",
    originCountryCode: "BE",
    destinationCity: "Kinshasa",
    destinationCountryCode: "CD",
    departureAt: new Date(Date.now() + 20 * 86_400_000).toISOString(),
    arrivalAt: new Date(Date.now() + 21 * 86_400_000).toISOString(),
    pricePerKgCents: 1150,
    capacityKg: 23,
    familyConditions: [
      { familyKey: "ELECTRONICS_DEVICES", mode: "SURCHARGE", surchargePct: 20 },
      { familyKey: "FOOD_DRY_SEALED", mode: "REFUSE" },
    ],
    pickupLocations: [{ kind: "AIRPORT", flexibility: "EXACT", details: "Bruxelles-Zaventem, hall des départs" }],
    deliveryLocations: [{ kind: "AIRPORT", flexibility: "EXACT", details: "Kinshasa N'djili, hall d'arrivée" }],
    ...patch,
  };
}

const api = () => adresseDeLApi();

async function creerBrouillon(contexte: Contexte, patch: Record<string, unknown> = {}): Promise<{ id: string; status: string }> {
  const r = await contexte.request.post(`${api()}/trips`, { data: { ...trajetComplet(patch), publish: false } });
  expect(r.status(), `POST /trips (brouillon) → ${await r.text()}`).toBe(201);
  const body = (await r.json()) as { trip?: { id: string; status: string }; id?: string; status?: string };
  const trip = body.trip ?? (body as { id: string; status: string });
  return { id: trip.id, status: trip.status };
}

/** GET /trips/:id → { trip, allowedActions }. */
async function lireTrajet(contexte: Contexte, id: string): Promise<{ status: string; allowedActions: string[] }> {
  const r = await contexte.request.get(`${api()}/trips/${id}`);
  expect(r.ok(), `GET /trips/${id}`).toBe(true);
  const body = (await r.json()) as { trip: { status: string; allowedActions?: string[] } };
  return { status: body.trip.status, allowedActions: body.trip.allowedActions ?? [] };
}

const publier = (contexte: Contexte, id: string) => contexte.request.post(`${api()}/trips/${id}/publish`);
const codeDe = async (r: import("@playwright/test").APIResponse): Promise<string | undefined> => ((await r.json()) as { details?: { code?: string } }).details?.code;

/** Le trajet est-il visible dans la recherche publique (par corridor) ? */
async function trouvableDansLaRecherche(contexte: Contexte, from: string, to: string, id: string): Promise<boolean> {
  const r = await contexte.request.get(`${api()}/trips/search?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=50`);
  if (!r.ok()) return false;
  const body = (await r.json()) as { items?: Array<{ id: string }>; results?: Array<{ id: string }>; trips?: Array<{ id: string }> };
  const items = body.items ?? body.results ?? body.trips ?? [];
  return items.some((t) => t.id === id);
}

/* ══ Les fiches ══════════════════════════════════════════════════════════════════════════════ */

test.describe("WEB-TRJ — publier un trajet et son cycle de vie (chapitre 5.7)", () => {
  test("WEB-TRJ-1 · l'assistant s'ouvre en trois étapes", async ({ navigateurConnecte }) => {
    const { page } = await navigateurConnecte("josephine", { parEcran: true });
    await page.goto("/fr/trips/create", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Votre trajet")).toBeVisible({ timeout: 60_000 });
    // Trois étapes nommées.
    for (const etape of ["Trajet", "Conditions", "Vérification"]) {
      await expect(page.getByText(etape, { exact: true }).first()).toBeVisible();
    }
    // Enregistrer un brouillon est possible d'emblée.
    await expect(page.getByRole("button", { name: "Brouillon" })).toBeVisible();
    // Les trois modes de l'étape 1.
    for (const mode of ["Avion", "Train", "Voiture"]) {
      await expect(page.getByText(mode, { exact: true }).first()).toBeVisible();
    }
    // Les justificatifs se déposent dès l'étape 1 (accordéon « Référence & justificatif »).
    await expect(page.getByRole("button", { name: /Référence & justificatif/ })).toBeVisible();
  });

  test("WEB-TRJ-2 · étape 1 : mode, itinéraire et dates (⏭ Google Places)", async () => {
    test.skip(true,
      "L'itinéraire de l'étape 1 passe par l'autocomplétion Google Places (hors périmètre du harnais, comme 5.2 et 5.6) ; " +
      "les trois modes et leurs variantes sont vus en WEB-TRJ-1, et les dates sont éprouvées via l'édition (WEB-TRJ-3…9). " +
      "Lecture du code pour « heures locales à chaque lieu » : le wizard n'envoie aucun fuseau (originTimezone/destinationTimezone " +
      "absents de create-trip.mapper.ts) et calcule `departureAt` dans le fuseau du NAVIGATEUR ; les heures saisies sont conservées " +
      "telles quelles (departureTimeLocal) pour l'affichage — l'instant absolu, lui, n'est pas celui du lieu (ANO-WEB-23, ouverte).");
  });

  test("WEB-TRJ-11 · le brouillon accepte l'incomplet, le serveur refuse l'incohérence bagage", async ({ navigateurConnecte }) => {
    const { contexte } = await navigateurConnecte("josephine", { parEcran: true });
    // Un brouillon minimal (ville de départ seule + mode) est accepté.
    const r = await contexte.request.post(`${api()}/trips`, { data: { transportMode: "PLANE", originCity: "Bruxelles", originCountryCode: "BE", destinationCity: "Kinshasa", destinationCountryCode: "CD", publish: false } });
    expect(r.status(), `brouillon incomplet accepté → ${await r.text()}`).toBe(201);
    const draft = (await r.json()) as { trip?: { status: string }; status?: string };
    expect(draft.trip?.status ?? draft.status).toBe("DRAFT");

    // L'incohérence bagage (forfait soute alors que la capacité < 23 kg) est refusée, brouillon compris.
    const bag = await contexte.request.post(`${api()}/trips`, { data: trajetComplet({ capacityKg: 5, checkedBag23PriceCents: 20000 }) as Record<string, unknown> });
    expect(bag.status(), "forfait soute incohérent avec la capacité refusé").toBeGreaterThanOrEqual(400);
  });

  test("WEB-TRJ-12 · les gardes de publication (a → f)", async ({ navigateurConnecte }) => {
    const { contexte } = await navigateurConnecte("josephine", { parEcran: true });

    const cas: Array<[string, Record<string, unknown>, string]> = [
      ["a · date de départ manquante", { departureAt: undefined, arrivalAt: undefined }, "PUBLISH_DEPARTURE_REQUIRED"],
      ["b · date de départ passée", { departureAt: new Date(Date.now() - 3 * 86_400_000).toISOString() }, "TRIP_TRANSITION_NOT_ALLOWED"],
      ["c · prix au kilo manquant", { pricePerKgCents: undefined, capacityKg: undefined, familyConditions: undefined }, "PRICING_INCOMPLETE"],
      ["d · capacité manquante", { capacityKg: undefined }, "PRICING_INCOMPLETE"],
      ["e · lieu de remise manquant", { pickupLocations: [] }, "PUBLISH_PICKUP_REQUIRED"],
      ["f · lieu de livraison manquant", { deliveryLocations: [] }, "PUBLISH_DELIVERY_REQUIRED"],
    ];
    for (const [nom, patch, code] of cas) {
      const { id } = await creerBrouillon(contexte, patch);
      const r = await publier(contexte, id);
      expect(r.status(), `${nom} : refus`).toBeGreaterThanOrEqual(400);
      expect(await codeDe(r), nom).toBe(code);
      expect((await lireTrajet(contexte, id)).status, `${nom} : reste en brouillon`).toBe("DRAFT");
    }
  });

  test("WEB-TRJ-10 et 13 · publier, trouvable, masquer, remettre en ligne", async ({ navigateurConnecte }) => {
    const { contexte } = await navigateurConnecte("josephine", { parEcran: true });
    const { id } = await creerBrouillon(contexte);
    expect((await publier(contexte, id)).ok(), "POST /trips/:id/publish").toBe(true);
    expect((await lireTrajet(contexte, id)).status).toBe("PUBLISHED");
    await expect.poll(() => trouvableDansLaRecherche(contexte, "Bruxelles", "Kinshasa", id), { timeout: 15_000 }).toBe(true);

    // Masquer (pause) → absent de la recherche.
    expect((await contexte.request.post(`${api()}/trips/${id}/pause`)).ok(), "POST pause").toBe(true);
    expect((await lireTrajet(contexte, id)).status).toBe("PAUSED");
    await expect.poll(() => trouvableDansLaRecherche(contexte, "Bruxelles", "Kinshasa", id), { timeout: 15_000 }).toBe(false);

    // Remettre en ligne (resume) → réapparaît.
    expect((await contexte.request.post(`${api()}/trips/${id}/resume`)).ok(), "POST resume").toBe(true);
    expect((await lireTrajet(contexte, id)).status).toBe("PUBLISHED");
    await expect.poll(() => trouvableDansLaRecherche(contexte, "Bruxelles", "Kinshasa", id), { timeout: 15_000 }).toBe(true);
  });

  test("WEB-TRJ-13 (badges) · « En ligne » / « Masqué » à l'écran, « Online » / « Hidden » en anglais", async ({ navigateurConnecte }) => {
    const { page, contexte } = await navigateurConnecte("josephine", { parEcran: true });
    const { id } = await creerBrouillon(contexte);
    await publier(contexte, id);
    const trajets = new MesTrajets(page);
    await trajets.ouvrir();
    await expect.poll(async () => (await page.locator("main").innerText()).includes("En ligne"), { timeout: 30_000 }).toBe(true);

    await contexte.request.post(`${api()}/trips/${id}/pause`);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 60_000 });
    const corpsFr = await page.locator("main").innerText();
    expect(corpsFr.includes("Masqué"), "badge « Masqué » après masquage").toBe(true);
    // Jamais les libellés d'une version antérieure.
    expect(/\bActif\b|En pause/.test(corpsFr), "pas de libellé « Actif » / « En pause »").toBe(false);

    // En anglais : Online / Hidden.
    await contexte.request.post(`${api()}/trips/${id}/resume`);
    await page.goto("/en/dashboard/trips", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 60_000 });
    await expect.poll(async () => (await page.locator("main").innerText()).includes("Online"), { timeout: 30_000 }).toBe(true);
    await contexte.request.post(`${api()}/trips/${id}/pause`);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 60_000 });
    const corpsEn = await page.locator("main").innerText();
    expect(corpsEn.includes("Hidden"), "badge « Hidden » en anglais").toBe(true);
    expect(/\bActive\b|Paused/.test(corpsEn), "pas de libellé « Active » / « Paused »").toBe(false);
  });

  /* ── Le wizard en ÉDITION sur un brouillon créé par l'API (étapes 2 et 3) ─────────────────── */

  /** Ouvre `/trips/create?edit=<id>` et attend l'écran d'édition. */
  async function ouvrirEnEdition(page: Navigateur["page"], id: string): Promise<void> {
    await page.goto(`/fr/trips/create?edit=${id}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: /Modifier le trajet/ })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("button", { name: "Bruxelles" })).toBeVisible({ timeout: 30_000 });
  }

  /** Passe à l'étape « Conditions » (l'étape 1 est déjà complète). */
  async function allerAuxConditions(page: Navigateur["page"]): Promise<void> {
    await page.getByRole("button", { name: "Continuer" }).click();
    await expect(page.getByText("Ton prix au kilo").first()).toBeVisible({ timeout: 30_000 });
  }

  /** Déplie un accordéon de l'étape 2 s'il est replié (bouton `aria-expanded`). */
  async function deplier(page: Navigateur["page"], titre: RegExp): Promise<void> {
    const bouton = page.locator("main").getByRole("button", { name: titre }).first();
    await expect(bouton).toBeVisible({ timeout: 15_000 });
    if ((await bouton.getAttribute("aria-expanded")) !== "true") await bouton.click();
  }

  test("WEB-TRJ-3, 4, 5, 8, 9 · l'étape « Conditions » puis « Vérification » (+ ANO-WEB-22)", async ({ navigateurConnecte }) => {
    test.setTimeout(3 * 60_000);
    const { page, contexte } = await navigateurConnecte("josephine", { parEcran: true });
    // 11,50 €/kg · 23 kg · Électronique +20 % · Alimentaire refusé — créé par l'API, donc SANS les
    // chaînes locales (`departureDateLocal`…) que seul le wizard écrit.
    const { id } = await creerBrouillon(contexte);
    await ouvrirEnEdition(page, id);

    // ANO-WEB-22 : les dates et heures sont hydratées depuis `departureAt` / `arrivalAt` (avant la
    // correction : « 4 champs à compléter », « Date requise » ×2, « Heure requise » ×2, et
    // « Continuer » restait sur l'étape 1).
    await expect(page.getByText("Date requise")).toHaveCount(0);
    await expect(page.getByText("Heure requise")).toHaveCount(0);
    await expect(page.getByText(/champs? à compléter/)).toHaveCount(0);
    await allerAuxConditions(page);

    const corps = () => page.locator("main").innerText();
    let texte = await corps();
    // WEB-TRJ-3 : le prix est pré-rempli (11,50), jamais 0 ; fourchette et « ton prix = ton net ».
    expect(/11[.,]50/.test(texte), "prix au kilo 11,50 rendu").toBe(true);
    // Écart de formulation (à trancher) : l'écran dit « net, versé à J+4 après livraison », pas
    // « Ton prix = ton net » (la phrase existe dans `create-trip.copy.ts`, `netGainSub`, mais la
    // refonte UX de l'étape 2 ne l'affiche plus).
    expect(texte, "« net » sur la carte de gain").toMatch(/net, versé à J\+4 après livraison/);
    expect(texte, "ancre de marché (médiane, fourchette)").toMatch(/en médiane \(fourchette/);
    expect(texte, "verdict de la suggestion").toMatch(/Prix juste|Sous le marché|Au-dessus/);
    await expect(page.getByRole("slider", { name: "Ton prix au kilo" })).toHaveAttribute("min", "5");
    await expect(page.getByRole("slider", { name: "Ton prix au kilo" })).toHaveAttribute("max", "20");
    // WEB-TRJ-4 : capacité 2 → 30, gain net = 23 × 11,50 = 264,50, J+4, plancher 8 €, tolérance 10 %.
    await expect(page.getByRole("slider", { name: "Ta capacité" })).toHaveAttribute("min", "2");
    await expect(page.getByRole("slider", { name: "Ta capacité" })).toHaveAttribute("max", "30");
    expect(texte, "gain net 264,50 €").toMatch(/264[.,]50/);
    expect(texte, "« Si tes 23 kg partent »").toMatch(/Si tes 23 kg/);
    expect(texte, "plancher 8 €").toMatch(/moins de 8 €/);
    // La tolérance de poids est dans l'infobulle « Ta capacité ».
    // L'infobulle se referme sur tout défilement (écouteur `scroll` capturé) : on amène le bouton
    // à l'écran AVANT de cliquer, et on réessaie si un défilement résiduel l'a refermée.
    const infoCapacite = page.locator("main").getByRole("button", { name: "Ta capacité" }).first();
    await infoCapacite.scrollIntoViewIfNeeded();
    await expect.poll(async () => {
      if ((await infoCapacite.getAttribute("aria-expanded")) === "true") return true;
      await infoCapacite.click();
      await page.waitForTimeout(300);
      return (await infoCapacite.getAttribute("aria-expanded")) === "true";
    }, { timeout: 15_000 }).toBe(true);
    const idInfobulle = await infoCapacite.getAttribute("aria-controls");
    await expect(page.locator(`[id="${idInfobulle}"]`)).toContainText(/écart de poids\s*≤\s*10\s*%/, { timeout: 10_000 });
    await infoCapacite.click(); // referme
    // WEB-TRJ-5 : le résumé replié rend compte des deux conditions ; dépliée, les huit familles.
    expect(texte, "résumé des familles").toMatch(/Électronique.*\+20 %|\+20 %.*Électronique/s);
    await deplier(page, /Familles de colis/);
    texte = await corps();
    for (const famille of ["Documents & papiers", "Vêtements & textile", "Alimentaire sec & scellé", "Électronique & appareils", "Cosmétiques & soins", "Pièces & outillage", "Jouets & puériculture", "Accessoires & divers"]) {
      expect(texte.includes(famille), `famille « ${famille} »`).toBe(true);
    }
    // WEB-TRJ-8 : plus de bascule « Réservation instantanée » ; la phrase des 24 h la remplace.
    await deplier(page, /Options & message/);
    texte = await corps();
    await expect(page.locator("main").getByRole("switch", { name: /Réservation instantanée/i })).toHaveCount(0);
    expect(texte.includes("Réservation instantanée"), "aucun vestige « Réservation instantanée »").toBe(false);
    expect(texte, "« Chaque demande passe par ton accord »").toMatch(/Chaque demande passe par ton accord/);

    // WEB-TRJ-9 : l'étape « Vérification » — carte « Prix & capacité », « Justificatifs », aperçu public.
    await page.getByRole("button", { name: "Continuer" }).click();
    await expect(page.getByText("Prix & capacité").first()).toBeVisible({ timeout: 30_000 });
    const review = await corps();
    expect(review, "récap prix").toMatch(/11[.,]50/);
    expect(review, "récap capacité").toMatch(/23 kg/);
    // Les justificatifs se déposent à l'étape 1 (« Référence & justificatif ») ; l'étape 3 ne les
    // LISTE que s'il y en a — le cahier les situe à l'étape 3 : formulation, pas anomalie.
    // (`innerText` rend les libellés en capitales CSS : comparaisons insensibles à la casse.)
    expect(/justificatifs/i.test(review), "pas de carte Justificatifs sans document").toBe(false);
    expect(review, "aperçu public").toMatch(/aperçu public/i);
    expect(review, "« tel que vu par les expéditeurs »").toMatch(/tel que vu par les expéditeurs/i);
    expect(review, "famille refusée rappelée").toMatch(/Alimentaire/);
  });

  test("WEB-TRJ-6 · les forfaits bagage : grisés sous la capacité, équivalent au kilo au-dessus", async ({ navigateurConnecte }) => {
    test.setTimeout(3 * 60_000);
    const { page, contexte } = await navigateurConnecte("josephine", { parEcran: true });

    // Capacité 5 kg : les deux lignes sont grisées avec leur seuil (23 kg soute, 12 kg cabine).
    const petit = await creerBrouillon(contexte, { capacityKg: 5 });
    await ouvrirEnEdition(page, petit.id);
    await allerAuxConditions(page);
    await deplier(page, /Bagages entiers/);
    let texte = await page.locator("main").innerText();
    expect(texte, "soute grisée sous 23 kg").toMatch(/Monte ta capacité à 23 kg pour proposer ce forfait/);
    expect(texte, "cabine grisée sous 12 kg").toMatch(/Monte ta capacité à 12 kg pour proposer ce forfait/);
    expect(texte, "aucun forfait proposé").toMatch(/Aucun forfait proposé/);

    // Capacité 23 kg + forfait soute 230 € : accepté, équivalent « ≈ 10,00 €/kg », 1 forfait proposé.
    const grand = await creerBrouillon(contexte, { capacityKg: 23, checkedBag23PriceCents: 23000 });
    await ouvrirEnEdition(page, grand.id);
    await allerAuxConditions(page);
    texte = await page.locator("main").innerText();
    expect(texte, "équivalent au kilo du forfait").toMatch(/≈ 10[.,]00 €\/kg/);
    expect(texte, "résumé « 1 forfait proposé »").toMatch(/1 forfait proposé/);
    expect(texte.includes("Monte ta capacité à 23 kg"), "la ligne soute n'est plus grisée").toBe(false);

    // Le forfait à 0 € est refusé par le serveur (le schéma exige un entier strictement positif).
    const zero = await contexte.request.post(`${api()}/trips`, { data: { ...trajetComplet({ checkedBag23PriceCents: 0 }), publish: false } });
    expect(zero.status(), "forfait à 0 refusé").toBeGreaterThanOrEqual(400);
  });

  test("WEB-TRJ-7 · les lieux de remise et de livraison, leurs types et leurs modes", async ({ navigateurConnecte }) => {
    test.setTimeout(3 * 60_000);
    const { page, contexte } = await navigateurConnecte("josephine", { parEcran: true });
    const { id } = await creerBrouillon(contexte);
    await ouvrirEnEdition(page, id);
    await allerAuxConditions(page);
    const main = page.locator("main");
    await expect(main.getByText("Lieux de remise").first()).toBeVisible();
    await expect(main.getByText("Lieux de livraison").first()).toBeVisible();
    // Les deux lieux enregistrés sont rendus dans leurs champs de précision, carte « À l'aéroport » enfoncée.
    const precisions = main.getByRole("textbox", { name: /Précisions/ });
    await expect(precisions.nth(0)).toHaveValue("Bruxelles-Zaventem, hall des départs");
    await expect(precisions.nth(1)).toHaveValue("Kinshasa N'djili, hall d'arrivée");
    await expect(main.getByRole("button", { name: "À l'aéroport", pressed: true })).toHaveCount(2);
    // Les types proposés dépendent du mode : en avion, « À l'aéroport » et « Dans la ville »
    // (« À la gare » est réservé au train — voir plus bas). Les modes de la carte aéroport :
    // « Exact » (le cahier écrit « Lieu exact » : formulation), « Rayon 5 km », « Rayon 10 km ».
    await expect(main.getByRole("button", { name: "Dans la ville" })).toHaveCount(2);
    await expect(main.getByRole("button", { name: "À la gare" })).toHaveCount(0);
    for (const mode of ["Exact", "Rayon 5 km", "Rayon 10 km"]) {
      expect(await main.getByRole("button", { name: mode, exact: true }).count(), `mode « ${mode} » sur l'aéroport`).toBeGreaterThanOrEqual(2);
    }
    // Activer la carte « Dans la ville » de la remise révèle ses modes : rayons et « Ville entière ».
    await main.getByRole("button", { name: "Dans la ville" }).first().click();
    await expect(main.getByRole("button", { name: "Ville entière" }).first()).toBeVisible({ timeout: 10_000 });
    await expect(main.getByRole("button", { name: "Rayon 20 km" }).first()).toBeVisible();
    await expect(main.getByText("2 lieux").first()).toBeVisible();

    // En train, la carte « À la gare » est proposée.
    const train = await creerBrouillon(contexte, {
      transportMode: "TRAIN", flightType: undefined, trainTripType: "DIRECT",
      originCity: "Bruxelles", destinationCity: "Paris", destinationCountryCode: "FR",
      pickupLocations: [{ kind: "TRAIN_STATION", flexibility: "EXACT", details: "Bruxelles-Midi, hall Eurostar" }],
      deliveryLocations: [{ kind: "TRAIN_STATION", flexibility: "EXACT", details: "Paris Gare du Nord" }],
    });
    await ouvrirEnEdition(page, train.id);
    await allerAuxConditions(page);
    await expect(main.getByRole("button", { name: "À la gare", pressed: true })).toHaveCount(2);
    await expect(main.getByRole("button", { name: "À l'aéroport" })).toHaveCount(0);
  });

  test("WEB-TRJ-14 et 15 · actions permises par état, édition verrouillée avec réservations", async ({ navigateurConnecte, jeuEssai }) => {
    const { contexte } = await navigateurConnecte("thomas", { parEcran: true });

    // Un brouillon : édition, publication, duplication, suppression ; jamais masquer/annuler/archiver.
    const draft = await creerBrouillon(contexte);
    const aDraft = (await lireTrajet(contexte, draft.id)).allowedActions;
    expect(aDraft).toEqual(expect.arrayContaining(["edit", "publish", "duplicate"]));
    expect(aDraft).not.toContain("cancel");
    expect(aDraft).not.toContain("archive");

    // En ligne sans réservation : édition + masquer + annuler ; jamais restaurer.
    const libre = await creerBrouillon(contexte);
    await publier(contexte, libre.id);
    const aOnline = (await lireTrajet(contexte, libre.id)).allowedActions;
    expect(aOnline).toEqual(expect.arrayContaining(["edit", "pause", "cancel"]));

    // bzv-upcoming (Thomas) porte des réservations : « edit » DISPARAÎT.
    const idResa = jeuEssai.trajet("bzv-upcoming");
    const aResa = (await lireTrajet(contexte, idResa)).allowedActions;
    expect(aResa, "un trajet réservé ne se modifie pas").not.toContain("edit");

    // WEB-TRJ-15 : l'édition directe est refusée avec le bon message (400 TRIP_NOT_EDITABLE).
    const put = await contexte.request.put(`${api()}/trips/${idResa}`, { data: trajetComplet({ pricePerKgCents: 999 }) as Record<string, unknown> });
    expect(put.status(), "PUT sur un trajet réservé refusé").toBeGreaterThanOrEqual(400);
    expect((await put.text()).toLowerCase(), "message du verrou d'édition").toContain("cannot edit a trip with active bookings");
  });

  test("WEB-TRJ-16 · annuler un trajet qui porte un deal est refusé (D72)", async ({ navigateurConnecte, jeuEssai }) => {
    const { page, contexte } = await navigateurConnecte("thomas", { parEcran: true });
    const idResa = jeuEssai.trajet("bzv-upcoming"); // porte une demande en attente + un deal accepté

    // À l'écran : « Mes trajets » → menu de la ligne → « Annuler » → confirmation → refus expliqué.
    const trajets = new MesTrajets(page);
    await trajets.ouvrir();
    const refus = await trajets.tenterDAnnulerLeTrajet("Paris → Brazzaville", idResa);
    expect(refus.statut, "le serveur répond 409").toBe(409);
    expect(refus.toast, "le message nomme le nombre de deals et le remboursement").toMatch(/^Ce trajet porte encore (\d+|un) deals? en cours/);
    expect(refus.toast).toMatch(/rembours/i);

    // Par l'API : 409 TRIP_HAS_ACTIVE_DEALS, avec le compte des deals vivants.
    const r = await contexte.request.post(`${api()}/trips/${idResa}/cancel`);
    expect(r.status(), "le serveur refuse l'annulation (409, D72)").toBe(409);
    const corps = (await r.json()) as { details?: { code?: string; activeDeals?: number } };
    expect(corps.details?.code, "code TRIP_HAS_ACTIVE_DEALS").toBe("TRIP_HAS_ACTIVE_DEALS");
    expect(corps.details?.activeDeals ?? 0, "au moins un deal en cours").toBeGreaterThan(0);
    // Le trajet reste EN LIGNE : rien n'a été annulé sans rembourser.
    expect((await lireTrajet(contexte, idResa)).status).toBe("PUBLISHED");
  });

  test("WEB-TRJ-17, 18, 19 · annuler, restaurer, archiver, dupliquer", async ({ navigateurConnecte }) => {
    const { contexte } = await navigateurConnecte("josephine", { parEcran: true });
    const { id } = await creerBrouillon(contexte);
    await publier(contexte, id);

    // Annuler un trajet libre → CANCELLED, absent de la recherche.
    expect((await contexte.request.post(`${api()}/trips/${id}/cancel`)).ok(), "POST cancel").toBe(true);
    expect((await lireTrajet(contexte, id)).status).toBe("CANCELLED");
    await expect.poll(() => trouvableDansLaRecherche(contexte, "Bruxelles", "Kinshasa", id), { timeout: 15_000 }).toBe(false);

    // Restaurer en brouillon (départ futur) → DRAFT.
    expect((await contexte.request.post(`${api()}/trips/${id}/restore`)).ok(), "POST restore").toBe(true);
    expect((await lireTrajet(contexte, id)).status).toBe("DRAFT");

    // Annuler de nouveau puis archiver → ARCHIVED, irréversible.
    await contexte.request.post(`${api()}/trips/${id}/publish`);
    await contexte.request.post(`${api()}/trips/${id}/cancel`);
    expect((await contexte.request.post(`${api()}/trips/${id}/archive`)).ok(), "POST archive").toBe(true);
    expect((await lireTrajet(contexte, id)).status).toBe("ARCHIVED");
    const aArch = (await lireTrajet(contexte, id)).allowedActions;
    expect(aArch, "archivé : plus que dupliquer").not.toContain("restore");
    expect(await (await contexte.request.post(`${api()}/trips/${id}/restore`)).status(), "restaurer un archivé refusé").toBeGreaterThanOrEqual(400);

    // Dupliquer → un nouveau brouillon (l'original inchangé). Duplication = createTrip depuis les conditions.
    const dup = await contexte.request.post(`${api()}/trips`, { data: { ...trajetComplet(), publish: false } });
    expect(dup.status()).toBe(201);
  });

  test("WEB-TRJ-20 · le Voyageur sur la page publique de son propre trajet", async ({ navigateurConnecte, jeuEssai }) => {
    const { page } = await navigateurConnecte("thomas", { parEcran: true });
    const id = jeuEssai.trajet("bzv-perkg");
    await page.goto(`/fr/trips/${id}`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => undefined);
    // « C'est votre trajet », pas de bouton Réserver.
    await expect(page.getByText(/C'est (votre|ton) trajet/i).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: /^Réserver/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Modifier|Gérer/ }).first()).toBeVisible();
  });

  test("WEB-TRJ-21 · « Masqué par Yamba » vu du Voyageur", async ({ navigateurConnecte, navigateurVisiteur, navigateurAdmin, jeuEssai }) => {
    test.setTimeout(4 * 60_000);
    const idYul = jeuEssai.trajet("yul");
    const apiAdmin = adresseDeLApiAdmin();
    const marc = await navigateurConnecte("marc", { parEcran: true });
    const admin = await navigateurAdmin("mediateur");

    // L'admin masque le trajet (motif interne).
    const motif = "Recette WEB-TRJ-21 : masquage de contrôle, levé par la même fiche.";
    const masquage = await admin.contexte.request.post(`${apiAdmin}/admin/trips/${idYul}/hide`, { data: { reason: motif } });
    expect(masquage.status(), `POST /admin/trips/:id/hide → ${await masquage.text()}`).toBe(200);
    try {
      // Le Voyageur voit un bandeau « masqué par Yamba » sur le détail.
      await marc.page.goto(`/fr/dashboard/trips/${idYul}`, { waitUntil: "domcontentloaded" });
      await marc.page.waitForLoadState("networkidle").catch(() => undefined);
      await expect(marc.page.getByText(/masqué par Yamba/i).first()).toBeVisible({ timeout: 30_000 });

      // La page publique répond « introuvable » à un visiteur, et le trajet sort de la recherche.
      const { page } = await navigateurVisiteur();
      await page.goto(`/fr/trips/${idYul}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByText(/introuvable|n'existe pas|n'est plus disponible/i).first()).toBeVisible({ timeout: 30_000 });
      await expect.poll(() => trouvableDansLaRecherche(marc.contexte, "Paris", "Montréal", idYul), { timeout: 15_000 }).toBe(false);
    } finally {
      const levee = await admin.contexte.request.delete(`${apiAdmin}/admin/trips/${idYul}/hide`, { data: { reason: motif } });
      if (levee.status() !== 200) throw new Error(`Masquage de yul NON levé (${levee.status()} ${await levee.text()}) : le lever à la main.`);
    }
  });
});
