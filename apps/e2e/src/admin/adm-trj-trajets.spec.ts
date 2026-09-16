/**
 * adm-trj-trajets.spec.ts — cahier 02-ADMIN, § 5.7 « Trajets : liste, fiche et masquage » (ADM-TRJ-1 à 5)
 * =======================================================================================================
 * Le masquage agit PAR LECTURE (D57) : `Trip.hiddenByAdminAt` est lu par la recherche, la page publique et la création
 * de réservation ; le statut du trajet ne bouge jamais. Chaque fiche prouve l'ÉCRAN (liste, fiche, carte Masquage), le
 * SERVEUR (journal, base, email) et l'EFFET CÔTÉ PUBLIC ET MEMBRE (appels réels, sans et avec session).
 *
 * Trois fiches s'ajoutent au cahier, écrites pour des anomalies MESURÉES avant la première ligne :
 *  - ANO-ADM-15 : tout terme saisi partait brut dans une regex Mongo — « ( » faisait tomber la recherche PUBLIQUE (500),
 *    « . » rendait les 41 trajets ;
 *  - ANO-ADM-17 : proposer de masquer un trajet déjà masqué était accepté, et la proposition ressurgissait au rétablissement ;
 *  - deux « Masquer » simultanés écrivaient deux lignes et deux emails (amélioration : écriture conditionnelle).
 * ANO-ADM-16 (« billet à vérifier » sur des trajets partis) est prouvée dans ADM-TRJ-1, ANO-ADM-18 (email sans lien)
 * dans ADM-TRJ-4.
 *
 * Sécurité du jeu d'essai : un trajet masqué casse les chapitres suivants — tout masquage est levé en `finally`, et le
 * trajet posé pour ADM-TRJ-5 est supprimé.
 */
import { test, expect, type NavigateurAdmin } from "../fixtures/yamba";
import { JeuEssai } from "../fixtures/jeu-essai";
import { COMPTES } from "../fixtures/comptes";
import { adresseDeLApi, adresseDeLApiAdmin, adresseDuBackOffice } from "../fixtures/adresses";
import { lireLeJournal, type LigneDuJournal } from "../pages/journal-admin";
import { attendreLeChargement, debutDuScenario, lireCoteServeur } from "../pages/ecran-admin";

const apiAdmin = () => adresseDeLApiAdmin();
const api = () => adresseDeLApi();
const bo = () => adresseDuBackOffice();
type Contexte = NavigateurAdmin["contexte"];
type Page = NavigateurAdmin["page"];

const MOTIF_PROPOSITION = "Annonce suspecte : photos empruntées à un autre profil";
const MOTIF_MASQUAGE = "Recette ADM-TRJ-4 : masquage de contrôle, levé par la même fiche.";
const MOTIF_RETABLISSEMENT = "Recette ADM-TRJ-4 : examen terminé, le trajet est conforme.";

const resume = (ls: LigneDuJournal[]) => ls.map((l) => `${l.action} ${l.targetType} · ${l.targetId}`);
const enc = encodeURIComponent;

/** Un appel (membre, visiteur ou admin) : statut, code d'erreur et message servis. */
async function appel(ctx: Contexte, methode: "GET" | "POST" | "DELETE", url: string, data?: unknown): Promise<{ statut: number; code: string | null; message: string; corps: unknown }> {
  const r = await ctx.request.fetch(url, { method: methode, data, failOnStatusCode: false });
  const corps = (await r.json().catch(() => ({}))) as { message?: string; details?: { code?: string } };
  return { statut: r.status(), code: corps.details?.code ?? null, message: corps.message ?? "", corps };
}

async function trouvable(ctx: Contexte, from: string, to: string, id: string): Promise<boolean> {
  const r = await ctx.request.get(`${api()}/trips/search?from=${enc(from)}&to=${enc(to)}&limit=50`);
  expect(r.ok(), `recherche ${from} → ${to} : ${r.status()}`).toBe(true);
  return ((await r.json()) as { trips: Array<{ id: string }> }).trips.some((t) => t.id === id);
}

type EtatTrajet = { status: string; hiddenByAdminAt: string | null; hideProposedAt: string | null; hideProposedReason: string | null };
function etatTrajet(id: string): EtatTrajet {
  return lireCoteServeur<EtatTrajet>(`
    import prisma from "./packages/libs/prisma";
    (async () => {
      const t = await prisma.trip.findUnique({ where: { id: "${id}" }, select: { status: true, hiddenByAdminAt: true, hideProposedAt: true, hideProposedReason: true } });
      console.log("@@" + JSON.stringify(t));
      process.exit(0);
    })();`);
}

