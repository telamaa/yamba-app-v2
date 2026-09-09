/**
 * web-rsv-assistant.spec.ts — cahier 01-WEB, chapitre 5.12 : l'assistant en quatre étapes
 * =======================================================================================
 * Le cœur du produit : ce que fait un Expéditeur pour envoyer un colis. Le cahier réserve
 * toujours sur le **trajet de démonstration** `bzv-perkg` (§ 2.4) — 11,50 €/kg, Électronique
 * +20 %, Alimentaire refusé — et vérifie les montants au centime.
 */
import { test, expect } from "../fixtures/yamba";
import { AssistantReservation } from "../pages/reservation";

test.describe("WEB-RSV — l'assistant de réservation", () => {
  test("le nominal : 2,5 kg de vêtements, taille S, jusqu'à la demande envoyée", async ({ navigateurConnecte, jeuEssai, mailpit }) => {
    test.setTimeout(240_000);
    await mailpit.vider();

    const { page } = await navigateurConnecte("aminata");
    const assistant = new AssistantReservation(page);
    const trajet = jeuEssai.trajet("bzv-perkg");

    const montant = await assistant.reserver(
      trajet,
      { famille: "Vêtements & textile", taille: "S", poidsKg: "2,5", valeurEuros: "150", description: "Deux pulls et un manteau" },
      { prenom: "Clarisse", nom: "Mabiala", indicatif: "+242", telephone: "061234567" }
    );

    // Le cahier annonce transport 28,75 € + service 3,45 € = 32,20 € pour ce colis sur ce trajet.
    expect(montant).toBe("32,20 €");

    // La demande part : on quitte l'assistant pour le SUIVI de la réservation créée. C'est la
    // seule preuve qui vaille — un texte d'attente resté à l'écran ne prouve rien, il était
    // déjà là avant le clic (première version de ce scénario : elle passait pour rien).
    await expect.poll(() => page.url(), { timeout: 90_000 }).toMatch(/\/bookings\/[0-9a-f]{24}$/);
    await expect(page.getByText("En attente du Voyageur")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/rien n'est débité tant que le Voyageur n'a pas accepté/i)).toBeVisible();

    // Et les deux parties sont prévenues, chacune de ce qui la concerne.
    const recu = await mailpit.attendreEmail({ pour: "aminata.shipper@seed.yamba.dev" });
    expect(recu.sujet + recu.texte + recu.html).toContain("32,20");
    const voyageur = await mailpit.attendreEmail({ pour: "thomas.carrier@seed.yamba.dev" });
    // Le Voyageur voit SON gain (28,75 €), jamais ce que l'Expéditeur a payé.
    expect(voyageur.texte + voyageur.html).toContain("28,75");
  });

  test("le refus de famille est tenu par l'écran : Alimentaire est barré sur ce trajet", async ({ navigateurConnecte, jeuEssai }) => {
    test.setTimeout(120_000);
    const { page } = await navigateurConnecte("aminata");
    const assistant = new AssistantReservation(page);
    await assistant.ouvrir(jeuEssai.trajet("bzv-perkg"));

    // Le Voyageur a REFUSÉ cette famille (§ 2.4) : l'écran le dit, et il le dit avant la saisie.
    await expect(page.getByRole("button", { name: /Alimentaire sec & scellé/ })).toContainText("✕");
    // Et il annonce le supplément de l'Électronique, +20 %, au même endroit.
    await expect(page.getByRole("button", { name: /Électronique & appareils/ })).toContainText("+20 %");
  });
});
