/**
 * adm-rap-rapprochement.spec.ts — cahier 02-ADMIN, § 5.13 « Rapprochement avec le fournisseur de paiement » (ADM-RAP-1 à 3)
 * =========================================================================================================================
 * Le rapprochement lit l'état RÉEL chez le fournisseur (paiement, remboursements, transfert) et le compare à la base. Sa
 * promesse tient en une phrase de l'écran : « Rien n'est modifié ». La fiche la prouve trois fois :
 *  - la BASE : le document du deal est relu avant et après, octet pour octet ;
 *  - le FOURNISSEUR : un intent que le fournisseur ne connaît pas doit rester inconnu après la lecture (un second
 *    rapprochement répond la même chose) — une lecture qui « adopte » l'intent créerait l'état qu'elle prétend lire ;
 *  - l'API de la fiche argent : identique avant / après.
 *
 * Le fournisseur de recette est FAKE, en mémoire DANS le processus deal-service : tout se joue par l'API. Garde de
 * sécurité : chaque fiche vérifie que le fournisseur servi est bien FAKE avant tout geste qui émet de l'argent (un
 * lanceur `nx serve` peut reprendre le port 6003 avec la clé Stripe du `.env`).
 *
 * ADM-RAP-2 (remboursement parti chez Stripe sans écriture) exige un compte Stripe réel : ⏭. Son substitut du cahier
 * (les neuf codes couverts par les tests unitaires) est VÉRIFIÉ ici, et trois divergences sont en plus provoquées pour de
 * vrai sur la pile locale, par des manœuvres consignées sur la base, défaites en `finally`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect, type NavigateurAdmin } from "../fixtures/yamba";
import { JeuEssai } from "../fixtures/jeu-essai";
import { adresseDeLApiAdmin, adresseDuBackOffice } from "../fixtures/adresses";
import { lireLeJournal } from "../pages/journal-admin";
import { attendreLeChargement, debutDuScenario, lireCoteServeur } from "../pages/ecran-admin";

const api = () => adresseDeLApiAdmin();
const bo = () => adresseDuBackOffice();
const RACINE = join(__dirname, "../../../..");

type Contexte = NavigateurAdmin["contexte"];
type Divergence = { code: string; message: string; dbCents: number | null; liveCents: number | null };
type Rapprochement = { provider: string; checkedAt: string; live: null | { intentStatus: string; amountCents: number; amountReceivedCents: number; refunds: unknown[]; transfer: null | { amountCents: number; reversedCents: number } }; divergences: Divergence[] };

const CODES = ["CAPTURE_NOT_RECORDED", "CAPTURE_RECORDED_NOT_LIVE", "REFUND_NOT_RECORDED", "REFUND_RECORDED_NOT_LIVE", "TRANSFER_MISSING", "TRANSFER_AMOUNT_MISMATCH", "TRANSFER_REVERSED_NOT_MARKED", "TRANSFER_MARKED_REVERSED_BUT_LIVE_OK", "INTENT_NOT_FOUND"];

/** Le document Mongo du deal, tel quel (comparaison avant / après). */
const documentDuDeal = (id: string) =>
  lireCoteServeur<Record<string, unknown>>(`
    import prisma from "./packages/libs/prisma";
    (async () => { console.log("@@" + JSON.stringify(await prisma.booking.findUnique({ where: { id: ${JSON.stringify(id)} } }))); process.exit(0); })();`);

/** Manœuvre consignée : pose des champs du deal en base (jamais par le rapprochement). */
function poserEnBase(id: string, data: Record<string, unknown>, fiche: string): void {
  lireCoteServeur(`
    import prisma from "./packages/libs/prisma";
    (async () => { await prisma.booking.update({ where: { id: ${JSON.stringify(id)} }, data: ${JSON.stringify(data)} as never }); console.log("@@true"); process.exit(0); })();`);
  process.stdout.write(`   ↳ manœuvre base : deal ${id.slice(-6)} ← ${JSON.stringify(data)} (${fiche})\n`);
}

async function rapprocher(ctx: Contexte, id: string): Promise<Rapprochement> {
  const r = await ctx.request.post(`${api()}/admin/deals/${id}/money/reconcile`);
  expect(r.ok(), `POST reconcile ${id} : ${r.status()} ${r.ok() ? "" : await r.text()}`).toBe(true);
  const corps = (await r.json()) as Rapprochement;
  expect(corps.provider, "garde : le fournisseur de recette est FAKE (jamais Stripe réel)").toBe("FAKE");
  return corps;
}
const codes = (r: Rapprochement) => r.divergences.map((d) => d.code);