/** Filet de sécurité : le trajet redevient visible et sans proposition (manœuvre consignée, jamais un geste de fiche). */
function remettreVisible(id: string): void {
  lireCoteServeur(`
    import prisma from "./packages/libs/prisma";
    (async () => {
      await prisma.trip.update({ where: { id: "${id}" }, data: { hiddenByAdminAt: null, hiddenReason: null, hiddenByAdminId: null, hideProposedAt: null, hideProposedReason: null, hideProposedByAdminId: null } });
      console.log("@@true");
      process.exit(0);
    })();`);
}

async function ouvrirFiche(page: Page, id: string): Promise<void> {
  await page.goto(`${bo()}/trips/${id}`, { waitUntil: "domcontentloaded" });
  await attendreLeChargement(page);
  await expect(page.getByRole("heading", { name: "Masquage", exact: true })).toBeVisible({ timeout: 60_000 });
}
const carteMasquage = (page: Page) => page.locator("section").filter({ has: page.getByRole("heading", { name: "Masquage", exact: true }) });

test.describe("ADM-TRJ — trajets, fiche et masquage (cahier 02-ADMIN § 5.7)", () => {
  test.describe.configure({ mode: "serial" });
  let trajet = "";

  test.beforeAll(() => {
    const jeu = new JeuEssai();
    jeu.rejouer();
    trajet = jeu.trajet("bzv-upcoming");
  });

  test.afterAll(() => {
    if (trajet) remettreVisible(trajet);
  });

  test("ADM-TRJ-1 · la liste et ses filtres d'URL (+ ANO-ADM-16)", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    const sup = await navigateurAdmin("super");
    const lecteur = await navigateurAdmin("finance");
    const { page } = sup;
    const debut = await debutDuScenario();
    /* 1. Sous-titre. */
    await page.goto(`${bo()}/trips`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Tous les trajets, filtrables. Masquer retire un trajet de la recherche sans l'annuler.", { exact: true })).toBeVisible({ timeout: 60_000 });
    const compteur = page.getByText(/^\d+ affiché\(s\) · \d+ au total$/);
    await expect(compteur).toBeVisible({ timeout: 60_000 });
    /* 2. « Brazzaville » dans le champ : chaque ligne porte la ville. */
    await page.getByPlaceholder("ville ou identifiant").fill("Brazzaville");
    /* `every` sur une liste vide est vrai : on attend une liste NON VIDE (piège payé au premier passage). */
    await expect.poll(async () => { const t = await page.locator("tbody tr a[href^='/trips/']").allInnerTexts(); return t.length > 0 && t.every((x) => /Brazzaville/.test(x)); }, { timeout: 30_000 }).toBe(true);
    const nbBrazza = await page.locator("tbody tr a[href^='/trips/']").count();
    expect(nbBrazza, "au moins un trajet Brazzaville").toBeGreaterThan(0);
    /* 3. Les quatre paramètres d'URL présélectionnent leur filtre. */
    for (const [chemin, controle] of [
      ["/trips?status=PUBLISHED", async () => expect(page.locator("select").first()).toHaveValue("PUBLISHED")],
      ["/trips?hidden=1", async () => expect(page.getByLabel("masqués", { exact: true })).toBeChecked()],
      ["/trips?ticketPending=1", async () => expect(page.getByLabel("billet à vérifier", { exact: true })).toBeChecked()],
      ["/trips?hideProposed=1", async () => expect(page.getByLabel("masquage proposé", { exact: true })).toBeChecked()],
    ] as const) {
      await page.goto(`${bo()}${chemin}`, { waitUntil: "domcontentloaded" });
      await controle();
    }
    /* ANO-ADM-16 — `ticketPending=1` : LE trajet Paris → Brazzaville à J+10, seul (mesuré avant correction : 6 trajets). */
    await page.goto(`${bo()}/trips?ticketPending=1`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("1 affiché(s) · 1 au total", { exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(page.locator(`tbody tr a[href='/trips/${trajet}']`)).toHaveText("Paris → Brazzaville");
    const partis = (await (await sup.contexte.request.get(`${apiAdmin()}/admin/trips?limit=100`)).json()) as { items: Array<{ id: string; departureAt: string | null; ticketVerificationStatus: string }> };
    const expires = partis.items.filter((t) => t.ticketVerificationStatus === "EXPIRED");
    expect(expires.every((t) => !!t.departureAt && new Date(t.departureAt).getTime() < Date.now()), "« expiré » = trajet parti").toBe(true);
    test.info().annotations.push({ type: "constat", description: `ANO-ADM-16 : ${expires.length} trajet(s) parti(s) au billet resté « à vérifier » servis « EXPIRED » ; ticketPending=1 → 1 trajet` });
    /* Amélioration — le terme se lit aussi dans l'URL. */
    await page.goto(`${bo()}/trips?q=Brazzaville`, { waitUntil: "domcontentloaded" });
    await expect(page.getByPlaceholder("ville ou identifiant")).toHaveValue("Brazzaville");
    await expect(page.getByText(`${nbBrazza} affiché(s) · ${nbBrazza} au total`, { exact: true })).toBeVisible({ timeout: 60_000 });
    /* 4. Depuis la fiche de Thomas. */
    const thomas = jeuEssai.membre("thomas");
    await page.goto(`${bo()}/users/${thomas}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("link", { name: "Ouvrir dans Trajets (fiches, masquage)" }).click({ timeout: 60_000 });
    await expect(page).toHaveURL(new RegExp(`/trips\\?carrierId=${thomas}$`), { timeout: 60_000 });
    const pastille = page.locator("span", { hasText: "un seul Voyageur ·" });
    await expect(pastille).toContainText("un seul Voyageur · tous");
    await expect.poll(async () => { const t = await page.locator("tbody tr td:nth-child(3)").allInnerTexts(); return t.length > 0 && t.every((x) => /Thomas Nkounkou/.test(x)); }, { timeout: 30_000 }).toBe(true);
    await pastille.getByRole("button", { name: "tous" }).click();
    await expect(pastille).toHaveCount(0);
    /* 5. Colonnes et libellés. */
    await expect(page.locator("thead th")).toHaveText(["Corridor", "Départ", "Voyageur", "Statut", "Billet", "Deals"]);
    const billets = new Set(await page.locator("tbody tr td:nth-child(5)").allInnerTexts());
    const permis = ["aucun billet", "à vérifier", "vérifié", "rejeté", "expiré (trajet parti)"];
    expect([...billets].filter((b) => !permis.includes(b)), `libellés de la colonne Billet : ${[...billets].join(", ")}`).toEqual([]);
    test.info().annotations.push({ type: "écart documentaire", description: `colonne Billet : « expiré (trajet parti) » s'ajoute (ANO-ADM-16) ; colonne Statut en français (${[...new Set(await page.locator("tbody tr td:nth-child(4)").allInnerTexts())].join(", ")}), code au survol` });
    /* 6. Pagination : le total dépasse la page par l'API (limite 10), jamais de doublon ni de trou. */
    const vus = new Set<string>();
    let curseur: string | null = null;
    let total = 0;
    for (let i = 0; i < 20; i++) {
      const r = (await (await sup.contexte.request.get(`${apiAdmin()}/admin/trips?limit=10${curseur ? `&cursor=${curseur}` : ""}`)).json()) as { items: Array<{ id: string }>; total: number; nextCursor: string | null };
      total = r.total;
      for (const it of r.items) {
        expect(vus.has(it.id), `doublon ${it.id}`).toBe(false);
        vus.add(it.id);
      }
      curseur = r.nextCursor;
      if (!curseur) break;
    }
    expect(vus.size, "pages cumulées = total").toBe(total);
    test.info().annotations.push({ type: "⏭ partiel", description: `« Charger la suite » : ${total} trajets ≤ la page de 50 de l'écran, bouton absent — pagination prouvée par l'API (pages de 10)` });
    /* Journal : la liste n'écrit rien (la fiche de Thomas écrit USER_VIEWED, attendu). */
    const lignes = await lireLeJournal(lecteur.contexte.request, { from: debut, adminUserId: jeuEssai.admin("super").id });
    expect(lignes.filter((l) => l.targetType === "TRIP").map((l) => l.action), "aucune ligne de trajet").toEqual([]);
  });

  test("ANO-ADM-15 · un terme saisi n'est jamais une expression régulière (public, admin, alertes)", async ({ navigateurVisiteur, navigateurConnecte, navigateurAdmin }) => {
    test.setTimeout(4 * 60_000);
    const visiteur = await navigateurVisiteur();
    const sup = await navigateurAdmin("super");
    /* Recherche publique et ses facettes : « ( » faisait 500 ; « . » et « Par.s » trouvaient des trajets. */
    for (const terme of ["(", "[", "(a+)+$"]) {
      expect((await appel(visiteur.contexte, "GET", `${api()}/trips/search?from=${enc(terme)}`)).statut, `recherche publique « ${terme} »`).toBe(200);
      expect((await appel(visiteur.contexte, "GET", `${api()}/trips/search/facets?from=${enc(terme)}`)).statut, `facettes « ${terme} »`).toBe(200);
    }
    const compte = async (terme: string) => ((await (await visiteur.contexte.request.get(`${api()}/trips/search?from=${enc(terme)}`)).json()) as { totalCount: number }).totalCount;
    const paris = await compte("Paris");
    expect(paris, "contre-épreuve : « Paris » trouve des trajets").toBeGreaterThan(0);
    expect(await compte("."), "« . » cherché à la lettre").toBe(0);
    expect(await compte("Par.s"), "« Par.s » ne vaut plus « Paris »").toBe(0);
    /* Admin : liste des trajets. */
    const adm = async (q: string) => appel(sup.contexte, "GET", `${apiAdmin()}/admin/trips?q=${enc(q)}`);
    const parenthese = await adm("(");
    expect(parenthese.statut, "admin « ( »").toBe(200);
    expect((parenthese.corps as { total: number }).total).toBe(0);
    expect(((await adm(".")).corps as { total: number }).total, "admin « . »").toBe(0);
    expect(((await adm("Brazzaville")).corps as { total: number }).total, "contre-épreuve admin").toBeGreaterThan(0);
    await sup.page.goto(`${bo()}/trips?q=${enc("(")}`, { waitUntil: "domcontentloaded" });
    await expect(sup.page.getByText("Aucun trajet.", { exact: true })).toBeVisible({ timeout: 60_000 });
    /* Alertes route (auth-service) : le contrôle de doublon est un `equals` insensible, donc une regex ancrée. */
    const aminata = await navigateurConnecte("aminata");
    const corps = (ville: string) => ({ originCity: ville, originCountry: "France", originCountryCode: "FR", destinationCity: "Brazzaville", destinationCountry: "République du Congo", destinationCountryCode: "CG" });
    const crees: string[] = [];
    try {
      const avecParenthese = await appel(aminata.contexte, "POST", `${api()}/saved-routes`, corps("Paris (Orly)"));
      expect(avecParenthese.statut, `alerte « Paris (Orly) » : ${avecParenthese.statut} ${avecParenthese.message}`).toBe(201);
      crees.push((avecParenthese.corps as { savedRoute: { id: string } }).savedRoute.id);
      const doublon = await appel(aminata.contexte, "POST", `${api()}/saved-routes`, corps("paris (orly)"));
      expect(doublon.code, "le vrai doublon (casse différente) est toujours reconnu").toBe("ROUTE_ALERT_DUPLICATE");
      const piege = await appel(aminata.contexte, "POST", `${api()}/saved-routes`, corps("Paris .Orly."));
      expect(piege.statut, "« Paris .Orly. » n'est pas un doublon de « Paris (Orly) » par regex").toBe(201);
      crees.push((piege.corps as { savedRoute: { id: string } }).savedRoute.id);
    } finally {
      for (const id of crees) await appel(aminata.contexte, "DELETE", `${api()}/saved-routes/${id}`);
    }
  });

  test("ADM-TRJ-2 · ouvrir une fiche trajet", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(5 * 60_000);
    const sup = await navigateurAdmin("super");
    const lecteur = await navigateurAdmin("finance");
    const { page } = sup;
    const debut = await debutDuScenario();
    await ouvrirFiche(page, trajet);
    /* En-tête. */
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Paris → Brazzaville");
    const entete = page.locator("h1 + span");
    await expect(entete).toHaveText(/^\d{1,2} \S+ \d{4}, \d{2}:\d{2} · Avion · Publié$/); // format `dateTime` de l'admin : « 24 sept. 2026, 01:46 »
    await expect(entete.locator("span[title='PLANE']")).toHaveCount(1);
    await expect(entete.locator("span[title='PUBLISHED']")).toHaveCount(1);
    test.info().annotations.push({ type: "écart documentaire", description: `en-tête « ${await entete.innerText()} » : mode et statut en français (le cahier écrit « PLANE · PUBLISHED »), codes au survol` });
    /* Cartes. */
    for (const titre of ["Trajet", "Voyageur", "Documents (1)", "Réservations (5)", "Actions admin sur ce trajet"]) await expect(page.getByRole("heading", { name: titre, exact: true }), `carte « ${titre} »`).toBeVisible();
    const carteTrajet = page.locator("section").filter({ has: page.getByRole("heading", { name: "Trajet", exact: true }) });
    for (const libelle of ["Capacité / réservé", "Créé", "Publié", "Billet"]) await expect(carteTrajet).toContainText(libelle);
    await expect(carteTrajet).toContainText("à vérifier");
    const docs = page.locator("section").filter({ has: page.getByRole("heading", { name: "Documents (1)", exact: true }) });
    await expect(docs).toContainText("Billet"); // § 5.8 (865c93b) — le type du document est traduit, plus « TICKET_PROOF »
    await expect(docs).toContainText("à vérifier"); // § 5.8 — le statut du document est traduit, plus « PENDING »
    /* Réservations : les cinq deals du trajet, statuts et montants. */
    const resa = page.locator("section").filter({ has: page.getByRole("heading", { name: "Réservations (5)", exact: true }) });
    const statuts = (await resa.locator("tbody tr td:nth-child(3)").allInnerTexts()).map((s) => s.trim()).sort();
    expect(statuts).toEqual(["Acceptée", "Annulée", "En attente", "Expirée", "Refusée"]);
    await expect(resa.locator("tbody tr td:nth-child(4)").first()).toContainText(/net/);
    /* « dossier » n'existe que pour un litige ; « argent » ouvre la fiche argent. */
    await expect(resa.getByRole("link", { name: "dossier" }), "aucun litige sur ce trajet : aucun lien « dossier »").toHaveCount(0);
    const accepte = jeuEssai.deal("bzv-accepted").id;
    await resa.locator(`a[href='/deals/${accepte}']`).click();
    await expect(page).toHaveURL(new RegExp(`/deals/${accepte}$`), { timeout: 60_000 });
    await page.waitForLoadState("networkidle").catch(() => undefined);
    /* Journal. */
    const lignes = resume(await lireLeJournal(lecteur.contexte.request, { from: debut, adminUserId: jeuEssai.admin("super").id }));
    expect(lignes, "TRIP_VIEWED").toContain(`TRIP_VIEWED TRIP · ${trajet}`);
    await expect.poll(async () => resume(await lireLeJournal(lecteur.contexte.request, { from: debut, adminUserId: jeuEssai.admin("super").id })), { timeout: 30_000 }).toContain(`DEAL_MONEY_VIEWED BOOKING · ${accepte}`);
  });

  test("ADM-TRJ-3 · proposer un masquage (Support)", async ({ navigateurAdmin, navigateurVisiteur, jeuEssai }) => {
    test.setTimeout(5 * 60_000);
    const support = await navigateurAdmin("support");
    const lecteur = await navigateurAdmin("finance");
    const visiteur = await navigateurVisiteur();
    const { page } = support;
    const debut = await debutDuScenario();
    await ouvrirFiche(page, trajet);
    const carte = carteMasquage(page);
    /* 2. Texte d'explication. */
    await expect(carte).toContainText("Retire le trajet de la recherche et de sa page publique, sans l'annuler. Réservations en cours préservées, Voyageur prévenu.");
    await expect(carte.getByRole("button", { name: "Masquer" }), "le Support ne masque pas").toHaveCount(0);
    /* 3. Motif trop court : bouton inactif (compteur visible). */
    await carte.locator("textarea").fill("trop court");
    await expect(carte.getByRole("button", { name: "Proposer" })).toBeDisabled();
    await expect(carte.getByText("10 / 20", { exact: true })).toBeVisible();
    /* 4. Le motif du cahier. */
    await carte.locator("textarea").fill(MOTIF_PROPOSITION);
    await carte.getByRole("button", { name: "Proposer" }).click();
    await expect(carte.getByRole("status")).toHaveText("Masquage proposé : un Médiateur ou un super administrateur décidera. Le trajet reste visible d'ici là.", { timeout: 30_000 });
    await expect(carte.locator("textarea"), "le motif est vidé après le geste").toHaveValue("");
    test.info().annotations.push({ type: "écart documentaire", description: "« Fait. » remplacé par un message qui nomme le geste et ses suites" });
    /* 5. Bandeau, liste, tuile. */
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText(new RegExp(`^Masquage proposé par .+ le \\d{1,2} \\S+ \\d{4}, \\d{2}:\\d{2} : ${MOTIF_PROPOSITION}$`))).toBeVisible({ timeout: 60_000 });
    await page.goto(`${bo()}/trips?hideProposed=1`, { waitUntil: "domcontentloaded" });
    const ligne = page.locator("tbody tr").filter({ has: page.locator(`a[href='/trips/${trajet}']`) });
    await expect(ligne.getByText("masquage proposé", { exact: true })).toBeVisible({ timeout: 60_000 });
    const kpis = (await (await (await navigateurAdmin("super")).contexte.request.get(`${apiAdmin()}/admin/kpis`)).json()) as Record<string, number>;
    expect(kpis.hideProposals, "tuile « Masquages proposés »").toBe(1);
    /* 6. Rien n'a changé pour le public. */
    expect(await trouvable(visiteur.contexte, "Paris", "Brazzaville", trajet), "toujours dans la recherche").toBe(true);
    expect((await appel(visiteur.contexte, "GET", `${api()}/trips/${trajet}/public`)).statut, "page publique toujours 200").toBe(200);
    expect(etatTrajet(trajet).hiddenByAdminAt, "pas masqué en base").toBeNull();
    /* Journal. */
    const lignes = (await lireLeJournal(lecteur.contexte.request, { from: debut, adminUserId: jeuEssai.admin("support").id })).filter((l) => l.action === "TRIP_HIDE_PROPOSED");
    expect(resume(lignes)).toEqual([`TRIP_HIDE_PROPOSED TRIP · ${trajet}`]);
    expect(lignes[0].after).toEqual({ reason: MOTIF_PROPOSITION });
    expect(lignes[0].before ?? null, "première proposition : pas de « avant »").toBeNull();
  });

  test("ADM-TRJ-4 · masquer et rétablir (Médiateur) (+ ANO-ADM-17, ANO-ADM-18)", async ({ navigateurAdmin, navigateurVisiteur, navigateurConnecte, mailpit, jeuEssai }) => {
    test.setTimeout(8 * 60_000);
    const med = await navigateurAdmin("mediateur");
    const support = await navigateurAdmin("support");
    const lecteur = await navigateurAdmin("finance");
    const visiteur = await navigateurVisiteur();
    const { page } = med;
    const courrielThomas = COMPTES.thomas.email;
    const avantMasque = await mailpit.compter({ pour: courrielThomas, sujet: "est masqué" });
    const avantVisible = await mailpit.compter({ pour: courrielThomas, sujet: "est de nouveau visible" });
    const debut = await debutDuScenario();
    try {
      /* 1-2. La fiche porte la proposition du Support ; motif, « Masquer ». */
      await ouvrirFiche(page, trajet);
      await expect(page.getByText(/^Masquage proposé par /)).toBeVisible();
      const carte = carteMasquage(page);
      await expect(carte.locator("textarea"), "le motif ne reprend pas celui de la proposition").toHaveValue("");
      await expect(carte).toContainText("1 réservation(s) en cours sur ce trajet : elles continuent normalement.");
      await carte.locator("textarea").fill(MOTIF_MASQUAGE);
      await carte.getByRole("button", { name: "Masquer" }).click();
      await expect(carte.getByRole("status")).toHaveText("Trajet masqué : retiré de la recherche et de sa page publique, Voyageur prévenu par email. 1 réservation(s) en cours continue(nt).", { timeout: 30_000 });
      await expect(page.getByText("masqué par Yamba", { exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(new RegExp(`^Masqué le \\d{1,2} \\S+ \\d{4}, \\d{2}:\\d{2} par .+ — motif : ${MOTIF_MASQUAGE}$`))).toBeVisible();
      await expect(page.getByText(/^Masquage proposé par /), "la proposition ambre a disparu").toHaveCount(0);
      /* 3. Recliquer « Masquer » : le bouton n'existe plus ; l'appel direct répond 400. */
      await expect(carte.getByRole("button", { name: "Masquer" })).toHaveCount(0);
      const encore = await appel(med.contexte, "POST", `${apiAdmin()}/admin/trips/${trajet}/hide`, { reason: MOTIF_MASQUAGE });
      expect([encore.statut, encore.message, encore.code]).toEqual([400, "This trip is already hidden.", "TRIP_ALREADY_HIDDEN"]);
      /* ANO-ADM-17 — proposer sur un trajet masqué : refus, rien n'est écrit. */
      const proposition = await appel(support.contexte, "POST", `${apiAdmin()}/admin/trips/${trajet}/hide/propose`, { reason: MOTIF_PROPOSITION });
      expect([proposition.statut, proposition.code], "ANO-ADM-17 : proposer sur un trajet masqué").toEqual([400, "TRIP_ALREADY_HIDDEN"]);
      expect(etatTrajet(trajet).hideProposedAt, "aucune proposition fantôme en base").toBeNull();
      /* 4. Public : absent de la recherche, page publique 404. */
      expect(await trouvable(visiteur.contexte, "Paris", "Brazzaville", trajet), "absent de la recherche").toBe(false);
      expect((await appel(visiteur.contexte, "GET", `${api()}/trips/${trajet}/public`)).statut, "page publique").toBe(404);
      /* 5. Le Voyageur garde son trajet, bandeau rouge, statut inchangé. */
      const thomas = await navigateurConnecte("thomas");
      await thomas.page.goto(`/fr/dashboard/trips/${trajet}`, { waitUntil: "domcontentloaded" });
      await expect(thomas.page.getByText(/masqué par Yamba/i).first()).toBeVisible({ timeout: 60_000 });
      expect(etatTrajet(trajet).status, "statut inchangé").toBe("PUBLISHED");
      /* 6. Réserver par appel direct : TRIP_NOT_BOOKABLE ; le deal accepté continue. */
      const aminata = await navigateurConnecte("aminata");
      const intention = await appel(aminata.contexte, "POST", `${api()}/deals/payment-intents`, { tripId: trajet, product: "PARCEL", family: "CLOTHES_TEXTILE", sizeClass: "S", weightKg: 2, protection: "BASIC", declaredValueCents: 6000, expectedTotalCents: 1 });
      expect(intention.code, `réserver un trajet masqué : ${intention.statut} ${intention.code}`).toBe("TRIP_NOT_BOOKABLE");
      const accepte = jeuEssai.deal("bzv-accepted");
      const cleExpediteur = (Object.keys(COMPTES) as Array<keyof typeof COMPTES>).find((k) => COMPTES[k].email === accepte.expediteur)!;
      const expediteur = await navigateurConnecte(cleExpediteur);
      expect((await appel(expediteur.contexte, "GET", `${api()}/deals/${accepte.id}`)).statut, "le deal accepté reste lisible par son Expéditeur").toBe(200);
      /* 7. ✉ Motif générique, lien vers le trajet (ANO-ADM-18), adresse du support, jamais le motif interne. */
      const mail = await mailpit.attendreEmail({ pour: courrielThomas, sujet: "Paris → Brazzaville est masqué" }, 60_000);
      expect(await mailpit.compter({ pour: courrielThomas, sujet: "est masqué" }), "un seul email").toBe(avantMasque + 1);
      expect(mail.texte).toContain("il fait l'objet d'un examen par notre équipe");
      expect(mail.texte).not.toContain(MOTIF_MASQUAGE);
      expect(mail.texte).not.toContain("Recette ADM-TRJ-4");
      expect(mail.html, "ANO-ADM-18 : le bouton mène au trajet").toContain(`/trips/${trajet}`);
      expect(mail.texte).toContain("support@yamba.app");
      /* 8. Rétablir, avec SON motif. */
      await page.reload({ waitUntil: "domcontentloaded" });
      await attendreLeChargement(page);
      const carte2 = carteMasquage(page);
      await expect(carte2.locator("textarea")).toHaveAttribute("placeholder", /Motif du rétablissement/);
      await carte2.locator("textarea").fill(MOTIF_RETABLISSEMENT);
      await carte2.getByRole("button", { name: "Rétablir" }).click();
      await expect(carte2.getByRole("status")).toHaveText("Trajet rétabli : de nouveau dans la recherche et sur sa page publique, Voyageur prévenu par email.", { timeout: 30_000 });
      await expect.poll(() => trouvable(visiteur.contexte, "Paris", "Brazzaville", trajet), { timeout: 30_000, message: "de retour dans la recherche" }).toBe(true);
      expect((await appel(visiteur.contexte, "GET", `${api()}/trips/${trajet}/public`)).statut, "page publique").toBe(200);
      expect(etatTrajet(trajet).hideProposedAt, "ANO-ADM-17 : aucune proposition ne ressurgit").toBeNull();
      await expect(page.getByText(/^Masquage proposé par /)).toHaveCount(0);
      /* 9. Recliquer « Rétablir ». */
      const encore2 = await appel(med.contexte, "DELETE", `${apiAdmin()}/admin/trips/${trajet}/hide`, { reason: MOTIF_RETABLISSEMENT });
      expect([encore2.statut, encore2.message, encore2.code]).toEqual([400, "This trip is not hidden.", "TRIP_NOT_HIDDEN"]);
      await mailpit.attendreEmail({ pour: courrielThomas, sujet: "Paris → Brazzaville est de nouveau visible" }, 60_000);
      expect(await mailpit.compter({ pour: courrielThomas, sujet: "est de nouveau visible" })).toBe(avantVisible + 1);
      /* Journal : chaque ligne porte SON motif (le rétablissement ne recopie plus celui du masquage). */
      const lignes = (await lireLeJournal(lecteur.contexte.request, { from: debut, adminUserId: jeuEssai.admin("mediateur").id })).filter((l) => /TRIP_(HIDDEN|UNHIDDEN)/.test(l.action));
      expect(resume(lignes)).toEqual([`TRIP_HIDDEN TRIP · ${trajet}`, `TRIP_UNHIDDEN TRIP · ${trajet}`]);
      expect(lignes[0].after).toEqual({ reason: MOTIF_MASQUAGE });
      expect(lignes[1].after).toEqual({ reason: MOTIF_RETABLISSEMENT });
      const refus = (await lireLeJournal(lecteur.contexte.request, { from: debut, adminUserId: jeuEssai.admin("support").id })).filter((l) => l.targetId === trajet);
      expect(refus.map((l) => l.action), "la proposition refusée n'écrit rien").toEqual([]);
    } finally {
      if (etatTrajet(trajet).hiddenByAdminAt) await appel(med.contexte, "DELETE", `${apiAdmin()}/admin/trips/${trajet}/hide`, { reason: MOTIF_RETABLISSEMENT });
    }
  });

  test("ADM-TRJ-4 bis · deux « Masquer » simultanés : un masquage, une ligne, un email", async ({ navigateurAdmin, mailpit, jeuEssai }) => {
    test.setTimeout(4 * 60_000);
    const med = await navigateurAdmin("mediateur");
    const sup = await navigateurAdmin("super");
    const lecteur = await navigateurAdmin("finance");
    const courrielThomas = COMPTES.thomas.email;
    const avant = await mailpit.compter({ pour: courrielThomas, sujet: "est masqué" });
    const debut = await debutDuScenario();
    try {
      const motif = "Recette ADM-TRJ-4 bis : deux masquages simultanés, un seul doit passer.";
      const [a, b] = await Promise.all([
        appel(med.contexte, "POST", `${apiAdmin()}/admin/trips/${trajet}/hide`, { reason: motif }),
        appel(sup.contexte, "POST", `${apiAdmin()}/admin/trips/${trajet}/hide`, { reason: motif }),
      ]);
      const statuts = [a.statut, b.statut].sort();
      test.info().annotations.push({ type: "constat", description: `réponses simultanées : ${a.statut} ${a.code ?? ""} / ${b.statut} ${b.code ?? ""}` });
      expect(statuts, "un 200, un 400").toEqual([200, 400]);
      expect([a.code, b.code]).toContain("TRIP_ALREADY_HIDDEN");
      const lignes = (await lireLeJournal(lecteur.contexte.request, { from: debut })).filter((l) => l.action === "TRIP_HIDDEN" && l.targetId === trajet);
      expect(lignes, "une seule ligne TRIP_HIDDEN").toHaveLength(1);
      await mailpit.attendreEmail({ pour: courrielThomas, sujet: "Paris → Brazzaville est masqué" }, 60_000);
      await new Promise((r) => setTimeout(r, 6_000));
      expect(await mailpit.compter({ pour: courrielThomas, sujet: "est masqué" }), "un seul email").toBe(avant + 1);
      void jeuEssai;
    } finally {
      if (etatTrajet(trajet).hiddenByAdminAt) {
        const r = await appel(med.contexte, "DELETE", `${apiAdmin()}/admin/trips/${trajet}/hide`, { reason: "Recette ADM-TRJ-4 bis : levée du masquage de contrôle." });
        expect(r.statut, "levée").toBe(200);
      }
    }
  });

  test("ADM-TRJ-5 · personne ne masque son propre trajet", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(4 * 60_000);
    const med = await navigateurAdmin("mediateur");
    const lecteur = await navigateurAdmin("finance");
    const idMediateur = jeuEssai.admin("mediateur").id;
    /* Précondition du cahier : le compte Médiateur est Voyageur d'un trajet publié. Le front exige un profil Voyageur
       complet (Stripe) : le trajet est posé en base, copie de bzv-upcoming (manœuvre consignée, supprimé en finally). */
    const sien = jeuEssai.manoeuvre("ADM-TRJ-5 : un trajet publié dont le Voyageur est le compte Médiateur", `
      import prisma from "./packages/libs/prisma";
      (async () => {
        const { id, userId, createdAt, updatedAt, ...modele } = (await prisma.trip.findUnique({ where: { id: "${trajet}" } })) as Record<string, unknown>;
        void id; void userId; void createdAt; void updatedAt;
        const t = await prisma.trip.create({ data: { ...(modele as object), userId: "${idMediateur}", reservedKg: 0, hiddenByAdminAt: null, hideProposedAt: null } as never });
        console.log("@@" + t.id);
        process.exit(0);
      })();`).trim().split("\n").filter((l) => l.startsWith("@@")).pop()!.slice(2);
    try {
      const debut = await debutDuScenario();
      await ouvrirFiche(med.page, sien);
      const carte = carteMasquage(med.page);
      /* Amélioration : la carte DIT pourquoi, au lieu de « Ton profil ne propose ni n'exécute de masquage ». */
      await expect(carte).toContainText("C'est ton propre trajet : aucune action de masquage n'est possible (conflit d'intérêts).");
      await expect(carte.locator("textarea")).toHaveCount(0);
      await expect(carte.getByRole("button")).toHaveCount(0);
      test.info().annotations.push({ type: "écart documentaire", description: "le cahier attend la carte « Masquage » ABSENTE ; elle est présente et explique le conflit d'intérêts, sans champ ni bouton" });
      for (const [methode, chemin] of [["POST", "hide"], ["POST", "hide/propose"], ["DELETE", "hide"]] as const) {
        const r = await appel(med.contexte, methode, `${apiAdmin()}/admin/trips/${sien}/${chemin}`, { reason: "Recette ADM-TRJ-5 : tentative sur son propre trajet." });
        expect([r.statut, r.message, r.code], `${methode} ${chemin}`).toEqual([403, "You cannot act on your own trip.", "ADMIN_IS_OWNER"]);
      }
      const lignes = (await lireLeJournal(lecteur.contexte.request, { from: debut, adminUserId: idMediateur })).filter((l) => l.targetId === sien);
      expect(lignes.map((l) => l.action).filter((a) => a !== "TRIP_VIEWED"), "aucune ligne de masquage").toEqual([]);
    } finally {
      jeuEssai.manoeuvre("ADM-TRJ-5 : suppression du trajet posé", `
        import prisma from "./packages/libs/prisma";
        (async () => { await prisma.trip.delete({ where: { id: "${sien}" } }); console.log("@@true"); process.exit(0); })();`);
    }
  });
});
