/**
 * web-dea.spec.ts — cahier 01-WEB, chapitre 5.14 « La demande côté Voyageur : accepter, refuser, expirer »
 * =========================================================================================================
 * Le pendant de l'assistant de réservation : où la demande apparaît chez Thomas (accueil, « Mes
 * trajets », cloche), l'écran « Nouvelle demande de Deal » bloc par bloc (le net, jamais le total
 * payé ni la commission ; jamais le mot « assurance »), la Charte Voyageur obligatoire, l'acceptation
 * (capture du paiement, Aminata prévenue, fil ouvert), le refus sans pénalité (cinq raisons, aucun
 * texte libre, kilos rendus, email avec la raison), l'expiration (avant le cron : plus d'action ;
 * après : bandeau et email chez l'Expéditeur), deux décisions concurrentes (une seule vérité), les
 * états fermés, et « Mon Deal accepté » en détail (le code de livraison n'apparaît nulle part).
 *
 * Les demandes vivantes sont CRÉÉES par l'assistant (Aminata sur `bzv-perkg`, 2,5 kg S 150 € :
 * 32,20 € payés, 28,75 € nets — les chiffres du chapitre 5.12) ; le refus se joue sur `bzv-pending`
 * (Aminata → Thomas), l'expiration sur `gru-pending` (João → Inês, `expiresAt` reculé de 25 h par
 * une manœuvre consignée, cron forcé par `scripts/recette/expire.ts`), les états fermés sur
 * `bzv-declined` / `bzv-expired` / `bzv-cancelled`. deal-service sur le fournisseur FAKE.
 */
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { test, expect, type Navigateur } from "../fixtures/yamba";
import { adresseDeLApi } from "../fixtures/adresses";
import { COMPTES } from "../fixtures/comptes";
import { JeuEssai } from "../fixtures/jeu-essai";
import { intercepterImageKit, photo } from "../fixtures/photos";
import { AssistantReservation, normaliserEspaces } from "../pages/reservation";
import { DemandeVoyageur } from "../pages/deal-voyageur";
import { FilMessagerie } from "../pages/fil-messagerie";
import { Finances } from "../pages/finances";
import { MesTrajets, kilosRestants } from "../pages/mes-trajets";

type Contexte = Navigateur["contexte"];
type Page = Navigateur["page"];
const api = () => adresseDeLApi();
const RACINE = join(__dirname, "../../../..");

/* ══ Le cahier ═══════════════════════════════════════════════════════════════════════════════ */

const CLARISSE = { prenom: "Clarisse", nom: "Mabiala", indicatif: "+242", telephone: "061234567" };
const COLIS = { famille: "Vêtements & textile" as const, taille: "S" as const, poidsKg: "2,5", valeurEuros: "150", description: "3 t-shirts, 1 pull, du chocolat" };
const RAISONS = ["Catégorie non transportée", "Poids ou volume trop important", "Lieu de remise ou livraison incompatible", "Délais trop courts", "Autre raison"];
const ENGAGEMENTS = [/Vérifier visuellement/, /Refuser/, /Transporter avec diligence/, /Remettre uniquement/, /Respecter les obligations douanières/, /Signaler à Yamba sans délai/];

/* ══ L'état partagé du chapitre (mode série) ═════════════════════════════════════════════════ */

/** La demande d'Aminata sur bzv-perkg (avec photos) : fiches 1 à 4, puis 9. */
let dealId = "";
/** La demande créée pour les deux onglets (fiche 7). */
let dealConcurrent = "";

/* ══ Aides ═══════════════════════════════════════════════════════════════════════════════════ */

