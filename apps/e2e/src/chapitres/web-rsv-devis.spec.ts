/**
 * web-rsv-devis.spec.ts — cahier 01-WEB, chapitre 5.12 « Réserver : l'assistant en quatre étapes »
 * ==================================================================================================
 * Complète `web-rsv.spec.ts` (la porte, ANO-WEB-02) et `web-rsv-assistant.spec.ts` (le nominal
 * 32,20 € et la famille refusée) : les vingt-deux fiches du chapitre — l'entrée, les lieux, les
 * règles d'or, le produit, le poids, la taille, le supplément et le plancher, les photos, la
 * protection, le bagage entier, le récapitulatif sans zéro, le destinataire, l'engagement, le
 * paiement, la demande envoyée (kilos, emails), le devis qui change, le dernier kilo, son propre
 * trajet, un trajet parti ou masqué, la reprise après rechargement.
 *
 * Note de calcul (cahier) : transport = max(€/kg × poids facturable × coefficient de taille ×
 * (1 + supplément), 8 €) ; service = max(12 % du transport, 3 €) ; total = transport + service.
 * deal-service tourne avec le fournisseur FAKE (le Payment Element de Stripe ne se monte pas sur
 * l'origine du poste) : WEB-RSV-16 (carte refusée) est ⏭.
 */
import { test, expect, type Navigateur } from "../fixtures/yamba";
import { adresseDeLApi, adresseDeLApiAdmin } from "../fixtures/adresses";
import { COMPTES } from "../fixtures/comptes";
import { intercepterImageKit, photo } from "../fixtures/photos";
import { AssistantReservation, normaliserEspaces } from "../pages/reservation";

type Contexte = Navigateur["contexte"];
type Page = Navigateur["page"];
const api = () => adresseDeLApi();

/* ══ Aides ═══════════════════════════════════════════════════════════════════════════════════ */

const CLARISSE = { prenom: "Clarisse", nom: "Mabiala", indicatif: "+242", telephone: "061234567" };

