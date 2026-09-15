/**
 * adm-arg-fiche-argent.spec.ts — cahier 02-ADMIN, § 5.12 « Fiche argent d'un deal » (ADM-ARG-1, 2) + fiches ajoutées
 * ================================================================================================================
 * La fiche argent est l'écran où Finance répond à « où est l'argent de ce deal ? ». Trois preuves :
 *  - **l'écran = l'API** (`GET /admin/deals/:id/money`) et **l'API = la base** (prix figé, débit, remboursements, versement) ;
 *  - **des invariants comptables sur TOUS les deals du jeu d'essai** (ADM-ARG-3) : un écran d'argent qui additionne faux,
 *    ou un deal clos dont l'argent n'a pas de destination, se voit à l'échelle du jeu d'essai, pas sur une fiche choisie ;
 *  - **ce qui ne doit jamais sortir** : le code de livraison, les photos, les coordonnées du destinataire — dans la page
 *    ET dans les réponses d'API.
 * La chronologie (ARG-2) a besoin de faits récents : l'Expéditrice annule une demande en attente (bzv-pending) par
 * l'API membre — un vrai événement d'outbox, relayé, notifié, envoyé par email. Le jeu d'essai est rejoué après.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect, type NavigateurAdmin } from "../fixtures/yamba";
import { JeuEssai } from "../fixtures/jeu-essai";
import { adresseDeLApi, adresseDeLApiAdmin, adresseDuBackOffice } from "../fixtures/adresses";
import { lireLeJournal } from "../pages/journal-admin";
import { attendreLeChargement, debutDuScenario, lireCoteServeur } from "../pages/ecran-admin";

const api = () => adresseDeLApiAdmin();
const bo = () => adresseDuBackOffice();
const RACINE = join(__dirname, "../../../..");
const CODE_DU_SEED = "742891";
/** Ce qui ne sort jamais d'une fiche argent ni de sa chronologie (photos de prise en charge, destinataire du seed). */
const INTERDITS = [CODE_DU_SEED, "r2.seed.yamba.dev", "@seed.yamba.dev", "+242061234567", "Clarisse", "Mabiala"];

type Page = NavigateurAdmin["page"];
type Fiche = {
  id: string; status: string; disputeTicket: string | null;
  pricing: { totalShipperCents: number; transportCents: number; commissionCents: number; premiumCents: number; currencyCode: string; pricingModel: string; weightKg: number };
  payment: { intentId: string | null; chargeId: string | null; capturedAt: string | null; refundAmountCents: number | null; refunds?: Array<{ amountCents: number }> };
  payout: { status: string | null; amountCents: number | null; attempts: number; failureKind: string | null; nextRetryAt: string | null };
  carrier: { id: string; stripeAccountIdMasked: string | null; stripePayoutsEnabled: boolean | null };
  retention: { cents: number; disposition: string | null } | null;
  timeline: Array<{ kind: string; amountCents: number | null; detail: string | null }>;
  balance?: { capturedCents: number; refundedCents: number; paidOutCents: number; platformHoldsCents: number; pending: Array<{ kind: string; cents: number }>; settled: boolean; anomaly: string | null };
};
type DealDuSeed = { key: string; id: string; status: string };

