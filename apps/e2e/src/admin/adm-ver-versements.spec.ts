/**
 * adm-ver-versements.spec.ts — cahier 02-ADMIN, § 5.14 « Versements : rejeu et renversement » (ADM-VER-1 à 3) + fiches ajoutées
 * ============================================================================================================================
 * Deux gestes qui envoient de l'argent au Voyageur : « Relancer » un versement en échec, « Re-verser » après un renversement.
 * La question centrale n'est pas « le bouton marche-t-il » mais **« l'argent peut-il partir deux fois ? »**. Trois preuves :
 *  - **le même versement** : deux réponses qui portent le MÊME identifiant de transfert (le fournisseur Fake, comme Stripe,
 *    rend le transfert existant pour une clé d'idempotence déjà vue — une clé différente donnerait un autre identifiant) ;
 *  - **un seul fait** : un seul événement d'outbox `booking.payout_sent` pour le deal, un compteur de tentatives cohérent ;
 *  - **la concurrence réelle** : plusieurs appels LANCÉS ENSEMBLE par l'API de l'écran, pas l'un après l'autre.
 * Limite assumée : le cron `retryFailedPayouts` ne se force pas depuis un autre processus sans fausser la preuve (le Fake vit
 * dans la mémoire du deal-service) — la course cron ↔ admin est prouvée par les tests unitaires de `deal-settlement.service`.
 * Le jeu d'essai est rejoué avant chaque fiche (un versement envoyé ne se « désenvoie » pas).
 */
import { test, expect, type NavigateurAdmin } from "../fixtures/yamba";
import { JeuEssai } from "../fixtures/jeu-essai";
import { adresseDeLApiAdmin, adresseDuBackOffice } from "../fixtures/adresses";
import { lireLeJournal } from "../pages/journal-admin";
import { attendreLeChargement, debutDuScenario, lireCoteServeur } from "../pages/ecran-admin";

const api = () => adresseDeLApiAdmin();
const bo = () => adresseDuBackOffice();

type Contexte = NavigateurAdmin["contexte"];
type Page = NavigateurAdmin["page"];
type Fiche = {
  id: string; status: string;
  pricing: { transportCents: number; currencyCode: string };
  payout: { status: string | null; amountCents: number | null; transferId: string | null; attempts: number; nextRetryAt: string | null; reversal: { resolution: string; reason: string; byAdmin: string } | null };
  allowedActions: { retryPayout: boolean; resolveReversal: boolean };
};

