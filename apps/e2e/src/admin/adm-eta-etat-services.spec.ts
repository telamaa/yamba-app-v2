/**
 * adm-eta-etat-services.spec.ts — cahier 02-ADMIN, § 5.22 « État des services » (ADM-ETA-1 à 3) + fiches ajoutées
 * ================================================================================================================
 * La page n'est pas un outil de supervision, mais c'est le premier endroit où l'exploitation regarde. Le chapitre se juge
 * à quatre promesses :
 *  - **ce qui est dit est vrai** : six services, leurs dépendances, et une panne réelle (un service arrêté) passe en rouge ;
 *  - **un cron qui manque se voit** (A178 : catalogue des treize crons, absents et retards calculés côté serveur) ;
 *  - **l'outbox ne perd rien** : Redpanda coupé, les événements attendent puis repartent ; un poison est parqué, en rouge ;
 *  - **les compteurs suivent la vie réelle d'un email** (A177) et le seuil « parqué » ne dépasse jamais le relais (A176).
 * Les manœuvres (service arrêté, Redpanda coupé, battement vieilli, email passé DELIVERED) sont remises en place en `finally`.
 */
import { execSync, spawn } from "node:child_process";
import { openSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test, expect, type NavigateurAdmin } from "../fixtures/yamba";
import { adresseDeLApiAdmin, adresseDuBackOffice } from "../fixtures/adresses";
import { lireLeJournal } from "../pages/journal-admin";
import { debutDuScenario, lireCoteServeur, MOTIF_DE_RECETTE } from "../pages/ecran-admin";

const api = () => adresseDeLApiAdmin();
const bo = () => adresseDuBackOffice();
const RACINE = join(__dirname, "../../../..");
type Page = NavigateurAdmin["page"];
type Contexte = NavigateurAdmin["contexte"];
type Statut = {
  at: string;
  services: Array<{ name: string; reachable: boolean; report: { status: string; checks: Record<string, { ok: boolean }> } | null }>;
  crons: Array<{ service: string; name: string; late: boolean; ok: boolean }>;
  missingCrons: Array<{ service: string; name: string }>;
  outbox: { unpublished: number; oldestUnpublishedAt: string | null; parked: number; parkedThreshold: number };
  emails: { sentLast24h: number; deliveredLast24h: number; bouncedLast24h: number; failedLast24h: number };
};

const SIX = ["api-gateway", "auth-service", "trip-service", "deal-service", "notification-service", "message-service"];
const TREIZE = [
  "auth-service:onboarding-reminder", "deal-service:expire-bookings", "deal-service:ops-alerts", "deal-service:ops-digest", "deal-service:outbox-retention",
  "deal-service:payout-bookings", "deal-service:rating", "deal-service:recipient-redaction", "message-service:conversation-retention",
  "message-service:outbox-retention", "message-service:unread-reminder", "notification-service:retention", "trip-service:complete-trips",
];

const lireStatut = async (ctx: Contexte): Promise<Statut> => {
  const r = await ctx.request.get(`${api()}/admin/status`);
  expect(r.status()).toBe(200);
  return (await r.json()) as Statut;
};
const bandeau = (page: Page) => page.locator("p").filter({ hasText: /Relu il y a/ }).first();
const carte = (page: Page, nom: string) => page.locator("section").filter({ has: page.getByRole("heading", { name: "Services" }) }).locator("div.rounded-xl").filter({ has: page.locator("b", { hasText: new RegExp(`^${nom}$`) }) });
const blocOutbox = (page: Page) => page.locator("div.rounded-xl").filter({ has: page.locator("b", { hasText: /^Outbox$/ }) });
const blocEmails = (page: Page) => page.locator("div.rounded-xl").filter({ has: page.locator("b", { hasText: /^Emails \(24 h\)$/ }) });
const ouvrir = async (page: Page) => {
  await page.goto(`${bo()}/status`, { waitUntil: "domcontentloaded" });
  await expect(bandeau(page)).toBeVisible({ timeout: 60_000 });
};
const age = async (page: Page) => Number(/Relu il y a (\d+) s/.exec(await bandeau(page).innerText())?.[1] ?? "-1");

