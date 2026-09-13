/**
 * web-e2e-3.spec.ts — cahier 01-WEB, chapitre 6 : le parcours avec annulation tardive
 * ===================================================================================
 * Le troisième parcours **bloquant** : un deal accepté, puis annulé par l'Expéditrice à moins
 * de 48 h du départ. La règle ANN-01 (D50) : remboursement de la moitié, retenue de 50 %
 * reversée au Voyageur au prorata du transport — et le harnais refait l'arithmétique du cahier
 * au centime, à partir des montants lus à l'écran, jamais de constantes.
 *
 * Trois navigateurs : A Marie-Claire, B Marc, Mailpit. Le trajet est `yul` (Paris → Montréal,
 * 9,50 €/kg, 20 kg dont 10 déjà réservés) : le seed le fait partir à J+3, le cahier exige moins
 * de 48 h — la manœuvre en base est faite AVANT la réservation (le barème lit le départ figé
 * dans le deal) et consignée par `jeuEssai.manoeuvre`.
 *
 * Deux écarts assumés :
 * - étape 12 : « Mes trajets » n'affiche pas les kilos restants ; ils sont vérifiés par l'API du
 *   trajet (`remainingKg`), avant et après ;
 * - étape 15 : « sinon, l'annulation passe » n'est pas atteignable sur `yul` (un deal DELIVERED
 *   d'Aminata y reste vivant) ; seule la branche du refus est jouée — c'est le cas nominal.
 */
import { test, expect } from "../fixtures/yamba";
import { COMPTES } from "../fixtures/comptes";
import { JeuEssai } from "../fixtures/jeu-essai";
import { AssistantReservation, normaliserEspaces } from "../pages/reservation";
import { DemandeVoyageur } from "../pages/deal-voyageur";
import { FilMessagerie } from "../pages/fil-messagerie";
import { MesEnvois, enCentimes, enEuros } from "../pages/mes-envois";
import { Finances } from "../pages/finances";
import { MesTrajets, kilosRestants } from "../pages/mes-trajets";

const DESTINATAIRE = { prenom: "Étienne", nom: "Roy", indicatif: "+1", telephone: "5145551234" };

