/**
 * adm-csv-exports.spec.ts — cahier 02-ADMIN, § 5.6 « Exports CSV » (ADM-EXP-1 à 3, + EXP-4 ajoutée)
 * =================================================================================================
 * Un export est la seule porte par laquelle des données SORTENT du back-office en masse. Chaque fiche prouve donc le
 * fichier lui-même, pas seulement le bouton :
 *  - **téléchargé par l'écran** (`page.waitForEvent("download")`), puis relu octet par octet (BOM) et **parsé** (RFC 4180) ;
 *  - **filtres écran = fichier** : les identifiants du fichier sont comparés à ceux de la liste servie à l'écran, lue
 *    page par page avec la MÊME requête que la page (capturée) ;
 *  - **contre-épreuves** consignées : une cellule-formule posée sur un compte (neutralisée ?), un nom de billet portant
 *    un numéro de téléphone (fuit-il dans l'export « opérationnel » ?), un jeton d'accès expiré (l'export tient-il ?) ;
 *  - **journal** relu par Finance (`audit.read`).
 * Toute manœuvre en base est défaite dans un `finally`.
 */
import { readFileSync } from "node:fs";
import { test, expect, type NavigateurAdmin } from "../fixtures/yamba";
import { JeuEssai } from "../fixtures/jeu-essai";
import { adresseDeLApiAdmin, adresseDuBackOffice } from "../fixtures/adresses";
import { lireLeJournal } from "../pages/journal-admin";
import { debutDuScenario, lireCoteServeur } from "../pages/ecran-admin";

const api = () => adresseDeLApiAdmin();
const bo = () => adresseDuBackOffice();
type Page = NavigateurAdmin["page"];
type Contexte = NavigateurAdmin["contexte"];

const MOTIF = "Recette ADM-EXP : contrôle du fichier exporté (colonnes, filtres, neutralisation).";
const USERS_COLUMNS = ["id", "firstName", "lastName", "email", "phoneE164", "roles", "adminRoles", "accountStatus", "carrierStatus", "stripeReady", "suspendedAt", "suspensionUntil", "createdAt"];
const TRIPS_COLUMNS = ["id", "status", "originCity", "originCountryCode", "destinationCity", "destinationCountryCode", "departureAt", "publishedAt", "cancelledAt", "carrierId", "transportMode", "capacityKg", "reservedKg", "pricePerKgCents", "ticketVerificationStatus", "hiddenByAdminAt", "createdAt"];
/** A156 (ANO-ADM-12) : `originalName` remplacé par `fileExtension` — écart documentaire assumé. */
const TICKETS_COLUMNS = ["documentId", "tripId", "originCity", "destinationCity", "departureAt", "carrierId", "fileExtension", "mimeType", "status", "submittedAt"];
const ARBITRATION_COLUMNS = ["bookingId", "kind", "ticketNumber", "category", "openedAt", "originCity", "destinationCity", "amountCents", "currencyCode", "shipperId", "carrierId", "carrierResponded", "decidableAt"];

const EMAIL = /[^\s@,;"']+@[^\s@,;"']+\.[a-z]{2,}/i;
const TELEPHONE = /(?:\+|\b00)\d{8,14}\b|\b0[1-9](?:[ .-]?\d{2}){4}\b/;

/** Parseur RFC 4180 minimal (guillemets doublés, virgules et retours ligne encadrés). */
function parserCsv(texte: string): string[][] {
  const lignes: string[][] = [];
  let ligne: string[] = [];
  let cellule = "";
  let entre = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (entre) {
      if (c === '"' && texte[i + 1] === '"') { cellule += '"'; i++; }
      else if (c === '"') entre = false;
      else cellule += c;
    } else if (c === '"') entre = true;
    else if (c === ",") { ligne.push(cellule); cellule = ""; }
    else if (c === "\r" && texte[i + 1] === "\n") { ligne.push(cellule); lignes.push(ligne); ligne = []; cellule = ""; i++; }
    else cellule += c;
  }
  if (cellule || ligne.length) { ligne.push(cellule); lignes.push(ligne); }
  return lignes;
}

