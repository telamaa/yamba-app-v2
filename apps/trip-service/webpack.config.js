const { NxAppWebpackPlugin } = require("@nx/webpack/app-plugin");
const { join, resolve } = require("path");
module.exports = {
  output: {
    path: join(__dirname, "dist"),
  },
  resolve: {
    alias: {
      // Entrée explicite AVANT la générique (même logique que dans
      // tsconfig.base.json) : le chemin réel du module diverge de son
      // alias (packages/libs/api-contracts/src, pas packages/api-contracts).
      "@packages/api-contracts": resolve(
        __dirname,
        "../../packages/libs/api-contracts/src"
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
