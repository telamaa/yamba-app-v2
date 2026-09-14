/**
 * web-a11y.spec.ts — cahier 01-WEB, chapitre 5.31 « Accessibilité clavier de base »
 * =================================================================================
 * Le minimum vérifiable sans outil spécialisé : parcourir au clavier, voir où l'on est, fermer une fenêtre,
 * y rester tant qu'elle est ouverte, nommer les boutons sans texte, lier une erreur à son champ, lire en mode
 * sombre, et tenir à 200 %.
 *
 * Trois choix de méthode, assumés :
 *  - **le focus visible** se mesure sur `document.activeElement` après chaque `Tab` : un contour (`outline`) OU une
 *    ombre portée (`box-shadow`, ce que pose `focus-visible:ring-*` de Tailwind) ;
 *  - **le contraste** est calculé (WCAG 2.1) en remontant les ancêtres jusqu'au premier fond opaque : approximation
 *    honnête, qui suffit à trouver un gris foncé sur noir ;
 *  - **le zoom à 200 %** est joué en DIVISANT la fenêtre par deux (640 × 420) : à densité égale, c'est ce que voit
 *    un navigateur zoomé — Chrome piloté n'expose pas son zoom.
 */
import { test, expect, type Navigateur } from "../fixtures/yamba";
import { JeuEssai } from "../fixtures/jeu-essai";
import { COMPTES, MOT_DE_PASSE_SEED } from "../fixtures/comptes";
import { normaliserEspaces } from "../pages/reservation";
import { MesEnvois } from "../pages/mes-envois";
import { ouvrirLaRecherche } from "../pages/recherche";
import { TransportVoyageur } from "../pages/transport-voyageur";
import { FilMessagerie } from "../pages/fil-messagerie";

type Page = Navigateur["page"];
const texte = async (page: Page) => normaliserEspaces(await page.locator("body").innerText());

/** L'élément qui a le focus : son nom lisible, et s'il se VOIT. */
async function elementFocalise(page: Page): Promise<{ nom: string; visible: boolean; dansLaPage: boolean; region: string }> {
  return page.evaluate(() => {
    const actif = document.activeElement as HTMLElement | null;
    if (!actif || actif === document.body) return { nom: "(aucun)", visible: false, dansLaPage: false, region: "" };
    // La barre d'outils de `next dev` (`nextjs-portal`) n'appartient pas au produit : un membre ne
    // la voit jamais en production, et elle prend le focus dans la tabulation du poste.
    if (actif.tagName.toLowerCase() === "nextjs-portal" || actif.closest("nextjs-portal, [data-nextjs-toast], [data-nextjs-dialog-overlay]")) {
      return { nom: "(outil de développement)", visible: true, dansLaPage: false, region: "" };
    }
    const style = getComputedStyle(actif);
    const contour = style.outlineStyle !== "none" && parseFloat(style.outlineWidth || "0") > 0;
    const ombre = style.boxShadow !== "none" && style.boxShadow !== "";
    const nom =
      actif.getAttribute("aria-label") ||
      (actif.textContent ?? "").trim().slice(0, 40) ||
      actif.getAttribute("placeholder") ||
      `${actif.tagName.toLowerCase()}${actif.id ? `#${actif.id}` : ""}`;
    const region = actif.closest("header") ? "en-tête" : actif.closest("main") ? "contenu" : actif.closest("footer") ? "pied" : "autre";
    return { nom, visible: contour || ombre, dansLaPage: true, region };
  });
}

/** Le nom accessible d'un contrôle, tel qu'un lecteur d'écran l'annoncerait (approximation utile). */
async function nomAccessible(page: Page, selecteur: string): Promise<string | null> {
  return page.evaluate((s) => {
    const n = document.querySelector<HTMLElement>(s);
    if (!n) return null;
    const parLId = n.getAttribute("aria-labelledby");
    const cible = parLId ? document.getElementById(parLId) : null;
    return (n.getAttribute("aria-label") || cible?.textContent || n.getAttribute("title") || n.textContent || "").trim();
  }, selecteur);
}

