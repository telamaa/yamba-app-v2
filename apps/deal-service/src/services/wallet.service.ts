/**
 * wallet.service.ts — le portefeuille des deux rôles, calculé serveur (A83)
 * ========================================================================
 * Emplacement : apps/deal-service/src/services/wallet.service.ts
 *
 * Fonction PURE : des enregistrements Booking (déjà filtrés par rôle) + les
 * prénoms des contreparties + une horloge → totaux et lignes du contrat
 * `WalletResponse`. Aucune règle d'argent nouvelle ici : chaque ligne
 * reflète des champs posés par les transitions (payoutStatus, refund,
 * retention…). Le front affiche, ne recalcule jamais (décision 2A).
 */

import type { CarrierWallet, ShipperWallet, WalletPaymentItem, WalletPayoutItem } from "@packages/api-contracts";

/** Sous-ensemble Booking lu par le portefeuille (mêmes noms que Prisma). */
export type WalletBookingRecord = {
  id: string;
  tripId: string;
  shipperId: string;
  carrierId: string;
  status: string;
  trip: { originCity: string; destinationCity: string };
  pricing: { transportCents: number; totalShipperCents: number; currencyCode: string };
  requestedAt: Date;
  updatedAt: Date;
  capturedAt?: Date | null;
  payoutDueAt?: Date | null;
  completedAt?: Date | null;
  refundedAt?: Date | null;
  refundAmountCents?: number | null;
  retentionCents?: number | null;
  retentionDisposition?: string | null;
  payoutStatus?: string | null;
  payoutSentAt?: Date | null;
  payoutAmountCents?: number | null;
  payoutFailureReason?: string | null;
};

export type WalletCounterparts = Map<string, { firstName: string | null }>;

const iso = (d: Date | null | undefined): string | null => (d ? new Date(d).toISOString() : null);
const sum = (items: { amountCents: number | null }[]): number => items.reduce((acc, i) => acc + (i.amountCents ?? 0), 0);

function sameMonthUtc(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}

/* ══ Voyageur ═════════════════════════════════════════════════ */

export function toPayoutItem(b: WalletBookingRecord, counterparts: WalletCounterparts): WalletPayoutItem | null {
  const base = {
    bookingId: b.id,
    tripId: b.tripId,
    bookingStatus: b.status as WalletPayoutItem["bookingStatus"],
    corridor: { originCity: b.trip.originCity, destinationCity: b.trip.destinationCity },
    counterpartFirstName: counterparts.get(b.shipperId)?.firstName ?? null,
    currencyCode: b.pricing.currencyCode,
  };
  const kind: WalletPayoutItem["kind"] = b.status === "CANCELLED" ? "LATE_CANCELLATION" : "DELIVERY";
  const amount = b.status === "CANCELLED" ? (b.payoutAmountCents ?? null) : b.pricing.transportCents;

  if (b.status === "DELIVERED") {
    return { ...base, kind, state: "UPCOMING", amountCents: b.pricing.transportCents, date: iso(b.payoutDueAt) };
  }
  if (b.status === "DISPUTED") {
    return { ...base, kind, state: "FROZEN", amountCents: b.pricing.transportCents, date: iso(b.updatedAt) };
  }
  if (b.status === "CANCELLED" && b.retentionDisposition === "HELD_FOR_MEDIATION") {
    return { ...base, kind, state: "HELD", amountCents: null, date: iso(b.refundedAt ?? b.updatedAt) };
  }
  if (b.status === "COMPLETED" || (b.status === "CANCELLED" && b.retentionDisposition === "CARRIER")) {
    switch (b.payoutStatus) {
      case "SENT":
        return { ...base, kind, state: "SENT", amountCents: amount, date: iso(b.payoutSentAt) };
      case "FAILED":
        return b.payoutFailureReason === "CARRIER_ACCOUNT_NOT_READY"
          ? { ...base, kind, state: "BLOCKED", amountCents: amount, date: iso(b.updatedAt) }
          : { ...base, kind, state: "PENDING", amountCents: amount, date: iso(b.updatedAt) };
      case "PENDING":
        return { ...base, kind, state: "PENDING", amountCents: amount, date: iso(b.updatedAt) };
      default:
        return null; // COMPLETED antérieur à B4 sans versement tracé : rien à montrer
    }
  }
  return null; // PENDING / ACCEPTED / PICKED_UP / DECLINED / EXPIRED : pas d'argent sortant
}

