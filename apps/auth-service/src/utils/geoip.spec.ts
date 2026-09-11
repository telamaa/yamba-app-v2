import { isPrivateIp, resolveApproxLocation, resolveGeoProviderName } from "./geoip";

describe("isPrivateIp", () => {
  it("classe les IP privées / loopback / link-local comme privées", () => {
    for (const ip of ["127.0.0.1", "::1", "::ffff:127.0.0.1", "10.0.0.4", "192.168.1.155", "172.16.5.9", "172.31.0.1", "169.254.1.1", "fd00::1", "fe80::1", "", null, undefined]) {
      expect(isPrivateIp(ip as string)).toBe(true);
    }
  });
  it("classe les IP publiques comme non privées", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "172.15.0.1", "172.32.0.1", "2001:4860:4860::8888"]) {
      expect(isPrivateIp(ip)).toBe(false);
    }
  });
});

describe("resolveGeoProviderName", () => {
  it("défaut = none, ipapi seulement si demandé", () => {
    expect(resolveGeoProviderName({})).toBe("none");
    expect(resolveGeoProviderName({ GEOIP_PROVIDER: "" })).toBe("none");
    expect(resolveGeoProviderName({ GEOIP_PROVIDER: "maxmind" })).toBe("none");
    expect(resolveGeoProviderName({ GEOIP_PROVIDER: "ipapi" })).toBe("ipapi");
    expect(resolveGeoProviderName({ GEOIP_PROVIDER: " IPAPI " })).toBe("ipapi");
  });
});

describe("resolveApproxLocation", () => {
  const fetchImpl = (async () => ({ ok: true, json: async () => ({ status: "success", city: "Paris", country: "France" }) })) as unknown as typeof fetch;

  it("rend null pour une IP privée, même provider activé (aucun appel)", async () => {
    let called = false;
    const spy = (async () => { called = true; return { ok: true, json: async () => ({}) }; }) as unknown as typeof fetch;
    expect(await resolveApproxLocation("192.168.1.10", { fetchImpl: spy, env: { GEOIP_PROVIDER: "ipapi" } })).toBeNull();
    expect(called).toBe(false);
  });

  it("rend null quand le provider est none (aucun appel), même IP publique", async () => {
    let called = false;
    const spy = (async () => { called = true; return { ok: true, json: async () => ({}) }; }) as unknown as typeof fetch;
    expect(await resolveApproxLocation("8.8.8.8", { fetchImpl: spy, env: {} })).toBeNull();
    expect(called).toBe(false);
  });

  it("rend « Ville, Pays » avec ipapi sur une IP publique", async () => {
    expect(await resolveApproxLocation("8.8.8.8", { fetchImpl, env: { GEOIP_PROVIDER: "ipapi" } })).toBe("Paris, France");
  });

  it("ne jette jamais : rend null si le fetch échoue", async () => {
    const boom = (async () => { throw new Error("network"); }) as unknown as typeof fetch;
    expect(await resolveApproxLocation("8.8.8.8", { fetchImpl: boom, env: { GEOIP_PROVIDER: "ipapi" } })).toBeNull();
  });

  it("rend null si le service répond status != success", async () => {
    const fail = (async () => ({ ok: true, json: async () => ({ status: "fail" }) })) as unknown as typeof fetch;
    expect(await resolveApproxLocation("8.8.8.8", { fetchImpl: fail, env: { GEOIP_PROVIDER: "ipapi" } })).toBeNull();
  });
});