const euros = (cents: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
const dealsDuSeed = (): DealDuSeed[] => (JSON.parse(readFileSync(join(RACINE, "packages/libs/prisma/scripts/seed-output.json"), "utf-8")) as { bookings: DealDuSeed[] }).bookings;
const lireFiche = async (ctx: NavigateurAdmin["contexte"], id: string) => {
  const r = await ctx.request.get(`${api()}/admin/deals/${id}/money`, { failOnStatusCode: false });
  return { statut: r.status(), texte: await r.text(), fiche: r.ok() ? ((await r.json()) as Fiche) : null };
};
/** Les titres des cartes, dans l'ordre (textContent : le CSS les affiche en capitales). */
const titresDesCartes = (page: Page) => page.locator("main section > h2").evaluateAll((hs) => hs.map((h) => (h.textContent ?? "").trim()));
const ligne = (page: Page, carte: string, cle: string) =>
  page.locator("main section").filter({ has: page.locator("h2", { hasText: new RegExp(`^${carte}$`) }) }).locator("div.flex").filter({ has: page.locator("span", { hasText: new RegExp(`^${cle}$`) }) }).locator("span").last();

test.describe("ADM-ARG — fiche argent d'un deal (cahier 02-ADMIN § 5.12)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(() => {
    new JeuEssai().rejouer();
  });
  test.afterAll(() => {
    new JeuEssai().rejouer();
  });

  test("ADM-ARG-1 · ce que montre la fiche argent", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    const fin = await navigateurAdmin("finance");
    const deal = jeuEssai.deal("bzv-completed-blocked");
    // A168 (§ 5.18) — la lecture API ci-dessous est elle-même une ouverture journalisée : le scénario commence AVANT elle,
    // sinon l'ouverture d'écran qui suit (moins de 10 s après) est coalescée avec une ligne datée d'avant le début.
    const debut = await debutDuScenario();
    const { fiche } = await lireFiche(fin.contexte, deal.id);
    expect(fiche, "GET /admin/deals/:id/money").toBeTruthy();
    /* 1. Depuis /finances, la fiche du deal en échec de versement. */
    const { page } = fin;
    await page.goto(`${bo()}/finances?kind=FAILED`, { waitUntil: "domcontentloaded" });
    await page.locator("tbody tr").filter({ hasText: "Paris → Brazzaville" }).locator(`a[href="/deals/${deal.id}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`/deals/${deal.id}$`), { timeout: 60_000 });
    await attendreLeChargement(page);
    await expect(page.getByRole("heading", { name: "Paris → Brazzaville" })).toBeVisible({ timeout: 60_000 });
    /* 2. Les cartes, dans l'ordre du cahier (une carte ajoutée est tolérée et consignée). */
    const titres = await titresDesCartes(page);
    const DU_CAHIER = ["Prix figé à la réservation", "Parties", "Paiement de l'Expéditeur", "Versement au Voyageur", "Remboursement manuel (geste commercial)", "Chronologie de l'argent", "Rapprochement avec le fournisseur", "Dates", "Tout ce qui est arrivé à ce deal", "Actions admin sur ce deal"];
    expect(titres.filter((t) => DU_CAHIER.includes(t)), "les cartes du cahier, dans l'ordre").toEqual(DU_CAHIER);
    const ajoutees = titres.filter((t) => !DU_CAHIER.includes(t));
    if (ajoutees.length) test.info().annotations.push({ type: "écart documentaire", description: `cartes servies que le cahier ne liste pas : ${ajoutees.join(", ")}` });
    /* 3. Le prix figé = le snapshot en base (l'API), jamais recalculé. */
    const p = fiche!.pricing;
    expect(p.transportCents + p.commissionCents + p.premiumCents, "payé = net + commission + prime").toBe(p.totalShipperCents);
    await expect(ligne(page, "Prix figé à la réservation", "Payé par l'Expéditeur")).toHaveText(euros(p.totalShipperCents));
    await expect(ligne(page, "Prix figé à la réservation", "Net Voyageur")).toHaveText(euros(p.transportCents));
    await expect(ligne(page, "Prix figé à la réservation", "Commission Yamba")).toHaveText(euros(p.commissionCents));
    await expect(ligne(page, "Prix figé à la réservation", "Modèle")).toContainText(`${p.weightKg} kg`);
    /* Versement : en échec, montant, motif, tentatives, prochaine relance. */
    await expect(ligne(page, "Versement au Voyageur", "État")).toHaveText("en échec");
    await expect(ligne(page, "Versement au Voyageur", "Montant")).toHaveText(euros(fiche!.payout.amountCents!));
    await expect(ligne(page, "Versement au Voyageur", "Motif")).toContainText("compte Stripe du Voyageur non prêt");
    await expect(ligne(page, "Versement au Voyageur", "Tentatives")).toContainText(`${fiche!.payout.attempts}`);
    await expect(ligne(page, "Versement au Voyageur", "Tentatives")).toContainText("prochaine");
    test.info().annotations.push({ type: "constat", description: `versement : « ${(await ligne(page, "Versement au Voyageur", "Tentatives").innerText()).trim()} » (cahier : « 4 tentative(s) »)` });
    /* Parties : compte Stripe masqué, mention des virements. */
    await expect(ligne(page, "Parties", "Compte Stripe")).toContainText(/virements (activés|NON activés)/);
    expect(fiche!.carrier.stripeAccountIdMasked ?? "", "compte Stripe masqué dans l'API").toMatch(/^acct_…\w{4}$|^$/);
    /* 4. Aucune trace du code de livraison, ni dans la page, ni dans la réponse. */
    const corps = await page.locator("main").innerText();
    for (const x of INTERDITS) expect(corps, `« ${x} » absent de la page`).not.toContain(x);
    const brut = (await lireFiche(fin.contexte, deal.id)).texte;
    for (const x of INTERDITS) expect(brut, `« ${x} » absent de la réponse`).not.toContain(x);
    expect(brut, "aucune clé de code de livraison").not.toMatch(/deliveryCode/i);
    /* 5. Identifiants Stripe : en clair ici (rapprochement), masqués sur la fiche membre. */
    await expect(ligne(page, "Paiement de l'Expéditeur", "Intent")).toHaveText(fiche!.payment.intentId!);
    await expect(ligne(page, "Paiement de l'Expéditeur", "Charge")).toHaveText(fiche!.payment.chargeId!);
    await page.goto(`${bo()}/users/${fiche!.carrier.id}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/acct_…\w{4}/).first(), "fiche membre : compte Stripe masqué").toBeVisible({ timeout: 60_000 });
    /* Journal. */
    const vues = (await lireLeJournal(fin.contexte.request, { from: debut, adminUserId: jeuEssai.admin("finance").id })).filter((l) => l.action === "DEAL_MONEY_VIEWED");
    expect(vues.length, "au moins une ligne DEAL_MONEY_VIEWED").toBeGreaterThanOrEqual(1);
    expect(vues.every((l) => l.targetType === "BOOKING" && l.targetId === deal.id)).toBe(true);
  });

  test("ADM-ARG-2 · la chronologie complète du deal", async ({ navigateurAdmin, navigateurConnecte, jeuEssai, mailpit }) => {
    test.setTimeout(6 * 60_000);
    const deal = jeuEssai.deal("bzv-pending");
    /* Des faits récents : Aminata annule sa demande en attente (vrai événement, relayé, notifié, envoyé). */
    const aminata = await navigateurConnecte("aminata");
    const annule = await aminata.contexte.request.post(`${adresseDeLApi()}/deals/${deal.id}/cancel`, { data: { reason: "Recette ADM-ARG-2 : chronologie" } });
    expect(annule.ok(), `annulation membre : ${annule.status()} ${annule.ok() ? "" : await annule.text()}`).toBe(true);
    const fin = await navigateurAdmin("finance");
    const charger = async () => ((await (await fin.contexte.request.get(`${api()}/admin/deals/${deal.id}/history`)).json()) as { counts: { outbox: number; notifications: number; emails: number } }).counts;
    await expect.poll(async () => { const c = await charger(); return c.outbox > 0 && c.notifications > 0 && c.emails > 0; }, { timeout: 90_000, intervals: [3_000], message: "l'annulation est relayée, notifiée et envoyée" }).toBe(true);
    void mailpit;
    const debut = await debutDuScenario();
    const { page } = fin;
    await page.goto(`${bo()}/deals/${deal.id}`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    const carte = page.locator("main section").filter({ has: page.locator("h2", { hasText: /^Tout ce qui est arrivé à ce deal$/ }) });
    /* 2. Le texte d'avertissement. */
    await expect(carte.getByText("Événements (avec leur état de relais), actions admin, notifications et emails, dans l'ordre. Lecture seule, consultation journalisée. Jamais le code de livraison.", { exact: true })).toBeVisible({ timeout: 60_000 });
    /* 3. « Charger la chronologie ». */
    await carte.getByRole("button", { name: "Charger la chronologie" }).click();
    /* 4. Compteurs et étiquettes. */
    const compteurs = carte.getByText(/^\d+ événement\(s\) · \d+ action\(s\) admin · \d+ notification\(s\) · \d+ email\(s\)/);
    await expect(compteurs).toBeVisible({ timeout: 30_000 });
    test.info().annotations.push({ type: "constat", description: `compteurs : « ${(await compteurs.innerText()).trim()} »` });
    for (const etiquette of ["événement", "notification", "email"]) await expect(carte.locator("ol li span", { hasText: new RegExp(`^${etiquette}$`, "i") }).first(), `étiquette « ${etiquette} »`).toBeVisible();
    /* L'état de relais s'affiche en français (publié / en attente / parqué). */
    await expect(carte.locator("ol li").filter({ hasText: "booking.cancelled" }).first(), "état de relais en français").toContainText(/publié|en attente|parqué/);
    /* 5. Ni photo, ni adresse, ni code. */
    const texte = await carte.innerText();
    for (const x of INTERDITS) expect(texte, `« ${x} » absent de la chronologie`).not.toContain(x);
    const brut = await (await fin.contexte.request.get(`${api()}/admin/deals/${deal.id}/history`)).text();
    for (const x of INTERDITS) expect(brut, `« ${x} » absent de la réponse`).not.toContain(x);
    /* La chronologie de l'argent dit que l'empreinte a été LIBÉRÉE (amélioration § 5.12). */
    await expect(page.locator("main section").filter({ has: page.locator("h2", { hasText: /^Chronologie de l'argent$/ }) })).toContainText("Empreinte libérée");
    /* Journal. */
    const lignes = (await lireLeJournal(fin.contexte.request, { from: debut, adminUserId: jeuEssai.admin("finance").id })).filter((l) => l.action === "DEAL_HISTORY_VIEWED");
    expect(lignes.map((l) => `${l.targetType} · ${l.targetId}`), "DEAL_HISTORY_VIEWED").toContain(`BOOKING · ${deal.id}`);
  });

  test("ADM-ARG-3 · invariants comptables sur tous les deals du jeu d'essai (ajoutée)", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    new JeuEssai().rejouer();
    const fin = await navigateurAdmin("finance");
    const ecarts: string[] = [];
    const resume: string[] = [];
    for (const d of dealsDuSeed()) {
      const { fiche } = await lireFiche(fin.contexte, d.id);
      if (!fiche) { ecarts.push(`${d.key} : fiche illisible`); continue; }
      const p = fiche.pricing;
      if (p.transportCents + p.commissionCents + p.premiumCents !== p.totalShipperCents) ecarts.push(`${d.key} : payé ≠ net + commission + prime`);
      if ((fiche.payment.refundAmountCents ?? 0) > p.totalShipperCents) ecarts.push(`${d.key} : remboursé > payé`);
      if (fiche.payment.refundAmountCents && !fiche.payment.capturedAt) ecarts.push(`${d.key} : remboursé sans débit`);
      // Recette § 5.16 (A166) — invariant Σ liste = cumul : chaque remboursement réel est dans la liste, et rien de plus.
      const liste = (fiche.payment.refunds ?? []).reduce((acc, r) => acc + r.amountCents, 0);
      if (liste !== (fiche.payment.capturedAt ? (fiche.payment.refundAmountCents ?? 0) : 0)) ecarts.push(`${d.key} : Σ remboursements listés ${euros(liste)} ≠ cumul ${euros(fiche.payment.refundAmountCents ?? 0)}`);
      const b = fiche.balance;
      if (!b) { ecarts.push(`${d.key} : aucun bilan servi`); continue; }
      if (b.capturedCents - b.refundedCents - b.paidOutCents !== b.platformHoldsCents) ecarts.push(`${d.key} : bilan qui n'additionne pas`);
      if (b.anomaly) ecarts.push(`${d.key} (${fiche.status}) : ${b.anomaly} — la plateforme détient ${euros(b.platformHoldsCents)}`);
      resume.push(`${d.key} ${fiche.status} : détient ${euros(b.platformHoldsCents)}${b.pending.length ? ` · attend ${b.pending.map((x) => x.kind).join("+")}` : ""}`);
    }
    test.info().annotations.push({ type: "constat", description: resume.join(" | ") });
    expect(ecarts, "aucun écart comptable sur le jeu d'essai").toEqual([]);
    /* Contre-épreuve (ANO-ADM-30) : le défaut d'origine du jeu d'essai remis en base — un deal débité puis annulé, jamais
       remboursé. Le bilan DOIT le signaler, à l'API et à l'écran ; sinon l'invariant ci-dessus ne prouvait rien. */
    const annule = jeuEssai.deal("bzv-cancelled");
    lireCoteServeur(`
      import prisma from "./packages/libs/prisma";
      (async () => { await prisma.booking.update({ where: { id: "${annule.id}" }, data: { refundAmountCents: null, refundedAt: null, refundId: null, refunds: [] /* A166 (§ 5.16) : la liste aussi */ } }); console.log("@@true"); process.exit(0); })();`);
    process.stdout.write(`   ↳ manœuvre base : remboursement retiré de bzv-cancelled (${annule.id}) — ADM-ARG-3, rejoué en afterAll\n`);
    const { fiche: fautive } = await lireFiche(fin.contexte, annule.id);
    expect(fautive!.balance, "le bilan signale l'argent sans destination").toMatchObject({ platformHoldsCents: fautive!.pricing.totalShipperCents, settled: true, anomaly: "UNALLOCATED_FUNDS" });
    await fin.page.goto(`${bo()}/deals/${annule.id}`, { waitUntil: "domcontentloaded" });
    await expect(fin.page.getByText(/^Argent sans destination : le deal est clos/), "l'écran l'affiche en rouge").toBeVisible({ timeout: 60_000 });
    /* Contre-épreuve de l'invariant Σ liste = cumul (§ 5.16) : le cumul remis à zéro, la liste gardée. */
    const incoherent = jeuEssai.deal("bzv-held");
    lireCoteServeur(`
      import prisma from "./packages/libs/prisma";
      (async () => { await prisma.booking.update({ where: { id: "${incoherent.id}" }, data: { refundAmountCents: null } }); console.log("@@true"); process.exit(0); })();`);
    process.stdout.write(`   ↳ manœuvre base : cumul remis à zéro, liste gardée sur bzv-held (${incoherent.id}) — ADM-ARG-3, rejoué en afterAll\n`);
    const { fiche: douteuse } = await lireFiche(fin.contexte, incoherent.id);
    expect(douteuse!.balance?.anomaly, "le bilan signale la liste qui dépasse le cumul").toBe("REFUND_RECORDS_MISMATCH");
    await fin.page.goto(`${bo()}/deals/${incoherent.id}`, { waitUntil: "domcontentloaded" });
    await expect(fin.page.getByText(/^Remboursements incohérents : la liste des remboursements enregistre plus que le cumul/), "l'écran le dit").toBeVisible({ timeout: 60_000 });
  });

  test("ADM-ARG-4 · le bilan et les libellés en français sur la fiche (ajoutée)", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(5 * 60_000);
    const fin = await navigateurAdmin("finance");
    const { page } = fin;
    /* Le deal en échec de versement : le bilan dit ce qui attend. */
    const bloque = jeuEssai.deal("bzv-completed-blocked");
    await page.goto(`${bo()}/deals/${bloque.id}`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    const bilan = page.locator("main section").filter({ has: page.locator("h2", { hasText: /^Bilan de l'argent$/ }) });
    await expect(bilan, "carte « Bilan de l'argent »").toBeVisible({ timeout: 60_000 });
    await expect(bilan).toContainText("Débité");
    await expect(bilan).toContainText("En attente");
    await expect(bilan).toContainText("versement en échec");
    await expect(page.getByText(/deal \w{8} · Terminée/), "statut du deal en français").toBeVisible();
    await expect(ligne(page, "Prix figé à la réservation", "Modèle")).toContainText("au colis");
    await expect(ligne(page, "Dates", "Terminé")).toContainText("automatique");
    /* Un deal terminé et versé : soldé. */
    const verse = jeuEssai.deal("bzv-completed");
    await page.goto(`${bo()}/deals/${verse.id}`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    await expect(page.locator("main section").filter({ has: page.locator("h2", { hasText: /^Bilan de l'argent$/ }) })).toContainText("Soldé", { timeout: 60_000 });
    /* Un deal refusé : l'empreinte a été libérée, rien n'a été débité. */
    const refuse = jeuEssai.deal("bzv-declined");
    await page.goto(`${bo()}/deals/${refuse.id}`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    await expect(page.locator("main section").filter({ has: page.locator("h2", { hasText: /^Chronologie de l'argent$/ }) })).toContainText("Empreinte libérée", { timeout: 60_000 });
    await expect(page.locator("main section").filter({ has: page.locator("h2", { hasText: /^Chronologie de l'argent$/ }) })).toContainText("Voyageur");
    /* Un identifiant de deal inconnu : un message, pas un code HTTP. */
    await page.goto(`${bo()}/deals/0123456789abcdef01234567`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Deal introuvable.", { exact: false })).toBeVisible({ timeout: 60_000 });
  });

  test("ADM-ARG-5 · le Support lit la chronologie sans lire l'argent (ajoutée)", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(5 * 60_000);
    const sup = await navigateurAdmin("support");
    const deal = jeuEssai.deal("bzv-disputed");
    /* Le serveur : pas l'argent, mais la chronologie (deals.history.read). */
    expect((await sup.contexte.request.get(`${api()}/admin/deals/${deal.id}/money`, { failOnStatusCode: false })).status(), "fiche argent : 403").toBe(403);
    expect((await sup.contexte.request.get(`${api()}/admin/deals/${deal.id}/history`)).ok(), "chronologie : 200").toBe(true);
    const debut = await debutDuScenario();
    /* L'écran : depuis le dossier de médiation, le Support atteint la chronologie. */
    const { page } = sup;
    await page.goto(`${bo()}/disputes/${deal.id}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("link", { name: /chronologie/i }).first().click();
    await expect(page).toHaveURL(new RegExp(`/deals/${deal.id}$`), { timeout: 60_000 });
    await expect(page.getByText(/403|does not allow/), "aucun message d'erreur brut").toHaveCount(0, { timeout: 30_000 });
    const carte = page.locator("main section").filter({ has: page.locator("h2", { hasText: /^Tout ce qui est arrivé à ce deal$/ }) });
    await expect(carte).toBeVisible({ timeout: 60_000 });
    await carte.getByRole("button", { name: "Charger la chronologie" }).click();
    await expect(carte.getByText(/\d+ événement\(s\) · \d+ action\(s\) admin/)).toBeVisible({ timeout: 30_000 });
    const lignes = await lireLeJournal((await navigateurAdmin("finance")).contexte.request, { from: debut, adminUserId: jeuEssai.admin("support").id });
    expect(lignes.map((l) => l.action), "DEAL_HISTORY_VIEWED, jamais DEAL_MONEY_VIEWED").toContain("DEAL_HISTORY_VIEWED");
    expect(lignes.map((l) => l.action)).not.toContain("DEAL_MONEY_VIEWED");
  });
});
