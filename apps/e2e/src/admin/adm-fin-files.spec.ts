/**
 * adm-fin-files.spec.ts — cahier 02-ADMIN, § 5.11 « Finances : les files d'exception » (ADM-FIN-1 à 5)
 * =====================================================================================================
 * `/finances` montre ce qui n'a pas suivi son cours : versements en échec, transferts renversés, retenues à arbitrer,
 * remboursements proposés. Chaque ligne se prouve deux fois : **l'écran = l'API de l'écran**
 * (`GET /admin/finances/queue?kind=…`), et **l'API = la base** (compteurs de l'accueil, jeu d'essai).
 *
 * Les gestes d'argent de ces files (Relancer, Décider, Arbitrer) ont leurs propres chapitres (§ 5.14, 5.15, 5.10) : ici,
 * on prouve que chaque ligne est là, juste, et qu'elle mène au bon écran. Les manœuvres (motif du fournisseur, proposition
 * de remboursement) sont défaites en rejouant le jeu d'essai.
 */
import { test, expect, type NavigateurAdmin } from "../fixtures/yamba";
import { JeuEssai } from "../fixtures/jeu-essai";
import { adresseDeLApi, adresseDeLApiAdmin, adresseDuBackOffice } from "../fixtures/adresses";
import { lireLeJournal } from "../pages/journal-admin";
import { attendreLeChargement, debutDuScenario, lireCoteServeur, MOTIF_DE_RECETTE, tuilesDeLaSection } from "../pages/ecran-admin";

const api = () => adresseDeLApiAdmin();
const bo = () => adresseDuBackOffice();

type Page = NavigateurAdmin["page"];
type Kind = "FAILED" | "REVERSED" | "HELD" | "PROPOSED_REFUNDS";
type Item = {
  bookingId: string; status: string; corridor: { originCity: string; destinationCity: string };
  shipper: { id: string; firstName: string }; carrier: { id: string; firstName: string; stripeReady: boolean | null };
  amountCents: number; currencyCode: string; payoutAttempts: number; payoutFailureKind: string | null; payoutFailureDetail: string | null;
  nextRetryAt: string | null; since: string;
};
type Queue = { kind: Kind; items: Item[]; generatedAt: string; counts?: Record<Kind, number> };

const ONGLETS: Array<{ kind: Kind; libelle: string; indice: string }> = [
  { kind: "FAILED", libelle: "Versements en échec", indice: "Le cron rejoue seul (5 min, puis 30 min, 2 h, 1 jour). « Relancer » n'attend pas l'échéance." },
  { kind: "REVERSED", libelle: "Transferts renversés", indice: "Stripe a renvoyé l'argent à la plateforme. Rien ne repart sans décision : re-verser ou abandonner, avec motif." },
  { kind: "HELD", libelle: "Retenues à arbitrer", indice: "Annulation après le départ sans prise en charge : la retenue attend la médiation." },
  { kind: "PROPOSED_REFUNDS", libelle: "Remboursements proposés", indice: "Gestes commerciaux proposés par Finance ou Support : seul un super administrateur applique, avec le motif." },
];

const espaces = (s: string) => s.replace(/[\s  ]+/g, " ").trim();
const euros = (cents: number, devise: string) => espaces(new Intl.NumberFormat("fr-FR", { style: "currency", currency: devise }).format(cents / 100));

async function file(nav: NavigateurAdmin, kind: string): Promise<Queue> {
  const r = await nav.contexte.request.get(`${api()}/admin/finances/queue?kind=${kind}`);
  expect(r.ok(), `GET /admin/finances/queue?kind=${kind}`).toBe(true);
  return (await r.json()) as Queue;
}

const bouton = (page: Page, libelle: string) => page.getByRole("button", { name: libelle, exact: true });
const lignes = (page: Page) => page.locator("table tbody tr");

