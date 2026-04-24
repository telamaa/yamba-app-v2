//@ts-check

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { composePlugins, withNx } = require("@nx/next");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const createNextIntlPlugin = require("next-intl/plugin");

// Point vers notre config request.ts (chargement des messages)
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  // Use this to set Nx-specific options
  // See: https://nx.dev/recipes/next/next-config-setup
  nx: {},
};

const plugins = [
  // Ordre important : next-intl en premier, puis Nx
  withNextIntl,
  withNx,
];

module.exports = composePlugins(...plugins)(nextConfig);
