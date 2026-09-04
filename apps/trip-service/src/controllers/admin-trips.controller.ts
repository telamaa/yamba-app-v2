/**
 * admin-trips.controller.ts — trajets, masquage, billets (C-PR4, D57)
 * ===================================================================
 * GET  /admin/trips?q&status&hidden&ticketPending&carrierId&from   (trips.read)
 * GET  /admin/trips/:id                                            (trips.read) — journalisé TRIP_VIEWED
 * POST /admin/trips/:id/hide/propose  (trips.hide.propose)  · POST /admin/trips/:id/hide (trips.hide.apply) · DELETE …/hide
 * GET  /admin/tickets                 (tickets.review) — file, expire les billets des trajets partis
 * GET  /admin/tickets/:documentId     (tickets.review) — URL du document, journalisé DOCUMENT_VIEWED
 * POST /admin/tickets/:documentId/review (tickets.review)
 * L'auth-service est propriétaire du User : ici on ne LIT le Voyageur que pour l'email et l'état du compte.
 */
import type { NextFunction, Response } from "express";
import prisma from "@packages/libs/prisma";
import { ForbiddenError, NotFoundError, ValidationError } from "@packages/error-handler";
import { recordAdminAction } from "@packages/admin-audit";
import { isEmailConfigured, sendTransactionalEmail } from "@packages/email";
import type { AuthenticatedRequest } from "@packages/middleware/isAuthenticated";
import { HideTripRequestSchema, ObjectIdSchema, ReviewTicketRequestSchema, resolveLocale, type AdminTripFile, type AdminTripSummary, type TicketQueueItem } from "@packages/api-contracts";
import { getTripAdminEmails } from "../emails/admin-trip-emails";
import { TICKET_REJECTION_LABELS, isTicketExpired, ticketReviewOutcome } from "../lib/admin-trips.rules";

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "support@yamba.app";
const USER_APP_URL = (process.env.USER_APP_URL || "http://localhost:3000").replace(/\/$/, "");
const ACTIVE_BOOKING = ["ACCEPTED", "PICKED_UP", "DELIVERED", "DISPUTED"];

function zodErrors(issues: Array<{ path: PropertyKey[]; message: string }>) {
  const errors: Record<string, string> = {};
  for (const i of issues) errors[i.path.map(String).join(".") || "_"] = i.message;
  return errors;
}
function parseId(raw: unknown, what = "id"): string {
  const p = ObjectIdSchema.safeParse(raw);
  if (!p.success) throw new ValidationError(`Invalid ${what}.`);
  return p.data;
}
function meta(req: AuthenticatedRequest) {
  return { ip: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null };
}
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const route = (t: { originCity: string | null; destinationCity: string | null }) => `${t.originCity ?? "?"} → ${t.destinationCity ?? "?"}`;

async function emailCarrier(userId: string, build: (locale: string, u: { firstName: string; email: string }) => { subject: string; content: import("@packages/email").EmailContent }) {
  if (!isEmailConfigured()) return;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, email: true, preferredLocale: true } });
  if (!u) return;
  const locale = resolveLocale(u.preferredLocale);
  const mail = build(locale, u);
  await sendTransactionalEmail({ to: u.email, locale, subject: mail.subject, content: mail.content }).catch(() => undefined);
}

async function adminNames(ids: Array<string | null | undefined>) {
  const clean = [...new Set(ids.filter((x): x is string => !!x))];
  const rows = clean.length ? await prisma.user.findMany({ where: { id: { in: clean } }, select: { id: true, firstName: true, lastName: true } }) : [];
  return (id: string | null | undefined) => {
    const a = rows.find((r) => r.id === id);
    return a ? `${a.firstName} ${a.lastName.charAt(0)}.` : (id ?? "—");
  };
}

