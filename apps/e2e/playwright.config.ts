/**
 * playwright.config.ts — le harnais de recette navigateur (cahiers 01-WEB et 02-ADMIN)
 * ====================================================================================
 * Les cahiers 01 et 02 décrivent 438 scénarios joués **au navigateur**. Les jouer à la main
 * coûte plusieurs jours et ne se rejoue pas ; ce harnais les exécute.
 *
 * Trois choix structurants :
 *
 * 1. **Il tourne contre l'environnement de développement réel** (`npm run dev` + Mongo + Redis +
 *    Redpanda + Mailpit), pas contre des bouchons. Un parcours de recette qui ne traverse pas la
 *    vraie pile ne prouve rien — c'est toute la leçon de la campagne « tâches planifiées » :
 *    les défauts qui comptent sont ceux qu'aucun test unitaire ne voit.
 * 2. **Il n'est pas branché à la CI**, et c'est délibéré : il lui faudrait six services, trois
 *    bases et un courtier. La CI garde ses 17 vérifications ; ce harnais se lance à la main
 *    (`npx nx e2e e2e`) sur un poste où l'environnement tourne.
 * 3. **Un seul travailleur, pas de parallélisme.** Les parcours partagent UNE base et un jeu
 *    d'essai remis à zéro : deux parcours simultanés se marcheraient dessus. La lenteur est le
 *    prix de la fidélité.
 *
 * Navigateur : le **Chrome installé sur le poste** (`channel: "chrome"`). Les builds Chromium
 * de Playwright ne sont plus publiés pour macOS 13, qui est le poste de recette ; sur une
 * machine récente ou en conteneur, `PLAYWRIGHT_CHANNEL=bundled` bascule sur le Chromium livré
 * avec Playwright.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

const canal = process.env.PLAYWRIGHT_CHANNEL ?? "chrome";

/**
 * L'adresse du front — et c'est un piège que le projet a déjà payé (CLAUDE.md, § LAN).
 *
 * Les cookies de session sont **liés à l'hôte** : si le front est ouvert sur `localhost:3000`
 * alors que l'API est déclarée sur `http://192.168.1.155:8080/api`, la connexion répond 200 et
 * **aucun cookie n'est posé** — tout le reste du parcours échoue, sans que rien n'explique
 * pourquoi. Mesuré tel quel au montage du harnais.
 *
 * Le harnais lit donc la configuration du front et en déduit l'adresse à ouvrir :
 * base d'API absolue → on prend SON hôte ; base relative (`/api`, proxy Next, D48) → localhost.
 * `E2E_BASE_URL` reste prioritaire pour un poste monté autrement.
 */
function adresseDuFront(): string {
  if (process.env.E2E_BASE_URL) return process.env.E2E_BASE_URL;
  const racine = join(__dirname, "../..");
  for (const fichier of ["apps/user-ui/.env.local", ".env"]) {
    let contenu: string;
    try {
      contenu = readFileSync(join(racine, fichier), "utf-8");
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
    if (!valeur) continue;
    if (!/^https?:\/\//.test(valeur)) return "http://localhost:3000"; // proxy Next : cookies first-party
    try {
      return `http://${new URL(valeur).hostname}:3000`;
    } catch {
      /* valeur illisible : on retombe sur le défaut */
    }
  }
  return "http://localhost:3000";
}

const BASE = adresseDuFront();

export default defineConfig({
  testDir: "./src",
  testMatch: /.*\.spec\.ts$/,
  outputDir: "./resultats",
  // Un parcours de bout en bout du cahier compte jusqu'à 29 étapes : il lui faut de la place.
  timeout: 5 * 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "rapport", open: "never" }],
  ],
  use: {
    baseURL: BASE,
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    // Une recette qui échoue doit se relire : trace, capture et vidéo au premier échec.
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "web",
      use: {
        ...devices["Desktop Chrome"],
        ...(canal === "bundled" ? {} : { channel: canal }),
      },
    },
  ],
});
