/**
 * adm-pil-pilotage.spec.ts — cahier 02-ADMIN, § 5.17 « Pilotage et drilldown » (ADM-PIL-1 à 4) + fiches ajoutées
 * ================================================================================================================
 * Le pilotage est une LECTURE du même argent que le rapport mensuel (§ 5.16) : « mêmes règles de datation ». Il se juge à
 * trois invariants que ses courbes ne montrent pas :
 *  - **courbe = rapport** : le point mensuel de chaque mesure d'argent vaut le mois du rapport, au centime ;
 *  - **point = drilldown** : la somme des éléments d'un point vaut le point (quand la liste n'est pas tronquée) ;
 *  - **fenêtre = fenêtre** : un corridor n'apparaît sur 7 jours que s'il a eu de l'activité dans ces 7 jours.
 * Les compteurs Redis (vues, recherches) sont nourris par de VRAIES requêtes publiques ; un visiteur neuf est un contexte
 * HTTP avec son propre User-Agent (la déduplication des vues est par visiteur et par jour). Le cache de 60 s est attendu,
 * jamais contourné. Jeu d'essai rejoué avant chaque fiche ; manœuvres base et Redis consignées et défaites.
 */
import { request as playwrightRequest } from "@playwright/test";
import { test, expect, type NavigateurAdmin } from "../fixtures/yamba";
import { JeuEssai } from "../fixtures/jeu-essai";
import { adresseDeLApi, adresseDeLApiAdmin, adresseDuBackOffice } from "../fixtures/adresses";
import { lireLeJournal } from "../pages/journal-admin";
import { attendreLeChargement, debutDuScenario, lireCoteServeur } from "../pages/ecran-admin";

const api = () => adresseDeLApiAdmin();
const bo = () => adresseDuBackOffice();
type Contexte = NavigateurAdmin["contexte"];
type Page = NavigateurAdmin["page"];

type Finance = { currencyCode: string; capturedCents: number; refundedCents: number; paidOutCents: number; revenueCents: number; retentionCents: number };
type Point = { period: string; periodStart: string; signups: number; tripsPublished: number; requests: number; accepted: number; delivered: number; completed: number; cancelled: number; disputes: number; finance: Finance[] };
type Series = { granularity: string; from: string; to: string; points: Point[]; totals: { users: number; carriersReady: number; tripsPublishedOpen: number }; generatedAt: string; cached: boolean };
type Corridor = { key: string; originCity: string; destinationCity: string; tripsPublished: number; requests: number; accepted: number; disputes: number; views: number; searches: number; searchesNoResult: number };
type Corridors = { periodDays: number; items: Corridor[]; cached: boolean };
type Drill = { metric: string; period: string; periodStart: string; periodEnd: string; items: Array<{ kind: string; id: string; amountCents: number | null; currencyCode: string | null; at: string }>; total: number; truncated: boolean };
type MoisRapport = { month: string; currencyCode: string; capturedCents: number; refundedCents: number; paidOutCents: number; revenueCents: number; retentionCents: number };

const MONEY: Array<[keyof Omit<Finance, "currencyCode">, string]> = [["capturedCents", "captured"], ["refundedCents", "refunded"], ["paidOutCents", "paidOut"], ["revenueCents", "revenue"], ["retentionCents", "retention"]];
const MOTIF = "Recette ADM-PIL : geste commercial pour éprouver la datation des remboursements au pilotage.";