/* ── Liste ──────────────────────────────────────────────────── */
export const listTrips = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const status = typeof req.query.status === "string" && req.query.status ? req.query.status : null;
    const hidden = req.query.hidden === "1";
    const ticketPending = req.query.ticketPending === "1";
    const carrierId = typeof req.query.carrierId === "string" && /^[a-f0-9]{24}$/i.test(req.query.carrierId) ? req.query.carrierId : null;
    const from = typeof req.query.from === "string" && req.query.from ? new Date(req.query.from) : null;

    const where: Record<string, unknown> = { isDeleted: false };
    if (status) where.status = status;
    if (hidden) where.hiddenByAdminAt = { not: null };
    if (ticketPending) where.ticketVerificationStatus = "PENDING";
    if (carrierId) where.userId = carrierId;
    if (from && !Number.isNaN(from.getTime())) where.departureAt = { gte: from };
    if (q) {
      if (/^[a-f0-9]{24}$/i.test(q)) where.id = q;
      else where.OR = [{ originCity: { contains: q, mode: "insensitive" } }, { destinationCity: { contains: q, mode: "insensitive" } }];
    }
    const [rows, total] = await Promise.all([
      prisma.trip.findMany({
        where: where as never,
        orderBy: { departureAt: "desc" },
        take: 100,
        select: {
          id: true, status: true, originCity: true, destinationCity: true, departureAt: true, transportMode: true, userId: true,
          ticketVerificationStatus: true, hiddenByAdminAt: true, hideProposedAt: true, publishedAt: true,
          user: { select: { id: true, firstName: true, lastName: true, accountStatus: true } },
        },
      }),
      prisma.trip.count({ where: where as never }),
    ]);
    const ids = rows.map((r) => r.id);
    const active = ids.length
      ? await prisma.booking.groupBy({ by: ["tripId"], where: { tripId: { in: ids }, status: { in: ACTIVE_BOOKING as never }, isDeleted: false }, _count: { _all: true } })
      : [];
    const activeBy = new Map(active.map((a) => [a.tripId, a._count._all]));
    const items: AdminTripSummary[] = rows.map((t) => ({
      id: t.id,
      status: String(t.status),
      originCity: t.originCity ?? "—",
      destinationCity: t.destinationCity ?? "—",
      departureAt: iso(t.departureAt),
      transportMode: t.transportMode ? String(t.transportMode) : null,
      carrier: { id: t.user.id, firstName: t.user.firstName, lastName: t.user.lastName, accountStatus: String(t.user.accountStatus) },
      ticketVerificationStatus: String(t.ticketVerificationStatus),
      hidden: !!t.hiddenByAdminAt,
      hideProposed: !!t.hideProposedAt && !t.hiddenByAdminAt,
      activeBookingsCount: activeBy.get(t.id) ?? 0,
      publishedAt: iso(t.publishedAt),
    }));
    res.status(200).json({ items, total });
  } catch (e) {
    next(e);
  }
};

/* ── Fiche ──────────────────────────────────────────────────── */
export const getTripFile = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req.params.id, "trip id");
    const t = await prisma.trip.findUnique({
      where: { id },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true, accountStatus: true, carrierStatus: true } }, documents: { orderBy: { createdAt: "desc" } } },
    });
    if (!t || t.isDeleted) throw new NotFoundError("Trip not found.");
    const [bookings, actions] = await Promise.all([
      prisma.booking.findMany({ where: { tripId: id, isDeleted: false }, orderBy: { requestedAt: "desc" }, select: { id: true, status: true, shipperId: true, pricing: true, disputeTicket: true, requestedAt: true } }),
      prisma.adminAction.findMany({ where: { targetType: "TRIP", targetId: id }, orderBy: { createdAt: "desc" }, take: 50 }),
    ]);
    const shippers = bookings.length ? await prisma.user.findMany({ where: { id: { in: [...new Set(bookings.map((b) => b.shipperId))] } }, select: { id: true, firstName: true } }) : [];
    const shipperName = (sid: string) => shippers.find((s) => s.id === sid)?.firstName ?? "—";
    const nameOf = await adminNames([t.hiddenByAdminId, t.hideProposedByAdminId, ...actions.map((a) => a.adminUserId)]);
    const tt = t as typeof t & { capacityKg?: number | null; reservedKg?: number | null; arrivalAt?: Date | null; pricing?: unknown };
    const file: AdminTripFile = {
      id: t.id,
      status: String(t.status),
      originCity: t.originCity ?? "—",
      destinationCity: t.destinationCity ?? "—",
      departureAt: iso(t.departureAt),
      arrivalAt: iso(tt.arrivalAt ?? null),
      transportMode: t.transportMode ? String(t.transportMode) : null,
      capacityKg: tt.capacityKg ?? null,
      reservedKg: tt.reservedKg ?? null,
      pricing: tt.pricing ?? null,
      createdAt: t.createdAt.toISOString(),
      publishedAt: iso(t.publishedAt),
      cancelledAt: iso(t.cancelledAt),
      carrier: { id: t.user.id, firstName: t.user.firstName, lastName: t.user.lastName, email: t.user.email, accountStatus: String(t.user.accountStatus), carrierStatus: String(t.user.carrierStatus) },
      ticketVerificationStatus: String(t.ticketVerificationStatus),
      hidden: t.hiddenByAdminAt ? { at: t.hiddenByAdminAt.toISOString(), reason: t.hiddenReason ?? "", byAdmin: nameOf(t.hiddenByAdminId) } : null,
      hideProposal: t.hideProposedAt && !t.hiddenByAdminAt ? { reason: t.hideProposedReason ?? "", byAdmin: nameOf(t.hideProposedByAdminId), at: t.hideProposedAt.toISOString() } : null,
      documents: t.documents.map((d) => ({
        id: d.id,
        type: String(d.type),
        status: String(d.status),
        originalName: d.originalName,
        createdAt: d.createdAt.toISOString(),
        reviewedAt: iso(d.verifiedAt ?? d.rejectedAt ?? null),
        rejectionReason: d.rejectionReason,
      })),
      bookings: bookings.map((b) => ({
        id: b.id,
        status: String(b.status),
        shipperFirstName: shipperName(b.shipperId),
        weightKg: b.pricing.weightKg,
        totalShipperCents: b.pricing.totalShipperCents,
        transportCents: b.pricing.transportCents,
        currencyCode: b.pricing.currencyCode,
        disputeTicket: b.disputeTicket ?? null,
        requestedAt: b.requestedAt.toISOString(),
      })),
      adminActions: actions.map((a) => ({ id: a.id, at: a.createdAt.toISOString(), admin: nameOf(a.adminUserId), action: a.action, after: a.after ?? null })),
    };
    await recordAdminAction(prisma, { adminUserId: req.user.id, action: "TRIP_VIEWED", targetType: "TRIP", targetId: id, ...meta(req) });
    res.status(200).json(file);
  } catch (e) {
    next(e);
  }
};

