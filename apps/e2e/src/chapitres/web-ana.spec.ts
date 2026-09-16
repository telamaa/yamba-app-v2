/**
 * web-ana.spec.ts — cahier 01-WEB, chapitre 5.27 « Le consentement à la mesure d'audience »
 * =========================================================================================
 * La bannière et ses deux issues, ce qui part quand on accepte (et ce qui ne doit JAMAIS en faire partie), la reprise
 * du choix du compte sur un autre appareil, le retrait de l'accord, et l'absence de clé.
 *
 * PRÉCONDITION DU CHAPITRE (cahier § 5.27) — `NEXT_PUBLIC_POSTHOG_KEY` et `NEXT_PUBLIC_POSTHOG_HOST` posées dans
 * `apps/user-ui/.env.local`, front redémarré. Sur ce poste : une clé de recette (`phc_recette_web_5_27`) et
 * `http://127.0.0.1:9977`, où le chapitre démarre **son propre collecteur** —
 * `scripts/recette/collecteur-audience.ts`, un faux PostHog local qui répond comme le vrai (configuration distante,
 * drapeaux, extensions inertes) et écrit chaque événement reçu dans un fichier. Rien ne sort du poste, et l'on voit
 * exactement ce que le navigateur aurait envoyé. La mesure SERVEUR (`POSTHOG_API_KEY`, racine) reste absente : elle
 * n'est pas du ressort de ce chapitre.
 *
 * DEUX PIÈGES PAYÉS ICI, et ils se paient une fois :
 *
 *  1. **Un collecteur qui répond mal casse le SDK sans le dire.** Sans configuration distante crédible, ou avec les
 *     « extensions » (sondages) servies vides, la fin de `init()` échoue et plus aucun événement n'est capturé : on
 *     prouverait une absence qu'on a soi-même fabriquée. D'où un vrai serveur, et non une interception.
 *  2. **posthog-js REFUSE de capturer depuis un navigateur automatisé.** `_is_bot()` renvoie `!!navigator.webdriver`
 *     et `capture()` s'arrête là, en silence (posthog-js 1.427, `opt_out_useragent_filter` non posé). Sans masquer ce
 *     drapeau, les fiches « rien ne part » seraient vraies pour la mauvaise raison, et « voilà ce qui part » serait
 *     impossible. `masquerLAutomatisation` retire donc CE marqueur — rien d'autre : l'application n'est pas touchée.
 *
 * Les fiches 1 à 5 se sautent d'elles-mêmes si la clé n'est pas posée, et la fiche 6 (« sans clé ») se saute si elle
 * l'est : le chapitre se joue donc en DEUX passes, chacune honnête sur sa précondition.
 */
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect, type Navigateur } from "../fixtures/yamba";
import { adresseDeLApi } from "../fixtures/adresses";
import { COMPTES } from "../fixtures/comptes";
import { JeuEssai } from "../fixtures/jeu-essai";
import { oublierSession } from "../fixtures/sessions";
import { ouvrirLaRecherche } from "../pages/recherche";
import { normaliserEspaces } from "../pages/reservation";

type Contexte = Navigateur["contexte"];
type Page = Navigateur["page"];
const api = () => adresseDeLApi();
const RACINE = join(__dirname, "../../../..");

/* ══ La clé du front, et le collecteur local ═════════════════════════════════════════════════ */

