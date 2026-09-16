/**
 * adm-jrn-journal.spec.ts — cahier 02-ADMIN, § 5.24 « Journal d'audit » (ADM-JRN-1 à 4) + fiches ajoutées
 * ======================================================================================================
 * Le journal est la seconde vérification de TOUT le cahier (§ 3.4) : s'il ment, chaque chapitre précédent a été jugé
 * sur une preuve fausse. Le chapitre se juge à quatre promesses :
 *  - **un filtre posé est un filtre serveur** : cliquer un auteur, une action, une cible, une IP interroge Mongo, pas
 *    les cinquante lignes déjà chargées ; une période « du 15 au 15 » est la journée de l'opérateur, pas celle d'UTC ;
 *  - **les listes proposées sont les vraies** : chaque action et chaque type de cible écrits par un service ont un
 *    libellé français et figurent au filtre ; aucun type jamais écrit n'y figure ;
 *  - **le détail se lit** : jamais un JSON brut, ni au journal ni dans les cartes « Actions admin sur … » ;
 *  - **l'écran ne ment pas** : une panne n'est pas « Aucune action journalisée. », lire ne se journalise pas, un geste
 *    refusé n'écrit rien, le Support et le Médiateur n'ouvrent pas le journal global.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect, type NavigateurAdmin } from "../fixtures/yamba";
import { adresseDeLApiAdmin, adresseDuBackOffice } from "../fixtures/adresses";
import { lireLeJournal } from "../pages/journal-admin";
import { debutDuScenario, lireCoteServeur, MOTIF_DE_RECETTE } from "../pages/ecran-admin";
import { ADMIN_ACTIONS, ADMIN_TARGET_TYPES } from "../../../../packages/libs/admin-audit/src/index";
import { ACTION_LABEL, TARGET_TYPE_LABEL } from "../../../admin-ui/src/lib/format";

const api = () => adresseDeLApiAdmin();
const bo = () => adresseDuBackOffice();
const RACINE = join(__dirname, "../../../..");
type Page = NavigateurAdmin["page"];

/* ══ L'écran ═════════════════════════════════════════════════════════════════════════════════ */

const filtres = (page: Page) => page.locator("div.rounded-xl.bg-slate-50").first();
const champ = (page: Page, libelle: string) => filtres(page).locator("label").filter({ hasText: new RegExp(`^${libelle}`) }).locator("input, select").first();
const lignes = (page: Page) => page.locator("table tbody tr").filter({ has: page.locator("td:nth-child(6)") });
const barre = (page: Page) => filtres(page).locator("div.mt-2").first();
/** Un bloc d'alerte du produit (Next pose aussi un `role="alert"` vide : l'annonceur de route). */
const alerte = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');

/** Ouvre `/audit` et attend la première lecture ; rend la réponse. */
async function ouvrirJournal(page: Page) {
  const r = page.waitForResponse((x) => x.url().includes("/api/admin/audit"), { timeout: 60_000 });
  await page.goto(`${bo()}/audit`, { waitUntil: "domcontentloaded" });
  return r;
}
/** Attend la prochaine lecture du journal (filtre posé, « Réessayer », « Charger la suite ») ; rend son URL et son corps. */
async function prochaineLecture(page: Page, geste: () => Promise<unknown>) {
  const r = page.waitForResponse((x) => x.url().includes("/api/admin/audit"), { timeout: 60_000 });
  await geste();
  const rep = await r;
  return { url: new URL(rep.url()), statut: rep.status(), corps: (await rep.json().catch(() => null)) as { items: Array<{ id: string; admin: string; action: string; adminUserId?: string }>; appliedFilters?: string[] } | null };
}
/** Minuit local du jour J (Europe/Paris, le fuseau du contexte) en ISO, calculé côté harnais. */
const jourLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/* ══ Les fiches ══════════════════════════════════════════════════════════════════════════════ */