/** PID du processus qui écoute un port (bundle détaché du poste). */
const pidDuPort = (port: number) => execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t || true`, { encoding: "utf-8" }).trim().split("\n").filter(Boolean)[0] ?? null;
const santeOk = async (url: string) => {
  try { return (await fetch(url, { signal: AbortSignal.timeout(2_000) })).status === 200; } catch { return false; }
};
/** Relance message-service en bundle détaché, comme au poste (le processus survit à la fiche). */
async function relancerMessageService(): Promise<void> {
  if (await santeOk("http://localhost:6005/health")) return;
  const log = openSync(join(tmpdir(), "yamba-recette-eta-message-service.log"), "a");
  spawn("node", ["--env-file=../../.env", "dist/main.js"], { cwd: join(RACINE, "apps/message-service"), detached: true, stdio: ["ignore", log, log] }).unref();
  await expect.poll(() => santeOk("http://localhost:6005/health"), { timeout: 90_000, intervals: [2_000] }).toBe(true);
}
const redis = (script: string) => lireCoteServeur(`import redis from "./packages/libs/redis"; (async () => { ${script}; process.exit(0); })();`);

test.describe("ADM-ETA — état des services (cahier 02-ADMIN § 5.22)", () => {
  test("ADM-ETA-1 · six services, leurs dépendances, une panne réelle en rouge, et aucune ligne de journal", async ({ navigateurAdmin }) => {
    test.setTimeout(6 * 60_000);
    const { page, contexte } = await navigateurAdmin("support"); // status.read : ouvert à tous les profils
    const moi = (await (await contexte.request.get(`${api()}/admin/me`)).json()) as { id: string };
    const debut = await debutDuScenario();
    const relectures: number[] = [];
    page.on("request", (r) => { if (/\/api\/admin\/status$/.test(r.url())) relectures.push(Date.now()); });

    /* 1. Bandeau de synthèse et sous-titre. */
    await ouvrir(page);
    await expect(bandeau(page)).toContainText("Tous les services répondent et leurs dépendances sont saines.");
    await expect(bandeau(page)).toHaveClass(/emerald/);
    await expect(page.getByText(/Ce n'est pas un outil de supervision/)).toBeVisible();

    /* 2. Six cartes, vertes, version, démarrage, dépendances. */
    const noms = await page.locator("section").filter({ has: page.getByRole("heading", { name: "Services" }) }).locator("div.rounded-xl b").allInnerTexts();
    expect(noms).toEqual(SIX);
    for (const nom of SIX) {
      const c = carte(page, nom);
      await expect(c).toContainText(/OK · version \S+ · démarré il y a \d+ (s|min|h|j)/);
      await expect(c).not.toHaveClass(/red|amber/);
      if (nom !== "api-gateway") {
        await expect(c).toContainText(/✓ mongo \(\d+ ms\)/);
        await expect(c).toContainText(/✓ redis \(\d+ ms\)/);
      }
    }
    // Chaque /health répond 200, même dégradé : le code HTTP n'est pas le signal.
    for (const port of [6001, 6002, 6003, 6004, 6005]) expect(await santeOk(`http://localhost:${port}/health`), `:${port}/health`).toBe(true);

    /* 3. Relecture toutes les 30 s, et l'âge affiché grandit entre deux relectures (amélioration de la fiche). */
    const a0 = await age(page);
    await page.waitForTimeout(12_000);
    expect(await age(page), "« Relu il y a {n} s » n'est plus figé entre deux relectures").toBeGreaterThan(a0 + 5);
    await page.waitForTimeout(24_000);
    // En développement, React monte l'écran deux fois (StrictMode) : deux lectures à quelques ms. On compte les relectures espacées.
    const espacees = relectures.filter((t, i) => i === 0 || t - relectures[i - 1] > 1_000);
    expect(espacees.length, "une lecture initiale + une relecture à 30 s").toBeGreaterThanOrEqual(2);
    expect(espacees[1] - espacees[0]).toBeGreaterThan(25_000);

    /* 4-5. Arrêter message-service pour de vrai, puis le relancer. */
    const pid = pidDuPort(6005);
    expect(pid, "message-service écoute sur 6005").not.toBeNull();
    try {
      execSync(`kill ${pid}`);
      await expect.poll(() => santeOk("http://localhost:6005/health"), { timeout: 30_000 }).toBe(false);
      await expect(bandeau(page)).toContainText("1 service(s) en difficulté : message-service.", { timeout: 45_000 });
      await expect(bandeau(page)).toHaveClass(/red/);
      await expect(carte(page, "message-service")).toContainText(/Injoignable — /);
      await expect(carte(page, "message-service")).toHaveClass(/red/);
    } finally {
      await relancerMessageService();
    }
    await expect(bandeau(page)).toContainText("Tous les services répondent", { timeout: 45_000 });

    /* Une dépendance en panne → carte ambre « Dégradé » (manœuvre : réponse de l'API réécrite, Redis n'est pas coupé). */
    await page.route("**/api/admin/status", async (route) => {
      const r = await route.fetch();
      const corps = (await r.json()) as { services: Array<{ name: string; report: { status: string; checks: Record<string, unknown> } }> };
      const trip = corps.services.find((s) => s.name === "trip-service")!;
      trip.report.status = "degraded";
      trip.report.checks.redis = { ok: false, ms: 2001, error: "timeout after 2000 ms" };
      await route.fulfill({ response: r, json: corps });
    });
    await ouvrir(page);
    await expect(carte(page, "trip-service")).toHaveClass(/amber/);
    await expect(carte(page, "trip-service")).toContainText("Dégradé");
    await expect(carte(page, "trip-service")).toContainText("✗ redis (2001 ms) — timeout after 2000 ms");
    await page.unroute("**/api/admin/status");

    /* Ligne de journal attendue : aucune. */
    const sup = await navigateurAdmin("super"); // le journal ne se lit pas avec le profil Support
    const lignes = (await lireLeJournal(sup.contexte.request, { from: debut, adminUserId: moi.id })).filter((l) => l.action !== "ADMIN_LOGIN");
    expect(lignes.map((l) => l.action)).toEqual([]);
  });

  test("ADM-ETA-2 · treize battements, l'état vide, « en retard ? » et le cron absent (A178)", async ({ navigateurAdmin }) => {
    test.setTimeout(4 * 60_000);
    const { page, contexte } = await navigateurAdmin("exploitation");
    const statut = await lireStatut(contexte);
    /* 3. Les treize crons ont laissé un battement (le poste tourne depuis plus d'une nuit). */
    expect(statut.crons.map((c) => `${c.service}:${c.name}`).sort()).toEqual([...TREIZE].sort());
    expect(statut.missingCrons).toEqual([]);

    /* 1. Colonnes. */
    await ouvrir(page);
    const section = page.locator("section").filter({ has: page.getByRole("heading", { name: "Crons — dernier battement" }) });
    expect((await section.locator("thead th").allInnerTexts()).map((t) => t.trim().toLowerCase())).toEqual(["service", "cron", "dernier passage", "durée", "résultat"]);
    await expect(section.locator("tbody tr")).toHaveCount(13);

    const cle = (s: string, n: string) => `yamba:cron:${s}:${n}`;
    const garde = redis(`const v = await redis.get(${JSON.stringify(cle("deal-service", "expire-bookings"))}); const w = await redis.get(${JSON.stringify(cle("trip-service", "complete-trips"))}); console.log("@@" + JSON.stringify({ v, w }))`) as { v: string; w: string };
    try {
      /* 4. « en retard ? » : un battement de cron « toutes les 5 min » vieilli à 11 minutes (manœuvre Redis). */
      const vieux = { ...JSON.parse(garde.v), ranAt: new Date(Date.now() - 11 * 60_000).toISOString() };
      redis(`await redis.set(${JSON.stringify(cle("deal-service", "expire-bookings"))}, ${JSON.stringify(JSON.stringify(vieux))}, "EX", 604800)`);
      /* Cron absent : le battement de complete-trips retiré (comme un cron jamais passé ou non enveloppé). */
      redis(`await redis.del(${JSON.stringify(cle("trip-service", "complete-trips"))})`);
      const apres = await lireStatut(contexte);
      expect(apres.crons.find((c) => c.name === "expire-bookings")?.late).toBe(true);
      expect(apres.missingCrons).toEqual([expect.objectContaining({ service: "trip-service", name: "complete-trips" })]);
      await ouvrir(page);
      const ligne = section.locator("tbody tr").filter({ hasText: "expire-bookings" });
      await expect(ligne).toContainText("en retard ?");
      await expect(ligne).toHaveClass(/amber/);
      await expect(section.getByText("1 cron(s) attendu(s) sans battement depuis 7 jours : trip-service · complete-trips. Un cron qui ne laisse pas de battement est invisible ici.", { exact: true })).toBeVisible();
    } finally {
      redis(`await redis.set(${JSON.stringify(cle("trip-service", "complete-trips"))}, ${JSON.stringify(garde.w)}, "EX", 604800); const cur = await redis.get(${JSON.stringify(cle("deal-service", "expire-bookings"))}); if (cur && Date.now() - new Date(JSON.parse(cur).ranAt).getTime() > 600000) await redis.set(${JSON.stringify(cle("deal-service", "expire-bookings"))}, ${JSON.stringify(garde.v)}, "EX", 604800)`);
    }

    /* 2 et 5. L'état vide (manœuvre : réponse réécrite — vider Redis couperait les sessions de tout le poste). */
    await page.route("**/api/admin/status", async (route) => {
      const r = await route.fetch();
      await route.fulfill({ response: r, json: { ...(await r.json()), crons: [], missingCrons: [] } });
    });
    await ouvrir(page);
    await expect(page.getByText("Aucun battement enregistré : les crons n'ont pas encore tourné depuis le déploiement (ou Redis est vide).", { exact: true })).toBeVisible();
    await page.unroute("**/api/admin/status");
  });

  test("ADM-ETA-3 · l'outbox attend Redpanda sans rien perdre, le poison est parqué en rouge, les emails comptés", async ({ navigateurAdmin }) => {
    test.setTimeout(10 * 60_000);
    const { page, contexte } = await navigateurAdmin("exploitation");
    const avant = await lireStatut(contexte);
    const enBase = lireCoteServeur<{ unpublished: number; parked: number }>(`
      import prisma from "./packages/libs/prisma";
      (async () => {
        const nonPublie = { OR: [{ publishedAt: null }, { publishedAt: { isSet: false } }] } as never;
        const unpublished = await prisma.outboxEvent.count({ where: nonPublie });
        const parked = await prisma.outboxEvent.count({ where: { ...(nonPublie as object), attempts: { gte: 10 } } as never });
        console.log("@@" + JSON.stringify({ unpublished, parked }));
        process.exit(0);
      })();`);
    /* 1. Le bloc dit ce que la base contient. */
    expect({ unpublished: avant.outbox.unpublished, parked: avant.outbox.parked }).toEqual(enBase);
    await ouvrir(page);
    await expect(blocOutbox(page)).toContainText(`${avant.outbox.unpublished} événement(s) non publié(s)`);
    await expect(blocOutbox(page)).toContainText(`${avant.outbox.parked} parqué(s) (≥ ${avant.outbox.parkedThreshold} tentatives).`);

    try {
      /* 2-3. Redpanda arrêté, des écritures métier arrivent : elles attendent (seed-outbox = événements tirés de vrais deals). */
      execSync("docker stop yamba-redpanda", { stdio: "ignore" });
      execSync("npx tsx --env-file=.env packages/libs/prisma/scripts/seed-outbox.ts", { cwd: RACINE, stdio: "ignore", timeout: 120_000 });
      await page.waitForTimeout(8_000);
      const coupe = await lireStatut(contexte);
      expect(coupe.outbox.unpublished, "les événements écrits attendent le relais").toBeGreaterThanOrEqual(avant.outbox.unpublished + 6);
      expect(coupe.outbox.oldestUnpublishedAt).not.toBeNull();
      await ouvrir(page);
      await expect(blocOutbox(page)).toContainText(new RegExp(`${coupe.outbox.unpublished} événement\\(s\\) non publié\\(s\\), le plus ancien il y a`));

      /* 7. Redpanda relancé : les événements repartent d'eux-mêmes. */
      execSync("docker start yamba-redpanda", { stdio: "ignore" });
      await expect.poll(async () => (await lireStatut(contexte)).outbox.unpublished, { timeout: 4 * 60_000, intervals: [5_000] }).toBeLessThanOrEqual(avant.outbox.unpublished);

      /* 4-5. Un poison : le relais l'essaie dix fois, le parque, le compteur passe au rouge. */
      execSync("npx tsx --env-file=.env packages/libs/prisma/scripts/seed-outbox.ts --with-poison", { cwd: RACINE, stdio: "ignore", timeout: 120_000 });
      await expect.poll(async () => (await lireStatut(contexte)).outbox.parked, { timeout: 4 * 60_000, intervals: [5_000] }).toBeGreaterThanOrEqual(avant.outbox.parked + 1);
      await ouvrir(page);
      const ligneParquee = blocOutbox(page).locator("p").filter({ hasText: "parqué(s)" });
      await expect(ligneParquee).toHaveClass(/red/);
    } finally {
      execSync("docker start yamba-redpanda", { stdio: "ignore" });
      lireCoteServeur(`import prisma from "./packages/libs/prisma"; (async () => { const r = await prisma.outboxEvent.deleteMany({ where: { correlationId: "seed-outbox" } }); console.log("@@" + r.count); process.exit(0); })();`);
    }

    /* 6. Emails (24 h). */
    const statut = await lireStatut(contexte);
    await ouvrir(page);
    await expect(blocEmails(page)).toContainText(`${statut.emails.sentLast24h} envoyé(s), dont ${statut.emails.deliveredLast24h} remis`);
    await expect(blocEmails(page)).toContainText(`${statut.emails.failedLast24h} en échec`);
  });

  test("ADM-ETA-4 · un email remis ou rebondi reste un email envoyé ; un rebond se voit en rouge (A177, ANO-ADM-61)", async ({ navigateurAdmin }) => {
    test.setTimeout(3 * 60_000);
    const { page, contexte } = await navigateurAdmin("exploitation");
    const cible = lireCoteServeur<{ id: string } | null>(`import prisma from "./packages/libs/prisma"; (async () => { const e = await prisma.emailDelivery.findFirst({ where: { status: "SENT", claimedAt: { gte: new Date(Date.now() - 20 * 3600000) } }, select: { id: true } }); console.log("@@" + JSON.stringify(e)); process.exit(0); })();`);
    test.skip(!cible, "aucun email SENT des dernières 20 h au poste");
    const poser = (status: string) => lireCoteServeur(`import prisma from "./packages/libs/prisma"; (async () => { await prisma.emailDelivery.update({ where: { id: ${JSON.stringify(cible!.id)} }, data: { status: ${JSON.stringify(status)} as never } }); console.log("@@1"); process.exit(0); })();`);
    // Des emails partent pendant la fiche (crons, consommateur) : on attend deux lectures identiques à 5 s d'écart.
    let avant = await lireStatut(contexte);
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(5_000);
      const encore = await lireStatut(contexte);
      if (JSON.stringify(encore.emails) === JSON.stringify(avant.emails)) break;
      avant = encore;
    }
    try {
      poser("DELIVERED"); // ce que fait le webhook du fournisseur (D35)
      const remis = await lireStatut(contexte);
      expect(remis.emails.sentLast24h, "un email remis ne sort pas des « envoyés »").toBe(avant.emails.sentLast24h);
      expect(remis.emails.deliveredLast24h).toBe(avant.emails.deliveredLast24h + 1);
      poser("BOUNCED");
      const rebond = await lireStatut(contexte);
      expect(rebond.emails.sentLast24h).toBe(avant.emails.sentLast24h);
      expect(rebond.emails.bouncedLast24h).toBe(avant.emails.bouncedLast24h + 1);
      await ouvrir(page);
      const ligne = blocEmails(page).locator("p").filter({ hasText: "rebond(s) ou plainte(s)" });
      await expect(ligne).toHaveText(`${rebond.emails.bouncedLast24h} rebond(s) ou plainte(s)`);
      await expect(ligne).toHaveClass(/red/);
    } finally {
      poser("SENT");
    }
  });

  test("ADM-ETA-5 · le seuil « parqué » ne dépasse jamais le parking du relais (A176, ANO-ADM-62)", async ({ navigateurAdmin }) => {
    test.setTimeout(3 * 60_000);
    const { contexte } = await navigateurAdmin("exploitation");
    const reglages = (await (await contexte.request.get(`${api()}/admin/settings`)).json()) as { version: number; catalog: Array<{ key: string; max: number }> };
    expect(reglages.catalog.find((c) => c.key === "alerts.outboxParkedAttempts")?.max).toBe(10);
    const refus = await contexte.request.patch(`${api()}/admin/settings`, { data: { changes: { "alerts.outboxParkedAttempts": 20 }, reason: MOTIF_DE_RECETTE("ADM-ETA-5"), expectedVersion: reglages.version }, failOnStatusCode: false });
    expect(refus.status(), "au-delà du relais, le seuil n'est pas enregistrable").toBe(400);
    // Une valeur déjà stockée hors bornes (avant le correctif) : ramenée à 10 à la lecture, jamais 20 (manœuvre base, remise en place).
    const garde = lireCoteServeur<{ values: Record<string, number> }>(`import prisma from "./packages/libs/prisma"; (async () => { const d = await prisma.platformSettings.findFirst({ where: { key: "current" }, select: { values: true } }); console.log("@@" + JSON.stringify(d ?? { values: {} })); process.exit(0); })();`);
    const ecrireValeurs = (values: Record<string, number>) => lireCoteServeur(`import prisma from "./packages/libs/prisma"; (async () => { await prisma.platformSettings.updateMany({ where: { key: "current" }, data: { values: ${JSON.stringify(values)} } }); console.log("@@1"); process.exit(0); })();`);
    try {
      ecrireValeurs({ ...garde.values, "alerts.outboxParkedAttempts": 20 });
      await expect.poll(async () => (await lireStatut(contexte)).outbox.parkedThreshold, { timeout: 45_000, intervals: [3_000] }).toBe(10); // cache de 30 s
    } finally {
      ecrireValeurs(garde.values);
    }
  });

  test("ADM-ETA-6 · une maintenance planifiée n'est pas une panne : aucune croix rouge sur la passerelle", async ({ navigateurAdmin }) => {
    test.setTimeout(2 * 60_000);
    const { page } = await navigateurAdmin("exploitation");
    await page.route("**/api/admin/status", async (route) => {
      const r = await route.fetch();
      const corps = (await r.json()) as { services: Array<{ name: string; report: { checks: Record<string, unknown> } }>; maintenance: { enabled: boolean } };
      corps.services.find((s) => s.name === "api-gateway")!.report.checks.maintenance = { ok: false, ms: 0, error: "maintenance (settings)" };
      corps.maintenance.enabled = true;
      await route.fulfill({ response: r, json: corps });
    });
    await ouvrir(page);
    const passerelle = carte(page, "api-gateway");
    await expect(passerelle).toContainText("⏸ maintenance : lecture seule planifiée");
    await expect(passerelle.locator("li.text-red-800")).toHaveCount(0);
    await expect(bandeau(page)).toContainText("Maintenance en cours : la plateforme est en lecture seule.");
    await page.unroute("**/api/admin/status");
  });

  test("ADM-ETA-7 · tous les profils lisent la page ; une relecture en échec se dit en français", async ({ navigateurAdmin }) => {
    test.setTimeout(4 * 60_000);
    for (const profil of ["mediateur", "finance", "privacy"] as const) {
      const { contexte } = await navigateurAdmin(profil);
      expect((await contexte.request.get(`${api()}/admin/status`)).status(), profil).toBe(200);
    }
    const { page } = await navigateurAdmin("finance");
    await page.route("**/api/admin/status", (route) => route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ message: "Bad gateway" }) }));
    await page.goto(`${bo()}/status`, { waitUntil: "domcontentloaded" });
    const alerte = page.getByRole("alert").filter({ hasText: "État des services illisible" });
    await expect(alerte).toHaveText("État des services illisible : le serveur n'a pas répondu. Nouvel essai dans 30 secondes.", { timeout: 60_000 });
    await expect(page.getByText(/Bad gateway|502 :/)).toHaveCount(0);
    await page.unroute("**/api/admin/status");
  });
});
