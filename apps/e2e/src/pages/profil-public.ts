/**
 * profil-public.ts — la page publique d'un membre (`/u/[slug]`, cahier 01-WEB, chapitre 5.27)
 * ==========================================================================================
 * Ce que n'importe qui lit d'un Voyageur : ses badges, et une **ligne de faits** calculée par le
 * serveur (D29 ①) — « n Deals terminés · ★ x sur n avis · n annulations tardives ». La ligne est
 * un fait de réputation : un parcours la relit AVANT et APRÈS un geste pour prouver qu'il l'a
 * changée, ou qu'il ne l'a pas changée (le refus au pickup, WEB-E2E-5).
 */
import { expect, type BrowserContext, type Page } from "@playwright/test";
import { adresseDeLApi } from "../fixtures/adresses";
import { normaliserEspaces } from "./reservation";

export class ProfilPublic {
  constructor(private readonly page: Page) {}

  /** Le `publicSlug` du membre connecté dans ce contexte, lu à `/auth/me`. */
  static async slugDuMembre(contexte: BrowserContext): Promise<string> {
    const r = await contexte.request.get(`${adresseDeLApi()}/auth/me`);
    if (!r.ok()) throw new Error(`/auth/me : ${r.status()} ${await r.text()}`);
    const { user } = (await r.json()) as { user: { publicSlug?: string | null } };
    if (!user.publicSlug) throw new Error("Ce membre n'a pas de publicSlug : rejoue le seed (piège 12).");
    return user.publicSlug;
  }

  /** Ouvre la page publique et rend la ligne de faits, espaces normalisées. */
  async ligneDeFaits(slug: string): Promise<string> {
    await this.page.goto(`/fr/u/${slug}`, { waitUntil: "networkidle" });
    const faits = this.page.getByText(/annulations? tardives?/).first();
    await expect(faits).toBeVisible({ timeout: 60_000 });
    return normaliserEspaces(await faits.innerText());
  }

  /** « 0 annulation tardive » → 0 ; « 2 annulations tardives » → 2. */
  static annulationsTardives(ligne: string): number {
    const m = ligne.match(/(\d+) annulations? tardives?/);
    if (!m) throw new Error(`Aucun compte d'annulations tardives dans « ${ligne} »`);
    return Number(m[1]);
  }
}
