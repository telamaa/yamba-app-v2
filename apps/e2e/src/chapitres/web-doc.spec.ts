/**
 * web-doc.spec.ts — cahier 01-WEB, chapitre 5.8 « Justificatifs et billet vérifié »
 * ==================================================================================
 * Le dépôt de documents sur un trajet et le cycle de vérification du billet : Non soumis →
 * En vérification → Vérifié / Rejeté (motif fermé, email), nouveau dépôt possible, et le billet
 * qui ne bloque jamais ni la publication ni la réservation.
 *
 * Le front téléverse chaque fichier DIRECTEMENT chez ImageKit puis n'envoie au trip-service que
 * les URL rendues (`POST /trips/:id/documents`). Comme pour les photos de colis, le harnais
 * intercepte l'appel tiers (`intercepterImageKit`) : la chaîne Yamba — jeton demandé à
 * trip-service, contrôle du type et de la taille côté client, enregistrement, statut du billet —
 * est traversée telle quelle, sans écrire dans la médiathèque. Les gestes d'administration
 * (valider / rejeter) passent par l'API du back-office avec un compte SUPPORT.
 */
import { test, expect, type Navigateur } from "../fixtures/yamba";
import { adresseDeLApi, adresseDeLApiAdmin } from "../fixtures/adresses";
import { COMPTES } from "../fixtures/comptes";
import { intercepterImageKit } from "../fixtures/photos";
import { JeuEssai } from "../fixtures/jeu-essai";

type Contexte = Navigateur["contexte"];
const api = () => adresseDeLApi();

/* ══ Aides ═══════════════════════════════════════════════════════════════════════════════════ */

/** Un PDF minimal mais valide (en-tête + xref), suffisant pour `application/pdf`. */
const PDF_MINIMAL = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\nxref\n0 4\n0000000000 65535 f \n" +
    "0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n160\n%%EOF\n",
  "latin1"
);
let compteurPdf = 0;
const pdf = (nom: string, taille?: number) => {
  compteurPdf += 1;
  const buffer = taille ? Buffer.concat([PDF_MINIMAL, Buffer.alloc(taille - PDF_MINIMAL.length, 0x20)]) : PDF_MINIMAL;
  return { name: `${nom}-${compteurPdf}.pdf`, mimeType: "application/pdf", buffer };
};

/** Un brouillon complet de Joséphine, Bruxelles → Kinshasa, sans aucun document. */
async function creerTrajet(contexte: Contexte, publish = false): Promise<string> {
  const r = await contexte.request.post(`${api()}/trips`, {
    data: {
      transportMode: "PLANE", flightType: "DIRECT", tripType: "ONE_WAY",
      originCity: "Bruxelles", originCountryCode: "BE", destinationCity: "Kinshasa", destinationCountryCode: "CD",
      departureAt: new Date(Date.now() + 20 * 86_400_000).toISOString(),
      arrivalAt: new Date(Date.now() + 21 * 86_400_000).toISOString(),
      pricePerKgCents: 1150, capacityKg: 23,
      familyConditions: [{ familyKey: "FOOD_DRY_SEALED", mode: "REFUSE" }],
      pickupLocations: [{ kind: "AIRPORT", flexibility: "EXACT", details: "Bruxelles-Zaventem" }],
      deliveryLocations: [{ kind: "AIRPORT", flexibility: "EXACT", details: "Kinshasa N'djili" }],
      publish,
    },
  });
  expect(r.status(), `POST /trips → ${await r.text()}`).toBe(201);
  return ((await r.json()) as { trip: { id: string } }).trip.id;
}

type Doc = { id: string; type: string; status: string; originalName?: string | null };
async function lireTrajet(contexte: Contexte, id: string): Promise<{ status: string; ticket: string; documents: Doc[] }> {
  const r = await contexte.request.get(`${api()}/trips/${id}`);
  expect(r.ok(), `GET /trips/${id}`).toBe(true);
  const t = ((await r.json()) as { trip: { status: string; ticketVerificationStatus: string; documents?: Doc[] } }).trip;
  return { status: t.status, ticket: t.ticketVerificationStatus, documents: t.documents ?? [] };
}

/** Dépose par l'API un document « déjà téléversé » (référence factice, jamais ImageKit). */
let compteurFactice = 0;
async function deposerParApi(contexte: Contexte, tripId: string, type = "TICKET_PROOF", n = 1) {
  const documents = Array.from({ length: n }, () => {
    compteurFactice += 1;
    return { type, fileId: `e2e-doc-${Date.now()}-${compteurFactice}`, url: `https://ik.imagekit.io/yamba-e2e/trips/doc-${compteurFactice}.pdf`, originalName: `justificatif-${compteurFactice}.pdf`, mimeType: "application/pdf", sizeBytes: 12_345 };
  });
  return contexte.request.post(`${api()}/trips/${tripId}/documents`, { data: { documents } });
}

