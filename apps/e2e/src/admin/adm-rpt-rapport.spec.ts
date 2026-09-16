/**
 * adm-rpt-rapport.spec.ts — cahier 02-ADMIN, § 5.16 « Rapport mensuel et export finances » (ADM-RPT-1 à 3) + fiches ajoutées
 * ============================================================================================================================
 * Un rapport financier se juge à deux propriétés que ses boutons ne montrent pas :
 *  - **il dit la vérité du mois** : chaque fait compte à SA date (mois UTC), un passif n'est jamais un revenu, et ce qui
 *    n'a pas été débité n'est pas « remboursé » ;
 *  - **un mois clos ne change pas après coup** : relu le mois suivant, après d'autres gestes sur les mêmes deals, il rend
 *    les mêmes chiffres — sinon le comptable ne peut rien rapprocher.
 * Les chiffres de l'écran sont comparés à ceux que l'API sert, et ceux de l'API à un calcul indépendant fait en base
 * (`lireCoteServeur`). Le fichier CSV est téléchargé PAR L'ÉCRAN et parsé (RFC 4180). Jeu d'essai rejoué avant chaque fiche ;
 * les manœuvres en base sont consignées.
 */
import { readFileSync } from "node:fs";
import { test, expect, type NavigateurAdmin } from "../fixtures/yamba";
import { JeuEssai } from "../fixtures/jeu-essai";
import { adresseDeLApi, adresseDeLApiAdmin, adresseDuBackOffice } from "../fixtures/adresses";
import { lireLeJournal } from "../pages/journal-admin";
import { attendreLeChargement, debutDuScenario, lireCoteServeur, reouvrirLesLitigesSousUnDelai } from "../pages/ecran-admin";

const api = () => adresseDeLApiAdmin();
const bo = () => adresseDuBackOffice();
type Contexte = NavigateurAdmin["contexte"];
type Page = NavigateurAdmin["page"];

type Mois = { month: string; currencyCode: string; capturedCents: number; capturedCount: number; refundedCents: number; refundCount: number; paidOutCents: number; payoutCount: number; revenueCents: number; completedCount: number; retentionCents: number; cancelledCount: number };
type Passifs = { currencyCode: string; pendingPayoutCents: number; frozenPayoutCents: number; reversedOpenCents: number; heldRetentionCents: number; proposedRefundCents: number };
type Rapport = { from: string; to: string; generatedAt: string; months: Mois[]; snapshot: Passifs[] };
type Remboursement = { refundId: string | null; amountCents: number; refundedAt: string; kind: string };
type FicheArgent = { status: string; payment: { refundAmountCents: number | null; refunds: Remboursement[] }; balance: { refundedCents: number; anomaly: string | null }; timeline: Array<{ kind: string; amountCents: number | null; detail: string | null }> };

const MOTIF_REMBOURSEMENT = "Recette ADM-RPT : geste commercial appliqué pour éprouver la datation des remboursements au rapport.";
const MOTIF_LITIGE = "Recette ADM-RPT : litige tranché en remboursement total pour vérifier que le revenu reconnu suit sa règle.";
const DELAI = "dispute.responseDelayHours";
const FINANCE_CSV_COLUMNS = [
  "dealId", "status", "originCity", "destinationCity", "departureAt", "shipperId", "carrierId", "currency",
  "totalShipperCents", "transportCents", "commissionCents", "premiumCents",
  "capturedAt", "refundAmountCents", "refundedAt", "refundId",
  "payoutStatus", "payoutAmountCents", "payoutSentAt", "transferId",
  "retentionCents", "retentionDisposition", "completedAt", "completedBy", "closedAt", "closedBy",
  "disputeTicket", "paymentIntentId", "chargeId",
];

const euros = (cents: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
const moisUtc = (d: Date, recul: number) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - recul, 1));
const cle = (d: Date) => d.toISOString().slice(0, 7);
const vide = (m: string): Mois => ({ month: m, currencyCode: "EUR", capturedCents: 0, capturedCount: 0, refundedCents: 0, refundCount: 0, paidOutCents: 0, payoutCount: 0, revenueCents: 0, completedCount: 0, retentionCents: 0, cancelledCount: 0 });

