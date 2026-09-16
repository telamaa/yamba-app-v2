/**
 * adm-usr-utilisateurs.spec.ts — cahier 02-ADMIN, § 5.3 « Utilisateurs : recherche et fiche » (ADM-USR-1 à 3)
 * ===========================================================================================================
 * La recherche est le point d'entrée du support : un indice (email, nom, téléphone, deal, ticket) doit mener au bon
 * compte ET dire par quel indice il a été trouvé (« via … »). La fiche rassemble tout ce qu'un opérateur doit savoir,
 * sans jamais un secret. Chaque fiche compare l'écran à l'API de l'écran (`GET /admin/users`, `GET /admin/users/:id`),
 * à la base quand c'est la seule source (identifiant Stripe complet, compteurs), et au journal.
 *
 * USR-3 tranche réellement YAM-2041 (rejet) pour voir le TrustScore bouger : le Voyageur donne d'abord sa version (le
 * litige n'est décidable qu'à sa réponse ou après 72 h), puis le jeu d'essai est rejoué en fin de fiche.
 */
import { test, expect, type NavigateurAdmin } from "../fixtures/yamba";
import { JeuEssai } from "../fixtures/jeu-essai";
import { adresseDeLApi, adresseDeLApiAdmin, adresseDuBackOffice } from "../fixtures/adresses";
import { actionsDuJournal, lireLeJournal } from "../pages/journal-admin";
import { attendreLeChargement, debutDuScenario, lireCoteServeur } from "../pages/ecran-admin";

const api = () => adresseDeLApiAdmin();
const bo = () => adresseDuBackOffice();
type Page = NavigateurAdmin["page"];
type Ligne = { nom: string; via: string | null; email: string };

/** Tape un indice dans la recherche et rend les lignes affichées, une fois la réponse de CET indice arrivée. */
async function chercher(page: Page, indice: string): Promise<{ lignes: Ligne[]; compteur: string; api: { items: Array<{ id: string; matchedOn: string | null }>; total: number } }> {
  const champ = page.getByPlaceholder("email, nom, +33…, 64b…, YAM-2041");
  const reponse = page.waitForResponse((r) => r.url().includes("/admin/users?") && new URL(r.url()).searchParams.get("q") === indice, { timeout: 30_000 });
  await champ.fill(indice);
  const r = await reponse;
  const corps = (await r.json()) as { items: Array<{ id: string; matchedOn: string | null }>; total: number };
  await expect(page.getByText("Recherche…")).toHaveCount(0, { timeout: 30_000 });
  const lignes = await page.locator("table tbody tr").evaluateAll((trs) =>
    trs
      .filter((tr) => tr.querySelectorAll("td").length > 1)
      .map((tr) => {
        const td = tr.querySelectorAll("td");
        const nom = (td[0].querySelector("a")?.textContent ?? "").trim();
        const via = (td[0].querySelector("span")?.textContent ?? "").trim() || null;
        return { nom, via, email: (td[1].textContent ?? "").trim() };
      })
  );
  const compteur = (await page.locator("p", { hasText: /affiché\(s\) · \d+ au total$/ }).innerText()).trim();
  return { lignes, compteur, api: corps };
}

