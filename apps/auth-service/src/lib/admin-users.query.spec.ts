import { AdminUsersQuerySchema } from "@packages/api-contracts";
import { buildUsersOrderBy, buildUsersWhere, escapeRegex, matchedOnFor, phoneNeedle, textSearchOr } from "./admin-users.query";

const parse = (o: Record<string, unknown>) => AdminUsersQuerySchema.parse(o);
describe("admin-users.query (C-PR7a, D60 2A)", () => {
  it("filtres simples → where Prisma ; défauts de tri et de limite", () => {
    const q = parse({ role: "CARRIER", accountStatus: "RESTRICTED", stripeReady: "1", createdFrom: "2026-01-01T00:00:00Z" });
    expect(buildUsersWhere(q)).toEqual({ isDeleted: false, roles: { has: "CARRIER" }, accountStatus: "RESTRICTED", carrierPage: { is: { stripePayoutsEnabled: true } }, createdAt: { gte: new Date("2026-01-01T00:00:00Z") } });
    expect(buildUsersOrderBy(q)).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
    expect(q.limit).toBe(50);
  });
  it("A194 (recette § 7, ADM-NRG-7 écart 4) — proposal=1 : le filtre du compteur « Sanctions proposées » ; toute autre valeur refusée", () => {
    expect(buildUsersWhere(parse({ proposal: "1" }))).toEqual({ isDeleted: false, suspensionProposedAt: { not: null } });
    expect(buildUsersWhere(parse({}))).not.toHaveProperty("suspensionProposedAt");
    expect(AdminUsersQuerySchema.safeParse({ proposal: "0" }).success).toBe(false);
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
  it("ANO-ADM-05 — le terme libre est échappé avant de devenir une expression Mongo", () => {
    expect(escapeRegex("aminata.shipper@seed.yamba.dev")).toBe("aminata\\.shipper@seed\\.yamba\\.dev");
    expect(escapeRegex("+33 (6) 12*")).toBe("\\+33 \\(6\\) 12\\*");
    const or = textSearchOr("a.b+(c") as Array<Record<string, { contains: string }>>;
    expect(or[0].emailNormalized.contains).toBe("a\\.b\\+\\(c");
    expect(or[1].firstName.contains).toBe("a\\.b\\+\\(c");
    expect(new RegExp(or[0].emailNormalized.contains).test("a.b+(c")).toBe(true);
    expect(new RegExp(or[0].emailNormalized.contains).test("axb+(c")).toBe(false);
  });
  it("ANO-ADM-05 — le numéro se cherche par ses chiffres significatifs, quelle que soit la saisie", () => {
    for (const saisie of ["+33612345601", "+33 6 12 34 56 01", "0033612345601", "33612345601"]) expect([saisie, phoneNeedle(saisie)]).toEqual([saisie, "33612345601"]);
    expect(phoneNeedle("06 12 34 56 01")).toBe("612345601");
    expect("+33612345601".includes(phoneNeedle("06 12 34 56 01")!)).toBe(true);
    expect(phoneNeedle("+336")).toBeNull();
    expect(phoneNeedle("Nkounkou")).toBeNull();
    const w = buildUsersWhere(parse({ q: "+33612345601" })) as { OR: Array<Record<string, { contains: string }>> };
    expect(w.OR[3]).toEqual({ phoneE164: { contains: "33612345601" } });
  });
  it("ANO-ADM-05 — « via … » : email, puis téléphone, puis nom", () => {
    const thomas = { email: "thomas.carrier@seed.yamba.dev", phoneE164: "+33612345601" };
    expect(matchedOnFor(thomas, "thomas.carrier@")).toBe("email");
    expect(matchedOnFor(thomas, "+33612345601")).toBe("phone");
    expect(matchedOnFor(thomas, "06 12 34 56 01")).toBe("phone");
    expect(matchedOnFor(thomas, "Nkounkou")).toBe("name");
    expect(matchedOnFor({ email: "x@y.z", phoneE164: null }, "+33612345601")).toBe("name");
  });
  it("limite refusée au-delà de 100, tri lastName asc", () => {
    expect(AdminUsersQuerySchema.safeParse({ limit: "500" }).success).toBe(false);
    expect(parse({ limit: "100" }).limit).toBe(100);
    expect(buildUsersOrderBy(parse({ sort: "lastName", dir: "asc" }))).toEqual([{ lastName: "asc" }, { id: "asc" }]);
  });
});
