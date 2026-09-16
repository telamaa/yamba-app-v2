/**
 * adm-par-parametres.spec.ts — cahier 02-ADMIN, § 5.20 « Paramètres de la plateforme » (ADM-PAR-1 à 7) + fiches ajoutées
 * ======================================================================================================================
 * Un paramètre est un curseur qui commande la plateforme entière (D62). Le chapitre se juge à ce que l'écran promet :
 *  - **une source** : la page, ses info-bulles et la documentation lisent le même catalogue ; aucun curseur sans lecteur ;
 *  - **un effet mesuré** : la nouvelle valeur est servie en moins de 30 s (cache du lecteur), jamais rétroactive ;
 *  - **une trace par clé** : une ligne de journal par clé, écrite dans la même transaction, email à tous les super
 *    administrateurs ;
 *  - **des gardes qui tiennent** : bornes, cohérence, portée jugées AVANT toute écriture ; deux admins en même temps →
 *    un seul gagne, l'autre lit un refus compréhensible, jamais un 500 ;
 *  - **un repli sûr** : document absent ou illisible → les défauts du catalogue, sans erreur.
 * Chaque fiche part d'un document supprimé (`seed-settings.ts`, geste de préparation non journalisé) et y revient.
 */
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { test, expect, type NavigateurAdmin } from "../fixtures/yamba";
import { JeuEssai } from "../fixtures/jeu-essai";
import { adresseDeLApi, adresseDeLApiAdmin, adresseDuBackOffice } from "../fixtures/adresses";
import { lireLeJournal } from "../pages/journal-admin";
import { AssistantReservation } from "../pages/reservation";
import { attendreLeChargement, debutDuScenario, lireCoteServeur, MOTIF_DE_RECETTE } from "../pages/ecran-admin";

const api = () => adresseDeLApiAdmin();
const bo = () => adresseDuBackOffice();
const RACINE = join(__dirname, "../../../..");
type Contexte = NavigateurAdmin["contexte"];
type Page = NavigateurAdmin["page"];
type Reglages = { version: number; values: Record<string, number>; defaults: Record<string, number>; catalog: Array<{ key: string; label: string; consumers: string[]; scope: string }>; planned: Array<{ key: string }>; updatedBy: { firstName: string } | null };

const GROUPES = ["Prix et commission", "Garantie Yamba", "Annulation", "Notation", "Litiges", "Réputation", "Messagerie", "Alertes d'exploitation", "Documents", "Données personnelles", "Conservation", "Confiance (TrustScore interne)"];

/**
 * Geste de préparation de recette (cahier ADM-PAR-7) : valeurs remises aux défauts, les services les relisent en 30 s.
 * A175 (§ 5.21) — la version ne repart plus à 0 : `base` est la version laissée par le script, les fiches comptent à partir d'elle.
 */
let base = 0;
/** La panne du repli sûr (ADM-PAR-7) et la création concurrente (ADM-PAR-8) : document supprimé, manœuvre base consignée. */
const supprimerLeDocument = () => {
  execFileSync("npx", ["tsx", "--env-file=.env", "-e", `import prisma from "./packages/libs/prisma"; (async () => { await prisma.platformSettings.deleteMany({ where: { key: "current" } }); process.exit(0); })();`], { cwd: RACINE, encoding: "utf-8", timeout: 120_000 });
  process.stdout.write("   ↳ manœuvre en base : document des paramètres supprimé\n");
};
const remettreLaBaseAZero = () => {
  const sortie = execFileSync("npx", ["tsx", "--env-file=.env", "packages/libs/prisma/scripts/seed-settings.ts"], { cwd: RACINE, encoding: "utf-8", timeout: 120_000 });
  const derniere = sortie.trim().split("\n").pop() ?? "";
  base = Number(/→ (\d+)\)/.exec(derniere)?.[1] ?? 0);
  process.stdout.write(`   ↳ seed-settings : ${derniere} (base ${base})\n`);
};
const lire = async (ctx: Contexte): Promise<Reglages> => (await (await ctx.request.get(`${api()}/admin/settings`)).json()) as Reglages;
const ecrire = (ctx: Contexte, changes: Record<string, number>, expectedVersion: number, reason = MOTIF_DE_RECETTE("ADM-PAR")) =>
  ctx.request.patch(`${api()}/admin/settings`, { data: { changes, reason, expectedVersion }, failOnStatusCode: false });
const remettre = (ctx: Contexte, body: { keys?: string[]; expectedVersion: number; reason?: string }) =>
  ctx.request.post(`${api()}/admin/settings/reset`, { data: { reason: MOTIF_DE_RECETTE("ADM-PAR"), ...body }, failOnStatusCode: false });
const poser = async (ctx: Contexte, changes: Record<string, number>) => {
  const r = await ecrire(ctx, changes, (await lire(ctx)).version);
  expect(r.ok(), `PATCH ${JSON.stringify(changes)} : ${r.status()} ${r.ok() ? "" : await r.text()}`).toBe(true);
  return (await r.json()) as { version: number };
};
/** Un constat : annoté ET imprimé (le rapporteur « line » ne montre pas les annotations). */
const constat = (description: string) => {
  test.info().annotations.push({ type: "constat", description });
  process.stdout.write(`   ↳ constat : ${description}\n`);
};
const ligne = (page: Page, libelle: string) => page.locator("tr").filter({ has: page.getByRole("button", { name: libelle, exact: true }) });
const prixServis = async (ctx: Contexte) => (await (await ctx.request.get(`${adresseDeLApi()}/trips/pricing/params`)).json()) as { commissionPct: number; version: number };
const superAdminsJoignables = () =>
  lireCoteServeur<Array<{ email: string; preferredLocale: string | null }>>(`
    import prisma from "./packages/libs/prisma";
    (async () => { const u = await prisma.user.findMany({ where: { roles: { has: "ADMIN" }, adminRoles: { has: "SUPER_ADMIN" }, isDeleted: false, OR: [{ emailSuppressedAt: null }, { emailSuppressedAt: { isSet: false } }] }, select: { email: true, preferredLocale: true } }); console.log("@@" + JSON.stringify(u)); process.exit(0); })();`);

