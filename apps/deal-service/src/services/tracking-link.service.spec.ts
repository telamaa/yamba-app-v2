/** tracking-link.service.spec.ts — page destinataire (D69) sur un faux Prisma en mémoire. */
import { makeTrackingLinkService, type TrackingDb } from "./tracking-link.service";

type Row = Record<string, unknown>;
function fakeDb(seed: Partial<Record<"booking" | "trackingLink" | "user" | "trip", Row[]>> = {}) {
  const tables: Record<string, Row[]> = {};
  const delegate = (name: string) => {
    tables[name] = structuredClone((seed as Record<string, Row[]>)[name] ?? []);
    const rows = () => tables[name];
    const matches = (row: Row, where: Row): boolean =>
      Object.entries(where ?? {}).every(([k, v]) => (v && typeof v === "object" && "in" in (v as Row) ? ((v as Row).in as unknown[]).includes(row[k]) : row[k] === v));
    return {
      async findUnique({ where }: { where: Row }) { return rows().find((r) => matches(r, where)) ?? null; },
      async findMany({ where }: { where?: Row }) { return rows().filter((r) => matches(r, where ?? {})); },
      async create({ data }: { data: Row }) { const r = { id: `${name}-${rows().length + 1}`, ...data }; rows().push(r); return r; },
    };
  };
  const db = Object.fromEntries(["booking", "trackingLink", "user", "trip"].map((n) => [n, delegate(n)])) as unknown as TrackingDb & { tables: typeof tables };
  db.tables = tables;
  return db;
}
const d = (s: string) => new Date(s);
const users = [{ id: "u-awa", firstName: "Awa", lastName: "Diop" }, { id: "u-moussa", firstName: "Moussa", lastName: "Ba" }];
const trip = { id: "t1", originCity: "Paris", destinationCity: "Dakar", departureAt: d("2026-09-03T10:00:00Z"), arrivalAt: d("2026-09-03T16:00:00Z") };
const booking = { id: "b1", shipperId: "u-awa", carrierId: "u-moussa", tripId: "t1", status: "PICKED_UP", isDeleted: false, recipientRedactedAt: null, recipient: { firstName: "Fatou", lastName: "Sow", phoneE164: "+221770000000", email: null }, acceptedAt: d("2026-09-01T10:00:00Z"), pickedUpAt: d("2026-09-03T08:00:00Z"), deliveredAt: null, closedAt: null, cancelledAt: null, trackingEvents: [{ step: "FLIGHT_DEPARTED", confirmedAt: d("2026-09-03T11:00:00Z") }] };

describe("issue (D69 1A)", () => {
  it("l'Expéditeur obtient un lien, le même au second appel ; le contact du destinataire est celui qu'il a saisi", async () => {
    const db = fakeDb({ booking: [booking] });
    const svc = makeTrackingLinkService({ db, token: () => "tok-1" });
    const a = await svc.issue("u-awa", "b1");
    expect(a).toEqual({ token: "tok-1", path: "/track/tok-1", recipientFirstName: "Fatou", recipientPhoneE164: "+221770000000" });
    const b = await svc.issue("u-awa", "b1");
    expect(b.token).toBe("tok-1");
    expect(db.tables.trackingLink).toHaveLength(1);
  });
  it("Voyageur → 403 ; tiers → 403 ; inconnu → 404 ; avant acceptation ou après annulation → 409 TRACKING_NOT_AVAILABLE", async () => {
    const db = fakeDb({ booking: [booking, { ...booking, id: "b2", status: "PENDING" }, { ...booking, id: "b3", status: "CANCELLED" }] });
    const svc = makeTrackingLinkService({ db, token: () => "tok" });
    await expect(svc.issue("u-moussa", "b1")).rejects.toMatchObject({ statusCode: 403 });
    await expect(svc.issue("u-x", "b1")).rejects.toMatchObject({ statusCode: 403 });
    await expect(svc.issue("u-awa", "nope")).rejects.toMatchObject({ statusCode: 404 });
    await expect(svc.issue("u-awa", "b2")).rejects.toMatchObject({ statusCode: 409 });
    await expect(svc.issue("u-awa", "b3")).rejects.toMatchObject({ statusCode: 409 });
    expect(db.tables.trackingLink).toHaveLength(0);
  });
});

describe("publicView (D69 2A/3A)", () => {
  it("contenu minimal : jalons, prénoms, corridor, dates — jamais le numéro, l'adresse ni le code", async () => {
    const db = fakeDb({ booking: [booking], trackingLink: [{ id: "l1", bookingId: "b1", token: "tok-1", revokedAt: null }], user: users, trip: [trip] });
    const view = await makeTrackingLinkService({ db }).publicView("tok-1");
    expect(view).toEqual({
      milestone: "IN_TRANSIT",
      steps: [{ key: "ACCEPTED", at: "2026-09-01T10:00:00.000Z" }, { key: "PICKED_UP", at: "2026-09-03T08:00:00.000Z" }, { key: "IN_TRANSIT", at: "2026-09-03T11:00:00.000Z" }],
      recipientFirstName: "Fatou",
      shipperFirstName: "Awa",
      carrier: { firstName: "Moussa", lastInitial: "B" },
      corridor: { originCity: "Paris", destinationCity: "Dakar" },
      departureAt: "2026-09-03T10:00:00.000Z",
      arrivalAt: "2026-09-03T16:00:00.000Z",
    });
    expect(JSON.stringify(view)).not.toMatch(/\+221|Sow|deliveryCode/);
  });
  it("404 uniforme : jeton inconnu, lien révoqué, tiers effacé, réservation supprimée", async () => {
    const db = fakeDb({
      booking: [booking, { ...booking, id: "b2", recipientRedactedAt: d("2026-10-05T00:00:00Z") }, { ...booking, id: "b3", isDeleted: true }],
      trackingLink: [{ id: "l1", bookingId: "b1", token: "revoked", revokedAt: d("2026-09-05T00:00:00Z") }, { id: "l2", bookingId: "b2", token: "redacted", revokedAt: null }, { id: "l3", bookingId: "b3", token: "deleted", revokedAt: null }],
      user: users, trip: [trip],
    });
    const svc = makeTrackingLinkService({ db });
    for (const token of ["nope", "revoked", "redacted", "deleted"]) await expect(svc.publicView(token)).rejects.toMatchObject({ statusCode: 404 });
  });
});
