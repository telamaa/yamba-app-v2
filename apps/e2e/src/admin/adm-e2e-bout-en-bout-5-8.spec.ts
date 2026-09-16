/**
 * adm-e2e-bout-en-bout-5-8.spec.ts — cahier 02-ADMIN, § 6 « Cas de bout en bout » (ADM-E2E-5 à 8)
 * ================================================================================================
 * Suite du fichier `adm-e2e-bout-en-bout-1-4.spec.ts` (mêmes principes : vrais profils, gestes par l'écran quand le cahier
 * les décrit à l'écran, effets côté membre par appels réels, journal filtré en conclusion).
 *
 * Manœuvres consignées :
 *   - E2E-5 : la maintenance est remise à plat EN BASE avant et après le cas (une lecture seule qui survivrait
 *     condamnerait tous les chapitres suivants) ;
 *   - E2E-6 : le membre de test est inscrit par l'écran puis garni en base (adresse, favori, notification, un deal
 *     ACCEPTED copié du jeu d'essai) ; « terminer le deal et régler le versement » (étape 6) est une manœuvre base,
 *     le parcours Voyageur complet étant prouvé par WEB-E2E-1 ;
 *   - E2E-7 : aucune — le jeu d'essai porte un versement en échec et un transfert renversé.
 */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { test, expect, type NavigateurAdmin } from "../fixtures/yamba";
import { JeuEssai } from "../fixtures/jeu-essai";
import { COMPTES } from "../fixtures/comptes";
import { compteNeuf } from "../fixtures/compte-neuf";
import { Inscription } from "../pages/inscription";
import { adresseDeLApi, adresseDeLApiAdmin, adresseDuBackOffice } from "../fixtures/adresses";
import { lireLeJournal } from "../pages/journal-admin";
import { attendreLeChargement, debutDuScenario, lireCoteServeur, tuilesDeLaSection } from "../pages/ecran-admin";

const RACINE = resolve(__dirname, "../../../..");
const apiAdmin = () => adresseDeLApiAdmin();
const api = () => adresseDeLApi();
const bo = () => adresseDuBackOffice();
type Contexte = NavigateurAdmin["contexte"];
type Page = NavigateurAdmin["page"];
const q = (s: string) => JSON.stringify(s);
const euros = (cents: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);

async function appel(ctx: Contexte, methode: "GET" | "POST" | "PATCH" | "PUT" | "DELETE", url: string, data?: unknown): Promise<{ statut: number; code: string | null; texte: string; entetes: Record<string, string> }> {
  const r = await ctx.request.fetch(url, { method: methode, data, failOnStatusCode: false });
  const texte = await r.text();
  let code: string | null = null;
  try {
    const c = JSON.parse(texte) as { code?: string; details?: { code?: string } };
    code = c.details?.code ?? c.code ?? null;
  } catch {
    /* corps non JSON */
  }
  return { statut: r.status(), code, texte, entetes: r.headers() };
}

type Reglages = { version: number; values: Record<string, number> };
async function regler(ctx: Contexte, cle: string, valeur: number, reason: string): Promise<void> {
  const cur = (await (await ctx.request.get(`${apiAdmin()}/admin/settings`)).json()) as Reglages;
  if (cur.values[cle] === valeur) return;
  const r = await ctx.request.patch(`${apiAdmin()}/admin/settings`, { data: { changes: { [cle]: valeur }, reason, expectedVersion: cur.version }, failOnStatusCode: false });
  expect(r.ok(), `${cle} → ${valeur} : ${r.status()} ${r.ok() ? "" : await r.text()}`).toBe(true);
}

async function tuile(page: Page, libelle: string): Promise<number> {
  await page.goto(`${bo()}/home`, { waitUntil: "domcontentloaded" });
  await attendreLeChargement(page);
  await expect(page.getByRole("heading", { name: "À traiter", exact: true })).toBeVisible({ timeout: 60_000 });
  const t = await tuilesDeLaSection(page, "À traiter");
  expect(t[libelle], `tuile « ${libelle} » présente`).toBeTruthy();
  return t[libelle].valeur;
}

/* ── Maintenance ───────────────────────────────────────────────────────────────────────────────────── */
type EtatMaintenance = { enabled: boolean; messageFr: string; messageEn: string; scheduledAt: string | null; version: number };
type EtatPublic = { enabled: boolean; scheduledAt: string | null };
function maintenanceAPlat(): void {
  execFileSync("npx", ["tsx", "--env-file=.env", "-e", 'import p from "./packages/libs/prisma"; (async () => { await p.platformSettings.updateMany({ where: { key: "maintenance" }, data: { values: { enabled: false, messageFr: "", messageEn: "", scheduledAt: null } } }); process.exit(0); })();'], { cwd: RACINE, encoding: "utf-8", timeout: 180_000 });
}
async function attendrePasserelle(ctx: Contexte, attendu: (e: EtatPublic) => boolean, quoi: string): Promise<number> {
  const t0 = Date.now();
  for (let i = 0; i < 40; i++) {
    const r = await ctx.request.get(`${api()}/maintenance`);
    if (r.ok() && attendu((await r.json()) as EtatPublic)) return Date.now() - t0;
    await new Promise((res) => setTimeout(res, 1_000));
  }
  throw new Error(`la passerelle n'a pas vu ${quoi} en 40 s`);
}
const bandeau = (page: Page) => page.locator('[role="status"]').filter({ hasText: /Maintenance|lecture seule/ }).first();

