/**
 * adm-prm-profils.spec.ts — cahier 02-ADMIN, § 4.3 « La matrice des permissions, profil par profil » (ADM-PRM-1 à 8)
 * =================================================================================================================
 * Pour chaque profil, trois choses (cahier) : **le menu**, **ce qu'il peut faire** (au moins un geste réussi), **un
 * refus** (un 403 du SERVEUR — un bouton caché ne prouve rien). ADM-PRM-9 éprouve déjà toutes les routes avec tous
 * les comptes (`adm-prm-garde-serveur.spec.ts`) ; ici, on éprouve ce que VOIT et FAIT chaque profil.
 *
 * Trois partis pris :
 *  - **le menu attendu se déduit du contrat** (`ADMIN_PERMISSIONS`) ET se compare à la liste écrite dans le cahier :
 *    un écart contrat/écran est fonctionnel, un écart contrat/cahier est documentaire ;
 *  - **le miroir du front est comparé au contrat** : `apps/admin-ui/src/lib/permissions.ts` est une COPIE manuelle de la
 *    matrice ; une divergence silencieuse cacherait un bouton autorisé ou montrerait un bouton refusé ;
 *  - **les gestes d'écriture passent par l'API de l'écran** quand leur formulaire relève d'un chapitre du § 5 (billet,
 *    paramètres, remboursement) : ce chapitre prouve le DROIT, le § 5 prouvera le formulaire. Chaque geste est défait ou
 *    sans conséquence sur le jeu d'essai (paramètre remis à sa valeur, proposition sans application).
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { test, expect, type NavigateurAdmin } from "../fixtures/yamba";
import { JeuEssai } from "../fixtures/jeu-essai";
import { adresseDuBackOffice, adresseDeLApiAdmin } from "../fixtures/adresses";
import { lireLeJournal, type LigneDuJournal } from "../pages/journal-admin";
import { ADMIN_PERMISSIONS, adminRolesAllow, type AdminPermission, type AdminRole } from "../../../../packages/libs/api-contracts/src/admin/admin-users.schema";

type Page = NavigateurAdmin["page"];
const RACINE = join(__dirname, "../../../..");
const api = () => adresseDeLApiAdmin();
const bo = () => adresseDuBackOffice();
const MOTIF = "Recette du cahier 02-ADMIN, chapitre 4.3 — geste de vérification des permissions, sans effet métier.";

/** Le menu du shell, dans l'ordre du code (AdminShell.tsx), avec la permission qui le gouverne. */
const MENU: Array<[string, AdminPermission | null]> = [
  ["Accueil", null], ["Alertes", "kpi.read"], ["À arbitrer", "disputes.read"], ["Billets", "tickets.review"], ["Trajets", "trips.read"],
  ["Signalements", "reports.review"], ["Finances", "finances.read"], ["Pilotage", "pilotage.read"], ["Utilisateurs", "users.read"],
  ["Journal", "audit.read"], ["Paramètres", "settings.read"], ["Données personnelles", "privacy.requests.read"], ["État des services", "status.read"],
  ["Comptes admin", "admins.manage"], ["Mes sessions", null],
];
const menuDuContrat = (profils: AdminRole[]) => MENU.filter(([, p]) => p === null || adminRolesAllow(profils, p)).map(([l]) => l);

/** Les menus tels que le cahier les écrit (§ 4.3), pour distinguer l'écart documentaire. */
const MENU_DU_CAHIER: Record<string, string[]> = {
  mediateur: ["Accueil", "Alertes", "À arbitrer", "Billets", "Trajets", "Signalements", "Finances", "Pilotage", "Utilisateurs", "Paramètres", "État des services", "Mes sessions"],
  support: ["Accueil", "Alertes", "À arbitrer", "Billets", "Trajets", "Signalements", "Utilisateurs", "Paramètres", "État des services", "Mes sessions"],
  exploitation: ["Accueil", "Alertes", "Paramètres", "État des services", "Mes sessions"],
  finance: ["Accueil", "Alertes", "À arbitrer", "Trajets", "Finances", "Pilotage", "Utilisateurs", "Journal", "Paramètres", "État des services", "Mes sessions"],
  /* A153 (ANO-ADM-03) : « Utilisateurs » s'ajoute — le cahier (« le menu le plus court ») est à mettre à jour. */
  privacy: ["Accueil", "Utilisateurs", "Données personnelles", "État des services", "Mes sessions"],
  cumul: ["Accueil", "Alertes", "À arbitrer", "Billets", "Trajets", "Signalements", "Finances", "Pilotage", "Utilisateurs", "Journal", "Paramètres", "État des services", "Mes sessions"],
};

