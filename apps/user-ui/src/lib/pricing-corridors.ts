/**
 * pricing-corridors.ts — base €/kg par corridor (D15 V1.5, côté front en
 * attendant `GET /trips/price-suggestion`).
 * ======================================================================
 * Zones = grands marchés GP, PAS des blocs politiques : « Europe » = UE +
 * Royaume-Uni + Suisse + Norvège + Balkans + Ukraine ; la Russie est une
 * zone à part (formalités, sanctions, distances). La matrice est zone × zone :
 * les corridors sans l'Europe (Chine → Congo, USA → Mexique…) sont couverts.
 *
 * Le prix d'un kilo GP dépend d'abord du CORRIDOR (rareté de l'offre,
 * formalités, valeur de la franchise bagage sur la ligne), puis de la
 * distance comme simple proxy. On classe chaque pays dans une ZONE et on
 * lit la base dans une matrice zone × zone (symétrique).
 *
 * ⚠️ Les valeurs sont des HYPOTHÈSES de marché (étude GP à mener, D15) —
 * ajustez-les ici, rien d'autre n'est à toucher. Tout est pur et testable.
 */

export type Zone =
  | "EUROPE" | "RUSSIA" | "MAGHREB" | "WEST_AFRICA" | "CENTRAL_AFRICA" | "EAST_SOUTH_AFRICA"
  | "MIDDLE_EAST" | "SOUTH_ASIA" | "EAST_ASIA" | "SOUTHEAST_ASIA" | "CENTRAL_ASIA"
  | "NORTH_AMERICA" | "LATAM_CARIBBEAN" | "DOM_TOM" | "OCEANIA" | "UNKNOWN";

const ZONE_COUNTRIES: Record<Exclude<Zone, "UNKNOWN">, string[]> = {
  EUROPE: ["FR","BE","NL","LU","DE","AT","CH","IT","ES","PT","GB","IE","DK","SE","NO","FI","IS","PL","CZ","SK","HU","RO","BG","GR","HR","SI","RS","BA","ME","MK","AL","XK","EE","LV","LT","UA","MD","BY","MT","CY","LI","MC","AD","SM","VA"],
  RUSSIA: ["RU"],
  MAGHREB: ["MA","DZ","TN","LY","MR"],
  WEST_AFRICA: ["SN","CI","ML","GN","GW","GM","SL","LR","BJ","TG","BF","NE","NG","GH","CV","CM"],
  CENTRAL_AFRICA: ["CG","CD","GA","CF","TD","GQ","ST","AO"],
  EAST_SOUTH_AFRICA: ["KE","ET","TZ","UG","RW","BI","DJ","SO","ER","SD","SS","MG","MU","SC","KM","MZ","ZM","ZW","MW","ZA","NA","BW","LS","SZ"],
  MIDDLE_EAST: ["TR","LB","SY","JO","IL","PS","IQ","IR","SA","AE","QA","KW","BH","OM","YE","EG","GE","AM","AZ"],
  SOUTH_ASIA: ["IN","PK","BD","LK","NP","BT","MV","AF"],
  EAST_ASIA: ["CN","JP","KR","KP","TW","HK","MO","MN"],
  SOUTHEAST_ASIA: ["VN","TH","PH","ID","MY","SG","KH","LA","MM","BN","TL"],
  CENTRAL_ASIA: ["KZ","UZ","KG","TJ","TM"],
  NORTH_AMERICA: ["US","CA"],
  LATAM_CARIBBEAN: ["MX","BR","AR","CL","CO","PE","VE","EC","BO","PY","UY","CU","HT","DO","JM","TT","PA","CR","GT","HN","SV","NI","BZ","SR","GY"],
  DOM_TOM: ["GP","MQ","GF","RE","YT","NC","PF","PM","WF","BL","MF"],
  OCEANIA: ["AU","NZ","FJ","PG","WS","TO","VU"],
};

const COUNTRY_TO_ZONE: Record<string, Zone> = Object.fromEntries(
  (Object.entries(ZONE_COUNTRIES) as Array<[Zone, string[]]>).flatMap(([z, cs]) => cs.map((c) => [c, z]))
);

