/**
 * booking-request-fence.spec.ts — A179 (recette 02-ADMIN § 5.22) : la création d'une réservation clôture le compte de
 * l'Expéditeur en écrivant son document User ; un compte effacé refuse la réservation (409 ACCOUNT_DELETED).
 */
import { BookingRequestError, fenceShipperAccount } from "./booking-request";

const NOW = new Date("2026-09-15T12:00:00.000Z");

describe("fenceShipperAccount (A179)", () => {
  it("compte vivant : une écriture conditionnelle sur User (même document que l'effacement), rien d'autre", async () => {
    const updateMany = jest.fn(async () => ({ count: 1 }));
    await expect(fenceShipperAccount({ user: { updateMany } }, "u-awa", NOW)).resolves.toBeUndefined();
    expect(updateMany).toHaveBeenCalledWith({ where: { id: "u-awa", isDeleted: false }, data: { updatedAt: NOW } });
  });
  it("compte effacé (ou effacé pendant la création) : 409 ACCOUNT_DELETED, la transaction est annulée", async () => {
    const updateMany = jest.fn(async () => ({ count: 0 }));
    const refus = fenceShipperAccount({ user: { updateMany } }, "u-efface", NOW);
    await expect(refus).rejects.toBeInstanceOf(BookingRequestError);
    await expect(refus).rejects.toMatchObject({ statusCode: 409, code: "ACCOUNT_DELETED", details: { type: "booking", code: "ACCOUNT_DELETED" } });
  });
});
