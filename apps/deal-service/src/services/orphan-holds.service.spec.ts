/**
 * orphan-holds.service.spec.ts — la passe qui libère les empreintes orphelines (D82 9A)
 * =====================================================================================
 * Sections : A. le nominal (une orpheline annulée, une réservée épargnée) · B. les bornes
 * (fournisseur sans lecture, fenêtre vide, délai de grâce passé au fournisseur) · C. la
 * robustesse (une annulation qui échoue ne fait pas échouer la passe) · D. le fournisseur
 * Fake, bout en bout.
 */
const prismaMock = {
  booking: { findMany: jest.fn() },
};
jest.mock("@packages/libs/prisma", () => ({ __esModule: true, default: prismaMock }));

import { FakePaymentProvider, type AuthorizedHold, type PaymentProvider } from "@packages/payments";
import { makeOrphanHoldsService } from "./orphan-holds.service";

const NOW = new Date("2026-10-21T12:00:00.000Z");
const minutesAgo = (n: number) => new Date(NOW.getTime() - n * 60_000);
const TRIP = "64b0000000000000000000a1";
const SHIPPER = "64b0000000000000000000e1";

const hold = (intentId: string, over: Partial<AuthorizedHold> = {}): AuthorizedHold => ({
  intentId,
  amountCents: 1100,
  currencyCode: "EUR",
  createdAt: minutesAgo(180),
  metadata: { tripId: TRIP, shipperId: SHIPPER },
  ...over,
});

/** Un fournisseur réduit à ce que la passe utilise. */
function stubProvider(holds: AuthorizedHold[], over: Partial<PaymentProvider> = {}) {
  const cancel = jest.fn().mockResolvedValue(undefined);
  const listAuthorizedHolds = jest.fn().mockResolvedValue(holds);
  return { provider: { name: "STRIPE", cancel, listAuthorizedHolds, ...over } as unknown as PaymentProvider, cancel, listAuthorizedHolds };
}

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.booking.findMany.mockResolvedValue([]);
});

describe("empreintes orphelines — A. le nominal", () => {
  it("annule celle qu'aucune réservation ne porte, épargne celle qui en a une", async () => {
    const { provider, cancel } = stubProvider([hold("pi_orpheline"), hold("pi_reservee")]);
    prismaMock.booking.findMany.mockResolvedValue([{ paymentIntentId: "pi_reservee" }]);

    const r = await makeOrphanHoldsService(provider, () => NOW).runOnce();

    expect(r).toEqual({ examined: 2, canceled: 1, kept: 1, failed: 0 });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledWith("pi_orpheline", "abandoned");
  });

  it("n'interroge la base QU'UNE fois pour toute la fenêtre, sur les ids lus", async () => {
    const { provider } = stubProvider([hold("pi_1"), hold("pi_2"), hold("pi_3")]);

    await makeOrphanHoldsService(provider, () => NOW).runOnce();

    expect(prismaMock.booking.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.booking.findMany).toHaveBeenCalledWith({
      where: { paymentIntentId: { in: ["pi_1", "pi_2", "pi_3"] } },
      select: { paymentIntentId: true },
    });
  });

  it("n'annule JAMAIS une empreinte sans nos clés de rapprochement — elle appartient peut-être à une autre application", async () => {
    const { provider, cancel } = stubProvider([hold("pi_etranger", { metadata: { source: "autre-app" } })]);

    const r = await makeOrphanHoldsService(provider, () => NOW).runOnce();

    expect(cancel).not.toHaveBeenCalled();
    expect(r).toEqual({ examined: 1, canceled: 0, kept: 1, failed: 0 });
  });
});

describe("empreintes orphelines — B. les bornes", () => {
  it("un fournisseur qui n'offre pas la lecture rend une passe vide, sans jeter ni lire la base", async () => {
    const provider = { name: "FAKE", cancel: jest.fn() } as unknown as PaymentProvider;

    const r = await makeOrphanHoldsService(provider, () => NOW).runOnce();

    expect(r).toEqual({ examined: 0, canceled: 0, kept: 0, failed: 0 });
    expect(prismaMock.booking.findMany).not.toHaveBeenCalled();
  });

  it("aucune empreinte lue : pas de requête en base", async () => {
    const { provider } = stubProvider([]);

    const r = await makeOrphanHoldsService(provider, () => NOW).runOnce();

    expect(r).toEqual({ examined: 0, canceled: 0, kept: 0, failed: 0 });
    expect(prismaMock.booking.findMany).not.toHaveBeenCalled();
  });

  it("la borne d'âge envoyée au fournisseur est « maintenant moins la grâce »", async () => {
    const { provider, listAuthorizedHolds } = stubProvider([]);

    await makeOrphanHoldsService(provider, () => NOW, 30).runOnce();

    expect(listAuthorizedHolds).toHaveBeenCalledWith({ createdBefore: minutesAgo(30), limit: 100 });
  });

  it("une empreinte plus jeune que la grâce est épargnée même si le fournisseur la rend", async () => {
    // Le fournisseur borne déjà par date ; la règle re-vérifie, parce qu'un fournisseur
    // qui rendrait trop large ne doit pas pouvoir faire annuler un paiement en cours.
    const { provider, cancel } = stubProvider([hold("pi_fraiche", { createdAt: minutesAgo(1) })]);

    const r = await makeOrphanHoldsService(provider, () => NOW).runOnce();

    expect(cancel).not.toHaveBeenCalled();
    expect(r.kept).toBe(1);
  });
});

describe("empreintes orphelines — C. la robustesse", () => {
  it("une annulation refusée est comptée, et n'empêche pas les suivantes", async () => {
    const { provider, cancel } = stubProvider([hold("pi_ko"), hold("pi_ok")]);
    cancel.mockRejectedValueOnce(new Error("provider down")).mockResolvedValueOnce(undefined);

    const r = await makeOrphanHoldsService(provider, () => NOW).runOnce();

    expect(r).toEqual({ examined: 2, canceled: 1, kept: 0, failed: 1 });
    expect(cancel).toHaveBeenCalledTimes(2);
  });
});

describe("empreintes orphelines — D. avec le fournisseur Fake, bout en bout", () => {
  it("une empreinte vieillie et sans réservation est réellement annulée chez le fournisseur", async () => {
    const fake = new FakePaymentProvider();
    const auth = await fake.authorize({
      amountCents: 1100,
      currencyCode: "EUR",
      description: "YAMBA*COLIS",
      metadata: { tripId: TRIP, shipperId: SHIPPER },
    });
    fake._setCreatedAtForTest(auth.intentId, minutesAgo(180));

    const r = await makeOrphanHoldsService(fake, () => NOW).runOnce();

    expect(r.canceled).toBe(1);
    expect((await fake.retrieve(auth.intentId)).status).toBe("CANCELED");
  });

  it("le Fake ne rend que les empreintes POSÉES : une déjà annulée n'est plus candidate", async () => {
    const fake = new FakePaymentProvider();
    const auth = await fake.authorize({ amountCents: 900, currencyCode: "EUR", description: "x", metadata: { tripId: TRIP, shipperId: SHIPPER } });
    fake._setCreatedAtForTest(auth.intentId, minutesAgo(999));
    await fake.cancel(auth.intentId);

    const r = await makeOrphanHoldsService(fake, () => NOW).runOnce();

    expect(r).toEqual({ examined: 0, canceled: 0, kept: 0, failed: 0 });
  });
});
