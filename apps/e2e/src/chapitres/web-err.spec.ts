/**
 * web-err.spec.ts — cahier 01-WEB, chapitre 5.29 « Pages d'erreur et page introuvable »
 * =====================================================================================
 * Ce que voit un membre quand une page n'existe pas, quand une ressource n'existe pas, et quand un incident survient
 * — y compris au pire endroit possible, le tunnel de réservation, où la seule question est « ai-je été débité ? ».
 *
 * COMMENT ON DÉCLENCHE UN INCIDENT. Le cahier prévoit de « demander à un développeur un moyen sûr de déclencher
 * l'erreur » : c'est fait. Deux routes de recette, **introuvables en production** (`notFound()` dès que
 * `NODE_ENV === "production"`), lèvent une panne volontaire — `/fr/dev/erreur` hors tunnel et
 * `/fr/bookings/dev-erreur` dedans (le chemin compte : la frontière n'ajoute la phrase sur le paiement que sous
 * `/book` ou `/bookings`). `?type=chunk` lève une erreur portant la signature d'un morceau de code manquant, c'est-
 * à-dire ce que produit une version publiée pendant la navigation.
 *
 * Les autres méthodes ont été essayées et écartées, et c'est un résultat en soi : couper la passerelle ne fait PAS
 * tomber la frontière d'erreur (les écrans se chargent côté navigateur et affichent leurs états d'erreur locaux),
 * pas plus qu'une charge d'API malformée — l'application est gardée partout où on l'a poussée.
 */
import { test, expect, type Navigateur } from "../fixtures/yamba";
import { adresseDeLApi } from "../fixtures/adresses";
import { JeuEssai } from "../fixtures/jeu-essai";
import { lirePressePapiers, observerLePressePapiers } from "../fixtures/presse-papiers";
import { normaliserEspaces } from "../pages/reservation";

type Page = Navigateur["page"];
const api = () => adresseDeLApi();

/** Ce qu'un membre ne doit JAMAIS lire — chemins de fichiers, traces, codes techniques bruts. */
const TRACES_INTERDITES = [
  ".tsx",
  ".ts:",
  "node_modules",
  "at Object.",
  "at async",
  "webpack-internal",
  "NEXT_NOT_FOUND",
  "Internal Server Error",
  "Unhandled Runtime Error",
  "QUOTE_DIVERGENCE",
  "SUDO_REQUIRED",
  "MAINTENANCE",
  "P2002",
  "PrismaClient",
];

/**
 * Le texte du PRODUIT. `innerText` d'un `body` VIVANT ne rend que ce qui est affiché : en
 * développement, la fenêtre d'erreur de Next vit dans un `nextjs-portal` à racine fantôme et n'en
 * fait pas partie. (Piège payé : cloner le `body` pour la retirer donne l'effet inverse — sur un
 * nœud détaché, `innerText` retombe sur `textContent` et rend jusqu'au contenu des `<script>`,
 * charge RSC comprise.)
 */
const texteDuProduit = async (page: Page) => normaliserEspaces(await page.locator("body").innerText());

const pageDErreur = (page: Page) => page.getByRole("alert").filter({ hasText: "Cette page n'a pas pu s'afficher" }).first();

/* ══ Les fiches ══════════════════════════════════════════════════════════════════════════════ */

