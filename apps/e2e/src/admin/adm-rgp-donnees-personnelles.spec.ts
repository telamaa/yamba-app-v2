/**
 * adm-rgp-donnees-personnelles.spec.ts — cahier 02-ADMIN, § 5.21 « Données personnelles et effacement RGPD » (ADM-RGP-1 à 4)
 * + fiches ajoutées
 * ============================================================================================================================
 * L'effacement est le seul geste du back-office qu'on ne défait pas. Le chapitre se juge à quatre promesses :
 *  - **le registre est une preuve** : chaque demande (faite ou refusée) y est, chaque consultation écrit une ligne ;
 *  - **refusé tant qu'un deal vit**, avec une liste FERMÉE de bloqueurs, lue en français ;
 *  - **une transaction** anonymise le compte (uniques remplacés, jamais `null`), garde réservations et traces, déplace
 *    l'identifiant Stripe, écrit `ACCOUNT_ERASED` ; ensuite sessions mortes, un email sans lien, plus rien vers ce compte ;
 *  - **le tiers destinataire s'oublie** `privacy.recipientRetentionDays` jours après la fin du deal, jamais avant.
 * Les comptes effacés sont créés pour l'occasion (inscription par l'écran) : un compte du seed effacé ne se rejoue pas.
 */
import { test, expect, type NavigateurAdmin } from "../fixtures/yamba";
import { JeuEssai } from "../fixtures/jeu-essai";
import { adresseDeLApi, adresseDeLApiAdmin, adresseDuBackOffice } from "../fixtures/adresses";
import { compteNeuf, type CompteNeuf } from "../fixtures/compte-neuf";
import { lireLeJournal } from "../pages/journal-admin";
import { attendreLeChargement, debutDuScenario, lireCoteServeur, MOTIF_DE_RECETTE } from "../pages/ecran-admin";
import { Inscription } from "../pages/inscription";

const api = () => adresseDeLApiAdmin();
const bo = () => adresseDuBackOffice();
type Contexte = NavigateurAdmin["contexte"];
type Page = NavigateurAdmin["page"];

const MOTIF = "Demande reçue par email le 15/09/2026, identité vérifiée";
const q = (v: unknown) => JSON.stringify(v);

/** Un membre neuf, inscrit par l'écran, garni de ce qu'un effacement doit supprimer ou garder (manœuvre consignée). */
async function membreAEffacer(navigateurVisiteur: (o?: object) => Promise<{ page: Page }>, mailpit: never, prenom: string): Promise<CompteNeuf & { id: string; bookingId: string }> {
  const neuf = compteNeuf(prenom, "Effacement");
  await new Inscription((await navigateurVisiteur()).page).creer(neuf, mailpit);
  const garni = lireCoteServeur<{ id: string; bookingId: string }>(`
    import prisma from "./packages/libs/prisma";
    (async () => {
      const u = await prisma.user.findFirst({ where: { emailNormalized: ${q(neuf.email.toLowerCase())} }, select: { id: true } });
      const id = u!.id;
      await prisma.address.create({ data: { userId: id, label: "Maison", formattedAddress: "12 rue de la Recette, 75011 Paris", city: "Paris", country: "France", countryCode: "FR" } });
      const trip = await prisma.trip.findFirst({ where: { status: "PUBLISHED", isDeleted: false }, select: { id: true } });
      if (trip) await prisma.tripFavorite.create({ data: { userId: id, tripId: trip.id } });
      await prisma.notification.create({ data: { userId: id, type: "booking.completed", payload: {}, eventId: "${"0".repeat(8)}" + Date.now().toString(16).padStart(16, "0").slice(-16) } });
      // Une réservation TERMINÉE portée par ce compte : l'effacement doit la garder (copie d'un deal terminé du seed).
      const src = await prisma.booking.findFirst({ where: { status: "COMPLETED", isDeleted: false } });
      const { id: _ignore, ...rest } = src as Record<string, unknown>;
      const b = await prisma.booking.create({ data: { ...rest, shipperId: id, disputeTicket: null } as never, select: { id: true } });
      console.log("@@" + JSON.stringify({ id, bookingId: b.id }));
      process.exit(0);
    })();`);
  return { ...neuf, ...garni };
}