test.describe("ADM-FIN — les files d'exception (cahier 02-ADMIN § 5.11)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(() => {
    new JeuEssai().rejouer();
  });

  test("ADM-FIN-1 · les quatre onglets et leur contenu", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(8 * 60_000);
    const fin = await navigateurAdmin("finance");
    const sup = await navigateurAdmin("super");
    const debut = await debutDuScenario();
    const { page } = fin;
    /* 1. Le sous-titre. */
    await page.goto(`${bo()}/finances`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Finances", exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Ce qui n'a pas suivi son cours : versements en échec, transferts renversés, retenues à arbitrer, remboursements proposés. Chaque montant vient du deal, rien n'est recalculé. Le rapport mensuel et son export s'ouvrent à droite des onglets.", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Rapport mensuel et export →" })).toHaveAttribute("href", "/finances/report");
    await attendreLeChargement(page);

    const constats: string[] = [];
    /* 2 et 4. Chaque onglet : indice, lignes = API, colonnes, état, action. */
    for (const o of ONGLETS) {
      await bouton(page, o.libelle).click();
      await expect(page, "l'onglet s'écrit dans l'adresse (partageable, survit au rechargement)").toHaveURL(new RegExp(`/finances\\?kind=${o.kind}$`));
      await expect(bouton(page, o.libelle)).toHaveClass(/bg-slate-900/);
      await expect(page.getByText(o.indice, { exact: true })).toBeVisible();
      await attendreLeChargement(page);
      const q = await file(fin, o.kind);
      /* Le compteur de l'onglet = la file entière servie par l'API. */
      expect(q.counts, "l'API sert le compte de chaque file").toBeTruthy();
      await expect(bouton(page, o.libelle).locator("[data-count]"), `compteur « ${o.libelle} »`).toHaveText(String(q.counts![o.kind]));
      if (q.items.length === 0) {
        await expect(page.getByText("Rien à traiter.", { exact: true })).toBeVisible();
        constats.push(`${o.kind} : vide`);
      } else {
        await expect(page.locator("table thead th")).toHaveText(["Deal", "Parties", "Montant", "État", "Depuis", ""]);
        await expect(lignes(page)).toHaveCount(q.items.length);
        for (const [i, it] of q.items.entries()) {
          const tr = lignes(page).nth(i);
          const cellules = tr.locator("td");
          await expect(cellules.nth(0).getByRole("link", { name: `${it.corridor.originCity} → ${it.corridor.destinationCity}` })).toHaveAttribute("href", `/deals/${it.bookingId}`);
          /* Le statut du deal en français (amélioration), jamais le code. */
          await expect(cellules.nth(0)).not.toContainText(it.status);
          await expect(cellules.nth(1).getByRole("link", { name: it.shipper.firstName })).toHaveAttribute("href", `/users/${it.shipper.id}`);
          await expect(cellules.nth(1).getByRole("link", { name: it.carrier.firstName })).toHaveAttribute("href", `/users/${it.carrier.id}`);
          expect(espaces(await cellules.nth(2).innerText()), "montant = API").toBe(euros(it.amountCents, it.currencyCode));
          const etat = espaces(await cellules.nth(3).innerText());
          const action = cellules.nth(5);
          if (o.kind === "FAILED") {
            expect(etat).toContain(it.payoutFailureKind === "ACCOUNT_NOT_READY" ? "compte Stripe du Voyageur non prêt" : "refus du fournisseur");
            expect(etat).toContain(`${it.payoutAttempts} tentative(s) · prochaine`);
            /* Le badge dit l'état ACTUEL du compte ; si le compte est prêt depuis l'échec, l'écran le dit (amélioration). */
            await expect(cellules.nth(1).getByText("Stripe non prêt", { exact: true })).toHaveCount(it.carrier.stripeReady === false ? 1 : 0);
            if (it.payoutFailureKind === "ACCOUNT_NOT_READY" && it.carrier.stripeReady) await expect(cellules.nth(3)).toContainText("Le compte est prêt depuis : « Relancer » peut aboutir.");
            await expect(cellules.nth(4)).toContainText("fin du deal");
            await expect(action.getByRole("button", { name: "Relancer" })).toBeVisible();
          } else if (o.kind === "REVERSED") {
            expect(etat).toContain("transfert renversé par Stripe");
            await expect(cellules.nth(4)).toContainText("fin du deal");
            await expect(action.getByRole("link", { name: "Décider" })).toHaveAttribute("href", `/deals/${it.bookingId}`);
          } else if (o.kind === "HELD") {
            expect(etat).toBe("retenue conservée");
            await expect(cellules.nth(4)).toContainText("annulé le");
            await expect(action.getByRole("link", { name: "Arbitrer" })).toHaveAttribute("href", `/disputes/${it.bookingId}`);
          } else {
            expect(etat).toBe("remboursement proposé");
            await expect(cellules.nth(4)).toContainText("proposé le");
            await expect(action.getByRole("link", { name: "Décider" })).toHaveAttribute("href", `/deals/${it.bookingId}`);
          }
          constats.push(`${o.kind} : ${it.corridor.originCity} → ${it.corridor.destinationCity}, ${euros(it.amountCents, it.currencyCode)}, « ${etat} »`);
        }
      }
      /* 5. Le pied. */
      await expect(page.getByText(new RegExp(`^${q.items.length} ligne\\(s\\) · calculé le .+\\.$`))).toBeVisible();
    }
    test.info().annotations.push({ type: "constat", description: constats.join(" ; ") });

    /* Le jeu d'essai : 1 · 1 · 1 · 0 (cahier). */
    const [failed, reversed, held, proposed] = await Promise.all(ONGLETS.map((o) => file(fin, o.kind)));
    expect([failed.items.length, reversed.items.length, held.items.length, proposed.items.length], "jeu d'essai : 1 · 1 · 1 · 0").toEqual([1, 1, 1, 0]);
    expect(failed.items[0].corridor).toMatchObject({ originCity: "Paris", destinationCity: "Brazzaville" });
    expect(failed.items[0].payoutAttempts).toBe(4);
    if (failed.items[0].carrier.stripeReady) test.info().annotations.push({ type: "écart documentaire", description: "le badge « Stripe non prêt » est absent : le compte de Thomas est prêt dans le jeu d'essai (le motif de l'échec, lui, reste « compte non prêt ») — l'écran le signale désormais" });

    /* 3. Les valeurs d'URL, dont une inconnue. */
    for (const [valeur, attendu] of [["REVERSED", "Transferts renversés"], ["HELD", "Retenues à arbitrer"], ["PROPOSED_REFUNDS", "Remboursements proposés"], ["NIMPORTEQUOI", "Versements en échec"]] as const) {
      await page.goto(`${bo()}/finances?kind=${valeur}`, { waitUntil: "domcontentloaded" });
      await expect(bouton(page, attendu), `?kind=${valeur} → « ${attendu} »`).toHaveClass(/bg-slate-900/, { timeout: 60_000 });
    }
    /* L'onglet survit au rechargement. */
    await page.goto(`${bo()}/finances`, { waitUntil: "domcontentloaded" });
    await bouton(page, "Retenues à arbitrer").click();
    await expect(page).toHaveURL(/\/finances\?kind=HELD$/);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(bouton(page, "Retenues à arbitrer")).toHaveClass(/bg-slate-900/, { timeout: 60_000 });

    /* Le Médiateur lit aussi les files (précondition du cahier). */
    const med = await navigateurAdmin("mediateur");
    await med.page.goto(`${bo()}/finances`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(med.page);
    await expect(lignes(med.page)).toHaveCount(1, { timeout: 60_000 });

    /* Journal : lire les files n'écrit rien. */
    const ecrites = await lireLeJournal(sup.contexte.request, { from: debut, adminUserId: jeuEssai.admin("finance").id });
    expect(ecrites.map((l) => l.action), "aucune ligne").toEqual([]);
  });

  test("ADM-FIN-2 · le Support ne voit pas les finances", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(5 * 60_000);
    const support = await navigateurAdmin("support");
    const sup = await navigateurAdmin("super");
    const debut = await debutDuScenario();
    const { page, contexte } = support;
    await page.goto(`${bo()}/home`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("aside nav a").first()).toBeVisible({ timeout: 60_000 });
    await expect(page.locator("aside nav a", { hasText: /^Finances$/ }), "pas d'entrée « Finances »").toHaveCount(0);
    const kpis = (await (await contexte.request.get(`${api()}/admin/kpis`)).json()) as Record<string, unknown>;
    for (const cle of ["payoutsFailed", "payoutsReversed", "manualRefundProposals"]) expect(kpis[cle], `tuile ${cle} non calculée`).toBeNull();
    await attendreLeChargement(page);
    const tuiles = { ...(await tuilesDeLaSection(page, "À traiter")), ...(await tuilesDeLaSection(page, "État de la plateforme")) };
    for (const libelle of ["Versements en échec", "Transferts renversés", "Remboursements proposés"]) expect(Object.keys(tuiles), `tuile « ${libelle} » absente`).not.toContain(libelle);
    /* Constaté au premier passage : le Support (kpi.read) lit l'alerte « Versements en échec… » ; sa carte l'envoyait
       vers /finances, qui lui répond 403. L'alerte reste lisible, sans lien, avec le profil à qui la transmettre. */
    await page.goto(`${bo()}/alerts`, { waitUntil: "domcontentloaded" });
    await attendreLeChargement(page);
    const carte = page.locator("li").filter({ hasText: "PAYOUT_FAILED_48H" });
    await expect(carte, "le jeu d'essai sert l'alerte de versement").toHaveCount(1, { timeout: 60_000 });
    await expect(carte.locator("a"), "aucun lien vers un écran refusé").toHaveCount(0);
    await expect(carte).toContainText("Ton profil n'ouvre pas cette file : transmets à Finance ou Médiateur.");
    /* L'écran ouvert par l'URL : un refus qui se lit en français (amélioration). */
    await page.goto(`${bo()}/finances`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Ton profil ne donne pas accès aux finances.", { exact: true })).toBeVisible({ timeout: 60_000 });
    /* L'appel direct : la route réelle refuse en 403, permission nommée. */
    const r = await contexte.request.get(`${api()}/admin/finances/queue?kind=FAILED`, { failOnStatusCode: false });
    expect(r.status(), "GET /admin/finances/queue").toBe(403);
    expect(((await r.json()) as { details?: { code?: string; permission?: string } }).details).toMatchObject({ code: "ADMIN_PERMISSION_DENIED", permission: "finances.read" });
    /* Le chemin écrit dans le cahier n'existe pas : 404 JSON, jamais la page HTML d'Express (ANO-ADM-27). */
    const cahier = await contexte.request.get(`${api()}/admin/finances`, { failOnStatusCode: false });
    expect(cahier.status()).toBe(404);
    expect(cahier.headers()["content-type"] ?? "", "une API répond en JSON").toContain("application/json");
    expect(((await cahier.json()) as { details?: { code?: string } }).details?.code).toBe("ROUTE_NOT_FOUND");
    test.info().annotations.push({ type: "écart documentaire", description: "le cahier fait appeler /api/admin/finances, qui n'existe pas (404 ROUTE_NOT_FOUND) ; la garde se prouve sur /api/admin/finances/queue (403)" });
    expect((await lireLeJournal(sup.contexte.request, { from: debut, adminUserId: jeuEssai.admin("support").id })).map((l) => l.action), "aucune ligne").toEqual([]);
  });

  test("ADM-FIN-3 · le message brut du fournisseur reste à l'admin", async ({ navigateurAdmin, navigateurConnecte, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    const id = jeuEssai.deal("bzv-completed-blocked").id;
    const secret = "No such destination: 'acct_1RecetteSecret42'";
    try {
      /* Manœuvre consignée : l'échec devient un refus du fournisseur, avec un message qui ne doit jamais sortir de l'admin. */
      lireCoteServeur(`
        import prisma from "./packages/libs/prisma";
        (async () => { await prisma.booking.update({ where: { id: ${JSON.stringify(id)} }, data: { payoutFailureReason: ${JSON.stringify(`PROVIDER_ERROR:${secret}`)} } }); console.log("@@true"); process.exit(0); })();`);
      process.stdout.write(`   ↳ manœuvre base : payoutFailureReason = PROVIDER_ERROR:… sur ${id} (ADM-FIN-3)\n`);
      const fin = await navigateurAdmin("finance");
      await fin.page.goto(`${bo()}/finances?kind=FAILED`, { waitUntil: "domcontentloaded" });
      await attendreLeChargement(fin.page);
      const etat = lignes(fin.page).first().locator("td").nth(3);
      await expect(etat).toContainText("refus du fournisseur", { timeout: 60_000 });
      await expect(etat.locator(".font-mono"), "le message brut, en chasse fixe, pour l'admin").toHaveText(secret);
      await expect(etat, "pas d'indice « compte prêt » sur un refus du fournisseur").not.toContainText("Le compte est prêt depuis");
      /* Les deux parties : ni le message, ni le code interne. */
      for (const cle of ["thomas", "aminata"] as const) {
        const { contexte } = await navigateurConnecte(cle);
        for (const chemin of [`/deals/${id}`, "/me/wallet"]) {
          const r = await contexte.request.get(`${adresseDeLApi()}${chemin}`, { failOnStatusCode: false });
          const corps = await r.text();
          expect(r.status(), `${cle} GET ${chemin}`).toBeLessThan(500);
          expect(corps, `${cle} ${chemin} : jamais le message du fournisseur`).not.toContain("acct_1RecetteSecret42");
          expect(corps, `${cle} ${chemin} : jamais le motif interne`).not.toContain("PROVIDER_ERROR");
        }
      }
    } finally {
      new JeuEssai().rejouer();
    }
  });

  test("ADM-FIN-4 · les tuiles de l'accueil et les files disent le même nombre", async ({ navigateurAdmin, jeuEssai }) => {
    test.setTimeout(6 * 60_000);
    const fin = await navigateurAdmin("finance");
    const sup = await navigateurAdmin("super");
    const kpis = async () => (await (await fin.contexte.request.get(`${api()}/admin/kpis`)).json()) as Record<string, number>;
    const comparer = async (etape: string) => {
      const [k, failed, reversed, held, proposed] = await Promise.all([kpis(), file(fin, "FAILED"), file(fin, "REVERSED"), file(fin, "HELD"), file(fin, "PROPOSED_REFUNDS")]);
      expect({ failed: k.payoutsFailed, reversed: k.payoutsReversed, held: k.retentionsHeld, proposed: k.manualRefundProposals }, `${etape} : tuiles = files`).toEqual({
        failed: failed.counts!.FAILED, reversed: reversed.counts!.REVERSED, held: held.counts!.HELD, proposed: proposed.counts!.PROPOSED_REFUNDS,
      });
      expect(failed.counts, `${etape} : le compte ne dépend pas de l'onglet lu`).toEqual(held.counts);
      return proposed;
    };
    await comparer("jeu d'essai");
    const deal = jeuEssai.deal("bzv-completed").id;
    try {
      /* Une proposition de remboursement (Finance) entre dans la file et dans la tuile. */
      const debut = await debutDuScenario();
      const r = await fin.contexte.request.post(`${api()}/admin/deals/${deal}/refund/propose`, { data: { amountCents: 150, reason: MOTIF_DE_RECETTE("ADM-FIN-4") }, failOnStatusCode: false });
      expect(r.ok(), `proposition : ${r.status()} ${r.ok() ? "" : await r.text()}`).toBe(true);
      const proposed = await comparer("après la proposition");
      expect(proposed.items.map((i) => i.bookingId)).toEqual([deal]);
      await fin.page.goto(`${bo()}/finances?kind=PROPOSED_REFUNDS`, { waitUntil: "domcontentloaded" });
      await attendreLeChargement(fin.page);
      const tr = lignes(fin.page).first();
      await expect(tr).toBeVisible({ timeout: 60_000 });
      expect(espaces(await tr.locator("td").nth(2).innerText()), "montant proposé").toBe(euros(150, "EUR"));
      await expect(tr.locator("td").nth(3)).toHaveText("remboursement proposé");
      await expect(tr.locator("td").nth(4)).toContainText("proposé le");
      await expect(tr.getByRole("link", { name: "Décider" })).toHaveAttribute("href", `/deals/${deal}`);
      const ligne = (await lireLeJournal(sup.contexte.request, { from: debut, adminUserId: jeuEssai.admin("finance").id })).find((l) => l.action === "REFUND_MANUAL_PROPOSED");
      expect(ligne && `${ligne.targetType} · ${ligne.targetId}`).toBe(`BOOKING · ${deal}`);
    } finally {
      new JeuEssai().rejouer();
    }
    await comparer("après rejeu du jeu d'essai");
  });

  test("ADM-FIN-5 · une erreur de l'API reste une erreur de l'API", async ({ navigateurAdmin }) => {
    test.setTimeout(3 * 60_000);
    const fin = await navigateurAdmin("finance");
    /* Un onglet inconnu : 400 avec un code (tout refus métier porte un code). */
    const r = await fin.contexte.request.get(`${api()}/admin/finances/queue?kind=NIMPORTEQUOI`, { failOnStatusCode: false });
    expect(r.status()).toBe(400);
    expect(((await r.json()) as { details?: { code?: string } }).details?.code).toBe("INVALID_QUEUE_KIND");
    /* Une route inconnue, service par service : 404 JSON `ROUTE_NOT_FOUND`, sans la page HTML d'Express qui nomme le framework (ANO-ADM-27). */
    const chemins = [`${api()}/nexistepas-recette`, `${api()}/admin/finances`, `${api()}/trips/nexistepas-recette/zz/yy`, `${api()}/me/notifications/nexistepas/zz`, `${api()}/messages/nexistepas/zz/yy`];
    const vus: string[] = [];
    for (const url of chemins) {
      const rep = await fin.contexte.request.get(url, { failOnStatusCode: false });
      const corps = await rep.text();
      vus.push(`${url.replace(api(), "")} → ${rep.status()}`);
      expect(corps, `${url} : pas de page HTML`).not.toMatch(/<!DOCTYPE html>|Cannot GET/i);
      expect(rep.headers()["content-type"] ?? "", `${url} : JSON`).toContain("application/json");
    }
    for (const port of [6001, 6002, 6003, 6004, 6005]) {
      const rep = await fin.contexte.request.get(`http://localhost:${port}/nexistepas-recette`, { failOnStatusCode: false });
      expect(rep.status(), `:${port} route inconnue`).toBe(404);
      expect(((await rep.json()) as { details?: { code?: string } }).details?.code, `:${port}`).toBe("ROUTE_NOT_FOUND");
    }
    test.info().annotations.push({ type: "constat", description: vus.join(" · ") });
  });
});
