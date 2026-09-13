/**
 * web-ann.spec.ts — cahier 01-WEB, chapitre 5.20 « Les annulations »
 * ===================================================================
 * Le barème ANN-01 vu de l'Expéditrice (demande en attente : tout ; accepté à ≥ 48 h : tout ; à < 48 h :
 * la moitié, retenue reversée au Voyageur ; après le départ sans prise en charge : la moitié, retenue
 * conservée à arbitrer ; après la prise en charge : rien), le montant SERVI par le serveur avant la
 * confirmation, l'annulation par le Voyageur (ANN-02), l'absence de toute annulation après la prise en
 * charge, le suivi qui ne duplique pas le geste, et la course entre deux onglets.
 *
 * Deals : `bzv-pending` (Aminata ↔ Thomas), `bzv-accepted` (Pauline ↔ Thomas, départ J+10),
 * `yul-accepted` (Marie-Claire ↔ Marc — le trajet `yul` est ramené à +24 h, manœuvre consignée), un deal
 * CRÉÉ PAR L'API sur `bzv-perkg` (Aminata ↔ Thomas) puis le trajet ramené à −24 h pour « après le départ »,
 * `bzv-picked` / `bzv-delivered` pour « aucune annulation », `gru-pending` (João ↔ Inês) pour les deux onglets.
 *
 * ORDRE DE JEU : 8, 6, 1, 2, 4, 3, 5, 7, 9 (chaque deal accepté ne s'annule qu'une fois).
 */
import { test, expect, type Navigateur } from "../fixtures/yamba";
import { adresseDeLApi } from "../fixtures/adresses";
import { COMPTES } from "../fixtures/comptes";
import { JeuEssai } from "../fixtures/jeu-essai";
import { Finances } from "../pages/finances";
import { MesEnvois, enEuros } from "../pages/mes-envois";
import { MesTrajets, kilosRestants } from "../pages/mes-trajets";
import { SuiviExpediteur } from "../pages/suivi-expediteur";
import { normaliserEspaces } from "../pages/reservation";

type Contexte = Navigateur["contexte"];
type Page = Navigateur["page"];
const api = () => adresseDeLApi();

/* ══ Aides ═══════════════════════════════════════════════════════════════════════════════════ */

const ESPACE = "[\\s\\u00a0\\u202f]?";
const montant = (cents: number) => `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, "0")}${ESPACE}€`;

type Deal = Record<string, unknown> & { pricing?: { totalShipperCents: number; transportCents: number; weightKg: number }; trip?: { departureAt: string } };
async function dealBrut(contexte: Contexte, id: string): Promise<{ statut: number; corps: string; deal: Deal }> {
  const r = await contexte.request.get(`${api()}/deals/${id}`);
  const corps = await r.text();
  return { statut: r.status(), corps, deal: r.ok() ? ((JSON.parse(corps) as { deal: Deal }).deal ?? {}) : {} };
}

/** Le barème tel que le serveur l'écrit dans la liste « Mes envois » (`cancellationPreview`, D17). */
async function apercu(contexte: Contexte, id: string): Promise<{ refundCents: number; retentionCents: number; retentionPct: number } | null> {
  const r = await contexte.request.get(`${api()}/me/bookings`);
  expect(r.ok(), "GET /me/bookings").toBe(true);
  const corps = (await r.json()) as { bookings?: Array<{ id: string; cancellationPreview: { refundCents: number; retentionCents: number; retentionPct: number } | null }>; items?: unknown[] };
  const liste = (corps.bookings ?? (corps as { items?: never[] }).items ?? []) as Array<{ id: string; cancellationPreview: { refundCents: number; retentionCents: number; retentionPct: number } | null }>;
  return liste.find((b) => b.id === id)?.cancellationPreview ?? null;
}

/**
 * Une demande créée PAR L'API (fournisseur FAKE) : intention de paiement en deux temps (le premier appel
 * porte un total faux et lit le vrai dans `QUOTE_DIVERGENCE`, D17), puis la réservation.
 */
