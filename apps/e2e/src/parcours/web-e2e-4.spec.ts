/**
 * web-e2e-4.spec.ts — cahier 01-WEB, chapitre 6 : le compte neuf, plafonné de bout en bout
 * ========================================================================================
 * Un compte créé sur place, et tout ce que le produit lui refuse ou lui cache pendant ses trente
 * premiers jours (CNF-06, D71) : valeur déclarée plafonnée à 300 €, 10 kg, cinq envois par mois
 * — refusés AVANT tout argent —, et un score de confiance que personne ne voit jamais, ni à
 * l'écran, ni dans l'export de ses données. Puis la vie ordinaire du compte : une session qui
 * expire après une heure sans activité, ses appareils, et une suppression bloquée tant qu'un
 * deal est en cours.
 *
 * Écarts assumés :
 * - étape 12 : « le geste reprend » — le produit ne rejoue pas l'action qui a échoué ; il
 *   rafraîchit les données de la page. Le harnais vérifie que la page n'a pas bougé, que la
 *   session est de retour, et que le même geste, refait, passe ;
 * - étape 13 : le cahier dit « Appareils connectés », l'écran s'intitule « Sessions actives »
 *   (« Les appareils connectés à ton compte ; … ») ;
 * - étape 12 : l'heure d'inactivité est simulée par une manœuvre fidèle à SES-01 (le délai
 *   d'inactivité EST la durée de vie de la clé Redis de la session : la supprimer, c'est l'avoir
 *   laissée expirer), consignée par `jeuEssai.manoeuvre`.
 */
import { readFileSync } from "node:fs";
import { test, expect, connexion } from "../fixtures/yamba";
import type { Compte } from "../fixtures/comptes";
import { compteNeuf } from "../fixtures/compte-neuf";
import { JeuEssai } from "../fixtures/jeu-essai";
import { adresseDeLApi } from "../fixtures/adresses";
import { Inscription } from "../pages/inscription";
import { AssistantReservation, normaliserEspaces, type Famille } from "../pages/reservation";
import { DemandeVoyageur } from "../pages/deal-voyageur";
import { Finances } from "../pages/finances";
import { Securite } from "../pages/securite";

const DESTINATAIRE = { prenom: "Clarisse", nom: "Mabiala", indicatif: "+242", telephone: "061234567" };
const REFUS_PLAFOND = "Ton compte est récent : pour l'instant, tes envois sont plafonnés (valeur déclarée, poids et nombre par mois). Le plafond se lève avec tes premiers envois terminés.";
const MOTS_INTERDITS = ["trustscore", "trust score", "niveau de risque", "score de confiance", "high_risk"];