const euros = (cents: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
const lireFiche = async (ctx: Contexte, id: string): Promise<Fiche> => {
  const r = await ctx.request.get(`${api()}/admin/deals/${id}/money`);
  expect(r.ok(), `GET /admin/deals/${id}/money → ${r.status()}`).toBe(true);
  return (await r.json()) as Fiche;
};
/** Les événements d'outbox d'un deal, par type (la base : ce que le relais publiera). */
const evenements = (id: string, type: string) =>
  lireCoteServeur<number>(`
    import prisma from "./packages/libs/prisma";
    (async () => { console.log("@@" + JSON.stringify(await prisma.outboxEvent.count({ where: { aggregateId: "${id}", eventType: "${type}" } }))); process.exit(0); })();`);
const ligne = (page: Page, carte: string, cle: string) =>
  page.locator("main section").filter({ has: page.locator("h2", { hasText: new RegExp(`^${carte}$`) }) }).locator("div.flex").filter({ has: page.locator("span", { hasText: new RegExp(`^${cle}$`) }) }).locator("span").last();
const corps = async (r: { json(): Promise<unknown> }) => (await r.json().catch(() => ({}))) as { payoutStatus?: string; transferId?: string | null; reason?: string | null; outcome?: string; message?: string; details?: { code?: string } };

test.describe("ADM-VER — versements : rejeu et renversement (cahier 02-ADMIN § 5.14)", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(() => {
    new JeuEssai().rejouer();
  });
  test.afterAll(() => {
    new JeuEssai().rejouer();
  });

  test("ADM-VER-1 · relancer un versement en échec", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(8 * 60_000);
    const fin = await navigateurAdmin("finance");
    const deal = jeuEssai.deal("bzv-completed-blocked");
    const avant = await lireFiche(fin.contexte, deal.id);
    expect(avant.payout.status, "précondition : versement en échec").toBe("FAILED");
    expect(avant.allowedActions.retryPayout).toBe(true);
    const montant = avant.payout.amountCents ?? avant.pricing.transportCents;
    test.info().annotations.push({ type: "constat", description: `avant : ${avant.payout.attempts} tentatives, prochaine relance ${avant.payout.nextRetryAt}, montant figé ${euros(montant)}` });
    const debut = await debutDuScenario();
    /* 1-2. Depuis la file, « Relancer ». */
    const { page } = fin;
    await page.goto(`${bo()}/finances?kind=FAILED`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    const rangee = page.locator("tbody tr").filter({ has: page.locator(`a[href="/deals/${deal.id}"]`) });
    await expect(rangee).toHaveCount(1, { timeout: 60_000 });
    const relance = page.waitForResponse((r) => r.url().endsWith(`/admin/deals/${deal.id}/payout/retry`) && r.request().method() === "POST");
    await rangee.getByRole("button", { name: "Relancer" }).click();
    const reponse = await relance;
    const r1 = await corps(reponse);
    expect(reponse.status(), "POST retry").toBe(200);
    expect(r1.payoutStatus, "fournisseur Fake, compte prêt : SENT").toBe("SENT");
    await expect(page.getByText(new RegExp(`^Versement de ${euros(montant).replace(/\s/g, "\\s")} envoyé à `))).toBeVisible({ timeout: 30_000 });
    /* 3. La fiche : compteur, montant, transfert. */
    const apres = await lireFiche(fin.contexte, deal.id);
    expect(apres.payout.status).toBe("SENT");
    expect(apres.payout.attempts, "une tentative de plus").toBe(avant.payout.attempts + 1);
    expect(apres.payout.amountCents, "le montant figé, pas recalculé").toBe(montant);
    expect(apres.payout.transferId, "l'identifiant rendu = l'identifiant enregistré").toBe(r1.transferId);
    expect(apres.allowedActions.retryPayout, "plus rien à relancer").toBe(false);
    expect(evenements(deal.id, "booking.payout_sent"), "un seul événement booking.payout_sent").toBe(1);
    /* 5. La fiche argent à l'écran. */
    await page.goto(`${bo()}/deals/${deal.id}`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    await expect(ligne(page, "Versement au Voyageur", "État")).toHaveText("envoyé", { timeout: 60_000 });
    await expect(ligne(page, "Versement au Voyageur", "Montant")).toHaveText(euros(montant));
    await expect(ligne(page, "Versement au Voyageur", "Transfert")).toHaveText(r1.transferId!);
    await expect(page.getByRole("button", { name: "Relancer le versement" }), "le bouton disparaît").toHaveCount(0);
    /* 6. Les refus par appel direct. */
    const accepte = await fin.contexte.request.post(`${api()}/admin/deals/${jeuEssai.deal("bzv-accepted").id}/payout/retry`, { failOnStatusCode: false });
    expect(accepte.status(), "deal ACCEPTED").toBe(400);
    expect((await corps(accepte)).message).toBe("Only a completed or late-cancelled deal has a payout.");
    const envoye = await fin.contexte.request.post(`${api()}/admin/deals/${deal.id}/payout/retry`, { failOnStatusCode: false });
    expect(envoye.status(), "versement déjà SENT").toBe(400);
    expect((await corps(envoye)).message).toMatch(/^Nothing to retry/);
    test.info().annotations.push({ type: "⏭ partiel", description: "admin partie au deal (403, bouton inerte) : aucun compte admin du jeu d'essai n'est partie — prouvé par admin-finance.service.spec.ts" });
    /* Journal : une ligne par relance qui a tourné (les 400 ne relancent rien). */
    const lignes = (await lireLeJournal(fin.contexte.request, { from: debut, adminUserId: jeuEssai.admin("finance").id })).filter((l) => l.action === "PAYOUT_RETRIED");
    expect(lignes.map((l) => `${l.targetType} · ${l.targetId}`)).toEqual([`BOOKING · ${deal.id}`]);
    expect(lignes[0].after).toMatchObject({ outcome: "SENT", transferId: r1.transferId });
  });

  test("ADM-VER-1 bis · le double clic ne verse jamais deux fois (écran)", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    const fin = await navigateurAdmin("finance");
    const deal = jeuEssai.deal("bzv-completed-blocked");
    const avant = await lireFiche(fin.contexte, deal.id);
    const { page } = fin;
    await page.goto(`${bo()}/deals/${deal.id}`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    const bouton = page.getByRole("button", { name: "Relancer le versement" });
    await expect(bouton).toBeVisible({ timeout: 60_000 });
    const posts: Array<{ statut: number; transferId: string | null }> = [];
    page.on("response", async (r) => {
      if (r.url().endsWith(`/admin/deals/${deal.id}/payout/retry`) && r.request().method() === "POST") posts.push({ statut: r.status(), transferId: (await corps(r)).transferId ?? null });
    });
    /* 4. Deux clics « très rapides » : un double clic natif. */
    await bouton.dblclick();
    await expect.poll(() => posts.length, { timeout: 30_000 }).toBeGreaterThanOrEqual(1);
    await page.waitForTimeout(3_000);
    test.info().annotations.push({ type: "constat", description: `double clic : ${posts.length} requête(s) — ${posts.map((p) => `${p.statut} ${p.transferId ?? ""}`).join(" ; ")}` });
    const apres = await lireFiche(fin.contexte, deal.id);
    expect(apres.payout.status).toBe("SENT");
    const envoyes = posts.filter((p) => p.transferId);
    expect(new Set(envoyes.map((p) => p.transferId)).size, "le même transfert").toBe(1);
    expect(evenements(deal.id, "booking.payout_sent"), "un seul événement").toBe(1);
    expect(apres.payout.attempts, "une seule tentative comptée").toBe(avant.payout.attempts + 1);
    /* Amélioration : l'écran n'envoie qu'UNE requête, et le message final dit le succès, pas un refus de la seconde. */
    expect(posts.length, "une seule requête partie de l'écran").toBe(1);
    /* Amélioration (§ 5.14) : le message nomme le montant, le Voyageur et le transfert. */
    await expect(page.getByText(new RegExp(`^Versement envoyé : ${euros(apres.payout.amountCents ?? 0).replace(/\s/g, "\\s")} à .+ \\(transfert ${apres.payout.transferId}\\)\\.$`))).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/^\d{3} :/), "jamais un code HTTP brut").toHaveCount(0);
  });

  test("ADM-VER-1 ter · relances simultanées par l'API : un seul versement", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    const fin = await navigateurAdmin("finance");
    const med = await navigateurAdmin("mediateur");
    const deal = jeuEssai.deal("bzv-completed-blocked");
    const avant = await lireFiche(fin.contexte, deal.id);
    const debut = await debutDuScenario();
    const url = `${api()}/admin/deals/${deal.id}/payout/retry`;
    const reponses = await Promise.all([fin, med, fin, med].map((n) => n.contexte.request.post(url, { failOnStatusCode: false })));
    const lus = await Promise.all(reponses.map(async (r) => ({ statut: r.status(), ...(await corps(r)) })));
    test.info().annotations.push({ type: "constat", description: `quatre relances simultanées : ${lus.map((l) => `${l.statut} ${l.payoutStatus ?? l.details?.code ?? ""} ${l.transferId ?? ""}`).join(" ; ")}` });
    const envoyes = lus.filter((l) => l.statut === 200 && l.payoutStatus === "SENT");
    expect(envoyes.length, "au moins une relance aboutit").toBeGreaterThanOrEqual(1);
    expect(new Set(envoyes.map((l) => l.transferId)).size, "tous les SENT portent le MÊME transfert").toBe(1);
    for (const l of lus.filter((x) => x.statut !== 200)) expect(l.details?.code, "une relance arrivée après l'envoi : refus nommé").toBe("PAYOUT_NOT_RETRYABLE");
    expect(lus.every((l) => l.statut === 200 || l.statut === 400), "jamais de 500").toBe(true);
    const apres = await lireFiche(fin.contexte, deal.id);
    expect(apres.payout.status).toBe("SENT");
    expect(apres.payout.transferId).toBe(envoyes[0].transferId);
    expect(evenements(deal.id, "booking.payout_sent"), "un seul événement booking.payout_sent").toBe(1);
    expect(apres.payout.attempts, "le compteur ne compte pas les courses").toBe(avant.payout.attempts + 1);
    /* Journal : une ligne par relance qui a tourné (200). */
    const lignes = (await lireLeJournal(fin.contexte.request, { from: debut })).filter((l) => l.action === "PAYOUT_RETRIED" && l.targetId === deal.id);
    expect(lignes.length, "une ligne par relance exécutée").toBe(lus.filter((l) => l.statut === 200).length);
  });

  test("ADM-VER-2 · clore un renversement : re-verser", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(8 * 60_000);
    const fin = await navigateurAdmin("finance");
    const deal = jeuEssai.deal("bzv-reversed");
    const avant = await lireFiche(fin.contexte, deal.id);
    expect(avant.payout.status, "précondition : renversé").toBe("REVERSED");
    expect(avant.allowedActions.resolveReversal).toBe(true);
    const ancienTransfert = avant.payout.transferId;
    const envoisAvant = evenements(deal.id, "booking.payout_sent");
    const debut = await debutDuScenario();
    /* 1. Depuis la file « Transferts renversés », « Décider ». */
    const { page } = fin;
    await page.goto(`${bo()}/finances?kind=REVERSED`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    await page.locator("tbody tr").filter({ has: page.locator(`a[href="/deals/${deal.id}"]`) }).getByRole("link", { name: "Décider" }).click();
    await expect(page).toHaveURL(new RegExp(`/deals/${deal.id}$`), { timeout: 60_000 });
    await attendreLeChargement(page);
    /* 2. Le texte du sous-formulaire. */
    const formulaire = page.locator("div.border-amber-200").filter({ has: page.getByRole("button", { name: "Re-verser" }) });
    await expect(formulaire).toBeVisible({ timeout: 60_000 });
    const texte = (await formulaire.locator("p").first().textContent())!.trim();
    test.info().annotations.push({ type: "constat", description: `sous-formulaire : « ${texte} »` });
    expect(texte).toMatch(/^Transfert renversé par (Stripe|le fournisseur de test \(Fake\)) : l'argent est revenu à la plateforme\. Décide, avec un motif \(20 caractères au moins\)\.$/);
    /* Amélioration (§ 5.14) : le fournisseur réellement en jeu — en local, Fake, pas « Stripe ». */
    expect(texte, "le formulaire nomme le fournisseur réel").toContain("le fournisseur de test (Fake)");
    /* 3. Motif court : boutons inactifs. */
    const motif = formulaire.locator("textarea");
    await motif.fill("RIB corrigé");
    await expect(formulaire.getByText("11 / 20"), "compteur du motif").toBeVisible();
    await expect(formulaire.getByRole("button", { name: "Re-verser" })).toBeDisabled();
    await expect(formulaire.getByRole("button", { name: "Abandonner" })).toBeDisabled();
    /* 4-5. Motif du cahier, « Re-verser ». */
    const raison = "RIB corrigé par le Voyageur, transfert à relancer";
    await motif.fill(raison);
    const envoi = page.waitForResponse((r) => r.url().endsWith(`/admin/deals/${deal.id}/payout/reversal`) && r.request().method() === "POST");
    await formulaire.getByRole("button", { name: "Re-verser" }).click();
    const rep = await envoi;
    expect(rep.status()).toBe(200);
    const b = await corps(rep);
    expect(b.outcome).toBe("RESENT");
    expect(b.payoutStatus, "Fake : le nouveau transfert part").toBe("SENT");
    await expect(page.getByText("Nouveau transfert envoyé", { exact: false }).first()).toBeVisible({ timeout: 30_000 });
    /* La carte et la base. */
    const apres = await lireFiche(fin.contexte, deal.id);
    expect(apres.payout.status).toBe("SENT");
    expect(apres.payout.transferId, "un NOUVEAU transfert (nouvelle clé d'idempotence)").not.toBe(ancienTransfert);
    expect(apres.payout.reversal).toMatchObject({ resolution: "RESENT", reason: raison });
    expect(evenements(deal.id, "booking.payout_sent"), "un événement de plus").toBe(envoisAvant + 1);
    await expect(ligne(page, "Versement au Voyageur", "Renversement clos")).toContainText(`re-versé par`, { timeout: 30_000 });
    await expect(ligne(page, "Versement au Voyageur", "Renversement clos")).toContainText(raison);
    await expect(page.getByRole("button", { name: "Re-verser" }), "le formulaire disparaît").toHaveCount(0);
    /* La file. */
    await page.goto(`${bo()}/finances?kind=REVERSED`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    await expect(page.locator(`a[href="/deals/${deal.id}"]`), "la ligne quitte la file").toHaveCount(0);
    /* 6. Recliquer (par l'API de l'écran : le bouton n'existe plus). */
    const encore = await fin.contexte.request.post(`${api()}/admin/deals/${deal.id}/payout/reversal`, { data: { outcome: "RESENT", reason: raison }, failOnStatusCode: false });
    expect(encore.status()).toBe(400);
    expect((await corps(encore)).message).toBe("This payout is not an open reversal.");
    expect(evenements(deal.id, "booking.payout_sent"), "toujours un seul nouvel envoi").toBe(envoisAvant + 1);
    /* Journal. */
    const lignes = (await lireLeJournal(fin.contexte.request, { from: debut, adminUserId: jeuEssai.admin("finance").id })).filter((l) => l.action === "PAYOUT_REVERSAL_RESOLVED");
    expect(lignes.map((l) => `${l.targetType} · ${l.targetId}`)).toEqual([`BOOKING · ${deal.id}`]);
    expect(lignes[0].after).toMatchObject({ outcome: "RESENT", reason: raison });
    /* Amélioration (§ 5.14) : l'identifiant du transfert renversé survit au journal (la base l'a remplacé). */
    expect((lignes[0].after as { previousTransferId?: string }).previousTransferId, "previousTransferId").toBe(ancienTransfert);
  });

  test("ADM-VER-2 bis · deux « Re-verser » simultanés : un seul nouveau transfert", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    const fin = await navigateurAdmin("finance");
    const med = await navigateurAdmin("mediateur");
    const deal = jeuEssai.deal("bzv-reversed");
    const envoisAvant = evenements(deal.id, "booking.payout_sent");
    const debut = await debutDuScenario();
    const url = `${api()}/admin/deals/${deal.id}/payout/reversal`;
    const data = { outcome: "RESENT", reason: "Recette ADM-VER-2 bis : deux re-versements lancés ensemble" };
    const reponses = await Promise.all([fin, med].map((n) => n.contexte.request.post(url, { data, failOnStatusCode: false })));
    const statuts = reponses.map((r) => r.status()).sort();
    test.info().annotations.push({ type: "constat", description: `deux re-versements simultanés : ${statuts.join(" + ")}` });
    expect(statuts, "un seul gagne, l'autre est refusé").toEqual([200, 400]);
    expect(evenements(deal.id, "booking.payout_sent"), "un seul nouveau transfert").toBe(envoisAvant + 1);
    const lignes = (await lireLeJournal(fin.contexte.request, { from: debut })).filter((l) => l.action === "PAYOUT_REVERSAL_RESOLVED" && l.targetId === deal.id);
    expect(lignes.length, "une seule clôture journalisée").toBe(1);
  });

  test("ADM-VER-3 · clore un renversement : abandonner", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    const fin = await navigateurAdmin("finance");
    const deal = jeuEssai.deal("bzv-reversed");
    const avant = await lireFiche(fin.contexte, deal.id);
    const envoisAvant = evenements(deal.id, "booking.payout_sent");
    const debut = await debutDuScenario();
    const { page } = fin;
    await page.goto(`${bo()}/deals/${deal.id}`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    const formulaire = page.locator("div.border-amber-200").filter({ has: page.getByRole("button", { name: "Abandonner" }) });
    const raison = "Compte du Voyageur fermé, manque à gagner assumé";
    await formulaire.locator("textarea").fill(raison);
    const envoi = page.waitForResponse((r) => r.url().endsWith(`/admin/deals/${deal.id}/payout/reversal`) && r.request().method() === "POST");
    await formulaire.getByRole("button", { name: "Abandonner" }).click();
    expect((await envoi).status()).toBe(200);
    await expect(page.getByText("Renversement abandonné, clos", { exact: false }).first()).toBeVisible({ timeout: 30_000 });
    /* 2. La carte, la base, la file. */
    const apres = await lireFiche(fin.contexte, deal.id);
    expect(apres.payout.status, "l'argent n'est pas reparti : toujours renversé").toBe("REVERSED");
    expect(apres.payout.transferId, "aucun nouveau transfert").toBe(avant.payout.transferId);
    expect(apres.payout.reversal).toMatchObject({ resolution: "WRITTEN_OFF", reason: raison });
    expect(apres.allowedActions.resolveReversal).toBe(false);
    expect(evenements(deal.id, "booking.payout_sent"), "aucun envoi").toBe(envoisAvant);
    await expect(ligne(page, "Versement au Voyageur", "Renversement clos")).toContainText("abandonné par", { timeout: 30_000 });
    await page.goto(`${bo()}/finances?kind=REVERSED`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    await expect(page.locator(`a[href="/deals/${deal.id}"]`), "la ligne quitte la file").toHaveCount(0);
    const lignes = (await lireLeJournal(fin.contexte.request, { from: debut, adminUserId: jeuEssai.admin("finance").id })).filter((l) => l.action === "PAYOUT_REVERSAL_RESOLVED");
    expect(lignes.map((l) => `${l.targetType} · ${l.targetId}`)).toEqual([`BOOKING · ${deal.id}`]);
    expect(lignes[0].after).toMatchObject({ outcome: "WRITTEN_OFF", reason: raison });
  });
  test("ADM-VER-4 · un écran périmé : le refus se dit en français et la fiche se recharge", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    const fin = await navigateurAdmin("finance");
    const med = await navigateurAdmin("mediateur");
    /* Renversement : Finance a la fiche ouverte, le Médiateur décide entre-temps. */
    const renverse = jeuEssai.deal("bzv-reversed");
    const { page } = fin;
    await page.goto(`${bo()}/deals/${renverse.id}`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    const formulaire = page.locator("div.border-amber-200").filter({ has: page.getByRole("button", { name: "Abandonner" }) });
    await expect(formulaire).toBeVisible({ timeout: 60_000 });
    const autre = await med.contexte.request.post(`${api()}/admin/deals/${renverse.id}/payout/reversal`, { data: { outcome: "WRITTEN_OFF", reason: "Recette ADM-VER-4 : décision prise par un autre administrateur" } });
    expect(autre.ok(), "le Médiateur clôt d'abord").toBe(true);
    await formulaire.locator("textarea").fill("Recette ADM-VER-4 : décision sur un écran périmé");
    const tardive = page.waitForResponse((r) => r.url().endsWith(`/admin/deals/${renverse.id}/payout/reversal`) && r.request().method() === "POST");
    await formulaire.getByRole("button", { name: "Re-verser" }).click();
    expect((await tardive).status(), "le serveur refuse").toBe(400);
    await expect(page.getByText("Ce renversement est déjà clos (un autre administrateur vient de décider ?). La fiche est rechargée.")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Re-verser" }), "fiche rechargée : plus de formulaire").toHaveCount(0);
    await expect(ligne(page, "Versement au Voyageur", "Renversement clos")).toContainText("abandonné par", { timeout: 30_000 });
    expect(evenements(renverse.id, "booking.payout_sent"), "rien n'est parti").toBe(0);
    /* Relance : la file est ouverte, le versement part par une autre voie. */
    const bloque = jeuEssai.deal("bzv-completed-blocked");
    await page.goto(`${bo()}/finances?kind=FAILED`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    const rangee = page.locator("tbody tr").filter({ has: page.locator(`a[href="/deals/${bloque.id}"]`) });
    await expect(rangee).toHaveCount(1, { timeout: 60_000 });
    expect((await med.contexte.request.post(`${api()}/admin/deals/${bloque.id}/payout/retry`)).ok(), "le Médiateur relance d'abord").toBe(true);
    await rangee.getByRole("button", { name: "Relancer" }).click();
    await expect(page.getByText("Rien à relancer : ce versement n'est plus en échec (envoyé ou traité entre-temps). La fiche est rechargée.")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(`a[href="/deals/${bloque.id}"]`), "la file rechargée ne le montre plus").toHaveCount(0, { timeout: 30_000 });
    await expect(page.getByText(/^\d{3} :|Relance impossible \(/), "jamais un code HTTP brut").toHaveCount(0);
  });
});