const lireRapport = async (ctx: Contexte, mois = 3): Promise<Rapport> => {
  const r = await ctx.request.get(`${api()}/admin/finances/report?months=${mois}`);
  expect(r.ok(), `GET /admin/finances/report → ${r.status()}`).toBe(true);
  return (await r.json()) as Rapport;
};
const moisDuRapport = (r: Rapport, m: string): Mois => r.months.find((x) => x.month === m && x.currencyCode === "EUR") ?? vide(m);
const lireFiche = async (ctx: Contexte, id: string): Promise<FicheArgent> => {
  const r = await ctx.request.get(`${api()}/admin/deals/${id}/money`);
  expect(r.ok(), `GET /admin/deals/${id}/money → ${r.status()}`).toBe(true);
  return (await r.json()) as FicheArgent;
};

/** Parseur RFC 4180 minimal (guillemets doublés, virgules et retours ligne encadrés). */
function parserCsv(texte: string): Record<string, string>[] {
  const lignes: string[][] = [];
  let ligne: string[] = [];
  let cellule = "";
  let entre = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (entre) {
      if (c === '"' && texte[i + 1] === '"') { cellule += '"'; i++; }
      else if (c === '"') entre = false;
      else cellule += c;
    } else if (c === '"') entre = true;
    else if (c === ",") { ligne.push(cellule); cellule = ""; }
    else if (c === "\r" && texte[i + 1] === "\n") { ligne.push(cellule); lignes.push(ligne); ligne = []; cellule = ""; i++; }
    else cellule += c;
  }
  if (cellule || ligne.length) { ligne.push(cellule); lignes.push(ligne); }
  const [entete, ...corps] = lignes;
  return corps.map((l) => Object.fromEntries(entete.map((k, i) => [k, l[i] ?? ""])));
}
const entete = (texte: string) => texte.replace(/^﻿/, "").split("\r\n")[0].split(",");

/** Le calcul INDÉPENDANT du mois, fait en base avec la règle du cahier (revenu = commission + prime des deals terminés). */
const revenuEnBase = (debut: Date, fin: Date) =>
  lireCoteServeur<{ revenueCents: number; completedCount: number }>(`
    import prisma from "./packages/libs/prisma";
    (async () => {
      const rows = await prisma.booking.findMany({ where: { isDeleted: false, status: "COMPLETED", completedAt: { gte: new Date("${debut.toISOString()}"), lt: new Date("${fin.toISOString()}") } }, select: { pricing: true } });
      const eur = rows.filter((r) => r.pricing.currencyCode === "EUR");
      console.log("@@" + JSON.stringify({ revenueCents: eur.reduce((s, r) => s + r.pricing.commissionCents + r.pricing.premiumCents, 0), completedCount: eur.length }));
      process.exit(0);
    })();`);
/** Manœuvre consignée : poser des champs de paiement en base. */
const poserEnBase = (id: string, data: Record<string, unknown>, pourquoi: string) => {
  lireCoteServeur(`
    import prisma from "./packages/libs/prisma";
    (async () => { await prisma.booking.update({ where: { id: "${id}" }, data: ${JSON.stringify(data)} as never }); console.log("@@true"); process.exit(0); })();`);
  process.stdout.write(`   ↳ manœuvre base : ${JSON.stringify(data)} sur ${id} (${pourquoi})\n`);
};
const listeEnBase = (id: string) =>
  lireCoteServeur<Remboursement[]>(`
    import prisma from "./packages/libs/prisma";
    (async () => { const b = await prisma.booking.findUnique({ where: { id: "${id}" }, select: { refunds: true } }); console.log("@@" + JSON.stringify(b?.refunds ?? null)); process.exit(0); })();`);

const section = (page: Page, titre: RegExp) => page.locator("main section").filter({ has: page.locator("h2", { hasText: titre }) });

async function poserDelai(ctx: Contexte, heures: number): Promise<void> {
  const cur = (await (await ctx.request.get(`${api()}/admin/settings`)).json()) as { version: number; values: Record<string, number> };
  reouvrirLesLitigesSousUnDelai(heures); // A169 : l'échéance est figée à l'ouverture, le paramètre seul ne suffit plus
  if (cur.values[DELAI] === heures) return;
  const r = await ctx.request.patch(`${api()}/admin/settings`, { data: { changes: { [DELAI]: heures }, reason: "Recette ADM-RPT : délai de réponse abaissé pour rendre un litige décidable.", expectedVersion: cur.version } });
  expect(r.ok(), `délai → ${heures} h : ${r.status()}`).toBe(true);
}

