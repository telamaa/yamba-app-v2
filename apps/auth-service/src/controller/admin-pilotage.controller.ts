/**
 * admin-pilotage.controller.ts — courbes et corridors (C-PR6a, D59 1A / 2A / 6A)
 * ==============================================================================
 * GET /admin/pilotage/series?granularity=week|month&months=6   (pilotage.read)
 * GET /admin/pilotage/corridors?days=30                        (pilotage.read)
 * Lectures croisées de la base partagée (aucune écriture), compteurs Redis du trip-service,
 * cache Redis 60 s par requête (6A) — les compteurs d'accueil restent en direct (A110).
 */
import type { NextFunction, Response } from "express";
import prisma from "@packages/libs/prisma";
import redis from "@packages/libs/redis";
import { corridorKey, corridorStats, searchedCorridors } from "@packages/libs/redis/trip-stats";
import { ValidationError } from "@packages/error-handler";
import type { AuthenticatedRequest } from "@packages/middleware/isAuthenticated";
import { recordAdminAction } from "@packages/admin-audit";
import { PilotageMetricSchema, type CorridorsResponse, type PilotageDrilldownItem, type PilotageDrilldownResponse, type PilotageGranularity, type PilotageSeriesResponse } from "@packages/api-contracts";
import { buildCorridors, buildSeries, periodBounds, periodStart, nextPeriod } from "../lib/pilotage.rules";

export const PILOTAGE_CACHE_SECONDS = 60;
const cacheKey = (name: string) => `yamba:pilotage:${name}`;

async function cached<T>(name: string, compute: () => Promise<T>): Promise<{ value: T; cached: boolean }> {
  try {
    const hit = await redis.get(cacheKey(name));
    if (hit) return { value: JSON.parse(hit) as T, cached: true };
  } catch { /* Redis absent : calcul direct */ }
  const value = await compute();
  try { await redis.set(cacheKey(name), JSON.stringify(value), "EX", PILOTAGE_CACHE_SECONDS); } catch { /* idem */ }
  return { value, cached: false };
}

export const getPilotageSeries = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const granularity = (req.query.granularity === "month" ? "month" : "week") as PilotageGranularity;
    const months = typeof req.query.months === "string" ? Number(req.query.months) : granularity === "week" ? 3 : 12;
    if (!Number.isFinite(months) || months < 1 || months > 24) throw new ValidationError("months must be between 1 and 24.");
    const now = new Date();
    const to = nextPeriod(periodStart(now, granularity), granularity);
    const from = periodStart(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1)), granularity);
    const { value, cached: hit } = await cached(`series:${granularity}:${months}`, async () => {
      const gte = { gte: from };
      const [users, trips, bookings, usersTotal, carriersReady, tripsOpen] = await Promise.all([
        prisma.user.findMany({ where: { createdAt: gte, isDeleted: false }, select: { createdAt: true } }),
        prisma.trip.findMany({ where: { publishedAt: gte, isDeleted: false }, select: { publishedAt: true } }),
        prisma.booking.findMany({
          where: { isDeleted: false, OR: [{ requestedAt: gte }, { acceptedAt: gte }, { deliveredAt: gte }, { completedAt: gte }, { closedAt: gte }, { disputedAt: gte }, { capturedAt: gte }, { refundedAt: gte }, { payoutSentAt: gte }] },
          // C-PR6c (D60 4A) — finances par période : remboursement, versement, retenue
          select: { requestedAt: true, acceptedAt: true, deliveredAt: true, completedAt: true, closedAt: true, disputedAt: true, capturedAt: true, refundedAt: true, refundAmountCents: true, payoutStatus: true, payoutAmountCents: true, payoutSentAt: true, retentionCents: true, status: true, pricing: true },
        }),
        prisma.user.count({ where: { isDeleted: false } }),
        prisma.carrierPage.count({ where: { stripePayoutsEnabled: true } }),
        prisma.trip.count({ where: { status: "PUBLISHED", isDeleted: false, departureAt: { gte: now } } }),
      ]);
      const points = buildSeries(
        { userCreatedAts: users.map((u) => u.createdAt), tripPublishedAts: trips.map((t) => t.publishedAt!).filter(Boolean), bookings: bookings.map((b) => ({ ...b, status: String(b.status), payoutStatus: b.payoutStatus ? String(b.payoutStatus) : null, pricing: { totalShipperCents: b.pricing.totalShipperCents, currencyCode: b.pricing.currencyCode, commissionCents: b.pricing.commissionCents, premiumCents: b.pricing.premiumCents } })) },
        from, to, granularity
      );
      return { granularity, from: from.toISOString(), to: to.toISOString(), points, totals: { users: usersTotal, carriersReady, tripsPublishedOpen: tripsOpen }, generatedAt: now.toISOString() };
    });
    const out: PilotageSeriesResponse = { ...value, cached: hit };
    res.status(200).json(out);
  } catch (e) {
    next(e);
  }
};

