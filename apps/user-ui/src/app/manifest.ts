import type { MetadataRoute } from "next";

/**
 * Manifest PWA : permet d'ajouter Yamba à l'écran d'accueil du téléphone
 * (Android et iOS) avec la nouvelle icône.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Yamba",
    short_name: "Yamba",
    description: "Envoie tes colis avec des voyageurs vérifiés.",
    start_url: "/",
    display: "standalone",
    background_color: "#020617",
    theme_color: "#020617",
    icons: [
      { src: "/brand/yamba-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/yamba-icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/brand/yamba-icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