type Fichier = { nom: string; brut: Buffer; texte: string; entete: string[]; lignes: Record<string, string>[] };

/** Clique un bouton d'export et rend le fichier téléchargé, relu et parsé. */
async function telecharger(page: Page, declencheur: () => Promise<void>): Promise<Fichier> {
  const attente = page.waitForEvent("download", { timeout: 60_000 });
  await declencheur();
  const dl = await attente;
  const brut = readFileSync((await dl.path())!);
  const texte = brut.toString("utf-8").replace(/^﻿/, "");
  const [entete, ...corps] = parserCsv(texte);
  return { nom: dl.suggestedFilename(), brut, texte, entete, lignes: corps.map((l) => Object.fromEntries(entete.map((k, i) => [k, l[i] ?? ""]))) };
}

/** Toutes les lignes que la LISTE de l'écran sert pour la même requête (capturée), page par page. */
async function idsDeLaListe(ctx: Contexte, urlDeLaPage: string, cle = "id"): Promise<string[]> {
  const u = new URL(urlDeLaPage);
  u.searchParams.delete("cursor");
  u.searchParams.set("limit", "100");
  const ids: string[] = [];
  let cursor: string | null = null;
  for (let n = 0; n < 200; n++) {
    if (cursor) u.searchParams.set("cursor", cursor);
    const r = (await (await ctx.request.get(u.toString())).json()) as { items: Array<Record<string, string>>; nextCursor?: string | null };
    ids.push(...r.items.map((i) => i[cle]));
    cursor = r.nextCursor ?? null;
    if (!cursor) break;
  }
  return ids;
}

/** Aucune adresse email ni aucun numéro de téléphone dans les cellules (l'en-tête exclu). */
function donneesPersonnelles(f: Fichier): string[] {
  return f.lignes.flatMap((l) => Object.entries(l).filter(([, v]) => EMAIL.test(v) || TELEPHONE.test(v)).map(([k, v]) => `${k}=${v}`));
}

