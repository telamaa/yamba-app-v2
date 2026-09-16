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
import { withWriteConflictRetry } from "@packages/libs/prisma/write-conflict-retry";
import { ForbiddenError, NotFoundError, ValidationError } from "@packages/error-handler";
import { recordAdminAction } from "@packages/admin-audit";
import { isEmailConfigured, sendTransactionalEmail } from "@packages/email";
import type { AuthenticatedRequest } from "@packages/middleware/isAuthenticated";
import { AdminTripsQuerySchema, HideTripRequestSchema, ObjectIdSchema, ReviewTicketRequestSchema, TicketQueueQuerySchema, type AdminTripFile, type AdminTripSummary, type TicketQueueItem } from "@packages/api-contracts";
import { CSV_BOM, EXPORT_MAX_ROWS, buildCsv, capExportRows, csvFilename, csvResponseHeaders } from "@packages/libs/csv";
import { getTripAdminEmails } from "../emails/admin-trip-emails";
import { makeCarrierMailer } from "../lib/carrier-mailer";
import { TICKETS_CSV_COLUMNS, TICKET_REJECTION_LABELS, TRIPS_CSV_COLUMNS, buildTicketsWhere, departedTicketsWhere, fileExtensionOf, buildTripsOrderBy, buildTripsWhere, effectiveTicketStatus, notHiddenFilter, ticketReviewOutcome } from "../lib/admin-trips.rules";
import { ticketNotReviewableReason, tripTicketStatusFromDocuments } from "../lib/ticket-status.rules";

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
  if (!p.success) throw new ValidationError(`Invalid ${what}.`, { code: "INVALID_ID" });
  return p.data;
}
function meta(req: AuthenticatedRequest) {
  return { ip: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null };
}
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const route = (t: { originCity: string | null; destinationCity: string | null }) => `${t.originCity ?? "?"} → ${t.destinationCity ?? "?"}`;

/** ANO-ADM-10 — la règle D35 (compte effacé, adresse en suppression) s'applique aussi aux emails d'administration. */
const emailCarrier = makeCarrierMailer({
  isConfigured: isEmailConfigured,
  findUser: (userId) => prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, email: true, preferredLocale: true, isDeleted: true, emailSuppressedAt: true } }),
  send: (mail) => sendTransactionalEmail(mail),
  log: (message) => console.error(message),
});

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
    // C-PR7a (D60 2A) — filtres serveur validés, tri, curseur (l'id en second : stable)
    const parsed = AdminTripsQuerySchema.safeParse(req.query);
    if (!parsed.success) throw new ValidationError("Invalid query.", { code: "INVALID_QUERY" });
    const q = parsed.data;
    const now = new Date();
    const where = buildTripsWhere(q, now);
    const [rows, total] = await Promise.all([
      prisma.trip.findMany({
        where: where as never,
        orderBy: buildTripsOrderBy(q) as never,
        take: q.limit + 1,
        ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
        select: {
          id: true, status: true, originCity: true, destinationCity: true, departureAt: true, transportMode: true, userId: true,
          ticketVerificationStatus: true, hiddenByAdminAt: true, hideProposedAt: true, publishedAt: true,
          user: { select: { id: true, firstName: true, lastName: true, accountStatus: true } },
        },
      }),
      prisma.trip.count({ where: where as never }),
    ]);
    const hasNext = rows.length > q.limit;
    const page = hasNext ? rows.slice(0, q.limit) : rows;
    const ids = page.map((r) => r.id);
    const active = ids.length
      ? await prisma.booking.groupBy({ by: ["tripId"], where: { tripId: { in: ids }, status: { in: ACTIVE_BOOKING as never }, isDeleted: false }, _count: { _all: true } })
      : [];
    const activeBy = new Map(active.map((a) => [a.tripId, a._count._all]));
    const items: AdminTripSummary[] = page.map((t) => ({
      id: t.id,
      status: String(t.status),
      originCity: t.originCity ?? "—",
      destinationCity: t.destinationCity ?? "—",
      departureAt: iso(t.departureAt),
      transportMode: t.transportMode ? String(t.transportMode) : null,
      carrier: { id: t.user.id, firstName: t.user.firstName, lastName: t.user.lastName, accountStatus: String(t.user.accountStatus) },
      ticketVerificationStatus: effectiveTicketStatus({ ticketVerificationStatus: String(t.ticketVerificationStatus), departureAt: t.departureAt }, now), // ANO-ADM-16
      hidden: !!t.hiddenByAdminAt,
      hideProposed: !!t.hideProposedAt && !t.hiddenByAdminAt,
      activeBookingsCount: activeBy.get(t.id) ?? 0,
      publishedAt: iso(t.publishedAt),
    }));
    res.status(200).json({ items, total, nextCursor: hasNext ? page[page.length - 1].id : null });
  } catch (e) {
    next(e);
  }
};

