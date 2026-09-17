/**
 * arbitrages-moderation.spec.ts — A198 (f) et (g) côté auth-service
 * ==================================================================
 * (f) Sanctionner en voyant ce qu'on sanctionne. Le Support lit un signalement, le traite, puis sanctionne le
 *     membre : au moment de choisir la catégorie (qui, elle, part au membre — A193), le motif du signalement
 *     n'est plus sous ses yeux et le dossier ne se rouvre pas. La fiche membre porte donc les signalements
 *     OUVERTS — mais seulement pour qui a le droit de les lire : le détail est écrit par un membre et peut
 *     nommer des tiers. `null` veut dire « pas le droit », et surtout PAS « aucun signalement ».
 *
 * (g) « Prioritaire dès 3 ouverts » compte des SIGNALANTS DISTINCTS. Trois personnes qui signalent la même
 *     cible, c'est un signal ; une personne qui clique trois fois, non.
 */
const prismaMock = {
  report: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
  trip: { findMany: jest.fn(), findFirst: jest.fn() },
  user: { findMany: jest.fn(), findFirst: jest.fn() },
  adminAction: { findMany: jest.fn() },
};
jest.mock("@packages/libs/prisma", () => ({ __esModule: true, default: prismaMock }));
// Redis, email et le service voisin ouvrent des singletons au chargement : sans doubles, la suite passe mais
// Jest ne rend jamais la main (A197 — le même piège que sur les fiches de concurrence).
jest.mock("@packages/libs/redis", () => ({ __esModule: true, default: { get: jest.fn(), set: jest.fn(), del: jest.fn() } }));
jest.mock("@packages/email", () => ({ isEmailConfigured: () => false, sendTransactionalEmail: jest.fn() }));
jest.mock("./admin-users.service", () => ({ assessTrust: async () => ({ level: "STANDARD", score: 50, factors: [] }) }));
jest.mock("../emails/send-auth-email", () => ({ sendAuthEmail: jest.fn(async () => undefined) }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { makeReportService } = require("./report.service") as typeof import("./report.service");

const CIBLE = "64b0000000000000000000a1";
const T0 = new Date("2026-09-17T08:00:00.000Z");

const ligne = (id: string, reporterUserId: string) => ({
  id,
  targetType: "USER",
  targetId: CIBLE,
  reporterUserId,
  reason: "SCAM_SUSPECTED",
  details: null,
  status: "OPEN",
  createdAt: T0,
});

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.trip.findMany.mockResolvedValue([]);
  prismaMock.adminAction.findMany.mockResolvedValue([]);
  prismaMock.user.findMany.mockResolvedValue([{ id: CIBLE, firstName: "Marc", lastName: "Tremblay" }]);
});

describe("A198 (g) — « prioritaire » compte des personnes, pas des lignes", () => {
  it("trois lignes du MÊME signalant : 1 signalant, la cible n'est pas prioritaire", async () => {
    const lignes = [ligne("r1", "s1"), ligne("r2", "s1"), ligne("r3", "s1")];
    prismaMock.report.findMany.mockResolvedValueOnce(lignes).mockResolvedValueOnce(lignes.map((r) => ({ targetId: r.targetId, reporterUserId: r.reporterUserId })));

    const { items } = await makeReportService().listReports("OPEN" as never);

    expect(items[0].openCountOnTarget).toBe(1);
  });

  it("trois signalants DIFFÉRENTS : 3, la cible est prioritaire", async () => {
    const lignes = [ligne("r1", "s1"), ligne("r2", "s2"), ligne("r3", "s3")];
    prismaMock.report.findMany.mockResolvedValueOnce(lignes).mockResolvedValueOnce(lignes.map((r) => ({ targetId: r.targetId, reporterUserId: r.reporterUserId })));
    prismaMock.user.findMany.mockResolvedValue([
      { id: CIBLE, firstName: "Marc", lastName: "Tremblay" },
      { id: "s1", firstName: "Awa", lastName: "Diop" },
      { id: "s2", firstName: "João", lastName: "Silva" },
      { id: "s3", firstName: "Chinwe", lastName: "Okafor" },
    ]);

    const { items } = await makeReportService().listReports("OPEN" as never);

    expect(items[0].openCountOnTarget).toBe(3);
  });
});

export {};
