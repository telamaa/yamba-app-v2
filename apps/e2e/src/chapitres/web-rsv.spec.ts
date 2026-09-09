/**
 * web-rsv.spec.ts — cahier 01-WEB, chapitre 5.12 « Réserver : l'assistant en quatre étapes »
 * ==========================================================================================
 * Commence par la porte : ce que voit un visiteur qui clique « Réserver » sans être connecté.
 */
import { test, expect } from "../fixtures/yamba";

test.describe("WEB-RSV — la porte de la réservation", () => {
  test("ANO-WEB-02 · la porte affiche des libellés, pas des clés de traduction", async ({ navigateurVisiteur, jeuEssai }) => {
    const { page } = await navigateurVisiteur();
    const trajet = jeuEssai.trajet("bzv-perkg"); // « le trajet de démonstration » du cahier (§ 2.4)

    await page.goto(`/fr/trips/${trajet}/book`, { waitUntil: "networkidle" });
    await expect(page.getByText("Connecte-toi pour réserver")).toBeVisible({ timeout: 30_000 });

    // Avant correction, les deux boutons d'action de la porte s'intitulaient
    // « booking.authGate.login » et « booking.authGate.register » — les clés de traduction
    // elles-mêmes, faute de messages, dans les DEUX langues.
    await expect(page.getByText(/booking\.authGate\./)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Se connecter", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Créer un compte", exact: true })).toBeVisible();
  });

  test("ANO-WEB-02 · la même porte en anglais", async ({ navigateurVisiteur, jeuEssai }) => {
    const { page } = await navigateurVisiteur();
    const trajet = jeuEssai.trajet("bzv-perkg");

    await page.goto(`/en/trips/${trajet}/book`, { waitUntil: "networkidle" });
    await expect(page.getByText("Sign in to book")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/booking\.authGate\./)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create an account", exact: true })).toBeVisible();
  });

  test("la porte mène bien à la connexion, et ramène à la réservation", async ({ navigateurVisiteur, jeuEssai }) => {
    const { page } = await navigateurVisiteur();
    const trajet = jeuEssai.trajet("bzv-perkg");

    await page.goto(`/fr/trips/${trajet}/book`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Se connecter", exact: true }).click();

    await expect
      .poll(() => page.url(), { timeout: 30_000 })
      .toContain(`/fr/login?redirect=${encodeURIComponent(`/trips/${trajet}/book`)}`);
  });
});
