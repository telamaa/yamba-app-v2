/**
 * stripe-webhook.controller.spec.ts — l'entrée par laquelle l'argent parle
 * ========================================================================
 * Recette API du 08/09/2026, chapitre 8 (fiches API-HOOK-02, 03, 04 et API-SEC-13).
 *
 * Ce contrôleur est la SOURCE DE VÉRITÉ de l'état du paiement : entre notre base et Stripe,
 * c'est Stripe qui a l'argent. Il était pourtant sans test — comme l'était le webhook email,
 * et comme l'étaient les deux chemins où la campagne a trouvé ANO-API-16 et ANO-API-17.
 *
 * Ce qui est verrouillé ici est le TABLEAU DES QUATRE RÉPONSES du cahier, parce que chaque
 * code a une conséquence différente chez l'émetteur :
 *   · 200 → Stripe considère l'événement traité et ne renverra pas ;
 *   · 400 → signature invalide : aucun réessai utile ;
 *   · 501 → secret absent : l'endpoint EXISTE mais refuse plutôt que d'accepter sans preuve ;
 *   · 500 → échec transitoire : Stripe RÉESSAIE, et c'est le filet voulu.
 * Rendre 200 sur un échec de base perdrait l'événement pour toujours ; rendre 4xx sur un type
 * qu'on ignore volontairement ferait retenter Stripe indéfiniment.
 */
const construct = jest.fn();
jest.mock("@packages/payments", () => ({ __esModule: true, constructStripeWebhookEvent: construct }), { virtual: true });

const prismaMock = { carrierPage: { findFirst: jest.fn(), update: jest.fn() } };
jest.mock("@packages/libs/prisma", () => ({ __esModule: true, default: prismaMock }), { virtual: true });

const notifyCarrierPayoutFailed = jest.fn();
jest.mock("../services/ops-notify.service", () => ({ __esModule: true, notifyCarrierPayoutFailed }));

import { makeStripeWebhookHandler } from "./stripe-webhook.controller";

const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() } as never;

function fauxResponse() {
  const out = { statusCode: 200, body: null as unknown };
  const res = {
    status(code: number) {
      out.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      out.body = payload;
      return res;
    },
  };
  return { res, out };
}

const requete = (signature?: string) =>
  ({ headers: signature === undefined ? {} : { "stripe-signature": signature }, body: Buffer.from("{}") }) as never;

const evenement = (over: Record<string, unknown> = {}) => ({
  id: "evt_1",
  type: "payment_intent.canceled",
  paymentIntentId: "pi_1",
  account: null,
  objectType: null,
  objectId: null,
  accountFlags: null,
  failureMessage: null,
  ...over,
});