async function reserverParApi(contexte: Contexte, tripId: string, colis: { weightKg: number; sizeClass: "S" | "M" | "L"; family: string; declaredValueCents: number; description: string }): Promise<{ id: string; totalCents: number }> {
  const devis = { tripId, product: "PARCEL", family: colis.family, sizeClass: colis.sizeClass, weightKg: colis.weightKg, protection: "BASIC", declaredValueCents: colis.declaredValueCents };
  const sonde = await contexte.request.post(`${api()}/deals/payment-intents`, { data: { ...devis, expectedTotalCents: 1 } });
  expect(sonde.status(), await sonde.text()).toBe(409);
  const totalCents = ((await sonde.json()) as { details: { actualTotalCents: number } }).details.actualTotalCents;
  const intention = await contexte.request.post(`${api()}/deals/payment-intents`, { data: { ...devis, expectedTotalCents: totalCents } });
  expect(intention.status(), await intention.text()).toBe(201);
  const { paymentIntentId, provider } = (await intention.json()) as { paymentIntentId: string; provider: string };
  expect(provider, "le poste tourne sur le fournisseur FAKE").toBe("FAKE");
  const creation = await contexte.request.post(`${api()}/deals`, {
    data: {
      ...devis,
      paymentIntentId,
      expectedTotalCents: totalCents,
      description: colis.description,
      photoUrls: [],
      recipient: { firstName: "Clarisse", lastName: "Mabiala", phoneE164: "+242061234567" },
      charterAccepted: true,
      termsAccepted: true,
    },
  });
  expect(creation.status(), await creation.text()).toBe(201);
  const { bookingId } = (await creation.json()) as { bookingId: string };
  return { id: bookingId, totalCents };
}

async function accepterParApi(contexte: Contexte, id: string): Promise<void> {
  const r = await contexte.request.post(`${api()}/deals/${id}/accept`, { data: { charterAccepted: true } });
  expect(r.status(), await r.text()).toBe(200);
}

/**
 * Un trajet dont le départ est ramené à `heures` d'ici (arrivée 7 h plus tard) — manœuvre consignée.
 * Le barème lit le départ FIGÉ dans le deal (`booking.trip.departureAt`, instantané), pas le trajet : la
 * manœuvre déplace les deux (WEB-E2E-3 contournait en déplaçant le trajet AVANT de réserver).
 */
function deplacerLeDepart(jeu: JeuEssai, raison: string, tripId: string, heures: number): void {
  jeu.manoeuvre(
    raison,
    `import p from "./packages/libs/prisma"; (async () => { const d = new Date(Date.now() + ${heures} * 3600e3); const a = new Date(d.getTime() + 7 * 3600e3); await p.trip.update({ where: { id: "${tripId}" }, data: { departureAt: d, arrivalAt: a } }); const bs = await p.booking.findMany({ where: { tripId: "${tripId}" }, select: { id: true } }); for (const b of bs) await p.booking.update({ where: { id: b.id }, data: { trip: { update: { departureAt: d } } } }); console.log(bs.length + " deals réalignés"); process.exit(0); })();`
  );
}

const annuler = (page: Page) => page.getByRole("button", { name: /annul/i }).or(page.getByRole("link", { name: /annul/i }));

/* ══ L'état partagé ══════════════════════════════════════════════════════════════════════════ */

let dealParti = ""; // créé par l'API sur bzv-perkg (fiche 5)

/* ══ Les fiches ══════════════════════════════════════════════════════════════════════════════ */

