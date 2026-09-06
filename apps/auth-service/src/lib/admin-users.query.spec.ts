import { AdminUsersQuerySchema } from "@packages/api-contracts";
import { buildUsersOrderBy, buildUsersWhere } from "./admin-users.query";

const parse = (o: Record<string, unknown>) => AdminUsersQuerySchema.parse(o);
describe("admin-users.query (C-PR7a, D60 2A)", () => {
  it("filtres simples → where Prisma ; défauts de tri et de limite", () => {
    const q = parse({ role: "CARRIER", accountStatus: "RESTRICTED", stripeReady: "1", createdFrom: "2026-01-01T00:00:00Z" });
    expect(buildUsersWhere(q)).toEqual({ isDeleted: false, roles: { has: "CARRIER" }, accountStatus: "RESTRICTED", carrierPage: { is: { stripePayoutsEnabled: true } }, createdAt: { gte: new Date("2026-01-01T00:00:00Z") } });
    expect(buildUsersOrderBy(q)).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
    expect(q.limit).toBe(50);
  });
  it("texte + stripeReady=0 : les deux OR sont combinés par AND ; identifiant ou ticket ne filtrent pas le texte", () => {
    const w = buildUsersWhere(parse({ q: "ami", stripeReady: "0" })) as { AND: unknown[]; OR?: unknown };
    expect(w.OR).toBeUndefined();
    expect(w.AND).toHaveLength(2);
    expect(buildUsersWhere(parse({ q: "64b0000000000000000000b1" }))).toEqual({ isDeleted: false });
    expect(buildUsersWhere(parse({ q: "YAM-2041" }))).toEqual({ isDeleted: false });
  });
  it("téléphone : au moins 6 chiffres pour chercher le numéro", () => {
    const w = buildUsersWhere(parse({ q: "+33612" })) as { OR: unknown[] };
    expect(w.OR).toHaveLength(4);
    expect((buildUsersWhere(parse({ q: "+336" })) as { OR: unknown[] }).OR).toHaveLength(3);
  });
  it("limite refusée au-delà de 100, tri lastName asc", () => {
    expect(AdminUsersQuerySchema.safeParse({ limit: "500" }).success).toBe(false);
    expect(parse({ limit: "100" }).limit).toBe(100);
    expect(buildUsersOrderBy(parse({ sort: "lastName", dir: "asc" }))).toEqual([{ lastName: "asc" }, { id: "asc" }]);
  });
});
