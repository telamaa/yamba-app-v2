const { NxAppWebpackPlugin } = require("@nx/webpack/app-plugin");
const { join, resolve } = require("path");
module.exports = {
  output: {
    path: join(__dirname, "dist"),
  },
  resolve: {
    alias: {
      // Entrées explicites AVANT la générique (même logique que dans
      // tsconfig.base.json) : le chemin réel des modules diverge de leur
      // alias (packages/libs/<lib>/src, pas packages/<lib>).
      // Leçon §6.2 (v1.3) : TROIS résolveurs — tsc, webpack (ce fichier,
      // PAR service consommateur), jest.
      "@packages/api-contracts": resolve(
        __dirname,
        "../../packages/libs/api-contracts/src"
      ),
      "@packages/messaging": resolve(
        __dirname,
        "../../packages/libs/messaging/src"
      ),
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
      assets: ["./src/assets"],
      optimization: false,
      outputHashing: "none",
      generatePackageJson: true,
    }),
  ],
};
