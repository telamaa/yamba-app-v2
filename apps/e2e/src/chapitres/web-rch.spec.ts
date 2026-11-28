/**
 * web-rch.spec.ts — cahier 01-WEB, chapitre 5.9 « Recherche, filtres, tri, état vide »
 * =====================================================================================
 * L'écran `/search` : titres, cartes et leurs prix, poids du colis, tris, familles, filtres de
 * confiance, états vide et d'erreur, la page publique d'un trajet, le compteur de vues, un trajet
 * disparu, un compte suspendu.
 *
 * La barre de recherche s'appuie sur l'autocomplétion Google Places pour les villes (hors
 * périmètre du harnais). Mais ce que `/search` interroge, c'est le BROUILLON de la barre,
 * persistant en `sessionStorage` (`usePersistedFormState`, clé `yamba:form:trip-search`) : on le
 * pose avant d'ouvrir la page, et l'écran cherche exactement ce qu'il aurait cherché après une
 * saisie. Le poids du colis, lui, vit en `localStorage` (`yamba.search.weightKg`).
 */
import { test, expect, type Navigateur } from "../fixtures/yamba";
import { adresseDeLApi, adresseDeLApiAdmin } from "../fixtures/adresses";
import { JeuEssai } from "../fixtures/jeu-essai";
import { carteDuTrajet, ouvrirLaRecherche, type CritereRecherche } from "../pages/recherche";

type Page = Navigateur["page"];
type Contexte = Navigateur["contexte"];
const api = () => adresseDeLApi();

/* ══ Aides ═══════════════════════════════════════════════════════════════════════════════════ */

type Critere = CritereRecherche;
const carte = carteDuTrajet;

/** Les identifiants des cartes, dans l'ordre de l'écran. */
async function ordreDesCartes(page: Page): Promise<string[]> {
  const hrefs = await page.locator('main a[href^="/fr/trips/"]').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute("href") ?? ""));
  const ids = hrefs.map((h) => h.replace("/fr/trips/", "").split(/[?#]/)[0]).filter((h) => /^[0-9a-f]{24}$/.test(h));
  return [...new Set(ids)];
}

type Item = { id: string; pricePerKg?: number; remainingKg?: number; totalForWeight?: number; viewsCount?: number; rating?: number; departureAt?: string };
async function rechercherParApi(contexte: Contexte, query: Record<string, string | number>): Promise<{ trips: Item[]; totalCount: number }> {
  const qs = new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)])).toString();
  const r = await contexte.request.get(`${api()}/trips/search?${qs}&limit=50`);
  expect(r.ok(), `GET /trips/search?${qs}`).toBe(true);
  return (await r.json()) as { trips: Item[]; totalCount: number };
}
async function facettes(contexte: Contexte, query: Record<string, string> = {}): Promise<{ superTripperCount: number; profileVerifiedCount: number; verifiedTicketCount: number; familyCounts: Record<string, number>; modeCount: Record<string, number>; totalCount: number }> {
  const qs = new URLSearchParams(query).toString();
  const r = await contexte.request.get(`${api()}/trips/search/facets${qs ? `?${qs}` : ""}`);
  expect(r.ok(), "GET /trips/search/facets").toBe(true);
  return r.json();
}

/**
 * Le panneau des filtres.
 *
 * REMISE À NIVEAU DU 28/11/2026 — il s'intitulait « Trier par » jusqu'à
 * **D100 7A**, qui l'a renommé « Filtres » pour une raison écrite : le
 * panneau contient le tri, la confiance, le poids et les familles, et il
 * s'appelait par UNE de ses quatre parties. Le harnais n'étant pas un
 * contrôle de CI, ce sélecteur réclamait depuis deux semaines un élément
 * qui n'existe plus. Le tri, lui, garde son nom — c'est le `radiogroup`
 * INTÉRIEUR qui s'appelle « Trier par ».
 */