/* ── Masquage ───────────────────────────────────────────────── */
async function loadTripForAdmin(req: AuthenticatedRequest) {
  const id = parseId(req.params.id, "trip id");
  const t = await prisma.trip.findUnique({ where: { id }, select: { id: true, userId: true, originCity: true, destinationCity: true, hiddenByAdminAt: true, isDeleted: true } });
  if (!t || t.isDeleted) throw new NotFoundError("Trip not found.");
  if (t.userId === req.user.id) throw new ForbiddenError("You cannot act on your own trip.");
  return t;
}

export const proposeHide = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const t = await loadTripForAdmin(req);
    const parsed = HideTripRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid request", { errors: zodErrors(parsed.error.issues) });
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.trip.update({ where: { id: t.id }, data: { hideProposedReason: parsed.data.reason, hideProposedByAdminId: req.user.id, hideProposedAt: now } });
      await recordAdminAction(tx, { adminUserId: req.user.id, action: "TRIP_HIDE_PROPOSED", targetType: "TRIP", targetId: t.id, after: { reason: parsed.data.reason }, ...meta(req) });
    });
    res.status(200).json({ ok: true, proposedAt: now.toISOString() });
  } catch (e) {
    next(e);
  }
};

export const hideTrip = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const t = await loadTripForAdmin(req);
    const parsed = HideTripRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid request", { errors: zodErrors(parsed.error.issues) });
    if (t.hiddenByAdminAt) throw new ValidationError("This trip is already hidden.");
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.trip.update({
        where: { id: t.id },
        data: { hiddenByAdminAt: now, hiddenReason: parsed.data.reason, hiddenByAdminId: req.user.id, hideProposedReason: null, hideProposedByAdminId: null, hideProposedAt: null },
      });
      await recordAdminAction(tx, { adminUserId: req.user.id, action: "TRIP_HIDDEN", targetType: "TRIP", targetId: t.id, after: { reason: parsed.data.reason }, ...meta(req) });
    });
    await emailCarrier(t.userId, (locale, u) => getTripAdminEmails(locale).tripHidden({ firstName: u.firstName, route: route(t), tripUrl: `${USER_APP_URL}/${locale}/trips/${t.id}`, supportEmail: SUPPORT_EMAIL }));
    res.status(200).json({ ok: true, hiddenAt: now.toISOString() });
  } catch (e) {
    next(e);
  }
};

export const unhideTrip = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const t = await loadTripForAdmin(req);
    if (!t.hiddenByAdminAt) throw new ValidationError("This trip is not hidden.");
    const parsed = HideTripRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid request", { errors: zodErrors(parsed.error.issues) });
    await prisma.$transaction(async (tx) => {
      await tx.trip.update({ where: { id: t.id }, data: { hiddenByAdminAt: null, hiddenReason: null, hiddenByAdminId: null } });
      await recordAdminAction(tx, { adminUserId: req.user.id, action: "TRIP_UNHIDDEN", targetType: "TRIP", targetId: t.id, after: { reason: parsed.data.reason }, ...meta(req) });
    });
    await emailCarrier(t.userId, (locale, u) => getTripAdminEmails(locale).tripUnhidden({ firstName: u.firstName, route: route(t), tripUrl: `${USER_APP_URL}/${locale}/trips/${t.id}`, supportEmail: SUPPORT_EMAIL }));
    res.status(200).json({ ok: true });
  } catch (e) {
    next(e);
  }
};

