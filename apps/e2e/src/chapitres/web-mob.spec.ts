/**
 * web-mob.spec.ts — cahier 01-WEB, chapitre 5.30 « Responsive mobile »
 * =====================================================================
 * Tout se joue en **émulation iPhone 14 (390 × 844, tactile)** — sauf WEB-MOB-7, qui vise la zone intermédiaire
 * (800 px) où la colonne de droite du Voyageur avait disparu. Le harnais ouvre donc ses navigateurs avec
 * `{ mobile: true }` : un simple `viewport` étroit ne suffirait pas, car le produit rend des arbres DIFFÉRENTS
 * selon `isMobile` / `hasTouch` (feuilles du bas, barres collantes, `useIsMobile`).
 *
 * **La règle générale du chapitre** — la page ne défile JAMAIS horizontalement : un contenu large défile dans son
 * propre cadre. `aucunDebordement()` la vérifie sur chaque écran visité, et nomme le coupable quand elle échoue
 * (l'élément le plus à droite), parce qu'un « scrollWidth > innerWidth » sans nom ne se corrige pas.
 */
import { test, expect, type Navigateur } from "../fixtures/yamba";
import { adresseDeLApi } from "../fixtures/adresses";
import { JeuEssai } from "../fixtures/jeu-essai";
import { FilMessagerie } from "../pages/fil-messagerie";
import { ouvrirLaRecherche } from "../pages/recherche";
import { normaliserEspaces } from "../pages/reservation";

type Page = Navigateur["page"];
const api = () => adresseDeLApi();
const texte = async (page: Page) => normaliserEspaces(await page.locator("body").innerText());

/**
 * La règle du chapitre. En cas de débordement, on rend l'élément fautif : son sélecteur, sa largeur et son bord
 * droit — de quoi corriger sans chercher.
 */