/** La valeur de `NEXT_PUBLIC_POSTHOG_*` telle que le front la voit (même lecture que `adresses.ts`). */
function variableDuFront(nom: string): string | null {
  for (const fichier of ["apps/user-ui/.env.local", ".env"]) {
    let contenu: string;
    try {
      contenu = readFileSync(join(RACINE, fichier), "utf-8");
    } catch {
      continue;
    }
    const ligne = contenu
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith(`${nom}=`))
      .pop();
    if (!ligne) continue;
    const valeur = ligne.slice(nom.length + 1).replace(/^["']|["']$/g, "").trim();
    if (valeur) return valeur;
  }
  return null;
}

const CLE_POSTHOG = variableDuFront("NEXT_PUBLIC_POSTHOG_KEY");
const HOTE_POSTHOG = (variableDuFront("NEXT_PUBLIC_POSTHOG_HOST") ?? "https://eu.i.posthog.com").replace(/\/$/, "");
const JOURNAL = join(RACINE, "apps/e2e/resultats/audience-5-27.jsonl");

type Envoi = { url: string; corps: string };

/** Démarre le faux PostHog du chapitre et attend qu'il réponde. */
async function demarrerLeCollecteur(): Promise<ChildProcess> {
  const enfant = spawn("npx", ["tsx", "scripts/recette/collecteur-audience.ts", "--out", JOURNAL, "--clear"], {
    cwd: RACINE,
    stdio: "ignore",
    env: { ...process.env, FORCE_COLOR: "0" },
  });
  for (let essai = 0; essai < 60; essai++) {
    try {
      const r = await fetch(`${HOTE_POSTHOG}/array/${CLE_POSTHOG}/config`);
      if (r.ok) return enfant;
    } catch {
      /* pas encore là */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("le collecteur d'audience n'a pas démarré");
}

/** Le journal du collecteur, vidé : chaque fiche part d'une page blanche. */
const viderLeJournal = () => writeFileSync(JOURNAL, "");

/** Ce que le collecteur a reçu depuis le dernier vidage. */
function evenementsRecus(): Array<{ url: string; event: string; properties: Record<string, unknown>; brut: string }> {
  let contenu = "";
  try {
    contenu = readFileSync(JOURNAL, "utf-8");
  } catch {
    return [];
  }
  return contenu
    .split("\n")
    .filter(Boolean)
    .map((ligne) => {
      const { url, evenement } = JSON.parse(ligne) as { url: string; evenement: { event?: string; properties?: Record<string, unknown> } };
      return { url, event: evenement.event ?? "", properties: evenement.properties ?? {}, brut: ligne };
    });
}

/**
 * Observe (sans intercepter) tout ce qui part vers la mesure : l'hôte du collecteur, et toute URL
 * qui parle de `posthog` — SAUF le chunk du module que `next dev` précharge
 * (`/_next/static/chunks/node_modules_posthog-js_…js`). Vérifié sur le build de production
 * (12/09/2026) : ce nom n'apparaît ni dans le HTML servi, ni dans les scripts chargés après un
 * refus — c'est un artefact du serveur de développement, pas un chargement du SDK.
 */
function observerLaMesure(contexte: Contexte): Envoi[] {
  const envois: Envoi[] = [];
  contexte.on("request", (r) => {
    const url = r.url();
    const versLeCollecteur = url.startsWith(HOTE_POSTHOG);
    const parleDePostHog = /posthog/i.test(url) && !/\/_next\/static\//.test(url);
    if (versLeCollecteur || parleDePostHog) envois.push({ url, corps: r.postData() ?? "" });
  });
  return envois;
}

/**
 * Retire le drapeau `navigator.webdriver` — et rien d'autre. posthog-js s'arrête net dessus
 * (`_is_bot()`), sans un mot : sans ce masque, « rien ne part » serait vrai pour la mauvaise raison.
 */
async function masquerLAutomatisation(contexte: Contexte): Promise<void> {
  await contexte.addInitScript(() => {
    try {
      Object.defineProperty(navigator, "webdriver", { get: () => false, configurable: true });
    } catch {
      /* déjà défini */
    }
  });
}

/**
 * Repart SANS choix de consentement, même dans un navigateur dont la session est mémorisée.
 *
 * PIÈGE PAYÉ ICI : `storageState` mémorise aussi le `localStorage`. Une fois qu'une fiche a
 * accepté, la session enregistrée d'Aminata porte `yamba.analytics.consent` — et la bannière ne se
 * présente plus jamais, dans ce chapitre comme dans les suivants. On efface donc la clé (et les
 * `ph_…` du SDK) sur l'origine, puis on recharge : l'écran repart comme un premier passage.
 */
async function partirSansChoix(page: Page): Promise<void> {
  await page.goto("/fr", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    try {
      window.localStorage.removeItem("yamba.analytics.consent");
      Object.keys(window.localStorage)
        .filter((k) => k.startsWith("ph_"))
        .forEach((k) => window.localStorage.removeItem(k));
    } catch {
      /* stockage indisponible */
    }
  });
  await page.reload({ waitUntil: "domcontentloaded" });
}

/** Le texte de tout ce qui est parti — pour y chercher ce qui ne doit jamais s'y trouver. */
const toutCeQuiEstParti = (envois: Envoi[]) =>
  [...envois.map((e) => `${e.url} ${e.corps}`), ...evenementsRecus().map((e) => e.brut)].join(" \n ");

/** Les clés que PostHog pose quand il DÉMARRE (`init`) : `ph_<clé>_posthog`. Aucune = il n'a pas démarré. */
const clesDuSdk = (page: Page) => page.evaluate(() => Object.keys(window.localStorage).filter((k) => k.startsWith("ph_")));

// PIÈGE : dès que le SDK tourne, `networkidle` n'arrive jamais (le collecteur est sollicité en
// continu) — mesuré : `page.goto` en délai d'attente de 120 s sur `/fr`. Tout ce chapitre navigue
// donc en `domcontentloaded` et attend ensuite ce qu'il vise.
const texte = async (page: Page) => normaliserEspaces(await page.locator("body").innerText());
const banniere = (page: Page) => page.getByRole("dialog", { name: "Mesure d'audience" });

const TEXTE_BANNIERE =
  "Avec ton accord, Yamba mesure comment le site est utilisé (pages vues, recherches, étapes d'une réservation) pour l'améliorer. " +
  "Aucune donnée n'est vendue ni partagée à des fins publicitaires ; tu peux changer d'avis dans Sécurité › Mes données.";

/* ══ Les fiches ══════════════════════════════════════════════════════════════════════════════ */

test.describe("WEB-ANA — le consentement à la mesure d'audience (chapitre 5.27)", () => {
  test.describe.configure({ mode: "serial" });

  /** Le consentement d'un compte survit au seed : le chapitre le pose lui-même (cf. 5.26). */
  const reglagesDuSeed = (reglages: Array<{ email: string; champs: Record<string, unknown> }>) =>
    execFileSync(
      "npx",
      ["tsx", "--env-file=.env", "-e", `import p from "./packages/libs/prisma"; (async () => { for (const r of ${JSON.stringify(reglages)}) await p.user.updateMany({ where: { emailNormalized: r.email }, data: r.champs }); process.exit(0); })();`],
      { cwd: RACINE, encoding: "utf-8", timeout: 180_000 },
    );

  let collecteur: ChildProcess | null = null;

  test.beforeAll(async () => {
    new JeuEssai().rejouer();
    // Aminata n'a JAMAIS choisi : la bannière doit se présenter (fiches 1 à 3).
    reglagesDuSeed([{ email: COMPTES.aminata.email, champs: { analyticsOptIn: null } }]);
    if (CLE_POSTHOG) collecteur = await demarrerLeCollecteur();
  });

  test.afterAll(() => {
    collecteur?.kill();
    reglagesDuSeed([{ email: COMPTES.aminata.email, champs: { analyticsOptIn: null } }]);
    // `storageState` mémorise le `localStorage` : la session d'Aminata porterait un consentement
    // accepté, et les chapitres suivants (comme ce chapitre au passage d'après) ne verraient plus
    // jamais la bannière. On l'oublie : la prochaine connexion se fera par l'écran.
    oublierSession("membre-aminata");
  });

  test("WEB-ANA-1 · la bannière s'affiche", async ({ navigateurVisiteur }) => {
    test.skip(!CLE_POSTHOG, "clé PostHog absente");
    const { page, contexte } = await navigateurVisiteur();
    await masquerLAutomatisation(contexte);
    await partirSansChoix(page);
    const boite = banniere(page);
    await expect(boite).toBeVisible({ timeout: 60_000 });
    /* Le texte, mot pour mot. */
    const lu = normaliserEspaces(await boite.innerText());
    expect(lu).toContain("Mesure d'audience");
    expect(lu).toContain(TEXTE_BANNIERE);
    /* Les trois éléments. */
    const accepter = boite.getByRole("button", { name: "Accepter" });
    const refuser = boite.getByRole("button", { name: "Refuser" });
    await expect(boite.getByRole("link", { name: "En savoir plus" })).toBeVisible();
    await expect(accepter).toBeVisible();
    await expect(refuser).toBeVisible();
    /* Même poids visuel : même hauteur, largeurs comparables, même police — et un vrai bouton. */
    const boiteAccepter = await accepter.boundingBox();
    const boiteRefuser = await refuser.boundingBox();
    expect(boiteAccepter && boiteRefuser, "les deux boutons sont dessinés").toBeTruthy();
    expect(Math.abs(boiteAccepter!.height - boiteRefuser!.height), "même hauteur").toBeLessThanOrEqual(2);
    expect(boiteRefuser!.width / boiteAccepter!.width, "largeurs comparables").toBeGreaterThan(0.6);
    const police = (l: typeof accepter) => l.evaluate((n) => getComputedStyle(n).fontSize);
    expect(await police(refuser), "même taille de police").toBe(await police(accepter));
    expect(await refuser.evaluate((n) => n.tagName), "le refus est un bouton, pas un lien").toBe("BUTTON");
    test.info().annotations.push({ type: "note", description: `Refuser ${Math.round(boiteRefuser!.width)}×${Math.round(boiteRefuser!.height)} px, Accepter ${Math.round(boiteAccepter!.width)}×${Math.round(boiteAccepter!.height)} px, police ${await police(refuser)}` });
  });

  test("ANO-WEB-89 · la bannière réserve sa place et ne condamne aucun bouton", async ({ navigateurVisiteur }) => {
    test.skip(!CLE_POSTHOG, "clé PostHog absente");
    const { page, contexte } = await navigateurVisiteur();
    await masquerLAutomatisation(contexte);
    /* La page de connexion : son bouton principal est en bas de la carte, là où la bannière se pose. */
    await page.goto("/fr/login", { waitUntil: "domcontentloaded" });
    await expect(banniere(page)).toBeVisible({ timeout: 60_000 });
    const bouton = page.locator("main form").first().locator("button[type=submit]");
    await expect(bouton).toBeVisible();

    /* 1. La hauteur de la bannière est publiée, et la mise en page la réserve en bas. */
    const espace = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--yamba-consent-space").trim());
    const reserve = await espace();
    expect(reserve, "la bannière publie sa hauteur").toMatch(/^\d+(\.\d+)?px$/);
    const hauteurBanniere = (await banniere(page).boundingBox())!.height;
    const defilement = () => page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    expect(await defilement(), "la page peut défiler d'au moins la hauteur de la bannière").toBeGreaterThanOrEqual(hauteurBanniere - 8);

    /* 2. Un seul défilement libère le bouton : rien n'est condamné. */
    const libre = () =>
      bouton.evaluate((n) => {
        const r = n.getBoundingClientRect();
        const dessus = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return dessus === n || n.contains(dessus as Node);
      });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(500);
    expect(await libre(), "après défilement, « Se connecter » n'est plus recouvert").toBe(true);

    /* 3. Une fois la bannière répondue, la place est rendue et le bouton est libre sans rien faire. */
    await banniere(page).getByRole("button", { name: "Refuser" }).click();
    await expect(banniere(page)).toHaveCount(0);
    // `global.css` déclare `--yamba-consent-space: 0px` sur `:root` : une fois la bannière partie,
    // la propriété retrouve cette valeur (et non la chaîne vide).
    expect(await espace(), "la place est rendue").toMatch(/^(0px)?$/);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    expect(await libre(), "et le bouton est atteignable directement").toBe(true);
    test.info().annotations.push({ type: "note", description: `avant correction, la bannière recouvrait « Se connecter » et « Inscris-toi » (mesuré en 1280×720) et la page ne défilait pas : le clic était intercepté par le dialogue. Après : ${reserve} réservés, ${Math.round(hauteurBanniere)} px de bannière, le bouton se libère d'un défilement puis complètement dès la réponse` });
  });

  test("WEB-ANA-2 · refuser ne charge rien", async ({ navigateurVisiteur, jeuEssai }) => {
    test.skip(!CLE_POSTHOG, "clé PostHog absente");
    viderLeJournal();
    const { page, contexte } = await navigateurVisiteur();
    await masquerLAutomatisation(contexte);
    const envois = observerLaMesure(contexte);
    await partirSansChoix(page);
    await expect(banniere(page)).toBeVisible({ timeout: 60_000 });
    /* Étape 2 — « Refuser ». */
    await banniere(page).getByRole("button", { name: "Refuser" }).click();
    await expect(banniere(page)).toHaveCount(0);
    /* Étape 3 — on navigue : accueil, recherche, page d'un trajet. */
    await ouvrirLaRecherche(page, { from: "Paris", to: "Brazzaville" });
    await page.goto(`/fr/trips/${jeuEssai.trajet("bzv-upcoming")}`, { waitUntil: "domcontentloaded" });
    await page.goto("/fr", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3_000);
    expect(envois, `aucune requête de mesure (${envois.map((e) => e.url).join(", ")})`).toHaveLength(0);
    expect(evenementsRecus(), "et le collecteur n'a rien reçu").toHaveLength(0);
    expect(await clesDuSdk(page), "le SDK n'a jamais démarré (aucune clé `ph_…`)").toHaveLength(0);
    /* La bannière ne revient pas, même après rechargement. */
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(banniere(page)).toHaveCount(0);
    expect(envois).toHaveLength(0);
    expect(evenementsRecus()).toHaveLength(0);
    test.info().annotations.push({ type: "note", description: "aucune requête, aucun événement, aucune clé `ph_…` après refus ; le chunk `node_modules_posthog-js_…js` que `next dev` précharge est un artefact du serveur de développement (absent du build de production)" });
  });

  test("WEB-ANA-3 · accepter, et vérifier ce qui part (ANO-WEB-90 close)", async ({ navigateurConnecte, jeuEssai }) => {
    test.skip(!CLE_POSTHOG, "clé PostHog absente");
    test.setTimeout(8 * 60_000);
    viderLeJournal();
    const { page, contexte } = await navigateurConnecte("aminata");
    await masquerLAutomatisation(contexte);
    const envois = observerLaMesure(contexte);
    await partirSansChoix(page);
    /* Étape 1 — « Accepter ». */
    await expect(banniere(page)).toBeVisible({ timeout: 60_000 });
    await banniere(page).getByRole("button", { name: "Accepter" }).click();
    await expect(banniere(page)).toHaveCount(0);
    /* Étapes 2 à 4 — recherche, trajet, début de réservation. Chaque étape attend SON événement :
       naviguer trop vite fait rater la capture (mesuré : `search_performed` et `trip_viewed`
       manquants parce que la fiche était déjà sur l'écran suivant). */
    const noms = () => [...new Set(evenementsRecus().map((e) => e.event))].filter(Boolean);
    /* CONSTAT : la page où l'on accepte n'est PAS comptée — l'effet des pages vues ne dépend que du
       chemin (`AnalyticsProvider`), pas du consentement : il a déjà renoncé avant le clic et ne
       repasse qu'à la navigation suivante. Sans conséquence pour la vie privée, mais la première
       page d'une visite manque toujours à la mesure (axe au rapport). */
    expect(evenementsRecus(), "rien n'est encore parti : l'accord ne recompte pas la page en cours").toHaveLength(0);
    await ouvrirLaRecherche(page, { from: "Paris", to: "Brazzaville" });
    await expect.poll(noms, { timeout: 90_000, message: "la page vue et la recherche partent" }).toContain("$pageview");
    await expect.poll(noms, { timeout: 90_000, message: "la recherche est mesurée" }).toContain("search_performed");
    const trajet = jeuEssai.trajet("bzv-upcoming");
    await page.goto(`/fr/trips/${trajet}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 90_000 });
    await expect.poll(noms, { timeout: 90_000, message: "la consultation du trajet est mesurée" }).toContain("trip_viewed");
    await page.goto(`/fr/trips/${trajet}/book`, { waitUntil: "domcontentloaded" }).catch(() => undefined);
    await expect.poll(noms, { timeout: 90_000, message: "l'étape de réservation est mesurée" }).toContain("booking_step_viewed");

    /* Le SDK a démarré, et ce sont les bons événements, avec les bonnes propriétés. */
    expect((await clesDuSdk(page)).length, "le SDK a démarré après l'accord").toBeGreaterThan(0);
    const vus = evenementsRecus();
    const recherche = vus.find((e) => e.event === "search_performed");
    /* ANO-WEB-90 : ces deux propriétés partaient toujours à `null` (l'événement lisait `origin` /
       `destination`, alors que les critères s'appellent `from` / `to`). */
    expect(recherche?.properties, "la recherche porte origine et destination").toMatchObject({ origin: "Paris", destination: "Brazzaville" });
    expect(typeof (recherche?.properties as { resultsCount?: unknown }).resultsCount, "et le nombre de résultats").toBe("number");
    const consultation = vus.find((e) => e.event === "trip_viewed");
    expect(consultation?.properties, "le trajet consulté porte son identifiant").toMatchObject({ tripId: trajet });
    /* AUCUNE donnée personnelle. */
    const parti = toutCeQuiEstParti(envois);
    const interdits: Array<[string, string]> = [
      ["prénom du membre", COMPTES.aminata.prenom],
      ["nom du membre", COMPTES.aminata.nom],
      ["email du membre", COMPTES.aminata.email],
      ["code de livraison", "742891"],
      ["code de livraison aéré", "742 891"],
      ["prénom du destinataire", "Clarisse"],
      ["nom du destinataire", "Mabiala"],
      ["numéro du destinataire", "+242061234567"],
      ["numéro du destinataire (chiffres)", "242061234567"],
    ];
    for (const [quoi, valeur] of interdits) expect(parti, `aucun ${quoi} dans ce qui part`).not.toContain(valeur);
    test.info().annotations.push({ type: "note", description: `${vus.length} événement(s) : ${noms().join(", ")} ; recherche = ${JSON.stringify(recherche?.properties)} ; trajet = ${JSON.stringify(consultation?.properties)}` });
  });

  test("WEB-ANA-4 · le choix suit le compte (second navigateur)", async ({ navigateurConnecte }) => {
    test.skip(!CLE_POSTHOG, "clé PostHog absente");
    /* Le compte a accepté (fiche 3) : on le relit au serveur avant d'ouvrir le second navigateur. */
    const premier = await navigateurConnecte("aminata");
    const me = (await (await premier.contexte.request.get(`${api()}/auth/me`)).json()) as { user: { analyticsOptIn?: boolean | null } };
    expect(me.user.analyticsOptIn, "le choix est enregistré sur le compte").toBe(true);
    /* Un second navigateur NEUF, même compte : la bannière ne redemande pas. */
    const second = await navigateurConnecte("aminata", { parEcran: true });
    await masquerLAutomatisation(second.contexte);
    await second.page.goto("/fr", { waitUntil: "domcontentloaded" });
    await second.page.waitForTimeout(4_000);
    await expect(banniere(second.page), "le choix du compte est repris sans redemander").toHaveCount(0);
    const local = await second.page.evaluate(() => window.localStorage.getItem("yamba.analytics.consent"));
    expect(local, "et il est recopié dans le navigateur").toContain("granted");
  });

  test("WEB-ANA-5 · retirer son accord", async ({ navigateurConnecte }) => {
    test.skip(!CLE_POSTHOG, "clé PostHog absente");
    const { page, contexte } = await navigateurConnecte("aminata");
    await masquerLAutomatisation(contexte);
    const envois = observerLaMesure(contexte);
    /* Étape 1 — « Sécurité » › « Mes données » : on désactive « Mesure d'audience ». */
    await page.goto("/fr/dashboard/security", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Mes données" })).toBeVisible({ timeout: 60_000 });
    const bascule = page.getByText("Mesure d'audience", { exact: true }).locator("xpath=../following-sibling::*[@role='switch'][1]");
    await expect(bascule).toHaveAttribute("aria-checked", "true", { timeout: 30_000 });
    const patch = page.waitForResponse((r) => r.url().includes("/auth/me/preferences") && r.request().method() === "PATCH", { timeout: 30_000 });
    await bascule.click();
    expect((await patch).ok(), "PATCH /auth/me/preferences").toBe(true);
    await expect(bascule).toHaveAttribute("aria-checked", "false", { timeout: 15_000 });
    /* Le retrait est enregistré sur le compte. */
    const me = (await (await contexte.request.get(`${api()}/auth/me`)).json()) as { user: { analyticsOptIn?: boolean | null } };
    expect(me.user.analyticsOptIn, "le retrait vit sur le compte").toBe(false);
    /* Étape 2 — on navigue : plus aucune requête de mesure, plus aucun événement.
       CONSTAT (noté au rapport) : le retrait n'annule pas ce qui était DÉJÀ capturé — le SDK
       vide sa file dans la seconde qui suit (ici les deux pages vues de l'écran « Sécurité »,
       capturées quand l'accord tenait encore). On laisse donc la file se vider, puis on repart
       d'une page blanche : ce qu'on veut prouver, c'est qu'AUCUNE page visitée APRÈS le retrait
       n'est mesurée. */
    await page.waitForTimeout(6_000);
    envois.length = 0;
    viderLeJournal();
    await ouvrirLaRecherche(page, { from: "Paris", to: "Brazzaville" });
    await page.goto("/fr", { waitUntil: "domcontentloaded" });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4_000);
    expect(envois, `plus aucune mesure (${envois.map((e) => e.url).join(", ")})`).toHaveLength(0);
    expect(evenementsRecus(), "et le collecteur ne reçoit plus rien").toHaveLength(0);
  });

  test("WEB-ANA-6 · sans clé, rien ne s'affiche", async ({ navigateurVisiteur }) => {
    test.skip(Boolean(CLE_POSTHOG), "clé PostHog posée (seconde passe : retirer la clé et redémarrer le front)");
    const { page, contexte } = await navigateurVisiteur();
    await masquerLAutomatisation(contexte);
    const envois = observerLaMesure(contexte);
    const erreurs: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") erreurs.push(m.text());
    });
    page.on("pageerror", (e) => erreurs.push(e.message));
    await partirSansChoix(page);
    await page.waitForTimeout(3_000);
    await expect(banniere(page), "aucune bannière sans clé").toHaveCount(0);
    expect(envois, "aucun envoi").toHaveLength(0);
    expect(await clesDuSdk(page), "le SDK n'a pas démarré").toHaveLength(0);
    expect(await texte(page), "la page est bien là").toContain("Yamba");
    /* Aucune erreur de console — hors les 401 attendus du sondage de session (ANO-WEB-01, chapitre 5.3). */
    const vraies = erreurs.filter((e) => !/401|Unauthorized|auth\/(me|refresh)/i.test(e));
    expect(vraies, `console propre (${vraies.join(" | ")})`).toHaveLength(0);
    test.info().annotations.push({ type: "note", description: `console : ${erreurs.length} erreur(s), dont ${erreurs.length - vraies.length} sondage de session` });
  });
});
