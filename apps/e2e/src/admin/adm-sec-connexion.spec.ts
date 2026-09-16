/**
 * adm-sec-connexion.spec.ts — cahier 02-ADMIN, § 4.1 « Connexion en deux étapes » (ADM-SEC-1 à 6)
 * ===============================================================================================
 * Le chapitre passe en premier : tout le cahier suppose qu'une session admin s'ouvre correctement. Chaque fiche se
 * vérifie DEUX fois (§ 3.4) : à l'écran, et dans le journal d'audit relu par un super administrateur.
 *
 * Trois partis pris :
 *  - **un compte admin JETABLE** porte les fiches qui consomment ou immobilisent (SEC-2 enrôlement, SEC-4 codes de
 *    secours, SEC-5 blocage de quinze minutes) : un membre neuf, promu par `grant-admin.ts`, révoqué et effacé à la
 *    fin. Les sept comptes du jeu d'essai restent intacts pour les chapitres suivants ;
 *  - **les codes TOTP sont CALCULÉS** à partir du secret affiché (SEC-2) ou enrôlé par `seed-admins.ts` : c'est
 *    exactement ce que fait une application d'authentification ;
 *  - **les attentes longues s'emboîtent** : le blocage de SEC-5 dure quinze minutes, SEC-6 (délai de cinq minutes)
 *    se joue sur un autre compte pendant ce temps, puis la fin de SEC-5 vérifie la levée.
 */
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { test, expect, type Navigateur } from "../fixtures/yamba";
import { JeuEssai } from "../fixtures/jeu-essai";
import { COMPTES_ADMIN, MOT_DE_PASSE_SEED } from "../fixtures/comptes";
import { compteNeuf, type CompteNeuf } from "../fixtures/compte-neuf";
import { adresseDuBackOffice } from "../fixtures/adresses";
import { Inscription } from "../pages/inscription";
import { actionsDuJournal, lireLeJournal, maintenantMoinsUneSeconde } from "../pages/journal-admin";
import { totpCode, TOTP_STEP_SECONDS } from "../../../../packages/libs/totp/src";

type Page = Navigateur["page"];
const RACINE = join(__dirname, "../../../..");
const backOffice = () => adresseDuBackOffice();

/** Le script d'attribution des profils, tel que l'opérateur le lance (§ 2.5). Rend sa sortie. */
function grantAdmin(...args: string[]): string {
  return execFileSync("npx", ["tsx", "--env-file=.env", "packages/libs/prisma/scripts/grant-admin.ts", ...args], { cwd: RACINE, encoding: "utf-8", timeout: 120_000 });
}

/** Une lecture en base ou dans Redis, pour les « points de contrôle » du cahier. Rend la sortie JSON du script. */
function lireCote(script: string): unknown {
  const sortie = execFileSync("npx", ["tsx", "--env-file=.env", "-e", script], { cwd: RACINE, encoding: "utf-8", timeout: 120_000 });
  const ligne = sortie.trim().split("\n").filter((l) => l.startsWith("@@")).pop() ?? "@@null";
  return JSON.parse(ligne.slice(2));
}

/** Les secondes qui restent dans le pas TOTP courant. */
const resteDuPas = () => TOTP_STEP_SECONDS - (Math.floor(Date.now() / 1000) % TOTP_STEP_SECONDS);

