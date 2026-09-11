/**
 * geoip.ts — localisation approximative d'une adresse IP (D78)
 * ===========================================================
 * Sert UNIQUEMENT l'email de nouvelle connexion (« quelqu'un s'est connecté depuis … »).
 *
 * Choix RGPD assumé : par DÉFAUT, aucune localisation. Résoudre une IP en ville/pays suppose
 * soit d'envoyer l'IP du membre à un tiers, soit d'embarquer une base hors-ligne. On ne fait
 * NI l'un NI l'autre sans décision explicite de l'exploitant :
 *
 *  - `GEOIP_PROVIDER` absent ou `none` → `resolveApproxLocation` rend `null` (email : IP seule).
 *  - `GEOIP_PROVIDER=ipapi` → appel best-effort à ip-api.com (sans clé). À N'ACTIVER qu'en
 *    connaissance de cause : l'IP du membre transite alors par un tiers hors UE. Recommandé à
 *    terme : une base MaxMind GeoLite2 hors-ligne (aucun partage), branchable ici.
 *
 * L'appel est fait dans le chemin ASYNCHRONE de l'email (jamais sur la réponse de connexion) :
 * il n'ajoute aucune latence au login, et échoue en silence (timeout, réseau) en rendant `null`.
 */

/** Vrai pour une IP privée / loopback / non routable : jamais de géoloc (et souvent le poste de dev). */
export function isPrivateIp(ip: string | null | undefined): boolean {
  if (!ip) return true;
  let s = ip.trim().toLowerCase();
  if (s.startsWith("::ffff:")) s = s.slice(7); // IPv4 mappée en IPv6
  if (s === "::1" || s === "127.0.0.1" || s === "localhost" || s === "0.0.0.0") return true;
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

export function resolveGeoProviderName(env: Record<string, string | undefined> = process.env): "none" | "ipapi" {
  const raw = env.GEOIP_PROVIDER?.trim().toLowerCase();
  return raw === "ipapi" ? "ipapi" : "none";
}

/** Rend une chaîne « Ville, Pays » (ou « Pays », ou `null`). Best-effort, ne jette jamais. */
export async function resolveApproxLocation(
  ip: string | null | undefined,
  opts: { fetchImpl?: typeof fetch; env?: Record<string, string | undefined>; timeoutMs?: number } = {}
): Promise<string | null> {
  const env = opts.env ?? process.env;
  if (isPrivateIp(ip)) return null;
  if (resolveGeoProviderName(env) !== "ipapi") return null;

  const fetchImpl = opts.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 2_000);
  try {
    const res = await fetchImpl(`http://ip-api.com/json/${encodeURIComponent(String(ip))}?fields=status,city,country`, {
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { status?: string; city?: string; country?: string };
    if (data.status !== "success") return null;
    const parts = [data.city, data.country].map((p) => (p ?? "").trim()).filter(Boolean);
    return parts.length ? parts.join(", ") : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
