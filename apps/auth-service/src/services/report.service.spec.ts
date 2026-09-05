/** report.service.spec.ts — signalement d'un trajet ou d'un membre (D68) sur un faux Prisma en mémoire. */
import { makeReportService, type ReportDb } from "./report.service";

type Row = Record<string, unknown>;
function fakeDb(seed: Partial<Record<"trip" | "user" | "report" | "adminAction", Row[]>> = {}) {
  const tables: Record<string, Row[]> = {};
  const delegate = (name: string) => {
    tables[name] = structuredClone((seed as Record<string, Row[]>)[name] ?? []);
    const rows = () => tables[name];
    const matches = (row: Row, where: Row): boolean =>
      Object.entries(where ?? {}).every(([k, v]) => {
        if (k === "OR") return (v as Row[]).some((w) => matches(row, w));
        if (v && typeof v === "object" && "in" in (v as Row)) return ((v as Row).in as unknown[]).includes(row[k]);
        if (v && typeof v === "object" && "isSet" in (v as Row)) return (v as Row).isSet === false ? row[k] === undefined : row[k] !== undefined;
        if (v === null) return row[k] === null;
        return row[k] === v;
      });
    return {
      async findMany({ where }: { where?: Row }) { return rows().filter((r) => matches(r, where ?? {})); },
      async findFirst({ where }: { where?: Row }) { return rows().find((r) => matches(r, where ?? {})) ?? null; },
      async updateMany({ where, data }: { where: Row; data: Row }) { let n = 0; for (const r of rows().filter((x) => matches(x, where))) { Object.assign(r, data); n++; } return { count: n }; },
      async create({ data }: { data: Row }) { const r = { id: `${name}-${rows().length + 1}`, createdAt: new Date("2026-09-05T12:00:00.000Z"), ...data }; rows().push(r); return r; },
    };
  };
  const db = Object.fromEntries(["trip", "user", "report", "adminAction"].map((n) => [n, delegate(n)])) as unknown as ReportDb & { tables: typeof tables };
  db.$transaction = async (fn) => fn(db);
  db.tables = tables;
  return db;
}

const awa = { id: "u-awa", email: "awa@example.com", firstName: "Awa", lastName: "Diop", preferredLocale: "fr", isDeleted: false, publicSlug: "awa-diop", profilePublic: true };
const moussa = { id: "u-moussa", email: "moussa@example.com", firstName: "Moussa", lastName: "Ba", preferredLocale: "en", isDeleted: false, publicSlug: "moussa-ba", profilePublic: true };
const trip = { id: "t1", userId: "u-moussa", isDeleted: false, originCity: "Paris", destinationCity: "Dakar" };
const actor = { id: "adm", ip: "10.0.0.1", userAgent: "jest" };