const texte = async (page: Page) => normaliserEspaces(await page.locator("body").innerText());
const ouvrirDeal = async (page: Page, id: string) => {
  await page.goto(`/fr/carrier/deals/${id}`, { waitUntil: "networkidle" });
  // Un deal fermé n'a pas de titre : seulement le bandeau, l'indication et « Retour ».
  await expect(page.getByRole("heading").or(page.getByText("Il n'y a plus d'action à faire ici.")).first()).toBeVisible({ timeout: 60_000 });
};
/** La ligne « À traiter » d'une demande (toute la ligne est un lien vers la demande, « Répondre » en est l'action). */
const ligneDemande = (page: Page, id: string) => page.locator(`a[href="/fr/carrier/deals/${id}"]`).filter({ hasText: /Répondre$/ }).first();
/** Aminata crée une demande sur bzv-perkg par l'assistant (2,5 kg, S, 150 €) — avec ou sans photos. */
async function demandeDAminata(page: Page, tripId: string, avecPhotos: boolean): Promise<string> {
  await intercepterImageKit(page);
  const assistant = new AssistantReservation(page);
  await assistant.ouvrir(tripId);
  await assistant.decrireLeColis(COLIS);
  if (avecPhotos) {
    const fichier = page.locator('input[type="file"]').first();
    await fichier.setInputFiles(photo("contenu"));
    await fichier.setInputFiles(photo("emballe"));
    await expect(page.getByText("Emballé", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  }
  await assistant.continuer();
  await assistant.decrireLeDestinataire(CLARISSE);
  await assistant.continuer();
  await assistant.accepterLaCharte();
  await assistant.continuer();
  expect(await assistant.montantAPayer(), "32,20 € payés par Aminata").toMatch(/^32,20 €$/);
  await assistant.payer();
  await expect.poll(() => page.url(), { timeout: 90_000 }).toMatch(/\/bookings\/[0-9a-f]{24}$/);
  return page.url().split("/bookings/")[1];
}
/** Le DTO du deal tel que l'appelant le lit (Voyageur ou Expéditeur), en texte brut. */
async function dealBrut(contexte: Contexte, id: string): Promise<string> {
  const r = await contexte.request.get(`${api()}/deals/${id}`);
  expect(r.ok(), `GET /deals/${id}`).toBe(true);
  return r.text();
}
/** Ce qu'un visiteur lit du profil public de Thomas (réputation, compteurs) — pour prouver « aucune pénalité ». */
async function profilPublic(contexte: Contexte, slug: string): Promise<string> {
  const r = await contexte.request.get(`${api()}/users/${slug}/public`);
  expect(r.ok(), `GET /users/${slug}/public`).toBe(true);
  return r.text();
}
/** Un script de recette (scripts/recette/*.ts), exécuté avec le .env du poste. */
function scriptDeRecette(nom: string, ...args: string[]): string {
  return execFileSync("npx", ["tsx", "--env-file=.env", `scripts/recette/${nom}.ts`, ...args], { cwd: RACINE, encoding: "utf-8", timeout: 120_000 });
}

/* ══ Les fiches ══════════════════════════════════════════════════════════════════════════════ */

test.describe("WEB-DEA — la demande côté Voyageur (chapitre 5.14)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(() => {
    new JeuEssai().rejouer();
  });

  test("WEB-DEA-1 · où la demande apparaît : accueil, « Mes trajets », cloche — et aucun onglet « demandes »", async ({ navigateurConnecte, jeuEssai, mailpit }) => {
    test.setTimeout(5 * 60_000);
    await mailpit.vider();
    const aminata = await navigateurConnecte("aminata");
    dealId = await demandeDAminata(aminata.page, jeuEssai.trajet("bzv-perkg"), true);

    const { page } = await navigateurConnecte("thomas");
    /* Étape 1 — l'accueil : la carte du trajet qui attend une réponse. */
    await page.goto("/fr/dashboard/home", { waitUntil: "networkidle" });
    await expect(page.getByText("À traiter").first()).toBeVisible({ timeout: 60_000 });
    // Écart de cahier : l'accueil ne montre pas une carte « {n} demandes en attente » / « À répondre » /
    // « Voir les demandes » (copie présente dans dashboardHome.json, jamais rendue) mais UNE LIGNE PAR
    // DEMANDE — « Demande de Aminata », le gain, « Expire dans », « Répondre » — la même bande qu'en
    // « Mes trajets ». Consigné au rapport (à trancher) ; la fiche vérifie ce que l'écran fait.
    await expect(page.locator("main").getByText("Demande de Aminata").first()).toBeVisible({ timeout: 30_000 });
    const accueil = await texte(page);
    // Le titre et sa méta sont deux nœuds adjacents (« Demande de Aminata· Paris → … » sans espace dans innerText).
    expect(accueil).toMatch(/Demande de Aminata ?· Paris → Brazzaville · [a-zé]{3}\. \d{1,2} [a-zéû]+\.?/);
    expect(accueil, "ANO-WEB-41 : plus jamais l'époque Unix comme date de trajet").not.toContain("1 janv.");
    expect(accueil).toMatch(/Vêtements(?: & textile)? · 2[.,]5 kg · tu gagnes 28,75 € · reçue /);
    expect(accueil).toMatch(/Expire dans \d+ ?h/);
    // Toute la ligne est un lien vers la demande ; « Répondre » en est le libellé d'action.
    await expect(ligneDemande(page, dealId)).toBeVisible();
    test.info().annotations.push({ type: "constat", description: "accueil : une ligne par demande (« Demande de {prénom} … Répondre »), pas de carte « {n} demandes en attente » / « Voir les demandes » (copie morte dans dashboardHome.json)" });

    /* Étape 2 — « Mes trajets » : la bande « À traiter », la ligne du trajet. */
    const trajets = new MesTrajets(page);
    await trajets.ouvrir();
    await expect(page.getByText("À traiter").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Demande de Aminata").first()).toBeVisible();
    const bande = await texte(page);
    expect(bande).toMatch(/Vêtements(?: & textile)? · 2[.,]5 kg · tu gagnes 28,75 € · reçue /);
    expect(bande, "ANO-WEB-41").not.toContain("1 janv.");
    expect(bande).toMatch(/Expire dans \d+ ?h/);
    await expect(ligneDemande(page, dealId)).toBeVisible();
    // La ligne du trajet porte le badge « 1 demande » ; la section « Demandes et colis » s'ouvre au clic.
    expect(bande).toMatch(/26 sept\. 2026 · Avion En ligne 1 demande/);
    await trajets.ligneDuDeal(dealId); // déplie la section du trajet
    const ligne = normaliserEspaces(await page.locator(`a[href="/fr/carrier/deals/${dealId}"]`).filter({ hasText: "Demande en attente de ta réponse" }).first().innerText());
    expect(ligne, "la ligne du deal sous le trajet, avec le badge « Demande »").toMatch(/Aminata D · Vêtements · 2[.,]5 kg Demande en attente de ta réponse · expire dans \d+ h Demande \+ 28,75 €/);
    // La fiche du trajet : la section « Demandes et colis » et son badge « 1 demande ».
    await page.goto(`/fr/dashboard/trips/${jeuEssai.trajet("bzv-perkg")}`, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Demandes et colis" })).toBeVisible({ timeout: 60_000 });
    expect(await texte(page)).toMatch(/Demandes et colis 1 demande/);
    // Il n'existe pas d'onglet « demandes » séparé dans la navigation.
    expect(await page.getByRole("link", { name: /^Demandes$/ }).count(), "aucun onglet « Demandes »").toBe(0);

    /* Étape 3 — la cloche. */
    await page.goto("/fr/dashboard/notifications", { waitUntil: "networkidle" });
    await expect(page.getByText("Nouvelle demande de Aminata").first()).toBeVisible({ timeout: 60_000 });
    expect(await texte(page)).toMatch(/Paris → Brazzaville · 2[.,]5 kg · réponds sous 24 h/);
  });

  test("WEB-DEA-2 · l'écran « Nouvelle demande de Deal », bloc par bloc — le net, jamais le total ni la commission", async ({ navigateurConnecte, jeuEssai }) => {
    test.setTimeout(4 * 60_000);
    const { page, contexte } = await navigateurConnecte("thomas");
    // Étape 1 — depuis « Mes trajets », « Répondre ».
    await new MesTrajets(page).ouvrir();
    await ligneDemande(page, dealId).click();
    await expect(page).toHaveURL(new RegExp(`/fr/carrier/deals/${dealId}$`), { timeout: 60_000 });
    const demande = new DemandeVoyageur(page);
    await expect(page.getByText("Nouvelle demande de Deal")).toBeVisible({ timeout: 60_000 });
    const corps = await texte(page);
    expect(corps).toMatch(/Reçue il y a /);
    // « État : demande reçue, en attente de réponse » (clé stateLabel) n'est pas rendu sur écran large : constat.
    test.info().annotations.push({ type: "constat", description: `en-tête : « ${corps.match(/Reçue il y a [^·]+/)?.[0]?.trim()} » ; la ligne « État : demande reçue, en attente de réponse » du cahier n'est pas affichée (clé stateLabel non rendue)` });
    // Le compte à rebours : ambre par défaut, rouge à moins de 2 h (manœuvre : expiresAt à +90 min, puis remis à +23 h).
    expect(corps).toMatch(/expire dans|Expire dans/i);
    expect(corps).toMatch(/\d+h \d+min/);
    // La puce : le libellé « Expire dans » et son parent (fond ambre, rouge sous 2 h — alors role="alert").
    const puce = () => page.getByText(/^(Cette demande expire dans|Expire dans)$/).first().locator("xpath=..");
    expect(await puce().getAttribute("class"), "ambre par défaut").toContain("amber");
    expect(await puce().getAttribute("role"), "pas d'alerte au-delà de 2 h").toBeNull();
    jeuEssai.manoeuvre("WEB-DEA-2 : la puce passe en rouge à moins de 2 h — expiresAt reculé à +90 min (scripts/recette/deal-eligible.ts), remis à +23 h ensuite", "console.log('jouée par scripts/recette/deal-eligible.ts')");
    scriptDeRecette("deal-eligible", dealId, "90");
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByText(/^1h \d+min$/).first()).toBeVisible({ timeout: 30_000 });
    expect(await puce().getAttribute("class"), "rouge à moins de 2 h").toContain("red");
    expect(await puce().getAttribute("role"), "et annoncée comme une alerte").toBe("alert");
    scriptDeRecette("deal-eligible", dealId, String(23 * 60));
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByText(/^22h \d+min$/).first()).toBeVisible({ timeout: 30_000 });
    // Les blocs.
    const page2 = await texte(page);
    for (const bloc of ["DE LA PART DE", "Voir profil", "DÉTAILS DU COLIS", "POIDS DÉCLARÉ", "VALEUR DÉCLARÉE", "MODALITÉS DE REMISE ET LIVRAISON", "REMISE DU COLIS", "LIVRAISON", "Téléphone du destinataire communiqué à la prise en charge", "Garantie Yamba incluse", "Avant d'accepter, lis bien ces points", "TU GAGNES"]) {
      expect(page2, bloc).toContain(bloc);
    }
    expect(page2).toMatch(/Aminata D\./);
    // ANO-WEB-42 : chaque lieu n'est écrit qu'une fois (le détail n'est plus répété sous le nom).
    expect(page2.split("Terminal départ · Paris").length - 1, "le lieu de remise n'est écrit qu'une fois").toBe(1);
    // Écarts de cahier consignés (bloc « DE LA PART DE » sans « {n} envois » ni « Membre depuis » : ANO-WEB-43 ;
    // pas d'intitulé « COUVERTURE DU COLIS » ; note du gain « Versé 4 jours après… » au lieu de « Versement à J+4 … Stripe »).
    test.info().annotations.push({ type: "constat", description: `DE LA PART DE : « ${page2.match(/DE LA PART DE (.{0,60}?) DÉTAILS DU COLIS/)?.[1]} » — ni « {n} envois » ni « Membre depuis » (ANO-WEB-43)` });
    test.info().annotations.push({ type: "constat", description: `TU GAGNES : « ${page2.match(/TU GAGNES (.{0,90}?) Garantie/)?.[1]} » ; aucun intitulé « COUVERTURE DU COLIS »` });
    expect(page2).toMatch(/PHOTOS DÉCLARÉES PAR Aminata/i);
    expect(page2).toMatch(/CATÉGORIE Vêtements/); // libellé court de la famille
    expect(page2).toMatch(/2[,.]5 kg/);
    expect(page2).toMatch(/150(,00)? €/);
    expect(page2).toContain(COLIS.description);
    for (const puceTip of [/Vérifie systématiquement le contenu/, /Refuse si le contenu réel diffère/, /Prends tes propres photos/, /Tu transportes à tes risques/]) expect(page2).toMatch(puceTip);
    expect(await demande.gainAnnonce()).toContain("28,75");
    // Jamais le total payé, jamais la commission, jamais « assurance ».
    expect(page2, "le total payé par l'Expéditrice (32,20 €) n'apparaît pas").not.toContain("32,20");
    expect(page2.toLowerCase()).not.toContain("commission");
    expect(page2.toLowerCase()).not.toContain("assurance");
    expect(await dealBrut(contexte, dealId), "le DTO Voyageur ne porte ni le total ni la commission").not.toMatch(/"totalShipperCents"|"commissionCents"|"platformFeeCents"|:3220\b/);
    // La visionneuse plein écran.
    // Les vignettes sont des boutons (l'image interceptée ne se charge pas : l'icône de repli reste) —
    // le premier bouton du bloc « PHOTOS DÉCLARÉES PAR … ».
    await page.getByText("cliquez pour agrandir").locator("xpath=ancestor::*[.//button][1]").getByRole("button").first().click();
    await expect(page.getByRole("button", { name: /^(Fermer|Suivant|Précédent)$/ }).first()).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press("Escape");
  });

  test("WEB-DEA-3 · la Charte Voyageur est obligatoire", async ({ navigateurConnecte }) => {
    const { page } = await navigateurConnecte("thomas");
    await ouvrirDeal(page, dealId);
    await expect(page.getByText("Coche la Charte pour confirmer")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: /Accepter et confirmer/ }).click();
    await expect(page.getByText("Tu dois accepter la Charte pour confirmer ce Deal")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Nouvelle demande de Deal"), "on reste sur la demande").toBeVisible();
    const corps = await texte(page);
    expect(corps).toContain("Charte Voyageur");
    expect(corps).toContain("En acceptant ce Deal, je m'engage à :");
    for (const e of ENGAGEMENTS) expect(corps).toMatch(e);
    expect(corps).toContain("Je reconnais que ma seule responsabilité serait engagée en cas de transport d'un produit illicite, y compris en l'absence de vérification préalable.");
    await new DemandeVoyageur(page).accepterLaCharte();
    await expect(page.getByText("Coche la Charte pour confirmer")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Accepter et confirmer/ })).toBeEnabled();
  });

  test("WEB-DEA-4 · accepter la demande : « Mon Deal accepté », Aminata prévenue, paiement capturé, fil ouvert", async ({ navigateurConnecte, mailpit }) => {
    test.setTimeout(5 * 60_000);
    await mailpit.vider();
    const { page } = await navigateurConnecte("thomas");
    await ouvrirDeal(page, dealId);
    const demande = new DemandeVoyageur(page);
    await demande.accepterLaCharte();
    await demande.accepter();
    const corps = await texte(page);
    expect(corps).toContain("Mon Deal accepté");
    expect(corps).toContain("Aminata est prévenue · à toi de fixer le rendez-vous pour le pickup");
    for (const jalon of ["Deal accepté", "Pickup du colis", "Transport", "Livraison", "Versement"]) expect(corps, jalon).toContain(jalon);
    expect(corps).toContain("Contacte Aminata pour fixer le rendez-vous");
    await expect(page.getByRole("button", { name: /^Envoyer un message/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Appeler/ }).or(page.getByRole("link", { name: /^Appeler/ })).first()).toBeVisible();
    expect(corps).toContain("TON PAIEMENT");
    expect(corps).toContain("Net pour toi");
    expect(corps).toMatch(/Versé à\s*J\+4/);
    expect(corps).toContain("Ton compte de paiement");

    /* Vérification complémentaire — côté Aminata : notification, email, paiement capturé, fil accessible. */
    const aminata = await navigateurConnecte("aminata");
    await aminata.page.goto("/fr/dashboard/notifications", { waitUntil: "networkidle" });
    await expect(aminata.page.getByText("Thomas a accepté ta demande").first()).toBeVisible({ timeout: 60_000 });
    const email = await mailpit.attendreEmail({ pour: COMPTES.aminata.email, sujet: /est acceptée/ });
    expect(email.texte + email.html).toContain("a accepté ta demande");
    expect(email.texte + email.html, "le montant confirmé").toContain("32,20");
    const finances = new Finances(aminata.page);
    await finances.ouvrir("Paiements");
    expect(await finances.lignePaiement(dealId)).toContain("Bloqué chez Yamba");
    const conversationId = await new FilMessagerie(page).ouvrirDepuisDealVoyageur(dealId);
    expect(conversationId).toMatch(/^[0-9a-f]{24}$/);
    await new FilMessagerie(aminata.page).ouvrir(conversationId);
  });

  test("WEB-DEA-5 · refuser une demande : cinq raisons, aucun texte libre, Aminata prévenue, kilos rendus, aucune pénalité", async ({ navigateurConnecte, jeuEssai, mailpit }) => {
    test.setTimeout(4 * 60_000);
    await mailpit.vider();
    const refus = jeuEssai.deal("bzv-pending");
    const trajet = jeuEssai.trajet("bzv-upcoming");
    const { page, contexte } = await navigateurConnecte("thomas");
    const kgAvant = await kilosRestants(contexte, trajet);
    const profilAvant = await profilPublic(contexte, "seed-thomas");
    await ouvrirDeal(page, refus.id);
    await new DemandeVoyageur(page).refuser();
    /* Étapes 2 et 3 — la fenêtre, ses cinq raisons, aucun champ libre. */
    const fenetre = page.getByRole("dialog").filter({ hasText: "Refuser cette demande ?" }).first();
    await expect(fenetre).toBeVisible({ timeout: 15_000 });
    const contenu = normaliserEspaces(await fenetre.innerText());
    expect(contenu).toContain("Aminata sera notifiée et pourra contacter un autre Voyageur. Ton taux d'acceptation reste intact.");
    expect(contenu).toMatch(/Raison \(optionnel\)/i); // écrit en capitales par le style
    for (const r of RAISONS) expect(contenu, r).toContain(r);
    expect(await fenetre.getByRole("radio").count(), "exactement cinq choix").toBe(5);
    expect(await fenetre.locator("textarea, input[type=text]").count(), "aucun champ de texte libre").toBe(0);
    await fenetre.getByText("Poids ou volume trop important").click();
    /* Étape 4 — confirmer. */
    const reponse = page.waitForResponse((r) => r.url().includes(`/deals/${refus.id}/decline`) && r.request().method() === "POST", { timeout: 30_000 });
    await fenetre.getByRole("button", { name: "Refuser le Deal" }).click();
    expect((await reponse).ok()).toBe(true);
    await expect(page.getByText("Demande refusée. Aminata a été notifiée.").last()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Tu as refusé cette demande")).toBeVisible({ timeout: 30_000 });

    /* Vérification complémentaire — Expéditrice, email avec la raison, kilos, aucune pénalité. */
    const aminata = await navigateurConnecte("aminata");
    await aminata.page.goto(`/fr/bookings/${refus.id}`, { waitUntil: "networkidle" });
    await expect(aminata.page.getByText("Demande non acceptée")).toBeVisible({ timeout: 60_000 });
    await expect(aminata.page.getByText("Le Voyageur n'a pas pu accepter ta demande. Tu n'es pas débité·e : l'autorisation de paiement est levée intégralement.")).toBeVisible();
    const email = await mailpit.attendreEmail({ pour: COMPTES.aminata.email, sujet: /n'a pas pu être acceptée/ });
    // L'email traduit la raison pour l'Expéditrice (« Le colis est trop lourd pour la capacité restante. »),
    // pas le libellé du choix du Voyageur (« Poids ou volume trop important ») : consigné.
    const raison = /Raison indiquée : ([^\n·<]+)/.exec(email.texte)?.[1]?.trim();
    expect(raison, "l'email porte la raison").toBeTruthy();
    test.info().annotations.push({ type: "constat", description: `email « non acceptée » : « Raison indiquée : ${raison} » (le Voyageur avait choisi « Poids ou volume trop important »)` });
    expect(await kilosRestants(contexte, trajet), "les kilos sont rendus au trajet").toBe(kgAvant + 3);
    expect(await profilPublic(contexte, "seed-thomas"), "aucune pénalité : le profil public de Thomas est inchangé").toBe(profilAvant);
  });

  test("WEB-DEA-6 · une demande expirée ne s'accepte plus — avant le cron ; puis le cron prévient l'Expéditeur", async ({ navigateurConnecte, jeuEssai, mailpit }) => {
    test.setTimeout(5 * 60_000);
    await mailpit.vider();
    const perimee = jeuEssai.deal("gru-pending");
    jeuEssai.manoeuvre("WEB-DEA-6 : raccourci du cahier — expiresAt de gru-pending reculé de 25 h (scripts/recette/deal-eligible.ts)", "console.log('jouée par scripts/recette/deal-eligible.ts')");
    const etat = JSON.parse(scriptDeRecette("deal-eligible", perimee.id, String(-25 * 60)).trim().split("\n").pop()!) as { status: string; expiresAt: string };
    expect(etat.status).toBe("PENDING");
    expect(new Date(etat.expiresAt).getTime()).toBeLessThan(Date.now());

    /* Étapes 1 et 2 — côté Inês : « Expirée », plus aucune action ; l'API refuse aussi. */
    const { page, contexte } = await navigateurConnecte("ines");
    await ouvrirDeal(page, perimee.id);
    const corps = await texte(page);
    expect(corps).toMatch(/Cette demande a expiré|Expirée/);
    expect(await page.getByRole("button", { name: /Accepter et confirmer/ }).count(), "plus de bouton d'acceptation").toBe(0);
    expect(await page.getByRole("button", { name: /^Refuser$/ }).count()).toBe(0);
    const tentative = await contexte.request.post(`${api()}/deals/${perimee.id}/accept`, { data: { charterAccepted: true } });
    expect(tentative.status(), "l'acceptation est refusée avant même le cron").toBe(409);
    expect(await tentative.text()).toContain("TRANSITION_NOT_ALLOWED");

    /* Après le passage du cron (forcé : scripts/recette/expire.ts, la fournée des PENDING périmés). */
    const sortie = scriptDeRecette("expire");
    // La preuve de la passe est l'état du deal (EXPIRED), pas la sortie du script (consignée en note).
    test.info().annotations.push({ type: "note", description: `passe forcée expire-bookings : ${JSON.stringify(sortie.trim())}` });
    expect(await dealBrut(contexte, perimee.id), "la passe a expiré la demande").toMatch(/"status":"EXPIRED"/);
    const joao = await navigateurConnecte("joao");
    await joao.page.goto(`/fr/bookings/${perimee.id}`, { waitUntil: "networkidle" });
    await expect(joao.page.getByText("Demande expirée")).toBeVisible({ timeout: 60_000 });
    await expect(joao.page.getByText("Le Voyageur n'a pas répondu dans les 24 heures. Tu n'es pas débité·e : l'autorisation de paiement est levée intégralement.")).toBeVisible();
    await mailpit.attendreEmail({ pour: COMPTES.joao.email, sujet: /a expiré/ });
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByText("Cette demande a expiré").first()).toBeVisible({ timeout: 30_000 });
  });

  test("WEB-DEA-7 · deux décisions concurrentes ne créent pas deux vérités", async ({ navigateurConnecte, jeuEssai }) => {
    test.setTimeout(5 * 60_000);
    const aminata = await navigateurConnecte("aminata");
    dealConcurrent = await demandeDAminata(aminata.page, jeuEssai.trajet("bzv-perkg"), false);

    const { page, contexte } = await navigateurConnecte("thomas");
    const onglet2 = await contexte.newPage();
    await ouvrirDeal(page, dealConcurrent);
    await ouvrirDeal(onglet2, dealConcurrent);
    await expect(onglet2.getByText("Nouvelle demande de Deal")).toBeVisible({ timeout: 60_000 });
    // « Sans recharger » : TanStack Query relit le deal au retour du focus sur l'onglet — ce que le
    // cahier ne veut pas. L'onglet 2 garde la réponse qu'il a lue jusqu'au clic de confirmation.
    const lectureDeal = (r: { url(): string; request(): { method(): string } }) => r.url().includes(`/deals/${dealConcurrent}`) && r.request().method() === "GET";
    const figee = await (await onglet2.waitForResponse(lectureDeal, { timeout: 30_000 }).catch(() => null))?.text();
    const motif = `**/deals/${dealConcurrent}`;
    if (figee) await onglet2.route(motif, (route) => (route.request().method() === "GET" ? route.fulfill({ status: 200, contentType: "application/json", body: figee }) : route.continue()));
    /* Étape 2 — accepter dans l'onglet 1. */
    const demande = new DemandeVoyageur(page);
    await demande.accepterLaCharte();
    await demande.accepter();
    /* Étape 3 — sans recharger, refuser dans l'onglet 2. */
    await new DemandeVoyageur(onglet2).refuser();
    const fenetre = onglet2.getByRole("dialog").filter({ hasText: "Refuser cette demande ?" }).first();
    await expect(fenetre).toBeVisible({ timeout: 15_000 });
    await expect(onglet2.getByText("Nouvelle demande de Deal"), "l'onglet 2 n'a pas été rechargé").toBeVisible();
    if (figee) await onglet2.unroute(motif);
    const reponse = onglet2.waitForResponse((r) => r.url().includes(`/deals/${dealConcurrent}/decline`) && r.request().method() === "POST", { timeout: 30_000 });
    await fenetre.getByRole("button", { name: "Refuser le Deal" }).click();
    const r = await reponse;
    expect(r.status(), "le serveur refuse la seconde décision").toBe(409);
    await expect(onglet2.getByText("Ce deal a changé entre-temps. La page vient d'être actualisée.").last()).toBeVisible({ timeout: 15_000 });
    await expect(onglet2.getByText("Tu es engagé sur ce Deal"), "l'onglet 2 se relit sur l'état réel").toBeVisible({ timeout: 30_000 });
    expect(await dealBrut(contexte, dealConcurrent)).toMatch(/"status":"ACCEPTED"/);
    const finances = new Finances(aminata.page);
    await finances.ouvrir("Paiements");
    expect(await finances.lignePaiement(dealConcurrent), "un seul débit, bloqué chez Yamba").toContain("Bloqué chez Yamba");
    await onglet2.close();
  });

  test("WEB-DEA-8 · les états fermés du deal : un bandeau, aucune action", async ({ navigateurConnecte, jeuEssai }) => {
    const { page } = await navigateurConnecte("thomas");
    for (const [cle, bandeau] of [["bzv-declined", "Tu as refusé cette demande"], ["bzv-expired", "Cette demande a expiré"], ["bzv-cancelled", "Cette demande a été annulée"]] as const) {
      await ouvrirDeal(page, jeuEssai.deal(cle).id);
      await expect(page.getByText(bandeau).first(), cle).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("Il n'y a plus d'action à faire ici.").first()).toBeVisible();
      expect(await page.getByRole("button", { name: /Accepter et confirmer|^Refuser$|Confirmer la prise en charge/ }).count(), `${cle} : aucun bouton d'action`).toBe(0);
    }
  });

  test("WEB-DEA-9 · « Mon Deal accepté » en détail — le code de livraison n'apparaît nulle part", async ({ navigateurConnecte }) => {
    const { page, contexte } = await navigateurConnecte("thomas");
    await ouvrirDeal(page, dealId);
    const corps = await texte(page);
    for (const bloc of ["DÉTAILS DU DEAL", "EXPÉDITEUR", "CONTENU DÉCLARÉ", "LIVRAISON À", "Comment ça va se passer ?", "TON PAIEMENT", "Le jour J : la prise en charge"]) {
      expect(corps, bloc).toContain(bloc);
    }
    expect(corps).toMatch(/PICKUP — CHOISI PAR Aminata/i); // écrit en capitales par le style
    // ANO-WEB-42 (suite) : la ville de livraison n'est pas répétée (« Hall d'arrivée · Brazzaville », pas « … · Brazzaville · Brazzaville »).
    expect(corps).not.toContain("Brazzaville · Brazzaville");
    // ANO-WEB-44 : le destinataire est nommé par son prénom (Clarisse), plus par le premier mot du lieu (« Hall »).
    expect(corps).not.toMatch(/révèle à Hall|rencontres Hall/);
    expect(corps).toContain("Le code reste secret. Tu ne vois pas le code de livraison. Aminata le révèle à Clarisse quand tu confirmes le pickup.");
    expect(corps).toContain("Le versement part après la période de vérification de l'Expéditeur, puis arrive sur ton compte bancaire sous 2 à 7 jours.");
    await expect(page.getByRole("button", { name: "Confirmer la prise en charge" }).or(page.getByRole("link", { name: "Confirmer la prise en charge" })).first()).toBeVisible();
    // Le code de livraison (six chiffres) n'apparaît ni à l'écran, ni dans le DTO du Voyageur.
    expect(corps, "aucune suite de six chiffres à l'écran").not.toMatch(/(?<!\d)\d{6}(?!\d)/);
    const brut = await dealBrut(contexte, dealId);
    expect(brut, "le DTO Voyageur ne porte aucun code").not.toMatch(/deliveryCode|"code":"\d{6}"/);
  });
});