const ouvrirDetail = async (page: Navigateur["page"], id: string) => {
  await page.goto(`/fr/dashboard/trips/${id}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Documents", { exact: true }).first()).toBeVisible({ timeout: 30_000 });
};

/** La valeur affichée en face de « Billet vérifié » sur le détail du propriétaire. */
async function statutBilletAffiche(page: Navigateur["page"]): Promise<string> {
  const ligne = page.getByText("Billet vérifié", { exact: true }).first().locator("xpath=..");
  await expect(ligne).toBeVisible({ timeout: 30_000 });
  return (await ligne.innerText()).replace("Billet vérifié", "").trim();
}

const idDuBilletEnAttente = (docs: Doc[]) => docs.find((d) => d.type === "TICKET_PROOF" && d.status === "PENDING")?.id;

/* ══ Les fiches ══════════════════════════════════════════════════════════════════════════════ */

test.describe("WEB-DOC — justificatifs et billet vérifié (chapitre 5.8)", () => {
  // Le chapitre CONSOMME le billet en attente du seed (DOC-4 le valide) : il rejoue le jeu d'essai
  // à l'ouverture, comme le cahier le demande en tête de chaque chapitre.
  test.beforeAll(() => {
    new JeuEssai().rejouer();
  });

  test("WEB-DOC-1 · déposer deux justificatifs : listés, billet « En vérification »", async ({ navigateurConnecte }) => {
    test.setTimeout(3 * 60_000);
    const { page, contexte } = await navigateurConnecte("josephine", { parEcran: true });
    const id = await creerTrajet(contexte);
    expect((await lireTrajet(contexte, id)).ticket, "un trajet neuf : billet non soumis").toBe("NOT_SUBMITTED");

    await intercepterImageKit(page);
    await ouvrirDetail(page, id);
    expect(await statutBilletAffiche(page)).toBe("Non soumis");

    // Premier dépôt : le PDF part chez ImageKit (intercepté), puis vers trip-service.
    const enregistrement = page.waitForResponse((r) => /\/trips\/[^/]+\/documents$/.test(r.url()) && r.request().method() === "POST", { timeout: 30_000 });
    await page.locator('input[type="file"]').first().setInputFiles(pdf("billet"));
    expect((await enregistrement).status(), "POST /trips/:id/documents").toBe(201);
    await expect(page.getByText(/billet-\d+\.pdf/).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("En vérification").first()).toBeVisible();
    await expect.poll(() => statutBilletAffiche(page), { timeout: 30_000 }).toBe("En vérification");

    // Second dépôt : listé lui aussi.
    const second = page.waitForResponse((r) => /\/trips\/[^/]+\/documents$/.test(r.url()) && r.request().method() === "POST", { timeout: 30_000 });
    await page.locator('input[type="file"]').first().setInputFiles(pdf("itineraire"));
    expect((await second).status()).toBe(201);
    await expect(page.getByText(/itineraire-\d+\.pdf/).first()).toBeVisible({ timeout: 30_000 });

    // Côté serveur : deux documents, tous deux TICKET_PROOF — l'écran ne propose PAS de type
    // (ANO-WEB-24, ouverte : billet / itinéraire / véhicule / identité / autre existent dans
    // l'API, pas dans le formulaire).
    const { documents, ticket } = await lireTrajet(contexte, id);
    expect(documents).toHaveLength(2);
    expect(ticket).toBe("PENDING");
    expect(documents.map((d) => d.type), "aucun sélecteur de type : tout est « billet »").toEqual(["TICKET_PROOF", "TICKET_PROOF"]);
  });

  test("WEB-DOC-2 · les bornes : 5 Mo par fichier, 5 documents par trajet", async ({ navigateurConnecte }) => {
    test.setTimeout(3 * 60_000);
    const { page, contexte } = await navigateurConnecte("josephine", { parEcran: true });
    const id = await creerTrajet(contexte);
    await intercepterImageKit(page);
    await ouvrirDetail(page, id);

    // Plus de 5 Mo : refus côté navigateur, AUCUNE requête (ni jeton ImageKit, ni enregistrement).
    const requetes: string[] = [];
    page.on("request", (r) => { if (/imagekit|\/documents$/.test(r.url())) requetes.push(r.url()); });
    await page.locator('input[type="file"]').first().setInputFiles(pdf("trop-gros", 5 * 1024 * 1024 + 1));
    await expect(page.getByText("Le fichier dépasse 5 Mo.")).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1_500);
    expect(requetes, "rien n'est envoyé").toEqual([]);

    // Cinq documents : la zone de dépôt laisse place à un message explicite (ANO-WEB-25).
    expect((await deposerParApi(contexte, id, "TICKET_PROOF", 5)).status()).toBe(201);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText(/5 documents maximum par trajet/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Ajouter un billet ou justificatif")).toHaveCount(0);

    // Et le serveur refuse le sixième, quoi qu'en dise l'écran.
    const sixieme = await deposerParApi(contexte, id);
    expect(sixieme.status(), "sixième document refusé").toBe(400);
    expect(((await sixieme.json()) as { details?: { code?: string } }).details?.code).toBe("DOCUMENT_LIMIT_REACHED");
    // Un document de plus de 5 Mo est aussi refusé par le serveur (garde indépendante du navigateur).
    const gros = await contexte.request.post(`${api()}/trips/${await creerTrajet(contexte)}/documents`, {
      data: { documents: [{ type: "TICKET_PROOF", fileId: "e2e-gros", url: "https://ik.imagekit.io/yamba-e2e/trips/gros.pdf", originalName: "gros.pdf", sizeBytes: 6 * 1024 * 1024 }] },
    });
    expect(gros.status()).toBe(400);
    expect(((await gros.json()) as { details?: { code?: string } }).details?.code).toBe("DOCUMENT_TOO_LARGE");
  });

  test("WEB-DOC-3 · les statuts du billet : bzv-upcoming est « En vérification »", async ({ navigateurConnecte, jeuEssai }) => {
    const { page, contexte } = await navigateurConnecte("thomas", { parEcran: true });
    const id = jeuEssai.trajet("bzv-upcoming");
    const { ticket, documents } = await lireTrajet(contexte, id);
    expect(ticket, "le jeu d'essai pose un billet en attente").toBe("PENDING");
    expect(idDuBilletEnAttente(documents), "un document TICKET_PROOF en attente").toBeTruthy();
    await ouvrirDetail(page, id);
    expect(await statutBilletAffiche(page)).toBe("En vérification");
    // Les quatre statuts existent (Non soumis / En vérification / Vérifié / Rejeté) : les trois
    // autres sont vus en DOC-1, DOC-4 et DOC-5.
  });

  test("WEB-DOC-4 · billet validé par l'équipe : « Vérifié », badge public, email", async ({ navigateurConnecte, navigateurVisiteur, navigateurAdmin, jeuEssai, mailpit }) => {
    test.setTimeout(4 * 60_000);
    await mailpit.vider();
    const id = jeuEssai.trajet("bzv-upcoming");
    const thomas = await navigateurConnecte("thomas", { parEcran: true });
    const support = await navigateurAdmin("support");

    const avant = await lireTrajet(thomas.contexte, id);
    const documentId = idDuBilletEnAttente(avant.documents);
    expect(documentId, "billet en attente à examiner").toBeTruthy();

    const revue = await support.contexte.request.post(`${adresseDeLApiAdmin()}/admin/tickets/${documentId}/review`, { data: { decision: "VERIFY" } });
    expect(revue.status(), `POST /admin/tickets/:id/review → ${await revue.text()}`).toBe(200);
    expect((await revue.json()) as object).toMatchObject({ status: "VERIFIED", tripTicketStatus: "VERIFIED" });

    // Le Voyageur recharge : « Vérifié ».
    await ouvrirDetail(thomas.page, id);
    expect(await statutBilletAffiche(thomas.page)).toBe("Vérifié");
    expect((await lireTrajet(thomas.contexte, id)).ticket).toBe("VERIFIED");

    // La page publique porte le badge « Billet vérifié » (visiteur).
    const { page } = await navigateurVisiteur();
    await page.goto(`/fr/trips/${id}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Billet vérifié").first()).toBeVisible({ timeout: 60_000 });
    const publique = await thomas.contexte.request.get(`${api()}/trips/${id}/public`);
    expect(JSON.stringify(await publique.json()), "DTO public : ticketVerified = true").toContain('"ticketVerified":true');

    // L'email de confirmation, en français (langue de Thomas).
    const email = await mailpit.attendreEmail({ pour: COMPTES.thomas.email, sujet: /Billet vérifié/ });
    expect(email.sujet).toBe("Billet vérifié pour ton trajet Paris → Brazzaville");
    expect(email.texte + email.html).toMatch(/badge « billet vérifié »/i);

    // Un second examen du même document est refusé.
    const rejoue = await support.contexte.request.post(`${adresseDeLApiAdmin()}/admin/tickets/${documentId}/review`, { data: { decision: "VERIFY" } });
    expect(rejoue.status()).toBe(400);
    expect(((await rejoue.json()) as { details?: { code?: string } }).details?.code).toBe("TICKET_ALREADY_REVIEWED");
  });

  test("WEB-DOC-5 · billet rejeté avec motif : email en clair, nouveau dépôt possible", async ({ navigateurConnecte, navigateurAdmin, mailpit }) => {
    test.setTimeout(4 * 60_000);
    await mailpit.vider();
    const { page, contexte } = await navigateurConnecte("josephine", { parEcran: true });
    const support = await navigateurAdmin("support");
    const id = await creerTrajet(contexte, true);

    // Un billet déposé (par l'API) → en attente.
    expect((await deposerParApi(contexte, id)).status()).toBe(201);
    const documentId = idDuBilletEnAttente((await lireTrajet(contexte, id)).documents);
    expect(documentId).toBeTruthy();

    // Un rejet SANS motif est refusé ; avec un motif fermé, il passe.
    const sansMotif = await support.contexte.request.post(`${adresseDeLApiAdmin()}/admin/tickets/${documentId}/review`, { data: { decision: "REJECT" } });
    expect(sansMotif.status(), "un rejet exige un motif").toBe(400);
    const rejet = await support.contexte.request.post(`${adresseDeLApiAdmin()}/admin/tickets/${documentId}/review`, { data: { decision: "REJECT", reason: "DATES_MISMATCH" } });
    expect(rejet.status(), `rejet → ${await rejet.text()}`).toBe(200);
    expect((await lireTrajet(contexte, id)).ticket).toBe("REJECTED");

    // L'écran : « Rejeté » ; le trajet reste en ligne.
    await intercepterImageKit(page);
    await ouvrirDetail(page, id);
    expect(await statutBilletAffiche(page)).toBe("Rejeté");
    expect((await lireTrajet(contexte, id)).status).toBe("PUBLISHED");

    // L'email nomme le motif EN CLAIR, en français.
    const email = await mailpit.attendreEmail({ pour: COMPTES.josephine.email, sujet: /Billet non validé/ });
    expect(email.sujet).toBe("Billet non validé pour ton trajet Bruxelles → Kinshasa");
    expect(email.texte + email.html).toContain("les dates ne correspondent pas au trajet");
    expect(email.texte + email.html).toContain("Déposer un autre billet");
    expect(email.texte + email.html, "jamais le code interne").not.toContain("DATES_MISMATCH");

    // Un nouveau dépôt (à l'écran) repasse le billet « En vérification ».
    const enregistrement = page.waitForResponse((r) => /\/trips\/[^/]+\/documents$/.test(r.url()) && r.request().method() === "POST", { timeout: 30_000 });
    await page.locator('input[type="file"]').first().setInputFiles(pdf("nouveau-billet"));
    expect((await enregistrement).status()).toBe(201);
    await expect.poll(() => statutBilletAffiche(page), { timeout: 30_000 }).toBe("En vérification");
    expect((await lireTrajet(contexte, id)).ticket).toBe("PENDING");
  });

  test("WEB-DOC-6 · le billet ne bloque rien : publiable et réservable sans billet vérifié", async ({ navigateurConnecte }) => {
    test.setTimeout(3 * 60_000);
    const josephine = await navigateurConnecte("josephine", { parEcran: true });
    const id = await creerTrajet(josephine.contexte);
    expect((await lireTrajet(josephine.contexte, id)).ticket).toBe("NOT_SUBMITTED");

    // Publiable.
    expect((await josephine.contexte.request.post(`${api()}/trips/${id}/publish`)).ok(), "publication sans billet").toBe(true);
    expect((await lireTrajet(josephine.contexte, id)).status).toBe("PUBLISHED");
    const publique = await josephine.contexte.request.get(`${api()}/trips/${id}/public`);
    expect(publique.ok()).toBe(true);
    expect(JSON.stringify(await publique.json()), "badge informatif absent").toContain('"ticketVerified":false');

    // Réservable : une Expéditrice voit « Réserver » et l'assistant s'ouvre.
    const aminata = await navigateurConnecte("aminata", { parEcran: true });
    await aminata.page.goto(`/fr/trips/${id}`, { waitUntil: "domcontentloaded" });
    const reserver = aminata.page.getByRole("button", { name: /^Réserver/ }).first();
    await expect(reserver).toBeVisible({ timeout: 60_000 });
    await expect(aminata.page.getByText("Billet vérifié")).toHaveCount(0);
    await reserver.click();
    await expect.poll(() => aminata.page.url(), { timeout: 60_000 }).toMatch(new RegExp(`/trips/${id}/book`));
  });
});
