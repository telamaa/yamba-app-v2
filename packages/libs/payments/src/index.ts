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
 *   5. `transfer`   — versement du net au compte Connect du Voyageur à
 *                     COMPLETED (B4, D49 : COMPLETED d'abord, transfert
 *                     ensuite, idempotent par clé = id du booking).
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
  /** charge créée par la capture (Stripe `latest_charge`) — null tant que rien n'est débité (A69) */
  chargeId: string | null;
};

/** Versement sortant (B4) — charges et transferts SÉPARÉS (Stripe Connect). */
export type TransferInput = {
  amountCents: number;
  currencyCode: string; // "EUR"
  /** compte Connect du Voyageur (acct_…) — `CarrierPage.stripeAccountId` */
  destinationAccountId: string;
  description: string;
  /** clés de rapprochement (bookingId, tripId, carrierId) — jamais de PII */
  metadata: Record<string, string>;
  /** regroupe charge et transfert dans le dashboard fournisseur (= bookingId) */
  transferGroup?: string;
  /** charge d'origine (A69) : Stripe attend que SES fonds soient disponibles au lieu d'échouer sur le solde plateforme */
  sourceTransactionId?: string;
  /** idempotence côté fournisseur : un rejeu ne verse jamais deux fois */
  idempotencyKey?: string;
};

export type TransferResult = {
  provider: PaymentProviderName;
  transferId: string;
  amountCents: number;
  currencyCode: string;
};

/** Rapprochement (C-PR5, D58 4A) — l'état RÉEL chez le fournisseur, lecture seule. */
export type PaymentInspection = {
  provider: PaymentProviderName;
  intentId: string;
  status: PaymentAuthorizationStatus;
  amountCents: number;
  /** Montant effectivement encaissé (Stripe `amount_received`) — 0 tant que rien n'est capturé */
  amountReceivedCents: number;
  chargeId: string | null;
  refunds: Array<{ id: string; amountCents: number; status: string; createdAt: string | null }>;
  /** Transfert connu par son id (Booking.transferId) ; null si aucun id ou introuvable */
  transfer: { id: string; amountCents: number; reversedCents: number; createdAt: string | null } | null;
};

export interface PaymentProvider {
  readonly name: PaymentProviderName;
  authorize(input: AuthorizeInput): Promise<PaymentAuthorization>;
  retrieve(intentId: string): Promise<PaymentAuthorization>;
  capture(intentId: string): Promise<PaymentAuthorization>;
  cancel(intentId: string, reason?: string): Promise<PaymentAuthorization>;
  refund(intentId: string, amountCents?: number): Promise<{ refundId: string; amountCents: number }>;
  transfer(input: TransferInput): Promise<TransferResult>;
  /** Lecture seule : intent + remboursements + transfert (C-PR5). Jette si l'intent est inconnu. */
  inspect(input: { intentId: string; transferId?: string | null }): Promise<PaymentInspection>;
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
    chargeId: typeof pi.latest_charge === "string" ? pi.latest_charge : pi.latest_charge?.id ?? null,
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

  async transfer(input: TransferInput): Promise<TransferResult> {
    // v1 (D49) : sans `source_transaction` — le solde plateforme couvre le
    // versement (vrai en test ; à surveiller en production).
    const t = await this.stripe.transfers.create(
      {
        amount: input.amountCents,
        currency: input.currencyCode.toLowerCase(),
        destination: input.destinationAccountId,
        description: input.description,
        metadata: input.metadata,
        ...(input.transferGroup ? { transfer_group: input.transferGroup } : {}),
        ...(input.sourceTransactionId ? { source_transaction: input.sourceTransactionId } : {}),
      },
      input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined
    );
    return { provider: "STRIPE", transferId: t.id, amountCents: t.amount, currencyCode: t.currency.toUpperCase() };
  }

  async inspect(input: { intentId: string; transferId?: string | null }): Promise<PaymentInspection> {
    const pi = await this.stripe.paymentIntents.retrieve(input.intentId);
    const refunds = await this.stripe.refunds.list({ payment_intent: input.intentId, limit: 100 });
    let transfer: PaymentInspection["transfer"] = null;
    if (input.transferId) {
      try {
        const t = await this.stripe.transfers.retrieve(input.transferId);
        transfer = { id: t.id, amountCents: t.amount, reversedCents: t.amount_reversed, createdAt: new Date(t.created * 1000).toISOString() };
      } catch {
        transfer = null; // introuvable = divergence signalée par le rapprochement, pas une erreur
      }
    }
    return {
      provider: "STRIPE",
      intentId: pi.id,
      status: mapStripeStatus(pi.status),
      amountCents: pi.amount,
      amountReceivedCents: pi.amount_received,
      chargeId: typeof pi.latest_charge === "string" ? pi.latest_charge : pi.latest_charge?.id ?? null,
      refunds: refunds.data.map((r) => ({ id: r.id, amountCents: r.amount, status: r.status ?? "unknown", createdAt: new Date(r.created * 1000).toISOString() })),
      transfer,
    };
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
      chargeId: null,
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
      chargeId: null,
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
    const next: PaymentAuthorization = {
      ...a,
      status,
      // La capture crée la charge (A69) — jamais avant.
      chargeId: status === "CAPTURED" ? (a.chargeId ?? `ch_fake_${intentId}`) : a.chargeId,
    };
    this.intents.set(intentId, next);
    return next;
  }