/** Le contraste WCAG des textes visibles : on rend les pires. */
async function contrastesInsuffisants(page: Page, seuil = 3): Promise<Array<{ texte: string; ratio: number; couleur: string; fond: string }>> {
  return page.evaluate((limite) => {
    const lum = (c: number[]) => {
      const [r, v, b] = c.map((x) => {
        const s = x / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * v + 0.0722 * b;
    };
    /** [r, v, b, alpha] ; null si totalement transparent. */
    const rgba = (valeur: string): number[] | null => {
      const m = valeur.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const parts = m[1].split(/[,\s/]+/).filter(Boolean).map((x) => parseFloat(x));
      const alpha = parts.length >= 4 ? parts[3] : 1;
      if (alpha === 0) return null;
      return [parts[0], parts[1], parts[2], alpha];
    };
    const rgb = (valeur: string): number[] | null => rgba(valeur)?.slice(0, 3) ?? null;
    /* Un fond semi-transparent (`bg-[#FF9900]/15`) n'est PAS le fond : on empile les couches jusqu'au
       premier fond opaque, puis on les compose de bas en haut. Sans cela, une puce teintée à 15 %
       passait pour de l'orange plein (faux positif mesuré : « Tout » à 1,25:1). */
    const fondDe = (n: HTMLElement): number[] => {
      const couches: number[][] = [];
      let cur: HTMLElement | null = n;
      let base = [255, 255, 255];
      while (cur) {
        const c = rgba(getComputedStyle(cur).backgroundColor);
        if (c && c[3] >= 1) {
          base = c.slice(0, 3);
          break;
        }
        if (c) couches.push(c);
        cur = cur.parentElement;
      }
      return couches.reverse().reduce((dessous, [r, v, b, a]) => [r * a + dessous[0] * (1 - a), v * a + dessous[1] * (1 - a), b * a + dessous[2] * (1 - a)], base).map(Math.round);
    };
    const pires: Array<{ texte: string; ratio: number; couleur: string; fond: string }> = [];
    document.querySelectorAll<HTMLElement>("main *, header *").forEach((n) => {
      if (n.children.length > 0) return; // feuilles seulement : le texte est là
      const contenu = (n.textContent ?? "").trim();
      if (contenu.length < 3) return;
      const r = n.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return;
      const style = getComputedStyle(n);
      if (style.visibility === "hidden" || style.opacity === "0") return;
      const couleur = rgb(style.color);
      if (!couleur) return;
      const fond = fondDe(n);
      const l1 = lum(couleur) + 0.05;
      const l2 = lum(fond) + 0.05;
      const ratio = Math.round((Math.max(l1, l2) / Math.min(l1, l2)) * 100) / 100;
      if (ratio < limite) pires.push({ texte: contenu.slice(0, 40), ratio, couleur: style.color, fond: `rgb(${fond.join(",")})` });
    });
    return pires.sort((a, b) => a.ratio - b.ratio).slice(0, 8);
  }, seuil);
}

/** La page déborde-t-elle horizontalement ? (règle reprise du chapitre 5.30) */
async function debordement(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

/**
 * Ouvre une fenêtre AU CLAVIER (focus sur l'ouvreur, Entrée), la ferme par Échap, et vérifie que le
 * focus revient sur l'ouvreur lui-même. On marque l'ÉLÉMENT (attribut) plutôt que de comparer des
 * textes : deux boutons peuvent s'appeler « Annuler » sur la même page.
 */
async function ouvrirPuisEchap(page: Page, nom: string, ouvreur: ReturnType<Page["locator"]>): Promise<string> {
  await expect(ouvreur, `${nom} : l'ouvreur est à l'écran`).toBeVisible({ timeout: 60_000 });
  await ouvreur.evaluate((el) => el.setAttribute("data-recette-ouvreur", "1"));
  await ouvreur.focus();
  await page.keyboard.press("Enter");
  /* La fenêtre visée est celle qui a reçu le focus : les feuilles de la recherche restent montées
     hors écran (glissement), un simple « dialog visible » peut en désigner une autre. */
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const f = document.activeElement?.closest<HTMLElement>('[role="dialog"]');
          f?.setAttribute("data-recette-fenetre", "1");
          return Boolean(f);
        }),
      { message: `${nom} : la fenêtre s'ouvre à Entrée et le focus y entre`, timeout: 30_000 }
    )
    .toBe(true);
  const fenetre = page.locator('[data-recette-fenetre="1"]');
  await page.keyboard.press("Escape");
  /* Fermée = démontée, masquée, ou rendue inerte (feuille toujours montée). */
  await expect
    .poll(() => fenetre.evaluateAll((els) => els.every((el) => !el.isConnected || el.getClientRects().length === 0 || el.closest("[inert]") !== null || getComputedStyle(el).visibility === "hidden")), {
      message: `${nom} : Échap ferme la fenêtre`,
      timeout: 30_000,
    })
    .toBe(true);
  const retour = await page.evaluate(() => {
    const a = document.activeElement as HTMLElement | null;
    return { surOuvreur: a?.getAttribute("data-recette-ouvreur") === "1", nom: (a?.getAttribute("aria-label") || a?.textContent || a?.tagName || "").trim().slice(0, 40) };
  });
  await ouvreur.evaluate((el) => el.removeAttribute("data-recette-ouvreur")).catch(() => undefined);
  expect(retour.surOuvreur, `${nom} : le focus revient à l'élément qui l'a ouverte (il est sur « ${retour.nom} »)`).toBe(true);
  return `${nom} : ouverte à Entrée, fermée à Échap, focus rendu à « ${retour.nom} »`;
}

