/**
 * adm-nrg-non-regression.spec.ts — cahier 02-ADMIN, § 7 « Non-régression » (ADM-NRG-1 à 7) + deux fiches ajoutées
 * ==============================================================================================================
 * Le § 7 rejoue des défauts DÉJÀ payés une fois : ce sont des fiches COURTES, sans mise en scène, qui doivent rester
 * vertes à chaque livraison. Elles ne racontent rien de neuf — elles gardent une porte fermée.
 *
 * Deux fiches sont ajoutées au cahier, et elles portent l'essentiel du travail du chapitre :
 *  - **ADM-NRG-8** — l'ENGAGEMENT pris au § 5.19 puis répété à chaque chapitre : plus aucun geste admin « lu puis
 *    écrit » ne rend 500 sous des clics simultanés. Sanctions (`admin-users`) et TOTP (`admin-auth`) sont les deux
 *    derniers inventoriés (A192) ;
 *  - **ADM-NRG-9** — la catégorie de sanction en liste FERMÉE (A193), proposée au § 6 : le membre lit enfin POURQUOI,
 *    sans que le motif interne (souvent recopié d'un signalement) quitte le back-office.
 *
 * Écarts de NRG-7 : deux des cinq « écarts documentaires connus » sont LEVÉS par ce chapitre et le précédent (la tuile
 * « Sanctions proposées » filtre désormais, A194 ; les codes de secours se régénèrent, A190 a). La fiche les constate
 * dans leur nouvel état — un écart levé n'est pas un écart oublié.
 */
import { test, expect, type NavigateurAdmin } from "../fixtures/yamba";
import { JeuEssai } from "../fixtures/jeu-essai";
import { request as requeteApi } from "@playwright/test";
import { adresseDeLApi, adresseDeLApiAdmin, adresseDuBackOffice } from "../fixtures/adresses";
import { COMPTES, MOT_DE_PASSE_SEED } from "../fixtures/comptes";
import { lireLeJournal } from "../pages/journal-admin";
import { attendreLeChargement, debutDuScenario, lireCoteServeur, MOTIF_DE_RECETTE } from "../pages/ecran-admin";
import { totpCode, TOTP_STEP_SECONDS } from "../../../../packages/libs/totp/src";

const api = () => adresseDeLApiAdmin();
const apiMembre = () => adresseDeLApi();
const bo = () => adresseDuBackOffice();

type Contexte = NavigateurAdmin["contexte"];
type Page = NavigateurAdmin["page"];
type Alerte = { rule: string; severity: "critical" | "warning"; title: string; detail: string; count: number | null; href: string };
type Reglages = { version: number; values: Record<string, number>; defaults: Record<string, number> };

const MOTIF_INTERNE = "Recette ADM-NRG : trois signalements convergents d'Aminata, deal YAM-2041, notes internes.";
const q = (s: string) => JSON.stringify(s);

/* ══ Outils communs ══════════════════════════════════════════════════════════════════════════ */

/** Le sous-titre d'un écran : le `<p>` qui suit le titre de niveau 1. */
const sousTitre = (page: Page) => page.locator("main p").first();

async function ouvrir(page: Page, chemin: string): Promise<void> {
  await page.goto(`${bo()}${chemin}`, { waitUntil: "domcontentloaded" });
  await attendreLeChargement(page);
}

const lireReglages = async (ctx: Contexte): Promise<Reglages> => (await (await ctx.request.get(`${api()}/admin/settings`)).json()) as Reglages;

/** Pose des seuils par l'API de l'écran Paramètres (seules les clés qui changent partent). */
async function poserSeuils(ctx: Contexte, voulus: Record<string, number>, motif: string): Promise<void> {
  const cur = await lireReglages(ctx);
  const changes = Object.fromEntries(Object.entries(voulus).filter(([k, v]) => cur.values[k] !== v));
  if (Object.keys(changes).length === 0) return;
  const r = await ctx.request.patch(`${api()}/admin/settings`, { data: { changes, reason: motif, expectedVersion: cur.version } });
  expect(r.ok(), `PATCH /admin/settings ${JSON.stringify(changes)} : ${r.status()}`).toBe(true);
}
async function retablir(ctx: Contexte, cles: string[], motif: string): Promise<void> {
  const cur = await lireReglages(ctx);
  await poserSeuils(ctx, Object.fromEntries(cles.map((k) => [k, cur.defaults[k]])), motif);
}

/** Les alertes servies, en attendant que le cache des paramètres (30 s côté deal-service) ait vu le dernier seuil. */
async function alertesQuand(ctx: Contexte, condition: (a: Alerte[]) => boolean, message: string): Promise<Alerte[]> {
  let dernieres: Alerte[] = [];
  await expect
    .poll(async () => {
      dernieres = ((await (await ctx.request.get(`${api()}/admin/alerts`)).json()) as { alerts: Alerte[] }).alerts;
      return condition(dernieres);
    }, { timeout: 90_000, intervals: [3_000], message })
    .toBe(true);
  return dernieres;
}

/** Un appel direct, avec le code métier lu où il se trouve vraiment (A146 : `details.code`). */
async function appel(ctx: Contexte, methode: "GET" | "POST" | "PATCH" | "DELETE", chemin: string, data?: unknown) {
  const r = await ctx.request.fetch(`${api()}${chemin}`, { method: methode, data, failOnStatusCode: false });
  const corps = (await r.json().catch(() => ({}))) as Record<string, unknown> & { details?: { code?: string } };
  return { statut: r.status(), code: corps.details?.code ?? null, corps };
}

/* ══ Les fiches ══════════════════════════════════════════════════════════════════════════════ */

