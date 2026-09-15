/**
 * adm-med-mediation.spec.ts — cahier 02-ADMIN, § 5.9 « Médiation : la file, le dossier, la décision » (ADM-MED-1 à 6)
 * ==================================================================================================================
 * La médiation est le geste le plus lourd du back-office : il déplace de l'argent, clôt un deal et marque la réputation
 * d'une partie. Chaque décision est donc vérifiée à cinq endroits : l'écran (récapitulatif, message), l'API, la base
 * (statut, compteur interne, outbox), le fournisseur de paiement (remboursements réellement émis, FAKE inspecté par la
 * fiche argent) et les emails des deux parties.
 *
 * Terrain mesuré avant d'écrire (seed) : YAM-2041 (Chinwe → Thomas, Paris → Brazzaville) signalé à J−1, YAM-2042 (Mai →
 * Adebayo, Londres → Lagos) signalé à H−8, une retenue (Aminata → Thomas) close à J−4. Délai de réponse par défaut 72 h :
 * AUCUN litige n'est décidable juste après le seed. Deux manœuvres consignées, toutes deux par un geste réel :
 *   - `dispute.responseDelayHours` abaissé à 12 h (minimum du catalogue ; le cahier dit « 1 heure », hors bornes) par le
 *     super administrateur, rétabli en `finally` → YAM-2041 décidable (J−1), YAM-2042 toujours pas (H−8) ;
 *   - la version du Voyageur déposée par Adebayo depuis son espace (API de l'écran membre) → YAM-2042 décidable.
 *
 * Fiches ajoutées : ADM-MED-7 (deux décisions simultanées : un seul remboursement), ADM-MED-8 (un dossier tranché se
 * relit, la décision y figure), ADM-MED-9 (partiel supérieur au net : ce que lisent les deux parties).
 */
import { test, expect, type NavigateurAdmin } from "../fixtures/yamba";
import { JeuEssai } from "../fixtures/jeu-essai";
import { adresseDeLApi, adresseDeLApiAdmin, adresseDuBackOffice } from "../fixtures/adresses";
import { lireLeJournal } from "../pages/journal-admin";
import { attendreLeChargement, debutDuScenario, lireCoteServeur, reouvrirLesLitigesSousUnDelai } from "../pages/ecran-admin";

const api = () => adresseDeLApiAdmin();
const bo = () => adresseDuBackOffice();
type Contexte = NavigateurAdmin["contexte"];
type Page = NavigateurAdmin["page"];

const MOTIF = "Recette ADM-MED : les preuves de prise en charge et de remise ont été lues, la version des deux parties comparée, décision motivée.";
const CODE_LIVRAISON = "742891";
const DELAI = "dispute.responseDelayHours";

const euros = (cents: number) => `${(cents / 100).toFixed(2).replace(".", ",")}`;

type Dossier = {
  bookingId: string;
  status: string;
  canDecide: boolean;
  decidableAt: string | null;
  money: { totalShipperCents: number; transportCents: number; commissionCents: number; premiumCents: number; currencyCode: string };
  dispute: { ticketNumber: string; resolution: unknown } | null;
};

async function dossier(ctx: Contexte, id: string): Promise<Dossier> {
  const r = await ctx.request.get(`${api()}/admin/disputes/${id}`);
  expect(r.ok(), `GET /admin/disputes/${id} : ${r.status()}`).toBe(true);
  return (await r.json()) as Dossier;
}

async function poserDelai(ctx: Contexte, heures: number): Promise<void> {
  const cur = (await (await ctx.request.get(`${api()}/admin/settings`)).json()) as { version: number; values: Record<string, number> };
  reouvrirLesLitigesSousUnDelai(heures); // A169 : l'échéance est figée à l'ouverture, le paramètre seul ne suffit plus
  if (cur.values[DELAI] === heures) return;
  const r = await ctx.request.patch(`${api()}/admin/settings`, { data: { changes: { [DELAI]: heures }, reason: "Recette ADM-MED : délai de réponse abaissé pour rendre un litige décidable.", expectedVersion: cur.version } });
  expect(r.ok(), `délai → ${heures} h : ${r.status()} ${r.ok() ? "" : await r.text()}`).toBe(true);
}

/** Le dossier devient décidable (cache des paramètres de 30 s côté deal-service). */
async function attendreDecidable(ctx: Contexte, id: string, attendu = true): Promise<Dossier> {
  let d!: Dossier;
  await expect.poll(async () => { d = await dossier(ctx, id); return d.canDecide; }, { timeout: 60_000, intervals: [3_000], message: `canDecide = ${attendu}` }).toBe(attendu);
  return d;
}

type Argent = { status: string; closedBy: string | null; completedBy: string | null; refundAmountCents: number | null; payoutStatus: string | null; payoutAmountCents: number | null; shipperId: string; carrierId: string; completedAt: string | null; closedAt: string | null; refundedAt: string | null };
const base = (bookingId: string) => lireCoteServeur<Argent & { outbox: Array<{ eventType: string; occurredAt: string }>; perdusExp: number; perdusVoy: number }>(`
  import prisma from "./packages/libs/prisma";
  (async () => {
    const b = await prisma.booking.findUnique({ where: { id: "${bookingId}" }, select: { status: true, closedBy: true, completedBy: true, refundAmountCents: true, payoutStatus: true, payoutAmountCents: true, shipperId: true, carrierId: true, completedAt: true, closedAt: true, refundedAt: true } });
    const outbox = await prisma.outboxEvent.findMany({ where: { aggregateId: "${bookingId}", eventType: "booking.dispute_resolved" }, select: { eventType: true, occurredAt: true } });
    const exp = await prisma.user.findUnique({ where: { id: b!.shipperId }, select: { shipperDisputesLostCount: true } });
    const voy = await prisma.carrierPage.findUnique({ where: { userId: b!.carrierId }, select: { disputesLostCount: true } });
    console.log("@@" + JSON.stringify({ ...b, outbox, perdusExp: exp?.shipperDisputesLostCount ?? 0, perdusVoy: voy?.disputesLostCount ?? 0 }));
    process.exit(0);
  })();`);

