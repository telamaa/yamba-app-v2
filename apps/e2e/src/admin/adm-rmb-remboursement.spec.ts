/**
 * adm-rmb-remboursement.spec.ts — cahier 02-ADMIN, § 5.15 « Remboursement manuel en deux gestes » (ADM-REM-1 à 3) + fiches ajoutées
 * ================================================================================================================================
 * Un geste commercial : Finance ou Support PROPOSE, un super administrateur APPLIQUE, Yamba rend l'argent sans toucher au
 * Voyageur. Trois questions structurent le chapitre, au-delà des boutons :
 *  - **l'argent peut-il partir deux fois ?** — deux « Rembourser maintenant » lancés ensemble, comptés chez le fournisseur
 *    (le rapprochement lit ses remboursements) : un seul doit partir ;
 *  - **l'Expéditeur lit-il la vérité ?** — l'email et son portefeuille ne doivent parler ni de « retenue » ni d'annulation :
 *    c'est un geste de Yamba sur un envoi réglé ;
 *  - **une proposition peut-elle devenir fausse ?** — si le deal a été remboursé entre-temps, la proposition dépasse le
 *    reste remboursable : elle doit se dire caduque, et son application être refusée.
 * La mémoire du fournisseur Fake survit au rejeu du jeu d'essai : les remboursements se comptent par différence avec un relevé
 * pris juste avant le geste. Le jeu d'essai est rejoué avant chaque fiche.
 */
import { test, expect, type NavigateurAdmin } from "../fixtures/yamba";
import { JeuEssai } from "../fixtures/jeu-essai";
import { adresseDeLApi, adresseDeLApiAdmin, adresseDuBackOffice } from "../fixtures/adresses";
import { lireLeJournal } from "../pages/journal-admin";
import { attendreLeChargement, debutDuScenario, lireCoteServeur } from "../pages/ecran-admin";
import { Finances } from "../pages/finances";

const api = () => adresseDeLApiAdmin();
const bo = () => adresseDuBackOffice();

type Contexte = NavigateurAdmin["contexte"];
type Page = NavigateurAdmin["page"];
type Fiche = {
  id: string; status: string;
  pricing: { totalShipperCents: number; transportCents: number; currencyCode: string };
  payment: { refundAmountCents: number | null; refundId: string | null; refundedAt: string | null; intentId: string | null };
  payout: { status: string | null; amountCents: number | null; transferId: string | null };
  manualRefund: { maxRefundableCents: number; proposal: null | { amountCents: number; reason: string; byAdmin: string; at: string; stale?: boolean; staleReason?: string | null }; last: null | { amountCents: number; reason: string } };
  allowedActions: { proposeRefund: boolean; applyRefund: boolean };
};
type Reponse = { refundedCents?: number; totalRefundedCents?: number; refundId?: string | null; message?: string; details?: { code?: string } };

const MOTIF = "Recette ADM-REM : geste commercial, colis livré avec trois jours de retard, plainte fondée.";
const euros = (cents: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
const echapper = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s/g, "\\s");

const lireFiche = async (ctx: Contexte, id: string): Promise<Fiche> => {
  const r = await ctx.request.get(`${api()}/admin/deals/${id}/money`);
  expect(r.ok(), `GET /admin/deals/${id}/money → ${r.status()}`).toBe(true);
  return (await r.json()) as Fiche;
};
/** Les remboursements que le fournisseur connaît pour ce deal (le rapprochement lit, n'écrit rien — § 5.13). */
const remboursementsChezLeFournisseur = async (ctx: Contexte, id: string): Promise<Array<{ id: string; amountCents: number }>> => {
  const r = await ctx.request.post(`${api()}/admin/deals/${id}/money/reconcile`);
  expect(r.ok(), `reconcile → ${r.status()}`).toBe(true);
  const corps = (await r.json()) as { live: null | { refunds: Array<{ id: string; amountCents: number }> } };
  return corps.live?.refunds ?? [];
};
const evenements = (id: string, type: string) =>
  lireCoteServeur<number>(`
    import prisma from "./packages/libs/prisma";
    (async () => { console.log("@@" + JSON.stringify(await prisma.outboxEvent.count({ where: { aggregateId: "${id}", eventType: "${type}" } }))); process.exit(0); })();`);
