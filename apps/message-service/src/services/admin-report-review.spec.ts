/**
 * admin-report-review.spec.ts — ANO-ADM-46 : deux décisions simultanées sur un signalement de message
 * (recette 02-ADMIN § 5.19, fiche ADM-SIG-8, majeure).
 *
 * Trois « Traité » envoyés au même instant : MongoDB rejetait deux transactions (P2034, « write conflict ») et les deux
 * administrateurs perdants lisaient 500. Le conflit d'écriture est rejoué ; au réessai, la garde conditionnelle
 * (`updateMany … status: "OPEN"`) répond 409 — une décision, une ligne de journal, deux refus compréhensibles.
 */
const conflit = () => Object.assign(new Error("Transaction failed due to a write conflict or a deadlock. Please retry your transaction"), { code: "P2034" });
const tx = { report: { updateMany: jest.fn() }, adminAction: { create: jest.fn() } };
const prismaMock = {
  report: { findFirst: jest.fn() },
  $transaction: jest.fn(),
};
jest.mock("@packages/libs/prisma", () => ({ __esModule: true, default: prismaMock }));

import { makeAdminConversationService } from "./admin-conversation.service";

const actor = { id: "adm-1", ip: "10.0.0.1", userAgent: "jest" };

describe("reviewReport — un conflit d'écriture n'est pas une réponse", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.report.findFirst.mockResolvedValue({ id: "r1", status: "OPEN" });
  });

  it("P2034 puis la garde trouve le signalement déjà traité → 409 REPORT_ALREADY_REVIEWED, jamais 500, aucune ligne", async () => {
    prismaMock.$transaction.mockRejectedValueOnce(conflit()).mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));
    tx.report.updateMany.mockResolvedValue({ count: 0 }); // l'autre administrateur a gagné entre-temps
    await expect(makeAdminConversationService().reviewReport(actor, "r1", { decision: "REVIEWED" })).rejects.toMatchObject({ statusCode: 409, details: { code: "REPORT_ALREADY_REVIEWED" } });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2);
    expect(tx.adminAction.create).not.toHaveBeenCalled();
  });

  it("P2034 puis la voie est libre → la décision passe au réessai, une seule ligne de journal", async () => {
    prismaMock.$transaction.mockRejectedValueOnce(conflit()).mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));
    tx.report.updateMany.mockResolvedValue({ count: 1 });
    await expect(makeAdminConversationService().reviewReport(actor, "r1", { decision: "DISMISSED", note: "  rien  " })).resolves.toEqual({ id: "r1", status: "DISMISSED" });
    expect(tx.adminAction.create).toHaveBeenCalledTimes(1);
    expect(tx.adminAction.create.mock.calls[0][0].data).toMatchObject({ action: "MESSAGE_REPORT_REVIEWED", targetId: "r1", before: { status: "OPEN" }, after: { status: "DISMISSED", note: "rien" } });
  });

  it("une autre erreur n'est jamais rejouée", async () => {
    prismaMock.$transaction.mockRejectedValueOnce(new Error("panne"));
    await expect(makeAdminConversationService().reviewReport(actor, "r1", { decision: "REVIEWED" })).rejects.toThrow("panne");
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });
});
