/**
 * adm-cnv-conversations.spec.ts — cahier 02-ADMIN, § 5.18 « Conversations » (ADM-CNV-1 à 3) + fiches ajoutées
 * ==============================================================================================================
 * Lire le fil de deux membres est le geste le plus intrusif du back-office. Le chapitre se juge à trois promesses que la
 * page écrit elle-même :
 *  - **« Lecture journalisée »** : une ouverture = une ligne `CONVERSATION_VIEWED`, ni zéro ni deux ;
 *  - **« Le numéro de téléphone n'apparaît jamais ici »** : ni le numéro d'un compte, ni celui qu'un membre aurait TAPÉ
 *    dans un message (cherché par ses chiffres, espaces et points compris) ;
 *  - **lecture seule** : aucun champ, aucun bouton qui écrive dans le fil.
 * Les gestes membres (message, rendez-vous, révélation) passent par la vraie API de messagerie, jamais par la base. Jeu
 * d'essai rejoué avant chaque fiche.
 */
import { test, expect, type NavigateurAdmin } from "../fixtures/yamba";
import { JeuEssai } from "../fixtures/jeu-essai";
import { adresseDeLApi, adresseDeLApiAdmin, adresseDuBackOffice } from "../fixtures/adresses";
import { lireLeJournal } from "../pages/journal-admin";
import { attendreLeChargement, debutDuScenario, lireCoteServeur } from "../pages/ecran-admin";
import { FilMessagerie } from "../pages/fil-messagerie";

const api = () => adresseDeLApiAdmin();
const bo = () => adresseDuBackOffice();
type Contexte = NavigateurAdmin["contexte"];
type Page = NavigateurAdmin["page"];

const chiffres = (s: string) => s.replace(/\D/g, "");
/** Les numéros des deux parties, lus en base (le harnais le peut ; l'écran, jamais). */
const numerosDesParties = (bookingId: string) =>
  lireCoteServeur<string[]>(`
    import prisma from "./packages/libs/prisma";
    (async () => {
      const b = await prisma.booking.findUnique({ where: { id: "${bookingId}" }, select: { shipperId: true, carrierId: true } });
      const users = await prisma.user.findMany({ where: { id: { in: [b!.shipperId, b!.carrierId] } }, select: { phoneE164: true } });
      console.log("@@" + JSON.stringify(users.map((u) => u.phoneE164).filter(Boolean)));
      process.exit(0);
    })();`);
/** Aucun numéro dans la page : ni celui des parties (tous formats), ni une suite de 9 chiffres ou plus. */
async function aucunNumero(page: Page, numeros: string[]): Promise<string[]> {
  const corps = await page.locator("main").innerText();
  const trouves: string[] = [];
  for (const n of numeros) {
    const national = chiffres(n).slice(-9);
    if (chiffres(corps).includes(national)) trouves.push(`numéro d'une partie (…${national.slice(-4)})`);
  }
  for (const m of corps.match(/\+?\d[\d .-]{7,}\d/g) ?? []) if (chiffres(m).length >= 9) trouves.push(`suite de chiffres « ${m} »`);
  return trouves;
}
const idDuFil = (ctx: Contexte, bookingId: string) => FilMessagerie.identifiantDuFil(ctx, bookingId);
/** Le journal se relit avec le super administrateur (cahier § 2.7) : Médiateur et Support n'ont pas `audit.read`. */
const lignesVues = async (ctx: Contexte, debut: string, adminId: string) =>
  (await lireLeJournal(ctx.request, { from: debut, adminUserId: adminId })).filter((l) => l.action === "CONVERSATION_VIEWED");
const bloc = (page: Page, titre: RegExp) => page.locator("main section").filter({ has: page.locator("h2", { hasText: titre }) });

