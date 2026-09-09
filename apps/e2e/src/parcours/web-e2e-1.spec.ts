/**
 * web-e2e-1.spec.ts — cahier 01-WEB, chapitre 6 : le nominal complet
 * ==================================================================
 * Le parcours de bout en bout le plus important du cahier, **bloquant** : un colis part, il est
 * accepté, un rendez-vous est pris, il est remis, transporté, livré contre un code, confirmé,
 * puis les deux parties se notent et leurs avis sont révélés. Vingt-neuf étapes, trois
 * navigateurs, et à chaque étape ce que le cahier exige : les montants au centime, qui reçoit
 * quel email (et qui ne le reçoit pas), ce que chaque rôle voit et ne voit pas.
 *
 * Trois écarts assumés par rapport à la lettre du cahier, tous écrits noir sur blanc :
 *
 * - le cahier fait **publier un trajet** à Joséphine à l'étape 1 ; le harnais réserve sur
 *   `bzv-perkg`, « le trajet de démonstration : c'est lui qu'on réserve dans tous les scénarios
 *   de réservation » (§ 2.4), dont le Voyageur est Thomas. Publier un trajet est éprouvé par le
 *   chapitre 5.7, à sa place ;
 * - le paiement passe par le fournisseur **FAKE** (voir `AssistantReservation.payer`) : le
 *   Payment Element de Stripe ne se monte pas sur l'origine non sécurisée du poste de recette,
 *   et le paiement par carte est déjà éprouvé par la campagne API avec la vraie CLI Stripe ;
 * - les photos ne partent pas chez ImageKit (voir `fixtures/photos.ts`) : la chaîne est
 *   traversée jusqu'au fournisseur, qui est interposé pour ne pas remplir la médiathèque de
 *   production à chaque exécution.
 *
 * Le jeu d'essai est rejoué avant le parcours : chaque exécution réserve 2,5 kg sur le trajet
 * de démonstration, et le cahier attend « kilos restants 20,5 » à l'étape 10.
 */
import { test, expect } from "../fixtures/yamba";
import { AssistantReservation } from "../pages/reservation";
import { DemandeVoyageur } from "../pages/deal-voyageur";
import { dateLocale, FilMessagerie } from "../pages/fil-messagerie";
import { SuiviExpediteur } from "../pages/suivi-expediteur";
import { SuiviDestinataire } from "../pages/suivi-destinataire";
import { TransportVoyageur } from "../pages/transport-voyageur";
import { Notation } from "../pages/notation";
import { COMPTES } from "../fixtures/comptes";
import { JeuEssai } from "../fixtures/jeu-essai";
import { observerLePressePapiers } from "../fixtures/presse-papiers";

const DESTINATAIRE = { prenom: "Clarisse", nom: "Mabiala", indicatif: "+242", telephone: "061234567" };

/** Un jour dans `n` jours, à `heure` h, au format de l'`input datetime-local`. */
function dansNJours(n: number, heure: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(heure, 0, 0, 0);
  return dateLocale(d);
}

/** La date « J+4 » telle que l'écran du Voyageur l'écrit (`samedi 13 septembre`). */
function dateLongue(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(d);
}