async function aucunDebordement(page: Page, ou: string): Promise<void> {
  const verdict = await page.evaluate(() => {
    const largeur = document.documentElement.clientWidth;
    const deborde = document.documentElement.scrollWidth - largeur;
    if (deborde <= 1) return { deborde, coupable: null as string | null };
    let pire: { nom: string; droite: number } | null = null as { nom: string; droite: number } | null;
    document.querySelectorAll<HTMLElement>("body *").forEach((n) => {
      const r = n.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const dejaVu: { nom: string; droite: number } | null = pire;
      if (r.right > largeur + 1 && (!dejaVu || r.right > dejaVu.droite)) {
        const classe = typeof n.className === "string" ? n.className.slice(0, 60) : "";
        pire = { nom: `${n.tagName.toLowerCase()}${n.id ? `#${n.id}` : ""}${classe ? `.${classe.trim().split(/\s+/).slice(0, 3).join(".")}` : ""}`, droite: Math.round(r.right) };
      }
    });
    const fautif: { nom: string; droite: number } | null = pire;
    return { deborde, coupable: fautif ? `${fautif.nom} (bord droit ${fautif.droite} px pour ${largeur} px d'écran)` : "inconnu" };
  });
  expect(verdict.deborde, `${ou} : la page déborde de ${verdict.deborde} px — ${verdict.coupable}`).toBeLessThanOrEqual(1);
}

/** Un élément tient-il dans l'écran ? (bord droit et bord gauche compris dans la fenêtre) */
async function tientDansLEcran(page: Page, cible: ReturnType<Page["locator"]>, quoi: string): Promise<void> {
  const largeur = await page.evaluate(() => document.documentElement.clientWidth);
  const boite = await cible.boundingBox();
  expect(boite, `${quoi} : élément absent`).toBeTruthy();
  expect(boite!.x, `${quoi} : déborde à gauche`).toBeGreaterThanOrEqual(-1);
  expect(boite!.x + boite!.width, `${quoi} : déborde à droite (${Math.round(boite!.x + boite!.width)} px pour ${largeur} px)`).toBeLessThanOrEqual(largeur + 1);
}

/**
 * Rien ne sort du cadre — sauf ce qui défile DANS son propre cadre.
 *
 * La règle du cahier n'interdit pas le contenu large : elle interdit qu'il pousse la PAGE. Une
 * rangée de réponses rapides, une frise, un tableau ont le droit de dépasser à condition qu'un
 * ancêtre les fasse défiler horizontalement (`overflow-x: auto|scroll`). On ignore donc ces
 * éléments-là, et on ne garde que les débordements francs.
 */
async function rienNeSortDuCadre(page: Page, ou: string): Promise<void> {
  const sortis = await page.evaluate(() => {
    const largeur = document.documentElement.clientWidth;
    const hors: string[] = [];
    const defileDansSonCadre = (n: HTMLElement): boolean => {
      let parent: HTMLElement | null = n.parentElement;
      while (parent && parent !== document.body) {
        const style = getComputedStyle(parent);
        if (/(auto|scroll)/.test(style.overflowX) && parent.scrollWidth > parent.clientWidth + 1) return true;
        parent = parent.parentElement;
      }
      return false;
    };
    document.querySelectorAll<HTMLElement>("main *").forEach((n) => {
      const r = n.getBoundingClientRect();
      if (r.width <= 40 || r.height <= 10 || r.right <= largeur + 1) return;
      if (defileDansSonCadre(n)) return;
      hors.push(`${n.tagName.toLowerCase()} « ${(n.innerText ?? "").slice(0, 40)} » → ${Math.round(r.right)} px`);
    });
    return hors.slice(0, 5);
  });
  expect(sortis, `${ou} : rien ne sort à droite (${sortis.join(" | ")})`).toHaveLength(0);
}

/* ══ Les fiches ══════════════════════════════════════════════════════════════════════════════ */

test.describe("WEB-MOB — responsive mobile (chapitre 5.30)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(() => {
    new JeuEssai().rejouer();
  });

  test("WEB-MOB-1 · l'accueil et l'en-tête sur téléphone", async ({ navigateurVisiteur }) => {
    const { page } = await navigateurVisiteur({ mobile: true });
    await page.goto("/fr", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 90_000 });
    await aucunDebordement(page, "accueil");
    /* La barre de recherche tient dans l'écran. */
    const recherche = page.getByRole("button", { name: /Rechercher/ }).first();
    if (await recherche.count()) await tientDansLEcran(page, recherche, "le bouton de recherche");
    /* Le menu s'ouvre en panneau et se referme. */
    await page.getByRole("button", { name: "Ouvrir le menu" }).click();
    await expect(page.getByRole("button", { name: "Fermer le menu" })).toBeVisible({ timeout: 30_000 });
    await aucunDebordement(page, "accueil, menu ouvert");
    // « Fermer le menu » est le VOILE plein écran : son centre est couvert par la feuille du bas.
    // On le touche en haut — exactement le geste d'un doigt qui tape à côté du panneau.
    await page.getByRole("button", { name: "Fermer le menu" }).first().click({ position: { x: 8, y: 8 } });
    await expect(page.getByRole("button", { name: "Ouvrir le menu" })).toBeVisible({ timeout: 30_000 });
  });

  test("WEB-MOB-2 · la recherche et ses filtres en feuille du bas", async ({ navigateurVisiteur }) => {
    const { page } = await navigateurVisiteur({ mobile: true });
    await ouvrirLaRecherche(page, { from: "Paris", to: "Brazzaville" });
    // Le TITRE (« Trajets pour Paris → Brazzaville ») s'affiche avant les cartes : on attend ce qui
    // n'existe que sur une carte — un prix — sans quoi la fiche lit la page à moitié rendue.
    await expect.poll(() => texte(page), { timeout: 90_000, message: "les cartes de résultat arrivent" }).toMatch(/€/);
    await aucunDebordement(page, "résultats de recherche");
    /* Les cartes restent lisibles : prix, kilos, cœur. */
    const corps = await texte(page);
    expect(corps, "les kilos sont lisibles").toMatch(/kg/);
    /* Les filtres s'ouvrent en feuille du bas, se manipulent, s'appliquent et se referment. */
    const filtres = page.getByRole("button", { name: /^Filtres/ }).first();
    await expect(filtres).toBeVisible({ timeout: 30_000 });
    await filtres.click();
    const feuille = page.getByRole("dialog").filter({ hasText: "Filtres" }).first();
    await expect(feuille).toBeVisible({ timeout: 30_000 });
    await aucunDebordement(page, "feuille des filtres");
    await tientDansLEcran(page, feuille, "la feuille des filtres");
    /* Le bouton d'application porte le nombre de résultats (« Voir 5 trajets ») : c'est LUI qui ferme. */
    await feuille.getByRole("button", { name: /^Voir \d+ trajets?$/ }).first().click();
    await expect(feuille, "la feuille se referme en appliquant").toBeHidden({ timeout: 30_000 });
    /* Et l'échappement aussi — une fenêtre annoncée comme telle doit avoir sa porte de sortie. */
    await filtres.click();
    await expect(feuille).toBeVisible({ timeout: 30_000 });
    await page.keyboard.press("Escape");
    await expect(feuille, "Échap referme la feuille").toBeHidden({ timeout: 30_000 });
    await aucunDebordement(page, "résultats après filtres");
  });

  test("WEB-MOB-3 · la barre de réservation mobile", async ({ navigateurVisiteur, jeuEssai }) => {
    const { page } = await navigateurVisiteur({ mobile: true });
    await page.goto(`/fr/trips/${jeuEssai.trajet("bzv-upcoming")}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 90_000 });
    await aucunDebordement(page, "page d'un trajet");
    const reserver = page.getByRole("button", { name: /^Réserver/ }).last();
    await expect(reserver).toBeVisible({ timeout: 60_000 });
    const hauteurEcran = await page.evaluate(() => window.innerHeight);
    const enBas = async () => {
      const b = await reserver.boundingBox();
      return b ? b.y > hauteurEcran * 0.5 && b.y < hauteurEcran : false;
    };
    expect(await enBas(), "le bouton est dans une barre du bas").toBe(true);
    /* Et il RESTE accessible pendant le défilement. */
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(800);
    await expect(reserver, "la barre survit au défilement").toBeVisible();
    expect(await enBas(), "et elle reste en bas").toBe(true);
    await tientDansLEcran(page, reserver, "le bouton Réserver");
    expect(await texte(page), "le prix est dans la barre").toMatch(/€/);
  });

  test("WEB-MOB-4 · l'assistant de réservation en feuille du bas", async ({ navigateurConnecte, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    const { page } = await navigateurConnecte("aminata", { mobile: true });
    await page.goto(`/fr/trips/${jeuEssai.trajet("bzv-upcoming")}/book`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Décris ton colis")).toBeVisible({ timeout: 90_000 });
    await aucunDebordement(page, "assistant, étape 1");
    /* Le total est visible en permanence, et « Détail » ouvre le récapitulatif. */
    const detail = page.getByRole("button", { name: "Détail" }).first();
    await expect(detail, "la barre du bas porte « Détail »").toBeVisible({ timeout: 30_000 });
    await detail.click();
    await expect(page.getByRole("button", { name: "Masquer" }).first()).toBeVisible({ timeout: 30_000 });
    await aucunDebordement(page, "assistant, récapitulatif ouvert");
    await page.getByRole("button", { name: "Masquer" }).first().click();
    await expect(page.getByRole("button", { name: "Détail" }).first()).toBeVisible({ timeout: 30_000 });
    /* Aucun champ coupé : chaque saisie de l'étape tient dans l'écran. */
    const champs = page.locator("main input:visible, main textarea:visible, main select:visible");
    for (let i = 0; i < (await champs.count()); i++) await tientDansLEcran(page, champs.nth(i), `le champ ${i + 1} de l'étape 1`);
  });

  test("WEB-MOB-5 · les bulles de messagerie tiennent dans l'écran", async ({ navigateurConnecte, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    const { page, contexte } = await navigateurConnecte("pauline", { mobile: true });
    const fil = await FilMessagerie.identifiantDuFil(contexte, jeuEssai.deal("bzv-accepted").id);
    await page.goto(`/fr/dashboard/messages?conversation=${fil}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByPlaceholder("Écrire un message…")).toBeVisible({ timeout: 90_000 });
    await aucunDebordement(page, "fil de messagerie");
    /* Régression connue (#175, WEB-NRG-5) : les bulles de l'AUTEUR sortaient du cadre. */
    await rienNeSortDuCadre(page, "fil de messagerie");
    /* Les réponses rapides défilent dans LEUR cadre, pas dans la page. */
    await aucunDebordement(page, "fil, réponses rapides comprises");
    /* Le bouton du numéro est dans l'écran (le fil d'un deal accepté le propose). */
    const numero = page.getByRole("button", { name: "Voir le numéro" }).first();
    if (await numero.count()) await tientDansLEcran(page, numero, "« Voir le numéro »");
  });

  test("WEB-MOB-6 · la croix de fermeture de la porte d'identité", async ({ navigateurVisiteur, jeuEssai }) => {
    const { page } = await navigateurVisiteur({ mobile: true });
    await page.goto(`/fr/trips/${jeuEssai.trajet("bzv-upcoming")}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 90_000 });
    await page.getByRole("button", { name: /^Réserver/ }).last().click();
    const porte = page.getByRole("dialog").first();
    await expect(porte).toBeVisible({ timeout: 60_000 });
    /* La croix : visible AUSSI sur téléphone (régression WEB-NRG-3). Son NOM ACCESSIBLE est
       « Plus tard » — le même que le lien du bas et que le voile : on la reconnaît donc à sa
       position, en haut de la feuille. (Constat consigné : trois contrôles, un seul nom.) */
    const boitePorte = (await porte.boundingBox())!;
    const candidats = porte.getByRole("button", { name: "Plus tard" });
    let croix: { x: number; y: number; width: number; height: number } | null = null;
    for (let i = 0; i < (await candidats.count()); i++) {
      const b = await candidats.nth(i).boundingBox();
      if (!b || b.width > 80 || b.height > 80) continue; // le voile plein écran n'est pas la croix
      if (b.y < boitePorte.y + boitePorte.height / 3) croix = b;
    }
    expect(croix, "une croix de fermeture, en haut de la feuille").not.toBeNull();
    const largeurEcran = await page.evaluate(() => document.documentElement.clientWidth);
    expect(croix!.x + croix!.width, "la croix tient dans l'écran").toBeLessThanOrEqual(largeurEcran + 1);
    expect(croix!.x, "et elle est à droite").toBeGreaterThan(largeurEcran / 2);
    /* La poignée de glissement et le lien « Plus tard » sont là aussi. */
    await expect(porte.getByText("Plus tard", { exact: true }).last(), "le lien « Plus tard »").toBeVisible();
    await aucunDebordement(page, "porte d'identité");
    /* Et la croix ferme réellement. */
    await page.mouse.click(croix!.x + croix!.width / 2, croix!.y + croix!.height / 2);
    await expect(porte).toBeHidden({ timeout: 30_000 });
    test.info().annotations.push({ type: "constat", description: `croix ${Math.round(croix!.width)}×${Math.round(croix!.height)} px en haut à droite ; son nom accessible est « Plus tard », comme le lien du bas et le voile — trois contrôles pour un seul nom` });
  });

  test("WEB-MOB-7 · l'écran du deal entre 768 et 1024 px", async ({ navigateurConnecte, jeuEssai }) => {
    /* 800 px : ni téléphone, ni grand écran — la zone où la colonne de droite avait disparu. */
    const { page } = await navigateurConnecte("thomas", { mobile: { width: 800, height: 900 } });
    await page.goto(`/fr/carrier/deals/${jeuEssai.deal("bzv-accepted").id}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 90_000 });
    await aucunDebordement(page, "deal Voyageur en 800 px");
    const corps = await texte(page);
    expect(corps, "les gains du Voyageur sont visibles").toMatch(/€/);
    /* Le bouton principal de l'écran est présent et dans la fenêtre. */
    const principal = page.getByRole("button").filter({ hasText: /Envoyer un message|Prendre en charge|Voir le Deal|Marquer/ }).first();
    if (await principal.count()) await tientDansLEcran(page, principal, "le bouton principal");
    expect((await principal.count()) + (await page.getByRole("link").filter({ hasText: /Envoyer un message/ }).count()), "la colonne d'actions n'a pas disparu").toBeGreaterThan(0);
  });

  test("WEB-MOB-8 · les six cases du code sur téléphone", async ({ navigateurConnecte, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    const { page } = await navigateurConnecte("thomas", { mobile: true });
    await page.goto(`/fr/carrier/deals/${jeuEssai.deal("bzv-picked").id}/deliver`, { waitUntil: "domcontentloaded" });
    const cases = page.locator('input[inputmode="numeric"]');
    await expect(cases.first()).toBeVisible({ timeout: 90_000 });
    expect(await cases.count(), "six cases").toBe(6);
    await aucunDebordement(page, "écran de livraison");
    /* Les six cases tiennent sur UNE ligne. */
    const lignes = new Set<number>();
    for (let i = 0; i < 6; i++) {
      const b = await cases.nth(i).boundingBox();
      lignes.add(Math.round((b?.y ?? 0) / 10));
      await tientDansLEcran(page, cases.nth(i), `la case ${i + 1}`);
    }
    expect(lignes.size, "les six cases sont sur la même ligne").toBe(1);
    /* Le clavier numérique : c'est `inputmode` qui le décide sur téléphone. */
    expect(await cases.first().getAttribute("inputmode")).toBe("numeric");
    /* Coller un code de six chiffres remplit les six cases d'un coup. */
    await cases.first().click();
    await page.evaluate(() => {
      const champ = document.querySelector('input[inputmode="numeric"]') as HTMLInputElement | null;
      const donnees = new DataTransfer();
      donnees.setData("text/plain", "742891");
      champ?.dispatchEvent(new ClipboardEvent("paste", { clipboardData: donnees, bubbles: true }));
    });
    await expect.poll(async () => (await cases.allInnerTexts()).length && (await Promise.all([...Array(6).keys()].map((i) => cases.nth(i).inputValue()))).join(""), { timeout: 15_000, message: "le collage remplit les six cases" }).toBe("742891");
  });

  test("WEB-MOB-9 · les listes du tableau de bord sur téléphone", async ({ navigateurConnecte }) => {
    test.setTimeout(6 * 60_000);
    const { page } = await navigateurConnecte("aminata", { mobile: true });
    for (const [chemin, nom] of [
      ["/fr/dashboard/shipments", "Mes envois"],
      ["/fr/dashboard/trips", "Mes trajets"],
      ["/fr/dashboard/finances", "Finances"],
    ] as const) {
      await page.goto(chemin, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 90_000 });
      await page.waitForTimeout(1_500);
      await aucunDebordement(page, nom);
      /* Les montants alignés à droite restent visibles : aucun élément de la liste ne sort. */
      await rienNeSortDuCadre(page, nom);
    }
  });

  test("WEB-MOB-10 · la page destinataire sur téléphone", async ({ navigateurConnecte, navigateurVisiteur, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    /* L'Expéditrice crée le lien (son geste), le destinataire l'ouvre SANS session, sur téléphone. */
    const aminata = await navigateurConnecte("aminata");
    const creation = await aminata.contexte.request.post(`${api()}/deals/${jeuEssai.deal("bzv-picked").id}/tracking-link`);
    expect(creation.ok(), `création du lien : ${creation.status()} ${await creation.text()}`).toBe(true);
    // L'API rend un chemin RELATIF (`/track/<jeton>`) — parfois sous `url`, parfois sous `path`.
    const servi = (await creation.json()) as { url?: string; path?: string };
    const brut = servi.url ?? servi.path ?? "";
    const chemin = brut.startsWith("http") ? new URL(brut).pathname : brut;
    expect(chemin, "un lien de suivi").toMatch(/\/track\/[A-Za-z0-9_-]+$/);

    const { page } = await navigateurVisiteur({ mobile: true });
    await page.goto(chemin, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 90_000 });
    await page.waitForTimeout(1_500);
    await aucunDebordement(page, "page destinataire");
    const corps = await texte(page);
    expect(corps, "la frise des jalons est lisible").toMatch(/Colis pris en charge|En transit|Livré|Prise en charge/i);
    /* Le bloc d'acquisition (« créer un compte ») tient dans l'écran. */
    const acquisition = page.getByRole("link").filter({ hasText: /Créer un compte|Découvrir Yamba|Inscris-toi/ }).first();
    if (await acquisition.count()) await tientDansLEcran(page, acquisition, "le bloc d'acquisition");
  });
});
