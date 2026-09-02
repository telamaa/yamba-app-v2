/**
 * deal-request.service.ts — orchestration de la demande (B2, D37)
 * ===============================================================
 * Emplacement : apps/deal-service/src/services/deal-request.service.ts
 *
 * 1. createPaymentIntent : trajet → devis serveur (D34) → autorisation
 *    chez le PaymentProvider (D11). Rien n'est écrit en base : un intent
 *    abandonné expire chez le fournisseur (Stripe : 7 jours, jamais capturé).
 *
 * 2. createBooking : re-vérifie TOUT côté serveur (le front ne décide
 *    jamais) — trajet réservable, devis identique (D17), autorisation
 *    valide et cohérente (montant, trajet, expéditeur), intent jamais
 *    réutilisé — puis, dans UNE transaction Mongo :
 *      a. `trip.updateMany` CONDITIONNEL (reservedKg + kg ≤ capacityKg) :
 *         0 ligne = un concurrent a pris la place → CAPACITY_EXCEEDED,
 *         la transaction est annulée, l'autorisation libérée.
 *      b. `booking.create` (5 snapshots figés)
 *      c. 2 événements outbox (booking.requested, booking.payment_authorized)
 *         validés au contrat AVANT écriture — un payload invalide est un bug
 *         de writer (500), pas un message poison pour le relay.
 *
 * Lecture Prisma DIRECTE du Trip (A12, même base) ; l'écriture sur le
 * Trip se limite au compteur reservedKg (CAP-01, D19).
 */

import prisma from "@packages/libs/prisma";
import { NotFoundError, ValidationError } from "@packages/error-handler";
import type { PaymentProvider } from "@packages/payments";
import { QuoteError, type ShipperQuote } from "@packages/pricing";
import {
  BookingDomainEventSchema,
  type CreateBookingRequest,
  type CreateBookingResponse,
  type CreatePaymentIntentRequest,
  type CreatePaymentIntentResponse,
} from "@packages/api-contracts";
import {
  BookingRequestError,
  assertQuoteMatches,
  buildBookingSnapshots,
  capacityReservationWhere,
  checkCapacity,
  checkTripBookable,
  kgToReserve,
  quoteForTrip,
  type TripForBooking,
} from "./booking-request";

export type RequestingUser = { id: string; email?: string | null };

const TRIP_SELECT = {
  id: true,
  userId: true,
  status: true,
  isDeleted: true,
  departureAt: true,
  originCity: true,
  originCountryCode: true,
  originTimezone: true,
  destinationCity: true,
  destinationCountryCode: true,
  destinationTimezone: true,
  transportMode: true,
  pricePerKgCents: true,
  checkedBag23PriceCents: true,
  cabinBag12PriceCents: true,
  capacityKg: true,
  reservedKg: true,
  familyConditions: true,
} as const;

async function loadTrip(tripId: string): Promise<TripForBooking> {
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: TRIP_SELECT });
  if (!trip || trip.isDeleted) throw new NotFoundError("Trip not found");
  return {
    ...trip,
    status: String(trip.status),
    transportMode: trip.transportMode ? String(trip.transportMode) : null,
    familyConditions: trip.familyConditions.map((c) => ({
      familyKey: String(c.familyKey),
      mode: String(c.mode),
      surchargePct: c.surchargePct ?? null,
    })),
  };
}

function quoteOr400(trip: TripForBooking, input: CreatePaymentIntentRequest | CreateBookingRequest): ShipperQuote {
  try {
    return quoteForTrip(trip, input);
  } catch (e) {
    if (e instanceof QuoteError) throw new ValidationError(e.message, { errors: { quote: e.code } });
    throw e;
  }
}

/** Le devis serveur sous la forme du contrat ShipperPricing (ce qui sera figé). */
function toShipperPricing(quote: ShipperQuote) {
  return {
    pricingModel: "PER_KG" as const,
    weightKg: quote.weightKg ?? quote.capacityKgConsumed,
    categoryPriceCents: null,
    pricePerKgCents: quote.pricePerKgCents,
    sizeClass: quote.sizeClass,
    transportCents: quote.transportCents,
    commissionPct: quote.commissionPct / 100,
    commissionCents: quote.commissionCents,
    protectionProvider: quote.protectionTier === "EXTENDED_500" ? "YAMBA_GUARANTEE" : null,
    protectionTier: quote.protectionTier,
    premiumCents: quote.premiumCents,
    totalShipperCents: quote.totalShipperCents,
    currencyCode: quote.currencyCode,
    product: quote.product,
    billableWeightKg: quote.billableWeightKg,
    sizeCoef: quote.sizeCoef,
    familySurchargePct: quote.familySurchargePct,
    rawTransportCents: quote.rawTransportCents,
    minimumApplied: quote.minimumApplied,
    serviceCents: quote.serviceCents,
  };
}