const lire = async <T>(ctx: Contexte, chemin: string): Promise<T> => {
  const r = await ctx.request.get(`${api()}${chemin}`);
  expect(r.ok(), `GET ${chemin} → ${r.status()}`).toBe(true);
  return (await r.json()) as T;
};
/** Une lecture NON servie par le cache (le cache de 60 s est attendu, jamais contourné). */
const lireFraiche = async <T extends { cached: boolean }>(ctx: Contexte, chemin: string): Promise<T> => {
  let v!: T;
  await expect.poll(async () => { v = await lire<T>(ctx, chemin); return v.cached; }, { timeout: 90_000, intervals: [5_000], message: `${chemin} hors cache` }).toBe(false);
  return v;
};
const euros = (cents: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
const moisCourant = () => new Date().toISOString().slice(0, 7);
const section = (page: Page, titre: RegExp) => page.locator("main section").filter({ has: page.locator("h2", { hasText: titre }) });
const carteCourbe = (page: Page, titre: string) => page.locator("main div.rounded-xl").filter({ has: page.locator("p", { hasText: new RegExp(`^${titre}$`) }) }).filter({ has: page.locator("svg") });

test.describe("ADM-PIL — pilotage et drilldown (cahier 02-ADMIN § 5.17)", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(() => {
    new JeuEssai().rejouer();
  });
  test.afterAll(() => {
    new JeuEssai().rejouer();
  });

  test("ADM-PIL-1 · les courbes d'activité", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(8 * 60_000);
    const fin = await navigateurAdmin("finance");
    const debut = await debutDuScenario();
    const { page } = fin;
    await page.goto(`${bo()}/pilotage`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    /* 1. Trois tuiles = API. */
    const serie = await lire<Series>(fin.contexte, "/admin/pilotage/series?granularity=week&months=3");
    for (const [libelle, valeur] of [["Comptes", serie.totals.users], ["Voyageurs prêts (Stripe)", serie.totals.carriersReady], ["Trajets publiés à venir", serie.totals.tripsPublishedOpen]] as const) {
      await expect(page.locator("main div.rounded-xl").filter({ hasText: libelle }).first(), libelle).toContainText(String(valeur), { timeout: 60_000 });
    }
    test.info().annotations.push({ type: "constat", description: `tuiles : ${serie.totals.users} comptes · ${serie.totals.carriersReady} Voyageurs prêts · ${serie.totals.tripsPublishedOpen} trajets à venir` });
    /* 2. Huit courbes exactement, libellés et indices. */
    const attendues: Array<[string, string]> = [["Inscriptions", "comptes créés"], ["Trajets publiés", "date de publication"], ["Demandes", "réservations demandées"], ["Acceptations", "acceptées par le Voyageur"], ["Livraisons", "code de livraison validé"], ["Deals terminés", "fin de transaction"], ["Annulations", "deals annulés"], ["Litiges", "litiges ouverts"]];
    await expect(page.locator("main svg[role=img]")).toHaveCount(8, { timeout: 60_000 });
    for (const [titre, indice] of attendues) await expect(carteCourbe(page, titre), titre).toContainText(indice);
    /* Chaque courbe = l'API : total affiché = somme des points. */
    const cles: Record<string, keyof Point> = { Inscriptions: "signups", "Trajets publiés": "tripsPublished", Demandes: "requests", Acceptations: "accepted", Livraisons: "delivered", "Deals terminés": "completed", Annulations: "cancelled", Litiges: "disputes" };
    for (const [titre, cle] of Object.entries(cles)) {
      const total = serie.points.reduce((s, p) => s + (p[cle] as number), 0);
      await expect(carteCourbe(page, titre), `${titre} : total = somme des points`).toContainText(`total ${total}`);
    }
    /* 3. « par » semaine / mois : la période bascule (3 / 12 mois), semaines du lundi en UTC. */
    const parMois = page.waitForResponse((r) => r.url().includes("/admin/pilotage/series?granularity=month&months=12"));
    await page.locator("label", { hasText: "par" }).locator("select").selectOption("month");
    expect((await parMois).status()).toBe(200);
    await expect(page.locator("label", { hasText: "sur" }).first().locator("select")).toHaveValue("12");
    const parSemaine = page.waitForResponse((r) => r.url().includes("/admin/pilotage/series?granularity=week&months=3"));
    await page.locator("label", { hasText: "par" }).locator("select").selectOption("week");
    expect((await parSemaine).status()).toBe(200);
    for (const p of serie.points) expect(new Date(p.periodStart).getUTCDay(), `${p.period} commence un lundi`).toBe(1);
    expect(serie.points.every((p) => p.periodStart.endsWith("T00:00:00.000Z")), "minuit UTC").toBe(true);
    /* 4. « sur » 1 / 3 / 6 / 12 / 24 mois. */
    for (const m of [1, 6, 12, 24, 3]) {
      const lecture = page.waitForResponse((r) => r.url().includes(`/admin/pilotage/series?granularity=week&months=${m}`));
      await page.locator("label", { hasText: "sur" }).first().locator("select").selectOption(String(m));
      expect((await lecture).status(), `sur ${m} mois`).toBe(200);
    }
    /* Libellés lisibles : « 29 juin → 5 juil. 2026 » dans le tableau des taux. */
    await expect(section(page, /^Taux$/).locator("tbody tr").first().locator("td").first()).toHaveText(/^\d{1,2} [a-zéû.]+ → \d{1,2} [a-zéû.]+ \d{4}$/, { timeout: 60_000 });
    /* 5. Survol : repère et valeur ; le dernier point étiqueté. */
    const svg = carteCourbe(page, "Demandes").locator("svg");
    const boite = (await svg.boundingBox())!;
    await page.mouse.move(boite.x + boite.width * 0.6, boite.y + boite.height / 2);
    await expect(svg.locator("line[stroke-dasharray]"), "repère au survol").toHaveCount(1);
    await expect(svg.locator("rect"), "infobulle").toHaveCount(1);
    /* 6. Mention de calcul, puis « (cache) » à la seconde lecture. */
    await expect(page.getByText(/^calculé le .+/).first()).toBeVisible();
    await page.reload({ waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    await expect(page.getByText(/^calculé le .+ \(cache\)$/).first(), "la réponse du cache se dit").toBeVisible({ timeout: 60_000 });
    /* Aucune ligne de journal. */
    const journal = await lireLeJournal(fin.contexte.request, { from: debut, adminUserId: jeuEssai.admin("finance").id });
    expect(journal.map((l) => l.action), "courbes : aucune ligne").toEqual([]);
    /* Le Support n'a pas `pilotage.read`. */
    const sup = await navigateurAdmin("support");
    expect((await sup.contexte.request.get(`${api()}/admin/pilotage/series`, { failOnStatusCode: false })).status(), "Support → 403").toBe(403);
  });

  test("ADM-PIL-2 · les courbes de finances : mêmes règles de datation que le rapport", async ({ navigateurAdmin }) => {
    test.setTimeout(6 * 60_000);
    const fin = await navigateurAdmin("finance");
    const { page } = fin;
    await page.goto(`${bo()}/pilotage`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    await page.getByRole("button", { name: "Finances", exact: true }).click();
    const attendues: Array<[string, string]> = [["Encaissé", "débits (captures)"], ["Remboursé", "aux Expéditeurs, toutes causes"], ["Versé aux Voyageurs", "transferts partis"], ["Revenu reconnu", "commission + prime des deals terminés"], ["Retenues nées", "annulations tardives"]];
    await expect(page.locator("main svg[role=img]")).toHaveCount(5, { timeout: 60_000 });
    for (const [titre, indice] of attendues) await expect(carteCourbe(page, titre), titre).toContainText(indice);
    const serie = await lire<Series>(fin.contexte, "/admin/pilotage/series?granularity=month&months=12");
    const devises = [...new Set(serie.points.flatMap((p) => p.finance.map((f) => f.currencyCode)))];
    await expect(page.locator("label", { hasText: "devise" }), "sélecteur de devise : seulement au-delà d'une devise").toHaveCount(devises.length > 1 ? 1 : 0);
    /* 3. Mois par mois, mesure par mesure : pilotage = rapport. */
    const rapport = await lire<{ months: MoisRapport[] }>(fin.contexte, "/admin/finances/report?months=12");
    const ecarts: string[] = [];
    for (const p of serie.points) {
      for (const f of p.finance) {
        const r = rapport.months.find((m) => m.month === p.period && m.currencyCode === f.currencyCode);
        for (const [cle] of MONEY) if ((r?.[cle] ?? 0) !== f[cle]) ecarts.push(`${p.period} ${f.currencyCode} ${cle} : pilotage ${f[cle]} ≠ rapport ${r?.[cle] ?? 0}`);
      }
    }
    for (const r of rapport.months) if (!serie.points.some((p) => p.period === r.month && p.finance.some((f) => f.currencyCode === r.currencyCode)) && MONEY.some(([c]) => r[c] !== 0)) ecarts.push(`${r.month} ${r.currencyCode} : au rapport, absent du pilotage`);
    test.info().annotations.push({ type: "constat", description: `revenu reconnu ${moisCourant()} : pilotage ${euros(serie.points.find((p) => p.period === moisCourant())?.finance[0]?.revenueCents ?? 0)}` });
    expect(ecarts, "le pilotage lit l'argent comme le rapport").toEqual([]);
  });

  test("ADM-PIL-3 · le drilldown, et la journalisation des seules inscriptions", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(8 * 60_000);
    const fin = await navigateurAdmin("finance");
    const { page } = fin;
    await page.goto(`${bo()}/pilotage`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    /* 1. Agrandir « Deals terminés ». */
    await carteCourbe(page, "Deals terminés").getByRole("button", { name: "Agrandir" }).click();
    await expect(page.getByRole("button", { name: "← Toutes les courbes" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Clique un point pour voir les éléments de la période.")).toBeVisible();
    const tableau = page.locator("main table").filter({ has: page.locator("th", { hasText: /^Variation$/ }) });
    await expect(tableau.locator("thead th")).toHaveText(["Période", "Deals terminés", "Variation"]);
    /* 2-3. Une ligne du tableau : le panneau latéral. */
    const debut = await debutDuScenario();
    // La période la plus remplie : un panneau vide ne prouve ni les liens ni le compteur.
    const serieSemaine = await lire<Series>(fin.contexte, "/admin/pilotage/series?granularity=week&months=3");
    const pleine = [...serieSemaine.points].sort((a, b) => b.completed - a.completed)[0];
    const lecture = page.waitForResponse((r) => r.url().includes(`/admin/pilotage/drilldown?metric=completed&granularity=week&period=${pleine.period}`));
    await tableau.locator("tbody tr").filter({ has: page.locator("span", { hasText: new RegExp(`^${pleine.period}$`) }) }).click();
    const drill = (await (await lecture).json()) as Drill;
    const panneau = page.locator("main div.rounded-xl").filter({ has: page.locator("h3", { hasText: /^Éléments · / }) });
    await expect(panneau).toContainText(new RegExp(`^.*${drill.total} élément\\(s\\)`), { timeout: 30_000 });
    const pied = (await panneau.locator("p").first().innerText()).trim();
    test.info().annotations.push({ type: "constat", description: `drilldown « Deals terminés » ${drill.period} : ${drill.total} élément(s) — « ${pied} »` });
    expect(pied, "pied du panneau : la période en jours UTC, dernier jour inclus").toMatch(/du \d{1,2} [a-zéû.]+ \d{4} au \d{1,2} [a-zéû.]+ \d{4} \(UTC\)/);
    expect(drill.total, "la période choisie a des deals terminés").toBeGreaterThan(0);
    for (const it of drill.items) await expect(panneau.locator(`a[href="/deals/${it.id}"]`).first(), `lien vers la fiche ${it.id}`).toBeVisible();
    /* 4. Aucune ligne pour un drilldown de deals. */
    expect((await lireLeJournal(fin.contexte.request, { from: debut, adminUserId: jeuEssai.admin("finance").id })).map((l) => l.action)).toEqual([]);
    /* 5-6. « Inscriptions » : une ligne de journal, une lecture sensible. */
    await page.getByRole("button", { name: "← Toutes les courbes" }).click();
    await carteCourbe(page, "Inscriptions").getByRole("button", { name: "Agrandir" }).click();
    const lectureInscriptions = page.waitForResponse((r) => r.url().includes("/admin/pilotage/drilldown?metric=signups"));
    await tableau.locator("tbody tr").last().click();
    const inscriptions = (await (await lectureInscriptions).json()) as Drill;
    await expect.poll(async () => (await lireLeJournal(fin.contexte.request, { from: debut, adminUserId: jeuEssai.admin("finance").id })).filter((l) => l.action === "PILOTAGE_DRILLDOWN_VIEWED").length, { timeout: 30_000 }).toBe(1);
    const ligne = (await lireLeJournal(fin.contexte.request, { from: debut, adminUserId: jeuEssai.admin("finance").id })).find((l) => l.action === "PILOTAGE_DRILLDOWN_VIEWED")!;
    expect(ligne.targetType).toBe("USER");
    expect(ligne.targetId ?? null).toBeNull();
    expect(ligne.after).toEqual({ metric: "signups", period: inscriptions.period, count: inscriptions.total });
    /* La liste est bornée à 200. */
    expect(inscriptions.items.length).toBeLessThanOrEqual(200);
    expect(inscriptions.truncated).toBe(inscriptions.total > inscriptions.items.length);
  });

  test("ADM-PIL-4 · les corridors et la demande sans offre", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(8 * 60_000);
    const fin = await navigateurAdmin("finance");
    const { page } = fin;
    const jetons = `${Date.now()}`;
    /* 3. Trois recherches publiques sur un corridor inexistant, par un visiteur neuf. */
    const origine = `Nantes${jetons.slice(-4)}`;
    const cle = `${origine.toLowerCase()}>cotonou`;
    const visiteur = await playwrightRequest.newContext({ userAgent: `recette-adm-pil-4-${jetons}` });
    try {
      for (let i = 0; i < 3; i++) expect((await visiteur.get(`${adresseDeLApi()}/trips/search?from=${encodeURIComponent(origine)}&to=Cotonou`)).ok()).toBe(true);
      /* 4. Deux vues de la page publique d'un trajet, même visiteur, même jour. */
      const trajet = jeuEssai.trajet("bzv-upcoming");
      const avant = (await lireFraiche<Corridors>(fin.contexte, "/admin/pilotage/corridors?days=30")).items.find((c) => c.key === "paris>brazzaville");
      for (let i = 0; i < 2; i++) expect((await visiteur.get(`${adresseDeLApi()}/trips/${trajet}/public`)).ok()).toBe(true);
      /* 5. Après le cache : la ligne ambre, les vues +1. */
      const apres = await lireFraiche<Corridors>(fin.contexte, "/admin/pilotage/corridors?days=30");
      const cherche = apres.items.find((c) => c.key === cle);
      expect(cherche, "le corridor cherché apparaît").toMatchObject({ tripsPublished: 0, searches: 3, searchesNoResult: 3 });
      const paris = apres.items.find((c) => c.key === "paris>brazzaville")!;
      expect(paris.views - (avant?.views ?? 0), "deux vues du même visiteur le même jour : +1").toBe(1);
      test.info().annotations.push({ type: "constat", description: `corridor ${cle} : ${cherche!.searches} recherches, ${cherche!.searchesNoResult} sans résultat ; Paris → Brazzaville : vues ${avant?.views ?? 0} → ${paris.views}` });
      await page.goto(`${bo()}/pilotage`, { waitUntil: "domcontentloaded" });
      await attendreLeChargement(page);
      const corridors = section(page, /^Corridors$/);
      await expect(corridors.locator("thead th")).toHaveText(["Corridor", "Trajets", "Demandes", "Acceptées", "€/kg moyen", "Litiges", "Vues", "Recherches", "Sans résultat"], { timeout: 60_000 });
      await expect(corridors.getByText("Un corridor avec des recherches sans résultat et aucun trajet est une demande sans offre : c'est là qu'il faut recruter des Voyageurs.")).toBeVisible();
      const ligne = corridors.locator("tbody tr").filter({ hasText: new RegExp(origine, "i") });
      await expect(ligne).toHaveClass(/bg-amber/);
      await expect(ligne).toContainText("demande sans offre");
      /* 2. La fenêtre 7 / 30 / 90 / 365 jours. */
      for (const d of [7, 90, 365, 30]) {
        const lecture = page.waitForResponse((r) => r.url().includes(`/admin/pilotage/corridors?days=${d}`));
        await corridors.locator("select").selectOption(String(d));
        expect((await lecture).status(), `${d} jours`).toBe(200);
      }
      test.info().annotations.push({ type: "écart de poste", description: "contrôle de robustesse « couper Redis » non joué : Redis est distant (Upstash) ; le repli des corridors sans compteur est prouvé en test unitaire, celui du cache est lu dans le code" });
    } finally {
      await visiteur.dispose();
      lireCoteServeur(`
        import redis from "./packages/libs/redis";
        (async () => { await redis.srem("yamba:stats:search:corridors", "${cle}"); console.log("@@true"); process.exit(0); })();`);
    }
  });

  test("ADM-PIL-5 · point = drilldown, et le remboursement daté comme au rapport (ajoutée)", async ({ navigateurAdmin, navigateurConnecte, jeuEssai }) => {
    test.setTimeout(8 * 60_000);
    const fin = await navigateurAdmin("finance");
    const sup = await navigateurAdmin("super");
    const m = moisCourant();
    /* Deux faits qui ont trompé le rapport (§ 5.16) : un deal remboursé le mois dernier puis re-remboursé aujourd'hui,
       et une demande annulée avant capture. */
    const deal = jeuEssai.deal("bzv-completed").id;
    const maintenant = new Date();
    const precedent = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth() - 1, 15, 10));
    lireCoteServeur(`
      import prisma from "./packages/libs/prisma";
      (async () => { await prisma.booking.update({ where: { id: "${deal}" }, data: { refundAmountCents: 1000, refundedAt: new Date("${precedent.toISOString()}"), refundId: "re_recette_pil5", refunds: [] } as never }); console.log("@@true"); process.exit(0); })();`);
    process.stdout.write(`   ↳ manœuvre base : 10 € remboursés le ${precedent.toISOString()} sur ${deal} (document antérieur à A166)\n`);
    expect((await sup.contexte.request.post(`${api()}/admin/deals/${deal}/refund`, { data: { amountCents: 500, reason: MOTIF } })).ok()).toBe(true);
    const aminata = await navigateurConnecte("aminata");
    expect((await aminata.contexte.request.post(`${adresseDeLApi()}/deals/${jeuEssai.deal("bzv-pending").id}/cancel`, { data: { reason: "Recette ADM-PIL-5" } })).ok()).toBe(true);
    /* Pilotage = rapport, mois par mois. */
    const serie = await lireFraiche<Series>(fin.contexte, "/admin/pilotage/series?granularity=month&months=3");
    const rapport = await lire<{ months: MoisRapport[] }>(fin.contexte, "/admin/finances/report?months=3");
    const moisPrec = precedent.toISOString().slice(0, 7);
    const lu = (periode: string) => ({
      pilotage: serie.points.find((p) => p.period === periode)?.finance.find((f) => f.currencyCode === "EUR")?.refundedCents ?? 0,
      rapport: rapport.months.find((r) => r.month === periode && r.currencyCode === "EUR")?.refundedCents ?? 0,
    });
    test.info().annotations.push({ type: "constat", description: `remboursé ${moisPrec} : ${JSON.stringify(lu(moisPrec))} ; ${m} : ${JSON.stringify(lu(m))}` });
    expect(lu(moisPrec), `remboursé ${moisPrec} : pilotage = rapport`).toEqual({ pilotage: lu(moisPrec).rapport, rapport: lu(moisPrec).rapport });
    expect(lu(m), `remboursé ${m} : pilotage = rapport`).toEqual({ pilotage: lu(m).rapport, rapport: lu(m).rapport });
    /* Point = Σ drilldown, pour chaque mesure d'argent des deux mois. */
    const ecarts: string[] = [];
    for (const periode of [moisPrec, m]) {
      const point = serie.points.find((p) => p.period === periode)?.finance.find((f) => f.currencyCode === "EUR");
      for (const [cle, metric] of MONEY) {
        const d = await lire<Drill>(fin.contexte, `/admin/pilotage/drilldown?metric=${metric}&granularity=month&period=${periode}`);
        if (d.truncated) continue;
        const somme = d.items.filter((it) => (it.currencyCode ?? "EUR") === "EUR").reduce((s, it) => s + (it.amountCents ?? 0), 0);
        if (somme !== (point?.[cle] ?? 0)) ecarts.push(`${periode} ${metric} : point ${point?.[cle] ?? 0} ≠ Σ drilldown ${somme}`);
        for (const it of d.items) if (new Date(it.at).getTime() < new Date(d.periodStart).getTime() || new Date(it.at).getTime() >= new Date(d.periodEnd).getTime()) ecarts.push(`${periode} ${metric} : élément ${it.id} daté ${it.at} hors période`);
      }
    }
    expect(ecarts, "chaque point se retrouve dans ses éléments").toEqual([]);
  });

  test("ADM-PIL-6 · un corridor n'apparaît que sur la fenêtre où il a eu de l'activité (ajoutée)", async ({ navigateurAdmin }) => {
    test.setTimeout(5 * 60_000);
    const fin = await navigateurAdmin("finance");
    /* Un corridor cherché il y a longtemps : connu du registre des recherches, sans aucun compteur dans la fenêtre. */
    const cle = `ancien${Date.now().toString().slice(-5)}>lome`;
    lireCoteServeur(`
      import redis from "./packages/libs/redis";
      (async () => { await redis.sadd("yamba:stats:search:corridors", "${cle}"); console.log("@@true"); process.exit(0); })();`);
    process.stdout.write(`   ↳ manœuvre Redis : corridor « ${cle} » inscrit au registre des recherches, sans compteur (recherche hors fenêtre)\n`);
    try {
      const sept = await lireFraiche<Corridors>(fin.contexte, "/admin/pilotage/corridors?days=7");
      const ligne = sept.items.find((c) => c.key === cle);
      const vides = sept.items.filter((c) => c.tripsPublished + c.requests + c.views + c.searches === 0).map((c) => c.key);
      test.info().annotations.push({ type: "constat", description: `7 jours : ${sept.items.length} corridors, dont ${vides.length} sans aucune activité (${vides.slice(0, 5).join(", ")})` });
      expect(ligne, "un corridor sans activité dans la fenêtre n'est pas listé").toBeUndefined();
      expect(vides, "aucune ligne toute à zéro").toEqual([]);
    } finally {
      lireCoteServeur(`
        import redis from "./packages/libs/redis";
        (async () => { await redis.srem("yamba:stats:search:corridors", "${cle}"); console.log("@@true"); process.exit(0); })();`);
    }
  });
});
