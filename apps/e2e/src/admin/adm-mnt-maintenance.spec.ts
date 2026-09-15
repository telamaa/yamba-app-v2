/**
 * adm-mnt-maintenance.spec.ts — cahier 02-ADMIN, § 5.23 « Maintenance » (ADM-MNT-1 à 4) + fiches ajoutées
 * =========================================================================================================
 * Le geste le plus lourd du back-office : une case cochée coupe les écritures de toute la plateforme. Le chapitre se juge
 * à quatre promesses :
 *  - **une annonce prévient, elle ne coupe pas** ; la lecture seule coupe les écritures, jamais la connexion ni le
 *    back-office, et la sonde publique ne crie pas à la panne ;
 *  - **lever, c'est revenir à la normale** : plus de bandeau, ni rouge ni ambre, et l'email dit « levée » ;
 *  - **l'écran ne ment pas** : la date relue est celle saisie, un formulaire ne se vide pas pendant qu'on l'écrit, un
 *    refus est en français ;
 *  - **deux gestes simultanés, une seule décision** (verrou de version), et l'interrupteur d'environnement du gateway
 *    l'emporte sur l'écran — qui le dit et n'essaie pas de le contredire.
 * Quoi qu'il arrive, l'`afterAll` remet le document `maintenance` à plat et relance le gateway sans variable forcée : une
 * lecture seule oubliée condamnerait toute la suite.
 */
import { execFileSync, execSync, spawn } from "node:child_process";
import { openSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test, expect, type Navigateur, type NavigateurAdmin } from "../fixtures/yamba";
import { adresseDeLApi, adresseDeLApiAdmin, adresseDuBackOffice } from "../fixtures/adresses";
import { JeuEssai } from "../fixtures/jeu-essai";
import { lireLeJournal } from "../pages/journal-admin";
import { debutDuScenario, lireCoteServeur, MOTIF_DE_RECETTE } from "../pages/ecran-admin";

const api = () => adresseDeLApi();
const apiAdmin = () => adresseDeLApiAdmin();
const bo = () => adresseDuBackOffice();
const RACINE = join(__dirname, "../../../..");
type Page = NavigateurAdmin["page"];
type Contexte = Navigateur["contexte"];
type Etat = { enabled: boolean; messageFr: string; messageEn: string; scheduledAt: string | null; version: number; envOverride?: boolean; updatedBy: string | null };
type EtatPublic = { enabled: boolean; message: { fr: string; en: string }; scheduledAt: string | null };

/* ══ Manœuvres ═══════════════════════════════════════════════════════════════════════════════ */

/** Filet : le document `maintenance` à plat, directement en base (jamais une session qui aurait pu échouer). */
function remettreAPlat(): void {
  execFileSync("npx", ["tsx", "--env-file=.env", "-e", 'import p from "./packages/libs/prisma"; (async () => { await p.platformSettings.updateMany({ where: { key: "maintenance" }, data: { values: { enabled: false, messageFr: "", messageEn: "", scheduledAt: null } } }); process.exit(0); })();'], { cwd: RACINE, encoding: "utf-8", timeout: 180_000 });
}
const supprimerLeDocument = () => lireCoteServeur(`import p from "./packages/libs/prisma"; (async () => { await p.platformSettings.deleteMany({ where: { key: "maintenance" } }); console.log("@@1"); process.exit(0); })();`);

