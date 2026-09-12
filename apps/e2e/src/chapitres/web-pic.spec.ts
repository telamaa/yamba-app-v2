/**
 * web-pic.spec.ts — cahier 01-WEB, chapitre 5.16 « Prise en charge et jalons de transit »
 * =======================================================================================
 * L'écran de prise en charge du Voyageur (la déclaration à comparer, cinq points à cocher, au moins
 * une photo, une note), ses refus (points manquants, photo manquante, photo trop lourde, téléversement
 * en échec — rien n'est enregistré), la confirmation (le code naît côté Expéditrice, jamais dans
 * l'email ni côté Voyageur, le téléphone du destinataire s'ouvre), le refus du colis (cinq raisons
 * fermées, remboursement intégral, kilos rendus, aucune pénalité), puis l'écran de transit : une seule
 * carte d'action, les trois jalons ordonnés et non répétables, les cinq secondes de repentir, et ce
 * que l'Expéditrice en voit (bannière et cloche à chaque jalon, email au seul atterrissage).
 *
 * Deals : `bzv-accepted` (Pauline ↔ Thomas) pour la prise en charge et le transit ; `yul-accepted`
 * (Marie-Claire ↔ Marc) pour le refus. ImageKit intercepté (aucun envoi réel) ; deal-service en FAKE.
 */
import { test, expect, type Navigateur } from "../fixtures/yamba";
import { adresseDeLApi } from "../fixtures/adresses";
import { COMPTES } from "../fixtures/comptes";
import { JeuEssai } from "../fixtures/jeu-essai";
import { intercepterImageKit, photo } from "../fixtures/photos";
import { TransportVoyageur } from "../pages/transport-voyageur";
import { SuiviExpediteur } from "../pages/suivi-expediteur";
import { kilosRestants } from "../pages/mes-trajets";
import { normaliserEspaces } from "../pages/reservation";

type Contexte = Navigateur["contexte"];
type Page = Navigateur["page"];
const api = () => adresseDeLApi();

/* ══ Le cahier ═══════════════════════════════════════════════════════════════════════════════ */

const POINTS = (prenom: string, poids: number) => [
  `Le contenu correspond à ce que ${prenom} a déclaré`, // ANO-WEB-49 : « que Pauline », « qu'Aminata »
  `Le poids me semble correspondre à la déclaration (${poids} kg)`,
  "Aucun produit interdit n'est présent (armes, drogues, contrefaçons, etc.)",
  "L'emballage est correct et le colis peut voyager sans risque",
  "J'ai vu et identifié chaque article du colis",
];
const RAISONS_REFUS = ["Le contenu ne correspond pas à la déclaration", "Contenu suspect ou interdit", "Poids ou volume trop important", "Emballage inadapté au transport", "Autre raison"];

/* ══ L'état partagé (mode série) ═════════════════════════════════════════════════════════════ */

/** bzv-accepted (Pauline ↔ Thomas) : pris en charge en fiche 5, en transit ensuite. */
let dealId = "";
let codeDeLivraison = "";

/* ══ Aides ═══════════════════════════════════════════════════════════════════════════════════ */