test.describe("ADM-USR — utilisateurs : recherche et fiche (cahier 02-ADMIN § 5.3)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(() => {
    new JeuEssai().rejouer();
  });
  test.afterAll(() => {
    /* USR-3 a tranché YAM-2041 : on rend le jeu d'essai aux chapitres suivants. */
    new JeuEssai().rejouer();
  });

  test("ADM-USR-1 · rechercher par tous les indices", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    const sup = await navigateurAdmin("support");
    const lecteur = await navigateurAdmin("finance");
    const { page } = sup;
    const debut = await debutDuScenario();
    /* 1. Sous-titre et placeholder. */
    await page.goto(`${bo()}/users`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Utilisateurs", exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Recherche par email, prénom, nom, téléphone, identifiant de deal ou ticket YAM.", { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder("email, nom, +33…, 64b…, YAM-2041")).toBeVisible();
    await expect(page.getByText(/^\d+ affiché\(s\) · \d+ au total$/)).toBeVisible({ timeout: 30_000 });

    const thomas = jeuEssai.membre("thomas");
    const aminata = jeuEssai.membre("aminata");
    const chinwe = jeuEssai.membre("chinwe");
    /* 2 à 4. Email, nom, téléphone : un résultat, et l'indice qui l'a trouvé. */
    const cas: Array<[string, string, string, string]> = [
      ["aminata.shipper@seed.yamba.dev", aminata, "Aminata Diallo", "via email"],
      ["Nkounkou", thomas, "Thomas Nkounkou", "via name"],
      ["+33612345601", thomas, "Thomas Nkounkou", "via phone"],
    ];
    const constats: string[] = [];
    for (const [indice, id, nom, via] of cas) {
      const r = await chercher(page, indice);
      expect(r.api.items.map((i) => i.id), `« ${indice} » : un résultat`).toEqual([id]);
      expect(r.lignes.map((l) => l.nom), `« ${indice} » : la ligne affichée`).toEqual([nom]);
      expect(r.lignes[0].via, `« ${indice} » : la mention`).toBe(via);
      expect(r.compteur).toBe("1 affiché(s) · 1 au total");
      constats.push(`${indice} → ${r.lignes[0].nom} ${r.lignes[0].via}`);
    }
    /* 5. Ticket : les DEUX parties. */
    const ticket = await chercher(page, "YAM-2041");
    expect(ticket.api.items.map((i) => i.id).sort(), "YAM-2041 : Expéditeur et Voyageur").toEqual([chinwe, thomas].sort());
    expect(ticket.lignes.map((l) => l.nom).sort()).toEqual(["Chinwe Eze", "Thomas Nkounkou"]);
    expect(ticket.lignes.every((l) => l.via === "via ticket"), "mention « via ticket »").toBe(true);
    expect(ticket.compteur).toBe("2 affiché(s) · 2 au total");
    /* 6. Identifiant Mongo du deal. */
    const dealId = jeuEssai.deal("bzv-disputed").id;
    const deal = await chercher(page, dealId);
    expect(deal.lignes.map((l) => l.nom).sort(), "identifiant de deal : les deux parties").toEqual(["Chinwe Eze", "Thomas Nkounkou"]);
    expect(deal.lignes.every((l) => l.via === "via dealId")).toBe(true);
    constats.push(`YAM-2041 → ${ticket.lignes.map((l) => l.nom).join(" + ")} ; ${dealId} → idem via dealId`);
    /* « Aucun autre filtre n'est appliqué » : un filtre posé ne retire pas les parties d'un ticket. */
    await page.locator("select").filter({ has: page.locator("option", { hasText: "tout état" }) }).selectOption("SUSPENDED");
    const avecFiltre = await chercher(page, "yam-2041");
    expect(avecFiltre.api.items.length, "ticket en minuscules + filtre « Suspendu » : les filtres sont ignorés").toBe(2);
    /* 7. « réinitialiser » n'apparaît qu'avec un filtre actif, et vide tout. */
    const reinit = page.getByRole("button", { name: "réinitialiser", exact: true });
    await expect(reinit).toBeVisible();
    await reinit.click();
    await expect(page.getByPlaceholder("email, nom, +33…, 64b…, YAM-2041")).toHaveValue("");
    await expect(page.locator("select").filter({ has: page.locator("option", { hasText: "tout état" }) })).toHaveValue("");
    await expect(reinit, "sans filtre, pas de bouton").toHaveCount(0);
    /* Le filtre seul : « Suspendu » sur un jeu d'essai sans compte suspendu. */
    await page.locator("select").filter({ has: page.locator("option", { hasText: "tout état" }) }).selectOption("SUSPENDED");
    await expect(page.getByText(/^0 affiché\(s\) · 0 au total$/).or(page.getByText(/^\d+ affiché\(s\) · \d+ au total$/))).toBeVisible({ timeout: 30_000 });
    await expect(reinit).toBeVisible();
    await reinit.click();
    await expect(reinit).toHaveCount(0);
    test.info().annotations.push({ type: "constat", description: constats.join(" · ") });
    /* Journal : une recherche n'écrit rien. */
    expect(await actionsDuJournal(lecteur.contexte.request, { from: debut, adminUserId: jeuEssai.admin("support").id }), "aucune ligne").toEqual([]);
  });

  test("ADM-USR-2 · ouvrir une fiche membre, et ce qu'elle montre", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    const med = await navigateurAdmin("mediateur");
    const lecteur = await navigateurAdmin("finance");
    const { page } = med;
    const thomas = jeuEssai.membre("thomas");
    const base = lireCoteServeur<{ stripe: string | null; charges: boolean; payouts: boolean; delivery: string[]; totp: boolean }>(`
      import prisma from "./packages/libs/prisma";
      (async () => {
        const u = await prisma.user.findUnique({ where: { id: "${thomas}" }, include: { carrierPage: true } });
        const b = await prisma.booking.findMany({ where: { OR: [{ shipperId: "${thomas}" }, { carrierId: "${thomas}" }], deliveryCodeEncrypted: { not: null } } as never, select: { deliveryCodeHash: true } as never });
        console.log("@@" + JSON.stringify({ stripe: u?.carrierPage?.stripeAccountId ?? null, charges: !!u?.carrierPage?.stripeChargesEnabled, payouts: !!u?.carrierPage?.stripePayoutsEnabled, delivery: (b as Array<{ deliveryCodeHash: string | null }>).map((x) => x.deliveryCodeHash).filter(Boolean), totp: !!(u as { totpSecretEncrypted?: string | null } | null)?.totpSecretEncrypted }));
        process.exit(0);
      })();`);
    const debut = await debutDuScenario();
    /* 1. Depuis /users. */
    await page.goto(`${bo()}/users`, { waitUntil: "domcontentloaded" });
    await chercher(page, "Nkounkou");
    const fiche = page.waitForResponse((r) => r.url().endsWith(`/admin/users/${thomas}`), { timeout: 60_000 });
    await page.getByRole("link", { name: "Thomas Nkounkou", exact: true }).click();
    const corpsApi = await (await fiche).text();
    await expect(page).toHaveURL(new RegExp(`/users/${thomas}$`));
    await attendreLeChargement(page);
    /* En-tête. */
    await expect(page.getByRole("heading", { name: "Thomas Nkounkou", level: 1 })).toBeVisible();
    await expect(page.getByText("thomas.carrier@seed.yamba.dev · +33612345601 · fr", { exact: true })).toBeVisible();
    await expect(page.locator("h1 ~ span", { hasText: /^Actif$/ })).toBeVisible();
    /* 2. Les cartes. */
    const carte = (titre: string | RegExp) => page.locator("section").filter({ has: page.getByRole("heading", { name: titre }) });
    const valeur = async (titre: string | RegExp, cle: string) => (await carte(titre).locator("div.flex", { has: page.locator("span", { hasText: new RegExp(`^${cle.replace(/[()]/g, "\\$&")}$`) }) }).first().locator("span").nth(1).innerText()).trim();
    for (const [cle, attendu] of [["Rôles client", /CARRIER/], ["Inscrit le", /\d{4}/], ["Sessions actives", /^\d+$/], ["Deals en cours", /^\d+$/]] as const) expect(await valeur("Compte", cle), `Compte › ${cle}`).toMatch(attendu);
    expect(await valeur("Voyageur", "Compte Stripe"), "Stripe masqué acct_…xxxx").toMatch(/^acct_…[A-Za-z0-9]{4}$/);
    expect(await valeur("Voyageur", "Encaissements / versements")).toBe(`${base.charges ? "oui" : "non"} / ${base.payouts ? "oui" : "non"}`);
    for (const cle of ["Niveau", "Avis révélés", "Deals terminés", "Annulations tardives", "Litiges perdus (interne)"]) {
      expect(await valeur("Voyageur", cle), `Voyageur › ${cle}`).toBeTruthy();
      expect(await valeur("Expéditeur", cle), `Expéditeur › ${cle}`).toBeTruthy();
    }
    /* 3. Risque interne. */
    const risque = carte("Risque interne (D29 ②) — invisible du membre");
    await expect(risque).toBeVisible();
    expect(await valeur("Risque interne (D29 ②) — invisible du membre", "Niveau")).toMatch(/^(Compte neuf|Standard|À surveiller|À risque) · score \d+\/100( ⚠)?$/);
    await expect(risque.getByText("Un score ne sanctionne rien : il éclaire une décision humaine (masquage, sanction) qui reste journalisée.", { exact: true })).toBeVisible();
    for (const cle of ["Plafonds CNF-06", "Ce mois"]) expect(await valeur("Risque interne (D29 ②) — invisible du membre", cle)).toBeTruthy();
    /* Trajets et deals. */
    await expect(carte(/^Trajets \(\d+\)$/)).toBeVisible();
    await expect(carte(/^Trajets \(\d+\)$/).getByRole("link", { name: "Ouvrir dans Trajets (fiches, masquage)" })).toHaveAttribute("href", `/trips?carrierId=${thomas}`);
    const deals = carte(/^Deals \(\d+\)$/);
    await expect(deals.getByRole("link", { name: "argent", exact: true }).first()).toBeVisible();
    await expect(deals.locator(`a[href="/disputes/${jeuEssai.deal("bzv-disputed").id}"]`), "« dossier » sur le deal en litige").toHaveText("dossier");
    const titres = await page.locator("section h2").allInnerTexts();
    test.info().annotations.push({ type: "constat", description: `cartes : ${titres.map((t) => t.trim()).join(" · ")}` });
    /* Jamais un secret — ni à l'écran, ni dans la réponse de l'API. */
    const ecran = await page.locator("main").innerText();
    for (const [nom, secret] of [["identifiant Stripe complet", base.stripe], ...base.delivery.map((h) => ["empreinte du code de livraison", h] as [string, string])] as Array<[string, string | null]>) {
      if (!secret) continue;
      expect(ecran.includes(secret), `écran : ${nom}`).toBe(false);
      expect(corpsApi.includes(secret), `API : ${nom}`).toBe(false);
    }
    for (const cle of ["password", "totpSecret", "deliveryCode", "backupCode", "refreshToken"]) expect(corpsApi, `API : aucune clé « ${cle} »`).not.toMatch(new RegExp(`"${cle}`, "i"));
    /* 4. Après rechargement : la consultation est déjà dans « Actions admin sur ce compte ». */
    await page.reload({ waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    const actions = carte("Actions admin sur ce compte");
    await expect(actions.locator("li").filter({ hasText: "Fiche consultée" }).first()).toBeVisible({ timeout: 30_000 });
    const premiere = (await actions.locator("li").first().innerText()).trim();
    test.info().annotations.push({ type: "constat", description: `première action listée : « ${premiere} »` });
    expect(premiere, "la consultation la plus récente en tête").toContain("Fiche consultée");
    /* Journal : USER_VIEWED USER · Thomas — deux ouvertures rapprochées, une ligne (A168). */
    const lignes = (await lireLeJournal(lecteur.contexte.request, { from: debut, adminUserId: jeuEssai.admin("mediateur").id })).map((l) => `${l.action} ${l.targetType} · ${l.targetId}`);
    /* Mesuré : DEUX lignes par ouverture — en développement, React (mode strict) monte deux fois l'effet qui charge la
       fiche, et chaque GET journalise. En production, une ouverture = un GET = une ligne. */
    expect(lignes.every((l) => l === `USER_VIEWED USER · ${thomas}`), `seules des USER_VIEWED sur Thomas (${lignes.join(", ")})`).toBe(true);
    // A168 (§ 5.18) — deux ouvertures à moins de 10 s (rechargement) = UNE lecture ; le double effet React ne compte plus.
    expect(lignes.length, "deux ouvertures rapprochées : une ligne (A168)").toBe(1);
    test.info().annotations.push({ type: "constat", description: `${lignes.length} USER_VIEWED pour 2 ouvertures rapprochées (A168)` });
  });

  test("ADM-USR-3 · le TrustScore reflète les faits", async ({ navigateurAdmin, navigateurConnecte, jeuEssai }) => {
    test.setTimeout(8 * 60_000);
    const sup = await navigateurAdmin("super");
    const med = await navigateurAdmin("mediateur");
    const lecteur = await navigateurAdmin("finance");
    type Fiche = { trust: { score: number; level: string; factors: Array<{ key: string; points: number }>; caps: { maxDeclaredValueCents: number; maxWeightKg: number; maxShipmentsPerMonth: number } | null }; shipper: { disputesLostCount: number } };
    const lire = async (id: string) => (await (await med.contexte.request.get(`${api()}/admin/users/${id}`)).json()) as Fiche;
    const debut = await debutDuScenario();
    /* 1. Un membre sans historique. Le cahier dit « un compte admin de recette créé aujourd'hui » : les comptes admin
          de recette datent du 11/06 (seed-admins les met à jour sans les recréer) — on prend le dernier compte neuf. */
    const neuf = lireCoteServeur<{ id: string; email: string; jours: number } | null>(`
      import prisma from "./packages/libs/prisma";
      (async () => {
        const u = await prisma.user.findFirst({ where: { isDeleted: false, createdAt: { gte: new Date(Date.now() - 7 * 86400000) }, shipperCompletedDealsCount: 0 }, orderBy: { createdAt: "desc" }, select: { id: true, email: true, createdAt: true } });
        console.log("@@" + JSON.stringify(u ? { id: u.id, email: u.email, jours: Math.floor((Date.now() - u.createdAt.getTime()) / 86400000) } : null)); process.exit(0);
      })();`);
    if (!neuf) test.skip(true, "aucun compte créé depuis 7 jours");
    test.info().annotations.push({ type: "écart documentaire", description: `aucun compte admin de recette « créé aujourd'hui » (tous du 11/06) ; compte neuf utilisé : ${neuf!.email} (${neuf!.jours} j)` });
    await med.page.goto(`${bo()}/users/${neuf!.id}`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(med.page);
    const risque = med.page.locator("section").filter({ has: med.page.getByRole("heading", { name: "Risque interne (D29 ②) — invisible du membre" }) });
    await expect(risque).toContainText(/Compte neuf · score \d+\/100/);
    await expect(risque).toContainText("300 € · 10 kg · 5 envois / mois (compte neuf)");
    /* 2. Chinwe avant. */
    const chinwe = jeuEssai.membre("chinwe");
    const a1 = await lire(chinwe);
    const a1bis = await lire(chinwe);
    expect(a1bis.trust, "calculé à la lecture : deux ouvertures, même valeur").toEqual(a1.trust);
    /* Jeu d'essai rejoué : aucun litige perdu (avant correction du seed, le compteur survivait aux rejeux : 2 puis 3). */
    expect(a1.shipper.disputesLostCount, "le rejeu remet les litiges perdus à zéro").toBe(0);
    /* 3. Trancher YAM-2041 par un rejet. Précondition : le Voyageur a répondu (sinon décidable dans 72 h). */
    const dealId = jeuEssai.deal("bzv-disputed").id;
    const thomas = await navigateurConnecte("thomas");
    const version = await thomas.contexte.request.post(`${adresseDeLApi()}/deals/${dealId}/dispute/statement`, { data: { statement: "Recette ADM-USR-3 : le colis a été remis intact au destinataire, photos de remise à l'appui dans le suivi.", photoUrls: [] }, failOnStatusCode: false });
    expect([201, 409], `version du Voyageur : ${version.status()} ${await version.text()}`).toContain(version.status());
    const decision = await med.contexte.request.post(`${api()}/admin/disputes/${dealId}/resolve`, { data: { outcome: "REJECTED", reason: "Recette ADM-USR-3 : rejet du litige YAM-2041, la remise est prouvée par le code et les photos du suivi." }, failOnStatusCode: false });
    expect(decision.ok(), `rejet de YAM-2041 : ${decision.status()} ${await decision.text()}`).toBe(true);
    const a2 = await lire(chinwe);
    expect(a2.shipper.disputesLostCount, "Litiges perdus (interne) : +1").toBe(a1.shipper.disputesLostCount + 1);
    const pointsLitiges = (f: Fiche) => f.trust.factors.find((x) => x.key === "disputesLost")?.points ?? 0;
    expect(pointsLitiges(a2) - pointsLitiges(a1), "+25 points (plafond 60)").toBe(Math.min(60, pointsLitiges(a1) + 25) - pointsLitiges(a1));
    /* Le score = somme des facteurs, bornée à 0..100 : un crédit négatif (deals terminés) masqué par le plancher 0
       absorbe une partie des 25 points (mesuré : 0 → 21 avec un deal terminé à −4). */
    const somme = (f: Fiche) => f.trust.factors.reduce((a, x) => a + x.points, 0);
    expect(a2.trust.score, "score = somme des facteurs bornée à 0..100").toBe(Math.min(100, Math.max(0, somme(a2))));
    // Recette § 5.18 — rejeter le litige TERMINE le deal : un deal terminé de plus pour Chinwe (−4, plafond −40). Ce
    // mouvement était masqué par un compteur de réputation rémanent du jeu d'essai, que le seed recalcule désormais.
    const pointsTermines = (f: Fiche) => f.trust.factors.find((x) => x.key === "completedDeals")?.points ?? 0;
    expect(pointsTermines(a2) - pointsTermines(a1), "le deal tranché compte comme terminé : −4 (plafond −40)").toBe(Math.max(-40, pointsTermines(a1) - 4) - pointsTermines(a1));
    expect(somme(a2) - somme(a1), "la somme des facteurs bouge exactement du litige perdu et du deal terminé").toBe(pointsLitiges(a2) - pointsLitiges(a1) + pointsTermines(a2) - pointsTermines(a1));
    if (a2.trust.score - a1.trust.score !== 25) test.info().annotations.push({ type: "écart documentaire", description: `le score passe de ${a1.trust.score} à ${a2.trust.score} (+${a2.trust.score - a1.trust.score}, pas +25) : facteurs avant ${JSON.stringify(a1.trust.factors.map((f) => [f.key, f.points]))} — le plancher 0 masquait un crédit` });
    await sup.page.goto(`${bo()}/users/${chinwe}`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(sup.page);
    const exp = sup.page.locator("section").filter({ has: sup.page.getByRole("heading", { name: "Expéditeur", exact: true }) });
    await expect(exp.locator("div.flex", { hasText: "Litiges perdus (interne)" })).toContainText(String(a2.shipper.disputesLostCount));
    await expect(sup.page.locator("section").filter({ has: sup.page.getByRole("heading", { name: "Risque interne (D29 ②) — invisible du membre" }) })).toContainText(`score ${a2.trust.score}/100`);
    test.info().annotations.push({ type: "constat", description: `Chinwe : ${a1.trust.level} ${a1.trust.score} → ${a2.trust.level} ${a2.trust.score} ; litiges perdus ${a1.shipper.disputesLostCount} → ${a2.shipper.disputesLostCount}` });
    /* Journal : USER_VIEWED à chaque ouverture ; le calcul n'écrit rien d'autre sur ces comptes. */
    const lignes = await lireLeJournal(lecteur.contexte.request, { from: debut });
    const surChinwe = lignes.filter((l) => l.targetId === chinwe).map((l) => l.action);
    expect(surChinwe.every((a) => a === "USER_VIEWED"), `seules des USER_VIEWED sur Chinwe (${surChinwe.join(", ")})`).toBe(true);
    // A168 (§ 5.18) — lectures coalescées par admin sur 10 s : le Médiateur a lu trois fois par l'API (dont deux coup sur
    // coup), le super administrateur une fois à l'écran.
    const vuesDe = async (adminId: string) => (await lireLeJournal(lecteur.contexte.request, { from: debut, adminUserId: adminId })).filter((l) => l.targetId === chinwe && l.action === "USER_VIEWED");
    const med3 = await vuesDe(jeuEssai.admin("mediateur").id);
    const sup1 = await vuesDe(jeuEssai.admin("super").id);
    test.info().annotations.push({ type: "constat", description: `USER_VIEWED sur Chinwe : Médiateur ${med3.length} (3 lectures API), super administrateur ${sup1.length} (1 écran)` });
    expect(sup1.length, "une ouverture d'écran : une ligne").toBe(1);
    expect(med3.length, "trois lectures API dont deux rapprochées : entre 1 et 3 lignes").toBeGreaterThanOrEqual(1);
    expect(med3.length).toBeLessThanOrEqual(3);
    const dates = med3.map((l) => new Date(l.at).getTime()).sort((x, y) => x - y);
    for (let i = 1; i < dates.length; i++) expect(dates[i] - dates[i - 1], "deux lignes du même admin sont espacées d'au moins 10 s").toBeGreaterThanOrEqual(9_500);
  });
});
