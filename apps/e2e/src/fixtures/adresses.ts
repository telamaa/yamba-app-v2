/**
 * adresses.ts — où sont le front, l'API et le back-office sur ce poste
 * ====================================================================
 * Trois adresses, et une seule source : la configuration du front (`NEXT_PUBLIC_API_BASE_URL`).
 * C'est un piège que le projet a déjà payé (CLAUDE.md, § LAN) : les cookies de session sont
 * **liés à l'hôte**. Si le front est ouvert sur `localhost:3000` alors que l'API est déclarée
 * sur `http://192.168.1.155:8080/api`, la connexion répond 200 et **aucun cookie** n'est posé —
 * tout le reste du parcours échoue, sans que rien n'explique pourquoi. Mesuré tel quel au
 * montage du harnais.
 *
 * Le harnais lit donc la configuration du front et en déduit tout le reste :
 *
 *   - base d'API absolue → le front est sur SON hôte, et l'API s'appelle directement ;
 *   - base relative (`/api`, proxy Next, D48) → `localhost`, et l'API passe par le front.
 *
 * Le back-office (`apps/admin-ui`, port 3001) proxifie toujours `/api/*` lui-même (D48) : ses
 * cookies `admin_*` sont first-party quel que soit l'hôte, on prend celui du front.
 *
 * `E2E_BASE_URL` / `E2E_API_URL` / `E2E_ADMIN_URL` restent prioritaires pour un poste monté
 * autrement.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const RACINE = join(__dirname, "../../../..");

/** La valeur de `NEXT_PUBLIC_API_BASE_URL` telle que le front la voit (`.env.local` d'abord). */
function baseApiDuFront(): string | null {
  for (const fichier of ["apps/user-ui/.env.local", ".env"]) {
    let contenu: string;
    try {
      contenu = readFileSync(join(RACINE, fichier), "utf-8");
    } catch {
      continue;
    }
    const ligne = contenu
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("NEXT_PUBLIC_API_BASE_URL="))
      .pop();
    if (!ligne) continue;
    const valeur = ligne.slice("NEXT_PUBLIC_API_BASE_URL=".length).replace(/^["']|["']$/g, "").trim();
    if (valeur) return valeur;
  }
  return null;
}

/** L'adresse du front membre (`apps/user-ui`) — la `baseURL` de Playwright. */
export function adresseDuFront(): string {
  if (process.env.E2E_BASE_URL) return process.env.E2E_BASE_URL;
  const base = baseApiDuFront();
  if (base && /^https?:\/\//.test(base)) {
    try {
      return `http://${new URL(base).hostname}:3000`;
    } catch {
      /* valeur illisible : on retombe sur le défaut */
    }
  }
  return "http://localhost:3000"; // proxy Next : cookies first-party
}

/**
 * L'adresse de l'API **telle que le navigateur membre l'appelle** — c'est celle-là qu'il faut
 * pour sonder une session avec les cookies du contexte (même hôte, mêmes cookies).
 */
export function adresseDeLApi(): string {
  if (process.env.E2E_API_URL) return process.env.E2E_API_URL.replace(/\/$/, "");
  const base = baseApiDuFront();
  if (base && /^https?:\/\//.test(base)) return base.replace(/\/$/, "");
  return `${adresseDuFront()}${base ?? "/api"}`.replace(/\/$/, "");
}

/** L'adresse du back-office (`apps/admin-ui`). */
export function adresseDuBackOffice(): string {
  if (process.env.E2E_ADMIN_URL) return process.env.E2E_ADMIN_URL.replace(/\/$/, "");
  return `http://${new URL(adresseDuFront()).hostname}:3001`;
}

/** L'API vue du back-office : toujours son propre proxy `/api` (D48). */
export function adresseDeLApiAdmin(): string {
  return `${adresseDuBackOffice()}/api`;
}