test.describe("WEB-E2E-3 — le parcours avec annulation tardive", () => {
  test.beforeAll(() => {
    new JeuEssai().rejouer();
  });

  test("de l'acceptation à l'annulation à moins de 48 h", async ({ navigateurConnecte, jeuEssai, mailpit }) => {
    test.setTimeout(15 * 60_000);
    await mailpit.vider();
    const trajet = jeuEssai.trajet("yul");

    /* ── Étape 1 — le trajet part dans moins de 48 h (manœuvre consignée) ── */
    jeuEssai.manoeuvre(
      "WEB-E2E-3 § 1 — le trajet yul part à J+3 dans le seed ; le cahier exige moins de 48 h (départ ramené à +24 h, arrivée +8 h)",
      `import p from "./packages/libs/prisma"; (async () => { const d = new Date(Date.now() + 24 * 3600e3); await p.trip.update({ where: { id: "${trajet}" }, data: { departureAt: d, arrivalAt: new Date(d.getTime() + 8 * 3600e3) } }); process.exit(0); })();`
    );

    /* ── Étape 2 — Marie-Claire réserve 3 kg, taille S, 100 € ── */
    const expediteur = await navigateurConnecte("marieclaire");
    const voyageur = await navigateurConnecte("marc");
    const kgAvant = await kilosRestants(voyageur.contexte, trajet);

    const assistant = new AssistantReservation(expediteur.page);
    const montant = await assistant.reserver(
      trajet,
      { famille: "Vêtements & textile", taille: "S", poidsKg: "3", valeurEuros: "100", description: "Un pull et deux écharpes" },
      DESTINATAIRE
    );
    const totalCents = enCentimes(montant);
    expect(totalCents, "3 kg × 9,50 € = 28,50 € de transport + 12 % de service").toBe(3192);
    await expect.poll(() => expediteur.page.url(), { timeout: 90_000 }).toMatch(/\/bookings\/[0-9a-f]{24}$/);
    const dealId = expediteur.page.url().split("/bookings/")[1];

    const finances = new Finances(expediteur.page);
    await finances.ouvrir("Paiements");
    expect(await finances.lignePaiement(dealId)).toContain("Autorisé, pas débité");

    /* ── Étape 3 — Marc accepte : le paiement est capturé ── */
    const demande = new DemandeVoyageur(voyageur.page);
    await demande.ouvrir(dealId);
    const gain = await demande.gainAnnonce();
    const netCents = enCentimes(gain.replace(/^TU GAGNES\s*/, "").match(/\d+,\d{2}\s?€/)?.[0] ?? "");
    expect(netCents, "le net du Voyageur est le transport").toBe(2850);
    await demande.accepterLaCharte();
    await demande.accepter();
    expect(await kilosRestants(voyageur.contexte, trajet)).toBe(kgAvant - 3);

    await finances.ouvrir("Paiements");
    expect(await finances.lignePaiement(dealId)).toContain("Bloqué chez Yamba");

    /* ── Étape 4 — deux messages, et la notification de chacun ── */
    const conversationId = await FilMessagerie.identifiantDuFil(expediteur.contexte, dealId);
    const filA = new FilMessagerie(expediteur.page);
    const filB = new FilMessagerie(voyageur.page);
    await filA.ouvrir(conversationId);
    await filA.envoyer("Bonjour Marc, le colis est prêt, on se voit où ?");
    await filB.ouvrir(conversationId);
    // Le message vit deux fois à l'écran (aperçu de la liste, bulle du fil) : on vise la bulle.
    await expect(voyageur.page.getByText("Bonjour Marc, le colis est prêt, on se voit où ?").last()).toBeVisible({ timeout: 15_000 });
    await filB.envoyer("Bonjour Marie-Claire, terminal 2E, comptoirs Air Canada.");
    await expect(expediteur.page.getByText("Bonjour Marie-Claire, terminal 2E, comptoirs Air Canada.").last()).toBeVisible({ timeout: 15_000 });
    for (const nav of [expediteur, voyageur]) {
      await nav.page.goto("/fr/dashboard/notifications", { waitUntil: "networkidle" });
      await expect(nav.page.getByText("Nouveau message").first(), "ANO-WEB-06 : un message reçu a un titre").toBeVisible({ timeout: 60_000 });
    }

    /* ── Étapes 5 à 7 — la fenêtre d'annulation et son arithmétique ── */
    const envois = new MesEnvois(expediteur.page);
    await envois.ouvrir();
    expect(await envois.texteDeLaLigne(dealId)).toContain("Accepté par Marc");
    const fenetre = await envois.ouvrirLAnnulation(dealId);
    expect(fenetre).toContain("Tu seras remboursée de");
    expect(fenetre).toMatch(/Une retenue de 50 % \(.+\) s'applique car le départ est dans moins de 48 h : elle est reversée au Voyageur, qui avait réservé sa capacité pour toi\./);
    const rembourseAttendu = Math.round(totalCents / 2);
    expect(fenetre, "remboursement = total ÷ 2").toContain(`Tu seras remboursée de ${enEuros(rembourseAttendu)}`);
    const retenueCents = totalCents - rembourseAttendu;
    expect(fenetre).toContain(`(${enEuros(retenueCents)})`);
    const compensationAttendue = Math.round((retenueCents * netCents) / totalCents);

    /* ── Étape 8 — « Garder l'envoi » : rien n'est annulé ── */
    await envois.garderLEnvoi();
    expect(await envois.texteDeLaLigne(dealId)).toContain("Accepté par Marc");

    /* ── Étape 9 — « Confirmer l'annulation » ── */
    await envois.ouvrirLAnnulation(dealId);
    const { refundAmountCents, toast } = await envois.confirmerLAnnulation();
    expect(Math.abs(refundAmountCents - rembourseAttendu), "écart maximal toléré : 1 centime").toBeLessThanOrEqual(1);
    expect(toast).toBe(`Envoi annulé. Remboursement de ${enEuros(refundAmountCents)} en cours.`);
    await envois.attendreSurLaLigne(dealId, "Annulée");

    /* ── Étape 10 — Finances › Paiements ── */
    await finances.ouvrir("Paiements");
    const ligne = await finances.lignePaiement(dealId);
    expect(ligne).toContain(`Remboursé ${enEuros(refundAmountCents)} le `);
    expect(ligne).toContain(`retenue ${enEuros(retenueCents)} reversée au Voyageur`);

    /* ── Étape 11 — Finances › Portefeuille de Marc ── */
    const financesB = new Finances(voyageur.page);
    await financesB.ouvrir("Portefeuille");
    const versement = await financesB.ligneVersement(dealId);
    expect(versement).toContain("Compensation · annulation tardive de Marie-Claire");
    expect(versement).toMatch(/Parti le .+ · 2 à 7 jours|En cours d'envoi/);
    const compensationLue = enCentimes(versement.match(/\+ (\d+,\d{2} €)/)?.[1] ?? "");
    expect(Math.abs(compensationLue - compensationAttendue), "compensation = arrondi(remboursement × net ÷ total), à 1 centime").toBeLessThanOrEqual(1);

    /* ── Étape 12 — Mes trajets : la ligne du deal, et les kilos rendus ── */
    const trajets = new MesTrajets(voyageur.page);
    await trajets.ouvrir();
    const ligneDeal = await trajets.ligneDuDeal(dealId);
    expect(ligneDeal).toMatch(/Annulée tardivement · .+ de compensation/);
    expect(await kilosRestants(voyageur.contexte, trajet), "les kilos sont rendus au trajet").toBe(kgAvant);

    /* ── Étape 13 — Mailpit ── */
    await mailpit.attendreEmail({ pour: COMPTES.marieclaire.email, sujet: /^Ta demande Paris → Montréal est annulée$/ });
    const remboursement = await mailpit.attendreEmail({ pour: COMPTES.marieclaire.email, sujet: /^Remboursement émis pour ton envoi Paris → Montréal$/ });
    const corpsRemboursement = normaliserEspaces(remboursement.texte + remboursement.html);
    expect(corpsRemboursement).toMatch(/une retenue de .+ s'applique, comme prévu dans nos conditions/);
    expect(corpsRemboursement).toContain("revient au Voyageur");
    await mailpit.attendreEmail({ pour: COMPTES.marc.email, sujet: /^Le deal Paris → Montréal a été annulé$/ });
    const compensation = await mailpit.attendreEmail({ pour: COMPTES.marc.email, sujet: /de compensation en route vers ton compte/ });
    expect(normaliserEspaces(compensation.sujet)).toContain(enEuros(compensationLue));

    /* ── Étape 14 — le fil reste lisible, et ouvert 14 jours ── */
    await filA.ouvrirEncoreOuvert(conversationId);
    await filB.ouvrirEncoreOuvert(conversationId);

    /* ── Étape 15 — Marc tente d'annuler le trajet : refus D72, avec le compte des deals vivants ── */
    await trajets.ouvrir();
    const refus = await trajets.tenterDAnnulerLeTrajet("Paris → Montréal");
    expect(refus.statut).toBe(409);
    // ANO-WEB-07 (tranchée le 09/09) : le conseil renvoie vers « Mes trajets », qui existe.
    expect(refus.toast).toMatch(/^Ce trajet porte encore \d+ deals? en cours : annule-les d'abord depuis « Mes trajets » \(chaque deal y est listé sous son trajet\)\. Chaque Expéditeur sera remboursé intégralement\.$/);
  });
});
