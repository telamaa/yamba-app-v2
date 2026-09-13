/**
 * journal-admin.ts — la seconde vérification du cahier 02-ADMIN : le journal d'audit
 * ==================================================================================
 * « Tout geste se vérifie deux fois : à l'écran et dans le journal » (cahier 02-ADMIN § 3.4, RG-ADM-06). Un écran
 * juste avec un journal muet est NON CONFORME. Le journal se lit ici par l'API que sert l'écran `/audit`
 * (`GET /admin/audit`, permission `audit.read`), avec une session super administrateur — jamais en base : la recette
 * prouve ce qu'un administrateur peut effectivement relire.
 *
 * Deux règles de lecture :
 *  - **on borne dans le temps** (`from`) : le journal n'est jamais purgé (RG-MNT-07), les exécutions précédentes y
 *    sont toutes ;
 *  - **on compare des ACTIONS dans l'ordre** : la liste revient du plus récent au plus ancien, on la retourne.
 */
import { expect, type APIRequestContext } from "@playwright/test";
import { adresseDeLApiAdmin } from "../fixtures/adresses";

export interface LigneDuJournal {
  id: string;
  at: string;
  admin: string;
  action: string;
  targetType: string;
  targetId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
}

export interface FiltreDuJournal {
  /** Borne basse (ISO) : le début du scénario. */
  from: string;
  adminUserId?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
}

/** Les lignes du journal, de la plus ANCIENNE à la plus récente, sur toutes les pages. */
export async function lireLeJournal(requete: APIRequestContext, filtre: FiltreDuJournal): Promise<LigneDuJournal[]> {
  const lignes: LigneDuJournal[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 20; page++) {
    const qs = new URLSearchParams(Object.entries({ ...filtre, ...(cursor ? { cursor } : {}) }).filter(([, v]) => v !== undefined) as Array<[string, string]>);
    const r = await requete.get(`${adresseDeLApiAdmin()}/admin/audit?${qs.toString()}`);
    expect(r.ok(), `GET /admin/audit?${qs.toString()} → ${r.status()}`).toBe(true);
    const corps = (await r.json()) as { items: LigneDuJournal[]; nextCursor: string | null };
    lignes.push(...corps.items);
    cursor = corps.nextCursor;
    if (!cursor) break;
  }
  return lignes.reverse();
}

/** Les seules ACTIONS, dans l'ordre chronologique — la forme la plus lisible d'un échec. */
export async function actionsDuJournal(requete: APIRequestContext, filtre: FiltreDuJournal): Promise<string[]> {
  return (await lireLeJournal(requete, filtre)).map((l) => l.action);
}

/** Une borne `from` sûre : une seconde avant maintenant (l'horloge du serveur et celle du harnais sont la même machine). */
export function maintenantMoinsUneSeconde(): string {
  return new Date(Date.now() - 1_000).toISOString();
}
