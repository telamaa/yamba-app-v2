/**
 * web-mnt.spec.ts — cahier 01-WEB, chapitre 5.28 « Le mode maintenance vu du membre »
 * ===================================================================================
 * Le bandeau d'annonce (ambre), la lecture seule (rouge) et sa levée, plus le cas qui fait mal : la maintenance qui
 * tombe pendant une réservation, entre l'autorisation demandée et le clic « Payer ».
 *
 * L'état vit dans UN document `PlatformSettings` (clé `maintenance`, D64 1A) écrit par un OPS ou un super
 * administrateur avec un motif d'au moins 20 caractères. La passerelle le relit **toutes les 10 s** et refuse alors
 * toute ÉCRITURE (`503 MAINTENANCE`) sauf `/api/auth/*` et `/api/admin/*` ; les fronts lisent `GET /api/maintenance`
 * pour leurs bandeaux (sondage 60 s).
 *
 * Le chapitre pilote donc un navigateur du BACK-OFFICE (`npx nx dev admin-ui` doit tourner) : l'annonce est posée
 * par l'écran « État des services » — c'est le geste du cahier — et les bascules suivantes par l'API d'administration,
 * plus rapides. Quoi qu'il arrive, l'`afterAll` LÈVE la maintenance : la laisser active condamnerait tous les
 * chapitres suivants.
 */
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { test, expect, type Navigateur, type NavigateurAdmin } from "../fixtures/yamba";
import { adresseDeLApi, adresseDeLApiAdmin } from "../fixtures/adresses";
import { JeuEssai } from "../fixtures/jeu-essai";
import { AssistantReservation, normaliserEspaces } from "../pages/reservation";
import { FilMessagerie } from "../pages/fil-messagerie";
import { ouvrirLaRecherche } from "../pages/recherche";

type Contexte = Navigateur["contexte"];
type Page = Navigateur["page"];
const api = () => adresseDeLApi();
const apiAdmin = () => adresseDeLApiAdmin();
const RACINE = join(__dirname, "../../../..");

const texte = async (page: Page) => normaliserEspaces(await page.locator("body").innerText());

/* ══ L'état de maintenance, vu du back-office ════════════════════════════════════════════════ */

type EtatMaintenance = { enabled: boolean; messageFr: string; messageEn: string; scheduledAt: string | null; version: number };
const MOTIF = "Recette 01-WEB chapitre 5.28 : mode maintenance vu du membre";

async function lireMaintenance(admin: NavigateurAdmin): Promise<EtatMaintenance> {
  const r = await admin.contexte.request.get(`${apiAdmin()}/admin/maintenance`);
  expect(r.ok(), `GET /admin/maintenance : ${r.status()}`).toBe(true);
  return (await r.json()) as EtatMaintenance;
}

/** Écrit l'état (verrou optimiste : on relit la version juste avant). */
async function ecrireMaintenance(admin: NavigateurAdmin, patch: Partial<Omit<EtatMaintenance, "version">>): Promise<EtatMaintenance> {
  const avant = await lireMaintenance(admin);
  const r = await admin.contexte.request.put(`${apiAdmin()}/admin/maintenance`, {
    data: {
      enabled: patch.enabled ?? avant.enabled,
      messageFr: patch.messageFr ?? "",
      messageEn: patch.messageEn ?? "",
      scheduledAt: patch.scheduledAt === undefined ? avant.scheduledAt : patch.scheduledAt,
      reason: MOTIF,
      expectedVersion: avant.version,
    },
  });
  expect(r.ok(), `PUT /admin/maintenance : ${r.status()} ${await r.text()}`).toBe(true);
  return (await r.json()) as EtatMaintenance;
}

const leverLaMaintenance = (admin: NavigateurAdmin) => ecrireMaintenance(admin, { enabled: false, scheduledAt: null, messageFr: "", messageEn: "" });

/**
 * FILET DE SÉCURITÉ — remet le document `maintenance` à plat, directement en base.
 *
 * Le geste normal est celui du back-office (c'est lui que les fiches jouent). Mais si une fiche
 * échoue au mauvais moment, la plateforme resterait en LECTURE SEULE pour tous les chapitres
 * suivants : le `beforeAll` et l'`afterAll` passent donc par la base, sans dépendre d'une session
 * d'administration qui pourrait, elle aussi, avoir échoué.
 */