/**
 * Les remboursements RÉELLEMENT émis chez le fournisseur (FAKE, en mémoire du deal-service), lus par la fiche argent.
 * Piège : le FAKE indexe par intent, et l'intent d'un deal du jeu d'essai (`pi_fake_seed_<clé>`) est le MÊME d'un rejeu à
 * l'autre — la liste cumule les fiches précédentes. On compare donc toujours à un relevé pris juste avant le geste.
 */
async function remboursementsFournisseur(ctx: Contexte, id: string): Promise<number[]> {
  const r = await ctx.request.post(`${api()}/admin/deals/${id}/money/reconcile`);
  expect(r.ok(), `reconcile : ${r.status()}`).toBe(true);
  return (((await r.json()) as { live: { refunds: Array<{ amountCents: number }> } | null }).live?.refunds ?? []).map((x) => x.amountCents);
}

/** Choisit une issue, saisit le motif et ouvre le récapitulatif. */
async function preparerDecision(page: Page, issue: RegExp, motif = MOTIF, montant?: string): Promise<void> {
  const form = page.locator("section").filter({ has: page.getByRole("heading", { name: "Trancher", exact: true }) });
  await expect(form).toBeVisible({ timeout: 60_000 });
  await form.locator("label").filter({ hasText: issue }).locator('input[type="radio"]').check();
  if (montant !== undefined) await form.getByPlaceholder("ex. 15,00").fill(montant);
  await form.getByPlaceholder("Ce que les preuves montrent, ce qui a pesé, ce qui est décidé.").fill(motif);
  await form.getByRole("button", { name: "Voir le récapitulatif" }).click();
}

const recapitulatif = (page: Page) => page.locator("div").filter({ has: page.getByText("Récapitulatif des flux, avant validation définitive", { exact: true }) }).last();

