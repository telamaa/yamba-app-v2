/**
 * adm-bil-billets.spec.ts — cahier 02-ADMIN, § 5.8 « Billets à vérifier (`/tickets`) » (ADM-BIL-1 à 4, + 5 à 8)
 * ============================================================================================================
 * Le billet est un SIGNAL de confiance (badge « Billet vérifié »), jamais une barrière. Ce que l'administrateur
 * atteste en le validant, ce sont des FAITS : les dates, les villes, le nom. D'où ce que les fiches ajoutées éprouvent
 * au-delà du cahier :
 *  - BIL-5 : le conflit d'intérêts (un administrateur qui voyage ne vérifie pas son propre billet) ;
 *  - BIL-6 : le statut du trajet reste la synthèse de SES billets (un second billet rejeté n'efface pas le premier
 *    vérifié ; supprimer le billet vérifié retire le badge) ;
 *  - BIL-7 : changer les faits vérifiés (date, villes) rouvre la vérification ;
 *  - BIL-8 : deux administrateurs sur le même billet — une décision, un refus lisible.
 *
 * Les trajets créés par la fiche appartiennent à Joséphine (Voyageuse du seed, aucun billet) ou au super
 * administrateur, et sont supprimés en fin de fiche (manœuvre consignée). Les documents « déposés » sont des références
 * factices : le trip-service n'enregistre que l'URL rendue par ImageKit, le harnais n'écrit jamais dans la médiathèque.
 */
import { test, expect, type NavigateurAdmin, type Navigateur } from "../fixtures/yamba";
import { JeuEssai } from "../fixtures/jeu-essai";
import { COMPTES, COMPTES_ADMIN, MOT_DE_PASSE_SEED } from "../fixtures/comptes";
import { adresseDeLApi, adresseDeLApiAdmin, adresseDuBackOffice } from "../fixtures/adresses";
import { lireLeJournal } from "../pages/journal-admin";
import { attendreLeChargement, debutDuScenario, lireCoteServeur } from "../pages/ecran-admin";

const api = () => adresseDeLApi();
const apiAdmin = () => adresseDeLApiAdmin();
const bo = () => adresseDuBackOffice();

type Contexte = Navigateur["contexte"];
type PageAdmin = NavigateurAdmin["page"];
type Doc = { id: string; type: string; status: string; originalName?: string | null };
type Refus = { message?: string; details?: { code?: string } };

const SOUS_TITRE = "Trajets à venir seulement, les plus anciens d'abord. Ouvrir un billet est journalisé. Compare les dates, les villes et le nom.";
const MOTIFS = ["Document illisible", "Les dates ne correspondent pas au trajet", "Le nom ne correspond pas au compte", "Document non recevable"];

/* ══ Aides ═══════════════════════════════════════════════════════════════════════════════════ */

/** Un trajet publié, à J+jours, sans document. */
async function creerTrajet(contexte: Contexte, jours = 25, villes: [string, string] = ["Bruxelles", "Kinshasa"]): Promise<string> {
  const r = await contexte.request.post(`${api()}/trips`, {
    data: {
      transportMode: "PLANE", flightType: "DIRECT", tripType: "ONE_WAY",
      originCity: villes[0], originCountryCode: "BE", destinationCity: villes[1], destinationCountryCode: "CD",
      departureAt: new Date(Date.now() + jours * 86_400_000).toISOString(),
      arrivalAt: new Date(Date.now() + (jours + 1) * 86_400_000).toISOString(),
      pricePerKgCents: 1150, capacityKg: 23,
      familyConditions: [{ familyKey: "FOOD_DRY_SEALED", mode: "REFUSE" }],
      pickupLocations: [{ kind: "AIRPORT", flexibility: "EXACT", details: "Bruxelles-Zaventem" }],
      deliveryLocations: [{ kind: "AIRPORT", flexibility: "EXACT", details: "Kinshasa N'djili" }],
      publish: true,
    },
  });
  expect(r.status(), `POST /trips → ${await r.text()}`).toBe(201);
  return ((await r.json()) as { trip: { id: string } }).trip.id;
}

let compteur = 0;
/** Dépose un billet « déjà téléversé » (référence factice) et rend l'id du document créé. */
async function deposerBillet(contexte: Contexte, tripId: string): Promise<string> {
  compteur += 1;
  const nom = `billet-recette-bil-${Date.now()}-${compteur}.pdf`;
  const r = await contexte.request.post(`${api()}/trips/${tripId}/documents`, {
    data: { documents: [{ type: "TICKET_PROOF", fileId: `e2e-bil-${Date.now()}-${compteur}`, url: `https://ik.imagekit.io/yamba-e2e/trips/${nom}`, originalName: nom, mimeType: "application/pdf", sizeBytes: 12_345 }] },
  });
  expect(r.status(), `POST /trips/${tripId}/documents → ${await r.text()}`).toBe(201);
  const docs = ((await r.json()) as { trip: { documents: Doc[] } }).trip.documents;
  const doc = docs.find((d) => d.originalName === nom);
  expect(doc, "document créé").toBeTruthy();
  return doc!.id;
}

