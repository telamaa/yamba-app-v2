const { NxAppWebpackPlugin } = require("@nx/webpack/app-plugin");
const { join, resolve } = require("path");

module.exports = {
  output: {
    path: join(__dirname, "dist"),
  },
  resolve: {
    alias: {
      // Entrées explicites AVANT la générique : le chemin réel de ces libs
      // diverge de leur alias (packages/libs/<lib>/src, pas packages/<lib>).
      // Leçon §6.2 : TROIS résolveurs — tsc, webpack (PAR service), jest.
      "@packages/api-contracts": resolve(__dirname, "../../packages/libs/api-contracts/src"),
      "@packages/email": resolve(__dirname, "../../packages/libs/email/src"),
      "@packages": resolve(__dirname, "../../packages"),
    },
    extensions: [".ts", ".js"],
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: "node",
      compiler: "tsc",
      main: "./src/main.ts",
      tsConfig: "./tsconfig.app.json",
      optimization: false,
      outputHashing: "none",
      generatePackageJson: true,
    }),
  ],
};