describe("createReport (D68 1A/2A)", () => {
  it("trajet d'un autre membre → OPEN, targetId = id du trajet, accusé de réception dans la langue de l'auteur", async () => {
    const sent: string[] = [];
    const db = fakeDb({ user: [awa, moussa], trip: [trip] });
    const svc = makeReportService({ db, sendEmail: async (to, locale, email) => { sent.push(`${to}|${locale}|${email.subject}`); return true; } });
    const r = await svc.createReport("u-awa", { targetType: "TRIP", targetRef: "t1", reason: "SCAM", details: "  paie hors Yamba " });
    expect(r.reportId).toBe("report-1");
    expect(db.tables.report[0]).toMatchObject({ reporterUserId: "u-awa", targetType: "TRIP", targetId: "t1", reason: "SCAM", details: "paie hors Yamba", status: "OPEN" });
    expect(sent).toEqual(["awa@example.com|fr|Ton signalement a bien été reçu"]);
  });
  it("membre par son slug → targetId = id du membre ; page masquée ou compte effacé → 404", async () => {
    const db = fakeDb({ user: [awa, moussa, { ...awa, id: "u-hidden", publicSlug: "hidden", profilePublic: false }] });
    const svc = makeReportService({ db, sendEmail: async () => true });
    const r = await svc.createReport("u-awa", { targetType: "USER", targetRef: "moussa-ba", reason: "IMPERSONATION" });
    expect(r.reportId).toBe("report-1");
    expect(db.tables.report[0]).toMatchObject({ targetType: "USER", targetId: "u-moussa" });
    await expect(svc.createReport("u-awa", { targetType: "USER", targetRef: "hidden", reason: "SCAM" })).rejects.toMatchObject({ statusCode: 404 });
    await expect(svc.createReport("u-awa", { targetType: "TRIP", targetRef: "nope", reason: "SCAM" })).rejects.toMatchObject({ statusCode: 404 });
  });
  it("sa propre cible → 400 OWN_TARGET ; motif hors liste → 400 ; doublon ouvert → 409, doublon traité → accepté", async () => {
    const db = fakeDb({ user: [awa, moussa], trip: [trip], report: [{ id: "r0", reporterUserId: "u-awa", targetType: "TRIP", targetId: "t1", status: "REVIEWED", reason: "SCAM", createdAt: new Date() }] });
    const svc = makeReportService({ db, sendEmail: async () => true });
    await expect(svc.createReport("u-moussa", { targetType: "TRIP", targetRef: "t1", reason: "SCAM" })).rejects.toMatchObject({ statusCode: 400, details: { code: "OWN_TARGET" } });
    await expect(svc.createReport("u-awa", { targetType: "USER", targetRef: "moussa-ba", reason: "ILLEGAL_CONTENT" })).rejects.toMatchObject({ statusCode: 400, details: { code: "REASON_NOT_ALLOWED" } });
    await svc.createReport("u-awa", { targetType: "TRIP", targetRef: "t1", reason: "SCAM" }); // l'ancien est traité : un nouveau est possible
    await expect(svc.createReport("u-awa", { targetType: "TRIP", targetRef: "t1", reason: "OTHER" })).rejects.toMatchObject({ statusCode: 409 });
  });
  it("auteur en suppression email → pas d'envoi, le signalement est quand même écrit", async () => {
    const sent: string[] = [];
    const db = fakeDb({ user: [{ ...awa, emailSuppressedAt: new Date() }, moussa], trip: [trip] });
    const svc = makeReportService({ db, sendEmail: async (to) => { sent.push(to); return true; } });
    await svc.createReport("u-awa", { targetType: "TRIP", targetRef: "t1", reason: "SCAM" });
    expect(db.tables.report).toHaveLength(1);
    expect(sent).toEqual([]);
  });
});

describe("listReports / reviewReport (D68 3A)", () => {
  const open = (id: string, reporter: string, targetType: string, targetId: string, status = "OPEN") => ({ id, reporterUserId: reporter, targetType, targetId, reason: "SCAM", details: null, status, createdAt: new Date(`2026-09-0${id.length}T00:00:00.000Z`) });
  it("file enrichie : corridor et propriétaire d'un trajet, nom d'un membre, prioritaire dès 3 ouverts, messages exclus", async () => {
    const db = fakeDb({
      user: [awa, moussa, { ...awa, id: "u-3", publicSlug: "x" }, { ...awa, id: "u-4", publicSlug: "y" }],
      trip: [trip],
      report: [open("r1", "u-awa", "TRIP", "t1"), open("r2", "u-3", "TRIP", "t1"), open("r3", "u-4", "TRIP", "t1"), open("r4", "u-awa", "USER", "u-moussa"), open("r5", "u-awa", "MESSAGE", "m1")],
    });
    const svc = makeReportService({ db, sendEmail: async () => true });
    const list = await svc.listReports("OPEN");
    expect(list.total).toBe(4);
    expect(list.items[0]).toMatchObject({ targetType: "TRIP", targetLabel: "Paris → Dakar", targetOwner: { id: "u-moussa", firstName: "Moussa" }, reporter: { firstName: "Awa" }, openCountOnTarget: 3, priority: true });
    expect(list.items[3]).toMatchObject({ targetType: "USER", targetId: "u-moussa", targetLabel: "Moussa Ba", targetOwner: null, openCountOnTarget: 1, priority: false });
  });
  it("décision + journal dans la transaction ; deuxième décision → 409 ; un signalement de message n'est pas traité ici", async () => {
    const db = fakeDb({ user: [awa, moussa], trip: [trip], report: [open("r1", "u-awa", "TRIP", "t1"), open("r5", "u-awa", "MESSAGE", "m1")] });
    const svc = makeReportService({ db, sendEmail: async () => true });
    await expect(svc.reviewReport(actor, "r1", { decision: "DISMISSED", note: "rien à voir" })).resolves.toEqual({ id: "r1", status: "DISMISSED" });
    expect(db.tables.report[0].status).toBe("DISMISSED");
    expect(db.tables.adminAction[0]).toMatchObject({ action: "REPORT_REVIEWED", targetType: "REPORT", targetId: "r1", adminUserId: "adm" });
    await expect(svc.reviewReport(actor, "r1", { decision: "REVIEWED" })).rejects.toMatchObject({ statusCode: 409 });
    await expect(svc.reviewReport(actor, "r5", { decision: "REVIEWED" })).rejects.toMatchObject({ statusCode: 404 });
  });
});