test.describe("WEB-E2E-1 — le nominal complet", () => {
  test.beforeAll(() => {
    new JeuEssai().rejouer();
  });

  test("de la demande à la révélation des avis", async ({ navigateurConnecte, navigateurVisiteur, jeuEssai, mailpit }) => {
    test.setTimeout(20 * 60_000);
    await mailpit.vider();
    const trajet = jeuEssai.trajet("bzv-perkg");
    const voyageurPrenom = COMPTES.thomas.prenom;
    const expediteurPrenom = COMPTES.aminata.prenom;

    /* ── Étapes 2 et 3 du cahier — le visiteur voit le trajet, mais la porte se ferme ── */
    const visiteur = await navigateurVisiteur();
    await visiteur.page.goto(`/fr/trips/${trajet}`, { waitUntil: "networkidle" });
    await expect(visiteur.page.getByText(/Paris\s*→\s*Brazzaville/).first()).toBeVisible({ timeout: 60_000 });
    await visiteur.page.goto(`/fr/trips/${trajet}/book`, { waitUntil: "networkidle" });
    await expect(visiteur.page.getByText("Connecte-toi pour réserver")).toBeVisible({ timeout: 30_000 });

    /* ── Étapes 4 à 8 — l'Expéditrice réserve ── */
    const expediteur = await navigateurConnecte("aminata");
    // Les messages « Copier … » ne vivent que dans le presse-papiers : le harnais l'observe.
    await observerLePressePapiers(expediteur.page);
    const assistant = new AssistantReservation(expediteur.page);
    const montant = await assistant.reserver(
      trajet,
      { famille: "Vêtements & textile", taille: "S", poidsKg: "2,5", valeurEuros: "150", description: "Deux pulls et un manteau" },
      DESTINATAIRE
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
    await expect(voyageur.page.getByText("Coche la Charte pour confirmer")).toBeVisible();
    await demande.accepterLaCharte();
    await demande.accepter();

    await expediteur.page.reload({ waitUntil: "networkidle" });
    await expect(expediteur.page.getByText("En attente du Voyageur")).toHaveCount(0, { timeout: 30_000 });
    const acceptation = await mailpit.attendreEmail({ pour: COMPTES.aminata.email, sujet: /accept/i });
    expect(acceptation.texte + acceptation.html).toContain("a accepté ta demande");

    /* ── Étape 11 — le Voyageur propose un rendez-vous de remise, dans 3 jours ── */
    const filVoyageur = new FilMessagerie(voyageur.page);
    const conversationId = await filVoyageur.ouvrirDepuisDealVoyageur(dealId);
    await filVoyageur.proposerRendezVous({
      lieu: "Paris-Charles-de-Gaulle, hall des départs",
      debut: dansNJours(3, 10),
      fin: dansNJours(3, 11),
      precisions: "Devant les bornes libre-service, côté départ.",
    });

    /* ── Étape 12 — l'Expéditrice accepte : « Confirmé » ── */
    const filExpediteur = new FilMessagerie(expediteur.page);
    await filExpediteur.ouvrir(conversationId);
    await filExpediteur.accepterRendezVous();

    /* ── Étape 13 — le numéro ne s'affiche pas encore : plus de 2 h avant le rendez-vous ── */
    await filExpediteur.ouvrir(conversationId, true);
    const bandeau = await filExpediteur.demanderLeNumeroTropTot();
    expect(bandeau).toMatch(/Le numéro s'affiche à partir du /);
    expect(await expediteur.page.locator("body").innerText(), "aucun numéro dans la page").not.toMatch(/\+33\s?6/);

    /* ── Étape 14 — le lien de suivi pour Clarisse ── */
    const suivi = new SuiviExpediteur(expediteur.page);
    await suivi.ouvrir(dealId);
    const lien = await suivi.creerLeLienDeSuivi(DESTINATAIRE.prenom);
    expect(lien.url).toMatch(/\/track\/[A-Za-z0-9_-]{20,}$/);
    expect(lien.message, "le message copié porte le lien").toContain(lien.url);

    /* ── Étape 15 — le destinataire ouvre le lien : ni code, ni numéro, ni montant ── */
    const destinataire = new SuiviDestinataire(visiteur.page);
    await destinataire.ouvrir(lien.url, DESTINATAIRE.prenom);
    expect(await destinataire.jalonCourant()).toBe("Colis pris en charge");
    expect(await destinataire.jalonAtteint(new RegExp(`Colis récupéré par ${voyageurPrenom}`)), "la prise en charge n'a pas encore eu lieu").toBe(false);
    await destinataire.neReveleRien();

    /* ── Étape 16 — la prise en charge : 5 points, 2 photos, une note ── */
    const transport = new TransportVoyageur(voyageur.page);
    const toast = await transport.prendreEnCharge(dealId, { nbPhotos: 2, note: "Colis fermé, emballage intact." });
    expect(toast).toContain(`${expediteurPrenom} a reçu son code de livraison`);
    await transport.numeroDuDestinataireVisible(DESTINATAIRE.indicatif);

    /* ── Étape 17 — côté Expéditrice, le code apparaît ; l'email n'en dit rien ── */
    await suivi.ouvrir(dealId);
    const code = await suivi.lireLeCode();
    expect(code).toMatch(/^\d{6}$/);
    const priseEnCharge = await mailpit.attendreEmail({ pour: COMPTES.aminata.email, sujet: /pris en charge/i });
    expect(priseEnCharge.texte + priseEnCharge.html).toContain("code");
    expect(priseEnCharge.texte + priseEnCharge.html, "le code ne voyage JAMAIS par email").not.toContain(code);
    expect(priseEnCharge.texte + priseEnCharge.html).not.toContain(`${code.slice(0, 3)} ${code.slice(3)}`);

    /* ── Étape 18 — le message de partage du code ── */
    const messageCode = await suivi.copierLeMessageDuCode(DESTINATAIRE.prenom);
    expect(messageCode).toContain(code);
    expect(messageCode).toContain(DESTINATAIRE.prenom);

    /* ── Étape 19 — les trois jalons, cinq secondes de repentir chacun ── */
    await transport.ouvrirSuivi(dealId);
    await transport.confirmerJalon("Je suis à l'aéroport");
    await transport.confirmerJalon("L'avion décolle");
    await transport.confirmerJalon("J'ai atterri");
    await destinataire.ouvrir(lien.url, DESTINATAIRE.prenom);
    expect(await destinataire.jalonCourant()).toMatch(/^Arrivé à Brazzaville/);
    expect(await destinataire.jalonAtteint(new RegExp(`Colis récupéré par ${voyageurPrenom}`))).toBe(true);
    await destinataire.neReveleRien();

    /* ── Étape 20 — UN seul email de jalon : l'atterrissage ── */
    await mailpit.attendreEmail({ pour: COMPTES.aminata.email, sujet: /a atterri/ });
    expect(await mailpit.compter({ pour: COMPTES.aminata.email, sujet: /a atterri/ })).toBe(1);
    const sujetsExpediteur = (await mailpit.emailsPour(COMPTES.aminata.email)).map((e) => e.sujet);
    expect(sujetsExpediteur.filter((s) => /aéroport|décoll/i.test(s)), "ni l'aéroport ni le décollage n'écrivent").toHaveLength(0);

    /* ── Étape 21 — la remise contre le code, avec une photo ── */
    const remise = await transport.remettreContreLeCode(dealId, code, { photo: true });
    const jPlus4 = new Date();
    jPlus4.setDate(jPlus4.getDate() + 4);
    expect(remise.versement, "le versement est annoncé à J+4").toContain(dateLongue(jPlus4));

    /* ── Étape 22 — période de vérification côté Expéditrice, et l'email des 3 jours ── */
    await suivi.ouvrir(dealId);
    await suivi.attendrePeriodeDeVerification();
    const livre = await mailpit.attendreEmail({ pour: COMPTES.aminata.email, sujet: /livré/i });
    expect(livre.texte + livre.html).toContain("3 jours");

    /* ── Étape 23 — le destinataire voit « Colis remis » ── */
    await destinataire.ouvrir(lien.url, DESTINATAIRE.prenom);
    expect(await destinataire.jalonCourant()).toBe("Colis remis");
    await destinataire.neReveleRien();

    /* ── Étape 24 — la confirmation anticipée ── */
    await suivi.confirmerLaLivraison();

    /* ── Étape 25 — Mailpit : « Transaction terminée » / « en route vers ton compte » ── */
    await mailpit.attendreEmail({ pour: COMPTES.aminata.email, sujet: /Transaction terminée/ });
    const versement = await mailpit.attendreEmail({ pour: COMPTES.thomas.email, sujet: /en route vers ton compte/ });
    expect(versement.sujet).toContain("28,75");

    /* ── Étape 26 — l'Expéditrice note, et l'avis n'est pas encore public ── */
    const commentaireExpediteur = `Ponctuel et soigneux, colis arrivé intact (${dealId.slice(-6)}).`;
    const notationExpediteur = new Notation(expediteur.page);
    await suivi.ouvrir(dealId);
    await notationExpediteur.ouvrirDepuisLeDeal(voyageurPrenom);
    const premier = await notationExpediteur.publier({ etoiles: "Excellent", bien: ["Ponctualité au rendez-vous", "Communication", "Soin du colis"], commentaire: commentaireExpediteur });
    expect(premier.revele, "le premier avis reste secret").toBe(false);
    await visiteur.page.goto(`/fr/u/seed-thomas`, { waitUntil: "networkidle" });
    await expect(visiteur.page.getByText(/En tant que Voyageur/)).toBeVisible({ timeout: 60_000 });
    await expect(visiteur.page.getByText(commentaireExpediteur)).toHaveCount(0);

    /* ── Étape 27 — le Voyageur note à son tour : les deux avis sont révélés ── */
    const notationVoyageur = new Notation(voyageur.page);
    await transport.ouvrirSuivi(dealId);
    await notationVoyageur.ouvrirDepuisLeDeal(expediteurPrenom);
    const second = await notationVoyageur.publier({ etoiles: "Excellent", bien: ["Clarté de la déclaration"], commentaire: "Colis conforme, remise facile." });
    expect(second.texte).toContain(`${expediteurPrenom} t'avait déjà noté : vos deux avis sont maintenant visibles.`);

    /* ── Étape 28 — chacun voit « Vos avis », et la notification de révélation ── */
    await suivi.ouvrir(dealId);
    await expect(expediteur.page.getByText("Vos avis", { exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(expediteur.page.getByText("Colis conforme, remise facile.")).toBeVisible();
    await transport.ouvrirSuivi(dealId);
    await expect(voyageur.page.getByText("Vos avis", { exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(voyageur.page.getByText(commentaireExpediteur)).toBeVisible();
    for (const nav of [expediteur, voyageur]) {
      await nav.page.goto("/fr/dashboard/notifications", { waitUntil: "networkidle" });
      await expect(nav.page.getByText("Les notes sont révélées").first()).toBeVisible({ timeout: 60_000 });
    }

    /* ── Étape 29 — la page publique de Thomas porte l'avis, signé du prénom ── */
    await visiteur.page.goto(`/fr/u/seed-thomas`, { waitUntil: "networkidle" });
    await expect(visiteur.page.getByText(commentaireExpediteur)).toBeVisible({ timeout: 60_000 });
    const carte = visiteur.page.locator("article, li, div").filter({ hasText: commentaireExpediteur }).last();
    await expect(carte.getByText(`${expediteurPrenom} D.`)).toBeVisible();
    await expect(carte.getByText("Ponctualité", { exact: true })).toBeVisible();
    await expect(visiteur.page.getByText(/Deals? terminés? · ★/)).toBeVisible();
  });
});
