/**
 * load.ts — charger les signaux du TrustScore (D71) : faits dénormalisés + deux comptages.
 * Prisma injecté (interface minimale) : auth-service (fiche membre, file des signalements) et
 * deal-service (plafonds à la réservation) chargent de la même façon.
 */
import type { TrustSignals } from "./index";

type Row = Record<string, unknown>;
export type TrustDb = {
  user: { findUnique(args: Row): Promise<Row | null> };
  booking: { count(args: Row): Promise<number> };
  report: { count(args: Row): Promise<number> };
  trip: { findMany(args: Row): Promise<Row[]> };
};

const DAY = 86_400_000;

export async function loadTrustSignals(db: TrustDb, userId: string, now: Date = new Date()): Promise<TrustSignals | null> {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: { createdAt: true, shipperDisputesLostCount: true, shipperLateCancellationsCount: true, shipperCompletedDealsCount: true, shipperRatingsAvg: true, shipperRatingsCount: true, carrierPage: { select: { disputesLostCount: true, lateCancellationsCount: true, completedDealsCount: true, ratingsAvg: true, ratingsCount: true } } },
  });
  if (!u) return null;
  const cp = (u.carrierPage as Row | null) ?? {};
  const n = (v: unknown) => (typeof v === "number" ? v : 0);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const tripIds = (await db.trip.findMany({ where: { userId }, select: { id: true } })).map((t) => t.id as string);
  const targets = [{ targetType: "USER", targetId: userId }, ...(tripIds.length ? [{ targetType: "TRIP", targetId: { in: tripIds } }] : [])];
  const [bookingsLast24h, bookingsThisMonth, reportsOpen, reportsUpheld] = await Promise.all([
    db.booking.count({ where: { shipperId: userId, createdAt: { gte: new Date(now.getTime() - DAY) } } }),
    db.booking.count({ where: { shipperId: userId, createdAt: { gte: monthStart } } }),
    db.report.count({ where: { status: "OPEN", OR: targets } }),
    db.report.count({ where: { status: "REVIEWED", OR: targets } }),
  ]);
  const sRatings = n(u.shipperRatingsCount);
  const cRatings = n(cp.ratingsCount);
  const ratingsCount = sRatings + cRatings;
  const ratingsAvg = ratingsCount ? Math.round(((n(u.shipperRatingsAvg) * sRatings + n(cp.ratingsAvg) * cRatings) / ratingsCount) * 10) / 10 : 0;
  return {
    accountAgeDays: Math.max(0, Math.floor((now.getTime() - (u.createdAt as Date).getTime()) / DAY)),
    disputesLost: n(u.shipperDisputesLostCount) + n(cp.disputesLostCount),
    lateCancellations: n(u.shipperLateCancellationsCount) + n(cp.lateCancellationsCount),
    completedDeals: n(u.shipperCompletedDealsCount) + n(cp.completedDealsCount),
    ratingsAvg,
    ratingsCount,
    reportsOpen,
    reportsUpheld,
    bookingsLast24h,
    bookingsThisMonth,
  };
}