/** C-PR7a (D60 2A) — export CSV opérationnel des trajets : identifiants seulement, journalisé, 5 000 lignes max. */
export const exportTrips = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = AdminTripsQuerySchema.safeParse(req.query);
    if (!parsed.success) throw new ValidationError("Invalid query.", { code: "INVALID_QUERY" });
    const q = parsed.data;
    const found = await prisma.trip.findMany({
      where: buildTripsWhere(q) as never,
      orderBy: buildTripsOrderBy(q) as never,
      take: EXPORT_MAX_ROWS + 1,
      select: { id: true, status: true, originCity: true, originCountryCode: true, destinationCity: true, destinationCountryCode: true, departureAt: true, publishedAt: true, cancelledAt: true, userId: true, transportMode: true, capacityKg: true, reservedKg: true, pricePerKgCents: true, ticketVerificationStatus: true, hiddenByAdminAt: true, createdAt: true },
    });
    const { rows, truncated } = capExportRows(found);
    const now = new Date();
    const { cursor: _c, limit: _l, ...filters } = q;
    await recordAdminAction(prisma, { adminUserId: req.user.id, action: "EXPORTED", targetType: "TRIP", after: { domain: "trips", personal: false, filters, rows: rows.length, truncated }, ...meta(req) });
    res.set(csvResponseHeaders(csvFilename("trajets", now), rows.length, truncated));
    res.status(200).send(CSV_BOM + buildCsv(TRIPS_CSV_COLUMNS, rows.map((t) => ({ ...t, carrierId: t.userId, status: String(t.status), transportMode: t.transportMode ? String(t.transportMode) : null, ticketVerificationStatus: String(t.ticketVerificationStatus) }))));
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
    if (!t || t.isDeleted) throw new NotFoundError("Trip not found.", { code: "TRIP_NOT_FOUND" });
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
      ticketVerificationStatus: effectiveTicketStatus({ ticketVerificationStatus: String(t.ticketVerificationStatus), departureAt: t.departureAt }, new Date()), // ANO-ADM-16
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
  if (!t || t.isDeleted) throw new NotFoundError("Trip not found.", { code: "TRIP_NOT_FOUND" });
  if (t.userId === req.user.id) throw new ForbiddenError("You cannot act on your own trip.", { code: "ADMIN_IS_OWNER" });
  return t;
}