async function lireTrajet(contexte: Contexte, id: string): Promise<{ status: string; ticket: string; documents: Doc[] }> {
  const r = await contexte.request.get(`${api()}/trips/${id}`);
  expect(r.ok(), `GET /trips/${id}`).toBe(true);
  const t = ((await r.json()) as { trip: { status: string; ticketVerificationStatus: string; documents?: Doc[] } }).trip;
  return { status: t.status, ticket: t.ticketVerificationStatus, documents: t.documents ?? [] };
}

const decider = (ctx: Contexte, documentId: string, decision: "VERIFY" | "REJECT", reason?: string) =>
  ctx.request.post(`${apiAdmin()}/admin/tickets/${documentId}/review`, { data: { decision, ...(reason ? { reason } : {}) }, failOnStatusCode: false });

type File = { items: Array<{ documentId: string; tripId: string; originCity: string; destinationCity: string; departureAt: string; carrier: { id: string; firstName: string; lastName: string }; originalName: string | null; submittedAt: string }>; expiredNow: number };
const lireFile = async (ctx: Contexte, qs = ""): Promise<File> => (await (await ctx.request.get(`${apiAdmin()}/admin/tickets${qs}`)).json()) as File;

/** Manœuvre consignée : suppression en base des trajets créés par la fiche (documents en cascade). */
function supprimerTrajets(ids: string[]): void {
  if (!ids.length) return;
  lireCoteServeur(`
    import prisma from "./packages/libs/prisma";
    (async () => { const ids = ${JSON.stringify(ids)}; await prisma.tripDocument.deleteMany({ where: { tripId: { in: ids } } }); const r = await prisma.trip.deleteMany({ where: { id: { in: ids } } }); console.log("@@" + JSON.stringify(r.count)); process.exit(0); })();`);
  process.stdout.write(`   ↳ manœuvre base : ${ids.length} trajet(s) de recette supprimé(s)\n`);
}

/** Les cartes de la file, lues à l'écran. */
const cartes = (page: PageAdmin) => page.locator("ul > li").filter({ has: page.getByRole("button", { name: /^Ouvrir le billet/ }) });

async function ouvrirFile(page: PageAdmin): Promise<void> {
  await page.goto(`${bo()}/tickets`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 60_000 });
  await attendreLeChargement(page);
}

/** Session MEMBRE d'un compte (API seulement), dans un contexte neuf. */
async function sessionMembre(navigateurVisiteur: () => Promise<Navigateur>, email: string): Promise<Navigateur> {
  const nav = await navigateurVisiteur();
  const r = await nav.contexte.request.post(`${api()}/auth/login`, { data: { email, password: MOT_DE_PASSE_SEED } });
  expect(r.ok(), `connexion membre ${email} → ${r.status()} ${await r.text()}`).toBe(true);
  return nav;
}

/* ══ Les fiches ══════════════════════════════════════════════════════════════════════════════ */

