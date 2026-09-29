/**
 * @packages/libs/geoip — localisation approximative HORS-LIGNE d'une adresse IP (D80, doctrine D78)
 * =================================================================================================
 * Sert l'ancrage du flux d'atterrissage localisé (D80 1A) : quand le client n'envoie pas de
 * position, l'IP donne une ville approximative — et c'est l'étage qui sert le NOUVEL utilisateur
 * sans aucune donnée.
 *
 * Choix RGPD assumé (D78 étendue) : l'IP ne sort JAMAIS de chez nous. La résolution lit une base
 * MaxMind GeoLite2-City LOCALE (`scripts/download-geolite2.sh`, base gitignorée) via `maxmind`,
 * un lecteur .mmdb pur JS. Sans base sur le disque, tout rend `null` — fail-safe, jamais un
 * throw, jamais un 500 : un flux sans ancrage dégrade en flux découverte, il ne casse pas.
 *
 * La lecture est INJECTABLE (`makeIpAnchorResolver`) et l'interprétation PURE (`interpretCity`) :
 * les tests n'ont pas besoin du binaire de la base.
 *
 * NOTE : `isPrivateIp` duplique sciemment celle de `apps/auth-service/src/utils/geoip.ts` (D78) —
 * la faire migrer ici est notée comme reste du lot, pour ne pas toucher auth-service (et sa
 * baseline de tests) dans la PR serveur du feed.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/** L'ancrage géographique résolu — jamais journalisé, jamais stocké (D80 5A). */
export type IpAnchor = {
  lat: number;
  lng: number;
  /** Nom de ville localisé (fr → en → premier disponible), null si la base ne le porte pas. */
  city: string | null;
  /** ISO 3166-1 alpha-2 ("CM", "FR"…), null si inconnu. */
  countryCode: string | null;
};

/** Forme minimale d'une réponse GeoLite2-City — structurel, pas d'import de types `maxmind` ici. */
export type CityLike = {
  location?: { latitude?: number; longitude?: number } | null;
  city?: { names?: Record<string, string> } | null;
  country?: { iso_code?: string } | null;
};

/** Vrai pour une IP privée / loopback / non routable : jamais de géoloc (poste de dev compris). */
export function isPrivateIp(ip: string | null | undefined): boolean {
  if (!ip) return true;
  let s = ip.trim().toLowerCase();
  if (s.startsWith("::ffff:")) s = s.slice(7); // IPv4 mappée en IPv6
  if (s === "" || s === "::1" || s === "127.0.0.1" || s === "localhost" || s === "0.0.0.0") return true;
  if (s.startsWith("fc") || s.startsWith("fd") || s.startsWith("fe80:")) return true; // ULA / link-local IPv6
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (!m) return false; // IPv6 publique, par ex.
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true; // link-local
  return false;
}

/** Pur : réponse GeoLite2-City → ancrage, ou null si les coordonnées manquent. */
export function interpretCity(resp: CityLike | null | undefined, locale = "fr"): IpAnchor | null {
  const lat = resp?.location?.latitude;
  const lng = resp?.location?.longitude;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  const names = resp?.city?.names ?? {};
  const city = names[locale] ?? names.en ?? Object.values(names)[0] ?? null;
  return { lat, lng, city, countryCode: resp?.country?.iso_code ?? null };
}

export type CityLookup = (ip: string) => CityLike | null;

/**
 * Fabrique un résolveur IP → ancrage. `openDb` est appelé UNE fois (résultat mémorisé, échec
 * compris) : ouvrir une .mmdb mappe le fichier, on ne le refait pas par requête.
 */
export function makeIpAnchorResolver(openDb: () => Promise<CityLookup | null>) {
  let lookupPromise: Promise<CityLookup | null> | null = null;
  return async function resolveIpAnchor(ip: string | null | undefined, locale = "fr"): Promise<IpAnchor | null> {
    if (isPrivateIp(ip)) return null;
    try {
      lookupPromise ??= openDb().catch(() => null);
      const lookup = await lookupPromise;
      if (!lookup) return null;
      return interpretCity(lookup(String(ip).trim()), locale);
    } catch {
      return null; // une géoloc ne vaut jamais un 500
    }
  };
}

/**
 * Chemin de la base : `GEOIP_DB_PATH` (root .env — JAMAIS un .env de projet, piège connu),
 * sinon `data/geoip/GeoLite2-City.mmdb` depuis la racine du repo — essayé depuis le cwd
 * (nx serve) PUIS deux crans au-dessus (bundle lancé depuis apps/<service>).
 */
export function findGeoDbPath(env: Record<string, string | undefined> = process.env, cwd = process.cwd()): string | null {
  const candidates = env.GEOIP_DB_PATH
    ? [resolve(cwd, env.GEOIP_DB_PATH)]
    : [resolve(cwd, "data/geoip/GeoLite2-City.mmdb"), resolve(cwd, "../../data/geoip/GeoLite2-City.mmdb")];
  return candidates.find((p) => existsSync(p)) ?? null;
}

let warnedOnce = false;

/** Le résolveur par défaut, branché sur la base locale. Sans base : null partout, un warn UNE fois. */
export const resolveIpAnchor = makeIpAnchorResolver(async () => {
  const path = findGeoDbPath();
  if (!path) {
    if (!warnedOnce) {
      warnedOnce = true;
      console.warn("[geoip] Base GeoLite2 absente (GEOIP_DB_PATH / data/geoip) — ancrage IP désactivé, flux découverte");
    }
    return null;
  }
  const { open } = await import("maxmind");
  const reader = await open<import("maxmind").CityResponse>(path);
  return (ip: string) => reader.get(ip) as CityLike | null;
});
