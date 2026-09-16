/**
 * adm-snc-sanctions.spec.ts — cahier 02-ADMIN, § 5.4 « Sanctions : proposer, appliquer, lever » (ADM-SNC-1 à 5)
 * ============================================================================================================
 * Une sanction agit PAR LECTURE (D56 2A) : `isAuthenticated` refuse un compte suspendu, `requireActiveAccount` refuse la
 * création à un compte restreint, la recherche filtre les trajets d'un suspendu. Chaque fiche prouve donc trois choses :
 * l'ÉCRAN (carte Sanction, bandeaux, badge), le SERVEUR (journal, base, emails), et l'EFFET CÔTÉ MEMBRE (appels réels
 * avec la session du membre).
 *
 * Deux fiches s'ajoutent au cahier, écrites pour des anomalies trouvées en lisant le code avant de jouer :
 *  - ANO-ADM-07 : la date « Jusqu'au » est enregistrée et annoncée au membre par email, mais rien ne la lisait ;
 *  - ANO-ADM-08 : le trajet d'un Voyageur suspendu sortait de la recherche mais restait ouvert par son lien et
 *    réservable.
 *
 * Sécurité du jeu d'essai : un membre suspendu casse les chapitres suivants. `afterAll` lève toute sanction et toute
 * proposition restée sur Pauline et Thomas, quoi qu'il arrive.
 */
import { test, expect, type NavigateurAdmin } from "../fixtures/yamba";
import { JeuEssai } from "../fixtures/jeu-essai";
import { COMPTES, MOT_DE_PASSE_SEED } from "../fixtures/comptes";
import { adresseDeLApi, adresseDeLApiAdmin, adresseDuBackOffice } from "../fixtures/adresses";
import { lireLeJournal, type LigneDuJournal } from "../pages/journal-admin";
import { attendreLeChargement, debutDuScenario, lireCoteServeur, tuilesDeLaSection } from "../pages/ecran-admin";

const apiAdmin = () => adresseDeLApiAdmin();
const api = () => adresseDeLApi();
const bo = () => adresseDuBackOffice();
type Page = NavigateurAdmin["page"];
type Contexte = NavigateurAdmin["contexte"];

const MOTIF_PROPOSITION = "Trois signalements convergents pour comportement inapproprié";
const MOTIF_APPLICATION = "Recette ADM-SNC-2 : restriction de contrôle, levée en fin de chapitre.";
const MOTIF_SUSPENSION = "Recette ADM-SNC-3 : suspension de contrôle, levée par la fiche suivante.";
const MOTIF_LEVEE = "Recette ADM-SNC-4 : levée de la suspension de contrôle.";

type EtatCompte = { accountStatus: string; suspensionReason: string | null; suspensionUntil: string | null; suspendedAt: string | null; suspendedByAdminId: string | null; suspensionProposedAt: string | null; suspensionProposedLevel: string | null };

function etatEnBase(id: string): EtatCompte {
  return lireCoteServeur<EtatCompte>(`
    import prisma from "./packages/libs/prisma";
    (async () => {
      const u = await prisma.user.findUnique({ where: { id: "${id}" }, select: { accountStatus: true, suspensionReason: true, suspensionUntil: true, suspendedAt: true, suspendedByAdminId: true, suspensionProposedAt: true, suspensionProposedLevel: true } });
      console.log("@@" + JSON.stringify(u));
      process.exit(0);
    })();`);
}

/** Filet de sécurité : remet un membre en état ACTIF, sans proposition (manœuvre consignée, jamais un geste de fiche). */
function remettreActif(id: string): void {
  lireCoteServeur(`
    import prisma from "./packages/libs/prisma";
    (async () => {
      await prisma.user.update({ where: { id: "${id}" }, data: { accountStatus: "ACTIVE", suspensionReason: null, suspensionUntil: null, suspendedAt: null, suspendedByAdminId: null, suspensionProposedLevel: null, suspensionProposedReason: null, suspensionProposedByAdminId: null, suspensionProposedAt: null } });
      console.log("@@true");
      process.exit(0);
    })();`);
}

const kpis = async (ctx: Contexte) => (await (await ctx.request.get(`${apiAdmin()}/admin/kpis`)).json()) as Record<string, number | null>;
const carteSanction = (page: Page) => page.locator("section").filter({ has: page.getByRole("heading", { name: "Sanction", exact: true }) });
const resume = (ls: LigneDuJournal[]) => ls.map((l) => `${l.action} ${l.targetType} · ${l.targetId}`);

