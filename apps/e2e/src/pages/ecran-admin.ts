/**
 * ecran-admin.ts — outils communs aux chapitres du § 5 du cahier 02-ADMIN (un chapitre par écran)
 * ===============================================================================================
 * Ce que chaque écran du back-office demande de vérifier deux fois (§ 3.4) : ce que MONTRE l'écran, et ce que dit
 * le serveur (API de l'écran, journal, base). Les fonctions sont volontairement petites : chaque fiche garde lisible
 * CE QU'ELLE prouve.
 */
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { expect, type NavigateurAdmin } from "../fixtures/yamba";
import { adresseDuBackOffice } from "../fixtures/adresses";

type Page = NavigateurAdmin["page"];
const RACINE = join(__dirname, "../../../..");

/** Le motif des gestes de recette (≥ 20 caractères, au journal). */
export const MOTIF_DE_RECETTE = (fiche: string) => `Recette ${fiche} : geste de vérification du cahier 02-ADMIN, défait en fin de fiche.`;

/** Borne basse d'un scénario pour relire le journal : deux secondes de silence d'abord (piège payé au § 4.1). */
export async function debutDuScenario(): Promise<string> {
  await new Promise((r) => setTimeout(r, 2_000));
  return new Date().toISOString();
}

/** Ouvre un écran du back-office et rend le statut de chaque appel `/api/admin/*` qu'il a fait (hors `/admin/me`). */
export async function ouvrirEcran(page: Page, chemin: string): Promise<number[]> {
  const statuts: number[] = [];
  const ecoute = (r: { url(): string; status(): number }) => {
    if (/\/api\/admin\//.test(r.url()) && !r.url().includes("/admin/me")) statuts.push(r.status());
  };
  page.on("response", ecoute);
  await page.goto(`${adresseDuBackOffice()}${chemin}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(500);
  page.off("response", ecoute);
  return statuts;
}

/**
 * Une lecture (ou une manœuvre consignée) côté serveur : base via `packages/libs/prisma`, Redis, service. Le script
 * imprime sa réponse en JSON derrière « @@ ». Jamais utilisé pour FAIRE ce que l'écran doit faire.
 */
export function lireCoteServeur<T = unknown>(script: string): T {
  const sortie = execFileSync("npx", ["tsx", "--env-file=.env", "-e", script], { cwd: RACINE, encoding: "utf-8", timeout: 120_000 });
  const ligne = sortie.trim().split("\n").filter((l) => l.startsWith("@@")).pop() ?? "@@null";
  return JSON.parse(ligne.slice(2)) as T;
}

/** Les tuiles d'une section de l'accueil (« À traiter », « État de la plateforme ») : libellé → valeur et lien. */
export async function tuilesDeLaSection(page: Page, titre: string): Promise<Record<string, { valeur: number; lien: string; ambre: boolean }>> {
  const section = page.locator("section").filter({ has: page.getByRole("heading", { name: titre, exact: true }) });
  if ((await section.count()) === 0) return {};
  const liens = section.locator("a");
  const tuiles: Record<string, { valeur: number; lien: string; ambre: boolean }> = {};
  for (let i = 0; i < (await liens.count()); i++) {
    const lien = liens.nth(i);
    const [valeur, libelle] = (await lien.locator("p").allInnerTexts()).map((t) => t.trim());
    tuiles[libelle] = { valeur: Number(valeur), lien: (await lien.getAttribute("href")) ?? "", ambre: /amber/.test((await lien.getAttribute("class")) ?? "") };
  }
  return tuiles;
}

/** Attend que l'écran ait fini de charger (« Chargement… » disparu). */
export async function attendreLeChargement(page: Page): Promise<void> {
  await expect(page.getByText("Chargement…")).toHaveCount(0, { timeout: 60_000 });
}

/**
 * A169 (recette § 5.20) — l'échéance de la version du Voyageur est FIGÉE à l'ouverture du litige (`Dispute.responseDueAt`) :
 * changer `dispute.responseDelayHours` ne rend plus décidable un litige déjà ouvert. Les fiches qui ont besoin d'un litige
 * décidable « comme s'il avait été ouvert sous un délai de N heures » le posent explicitement : manœuvre base consignée,
 * sur les litiges ouverts sans version du Voyageur. Rend le nombre de dossiers réalignés.
 */
export function reouvrirLesLitigesSousUnDelai(heures: number): number {
  const n = lireCoteServeur<number>(`
    import prisma from "./packages/libs/prisma";
    (async () => {
      const ouverts = await prisma.dispute.findMany({ where: { status: "OPEN", OR: [{ resolvedAt: null }, { resolvedAt: { isSet: false } }] }, select: { id: true, bookingId: true } });
      const bookings = await prisma.booking.findMany({ where: { id: { in: ouverts.map((d) => d.bookingId) } }, select: { id: true, disputedAt: true } });
      let n = 0;
      for (const b of bookings) {
        if (!b.disputedAt) continue;
        await prisma.dispute.update({ where: { bookingId: b.id }, data: { responseDueAt: new Date(b.disputedAt.getTime() + ${heures} * 3_600_000) } });
        n++;
      }
      console.log("@@" + n);
      process.exit(0);
    })();`);
  process.stdout.write(`   ↳ manœuvre base (A169) : ${n} litige(s) ouvert(s) réaligné(s) sur un délai de ${heures} h\n`);
  return n;
}
