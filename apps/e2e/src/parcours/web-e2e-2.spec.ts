/**
 * web-e2e-2.spec.ts — cahier 01-WEB, chapitre 6 : le parcours avec litige
 * =======================================================================
 * Le second parcours **bloquant** : un colis livré, un signalement, la version du Voyageur, une
 * décision du back-office (remboursement partiel de 15,00 €), et ce que chacun lit ensuite —
 * avec, à chaque étape, ce qu'un rôle **ne voit pas** : le Voyageur ne lit jamais le récit ni
 * les photos de l'Expéditeur (A68), l'Expéditeur apprend que le Voyageur a donné sa version
 * mais jamais son contenu (D55 5A), et chaque email de décision ne porte que le montant qui
 * concerne son destinataire.
 *
 * Quatre navigateurs : A João, B Thomas, D la médiatrice du back-office — et le jeu d'essai
 * fournit le deal : `bzv-delivered` (livré la veille, période de vérification ouverte,
 * transport 55,00 € + commission 6,60 € = 61,60 €).
 *
 * Deux écarts entre la lettre du cahier et le produit, assumés ici :
 * - étape 11 : il n'y a pas de bouton « Donner ma version » — le formulaire est déjà ouvert
 *   dans la carte « Donne ta version » (le libellé du cahier est celui de l'email) ;
 * - étape 4 : « Ça ne va pas » compte 12 ou 13 caractères selon la forme du « Ç » ; le harnais
 *   vérifie le compteur « n / minimum 50 caractères » sans parier sur n.
 */
import { test, expect } from "../fixtures/yamba";
import { COMPTES, COMPTES_ADMIN } from "../fixtures/comptes";
import { JeuEssai } from "../fixtures/jeu-essai";
import { FilMessagerie } from "../pages/fil-messagerie";
import { SignalementExpediteur } from "../pages/signalement-expediteur";
import { LitigeVoyageur } from "../pages/litige-voyageur";
import { MediationAdmin } from "../pages/mediation-admin";
import { normaliserEspaces } from "../pages/reservation";

const DESCRIPTION_JOAO =
  "Le destinataire a ouvert le colis devant moi : le chargeur et la housse de l'ordinateur manquent, alors que les deux étaient déclarés.";
const VERSION_THOMAS =
  "J'ai récupéré le colis fermé devant l'Expéditeur, checklist complète, et je l'ai remis en main propre au destinataire qui a validé le code.";
const MOTIF_DECISION =
  "Les photos de la prise en charge et la version du Voyageur montrent un colis fermé ; les accessoires manquants ne sont pas établis. Remboursement partiel retenu.";

