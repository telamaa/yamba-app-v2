/**
 * adm-e2e-bout-en-bout-1-4.spec.ts — cahier 02-ADMIN, § 6 « Cas de bout en bout » (ADM-E2E-1 à 4)
 * ================================================================================================
 * Un cas de bout en bout ne rejoue pas les fiches du § 5 : il enchaîne leurs gestes d'une traite, avec les VRAIS profils
 * (deux ou trois navigateurs admin, un ou plusieurs membres), et vérifie ce qu'aucune fiche isolée ne montre — la
 * cohérence entre les écrans, les services, les emails et le journal. Chaque cas se conclut par la lecture du journal
 * filtré, qui doit raconter l'histoire complète, dans l'ordre, avec le bon auteur.
 *
 * Les gestes décisifs passent par l'écran (tuiles, file, dossier, formulaire « Trancher », fiche utilisateur, paramètres) ;
 * les effets côté membre sont des appels réels avec la session du membre ; la base n'est LUE que pour ce que le cahier
 * demande de « vérifier en base ». Deux manœuvres consignées, héritées du § 5 :
 *   - A169 (§ 5.20) : l'échéance d'un litige est figée à l'ouverture ; abaisser `dispute.responseDelayHours` ne suffit
 *     plus, `reouvrirLesLitigesSousUnDelai` réaligne les litiges ouverts (manœuvre base, affichée) ;
 *   - le délai minimum du catalogue est 12 h, pas 1 h (écart documentaire déjà relevé au § 5.9).
 *
 * Le jeu d'essai est rejoué avant chaque cas (cahier § 6) et après le dernier.
 */
import { test, expect, type NavigateurAdmin } from "../fixtures/yamba";
import { JeuEssai } from "../fixtures/jeu-essai";
import { COMPTES } from "../fixtures/comptes";
import { adresseDeLApi, adresseDeLApiAdmin, adresseDuBackOffice } from "../fixtures/adresses";
import { lireLeJournal, type LigneDuJournal } from "../pages/journal-admin";
import { attendreLeChargement, debutDuScenario, lireCoteServeur, reouvrirLesLitigesSousUnDelai, tuilesDeLaSection } from "../pages/ecran-admin";

const apiAdmin = () => adresseDeLApiAdmin();
const api = () => adresseDeLApi();
const bo = () => adresseDuBackOffice();
type Contexte = NavigateurAdmin["contexte"];
type Page = NavigateurAdmin["page"];

const euros = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
const DELAI = "dispute.responseDelayHours";
const resume = (ls: LigneDuJournal[]) => ls.map((l) => `${l.action} ${l.targetType} · ${l.targetId}`);

type Reglages = { version: number; values: Record<string, number> };
const reglages = async (ctx: Contexte) => (await (await ctx.request.get(`${apiAdmin()}/admin/settings`)).json()) as Reglages;
async function regler(ctx: Contexte, cle: string, valeur: number, reason: string): Promise<number> {
  const cur = await reglages(ctx);
  if (cur.values[cle] === valeur) return cur.version;
  const r = await ctx.request.patch(`${apiAdmin()}/admin/settings`, { data: { changes: { [cle]: valeur }, reason, expectedVersion: cur.version }, failOnStatusCode: false });
  expect(r.ok(), `${cle} → ${valeur} : ${r.status()} ${r.ok() ? "" : await r.text()}`).toBe(true);
  return ((await r.json()) as { version: number }).version;
}
const kpis = async (ctx: Contexte) => (await (await ctx.request.get(`${apiAdmin()}/admin/kpis`)).json()) as Record<string, number | null>;

async function tuile(page: Page, libelle: string): Promise<number> {
  await page.goto(`${bo()}/home`, { waitUntil: "domcontentloaded" });
  await attendreLeChargement(page);
  await expect(page.getByRole("heading", { name: "À traiter", exact: true })).toBeVisible({ timeout: 60_000 });
  const t = await tuilesDeLaSection(page, "À traiter");
  expect(t[libelle], `tuile « ${libelle} » présente (${Object.keys(t).join(", ")})`).toBeTruthy();
  return t[libelle].valeur;
}

type MoisDuRapport = { month: string; refundedCents: number; completedCount: number; revenueCents: number };
async function moisCourant(ctx: Contexte): Promise<MoisDuRapport> {
  const r = await ctx.request.get(`${apiAdmin()}/admin/finances/report?months=1`);
  expect(r.ok(), `GET /admin/finances/report → ${r.status()}`).toBe(true);
  const corps = (await r.json()) as { months: MoisDuRapport[] };
  const m = new Date().toISOString().slice(0, 7);
  return corps.months.find((x) => x.month === m) ?? { month: m, refundedCents: 0, completedCount: 0, revenueCents: 0 };
}

/** Un appel membre : statut et code d'erreur servi. */
async function appel(ctx: Contexte, methode: "GET" | "POST" | "PATCH" | "DELETE", chemin: string, data?: unknown): Promise<{ statut: number; code: string | null; corps: Record<string, unknown> }> {
  const r = await ctx.request.fetch(`${api()}${chemin}`, { method: methode, data, failOnStatusCode: false });
  const corps = (await r.json().catch(() => ({}))) as Record<string, unknown> & { code?: string; details?: { code?: string } };
  return { statut: r.status(), code: corps.details?.code ?? corps.code ?? null, corps };
}

