/** email-suppression.service.spec.ts — lever une suppression d'adresse (D35 4A, A155, recette 02-ADMIN § 5.5). */
import { makeEmailSuppressionService, type EmailSuppressionDb } from "./email-suppression.service";

const META = { ip: "127.0.0.1", userAgent: "jest" };
const REASON = "Adresse corrigée par le membre au téléphone avec le support";

function fakeDb(state: { emailSuppressedAt: Date | null }) {
  const journal: Array<Record<string, unknown>> = [];
  const db: EmailSuppressionDb = {
    user: {
      async updateMany({ where }) {
        if (!state.emailSuppressedAt || state.emailSuppressedAt.getTime() !== where.emailSuppressedAt.getTime()) return { count: 0 };
        state.emailSuppressedAt = null;
        return { count: 1 };
      },
    },
    adminAction: { async create({ data }) { journal.push(data); return data; } },
    async $transaction(fn) { return fn(db); },
  };
  const svc = makeEmailSuppressionService({ db, record: async (_tx, entry) => { journal.push(entry); } });
  return { svc, journal, state };
}

describe("email-suppression.service — lift (A155)", () => {
  const at = new Date("2026-09-13T08:00:00.000Z");
  const user = { id: "u1", emailSuppressedAt: at, emailSuppressedReason: "HARD_BOUNCE" };

  it("lève, écrit UNE ligne avec la date, le motif du fournisseur et le motif de l'admin", async () => {
    const f = fakeDb({ emailSuppressedAt: at });
    const r = await f.svc.lift("adm1", user, { reason: REASON }, META);
    expect(r).toEqual({ ok: true, emailSuppression: null, liftedFrom: { at: at.toISOString(), reason: "HARD_BOUNCE" } });
    expect(f.state.emailSuppressedAt).toBeNull();
    expect(f.journal).toEqual([
      expect.objectContaining({ adminUserId: "adm1", action: "EMAIL_SUPPRESSION_LIFTED", targetType: "USER", targetId: "u1", before: { emailSuppressedAt: at.toISOString(), reason: "HARD_BOUNCE" }, after: { emailSuppressedAt: null, liftReason: REASON }, ip: "127.0.0.1" }),
    ]);
  });

  it("refuse une adresse non supprimée (400 EMAIL_NOT_SUPPRESSED), sans rien écrire", async () => {
    const f = fakeDb({ emailSuppressedAt: null });
    await expect(f.svc.lift("adm1", { ...user, emailSuppressedAt: null }, { reason: REASON }, META)).rejects.toMatchObject({ statusCode: 400, details: { code: "EMAIL_NOT_SUPPRESSED" } });
    expect(f.journal).toEqual([]);
  });

  it("exige un motif d'au moins 20 caractères (400 REASON_REQUIRED)", async () => {
    const f = fakeDb({ emailSuppressedAt: at });
    await expect(f.svc.lift("adm1", user, {}, META)).rejects.toMatchObject({ statusCode: 400, details: { code: "REASON_REQUIRED" } });
    await expect(f.svc.lift("adm1", user, { reason: "   trop court   " }, META)).rejects.toMatchObject({ statusCode: 400, details: { code: "REASON_REQUIRED" } });
    expect(f.state.emailSuppressedAt).toEqual(at);
    expect(f.journal).toEqual([]);
  });

  it("conflit d'écriture Mongo (P2034, mesuré en recette : 500) : rejoué, puis 400 EMAIL_NOT_SUPPRESSED si l'autre a levé", async () => {
    const f = fakeDb({ emailSuppressedAt: at });
    await f.svc.lift("adm1", user, { reason: REASON }, META);
    // La seconde, lancée en même temps, voit sa transaction rejetée une fois par MongoDB.
    let essais = 0;
    const conflictDb: EmailSuppressionDb = {
      user: { async updateMany() { return { count: 0 }; } },
      adminAction: { async create() { return null; } },
      async $transaction(fn) {
        essais += 1;
        if (essais === 1) throw Object.assign(new Error("Transaction failed due to a write conflict or a deadlock"), { code: "P2034" });
        return fn(conflictDb);
      },
    };
    const second = makeEmailSuppressionService({ db: conflictDb, record: async () => undefined });
    await expect(second.lift("adm2", user, { reason: REASON }, META)).rejects.toMatchObject({ statusCode: 400, details: { code: "EMAIL_NOT_SUPPRESSED" } });
    expect(essais).toBe(2); // rejouée une fois
    expect(f.journal).toHaveLength(1);
  });

  it("deux levées concurrentes : une seule ligne, la seconde reçoit EMAIL_NOT_SUPPRESSED", async () => {
    const f = fakeDb({ emailSuppressedAt: at });
    const [a, b] = await Promise.allSettled([f.svc.lift("adm1", user, { reason: REASON }, META), f.svc.lift("adm2", user, { reason: REASON }, META)]);
    expect([a.status, b.status].sort()).toEqual(["fulfilled", "rejected"]);
    expect(f.journal).toHaveLength(1);
  });
});
