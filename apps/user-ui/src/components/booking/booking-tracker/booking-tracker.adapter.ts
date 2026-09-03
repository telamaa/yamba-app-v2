/**
 * booking-tracker.adapter.ts — ShipperBookingView (API) → Booking (A37)
 * =====================================================================
 * LA frontière entre `GET /deals/:id` (vue Shipper, OAS deal-service)
 * et le view-model historique du tracker : les vues É3/É4b/É6/É8/É9
 * ne voient JAMAIS la forme backend. Fonction pure.
 *
 * Vocabulaire absorbé ICI (jamais dans les vues) :
 * - statuts : PENDING → AWAITING_CARRIER · COMPLETED → VERIFIED ·
 *   le reste 1:1 (IN_TRANSIT n'est PAS un statut serveur : le client
 *   dérive É6 de PICKED_UP + trackingEvents non vides) ;
 * - montants : cents entiers (A2) → euros d'affichage.
 *
 * Champs que l'API ne sert PAS ENCORE (optionnels, documentés — A37) :
 * - carrier.rating / dealCount / isVerified : les stats naissent en B5 ;
 * - payment.cardBrand / cardLast4 / statementDescriptor : viendront de
 *   Stripe (backlog) — le paiement affiche le total seul d'ici là ;
 * - deliveryCode.code : servi par l'API en PICKED_UP (D43) — absent sur
 *   un enregistrement antérieur à B3 (jamais inventé) ;
 * - trip.durationHours / isDirect : durée absente du snapshot (pas
 *   d'ETA inventée) ;
 * - photos (déclaration + pickup) : URLs réelles avec media-service B3.
 */
import type {
  Booking,
  BookingDisputeFile,
  BookingLocation,
  BookingPhoto,
  BookingStatus,
  BookingTrackingEvent,
  BookingTrackingEventId,
} from "./booking-tracker.types";
import { MAX_CODE_REGENERATIONS } from "./booking-tracker.types";

/* ── Forme backend (whitelist de LECTURE — seuls les champs lus) ── */

type BackendStatus =
  | "PENDING"
  | "ACCEPTED"
  | "PICKED_UP"
  | "DELIVERED"
  | "COMPLETED"
  | "DECLINED"
  | "EXPIRED"
  | "CANCELLED"
  | "DISPUTED";

type PlaceSnapshotDto = {
  kind: "AIRPORT" | "TRAIN_STATION" | "CITY_AREA";
  details?: string | null;
};

export type ShipperBookingViewDto = {
  id: string;
  tripId: string;
  status: BackendStatus;
  trip: {
    originCity: string;
    destinationCity: string;
    departureAt: string;
  };
  pricing: {
    weightKg: number;
    totalShipperCents: number;
    currencyCode: string;
    protectionTier?: string | null;
  };
  parcel: {
    category: string;
    description: string;
    declaredValueCents: number;
    photoUrls: string[];
  };
  recipient: {
    firstName: string;
    lastName: string;
  };
  pickupPlace?: PlaceSnapshotDto | null;
  carrier: {
    id: string;
    firstName?: string | null;
    lastInitial: string;
    avatarUrl: string | null;
  };
  requestedAt: string;
  expiresAt: string;
  acceptedAt?: string | null;
  pickedUpAt?: string | null;
  deliveredAt?: string | null;
  payoutDueAt?: string | null;
  completedAt?: string | null;
  closedAt?: string | null;
  disputeTicket?: string | null;
  disputedAt?: string | null;
  payoutStatus?: "PENDING" | "SENT" | "FAILED" | "FROZEN" | null;
  completedBy?: string | null;
  disputeOpensAt?: string | null;
  dispute?: {
    ticketNumber: string;
    category: string;
    description: string;
    desiredOutcome?: string | null;
    photoUrls: string[];
    createdAt: string;
  } | null;
  deliveryCode: string | null;
  codeRegenerationsLeft: number;
  pickup?: {
    confirmedAt: string;
    photoUrls: string[];
    notes?: string | null;
  } | null;
  trackingEvents: { step: BookingTrackingEventId; confirmedAt: string }[];
  /** Machine d'état serveur — pilote les CTA (« le front reflète »). */
  allowedActions: string[];
};

/* ── Mappings de vocabulaire ─────────────────────────────────── */

const STATUS_MAP: Record<BackendStatus, BookingStatus> = {
  PENDING: "AWAITING_CARRIER",
  ACCEPTED: "ACCEPTED",
  PICKED_UP: "PICKED_UP", // É4b ou É6 : le client dérive de trackingEvents
  DELIVERED: "DELIVERED",
  COMPLETED: "VERIFIED",
  DECLINED: "DECLINED",
  EXPIRED: "EXPIRED",
  CANCELLED: "CANCELLED",
  DISPUTED: "DISPUTED",
};

const PLACE_TYPE_MAP: Record<
  PlaceSnapshotDto["kind"],
  BookingLocation["type"]