export const proposeHide = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const t = await loadTripForAdmin(req);
    const parsed = HideTripRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid request", { errors: zodErrors(parsed.error.issues) });
    // ANO-ADM-17 — proposer de masquer un trajet DÉJÀ masqué était accepté : la proposition, invisible tant que le trajet
    // est masqué, ressurgissait au rétablissement comme une demande en cours. Refus, et écriture conditionnelle.
    if (t.hiddenByAdminAt) throw new ValidationError("This trip is already hidden.", { code: "TRIP_ALREADY_HIDDEN" });
    const now = new Date();
    const previous = await prisma.trip.findUnique({ where: { id: t.id }, select: { hideProposedAt: true, hideProposedReason: true, hideProposedByAdminId: true } });
    // P2034 (mesuré, ADM-TRJ-4 bis) : la base rejette l'une des deux transactions simultanées ; au réessai, la garde
    // conditionnelle répond proprement 400.
    await withWriteConflictRetry(() => prisma.$transaction(async (tx) => {
      const r = await tx.trip.updateMany({ where: { id: t.id, ...notHiddenFilter() } as never, data: { hideProposedReason: parsed.data.reason, hideProposedByAdminId: req.user.id, hideProposedAt: now } });
      if (r.count !== 1) throw new ValidationError("This trip is already hidden.", { code: "TRIP_ALREADY_HIDDEN" });
      // Amélioration § 5.7 — une proposition qui en REMPLACE une autre garde la trace de la précédente au journal.
      const before = previous?.hideProposedAt ? { reason: previous.hideProposedReason, byAdminId: previous.hideProposedByAdminId, at: previous.hideProposedAt.toISOString() } : undefined;
      await recordAdminAction(tx, { adminUserId: req.user.id, action: "TRIP_HIDE_PROPOSED", targetType: "TRIP", targetId: t.id, ...(before ? { before } : {}), after: { reason: parsed.data.reason }, ...meta(req) });
    }));
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
    if (t.hiddenByAdminAt) throw new ValidationError("This trip is already hidden.", { code: "TRIP_ALREADY_HIDDEN" });
    const now = new Date();
    // P2034 (mesuré, ADM-TRJ-4 bis) : la base rejette l'une des deux transactions simultanées ; au réessai, la garde
    // conditionnelle répond proprement 400.
    await withWriteConflictRetry(() => prisma.$transaction(async (tx) => {
      // Amélioration § 5.7 — écriture CONDITIONNELLE : deux « Masquer » simultanés passaient tous deux la lecture
      // ci-dessus (deux lignes TRIP_HIDDEN, deux emails au Voyageur). Le second reçoit maintenant le même 400.
      const r = await tx.trip.updateMany({
        where: { id: t.id, ...notHiddenFilter() } as never,
        data: { hiddenByAdminAt: now, hiddenReason: parsed.data.reason, hiddenByAdminId: req.user.id, hideProposedReason: null, hideProposedByAdminId: null, hideProposedAt: null },
      });
      if (r.count !== 1) throw new ValidationError("This trip is already hidden.", { code: "TRIP_ALREADY_HIDDEN" });
      await recordAdminAction(tx, { adminUserId: req.user.id, action: "TRIP_HIDDEN", targetType: "TRIP", targetId: t.id, after: { reason: parsed.data.reason }, ...meta(req) });
    }));
    await emailCarrier(t.userId, (locale, u) => getTripAdminEmails(locale).tripHidden({ firstName: u.firstName, route: route(t), tripUrl: `${USER_APP_URL}/${locale}/trips/${t.id}`, supportEmail: SUPPORT_EMAIL }));
    res.status(200).json({ ok: true, hiddenAt: now.toISOString() });
  } catch (e) {
    next(e);
  }
};

export const unhideTrip = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const t = await loadTripForAdmin(req);
    if (!t.hiddenByAdminAt) throw new ValidationError("This trip is not hidden.", { code: "TRIP_NOT_HIDDEN" });
    const parsed = HideTripRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError("Invalid request", { errors: zodErrors(parsed.error.issues) });
    // P2034 (mesuré, ADM-TRJ-4 bis) : la base rejette l'une des deux transactions simultanées ; au réessai, la garde
    // conditionnelle répond proprement 400.
    await withWriteConflictRetry(() => prisma.$transaction(async (tx) => {
      const r = await tx.trip.updateMany({ where: { id: t.id, hiddenByAdminAt: { not: null } } as never, data: { hiddenByAdminAt: null, hiddenReason: null, hiddenByAdminId: null } });
      if (r.count !== 1) throw new ValidationError("This trip is not hidden.", { code: "TRIP_NOT_HIDDEN" }); // même garde que le masquage
      await recordAdminAction(tx, { adminUserId: req.user.id, action: "TRIP_UNHIDDEN", targetType: "TRIP", targetId: t.id, after: { reason: parsed.data.reason }, ...meta(req) });
    }));
    await emailCarrier(t.userId, (locale, u) => getTripAdminEmails(locale).tripUnhidden({ firstName: u.firstName, route: route(t), tripUrl: `${USER_APP_URL}/${locale}/trips/${t.id}`, supportEmail: SUPPORT_EMAIL }));
    res.status(200).json({ ok: true });
  } catch (e) {
    next(e);
  }
};

