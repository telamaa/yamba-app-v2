/** privacy.service.spec.ts — export et effacement (C-PR8b, D63) sur un faux Prisma en mémoire. */
import { anonymizedUserData, erasedEmailFor, erasedSlugFor, ErasureBlockedError, makePrivacyService, type PrivacyDb } from "./privacy.service";

type Row = Record<string, unknown>;
function fakeDb(seed: Partial<Record<keyof PrivacyDb, Row[]>> = {}) {
  const tables: Record<string, Row[]> = {};
  const calls: string[] = [];
  const delegate = (name: string) => {
    tables[name] = structuredClone((seed as Record<string, Row[]>)[name] ?? []); // jamais de fuite entre tests
    const rows = () => tables[name];
    const matches = (row: Row, where: Row): boolean =>
      Object.entries(where ?? {}).every(([k, v]) => {
        if (k === "OR") return (v as Row[]).some((w) => matches(row, w));
        if (k === "AND") return (v as Row[]).every((w) => matches(row, w));
        if (v && typeof v === "object" && "in" in (v as Row)) return ((v as Row).in as unknown[]).includes(row[k]);
        if (v && typeof v === "object" && "not" in (v as Row)) return row[k] !== (v as Row).not;
        if (v && typeof v === "object" && !(v instanceof Date)) return true; // filtres imbriqués (trip: { userId }) : on ne les évalue pas
        return row[k] === v;
      });
    return {
      async findMany({ where }: { where?: Row }) { calls.push(`${name}.findMany`); return rows().filter((r) => matches(r, where ?? {})); },
      async findUnique({ where }: { where: Row }) { return rows().find((r) => matches(r, where)) ?? null; },
      async findFirst({ where }: { where?: Row }) { return rows().find((r) => matches(r, where ?? {})) ?? null; },
      async count({ where }: { where?: Row }) { return rows().filter((r) => matches(r, where ?? {})).length; },
      async update({ where, data }: { where: Row; data: Row }) { calls.push(`${name}.update`); const r = rows().find((x) => matches(x, where)); if (r) Object.assign(r, data); return r; },
      async updateMany({ where, data }: { where: Row; data: Row }) { calls.push(`${name}.updateMany`); let n = 0; for (const r of rows().filter((x) => matches(x, where))) { Object.assign(r, data); n++; } return { count: n }; },
      async deleteMany({ where }: { where: Row }) { calls.push(`${name}.deleteMany`); const keep = rows().filter((x) => !matches(x, where)); const n = rows().length - keep.length; tables[name] = keep; return { count: n }; },
      async create({ data }: { data: Row }) { calls.push(`${name}.create`); const r = { id: `${name}-${rows().length + 1}`, ...data }; rows().push(r); return r; },
    };
  };
  const names = ["user", "carrierPage", "address", "image", "authIdentity", "userFollow", "savedRoute", "tripFavorite", "notification", "consentLog", "trip", "tripDocument", "booking", "review", "message", "meetup", "phoneReveal", "report", "dataRequest", "erasedAccount", "adminAction"] as const;
  const db = Object.fromEntries(names.map((n) => [n, delegate(n)])) as unknown as PrivacyDb & { tables: typeof tables; calls: string[] };
  db.$transaction = async (fn) => fn(db);
  db.tables = tables;
  db.calls = calls;
  return db;
}

const NOW = new Date("2026-09-05T12:00:00.000Z");
const U = "aaaaaaaaaaaaaaaaaaaaaaaa";
const member = { id: U, email: "awa@example.com", emailNormalized: "awa@example.com", firstName: "Awa", lastName: "Diop", preferredLocale: "fr", isDeleted: false, roles: ["SHIPPER"], adminRoles: [], adminRole: null, carrierPage: null, phoneE164: "+33600000000", publicSlug: "awa-diop", messagingReminderEmails: true };

