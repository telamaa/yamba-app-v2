/**
 * web-acc.spec.ts — cahier 01-WEB, chapitre 5.1 « Découverte, accueil et navigation »
 * ==================================================================================
 * Ce qu'un visiteur voit AVANT d'avoir un compte : la page d'accueil, l'en-tête, le pied de page,
 * la bascule de langue, le thème, les portes d'entrée du produit — puis l'accueil connecté et la
 * déconnexion. Douze fiches (WEB-ACC-1 à WEB-ACC-12), jouées dans l'ordre du cahier.
 *
 * Le chapitre est joué en **desktop** (`Desktop Chrome`, 1280 px) : l'en-tête et le pied de page
 * ont chacun DEUX arbres dans le DOM (un `md:hidden`, un `hidden md:block`), et seul celui de la
 * taille courante est visible. Chaque libellé est donc visé **dans son bloc et visible**
 * (`filter({ visible: true })`), jamais « le premier du DOM » — le premier est souvent le mobile.
 */
import { test, expect, type Navigateur } from "../fixtures/yamba";

/* ══ Aides ═══════════════════════════════════════════════════════════════════════════════════ */

/**
 * Une clé de traduction affichée telle quelle (`home.hero.title`) est un texte sans espace fait
 * de segments séparés par des points. On ramasse tous les nœuds de texte de la page et on garde
 * ceux qui ont cette forme — en écartant ce qui y ressemble légitimement (adresses, domaines).
 */
async function clesBrutesAffichees(page: Navigateur["page"]): Promise<string[]> {
  return page.evaluate(() => {
    const trouvees = new Set<string>();
    const marcheur = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let noeud: Node | null;
    while ((noeud = marcheur.nextNode())) {
      const parent = noeud.parentElement;
      if (!parent || ["SCRIPT", "STYLE", "NOSCRIPT"].includes(parent.tagName)) continue;
      const texte = (noeud.textContent ?? "").trim();
      if (!/^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+){1,}$/.test(texte)) continue;
      if (/\.(dev|com|fr|io|net|org)$/i.test(texte)) continue; // un domaine, pas une clé
      trouvees.add(texte);
    }
    return [...trouvees];
  });
}

/** Les erreurs de console et les exceptions non rattrapées de la page, à lire en fin de fiche. */
function ecouterLesErreurs(page: Navigateur["page"]): () => string[] {
  const erreurs: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") erreurs.push(m.text());
  });
  page.on("pageerror", (e) => erreurs.push(`pageerror: ${e.message}`));
  return () => erreurs;
}

/** L'en-tête et le pied de page tels que le desktop les montre. */
function enTete(page: Navigateur["page"]) {
  return page.getByRole("banner");
}
function piedDePage(page: Navigateur["page"]) {
  return page.getByRole("contentinfo");
}

/** Le lien visible d'un bloc qui en porte deux (mobile + desktop). */
function lienVisible(bloc: ReturnType<Navigateur["page"]["getByRole"]>, nom: string | RegExp) {
  return bloc.getByRole("link", { name: nom }).filter({ visible: true }).first();
}

/** Ouvre l'accueil et attend que le squelette ait laissé la place à l'en-tête réel. */
async function ouvrirLAccueil(page: Navigateur["page"], locale: "fr" | "en" = "fr"): Promise<void> {
  await page.goto(`/${locale}`, { waitUntil: "networkidle" });
  await expect(enTete(page)).toBeVisible({ timeout: 60_000 });
}

/**
 * La porte d'identité ouverte par « Partager un trajet ». Visée par son NOM : la page porte en
 * permanence quatre autres `role="dialog" aria-modal="true"` — les feuilles de la recherche
 * mobile (« Modifier la recherche », « Départ », « Destination », « Quand partez-vous ? »),
 * montées fermées et masquées par CSS (observation pour le chapitre 5.31).
 */
function porte(page: Navigateur["page"]) {
  return page.getByRole("dialog", { name: "Connecte-toi pour partager un trajet" });
}

