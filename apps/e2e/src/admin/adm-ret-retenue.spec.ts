/**
 * adm-ret-retenue.spec.ts — cahier 02-ADMIN, § 5.10 « Retenue d'annulation tardive » (ADM-RET-1 à 2, + 3 et 4 ajoutées)
 * ====================================================================================================================
 * Une annulation après le départ sans prise en charge laisse une retenue « à arbitrer » (`HELD_FOR_MEDIATION`, ANN-01) :
 * le Médiateur la verse au Voyageur au prorata de sa part nette, ou la restitue en entier à l'Expéditeur. Le deal reste
 * CANCELLED ; seul l'argent bouge. Chaque arbitrage est donc vérifié à six endroits : l'écran (indice, récapitulatif,
 * dossier relu), l'API, la base (disposition, montants, outbox), le fournisseur (remboursement ou transfert RÉELLEMENT
 * émis, lu par le rapprochement), le journal, et ce que lisent les deux parties (emails, portefeuilles).
 *
 * Terrain mesuré avant d'écrire (seed) : `bzv-held`, Aminata → Thomas, Paris → Brazzaville, payé 29,12 € (net 26,00 €,
 * commission 3,12 €), annulé à J−4 « Le Voyageur ne s'est pas présenté au rendez-vous », remboursé 14,56 €, retenue
 * 14,56 € → compensation attendue round(1456 × 2600 / 2912) = 13,00 €, Yamba garde 1,56 €.
 *
 * Fiches ajoutées : ADM-RET-3 (les gardes : profil, motif, issue inconnue, second arbitrage, deal sans retenue, deux
 * restitutions simultanées → un seul remboursement), ADM-RET-4 (ce que lisent les deux parties : emails exacts,
 * portefeuilles).
 */
import { test, expect, type NavigateurAdmin } from "../fixtures/yamba";
import { JeuEssai } from "../fixtures/jeu-essai";
import { COMPTES } from "../fixtures/comptes";
import { adresseDeLApi, adresseDeLApiAdmin, adresseDuBackOffice } from "../fixtures/adresses";
import { lireLeJournal } from "../pages/journal-admin";
import { attendreLeChargement, debutDuScenario, lireCoteServeur } from "../pages/ecran-admin";

const api = () => adresseDeLApiAdmin();
const bo = () => adresseDuBackOffice();
type Contexte = NavigateurAdmin["contexte"];
type Page = NavigateurAdmin["page"];

const MOTIF = "Recette ADM-RET : l'annulation tardive a été relue, les échanges des deux parties et l'horodatage du rendez-vous comparés.";
const AMINATA = COMPTES.aminata.email;
const THOMAS = COMPTES.thomas.email;

type Dossier = {
  bookingId: string;
  kind: string;
  canDecide: boolean;
  money: { totalShipperCents: number; transportCents: number; refundAmountCents: number | null; retentionCents: number | null; retentionDisposition: string | null; currencyCode: string };
  proposedAmounts: { compensateCarrierCents: number | null; restituteShipperCents: number | null };
  retentionDecision: { outcome: string; reason: string; decidedAt: string } | null;
};

async function dossier(ctx: Contexte, id: string): Promise<Dossier> {
  const r = await ctx.request.get(`${api()}/admin/disputes/${id}`);
  expect(r.ok(), `GET /admin/disputes/${id} : ${r.status()}`).toBe(true);
  return (await r.json()) as Dossier;
}

type Base = {
  status: string; retentionCents: number | null; retentionDisposition: string | null; retentionDecisionReason: string | null; retentionDecidedAt: string | null;
  refundAmountCents: number | null; refundId: string | null; payoutStatus: string | null; payoutAmountCents: number | null; transferId: string | null;
  outbox: Array<{ eventType: string; payload: { kind?: string; outcome?: string; refundCents?: number; carrierPayoutCents?: number; finalStatus?: string } }>;
};
const base = (id: string) => lireCoteServeur<Base>(`
  import prisma from "./packages/libs/prisma";
  (async () => {
    const b = await prisma.booking.findUnique({ where: { id: "${id}" }, select: { status: true, retentionCents: true, retentionDisposition: true, retentionDecisionReason: true, retentionDecidedAt: true, refundAmountCents: true, refundId: true, payoutStatus: true, payoutAmountCents: true, transferId: true } });
    const outbox = await prisma.outboxEvent.findMany({ where: { aggregateId: "${id}", eventType: { in: ["booking.dispute_resolved", "booking.payout_sent"] } }, select: { eventType: true, payload: true }, orderBy: { occurredAt: "asc" } });
    console.log("@@" + JSON.stringify({ ...b, outbox }));
    process.exit(0);
  })();`);

