/**
 * adm-cpt-comptes-admin.spec.ts — cahier 02-ADMIN, § 5.25 « Comptes admin » (ADM-CPT-1 à 5) + fiches ajoutées
 * ============================================================================================================
 * L'écran `/admins` est la porte du back-office : qui y entre, avec quels profils, et comment on en sort. Le chapitre
 * se juge à quatre promesses :
 *  - **une invitation ouvre UN accès, une fois** : le lien sert une seule fois, même cliqué trois fois au même instant,
 *    et un ancien lien ne revit jamais parce que le compte a été réinvité ;
 *  - **un compte qui n'a pas de mot de passe reçoit un lien pour en poser un**, jamais un « accès accordé » vers un
 *    écran de connexion où il ne peut rien saisir (compte réinvité après un retrait, compte créé par Google) ;
 *  - **il reste toujours un super administrateur en service** : deux super administrateurs qui se rétrogradent l'un
 *    l'autre au même instant ne ferment pas le back-office à clé ;
 *  - **l'écran parle français et ne propose pas l'impossible** : sa propre ligne n'offre ni cases ni « Retirer », un
 *    refus se lit en français.
 *
 * Comptes : le super administrateur du seed pilote l'écran. Les administrateurs « jetables » (enrôlés, dont on a besoin
 * d'une session) sont posés en base par une manœuvre consignée — la recette de l'enrôlement par l'écran est ADM-SEC-2.
 * Chaque fiche retire les accès qu'elle a ouverts : la liste et la tuile « Invitations admin en attente » restent justes.
 */
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { request as requeteApi, type APIRequestContext } from "@playwright/test";
import { test, expect, type NavigateurAdmin } from "../fixtures/yamba";
import { adresseDeLApiAdmin, adresseDuBackOffice } from "../fixtures/adresses";
import { COMPTES, MOT_DE_PASSE_SEED } from "../fixtures/comptes";
import { lireLeJournal, maintenantMoinsUneSeconde } from "../pages/journal-admin";
import { debutDuScenario, lireCoteServeur } from "../pages/ecran-admin";
import { auditChange } from "../../../admin-ui/src/lib/format";
import { totpCode, TOTP_STEP_SECONDS } from "../../../../packages/libs/totp/src";

const api = () => adresseDeLApiAdmin();
const bo = () => adresseDuBackOffice();
const RACINE = join(__dirname, "../../../..");
type Page = NavigateurAdmin["page"];
type Profil = "SUPER_ADMIN" | "MEDIATOR" | "SUPPORT" | "FINANCE" | "OPS" | "PRIVACY";

const MOT_DE_PASSE_INVITE = "Recette-Porte-2026!";
const adresseJetable = (fiche: string) => `cpt-${fiche.toLowerCase()}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@recette.yamba.dev`;

/* ══ Manœuvres base consignées ═══════════════════════════════════════════════════════════════ */

/** Un administrateur ENRÔLÉ posé en base (mot de passe du seed, secret TOTP connu). Rend son id, son email, son secret. */
function creerAdminEnrole(fiche: string, profils: Profil[]): { id: string; email: string; secret: string } {
  const email = adresseJetable(fiche);
  const r = lireCoteServeur<{ id: string; secret: string }>(`
    import prisma from "./packages/libs/prisma";
    import bcrypt from "bcryptjs";
    import { encryptTotpSecret, generateTotpSecret } from "./packages/libs/totp/src/index";
    (async () => {
      const secret = generateTotpSecret();
      const u = await prisma.user.create({ data: {
        firstName: "Recette", lastName: ${JSON.stringify(fiche)}, email: ${JSON.stringify(email)}, emailNormalized: ${JSON.stringify(email)},
        publicSlug: ${JSON.stringify(`recette-${email.split("@")[0]}`)}, passwordHash: await bcrypt.hash(${JSON.stringify(MOT_DE_PASSE_SEED)}, 10),
        roles: ["ADMIN"], adminRoles: ${JSON.stringify(profils)}, adminRole: ${JSON.stringify(profils[0])},
        totpSecretEncrypted: encryptTotpSecret(secret), totpEnabledAt: new Date(), totpLastUsedStep: null, totpBackupCodeHashes: [], carrierStatus: "NONE",
      } });
      console.log("@@" + JSON.stringify({ id: u.id, secret }));
      process.exit(0);
    })();`);
  process.stdout.write(`   ↳ manœuvre base : administrateur enrôlé ${email} (${profils.join(" + ")})\n`);
  return { id: r.id, email, secret: r.secret };
}

/** L'état « porte » d'un compte, lu en base. */
type EtatCompte = { id: string; roles: string[]; adminRoles: string[]; totp: boolean; codes: number; motDePasse: boolean; sessionsAdmin: number } | null;
function etatDuCompte(email: string): EtatCompte {
  return lireCoteServeur<EtatCompte>(`
    import prisma from "./packages/libs/prisma";
    import redis from "./packages/libs/redis";
    (async () => {
      const u = await prisma.user.findUnique({ where: { emailNormalized: ${JSON.stringify(email.toLowerCase())} } });
      if (!u) { console.log("@@null"); process.exit(0); }
      const cles = await redis.keys("admin_jti:" + u.id + ":*");
      console.log("@@" + JSON.stringify({ id: u.id, roles: u.roles, adminRoles: u.adminRoles ?? [], totp: !!u.totpEnabledAt || !!u.totpSecretEncrypted, codes: (u.totpBackupCodeHashes ?? []).length, motDePasse: !!u.passwordHash, sessionsAdmin: cles.length }));
      process.exit(0);
    })();`);
}

/** Remet le super administrateur du seed en SUPER_ADMIN seul (filet d'une fiche de course qui l'aurait rétrogradé). */
function restaurerLeSuperAdministrateur(): void {
  execFileSync("npx", ["tsx", "--env-file=.env", "-e", `import prisma from "./packages/libs/prisma"; (async () => { await prisma.user.update({ where: { emailNormalized: "super@recette.yamba.dev" }, data: { adminRoles: ["SUPER_ADMIN"], adminRole: "SUPER_ADMIN" } }); process.exit(0); })();`], { cwd: RACINE, encoding: "utf-8", timeout: 120_000 });
}

/* ══ Sessions par l'API (deux temps : mot de passe, puis code) ═══════════════════════════════ */

const resteDuPas = () => TOTP_STEP_SECONDS - (Math.floor(Date.now() / 1000) % TOTP_STEP_SECONDS);