/**
 * L'origine à utiliser pour l'autocomplétion Google (WEB-ACC-9 / 10). Piège de poste : la clé
 * `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` est restreinte par référent HTTP à `localhost` — sur
 * l'adresse LAN du poste, Places répond 403 « Requests from referer http://192.168.1.155:3000/
 * are blocked » et le champ reste muet. Ces deux fiches se jouent en VISITEUR : aucun cookie
 * n'entre en jeu, on peut donc ouvrir le même front par `localhost` sans rien casser.
 */
const ORIGINE_GOOGLE = process.env.E2E_GOOGLE_ORIGIN ?? "http://localhost:3000";
async function ouvrirLaPorte(page: Navigateur["page"]): Promise<void> {
  await enTete(page).getByRole("button", { name: "Partager un trajet" }).filter({ visible: true }).first().click();
  await expect(porte(page)).toBeVisible();
}

/** Saisit une ville dans un champ d'autocomplétion et prend la première proposition. */
async function choisirUneVille(page: Navigateur["page"], champ: string, saisie: string): Promise<string> {
  const combobox = page.getByRole("combobox", { name: champ }).filter({ visible: true }).first();
  // Ce que Google a répondu, pour que l'échec dise sa cause (clé absente, référent refusé…).
  const reponsesGoogle: string[] = [];
  const ecoute = async (r: import("@playwright/test").Response) => {
    if (!/places\.googleapis\.com|maps\.googleapis\.com\/maps\/api\/js/.test(r.url())) return;
    const corps = r.ok() ? "" : (await r.text().catch(() => "")).slice(0, 160);
    reponsesGoogle.push(`${r.status()} ${new URL(r.url()).pathname} ${corps}`.trim());
  };
  page.on("response", ecoute);
  await combobox.click();
  // Frappe touche par touche : le champ n'interroge Google qu'au fil des frappes — un `fill()`
  // (une seule valeur posée d'un coup) ne déclenche AUCUNE requête et la liste reste fermée.
  // Mesuré le 10/09/2026 : 0 requête après `fill`, 2 après cinq frappes.
  await combobox.pressSequentially(saisie, { delay: 60 });
  const proposition = page.getByRole("option").first();
  await expect
    .poll(async () => ((await proposition.isVisible()) ? "visible" : `aucune proposition — Google : [${reponsesGoogle.join(" ; ") || "aucune requête"}] — page ${page.url()}`), {
      timeout: 20_000,
      message: `une proposition Google pour « ${saisie} »`,
    })
    .toBe("visible");
  page.off("response", ecoute);
  await proposition.click();
  const valeur = await combobox.inputValue();
  expect(valeur, `le champ « ${champ} » porte la ville choisie`).toContain(saisie);
  return valeur;
}

/* ══ Les fiches ══════════════════════════════════════════════════════════════════════════════ */