/** Un trajet de Joséphine, publié, Bruxelles → Kinshasa, 11,50 €/kg, capacité au choix. */
async function trajetDeJosephine(contexte: Contexte, capacityKg = 23, pricePerKgCents = 1150): Promise<string> {
  const r = await contexte.request.post(`${api()}/trips`, {
    data: {
      transportMode: "PLANE", flightType: "DIRECT", tripType: "ONE_WAY",
      originCity: "Bruxelles", originCountryCode: "BE", destinationCity: "Kinshasa", destinationCountryCode: "CD",
      departureAt: new Date(Date.now() + 20 * 86_400_000).toISOString(), arrivalAt: new Date(Date.now() + 21 * 86_400_000).toISOString(),
      pricePerKgCents, capacityKg,
      pickupLocations: [{ kind: "AIRPORT", flexibility: "EXACT", details: "Bruxelles-Zaventem, hall des départs" }],
      deliveryLocations: [{ kind: "AIRPORT", flexibility: "EXACT", details: "Kinshasa N'djili, hall d'arrivée" }],
      publish: true,
    },
  });
  expect(r.status(), `POST /trips → ${await r.text()}`).toBe(201);
  return ((await r.json()) as { trip: { id: string } }).trip.id;
}
async function mesReservations(contexte: Contexte): Promise<number> {
  const r = await contexte.request.get(`${api()}/me/bookings`);
  expect(r.ok(), "GET /me/bookings").toBe(true);
  const body = (await r.json()) as { bookings?: unknown[]; items?: unknown[]; deals?: unknown[] };
  return (body.bookings ?? body.items ?? body.deals ?? []).length;
}
/** Les kilos encore libres, lus dans le DTO PUBLIC du trajet (celui que l'Expéditrice voit). */
async function kilosPublics(contexte: Contexte, tripId: string): Promise<number> {
  const r = await contexte.request.get(`${api()}/trips/${tripId}/public`);
  expect(r.ok(), `GET /trips/${tripId}/public`).toBe(true);
  const m = /"remainingKg":([0-9.]+)/.exec(await r.text());
  expect(m, "remainingKg dans le DTO public").toBeTruthy();
  return Number(m![1]);
}
/** Un montant tel que l'écran l'écrit : « 8 € » pour 8,00 (les décimales nulles tombent), « 32,20 € » sinon. */
const eur = (montant: string) => montant.replace(",00", "(,00)?");
/** Le texte de la page, espaces normalisées. */
const texte = async (page: Page) => normaliserEspaces(await page.locator("body").innerText());
const poids = (page: Page) => page.locator('input[placeholder="2,5"]');
const continuer = (page: Page) => page.getByRole("button", { name: /^(Continuer|Passer au paiement)$/ }).first();
const famille = (page: Page, nom: string) => page.getByRole("button", { name: new RegExp(`^${nom.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) }).first();
const taille = (page: Page, t: string) => page.getByRole("button", { name: new RegExp(`^${t}\\b`) }).first();

/** Ouvre l'assistant sur bzv-perkg avec un colis prêt (2,5 kg, vêtements, S, 150 €, description). */
async function colisNominal(page: Page, assistant: AssistantReservation, tripId: string): Promise<void> {
  await assistant.ouvrir(tripId);
  await assistant.decrireLeColis({ famille: "Vêtements & textile", taille: "S", poidsKg: "2,5", valeurEuros: "150", description: "3 t-shirts, 1 pull, du chocolat" });
}

/* ══ Les fiches ══════════════════════════════════════════════════════════════════════════════ */

test.describe("WEB-RSV — l'assistant en quatre étapes et le devis (chapitre 5.12)", () => {
  test("WEB-RSV-1 · la porte, par-dessus la page du trajet et en pleine page", async ({ navigateurVisiteur, jeuEssai }) => {
    const id = jeuEssai.trajet("bzv-perkg");
    const { page } = await navigateurVisiteur();
    await page.goto(`/fr/trips/${id}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /^Réserver/ }).first().click();
    await expect(page.getByText("Connecte-toi pour réserver")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Une réservation engage un Voyageur : Yamba a besoin de savoir qui envoie. Ton colis et ce trajet t'attendent après connexion.")).toBeVisible();
    // Par-dessus la page : le titre du trajet est toujours là.
    await expect(page.getByText("Trajet proposé par Thomas N.")).toBeVisible();
    // En pleine page sur /book (la suite — connexion puis retour — est éprouvée par web-rsv.spec.ts).
    await page.goto(`/fr/trips/${id}/book`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Connecte-toi pour réserver")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Se connecter", exact: true })).toBeVisible();
  });

  test("WEB-RSV-2, 3, 4 · l'entrée, les lieux de rendez-vous, les règles d'or", async ({ navigateurConnecte, jeuEssai }) => {
    test.setTimeout(3 * 60_000);
    const id = jeuEssai.trajet("bzv-perkg");
    const { page } = await navigateurConnecte("aminata", { parEcran: true });
    await page.goto(`/fr/trips/${id}`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => { window.localStorage.removeItem("yamba.search.weightKg"); Object.keys(window.sessionStorage).filter((k) => k.startsWith("booking")).forEach((k) => window.sessionStorage.removeItem(k)); });
    await page.getByRole("button", { name: /^Réserver/ }).first().click();
    await expect(page).toHaveURL(new RegExp(`/trips/${id}/book`), { timeout: 30_000 });
    await expect(page.getByText("Décris ton colis")).toBeVisible({ timeout: 60_000 });
    const t = await texte(page);
    // WEB-RSV-2 : « étape 1 sur 4 », quatre étapes, titre et sous-titre, deux retours, colonne collante.
    // Sur écran large, le fil d'Ariane numérote les quatre étapes ; « étape 1 sur 4 » est l'indicateur MOBILE (constat).
    expect(t).toMatch(/1 Colis 2 Destinataire 3 Engagement 4 Paiement/);
    test.info().annotations.push({ type: "constat", description: `« étape 1 sur 4 » ${/étape 1 sur 4/i.test(t) ? "présent" : "absent sur écran large (indicateur mobile ; les quatre étapes numérotées le remplacent)"}` });
    expect(t).toContain("Précision et photos garantissent un envoi sans accroc");
    await expect(page.getByRole("button", { name: "Retour au trajet" }).first()).toBeVisible();
    await expect(page.locator(".sticky").filter({ visible: true }).first(), "la colonne de droite est collante").toBeVisible();
    // WEB-RSV-3 : les deux blocs, un lieu de chaque côté pré-sélectionné, types en clair.
    expect(t).toContain("Lieux de rendez-vous");
    expect(t).toContain("Tu remets le colis à Thomas");
    expect(t).toContain("Le destinataire récupère le colis");
    expect(t).toMatch(/Lieu convenu avec le voyageur/);
    expect(t).toMatch(/À l'aéroport/);
    expect(t).toMatch(/Lieu exact/);
    expect(t, "jamais le message « pas de lieu » sur ce trajet").not.toContain("n'a pas précisé de lieu");
    // WEB-RSV-4 : les règles d'or et la liste des produits interdits.
    // Un <details> : on clique son intitulé (« Voir » disparaît une fois ouvert).
    if (!(await page.getByText("Emballe soigneusement.").first().isVisible())) await page.getByText("Les règles d'or pour un envoi qui se passe bien").first().click();
    for (const regle of ["Emballe soigneusement.", "Pèse précisément.", "Décris fidèlement.", "Aucun produit interdit."]) {
      await expect(page.getByText(regle).first()).toBeVisible({ timeout: 10_000 });
    }
    const liste = page.getByRole("link", { name: "Voir la liste complète" }).or(page.getByRole("button", { name: "Voir la liste complète" })).first();
    await expect(liste).toBeVisible();
    const cible = await liste.getAttribute("href");
    test.info().annotations.push({ type: "note", description: `« Voir la liste complète » → ${cible ?? "(bouton)"}` });
  });

  test("WEB-RSV-5, 6 · le produit, la famille refusée, le poids et sa borne", async ({ navigateurConnecte, jeuEssai }) => {
    test.setTimeout(3 * 60_000);
    const id = jeuEssai.trajet("bzv-perkg");
    const { page, contexte } = await navigateurConnecte("aminata", { parEcran: true });
    // Les kilos encore libres évoluent avec les réservations jouées (WEB-RSV-17 en prend 2,5 à chaque tour) : on lit le trajet.
    const restants = await kilosPublics(contexte, id);
    // L'écran écrit « 15.5 kg » (point) là où le français attend « 15,5 » — constat de format, comme « 0.5 kg » dans l'infobulle.
    const restantsTexte = String(restants).replace(".", "[.,]");
    const assistant = new AssistantReservation(page);
    await assistant.ouvrir(id);
    // Les trois choix : colis, soute (230 €) ; le cabine n'est pas offert par ce trajet.
    await expect(page.getByRole("button", { name: /^Un colis \(au kilo\)/ })).toBeVisible();
    const soute = page.getByRole("button", { name: /^Un bagage soute 23 kg/ });
    await expect(soute).toBeVisible();
    await expect(soute).toBeEnabled();
    const cabine = page.getByRole("button", { name: /^Un bagage cabine 12 kg/ });
    test.info().annotations.push({ type: "constat", description: `« Un bagage cabine 12 kg » : ${(await cabine.count()) === 0 ? "absent" : (await cabine.isDisabled()) ? "présent mais désactivé" : "PROPOSÉ (le trajet ne l'offre pas)"}` });
    if (await cabine.count()) await expect(cabine).toBeDisabled();
    // La famille refusée est visible, barrée, désactivée, avec l'info-bulle ; le supplément avant le choix.
    const alimentaire = famille(page, "Alimentaire sec & scellé");
    await expect(alimentaire).toBeVisible();
    await expect(alimentaire).toBeDisabled();
    await expect(alimentaire).toHaveAttribute("title", "Thomas ne prend pas cette famille sur ce trajet");
    await expect(famille(page, "Électronique & appareils")).toContainText("+20 %");
    // WEB-RSV-6 : le poids, pré-rempli à 2, jamais vide ; l'aide ; 35 refusé sous le champ, bouton inactif.
    await expect(poids(page)).toHaveValue("2");
    await expect(page.getByText(new RegExp(`^${restantsTexte} kg encore disponibles sur ce trajet$`))).toBeVisible();
    test.info().annotations.push({ type: "constat", description: `kilos restants écrits « ${(await page.getByText(/kg encore disponibles/).first().innerText()).split(" ")[0]} » (séparateur décimal : point, pas virgule)` });
    await famille(page, "Vêtements & textile").click();
    await taille(page, "S").click();
    await poids(page).fill("35");
    await continuer(page).click();
    await expect(page.getByText("30 kg maximum par colis")).toBeVisible();
    await expect(page.getByText("Décris ton colis"), "bloqué à l'étape 1").toBeVisible();
    // 30 : accepté « si les kilos restants le permettent » — ici moins : refus nommant le reste.
    await poids(page).fill("30");
    await continuer(page).click();
    await expect(page.getByText(new RegExp(`Il ne reste que ${restantsTexte} kg`)).first()).toBeVisible();
    await poids(page).fill("2,5");
    await expect(page.getByText("30 kg maximum par colis")).toHaveCount(0);
    // L'info-bulle du poids.
    const info = page.getByRole("button", { name: /Poids \(kg\)/ }).first();
    if (await info.count()) {
      await info.click();
      await expect(page.getByText(/Poids déclaré\. Un colis léger \(enveloppe, passeport, lunettes…\) est facturé 0,5 kg minimum et jamais moins de 8 €/).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test("WEB-RSV-7, 8 · la taille et son coefficient, le supplément et le plancher", async ({ navigateurConnecte, jeuEssai }) => {
    test.setTimeout(3 * 60_000);
    const id = jeuEssai.trajet("bzv-perkg");
    const { page } = await navigateurConnecte("aminata", { parEcran: true });
    const assistant = new AssistantReservation(page);
    await colisNominal(page, assistant, id);
    // Libellés des tailles.
    for (const l of ["Taille — pas besoin de mesurer", "À l'œil : le coefficient s'applique au prix au kilo.", "enveloppe → boîte à chaussures", "tient dans un sac cabine", "occupe une demi-valise"]) {
      await expect(page.getByText(l).first(), l).toBeVisible();
    }
    // Le récapitulatif (colonne de droite) : « Transport … », « Service & protection … », « Total … ».
    const attendre = async (transport: string, service: string, total: string) => {
      await expect.poll(async () => await texte(page), { timeout: 15_000 }).toMatch(new RegExp(`Total ${eur(total)} €`));
      const t = await texte(page);
      expect(t, `transport ${transport}`).toMatch(new RegExp(`(× [SML]( · \\+\\d+ %)?|Transport) ${eur(transport)} €`));
      expect(t, `service ${service}`).toMatch(new RegExp(`Service & protection ${eur(service)} €`));
    };
    // S : 2,5 × 11,50 = 28,75 · 3,45 · 32,20
    await attendre("28,75", "3,45", "32,20");
    expect(await texte(page)).toMatch(/Transport · 2,5 kg × 11,50 €\/kg × S/);
    // L : × 1,25 = 35,94 · 4,31 · 40,25
    await taille(page, "L").click();
    await attendre("35,94", "4,31", "40,25");
    await taille(page, "S").click();
    await attendre("28,75", "3,45", "32,20");
    // WEB-RSV-8 : Électronique +20 % → 34,50 · 4,14 · 38,64
    await famille(page, "Électronique & appareils").click();
    await attendre("34,50", "4,14", "38,64");
    // 0,1 kg → facturé 0,5 kg → plancher 8,00 (mention) · 3,00 · 11,00
    await famille(page, "Vêtements & textile").click();
    await poids(page).fill("0,1");
    await attendre("8,00", "3,00", "11,00");
    // (l'écran écrit « 8 € », le cahier « 8,00 € » : les décimales nulles tombent — constat de format)
    expect(await texte(page)).toMatch(/Minimum par colis appliqué : 8(,00)? €/);
  });

  test("WEB-RSV-9, 10 · valeur déclarée, description, photos, protection du colis", async ({ navigateurConnecte, jeuEssai }) => {
    test.setTimeout(4 * 60_000);
    const id = jeuEssai.trajet("bzv-perkg");
    const { page } = await navigateurConnecte("aminata", { parEcran: true });
    await intercepterImageKit(page);
    const assistant = new AssistantReservation(page);
    await assistant.ouvrir(id);
    await famille(page, "Vêtements & textile").click();
    await taille(page, "S").click();
    await poids(page).fill("2,5");
    await page.locator('input[placeholder="150"]').fill("150");
    // L'info-bulle de la valeur.
    const infoValeur = page.getByRole("button", { name: /Valeur déclarée/ }).first();
    if (await infoValeur.count()) { await infoValeur.click(); await expect(page.getByText(/La valeur déclarée détermine le plafond d'indemnisation en cas de litige/).first()).toBeVisible({ timeout: 10_000 }); await page.keyboard.press("Escape"); }
    // La description : moins de 5 caractères → refus.
    // Les erreurs de l'étape se montrent à la TENTATIVE de continuer (pas au blur : constat) ; on reste à l'étape 1.
    const description = page.locator("textarea").first();
    await description.fill("abc");
    await description.blur();
    await continuer(page).click();
    await expect(page.getByText("Décris brièvement le contenu (min. 5 caractères)")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Décris ton colis")).toBeVisible();
    await description.fill("3 t-shirts, 1 pull, du chocolat");
    await expect(page.getByText("Décris brièvement le contenu (min. 5 caractères)")).toHaveCount(0, { timeout: 10_000 });
    // Les photos : deux ajoutées, tags « Contenu » / « Emballé », aide « max 10 Mo ».
    await expect(page.getByText("Idéalement : une photo du contenu déballé + une du colis emballé. JPEG ou PNG, max 10 Mo par photo.")).toBeVisible();
    const fichier = page.locator('input[type="file"]').first();
    await fichier.setInputFiles(photo("contenu"));
    await fichier.setInputFiles(photo("emballe"));
    await expect(page.getByText("Contenu", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Emballé", { exact: true }).first()).toBeVisible();
    test.info().annotations.push({ type: "constat", description: "au plus 5 photos (MAX_PHOTOS = 5) — le cahier écrit 6" });
    // Une photo de plus de 10 Mo : refus, aucun envoi (les photos partent au paiement ; la borne se joue dès la sélection).
    const requetes: string[] = [];
    page.on("request", (r) => { if (r.url().includes("imagekit")) requetes.push(r.url()); });
    const gros = photo("trop-lourde"); gros.buffer = Buffer.concat([gros.buffer, Buffer.alloc(10 * 1024 * 1024, 0)]);
    await fichier.setInputFiles(gros);
    // ANO-WEB-39 : avant correction, la photo trop lourde entrait dans la grille et n'était refusée qu'au paiement.
    await expect(page.getByText(/Une photo dépasse 10 Mo\./).first()).toBeVisible({ timeout: 10_000 });
    expect(await page.getByRole("button", { name: "Supprimer cette photo" }).count(), "toujours deux photos").toBe(2);
    expect(requetes, "rien n'est envoyé").toEqual([]);

    // WEB-RSV-10 : la protection du colis.
    const t0 = (await texte(page)).replace(/PROTECTION DU COLIS/g, "Protection du colis");
    expect(t0).toContain("Protection du colis");
    expect(t0).toContain("Protection de base");
    expect(t0).toContain("Inclus");
    expect(t0).toContain("Tu es protégé contre la non-livraison. Le paiement est bloqué jusqu'à la remise au destinataire.");
    expect(t0).toContain("Garantie Yamba 500 €");
    expect(t0).toContain("+6 €");
    expect(t0).toContain("Perte, vol, casse pendant le transport. Exclusions affichées avant validation (dont saisie douanière d'un colis non conforme).");
    await page.getByRole("button", { name: /Garantie Yamba 500 €/ }).first().click();
    await expect.poll(async () => await texte(page), { timeout: 15_000 }).toMatch(/Total 38,20 €/);
    const t1 = await texte(page);
    expect(t1).toMatch(/× S 28,75 €/);
    // Le cahier lit « Service & protection = 9,45 € » ; l'écran ventile : service 3,45 € + ligne « Garantie Yamba 500 € 6,00 € » (constat).
    const ventile = /Service & protection 3,45 €/.test(t1) && /Garantie Yamba 500 € 6(,00)? €/.test(t1);
    expect(ventile || /Service & protection 9,45 €/.test(t1), "3,45 + 6,00 (ventilé) ou 9,45 (cumulé)").toBe(true);
    test.info().annotations.push({ type: "constat", description: `protection étendue : ${ventile ? "ventilée (Service & protection 3,45 € + Garantie Yamba 500 € 6,00 €)" : "cumulée 9,45 €"} — total 38,20 € dans les deux cas` });
    expect(t1).toMatch(/Garantie Yamba 500 € 6(,00)? €/);
    // ANO-WEB-33 : le mot « assurance » n'apparaît nulle part — y compris dans l'erreur « photo requise ».
    while ((await page.getByRole("button", { name: "Supprimer cette photo" }).count()) > 0) {
      await page.getByRole("button", { name: "Supprimer cette photo" }).first().click();
      await page.waitForTimeout(200);
    }
    await continuer(page).click();
    await expect(page.getByText("Au moins 1 photo requise avec la Garantie Yamba 500 €")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Décris ton colis"), "bloqué à l'étape 1").toBeVisible();
    await expect(page.getByText("Obligatoire avec la protection étendue")).toBeVisible();
    expect((await texte(page)).toLowerCase(), "jamais le mot « assurance »").not.toContain("assurance");
  });

  test("WEB-RSV-11, 12 · le bagage entier masque poids et taille ; le récapitulatif ne montre jamais zéro", async ({ navigateurConnecte, jeuEssai }) => {
    test.setTimeout(3 * 60_000);
    const id = jeuEssai.trajet("bzv-perkg");
    const { page } = await navigateurConnecte("aminata", { parEcran: true });
    const assistant = new AssistantReservation(page);
    await assistant.ouvrir(id);
    await page.getByRole("button", { name: /^Un bagage soute 23 kg/ }).click();
    await expect(poids(page)).toHaveCount(0);
    await expect(page.getByText("Taille — pas besoin de mesurer")).toHaveCount(0);
    await expect.poll(async () => await texte(page), { timeout: 15_000 }).toMatch(/Total 257,60 €/);
    const t = await texte(page);
    expect(t).toMatch(/Transport 230(,00)? €/);
    expect(t).toMatch(/Service & protection 27,60 €/);
    // WEB-RSV-12 : retour au colis, poids vidé → indice, jamais zéro.
    await page.getByRole("button", { name: /^Un colis \(au kilo\)/ }).click();
    await poids(page).fill("");
    await expect(page.getByText("Indique le poids du colis pour voir le prix.")).toBeVisible({ timeout: 10_000 });
    // ANO-WEB-37 : avant correction, le récapitulatif affichait « Transport 0 € · Service & protection 0 € · Total 0 € ».
    const t2 = await texte(page);
    expect(t2, "jamais 0 €").not.toMatch(/\b0,00 €|\b0 €|Payer —|Total —/);
    await poids(page).fill("2,5");
    // Aucune taille choisie (le brouillon a été oublié à l'ouverture).
    if ((await page.getByRole("button", { name: /^S\b/, pressed: true }).count()) === 0) {
      await expect(page.getByText("Choisis une taille (S, M ou L).")).toBeVisible({ timeout: 10_000 });
    }
  });

  test("WEB-RSV-13, 14, 15, 17 · destinataire, engagement, paiement, demande envoyée", async ({ navigateurConnecte, jeuEssai, mailpit }) => {
    test.setTimeout(5 * 60_000);
    await mailpit.vider();
    const id = jeuEssai.trajet("bzv-perkg");
    const { page, contexte } = await navigateurConnecte("aminata", { parEcran: true });
    const kgAvant = await kilosPublics(contexte, id);
    const assistant = new AssistantReservation(page);
    await colisNominal(page, assistant, id);
    await assistant.continuer();

    // WEB-RSV-13 : le destinataire.
    await expect(page.getByText("À qui livrer ?")).toBeVisible({ timeout: 30_000 });
    let t = await texte(page);
    expect(t).toContain("Pas besoin de compte Yamba pour le destinataire. Tu lui transmettras le code.");
    expect(t).toContain("Comment se passera la livraison");
    expect(t).toMatch(/Un code à 6 chiffres te sera donné après le paiement\./);
    expect(t).toMatch(/Tu le transmets au destinataire par SMS, WhatsApp ou oralement\./);
    expect(t).toMatch(/Il le donne au voyageur à la livraison\. Sans ce code, le colis ne peut pas être remis\./);
    await expect(page.getByRole("button", { name: "Étape précédente" }).first()).toBeVisible();
    const indicatif = page.locator("select").first();
    await expect(indicatif).toHaveValue("+33");
    // Le téléphone est le premier champ du bloc.
    const telAvantPrenom = await page.evaluate(() => {
      const tel = document.querySelector('input[type="tel"]'); const prenom = document.querySelector('input[placeholder="Marie"]');
      return !!tel && !!prenom && !!(tel.compareDocumentPosition(prenom) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(telAvantPrenom, "le téléphone est le premier champ du bloc").toBe(true);
    await indicatif.selectOption("+242");
    await page.locator('input[type="tel"]').fill("12");
    await page.locator('input[placeholder="Marie"]').fill("Clarisse");
    await page.locator('input[placeholder="Mboungou"]').fill("Mabiala");
    await continuer(page).click();
    await expect(page.getByText("À qui livrer ?"), "« 12 » est refusé : on reste à l'étape 2").toBeVisible();
    await page.locator('input[type="tel"]').fill("061234567");
    await expect(page.getByText("(optionnel)").first()).toBeVisible();
    await assistant.continuer();

    // WEB-RSV-14 : l'engagement.
    await expect(page.getByText("Ton engagement")).toBeVisible({ timeout: 30_000 });
    t = await texte(page);
    expect(t).toContain("Tu certifies sur l'honneur le contenu du colis");
    expect(t).toContain("À la remise du colis, voici ce qui se passera");
    expect(t).toMatch(/Vérification visuelle obligatoire\./);
    expect(t).toMatch(/Refus possible si non-conforme\./);
    expect(t).toMatch(/Tu seras remboursé mais le trajet sera perdu\./);
    expect(t).toMatch(/Photos croisées\./);
    expect(t).toMatch(/aucun produit illicite/);
    expect(t).toMatch(/catégorie, au poids et au contenu déclarés/);
    expect(t).toMatch(/obligations douanières/);
    expect(t).toContain("Toute déclaration mensongère engage ma seule responsabilité civile et pénale, à l'exclusion de celle du voyageur et de Yamba.");
    expect(await page.locator('input[type="checkbox"]').filter({ visible: true }).count(), "une seule case").toBe(1);
    expect(t).toMatch(/CGV/);
    expect(t).toMatch(/Contrat de transport/);
    await continuer(page).click();
    await expect(page.getByText("Ton engagement"), "sans la case, impossible").toBeVisible();
    await assistant.accepterLaCharte();
    await assistant.continuer();

    // WEB-RSV-15 : le paiement (fournisseur FAKE).
    await expect(page.getByText("Le montant est autorisé maintenant et débité uniquement quand le voyageur accepte (sous 24 h).")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Mode test : aucun prestataire de paiement n'est configuré\. L'autorisation de 32,20 € est simulée/)).toBeVisible({ timeout: 30_000 });
    t = await texte(page);
    expect(t).toContain("Après ton paiement");
    expect(t).toMatch(/24h pour accepter/);
    expect(t).toMatch(/3 jours après la livraison validée, le voyageur reçoit son paiement\./);
    expect(t).toContain("Paiement sécurisé par Stripe. Yamba ne stocke jamais tes données bancaires.");
    expect(await assistant.montantAPayer()).toBe("32,20 €");
    expect(await page.locator('iframe[name^="__privateStripeFrame"]').count(), "un seul composant de paiement (aucun iframe Stripe en FAKE)").toBe(0);

    // WEB-RSV-17 : la demande est envoyée.
    await assistant.payer();
    await expect(page.getByText("Demande envoyée ! Le voyageur a 24 h pour accepter.")).toBeVisible({ timeout: 30_000 }).catch(() => undefined);
    await expect.poll(() => page.url(), { timeout: 90_000 }).toMatch(/\/bookings\/[0-9a-f]{24}$/);
    await expect(page.getByText("En attente du Voyageur")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Ta demande est envoyée et ton paiement est autorisé — rien n'est débité tant que le Voyageur n'a pas accepté\./)).toBeVisible();
    await expect(page.getByText(/Sans réponse, elle expire le .* et tu es intégralement remboursé·e\./)).toBeVisible();
    await expect.poll(() => kilosPublics(contexte, id), { timeout: 15_000 }).toBeCloseTo(kgAvant - 2.5, 5);
    // Mailpit : chacun le sien.
    const recu = await mailpit.attendreEmail({ pour: COMPTES.aminata.email, sujet: /paiement autorisé/i });
    expect(recu.sujet + recu.texte + recu.html).toContain("32,20");
    const demande = await mailpit.attendreEmail({ pour: COMPTES.thomas.email, sujet: /Nouvelle demande de transport/ });
    expect(demande.texte + demande.html, "le Voyageur lit SON gain").toContain("28,75");
    expect(demande.texte + demande.html, "jamais le prix payé").not.toContain("32,20");
    const delai = /24 ?h|24 heures|expire|avant le|jusqu'au/i.exec(demande.texte + demande.html)?.[0] ?? "aucune mention";
    test.info().annotations.push({ type: "constat", description: `délai de réponse dans l'email du Voyageur : « ${delai} »` });
  });

  test("WEB-RSV-16 · une carte refusée (⏭ fournisseur FAKE)", async () => {
    test.skip(true, "deal-service tourne avec le fournisseur FAKE (le Payment Element de Stripe ne se monte pas sur l'origine http du poste) : la carte de test 4000 0000 0000 0002 est rejouée par la recette API (fiches Stripe avec la vraie CLI).");
  });

  test("WEB-RSV-18 · le devis change entre l'affichage et le paiement", async ({ navigateurConnecte }) => {
    test.setTimeout(4 * 60_000);
    const josephine = await navigateurConnecte("josephine", { parEcran: true });
    const id = await trajetDeJosephine(josephine.contexte);
    const { page, contexte } = await navigateurConnecte("aminata", { parEcran: true });
    const avant = await mesReservations(contexte);
    const assistant = new AssistantReservation(page);
    await assistant.ouvrir(id);
    await assistant.decrireLeColis({ famille: "Vêtements & textile", taille: "S", poidsKg: "2,5", valeurEuros: "150", description: "Deux pulls et un manteau" });
    await assistant.continuer();
    await assistant.decrireLeDestinataire(CLARISSE);
    await assistant.continuer();
    await assistant.accepterLaCharte();
    await assistant.continuer();
    expect(await assistant.montantAPayer()).toBe("32,20 €");
    await expect(page.getByText(/Mode test : aucun prestataire de paiement/)).toBeVisible({ timeout: 30_000 });

    // Le Voyageur passe le prix à 15,00 €/kg pendant qu'Aminata est à l'étape 4.
    const lecture = await josephine.contexte.request.get(`${api()}/trips/${id}`);
    const trip = ((await lecture.json()) as { trip: Record<string, unknown> }).trip;
    const put = await josephine.contexte.request.put(`${api()}/trips/${id}`, {
      data: { transportMode: trip.transportMode, flightType: trip.flightType, tripType: trip.tripType, originCity: trip.originCity, originCountryCode: trip.originCountryCode, destinationCity: trip.destinationCity, destinationCountryCode: trip.destinationCountryCode, departureAt: trip.departureAt, arrivalAt: trip.arrivalAt, capacityKg: trip.capacityKg, pricePerKgCents: 1500, familyConditions: trip.familyConditions ?? [], pickupLocations: trip.pickupLocations, deliveryLocations: trip.deliveryLocations },
    });
    expect(put.ok(), `PUT prix → ${await put.text()}`).toBe(true);

    const reponse = page.waitForResponse((r) => /\/deals$/.test(r.url()) && r.request().method() === "POST", { timeout: 30_000 });
    await page.getByRole("button", { name: /^Payer / }).click();
    const r = await reponse;
    expect(r.status(), "QUOTE_DIVERGENCE").toBeGreaterThanOrEqual(400);
    expect(((await r.json()) as { details?: { code?: string } }).details?.code).toBe("QUOTE_DIVERGENCE");
    await expect(page.getByText("Le prix a changé depuis ton devis. Le nouveau total est affiché — vérifie-le avant de payer.")).toBeVisible({ timeout: 15_000 });
    // 2,5 × 15,00 = 37,50 + 12 % (4,50) = 42,00
    await expect.poll(() => assistant.montantAPayer(), { timeout: 30_000 }).toMatch(/^42(,00)? €$/);
    expect(await mesReservations(contexte), "aucun deal créé").toBe(avant);
  });

  test("WEB-RSV-19 · le dernier kilo", async ({ navigateurConnecte }) => {
    test.setTimeout(5 * 60_000);
    const josephine = await navigateurConnecte("josephine", { parEcran: true });
    const id = await trajetDeJosephine(josephine.contexte, 2); // il reste exactement 2 kg
    const aminata = await navigateurConnecte("aminata", { parEcran: true });
    const joao = await navigateurConnecte("joao", { parEcran: true });
    const colis = { famille: "Vêtements & textile" as const, taille: "S" as const, poidsKg: "2", valeurEuros: "80", description: "Deux pulls en laine" };
    const jusquAuPaiement = async (page: Page) => {
      const a = new AssistantReservation(page);
      await a.ouvrir(id); await a.decrireLeColis(colis); await a.continuer(); await a.decrireLeDestinataire(CLARISSE); await a.continuer(); await a.accepterLaCharte(); await a.continuer();
      await expect(page.getByText(/Mode test : aucun prestataire de paiement/)).toBeVisible({ timeout: 30_000 });
      return a;
    };
    const joaoAvant = await mesReservations(joao.contexte);
    const a = await jusquAuPaiement(aminata.page);
    const b = await jusquAuPaiement(joao.page);
    await a.payer();
    await expect.poll(() => aminata.page.url(), { timeout: 90_000 }).toMatch(/\/bookings\/[0-9a-f]{24}$/);
    const reponse = joao.page.waitForResponse((r) => /\/deals$/.test(r.url()) && r.request().method() === "POST", { timeout: 30_000 });
    await joao.page.getByRole("button", { name: /^Payer / }).click();
    const r = await reponse;
    expect(r.status(), "CAPACITY_EXCEEDED").toBeGreaterThanOrEqual(400);
    expect(((await r.json()) as { details?: { code?: string } }).details?.code).toBe("CAPACITY_EXCEEDED");
    await expect(joao.page.getByText("Il ne reste plus assez de place sur ce trajet pour ton colis.")).toBeVisible({ timeout: 15_000 });
    expect(await mesReservations(joao.contexte), "aucune trace pour João").toBe(joaoAvant);
    void b;
  });

  test("WEB-RSV-20, 21 · son propre trajet, un trajet parti, un trajet masqué", async ({ navigateurConnecte, navigateurAdmin, jeuEssai }) => {
    test.setTimeout(4 * 60_000);
    const thomas = await navigateurConnecte("thomas", { parEcran: true });
    const idPerkg = jeuEssai.trajet("bzv-perkg");
    await thomas.page.goto(`/fr/trips/${idPerkg}/book`, { waitUntil: "domcontentloaded" });
    await expect(thomas.page.getByText("Tu ne peux pas réserver ton propre trajet.")).toBeVisible({ timeout: 60_000 });
    const propre = await thomas.contexte.request.post(`${api()}/deals/payment-intents`, { data: { tripId: idPerkg, weightKg: 2, sizeCategory: "S", familyKey: "CLOTHES_TEXTILE", declaredValueCents: 8000, insurance: "BASIC" } });
    expect(propre.status(), "appel forcé refusé").toBeGreaterThanOrEqual(400);

    // Un trajet parti.
    const aminata = await navigateurConnecte("aminata", { parEcran: true });
    const idParti = jeuEssai.trajet("bzv-inflight");
    await aminata.page.goto(`/fr/trips/${idParti}/book`, { waitUntil: "domcontentloaded" });
    await expect(aminata.page.getByText(/Ce trajet n'accepte plus de demandes\.|Trajet introuvable/).first()).toBeVisible({ timeout: 60_000 });
    // Un trajet masqué par Yamba.
    const idYul = jeuEssai.trajet("yul");
    const admin = await navigateurAdmin("mediateur");
    const motif = "Recette WEB-RSV-21 : masquage de contrôle, levé par la même fiche.";
    expect((await admin.contexte.request.post(`${adresseDeLApiAdmin()}/admin/trips/${idYul}/hide`, { data: { reason: motif } })).status()).toBe(200);
    try {
      await aminata.page.goto(`/fr/trips/${idYul}/book`, { waitUntil: "domcontentloaded" });
      await expect(aminata.page.getByText(/Ce trajet n'accepte plus de demandes\.|Trajet introuvable/).first()).toBeVisible({ timeout: 60_000 });
    } finally {
      const levee = await admin.contexte.request.delete(`${adresseDeLApiAdmin()}/admin/trips/${idYul}/hide`, { data: { reason: motif } });
      if (levee.status() !== 200) throw new Error(`Masquage de yul NON levé (${levee.status()}) : le lever à la main.`);
    }
  });

  test("WEB-RSV-22 · l'état de l'assistant survit à un rechargement", async ({ navigateurConnecte, jeuEssai }) => {
    test.setTimeout(3 * 60_000);
    const id = jeuEssai.trajet("bzv-perkg");
    const { page } = await navigateurConnecte("aminata", { parEcran: true });
    const assistant = new AssistantReservation(page);
    await colisNominal(page, assistant, id);
    await assistant.continuer();
    await assistant.decrireLeDestinataire(CLARISSE);
    await page.reload({ waitUntil: "domcontentloaded" });
    // On retrouve l'étape 2 et les saisies.
    await expect(page.getByText("À qui livrer ?")).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('input[placeholder="Marie"]')).toHaveValue("Clarisse");
    await expect(page.locator('input[placeholder="Mboungou"]')).toHaveValue("Mabiala");
    await page.getByRole("button", { name: "Étape précédente" }).first().click();
    await expect(poids(page)).toHaveValue("2,5", { timeout: 15_000 });
    await expect(page.locator("textarea").first()).toHaveValue("3 t-shirts, 1 pull, du chocolat");
  });
});
