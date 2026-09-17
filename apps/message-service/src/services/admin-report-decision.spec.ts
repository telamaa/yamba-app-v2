/**
 * admin-report-decision.spec.ts — décision de l'utilisateur du 15/09/2026 (recette 02-ADMIN § 5.19) : sous « traité » et
 * « sans suite », la file des messages signalés dit qui a décidé, quand, et la note. Source : la ligne de journal
 * MESSAGE_REPORT_REVIEWED écrite dans la même transaction que la décision — lecture seule.
 */
const prismaMock = {
  report: { findMany: jest.fn() },
  message: { findMany: jest.fn() },
  conversation: { findMany: jest.fn() },
  booking: { findMany: jest.fn() },
  user: { findMany: jest.fn() },
  adminAction: { findMany: jest.fn() },
};
jest.mock("@packages/libs/prisma", () => ({ __esModule: true, default: prismaMock }));

import { makeAdminConversationService } from "./admin-conversation.service";

const LE = (j: string) => new Date(`2026-09-${j}T10:00:00.000Z`);
const signalement = (id: string, status: string) => ({ id, targetType: "MESSAGE", targetId: "m1", reporterUserId: "u-pauline", reason: "SCAM", details: null, status, createdAt: LE("01"), updatedAt: LE("01") });

describe("listReports — la décision lue au journal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.message.findMany.mockResolvedValue([{ id: "m1", conversationId: "c1", authorId: "u-thomas", body: "hors appli", createdAt: LE("02") }]);
    prismaMock.conversation.findMany.mockResolvedValue([{ id: "c1", bookingId: "b1", shipperId: "u-pauline", carrierId: "u-thomas" }]);
    prismaMock.booking.findMany.mockResolvedValue([{ id: "b1", trip: { originCity: "Paris", destinationCity: "Brazzaville" } }]);
    prismaMock.user.findMany.mockImplementation(async ({ where }: { where: { id: { in: string[] } } }) =>
      [{ id: "u-pauline", firstName: "Pauline" }, { id: "u-thomas", firstName: "Thomas" }, { id: "adm-nadia", firstName: "Nadia" }].filter((u) => where.id.in.includes(u.id))
    );
  });

  it("onglet « traité » : prénom de l'admin, date de la ligne, note", async () => {
    prismaMock.report.findMany.mockResolvedValue([signalement("r1", "REVIEWED")]);
    prismaMock.adminAction.findMany.mockResolvedValue([{ targetId: "r1", adminUserId: "adm-nadia", createdAt: LE("03"), after: { status: "REVIEWED", note: "Rappel des règles envoyé." } }]);
    const { items } = await makeAdminConversationService().listReports("REVIEWED");
    expect(items[0].decision).toEqual({ by: { id: "adm-nadia", firstName: "Nadia" }, at: LE("03").toISOString(), note: "Rappel des règles envoyé." });
    expect(prismaMock.adminAction.findMany.mock.calls[0][0].where).toEqual({ action: "MESSAGE_REPORT_REVIEWED", targetType: "REPORT", targetId: { in: ["r1"] } });
  });

  it("onglet « à traiter » : pas de lecture du journal, décision nulle", async () => {
    prismaMock.report.findMany.mockResolvedValue([signalement("r1", "OPEN")]);
    const { items } = await makeAdminConversationService().listReports("OPEN");
    expect(items[0].decision).toBeNull();
    expect(prismaMock.adminAction.findMany).not.toHaveBeenCalled();
  });

  it("donnée ancienne sans ligne de journal : décision nulle, pas d'erreur ; note vide → null", async () => {
    prismaMock.report.findMany.mockResolvedValue([signalement("r-ancien", "DISMISSED"), signalement("r2", "DISMISSED")]);
    prismaMock.adminAction.findMany.mockResolvedValue([{ targetId: "r2", adminUserId: "adm-nadia", createdAt: LE("04"), after: { status: "DISMISSED", note: null } }]);
    const { items } = await makeAdminConversationService().listReports("DISMISSED");
    expect(items.map((i) => i.decision)).toEqual([null, { by: { id: "adm-nadia", firstName: "Nadia" }, at: LE("04").toISOString(), note: null }]);
  });
});
