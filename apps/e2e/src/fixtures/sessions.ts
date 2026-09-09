/**
 * sessions.ts — la mémoire des sessions du harnais (`storageState`)
 * ==================================================================
 * Chaque navigateur du harnais ouvrait une **vraie session par l'écran de connexion**. C'était un
 * choix délibéré — éprouver la porte d'entrée à chaque parcours — mais il a un coût que la
 * passerelle finit par refuser : à deux ou trois connexions par scénario et plusieurs exécutions
 * par heure, le limiteur de débit (100 requêtes anonymes par quart d'heure et par adresse,
 * `packages/middleware/rate-limit-tier.ts`) répond **429** sur `POST /auth/login`, et le parcours
 * échoue sur un symptôme trompeur : « la page reste sur /login ». Mesuré le 09/09/2026.
 *
 * D'où cette mémoire : **une connexion par compte**, puis les cookies enregistrés repartent d'un
 * contexte à l'autre — et d'une exécution à l'autre, puisqu'ils sont écrits sur le disque
 * (`apps/e2e/.sessions/`, jamais versionné). Un scénario garde la connexion par l'écran
 * (`harnais.spec.ts`) pour ne pas perdre la vérification de la porte.
 *
 * Deux règles, imposées par le serveur :
 *
 * 1. **Le rafraîchissement fait une rotation.** `POST /auth/refresh` révoque l'ancien `jti` et
 *    `isAuthenticated` vérifie ce `jti` dans Redis à chaque requête : un contexte qui rafraîchit
 *    invalide les cookies de tout autre contexte ouvert sur le même compte. Un contexte qui se
 *    ferme **rend** donc son état à la mémoire (les cookies les plus récents gagnent), et deux
 *    contextes simultanés sur un même compte restent à éviter dans un scénario.
 * 2. **Un état enregistré peut être mort** (inactivité, révocation par un scénario, suspension
 *    par un administrateur). Il est **sondé** avant d'être réutilisé ; s'il ne répond plus, on
 *    repasse par l'écran, et la mémoire est remplacée.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { BrowserContext } from "@playwright/test";

/** Le type que Playwright rend par `context.storageState()` et accepte en `storageState`. */
export type EtatDeSession = Awaited<ReturnType<BrowserContext["storageState"]>>;

const DOSSIER = join(__dirname, "../../.sessions");

function chemin(cle: string): string {
  return join(DOSSIER, `${cle.replace(/[^a-z0-9_-]/gi, "_")}.json`);
}

/** L'état mémorisé pour un compte, ou `null` s'il n'y en a pas (ou s'il est illisible). */
export function lireSession(cle: string): EtatDeSession | null {
  const f = chemin(cle);
  if (!existsSync(f)) return null;
  try {
    return JSON.parse(readFileSync(f, "utf-8")) as EtatDeSession;
  } catch {
    rmSync(f, { force: true });
    return null;
  }
}

export function ecrireSession(cle: string, etat: EtatDeSession): void {
  mkdirSync(DOSSIER, { recursive: true });
  writeFileSync(chemin(cle), JSON.stringify(etat, null, 2));
}

export function oublierSession(cle: string): void {
  rmSync(chemin(cle), { force: true });
}

/** Oublie toutes les sessions mémorisées dont la clé commence par `prefixe` (ex. `admin-`). */
export function oublierSessions(prefixe: string): void {
  if (!existsSync(DOSSIER)) return;
  for (const f of readdirSync(DOSSIER)) {
    if (f.startsWith(prefixe)) rmSync(join(DOSSIER, f), { force: true });
  }
}

/** Le cookie de session porté par un état, s'il y est. */
export function cookieDe(etat: EtatDeSession | null, nom: string): string | null {
  return etat?.cookies.find((c) => c.name === nom)?.value ?? null;
}