async function connecterParApi(requete: APIRequestContext, email: string, secret: string): Promise<void> {
  const login = await requete.post(`${api()}/auth/admin/login`, { data: { email, password: MOT_DE_PASSE_SEED } });
  expect(login.status(), `POST /auth/admin/login de ${email}`).toBe(200);
  if (resteDuPas() < 3) await new Promise((r) => setTimeout(r, (resteDuPas() + 1) * 1000));
  const code = await requete.post(`${api()}/auth/admin/totp/verify`, { data: { code: totpCode(secret) } });
  expect(code.status(), `POST /auth/admin/totp/verify de ${email} → ${await code.text()}`).toBe(200);
}

/* ══ L'écran ═════════════════════════════════════════════════════════════════════════════════ */

const ligneDe = (page: Page, email: string) => page.locator("table tbody tr").filter({ hasText: email });
const formulaire = (page: Page) => page.locator("form").filter({ has: page.getByRole("heading", { name: "Inviter" }) });
const caseDuFormulaire = (page: Page, libelle: string) => formulaire(page).getByRole("checkbox", { name: new RegExp(`^${libelle}`) });
const messageDeLEcran = (page: Page) => page.getByTestId("admins-message");

async function ouvrirComptes(page: Page): Promise<void> {
  const r = page.waitForResponse((x) => x.url().includes("/api/admin/admins") && x.request().method() === "GET", { timeout: 60_000 });
  await page.goto(`${bo()}/admins`, { waitUntil: "domcontentloaded" });
  expect((await r).status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Comptes admin" })).toBeVisible();
}

async function inviterParLEcran(page: Page, champs: { email: string; prenom: string; nom: string; profils: string[] }): Promise<number> {
  await page.getByPlaceholder("email").fill(champs.email);
  await page.getByPlaceholder("Prénom").fill(champs.prenom);
  await page.getByPlaceholder("Nom", { exact: true }).fill(champs.nom);
  for (const libelle of ["Super administrateur", "Médiateur", "Support", "Finance", "Exploitation", "Données personnelles"]) {
    if (champs.profils.includes(libelle)) await caseDuFormulaire(page, libelle).check();
  }
  for (const libelle of ["Super administrateur", "Médiateur", "Support", "Finance", "Exploitation", "Données personnelles"]) {
    if (!champs.profils.includes(libelle)) await caseDuFormulaire(page, libelle).uncheck().catch(() => undefined);
  }
  const r = page.waitForResponse((x) => x.url().includes("/api/admin/admins/invite"), { timeout: 60_000 });
  await formulaire(page).getByRole("button", { name: "Envoyer l'invitation" }).click();
  return (await r).status();
}

/** L'URL d'invitation d'un email, ramenée sur l'adresse du back-office de la recette. */
const lienDInvitation = (texte: string): string => {
  const brut = texte.match(/https?:\/\/\S+\/invite\?token=[0-9a-f]+/)?.[0];
  expect(brut, "l'email porte un lien /invite?token=…").toBeTruthy();
  const u = new URL(brut!);
  return `${bo()}/invite${u.search}`;
};
const jetonDe = (lien: string) => new URL(lien).searchParams.get("token") ?? "";

async function retirerParApi(requete: APIRequestContext, id: string): Promise<number> {
  return (await requete.delete(`${api()}/admin/admins/${id}`)).status();
}

/* ══ Les fiches ══════════════════════════════════════════════════════════════════════════════ */

test.describe("ADM-CPT — comptes admin (cahier 02-ADMIN § 5.25)", () => {
  test("ADM-CPT-1 · la liste : colonnes, états, cases cumulables, tuile d'accueil — lire ne se journalise pas", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(4 * 60_000);
    const sup = await navigateurAdmin("super");
    const { page } = sup;
    // Un compte de chaque état : invitation en attente (par l'API), 2FA active (enrôlé), 2FA à activer (mot de passe, pas de 2FA).
    const enAttente = adresseJetable("CPT1-attente");
    expect((await sup.contexte.request.post(`${api()}/admin/admins/invite`, { data: { email: enAttente, firstName: "Iris", lastName: "Attente", adminRoles: ["SUPPORT"] } })).status()).toBe(201);
    const actif = creerAdminEnrole("CPT1-actif", ["MEDIATOR"]);
    const aActiver = creerAdminEnrole("CPT1-aactiver", ["FINANCE"]);
    lireCoteServeur(`import p from "./packages/libs/prisma"; (async () => { await p.user.update({ where: { id: ${JSON.stringify(aActiver.id)} }, data: { totpSecretEncrypted: null, totpEnabledAt: null } }); console.log("@@1"); process.exit(0); })();`);
    const debutLecture = maintenantMoinsUneSeconde();
    try {
      await ouvrirComptes(page);
      await expect(page.getByText("Super administrateur seulement. Un compte invité naît sans rôle client et définit son mot de passe par le lien reçu (48 h).")).toBeVisible();
      expect((await page.locator("table thead th").allInnerTexts()).map((t) => t.trim())).toEqual(["NOM", "EMAIL", "PROFILS (CUMULABLES)", "ÉTAT", ""]);
      await expect(ligneDe(page, enAttente).locator("td").nth(3)).toContainText(/^invitation en attente · \d/);
      await expect(ligneDe(page, actif.email).locator("td").nth(3)).toContainText(/^2FA active · \d/);
      await expect(ligneDe(page, aActiver.email).locator("td").nth(3)).toContainText(/^2FA à activer · \d/);
      // Cases cumulables, un indice par profil (attribut title).
      const cases = ligneDe(page, actif.email).locator("td").nth(2).locator("label");
      await expect(cases).toHaveCount(6);
      expect(await cases.evaluateAll((ls) => ls.every((l) => (l.getAttribute("title") ?? "").length > 5)), "un indice par profil").toBe(true);
      await expect(ligneDe(page, actif.email).getByRole("checkbox", { name: "Médiateur" })).toBeChecked();

      // La tuile d'accueil compte les comptes admin sans mot de passe — autant que de lignes « invitation en attente ».
      const attente = await page.locator("table tbody tr td:nth-child(4)").filter({ hasText: /^invitation en attente/ }).count();
      const kpis = (await (await sup.contexte.request.get(`${api()}/admin/kpis`)).json()) as { pendingAdminInvites: number };
      expect(kpis.pendingAdminInvites, "tuile « Invitations admin en attente » = lignes « invitation en attente »").toBe(attente);

      // Lire ne se journalise pas.
      const lignes = await lireLeJournal(sup.contexte.request, { from: debutLecture, adminUserId: jeuEssai.admin("super").id });
      expect(lignes.filter((l) => l.action !== "ADMIN_LOGIN").map((l) => l.action), "aucune ligne pour la lecture").toEqual([]);
    } finally {
      const ids = lireCoteServeur<string[]>(`import p from "./packages/libs/prisma"; (async () => { const u = await p.user.findMany({ where: { emailNormalized: { in: ${JSON.stringify([enAttente, actif.email, aActiver.email])} } }, select: { id: true } }); console.log("@@" + JSON.stringify(u.map((x) => x.id))); process.exit(0); })();`);
      for (const id of ids) await retirerParApi(sup.contexte.request, id);
    }
  });

  test("ADM-CPT-2 · inviter un nouvel admin : formulaire, email, mot de passe, lien à usage unique, aucun rôle client", async ({ navigateurAdmin, navigateurVisiteur, mailpit }) => {
    test.setTimeout(6 * 60_000);
    const sup = await navigateurAdmin("super");
    const { page } = sup;
    const email = adresseJetable("CPT2");
    await mailpit.vider();
    const debut = maintenantMoinsUneSeconde();
    let id: string | null = null;
    try {
      await ouvrirComptes(page);
      // 1. Champs requis, six cases et leurs indices, la note, « Support » coché par défaut.
      for (const ph of ["email", "Prénom", "Nom"]) await expect(formulaire(page).getByPlaceholder(ph, { exact: true })).toHaveAttribute("required", "");
      const indices: Record<string, string> = {
        "Super administrateur": "tout, comptes admin, remboursements manuels",
        Médiateur: "litiges, sanctions, masquage, versements",
        Support: "fiches, billets, propositions",
        Finance: "finances, exports, pilotage, journal",
        Exploitation: "paramètres d'exploitation",
        "Données personnelles": "demandes RGPD, effacement",
      };
      for (const [libelle, indice] of Object.entries(indices)) {
        await expect(formulaire(page).locator("label").filter({ hasText: new RegExp(`^${libelle}`) })).toContainText(indice);
      }
      await expect(formulaire(page)).toContainText("Les permissions se cumulent. Un compte créé ici n'a aucun rôle client (ni publier ni réserver).");
      await expect(caseDuFormulaire(page, "Support")).toBeChecked();
      // 2. Décocher le dernier profil : impossible.
      await caseDuFormulaire(page, "Support").click();
      await expect(caseDuFormulaire(page, "Support"), "au moins un profil reste coché").toBeChecked();

      // 3-4. Adresse inconnue, Support + Finance.
      expect(await inviterParLEcran(page, { email, prenom: "Inès", nom: "Invitée", profils: ["Support", "Finance"] })).toBe(201);
      await expect(messageDeLEcran(page)).toHaveText("Compte créé, invitation envoyée (48 h).");
      await expect(ligneDe(page, email).locator("td").nth(3)).toContainText("invitation en attente");
      id = etatDuCompte(email)!.id;

      // 5. L'email : sujet, lien /invite?token=…, 48 heures, les DEUX profils.
      const courriel = await mailpit.attendreEmail({ pour: email, sujet: "Ton accès au back-office Yamba" });
      expect(courriel.texte).toMatch(/48 h/);
      expect(courriel.texte).toContain("Support + Finance");
      const lien = lienDInvitation(courriel.texte);

      // 6. Deux mots de passe différents : refus à l'écran, aucun appel.
      const invite = await navigateurVisiteur();
      await invite.page.goto(lien, { waitUntil: "domcontentloaded" });
      await expect(invite.page.getByRole("heading", { name: "Définir mon mot de passe" })).toBeVisible({ timeout: 60_000 });
      await invite.page.waitForLoadState("networkidle").catch(() => undefined);
      await invite.page.getByPlaceholder("Mot de passe").fill(MOT_DE_PASSE_INVITE);
      await invite.page.getByPlaceholder("Confirmer").fill(`${MOT_DE_PASSE_INVITE}x`);
      await invite.page.getByRole("button", { name: "Enregistrer et me connecter" }).click();
      await expect(invite.page.getByText("Les deux mots de passe diffèrent.")).toBeVisible();

      // 7. Le même mot de passe deux fois : succès, /login, puis l'enrôlement 2FA.
      await invite.page.getByPlaceholder("Confirmer").fill(MOT_DE_PASSE_INVITE);
      const pose = invite.page.waitForResponse((x) => x.url().includes("/auth/admin/invite/accept"), { timeout: 60_000 });
      await invite.page.getByRole("button", { name: "Enregistrer et me connecter" }).click();
      expect((await pose).status()).toBe(200);
      await expect(invite.page).toHaveURL(/\/login/, { timeout: 60_000 });
      const login = await invite.contexte.request.post(`${api()}/auth/admin/login`, { data: { email, password: MOT_DE_PASSE_INVITE } });
      expect(login.status(), "le mot de passe posé ouvre la première étape").toBe(200);
      expect(await login.json(), "la suite est l'enrôlement (2FA pas encore activée)").toEqual({ next: "SETUP" });

      // 8. Aucun rôle client.
      expect(etatDuCompte(email)!.roles, "aucun rôle client : ADMIN seulement").toEqual(["ADMIN"]);

      // 9. Rejouer le lien : 400, jeton à usage unique ; l'écran le dit en français.
      const rejeu = await invite.contexte.request.post(`${api()}/auth/admin/invite/accept`, { data: { token: jetonDe(lien), password: MOT_DE_PASSE_INVITE } });
      expect(rejeu.status()).toBe(400);
      expect(((await rejeu.json()) as { message: string }).message).toBe("This invitation link is invalid or expired.");
      await invite.page.goto(lien, { waitUntil: "domcontentloaded" });
      await invite.page.waitForLoadState("networkidle").catch(() => undefined);
      await invite.page.getByPlaceholder("Mot de passe").fill(MOT_DE_PASSE_INVITE);
      await invite.page.getByPlaceholder("Confirmer").fill(MOT_DE_PASSE_INVITE);
      await invite.page.getByRole("button", { name: "Enregistrer et me connecter" }).click();
      await expect(invite.page.getByText("Ce lien d'invitation n'est plus valable. Demande une nouvelle invitation à un super administrateur.")).toBeVisible({ timeout: 30_000 });

      // 10. /invite sans jeton.
      await invite.page.goto(`${bo()}/invite`, { waitUntil: "domcontentloaded" });
      await expect(invite.page.getByText("Lien d'invitation incomplet.")).toBeVisible({ timeout: 60_000 });
      await expect(invite.page.getByRole("button", { name: "Enregistrer et me connecter" })).toHaveCount(0);

      // Journal : ADMIN_INVITED (par le super administrateur), ADMIN_INVITE_ACCEPTED (sous l'identité de l'invité).
      const lignes = (await lireLeJournal(sup.contexte.request, { from: debut, targetId: id })).filter((l) => l.action !== "ADMIN_LOGIN");
      expect(lignes.map((l) => l.action)).toEqual(["ADMIN_INVITED", "ADMIN_INVITE_ACCEPTED"]);
      expect(lignes[0].after).toEqual({ adminRoles: ["SUPPORT", "FINANCE"], existingAccount: false });
      expect(lignes[0].admin, "écrite par le super administrateur").toBe("Sacha S.");
      expect(lignes[1].admin, "écrite sous l'identité de l'invité").toBe("Inès I.");
    } finally {
      if (id) await retirerParApi(sup.contexte.request, id);
    }
  });

  test("ADM-CPT-3 · inviter une adresse déjà connue : profils posés, rôle client conservé, réinvitation refusée", async ({ navigateurAdmin, mailpit }) => {
    test.setTimeout(4 * 60_000);
    const sup = await navigateurAdmin("super");
    const { page } = sup;
    const email = COMPTES.aminata.email;
    const avant = etatDuCompte(email)!;
    if (avant.adminRoles.length) await retirerParApi(sup.contexte.request, avant.id); // reste d'une exécution interrompue
    await mailpit.vider();
    const debut = maintenantMoinsUneSeconde();
    try {
      await ouvrirComptes(page);
      expect(await inviterParLEcran(page, { email, prenom: "Aminata", nom: "Seed", profils: ["Support"] })).toBe(200);
      await expect(messageDeLEcran(page)).toHaveText("Profils posés sur un compte existant, email envoyé.");
      const courriel = await mailpit.attendreEmail({ pour: email, sujet: "Accès au back-office Yamba accordé" });
      expect(courriel.texte).toMatch(/\/login/);
      expect(courriel.texte).not.toMatch(/\/invite\?token=/);
      expect(etatDuCompte(email)!.roles, "le rôle client est conservé").toEqual(expect.arrayContaining(["SHIPPER", "ADMIN"]));

      // 5. Réinviter : 400 « already has an admin profile » ; l'écran le dit en français.
      const encore = await sup.contexte.request.post(`${api()}/admin/admins/invite`, { data: { email, firstName: "Aminata", lastName: "Seed", adminRoles: ["SUPPORT"] } });
      expect(encore.status()).toBe(400);
      expect(((await encore.json()) as { message: string }).message).toBe("This account already has an admin profile.");
      expect(await inviterParLEcran(page, { email, prenom: "Aminata", nom: "Seed", profils: ["Support"] })).toBe(400);
      await expect(messageDeLEcran(page)).toHaveText("Ce compte a déjà un profil admin.");

      const lignes = await lireLeJournal(sup.contexte.request, { from: debut, targetId: avant.id, action: "ADMIN_INVITED" });
      expect(lignes.map((l) => l.after)).toEqual([{ adminRoles: ["SUPPORT"], existingAccount: true }]);
    } finally {
      await retirerParApi(sup.contexte.request, avant.id);
      expect(etatDuCompte(email)!.roles, "après la fiche : le compte membre est intact").toEqual(expect.arrayContaining(["SHIPPER"]));
    }
  });

  test("ADM-CPT-4 · modifier les profils (remplacement), soi-même interdit, retirer : 2FA et sessions tombent", async ({ navigateurAdmin, navigateurVisiteur, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    const sup = await navigateurAdmin("super");
    const { page } = sup;
    const cible = creerAdminEnrole("CPT4", ["SUPPORT"]);
    const debut = maintenantMoinsUneSeconde();
    try {
      // La cible ouvre une session (navigateur séparé).
      const session = await navigateurVisiteur();
      await connecterParApi(session.contexte.request, cible.email, cible.secret);
      expect(etatDuCompte(cible.email)!.sessionsAdmin, "une session admin ouverte").toBeGreaterThan(0);

      await ouvrirComptes(page);
      // 1. Cocher un profil : la liste est REMPLACÉE par la sélection.
      const patch1 = page.waitForResponse((x) => x.url().includes(`/api/admin/admins/${cible.id}`) && x.request().method() === "PATCH");
      await ligneDe(page, cible.email).getByRole("checkbox", { name: "Finance" }).click();
      const r1 = await patch1;
      expect(r1.status()).toBe(200);
      expect(r1.request().postDataJSON()).toEqual({ adminRoles: ["SUPPORT", "FINANCE"] });
      await expect(ligneDe(page, cible.email).getByRole("checkbox", { name: "Finance" })).toBeChecked();
      const patch2 = page.waitForResponse((x) => x.url().includes(`/api/admin/admins/${cible.id}`) && x.request().method() === "PATCH");
      await ligneDe(page, cible.email).getByRole("checkbox", { name: "Support" }).click();
      expect((await patch2).request().postDataJSON(), "remplacement, pas union").toEqual({ adminRoles: ["FINANCE"] });
      expect(etatDuCompte(cible.email)!.adminRoles).toEqual(["FINANCE"]);
      // 2. Décocher le dernier : aucun appel, la case reste cochée.
      let appels = 0;
      const compter = (x: { url(): string; request(): { method(): string } }) => { if (x.url().includes(`/api/admin/admins/${cible.id}`) && x.request().method() === "PATCH") appels++; };
      page.on("response", compter);
      await ligneDe(page, cible.email).getByRole("checkbox", { name: "Finance" }).click();
      await page.waitForTimeout(1_000);
      page.off("response", compter);
      expect(appels, "au moins un profil : aucun PATCH").toBe(0);
      await expect(ligneDe(page, cible.email).getByRole("checkbox", { name: "Finance" })).toBeChecked();

      // 3. Sa propre ligne : rien à cocher, pas de « Retirer » ; le serveur refuse quand même (403).
      const moi = ligneDe(page, COMPTES_SUPER_EMAIL);
      await expect(moi.getByRole("checkbox").first()).toBeDisabled();
      await expect(moi.getByRole("button", { name: "Retirer" })).toHaveCount(0);
      await expect(moi).toContainText("toi");
      const idSuper = jeuEssai.admin("super").id;
      const soi1 = await sup.contexte.request.patch(`${api()}/admin/admins/${idSuper}`, { data: { adminRoles: ["SUPPORT"] } });
      const soi2 = await sup.contexte.request.delete(`${api()}/admin/admins/${idSuper}`);
      expect([soi1.status(), soi2.status()]).toEqual([403, 403]);
      expect(((await soi1.json()) as { details?: { code?: string } }).details?.code).toBe("ADMIN_IS_SELF");

      // 5-6. « Retirer » : la confirmation du navigateur, puis profils vidés, ADMIN retiré, TOTP et codes effacés, sessions tombées.
      let confirmation = "";
      page.once("dialog", (d) => { confirmation = d.message(); void d.accept(); });
      const del = page.waitForResponse((x) => x.url().includes(`/api/admin/admins/${cible.id}`) && x.request().method() === "DELETE");
      await ligneDe(page, cible.email).getByRole("button", { name: "Retirer" }).click();
      expect((await del).status()).toBe(200);
      expect(confirmation).toBe(`Retirer l'accès admin de Recette CPT4 ? Sa 2FA et ses sessions admin sont supprimées.`);
      await expect(ligneDe(page, cible.email)).toHaveCount(0);
      const apres = etatDuCompte(cible.email)!;
      expect(apres, "le compte subsiste, sans rien d'admin").toMatchObject({ adminRoles: [], totp: false, codes: 0, sessionsAdmin: 0 });
      expect(apres.roles).not.toContain("ADMIN");

      // 7. La session de l'admin retiré : renvoyée à /login.
      expect((await session.contexte.request.get(`${api()}/admin/me`)).status()).toBe(401);
      await session.page.goto(`${bo()}/home`, { waitUntil: "domcontentloaded" });
      await expect(session.page).toHaveURL(/\/login/, { timeout: 60_000 });

      const lignes = (await lireLeJournal(sup.contexte.request, { from: debut, targetId: cible.id })).filter((l) => l.action !== "ADMIN_LOGIN");
      expect(lignes.map((l) => [l.action, l.before, l.after])).toEqual([
        ["ADMIN_ROLE_CHANGED", { adminRoles: ["SUPPORT"] }, { adminRoles: ["SUPPORT", "FINANCE"] }],
        ["ADMIN_ROLE_CHANGED", { adminRoles: ["SUPPORT", "FINANCE"] }, { adminRoles: ["FINANCE"] }],
        ["ADMIN_REVOKED", { adminRoles: ["FINANCE"] }, null],
      ]);
    } finally {
      await retirerParApi(sup.contexte.request, cible.id);
    }
  });

  test("ADM-CPT-5 · l'admin qui a perdu son application : retirer puis réinviter → nouvel enrôlement ; variante par script", async ({ navigateurAdmin, mailpit }) => {
    test.setTimeout(5 * 60_000);
    const sup = await navigateurAdmin("super");
    const { page } = sup;
    const perdu = creerAdminEnrole("CPT5", ["MEDIATOR"]);
    await mailpit.vider();
    const debut = maintenantMoinsUneSeconde();
    try {
      // Par l'écran : retirer, réinviter avec ses profils.
      await ouvrirComptes(page);
      page.once("dialog", (d) => void d.accept());
      await ligneDe(page, perdu.email).getByRole("button", { name: "Retirer" }).click();
      await expect(ligneDe(page, perdu.email)).toHaveCount(0);
      expect(await inviterParLEcran(page, { email: perdu.email, prenom: "Recette", nom: "CPT5", profils: ["Médiateur"] })).toBe(200);
      await mailpit.attendreEmail({ pour: perdu.email, sujet: "Accès au back-office Yamba accordé" });
      // La reconnexion propose l'enrôlement : le secret a été effacé.
      const ctx = await requeteApi.newContext();
      const login = await ctx.post(`${api()}/auth/admin/login`, { data: { email: perdu.email, password: MOT_DE_PASSE_SEED } });
      expect(login.status()).toBe(200);
      const setup = await ctx.post(`${api()}/auth/admin/totp/setup`);
      expect(setup.status(), "l'écran d'enrôlement (QR) est proposé").toBe(200);
      await ctx.dispose();
      const lignes = (await lireLeJournal(sup.contexte.request, { from: debut, targetId: perdu.id })).map((l) => l.action).filter((a) => a !== "ADMIN_LOGIN");
      expect(lignes).toEqual(["ADMIN_REVOKED", "ADMIN_INVITED"]);

      // Variante par script : aucune ligne de journal, les profils sont à repréciser.
      // Deux secondes de silence d'abord : la réinvitation, la connexion et la lecture tiennent parfois dans la même seconde.
      const debutScript = await debutDuScenario();
      const script = (...a: string[]) => execFileSync("npx", ["tsx", "--env-file=.env", "packages/libs/prisma/scripts/grant-admin.ts", perdu.email, ...a], { cwd: RACINE, encoding: "utf-8", timeout: 120_000 });
      script("--revoke");
      expect(etatDuCompte(perdu.email)!.adminRoles, "entre les deux commandes, plus aucun profil").toEqual([]);
      script("--role", "MEDIATOR");
      expect(etatDuCompte(perdu.email)).toMatchObject({ adminRoles: ["MEDIATOR"], totp: false });
      const horsApplication = await lireLeJournal(sup.contexte.request, { from: debutScript, targetId: perdu.id });
      expect(horsApplication.map((l) => `${l.at} ${l.admin} ${l.action}`), "geste hors application : aucune ligne").toEqual([]);
    } finally {
      await retirerParApi(sup.contexte.request, perdu.id);
    }
  });

  /* ══ Fiches ajoutées ═══════════════════════════════════════════════════════════════════════ */

  test("ADM-CPT-6 · un compte SANS mot de passe réinvité reçoit un lien pour en poser un ; l'ancien lien ne revit jamais (ANO-ADM-75, 76)", async ({ navigateurAdmin, mailpit }) => {
    test.setTimeout(4 * 60_000);
    const sup = await navigateurAdmin("super");
    const req = sup.contexte.request;
    const email = adresseJetable("CPT6");
    await mailpit.vider();
    let id: string | null = null;
    try {
      expect((await req.post(`${api()}/admin/admins/invite`, { data: { email, firstName: "Oda", lastName: "Oubli", adminRoles: ["SUPPORT"] } })).status()).toBe(201);
      const ancien = jetonDe(lienDInvitation((await mailpit.attendreEmail({ pour: email, sujet: "Ton accès au back-office Yamba" })).texte));
      id = etatDuCompte(email)!.id;
      // Retrait avant acceptation, puis réinvitation : le compte existe mais n'a pas de mot de passe.
      expect(await retirerParApi(req, id)).toBe(200);
      await mailpit.vider();
      const re = await req.post(`${api()}/admin/admins/invite`, { data: { email, firstName: "Oda", lastName: "Oubli", adminRoles: ["OPS"] } });
      expect(re.status()).toBe(200);
      expect(await re.json()).toMatchObject({ existingAccount: true, passwordRequired: true });
      const courriel = await mailpit.attendreEmail({ pour: email, sujet: "Ton accès au back-office Yamba" });
      const nouveau = jetonDe(lienDInvitation(courriel.texte));
      expect(nouveau).not.toBe(ancien);
      expect((await mailpit.emailsPour(email)).map((e) => e.sujet), "jamais « accès accordé » vers un login impossible").not.toContain("Accès au back-office Yamba accordé");

      const ctx = await requeteApi.newContext();
      const parAncien = await ctx.post(`${api()}/auth/admin/invite/accept`, { data: { token: ancien, password: MOT_DE_PASSE_INVITE } });
      expect(parAncien.status(), "ANO-ADM-76 : le lien de la première invitation est mort").toBe(400);
      const parNouveau = await ctx.post(`${api()}/auth/admin/invite/accept`, { data: { token: nouveau, password: MOT_DE_PASSE_INVITE } });
      expect(parNouveau.status()).toBe(200);
      await ctx.dispose();
      expect(etatDuCompte(email)).toMatchObject({ motDePasse: true, adminRoles: ["OPS"] });

      // Un lien envoyé puis retiré : mort aussi.
      const email2 = adresseJetable("CPT6b");
      expect((await req.post(`${api()}/admin/admins/invite`, { data: { email: email2, firstName: "Ugo", lastName: "Retire", adminRoles: ["SUPPORT"] } })).status()).toBe(201);
      const jeton2 = jetonDe(lienDInvitation((await mailpit.attendreEmail({ pour: email2, sujet: "Ton accès au back-office Yamba" })).texte));
      const id2 = etatDuCompte(email2)!.id;
      expect(await retirerParApi(req, id2)).toBe(200);
      const cle = lireCoteServeur<number>(`import r from "./packages/libs/redis"; (async () => { console.log("@@" + (await r.exists("admin_invite:${jeton2}"))); process.exit(0); })();`);
      expect(cle, "le retrait efface le jeton en attente").toBe(0);
    } finally {
      if (id) await retirerParApi(req, id);
    }
  });

  test("ADM-CPT-7 · trois clics au même instant : un seul mot de passe posé, une seule invitation, jamais 500 (ANO-ADM-77, 79)", async ({ navigateurAdmin, mailpit }) => {
    test.setTimeout(4 * 60_000);
    const sup = await navigateurAdmin("super");
    const req = sup.contexte.request;
    const email = adresseJetable("CPT7");
    await mailpit.vider();
    const debut = maintenantMoinsUneSeconde();
    const ids: string[] = [];
    try {
      // Trois invitations simultanées d'une adresse inconnue.
      const corps = { email, firstName: "Tao", lastName: "Triple", adminRoles: ["SUPPORT"] };
      const statuts = (await Promise.all([0, 1, 2].map(() => req.post(`${api()}/admin/admins/invite`, { data: corps })))).map((r) => r.status()).sort();
      expect(statuts, "une création, deux refus compréhensibles").toEqual([201, 400, 400]);
      const nb = lireCoteServeur<number>(`import p from "./packages/libs/prisma"; (async () => { console.log("@@" + (await p.user.count({ where: { emailNormalized: ${JSON.stringify(email)} } }))); process.exit(0); })();`);
      expect(nb, "un seul compte").toBe(1);
      ids.push(etatDuCompte(email)!.id);
      const jeton = jetonDe(lienDInvitation((await mailpit.attendreEmail({ pour: email, sujet: "Ton accès au back-office Yamba" })).texte));

      // Trois acceptations simultanées du même lien.
      const ctx = await requeteApi.newContext();
      const acc = (await Promise.all([0, 1, 2].map(() => ctx.post(`${api()}/auth/admin/invite/accept`, { data: { token: jeton, password: MOT_DE_PASSE_INVITE } })))).map((r) => r.status()).sort();
      await ctx.dispose();
      expect(acc, "le lien sert une fois").toEqual([200, 400, 400]);
      const lignes = await lireLeJournal(req, { from: debut, targetId: ids[0] });
      expect(lignes.map((l) => l.action).sort()).toEqual(["ADMIN_INVITED", "ADMIN_INVITE_ACCEPTED"]);
    } finally {
      for (const id of ids) await retirerParApi(req, id);
    }
  });

  test("ADM-CPT-8 · deux super administrateurs se rétrogradent au même instant : il en reste un (ANO-ADM-78)", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(5 * 60_000);
    const sup = await navigateurAdmin("super");
    const idSuper = jeuEssai.admin("super").id;
    const second = creerAdminEnrole("CPT8", ["SUPER_ADMIN"]);
    const ctx2 = await requeteApi.newContext();
    try {
      await connecterParApi(ctx2, second.email, second.secret);
      // Les AUTRES super administrateurs en service sur ce poste (hors les deux acteurs) : s'il en existe, la course ne peut pas
      // fermer le back-office et les deux rétrogradations passent légitimement ; sinon, l'une des deux est refusée.
      const autres = lireCoteServeur<number>(`import p from "./packages/libs/prisma"; (async () => { console.log("@@" + (await p.user.count({ where: { id: { notIn: ${JSON.stringify([idSuper, second.id])} }, isDeleted: false, passwordHash: { not: null }, totpEnabledAt: { not: null }, OR: [{ adminRole: "SUPER_ADMIN" }, { adminRoles: { has: "SUPER_ADMIN" } }] } }))); process.exit(0); })();`);
      const versionAvant = lireCoteServeur<number>(`import p from "./packages/libs/prisma"; (async () => { const d = await p.platformSettings.findUnique({ where: { key: "admin-accounts" } }); console.log("@@" + (d?.version ?? 0)); process.exit(0); })();`);
      const [a, b] = await Promise.all([
        sup.contexte.request.patch(`${api()}/admin/admins/${second.id}`, { data: { adminRoles: ["SUPPORT"] } }),
        ctx2.patch(`${api()}/admin/admins/${idSuper}`, { data: { adminRoles: ["SUPPORT"] } }),
      ]);
      const statuts = [a.status(), b.status()].sort();
      const enService = lireCoteServeur<number>(`import p from "./packages/libs/prisma"; (async () => { console.log("@@" + (await p.user.count({ where: { isDeleted: false, passwordHash: { not: null }, totpEnabledAt: { not: null }, OR: [{ adminRole: "SUPER_ADMIN" }, { adminRoles: { has: "SUPER_ADMIN" } }] } }))); process.exit(0); })();`);
      expect(enService, "il reste au moins un super administrateur en service").toBeGreaterThanOrEqual(1);
      expect(statuts.every((x) => x !== 500), "jamais 500").toBe(true);
      process.stdout.write(`   ↳ super administrateurs en service hors les deux acteurs : ${autres} ; statuts ${statuts.join(", ")}\n`);
      if (autres === 0) {
        expect(statuts, "une rétrogradation, un refus 403").toEqual([200, 403]);
        const perdant = a.status() === 403 ? a : b;
        expect(((await perdant.json()) as { details?: { code?: string } }).details?.code).toBe("LAST_SUPER_ADMIN");
      } else {
        expect(statuts, "un autre super administrateur en service : les deux passent").toEqual([200, 200]);
      }
      // Les deux gestes ont écrit la garde commune (A186 b) : c'est elle qui sérialise la course quand elle compte.
      const versionApres = lireCoteServeur<number>(`import p from "./packages/libs/prisma"; (async () => { const d = await p.platformSettings.findUnique({ where: { key: "admin-accounts" } }); console.log("@@" + (d?.version ?? 0)); process.exit(0); })();`);
      expect(versionApres - versionAvant, "la garde est écrite par chaque retrait qui passe").toBe(statuts.filter((x) => x === 200).length);
    } finally {
      await ctx2.dispose();
      restaurerLeSuperAdministrateur();
      const req = (await requeteApi.newContext({ storageState: await sup.contexte.storageState() }));
      await retirerParApi(req, second.id);
      await req.dispose();
    }
  });

  test("ADM-CPT-9 · les refus se lisent en français ; un profil sans « admins.manage » lit un seul refus", async ({ navigateurAdmin }) => {
    test.setTimeout(4 * 60_000);
    const sup = await navigateurAdmin("super");
    const { page } = sup;
    const cible = creerAdminEnrole("CPT9", ["SUPPORT"]);
    try {
      await ouvrirComptes(page);
      await expect(ligneDe(page, cible.email)).toBeVisible();
      // Un autre administrateur retire l'accès pendant que l'écran est ouvert : le clic suivant lit un refus français et la liste se recharge.
      lireCoteServeur(`import p from "./packages/libs/prisma"; (async () => { await p.user.update({ where: { id: ${JSON.stringify(cible.id)} }, data: { adminRoles: [], adminRole: null } }); console.log("@@1"); process.exit(0); })();`);
      const r = page.waitForResponse((x) => x.url().includes(`/api/admin/admins/${cible.id}`) && x.request().method() === "PATCH");
      await ligneDe(page, cible.email).getByRole("checkbox", { name: "Finance" }).click();
      expect((await r).status()).toBe(404);
      await expect(messageDeLEcran(page)).toHaveText("Ce compte n'a plus d'accès admin. La liste est rechargée.");
      await expect(ligneDe(page, cible.email)).toHaveCount(0, { timeout: 30_000 });
      await expect(messageDeLEcran(page)).not.toContainText(/\d{3} :/);

      // Finance : pas de permission → un seul refus, rien d'autre.
      const fin = await navigateurAdmin("finance");
      const refus = fin.page.waitForResponse((x) => x.url().includes("/api/admin/admins"), { timeout: 60_000 });
      await fin.page.goto(`${bo()}/admins`, { waitUntil: "domcontentloaded" });
      expect((await refus).status()).toBe(403);
      await expect(fin.page.getByText("Ton profil ne gère pas les comptes admin (super administrateur seulement).")).toBeVisible({ timeout: 30_000 });
      await expect(fin.page.getByRole("heading", { name: "Inviter" })).toHaveCount(0);
      await expect(fin.page.locator("table")).toHaveCount(0);
    } finally {
      await retirerParApi(sup.contexte.request, cible.id);
    }
  });

  /* ══ Lots décidés au § 5.24 (A187) ═════════════════════════════════════════════════════════ */

  test("ADM-CPT-10 · journal : l'auteur se choisit dans une liste (admin retiré compris) ; « avant → après » en français", async ({ navigateurAdmin }) => {
    test.setTimeout(4 * 60_000);
    // La règle pure, sur les formes réellement écrites par les services.
    expect(auditChange({ adminRoles: ["SUPPORT"] }, { adminRoles: ["SUPPORT", "FINANCE"] })).toBe("Profils : Support → Support + Finance");
    expect(auditChange({ adminRoles: ["FINANCE"] }, null)).toBe("Profils : Finance → retiré");
    expect(auditChange({ accountStatus: "ACTIVE" }, { accountStatus: "SUSPENDED", reason: "x" })).toBe("Statut du compte : Actif → Suspendu");
    expect(auditChange({ key: "dispute.responseDelayHours", value: 72, version: 3 }, { key: "dispute.responseDelayHours", value: 48, reason: "x", version: 4 })).toBe("dispute.responseDelayHours : 72 → 48");
    expect(auditChange({ totpSecretEncrypted: "abc" }, { totpSecretEncrypted: null }), "une clé sensible n'est jamais lue").toBeNull();
    expect(auditChange(null, { adminRoles: ["SUPPORT"] })).toBeNull();

    const sup = await navigateurAdmin("super");
    const { page } = sup;
    const retire = creerAdminEnrole("CPT10", ["SUPPORT"]);
    // L'admin « jetable » écrit une ligne sous son nom (ouverture de session), puis perd son accès.
    const ctx = await requeteApi.newContext();
    await connecterParApi(ctx, retire.email, retire.secret);
    await ctx.dispose();
    expect((await sup.contexte.request.patch(`${api()}/admin/admins/${retire.id}`, { data: { adminRoles: ["SUPPORT", "FINANCE"] } })).status()).toBe(200);
    expect(await retirerParApi(sup.contexte.request, retire.id)).toBe(200);

    const authors = (await (await sup.contexte.request.get(`${api()}/admin/audit/authors`)).json()) as { items: Array<{ id: string; name: string; active: boolean }> };
    expect(authors.items.find((x) => x.id === retire.id), "l'admin retiré reste un auteur").toEqual({ id: retire.id, name: "Recette CPT10", active: false });
    const noms = authors.items.map((x) => x.name);
    expect(noms, "trié par nom").toEqual([...noms].sort((a, b) => a.localeCompare(b, "fr")));
    const fin = await navigateurAdmin("finance");
    expect((await fin.contexte.request.get(`${api()}/admin/audit/authors`)).status(), "Finance lit le journal, donc ses auteurs").toBe(200);

    const r = page.waitForResponse((x) => x.url().includes("/api/admin/audit/authors"), { timeout: 60_000 });
    await page.goto(`${bo()}/audit`, { waitUntil: "domcontentloaded" });
    await r;
    const auteur = page.locator("label").filter({ hasText: /^Auteur/ }).locator("select");
    await expect(auteur.locator(`option[value="${retire.id}"]`)).toHaveText("Recette CPT10 (accès retiré)");
    const lecture = page.waitForResponse((x) => x.url().includes("/api/admin/audit?") && x.url().includes(`adminUserId=${retire.id}`), { timeout: 60_000 });
    await auteur.selectOption(retire.id);
    const corps = (await (await lecture).json()) as { items: Array<{ adminUserId: string }>; appliedFilters: string[] };
    expect(corps.appliedFilters, "filtre serveur").toContain("adminUserId");
    expect(corps.items.length).toBeGreaterThan(0);
    expect(corps.items.every((i) => i.adminUserId === retire.id)).toBe(true);
    await expect(page.getByRole("button", { name: "Auteur : Recette CPT10 ✕" })).toBeVisible();

    // « avant → après » sur les lignes de la cible.
    await page.getByRole("button", { name: "Auteur : Recette CPT10 ✕" }).click();
    const cible = page.locator("label").filter({ hasText: /^Identifiant de cible/ }).locator("input");
    const lue = page.waitForResponse((x) => x.url().includes(`targetId=${retire.id}`), { timeout: 60_000 });
    await cible.fill(retire.id);
    await lue;
    await expect(page.getByTestId("audit-change").filter({ hasText: "Profils : Support → Support + Finance" })).toHaveCount(1);
    await expect(page.getByTestId("audit-change").filter({ hasText: "Profils : Support + Finance → retiré" })).toHaveCount(1);
    await expect(page.locator("table tbody")).not.toContainText("adminRoles :");
  });

  test("ADM-CPT-11 · export du journal filtré : super administrateur seul, motif, cellules neutralisées, journalisé", async ({ navigateurAdmin }) => {
    test.setTimeout(4 * 60_000);
    const sup = await navigateurAdmin("super");
    const req = sup.contexte.request;
    const cible = creerAdminEnrole("CPT11", ["SUPPORT"]);
    const motif = "Recette ADM-CPT-11 : contrôle de l'export du journal filtré.";
    try {
      // Une ligne dont le navigateur est piégé (formule tableur).
      expect((await req.patch(`${api()}/admin/admins/${cible.id}`, { data: { adminRoles: ["OPS"] }, headers: { "user-agent": "=HYPERLINK(\"http://x\",\"clic\")" } })).status()).toBe(200);
      const debut = maintenantMoinsUneSeconde();

      // Motif trop court : 400 REASON_TOO_SHORT, rien au journal.
      const court = await req.get(`${api()}/admin/audit/export?targetId=${cible.id}&reason=trop%20court`);
      expect(court.status()).toBe(400);
      expect(((await court.json()) as { details: { code: string } }).details.code).toBe("REASON_TOO_SHORT");

      // Finance lit le journal mais n'exporte pas de données personnelles ; Données personnelles ne lit pas le journal.
      const fin = await navigateurAdmin("finance");
      const priv = await navigateurAdmin("privacy");
      expect((await fin.contexte.request.get(`${api()}/admin/audit/export?reason=${encodeURIComponent(motif)}`)).status()).toBe(403);
      expect((await priv.contexte.request.get(`${api()}/admin/audit/export?reason=${encodeURIComponent(motif)}`)).status()).toBe(403);
      const rf = fin.page.waitForResponse((x) => x.url().includes("/api/admin/audit?") || x.url().endsWith("/api/admin/audit"), { timeout: 60_000 });
      await fin.page.goto(`${bo()}/audit`, { waitUntil: "domcontentloaded" });
      await rf;
      await expect(fin.page.getByRole("heading", { name: "Journal des actions admin" })).toBeVisible();
      await expect(fin.page.getByRole("button", { name: /Exporter le journal filtré/ }), "le bouton n'est pas proposé à Finance").toHaveCount(0);

      // Le super administrateur : le fichier.
      const r = await req.get(`${api()}/admin/audit/export?targetId=${cible.id}&reason=${encodeURIComponent(motif)}`);
      expect(r.status()).toBe(200);
      expect(r.headers()["content-type"]).toContain("text/csv");
      const texte = await r.text();
      const lignes = texte.replace(/^\uFEFF/, "").trim().split("\r\n");
      expect(lignes[0]).toBe("at,adminUserId,admin,action,targetType,targetId,before,after,ip,userAgent");
      expect(lignes.length - 1, "les lignes de la cible seulement").toBe(Number(r.headers()["x-row-count"] ?? lignes.length - 1));
      expect(lignes.slice(1).every((l) => l.includes(cible.id))).toBe(true);
      expect(texte, "la formule est neutralisée").toContain("'=HYPERLINK");
      expect(texte).not.toMatch(/(^|,)"?=HYPERLINK/m);
      expect(texte, "aucun secret dans le journal exporté").not.toMatch(/totpSecret|passwordHash/);

      // Par l'écran : motif, téléchargement annoncé.
      const { page } = sup;
      const rs = page.waitForResponse((x) => x.url().includes("/api/admin/audit"), { timeout: 60_000 });
      await page.goto(`${bo()}/audit`, { waitUntil: "domcontentloaded" });
      await rs;
      const lue = page.waitForResponse((x) => x.url().includes(`targetId=${cible.id}`), { timeout: 60_000 });
      await page.locator("label").filter({ hasText: /^Identifiant de cible/ }).locator("input").fill(cible.id);
      await lue;
      await page.getByRole("button", { name: /Exporter le journal filtré/ }).click();
      await page.getByLabel("Motif de l'export").fill(motif);
      const dl = page.waitForResponse((x) => x.url().includes("/api/admin/audit/export"), { timeout: 60_000 });
      await page.getByRole("button", { name: "Télécharger" }).click();
      expect((await dl).status()).toBe(200);
      await expect(page.getByRole("status").filter({ hasText: /exportée?s?.*journalisé/ })).toBeVisible({ timeout: 30_000 });

      const journal = (await lireLeJournal(req, { from: debut, action: "EXPORTED" })).filter((l) => (l.after as { domain?: string }).domain === "audit");
      expect(journal.length, "deux exports réussis, deux lignes ; le refus n'en écrit pas").toBe(2);
      expect(journal[0].after).toMatchObject({ domain: "audit", personal: true, reason: motif, filters: { targetId: cible.id }, truncated: false });
    } finally {
      await retirerParApi(req, cible.id);
    }
  });
});

const COMPTES_SUPER_EMAIL = "super@recette.yamba.dev";