test.describe("WEB-ANN — les annulations (chapitre 5.20)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(() => {
    new JeuEssai().rejouer();
  });

  test("WEB-ANN-8 · le suivi ne duplique pas l'annulation", async ({ navigateurConnecte, jeuEssai }) => {
    const accepte = jeuEssai.deal("bzv-accepted").id;
    const { page } = await navigateurConnecte("pauline");
    await new SuiviExpediteur(page).ouvrir(accepte);
    await expect(page.getByText("Thomas a accepté ton Deal")).toBeVisible({ timeout: 60_000 });
    await expect(annuler(page), "aucune seconde action d'annulation sur le suivi").toHaveCount(0);
    // ANO-WEB-70 : « Voir le Deal dans mon dashboard → » était un bouton qui n'écrivait que dans la console.
    const retour = page.getByRole("link", { name: /Voir le Deal dans mon dashboard/ });
    await expect(retour, "le suivi ramène vers « Mes envois »").toBeVisible();
    expect(await retour.getAttribute("href")).toBe("/fr/dashboard/shipments");
    await retour.click();
    await expect(page).toHaveURL(/\/fr\/dashboard\/shipments$/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1, name: "Mes envois" })).toBeVisible({ timeout: 60_000 });
    await expect(page.locator(`a[href="/fr/bookings/${accepte}"]`).first().getByRole("button", { name: "Annuler", exact: true }), "l'annulation vit sur la ligne de « Mes envois »").toBeVisible();
  });

  test("WEB-ANN-6 · le Voyageur annule un deal accepté (ANO-WEB-68, ouverte)", async ({ navigateurConnecte, jeuEssai }) => {
    const accepte = jeuEssai.deal("bzv-accepted").id;
    const { page, contexte } = await navigateurConnecte("thomas");
    /* Étape 1 — depuis l'écran du deal : aucune action d'annulation n'existe. */
    await page.goto(`/fr/carrier/deals/${accepte}`, { waitUntil: "networkidle" });
    await expect(page.getByText("Tu es engagé sur ce Deal")).toBeVisible({ timeout: 60_000 });
    const boutons = await annuler(page).count();
    const trajets = new MesTrajets(page);
    await trajets.ouvrir();
    const ligne = await trajets.ligneDuDeal(accepte);
    test.info().annotations.push({ type: "constat", description: `ANO-WEB-68 : aucune action d'annulation pour le Voyageur — écran du deal (${boutons} bouton), ligne « Mes trajets » : « ${ligne} » ; D72 renvoie pourtant le Voyageur vers « Mes trajets » pour annuler ses deals` });
    /* L'API : la machine connaît `cancel` par le CARRIER (ANN-02 : remboursement intégral + réputation), le service refuse. */
    test.fail(true, "ANO-WEB-68 : POST /deals/:id/cancel répond 403 SHIPPER_ONLY au Voyageur ; aucun écran ne propose l'annulation Voyageur (ANN-02, D72)");
    const r = await contexte.request.post(`${api()}/deals/${accepte}/cancel`, { data: { reason: "Vol annulé par la compagnie" } });
    expect(r.status(), await r.text()).toBe(200);
  });

  test("WEB-ANN-1 · annuler une demande en attente", async ({ navigateurConnecte, jeuEssai, mailpit }) => {
    await mailpit.vider();
    const pending = jeuEssai.deal("bzv-pending").id;
    const trajet = jeuEssai.trajet("bzv-upcoming");
    const thomas = await navigateurConnecte("thomas");
    const { page, contexte } = await navigateurConnecte("aminata");
    const { deal } = await dealBrut(contexte, pending);
    const total = deal.pricing!.totalShipperCents;
    const kgAvant = await kilosRestants(thomas.contexte, trajet); // GET /trips/:id : le propriétaire seul (403 NOT_TRIP_OWNER)
    const servi = await apercu(contexte, pending);
    expect(servi?.refundCents, "le serveur annonce le montant intégral").toBe(total);
    expect(servi?.retentionCents).toBe(0);

    const envois = new MesEnvois(page);
    await envois.ouvrir();
    expect(await envois.texteDeLaLigne(pending)).toMatch(/En attente|attente/);
    /* Étapes 2-3 — la fenêtre. */
    const fenetre = await envois.ouvrirLAnnulation(pending);
    expect(fenetre).toContain("Annuler cet envoi ?");
    expect(fenetre).toContain("Ta demande Paris → Brazzaville auprès de Thomas sera annulée définitivement.");
    expect(fenetre).toContain(`Tu seras remboursée de ${enEuros(total)}`);
    expect(fenetre).toContain("Remboursement intégral : le paiement n'a pas encore été débité ou tu annules plus de 48 h avant le départ.");
    await expect(page.getByRole("dialog").getByRole("button", { name: "Garder l'envoi" })).toBeVisible();
    await expect(page.getByRole("dialog").getByRole("button", { name: "Confirmer l'annulation" })).toBeVisible();
    /* Étape 4 — confirmer. */
    const { refundAmountCents, toast } = await envois.confirmerLAnnulation();
    expect(refundAmountCents).toBe(total);
    expect(toast).toBe("Envoi annulé.");
    await envois.attendreSurLaLigne(pending, "Annulée");
    expect(await kilosRestants(thomas.contexte, trajet), "les kilos sont rendus au trajet").toBe(kgAvant + deal.pricing!.weightKg);

    /* Vérification complémentaire — Aminata : email « annulée » ; Thomas : cloche seule, aucun email. */
    const email = await mailpit.attendreEmail({ pour: COMPTES.aminata.email, sujet: /^Ta demande Paris → Brazzaville est annulée$/ });
    await thomas.page.goto("/fr/dashboard/notifications", { waitUntil: "networkidle" });
    const cloche = thomas.page.locator(`a[href*="${pending}"]`).filter({ hasText: "Aminata a annulé" });
    await expect(cloche.first()).toBeVisible({ timeout: 60_000 });
    expect(normaliserEspaces(await cloche.first().innerText())).toContain("ta capacité est libérée");
    await new Promise((r) => setTimeout(r, 4_000));
    expect(await mailpit.compter({ pour: COMPTES.thomas.email, sujet: /annul/i }), "aucun email au Voyageur d'une demande jamais acceptée").toBe(0);
    test.info().annotations.push({ type: "note", description: `remboursement ${enEuros(refundAmountCents)} (= total), kilos ${kgAvant} → ${kgAvant + deal.pricing!.weightKg} ; email Aminata « ${email.sujet} »` });
  });

  test("WEB-ANN-2 · annuler un deal accepté à plus de 48 h du départ", async ({ navigateurConnecte, jeuEssai, mailpit }) => {
    const accepte = jeuEssai.deal("bzv-accepted").id;
    const trajet = jeuEssai.trajet("bzv-upcoming");
    const thomas = await navigateurConnecte("thomas");
    const { page, contexte } = await navigateurConnecte("pauline");
    const { deal } = await dealBrut(contexte, accepte);
    const total = deal.pricing!.totalShipperCents;
    expect(new Date(deal.trip!.departureAt).getTime() - Date.now(), "départ à plus de 48 h").toBeGreaterThan(48 * 3_600_000);
    const kgAvant = await kilosRestants(thomas.contexte, trajet);

    const envois = new MesEnvois(page);
    await envois.ouvrir();
    const fenetre = await envois.ouvrirLAnnulation(accepte);
    expect(fenetre, "le montant annoncé est le total intégral").toContain(`Tu seras remboursée de ${enEuros(total)}`);
    expect(fenetre).toContain("Remboursement intégral");
    const { refundAmountCents, toast } = await envois.confirmerLAnnulation();
    expect(refundAmountCents).toBe(total);
    expect(toast).toBe(`Envoi annulé. Remboursement de ${enEuros(total)} en cours.`);
    await envois.attendreSurLaLigne(accepte, "Annulée");
    expect(await kilosRestants(thomas.contexte, trajet), "les kilos sont rendus").toBe(kgAvant + deal.pricing!.weightKg);

    /* Vérification complémentaire — deux emails à Pauline, un à Thomas, la ligne Finances. */
    await mailpit.attendreEmail({ pour: COMPTES.pauline.email, sujet: /^Ta demande Paris → Brazzaville est annulée$/ });
    const remboursement = await mailpit.attendreEmail({ pour: COMPTES.pauline.email, sujet: /^Remboursement émis pour ton envoi Paris → Brazzaville$/ });
    const corps = normaliserEspaces(remboursement.texte + remboursement.html);
    expect(corps).toContain(enEuros(total));
    expect(corps).toMatch(/5 à 10 jours ouvrés/);
    const voyageur = await mailpit.attendreEmail({ pour: COMPTES.thomas.email, sujet: /^Le deal Paris → Brazzaville a été annulé$/ });
    expect(normaliserEspaces(voyageur.texte + voyageur.html)).toMatch(/kilos|capacité/i);
    const finances = new Finances(page);
    await finances.ouvrir("Paiements");
    expect(await finances.lignePaiement(accepte)).toMatch(new RegExp(`Remboursé ${montant(total)} le .+`));
    test.info().annotations.push({ type: "note", description: `total ${enEuros(total)} remboursé ; emails « ${remboursement.sujet} », « ${voyageur.sujet} »` });
  });

  test("WEB-ANN-4 · le montant annoncé vient du serveur", async ({ navigateurConnecte, jeuEssai }) => {
    const accepte = jeuEssai.deal("yul-accepted").id;
    deplacerLeDepart(jeuEssai, "WEB-ANN-3/4 — le trajet yul part à J+3 dans le seed ; le cahier exige moins de 48 h (départ ramené à +24 h)", jeuEssai.trajet("yul"), 24);
    const { page, contexte } = await navigateurConnecte("marieclaire");
    const { deal } = await dealBrut(contexte, accepte);
    const total = deal.pricing!.totalShipperCents;
    const servi = await apercu(contexte, accepte);
    expect(servi, "l'aperçu est servi avec la liste").not.toBeNull();
    expect(servi!.refundCents, "la moitié, calculée par le serveur").toBe(Math.round(total / 2));

    /* Étape 1 — la liste est lue une fois ; ouvrir la fenêtre ne déclenche AUCUN appel. */
    const lecture = page.waitForResponse((r) => r.url().includes("/me/bookings") && r.request().method() === "GET", { timeout: 60_000 });
    const envois = new MesEnvois(page);
    await envois.ouvrir();
    const listeLue = (await (await lecture).json()) as { bookings?: Array<{ id: string; cancellationPreview: { refundCents: number } | null }> };
    const dansLaListe = listeLue.bookings?.find((b) => b.id === accepte)?.cancellationPreview?.refundCents;
    const appels: string[] = [];
    const ecoute = (r: { url(): string }) => {
      if (/\/(deals|me\/bookings|bookings)/.test(r.url())) appels.push(r.url());
    };
    page.on("request", ecoute);
    const fenetre = await envois.ouvrirLAnnulation(accepte);
    page.off("request", ecoute);
    expect(appels, "aucun appel entre la liste et la fenêtre : le montant vient de la réponse déjà lue").toHaveLength(0);
    expect(fenetre).toContain(`Tu seras remboursée de ${enEuros(servi!.refundCents)}`);
    expect(dansLaListe, "le montant de la fenêtre est celui de la liste servie").toBe(servi!.refundCents);
    await envois.garderLEnvoi();
    test.info().annotations.push({ type: "note", description: `cancellationPreview.refundCents = ${servi!.refundCents} (total ${total}) lu dans GET /me/bookings ; 0 appel à l'ouverture de la fenêtre` });
  });

  test("WEB-ANN-3 · annuler à moins de 48 h du départ", async ({ navigateurConnecte, jeuEssai, mailpit }) => {
    await mailpit.vider();
    const accepte = jeuEssai.deal("yul-accepted").id;
    const trajet = jeuEssai.trajet("yul");
    const marc = await navigateurConnecte("marc");
    const { page, contexte } = await navigateurConnecte("marieclaire");
    const { deal } = await dealBrut(contexte, accepte);
    const total = deal.pricing!.totalShipperCents;
    const net = deal.pricing!.transportCents;
    const kgAvant = await kilosRestants(marc.contexte, trajet);

    /* Étape 1 — la fenêtre annonce la moitié et l'explique. */
    const envois = new MesEnvois(page);
    await envois.ouvrir();
    const fenetre = await envois.ouvrirLAnnulation(accepte);
    const rembourse = Math.round(total / 2);
    const retenue = total - rembourse;
    expect(fenetre).toContain(`Tu seras remboursée de ${enEuros(rembourse)}`);
    expect(fenetre).toContain(`Une retenue de 50 % (${enEuros(retenue)}) s'applique car le départ est dans moins de 48 h : elle est reversée au Voyageur, qui avait réservé sa capacité pour toi.`);
    /* Étape 2 — confirmer. */
    const { refundAmountCents, toast } = await envois.confirmerLAnnulation();
    expect(Math.abs(refundAmountCents - rembourse), "remboursement = total ÷ 2, à 1 centime").toBeLessThanOrEqual(1);
    expect(toast).toBe(`Envoi annulé. Remboursement de ${enEuros(refundAmountCents)} en cours.`);
    await envois.attendreSurLaLigne(accepte, "Annulée");
    expect(await kilosRestants(marc.contexte, trajet)).toBe(kgAvant + deal.pricing!.weightKg);
    const finances = new Finances(page);
    await finances.ouvrir("Paiements");
    const ligne = await finances.lignePaiement(accepte);
    expect(ligne).toMatch(new RegExp(`Remboursé ${montant(refundAmountCents)} le .+ · retenue ${montant(total - refundAmountCents)} reversée au Voyageur`));

    /* Côté Voyageur — la compensation : cloche et portefeuille ; arithmétique au centime. */
    const compensation = Math.round(((total - refundAmountCents) * net) / total);
    await marc.page.goto("/fr/dashboard/notifications", { waitUntil: "networkidle" });
    const cloche = marc.page.locator(`a[href*="${accepte}"]`).filter({ hasText: /de compensation partis vers ton compte/ });
    await expect(cloche.first()).toBeVisible({ timeout: 60_000 });
    expect(normaliserEspaces(await cloche.first().innerText())).toMatch(new RegExp(`${montant(compensation)} de compensation partis vers ton compte`));
    const portefeuille = new Finances(marc.page);
    await portefeuille.ouvrir("Portefeuille");
    const versement = await portefeuille.ligneVersement(accepte);
    expect(versement).toContain("Compensation · annulation tardive de Marie-Claire");
    expect(versement).toContain(`+ ${enEuros(compensation)}`);
    const { deal: apres } = await dealBrut(marc.contexte, accepte);
    expect(apres.payoutAmountCents, "compensation = arrondi(retenue × net ÷ total)").toBe(compensation);
    /* L'exemple du cahier (32,20 € / 28,75 €) par la même formule : 16,10 € et 14,38 €. */
    expect(Math.round((1610 * 2875) / 3220)).toBe(1438);
    test.info().annotations.push({ type: "note", description: `total ${enEuros(total)}, net ${enEuros(net)} → remboursé ${enEuros(refundAmountCents)}, retenue ${enEuros(total - refundAmountCents)}, compensation ${enEuros(compensation)} ; kilos ${kgAvant} → ${kgAvant + deal.pricing!.weightKg}` });
  });

  test("WEB-ANN-5 · annuler après le départ, sans prise en charge", async ({ navigateurConnecte, jeuEssai }) => {
    const trajet = jeuEssai.trajet("bzv-perkg");
    const thomas = await navigateurConnecte("thomas");
    const { page, contexte } = await navigateurConnecte("aminata");
    /* Un deal accepté, par l'API, puis le trajet part (manœuvre consignée). */
    const cree = await reserverParApi(contexte, trajet, { weightKg: 3, sizeClass: "S", family: "CLOTHES_TEXTILE", declaredValueCents: 8000, description: "Deux pulls et un pagne (recette ANN-5)" });
    dealParti = cree.id;
    await accepterParApi(thomas.contexte, dealParti);
    deplacerLeDepart(jeuEssai, "WEB-ANN-5 — un deal accepté sur un trajet déjà parti, sans prise en charge (bzv-perkg ramené à −24 h)", trajet, -24);
    const { deal } = await dealBrut(contexte, dealParti);
    expect(deal.status).toBe("ACCEPTED");
    const total = deal.pricing!.totalShipperCents;
    expect(total).toBe(cree.totalCents);

    /* Étape 1 — annuler depuis « Mes envois » : la moitié. */
    const envois = new MesEnvois(page);
    await envois.ouvrir();
    const fenetre = await envois.ouvrirLAnnulation(dealParti);
    const rembourse = Math.round(total / 2);
    expect(fenetre).toContain(`Tu seras remboursée de ${enEuros(rembourse)}`);
    const ditReversee = fenetre.includes("elle est reversée au Voyageur");
    const { refundAmountCents } = await envois.confirmerLAnnulation();
    expect(Math.abs(refundAmountCents - rembourse)).toBeLessThanOrEqual(1);
    await envois.attendreSurLaLigne(dealParti, "Annulée");
    const finances = new Finances(page);
    await finances.ouvrir("Paiements");
    const lignePaiement = await finances.lignePaiement(dealParti);
    expect(lignePaiement).toMatch(new RegExp(`Remboursé ${montant(refundAmountCents)} le .+ · retenue ${montant(total - refundAmountCents)}`));

    /* Côté Voyageur — la retenue est conservée à arbitrer, aucun versement automatique. */
    const { deal: apres } = await dealBrut(thomas.contexte, dealParti);
    expect(apres.status).toBe("CANCELLED");
    expect(apres.retentionDisposition).toBe("HELD_FOR_MEDIATION");
    expect(apres.payoutStatus ?? null, "aucun versement automatique").toBeNull();
    const portefeuille = new Finances(thomas.page);
    await portefeuille.ouvrir("Portefeuille");
    const versement = await portefeuille.ligneVersement(dealParti);
    expect(versement).toContain("Compensation · annulation tardive de Aminata");
    expect(versement).toContain("Retenue conservée · on te contacte");
    await thomas.page.goto(`/fr/carrier/deals/${dealParti}`, { waitUntil: "networkidle" });
    await expect(thomas.page.getByText("Annulation après le départ : la retenue de l'Expéditeur est conservée par Yamba le temps de comprendre ce qui s'est passé. Nous te contacterons.")).toBeVisible({ timeout: 60_000 });
    const trajets = new MesTrajets(thomas.page);
    await trajets.ouvrir();
    expect(await trajets.ligneDuDeal(dealParti)).toContain("Annulée après le départ · retenue conservée, on te contacte");
    test.info().annotations.push({ type: "constat", description: `total ${enEuros(total)} → remboursé ${enEuros(refundAmountCents)}, retenue ${enEuros(total - refundAmountCents)} HELD_FOR_MEDIATION ; la fenêtre ${ditReversee ? "DIT « elle est reversée au Voyageur » alors qu'elle est conservée à arbitrer (ANO-WEB-69)" : "ne promet pas la retenue au Voyageur"} ; Paiements : « ${lignePaiement} »` });
  });

  test("WEB-ANN-7 · aucun bouton d'annulation après la prise en charge (PICKED_UP, DELIVERED)", async ({ navigateurConnecte, jeuEssai }) => {
    const picked = jeuEssai.deal("bzv-picked").id;
    const delivered = jeuEssai.deal("bzv-delivered").id;
    const thomas = await navigateurConnecte("thomas");
    for (const [cle, id, compte, statut] of [["PICKED_UP", picked, "aminata", "PICKED_UP"], ["DELIVERED", delivered, "joao", "DELIVERED"]] as const) {
      const { page, contexte } = await navigateurConnecte(compte);
      const envois = new MesEnvois(page);
      await envois.ouvrir();
      const ligne = page.locator(`a[href="/fr/bookings/${id}"]`).first();
      await expect(ligne).toBeVisible({ timeout: 30_000 });
      await expect(ligne.getByRole("button", { name: /annul/i }), `${cle} : « Mes envois » sans « Annuler »`).toHaveCount(0);
      await new SuiviExpediteur(page).ouvrir(id);
      await expect(annuler(page), `${cle} : suivi sans annulation`).toHaveCount(0);
      await thomas.page.goto(`/fr/carrier/deals/${id}`, { waitUntil: "networkidle" });
      await expect(thomas.page.getByRole("heading").first()).toBeVisible({ timeout: 60_000 });
      await expect(annuler(thomas.page), `${cle} : Voyageur sans annulation`).toHaveCount(0);
      const refus = await contexte.request.post(`${api()}/deals/${id}/cancel`, { data: {} });
      expect(refus.status(), `${cle} : refus d'état`).toBe(409);
      expect(((await refus.json()) as { details?: { code?: string } }).details?.code).toBe("TRANSITION_NOT_ALLOWED");
      expect((await dealBrut(contexte, id)).deal.status).toBe(statut);
    }
  });

  test("WEB-ANN-9 · l'annulation échouée recharge la liste (deux onglets)", async ({ navigateurConnecte, jeuEssai }) => {
    const pending = jeuEssai.deal("gru-pending").id;
    const trajet = jeuEssai.trajet("gru");
    const ines = await navigateurConnecte("ines");
    const { page, contexte } = await navigateurConnecte("joao");
    const kgAvant = await kilosRestants(ines.contexte, trajet);
    const onglet2 = await contexte.newPage();
    const envois1 = new MesEnvois(page);
    const envois2 = new MesEnvois(onglet2);
    /* Étape 1 — deux onglets ; l'onglet 2 garde la liste qu'il a lue (TanStack relit au focus, le cahier ne veut pas). */
    await envois1.ouvrir();
    const lecture = onglet2.waitForResponse((r) => r.url().includes("/me/bookings") && r.request().method() === "GET", { timeout: 60_000 });
    await envois2.ouvrir();
    const figee = await (await lecture).text();
    const motif = "**/me/bookings*";
    await onglet2.route(motif, (route) => (route.request().method() === "GET" ? route.fulfill({ status: 200, contentType: "application/json", body: figee }) : route.continue()));
    /* Étape 2 — annuler dans l'onglet 1. */
    await envois1.ouvrirLAnnulation(pending);
    const premier = await envois1.confirmerLAnnulation();
    await envois1.attendreSurLaLigne(pending, "Annulée");
    /* Étape 3 — le même envoi dans l'onglet 2, sans recharger. */
    await onglet2.bringToFront();
    const fenetre = await envois2.ouvrirLAnnulation(pending);
    expect(fenetre).toContain("Annuler cet envoi ?");
    await onglet2.unroute(motif);
    const reponse = onglet2.waitForResponse((r) => /\/deals\/[^/]+\/cancel$/.test(r.url()) && r.request().method() === "POST", { timeout: 60_000 });
    await onglet2.getByRole("dialog").getByRole("button", { name: "Confirmer l'annulation" }).click();
    const r = await reponse;
    expect(r.status(), "le serveur refuse la seconde annulation").toBe(409);
    await expect(onglet2.getByText("L'annulation n'a pas abouti — la liste vient d'être actualisée.").last()).toBeVisible({ timeout: 15_000 });
    await envois2.attendreSurLaLigne(pending, "Annulée");
    await expect(onglet2.getByRole("dialog")).toHaveCount(0);
    /* Aucun double remboursement : un seul refundAmountCents, les kilos rendus une seule fois. */
    const { deal } = await dealBrut(contexte, pending);
    expect(deal.status).toBe("CANCELLED");
    expect(deal.refundAmountCents).toBe(premier.refundAmountCents);
    expect(await kilosRestants(ines.contexte, trajet)).toBe(kgAvant + deal.pricing!.weightKg);
    test.info().annotations.push({ type: "note", description: `onglet 2 : 409 ${(JSON.parse(await r.text()) as { details?: { code?: string } }).details?.code}, toast, ligne « Annulée » ; un seul remboursement de ${enEuros(premier.refundAmountCents)}` });
  });
});
