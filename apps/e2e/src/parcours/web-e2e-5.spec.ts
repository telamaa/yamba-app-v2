/**
 * web-e2e-5.spec.ts — cahier 01-WEB, chapitre 6 : le refus au pickup et le remboursement
 * =====================================================================================
 * Le cinquième parcours (gravité majeure) : un deal accepté et capturé, puis le Voyageur ouvre le
 * colis au rendez-vous et le refuse — « Le contenu ne correspond pas à la déclaration ». Tout
 * doit revenir à l'Expéditrice, sans retenue (A40, D39), les kilos au trajet, et RIEN ne doit
 * s'ajouter à la ligne de faits du Voyageur : un refus de conformité n'est pas une annulation
 * fautive (machine `refusePickup` : effets « sans pénalité »).
 *
 * Trois navigateurs : A Aminata, B Joséphine, Mailpit. Le trajet est `fih` (Bruxelles →
 * Kinshasa, tarif par catégorie, 23 kg, J+7) — le seul de Joséphine dans le jeu d'essai.
 *
 * Deux écarts assumés :
 * - étape 6 : le cahier dit « refus à la remise » ; le sujet réel est « Ton colis Bruxelles →
 *   Kinshasa n'a pas pu être pris en charge » (la raison traduite est dans le corps) ;
 * - étape 8 : « Mes trajets » n'affiche pas les kilos restants (écart déjà consigné en WEB-E2E-3) ;
 *   ils sont lus à l'API du trajet, avant, après l'acceptation, après le refus.
 *
 * Ce que ce parcours a trouvé (ANO-WEB-10) : la ligne de faits comptait comme « annulation
 * tardive » TOUT deal CANCELLED clos par le Voyageur après acceptation — donc chaque refus au
 * pickup, dès le prochain recalcul de réputation. La relecture AVANT / APRÈS de l'étape 7 est
 * réelle : le refus déclenche désormais le recalcul, et la requête exclut la marque du refus.
 */
import { test, expect } from "../fixtures/yamba";
import { COMPTES } from "../fixtures/comptes";
import { JeuEssai } from "../fixtures/jeu-essai";
import { AssistantReservation, normaliserEspaces } from "../pages/reservation";
import { DemandeVoyageur } from "../pages/deal-voyageur";
import { TransportVoyageur } from "../pages/transport-voyageur";
import { MesEnvois, enCentimes, enEuros } from "../pages/mes-envois";
import { Finances } from "../pages/finances";
import { MesTrajets, kilosRestants } from "../pages/mes-trajets";
import { ProfilPublic } from "../pages/profil-public";

const DESTINATAIRE = { prenom: "Dieudonné", nom: "Kabongo", indicatif: "+243", telephone: "812345678" };
const RAISON = "Le contenu ne correspond pas à la déclaration";