test.describe("WEB-E2E-4 — le compte neuf, plafonné de bout en bout", () => {
  test.beforeAll(() => {
    new JeuEssai().rejouer();
  });

  test("de l'inscription à la suppression bloquée", async ({ navigateurVisiteur, navigateurConnecte, jeuEssai, mailpit }) => {
    test.setTimeout(20 * 60_000);
    await mailpit.vider();
    const neuf = compteNeuf();
    const compte: Compte = { cle: "neuf", email: neuf.email, prenom: neuf.prenom, nom: neuf.nom, role: "EXPEDITEUR" };

    /* ── Étape 1 — le compte est créé, activé par le code reçu, bienvenue ── */
    const a = await navigateurVisiteur();
    await new Inscription(a.page).creer(neuf, mailpit);

    /* ── Étape 2 — connexion sans « Rester connecté » : session standard ── */
    await connexion(a.page, compte, neuf.motDePasse);
    const refresh = (await a.contexte.cookies()).find((c) => c.name === "refresh_token");
    expect(refresh?.expires, "sans « Rester connecté », le cookie de session n'a pas de date d'expiration").toBe(-1);
    const me = (await (await a.contexte.request.get(`${adresseDeLApi()}/auth/me`)).json()) as { user: { id: string; publicSlug: string } };
    const userId = me.user.id;
    await mailpit.vider();

    /* ── Étapes 3 et 4 — 450 € déclarés : refusé avant tout paiement, rien nulle part ── */
    const assistant = new AssistantReservation(a.page);
    const trop = await assistant.tenterDeReserver(jeuEssai.trajet("bzv-perkg"), { famille: "Vêtements & textile", taille: "S", poidsKg: "2", valeurEuros: "450", description: "Deux manteaux" }, DESTINATAIRE);
    expect(trop.refus).toBe(REFUS_PLAFOND);
    expect(trop.intentionRefusee, "ANO-WEB-08 : le plafond de valeur déclarée tombe à l'intention, avant toute autorisation").toBe(true);
    const finances = new Finances(a.page);
    await finances.ouvrir("Paiements");
    await expect(a.page.getByText("Aucun paiement pour l'instant")).toBeVisible({ timeout: 30_000 });
    await mailpit.aucunEmailPour(neuf.email, 3_000);

    /* ── Étape 5 — 12 kg : plafond de poids ── */
    const lourd = await assistant.tenterDeReserver(jeuEssai.trajet("bzv-perkg"), { famille: "Vêtements & textile", taille: "S", poidsKg: "12", valeurEuros: "250", description: "Une valise de vêtements" }, DESTINATAIRE);
    expect(lourd.refus).toBe(REFUS_PLAFOND);
    expect(lourd.intentionRefusee).toBe(true);

    /* ── Étapes 6 et 7 — cinq demandes dans le mois ── */
    const demandes: Array<{ trajet: string; famille: Famille; taille: "S" | "M"; poidsKg: string; valeurEuros: string }> = [
      { trajet: "bzv-perkg", famille: "Documents & papiers", taille: "S", poidsKg: "8", valeurEuros: "250" },
      { trajet: "fih", famille: "Vêtements & textile", taille: "M", poidsKg: "3", valeurEuros: "120" },
      { trajet: "gru", famille: "Vêtements & textile", taille: "S", poidsKg: "2", valeurEuros: "80" },
      { trajet: "yul", famille: "Documents & papiers", taille: "S", poidsKg: "2", valeurEuros: "60" },
      { trajet: "bzv-upcoming", famille: "Vêtements & textile", taille: "S", poidsKg: "2", valeurEuros: "90" },
    ];
    const dealIds: string[] = [];
    for (const d of demandes) {
      const r = await assistant.tenterDeReserver(jeuEssai.trajet(d.trajet), { famille: d.famille, taille: d.taille, poidsKg: d.poidsKg, valeurEuros: d.valeurEuros, description: `Colis ${d.trajet}` }, DESTINATAIRE);
      expect(r.refus, `la demande sur ${d.trajet} passe`).toBeNull();
      dealIds.push(r.dealId!);
    }
    expect(dealIds).toHaveLength(5);

    /* ── Étape 8 — la sixième est refusée ── */
    const sixieme = await assistant.tenterDeReserver(jeuEssai.trajet("fih"), { famille: "Vêtements & textile", taille: "S", poidsKg: "2", valeurEuros: "50", description: "Un pull" }, DESTINATAIRE);
    expect(sixieme.refus).toBe(REFUS_PLAFOND);
    expect(sixieme.intentionRefusee).toBe(true);

    /* ── Étape 9 — aucune mention d'un score, nulle part ── */
    for (const url of ["/fr/dashboard/home", "/fr/dashboard/profile", `/fr/u/${me.user.publicSlug}`]) {
      await a.page.goto(url, { waitUntil: "networkidle" });
      await expect(a.page.getByRole("heading").first()).toBeVisible({ timeout: 60_000 });
      const texte = normaliserEspaces(await a.page.locator("body").innerText()).toLowerCase();
      for (const mot of MOTS_INTERDITS) expect(texte, `sur ${url}`).not.toContain(mot);
      expect(texte, `sur ${url}`).not.toMatch(/\b\d+\s*points?\b/);
    }

    /* ── Étape 10 — l'export de mes données, par la porte, sans trace du score ── */
    const securite = new Securite(a.page);
    await securite.ouvrir();
    const chemin = await securite.telechargerMesDonnees(neuf.email, mailpit);
    const brut = readFileSync(chemin, "utf-8");
    const json = JSON.parse(brut) as { format: string; profile: { email: string }; bookings: unknown[] };
    expect(json.format).toBe("yamba-data-export/1");
    expect(json.profile.email).toBe(neuf.email);
    expect(json.bookings).toHaveLength(5);
    for (const mot of ["trustscore", "trust_score", "\"score\"", "risklevel", "\"caps\"", "high_risk"]) expect(brut.toLowerCase()).not.toContain(mot);

    /* ── Étape 11 — Thomas accepte la demande sur son trajet ── */
    const b = await navigateurConnecte("thomas");
    const demande = new DemandeVoyageur(b.page);
    await demande.ouvrir(dealIds[0]);
    await demande.accepterLaCharte();
    await demande.accepter();
    await mailpit.attendreEmail({ pour: neuf.email, sujet: /Ta demande .* est acceptée/ });
    await a.page.goto("/fr/dashboard/notifications", { waitUntil: "networkidle" });
    await expect(a.page.getByText(/a accepté ta demande/).first()).toBeVisible({ timeout: 60_000 });

    /* ── Étape 12 — une heure sans activité (manœuvre SES-01), puis un geste ── */
    await securite.ouvrir();
    jeuEssai.manoeuvre(
      "WEB-E2E-4 § 12 — SES-01 : une session standard meurt après 60 min sans activité ; ce délai EST la durée de vie de la clé Redis refresh_jti:<userId>:<jti> (session-policy.ts). La supprimer, c'est l'avoir laissée expirer.",
      `import r from "./packages/libs/redis"; (async () => { const k = await r.keys("refresh_jti:${userId}:*"); if (k.length) await r.del(...k); console.log("clés supprimées :", k.length); await r.quit(); process.exit(0); })();`
    );
    await a.contexte.clearCookies({ name: "access_token" });
    await securite.cliquerSupprimer();
    await securite.reconnexionDansLaFenetre(neuf.email, neuf.motDePasse);
    await expect(a.page).toHaveURL(/\/fr\/dashboard\/security/);
    expect((await a.contexte.cookies()).some((c) => c.name === "access_token"), "la session est de retour").toBe(true);

    /* ── Étape 13 — les sessions actives : cet appareil ── */
    await securite.ouvrir();
    const appareil = await securite.ligneDeCetAppareil();
    expect(appareil).toMatch(/Chrome|Chromium|Safari|Appareil inconnu/);
    expect(appareil).toContain("Dernière activité");

    /* ── Étape 14 — la suppression est bloquée, et aucun code ne part ── */
    await mailpit.vider();
    await securite.cliquerSupprimer();
    const panneau = await securite.suppressionBloquee();
    expect(panneau).toContain("Un deal est en cours (accepté, en transit, livré ou en litige).");
    expect(panneau).toContain("Une demande de réservation attend une réponse.");
    await mailpit.aucunEmailPour(neuf.email, 4_000);
  });
});