  async capture(intentId: string) {
    return this.setStatus(intentId, "CAPTURED");
  }

  async cancel(intentId: string) {
    return this.setStatus(intentId, "CANCELED");
  }

  /** Remboursements émis (observables par les tests et par `inspect`). */
  private readonly refundsByIntent = new Map<string, Array<{ id: string; amountCents: number; status: string; createdAt: string | null }>>();

  async refund(intentId: string, amountCents?: number) {
    const a = await this.retrieve(intentId);
    const amount = amountCents ?? a.amountCents;
    const list = this.refundsByIntent.get(intentId) ?? [];
    const refundId = `re_fake_${intentId}_${list.length + 1}`;
    list.push({ id: refundId, amountCents: amount, status: "succeeded", createdAt: new Date().toISOString() });
    this.refundsByIntent.set(intentId, list);
    return { refundId, amountCents: amount };
  }

  /** Transferts effectués (observables par les tests) — la clé
   *  d'idempotence est honorée : même clé ⇒ même transfert, pas de doublon. */
  readonly transfers: TransferResult[] = [];
  private readonly transfersByKey = new Map<string, TransferResult>();

  async transfer(input: TransferInput): Promise<TransferResult> {
    if (input.idempotencyKey) {
      const known = this.transfersByKey.get(input.idempotencyKey);
      if (known) return known;
    }
    const result: TransferResult = {
      provider: "FAKE",
      transferId: `tr_fake_${Date.now().toString(36)}_${++this.seq}`,
      amountCents: input.amountCents,
      currencyCode: input.currencyCode,
    };
    this.transfers.push(result);
    if (input.idempotencyKey) this.transfersByKey.set(input.idempotencyKey, result);
    return result;
  }

  private readonly reversedByTransfer = new Map<string, number>();

  async inspect(input: { intentId: string; transferId?: string | null }): Promise<PaymentInspection> {
    const a = await this.retrieve(input.intentId);
    const t = input.transferId ? this.transfers.find((x) => x.transferId === input.transferId) ?? null : null;
    return {
      provider: "FAKE",
      intentId: a.intentId,
      status: a.status,
      amountCents: a.amountCents,
      amountReceivedCents: a.status === "CAPTURED" ? a.amountCents : 0,
      chargeId: a.chargeId,
      refunds: [...(this.refundsByIntent.get(input.intentId) ?? [])],
      transfer: t ? { id: t.transferId, amountCents: t.amountCents, reversedCents: this.reversedByTransfer.get(t.transferId) ?? 0, createdAt: null } : null,
    };
  }

  /** aide aux tests : forcer un état (ex. simuler une autorisation non confirmée) */
  _setStatusForTest(intentId: string, status: PaymentAuthorizationStatus) {
    this.setStatus(intentId, status);
  }
  /** aide aux tests : simuler un `transfer.reversed` (C-PR5) */
  _reverseTransferForTest(transferId: string, amountCents?: number) {
    const t = this.transfers.find((x) => x.transferId === transferId);
    this.reversedByTransfer.set(transferId, amountCents ?? t?.amountCents ?? 0);
  }
}

/* ══ Webhook Stripe (D40) ═════════════════════════════════════ */

/** Événement webhook normalisé — seul sous-ensemble utile au deal-service. */
export type PaymentWebhookEvent = {
  id: string;
  type: string;
  /** id du PaymentIntent concerné (null pour les événements non-PI) */
  paymentIntentId: string | null;
  /** Événement d'un compte CONNECTÉ (Connect) : `acct_…`, sinon null (A87) */
  account: string | null;
  /** Objet porté par l'événement : type et id (transfer, payout, account…) */
  objectType: string | null;
  objectId: string | null;
  /** `account.updated` : les drapeaux qui pilotent les versements */
  accountFlags: { chargesEnabled: boolean; payoutsEnabled: boolean; detailsSubmitted: boolean } | null;
  /** `payout.failed` : message de la banque (jamais servi au front tel quel) */
  failureMessage: string | null;
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
  const object = event.data.object as {
    object?: string;
    id?: string;
    charges_enabled?: boolean;
    payouts_enabled?: boolean;
    details_submitted?: boolean;
    failure_message?: string | null;
  };
  return {
    id: event.id,
    type: event.type,
    paymentIntentId: object?.object === "payment_intent" && object.id ? object.id : null,
    account: (event as { account?: string }).account ?? null,
    objectType: object?.object ?? null,
    objectId: object?.id ?? null,
    accountFlags:
      object?.object === "account"
        ? {
            chargesEnabled: object.charges_enabled ?? false,
            payoutsEnabled: object.payouts_enabled ?? false,
            detailsSubmitted: object.details_submitted ?? false,
          }
        : null,
    failureMessage: object?.object === "payout" ? (object.failure_message ?? null) : null,
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
