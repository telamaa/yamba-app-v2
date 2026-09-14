/**
 * adm-eml-suppression.spec.ts — cahier 02-ADMIN, § 5.5 « Suppression d'adresse email » (ADM-EML-1, et ses preuves)
 * ================================================================================================================
 * La liste de suppression (D35 4A) : un rebond dur ou une plainte, appris par le webhook signé du fournisseur, pose
 * `User.emailSuppressedAt` ; plus AUCUN email ne part vers ce compte, jusqu'à ce qu'un administrateur lève la suppression.
 *
 * Partis pris :
 *  - **la suppression passe par le vrai chemin** — un webhook Svix signé avec le secret du poste, via la passerelle —
 *    plutôt que « poser le champ à la main » (que le cahier autorise) : c'est le seul endroit où elle naît en production ;
 *  - **« aucun email ne lui est envoyé » se prouve par deux envois réels**, attendus puis absents : l'email d'administration
 *    d'un billet (ANO-ADM-10 : il partait quand même) et l'accusé de réception d'un signalement ; « les emails repartent »
 *    se prouve par le même accusé, reçu après la levée ;
 *  - Thomas (Voyageur du billet en attente du jeu d'essai) porte la fiche ; tout est rétabli en `finally` et le jeu d'essai
 *    rejoué en fin de chapitre (le billet a été validé).
 */
import { test, expect, type NavigateurAdmin } from "../fixtures/yamba";
import { JeuEssai } from "../fixtures/jeu-essai";
import { COMPTES_ADMIN } from "../fixtures/comptes";
import { adresseDeLApi, adresseDeLApiAdmin, adresseDuBackOffice } from "../fixtures/adresses";
import { lireLeJournal } from "../pages/journal-admin";
import { attendreLeChargement, debutDuScenario, lireCoteServeur } from "../pages/ecran-admin";

const api = () => adresseDeLApiAdmin();
const bo = () => adresseDuBackOffice();
type Contexte = NavigateurAdmin["contexte"];

const THOMAS = "thomas.carrier@seed.yamba.dev";
const MOTIF = "Recette ADM-EML-1 : adresse vérifiée avec le membre, les emails peuvent repartir.";
const ATTENTE_EMAIL_MS = 10_000;

/** Un événement Resend signé au format Svix avec le secret du poste (lu côté serveur, jamais dans le harnais). */
function signer(corps: string): { id: string; ts: string; signature: string } {
  const b64 = Buffer.from(corps, "utf-8").toString("base64");
  return lireCoteServeur(`
    import { svixSign } from "./packages/libs/email/src/webhook";
    const corps = Buffer.from("${b64}", "base64").toString("utf-8");
    const id = "msg_recette_" + Date.now();
    const ts = String(Math.floor(Date.now() / 1000));
    console.log("@@" + JSON.stringify({ id, ts, signature: "v1," + svixSign(process.env.RESEND_WEBHOOK_SECRET as string, id, ts, corps) }));
    process.exit(0);`);
}

async function webhook(ctx: Contexte, evenement: Record<string, unknown>, signature?: string): Promise<{ status: number; body: { suppressed?: boolean; reason?: string } }> {
  const corps = JSON.stringify(evenement);
  const s = signer(corps);
  const r = await ctx.request.post(`${adresseDeLApi()}/webhooks/email/resend`, {
    headers: { "content-type": "application/json", "svix-id": s.id, "svix-timestamp": s.ts, "svix-signature": signature ?? s.signature },
    data: corps,
    failOnStatusCode: false,
  });
  return { status: r.status(), body: (await r.json().catch(() => ({}))) as { suppressed?: boolean } };
}

const rebond = (email: string, type = "hard") => ({ type: "email.bounced", created_at: new Date().toISOString(), data: { email_id: `recette-eml-${Date.now()}`, to: [email], subject: "recette", bounce: { type, message: "550 mailbox unavailable" } } });
const plainte = (email: string) => ({ type: "email.complained", created_at: new Date().toISOString(), data: { email_id: `recette-eml-${Date.now()}`, to: [email], subject: "recette" } });