export const getPilotageCorridors = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const days = typeof req.query.days === "string" ? Number(req.query.days) : 30;
    if (!Number.isFinite(days) || days < 1 || days > 365) throw new ValidationError("days must be between 1 and 365.");
    const now = new Date();
    const from = new Date(now.getTime() - days * 86_400_000);
    const { value, cached: hit } = await cached(`corridors:${days}`, async () => {
      const [trips, bookings] = await Promise.all([
        prisma.trip.findMany({ where: { publishedAt: { gte: from }, isDeleted: false }, select: { originCity: true, originCountryCode: true, destinationCity: true, destinationCountryCode: true } }),
        prisma.booking.findMany({ where: { requestedAt: { gte: from }, isDeleted: false }, select: { trip: true, acceptedAt: true, disputedAt: true, pricing: true } }),
      ]);
      let searched: string[] = [];
      try { searched = await searchedCorridors(redis); } catch { /* Redis absent */ }
      const keys = new Set<string>(searched);
      for (const t of trips) { const k = corridorKey(t.originCity, t.destinationCity); if (k) keys.add(k); }
      for (const b of bookings) { const k = corridorKey(b.trip.originCity, b.trip.destinationCity); if (k) keys.add(k); }
      let stats = new Map<string, { views: number; searches: number; noResult: number }>();
      try { stats = await corridorStats(redis, [...keys], now, days); } catch { /* Redis absent */ }
      const items = buildCorridors({
        trips,
        bookings: bookings.map((b) => ({ trip: { originCity: b.trip.originCity, originCountryCode: b.trip.originCountryCode ?? null, destinationCity: b.trip.destinationCity, destinationCountryCode: b.trip.destinationCountryCode ?? null }, acceptedAt: b.acceptedAt, disputedAt: b.disputedAt, pricing: { weightKg: b.pricing.weightKg, transportCents: b.pricing.transportCents, pricePerKgCents: b.pricing.pricePerKgCents ?? null, currencyCode: b.pricing.currencyCode } })),
        searchedCorridors: searched,
        stats,
      });
      return { periodDays: days, from: from.toISOString(), items, generatedAt: now.toISOString() };
    });
    const out: CorridorsResponse = { ...value, cached: hit };
    res.status(200).json(out);
  } catch (e) {
    next(e);
  }
};

/* ── C-PR6c (D60 3A) — drill-down : les éléments derrière un point, bornés à 200 ── */
const DRILLDOWN_LIMIT = 200;
const DEAL_DATE_FIELD: Record<string, string> = { requests: "requestedAt", accepted: "acceptedAt", delivered: "deliveredAt", completed: "completedAt", cancelled: "closedAt", disputes: "disputedAt", captured: "capturedAt", refunded: "refundedAt", paidOut: "payoutSentAt", revenue: "completedAt", retention: "closedAt" };

