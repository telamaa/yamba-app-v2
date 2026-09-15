/**
 * adm-acc-accueil.spec.ts — cahier 02-ADMIN, § 5.1 « Accueil et compteurs » (ADM-ACC-1 à 3)
 * =========================================================================================
 * L'accueil dit « ce qui attend une action, selon ton profil ». Trois preuves par tuile :
 *  - **l'écran = l'API de l'écran** (`GET /admin/kpis`), tuile par tuile ;
 *  - **l'API = le cahier** sur les files que le jeu d'essai pose (§ 2.4) ;
 *  - **l'API = la base**, compté À PART, pour les tuiles que la campagne pollue (comptes créés par les inscriptions
 *    des chapitres web, trajets publiés) : un écart au cahier y est une donnée, pas un défaut.
 * La liste des tuiles attendues par profil se DÉDUIT du contrat des permissions (la garde de chaque compteur est lue
 * dans `admin-kpis.controller.ts`) et se compare au cahier.
 */
import { test, expect } from "../fixtures/yamba";
import { JeuEssai } from "../fixtures/jeu-essai";
import { adresseDeLApiAdmin, adresseDuBackOffice } from "../fixtures/adresses";
import { actionsDuJournal, lireLeJournal } from "../pages/journal-admin";
import { attendreLeChargement, debutDuScenario, lireCoteServeur, MOTIF_DE_RECETTE, tuilesDeLaSection } from "../pages/ecran-admin";
import { adminRolesAllow, type AdminPermission, type AdminRole } from "../../../../packages/libs/api-contracts/src/admin/admin-users.schema";

const api = () => adresseDeLApiAdmin();
const bo = () => adresseDuBackOffice();

/** Les tuiles de `HomeKpis.tsx`, avec leur clé d'API, leur section, leur lien et la permission qui garde le compteur. */
const TUILES: Array<{ cle: string; libelle: string; section: "À traiter" | "État de la plateforme"; lien: string; permission: AdminPermission }> = [
  { cle: "disputesToDecide", libelle: "Litiges à trancher", section: "À traiter", lien: "/disputes", permission: "disputes.read" },
  { cle: "retentionsHeld", libelle: "Retenues à arbitrer", section: "À traiter", lien: "/disputes", permission: "disputes.read" },
  { cle: "ticketsToVerify", libelle: "Billets à vérifier", section: "À traiter", lien: "/tickets", permission: "tickets.review" },
  { cle: "hideProposals", libelle: "Masquages proposés", section: "À traiter", lien: "/trips?hideProposed=1", permission: "trips.read" },
  { cle: "suspensionProposals", libelle: "Sanctions proposées", section: "À traiter", lien: "/users", permission: "users.read" },
  { cle: "payoutsFailed", libelle: "Versements en échec", section: "À traiter", lien: "/finances?kind=FAILED", permission: "finances.read" },
  { cle: "payoutsReversed", libelle: "Transferts renversés", section: "À traiter", lien: "/finances?kind=REVERSED", permission: "finances.read" },
  { cle: "manualRefundProposals", libelle: "Remboursements proposés", section: "À traiter", lien: "/finances?kind=PROPOSED_REFUNDS", permission: "finances.read" },
  { cle: "pendingAdminInvites", libelle: "Invitations admin en attente", section: "À traiter", lien: "/admins", permission: "admins.manage" },
  { cle: "reportsOpen", libelle: "Trajets et membres signalés", section: "À traiter", lien: "/reports", permission: "reports.review" },
  { cle: "messageReportsOpen", libelle: "Messages signalés", section: "À traiter", lien: "/reports#messages", permission: "reports.review" },
  { cle: "activeDeals", libelle: "Deals en cours", section: "État de la plateforme", lien: "/trips", permission: "disputes.read" },
  { cle: "publishedTrips", libelle: "Trajets publiés à venir", section: "État de la plateforme", lien: "/trips?status=PUBLISHED", permission: "trips.read" },
  { cle: "hiddenTrips", libelle: "Trajets masqués", section: "État de la plateforme", lien: "/trips?hidden=1", permission: "trips.read" },
  { cle: "restrictedUsers", libelle: "Comptes restreints", section: "État de la plateforme", lien: "/users", permission: "users.read" },
  { cle: "suspendedUsers", libelle: "Comptes suspendus", section: "État de la plateforme", lien: "/users", permission: "users.read" },
  { cle: "usersTotal", libelle: "Comptes", section: "État de la plateforme", lien: "/users", permission: "users.read" },
  { cle: "completedDeals30d", libelle: "Deals terminés (30 j)", section: "État de la plateforme", lien: "/trips", permission: "disputes.read" },
];