function etat(email: string): { id: string; at: string | null; reason: string | null } {
  return lireCoteServeur(`
    import prisma from "./packages/libs/prisma";
    (async () => {
      const u = await prisma.user.findFirst({ where: { emailNormalized: ${JSON.stringify(email)} }, select: { id: true, emailSuppressedAt: true, emailSuppressedReason: true } });
      console.log("@@" + JSON.stringify({ id: u?.id, at: u?.emailSuppressedAt ?? null, reason: u?.emailSuppressedReason ?? null }));
      process.exit(0);
    })();`);
}

/** Nettoyage consigné : les adresses touchées par le chapitre repartent sans suppression. */
function retablirEnBase(emails: string[], raison: string): void {
  process.stdout.write(`   ↳ manœuvre en base : ${raison} (${emails.join(", ")})\n`);
  lireCoteServeur(`
    import prisma from "./packages/libs/prisma";
    (async () => {
      const r = await prisma.user.updateMany({ where: { emailNormalized: { in: ${JSON.stringify(emails)} } }, data: { emailSuppressedAt: null, emailSuppressedReason: null } });
      console.log("@@" + JSON.stringify(r.count));
      process.exit(0);
    })();`);
}

/** Deux trajets visibles d'autres Voyageurs (cibles des signalements de Thomas). */
function deuxTrajetsDAutrui(thomasId: string): string[] {
  return lireCoteServeur(`
    import prisma from "./packages/libs/prisma";
    (async () => {
      const t = await prisma.trip.findMany({ where: { userId: { not: ${JSON.stringify(thomasId)} }, status: "PUBLISHED", isDeleted: false, OR: [{ hiddenByAdminAt: null }, { hiddenByAdminAt: { isSet: false } }] } as never, select: { id: true }, take: 2, orderBy: { createdAt: "asc" } });
      console.log("@@" + JSON.stringify(t.map((x) => x.id)));
      process.exit(0);
    })();`);
}

function supprimerSignalements(reporterId: string, depuis: string): void {
  lireCoteServeur(`
    import prisma from "./packages/libs/prisma";
    (async () => { const r = await prisma.report.deleteMany({ where: { reporterUserId: ${JSON.stringify(reporterId)}, createdAt: { gte: new Date(${JSON.stringify(depuis)}) } } }); console.log("@@" + r.count); process.exit(0); })();`);
}

