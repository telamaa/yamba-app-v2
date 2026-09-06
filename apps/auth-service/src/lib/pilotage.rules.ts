/**
 * pilotage.rules.ts — règles PURES du pilotage (C-PR6a, D59 1A / 2A)
 * ===================================================================
 * Courbes par semaine ISO ou par mois UTC, agrégats par corridor. Aucune base ni Redis ici.
 */
import type { CorridorStat, PilotageGranularity, PilotageSeriesPoint } from "@packages/api-contracts";
import { corridorKey } from "@packages/libs/redis/trip-stats";

const DAY = 86_400_000;

/** Lundi 00:00 UTC de la semaine ISO contenant `d`. */
export function isoWeekStart(d: Date): Date {
  const day = (d.getUTCDay() + 6) % 7; // lundi = 0
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
}
/** « YYYY-Www » (ISO 8601) pour le lundi donné. */
export function isoWeekKey(monday: Date): string {
  const thursday = new Date(monday.getTime() + 3 * DAY);
  const year = thursday.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const week = 1 + Math.round((isoWeekStart(thursday).getTime() - isoWeekStart(jan4).getTime()) / (7 * DAY));
  return `${year}-W${String(week).padStart(2, "0")}`;
}
export const monthStart = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
export const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

export function periodStart(d: Date, g: PilotageGranularity): Date {
  return g === "week" ? isoWeekStart(d) : monthStart(d);
}
export function periodKey(d: Date, g: PilotageGranularity): string {
  return g === "week" ? isoWeekKey(isoWeekStart(d)) : monthKey(d);
}
export function nextPeriod(start: Date, g: PilotageGranularity): Date {
  return g === "week" ? new Date(start.getTime() + 7 * DAY) : new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
}
/** Bornes [start, end) d'une clé de période (« 2026-W36 » ou « 2026-09 ») ; null si la clé est invalide. */
export function periodBounds(key: string, g: PilotageGranularity): { start: Date; end: Date } | null {
  if (g === "month") {
    const m = /^(\d{4})-(\d{2})$/.exec(key);
    if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) return null;
    const start = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1));
    return { start, end: nextPeriod(start, "month") };
  }
  const w = /^(\d{4})-W(\d{2})$/.exec(key);
  if (!w) return null;
  const year = Number(w[1]); const week = Number(w[2]);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const start = new Date(isoWeekStart(jan4).getTime() + (week - 1) * 7 * DAY);
  if (isoWeekKey(start) !== key) return null;
  return { start, end: nextPeriod(start, "week") };
}

/** Toutes les périodes de `from` (inclus) à `to` (exclu), vides comprises — une courbe sans trou. */
export function periodsBetween(from: Date, to: Date, g: PilotageGranularity): Date[] {
  const out: Date[] = [];
  for (let p = periodStart(from, g); p.getTime() < to.getTime(); p = nextPeriod(p, g)) out.push(p);
  return out;
}

export type SeriesInput = {
  userCreatedAts: Date[];
  tripPublishedAts: Date[];
  bookings: Array<{
    requestedAt: Date;
    acceptedAt?: Date | null;
    deliveredAt?: Date | null;
    completedAt?: Date | null;
    closedAt?: Date | null;
    disputedAt?: Date | null;
    capturedAt?: Date | null;
    refundedAt?: Date | null;
    refundAmountCents?: number | null;
    payoutStatus?: string | null;
    payoutAmountCents?: number | null;
    payoutSentAt?: Date | null;
    retentionCents?: number | null;
    status: string;
    pricing: { totalShipperCents: number; currencyCode: string; commissionCents?: number; premiumCents?: number };
  }>;
};

type FinanceAcc = { capturedCents: number; refundedCents: number; paidOutCents: number; revenueCents: number; retentionCents: number };