/** Manœuvre consignée : un autre remboursement écrit en base (simulé), pour rendre une proposition caduque. */
const poserEnBase = (id: string, data: Record<string, unknown>, pourquoi: string) => {
  lireCoteServeur(`
    import prisma from "./packages/libs/prisma";
    (async () => { await prisma.booking.update({ where: { id: "${id}" }, data: ${JSON.stringify(data)} as never }); console.log("@@true"); process.exit(0); })();`);
  process.stdout.write(`   ↳ manœuvre base : ${JSON.stringify(data)} sur ${id} (${pourquoi})\n`);
};
const carte = (page: Page) => page.locator("main section").filter({ has: page.locator("h2", { hasText: /^Remboursement manuel \(geste commercial\)$/ }) });

test.describe("ADM-REM — remboursement manuel en deux gestes (cahier 02-ADMIN § 5.15)", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(() => {
    new JeuEssai().rejouer();
  });
  test.afterAll(() => {
    new JeuEssai().rejouer();
  });

  test("ADM-REM-1 · proposer un remboursement manuel (Finance)", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(8 * 60_000);
    const fin = await navigateurAdmin("finance");
    const deal = jeuEssai.deal("bzv-completed");
    const avant = await lireFiche(fin.contexte, deal.id);
    expect(avant.status, "précondition : deal terminé").toBe("COMPLETED");
    const plafond = avant.pricing.totalShipperCents - (avant.payment.refundAmountCents ?? 0);
    expect(avant.manualRefund.maxRefundableCents, "plafond = payé − déjà remboursé").toBe(plafond);
    const debut = await debutDuScenario();
    const { page } = fin;
    await page.goto(`${bo()}/deals/${deal.id}`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    const c = carte(page);
    /* 1-2. Le texte et le plafond. */
    await expect(c.getByText(`Hors litige, sur un deal fermé et débité. Le Voyageur n'est pas touché : c'est Yamba qui rend l'argent. Plafond : ${euros(plafond)} (payé − déjà remboursé). Motif de 50 caractères au moins. Un super administrateur applique.`, { exact: true })).toBeVisible({ timeout: 60_000 });
    /* 3. Au-dessus du plafond : l'écran refuse de partir, le serveur refuse l'appel direct. */
    await c.getByPlaceholder(/^Montant/).fill(((plafond + 100) / 100).toFixed(2));
    await c.getByPlaceholder(/^Motif/).fill(MOTIF);
    await expect(c.getByRole("button", { name: "Proposer", exact: true }), "au-dessus du plafond : bouton inactif").toBeDisabled();
    const trop = await fin.contexte.request.post(`${api()}/admin/deals/${deal.id}/refund/propose`, { data: { amountCents: plafond + 100, reason: MOTIF }, failOnStatusCode: false });
    expect(trop.status(), "appel direct au-dessus du plafond").toBe(400);
    expect(((await trop.json()) as Reponse).message).toMatch(new RegExp(`^At most ${plafond} cents can still be refunded`));
    test.info().annotations.push({ type: "écart documentaire", description: "étape 3 : l'écran ne laisse pas cliquer « Proposer » au-dessus du plafond (bouton inactif) ; le 400 du cahier est prouvé par appel direct" });
    /* 4. Motif trop court : bouton inactif. */
    await c.getByPlaceholder(/^Montant/).fill("5,00");
    await c.getByPlaceholder(/^Motif/).fill("Trop court pour un geste commercial.");
    await expect(c.getByRole("button", { name: "Proposer", exact: true })).toBeDisabled();
    /* 5. Motif valide. */
    await c.getByPlaceholder(/^Motif/).fill(MOTIF);
    const propose = page.waitForResponse((r) => r.url().endsWith(`/admin/deals/${deal.id}/refund/propose`) && r.request().method() === "POST");
    await c.getByRole("button", { name: "Proposer", exact: true }).click();
    expect((await propose).status()).toBe(200);
    await expect(page.getByText("Remboursement proposé, en attente d'un super administrateur.", { exact: false })).toBeVisible({ timeout: 30_000 });
    /* 6. Recharger : le bandeau. */
    await page.reload({ waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    await expect(carte(page).getByText(new RegExp(`^Proposé : ${echapper(euros(500))} par .+ le .+ — ${echapper(MOTIF)}`))).toBeVisible({ timeout: 60_000 });
    /* 7. La file et la tuile. */
    const file = (await (await fin.contexte.request.get(`${api()}/admin/finances/queue?kind=PROPOSED_REFUNDS`)).json()) as { items: Array<{ bookingId: string; amountCents: number }>; counts?: Record<string, number> };
    expect(file.items.map((i) => i.bookingId), "la file compte la proposition").toEqual([deal.id]);
    expect(file.items[0].amountCents).toBe(500);
    const kpis = (await (await fin.contexte.request.get(`${api()}/admin/kpis`)).json()) as { manualRefundProposals: number };
    expect(kpis.manualRefundProposals, "la tuile d'accueil").toBe(1);
    await page.goto(`${bo()}/finances?kind=PROPOSED_REFUNDS`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    await expect(page.locator("tbody tr").filter({ has: page.locator(`a[href="/deals/${deal.id}"]`) })).toHaveCount(1, { timeout: 60_000 });
    /* 8. Aucun « Rembourser maintenant » pour Finance ni pour Support. */
    for (const cle of ["finance", "support"] as const) {
      const nav = cle === "finance" ? fin : await navigateurAdmin(cle);
      await nav.page.goto(`${bo()}/deals/${deal.id}`, { waitUntil: "domcontentloaded" });
      await attendreLeChargement(nav.page);
      await expect(nav.page.getByRole("button", { name: "Rembourser maintenant" }), `${cle} : pas de bouton d'application`).toHaveCount(0);
    }
    /* Journal. */
    const lignes = (await lireLeJournal(fin.contexte.request, { from: debut, adminUserId: jeuEssai.admin("finance").id })).filter((l) => l.action === "REFUND_MANUAL_PROPOSED");
    expect(lignes.map((l) => `${l.targetType} · ${l.targetId}`)).toEqual([`BOOKING · ${deal.id}`]);
    expect(lignes[0].after).toMatchObject({ amountCents: 500, reason: MOTIF });
  });

  test("ADM-REM-2 · appliquer un remboursement manuel (super administrateur seul)", async ({ navigateurAdmin, navigateurConnecte, jeuEssai, mailpit }) => {
    test.setTimeout(10 * 60_000);
    const fin = await navigateurAdmin("finance");
    const sup = await navigateurAdmin("super");
    const deal = jeuEssai.deal("bzv-completed");
    expect((await fin.contexte.request.post(`${api()}/admin/deals/${deal.id}/refund/propose`, { data: { amountCents: 500, reason: MOTIF } })).ok(), "précondition : la proposition d'ADM-REM-1").toBe(true);
    const avant = await lireFiche(sup.contexte, deal.id);
    const chezFournisseurAvant = (await remboursementsChezLeFournisseur(sup.contexte, deal.id)).length;
    const emailsAvant = await mailpit.compter({ pour: "mai.shipper@seed.yamba.dev", sujet: "Remboursement émis" });
    const debut = await debutDuScenario();
    const { page } = sup;
    await page.goto(`${bo()}/deals/${deal.id}`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    const c = carte(page);
    /* 1. Le bandeau, et le formulaire prérempli par la proposition. */
    await expect(c.getByText(/^Proposé : /)).toBeVisible({ timeout: 60_000 });
    await expect(c.getByPlaceholder(/^Montant/)).toHaveValue(/^5[.,]00$/);
    /* 2-3. « Rembourser maintenant ». */
    const applique = page.waitForResponse((r) => r.url().endsWith(`/admin/deals/${deal.id}/refund`) && r.request().method() === "POST");
    await c.getByRole("button", { name: "Rembourser maintenant" }).click();
    const reponse = await applique;
    const corps = (await reponse.json()) as Reponse;
    expect(reponse.status(), "POST refund").toBe(200);
    await expect(page.getByText(`Remboursé ${euros(500)} (cumul ${euros(500)}). L'Expéditeur est prévenu par email.`, { exact: false })).toBeVisible({ timeout: 30_000 });
    /* 4. La fiche : remboursement enregistré avec son identifiant, proposition effacée, versement intact. */
    const apres = await lireFiche(sup.contexte, deal.id);
    expect(apres.payment.refundAmountCents, "cumul").toBe(500);
    expect(apres.payment.refundId, "l'identifiant rendu = l'identifiant enregistré").toBe(corps.refundId);
    expect(apres.manualRefund.proposal, "la proposition a disparu").toBeNull();
    expect(apres.payout, "le versement du Voyageur n'est pas touché").toEqual(avant.payout);
    await page.reload({ waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    // A166 (§ 5.16) — la carte liste chaque remboursement : montant, date, nature, identifiant sur une même ligne.
    const rembourse = page.locator("main section").filter({ has: page.locator("h2", { hasText: /^Paiement de l'Expéditeur$/ }) }).locator("div.flex").filter({ has: page.locator("span", { hasText: /^Remboursé$/ }) });
    await expect(rembourse).toContainText(new RegExp(`${echapper(euros(500))} le .+ · geste commercial · ${echapper(corps.refundId!)}`), { timeout: 60_000 });
    /* Un seul remboursement chez le fournisseur, un seul événement. */
    const chez = await remboursementsChezLeFournisseur(sup.contexte, deal.id);
    expect(chez.length - chezFournisseurAvant, "un seul remboursement émis chez le fournisseur").toBe(1);
    expect(chez.at(-1)).toMatchObject({ id: corps.refundId, amountCents: 500 });
    expect(evenements(deal.id, "booking.refund_issued"), "un seul booking.refund_issued").toBe(1);
    /* 5. Le portefeuille de l'Expéditeur (Mai) : un remboursement, jamais une « retenue ». */
    const mai = await navigateurConnecte("mai");
    const w = (await (await mai.contexte.request.get(`${adresseDeLApi()}/me/wallet`)).json()) as { shipper: { items: Array<{ bookingId: string; state: string; refundAmountCents: number | null; retentionCents: number | null; partialKind?: string | null }> } };
    const item = w.shipper.items.find((i) => i.bookingId === deal.id)!;
    expect(item.state, "portefeuille : partiellement remboursé").toBe("PARTIALLY_REFUNDED");
    expect(item.refundAmountCents).toBe(500);
    const finances = new Finances(mai.page);
    await finances.ouvrir("Paiements");
    const lignePortefeuille = await finances.lignePaiement(deal.id);
    test.info().annotations.push({ type: "constat", description: `portefeuille de Mai : « ${lignePortefeuille} »` });
    expect(lignePortefeuille).toMatch(new RegExp(`Remboursé ${echapper(euros(500))} le .+`));
    expect(lignePortefeuille, "un geste commercial n'est pas une retenue d'annulation").not.toMatch(/retenue|reversée au Voyageur/i);
    /* 6. L'email. */
    await expect.poll(() => mailpit.compter({ pour: "mai.shipper@seed.yamba.dev", sujet: "Remboursement émis" }), { timeout: 90_000, message: "✉ Remboursement émis" }).toBe(emailsAvant + 1);
    const email = await mailpit.attendreEmail({ pour: "mai.shipper@seed.yamba.dev", sujet: "Remboursement émis" });
    test.info().annotations.push({ type: "constat", description: `✉ « ${email.sujet} »` });
    expect(email.texte).toContain(euros(500));
    expect(email.texte, "pas d'annulation ni de retenue dans un geste commercial").not.toMatch(/Annulation à moins de 48 h|retenue/i);
    expect(email.texte, "chacun son montant : jamais le montant du Voyageur").not.toContain(euros(avant.pricing.transportCents));
    /* 7. La chronologie. */
    await page.getByRole("button", { name: "Charger la chronologie" }).click();
    await expect(page.locator("main section").filter({ has: page.locator("h2", { hasText: /^Tout ce qui est arrivé à ce deal$/ }) }).getByText(/booking\.refund_issued|Remboursement émis/).first()).toBeVisible({ timeout: 60_000 });
    /* Journal. */
    const lignes = (await lireLeJournal(sup.contexte.request, { from: debut, adminUserId: jeuEssai.admin("super").id })).filter((l) => l.action === "REFUND_MANUAL_APPLIED");
    expect(lignes.map((l) => `${l.targetType} · ${l.targetId}`)).toEqual([`BOOKING · ${deal.id}`]);
    expect(lignes[0].after).toMatchObject({ amountCents: 500, totalRefundedCents: 500, refundId: corps.refundId, reason: MOTIF });
  });

  test("ADM-REM-3 · Finance ne peut pas appliquer, même par appel direct", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(5 * 60_000);
    const fin = await navigateurAdmin("finance");
    const sup = await navigateurAdmin("super");
    const deal = jeuEssai.deal("bzv-completed");
    const avant = await lireFiche(sup.contexte, deal.id);
    const chezAvant = (await remboursementsChezLeFournisseur(sup.contexte, deal.id)).length;
    const debut = await debutDuScenario();
    const r = await fin.contexte.request.post(`${api()}/admin/deals/${deal.id}/refund`, { data: { amountCents: 500, reason: MOTIF }, failOnStatusCode: false });
    expect(r.status(), "Finance → 403").toBe(403);
    expect(((await r.json()) as Reponse).details?.code).toBe("ADMIN_PERMISSION_DENIED");
    const apres = await lireFiche(sup.contexte, deal.id);
    expect(apres.payment, "aucun changement en base").toEqual(avant.payment);
    expect((await remboursementsChezLeFournisseur(sup.contexte, deal.id)).length, "aucun mouvement chez le fournisseur").toBe(chezAvant);
    const ecrites = (await lireLeJournal(sup.contexte.request, { from: debut, adminUserId: jeuEssai.admin("finance").id })).map((l) => l.action);
    expect(ecrites, "aucune ligne").toEqual([]);
  });

  test("ADM-REM-4 · deux « Rembourser maintenant » simultanés n'émettent qu'un remboursement", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    const sup = await navigateurAdmin("super");
    const deal = jeuEssai.deal("bzv-completed");
    const chezAvant = (await remboursementsChezLeFournisseur(sup.contexte, deal.id)).length;
    const debut = await debutDuScenario();
    const appels = await Promise.all([0, 1, 2].map(() => sup.contexte.request.post(`${api()}/admin/deals/${deal.id}/refund`, { data: { amountCents: 700, reason: MOTIF }, failOnStatusCode: false })));
    const statuts = appels.map((a) => a.status()).sort();
    const corps = await Promise.all(appels.map(async (a) => (await a.json()) as Reponse));
    test.info().annotations.push({ type: "constat", description: `trois appels simultanés : ${appels.map((a, i) => `${a.status()} ${corps[i].details?.code ?? corps[i].refundId ?? ""}`).join(" · ")}` });
    const chez = await remboursementsChezLeFournisseur(sup.contexte, deal.id);
    expect(chez.length - chezAvant, "UN seul remboursement chez le fournisseur").toBe(1);
    expect(statuts.filter((s) => s === 200), "un seul succès").toHaveLength(1);
    for (const [i, a] of appels.entries()) if (a.status() !== 200) expect(corps[i].details?.code, "les autres : refus nommé, rien d'émis").toMatch(/^(DECISION_IN_PROGRESS|REFUND_NOT_ALLOWED|REFUND_ABOVE_MAX|TRANSITION_NOT_ALLOWED)$/);
    const fiche = await lireFiche(sup.contexte, deal.id);
    expect(fiche.payment.refundAmountCents, "cumul = un seul geste").toBe(700);
    expect(evenements(deal.id, "booking.refund_issued")).toBe(1);
    const lignes = (await lireLeJournal(sup.contexte.request, { from: debut, adminUserId: jeuEssai.admin("super").id })).filter((l) => l.action === "REFUND_MANUAL_APPLIED");
    expect(lignes, "une seule ligne de journal").toHaveLength(1);
  });

  test("ADM-REM-5 · une proposition devenue impossible se dit caduque et ne s'applique pas", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    const fin = await navigateurAdmin("finance");
    const sup = await navigateurAdmin("super");
    const deal = jeuEssai.deal("bzv-completed");
    const total = (await lireFiche(sup.contexte, deal.id)).pricing.totalShipperCents;
    expect((await fin.contexte.request.post(`${api()}/admin/deals/${deal.id}/refund/propose`, { data: { amountCents: 3000, reason: MOTIF } })).ok()).toBe(true);
    /* Un autre remboursement arrive entre-temps (simulé en base) : il ne reste que total − 2 000. */
    poserEnBase(deal.id, { refundAmountCents: 2000, refundedAt: new Date().toISOString() }, "ADM-REM-5 : remboursement arrivé entre la proposition et l'application");
    const reste = total - 2000;
    const fiche = await lireFiche(sup.contexte, deal.id);
    expect(fiche.manualRefund.maxRefundableCents).toBe(reste);
    expect(fiche.manualRefund.proposal?.stale, "la proposition est marquée caduque par le serveur").toBe(true);
    const { page } = sup;
    await page.goto(`${bo()}/deals/${deal.id}`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    const c = carte(page);
    await expect(c.getByText(/^Proposé : .+caduque/)).toBeVisible({ timeout: 60_000 });
    await expect(c.getByText(/caduque/).first()).toContainText(euros(reste));
    /* Appel direct au montant proposé : refusé, rien d'émis. */
    const chezAvant = (await remboursementsChezLeFournisseur(sup.contexte, deal.id)).length;
    const r = await sup.contexte.request.post(`${api()}/admin/deals/${deal.id}/refund`, { data: { amountCents: 3000, reason: MOTIF }, failOnStatusCode: false });
    expect(r.status()).toBe(400);
    expect(((await r.json()) as Reponse).details?.code).toBe("REFUND_ABOVE_MAX");
    expect((await remboursementsChezLeFournisseur(sup.contexte, deal.id)).length, "rien d'émis").toBe(chezAvant);
    /* La file dit aussi « caduque ». */
    await page.goto(`${bo()}/finances?kind=PROPOSED_REFUNDS`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    await expect(page.locator("tbody tr").filter({ has: page.locator(`a[href="/deals/${deal.id}"]`) })).toContainText(/caduque/, { timeout: 60_000 });
  });

  test("ADM-REM-6 · les refus se lisent en français sur la fiche", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    const sup = await navigateurAdmin("super");
    const deal = jeuEssai.deal("bzv-completed");
    const { page } = sup;
    await page.goto(`${bo()}/deals/${deal.id}`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    const c = carte(page);
    await c.getByPlaceholder(/^Montant/).fill("1 234,50");
    await c.getByPlaceholder(/^Motif/).fill(MOTIF);
    await expect(c.getByRole("button", { name: "Rembourser maintenant" })).toBeDisabled();
    await expect(c.getByText(/^Au-dessus du plafond : .+ au plus\.$/), "« 1 234,50 » se lit comme 1 234,50 € : au-dessus du plafond, dit en clair").toBeVisible();
    await c.getByPlaceholder(/^Montant/).fill("douze");
    await expect(c.getByText("Montant illisible : écris par exemple 12,50.")).toBeVisible();
    await c.getByPlaceholder(/^Montant/).fill("12,50");
    await expect(c.getByRole("button", { name: "Rembourser maintenant" }), "« 12,50 » à la française est accepté").toBeEnabled();
    await c.getByPlaceholder(/^Montant/).fill("6,00");
    await c.getByPlaceholder(/^Motif/).fill(MOTIF);
    /* Le deal change sous l'écran : remboursé en totalité ailleurs (simulé). */
    const total = (await lireFiche(sup.contexte, deal.id)).pricing.totalShipperCents;
    poserEnBase(deal.id, { refundAmountCents: total, refundedAt: new Date().toISOString() }, "ADM-REM-6 : écran périmé");
    const chezAvant = (await remboursementsChezLeFournisseur(sup.contexte, deal.id)).length;
    await c.getByRole("button", { name: "Rembourser maintenant" }).click();
    const refus = page.getByText(/^(Plus aucun remboursement manuel possible|Montant refusé)/);
    await expect(refus, "le refus en français, en tête de fiche").toBeVisible({ timeout: 30_000 });
    await expect(refus).toContainText("Rien n'a été émis");
    await expect(page.getByText(/^\d{3} : /), "jamais « 400 : message anglais »").toHaveCount(0);
    await expect(carte(page).getByText("Aucun remboursement manuel possible sur ce deal (état, montant, ou tu es partie)."), "la fiche rechargée n'offre plus le geste").toBeVisible({ timeout: 30_000 });
    expect((await remboursementsChezLeFournisseur(sup.contexte, deal.id)).length, "rien d'émis").toBe(chezAvant);
    test.info().annotations.push({ type: "constat", description: `refus affiché : « ${(await refus.innerText()).trim()} »` });
  });
});