async function ouvrirFiche(page: Page, id: string): Promise<void> {
  await page.goto(`${bo()}/users/${id}`, { waitUntil: "domcontentloaded" });
  await attendreLeChargement(page);
  await expect(page.getByRole("heading", { name: "Sanction", exact: true })).toBeVisible({ timeout: 60_000 });
}

/** Un appel membre : statut et code d'erreur servi. */
async function appel(ctx: Contexte, methode: "GET" | "POST", chemin: string, data?: unknown): Promise<{ statut: number; code: string | null }> {
  const r = await ctx.request.fetch(`${api()}${chemin}`, { method: methode, data, failOnStatusCode: false });
  const corps = (await r.json().catch(() => ({}))) as { code?: string; details?: { code?: string } };
  return { statut: r.status(), code: corps.details?.code ?? corps.code ?? null };
}

test.describe("ADM-SNC — sanctions (cahier 02-ADMIN § 5.4)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(() => {
    const jeu = new JeuEssai();
    jeu.rejouer();
    for (const cle of ["pauline", "thomas"]) remettreActif(jeu.membre(cle));
  });

  test.afterAll(() => {
    const jeu = new JeuEssai();
    for (const cle of ["pauline", "thomas"]) remettreActif(jeu.membre(cle));
  });

  test("ADM-SNC-1 · proposer une sanction (Support)", async ({ navigateurAdmin, navigateurConnecte, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    const pauline = jeuEssai.membre("pauline");
    const support = await navigateurAdmin("support");
    const sup = await navigateurAdmin("super");
    const lecteur = await navigateurAdmin("finance");
    const avant = await kpis(sup.contexte);
    const debut = await debutDuScenario();
    const { page } = support;
    /* 1. La fiche de Pauline, la carte « Sanction ». */
    await ouvrirFiche(page, pauline);
    const carte = carteSanction(page);
    /* 2. « Restreint (ni publier ni réserver) ». */
    await carte.getByLabel("Restreint (ni publier ni réserver)").check();
    /* A193 (recette § 7) — sans catégorie, « Proposer » reste inactif même avec un motif valide ; la catégorie est ce que lit le membre. */
    await carte.getByLabel("Motif interne (jamais envoyé au membre)").fill(MOTIF_PROPOSITION);
    await expect(carte.getByRole("button", { name: "Proposer", exact: true }), "sans catégorie : inactif").toBeDisabled();
    await carte.getByLabel("Catégorie envoyée au membre").selectOption("SCAM_SUSPECTED");
    /* 3. Motif trop court : « Proposer » inactif. */
    const motif = carte.getByLabel("Motif interne (jamais envoyé au membre)");
    await motif.fill("trop court");
    await expect(carte.getByRole("button", { name: "Proposer", exact: true }), "motif < 20 : inactif").toBeDisabled();
    /* Bornes : 19 caractères inactif, 20 actif, et la saisie coupée à 2000. */
    await motif.fill("x".repeat(19));
    await expect(carte.getByRole("button", { name: "Proposer", exact: true })).toBeDisabled();
    await motif.fill("x".repeat(20));
    await expect(carte.getByRole("button", { name: "Proposer", exact: true })).toBeEnabled();
    await motif.fill("y".repeat(2100));
    expect((await motif.inputValue()).length, "saisie coupée à 2000 caractères").toBe(2000);
    /* 4-5. Le vrai motif ; aucun « Appliquer » pour le Support. */
    await motif.fill(MOTIF_PROPOSITION);
    await expect(carte.getByRole("button", { name: "Appliquer", exact: true }), "le Support n'a pas users.suspension.apply").toHaveCount(0);
    await expect(carte.getByRole("button", { name: "Proposer", exact: true })).toBeEnabled();
    /* 6. « Proposer » → « Fait. ». */
    await carte.getByRole("button", { name: "Proposer", exact: true }).click();
    await expect(carte.getByText("Proposition enregistrée (Restreint) : un Médiateur décide.", { exact: true }), "le message nomme le geste (était « Fait. »)").toBeVisible({ timeout: 30_000 });
    /* 7. Rechargée : le bandeau ambre. */
    await ouvrirFiche(page, pauline);
    const bandeau = page.getByText(/^Proposition de .+ le .+ : Restreint · [^—]+ — /);
    await expect(bandeau).toBeVisible({ timeout: 30_000 });
    await expect(bandeau).toContainText(MOTIF_PROPOSITION);
    test.info().annotations.push({ type: "constat", description: `bandeau : « ${(await bandeau.innerText()).trim()} »` });
    await expect(page.locator("h1 + span + span, h1 ~ span").filter({ hasText: /^Actif$/ }).first(), "le badge reste « Actif »").toBeVisible();
    /* La tuile « Sanctions proposées » : +1 (API et écran). */
    const apres = await kpis(sup.contexte);
    expect(apres.suspensionProposals, "API : sanctions proposées +1").toBe((avant.suspensionProposals ?? 0) + 1);
    await sup.page.goto(`${bo()}/home`, { waitUntil: "domcontentloaded" });
    await expect(sup.page.getByRole("heading", { name: "À traiter", exact: true })).toBeVisible({ timeout: 60_000 });
    await attendreLeChargement(sup.page);
    const tuiles = await tuilesDeLaSection(sup.page, "À traiter");
    expect(tuiles["Sanctions proposées"]?.valeur, "écran : tuile « Sanctions proposées »").toBe(apres.suspensionProposals);
    /* 8. Rien n'a changé pour Pauline : aucune garde de compte actif ne la refuse. */
    const membre = await navigateurConnecte("pauline");
    const reservation = await appel(membre.contexte, "POST", "/deals/payment-intents", {});
    expect(reservation.code, `réserver : pas de ACCOUNT_RESTRICTED (${reservation.statut} ${reservation.code})`).not.toBe("ACCOUNT_RESTRICTED");
    const creation = await appel(membre.contexte, "POST", "/trips", {});
    expect(creation.code, `publier : pas de ACCOUNT_RESTRICTED (${creation.statut} ${creation.code})`).not.toBe("ACCOUNT_RESTRICTED");
    expect(etatEnBase(pauline).accountStatus, "en base : ACTIVE").toBe("ACTIVE");
    /* Journal. */
    const lignes = (await lireLeJournal(lecteur.contexte.request, { from: debut, adminUserId: jeuEssai.admin("support").id })).filter((l) => l.action !== "USER_VIEWED");
    expect(resume(lignes), "une ligne").toEqual([`USER_SUSPENSION_PROPOSED USER · ${pauline}`]);
    expect(lignes[0].before ?? null, "avant : —").toBeNull();
    expect(lignes[0].after, "A193 : la catégorie envoyée au membre est journalisée à côté du motif interne").toEqual({ level: "RESTRICTED", category: "SCAM_SUSPECTED", reason: MOTIF_PROPOSITION });
  });

  test("ADM-SNC-2 · appliquer la restriction (Médiateur)", async ({ navigateurAdmin, navigateurConnecte, jeuEssai, mailpit }) => {
    test.setTimeout(6 * 60_000);
    const pauline = jeuEssai.membre("pauline");
    const med = await navigateurAdmin("mediateur");
    const sup = await navigateurAdmin("super");
    const lecteur = await navigateurAdmin("finance");
    const avant = await kpis(sup.contexte);
    const emailsAvant = await mailpit.compter({ pour: COMPTES.pauline.email, sujet: "Ton compte Yamba est restreint" });
    const debut = await debutDuScenario();
    const { page } = med;
    /* 1. Le bandeau ambre de la proposition du Support. */
    await ouvrirFiche(page, pauline);
    await expect(page.getByText(/^Proposition de .+ : Restreint · [^—]+ — /)).toBeVisible({ timeout: 30_000 });
    const carte = carteSanction(page);
    const motif = carte.getByLabel("Motif interne (jamais envoyé au membre)");
    test.info().annotations.push({ type: "constat", description: `motif pré-rempli par la proposition : « ${await motif.inputValue()} » ; niveau coché : ${(await carte.getByLabel("Restreint (ni publier ni réserver)").isChecked()) ? "Restreint" : "Suspendu"}` });
    /* 2. Motif du Médiateur. */
    await motif.fill(MOTIF_APPLICATION);
    /* 3. Date passée → 400. */
    const date = carte.getByLabel("Jusqu'au (optionnel)");
    await date.fill("2020-01-01");
    const refus = page.waitForResponse((r) => r.url().endsWith(`/admin/users/${pauline}/suspension`) && r.request().method() === "POST");
    await carte.getByRole("button", { name: "Appliquer", exact: true }).click();
    expect((await refus).status(), "date passée : 400").toBe(400);
    await expect(carte.getByText("La date de fin doit être dans le futur.", { exact: true }), "refus lu par son code DATE_IN_PAST").toBeVisible({ timeout: 30_000 });
    await expect(date, "le champ date refuse le passé dès l'écran (min = demain)").toHaveAttribute("min", new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));
    expect(etatEnBase(pauline).accountStatus, "rien n'est écrit").toBe("ACTIVE");
    /* 4. Date future (dans 7 jours) → « Fait. ». */
    const dans7 = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    await date.fill(dans7);
    await carte.getByRole("button", { name: "Appliquer", exact: true }).click();
    const [a, m, j] = dans7.split("-");
    await expect(carte.getByText(`Sanction appliquée : Restreint jusqu'au ${j}/${m}/${a}. Le membre est prévenu par email.`, { exact: true }), "le message nomme le geste et la date").toBeVisible({ timeout: 30_000 });
    /* 5. Rechargée : plus d'ambre, le bandeau rouge, le badge « Restreint ». */
    await ouvrirFiche(page, pauline);
    await expect(page.getByText(/^Proposition de /), "la proposition a disparu").toHaveCount(0);
    // A193 : le bandeau nomme les deux textes — la catégorie qui part au membre, puis le motif INTERNE.
    const rouge = page.getByText(/^Restreint depuis le .+ par .+, jusqu'au .+ — catégorie envoyée au membre : .+ · motif interne : /);
    await expect(rouge).toBeVisible({ timeout: 30_000 });
    await expect(rouge).toContainText(MOTIF_APPLICATION);
    test.info().annotations.push({ type: "constat", description: `bandeau : « ${(await rouge.innerText()).trim()} »` });
    await expect(page.locator("span").filter({ hasText: /^Restreint$/ }).first(), "badge « Restreint »").toBeVisible();
    const base = etatEnBase(pauline);
    expect(base.accountStatus).toBe("RESTRICTED");
    expect(base.suspensionProposedAt, "proposition effacée en base").toBeNull();
    const fin = new Date(base.suspensionUntil as string);
    expect(`${fin.getFullYear()}-${String(fin.getMonth() + 1).padStart(2, "0")}-${String(fin.getDate()).padStart(2, "0")} ${fin.getHours()}:${fin.getMinutes()}:${fin.getSeconds()}`, "« jusqu'au » INCLUS : fin du jour choisi, heure de l'écran").toBe(`${dans7} 23:59:59`);
    /* 6. Côté membre : 403 ACCOUNT_RESTRICTED sur les quatre routes de création ; ses deals continuent. */
    const membre = await navigateurConnecte("pauline");
    const trajet = jeuEssai.trajet("bzv-upcoming");
    for (const [methode, chemin] of [["POST", "/trips"], ["POST", `/trips/${trajet}/publish`], ["POST", "/deals"], ["POST", "/deals/payment-intents"]] as const) {
      const r = await appel(membre.contexte, methode, chemin, {});
      expect(`${r.statut} ${r.code}`, `${methode} ${chemin}`).toBe("403 ACCOUNT_RESTRICTED");
    }
    const deal = await appel(membre.contexte, "GET", `/deals/${jeuEssai.deal("bzv-accepted").id}`);
    expect(deal.statut, "son deal en cours reste lisible").toBe(200);
    expect((await appel(membre.contexte, "GET", "/auth/me")).statut, "la connexion continue").toBe(200);
    /* 7. L'email, dans la langue de Pauline. */
    await expect.poll(() => mailpit.compter({ pour: COMPTES.pauline.email, sujet: "Ton compte Yamba est restreint" }), { timeout: 60_000 }).toBe(emailsAvant + 1);
    const email = await mailpit.attendreEmail({ pour: COMPTES.pauline.email, sujet: "Ton compte Yamba est restreint" });
    expect(email.texte).toContain("jusqu'au");
    expect(email.texte, "l'adresse de contestation").toContain("support@yamba.app");
    test.info().annotations.push({ type: "constat", description: `✉ le motif envoyé au membre est celui que le Médiateur a saisi : ${email.texte.includes(MOTIF_APPLICATION) ? "OUI (texte libre, pas un motif générique)" : "non"}` });
    /* Tuiles. */
    const apres = await kpis(sup.contexte);
    expect(apres.suspensionProposals, "sanctions proposées −1").toBe((avant.suspensionProposals ?? 0) - 1);
    expect(apres.restrictedUsers, "comptes restreints +1").toBe((avant.restrictedUsers ?? 0) + 1);
    /* Journal. */
    const lignes = (await lireLeJournal(lecteur.contexte.request, { from: debut, adminUserId: jeuEssai.admin("mediateur").id })).filter((l) => l.action !== "USER_VIEWED");
    expect(resume(lignes), "une ligne (le refus 400 n'écrit rien)").toEqual([`USER_RESTRICTED USER · ${pauline}`]);
    expect(lignes[0].before).toEqual({ accountStatus: "ACTIVE" });
    expect(lignes[0].after).toMatchObject({ accountStatus: "RESTRICTED", reason: MOTIF_APPLICATION });
    expect((lignes[0].after as { until: string }).until, "la date de fin au journal").toBe(base.suspensionUntil);
    /* Amélioration § 5.4 — une proposition d'ESCALADE (suspendre un compte déjà restreint) compte dans la tuile. */
    const support = await navigateurAdmin("support");
    const escalade = await support.contexte.request.post(`${apiAdmin()}/admin/users/${pauline}/suspension/propose`, { data: { level: "SUSPENDED", category: "OTHER", reason: "Recette ADM-SNC-2 : proposition d'escalade sur un compte restreint." } });
    expect(escalade.ok(), `proposition d'escalade : ${escalade.status()}`).toBe(true);
    expect((await kpis(sup.contexte)).suspensionProposals, "« Sanctions proposées » compte l'escalade (était ignorée : compte non ACTIVE)").toBe((apres.suspensionProposals ?? 0) + 1);
  });

  test("ANO-ADM-07 · une sanction datée cesse à sa date", async ({ navigateurAdmin, navigateurConnecte, jeuEssai }) => {
    test.setTimeout(5 * 60_000);
    const pauline = jeuEssai.membre("pauline");
    const sup = await navigateurAdmin("super");
    const med = await navigateurAdmin("mediateur");
    expect(etatEnBase(pauline).accountStatus, "précondition : la restriction d'ADM-SNC-2").toBe("RESTRICTED");
    const avant = await kpis(sup.contexte);
    /* Manœuvre consignée : la date de fin passe d'une minute dans le passé (sept jours ne s'attendent pas). */
    lireCoteServeur(`
      import prisma from "./packages/libs/prisma";
      (async () => { await prisma.user.update({ where: { id: "${pauline}" }, data: { suspensionUntil: new Date(Date.now() - 60_000) } }); console.log("@@true"); process.exit(0); })();`);
    process.stdout.write("   ↳ manœuvre base : fin de restriction de Pauline posée à maintenant − 1 min (ANO-ADM-07)\n");
    /* Côté membre : la restriction ne s'applique plus. */
    const membre = await navigateurConnecte("pauline");
    const creation = await appel(membre.contexte, "POST", "/trips", {});
    expect(creation.code, `publier après la date de fin : ${creation.statut} ${creation.code}`).not.toBe("ACCOUNT_RESTRICTED");
    const reservation = await appel(membre.contexte, "POST", "/deals/payment-intents", {});
    expect(reservation.code, `réserver après la date de fin : ${reservation.statut} ${reservation.code}`).not.toBe("ACCOUNT_RESTRICTED");
    /* Côté admin : la tuile ne compte plus ce compte, la fiche le dit. */
    const apres = await kpis(sup.contexte);
    expect(apres.restrictedUsers, "« Comptes restreints » ne compte plus une sanction échue").toBe((avant.restrictedUsers ?? 0) - 1);
    await ouvrirFiche(med.page, pauline);
    await expect(med.page.getByText(/sanction échue le .+/), "la fiche signale l'échéance").toBeVisible({ timeout: 30_000 });
    await expect(med.page.locator("span").filter({ hasText: /^Actif \(sanction échue\)$/ }).first(), "le badge dit le statut EFFECTIF").toBeVisible();
    /* Levée administrative (nettoyage, journalisée). */
    const levee = await med.contexte.request.delete(`${apiAdmin()}/admin/users/${pauline}/suspension`, { data: { reason: "Recette ANO-ADM-07 : nettoyage de la restriction échue de contrôle." } });
    expect(levee.status(), `levée : ${await levee.text()}`).toBe(200);
  });

  test("ADM-SNC-3 · suspendre un compte qui a des deals en cours", async ({ navigateurAdmin, navigateurConnecte, navigateurVisiteur, jeuEssai, mailpit }) => {
    test.setTimeout(6 * 60_000);
    const thomas = jeuEssai.membre("thomas");
    const med = await navigateurAdmin("mediateur");
    const lecteur = await navigateurAdmin("finance");
    /* Une session de Thomas ouverte AVANT la suspension. */
    const sessionThomas = await navigateurConnecte("thomas");
    expect((await appel(sessionThomas.contexte, "GET", "/auth/me")).statut, "précondition : Thomas connecté").toBe(200);
    const trajetsThomas = lireCoteServeur<string[]>(`
      import prisma from "./packages/libs/prisma";
      (async () => { const t = await prisma.trip.findMany({ where: { userId: "${thomas}", status: "PUBLISHED", isDeleted: false, departureAt: { gt: new Date() } }, select: { id: true } }); console.log("@@" + JSON.stringify(t.map((x) => x.id))); process.exit(0); })();`);
    const visiteur = await navigateurVisiteur();
    const rechercher = async () => ((await (await visiteur.contexte.request.get(`${api()}/trips/search?limit=50`)).json()) as { trips: Array<{ id: string }> }).trips.map((t) => t.id);
    const visiblesAvant = (await rechercher()).filter((id) => trajetsThomas.includes(id));
    expect(visiblesAvant.length, `précondition : des trajets de Thomas dans la recherche (${trajetsThomas.length} publiés à venir)`).toBeGreaterThan(0);
    const emailsSupportAvant = await mailpit.compter({ pour: "support@yamba.app", sujet: "[Yamba ops] SUSPENDED" });
    const debut = await debutDuScenario();
    const { page } = med;
    /* 1. Deals en cours. */
    await ouvrirFiche(page, thomas);
    const dealsEnCours = Number((await page.locator("div").filter({ has: page.getByText("Deals en cours", { exact: true }) }).last().innerText()).match(/(\d+)\s*$/)?.[1] ?? NaN);
    expect(dealsEnCours, "Deals en cours lu sur la fiche").toBeGreaterThan(0);
    /* 2-3. Suspendu, motif, sans date → « Fait. », badge « Suspendu ». */
    const carte = carteSanction(page);
    await carte.getByLabel("Suspendu (connexion refusée)").check();
    await carte.getByLabel("Catégorie envoyée au membre").selectOption("ABUSIVE_BEHAVIOUR"); // A193
    await carte.getByLabel("Motif interne (jamais envoyé au membre)").fill(MOTIF_SUSPENSION);
    await carte.getByRole("button", { name: "Appliquer", exact: true }).click();
    await expect(carte.getByText("Sanction appliquée : Suspendu, sans date de fin. Le membre est prévenu par email.", { exact: true })).toBeVisible({ timeout: 30_000 });
    await ouvrirFiche(page, thomas);
    await expect(page.locator("span").filter({ hasText: /^Suspendu$/ }).first(), "badge « Suspendu »").toBeVisible({ timeout: 30_000 });
    /* 4. La session ouverte : 401 ACCOUNT_SUSPENDED ; une nouvelle connexion : refusée ; sessions révoquées. */
    const me = await appel(sessionThomas.contexte, "GET", "/auth/me");
    expect(`${me.statut} ${me.code}`, "session déjà ouverte").toBe("401 ACCOUNT_SUSPENDED");
    const login = await visiteur.contexte.request.post(`${api()}/auth/login`, { data: { email: COMPTES.thomas.email, password: MOT_DE_PASSE_SEED }, failOnStatusCode: false });
    const corpsLogin = (await login.json()) as { details?: { code?: string } };
    expect(`${login.status()} ${corpsLogin.details?.code}`, "nouvelle connexion").toBe("401 ACCOUNT_SUSPENDED");
    const sessions = lireCoteServeur<number>(`
      import redis from "./packages/libs/redis";
      (async () => { const k = await redis.keys("refresh_jti:${thomas}:*"); console.log("@@" + k.length); process.exit(0); })();`);
    expect(sessions, "toutes ses sessions membre révoquées").toBe(0);
    /* 5. Recherche : ses trajets sortent, par LECTURE (statut PUBLISHED en base). */
    const visiblesApres = (await rechercher()).filter((id) => trajetsThomas.includes(id));
    expect(visiblesApres, "plus aucun trajet de Thomas dans la recherche").toEqual([]);
    const statuts = lireCoteServeur<string[]>(`
      import prisma from "./packages/libs/prisma";
      (async () => { const t = await prisma.trip.findMany({ where: { id: { in: ${JSON.stringify(trajetsThomas)} } }, select: { status: true } }); console.log("@@" + JSON.stringify(t.map((x) => x.status))); process.exit(0); })();`);
    expect(new Set(statuts), "statuts inchangés en base").toEqual(new Set(["PUBLISHED"]));
    /* 6. Deux emails. */
    await expect.poll(() => mailpit.compter({ pour: COMPTES.thomas.email, sujet: "Ton compte Yamba est suspendu" }), { timeout: 60_000 }).toBeGreaterThan(0);
    await expect.poll(() => mailpit.compter({ pour: "support@yamba.app", sujet: "[Yamba ops] SUSPENDED" }), { timeout: 60_000 }).toBe(emailsSupportAvant + 1);
    const ops = await mailpit.attendreEmail({ pour: "support@yamba.app", sujet: new RegExp(`^\\[Yamba ops\\] SUSPENDED : Thomas Nkounkou a ${dealsEnCours} deal\\(s\\) en cours$`) });
    const lignesDeals = ops.texte.split("\n").filter((l) => l.trim().startsWith("•"));
    expect(lignesDeals.length, "la liste des deals").toBe(dealsEnCours);
    test.info().annotations.push({ type: "constat", description: `✉ ops : « ${ops.sujet} » — ${lignesDeals.map((l) => l.trim()).join(" | ")}` });
    /* Journal. */
    const lignes = (await lireLeJournal(lecteur.contexte.request, { from: debut, adminUserId: jeuEssai.admin("mediateur").id })).filter((l) => l.action !== "USER_VIEWED");
    expect(resume(lignes)).toEqual([`USER_SUSPENDED USER · ${thomas}`]);
    expect(lignes[0].before).toEqual({ accountStatus: "ACTIVE" });
    expect(lignes[0].after).toEqual({ accountStatus: "SUSPENDED", category: "ABUSIVE_BEHAVIOUR", reason: MOTIF_SUSPENSION, until: null }); // A193
  });

  test("ANO-ADM-08 · le trajet d'un Voyageur suspendu n'est ni ouvert ni réservable par son lien", async ({ navigateurVisiteur, navigateurConnecte, jeuEssai }) => {
    test.setTimeout(4 * 60_000);
    const thomas = jeuEssai.membre("thomas");
    expect(etatEnBase(thomas).accountStatus, "précondition : la suspension d'ADM-SNC-3").toBe("SUSPENDED");
    const trajet = jeuEssai.trajet("bzv-upcoming");
    const visiteur = await navigateurVisiteur();
    const page = await visiteur.contexte.request.get(`${api()}/trips/${trajet}/public`, { failOnStatusCode: false });
    expect(page.status(), "la page publique du trajet d'un suspendu : 404 comme la recherche").toBe(404);
    /* Montant attendu volontairement faux : si le trajet passe la garde, le refus est QUOTE_MISMATCH, sinon TRIP_NOT_BOOKABLE. */
    const aminata = await navigateurConnecte("aminata");
    const intention = await appel(aminata.contexte, "POST", "/deals/payment-intents", { tripId: trajet, product: "PARCEL", family: "CLOTHES_TEXTILE", sizeClass: "S", weightKg: 2, protection: "BASIC", declaredValueCents: 6000, expectedTotalCents: 1 });
    test.info().annotations.push({ type: "constat", description: `page publique ${page.status()} ; demande de paiement ${intention.statut} ${intention.code}` });
    expect(intention.code, `réserver le trajet d'un suspendu : ${intention.statut} ${intention.code}`).toBe("TRIP_NOT_BOOKABLE");
  });

  test("ADM-SNC-4 · lever une sanction", async ({ navigateurAdmin, navigateurVisiteur, jeuEssai, mailpit }) => {
    test.setTimeout(6 * 60_000);
    const thomas = jeuEssai.membre("thomas");
    const med = await navigateurAdmin("mediateur");
    const lecteur = await navigateurAdmin("finance");
    expect(etatEnBase(thomas).accountStatus, "précondition : Thomas suspendu").toBe("SUSPENDED");
    const emailsAvant = await mailpit.compter({ pour: COMPTES.thomas.email, sujet: "Ton compte Yamba est rétabli" });
    const debut = await debutDuScenario();
    const { page } = med;
    /* 1. « Lever » sans motif : inactif. */
    await ouvrirFiche(page, thomas);
    const carte = carteSanction(page);
    const motif = carte.getByLabel("Motif interne (jamais envoyé au membre)");
    await motif.fill("");
    await expect(carte.getByRole("button", { name: "Lever", exact: true }), "sans motif : inactif").toBeDisabled();
    /* 2. Motif → « Lever » → « Fait. ». */
    await motif.fill(MOTIF_LEVEE);
    await carte.getByRole("button", { name: "Lever", exact: true }).click();
    await expect(carte.getByText("Sanction levée. Le membre est prévenu par email.", { exact: true })).toBeVisible({ timeout: 30_000 });
    /* 3. Rechargée : « Actif », plus de bandeau rouge, champs effacés en base. */
    await ouvrirFiche(page, thomas);
    await expect(page.locator("span").filter({ hasText: /^Actif$/ }).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/^Suspendu depuis le /), "bandeau rouge disparu").toHaveCount(0);
    const base = etatEnBase(thomas);
    expect(base).toMatchObject({ accountStatus: "ACTIVE", suspensionReason: null, suspensionUntil: null, suspendedAt: null, suspendedByAdminId: null });
    await expect(carteSanction(page).getByRole("button", { name: "Lever", exact: true }), "plus de « Lever » sur un compte actif").toHaveCount(0);
    /* 4. Relever : 400. */
    const encore = await med.contexte.request.delete(`${apiAdmin()}/admin/users/${thomas}/suspension`, { data: { reason: MOTIF_LEVEE }, failOnStatusCode: false });
    expect(encore.status()).toBe(400);
    expect(((await encore.json()) as { message: string }).message).toBe("This account is not restricted.");
    /* 5. Côté membre : connexion et recherche. */
    const visiteur = await navigateurVisiteur();
    const login = await visiteur.contexte.request.post(`${api()}/auth/login`, { data: { email: COMPTES.thomas.email, password: MOT_DE_PASSE_SEED }, failOnStatusCode: false });
    expect(login.status(), "la connexion fonctionne").toBe(200);
    const ids = ((await (await visiteur.contexte.request.get(`${api()}/trips/search?limit=50`)).json()) as { trips: Array<{ id: string }> }).trips.map((t) => t.id);
    expect(ids, "ses trajets réapparaissent").toContain(jeuEssai.trajet("bzv-upcoming"));
    expect((await visiteur.contexte.request.get(`${api()}/trips/${jeuEssai.trajet("bzv-upcoming")}/public`, { failOnStatusCode: false })).status(), "et leur page publique").toBe(200);
    /* ✉ rétabli. */
    await expect.poll(() => mailpit.compter({ pour: COMPTES.thomas.email, sujet: "Ton compte Yamba est rétabli" }), { timeout: 60_000 }).toBe(emailsAvant + 1);
    /* Journal. */
    const lignes = (await lireLeJournal(lecteur.contexte.request, { from: debut, adminUserId: jeuEssai.admin("mediateur").id })).filter((l) => l.action !== "USER_VIEWED");
    expect(resume(lignes), "une ligne (le 400 n'écrit rien)").toEqual([`USER_REINSTATED USER · ${thomas}`]);
    expect(lignes[0].before).toEqual({ accountStatus: "SUSPENDED" });
    expect(lignes[0].after).toEqual({ accountStatus: "ACTIVE", reason: MOTIF_LEVEE });
  });

  test("ADM-SNC-5 · un Support ne peut pas appliquer, même par appel direct", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(4 * 60_000);
    const cible = jeuEssai.membre("pauline");
    const support = await navigateurAdmin("support");
    const lecteur = await navigateurAdmin("finance");
    const avant = etatEnBase(cible);
    const debut = await debutDuScenario();
    /* La console du navigateur, sur l'origine du back-office : même cookie, même proxy. */
    await support.page.goto(`${bo()}/home`, { waitUntil: "domcontentloaded" });
    const statut = await support.page.evaluate(async (id) => {
      const r = await fetch(`/api/admin/users/${id}/suspension`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ level: "RESTRICTED", reason: "Contournement de la garde serveur en recette" }) });
      return r.status;
    }, cible);
    expect(statut, "403").toBe(403);
    expect(etatEnBase(cible), "état inchangé").toEqual(avant);
    const lignes = (await lireLeJournal(lecteur.contexte.request, { from: debut, adminUserId: jeuEssai.admin("support").id })).filter((l) => !["USER_VIEWED", "ADMIN_LOGIN"].includes(l.action));
    expect(resume(lignes), "aucune ligne").toEqual([]);
  });
});
