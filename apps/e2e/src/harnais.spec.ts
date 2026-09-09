/**
 * harnais.spec.ts — le harnais lui-même est éprouvé avant les parcours
 * ====================================================================
 * Un harnais de recette qui échoue en silence rend toute la campagne inutile. Ces quatre
 * vérifications ne testent pas le produit : elles testent **le montage** — les trois
 * navigateurs, la connexion, Mailpit, la carte du jeu d'essai. Elles se lisent en premier
 * quand un parcours part de travers.
 */
import { test, expect } from "./fixtures/yamba";
import { COMPTES } from "./fixtures/comptes";

test.describe("Harnais de recette", () => {
  test("le site public répond et parle français", async ({ navigateurVisiteur }) => {
    const c = await navigateurVisiteur();
    await c.page.goto("/fr", { waitUntil: "domcontentloaded" });
    await expect(c.page).toHaveTitle(/Yamba/i);
    await expect(c.page.locator("html")).toHaveAttribute("lang", "fr");
  });

  test("un Expéditeur et un Voyageur peuvent se connecter, chacun dans son navigateur", async ({ navigateurConnecte }) => {
    const a = await navigateurConnecte("aminata");
    const b = await navigateurConnecte("thomas");

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
