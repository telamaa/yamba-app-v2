import ImageKit from "imagekit";

/**
 * Singleton PARESSEUX (micro-PR getImageKit, dette des handoffs).
 * L'ancien `new ImageKit(...)` au chargement du module faisait crasher
 * TOUT le service au boot quand les env ImageKit manquaient (dev local,
 * CI) — y compris pour consulter /docs ou /openapi.json qui n'ont
 * aucun besoin d'ImageKit. Désormais l'instance n'est créée qu'au
 * PREMIER appel réel (upload/suppression) ; sans env, seuls ces
 * endpoints échouent, le service boot.
 */

if (!process.env.IMAGEKIT_PUBLIC_KEY) {
  console.warn("[ImageKit] IMAGEKIT_PUBLIC_KEY is not set — upload endpoints will fail");
}
if (!process.env.IMAGEKIT_PRIVATE_KEY) {
  console.warn("[ImageKit] IMAGEKIT_PRIVATE_KEY is not set — upload endpoints will fail");
}
if (!process.env.IMAGEKIT_URL_ENDPOINT) {
  console.warn("[ImageKit] IMAGEKIT_URL_ENDPOINT is not set — upload endpoints will fail");
}

let instance: ImageKit | null = null;

function getImageKit(): ImageKit {
  if (!instance) {
    instance = new ImageKit({
      publicKey: process.env.IMAGEKIT_PUBLIC_KEY ?? "",
      privateKey: process.env.IMAGEKIT_PRIVATE_KEY ?? "",
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT ?? "",
    });
  }
  return instance;
}

/**
 * Proxy qui préserve l'interface `imagekit.methode()` des consommateurs
 * existants (upload.controller, trip.controller) — aucun call site à
 * modifier. La résolution de méthode déclenche l'init au premier usage.
 */
const imagekit = new Proxy({} as ImageKit, {
  get(_target, prop) {
    const real = getImageKit() as unknown as Record<PropertyKey, unknown>;
    const value = real[prop];
    return typeof value === "function" ? (value as Function).bind(real) : value;
  },
});

export default imagekit;
