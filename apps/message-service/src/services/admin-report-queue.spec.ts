/**
 * admin-report-queue.spec.ts — ANO-CRON-09 : un signalement dont le message a été purgé reste
 * dans la file de modération (recette crons du 09/09/2026, fiche CRON-SEC-3, majeure).
 *
 * Avant correction, `listReports` faisait `continue` quand le message ou son fil n'existait plus.
 * Le `Report` survivait en base — motif, statut, date — mais **disparaissait de la file** :
 * l'administrateur ne le voyait pas, ne pouvait pas le traiter, et le dossier restait `OPEN`
 * pour toujours. Le compteur, calculé sur les éléments rendus, ne le trahissait même pas.
 *
 * La conservation ne doit pas escamoter un dossier de modération. On rend donc le dossier
 * SANS son contenu — le compromis que le cahier de recette décrit noir sur blanc.
 */
const prismaMock = {
  report: { findMany: jest.fn() },
  message: { findMany: jest.fn() },
  conversation: { findMany: jest.fn() },
  booking: { findMany: jest.fn() },
  user: { findMany: jest.fn() },
};
jest.mock("@packages/libs/prisma", () => ({ __esModule: true, default: prismaMock }), { virtual: true });

import { makeAdminConversationService } from "./admin-conversation.service";

const LE = (n: string) => new Date(`2026-09-0${n}T10:00:00.000Z`);

const signalement = (id: string, cible: string) => ({
  id,
  targetType: "MESSAGE",
  targetId: cible,
  reporterUserId: "u-signalant",
  reason: "OFF_PLATFORM",
  details: "propose de payer en dehors",
  status: "OPEN",
  createdAt: LE("1"),
  updatedAt: LE("1"),
});

describe("listReports — la purge du fil n'escamote pas le dossier", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.booking.findMany.mockResolvedValue([{ id: "b1", trip: { originCity: "Paris", destinationCity: "Dakar" } }]);
    prismaMock.user.findMany.mockResolvedValue([
      { id: "u-signalant", firstName: "Pauline" },
      { id: "u-auteur", firstName: "Thomas" },
    ]);
  });

  it("le dossier dont le message a été purgé reste dans la file, marqué `purged`", async () => {
    prismaMock.report.findMany.mockResolvedValue([signalement("r-purge", "m-disparu")]);
    prismaMock.message.findMany.mockResolvedValue([]); // le message n'existe plus
    prismaMock.conversation.findMany.mockResolvedValue([]);

    const { items, total } = await makeAdminConversationService().listReports("OPEN");

    expect(total).toBe(1);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "r-purge",
      status: "OPEN",
      reason: "OFF_PLATFORM",
      details: "propose de payer en dehors",
      purged: true,
      author: null,
      conversationId: null,
      bookingId: null,
      corridor: null,
    });
    // Le motif, le statut et la date survivent — c'est tout l'intérêt du dossier.
    expect(items[0].createdAt).toBe(LE("1").toISOString());
    // Le signalant reste nommé : son prénom est chargé même sans conversation…
    expect(items[0].reporter).toEqual({ id: "u-signalant", firstName: "Pauline", role: null });
    // …mais son rôle est NUL : sans le fil, on ne peut pas le déduire, et l'inventer serait pire.
    expect(items[0].message).toEqual({ id: "m-disparu", body: null, createdAt: null });
  });

  it("un dossier vivant reste rendu en entier, `purged: false`", async () => {
    prismaMock.report.findMany.mockResolvedValue([signalement("r-vivant", "m1")]);
    prismaMock.message.findMany.mockResolvedValue([
      { id: "m1", conversationId: "c1", authorId: "u-auteur", body: "on se règle en espèces ?", createdAt: LE("2") },
    ]);
    prismaMock.conversation.findMany.mockResolvedValue([{ id: "c1", bookingId: "b1", shipperId: "u-signalant", carrierId: "u-auteur" }]);

    const { items } = await makeAdminConversationService().listReports("OPEN");

    expect(items[0]).toMatchObject({
      purged: false,
      conversationId: "c1",
      bookingId: "b1",
      corridor: { originCity: "Paris", destinationCity: "Dakar" },
    });
    expect(items[0].reporter.role).toBe("SHIPPER");
    expect(items[0].author).toMatchObject({ id: "u-auteur", firstName: "Thomas", role: "CARRIER" });
    expect(items[0].message.body).toBe("on se règle en espèces ?");
  });

  it("les deux cohabitent, et le compteur les compte tous les deux", async () => {
    prismaMock.report.findMany.mockResolvedValue([signalement("r-purge", "m-disparu"), signalement("r-vivant", "m1")]);
    prismaMock.message.findMany.mockResolvedValue([
      { id: "m1", conversationId: "c1", authorId: "u-auteur", body: "coucou", createdAt: LE("2") },
    ]);
    prismaMock.conversation.findMany.mockResolvedValue([{ id: "c1", bookingId: "b1", shipperId: "u-signalant", carrierId: "u-auteur" }]);

    const { items, total } = await makeAdminConversationService().listReports("OPEN");

    expect(total).toBe(2);
    expect(items.map((i) => i.purged)).toEqual([true, false]);
  });
});