/* ── Billets ────────────────────────────────────────────────── */
export const listTickets = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    // C-PR7a (D60 2A) — filtres : villes, période de dépôt, « plus vieux que N jours »
    const parsedQ = TicketQueueQuerySchema.safeParse(req.query);
    if (!parsedQ.success) throw new ValidationError("Invalid query.", { code: "INVALID_QUERY" });
    // 8A — les billets des trajets partis (ou supprimés) sortent de la file (EXPIRED), en un seul updateMany. Recette § 5.8
    // (ANO-ADM-20) : ils sont cherchés À PART, et la file ne lit que des billets décidables — avant, les 200 premiers
    // billets en attente pouvaient être tous « partis » et masquer un billet à venir.
    const expired = await prisma.tripDocument.findMany({ where: departedTicketsWhere(now) as never, select: { id: true } });
    if (expired.length) await prisma.tripDocument.updateMany({ where: { id: { in: expired.map((d) => d.id) }, status: "PENDING" }, data: { status: "EXPIRED", expiredAt: now } });
    const pending = await prisma.tripDocument.findMany({
      where: buildTicketsWhere(parsedQ.data, now) as never,
      orderBy: { createdAt: "asc" },
      take: 200,
      include: { trip: { select: { id: true, originCity: true, destinationCity: true, departureAt: true, transportMode: true, user: { select: { id: true, firstName: true, lastName: true } } } } },
    });
    const items: TicketQueueItem[] = pending.map((d) => ({
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
    res.status(200).json({ items, expiredNow: expired.length });
  } catch (e) {
    next(e);
  }
};

/** C-PR7a (D60 2A) — export CSV de la file des billets : identifiants seulement, journalisé. */
export const exportTickets = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const parsedQ = TicketQueueQuerySchema.safeParse(req.query);
    if (!parsedQ.success) throw new ValidationError("Invalid query.", { code: "INVALID_QUERY" });
    const found = await prisma.tripDocument.findMany({
      where: buildTicketsWhere(parsedQ.data, now) as never,
      orderBy: { createdAt: "asc" },
      take: EXPORT_MAX_ROWS + 1,
      include: { trip: { select: { id: true, originCity: true, destinationCity: true, departureAt: true, userId: true } } },
    });
    const { rows, truncated } = capExportRows(found);
    await recordAdminAction(prisma, { adminUserId: req.user.id, action: "EXPORTED", targetType: "TRIP", after: { domain: "tickets", personal: false, filters: parsedQ.data, rows: rows.length, truncated }, ...meta(req) });
    res.set(csvResponseHeaders(csvFilename("billets", now), rows.length, truncated));
    // ANO-ADM-12 (A156) — le nom de fichier est un TEXTE LIBRE du membre (mesuré : « sfr-facture-0752426937-0.pdf ») :
    // il ne sort jamais d'un export opérationnel. Le type du fichier se lit dans `mimeType` / `fileExtension`.
    res.status(200).send(CSV_BOM + buildCsv(TICKETS_CSV_COLUMNS, rows.map((d) => ({ documentId: d.id, tripId: d.trip.id, originCity: d.trip.originCity, destinationCity: d.trip.destinationCity, departureAt: d.trip.departureAt, carrierId: d.trip.userId, fileExtension: fileExtensionOf(d.originalName), mimeType: d.mimeType, status: String(d.status), submittedAt: d.createdAt }))));
  } catch (e) {
    next(e);
  }
};

