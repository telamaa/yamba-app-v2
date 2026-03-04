// apps/user-ui/src/lib/geocoding/photon.ts
export type CitySuggestion = {
  id: string;
  title: string;     // ex: "Lille"
  subtitle: string;  // ex: "Hauts-de-France, France"
  label: string;     // valeur envoyée dans l'input
  lat: number;
  lon: number;
};

type PhotonFeature = {
  properties: {
    name?: string;
    city?: string;
    country?: string;
    state?: string;
    osm_key?: string;
    osm_value?: string;
  };
  geometry: { coordinates: [number, number] }; // [lon, lat]
};

type PhotonResponse = {
  features: PhotonFeature[];
};

const pickTitle = (p: PhotonFeature["properties"]) => p.name || p.city || "";

const pickSubtitle = (p: PhotonFeature["properties"]) => {
  const parts = [p.state, p.country].filter(Boolean);
  return parts.join(", ");
};

const isLikelyCity = (p: PhotonFeature["properties"]) => {
  if (p.osm_key !== "place") return true; // si inconnu, on garde
  return ["city", "town", "village", "hamlet"].includes(p.osm_value || "");
};

export async function searchCitySuggestions(
  query: string,
  opts?: { lang?: "fr" | "en"; limit?: number; signal?: AbortSignal }
): Promise<CitySuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const lang = opts?.lang ?? "fr";
  const limit = opts?.limit ?? 6;

  const url =
    `https://photon.komoot.io/api/` +
    `?q=${encodeURIComponent(q)}` +
    `&lang=${encodeURIComponent(lang)}` +
    `&limit=${limit}`;

  const res = await fetch(url, { signal: opts?.signal, headers: { Accept: "application/json" } });
  if (!res.ok) return [];

  const data = (await res.json()) as PhotonResponse;

  const mapped = (data.features ?? [])
    .filter((f) => Boolean(pickTitle(f.properties)))
    .filter((f) => isLikelyCity(f.properties))
    .map((f) => {
      const title = pickTitle(f.properties);
      const subtitle = pickSubtitle(f.properties) || (f.properties.country ?? "");
      const [lon, lat] = f.geometry.coordinates;

      return {
        id: `${title}-${lat}-${lon}`,
        title,
        subtitle,
        label: title,
        lat,
        lon,
      } as CitySuggestion;
    });

  const seen = new Set<string>();
  return mapped.filter((x) => {
    const key = `${x.title}|${x.subtitle}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