describe("erasureBlockers (D63 3A)", () => {
  it("compte sans deal vivant → aucun bloqueur", async () => {
    const svc = makePrivacyService({ db: fakeDb({ user: [member] }), clock: () => NOW });
    expect(await svc.erasureBlockers(U)).toEqual({ blockers: [], counts: { ACTIVE_DEAL: 0, PENDING_REQUEST: 0, PAYOUT_PENDING: 0, RETENTION_HELD: 0, PUBLISHED_TRIP: 0, ADMIN_ACCOUNT: 0 } });
  });
  it("deal en cours, demande en attente, versement en échec, retenue en médiation, trajet publié, profil admin : chacun bloque, dans l'ordre fermé", async () => {
    const db = fakeDb({
      user: [{ ...member, adminRoles: ["SUPPORT"] }],
      booking: [
        { shipperId: U, carrierId: "x", status: "PICKED_UP", isDeleted: false },
        { shipperId: "x", carrierId: U, status: "PENDING", isDeleted: false },
        { shipperId: "x", carrierId: U, status: "COMPLETED", payoutStatus: "FAILED", isDeleted: false },
        { shipperId: U, carrierId: "x", status: "CANCELLED", retentionDisposition: "HELD_FOR_MEDIATION", isDeleted: false },
        { shipperId: U, carrierId: "x", status: "COMPLETED", payoutStatus: "SENT", isDeleted: false },
      ],
      trip: [{ userId: U, status: "PUBLISHED", isDeleted: false }, { userId: U, status: "COMPLETED", isDeleted: false }],
    });
    const r = await makePrivacyService({ db }).erasureBlockers(U);
    expect(r.blockers).toEqual(["ACTIVE_DEAL", "PENDING_REQUEST", "PAYOUT_PENDING", "RETENTION_HELD", "PUBLISHED_TRIP", "ADMIN_ACCOUNT"]);
    expect(r.counts.ACTIVE_DEAL).toBe(1);
    expect(r.counts.PUBLISHED_TRIP).toBe(1);
  });
});

