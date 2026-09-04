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
import type { CorridorsResponse, PilotageGranularity, PilotageSeriesResponse } from "@packages/api-contracts";
import { buildCorridors, buildSeries, periodStart, nextPeriod } from "../lib/pilotage.rules";

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
          where: { isDeleted: false, OR: [{ requestedAt: gte }, { acceptedAt: gte }, { deliveredAt: gte }, { completedAt: gte }, { closedAt: gte }, { disputedAt: gte }, { capturedAt: gte }] },
          select: { requestedAt: true, acceptedAt: true, deliveredAt: true, completedAt: true, closedAt: true, disputedAt: true, capturedAt: true, status: true, pricing: true },
        }),
        prisma.user.count({ where: { isDeleted: false } }),
        prisma.carrierPage.count({ where: { stripePayoutsEnabled: true } }),
        prisma.trip.count({ where: { status: "PUBLISHED", isDeleted: false, departureAt: { gte: now } } }),
      ]);
      const points = buildSeries(
        { userCreatedAts: users.map((u) => u.createdAt), tripPublishedAts: trips.map((t) => t.publishedAt!).filter(Boolean), bookings: bookings.map((b) => ({ ...b, status: String(b.status), pricing: { totalShipperCents: b.pricing.totalShipperCents, currencyCode: b.pricing.currencyCode } })) },
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