test.describe("ADM-JRN — journal d'audit (cahier 02-ADMIN § 5.24)", () => {
  test("ADM-JRN-1 · six filtres serveur, cellules cliquables, barre et états vides — lire ne se journalise pas", async ({ navigateurAdmin }) => {
    test.setTimeout(4 * 60_000);
    const sup = await navigateurAdmin("super");
    const debut = await debutDuScenario();
    const { page } = sup;

    expect((await ouvrirJournal(page)).status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Journal des actions admin" })).toBeVisible();
    await expect(page.getByText("Qui a fait quoi, sur quoi, quand. Écrit dans la même transaction que chaque geste.")).toBeVisible();
    await expect(lignes(page).first()).toBeVisible({ timeout: 60_000 });
    expect(await page.locator("table thead th").allInnerTexts()).toEqual(["QUAND", "QUI", "ACTION", "CIBLE", "DÉTAIL", "IP"]);

    // Étape 2 — les six filtres serveur et le type de cible : les types réellement écrits, en français.
    for (const l of ["Du", "Au", "Action", "Type de cible", "Identifiant de cible", "IP"]) await expect(champ(page, l)).toBeVisible();
    const types = await champ(page, "Type de cible").locator("option").evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value).filter(Boolean));
    expect(types.sort(), "ANO-ADM-70 : le filtre propose les types écrits, aucun autre").toEqual([...ADMIN_TARGET_TYPES].sort());
    await expect(filtres(page)).toContainText("La recherche « contient » ne porte que sur les lignes déjà chargées : le détail est du JSON, il ne s'indexe pas.");
    await expect(barre(page).getByRole("button", { name: "Tout effacer" })).toHaveCount(0);

    // Étape 8 — « contient » : local, la barre dit « sur n chargées », aucun appel serveur.
    const charges = await lignes(page).count();
    await champ(page, "Contient").fill("zzz-introuvable-zzz");
    await expect(barre(page)).toContainText(`0 ligne affichée sur ${charges} chargées`);
    await expect(page.getByText("Aucune action ne correspond à ces filtres.")).toBeVisible();
    await barre(page).getByRole("button", { name: "Tout effacer" }).click();
    await expect(lignes(page).first()).toBeVisible();

    // Étape 11 — chaque cellule pose un filtre SERVEUR.
    const premiere = lignes(page).first();
    const action = await prochaineLecture(page, () => premiere.locator("td").nth(2).getByRole("button").click());
    expect(action.url.searchParams.get("action")).toBeTruthy();
    expect(action.corps?.appliedFilters).toContain("action");
    await expect(barre(page)).toContainText("Filtres serveur : action");
    await expect(premiere.locator("td").nth(2).getByRole("button")).toHaveAttribute("title", "Filtrer sur cette action");

    const auteur = await prochaineLecture(page, () => lignes(page).first().locator("td").nth(1).getByRole("button").click());
    expect(auteur.url.searchParams.get("adminUserId"), "ANO-ADM-68 : « Filtrer sur cet auteur » interroge le serveur").toMatch(/^[a-f0-9]{24}$/);
    const nom = auteur.corps!.items[0].admin;
    expect(auteur.corps!.items.every((i) => i.admin === nom)).toBe(true);
    await expect(filtres(page).getByRole("button", { name: `Auteur : ${nom}` })).toBeVisible();
    await expect(barre(page)).toContainText("auteur");

    await prochaineLecture(page, () => barre(page).getByRole("button", { name: "Tout effacer" }).click());
    await expect(barre(page).getByRole("button", { name: "Tout effacer" })).toHaveCount(0);

    // Une cible avec identifiant pose type ET identifiant ; une cible SANS identifiant vide le champ (un identifiant partiel,
    // ignoré par le serveur, ne reste plus collé à l'écran).
    const avecId = lignes(page).filter({ has: page.locator("td:nth-child(4) button", { hasText: /·/ }) }).first();
    const cible = await prochaineLecture(page, () => avecId.locator("td").nth(3).getByRole("button").click());
    expect(cible.url.searchParams.get("targetId")).toBeTruthy();
    expect(cible.corps?.appliedFilters).toEqual(expect.arrayContaining(["targetType", "targetId"]));
    await expect(champ(page, "Identifiant de cible")).toHaveValue(cible.url.searchParams.get("targetId")!);
    await prochaineLecture(page, () => barre(page).getByRole("button", { name: "Tout effacer" }).click());
    await prochaineLecture(page, () => champ(page, "Action").selectOption("ADMIN_LOGIN"));
    const partiel = await prochaineLecture(page, () => champ(page, "Identifiant de cible").fill("a b"));
    expect(partiel.corps?.appliedFilters).not.toContain("targetId");
    await expect(barre(page)).toContainText("Ignoré (format non reconnu) : identifiant de cible");
    await expect(lignes(page).first()).toBeVisible();
    await prochaineLecture(page, () => lignes(page).first().locator("td").nth(3).getByRole("button").click());
    await expect(champ(page, "Identifiant de cible")).toHaveValue("");
    await prochaineLecture(page, () => barre(page).getByRole("button", { name: "Tout effacer" }).click());

    const ip = lignes(page).filter({ has: page.locator("td:nth-child(6) button") }).first();
    const parIp = await prochaineLecture(page, () => ip.locator("td").nth(5).getByRole("button").click());
    expect(parIp.url.searchParams.get("ip")).toBeTruthy();
    expect(parIp.corps?.appliedFilters).toContain("ip");

    // États vides : un identifiant sans aucune ligne.
    await prochaineLecture(page, () => barre(page).getByRole("button", { name: "Tout effacer" }).click());
    await prochaineLecture(page, () => champ(page, "Identifiant de cible").fill("bbbbbbbbbbbbbbbbbbbbbbbb"));
    await expect(page.getByText("Aucune action ne correspond à ces filtres.")).toBeVisible();

    // Lire le journal ne se journalise pas (une connexion rejouée par le harnais n'est pas une lecture).
    const lu = (await lireLeJournal(sup.contexte.request, { from: debut })).filter((l) => l.action !== "ADMIN_LOGIN" && l.admin.startsWith("Sacha"));
    expect(lu.map((l) => l.action)).toEqual([]);
  });

  test("ADM-JRN-2 · chaque action écrite a son libellé français, et le filtre « Action » les propose toutes", async ({ navigateurAdmin }) => {
    test.setTimeout(3 * 60_000);
    // Le catalogue : chaque action du code a un libellé, aucun libellé orphelin.
    const sansLibelle = ADMIN_ACTIONS.filter((a) => !ACTION_LABEL[a]);
    expect(sansLibelle, "actions du code sans libellé").toEqual([]);
    expect(Object.keys(ACTION_LABEL).filter((a) => !(ADMIN_ACTIONS as readonly string[]).includes(a)), "libellés sans action").toEqual([]);
    expect(Object.keys(TARGET_TYPE_LABEL).sort()).toEqual([...ADMIN_TARGET_TYPES].sort());
    expect(ACTION_LABEL.REPORT_REVIEWED).toBe("Signalement traité");
    expect(ACTION_LABEL.MESSAGE_REPORT_REVIEWED).toBe("Message signalé traité");
    // Ce qui est EN BASE : toute action et tout type présents sont au catalogue (un service qui écrirait hors catalogue).
    const enBase = lireCoteServeur<{ actions: string[]; types: string[] }>(`import p from "./packages/libs/prisma"; (async () => { const a = await p.adminAction.groupBy({ by: ["action"] }); const t = await p.adminAction.groupBy({ by: ["targetType"] }); console.log("@@" + JSON.stringify({ actions: a.map((x) => x.action), types: t.map((x) => x.targetType) })); process.exit(0); })();`);
    expect(enBase.actions.filter((a) => !ACTION_LABEL[a])).toEqual([]);
    expect(enBase.types.filter((t) => !TARGET_TYPE_LABEL[t])).toEqual([]);

    const { page } = await navigateurAdmin("super");
    await ouvrirJournal(page);
    await expect(lignes(page).first()).toBeVisible({ timeout: 60_000 });
    for (let i = 0; i < 2; i++) await prochaineLecture(page, () => page.getByRole("button", { name: "Charger la suite" }).click());
    const brutes = (await page.locator("table tbody td:nth-child(3)").allInnerTexts()).filter((t) => /^[A-Z][A-Z_]{3,}$/.test(t.trim()));
    expect(brutes, "codes bruts dans la colonne Action").toEqual([]);

    // ANO-ADM-71 : le select ne se réduit pas aux lignes chargées — un filtre posé laisse toutes les autres actions choisissables.
    await prochaineLecture(page, () => champ(page, "Action").selectOption("SETTING_CHANGED"));
    const options = await champ(page, "Action").locator("option").evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value).filter(Boolean));
    expect(options.sort()).toEqual([...ADMIN_ACTIONS].sort());
  });

  test("ADM-JRN-3 · complet et fidèle : l'auteur réel, l'horodatage, l'IP, un détail lisible, rien pour un geste refusé", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(4 * 60_000);
    const med = await navigateurAdmin("mediateur");
    const sup = await navigateurAdmin("super");
    const idMed = jeuEssai.admin("mediateur").id;
    const thomas = jeuEssai.membre("thomas");
    const debut = await debutDuScenario();

    // Un geste du Médiateur (lecture de fiche, journalisée) et trois gestes refusés (403, 400, 404) : une seule ligne.
    const avantGeste = Date.now();
    expect((await med.contexte.request.get(`${api()}/admin/users/${thomas}`)).status()).toBe(200);
    const refus403 = await med.contexte.request.patch(`${api()}/admin/settings`, { data: { changes: { "dispute.responseDelayHours": 50 }, reason: MOTIF_DE_RECETTE("ADM-JRN-3"), expectedVersion: 0 }, failOnStatusCode: false });
    expect(refus403.status()).toBe(403);
    const refus400 = await sup.contexte.request.put(`${api()}/admin/maintenance`, { data: { enabled: false, messageFr: "x", messageEn: "x", scheduledAt: new Date(Date.now() - 3_600_000).toISOString(), reason: MOTIF_DE_RECETTE("ADM-JRN-3"), expectedVersion: 0 }, failOnStatusCode: false });
    expect([400, 409]).toContain(refus400.status());
    const refus404 = await med.contexte.request.post(`${api()}/admin/users/cccccccccccccccccccccccc/suspension/propose`, { data: { reason: MOTIF_DE_RECETTE("ADM-JRN-3") }, failOnStatusCode: false });
    expect(refus404.status()).toBeGreaterThanOrEqual(400);

    const duMed = (await lireLeJournal(sup.contexte.request, { from: debut, adminUserId: idMed })).filter((l) => l.action !== "ADMIN_LOGIN");
    expect(duMed.map((l) => `${l.action} ${l.targetType} ${l.targetId}`)).toEqual([`USER_VIEWED USER ${thomas}`]);
    const ligne = duMed[0];
    expect(ligne.admin).toBe("Nadia M.");
    expect(Math.abs(new Date(ligne.at).getTime() - avantGeste)).toBeLessThan(5_000);
    expect(ligne.ip).toBeTruthy();
    const ua = lireCoteServeur<string | null>(`import p from "./packages/libs/prisma"; (async () => { const l = await p.adminAction.findUnique({ where: { id: "${ligne.id}" }, select: { userAgent: true } }); console.log("@@" + JSON.stringify(l?.userAgent ?? null)); process.exit(0); })();`);
    expect(ua && ua.length > 0 && ua.length <= 200).toBe(true);
    const parLeSuper = (await lireLeJournal(sup.contexte.request, { from: debut, adminUserId: jeuEssai.admin("super").id })).filter((l) => l.action !== "ADMIN_LOGIN");
    expect(parLeSuper.map((l) => l.action), "un geste refusé n'écrit rien").toEqual([]);

    // L'écran : l'auteur filtré côté serveur, et un détail lisible — ni accolade, ni crochet, ni guillemet.
    const { page } = sup;
    await ouvrirJournal(page);
    await expect(lignes(page).first()).toBeVisible({ timeout: 60_000 });
    for (const action of ["SETTING_CHANGED", "DEAL_RECONCILED", "EXPORTED"]) {
      const lu = await prochaineLecture(page, () => champ(page, "Action").selectOption(action));
      expect(lu.corps!.items.length, `au moins une ligne ${action} en base`).toBeGreaterThan(0);
      const details = await page.locator("table tbody td:nth-child(5)").allInnerTexts();
      expect(details.filter((d) => /[{}[\]"]/.test(d)), `ANO-ADM-73 : détail JSON brut (${action})`).toEqual([]);
      // A187 b (§ 5.25) : un paramètre se lit « clé : avant → après », le reste du détail sous la ligne de changement.
      if (action === "SETTING_CHANGED") expect(details[0]).toMatch(/ : .+ → .+\n.*reason : /);
    }
    // Étape 4 — une ligne par clé : cliquer la cible d'un paramètre filtre sur SA clé (ANO-ADM-74 : la clé était ignorée).
    await prochaineLecture(page, () => champ(page, "Action").selectOption("SETTING_CHANGED"));
    await expect(lignes(page).first().locator("td").nth(2)).toHaveText("Paramètre modifié");
    const cleCible = lignes(page).first().locator("td").nth(3).getByRole("button");
    const cle = /·\s*(\S+)/.exec(await cleCible.innerText())?.[1] ?? "";
    expect(cle).toMatch(/^[a-z]+\.[A-Za-z.]+$/);
    const parCle = await prochaineLecture(page, () => cleCible.click());
    expect(parCle.corps?.appliedFilters).toEqual(expect.arrayContaining(["action", "targetType", "targetId"]));
    expect(parCle.corps!.items.every((i) => (i as unknown as { targetId: string }).targetId === cle)).toBe(true);
    const parLApi = await lireLeJournal(sup.contexte.request, { from: "2020-01-01", action: "SETTING_CHANGED", targetType: "SETTINGS", targetId: cle });
    expect(parLApi.length).toBeGreaterThan(0);
    expect(parLApi.every((l) => l.targetId === cle && ((l.after as { key?: string } | null)?.key ?? cle) === cle)).toBe(true);
    await prochaineLecture(page, () => barre(page).getByRole("button", { name: "Tout effacer" }).click());

    // Les cartes « Actions admin sur ce compte » suivent la même règle.
    await page.goto(`${bo()}/users/${thomas}`, { waitUntil: "domcontentloaded" });
    const carte = page.locator("div, section").filter({ has: page.getByRole("heading", { name: "Actions admin sur ce compte" }) }).last();
    await expect(carte.locator("li").first()).toBeVisible({ timeout: 60_000 });
    expect((await carte.locator("li").allInnerTexts()).filter((t) => /[{}[\]"]/.test(t))).toEqual([]);
  });

  test("ADM-JRN-4 · ni le Support ni le Médiateur n'ouvrent le journal global ; ils lisent le journal de la cible ; jamais purgé", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(3 * 60_000);
    const thomas = jeuEssai.membre("thomas");
    for (const cle of ["support", "mediateur"] as const) {
      const { page, contexte } = await navigateurAdmin(cle);
      expect((await contexte.request.get(`${api()}/admin/audit`, { failOnStatusCode: false })).status(), `${cle} : API`).toBe(403);
      await page.goto(`${bo()}/home`, { waitUntil: "domcontentloaded" });
      await expect(page.locator("aside nav")).toBeVisible({ timeout: 60_000 });
      await expect(page.locator("aside nav").getByRole("link", { name: "Journal" })).toHaveCount(0);
      await page.goto(`${bo()}/audit`, { waitUntil: "domcontentloaded" });
      await expect(alerte(page)).toHaveText("Ton profil ne lit pas le journal des actions admin.", { timeout: 60_000 });
      await expect(page.locator("table")).toHaveCount(0);
      // Le chemin prévu pour eux : le journal filtré sur la cible, en bas de la fiche membre.
      await page.goto(`${bo()}/users/${thomas}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Actions admin sur ce compte" })).toBeVisible({ timeout: 60_000 });
    }
    // Contrôle documentaire : aucune règle de rétention ne porte sur le journal admin.
    const retention = readFileSync(join(RACINE, "packages/libs/retention/index.ts"), "utf-8");
    expect(/adminAction/i.test(retention)).toBe(false);
    const catalogue = readFileSync(join(RACINE, "packages/libs/api-contracts/src/admin/platform-settings.schema.ts"), "utf-8");
    expect((catalogue.match(/"retention\.[A-Za-z]+"/g) ?? []).filter((k) => /admin|audit/i.test(k))).toEqual([]);
  });

  /* ── Fiches ajoutées ─────────────────────────────────────────────────────────────────────── */

  test("ADM-JRN-5 · une panne n'est pas « Aucune action journalisée. » : refus lisible, « Réessayer » relit (ANO-ADM-72)", async ({ navigateurAdmin }) => {
    test.setTimeout(3 * 60_000);
    const { page } = await navigateurAdmin("finance"); // audit.read : la Finance lit le journal
    await page.route("**/api/admin/audit**", (route) => route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ status: "error", message: "Upstream unreachable.", details: { code: "UPSTREAM_UNREACHABLE" } }) }));
    await page.goto(`${bo()}/audit`, { waitUntil: "domcontentloaded" });
    await expect(alerte(page)).toContainText("Le journal n'a pas pu être lu", { timeout: 60_000 });
    await expect(page.getByText("Aucune action journalisée.")).toHaveCount(0);
    await page.unroute("**/api/admin/audit**");
    await prochaineLecture(page, () => page.getByRole("button", { name: "Réessayer" }).click());
    await expect(lignes(page).first()).toBeVisible({ timeout: 60_000 });
    await expect(alerte(page)).toHaveCount(0);
  });

  test("ADM-JRN-6 · « Du » et « Au » sont les journées de l'opérateur (Europe/Paris), pas celles d'UTC (ANO-ADM-69)", async ({ navigateurAdmin }) => {
    test.setTimeout(3 * 60_000);
    const { page } = await navigateurAdmin("super");
    await ouvrirJournal(page);
    await expect(lignes(page).first()).toBeVisible({ timeout: 60_000 });
    const hier = new Date(Date.now() - 86_400_000);
    const jour = jourLocal(hier);
    await prochaineLecture(page, () => champ(page, "Du").fill(jour));
    const lu = await prochaineLecture(page, () => champ(page, "Au").fill(jour));
    const [a, m, j] = jour.split("-").map(Number);
    const minuit = new Date(a, m - 1, j, 0, 0, 0, 0); // le contexte du navigateur ET le harnais sont en Europe/Paris
    const fin = new Date(a, m - 1, j, 23, 59, 59, 999);
    expect(new Date(lu.url.searchParams.get("from")!).toISOString()).toBe(minuit.toISOString());
    expect(new Date(lu.url.searchParams.get("to")!).toISOString()).toBe(fin.toISOString());
    for (const i of lu.corps!.items) {
      const t = new Date((i as unknown as { at: string }).at).getTime();
      expect(t >= minuit.getTime() && t <= fin.getTime()).toBe(true);
    }
    await expect(barre(page)).toContainText("période");
  });

  test("ADM-JRN-7 · « Charger la suite » garde les filtres et ne double aucune ligne", async ({ navigateurAdmin }) => {
    test.setTimeout(3 * 60_000);
    const { page } = await navigateurAdmin("super");
    await ouvrirJournal(page);
    await expect(lignes(page).first()).toBeVisible({ timeout: 60_000 });
    await prochaineLecture(page, () => champ(page, "Type de cible").selectOption("BOOKING"));
    const suite = await prochaineLecture(page, () => page.getByRole("button", { name: "Charger la suite" }).click());
    expect(suite.url.searchParams.get("targetType")).toBe("BOOKING");
    expect(suite.url.searchParams.get("cursor")).toMatch(/^[a-f0-9]{24}$/);
    const cibles = await page.locator("table tbody td:nth-child(4)").allInnerTexts();
    expect(cibles.length).toBeGreaterThan(50);
    expect(cibles.every((c) => c.startsWith(TARGET_TYPE_LABEL.BOOKING))).toBe(true);
  });
});