const texte = async (page: Page) => normaliserEspaces(await page.locator("body").innerText());
async function ouvrirPriseEnCharge(page: Page, id: string): Promise<void> {
  await intercepterImageKit(page);
  await page.goto(`/fr/carrier/deals/${id}/pickup`, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Prise en charge du colis" })).toBeVisible({ timeout: 60_000 });
}
const point = (page: Page, libelle: string) => page.getByRole("button", { name: libelle });
const confirmer = (page: Page) => page.getByRole("button", { name: "Confirmer la prise en charge" });
async function dealBrut(contexte: Contexte, id: string): Promise<string> {
  const r = await contexte.request.get(`${api()}/deals/${id}`);
  expect(r.ok(), `GET /deals/${id}`).toBe(true);
  return r.text();
}
async function profilPublic(contexte: Contexte, slug: string): Promise<string> {
  const r = await contexte.request.get(`${api()}/users/${slug}/public`);
  expect(r.ok(), `GET /users/${slug}/public`).toBe(true);
  return r.text();
}

/* ══ Les fiches ══════════════════════════════════════════════════════════════════════════════ */

test.describe("WEB-PIC — prise en charge et jalons de transit (chapitre 5.16)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(() => {
    new JeuEssai().rejouer();
  });

  test("WEB-PIC-1 · l'écran « Prise en charge du colis »", async ({ navigateurConnecte, jeuEssai }) => {
    dealId = jeuEssai.deal("bzv-accepted").id;
    const { page } = await navigateurConnecte("thomas");
    await page.goto(`/fr/carrier/deals/${dealId}`, { waitUntil: "networkidle" });
    await expect(page.getByText("Tu es engagé sur ce Deal")).toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: "Confirmer la prise en charge" }).or(page.getByRole("link", { name: "Confirmer la prise en charge" })).first().click();
    await expect(page).toHaveURL(new RegExp(`/fr/carrier/deals/${dealId}/pickup$`), { timeout: 60_000 });
    await expect(page.getByRole("heading", { name: "Prise en charge du colis" })).toBeVisible({ timeout: 60_000 });
    const corps = await texte(page);
    // Sur écran large, le sous-titre est « {lieu} · le {date} · {heure} · face à {prénom} {initiale}. » ; la phrase du cahier est celle du mobile.
    expect(corps).toMatch(/Paris · le \d{1,2} [a-zéû]+\.? · \d{1,2}h\d{2} · face à Pauline L\./);
    test.info().annotations.push({ type: "constat", description: "sous-titre sur écran large : « Paris · le 21 sept. · 16h00 · face à Pauline L. » — « Vérifie le contenu visuellement, prends tes photos, puis confirme. » est le sous-titre MOBILE" });
    expect(corps).toContain("Vérifie attentivement avant de confirmer");
    expect(corps).toContain("Une fois la prise en charge confirmée, tu es responsable du colis et engagé sur le transport. Si quelque chose ne va pas, refuse plutôt que d'accepter.");
    // La référence de comparaison : ce que Pauline a déclaré (catégorie, poids, valeur).
    // ANO-WEB-49 : « Ce que Pauline a déclaré » (plus « qu'Pauline »), « la déclaration de Pauline » (plus « d'Pauline »).
    expect(corps).toMatch(/Ce que Pauline a déclaré/i);
    expect(corps).toContain("Compare le colis avec la déclaration de Pauline (à droite), puis confirme.");
    expect(corps).not.toMatch(/qu'Pauline|d'Pauline/i);
    expect(corps).toMatch(/Catégorie\s*Vêtements/i); // libellés en capitales par le style
    expect(corps).toMatch(/Poids\s*5 kg/i);
    expect(corps).toMatch(/Valeur\s*120 €/i);
    // ANO-WEB-50 : le destinataire est nommé (« la remise à Clarisse »), plus le premier mot du lieu (« Brazzaville »).
    expect(corps).toContain("Tu deviens officiellement responsable du colis jusqu'à la remise à Clarisse.");
    expect(corps).toContain("CONFIRMATION");
    expect(corps).toContain("Vérification");
    expect(corps).toContain("Photos");
    await expect(confirmer(page)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Refuser( le colis)?$/ }).first()).toBeVisible();
  });

  test("WEB-PIC-2 · la checklist en cinq points, et ce qui manque", async ({ navigateurConnecte }) => {
    const { page } = await navigateurConnecte("thomas");
    await ouvrirPriseEnCharge(page, dealId);
    const corps = await texte(page);
    expect(corps).toContain("Coche chaque point après vérification physique");
    const points = POINTS("Pauline", 5);
    for (const p of points) await expect(point(page, p), p).toBeVisible();
    expect(await page.locator("button[aria-pressed]").count(), "exactement cinq points").toBe(5);
    for (const p of points.slice(0, 3)) {
      await point(page, p).click();
      await expect(point(page, p)).toHaveAttribute("aria-pressed", "true");
    }
    await expect(page.getByText("3/5")).toBeVisible();
    await expect(confirmer(page), "trois points sur cinq : le bouton reste inactif").toBeDisabled();
    await expect(page.getByText("Coche les 5 points de vérification avant de confirmer")).toBeVisible();
  });

  test("WEB-PIC-3 · les photos sont obligatoires", async ({ navigateurConnecte }) => {
    const { page } = await navigateurConnecte("thomas");
    await ouvrirPriseEnCharge(page, dealId);
    for (const p of POINTS("Pauline", 5)) await point(page, p).click();
    await expect(page.getByText("5/5")).toBeVisible();
    await expect(confirmer(page), "cinq points, aucune photo : le bouton reste inactif").toBeDisabled();
    await expect(page.getByText("Ajoute au moins 1 photo avant de confirmer")).toBeVisible();
    await expect(page.getByText("Au moins 1 obligatoire")).toBeVisible();
    await expect(page.getByText("Recommandé : 1 photo du contenu déballé et 1 photo du colis emballé prêt au transport.")).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles(photo("contenu"));
    await expect(page.getByRole("button", { name: "Retirer cette photo" })).toHaveCount(1, { timeout: 30_000 });
    await expect(confirmer(page), "une photo : la confirmation devient possible").toBeEnabled({ timeout: 30_000 });
  });

  test("WEB-PIC-4 · l'échec d'un téléversement n'envoie rien", async ({ navigateurConnecte, jeuEssai }) => {
    const { page, contexte } = await navigateurConnecte("thomas");
    await ouvrirPriseEnCharge(page, dealId);
    for (const p of POINTS("Pauline", 5)) await point(page, p).click();
    const envois: string[] = [];
    page.on("request", (r) => { if (/\/deals\/[^/]+\/pickup$/.test(r.url()) && r.method() === "POST") envois.push(r.url()); });
    /* Étape 1 — plus de 10 Mo : refusée à la sélection, rien n'est envoyé. */
    const gros = photo("trop-lourde");
    gros.buffer = Buffer.concat([gros.buffer, Buffer.alloc(10 * 1024 * 1024, 0)]);
    await page.locator('input[type="file"]').setInputFiles(gros);
    await expect(page.getByText("Une photo dépasse 10 Mo. Réduis-la ou choisis-en une autre — rien n'a été envoyé.")).toBeVisible({ timeout: 15_000 });
    expect(await page.getByRole("button", { name: "Retirer cette photo" }).count()).toBe(0);
    /* Étape 2 — le réseau coupé : les photos ne partent qu'à la confirmation (écart d'implémentation, même intention),
       l'échec du téléversement arrête tout avant l'appel de prise en charge. */
    await page.route("https://upload.imagekit.io/**", (route) => route.abort("connectionfailed"));
    await page.locator('input[type="file"]').setInputFiles(photo("reseau"));
    await expect(page.getByRole("button", { name: "Retirer cette photo" })).toHaveCount(1, { timeout: 15_000 });
    await expect(confirmer(page)).toBeEnabled();
    await confirmer(page).click();
    await expect(page.getByText("Le téléversement d'une photo a échoué. Vérifie ta connexion et réessaye — rien n'a été envoyé.")).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1_000);
    expect(envois, "aucune prise en charge envoyée").toEqual([]);
    test.info().annotations.push({ type: "constat", description: "les photos de prise en charge partent à la CONFIRMATION (pas à l'ajout) : l'échec réseau se voit au clic « Confirmer », et rien n'est enregistré" });
    expect(await dealBrut(contexte, jeuEssai.deal("bzv-accepted").id)).toMatch(/"status":"ACCEPTED"/);
  });

  test("WEB-PIC-5 · confirmer la prise en charge : le code naît chez Pauline, jamais dans l'email ni côté Voyageur", async ({ navigateurConnecte, mailpit }) => {
    test.setTimeout(4 * 60_000);
    await mailpit.vider();
    const { page } = await navigateurConnecte("thomas");
    const transport = new TransportVoyageur(page);
    // Les deux photos portent les tags « Contenu » puis « Emballé » (vérifiés avant la confirmation).
    await ouvrirPriseEnCharge(page, dealId);
    const fichier = page.locator('input[type="file"]');
    await fichier.setInputFiles(photo("contenu"));
    await fichier.setInputFiles(photo("emballe"));
    await expect(page.getByRole("button", { name: "Retirer cette photo" })).toHaveCount(2, { timeout: 30_000 });
    await expect(page.getByText("Contenu", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Emballé", { exact: true }).first()).toBeVisible();
    const toast = await transport.prendreEnCharge(dealId, { nbPhotos: 2, note: "Colis fermé, emballage intact, remis au terminal 2E." });
    expect(toast).toBe("Prise en charge confirmée ! Pauline a reçu son code de livraison.");
    await expect(page).toHaveURL(new RegExp(`/fr/carrier/deals/${dealId}$`));
    await expect(page.getByText("En transit vers Brazzaville")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Clarisse Mabiala · Destinataire")).toBeVisible();
    await transport.numeroDuDestinataireVisible("+242");
    const coteVoyageur = await texte(page);

    /* Vérification complémentaire — Pauline : notification, email sans le code, le code dans son suivi. */
    const A = await navigateurConnecte("pauline");
    await A.page.goto("/fr/dashboard/notifications", { waitUntil: "networkidle" });
    await expect(A.page.getByText("Thomas a pris ton colis en charge").first()).toBeVisible({ timeout: 60_000 });
    expect(await texte(A.page)).toContain("ton code de livraison est prêt dans ton suivi");
    const email = await mailpit.attendreEmail({ pour: COMPTES.pauline.email, sujet: /est pris en charge/ });
    const suivi = new SuiviExpediteur(A.page);
    await suivi.ouvrir(dealId);
    codeDeLivraison = await suivi.lireLeCode();
    expect(codeDeLivraison).toMatch(/^\d{6}$/);
    expect(email.texte + email.html, "l'email ne contient pas le code").not.toContain(codeDeLivraison);
    expect(email.texte + email.html, "l'email renvoie au suivi").toMatch(/suivi/i);
    expect(coteVoyageur, "le code n'apparaît jamais côté Voyageur").not.toContain(codeDeLivraison);
    expect(coteVoyageur).not.toContain(codeDeLivraison.replace(/(\d{3})(\d{3})/, "$1 $2"));
    test.info().annotations.push({ type: "note", description: `code de livraison ${codeDeLivraison} lu dans le suivi de Pauline ; email « ${email.sujet} »` });
  });

  test("WEB-PIC-6 · refuser le colis : cinq raisons, remboursement intégral, kilos rendus, aucune pénalité", async ({ navigateurConnecte, jeuEssai, mailpit }) => {
    test.setTimeout(4 * 60_000);
    await mailpit.vider();
    const refus = jeuEssai.deal("yul-accepted");
    const trajet = jeuEssai.trajet("yul");
    const mc = await navigateurConnecte("marieclaire");
    const total = Number(/"totalShipperCents":(\d+)/.exec(await dealBrut(mc.contexte, refus.id))?.[1]);
    expect(total).toBeGreaterThan(0);
    const { page, contexte } = await navigateurConnecte("marc");
    const kgAvant = await kilosRestants(contexte, trajet);
    const profilAvant = await profilPublic(contexte, "seed-marc");

    await ouvrirPriseEnCharge(page, refus.id);
    await page.getByRole("button", { name: /^Refuser( le colis)?$/ }).first().click();
    const fenetre = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Refuser ce colis ?" }) });
    await expect(fenetre).toBeVisible({ timeout: 15_000 });
    const contenu = normaliserEspaces(await fenetre.innerText());
    expect(contenu).toContain("Le Deal sera annulé et Marie-Claire intégralement remboursée. Refuser un colis non conforme ne pénalise jamais ta réputation.");
    for (const r of RAISONS_REFUS) expect(contenu, r).toContain(r);
    expect(await fenetre.getByRole("radio").count(), "exactement cinq raisons").toBe(5);
    expect(await fenetre.locator("textarea, input[type=text]").count(), "aucun champ de texte libre").toBe(0);
    await fenetre.getByRole("button", { name: "Annuler", exact: true }).last().click(); // la croix porte aussi « Annuler » en aria-label

    const transport = new TransportVoyageur(page);
    const resultat = await transport.refuserLeColis(refus.id, RAISONS_REFUS[0]);
    expect(resultat.toast).toBe("Colis refusé. Marie-Claire a été notifiée et sera remboursée.");
    expect(resultat.status).toBe("CANCELLED");
    expect(resultat.refundAmountCents, "le remboursement est intégral").toBe(total);

    /* Vérification complémentaire — deux emails, les kilos, aucune pénalité. */
    const refusMail = await mailpit.attendreEmail({ pour: COMPTES.marieclaire.email, sujet: /n'a pas pu être pris en charge/ });
    const raison = /Raison[^:]*:\s*([^\n·<]+)/.exec(refusMail.texte)?.[1]?.trim();
    expect(raison, "l'email porte la raison traduite").toBeTruthy();
    const remboursement = await mailpit.attendreEmail({ pour: COMPTES.marieclaire.email, sujet: /Remboursement émis/ });
    const euros = `${Math.floor(total / 100)},${String(total % 100).padStart(2, "0")}`;
    expect(normaliserEspaces(remboursement.texte + remboursement.html), `le montant intégral ${euros} €`).toContain(euros);
    expect(await kilosRestants(contexte, trajet), "les kilos sont rendus au trajet").toBe(kgAvant + 7);
    expect(await profilPublic(contexte, "seed-marc"), "aucune pénalité : le profil public de Marc est inchangé").toBe(profilAvant);
    test.info().annotations.push({ type: "note", description: `remboursement ${euros} € ; email de refus : « Raison : ${raison} »` });
  });

  test("WEB-PIC-7 · l'écran de transit et sa carte d'action unique", async ({ navigateurConnecte }) => {
    const { page } = await navigateurConnecte("thomas");
    await page.goto(`/fr/carrier/deals/${dealId}`, { waitUntil: "networkidle" });
    await expect(page.getByText("En transit vers Brazzaville")).toBeVisible({ timeout: 60_000 });
    const corps = await texte(page);
    expect(corps).toMatch(/Colis pris en charge il y a .+ · vol prévu à \d{1,2}[:h]\d{2}/);
    // Une seule carte d'action : le prochain jalon logique.
    expect(corps).toContain("Tu es à l'aéroport ?");
    await expect(page.getByRole("button", { name: "Je suis à l'aéroport" })).toBeVisible();
    expect(await page.getByRole("button", { name: /^(L'avion décolle|J'ai atterri|Valider la livraison)$/ }).count(), "les autres jalons ne sont pas proposés").toBe(0);
    expect(corps).toContain("ÉTAPES DU VOYAGE");
    expect(corps).toContain("Optionnel");
    expect(corps).toContain("Clarisse Mabiala · Destinataire");
    // La carte du destinataire : le VRAI numéro, en bouton (« +242061234567 »), et « WhatsApp ».
    await expect(page.getByRole("button", { name: "+242061234567" })).toBeVisible();
    await expect(page.getByRole("button", { name: "WhatsApp" })).toBeVisible();
    test.info().annotations.push({ type: "constat", description: "carte du destinataire : le bouton d'appel porte le numéro lui-même (« +242061234567 »), pas le libellé « Appeler » du cahier ; « WhatsApp » conforme" });
    expect(corps).toContain("TON PAIEMENT");
    expect(corps).toMatch(/Versé à\s*J\+4 après livraison/);
  });

  test("WEB-PIC-8, 9, 10 · les jalons : cinq secondes de repentir, ordonnés et non répétables ; l'Expéditrice les voit, un seul email", async ({ navigateurConnecte, mailpit }) => {
    test.setTimeout(6 * 60_000);
    await mailpit.vider();
    const B = await navigateurConnecte("thomas");
    const A = await navigateurConnecte("pauline");
    const transport = new TransportVoyageur(B.page);
    await transport.ouvrirSuivi(dealId);

    /* PIC-9 — « Annuler » avant la fin du décompte : rien n'est envoyé. */
    const envois: string[] = [];
    B.page.on("request", (r) => { if (/\/deals\/[^/]+\/events$/.test(r.url()) && r.method() === "POST") envois.push(r.url()); });
    await B.page.getByRole("button", { name: "Je suis à l'aéroport" }).click();
    await B.page.getByRole("button", { name: "Annuler", exact: true }).last().click();
    await expect(B.page.getByText("Annulé, rien n'a été envoyé.").last()).toBeVisible({ timeout: 10_000 });
    await B.page.waitForTimeout(6_000);
    expect(envois, "le jalon annulé n'est pas parti").toEqual([]);
    await expect(B.page.getByRole("button", { name: "Je suis à l'aéroport" }), "le jalon est de nouveau proposé").toBeVisible();

    const suiviA = async (attendu: RegExp[]) => {
      await A.page.goto(`/fr/bookings/${dealId}`, { waitUntil: "networkidle" });
      const corps = await texte(A.page);
      for (const a of attendu) expect(corps, String(a)).toMatch(a);
      // ANO-WEB-54 : aucune clé i18n brute (« bookingTracker.trackingLink.subtitle ») sur le suivi.
      expect(corps, "aucune clé i18n brute").not.toMatch(/bookingTracker\./);
      return corps;
    };
    const cloche = async (attendu: string) => {
      await A.page.goto("/fr/dashboard/notifications", { waitUntil: "networkidle" });
      await expect(A.page.getByText(attendu).first()).toBeVisible({ timeout: 60_000 });
    };

    /* PIC-8 (1) + PIC-10 — aéroport : bannière, cloche, aucun email. */
    await transport.confirmerJalon("Je suis à l'aéroport");
    await expect(B.page.getByText("Ton vol décolle ?")).toBeVisible({ timeout: 30_000 });
    await suiviA([/Thomas est à l'aéroport/, /Prêt à embarquer · vol prévu à \d{1,2}[:h]\d{2}/]);
    await cloche("Thomas est à l'aéroport");
    await mailpit.aucunEmailPour(COMPTES.pauline.email, 4_000);

    /* PIC-8 (2) — décollage : bannière, cloche, aucun email. */
    await transport.confirmerJalon("L'avion décolle");
    await expect(B.page.getByText("Tu as atterri ?")).toBeVisible({ timeout: 30_000 });
    const enVol = await suiviA([/En vol vers Brazzaville/, /Thomas a décollé à \d{1,2}[:h]\d{2} · arrivée prévue à (\d{1,2}[:h]\d{2}|—)/]);
    if (/arrivée prévue à —/.test(enVol)) test.info().annotations.push({ type: "constat", description: "« arrivée prévue à — » et « vol de — » : l'instantané du trajet dans la réservation ne porte pas l'heure d'arrivée (ANO-WEB-53, ouverte)" });
    await cloche("Vol décollé · Thomas est en route");
    await mailpit.aucunEmailPour(COMPTES.pauline.email, 4_000);

    /* PIC-8 (3) — atterrissage : bannière, cloche, UN email. */
    await transport.confirmerJalon("J'ai atterri");
    await expect(B.page.getByText("Clarisse t'a donné le code ?")).toBeVisible({ timeout: 30_000 });
    await expect(B.page.getByRole("button", { name: "Valider la livraison" })).toBeVisible();
    await suiviA([/Thomas est arrivé à Brazzaville/, /Atterri à \d{1,2}[:h]\d{2} · la remise à Clarisse approche/]);
    await cloche("Thomas a atterri · préviens le destinataire");
    const email = await mailpit.attendreEmail({ pour: COMPTES.pauline.email, sujet: /a atterri/ });
    expect(email.sujet).toMatch(/Thomas a atterri/);
    expect(await mailpit.compter({ pour: COMPTES.pauline.email }), "un seul email pour les trois jalons").toBe(1);
    expect(email.texte + email.html, "l'email d'atterrissage ne contient pas le code").not.toContain(codeDeLivraison);

    /* PIC-8 (4) — après rechargement, aucun jalon passé n'est proposé de nouveau. */
    await B.page.reload({ waitUntil: "networkidle" });
    await expect(B.page.getByText("Clarisse t'a donné le code ?")).toBeVisible({ timeout: 60_000 });
    expect(await B.page.getByRole("button", { name: /^(Je suis à l'aéroport|L'avion décolle|J'ai atterri)$/ }).count(), "un jalon confirmé n'est plus proposé").toBe(0);
    expect(await texte(B.page), "aucune dé-confirmation").not.toMatch(/Annuler le jalon|Retirer le jalon/);
  });
});