test.describe("ADM-PAR — paramètres de la plateforme (cahier 02-ADMIN § 5.20)", () => {
  // Pas de mode « serial » : chaque fiche repart d'un document supprimé, un échec ne doit pas masquer les suivantes.
  test.beforeEach(() => remettreLaBaseAZero());
  test.afterAll(() => remettreLaBaseAZero());

  test("ADM-PAR-1 · la page, ses groupes et ses trois classes", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(5 * 60_000);
    const sup = await navigateurAdmin("super");
    const debut = await debutDuScenario();
    const { page } = sup;
    await page.goto(`${bo()}/settings`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    /* 1. Barre d'état. */
    await expect(page.getByText(new RegExp(`^Version\\s*${base}$`))).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("· toutes les valeurs sont celles par défaut")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Tout réinitialiser/ }), "rien ne diffère : pas de bouton").toHaveCount(0);
    /* 2. Douze groupes, dans l'ordre, puis la classe B. */
    const titres = (await page.locator("main h2").allTextContents()).map((t) => t.trim());
    expect(titres.slice(0, 12)).toEqual(GROUPES);
    expect(titres[12]).toBe("Modifiables par déploiement seulement");
    /* 3. Colonnes. */
    const colonnes = (await page.locator("main table").first().locator("thead th").allTextContents()).map((t) => t.trim());
    expect(colonnes).toEqual(["Paramètre", "En vigueur", "Nouvelle valeur", "Défaut", "Portée", ""]);
    await expect(ligne(page, "Commission Yamba").getByRole("button", { name: "historique" })).toBeVisible();
    /* 4. Panneau d'explication. */
    await page.getByRole("button", { name: "Commission Yamba", exact: true }).click();
    const panneau = ligne(page, "Commission Yamba");
    await expect(panneau).toContainText("Exemple : Transport 20 € → commission 2,40 € (12 %).");
    await expect(panneau).toContainText("Bornes : 5 % à 20 % · lu par deal-service, trip-service, user-ui.");
    await expect(panneau).toContainText("Cette valeur figure dans les CGU : mettre le texte à jour après modification.");
    /* 5. Classe B. */
    await expect(page.getByText("Invariants de sécurité : visibles ici pour la vue d'ensemble, jamais depuis une page web.")).toBeVisible();
    await expect(page.getByText(/Session admin : accès 15 min · inactivité 45 min · 12 h de vie/)).toBeVisible();
    await expect(page.locator("main input"), "la classe B n'a aucun champ").toHaveCount((await lire(sup.contexte)).catalog.length);
    /* 6. Documentation : même texte, classe C en fin de page. */
    await page.getByRole("link", { name: "Documentation des paramètres" }).click();
    await expect(page).toHaveURL(/\/settings\/docs$/);
    await attendreLeChargement(page);
    await expect(page.getByRole("heading", { name: "Commission Yamba" })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Exemple : Transport 20 € → commission 2,40 € (12 %).")).toBeVisible();
    const docTitres = (await page.locator("main h2").allTextContents()).map((t) => t.trim());
    expect(docTitres.at(-1)).toBe("Prévus, pas encore lus par le code (classe C)");
    await expect(page.getByText(/Un curseur qui ne commande rien serait une illusion de contrôle/)).toBeVisible();
    /* Règle : aucun curseur sans lecteur ; aucune clé prévue n'a de curseur. */
    const reglages = await lire(sup.contexte);
    expect(reglages.catalog.filter((d) => d.consumers.length === 0).map((d) => d.key), "chaque clé a un consommateur").toEqual([]);
    const cles = new Set(reglages.catalog.map((d) => d.key));
    expect(reglages.planned.filter((p) => cles.has(p.key)), "classe C jamais réglable").toEqual([]);
    /* Journal : rien pour la lecture. */
    expect(await lireLeJournal(sup.contexte.request, { from: debut, adminUserId: jeuEssai.admin("super").id })).toEqual([]);
  });

  test("ADM-PAR-2 · modifier une clé métier et voir l'effet en moins de 30 secondes", async ({ navigateurAdmin, navigateurConnecte, jeuEssai, mailpit }) => {
    test.setTimeout(8 * 60_000);
    new JeuEssai().rejouer();
    const sup = await navigateurAdmin("super");
    const destinataires = superAdminsJoignables();
    expect(destinataires.length, "au moins un super administrateur joignable").toBeGreaterThan(0);
    /* Précondition : tous les services servent déjà la valeur par défaut (le cache de 30 s a vu la suppression). */
    await expect.poll(async () => (await prixServis(sup.contexte)).commissionPct, { timeout: 60_000, intervals: [2_000] }).toBe(12);
    const reservation = jeuEssai.deal("bzv-accepted");
    const prixFige = () =>
      lireCoteServeur<{ commissionPct: number; commissionCents: number; totalShipperCents: number }>(`
        import prisma from "./packages/libs/prisma";
        (async () => { const b = await prisma.booking.findUnique({ where: { id: "${reservation.id}" }, select: { pricing: true } }); const p = b!.pricing as { commissionPct: number; commissionCents: number; totalShipperCents: number }; console.log("@@" + JSON.stringify({ commissionPct: p.commissionPct, commissionCents: p.commissionCents, totalShipperCents: p.totalShipperCents })); process.exit(0); })();`);
    const avantPrix = prixFige();
    const courriels = await Promise.all(destinataires.map((d) => mailpit.compter({ pour: d.email, sujet: /Paramètres de la plateforme modifiés|Platform settings changed/ })));
    const debut = await debutDuScenario();
    const { page } = sup;
    await page.goto(`${bo()}/settings`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    /* 1. Saisie + aperçu. */
    await ligne(page, "Commission Yamba").getByLabel("Commission Yamba").fill("15");
    await expect(ligne(page, "Commission Yamba")).toContainText("Sur un transport de 20 € : commission 3,00 €, total Expéditeur 23,00 €.");
    /* 2. Panneau collant. */
    const panneau = page.locator("section").filter({ has: page.getByRole("heading", { name: /^À valider — / }) });
    await expect(panneau.getByRole("heading")).toHaveText("À valider — 1 modification(s)");
    await expect(panneau).toContainText("Commission Yamba : 12 % → 15 %");
    await expect(panneau).toContainText("figure dans les CGU");
    /* 3. Motif. */
    const enregistrer = panneau.getByRole("button", { name: "Enregistrer (journalisé, email aux super administrateurs)" });
    await panneau.getByRole("textbox").fill("trop court");
    await expect(panneau).toContainText("10/20");
    await expect(enregistrer).toBeDisabled();
    const motif = "Recette ADM-PAR-2 : alignement de la commission sur la grille 2027.";
    await panneau.getByRole("textbox").fill(motif);
    await expect(enregistrer).toBeEnabled();
    /* 4. Enregistrer. */
    await enregistrer.click();
    await expect(page.getByText(new RegExp(`^1 paramètre\\(s\\) modifié\\(s\\) — version ${base + 1}, journalisé, super administrateurs prévenus\\.$`))).toBeVisible({ timeout: 30_000 });
    const t0 = Date.now();
    /* 5. Effet < 30 s : l'API, puis le navigateur d'un visiteur du front (son cache HTTP compris). */
    await expect.poll(async () => (await prixServis(sup.contexte)).commissionPct, { timeout: 45_000, intervals: [1_000] }).toBe(15);
    const delaiApi = Date.now() - t0;
    const { page: front } = await navigateurConnecte("pauline"); // le navigateur d'un membre, son cache HTTP compris
    await front.goto("/fr", { waitUntil: "domcontentloaded" });
    const urlPrix = `${adresseDeLApi()}/trips/pricing/params`;
    await expect.poll(async () => front.evaluate(async (u) => (await (await fetch(u)).json()).commissionPct, urlPrix), { timeout: 75_000, intervals: [1_000] }).toBe(15);
    const delaiNavigateur = Date.now() - t0;
    constat(`nouvelle commission servie en ${Math.round(delaiApi / 1000)} s (API), ${Math.round(delaiNavigateur / 1000)} s (navigateur du front)`);
    expect(delaiApi, "API : moins de 30 s").toBeLessThan(31_000);
    expect(delaiNavigateur, "navigateur du front : moins de 30 s").toBeLessThan(31_000);
    /* 6. Email à tous les super administrateurs, dans leur langue. */
    for (const [i, d] of destinataires.entries()) {
      const sujet = d.preferredLocale === "en" ? /Platform settings changed/ : /Paramètres de la plateforme modifiés/;
      await expect.poll(() => mailpit.compter({ pour: d.email, sujet: /Paramètres de la plateforme modifiés|Platform settings changed/ }), { timeout: 45_000 }).toBe(courriels[i] + 1);
      const email = await mailpit.attendreEmail({ pour: d.email, sujet });
      expect(email.texte).toContain(d.preferredLocale === "en" ? "Commission Yamba: 12% → 15%" : "Commission Yamba : 12 % → 15 %");
    }
    /* 7. Rechargement. */
    await page.reload({ waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    await expect(page.getByText(new RegExp(`^Version\\s*${base + 1}$`))).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/^· dernière écriture le .+ par Sacha S\.$/)).toBeVisible();
    await expect(page.getByText("· 1 valeur(s) modifiée(s) par rapport au défaut")).toBeVisible();
    await expect(ligne(page, "Commission Yamba").getByText("modifiée", { exact: true })).toBeVisible();
    /* 8. Historique. */
    await ligne(page, "Commission Yamba").getByRole("button", { name: "historique" }).click();
    // L'historique est le plus récent d'abord ; un rejeu de la fiche y laisse ses lignes précédentes (le journal n'est jamais purgé).
    await expect(page.getByText(new RegExp(`· Sacha S\\. · modifié : 12 % → 15 % · « ${motif.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} »$`)).first()).toBeVisible({ timeout: 30_000 });
    /* 9. Rien de rétroactif : la réservation déjà créée garde son prix. */
    expect(prixFige(), "prix figé de la réservation").toEqual(avantPrix);
    /* Accueil. */
    await page.goto(`${bo()}/home`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    await expect(page.getByText(/Paramètres modifiés le .+ par Sacha S\./)).toBeVisible({ timeout: 60_000 });
    /* Journal : une ligne, la bonne. */
    const lignes = await lireLeJournal(sup.contexte.request, { from: debut, adminUserId: jeuEssai.admin("super").id });
    const ecritures = lignes.filter((l) => l.targetType === "SETTINGS");
    expect(ecritures.map((l) => `${l.action} ${l.targetId}`)).toEqual(["SETTING_CHANGED pricing.commissionPct"]);
    expect(ecritures[0].before).toEqual({ key: "pricing.commissionPct", value: 12, version: base });
    expect(ecritures[0].after).toEqual({ key: "pricing.commissionPct", value: 15, reason: motif, version: base + 1 });
  });

  test("ADM-PAR-3 · une modification de trois clés écrit trois lignes", async ({ navigateurAdmin, jeuEssai, mailpit }) => {
    test.setTimeout(5 * 60_000);
    const ops = await navigateurAdmin("exploitation");
    const sup = await navigateurAdmin("super");
    const destinataire = superAdminsJoignables().find((d) => d.preferredLocale !== "en")!;
    const avantCourriels = await mailpit.compter({ pour: destinataire.email, sujet: /Paramètres de la plateforme modifiés/ });
    const debut = await debutDuScenario();
    const { page } = ops;
    await page.goto(`${bo()}/settings`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    await page.getByLabel("Versement en échec depuis").fill("50");
    await page.getByLabel("Retenue non arbitrée depuis").fill("8");
    await page.getByLabel("Emails en échec : fenêtre").fill("30");
    const panneau = page.locator("section").filter({ has: page.getByRole("heading", { name: /^À valider — / }) });
    await expect(panneau.getByRole("heading")).toHaveText("À valider — 3 modification(s)");
    const motif = "Recette ADM-PAR-3 : trois seuils d'alerte relevés d'un cran.";
    await panneau.getByRole("textbox").fill(motif);
    await panneau.getByRole("button", { name: /^Enregistrer/ }).click();
    await expect(page.getByText(new RegExp(`^3 paramètre\\(s\\) modifié\\(s\\) — version ${base + 1}`))).toBeVisible({ timeout: 30_000 });
    /* /audit, filtre « Paramètre modifié ». */
    await sup.page.goto(`${bo()}/audit`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(sup.page);
    await sup.page.getByLabel("Action").selectOption({ label: "Paramètre modifié" });
    await expect(sup.page.locator("main").getByText("alerts.payoutFailedHours").first()).toBeVisible({ timeout: 30_000 });
    const lignes = (await lireLeJournal(sup.contexte.request, { from: debut, action: "SETTING_CHANGED" }));
    expect(lignes.map((l) => l.targetId).sort()).toEqual(["alerts.emailsFailedWindowHours", "alerts.payoutFailedHours", "alerts.retentionHeldDays"]);
    expect(new Set(lignes.map((l) => (l.after as { reason: string }).reason))).toEqual(new Set([motif]));
    expect(new Set(lignes.map((l) => (l.after as { version: number }).version))).toEqual(new Set([base + 1]));
    /* L'email aux super administrateurs parle français, unités comprises. */
    await expect.poll(() => mailpit.compter({ pour: destinataire.email, sujet: /Paramètres de la plateforme modifiés/ }), { timeout: 45_000 }).toBe(avantCourriels + 1);
    const email = await mailpit.attendreEmail({ pour: destinataire.email, sujet: /Paramètres de la plateforme modifiés/ });
    constat(`email : ${email.texte.split("\n").filter((l) => l.includes("→")).join(" | ")}`);
    expect(email.texte).toContain("Versement en échec depuis : 48 h → 50 h");
    expect(email.texte).toContain("Retenue non arbitrée depuis : 7 j → 8 j");
    expect(email.texte).not.toMatch(/\b(hours|days)\b/);
  });

  test("ADM-PAR-4 · les gardes : bornes, cohérence, portée", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(5 * 60_000);
    const sup = await navigateurAdmin("super");
    const ops = await navigateurAdmin("exploitation");
    const support = await navigateurAdmin("support");
    const finance = await navigateurAdmin("finance");
    const debut = await debutDuScenario();
    const v = (await lire(sup.contexte)).version;
    const corps = async (r: Awaited<ReturnType<typeof ecrire>>) => `${r.status()} ${await r.text()}`;
    const cas: Array<[string, Awaited<ReturnType<typeof ecrire>>, number, RegExp?]> = [
      ["1 commission 50 %", await ecrire(sup.contexte, { "pricing.commissionPct": 50 }, v), 400, /Some values are out of bounds\./],
      ["2 taille M < S", await ecrire(sup.contexte, { "pricing.sizeCoefM": 0.9 }, v), 400, /S ≤ M ≤ L/],
      ["3 plafond sous la prime", await ecrire(sup.contexte, { "protection.extendedPremiumCents": 5000, "protection.extendedCapCents": 4000 }, v), 400],
      ["4 intervalle < délai", await ecrire(sup.contexte, { "messaging.reminderDelayMinutes": 120, "messaging.reminderMinIntervalMinutes": 60 }, v), 400, /intervalle entre deux relances/],
      ["5 Exploitation → clé métier", await ecrire(ops.contexte, { "pricing.commissionPct": 13 }, v), 403, /Your admin profile cannot change: pricing\.commissionPct\./],
      ["7a Support", await ecrire(support.contexte, { "alerts.payoutFailedHours": 50 }, v), 403],
      ["7b Finance", await ecrire(finance.contexte, { "alerts.payoutFailedHours": 50 }, v), 403],
      ["8 mélange en Exploitation", await ecrire(ops.contexte, { "pricing.commissionPct": 13, "alerts.payoutFailedHours": 50, "protection.extendedPremiumCents": 700 }, v), 403, /cannot change: pricing\.commissionPct, protection\.extendedPremiumCents\."/],
      ["9 motif court", await ecrire(sup.contexte, { "alerts.payoutFailedHours": 50 }, v, "trop court"), 400],
      ["10 aucun changement effectif", await ecrire(sup.contexte, { "alerts.payoutFailedHours": 48 }, v), 400, /Nothing to change/],
      ["11 clé inconnue", await ecrire(sup.contexte, { "pricing.inconnue": 1 }, v), 400],
    ];
    const constats: string[] = [];
    for (const [nom, r, attendu, message] of cas) {
      const texte = await corps(r);
      constats.push(`${nom} → ${texte.slice(0, 140)}`);
      expect(r.status(), `${nom} : ${texte}`).toBe(attendu);
      if (message) expect(texte, nom).toMatch(message);
    }
    constat(constats.join(" ‖ "));
    /* Cas 3 : la règle « plafond ≥ prime » est-elle atteignable avec les bornes du catalogue ? */
    const cat = (await lire(sup.contexte)).catalog as unknown as Array<{ key: string; min: number; max: number }>;
    const prime = cat.find((d) => d.key === "protection.extendedPremiumCents")!;
    const plafond = cat.find((d) => d.key === "protection.extendedCapCents")!;
    test.info().annotations.push({ type: "écart documentaire", description: `cas 3 : prime max ${prime.max} c < plafond min ${plafond.min} c — la règle de cohérence ne peut jamais se déclencher, le refus vient des bornes` });
    /* Aucune ligne dans les onze refus. */
    expect(await lireLeJournal(sup.contexte.request, { from: debut, targetType: "SETTINGS" }), "aucune écriture partielle").toEqual([]);
    /* 6. Le super administrateur écrit une clé d'exploitation. */
    const ok = await ecrire(sup.contexte, { "alerts.payoutFailedHours": 50 }, v);
    expect(ok.status(), await corps(ok)).toBe(200);
    expect((await lireLeJournal(sup.contexte.request, { from: debut, targetType: "SETTINGS" })).map((l) => `${l.action} ${l.targetId}`)).toEqual(["SETTING_CHANGED alerts.payoutFailedHours"]);
  });

  test("ADM-PAR-5 · le verrou de version (deux admins en même temps)", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(5 * 60_000);
    const a = await navigateurAdmin("super");
    const b = await navigateurAdmin("exploitation");
    const debut = await debutDuScenario();
    for (const n of [a, b]) {
      await n.page.goto(`${bo()}/settings`, { waitUntil: "domcontentloaded" });
      await attendreLeChargement(n.page);
    }
    /* 2. A saisit sans enregistrer. */
    await a.page.getByLabel("Commission Yamba").fill("13");
    /* 3. B modifie une autre clé et enregistre. */
    await b.page.getByLabel("Relais en retard depuis").fill("20");
    const pb = b.page.locator("section").filter({ has: b.page.getByRole("heading", { name: /^À valider — / }) });
    await pb.getByRole("textbox").fill("Recette ADM-PAR-5 : B enregistre en premier.");
    await pb.getByRole("button", { name: /^Enregistrer/ }).click();
    await expect(b.page.getByText(new RegExp(`^1 paramètre\\(s\\) modifié\\(s\\) — version ${base + 1}`))).toBeVisible({ timeout: 30_000 });
    /* 4. A enregistre à son tour. */
    const pa = a.page.locator("section").filter({ has: a.page.getByRole("heading", { name: /^À valider — / }) });
    await pa.getByRole("textbox").fill("Recette ADM-PAR-5 : A arrive trop tard.");
    const refus = a.page.waitForResponse((r) => r.url().includes("/admin/settings") && r.request().method() === "PATCH");
    await pa.getByRole("button", { name: /^Enregistrer/ }).click();
    expect((await refus).status()).toBe(409);
    await expect(a.page.getByText("Les paramètres ont changé entre-temps : la page est rechargée, refais ta modification.")).toBeVisible({ timeout: 30_000 });
    await expect(a.page.getByRole("heading", { name: /^À valider — / }), "saisies perdues").toHaveCount(0);
    await expect(a.page.getByText(new RegExp(`^Version\\s*${base + 1}$`)), "page rechargée sur la version courante").toBeVisible({ timeout: 30_000 });
    await expect(ligne(a.page, "Relais en retard depuis")).toContainText("20 min");
    const lignes = await lireLeJournal(a.contexte.request, { from: debut, targetType: "SETTINGS" });
    expect(lignes.map((l) => `${l.action} ${l.targetId} ${l.admin}`)).toEqual([expect.stringMatching(/^SETTING_CHANGED alerts\.outboxLagMinutes /)]);
    expect(lignes).toHaveLength(1);
    expect(lignes[0].after).toMatchObject({ value: 20, version: base + 1 });
  });

  test("ADM-PAR-6 · remettre une clé par défaut, puis tout réinitialiser", async ({ navigateurAdmin, jeuEssai, mailpit }) => {
    test.setTimeout(8 * 60_000);
    const sup = await navigateurAdmin("super");
    const ops = await navigateurAdmin("exploitation");
    const destinataire = superAdminsJoignables().find((d) => d.preferredLocale !== "en")!;
    await poser(sup.contexte, { "pricing.commissionPct": 14 });
    const avantModif = await mailpit.compter({ pour: destinataire.email, sujet: /Paramètres de la plateforme modifiés/ });
    const avantReset = await mailpit.compter({ pour: destinataire.email, sujet: /Paramètres de la plateforme réinitialisés/ });
    const debut = await debutDuScenario();
    const { page } = sup;
    await page.goto(`${bo()}/settings`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    /* 1. « remettre » : une modification comme une autre. */
    await ligne(page, "Commission Yamba").getByRole("button", { name: "remettre" }).click();
    const panneau = page.locator("section").filter({ has: page.getByRole("heading", { name: /^À valider — / }) });
    await expect(panneau).toContainText("Commission Yamba : 14 % → 12 %");
    await panneau.getByRole("textbox").fill("Recette ADM-PAR-6 : retour de la commission au défaut.");
    await panneau.getByRole("button", { name: /^Enregistrer/ }).click();
    await expect(page.getByText(new RegExp(`^1 paramètre\\(s\\) modifié\\(s\\) — version ${base + 2}`))).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => mailpit.compter({ pour: destinataire.email, sujet: /Paramètres de la plateforme modifiés/ }), { timeout: 45_000 }).toBe(avantModif + 1);
    /* 2-4. Trois clés, « Tout réinitialiser ». */
    await poser(sup.contexte, { "rating.windowDays": 20, "alerts.outboxLagMinutes": 25, "documents.maxDocsPerTrip": 6 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    await page.getByRole("button", { name: "Tout réinitialiser (3)" }).click();
    const confirmation = page.locator("section").filter({ has: page.getByRole("heading", { name: "Tout remettre par défaut — voici exactement ce qui va changer" }) });
    await expect(confirmation.locator("li")).toHaveText([
      "Fenêtre de notation : 20 j → 14 j (défaut, D53 · RG-NOTE-01)",
      "Relais en retard depuis : 25 min → 15 min (défaut, D59 3A)",
      "Documents par trajet : 6 → 5 (défaut, ex-SiteConfig)",
    ]);
    await confirmation.getByRole("textbox").fill("Recette ADM-PAR-6 : remise à zéro complète.");
    await confirmation.getByRole("button", { name: "Confirmer la réinitialisation" }).click();
    await expect(page.getByText(new RegExp(`^3 paramètre\\(s\\) remis par défaut — version ${base + 4}, journalisé\\.$`))).toBeVisible({ timeout: 30_000 });
    /* 5. Email. */
    await expect.poll(() => mailpit.compter({ pour: destinataire.email, sujet: /Paramètres de la plateforme réinitialisés/ }), { timeout: 45_000 }).toBe(avantReset + 1);
    /* 6. Rejouer : rien à remettre. */
    const encore = await remettre(sup.contexte, { expectedVersion: (await lire(sup.contexte)).version });
    expect(encore.status(), await encore.text()).toBe(400);
    /* 7. Exploitation, clés métier modifiées. */
    await poser(sup.contexte, { "pricing.commissionPct": 13, "alerts.outboxLagMinutes": 30 });
    await ops.page.goto(`${bo()}/settings`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(ops.page);
    await ops.page.getByRole("button", { name: "Tout réinitialiser (1)" }).click();
    const conf2 = ops.page.locator("section").filter({ has: ops.page.getByRole("heading", { name: /^Tout remettre par défaut/ }) });
    await expect(conf2.locator("li")).toHaveText(["Relais en retard depuis : 30 min → 15 min (défaut, D59 3A)"]);
    await conf2.getByRole("textbox").fill("Recette ADM-PAR-6 : Exploitation remet ses seuils.");
    await conf2.getByRole("button", { name: "Confirmer la réinitialisation" }).click();
    await expect(ops.page.getByText(/^1 paramètre\(s\) remis par défaut/)).toBeVisible({ timeout: 30_000 });
    expect((await lire(sup.contexte)).values["pricing.commissionPct"], "la clé métier reste").toBe(13);
    /* Journal. */
    const lignes = await lireLeJournal(sup.contexte.request, { from: debut, targetType: "SETTINGS" });
    expect(lignes.filter((l) => l.action === "SETTINGS_RESET").map((l) => l.targetId)).toEqual(["rating.windowDays", "alerts.outboxLagMinutes", "documents.maxDocsPerTrip", "alerts.outboxLagMinutes"]);
    expect(lignes[0]).toMatchObject({ action: "SETTING_CHANGED", targetId: "pricing.commissionPct" });
  });

  test("ADM-PAR-7 · le repli sûr : une base de paramètres absente", async ({ navigateurAdmin, navigateurConnecte, jeuEssai }) => {
    test.setTimeout(5 * 60_000);
    const sup = await navigateurAdmin("super");
    /* 1. Un comportement courant différent du défaut. */
    await poser(sup.contexte, { "pricing.commissionPct": 16 });
    await expect.poll(async () => (await prixServis(sup.contexte)).commissionPct, { timeout: 45_000, intervals: [1_000] }).toBe(16);
    const debut = await debutDuScenario();
    /* 2. Suppression du document (la panne simulée : le script de recette, lui, ne supprime plus — A175). */
    supprimerLeDocument();
    const t0 = Date.now();
    /* 3. Retour aux défauts, sans erreur. */
    await expect.poll(async () => (await prixServis(sup.contexte)).commissionPct, { timeout: 45_000, intervals: [1_000] }).toBe(12);
    constat(`défauts servis ${Math.round((Date.now() - t0) / 1000)} s après la suppression`);
    const membre = await navigateurConnecte("pauline");
    const deal = await membre.contexte.request.get(`${adresseDeLApi()}/deals/${jeuEssai.deal("bzv-tracking").id}`, { failOnStatusCode: false });
    expect(deal.status(), "écran membre d'un deal").toBe(200);
    const alertes = await sup.contexte.request.get(`${api()}/admin/alerts`);
    expect(alertes.status(), "back-office : alertes").toBe(200);
    /* 4. /settings. */
    await sup.page.goto(`${bo()}/settings`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(sup.page);
    await expect(sup.page.getByText(/^Version\s*0$/)).toBeVisible({ timeout: 60_000 });
    await expect(sup.page.getByText("· toutes les valeurs sont celles par défaut")).toBeVisible();
    expect(await lireLeJournal(sup.contexte.request, { from: debut }), "le script n'écrit rien au journal").toEqual([]);
  });

  test("ADM-PAR-8 · trois écritures simultanées : un gagnant, deux refus propres, document présent ou absent (ajoutée)", async ({ navigateurAdmin }) => {
    test.setTimeout(5 * 60_000);
    const sup = await navigateurAdmin("super");
    const ops = await navigateurAdmin("exploitation");
    const debut = await debutDuScenario();
    // Chaque salve pose des valeurs NEUVES : une valeur déjà en vigueur serait refusée 400 « rien à changer » avant le verrou.
    const salve = async (version: number, cran: number) =>
      (await Promise.all([
        ecrire(sup.contexte, { "alerts.outboxLagMinutes": 20 + cran }, version),
        ecrire(ops.contexte, { "alerts.noTripPublishedDays": 8 + cran }, version),
        ecrire(sup.contexte, { "alerts.retentionHeldDays": 8 + cran }, version),
      ])).map((r) => r.status()).sort();
    /* Document absent : trois créations concurrentes. */
    supprimerLeDocument();
    const absent = await salve(0, 1);
    /* Document présent : trois mises à jour concurrentes. */
    const presente = await salve((await lire(sup.contexte)).version, 2);
    constat(`document absent : ${absent.join(", ")} ; document présent : ${presente.join(", ")}`);
    expect(absent, "document absent — jamais 500").toEqual([200, 409, 409]);
    expect(presente, "document présent — jamais 500").toEqual([200, 409, 409]);
    const lignes = await lireLeJournal(sup.contexte.request, { from: debut, targetType: "SETTINGS" });
    expect(lignes, "une ligne par écriture gagnante").toHaveLength(2);
    expect((await lire(sup.contexte)).version).toBe(2);
  });

  test("ADM-PAR-9 · un litige ouvert garde son échéance quand le délai de réponse change (ajoutée)", async ({ navigateurAdmin, navigateurConnecte, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    new JeuEssai().rejouer();
    const med = await navigateurAdmin("mediateur");
    const sup = await navigateurAdmin("super");
    const deal = jeuEssai.deal("bzv-disputed");
    const dossier = async () => (await (await med.contexte.request.get(`${api()}/admin/disputes/${deal.id}`)).json()) as { decidableAt: string | null; decidable?: boolean };
    const vueVoyageur = async () => ((await (await (await navigateurConnecte("thomas")).contexte.request.get(`${adresseDeLApi()}/deals/${deal.id}`)).json()) as { deal: { dispute: { responseDeadlineAt: string } | null } }).deal.dispute?.responseDeadlineAt;
    const avant = { admin: (await dossier()).decidableAt, voyageur: await vueVoyageur() };
    expect(avant.admin, "échéance à l'ouverture + 72 h").toBeTruthy();
    expect(avant.voyageur, "la vue du Voyageur annonce la même échéance").toBe(avant.admin);
    /* Le super administrateur ramène le délai à 12 h ; les services le lisent en moins de 30 s. */
    await poser(sup.contexte, { "dispute.responseDelayHours": 12 });
    await new Promise((r) => setTimeout(r, 35_000));
    const apres = { admin: (await dossier()).decidableAt, voyageur: await vueVoyageur() };
    constat(`échéance admin ${avant.admin} → ${apres.admin} ; vue Voyageur ${avant.voyageur} → ${apres.voyageur}`);
    expect(apres, "D62 : jamais rétroactif — le Voyageur garde le délai annoncé à l'ouverture").toEqual(avant);
    const tentative = await med.contexte.request.post(`${api()}/admin/disputes/${deal.id}/resolve`, { data: { outcome: "REJECTED", reason: "Recette ADM-PAR-9 : tentative de décision avant la fin du délai de réponse annoncé au Voyageur." }, failOnStatusCode: false });
    expect(tentative.status(), `décision refusée avant l'échéance : ${await tentative.text()}`).toBe(409);
  });

  test("ADM-PAR-10 · l'écran : refus en français, un clic = une écriture, réinitialisation périmée (ajoutée)", async ({ navigateurAdmin }) => {
    test.setTimeout(5 * 60_000);
    const sup = await navigateurAdmin("super");
    const { page } = sup;
    await page.goto(`${bo()}/settings`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    /* Hors bornes saisi à l'écran (le champ number n'empêche pas la saisie). */
    await page.getByLabel("Commission Yamba").fill("50");
    const panneau = page.locator("section").filter({ has: page.getByRole("heading", { name: /^À valider — / }) });
    await panneau.getByRole("textbox").fill("Recette ADM-PAR-10 : saisie hors bornes volontaire.");
    await panneau.getByRole("button", { name: /^Enregistrer/ }).click();
    await expect(page.getByText(/Commission Yamba : entre 5 % et 20 %/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/^\d{3} : /), "jamais « 400 : message anglais »").toHaveCount(0);
    /* Double clic sur « Enregistrer » : une écriture. */
    await page.getByLabel("Commission Yamba").fill("13");
    const patchs: string[] = [];
    page.on("request", (r) => { if (r.method() === "PATCH" && r.url().includes("/admin/settings")) patchs.push(r.url()); });
    await panneau.getByRole("button", { name: /^Enregistrer/ }).dblclick();
    await expect(page.getByText(/^1 paramètre\(s\) modifié\(s\)/)).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(2_000);
    expect(patchs, "une seule écriture envoyée").toHaveLength(1);
    await expect(page.getByText("Les paramètres ont changé entre-temps", { exact: false }), "pas de faux conflit").toHaveCount(0);
    /* Réinitialisation depuis une page périmée. */
    await page.getByRole("button", { name: /^Tout réinitialiser/ }).click();
    await poser(sup.contexte, { "alerts.outboxLagMinutes": 22 }); // un collègue écrit entre-temps
    const conf = page.locator("section").filter({ has: page.getByRole("heading", { name: /^Tout remettre par défaut/ }) });
    await conf.getByRole("textbox").fill("Recette ADM-PAR-10 : réinitialisation sur une page périmée.");
    await conf.getByRole("button", { name: "Confirmer la réinitialisation" }).click();
    await expect(page.getByText("Les paramètres ont changé entre-temps : la page est rechargée, refais ta modification.")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Tout réinitialiser (2)" }), "page rechargée : la clé du collègue apparaît").toBeVisible({ timeout: 30_000 });
  });

  test("ADM-PAR-11 · un document illisible : les défauts, sans erreur (ajoutée)", async ({ navigateurAdmin }) => {
    test.setTimeout(5 * 60_000);
    const sup = await navigateurAdmin("super");
    await poser(sup.contexte, { "pricing.commissionPct": 17 });
    await expect.poll(async () => (await prixServis(sup.contexte)).commissionPct, { timeout: 45_000, intervals: [1_000] }).toBe(17);
    lireCoteServeur<string>(`
      import prisma from "./packages/libs/prisma";
      (async () => { await prisma.platformSettings.update({ where: { key: "current" }, data: { values: "corrompu" as never } }); console.log("@@" + JSON.stringify("ok")); process.exit(0); })();`);
    process.stdout.write("   ↳ manœuvre base : PlatformSettings.values remplacé par une chaîne illisible\n");
    await expect.poll(async () => (await prixServis(sup.contexte)).commissionPct, { timeout: 45_000, intervals: [1_000] }).toBe(12);
    const lu = await sup.contexte.request.get(`${api()}/admin/settings`);
    expect(lu.status()).toBe(200);
    const corps = (await lu.json()) as Reglages;
    expect(corps.values["pricing.commissionPct"]).toBe(12);
    /* On peut réparer par la page : l'écriture repart des défauts. */
    const r = await ecrire(sup.contexte, { "pricing.commissionPct": 12.5 }, corps.version);
    expect(r.status(), await r.text()).toBe(200);
  });

  test("ADM-PAR-12 · un profil sans « settings.read » lit un seul refus, sur la page et sa documentation (ajoutée, décision du 15/09)", async ({ navigateurAdmin }) => {
    test.setTimeout(4 * 60_000);
    const privacy = await navigateurAdmin("privacy");
    expect((await privacy.contexte.request.get(`${api()}/admin/settings`, { failOnStatusCode: false })).status(), "le serveur refuse").toBe(403);
    for (const [chemin, titre] of [["/settings", "Paramètres de la plateforme"], ["/settings/docs", "Documentation des paramètres"]] as const) {
      await privacy.page.goto(`${bo()}${chemin}`, { waitUntil: "domcontentloaded" });
      await expect(privacy.page.locator("main").getByRole("alert"), `${chemin} : un seul bloc de refus`).toHaveText("Ton profil ne lit pas les paramètres.", { timeout: 60_000 });
      await expect(privacy.page.locator("main h1")).toHaveText(titre);
      await expect(privacy.page.locator("main h2"), `${chemin} : aucune section`).toHaveCount(0);
      await expect(privacy.page.locator("main table, main input, main textarea"), `${chemin} : aucun champ`).toHaveCount(0);
      await expect(privacy.page.getByText("Chargement…"), `${chemin} : pas de chargement sans fin`).toHaveCount(0);
      await expect(privacy.page.getByRole("link", { name: /Documentation des paramètres|Retour aux paramètres/ }), `${chemin} : pas de lien vers une page refusée`).toHaveCount(0);
    }
  });

  test("ADM-PAR-13 · les conditions d'annulation acceptées sont celles appliquées (ajoutée, A172)", async ({ navigateurAdmin, navigateurConnecte, jeuEssai }) => {
    test.setTimeout(8 * 60_000);
    new JeuEssai().rejouer();
    const sup = await navigateurAdmin("super");
    await expect.poll(async () => (await lire(sup.contexte)).values["cancellation.fullRefundUntilHours"], { timeout: 30_000 }).toBe(48);
    /* Une vraie réservation, par l'écran : c'est le WRITER qui doit poser le snapshot (un seed qui le poserait ne prouverait rien). */
    const expediteur = await navigateurConnecte("marieclaire");
    await new AssistantReservation(expediteur.page).reserver(
      jeuEssai.trajet("yul"),
      { famille: "Vêtements & textile", taille: "S", poidsKg: "2", valeurEuros: "50", description: "Recette ADM-PAR-13" },
      { prenom: "Étienne", nom: "Roy", indicatif: "+1", telephone: "5145551234" }
    );
    await expect.poll(() => expediteur.page.url(), { timeout: 90_000 }).toMatch(/\/bookings\/[0-9a-f]{24}$/);
    const dealId = expediteur.page.url().split("/bookings/")[1];
    const termes = () => lireCoteServeur<{ cancellationTerms: { fullRefundUntilHours: number; lateRetentionPct: number } | null; departureAt: string }>(`import prisma from "./packages/libs/prisma"; (async () => { const b = await prisma.booking.findUnique({ where: { id: "${dealId}" }, select: { cancellationTerms: true, trip: true } }); console.log("@@" + JSON.stringify({ cancellationTerms: b!.cancellationTerms ?? null, departureAt: (b!.trip as { departureAt: Date }).departureAt })); process.exit(0); })();`);
    const avant = termes();
    expect(avant.cancellationTerms, "figées à la création").toEqual({ fullRefundUntilHours: 48, lateRetentionPct: 50 });
    /* Le barème change après la réservation. */
    await poser(sup.contexte, { "cancellation.fullRefundUntilHours": 12, "cancellation.lateRetentionPct": 30 });
    await new Promise((r) => setTimeout(r, 32_000)); // cache de 30 s du deal-service
    expect(termes().cancellationTerms, "jamais réécrites").toEqual({ fullRefundUntilHours: 48, lateRetentionPct: 50 });
    const vue = await expediteur.contexte.request.get(`${adresseDeLApi()}/deals/${dealId}`);
    const apercu = ((await vue.json()) as { deal: { cancellationPreview: { retentionPct: number; fullRefundUntil: string } | null } }).deal.cancellationPreview;
    constat(`aperçu servi après le changement : ${JSON.stringify(apercu)}`);
    expect(apercu, "l'aperçu annonce les conditions de CETTE réservation").toMatchObject({ retentionPct: 50, fullRefundUntil: new Date(new Date(avant.departureAt).getTime() - 48 * 3_600_000).toISOString() });
  });

  test("ADM-PAR-14 · l'Exploitation : « Tout réinitialiser » dans sa portée, la portée avant les bornes (ajoutée, A173 · A174)", async ({ navigateurAdmin }) => {
    test.setTimeout(4 * 60_000);
    const sup = await navigateurAdmin("super");
    const ops = await navigateurAdmin("exploitation");
    await poser(sup.contexte, { "pricing.commissionPct": 14, "alerts.outboxLagMinutes": 30 });
    /* A173 — reset global par OPS : sa clé seulement, la clé métier nommée et laissée. */
    const r = await remettre(ops.contexte, { expectedVersion: (await lire(ops.contexte)).version });
    expect(r.status(), await r.text()).toBe(200);
    const corps = (await r.json()) as { changed: Array<{ key: string }>; skipped?: string[] };
    expect(corps.changed.map((c) => c.key)).toEqual(["alerts.outboxLagMinutes"]);
    expect(corps.skipped).toEqual(["pricing.commissionPct"]);
    expect((await lire(sup.contexte)).values["pricing.commissionPct"], "la clé métier est intacte").toBe(14);
    /* A174 — hors portée ET hors bornes : 403 sans les bornes. */
    const refus = await ecrire(ops.contexte, { "pricing.commissionPct": 99 }, (await lire(ops.contexte)).version);
    const texte = await refus.text();
    constat(`OPS, clé métier hors bornes → ${refus.status()} ${texte}`);
    expect(refus.status()).toBe(403);
    expect(texte, "aucune borne divulguée").not.toMatch(/between|\b5\b.*\b20\b/);
    await remettre(sup.contexte, { expectedVersion: (await lire(sup.contexte)).version });
  });
});