test.describe("WEB-ERR — pages d'erreur et page introuvable (chapitre 5.29)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(() => {
    new JeuEssai().rejouer();
  });

  test("WEB-ERR-1 · la page introuvable", async ({ navigateurVisiteur }) => {
    const { page } = await navigateurVisiteur();
    const reponse = await page.goto("/fr/cette-page-nexiste-pas", { waitUntil: "domcontentloaded" });
    expect(reponse?.status(), "une adresse inconnue répond 404").toBe(404);
    // `domcontentloaded` rend la main avant le rendu : on attend le titre avant de lire la page.
    await expect(page.getByRole("heading", { name: "Cette page n'existe pas" })).toBeVisible({ timeout: 90_000 });
    const corps = await texteDuProduit(page);
    expect(corps).toContain("Cette page n'existe pas");
    expect(corps).toContain("Le lien est peut-être erroné, ou la page a été retirée. Un trajet supprimé ou un profil masqué donne le même résultat.");
    for (const action of ["Chercher un trajet", "Publier un trajet", "Retour à l'accueil"]) {
      await expect(page.getByRole("link", { name: action })).toBeVisible();
    }
    /* Aucune trace technique, et rien du 404 interne de Next (ANO-WEB-88, chapitre 5.26). */
    expect(corps, "le 404 de Next ne doit pas apparaître").not.toContain("This page could not be found");
    for (const trace of TRACES_INTERDITES) expect(corps, `aucune trace « ${trace} »`).not.toContain(trace);
  });

  test("WEB-ERR-2 · un trajet et un profil inexistants mènent à la même réponse", async ({ navigateurVisiteur }) => {
    const { page } = await navigateurVisiteur();
    /* Un identifiant de trajet valide dans sa forme, mais qui n'existe pas. */
    await page.goto("/fr/trips/000000000000000000000000", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Trajet introuvable")).toBeVisible({ timeout: 90_000 });
    const trajet = await texteDuProduit(page);
    expect(trajet).toContain("Ce trajet n'existe pas ou n'est plus disponible.");
    for (const trace of TRACES_INTERDITES) expect(trajet, `aucune trace « ${trace} »`).not.toContain(trace);

    /* Un profil qui n'existe pas — même traitement, aucun indice sur l'existence réelle. */
    await page.goto("/fr/u/slug-inexistant", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Profil introuvable")).toBeVisible({ timeout: 90_000 });
    const profil = await texteDuProduit(page);
    expect(profil).toContain("Ce profil n'existe pas ou a été supprimé.");
    for (const trace of TRACES_INTERDITES) expect(profil, `aucune trace « ${trace} »`).not.toContain(trace);
  });

  test("WEB-ERR-3 · la page d'erreur générale", async ({ navigateurVisiteur }) => {
    test.setTimeout(5 * 60_000);
    const { page } = await navigateurVisiteur();
    /* Le presse-papiers n'existe pas sur une origine non sécurisée (l'adresse LAN du poste) : le
       harnais en interpose un en mémoire de page, comme aux chapitres 5.17 et 5.23. */
    await observerLePressePapiers(page);

    /* Étape 1 — un incident HORS tunnel de réservation. */
    await page.goto("/fr/dev/erreur", { waitUntil: "domcontentloaded" });
    await expect(pageDErreur(page)).toBeVisible({ timeout: 90_000 });
    const hors = await texteDuProduit(page);
    expect(hors).toContain("Cette page n'a pas pu s'afficher");
    expect(hors).toContain("Un incident technique est survenu de notre côté. Rien de ce que tu as fait n'est perdu : ni ton compte, ni tes envois, ni tes trajets.");
    expect(hors, "la phrase du paiement ne s'affiche PAS hors tunnel").not.toContain("Aucun paiement n'a été effectué");
    await expect(page.getByRole("button", { name: "Réessayer" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Retour à l'accueil" })).toBeVisible();
    for (const trace of TRACES_INTERDITES) expect(hors, `aucune trace « ${trace} »`).not.toContain(trace);

    /* La référence d'incident : huit caractères, copiable, avec son aide et le lien du support.
       Sans `NEXT_PUBLIC_SENTRY_DSN`, elle peut être absente — le cahier l'admet sur ce seul point. */
    const bloc = page.getByText("Référence de l'incident").first();
    const avecReference = (await bloc.count()) > 0;
    let reference = "";
    if (avecReference) {
      reference = (await page.locator("code").first().innerText()).trim();
      expect(reference, "une référence courte, lisible").toMatch(/^[0-9a-zA-Z]{6,12}$/);
      expect(hors).toContain("Communique-la au support si le problème se répète.");
      await expect(page.getByRole("link", { name: "Écrire au support" })).toBeVisible();
      await page.getByRole("button", { name: "Référence de l'incident" }).click();
      await expect(page.getByText("Référence copiée")).toBeVisible({ timeout: 15_000 });
      expect(await lirePressePapiers(page), "la référence est bien ce qui est copié").toBe(reference);
    }

    /* Étape 2 — le même incident DANS le tunnel : la réassurance passe en tête. */
    await page.goto("/fr/bookings/dev-erreur", { waitUntil: "domcontentloaded" });
    await expect(pageDErreur(page)).toBeVisible({ timeout: 90_000 });
    const dedans = await texteDuProduit(page);
    expect(dedans).toContain("Cette page n'a pas pu s'afficher");
    expect(dedans, "la seule question du membre reçoit sa réponse").toContain("Aucun paiement n'a été effectué. Ta carte n'a pas été débitée et aucune demande n'a été envoyée au Voyageur.");
    expect(dedans.indexOf("Aucun paiement n'a été effectué"), "et elle est EN TÊTE, avant les actions").toBeLessThan(dedans.indexOf("Réessayer"));
    for (const trace of TRACES_INTERDITES) expect(dedans, `aucune trace « ${trace} »`).not.toContain(trace);
    test.info().annotations.push({
      type: avecReference ? "note" : "constat",
      description: avecReference
        ? `référence d'incident « ${reference} », copiable, aide et lien support présents`
        : "AUCUNE référence d'incident (ni `error.digest` ni Sentry sur ce poste) : le bloc entier disparaît — avec l'aide ET le lien « Écrire au support », que le cahier attend pourtant parmi les actions",
    });
  });

  test("WEB-ERR-4 · la version publiée pendant la navigation", async ({ navigateurVisiteur }) => {
    const { page } = await navigateurVisiteur();
    /* Un morceau de code introuvable : la signature d'un déploiement pendant la navigation. */
    await page.goto("/fr/dev/erreur?type=chunk", { waitUntil: "domcontentloaded" });
    await expect(pageDErreur(page)).toBeVisible({ timeout: 90_000 });
    const corps = await texteDuProduit(page);
    expect(corps, "le message change").toContain("Une nouvelle version de Yamba vient d'être publiée. Recharge la page pour la récupérer.");
    expect(corps, "et le message d'incident ordinaire s'efface").not.toContain("Un incident technique est survenu de notre côté");
    expect(corps, "la réassurance paiement n'a pas lieu d'être ici").not.toContain("Aucun paiement n'a été effectué");
    await expect(page.getByRole("button", { name: "Recharger la page" }), "le bouton propose de recharger").toBeVisible();
    await expect(page.getByRole("button", { name: "Réessayer" })).toHaveCount(0);
    for (const trace of TRACES_INTERDITES) expect(corps, `aucune trace « ${trace} »`).not.toContain(trace);
  });

  test("WEB-ERR-5 · une erreur ne montre jamais de code", async ({ navigateurVisiteur, navigateurConnecte, jeuEssai }) => {
    test.setTimeout(8 * 60_000);
    const vus: Array<{ situation: string; extrait: string }> = [];
    const verifier = async (page: Page, situation: string) => {
      const corps = await texteDuProduit(page);
      for (const trace of TRACES_INTERDITES) expect(corps, `${situation} : aucune trace « ${trace} »`).not.toContain(trace);
      /* Ni anglais brut : les messages du serveur ne doivent pas traverser tels quels. */
      for (const anglais of ["Not Found", "Bad Request", "Forbidden", "Something went wrong", "Try again later"]) {
        expect(corps, `${situation} : aucun message anglais brut « ${anglais} »`).not.toContain(anglais);
      }
      vus.push({ situation, extrait: corps.slice(0, 120) });
    };

    /* 1. Un trajet inexistant. */
    const visiteur = await navigateurVisiteur();
    await visiteur.page.goto("/fr/trips/000000000000000000000000", { waitUntil: "domcontentloaded" });
    await expect(visiteur.page.getByText("Trajet introuvable")).toBeVisible({ timeout: 90_000 });
    await verifier(visiteur.page, "trajet inexistant");

    /* 2. Un service arrêté : la recherche ne répond plus (coupée au niveau du navigateur). */
    const coupe = await navigateurVisiteur();
    await coupe.contexte.route("**/trips/search*", (route) => route.abort("failed"));
    await coupe.page.goto("/fr/search", { waitUntil: "domcontentloaded" });
    await coupe.page.waitForTimeout(5_000);
    await verifier(coupe.page, "service de recherche muet");

    /* 3. Une session expirée : les cookies partent, le geste suivant échoue. */
    const membre = await navigateurConnecte("aminata");
    await membre.page.goto("/fr/dashboard/home", { waitUntil: "domcontentloaded" });
    await membre.contexte.clearCookies();
    await membre.page.goto("/fr/dashboard/shipments", { waitUntil: "domcontentloaded" });
    await membre.page.waitForTimeout(5_000);
    await verifier(membre.page, "session expirée");

    /* 4. Un formulaire refusé : mot de passe faux à la connexion. */
    const refuse = await navigateurVisiteur();
    await refuse.page.goto("/fr/login", { waitUntil: "domcontentloaded" });
    await refuse.page.locator("#email").fill("aminata.shipper@seed.yamba.dev");
    await refuse.page.locator("#password").fill("mauvais-mot-de-passe-2026");
    const reponse = refuse.page.waitForResponse((r) => r.url().includes("/auth/login") && r.request().method() === "POST", { timeout: 30_000 }).catch(() => null);
    await refuse.page.getByRole("button", { name: "Se connecter" }).click();
    const r = await reponse;
    expect(r?.status(), "le serveur refuse").toBeGreaterThanOrEqual(400);
    await refuse.page.waitForTimeout(2_000);
    await verifier(refuse.page, "formulaire refusé");

    /* 5. Un refus MÉTIER, celui qui porte un code : réserver son propre trajet. */
    const thomas = await navigateurConnecte("thomas");
    const propre = await thomas.contexte.request.post(`${api()}/deals/payment-intents`, {
      data: { tripId: jeuEssai.trajet("bzv-upcoming"), product: "PARCEL", family: "CLOTHES_TEXTILE", sizeClass: "S", weightKg: 2, protection: "BASIC", declaredValueCents: 6000, expectedTotalCents: 1 },
    });
    expect(propre.status(), "l'API refuse le propriétaire du trajet").toBeGreaterThanOrEqual(400);
    await thomas.page.goto(`/fr/trips/${jeuEssai.trajet("bzv-upcoming")}/book`, { waitUntil: "domcontentloaded" });
    await thomas.page.waitForTimeout(6_000);
    await verifier(thomas.page, "réserver son propre trajet");

    test.info().annotations.push({ type: "note", description: vus.map((v) => `${v.situation} → « ${v.extrait} »`).join(" | ") });
  });
});