export const viewTicket = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const documentId = parseId(req.params.documentId, "document id");
    const d = await prisma.tripDocument.findUnique({ where: { id: documentId }, select: { id: true, url: true, mimeType: true, originalName: true, status: true, tripId: true } });
    if (!d) throw new NotFoundError("Document not found.", { code: "DOCUMENT_NOT_FOUND" });
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
    const d = await prisma.tripDocument.findUnique({ where: { id: documentId }, include: { trip: { select: { id: true, userId: true, originCity: true, destinationCity: true, status: true, isDeleted: true, departureAt: true } } } });
    if (!d || d.type !== "TICKET_PROOF") throw new NotFoundError("Ticket not found.", { code: "TICKET_NOT_FOUND" });
    // Recette § 5.8 — le conflit d'intérêts d'abord : son propre billet est refusé en 403, qu'il soit traité ou non
    // (avant, un billet déjà traité répondait 400 à son propriétaire, un refus qui en masquait un autre — cf. ANO-ADM-02).
    if (d.trip.userId === req.user.id) throw new ForbiddenError("You cannot review your own ticket.", { code: "ADMIN_IS_OWNER" });
    if (d.status !== "PENDING") throw new ValidationError("This ticket was already reviewed.", { code: "TICKET_ALREADY_REVIEWED" });
    // Recette § 5.8 — un billet ne se décide que sur un trajet à venir et vivant (la file n'en montre pas d'autre).
    const now = new Date();
    const closed = ticketNotReviewableReason({ status: String(d.trip.status), isDeleted: d.trip.isDeleted, departureAt: d.trip.departureAt }, now);
    if (closed === "TICKET_TRIP_DEPARTED") throw new ValidationError("This trip has already left: its ticket has nothing left to prove.", { code: closed });
    if (closed) throw new ValidationError("This trip is no longer open: its ticket cannot be reviewed.", { code: closed });
    const outcome = ticketReviewOutcome(parsed.data.decision, parsed.data.reason ?? null);
    // Deux administrateurs sur le même billet (fiche ADM-BIL-8) : écriture conditionnelle + rejeu sur conflit (P2034).
    const tripTicketStatus = await withWriteConflictRetry(() => prisma.$transaction(async (tx) => {
      const updated = await tx.tripDocument.updateMany({
        where: { id: d.id, status: "PENDING" },
        data: outcome.documentStatus === "VERIFIED"
          ? { status: "VERIFIED", verifiedAt: now, reviewedByAdminId: req.user.id, rejectionReason: null }
          : { status: "REJECTED", rejectedAt: now, reviewedByAdminId: req.user.id, rejectionReason: outcome.rejectionReason },
      });
      if (updated.count === 0) throw new ValidationError("This ticket was already reviewed.", { code: "TICKET_ALREADY_REVIEWED" });
      // ANO-ADM-19 — le trajet porte la SYNTHÈSE de ses billets : un second billet rejeté n'efface pas un billet vérifié.
      const billets = await tx.tripDocument.findMany({ where: { tripId: d.trip.id, type: "TICKET_PROOF" }, select: { type: true, status: true } });
      const synthese = tripTicketStatusFromDocuments(billets.map((b) => ({ type: String(b.type), status: String(b.status) })));
      await tx.trip.update({ where: { id: d.trip.id }, data: { ticketVerificationStatus: synthese } });
      await recordAdminAction(tx, {
        adminUserId: req.user.id,
        action: outcome.documentStatus === "VERIFIED" ? "TICKET_VERIFIED" : "TICKET_REJECTED",
        targetType: "TRIP",
        targetId: d.trip.id,
        after: { documentId: d.id, reason: outcome.rejectionReason },
        ...meta(req),
      });
      return synthese;
    }));
    await emailCarrier(d.trip.userId, (locale, u) => {
      const base = { firstName: u.firstName, route: route(d.trip), tripUrl: `${USER_APP_URL}/${locale}/trips/${d.trip.id}`, supportEmail: SUPPORT_EMAIL };
      const dict = getTripAdminEmails(locale);
      return outcome.documentStatus === "VERIFIED"
        ? dict.ticketVerified(base)
        : dict.ticketRejected({ ...base, reasonLabel: TICKET_REJECTION_LABELS[locale === "en" ? "en" : "fr"][outcome.rejectionReason!] });
    });
    res.status(200).json({ ok: true, status: outcome.documentStatus, tripTicketStatus });
  } catch (e) {
    next(e);
  }
};