/** Chaque fait compte dans la période de SA date. Périodes vides incluses. */
export function buildSeries(input: SeriesInput, from: Date, to: Date, g: PilotageGranularity): PilotageSeriesPoint[] {
  const points = new Map<string, PilotageSeriesPoint & { _volume: Map<string, number>; _fin: Map<string, FinanceAcc> }>();
  for (const start of periodsBetween(from, to, g)) {
    points.set(periodKey(start, g), { period: periodKey(start, g), periodStart: start.toISOString(), signups: 0, tripsPublished: 0, requests: 0, accepted: 0, delivered: 0, completed: 0, cancelled: 0, disputes: 0, volume: [], finance: [], _volume: new Map(), _fin: new Map() });
  }
  const fin = (p: { _fin: Map<string, FinanceAcc> }, cur: string) => { let f = p._fin.get(cur); if (!f) { f = { capturedCents: 0, refundedCents: 0, paidOutCents: 0, revenueCents: 0, retentionCents: 0 }; p._fin.set(cur, f); } return f; };
  const at = (d: Date | null | undefined) => (d && d.getTime() >= from.getTime() && d.getTime() < to.getTime() ? points.get(periodKey(d, g)) : undefined);
  for (const d of input.userCreatedAts) { const p = at(d); if (p) p.signups += 1; }
  for (const d of input.tripPublishedAts) { const p = at(d); if (p) p.tripsPublished += 1; }
  for (const b of input.bookings) {
    let p = at(b.requestedAt); if (p) p.requests += 1;
    p = at(b.acceptedAt); if (p) p.accepted += 1;
    p = at(b.deliveredAt); if (p) p.delivered += 1;
    p = at(b.disputedAt); if (p) p.disputes += 1;
    const cur = b.pricing.currencyCode;
    if (b.status === "COMPLETED") { p = at(b.completedAt); if (p) { p.completed += 1; fin(p, cur).revenueCents += (b.pricing.commissionCents ?? 0) + (b.pricing.premiumCents ?? 0); } }
    if (b.status === "CANCELLED") { p = at(b.closedAt); if (p) { p.cancelled += 1; fin(p, cur).retentionCents += b.retentionCents ?? 0; } }
    p = at(b.capturedAt);
    if (p) { p._volume.set(cur, (p._volume.get(cur) ?? 0) + b.pricing.totalShipperCents); fin(p, cur).capturedCents += b.pricing.totalShipperCents; }
    if ((b.refundAmountCents ?? 0) > 0) { p = at(b.refundedAt); if (p) fin(p, cur).refundedCents += b.refundAmountCents ?? 0; }
    if (b.payoutStatus === "SENT" || b.payoutStatus === "REVERSED") { p = at(b.payoutSentAt); if (p) fin(p, cur).paidOutCents += b.payoutAmountCents ?? 0; }
  }
  return [...points.values()].map(({ _volume, _fin, ...pt }) => ({
    ...pt,
    volume: [..._volume.entries()].sort().map(([currencyCode, capturedCents]) => ({ currencyCode, capturedCents })),
    finance: [..._fin.entries()].sort().map(([currencyCode, f]) => ({ currencyCode, ...f })),
  }));
}

export type CorridorInput = {
  trips: Array<{ originCity: string | null; originCountryCode: string | null; destinationCity: string | null; destinationCountryCode: string | null }>;
  bookings: Array<{
    trip: { originCity: string; originCountryCode: string | null; destinationCity: string; destinationCountryCode: string | null };
    acceptedAt?: Date | null;
    disputedAt?: Date | null;
    pricing: { weightKg: number; transportCents: number; pricePerKgCents?: number | null; currencyCode: string };
  }>;
  /** Corridors demandés (recherches) sans trajet ni deal : « demande sans offre » */
  searchedCorridors: string[];
  stats: Map<string, { views: number; searches: number; noResult: number }>;
};

/** Agrège trajets et deals par corridor (ville → ville), puis colle les compteurs Redis. Tri : demandes puis recherches. */
export function buildCorridors(input: CorridorInput): CorridorStat[] {
  const rows = new Map<string, CorridorStat & { _kgPrices: number[] }>();
  const get = (key: string, o: { originCity: string; originCountryCode: string | null; destinationCity: string; destinationCountryCode: string | null }) => {
    let r = rows.get(key);
    if (!r) {
      r = { key, originCity: o.originCity, originCountryCode: o.originCountryCode, destinationCity: o.destinationCity, destinationCountryCode: o.destinationCountryCode, tripsPublished: 0, requests: 0, accepted: 0, acceptanceRatePct: null, avgPricePerKgCents: null, currencyCode: null, disputes: 0, views: 0, searches: 0, searchesNoResult: 0, _kgPrices: [] };
      rows.set(key, r);
    }
    return r;
  };
  for (const t of input.trips) {
    const key = corridorKey(t.originCity, t.destinationCity);
    if (!key) continue;
    get(key, { originCity: t.originCity ?? "", originCountryCode: t.originCountryCode, destinationCity: t.destinationCity ?? "", destinationCountryCode: t.destinationCountryCode }).tripsPublished += 1;
  }
  for (const b of input.bookings) {
    const key = corridorKey(b.trip.originCity, b.trip.destinationCity);
    if (!key) continue;
    const r = get(key, b.trip);
    r.requests += 1;
    if (b.acceptedAt) r.accepted += 1;
    if (b.disputedAt) r.disputes += 1;
    const perKg = b.pricing.pricePerKgCents ?? (b.pricing.weightKg > 0 ? Math.round(b.pricing.transportCents / b.pricing.weightKg) : null);
    if (perKg != null && perKg > 0) { r._kgPrices.push(perKg); r.currencyCode = r.currencyCode ?? b.pricing.currencyCode; }
  }
  for (const key of input.searchedCorridors) {
    if (rows.has(key)) continue;
    const [o, d] = key.split(">");
    get(key, { originCity: o ?? key, originCountryCode: null, destinationCity: d ?? "", destinationCountryCode: null });
  }
  const out: CorridorStat[] = [];
  for (const r of rows.values()) {
    const s = input.stats.get(r.key);
    const { _kgPrices, ...rest } = r;
    out.push({
      ...rest,
      acceptanceRatePct: r.requests > 0 ? Math.round((r.accepted / r.requests) * 100) : null,
      avgPricePerKgCents: _kgPrices.length ? Math.round(_kgPrices.reduce((a, b) => a + b, 0) / _kgPrices.length) : null,
      views: s?.views ?? 0,
      searches: s?.searches ?? 0,
      searchesNoResult: s?.noResult ?? 0,
    });
  }
  return out.sort((a, b) => b.requests - a.requests || b.searches - a.searches || b.tripsPublished - a.tripsPublished || a.key.localeCompare(b.key));
}
