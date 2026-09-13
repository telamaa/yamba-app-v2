/**
 * adm-sec-sessions.spec.ts — cahier 02-ADMIN, § 4.2 « Séparation des sessions et durée de vie » (ADM-SEC-7 à 10)
 * =============================================================================================================
 * Une session admin est un objet à part : cookies `admin_*`, préfixe Redis `admin_jti:`, inactivité de 45 minutes,
 * vie absolue de 12 heures, révocable depuis « Mes sessions ».
 *
 * Partis pris :
 *  - **SEC-8 se joue en vrai** : 46 minutes d'inactivité réelle (le cahier le demande « en fond de recette ») — la fiche
 *    commence par lire le TTL Redis de la session, puis attend ;
 *  - **SEC-9 (12 heures) n'est pas jouable dans une journée** : ses deux substituts, que le cahier accepte, sont
 *    PROUVÉS au lieu d'être « demandés au développement » — le TTL est le minimum des deux bornes, et le
 *    renouvellement fait tourner le `jti` en conservant `createdAt` ; une manœuvre consignée vieillit une session
 *    jetable à 11 h 59 pour voir la vie absolue la couper ;
 *  - **SEC-10 ouvre deux VRAIES sessions** du même compte, dans deux navigateurs, et lit leur `jti` dans leurs propres
 *    jetons : l'écran ne montre ni appareil ni IP, on ne révoque pas « la ligne du dessous » à l'aveugle.
 */
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { test, expect, connexion, connexionAdmin, type Navigateur } from "../fixtures/yamba";
import { COMPTES_ADMIN, MOT_DE_PASSE_SEED, type Compte } from "../fixtures/comptes";
import { adresseDuBackOffice, adresseDeLApi, adresseDeLApiAdmin } from "../fixtures/adresses";
import { actionsDuJournal, lireLeJournal } from "../pages/journal-admin";

type Contexte = Navigateur["contexte"];
const RACINE = join(__dirname, "../../../..");

/** Lecture ou manœuvre Redis, consignée. Rend le JSON imprimé après « @@ ». */
function redis(script: string): unknown {
  const sortie = execFileSync("npx", ["tsx", "--env-file=.env", "-e", `import r from "./packages/libs/redis"; (async () => { ${script} process.exit(0); })();`], { cwd: RACINE, encoding: "utf-8", timeout: 120_000 });
  const ligne = sortie.trim().split("\n").filter((l) => l.startsWith("@@")).pop() ?? "@@null";
  return JSON.parse(ligne.slice(2));
}

/** Le `jti` d'une session admin, lu dans SON jeton de renouvellement (charge utile JWT, sans vérifier la signature). */
async function jtiDe(contexte: Contexte): Promise<string> {
  const jeton = (await contexte.cookies()).find((c) => c.name === "admin_refresh_token")?.value;
  expect(jeton, "cookie admin_refresh_token").toBeTruthy();
  return (JSON.parse(Buffer.from(jeton!.split(".")[1], "base64url").toString("utf-8")) as { jti: string }).jti;
}

const debutMaintenant = async () => {
  await new Promise((r) => setTimeout(r, 2_000));
  return new Date().toISOString();
};