/* ── Billets ────────────────────────────────────────────────── */
export const listTickets = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const pending = await prisma.tripDocument.findMany({
      where: { type: "TICKET_PROOF", status: "PENDING" },
      orderBy: { createdAt: "asc" },
      take: 200,
      include: { trip: { select: { id: true, originCity: true, destinationCity: true, departureAt: true, transportMode: true, isDeleted: true, user: { select: { id: true, firstName: true, lastName: true } } } } },
    });
    // 8A — les billets des trajets partis sortent de la file (EXPIRED), en un seul updateMany.
    const expiredIds = pending.filter((d) => d.trip.isDeleted || isTicketExpired(d.trip, now)).map((d) => d.id);
    if (expiredIds.length) await prisma.tripDocument.updateMany({ where: { id: { in: expiredIds } }, data: { status: "EXPIRED", expiredAt: now } });
    const items: TicketQueueItem[] = pending
      .filter((d) => !expiredIds.includes(d.id))
      .map((d) => ({
        documentId: d.id,
        tripId: d.trip.id,
        originCity: d.trip.originCity ?? "—",
        destinationCity: d.trip.destinationCity ?? "—",
        departureAt: iso(d.trip.departureAt),
        transportMode: d.trip.transportMode ? String(d.trip.transportMode) : null,
        carrier: { id: d.trip.user.id, firstName: d.trip.user.firstName, lastName: d.trip.user.lastName },
        originalName: d.originalName,
        mimeType: d.mimeType,
        submittedAt: d.createdAt.toISOString(),
      }));
    res.status(200).json({ items, expiredNow: expiredIds.length });
  } catch (e) {
    next(e);
  }
};

export const viewTicket = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const documentId = parseId(req.params.documentId, "document id");
    const d = await prisma.tripDocument.findUnique({ where: { id: documentId }, select: { id: true, url: true, mimeType: true, originalName: true, status: true, tripId: true } });
    if (!d) throw new NotFoundError("Document not found.");
    // 7A — un billet est une donnée personnelle : chaque ouverture est journalisée.
    await recordAdminAction(prisma, { adminUserId: req.user.id, action: "DOCUMENT_VIEWED", targetType: "TRIP", targetId: d.tripId, after: { documentId: d.id }, ...meta(req) });
    res.status(200).json({ id: d.id, url: d.url, mimeType: d.mimeType, originalName: d.originalName, status: String(d.status) });
  } catch (e) {
    next(e);
  }
};

export const reviewTicket = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const documentId = parseId(req.params.documentId, "document id");
    const parsed = ReviewTicketRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid request", { errors: zodErrors(parsed.error.issues) });
    const d = await prisma.tripDocument.findUnique({ where: { id: documentId }, include: { trip: { select: { id: true, userId: true, originCity: true, destinationCity: true } } } });
    if (!d || d.type !== "TICKET_PROOF") throw new NotFoundError("Ticket not found.");
    if (d.status !== "PENDING") throw new ValidationError("This ticket was already reviewed.");
    if (d.trip.userId === req.user.id) throw new ForbiddenError("You cannot review your own ticket.");
    const outcome = ticketReviewOutcome(parsed.data.decision, parsed.data.reason ?? null);
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      const updated = await tx.tripDocument.updateMany({
        where: { id: d.id, status: "PENDING" },
        data: outcome.documentStatus === "VERIFIED"
          ? { status: "VERIFIED", verifiedAt: now, reviewedByAdminId: req.user.id, rejectionReason: null }
          : { status: "REJECTED", rejectedAt: now, reviewedByAdminId: req.user.id, rejectionReason: outcome.rejectionReason },
      });
      if (updated.count === 0) throw new ValidationError("This ticket was already reviewed.");
      await tx.trip.update({ where: { id: d.trip.id }, data: { ticketVerificationStatus: outcome.tripTicketStatus } });
      await recordAdminAction(tx, {
        adminUserId: req.user.id,
        action: outcome.documentStatus === "VERIFIED" ? "TICKET_VERIFIED" : "TICKET_REJECTED",
        targetType: "TRIP",
        targetId: d.trip.id,
        after: { documentId: d.id, reason: outcome.rejectionReason },
        ...meta(req),
      });
    });
    await emailCarrier(d.trip.userId, (locale, u) => {
      const base = { firstName: u.firstName, route: route(d.trip), tripUrl: `${USER_APP_URL}/${locale}/trips/${d.trip.id}`, supportEmail: SUPPORT_EMAIL };
      const dict = getTripAdminEmails(locale);
      return outcome.documentStatus === "VERIFIED"
        ? dict.ticketVerified(base)
        : dict.ticketRejected({ ...base, reasonLabel: TICKET_REJECTION_LABELS[locale === "en" ? "en" : "fr"][outcome.rejectionReason!] });
    });
    res.status(200).json({ ok: true, status: outcome.documentStatus, tripTicketStatus: outcome.tripTicketStatus });
  } catch (e) {
    next(e);
  }
};