test.describe("ADM-EXP — exports CSV (cahier 02-ADMIN § 5.6)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(() => {
    new JeuEssai().rejouer();
  });

  test("ADM-EXP-1 · export nominatif des membres", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(8 * 60_000);
    const pri = await navigateurAdmin("privacy");
    const lecteur = await navigateurAdmin("finance");
    const { page, contexte } = pri;
    /* Contre-épreuve de neutralisation : un Voyageur dont le nom est une formule (manœuvre consignée, défaite). */
    const cible = lireCoteServeur<{ id: string; lastName: string; roles: string[] }>(`
      import prisma from "./packages/libs/prisma";
      (async () => { const u = await prisma.user.findUnique({ where: { id: ${JSON.stringify(jeuEssai.membre("thomas"))} }, select: { id: true, lastName: true, roles: true } });
        console.log("@@" + JSON.stringify(u)); process.exit(0); })();`);
    expect(cible?.roles, "Thomas, Voyageur du jeu d'essai").toContain("CARRIER");
    const FORMULE = '=HYPERLINK("http://exemple.invalid","clic")';
    const poserNom = (nom: string) => lireCoteServeur(`
      import prisma from "./packages/libs/prisma";
      (async () => { await prisma.user.update({ where: { id: ${JSON.stringify(cible.id)} }, data: { lastName: ${JSON.stringify(nom)} } }); console.log("@@true"); process.exit(0); })();`);
    poserNom(FORMULE);
    process.stdout.write(`   ↳ manœuvre base : lastName du compte ${cible.id} = formule (ADM-EXP-1)\n`);
    try {
      const debut = await debutDuScenario();
      /* 1. /users, filtre « Voyageur » ; on capture la requête de la liste. */
      await page.goto(`${bo()}/users`, { waitUntil: "domcontentloaded" });
      await expect(page.getByText(/affiché\(s\) · \d+ au total/)).toBeVisible({ timeout: 60_000 });
      const liste = page.waitForResponse((r) => /\/admin\/users\?/.test(r.url()) && r.url().includes("role=CARRIER"), { timeout: 30_000 });
      await page.locator("select").filter({ has: page.locator("option", { hasText: "tous rôles" }) }).selectOption("CARRIER");
      const urlListe = (await liste).url();
      /* 2-3. Le bouton rouge, le panneau. */
      const bouton = page.getByRole("button", { name: "Exporter en CSV (données personnelles)", exact: true });
      await expect(bouton).toHaveClass(/border-red-300/);
      await bouton.click();
      await expect(page.getByText("Export nominatif : le motif est écrit au journal avec les filtres et le nombre de lignes (RGPD).", { exact: true })).toBeVisible();
      /* 4. Motif court : bouton inerte à l'écran, 400 côté serveur. */
      const motif = page.getByLabel("Motif de l'export");
      await motif.fill("Motif trop court !!");
      await expect(page.getByText("19 / 20", { exact: true }), "amélioration : compteur de caractères").toBeVisible();
      await expect(page.getByRole("button", { name: "Télécharger", exact: true })).toBeDisabled();
      const court = await contexte.request.get(`${api()}/admin/users/export?role=CARRIER&reason=${encodeURIComponent("trop court")}`, { failOnStatusCode: false });
      expect(court.status(), "motif < 20 : 400").toBe(400);
      const corpsCourt = (await court.json()) as { message: string; details?: { code?: string } };
      expect(corpsCourt.message).toBe("A reason of at least 20 characters is required for a personal-data export.");
      expect(corpsCourt.details?.code).toBe("REASON_TOO_SHORT");
      /* 5. Motif valide → le fichier. */
      await motif.fill(MOTIF);
      const f = await telecharger(page, () => page.getByRole("button", { name: "Télécharger", exact: true }).click());
      expect(f.nom, "nom du fichier").toMatch(/^yamba-utilisateurs-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.csv$/);
      test.info().annotations.push({ type: "écart documentaire", description: `nom servi « ${f.nom} » (le cahier écrit « utilisateurs-<date>.csv »)` });
      /* 6. BOM, colonnes, filtres, neutralisation. */
      expect([...f.brut.subarray(0, 3)], "BOM UTF-8 (EF BB BF)").toEqual([0xef, 0xbb, 0xbf]);
      expect(f.entete, "colonnes du cahier").toEqual(USERS_COLUMNS);
      expect(f.lignes.length, "au moins un Voyageur").toBeGreaterThan(0);
      expect(f.lignes.filter((l) => !l.roles.split("|").includes("CARRIER")).map((l) => l.id), "le filtre « Voyageur » est appliqué").toEqual([]);
      expect(new Set(f.lignes.map((l) => l.id)), "fichier = liste de l'écran (mêmes filtres)").toEqual(new Set(await idsDeLaListe(contexte, urlListe)));
      const piege = f.lignes.find((l) => l.id === cible.id);
      expect(piege?.lastName, "la formule est neutralisée par une apostrophe").toBe(`'${FORMULE}`);
      expect(f.texte, "et encadrée selon RFC 4180 (guillemets doublés)").toContain(`"'=HYPERLINK(""http://exemple.invalid"",""clic"")"`);
      const telephones = f.lignes.map((l) => l.phoneE164).filter(Boolean);
      expect(telephones.every((t) => t.startsWith("'+")), "un +33… commence comme une formule : neutralisé lui aussi").toBe(true);
      test.info().annotations.push({ type: "constat", description: `${f.lignes.length} Voyageurs exportés ; ${telephones.length} téléphones servis « '+… » (prix connu de la neutralisation)` });
      await expect(page.getByRole("status"), "amélioration : le nombre de lignes est annoncé").toHaveText(new RegExp(`^${f.lignes.length} lignes? exportées? — yamba-utilisateurs-.+\\.csv, journalisé\\.$`));
      /* ANO-ADM-13 — jeton d'accès expiré (simulé : cookie retiré) : l'export rafraîchit la session et aboutit. */
      await contexte.clearCookies({ name: "admin_access_token" });
      /* Contre-épreuve : ce que l'ANCIEN bouton (onglet ouvert sur l'URL) affichait — un 401 JSON, sans rafraîchissement. */
      const brut = await contexte.request.get(`${api()}/admin/users/export?role=CARRIER&reason=${encodeURIComponent(MOTIF)}`, { failOnStatusCode: false });
      expect(brut.status(), "l'URL seule, jeton d'accès expiré : 401 (ce que montrait l'onglet)").toBe(401);
      await bouton.click();
      await page.getByLabel("Motif de l'export").fill(MOTIF);
      const f2 = await telecharger(page, () => page.getByRole("button", { name: "Télécharger", exact: true }).click());
      expect(f2.lignes.length, "après expiration du jeton d'accès, l'export aboutit (ANO-ADM-13)").toBe(f.lignes.length);
      /* Journal : deux EXPORTED USER sans identifiant. */
      const lignes = (await lireLeJournal(lecteur.contexte.request, { from: debut, adminUserId: jeuEssai.admin("privacy").id })).filter((l) => l.action === "EXPORTED");
      expect(lignes.map((l) => `${l.targetType} · ${l.targetId}`), "deux exports").toEqual(["USER · null", "USER · null"]);
      expect(lignes[0].after).toMatchObject({ domain: "users", personal: true, reason: MOTIF, filters: { role: "CARRIER" }, rows: f.lignes.length, truncated: false });
      /* 7. Médiateur : ni bouton, ni fichier. */
      const med = await navigateurAdmin("mediateur");
      await med.page.goto(`${bo()}/users`, { waitUntil: "domcontentloaded" });
      await expect(med.page.getByText(/affiché\(s\) · \d+ au total/)).toBeVisible({ timeout: 60_000 });
      await expect(med.page.getByRole("button", { name: /Exporter en CSV/ }), "aucun bouton d'export pour le Médiateur").toHaveCount(0);
      const refus = await med.contexte.request.get(`${api()}/admin/users/export?reason=${encodeURIComponent(MOTIF)}`, { failOnStatusCode: false });
      expect(refus.status(), "appel direct : 403").toBe(403);
      expect(((await refus.json()) as { details?: { code?: string } }).details?.code).toBe("ADMIN_PERMISSION_DENIED");
      /* Précondition du cahier : le super administrateur voit aussi le bouton. */
      const sup = await navigateurAdmin("super");
      await sup.page.goto(`${bo()}/users`, { waitUntil: "domcontentloaded" });
      await expect(sup.page.getByRole("button", { name: "Exporter en CSV (données personnelles)", exact: true })).toBeVisible({ timeout: 60_000 });
    } finally {
      poserNom(cible.lastName);
    }
  });

  test("ADM-EXP-2 · exports opérationnels : jamais d'email ni de téléphone", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(8 * 60_000);
    const fin = await navigateurAdmin("finance");
    const { page, contexte } = fin;
    /* Contre-épreuve : le billet en attente reçoit un nom de fichier portant un numéro (mesuré en base :
       « sfr-facture-0752426937-0.pdf » existe chez un membre). */
    const billet = lireCoteServeur<{ id: string; originalName: string } | null>(`
      import prisma from "./packages/libs/prisma";
      (async () => { console.log("@@" + JSON.stringify(await prisma.tripDocument.findFirst({ where: { type: "TICKET_PROOF", status: "PENDING" }, select: { id: true, originalName: true } }))); process.exit(0); })();`);
    expect(billet, "le jeu d'essai pose un billet en attente").toBeTruthy();
    const poserNomBillet = (nom: string) => lireCoteServeur(`
      import prisma from "./packages/libs/prisma";
      (async () => { await prisma.tripDocument.update({ where: { id: ${JSON.stringify(billet!.id)} }, data: { originalName: ${JSON.stringify(nom)} } }); console.log("@@true"); process.exit(0); })();`);
    poserNomBillet("sfr-facture-0752426937-0.pdf");
    process.stdout.write(`   ↳ manœuvre base : originalName du billet ${billet!.id} = nom portant un téléphone (ADM-EXP-2)\n`);
    try {
      const debut = await debutDuScenario();
      /* 1. /trips — avec un filtre (statut), pour prouver filtres écran = fichier. */
      await page.goto(`${bo()}/trips`, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("button", { name: "Exporter en CSV", exact: true })).toBeVisible({ timeout: 60_000 });
      const liste = page.waitForResponse((r) => /\/admin\/trips\?/.test(r.url()) && r.url().includes("status=PUBLISHED"), { timeout: 30_000 });
      await page.locator("select").filter({ has: page.locator("option", { hasText: "tous statuts" }) }).selectOption("PUBLISHED");
      const urlTrajets = (await liste).url();
      const trajets = await telecharger(page, () => page.getByRole("button", { name: "Exporter en CSV", exact: true }).click());
      expect(trajets.entete).toEqual(TRIPS_COLUMNS);
      expect(trajets.lignes.every((l) => l.status === "PUBLISHED"), "filtre appliqué").toBe(true);
      expect(new Set(trajets.lignes.map((l) => l.id)), "fichier = liste (mêmes filtres)").toEqual(new Set(await idsDeLaListe(contexte, urlTrajets)));
      await expect(page.getByRole("status")).toHaveText(new RegExp(`^${trajets.lignes.length} lignes? exportées? — yamba-trajets-`));
      /* 2. /tickets. */
      await page.goto(`${bo()}/tickets`, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("button", { name: "Exporter en CSV", exact: true })).toBeVisible({ timeout: 60_000 });
      const billets = await telecharger(page, () => page.getByRole("button", { name: "Exporter en CSV", exact: true }).click());
      expect(billets.entete, "A156 : fileExtension à la place de originalName").toEqual(TICKETS_COLUMNS);
      const ligneBillet = billets.lignes.find((l) => l.documentId === billet!.id);
      expect(ligneBillet?.fileExtension, "seule l'extension sort").toBe("pdf");
      /* 3. /disputes. */
      await page.goto(`${bo()}/disputes`, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("button", { name: "Exporter en CSV", exact: true })).toBeVisible({ timeout: 60_000 });
      const dossiers = await telecharger(page, () => page.getByRole("button", { name: "Exporter en CSV", exact: true }).click());
      expect(dossiers.entete).toEqual(ARBITRATION_COLUMNS);
      /* 4-5. Aucune donnée personnelle, dans aucun des trois — ni en clair, ni cachée dans un nom de fichier. */
      for (const [nom, f] of [["trajets", trajets], ["billets", billets], ["dossiers", dossiers]] as const) {
        expect([...f.brut.subarray(0, 3)], `${nom} : BOM`).toEqual([0xef, 0xbb, 0xbf]);
        expect(donneesPersonnelles(f), `${nom} : aucune adresse email ni aucun téléphone (RG-ADM-32)`).toEqual([]);
      }
      test.info().annotations.push({ type: "constat", description: `trajets ${trajets.lignes.length} (PUBLISHED) · billets ${billets.lignes.length} · dossiers ${dossiers.lignes.length}` });
      /* Journal : trois lignes, sans identifiant, avec la troncature dite. */
      const lignes = (await lireLeJournal(contexte.request, { from: debut, adminUserId: jeuEssai.admin("finance").id })).filter((l) => l.action === "EXPORTED");
      expect(lignes.map((l) => `${l.targetType} · ${l.targetId} · ${(l.after as { domain: string }).domain}`)).toEqual(["TRIP · null · trips", "TRIP · null · tickets", "BOOKING · null · arbitration"]);
      expect(lignes[0].after).toMatchObject({ personal: false, filters: { status: "PUBLISHED" }, rows: trajets.lignes.length, truncated: false });
      expect(lignes[1].after).toMatchObject({ personal: false, rows: billets.lignes.length, truncated: false });
      expect(lignes[2].after).toMatchObject({ personal: false, rows: dossiers.lignes.length, truncated: false });
    } finally {
      poserNomBillet(billet!.originalName);
    }
  });

  test("ADM-EXP-3 · le Support n'exporte rien", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(5 * 60_000);
    const sup = await navigateurAdmin("support");
    const lecteur = await navigateurAdmin("finance");
    const debut = await debutDuScenario();
    /* Les écrans : attendre que chacun ait chargé sa liste (sinon « aucun bouton » ne prouve rien). */
    const ecrans: Array<[string, RegExp]> = [["/users", /\/admin\/users\?/], ["/trips", /\/admin\/trips\?/], ["/tickets", /\/admin\/tickets/], ["/disputes", /\/admin\/disputes/]];
    for (const [chemin, appel] of ecrans) {
      const charge = sup.page.waitForResponse((r) => appel.test(r.url()) && r.request().method() === "GET", { timeout: 60_000 });
      await sup.page.goto(`${bo()}${chemin}`, { waitUntil: "domcontentloaded" });
      expect((await charge).status(), `${chemin} : la liste est lisible par le Support`).toBeLessThan(400);
      await sup.page.waitForTimeout(1_500); // /admin/me arrive en parallèle : le bouton dépend du profil
      await expect(sup.page.getByRole("button", { name: /Exporter en CSV/ }), `${chemin} : aucun bouton d'export`).toHaveCount(0);
    }
    for (const route of [`/admin/users/export?reason=${encodeURIComponent(MOTIF)}`, "/admin/trips/export", "/admin/tickets/export", "/admin/disputes/export"]) {
      const r = await sup.contexte.request.get(`${api()}${route}`, { failOnStatusCode: false });
      expect(r.status(), `${route} : 403`).toBe(403);
      expect(((await r.json()) as { details?: { code?: string } }).details?.code).toBe("ADMIN_PERMISSION_DENIED");
    }
    const ecrites = await lireLeJournal(lecteur.contexte.request, { from: debut, adminUserId: jeuEssai.admin("support").id });
    expect(ecrites.filter((l) => l.action === "EXPORTED"), "aucune ligne d'export").toEqual([]);
  });

  test("ADM-EXP-4 · un refus s'affiche en français, sans onglet ni fichier (amélioration)", async ({ navigateurAdmin }) => {
    test.setTimeout(4 * 60_000);
    const med = await navigateurAdmin("mediateur");
    const { page } = med;
    await page.goto(`${bo()}/disputes`, { waitUntil: "domcontentloaded" });
    const bouton = page.getByRole("button", { name: "Exporter en CSV", exact: true });
    await expect(bouton, "le Médiateur a exports.operational").toBeVisible({ timeout: 60_000 });
    /* Le Médiateur exporte pour de vrai… */
    const attente = page.waitForEvent("download", { timeout: 60_000 });
    await bouton.click();
    expect((await attente).suggestedFilename()).toMatch(/^yamba-a-arbitrer-.+\.csv$/);
    /* …puis le serveur refuse (403 simulé à la frontière réseau) : un message lisible, aucun fichier, aucun onglet. */
    await page.route("**/admin/disputes/export**", (r) => r.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ status: "error", message: "Your admin profile does not allow this action.", details: { code: "ADMIN_PERMISSION_DENIED", permission: "exports.operational" } }) }));
    let fichier = false;
    page.on("download", () => { fichier = true; });
    const onglets = med.contexte.pages().length;
    await bouton.click();
    await expect(page.getByRole("status")).toHaveText("Ton profil ne permet pas cet export.", { timeout: 15_000 });
    await page.waitForTimeout(1_500);
    expect(fichier, "aucun fichier").toBe(false);
    expect(med.contexte.pages().length, "aucun onglet ouvert").toBe(onglets);
    await page.unroute("**/admin/disputes/export**");
  });
});