test.describe("WEB-ACC — découverte, accueil et navigation (chapitre 5.1)", () => {
  test("WEB-ACC-1 · la page d'accueil s'affiche pour un visiteur", async ({ navigateurVisiteur }) => {
    const { page } = await navigateurVisiteur();
    const erreurs = ecouterLesErreurs(page);

    await ouvrirLAccueil(page);
    await expect(page).toHaveURL(/\/fr$/);

    // L'en-tête : le logo, « Partager un trajet », « Connexion ».
    const entete = enTete(page);
    await expect(lienVisible(entete, "Yamba")).toBeVisible();
    await expect(entete.getByRole("button", { name: "Partager un trajet" }).filter({ visible: true })).toHaveCount(1);
    await expect(lienVisible(entete, "Connexion")).toBeVisible();
    // Écart consigné (rapport) : sur desktop, l'en-tête ne porte NI lien « Rechercher un trajet »
    // NI bouton « Créer un compte » — ils n'existent que dans la feuille mobile. On le constate,
    // on ne l'impose pas : c'est une décision de produit à trancher, pas une régression.
    const rechercherDansLEntete = await entete.getByRole("link", { name: "Rechercher un trajet" }).filter({ visible: true }).count();
    const creerUnCompteDansLEntete = await entete.getByRole("link", { name: "Créer un compte" }).filter({ visible: true }).count();
    test.info().annotations.push({
      type: "écart",
      description: `en-tête desktop : « Rechercher un trajet » ×${rechercherDansLEntete}, « Créer un compte » ×${creerUnCompteDansLEntete}`,
    });

    // La barre de recherche : deux villes et une date.
    await expect(page.getByRole("combobox", { name: "Ville de départ" }).filter({ visible: true })).toHaveCount(1);
    await expect(page.getByRole("combobox", { name: "Ville d'arrivée" }).filter({ visible: true })).toHaveCount(1);
    await expect(page.getByText("Date", { exact: true }).filter({ visible: true }).first()).toBeVisible();

    // Le pied de page : trois rubriques et la phrase de marque.
    const pied = piedDePage(page);
    for (const rubrique of ["Découvrir", "Entreprise", "Légal"]) {
      await expect(pied.getByText(rubrique, { exact: true }).filter({ visible: true }).first(), rubrique).toBeVisible();
    }
    await expect(pied.getByText("La marketplace P2P qui repense l'envoi de colis légers entre particuliers.").filter({ visible: true }).first()).toBeVisible();

    // Aucun squelette gris après 5 s : les blocs « animate-pulse » ont tous disparu.
    await page.waitForTimeout(5_000);
    await expect(page.locator(".animate-pulse").filter({ visible: true })).toHaveCount(0);

    // Vérification complémentaire : aucune erreur rouge dans la console — hormis les deux 401
    // de la sonde de session (`/auth/me`, `/auth/refresh`), que le navigateur rapporte en rouge
    // pour tout visiteur : c'est le front qui demande « qui suis-je ? » et le serveur qui répond
    // « personne ». Consigné comme observation, pas comme anomalie.
    const rouges = erreurs().filter((e) => !/favicon|third-party cookie|Download the React DevTools/i.test(e));
    const horsSonde = rouges.filter((e) => !/status of 401/.test(e));
    test.info().annotations.push({ type: "observation", description: `${rouges.length - horsSonde.length} ligne(s) 401 (sonde de session) dans la console du visiteur` });
    expect(horsSonde, "erreurs de console (hors sonde de session)").toEqual([]);
  });

  test("WEB-ACC-2 · bascule de langue FR → EN pour un visiteur", async ({ navigateurVisiteur }) => {
    const { page } = await navigateurVisiteur();
    await ouvrirLAccueil(page);

    // Le sélecteur est un « FR | EN » segmenté (libellés accessibles « Français » / « English »).
    // Écart consigné : l'info-bulle « Changer de langue » du cahier n'existe pas sur ce
    // composant — la clé de traduction `header.toggleLanguage` est définie mais inutilisée.
    await enTete(page).getByRole("button", { name: "English" }).filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    // Toute la page est en anglais : l'en-tête, la barre de recherche, le pied de page.
    await expect(lienVisible(enTete(page), "Log in")).toBeVisible();
    await expect(enTete(page).getByRole("button", { name: "Share your trip" }).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Departure city" }).filter({ visible: true }).first()).toBeVisible();
    await expect(piedDePage(page).getByText("The P2P marketplace rethinking light parcel delivery between individuals.").filter({ visible: true }).first()).toBeVisible();
    for (const rubrique of ["Discover", "Company", "Legal"]) {
      await expect(piedDePage(page).getByText(rubrique, { exact: true }).filter({ visible: true }).first(), rubrique).toBeVisible();
    }

    // Aucune clé technique brute à la place d'un texte — dans les deux langues.
    expect(await clesBrutesAffichees(page), "clés brutes en anglais").toEqual([]);
    await ouvrirLAccueil(page, "fr");
    expect(await clesBrutesAffichees(page), "clés brutes en français").toEqual([]);
  });

  test("WEB-ACC-3 · retour au français et persistance", async ({ navigateurVisiteur }) => {
    const { page } = await navigateurVisiteur();
    await ouvrirLAccueil(page, "en");

    await enTete(page).getByRole("button", { name: "Français" }).filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/fr$/);

    await page.reload({ waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/fr$/);
    await expect(lienVisible(enTete(page), "Connexion")).toBeVisible();

    // Et la préférence tient au-delà du rechargement : la racine sans langue revient en français.
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/fr$/);
  });

  test("WEB-ACC-4 · thème clair / sombre", async ({ navigateurVisiteur }) => {
    const { page } = await navigateurVisiteur();
    await ouvrirLAccueil(page);
    const html = page.locator("html");
    const bascule = () => enTete(page).getByRole("button", { name: "Changer de thème" }).filter({ visible: true }).first();

    await expect(html).not.toHaveClass(/dark/);
    // Le bouton de l'en-tête est une bascule (une icône) ; « Mode clair » / « Mode sombre »
    // nommés existent dans le menu mobile. Un clic depuis le clair = « Mode sombre ».
    await bascule().click();
    await expect(html).toHaveClass(/dark/);

    // Les textes restent lisibles : fond sombre, titre clair — mesuré, pas supposé.
    const contraste = await page.evaluate(() => {
      const lum = (couleur: string): number => {
        const [r, g, b] = (couleur.match(/\d+(\.\d+)?/g) ?? ["0", "0", "0"]).slice(0, 3).map((v) => {
          const c = Number(v) / 255;
          return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const fond = getComputedStyle(document.body).backgroundColor;
      const titre = document.querySelector("h1");
      const encre = titre ? getComputedStyle(titre).color : getComputedStyle(document.body).color;
      const [l1, l2] = [lum(fond), lum(encre)].sort((a, b) => b - a);
      return { fond, encre, ratio: (l1 + 0.05) / (l2 + 0.05) };
    });
    test.info().annotations.push({ type: "mesure", description: `sombre : fond ${contraste.fond}, titre ${contraste.encre}, contraste ${contraste.ratio.toFixed(1)}:1` });
    expect(contraste.ratio, "contraste titre / fond en mode sombre (AA = 4,5)").toBeGreaterThanOrEqual(4.5);

    // Après rechargement, le mode sombre est conservé.
    await page.reload({ waitUntil: "networkidle" });
    await expect(html).toHaveClass(/dark/);

    // « Mode clair » revient à l'affichage d'origine.
    await bascule().click();
    await expect(html).not.toHaveClass(/dark/);
    await page.reload({ waitUntil: "networkidle" });
    await expect(html).not.toHaveClass(/dark/);
  });

  test("WEB-ACC-5 · le pied de page mène aux textes légaux", async ({ navigateurVisiteur }) => {
    const { page } = await navigateurVisiteur();
    await ouvrirLAccueil(page);

    await lienVisible(piedDePage(page), "Conditions générales").click();
    await expect(page).toHaveURL(/\/fr\/legal\/terms$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 60_000 });
    const cgu = (await page.getByRole("main").first().innerText()).trim();
    expect(cgu.length, "les CGU affichent un texte").toBeGreaterThan(500);
    // Un seul <main> par page : deux repères « contenu principal » imbriqués sont un défaut de
    // validité HTML (et un lecteur d'écran en annonce deux).
    await expect(page.getByRole("main"), "un seul repère « main » sur les CGU").toHaveCount(1);

    await page.goBack({ waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/fr$/);
    await lienVisible(piedDePage(page), "Confidentialité").click();
    await expect(page).toHaveURL(/\/fr\/legal\/privacy$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 60_000 });
    const confidentialite = (await page.getByRole("main").first().innerText()).trim();
    expect(confidentialite.length, "la politique de confidentialité affiche un texte").toBeGreaterThan(500);
    await expect(page.getByRole("main"), "un seul repère « main » sur la confidentialité").toHaveCount(1);
  });

  test("WEB-ACC-6 · les réseaux sociaux annoncés comme inactifs", async ({ navigateurVisiteur }) => {
    const { page, contexte } = await navigateurVisiteur();
    await ouvrirLAccueil(page);
    const pied = piedDePage(page);

    const nouvellesPages: string[] = [];
    contexte.on("page", (p) => nouvellesPages.push(p.url()));
    const ouvertures: string[] = [];
    await page.exposeFunction("__yambaOuverture", (u: string) => ouvertures.push(u));
    await page.evaluate(() => {
      const original = window.open.bind(window);
      window.open = ((u?: string | URL) => {
        (window as unknown as { __yambaOuverture: (u: string) => void }).__yambaOuverture(String(u));
        return null;
      }) as typeof original;
    });

    for (const reseau of ["Instagram", "X (Twitter)", "Facebook"]) {
      const icone = pied.getByLabel(reseau, { exact: true }).filter({ visible: true }).first();
      await expect(icone, reseau).toBeVisible();
      await expect(icone, `${reseau} : « Bientôt disponible »`).toHaveAttribute("title", "Bientôt disponible");
      await icone.click();
    }
    await page.waitForTimeout(500);
    expect(ouvertures, "aucune page réelle ouverte par les icônes sociales").toEqual([]);
    expect(nouvellesPages, "aucun nouvel onglet").toEqual([]);
    await expect(page).toHaveURL(/\/fr$/);
  });

  test("WEB-ACC-7 · « Partager un trajet » ouvre la porte d'identité", async ({ navigateurVisiteur }) => {
    const { page } = await navigateurVisiteur();
    await ouvrirLAccueil(page);

    await ouvrirLaPorte(page);
    // Par-dessus la page courante : l'adresse ne change pas.
    await expect(page).toHaveURL(/\/fr$/);
    const fenetre = porte(page);
    await expect(fenetre.getByRole("heading", { name: "Connecte-toi pour partager un trajet" })).toBeVisible();
    await expect(
      fenetre.getByText("Publier un trajet engage un Voyageur identifié : Yamba a besoin de savoir qui transporte. Ton trajet t'attend après connexion.")
    ).toBeVisible();
    // Le formulaire de connexion lui-même, et le bouton Google.
    await expect(fenetre.locator("#email")).toBeVisible();
    await expect(fenetre.locator("#password")).toBeVisible();
    await expect(fenetre.locator("iframe[title*='Google'], [aria-label*='Google'], button:has-text('Google')").first()).toBeVisible();
    // « Plus tard » (le lien) et la croix (un bouton nommé « Plus tard » lui aussi).
    await expect(fenetre.getByRole("button", { name: "Plus tard", exact: true }).filter({ hasText: "Plus tard" })).toBeVisible();
    await expect(fenetre.locator("button[aria-label='Plus tard']:has(svg)")).toBeVisible();
  });

  test("WEB-ACC-8 · « Plus tard », Échap et clic sur le fond referment sans conséquence", async ({ navigateurVisiteur }) => {
    const { page } = await navigateurVisiteur();
    const erreurs = ecouterLesErreurs(page);
    await ouvrirLAccueil(page);
    const requetes: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/") && r.method() !== "GET") requetes.push(`${r.method()} ${r.url()}`);
    });

    // 1. « Plus tard »
    await ouvrirLaPorte(page);
    await porte(page).getByRole("button", { name: "Plus tard", exact: true }).filter({ hasText: "Plus tard" }).click();
    await expect(porte(page)).toHaveCount(0);

    // 2. Échap
    await ouvrirLaPorte(page);
    await page.keyboard.press("Escape");
    await expect(porte(page)).toHaveCount(0);

    // 3. Le fond grisé, en dehors de la fenêtre (le coin supérieur gauche de l'écran).
    await ouvrirLaPorte(page);
    await page.mouse.click(8, 8);
    await expect(porte(page)).toHaveCount(0);

    // La page d'origine est intacte : même adresse, aucune requête d'écriture, aucune erreur.
    await expect(page).toHaveURL(/\/fr$/);
    await expect(lienVisible(enTete(page), "Connexion")).toBeVisible();
    expect(requetes, "aucune écriture partie vers l'API").toEqual([]);
    // Même filtre qu'en WEB-ACC-1 : les 401 de la sonde de session sont ceux du visiteur, pas de la porte.
    expect(erreurs().filter((e) => !/favicon|third-party cookie|status of 401/i.test(e)), "erreurs de console").toEqual([]);
  });

  test("WEB-ACC-9 · la recherche depuis l'accueil", async ({ navigateurVisiteur }) => {
    const { page } = await navigateurVisiteur();
    await page.goto(`${ORIGINE_GOOGLE}/fr`, { waitUntil: "networkidle" });
    await expect(enTete(page)).toBeVisible({ timeout: 60_000 });

    const depart = await choisirUneVille(page, "Ville de départ", "Paris");
    const arrivee = await choisirUneVille(page, "Ville d'arrivée", "Brazzaville");
    test.info().annotations.push({ type: "saisie", description: `${depart} → ${arrivee}` });

    await page.getByRole("button", { name: "Rechercher", exact: true }).filter({ visible: true }).first().click();
    await expect(page, "« Rechercher » depuis l'accueil ouvre /search").toHaveURL(/\/fr\/search/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: /Trajets pour Paris.* → Brazzaville/ })).toBeVisible({ timeout: 60_000 });

    // Au moins un trajet Paris → Brazzaville du jeu d'essai (le cahier en annonce trois : l'un
    // est parti, l'autre est complet — le nombre affiché est consigné, pas imposé).
    const cartes = page.getByRole("link", { name: /Brazzaville/ }).filter({ visible: true });
    await expect.poll(() => cartes.count(), { timeout: 30_000 }).toBeGreaterThan(0);
    test.info().annotations.push({ type: "résultats", description: `${await cartes.count()} carte(s) Paris → Brazzaville` });
  });

  test("WEB-ACC-10 · le bouton « Intervertir départ et destination »", async ({ navigateurVisiteur }) => {
    const { page } = await navigateurVisiteur();
    await page.goto(`${ORIGINE_GOOGLE}/fr`, { waitUntil: "networkidle" });
    await expect(enTete(page)).toBeVisible({ timeout: 60_000 });
    await choisirUneVille(page, "Ville de départ", "Paris");
    await choisirUneVille(page, "Ville d'arrivée", "Brazzaville");
    await page.getByRole("button", { name: "Rechercher", exact: true }).filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/fr\/search/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: /Trajets pour Paris.* → Brazzaville/ })).toBeVisible({ timeout: 60_000 });

    await page.getByRole("button", { name: "Intervertir départ et destination" }).filter({ visible: true }).first().click();
    const de = page.getByRole("combobox", { name: "Ville de départ" }).filter({ visible: true }).first();
    const vers = page.getByRole("combobox", { name: "Ville d'arrivée" }).filter({ visible: true }).first();
    await expect(de).toHaveValue(/^Brazzaville/);
    await expect(vers).toHaveValue(/^Paris/);
    // Écart consigné : l'inversion ne relance PAS la recherche d'elle-même — les résultats se
    // recalculent au clic « Rechercher » (le cahier les attendait recalculés d'office).
    await expect(page.getByRole("heading", { name: /Trajets pour Paris.* → Brazzaville/ })).toBeVisible();
    await page.getByRole("button", { name: "Rechercher", exact: true }).filter({ visible: true }).first().click();
    await expect(page.getByRole("heading", { name: /Trajets pour Brazzaville.* → Paris/ })).toBeVisible({ timeout: 30_000 });
    // Et, comme prévu, aucun trajet dans ce sens dans le jeu d'essai (WEB-RCH-9 : l'état vide).
    await expect(page.getByRole("link", { name: /Brazzaville/ }).filter({ visible: true })).toHaveCount(0, { timeout: 30_000 });
  });

  test("WEB-ACC-11 · l'accueil connecté diffère de l'accueil visiteur", async ({ navigateurConnecte }) => {
    const { page } = await navigateurConnecte("aminata");
    await ouvrirLAccueil(page);
    const entete = enTete(page);

    await expect(entete.getByRole("link", { name: "Connexion" }).filter({ visible: true })).toHaveCount(0);
    await expect(entete.getByRole("link", { name: "Créer un compte" }).filter({ visible: true })).toHaveCount(0);
    await expect(entete.getByRole("link", { name: "Notifications" }).or(entete.getByRole("button", { name: "Notifications" })).filter({ visible: true }).first()).toBeVisible();
    await expect(lienVisible(entete, "Messages")).toBeVisible();

    const menu = entete.getByRole("button", { name: "Menu utilisateur" }).filter({ visible: true }).first();
    await expect(menu).toBeVisible();
    await menu.click();
    const contenu = page.locator('[role="menu"], [role="dialog"]').filter({ visible: true }).first();
    await expect(contenu).toBeVisible();
    for (const entree of ["Mon compte", "Mes envois", "Messages", "Mes favoris", "Notifications", "Déconnexion"]) {
      await expect(contenu.getByText(entree, { exact: true }).first(), entree).toBeVisible();
    }
    // Écarts consignés : l'entrée d'aide s'intitule « Centre d'aide » (le cahier dit « Aide ») ;
    // les intitulés de section « Compte / Préférences / Support » et le bloc des préférences
    // (langue, apparence) ne sont rendus que dans la feuille MOBILE — le menu desktop sépare les
    // groupes par un trait, la langue et le thème étant déjà dans l'en-tête à côté de lui.
    await expect(contenu.getByText(/^(Aide|Centre d'aide)$/).first()).toBeVisible();
    const sections = await Promise.all(["Compte", "Préférences", "Support", "Langue", "Apparence"].map((s) => contenu.getByText(s, { exact: true }).count()));
    test.info().annotations.push({ type: "écart", description: `menu desktop — Compte/Préférences/Support/Langue/Apparence : ${sections.join("/")}` });
  });

  test("WEB-ACC-12 · la déconnexion", async ({ navigateurConnecte }) => {
    const { page, contexte } = await navigateurConnecte("aminata");
    await ouvrirLAccueil(page);
    const entete = enTete(page);

    await entete.getByRole("button", { name: "Menu utilisateur" }).filter({ visible: true }).first().click();
    const reponse = page.waitForResponse((r) => r.url().includes("/auth/logout") && r.request().method() === "POST", { timeout: 20_000 });
    await page.locator('[role="menu"], [role="dialog"]').filter({ visible: true }).first().getByText("Déconnexion", { exact: true }).click();
    expect((await reponse).ok(), "POST /auth/logout").toBe(true);

    // Retour à un état visiteur.
    await expect(lienVisible(enTete(page), "Connexion")).toBeVisible({ timeout: 30_000 });
    await expect(enTete(page).getByRole("button", { name: "Menu utilisateur" }).filter({ visible: true })).toHaveCount(0);

    // Les cookies de session ont disparu.
    const cookies = (await contexte.cookies()).map((c) => c.name);
    expect(cookies, "cookies après déconnexion").not.toContain("access_token");
    expect(cookies, "cookies après déconnexion").not.toContain("refresh_token");

    // Un rechargement ne réouvre pas la session.
    await page.reload({ waitUntil: "networkidle" });
    await expect(lienVisible(enTete(page), "Connexion")).toBeVisible({ timeout: 30_000 });
    await expect(enTete(page).getByRole("button", { name: "Menu utilisateur" }).filter({ visible: true })).toHaveCount(0);
  });
});
