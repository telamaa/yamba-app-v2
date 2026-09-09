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
import { defineConfig, devices } from "@playwright/test";
import { adresseDuFront } from "./src/fixtures/adresses";

const canal = process.env.PLAYWRIGHT_CHANNEL ?? "chrome";

/**
 * L'adresse du front est DÉDUITE de la configuration du front lui-même (`src/fixtures/adresses.ts`) :
 * les cookies de session sont liés à l'hôte, et un front ouvert sur le mauvais hôte donne une
 * connexion 200 sans cookie. Ne pas la forcer à la main — `E2E_BASE_URL` existe pour un poste
 * monté autrement.
 */
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
    // Next en mode développement COMPILE la route à la première visite : la page reste sur
    // « Compiling … » pendant vingt à soixante secondes. Un délai de navigation calibré pour
    // de la production ferait échouer le premier parcours qui touche un écran neuf, et ce
    // serait un faux négatif — mesuré sur `/carrier/deals/[dealId]`.
    navigationTimeout: 120_000,
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
