/**
 * web-e2e-1.spec.ts — cahier 01-WEB, chapitre 6 : le nominal complet
 * ==================================================================
 * Le parcours de bout en bout le plus important du cahier, **bloquant** : un colis part, il est
 * accepté, remis, transporté, livré contre un code, confirmé, puis les deux parties se notent.
 *
 * Ce fichier en couvre le **premier tiers** — de la demande à l'acceptation — avec les
 * vérifications que le cahier pose à chaque étape : les montants au centime, qui reçoit quel
 * email, ce que chaque rôle voit et ne voit pas. La suite (rendez-vous, prise en charge, code,
 * jalons, remise, confirmation, notation) s'ajoute à ce même fichier, étape par étape.
 *
 * ÉTAT AU 09/09/2026 : les étapes 2 à 9 sont vertes. L'étape 10 (l'acceptation) bute par
 * intermittence sur le **limiteur de débit de la passerelle** — le harnais ouvre une vraie
 * session par navigateur, et `POST /auth/login` finit par répondre 429 après quelques
 * exécutions. Ce n'est pas un défaut du produit : c'est au harnais de mémoriser l'état de
 * session par compte (`storageState`). Voir le handoff du jour, § 4 bis.
 *
 * Deux écarts assumés par rapport à la lettre du cahier, tous deux écrits noir sur blanc :
 *
 * - le cahier fait **publier un trajet** à Joséphine à l'étape 1 ; le harnais réserve sur
 *   `bzv-perkg`, « le trajet de démonstration : c'est lui qu'on réserve dans tous les scénarios
 *   de réservation » (§ 2.4). Publier un trajet est éprouvé par le chapitre 5.7, à sa place ;
 * - le paiement passe par le fournisseur **FAKE** (voir `AssistantReservation.payer`) : le
 *   Payment Element de Stripe ne se monte pas sur l'origine non sécurisée du poste de recette,
 *   et le paiement par carte est déjà éprouvé par la campagne API avec la vraie CLI Stripe.
 */
import { test, expect } from "../fixtures/yamba";
import { AssistantReservation } from "../pages/reservation";
import { DemandeVoyageur } from "../pages/deal-voyageur";
import { COMPTES } from "../fixtures/comptes";

test.describe("WEB-E2E-1 — le nominal complet", () => {
  test("de la demande à l'acceptation", async ({ navigateurConnecte, navigateurVisiteur, jeuEssai, mailpit }) => {
    test.setTimeout(600_000);
    await mailpit.vider();
    const trajet = jeuEssai.trajet("bzv-perkg");

    /* ── Étapes 2 et 3 du cahier — le visiteur voit le trajet, mais la porte se ferme ── */
    const visiteur = await navigateurVisiteur();
    await visiteur.page.goto(`/fr/trips/${trajet}`, { waitUntil: "networkidle" });
    // Le corridor est affiché, mais pas forcément porté par un titre au sens ARIA : on vise le
    // texte, qui est ce que le cahier décrit (« le trajet apparaît »).
    await expect(visiteur.page.getByText(/Paris\s*→\s*Brazzaville/).first()).toBeVisible({ timeout: 60_000 });
    await visiteur.page.goto(`/fr/trips/${trajet}/book`, { waitUntil: "networkidle" });
    await expect(visiteur.page.getByText("Connecte-toi pour réserver")).toBeVisible({ timeout: 30_000 });

    /* ── Étapes 4 à 8 — l'Expéditrice réserve ── */
    const expediteur = await navigateurConnecte("aminata");
    const assistant = new AssistantReservation(expediteur.page);
    const montant = await assistant.reserver(
      trajet,
      { famille: "Vêtements & textile", taille: "S", poidsKg: "2,5", valeurEuros: "150", description: "Deux pulls et un manteau" },
      { prenom: "Clarisse", nom: "Mabiala", indicatif: "+242", telephone: "061234567" }
    );
    expect(montant, "le total du cahier : 28,75 € de transport + 3,45 € de service").toBe("32,20 €");

    await expect.poll(() => expediteur.page.url(), { timeout: 90_000 }).toMatch(/\/bookings\/[0-9a-f]{24}$/);
    const dealId = expediteur.page.url().split("/bookings/")[1];
    await expect(expediteur.page.getByText("En attente du Voyageur")).toBeVisible({ timeout: 30_000 });

    /* ── Étape 9 — Mailpit : chacun reçoit le sien, et rien de plus ── */
    const recuExpediteur = await mailpit.attendreEmail({ pour: COMPTES.aminata.email });
    expect(recuExpediteur.sujet + recuExpediteur.texte + recuExpediteur.html).toContain("32,20");
    const avisVoyageur = await mailpit.attendreEmail({ pour: COMPTES.thomas.email });
    expect(avisVoyageur.texte + avisVoyageur.html, "le Voyageur lit SON gain, jamais ce que l'Expéditeur a payé").toContain("28,75");
    expect(avisVoyageur.texte + avisVoyageur.html).not.toContain("32,20");

    /* ── Étape 10 — le Voyageur accepte, Charte comprise ── */
    const voyageur = await navigateurConnecte("thomas");
    const demande = new DemandeVoyageur(voyageur.page);
    await demande.ouvrir(dealId);
    expect(await demande.gainAnnonce(), "le détail du gain reprend le net du Voyageur").toContain("28,75");

    // La Charte n'est pas une formalité : sans elle, la confirmation est refusée.
    await expect(voyageur.page.getByText("Coche la Charte pour confirmer")).toBeVisible();
    await demande.accepterLaCharte();
    await demande.accepter();

    // Côté Expéditrice, le suivi bascule — et l'email d'acceptation part.
    await expediteur.page.reload({ waitUntil: "networkidle" });
    await expect(expediteur.page.getByText("En attente du Voyageur")).toHaveCount(0, { timeout: 30_000 });
    await mailpit.attendreEmail({ pour: COMPTES.aminata.email, sujet: /accept/i });
  });
});