const filtres = (page: Page) => page.getByRole("group", { name: "Filtres" }).filter({ visible: true }).first();
const curseurPoids = (page: Page) => page.getByRole("slider", { name: "Poids du colis" });
const puceFamille = (page: Page, nom: string) => filtres(page).getByRole("button", { name: new RegExp(`^${nom.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) });
const texteDe = async (page: Page) => (await page.locator("body").innerText()).replace(/ | /g, " ");

/* ══ Les fiches ══════════════════════════════════════════════════════════════════════════════ */

test.describe("WEB-RCH — recherche, filtres, tri, état vide (chapitre 5.9)", () => {
  // « Jeu d'essai fraîchement rejoué » (précondition du chapitre) : trajets des comptes du seed
  // recréés, identifiants neufs (donc compteurs de vues à zéro), chapitres 5.7 / 5.8 effacés.
  test.beforeAll(() => {
    new JeuEssai().rejouer();
  });

  test("WEB-RCH-1 · la liste complète et son titre", async ({ navigateurVisiteur, jeuEssai }) => {
    const { page, contexte } = await navigateurVisiteur();
    await ouvrirLaRecherche(page);
    await expect(page.getByRole("heading", { level: 1, name: "Tous les trajets disponibles" })).toBeVisible();
    await expect(page.getByText("Affinez avec un départ et une destination, ou parcourez l'offre actuelle")).toBeVisible();
    for (const onglet of ["Tout", "Avion", "Train", "Voiture"]) {
      await expect(page.getByRole("tab", { name: new RegExp(`^${onglet}`) }).or(page.getByRole("button", { name: new RegExp(`^${onglet}\\b`) })).first()).toBeVisible();
    }
    // Les trajets à venir du jeu d'essai (les trois déjà partis n'y sont pas), sans « Charger plus » sous dix.
    const attendus = ["bzv-upcoming", "yul", "gru", "fih", "bzv-perkg"].map((k) => jeuEssai.trajet(k));
    const { totalCount } = await rechercherParApi(contexte, {});
    await expect.poll(() => ordreDesCartes(page), { timeout: 30_000 }).toHaveLength(totalCount);
    for (const id of attendus) await expect(carte(page, id)).toBeVisible();
    for (const parti of ["bzv-inflight", "los", "sgn"]) await expect(carte(page, jeuEssai.trajet(parti))).toHaveCount(0);
    if (totalCount <= 10) await expect(page.getByRole("button", { name: "Charger plus de résultats" })).toHaveCount(0);
    // Le compteur « Résultats disponibles » / « n/n résultats affichés » du cahier : constaté.
    const texte = await texteDe(page);
    test.info().annotations.push({ type: "constat", description: `« Résultats disponibles » ${texte.includes("Résultats disponibles") ? "présent" : "ABSENT"} ; « résultats affichés » ${/résultats affichés/.test(texte) ? "présent" : "ABSENT"} ; ${totalCount} trajets` });
    expect(/\b0 vues?\b/.test(texte), "jamais « 0 vue »").toBe(false);
    await expect(page.getByText("Cette page n'a pas pu s'afficher"), "pas de page d'incident (ANO-WEB-27)").toHaveCount(0);
  });

  test("ANO-WEB-27 · un Voyageur avec un avatar ImageKit ne fait plus tomber la recherche", async ({ navigateurVisiteur, jeuEssai }) => {
    test.setTimeout(3 * 60_000);
    // Avant correction : `next/image` refusait l'hôte `ik.imagekit.io` (absent de `images.remotePatterns`)
    // et la page ENTIÈRE basculait sur « Cette page n'a pas pu s'afficher » dès qu'une carte portait
    // un avatar distant. On pose un avatar ImageKit à Thomas (référence seule, aucun téléversement),
    // on ouvre Paris → Brazzaville, et on l'enlève quoi qu'il arrive.
    const idThomas = jeuEssai.membre("thomas");
    const id = jeuEssai.trajet("bzv-perkg");
    jeuEssai.manoeuvre(
      "ANO-WEB-27 — un avatar ImageKit sur Thomas (référence seule, l'hôte distant est ce qui faisait tomber /search)",
      // `carrierPageId` est posé (page Voyageur de Thomas) : sans lui, l'index unique NON épars
      // `Image_carrierPageId_key` refuse un second `null` — c'est ANO-WEB-28, ci-dessous.
      `import p from "./packages/libs/prisma"; (async () => { const cp = await p.carrierPage.findUnique({ where: { userId: "${idThomas}" }, select: { id: true } }); await p.image.deleteMany({ where: { userId: "${idThomas}" } }); await p.image.create({ data: { userId: "${idThomas}", carrierPageId: cp?.id, fileId: "e2e-avatar-thomas", url: "https://ik.imagekit.io/yamba-e2e/avatars/thomas.png" } }); process.exit(0); })();`
    );
    try {
      const { page } = await navigateurVisiteur();
      const erreurs: string[] = [];
      page.on("pageerror", (e) => erreurs.push(e.message));
      await ouvrirLaRecherche(page, { from: "Paris", to: "Brazzaville" });
      await expect(carte(page, id)).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("Cette page n'a pas pu s'afficher")).toHaveCount(0);
      expect(erreurs.filter((e) => /next\/image|hostname/.test(e)), "aucune erreur next/image").toEqual([]);
      // La page publique et le profil rendent aussi cet avatar par `next/image`.
      await page.goto(`/fr/trips/${id}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByText("Trajet proposé par Thomas N.")).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText("Cette page n'a pas pu s'afficher")).toHaveCount(0);
    } finally {
      jeuEssai.manoeuvre(
        "ANO-WEB-27 — retrait de l'avatar posé pour la contre-épreuve",
        `import p from "./packages/libs/prisma"; (async () => { await p.image.deleteMany({ where: { userId: "${idThomas}" } }); process.exit(0); })();`
      );
    }
  });

  test("ANO-WEB-28 · un deuxième membre peut poser son avatar (index unique non épars)", async ({ navigateurConnecte }) => {
    // Trouvé en posant la contre-épreuve d'ANO-WEB-27 : `Image.carrierPageId` est `@unique` et
    // OPTIONNEL ; Prisma crée sur Mongo un index unique NON épars, donc DEUX images à
    // `carrierPageId: null` — deux avatars de membres — entrent en collision (P2002). Un seul
    // membre de toute la plateforme peut avoir un avatar. `test.fail` tant que l'index n'est pas
    // épars (ou le modèle scindé) : le jour où c'est corrigé, Playwright signale que la fiche passe.
    test.fail(true, "ANO-WEB-28 (BLOQUANTE, ouverte) : POST /auth/me/avatar répond 500 P2002 pour le second membre qui pose un avatar — Image_carrierPageId_key non épars");
    const { contexte } = await navigateurConnecte("josephine", { parEcran: true });
    const endpoint = process.env.IMAGEKIT_URL_ENDPOINT ?? "https://ik.imagekit.io/telamaa";
    const r = await contexte.request.post(`${api()}/auth/me/avatar`, { data: { fileId: `e2e-avatar-${Date.now()}`, url: `${endpoint.replace(/\/$/, "")}/avatars/e2e-josephine.png` } });
    try {
      expect(r.status(), `POST /auth/me/avatar → ${await r.text()}`).toBe(200);
    } finally {
      await contexte.request.delete(`${api()}/auth/me/avatar`).catch(() => undefined);
    }
  });

  test("WEB-RCH-2 · les titres dynamiques", async ({ navigateurVisiteur }) => {
    test.setTimeout(3 * 60_000);
    const dans12Jours = new Date(Date.now() + 12 * 86_400_000);
    const cas: Array<[Critere, RegExp]> = [
      [{ from: "Paris" }, /^Trajets au départ de Paris$/],
      [{ to: "Brazzaville" }, /^Trajets à destination de Brazzaville$/],
      [{ date: dans12Jours }, new RegExp(`^Trajets le ${dans12Jours.getDate()} \\S+ ${dans12Jours.getFullYear()}$`)],
      [{ from: "Paris", to: "Brazzaville" }, /^Trajets pour Paris → Brazzaville$/],
    ];
    for (const [critere, titre] of cas) {
      const { page } = await navigateurVisiteur();
      await ouvrirLaRecherche(page, critere);
      await expect(page.getByRole("heading", { level: 1 }), JSON.stringify(critere)).toHaveText(titre, { timeout: 30_000 });
      await page.close();
    }
  });

  test("WEB-RCH-3 · la carte d'un trajet au kilo", async ({ navigateurVisiteur, jeuEssai }) => {
    const { page, contexte } = await navigateurVisiteur();
    const id = jeuEssai.trajet("bzv-perkg");
    await ouvrirLaRecherche(page, { from: "Paris", to: "Brazzaville" });
    const laCarte = carte(page, id);
    await expect(laCarte).toBeVisible({ timeout: 30_000 });
    const texte = (await laCarte.innerText()).replace(/ | /g, " ");
    // REMISE À NIVEAU DU 28/11/2026 — ce bloc décrivait la carte d'AVANT, et
    // trois décisions l'ont périmée :
    //   • **D99 3A** a ÉCHANGÉ les deux chiffres : le gros est désormais ce
    //     que l'envoi COÛTE (outil de décision), et le prix au kilo — outil
    //     de comparaison entre offres — a QUITTÉ la carte ;
    //   • **D99 bis** a réécrit la mention (« estimation pour {kg} kg » tant
    //     que le poids est supposé) et sorti « tout compris » de la carte,
    //     qui est redit dans le tunnel ;
    //   • **D81** facture au poids PLANCHER : un colis supposé de 2 kg est
    //     facturé 2,3 kg, et c'est ce poids-là que la mention nomme (D100).
    expect(texte, "un TOTAL à deux décimales (D99 1A)").toMatch(/\d+,\d{2}\s*€/);
    expect(texte, "la mention nomme le poids FACTURÉ").toMatch(/estimation pour 2,3\s*kg/);
    expect(texte, "le prix au kilo a quitté la carte (D99 3A)").not.toMatch(/€\s*\/\s*kg|prix au kilo/i);
    expect(texte, "« tout compris » a quitté la carte (D99 bis)").not.toMatch(/tout compris/);
    expect(texte, "vol direct").toMatch(/Direct/);
    // Ni tiret d'heure, ni prix à zéro, ni note fictive.
    expect(texte, "pas de « — » à la place d'une heure").not.toMatch(/\d{2}:\d{2}\s*→?\s*—|—\s*$/m);
    expect(texte, "jamais un prix à 0").not.toMatch(/0,00 €|à partir de 0/);
    expect(texte, "jamais « 0,0 » de note").not.toMatch(/\b0,0\b/);
    // Un compteur de vues seulement s'il est > 0 (le seed vient d'être rejoué : aucune vue).
    const { trips } = await rechercherParApi(contexte, { from: "Paris", to: "Brazzaville" });
    const item = trips.find((t) => t.id === id);
    expect(item?.pricePerKg).toBe(11.5);
    if (!item?.viewsCount) expect(texte).not.toMatch(/\bvues?\b/);
    // Le cœur de mise en favori (bouton dans la carte).
    await expect(laCarte.getByRole("button", { name: "Ajouter aux favoris" }).filter({ visible: true }).first()).toBeVisible();
    // La mention du plancher, dans le panneau des filtres.
    // D81 — le plancher est passé en KILOS : il ne se dit plus « 8 € minimum »
    // (un montant qui dépendait du prix au kilo du trajet) mais « facturé
    // 2,3 kg minimum », ce qui est la règle réelle et vaut pour tous les
    // trajets. C'est le même 2,3 kg que la mention sous le prix.
    await expect(page.getByText(/Colis léger .*facturé 2,3\s*kg minimum\./).first()).toBeVisible();
  });

  test("WEB-RCH-4 et 5 · « Votre colis » : le prix pour 3 kg, puis le prix comparable à 2 kg", async ({ navigateurVisiteur, jeuEssai }) => {
    test.setTimeout(3 * 60_000);
    const { page, contexte } = await navigateurVisiteur();
    const id = jeuEssai.trajet("bzv-perkg");
    await ouvrirLaRecherche(page, { from: "Paris", to: "Brazzaville" });
    await expect(carte(page, id)).toBeVisible({ timeout: 30_000 });

    // 3 kg au curseur.
    const reponse = page.waitForResponse((r) => /\/trips\/search\?.*weightKg=3/.test(r.url()), { timeout: 30_000 });
    await curseurPoids(page).fill("3");
    expect((await reponse).ok()).toBe(true);
    await expect(page.getByText("Prix et tri calculés pour 3 kg · trajets sans assez de place exclus")).toBeVisible({ timeout: 15_000 });
    // L'API dit le total au centime ; depuis **D99 1A** la carte l'affiche à
    // DEUX DÉCIMALES et non plus arrondi à l'euro — les deux fronts
    // montraient « 25 € » et « 24,85 € » pour le même trajet, et la règle
    // vit désormais dans `pricing-example.ts`. On lit donc le montant de
    // l'API et on exige la MÊME mise en forme à l'écran, plutôt qu'un
    // nombre recopié qui périmerait au prochain réglage de prix.
    const { trips } = await rechercherParApi(contexte, { from: "Paris", to: "Brazzaville", weightKg: 3 });
    const item = trips.find((t) => t.id === id);
    expect(item?.totalForWeight, "total API pour 3 kg").toBeGreaterThan(0);
    const attendu = (item?.totalForWeight ?? 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    await expect
      .poll(async () => (await carte(page, id).innerText()).replace(/\u00a0|\u202f/g, " "), { timeout: 30_000 })
      .toContain(`${attendu} €`);
    // D99 bis — le poids CHOISI change la phrase : « pour ton colis de … ».
    await expect
      .poll(async () => (await carte(page, id).innerText()).replace(/\u00a0|\u202f/g, " "), { timeout: 30_000 })
      .toMatch(/pour ton colis de 3\s*kg/);
    // Les trajets sans assez de kilos restants le disent ; ceux dont la capacité totale est
    // insuffisante sont exclus (aucun sur le seed : capacités ≥ 15 kg).
    for (const t of trips) {
      const txt = (await carte(page, t.id).innerText()).replace(/ | /g, " ");
      if (typeof t.remainingKg === "number" && t.remainingKg < 3) expect(txt, `${t.id} sans assez de place`).toMatch(/Plus assez de place/);
      else expect(txt, `${t.id} a la place`).not.toMatch(/Plus assez de place/);
    }
    // Le poids est mémorisé sur l'appareil.
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText("Prix et tri calculés pour 3 kg · trajets sans assez de place exclus")).toBeVisible({ timeout: 30_000 });
    await expect(curseurPoids(page)).toHaveValue("3");
    expect(await page.evaluate(() => window.localStorage.getItem("yamba.search.weightKg"))).toBe("3");
    await expect(page.getByText("pour ton colis de 3 kg").first()).toBeVisible();

    // WEB-RCH-5 : « Tout effacer » → référence 2 kg, prix comparables.
    await page.getByRole("button", { name: "Tout effacer" }).filter({ visible: true }).first().click();
    // Le panneau ne dit plus « Indique le poids : … » mais annonce d'abord le
    // colis de référence, puis invite à donner le sien — D99 bis a fait de
    // l'estimation une HYPOTHÈSE affichée, et non un ordre.
    await expect(page.getByText(/Prix affichés pour un colis de 2\s*kg\./).first()).toBeVisible({ timeout: 15_000 });
    await expect(curseurPoids(page)).toHaveValue("2");
    // D99 bis / D100 — poids relâché : la carte revient à l'ESTIMATION et
    // nomme le poids FACTURÉ (2,3 kg, plancher D81), pas le poids de
    // référence (2 kg). C'est D100 qui a réparé cette incohérence : la
    // mention nommait le poids CHOISI à côté du prix du poids FACTURÉ, et
    // le curseur semblait donc inerte. La phrase du panneau, elle, parle
    // bien du colis de référence — et elle n'est plus seule à l'écran.
    await expect(page.getByText("pour un colis de 2 kg").first()).toBeVisible();
    await expect
      .poll(async () => (await carte(page, id).innerText()).replace(/\u00a0|\u202f/g, " "), { timeout: 30_000 })
      .toMatch(/estimation pour 2,3\s*kg/);
    expect(await page.evaluate(() => window.localStorage.getItem("yamba.search.weightKg"))).toBeNull();
  });

  test("WEB-RCH-6 · les QUATRE tris", async ({ navigateurVisiteur }) => {
    test.setTimeout(4 * 60_000);
    const { page, contexte } = await navigateurVisiteur();
    await ouvrirLaRecherche(page);
    // Ancré au DÉBUT depuis le 28/11, et c'est le seul sélecteur qui marche :
    //   • une correspondance PARTIELLE attrape deux options — l'indice de
    //     « Les plus pertinents » est « Près de toi, et les mieux notés » ;
    //   • une correspondance EXACTE n'en attrape aucune — le nom accessible
    //     d'une option INCLUT son indice (« Prix le plus bas / pour un colis
    //     de 2 kg »).
    const radio = (nom: string) => filtres(page).getByRole("radio", { name: new RegExp(`^${nom}`) });

    // REMISE À NIVEAU DU 28/11/2026 — ce scénario s'intitulait « les TROIS
    // tris » et commençait par « « Départ le plus tôt » est le tri par
    // défaut ». **D100 1A/1B** a change les deux :
    //   • le défaut du SERVEUR est `relevance` depuis D80, et il était
    //     appliqué SANS être affiché — « Départ le plus tôt » portait son
    //     résultat, c'est-à-dire que la case cochée mentait ;
    //   • `relevance` est donc devenu une option NOMMÉE (« Les plus
    //     pertinents »), et il y en a quatre.
    // On les parcourt toutes, en terminant par le défaut.
    for (const [nom, sort] of [
      ["Prix le plus bas", "lowestPrice"],
      ["Mieux notés", "bestRated"],
      ["Départ le plus tôt", "earliest"],
      ["Les plus pertinents", "relevance"],
    ] as const) {
      await radio(nom).click();
      await expect(radio(nom)).toHaveAttribute("aria-checked", "true");
      const { trips } = await rechercherParApi(contexte, { sort });
      await expect.poll(() => ordreDesCartes(page), { timeout: 30_000 }).toEqual(trips.map((t) => t.id));
      if (sort === "earliest") {
        const dates = trips.map((t) => new Date(t.departureAt ?? 0).getTime());
        expect(dates, "départs croissants").toEqual([...dates].sort((a, b) => a - b));
      }
      if (sort === "lowestPrice") {
        // D99 bis — la mention vit sur CHAQUE carte (« pour ton colis de
        // {kg} kg » une fois le poids choisi, « estimation pour {kg} kg »
        // tant qu'il est supposé). Elle n'est donc plus unique à l'écran :
        // on en exige au moins une, pas exactement une.
        await expect(page.getByText("pour un colis de 2 kg").first()).toBeVisible();
        expect(trips.every((t) => typeof t.pricePerKg === "number" && t.pricePerKg > 0), "aucun trajet sans prix dans ce tri").toBe(true);
      }
      if (sort === "bestRated") {
        expect(await texteDe(page), "aucune note fictive").not.toMatch(/\b0,0\b/);
      }
    }
  });

  test("WEB-RCH-7 · le filtre « Que voulez-vous envoyer ? »", async ({ navigateurVisiteur, jeuEssai }) => {
    test.setTimeout(3 * 60_000);
    const { page, contexte } = await navigateurVisiteur();
    const id = jeuEssai.trajet("bzv-perkg");
    await ouvrirLaRecherche(page, { from: "Paris", to: "Brazzaville" });
    await expect(carte(page, id)).toBeVisible({ timeout: 30_000 });

    // Chaque puce porte son compte ; une puce à 0 est désactivée.
    const f = await facettes(contexte, { from: "Paris", to: "Brazzaville" });
    for (const [famille, libelle] of Object.entries({ FOOD_DRY_SEALED: "Alimentaire sec & scellé", ELECTRONICS_DEVICES: "Électronique & appareils", DOCUMENTS_PAPERS: "Documents & papiers" })) {
      const puce = puceFamille(page, libelle);
      await expect(puce).toBeVisible();
      await expect(puce).toContainText(String(f.familyCounts[famille]));
      if (f.familyCounts[famille] === 0) await expect(puce).toBeDisabled();
    }
    // bzv-perkg REFUSE l'alimentaire : coché → il disparaît.
    await puceFamille(page, "Alimentaire sec & scellé").click();
    await expect(carte(page, id)).toHaveCount(0, { timeout: 30_000 });
    // Décoché, puis Électronique : il réapparaît, supplément annoncé AVANT le clic.
    await puceFamille(page, "Alimentaire sec & scellé").click();
    await puceFamille(page, "Électronique & appareils").click();
    await expect(carte(page, id)).toBeVisible({ timeout: 30_000 });
    await expect(carte(page, id)).toContainText("Électronique & appareils : +20 %");
    // Documents en plus : il accepte les deux, il reste.
    await puceFamille(page, "Documents & papiers").click();
    await expect(carte(page, id)).toBeVisible({ timeout: 30_000 });
    // Un trajet sans position (tout accepté) reste compatible avec toutes : bzv-upcoming est là.
    await expect(carte(page, jeuEssai.trajet("bzv-upcoming"))).toBeVisible();
  });

  test("WEB-RCH-8 · les filtres de confiance masquent leurs lignes vides", async ({ navigateurVisiteur }) => {
    const { page, contexte } = await navigateurVisiteur();
    await ouvrirLaRecherche(page);
    const f = await facettes(contexte);
    const section = page.getByRole("group", { name: "Confiance et sécurité" }).filter({ visible: true }).first();
    const attendu: Array<[string, number]> = [["Super Voyageur", f.superTripperCount], ["Profil vérifié", f.profileVerifiedCount], ["Billet vérifié", f.verifiedTicketCount]];
    const visibles = attendu.filter(([, n]) => n > 0);
    if (visibles.length > 0) await expect(section).toBeVisible();
    for (const [nom, n] of attendu) {
      const ligne = page.locator("main").getByText(nom, { exact: true }).filter({ visible: true });
      if (n > 0) await expect(ligne.first(), `« ${nom} » (${n}) proposé`).toBeVisible();
      else await expect(ligne, `« ${nom} » (0) masqué, pas grisé`).toHaveCount(0);
    }
    test.info().annotations.push({ type: "facettes", description: JSON.stringify(attendu) });
  });

  test("WEB-RCH-9 · l'état vide d'une recherche sans trajet", async ({ navigateurVisiteur }) => {
    const { page } = await navigateurVisiteur();
    await ouvrirLaRecherche(page, { from: "Brazzaville", to: "Paris" });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Trajets pour Brazzaville → Paris");
    await expect(page.getByText("Aucun trajet ne correspond ?")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Crée une alerte et reçois un email dès qu'un Voyageur publie ce trajet.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Créer une alerte pour ce trajet" })).toBeVisible();
    expect(await ordreDesCartes(page)).toEqual([]);
    // Le titre « Aucun trajet trouvé » et sa phrase : le bloc « alerte » les remplace quand un
    // corridor est saisi (constaté, écart de cahier à trancher).
    const texte = await texteDe(page);
    test.info().annotations.push({ type: "constat", description: `« Aucun trajet trouvé » ${texte.includes("Aucun trajet trouvé") ? "présent" : "ABSENT (remplacé par le bloc alerte)"}` });
  });

  test("WEB-RCH-10 · l'état vide dû aux filtres", async ({ navigateurVisiteur }) => {
    const { page } = await navigateurVisiteur();
    await ouvrirLaRecherche(page);
    await expect.poll(async () => (await ordreDesCartes(page)).length, { timeout: 30_000 }).toBeGreaterThan(0);
    // 30 kg : aucun trajet du seed n'a la capacité → vide « à cause des filtres ».
    await curseurPoids(page).fill("30");
    await expect(page.getByText("Aucun résultat ne correspond à tes filtres. Retires-en pour voir plus de trajets.")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Aucun trajet trouvé")).toBeVisible();
    await page.getByRole("button", { name: "Tout effacer" }).filter({ visible: true }).first().click();
    await expect.poll(async () => (await ordreDesCartes(page)).length, { timeout: 30_000 }).toBeGreaterThan(0);
  });

  test("WEB-RCH-11 · l'état d'erreur, et « Réessayer » quand le service revient", async ({ navigateurVisiteur }) => {
    const { page } = await navigateurVisiteur();
    // Le trip-service « tombe » : la recherche n'aboutit plus (coupée au niveau du navigateur).
    await page.route("**/trips/search**", (route) => route.abort("connectionrefused"));
    await ouvrirLaRecherche(page);
    await expect(page.getByText("Une erreur est survenue")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Impossible de charger les trajets. Vérifie ta connexion et réessaie.")).toBeVisible();
    const texte = await texteDe(page);
    expect(texte, "jamais une trace technique").not.toMatch(/TypeError|AxiosError|ECONNREFUSED|stack|at .*\.js/);
    // Le service revient : « Réessayer » recharge.
    await page.unroute("**/trips/search**");
    await page.getByRole("button", { name: "Réessayer" }).click();
    await expect.poll(async () => (await ordreDesCartes(page)).length, { timeout: 30_000 }).toBeGreaterThan(0);
    await expect(page.getByText("Une erreur est survenue")).toHaveCount(0);
  });

  test("WEB-RCH-12 · la page publique d'un trajet", async ({ navigateurVisiteur, jeuEssai }) => {
    test.setTimeout(3 * 60_000);
    const { page, contexte } = await navigateurVisiteur();
    const id = jeuEssai.trajet("bzv-perkg");
    await ouvrirLaRecherche(page, { from: "Paris", to: "Brazzaville" });
    await carte(page, id).click();
    await expect(page).toHaveURL(new RegExp(`/fr/trips/${id}`), { timeout: 30_000 });
    await expect(page.getByText("Trajet proposé par Thomas N.")).toBeVisible({ timeout: 60_000 });
    await page.waitForLoadState("networkidle").catch(() => undefined);
    // (`innerText` rend les intertitres en capitales CSS : comparaison sans casse.)
    const texte = await texteDe(page);
    const minuscule = texte.toLowerCase();

    // Le MONTANT de l'estimation n'est plus écrit en dur : **D81** facture au
    // poids plancher (un colis de 2 kg est facturé 2,3 kg), et ce plancher est
    // un paramètre de plateforme (D62) qui peut bouger sans toucher au code.
    // On lit donc le total de l'API et on exige le MÊME à l'écran — c'est la
    // seule forme qui ne périme pas au prochain réglage.
    const { trips: pourDeuxKg } = await rechercherParApi(contexte, { from: "Paris", to: "Brazzaville", weightKg: 2 });
    const total = pourDeuxKg.find((t) => t.id === id)?.totalForWeight;
    expect(total, "total API pour 2 kg").toBeGreaterThan(0);
    expect(texte.replace(/\u00a0|\u202f/g, " ")).toContain(
      `${(total ?? 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
    );
    for (const attendu of [
      "Avion", "Membre depuis",
      "Ce que tu peux envoyer avec Thomas", "Prix au kilo", "11,50 €/kg", "Disponible", "23 kg",
      "Bagage entier — forfait", "Bagage en soute 23 kg", "230,00 €",
      "Estimation pour un colis de 2 kg", "tout compris (transport + service Yamba)", "Le prix définitif est fixé à la réservation.",
      // D81 — le plancher est passé en KILOS : « 8 € minimum » dépendait du prix au kilo du trajet ; « facturé 2,3 kg minimum » est la règle réelle.
      "Colis léger (enveloppe, passeport, lunettes…) : facturé 2,3 kg minimum, quel que soit son poids.",
      "Lieux de remise & livraison", "Remise", "Livraison",
      "Politique d'annulation", "Remboursement intégral jusqu'à 48 h avant le départ",
      "Moins de 48 h avant le départ : remboursement partiel (une retenue est reversée au Voyageur)",
      "Après la remise du colis : plus d'annulation possible, seul le litige",
      "Objets interdits", "Substances illicites, armes, espèces, animaux vivants, matières dangereuses ou inflammables, contrefaçons.",
    ]) {
      expect(minuscule, `« ${attendu} »`).toContain(attendu.toLowerCase());
    }
    for (const famille of ["Documents & papiers", "Vêtements & textile", "Alimentaire sec & scellé", "Électronique & appareils", "Cosmétiques & soins", "Pièces & outillage", "Jouets & puériculture", "Accessoires & divers"]) {
      expect(texte, `famille « ${famille} »`).toContain(famille);
    }
    // Le statut de chaque famille est porté par une infobulle (`title`) et le style (barré, puce
    // « +20 % ») — pas par un texte « Accepté » / « Refusé » (écart de formulation, à trancher).
    await expect(page.locator('[title="Refusé par le Voyageur"]').filter({ hasText: "Alimentaire sec & scellé" })).toHaveCount(1);
    await expect(page.locator('[title="Supplément de 20 % (risque)"]').filter({ hasText: "Électronique & appareils" })).toHaveCount(1);
    expect(await page.locator('[title="Accepté"]').count(), "six familles acceptées").toBe(6);
    // « Vol direct » n'apparaît que si le trajet porte `flightType` ; le CO₂ évité que si le trajet
    // porte des coordonnées : le seed n'a ni l'un ni l'autre (constats, pas des anomalies).
    test.info().annotations.push({ type: "constat", description: `« Vol direct » ${/vol direct/i.test(texte) ? "présent" : "absent (flightType non posé par le seed)"} ; CO₂ ${/CO₂/.test(texte) ? "présent" : "absent (pas de coordonnées dans le seed)"} ; « Discuter avec Thomas · Bientôt disponible » ${/Discuter avec Thomas/.test(texte) ? "présent" : "absent"}` });
    await expect(page.getByRole("button", { name: /^Réserver/ }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Signaler cette annonce" }).or(page.getByRole("link", { name: "Signaler cette annonce" })).first()).toBeVisible();
    expect(texte, "le vestige « Réservation bientôt disponible »").not.toContain("Réservation bientôt disponible");
    expect(texte).not.toContain("Le système de réservation sera lancé très prochainement.");

    // Avec un poids mémorisé (3 kg) : l'estimation et le CO₂ suivent le colis.
    await page.evaluate(() => window.localStorage.setItem("yamba.search.weightKg", "3"));
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText("Estimation pour ton colis de 3 kg (poids de ta recherche)")).toBeVisible({ timeout: 60_000 });
    // 3 × 11,50 = 34,50 + 12 % (4,14) = 38,64 €
    await expect(page.getByText(/≈ 38,64\s*€/).first()).toBeVisible();
  });

  test("WEB-RCH-13 · le compteur de vues : une vue par visiteur et par jour", async ({ navigateurVisiteur, navigateurConnecte, jeuEssai }) => {
    test.setTimeout(3 * 60_000);
    const id = jeuEssai.trajet("bzv-perkg");
    const { page, contexte } = await navigateurVisiteur();
    const vues = async () => (await rechercherParApi(contexte, { from: "Paris", to: "Brazzaville" })).trips.find((t) => t.id === id)?.viewsCount ?? 0;
    const avant = await vues();
    await page.goto(`/fr/trips/${id}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Trajet proposé par Thomas N.")).toBeVisible({ timeout: 60_000 });
    for (let i = 0; i < 5; i += 1) {
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByText("Trajet proposé par Thomas N.")).toBeVisible({ timeout: 60_000 });
    }
    const apres = await vues();
    // Ce visiteur (même empreinte que les fiches précédentes du chapitre) ne compte qu'une fois.
    expect(apres - avant, "six ouvertures, au plus une vue de plus").toBeLessThanOrEqual(1);
    expect(apres, "au moins une vue enregistrée").toBeGreaterThanOrEqual(1);
    // Un autre visiteur (membre connecté) : une vue de plus, une seule.
    const aminata = await navigateurConnecte("aminata", { parEcran: true });
    await aminata.page.goto(`/fr/trips/${id}`, { waitUntil: "domcontentloaded" });
    await expect(aminata.page.getByText("Trajet proposé par Thomas N.")).toBeVisible({ timeout: 60_000 });
    await aminata.page.reload({ waitUntil: "domcontentloaded" });
    await expect(aminata.page.getByText("Trajet proposé par Thomas N.")).toBeVisible({ timeout: 60_000 });
    await expect.poll(vues, { timeout: 15_000 }).toBe(apres + 1);
    // REMISE À NIVEAU DU 28/11/2026 — la carte n'affiche PLUS « n vues » à
    // partir de 1. **D100** a aligné le site sur le téléphone, qui avait
    // raison : en dessous d'un seuil (`MIN_SHOWN_VIEWS`, `trip-signals.ts`),
    // afficher le compteur revient à PUBLIER L'IMPOPULARITÉ d'une offre —
    // « 1 vue » dit au visiteur que personne ne regarde ce trajet.
    //
    // Ce que ce scénario prouve — une vue par visiteur et par jour — reste
    // vérifié ci-dessus, PAR L'API. Ici on vérifie la règle d'affichage :
    // sous le seuil, la carte se tait.
    await ouvrirLaRecherche(page, { from: "Paris", to: "Brazzaville" });
    const texteCarte = (await carte(page, id).innerText()).replace(/\u00a0|\u202f/g, " ");
    expect(apres + 1, "le seed reste très en dessous du seuil d'affichage").toBeLessThan(15);
    expect(texteCarte, "sous le seuil, aucun compteur de vues").not.toMatch(/\d+\s*vues?/);
  });

  test("WEB-RCH-14 · un trajet annulé répond « introuvable », sans rien révéler", async ({ navigateurConnecte, navigateurVisiteur }) => {
    const josephine = await navigateurConnecte("josephine", { parEcran: true });
    const r = await josephine.contexte.request.post(`${api()}/trips`, {
      data: {
        transportMode: "PLANE", flightType: "DIRECT", tripType: "ONE_WAY",
        originCity: "Bruxelles", originCountryCode: "BE", destinationCity: "Kinshasa", destinationCountryCode: "CD",
        departureAt: new Date(Date.now() + 25 * 86_400_000).toISOString(), arrivalAt: new Date(Date.now() + 26 * 86_400_000).toISOString(),
        pricePerKgCents: 1150, capacityKg: 23,
        pickupLocations: [{ kind: "AIRPORT", flexibility: "EXACT", details: "Zaventem" }], deliveryLocations: [{ kind: "AIRPORT", flexibility: "EXACT", details: "N'djili" }],
        publish: true,
      },
    });
    expect(r.status()).toBe(201);
    const id = ((await r.json()) as { trip: { id: string } }).trip.id;
    const { page } = await navigateurVisiteur();
    await page.goto(`/fr/trips/${id}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Trajet proposé par Joséphine I.")).toBeVisible({ timeout: 60_000 });

    expect((await josephine.contexte.request.post(`${api()}/trips/${id}/cancel`)).ok()).toBe(true);
    await page.goto(`/fr/trips/${id}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Trajet introuvable")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Ce trajet n'existe pas ou n'est plus disponible.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Retour à la recherche" }).or(page.getByRole("button", { name: "Retour à la recherche" })).first()).toBeVisible();
    const texte = await texteDe(page);
    expect(texte, "rien ne révèle l'existence ni la cause").not.toMatch(/annulé|masqué|équipe|Yamba a/i);
    expect((await josephine.contexte.request.get(`${api()}/trips/${id}/public`)).status(), "l'API publique répond 404").toBe(404);
  });

  test("WEB-RCH-15 · le trajet d'un compte suspendu disparaît de la recherche (lecture seule)", async ({ navigateurVisiteur, navigateurAdmin, jeuEssai }) => {
    test.setTimeout(4 * 60_000);
    const idYul = jeuEssai.trajet("yul");
    const idMarc = jeuEssai.membre("marc");
    const apiAdmin = adresseDeLApiAdmin();
    const admin = await navigateurAdmin("mediateur");
    const motif = "Recette WEB-RCH-15 : suspension de contrôle, levée par la même fiche.";
    const { page, contexte } = await navigateurVisiteur();
    await ouvrirLaRecherche(page, { from: "Paris", to: "Montréal" });
    await expect(carte(page, idYul), "avant : le trajet de Marc est là").toBeVisible({ timeout: 30_000 });

    const suspension = await admin.contexte.request.post(`${apiAdmin}/admin/users/${idMarc}/suspension`, { data: { level: "SUSPENDED", category: "OTHER", reason: motif } });
    expect(suspension.status(), `POST /admin/users/:id/suspension → ${await suspension.text()}`).toBe(200);
    try {
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(carte(page, idYul), "après : plus aucun trajet de Marc").toHaveCount(0, { timeout: 30_000 });
      expect((await rechercherParApi(contexte, { from: "Paris", to: "Montréal" })).trips.map((t) => t.id)).not.toContain(idYul);
      // La sanction agit par LECTURE : en base, le trajet n'est ni annulé ni masqué.
      const fiche = await admin.contexte.request.get(`${apiAdmin}/admin/trips/${idYul}`);
      expect(fiche.ok(), "GET /admin/trips/:id").toBe(true);
      const corps = JSON.stringify(await fiche.json());
      expect(corps).toContain('"status":"PUBLISHED"');
      expect(corps).not.toMatch(/"hiddenByAdminAt":"\d/);
    } finally {
      const levee = await admin.contexte.request.delete(`${apiAdmin}/admin/users/${idMarc}/suspension`, { data: { reason: motif } });
      if (levee.status() !== 200) throw new Error(`Suspension de Marc NON levée (${levee.status()} ${await levee.text()}) : la lever à la main.`);
    }
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(carte(page, idYul), "levée : le trajet revient").toBeVisible({ timeout: 30_000 });
  });
});
