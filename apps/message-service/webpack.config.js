const { NxAppWebpackPlugin } = require("@nx/webpack/app-plugin");
const { join, resolve } = require("path");

module.exports = {
  output: { path: join(__dirname, "dist") },
  resolve: {
    // Alias explicites AVANT la generique : le chemin reel diverge de l'alias
    // (packages/libs/<lib>/src). Trois resolveurs : tsc, webpack, jest.
    alias: {
      "@packages/api-contracts": resolve(__dirname, "../../packages/libs/api-contracts/src"),
      "@packages/messaging": resolve(__dirname, "../../packages/libs/messaging/src"),
      "@packages/email": resolve(__dirname, "../../packages/libs/email/src"),
      "@packages/admin-audit": resolve(__dirname, "../../packages/libs/admin-audit/src"),
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