test.describe("ADM-RAP — rapprochement avec le fournisseur (cahier 02-ADMIN § 5.13)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(() => {
    new JeuEssai().rejouer();
  });

  test("ADM-RAP-1 · rapprocher un deal avec le fournisseur Fake (local)", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    const fin = await navigateurAdmin("finance");
    /* Un deal dont l'intent seedé est INCONNU du Fake. Sa mémoire survit au rejeu du jeu d'essai : un geste d'argent d'une
       fiche précédente (relance, remboursement) a pu en faire connaître un. Le rapprochement étant en lecture seule, le
       sonder ne change rien — on prend le premier qui répond « introuvable ». */
    let deal = "";
    for (const cle of ["bzv-completed", "gru-completed", "bzv-expired", "sgn-expired", "fih-declined"]) {
      const id = jeuEssai.deal(cle).id;
      if (codes(await rapprocher(fin.contexte, id)).includes("INTENT_NOT_FOUND")) { deal = id; test.info().annotations.push({ type: "constat", description: `deal retenu : ${cle}` }); break; }
    }
    expect(deal, "au moins un deal du jeu d'essai dont l'intent est inconnu du Fake (sinon : redémarrer deal-service)").not.toBe("");
    const avantBase = documentDuDeal(deal);
    const avantFiche = await (await fin.contexte.request.get(`${api()}/admin/deals/${deal}/money`)).json();
    const debut = await debutDuScenario();
    /* 1. La carte et son texte. */
    const { page } = fin;
    await page.goto(`${bo()}/deals/${deal}`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    const carte = page.locator("section").filter({ has: page.getByRole("heading", { name: "Rapprochement avec le fournisseur", exact: true }) });
    await expect(carte).toBeVisible({ timeout: 60_000 });
    await expect(carte).toContainText("l'état réel du paiement, des remboursements et du transfert, comparé à la base. Journalisé. Rien n'est modifié.");
    /* Amélioration § 5.13 : le texte nomme le fournisseur réellement interrogé (le cahier écrit « chez Stripe »). */
    await expect(carte.locator("p").first()).toHaveText("Lecture seule chez le fournisseur de test (Fake) : l'état réel du paiement, des remboursements et du transfert, comparé à la base. Journalisé. Rien n'est modifié.");
    test.info().annotations.push({ type: "écart documentaire", description: "« Lecture seule chez Stripe » devient « chez le fournisseur de test (Fake) » en local, « chez Stripe » en production" });
    test.info().annotations.push({ type: "constat", description: `texte : « ${(await carte.locator("p").first().innerText()).trim()} »` });
    /* 2-3. « Rapprocher maintenant » → divergence attendue sur un intent seedé inconnu du Fake. */
    const reponse = page.waitForResponse((r) => r.url().endsWith(`/admin/deals/${deal}/money/reconcile`) && r.request().method() === "POST");
    await carte.getByRole("button", { name: "Rapprocher maintenant" }).click();
    const premier = (await (await reponse).json()) as Rapprochement;
    expect(premier.provider).toBe("FAKE");
    expect(codes(premier), "un intent seedé est inconnu du Fake : INTENT_NOT_FOUND").toEqual(["INTENT_NOT_FOUND"]);
    expect(premier.live, "rien de lu chez le fournisseur").toBeNull();
    await expect(carte).toContainText("Paiement introuvable chez le fournisseur", { timeout: 30_000 });
    /* Amélioration : sous le libellé, la conséquence et le geste en français, plus le message anglais du serveur. */
    await expect(carte).toContainText("Le fournisseur ne connaît pas ce paiement (en local : deal du jeu d'essai, attendu).");
    await expect(carte).toContainText("rien n'a été modifié en base");
    await expect(carte.getByText("The payment provider does not know this payment intent.", { exact: true }), "plus de message anglais affiché").toHaveCount(0);
    /* La lecture n'a rien créé chez le fournisseur : la même question reçoit la même réponse. */
    const second = await rapprocher(fin.contexte, deal);
    expect(codes(second), "second rapprochement : l'intent est TOUJOURS inconnu (la lecture ne l'a pas adopté)").toEqual(["INTENT_NOT_FOUND"]);
    /* 4. Rien n'a changé : base et fiche argent. */
    await page.reload({ waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    expect(documentDuDeal(deal), "le document du deal est inchangé").toEqual(avantBase);
    /* La fiche porte les actions admin du deal (le journal) : elles gagnent des LECTURES, rien d'autre ne bouge. */
    const apresFiche = (await (await fin.contexte.request.get(`${api()}/admin/deals/${deal}/money`)).json()) as { adminActions: Array<{ id: string; action: string }> };
    const sansJournal = (f: unknown) => ({ ...(f as Record<string, unknown>), adminActions: undefined });
    expect(sansJournal(apresFiche), "la fiche argent est inchangée (hors journal)").toEqual(sansJournal(avantFiche));
    const avantIds = new Set((avantFiche as { adminActions: Array<{ id: string }> }).adminActions.map((a) => a.id));
    expect([...new Set(apresFiche.adminActions.filter((a) => !avantIds.has(a.id)).map((a) => a.action))].sort(), "les actions ajoutées ne sont que des lectures").toEqual(["DEAL_MONEY_VIEWED", "DEAL_RECONCILED"]);
    /* Journal : une ligne par rapprochement, provider et codes seulement. */
    const lignes = (await lireLeJournal(fin.contexte.request, { from: debut, adminUserId: jeuEssai.admin("finance").id })).filter((l) => l.action === "DEAL_RECONCILED");
    expect(lignes.map((l) => `${l.targetType} · ${l.targetId}`)).toEqual([`BOOKING · ${deal}`, `BOOKING · ${deal}`]);
    expect(lignes[0].after, "{ provider, divergences }").toEqual({ provider: "FAKE", divergences: ["INTENT_NOT_FOUND"] });
    /* 5. Un deal sans paiement : bouton absent, 400 par l'API. Aucun deal du jeu d'essai n'en est dépourvu → manœuvre. */
    const sansPaiement = jeuEssai.deal("bzv-declined").id;
    const intent = (documentDuDeal(sansPaiement) as { paymentIntentId: string }).paymentIntentId;
    test.info().annotations.push({ type: "écart documentaire", description: "le cahier cite « un deal PENDING » : tous les deals du jeu d'essai portent un intent — l'état « sans paiement » est posé par manœuvre sur bzv-declined" });
    try {
      poserEnBase(sansPaiement, { paymentIntentId: null }, "ADM-RAP-1 étape 5");
      await page.goto(`${bo()}/deals/${sansPaiement}`, { waitUntil: "domcontentloaded" });
      await attendreLeChargement(page);
      await expect(page.getByText("Aucun paiement à rapprocher.", { exact: true })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByRole("button", { name: "Rapprocher maintenant" })).toHaveCount(0);
      const direct = await fin.contexte.request.post(`${api()}/admin/deals/${sansPaiement}/money/reconcile`, { failOnStatusCode: false });
      expect(direct.status(), "appel direct : 400").toBe(400);
      const corps = (await direct.json()) as { message: string; details?: { code?: string } };
      expect(corps.message).toBe("This deal has no payment to reconcile.");
      expect(corps.details?.code).toBe("NO_PAYMENT_TO_RECONCILE");
    } finally {
      poserEnBase(sansPaiement, { paymentIntentId: intent }, "ADM-RAP-1 étape 5, retour");
    }
    const refusees = (await lireLeJournal(fin.contexte.request, { from: debut })).filter((l) => l.action === "DEAL_RECONCILED" && l.targetId === sansPaiement);
    expect(refusees, "le refus n'écrit rien").toEqual([]);
  });

  test("ADM-RAP-2 · détecter une divergence réelle (substitut + manœuvres locales) ⏭ Stripe", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(8 * 60_000);
    test.info().annotations.push({ type: "⏭ partiel", description: "un remboursement fait depuis le tableau de bord Stripe exige un compte Stripe réel : substitut du cahier vérifié (9 codes dans les tests unitaires) + 4 divergences provoquées sur la pile locale, dont REFUND_NOT_RECORDED" });
    /* Substitut du cahier : chaque code est attendu par un test unitaire du deal-service. */
    const sources = ["apps/deal-service/src/services/admin-finance.rules.spec.ts", "apps/deal-service/src/services/admin-finance.service.spec.ts"].map((f) => readFileSync(join(RACINE, f), "utf-8")).join("\n");
    for (const code of CODES) expect(sources, `le code ${code} est couvert par un test unitaire`).toContain(code);
    /* Divergences réelles. Le Fake ne connaît un intent seedé qu'après un GESTE d'argent (ANO-ADM-31 : la lecture ne
       l'adopte plus) : on relance le versement (transfert Fake réel) et on applique un remboursement manuel de 1 €
       (argent réel côté Fake). Puis la base est décalée par manœuvre, et le rapprochement doit nommer chaque écart. */
    const fin = await navigateurAdmin("finance");
    const sup = await navigateurAdmin("super");
    const deal = jeuEssai.deal("bzv-completed-blocked").id;
    const garde = await rapprocher(fin.contexte, deal); // garde FAKE AVANT d'émettre de l'argent
    /* La mémoire du Fake survit au rejeu du jeu d'essai : un passage précédent a pu faire connaître l'intent. */
    test.info().annotations.push({ type: "constat", description: `avant les gestes : ${codes(garde).includes("INTENT_NOT_FOUND") ? "intent inconnu du Fake" : `intent déjà connu du Fake (geste d'un passage précédent) — ${codes(garde).join(", ")}`}` });
    try {
      const relance = await fin.contexte.request.post(`${api()}/admin/deals/${deal}/payout/retry`);
      expect(relance.ok(), `relance du versement : ${relance.status()} ${relance.ok() ? "" : await relance.text()}`).toBe(true);
      expect(((await relance.json()) as { payoutStatus: string }).payoutStatus, "versement envoyé par le Fake").toBe("SENT");
      const rembourse = await sup.contexte.request.post(`${api()}/admin/deals/${deal}/refund`, { data: { amountCents: 100, reason: "Recette ADM-RAP-2 : geste d'argent réel sur le fournisseur de test, jeu d'essai rejoué ensuite." } });
      expect(rembourse.ok(), `remboursement manuel : ${rembourse.status()} ${rembourse.ok() ? "" : await rembourse.text()}`).toBe(true);
      const envoye = documentDuDeal(deal) as { payoutAmountCents: number; payoutStatus: string; refundAmountCents: number; transferId: string };
      expect(envoye.transferId, "un transfert Fake réel").toMatch(/^tr_fake_/);
      const base = await rapprocher(fin.contexte, deal);
      expect(base.live, "le Fake connaît maintenant l'intent (geste réel)").not.toBeNull();
      expect(base.live!.transfer?.amountCents, "et le transfert").toBe(envoye.payoutAmountCents);
      /* Le Fake cumule les remboursements d'un rejeu à l'autre : on part de CE qu'il montre. */
      const live = (base.live!.refunds as Array<{ amountCents: number }>).reduce((t, r) => t + r.amountCents, 0);
      test.info().annotations.push({ type: "constat", description: `après les gestes : ${codes(base).join(", ") || "concordance"} — remboursé chez le Fake ${live} cts, en base ${envoye.refundAmountCents} cts` });
      /* Concordance des remboursements posée, pour isoler chaque écart. */
      poserEnBase(deal, { refundAmountCents: live }, "ADM-RAP-2 concordance");
      const bruit = codes(await rapprocher(fin.contexte, deal));
      expect(bruit.filter((c) => c.startsWith("REFUND_") || c.startsWith("TRANSFER_")), "remboursements et transfert concordent").toEqual([]);
      /* REFUND_NOT_RECORDED — le code bloquant du cahier : de l'argent reparti chez le fournisseur sans écriture. */
      poserEnBase(deal, { refundAmountCents: live - 100 }, "ADM-RAP-2 remboursement non écrit");
      const nonEcrit = (await rapprocher(fin.contexte, deal)).divergences.find((d) => d.code === "REFUND_NOT_RECORDED");
      expect(nonEcrit, "REFUND_NOT_RECORDED").toBeTruthy();
      expect([nonEcrit!.dbCents, nonEcrit!.liveCents]).toEqual([live - 100, live]);
      /* REFUND_RECORDED_NOT_LIVE */
      poserEnBase(deal, { refundAmountCents: live + 400 }, "ADM-RAP-2 remboursement fantôme");
      const fantome = (await rapprocher(fin.contexte, deal)).divergences.find((d) => d.code === "REFUND_RECORDED_NOT_LIVE");
      expect(fantome, "REFUND_RECORDED_NOT_LIVE").toBeTruthy();
      expect([fantome!.dbCents, fantome!.liveCents]).toEqual([live + 400, live]);
      /* L'écran nomme la divergence en français, avec les deux montants et le geste. */
      const { page } = fin;
      await page.goto(`${bo()}/deals/${deal}`, { waitUntil: "domcontentloaded" });
      await attendreLeChargement(page);
      await page.getByRole("button", { name: "Rapprocher maintenant" }).click();
      /* La chronologie cite aussi le libellé (ligne de journal DEAL_RECONCILED) : on lit la carte du rapprochement. */
      const carte = page.locator("section").filter({ has: page.getByRole("heading", { name: "Rapprochement avec le fournisseur", exact: true }) });
      const ligne = carte.locator("li").filter({ hasText: "Remboursement en base absent ou échoué chez Stripe" });
      await expect(ligne, "divergence nommée à l'écran").toBeVisible({ timeout: 30_000 });
      await expect(ligne, "le geste à faire, en français").toContainText("l'Expéditeur n'a peut-être rien reçu. Vérifier avant de lui répondre.");
      await expect(carte, "statut du paiement en français").toContainText("empreinte posée");
      await expect(carte, "statut du remboursement en français").toContainText("réussi");
      test.info().annotations.push({ type: "constat", description: `ligne affichée : « ${(await ligne.innerText()).replace(/\s+/g, " ").trim()} »` });
      poserEnBase(deal, { refundAmountCents: live }, "ADM-RAP-2 remboursement, retour");
      /* TRANSFER_AMOUNT_MISMATCH */
      poserEnBase(deal, { payoutAmountCents: envoye.payoutAmountCents + 100 }, "ADM-RAP-2 montant");
      const m = (await rapprocher(fin.contexte, deal)).divergences.find((d) => d.code === "TRANSFER_AMOUNT_MISMATCH");
      expect(m, "TRANSFER_AMOUNT_MISMATCH").toBeTruthy();
      expect([m!.dbCents, m!.liveCents]).toEqual([envoye.payoutAmountCents + 100, envoye.payoutAmountCents]);
      poserEnBase(deal, { payoutAmountCents: envoye.payoutAmountCents }, "ADM-RAP-2 montant, retour");
      /* TRANSFER_MARKED_REVERSED_BUT_LIVE_OK */
      poserEnBase(deal, { payoutStatus: "REVERSED" }, "ADM-RAP-2 renversement");
      expect(codes(await rapprocher(fin.contexte, deal))).toContain("TRANSFER_MARKED_REVERSED_BUT_LIVE_OK");
      poserEnBase(deal, { payoutStatus: "SENT" }, "ADM-RAP-2 renversement, retour");
      /* Aucune de ces lectures n'a écrit : la base est exactement celle que la dernière manœuvre a posée. */
      expect((documentDuDeal(deal) as { refundAmountCents: number; payoutStatus: string; payoutAmountCents: number })).toMatchObject({ refundAmountCents: live, payoutStatus: "SENT", payoutAmountCents: envoye.payoutAmountCents });
    } finally {
      /* Les gestes d'argent (versement, remboursement) ont modifié le deal : le jeu d'essai est rejoué. */
      new JeuEssai().rejouer();
    }
  });

  test("ADM-RAP-3 · les gardes : profils, identifiants, journal", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(5 * 60_000);
    const deal = jeuEssai.deal("bzv-completed").id;
    const sup = await navigateurAdmin("support");
    const med = await navigateurAdmin("mediateur");
    const lecteur = await navigateurAdmin("super");
    const debut = await debutDuScenario();
    /* Le Support n'a pas finances.read : 403 serveur, et l'écran ne lui montre pas la carte. */
    const refus = await sup.contexte.request.post(`${api()}/admin/deals/${deal}/money/reconcile`, { failOnStatusCode: false });
    expect(refus.status(), "Support : 403").toBe(403);
    expect(((await refus.json()) as { details?: { code?: string } }).details?.code).toBe("ADMIN_PERMISSION_DENIED");
    await sup.page.goto(`${bo()}/deals/${deal}`, { waitUntil: "domcontentloaded" });
    await expect(sup.page.getByRole("heading", { name: /^Chronologie du deal/ })).toBeVisible({ timeout: 60_000 });
    await expect(sup.page.getByRole("button", { name: "Rapprocher maintenant" })).toHaveCount(0);
    /* Le Médiateur a finances.read : il rapproche. */
    const parMediateur = await rapprocher(med.contexte, deal);
    test.info().annotations.push({ type: "constat", description: `Médiateur : ${codes(parMediateur).join(", ") || "concordance"}` });
    /* Identifiants : inexistant → 404, invalide → 400 ; jamais un 500. */
    const inconnu = await med.contexte.request.post(`${api()}/admin/deals/0123456789abcdef01234567/money/reconcile`, { failOnStatusCode: false });
    expect(inconnu.status(), "deal inexistant : 404").toBe(404);
    const invalide = await med.contexte.request.post(`${api()}/admin/deals/pas-un-id/money/reconcile`, { failOnStatusCode: false });
    expect(invalide.status(), "identifiant invalide : 400").toBe(400);
    /* Journal : seul le rapprochement du Médiateur est écrit. */
    const lignes = (await lireLeJournal(lecteur.contexte.request, { from: debut })).filter((l) => l.action === "DEAL_RECONCILED");
    expect(lignes.map((l) => `${l.targetId}`), "une seule ligne (le Médiateur)").toEqual([deal]);
  });
});
