/**
 * adm-sig-signalements.spec.ts — cahier 02-ADMIN, § 5.19 « Signalements : deux files » (ADM-SIG-1 à 5) + fiches ajoutées
 * ========================================================================================================================
 * Un signalement est une parole de membre contre un autre. Le chapitre se juge à ce que la file garantit :
 *  - **rien d'automatique** : trois signalements éclairent la décision (priorité), ils ne sanctionnent ni ne masquent ;
 *  - **rien de perdu** : un signalement ouvert reste dans une file tant qu'une personne ne l'a pas clos, même si sa cible
 *    a disparu (le défaut ANO-CRON-09 a été corrigé pour les MESSAGES ; la file trajets / membres est éprouvée ici) ;
 *  - **une décision, une fois** : deux clics, deux admins, un appel direct → une seule décision, une seule ligne ;
 *  - **l'auteur protégé** : la cible n'apprend ni qui, ni la suite ; l'auteur ne reçoit rien à la décision.
 * Les signalements membres passent par l'écran (premier) et l'API réelle (suivants). Jeu d'essai rejoué avant chaque fiche
 * (il efface les signalements des comptes du seed).
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
type Item = { id: string; targetType: string; targetId: string; targetLabel: string; status: string; reason: string; details: string | null; reporter: { firstName: string }; openCountOnTarget: number; priority: boolean; targetTrustLevel: string | null };

const signaler = async (ctx: Contexte, cible: { targetType: "TRIP" | "USER"; targetRef: string; reason: string; details?: string }) => {
  const r = await ctx.request.post(`${adresseDeLApi()}/reports`, { data: cible, failOnStatusCode: false });
  return { statut: r.status(), corps: await r.text() };
};
const file = async (ctx: Contexte, status = "OPEN") => {
  const r = await ctx.request.get(`${api()}/admin/reports?status=${status}`);
  expect(r.ok(), `GET /admin/reports → ${r.status()}`).toBe(true);
  return (await r.json()) as { items: Item[]; total: number };
};
const fileMessages = async (ctx: Contexte, status = "OPEN") => (await (await ctx.request.get(`${api()}/admin/conversations/reports?status=${status}`)).json()) as { items: Array<{ id: string; status: string; bookingId: string | null; author: { id: string | null; firstName: string } | null }>; total: number };
const carte = (page: Page, contenu: RegExp | string) => page.locator("main li").filter({ hasText: contenu });
const PRECISIONS = "Recette ADM-SIG : il demande un paiement d'avance hors plateforme.";

test.describe("ADM-SIG — signalements, deux files (cahier 02-ADMIN § 5.19)", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(() => {
    new JeuEssai().rejouer();
  });
  test.afterAll(() => {
    new JeuEssai().rejouer();
  });

  test("ADM-SIG-1 · la file « Trajets et membres »", async ({ navigateurAdmin, navigateurConnecte, jeuEssai, mailpit }) => {
    test.setTimeout(8 * 60_000);
    const thomasId = jeuEssai.membre("thomas");
    const courrielsThomas = await mailpit.compter({ pour: COMPTES.thomas.email, sujet: /signal|report/i });
    const accusesAminata = await mailpit.compter({ pour: COMPTES.aminata.email, sujet: /Ton signalement a bien été reçu/ });
    /* 1. Aminata signale le profil de Thomas depuis le front. */
    const aminata = await navigateurConnecte("aminata");
    await aminata.page.goto("/fr/u/seed-thomas", { waitUntil: "networkidle" });
    await expect(aminata.page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 60_000 });
    await aminata.page.getByRole("button", { name: "Signaler ce profil" }).click();
    const dialogue = aminata.page.getByRole("dialog");
    const libelles = (await dialogue.getByRole("combobox").locator("option").allInnerTexts()).map((o) => o.trim());
    test.info().annotations.push({ type: "écart documentaire", description: `le cahier demande le motif « Tentative d'arnaque » : le front propose ${libelles.join(" / ")} (SCAM = « Arnaque suspectée ») ; le back-office l'affiche « Tentative d'arnaque »` });
    await dialogue.getByRole("combobox").selectOption({ label: "Arnaque suspectée" });
    await dialogue.getByPlaceholder("Ce que tu as vu, quand…").fill(PRECISIONS);
    const envoi = aminata.page.waitForResponse((r) => r.url().endsWith("/reports") && r.request().method() === "POST");
    await dialogue.getByRole("button", { name: "Envoyer le signalement" }).click();
    expect([200, 201]).toContain((await envoi).status());
    /* L'accusé de réception part à la création, à l'auteur seul (cahier SIG-2). */
    await expect.poll(() => mailpit.compter({ pour: COMPTES.aminata.email, sujet: /Ton signalement a bien été reçu/ }), { timeout: 30_000 }).toBe(accusesAminata + 1);
    /* 2. Le même compte, la même cible : 409. */
    const doublon = await signaler(aminata.contexte, { targetType: "USER", targetRef: "seed-thomas", reason: "SCAM" });
    expect(doublon.statut, `doublon : ${doublon.corps}`).toBe(409);
    /* 3. Deux autres comptes. */
    for (const cle of ["joao", "chinwe"] as const) {
      const m = await navigateurConnecte(cle);
      const r = await signaler(m.contexte, { targetType: "USER", targetRef: "seed-thomas", reason: "SCAM", details: `Recette ADM-SIG : signalement de ${cle}.` });
      expect([200, 201], `signalement de ${cle} : ${r.corps}`).toContain(r.statut);
    }
    /* 4. Le back-office. */
    const med = await navigateurAdmin("mediateur");
    const debut = await debutDuScenario();
    const { page } = med;
    await page.goto(`${bo()}/reports`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    await expect(page.getByRole("heading", { level: 1, name: "Signalements" })).toBeVisible({ timeout: 60_000 });
    const titres = await page.locator("main h2").allInnerTexts();
    expect(titres.map((t) => t.trim()).slice(0, 2), "deux sections, dans cet ordre").toEqual(["Trajets et membres", "Messages"]);
    await expect(page.locator("h2#messages")).toHaveText("Messages");
    await expect(page.getByText("Lis la conversation avant de décider (lecture journalisée).")).toBeVisible();
    /* 5. La carte. */
    const donnees = await file(med.contexte);
    const surThomas = donnees.items.filter((i) => i.targetId === thomasId);
    expect(surThomas.map((i) => i.reporter.firstName).sort(), "trois auteurs").toEqual(["Aminata", "Chinwe", "João"].sort());
    const premiere = carte(page, "signalé par Aminata").first();
    await expect(premiere).toContainText("Tentative d'arnaque", { timeout: 60_000 });
    await expect(premiere).toContainText(/signalé par Aminata le .+/);
    await expect(premiere).toContainText("Membre");
    await expect(premiere).toContainText(`Précisions : ${PRECISIONS}`);
    await expect(premiere.getByPlaceholder("Note pour le journal (facultatif)")).toBeVisible();
    await expect(premiere.getByRole("button", { name: "Traité", exact: true })).toBeVisible();
    await expect(premiere.getByRole("button", { name: "Sans suite", exact: true })).toBeVisible();
    await expect(premiere, "badge après le troisième ouvert").toContainText("Prioritaire · 3 ouverts");
    const onglets = page.locator("main button").filter({ hasText: /^(à traiter|traité|sans suite)$/ });
    expect((await onglets.allInnerTexts()).slice(0, 3)).toEqual(["à traiter", "traité", "sans suite"]);
    await expect(page.getByText(new RegExp(`^${donnees.total} signalement`)).first()).toBeVisible();
    /* Badge de niveau : jamais « Standard » ni « Compte neuf ». */
    const niveau = surThomas[0].targetTrustLevel;
    test.info().annotations.push({ type: "constat", description: `niveau de risque de Thomas servi : ${niveau}` });
    if (niveau === "NEW" || niveau === "STANDARD" || niveau === null) await expect(premiere).not.toContainText(/Compte neuf|Standard/);
    /* 6. La cible. */
    await premiere.getByRole("link", { name: /Thomas Nkounkou →/ }).click();
    await expect(page).toHaveURL(new RegExp(`/users/${thomasId}$`), { timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1 }).first()).toContainText("Thomas", { timeout: 60_000 });
    /* Journal : USER_VIEWED à l'ouverture de la fiche ; la file n'écrit rien. */
    const sup = await navigateurAdmin("super");
    await expect.poll(async () => (await lireLeJournal(sup.contexte.request, { from: debut, adminUserId: jeuEssai.admin("mediateur").id })).map((l) => `${l.action} ${l.targetId}`), { timeout: 30_000 }).toEqual([`USER_VIEWED ${thomasId}`]);
    /* L'auteur protégé : aucun email, aucun prénom d'auteur côté Thomas. */
    expect(await mailpit.compter({ pour: COMPTES.thomas.email, sujet: /signal|report/i }), "aucun email à la cible").toBe(courrielsThomas);
    const thomas = await navigateurConnecte("thomas");
    const moi = await (await thomas.contexte.request.get(`${adresseDeLApi()}/auth/me`)).text();
    expect(moi, "rien des auteurs dans le compte de la cible").not.toMatch(/Aminata|Chinwe|João|report/i);
  });

  test("ADM-SIG-2 · traiter un signalement de trajet ou de membre", async ({ navigateurAdmin, navigateurConnecte, jeuEssai, mailpit }) => {
    test.setTimeout(6 * 60_000);
    const aminata = await navigateurConnecte("aminata");
    const joao = await navigateurConnecte("joao");
    expect([200, 201]).toContain((await signaler(aminata.contexte, { targetType: "USER", targetRef: "seed-thomas", reason: "SCAM", details: PRECISIONS })).statut);
    expect([200, 201]).toContain((await signaler(joao.contexte, { targetType: "TRIP", targetRef: jeuEssai.trajet("yul"), reason: "ILLEGAL_CONTENT", details: "Recette ADM-SIG-2 : annonce douteuse." })).statut);
    const sup = await navigateurAdmin("super");
    const med = await navigateurAdmin("mediateur");
    const items = (await file(med.contexte)).items;
    const membre = items.find((i) => i.targetType === "USER")!;
    const trajet = items.find((i) => i.targetType === "TRIP")!;
    const courriels = { aminata: await mailpit.compter({ pour: COMPTES.aminata.email }), joao: await mailpit.compter({ pour: COMPTES.joao.email }) };
    const debut = await debutDuScenario();
    const { page } = med;
    await page.goto(`${bo()}/reports`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    /* 1-2. Note, « Traité ». */
    const note = `Compte restreint le ${new Date().toLocaleDateString("fr-FR")} après vérification`;
    const cm = carte(page, "signalé par Aminata").first();
    await cm.getByPlaceholder("Note pour le journal (facultatif)").fill(note);
    await cm.getByRole("button", { name: "Traité", exact: true }).click();
    await expect(page.getByText("Signalement traité (journalisé).")).toBeVisible({ timeout: 30_000 });
    await expect(carte(page, "signalé par Aminata"), "la carte sort de « à traiter »").toHaveCount(0);
    /* 3. Onglet « traité ». */
    await page.locator("main button").filter({ hasText: /^traité$/ }).first().click();
    await expect(carte(page, "signalé par Aminata").first()).toBeVisible({ timeout: 30_000 });
    /* 4. Recliquer par appel direct : 409. */
    const encore = await med.contexte.request.patch(`${api()}/admin/reports/${membre.id}`, { data: { decision: "REVIEWED" }, failOnStatusCode: false });
    expect(encore.status()).toBe(409);
    expect(((await encore.json()) as { message: string }).message).toBe("This report has already been reviewed.");
    /* 5. « Sans suite » sans note. */
    await page.locator("main button").filter({ hasText: /^à traiter$/ }).first().click();
    const ct = carte(page, "signalé par João").first();
    await ct.getByRole("button", { name: "Sans suite", exact: true }).click();
    await expect(page.getByText("Signalement classé sans suite (journalisé).")).toBeVisible({ timeout: 30_000 });
    /* Journal. */
    const lignes = (await lireLeJournal(sup.contexte.request, { from: debut, adminUserId: jeuEssai.admin("mediateur").id })).filter((l) => l.action === "REPORT_REVIEWED");
    expect(lignes.map((l) => [l.targetType, l.targetId]).sort()).toEqual([["REPORT", membre.id], ["REPORT", trajet.id]].sort());
    const lm = lignes.find((l) => l.targetId === membre.id)!;
    const lt = lignes.find((l) => l.targetId === trajet.id)!;
    expect(lm.before).toMatchObject({ status: "OPEN" });
    expect(lm.after).toEqual({ status: "REVIEWED", note });
    expect(lt.after).toEqual({ status: "DISMISSED", note: null });
    /* Aucun email à la décision. */
    await new Promise((r) => setTimeout(r, 4_000));
    expect({ aminata: await mailpit.compter({ pour: COMPTES.aminata.email }), joao: await mailpit.compter({ pour: COMPTES.joao.email }) }, "aucun email à la décision").toEqual(courriels);
  });

  test("ADM-SIG-3 · la file « Messages » et sa décision", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    const med = await navigateurAdmin("mediateur");
    const sup = await navigateurAdmin("super");
    const { page } = med;
    const messages = await fileMessages(med.contexte);
    const signale = messages.items[0];
    expect(signale, "le signalement de message du jeu d'essai").toBeTruthy();
    await page.goto(`${bo()}/reports#messages`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    /* 2. La carte. */
    const c = carte(page, "Veut sortir de Yamba").first();
    await expect(c).toContainText(/signalé par Pauline \(Expéditeur\) le .+/, { timeout: 60_000 });
    await expect(c).toContainText("Paris → Brazzaville");
    await expect(c.locator("blockquote")).toContainText(/Thomas \(Voyageur\) · .+/);
    await expect(c.locator("blockquote")).toContainText("hors appli");
    await expect(c).toContainText("Précisions : Il propose de regler hors de Yamba.");
    /* 3-4. Les deux liens. */
    await c.getByRole("link", { name: "Lire la conversation →" }).click();
    await expect(page).toHaveURL(new RegExp(`/conversations/${jeuEssai.deal("bzv-accepted").id}$`), { timeout: 30_000 });
    await page.goBack();
    await attendreLeChargement(page);
    await carte(page, "Veut sortir de Yamba").first().getByRole("link", { name: "Fiche de Thomas →" }).click();
    await expect(page).toHaveURL(new RegExp(`/users/${jeuEssai.membre("thomas")}$`), { timeout: 30_000 });
    /* 5. Décision. */
    const debut = await debutDuScenario();
    await page.goto(`${bo()}/reports#messages`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    const c2 = carte(page, "Veut sortir de Yamba").first();
    await c2.getByPlaceholder("Note pour le journal (facultatif)").fill("Rappel des règles envoyé au Voyageur.");
    await c2.getByRole("button", { name: "Traité", exact: true }).click();
    await expect(page.getByText("Signalement traité (journalisé).")).toBeVisible({ timeout: 30_000 });
    /* 6. 409. 7. La route des trajets et membres ne connaît pas un signalement de message : 404. */
    expect((await med.contexte.request.patch(`${api()}/admin/conversations/reports/${signale.id}`, { data: { decision: "REVIEWED" }, failOnStatusCode: false })).status()).toBe(409);
    const croise = await med.contexte.request.patch(`${api()}/admin/reports/${signale.id}`, { data: { decision: "REVIEWED" }, failOnStatusCode: false });
    expect(croise.status(), "deux files, deux services").toBe(404);
    /* Journal. */
    const lignes = (await lireLeJournal(sup.contexte.request, { from: debut, adminUserId: jeuEssai.admin("mediateur").id })).filter((l) => l.action === "MESSAGE_REPORT_REVIEWED");
    expect(lignes).toHaveLength(1);
    expect(lignes[0].targetType).toBe("REPORT");
    expect(lignes[0].targetId).toBe(signale.id);
    expect(lignes[0].before).toEqual({ status: "OPEN" });
    expect(lignes[0].after).toEqual({ status: "REVIEWED", note: "Rappel des règles envoyé au Voyageur." });
  });

  test("ADM-SIG-4 · un signalement ne sanctionne rien tout seul", async ({ navigateurAdmin, navigateurConnecte, jeuEssai, mailpit }) => {
    test.setTimeout(6 * 60_000);
    const thomasId = jeuEssai.membre("thomas");
    const sup = await navigateurAdmin("super");
    const debut = await debutDuScenario();
    const avantCourriels = await mailpit.compter({ pour: COMPTES.thomas.email });
    const trajetsAvant = lireCoteServeur<number>(`
      import prisma from "./packages/libs/prisma";
      (async () => { console.log("@@" + (await prisma.trip.count({ where: { userId: "${thomasId}", isDeleted: false, OR: [{ hiddenByAdminAt: null }, { hiddenByAdminAt: { isSet: false } }] } }))); process.exit(0); })();`);
    for (const cle of ["aminata", "joao", "chinwe"] as const) {
      const m = await navigateurConnecte(cle);
      expect([200, 201]).toContain((await signaler(m.contexte, { targetType: "USER", targetRef: "seed-thomas", reason: "SCAM" })).statut);
    }
    await new Promise((r) => setTimeout(r, 6_000));
    const fiche = (await (await sup.contexte.request.get(`${api()}/admin/users/${thomasId}`)).json()) as { accountStatus?: string; user?: { accountStatus: string } };
    const statut = fiche.accountStatus ?? fiche.user?.accountStatus;
    const trajetsApres = lireCoteServeur<number>(`
      import prisma from "./packages/libs/prisma";
      (async () => { console.log("@@" + (await prisma.trip.count({ where: { userId: "${thomasId}", isDeleted: false, OR: [{ hiddenByAdminAt: null }, { hiddenByAdminAt: { isSet: false } }] } }))); process.exit(0); })();`);
    test.info().annotations.push({ type: "constat", description: `après trois signalements : compte ${statut}, trajets visibles ${trajetsAvant} → ${trajetsApres}` });
    expect(statut).toBe("ACTIVE");
    expect(trajetsApres, "ses trajets restent visibles").toBe(trajetsAvant);
    const recherche = (await (await (await navigateurConnecte("pauline")).contexte.request.get(`${adresseDeLApi()}/trips/search?from=Paris&to=Brazzaville&limit=50`)).json()) as { trips?: Array<{ id: string }>; items?: Array<{ id: string }> };
    expect((recherche.trips ?? recherche.items ?? []).some((t) => t.id === jeuEssai.trajet("bzv-upcoming")), "son trajet est toujours dans la recherche").toBe(true);
    expect(await mailpit.compter({ pour: COMPTES.thomas.email }), "aucun email").toBe(avantCourriels);
    const journal = (await lireLeJournal(sup.contexte.request, { from: debut })).map((l) => l.action);
    expect(journal.filter((a) => /SUSPEND|RESTRICT|HIDDEN|HIDE/.test(a)), "aucune sanction ni masquage").toEqual([]);
  });

  test("ADM-SIG-5 · le Support et le Médiateur seuls décident", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    const sup = await navigateurAdmin("super");
    const debut = await debutDuScenario();
    for (const cle of ["finance", "exploitation", "privacy"] as const) {
      const a = await navigateurAdmin(cle);
      await a.page.goto(`${bo()}/home`, { waitUntil: "domcontentloaded" });
      await attendreLeChargement(a.page);
      await expect(a.page.getByRole("link", { name: "Signalements", exact: true }), `${cle} : pas d'entrée de menu`).toHaveCount(0);
      expect((await a.contexte.request.get(`${api()}/admin/reports`, { failOnStatusCode: false })).status(), `${cle} : file trajets et membres`).toBe(403);
      expect((await a.contexte.request.get(`${api()}/admin/conversations/reports`, { failOnStatusCode: false })).status(), `${cle} : file messages`).toBe(403);
      await a.page.goto(`${bo()}/reports`, { waitUntil: "domcontentloaded" });
      await attendreLeChargement(a.page);
      await expect(a.page.getByText("Ton profil ne traite pas les signalements.").first(), `${cle} : refus en français à l'ouverture directe`).toBeVisible({ timeout: 60_000 });
      await expect(a.page.getByText(/^\d{3} : /), "jamais « 403 : message anglais »").toHaveCount(0);
    }
    for (const cle of ["mediateur", "support"] as const) {
      const a = await navigateurAdmin(cle);
      expect((await a.contexte.request.get(`${api()}/admin/reports`)).status(), `${cle} lit la file`).toBe(200);
    }
    for (const cle of ["finance", "exploitation", "privacy"] as const) {
      // Une session mémorisée expirée se rouvre pendant la fiche : sa connexion n'est pas un geste sur les signalements.
      const lignes = (await lireLeJournal(sup.contexte.request, { from: debut, adminUserId: jeuEssai.admin(cle).id })).filter((l) => !["ADMIN_LOGIN", "ADMIN_LOGOUT"].includes(l.action));
      expect(lignes, `${cle} : aucune ligne`).toEqual([]);
    }
  });

  test("ADM-SIG-6 · un signalement dont la cible a disparu reste dans la file (ajoutée)", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(5 * 60_000);
    const med = await navigateurAdmin("mediateur");
    const aminata = jeuEssai.membre("aminata");
    const fantome = "6aa0000000000000000f0f0f";
    const id = lireCoteServeur<string>(`
      import prisma from "./packages/libs/prisma";
      (async () => { const r = await prisma.report.create({ data: { reporterUserId: "${aminata}", targetType: "TRIP", targetId: "${fantome}", reason: "SCAM", details: "Recette ADM-SIG-6 : trajet purgé depuis.", status: "OPEN" } }); console.log("@@" + JSON.stringify(r.id)); process.exit(0); })();`);
    process.stdout.write(`   ↳ manœuvre base : signalement OPEN ${id} sur un trajet inexistant ${fantome} (trajet purgé après le signalement)\n`);
    const donnees = await file(med.contexte);
    const trouve = donnees.items.find((i) => i.id === id);
    test.info().annotations.push({ type: "constat", description: `file « à traiter » : ${donnees.total} signalement(s) ; celui du trajet disparu ${trouve ? `présent (« ${trouve.targetLabel} »)` : "ABSENT"}` });
    expect(trouve, "un signalement ouvert ne disparaît jamais de la file").toBeTruthy();
    await med.page.goto(`${bo()}/reports`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(med.page);
    const c = carte(med.page, "Recette ADM-SIG-6").first();
    await expect(c).toContainText(/Trajet introuvable/, { timeout: 60_000 });
    await c.getByRole("button", { name: "Sans suite", exact: true }).click();
    await expect(med.page.getByText("Signalement classé sans suite (journalisé).")).toBeVisible({ timeout: 30_000 });
    expect((await file(med.contexte)).items.some((i) => i.id === id), "clos, il sort de la file").toBe(false);
  });

  test("ADM-SIG-7 · une décision, une fois : double clic et deux admins (ajoutée)", async ({ navigateurAdmin, navigateurConnecte, jeuEssai }) => {
    test.setTimeout(5 * 60_000);
    const aminata = await navigateurConnecte("aminata");
    const joao = await navigateurConnecte("joao");
    expect([200, 201]).toContain((await signaler(aminata.contexte, { targetType: "USER", targetRef: "seed-thomas", reason: "SCAM" })).statut);
    expect([200, 201]).toContain((await signaler(joao.contexte, { targetType: "USER", targetRef: "seed-thomas", reason: "INAPPROPRIATE" })).statut);
    const med = await navigateurAdmin("mediateur");
    const support = await navigateurAdmin("support");
    const sup = await navigateurAdmin("super");
    const debut = await debutDuScenario();
    /* Double clic natif sur « Traité ». */
    await med.page.goto(`${bo()}/reports`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(med.page);
    const requetes: string[] = [];
    med.page.on("request", (r) => { if (r.method() === "PATCH" && r.url().includes("/admin/reports/")) requetes.push(r.url()); });
    await carte(med.page, "signalé par Aminata").first().getByRole("button", { name: "Traité", exact: true }).dblclick();
    await expect(med.page.getByText("Signalement traité (journalisé).")).toBeVisible({ timeout: 30_000 });
    await med.page.waitForTimeout(2_000);
    expect(requetes, "une seule décision envoyée").toHaveLength(1);
    await expect(med.page.getByText(/^409 : /), "jamais « 409 : message anglais »").toHaveCount(0);
    /* Deux admins sur le même signalement : l'écran périmé dit la vérité en français. */
    const cible = (await file(med.contexte)).items.find((i) => i.reporter.firstName === "João")!;
    await support.page.goto(`${bo()}/reports`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(support.page);
    await expect(carte(support.page, "signalé par João").first()).toBeVisible({ timeout: 60_000 });
    expect((await med.contexte.request.patch(`${api()}/admin/reports/${cible.id}`, { data: { decision: "DISMISSED" } })).ok()).toBe(true);
    await carte(support.page, "signalé par João").first().getByRole("button", { name: "Traité", exact: true }).click();
    await expect(support.page.getByText(/Ce signalement vient d'être traité par un autre administrateur/)).toBeVisible({ timeout: 30_000 });
    await expect(carte(support.page, "signalé par João"), "la file est rechargée").toHaveCount(0, { timeout: 30_000 });
    const lignes = (await lireLeJournal(sup.contexte.request, { from: debut })).filter((l) => l.action === "REPORT_REVIEWED");
    expect(lignes, "deux signalements, deux décisions, deux lignes").toHaveLength(2);
  });

  test("ADM-SIG-8 · trois décisions simultanées par l'API, dans chacune des deux files (ajoutée)", async ({ navigateurAdmin, navigateurConnecte, jeuEssai }) => {
    test.setTimeout(5 * 60_000);
    const aminata = await navigateurConnecte("aminata");
    expect([200, 201]).toContain((await signaler(aminata.contexte, { targetType: "USER", targetRef: "seed-thomas", reason: "SCAM" })).statut);
    const med = await navigateurAdmin("mediateur");
    const support = await navigateurAdmin("support");
    const sup = await navigateurAdmin("super");
    const membre = (await file(med.contexte)).items.find((i) => i.reporter.firstName === "Aminata")!;
    const message = (await fileMessages(med.contexte)).items[0];
    expect(message, "le signalement de message du jeu d'essai").toBeTruthy();
    const debut = await debutDuScenario();
    const salve = async (url: string) =>
      (await Promise.all([med, support, med].map((a) => a.contexte.request.patch(url, { data: { decision: "REVIEWED" }, failOnStatusCode: false })))).map((r) => r.status()).sort();
    const trajetsMembres = await salve(`${api()}/admin/reports/${membre.id}`);
    const messages = await salve(`${api()}/admin/conversations/reports/${message.id}`);
    test.info().annotations.push({ type: "constat", description: `trajets et membres : ${trajetsMembres.join(", ")} ; messages : ${messages.join(", ")}` });
    expect(trajetsMembres, "une décision, deux refus propres — jamais 500").toEqual([200, 409, 409]);
    expect(messages, "une décision, deux refus propres — jamais 500").toEqual([200, 409, 409]);
    const journal = await lireLeJournal(sup.contexte.request, { from: debut });
    expect(journal.filter((l) => l.action === "REPORT_REVIEWED" && l.targetId === membre.id)).toHaveLength(1);
    expect(journal.filter((l) => l.action === "MESSAGE_REPORT_REVIEWED" && l.targetId === message.id)).toHaveLength(1);
  });

  test("ADM-SIG-9 · « Compte neuf » n'est jamais affiché comme niveau de risque (ajoutée)", async ({ navigateurAdmin, navigateurConnecte, jeuEssai }) => {
    test.setTimeout(5 * 60_000);
    const marcId = jeuEssai.membre("marc");
    const ancienne = lireCoteServeur<string>(`
      import prisma from "./packages/libs/prisma";
      (async () => { const u = await prisma.user.findUnique({ where: { id: "${marcId}" }, select: { createdAt: true } }); await prisma.user.update({ where: { id: "${marcId}" }, data: { createdAt: new Date() } }); console.log("@@" + JSON.stringify(u!.createdAt.toISOString())); process.exit(0); })();`);
    process.stdout.write(`   ↳ manœuvre base : compte de Marc daté d'aujourd'hui (ancienne date ${ancienne}, restaurée en fin de fiche)\n`);
    try {
      const aminata = await navigateurConnecte("aminata");
      expect([200, 201]).toContain((await signaler(aminata.contexte, { targetType: "USER", targetRef: "seed-marc", reason: "IMPERSONATION", details: "Recette ADM-SIG-9 : compte neuf." })).statut);
      const med = await navigateurAdmin("mediateur");
      const item = (await file(med.contexte)).items.find((i) => i.targetId === marcId)!;
      test.info().annotations.push({ type: "constat", description: `niveau servi pour Marc : ${item.targetTrustLevel}` });
      expect(item.targetTrustLevel, "précondition : Marc est un compte neuf").toBe("NEW");
      await med.page.goto(`${bo()}/reports`, { waitUntil: "domcontentloaded" });
      await attendreLeChargement(med.page);
      const c = carte(med.page, "Recette ADM-SIG-9").first();
      await expect(c).toContainText("Membre", { timeout: 60_000 });
      await expect(c, "le cahier : « Standard » et « Compte neuf » ne sont pas affichés").not.toContainText(/Compte neuf|Standard/);
    } finally {
      lireCoteServeur<string>(`
        import prisma from "./packages/libs/prisma";
        (async () => { await prisma.user.update({ where: { id: "${marcId}" }, data: { createdAt: new Date(${JSON.stringify(ancienne)}) } }); console.log("@@" + JSON.stringify("ok")); process.exit(0); })();`);
    }
  });
});