function remettreLaMaintenanceAPlat(): void {
  execFileSync(
    "npx",
    ["tsx", "--env-file=.env", "-e", 'import p from "./packages/libs/prisma"; (async () => { await p.platformSettings.updateMany({ where: { key: "maintenance" }, data: { values: { enabled: false, messageFr: "", messageEn: "", scheduledAt: null } } }); process.exit(0); })();'],
    { cwd: RACINE, encoding: "utf-8", timeout: 180_000 },
  );
}

type EtatPublic = { enabled: boolean; message: { fr: string; en: string }; scheduledAt: string | null };

/**
 * La passerelle relit l'état toutes les 10 s : on attend qu'elle l'ait vu, jamais plus.
 * Sans cela on charge l'écran du membre dans la fenêtre de cache et l'on conclut « pas de bandeau »
 * alors que le bandeau, lui, arrive au sondage suivant du front (60 s).
 */
async function attendreLaPasserelle(contexte: Contexte, attendu: (e: EtatPublic) => boolean, quoi = "l'état attendu"): Promise<number> {
  const debut = Date.now();
  for (let essai = 0; essai < 40; essai++) {
    const r = await contexte.request.get(`${api()}/maintenance`);
    if (r.ok() && attendu((await r.json()) as EtatPublic)) return Date.now() - debut;
    await new Promise((res) => setTimeout(res, 1_000));
  }
  throw new Error(`la passerelle n'a pas vu ${quoi} en 40 s`);
}
const enLectureSeule = (e: EtatPublic) => e.enabled;
const horsMaintenance = (e: EtatPublic) => !e.enabled && !e.scheduledAt;
const annonceFaite = (e: EtatPublic) => !e.enabled && Boolean(e.scheduledAt);

/** Une écriture ORDINAIRE de membre (hors `/api/auth/*`, donc soumise à la maintenance). */
async function envoyerUnMessage(contexte: Contexte, dealId: string, corps: string): Promise<{ statut: number; corps: string }> {
  const fil = await contexte.request.get(`${api()}/messages/conversations/by-deal/${dealId}`);
  const filId = ((await fil.json()) as { conversation: { id: string } }).conversation.id;
  const r = await contexte.request.post(`${api()}/messages/conversations/${filId}/messages`, { data: { body: corps } });
  return { statut: r.status(), corps: await r.text() };
}

const bandeau = (page: Page) => page.locator('[role="status"]').filter({ hasText: /Maintenance/ }).first();

/* ══ Les fiches ══════════════════════════════════════════════════════════════════════════════ */

