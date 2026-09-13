/**
 * web-sig.spec.ts — cahier 01-WEB, chapitre 5.24 « Signaler un trajet, un profil, un message »
 * ============================================================================================
 * La porte d'identité pour un visiteur (connexion DANS la fenêtre, retour sur l'annonce), la fenêtre de signalement
 * d'une annonce (titre, introduction, quatre motifs — jamais « Usurpation d'identité » —, précisions, accusé), le
 * doublon refusé, « on ne se signale pas soi-même » (écran + API), le signalement d'un profil (le membre signalé
 * n'apprend rien), une cible invisible (annonce masquée par Yamba, profil masqué) qui répond « introuvable », trois
 * signalements qui ne changent rien côté membre (mais rendent la revue prioritaire au back-office), et l'avis
 * signalé par email. Le signalement d'un message est joué en 5.15.
 *
 * Cibles : le trajet `bzv-upcoming` de Thomas (SIG-1 à 4), `bzv-perkg` de Thomas (SIG-7), le profil `seed-thomas`
 * (SIG-4, 5, 8), le trajet `fih` de Joséphine masqué par le back-office et le profil `seed-josephine` rendu privé
 * par manœuvre (SIG-6) — les deux remis en l'état dans un `finally`.
 */
import { test, expect, type Navigateur } from "../fixtures/yamba";
import { adresseDeLApi, adresseDeLApiAdmin } from "../fixtures/adresses";
import { COMPTES, MOT_DE_PASSE_SEED } from "../fixtures/comptes";
import { JeuEssai } from "../fixtures/jeu-essai";
import { normaliserEspaces } from "../pages/reservation";

type Contexte = Navigateur["contexte"];
type Page = Navigateur["page"];
const api = () => adresseDeLApi();

/* ══ Aides ═══════════════════════════════════════════════════════════════════════════════════ */

const texte = async (page: Page) => normaliserEspaces(await page.locator("body").innerText());
const dialogue = (page: Page) => page.getByRole("dialog");

async function ouvrirLAnnonce(page: Page, tripId: string): Promise<void> {
  await page.goto(`/fr/trips/${tripId}`, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 60_000 });
}

async function ouvrirLeProfil(page: Page, slug: string): Promise<void> {
  await page.goto(`/fr/u/${slug}`, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 60_000 });
}

/** Le signalement par l'API, tel quel — statut et corps. */
async function signalerParApi(contexte: Contexte, cible: { targetType: "TRIP" | "USER"; targetRef: string; reason: string; details?: string }): Promise<{ statut: number; corps: string }> {
  const r = await contexte.request.post(`${api()}/reports`, { data: cible });
  return { statut: r.status(), corps: await r.text() };
}

/** La fenêtre de signalement, du clic à l'envoi ; rend le statut de la réponse et le texte final de la fenêtre. */
async function signalerParLEcran(page: Page, bouton: string, motif: string, precisions?: string): Promise<{ statut: number; fenetre: string }> {
  await page.getByRole("button", { name: bouton }).click();
  await expect(dialogue(page)).toBeVisible({ timeout: 15_000 });
  await dialogue(page).getByRole("combobox").selectOption({ label: motif });
  if (precisions) await dialogue(page).locator("textarea").fill(precisions);
  const reponse = page.waitForResponse((r) => r.url().endsWith("/reports") && r.request().method() === "POST", { timeout: 30_000 });
  await dialogue(page).getByRole("button", { name: "Envoyer le signalement" }).click();
  const r = await reponse;
  await page.waitForTimeout(500);
  return { statut: r.status(), fenetre: normaliserEspaces(await dialogue(page).innerText()) };
}

type Cloche = { id: string; type: string; payload: Record<string, unknown> };
async function notifications(contexte: Contexte): Promise<Cloche[]> {
  const r = await contexte.request.get(`${api()}/me/notifications?limit=100`);
  expect(r.ok()).toBe(true);
  return ((await r.json()) as { notifications: Cloche[] }).notifications;
}
/** Les cloches NOUVELLES depuis `avant` qui parlent d'un signalement ou de la cible — le cron FAKE peut écrire autre chose entre-temps (versements). */
function clochesDeSignalement(avant: Cloche[], apres: Cloche[], cibleId?: string): Cloche[] {
  const connues = new Set(avant.map((n) => n.id));
  return apres.filter((n) => !connues.has(n.id)).filter((n) => /report|signal/i.test(n.type) || /report|signal/i.test(JSON.stringify(n.payload)) || (!!cibleId && JSON.stringify(n.payload).includes(cibleId)));
}