/** Écran du mot de passe, rempli et envoyé. Rend la réponse de `POST /auth/admin/login`. */
async function premiereEtape(page: Page, email: string, motDePasse: string): Promise<{ status: number }> {
  await page.goto(`${backOffice()}/login`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Yamba · Back-office" })).toBeVisible({ timeout: 60_000 });
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(motDePasse);
  const reponse = page.waitForResponse((r) => r.url().includes("/auth/admin/login") && r.request().method() === "POST", { timeout: 30_000 });
  await page.getByRole("button", { name: "Continuer" }).click();
  return { status: (await reponse).status() };
}

/** Saisit un code (TOTP ou secours) à l'écran du code. Rend le statut et le code d'erreur servis. */
async function saisirLeCode(page: Page, code: string): Promise<{ status: number; code?: string }> {
  await page.getByPlaceholder("123 456 ou ABCDE-FGHIJ").fill(code);
  const reponse = page.waitForResponse((r) => r.url().includes("/auth/admin/totp/verify"), { timeout: 30_000 });
  await page.getByRole("button", { name: "Se connecter" }).click();
  const r = await reponse;
  const corps = (await r.json().catch(() => ({}))) as { details?: { code?: string } };
  return { status: r.status(), code: corps.details?.code };
}

/* État partagé par les fiches (le describe est en série). */
let neuf: CompteNeuf | null = null;
let idNeuf = "";
let secretNeuf = "";
let codesNeuf: string[] = [];
let debutDuBlocage = 0;

test.describe("ADM-SEC — connexion en deux étapes (cahier 02-ADMIN § 4.1)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(() => {
    new JeuEssai().rejouerAdmins();
  });

  test.afterAll(() => {
    /* Le compte jetable : profil retiré (efface aussi le secret 2FA), puis le compte lui-même. */
    if (!neuf) return;
    try {
      grantAdmin(neuf.email, "--revoke");
    } catch {
      /* déjà retiré */
    }
    lireCote(`import p from "./packages/libs/prisma"; (async () => { await p.user.deleteMany({ where: { emailNormalized: ${JSON.stringify(neuf.email.toLowerCase())} } }); console.log("@@true"); process.exit(0); })();`);
  });

  test("ADM-SEC-1 · première étape : email et mot de passe", async ({ navigateurVisiteur, navigateurAdmin, jeuEssai }) => {
    const debut = maintenantMoinsUneSeconde();
    const { page, contexte } = await navigateurVisiteur();
    /* 1-2. La racine du back-office renvoie à /login. */
    await page.goto(`${backOffice()}/`, { waitUntil: "domcontentloaded" });
    await expect(page, "redirection automatique vers /login").toHaveURL(/\/login$/, { timeout: 60_000 });
    /* 3. Titre et sous-titre. */
    await expect(page.getByRole("heading", { name: "Yamba · Back-office" })).toBeVisible();
    await expect(page.getByText("Accès réservé, double authentification obligatoire.", { exact: true })).toBeVisible();
    /* 4. Mot de passe FAUX : un message qui ne dit ni quoi, ni si le compte existe. */
    const mediateur = COMPTES_ADMIN.mediateur;
    expect((await premiereEtape(page, mediateur.email, "Faux-mot-de-passe-2026!")).status, "mot de passe faux : 401").toBe(401);
    await expect(page.getByText("Email ou mot de passe incorrect.", { exact: true })).toBeVisible();
    /* Et une adresse INEXISTANTE donne exactement le même message (aucune énumération de comptes). */
    expect((await premiereEtape(page, `inconnu-${Date.now()}@recette.yamba.dev`, "Faux-mot-de-passe-2026!")).status, "compte inexistant : 401").toBe(401);
    await expect(page.getByText("Email ou mot de passe incorrect.", { exact: true })).toBeVisible();
    /* 5. Le bon mot de passe : l'écran du code. */
    expect((await premiereEtape(page, mediateur.email, MOT_DE_PASSE_SEED)).status, "mot de passe juste : 200").toBe(200);
    await expect(page.getByText("Saisis le code de ton application d'authentification, ou un code de secours.", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
    /* Les cookies : admin_preauth (≈ 5 min), et PAS encore admin_access_token. */
    const cookies = await contexte.cookies();
    const preauth = cookies.find((c) => c.name === "admin_preauth");
    expect(preauth, "cookie admin_preauth posé").toBeTruthy();
    const duree = preauth!.expires - Date.now() / 1000;
    expect(duree, `admin_preauth vit ≈ 5 minutes (reste ${Math.round(duree)} s)`).toBeGreaterThan(240);
    expect(duree).toBeLessThanOrEqual(301);
    expect(preauth!.httpOnly, "admin_preauth est httpOnly").toBe(true);
    expect(cookies.some((c) => c.name === "admin_access_token"), "aucun admin_access_token à ce stade").toBe(false);
    /* Journal : RIEN pour le médiateur (la première étape ne journalise pas). */
    const sup = await navigateurAdmin("super");
    expect(await actionsDuJournal(sup.contexte.request, { from: debut, adminUserId: jeuEssai.admin("mediateur").id }), "aucune ligne de journal").toEqual([]);
  });

  test("ADM-SEC-2 · premier enrôlement avec le code QR", async ({ navigateurVisiteur, navigateurAdmin, mailpit }) => {
    test.setTimeout(8 * 60_000);
    /* Précondition : un compte admin NEUF (§ 2.5 — compte membre, puis grant-admin.ts). */
    neuf = compteNeuf("Oscar", "Enrolement");
    const membre = await navigateurVisiteur();
    await new Inscription(membre.page).creer(neuf, mailpit);
    const sortie = grantAdmin(neuf.email, "--role", "OPS");
    expect(sortie, "réponse du script (§ 2.5)").toContain(`Profils OPS posés sur ${neuf.email.toLowerCase()}`);
    idNeuf = String(lireCote(`import p from "./packages/libs/prisma"; (async () => { const u = await p.user.findFirst({ where: { emailNormalized: ${JSON.stringify(neuf.email.toLowerCase())} }, select: { id: true } }); console.log("@@" + JSON.stringify(u?.id)); process.exit(0); })();`));
    await mailpit.vider();

    const debut = maintenantMoinsUneSeconde();
    const { page } = await navigateurVisiteur();
    expect((await premiereEtape(page, neuf.email, neuf.motDePasse)).status).toBe(200);
    /* 2. PAS le champ du code : l'enrôlement. */
    await expect(page.getByText(/^Première connexion : scanne ce code avec ton application d'authentification/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Saisis le code de ton application d'authentification, ou un code de secours.")).toHaveCount(0);
    /* 3. Le QR (texte alternatif) et le secret en clair, en chasse fixe. */
    await expect(page.getByAltText("QR code TOTP")).toBeVisible({ timeout: 30_000 });
    const secret = page.locator("p.font-mono").filter({ hasText: /^[A-Z2-7]{16,}$/ }).first();
    await expect(secret, "le secret en clair, en base32").toBeVisible();
    secretNeuf = (await secret.innerText()).trim();
    expect(await secret.evaluate((n) => getComputedStyle(n).fontFamily), "police à chasse fixe").toMatch(/mono|courier|menlo|consolas/i);
    /* 4-5. Le code calculé (ce que ferait l'application), « Activer la 2FA ». */
    if (resteDuPas() < 4) await page.waitForTimeout((resteDuPas() + 1) * 1000);
    await page.getByPlaceholder("123 456").fill(totpCode(secretNeuf));
    await page.getByRole("button", { name: "Activer la 2FA" }).click();
    /* 6. Les codes de secours : huit, ABCDE-FGHIJ, deux colonnes, la mention. */
    await expect(page.getByText("2FA activée. Codes de secours, montrés une seule fois :", { exact: true })).toBeVisible({ timeout: 30_000 });
    const items = page.locator("ul li");
    await expect(items).toHaveCount(8);
    codesNeuf = (await items.allInnerTexts()).map((c) => c.trim());
    for (const c of codesNeuf) expect(c, "format ABCDE-FGHIJ").toMatch(/^[A-Z0-9]{5}-[A-Z0-9]{5}$/);
    const colonnes = new Set(await items.evaluateAll((lis) => lis.map((li) => Math.round(li.getBoundingClientRect().left))));
    expect(colonnes.size, "deux colonnes").toBe(2);
    await expect(page.getByText("Range-les hors de ce poste (gestionnaire de mots de passe). Chaque code ne sert qu'une fois.", { exact: true })).toBeVisible();
    /* 7. « J'ai enregistré mes codes » → /home. */
    await page.getByRole("button", { name: "J'ai enregistré mes codes" }).click();
    await expect(page, "arrivée sur /home").toHaveURL(/\/home/, { timeout: 60_000 });
    /* ✉ L'alerte de connexion : IP, appareil, date. */
    const alerte = await mailpit.attendreEmail({ pour: neuf.email, sujet: "Nouvelle connexion au back-office Yamba" });
    expect(alerte.texte, "l'alerte porte l'adresse IP").toMatch(/\b(\d{1,3}(\.\d{1,3}){3}|::1|[0-9a-f:]{3,})\b/i);
    expect(alerte.texte, "l'alerte porte l'appareil").toMatch(/Chrome|Windows|Mac|Linux|appareil/i);
    expect(alerte.texte, "l'alerte porte la date").toMatch(/20\d{2}|\d{1,2}\/\d{1,2}|\d{1,2} \w+/);
    /* En base : le secret est CHIFFRÉ, et n'apparaît dans aucune ligne de journal. */
    const enBase = lireCote(`import p from "./packages/libs/prisma"; (async () => { const u = await p.user.findUnique({ where: { id: ${JSON.stringify(idNeuf)} }, select: { totpSecretEncrypted: true } }); const a = await p.adminAction.findMany({ where: { adminUserId: ${JSON.stringify(idNeuf)} } }); console.log("@@" + JSON.stringify({ chiffre: u?.totpSecretEncrypted ?? null, journal: JSON.stringify(a) })); process.exit(0); })();`) as { chiffre: string | null; journal: string };
    expect(enBase.chiffre, "totpSecretEncrypted est posé").toBeTruthy();
    expect(enBase.chiffre, "et il n'est PAS le secret en clair").not.toContain(secretNeuf);
    expect(enBase.journal, "le secret n'apparaît dans aucune ligne AdminAction").not.toContain(secretNeuf);
    /* Journal : deux lignes, dans cet ordre. */
    const sup = await navigateurAdmin("super");
    const lignes = await lireLeJournal(sup.contexte.request, { from: debut, adminUserId: idNeuf });
    expect(lignes.map((l) => l.action), "ADMIN_TOTP_ENABLED puis ADMIN_LOGIN").toEqual(["ADMIN_TOTP_ENABLED", "ADMIN_LOGIN"]);
    expect(`${lignes[0].targetType} · ${lignes[0].targetId}`, "ADMIN_TOTP_ENABLED vise USER · <id>").toBe(`USER · ${idNeuf}`);
    test.info().annotations.push({ type: "constat", description: `cible de ADMIN_LOGIN : « ${lignes[1].targetType} · ${lignes[1].targetId ?? "—"} » (le cahier attend « USER · <id> »)` });
  });

  test("ADM-SEC-3 · connexion courante par code TOTP, et anti-rejeu", async ({ navigateurVisiteur, navigateurAdmin, jeuEssai }) => {
    test.setTimeout(4 * 60_000);
    const support = jeuEssai.admin("support");
    const { page } = await navigateurVisiteur();
    /* On part au DÉBUT d'un pas de 30 s : connexion, déconnexion et reprise tiennent dans le même pas. */
    await page.waitForTimeout((resteDuPas() + 1) * 1000);
    const debut = maintenantMoinsUneSeconde();
    expect((await premiereEtape(page, support.email, MOT_DE_PASSE_SEED)).status).toBe(200);
    const code = totpCode(support.secret);
    expect((await saisirLeCode(page, code)).status, "étape 2 : le code passe").toBe(200);
    await expect(page, "arrivée sur /home").toHaveURL(/\/home/, { timeout: 60_000 });
    /* 3. « Se déconnecter » dans la barre latérale. */
    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await expect(page, "retour à /login").toHaveURL(/\/login/, { timeout: 30_000 });
    /* 4. Le MÊME code, dans le même pas : refusé. */
    expect(resteDuPas(), "toujours dans le même pas de 30 s (sinon la fiche ne prouve rien)").toBeGreaterThan(2);
    expect((await premiereEtape(page, support.email, MOT_DE_PASSE_SEED)).status).toBe(200);
    const rejeu = await saisirLeCode(page, code);
    expect(rejeu.status, "le code déjà consommé est refusé").toBe(401);
    await expect(page.getByText("Code invalide.", { exact: true })).toBeVisible();
    const avantReprise = await actionsDuJournal((await navigateurAdmin("super")).contexte.request, { from: debut, adminUserId: support.id });
    /* Le code suivant : la connexion passe. */
    await page.waitForTimeout((resteDuPas() + 1) * 1000);
    expect((await saisirLeCode(page, totpCode(support.secret))).status, "le code du pas suivant passe").toBe(200);
    await expect(page).toHaveURL(/\/home/, { timeout: 60_000 });
    const sup = await navigateurAdmin("super");
    expect(avantReprise, "étapes 2 et 3 : ADMIN_LOGIN puis ADMIN_LOGOUT ; le refus n'écrit rien").toEqual(["ADMIN_LOGIN", "ADMIN_LOGOUT"]);
    expect(await actionsDuJournal(sup.contexte.request, { from: debut, adminUserId: support.id }), "puis ADMIN_LOGIN à la reprise").toEqual(["ADMIN_LOGIN", "ADMIN_LOGOUT", "ADMIN_LOGIN"]);
  });

  test("ADM-SEC-4 · connexion par code de secours", async ({ navigateurVisiteur, navigateurAdmin }) => {
    test.setTimeout(8 * 60_000);
    expect(neuf, "le compte jetable de SEC-2").toBeTruthy();
    const debut = maintenantMoinsUneSeconde();
    const { page } = await navigateurVisiteur();
    /* 1-3. Un code de secours au lieu du code à six chiffres. */
    expect((await premiereEtape(page, neuf!.email, neuf!.motDePasse)).status).toBe(200);
    const premier = codesNeuf[0];
    expect((await saisirLeCode(page, premier)).status, "le code de secours ouvre la session").toBe(200);
    await expect(page).toHaveURL(/\/home/, { timeout: 60_000 });
    /* 5 (au-dessus de deux codes restants) : aucun avertissement. */
    await expect(page.getByText(/Il te reste \d+ code/), "7 codes restants : aucun avertissement").toHaveCount(0);
    const sup = await navigateurAdmin("super");
    const lignes = await lireLeJournal(sup.contexte.request, { from: debut, adminUserId: idNeuf });
    expect(lignes.map((l) => l.action), "ADMIN_BACKUP_CODE_USED puis ADMIN_LOGIN").toEqual(["ADMIN_BACKUP_CODE_USED", "ADMIN_LOGIN"]);
    expect(`${lignes[0].targetType} · ${lignes[0].targetId}`).toBe(`USER · ${idNeuf}`);
    /* 4. Déconnexion, puis le MÊME code : refusé. */
    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
    expect((await premiereEtape(page, neuf!.email, neuf!.motDePasse)).status).toBe(200);
    expect((await saisirLeCode(page, premier)).status, "un code de secours ne sert qu'une fois").toBe(401);
    await expect(page.getByText("Code invalide.", { exact: true })).toBeVisible();
    /* 5 (deux codes ou moins) : on consomme jusqu'à n'en garder que deux, et l'avertissement paraît. */
    for (const c of codesNeuf.slice(1, 6)) {
      expect((await saisirLeCode(page, c)).status, `code de secours ${c}`).toBe(200);
      await expect(page).toHaveURL(/\/home/, { timeout: 60_000 });
      if (c !== codesNeuf[5]) {
        await page.getByRole("button", { name: "Se déconnecter" }).click();
        await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
        expect((await premiereEtape(page, neuf!.email, neuf!.motDePasse)).status).toBe(200);
      }
    }
    await expect(page.getByText(/Il te reste 2 code/), "deux codes restants : l'avertissement de la barre latérale").toBeVisible({ timeout: 30_000 });
    test.info().annotations.push({ type: "note", description: `avertissement : « ${await page.getByText(/Il te reste \d+ code/).first().innerText()} »` });
  });

  test("ADM-SEC-5 (1/2) · cinq échecs bloquent le compte, même avec le bon code", async ({ navigateurVisiteur, navigateurAdmin }) => {
    test.setTimeout(4 * 60_000);
    expect(neuf, "le compte jetable de SEC-2").toBeTruthy();
    /* SEC-4 vient de se connecter avec ce compte : sans marge, la fenêtre du journal ramassait sa dernière connexion
       (mesuré : ADMIN_BACKUP_CODE_USED + ADMIN_LOGIN). La borne est posée APRÈS deux secondes de silence. */
    await new Promise((r) => setTimeout(r, 2_000));
    const debut = new Date().toISOString();
    const { page } = await navigateurVisiteur();
    expect((await premiereEtape(page, neuf!.email, neuf!.motDePasse)).status).toBe(200);
    /* 2. Cinq codes faux. */
    for (const faux of ["000000", "111111", "222222", "333333", "444444"]) {
      const r = await saisirLeCode(page, faux);
      expect(r.status, `code faux ${faux} : refusé`).toBe(401);
      await expect(page.getByText("Code invalide.", { exact: true })).toBeVisible();
    }
    debutDuBlocage = Date.now();
    /* 3. Le VRAI code : refusé malgré tout, par le serveur (TOO_MANY_ATTEMPTS). */
    if (resteDuPas() < 4) await page.waitForTimeout((resteDuPas() + 1) * 1000);
    const vrai = await saisirLeCode(page, totpCode(secretNeuf));
    expect(vrai.status, "le vrai code est refusé pendant le blocage").toBe(401);
    expect(vrai.code, "le serveur dit pourquoi : TOO_MANY_ATTEMPTS").toBe("TOO_MANY_ATTEMPTS");
    const message = (await page.locator("p.bg-red-50").first().innerText()).trim();
    test.info().annotations.push({ type: "constat", description: `à l'écran, pendant le blocage, avec le BON code : « ${message} »` });
    expect(message, "l'écran dit le blocage (le cahier : le message du serveur, tel quel ou encapsulé) — pas « Code invalide. »").toBe(
      "Trop de tentatives : ce compte est bloqué pendant 15 minutes. Réessaie ensuite avec un nouveau code."
    );
    /* Point de contrôle : le compteur est PAR COMPTE — un autre navigateur est bloqué aussi. */
    const autre = await navigateurVisiteur();
    expect((await premiereEtape(autre.page, neuf!.email, neuf!.motDePasse)).status).toBe(200);
    expect((await saisirLeCode(autre.page, totpCode(secretNeuf))).code, "un autre navigateur est bloqué aussi (compteur par compte)").toBe("TOO_MANY_ATTEMPTS");
    /* Le compteur Redis : admin_totp_fail:<id>, TTL ≤ 15 minutes. */
    const ttl = Number(lireCote(`import r from "./packages/libs/redis"; (async () => { console.log("@@" + JSON.stringify(await r.ttl(${JSON.stringify(`admin_totp_fail:${idNeuf}`)}))); process.exit(0); })();`));
    expect(ttl, `TTL du compteur admin_totp_fail (${ttl} s)`).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(900);
    /* Journal : aucune ligne pour les tentatives refusées. */
    const sup = await navigateurAdmin("super");
    expect(await actionsDuJournal(sup.contexte.request, { from: debut, adminUserId: idNeuf }), "aucune ligne pour les refus").toEqual([]);
  });

  test("ADM-SEC-6 · le délai de pré-authentification (cinq minutes)", async ({ navigateurVisiteur, navigateurAdmin, jeuEssai }) => {
    test.setTimeout(9 * 60_000);
    const exploitation = jeuEssai.admin("exploitation");
    const debut = maintenantMoinsUneSeconde();
    const { page } = await navigateurVisiteur();
    expect((await premiereEtape(page, exploitation.email, MOT_DE_PASSE_SEED)).status).toBe(200);
    await expect(page.getByPlaceholder("123 456 ou ABCDE-FGHIJ")).toBeVisible();
    /* 2. Plus de cinq minutes sans rien saisir. */
    await page.waitForTimeout(5 * 60_000 + 15_000);
    /* 3. Un code valide. */
    if (resteDuPas() < 4) await page.waitForTimeout((resteDuPas() + 1) * 1000);
    const r = await saisirLeCode(page, totpCode(exploitation.secret));
    expect(r.status, "le serveur refuse (pré-authentification expirée)").toBe(401);
    await expect(page.getByText("Délai dépassé : recommence depuis le mot de passe.", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Mot de passe"), "retour au formulaire du mot de passe").toBeVisible();
    const sup = await navigateurAdmin("super");
    expect(await actionsDuJournal(sup.contexte.request, { from: debut, adminUserId: exploitation.id }), "aucune ligne").toEqual([]);
  });

  test("ADM-SEC-5 (2/2) · quinze minutes plus tard, le vrai code passe", async ({ navigateurVisiteur, navigateurAdmin }) => {
    test.setTimeout(20 * 60_000);
    expect(debutDuBlocage, "le blocage de SEC-5 (1/2)").toBeGreaterThan(0);
    const leve = debutDuBlocage + 15 * 60_000 + 20_000;
    if (Date.now() < leve) await new Promise((r) => setTimeout(r, leve - Date.now()));
    const debut = maintenantMoinsUneSeconde();
    const { page } = await navigateurVisiteur();
    expect((await premiereEtape(page, neuf!.email, neuf!.motDePasse)).status).toBe(200);
    if (resteDuPas() < 4) await page.waitForTimeout((resteDuPas() + 1) * 1000);
    expect((await saisirLeCode(page, totpCode(secretNeuf))).status, "le blocage est levé : le vrai code passe").toBe(200);
    await expect(page).toHaveURL(/\/home/, { timeout: 60_000 });
    const sup = await navigateurAdmin("super");
    expect(await actionsDuJournal(sup.contexte.request, { from: debut, adminUserId: idNeuf }), "la seule ligne : ADMIN_LOGIN").toEqual(["ADMIN_LOGIN"]);
  });
});
