import { findGeoDbPath, interpretCity, isPrivateIp, makeIpAnchorResolver } from "@packages/libs/geoip";

/**
 * D80 / D78 — la brique géo HORS-LIGNE, testée SANS le binaire GeoLite2 : l'interprétation est
 * pure, la lecture injectable. La propriété qui compte : une géoloc ne vaut JAMAIS un throw —
 * sans base, IP privée, lecteur qui explose → null, et le flux dégrade en découverte.
 */

describe("isPrivateIp — jamais de géoloc sur une IP non routable", () => {
  it.each(["127.0.0.1", "::1", "10.1.2.3", "192.168.1.20", "172.16.0.1", "172.31.255.255", "169.254.0.1", "::ffff:192.168.0.4", "fe80::1", "fd00::1", "", "  "])(
    "%p est privée / non routable",
    (ip) => expect(isPrivateIp(ip)).toBe(true)
  );

  it.each(["41.202.207.1", "8.8.8.8", "172.32.0.1", "2a01:cb00::1"])("%p est publique", (ip) =>
    expect(isPrivateIp(ip)).toBe(false)
  );

  it("null et undefined valent privé (pas d'en-tête gateway = pas d'ancrage)", () => {
    expect(isPrivateIp(null)).toBe(true);
    expect(isPrivateIp(undefined)).toBe(true);
  });
});

describe("interpretCity — pur, réponse GeoLite2 → ancrage", () => {
  const douala = {
    location: { latitude: 4.05, longitude: 9.77 },
    city: { names: { en: "Douala", fr: "Douala (fr)" } },
    country: { iso_code: "CM" },
  };

  it("prend le nom dans la locale demandée, sinon en, sinon le premier", () => {
    expect(interpretCity(douala, "fr")?.city).toBe("Douala (fr)");
    expect(interpretCity(douala, "en")?.city).toBe("Douala");
    expect(interpretCity({ ...douala, city: { names: { de: "Duala" } } }, "fr")?.city).toBe("Duala");
  });

  it("sans coordonnées : null — une ville sans position n'ancre rien", () => {
    expect(interpretCity({ city: { names: { en: "X" } } })).toBeNull();
    expect(interpretCity({ location: { latitude: 4.05 } })).toBeNull();
    expect(interpretCity(null)).toBeNull();
  });

  it("ville et pays restent nullables, les coordonnées suffisent", () => {
    const a = interpretCity({ location: { latitude: 1, longitude: 2 } });
    expect(a).toEqual({ lat: 1, lng: 2, city: null, countryCode: null });
  });
});

describe("makeIpAnchorResolver — fail-safe, une seule ouverture", () => {
  const douala = { location: { latitude: 4.05, longitude: 9.77 }, country: { iso_code: "CM" } };

  it("IP privée : null SANS ouvrir la base", async () => {
    const openDb = jest.fn();
    const resolve = makeIpAnchorResolver(openDb);
    expect(await resolve("192.168.1.10")).toBeNull();
    expect(openDb).not.toHaveBeenCalled();
  });

  it("résout une IP publique, et n'ouvre la base qu'UNE fois pour deux appels", async () => {
    const lookup = jest.fn().mockReturnValue(douala);
    const openDb = jest.fn().mockResolvedValue(lookup);
    const resolve = makeIpAnchorResolver(openDb);
    expect((await resolve("41.202.207.1"))?.countryCode).toBe("CM");
    expect((await resolve("41.202.207.2"))?.lat).toBe(4.05);
    expect(openDb).toHaveBeenCalledTimes(1);
    expect(lookup).toHaveBeenCalledWith("41.202.207.1");
  });

  it("base absente (openDb → null) : null, jamais un throw", async () => {
    const resolve = makeIpAnchorResolver(async () => null);
    expect(await resolve("41.202.207.1")).toBeNull();
  });

  it("ouverture qui EXPLOSE : null, et l'échec est mémorisé (pas de tempête d'ouvertures)", async () => {
    const openDb = jest.fn().mockRejectedValue(new Error("mmdb corrompue"));
    const resolve = makeIpAnchorResolver(openDb);
    expect(await resolve("41.202.207.1")).toBeNull();
    expect(await resolve("41.202.207.1")).toBeNull();
    expect(openDb).toHaveBeenCalledTimes(1);
  });

  it("lookup qui jette : null — une géoloc ne vaut jamais un 500", async () => {
    const resolve = makeIpAnchorResolver(async () => () => {
      throw new Error("IP mal formée");
    });
    expect(await resolve("41.202.207.1")).toBeNull();
  });

  it("l'IP est trimée avant lecture (en-tête gateway avec espaces)", async () => {
    const lookup = jest.fn().mockReturnValue(douala);
    const resolve = makeIpAnchorResolver(async () => lookup);
    await resolve("  41.202.207.1  ");
    expect(lookup).toHaveBeenCalledWith("41.202.207.1");
  });
});

describe("findGeoDbPath — le chemin de la base", () => {
  it("GEOIP_DB_PATH prime, et un chemin inexistant rend null (fail-safe)", () => {
    expect(findGeoDbPath({ GEOIP_DB_PATH: __filename }, process.cwd())).toBe(__filename);
    expect(findGeoDbPath({ GEOIP_DB_PATH: "/nulle/part.mmdb" }, process.cwd())).toBeNull();
  });

  it("sans env ni base sur le disque : null, pas un throw", () => {
    expect(findGeoDbPath({}, "/tmp")).toBeNull();
  });
});
