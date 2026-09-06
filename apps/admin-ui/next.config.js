//@ts-check

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { composePlugins, withNx } = require("@nx/next");

/**
 * admin-ui — back-office Yamba (chantier C, D7/D54). Application SÉPARÉE de
 * user-ui : port 3001, pas d'i18n (l'opérateur est francophone), pas de
 * thème, un seul chemin d'entrée (/login → TOTP → /disputes).
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  nx: {},
  // Racine Turbopack = le monorepo : sans elle, Next choisit le premier package-lock.json trouvé en remontant
  // (ex. ~/package-lock.json) et avertit « multiple lockfiles » à chaque démarrage.
  turbopack: { root: require("path").join(__dirname, "../..") },
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.16.*.*"],
  // D48 — même origine : /api/* est proxifié vers le gateway, les cookies
  // admin_* sont first-party sur l'hôte de l'admin (localhost:3001 en dev).
  async rewrites() {
    const target = (process.env.API_PROXY_TARGET || "").replace(/\/$/, "");
    if (!target) return [];
    return [{ source: "/api/:path*", destination: `${target}/api/:path*` }];
  },
};

module.exports = composePlugins(withNx)(nextConfig);