/** Les valeurs du cahier sur un jeu d'essai neuf (§ 5.1, ADM-ACC-1). */
const VALEURS_DU_CAHIER: Record<string, number> = {
  "Litiges à trancher": 2, "Retenues à arbitrer": 1, "Billets à vérifier": 1, "Masquages proposés": 0, "Sanctions proposées": 0,
  "Versements en échec": 1, "Transferts renversés": 1, "Remboursements proposés": 0, "Trajets et membres signalés": 0, "Messages signalés": 1,
  "Trajets publiés à venir": 5, "Trajets masqués": 0,
};
/** Les tuiles que le cahier liste : les autres sont un écart documentaire (tuiles ajoutées depuis). */
const TUILES_DU_CAHIER = [...Object.keys(VALEURS_DU_CAHIER), "Invitations admin en attente", "Comptes"];

const tuilesDuProfil = (profils: AdminRole[]) => TUILES.filter((t) => adminRolesAllow(profils, t.permission)).map((t) => t.libelle).sort();

test.describe("ADM-ACC — accueil et compteurs (cahier 02-ADMIN § 5.1)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(() => {
    new JeuEssai().rejouer();
  });

  test("ADM-ACC-1 · les compteurs correspondent à la réalité", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(5 * 60_000);
    const sup = await navigateurAdmin("super");
    const debut = await debutDuScenario();
    const kpis = (await (await sup.contexte.request.get(`${api()}/admin/kpis`)).json()) as Record<string, number | string | null>;
    await sup.page.goto(`${bo()}/home`, { waitUntil: "domcontentloaded" });
    /* 1. Titre et sous-titre. */
    await expect(sup.page.getByRole("heading", { name: "Accueil", exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(sup.page.getByText("Ce qui attend une action, selon ton profil. Les chiffres de fond se lisent dans Pilotage, l'argent dans Finances.", { exact: true })).toBeVisible();
    await attendreLeChargement(sup.page);
    /* 2-3. Les deux sections. */
    const aTraiter = await tuilesDeLaSection(sup.page, "À traiter");
    const etat = await tuilesDeLaSection(sup.page, "État de la plateforme");
    const ecran = { ...aTraiter, ...etat };
    const ecarts: string[] = [];
    for (const t of TUILES) {
      const vue = (t.section === "À traiter" ? aTraiter : etat)[t.libelle];
      expect(vue, `tuile « ${t.libelle} » dans « ${t.section} »`).toBeTruthy();
      expect(vue.valeur, `« ${t.libelle} » : écran = API`).toBe(kpis[t.cle]);
      expect(vue.lien, `« ${t.libelle} » : lien`).toBe(t.lien);
      if (t.section === "À traiter") expect(vue.ambre, `« ${t.libelle} » : ambre si > 0`).toBe(vue.valeur > 0);
      if (t.libelle in VALEURS_DU_CAHIER && vue.valeur !== VALEURS_DU_CAHIER[t.libelle]) ecarts.push(`${t.libelle} : ${vue.valeur} (cahier ${VALEURS_DU_CAHIER[t.libelle]})`);
    }
    expect(Object.keys(ecran).length, "aucune tuile inconnue du harnais").toBe(TUILES.length);
    /* Les files que le jeu d'essai pose : la valeur du cahier, exactement. */
    const files = ["Litiges à trancher", "Retenues à arbitrer", "Billets à vérifier", "Masquages proposés", "Sanctions proposées", "Versements en échec", "Transferts renversés", "Remboursements proposés", "Messages signalés"];
    for (const libelle of files) expect(ecran[libelle].valeur, `« ${libelle} » = cahier (jeu d'essai neuf)`).toBe(VALEURS_DU_CAHIER[libelle]);
    /* Les tuiles que la campagne pollue : comptées À PART en base. */
    const base = lireCoteServeur<{ comptes: number; trajets: number; admins: number; invitations: number; signales: number }>(`
      import prisma from "./packages/libs/prisma";
      (async () => {
        const now = new Date();
        const comptes = await prisma.user.count({ where: { isDeleted: false } });
        const admins = await prisma.user.count({ where: { isDeleted: false, roles: { has: "ADMIN" } } });
        const trajets = await prisma.trip.count({ where: { status: "PUBLISHED", isDeleted: false, departureAt: { gte: now } } });
        const invitations = await prisma.user.count({ where: { isDeleted: false, roles: { has: "ADMIN" }, OR: [{ passwordHash: null }, { passwordHash: { isSet: false } }] } });
        const signales = await prisma.report.count({ where: { targetType: { in: ["TRIP", "USER"] }, status: "OPEN" } });
        console.log("@@" + JSON.stringify({ comptes, trajets, admins, invitations, signales }));
        process.exit(0);
      })();`);
    expect(ecran["Comptes"].valeur, "« Comptes » = comptes non supprimés en base").toBe(base.comptes);
    expect(ecran["Trajets publiés à venir"].valeur, "« Trajets publiés à venir » = base").toBe(base.trajets);
    expect(ecran["Invitations admin en attente"].valeur, "« Invitations admin en attente » = base").toBe(base.invitations);
    expect(ecran["Trajets et membres signalés"].valeur, "« Trajets et membres signalés » = base").toBe(base.signales);
    const seedMembres = Object.keys((jeuEssai as unknown as { lire(): { users: Record<string, string> } }).lire().users).length;
    test.info().annotations.push({ type: "constat", description: `écarts au cahier (données de la campagne) : ${ecarts.join(" ; ") || "aucun"} — comptes : ${base.comptes} en base, dont ${base.admins} admins ; le jeu d'essai en pose ${seedMembres} + 7 admins` });
    const horsCahier = TUILES.map((t) => t.libelle).filter((l) => !TUILES_DU_CAHIER.includes(l));
    test.info().annotations.push({ type: "écart documentaire", description: `tuiles servies que le cahier ne liste pas : ${horsCahier.join(", ")}` });
    /* 4. Le pied. */
    await expect(sup.page.getByText(/^Calculé le \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}\.$/)).toBeVisible();
    /* Journal : l'accueil n'écrit rien. */
    expect(await actionsDuJournal(sup.contexte.request, { from: debut, adminUserId: jeuEssai.admin("super").id }), "aucune ligne").toEqual([]);
  });

  test("ADM-ACC-2 · les compteurs sont filtrés par profil", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(5 * 60_000);
    const lecteur = await navigateurAdmin("super");
    for (const cle of ["support", "exploitation", "privacy"] as const) {
      const nav = await navigateurAdmin(cle);
      const profils = jeuEssai.admin(cle).profils as AdminRole[];
      const debut = await debutDuScenario();
      const reponse = await nav.contexte.request.get(`${api()}/admin/kpis`, { failOnStatusCode: false });
      await nav.page.goto(`${bo()}/home`, { waitUntil: "domcontentloaded" });
      await expect(nav.page.getByRole("heading", { name: "Accueil", exact: true })).toBeVisible({ timeout: 60_000 });
      if (!adminRolesAllow(profils, "kpi.read")) {
        /* PRIVACY : pas de kpi.read → 403, et le message de l'API en rouge à la place des tuiles (attendu). */
        expect(reponse.status(), `${cle} : GET /admin/kpis → 403`).toBe(403);
        const message = ((await reponse.json()) as { message: string }).message;
        await expect(nav.page.locator("p.text-red-700"), `${cle} : le message d'erreur en rouge`).toHaveText(message, { timeout: 60_000 });
        await expect(nav.page.getByRole("heading", { name: "À traiter", exact: true })).toHaveCount(0);
        test.info().annotations.push({ type: "constat", description: `${cle} : « ${message} » (message anglais de l'API affiché tel quel)` });
      } else {
        expect(reponse.ok(), `${cle} : GET /admin/kpis`).toBe(true);
        await attendreLeChargement(nav.page);
        const vues = { ...(await tuilesDeLaSection(nav.page, "À traiter")), ...(await tuilesDeLaSection(nav.page, "État de la plateforme")) };
        expect(Object.keys(vues).sort(), `${cle} : tuiles = contrat des permissions`).toEqual(tuilesDuProfil(profils));
        const kpis = (await reponse.json()) as Record<string, unknown>;
        for (const t of TUILES) if (!adminRolesAllow(profils, t.permission)) expect(kpis[t.cle], `${cle} : ${t.cle} servi à null (pas seulement caché)`).toBeNull();
      }
      expect(await actionsDuJournal(lecteur.contexte.request, { from: debut, adminUserId: jeuEssai.admin(cle).id }), `${cle} : aucune ligne`).toEqual([]);
    }
    /* Le cahier, précisément : Support sans les trois tuiles d'argent ni les invitations ; Exploitation sans AUCUNE tuile. */
    expect(tuilesDuProfil(["SUPPORT"])).not.toEqual(expect.arrayContaining(["Versements en échec"]));
    for (const absente of ["Versements en échec", "Transferts renversés", "Remboursements proposés", "Invitations admin en attente"]) expect(tuilesDuProfil(["SUPPORT"]), `Support sans « ${absente} »`).not.toContain(absente);
    expect(tuilesDuProfil(["OPS"]), "Exploitation : aucune tuile (le cahier dit « presque toutes absentes »)").toEqual([]);
  });

  test("ADM-ACC-3 · le résumé des alertes et le bandeau des paramètres", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    const ops = await navigateurAdmin("exploitation");
    const lecteur = await navigateurAdmin("super");
    /* Le cahier se contredit : ACC-3 suppose « aucune alerte (jeu d'essai neuf) », mais § 2.4 dit que le versement en
       échec du jeu d'essai « alimente l'alerte PAYOUT_FAILED_48H » — et c'est ce que sert le serveur (terminé à J−3).
       La fiche prouve donc les DEUX états du résumé : l'alerte du jeu d'essai, puis le vert une fois le seuil relevé
       depuis /settings — ce relèvement est le « paramètre modifié » de l'étape 2. */
    const initiales = (await (await ops.contexte.request.get(`${api()}/admin/alerts`)).json()) as { alerts: Array<{ rule: string; severity: string; title: string }> };
    test.info().annotations.push({ type: "constat", description: `jeu d'essai neuf : ${initiales.alerts.map((a) => a.rule).join(", ") || "aucune alerte"}` });
    expect(initiales.alerts.map((a) => a.rule), "§ 2.4 : le versement en échec du jeu d'essai alimente PAYOUT_FAILED_48H").toContain("PAYOUT_FAILED_48H");
    /* 1. Le résumé d'une ligne quand des alertes existent : un lien vers /alerts, jamais le détail des règles (A150). */
    await ops.page.goto(`${bo()}/home`, { waitUntil: "domcontentloaded" });
    const critiques = initiales.alerts.filter((a) => a.severity === "critical");
    const resume = ops.page.getByRole("link", { name: /alertes? de seuil/ });
    await expect(resume).toBeVisible({ timeout: 60_000 });
    await expect(resume).toHaveAttribute("href", "/alerts");
    const n = initiales.alerts.length;
    await expect(resume).toContainText(`${n} alerte${n > 1 ? "s" : ""} de seuil${critiques.length ? ` · ${critiques.length} critique${critiques.length > 1 ? "s" : ""}` : ""}`);
    await expect(resume).toContainText(`la plus grave : ${(critiques[0] ?? initiales.alerts[0]).title}`);
    await expect(resume).toContainText("Voir les alertes →");
    await expect(ops.page.getByText("Aller traiter →"), "l'accueil ne déroule plus les règles").toHaveCount(0);
    /* 2. Relever le seuil depuis /settings, avec un motif. */
    const cle = "alerts.payoutFailedHours";
    const avant = (await (await ops.contexte.request.get(`${api()}/admin/settings`)).json()) as { values: Record<string, number> };
    const valeur = avant.values[cle];
    const debut = await debutDuScenario();
    await ops.page.goto(`${bo()}/settings`, { waitUntil: "domcontentloaded" });
    const champ = ops.page.getByLabel("Versement en échec depuis", { exact: true });
    await expect(champ).toBeVisible({ timeout: 60_000 });
    await champ.fill("336");
    await ops.page.getByPlaceholder("Pourquoi ce changement, pour qui le relira dans six mois.").fill(MOTIF_DE_RECETTE("ADM-ACC-3"));
    const enregistre = ops.page.waitForResponse((r) => r.url().includes("/admin/settings") && r.request().method() === "PATCH");
    await ops.page.getByRole("button", { name: "Enregistrer (journalisé, email aux super administrateurs)" }).click();
    expect((await enregistre).ok(), "PATCH /admin/settings").toBe(true);
    try {
      /* 3. L'accueil : le bandeau de la dernière modification, et — le cache des paramètres vit 30 s — le vert. */
      const vert = ops.page.getByText("Aucune alerte : versements, litiges, relais, emails et liquidité dans les seuils.", { exact: true });
      await expect.poll(async () => {
        await ops.page.goto(`${bo()}/home`, { waitUntil: "domcontentloaded" });
        /* `isVisible` n'attend PAS (son `timeout` est ignoré) : lu juste après `domcontentloaded`, avant que l'accueil
           ait reçu `/admin/alerts`, il répondait toujours faux — mesuré : vert affiché, fiche en échec. */
        return vert.waitFor({ state: "visible", timeout: 10_000 }).then(() => true, () => false);
      }, { timeout: 90_000, intervals: [5_000], message: "le résumé passe au vert une fois le seuil relevé (≤ 30 s de cache)" }).toBe(true);
      const bandeau = ops.page.locator("p").filter({ hasText: /^Paramètres modifiés le / });
      await expect(bandeau).toBeVisible({ timeout: 30_000 });
      await expect(bandeau).toContainText(new RegExp(`^Paramètres modifiés le \\d{2}/\\d{2}/\\d{4} \\d{2}:\\d{2}:\\d{2} par .+ : ${cle.replace(/\./g, "\\.")} — voir les paramètres$`));
      await expect(bandeau.getByRole("link", { name: "voir les paramètres" })).toHaveAttribute("href", "/settings");
      test.info().annotations.push({ type: "constat", description: `bandeau : « ${(await bandeau.innerText()).trim()} »` });
      /* Journal : une ligne SETTING_CHANGED sur SETTINGS · clé. */
      const lignes = (await lireLeJournal(lecteur.contexte.request, { from: debut, adminUserId: jeuEssai.admin("exploitation").id })).filter((l) => l.action === "SETTING_CHANGED");
      expect(lignes.map((l) => `${l.targetType} · ${l.targetId}`), "une ligne par clé").toEqual([`SETTINGS · ${cle}`]);
      expect(lignes[0].after, "after : nouvelle valeur et motif").toMatchObject({ reason: MOTIF_DE_RECETTE("ADM-ACC-3") });
    } finally {
      const v = (await (await ops.contexte.request.get(`${api()}/admin/settings`)).json()) as { version: number };
      await ops.contexte.request.patch(`${api()}/admin/settings`, { data: { changes: { [cle]: valeur }, reason: MOTIF_DE_RECETTE("ADM-ACC-3"), expectedVersion: v.version } });
    }
  });
});
