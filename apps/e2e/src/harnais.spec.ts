/**
 * harnais.spec.ts — le harnais lui-même est éprouvé avant les parcours
 * ====================================================================
 * Un harnais de recette qui échoue en silence rend toute la campagne inutile. Ces vérifications
 * ne testent pas le produit : elles testent **le montage** — les trois navigateurs, la
 * connexion par l'écran (membre ET back-office), la mémoire des sessions, Mailpit, la carte du
 * jeu d'essai. Elles se lisent en premier quand un parcours part de travers.
 */
import { test, expect } from "./fixtures/yamba";
import { COMPTES, COMPTES_ADMIN } from "./fixtures/comptes";

test.describe("Harnais de recette", () => {
  test("le site public répond et parle français", async ({ navigateurVisiteur }) => {
    const c = await navigateurVisiteur();
    await c.page.goto("/fr", { waitUntil: "domcontentloaded" });
    await expect(c.page).toHaveTitle(/Yamba/i);
    await expect(c.page.locator("html")).toHaveAttribute("lang", "fr");
  });

  test("un Expéditeur et un Voyageur peuvent se connecter, chacun dans son navigateur", async ({ navigateurConnecte }) => {
    // PAR L'ÉCRAN, ici et seulement ici : c'est le scénario qui éprouve la porte d'entrée. Les
    // autres repartent de la session mémorisée — sinon le limiteur de la passerelle finit par
    // répondre 429 (mesuré le 09/09/2026).
    const a = await navigateurConnecte("aminata", { parEcran: true });
    const b = await navigateurConnecte("thomas", { parEcran: true });

    // Deux contextes distincts : la session de l'un n'est PAS celle de l'autre. C'est la
    // propriété sur laquelle repose la moitié des vérifications du cahier (« ce que l'autre
    // rôle ne voit pas »).
    const cookiesA = await a.contexte.cookies();
    const cookiesB = await b.contexte.cookies();
    const jetonA = cookiesA.find((c) => c.name === "access_token")?.value;
    const jetonB = cookiesB.find((c) => c.name === "access_token")?.value;
    expect(jetonA).toBeTruthy();
    expect(jetonB).toBeTruthy();
    expect(jetonA).not.toBe(jetonB);
  });

  test("la session d'un compte est mémorisée : le deuxième navigateur ne repasse pas par l'écran", async ({ navigateurConnecte }) => {
    // Le scénario précédent a mémorisé la session d'Aminata. Celui-ci en ouvre un contexte
    // neuf : aucune requête de connexion ne doit partir, et la session doit être vivante.
    const requetesDeConnexion: string[] = [];
    const a = await navigateurConnecte("aminata");
    a.contexte.on("request", (r) => {
      if (r.url().includes("/auth/login")) requetesDeConnexion.push(r.url());
    });
    await a.page.goto("/fr", { waitUntil: "domcontentloaded" });
    const me = await a.page.waitForResponse((r) => r.url().includes("/auth/me"), { timeout: 30_000 });
    expect(me.status(), "la session mémorisée est vivante").toBe(200);
    expect(requetesDeConnexion).toHaveLength(0);
    expect((await a.contexte.cookies()).some((c) => c.name === "access_token")).toBe(true);
  });

  test("un administrateur ouvre le back-office en deux temps : mot de passe, puis code TOTP calculé", async ({ navigateurAdmin }) => {
    const admin = await navigateurAdmin("mediateur", { parEcran: true });
    expect(admin.compte.email).toBe(COMPTES_ADMIN.mediateur.email);
    await expect(admin.page).toHaveURL(/\/home/);
    const cookies = await admin.contexte.cookies();
    // Sessions SÉPARÉES de celles du membre (D54) : cookies admin_*, jamais access_token.
    expect(cookies.some((c) => c.name === "admin_access_token")).toBe(true);
    expect(cookies.some((c) => c.name === "access_token")).toBe(false);
    // Et le cookie de pré-authentification est consommé.
    expect(cookies.some((c) => c.name === "admin_preauth" && c.value)).toBe(false);
  });

  test("le visiteur n'a aucune session", async ({ navigateurVisiteur }) => {
    const c = await navigateurVisiteur();
    await c.page.goto("/fr", { waitUntil: "domcontentloaded" });
    const cookies = await c.contexte.cookies();
    expect(cookies.some((x) => x.name === "access_token")).toBe(false);
  });

  test("Mailpit se vide, et la carte du jeu d'essai est lisible", async ({ mailpit, jeuEssai }) => {
    await mailpit.vider();
    expect(await mailpit.lister()).toHaveLength(0);

    // Les repères du cahier § 2.4 et § 2.5 doivent tous se résoudre.
    expect(jeuEssai.trajet("bzv-perkg")).toMatch(/^[0-9a-f]{24}$/);
    expect(jeuEssai.membre("thomas")).toMatch(/^[0-9a-f]{24}$/);
    const accepte = jeuEssai.deal("bzv-accepted");
    expect(accepte.statut).toBe("ACCEPTED");
    expect(accepte.expediteur).toBe(COMPTES.pauline.email);
    expect(accepte.voyageur).toBe(COMPTES.thomas.email);
  });
});