const pidDuPort = (port: number) => execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t || true`, { encoding: "utf-8" }).trim().split("\n").filter(Boolean)[0] ?? null;
const repond = async (url: string) => {
  try { return (await fetch(url, { signal: AbortSignal.timeout(2_000) })).status === 200; } catch { return false; }
};
/** Relance le gateway en bundle détaché, avec (ou sans) l'interrupteur d'environnement. L'environnement du processus gagne sur `--env-file`. */
async function relancerLeGateway(forcer: boolean): Promise<void> {
  const pid = pidDuPort(8080);
  if (pid) {
    process.kill(Number(pid));
    await expect.poll(() => pidDuPort(8080), { timeout: 30_000, intervals: [500] }).toBeNull();
  }
  const log = openSync(join(tmpdir(), "yamba-recette-mnt-gateway.log"), "a");
  const env = { ...process.env };
  delete env.MAINTENANCE_MODE;
  if (forcer) Object.assign(env, { MAINTENANCE_MODE: "on", MAINTENANCE_MESSAGE_FR: "Recette ADM-MNT-4 : forcé par l'environnement.", MAINTENANCE_MESSAGE_EN: "QA ADM-MNT-4: forced by the environment." });
  spawn("node", ["--env-file=../../.env", "dist/main.js"], { cwd: join(RACINE, "apps/api-gateway"), detached: true, stdio: ["ignore", log, log], env }).unref();
  await expect.poll(() => repond("http://localhost:8080/gateway-health"), { timeout: 90_000, intervals: [1_000] }).toBe(true);
}

async function lire(ctx: Contexte): Promise<Etat> {
  const r = await ctx.request.get(`${apiAdmin()}/admin/maintenance`);
  expect(r.status(), `GET /admin/maintenance : ${r.status()}`).toBe(200);
  return (await r.json()) as Etat;
}
/** La passerelle relit toutes les 10 s : on attend qu'elle ait vu l'état, et on rend le temps mis. */
async function attendreLaPasserelle(ctx: Contexte, attendu: (e: EtatPublic) => boolean, quoi: string): Promise<number> {
  const debut = Date.now();
  await expect.poll(async () => {
    const r = await ctx.request.get(`${api()}/maintenance`);
    return r.ok() && attendu((await r.json()) as EtatPublic);
  }, { timeout: 40_000, intervals: [1_000], message: `la passerelle voit ${quoi}` }).toBe(true);
  return Date.now() - debut;
}
async function envoyerUnMessage(ctx: Contexte, dealId: string, corps: string): Promise<{ statut: number; entetes: Record<string, string>; texte: string }> {
  const fil = await ctx.request.get(`${api()}/messages/conversations/by-deal/${dealId}`);
  const filId = ((await fil.json()) as { conversation: { id: string } }).conversation.id;
  const r = await ctx.request.post(`${api()}/messages/conversations/${filId}/messages`, { data: { body: corps } });
  return { statut: r.status(), entetes: r.headers(), texte: await r.text() };
}

/* ══ L'écran ═════════════════════════════════════════════════════════════════════════════════ */

const editeur = (page: Page) => page.locator("section").filter({ has: page.getByRole("heading", { name: /^Maintenance/ }) }).last();
const phraseDEtat = (page: Page) => editeur(page).locator("p").first();
const bandeauAdmin = (page: Page) => page.locator("div.rounded-xl").filter({ hasText: /état des services/ }).filter({ hasText: /Plateforme en lecture seule|Maintenance annoncée le/ }).first();
const bandeauMembre = (page: Page) => page.locator('[role="status"]').filter({ hasText: /Maintenance/ }).first();
async function ouvrirStatut(page: Page): Promise<void> {
  await page.goto(`${bo()}/status`, { waitUntil: "domcontentloaded" });
  await expect(phraseDEtat(page)).toBeVisible({ timeout: 90_000 });
}
const pourChampLocal = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
/** Remplit l'éditeur puis clique le bouton nommé ; rend la réponse du PUT. */
async function enregistrer(page: Page, saisie: { date?: string; fr?: string; en?: string; activer?: boolean; motif: string }, bouton: RegExp) {
  const ed = editeur(page);
  if (saisie.activer !== undefined) await ed.locator('input[type="checkbox"]').setChecked(saisie.activer);
  if (saisie.date !== undefined) await ed.locator('input[type="datetime-local"]').fill(saisie.date);
  if (saisie.fr !== undefined) await ed.getByLabel("Message FR").fill(saisie.fr);
  if (saisie.en !== undefined) await ed.getByLabel("Message EN").fill(saisie.en);
  await ed.locator("textarea").fill(saisie.motif);
  const reponse = page.waitForResponse((r) => r.url().includes("/admin/maintenance") && r.request().method() === "PUT", { timeout: 30_000 });
  await ed.getByRole("button", { name: bouton }).click();
  return reponse;
}
const superAdmins = () =>
  lireCoteServeur<Array<{ email: string }>>(`import prisma from "./packages/libs/prisma"; (async () => { const u = await prisma.user.findMany({ where: { roles: { has: "ADMIN" }, adminRoles: { has: "SUPER_ADMIN" }, isDeleted: false, OR: [{ emailSuppressedAt: null }, { emailSuppressedAt: { isSet: false } }] }, select: { email: true } }); console.log("@@" + JSON.stringify(u)); process.exit(0); })();`);

/* ══ Les fiches ══════════════════════════════════════════════════════════════════════════════ */

test.describe("ADM-MNT — maintenance (cahier 02-ADMIN § 5.23)", () => {
  // Pas de mode « serial » : chaque fiche pose son état de départ, un échec ne masque pas les suivantes.
  test.beforeAll(() => {
    new JeuEssai().rejouer(); // le fil du deal `bzv-accepted` (Pauline) sert d'écriture ordinaire de membre
    remettreAPlat();
  });
  test.afterAll(async () => {
    remettreAPlat();
    if (!(await repond("http://localhost:8080/gateway-health"))) await relancerLeGateway(false);
  });

  test("ADM-MNT-1 · annoncer une maintenance sans rien bloquer, relire la date saisie", async ({ navigateurAdmin, navigateurConnecte, jeuEssai, mailpit }) => {
    test.setTimeout(6 * 60_000);
    const ops = await navigateurAdmin("exploitation");
    const sup = await navigateurAdmin("super"); // le journal : l'Exploitation ne le lit pas (audit.read)
    const debut = await debutDuScenario();
    const destinataires = superAdmins();
    const avantCourriels = await Promise.all(destinataires.map((d) => mailpit.compter({ pour: d.email, sujet: "Maintenance planifiée sur Yamba" })));

    await ouvrirStatut(ops.page);
    await expect(phraseDEtat(ops.page)).toContainText("Aucune maintenance en cours ni annoncée.");
    const avant = await lire(ops.contexte);
    const dans2h = new Date(Date.now() + 2 * 3_600_000);
    const saisie = pourChampLocal(dans2h);
    const r = await enregistrer(ops.page, { date: saisie, fr: "Intervention de recette ADM-MNT-1.", en: "QA intervention ADM-MNT-1.", activer: false, motif: MOTIF_DE_RECETTE("ADM-MNT-1") }, /^Enregistrer l'annonce$/);
    expect(r.status(), await r.text()).toBe(200);
    await expect(editeur(ops.page)).toContainText("Enregistré : journal écrit, super administrateurs prévenus, le gateway applique dans les 10 s.");

    const apres = await lire(ops.contexte);
    expect(apres).toMatchObject({ enabled: false, messageFr: "Intervention de recette ADM-MNT-1.", messageEn: "QA intervention ADM-MNT-1.", version: avant.version + 1 });
    expect(Math.abs(new Date(apres.scheduledAt as string).getTime() - dans2h.getTime()), "la date stockée est celle saisie (à la minute)").toBeLessThan(60_000);
    /* L'écran relit la date SAISIE — pas l'heure UTC présentée comme une heure locale (piège d'un `slice(0, 16)`). */
    await expect(editeur(ops.page).locator('input[type="datetime-local"]')).toHaveValue(saisie, { timeout: 45_000 });
    await expect(phraseDEtat(ops.page)).toContainText(/Maintenance annoncée le .+ : le bandeau est affiché, rien n'est bloqué\. Dernière modification le .+ par .+ \(version \d+\)\./);

    /* Les deux fronts : bandeau ambre, rien de bloqué. */
    const membre = await navigateurConnecte("pauline");
    await attendreLaPasserelle(membre.contexte, (e) => !e.enabled && Boolean(e.scheduledAt), "l'annonce");
    await ops.page.reload({ waitUntil: "domcontentloaded" });
    await expect(bandeauAdmin(ops.page)).toContainText(/Maintenance annoncée le .+ — Intervention de recette ADM-MNT-1\. · état des services/, { timeout: 60_000 });
    await membre.page.goto("/fr/dashboard/home", { waitUntil: "domcontentloaded" });
    await expect(bandeauMembre(membre.page)).toBeVisible({ timeout: 60_000 });
    expect(await bandeauMembre(membre.page).evaluate((n) => getComputedStyle(n).backgroundColor), "bandeau membre ambre").toBe("rgb(251, 191, 36)");
    const envoi = await envoyerUnMessage(membre.contexte, jeuEssai.deal("bzv-accepted").id, "Message pendant une annonce (recette ADM-MNT-1)");
    expect(envoi.statut, envoi.texte.slice(0, 200)).toBeLessThan(300);

    for (const [i, d] of destinataires.entries()) {
      await expect.poll(() => mailpit.compter({ pour: d.email, sujet: "Maintenance planifiée sur Yamba" }), { timeout: 45_000 }).toBe(avantCourriels[i] + 1);
    }
    const lignes = await lireLeJournal(sup.contexte.request, { from: debut, action: "MAINTENANCE_CHANGED" });
    expect(lignes).toHaveLength(1);
    expect(lignes[0]).toMatchObject({ targetType: "SETTINGS", targetId: "maintenance", before: { version: avant.version }, after: { reason: MOTIF_DE_RECETTE("ADM-MNT-1"), version: avant.version + 1 } });
  });

  test("ADM-MNT-2 · passer en lecture seule : écritures 503, connexion et back-office ouverts, sonde à 200", async ({ navigateurAdmin, navigateurConnecte, jeuEssai, mailpit }) => {
    test.setTimeout(6 * 60_000);
    const ops = await navigateurAdmin("exploitation");
    const sup = await navigateurAdmin("super"); // le journal : l'Exploitation ne le lit pas (audit.read)
    const debut = await debutDuScenario();
    const destinataires = superAdmins();
    const avantCourriels = await Promise.all(destinataires.map((d) => mailpit.compter({ pour: d.email, sujet: "Maintenance activée sur Yamba" })));
    const membre = await navigateurConnecte("pauline");

    await ouvrirStatut(ops.page);
    const r = await enregistrer(ops.page, { activer: true, motif: MOTIF_DE_RECETTE("ADM-MNT-2") }, /^Passer en lecture seule$/);
    expect(r.status(), await r.text()).toBe(200);
    const delai = await attendreLaPasserelle(membre.contexte, (e) => e.enabled, "la lecture seule");
    expect(delai, "effet en moins de 10 s (relecture du gateway)").toBeLessThanOrEqual(11_000);

    await membre.page.goto("/fr/dashboard/home", { waitUntil: "domcontentloaded" });
    await expect(bandeauMembre(membre.page)).toBeVisible({ timeout: 60_000 });
    expect(await bandeauMembre(membre.page).evaluate((n) => getComputedStyle(n).backgroundColor), "bandeau membre rouge").toBe("rgb(220, 38, 38)");
    await ops.page.reload({ waitUntil: "domcontentloaded" });
    await expect(bandeauAdmin(ops.page)).toContainText(/Plateforme en lecture seule/, { timeout: 60_000 });

    /* Lectures : passent. Écritures : 503 MAINTENANCE + Retry-After 300, avec le code là où tout refus le porte (A146). */
    expect((await membre.contexte.request.get(`${api()}/trips/${jeuEssai.trajet("bzv-upcoming")}/public`)).status()).toBe(200);
    const refus = await envoyerUnMessage(membre.contexte, jeuEssai.deal("bzv-accepted").id, "Message pendant la lecture seule (recette ADM-MNT-2)");
    expect(refus.statut).toBe(503);
    expect(refus.entetes["retry-after"]).toBe("300");
    expect(JSON.parse(refus.texte)).toMatchObject({ code: "MAINTENANCE", details: { code: "MAINTENANCE" } });
    /* Connexion exemptée, back-office exempté, sonde publique 200 « maintenance ». */
    const refresh = await membre.contexte.request.post(`${api()}/auth/refresh`);
    expect(refresh.status(), "/api/auth/* n'est pas bloqué").not.toBe(503);
    expect((await ops.contexte.request.get(`${apiAdmin()}/admin/status`)).status()).toBe(200);
    const sonde = await fetch("http://localhost:8080/api/status");
    expect(sonde.status).toBe(200);
    expect(((await sonde.json()) as { status: string }).status).toBe("maintenance");

    for (const [i, d] of destinataires.entries()) {
      await expect.poll(() => mailpit.compter({ pour: d.email, sujet: "Maintenance activée sur Yamba" }), { timeout: 45_000 }).toBe(avantCourriels[i] + 1);
    }
    expect(await lireLeJournal(sup.contexte.request, { from: debut, action: "MAINTENANCE_CHANGED" })).toHaveLength(1);
  });

  test("ADM-MNT-3 · lever la maintenance : plus aucun bandeau, écritures rouvertes, email « levée »", async ({ navigateurAdmin, navigateurConnecte, jeuEssai, mailpit }) => {
    test.setTimeout(6 * 60_000);
    const ops = await navigateurAdmin("exploitation");
    const sup = await navigateurAdmin("super"); // le journal : l'Exploitation ne le lit pas (audit.read)
    const debut = await debutDuScenario();
    const destinataires = superAdmins();
    const sujets = ["Maintenance levée sur Yamba", "Maintenance planifiée sur Yamba"];
    const avant = await Promise.all(destinataires.map(async (d) => Promise.all(sujets.map((s) => mailpit.compter({ pour: d.email, sujet: s })))));
    const membre = await navigateurConnecte("pauline");
    /* Précondition, comme après MNT-1 puis MNT-2 : une annonce à venir, puis la lecture seule. */
    const pose = await ops.contexte.request.put(`${apiAdmin()}/admin/maintenance`, { data: { enabled: true, messageFr: "Intervention de recette ADM-MNT-3.", messageEn: "", scheduledAt: new Date(Date.now() + 2 * 3_600_000).toISOString(), reason: MOTIF_DE_RECETTE("ADM-MNT-3 précondition"), expectedVersion: (await lire(ops.contexte)).version } });
    expect(pose.status(), await pose.text()).toBe(200);
    await attendreLaPasserelle(membre.contexte, (e) => e.enabled, "la lecture seule posée");
    const debutLevee = await debutDuScenario();

    /* Le formulaire garde l'annonce de MNT-1 : c'est le geste réel du cahier (on décoche, on lève). */
    await ouvrirStatut(ops.page);
    const r = await enregistrer(ops.page, { activer: false, motif: MOTIF_DE_RECETTE("ADM-MNT-3") }, /^Lever la maintenance$/);
    expect(r.status(), await r.text()).toBe(200);
    const leve = await lire(ops.contexte);
    expect(leve, "lever, c'est aussi clore l'annonce qui l'a précédée").toMatchObject({ enabled: false, scheduledAt: null });
    await expect(phraseDEtat(ops.page)).toContainText("Aucune maintenance en cours ni annoncée.", { timeout: 45_000 });

    const delai = await attendreLaPasserelle(membre.contexte, (e) => !e.enabled && !e.scheduledAt, "la levée");
    expect(delai).toBeLessThanOrEqual(11_000);
    await membre.page.goto("/fr/dashboard/home", { waitUntil: "domcontentloaded" });
    await expect(membre.page.getByRole("heading").first()).toBeVisible({ timeout: 90_000 });
    await membre.page.waitForTimeout(2_000);
    await expect(bandeauMembre(membre.page)).toHaveCount(0);
    await ops.page.reload({ waitUntil: "domcontentloaded" });
    await expect(phraseDEtat(ops.page)).toBeVisible({ timeout: 90_000 });
    await ops.page.waitForTimeout(2_000);
    await expect(bandeauAdmin(ops.page)).toHaveCount(0);
    const envoi = await envoyerUnMessage(membre.contexte, jeuEssai.deal("bzv-accepted").id, "Message après la levée (recette ADM-MNT-3)");
    expect(envoi.statut, envoi.texte.slice(0, 200)).toBeLessThan(300);

    for (const [i, d] of destinataires.entries()) {
      await expect.poll(() => mailpit.compter({ pour: d.email, sujet: sujets[0] }), { timeout: 45_000 }).toBe(avant[i][0] + 1);
      expect(await mailpit.compter({ pour: d.email, sujet: sujets[1] }), "la levée ne s'annonce pas comme une maintenance planifiée").toBe(avant[i][1]);
    }
    expect(await lireLeJournal(sup.contexte.request, { from: debutLevee, action: "MAINTENANCE_CHANGED" })).toHaveLength(1);
    void debut;
  });

  test("ADM-MNT-4 · verrou de version, interrupteur d'environnement, Support en lecture", async ({ navigateurAdmin }) => {
    test.setTimeout(8 * 60_000);
    const a = await navigateurAdmin("exploitation");
    const b = await navigateurAdmin("super");
    const debut = await debutDuScenario();

    /* 1. Deux sessions : B écrit, A écrit sur une page périmée → 409 en français, page rechargée. */
    await ouvrirStatut(a.page);
    const ecritB = await b.contexte.request.put(`${apiAdmin()}/admin/maintenance`, { data: { enabled: false, messageFr: "", messageEn: "", scheduledAt: new Date(Date.now() + 3 * 3_600_000).toISOString(), reason: MOTIF_DE_RECETTE("ADM-MNT-4 B"), expectedVersion: (await lire(b.contexte)).version } });
    expect(ecritB.status(), await ecritB.text()).toBe(200);
    const refus = await enregistrer(a.page, { date: "", activer: false, motif: MOTIF_DE_RECETTE("ADM-MNT-4 A") }, /^Enregistrer l'annonce$/);
    expect(refus.status()).toBe(409);
    expect(((await refus.json()) as { details?: { code?: string } }).details?.code).toBe("STALE_VERSION");
    await expect(editeur(a.page)).toContainText("L'état a changé entre-temps : la page est rechargée.");
    await expect(phraseDEtat(a.page)).toContainText(/Maintenance annoncée le/, { timeout: 45_000 });
    expect(await lireLeJournal(b.contexte.request, { from: debut, action: "MAINTENANCE_CHANGED" }), "une ligne : l'écriture réussie de B").toHaveLength(1);

    /* 2 à 5. L'interrupteur d'environnement du gateway. */
    const avantForcage = new Date().toISOString();
    try {
      await relancerLeGateway(true);
      await ouvrirStatut(a.page);
      await expect(editeur(a.page).getByText("forcée par l'environnement du gateway")).toBeVisible({ timeout: 45_000 });
      expect((await lire(a.contexte)).envOverride, "l'état lu dit que le gateway est forcé (et c'est le gateway qui le sait)").toBe(true);
      /* Lever depuis l'écran : impossible — l'écran l'explique et le serveur refuse s'il est appelé quand même. */
      await expect(editeur(a.page).getByText(/L'environnement du gateway force la lecture seule/)).toBeVisible();
      await expect(editeur(a.page).getByRole("button", { name: /Lever la maintenance|Enregistrer l'annonce|Passer en lecture seule/ })).toHaveCount(0);
      const force = await a.contexte.request.put(`${apiAdmin()}/admin/maintenance`, { data: { enabled: false, messageFr: "", messageEn: "", scheduledAt: null, reason: MOTIF_DE_RECETTE("ADM-MNT-4 env"), expectedVersion: (await lire(a.contexte)).version } });
      expect(force.status()).toBe(409);
      expect(((await force.json()) as { details?: { code?: string } }).details?.code).toBe("MAINTENANCE_FORCED_BY_ENVIRONMENT");
      const publique = (await (await fetch("http://localhost:8080/api/maintenance")).json()) as EtatPublic;
      expect(publique.enabled, "l'environnement l'emporte sur la base").toBe(true);
      expect(await lireLeJournal(b.contexte.request, { from: avantForcage, action: "MAINTENANCE_CHANGED" }), "l'interrupteur n'écrit rien au journal").toHaveLength(0);
    } finally {
      await relancerLeGateway(false);
    }
    await ouvrirStatut(a.page);
    await expect(editeur(a.page).getByText("forcée par l'environnement du gateway")).toHaveCount(0, { timeout: 45_000 });

    /* 6. Support : lit la page, pas de formulaire. */
    const support = await navigateurAdmin("support");
    await ouvrirStatut(support.page);
    await expect(editeur(support.page)).toContainText("Profil Exploitation ou super administrateur pour modifier.");
    await expect(editeur(support.page).locator("textarea")).toHaveCount(0);
    remettreAPlat();
  });

  test("ADM-MNT-5 · trois enregistrements simultanés (document présent puis absent) : un 200, deux 409, une ligne", async ({ navigateurAdmin }) => {
    test.setTimeout(4 * 60_000);
    const ops = await navigateurAdmin("exploitation");
    const sup = await navigateurAdmin("super"); // le journal : l'Exploitation ne le lit pas (audit.read)
    for (const cas of ["présent", "absent"] as const) {
      if (cas === "absent") supprimerLeDocument();
      const debut = await debutDuScenario();
      const version = (await lire(ops.contexte)).version;
      const statuts = await Promise.all([0, 1, 2].map((i) => ops.contexte.request.put(`${apiAdmin()}/admin/maintenance`, { data: { enabled: false, messageFr: `Course ${i}`, messageEn: "", scheduledAt: new Date(Date.now() + 3_600_000).toISOString(), reason: MOTIF_DE_RECETTE(`ADM-MNT-5 ${cas} ${i}`), expectedVersion: version } }).then((r) => r.status())));
      expect(statuts.sort(), `document ${cas} : ${statuts}`).toEqual([200, 409, 409]);
      expect(await lireLeJournal(sup.contexte.request, { from: debut, action: "MAINTENANCE_CHANGED" }), `document ${cas}`).toHaveLength(1);
    }
    remettreAPlat();
  });

  test("ADM-MNT-6 · une annonce dans le passé est refusée, en français ; le formulaire ne se vide pas pendant la saisie", async ({ navigateurAdmin }) => {
    test.setTimeout(4 * 60_000);
    const ops = await navigateurAdmin("exploitation");
    const sup = await navigateurAdmin("super"); // le journal : l'Exploitation ne le lit pas (audit.read)
    remettreAPlat();
    const debut = await debutDuScenario();
    const avant = await lire(ops.contexte);
    const api400 = await ops.contexte.request.put(`${apiAdmin()}/admin/maintenance`, { data: { enabled: false, messageFr: "", messageEn: "", scheduledAt: new Date(Date.now() - 3_600_000).toISOString(), reason: MOTIF_DE_RECETTE("ADM-MNT-6"), expectedVersion: avant.version } });
    expect(api400.status()).toBe(400);
    expect(((await api400.json()) as { details?: { code?: string } }).details?.code).toBe("MAINTENANCE_SCHEDULE_IN_PAST");

    await ouvrirStatut(ops.page);
    /* Une saisie qui dure plus qu'un sondage (30 s) : elle tient. */
    const ed = editeur(ops.page);
    await ed.getByLabel("Message FR").fill("Saisie longue de recette ADM-MNT-6.");
    await ed.locator('input[type="datetime-local"]').fill(pourChampLocal(new Date(Date.now() - 2 * 3_600_000)));
    const relu = ops.page.waitForResponse((r) => /\/api\/admin\/status$/.test(r.url()), { timeout: 45_000 });
    await relu;
    await ops.page.waitForTimeout(500);
    await expect(ed.getByLabel("Message FR"), "le sondage ne vide pas le formulaire").toHaveValue("Saisie longue de recette ADM-MNT-6.");
    const r = await enregistrer(ops.page, { motif: MOTIF_DE_RECETTE("ADM-MNT-6 écran") }, /^Enregistrer l'annonce$/);
    expect(r.status()).toBe(400);
    await expect(ed).toContainText("La date annoncée est déjà passée : choisis une date à venir.");
    await expect(ed).not.toContainText(/400 :|Invalid|scheduled/);
    expect(await lireLeJournal(sup.contexte.request, { from: debut, action: "MAINTENANCE_CHANGED" })).toHaveLength(0);
    expect((await lire(ops.contexte)).version).toBe(avant.version);
  });
  /* ── Lots décidés au § 5.23, livrés au § 5.24 ────────────────────────────────────────────── */

  test("ADM-MNT-7 · le bandeau membre relit toutes les 15 s quand une maintenance est annoncée, toutes les 60 s sinon (lot b)", async ({ navigateurAdmin, navigateurConnecte }) => {
    test.setTimeout(5 * 60_000);
    const ops = await navigateurAdmin("exploitation");
    const membre = await navigateurConnecte("pauline");
    const lectures: number[] = [];
    membre.page.on("request", (r) => {
      if (/\/api\/maintenance$/.test(new URL(r.url()).pathname)) lectures.push(Date.now());
    });
    try {
      /* Sans maintenance : après la lecture d'ouverture, aucune relecture avant 60 s. */
      await membre.page.goto("/fr/dashboard/home", { waitUntil: "domcontentloaded" });
      await expect.poll(() => lectures.length, { timeout: 60_000 }).toBeGreaterThan(0);
      const ouverture = lectures.length;
      await membre.page.waitForTimeout(25_000);
      expect(lectures.length, "au repos : pas de relecture avant 60 s").toBe(ouverture);

      /* Une annonce : le bandeau ambre apparaît, puis relit toutes les 15 s. */
      const pose = await ops.contexte.request.put(`${apiAdmin()}/admin/maintenance`, { data: { enabled: false, messageFr: "Recette ADM-MNT-7.", messageEn: "", scheduledAt: new Date(Date.now() + 2 * 3_600_000).toISOString(), reason: MOTIF_DE_RECETTE("ADM-MNT-7"), expectedVersion: (await lire(ops.contexte)).version } });
      expect(pose.status(), await pose.text()).toBe(200);
      await attendreLaPasserelle(membre.contexte, (e) => !!e.scheduledAt, "l'annonce");
      await membre.page.reload({ waitUntil: "domcontentloaded" });
      await expect(bandeauMembre(membre.page)).toBeVisible({ timeout: 60_000 });
      const depart = lectures.length;
      await expect.poll(() => lectures.length - depart, { timeout: 50_000, intervals: [1_000] }).toBeGreaterThanOrEqual(3);
      const ecarts = lectures.slice(-3).map((t, i, a) => (i ? t - a[i - 1] : null)).filter((x): x is number => x !== null);
      for (const e of ecarts) expect(e, `écart entre deux relectures : ${e} ms`).toBeGreaterThanOrEqual(13_000), expect(e).toBeLessThanOrEqual(18_000);
    } finally {
      remettreAPlat();
    }
  });

  test("ADM-MNT-8 · l'exemption se compare par segment : /api/maintenanceX et /api/authentic… sont bloqués (lot c)", async ({ navigateurAdmin, navigateurConnecte }) => {
    test.setTimeout(4 * 60_000);
    const ops = await navigateurAdmin("exploitation");
    const membre = await navigateurConnecte("pauline");
    try {
      const pose = await ops.contexte.request.put(`${apiAdmin()}/admin/maintenance`, { data: { enabled: true, messageFr: "Recette ADM-MNT-8.", messageEn: "", scheduledAt: null, reason: MOTIF_DE_RECETTE("ADM-MNT-8"), expectedVersion: (await lire(ops.contexte)).version } });
      expect(pose.status(), await pose.text()).toBe(200);
      await attendreLaPasserelle(membre.contexte, (e) => e.enabled, "la lecture seule");
      for (const chemin of ["/maintenanceX", "/maintenance-recette/1", "/authentic/deals", "/administration"]) {
        const r = await membre.contexte.request.post(`${api()}${chemin}`, { data: {}, failOnStatusCode: false });
        expect(r.status(), `POST /api${chemin} passe la lecture seule`).toBe(503);
      }
      /* Les vrais préfixes restent ouverts. */
      expect((await membre.contexte.request.post(`${api()}/auth/refresh`, { failOnStatusCode: false })).status()).not.toBe(503);
      expect((await ops.contexte.request.get(`${apiAdmin()}/admin/maintenance`)).status()).toBe(200);
    } finally {
      remettreAPlat();
    }
    await attendreLaPasserelle(membre.contexte, (e) => !e.enabled, "la levée");
  });
});
