/**
 * profile-concurrency.controller.spec.ts — A195 : le profil écrit à deux mains (passe concurrence MEMBRE)
 * ========================================================================================================
 * Suite d'A192, côté membre. Trois gestes du profil lisaient un document puis l'écrivaient sans condition :
 *
 *  - changer d'avatar : deux envois simultanés (double clic, ou téléphone + ordinateur) lisent tous deux
 *    « pas d'avatar » et créent chacun le leur — `Image.userId` est UNIQUE, le second prenait un 500 alors
 *    que son image était déjà sur ImageKit ;
 *  - supprimer l'avatar deux fois : `delete` lève P2025 (→ 500) pour le second, alors que l'avatar est bien parti ;
 *  - modifier le profil : la page Voyageur lue peut avoir disparu à l'écriture (→ 500).
 *
 * Et un effet de bord qui se voit à l'œil nu : seul celui qui a VRAIMENT remplacé (ou effacé) la ligne
 * efface le FICHIER chez ImageKit — sinon on supprime l'image d'un avatar déjà remplacé entre-temps.
 */
const prismaMock = {
  user: { findUniqueOrThrow: jest.fn(), updateMany: jest.fn() },
  carrierPage: { findUnique: jest.fn(), updateMany: jest.fn() },
  image: { findUnique: jest.fn(), create: jest.fn(), updateMany: jest.fn(), deleteMany: jest.fn() },
  $transaction: jest.fn(),
};
const deleteImageKitFile = jest.fn(async () => undefined);
jest.mock("@packages/libs/prisma", () => ({ __esModule: true, default: prismaMock }));
jest.mock("@packages/libs/imagekit", () => ({ deleteImageKitFile }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { deleteMyAvatar, setMyAvatar, updateMyProfile } = require("./profile.controller") as typeof import("./profile.controller");

const MEMBRE = "64b00000000000000000aa01";
const ENDPOINT = "https://ik.imagekit.io/yamba";
const URL_NEUVE = `${ENDPOINT}/avatar-neuf.jpg`;

const collision = () => Object.assign(new Error("Unique constraint failed"), { code: "P2002" });

async function appeler(handler: (rq: never, rs: never, nx: never) => Promise<unknown>, body: Record<string, unknown> = {}) {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  await handler({ user: { id: MEMBRE }, body } as never, res as never, next as never);
  return { res, error: next.mock.calls[0]?.[0] as { statusCode?: number; details?: { code?: string } } | undefined };
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.IMAGEKIT_URL_ENDPOINT = ENDPOINT;
  prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock));
  prismaMock.user.findUniqueOrThrow.mockResolvedValue({ firstName: "Awa", lastName: "Diop", publicSlug: "awa-diop", birthDate: null, profilePublic: true, showCity: true, avatar: null, carrierPage: null });
  prismaMock.user.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.carrierPage.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.carrierPage.findUnique.mockResolvedValue(null);
});

describe("A195 — changer d'avatar", () => {
  it("premier avatar : créé, aucun fichier supprimé chez ImageKit", async () => {
    prismaMock.image.findUnique.mockResolvedValue(null);
    prismaMock.image.create.mockResolvedValue({});

    const { res, error } = await appeler(setMyAvatar as never, { fileId: "f2", url: URL_NEUVE });

    expect(error).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(deleteImageKitFile).not.toHaveBeenCalled();
  });

  it("remplacement : l'écriture est conditionnée au fichier LU, et l'ancien fichier part", async () => {
    prismaMock.image.findUnique.mockResolvedValue({ id: "i1", fileId: "f1" });
    prismaMock.image.updateMany.mockResolvedValue({ count: 1 });

    await appeler(setMyAvatar as never, { fileId: "f2", url: URL_NEUVE });

    expect(prismaMock.image.updateMany).toHaveBeenCalledWith({ where: { id: "i1", fileId: "f1" }, data: { fileId: "f2", url: URL_NEUVE } });
    expect(deleteImageKitFile).toHaveBeenCalledWith("f1");
  });

  it("l'autre envoi est passé en premier (l'avatar lu n'est plus le bon) : 409, et AUCUN fichier supprimé", async () => {
    prismaMock.image.findUnique.mockResolvedValue({ id: "i1", fileId: "f1" });
    prismaMock.image.updateMany.mockResolvedValue({ count: 0 }); // f1 n'est plus le fichier en place

    const { error } = await appeler(setMyAvatar as never, { fileId: "f2", url: URL_NEUVE });

    expect(error).toMatchObject({ statusCode: 409, details: { code: "PROFILE_STATE_CHANGED" } });
    expect(deleteImageKitFile).not.toHaveBeenCalled(); // on n'efface pas l'image que l'autre vient de poser
  });

  it("deux créations simultanées : la perdante lit 409, jamais un 500", async () => {
    prismaMock.image.findUnique.mockResolvedValue(null); // les deux ont lu « pas d'avatar »
    prismaMock.image.create.mockRejectedValue(collision());

    const { error } = await appeler(setMyAvatar as never, { fileId: "f2", url: URL_NEUVE });

    expect(error).toMatchObject({ statusCode: 409, details: { code: "PROFILE_STATE_CHANGED" } });
  });
});

describe("A195 — supprimer l'avatar", () => {
  it("suppression réelle : la ligne part, le fichier aussi", async () => {
    prismaMock.image.findUnique.mockResolvedValue({ id: "i1", fileId: "f1" });
    prismaMock.image.deleteMany.mockResolvedValue({ count: 1 });

    const { res, error } = await appeler(deleteMyAvatar as never);

    expect(error).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(deleteImageKitFile).toHaveBeenCalledWith("f1");
  });

  it("double clic : le second n'efface rien, ne touche pas ImageKit, et répond 200 (le geste a bien eu lieu)", async () => {
    prismaMock.image.findUnique.mockResolvedValue({ id: "i1", fileId: "f1" });
    prismaMock.image.deleteMany.mockResolvedValue({ count: 0 }); // le premier a déjà effacé la ligne

    const { res, error } = await appeler(deleteMyAvatar as never);

    expect(error).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(deleteImageKitFile).not.toHaveBeenCalled();
  });
});

describe("A195 — modifier le profil", () => {
  it("le compte a disparu pendant la requête (effacement RGPD) : 409, jamais un 500", async () => {
    prismaMock.user.updateMany.mockResolvedValue({ count: 0 });

    const { error } = await appeler(updateMyProfile as never, { firstName: "Awa" });

    expect(error).toMatchObject({ statusCode: 409, details: { code: "PROFILE_STATE_CHANGED" } });
  });

  it("écriture normale : conditionnée au compte vivant", async () => {
    const { error } = await appeler(updateMyProfile as never, { firstName: "Awa" });

    expect(error).toBeUndefined();
    expect(prismaMock.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: MEMBRE, isDeleted: false } }));
  });
});

// Fichier MODULE (et non script) : sans cela ses constantes de tête tomberaient dans la portee globale
// partagee par les specs, et se heurteraient a celles des autres fiches (TS2451 au typecheck du projet).
export {};