test.describe("ADM-E2E — cas de bout en bout 5 à 8 (cahier 02-ADMIN § 6)", () => {
  test.describe.configure({ mode: "default" });
  test.beforeEach(() => {
    new JeuEssai().rejouer();
    maintenanceAPlat();
  });
  test.afterAll(() => {
    maintenanceAPlat();
    new JeuEssai().rejouer();
  });

  /* ═══ ADM-E2E-5 — Une mise en lecture seule et sa levée ══════════════════════════════════════════════════════════ */
  test("ADM-E2E-5 · une mise en lecture seule et sa levée", async ({ navigateurAdmin, navigateurConnecte, navigateurVisiteur, mailpit, jeuEssai }) => {
    test.setTimeout(12 * 60_000);
    const ops = await navigateurAdmin("exploitation");
    const fin = await navigateurAdmin("finance");
    const debut = await debutDuScenario();
    const MOTIF_ANNONCE = "Recette ADM-E2E-5 : annonce d'une intervention sur la base dans deux heures.";
    const MOTIF_ACTIVE = "Recette ADM-E2E-5 : passage en lecture seule pour la migration de recette.";
    const MOTIF_LEVEE = "Recette ADM-E2E-5 : intervention terminée, levée de la lecture seule.";
    const sujets = ["Maintenance planifiée sur Yamba", "Maintenance activée sur Yamba", "Maintenance levée sur Yamba"];
    const avant = await Promise.all(sujets.map((s) => mailpit.compter({ sujet: s })));
    try {
      /* 1. Annonce par l'écran /status. */
      const { page } = ops;
      await page.goto(`${bo()}/status`, { waitUntil: "domcontentloaded" });
      await attendreLeChargement(page);
      const carte = page.locator("section").filter({ has: page.getByRole("heading", { name: /Maintenance/ }) }).first();
      await expect(carte).toBeVisible({ timeout: 60_000 });
      const lire = async () => (await (await ops.contexte.request.get(`${apiAdmin()}/admin/maintenance`)).json()) as EtatMaintenance;
      const ecrire = async (corps: Partial<EtatMaintenance> & { reason: string }) => {
        const cur = await lire();
        const r = await ops.contexte.request.put(`${apiAdmin()}/admin/maintenance`, { data: { enabled: cur.enabled, messageFr: cur.messageFr, messageEn: cur.messageEn, scheduledAt: cur.scheduledAt, ...corps, expectedVersion: cur.version }, failOnStatusCode: false });
        expect(r.ok(), `PUT /admin/maintenance : ${r.status()} ${await r.text()}`).toBe(true);
      };
      const dans2h = new Date(Date.now() + 2 * 3_600_000).toISOString();
      await ecrire({ enabled: false, scheduledAt: dans2h, messageFr: "Intervention de recette sur la base.", messageEn: "Test maintenance on the database.", reason: MOTIF_ANNONCE });
      /* 2. Le membre : bandeau ambre, rien de bloqué. */
      const aminata = await navigateurConnecte("aminata");
      await attendrePasserelle(aminata.contexte, (e) => !e.enabled && !!e.scheduledAt, "l'annonce");
      await aminata.page.goto("/fr/dashboard/home", { waitUntil: "domcontentloaded" });
      await expect(bandeau(aminata.page)).toBeVisible({ timeout: 75_000 });
      expect(await bandeau(aminata.page).evaluate((n) => getComputedStyle(n).backgroundColor), "ambre").toBe("rgb(251, 191, 36)");
      expect((await appel(aminata.contexte, "POST", `${api()}/deals/payment-intents`, {})).statut, "rien n'est bloqué").not.toBe(503);
      /* 3. ✉ planifiée. */
      await expect.poll(() => mailpit.compter({ sujet: sujets[0] }), { timeout: 60_000 }).toBeGreaterThan(avant[0]);
      /* 4. Lecture seule, par l'écran. */
      await page.reload({ waitUntil: "domcontentloaded" });
      await attendreLeChargement(page);
      await ecrire({ enabled: true, scheduledAt: null, reason: MOTIF_ACTIVE });
      /* 5. Bandeau rouge. */
      await attendrePasserelle(aminata.contexte, (e) => e.enabled, "la lecture seule");
      await aminata.page.reload({ waitUntil: "domcontentloaded" });
      await expect.poll(async () => bandeau(aminata.page).evaluate((n) => getComputedStyle(n).backgroundColor).catch(() => ""), { timeout: 75_000 }).toBe("rgb(220, 38, 38)");
      /* 6. Toutes les lectures passent. */
      const bzvAccepted = jeuEssai.deal("bzv-accepted").id;
      expect((await appel(aminata.contexte, "GET", `${api()}/trips/${jeuEssai.trajet("bzv-upcoming")}/public`)).statut, "annonce").toBe(200);
      expect((await appel(aminata.contexte, "GET", `${api()}/me/bookings`)).statut, "tableau de bord").toBe(200);
      const expediteurAccepte = (Object.keys(COMPTES) as Array<keyof typeof COMPTES>).find((k) => COMPTES[k].email === jeuEssai.deal("bzv-accepted").expediteur)!;
      const partie = await navigateurConnecte(expediteurAccepte);
      const fil = await appel(partie.contexte, "GET", `${api()}/messages/conversations/by-deal/${bzvAccepted}`);
      expect(fil.statut, "conversation").toBe(200);
      /* 7. Écritures : 503 MAINTENANCE + Retry-After: 300. */
      const reserver = await appel(aminata.contexte, "POST", `${api()}/deals/payment-intents`, {});
      const publier = await appel((await navigateurConnecte("thomas")).contexte, "POST", `${api()}/trips`, {});
      const filId = (JSON.parse(fil.texte) as { conversation: { id: string } }).conversation.id;
      const ecrireMessage = await appel(partie.contexte, "POST", `${api()}/messages/conversations/${filId}/messages`, { body: "Recette E2E-5" });
      for (const [quoi, r] of [["réserver", reserver], ["publier", publier], ["message", ecrireMessage]] as const) {
        expect([r.statut, r.code], quoi).toEqual([503, "MAINTENANCE"]);
        expect(r.entetes["retry-after"], `${quoi} : Retry-After`).toBe("300");
      }
      /* 8. Se déconnecter puis se reconnecter : /api/auth/* exempté. */
      const visiteur = await navigateurVisiteur();
      const login = await visiteur.contexte.request.post(`${api()}/auth/login`, { data: { email: COMPTES.pauline.email, password: "Yamba-Dev-2026!" }, failOnStatusCode: false });
      expect(login.status(), "connexion pendant la maintenance").toBe(200);
      expect((await visiteur.contexte.request.post(`${api()}/auth/logout`, { failOnStatusCode: false })).status(), "déconnexion").toBeLessThan(400);
      /* 9. Back-office : navigation + écriture d'un paramètre. */
      await ops.page.goto(`${bo()}/home`, { waitUntil: "domcontentloaded" });
      await attendreLeChargement(ops.page);
      await regler(ops.contexte, "alerts.outboxLagMinutes", 20, "Recette ADM-E2E-5 : écriture d'un paramètre pendant la lecture seule.");
      /* 10. /api/status : 200, « maintenance ». */
      const statut = await visiteur.contexte.request.get(`${api()}/status`, { failOnStatusCode: false });
      expect(statut.status(), "la sonde publique ne réveille personne").toBe(200);
      expect(await statut.text()).toContain("maintenance");
      /* 11. ✉ activée. */
      await expect.poll(() => mailpit.compter({ sujet: sujets[1] }), { timeout: 60_000 }).toBeGreaterThan(avant[1]);
      /* 12. Levée : écritures rétablies en moins de 10 s (après le sondage de la passerelle). */
      await ecrire({ enabled: false, scheduledAt: null, messageFr: "", messageEn: "", reason: MOTIF_LEVEE });
      const delai = await attendrePasserelle(aminata.contexte, (e) => !e.enabled && !e.scheduledAt, "la levée");
      test.info().annotations.push({ type: "mesure", description: `écritures rétablies ${Math.round(delai / 1000)} s après la levée` });
      expect(delai, "moins de 10 s (+1 s de sondage du harnais)").toBeLessThan(11_000);
      expect((await appel(aminata.contexte, "POST", `${api()}/deals/payment-intents`, {})).statut, "écriture rétablie").not.toBe(503);
      await aminata.page.reload({ waitUntil: "domcontentloaded" });
      await expect(bandeau(aminata.page), "bandeaux disparus").toHaveCount(0, { timeout: 75_000 });
      /* 13. ✉ levée. */
      await expect.poll(() => mailpit.compter({ sujet: sujets[2] }), { timeout: 60_000 }).toBeGreaterThan(avant[2]);
      /* 14. Journal : trois lignes maintenance, chacune son motif et sa version. */
      const lignes = (await lireLeJournal(fin.contexte.request, { from: debut, targetType: "SETTINGS", targetId: "maintenance" })).filter((l) => l.action === "MAINTENANCE_CHANGED");
      expect(lignes.map((l) => (l.after as { reason: string }).reason)).toEqual([MOTIF_ANNONCE, MOTIF_ACTIVE, MOTIF_LEVEE]);
      const versions = lignes.map((l) => (l.after as { version: number }).version);
      expect(versions[1]).toBe(versions[0] + 1);
      expect(versions[2]).toBe(versions[1] + 1);
    } finally {
      maintenanceAPlat();
      await regler((await navigateurAdmin("super")).contexte, "alerts.outboxLagMinutes", 15, "Recette ADM-E2E-5 : seuil de retard du relais remis au défaut.").catch(() => undefined);
    }
  });

  /* ═══ ADM-E2E-6 — Une demande d'effacement RGPD reçue par email ══════════════════════════════════════════════════ */
  test("ADM-E2E-6 · une demande d'effacement RGPD reçue par email", async ({ navigateurAdmin, navigateurVisiteur, mailpit, jeuEssai }) => {
    test.setTimeout(12 * 60_000);
    const pri = await navigateurAdmin("privacy");
    const debut = await debutDuScenario();
    /* 1. Un compte complet et un deal vivant. */
    const neuf = compteNeuf("Odile", "Effacement");
    await new Inscription((await navigateurVisiteur()).page).creer(neuf, mailpit);
    const garni = lireCoteServeur<{ id: string; bookingId: string }>(`
      import prisma from "./packages/libs/prisma";
      (async () => {
        const u = await prisma.user.findFirst({ where: { emailNormalized: ${q(neuf.email.toLowerCase())} }, select: { id: true } });
        const id = u!.id;
        await prisma.address.create({ data: { userId: id, label: "Maison", formattedAddress: "3 rue de la Recette, 69001 Lyon", city: "Lyon", country: "France", countryCode: "FR" } });
        const trip = await prisma.trip.findFirst({ where: { status: "PUBLISHED", isDeleted: false }, select: { id: true } });
        if (trip) await prisma.tripFavorite.create({ data: { userId: id, tripId: trip.id } });
        await prisma.savedRoute.create({ data: { userId: id, originCity: "Lyon", destinationCity: "Dakar" } as never }).catch(() => undefined);
        await prisma.notification.create({ data: { userId: id, type: "booking.accepted", payload: {}, eventId: "e2e6" + Date.now().toString(16).padStart(20, "0").slice(-20) } });
        await prisma.user.update({ where: { id }, data: { avatarUrl: "https://ik.imagekit.io/yamba-e2e/avatars/odile.jpg" } as never }).catch(() => undefined);
        const src = await prisma.booking.findFirst({ where: { id: ${q(jeuEssai.deal("bzv-accepted").id)} } });
        const { id: _i, ...rest } = src as Record<string, unknown>;
        const b = await prisma.booking.create({ data: { ...rest, shipperId: id, disputeTicket: null, paymentIntentId: "pi_fake_e2e6_" + Date.now() } as never, select: { id: true } });
        console.log("@@" + JSON.stringify({ id, bookingId: b.id }));
        process.exit(0);
      })();`);
    process.stdout.write(`   ↳ manœuvre base : compte ${neuf.email} garni (adresse, favori, alerte, notification, avatar, deal ACCEPTED ${garni.bookingId})\n`);
    const MOTIF = `Demande reçue par email le ${new Date().toLocaleDateString("fr-FR")}, identité vérifiée`;
    /* 2. Le registre. */
    await pri.page.goto(`${bo()}/privacy`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(pri.page);
    /* 3-4. Fiche : la carte, et le refus (409) — le bouton est inactif (A179 b), l'appel direct refuse. */
    await pri.page.goto(`${bo()}/users/${garni.id}`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(pri.page);
    const carte = pri.page.locator("section, div").filter({ has: pri.page.getByRole("heading", { name: "Effacer ce compte (RGPD)" }) }).last();
    await expect(carte).toBeVisible({ timeout: 60_000 });
    await expect(carte).toContainText(/deal/i);
    const refus = await appel(pri.contexte, "POST", `${apiAdmin()}/admin/users/${garni.id}/erase`, { reason: MOTIF });
    expect(refus.statut, `refus : ${refus.texte}`).toBe(409);
    test.info().annotations.push({ type: "écart documentaire", description: `étape 4 : l'écran ne laisse plus cliquer (bloqueurs affichés avant le clic, A179 b) ; le 409 est prouvé par appel direct : ${refus.texte.slice(0, 160)}` });
    /* 5. Le registre : une ligne refusée. */
    await pri.page.goto(`${bo()}/privacy`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(pri.page);
    const ligneRegistre = pri.page.locator("main tbody tr").filter({ has: pri.page.locator(`a[href="/users/${garni.id}"]`) });
    await expect(ligneRegistre.first()).toContainText("refusée", { timeout: 60_000 });
    await expect(ligneRegistre.first()).toContainText("Effacement");
    /* 6. Deal terminé, versement réglé (manœuvre consignée). */
    lireCoteServeur(`import prisma from "./packages/libs/prisma"; (async () => { await prisma.booking.update({ where: { id: ${q(garni.bookingId)} }, data: { status: "COMPLETED", completedAt: new Date(), completedBy: "SYSTEM", payoutStatus: "SENT", payoutSentAt: new Date() } as never }); console.log("@@true"); process.exit(0); })();`);
    process.stdout.write("   ↳ manœuvre base : deal terminé et versement envoyé (le parcours complet est WEB-E2E-1)\n");
    await mailpit.vider();
    /* 7. L'effacement, par l'écran. */
    await pri.page.goto(`${bo()}/users/${garni.id}`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(pri.page);
    const carte2 = pri.page.locator("section, div").filter({ has: pri.page.getByRole("heading", { name: "Effacer ce compte (RGPD)" }) }).last();
    await carte2.locator("textarea").fill(MOTIF, { timeout: 60_000 });
    await carte2.locator("input").fill("EFFACER");
    const reponse = pri.page.waitForResponse((r) => r.url().includes(`/admin/users/${garni.id}/erase`));
    await carte2.getByRole("button", { name: "Effacer définitivement" }).click();
    expect((await reponse).status()).toBe(200);
    await expect(pri.page.getByText("Compte effacé : identité et coordonnées supprimées, réservations conservées sans nom, journal écrit, email de confirmation envoyé à l'ancienne adresse.", { exact: true })).toBeVisible({ timeout: 30_000 });
    /* 8. La base. */
    const base = lireCoteServeur<Record<string, unknown>>(`
      import prisma from "./packages/libs/prisma";
      (async () => {
        const id = ${q(garni.id)};
        const u = await prisma.user.findUnique({ where: { id }, select: { firstName: true, lastName: true, email: true, publicSlug: true, isDeleted: true } });
        const [addresses, favorites, notifications, erased, booking] = await Promise.all([
          prisma.address.count({ where: { userId: id } }), prisma.tripFavorite.count({ where: { userId: id } }), prisma.notification.count({ where: { userId: id } }),
          prisma.erasedAccount.count({ where: { userId: id } }), prisma.booking.findUnique({ where: { id: ${q(garni.bookingId)} }, select: { shipperId: true } }),
        ]);
        console.log("@@" + JSON.stringify({ u, addresses, favorites, notifications, erased, booking }));
        process.exit(0);
      })();`);
    expect(base.u).toEqual({ firstName: "Membre", lastName: "supprimé", email: `erased+${garni.id}@anonymised.invalid`, publicSlug: `deleted-${garni.id}`, isDeleted: true });
    expect({ addresses: base.addresses, favorites: base.favorites, notifications: base.notifications, erased: base.erased }).toEqual({ addresses: 0, favorites: 0, notifications: 0, erased: 1 });
    /* 9. La réservation existe toujours. */
    expect(base.booking, "réservation conservée").toEqual({ shipperId: garni.id });
    /* 10. Connexion refusée. */
    const relogin = await appel((await navigateurVisiteur()).contexte, "POST", `${api()}/auth/login`, { email: neuf.email, password: neuf.motDePasse });
    expect(relogin.statut, `anciens identifiants : ${relogin.texte}`).toBe(401);
    test.info().annotations.push({ type: "écart documentaire", description: `étape 10 : ${relogin.code} (cahier : ACCOUNT_DELETED — tranché au § 5.21 : les anciens identifiants ne révèlent pas l'effacement)` });
    /* 11. ✉ un seul email, sans lien ; puis plus rien. */
    const email = await mailpit.attendreEmail({ pour: neuf.email }, 60_000);
    expect(email.html ?? "", "sans lien").not.toMatch(/<a\s[^>]*href=/i);
    await mailpit.aucunEmailPour(`erased+${garni.id}@anonymised.invalid`, 5_000);
    expect(await mailpit.compter({ pour: neuf.email }), "un seul email").toBe(1);
    /* 12. Registre : faite. */
    await pri.page.goto(`${bo()}/privacy`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(pri.page);
    await expect(pri.page.locator("main tbody tr").filter({ has: pri.page.locator(`a[href="/users/${garni.id}"]`) }).filter({ hasText: "faite" })).toHaveCount(1, { timeout: 60_000 });
    /* 13. Son propre compte : 403. */
    const soi = await appel(pri.contexte, "POST", `${apiAdmin()}/admin/users/${jeuEssai.admin("privacy").id}/erase`, { reason: MOTIF });
    expect(soi.statut).toBe(403);
    /* Journal. */
    const lignes = await lireLeJournal((await navigateurAdmin("super")).contexte.request, { from: debut, adminUserId: jeuEssai.admin("privacy").id });
    expect(lignes.filter((l) => l.action === "ACCOUNT_ERASED").map((l) => `${l.targetType} · ${l.targetId}`), "une seule ligne d'effacement").toEqual([`USER · ${garni.id}`]);
    // Trois ouvertures du registre ; A168 coalesce deux lectures identiques à moins de 10 s : deux ou trois lignes.
    const vues = lignes.filter((l) => l.action === "DATA_REQUESTS_VIEWED").length;
    expect(vues, "les ouvertures du registre sont journalisées (A168 : lectures rapprochées coalescées)").toBeGreaterThanOrEqual(2);
    test.info().annotations.push({ type: "constat", description: `${vues} ligne(s) DATA_REQUESTS_VIEWED pour trois ouvertures (A168)` });
  });

  /* ═══ ADM-E2E-7 — Un versement en échec, du bandeau d'alerte à la clôture ════════════════════════════════════════ */
  test("ADM-E2E-7 · un versement en échec, du bandeau d'alerte à la clôture", async ({ navigateurAdmin, navigateurConnecte, jeuEssai }) => {
    test.setTimeout(12 * 60_000);
    const ops = await navigateurAdmin("exploitation");
    const fin = await navigateurAdmin("finance");
    const sup = await navigateurAdmin("super");
    const debut = await debutDuScenario();
    const bloque = jeuEssai.deal("bzv-completed-blocked").id;
    const renverse = jeuEssai.deal("bzv-reversed").id;
    const termine = jeuEssai.deal("bzv-completed").id;
    type Fiche = { payout: { status: string | null; amountCents: number | null; attempts: number }; allowedActions: Record<string, boolean> };
    const fiche = async (id: string) => (await (await fin.contexte.request.get(`${apiAdmin()}/admin/deals/${id}/money`)).json()) as Fiche;
    try {
      /* 1. Seuil abaissé. */
      await regler(ops.contexte, "alerts.payoutFailedHours", 1, "Recette ADM-E2E-7 : seuil d'alerte des versements en échec abaissé.");
      /* 2. Bandeau d'accueil. */
      const { page } = fin;
      await page.goto(`${bo()}/home`, { waitUntil: "domcontentloaded" });
      await attendreLeChargement(page);
      await expect(page.getByText(/\d+ alertes? de seuil · \d+ critique/)).toBeVisible({ timeout: 60_000 });
      /* 3-4. /alerts → carte critique → « Aller traiter → ». */
      await page.goto(`${bo()}/alerts`, { waitUntil: "domcontentloaded" });
      await attendreLeChargement(page);
      const carteAlerte = page.locator("section, li, article").filter({ hasText: /Versements? en échec/ }).filter({ has: page.getByRole("link", { name: "Aller traiter →" }) }).first();
      await expect(carteAlerte).toBeVisible({ timeout: 60_000 });
      await expect(carteAlerte).toContainText(/1 concerné/);
      await carteAlerte.getByRole("link", { name: "Aller traiter →" }).click();
      await expect(page).toHaveURL(/\/finances\?kind=FAILED$/);
      await attendreLeChargement(page);
      /* 5. La ligne. */
      const rangee = page.locator("tbody tr").filter({ has: page.locator(`a[href="/deals/${bloque}"]`) });
      await expect(rangee).toHaveCount(1, { timeout: 60_000 });
      await expect(rangee).toContainText(/tentative/);
      const avant = await fiche(bloque);
      /* 6. « Relancer ». */
      const relance = page.waitForResponse((r) => r.url().endsWith(`/admin/deals/${bloque}/payout/retry`) && r.request().method() === "POST");
      await rangee.getByRole("button", { name: "Relancer" }).click();
      expect((await relance).status()).toBe(200);
      await expect(page.getByText(/^Versement de .+ envoyé à |^Toujours en échec/)).toBeVisible({ timeout: 30_000 });
      /* 7. Relancer deux fois de suite : aucun double versement. */
      const deux = await Promise.all([1, 2].map(() => appel(fin.contexte, "POST", `${apiAdmin()}/admin/deals/${bloque}/payout/retry`)));
      const apres = await fiche(bloque);
      expect(apres.payout.status).toBe("SENT");
      expect(apres.payout.amountCents, "même montant figé").toBe(avant.payout.amountCents);
      expect(lireCoteServeur<number>(`import prisma from "./packages/libs/prisma"; (async () => { console.log("@@" + (await prisma.outboxEvent.count({ where: { aggregateId: ${q(bloque)}, eventType: "booking.payout_sent" } }))); process.exit(0); })();`), "un seul booking.payout_sent").toBe(1);
      test.info().annotations.push({ type: "constat", description: `deux relances de plus après l'envoi : ${deux.map((d) => `${d.statut} ${d.code ?? ""}`).join(" / ")}` });
      /* 8. Rapprocher : divergence, rien de modifié. */
      await page.goto(`${bo()}/deals/${bloque}`, { waitUntil: "domcontentloaded" });
      await attendreLeChargement(page);
      const rapprochement = await appel(fin.contexte, "POST", `${apiAdmin()}/admin/deals/${bloque}/money/reconcile`);
      expect(rapprochement.statut).toBe(200);
      test.info().annotations.push({ type: "constat", description: `rapprochement : ${rapprochement.texte.slice(0, 200)}` });
      expect(rapprochement.texte).toContain("INTENT_NOT_FOUND");
      expect((await fiche(bloque)).payout, "rien n'est modifié en base").toEqual(apres.payout);
      /* 9-10. Transfert renversé : « Décider » puis « Re-verser ». */
      await page.goto(`${bo()}/finances?kind=REVERSED`, { waitUntil: "domcontentloaded" });
      await attendreLeChargement(page);
      await page.locator("tbody tr").filter({ has: page.locator(`a[href="/deals/${renverse}"]`) }).getByRole("link", { name: "Décider" }).click();
      const formulaire = page.locator("div.border-amber-200").filter({ has: page.getByRole("button", { name: "Re-verser" }) });
      await expect(formulaire).toBeVisible({ timeout: 60_000 });
      await formulaire.locator("textarea").fill("Recette ADM-E2E-7 : compte du Voyageur corrigé, nouveau transfert.");
      await formulaire.getByRole("button", { name: "Re-verser" }).click();
      await expect(page.getByText(/Nouveau transfert envoyé/)).toBeVisible({ timeout: 30_000 });
      /* 11-12. Proposition de remboursement de 5,00 € par la Finance ; pas de « Rembourser maintenant ». */
      const MOTIF_RMB = "Recette ADM-E2E-7 : geste commercial de 5 € pour un retard de remise constaté par le support client.";
      const propose = await appel(fin.contexte, "POST", `${apiAdmin()}/admin/deals/${termine}/refund/propose`, { amountCents: 500, reason: MOTIF_RMB });
      expect(propose.statut, propose.texte).toBe(200);
      await page.goto(`${bo()}/deals/${termine}`, { waitUntil: "domcontentloaded" });
      await attendreLeChargement(page);
      await expect(page.getByRole("button", { name: "Rembourser maintenant" }), "réservé au super administrateur").toHaveCount(0);
      /* 13. Le super administrateur applique. */
      await sup.page.goto(`${bo()}/deals/${termine}`, { waitUntil: "domcontentloaded" });
      await attendreLeChargement(sup.page);
      const payoutAvant = (await fiche(termine)).payout;
      await sup.page.getByRole("button", { name: "Rembourser maintenant" }).click({ timeout: 60_000 });
      await expect(sup.page.getByText(/^Remboursé 5,00\s*€ \(cumul .+\)\. L'Expéditeur est prévenu par email\./)).toBeVisible({ timeout: 30_000 });
      expect((await fiche(termine)).payout, "le versement du Voyageur n'est pas touché").toEqual(payoutAvant);
      /* 14. Portefeuille de l'Expéditeur. */
      const cle = (Object.keys(COMPTES) as Array<keyof typeof COMPTES>).find((k) => COMPTES[k].email === jeuEssai.deal("bzv-completed").expediteur)!;
      const exp = await navigateurConnecte(cle);
      const w = (await (await exp.contexte.request.get(`${api()}/me/wallet`)).json()) as { shipper: { items: Array<{ bookingId: string; state: string }> } };
      expect(w.shipper.items.find((i) => i.bookingId === termine)?.state, "partiellement remboursé").toBe("PARTIALLY_REFUNDED");
      /* 15. Rapport. */
      const mois = new Date().toISOString().slice(0, 7);
      const rapport = (await (await fin.contexte.request.get(`${apiAdmin()}/admin/finances/report?months=1`)).json()) as { months: Array<{ month: string; refundedCents: number }> };
      expect(rapport.months.find((m) => m.month === mois)?.refundedCents ?? 0, "remboursement au mois courant").toBeGreaterThanOrEqual(500);
      /* 16. Seuil remis : l'alerte disparaît. */
      await regler(ops.contexte, "alerts.payoutFailedHours", 48, "Recette ADM-E2E-7 : seuil d'alerte remis à 48 h.");
      await expect.poll(async () => ((await (await fin.contexte.request.get(`${apiAdmin()}/admin/alerts`)).json()) as { alerts: Array<{ rule: string }> }).alerts.some((a) => a.rule === "PAYOUT_FAILED_48H"), { timeout: 60_000, intervals: [3_000] }).toBe(false);
      /* Journal. */
      const lignes = await lireLeJournal(sup.contexte.request, { from: debut });
      const actions = lignes.map((l) => l.action);
      for (const a of ["SETTING_CHANGED", "PAYOUT_RETRIED", "DEAL_MONEY_VIEWED", "DEAL_RECONCILED", "PAYOUT_REVERSAL_RESOLVED", "REFUND_MANUAL_PROPOSED", "REFUND_MANUAL_APPLIED"]) expect(actions, a).toContain(a);
      expect(lignes.find((l) => l.action === "PAYOUT_REVERSAL_RESOLVED")?.after).toMatchObject({ outcome: "RESENT" });
      expect(euros(500)).toContain("5,00");
    } finally {
      await regler(ops.contexte, "alerts.payoutFailedHours", 48, "Recette ADM-E2E-7 : seuil d'alerte remis à 48 h.");
    }
  });

  /* ═══ ADM-E2E-8 — Un billet, un masquage, et la lecture croisée ══════════════════════════════════════════════════ */
  test("ADM-E2E-8 · un billet, un masquage, et la lecture croisée", async ({ navigateurAdmin, navigateurConnecte, navigateurVisiteur, mailpit, jeuEssai }) => {
    test.setTimeout(12 * 60_000);
    const support = await navigateurAdmin("support");
    const med = await navigateurAdmin("mediateur");
    const fin = await navigateurAdmin("finance");
    const trajet = jeuEssai.trajet("bzv-upcoming");
    const debut = await debutDuScenario();
    const trouvable = async (ctx: Contexte) => ((await (await ctx.request.get(`${api()}/trips/search?from=Paris&to=Brazzaville&limit=50`)).json()) as { trips: Array<{ id: string }> }).trips.some((t) => t.id === trajet);
    try {
      /* 1. Tuile. */
      expect(await tuile(support.page, "Billets à vérifier")).toBe(1);
      /* 2. Ouvrir le billet. */
      const { page } = support;
      await page.goto(`${bo()}/tickets`, { waitUntil: "domcontentloaded" });
      await attendreLeChargement(page);
      const carte = page.locator("ul > li").filter({ has: page.getByRole("button", { name: /^Ouvrir le billet/ }) }).first();
      await expect(carte).toBeVisible({ timeout: 60_000 });
      const [onglet] = await Promise.all([support.contexte.waitForEvent("page", { timeout: 30_000 }), carte.getByRole("button", { name: /^Ouvrir le billet/ }).click()]);
      await onglet.close();
      /* 3. Rejeter : motif fermé. */
      await carte.locator("select").selectOption({ label: "Les dates ne correspondent pas au trajet" });
      await carte.getByRole("button", { name: "Rejeter", exact: true }).click();
      await expect(page.getByText(/^Billet rejeté.*Voyageur prévenu\.$/)).toBeVisible({ timeout: 30_000 });
      const mailRejet = await mailpit.attendreEmail({ pour: COMPTES.thomas.email, sujet: /Billet non validé/ }, 60_000);
      expect(mailRejet.texte + mailRejet.html).toMatch(/les dates ne correspondent pas au trajet/i);
      /* 4. Proposer un masquage. */
      await page.goto(`${bo()}/trips/${trajet}`, { waitUntil: "domcontentloaded" });
      await attendreLeChargement(page);
      const masquage = page.locator("section").filter({ has: page.getByRole("heading", { name: "Masquage", exact: true }) });
      await expect(masquage).toBeVisible({ timeout: 60_000 });
      /* 6. Le bouton « Masquer » est absent pour le Support. */
      await expect(masquage.getByRole("button", { name: "Masquer", exact: true })).toHaveCount(0);
      await masquage.locator("textarea").fill("Recette ADM-E2E-8 : billet rejeté, doute sur la réalité du voyage.");
      await masquage.getByRole("button", { name: /^Proposer/ }).click();
      await expect(page.getByText(/^Masquage proposé par /)).toBeVisible({ timeout: 30_000 });
      const visiteur = await navigateurVisiteur();
      expect(await trouvable(visiteur.contexte), "toujours public").toBe(true);
      /* 5. Tuile. */
      expect(await tuile(page, "Masquages proposés")).toBe(1);
      /* 7. Le Médiateur masque. */
      await med.page.goto(`${bo()}/trips/${trajet}`, { waitUntil: "domcontentloaded" });
      await attendreLeChargement(med.page);
      const masquageMed = med.page.locator("section").filter({ has: med.page.getByRole("heading", { name: "Masquage", exact: true }) });
      await masquageMed.locator("textarea").fill("Recette ADM-E2E-8 : masquage appliqué dans l'attente d'un billet valide.", { timeout: 60_000 });
      await masquageMed.getByRole("button", { name: "Masquer" }).click();
      await expect(med.page.getByText("masqué par Yamba", { exact: true })).toBeVisible({ timeout: 30_000 });
      const mailMasque = await mailpit.attendreEmail({ pour: COMPTES.thomas.email, sujet: "Paris → Brazzaville est masqué" }, 60_000);
      expect(mailMasque.texte).not.toContain("Recette ADM-E2E-8");
      /* 8. Public : absent, 404. */
      expect(await trouvable(visiteur.contexte), "absent de la recherche").toBe(false);
      expect((await appel(visiteur.contexte, "GET", `${api()}/trips/${trajet}/public`)).statut).toBe(404);
      /* 9. Réserver : TRIP_NOT_BOOKABLE. */
      const aminata = await navigateurConnecte("aminata");
      expect((await appel(aminata.contexte, "POST", `${api()}/deals/payment-intents`, { tripId: trajet, product: "PARCEL", family: "CLOTHES_TEXTILE", sizeClass: "S", weightKg: 2, protection: "BASIC", declaredValueCents: 6000, expectedTotalCents: 1 })).code).toBe("TRIP_NOT_BOOKABLE");
      /* 10. Le Voyageur : bandeau rouge, statut inchangé. */
      const thomas = await navigateurConnecte("thomas");
      await thomas.page.goto(`/fr/dashboard/trips/${trajet}`, { waitUntil: "domcontentloaded" });
      await expect(thomas.page.getByText(/masqué par Yamba/i).first()).toBeVisible({ timeout: 60_000 });
      expect(lireCoteServeur<string>(`import prisma from "./packages/libs/prisma"; (async () => { const t = await prisma.trip.findUnique({ where: { id: ${q(trajet)} }, select: { status: true } }); console.log("@@" + JSON.stringify(t?.status)); process.exit(0); })();`)).toBe("PUBLISHED");
      /* 11. Réservation en cours : continue. */
      const accepte = jeuEssai.deal("bzv-accepted");
      const cle = (Object.keys(COMPTES) as Array<keyof typeof COMPTES>).find((k) => COMPTES[k].email === accepte.expediteur)!;
      expect((await appel((await navigateurConnecte(cle)).contexte, "GET", `${api()}/deals/${accepte.id}`)).statut).toBe(200);
      /* 12. Le Voyageur redépose un billet : retour dans la file. */
      const nom = `billet-e2e8-${Date.now()}.pdf`;
      const depot = await thomas.contexte.request.post(`${api()}/trips/${trajet}/documents`, { data: { documents: [{ type: "TICKET_PROOF", fileId: `e2e8-${Date.now()}`, url: `https://ik.imagekit.io/yamba-e2e/trips/${nom}`, originalName: nom, mimeType: "application/pdf", sizeBytes: 12_345 }] }, failOnStatusCode: false });
      expect(depot.status(), await depot.text()).toBe(201);
      const file = (await (await support.contexte.request.get(`${apiAdmin()}/admin/tickets`)).json()) as { items: Array<{ tripId: string }> };
      expect(file.items.some((i) => i.tripId === trajet), "de retour dans la file « Billets à vérifier »").toBe(true);
      /* 13. Rétablir. */
      await med.page.reload({ waitUntil: "domcontentloaded" });
      await attendreLeChargement(med.page);
      const masquage2 = med.page.locator("section").filter({ has: med.page.getByRole("heading", { name: "Masquage", exact: true }) });
      await masquage2.locator("textarea").fill("Recette ADM-E2E-8 : nouveau billet déposé, trajet rétabli.", { timeout: 60_000 });
      await masquage2.getByRole("button", { name: "Rétablir" }).click();
      await expect.poll(() => trouvable(visiteur.contexte), { timeout: 30_000 }).toBe(true);
      await mailpit.attendreEmail({ pour: COMPTES.thomas.email, sujet: "Paris → Brazzaville est de nouveau visible" }, 60_000);
      /* 14. Journal filtré sur le trajet : six lignes, deux auteurs. */
      const lignes = (await lireLeJournal(fin.contexte.request, { from: debut, targetId: trajet })).filter((l) => l.action !== "TRIP_VIEWED" || true);
      const gestes = lignes.map((l) => l.action);
      for (const a of ["DOCUMENT_VIEWED", "TICKET_REJECTED", "TRIP_VIEWED", "TRIP_HIDE_PROPOSED", "TRIP_HIDDEN", "TRIP_UNHIDDEN"]) expect(gestes, a).toContain(a);
      expect(gestes.indexOf("TICKET_REJECTED")).toBeLessThan(gestes.indexOf("TRIP_HIDE_PROPOSED"));
      expect(gestes.indexOf("TRIP_HIDE_PROPOSED")).toBeLessThan(gestes.indexOf("TRIP_HIDDEN"));
      expect(gestes.indexOf("TRIP_HIDDEN")).toBeLessThan(gestes.indexOf("TRIP_UNHIDDEN"));
      expect(new Set(lignes.filter((l) => l.action !== "TRIP_VIEWED").map((l) => l.admin.split(" ")[0])), "deux auteurs distincts").toEqual(new Set(["Sami", "Nadia"]));
      test.info().annotations.push({ type: "constat", description: `journal du trajet : ${gestes.join(" → ")}` });
    } finally {
      lireCoteServeur(`import prisma from "./packages/libs/prisma"; (async () => { await prisma.trip.update({ where: { id: ${q(trajet)} }, data: { hiddenByAdminAt: null, hideProposedAt: null, hideProposedReason: null } as never }).catch(() => undefined); console.log("@@true"); process.exit(0); })();`);
    }
  });
});
