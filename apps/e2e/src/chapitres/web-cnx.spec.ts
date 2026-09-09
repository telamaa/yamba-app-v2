/**
 * web-cnx.spec.ts — cahier 01-WEB, chapitre 5.3 « Connexion, session, appareils »
 * ==============================================================================
 * Ce fichier commence par la première anomalie que le harnais ait trouvée, avant même d'avoir
 * joué un seul scénario du cahier : `ANO-WEB-01`.
 */
import { test, expect } from "../fixtures/yamba";
import { COMPTES, MOT_DE_PASSE_SEED } from "../fixtures/comptes";

test.describe("WEB-CNX — connexion et session", () => {
  test("ANO-WEB-01 · un visiteur n'a jamais « de session expirée » sur l'écran de connexion", async ({ navigateurVisiteur }) => {
    const { page } = await navigateurVisiteur();

    // Le geste le plus banal du produit : un inconnu ouvre la page de connexion.
    await page.goto("/fr/login", { waitUntil: "networkidle" });
    await page.waitForTimeout(2_000); // le temps que /auth/me réponde 401 et que le rafraîchissement échoue

    // Avant correction : une fenêtre « Ta session a expiré » s'ouvrait par-dessus l'écran, et
    // son fond opaque interceptait les clics — le formulaire devenait inutilisable.
    await expect(page.locator('[role="dialog"][aria-modal="true"]')).toHaveCount(0);
    await expect(page.getByText("Ta session a expiré")).toHaveCount(0);

    // Et le formulaire est bel et bien utilisable : c'est la vraie vérification.
    const formulaire = page.locator("main form").first();
    await formulaire.locator("#email").fill(COMPTES.aminata.email);
    await formulaire.locator("#password").fill(MOT_DE_PASSE_SEED);
    await formulaire.locator("button[type=submit]").click({ timeout: 10_000 });
    await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
  });

  test("ANO-WEB-01 · le visiteur ne reçoit aucune fenêtre de session sur les pages publiques", async ({ navigateurVisiteur }) => {
    const { page } = await navigateurVisiteur();
    for (const chemin of ["/fr", "/fr/search", "/fr/register"]) {
      await page.goto(chemin, { waitUntil: "networkidle" });
      await page.waitForTimeout(1_500);
      await expect(page.getByText("Ta session a expiré"), `page ${chemin}`).toHaveCount(0);
    }
  });

  test("ANO-WEB-01 · le marqueur de session n'apparaît que pour un membre connecté", async ({ navigateurVisiteur, navigateurConnecte }) => {
    // Le marqueur est la pièce qui distingue « ta session a expiré » de « tu n'as jamais été
    // connecté ». Sa règle tient en deux lignes, et les deux se vérifient.
    const visiteur = await navigateurVisiteur();
    await visiteur.page.goto("/fr", { waitUntil: "networkidle" });
    await visiteur.page.waitForTimeout(1_500);
    expect(await visiteur.page.evaluate(() => localStorage.getItem("yamba:session"))).toBeNull();

    const membre = await navigateurConnecte("aminata");
    await membre.page.goto("/fr/dashboard/home", { waitUntil: "networkidle" });
    await expect.poll(async () => membre.page.evaluate(() => localStorage.getItem("yamba:session")), { timeout: 20_000 }).toBe("1");
  });
});