test.describe("ADM-NRG — non-régression (cahier 02-ADMIN § 7)", () => {
  // Fiches courtes et indépendantes : un rouge ne doit pas masquer les huit autres (mode « default », pas « serial »).
  test.describe.configure({ mode: "default" });

  test.beforeAll(() => {
    new JeuEssai().rejouer();
  });

  /* ─────────────────────────────────────────────────────────────────────────────────────────── */

  test("ADM-NRG-1 · aucun sous-titre ne promet une fonction déjà livrée, ni un délai en dur qui contredit un paramètre", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(4 * 60_000);
    const sup = await navigateurAdmin("super");
    const { page } = sup;

    /* Les quatre écrans du cahier, sous-titre lu EN ENTIER. */
    const ECRANS: Array<{ chemin: string; interdits: RegExp[]; attendu: RegExp }> = [
      { chemin: "/home", interdits: [/pilotage \(C-PR6\)/i, /arrivent avec/i], attendu: /Ce qui attend une action, selon ton profil\..*Pilotage.*Finances/s },
      { chemin: "/finances", interdits: [/C-PR5b/i, /arrivent? avec/i], attendu: /Le rapport mensuel et son export/ },
      { chemin: "/disputes", interdits: [/arrivent? avec/i], attendu: /paramètre « Délai de réponse au litige », 72 h par défaut/ },
      { chemin: "/pilotage", interdits: [/C-PR6b/i, /Les alertes de seuil arrivent/i], attendu: /Les alertes de seuil ont leur page\./ },
    ];
    for (const e of ECRANS) {
      await ouvrir(page, e.chemin);
      const texte = (await sousTitre(page).innerText()).trim();
      test.info().annotations.push({ type: "sous-titre", description: `${e.chemin} : « ${texte} »` });
      for (const interdit of e.interdits) expect(texte, `${e.chemin} : ne promet plus « ${interdit} »`).not.toMatch(interdit);
      expect(texte, `${e.chemin} : le sous-titre livré`).toMatch(e.attendu);
    }

    /* Le cinquième : le formulaire « Trancher » d'un dossier NON décidable renvoie au paramètre, pas à « 72 h ». */
    const nonDecidable = jeuEssai.deal("los-disputed").id; // YAM-2042, signalé à H−8 : le Voyageur a encore la parole
    await ouvrir(page, `/disputes/${nonDecidable}`);
    const attente = page.getByText(/^Décision possible à partir du /);
    await expect(attente).toBeVisible({ timeout: 60_000 });
    const texteAttente = (await attente.innerText()).trim();
    test.info().annotations.push({ type: "sous-titre", description: `formulaire « Trancher » : « ${texteAttente} »` });
    expect(texteAttente, "le texte renvoie au paramètre").toContain("paramètre « Délai de réponse au litige »");
    expect(texteAttente, "plus de « 72 h » en dur dans le formulaire").not.toMatch(/72\s?h/);
    /* L'échéance affichée reste CALCULÉE : c'est une date, pas un délai récité. */
    expect(texteAttente, "une date exacte, calculée depuis la valeur du paramètre").toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  /* ─────────────────────────────────────────────────────────────────────────────────────────── */

  test("ADM-NRG-2 · la file d'arbitrage part des filtres de l'URL, et les alertes y déposent sur la bonne sous-file", async ({ navigateurAdmin }) => {
    test.setTimeout(6 * 60_000);
    const med = await navigateurAdmin("mediateur");
    const ops = await navigateurAdmin("exploitation");
    const { page } = med;
    /* Les trois `select` de la file, dans l'ordre du formulaire : type, âge, décidabilité. */
    const selectType = () => page.locator("select").nth(0);
    const selectAge = () => page.locator("select").nth(1);
    const selectDecidable = () => page.locator("select").nth(2);
    const origine = () => page.getByPlaceholder("origine");
    const destination = () => page.getByPlaceholder("destination");

    /** Ouvre `/disputes` avec ses paramètres et rend l'URL RÉELLEMENT interrogée côté serveur. */
    async function ouvrirLaFile(requete: string): Promise<URL> {
      const reponse = page.waitForResponse((r) => r.url().includes("/api/admin/disputes"), { timeout: 60_000 });
      await page.goto(`${bo()}${requete}`, { waitUntil: "domcontentloaded" });
      const url = new URL((await reponse).url());
      await attendreLeChargement(page);
      return url;
    }

    /* 1-2. Décidabilité et type : le select est positionné ET l'appel serveur porte le filtre. */
    expect((await ouvrirLaFile("/disputes?decidable=1")).searchParams.get("decidable"), "?decidable=1 part au serveur").toBe("1");
    await expect(selectDecidable(), "le select affiche « décidables maintenant »").toHaveValue("1");
    expect((await ouvrirLaFile("/disputes?kind=RETENTION")).searchParams.get("kind")).toBe("RETENTION");
    await expect(selectType(), "le select affiche « retenues »").toHaveValue("RETENTION");
    await expect(page.locator("tbody tr").filter({ hasText: "Litige" }), "la liste ne montre que des retenues").toHaveCount(0);

    /* 3. Âge, origine, destination. */
    expect((await ouvrirLaFile("/disputes?olderThanDays=7")).searchParams.get("olderThanDays")).toBe("7");
    await expect(selectAge()).toHaveValue("7");
    expect((await ouvrirLaFile("/disputes?originCity=Paris")).searchParams.get("originCity")).toBe("Paris");
    await expect(origine()).toHaveValue("Paris");
    expect((await ouvrirLaFile("/disputes?destinationCity=Brazzaville")).searchParams.get("destinationCity")).toBe("Brazzaville");
    await expect(destination()).toHaveValue("Brazzaville");

    /* 4. Les trois ensemble. */
    const combine = await ouvrirLaFile("/disputes?kind=DISPUTE&decidable=1&olderThanDays=3");
    expect([combine.searchParams.get("kind"), combine.searchParams.get("decidable"), combine.searchParams.get("olderThanDays")]).toEqual(["DISPUTE", "1", "3"]);
    await expect(selectType()).toHaveValue("DISPUTE");
    await expect(selectDecidable()).toHaveValue("1");
    await expect(selectAge()).toHaveValue("3");
    /* La file entière reste comptée sous les filtres : « rien ici » n'est jamais « rien à arbitrer ». */
    await expect(page.locator("main")).toContainText(/file entière : \d+ litige\(s\) · \d+ retenue\(s\)/);

    /* 5. Une alerte dépose sur la BONNE sous-file : seuil de retenue abaissé, puis « Aller traiter → ». */
    const CLE = "alerts.retentionHeldDays";
    const motif = MOTIF_DE_RECETTE("ADM-NRG-2");
    try {
      await poserSeuils(ops.contexte, { [CLE]: 1 }, motif);
      const alertes = await alertesQuand(ops.contexte, (a) => a.some((x) => x.rule === "RETENTION_HELD_7D"), "la retenue du jeu d'essai franchit le seuil d'un jour");
      const retenue = alertes.find((a) => a.rule === "RETENTION_HELD_7D")!;
      expect(retenue.href, "l'alerte pointe la SOUS-file, pas la file entière").toBe("/disputes?kind=RETENTION");
      await ouvrir(page, "/alerts");
      const carte = page.locator("a", { hasText: "Aller traiter →" }).filter({ hasText: retenue.title });
      await expect(carte).toBeVisible({ timeout: 60_000 });
      const appelFiltre = page.waitForResponse((r) => r.url().includes("/api/admin/disputes"), { timeout: 60_000 });
      await carte.click();
      expect(new URL((await appelFiltre).url()).searchParams.get("kind"), "l'opérateur arrive filtré").toBe("RETENTION");
      await expect(page).toHaveURL(/\/disputes\?kind=RETENTION/);
      await expect(selectType()).toHaveValue("RETENTION");
    } finally {
      await retablir(ops.contexte, [CLE], motif);
    }
  });

  /* ─────────────────────────────────────────────────────────────────────────────────────────── */

  test("ADM-NRG-3 · « Signalement traité » : le journal affiche le libellé, la base garde le code", async ({ navigateurAdmin, navigateurConnecte, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    const med = await navigateurAdmin("mediateur");
    const sup = await navigateurAdmin("super"); // le Médiateur n'a pas `audit.read` : le journal se lit en super
    const debut = await debutDuScenario();

    /* 1. Un signalement, traité par l'écran (le geste qui écrit `REPORT_REVIEWED`). */
    const joao = await navigateurConnecte("joao");
    const signalement = await joao.contexte.request.post(`${apiMembre()}/reports`, {
      data: { targetType: "TRIP", targetRef: jeuEssai.trajet("yul"), reason: "SCAM", details: "Recette ADM-NRG-3 : annonce douteuse, paiement demandé hors plateforme." },
      failOnStatusCode: false,
    });
    expect([200, 201], `POST /reports → ${signalement.status()}`).toContain(signalement.status());
    await ouvrir(med.page, "/reports");
    const carte = med.page.locator("main li").filter({ hasText: "Arnaque suspectée" }).first();
    await expect(carte).toBeVisible({ timeout: 60_000 });
    await carte.getByRole("button", { name: "Traité" }).first().click();

    /* 2-3. Le journal, filtré sur le type de cible REPORT : la colonne « Action » est en français. */
    await ouvrir(sup.page, "/audit");
    const champ = (libelle: string) => sup.page.locator("label").filter({ hasText: new RegExp(`^${libelle}`) }).locator("input, select").first();
    await champ("Type de cible").selectOption("REPORT");
    const ligne = sup.page.locator("table tbody tr").first();
    await expect(ligne).toBeVisible({ timeout: 60_000 });
    await expect(ligne, "le libellé, jamais le code brut").toContainText("Signalement traité");
    await expect(sup.page.locator("table tbody")).not.toContainText("REPORT_REVIEWED");

    /* 4. Le select « Action » propose le même libellé, et celui des messages à côté. */
    const actions = await champ("Action").locator("option").allInnerTexts();
    expect(actions.map((a) => a.trim()), "le filtre propose le libellé").toContain("Signalement traité");
    expect(actions.map((a) => a.trim()), "l'action voisine des messages").toContain("Message signalé traité");

    /* La base, elle, garde le CODE : c'est le contrat du journal (le libellé est un affichage). */
    const lignes = await lireLeJournal(sup.contexte.request, { from: debut, action: "REPORT_REVIEWED" });
    expect(lignes.length, "une ligne REPORT_REVIEWED écrite par le geste").toBeGreaterThanOrEqual(1);
    expect(lignes[0].targetType, "sur la cible REPORT").toBe("REPORT");
  });

  /* ─────────────────────────────────────────────────────────────────────────────────────────── */

  test("ADM-NRG-4 · page Paramètres : aucune clé React manquante, aucune saisie qui migre de ligne", async ({ navigateurAdmin }) => {
    test.setTimeout(4 * 60_000);
    const sup = await navigateurAdmin("super");
    const { page } = sup;
    /* 1. La console, écoutée dès l'ouverture. */
    const avertissements: string[] = [];
    page.on("console", (m) => { if (m.type() === "warning" || m.type() === "error") avertissements.push(m.text()); });
    await ouvrir(page, "/settings");
    await expect(page.getByRole("heading", { name: "Paramètres de la plateforme" })).toBeVisible({ timeout: 60_000 });

    /* 3. Une seule ligne saisie, dans le groupe « alertes ». */
    const saisie = page.getByLabel("Versement en échec depuis", { exact: true });
    const voisine = page.getByLabel("Litige décidable sans décision depuis", { exact: true });
    const avant = await saisie.inputValue();
    const nouvelle = String(Number(avant) + 2);
    await saisie.fill(nouvelle);

    /* 4. « historique » sur une AUTRE ligne du même groupe : la saisie ne bouge pas. */
    const ligneVoisine = page.locator("tr").filter({ has: voisine });
    await ligneVoisine.getByRole("button", { name: "historique" }).click();
    await expect(page.locator("tr.bg-slate-50 td")).toBeVisible({ timeout: 30_000 });
    await expect(saisie, "la valeur reste sur SA ligne").toHaveValue(nouvelle);
    await expect(voisine, "la ligne voisine n'a rien reçu").not.toHaveValue(nouvelle);

    /* 5. Panneaux d'explication ouverts et refermés dans le désordre. */
    for (const libelle of ["Litige décidable sans décision depuis", "Versement en échec depuis", "Retenue non arbitrée depuis"]) {
      await page.getByRole("button", { name: libelle, exact: true }).click();
    }
    await page.getByRole("button", { name: "Versement en échec depuis", exact: true }).click();
    await expect(saisie, "après cinq ouvertures, la saisie n'a pas migré").toHaveValue(nouvelle);

    /* 6. Le panneau collant « À valider » : une seule modification, le bon libellé, le bon avant → après. */
    const aValider = page.locator("section").filter({ has: page.getByRole("heading", { name: /^À valider — / }) });
    await expect(page.getByRole("heading", { name: "À valider — 1 modification(s)" }), "une seule ligne annoncée").toBeVisible({ timeout: 30_000 });
    await expect(aValider, "le libellé du paramètre saisi").toContainText("Versement en échec depuis");
    await expect(aValider, "le couple avant → après de CETTE ligne").toContainText(new RegExp(`${avant}\\s*h.*→.*${nouvelle}\\s*h`));
    /* Rien n'est enregistré : la page est quittée sans « Enregistrer » — aucune ligne SETTING_CHANGED ne doit naître d'une lecture. */
    const cles = avertissements.filter((t) => /unique "key" prop|each child in a list/i.test(t));
    test.info().annotations.push({ type: "console", description: `${avertissements.length} avertissement(s) console, dont ${cles.length} de clé` });
    expect(cles, "aucun avertissement de clé React").toEqual([]);
  });

  /* ─────────────────────────────────────────────────────────────────────────────────────────── */

  test("ADM-NRG-5 · l'accueil ne garde qu'un résumé d'alertes, la page dédiée porte le détail", async ({ navigateurAdmin }) => {
    test.setTimeout(8 * 60_000);
    const ops = await navigateurAdmin("exploitation");
    const privacy = await navigateurAdmin("privacy");
    const motif = MOTIF_DE_RECETTE("ADM-NRG-5");
    const CLES = ["alerts.retentionHeldDays", "alerts.reversalOpenHours"];
    const debut = await debutDuScenario();
    try {
      /* 1. Deux alertes au moins, provoquées par leurs seuils. */
      await poserSeuils(ops.contexte, { "alerts.retentionHeldDays": 1, "alerts.reversalOpenHours": 1 }, motif);
      const alertes = await alertesQuand(ops.contexte, (a) => a.length >= 2, "au moins deux alertes ouvertes");
      const critiques = alertes.filter((a) => a.severity === "critical");

      /* 2. L'accueil : UNE ligne de résumé, et les compteurs « À traiter » toujours au-dessus de la ligne de flottaison.
            Lu par le SUPER administrateur : c'est le profil qui voit le plus de tuiles, donc le pire cas pour le déroulement. */
      const sup = await navigateurAdmin("super");
      await ouvrir(sup.page, "/home");
      const resume = sup.page.locator("main a[href='/alerts']").first(); // le menu latéral porte le même lien : le résumé est dans « main »
      await expect(resume).toBeVisible({ timeout: 60_000 });
      const texte = (await resume.innerText()).replace(/\s+/g, " ").trim();
      test.info().annotations.push({ type: "résumé", description: texte });
      expect(texte).toMatch(new RegExp(`^${alertes.length} alertes? de seuil`));
      if (critiques.length > 0) expect(texte).toContain(`${critiques.length} critique`);
      expect(texte).toContain("la plus grave :");
      expect(texte).toContain("Voir les alertes →");
      /* Une régression consisterait à voir revenir le détail des neuf règles sur l'accueil. */
      const detailsSurAccueil = await sup.page.locator("main").getByText("Seuils utilisés").count();
      expect(detailsSurAccueil, "le tableau des seuils reste sur /alerts").toBe(0);
      const tuile = sup.page.locator("main a[href='/finances?kind=FAILED']").first();
      expect((await tuile.boundingBox())?.y ?? 99_999, "les compteurs « À traiter » restent visibles sans dérouler").toBeLessThan(900);

      /* 3. La page dédiée : groupes par gravité, code de chaque règle, tableau des seuils. */
      await ouvrir(ops.page, "/alerts");
      if (critiques.length > 0) await expect(ops.page.getByText(`Critiques · ${critiques.length}`, { exact: true })).toBeVisible({ timeout: 60_000 });
      const surveiller = alertes.length - critiques.length;
      if (surveiller > 0) await expect(ops.page.getByText(`À surveiller · ${surveiller}`, { exact: true })).toBeVisible();
      for (const a of alertes) await expect(ops.page.locator("main"), `le code ${a.rule} est affiché`).toContainText(a.rule);
      await expect(ops.page.getByText("Seuils utilisés", { exact: true })).toBeVisible();

      /* 4. Le profil Données personnelles n'a pas `kpi.read` : pas d'entrée « Alertes », et le serveur refuse. */
      await ouvrir(privacy.page, "/home");
      await expect(privacy.page.locator("aside").getByRole("link", { name: "Alertes", exact: true }), "entrée absente du menu").toHaveCount(0);
      expect((await privacy.contexte.request.get(`${api()}/admin/alerts`, { failOnStatusCode: false })).status(), "et le serveur refuse").toBe(403);
    } finally {
      await retablir(ops.contexte, CLES, motif);
    }
    /* 5. Deux `SETTING_CHANGED` par seuil : l'abaissement et le retour. */
    const sup = await navigateurAdmin("super");
    const lignes = await lireLeJournal(sup.contexte.request, { from: debut, action: "SETTING_CHANGED" });
    for (const cle of CLES) expect(lignes.filter((l) => l.targetId === cle).length, `deux lignes pour ${cle} : l'abaissement et le retour`).toBeGreaterThanOrEqual(2);
  });

  /* ─────────────────────────────────────────────────────────────────────────────────────────── */

  test("ADM-NRG-6 · le journal se filtre et se fouille — et le lire ne se journalise pas", async ({ navigateurAdmin }) => {
    test.setTimeout(5 * 60_000);
    const sup = await navigateurAdmin("super");
    const { page } = sup;
    const debut = await debutDuScenario();
    const filtres = () => page.locator("div.rounded-xl.bg-slate-50").first();
    const champ = (libelle: string) => filtres().locator("label").filter({ hasText: new RegExp(`^${libelle}`) }).locator("input, select").first();
    const barre = () => filtres().locator("div.mt-2").first();

    /* 1. Six filtres serveur, un champ de recherche locale. */
    const premiere = page.waitForResponse((r) => r.url().includes("/api/admin/audit"), { timeout: 60_000 });
    await page.goto(`${bo()}/audit`, { waitUntil: "domcontentloaded" });
    expect((await premiere).status()).toBe(200);
    for (const l of ["Du", "Au", "Action", "Type de cible", "Identifiant de cible", "IP"]) await expect(champ(l), `filtre serveur « ${l} »`).toBeVisible();
    await expect(champ("Contient \\(lignes chargées"), "et la recherche locale, la septième case").toBeVisible();

    /* 2-3. Un filtre posé est un filtre SERVEUR, nommé dans la barre. */
    const parAction = page.waitForResponse((r) => r.url().includes("/api/admin/audit"), { timeout: 60_000 });
    await champ("Action").selectOption("ADMIN_LOGIN");
    expect(new URL((await parAction).url()).searchParams.get("action"), "l'appel porte le filtre").toBe("ADMIN_LOGIN");
    await expect(barre()).toContainText("Filtres serveur :");
    /* Une valeur mal formée est IGNORÉE, pas refusée par une erreur — et l'écran NOMME ce qu'il a ignoré.
       Écart avec le cahier : depuis ANO-ADM-74 (§ 5.24), un identifiant COURT est une valeur légitime (une clé de
       paramètre, `maintenance`…) : il est appliqué et rend « 0 ligne affichée », ce n'est plus un format refusé. Seul un
       caractère interdit (espace, `$`) fait un filtre ignoré. Les deux cas sont vérifiés ici. */
    const court = page.waitForResponse((r) => r.url().includes("/api/admin/audit"), { timeout: 60_000 });
    await champ("Identifiant de cible").fill("abc");
    expect((await court).status(), "identifiant court : la lecture passe").toBe(200);
    await expect(barre(), "et il est bien APPLIQUÉ (clé de paramètre possible, ANO-ADM-74)").toContainText("identifiant de cible");
    const malForme = page.waitForResponse((r) => r.url().includes("/api/admin/audit"), { timeout: 60_000 });
    await champ("Identifiant de cible").fill("ab c$");
    expect((await malForme).status(), "caractère interdit : la lecture passe quand même").toBe(200);
    await expect(barre(), "et l'écran le dit").toContainText("Ignoré (format non reconnu)");
    await champ("Identifiant de cible").fill("");

    /* 4. La recherche libre : locale, et la note le dit. */
    await expect(filtres()).toContainText("La recherche « contient » ne porte que sur les lignes déjà chargées, détail compris");

    /* 5. Une valeur cliquée pose son filtre. */
    await page.getByRole("button", { name: "Tout effacer" }).click();
    const ligne = page.locator("table tbody tr").first();
    await expect(ligne).toBeVisible({ timeout: 60_000 });
    const parQui = page.waitForResponse((r) => r.url().includes("/api/admin/audit"), { timeout: 60_000 });
    await ligne.locator("td").nth(1).getByRole("button").first().click();
    expect(new URL((await parQui).url()).searchParams.get("adminUserId"), "« Qui » cliqué pose un filtre serveur").toBeTruthy();

    /* 6. « Tout effacer » remet la liste entière. */
    const efface = page.waitForResponse((r) => r.url().includes("/api/admin/audit"), { timeout: 60_000 });
    await page.getByRole("button", { name: "Tout effacer" }).click();
    expect([...new URL((await efface).url()).searchParams.keys()].filter((k) => k !== "limit"), "plus aucun filtre").toEqual([]);

    /* 7. Le détail se lit : « clé : valeur », jamais un bloc de JSON. */
    const details = await page.locator("table tbody tr td:nth-child(5)").allInnerTexts();
    const brut = details.filter((d) => d.trim().startsWith("{") || d.includes('":'));
    expect(brut, "aucun JSON brut dans la colonne Détail").toEqual([]);

    /* 8. Lire ne se journalise pas — vérifié explicitement. */
    const lignes = await lireLeJournal(sup.contexte.request, { from: debut });
    const lectures = lignes.filter((l) => /AUDIT|JOURNAL/.test(l.action));
    expect(lectures, "aucune ligne écrite par la consultation du journal").toEqual([]);
  });

  /* ─────────────────────────────────────────────────────────────────────────────────────────── */

  test("ADM-NRG-7 · les cinq écarts documentaires connus, constatés dans leur état du jour", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    const sup = await navigateurAdmin("super");
    const privacy = await navigateurAdmin("privacy");
    const ops = await navigateurAdmin("exploitation");
    const constats: string[] = [];

    /* 1. L'export nominatif marche aussi pour le profil Données personnelles (A143) — le code fait foi. */
    const motifExport = "Recette ADM-NRG-7 : contrôle de l'écart documentaire n° 1 sur l'export nominatif.";
    const exportPrivacy = await privacy.contexte.request.get(`${api()}/admin/users/export?role=CARRIER&reason=${encodeURIComponent(motifExport)}`, { failOnStatusCode: false });
    expect(exportPrivacy.status(), "PRIVACY exporte (A143)").toBe(200);
    constats.push("1. l'export nominatif est ouvert au profil Données personnelles (A143) — plusieurs documents disent « super administrateur seul » : le code fait foi");

    /* 2. Le nom d'une règle garde son seuil historique. */
    const motif = MOTIF_DE_RECETTE("ADM-NRG-7");
    try {
      await poserSeuils(ops.contexte, { "alerts.payoutFailedHours": 1 }, motif);
      const alertes = await alertesQuand(ops.contexte, (a) => a.some((x) => x.rule === "PAYOUT_FAILED_48H"), "le versement en échec franchit le seuil d'une heure");
      const regle = alertes.find((a) => a.rule === "PAYOUT_FAILED_48H")!;
      expect(regle.title, "le TITRE suit le paramètre").toContain("plus de 1 h");
      expect(regle.rule, "le CODE garde son seuil historique").toBe("PAYOUT_FAILED_48H");
      constats.push("2. le code de règle `PAYOUT_FAILED_48H` reste inchangé quand le paramètre vaut 1 h — le titre, lui, suit le paramètre : écart assumé");
    } finally {
      await retablir(ops.contexte, ["alerts.payoutFailedHours"], motif);
    }

    /* 3. Un refus d'effacement (409) : au registre `DataRequest`, pas au journal admin. */
    const thomas = jeuEssai.membre("thomas");
    const debut = await debutDuScenario();
    const refus = await privacy.contexte.request.post(`${api()}/admin/users/${thomas}/erase`, { data: { reason: "Recette ADM-NRG-7 : contrôle de l'écart documentaire n° 3, effacement refusé." }, failOnStatusCode: false });
    expect(refus.status(), "un deal vivant bloque l'effacement").toBe(409);
    const journalRefus = await lireLeJournal(sup.contexte.request, { from: debut, targetId: thomas });
    expect(journalRefus.filter((l) => l.action === "ACCOUNT_ERASED"), "aucune ligne ACCOUNT_ERASED").toEqual([]);
    const registre = lireCoteServeur<number>(`import prisma from "./packages/libs/prisma"; (async () => { console.log("@@" + (await prisma.dataRequest.count({ where: { userId: ${q(thomas)}, status: "REFUSED" } }))); process.exit(0); })();`);
    expect(registre, "le registre DataRequest garde la trace du refus").toBeGreaterThanOrEqual(1);
    constats.push("3. un refus d'effacement est inscrit au registre `DataRequest` (REFUSED) mais PAS au journal admin — conforme en l'état, à arbitrer : le registre suffit-il comme preuve ?");

    /* 4. LEVÉ (A194) : la tuile « Sanctions proposées » mène désormais à la sous-liste filtrée. */
    await ouvrir(sup.page, "/home");
    const tuile = sup.page.locator("main a[href='/users?proposal=1']");
    await expect(tuile, "la tuile pointe la liste filtrée").toHaveCount(1);
    const filtre = sup.page.waitForResponse((r) => r.url().includes("/api/admin/users?"), { timeout: 60_000 });
    await tuile.click();
    expect(new URL((await filtre).url()).searchParams.get("proposal"), "le filtre serveur part avec la liste").toBe("1");
    constats.push("4. écart LEVÉ (A194) : la tuile « Sanctions proposées » ouvre `/users?proposal=1`, filtre serveur « sanction proposée » — la gêne d'usage signalée au cahier n'existe plus");

    /* 5. Codes de secours : régénérables (A190 a) ; la 2FA, elle, ne se réinitialise toujours que par « retirer / réinviter ». */
    await ouvrir(sup.page, "/sessions");
    await expect(sup.page.getByRole("button", { name: "Régénérer mes codes de secours" }), "A190 a").toHaveCount(1);
    await ouvrir(sup.page, "/admins");
    const reinit = await sup.page.getByRole("button", { name: /2FA|deux facteurs|réinitialiser/i }).count();
    expect(reinit, "aucun écran ne réinitialise la 2FA d'un autre admin").toBe(0);
    constats.push("5. écart PARTIELLEMENT levé (A190 a) : un admin régénère SES codes de secours depuis « Mes sessions » ; réinitialiser la 2FA d'un autre compte reste la procédure « retirer / réinviter » (ADM-CPT-5)");

    for (const c of constats) test.info().annotations.push({ type: "écart documentaire", description: c });
  });

  /* ─────────────────────────────────────────────────────────────────────────────────────────── */

  test("ADM-NRG-8 · gestes simultanés : un gagnant, un refus lisible, jamais 500 (A192, engagement du § 5.19)", async ({ navigateurAdmin, jeuEssai, mailpit }) => {
    test.setTimeout(8 * 60_000);
    const sup = await navigateurAdmin("super");
    const med = await navigateurAdmin("mediateur");
    const pauline = jeuEssai.membre("pauline");
    const debut = await debutDuScenario();
    const sujet = "Ton compte Yamba est restreint";
    const avantEmails = await mailpit.compter({ pour: COMPTES.pauline.email, sujet });

    /* 1. Trois applications simultanées de la MÊME sanction (deux administrateurs, trois clics). */
    const corps = { level: "RESTRICTED", category: "SCAM_SUSPECTED", reason: MOTIF_INTERNE };
    const reponses = await Promise.all([
      sup.contexte.request.post(`${api()}/admin/users/${pauline}/suspension`, { data: corps, failOnStatusCode: false }),
      med.contexte.request.post(`${api()}/admin/users/${pauline}/suspension`, { data: corps, failOnStatusCode: false }),
      sup.contexte.request.post(`${api()}/admin/users/${pauline}/suspension`, { data: corps, failOnStatusCode: false }),
    ]);
    const statuts = reponses.map((r) => r.status());
    process.stdout.write(`   ↳ trois applications simultanées : ${statuts.join(", ")}\n`);
    expect(statuts.filter((s) => s === 500), "jamais 500 (c'était le P2034 brut)").toEqual([]);
    const gagnants = statuts.filter((s) => s === 200).length;
    expect(gagnants, "au moins un gagnant").toBeGreaterThanOrEqual(1);
    for (const r of reponses.filter((x) => x.status() !== 200)) {
      expect(r.status(), "un perdant lit un refus métier").toBe(409);
      expect(((await r.json()) as { details?: { code?: string } }).details?.code).toBe("ACCOUNT_STATE_CHANGED");
    }
    /* 2. Une ligne de journal et un email PAR GESTE RÉUSSI — jamais trois pour un clic. */
    const lignes = await lireLeJournal(sup.contexte.request, { from: debut, targetId: pauline, action: "USER_RESTRICTED" });
    expect(lignes.length, "autant de lignes que de gestes réussis").toBe(gagnants);
    await expect.poll(async () => mailpit.compter({ pour: COMPTES.pauline.email, sujet }), { timeout: 60_000 }).toBe(avantEmails + gagnants);

    /* 3. Trois levées simultanées : même règle. */
    const levees = await Promise.all([0, 1, 2].map(() => sup.contexte.request.delete(`${api()}/admin/users/${pauline}/suspension`, { data: { reason: "Recette ADM-NRG-8 : levée de la sanction de contrôle, fin de fiche." }, failOnStatusCode: false })));
    const statutsLevee = levees.map((r) => r.status());
    process.stdout.write(`   ↳ trois levées simultanées : ${statutsLevee.join(", ")}\n`);
    expect(statutsLevee.filter((s) => s === 500)).toEqual([]);
    expect(statutsLevee.filter((s) => s === 200).length, "une seule levée").toBe(1);
    const reinstate = await lireLeJournal(sup.contexte.request, { from: debut, targetId: pauline, action: "USER_REINSTATED" });
    expect(reinstate.length, "une seule ligne de levée").toBe(1);
    const etat = lireCoteServeur<{ accountStatus: string; suspensionCategory: string | null }>(`import prisma from "./packages/libs/prisma"; (async () => { const u = await prisma.user.findUnique({ where: { id: ${q(pauline)} }, select: { accountStatus: true, suspensionCategory: true } }); console.log("@@" + JSON.stringify(u)); process.exit(0); })();`);
    expect(etat, "le compte est rendu à son état").toMatchObject({ accountStatus: "ACTIVE", suspensionCategory: null });

    /* 4. Le TOTP sous concurrence : le même code, trois fois au même instant, n'ouvre qu'une session. */
    const jetable = creerAdminEnrole("NRG8");
    try {
      const ctx = await requeteApi.newContext();
      expect((await ctx.post(`${api()}/auth/admin/login`, { data: { email: jetable.email, password: MOT_DE_PASSE_SEED } })).status()).toBe(200);
      if (resteDuPas() < 5) await attendreLePasSuivant();
      const code = totpCode(jetable.secret);
      const verifs = await Promise.all([0, 1, 2].map(() => ctx.post(`${api()}/auth/admin/totp/verify`, { data: { code }, failOnStatusCode: false })));
      const statutsTotp = verifs.map((r) => r.status());
      process.stdout.write(`   ↳ trois vérifications TOTP du même code : ${statutsTotp.join(", ")}\n`);
      expect(statutsTotp.filter((s) => s === 500), "jamais 500").toEqual([]);
      expect(statutsTotp.filter((s) => s === 200).length, "un seul code servi : l'anti-rejeu tient sous concurrence").toBe(1);
      const sessions = lireCoteServeur<number>(`import redis from "./packages/libs/redis"; (async () => { console.log("@@" + (await redis.keys("admin_jti:${jetable.id}:*")).length); process.exit(0); })();`);
      expect(sessions, "une seule session ouverte").toBe(1);

      /* 5. Régénération des codes de secours (A190 a) : trois clics du même code, un seul jeu rendu.
            Le pas TOTP qui vient de servir à la connexion est brûlé (anti-rejeu) : on attend le SUIVANT. */
      await attendreLePasSuivant();
      const codeBis = totpCode(jetable.secret);
      const regens = await Promise.all([0, 1, 2].map(() => ctx.post(`${api()}/admin/me/backup-codes`, { data: { code: codeBis }, failOnStatusCode: false })));
      const statutsRegen = regens.map((r) => r.status());
      process.stdout.write(`   ↳ trois régénérations simultanées : ${statutsRegen.join(", ")}\n`);
      expect(statutsRegen.filter((s) => s === 500), "jamais 500").toEqual([]);
      expect(statutsRegen.filter((s) => s === 200).length, "un seul jeu de codes rendu (deux jeux, c'est un jeu mort à l'écran)").toBe(1);
      const regenLignes = await lireLeJournal(sup.contexte.request, { from: debut, targetId: jetable.id, action: "ADMIN_BACKUP_CODES_REGENERATED" });
      expect(regenLignes.length, "une seule ligne de régénération").toBe(1);
      await ctx.dispose();
    } finally {
      retirerLAcces(jetable);
    }
  });

  /* ─────────────────────────────────────────────────────────────────────────────────────────── */

  test("ADM-NRG-9 · la catégorie de sanction part au membre, le motif interne reste au back-office (A193, ANO-ADM-90)", async ({ navigateurAdmin, navigateurConnecte, jeuEssai, mailpit }) => {
    test.setTimeout(8 * 60_000);
    const sup = await navigateurAdmin("super");
    const support = await navigateurAdmin("support");
    const pauline = jeuEssai.membre("pauline");
    const sujet = "Ton compte Yamba est restreint";
    const avant = await mailpit.compter({ pour: COMPTES.pauline.email, sujet });
    try {
      /* 1. Sans catégorie, le serveur refuse : la liste fermée est REQUISE des deux côtés. */
      const sans = await appel(support.contexte, "POST", `/admin/users/${pauline}/suspension/propose`, { level: "RESTRICTED", reason: MOTIF_INTERNE });
      expect(sans.statut, "proposer sans catégorie : refusé").toBe(400);
      const sansApply = await appel(sup.contexte, "POST", `/admin/users/${pauline}/suspension`, { level: "RESTRICTED", reason: MOTIF_INTERNE });
      expect(sansApply.statut, "appliquer sans catégorie : refusé").toBe(400);
      /* Une catégorie hors liste est refusée aussi (c'est une liste FERMÉE, pas un texte). */
      const horsListe = await appel(sup.contexte, "POST", `/admin/users/${pauline}/suspension`, { level: "RESTRICTED", category: "PARCE_QUE", reason: MOTIF_INTERNE });
      expect(horsListe.statut, "catégorie inconnue : refusée").toBe(400);

      /* 2. Proposition puis application, avec la catégorie. */
      expect((await appel(support.contexte, "POST", `/admin/users/${pauline}/suspension/propose`, { level: "RESTRICTED", category: "SCAM_SUSPECTED", reason: MOTIF_INTERNE })).statut).toBe(200);
      expect((await appel(sup.contexte, "POST", `/admin/users/${pauline}/suspension`, { level: "RESTRICTED", category: "SCAM_SUSPECTED", reason: MOTIF_INTERNE })).statut).toBe(200);

      /* 3. L'email du membre : la catégorie, jamais le motif interne. */
      const mail = await mailpit.attendreEmail({ pour: COMPTES.pauline.email, sujet }, 60_000);
      expect(mail.texte, "l'exposé des motifs, dans la langue du membre").toContain("Motif : Arnaque suspectée.");
      expect(mail.texte, "le motif interne ne quitte pas le back-office (A191)").not.toContain(MOTIF_INTERNE);
      expect(mail.texte, "ni le nom d'un signalant").not.toContain("Aminata");

      /* 4. Ce que le membre lit de son côté : la catégorie, pas le motif (ANO-ADM-90). */
      const membre = await navigateurConnecte("pauline");
      const me = await membre.contexte.request.get(`${apiMembre()}/auth/me`);
      expect(me.status(), "un compte restreint lit toujours son profil").toBe(200);
      const corpsMe = JSON.parse(await me.text()) as Record<string, unknown> & { user?: Record<string, unknown> };
      const profil = (corpsMe.user ?? corpsMe) as Record<string, unknown>;
      expect(profil.suspensionCategory, "la catégorie fermée est servie").toBe("SCAM_SUSPECTED");
      expect(Object.keys(profil), "le motif LIBRE ne part jamais au membre (ANO-ADM-90)").not.toContain("suspensionReason");
      expect(await me.text(), "et il n'apparaît nulle part dans la réponse").not.toContain(MOTIF_INTERNE);

      /* 5. La fiche admin, elle, montre les deux — en les NOMMANT. */
      await ouvrir(sup.page, `/users/${pauline}`);
      const bandeau = sup.page.getByText(/^Restreint depuis le /);
      await expect(bandeau).toBeVisible({ timeout: 60_000 });
      const texte = (await bandeau.innerText()).replace(/\s+/g, " ");
      expect(texte).toContain("catégorie envoyée au membre : Arnaque suspectée");
      expect(texte).toContain(`motif interne : ${MOTIF_INTERNE}`);

      /* 6. Un compte sanctionné AVANT A193 (catégorie absente en base) se lit « Autre », jamais une erreur. */
      lireCoteServeur(`import prisma from "./packages/libs/prisma"; (async () => { await prisma.user.update({ where: { id: ${q(pauline)} }, data: { suspensionCategory: null } }); console.log("@@true"); process.exit(0); })();`);
      process.stdout.write("   ↳ manœuvre base : catégorie effacée, comme une sanction prononcée avant A193\n");
      const fiche = await sup.contexte.request.get(`${api()}/admin/users/${pauline}`);
      expect(fiche.status(), "la fiche se lit quand même").toBe(200);
      expect(((await fiche.json()) as { suspension: { category: string } }).suspension.category, "lecture tolérante : OTHER").toBe("OTHER");
      await ouvrir(sup.page, `/users/${pauline}`);
      await expect(sup.page.getByText(/catégorie envoyée au membre : Autre manquement aux règles d'utilisation/)).toBeVisible({ timeout: 60_000 });
    } finally {
      await appel(sup.contexte, "DELETE", `/admin/users/${pauline}/suspension`, { reason: "Recette ADM-NRG-9 : levée de la sanction de contrôle, fin de fiche." });
    }
    expect((await mailpit.compter({ pour: COMPTES.pauline.email, sujet })) - avant, "un seul email de restriction pour un seul geste").toBe(1);
  });
});

/* ══ Manœuvres base consignées ═══════════════════════════════════════════════════════════════ */

type Jetable = { id: string; email: string; secret: string };

/** Un administrateur ENRÔLÉ posé en base (comme aux § 5.25 / 5.26) : une fiche de concurrence ne touche jamais un compte du harnais. */
function creerAdminEnrole(fiche: string): Jetable {
  const email = `nrg-${fiche.toLowerCase()}-${Date.now()}@recette.yamba.dev`;
  const r = lireCoteServeur<{ id: string; secret: string }>(`
    import prisma from "./packages/libs/prisma";
    import bcrypt from "bcryptjs";
    import { encryptTotpSecret, generateTotpSecret } from "./packages/libs/totp/src/index";
    (async () => {
      const secret = generateTotpSecret();
      const u = await prisma.user.create({ data: {
        firstName: "Recette", lastName: ${q(fiche)}, email: ${q(email)}, emailNormalized: ${q(email)},
        publicSlug: ${q(`recette-${email.split("@")[0]}`)}, passwordHash: await bcrypt.hash(${q(MOT_DE_PASSE_SEED)}, 10),
        roles: ["ADMIN"], adminRoles: ["SUPPORT"], adminRole: "SUPPORT",
        totpSecretEncrypted: encryptTotpSecret(secret), totpEnabledAt: new Date(), totpLastUsedStep: null,
        totpBackupCodeHashes: ["recette-inutilisable-0", "recette-inutilisable-1"], carrierStatus: "NONE",
      } });
      console.log("@@" + JSON.stringify({ id: u.id, secret }));
      process.exit(0);
    })();`);
  process.stdout.write(`   ↳ manœuvre base : administrateur enrôlé ${email} (SUPPORT)\n`);
  return { id: r.id, email, secret: r.secret };
}

/** Fin de fiche : l'accès est retiré et ses sessions effacées (la liste des comptes admin reste juste). */
function retirerLAcces(j: Jetable): void {
  lireCoteServeur(`
    import prisma from "./packages/libs/prisma";
    import redis from "./packages/libs/redis";
    (async () => {
      await prisma.user.update({ where: { id: ${q(j.id)} }, data: { roles: [], adminRoles: [], adminRole: null } });
      const cles = await redis.keys("admin_jti:${j.id}:*");
      if (cles.length) await redis.del(...cles);
      console.log("@@true"); process.exit(0);
    })();`);
}

/** Secondes restantes dans le pas TOTP courant : un code présenté à cheval sur deux pas fausserait la mesure. */
const resteDuPas = () => TOTP_STEP_SECONDS - (Math.floor(Date.now() / 1000) % TOTP_STEP_SECONDS);
/** Attend le pas TOTP SUIVANT : un pas déjà servi est refusé (anti-rejeu, A192) — c'est ce qu'on veut prouver, pas ce qu'on subit. */
const attendreLePasSuivant = () => new Promise((r) => setTimeout(r, (resteDuPas() + 1) * 1000));