/** Ce que le fournisseur a RÉELLEMENT émis (FAKE en mémoire du deal-service, cumulé d'un rejeu à l'autre : on compare). */
async function fournisseur(ctx: Contexte, id: string): Promise<{ refunds: number[]; transfer: number | null; introuvable: boolean }> {
  const r = await ctx.request.post(`${api()}/admin/deals/${id}/money/reconcile`);
  expect(r.ok(), `reconcile : ${r.status()}`).toBe(true);
  const corps = (await r.json()) as { live: { refunds: Array<{ amountCents: number }>; transfer: { amountCents: number } | null } | null; divergences: Array<{ code: string }> };
  const live = corps.live;
  /* § 5.13 (ANO-ADM-31) : le rapprochement n'adopte plus un intent seedé. Tant qu'aucun geste de remboursement ne l'a fait
     connaître au Fake, il est « introuvable » et rien n'est lu chez lui (comme chez Stripe pour un intent inconnu). */
  return { refunds: (live?.refunds ?? []).map((x) => x.amountCents), transfer: live?.transfer?.amountCents ?? null, introuvable: corps.divergences.some((d) => d.code === "INTENT_NOT_FOUND") };
}

const somme = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const euros = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
/** `Intl` sépare le montant du symbole par une espace insécable : on compare des textes normalisés. */
const net = (t: string) => t.replace(/[\u00a0\u202f]/g, " ").replace(/\s+/g, " ").trim();