export function zoneOf(countryCode: string | null | undefined): Zone {
  if (!countryCode) return "UNKNOWN";
  return COUNTRY_TO_ZONE[countryCode.toUpperCase()] ?? "UNKNOWN";
}

/** Base €/kg DEPUIS L'EUROPE vers chaque zone (le marché de lancement). */
const BASE_FROM_EUROPE: Record<Zone, number> = {
  EUROPE: 6.5,
  RUSSIA: 10,
  MAGHREB: 8,
  WEST_AFRICA: 11,
  CENTRAL_AFRICA: 12,
  EAST_SOUTH_AFRICA: 12,
  MIDDLE_EAST: 9,
  SOUTH_ASIA: 11,
  EAST_ASIA: 12,
  SOUTHEAST_ASIA: 12,
  CENTRAL_ASIA: 10,
  NORTH_AMERICA: 10,
  LATAM_CARIBBEAN: 12,
  DOM_TOM: 9,
  OCEANIA: 13,
  UNKNOWN: 11,
};

/** Paires hors Europe explicitement connues (sinon : moyenne des deux bases + distance). */
const BASE_PAIRS: Array<[Zone, Zone, number]> = [
  ["NORTH_AMERICA", "WEST_AFRICA", 13],
  ["NORTH_AMERICA", "CENTRAL_AFRICA", 14],
  ["NORTH_AMERICA", "LATAM_CARIBBEAN", 9],
  ["EAST_ASIA", "WEST_AFRICA", 13],
  ["EAST_ASIA", "CENTRAL_AFRICA", 14],
  ["EAST_ASIA", "SOUTHEAST_ASIA", 7],
  ["MIDDLE_EAST", "SOUTH_ASIA", 8],
  ["MIDDLE_EAST", "WEST_AFRICA", 11],
  ["MAGHREB", "WEST_AFRICA", 9],
  ["RUSSIA", "CENTRAL_ASIA", 7],
  ["RUSSIA", "EAST_ASIA", 10],
  ["RUSSIA", "MIDDLE_EAST", 9],
  ["WEST_AFRICA", "CENTRAL_AFRICA", 8],
];

export const DEFAULT_BASE_PER_KG = 11;

/**
 * Base €/kg pour un corridor. Même zone (hors Europe) = marché domestique,
 * base basse. Distance : correctif doux ±10 % autour de 5 000 km (log).
 */
export function corridorBasePerKg(
  fromCountry: string | null | undefined,
  toCountry: string | null | undefined,
  distanceKm?: number | null
): { base: number; fromZone: Zone; toZone: Zone } {
  const fromZone = zoneOf(fromCountry);
  const toZone = zoneOf(toCountry);
  let base: number;

  if (fromZone === "UNKNOWN" || toZone === "UNKNOWN") {
    base = DEFAULT_BASE_PER_KG;
  } else if (fromZone === "EUROPE" || toZone === "EUROPE") {
    base = BASE_FROM_EUROPE[fromZone === "EUROPE" ? toZone : fromZone];
  } else if (fromZone === toZone) {
    base = Math.max(5, BASE_FROM_EUROPE[fromZone] * 0.6);
  } else {
    const pair = BASE_PAIRS.find(([a, b]) => (a === fromZone && b === toZone) || (a === toZone && b === fromZone));
    base = pair ? pair[2] : (BASE_FROM_EUROPE[fromZone] + BASE_FROM_EUROPE[toZone]) / 2;
  }

  if (typeof distanceKm === "number" && distanceKm > 0) {
    // ±10 % max : 500 km → −10 %, 5 000 km → 0, 15 000 km → +5 %
    const f = Math.max(-0.1, Math.min(0.1, Math.log10(distanceKm / 5000) * 0.1));
    base = base * (1 + f);
  }
  return { base: Math.round(base * 100) / 100, fromZone, toZone };
}

/** Distance orthodromique (km) — null si une coordonnée manque. */
export function haversineKm(
  lat1: number | null | undefined, lng1: number | null | undefined,
  lat2: number | null | undefined, lng2: number | null | undefined
): number | null {
  if ([lat1, lng1, lat2, lng2].some((v) => typeof v !== "number")) return null;
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad((lat2 as number) - (lat1 as number));
  const dLng = toRad((lng2 as number) - (lng1 as number));
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1 as number)) * Math.cos(toRad(lat2 as number)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
