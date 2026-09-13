/**
 * web-nrg.spec.ts — cahier 01-WEB, chapitre 7 « Non-régression »
 * ==============================================================
 * Douze points qui ont DÉJÀ cassé. Le cahier les veut rejoués à chaque session de recette, avant de déclarer une
 * recette terminée. Le harnais les tient donc en un seul fichier, court à lancer :
 *
 *     npx playwright test --config=apps/e2e/playwright.config.ts src/chapitres/web-nrg.spec.ts
 *
 * Trois partis pris :
 *  - **chaque fiche joue ce que le cahier écrit, en entier** — « chaque trajet du jeu d'essai », « les quatre
 *    portes », « écris et envoie un message » : une régression revient toujours par le cas qu'on a sauté ;
 *  - **la console est un témoin** (`ecouterLaConsole`) : un avertissement de clé React, une exception « Cannot read
 *    properties of undefined », une erreur next-intl (`MISSING_MESSAGE`, `INVALID_KEY`) sont des preuves ;
 *  - **les gestes sensibles s'arrêtent à la porte** : on vérifie qu'elle s'ouvre, on ne demande aucun code — six
 *    codes par heure au plus, et le quota sert aux chapitres qui vont jusqu'au bout.
 */
import { test, expect, connexion, type Navigateur } from "../fixtures/yamba";
import { type Compte } from "../fixtures/comptes";
import { compteNeuf } from "../fixtures/compte-neuf";
import { Inscription } from "../pages/inscription";
import { Securite } from "../pages/securite";
import { JeuEssai } from "../fixtures/jeu-essai";
import { adresseDeLApi } from "../fixtures/adresses";
import { normaliserEspaces, AssistantReservation } from "../pages/reservation";
import { ouvrirLaRecherche } from "../pages/recherche";
import { FilMessagerie, dateLocale } from "../pages/fil-messagerie";
import { MesTrajets } from "../pages/mes-trajets";
import { aucunDebordement, ecouterLaConsole, rienNeSortDuCadre, tientDansLEcran } from "../pages/ecran";
// Les plafonds PAR DÉFAUT du gateway (A147), lus dans le code : le poste de recette les relève par l'environnement.
import { RATE_LIMIT_ANONYMOUS, RATE_LIMIT_AUTHENTICATED } from "../../../../packages/middleware/rate-limit-tier";

type Page = Navigateur["page"];
const api = () => adresseDeLApi();
const texte = async (page: Page) => normaliserEspaces(await page.locator("body").innerText());

/** Attend qu'un écran ait fini de charger : plus aucun squelette, texte stable (leçon du chapitre 5.32). */
async function ecranPret(page: Page): Promise<string> {
  let lu = "";
  let stables = 0;
  for (let i = 0; i < 30 && stables < 2; i++) {
    await page.waitForTimeout(1_000);
    const t = await texte(page);
    stables = t === lu && t.length > 150 && (await page.locator(".animate-pulse").count()) === 0 ? stables + 1 : 0;
    lu = t;
  }
  return lu;
}