/* ══ Les fiches ══════════════════════════════════════════════════════════════════════════════ */

test.describe("WEB-SIG — signaler un trajet, un profil, un message (chapitre 5.24)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(() => {
    new JeuEssai().rejouer();
  });

  test("WEB-SIG-1 · un visiteur voit la porte d'identité", async ({ navigateurVisiteur, navigateurConnecte, jeuEssai }) => {
    const trajet = jeuEssai.trajet("bzv-upcoming");
    await navigateurConnecte("aminata", { parEcran: true }); // la session existe : la porte s'ouvre quand même
    const { page } = await navigateurVisiteur();
    await ouvrirLAnnonce(page, trajet);
    await page.getByRole("button", { name: "Signaler cette annonce" }).click();
    await expect(page.getByText("Connecte-toi pour signaler")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Un signalement est toujours signé : cela protège tout le monde des abus.")).toBeVisible();
    /* Connexion DANS la fenêtre : retour sur l'annonce. */
    const formulaire = page.locator("form").filter({ has: page.locator("#email") }).filter({ visible: true }).last();
    await formulaire.locator("#email").fill(COMPTES.aminata.email);
    await formulaire.locator("#password").fill(MOT_DE_PASSE_SEED);
    const connexion = page.waitForResponse((r) => r.url().includes("/auth/login") && r.request().method() === "POST", { timeout: 30_000 });
    await formulaire.locator("button[type=submit]").click();
    expect((await connexion).status()).toBe(200);
    await expect(page).toHaveURL(new RegExp(`/fr/trips/${trajet}`), { timeout: 30_000 });
    await expect(page.getByText("Connecte-toi pour signaler")).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Signaler cette annonce" })).toBeVisible({ timeout: 30_000 });
  });

  test("WEB-SIG-2 · signaler une annonce", async ({ navigateurConnecte, navigateurVisiteur, jeuEssai, mailpit }) => {
    await mailpit.vider();
    const trajet = jeuEssai.trajet("bzv-upcoming");
    const { page } = await navigateurConnecte("aminata");
    await ouvrirLAnnonce(page, trajet);
    await page.getByRole("button", { name: "Signaler cette annonce" }).click();
    await expect(dialogue(page)).toBeVisible({ timeout: 15_000 });
    const avant = normaliserEspaces(await dialogue(page).innerText());
    expect(avant).toContain("Signaler cette annonce");
    expect(avant).toContain("Dis-nous ce qui ne va pas. Notre équipe regarde chaque signalement ; la personne concernée ne saura jamais qui l'a signalée.");
    const options = await dialogue(page).getByRole("combobox").locator("option").allInnerTexts();
    expect(options.map((o) => o.trim())).toEqual(["Contenu illicite ou interdit", "Arnaque suspectée", "Comportement inapproprié", "Autre"]);
    expect(avant).toContain("Précisions (facultatif)");
    await expect(dialogue(page).getByPlaceholder("Ce que tu as vu, quand…")).toBeVisible();
    await dialogue(page).getByRole("combobox").selectOption({ label: "Arnaque suspectée" });
    await dialogue(page).locator("textarea").fill("Le prix annoncé change à chaque message et le Voyageur demande un acompte hors plateforme.");
    const reponse = page.waitForResponse((r) => r.url().endsWith("/reports") && r.request().method() === "POST", { timeout: 30_000 });
    await dialogue(page).getByRole("button", { name: "Envoyer le signalement" }).click();
    const r = await reponse;
    expect([200, 201], `POST /reports → ${r.status()}`).toContain(r.status());
    await expect(dialogue(page).getByText("Merci, ton signalement est bien reçu.")).toBeVisible({ timeout: 15_000 });
    await expect(dialogue(page).getByText("Un email de confirmation t'a été envoyé. Nous ne communiquons pas la suite donnée.")).toBeVisible();
    /* L'annonce reste en ligne. */
    const visiteur = await navigateurVisiteur();
    await ouvrirLAnnonce(visiteur.page, trajet);
    await expect(visiteur.page.getByText("Trajet introuvable")).toHaveCount(0);
    await expect(visiteur.page.getByRole("button", { name: "Signaler cette annonce" }), "l'annonce est en ligne pour tout le monde").toBeVisible();
    const email = await mailpit.attendreEmail({ pour: COMPTES.aminata.email, sujet: /^Ton signalement a bien été reçu$/ });
    expect(email.html + email.texte, "dans la langue de l'auteur (fr)").toMatch(/Bonjour Aminata/);
    test.info().annotations.push({ type: "note", description: `POST /reports → ${r.status()} ; email « ${email.sujet} »` });
  });

  test("WEB-SIG-3 · le doublon est refusé", async ({ navigateurConnecte, jeuEssai }) => {
    const trajet = jeuEssai.trajet("bzv-upcoming");
    const { page, contexte } = await navigateurConnecte("aminata");
    await ouvrirLAnnonce(page, trajet);
    const { statut, fenetre } = await signalerParLEcran(page, "Signaler cette annonce", "Arnaque suspectée");
    expect(statut).toBe(409);
    expect(fenetre).toContain("Tu as déjà signalé cet élément, notre équipe s'en occupe.");
    const api409 = await signalerParApi(contexte, { targetType: "TRIP", targetRef: trajet, reason: "OTHER" });
    expect(api409.statut).toBe(409);
    expect(api409.corps).toContain('"code":"ALREADY_REPORTED"');
  });

  test("WEB-SIG-4 · on ne se signale pas soi-même", async ({ navigateurConnecte, jeuEssai }) => {
    const trajet = jeuEssai.trajet("bzv-upcoming");
    const { page, contexte } = await navigateurConnecte("thomas");
    await ouvrirLAnnonce(page, trajet);
    await expect(page.getByRole("button", { name: "Signaler cette annonce" }), "sa propre annonce : aucun bouton").toHaveCount(0);
    await ouvrirLeProfil(page, "seed-thomas");
    await expect(page.getByRole("button", { name: "Signaler ce profil" }), "son propre profil : aucun bouton").toHaveCount(0);
    for (const cible of [{ targetType: "TRIP" as const, targetRef: trajet }, { targetType: "USER" as const, targetRef: "seed-thomas" }]) {
      const refus = await signalerParApi(contexte, { ...cible, reason: "OTHER" });
      expect(refus.statut, `${cible.targetType} : refus`).toBe(400);
      expect(refus.corps).toContain('"code":"OWN_TARGET"');
    }
    test.info().annotations.push({ type: "note", description: "appel forcé → 400 OWN_TARGET (« You cannot report your own trip or profile. »), que l'écran traduit « Tu ne peux pas signaler ton propre contenu. »" });
  });

  test("WEB-SIG-5 · signaler un profil : le membre signalé n'est jamais prévenu", async ({ navigateurConnecte, mailpit }) => {
    await mailpit.vider();
    const thomas = await navigateurConnecte("thomas");
    const clochesAvant = await notifications(thomas.contexte);
    const { page } = await navigateurConnecte("aminata");
    await ouvrirLeProfil(page, "seed-thomas");
    await page.getByRole("button", { name: "Signaler ce profil" }).click();
    await expect(dialogue(page)).toBeVisible({ timeout: 15_000 });
    expect(normaliserEspaces(await dialogue(page).innerText())).toContain("Signaler ce profil");
    const options = await dialogue(page).getByRole("combobox").locator("option").allInnerTexts();
    expect(options.map((o) => o.trim()), "le profil offre « Usurpation d'identité »").toContain("Usurpation d'identité");
    await dialogue(page).getByRole("combobox").selectOption({ label: "Usurpation d'identité" });
    const reponse = page.waitForResponse((r) => r.url().endsWith("/reports") && r.request().method() === "POST", { timeout: 30_000 });
    await dialogue(page).getByRole("button", { name: "Envoyer le signalement" }).click();
    expect([200, 201]).toContain((await reponse).status());
    await expect(dialogue(page).getByText("Merci, ton signalement est bien reçu.")).toBeVisible({ timeout: 15_000 });
    await mailpit.attendreEmail({ pour: COMPTES.aminata.email, sujet: /^Ton signalement a bien été reçu$/ });
    await new Promise((r) => setTimeout(r, 4_000));
    expect(clochesDeSignalement(clochesAvant, await notifications(thomas.contexte)), "aucune notification au membre signalé").toEqual([]);
    expect(await mailpit.compter({ pour: COMPTES.thomas.email, sujet: /signal|report|profil/i }), "aucun email au membre signalé").toBe(0);
    await thomas.page.goto("/fr/dashboard/home", { waitUntil: "networkidle" });
    expect(await texte(thomas.page)).not.toMatch(/signal/i);
  });

  test("WEB-SIG-6 · une cible invisible répond « introuvable »", async ({ navigateurConnecte, navigateurAdmin, jeuEssai }) => {
    const fih = jeuEssai.trajet("fih");
    const admin = await navigateurAdmin("mediateur");
    const { page, contexte } = await navigateurConnecte("aminata");
    const masque = await admin.contexte.request.post(`${adresseDeLApiAdmin()}/admin/trips/${fih}/hide`, { data: { reason: "Recette WEB-SIG-6 : masquage de contrôle, levé par la même fiche." } });
    expect(masque.status(), await masque.text()).toBe(200);
    jeuEssai.manoeuvre("WEB-SIG-6 — le profil de Joséphine rendu privé, remis public par la même fiche", `import p from "./packages/libs/prisma"; (async () => { await p.user.update({ where: { publicSlug: "seed-josephine" }, data: { profilePublic: false } }); process.exit(0); })();`);
    try {
      /* 1 — une annonce masquée par Yamba. */
      await page.goto(`/fr/trips/${fih}`, { waitUntil: "networkidle" });
      await expect(page.getByText("Trajet introuvable")).toBeVisible({ timeout: 60_000 });
      await expect(page.getByRole("button", { name: "Signaler cette annonce" })).toHaveCount(0);
      const refusTrajet = await signalerParApi(contexte, { targetType: "TRIP", targetRef: fih, reason: "OTHER" });
      /* 2 — un profil masqué. */
      await page.goto("/fr/u/seed-josephine", { waitUntil: "networkidle" });
      await expect(page.getByText("Profil introuvable")).toBeVisible({ timeout: 60_000 });
      await expect(page.getByRole("button", { name: "Signaler ce profil" })).toHaveCount(0);
      const refusProfil = await signalerParApi(contexte, { targetType: "USER", targetRef: "seed-josephine", reason: "IMPERSONATION" });
      expect(refusProfil.statut, "profil masqué : introuvable").toBe(404);
      expect(refusProfil.corps).toContain('"code":"USER_NOT_FOUND"');
      test.info().annotations.push({ type: "constat", description: `annonce masquée : POST /reports → ${refusTrajet.statut} ${refusTrajet.corps.slice(0, 120)} ; profil masqué → ${refusProfil.statut}` });
      expect(refusTrajet.statut, "annonce masquée par Yamba : introuvable (ANO-WEB-79)").toBe(404);
    } finally {
      await admin.contexte.request.delete(`${adresseDeLApiAdmin()}/admin/trips/${fih}/hide`, { data: { reason: "Recette WEB-SIG-6 : masquage de contrôle levé." } });
      jeuEssai.manoeuvre("WEB-SIG-6 — le profil de Joséphine remis public", `import p from "./packages/libs/prisma"; (async () => { await p.user.update({ where: { publicSlug: "seed-josephine" }, data: { profilePublic: true } }); process.exit(0); })();`);
    }
  });

  test("WEB-SIG-7 · trois signalements ne changent rien côté membre", async ({ navigateurConnecte, navigateurVisiteur, navigateurAdmin, jeuEssai, mailpit }) => {
    await mailpit.vider();
    const trajet = jeuEssai.trajet("bzv-perkg");
    const thomas = await navigateurConnecte("thomas");
    const clochesAvant = await notifications(thomas.contexte);
    for (const cle of ["aminata", "joao", "chinwe"] as const) {
      const { page } = await navigateurConnecte(cle);
      await ouvrirLAnnonce(page, trajet);
      const { statut, fenetre } = await signalerParLEcran(page, "Signaler cette annonce", "Comportement inapproprié", "Signalement de recette, trois auteurs.");
      expect(statut, `${cle}`).toBeLessThan(300);
      expect(fenetre).toContain("Merci, ton signalement est bien reçu.");
      await mailpit.attendreEmail({ pour: COMPTES[cle].email, sujet: /^Ton signalement a bien été reçu$/ });
    }
    /* L'annonce reste en ligne ; le propriétaire n'apprend rien. */
    const visiteur = await navigateurVisiteur();
    await ouvrirLAnnonce(visiteur.page, trajet);
    await expect(visiteur.page.getByText("Trajet introuvable")).toHaveCount(0);
    await new Promise((r) => setTimeout(r, 3_000));
    expect(clochesDeSignalement(clochesAvant, await notifications(thomas.contexte), trajet), "aucune notification au propriétaire").toEqual([]);
    expect(await mailpit.compter({ pour: COMPTES.thomas.email, sujet: /signal|report|annonce|trajet/i }), "aucun email au propriétaire").toBe(0);
    await ouvrirLAnnonce(thomas.page, trajet);
    expect(await texte(thomas.page)).not.toMatch(/signal|masqu|sanction/i);
    await thomas.page.goto("/fr/dashboard/trips", { waitUntil: "networkidle" });
    await expect(thomas.page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 60_000 });
    expect(await texte(thomas.page)).not.toMatch(/signal|sanction/i);
    /* Back-office : la revue devient prioritaire (SIG-03), jamais une sanction automatique. */
    const admin = await navigateurAdmin("support");
    const file = await admin.contexte.request.get(`${adresseDeLApiAdmin()}/admin/reports?status=OPEN`);
    expect(file.ok(), await file.text()).toBe(true);
    const items = ((await file.json()) as { items?: Array<{ targetType: string; targetId: string; openCountOnTarget: number; priority: boolean }>; reports?: Array<{ targetType: string; targetId: string; openCountOnTarget: number; priority: boolean }> });
    const lignes = items.items ?? items.reports ?? [];
    const cible = lignes.filter((l) => l.targetType === "TRIP" && l.targetId === trajet);
    expect(cible.length, "trois lignes ouvertes sur la cible").toBe(3);
    expect(cible.every((l) => l.openCountOnTarget === 3 && l.priority), "Prioritaire · 3 ouverts").toBe(true);
    /* Aucune sanction automatique : après les trois signalements ET la revue prioritaire, l'annonce est toujours publique. */
    await ouvrirLAnnonce(visiteur.page, trajet);
    await expect(visiteur.page.getByText("Trajet introuvable")).toHaveCount(0);
    await expect(visiteur.page.getByRole("button", { name: "Signaler cette annonce" })).toBeVisible();
  });

  test("WEB-SIG-8 · signaler un avis", async ({ navigateurConnecte, navigateurVisiteur, jeuEssai }) => {
    const id = jeuEssai.deal("bzv-completed").id; // Mai ↔ Thomas
    const mai = await navigateurConnecte("mai");
    const thomas = await navigateurConnecte("thomas");
    const commentaire = `Voyageur ponctuel et soigneux (recette SIG-8, ${id.slice(-6)}).`;
    for (const [nav, corps] of [[mai, { rating: 5, criteria: {}, comment: commentaire }], [thomas, { rating: 4, criteria: {}, comment: "Expéditrice réactive, colis conforme." }]] as const) {
      const r = await nav.contexte.request.post(`${api()}/deals/${id}/rating`, { data: corps });
      expect(r.status(), await r.text()).toBeLessThan(300);
    }
    const { page } = await navigateurVisiteur();
    await ouvrirLeProfil(page, "seed-thomas");
    await expect(page.getByText(commentaire)).toBeVisible({ timeout: 60_000 });
    const carte = page.locator("article, li, div").filter({ hasText: commentaire }).last();
    const signaler = carte.getByRole("link", { name: "Signaler cet avis" }).first();
    await expect(signaler).toBeVisible();
    const href = decodeURIComponent((await signaler.getAttribute("href")) ?? "");
    expect(href).toMatch(/^mailto:[^?]+\?subject=Signalement d'un avis \(#[0-9a-f]{24}\)/);
    await expect(page.getByRole("button", { name: /Signaler cet avis/ }), "aucune fenêtre, aucune file : un email au support").toHaveCount(0);
    test.info().annotations.push({ type: "note", description: `« Signaler cet avis » → ${href}` });
  });
});