test.describe("ADM-MED — médiation (cahier 02-ADMIN § 5.9)", () => {
  test.describe.configure({ mode: "default" }); // chaque fiche rejoue le jeu d'essai : un échec ne masque pas les suivantes

  test.beforeAll(() => {
    new JeuEssai().rejouer();
  });

  test.afterAll(() => {
    new JeuEssai().rejouer();
  });

  test("ADM-MED-1 · la file « À arbitrer »", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    const med = await navigateurAdmin("mediateur");
    const sup = await navigateurAdmin("super");
    const lecteur = await navigateurAdmin("finance");
    const { page } = med;
    try {
      const debut = await debutDuScenario();
      await page.goto(`${bo()}/disputes`, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "À arbitrer", exact: true })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText(/passé le délai de réponse \(paramètre « Délai de réponse au litige », 72 h par défaut\)/)).toBeVisible();
      await attendreLeChargement(page);
      const file = (await (await med.contexte.request.get(`${api()}/admin/disputes`)).json()) as { items: Array<{ bookingId: string; kind: string; ticketNumber: string | null }>; counts: { disputes: number; retentions: number } };
      test.info().annotations.push({ type: "constat", description: `file entière : ${file.counts.disputes} litige(s) · ${file.counts.retentions} retenue(s) — ${file.items.map((i) => i.ticketNumber ?? i.kind).join(", ")}` });
      const compteur = page.getByText(/^\d+ affiché\(s\) · file entière : \d+ litige\(s\) · \d+ retenue\(s\)$/);
      await expect(compteur).toHaveText(`${file.items.length} affiché(s) · file entière : ${file.counts.disputes} litige(s) · ${file.counts.retentions} retenue(s)`);
      await expect(page.locator("table thead th")).toHaveText(["Dossier", "Motif", "Corridor", "Parties", "Montant", "Ouvert", "Décision"]);
      const ligne = (texte: string) => page.locator("tbody tr").filter({ hasText: texte });
      await expect(ligne("YAM-2041")).toContainText("Contenu manquant");
      await expect(ligne("YAM-2041")).toContainText("Paris → Brazzaville");
      await expect(ligne("YAM-2041")).toContainText("Chinwe (Exp.) · Thomas (Voy.)");
      await expect(ligne("YAM-2041")).toContainText("J+1");
      await expect(ligne("YAM-2042")).toContainText("Londres → Lagos");
      await expect(ligne("YAM-2042")).toContainText("Mai (Exp.) · Adebayo (Voy.)");
      await expect(ligne("YAM-2042"), "délai de 72 h : attend le Voyageur").toContainText(/attend le Voyageur · \d+ h/);
      const retenue = page.locator("tbody tr").filter({ has: page.getByRole("link", { name: "Retenue", exact: true }) }).filter({ hasText: "Aminata" });
      await expect(retenue).toContainText("Annulation après le départ");
      await expect(retenue).toContainText("à trancher");
      await expect(retenue.locator("span").filter({ hasText: /^J\+\d+$/ }), "J+4 : pas encore rouge").not.toHaveClass(/text-red-600/);
      /* Le délai abaissé à 12 h : YAM-2041 (J−1) passe « sans réponse · à trancher », YAM-2042 (H−8) attend encore. */
      await poserDelai(sup.contexte, 12);
      await expect.poll(async () => {
        await page.reload({ waitUntil: "domcontentloaded" });
        await attendreLeChargement(page);
        return (await ligne("YAM-2041").innerText()).includes("sans réponse · à trancher");
      }, { timeout: 90_000, intervals: [5_000], message: "YAM-2041 décidable à 12 h" }).toBe(true);
      await expect(ligne("YAM-2042")).toContainText(/attend le Voyageur · [1-4] h/);
      /* Filtres : les compteurs de la file entière ne bougent jamais. */
      const entier = `file entière : ${file.counts.disputes} litige(s) · ${file.counts.retentions} retenue(s)`;
      const barre = page.locator("div.flex.flex-wrap").first();
      await barre.locator("select").nth(0).selectOption("RETENTION");
      await expect(page.locator("tbody tr")).toHaveCount(file.counts.retentions, { timeout: 30_000 });
      await expect(page.getByText(new RegExp(entier.replace(/[()]/g, "\\$&")))).toBeVisible();
      await barre.locator("select").nth(0).selectOption("");
      await barre.getByPlaceholder("origine").fill("lond");
      await expect(page.locator("tbody tr")).toHaveCount(1, { timeout: 30_000 });
      await barre.getByPlaceholder("origine").fill("");
      await barre.getByPlaceholder("destination").fill("brazza");
      await expect.poll(() => page.locator("tbody tr").count(), { timeout: 30_000 }).toBe(file.items.filter((i) => i.ticketNumber !== "YAM-2042").length);
      await barre.getByPlaceholder("destination").fill("");
      await barre.locator("select").nth(1).selectOption("3");
      await expect(page.locator("tbody tr"), "ouvert il y a + de 3 j : la retenue (J−4) seule").toHaveCount(1, { timeout: 30_000 });
      /* Amélioration : un filtre sans résultat garde les compteurs de la file entière. */
      await barre.locator("select").nth(1).selectOption("14");
      await expect(page.getByText("Rien à arbitrer avec ces filtres.")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(new RegExp(`0 affiché\\(s\\) · ${entier.replace(/[()]/g, "\\$&")}`)), "compteurs visibles même sans résultat").toBeVisible();
      await barre.locator("select").nth(1).selectOption("");
      await barre.locator("select").nth(2).selectOption("1");
      await expect(ligne("YAM-2042"), "décidables maintenant : YAM-2042 exclu").toHaveCount(0, { timeout: 30_000 });
      await expect(ligne("YAM-2041")).toHaveCount(1);
      /* Les deux paramètres d'URL présélectionnent leur filtre. */
      await page.goto(`${bo()}/disputes?kind=RETENTION`, { waitUntil: "domcontentloaded" });
      await expect(page.locator("select").nth(0)).toHaveValue("RETENTION", { timeout: 60_000 });
      await page.goto(`${bo()}/disputes?decidable=1`, { waitUntil: "domcontentloaded" });
      await expect(page.locator("select").nth(2)).toHaveValue("1", { timeout: 60_000 });
      expect((await lireLeJournal(lecteur.contexte.request, { from: debut, adminUserId: jeuEssai.admin("mediateur").id })).map((l) => l.action), "la file n'écrit rien").toEqual([]);
    } finally {
      await poserDelai(sup.contexte, 72);
    }
  });

  test("ADM-MED-2 · ouvrir un dossier de médiation", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(5 * 60_000);
    const med = await navigateurAdmin("mediateur");
    const fin = await navigateurAdmin("finance");
    const id = jeuEssai.deal("bzv-disputed").id;
    // A168 (§ 5.18) — `attendreDecidable` lit le dossier par l'API (une ouverture journalisée) : le scénario commence avant.
    const debut = await debutDuScenario();
    await attendreDecidable(med.contexte, id, false); // le délai de 72 h relu (cache de 30 s après la fiche précédente)
    const { page } = med;
    const reponses: string[] = [];
    page.on("response", async (r) => { if (r.url().includes(`/admin/disputes/${id}`)) reponses.push(await r.text().catch(() => "")); });
    await page.goto(`${bo()}/disputes/${id}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "YAM-2041", exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Paris → Brazzaville · DISPUTED")).toBeVisible();
    await expect(page.getByRole("link", { name: "← À arbitrer" })).toHaveAttribute("href", "/disputes");
    await expect(page.getByText(/^Version du Voyageur attendue jusqu'au .+ — décision possible dès sa réponse ou à l'échéance\.$/)).toBeVisible();
    const titres = (await page.locator("section h2").allInnerTexts()).map((t) => t.trim().toLowerCase());
    for (const attendu of ["chronologie", "argent", "expéditeur", "voyageur", "colis déclaré", "prise en charge ·", "signalement yam-2041 · contenu manquant"]) {
      expect(titres.some((t) => t.startsWith(attendu)), `bloc « ${attendu} » (vus : ${titres.join(" | ")})`).toBe(true);
    }
    /* Écarts documentaires (le code fait foi) : avant l'échéance, « Trancher » cède la place à la date de décision ; « Jalons
       du voyage » et « Remise » n'apparaissent que s'il y a des jalons ou des photos de remise — le jeu d'essai n'en pose pas. */
    await expect(page.getByText(/^Décision possible à partir du .+ \(délai de réponse laissé au Voyageur\), ou dès sa réponse\.$/)).toBeVisible();
    const absents = ["trancher", "jalons du voyage", "remise"].filter((b) => !titres.some((t) => t === b || t.startsWith(`${b} `)));
    test.info().annotations.push({ type: "écart documentaire", description: `blocs du cahier absents sur YAM-2041 non décidable : ${absents.join(", ") || "aucun"} — vus : ${titres.join(" | ")}` });
    const signalement = page.locator("section").filter({ has: page.getByRole("heading", { name: /^Signalement YAM-2041/ }) });
    await expect(signalement).toContainText("deux des trois jouets prévus ne sont pas dans le carton");
    await expect(signalement).toContainText("Remboursement partiel");
    await expect(signalement).toContainText("Engagement sur l'honneur");
    /* Amélioration : la catégorie du colis et l'état du versement en français. */
    await expect(page.locator("section").filter({ has: page.getByRole("heading", { name: "Colis déclaré" }) })).toContainText("Petits jouets");
    await expect(page.locator("section").filter({ has: page.getByRole("heading", { name: "Argent" }) })).toContainText("gelé (litige)");
    /* Le code de livraison n'apparaît NULLE PART : ni dans la page, ni dans la réponse de l'API. */
    expect(await page.content(), "code de livraison dans la page").not.toContain(CODE_LIVRAISON);
    expect(reponses.join("\n"), "code de livraison dans l'API du dossier").not.toContain(CODE_LIVRAISON);
    await expect(page.getByRole("link", { name: "Lire la conversation des deux parties →" })).toBeVisible();
    await expect(page.getByText("Lecture journalisée.")).toBeVisible();
    await fin.page.goto(`${bo()}/disputes/${id}`, { waitUntil: "domcontentloaded" });
    await expect(fin.page.getByRole("heading", { name: "YAM-2041", exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(fin.page.getByRole("link", { name: "Lire la conversation des deux parties →" }), "absent pour la Finance").toHaveCount(0);
    const vues = (await lireLeJournal(fin.contexte.request, { from: debut, adminUserId: jeuEssai.admin("mediateur").id })).filter((l) => l.action === "DISPUTE_VIEWED");
    expect(vues.length, "DISPUTE_VIEWED écrit").toBeGreaterThanOrEqual(1);
    expect(`${vues[0].targetType} · ${vues[0].targetId}`).toBe(`BOOKING · ${id}`);
    expect(vues[0].after).toEqual({ kind: "DISPUTE", ticketNumber: "YAM-2041" });
  });

  test("ADM-MED-3 · les gardes du formulaire de décision", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    const med = await navigateurAdmin("mediateur");
    const support = await navigateurAdmin("support");
    const fin = await navigateurAdmin("finance");
    const sup = await navigateurAdmin("super");
    const d2041 = jeuEssai.deal("bzv-disputed").id;
    const d2042 = jeuEssai.deal("los-disputed").id;
    const debut = await debutDuScenario();
    try {
      /* 1. Support : lecture seule. */
      await support.page.goto(`${bo()}/disputes/${d2041}`, { waitUntil: "domcontentloaded" });
      await expect(support.page.getByText("Ton profil lit ce dossier mais ne tranche pas (médiateur ou super administrateur).", { exact: true })).toBeVisible({ timeout: 60_000 });
      /* 2. YAM-2042, avant l'échéance : date affichée, appel direct 409 portant decidableAt. */
      await med.page.goto(`${bo()}/disputes/${d2042}`, { waitUntil: "domcontentloaded" });
      await expect(med.page.getByText(/^Décision possible à partir du .+ \(délai de réponse laissé au Voyageur\), ou dès sa réponse\.$/)).toBeVisible({ timeout: 60_000 });
      const trop = await med.contexte.request.post(`${api()}/admin/disputes/${d2042}/resolve`, { data: { outcome: "REJECTED", reason: MOTIF }, failOnStatusCode: false });
      expect(trop.status(), "avant l'échéance : 409").toBe(409);
      const corps = (await trop.json()) as { details?: { code?: string; decidableAt?: string } };
      expect(corps.details?.code).toBe("TRANSITION_NOT_ALLOWED");
      expect(corps.details?.decidableAt, "la date decidableAt est portée").toMatch(/^\d{4}-\d{2}-\d{2}T/);
      /* 3. YAM-2041 décidable (délai 12 h). */
      await poserDelai(sup.contexte, 12);
      const d = await attendreDecidable(med.contexte, d2041);
      const total = d.money.totalShipperCents;
      await med.page.goto(`${bo()}/disputes/${d2041}`, { waitUntil: "domcontentloaded" });
      const form = med.page.locator("section").filter({ has: med.page.getByRole("heading", { name: "Trancher", exact: true }) });
      await expect(form).toBeVisible({ timeout: 60_000 });
      await form.locator("label").filter({ hasText: /^Remboursement partiel/ }).locator('input[type="radio"]').check();
      const borne = `entre 0,01 et ${euros(total - 1)}`;
      await expect(form).toContainText(`Montant libre entre 0,01 et ${euros(total - 1)}`);
      for (const saisi of ["0", euros(total)]) {
        await form.getByPlaceholder("ex. 15,00").fill(saisi);
        await expect(form.getByText(new RegExp(borne.replace(/[,]/g, "[,.]"))).last(), `« ${saisi} » refusé`).toBeVisible();
      }
      /* Côté serveur, les mêmes bornes. */
      for (const cents of [total]) {
        const r = await med.contexte.request.post(`${api()}/admin/disputes/${d2041}/resolve`, { data: { outcome: "PARTIAL_REFUND", refundCents: cents, reason: MOTIF }, failOnStatusCode: false });
        expect(r.status(), `refundCents ${cents} : 400`).toBe(400);
        expect(((await r.json()) as { details?: { code?: string } }).details?.code).toBe("PARTIAL_REFUND_OUT_OF_BOUNDS");
      }
      /* 5. Motif < 50 : bouton inactif, compteur. */
      await form.getByPlaceholder("ex. 15,00").fill("5,00");
      await form.getByPlaceholder("Ce que les preuves montrent, ce qui a pesé, ce qui est décidé.").fill("Trop court pour être un motif.");
      await expect(form.getByRole("button", { name: "Voir le récapitulatif" })).toBeDisabled();
      await expect(form).toContainText("30 / 50 min");
      /* 6. Finance : 403. */
      const finance = await fin.contexte.request.post(`${api()}/admin/disputes/${d2041}/resolve`, { data: { outcome: "REJECTED", reason: MOTIF }, failOnStatusCode: false });
      expect(finance.status(), "Finance : 403").toBe(403);
      /* Amélioration : un refus du serveur s'affiche en français, par son code (ici : la décision est refusée pendant que le
         délai est remonté à 72 h dans un autre onglet). */
      await form.getByPlaceholder("Ce que les preuves montrent, ce qui a pesé, ce qui est décidé.").fill(MOTIF);
      await poserDelai(sup.contexte, 72);
      await attendreDecidable(med.contexte, d2041, false);
      await form.getByRole("button", { name: "Voir le récapitulatif" }).click();
      await recapitulatif(med.page).getByRole("button", { name: "Valider définitivement" }).click();
      await expect(form.getByText(/^Le délai de réponse du Voyageur court encore : décision possible à partir du .+\.$/), "refus traduit").toBeVisible({ timeout: 30_000 });
      const ecrites = (await lireLeJournal(fin.contexte.request, { from: debut })).filter((l) => l.action === "DISPUTE_RESOLVED");
      expect(ecrites, "aucune décision").toEqual([]);
      expect((await base(d2041)).status, "YAM-2041 toujours DISPUTED").toBe("DISPUTED");
    } finally {
      await poserDelai(sup.contexte, 72);
    }
  });

  test("ADM-MED-4 · trancher un litige : rejet", async ({ navigateurAdmin, mailpit, jeuEssai }) => {
    test.setTimeout(8 * 60_000);
    const med = await navigateurAdmin("mediateur");
    const sup = await navigateurAdmin("super");
    const fin = await navigateurAdmin("finance");
    const id = jeuEssai.deal("bzv-disputed").id;
    const avant = await base(id);
    try {
      await poserDelai(sup.contexte, 12);
      const d = await attendreDecidable(med.contexte, id);
      const { totalShipperCents: total, transportCents: net, commissionCents: commission, premiumCents: prime } = d.money;
      const debut = await debutDuScenario();
      const refundsAvant = await remboursementsFournisseur(fin.contexte, id);
      const avantMails = { chinwe: await mailpit.compter({ pour: "chinwe.shipper@seed.yamba.dev", sujet: "Décision rendue" }), thomas: await mailpit.compter({ pour: "thomas.carrier@seed.yamba.dev", sujet: "Décision rendue" }) };
      const { page } = med;
      await page.goto(`${bo()}/disputes/${id}`, { waitUntil: "domcontentloaded" });
      const argent = page.locator("section").filter({ has: page.getByRole("heading", { name: "Argent" }) });
      await expect(argent).toContainText(euros(total), { timeout: 60_000 });
      await expect(argent).toContainText(euros(net));
      await expect(argent).toContainText(euros(commission));
      const form = page.locator("section").filter({ has: page.getByRole("heading", { name: "Trancher", exact: true }) });
      await expect(form).toContainText(`Voyageur : ${euros(net)}`);
      await expect(form).toContainText(`Yamba garde ${euros(total - net)}`);
      await preparerDecision(page, /^Rejet : le Voyageur est payé en entier/);
      const recap = recapitulatif(page);
      await expect(recap).toContainText(`Remboursé à l'Expéditeur (Chinwe) : 0,00`);
      await expect(recap).toContainText(`Versé au Voyageur (Thomas) : ${euros(net)}`);
      await expect(recap).toContainText(`Conservé par Yamba : ${euros(commission + prime)}`);
      await expect(recap).toContainText("Issue : Rejet : le Voyageur est payé en entier. Motif : « Recette ADM-MED");
      await recap.getByRole("button", { name: "Valider définitivement" }).click();
      const ok = page.locator("section").filter({ has: page.getByRole("heading", { name: "Décision enregistrée" }) });
      await expect(ok).toBeVisible({ timeout: 60_000 });
      await expect(ok).toContainText(new RegExp(`Rejet : le Voyageur est payé en entier · statut final : Terminée · remboursé 0,00\\s*€ · versé ${euros(net)}\\s*€ \\(versement (envoyé|en attente d'envoi|en échec)\\)`));
      await expect(ok).toContainText("Les deux parties sont prévenues (écran, notification, email).");
      const apres = await base(id);
      expect(apres.status).toBe("COMPLETED");
      expect(apres.completedBy, "fermé par ADMIN").toBe("ADMIN");
      expect(apres.refundAmountCents ?? 0, "rien remboursé").toBe(0);
      expect(apres.payoutAmountCents).toBe(net);
      expect(["PENDING", "SENT", "FAILED"], `versement ${apres.payoutStatus}`).toContain(apres.payoutStatus);
      test.info().annotations.push({ type: "constat", description: `versement après décision : ${apres.payoutStatus}` });
      expect(apres.perdusExp, "Chinwe (Expéditeur condamné) +1").toBe(avant.perdusExp + 1);
      expect(apres.perdusVoy, "Thomas inchangé").toBe(avant.perdusVoy);
      expect(apres.outbox.length, "un événement booking.dispute_resolved").toBe(1);
      expect(apres.outbox[0].occurredAt, "écrit dans la transaction de la transition (même horodatage)").toBe(apres.completedAt);
      expect((await remboursementsFournisseur(fin.contexte, id)).slice(refundsAvant.length), "aucun remboursement émis").toEqual([]);
      /* 10. Une décision est unique. */
      const encore = await med.contexte.request.post(`${api()}/admin/disputes/${id}/resolve`, { data: { outcome: "REJECTED", reason: MOTIF }, failOnStatusCode: false });
      expect(encore.status(), "seconde décision : 409").toBe(409);
      /* 11. Deux emails, chacun avec SON montant et le motif intégral. */
      const mailChinwe = await mailpit.attendreEmail({ pour: "chinwe.shipper@seed.yamba.dev", sujet: "Décision rendue sur ton envoi" }, 90_000);
      const mailThomas = await mailpit.attendreEmail({ pour: "thomas.carrier@seed.yamba.dev", sujet: "Décision rendue sur ton transport" }, 90_000);
      expect(await mailpit.compter({ pour: "chinwe.shipper@seed.yamba.dev", sujet: "Décision rendue" })).toBe(avantMails.chinwe + 1);
      expect(await mailpit.compter({ pour: "thomas.carrier@seed.yamba.dev", sujet: "Décision rendue" })).toBe(avantMails.thomas + 1);
      expect(mailChinwe.texte).toContain("le Voyageur est payé en entier");
      expect(mailThomas.texte.replace(/ | /g, " ")).toContain(euros(net));
      for (const m of [mailChinwe, mailThomas]) {
        expect(m.texte.replace(/\s+/g, " "), "motif intégral").toContain(MOTIF);
        expect(m.texte, "jamais le code de livraison").not.toContain(CODE_LIVRAISON);
      }
      /* Le deal clos par médiation ne se note pas. */
      const chinwe = lireCoteServeur<{ ratingWindowEndsAt: string | null }>(`
        import prisma from "./packages/libs/prisma";
        (async () => { console.log("@@" + JSON.stringify(await prisma.booking.findUnique({ where: { id: "${id}" }, select: { ratingWindowEndsAt: true } }))); process.exit(0); })();`);
      expect(chinwe.ratingWindowEndsAt, "aucune fenêtre de notation").toBeNull();
      const journal = (await lireLeJournal(fin.contexte.request, { from: debut, adminUserId: jeuEssai.admin("mediateur").id })).filter((l) => l.action === "DISPUTE_RESOLVED");
      expect(journal.length).toBe(1);
      expect(`${journal[0].targetType} · ${journal[0].targetId}`).toBe(`BOOKING · ${id}`);
      expect(journal[0].before).toEqual({ status: "DISPUTED", ticketNumber: "YAM-2041" });
      expect(journal[0].after).toEqual({ finalStatus: "COMPLETED", outcome: "REJECTED", refundCents: 0, carrierPayoutCents: net });
    } finally {
      await poserDelai(sup.contexte, 72);
      new JeuEssai().rejouer();
    }
  });

  test("ADM-MED-5 · trancher un litige : remboursement partiel", async ({ navigateurAdmin, navigateurConnecte, jeuEssai }) => {
    test.setTimeout(8 * 60_000);
    const med = await navigateurAdmin("mediateur");
    const fin = await navigateurAdmin("finance");
    const id = jeuEssai.deal("los-disputed").id;
    const avant = await base(id);
    /* Manœuvre par un geste réel : Adebayo dépose sa version depuis son espace → décidable. */
    const adebayo = await navigateurConnecte("adebayo");
    const version = await adebayo.contexte.request.post(`${adresseDeLApi()}/deals/${id}/dispute/statement`, { data: { statement: "Le colis a été remis fermé, scellé comme à la prise en charge ; je n'ai jamais ouvert le carton pendant le trajet.", photoUrls: [] } });
    expect(version.ok(), `version du Voyageur : ${version.status()} ${version.ok() ? "" : await version.text()}`).toBe(true);
    const d = await attendreDecidable(med.contexte, id);
    const { totalShipperCents: total, transportCents: net } = d.money;
    const montant = Math.floor(total / 2);
    expect(montant, "le cahier : un montant inférieur au net").toBeLessThan(net);
    const refundsAvant = await remboursementsFournisseur(fin.contexte, id);
    const debut = await debutDuScenario();
    const { page } = med;
    await page.goto(`${bo()}/disputes/${id}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/^Version du Voyageur reçue le .+ — décision possible\.$/)).toBeVisible({ timeout: 60_000 });
    await preparerDecision(page, /^Remboursement partiel/, MOTIF, euros(montant));
    const recap = recapitulatif(page);
    const versé = Math.max(0, net - montant);
    const gardé = total - montant - versé;
    await expect(recap).toContainText(`Remboursé à l'Expéditeur (Mai) : ${euros(montant)}`);
    await expect(recap).toContainText(`Versé au Voyageur (Adebayo) : ${euros(versé)}`);
    await expect(recap).toContainText(`Conservé par Yamba : ${euros(gardé)}`);
    expect(montant + versé + gardé, "les trois lignes totalisent le payé").toBe(total);
    await recap.getByRole("button", { name: "Valider définitivement" }).click();
    await expect(page.getByRole("heading", { name: "Décision enregistrée" })).toBeVisible({ timeout: 60_000 });
    const apres = await base(id);
    expect(apres.status).toBe("COMPLETED");
    expect(apres.refundAmountCents).toBe(montant);
    expect(apres.payoutAmountCents).toBe(versé);
    expect(apres.perdusVoy, "le Voyageur est condamné dès qu'il y a remboursement").toBe(avant.perdusVoy + 1);
    expect(apres.perdusExp).toBe(avant.perdusExp);
    expect((await remboursementsFournisseur(fin.contexte, id)).slice(refundsAvant.length), "UN remboursement du montant saisi").toEqual([montant]);
    expect(new Date(apres.refundedAt!).getTime(), "remboursement puis versement : l'argent part avant la transition").toBeLessThanOrEqual(new Date(apres.completedAt!).getTime());
    /* Côté Mai : le portefeuille. */
    const mai = await navigateurConnecte("mai");
    const wallet = (await (await mai.contexte.request.get(`${adresseDeLApi()}/me/wallet`)).json()) as { shipper: { items: Array<{ bookingId: string; state: string; refundAmountCents: number | null; retentionCents: number | null; keptCents?: number | null; partialKind?: string | null }> } };
    const ligne = wallet.shipper.items.find((i) => i.bookingId === id);
    expect(ligne, "le deal est dans le portefeuille de Mai").toBeTruthy();
    expect(ligne!.state).toBe("PARTIALLY_REFUNDED");
    expect(ligne!.refundAmountCents, "part rendue « remboursée »").toBe(montant);
    // ANO-ADM-36 (02-ADMIN § 5.15) — une médiation après la fin du deal n'est pas une retenue d'annulation.
    expect(ligne!.keptCents, "part gardée « dépensée »").toBe(total - montant);
    expect(ligne!.partialKind).toBe("AFTER_COMPLETION");
    expect(ligne!.retentionCents, "jamais une « retenue »").toBeNull();
    const journal = (await lireLeJournal(fin.contexte.request, { from: debut, adminUserId: jeuEssai.admin("mediateur").id })).filter((l) => l.action === "DISPUTE_RESOLVED");
    expect(journal[0].after).toEqual({ finalStatus: "COMPLETED", outcome: "PARTIAL_REFUND", refundCents: montant, carrierPayoutCents: versé });
    new JeuEssai().rejouer();
  });

  test("ADM-MED-6 · trancher un litige : remboursement total", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(8 * 60_000);
    const med = await navigateurAdmin("mediateur");
    const sup = await navigateurAdmin("super");
    const fin = await navigateurAdmin("finance");
    const id = jeuEssai.deal("bzv-disputed").id;
    const avant = await base(id);
    try {
      await poserDelai(sup.contexte, 12);
      const d = await attendreDecidable(med.contexte, id);
      const total = d.money.totalShipperCents;
      const refundsAvant = await remboursementsFournisseur(fin.contexte, id);
      const debut = await debutDuScenario();
      const { page } = med;
      await page.goto(`${bo()}/disputes/${id}`, { waitUntil: "domcontentloaded" });
      const form = page.locator("section").filter({ has: page.getByRole("heading", { name: "Trancher", exact: true }) });
      await expect(form).toContainText(`Expéditeur : ${euros(total)}`, { timeout: 60_000 });
      await expect(form).toContainText("(commission comprise) · Voyageur : 0");
      await preparerDecision(page, /^Remboursement total : le Voyageur ne reçoit rien/);
      await expect(recapitulatif(page)).toContainText(`Remboursé à l'Expéditeur (Chinwe) : ${euros(total)}`);
      await expect(recapitulatif(page)).toContainText("Conservé par Yamba : 0,00");
      await recapitulatif(page).getByRole("button", { name: "Valider définitivement" }).click();
      await expect(page.getByRole("heading", { name: "Décision enregistrée" })).toBeVisible({ timeout: 60_000 });
      const apres = await base(id);
      expect(apres.status).toBe("CANCELLED");
      expect(apres.closedBy).toBe("ADMIN");
      expect(apres.refundAmountCents, "commission rendue elle aussi").toBe(total);
      expect(apres.payoutAmountCents ?? 0).toBe(0);
      expect(apres.payoutStatus).toBeNull();
      expect(apres.perdusVoy).toBe(avant.perdusVoy + 1);
      expect((await remboursementsFournisseur(fin.contexte, id)).slice(refundsAvant.length)).toEqual([total]);
      const journal = (await lireLeJournal(fin.contexte.request, { from: debut, adminUserId: jeuEssai.admin("mediateur").id })).filter((l) => l.action === "DISPUTE_RESOLVED");
      expect(journal[0].after).toEqual({ finalStatus: "CANCELLED", outcome: "FULL_REFUND", refundCents: total, carrierPayoutCents: 0 });
    } finally {
      await poserDelai(sup.contexte, 72);
      new JeuEssai().rejouer();
    }
  });

  test("ADM-MED-7 · deux décisions simultanées : une seule décision, un seul remboursement", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    const med = await navigateurAdmin("mediateur");
    const sup = await navigateurAdmin("super");
    const fin = await navigateurAdmin("finance");
    const id = jeuEssai.deal("bzv-disputed").id;
    try {
      await poserDelai(sup.contexte, 12);
      const d = await attendreDecidable(med.contexte, id);
      const part = Math.floor(d.money.totalShipperCents / 4);
      const refundsAvant = await remboursementsFournisseur(fin.contexte, id);
      const debut = await debutDuScenario();
      /* Le Médiateur et le super administrateur valident au même instant, deux montants différents. */
      const [a, b] = await Promise.all([
        med.contexte.request.post(`${api()}/admin/disputes/${id}/resolve`, { data: { outcome: "PARTIAL_REFUND", refundCents: part, reason: MOTIF }, failOnStatusCode: false }),
        sup.contexte.request.post(`${api()}/admin/disputes/${id}/resolve`, { data: { outcome: "PARTIAL_REFUND", refundCents: part * 2, reason: MOTIF }, failOnStatusCode: false }),
      ]);
      const statuts = [a.status(), b.status()].sort();
      const emis = (await remboursementsFournisseur(fin.contexte, id)).slice(refundsAvant.length);
      test.info().annotations.push({ type: "constat", description: `statuts : ${statuts.join(" + ")} ; remboursements émis : [${emis.join(", ")}] — ${await a.text()} | ${await b.text()}`.slice(0, 700) });
      expect(statuts, "une décision passe, l'autre est refusée (409)").toEqual([200, 409]);
      expect(emis.length, `remboursements émis chez le fournisseur : ${emis.join(", ")}`).toBe(1);
      const apres = await base(id);
      expect(apres.refundAmountCents, "la base = le seul remboursement émis").toBe(emis[0]);
      const decisions = (await lireLeJournal(fin.contexte.request, { from: debut })).filter((l) => l.action === "DISPUTE_RESOLVED");
      expect(decisions.length, "une seule ligne de décision").toBe(1);
      const perdant = (await (a.status() === 409 ? b : a).json()) as { refundCents: number };
      expect(perdant.refundCents).toBe(emis[0]);
    } finally {
      await poserDelai(sup.contexte, 72);
      new JeuEssai().rejouer();
    }
  });

  test("ADM-MED-8 · un dossier tranché se relit, décision comprise", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    const med = await navigateurAdmin("mediateur");
    const sup = await navigateurAdmin("super");
    const fin = await navigateurAdmin("finance");
    const id = jeuEssai.deal("bzv-disputed").id;
    try {
      await poserDelai(sup.contexte, 12);
      await attendreDecidable(med.contexte, id);
      const r = await med.contexte.request.post(`${api()}/admin/disputes/${id}/resolve`, { data: { outcome: "REJECTED", reason: MOTIF } });
      expect(r.ok(), `décision : ${r.status()}`).toBe(true);
      const debut = await debutDuScenario();
      /* Le Médiateur revient sur le dossier depuis l'historique, ou la Finance l'ouvre pour comprendre un versement. */
      await fin.page.goto(`${bo()}/disputes/${id}`, { waitUntil: "domcontentloaded" });
      await expect(fin.page.getByRole("heading", { name: "YAM-2041", exact: true }), "le dossier tranché s'ouvre").toBeVisible({ timeout: 60_000 });
      const decision = fin.page.locator("section").filter({ has: fin.page.getByRole("heading", { name: "Décision rendue" }) });
      await expect(decision).toContainText("Rejet : le Voyageur est payé en entier");
      await expect(decision).toContainText(MOTIF);
      await expect(fin.page.getByText("Ce dossier est déjà tranché.")).toBeVisible();
      await expect(fin.page.getByText(/Version du Voyageur attendue jusqu'au/), "plus de bandeau d'attente").toHaveCount(0);
      const vue = (await lireLeJournal(fin.contexte.request, { from: debut, adminUserId: jeuEssai.admin("finance").id })).find((l) => l.action === "DISPUTE_VIEWED");
      expect(vue, "la relecture est journalisée").toBeTruthy();
      /* La file ne le montre plus. */
      const file = (await (await med.contexte.request.get(`${api()}/admin/disputes`)).json()) as { items: Array<{ bookingId: string }> };
      expect(file.items.map((i) => i.bookingId)).not.toContain(id);
      /* Un deal qui n'a jamais été en médiation reste introuvable. */
      const jamais = await med.contexte.request.get(`${api()}/admin/disputes/${jeuEssai.deal("bzv-accepted").id}`, { failOnStatusCode: false });
      expect(jamais.status()).toBe(404);
    } finally {
      await poserDelai(sup.contexte, 72);
      new JeuEssai().rejouer();
    }
  });

  test("ADM-MED-9 · un remboursement partiel supérieur au net : ce que lisent les deux parties", async ({ navigateurAdmin, mailpit, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    const med = await navigateurAdmin("mediateur");
    const sup = await navigateurAdmin("super");
    const id = jeuEssai.deal("bzv-disputed").id;
    try {
      await poserDelai(sup.contexte, 12);
      const d = await attendreDecidable(med.contexte, id);
      const { totalShipperCents: total, transportCents: net } = d.money;
      const montant = net + Math.floor((total - net) / 2); // au-delà du net : le Voyageur ne reçoit rien, Yamba garde le reste
      const avant = await mailpit.compter({ pour: "chinwe.shipper@seed.yamba.dev", sujet: "Décision rendue" });
      const avantThomas = await mailpit.compter({ pour: "thomas.carrier@seed.yamba.dev", sujet: "Décision rendue" }); // § 5.20 : attendre SON email, pas celui d'une fiche précédente
      const r = await med.contexte.request.post(`${api()}/admin/disputes/${id}/resolve`, { data: { outcome: "PARTIAL_REFUND", refundCents: montant, reason: MOTIF } });
      expect(r.ok()).toBe(true);
      expect(((await r.json()) as { carrierPayoutCents: number }).carrierPayoutCents).toBe(0);
      await expect.poll(() => mailpit.compter({ pour: "chinwe.shipper@seed.yamba.dev", sujet: "Décision rendue" }), { timeout: 90_000 }).toBe(avant + 1);
      await expect.poll(() => mailpit.compter({ pour: "thomas.carrier@seed.yamba.dev", sujet: "Décision rendue" }), { timeout: 90_000 }).toBe(avantThomas + 1);
      const chinwe = await mailpit.attendreEmail({ pour: "chinwe.shipper@seed.yamba.dev", sujet: "Décision rendue sur ton envoi" });
      const thomas = await mailpit.attendreEmail({ pour: "thomas.carrier@seed.yamba.dev", sujet: "Décision rendue sur ton transport" });
      test.info().annotations.push({ type: "constat", description: `Chinwe : « ${chinwe.texte.replace(/\s+/g, " ").slice(0, 260)} »` });
      expect(chinwe.texte, "l'Expéditrice ne lit pas « le reste est versé au Voyageur » quand il ne reçoit rien").not.toContain("Le reste est versé au Voyageur");
      expect(thomas.texte).toContain("Aucun versement ne te revient sur ce deal.");
    } finally {
      await poserDelai(sup.contexte, 72);
      new JeuEssai().rejouer();
    }
  });
});