test.describe("WEB-NRG — non-régression (chapitre 7)", () => {
  /* PAS en série : douze régressions indépendantes — une qui revient ne doit pas masquer les onze autres. */

  test.beforeAll(() => {
    new JeuEssai().rejouer();
  });

  test("WEB-NRG-1 · jamais un tiret à la place de l'heure d'arrivée", async ({ navigateurVisiteur }) => {
    for (const mobile of [false, true]) {
      const { page, contexte } = await navigateurVisiteur(mobile ? { mobile: true } : undefined);
      /* Les cartes ATTENDUES, par l'API : « au moins une carte » passerait sur une recherche à moitié vide. */
      const r = await contexte.request.get(`${api()}/trips/search?from=Paris&to=Brazzaville&limit=50`);
      expect(r.ok(), "GET /trips/search").toBe(true);
      const attendus = ((await r.json()) as { trips: Array<{ id: string }> }).trips.map((t) => t.id);
      await ouvrirLaRecherche(page, { from: "Paris", to: "Brazzaville" });
      await expect.poll(() => texte(page), { timeout: 90_000, message: "les cartes arrivent" }).toMatch(/€/);
      await ecranPret(page);
      /* Sur chaque carte VISIBLE (chaque carte existe deux fois dans le DOM, arbre mobile et desktop) : la ligne
         d'heures ne contient ni tiret seul, ni case vide. */
      const cartes = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLAnchorElement>('a[href*="/trips/"]')]
          .filter((c) => c.getClientRects().length > 0 && /\/trips\/[0-9a-f]{24}$/.test(c.getAttribute("href") ?? ""))
          .map((c) => ({ id: (c.getAttribute("href") ?? "").split("/trips/")[1], lignes: c.innerText.split("\n").map((x) => x.trim()) }))
      );
      const vus = [...new Set(cartes.map((c) => c.id))];
      expect(vus.sort(), `${mobile ? "mobile" : "desktop"} : exactement les ${attendus.length} trajets servis par l'API`).toEqual([...attendus].sort());
      const fautives = cartes.flatMap((c, i) => c.lignes.filter((x) => /^[—–-]$/.test(x) || /\d{1,2}[:h]\d{2}\s*[—–-]\s*$/.test(x) || /^\s*[—–-]\s*\d/.test(x)).map((x) => `carte ${i + 1} : « ${x} »`));
      expect(fautives, `${mobile ? "mobile" : "desktop"} : un tiret à la place d'une heure`).toHaveLength(0);
    }
  });

  test("WEB-NRG-2 · jamais un prix à zéro, jamais « ⭐ 0.0 »", async ({ navigateurVisiteur, navigateurConnecte, jeuEssai }) => {
    test.setTimeout(8 * 60_000);
    // `(?<![\d,.])` : « 230,00 € » CONTIENT « 0,00 € » — faux positif payé au premier passage.
    const zero = /(?<![\d,.])0[,.]00\s*€|€\s*0\.00(?!\d)|(?<![\d,.])0\s*€|Total —|Payer —/;
    /* 1. La recherche SANS critère : toutes les cartes. */
    const { page } = await navigateurVisiteur();
    await page.goto("/fr/search", { waitUntil: "domcontentloaded" });
    const recherche = await ecranPret(page);
    expect(recherche, "recherche sans critère : aucun prix à zéro").not.toMatch(zero);
    expect(recherche, "aucune note « ⭐ 0.0 »").not.toMatch(/⭐\s*0[.,]0|\b0[.,]0\s*★/);
    /* 2. La page de CHAQUE trajet du jeu d'essai. */
    const pages: string[] = [];
    for (const [cle, id] of jeuEssai.tousLesTrajets()) {
      await page.goto(`/fr/trips/${id}`, { waitUntil: "domcontentloaded" });
      const t = await ecranPret(page);
      expect(t, `${cle} : aucun prix à zéro`).not.toMatch(zero);
      expect(t, `${cle} : aucune note « ⭐ 0.0 »`).not.toMatch(/⭐\s*0[.,]0/);
      if (/\/kg/.test(t)) expect(t, `${cle} : un trajet au kilo montre un exemple chiffré`).toMatch(/≈\s*\d+[,.]\d{2}\s*€|≈\s*€\s*\d/);
      pages.push(cle);
    }
    /* 2 bis. La même recherche et la même page sur TÉLÉPHONE : la carte et le récapitulatif mobiles sont d'autres arbres. */
    const telephone = await navigateurVisiteur({ mobile: true });
    await telephone.page.goto("/fr/search", { waitUntil: "domcontentloaded" });
    expect(await ecranPret(telephone.page), "téléphone : recherche sans prix à zéro").not.toMatch(zero);
    await telephone.page.goto(`/fr/trips/${jeuEssai.trajet("bzv-perkg")}`, { waitUntil: "domcontentloaded" });
    expect(await ecranPret(telephone.page), "téléphone : page de trajet sans prix à zéro").not.toMatch(zero);
    /* 3. L'étape 1 sans poids : l'invite, jamais un total à zéro. */
    const aminata = await navigateurConnecte("aminata", { parEcran: true });
    const assistant = new AssistantReservation(aminata.page);
    await assistant.ouvrir(jeuEssai.trajet("bzv-perkg"));
    await aminata.page.locator('input[placeholder="2,5"]').fill("");
    await expect(aminata.page.getByText("Indique le poids du colis pour voir le prix.")).toBeVisible({ timeout: 15_000 });
    expect(await texte(aminata.page), "récapitulatif sans poids : jamais zéro").not.toMatch(zero);
    test.info().annotations.push({ type: "note", description: `pages de trajet relues : ${pages.join(", ")}` });
  });

  test("WEB-NRG-3 · la croix des quatre portes d'identité, sur téléphone et sur grand écran", async ({ navigateurVisiteur, jeuEssai }) => {
    test.setTimeout(8 * 60_000);
    /* Le cahier : « sur mobile comme sur desktop ». */
    for (const mobile of [true, false]) {
    const { page } = await navigateurVisiteur(mobile ? { mobile: true } : undefined);
    const verifierLaCroix = async (porte: string) => {
      const fenetre = page.locator('[role="dialog"][aria-modal="true"]').filter({ hasText: /Connecte-toi/ }).filter({ visible: true }).last();
      await expect(fenetre, `${porte} : la porte s'ouvre`).toBeVisible({ timeout: 30_000 });
      const croix = fenetre.getByRole("button", { name: "Fermer", exact: true });
      await expect(croix, `${porte} : la croix est visible`).toBeVisible();
      await tientDansLEcran(page, croix, `${porte} : la croix`);
      await expect(fenetre.getByText("Plus tard", { exact: true }).last(), `${porte} : le lien « Plus tard » aussi`).toBeVisible();
      await croix.click();
      await expect(fenetre, `${porte} : la croix ferme`).toBeHidden({ timeout: 15_000 });
    };
    /* « Réserver » et le cœur, sur la page d'un trajet. */
    await page.goto(`/fr/trips/${jeuEssai.trajet("bzv-upcoming")}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: /^Réserver/ }).filter({ visible: true }).last()).toBeVisible({ timeout: 90_000 });
    await page.getByRole("button", { name: /^Réserver/ }).filter({ visible: true }).last().click();
    await verifierLaCroix("« Réserver »");
    await page.getByRole("button", { name: "Ajouter aux favoris" }).filter({ visible: true }).first().click();
    await verifierLaCroix("le cœur d'un favori");
    /* « Suivre », sur la page publique du Voyageur. */
    await page.goto("/fr/u/seed-thomas", { waitUntil: "domcontentloaded" });
    const suivre = page.getByRole("button", { name: "Suivre", exact: true }).filter({ visible: true }).first();
    await expect(suivre).toBeVisible({ timeout: 90_000 });
    await suivre.click();
    await verifierLaCroix("« Suivre »");
    /* « Partager un trajet » : dans l'en-tête, ou dans le menu sur téléphone. */
    await page.goto("/fr", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 90_000 });
    // Sur téléphone, le libellé visible est « Partager » ; son nom accessible est « Partager un trajet » (corrigé au chapitre 7).
    // On ATTEND le bouton : un `count()` immédiat tombait avant l'hydratation, ouvrait le menu, qui recouvrait l'en-tête.
    const partager = page.getByRole("banner").getByRole("button", { name: "Partager un trajet", exact: true }).filter({ visible: true }).first();
    await expect(partager, "le bouton de l'en-tête porte le nom complet « Partager un trajet »").toBeVisible({ timeout: 60_000 });
    await partager.click();
    await verifierLaCroix(`« Partager un trajet » (${mobile ? "téléphone" : "grand écran"})`);
    }
  });

  test("WEB-NRG-4 · l'étape 1 de la réservation sur chaque trajet, sans écran blanc", async ({ navigateurConnecte, jeuEssai }) => {
    test.setTimeout(8 * 60_000);
    const { page } = await navigateurConnecte("aminata", { parEcran: true });
    const console_ = ecouterLaConsole(page);
    const releve: string[] = [];
    for (const [cle, id] of jeuEssai.tousLesTrajets()) {
      await page.goto(`/fr/trips/${id}/book`, { waitUntil: "domcontentloaded" });
      const t = await ecranPret(page);
      /* Un trajet parti ou complet peut refuser la réservation : il le DIT. L'écran blanc, lui, n'a pas de texte. */
      const etape1 = t.includes("Décris ton colis");
      expect(etape1 || /n'accepte plus de demandes|plus disponible|déjà parti|complet|n'est plus|ne peut plus|impossible/i.test(t), `${cle} : l'étape 1, ou un refus expliqué (jamais un écran blanc)`).toBe(true);
      if (etape1 && t.includes("n'a pas précisé de lieu")) {
        expect(t, `${cle} : le message du trajet sans lieu`).toContain("Le Voyageur n'a pas précisé de lieu pour ce trajet : vous conviendrez ensemble du point de rendez-vous dans la conversation, une fois la demande acceptée.");
      }
      if (!etape1) {
        /* Regard d'expert du chapitre 7 : le refus propose une suite. */
        await expect(page.getByRole("button", { name: "Chercher un autre trajet" }), `${cle} : le refus propose une suite`).toBeVisible();
      }
      releve.push(`${cle} → ${etape1 ? "étape 1" : "refus expliqué, avec « Chercher un autre trajet »"}`);
    }
    const plantages = console_.erreurs().filter((e) => /Cannot read properties of (undefined|null)|pageerror|is not a function|is undefined/i.test(e));
    expect(plantages, "aucune exception dans la console").toHaveLength(0);
    test.info().annotations.push({ type: "note", description: releve.join(" ; ") });
  });

  test("WEB-NRG-5 · les bulles de l'auteur restent visibles sur téléphone", async ({ navigateurConnecte, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    const { page, contexte } = await navigateurConnecte("pauline", { mobile: true });
    const fil = new FilMessagerie(page);
    const id = await FilMessagerie.identifiantDuFil(contexte, jeuEssai.deal("bzv-accepted").id);
    await fil.ouvrir(id);
    /* 2. Écrire et envoyer : sans message de l'autrice, « tes bulles » n'existent pas et la fiche ne prouve rien. */
    const message = `Je serai au terminal 2E avec un sac orange — ${Date.now()}`;
    await fil.envoyer(message);
    const bulle = page.getByText(message, { exact: true }).last();
    await tientDansLEcran(page, bulle, "ta bulle");
    await aucunDebordement(page, "fil après envoi");
    await rienNeSortDuCadre(page, "fil après envoi");
    /* 3. Un rendez-vous avec un lieu LONG : le titre passe à la ligne. */
    const demain = new Date(Date.now() + 26 * 3_600_000);
    const lieu = "Aéroport Paris-Charles-de-Gaulle, Terminal 2E, porte K, devant le comptoir Air France des bagages hors format";
    await fil.proposerRendezVous({ lieu, debut: dateLocale(demain), fin: dateLocale(new Date(demain.getTime() + 3_600_000)) });
    const titre = page.getByText(lieu).filter({ visible: true }).last();
    await tientDansLEcran(page, titre, "le lieu du rendez-vous");
    await aucunDebordement(page, "fil avec un rendez-vous au lieu long");
    /* 4. La rangée des réponses rapides défile DANS son cadre. */
    const rangee = await page.evaluate(() => {
      const candidats = [...document.querySelectorAll<HTMLElement>("main *")].filter((n) => /(auto|scroll)/.test(getComputedStyle(n).overflowX) && n.scrollWidth > n.clientWidth + 1);
      const r = candidats[0];
      if (!r) return null;
      const avant = r.scrollLeft;
      r.scrollLeft = r.scrollWidth;
      return { defile: r.scrollLeft > avant, pageBouge: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 };
    });
    if (rangee) {
      expect(rangee.defile, "la rangée des réponses rapides défile dans son cadre").toBe(true);
      expect(rangee.pageBouge, "et la page, elle, ne défile pas").toBe(false);
    }
    /* « Voir le numéro » : présent sur un deal accepté, dans l'écran — plus de saut silencieux. */
    const numero = page.getByRole("button", { name: "Voir le numéro" }).filter({ visible: true }).first();
    await expect(numero, "« Voir le numéro » est proposé").toBeVisible({ timeout: 15_000 });
    await tientDansLEcran(page, numero, "« Voir le numéro »");
    test.info().annotations.push({ type: "note", description: rangee ? "rangée de réponses rapides : défile dans son cadre" : "constat : aucune rangée défilante dans ce fil (réponses rapides tenant dans l'écran)" });
  });

  test("WEB-NRG-6 · aucun avertissement de clé React, ni de next-intl, sur les écrans à listes (et WEB-NRG-12)", async ({ navigateurConnecte, jeuEssai }) => {
    test.setTimeout(10 * 60_000);
    const aminata = await navigateurConnecte("aminata", { parEcran: true });
    const thomas = await navigateurConnecte("thomas");
    const temoins = [
      { compte: "aminata", page: aminata.page, console_: ecouterLaConsole(aminata.page) },
      { compte: "thomas", page: thomas.page, console_: ecouterLaConsole(thomas.page) },
    ];
    const ecrans = (l: string): Array<[number, string, string]> => [
      [0, "recherche", `/${l}/search`],
      [0, "mes envois", `/${l}/dashboard/shipments`],
      [1, "mes trajets", `/${l}/dashboard/trips`],
      [1, "finances", `/${l}/dashboard/finances`],
      [0, "notifications", `/${l}/dashboard/notifications`],
      [0, "messages", `/${l}/dashboard/messages`],
      [0, "détail d'un trajet", `/${l}/trips/${jeuEssai.trajet("bzv-upcoming")}`],
      [0, "étape 1 d'une réservation", `/${l}/trips/${jeuEssai.trajet("bzv-perkg")}/book`],
      [1, "demande reçue", `/${l}/carrier/deals/${jeuEssai.deal("bzv-pending").id}`],
      [0, "suivi d'un envoi", `/${l}/bookings/${jeuEssai.deal("bzv-picked").id}`],
    ];
    const vides: string[] = [];
    for (const l of ["fr", "en"]) {
      for (const [qui, nom, chemin] of ecrans(l)) {
        const { page } = temoins[qui];
        await page.goto(chemin, { waitUntil: "domcontentloaded" });
        const t = await ecranPret(page);
        /* WEB-NRG-12 — un domaine de textes refusé au rendu laisse une section VIDE ou une clé affichée. */
        const sectionsVides = await page.evaluate(() =>
          [...document.querySelectorAll<HTMLElement>("main section, main h2, main h3")]
            .filter((n) => n.getClientRects().length > 0 && (n.innerText ?? "").trim() === "" && n.querySelector("img, svg, canvas, input, button") === null)
            .map((n) => n.tagName.toLowerCase())
        );
        if (sectionsVides.length) vides.push(`[${l}] ${nom} : ${sectionsVides.length} ${sectionsVides[0]} vide(s)`);
        expect(t, `[${l}] ${nom} : aucune clé technique affichée`).not.toMatch(/\b[a-z][a-zA-Z]+\.[a-z][a-zA-Z]+\.[a-zA-Z_]+\b(?![\w@])/);
      }
    }
    const cles = temoins.flatMap(({ compte, console_ }) =>
      [...console_.erreurs(), ...console_.avertissements()].filter((m) => /unique "key" prop|Each child in a list|Warning: /i.test(m)).map((m) => `${compte} : ${m.slice(0, 220)}`)
    );
    const intl = temoins.flatMap(({ compte, console_ }) =>
      [...console_.erreurs(), ...console_.avertissements()].filter((m) => /MISSING_MESSAGE|INVALID_KEY|INVALID_MESSAGE|FORMATTING_ERROR|IntlError/.test(m)).map((m) => `${compte} : ${m.slice(0, 220)}`)
    );
    expect([...new Set(cles)], "WEB-NRG-6 : avertissements React dans la console").toHaveLength(0);
    expect([...new Set(intl)], "WEB-NRG-12 : erreurs next-intl dans la console").toHaveLength(0);
    expect(vides, "WEB-NRG-12 : sections vides").toHaveLength(0);
  });

  test("WEB-NRG-7 · les cinq gestes sensibles ouvrent la porte par code", async ({ navigateurConnecte, navigateurVisiteur, mailpit, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    /* Une porte vérifiée, puis refermée SANS demander de code (quota OTP). */
    const porteOuverte = async (page: Page, geste: string, route: RegExp, declencher: () => Promise<void>) => {
      const refus = page.waitForResponse((r) => route.test(r.url()) && r.request().method() !== "GET", { timeout: 30_000 });
      await declencher();
      const r = await refus;
      expect(r.status(), `${geste} : le serveur exige la confirmation (403)`).toBe(403);
      expect(((await r.json()) as { details?: { code?: string } }).details?.code, `${geste} : SUDO_REQUIRED`).toBe("SUDO_REQUIRED");
      await expect(page.getByText("Confirme que c'est bien toi").filter({ visible: true }).first(), `${geste} : la porte s'ouvre`).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole("button", { name: "M'envoyer le code" }).filter({ visible: true }).first(), `${geste} : « M'envoyer le code »`).toBeVisible();
    };
    const { page } = await navigateurConnecte("aminata", { parEcran: true });
    /* 1. Le mot de passe. */
    await page.goto("/fr/dashboard/security", { waitUntil: "networkidle" });
    await page.locator("main").getByRole("button", { name: "Changer", exact: true }).first().click();
    await page.getByPlaceholder("Nouveau mot de passe").fill("Yamba-Recette-2026!");
    await page.getByPlaceholder("Confirme le mot de passe").fill("Yamba-Recette-2026!");
    await porteOuverte(page, "changer le mot de passe", /\/auth\/me\/password/, () => page.getByRole("button", { name: "Changer le mot de passe" }).click());
    /* 2. L'adresse email. */
    await page.goto("/fr/dashboard/security", { waitUntil: "networkidle" });
    await page.locator("main").getByRole("button", { name: "Changer", exact: true }).nth(1).click();
    await page.getByPlaceholder(/Nouvel(le)? (adresse|e-?mail)/i).fill(`aminata.recette+${Date.now()}@seed.yamba.dev`);
    await porteOuverte(page, "changer l'adresse email", /\/auth\/me\/email/, () => page.locator("main").getByRole("button", { name: /Envoyer|Recevoir|Changer l'adresse|Confirmer/ }).filter({ visible: true }).last().click());
    /* 3. Le téléchargement des données. */
    await page.goto("/fr/dashboard/security", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Télécharger", exact: true }).click();
    await porteOuverte(page, "télécharger ses données", /\/auth\/me\/data-export/, () => page.getByRole("button", { name: "Télécharger le fichier" }).click());
    /* 4. Le tableau de bord Stripe (un Voyageur). */
    const thomas = await navigateurConnecte("thomas");
    await thomas.page.goto("/fr/dashboard/finances", { waitUntil: "networkidle" });
    await porteOuverte(thomas.page, "ouvrir le tableau de bord Stripe", /\/carrier\/stripe\/dashboard-link/, () => thomas.page.getByRole("button", { name: "Voir mes virements sur Stripe" }).click());
    /* 5. La suppression du compte — sur un COMPTE NEUF JETABLE, jamais un compte du jeu d'essai : si une fenêtre sudo
       était déjà ouverte, « Supprimer définitivement » effacerait réellement le compte. Aminata, elle, a des deals
       vivants : sa suppression est bloquée AVANT la porte (D63), ce qui ne prouverait rien ici. */
    const neuf = compteNeuf("Nadège", "Okemba");
    const jetable = await navigateurVisiteur();
    await new Inscription(jetable.page).creer(neuf, mailpit);
    await connexion(jetable.page, { cle: "neuf", email: neuf.email, prenom: neuf.prenom, nom: neuf.nom, role: "EXPEDITEUR" } as Compte, neuf.motDePasse);
    const securite = new Securite(jetable.page);
    await securite.ouvrir();
    await securite.cliquerSupprimer();
    await expect(jetable.page.getByText("Impossible pour l'instant"), "un compte neuf n'a rien en cours").toHaveCount(0, { timeout: 15_000 });
    await jetable.page.getByPlaceholder("SUPPRIMER").fill("SUPPRIMER");
    try {
      await porteOuverte(jetable.page, "supprimer son compte", /\/auth\/me\/(erasure|erase|account|delete)/, () =>
        jetable.page.getByRole("button", { name: "Supprimer définitivement mon compte" }).click()
      );
    } finally {
      /* Regard d'expert du chapitre 7 : un compte jetable par exécution s'accumulait en base (piège 22). Il est
         retiré à la fin — CE compte-là seulement, par son adresse exacte, et la manœuvre est consignée. */
      jeuEssai.manoeuvre(
        `purge du compte jetable de WEB-NRG-7 (${neuf.email})`,
        `import p from "./packages/libs/prisma"; (async () => { await p.user.deleteMany({ where: { emailNormalized: ${JSON.stringify(neuf.email.toLowerCase())} } }); process.exit(0); })();`
      );
    }
  });

  test("WEB-NRG-8 · les libellés des statuts de trajet et leurs toasts", async ({ navigateurConnecte }) => {
    test.setTimeout(5 * 60_000);
    /* Les libellés à l'écran chez Thomas, en français puis en anglais. */
    const thomas = await navigateurConnecte("thomas");
    await thomas.page.goto("/fr/dashboard/trips", { waitUntil: "domcontentloaded" });
    const fr = await ecranPret(thomas.page);
    expect(fr, "FR : « En ligne »").toMatch(/\bEn ligne\b/);
    expect(fr, "FR : jamais « Actif » ni « En pause »").not.toMatch(/\bActif\b|\bEn pause\b/);
    // `\b` ne connaît pas « é » (leçon du 5.32, repayée ici) : frontières Unicode explicites.
    const mot = (l: string) => new RegExp(`(?<![\\p{L}])${l}(?![\\p{L}])`, "u");
    const vus = ["Brouillon", "En ligne", "Masqué", "Terminé", "Annulé", "Archivé"].filter((l) => mot(l).test(fr));
    await thomas.page.goto("/en/dashboard/trips", { waitUntil: "domcontentloaded" });
    const en = await ecranPret(thomas.page);
    expect(en, "EN : « Online »").toMatch(/\bOnline\b/);
    expect(en, "EN : jamais « Active » ni « Paused »").not.toMatch(/\bActive\b|\bPaused\b/);

    /* Les toasts, par le menu de la ligne, sur un trajet LIBRE créé pour la fiche (Joséphine) — annulé à la fin. */
    const { page, contexte } = await navigateurConnecte("josephine", { parEcran: true });
    const creation = await contexte.request.post(`${api()}/trips`, {
      data: {
        transportMode: "PLANE", flightType: "DIRECT", tripType: "ONE_WAY",
        originCity: "Bruxelles", originCountryCode: "BE", destinationCity: "Kinshasa", destinationCountryCode: "CD",
        departureAt: new Date(Date.now() + 20 * 86_400_000).toISOString(), arrivalAt: new Date(Date.now() + 21 * 86_400_000).toISOString(),
        pricePerKgCents: 1150, capacityKg: 23,
        pickupLocations: [{ kind: "AIRPORT", flexibility: "EXACT", details: "Bruxelles-Zaventem, hall des départs" }],
        deliveryLocations: [{ kind: "AIRPORT", flexibility: "EXACT", details: "Kinshasa N'djili, hall d'arrivée" }],
      },
    });
    expect(creation.status(), `création du trajet de la fiche : ${await creation.text()}`).toBe(201);
    const corps = (await creation.json()) as { trip?: { id: string; status: string }; id?: string; status?: string };
    const id = corps.trip?.id ?? corps.id!;
    try {
      if ((corps.trip?.status ?? corps.status) !== "PUBLISHED") expect((await contexte.request.post(`${api()}/trips/${id}/publish`)).ok(), "publication").toBe(true);
      const trajets = new MesTrajets(page);
      await trajets.ouvrir();
      const masque = await trajets.actionDuMenu("Bruxelles → Kinshasa", id, /^Masquer/, /^Trajet masqué$/);
      await page.reload({ waitUntil: "domcontentloaded" });
      await ecranPret(page);
      expect(await texte(page), "le badge dit « Masqué »").toMatch(/(?<![\p{L}])Masqué(?![\p{L}])/u);
      const remis = await trajets.actionDuMenu("Bruxelles → Kinshasa", id, /^Remettre en ligne/, /^Trajet remis en ligne$/);
      test.info().annotations.push({ type: "note", description: `libellés vus chez Thomas : ${vus.join(", ")} ; toasts « ${masque} » puis « ${remis} »` });
    } finally {
      await contexte.request.post(`${api()}/trips/${id}/cancel`);
    }
  });

  test("WEB-NRG-9 · un trajet qui porte des deals ne s'annule pas", async ({ navigateurConnecte, jeuEssai }) => {
    const { page, contexte } = await navigateurConnecte("thomas");
    const id = jeuEssai.trajet("bzv-upcoming");
    const trajets = new MesTrajets(page);
    await trajets.ouvrir();
    const refus = await trajets.tenterDAnnulerLeTrajet("Paris → Brazzaville", id);
    expect(refus.statut, "le serveur refuse (409)").toBe(409);
    expect(refus.toast, "le refus NOMME le nombre de deals").toMatch(/^Ce trajet porte encore (\d+|un) deals? en cours/);
    /* Regard d'expert du chapitre 7 : le refus MÈNE aux deals à annuler. */
    await page.getByRole("button", { name: "Voir ses deals" }).first().click();
    await expect(page, "« Voir ses deals » ouvre le trajet").toHaveURL(new RegExp(`/dashboard/trips/${id}$`), { timeout: 30_000 });
    await expect.poll(() => texte(page), { timeout: 60_000, message: "les deals du trajet sont listés" }).toMatch(/Aminata|Pauline|En attente|Accepté/);
    const r = await contexte.request.get(`${api()}/trips/${id}`);
    expect(((await r.json()) as { trip?: { status: string }; status?: string }).trip?.status ?? "", "le trajet reste en ligne").toBe("PUBLISHED");
  });

  test("WEB-NRG-10 · cinq minutes de navigation normale sans limitation", async ({ navigateurConnecte, jeuEssai }) => {
    test.setTimeout(9 * 60_000);
    const { page } = await navigateurConnecte("aminata", { parEcran: true });
    const statuts: number[] = [];
    let plafondServi = 0;
    let requetes = 0;
    let pages = 0;
    const parRoute = new Map<string, number>();
    page.on("response", (r) => {
      if (!r.url().includes("/api/")) return;
      requetes += 1;
      // La route sans identifiants ni paramètres : ce qui coûte, écran après écran.
      const route = `${r.request().method()} ${new URL(r.url()).pathname.replace(/[0-9a-f]{24}/g, ":id")}`;
      parRoute.set(route, (parRoute.get(route) ?? 0) + 1);
      statuts.push(r.status());
      const limite = Number(r.headers()["ratelimit-limit"] ?? r.headers()["x-ratelimit-limit"] ?? 0);
      if (limite) plafondServi = limite;
    });
    const parcours = [
      "/fr/search",
      `/fr/trips/${jeuEssai.trajet("bzv-upcoming")}`,
      `/fr/trips/${jeuEssai.trajet("bzv-perkg")}`,
      `/fr/trips/${jeuEssai.trajet("yul")}`,
      "/fr/dashboard/home",
      "/fr/dashboard/shipments",
      "/fr/dashboard/messages",
      "/fr/dashboard/notifications",
      `/fr/bookings/${jeuEssai.deal("bzv-picked").id}`,
    ];
    /* Phase 1 (3 min) — par RECHARGEMENT (`page.goto`) : le cas pessimiste (tout le layout remonte à chaque page). */
    const finRechargement = Date.now() + 3 * 60_000;
    while (Date.now() < finRechargement) {
      for (const chemin of parcours) {
        if (Date.now() >= finRechargement) break;
        await page.goto(chemin, { waitUntil: "domcontentloaded" });
        await page.waitForLoadState("networkidle").catch(() => undefined);
        pages += 1;
      }
    }
    const rechargement = { pages, requetes };
    /* Phase 2 (2 min) — par LIENS, comme un membre : la barre latérale du tableau de bord, sans rechargement.
       Regard d'expert du chapitre 7 : la mesure par rechargement surestimait le coût réel d'une page. */
    await page.goto("/fr/dashboard/home", { waitUntil: "networkidle" });
    const liens = ["Mes envois", "Messages", "Notifications", "Mes favoris", "Finances", "Accueil"];
    const finLiens = Date.now() + 2 * 60_000;
    while (Date.now() < finLiens) {
      for (const nom of liens) {
        if (Date.now() >= finLiens) break;
        await page.getByRole("link", { name: nom, exact: true }).filter({ visible: true }).first().click();
        await page.waitForLoadState("networkidle").catch(() => undefined);
        await page.waitForTimeout(500);
        pages += 1;
      }
    }
    const parLiens = { pages: pages - rechargement.pages, requetes: requetes - rechargement.requetes };
    expect(await page.getByText(/Trop de tentatives|Too many/).count(), "aucun message « Trop de tentatives »").toBe(0);
    expect(statuts.filter((s) => s === 429).length, `aucune réponse 429 sur ${requetes} appels`).toBe(0);
    /* Le poste de recette RELÈVE les plafonds (RATE_LIMIT_*_MAX dans .env) : « aucun 429 ici » ne dit rien de la
       production. On mesure donc le coût d'une page et on le projette sur les plafonds PAR DÉFAUT du code, à un
       rythme humain actif — une page toutes les 10 secondes, 90 pages par quart d'heure. */
    const parPage = rechargement.requetes / Math.max(1, rechargement.pages);
    const parPageLiens = parLiens.requetes / Math.max(1, parLiens.pages);
    const membreHumain = Math.round(parPage * 90);
    expect(Math.round(parPageLiens * 90), `par liens, un membre actif tient largement sous ${RATE_LIMIT_AUTHENTICATED}`).toBeLessThan(RATE_LIMIT_AUTHENTICATED);
    expect(membreHumain, `un membre actif (90 pages / 15 min × ${parPage.toFixed(1)} appels) tient sous le plafond de production des membres (${RATE_LIMIT_AUTHENTICATED})`).toBeLessThan(RATE_LIMIT_AUTHENTICATED);
    const pagesVisiteur = Math.floor(RATE_LIMIT_ANONYMOUS / parPage);
    test.info().annotations.push({
      type: "mesure",
      description:
        `par rechargement : ${rechargement.pages} pages, ${rechargement.requetes} appels → ${parPage.toFixed(1)} par page ; par liens : ${parLiens.pages} pages, ${parLiens.requetes} appels → ${parPageLiens.toFixed(1)} par page ; plafond servi sur le poste ${plafondServi} / 15 min ` +
        `(production : membres ${RATE_LIMIT_AUTHENTICATED}, visiteurs ${RATE_LIMIT_ANONYMOUS}) ; membre actif ≈ ${membreHumain} appels / 15 min ` +
        `(${Math.round((membreHumain / RATE_LIMIT_AUTHENTICATED) * 100)} % du plafond) ; un VISITEUR atteint son plafond en ≈ ${pagesVisiteur} pages / 15 min`,
    });
    test.info().annotations.push({
      type: "mesure",
      description: `appels par route (par page) : ${[...parRoute].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => `${k} ${(n / Math.max(1, pages)).toFixed(2)}`).join(" · ")}`,
    });
  });

  test("WEB-NRG-11 · les origines du poste passent le contrôle d'accès du gateway", async ({ playwright }) => {
    const origines = ["http://localhost:3000", "http://localhost:3001", new URL(api()).origin.replace(/:\d+$/, ":3000")];
    const requete = await playwright.request.newContext();
    const constats: string[] = [];
    for (const origine of [...new Set(origines)]) {
      const r = await requete.get(`${api()}/trips/search?from=Paris&to=Brazzaville`, { headers: { Origin: origine } });
      expect(r.status(), `${origine} : l'appel aboutit (jamais 500 « Not allowed by CORS »)`).toBeLessThan(500);
      expect(r.headers()["access-control-allow-origin"], `${origine} : l'origine est autorisée`).toBe(origine);
      constats.push(`${origine} → ${r.status()}`);
    }
    /* Contre-épreuve : une origine étrangère n'est PAS autorisée (sinon la liste ne garde rien). */
    const etrangere = await requete.get(`${api()}/trips/search?from=Paris&to=Brazzaville`, { headers: { Origin: "https://yamba.example.org" } });
    expect(etrangere.headers()["access-control-allow-origin"], "une origine étrangère n'est pas autorisée").toBeUndefined();
    /* Chapitre 7 : un REFUS, pas une panne — 403 avec son code, jamais 500 « Not allowed by CORS ». */
    expect(etrangere.status(), "une origine refusée répond 403").toBe(403);
    expect(((await etrangere.json()) as { details?: { code?: string } }).details?.code, "code ORIGIN_NOT_ALLOWED").toBe("ORIGIN_NOT_ALLOWED");
    /* Et le refus est franc : une ÉCRITURE d'un site tiers n'atteint jamais les services. */
    const ecriture = await requete.post(`${api()}/auth/login`, { headers: { Origin: "https://yamba.example.org" }, data: { email: "x@y.z", password: "x" } });
    expect(ecriture.status(), "un POST d'une origine étrangère est refusé AVANT les services").toBe(403);
    constats.push(`https://yamba.example.org → ${etrangere.status()} (sans en-tête d'autorisation)`);
    test.info().annotations.push({ type: "note", description: constats.join(" ; ") });
    await requete.dispose();
  });
});