test.describe("ADM-CNV — conversations (cahier 02-ADMIN § 5.18)", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(() => {
    new JeuEssai().rejouer();
  });
  test.afterAll(() => {
    new JeuEssai().rejouer();
  });

  test("ADM-CNV-1 · lire un fil depuis un dossier", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(8 * 60_000);
    const med = await navigateurAdmin("mediateur");
    const deal = jeuEssai.deal("bzv-accepted").id;
    const { page } = med;
    /* 1. Depuis la file « Messages » des signalements. */
    await page.goto(`${bo()}/reports`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    const debut = await debutDuScenario();
    await page.getByRole("link", { name: /Lire la conversation →/ }).first().click();
    await expect(page).toHaveURL(new RegExp(`/conversations/${deal}$`), { timeout: 30_000 });
    /* 2-3. Titre, sous-titre, liens, mention. */
    await expect(page.getByRole("heading", { level: 1, name: "Conversation du deal" })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Paris → Brazzaville · ACCEPTED · Expéditeur Pauline Lemaire · Voyageur Thomas Nkounkou", { exact: true })).toBeVisible();
    await expect(page.getByText("Lecture journalisée. Le numéro de téléphone n'apparaît jamais ici : seules les révélations sont tracées.", { exact: true })).toBeVisible();
    /* 4. Les trois blocs. */
    const rdv = bloc(page, /^Rendez-vous$/);
    await expect(rdv).toContainText("Remise · Paris CDG, terminal 2E, comptoirs d'enregistrement");
    await expect(rdv).toContainText("proposé (par Voyageur)");
    await expect(bloc(page, /^Numéro révélé$/)).toContainText("Personne n'a encore vu le numéro de l'autre.");
    const fil = bloc(page, /^Fil \(2 messages\)$/);
    const messages = fil.locator("ol > li");
    await expect(messages).toHaveCount(2);
    await expect(messages.nth(0), "l'Expéditeur à gauche").toHaveClass(/mr-8/);
    await expect(messages.nth(1), "le Voyageur à droite").toHaveClass(/ml-8/);
    await expect(messages.nth(1)).toContainText(/⚑ .+ — signalé par Expéditeur le .+ · .+ · « Il propose de regler hors de Yamba\. »/);
    /* 5. Aucun numéro. */
    expect(await aucunNumero(page, numerosDesParties(deal)), "aucun numéro dans la page").toEqual([]);
    /* 6. Lecture seule. */
    await expect(page.locator("main textarea, main input, main [contenteditable=true]"), "aucun champ").toHaveCount(0);
    await expect(page.locator("main button"), "aucun bouton").toHaveCount(0);
    /* Le lien « ← Dossier du deal » mène à une fiche lisible (le deal n'est pas en litige). */
    const lien = page.getByRole("link", { name: /^← (Dossier du deal|Fiche du deal)$/ });
    const cible = (await lien.getAttribute("href"))!;
    const libelle = (await lien.innerText()).trim();
    await lien.click();
    await expect(page).toHaveURL(new RegExp(`${cible.replace(/[/]/g, "\\/")}$`), { timeout: 30_000 });
    await attendreLeChargement(page);
    await page.waitForTimeout(3_000);
    const texteCible = (await page.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 160);
    test.info().annotations.push({ type: "constat", description: `« ${libelle} » → ${cible} : « ${texteCible} »` });
    expect(texteCible, "le lien du dossier ne mène pas à une page introuvable").not.toMatch(/introuvable|n'existe pas|not found|404/i);
    /* 7. Un deal sans conversation. */
    const sansFil = jeuEssai.deal("bzv-pending").id;
    await page.goto(`${bo()}/conversations/${sansFil}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Ce deal n'a pas de conversation.")).toBeVisible({ timeout: 60_000 });
    const direct = await med.contexte.request.get(`${api()}/admin/conversations/by-deal/${sansFil}`, { failOnStatusCode: false });
    expect(direct.status()).toBe(404);
    /* Journal : une ligne pour l'ouverture du fil. */
    const lignes = await lignesVues((await navigateurAdmin("super")).contexte, debut, jeuEssai.admin("mediateur").id);
    const fils = lignes.filter((l) => (l.after as { bookingId?: string }).bookingId === deal);
    expect(fils.length, "une ouverture = une ligne").toBe(1);
    expect(fils[0].targetType).toBe("CONVERSATION");
    expect(fils[0].after).toEqual({ bookingId: deal, messages: 2 });
  });

  test("ADM-CNV-2 · la Finance ne lit aucune conversation", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(5 * 60_000);
    const fin = await navigateurAdmin("finance");
    const litige = jeuEssai.deal("bzv-disputed").id;
    const accepte = jeuEssai.deal("bzv-accepted").id;
    const debut = await debutDuScenario();
    await fin.page.goto(`${bo()}/disputes/${litige}`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(fin.page);
    await expect(fin.page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 60_000 });
    await expect(fin.page.getByRole("link", { name: /Lire la conversation des deux parties/ }), "lien absent pour la Finance").toHaveCount(0);
    const direct = await fin.contexte.request.get(`${api()}/admin/conversations/by-deal/${accepte}`, { failOnStatusCode: false });
    expect(direct.status(), "Finance → 403").toBe(403);
    const chemin = await fin.contexte.request.get(`${api()}/admin/conversations/${accepte}`, { failOnStatusCode: false });
    test.info().annotations.push({ type: "écart documentaire", description: `le cahier appelle /api/admin/conversations/<bookingId> : cette route n'existe pas (${chemin.status()}) ; la lecture est /api/admin/conversations/by-deal/<bookingId> → 403` });
    await fin.page.goto(`${bo()}/conversations/${accepte}`, { waitUntil: "domcontentloaded" });
    await expect(fin.page.getByText(/Ton profil ne lit pas les conversations/), "l'écran direct dit le refus en français").toBeVisible({ timeout: 60_000 });
    expect((await lignesVues(fin.contexte, debut, jeuEssai.admin("finance").id)), "un refus n'écrit rien").toEqual([]);
  });

  test("ADM-CNV-3 · les révélations de numéro sont tracées", async ({ navigateurAdmin, navigateurConnecte, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    const deal = jeuEssai.deal("bzv-accepted").id;
    const pauline = await navigateurConnecte("pauline");
    const thomas = await navigateurConnecte("thomas");
    const fil = await idDuFil(pauline.contexte, deal);
    /* 1. Un rendez-vous de remise dans 40 minutes, accepté, puis Pauline voit le numéro — par la vraie API. */
    const dans = (min: number) => new Date(Date.now() + min * 60_000).toISOString();
    const propose = await pauline.contexte.request.post(`${adresseDeLApi()}/messages/conversations/${fil}/meetups`, { data: { kind: "PICKUP", placeLabel: "Paris CDG, terminal 2E, comptoirs d'enregistrement", startAt: dans(40), endAt: dans(70) } });
    expect(propose.ok(), `proposer → ${propose.status()}`).toBe(true);
    const meetupId = ((await propose.json()) as { id: string }).id;
    expect((await thomas.contexte.request.post(`${adresseDeLApi()}/messages/conversations/${fil}/meetups/${meetupId}/accept`)).ok(), "Thomas accepte").toBe(true);
    const revele = await pauline.contexte.request.post(`${adresseDeLApi()}/messages/conversations/${fil}/phone`);
    expect(revele.ok(), `révéler → ${revele.status()}`).toBe(true);
    /* 2. Le back-office. */
    const sup = await navigateurAdmin("support");
    const debut = await debutDuScenario();
    const { page } = sup;
    await page.goto(`${bo()}/conversations/${deal}`, { waitUntil: "domcontentloaded" });
    await expect(bloc(page, /^Numéro révélé$/)).toContainText(/^Numéro révéléExpéditeur a vu le numéro le .+$/, { timeout: 60_000 });
    await expect(bloc(page, /^Fil \(/).locator("ol > li").filter({ hasText: /^Numéro affiché · / }), "message système au centre").toHaveCount(1);
    expect(await aucunNumero(page, numerosDesParties(deal)), "le numéro lui-même n'apparaît toujours pas").toEqual([]);
    const lecteur = (await navigateurAdmin("super")).contexte;
    await expect.poll(async () => (await lignesVues(lecteur, debut, jeuEssai.admin("support").id)).length, { timeout: 30_000 }).toBe(1);
  });

  test("ADM-CNV-4 · un numéro tapé dans un message n'apparaît pas au back-office (ajoutée)", async ({ navigateurAdmin, navigateurConnecte, jeuEssai }) => {
    test.setTimeout(5 * 60_000);
    const deal = jeuEssai.deal("bzv-accepted").id;
    const thomas = await navigateurConnecte("thomas");
    const fil = await idDuFil(thomas.contexte, deal);
    const texte = "Appelle-moi plutôt au 06 12 34 56 78 ou écris à thomas.perso@exemple.fr, ce sera plus simple.";
    const envoi = await thomas.contexte.request.post(`${adresseDeLApi()}/messages/conversations/${fil}/messages`, { data: { body: texte } });
    expect(envoi.ok(), `message → ${envoi.status()} ${envoi.ok() ? "" : await envoi.text()}`).toBe(true);
    const med = await navigateurAdmin("mediateur");
    const { page } = med;
    await page.goto(`${bo()}/conversations/${deal}`, { waitUntil: "domcontentloaded" });
    const dernier = bloc(page, /^Fil \(3 messages\)$/).locator("ol > li").last();
    await expect(dernier).toContainText("coordonnées détectées", { timeout: 60_000 });
    const lu = (await dernier.innerText()).replace(/\s+/g, " ");
    test.info().annotations.push({ type: "constat", description: `message lu par le Médiateur : « ${lu} »` });
    expect(await aucunNumero(page, []), "la page tient sa promesse : aucun numéro").toEqual([]);
    expect(lu, "ni l'adresse email").not.toContain("thomas.perso@exemple.fr");
    await expect(dernier, "la trace d'un partage de coordonnées reste lisible").toContainText(/\[numéro masqué\]/);
    await expect(dernier).toContainText(/\[adresse masquée\]/);
  });

  test("ADM-CNV-5 · une ouverture d'écran, une ligne de journal — les cinq lectures journalisées (ajoutée)", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(8 * 60_000);
    const sup = await navigateurAdmin("super");
    const ecrans: Array<{ action: string; chemin: string; cible: string; titre: RegExp }> = [
      { action: "CONVERSATION_VIEWED", chemin: `/conversations/${jeuEssai.deal("bzv-accepted").id}`, cible: jeuEssai.deal("bzv-accepted").id, titre: /^Conversation du deal$/ },
      { action: "USER_VIEWED", chemin: `/users/${jeuEssai.membre("pauline")}`, cible: jeuEssai.membre("pauline"), titre: /Pauline/ },
      { action: "DISPUTE_VIEWED", chemin: `/disputes/${jeuEssai.deal("bzv-disputed").id}`, cible: jeuEssai.deal("bzv-disputed").id, titre: /./ },
      { action: "DEAL_MONEY_VIEWED", chemin: `/deals/${jeuEssai.deal("bzv-completed").id}`, cible: jeuEssai.deal("bzv-completed").id, titre: /./ },
      { action: "TRIP_VIEWED", chemin: `/trips/${jeuEssai.trajet("bzv-upcoming")}`, cible: jeuEssai.trajet("bzv-upcoming"), titre: /./ },
    ];
    const debut = await debutDuScenario();
    for (const e of ecrans) {
      for (let i = 0; i < 3; i++) {
        await sup.page.goto(`${bo()}${e.chemin}`, { waitUntil: "domcontentloaded" });
        await attendreLeChargement(sup.page);
        await expect(sup.page.getByRole("heading", { level: 1, name: e.titre }).first(), `${e.chemin} affiché`).toBeVisible({ timeout: 60_000 });
        // Laisser à l'écran le temps de TOUTES ses lectures avant de repartir (sinon le décompte mesure la navigation).
        await sup.page.waitForLoadState("networkidle");
        await sup.page.waitForTimeout(12_000);
      }
    }
    await new Promise((r) => setTimeout(r, 3_000));
    const journal = await lireLeJournal(sup.contexte.request, { from: debut, adminUserId: jeuEssai.admin("super").id });
    const compte = ecrans.map((e) => ({ action: e.action, lignes: journal.filter((l) => l.action === e.action && (l.targetId === e.cible || (l.after as { bookingId?: string } | null)?.bookingId === e.cible)).length }));
    test.info().annotations.push({ type: "constat", description: `trois ouvertures espacées de 12 s par écran → ${compte.map((c) => `${c.action} ${c.lignes}`).join(" · ")}` });
    expect(compte.filter((c) => c.lignes !== 3), "trois ouvertures = trois lignes, sur chaque écran").toEqual([]);
  });
});