test.describe("ADM-RPT — rapport mensuel et export finances (cahier 02-ADMIN § 5.16)", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(() => {
    new JeuEssai().rejouer();
  });
  test.afterAll(() => {
    new JeuEssai().rejouer();
  });

  test("ADM-RPT-1 · le rapport et ses passifs", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(8 * 60_000);
    const fin = await navigateurAdmin("finance");
    const debut = await debutDuScenario();
    const { page } = fin;
    const rapport = await lireRapport(fin.contexte, 12);
    /* 1-2. Depuis /finances, le lien, le titre et le sous-titre. */
    await page.goto(`${bo()}/finances`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    await page.getByRole("link", { name: "Rapport mensuel et export →" }).click();
    await expect(page).toHaveURL(/\/finances\/report$/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1, name: "Rapport mensuel" })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/^Par mois \(UTC\) et par devise, depuis les deals/)).toBeVisible();
    /* 3. Les cinq passifs : libellés, montants = API, aucun nul sur le jeu d'essai neuf, jamais le mot « revenu ». */
    const passifs = section(page, /^Aujourd'hui \(passifs, jamais un revenu\)$/);
    const eur = rapport.snapshot.find((s) => s.currencyCode === "EUR")!;
    const tuiles: Array<[string, number]> = [
      ["Dû aux Voyageurs", eur.pendingPayoutCents],
      ["Gelé par un litige", eur.frozenPayoutCents],
      ["Renversé, à décider", eur.reversedOpenCents],
      ["Retenues à arbitrer", eur.heldRetentionCents],
      ["Remboursements proposés", eur.proposedRefundCents],
    ];
    test.info().annotations.push({ type: "constat", description: `passifs EUR : ${tuiles.map(([l, v]) => `${l} ${euros(v)}`).join(" · ")}` });
    for (const [libelle, cents] of tuiles) {
      const tuile = passifs.locator("div.rounded-xl").filter({ hasText: libelle });
      await expect(tuile, libelle).toContainText(euros(cents), { timeout: 60_000 });
      if (cents === 0) test.info().annotations.push({ type: "écart jeu d'essai", description: `« ${libelle} » est nul sur le jeu d'essai neuf (le cahier n'en attend aucun)` });
    }
    await expect(passifs.locator("div.rounded-xl").filter({ hasText: "Dû aux Voyageurs" })).toContainText("PENDING + FAILED");
    // Le titre dit « jamais un revenu » : c'est chaque TUILE qui ne doit pas porter le mot.
    for (const t of await passifs.locator("div.rounded-xl").allInnerTexts()) expect(t, "un passif n'est jamais étiqueté revenu").not.toMatch(/revenu/i);
    /* 4. Les colonnes du tableau ; le sélecteur relance la lecture avec la période choisie. */
    const parMois = section(page, /^Par mois$/);
    const colonnes = (await parMois.locator("thead th").allInnerTexts()).map((t) => t.trim().toLowerCase());
    for (const attendu of ["Mois", "Devise", "Encaissé", "Remboursé", "Versé", "Revenu (commission + prime)", "Retenues nées", "Deals terminés / annulés"]) {
      expect(colonnes, `colonne « ${attendu} »`).toContain(attendu.toLowerCase());
    }
    for (const m of [3, 6, 24, 12]) {
      const lecture = page.waitForResponse((r) => r.url().includes(`/admin/finances/report?months=${m}`));
      await page.locator("select").first().selectOption(String(m));
      expect((await lecture).status(), `période ${m} mois`).toBe(200);
    }
    /* L'écran = l'API, mois par mois. */
    for (const m of rapport.months.filter((x) => x.currencyCode === "EUR")) {
      const ligne = parMois.locator("tbody tr").filter({ has: page.locator("td", { hasText: new RegExp(`^${m.month}$`) }) });
      await expect(ligne, `mois ${m.month}`).toContainText(euros(m.revenueCents));
      await expect(ligne).toContainText(`${m.completedCount} / ${m.cancelledCount}`);
    }
    /* 5. Le pied : bornes de la période, date de calcul, règle de datation. */
    const pied = parMois.locator("p").last();
    await expect(pied).toContainText("Un deal capturé en mars et terminé en avril compte dans les deux mois, chaque fait à sa date.");
    test.info().annotations.push({ type: "constat", description: `pied : « ${(await pied.innerText()).trim()} »` });
    /* Les frais Stripe ne figurent nulle part. */
    for (const t of await page.locator("main thead").allInnerTexts()) expect(t).not.toMatch(/frais/i);
    /* Aucune ligne de journal pour une lecture. */
    const lignes = await lireLeJournal(fin.contexte.request, { from: debut, adminUserId: jeuEssai.admin("finance").id });
    expect(lignes.map((l) => l.action), "lecture du rapport : aucune ligne").toEqual([]);
  });

  test("ADM-RPT-2 · l'export CSV finances", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(8 * 60_000);
    const fin = await navigateurAdmin("finance");
    const { page } = fin;
    await page.goto(`${bo()}/finances/report`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    const bloc = section(page, /^Export CSV par deal \(journalisé\)$/);
    /* 1. Le texte. */
    await expect(bloc).toContainText("Une ligne par deal ayant un fait d'argent dans la période (au plus 366 jours)", { timeout: 60_000 });
    /* 2. Plus de 366 jours, puis fin avant début : refusés par le serveur (appel direct) ET à l'écran, en français. */
    const trop = await fin.contexte.request.get(`${api()}/admin/finances/export?from=2025-01-01T00:00:00.000Z&to=2026-02-01T00:00:00.000Z`, { failOnStatusCode: false });
    expect(trop.status()).toBe(400);
    expect(((await trop.json()) as { message: string }).message).toBe("The period cannot exceed 366 days.");
    const envers = await fin.contexte.request.get(`${api()}/admin/finances/export?from=2026-09-10T00:00:00.000Z&to=2026-09-01T00:00:00.000Z`, { failOnStatusCode: false });
    expect(envers.status()).toBe(400);
    await bloc.locator('input[type="date"]').first().fill("2025-01-01");
    await bloc.locator('input[type="date"]').last().fill("2026-02-01");
    await expect(bloc.getByText(/Période trop longue/)).toBeVisible();
    await expect(bloc.getByRole("button", { name: "Télécharger le CSV" })).toBeDisabled();
    await bloc.locator('input[type="date"]').first().fill("2026-09-10");
    await bloc.locator('input[type="date"]').last().fill("2026-09-01");
    await expect(bloc.getByText(/La fin précède le début/)).toBeVisible();
    /* 3-4. Le mois courant, téléchargé par l'écran, puis relu et parsé. */
    const maintenant = new Date();
    const du = moisUtc(maintenant, 0).toISOString().slice(0, 10);
    const au = maintenant.toISOString().slice(0, 10);
    await bloc.locator('input[type="date"]').first().fill(du);
    await bloc.locator('input[type="date"]').last().fill(au);
    const debut = await debutDuScenario();
    const reponse = page.waitForResponse((r) => r.url().includes("/admin/finances/export?"));
    const attente = page.waitForEvent("download", { timeout: 60_000 });
    await bloc.getByRole("button", { name: "Télécharger le CSV" }).click();
    const dl = await attente;
    const r = await reponse;
    expect(dl.suggestedFilename(), "le nom porte le premier et le dernier jour choisis").toBe(`yamba-finances-${du}-${au}.csv`);
    const brut = readFileSync((await dl.path())!);
    expect(brut.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])), "BOM UTF-8 (Excel)").toBe(true);
    const texte = brut.toString("utf-8");
    expect(entete(texte).slice(0, FINANCE_CSV_COLUMNS.length), "les colonnes du cahier, dans l'ordre").toEqual(FINANCE_CSV_COLUMNS);
    expect(entete(texte).slice(FINANCE_CSV_COLUMNS.length), "A166 : deux colonnes ajoutées").toEqual(["refundCount", "refundedInPeriodCents"]);
    const lignes = parserCsv(texte.replace(/^﻿/, ""));
    /* 5. X-Row-Count = lignes du fichier = message de l'écran. */
    expect(Number(r.headers()["x-row-count"]), "X-Row-Count").toBe(lignes.length);
    await expect(bloc.getByText(new RegExp(`^${lignes.length} ligne`))).toBeVisible({ timeout: 30_000 });
    /* Chaque ligne a un fait d'argent dans la période. */
    const debutPeriode = new Date(`${du}T00:00:00Z`).getTime();
    const finPeriode = new Date(`${au}T00:00:00Z`).getTime() + 86_400_000;
    const dans = (v: string) => v !== "" && new Date(v).getTime() >= debutPeriode && new Date(v).getTime() < finPeriode;
    for (const l of lignes) {
      expect(dans(l.capturedAt) || Number(l.refundedInPeriodCents) > 0 || dans(l.payoutSentAt) || dans(l.completedAt) || dans(l.closedAt), `deal ${l.dealId} : un fait d'argent dans la période`).toBe(true);
    }
    test.info().annotations.push({ type: "constat", description: `export ${dl.suggestedFilename()} : ${lignes.length} lignes, statuts ${[...new Set(lignes.map((l) => l.status))].join(", ")}` });
    /* Journal. */
    const journal = (await lireLeJournal(fin.contexte.request, { from: debut, adminUserId: jeuEssai.admin("finance").id })).filter((l) => l.action === "FINANCE_EXPORTED");
    expect(journal).toHaveLength(1);
    expect(journal[0].targetType).toBe("BOOKING");
    expect(journal[0].targetId ?? null).toBeNull();
    expect(journal[0].after).toEqual({ from: `${du}T00:00:00.000Z`, to: new Date(finPeriode).toISOString(), rows: lignes.length, filename: `yamba-finances-${du}-${au}.csv` });
    /* 6. Le Médiateur lit le rapport, pas l'export. */
    const med = await navigateurAdmin("mediateur");
    await med.page.goto(`${bo()}/finances/report`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(med.page);
    await expect(med.page.getByRole("heading", { level: 1, name: "Rapport mensuel" })).toBeVisible({ timeout: 60_000 });
    await expect(section(med.page, /^Par mois$/)).toBeVisible({ timeout: 60_000 });
    await expect(section(med.page, /^Export CSV par deal/), "pas de bloc d'export pour le Médiateur").toHaveCount(0);
    const direct = await med.contexte.request.get(`${api()}/admin/finances/export?from=${du}T00:00:00.000Z&to=${new Date(finPeriode).toISOString()}`, { failOnStatusCode: false });
    expect(direct.status(), "Médiateur → 403").toBe(403);
  });

  test("ADM-RPT-3 · le revenu reconnu suit sa règle", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(10 * 60_000);
    const fin = await navigateurAdmin("finance");
    const med = await navigateurAdmin("mediateur");
    const sup = await navigateurAdmin("super");
    const maintenant = new Date();
    const m = cle(maintenant);
    const avant = moisDuRapport(await lireRapport(fin.contexte), m);
    /* 1. Le revenu du mois = commission + prime des deals terminés du mois, calculé indépendamment en base. */
    const independant = revenuEnBase(moisUtc(maintenant, 0), moisUtc(maintenant, -1));
    expect(avant.revenueCents, "revenu = Σ (commission + prime) des deals terminés du mois").toBe(independant.revenueCents);
    expect(avant.completedCount).toBe(independant.completedCount);
    /* 2. Un deal terminé : commission et prime sur sa fiche. */
    const termine = jeuEssai.deal("bzv-completed").id;
    const fiche = (await (await fin.contexte.request.get(`${api()}/admin/deals/${termine}/money`)).json()) as { pricing: { commissionCents: number; premiumCents: number } };
    test.info().annotations.push({ type: "constat", description: `bzv-completed : commission ${euros(fiche.pricing.commissionCents)}, prime ${euros(fiche.pricing.premiumCents)} ; revenu du mois ${m} : ${euros(avant.revenueCents)} sur ${avant.completedCount} deals` });
    /* Les passifs du jour n'y entrent pas : le revenu ne bouge pas quand on propose un remboursement. */
    expect((await fin.contexte.request.post(`${api()}/admin/deals/${termine}/refund/propose`, { data: { amountCents: 500, reason: MOTIF_REMBOURSEMENT } })).ok()).toBe(true);
    expect(moisDuRapport(await lireRapport(fin.contexte), m).revenueCents, "un remboursement proposé n'est pas un revenu (ni un moins-revenu)").toBe(avant.revenueCents);
    /* 3. Un litige tranché en remboursement total : le deal passe CANCELLED, le revenu ne compte pas, le remboursé si. */
    const litige = jeuEssai.deal("bzv-disputed").id;
    try {
      await poserDelai(sup.contexte, 12);
      await expect.poll(async () => ((await (await med.contexte.request.get(`${api()}/admin/disputes/${litige}`)).json()) as { canDecide: boolean }).canDecide, { timeout: 60_000, intervals: [3_000] }).toBe(true);
      const total = (await lireFiche(fin.contexte, litige)).payment.refundAmountCents ?? 0;
      const tranche = await med.contexte.request.post(`${api()}/admin/disputes/${litige}/resolve`, { data: { outcome: "FULL_REFUND", reason: MOTIF_LITIGE } });
      expect(tranche.ok(), `trancher → ${tranche.status()}`).toBe(true);
      const apresLitige = await lireFiche(fin.contexte, litige);
      expect(apresLitige.status).toBe("CANCELLED");
      const rembourse = (apresLitige.payment.refundAmountCents ?? 0) - total;
      const apres = moisDuRapport(await lireRapport(fin.contexte), m);
      expect(apres.revenueCents, "un deal remboursé en totalité ne contribue pas au revenu reconnu").toBe(avant.revenueCents);
      expect(apres.refundedCents, "le remboursement compte dans le mois").toBe(avant.refundedCents + rembourse);
      expect(apres.cancelledCount).toBe(avant.cancelledCount + 1);
      expect(apresLitige.payment.refunds?.map((x) => [x.kind, x.amountCents]), "A166 : la décision entre dans la liste").toEqual([["DISPUTE", rembourse]]);
      test.info().annotations.push({ type: "écart documentaire", description: "étape 3 : le deal en litige n'a jamais été terminé (DELIVERED → DISPUTED) ; il ne contribuait donc pas au revenu avant la décision — « ne contribue PLUS » se lit « ne contribue pas »" });
    } finally {
      await poserDelai(sup.contexte, 72);
    }
  });

  test("ADM-RPT-4 · un mois clos ne change pas après un nouveau remboursement (ANO-ADM-37)", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(8 * 60_000);
    const fin = await navigateurAdmin("finance");
    const sup = await navigateurAdmin("super");
    const deal = jeuEssai.deal("bzv-completed").id;
    const maintenant = new Date();
    const precedent = moisUtc(maintenant, 1);
    const moisPrecedent = cle(precedent);
    const moisCourant = cle(maintenant);
    /* Un deal remboursé de 10 € le mois dernier, écrit comme l'était tout document AVANT la liste (A166) : cumul et date seuls. */
    const leQuinze = new Date(Date.UTC(precedent.getUTCFullYear(), precedent.getUTCMonth(), 15, 10));
    poserEnBase(deal, { refundAmountCents: 1000, refundedAt: leQuinze.toISOString(), refundId: "re_recette_rpt4", refunds: [] }, "ADM-RPT-4 : remboursement du mois dernier, document antérieur à A166");
    const avant = await lireRapport(fin.contexte);
    const precedentAvant = moisDuRapport(avant, moisPrecedent);
    const courantAvant = moisDuRapport(avant, moisCourant);
    /* Le geste d'aujourd'hui : 5 € de plus. */
    const r = await sup.contexte.request.post(`${api()}/admin/deals/${deal}/refund`, { data: { amountCents: 500, reason: MOTIF_REMBOURSEMENT } });
    expect(r.ok(), `rembourser → ${r.status()} ${r.ok() ? "" : await r.text()}`).toBe(true);
    const apres = await lireRapport(fin.contexte);
    const precedentApres = moisDuRapport(apres, moisPrecedent);
    const courantApres = moisDuRapport(apres, moisCourant);
    test.info().annotations.push({ type: "constat", description: `remboursé ${moisPrecedent} : ${euros(precedentAvant.refundedCents)} ×${precedentAvant.refundCount} → ${euros(precedentApres.refundedCents)} ×${precedentApres.refundCount} ; ${moisCourant} : ${euros(courantAvant.refundedCents)} ×${courantAvant.refundCount} → ${euros(courantApres.refundedCents)} ×${courantApres.refundCount}` });
    expect([precedentApres.refundedCents, precedentApres.refundCount], `le mois ${moisPrecedent} est inchangé`).toEqual([precedentAvant.refundedCents, precedentAvant.refundCount]);
    expect([courantApres.refundedCents, courantApres.refundCount], `le mois ${moisCourant} ne compte que le geste`).toEqual([courantAvant.refundedCents + 500, courantAvant.refundCount + 1]);
    /* En base : l'ancien remboursement matérialisé à SA date, puis le geste. */
    const liste = listeEnBase(deal);
    expect(liste?.map((x) => [x.kind, x.amountCents, x.refundId, new Date(x.refundedAt).toISOString()])).toEqual([["LEGACY", 1000, "re_recette_rpt4", leQuinze.toISOString()], ["MANUAL", 500, expect.stringMatching(/^re_fake_/), expect.any(String)]]);
    /* La fiche argent : les deux remboursements, la chronologie en deux lignes. */
    const fiche = await lireFiche(fin.contexte, deal);
    expect(fiche.payment.refunds.map((x) => [x.kind, x.amountCents])).toEqual([["LEGACY", 1000], ["MANUAL", 500]]);
    expect(fiche.timeline.filter((e) => e.kind === "REFUNDED").map((e) => e.amountCents)).toEqual([1000, 500]);
    /* L'export du mois dernier, relu aujourd'hui : le deal y est, avec ce qui a été rendu CE mois-là. */
    const csv = await fin.contexte.request.get(`${api()}/admin/finances/export?from=${precedent.toISOString()}&to=${moisUtc(maintenant, 0).toISOString()}`);
    const ligne = parserCsv((await csv.text()).replace(/^﻿/, "")).find((l) => l.dealId === deal);
    expect(ligne, "le deal est dans l'export du mois dernier").toBeTruthy();
    expect([ligne!.refundCount, ligne!.refundedInPeriodCents]).toEqual(["2", "1000"]);
  });

  test("ADM-RPT-5 · une annulation avant capture n'est pas un remboursement (ANO-ADM-38)", async ({ navigateurAdmin, navigateurConnecte, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    const fin = await navigateurAdmin("finance");
    const deal = jeuEssai.deal("bzv-pending").id;
    const m = cle(new Date());
    const avant = moisDuRapport(await lireRapport(fin.contexte), m);
    const aminata = await navigateurConnecte("aminata");
    const annule = await aminata.contexte.request.post(`${adresseDeLApi()}/deals/${deal}/cancel`, { data: { reason: "Recette ADM-RPT-5 : annulation avant acceptation" } });
    expect(annule.ok(), `annuler → ${annule.status()}`).toBe(true);
    const fiche = await lireFiche(fin.contexte, deal);
    const apres = moisDuRapport(await lireRapport(fin.contexte), m);
    test.info().annotations.push({ type: "constat", description: `annulé avant capture : cumul en base ${fiche.payment.refundAmountCents}, remboursements listés ${fiche.payment.refunds?.length ?? "(champ absent)"}, bilan remboursé ${fiche.balance.refundedCents}, anomalie ${fiche.balance.anomaly} ; rapport du mois : remboursé ${euros(avant.refundedCents)} ×${avant.refundCount} → ${euros(apres.refundedCents)} ×${apres.refundCount}` });
    expect([apres.refundedCents, apres.refundCount], "rien n'a été débité : rien n'est remboursé").toEqual([avant.refundedCents, avant.refundCount]);
    expect(apres.cancelledCount).toBe(avant.cancelledCount + 1);
    expect(fiche.balance.refundedCents).toBe(0);
    expect(fiche.balance.anomaly, "aucune fausse anomalie sur la fiche argent").toBeNull();
    expect(fiche.payment.refunds).toEqual([]);
    expect(fiche.timeline.map((e) => e.kind)).not.toContain("REFUNDED");
  });
});
