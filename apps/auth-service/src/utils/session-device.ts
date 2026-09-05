/**
 * session-device.ts — un libellé d'appareil lisible depuis le user-agent (D65 2A)
 * ===============================================================================
 * Pur, volontairement grossier : navigateur + système, jamais une empreinte. « Appareil
 * inconnu » quand rien n'est reconnaissable (sessions d'avant le lot, clients d'API).
 */
export const UNKNOWN_DEVICE = "Appareil inconnu";

export function describeUserAgent(ua: string | null | undefined): string {
  if (!ua) return UNKNOWN_DEVICE;
  const s = ua;
  const os = /iPhone|iPad|iPod/.test(s) ? "iOS" : /Android/.test(s) ? "Android" : /Windows/.test(s) ? "Windows" : /Mac OS X|Macintosh/.test(s) ? "macOS" : /CrOS/.test(s) ? "ChromeOS" : /Linux/.test(s) ? "Linux" : null;
  const browser = /Edg\//.test(s) ? "Edge" : /OPR\/|Opera/.test(s) ? "Opera" : /SamsungBrowser/.test(s) ? "Samsung Internet" : /Firefox\//.test(s) ? "Firefox" : /Chrome\/|CriOS\//.test(s) ? "Chrome" : /Safari\//.test(s) && /Version\//.test(s) ? "Safari" : /YambaMobile\//.test(s) ? "Application Yamba" : null;
  if (!os && !browser) return UNKNOWN_DEVICE;
  return [browser, os].filter(Boolean).join(" · ");
}

/** Tronque un user-agent pour Redis (jamais 8 Ko par session). */
export const shortUserAgent = (ua: string | null | undefined): string | null => (ua ? ua.slice(0, 200) : null);