describe("eraseAccount (D63 4A)", () => {
  it("refus : 409 typé, une ligne DataRequest REFUSED avec les motifs, rien d'autre n'est touché", async () => {
    const db = fakeDb({ user: [member], booking: [{ shipperId: U, carrierId: "x", status: "ACCEPTED", isDeleted: false }] });
    const svc = makePrivacyService({ db, clock: () => NOW });
    await expect(svc.eraseAccount({ userId: U, channel: "MEMBER" })).rejects.toBeInstanceOf(ErasureBlockedError);
    expect(db.tables.dataRequest).toEqual([expect.objectContaining({ type: "ERASURE", status: "REFUSED", refusalReasons: ["ACTIVE_DEAL"], channel: "MEMBER" })]);
    expect(db.tables.user[0].isDeleted).toBe(false);
    expect(db.calls.filter((c) => c.endsWith("deleteMany"))).toHaveLength(0);
  });
  it("anonymise le User champ par champ, efface ce qui n'a plus de raison d'être, garde le reste, déplace Stripe dans ErasedAccount", async () => {
    const after = jest.fn().mockResolvedValue(undefined);
    const db = fakeDb({
      user: [{ ...member, carrierPage: { id: "cp1", stripeAccountId: "acct_123" } }],
      carrierPage: [{ id: "cp1", userId: U, name: "Awa D.", bio: "…", stripeAccountId: "acct_123" }],
      address: [{ id: "a1", userId: U }, { id: "a2", userId: "other" }],
      authIdentity: [{ id: "g1", userId: U }],
      userFollow: [{ id: "f1", followerId: U, followedId: "b" }, { id: "f2", followerId: "c", followedId: U }, { id: "f3", followerId: "c", followedId: "d" }],
      savedRoute: [{ id: "s1", userId: U }],
      tripFavorite: [{ id: "t1", userId: U }],
      notification: [{ id: "n1", userId: U }, { id: "n2", userId: "other" }],
      tripDocument: [{ id: "d1", fileId: "ik-1", tripId: "trip1" }, { id: "d2", fileId: null, tripId: "trip1" }],
      consentLog: [{ id: "c1", userId: U, type: "TERMS", version: "v3", ipAddress: "10.0.0.1", userAgent: "Safari" }],
      booking: [{ id: "b1", shipperId: U, carrierId: "x", status: "COMPLETED", payoutStatus: "SENT", isDeleted: false }],
      review: [{ id: "r1", authorUserId: U, comment: "Top" }],
      message: [{ id: "m1", authorId: U, body: "Bonjour" }],
    });
    const svc = makePrivacyService({ db, clock: () => NOW, afterErase: after });
    const r = await svc.eraseAccount({ userId: U, channel: "MEMBER", ip: "10.0.0.2", userAgent: "Chrome" });
    const u = db.tables.user[0];
    expect(u).toMatchObject({ firstName: "Membre", lastName: "supprimé", email: erasedEmailFor(U), emailNormalized: erasedEmailFor(U), passwordHash: null, phoneE164: null, publicSlug: erasedSlugFor(U), roles: [], adminRoles: [], isDeleted: true, deletedAt: NOW, messagingReminderEmails: false });
    expect(db.tables.carrierPage[0]).toMatchObject({ name: "Membre supprimé", bio: null, stripeAccountId: null });
    expect(db.tables.address.map((a) => a.id)).toEqual(["a2"]);
    expect(db.tables.authIdentity).toHaveLength(0);
    expect(db.tables.userFollow.map((f) => f.id)).toEqual(["f3"]);
    expect(db.tables.savedRoute).toHaveLength(0);
    expect(db.tables.tripFavorite).toHaveLength(0);
    expect(db.tables.notification.map((n) => n.id)).toEqual(["n2"]);
    expect(db.tables.tripDocument).toHaveLength(0);
    expect(db.tables.consentLog[0]).toMatchObject({ type: "TERMS", version: "v3", ipAddress: null, userAgent: null });
    // conservés : réservations, avis, messages
    expect(db.tables.booking).toHaveLength(1);
    expect(db.tables.review[0].comment).toBe("Top");
    expect(db.tables.message[0].body).toBe("Bonjour");
    expect(db.tables.erasedAccount).toEqual([expect.objectContaining({ userId: U, channel: "MEMBER", stripeAccountId: "acct_123", erasedAt: NOW })]);
    expect(db.tables.dataRequest).toEqual([expect.objectContaining({ type: "ERASURE", status: "DONE", channel: "MEMBER", ip: "10.0.0.2" })]);
    expect(db.tables.adminAction).toHaveLength(0);
    expect(r).toMatchObject({ erased: true, userId: U, email: "awa@example.com", firstName: "Awa", locale: "fr", fileIds: ["ik-1"], stripeAccountId: "acct_123" });
    expect(after).toHaveBeenCalledWith(expect.objectContaining({ fileIds: ["ik-1"] }));
  });
  it("canal admin : journal ACCOUNT_ERASED dans la transaction, motif au registre", async () => {
    const db = fakeDb({ user: [member] });
    await makePrivacyService({ db, clock: () => NOW }).eraseAccount({ userId: U, channel: "ADMIN", requestedByAdminId: "bbbbbbbbbbbbbbbbbbbbbbbb", reason: "Demande reçue par email le 4 septembre 2026" });
    expect(db.tables.adminAction).toEqual([expect.objectContaining({ adminUserId: "bbbbbbbbbbbbbbbbbbbbbbbb", action: "ACCOUNT_ERASED", targetType: "USER", targetId: U })]);
    expect(db.tables.dataRequest[0]).toMatchObject({ channel: "ADMIN", reason: "Demande reçue par email le 4 septembre 2026", status: "DONE" });
    expect(db.tables.erasedAccount[0]).toMatchObject({ channel: "ADMIN", stripeAccountId: null });
  });
  it("un compte déjà effacé ne s'efface pas deux fois", async () => {
    const db = fakeDb({ user: [{ ...member, isDeleted: true }] });
    await expect(makePrivacyService({ db }).eraseAccount({ userId: U, channel: "MEMBER" })).rejects.toThrow("ACCOUNT_NOT_FOUND");
  });
  it("anonymizedUserData : jamais null sur un unique nullable (email, slug)", () => {
    const d = anonymizedUserData(U, NOW);
    expect(d.email).toContain(U);
    expect(d.publicSlug).toBe(`deleted-${U}`);
    expect(d.totpBackupCodeHashes).toEqual([]);
  });
});