const lignes = async (ctx: Contexte, debut: string, filtre: { adminUserId?: string; action?: string; targetId?: string }) =>
  (await lireLeJournal(ctx.request, { from: debut, ...filtre })).filter((l) => !filtre.action || l.action === filtre.action);
const carteEffacement = (page: Page) => page.locator("section, div").filter({ has: page.getByRole("heading", { name: "Effacer ce compte (RGPD)" }) }).last();

test.describe("ADM-RGP — données personnelles et effacement (cahier 02-ADMIN § 5.21)", () => {
  test.beforeEach(() => {
    new JeuEssai().rejouer();
  });
  test.afterAll(() => {
    new JeuEssai().rejouer();
  });

  test("ADM-RGP-1 · le registre des demandes est journalisé à la lecture", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    const pri = await navigateurAdmin("privacy");
    const { page } = pri;
    const restantes = lireCoteServeur<number>(`import prisma from "./packages/libs/prisma"; (async () => { console.log("@@" + (await prisma.dataRequest.count())); process.exit(0); })();`);
    test.info().annotations.push({ type: "constat", description: `${restantes} demande(s) déjà au registre avant la fiche (le seed ne purge que celles de ses membres)` });
    const debut = await debutDuScenario();
    await page.goto(`${bo()}/privacy`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    /* 1. Sous-titre. */
    await expect(page.getByText("Le registre des demandes (export, effacement) : la preuve du délai légal d'un mois. Un effacement à la demande d'un membre se fait depuis sa fiche (« Effacer ce compte »). Cette consultation est journalisée.", { exact: true })).toBeVisible({ timeout: 60_000 });
    /* 2-3. Colonnes, ou l'état vide. */
    if (restantes === 0) await expect(page.getByText("Aucune demande pour l'instant.", { exact: true })).toBeVisible();
    else {
      await expect(page.locator("main thead th")).toHaveCount(6, { timeout: 60_000 });
      expect((await page.locator("main thead th").allInnerTexts()).map((t) => t.trim().toLowerCase())).toEqual(["quand", "membre", "demande", "canal", "issue", "détail"]);
    }
    /* 4. Une consultation = UNE ligne (ni zéro, ni deux) — même après que l'écran a fini TOUTES ses lectures. */
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(4_000);
    const vues = await lignes((await navigateurAdmin("super")).contexte, debut, { adminUserId: jeuEssai.admin("privacy").id, action: "DATA_REQUESTS_VIEWED" });
    expect(vues.length, "une consultation, une ligne").toBe(1);
    expect(vues[0].targetType).toBe("USER");
    expect(vues[0].targetId).toBeNull();
    expect(vues[0].after).toEqual({ rows: Math.min(restantes, 50) });
  });

  test("ADM-RGP-2 · un effacement refusé et ses bloqueurs", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    const pri = await navigateurAdmin("privacy");
    const { page } = pri;
    const thomas = jeuEssai.membre("thomas");
    const debut = await debutDuScenario();
    await page.goto(`${bo()}/users/${thomas}`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    const carte = carteEffacement(page);
    /* 1. Le texte de la carte. */
    await expect(carte).toContainText("Immédiat et irréversible. Anonymise l'identité et les coordonnées, supprime adresses, alertes, favoris, justificatifs ; conserve réservations, litiges, avis et messages sans le nom. Refusé tant qu'un deal vit. Le motif (demande reçue le…, canal) part au journal et au registre des demandes.", { timeout: 60_000 });
    const bouton = carte.getByRole("button", { name: "Effacer définitivement" });
    const motif = carte.locator("textarea");
    const confirmation = carte.locator("input");
    /* 2. Motif trop court → inactif. */
    await motif.fill("trop court");
    await confirmation.fill("EFFACER");
    await expect(bouton, "motif < 20 caractères").toBeDisabled();
    /* 3. « effacer » tapé en minuscules → mis en majuscules. */
    await motif.fill(MOTIF);
    await confirmation.fill("");
    await confirmation.pressSequentially("effacer");
    await expect(confirmation).toHaveValue("EFFACER");
    await expect(bouton).toBeEnabled();
    /* Le motif est borné à 500 caractères. */
    await motif.fill("x".repeat(600));
    expect((await motif.inputValue()).length, "motif ≤ 500").toBe(500);
    await motif.fill(MOTIF);
    /* 4-5. Le refus et sa traduction. */
    const reponse = page.waitForResponse((r) => r.url().includes(`/admin/users/${thomas}/erase`));
    await bouton.click();
    const r = await reponse;
    expect(r.status(), "refus 409").toBe(409);
    const corps = (await r.json()) as { code?: string; blockers?: string[] };
    test.info().annotations.push({ type: "constat", description: `bloqueurs de Thomas : ${corps.blockers?.join(", ")}` });
    expect(corps.code).toBe("ERASURE_BLOCKED");
    expect(corps.blockers).toEqual(expect.arrayContaining(["ACTIVE_DEAL", "PUBLISHED_TRIP"]));
    const LIBELLES: Record<string, string> = { ACTIVE_DEAL: "un deal en cours", PENDING_REQUEST: "une demande en attente", PAYOUT_PENDING: "un versement dû ou en échec", RETENTION_HELD: "une retenue en médiation", PUBLISHED_TRIP: "un trajet publié ou en pause", ADMIN_ACCOUNT: "un profil admin (à révoquer d'abord)" };
    await expect(carte).toContainText(`Refusé pour l'instant : ${corps.blockers!.map((b) => LIBELLES[b]).join(", ")}.`);
    /* 6. Le registre garde le refus. */
    await page.goto(`${bo()}/privacy`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    const ligne = page.locator("main tbody tr").first();
    await expect(ligne).toContainText("Effacement", { timeout: 60_000 });
    await expect(ligne).toContainText("par l'admin (Paul P.)");
    await expect(ligne).toContainText("refusée");
    await expect(ligne).toContainText("deal en cours");
    /* Aucune ligne ACCOUNT_ERASED ; divergence connue consignée. */
    const erase = await lignes((await navigateurAdmin("super")).contexte, debut, { action: "ACCOUNT_ERASED", targetId: thomas });
    expect(erase, "un refus n'écrit pas ACCOUNT_ERASED").toEqual([]);
    const enBase = lireCoteServeur<{ status: string; refusalReasons: string[]; reason: string | null; requestedByAdminId: string | null } | null>(`import prisma from "./packages/libs/prisma"; (async () => { const d = await prisma.dataRequest.findFirst({ where: { userId: ${q(thomas)}, type: "ERASURE" }, orderBy: { requestedAt: "desc" }, select: { status: true, refusalReasons: true, reason: true, requestedByAdminId: true } }); console.log("@@" + JSON.stringify(d)); process.exit(0); })();`);
    expect(enBase).toMatchObject({ status: "REFUSED", reason: MOTIF, requestedByAdminId: jeuEssai.admin("privacy").id });
  });

  test("ADM-RGP-3 · effacer un compte à la demande", async ({ navigateurAdmin, navigateurVisiteur, mailpit, jeuEssai }) => {
    test.setTimeout(10 * 60_000);
    const membre = await membreAEffacer(navigateurVisiteur as never, mailpit as never, "Rose");
    /* Une session membre ouverte AVANT l'effacement : elle doit mourir. */
    const visiteur = await navigateurVisiteur();
    const login = await visiteur.contexte.request.post(`${adresseDeLApi()}/auth/login`, { data: { email: membre.email, password: membre.motDePasse }, failOnStatusCode: false });
    expect(login.status(), "connexion avant effacement").toBe(200);
    await mailpit.vider();
    const pri = await navigateurAdmin("privacy");
    const { page } = pri;
    const debut = await debutDuScenario();
    await page.goto(`${bo()}/users/${membre.id}`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    const carte = carteEffacement(page);
    await carte.locator("textarea").fill(MOTIF, { timeout: 60_000 });
    await carte.locator("input").fill("EFFACER");
    const reponse = page.waitForResponse((r) => r.url().includes(`/admin/users/${membre.id}/erase`));
    await carte.getByRole("button", { name: "Effacer définitivement" }).click();
    expect((await reponse).status()).toBe(200);
    /* 3. Le message de succès — lisible par l'admin. */
    await expect(page.getByText("Compte effacé : identité et coordonnées supprimées, réservations conservées sans nom, journal écrit, email de confirmation envoyé à l'ancienne adresse.", { exact: true }), "le message de succès reste à l'écran").toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(5_000);
    await expect(page.getByRole("heading", { name: "Effacer ce compte (RGPD)" }), "la carte disparaît avec le compte").toHaveCount(0, { timeout: 30_000 });
    await expect(page.getByText(/^Compte effacé : identité et coordonnées supprimées/), "… et le message survit au rechargement de la fiche").toBeVisible();
    /* 4. La fiche rechargée, puis un second effacement → 404. */
    await page.reload({ waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    await expect(page.getByRole("heading", { level: 1 }).first()).toContainText("Membre supprimé", { timeout: 60_000 });
    await expect(page.getByRole("heading", { name: "Effacer ce compte (RGPD)" }), "plus de carte d'effacement").toHaveCount(0);
    const second = await pri.contexte.request.post(`${api()}/admin/users/${membre.id}/erase`, { data: { reason: MOTIF }, failOnStatusCode: false });
    expect(second.status()).toBe(404);
    expect(((await second.json()) as { message: string }).message).toBe("User not found.");
    /* 5-6. La base. */
    const base = lireCoteServeur<Record<string, unknown>>(`
      import prisma from "./packages/libs/prisma";
      (async () => {
        const id = ${q(membre.id)};
        const u = await prisma.user.findUnique({ where: { id }, select: { firstName: true, lastName: true, email: true, publicSlug: true, passwordHash: true, phoneE164: true, isDeleted: true, deletedAt: true, roles: true } });
        const [addresses, favorites, notifications, erased, booking, consents, requests] = await Promise.all([
          prisma.address.count({ where: { userId: id } }), prisma.tripFavorite.count({ where: { userId: id } }), prisma.notification.count({ where: { userId: id } }),
          prisma.erasedAccount.count({ where: { userId: id } }), prisma.booking.findUnique({ where: { id: ${q(membre.bookingId)} }, select: { shipperId: true, status: true } }),
          prisma.consentLog.findMany({ where: { userId: id }, select: { ipAddress: true, userAgent: true } }), prisma.dataRequest.findMany({ where: { userId: id }, select: { type: true, channel: true, status: true } }),
        ]);
        console.log("@@" + JSON.stringify({ u, addresses, favorites, notifications, erased, booking, consents, requests }));
        process.exit(0);
      })();`);
    expect(base.u).toMatchObject({ firstName: "Membre", lastName: "supprimé", email: `erased+${membre.id}@anonymised.invalid`, publicSlug: `deleted-${membre.id}`, passwordHash: null, phoneE164: null, isDeleted: true, roles: [] });
    expect((base.u as { deletedAt: string | null }).deletedAt).toBeTruthy();
    expect({ addresses: base.addresses, favorites: base.favorites, notifications: base.notifications, erased: base.erased }).toEqual({ addresses: 0, favorites: 0, notifications: 0, erased: 1 });
    expect(base.booking, "la réservation est conservée").toEqual({ shipperId: membre.id, status: "COMPLETED" });
    const consents = base.consents as Array<{ ipAddress: string | null; userAgent: string | null }>;
    expect(consents.length, "le consentement est gardé").toBeGreaterThan(0);
    expect(consents.every((c) => c.ipAddress === null && c.userAgent === null), "sans IP ni user-agent").toBe(true);
    expect(base.requests).toEqual([{ type: "ERASURE", channel: "ADMIN", status: "DONE" }]);
    /* 7. Les anciens identifiants, puis la session d'avant. */
    const relogin = await visiteur.contexte.request.post(`${adresseDeLApi()}/auth/login`, { data: { email: membre.email, password: membre.motDePasse }, failOnStatusCode: false });
    test.info().annotations.push({ type: "constat", description: `connexion avec les anciens identifiants → ${relogin.status()} ${await relogin.text()}` });
    expect(relogin.status(), "anciens identifiants refusés").not.toBe(200);
    const me = await visiteur.contexte.request.get(`${adresseDeLApi()}/auth/me`, { failOnStatusCode: false });
    expect(me.status(), "la session d'avant est morte").toBe(401);
    test.info().annotations.push({ type: "constat", description: `session d'avant → ${me.status()} ${await me.text()}` });
    /* 8. L'email de confirmation, sans lien. */
    const email = await mailpit.attendreEmail({ pour: membre.email });
    expect(email.html ?? "", "aucun lien dans l'email").not.toMatch(/<a\s[^>]*href=/i);
    test.info().annotations.push({ type: "constat", description: `email : « ${email.sujet} »` });
    /* 9. Le registre. */
    await page.goto(`${bo()}/privacy`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    const ligne = page.locator("main tbody tr").filter({ has: page.locator(`a[href="/users/${membre.id}"]`) }).first();
    await expect(ligne).toContainText("Membre supprimé", { timeout: 60_000 });
    await expect(ligne).toContainText("Effacement");
    await expect(ligne).toContainText("par l'admin (Paul P.)");
    await expect(ligne).toContainText("faite");
    /* 10. Son propre compte. */
    const soi = await pri.contexte.request.post(`${api()}/admin/users/${jeuEssai.admin("privacy").id}/erase`, { data: { reason: MOTIF }, failOnStatusCode: false });
    expect(soi.status()).toBe(403);
    expect(((await soi.json()) as { message: string }).message).toBe("You cannot erase your own account from the back-office.");
    /* Journal : une ligne ACCOUNT_ERASED. */
    const erase = await lignes((await navigateurAdmin("super")).contexte, debut, { action: "ACCOUNT_ERASED", targetId: membre.id });
    expect(erase.length).toBe(1);
    expect(erase[0].after).toMatchObject({ reason: MOTIF, stripeAccountKept: false });
  });

  test("ADM-RGP-4 · le tiers destinataire est oublié", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    const ops = await navigateurAdmin("exploitation");
    const deal = jeuEssai.deal("bzv-completed").id;
    const lireReservation = () => lireCoteServeur<{ recipient: { firstName: string; phoneE164: string; email: string | null }; recipientRedactedAt: string | null; token: string | null }>(`import prisma from "./packages/libs/prisma"; (async () => { const b = await prisma.booking.findUnique({ where: { id: ${q(deal)} }, select: { recipient: true, recipientRedactedAt: true } }); const t = await prisma.trackingLink.findUnique({ where: { bookingId: ${q(deal)} }, select: { token: true } }); console.log("@@" + JSON.stringify({ ...b, token: t?.token ?? null })); process.exit(0); })();`);
    const passage = () => lireCoteServeur<{ examined: number; redacted: number }>(`import { makeRecipientRedactionService } from "./apps/deal-service/src/services/recipient-redaction.service"; (async () => { console.log("@@" + JSON.stringify(await makeRecipientRedactionService().runOnce())); process.exit(0); })();`);
    const reglages = async () => (await (await ops.contexte.request.get(`${api()}/admin/settings`)).json()) as { version: number; values: Record<string, number> };
    const poser = async (valeur: number) => {
      const r = await reglages();
      return ops.contexte.request.patch(`${api()}/admin/settings`, { data: { changes: { "privacy.recipientRetentionDays": valeur }, reason: MOTIF_DE_RECETTE("ADM-RGP-4"), expectedVersion: r.version }, failOnStatusCode: false });
    };
    /* 1. Le destinataire est renseigné ; le deal a fini il y a 2 jours. */
    const avant = lireReservation();
    expect(avant.recipientRedactedAt).toBeNull();
    expect(avant.recipient.firstName).not.toBe("—");
    /* Jamais avant : un passage au délai par défaut (30 j) ne touche pas ce deal. */
    passage();
    expect(lireReservation().recipientRedactedAt, "30 j : rien d'effacé").toBeNull();
    const debut = await debutDuScenario();
    /* 2. Le cahier abaisse à 0 : la borne est 7. */
    const zero = await poser(0);
    test.info().annotations.push({ type: "écart documentaire", description: `le cahier abaisse privacy.recipientRetentionDays à 0 → ${zero.status()} (borne min 7) ; la fiche abaisse à 7 et vieillit la fin du deal à 10 jours (manœuvre consignée)` });
    expect(zero.status()).toBe(400);
    expect((await poser(7)).status()).toBe(200);
    new JeuEssai().manoeuvre("fin du deal bzv-completed reculée à J-10", `import prisma from "./packages/libs/prisma"; (async () => { await prisma.booking.update({ where: { id: ${q(deal)} }, data: { completedAt: new Date(Date.now() - 10 * 86400000) } }); process.exit(0); })();`);
    /* 3. Le passage du cron (même service que le cron de 03:40). */
    const r = passage();
    expect(r.redacted, `passage ${JSON.stringify(r)}`).toBeGreaterThanOrEqual(1);
    /* 4. Les coordonnées ont disparu, le lien de suivi est mort. */
    const apres = lireReservation();
    expect(apres.recipientRedactedAt).toBeTruthy();
    expect(apres.recipient).toMatchObject({ firstName: "—", lastName: "—", phoneE164: "+00000000000", email: null });
    if (avant.token) {
      const suivi = await ops.contexte.request.get(`${adresseDeLApi()}/track/${avant.token}`, { failOnStatusCode: false });
      expect(suivi.status(), "le lien de suivi meurt").toBe(404);
    } else test.info().annotations.push({ type: "constat", description: "pas de lien de suivi sur ce deal du seed" });
    /* Un second passage n'efface pas deux fois. */
    const encore = passage();
    expect(lireReservation().recipientRedactedAt, "jamais deux fois").toBe(apres.recipientRedactedAt);
    test.info().annotations.push({ type: "constat", description: `second passage ${JSON.stringify(encore)}` });
    /* 5. Retour à 30 ; deux SETTING_CHANGED. */
    expect((await poser(30)).status()).toBe(200);
    const changes = (await lignes((await navigateurAdmin("super")).contexte, debut, { adminUserId: jeuEssai.admin("exploitation").id, action: "SETTING_CHANGED" })).filter((l) => JSON.stringify(l).includes("privacy.recipientRetentionDays"));
    expect(changes.length, "l'abaissement et le retour").toBe(2);
  });

  test("ADM-RGP-5 · deux effacements simultanés : un effacé, un refus propre, jamais 500 (ajoutée)", async ({ navigateurAdmin, navigateurVisiteur, mailpit, jeuEssai }) => {
    test.setTimeout(8 * 60_000);
    const membre = await membreAEffacer(navigateurVisiteur as never, mailpit as never, "Iris");
    const pri = await navigateurAdmin("privacy");
    const sup = await navigateurAdmin("super");
    /* Un admin a la fiche ouverte, formulaire rempli, pendant que d'autres effacent le compte. */
    const { page } = pri;
    await page.goto(`${bo()}/users/${membre.id}`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    const carte = carteEffacement(page);
    await carte.locator("textarea").fill(MOTIF, { timeout: 60_000 });
    await carte.locator("input").fill("EFFACER");
    const debut = await debutDuScenario();
    const envois = await Promise.all([pri, sup, pri].map((n) => n.contexte.request.post(`${api()}/admin/users/${membre.id}/erase`, { data: { reason: MOTIF }, failOnStatusCode: false })));
    const statuts = envois.map((e) => e.status()).sort();
    test.info().annotations.push({ type: "constat", description: `trois effacements simultanés → ${statuts.join(", ")}` });
    expect(statuts.filter((s) => s === 200).length, "un seul effacement").toBe(1);
    expect(statuts.filter((s) => s >= 500), "jamais 500").toEqual([]);
    const traces = lireCoteServeur<{ erased: number; requests: number }>(`import prisma from "./packages/libs/prisma"; (async () => { console.log("@@" + JSON.stringify({ erased: await prisma.erasedAccount.count({ where: { userId: ${q(membre.id)} } }), requests: await prisma.dataRequest.count({ where: { userId: ${q(membre.id)}, status: "DONE" } }) })); process.exit(0); })();`);
    expect(traces).toEqual({ erased: 1, requests: 1 });
    const erase = await lignes(sup.contexte, debut, { action: "ACCOUNT_ERASED", targetId: membre.id });
    expect(erase.length, "une ligne de journal").toBe(1);
    /* L'admin arrivé en retard clique : le refus se lit en français, la fiche se recharge, la carte disparaît (ANO-ADM-59). */
    await carte.getByRole("button", { name: "Effacer définitivement" }).click();
    await expect(page.getByText("Ce compte n'existe plus ou vient d'être effacé par un autre administrateur.", { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/\d{3} : /), "jamais « 404 : User not found. »").toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Effacer ce compte (RGPD)" })).toHaveCount(0, { timeout: 60_000 });
    await expect(page.getByRole("heading", { level: 1 }).first()).toContainText("Membre supprimé");
    void jeuEssai;
  });

  test("ADM-RGP-6 · un profil sans la permission : un seul refus, rien au journal (ajoutée)", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(5 * 60_000);
    const sup = await navigateurAdmin("support");
    const debut = await debutDuScenario();
    await sup.page.goto(`${bo()}/privacy`, { waitUntil: "domcontentloaded" });
    await expect(sup.page.locator("main p[role=alert]")).toHaveText("Ton profil n'ouvre pas le registre des données personnelles.", { timeout: 60_000 });
    await expect(sup.page.getByText(/Cette consultation est journalisée/), "aucune consigne sous le refus").toHaveCount(0);
    expect((await sup.contexte.request.get(`${api()}/admin/privacy/requests`, { failOnStatusCode: false })).status()).toBe(403);
    const thomas = jeuEssai.membre("thomas");
    expect((await sup.contexte.request.post(`${api()}/admin/users/${thomas}/erase`, { data: { reason: MOTIF }, failOnStatusCode: false })).status(), "Support n'efface pas").toBe(403);
    await sup.page.goto(`${bo()}/users/${thomas}`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(sup.page);
    await expect(sup.page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 60_000 });
    await expect(sup.page.getByRole("heading", { name: "Effacer ce compte (RGPD)" }), "pas de carte pour le Support").toHaveCount(0);
    const journal = await lignes((await navigateurAdmin("super")).contexte, debut, { adminUserId: jeuEssai.admin("support").id });
    expect(journal.filter((l) => ["DATA_REQUESTS_VIEWED", "ACCOUNT_ERASED"].includes(l.action)), "un refus n'écrit rien").toEqual([]);
  });
});
