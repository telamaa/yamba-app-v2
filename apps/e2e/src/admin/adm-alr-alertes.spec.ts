/**
 * adm-alr-alertes.spec.ts — cahier 02-ADMIN, § 5.2 « Alertes de seuil » (ADM-ALR-1 à 4)
 * ======================================================================================
 * Les alertes n'ont pas d'état : neuf règles pures (`ops-alerts.rules.ts`) recalculées à chaque lecture, avec des seuils
 * lus dans les paramètres (cache de 30 s côté deal-service). D'où le parti pris de ces fiches : **on pilote une alerte
 * par son seuil**, depuis l'écran Paramètres ou son API, et on vérifie qu'elle apparaît puis disparaît d'elle-même.
 *
 * Constat qui conditionne tout le chapitre (mesuré avant d'écrire la fiche) : le jeu d'essai pose le versement en échec
 * terminé à J−3, il franchit donc DÉJÀ le seuil par défaut de 48 h — le cahier le croit « en échec depuis 24 h ». L'état
 * vide d'ALR-1 et l'« apparition » d'ALR-2 se prouvent donc en RELEVANT d'abord le seuil (écart documentaire consigné).
 *
 * Chaque seuil touché est rétabli dans un `finally`.
 */
import { test, expect, type NavigateurAdmin } from "../fixtures/yamba";
import { JeuEssai } from "../fixtures/jeu-essai";
import { adresseDeLApiAdmin, adresseDuBackOffice } from "../fixtures/adresses";
import { lireLeJournal } from "../pages/journal-admin";
import { attendreLeChargement, debutDuScenario, lireCoteServeur, MOTIF_DE_RECETTE } from "../pages/ecran-admin";

const api = () => adresseDeLApiAdmin();
const bo = () => adresseDuBackOffice();

type Contexte = NavigateurAdmin["contexte"];
type Alerte = { rule: string; severity: "critical" | "warning"; title: string; detail: string; count: number | null; href: string };
type Reglages = { version: number; values: Record<string, number>; defaults: Record<string, number> };

const SUPPORT = process.env.SUPPORT_EMAIL ?? "support@yamba.app";

const lireReglages = async (ctx: Contexte): Promise<Reglages> => (await (await ctx.request.get(`${api()}/admin/settings`)).json()) as Reglages;

/** Pose des seuils par l'API de l'écran Paramètres (seules les clés qui changent partent). */
async function poserSeuils(ctx: Contexte, voulus: Record<string, number>, motif: string): Promise<void> {
  const cur = await lireReglages(ctx);
  const changes = Object.fromEntries(Object.entries(voulus).filter(([k, v]) => cur.values[k] !== v));
  if (Object.keys(changes).length === 0) return;
  const r = await ctx.request.patch(`${api()}/admin/settings`, { data: { changes, reason: motif, expectedVersion: cur.version } });
  expect(r.ok(), `PATCH /admin/settings ${JSON.stringify(changes)} : ${r.status()} ${r.ok() ? "" : await r.text()}`).toBe(true);
}

/** Remet les clés à leur valeur par défaut (nettoyage de fin de fiche). */
async function retablir(ctx: Contexte, cles: string[], motif: string): Promise<void> {
  const cur = await lireReglages(ctx);
  await poserSeuils(ctx, Object.fromEntries(cles.map((k) => [k, cur.defaults[k]])), motif);
}

/** Les alertes servies, en attendant que le cache des paramètres (30 s) ait vu le dernier seuil. */
async function alertesQuand(ctx: Contexte, condition: (a: Alerte[]) => boolean, message: string): Promise<Alerte[]> {
  let dernieres: Alerte[] = [];
  await expect
    .poll(async () => {
      dernieres = ((await (await ctx.request.get(`${api()}/admin/alerts`)).json()) as { alerts: Alerte[] }).alerts;
      return condition(dernieres);
    }, { timeout: 60_000, intervals: [3_000], message })
    .toBe(true);
  return dernieres;
}

const regles = (a: Alerte[]) => a.map((x) => x.rule);