export function makeDealRequestService(provider: PaymentProvider, clock: () => Date = () => new Date()) {
  return {
    async createPaymentIntent(
      user: RequestingUser,
      input: CreatePaymentIntentRequest
    ): Promise<CreatePaymentIntentResponse> {
      const now = clock();
      const trip = await loadTrip(input.tripId);
      checkTripBookable(trip, user.id, now);
      const quote = quoteOr400(trip, input);
      assertQuoteMatches(quote, input.expectedTotalCents);
      checkCapacity(trip, kgToReserve(quote)); // refus précoce, avant de poser une empreinte

      const auth = await provider.authorize({
        amountCents: quote.totalShipperCents,
        currencyCode: quote.currencyCode,
        description: `YAMBA*COLIS ${trip.originCity ?? ""} > ${trip.destinationCity ?? ""}`.trim(),
        metadata: {
          tripId: trip.id,
          shipperId: user.id,
          carrierId: trip.userId,
          product: quote.product,
          totalShipperCents: String(quote.totalShipperCents),
        },
      });

      return {
        provider: auth.provider,
        paymentIntentId: auth.intentId,
        clientSecret: auth.clientSecret,
        amountCents: auth.amountCents,
        currencyCode: auth.currencyCode,
        quote: toShipperPricing(quote),
      };
    },

    async createBooking(user: RequestingUser, input: CreateBookingRequest): Promise<CreateBookingResponse> {
      const now = clock();
      const trip = await loadTrip(input.tripId);
      checkTripBookable(trip, user.id, now);
      const quote = quoteOr400(trip, input);
      assertQuoteMatches(quote, input.expectedTotalCents);
      const kg = kgToReserve(quote);
      checkCapacity(trip, kg);

      // ── L'autorisation existe, est capturable et parle bien de CE devis ──
      let auth;
      try {
        auth = await provider.retrieve(input.paymentIntentId);
      } catch {
        throw new BookingRequestError("PAYMENT_NOT_AUTHORIZED", "Unknown payment authorization.");
      }
      if (auth.status !== "AUTHORIZED") {
        throw new BookingRequestError("PAYMENT_NOT_AUTHORIZED", "The payment has not been authorized yet.", {
          paymentStatus: auth.status,
        });
      }
      if (
        auth.amountCents !== quote.totalShipperCents ||
        auth.currencyCode !== quote.currencyCode ||
        auth.metadata.tripId !== trip.id ||
        auth.metadata.shipperId !== user.id
      ) {
        throw new BookingRequestError("PAYMENT_MISMATCH", "The payment authorization does not match this request.");
      }

      const snapshots = buildBookingSnapshots({ trip, input, quote, now });

      try {
        const booking = await prisma.$transaction(async (tx) => {
          const reused = await tx.booking.findFirst({
            where: { paymentIntentId: input.paymentIntentId },
            select: { id: true },
          });
          if (reused) throw new BookingRequestError("PAYMENT_ALREADY_USED", "This payment is already attached to a request.");

          // CAP-01 — réservation ATOMIQUE : la condition est dans le WHERE
          // (helper pur, robuste au champ reservedKg absent — pitfall isSet).
          const reserved = await tx.trip.updateMany({
            where: capacityReservationWhere(trip, kg),
            data: { reservedKg: { increment: kg } },
          });
          if (reserved.count === 0) {
            throw new BookingRequestError("CAPACITY_EXCEEDED", "Not enough remaining capacity on this trip.");
          }

          const created = await tx.booking.create({
            data: {
              tripId: trip.id,
              shipperId: user.id,
              carrierId: trip.userId,
              status: "PENDING",
              trip: snapshots.trip,
              pricing: snapshots.pricing,
              parcel: snapshots.parcel as never, // enum ParcelCategory : valeur garantie par FAMILY_DEFAULT_CATEGORY
              recipient: snapshots.recipient,
              pickupPlace: snapshots.pickupPlace as never,
              deliveryPlace: snapshots.deliveryPlace as never,
              requestedAt: snapshots.requestedAt,
              expiresAt: snapshots.expiresAt,
              paymentIntentId: auth.intentId,
              paymentProvider: auth.provider,
            },
          });

          const base = {
            bookingId: created.id,
            tripId: trip.id,
            shipperId: user.id,
            carrierId: trip.userId,
            corridor: {
              originCity: snapshots.trip.originCity,
              originCountryCode: snapshots.trip.originCountryCode,
              destinationCity: snapshots.trip.destinationCity,
              destinationCountryCode: snapshots.trip.destinationCountryCode,
            },
            category: snapshots.parcel.category,
            categoryFamily: snapshots.parcel.categoryFamily,
            weightKg: snapshots.pricing.weightKg,
            transportCents: quote.transportCents,
            totalShipperCents: quote.totalShipperCents,
            currencyCode: quote.currencyCode,
            actor: "SHIPPER" as const,
          };
          const envelope = {
            aggregateType: "booking" as const,
            aggregateId: created.id,
            occurredAt: now.toISOString(),
            correlationId: null,
            schemaVersion: 1 as const,
          };
          const events = [
            { ...envelope, eventType: "booking.requested" as const, payload: { ...base, expiresAt: snapshots.expiresAt.toISOString() } },
            {
              ...envelope,
              eventType: "booking.payment_authorized" as const,
              payload: { ...base, paymentIntentId: auth.intentId, amountCents: quote.totalShipperCents },
            },
          ].map((e) => BookingDomainEventSchema.parse(e)); // bug de writer ⇒ 500 ici, jamais un poison

          for (const e of events) {
            await tx.outboxEvent.create({
              data: {
                aggregateType: "booking",
                aggregateId: created.id,
                eventType: e.eventType,
                payload: e as never,
                occurredAt: now,
              // Explicite : sur Mongo, absent ≠ null pour le relay (A49)
              publishedAt: null,
              },
            });
          }
          return created;
        });

        return {
          bookingId: booking.id,
          status: "PENDING",
          expiresAt: snapshots.expiresAt.toISOString(),
          totalShipperCents: quote.totalShipperCents,
          currencyCode: quote.currencyCode,
        };
      } catch (e) {
        // La place a été perdue (ou l'intent réutilisé) : on libère l'empreinte —
        // jamais d'argent bloqué sans deal. Best effort : l'intent expirerait de toute façon.
        if (e instanceof BookingRequestError && e.code === "CAPACITY_EXCEEDED") {
          await provider.cancel(auth.intentId, "abandoned").catch(() => undefined);
        }
        throw e;
      }
    },
  };
}

export type DealRequestService = ReturnType<typeof makeDealRequestService>;
