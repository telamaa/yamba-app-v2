/**
 * @packages/payments — PaymentProvider abstrait (D11) + implémentations
 * ======================================================================
 * Emplacement : packages/libs/payments/src/index.ts
 *
 * POURQUOI une abstraction dès B2 (D11) : Stripe ne verse pas au Congo ;
 * le marché cible paie en Mobile Money (MTN MoMo / Airtel Money). Le
 * deal-service ne connaît que cette interface : ajouter un fournisseur =
 * une classe de plus, zéro changement dans la logique métier.
 *
 * Modèle d'argent (spec §3.2, D31) :
 *   1. `authorize`  — l'Expéditeur AUTORISE le montant total (empreinte,
 *                     pas de débit) au moment de la demande.
 *   2. `capture`    — débit réel à l'ACCEPTATION par le Voyageur (B2.2).
 *   3. `cancel`     — libération de l'autorisation (refus, expiration 24 h,
 *                     capacité épuisée après autorisation).
 *   4. `refund`     — remboursement après capture (ANN-01…04).
 *
 * Deux implémentations :
 *   - StripePaymentProvider : PaymentIntent `capture_method: "manual"`.
 *   - FakePaymentProvider   : mémoire, auto-autorisé — dev sans clés + tests
 *                             (D30 : « Stripe remplacé par un fake »).
 *                             INTERDIT en production (le factory refuse).
 */

import Stripe from "stripe";

export type PaymentProviderName = "STRIPE" | "FAKE";

/** États normalisés (sous-ensemble utile, indépendant du fournisseur). */
export type PaymentAuthorizationStatus =
  | "REQUIRES_PAYMENT_METHOD" // créé, pas encore confirmé par le client
  | "PROCESSING"
  | "AUTHORIZED" // empreinte posée, capturable (Stripe: requires_capture)
  | "CAPTURED" // débité (Stripe: succeeded)
  | "CANCELED"
  | "UNKNOWN";

export type AuthorizeInput = {
  amountCents: number;
  currencyCode: string; // "EUR"
  /** libellé court sur le relevé / dashboard fournisseur */
  description: string;
  /** clés de rapprochement (tripId, shipperId, quoteHash…) — jamais de PII */
  metadata: Record<string, string>;
  /** idempotence côté fournisseur (même clé ⇒ même intent) */
  idempotencyKey?: string;
};

export type PaymentAuthorization = {
  provider: PaymentProviderName;
  intentId: string;
  /** secret client pour confirmer côté front (null pour FAKE) */
  clientSecret: string | null;
  status: PaymentAuthorizationStatus;
  amountCents: number;
  currencyCode: string;
  metadata: Record<string, string>;
};

export interface PaymentProvider {
  readonly name: PaymentProviderName;
  authorize(input: AuthorizeInput): Promise<PaymentAuthorization>;
  retrieve(intentId: string): Promise<PaymentAuthorization>;
  capture(intentId: string): Promise<PaymentAuthorization>;
  cancel(intentId: string, reason?: string): Promise<PaymentAuthorization>;
  refund(intentId: string, amountCents?: number): Promise<{ refundId: string; amountCents: number }>;
}

/* ══ Stripe ═══════════════════════════════════════════════════ */

function mapStripeStatus(status: Stripe.PaymentIntent.Status): PaymentAuthorizationStatus {
  switch (status) {
    case "requires_payment_method":
    case "requires_confirmation":
    case "requires_action":
      return "REQUIRES_PAYMENT_METHOD";
    case "processing":
      return "PROCESSING";
    case "requires_capture":
      return "AUTHORIZED";
    case "succeeded":
      return "CAPTURED";
    case "canceled":
      return "CANCELED";
    default:
      return "UNKNOWN";
  }
}

function fromStripe(pi: Stripe.PaymentIntent): PaymentAuthorization {
  return {
    provider: "STRIPE",
    intentId: pi.id,
    clientSecret: pi.client_secret ?? null,
    status: mapStripeStatus(pi.status),
    amountCents: pi.amount,
    currencyCode: pi.currency.toUpperCase(),
    metadata: (pi.metadata ?? {}) as Record<string, string>,
  };
}

export class StripePaymentProvider implements PaymentProvider {
  readonly name = "STRIPE" as const;
  private readonly stripe: Stripe;

  constructor(secretKey: string) {
    this.stripe = new Stripe(secretKey, { apiVersion: "2026-03-25.dahlia" });
  }

  async authorize(input: AuthorizeInput): Promise<PaymentAuthorization> {
    const pi = await this.stripe.paymentIntents.create(
      {
        amount: input.amountCents,
        currency: input.currencyCode.toLowerCase(),
        capture_method: "manual", // autorisation maintenant, capture à l'acceptation (D31)
        automatic_payment_methods: { enabled: true }, // carte + wallets (Apple/Google Pay) dans UN Payment Element
        description: input.description,
        metadata: input.metadata,
      },
      input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined
    );
    return fromStripe(pi);
  }

  async retrieve(intentId: string): Promise<PaymentAuthorization> {
    return fromStripe(await this.stripe.paymentIntents.retrieve(intentId));
  }

  async capture(intentId: string): Promise<PaymentAuthorization> {
    return fromStripe(await this.stripe.paymentIntents.capture(intentId));
  }

  async cancel(intentId: string, reason?: string): Promise<PaymentAuthorization> {
    return fromStripe(
      await this.stripe.paymentIntents.cancel(intentId, {
        cancellation_reason: reason === "abandoned" ? "abandoned" : "requested_by_customer",
      })
    );
  }