describe("buildDataExport (D63 2A)", () => {
  it("expose son rôle et ses montants par réservation, jamais l'identité de l'autre partie ; ses avis reçus seulement révélés ; ses signalements faits", async () => {
    const db = fakeDb({
      user: [member],
      booking: [
        { id: "b1", shipperId: U, carrierId: "car", status: "COMPLETED", recipient: { firstName: "Moussa" }, refundAmountCents: 0, retentionCents: 0, payoutStatus: "SENT", payoutAmountCents: 1800, pricing: { totalShipperCents: 2500 } },
        { id: "b2", shipperId: "shp", carrierId: U, status: "COMPLETED", recipient: { firstName: "Secret" }, payoutStatus: "SENT", payoutAmountCents: 1800, pricing: { totalShipperCents: 2500 } },
      ],
      review: [{ id: "r1", authorUserId: U, subjectUserId: "car", rating: 5, revealedAt: NOW }, { id: "r2", authorUserId: "car", subjectUserId: U, rating: 4, revealedAt: null }, { id: "r3", authorUserId: "car", subjectUserId: U, rating: 3, revealedAt: NOW }],
      report: [{ id: "rp1", reporterUserId: U, reason: "SCAM" }, { id: "rp2", reporterUserId: "car", reason: "OTHER" }],
      message: [{ id: "m1", authorId: U, body: "moi" }, { id: "m2", authorId: "car", body: "lui" }],
    });
    const x = await makePrivacyService({ db, clock: () => NOW }).buildDataExport(U);
    expect(x.format).toBe("yamba-data-export/1");
    expect(x.bookings).toHaveLength(2);
    const asShipper = x.bookings.find((b) => b.id === "b1")!;
    const asCarrier = x.bookings.find((b) => b.id === "b2")!;
    expect(asShipper).toMatchObject({ role: "SHIPPER", recipient: { firstName: "Moussa" }, refundAmountCents: 0 });
    expect(asShipper.payoutAmountCents).toBeUndefined();
    expect(asCarrier).toMatchObject({ role: "CARRIER", payoutAmountCents: 1800 });
    expect(asCarrier.recipient).toBeUndefined(); // le destinataire de l'Expéditeur n'appartient pas au Voyageur
    expect(JSON.stringify(x)).not.toContain("deliveryCode");
    expect(x.reviewsGiven.map((r) => r.id)).toEqual(["r1"]);
    expect(x.reviewsReceived.map((r) => r.id)).toEqual(["r3"]);
    expect(x.reportsMade.map((r) => r.id)).toEqual(["rp1"]);
    expect(x.messages.map((m) => m.id)).toEqual(["m1"]);
    expect(x.preferences).toEqual({ preferredLocale: "fr", messagingReminderEmails: true });
  });
  it("recordExport / lastExportAt : la règle « une fois par 24 h » a de quoi se décider", async () => {
    const db = fakeDb({ user: [member] });
    const svc = makePrivacyService({ db, clock: () => NOW });
    expect(await svc.lastExportAt(U)).toBeNull();
    await svc.recordExport(U, "MEMBER", { ip: "1.1.1.1" });
    expect(await svc.lastExportAt(U)).toEqual(NOW);
  });
});