test.describe("ADM-BIL — billets à vérifier (cahier 02-ADMIN § 5.8)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(() => {
    new JeuEssai().rejouer();
  });

  test("ADM-BIL-1 · la file et ses filtres", async ({ navigateurAdmin, navigateurVisiteur, jeuEssai }) => {
    test.setTimeout(8 * 60_000);
    const sup = await navigateurAdmin("support");
    const lecteur = await navigateurAdmin("finance");
    const crees: string[] = [];
    try {
      const debut = await debutDuScenario();
      const { page } = sup;
      await ouvrirFile(page);
      /* 1. Sous-titre. */
      await expect(page.getByText(SOUS_TITRE, { exact: true })).toBeVisible();
      /* 2. Une carte : Paris → Brazzaville, J+10, Thomas Nkounkou. */
      const file = await lireFile(sup.contexte);
      await expect(cartes(page), "écran = API").toHaveCount(file.items.length);
      expect(file.items.length, "une carte sur le jeu d'essai neuf").toBe(1);
      const billet = file.items[0];
      expect(billet.tripId).toBe(jeuEssai.trajet("bzv-upcoming"));
      const carte = cartes(page).first();
      await expect(carte).toContainText("Paris → Brazzaville");
      await expect(carte).toContainText("Thomas Nkounkou");
      await expect(carte).toContainText(/déposé le \d{1,2} \S+ \d{4}, \d{2}:\d{2}/);
      const jours = Math.round((new Date(billet.departureAt).getTime() - Date.now()) / 86_400_000);
      expect(jours, `départ à J+10 (J+${jours})`).toBe(10);
      /* 4. Aucune ligne « billets de trajets partis » sur un jeu d'essai neuf. */
      await expect(page.getByText(/billet\(s\) de trajets partis sortis de la file\./)).toHaveCount(0);
      /* 3. Les filtres, écran ET API. */
      const origine = page.getByPlaceholder("origine", { exact: true });
      const destination = page.getByPlaceholder("destination", { exact: true });
      await origine.fill("paris");
      await expect(cartes(page), "origine « paris » (insensible à la casse)").toHaveCount(1, { timeout: 30_000 });
      await origine.fill("Lyon");
      await expect(page.getByText("Rien à vérifier.", { exact: true }), "origine « Lyon »").toBeVisible({ timeout: 30_000 });
      await origine.fill("(");
      await expect(page.getByText("Rien à vérifier.", { exact: true }), "« ( » ne casse rien (A157)").toBeVisible({ timeout: 30_000 });
      await origine.fill("");
      await destination.fill("Brazza");
      await expect(cartes(page), "destination « Brazza »").toHaveCount(1, { timeout: 30_000 });
      await destination.fill("");
      const age = page.locator("select").filter({ has: page.locator("option", { hasText: "tout âge" }) });
      const deposeIlYa = (Date.now() - new Date(billet.submittedAt).getTime()) / 86_400_000;
      for (const [valeur, seuil] of [["1", 1], ["3", 3], ["7", 7]] as const) {
        await age.selectOption(valeur);
        const attendu = deposeIlYa > seuil ? 1 : 0;
        if (attendu) await expect(cartes(page), `+ de ${seuil} j`).toHaveCount(1, { timeout: 30_000 });
        else await expect(page.getByText("Rien à vérifier.", { exact: true }), `+ de ${seuil} j (déposé il y a ${deposeIlYa.toFixed(1)} j)`).toBeVisible({ timeout: 30_000 });
        expect((await lireFile(sup.contexte, `?olderThanDays=${valeur}`)).items.length, `API + de ${seuil} j`).toBe(attendu);
      }
      await age.selectOption("");
      test.info().annotations.push({ type: "constat", description: `billet du jeu d'essai déposé il y a ${deposeIlYa.toFixed(2)} j : filtres d'âge 1/3/7 j → ${deposeIlYa > 1 ? "1" : "0"}/${deposeIlYa > 3 ? "1" : "0"}/${deposeIlYa > 7 ? "1" : "0"}` });
      /* Journal : ouvrir la file et filtrer n'écrivent rien. */
      expect((await lireLeJournal(lecteur.contexte.request, { from: debut, adminUserId: jeuEssai.admin("support").id })).map((l) => l.action), "aucune ligne").toEqual([]);

      /* Contre-épreuve — un billet sur un trajet PARTI : ni la file ni l'export ne le proposent, et la lecture le sort
         en le disant une fois. */
      const jo = await sessionMembre(navigateurVisiteur, COMPTES.josephine.email);
      const parti = await creerTrajet(jo.contexte, 20);
      crees.push(parti);
      const docParti = await deposerBillet(jo.contexte, parti);
      lireCoteServeur(`
        import prisma from "./packages/libs/prisma";
        (async () => { await prisma.trip.update({ where: { id: ${JSON.stringify(parti)} }, data: { departureAt: new Date(Date.now() - 86_400_000), arrivalAt: new Date(Date.now() - 43_200_000) } }); console.log("@@true"); process.exit(0); })();`);
      process.stdout.write(`   ↳ manœuvre base : trajet ${parti} reculé à J−1 (ADM-BIL-1)\n`);
      const exportCsv = await sup.contexte.request.get(`${apiAdmin()}/admin/tickets/export`, { failOnStatusCode: false });
      if (exportCsv.status() === 403) test.info().annotations.push({ type: "constat", description: "export des billets : 403 pour le Support (exports.operational)" });
      const exportParFinance = await lecteur.contexte.request.get(`${apiAdmin()}/admin/tickets/export`, { failOnStatusCode: false });
      const csvTexte = exportParFinance.ok() ? await exportParFinance.text() : await exportCsv.text();
      expect(csvTexte, "l'export ne propose pas le billet d'un trajet parti (cohérent avec la file)").not.toContain(docParti);
      await page.reload({ waitUntil: "domcontentloaded" });
      await attendreLeChargement(page);
      await expect(page.getByText("1 billet(s) de trajets partis sortis de la file.", { exact: true }), "la lecture le sort et le dit").toBeVisible({ timeout: 30_000 });
      await expect(cartes(page), "toujours une seule carte").toHaveCount(1);
      await page.reload({ waitUntil: "domcontentloaded" });
      await attendreLeChargement(page);
      await expect(page.getByText(/billet\(s\) de trajets partis sortis de la file\./), "une seule fois").toHaveCount(0);

      /* Contre-épreuve — un billet sur un trajet ANNULÉ (à venir) : plus rien à attester. */
      const annule = await creerTrajet(jo.contexte, 30);
      crees.push(annule);
      const docAnnule = await deposerBillet(jo.contexte, annule);
      expect((await lireFile(sup.contexte)).items.map((i) => i.documentId), "billet d'un trajet publié : dans la file").toContain(docAnnule);
      const cancel = await jo.contexte.request.post(`${api()}/trips/${annule}/cancel`, { data: {}, failOnStatusCode: false });
      expect(cancel.ok(), `annulation du trajet : ${cancel.status()} ${await cancel.text()}`).toBe(true);
      expect((await lireFile(sup.contexte)).items.map((i) => i.documentId), "billet d'un trajet ANNULÉ : hors de la file").not.toContain(docAnnule);

      /* Contre-épreuve — le filtre d'âge dans le sens « inclus » : le billet du jeu d'essai est déposé à l'heure du seed,
         il ne prouve que l'exclusion. Un billet vieilli de deux jours (manœuvre consignée) : + de 1 j oui, + de 3 j non. */
      const vieux = await creerTrajet(jo.contexte, 28);
      crees.push(vieux);
      const docVieux = await deposerBillet(jo.contexte, vieux);
      lireCoteServeur(`
        import prisma from "./packages/libs/prisma";
        (async () => { await prisma.tripDocument.update({ where: { id: ${JSON.stringify(docVieux)} }, data: { createdAt: new Date(Date.now() - 2 * 86_400_000) } }); console.log("@@true"); process.exit(0); })();`);
      process.stdout.write(`   ↳ manœuvre base : billet ${docVieux} vieilli de 2 jours (ADM-BIL-1)\n`);
      const ids = async (qs: string) => (await lireFile(sup.contexte, qs)).items.map((i) => i.documentId);
      expect(await ids("?olderThanDays=1"), "déposé il y a 2 j : + de 1 j → dans la file").toContain(docVieux);
      expect(await ids("?olderThanDays=3"), "déposé il y a 2 j : + de 3 j → hors de la file").not.toContain(docVieux);
      await age.selectOption("1");
      await expect(cartes(page).filter({ has: page.getByRole("button", { name: /billet-recette-bil/ }) }), "l'écran suit : + de 1 j").toHaveCount(1, { timeout: 30_000 });
      await age.selectOption("");
      const ordre = await ids("");
      expect(ordre.indexOf(docVieux), "les plus anciens d'abord : le billet vieilli passe devant celui du jeu d'essai").toBeLessThan(ordre.indexOf(billet.documentId));
    } finally {
      supprimerTrajets(crees);
    }
  });

  test("ADM-BIL-2 · ouvrir un billet est journalisé", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(5 * 60_000);
    const sup = await navigateurAdmin("support");
    const lecteur = await navigateurAdmin("finance");
    const { page } = sup;
    await ouvrirFile(page);
    const billet = (await lireFile(sup.contexte)).items[0];
    const brut = lireCoteServeur<{ url: string }>(`
      import prisma from "./packages/libs/prisma";
      (async () => { const d = await prisma.tripDocument.findUnique({ where: { id: ${JSON.stringify(billet.documentId)} }, select: { url: true } }); console.log("@@" + JSON.stringify(d)); process.exit(0); })();`);
    const debut = await debutDuScenario();
    /* 1-2. « Ouvrir le billet (nom) » → un nouvel onglet sur l'URL du document. */
    const bouton = cartes(page).first().getByRole("button", { name: `Ouvrir le billet (${billet.originalName})`, exact: true });
    await expect(bouton).toBeVisible();
    const [onglet] = await Promise.all([sup.contexte.waitForEvent("page", { timeout: 30_000 }), bouton.click()]);
    await onglet.waitForURL((u) => u.toString() !== "about:blank", { timeout: 30_000 }).catch(() => undefined);
    expect(onglet.url(), "l'onglet ouvre l'URL du document").toBe(brut.url);
    await onglet.close();
    /* 3. Journal : DOCUMENT_VIEWED TRIP · id, { documentId }. */
    const lignes = await lireLeJournal(lecteur.contexte.request, { from: debut, adminUserId: jeuEssai.admin("support").id });
    const vues = lignes.filter((l) => l.action === "DOCUMENT_VIEWED");
    expect(vues.length, "au moins une ligne DOCUMENT_VIEWED").toBeGreaterThanOrEqual(1);
    expect(`${vues[0].targetType} · ${vues[0].targetId}`).toBe(`TRIP · ${billet.tripId}`);
    expect(vues[0].after).toEqual({ documentId: billet.documentId });
    expect(vues.length, "un clic = une ligne").toBe(1);
    /* Contre-épreuve : un document inexistant → 404, aucune ligne. */
    const debut2 = await debutDuScenario();
    const inexistant = await sup.contexte.request.get(`${apiAdmin()}/admin/tickets/0123456789abcdef01234567`, { failOnStatusCode: false });
    expect(inexistant.status()).toBe(404);
    expect((await lireLeJournal(lecteur.contexte.request, { from: debut2, adminUserId: jeuEssai.admin("support").id })).map((l) => l.action), "un 404 n'écrit rien").toEqual([]);
    test.info().annotations.push({ type: "constat", description: `URL servie : ${brut.url} — une URL ImageKit publique et permanente (voir « à trancher »)` });
  });

  test("ADM-BIL-3 · valider un billet", async ({ navigateurAdmin, navigateurVisiteur, jeuEssai, mailpit }) => {
    test.setTimeout(6 * 60_000);
    const sup = await navigateurAdmin("support");
    const lecteur = await navigateurAdmin("finance");
    const tripId = jeuEssai.trajet("bzv-upcoming");
    try {
      const avant = await mailpit.compter({ pour: COMPTES.thomas.email, sujet: "Billet vérifié pour ton trajet Paris → Brazzaville" });
      const { page } = sup;
      await ouvrirFile(page);
      const billet = (await lireFile(sup.contexte)).items.find((i) => i.tripId === tripId)!;
      const debut = await debutDuScenario();
      /* 1-2. « Valider » → message, la carte sort. */
      await cartes(page).first().getByRole("button", { name: "Valider", exact: true }).click();
      await expect(page.getByText("Billet vérifié, Voyageur prévenu.", { exact: false })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("Rien à vérifier.", { exact: true }), "la carte sort de la file").toBeVisible({ timeout: 30_000 });
      /* 3. Fiche du trajet : document vérifié, trajet VERIFIED. */
      const fiche = (await (await sup.contexte.request.get(`${apiAdmin()}/admin/trips/${tripId}`)).json()) as { ticketVerificationStatus: string; documents: Doc[] };
      expect(fiche.ticketVerificationStatus).toBe("VERIFIED");
      expect(fiche.documents.find((d) => d.id === billet.documentId)?.status).toBe("VERIFIED");
      await page.goto(`${bo()}/trips/${tripId}`, { waitUntil: "domcontentloaded" });
      const ligneDoc = page.locator("div.flex.justify-between").filter({ hasText: billet.originalName ?? billet.documentId.slice(-6) });
      await expect(ligneDoc, "la ligne du billet dans la fiche").toHaveCount(1, { timeout: 60_000 });
      await expect(ligneDoc, "type et statut en français").toContainText(/^Billet · .+vérifié · /);
      /* 4. Page publique, visiteur : le badge. */
      const visiteur = await navigateurVisiteur();
      await visiteur.page.goto(`/fr/trips/${tripId}`, { waitUntil: "domcontentloaded" });
      await expect(visiteur.page.getByText("Billet vérifié").first()).toBeVisible({ timeout: 60_000 });
      /* 5. Rejouer l'appel : 400 TICKET_ALREADY_REVIEWED. */
      const rejoue = await decider(sup.contexte, billet.documentId, "VERIFY");
      expect(rejoue.status()).toBe(400);
      const corps = (await rejoue.json()) as Refus;
      expect(corps.message).toBe("This ticket was already reviewed.");
      expect(corps.details?.code).toBe("TICKET_ALREADY_REVIEWED");
      /* 6. ✉ « Billet vérifié », en français. */
      await expect.poll(() => mailpit.compter({ pour: COMPTES.thomas.email, sujet: "Billet vérifié pour ton trajet Paris → Brazzaville" }), { timeout: 60_000, message: "un email « Billet vérifié »" }).toBe(avant + 1);
      /* Journal : TICKET_VERIFIED TRIP · id, { documentId, reason: null } — et le refus n'écrit rien. */
      const lignes = (await lireLeJournal(lecteur.contexte.request, { from: debut, adminUserId: jeuEssai.admin("support").id })).filter((l) => l.action.startsWith("TICKET_"));
      expect(lignes.map((l) => `${l.action} ${l.targetType} · ${l.targetId}`)).toEqual([`TICKET_VERIFIED TRIP · ${tripId}`]);
      expect(lignes[0].after).toEqual({ documentId: billet.documentId, reason: null });
    } finally {
      new JeuEssai().rejouer();
    }
  });

  test("ADM-BIL-4 · rejeter un billet avec un motif fermé", async ({ navigateurAdmin, navigateurVisiteur, jeuEssai, mailpit }) => {
    test.setTimeout(6 * 60_000);
    const med = await navigateurAdmin("mediateur");
    const lecteur = await navigateurAdmin("finance");
    const tripId = jeuEssai.trajet("bzv-upcoming");
    try {
      const { page } = med;
      await ouvrirFile(page);
      const billet = (await lireFile(med.contexte)).items.find((i) => i.tripId === tripId)!;
      const carte = cartes(page).first();
      /* 1. Quatre motifs exactement, aucun texte libre. */
      const select = carte.locator("select");
      const options = (await select.locator("option").allInnerTexts()).map((t) => t.trim());
      expect(options, "« Rejeter : motif… » puis les quatre motifs").toEqual(["Rejeter : motif…", ...MOTIFS]);
      await expect(carte.locator("textarea, input[type=text]"), "aucun texte libre").toHaveCount(0);
      /* 2. « Rejeter » inactif sans motif. */
      const rejeter = carte.getByRole("button", { name: "Rejeter", exact: true });
      await expect(rejeter).toBeDisabled();
      const debut = await debutDuScenario();
      /* 3. « Les dates ne correspondent pas au trajet ». */
      await select.selectOption({ label: "Les dates ne correspondent pas au trajet" });
      await rejeter.click();
      await expect(page.getByText(/^Billet rejeté.*Voyageur prévenu\.$/)).toBeVisible({ timeout: 30_000 });
      const fiche = (await (await med.contexte.request.get(`${apiAdmin()}/admin/trips/${tripId}`)).json()) as { ticketVerificationStatus: string; documents: Array<Doc & { rejectionReason?: string | null }> };
      expect(fiche.ticketVerificationStatus).toBe("REJECTED");
      expect(fiche.documents.find((d) => d.id === billet.documentId)).toMatchObject({ status: "REJECTED", rejectionReason: "DATES_MISMATCH" });
      /* 4. ✉ « Billet non validé », avec le libellé du motif. */
      const email = await mailpit.attendreEmail({ pour: COMPTES.thomas.email, sujet: "Billet non validé pour ton trajet Paris → Brazzaville" }, 60_000);
      expect(email.texte + email.html, "le motif en clair").toMatch(/les dates ne correspondent pas au trajet/i);
      /* Journal. */
      const lignes = (await lireLeJournal(lecteur.contexte.request, { from: debut, adminUserId: jeuEssai.admin("mediateur").id })).filter((l) => l.action.startsWith("TICKET_"));
      expect(lignes.map((l) => `${l.action} ${l.targetType} · ${l.targetId}`)).toEqual([`TICKET_REJECTED TRIP · ${tripId}`]);
      expect(lignes[0].after).toEqual({ documentId: billet.documentId, reason: "DATES_MISMATCH" });
      /* 5-6. Thomas redépose → le trajet revient dans la file. */
      const thomas = await sessionMembre(navigateurVisiteur, COMPTES.thomas.email);
      const nouveau = await deposerBillet(thomas.contexte, tripId);
      expect((await lireTrajet(thomas.contexte, tripId)).ticket, "le trajet repasse en attente").toBe("PENDING");
      await ouvrirFile(page);
      await expect(cartes(page), "le trajet revient dans la file").toHaveCount(1, { timeout: 30_000 });
      expect((await lireFile(med.contexte)).items.map((i) => i.documentId)).toEqual([nouveau]);
    } finally {
      new JeuEssai().rejouer();
    }
  });

  test("ADM-BIL-5 · un administrateur ne vérifie pas son propre billet", async ({ navigateurAdmin, navigateurVisiteur, jeuEssai }) => {
    test.setTimeout(5 * 60_000);
    const sup = await navigateurAdmin("super");
    const lecteur = await navigateurAdmin("finance");
    const crees: string[] = [];
    try {
      /* Le super administrateur, connecté comme MEMBRE, publie un trajet et dépose un billet. */
      const membre = await sessionMembre(navigateurVisiteur, COMPTES_ADMIN.super.email);
      const trajet = await creerTrajet(membre.contexte, 18);
      crees.push(trajet);
      const doc = await deposerBillet(membre.contexte, trajet);
      const debut = await debutDuScenario();
      /* L'API refuse : 403 ADMIN_IS_OWNER. */
      const refus = await decider(sup.contexte, doc, "VERIFY");
      expect(refus.status(), "vérifier son propre billet : 403").toBe(403);
      expect(((await refus.json()) as Refus).details?.code).toBe("ADMIN_IS_OWNER");
      /* L'écran : pas de boutons de décision sur sa propre carte, et la raison dite. */
      await ouvrirFile(sup.page);
      const sienne = cartes(sup.page).filter({ has: sup.page.getByRole("button", { name: /billet-recette-bil/ }) });
      await expect(sienne).toHaveCount(1, { timeout: 30_000 });
      await expect(sienne.getByRole("button", { name: "Valider", exact: true }), "pas de « Valider » sur son propre billet").toHaveCount(0);
      await expect(sienne, "la raison est dite").toContainText("C'est ton propre trajet : un autre administrateur vérifie ce billet.");
      /* Et un autre administrateur le peut. */
      const med = await navigateurAdmin("mediateur");
      expect((await decider(med.contexte, doc, "VERIFY")).status(), "un autre administrateur valide").toBe(200);
      /* Journal : le refus n'écrit rien. */
      expect((await lireLeJournal(lecteur.contexte.request, { from: debut, adminUserId: jeuEssai.admin("super").id })).filter((l) => l.action.startsWith("TICKET_")), "aucune ligne pour le refus").toEqual([]);
    } finally {
      supprimerTrajets(crees);
    }
  });

  test("ADM-BIL-6 · le statut du trajet reste la synthèse de ses billets", async ({ navigateurAdmin, navigateurVisiteur }) => {
    test.setTimeout(5 * 60_000);
    const sup = await navigateurAdmin("support");
    const crees: string[] = [];
    try {
      const jo = await sessionMembre(navigateurVisiteur, COMPTES.josephine.email);
      const trajet = await creerTrajet(jo.contexte, 22);
      crees.push(trajet);
      /* A vérifié → VERIFIED. */
      const a = await deposerBillet(jo.contexte, trajet);
      expect((await decider(sup.contexte, a, "VERIFY")).status()).toBe(200);
      expect((await lireTrajet(jo.contexte, trajet)).ticket).toBe("VERIFIED");
      /* B déposé puis REJETÉ : A reste vérifié, le trajet aussi (un second billet illisible n'efface pas le premier). */
      const b = await deposerBillet(jo.contexte, trajet);
      expect((await lireTrajet(jo.contexte, trajet)).ticket, "B en attente : le trajet reste vérifié").toBe("VERIFIED");
      expect((await decider(sup.contexte, b, "REJECT", "ILLEGIBLE")).status()).toBe(200);
      const apresRejet = (await lireTrajet(jo.contexte, trajet)).ticket;
      test.info().annotations.push({ type: "constat", description: `A vérifié + B rejeté → trajet ${apresRejet}` });
      expect(apresRejet, "A vérifié + B rejeté → VERIFIED").toBe("VERIFIED");
      /* C déposé, puis A (le vérifié) supprimé par Joséphine : plus aucun billet vérifié → plus de badge. */
      await deposerBillet(jo.contexte, trajet);
      const suppr = await jo.contexte.request.delete(`${api()}/trips/${trajet}/documents/${a}`);
      expect(suppr.ok(), "suppression de A").toBe(true);
      const apresSuppression = (await lireTrajet(jo.contexte, trajet)).ticket;
      test.info().annotations.push({ type: "constat", description: `A supprimé, B rejeté, C en attente → trajet ${apresSuppression}` });
      expect(apresSuppression, "le badge ne survit pas au billet vérifié supprimé : PENDING (C en attente)").toBe("PENDING");
      const publique = (await (await jo.contexte.request.get(`${api()}/trips/${trajet}/public`)).json()) as unknown;
      expect(JSON.stringify(publique), "DTO public : plus de badge").toContain('"ticketVerified":false');
    } finally {
      supprimerTrajets(crees);
    }
  });

  test("ADM-BIL-7 · changer les faits vérifiés rouvre la vérification", async ({ navigateurAdmin, navigateurVisiteur, mailpit }) => {
    test.setTimeout(5 * 60_000);
    const sup = await navigateurAdmin("support");
    const crees: string[] = [];
    try {
      const jo = await sessionMembre(navigateurVisiteur, COMPTES.josephine.email);
      const trajet = await creerTrajet(jo.contexte, 24);
      crees.push(trajet);
      const a = await deposerBillet(jo.contexte, trajet);
      expect((await decider(sup.contexte, a, "VERIFY")).status()).toBe(200);
      /* Une modification SANS rapport avec le billet (le prix) : le badge reste. */
      const prix = await jo.contexte.request.put(`${api()}/trips/${trajet}`, { data: { pricePerKgCents: 1200 }, failOnStatusCode: false });
      expect(prix.ok(), `PUT prix : ${prix.status()} ${await prix.text()}`).toBe(true);
      expect((await lireTrajet(jo.contexte, trajet)).ticket, "changer le prix ne touche pas au billet").toBe("VERIFIED");
      /* La DATE de départ change : ce que l'équipe a attesté n'est plus vrai. */
      const nouvelleDate = new Date(Date.now() + 40 * 86_400_000);
      const date = await jo.contexte.request.put(`${api()}/trips/${trajet}`, { data: { departureAt: nouvelleDate.toISOString(), arrivalAt: new Date(nouvelleDate.getTime() + 86_400_000).toISOString() }, failOnStatusCode: false });
      expect(date.ok(), `PUT date : ${date.status()} ${await date.text()}`).toBe(true);
      const apres = await lireTrajet(jo.contexte, trajet);
      test.info().annotations.push({ type: "constat", description: `date de départ changée après vérification → trajet ${apres.ticket}, billet ${apres.documents.find((d) => d.id === a)?.status}` });
      expect(apres.ticket, "la vérification se rouvre").toBe("PENDING");
      expect(apres.documents.find((d) => d.id === a)?.status, "le billet revient en attente").toBe("PENDING");
      expect((await lireFile(sup.contexte)).items.map((i) => i.documentId), "et revient dans la file").toContain(a);
      /* Les villes aussi. */
      expect((await decider(sup.contexte, a, "VERIFY")).status()).toBe(200);
      const ville = await jo.contexte.request.put(`${api()}/trips/${trajet}`, { data: { destinationCity: "Lubumbashi" }, failOnStatusCode: false });
      expect(ville.ok(), `PUT ville : ${ville.status()} ${await ville.text()}`).toBe(true);
      expect((await lireTrajet(jo.contexte, trajet)).ticket, "changer la destination rouvre aussi").toBe("PENDING");
      void mailpit;
    } finally {
      supprimerTrajets(crees);
    }
  });

  test("ADM-BIL-8 · deux administrateurs sur le même billet", async ({ navigateurAdmin, navigateurVisiteur, jeuEssai }) => {
    test.setTimeout(5 * 60_000);
    const sup = await navigateurAdmin("support");
    const med = await navigateurAdmin("mediateur");
    const lecteur = await navigateurAdmin("finance");
    const crees: string[] = [];
    try {
      const jo = await sessionMembre(navigateurVisiteur, COMPTES.josephine.email);
      const trajet = await creerTrajet(jo.contexte, 26);
      crees.push(trajet);
      await deposerBillet(jo.contexte, trajet);
      /* Les deux écrans affichent le billet. */
      await ouvrirFile(sup.page);
      await ouvrirFile(med.page);
      const carteDe = (page: PageAdmin) => cartes(page).filter({ has: page.getByRole("button", { name: /billet-recette-bil/ }) });
      await expect(carteDe(sup.page)).toHaveCount(1, { timeout: 30_000 });
      await expect(carteDe(med.page)).toHaveCount(1, { timeout: 30_000 });
      const debut = await debutDuScenario();
      /* Le Support valide ; le Médiateur, sur un écran périmé, rejette ensuite. */
      await carteDe(sup.page).getByRole("button", { name: "Valider", exact: true }).click();
      await expect(sup.page.getByText(/Billet vérifié, Voyageur prévenu\./)).toBeVisible({ timeout: 30_000 });
      await carteDe(med.page).locator("select").selectOption({ label: "Document illisible" });
      await carteDe(med.page).getByRole("button", { name: "Rejeter", exact: true }).click();
      await expect(med.page.getByText("Ce billet vient d'être traité par un autre administrateur : la file est rechargée.", { exact: true }), "un refus lisible, pas « 400 : This ticket… »").toBeVisible({ timeout: 30_000 });
      await expect(carteDe(med.page), "la file du Médiateur est rechargée").toHaveCount(0, { timeout: 30_000 });
      /* Deux décisions SIMULTANÉES sur un nouveau billet : une seule gagne, jamais un 500. */
      const doc2 = await deposerBillet(jo.contexte, trajet);
      const [r1, r2] = await Promise.all([decider(sup.contexte, doc2, "VERIFY"), decider(med.contexte, doc2, "REJECT", "SUSPICIOUS")]);
      const statuts = [r1.status(), r2.status()].sort();
      test.info().annotations.push({ type: "constat", description: `deux décisions simultanées → ${statuts.join(" + ")}` });
      expect(statuts, "une décision, un refus").toEqual([200, 400]);
      const lignes = (await lireLeJournal(lecteur.contexte.request, { from: debut })).filter((l) => l.action.startsWith("TICKET_") && (l.after as { documentId?: string } | null)?.documentId === doc2);
      expect(lignes.length, "une seule ligne de décision pour le billet disputé").toBe(1);
      void jeuEssai;
    } finally {
      supprimerTrajets(crees);
    }
  });
});