test.describe("WEB-E2E-5 — le refus au pickup et le remboursement", () => {
  test.beforeAll(() => {
    new JeuEssai().rejouer();
  });

  test("de l'acceptation au refus du colis, remboursement intégral et réputation intacte", async ({ navigateurConnecte, jeuEssai, mailpit }) => {
    test.setTimeout(15 * 60_000);
    await mailpit.vider();
    const trajet = jeuEssai.trajet("fih");

    const expediteur = await navigateurConnecte("aminata");
    const voyageur = await navigateurConnecte("josephine");
    const kgAvant = await kilosRestants(voyageur.contexte, trajet);

    // La ligne de faits de Joséphine AVANT tout : c'est elle qui ne doit pas bouger (étape 7).
    const slug = await ProfilPublic.slugDuMembre(voyageur.contexte);
    const profil = new ProfilPublic(voyageur.page);
    const faitsAvant = await profil.ligneDeFaits(slug);
    const tardivesAvant = ProfilPublic.annulationsTardives(faitsAvant);

    /* ── Étape 1 — Aminata réserve 2 kg, taille S, et note le total ── */
    const assistant = new AssistantReservation(expediteur.page);
    const montant = await assistant.reserver(
      trajet,
      { famille: "Vêtements & textile", taille: "S", poidsKg: "2", valeurEuros: "90", description: "Deux robes en wax" },
      DESTINATAIRE
    );
    const totalCents = enCentimes(montant);
    expect(totalCents).toBeGreaterThan(0);
    await expect.poll(() => expediteur.page.url(), { timeout: 90_000 }).toMatch(/\/bookings\/[0-9a-f]{24}$/);
    const dealId = expediteur.page.url().split("/bookings/")[1];

    /* ── Étape 2 — Joséphine accepte : le paiement est capturé ── */
    const demande = new DemandeVoyageur(voyageur.page);
    await demande.ouvrir(dealId);
    await demande.accepterLaCharte();
    await demande.accepter();
    expect(await kilosRestants(voyageur.contexte, trajet), "les kilos sont réservés à l'acceptation").toBe(kgAvant - 2);
    const finances = new Finances(expediteur.page);
    await finances.ouvrir("Paiements");
    expect(await finances.lignePaiement(dealId)).toContain("Bloqué chez Yamba");
    await mailpit.attendreEmail({ pour: COMPTES.aminata.email, sujet: /est acceptée/ });
    await mailpit.vider();

    /* ── Étapes 3 et 4 — l'écran de prise en charge, « Refuser le colis », la raison, le toast ── */
    const transport = new TransportVoyageur(voyageur.page);
    const refus = await transport.refuserLeColis(dealId, RAISON);
    expect(refus.fenetre).toContain("Refuser ce colis ?");
    expect(refus.fenetre).toContain("Refuser un colis non conforme ne pénalise jamais ta réputation.");
    expect(refus.fenetre).toContain(`Le Deal sera annulé et ${COMPTES.aminata.prenom} intégralement remboursée.`);
    expect(refus.toast).toBe(`Colis refusé. ${COMPTES.aminata.prenom} a été notifiée et sera remboursée.`);
    expect(refus.status).toBe("CANCELLED");
    expect(refus.refundAmountCents, "le remboursement est INTÉGRAL : le total payé, au centime").toBe(totalCents);

    /* ── Étape 5 — Mes envois « Annulée », Finances « Remboursé {total} le … » ── */
    const envois = new MesEnvois(expediteur.page);
    await envois.ouvrir();
    await envois.attendreSurLaLigne(dealId, "Annulée");
    await finances.ouvrir("Paiements");
    const ligne = await finances.lignePaiement(dealId);
    expect(ligne).toContain(`Remboursé ${enEuros(totalCents)} le `);
    expect(ligne, "aucune retenue : rien ne revient au Voyageur").not.toContain("retenue");

    /* ── Étape 6 — Mailpit : le refus avec sa raison, puis le remboursement intégral ── */
    const refusEmail = await mailpit.attendreEmail({ pour: COMPTES.aminata.email, sujet: /^Ton colis Bruxelles → Kinshasa n'a pas pu être pris en charge$/ });
    expect(normaliserEspaces(refusEmail.texte + refusEmail.html)).toContain(RAISON);
    const remboursement = await mailpit.attendreEmail({ pour: COMPTES.aminata.email, sujet: /^Remboursement émis pour ton envoi Bruxelles → Kinshasa$/ });
    const corpsRemboursement = normaliserEspaces(remboursement.texte + remboursement.html);
    expect(corpsRemboursement).toContain(enEuros(totalCents));
    expect(corpsRemboursement, "le remboursement est intégral : pas un mot sur une retenue").not.toMatch(/retenue/i);
    expect(refusEmail.recuLe <= remboursement.recuLe, "le refus est annoncé avant le remboursement").toBe(true);

    /* ── Étape 7 — la page publique de Joséphine : aucune annulation de plus ── */
    const faitsApres = await profil.ligneDeFaits(slug);
    expect(ProfilPublic.annulationsTardives(faitsApres), "ANO-WEB-10 : un refus au pickup n'est pas une annulation fautive").toBe(tardivesAvant);
    expect(faitsApres).toBe(faitsAvant);

    /* ── Étape 8 — Mes trajets : la ligne du deal, et les kilos rendus ── */
    const trajets = new MesTrajets(voyageur.page);
    await trajets.ouvrir();
    expect(await trajets.ligneDuDeal(dealId)).toMatch(/Annulé|Refusé/);
    expect(await kilosRestants(voyageur.contexte, trajet), "les kilos sont rendus au trajet").toBe(kgAvant);
  });
});