/** Ouvre la retenue depuis la file filtrée « retenues », comme le cahier. */
async function ouvrirLaRetenue(page: Page, id: string): Promise<void> {
  await page.goto(`${bo()}/disputes`, { waitUntil: "domcontentloaded" });
  await attendreLeChargement(page);
  const filtre = page.locator("select").filter({ has: page.locator("option", { hasText: /^retenues$/ }) });
  await filtre.selectOption("RETENTION");
  const ligne = page.locator("tbody tr").filter({ hasText: "Aminata" }).filter({ has: page.getByRole("link", { name: "Retenue", exact: true }) });
  await expect(ligne).toHaveCount(1, { timeout: 60_000 });
  await ligne.getByRole("link", { name: "Retenue", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/disputes/${id}$`), { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "Retenue à arbitrer", exact: true })).toBeVisible({ timeout: 60_000 });
}

const formulaire = (page: Page) => page.locator("section").filter({ has: page.getByRole("heading", { name: "Trancher", exact: true }) });
const recapitulatif = (page: Page) => page.locator("div").filter({ has: page.getByText("Récapitulatif des flux, avant validation définitive", { exact: true }) }).last();

async function arbitrerParLEcran(page: Page, issue: RegExp): Promise<{ indice: string }> {
  const form = formulaire(page);
  await expect(form).toBeVisible({ timeout: 60_000 });
  const option = form.locator("label").filter({ hasText: issue });
  const indice = net(await option.locator("span span").last().innerText());
  await option.locator('input[type="radio"]').check();
  await form.getByPlaceholder("Ce que les preuves montrent, ce qui a pesé, ce qui est décidé.").fill(MOTIF);
  await form.getByRole("button", { name: "Voir le récapitulatif" }).click();
  return { indice };
}

async function valider(page: Page, id: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const reponse = page.waitForResponse((r) => r.url().endsWith(`/admin/disputes/${id}/retention`) && r.request().method() === "POST", { timeout: 60_000 });
  await page.getByRole("button", { name: "Valider définitivement" }).click();
  const r = await reponse;
  return { status: r.status(), body: (await r.json()) as Record<string, unknown> };
}

test.describe("ADM-RET — retenue d'annulation tardive (cahier 02-ADMIN § 5.10)", () => {
  test.describe.configure({ mode: "default" }); // chaque fiche rejoue le jeu d'essai

  test.beforeEach(() => {
    new JeuEssai().rejouer();
  });

  test.afterAll(() => {
    new JeuEssai().rejouer();
  });

  test("ADM-RET-1 · compensation au Voyageur (prorata)", async ({ navigateurAdmin, jeuEssai, mailpit }) => {
    test.setTimeout(8 * 60_000);
    const med = await navigateurAdmin("mediateur");
    const lecteur = await navigateurAdmin("finance");
    const sup = await navigateurAdmin("super");
    const id = jeuEssai.deal("bzv-held").id;
    const { page } = med;
    await mailpit.vider();

    /* 1-3. File filtrée, en-tête, bloc « Argent ». */
    const avant = await dossier(med.contexte, id);
    expect(avant.kind).toBe("RETENTION");
    expect(avant.money.retentionDisposition).toBe("HELD_FOR_MEDIATION");
    const retenue = avant.money.retentionCents!;
    const attendu = Math.round((retenue * avant.money.transportCents) / avant.money.totalShipperCents);
    expect(avant.proposedAmounts.compensateCarrierCents, "prorata calculé par le serveur").toBe(attendu);
    test.info().annotations.push({ type: "constat", description: `payé ${euros(avant.money.totalShipperCents)} €, remboursé ${euros(avant.money.refundAmountCents ?? 0)} €, retenue ${euros(retenue)} €, compensation ${euros(attendu)} €, Yamba ${euros(retenue - attendu)} €` });
    expect(avant.money.refundAmountCents, "remboursé à 50 %").toBe(Math.round(avant.money.totalShipperCents / 2));
    const debut = await debutDuScenario();
    await ouvrirLaRetenue(page, id);
    const argent = page.locator("div").filter({ has: page.getByRole("heading", { name: "Argent", exact: true }) }).last();
    await expect(argent).toContainText(`Remboursé${euros(avant.money.refundAmountCents!)} €`);
    await expect(argent, "disposition lisible, pas le code").toContainText(`Retenue${euros(retenue)} € · en attente d'arbitrage`);
    /* 4-5. L'indice, le récapitulatif, la validation. */
    const { indice } = await arbitrerParLEcran(page, /^Compensation au Voyageur \(prorata\)/);
    expect(indice, "amélioration : l'indice dit aussi la part de Yamba").toBe(`Voyageur : ${euros(attendu)} € (prorata de sa part nette) · Yamba garde ${euros(retenue - attendu)} € (sa commission)`);
    test.info().annotations.push({ type: "amélioration", description: `indice : « ${indice} » (le cahier : « Voyageur : {montant} (prorata de sa part nette) »)` });
    const recap = recapitulatif(page);
    await expect(recap).toContainText(`Remboursé à l'Expéditeur (Aminata) : 0,00 €`);
    await expect(recap).toContainText(`Versé au Voyageur (Thomas) : ${euros(attendu)} €`);
    await expect(recap).toContainText(`Conservé par Yamba : ${euros(retenue - attendu)} €`);
    const f0 = await fournisseur(sup.contexte, id);
    const r = await valider(page, id);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body).toMatchObject({ kind: "RETENTION", finalStatus: "CANCELLED", outcome: "COMPENSATE_CARRIER", refundCents: 0, carrierPayoutCents: attendu });
    test.info().annotations.push({ type: "constat", description: `versement : ${String(r.body.payoutStatus)}` });
    const fait = page.locator("section").filter({ has: page.getByRole("heading", { name: "Décision enregistrée" }) });
    await expect(fait).toBeVisible({ timeout: 30_000 });
    expect(net(await fait.innerText())).toContain(`Compensation au Voyageur (prorata) · statut final : Annulée · remboursé 0,00 € · versé ${euros(attendu)} €`);
    expect(net(await fait.innerText()), "amélioration : le deal reste annulé").toContain("Le deal reste annulé ; la retenue est désormais compensation versée au Voyageur.");
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText("Ce dossier est déjà tranché.", { exact: true }), "le dossier relu").toBeVisible({ timeout: 60_000 });
    /* Base : statut inchangé, disposition CARRIER, versement posé, un événement dans la même transaction. */
    const b = base(id);
    expect(b.status, "le deal reste CANCELLED").toBe("CANCELLED");
    expect(b.retentionDisposition).toBe("CARRIER");
    expect(b.retentionDecisionReason).toBe(MOTIF);
    expect(b.payoutAmountCents).toBe(attendu);
    expect(b.refundAmountCents, "aucun remboursement de plus").toBe(avant.money.refundAmountCents);
    const resolu = b.outbox.filter((e) => e.eventType === "booking.dispute_resolved");
    expect(resolu).toHaveLength(1);
    /* L'outbox garde l'ENVELOPPE (eventId, occurredAt…) : le contenu métier est sous `payload`. */
    expect((resolu[0].payload as { payload?: unknown }).payload).toMatchObject({ kind: "RETENTION", outcome: "COMPENSATE_CARRIER", refundCents: 0, carrierPayoutCents: attendu, finalStatus: "CANCELLED", actor: "ADMIN" });
    /* Fournisseur : aucun remboursement émis ; le transfert, s'il est parti, porte le prorata. */
    const f1 = await fournisseur(sup.contexte, id);
    expect(somme(f1.refunds) - somme(f0.refunds), "aucun remboursement chez le fournisseur").toBe(0);
    if (b.payoutStatus === "SENT" && f1.introuvable) {
      /* Compensation sans remboursement : aucun geste n'a fait connaître l'intent seedé au Fake (ANO-ADM-31, § 5.13) ; le
         transfert est lu chez le fournisseur par ADM-RAP-2, ici on s'en tient à la base. */
      expect((b as unknown as { transferId?: string }).transferId, "un transfert Fake réel en base").toMatch(/^tr_fake_/);
      test.info().annotations.push({ type: "constat", description: "intent seedé inconnu du Fake (lecture seule depuis § 5.13) : transfert vérifié en base, lecture fournisseur prouvée par ADM-RAP-2" });
    } else if (b.payoutStatus === "SENT") expect(f1.transfer, "transfert = prorata").toBe(attendu);
    /* 6. Fiche argent. */
    await page.goto(`${bo()}/deals/${id}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/^Retenue$/).first()).toBeVisible({ timeout: 60_000 });
    await expect(page.locator("body")).toContainText(`${euros(retenue)} € · compensation versée au Voyageur`);
    /* La ligne quitte les deux files. */
    const file = (await (await med.contexte.request.get(`${api()}/admin/disputes?kind=RETENTION`)).json()) as { items: Array<{ bookingId: string }> };
    expect(file.items.map((i) => i.bookingId), "file « À arbitrer »").not.toContain(id);
    const held = (await (await sup.contexte.request.get(`${api()}/admin/finances/queue?kind=HELD`)).json()) as { items: Array<{ bookingId: string }> };
    expect(held.items.map((i) => i.bookingId), "file « Retenues à arbitrer »").not.toContain(id);
    /* Journal. */
    const lignes = (await lireLeJournal(lecteur.contexte.request, { from: debut, adminUserId: jeuEssai.admin("mediateur").id })).filter((l) => l.action === "RETENTION_ARBITRATED");
    expect(lignes.map((l) => `${l.targetType} · ${l.targetId}`)).toEqual([`BOOKING · ${id}`]);
    expect(lignes[0].before).toEqual({ retentionDisposition: "HELD_FOR_MEDIATION", retentionCents: retenue });
    expect(lignes[0].after).toEqual({ outcome: "COMPENSATE_CARRIER", refundCents: 0, carrierPayoutCents: attendu });
    test.info().annotations.push({ type: "écart documentaire", description: "le cahier écrit `CARRIER_COMPENSATION` / `SHIPPER_RESTITUTION` ; l'API et le journal portent `COMPENSATE_CARRIER` / `RESTITUTE_SHIPPER`" });
  });

  test("ADM-RET-2 · restitution de la retenue à l'Expéditeur", async ({ navigateurAdmin, navigateurConnecte, jeuEssai }) => {
    test.setTimeout(8 * 60_000);
    const med = await navigateurAdmin("mediateur");
    const lecteur = await navigateurAdmin("finance");
    const sup = await navigateurAdmin("super");
    const id = jeuEssai.deal("bzv-held").id;
    const { page } = med;
    const avant = await dossier(med.contexte, id);
    const retenue = avant.money.retentionCents!;
    const aminata = await navigateurConnecte("aminata");
    const portefeuilleAvant = ((await (await aminata.contexte.request.get(`${adresseDeLApi()}/me/wallet`)).json()) as { shipper: { items: Array<{ bookingId: string; state: string; refundAmountCents: number | null; retentionCents: number | null }> } }).shipper.items.find((i) => i.bookingId === id);
    test.info().annotations.push({ type: "constat", description: `portefeuille d'Aminata avant : ${JSON.stringify(portefeuilleAvant)}` });
    const debut = await debutDuScenario();
    await ouvrirLaRetenue(page, id);
    const { indice } = await arbitrerParLEcran(page, /^Restitution de la retenue à l'Expéditeur/);
    expect(indice, "la retenue ENTIÈRE, pas un prorata ; amélioration : le total remboursé").toBe(`Expéditeur : ${euros(retenue)} € remboursés · remboursé en tout : ${euros((avant.money.refundAmountCents ?? 0) + retenue)} € · Voyageur : 0`);
    const recap = recapitulatif(page);
    await expect(recap).toContainText(`Remboursé à l'Expéditeur (Aminata) : ${euros(retenue)} €`);
    await expect(recap).toContainText("Versé au Voyageur (Thomas) : 0,00 €");
    await expect(recap).toContainText("Conservé par Yamba : 0,00 €");
    const f0 = await fournisseur(sup.contexte, id);
    const r = await valider(page, id);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body).toMatchObject({ outcome: "RESTITUTE_SHIPPER", refundCents: retenue, carrierPayoutCents: 0, finalStatus: "CANCELLED" });
    const b = base(id);
    expect(b.status).toBe("CANCELLED");
    expect(b.retentionDisposition).toBe("SHIPPER");
    expect(b.refundAmountCents, "remboursé en totalité").toBe(avant.money.totalShipperCents);
    expect(b.refundId, "l'identifiant du remboursement est gardé").toBeTruthy();
    expect(b.payoutStatus, "rien au Voyageur").toBeNull();
    const f1 = await fournisseur(sup.contexte, id);
    expect(somme(f1.refunds) - somme(f0.refunds), "UN remboursement de la retenue chez le fournisseur").toBe(retenue);
    /* 3. Côté membre : le complément. */
    const apres = ((await (await aminata.contexte.request.get(`${adresseDeLApi()}/me/wallet`)).json()) as { shipper: { items: Array<{ bookingId: string; state: string; refundAmountCents: number | null; retentionCents: number | null }> } }).shipper.items.find((i) => i.bookingId === id);
    expect(apres, "la ligne du portefeuille").toMatchObject({ state: "REFUNDED", refundAmountCents: avant.money.totalShipperCents });
    const lignes = (await lireLeJournal(lecteur.contexte.request, { from: debut, adminUserId: jeuEssai.admin("mediateur").id })).filter((l) => l.action === "RETENTION_ARBITRATED");
    expect(lignes).toHaveLength(1);
    expect(lignes[0].after).toEqual({ outcome: "RESTITUTE_SHIPPER", refundCents: retenue, carrierPayoutCents: 0 });
    await page.goto(`${bo()}/disputes/${id}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toContainText(`${euros(retenue)} € · restituée à l'Expéditeur`, { timeout: 60_000 });
  });

  test("ADM-RET-3 · les gardes de l'arbitrage (ajoutée)", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(8 * 60_000);
    const med = await navigateurAdmin("mediateur");
    const support = await navigateurAdmin("support");
    const sup = await navigateurAdmin("super");
    const lecteur = await navigateurAdmin("finance");
    const id = jeuEssai.deal("bzv-held").id;
    const url = `${api()}/admin/disputes/${id}/retention`;
    const debut = await debutDuScenario();
    /* Profil : le Support lit, ne tranche pas — ni à l'écran, ni par l'API. */
    await support.page.goto(`${bo()}/disputes/${id}`, { waitUntil: "domcontentloaded" });
    await expect(support.page.getByText(/Ton profil lit ce dossier mais ne tranche pas/)).toBeVisible({ timeout: 60_000 });
    expect((await support.contexte.request.post(url, { data: { outcome: "RESTITUTE_SHIPPER", reason: MOTIF }, failOnStatusCode: false })).status(), "Support : 403").toBe(403);
    /* Motif trop court, issue inconnue, issue d'un litige. */
    const court = await med.contexte.request.post(url, { data: { outcome: "RESTITUTE_SHIPPER", reason: "trop court" }, failOnStatusCode: false });
    expect(court.status(), "motif < 50 : 400").toBe(400);
    const inconnue = await med.contexte.request.post(url, { data: { outcome: "SPLIT", reason: MOTIF }, failOnStatusCode: false });
    expect(inconnue.status(), "issue inconnue : 400").toBe(400);
    const litige = await med.contexte.request.post(url, { data: { outcome: "FULL_REFUND", reason: MOTIF }, failOnStatusCode: false });
    expect(litige.status(), "issue de litige sur une retenue : 400").toBe(400);
    /* Un deal sans retenue. */
    const sansRetenue = await med.contexte.request.post(`${api()}/admin/disputes/${jeuEssai.deal("bzv-completed").id}/retention`, { data: { outcome: "RESTITUTE_SHIPPER", reason: MOTIF }, failOnStatusCode: false });
    expect([400, 404, 409], `deal sans retenue : ${sansRetenue.status()}`).toContain(sansRetenue.status());
    const codeSans = ((await sansRetenue.json()) as { details?: { code?: string } }).details?.code;
    test.info().annotations.push({ type: "constat", description: `deal sans retenue : ${sansRetenue.status()} ${codeSans ?? "(sans code)"}` });
    expect(codeSans, "un refus porte un code").toBeTruthy();
    /* Deux restitutions simultanées : un seul remboursement émis. */
    const f0 = await fournisseur(sup.contexte, id);
    const [a, b] = await Promise.all([
      med.contexte.request.post(url, { data: { outcome: "RESTITUTE_SHIPPER", reason: MOTIF }, failOnStatusCode: false }),
      sup.contexte.request.post(url, { data: { outcome: "RESTITUTE_SHIPPER", reason: MOTIF }, failOnStatusCode: false }),
    ]);
    const statuts = [a.status(), b.status()].sort();
    const codes = await Promise.all([a, b].map(async (x) => ((await x.json()) as { details?: { code?: string } }).details?.code ?? null));
    test.info().annotations.push({ type: "constat", description: `deux restitutions simultanées : ${statuts.join(" + ")} (${codes.join(", ")})` });
    expect(statuts[0], "une seule réussit").toBe(200);
    expect(statuts[1]).not.toBe(200);
    const f1 = await fournisseur(sup.contexte, id);
    const retenue = (await dossier(med.contexte, id)).money.retentionCents!;
    expect(somme(f1.refunds) - somme(f0.refunds), "UN seul remboursement émis").toBe(retenue);
    /* Second arbitrage, après coup : refus, sans argent. */
    const encore = await med.contexte.request.post(url, { data: { outcome: "COMPENSATE_CARRIER", reason: MOTIF }, failOnStatusCode: false });
    expect(encore.status(), "second arbitrage refusé").not.toBe(200);
    const f2 = await fournisseur(sup.contexte, id);
    expect(somme(f2.refunds), "rien de plus").toBe(somme(f1.refunds));
    expect(base(id).payoutStatus, "aucun versement déclenché").toBeNull();
    /* Journal : une seule ligne d'arbitrage, aucune pour les refus. */
    const toutes = await lireLeJournal(lecteur.contexte.request, { from: debut });
    expect(toutes.filter((l) => l.action === "RETENTION_ARBITRATED" && l.targetId === id), "une ligne").toHaveLength(1);
  });

  test("ADM-RET-4 · ce que lisent les deux parties (ajoutée)", async ({ navigateurAdmin, navigateurConnecte, jeuEssai, mailpit }) => {
    test.setTimeout(8 * 60_000);
    const med = await navigateurAdmin("mediateur");
    const id = jeuEssai.deal("bzv-held").id;
    const avant = await dossier(med.contexte, id);
    const retenue = avant.money.retentionCents!;
    const compensation = avant.proposedAmounts.compensateCarrierCents!;
    await mailpit.vider();
    const r = await med.contexte.request.post(`${api()}/admin/disputes/${id}/retention`, { data: { outcome: "COMPENSATE_CARRIER", reason: MOTIF } });
    expect(r.ok(), `compensation : ${r.status()}`).toBe(true);
    /* L'Expéditrice : ni justification inventée, ni « la retenue est versée au Voyageur » quand Yamba en garde une part. */
    const exp = await mailpit.attendreEmail({ pour: AMINATA, sujet: "Décision rendue sur ton envoi" }, 90_000);
    test.info().annotations.push({ type: "constat", description: `✉ Aminata : ${exp.texte.split("\n").filter((l) => /retenue/i.test(l)).join(" | ").slice(0, 300)}` });
    expect(exp.texte, "la part de Yamba est dite").toContain("le Voyageur en reçoit une part en compensation, le reste correspond à la commission Yamba");
    expect(net(exp.texte + exp.html), "chacun son montant : jamais le versement du Voyageur chez l'Expéditrice (WEB-E2E-2)").not.toContain(`${euros(compensation)} €`);
    expect(exp.texte, "aucune justification que le Médiateur n'a pas écrite").not.toMatch(/personne n'a pu attester|il s'était déplacé/);
    expect(exp.texte, "le motif du Médiateur").toContain(MOTIF);
    expect(exp.texte, "pas de promesse de remboursement").not.toContain("Le remboursement apparaît sur ta carte");
    /* Le Voyageur : le montant réel. */
    const voy = await mailpit.attendreEmail({ pour: THOMAS, sujet: "Décision rendue sur ton transport" }, 90_000);
    expect(net(voy.texte)).toContain(`Une compensation de ${euros(compensation)} €`);
    expect(net(voy.texte + voy.html), "chacun son montant : jamais la retenue de l'Expéditrice chez le Voyageur").not.toContain(`${euros(retenue)} €`);
    expect(voy.texte).toContain(MOTIF);
    /* Portefeuilles. */
    const thomas = await navigateurConnecte("thomas");
    const pt = ((await (await thomas.contexte.request.get(`${adresseDeLApi()}/me/wallet`)).json()) as { carrier: { items: Array<{ bookingId: string; kind: string; state: string; amountCents: number | null }> } }).carrier.items.find((i) => i.bookingId === id);
    test.info().annotations.push({ type: "constat", description: `portefeuille de Thomas : ${JSON.stringify(pt)}` });
    expect(pt?.amountCents, "le Voyageur voit la compensation").toBe(compensation);
    expect(["SENT", "PENDING", "BLOCKED"]).toContain(pt?.state);
    const aminata = await navigateurConnecte("aminata");
    const pa = ((await (await aminata.contexte.request.get(`${adresseDeLApi()}/me/wallet`)).json()) as { shipper: { items: Array<{ bookingId: string; state: string; refundAmountCents: number | null; retentionCents: number | null }> } }).shipper.items.find((i) => i.bookingId === id);
    expect(pa, "l'Expéditrice : remboursement partiel, retenue gardée").toMatchObject({ state: "PARTIALLY_REFUNDED", retentionCents: retenue });
  });
});