/* ══ Les fiches ══════════════════════════════════════════════════════════════════════════════ */

test.describe("WEB-A11Y — accessibilité clavier de base (chapitre 5.31)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(() => {
    new JeuEssai().rejouer();
  });

  test("WEB-A11Y-1 · parcourir l'accueil au clavier", async ({ navigateurVisiteur }) => {
    const { page } = await navigateurVisiteur();
    await page.goto("/fr", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 90_000 });
    await page.locator("body").click({ position: { x: 2, y: 2 } });

    const parcours: string[] = [];
    const invisibles: string[] = [];
    const regions: string[] = [];
    /* 80 arrêts : assez pour traverser l'accueil jusqu'au pied de page. */
    for (let i = 0; i < 80; i++) {
      await page.keyboard.press("Tab");
      const actif = await elementFocalise(page);
      if (!actif.dansLaPage) continue;
      parcours.push(actif.nom);
      if (!actif.visible) invisibles.push(actif.nom);
      if (actif.region !== "autre" && regions[regions.length - 1] !== actif.region) regions.push(actif.region);
      if (actif.region === "pied") break;
    }
    expect(parcours.length, "la tabulation progresse dans la page").toBeGreaterThan(10);
    /* L'ordre suit la lecture : en-tête, puis contenu, puis pied — jamais de retour en arrière. */
    expect(regions, `ordre de lecture (${regions.join(" → ")})`).toEqual(["en-tête", "contenu", "pied"]);
    /* Chaque élément focalisé se VOIT (contour ou anneau). */
    expect(invisibles, `focus invisible sur : ${invisibles.join(", ")}`).toHaveLength(0);
    /* Aucun piège : `Maj+Tab` revient en arrière. On compare les ÉLÉMENTS, pas leurs noms — deux
       voisins peuvent très bien s'appeler « div » tous les deux. */
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.setAttribute("data-recette-focus", "1"));
    await page.keyboard.press("Shift+Tab");
    const memeElement = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.getAttribute("data-recette-focus") === "1");
    expect(memeElement, "Maj+Tab quitte l'élément courant (aucun piège)").toBe(false);
    test.info().annotations.push({ type: "note", description: `${parcours.length} arrêts, régions ${regions.join(" → ")} : ${parcours.slice(0, 12).join(" → ")}…` });
  });

  test("WEB-A11Y-2 · remplir et valider la connexion au clavier", async ({ navigateurVisiteur }) => {
    const { page } = await navigateurVisiteur();
    /* Taper avant l'hydratation perd des frappes (mesuré ici : « aminata.ship » disparu, seul
       « per@seed.yamba.dev » est parti) — même piège que `connexion()` : le signal fiable est le
       premier appel d'API fait par le CLIENT. */
    const hydratee = page.waitForResponse((r) => r.url().includes("/api/"), { timeout: 60_000 }).catch(() => undefined);
    await page.goto("/fr/login", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#email")).toBeVisible({ timeout: 90_000 });
    await hydratee;
    /* On entre dans le formulaire par le clavier, puis on ne touche plus à rien d'autre. */
    await page.locator("#email").focus();
    await page.keyboard.type(COMPTES.aminata.email);
    /* Le lien « Oublié ? » est posé dans la ligne du libellé du mot de passe : il s'intercale entre
       les deux champs dans l'ordre de tabulation (motif courant, lisible). On tabule donc jusqu'au champ. */
    const avantMotDePasse: string[] = [];
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("Tab");
      const id = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.id ?? "");
      if (id === "password") break;
      avantMotDePasse.push(await page.evaluate(() => (document.activeElement?.textContent ?? "").trim().slice(0, 20)));
    }
    await expect(page.locator("#password"), "le mot de passe est atteint au clavier").toBeFocused();
    await page.keyboard.type(MOT_DE_PASSE_SEED);
    /* Jusqu'à la case « Rester connecté », puis Espace. */
    let coche = false;
    for (let i = 0; i < 6 && !coche; i++) {
      await page.keyboard.press("Tab");
      const estCase = await page.evaluate(() => (document.activeElement as HTMLInputElement | null)?.type === "checkbox");
      if (estCase) {
        await page.keyboard.press("Space");
        coche = await page.evaluate(() => Boolean((document.activeElement as HTMLInputElement | null)?.checked));
      }
    }
    expect(coche, "la case se coche avec Espace").toBe(true);
    /* Puis « Se connecter » avec Entrée : on tabule jusqu'au bouton d'envoi (il peut y avoir des
       liens entre les deux — « Oublié ? », l'œil du mot de passe…). */
    let surLeBouton = false;
    const etapes: string[] = [];
    for (let i = 0; i < 10 && !surLeBouton; i++) {
      await page.keyboard.press("Tab");
      const etat = await page.evaluate(() => {
        const a = document.activeElement as HTMLButtonElement | null;
        return { envoi: a?.tagName === "BUTTON" && a.type === "submit", nom: (a?.getAttribute("aria-label") || a?.textContent || a?.tagName || "").trim().slice(0, 30) };
      });
      etapes.push(etat.nom);
      surLeBouton = etat.envoi;
    }
    expect(surLeBouton, `le bouton d'envoi est atteint au clavier (${etapes.join(" → ")})`).toBe(true);
    const connexion = page.waitForResponse((r) => r.url().includes("/auth/login") && r.request().method() === "POST", { timeout: 60_000 });
    await page.keyboard.press("Enter");
    const r = await connexion;
    expect(r.ok(), `la connexion part au clavier (${r.status()})`).toBe(true);
    test.info().annotations.push({ type: "note", description: `entre l'e-mail et le mot de passe : ${avantMotDePasse.join(" → ") || "rien"} ; après le mot de passe : ${etapes.join(" → ")}` });
  });

  test("WEB-A11Y-3 · fermer une fenêtre avec Échap, et retrouver son point de départ", async ({ navigateurVisiteur, navigateurConnecte, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    const trajet = jeuEssai.trajet("bzv-upcoming");
    const releve: string[] = [];

    /* 1. La porte d'identité — un visiteur, depuis « Réserver ». */
    const visiteur = await navigateurVisiteur();
    await visiteur.page.goto(`/fr/trips/${trajet}`, { waitUntil: "domcontentloaded" });
    await expect(visiteur.page.getByRole("heading").first()).toBeVisible({ timeout: 90_000 });
    releve.push(await ouvrirPuisEchap(visiteur.page, "la porte d'identité", visiteur.page.getByRole("button", { name: /^Réserver/ }).first()));

    /* 2. La fenêtre de signalement — un membre, depuis « Signaler cette annonce ». */
    const aminata = await navigateurConnecte("aminata");
    await aminata.page.goto(`/fr/trips/${trajet}`, { waitUntil: "domcontentloaded" });
    await expect(aminata.page.getByRole("button", { name: "Signaler cette annonce" })).toBeVisible({ timeout: 90_000 });
    releve.push(await ouvrirPuisEchap(aminata.page, "la fenêtre de signalement", aminata.page.getByRole("button", { name: "Signaler cette annonce" })));

    /* 3. La confirmation d'annulation — « Annuler » sur la ligne de la demande en attente. */
    const envois = new MesEnvois(aminata.page);
    await envois.ouvrir();
    const ligne = envois.ligne(jeuEssai.deal("bzv-pending").id);
    releve.push(await ouvrirPuisEchap(aminata.page, "la confirmation d'annulation", ligne.getByRole("button", { name: "Annuler", exact: true }).last()));

    /* 4. La feuille des filtres — elle n'existe que sur téléphone (`md:hidden`) : sur un écran large,
       le bouton est absent et l'ancienne version de cette fiche passait sans rien éprouver. */
    const telephone = await navigateurVisiteur({ mobile: true });
    await ouvrirLaRecherche(telephone.page, { from: "Paris", to: "Brazzaville" });
    const filtres = telephone.page.getByRole("button", { name: /^Filtres/ }).first();
    await expect(filtres, "le bouton « Filtres » existe sur téléphone").toBeVisible({ timeout: 90_000 });
    releve.push(await ouvrirPuisEchap(telephone.page, "la feuille des filtres", filtres));

    test.info().annotations.push({ type: "note", description: releve.join(" ; ") });
  });

  test("WEB-A11Y-4 · le focus reste piégé dans une fenêtre ouverte", async ({ navigateurVisiteur, jeuEssai }) => {
    const { page } = await navigateurVisiteur();
    await page.goto(`/fr/trips/${jeuEssai.trajet("bzv-upcoming")}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 90_000 });
    await page.getByRole("button", { name: /^Réserver/ }).first().click();
    const porte = page.getByRole("dialog").first();
    await expect(porte).toBeVisible({ timeout: 60_000 });

    /* Dix tabulations : le focus doit rester DANS la fenêtre. */
    const sorties: string[] = [];
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      const dedans = await page.evaluate(() => {
        const a = document.activeElement as HTMLElement | null;
        const fenetre = document.querySelector('[role="dialog"]');
        if (!a || !fenetre) return { dedans: false, nom: "(aucun)" };
        return { dedans: fenetre.contains(a), nom: (a.getAttribute("aria-label") || a.textContent || a.tagName || "").trim().slice(0, 30) };
      });
      if (!dedans.dedans) sorties.push(dedans.nom);
    }
    expect(sorties, `le focus est sorti de la fenêtre vers : ${sorties.join(", ")}`).toHaveLength(0);
  });

  test("WEB-A11Y-5 · les contrôles sans texte ont un libellé", async ({ navigateurConnecte, navigateurVisiteur, jeuEssai }) => {
    test.setTimeout(8 * 60_000);
    const releve: Array<{ controle: string; nom: string }> = [];
    const anglais: string[] = [];
    const absents: string[] = [];
    const verifier = async (page: Page, controle: string, selecteur: string, attendu: RegExp) => {
      const nom = await nomAccessible(page, selecteur);
      if (nom === null) {
        absents.push(controle);
        return;
      }
      releve.push({ controle, nom });
      expect(nom, `${controle} : un libellé lisible`).not.toBe("");
      if (!attendu.test(nom)) anglais.push(`${controle} → « ${nom} »`);
    };

    /* L'annonce, vue par un membre : cœur, langue, thème. */
    const { page } = await navigateurConnecte("aminata");
    await page.goto(`/fr/trips/${jeuEssai.trajet("bzv-upcoming")}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 90_000 });
    await verifier(page, "le cœur de favori", 'button[aria-label*="favori" i]', /favori/i);
    await verifier(page, "le sélecteur de langue (FR)", 'header [aria-label="Français"]', /Français|langue/i);
    await verifier(page, "le sélecteur de langue (EN)", 'header [aria-label="English"]', /English|anglais|langue/i);
    await verifier(page, "le bouton de thème", 'header button[aria-label*="thème" i], header button[aria-label*="theme" i]', /thème/i);

    /* La croix de fermeture : celle de la porte d'identité (visiteur) et celle du signalement (membre). */
    await page.getByRole("button", { name: "Signaler cette annonce" }).click();
    await expect(page.locator("#report-dialog-title")).toBeVisible({ timeout: 30_000 });
    await verifier(page, "la croix du signalement", '[aria-labelledby="report-dialog-title"] form > div:first-child button', /Fermer|Annuler/i);
    await page.keyboard.press("Escape");
    const visiteur = await navigateurVisiteur();
    await visiteur.page.goto(`/fr/trips/${jeuEssai.trajet("bzv-upcoming")}`, { waitUntil: "domcontentloaded" });
    await visiteur.page.getByRole("button", { name: /^Réserver/ }).first().click({ timeout: 90_000 });
    await expect(visiteur.page.locator("#auth-gate-title")).toBeVisible({ timeout: 30_000 });
    /* Constat du 5.30 réglé ici : la croix s'appelait « Plus tard », comme le lien du bas et le voile. */
    await verifier(visiteur.page, "la croix de la porte d'identité", '[aria-labelledby="auth-gate-title"] .relative > button:first-of-type', /^Fermer$/);

    await page.goto("/fr/login", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#password")).toBeVisible({ timeout: 90_000 });
    await verifier(page, "l'affichage du mot de passe", 'main button[aria-label*="mot de passe" i]', /Afficher le mot de passe/i);

    await page.goto("/fr/dashboard/home", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 90_000 });
    await verifier(page, "la cloche de notifications", 'a[aria-label*="otification" i], button[aria-label*="otification" i]', /otification/i);

    /* La visionneuse de photos : il faut des photos. Thomas prend en charge le colis de Pauline avec
       DEUX photos (sans quoi « précédente / suivante » n'existent pas), puis Pauline ouvre la première. */
    const deal = jeuEssai.deal("bzv-accepted");
    const thomas = await navigateurConnecte("thomas");
    await new TransportVoyageur(thomas.page).prendreEnCharge(deal.id, { nbPhotos: 2 });
    const pauline = await navigateurConnecte("pauline");
    await pauline.page.goto(`/fr/bookings/${deal.id}`, { waitUntil: "domcontentloaded" });
    /* ANO-WEB-96 : chaque vignette s'annonçait « photo », toutes pareilles. */
    const vignette = pauline.page.getByRole("button", { name: /Agrandir la photo 1 sur 2/ }).filter({ visible: true }).first();
    await expect(vignette, "une vignette de photo, nommée par son rang, dans le suivi").toBeVisible({ timeout: 90_000 });
    await expect(pauline.page.getByRole("button", { name: /Agrandir la photo 2 sur 2/ }).filter({ visible: true }).first(), "la seconde vignette porte un AUTRE nom").toBeVisible();
    await vignette.click();
    const visionneuse = pauline.page.getByRole("dialog").filter({ has: pauline.page.locator("img") }).last();
    await expect(visionneuse).toBeVisible({ timeout: 30_000 });
    await verifier(pauline.page, "la croix de la visionneuse", '[role="dialog"] button[aria-label="Fermer"]', /Fermer/);
    await verifier(pauline.page, "la flèche « précédente »", '[role="dialog"] button[aria-label*="précédente" i]', /Photo précédente/);
    await verifier(pauline.page, "la flèche « suivante »", '[role="dialog"] button[aria-label*="suivante" i]', /Photo suivante/);

    expect(absents, `contrôles introuvables : ${absents.join(", ")}`).toHaveLength(0);
    expect(anglais, `libellés inattendus (anglais ou hors sujet) : ${anglais.join(" | ")}`).toHaveLength(0);
    test.info().annotations.push({ type: "note", description: releve.map((r) => `${r.controle} → « ${r.nom} »`).join(" ; ") });
  });

  test("WEB-A11Y-6 · les champs en erreur sont annoncés", async ({ navigateurVisiteur }) => {
    const { page } = await navigateurVisiteur();
    /* Même piège que WEB-A11Y-2 : cliquer avant l'hydratation envoie le formulaire en natif, sans
       validation (mesuré : aucun champ marqué). On attend le premier appel d'API du client. */
    const hydratee = page.waitForResponse((r) => r.url().includes("/api/"), { timeout: 60_000 }).catch(() => undefined);
    await page.goto("/fr/register", { waitUntil: "domcontentloaded" });
    const formulaire = page.locator("main form").first();
    await expect(formulaire.locator("#email")).toBeVisible({ timeout: 90_000 });
    await hydratee;
    /* On valide à vide. */
    await formulaire.getByRole("button", { name: /Créer mon compte/ }).click();
    await page.waitForTimeout(1_500);
    /* Chaque champ en erreur porte la marque, et son message lui est LIÉ. */
    const diagnostic = await page.evaluate(() => {
      const champs = [...document.querySelectorAll<HTMLInputElement>("main form input")];
      return champs.map((c) => {
        const invalide = c.getAttribute("aria-invalid") === "true";
        const decrit = c.getAttribute("aria-describedby");
        const message = decrit ? (document.getElementById(decrit)?.textContent ?? "").trim() : "";
        return { id: c.id || c.name || c.type, invalide, decrit: Boolean(decrit), message: message.slice(0, 60) };
      });
    });
    const enErreur = diagnostic.filter((d) => d.invalide);
    expect(enErreur.length, `des champs sont marqués en erreur (${JSON.stringify(diagnostic).slice(0, 300)})`).toBeGreaterThan(0);
    const sansMessageLie = enErreur.filter((d) => !d.decrit || !d.message);
    expect(sansMessageLie, `chaque champ en erreur porte SON message (${sansMessageLie.map((d) => d.id).join(", ")})`).toHaveLength(0);
    /* Étape 2 — au clavier, depuis le haut du formulaire, on atteint un champ en erreur. */
    await formulaire.locator("input").first().focus();
    let atteint = "";
    for (let i = 0; i < 8 && !atteint; i++) {
      atteint = await page.evaluate(() => {
        const a = document.activeElement as HTMLInputElement | null;
        return a?.getAttribute("aria-invalid") === "true" ? a.id || a.name : "";
      });
      if (!atteint) await page.keyboard.press("Tab");
    }
    expect(atteint, "un champ en erreur est atteint au clavier").not.toBe("");
    test.info().annotations.push({ type: "note", description: enErreur.map((d) => `${d.id} → « ${d.message} »`).join(" ; ") });
  });

  test("WEB-A11Y-7 · le contraste en mode sombre", async ({ navigateurConnecte, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    const { page, contexte } = await navigateurConnecte("aminata");
    /* La messagerie avec ses BULLES (le cahier les cite) : un vrai fil, pas la seule liste. */
    const fil = await FilMessagerie.identifiantDuFil(contexte, jeuEssai.deal("bzv-picked").id);
    /* On force le thème sombre comme le ferait le membre (next-themes lit ce stockage). */
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem("theme", "dark");
      } catch {
        /* stockage indisponible */
      }
    });
    const pires: string[] = [];
    /* Les quatre écrans du cahier (accueil, recherche, suivi d'un envoi, messagerie) + « Mes envois »,
       où vivent les badges de statut et les montants. */
    for (const [chemin, nom] of [
      ["/fr", "accueil"],
      ["/fr/search", "recherche"],
      [`/fr/bookings/${jeuEssai.deal("bzv-picked").id}`, "suivi d'un envoi"],
      [`/fr/dashboard/messages?conversation=${fil}`, "fil de messagerie"],
      ["/fr/dashboard/shipments", "mes envois"],
    ] as const) {
      await page.goto(chemin, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 90_000 });
      await page.waitForTimeout(1_500);
      const sombre = await page.evaluate(() => document.documentElement.classList.contains("dark"));
      expect(sombre, `${nom} : le mode sombre est bien actif`).toBe(true);
      const mauvais = await contrastesInsuffisants(page, 3);
      for (const m of mauvais) pires.push(`${nom} : « ${m.texte} » ${m.ratio}:1 (${m.couleur} sur ${m.fond})`);
    }
    expect(pires, `textes illisibles en mode sombre : ${pires.join(" | ")}`).toHaveLength(0);
  });

  test("WEB-A11Y-8 · le zoom à 200 %", async ({ navigateurConnecte, jeuEssai }) => {
    test.setTimeout(5 * 60_000);
    const { page } = await navigateurConnecte("aminata");
    /* Zoomer à 200 %, c'est diviser la surface utile par deux : 1280 × 840 → 640 × 420. */
    await page.setViewportSize({ width: 640, height: 420 });
    const deal = jeuEssai.deal("bzv-picked").id;
    for (const [chemin, nom] of [
      ["/fr", "accueil"],
      [`/fr/bookings/${deal}`, "suivi d'un envoi"],
    ] as const) {
      await page.goto(chemin, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 90_000 });
      await page.waitForTimeout(1_500);
      expect(await debordement(page), `${nom} à 200 % : aucun défilement horizontal`).toBeLessThanOrEqual(1);
      expect((await texte(page)).length, `${nom} à 200 % : la page a du contenu`).toBeGreaterThan(100);
    }
  });
});