  async refund(intentId: string, amountCents?: number) {
    const r = await this.stripe.refunds.create({
      payment_intent: intentId,
      ...(amountCents !== undefined ? { amount: amountCents } : {}),
    });
    return { refundId: r.id, amountCents: r.amount };
  }
}

/* ══ Fake (dev sans clés + tests) ═════════════════════════════ */

export class FakePaymentProvider implements PaymentProvider {
  readonly name = "FAKE" as const;
  private readonly intents = new Map<string, PaymentAuthorization>();
  private seq = 0;

  async authorize(input: AuthorizeInput): Promise<PaymentAuthorization> {
    const intentId = `pi_fake_${Date.now().toString(36)}_${++this.seq}`;
    const auth: PaymentAuthorization = {
      provider: "FAKE",
      intentId,
      clientSecret: null,
      status: "AUTHORIZED", // auto-confirmé : pas de saisie de carte en dev
      amountCents: input.amountCents,
      currencyCode: input.currencyCode,
      metadata: { ...input.metadata },
    };
    this.intents.set(intentId, auth);
    return auth;
  }

  /**
   * Adoption des intents SEEDÉS : le Fake est en mémoire, un id écrit en
   * base par packages/libs/prisma/scripts/seed-deals.ts n'existe pas dans
   * cette instance. Tout id `pi_fake_seed_…` inconnu est matérialisé
   * AUTHORIZED à la première lecture (dev : accept/decline/cancel jouables
   * sur les deals seedés). Les autres ids inconnus jettent toujours —
   * les tests de PAYMENT_STATE_CONFLICT restent valides.
   */
  private adoptSeeded(intentId: string): PaymentAuthorization | undefined {
    if (!intentId.startsWith("pi_fake_seed_")) return undefined;
    const auth: PaymentAuthorization = {
      provider: "FAKE",
      intentId,
      clientSecret: null,
      status: "AUTHORIZED",
      amountCents: 0, // montant inconnu ici — les événements lisent le snapshot
      currencyCode: "EUR",
      metadata: { seeded: "true" },
    };
    this.intents.set(intentId, auth);
    return auth;
  }

  async retrieve(intentId: string): Promise<PaymentAuthorization> {
    const a = this.intents.get(intentId) ?? this.adoptSeeded(intentId);
    if (!a) throw new Error(`Unknown fake payment intent: ${intentId}`);
    return { ...a };
  }

  private setStatus(intentId: string, status: PaymentAuthorizationStatus) {
    const a = this.intents.get(intentId) ?? this.adoptSeeded(intentId);
    if (!a) throw new Error(`Unknown fake payment intent: ${intentId}`);
    const next = { ...a, status };
    this.intents.set(intentId, next);
    return next;
  }

  async capture(intentId: string) {
    return this.setStatus(intentId, "CAPTURED");
  }

  async cancel(intentId: string) {
    return this.setStatus(intentId, "CANCELED");
  }

  async refund(intentId: string, amountCents?: number) {
    const a = await this.retrieve(intentId);
    return { refundId: `re_fake_${intentId}`, amountCents: amountCents ?? a.amountCents };
  }

  /** aide aux tests : forcer un état (ex. simuler une autorisation non confirmée) */
  _setStatusForTest(intentId: string, status: PaymentAuthorizationStatus) {
    this.setStatus(intentId, status);
  }
}

/* ══ Webhook Stripe (D40) ═════════════════════════════════════ */

/** Événement webhook normalisé — seul sous-ensemble utile au deal-service. */
export type PaymentWebhookEvent = {
  id: string;
  type: string;
  /** id du PaymentIntent concerné (null pour les événements non-PI) */
  paymentIntentId: string | null;
};

// La vérification de signature n'appelle JAMAIS l'API : la clé de cette
// instance est un leurre — seul le secret webhook (whsec_…) compte.
let webhookVerifier: Stripe | null = null;

/**
 * Vérifie la signature (STRIPE_WEBHOOK_SECRET) et parse le corps BRUT.
 * Jette si la signature est invalide — l'appelant répond 400.
 */
export function constructStripeWebhookEvent(
  rawBody: Buffer | string,
  signature: string,
  webhookSecret: string
): PaymentWebhookEvent {
  webhookVerifier ??= new Stripe("sk_webhook_signature_verification_only", {
    apiVersion: "2026-03-25.dahlia",
  });
  const event = webhookVerifier.webhooks.constructEvent(rawBody, signature, webhookSecret);
  const object = event.data.object as { object?: string; id?: string };
  return {
    id: event.id,
    type: event.type,
    paymentIntentId: object?.object === "payment_intent" && object.id ? object.id : null,
  };
}

/* ══ Factory (env) ════════════════════════════════════════════ */

/**
 * STRIPE_SECRET_KEY présent → Stripe. Absent → Fake, SAUF en production
 * (NODE_ENV=production) où l'on refuse de démarrer sans fournisseur réel.
 */
export function createPaymentProviderFromEnv(env: NodeJS.ProcessEnv = process.env): PaymentProvider {
  const key = env.STRIPE_SECRET_KEY?.trim();
  if (key) return new StripePaymentProvider(key);
  if (env.NODE_ENV === "production") {
    throw new Error("STRIPE_SECRET_KEY is required in production (no fake payment provider)");
  }
  return new FakePaymentProvider();
}
