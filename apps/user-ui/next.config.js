//@ts-check

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { composePlugins, withNx } = require("@nx/next");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const createNextIntlPlugin = require("next-intl/plugin");

// Point vers notre config request.ts (chargement des messages).
// next-intl résout un chemin RELATIF depuis process.cwd() (et refuse les
// chemins absolus avec Turbopack), or le plugin @nx/next évalue ce fichier
// depuis la racine du monorepo (« Could not find i18n config at
// ./src/i18n/request.ts » au calcul du graphe) tandis que `next dev` tourne
// depuis apps/user-ui. On recalcule donc le relatif au cwd courant.
const path = require("path");
const withNextIntl = createNextIntlPlugin(
  "./" + path.relative(process.cwd(), path.join(__dirname, "src/i18n/request.ts"))
);

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  // Use this to set Nx-specific options
  // See: https://nx.dev/recipes/next/next-config-setup
  nx: {},
  // Racine Turbopack = le monorepo : sans elle, Next choisit le premier package-lock.json trouvé en remontant
  // (ex. ~/package-lock.json) et avertit « multiple lockfiles » à chaque démarrage.
  turbopack: { root: require("path").join(__dirname, "../..") },
  // Recette sur le réseau local (autres ordinateurs, téléphones) : Next 16
  // répond 403 aux assets /_next/* demandés depuis une origine autre que
  // localhost — la page reste figée sur son squelette SSR. Réseaux privés
  // uniquement, sans effet en production (option de dev).
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.16.*.*"],

  // D48 — API en MÊME ORIGINE : quand API_PROXY_TARGET est posé (ex.
  // http://localhost:8080), Next sert /api/* en proxy vers le gateway. Le
  // navigateur appelle alors `NEXT_PUBLIC_API_BASE_URL=/api` (relatif) : les
  // cookies sont first-party quel que soit l'hôte (localhost, IP LAN, prod),
  // plus de CORS ni de piège SameSite (recette 03/09 : login 200 puis /me 401
  // avec le front sur localhost et l'API sur l'IP LAN). Sans la variable :
  // comportement historique (URL absolue vers le gateway).
  async rewrites() {
    const target = (process.env.API_PROXY_TARGET || "").replace(/\/$/, "");
    if (!target) return [];
    return [{ source: "/api/:path*", destination: `${target}/api/:path*` }];
  },
};

const plugins = [
  // Ordre important : next-intl en premier, puis Nx
  withNextIntl,
  withNx,
];

module.exports = composePlugins(...plugins)(nextConfig);