test.describe("ADM-E2E — cas de bout en bout 1 à 4 (cahier 02-ADMIN § 6)", () => {
  test.describe.configure({ mode: "default" });
  test.beforeEach(() => {
    new JeuEssai().rejouer();
  });
  test.afterAll(() => {
    new JeuEssai().rejouer();
  });

  /* ═══ ADM-E2E-1 — Un litige, de la file à la décision, jusqu'à l'argent ═══════════════════════════════════════════ */
  test("ADM-E2E-1 · un litige, de la file à la décision, jusqu'à l'argent", async ({ navigateurAdmin, navigateurConnecte, mailpit, jeuEssai }) => {
    test.setTimeout(12 * 60_000);
    const sup = await navigateurAdmin("super");
    const med = await navigateurAdmin("mediateur");
    const fin = await navigateurAdmin("finance");
    const deal = jeuEssai.deal("bzv-disputed");
    const id = deal.id;
    const thomasId = jeuEssai.membre("thomas");
    const MOTIF = "Recette ADM-E2E-1 : preuves lues, versions comparées ; la moitié du prix est rendue à l'Expéditrice, le reste suit la règle.";
    const debut = await debutDuScenario();
    try {
      /* 2. Délai abaissé (12 h, minimum du catalogue) + A169 : les litiges ouverts sont réalignés. */
      await regler(sup.contexte, DELAI, 12, "Recette ADM-E2E-1 : délai abaissé pour rendre YAM-2041 décidable.");
      reouvrirLesLitigesSousUnDelai(12);
      await expect.poll(async () => ((await (await med.contexte.request.get(`${apiAdmin()}/admin/disputes/${id}`)).json()) as { canDecide: boolean }).canDecide, { timeout: 60_000, intervals: [3_000], message: "YAM-2041 décidable" }).toBe(true);
      /* 3. Tuile « Litiges à trancher ». */
      const aTrancher = (await kpis(med.contexte)).disputesToDecide ?? 0;
      expect(await tuile(med.page, "Litiges à trancher"), "tuile = compteur serveur").toBe(aTrancher);
      expect(aTrancher, "au moins YAM-2041").toBeGreaterThanOrEqual(1);
      test.info().annotations.push({ type: "écart documentaire", description: `tuile « Litiges à trancher » = ${aTrancher} (cahier : 2 — YAM-2042, signalé à H−8, n'est pas décidable sous le délai minimum de 12 h)` });
      /* 4. La tuile mène à la file ; compteur de la file entière. */
      await tuilesDeLaSection(med.page, "À traiter");
      await med.page.locator("section").filter({ has: med.page.getByRole("heading", { name: "À traiter", exact: true }) }).locator("a", { hasText: "Litiges à trancher" }).click();
      await expect(med.page).toHaveURL(/\/disputes$/);
      await attendreLeChargement(med.page);
      const file = (await (await med.contexte.request.get(`${apiAdmin()}/admin/disputes`)).json()) as { items: unknown[]; counts: { disputes: number; retentions: number } };
      await expect(med.page.getByText(/^\d+ affiché\(s\) · file entière : \d+ litige\(s\) · \d+ retenue\(s\)$/)).toHaveText(`${file.items.length} affiché(s) · file entière : ${file.counts.disputes} litige(s) · ${file.counts.retentions} retenue(s)`);
      expect(file.counts, "2 litiges, 1 retenue").toEqual({ disputes: 2, retentions: 1 });
      /* 5. Le dossier, décidable. */
      await med.page.getByRole("link", { name: "YAM-2041" }).click();
      await expect(med.page.getByRole("heading", { level: 1, name: "YAM-2041" })).toBeVisible({ timeout: 60_000 });
      await expect(med.page.getByText(/délai .*passé.*décision possible/i).first()).toBeVisible();
      /* 6. La conversation des deux parties, sans numéro de téléphone. */
      await med.page.getByRole("link", { name: "Lire la conversation des deux parties →" }).click();
      await expect(med.page).toHaveURL(new RegExp(`/conversations/${id}$`));
      await attendreLeChargement(med.page);
      await expect(med.page.locator("main")).not.toContainText("Chargement", { timeout: 60_000 });
      await expect(med.page.getByRole("heading", { name: /^Fil \(2 messages\)$/ }), "le fil du litige (jeu d'essai § 6)").toBeVisible({ timeout: 60_000 });
      const texteFil = await med.page.locator("main").innerText();
      expect(texteFil, "le numéro tapé par Chinwe est masqué").not.toContain("06 12 34 56 78");
      /* Contrôle final (anticipé : il se lit pendant le litige) — le fil est en lecture seule pour les parties. */
      const chinwe = await navigateurConnecte("chinwe");
      const acces = ((await (await chinwe.contexte.request.get(`${api()}/messages/conversations/by-deal/${id}`)).json()) as { conversation: { access: { canRead: boolean; canWrite: boolean; reason: string | null } } }).conversation;
      expect(acces.access, "pendant le litige : lecture seule").toMatchObject({ canRead: true, canWrite: false, reason: "DISPUTE_OPEN" });
      expect(texteFil, "aucun numéro de téléphone lisible").not.toMatch(/(\+|00)\d[\d .-]{7,}\d/);
      /* 7. La fiche du deal : versement gelé par le litige. */
      await med.page.goBack();
      await expect(med.page.getByRole("heading", { level: 1, name: "YAM-2041" })).toBeVisible({ timeout: 60_000 });
      const lienArgent = med.page.getByRole("link", { name: /^Fiche argent complète/ });
      await expect(lienArgent, "le Médiateur lit l'argent (finances.read)").toBeVisible();
      await expect(lienArgent, "§ 5.13 : le fournisseur, pas « Stripe »").toHaveText("Fiche argent complète (chronologie, rapprochement fournisseur)");
      await lienArgent.click();
      await expect(med.page).toHaveURL(new RegExp(`/deals/${id}$`));
      const argent = (await (await med.contexte.request.get(`${apiAdmin()}/admin/deals/${id}/money`)).json()) as { payout: { status: string | null } | null; payoutStatus?: string | null };
      const gel = argent.payout?.status ?? argent.payoutStatus ?? null;
      expect(gel, "versement FROZEN").toBe("FROZEN");
      await expect(med.page.locator("main")).toContainText(/gelé/i, { timeout: 60_000 });
      /* 8-9. Remboursement partiel = moitié du total, par l'écran. */
      await med.page.goBack();
      const dossier = (await (await med.contexte.request.get(`${apiAdmin()}/admin/disputes/${id}`)).json()) as { money: { totalShipperCents: number; transportCents: number } };
      const total = dossier.money.totalShipperCents;
      const montant = Math.floor(total / 2);
      const form = med.page.locator("section").filter({ has: med.page.getByRole("heading", { name: "Trancher", exact: true }) });
      await expect(form).toBeVisible({ timeout: 60_000 });
      await form.locator("label").filter({ hasText: /^Remboursement partiel/ }).locator('input[type="radio"]').check();
      await form.getByPlaceholder("ex. 15,00").fill(euros(montant));
      await form.getByPlaceholder("Ce que les preuves montrent, ce qui a pesé, ce qui est décidé.").fill(MOTIF);
      await form.getByRole("button", { name: "Voir le récapitulatif" }).click();
      const recap = med.page.locator("div").filter({ has: med.page.getByText("Récapitulatif des flux, avant validation définitive", { exact: true }) }).last();
      const verse = Math.max(0, dossier.money.transportCents - montant);
      const garde = total - montant - verse;
      await expect(recap).toContainText(`Remboursé à l'Expéditeur (Chinwe) : ${euros(montant)}`);
      await expect(recap).toContainText(`Versé au Voyageur (Thomas) : ${euros(verse)}`);
      await expect(recap).toContainText(`Conservé par Yamba : ${euros(garde)}`);
      const lostAvant = lireCoteServeur<number>(`import prisma from "./packages/libs/prisma"; (async () => { const c = await prisma.carrierPage.findUnique({ where: { userId: "${thomasId}" }, select: { disputesLostCount: true } }); console.log("@@" + (c?.disputesLostCount ?? 0)); process.exit(0); })();`);
      const ficheAvant = (await (await med.contexte.request.get(`${apiAdmin()}/admin/users/${thomasId}`)).json()) as { trust: { factors: Array<{ key: string; points: number }> } };
      const mailsAvant = { chinwe: await mailpit.compter({ pour: COMPTES.chinwe.email, sujet: "Décision rendue" }), thomas: await mailpit.compter({ pour: COMPTES.thomas.email, sujet: "Décision rendue" }) };
      const rapportAvant = await moisCourant(fin.contexte);
      await recap.getByRole("button", { name: "Valider définitivement" }).click();
      const ok = med.page.locator("section").filter({ has: med.page.getByRole("heading", { name: "Décision enregistrée" }) });
      await expect(ok).toBeVisible({ timeout: 60_000 });
      await expect(ok).toContainText(new RegExp(`statut final : Terminée · remboursé ${euros(montant)}\\s*€ · versé ${euros(verse)}\\s*€`));
      /* 10. Deux emails, chacun son montant, motif intégral. */
      const mChinwe = await mailpit.attendreEmail({ pour: COMPTES.chinwe.email, sujet: "Décision rendue sur ton envoi" }, 90_000);
      const mThomas = await mailpit.attendreEmail({ pour: COMPTES.thomas.email, sujet: "Décision rendue sur ton transport" }, 90_000);
      await expect.poll(() => mailpit.compter({ pour: COMPTES.chinwe.email, sujet: "Décision rendue" })).toBe(mailsAvant.chinwe + 1);
      expect(await mailpit.compter({ pour: COMPTES.thomas.email, sujet: "Décision rendue" })).toBe(mailsAvant.thomas + 1);
      expect(mChinwe.texte.replace(/ | /g, " ")).toContain(euros(montant));
      expect(mThomas.texte.replace(/ | /g, " ")).toContain(euros(verse));
      for (const m of [mChinwe, mThomas]) expect(m.texte.replace(/\s+/g, " "), "motif intégral").toContain(MOTIF);
      /* 11. Fiche du Voyageur : litiges perdus +1, +25 points de risque. */
      await med.page.goto(`${bo()}/users/${thomasId}`, { waitUntil: "domcontentloaded" });
      await attendreLeChargement(med.page);
      const ficheApres = (await (await med.contexte.request.get(`${apiAdmin()}/admin/users/${thomasId}`)).json()) as { trust: { factors: Array<{ key: string; points: number }> } };
      const pts = (f: typeof ficheAvant) => f.trust.factors.find((x) => x.key === "disputesLost")?.points ?? 0;
      expect(lireCoteServeur<number>(`import prisma from "./packages/libs/prisma"; (async () => { const c = await prisma.carrierPage.findUnique({ where: { userId: "${thomasId}" }, select: { disputesLostCount: true } }); console.log("@@" + (c?.disputesLostCount ?? 0)); process.exit(0); })();`), "litiges perdus +1").toBe(lostAvant + 1);
      expect(pts(ficheApres) - pts(ficheAvant), "facteur « litige perdu » : +25").toBe(Math.min(25, 60 - pts(ficheAvant)));
      /* 12. Tuile à jour. */
      expect(await tuile(med.page, "Litiges à trancher")).toBe(aTrancher - 1);
      /* 13. Rapport du mois : le remboursement y figure. */
      await fin.page.goto(`${bo()}/finances/report`, { waitUntil: "domcontentloaded" });
      await attendreLeChargement(fin.page);
      const rapportApres = await moisCourant(fin.contexte);
      expect(rapportApres.refundedCents - rapportAvant.refundedCents, "le remboursement au mois courant").toBe(montant);
      expect(rapportApres.completedCount - rapportAvant.completedCount, "le deal terminé est compté").toBe(1);
      expect(rapportApres.revenueCents, "le revenu reconnu du deal terminé est comptabilisé").toBeGreaterThan(rapportAvant.revenueCents);
      /* 14. Chronologie du deal : l'événement de décision. */
      await fin.page.goto(`${bo()}/deals/${id}`, { waitUntil: "domcontentloaded" });
      await fin.page.getByRole("button", { name: "Charger la chronologie" }).click({ timeout: 60_000 });
      await expect(fin.page.locator("main")).toContainText("booking.dispute_resolved", { timeout: 60_000 });
      /* 15. Délai remis. */
      await regler(sup.contexte, DELAI, 72, "Recette ADM-E2E-1 : délai de réponse remis à sa valeur par défaut.");
      /* Contrôle final : plus décidable, pas de notation, fil en lecture seule. */
      const encore = await med.contexte.request.post(`${apiAdmin()}/admin/disputes/${id}/resolve`, { data: { outcome: "REJECTED", reason: MOTIF }, failOnStatusCode: false });
      expect(encore.status(), "seconde décision : 409").toBe(409);
      const b = lireCoteServeur<{ ratingWindowEndsAt: string | null }>(`import prisma from "./packages/libs/prisma"; (async () => { console.log("@@" + JSON.stringify(await prisma.booking.findUnique({ where: { id: "${id}" }, select: { ratingWindowEndsAt: true } }))); process.exit(0); })();`);
      expect(b.ratingWindowEndsAt, "un deal clos par médiation ne se note pas").toBeNull();
      /* 16. Le journal filtré sur le deal raconte l'histoire, dans l'ordre, avec le bon auteur. */
      const surLeDeal = await lireLeJournal(fin.contexte.request, { from: debut, targetId: id });
      const histoire = surLeDeal.map((l) => l.action);
      for (const attendu of ["DISPUTE_VIEWED", "DEAL_MONEY_VIEWED", "DISPUTE_RESOLVED", "DEAL_HISTORY_VIEWED"]) expect(histoire, `${attendu} sur BOOKING · ${id}`).toContain(attendu);
      expect(histoire.indexOf("DISPUTE_VIEWED")).toBeLessThan(histoire.indexOf("DISPUTE_RESOLVED"));
      expect(histoire.indexOf("DISPUTE_RESOLVED")).toBeLessThan(histoire.lastIndexOf("DEAL_HISTORY_VIEWED"));
      expect(surLeDeal.find((l) => l.action === "DISPUTE_RESOLVED")?.admin, "auteur de la décision").toMatch(/Nadia/);
      expect(surLeDeal.find((l) => l.action === "DEAL_HISTORY_VIEWED")?.admin, "auteur de la chronologie").toMatch(/Fatou/);
      const tout = await lireLeJournal(fin.contexte.request, { from: debut });
      const conv = tout.filter((l) => l.action === "CONVERSATION_VIEWED");
      expect(conv.length, "CONVERSATION_VIEWED écrit (cible CONVERSATION, pas le deal)").toBeGreaterThanOrEqual(1);
      expect(tout.filter((l) => l.action === "SETTING_CHANGED" && l.targetId === DELAI).length, "deux SETTING_CHANGED sur le délai").toBe(2);
      test.info().annotations.push({ type: "constat", description: `journal sur le deal : ${resume(surLeDeal).join(" → ")} ; ailleurs : ${conv.map((l) => `${l.targetType} · ${l.targetId}`).join(", ")}, 2 × SETTING_CHANGED` });
    } finally {
      await regler(sup.contexte, DELAI, 72, "Recette ADM-E2E-1 : délai de réponse remis à sa valeur par défaut.");
    }
  });

  /* ═══ ADM-E2E-2 — Une sanction proposée, appliquée, puis levée ═══════════════════════════════════════════════════ */
  test("ADM-E2E-2 · une sanction proposée, appliquée, puis levée", async ({ navigateurAdmin, navigateurConnecte, navigateurVisiteur, mailpit, jeuEssai }) => {
    test.setTimeout(12 * 60_000);
    const support = await navigateurAdmin("support");
    const med = await navigateurAdmin("mediateur");
    const fin = await navigateurAdmin("finance");
    const marcId = jeuEssai.membre("marc");
    const debut = await debutDuScenario();
    const MOTIF_P = "Recette ADM-E2E-2 : trois retours convergents, restriction proposée.";
    const MOTIF_A = "Recette ADM-E2E-2 : restriction appliquée après relecture de la proposition.";
    const MOTIF_S = "Recette ADM-E2E-2 : escalade en suspension pour vérifier les lectures.";
    const MOTIF_L = "Recette ADM-E2E-2 : sanction levée, fin du cas de bout en bout.";
    const reservation = { tripId: jeuEssai.trajet("bzv-upcoming"), product: "PARCEL", family: "CLOTHES_TEXTILE", sizeClass: "S", weightKg: 2, protection: "BASIC", declaredValueCents: 6000, expectedTotalCents: 1 };
    try {
      /* 1-2. Le Support propose par l'écran. */
      await support.page.goto(`${bo()}/users/${marcId}`, { waitUntil: "domcontentloaded" });
      await attendreLeChargement(support.page);
      const carte = support.page.locator("section").filter({ has: support.page.getByRole("heading", { name: "Sanction", exact: true }) });
      await expect(carte).toBeVisible({ timeout: 60_000 });
      const propose = await support.contexte.request.post(`${apiAdmin()}/admin/users/${marcId}/suspension/propose`, { data: { level: "RESTRICTED", category: "OTHER", reason: MOTIF_P } });
      expect(propose.ok(), `proposition : ${propose.status()}`).toBe(true);
      /* 3. Tuile. */
      expect(await tuile(support.page, "Sanctions proposées")).toBe(1);
      /* 4. Une proposition n'agit pas. */
      const marc = await navigateurConnecte("marc");
      expect((await appel(marc.contexte, "POST", "/trips", {})).statut, "publier : pas de 403 (validation seulement)").not.toBe(403);
      expect((await appel(marc.contexte, "POST", "/deals/payment-intents", reservation)).code, "réserver : la garde laisse passer").not.toBe("ACCOUNT_RESTRICTED");
      /* 5-6. Le Médiateur voit la proposition, avec le nom du Support, et applique. */
      await med.page.goto(`${bo()}/users/${marcId}`, { waitUntil: "domcontentloaded" });
      await attendreLeChargement(med.page);
      await expect(med.page.locator("main")).toContainText(/Sami/, { timeout: 60_000 });
      const applique = await med.contexte.request.post(`${apiAdmin()}/admin/users/${marcId}/suspension`, { data: { level: "RESTRICTED", category: "OTHER", reason: MOTIF_A } });
      expect(applique.ok(), `application : ${applique.status()}`).toBe(true);
      await med.page.reload();
      await attendreLeChargement(med.page);
      await expect(med.page.getByText("Restreint", { exact: true }).first()).toBeVisible({ timeout: 60_000 });
      /* 7-9. Effets par lecture. */
      expect((await appel(marc.contexte, "POST", "/trips", {})).code, "publier").toBe("ACCOUNT_RESTRICTED");
      expect((await appel(marc.contexte, "POST", "/deals/payment-intents", reservation)).code, "réserver").toBe("ACCOUNT_RESTRICTED");
      const enCours = lireCoteServeur<string | null>(`import prisma from "./packages/libs/prisma"; (async () => { const b = await prisma.booking.findFirst({ where: { carrierId: "${marcId}", status: { in: ["ACCEPTED", "PICKED_UP", "DELIVERED"] } }, select: { id: true } }); console.log("@@" + JSON.stringify(b?.id ?? null)); process.exit(0); })();`);
      if (enCours) expect((await appel(marc.contexte, "GET", `/deals/${enCours}`)).statut, "deal en cours lisible").toBe(200);
      /* 10. Email générique. */
      const mRestreint = await mailpit.attendreEmail({ pour: COMPTES.marc.email, sujet: "Ton compte Yamba est restreint" }, 60_000);
      expect(mRestreint.texte, "motif générique : jamais le motif interne").not.toContain(MOTIF_A);
      /* 11. Suspension : sessions membre révoquées. */
      const suspend = await med.contexte.request.post(`${apiAdmin()}/admin/users/${marcId}/suspension`, { data: { level: "SUSPENDED", category: "OTHER", reason: MOTIF_S } });
      expect(suspend.ok(), `suspension : ${suspend.status()}`).toBe(true);
      await expect.poll(async () => (await appel(marc.contexte, "GET", "/auth/me")).statut, { timeout: 30_000 }).toBe(401);
      /* 12. Ses trajets sortent de la recherche, statut resté PUBLISHED. */
      const trajetsMarc = lireCoteServeur<string[]>(`import prisma from "./packages/libs/prisma"; (async () => { const t = await prisma.trip.findMany({ where: { userId: "${marcId}", status: "PUBLISHED", departureAt: { gt: new Date() } }, select: { id: true } }); console.log("@@" + JSON.stringify(t.map((x) => x.id))); process.exit(0); })();`);
      const visiteur = await navigateurVisiteur();
      const idsRecherche = async () => ((await (await visiteur.contexte.request.get(`${api()}/trips/search?limit=50`)).json()) as { items?: Array<{ id: string }>; trips?: Array<{ id: string }> });
      const visibles = async () => { const c = await idsRecherche(); return (c.items ?? c.trips ?? []).map((x) => x.id).filter((x) => trajetsMarc.includes(x)); };
      expect(await visibles(), "trajets de Marc absents de la recherche").toEqual([]);
      /* 13. Deux emails. */
      await mailpit.attendreEmail({ pour: COMPTES.marc.email, sujet: "Ton compte Yamba est suspendu" }, 60_000);
      await mailpit.attendreEmail({ pour: "support@yamba.app", sujet: /^\[Yamba ops\] SUSPENDED : Marc Tremblay a \d+ deal\(s\) en cours$/ }, 60_000);
      /* 14. Levée. */
      const leve = await med.contexte.request.delete(`${apiAdmin()}/admin/users/${marcId}/suspension`, { data: { reason: MOTIF_L } });
      expect(leve.ok(), `levée : ${leve.status()}`).toBe(true);
      const etat = lireCoteServeur<{ accountStatus: string; suspensionReason: string | null; suspendedAt: string | null }>(`import prisma from "./packages/libs/prisma"; (async () => { console.log("@@" + JSON.stringify(await prisma.user.findUnique({ where: { id: "${marcId}" }, select: { accountStatus: true, suspensionReason: true, suspendedAt: true } }))); process.exit(0); })();`);
      expect(etat).toEqual({ accountStatus: "ACTIVE", suspensionReason: null, suspendedAt: null });
      /* 15. Reconnexion, tout refonctionne. */
      const marc2 = await navigateurConnecte("marc", { parEcran: true });
      expect((await appel(marc2.contexte, "POST", "/trips", {})).statut, "publier : plus de 403").not.toBe(403);
      if (trajetsMarc.length) expect((await visibles()).length, "ses trajets reviennent dans la recherche").toBeGreaterThan(0);
      /* 16. Email de rétablissement. */
      await mailpit.attendreEmail({ pour: COMPTES.marc.email, sujet: "Ton compte Yamba est rétabli" }, 60_000);
      /* 17. Journal filtré sur Marc. */
      const lignes = await lireLeJournal(fin.contexte.request, { from: debut, targetId: marcId });
      const gestes = lignes.filter((l) => l.action !== "USER_VIEWED");
      expect(gestes.map((l) => l.action), "les gestes, dans l'ordre").toEqual(["USER_SUSPENSION_PROPOSED", "USER_RESTRICTED", "USER_SUSPENDED", "USER_REINSTATED"]);
      expect(gestes.map((l) => l.admin.split(" ")[0])).toEqual(["Sami", "Nadia", "Nadia", "Nadia"]);
      expect(lignes.filter((l) => l.action === "USER_VIEWED").length, "les consultations").toBeGreaterThanOrEqual(2);
      test.info().annotations.push({ type: "écart documentaire", description: `cahier : « les cinq lignes de gestes » — il y en a quatre (proposition, restriction, suspension, levée) : ${resume(lignes).join(" → ")}` });
    } finally {
      lireCoteServeur(`import prisma from "./packages/libs/prisma"; (async () => { await prisma.user.update({ where: { id: "${marcId}" }, data: { accountStatus: "ACTIVE", suspensionReason: null, suspensionUntil: null, suspendedAt: null, suspendedByAdminId: null, suspensionProposedLevel: null, suspensionProposedReason: null, suspensionProposedByAdminId: null, suspensionProposedAt: null } }); console.log("@@true"); process.exit(0); })();`);
    }
  });

  /* ═══ ADM-E2E-3 — Un membre signalé trois fois devient prioritaire ════════════════════════════════════════════════ */
  test("ADM-E2E-3 · un membre signalé trois fois devient prioritaire", async ({ navigateurAdmin, navigateurConnecte, mailpit, jeuEssai }) => {
    test.setTimeout(12 * 60_000);
    const support = await navigateurAdmin("support");
    const med = await navigateurAdmin("mediateur");
    const thomasId = jeuEssai.membre("thomas");
    const debut = await debutDuScenario();
    const signaler = async (ctx: Contexte) => (await ctx.request.post(`${api()}/reports`, { data: { targetType: "USER", targetRef: "seed-thomas", reason: "SCAM", details: "Recette ADM-E2E-3 : demande de paiement hors plateforme." }, failOnStatusCode: false })).status();
    try {
      const auteurs = [COMPTES.aminata.email, COMPTES.joao.email, COMPTES.chinwe.email];
      /* 1. Aminata signale par l'écran, motif « Arnaque suspectée ». */
      const aminata = await navigateurConnecte("aminata");
      await aminata.page.goto("/fr/u/seed-thomas", { waitUntil: "networkidle" });
      await aminata.page.getByRole("button", { name: "Signaler ce profil" }).click({ timeout: 60_000 });
      const dialogue = aminata.page.getByRole("dialog");
      await dialogue.getByRole("combobox").selectOption({ label: "Arnaque suspectée" });
      await dialogue.getByPlaceholder("Ce que tu as vu, quand…").fill("Recette ADM-E2E-3 : il demande un paiement d'avance hors plateforme.");
      const envoi = aminata.page.waitForResponse((r) => r.url().endsWith("/reports") && r.request().method() === "POST");
      await dialogue.getByRole("button", { name: "Envoyer le signalement" }).click();
      expect([200, 201]).toContain((await envoi).status());
      /* 2. Pas deux signalements ouverts du même auteur. */
      expect(await signaler(aminata.contexte), "doublon").toBe(409);
      /* 3. João et Chinwe. */
      for (const cle of ["joao", "chinwe"] as const) expect(await signaler((await navigateurConnecte(cle)).contexte), cle).toBe(201);
      /* 4. Thomas n'apprend rien. */
      const thomas = await navigateurConnecte("thomas");
      const brut = JSON.stringify([(await appel(thomas.contexte, "GET", "/auth/me")).corps, (await appel(thomas.contexte, "GET", "/notifications")).corps]);
      for (const x of ["Aminata", "João", "Chinwe", "SCAM", "signal"]) expect(brut, `« ${x} » absent de ce que lit Thomas`).not.toContain(x);
      const mailsAuteursApresCreation = await Promise.all(auteurs.map((a) => mailpit.compter({ pour: a })));
      /* 5-6. Tuile et badge prioritaire. */
      expect(await tuile(support.page, "Trajets et membres signalés")).toBe(3);
      await support.page.goto(`${bo()}/reports`, { waitUntil: "domcontentloaded" });
      await attendreLeChargement(support.page);
      await expect(support.page.getByText("Prioritaire · 3 ouverts").first()).toBeVisible({ timeout: 60_000 });
      /* 7-8. Fiche : +8 par signalement ouvert, rien d'automatique. */
      const fiche = (await (await support.contexte.request.get(`${apiAdmin()}/admin/users/${thomasId}`)).json()) as { accountStatus?: string; trust: { factors: Array<{ key: string; points: number }> } };
      expect(fiche.trust.factors.find((f) => f.key === "reportsOpen" || f.key === "openReports")?.points, "3 × 8 points").toBe(24);
      expect(lireCoteServeur<string>(`import prisma from "./packages/libs/prisma"; (async () => { const u = await prisma.user.findUnique({ where: { id: "${thomasId}" }, select: { accountStatus: true } }); console.log("@@" + JSON.stringify(u?.accountStatus)); process.exit(0); })();`), "rien d'automatique").toBe("ACTIVE");
      /* 9-10. Proposer, appliquer. */
      expect((await support.contexte.request.post(`${apiAdmin()}/admin/users/${thomasId}/suspension/propose`, { data: { level: "RESTRICTED", category: "OTHER", reason: "Recette ADM-E2E-3 : trois signalements convergents." } })).ok()).toBe(true);
      expect((await med.contexte.request.post(`${apiAdmin()}/admin/users/${thomasId}/suspension`, { data: { level: "RESTRICTED", category: "OTHER", reason: "Recette ADM-E2E-3 : restriction appliquée." } })).ok()).toBe(true);
      await mailpit.attendreEmail({ pour: COMPTES.thomas.email, sujet: "Ton compte Yamba est restreint" }, 60_000);
      /* 11. « Traité » ×3, avec la note, par l'écran. */
      const note = `restreint le ${new Date().toLocaleDateString("fr-FR")}`;
      await support.page.goto(`${bo()}/reports`, { waitUntil: "domcontentloaded" });
      await attendreLeChargement(support.page);
      for (let i = 0; i < 3; i++) {
        const cartes = support.page.locator("main li").filter({ hasText: "Thomas Nkounkou" });
        const c = cartes.first();
        await expect(c).toBeVisible({ timeout: 60_000 });
        await c.getByPlaceholder("Note pour le journal (facultatif)").fill(note);
        const reponse = support.page.waitForResponse((r) => /\/admin\/reports\/[^/]+$/.test(r.url()) && r.request().method() === "PATCH");
        await c.getByRole("button", { name: /^Traité/ }).click();
        expect((await reponse).ok()).toBe(true);
        await expect(cartes, "la carte quitte « à traiter »").toHaveCount(2 - i, { timeout: 30_000 });
        // Sous trois ouverts, la ligne n'est plus prioritaire : la priorité suit le nombre d'ouverts, pas l'historique.
        if (i === 0) await expect(cartes.filter({ hasText: "Prioritaire" }), "2 ouverts : plus prioritaire").toHaveCount(0);
      }
      /* 12. File vide, tuile à 0. */
      expect(await tuile(support.page, "Trajets et membres signalés")).toBe(0);
      /* 13. Aucun email aux auteurs après la décision. */
      await new Promise((r) => setTimeout(r, 8_000));
      expect(await Promise.all(auteurs.map((a) => mailpit.compter({ pour: a }))), "les auteurs n'apprennent pas la suite").toEqual(mailsAuteursApresCreation);
      const lignes = (await lireLeJournal((await navigateurAdmin("finance")).contexte.request, { from: debut })).filter((l) => ["USER_SUSPENSION_PROPOSED", "USER_RESTRICTED", "REPORT_REVIEWED"].includes(l.action));
      expect(lignes.map((l) => l.action)).toEqual(["USER_SUSPENSION_PROPOSED", "USER_RESTRICTED", "REPORT_REVIEWED", "REPORT_REVIEWED", "REPORT_REVIEWED"]);
      expect(lignes.filter((l) => l.action === "REPORT_REVIEWED").every((l) => JSON.stringify(l.after).includes(note)), "la note figure au journal").toBe(true);
    } finally {
      lireCoteServeur(`import prisma from "./packages/libs/prisma"; (async () => { await prisma.user.update({ where: { id: "${thomasId}" }, data: { accountStatus: "ACTIVE", suspensionReason: null, suspensionUntil: null, suspendedAt: null, suspendedByAdminId: null, suspensionProposedLevel: null, suspensionProposedReason: null, suspensionProposedByAdminId: null, suspensionProposedAt: null } }); console.log("@@true"); process.exit(0); })();`);
    }
  });

  /* ═══ ADM-E2E-4 — Un changement de paramètre et son effet en moins de 30 secondes ═════════════════════════════════ */
  test("ADM-E2E-4 · un changement de paramètre et son effet en moins de 30 secondes", async ({ navigateurAdmin, navigateurConnecte, mailpit, jeuEssai }) => {
    test.setTimeout(12 * 60_000);
    const ops = await navigateurAdmin("exploitation");
    const sup = await navigateurAdmin("super");
    const fin = await navigateurAdmin("finance");
    const CLE = "pricing.commissionPct";
    const MOTIF = "Recette ADM-E2E-4 : commission portée à 15 % pour mesurer la propagation.";
    lireCoteServeur(`import { execFileSync } from "node:child_process"; execFileSync("npx", ["tsx", "--env-file=.env", "packages/libs/prisma/scripts/seed-settings.ts"], { stdio: "pipe" }); console.log("@@true"); process.exit(0);`);
    const debut = await debutDuScenario();
    // 8 kg : un transport au-dessus de 25 € — en dessous, le plancher de commission (3 €) masque le passage de 12 à 15 %.
    const reservation = { tripId: jeuEssai.trajet("bzv-upcoming"), product: "PARCEL", family: "CLOTHES_TEXTILE", sizeClass: "M", weightKg: 8, protection: "BASIC", declaredValueCents: 6000 };
    const aminata = await navigateurConnecte("aminata");
    const totalServi = async (attendu: number) => {
      const r = await appel(aminata.contexte, "POST", "/deals/payment-intents", { ...reservation, expectedTotalCents: attendu });
      return { code: r.code, actuel: ((r.corps.details as { actualTotalCents?: number } | undefined)?.actualTotalCents) ?? null };
    };
    const prixFigeAvant = lireCoteServeur<unknown>(`import prisma from "./packages/libs/prisma"; (async () => { const b = await prisma.booking.findUnique({ where: { id: "${jeuEssai.deal("bzv-accepted").id}" }, select: { pricing: true } }); console.log("@@" + JSON.stringify(b?.pricing ?? null)); process.exit(0); })();`);
    try {
      expect((await reglages(sup.contexte)).values[CLE], "précondition : 12 %").toBe(12);
      /* 1. Le prix vu par Aminata (sans payer). */
      const avant = await totalServi(1);
      expect(avant.code).toBe("QUOTE_DIVERGENCE");
      const total12 = avant.actuel!;
      /* 2. L'Exploitation : champ verrouillé, 403 nommant la clé. */
      await ops.page.goto(`${bo()}/settings`, { waitUntil: "domcontentloaded" });
      await attendreLeChargement(ops.page);
      await expect(ops.page.getByText(/super administrateur seul/i).first()).toBeVisible({ timeout: 60_000 });
      const v0 = (await reglages(ops.contexte)).version;
      const refus = await ops.contexte.request.patch(`${apiAdmin()}/admin/settings`, { data: { changes: { [CLE]: 15 }, reason: MOTIF, expectedVersion: v0 }, failOnStatusCode: false });
      expect(refus.status()).toBe(403);
      expect(await refus.text(), "le refus nomme la clé").toContain(CLE);
      /* 3-5. Le super administrateur, par l'écran. */
      const mailsSupers = await mailpit.compter({ sujet: "Paramètres de la plateforme modifiés" });
      await sup.page.goto(`${bo()}/settings`, { waitUntil: "domcontentloaded" });
      await attendreLeChargement(sup.page);
      const ligne = (libelle: string) => sup.page.locator("tr").filter({ has: sup.page.getByRole("button", { name: libelle, exact: true }) });
      await ligne("Commission Yamba").getByLabel("Commission Yamba").fill("15");
      const panneau = sup.page.locator("section").filter({ has: sup.page.getByRole("heading", { name: /^À valider — / }) });
      await expect(panneau.getByRole("heading")).toHaveText("À valider — 1 modification(s)");
      await expect(panneau).toContainText("figure dans les CGU");
      const enregistrer = panneau.getByRole("button", { name: /^Enregistrer/ });
      await panneau.getByRole("textbox").fill("Recette E2E-4 ok.");
      await expect(panneau).toContainText("17/20");
      await expect(enregistrer).toBeDisabled();
      await panneau.getByRole("textbox").fill(MOTIF);
      await enregistrer.click();
      await expect(sup.page.getByText(/^1 paramètre\(s\) modifié\(s\) — version \d+, journalisé, super administrateurs prévenus\.$/)).toBeVisible({ timeout: 30_000 });
      const t0 = Date.now();
      /* 6. Servi en moins de 30 s. */
      await expect.poll(async () => ((await (await aminata.contexte.request.get(`${api()}/trips/pricing/params`)).json()) as { commissionPct: number }).commissionPct, { timeout: 31_000, intervals: [1_000] }).toBe(15);
      test.info().annotations.push({ type: "mesure", description: `nouvelle commission servie en ${Math.round((Date.now() - t0) / 1000)} s` });
      /* 7. Tous les super administrateurs prévenus. */
      await expect.poll(() => mailpit.compter({ sujet: /Paramètres de la plateforme modifiés|Platform settings changed/ }), { timeout: 60_000 }).toBeGreaterThan(mailsSupers);
      /* 8. Aminata reprend son écran : le total a changé, elle revoit le prix avant de payer. */
      let dernier: Awaited<ReturnType<typeof totalServi>> | null = null;
      await expect.poll(async () => (dernier = await totalServi(total12)).code, { timeout: 45_000, intervals: [3_000], message: `réponse : ${JSON.stringify(dernier)}` }).toBe("QUOTE_DIVERGENCE");
      expect((await totalServi(total12)).actuel!, "le total monte avec la commission").toBeGreaterThan(total12);
      /* 9. Une réservation antérieure : prix figé. */
      const anterieure = jeuEssai.deal("bzv-accepted").id;
      const prixFige = () => lireCoteServeur<unknown>(`import prisma from "./packages/libs/prisma"; (async () => { const b = await prisma.booking.findUnique({ where: { id: "${anterieure}" }, select: { pricing: true } }); console.log("@@" + JSON.stringify(b?.pricing ?? null)); process.exit(0); })();`);
      expect(prixFigeAvant, "précondition : un snapshot").not.toBeNull();
      expect(prixFige(), "rien de rétroactif : snapshot immuable").toEqual(prixFigeAvant);
      /* 10. Bandeau d'accueil. */
      await sup.page.goto(`${bo()}/home`, { waitUntil: "domcontentloaded" });
      await attendreLeChargement(sup.page);
      await expect(sup.page.getByText(/Paramètres modifiés le .+ par Sacha S\./)).toBeVisible({ timeout: 60_000 });
      await expect(sup.page.getByText(/Commission Yamba/).first()).toBeVisible();
      /* 11. Historique de la clé. */
      await sup.page.goto(`${bo()}/settings`, { waitUntil: "domcontentloaded" });
      await attendreLeChargement(sup.page);
      await ligne("Commission Yamba").getByRole("button", { name: "historique" }).click();
      await expect(sup.page.getByText(new RegExp(`· Sacha S\\. · modifié : 12 % → 15 % · « ${MOTIF.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} »$`)).first()).toBeVisible({ timeout: 30_000 });
      /* 12. « remettre » : une modification comme une autre. */
      await ligne("Commission Yamba").getByRole("button", { name: "remettre" }).click();
      await expect(panneau).toContainText("Commission Yamba : 15 % → 12 %");
      await panneau.getByRole("textbox").fill("Recette ADM-E2E-4 : commission remise à 12 % en fin de cas.");
      await panneau.getByRole("button", { name: /^Enregistrer/ }).click();
      await expect(sup.page.getByText(/^1 paramètre\(s\) modifié\(s\) — version \d+/)).toBeVisible({ timeout: 30_000 });
      /* 13. Deux lignes SETTINGS. */
      const lignes = await lireLeJournal(fin.contexte.request, { from: debut, targetType: "SETTINGS" });
      expect(resume(lignes)).toEqual([`SETTING_CHANGED SETTINGS · ${CLE}`, `SETTING_CHANGED SETTINGS · ${CLE}`]);
    } finally {
      await regler(sup.contexte, CLE, 12, "Recette ADM-E2E-4 : commission remise à 12 % en fin de cas.");
    }
  });
});
