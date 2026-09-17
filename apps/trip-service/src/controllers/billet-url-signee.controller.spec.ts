/**
 * billet-url-signee.controller.spec.ts — A198 (e) : un justificatif ne se sert pas par une URL permanente
 * ========================================================================================================
 * Un billet d'avion porte un nom, un numéro de vol, parfois un numéro de réservation. Servi par une URL
 * ImageKit ordinaire, il reste lisible POUR TOUJOURS par quiconque a l'URL — et une URL se recopie : dans un
 * message, dans un ticket de support, dans un journal. Le risque n'est pas l'énumération (le chemin est
 * aléatoire), c'est le partage, et l'impossibilité de révoquer.
 *
 * L'URL est donc signée À LA LECTURE, avec une échéance courte : rien n'est stocké, rien à migrer, et le lien
 * recopié cesse de fonctionner.
 */
const prismaMock = {
  tripDocument: { findUnique: jest.fn() },
  adminAction: { create: jest.fn() },
};
const signedImageKitUrl = jest.fn((url: string) => `${url}?ik-t=1789&ik-s=signature`);
const recordAdminAction = jest.fn(async () => undefined);

jest.mock("@packages/libs/prisma", () => ({ __esModule: true, default: prismaMock }));
jest.mock("@packages/libs/imagekit", () => ({ signedImageKitUrl, deleteImageKitFile: jest.fn(), __esModule: true, default: {} }));
jest.mock("@packages/admin-audit", () => ({ recordAdminAction, recordAdminRead: jest.fn(async () => true) }));
jest.mock("@packages/libs/redis", () => ({ __esModule: true, default: {} }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { viewTicket } = require("./admin-trips.controller") as typeof import("./admin-trips.controller");

const ADMIN = "64b0000000000000000000a1";
const TRIP = "64b00000000000000000c001";
const DOC = "64b00000000000000000dd01";
const URL_NUE = "https://ik.imagekit.io/yamba/billets/vol-AF1234.pdf";

async function ouvrir() {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  await (viewTicket as unknown as (rq: never, rs: never, nx: never) => Promise<unknown>)(
    { user: { id: ADMIN }, adminRoles: ["SUPPORT"], params: { documentId: DOC }, headers: {}, ip: "10.0.0.1" } as never,
    res as never,
    next as never
  );
  return { corps: res.json.mock.calls[0]?.[0] as { url?: string } | undefined, error: next.mock.calls[0]?.[0] };
}

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.tripDocument.findUnique.mockResolvedValue({ id: DOC, url: URL_NUE, mimeType: "application/pdf", originalName: "billet.pdf", status: "PENDING", tripId: TRIP });
});

describe("A198 (e) — le billet est servi par une URL signée", () => {
  it("l'URL rendue est SIGNÉE, jamais l'URL nue de la base", async () => {
    const { corps, error } = await ouvrir();

    expect(error).toBeUndefined();
    expect(signedImageKitUrl).toHaveBeenCalledWith(URL_NUE);
    expect(corps?.url).toContain("ik-s=");
    expect(corps?.url).not.toBe(URL_NUE);
  });

  it("l'ouverture reste journalisée : un billet est une donnée personnelle", async () => {
    await ouvrir();

    expect(recordAdminAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ adminUserId: ADMIN, action: "DOCUMENT_VIEWED", targetType: "TRIP", targetId: TRIP, after: { documentId: DOC } })
    );
  });

  it("document introuvable : 404, et rien n'est signé ni journalisé", async () => {
    prismaMock.tripDocument.findUnique.mockResolvedValue(null);

    const { error } = await ouvrir();

    expect(error).toMatchObject({ statusCode: 404, details: { code: "DOCUMENT_NOT_FOUND" } });
    expect(signedImageKitUrl).not.toHaveBeenCalled();
    expect(recordAdminAction).not.toHaveBeenCalled();
  });
});

export {};