export const getPilotageDrilldown = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const metric = PilotageMetricSchema.safeParse(req.query.metric);
    if (!metric.success) throw new ValidationError("Invalid metric.");
    const granularity = (req.query.granularity === "month" ? "month" : "week") as PilotageGranularity;
    const period = typeof req.query.period === "string" ? req.query.period : "";
    const bounds = periodBounds(period, granularity);
    if (!bounds) throw new ValidationError("Invalid period key.");
    const range = { gte: bounds.start, lt: bounds.end };
    let items: PilotageDrilldownItem[] = [];
    let total = 0;
    if (metric.data === "signups") {
      const [rows, count] = await Promise.all([
        prisma.user.findMany({ where: { createdAt: range, isDeleted: false }, orderBy: { createdAt: "asc" }, take: DRILLDOWN_LIMIT, select: { id: true, firstName: true, lastName: true, createdAt: true, accountStatus: true } }),
        prisma.user.count({ where: { createdAt: range, isDeleted: false } }),
      ]);
      items = rows.map((u) => ({ kind: "USER", id: u.id, label: `${u.firstName} ${u.lastName.charAt(0)}.`, at: u.createdAt.toISOString(), status: String(u.accountStatus), amountCents: null, currencyCode: null }));
      total = count;
      // Une liste de personnes : la consultation est journalisée (D56 4A, D60 2A)
      await recordAdminAction(prisma, { adminUserId: req.user.id, action: "PILOTAGE_DRILLDOWN_VIEWED", targetType: "USER", after: { metric: metric.data, period, count }, ip: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null });
    } else if (metric.data === "tripsPublished") {
      const [rows, count] = await Promise.all([
        prisma.trip.findMany({ where: { publishedAt: range, isDeleted: false }, orderBy: { publishedAt: "asc" }, take: DRILLDOWN_LIMIT, select: { id: true, originCity: true, destinationCity: true, publishedAt: true, status: true } }),
        prisma.trip.count({ where: { publishedAt: range, isDeleted: false } }),
      ]);
      items = rows.map((t) => ({ kind: "TRIP", id: t.id, label: `${t.originCity ?? "?"} → ${t.destinationCity ?? "?"}`, at: t.publishedAt!.toISOString(), status: String(t.status), amountCents: null, currencyCode: null }));
      total = count;
    } else {
      const field = DEAL_DATE_FIELD[metric.data];
      const where: Record<string, unknown> = { isDeleted: false, [field]: range };
      if (metric.data === "completed" || metric.data === "revenue") where.status = "COMPLETED";
      if (metric.data === "cancelled") where.status = "CANCELLED";
      if (metric.data === "retention") { where.status = "CANCELLED"; where.retentionCents = { gt: 0 }; }
      if (metric.data === "refunded") where.refundAmountCents = { gt: 0 };
      if (metric.data === "paidOut") where.payoutStatus = { in: ["SENT", "REVERSED"] };
      const [rows, count] = await Promise.all([
        prisma.booking.findMany({ where: where as never, orderBy: { [field]: "asc" } as never, take: DRILLDOWN_LIMIT, select: { id: true, trip: true, status: true, pricing: true, refundAmountCents: true, payoutAmountCents: true, retentionCents: true, requestedAt: true, acceptedAt: true, deliveredAt: true, completedAt: true, closedAt: true, disputedAt: true, capturedAt: true, refundedAt: true, payoutSentAt: true } }),
        prisma.booking.count({ where: where as never }),
      ]);
      const amount = (b: (typeof rows)[number]): number | null => {
        switch (metric.data) {
          case "captured": return b.pricing.totalShipperCents;
          case "refunded": return b.refundAmountCents ?? null;
          case "paidOut": return b.payoutAmountCents ?? null;
          case "revenue": return b.pricing.commissionCents + b.pricing.premiumCents;
          case "retention": return b.retentionCents ?? null;
          default: return b.pricing.totalShipperCents;
        }
      };
      items = rows.map((b) => ({
        kind: "DEAL",
        id: b.id,
        label: `${b.trip.originCity} → ${b.trip.destinationCity}`,
        at: ((b as unknown as Record<string, Date | null>)[field] ?? b.requestedAt).toISOString(),
        status: String(b.status),
        amountCents: amount(b),
        currencyCode: b.pricing.currencyCode,
      }));
      total = count;
    }
    const out: PilotageDrilldownResponse = { metric: metric.data, granularity, period, periodStart: bounds.start.toISOString(), periodEnd: bounds.end.toISOString(), items, total, truncated: total > items.length };
    res.status(200).json(out);
  } catch (e) {
    next(e);
  }
};