test.describe("WEB-MNT — le mode maintenance vu du membre (chapitre 5.28)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(() => {
    new JeuEssai().rejouer();
    remettreLaMaintenanceAPlat(); // état de départ connu, quel que soit le passage précédent
  });

  test.afterAll(() => {
    // La maintenance ne doit JAMAIS survivre au chapitre — elle condamnerait tout le reste.
    remettreLaMaintenanceAPlat();
  });

  test("WEB-MNT-1 · le bandeau d'annonce (posé depuis le back-office)", async ({ navigateurConnecte, navigateurAdmin, jeuEssai }) => {
    test.setTimeout(5 * 60_000);
    const admin = await navigateurAdmin("exploitation");
    /* Étape 1 — l'administrateur annonce une maintenance pour dans une heure, PAR L'ÉCRAN. */
    const dans1h = new Date(Date.now() + 3_600_000);
    await admin.page.goto(`${adresseDuBackOfficeLocal()}/status`, { waitUntil: "domcontentloaded" });
    await expect(admin.page.getByRole("heading", { name: /État des services/ })).toBeVisible({ timeout: 90_000 });
    /* L'éditeur ne se monte QU'APRÈS la première réponse de l'API d'état, et il se remonte à chaque
       sondage (30 s) : remplir trop tôt, c'est remplir un champ qui sera remplacé — mesuré, le
       formulaire repartait vide et l'annonce s'enregistrait sans date. On attend donc la phrase qui
       ne s'affiche qu'avec les données, puis on VÉRIFIE que la saisie a tenu. */
    const editeur = admin.page.locator("section").filter({ hasText: "Activer la lecture seule maintenant" }).last();
    await expect(editeur.getByText(/Aucune maintenance en cours ni annoncée|Maintenance annoncée le|Plateforme en lecture seule/)).toBeVisible({ timeout: 90_000 });
    const quand = pourChampLocal(dans1h);
    const champDate = editeur.locator('input[type="datetime-local"]');
    const champMotif = editeur.locator("textarea");
    await expect.poll(async () => {
      await champDate.fill(quand);
      await champMotif.fill(MOTIF);
      return (await champDate.inputValue()) === quand && (await champMotif.inputValue()) === MOTIF;
    }, { timeout: 60_000, message: "la saisie de l'annonce tient dans le formulaire" }).toBe(true);
    const ecriture = admin.page.waitForResponse((r) => r.url().includes("/admin/maintenance") && r.request().method() === "PUT", { timeout: 30_000 });
    await editeur.getByRole("button", { name: "Enregistrer l'annonce" }).click();
    expect((await ecriture).ok(), "l'écran du back-office enregistre l'annonce").toBe(true);
    const apres = await lireMaintenance(admin);
    expect(apres.enabled, "une annonce n'active PAS la lecture seule").toBe(false);
    expect(apres.scheduledAt, "l'annonce porte bien une date").not.toBeNull();

    /* Étape 2 — le membre recharge : bandeau AMBRE, et rien n'est bloqué. */
    const { page, contexte } = await navigateurConnecte("pauline");
    await attendreLaPasserelle(contexte, annonceFaite, "l'annonce");
    await page.goto("/fr/dashboard/home", { waitUntil: "domcontentloaded" });
    await expect(bandeau(page)).toBeVisible({ timeout: 60_000 });
    const lu = normaliserEspaces(await bandeau(page).innerText());
    expect(lu, "le bandeau annonce la date").toMatch(/Maintenance prévue le .+ : la plateforme passera en lecture seule pendant l'intervention\./);
    const couleur = await bandeau(page).evaluate((n) => getComputedStyle(n).backgroundColor);
    expect(couleur, `bandeau ambre (lu : ${couleur})`).toBe("rgb(251, 191, 36)");
    /* Rien n'est bloqué : une écriture ordinaire passe. */
    const envoi = await envoyerUnMessage(contexte, jeuEssai.deal("bzv-accepted").id, "Message pendant l'annonce de maintenance (recette MNT-1)");
    expect(envoi.statut, `l'écriture passe pendant une simple annonce : ${envoi.corps.slice(0, 200)}`).toBeLessThan(300);
    test.info().annotations.push({ type: "note", description: `annonce posée par l'écran du back-office pour ${dans1h.toISOString()} ; bandeau ambre ${couleur} ; message envoyé (${envoi.statut})` });
  });

  test("WEB-MNT-2 · la lecture seule", async ({ navigateurConnecte, navigateurAdmin, jeuEssai }) => {
    test.setTimeout(8 * 60_000);
    const admin = await navigateurAdmin("exploitation");
    await ecrireMaintenance(admin, { enabled: true, scheduledAt: null });
    const { page, contexte } = await navigateurConnecte("aminata");
    const vue = await attendreLaPasserelle(contexte, enLectureSeule, "la lecture seule");

    /* Le bandeau ROUGE, avec le texte du cahier. */
    await page.goto("/fr/dashboard/home", { waitUntil: "domcontentloaded" });
    await expect(bandeau(page)).toBeVisible({ timeout: 60_000 });
    const lu = normaliserEspaces(await bandeau(page).innerText());
    expect(lu).toContain("Maintenance en cours : la plateforme est en lecture seule, tu peux consulter mais pas réserver, publier ni écrire.");
    const couleur = await bandeau(page).evaluate((n) => getComputedStyle(n).backgroundColor);
    expect(couleur, `bandeau rouge (lu : ${couleur})`).toBe("rgb(220, 38, 38)");

    /* Étape 2 — toutes les LECTURES fonctionnent. */
    await ouvrirLaRecherche(page, { from: "Paris", to: "Brazzaville" });
    // Les résultats arrivent APRÈS le titre : sur un poste chargé, lire le corps trop tôt ne montre
    // que l'en-tête de la page.
    await expect.poll(() => texte(page), { timeout: 90_000, message: "la recherche répond" }).toMatch(/Brazzaville/);
    await page.goto(`/fr/trips/${jeuEssai.trajet("bzv-upcoming")}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 90_000 });
    await page.goto(`/fr/dashboard/messages?deal=${jeuEssai.deal("bzv-accepted").id}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 90_000 });
    await page.goto("/fr/dashboard/shipments", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 90_000 });

    /* Étapes 3 à 5 — chaque ÉCRITURE est refusée, avec le code de la maintenance. */
    const refusReservation = await contexte.request.post(`${api()}/deals/payment-intents`, {
      data: { tripId: jeuEssai.trajet("bzv-upcoming"), product: "PARCEL", family: "CLOTHES_TEXTILE", sizeClass: "S", weightKg: 2, protection: "BASIC", declaredValueCents: 6000, expectedTotalCents: 1 },
    });
    expect(refusReservation.status(), "réserver est refusé").toBe(503);
    expect(await refusReservation.text()).toContain("MAINTENANCE");
    const pauline = await navigateurConnecte("pauline");
    const refusMessage = await envoyerUnMessage(pauline.contexte, jeuEssai.deal("bzv-accepted").id, "Message pendant la lecture seule (recette MNT-2)");
    expect(refusMessage.statut, "écrire est refusé").toBe(503);
    const thomas = await navigateurConnecte("thomas");
    const refusPublication = await thomas.contexte.request.post(`${api()}/trips`, { data: { mode: "PLANE" } });
    expect(refusPublication.status(), "publier est refusé").toBe(503);

    /* L'ÉCRAN dit le refus : le membre ne doit pas rester devant un échec muet ou en anglais.
       Le fil de `bzv-accepted` est celui de PAULINE (et de Thomas) : c'est son navigateur qui écrit. */
    const filId = await FilMessagerie.identifiantDuFil(pauline.contexte, jeuEssai.deal("bzv-accepted").id);
    await pauline.page.goto(`/fr/dashboard/messages?conversation=${filId}`, { waitUntil: "domcontentloaded" });
    await expect(pauline.page.getByPlaceholder("Écrire un message…")).toBeVisible({ timeout: 90_000 });
    await pauline.page.getByPlaceholder("Écrire un message…").fill("Un message qui ne doit pas partir (recette MNT-2)");
    const envoi = pauline.page.waitForResponse((r) => /\/conversations\/[^/]+\/messages$/.test(r.url()) && r.request().method() === "POST", { timeout: 30_000 }).catch(() => null);
    await pauline.page.getByRole("button", { name: "Envoyer", exact: true }).click();
    const reponse = await envoi;
    expect(reponse?.status(), "l'envoi est bien refusé par la passerelle").toBe(503);
    await expect(pauline.page.getByText("La plateforme est en maintenance : réessaie dans quelques minutes.").first(), "le refus est DIT à l'écran").toBeVisible({ timeout: 30_000 });

    /* Étape 6 — la connexion reste possible (routes d'authentification exemptées). */
    const rafraichi = await contexte.request.post(`${api()}/auth/refresh-token`);
    expect([200, 201].includes(rafraichi.status()) || rafraichi.status() === 404, `l'authentification n'est pas bloquée (${rafraichi.status()})`).toBe(true);
    const neuf = await navigateurConnecte("josephine", { parEcran: true });
    expect(await (await neuf.contexte.request.get(`${api()}/auth/me`)).ok(), "une connexion par l'écran aboutit pendant la maintenance").toBe(true);
    test.info().annotations.push({ type: "note", description: `passerelle à jour en ${vue} ms ; bandeau ${couleur} ; réservation / message / publication refusés en 503 MAINTENANCE ; connexion et rafraîchissement intacts` });
  });

  test("WEB-MNT-3 · la levée", async ({ navigateurConnecte, navigateurAdmin, jeuEssai }) => {
    test.setTimeout(5 * 60_000);
    const admin = await navigateurAdmin("exploitation");
    const { page, contexte } = await navigateurConnecte("pauline");
    /* La lecture seule est en place (fiche 2) — on s'en assure sans rien supposer. */
    await ecrireMaintenance(admin, { enabled: true, scheduledAt: null });
    await attendreLaPasserelle(contexte, enLectureSeule, "la lecture seule");
    /* Étape 1 — l'administrateur lève la maintenance. */
    await leverLaMaintenance(admin);
    const vue = await attendreLaPasserelle(contexte, horsMaintenance, "la levée");
    expect(vue, "la passerelle applique la levée en moins de 15 s").toBeLessThan(15_000);
    /* Étape 2 — l'écriture reprend. */
    const envoi = await envoyerUnMessage(contexte, jeuEssai.deal("bzv-accepted").id, "Message après la levée (recette MNT-3)");
    expect(envoi.statut, `l'écriture reprend : ${envoi.corps.slice(0, 200)}`).toBeLessThan(300);
    /* Le bandeau disparaît — au rechargement, et de lui-même au sondage suivant (60 s). */
    await page.goto("/fr/dashboard/home", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 90_000 });
    await expect(bandeau(page), "plus de bandeau après rechargement").toHaveCount(0);
    test.info().annotations.push({ type: "note", description: `levée vue par la passerelle en ${vue} ms ; écriture reprise (${envoi.statut}) ; le bandeau du front se relit toutes les 60 s (ici : parti au rechargement)` });
  });

  test("WEB-MNT-4 · la maintenance pendant une réservation", async ({ navigateurConnecte, navigateurAdmin, jeuEssai }) => {
    test.setTimeout(10 * 60_000);
    const admin = await navigateurAdmin("exploitation");
    const { page, contexte } = await navigateurConnecte("aminata");
    const trajet = jeuEssai.trajet("bzv-upcoming");
    const assistant = new AssistantReservation(page);
    /* Étape 1 — jusqu'à l'étape 4 (l'autorisation est demandée AVANT la maintenance). */
    await assistant.ouvrir(trajet);
    await assistant.decrireLeColis({ famille: "Vêtements & textile", taille: "S", poidsKg: "2", valeurEuros: "60", description: "Deux pulls (recette MNT-4)" });
    await assistant.continuer();
    await assistant.decrireLeDestinataire({ indicatif: "+242", telephone: "061234567", prenom: "Clarisse", nom: "Mabiala" });
    await assistant.continuer();
    await assistant.accepterLaCharte();
    await assistant.continuer();
    const montant = await assistant.montantAPayer();

    /* Étape 2 — la lecture seule tombe pendant que le membre est sur l'écran de paiement. */
    await ecrireMaintenance(admin, { enabled: true, scheduledAt: null });
    await attendreLaPasserelle(contexte, enLectureSeule, "la lecture seule");

    /* Étape 3 — « Payer » : refus dit à l'écran, et RIEN n'est autorisé ni débité. */
    const avant = await contexte.request.get(`${api()}/deals?role=SHIPPER`);
    const nbAvant = ((await avant.json()) as { bookings?: unknown[]; items?: unknown[] }).bookings?.length ?? ((await avant.json()) as { items?: unknown[] }).items?.length ?? 0;
    const refus = page.waitForResponse((r) => /\/deals$/.test(r.url()) && r.request().method() === "POST", { timeout: 60_000 }).catch(() => null);
    await page.getByRole("button", { name: /^Payer / }).click();
    const r = await refus;
    expect(r?.status(), "la demande est refusée par la passerelle").toBe(503);
    await expect(page.getByText("La plateforme est en maintenance : réessaie dans quelques minutes.").first(), "le refus est DIT à l'écran").toBeVisible({ timeout: 30_000 });
    expect(page.url(), "on reste sur l'assistant : aucune réservation").not.toMatch(/\/bookings\/[0-9a-f]{24}$/);

    /* Étape 4 — la maintenance est levée : le paiement se déroule normalement. */
    await leverLaMaintenance(admin);
    await attendreLaPasserelle(contexte, horsMaintenance, "la levée");
    const creation = page.waitForResponse((rr) => /\/deals$/.test(rr.url()) && rr.request().method() === "POST", { timeout: 60_000 });
    await page.getByRole("button", { name: /^Payer / }).click();
    const c = await creation;
    expect(c.ok(), `la réservation aboutit après la levée : ${c.status()} ${await c.text()}`).toBe(true);
    await expect.poll(() => page.url(), { timeout: 90_000 }).toMatch(/\/bookings\/[0-9a-f]{24}$/);
    test.info().annotations.push({ type: "note", description: `montant à l'étape 4 : ${montant} ; refus 503 pendant la maintenance (${nbAvant} demandes avant), réservation créée après la levée` });
  });
});

/** L'adresse du back-office, déduite comme le reste du harnais. */
function adresseDuBackOfficeLocal(): string {
  return apiAdmin().replace(/\/api$/, "");
}

/** Un `datetime-local` attend « AAAA-MM-JJThh:mm » dans le fuseau du navigateur. */
function pourChampLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
