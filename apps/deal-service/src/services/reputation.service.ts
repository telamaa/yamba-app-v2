/**
 * reputation.service.ts — la réputation VISIBLE, calculée serveur (B5, D29①, REP-03)
 * ==================================================================================
 * Emplacement : apps/deal-service/src/services/reputation.service.ts
 *
 * Des faits explicables que le membre contrôle, jamais une note opaque :
 *  - moyenne et nombre des avis RÉVÉLÉS (double-aveugle, D53),
 *  - deals terminés (COMPLETED) dans le rôle,
 *  - annulations « fautives » dans le rôle : Voyageur = annulation après
 *    acceptation (ANN-02, closedBy CARRIER) ; Expéditeur = annulation tardive
 *    (ANN-01, retenue > 0).
 * Niveaux (REPUTATION_PARAMS, seuils serveur) : NEW / CONFIRMED / TOP.
 * Recalculé à chaque événement qui change un fait (révélation d'avis,
 * COMPLETED, annulation) et DÉNORMALISÉ sur CarrierPage / User : le profil
 * public (auth-service) et la recherche (trip-service) lisent, ne calculent
 * pas. `isSuperCarrier` suit le niveau TOP (badge « Top Voyageur »).
 */

import prisma from "@packages/libs/prisma";
import { REPUTATION_PARAMS, type ReputationLevel } from "@packages/api-contracts";

export type ReputationFacts = { ratingsAvg: number; ratingsCount: number; completedDealsCount: number; lateCancellationsCount: number };

/** Pur : les faits → le niveau (critères REP-03, seuils = paramètres serveur). */
export function computeReputationLevel(role: "CARRIER" | "SHIPPER", f: ReputationFacts): ReputationLevel {
  const p = REPUTATION_PARAMS[role === "CARRIER" ? "carrier" : "shipper"];
  if (f.completedDealsCount >= p.topMinDeals && f.ratingsCount > 0 && f.ratingsAvg >= p.topMinRating && f.lateCancellationsCount <= p.topMaxLateCancellations) {
    return "TOP";
  }
  if (f.completedDealsCount >= p.confirmedMinDeals) return "CONFIRMED";
  return "NEW";
}

/** Pur : moyenne arrondie au dixième (jamais de float brut en base). */
export function averageOf(ratings: number[]): number {
  if (ratings.length === 0) return 0;
  return Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;
}

async function carrierFacts(userId: string): Promise<ReputationFacts> {
  const [reviews, completed, late] = await Promise.all([
    prisma.review.findMany({ where: { subjectUserId: userId, kind: "AS_CARRIER", revealedAt: { not: null } }, select: { rating: true } }),
    prisma.booking.count({ where: { carrierId: userId, status: "COMPLETED", isDeleted: false } }),
    prisma.booking.count({ where: { carrierId: userId, status: "CANCELLED", closedBy: "CARRIER", isDeleted: false, acceptedAt: { not: null } } }),
  ]);
  return { ratingsAvg: averageOf(reviews.map((r) => r.rating)), ratingsCount: reviews.length, completedDealsCount: completed, lateCancellationsCount: late };
}

async function shipperFacts(userId: string): Promise<ReputationFacts> {
  const [reviews, completed, late] = await Promise.all([
    prisma.review.findMany({ where: { subjectUserId: userId, kind: "AS_SHIPPER", revealedAt: { not: null } }, select: { rating: true } }),
    prisma.booking.count({ where: { shipperId: userId, status: "COMPLETED", isDeleted: false } }),
    prisma.booking.count({ where: { shipperId: userId, status: "CANCELLED", isDeleted: false, retentionCents: { gt: 0 } } }),
  ]);
  return { ratingsAvg: averageOf(reviews.map((r) => r.rating)), ratingsCount: reviews.length, completedDealsCount: completed, lateCancellationsCount: late };
}

/** Recalcule et dénormalise la réputation d'un membre dans UN rôle. Idempotent, best-effort (jamais bloquant). */
export async function recomputeReputation(userId: string, role: "CARRIER" | "SHIPPER"): Promise<ReputationLevel | null> {
  if (role === "CARRIER") {
    const page = await prisma.carrierPage.findUnique({ where: { userId }, select: { id: true } });
    if (!page) return null; // pas de page Voyageur : rien à afficher
    const f = await carrierFacts(userId);
    const level = computeReputationLevel("CARRIER", f);
    await prisma.carrierPage.update({
      where: { userId },
      data: {
        ratingsAvg: f.ratingsAvg,
        ratingsCount: f.ratingsCount,
        completedDealsCount: f.completedDealsCount,
        lateCancellationsCount: f.lateCancellationsCount,
        reputationLevel: level,
        isSuperCarrier: level === "TOP",
      },
    });
    return level;
  }
  const f = await shipperFacts(userId);
  const level = computeReputationLevel("SHIPPER", f);
  await prisma.user.update({
    where: { id: userId },
    data: {
      shipperRatingsAvg: f.ratingsAvg,
      shipperRatingsCount: f.ratingsCount,
      shipperCompletedDealsCount: f.completedDealsCount,
      shipperLateCancellationsCount: f.lateCancellationsCount,
      shipperReputationLevel: level,
    },
  });
  return level;
}

/** Les deux parties d'un deal, sans jamais faire échouer l'appelant. */
export async function recomputeBookingParties(booking: { shipperId: string; carrierId: string }): Promise<void> {
  await Promise.all([
    recomputeReputation(booking.carrierId, "CARRIER").catch(() => null),
    recomputeReputation(booking.shipperId, "SHIPPER").catch(() => null),
  ]);
}