export function buildCarrierWallet(bookings: WalletBookingRecord[], counterparts: WalletCounterparts, now: Date): CarrierWallet {
  const items = bookings
    .map((b) => toPayoutItem(b, counterparts))
    .filter((i): i is WalletPayoutItem => i !== null)
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const of = (state: WalletPayoutItem["state"]) => items.filter((i) => i.state === state);
  const sent = of("SENT");
  return {
    upcomingCents: sum(of("UPCOMING")),
    pendingCents: sum(of("PENDING")) + sum(of("BLOCKED")) + sum(of("FROZEN")),
    blockedCents: sum(of("BLOCKED")),
    sentCents: sum(sent),
    sentThisMonthCents: sum(sent.filter((i) => i.date !== null && sameMonthUtc(new Date(i.date), now))),
    currencyCode: bookings[0]?.pricing.currencyCode ?? "EUR",
    items,
  };
}

/* ══ Expéditeur ═══════════════════════════════════════════════ */

export function toPaymentItem(b: WalletBookingRecord, counterparts: WalletCounterparts): WalletPaymentItem {
  const total = b.pricing.totalShipperCents;
  const base = {
    bookingId: b.id,
    tripId: b.tripId,
    bookingStatus: b.status as WalletPaymentItem["bookingStatus"],
    corridor: { originCity: b.trip.originCity, destinationCity: b.trip.destinationCity },
    counterpartFirstName: counterparts.get(b.carrierId)?.firstName ?? null,
    amountCents: total,
    currencyCode: b.pricing.currencyCode,
    refundAmountCents: null as number | null,
    retentionCents: null as number | null,
  };
  switch (b.status) {
    case "PENDING":
      return { ...base, state: "AUTHORIZED", date: iso(b.requestedAt) };
    case "ACCEPTED":
    case "PICKED_UP":
      return { ...base, state: "HELD", date: iso(b.requestedAt) };
    case "DELIVERED":
    case "DISPUTED":
      return { ...base, state: "HELD", date: iso(b.payoutDueAt ?? b.requestedAt) };
    case "COMPLETED":
      return { ...base, state: "RELEASED", date: iso(b.completedAt ?? b.updatedAt) };
    case "CANCELLED": {
      // Rien débité (annulé en PENDING) : l'empreinte a disparu, pas un remboursement.
      if (!b.capturedAt) return { ...base, state: "RELEASED_NO_CHARGE", date: iso(b.refundedAt ?? b.updatedAt) };
      const refund = b.refundAmountCents ?? total;
      if (refund < total) {
        return { ...base, state: "PARTIALLY_REFUNDED", refundAmountCents: refund, retentionCents: total - refund, date: iso(b.refundedAt) };
      }
      return { ...base, state: "REFUNDED", refundAmountCents: refund, date: iso(b.refundedAt) };
    }
    default: // DECLINED / EXPIRED : jamais capturé
      return { ...base, state: "RELEASED_NO_CHARGE", date: iso(b.refundedAt ?? b.updatedAt) };
  }
}

export function buildShipperWallet(bookings: WalletBookingRecord[], counterparts: WalletCounterparts): ShipperWallet {
  const items = bookings
    .map((b) => toPaymentItem(b, counterparts))
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const held = items.filter((i) => i.state === "HELD");
  const released = items.filter((i) => i.state === "RELEASED");
  const partial = items.filter((i) => i.state === "PARTIALLY_REFUNDED");
  const refunded = items.filter((i) => i.state === "REFUNDED");
  return {
    heldCents: sum(held),
    spentCents: sum(released) + partial.reduce((acc, i) => acc + (i.retentionCents ?? 0), 0),
    refundedCents: [...refunded, ...partial].reduce((acc, i) => acc + (i.refundAmountCents ?? 0), 0),
    currencyCode: bookings[0]?.pricing.currencyCode ?? "EUR",
    items,
  };
}