describe("webhook Stripe — le contrôleur", () => {
  const service = { cancelBookingForDeadPayment: jest.fn() } as never;
  const settlement = { markTransferReversed: jest.fn(), retryPayoutsForCarrier: jest.fn() } as never;
  const ancien = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    delete process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
    construct.mockReturnValue(evenement());
    (service as unknown as { cancelBookingForDeadPayment: jest.Mock }).cancelBookingForDeadPayment.mockResolvedValue(true);
  });

  afterAll(() => {
    process.env = ancien;
  });

  it("501 quand aucun secret n'est configuré : l'endpoint existe mais ne peut rien vérifier", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const { res, out } = fauxResponse();
    await makeStripeWebhookHandler(service, logger, settlement)(requete("t=1,v1=x"), res as never);
    expect(out.statusCode).toBe(501);
    expect(construct).not.toHaveBeenCalled();
  });

  it("400 quand l'en-tête de signature est absent", async () => {
    const { res, out } = fauxResponse();
    await makeStripeWebhookHandler(service, logger, settlement)(requete(undefined), res as never);
    expect(out.statusCode).toBe(400);
    expect(out.body).toMatchObject({ error: "Missing stripe-signature header." });
  });

  it("400 quand aucun des secrets ne valide la signature (API-SEC-13)", async () => {
    construct.mockImplementation(() => {
      throw new Error("signature");
    });
    const { res, out } = fauxResponse();
    await makeStripeWebhookHandler(service, logger, settlement)(requete("t=1,v1=faux"), res as never);
    expect(out.statusCode).toBe(400);
    expect(out.body).toMatchObject({ error: "Invalid webhook signature." });
  });

  it("essaie le secret Connect quand celui de la plateforme échoue (A87, un URL deux endpoints)", async () => {
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET = "whsec_connect";
    construct.mockImplementationOnce(() => {
      throw new Error("pas ce secret");
    });
    construct.mockReturnValueOnce(evenement({ type: "charge.succeeded" }));
    const { res, out } = fauxResponse();
    await makeStripeWebhookHandler(service, logger, settlement)(requete("t=1,v1=x"), res as never);
    expect(construct).toHaveBeenCalledTimes(2);
    expect(out.statusCode).toBe(200);
  });

  it("annule le deal dont l'autorisation est morte (payment_intent.canceled)", async () => {
    const { res, out } = fauxResponse();
    await makeStripeWebhookHandler(service, logger, settlement)(requete("t=1,v1=x"), res as never);
    expect(out.statusCode).toBe(200);
    expect(out.body).toEqual({ received: true });
    expect((service as unknown as { cancelBookingForDeadPayment: jest.Mock }).cancelBookingForDeadPayment).toHaveBeenCalledWith("pi_1");
  });

  it("200 sans effet sur un type non traité — un 4xx ferait retenter Stripe sans fin", async () => {
    construct.mockReturnValue(evenement({ type: "charge.succeeded", paymentIntentId: null }));
    const { res, out } = fauxResponse();
    await makeStripeWebhookHandler(service, logger, settlement)(requete("t=1,v1=x"), res as never);
    expect(out.statusCode).toBe(200);
    expect((service as unknown as { cancelBookingForDeadPayment: jest.Mock }).cancelBookingForDeadPayment).not.toHaveBeenCalled();
  });

  it("fait suivre les drapeaux du Voyageur et relance ses versements quand le compte redevient prêt", async () => {
    construct.mockReturnValue(
      evenement({
        type: "account.updated",
        paymentIntentId: null,
        objectId: "acct_1",
        accountFlags: { chargesEnabled: true, payoutsEnabled: true, detailsSubmitted: true },
      })
    );
    prismaMock.carrierPage.findFirst.mockResolvedValue({ userId: "u1", stripePayoutsEnabled: false });
    (settlement as unknown as { retryPayoutsForCarrier: jest.Mock }).retryPayoutsForCarrier.mockResolvedValue(2);
    const { res, out } = fauxResponse();
    await makeStripeWebhookHandler(service, logger, settlement)(requete("t=1,v1=x"), res as never);
    expect(out.statusCode).toBe(200);
    expect(prismaMock.carrierPage.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u1" }, data: expect.objectContaining({ stripePayoutsEnabled: true }) })
    );
    expect((settlement as unknown as { retryPayoutsForCarrier: jest.Mock }).retryPayoutsForCarrier).toHaveBeenCalledWith("u1");
  });

  it("ne plante pas sur un compte connecté inconnu : 200 et un avertissement", async () => {
    construct.mockReturnValue(
      evenement({
        type: "account.updated",
        paymentIntentId: null,
        objectId: "acct_inconnu",
        accountFlags: { chargesEnabled: true, payoutsEnabled: true, detailsSubmitted: true },
      })
    );
    prismaMock.carrierPage.findFirst.mockResolvedValue(null);
    const { res, out } = fauxResponse();
    await makeStripeWebhookHandler(service, logger, settlement)(requete("t=1,v1=x"), res as never);
    expect(out.statusCode).toBe(200);
    expect(prismaMock.carrierPage.update).not.toHaveBeenCalled();
  });

  it("prévient le Voyageur quand sa banque refuse le virement (payout.failed)", async () => {
    construct.mockReturnValue(evenement({ type: "payout.failed", paymentIntentId: null, account: "acct_2" }));
    notifyCarrierPayoutFailed.mockResolvedValue(true);
    const { res, out } = fauxResponse();
    await makeStripeWebhookHandler(service, logger, settlement)(requete("t=1,v1=x"), res as never);
    expect(out.statusCode).toBe(200);
    expect(notifyCarrierPayoutFailed).toHaveBeenCalledWith("acct_2", "evt_1");
  });

  it("500 sur un échec transitoire — c'est le filet : Stripe réessaiera", async () => {
    (service as unknown as { cancelBookingForDeadPayment: jest.Mock }).cancelBookingForDeadPayment.mockRejectedValue(new Error("base indisponible"));
    const { res, out } = fauxResponse();
    await makeStripeWebhookHandler(service, logger, settlement)(requete("t=1,v1=x"), res as never);
    expect(out.statusCode).toBe(500);
    expect(out.body).toMatchObject({ error: "Webhook processing failed." });
  });
});