test.describe("ADM-EML — suppression d'adresse email (cahier 02-ADMIN § 5.5)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(() => {
    new JeuEssai().rejouer();
  });
  test.afterAll(() => {
    // Le billet du jeu d'essai a été validé par la fiche : la file « Billets » repart propre pour le chapitre suivant.
    new JeuEssai().rejouer();
  });

  test("ADM-EML-0 · la suppression naît du webhook signé, et seulement d'un rebond DUR ou d'une plainte", async ({ navigateurVisiteur }) => {
    test.setTimeout(4 * 60_000);
    const { contexte } = await navigateurVisiteur();
    try {
      expect(etat(THOMAS).at, "départ : Thomas n'est pas en suppression").toBeNull();
      /* Signature fausse : 401, rien ne change. */
      const faux = await webhook(contexte, rebond(THOMAS), "v1,AAAAsignaturefausseAAAA=");
      expect(faux.status, "signature fausse").toBe(401);
      expect(faux.body.reason).toBe("BAD_SIGNATURE");
      /* Rebond temporaire (soft) : trace mise à jour, adresse CONSERVÉE. */
      const doux = await webhook(contexte, rebond(THOMAS, "transient"));
      expect(doux.status).toBe(200);
      expect(doux.body.suppressed, "un rebond temporaire ne supprime pas").toBe(false);
      expect(etat(THOMAS).at).toBeNull();
      /* Rebond dur : suppression posée. */
      const dur = await webhook(contexte, rebond(THOMAS));
      expect(dur.body.suppressed, "rebond dur → suppression").toBe(true);
      const e1 = etat(THOMAS);
      expect(e1.at).not.toBeNull();
      expect(e1.reason).toBe("HARD_BOUNCE");
      /* Rejeu du même type d'événement : idempotent, la date d'origine est gardée. */
      const rejeu = await webhook(contexte, rebond(THOMAS));
      expect(rejeu.body.suppressed, "déjà supprimée : aucun effet").toBe(false);
      expect(etat(THOMAS).at, "date d'origine conservée").toBe(e1.at);
      test.info().annotations.push({ type: "constat", description: `webhook : faux 401, temporaire 200 sans effet, dur 200 → HARD_BOUNCE le ${e1.at}, rejeu sans effet` });
    } finally {
      retablirEnBase([THOMAS], "ADM-EML-0 rétablit l'adresse de Thomas");
    }
  });

  test("ADM-EML-1 · lever une suppression d'adresse", async ({ navigateurAdmin, navigateurConnecte, navigateurVisiteur, jeuEssai, mailpit }) => {
    test.setTimeout(8 * 60_000);
    const sup = await navigateurAdmin("support");
    const journal = await navigateurAdmin("finance");
    const visiteur = await navigateurVisiteur();
    const thomasId = jeuEssai.membre("thomas");
    const debutSignalements = new Date().toISOString();
    const [cibleAvant, cibleApres] = deuxTrajetsDAutrui(thomasId);
    const thomas = await navigateurConnecte("thomas");
    try {
      /* Précondition : Thomas en suppression, par le webhook. */
      expect((await webhook(visiteur.contexte, rebond(THOMAS))).body.suppressed).toBe(true);
      const avant = etat(THOMAS);

      /* « Aucun email ne lui est envoyé » — deux envois RÉELS, absents. */
      const billet = ((await (await sup.contexte.request.get(`${api()}/admin/tickets`)).json()) as { items: Array<{ documentId: string; carrier: { id: string }; originCity: string; destinationCity: string }> }).items.find((i) => i.carrier.id === thomasId);
      expect(billet, "le billet en attente du jeu d'essai est celui de Thomas").toBeTruthy();
      const sujetBillet = `Billet vérifié pour ton trajet ${billet!.originCity} → ${billet!.destinationCity}`;
      const sujetSignalement = "Ton signalement a bien été reçu";
      const billetsAvant = await mailpit.compter({ pour: THOMAS, sujet: sujetBillet });
      const signalementsAvant = await mailpit.compter({ pour: THOMAS, sujet: sujetSignalement });
      expect((await sup.contexte.request.post(`${api()}/admin/tickets/${billet!.documentId}/review`, { data: { decision: "VERIFY" } })).ok(), "le Support valide le billet").toBe(true);
      expect((await thomas.contexte.request.post(`${adresseDeLApi()}/reports`, { data: { targetType: "TRIP", targetRef: cibleAvant, reason: "OTHER", details: "Recette ADM-EML-1, avant la levée" } })).status(), "Thomas signale un trajet").toBe(201);
      await new Promise((r) => setTimeout(r, ATTENTE_EMAIL_MS));
      expect(await mailpit.compter({ pour: THOMAS, sujet: sujetBillet }), "ANO-ADM-10 — « Billet vérifié » ne part PAS vers une adresse supprimée").toBe(billetsAvant);
      expect(await mailpit.compter({ pour: THOMAS, sujet: sujetSignalement }), "l'accusé de signalement ne part pas").toBe(signalementsAvant);

      /* A155 — lever sans motif est refusé. */
      const sansMotif = await sup.contexte.request.delete(`${api()}/admin/users/${thomasId}/email-suppression`, { failOnStatusCode: false });
      expect(sansMotif.status(), "sans motif : 400").toBe(400);
      expect(((await sansMotif.json()) as { details?: { code?: string } }).details?.code).toBe("REASON_REQUIRED");

      /* 1-2. La fiche, le bandeau ambre. */
      const debut = await debutDuScenario();
      const { page } = sup;
      await page.goto(`${bo()}/users/${thomasId}`, { waitUntil: "domcontentloaded" });
      await attendreLeChargement(page);
      const bandeau = page.locator("div.bg-amber-50").filter({ hasText: "Adresse sur la liste de suppression" });
      await expect(bandeau).toBeVisible({ timeout: 60_000 });
      await expect(bandeau).toContainText(/^Adresse sur la liste de suppression depuis le .+ \(rebond dur\) : aucun email ne lui est envoyé\./);
      test.info().annotations.push({ type: "constat", description: `bandeau : « ${(await bandeau.locator("span").first().innerText()).trim()} »` });

      /* 3. « Lever (adresse corrigée) » → motif → « Confirmer la levée ». */
      await bandeau.getByRole("button", { name: "Lever (adresse corrigée)" }).click();
      await expect(bandeau.getByText(`Les emails repartiront vers ${THOMAS}.`)).toBeVisible();
      const confirmer = bandeau.getByRole("button", { name: "Confirmer la levée" });
      await expect(confirmer, "désactivé tant que le motif est court").toBeDisabled();
      await bandeau.locator("textarea").fill(MOTIF);
      const leve = page.waitForResponse((r) => r.url().includes("/email-suppression") && r.request().method() === "DELETE");
      await confirmer.click();
      expect((await leve).status(), "DELETE /admin/users/:id/email-suppression").toBe(200);
      await expect(page.getByText(`Suppression levée : les emails repartent vers ${THOMAS}.`), "le geste réussi se nomme").toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("Adresse sur la liste de suppression")).toHaveCount(0);
      expect(etat(THOMAS).at, "emailSuppressedAt repasse à null").toBeNull();

      /* 4. Recharger : plus de bandeau. */
      await page.reload({ waitUntil: "domcontentloaded" });
      await attendreLeChargement(page);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText("Adresse sur la liste de suppression")).toHaveCount(0);

      /* « Les emails repartent » : le même accusé, reçu cette fois. */
      expect((await thomas.contexte.request.post(`${adresseDeLApi()}/reports`, { data: { targetType: "TRIP", targetRef: cibleApres, reason: "OTHER", details: "Recette ADM-EML-1, après la levée" } })).status()).toBe(201);
      await expect.poll(() => mailpit.compter({ pour: THOMAS, sujet: sujetSignalement }), { timeout: 45_000, message: "l'accusé de signalement arrive après la levée" }).toBe(signalementsAvant + 1);

      /* 5. Rappel direct : 400 « This address is not suppressed. ». */
      const encore = await sup.contexte.request.delete(`${api()}/admin/users/${thomasId}/email-suppression`, { data: { reason: MOTIF }, failOnStatusCode: false });
      expect(encore.status()).toBe(400);
      const corps = (await encore.json()) as { message: string; details?: { code?: string } };
      expect(corps.message).toBe("This address is not suppressed.");
      expect(corps.details?.code).toBe("EMAIL_NOT_SUPPRESSED");

      /* Journal : UNE ligne, avant { date, motif fournisseur }, après { null, motif de l'admin }. */
      const lignes = (await lireLeJournal(journal.contexte.request, { from: debut, adminUserId: jeuEssai.admin("support").id })).filter((l) => l.action === "EMAIL_SUPPRESSION_LIFTED");
      expect(lignes.map((l) => `${l.targetType} · ${l.targetId}`), "une ligne").toEqual([`USER · ${thomasId}`]);
      expect(lignes[0].before).toEqual({ emailSuppressedAt: new Date(avant.at as string).toISOString(), reason: "HARD_BOUNCE" });
      expect(lignes[0].after).toEqual({ emailSuppressedAt: null, liftReason: MOTIF });
    } finally {
      retablirEnBase([THOMAS], "ADM-EML-1 rétablit l'adresse de Thomas");
      supprimerSignalements(thomasId, debutSignalements);
    }
  });

  test("ADM-EML-2 · une plainte, deux administrateurs en même temps, un profil sans droit, un compte admin", async ({ navigateurAdmin, navigateurVisiteur, jeuEssai }) => {
    test.setTimeout(8 * 60_000);
    const med = await navigateurAdmin("mediateur");
    const sup = await navigateurAdmin("support");
    const fin = await navigateurAdmin("finance");
    const superAdmin = await navigateurAdmin("super");
    const visiteur = await navigateurVisiteur();
    const thomasId = jeuEssai.membre("thomas");
    const adresseMediateur = COMPTES_ADMIN.mediateur.email;
    try {
      /* Une PLAINTE : le bandeau le dit, et la levée avertit. */
      expect((await webhook(visiteur.contexte, plainte(THOMAS))).body.suppressed).toBe(true);
      expect(etat(THOMAS).reason).toBe("COMPLAINT");
      await med.page.goto(`${bo()}/users/${thomasId}`, { waitUntil: "domcontentloaded" });
      await attendreLeChargement(med.page);
      const bandeau = med.page.locator("div.bg-amber-50").filter({ hasText: "Adresse sur la liste de suppression" });
      await expect(bandeau).toContainText("(plainte)", { timeout: 60_000 });
      await bandeau.getByRole("button", { name: "Lever (adresse corrigée)" }).click();
      await expect(bandeau.getByText("Ce membre a signalé un email comme indésirable : ne lève que s'il te l'a demandé.")).toBeVisible();

      /* Finance n'a pas le droit : pas de bouton, 403 serveur. */
      await fin.page.goto(`${bo()}/users/${thomasId}`, { waitUntil: "domcontentloaded" });
      await attendreLeChargement(fin.page);
      await expect(fin.page.getByText("Adresse sur la liste de suppression")).toBeVisible({ timeout: 60_000 });
      await expect(fin.page.getByRole("button", { name: "Lever (adresse corrigée)" }), "Finance : pas de bouton").toHaveCount(0);
      const refus = await fin.contexte.request.delete(`${api()}/admin/users/${thomasId}/email-suppression`, { data: { reason: MOTIF }, failOnStatusCode: false });
      expect(refus.status(), "Finance : 403").toBe(403);

      /* Deux levées simultanées (Médiateur et Support) : une réussit, l'autre reçoit EMAIL_NOT_SUPPRESSED, UNE ligne. */
      const debut = await debutDuScenario();
      const [a, b] = await Promise.all([
        med.contexte.request.delete(`${api()}/admin/users/${thomasId}/email-suppression`, { data: { reason: MOTIF }, failOnStatusCode: false }),
        sup.contexte.request.delete(`${api()}/admin/users/${thomasId}/email-suppression`, { data: { reason: MOTIF }, failOnStatusCode: false }),
      ]);
      expect([a.status(), b.status()].sort(), "une réussite, un refus").toEqual([200, 400]);
      const lignes = (await lireLeJournal(fin.contexte.request, { from: debut })).filter((l) => l.action === "EMAIL_SUPPRESSION_LIFTED" && l.targetId === thomasId);
      expect(lignes, "une seule ligne de journal pour deux clics").toHaveLength(1);
      /* L'écran du Médiateur, resté ouvert sur le formulaire : le refus se lit en français et la fiche se recharge. */
      if (a.status() === 400 || b.status() === 400) {
        await bandeau.locator("textarea").fill(MOTIF);
        await bandeau.getByRole("button", { name: "Confirmer la levée" }).click();
        await expect(med.page.getByText("Cette adresse n'est plus sur la liste de suppression (déjà levée, peut-être depuis un autre onglet). La fiche est rechargée."), "le refus concurrent se lit en français").toBeVisible({ timeout: 30_000 });
        await expect(med.page.getByText("Adresse sur la liste de suppression")).toHaveCount(0, { timeout: 30_000 });
      }

      /* Un compte ADMIN en suppression : le Support ne voit pas le bouton (garde SUPER_ADMIN_ONLY) ; le super administrateur lève. */
      expect((await webhook(visiteur.contexte, rebond(adresseMediateur))).body.suppressed).toBe(true);
      const medId = jeuEssai.admin("mediateur").id;
      await sup.page.goto(`${bo()}/users/${medId}`, { waitUntil: "domcontentloaded" });
      await attendreLeChargement(sup.page);
      await expect(sup.page.getByText("Adresse sur la liste de suppression")).toBeVisible({ timeout: 60_000 });
      await expect(sup.page.getByRole("button", { name: "Lever (adresse corrigée)" }), "Support sur un compte admin : pas de bouton").toHaveCount(0);
      const refusAdmin = await sup.contexte.request.delete(`${api()}/admin/users/${medId}/email-suppression`, { data: { reason: MOTIF }, failOnStatusCode: false });
      expect(refusAdmin.status()).toBe(403);
      expect(((await refusAdmin.json()) as { details?: { code?: string } }).details?.code).toBe("SUPER_ADMIN_ONLY");
      expect((await superAdmin.contexte.request.delete(`${api()}/admin/users/${medId}/email-suppression`, { data: { reason: MOTIF } })).ok(), "le super administrateur lève").toBe(true);

      /* Un motif inconnu n'est plus présenté comme un rebond dur (manœuvre : aucun webhook ne pose UNKNOWN). */
      jeuEssai.manoeuvre("ADM-EML-2 pose un motif de suppression inconnu sur Thomas", `
        import prisma from "./packages/libs/prisma";
        (async () => { await prisma.user.updateMany({ where: { emailNormalized: ${JSON.stringify(THOMAS)} }, data: { emailSuppressedAt: new Date(), emailSuppressedReason: "UNKNOWN" } }); process.exit(0); })();`);
      await sup.page.goto(`${bo()}/users/${thomasId}`, { waitUntil: "domcontentloaded" });
      await attendreLeChargement(sup.page);
      await expect(sup.page.locator("div.bg-amber-50").filter({ hasText: "Adresse sur la liste de suppression" })).toContainText("(motif non renseigné)", { timeout: 60_000 });
    } finally {
      retablirEnBase([THOMAS, adresseMediateur], "ADM-EML-2 rétablit Thomas et le Médiateur");
    }
  });

  test("ADM-EML-3 · un super administrateur en suppression ne reçoit plus l'email des paramètres (ANO-ADM-11)", async ({ navigateurAdmin, navigateurVisiteur, mailpit }) => {
    test.setTimeout(6 * 60_000);
    const ops = await navigateurAdmin("exploitation");
    const visiteur = await navigateurVisiteur();
    const adresseSuper = COMPTES_ADMIN.super.email;
    const cle = "alerts.outboxLagMinutes";
    const sujet = "Paramètres de la plateforme modifiés";
    const autres = lireCoteServeur<string[]>(`
      import prisma from "./packages/libs/prisma";
      (async () => { const u = await prisma.user.findMany({ where: { roles: { has: "ADMIN" }, adminRoles: { has: "SUPER_ADMIN" }, isDeleted: false, emailNormalized: { not: ${JSON.stringify(adresseSuper)} } }, select: { emailNormalized: true } }); console.log("@@" + JSON.stringify(u.map((x) => x.emailNormalized))); process.exit(0); })();`);
    const lire = async () => (await (await ops.contexte.request.get(`${api()}/admin/settings`)).json()) as { version: number; values: Record<string, number>; defaults: Record<string, number> };
    const changer = async (motif: string) => {
      const r = await lire();
      expect((await ops.contexte.request.patch(`${api()}/admin/settings`, { data: { changes: { [cle]: r.values[cle] + 1 }, reason: motif, expectedVersion: r.version } })).ok()).toBe(true);
    };
    try {
      /* Contre-épreuve : adresse joignable → l'email des paramètres ARRIVE (sinon « rien reçu » ne prouverait rien). */
      const depart = await mailpit.compter({ pour: adresseSuper, sujet });
      await changer("Recette ADM-EML-3 : premier changement, adresse du super administrateur joignable");
      await expect.poll(() => mailpit.compter({ pour: adresseSuper, sujet }), { timeout: 45_000, message: "adresse joignable : l'email arrive" }).toBe(depart + 1);
      /* Adresse supprimée (webhook) → le même geste n'envoie plus rien à cette adresse. */
      expect((await webhook(visiteur.contexte, rebond(adresseSuper))).body.suppressed).toBe(true);
      const avantAutres = await Promise.all(autres.map((a) => mailpit.compter({ pour: a, sujet })));
      await changer("Recette ADM-EML-3 : second changement, adresse du super administrateur supprimée");
      if (autres.length) {
        await expect.poll(async () => (await Promise.all(autres.map((a) => mailpit.compter({ pour: a, sujet })))).reduce((x, y) => x + y, 0), { timeout: 45_000, message: "les autres super administrateurs reçoivent l'email" }).toBe(avantAutres.reduce((x, y) => x + y, 0) + autres.length);
      } else {
        await new Promise((res) => setTimeout(res, ATTENTE_EMAIL_MS));
      }
      expect(await mailpit.compter({ pour: adresseSuper, sujet }), "ANO-ADM-11 — l'adresse supprimée ne reçoit rien").toBe(depart + 1);
      test.info().annotations.push({ type: "constat", description: `email « ${sujet} » : reçu adresse joignable, NON reçu adresse supprimée (${adresseSuper}) ; autres super administrateurs joignables : ${autres.length}` });
    } finally {
      const v = await lire();
      if (v.values[cle] !== v.defaults[cle]) await ops.contexte.request.patch(`${api()}/admin/settings`, { data: { changes: { [cle]: v.defaults[cle] }, reason: "Recette ADM-EML-3 : retour du paramètre à sa valeur par défaut", expectedVersion: v.version } });
      retablirEnBase([adresseSuper], "ADM-EML-3 rétablit l'adresse du super administrateur");
    }
  });
});
