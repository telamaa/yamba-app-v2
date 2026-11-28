/**
 * web-rsv.spec.ts — cahier 01-WEB, chapitre 5.12 « Réserver : l'assistant en quatre étapes »
 * ==========================================================================================
 * Commence par la porte : ce que voit un visiteur qui clique « Réserver » sans être connecté.
 *
 * ── REMISE À NIVEAU DU 28/11/2026 ────────────────────────────────────────────────────────────
 * Ces trois scénarios décrivaient un produit disparu depuis SIX SEMAINES, et rien ne l'avait dit —
 * le harnais n'est pas un contrôle de CI. Deux décisions les ont périmés, et toutes deux sont
 * ASSUMÉES : on met la fiche à jour, on ne « répare » pas le produit pour la faire passer.
 *
 *   • **#389 (17/10)** — `/trips/:id/book` sans session n'affiche plus une PAGE de connexion :
 *     il renvoie à la fiche du trajet avec `?auth=book` (`BookingClient.tsx:57`) et c'est
 *     `TripDetailView` qui ouvre LA MÊME modale que le bouton « Réserver » (A58/A63). Le
 *     scénario qui attendait une navigation vers `/fr/login?redirect=…` attendait donc une
 *     page qui n'existe plus.
 *   • **D96 (11/11)** — la connexion est passée à DEUX marches, et la porte les porte EN LIGNE :
 *     un champ e-mail et « Continuer », puis « Continuer avec e-mail et mot de passe » qui
 *     révèle le mot de passe et « Se connecter ». Les deux boutons d'origine — « Se connecter »
 *     et « Créer un compte » — n'existent plus ; l'inscription est un LIEN.
 *
 * Ce que les scénarios PROUVENT, lui, n'a pas changé, et c'est ce qu'on préserve : ANO-WEB-02
 * (la porte affiche des libellés, jamais les clés `booking.authGate.*`) et le fait que la porte
 * ramène au tunnel de réservation une fois la connexion faite.
 */
import { test, expect } from "../fixtures/yamba";
import { MOT_DE_PASSE_SEED } from "../fixtures/comptes";

test.describe("WEB-RSV — la porte de la réservation", () => {
  test("ANO-WEB-02 · la porte affiche des libellés, pas des clés de traduction", async ({
    navigateurVisiteur,
    jeuEssai,
  }) => {
    const { page } = await navigateurVisiteur();
    const trajet = jeuEssai.trajet("bzv-perkg"); // « le trajet de démonstration » du cahier (§ 2.4)

    await page.goto(`/fr/trips/${trajet}/book`, { waitUntil: "networkidle" });
    // #389 — on ne reste pas sur `/book` : on est renvoyé à la fiche, modale ouverte.
    await expect.poll(() => page.url(), { timeout: 30_000 }).toContain(`/fr/trips/${trajet}?auth=book`);

    const porte = page.getByRole("dialog").first();
    await expect(porte.getByText("Connecte-toi pour réserver")).toBeVisible({ timeout: 30_000 });

    // Avant correction, les deux boutons d'action de la porte s'intitulaient
    // « booking.authGate.login » et « booking.authGate.register » — les clés de traduction
    // elles-mêmes, faute de messages, dans les DEUX langues. C'est CELA que le scénario garde.
    await expect(page.getByText(/booking\.authGate\./)).toHaveCount(0);

    // D96 — les deux marches, en ligne, et l'inscription en lien.
    await expect(porte.getByRole("button", { name: "Continuer", exact: true })).toBeVisible();
    await expect(
      porte.getByRole("button", { name: "Continuer avec e-mail et mot de passe" })
    ).toBeVisible();
    await expect(porte.getByRole("link", { name: "Inscris-toi" })).toBeVisible();
  });

  test("ANO-WEB-02 · la même porte en anglais", async ({ navigateurVisiteur, jeuEssai }) => {
    const { page } = await navigateurVisiteur();
    const trajet = jeuEssai.trajet("bzv-perkg");

    await page.goto(`/en/trips/${trajet}/book`, { waitUntil: "networkidle" });
    await expect.poll(() => page.url(), { timeout: 30_000 }).toContain(`/en/trips/${trajet}?auth=book`);

    const porte = page.getByRole("dialog").first();
    await expect(porte.getByText("Sign in to book")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/booking\.authGate\./)).toHaveCount(0);
    await expect(porte.getByRole("button", { name: "Continue", exact: true })).toBeVisible();
    await expect(porte.getByRole("button", { name: "Continue with email and password" })).toBeVisible();
  });

  test("la porte ramène bien à la réservation une fois connecté", async ({
    navigateurVisiteur,
    jeuEssai,
  }) => {
    const { page } = await navigateurVisiteur();
    const trajet = jeuEssai.trajet("bzv-perkg");

    await page.goto(`/fr/trips/${trajet}/book`, { waitUntil: "networkidle" });
    const porte = page.getByRole("dialog").first();
    await expect(porte.getByText("Connecte-toi pour réserver")).toBeVisible({ timeout: 30_000 });

    // Le chemin « mot de passe » évite la marche de confirmation par adresse : c'est la voie
    // courte de D96, et la seule qui se joue entièrement DANS la porte.
    await porte.getByRole("button", { name: "Continuer avec e-mail et mot de passe" }).click();
    await porte.locator("#email").fill("aminata.shipper@seed.yamba.dev");
    await porte.locator("#password").fill(MOT_DE_PASSE_SEED);
    await porte.getByRole("button", { name: "Se connecter", exact: true }).click();

    // `BookingAuthGateModal` passe `redirect={bookingRedirectFor(tripId)}` : une fois la
    // session ouverte, on arrive sur le tunnel — la porte a tenu sa promesse.
    await expect.poll(() => page.url(), { timeout: 60_000 }).toContain(`/trips/${trajet}/book`);
  });
});
