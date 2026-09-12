/**
 * web-e2e-6.spec.ts — cahier 01-WEB, chapitre 6 : le parcours du destinataire, de bout en bout
 * ===========================================================================================
 * Le sixième et dernier parcours du chapitre (gravité majeure). Le cahier le joue « en parallèle
 * de WEB-E2E-1, dans le navigateur C » : ici, il rejoue le tronc de E2E-1 qui fait avancer le
 * colis (réservation, acceptation, lien de suivi, prise en charge, jalons, remise) et, à chaque
 * pas, recharge la page du destinataire — une personne SANS compte, qui n'a qu'un lien.
 *
 * Ce que la page doit dire : le prénom, le corridor, les dates, la frise, une aide qui change à
 * chaque étape. Ce qu'elle ne doit JAMAIS dire : une adresse, un numéro, un code, une photo, un
 * montant — ni à l'écran, ni dans le code source, ni dans la réponse de l'API (liste de clés
 * fermée). Et Yamba n'écrit jamais au destinataire : le lien est partagé par l'Expéditeur seul.
 *
 * Trois navigateurs : A Aminata, B Thomas, C le destinataire (visiteur), plus Mailpit.
 *
 * Écarts assumés :
 * - étape 3 : « Je suis à l'aéroport » n'est pas un jalon public (D69 : IN_TRANSIT naît au
 *   décollage, ARRIVED à l'atterrissage) — la page ne bouge pas à l'aéroport, et c'est vérifié ;
 * - étape 9 : « aucun SMS » — la plateforme n'a aucun émetteur de SMS (aucune dépendance, aucun
 *   appel) ; le harnais prouve l'absence d'email au destinataire, dont l'adresse a été déclarée
 *   exprès à la réservation, et que chaque email de la campagne va à l'Expéditrice ou au Voyageur.
 */
import { test, expect } from "../fixtures/yamba";
import { COMPTES } from "../fixtures/comptes";
import { JeuEssai } from "../fixtures/jeu-essai";
import { observerLePressePapiers } from "../fixtures/presse-papiers";
import { AssistantReservation } from "../pages/reservation";
import { DemandeVoyageur } from "../pages/deal-voyageur";
import { SuiviExpediteur } from "../pages/suivi-expediteur";
import { SuiviDestinataire, CLES_PUBLIQUES_DU_SUIVI } from "../pages/suivi-destinataire";
import { TransportVoyageur } from "../pages/transport-voyageur";

const DESTINATAIRE = { prenom: "Clarisse", nom: "Mabiala", indicatif: "+242", telephone: "061234567", email: "clarisse.destinataire@seed.yamba.dev" };