test.describe("ADM-ALR — alertes de seuil (cahier 02-ADMIN § 5.2)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(() => {
    new JeuEssai().rejouer();
  });

  test("ADM-ALR-1 · la page existe et vit seule", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    const ops = await navigateurAdmin("exploitation");
    const lecteur = await navigateurAdmin("mediateur");
    const journal = await navigateurAdmin("finance");
    const cle = "alerts.payoutFailedHours";
    const initiales = ((await (await lecteur.contexte.request.get(`${api()}/admin/alerts`)).json()) as { alerts: Alerte[] }).alerts;
    test.info().annotations.push({ type: "constat", description: `jeu d'essai neuf, seuils par défaut : ${regles(initiales).join(", ") || "aucune alerte"}` });
    try {
      /* L'état vide exige de relever le seuil que le jeu d'essai franchit déjà (voir l'en-tête). */
      await poserSeuils(ops.contexte, { [cle]: 336 }, MOTIF_DE_RECETTE("ADM-ALR-1"));
      await alertesQuand(lecteur.contexte, (a) => a.length === 0, "plus aucune alerte une fois le seuil relevé à 336 h");
      const debut = await debutDuScenario();
      /* 1. Par le menu. */
      const { page } = lecteur;
      await page.goto(`${bo()}/home`, { waitUntil: "domcontentloaded" });
      await page.locator("aside nav a", { hasText: /^Alertes$/ }).click();
      await expect(page).toHaveURL(/\/alerts$/, { timeout: 60_000 });
      /* 2. Titre et sous-titre. */
      await expect(page.getByRole("heading", { name: "Alertes de seuil", exact: true })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText("Neuf règles recalculées à chaque lecture, jamais stockées. Chaque alerte mène à l'écran où agir. Les seuils sont des paramètres : les changer change l'alerte, pas l'historique.", { exact: true })).toBeVisible();
      await attendreLeChargement(page);
      /* 3. L'état vide. */
      await expect(page.getByText("Aucune alerte : versements, litiges, relais d'événements, emails et publication sont dans les clous.", { exact: true })).toBeVisible();
      /* 4. Les seuils EN VIGUEUR : la valeur relevée (336), pas la constante du code (48). */
      const tableau = page.locator("table");
      await expect(tableau.locator("thead th")).toHaveText(["Paramètre", "Valeur"]);
      const lignes = Object.fromEntries((await tableau.locator("tbody tr").evaluateAll((trs) => trs.map((tr) => Array.from(tr.querySelectorAll("td")).map((td) => (td.textContent ?? "").trim())))).map(([k, v]) => [k, v]));
      const servis = ((await (await lecteur.contexte.request.get(`${api()}/admin/alerts`)).json()) as { thresholds: Record<string, number> }).thresholds;
      expect(Object.keys(lignes), "une ligne par seuil servi").toEqual(Object.keys(servis));
      for (const [k, v] of Object.entries(servis)) expect(lignes[k], `seuil ${k}`).toBe(String(v));
      expect(lignes.payoutFailedHours, "la valeur en vigueur, pas la constante 48").toBe("336");
      test.info().annotations.push({ type: "constat", description: `seuils affichés : ${Object.entries(lignes).map(([k, v]) => `${k} ${v}`).join(" · ")}` });
      await expect(page.getByText(/^Réglables dans Paramètres › Alertes d'exploitation\. Évaluées à la lecture, le \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2} ; le support reçoit un email à la première apparition d'une règle dans la journée\.$/)).toBeVisible();
      await expect(page.getByRole("link", { name: "Paramètres › Alertes d'exploitation" })).toHaveAttribute("href", "/settings");
      /* Journal : la lecture des alertes n'écrit rien. */
      const ecrites = await lireLeJournal(journal.contexte.request, { from: debut, adminUserId: jeuEssai.admin("mediateur").id });
      expect(ecrites.map((l) => l.action), "aucune ligne").toEqual([]);
    } finally {
      await retablir(ops.contexte, [cle], MOTIF_DE_RECETTE("ADM-ALR-1"));
    }
  });

  test("ADM-ALR-2 · faire apparaître une alerte en abaissant un seuil", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(8 * 60_000);
    const ops = await navigateurAdmin("exploitation");
    const lecteur = await navigateurAdmin("mediateur");
    const journal = await navigateurAdmin("finance");
    const cle = "alerts.payoutFailedHours";
    const motif = "Recette ADM-ALR-2 : abaissement temporaire du seuil";
    try {
      /* Point de départ du cahier : aucune alerte de versement. Le jeu d'essai la franchit déjà à 48 h → on part de 336. */
      await poserSeuils(ops.contexte, { [cle]: 336 }, MOTIF_DE_RECETTE("ADM-ALR-2"));
      await alertesQuand(lecteur.contexte, (a) => !regles(a).includes("PAYOUT_FAILED_48H"), "départ : pas d'alerte de versement");
      const debut = await debutDuScenario();
      /* 1-3. Session Exploitation, /settings, 336 → 1, motif du cahier, « Enregistrer ». */
      const { page } = ops;
      await page.goto(`${bo()}/settings`, { waitUntil: "domcontentloaded" });
      const champ = page.getByLabel("Versement en échec depuis", { exact: true });
      await expect(champ).toBeVisible({ timeout: 60_000 });
      await champ.fill("1");
      await page.getByPlaceholder("Pourquoi ce changement, pour qui le relira dans six mois.").fill(motif);
      const abaisse = page.waitForResponse((r) => r.url().includes("/admin/settings") && r.request().method() === "PATCH");
      await page.getByRole("button", { name: "Enregistrer (journalisé, email aux super administrateurs)" }).click();
      expect((await abaisse).ok(), "PATCH à 1 h").toBe(true);
      /* 4. Au plus 30 s, puis /alerts (lu par un autre profil à kpi.read). */
      await alertesQuand(lecteur.contexte, (a) => regles(a).includes("PAYOUT_FAILED_48H"), "l'alerte apparaît (cache ≤ 30 s)");
      const lp = lecteur.page;
      await lp.goto(`${bo()}/alerts`, { waitUntil: "domcontentloaded" });
      await attendreLeChargement(lp);
      const critiques = lp.locator("section").filter({ has: lp.getByRole("heading", { name: /^Critiques · \d+$/ }) });
      await expect(critiques.getByRole("heading"), "le groupe « Critiques · 1 »").toHaveText("Critiques · 1", { timeout: 30_000 });
      const carte = critiques.locator("li").filter({ hasText: "PAYOUT_FAILED_48H" });
      await expect(carte).toHaveCount(1);
      await expect(carte).toContainText("Versements non partis 1 h après la fin du deal"); // A198 (c)
      await expect(carte).toContainText("1 concerné");
      await expect(carte).toContainText("1 versement(s) rejoué(s) sans succès depuis plus de 1 h.");
      test.info().annotations.push({ type: "constat", description: `carte : « ${(await carte.innerText()).replace(/\s+/g, " ").trim()} » — le code garde « 48H » avec un seuil à 1 h (identifiant, pas une valeur : attendu)` });
      /* 5. « Aller traiter → ». */
      await carte.getByText("Aller traiter →").click();
      await expect(lp).toHaveURL(/\/finances\?kind=FAILED$/, { timeout: 60_000 });
      await expect(lp.getByRole("button", { name: "Versements en échec", exact: true }), "onglet présélectionné").toHaveClass(/bg-slate-900/, { timeout: 30_000 });
      /* 6. « remettre » puis « Enregistrer » → 48. */
      await page.reload({ waitUntil: "domcontentloaded" });
      const ligne = page.locator("tr").filter({ has: page.getByLabel("Versement en échec depuis", { exact: true }) });
      await ligne.getByRole("button", { name: "remettre", exact: true }).click();
      await expect(page.getByLabel("Versement en échec depuis", { exact: true })).toHaveValue("48");
      await page.getByPlaceholder("Pourquoi ce changement, pour qui le relira dans six mois.").fill("Recette ADM-ALR-2 : retour du seuil à sa valeur par défaut");
      const remis = page.waitForResponse((r) => r.url().includes("/admin/settings") && r.request().method() === "PATCH");
      await page.getByRole("button", { name: "Enregistrer (journalisé, email aux super administrateurs)" }).click();
      expect((await remis).ok(), "PATCH à 48 h").toBe(true);
      /* « L'alerte disparaît d'elle-même » : à 48 h, le versement du jeu d'essai (J−3) la garde. La disparition sans état
         se prouve en relevant le seuil au-delà de l'âge du versement. */
      const a48 = await alertesQuand(lecteur.contexte, (a) => a.every((x) => x.rule !== "PAYOUT_FAILED_48H" || /48 h/.test(x.title)), "le seuil de 48 h est lu");
      test.info().annotations.push({ type: "écart documentaire", description: `à 48 h, alerte ${regles(a48).includes("PAYOUT_FAILED_48H") ? "TOUJOURS présente (versement du jeu d'essai terminé à J−3, pas « depuis 24 h »)" : "absente"}` });
      /* Journal : deux SETTING_CHANGED, avant/après/motif/version. */
      const lignes = (await lireLeJournal(journal.contexte.request, { from: debut, adminUserId: jeuEssai.admin("exploitation").id })).filter((l) => l.action === "SETTING_CHANGED");
      expect(lignes.map((l) => `${l.targetType} · ${l.targetId}`), "deux lignes").toEqual([`SETTINGS · ${cle}`, `SETTINGS · ${cle}`]);
      expect(lignes[0].before).toMatchObject({ key: cle, value: 336 });
      expect(lignes[0].after).toMatchObject({ key: cle, value: 1, reason: motif });
      expect(lignes[1].before).toMatchObject({ key: cle, value: 1 });
      expect(lignes[1].after).toMatchObject({ key: cle, value: 48 });
      for (const l of lignes) {
        expect(typeof (l.before as { version?: unknown }).version, "before.version").toBe("number");
        expect((l.after as { version: number }).version, "after.version = before.version + 1").toBe((l.before as { version: number }).version + 1);
      }
    } finally {
      await retablir(ops.contexte, [cle], MOTIF_DE_RECETTE("ADM-ALR-2"));
    }
  });

  test("ADM-ALR-3 · l'email quotidien au support (cron forcé)", async ({ mailpit }) => {
    test.setTimeout(6 * 60_000);
    /* Le cron réel du deal-service passe à la minute 5 : on s'écarte de sa fenêtre pour ne pas se disputer la clé. */
    const minute = new Date().getMinutes();
    if (minute >= 3 && minute <= 7) await new Promise((r) => setTimeout(r, (8 - minute) * 60_000));
    const jour = new Date().toISOString().slice(0, 10);
    /* Précondition : une alerte active — le versement en échec du jeu d'essai, au seuil par défaut. */
    const actives = lireCoteServeur<string[]>(`
      import { opsAlertsService } from "./apps/deal-service/src/routes/deal.routes";
      (async () => { console.log("@@" + JSON.stringify((await opsAlertsService.evaluate()).alerts.map((a) => a.rule))); process.exit(0); })();`);
    expect(actives, "au moins une alerte active").toContain("PAYOUT_FAILED_48H");
    /* Manœuvre consignée : purge des verrous DU JOUR (le cron réel a pu envoyer ce matin). */
    const purges = lireCoteServeur<string[]>(`
      import redis from "./packages/libs/redis";
      (async () => { const k = await redis.keys("yamba:alerts:sent:*:${jour}"); for (const x of k) await redis.del(x); console.log("@@" + JSON.stringify(k)); process.exit(0); })();`);
    process.stdout.write(`   ↳ manœuvre Redis : verrous du ${jour} purgés (${purges.length}) — ADM-ALR-3\n`);
    const sujet = /^Yamba — \d+ alerte\(s\)/;
    const avant = await mailpit.compter({ pour: SUPPORT, sujet });
    /* Le passage du cron : la méthode que le cron appelle, avec le vrai Redis. */
    const passe = () => lireCoteServeur<string[]>(`
      import redis from "./packages/libs/redis";
      import { opsAlertsService } from "./apps/deal-service/src/routes/deal.routes";
      (async () => { console.log("@@" + JSON.stringify(await opsAlertsService.notifyNewAlerts(redis))); process.exit(0); })();`);
    const premiere = passe();
    expect(premiere, "premier passage : les règles nouvelles du jour").toEqual(actives);
    const email = await mailpit.attendreEmail({ pour: SUPPORT, sujet: new RegExp(`^Yamba — ${actives.length} alerte\\(s\\)`) }, 60_000);
    expect(await mailpit.compter({ pour: SUPPORT, sujet }), "UN email").toBe(avant + 1);
    expect(email.texte, "en français").toContain("Alertes de seuil");
    expect(email.texte).toContain("Versements non partis 48 h après la fin du deal"); // A198 (c)
    expect(email.texte, "un lien vers la file").toMatch(/\/finances\?kind=FAILED/);
    expect(email.texte, "la mention d'unicité").toContain("Chaque alerte n'est envoyée qu'une fois par jour");
    test.info().annotations.push({ type: "constat", description: `✉ « ${email.sujet} » → ${email.destinataire}` });
    /* La clé posée : SET NX, deux jours. */
    const verrou = lireCoteServeur<{ existe: number; ttl: number }>(`
      import redis from "./packages/libs/redis";
      (async () => { const k = "yamba:alerts:sent:PAYOUT_FAILED_48H:${jour}"; console.log("@@" + JSON.stringify({ existe: await redis.exists(k), ttl: await redis.ttl(k) })); process.exit(0); })();`);
    expect(verrou.existe, `clé yamba:alerts:sent:PAYOUT_FAILED_48H:${jour}`).toBe(1);
    expect(verrou.ttl, `TTL ≈ 2 jours (${verrou.ttl} s)`).toBeGreaterThan(2 * 86_400 - 300);
    /* Second passage, même jour : rien. */
    expect(passe(), "second passage : aucune règle nouvelle").toEqual([]);
    await new Promise((r) => setTimeout(r, 8_000));
    expect(await mailpit.compter({ pour: SUPPORT, sujet }), "aucun second email").toBe(avant + 1);
    /* « Le lendemain » : même service, horloge au lendemain, verrous d'AUJOURD'HUI présents dans un magasin en mémoire —
       la clé du lendemain est libre, l'alerte repart. Aucun email réel (magasin en mémoire, envoi coupé). */
    const lendemain = lireCoteServeur<{ cle: string; envoyees: string[] }>(`
      import { makeOpsAlertsService } from "./apps/deal-service/src/services/ops-alerts.service";
      import { alertSentKey } from "./apps/deal-service/src/services/ops-alerts.rules";
      (async () => {
        delete process.env.SMTP_HOST; delete process.env.RESEND_API_KEY; process.env.EMAIL_PROVIDER = "fake";
        const demain = new Date(Date.now() + 86_400_000);
        const deja = new Set(["yamba:alerts:sent:PAYOUT_FAILED_48H:${jour}"]);
        const store = { async set(k: string) { if (deja.has(k)) return null; deja.add(k); return "OK"; } };
        const envoyees = await makeOpsAlertsService(() => demain).notifyNewAlerts(store as never);
        console.log("@@" + JSON.stringify({ cle: alertSentKey("PAYOUT_FAILED_48H", demain), envoyees }));
        process.exit(0);
      })();`);
    expect(lendemain.cle, "la clé du lendemain diffère").not.toContain(jour);
    expect(lendemain.envoyees, "le lendemain, l'alerte toujours active repart").toContain("PAYOUT_FAILED_48H");
    expect(await mailpit.compter({ pour: SUPPORT, sujet }), "la simulation n'a rien envoyé pour de vrai").toBe(avant + 1);
    test.info().annotations.push({ type: "⏭ partiel", description: `« le lendemain » simulé (horloge +24 h, magasin en mémoire, envoi coupé) : clé ${lendemain.cle}` });
  });

  test("ADM-ALR-4 · les liens d'alerte mènent au bon filtre", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(8 * 60_000);
    const ops = await navigateurAdmin("exploitation");
    const lecteur = await navigateurAdmin("super");
    const journal = await navigateurAdmin("finance");
    /* Toutes les règles que le jeu d'essai PEUT franchir, seuils abaissés au minimum des bornes. */
    const seuils = {
      "alerts.payoutFailedHours": 1,
      "alerts.disputeUndecidedHours": 1,
      "alerts.retentionHeldDays": 1,
      "alerts.reversalOpenHours": 1,
      "alerts.outboxParkedAttempts": 1,
      "alerts.outboxLagMinutes": 1,
      "alerts.emailsFailedWindowHours": 168,
      "alerts.noTripPublishedDays": 1,
      "alerts.acceptanceRateWindowDays": 90,
      "alerts.acceptanceRateMinPct": 100,
      "alerts.acceptanceRateMinRequests": 1,
    };
    const DESTINATIONS: Record<string, { url: RegExp; filtre?: (p: NavigateurAdmin["page"]) => Promise<void> }> = {
      PAYOUT_FAILED_48H: { url: /\/finances\?kind=FAILED$/, filtre: async (p) => { await expect(p.getByRole("button", { name: "Versements en échec", exact: true })).toHaveClass(/bg-slate-900/, { timeout: 30_000 }); } },
      REVERSAL_OPEN_48H: { url: /\/finances\?kind=REVERSED$/, filtre: async (p) => { await expect(p.getByRole("button", { name: "Transferts renversés", exact: true })).toHaveClass(/bg-slate-900/, { timeout: 30_000 }); } },
      DISPUTE_UNDECIDED_72H: { url: /\/disputes\?decidable=1$/, filtre: async (p) => { await expect(p.locator("select").filter({ has: p.locator("option", { hasText: "décidables maintenant" }) })).toHaveValue("1", { timeout: 30_000 }); } },
      RETENTION_HELD_7D: { url: /\/disputes\?kind=RETENTION$/, filtre: async (p) => { await expect(p.locator("select").filter({ has: p.locator("option", { hasText: /^retenues$/ }) })).toHaveValue("RETENTION", { timeout: 30_000 }); } },
      OUTBOX_PARKED: { url: /\/pilotage$/ },
      OUTBOX_LAGGING_15MIN: { url: /\/pilotage$/ },
      EMAILS_FAILED_24H: { url: /\/pilotage$/ },
      NO_TRIP_PUBLISHED_7D: { url: /\/pilotage$/ },
      ACCEPTANCE_RATE_LOW_7D: { url: /\/pilotage$/ },
    };
    try {
      const debut = await debutDuScenario();
      await poserSeuils(ops.contexte, seuils, MOTIF_DE_RECETTE("ADM-ALR-4"));
      const alertes = await alertesQuand(lecteur.contexte, (a) => regles(a).includes("PAYOUT_FAILED_48H") && regles(a).includes("RETENTION_HELD_7D"), "les seuils abaissés sont lus");
      const cliquees = regles(alertes);
      test.info().annotations.push({ type: "constat", description: `règles franchies, seuils au minimum : ${cliquees.join(", ")}` });
      const { page } = lecteur;
      for (const regle of cliquees) {
        await page.goto(`${bo()}/alerts`, { waitUntil: "domcontentloaded" });
        await attendreLeChargement(page);
        await page.locator("li").filter({ hasText: regle }).getByText("Aller traiter →").click();
        const d = DESTINATIONS[regle];
        expect(d, `destination connue pour ${regle}`).toBeTruthy();
        await expect(page, `${regle} → ${d.url}`).toHaveURL(d.url, { timeout: 60_000 });
        await d.filtre?.(page);
      }
      /* Les règles que le jeu d'essai ne franchit pas : le lien n'est pas cliquable, on prouve la destination du cahier
         en l'ouvrant (c'est le point de non-régression : le filtre de /disputes part de l'URL). */
      const nonCliquees = Object.keys(DESTINATIONS).filter((r) => !cliquees.includes(r));
      for (const regle of nonCliquees.filter((r) => DESTINATIONS[r].filtre)) {
        const chemin = DESTINATIONS[regle].url.source.replace(/\\/g, "").replace(/^\//, "").replace(/\$$/, "");
        await page.goto(`${bo()}/${chemin}`, { waitUntil: "domcontentloaded" });
        await DESTINATIONS[regle].filtre!(page);
      }
      test.info().annotations.push({ type: "⏭ partiel", description: `non franchissables sur le jeu d'essai (liens non cliqués) : ${nonCliquees.join(", ")} — filtres de destination vérifiés en ouvrant l'URL du cahier` });
      /* Journal : aucune ligne pour le lecteur. */
      expect((await lireLeJournal(journal.contexte.request, { from: debut, adminUserId: jeuEssai.admin("super").id })).map((l) => l.action), "aucune ligne").toEqual([]);
    } finally {
      await retablir(ops.contexte, Object.keys(seuils), MOTIF_DE_RECETTE("ADM-ALR-4"));
    }
  });
});