test.describe("WEB-E2E-2 — le parcours avec litige", () => {
  test.beforeAll(() => {
    new JeuEssai().rejouer();
  });

  test("du signalement à la décision de médiation", async ({ navigateurConnecte, navigateurAdmin, jeuEssai, mailpit }) => {
    test.setTimeout(15 * 60_000);
    await mailpit.vider();
    const deal = jeuEssai.deal("bzv-delivered");
    expect(deal.expediteur).toBe(COMPTES.joao.email);
    expect(deal.voyageur).toBe(COMPTES.thomas.email);

    /* ── Étapes 1 à 6 — João signale ── */
    const expediteur = await navigateurConnecte("joao");
    const signalement = new SignalementExpediteur(expediteur.page);
    await signalement.ouvrirLeSuiviLivre(deal.id);
    await signalement.ouvrirLeSignalement();
    await signalement.choisirLeMotif("Contenu manquant ou différent de la déclaration");
    const compteur = await signalement.ecrireTropCourt("Ça ne va pas");
    expect(compteur).toMatch(/^1[23] \/ minimum 50 caractères$/);
    await signalement.completerLeDossier({
      motif: "Contenu manquant ou différent de la déclaration",
      description: DESCRIPTION_JOAO,
      nbPhotos: 2,
      solution: /^Remboursement intégral/,
    });
    const ticket = await signalement.envoyer();
    expect(ticket).toMatch(/^YAM-\d{4,6}$/);

    /* ── Étape 7 — le fil est fermé ── */
    const fil = new FilMessagerie(expediteur.page);
    const conversationId = await FilMessagerie.identifiantDuFil(expediteur.contexte, deal.id);
    await fil.ouvrirFermeParLeLitige(conversationId);

    /* ── Étape 8 — Mailpit : l'accusé au signalant, l'email calme au Voyageur ── */
    const accuse = await mailpit.attendreEmail({ pour: COMPTES.joao.email, sujet: /^Signalement YAM-\d+ enregistré/ });
    expect(accuse.sujet).toContain(ticket);
    expect(accuse.texte + accuse.html).toContain("gelé");
    expect(accuse.texte + accuse.html).toContain("48 h ouvrées");
    const calme = await mailpit.attendreEmail({ pour: COMPTES.thomas.email, sujet: /^Un signalement a été ouvert sur ton transport/ });
    expect(calme.texte + calme.html).toContain("contenu manquant");
    expect(calme.texte + calme.html, "jamais le récit de l'Expéditeur").not.toContain("chargeur");
    expect(calme.texte + calme.html, "jamais ses photos").not.toContain("ik.imagekit.io");

    /* ── Étapes 9 et 10 — Thomas voit le dossier, la catégorie seule ── */
    const voyageur = await navigateurConnecte("thomas");
    const litige = new LitigeVoyageur(voyageur.page);
    const ecranVoyageur = await litige.ouvrir(deal.id, ticket);
    expect(ecranVoyageur).toContain("contenu manquant");
    expect(ecranVoyageur, "le Voyageur ne lit jamais le récit de l'Expéditeur").not.toContain("chargeur");

    /* ── Étapes 11 et 12 — sa version, en deux temps ── */
    await litige.ecrireTropCourt("Colis remis fermé.");
    await litige.donnerSaVersion(VERSION_THOMAS, { photo: true });
    // La version du Voyageur n'écrit à personne (D55) : chacun n'a toujours qu'un seul email.
    await new Promise((r) => setTimeout(r, 4_000));
    expect(await mailpit.compter({ pour: COMPTES.joao.email })).toBe(1);
    expect(await mailpit.compter({ pour: COMPTES.thomas.email })).toBe(1);

    /* ── Étape 13 — João apprend le fait, jamais le contenu ── */
    const suiviLitige = await signalement.ouvrirLeSuiviEnLitige(deal.id, ticket);
    expect(suiviLitige.texte).toMatch(/a donné sa version\. La décision arrive sous 5 jours ouvrés\./);
    expect(suiviLitige.texte, "le contenu de la version du Voyageur n'atteint jamais l'Expéditeur").not.toContain("checklist complète");

    /* ── Étape 14 — la médiatrice tranche : remboursement partiel de 15,00 € ── */
    const admin = await navigateurAdmin("mediateur");
    expect(admin.compte.profils).toEqual(COMPTES_ADMIN.mediateur.profils);
    const mediation = new MediationAdmin(admin.page);
    await mediation.ouvrirLaFile();
    const bandeau = await mediation.ouvrirLeDossier(ticket);
    expect(bandeau).toMatch(/Version du Voyageur reçue le .* — décision possible\./);
    const dossier = normaliserEspaces(await mediation.texteDuDossier());
    expect(dossier, "le dossier porte les deux versions").toContain("chargeur");
    expect(dossier).toContain("checklist complète");
    expect(dossier, "le code de livraison n'est jamais servi au back-office").not.toMatch(/\b742 ?891\b/);
    const { recapitulatif, resultat } = await mediation.trancher({ issue: "PARTIAL_REFUND", montantEuros: "15,00", motif: MOTIF_DECISION });
    const recap = normaliserEspaces(recapitulatif);
    expect(recap).toMatch(/Remboursé à l'Expéditeur \(João\) : 15,00 €/);
    expect(recap).toMatch(/Versé au Voyageur \(Thomas\) : 40,00 €/);
    expect(recap).toMatch(/Conservé par Yamba : 6,60 €/);
    expect(normaliserEspaces(resultat)).toMatch(/Remboursement partiel · deal COMPLETED · remboursé 15,00 € · versé 40,00 €/);

    /* ── Étape 15 — João lit la décision ── */
    const decisionExpediteur = normaliserEspaces(await signalement.lireLaDecision(deal.id));
    expect(decisionExpediteur).toContain("Ton signalement est retenu en partie : remboursement partiel.");
    expect(decisionExpediteur).toContain("15,00 € te sont remboursés, sur ta carte sous 5 à 10 jours.");
    expect(decisionExpediteur).toContain(MOTIF_DECISION);
    expect(decisionExpediteur, "ANO-WEB-04 : un deal clos par la médiation ne dit pas « sans signalement de ta part »").not.toContain("sans signalement de ta part");
    expect(decisionExpediteur).toContain("Clos par la médiation le");

    /* ── Étape 16 — Thomas lit la décision, et son montant à lui ── */
    const decisionVoyageur = normaliserEspaces(await litige.lireLaDecision(deal.id));
    expect(decisionVoyageur).toContain("Le signalement est retenu en partie : une part du prix est remboursée à l'Expéditeur.");
    expect(decisionVoyageur).toMatch(/40,00 € partent vers ton compte/);
    expect(decisionVoyageur).toContain(MOTIF_DECISION);
    expect(decisionVoyageur, "le Voyageur ne lit jamais le montant remboursé").not.toContain("15,00 €");

    /* ── Étape 17 — un deal clos par la médiation ne se note pas ── */
    await expect(expediteur.page.getByRole("button", { name: /^Noter / })).toHaveCount(0);
    await expect(voyageur.page.getByRole("button", { name: /^Noter / })).toHaveCount(0);

    /* ── Étape 18 — « Décision rendue », chacun son montant ── */
    const decisionMailJoao = await mailpit.attendreEmail({ pour: COMPTES.joao.email, sujet: /^Décision rendue sur ton envoi/ });
    expect(normaliserEspaces(decisionMailJoao.texte + decisionMailJoao.html)).toContain("15,00 €");
    expect(normaliserEspaces(decisionMailJoao.texte + decisionMailJoao.html)).not.toContain("40,00 €");
    const decisionMailThomas = await mailpit.attendreEmail({ pour: COMPTES.thomas.email, sujet: /^Décision rendue sur ton transport/ });
    expect(normaliserEspaces(decisionMailThomas.texte + decisionMailThomas.html)).toContain("40,00 €");
    expect(normaliserEspaces(decisionMailThomas.texte + decisionMailThomas.html)).not.toContain("15,00 €");

    /* ── Étape 19 — Finances › Paiements : la ligne du remboursement partiel ── */
    const ligne = normaliserEspaces(await signalement.lignePaiement(COMPTES.thomas.prenom));
    expect(ligne).toMatch(/Remboursé 15,00 € le /);
    expect(ligne).toMatch(/\+ 15,00 €/);
  });
});