/** Le menu affiché et le libellé de profil, lus dans la barre latérale. */
async function barreLaterale(page: Page): Promise<{ menu: string[]; profil: string }> {
  await page.goto(`${bo()}/sessions`, { waitUntil: "domcontentloaded" });
  const nav = page.locator("aside nav a");
  await expect(nav.first()).toBeVisible({ timeout: 60_000 });
  return { menu: (await nav.allInnerTexts()).map((t) => t.trim()), profil: (await page.locator("aside p").nth(2).innerText()).trim() };
}

/** Ouvre un écran et rend le statut de chaque appel `/api/admin/*` fait par la page. */
async function ouvrir(page: Page, chemin: string): Promise<number[]> {
  const statuts: number[] = [];
  const ecoute = (r: { url(): string; status(): number }) => {
    if (/\/api\/admin\//.test(r.url()) && !r.url().includes("/admin/me")) statuts.push(r.status());
  };
  page.on("response", ecoute);
  await page.goto(`${bo()}${chemin}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(800);
  page.off("response", ecoute);
  return statuts;
}

const depuis = async () => {
  await new Promise((r) => setTimeout(r, 2_000));
  return new Date().toISOString();
};
const lignes = async (lecteur: NavigateurAdmin, from: string, adminUserId: string): Promise<LigneDuJournal[]> => lireLeJournal(lecteur.contexte.request, { from, adminUserId });
const resume = (ls: LigneDuJournal[]) => ls.map((l) => `${l.action} ${l.targetType}${l.targetId ? ` · ${l.targetId}` : ""}`);

test.describe("ADM-PRM — la matrice des permissions, profil par profil (cahier 02-ADMIN § 4.3)", () => {
  test.describe.configure({ mode: "serial" });

  /* Les files du § 2.4 (YAM-2041 ouvert, billet en attente…) : un chapitre précédent a pu trancher, valider ou
     vider. Mesuré au premier passage : « Ce deal n'est pas en attente d'arbitrage. » sur YAM-2041. */
  test.beforeAll(() => {
    new JeuEssai().rejouer();
  });

  test("ADM-PRM-0 · le miroir des permissions du back-office est identique au contrat", async () => {
    const code = readFileSync(join(RACINE, "apps/admin-ui/src/lib/permissions.ts"), "utf-8");
    const bloc = code.slice(code.indexOf("const MATRIX"), code.indexOf("};", code.indexOf("const MATRIX")));
    const miroir: Record<string, string[]> = {};
    for (const m of bloc.matchAll(/"([a-z.]+)":\s*\[([^\]]*)\]/g)) miroir[m[1]] = [...m[2].matchAll(/"([A-Z_]+)"/g)].map((x) => x[1]).sort();
    const contrat = Object.fromEntries(Object.entries(ADMIN_PERMISSIONS).map(([k, v]) => [k, [...v].sort()]));
    expect(Object.keys(miroir).length, "le miroir est lu").toBeGreaterThan(25);
    expect(miroir, "apps/admin-ui/src/lib/permissions.ts = ADMIN_PERMISSIONS").toEqual(contrat);
  });

  test("ADM-PRM-1 · Super administrateur", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(8 * 60_000);
    const sup = await navigateurAdmin("super");
    const idSuper = jeuEssai.admin("super").id;
    const { menu, profil } = await barreLaterale(sup.page);
    expect(menu, "les quinze entrées, dans l'ordre").toEqual(MENU.map(([l]) => l));
    expect(profil).toBe("Super administrateur");
    const debut = await depuis();
    const refus: string[] = [];
    for (const chemin of ["/home", "/alerts", "/disputes", "/tickets", "/trips", "/reports", "/finances", "/pilotage", "/users", "/audit", "/settings", "/privacy", "/status", "/admins", "/sessions", `/deals/${jeuEssai.deal("bzv-picked").id}`, "/settings/docs", "/finances/report"]) {
      const s = await ouvrir(sup.page, chemin);
      if (s.includes(403)) refus.push(`${chemin} → ${s.join(",")}`);
    }
    expect(refus, "aucune page ne répond 403").toEqual([]);
    /* Les conflits d'intérêts s'appliquent au super administrateur : sa propre fiche. */
    await sup.page.goto(`${bo()}/users/${idSuper}`, { waitUntil: "domcontentloaded" });
    await expect(sup.page.getByText("(c'est toi : aucune action possible)", { exact: true })).toBeVisible({ timeout: 60_000 });
    const soi = await sup.contexte.request.post(`${api()}/admin/users/${idSuper}/suspension`, { data: { level: "RESTRICTED", reason: MOTIF }, failOnStatusCode: false });
    expect(soi.status(), "agir sur son propre compte : 403").toBe(403);
    expect(((await soi.json()) as { message?: string }).message).toBe("You cannot act on your own account.");
    const journal = await lignes(sup, debut, idSuper);
    const actions = journal.map((l) => l.action);
    for (const a of ["DEAL_MONEY_VIEWED", "DATA_REQUESTS_VIEWED", "USER_VIEWED"]) expect(actions, `le parcours laisse ${a}`).toContain(a);
    test.info().annotations.push({ type: "note", description: `journal du parcours : ${[...new Set(actions)].join(", ")}` });
  });

  test("ADM-PRM-2 · Médiateur", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    const med = await navigateurAdmin("mediateur");
    const id = jeuEssai.admin("mediateur").id;
    const { menu, profil } = await barreLaterale(med.page);
    expect(menu, "menu = contrat").toEqual(menuDuContrat(["MEDIATOR"]));
    expect(menu, "menu = cahier").toEqual(MENU_DU_CAHIER.mediateur);
    expect(profil).toBe("Médiateur");
    const debut = await depuis();
    const litige = jeuEssai.deal("bzv-disputed").id;
    /* 3. Le dossier YAM-2041 et le formulaire « Trancher ». */
    await med.page.goto(`${bo()}/disputes/${litige}`, { waitUntil: "domcontentloaded" });
    /* Le cahier attend le formulaire « Trancher » ; le jeu d'essai ouvre YAM-2041 il y a un jour et le Voyageur a 72 h pour
       répondre : la section de décision affiche l'échéance (écart documentaire consigné). Ce que prouve la PERMISSION :
       le Médiateur voit la section de décision, jamais « Ton profil lit ce dossier mais ne tranche pas ». */
    await expect(med.page.getByRole("heading", { name: "YAM-2041", exact: true })).toBeVisible({ timeout: 60_000 });
    const decision = med.page.getByRole("heading", { name: "Trancher" }).or(med.page.getByText(/Décision possible à partir du|décision possible dès sa réponse/).first());
    await expect(decision.first(), "la section de décision du Médiateur").toBeVisible({ timeout: 30_000 });
    await expect(med.page.getByText(/Ton profil lit ce dossier mais ne tranche pas/), "jamais le texte du lecteur").toHaveCount(0);
    test.info().annotations.push({ type: "constat", description: `YAM-2041 : ${(await med.page.getByRole("heading", { name: "Trancher" }).count()) ? "formulaire « Trancher »" : "échéance de réponse du Voyageur affichée à la place du formulaire (72 h)"}` });
    /* 4. La fiche de Thomas : la carte Sanction propose « Appliquer ». */
    await med.page.goto(`${bo()}/users/${jeuEssai.membre("thomas")}`, { waitUntil: "domcontentloaded" });
    await expect(med.page.getByRole("button", { name: /^Appliquer/ }).first(), "« Appliquer » sur la carte Sanction").toBeVisible({ timeout: 60_000 });
    /* 5-6. Les refus, côté serveur. */
    expect(await ouvrir(med.page, "/admins"), "/admins : 403").toContain(403);
    expect(await ouvrir(med.page, "/privacy"), "/privacy : 403").toContain(403);
    const reglages = (await (await med.contexte.request.get(`${api()}/admin/settings`)).json()) as { version: number };
    const patch = await med.contexte.request.patch(`${api()}/admin/settings`, { data: { changes: { "pricing.commissionPct": 12 }, reason: MOTIF, expectedVersion: reglages.version }, failOnStatusCode: false });
    expect(patch.status(), "PATCH /admin/settings : 403").toBe(403);
    expect(((await patch.json()) as { message?: string }).message, "message de portée").toMatch(/^Your admin profile cannot change/);
    /* La même garde tient-elle sur la REMISE À ZÉRO, que la route ne garde que par settings.read ? */
    const remise = await med.contexte.request.post(`${api()}/admin/settings/reset`, { data: { keys: ["pricing.commissionPct"], reason: MOTIF, expectedVersion: reglages.version }, failOnStatusCode: false });
    expect(remise.status(), "POST /admin/settings/reset d'une clé MÉTIER déjà par défaut : 403 (ANO-ADM-02 : c'était 400 « Nothing to reset »)").toBe(403);
    /* La preuve forte : la commission RÉELLEMENT modifiée (super administrateur), puis la remise à zéro tentée par le
       Médiateur — elle doit être refusée, et la valeur rester. Le super administrateur la rétablit ensuite. */
    const superAdmin = await navigateurAdmin("super");
    const lu = (await (await superAdmin.contexte.request.get(`${api()}/admin/settings`)).json()) as { version: number; values: Record<string, number> };
    const commission = lu.values["pricing.commissionPct"];
    expect((await superAdmin.contexte.request.patch(`${api()}/admin/settings`, { data: { changes: { "pricing.commissionPct": commission + 0.5 }, reason: MOTIF, expectedVersion: lu.version } })).ok(), "le super administrateur modifie la commission").toBe(true);
    try {
      const v2 = (await (await med.contexte.request.get(`${api()}/admin/settings`)).json()) as { version: number };
      const tentative = await med.contexte.request.post(`${api()}/admin/settings/reset`, { data: { keys: ["pricing.commissionPct"], reason: MOTIF, expectedVersion: v2.version }, failOnStatusCode: false });
      expect(tentative.status(), "le Médiateur ne remet PAS la commission par défaut").toBe(403);
      const apres = (await (await med.contexte.request.get(`${api()}/admin/settings`)).json()) as { values: Record<string, number> };
      expect(apres.values["pricing.commissionPct"], "la valeur est restée").toBe(commission + 0.5);
    } finally {
      const v3 = (await (await superAdmin.contexte.request.get(`${api()}/admin/settings`)).json()) as { version: number };
      await superAdmin.contexte.request.patch(`${api()}/admin/settings`, { data: { changes: { "pricing.commissionPct": commission }, reason: MOTIF, expectedVersion: v3.version } });
    }
    expect((await med.contexte.request.get(`${api()}/admin/audit`, { failOnStatusCode: false })).status(), "GET /admin/audit : 403").toBe(403);
    expect((await med.contexte.request.get(`${api()}/admin/users/export?reason=${encodeURIComponent(MOTIF)}`, { failOnStatusCode: false })).status(), "export nominatif : 403").toBe(403);
    await med.page.goto(`${bo()}/users`, { waitUntil: "domcontentloaded" });
    await expect(med.page.getByRole("heading").first()).toBeVisible({ timeout: 60_000 });
    await expect(med.page.getByRole("button", { name: "Exporter en CSV (données personnelles)" }), "pas de bouton d'export nominatif").toHaveCount(0);
    const lecteur = await navigateurAdmin("finance");
    const journal = resume(await lignes(lecteur, debut, id));
    expect(journal, "DISPUTE_VIEWED sur le deal").toContain(`DISPUTE_VIEWED BOOKING · ${litige}`);
    expect(journal, "USER_VIEWED sur Thomas").toContain(`USER_VIEWED USER · ${jeuEssai.membre("thomas")}`);
    expect(journal.filter((l) => /SETTING|EXPORTED/.test(l)), "les refus n'écrivent rien").toEqual([]);
  });

  test("ADM-PRM-3 · Support", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    const sup = await navigateurAdmin("support");
    const id = jeuEssai.admin("support").id;
    const { menu, profil } = await barreLaterale(sup.page);
    expect(menu, "menu = contrat").toEqual(menuDuContrat(["SUPPORT"]));
    expect(menu, "menu = cahier").toEqual(MENU_DU_CAHIER.support);
    expect(profil).toBe("Support");
    const debut = await depuis();
    /* 3. Le billet en attente : ouvert, puis VALIDÉ (par l'API de l'écran). */
    const file = (await (await sup.contexte.request.get(`${api()}/admin/tickets`)).json()) as { items: Array<{ documentId: string; tripId: string }> };
    expect(file.items.length, "le jeu d'essai pose un billet en attente").toBeGreaterThan(0);
    const billet = file.items[0];
    expect((await sup.contexte.request.get(`${api()}/admin/tickets/${billet.documentId}`)).ok(), "ouvrir le billet").toBe(true);
    const valide = await sup.contexte.request.post(`${api()}/admin/tickets/${billet.documentId}/review`, { data: { decision: "VERIFY" } });
    expect(valide.ok(), `valider le billet : ${valide.status()}`).toBe(true);
    /* 4. Une fiche membre : « Proposer », jamais « Appliquer ». */
    await sup.page.goto(`${bo()}/users/${jeuEssai.membre("thomas")}`, { waitUntil: "domcontentloaded" });
    await expect(sup.page.getByRole("button", { name: /^Proposer/ }).first(), "« Proposer » sur la carte Sanction").toBeVisible({ timeout: 60_000 });
    await expect(sup.page.getByRole("button", { name: /^Appliquer/ }), "jamais « Appliquer »").toHaveCount(0);
    /* 5. La conversation du message signalé. */
    expect((await sup.contexte.request.get(`${api()}/admin/conversations/by-deal/${jeuEssai.deal("bzv-accepted").id}`)).ok(), "lire la conversation").toBe(true);
    /* 6-7. Les refus. */
    for (const chemin of ["/finances", "/pilotage", "/audit"]) expect(await ouvrir(sup.page, chemin), `${chemin} : 403`).toContain(403);
    const applique = await sup.contexte.request.post(`${api()}/admin/users/${jeuEssai.membre("thomas")}/suspension`, { data: { level: "RESTRICTED", reason: MOTIF }, failOnStatusCode: false });
    expect(applique.status(), "le Support PROPOSE, il n'applique jamais : 403").toBe(403);
    const reglages = (await (await sup.contexte.request.get(`${api()}/admin/settings`)).json()) as { version: number };
    expect((await sup.contexte.request.post(`${api()}/admin/settings/reset`, { data: { reason: MOTIF, expectedVersion: reglages.version }, failOnStatusCode: false })).status(), "remise à zéro de TOUS les paramètres par le Support : 403").toBe(403);
    await sup.page.goto(`${bo()}/disputes/${jeuEssai.deal("bzv-disputed").id}`, { waitUntil: "domcontentloaded" });
    await expect(sup.page.getByText(/Ton profil lit ce dossier mais ne tranche pas/)).toBeVisible({ timeout: 60_000 });
    const lecteur = await navigateurAdmin("finance");
    const journal = await lignes(lecteur, debut, id);
    const r = resume(journal);
    expect(r, "DOCUMENT_VIEWED sur le trajet").toContain(`DOCUMENT_VIEWED TRIP · ${billet.tripId}`);
    expect(r, "TICKET_VERIFIED sur le trajet").toContain(`TICKET_VERIFIED TRIP · ${billet.tripId}`);
    expect(r, "USER_VIEWED").toContain(`USER_VIEWED USER · ${jeuEssai.membre("thomas")}`);
    expect(journal.some((l) => l.action === "CONVERSATION_VIEWED" && l.targetType === "CONVERSATION"), "CONVERSATION_VIEWED").toBe(true);
    expect(r.filter((l) => /USER_(RESTRICTED|SUSPENDED)|SETTING/.test(l)), "un 403 ne journalise pas").toEqual([]);
  });

  test("ADM-PRM-4 · Exploitation (OPS)", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    const ops = await navigateurAdmin("exploitation");
    const id = jeuEssai.admin("exploitation").id;
    const { menu, profil } = await barreLaterale(ops.page);
    expect(menu, "menu = contrat").toEqual(menuDuContrat(["OPS"]));
    expect(menu, "menu = cahier").toEqual(MENU_DU_CAHIER.exploitation);
    expect(profil).toBe("Exploitation");
    /* 3. /settings : clés d'exploitation saisissables, clés métier « super administrateur seul ». */
    await ops.page.goto(`${bo()}/settings`, { waitUntil: "domcontentloaded" });
    await expect(ops.page.getByText("super administrateur seul").first(), "une clé métier affiche « super administrateur seul »").toBeVisible({ timeout: 60_000 });
    const debut = await depuis();
    /* 4. Modifier alerts.payoutFailedHours (motif ≥ 20), puis la remettre. */
    const avant = (await (await ops.contexte.request.get(`${api()}/admin/settings`)).json()) as { version: number; values: Record<string, number> };
    const valeur = avant.values["alerts.payoutFailedHours"];
    const modif = await ops.contexte.request.patch(`${api()}/admin/settings`, { data: { changes: { "alerts.payoutFailedHours": valeur + 1 }, reason: MOTIF, expectedVersion: avant.version } });
    expect(modif.ok(), `SETTING_CHANGED : ${modif.status()} ${await modif.text()}`).toBe(true);
    const apres = (await (await ops.contexte.request.get(`${api()}/admin/settings`)).json()) as { version: number };
    await ops.contexte.request.patch(`${api()}/admin/settings`, { data: { changes: { "alerts.payoutFailedHours": valeur }, reason: MOTIF, expectedVersion: apres.version } });
    /* 5. /status et l'éditeur de maintenance. */
    expect(await ouvrir(ops.page, "/status"), "/status sans 403").not.toContain(403);
    /* 6-7. Les refus. */
    for (const chemin of ["/users", "/disputes", "/finances", "/audit"]) expect(await ouvrir(ops.page, chemin), `${chemin} : 403`).toContain(403);
    const v = (await (await ops.contexte.request.get(`${api()}/admin/settings`)).json()) as { version: number };
    const metier = await ops.contexte.request.patch(`${api()}/admin/settings`, { data: { changes: { "pricing.commissionPct": 12.5 }, reason: MOTIF, expectedVersion: v.version }, failOnStatusCode: false });
    expect(metier.status(), "clé métier : 403").toBe(403);
    expect(((await metier.json()) as { message?: string }).message).toBe("Your admin profile cannot change: pricing.commissionPct.");
    const lecteur = await navigateurAdmin("finance");
    const journal = await lignes(lecteur, debut, id);
    const change = journal.find((l) => l.action === "SETTING_CHANGED");
    expect(change, "SETTING_CHANGED écrit").toBeTruthy();
    expect(`${change!.targetType} · ${change!.targetId}`).toBe("SETTINGS · alerts.payoutFailedHours");
    expect(Object.keys((change!.after ?? change!.before) as object).sort(), "{ key, before, after, reason, version }").toEqual(expect.arrayContaining(["key", "reason"]));
  });

  test("ADM-PRM-5 · Finance", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    const fin = await navigateurAdmin("finance");
    const id = jeuEssai.admin("finance").id;
    const { menu, profil } = await barreLaterale(fin.page);
    expect(menu, "menu = contrat").toEqual(menuDuContrat(["FINANCE"]));
    expect(menu, "menu = cahier").toEqual(MENU_DU_CAHIER.finance);
    expect(profil).toBe("Finance");
    const debut = await depuis();
    const deal = jeuEssai.deal("bzv-completed-blocked").id;
    expect(await ouvrir(fin.page, "/finances"), "/finances").not.toContain(403);
    expect(await ouvrir(fin.page, `/deals/${deal}`), "fiche argent").not.toContain(403);
    expect(await ouvrir(fin.page, "/finances/report"), "rapport mensuel").not.toContain(403);
    /* 3. L'export CSV du rapport. */
    const mois = new Date().toISOString().slice(0, 7);
    const exp = await fin.contexte.request.get(`${api()}/admin/finances/export?from=${mois}-01&to=${new Date().toISOString().slice(0, 10)}`, { failOnStatusCode: false });
    test.info().annotations.push({ type: "note", description: `export finances : ${exp.status()} ${(exp.headers()["content-type"] ?? "").slice(0, 30)}` });
    expect(exp.ok(), `export finances : ${exp.status()} ${exp.ok() ? "" : await exp.text()}`).toBe(true);
    expect(await ouvrir(fin.page, "/audit"), "/audit").not.toContain(403);
    const litige = jeuEssai.deal("bzv-disputed").id;
    expect(await ouvrir(fin.page, `/disputes/${litige}`), "dossier de médiation").not.toContain(403);
    /* 6-7. Les refus. */
    expect((await fin.contexte.request.get(`${api()}/admin/conversations/by-deal/${jeuEssai.deal("bzv-accepted").id}`, { failOnStatusCode: false })).status(), "conversation : 403 (vie privée)").toBe(403);
    expect((await fin.contexte.request.post(`${api()}/admin/disputes/${litige}/resolve`, { data: { outcome: "REJECTED", reason: MOTIF }, failOnStatusCode: false })).status(), "trancher : 403").toBe(403);
    await fin.page.goto(`${bo()}/deals/${deal}`, { waitUntil: "domcontentloaded" });
    await expect(fin.page.getByRole("heading").first()).toBeVisible({ timeout: 60_000 });
    await expect(fin.page.getByRole("button", { name: "Rembourser maintenant" }), "jamais « Rembourser maintenant »").toHaveCount(0);
    const journal = resume(await lignes(fin, debut, id));
    expect(journal, "DEAL_MONEY_VIEWED").toContain(`DEAL_MONEY_VIEWED BOOKING · ${deal}`);
    expect(journal.some((l) => l.startsWith("FINANCE_EXPORTED BOOKING")), `FINANCE_EXPORTED (${journal.join(", ")})`).toBe(true);
    expect(journal, "DISPUTE_VIEWED").toContain(`DISPUTE_VIEWED BOOKING · ${litige}`);
  });

  test("ADM-PRM-6 · Données personnelles (PRIVACY)", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    const pri = await navigateurAdmin("privacy");
    const id = jeuEssai.admin("privacy").id;
    const { menu, profil } = await barreLaterale(pri.page);
    expect(menu, "menu = contrat").toEqual(menuDuContrat(["PRIVACY"]));
    expect(menu, "menu = cahier").toEqual(MENU_DU_CAHIER.privacy);
    expect(profil).toBe("Données personnelles");
    const debut = await depuis();
    /* 2. L'accueil sans kpi.read : 403 sur les compteurs, message rouge à la place des tuiles (attendu). */
    expect(await ouvrir(pri.page, "/home"), "/home : GET /admin/kpis répond 403 (comportement attendu)").toContain(403);
    expect(await ouvrir(pri.page, "/privacy"), "/privacy").not.toContain(403);
    /* 4. /users puis une fiche — ANO-ADM-03 close par A153 : PRIVACY a users.read, ses deux gestes sont atteignables. */
    const thomas = jeuEssai.membre("thomas");
    expect(await ouvrir(pri.page, "/users"), "/users").not.toContain(403);
    await expect(pri.page.getByRole("button", { name: "Exporter en CSV (données personnelles)" }), "l'export nominatif est atteignable").toBeVisible({ timeout: 30_000 });
    expect(await ouvrir(pri.page, `/users/${thomas}`), "fiche membre").not.toContain(403);
    await expect(pri.page.getByText("Effacer ce compte (RGPD)"), "la carte d'effacement est atteignable").toBeVisible({ timeout: 30_000 });
    /* A153 n'ouvre que la LECTURE : proposer une sanction reste refusé au profil RGPD. */
    const sanction = await pri.contexte.request.post(`${api()}/admin/users/${thomas}/suspension/propose`, { data: { reason: MOTIF }, failOnStatusCode: false });
    expect(sanction.status(), "proposer une sanction : 403").toBe(403);
    expect(await ouvrir(pri.page, "/status"), "/status").not.toContain(403);
    for (const chemin of ["/disputes", "/finances", "/trips", "/settings"]) expect(await ouvrir(pri.page, chemin), `${chemin} : 403`).toContain(403);
    const lecteur = await navigateurAdmin("finance");
    const journal = await lignes(lecteur, debut, id);
    const vue = journal.find((l) => l.action === "DATA_REQUESTS_VIEWED");
    expect(vue, "DATA_REQUESTS_VIEWED").toBeTruthy();
    expect(vue!.targetType).toBe("USER");
    expect(vue!.targetId, "sans identifiant").toBeNull();
    const fiche = journal.find((l) => l.action === "USER_VIEWED");
    expect(fiche && `${fiche.targetType} · ${fiche.targetId}`, "USER_VIEWED USER · id").toBe(`USER · ${thomas}`);
  });

  test("ADM-PRM-7 · cumul Support + Finance", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    const cum = await navigateurAdmin("cumul");
    const id = jeuEssai.admin("cumul").id;
    const { menu, profil } = await barreLaterale(cum.page);
    expect(profil, "les deux profils, ordre canonique").toBe("Support + Finance");
    expect(menu, "menu = union (contrat)").toEqual(menuDuContrat(["SUPPORT", "FINANCE"]));
    expect(menu, "menu = cahier").toEqual(MENU_DU_CAHIER.cumul);
    const debut = await depuis();
    expect(await ouvrir(cum.page, "/finances"), "/finances").not.toContain(403);
    expect(await ouvrir(cum.page, "/tickets"), "/tickets").not.toContain(403);
    const litige = jeuEssai.deal("bzv-disputed").id;
    expect(await ouvrir(cum.page, `/disputes/${litige}`), "dossier").not.toContain(403);
    /* 4. Proposer un remboursement manuel (proposition seule, jamais appliquée). */
    const deal = jeuEssai.deal("bzv-completed").id;
    const prop = await cum.contexte.request.post(`${api()}/admin/deals/${deal}/refund/propose`, { data: { amountCents: 100, reason: MOTIF }, failOnStatusCode: false });
    expect(prop.ok(), `proposition de remboursement : ${prop.status()} ${prop.ok() ? "" : await prop.text()}`).toBe(true);
    /* 5. Trancher : ni Support ni Finance. */
    expect((await cum.contexte.request.post(`${api()}/admin/disputes/${litige}/resolve`, { data: { outcome: "REJECTED", reason: MOTIF }, failOnStatusCode: false })).status(), "l'union ne crée aucun droit : 403").toBe(403);
    const lecteur = await navigateurAdmin("finance");
    const ligne = (await lignes(lecteur, debut, id)).find((l) => l.action === "REFUND_MANUAL_PROPOSED");
    expect(ligne, "REFUND_MANUAL_PROPOSED").toBeTruthy();
    expect(`${ligne!.targetType} · ${ligne!.targetId}`).toBe(`BOOKING · ${deal}`);
    expect(ligne!.after, "after : { amountCents, reason }").toMatchObject({ amountCents: 100 });
    /* On ne laisse pas une proposition ouverte dans la file du jeu d'essai. */
    execFileSync("npx", ["tsx", "--env-file=.env", "packages/libs/prisma/scripts/seed-deals.ts"], { cwd: RACINE, stdio: "ignore", timeout: 300_000 });
  });

  test("ADM-PRM-8 · les conflits d'intérêts (cas jouables sans compte partie)", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(5 * 60_000);
    test.info().annotations.push({ type: "⏭ partiel", description: "cas 3, 4, 5 (l'admin Voyageur, auteur du billet, partie au deal) : aucun compte admin du jeu d'essai n'est partie — le cahier autorise à se limiter aux autres cas" });
    const sup = await navigateurAdmin("super");
    const med = await navigateurAdmin("mediateur");
    const idSuper = jeuEssai.admin("super").id;
    const debut = await depuis();
    /* 1. Sa propre fiche. */
    const soi = await med.contexte.request.post(`${api()}/admin/users/${jeuEssai.admin("mediateur").id}/suspension`, { data: { level: "RESTRICTED", reason: MOTIF }, failOnStatusCode: false });
    expect(soi.status(), "cas 1").toBe(403);
    expect(((await soi.json()) as { message?: string }).message).toBe("You cannot act on your own account.");
    /* 2. Un Médiateur veut sanctionner un compte admin (le Support). */
    const surAdmin = await med.contexte.request.post(`${api()}/admin/users/${jeuEssai.admin("support").id}/suspension`, { data: { level: "RESTRICTED", reason: MOTIF }, failOnStatusCode: false });
    expect(surAdmin.status(), "cas 2").toBe(403);
    expect(((await surAdmin.json()) as { message?: string }).message).toBe("Only a super administrator can act on an admin account.");
    /* 6. Un super administrateur veut effacer son propre compte. */
    const efface = await sup.contexte.request.post(`${api()}/admin/users/${idSuper}/erase`, { data: { reason: MOTIF }, failOnStatusCode: false });
    expect(efface.status(), "cas 6").toBe(403);
    expect(((await efface.json()) as { message?: string }).message).toBe("You cannot erase your own account from the back-office.");
    /* 7. Retirer son propre accès. */
    expect((await sup.contexte.request.delete(`${api()}/admin/admins/${idSuper}`, { failOnStatusCode: false })).status(), "cas 7").toBe(403);
    /* 8. Le dernier super administrateur ne se rétrograde pas. */
    const retro = await sup.contexte.request.patch(`${api()}/admin/admins/${idSuper}`, { data: { adminRoles: ["MEDIATOR"] }, failOnStatusCode: false });
    expect(retro.status(), "cas 8").toBe(403);
    /* Le cahier attend « The last super administrator cannot be downgraded » ; mais le seul acteur qui puisse viser le
       DERNIER super administrateur est lui-même, arrêté avant par la garde « soi-même ». Le 403 tient ; le message du
       cahier est inatteignable par l'API (écart documentaire, consigné). */
    const messageRetro = ((await retro.json()) as { message?: string }).message ?? "";
    expect(messageRetro).toMatch(/You cannot change your own profile\.|last super administrator cannot be (downgraded|revoked)/i);
    test.info().annotations.push({ type: "constat", description: `cas 8 : « ${messageRetro} »` });
    /* Journal : aucune ligne dans les cas refusés. */
    const lecteur = await navigateurAdmin("finance");
    const toutes = await lireLeJournal(lecteur.contexte.request, { from: debut });
    const ecrites = toutes.filter((l) => !["ADMIN_LOGIN", "ADMIN_LOGOUT"].includes(l.action) && [idSuper, jeuEssai.admin("mediateur").id].includes((l as unknown as { adminUserId?: string }).adminUserId ?? ""));
    expect(resume(toutes.filter((l) => /USER_RESTRICTED|USER_ERASED|ADMIN_(REVOKED|ROLE)/.test(l.action))), "un refus ne s'écrit pas").toEqual([]);
    void ecrites;
  });
});
