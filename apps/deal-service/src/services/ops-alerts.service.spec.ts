/** ops-alerts.service.spec.ts — dédoublonnage du cron (C-PR6b, D59 4A) */
const prismaMock = { booking: { count: jest.fn() }, dispute: { findMany: jest.fn() }, outboxEvent: { count: jest.fn(), findFirst: jest.fn() }, emailDelivery: { count: jest.fn() }, trip: { findFirst: jest.fn() } };
jest.mock("@packages/libs/prisma", () => ({ __esModule: true, default: prismaMock }), { virtual: true });
const sendTransactionalEmail = jest.fn().mockResolvedValue(undefined);
jest.mock("@packages/email", () => ({ isEmailConfigured: () => true, sendTransactionalEmail: (...a: unknown[]) => sendTransactionalEmail(...a) }), { virtual: true });

import { makeOpsAlertsService, type AlertDedupStore } from "./ops-alerts.service";

const NOW = new Date("2026-09-04T10:00:00.000Z");
function mapStore(): AlertDedupStore & { keys: Set<string> } {
  const keys = new Set<string>();
  return { keys, async set(key, _v, _m, _s, flag) { if (flag === "NX" && keys.has(key)) return null; keys.add(key); return "OK"; } };
}
const alert = (rule: "OUTBOX_PARKED" | "EMAILS_FAILED_24H") => ({ rule, severity: "critical" as const, title: rule, detail: "d", count: 1, href: "/pilotage" });

describe("ops-alerts.service — notifyNewAlerts", () => {
  beforeEach(() => jest.clearAllMocks());
  it("envoie UN email listant les alertes nouvelles du jour ; une seconde passe n'envoie rien", async () => {
    const store = mapStore();
    const svc = makeOpsAlertsService(() => NOW);
    expect(await svc.notifyNewAlerts(store, [alert("OUTBOX_PARKED"), alert("EMAILS_FAILED_24H")])).toEqual(["OUTBOX_PARKED", "EMAILS_FAILED_24H"]);
    expect(sendTransactionalEmail).toHaveBeenCalledTimes(1);
    expect(sendTransactionalEmail.mock.calls[0][0].content.paragraphs.join(" ")).toContain("OUTBOX_PARKED");
    expect(await svc.notifyNewAlerts(store, [alert("OUTBOX_PARKED"), alert("EMAILS_FAILED_24H")])).toEqual([]);
    expect(sendTransactionalEmail).toHaveBeenCalledTimes(1);
    // le lendemain, la même règle repart
    expect(await makeOpsAlertsService(() => new Date("2026-09-05T10:00:00Z")).notifyNewAlerts(store, [alert("OUTBOX_PARKED")])).toEqual(["OUTBOX_PARKED"]);
  });
  it("evaluate : instantané depuis la base → alertes typées (plateforme calme = aucune)", async () => {
    prismaMock.booking.count.mockResolvedValue(0);
    prismaMock.dispute.findMany.mockResolvedValue([]);
    prismaMock.outboxEvent.count.mockResolvedValue(0);
    prismaMock.outboxEvent.findFirst.mockResolvedValue(null);
    prismaMock.emailDelivery.count.mockResolvedValue(0);
    prismaMock.trip.findFirst.mockResolvedValue({ publishedAt: new Date("2026-09-03T10:00:00Z") });
    const r = await makeOpsAlertsService(() => NOW).evaluate();
    expect(r.alerts).toEqual([]);
    expect(r.thresholds.payoutFailedHours).toBe(48);
    prismaMock.outboxEvent.count.mockResolvedValue(3);
    expect((await makeOpsAlertsService(() => NOW).evaluate()).alerts.map((a) => a.rule)).toEqual(["OUTBOX_PARKED"]);
  });
});