test.describe("WEB-E2E-6 — le parcours du destinataire", () => {
  test.beforeAll(() => {
    new JeuEssai().rejouer();
  });

  test("du lien reçu à la remise, sans jamais rien apprendre de plus", async ({ navigateurConnecte, navigateurVisiteur, jeuEssai, mailpit }) => {
    test.setTimeout(15 * 60_000);
    await mailpit.vider();
    const trajet = jeuEssai.trajet("bzv-perkg");
    const voyageurPrenom = COMPTES.thomas.prenom;
    const expediteurPrenom = COMPTES.aminata.prenom;

    /* ── Le tronc de WEB-E2E-1 : réservation, acceptation, lien de suivi ── */
    const expediteur = await navigateurConnecte("aminata");
    await observerLePressePapiers(expediteur.page);
    const assistant = new AssistantReservation(expediteur.page);
    const montant = await assistant.reserver(
      trajet,
      { famille: "Vêtements & textile", taille: "S", poidsKg: "2,5", valeurEuros: "150", description: "Deux pulls et un manteau" },
      DESTINATAIRE
    );
    await expect.poll(() => expediteur.page.url(), { timeout: 90_000 }).toMatch(/\/bookings\/[0-9a-f]{24}$/);
    const dealId = expediteur.page.url().split("/bookings/")[1];

    const voyageur = await navigateurConnecte("thomas");
    const demande = new DemandeVoyageur(voyageur.page);
    await demande.ouvrir(dealId);
    await demande.accepterLaCharte();
    await demande.accepter();

    const suivi = new SuiviExpediteur(expediteur.page);
    await suivi.ouvrir(dealId);
    const lien = await suivi.creerLeLienDeSuivi(DESTINATAIRE.prenom);
    const token = lien.url.split("/track/")[1];
    const secrets = { telephone: DESTINATAIRE.telephone, montant: montant.replace(/\s/g, ""), motsDAdresse: ["Terminal départ", "Hall d'arrivée"] };

    /* ── Étape 1 — C ouvre le lien : prénom, corridor, dates, frise ── */
    const c = await navigateurVisiteur();
    const destinataire = new SuiviDestinataire(c.page);
    await destinataire.ouvrir(lien.url, DESTINATAIRE.prenom);
    await expect(c.page.getByText(`${expediteurPrenom} t'envoie un colis avec ${voyageurPrenom} N., Voyageur Yamba, de Paris à Brazzaville.`)).toBeVisible();
    await expect(c.page.getByText("Départ", { exact: true })).toBeVisible();
    await expect(c.page.getByText("Arrivée prévue", { exact: true })).toBeVisible();
    await expect(c.page.locator("ol > li")).toHaveCount(5);
    expect(await destinataire.jalonCourant()).toBe("Colis pris en charge");
    expect(await destinataire.aideCourante()).toBe(`${voyageurPrenom} récupère le colis chez ${expediteurPrenom} avant le départ.`);
    expect(await destinataire.jalonsAtteints()).toEqual(["Colis pris en charge"]);

    /* ── Étape 2 — ni adresse, ni numéro, ni code, ni photo, ni montant : écran, source, API ── */
    await destinataire.neReveleRien(secrets);
    expect(await SuiviDestinataire.clesServiesParLApi(c.contexte, token), "l'API sert une liste FERMÉE de clés (D69)").toEqual([...CLES_PUBLIQUES_DU_SUIVI]);

    /* ── Étape 3 — la frise progresse à chaque jalon confirmé par le Voyageur ── */
    const transport = new TransportVoyageur(voyageur.page);
    await transport.prendreEnCharge(dealId, { nbPhotos: 1, note: "Colis fermé, emballage intact." });
    await suivi.ouvrir(dealId);
    const code = await suivi.lireLeCode();

    await destinataire.ouvrir(lien.url, DESTINATAIRE.prenom);
    expect(await destinataire.jalonCourant()).toBe(`Colis récupéré par ${voyageurPrenom}`);
    expect(await destinataire.aideCourante()).toBe(`Le colis voyage avec ${voyageurPrenom}.`);
    expect(await destinataire.jalonsAtteints()).toEqual(["Colis pris en charge", `Colis récupéré par ${voyageurPrenom}`]);
    await destinataire.neReveleRien({ ...secrets, code });

    await transport.ouvrirSuivi(dealId);
    await transport.confirmerJalon("Je suis à l'aéroport");
    await destinataire.ouvrir(lien.url, DESTINATAIRE.prenom);
    expect(await destinataire.jalonCourant(), "l'aéroport n'est pas un jalon public : la page ne bouge pas").toBe(`Colis récupéré par ${voyageurPrenom}`);

    await transport.confirmerJalon("L'avion décolle");
    await destinataire.ouvrir(lien.url, DESTINATAIRE.prenom);
    expect(await destinataire.jalonCourant()).toBe("En route");
    expect(await destinataire.aideCourante()).toBe(`${voyageurPrenom} est en route vers Brazzaville.`);
    expect(await destinataire.jalonAtteint("En route")).toBe(true);
    await destinataire.neReveleRien({ ...secrets, code });

    /* ── Étape 4 — l'atterrissage : « prépare le code que … t'a donné » ── */
    await transport.confirmerJalon("J'ai atterri");
    await destinataire.ouvrir(lien.url, DESTINATAIRE.prenom);
    expect(await destinataire.jalonCourant()).toBe("Arrivé à Brazzaville");
    expect(await destinataire.aideCourante()).toBe(`${voyageurPrenom} est arrivé. Il te contacte pour convenir de la remise : prépare le code que ${expediteurPrenom} t'a donné.`);
    await destinataire.neReveleRien({ ...secrets, code });

    /* ── Étape 5 — la remise : « Le colis t'a été remis. Bonne réception ! » ── */
    await transport.ouvrirSuivi(dealId);
    await transport.remettreContreLeCode(dealId, code, { photo: true });
    await destinataire.ouvrir(lien.url, DESTINATAIRE.prenom);
    expect(await destinataire.jalonCourant()).toBe("Colis remis");
    expect(await destinataire.aideCourante()).toBe("Le colis t'a été remis. Bonne réception !");
    expect(await destinataire.jalonsAtteints()).toHaveLength(5);
    await destinataire.neReveleRien({ ...secrets, code });

    /* ── Étape 6 — la mention de confidentialité, et son lien ── */
    const mention = await destinataire.mentionDeConfidentialite();
    expect(mention).toContain(`${expediteurPrenom} a confié ton prénom et ton numéro à Yamba pour cette livraison, et à personne d'autre. Ils sont effacés après la remise.`);
    await destinataire.ouvrirLaPolitiqueDeConfidentialite();

    /* ── Étape 7 — le bloc d'acquisition mène aux bons écrans ── */
    await destinataire.ouvrir(lien.url, DESTINATAIRE.prenom);
    await destinataire.suivreLeLienDAcquisition("Envoyer un colis", /\/fr\/search(\?|$)/);
    await destinataire.ouvrir(lien.url, DESTINATAIRE.prenom);
    // ANO-WEB-11 : « Devenir Voyageur » menait à un bouchon « Become a carrier (UI only) ». L'écran
    // attendu est l'assistant d'onboarding (WEB-VOY-1) ; sans compte, la porte de connexion d'abord.
    await destinataire.suivreLeLienDAcquisition("Devenir Voyageur", /\/fr\/login\?redirect=(%2F|\/)carrier(%2F|\/)onboarding$/);

    /* ── Étape 8 — un caractère du jeton altéré : plus valide, sans rien révéler ── */
    const dernier = token.slice(-1);
    const altere = token.slice(0, -1) + (dernier === "a" ? "b" : "a");
    const texteInvalide = await destinataire.lienInvalide(lien.url.replace(token, altere));
    expect(texteInvalide).toContain("Le colis a été remis il y a un moment, ou le lien a été retiré.");
    expect(texteInvalide).not.toContain(DESTINATAIRE.prenom);
    expect(texteInvalide).not.toContain("Brazzaville");
    const refusAltere = await SuiviDestinataire.refusDeLApi(c.contexte, altere);
    const refusInvente = await SuiviDestinataire.refusDeLApi(c.contexte, "x".repeat(token.length));
    expect(refusAltere.statut).toBe(404);
    expect(refusAltere.corps, "404 uniforme : un jeton altéré et un jeton inventé reçoivent la même réponse").toBe(refusInvente.corps);

    /* ── Étape 9 — Yamba n'a rien écrit au destinataire ── */
    await mailpit.aucunEmailPour(DESTINATAIRE.email, 3_000);
    // Les crons peuvent écrire à d'autres membres du seed pendant le parcours : on affirme que
    // TOUT email part vers un compte membre — jamais vers un tiers, jamais vers le destinataire.
    const membres = new Set(Object.values(COMPTES).map((c) => c.email));
    const horsMembres = (await mailpit.lister()).map((e) => e.destinataire.toLowerCase()).filter((d) => !membres.has(d));
    expect(horsMembres, "aucun email vers un tiers").toEqual([]);
  });
});