> = {
  AIRPORT: "AIRPORT",
  TRAIN_STATION: "STATION",
  CITY_AREA: "ADDRESS",
};

function toLocation(
  place: PlaceSnapshotDto | null | undefined,
  fallbackCity: string
): BookingLocation {
  return {
    id: "pickup",
    type: place ? PLACE_TYPE_MAP[place.kind] : "ADDRESS",
    name: place?.details ?? fallbackCity,
    city: fallbackCity,
  };
}

function toPhotos(
  urls: string[],
  context: BookingPhoto["context"]
): BookingPhoto[] {
  return urls.map((url, i) => ({ id: `${context}-${i}`, url, context }));
}

function toTrackingEvents(
  events: ShipperBookingViewDto["trackingEvents"]
): BookingTrackingEvent[] {
  return events.map((e) => ({ id: e.step, at: e.confirmedAt }));
}

function toDisputeFile(d: ShipperBookingViewDto["dispute"]): BookingDisputeFile | undefined {
  if (!d) return undefined;
  return {
    ticketNumber: d.ticketNumber,
    category: d.category as BookingDisputeFile["category"],
    description: d.description,
    desiredOutcome: (d.desiredOutcome ?? undefined) as BookingDisputeFile["desiredOutcome"],
    photoUrls: d.photoUrls,
    createdAt: d.createdAt,
  };
}

/* ── L'adapter ───────────────────────────────────────────────── */

export function toBooking(view: ShipperBookingViewDto): Booking {
  const hasCode = view.deliveryCode !== null;

  return {
    id: view.id,
    status: STATUS_MAP[view.status],
    createdAt: view.requestedAt,
    acceptedAt: view.acceptedAt ?? undefined,
    expiresAt: view.expiresAt,
    closedAt: view.closedAt ?? undefined,
    payoutDueAt: view.payoutDueAt ?? undefined,
    disputeTicket: view.disputeTicket ?? undefined,
    disputedAt: view.disputedAt ?? undefined,
    dispute: toDisputeFile(view.dispute),
    payoutStatus: view.payoutStatus ?? undefined,
    completedBy: view.completedBy === "SHIPPER" || view.completedBy === "SYSTEM" ? view.completedBy : undefined,
    completedAt: view.completedAt ?? undefined,
    disputeOpensAt: view.disputeOpensAt ?? undefined,

    carrier: {
      id: view.carrier.id,
      firstName: view.carrier.firstName ?? "",
      lastInitial: view.carrier.lastInitial,
      avatarUrl: view.carrier.avatarUrl ?? undefined,
      // rating / dealCount / isVerified : B5 (absents, jamais inventés)
    },
    trip: {
      tripId: view.tripId,
      originCity: view.trip.originCity,
      destinationCity: view.trip.destinationCity,
      departureDate: view.trip.departureAt,
      // durationHours / isDirect : durée absente du snapshot (pas d'ETA)
    },
    parcel: {
      category: view.parcel.category,
      weightKg: view.pricing.weightKg,
      declaredValueEur: view.parcel.declaredValueCents / 100,
      description: view.parcel.description,
      photos: toPhotos(view.parcel.photoUrls, "DECLARED_PACKAGED"),
    },
    pickupLocation: toLocation(view.pickupPlace, view.trip.originCity),
    recipient: {
      firstName: view.recipient.firstName,
      lastName: view.recipient.lastName,
      // La ville du destinataire n'est pas snapshotée : la remise a
      // lieu dans la ville d'arrivée du trajet.
      city: view.trip.destinationCity,
    },
    insurance:
      view.pricing.protectionTier === "EXTENDED_500"
        ? "EXTENDED_500"
        : "BASIC",

    payment: {
      totalPaidEur: view.pricing.totalShipperCents / 100,
      // cardBrand / cardLast4 / statementDescriptor : Stripe (backlog)
    },
    deliveryCode: {
      // AVAILABLE dès le pickup (le code est servi par GET /deals/:id en
      // PICKED_UP — D43), VALIDATED une fois la remise faite. Un PICKED_UP
      // sans code (enregistrement antérieur à B3) garde `code` absent.
      status: view.deliveredAt ? "VALIDATED" : view.pickedUpAt ? "AVAILABLE" : "PENDING",
      code: hasCode ? (view.deliveryCode as string) : undefined,
      regeneratedCount: MAX_CODE_REGENERATIONS - view.codeRegenerationsLeft,
    },

    pickup: view.pickup
      ? {
          pickedUpAt: view.pickup.confirmedAt,
          locationName: view.pickupPlace?.details ?? view.trip.originCity,
          photos: toPhotos(view.pickup.photoUrls, "PICKUP_PACKAGED"),
          notes: view.pickup.notes ?? undefined,
        }
      : undefined,

    delivery: view.deliveredAt
      ? {
          deliveredAt: view.deliveredAt,
          validatedBy: "CODE",
        }
      : undefined,

    trackingEvents: toTrackingEvents(view.trackingEvents),

    allowedActions: view.allowedActions,
  };
}
