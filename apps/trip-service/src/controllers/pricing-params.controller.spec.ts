/**
 * pricing-params.controller.spec.ts — recette 02-ADMIN § 5.20 (ADM-PAR-2) : « effet en moins de 30 secondes ».
 * Le lecteur de paramètres a déjà un cache de 30 s côté serveur ; la réponse ne doit pas ajouter un cache navigateur.
 */
jest.mock("@packages/libs/settings/default", () => ({
  platformSettings: () => ({ snapshot: async () => ({ values: jest.requireActual("@packages/api-contracts").SETTINGS_DEFAULTS, version: 3 }) }),
}));

import { getPricingParams } from "./pricing-params.controller";

describe("GET /trips/pricing/params — cache", () => {
  it("revalidation à chaque lecture (no-cache) : aucun max-age ne s'ajoute au cache de 30 s du lecteur", async () => {
    const headers: Record<string, string> = {};
    let body: { commissionPct?: number; version?: number } = {};
    const res = { setHeader: (k: string, v: string) => { headers[k] = v; }, status: () => ({ json: (b: typeof body) => { body = b; } }) };
    await getPricingParams({} as never, res as never, jest.fn());
    expect(headers["Cache-Control"]).toBe("public, no-cache");
    expect(headers["Cache-Control"]).not.toMatch(/max-age/);
    expect(body).toMatchObject({ commissionPct: 12, version: 3 });
  });
});