test.describe("ADM-SEC — sessions et durée de vie (cahier 02-ADMIN § 4.2)", () => {
  test("ADM-SEC-7 · la session membre n'ouvre aucune route admin", async ({ navigateurVisiteur, navigateurAdmin, jeuEssai }) => {
    test.setTimeout(5 * 60_000);
    const sup = COMPTES_ADMIN.super;
    const { page, contexte } = await navigateurVisiteur();
    /* 1. Le même User, connecté sur le FRONT MEMBRE. */
    await connexion(page, { cle: "super", email: sup.email, prenom: sup.prenom, nom: sup.nom, role: "EXPEDITEUR" } as Compte, MOT_DE_PASSE_SEED);
    expect((await contexte.request.get(`${adresseDeLApi()}/auth/me`)).status(), "l'espace membre est ouvert").toBe(200);
    const debut = await debutMaintenant();
    /* 2. Le back-office, dans le même navigateur : /login. */
    await page.goto(`${adresseDuBackOffice()}/home`, { waitUntil: "domcontentloaded" });
    await expect(page, "la session membre ne donne aucun accès").toHaveURL(/\/login/, { timeout: 60_000 });
    /* 3. Une route admin appelée directement : 401. */
    const kpis = await contexte.request.get(`${adresseDeLApi()}/admin/kpis`, { failOnStatusCode: false });
    expect(kpis.status(), "GET /api/admin/kpis avec les seuls cookies membre").toBe(401);
    /* 4. Connexion au back-office, dans le même navigateur. */
    await connexionAdmin(page, sup, jeuEssai.admin("super").secret);
    /* 5. La session membre est TOUJOURS ouverte, et les quatre cookies coexistent. */
    expect((await contexte.request.get(`${adresseDeLApi()}/auth/me`)).status(), "ouvrir l'admin ne déconnecte pas le membre").toBe(200);
    const noms = (await contexte.cookies()).map((c) => c.name);
    for (const n of ["access_token", "refresh_token", "admin_access_token", "admin_refresh_token"]) expect(noms, `cookie ${n}`).toContain(n);
    /* Journal : un seul ADMIN_LOGIN, à l'étape 4. */
    const lecteur = await navigateurAdmin("finance");
    expect(await actionsDuJournal(lecteur.contexte.request, { from: debut, adminUserId: jeuEssai.admin("super").id }), "un seul ADMIN_LOGIN").toEqual(["ADMIN_LOGIN"]);
  });

  test("ADM-SEC-9 · durée de vie absolue (12 h) — les deux substituts du cahier, prouvés", async ({ navigateurVisiteur, jeuEssai }) => {
    test.setTimeout(5 * 60_000);
    test.info().annotations.push({ type: "⏭ partiel", description: "12 heures d'activité ne tiennent pas dans une journée de recette : les deux substituts du cahier sont vérifiés, plus une session vieillie par manœuvre" });
    const compte = jeuEssai.admin("privacy");
    const { page, contexte } = await navigateurVisiteur();
    await connexionAdmin(page, COMPTES_ADMIN.privacy, compte.secret);
    const jti = await jtiDe(contexte);
    const cle = `admin_jti:${compte.id}:${jti}`;
    /* Substitut 1 — TTL = min(reste d'inactivité 45 min, reste de vie absolue). Session neuve : 45 minutes. */
    const neuve = redis(`console.log("@@" + JSON.stringify({ ttl: await r.ttl(${JSON.stringify(cle)}), rec: JSON.parse((await r.get(${JSON.stringify(cle)})) ?? "null") }));`) as { ttl: number; rec: { createdAt: number } };
    expect(neuve.ttl, `session neuve : TTL ≈ 45 min (${neuve.ttl} s)`).toBeGreaterThan(45 * 60 - 60);
    expect(neuve.ttl).toBeLessThanOrEqual(45 * 60);
    /* Substitut 2 — le renouvellement fait TOURNER le jti et CONSERVE createdAt. */
    const renouvele = await contexte.request.post(`${adresseDeLApiAdmin()}/auth/admin/refresh`);
    expect(renouvele.ok(), "POST /auth/admin/refresh").toBe(true);
    const jti2 = await jtiDe(contexte);
    expect(jti2, "le jti a tourné").not.toBe(jti);
    const apres = redis(`console.log("@@" + JSON.stringify({ ancien: await r.exists(${JSON.stringify(cle)}), rec: JSON.parse((await r.get(${JSON.stringify(`admin_jti:${compte.id}:${jti2}`)})) ?? "null") }));`) as { ancien: number; rec: { createdAt: number } | null };
    expect(apres.ancien, "l'ancien jti n'existe plus").toBe(0);
    expect(apres.rec?.createdAt, "createdAt conservé au renouvellement").toBe(neuve.rec.createdAt);
    /* Manœuvre consignée — la session vieillie à 11 h 59 : au renouvellement suivant, le TTL tombe sous la minute. */
    const cle2 = `admin_jti:${compte.id}:${jti2}`;
    const vieilli = Date.now() - (12 * 60 - 1) * 60_000;
    redis(`const rec = JSON.parse((await r.get(${JSON.stringify(cle2)})) as string); rec.createdAt = ${vieilli}; await r.set(${JSON.stringify(cle2)}, JSON.stringify(rec), "EX", 600); console.log("@@true");`);
    process.stdout.write(`   ↳ manœuvre Redis : session ${jti2} vieillie à 11 h 59 (ADM-SEC-9)\n`);
    expect((await contexte.request.post(`${adresseDeLApiAdmin()}/auth/admin/refresh`)).ok(), "le renouvellement d'une session de 11 h 59 passe encore").toBe(true);
    const jti3 = await jtiDe(contexte);
    const ttlFin = Number(redis(`console.log("@@" + JSON.stringify(await r.ttl(${JSON.stringify(`admin_jti:${compte.id}:${jti3}`)})));`));
    expect(ttlFin, `vie absolue : le TTL n'est plus que le reste des 12 h (${ttlFin} s), pas 45 min`).toBeLessThanOrEqual(60);
    /* Et passée la borne, plus rien ne se renouvelle : on la dépasse d'une minute. */
    redis(`const k = ${JSON.stringify(`admin_jti:${compte.id}:${jti3}`)}; const rec = JSON.parse((await r.get(k)) as string); rec.createdAt = ${Date.now() - (12 * 60 + 1) * 60_000}; await r.set(k, JSON.stringify(rec), "EX", 600); console.log("@@true");`);
    const refuse = await contexte.request.post(`${adresseDeLApiAdmin()}/auth/admin/refresh`, { failOnStatusCode: false });
    expect(refuse.status(), "au-delà de 12 h, le renouvellement est refusé").toBe(401);
    await page.goto(`${adresseDuBackOffice()}/home`, { waitUntil: "domcontentloaded" });
    await expect(page, "et l'écran renvoie à /login").toHaveURL(/\/login/, { timeout: 60_000 });
  });

  test("ADM-SEC-10 · révoquer une session depuis « Mes sessions »", async ({ navigateurVisiteur, navigateurAdmin, mailpit, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    const compte = jeuEssai.admin("support");
    const avant = await mailpit.compter({ pour: compte.email, sujet: "Nouvelle connexion au back-office Yamba" });
    /* Deux sessions du même compte, deux navigateurs. */
    const A = await navigateurVisiteur();
    await connexionAdmin(A.page, COMPTES_ADMIN.support, compte.secret);
    const B = await navigateurVisiteur();
    await connexionAdmin(B.page, COMPTES_ADMIN.support, compte.secret);
    const jtiA = await jtiDe(A.contexte);
    const jtiB = await jtiDe(B.contexte);
    expect(jtiA).not.toBe(jtiB);
    const debut = await debutMaintenant();
    /* ✉ Une alerte par ouverture. */
    await expect.poll(() => mailpit.compter({ pour: compte.email, sujet: "Nouvelle connexion au back-office Yamba" }), { timeout: 60_000, message: "deux emails de connexion" }).toBeGreaterThanOrEqual(avant + 2);
    /* 1-2. « Mes sessions » depuis A. */
    await A.page.goto(`${adresseDuBackOffice()}/sessions`, { waitUntil: "domcontentloaded" });
    await expect(A.page.getByRole("heading", { name: "Mes sessions admin" })).toBeVisible({ timeout: 60_000 });
    await expect(A.page.getByText("Une alerte email part à chaque ouverture de session. Révoque ce que tu ne reconnais pas.", { exact: true })).toBeVisible();
    const lignes = A.page.locator("ul li").filter({ hasText: "ouverte le" });
    await expect.poll(() => lignes.count(), { timeout: 30_000, message: "au moins deux lignes" }).toBeGreaterThanOrEqual(2);
    await expect(lignes.filter({ hasText: "cette session" }), "une ligne « cette session »").toHaveCount(1);
    await expect(lignes.first(), "« ouverte le … · active le … »").toContainText(/ouverte le .+ · active le .+/);
    /* 3. Révoquer B — l'écran ne distingue les lignes que par leurs dates : on révoque par l'API de l'écran, par le jti
          de B lu dans SON jeton (même route que le bouton « Révoquer »). */
    const rev = await A.contexte.request.delete(`${adresseDeLApiAdmin()}/admin/me/sessions/${jtiB}`);
    expect(rev.ok(), `DELETE /admin/me/sessions/${jtiB}`).toBe(true);
    /* ANO-ADM-04 — le JETON D'ACCÈS de B (encore valide 15 min) est refusé dans la seconde, sans passer par le
       rafraîchissement : avant la correction, cet appel répondait 200. */
    const apresRevocation = await B.contexte.request.get(`${adresseDeLApiAdmin()}/admin/kpis`, { failOnStatusCode: false });
    expect(apresRevocation.status(), "le jeton d'accès de B tombe immédiatement").toBe(401);
    expect(((await apresRevocation.json()) as { details?: { code?: string } }).details?.code).toBe("ADMIN_SESSION_REVOKED");
    /* 4. B navigue : /login. */
    await B.page.goto(`${adresseDuBackOffice()}/home`, { waitUntil: "domcontentloaded" });
    await expect(B.page, "le navigateur B est renvoyé à /login").toHaveURL(/\/login/, { timeout: 60_000 });
    /* 5. A révoque SA session par le bouton de la ligne « cette session » : /login immédiatement. */
    await A.page.reload({ waitUntil: "domcontentloaded" });
    const moi = A.page.locator("ul li").filter({ hasText: "cette session" });
    await expect(moi).toBeVisible({ timeout: 30_000 });
    await moi.getByRole("button", { name: "Révoquer" }).click();
    await expect(A.page, "le navigateur A est immédiatement renvoyé à /login").toHaveURL(/\/login/, { timeout: 30_000 });
    /* Journal : une ligne ADMIN_SESSION_REVOKED par révocation, cible SESSION · jti. */
    const lecteur = await navigateurAdmin("finance");
    const revocations = (await lireLeJournal(lecteur.contexte.request, { from: debut, adminUserId: compte.id })).filter((l) => l.action === "ADMIN_SESSION_REVOKED");
    expect(revocations.map((l) => `${l.targetType} · ${l.targetId}`), "une ligne par révocation").toEqual([`SESSION · ${jtiB}`, `SESSION · ${jtiA}`]);
  });

  test("ADM-SEC-8 · expiration par inactivité (45 minutes, attente réelle)", async ({ navigateurVisiteur, navigateurAdmin, jeuEssai }) => {
    test.setTimeout(55 * 60_000);
    const compte = jeuEssai.admin("mediateur");
    const { page, contexte } = await navigateurVisiteur();
    await connexionAdmin(page, COMPTES_ADMIN.mediateur, compte.secret);
    const cle = `admin_jti:${compte.id}:${await jtiDe(contexte)}`;
    const ttl = Number(redis(`console.log("@@" + JSON.stringify(await r.ttl(${JSON.stringify(cle)})));`));
    expect(ttl, `TTL Redis de la session ≈ 45 min (${ttl} s)`).toBeGreaterThan(45 * 60 - 120);
    const debut = await debutMaintenant();
    /* 2. STRICTEMENT inactif : aucun onglet du back-office ouvert (une page qui se rafraîchit seule fausserait tout). */
    await page.goto("about:blank");
    await page.waitForTimeout(46 * 60_000);
    /* L'enregistrement a expiré de lui-même : c'est lui, et non le jeton, qui porte l'inactivité. */
    expect(Number(redis(`console.log("@@" + JSON.stringify(await r.exists(${JSON.stringify(cle)})));`)), "la clé Redis a expiré").toBe(0);
    /* 3. Une entrée du menu : retour à /login. */
    await page.goto(`${adresseDuBackOffice()}/alerts`, { waitUntil: "domcontentloaded" });
    await expect(page, "après 46 min d'inactivité : /login").toHaveURL(/\/login/, { timeout: 60_000 });
    /* Journal : aucune ligne — une expiration n'est pas une déconnexion volontaire. */
    const lecteur = await navigateurAdmin("finance");
    expect(await actionsDuJournal(lecteur.contexte.request, { from: debut, adminUserId: compte.id }), "aucune ligne").toEqual([]);
  });
});
