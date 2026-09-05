/**
 * admin-users.service.ts — utilisateurs vus par l'opérateur (C-PR3, D56)
 * ======================================================================
 * Lectures croisées assumées (base partagée) : trips, bookings, disputes,
 * journal, sessions Redis. Jamais un secret (hash, secret TOTP, code de
 * livraison, identifiants Stripe complets).
 */
import prisma from "@packages/libs/prisma";
import { adminRolesOf, type AdminUsersQuery } from "@packages/api-contracts";
import { OID, TICKET, USERS_CSV_COLUMNS, buildUsersOrderBy, buildUsersWhere } from "../lib/admin-users.query";
import redis from "@packages/libs/redis";
import { NotFoundError } from "@packages/error-handler";
import type { AdminUserFile, AdminUserSummary, AdminUsersResponse } from "@packages/api-contracts";

const ACTIVE_DEAL = ["ACCEPTED", "PICKED_UP", "DELIVERED", "DISPUTED"];

function maskStripe(id: string | null | undefined): string | null {
  if (!id) return null;
  return `${id.slice(0, 5)}…${id.slice(-4)}`;
}

async function countActiveUserSessions(userId: string): Promise<number> {
  let cursor = "0";
  let n = 0;
  do {
    const [next, keys] = await redis.scan(cursor, "MATCH", `refresh_jti:${userId}:*`, "COUNT", 100);
    cursor = next;
    n += keys.length;
  } while (cursor !== "0");
  return n;
}

const summarySelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phoneE164: true,
  roles: true,
  adminRole: true,
  adminRoles: true,
  accountStatus: true,
  carrierStatus: true,
  createdAt: true,
} as const;

type SummaryRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneE164: string | null;
  roles: string[];
  adminRole: string | null;
  adminRoles?: string[] | null;
  accountStatus: string;
  carrierStatus: string;
  createdAt: Date;
};

function toSummary(u: SummaryRow, matchedOn: string | null): AdminUserSummary {
  return {
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    phoneE164: u.phoneE164,
    roles: u.roles,
    adminRole: (u.adminRole as AdminUserSummary["adminRole"]) ?? null,
    adminRoles: adminRolesOf(u),
    accountStatus: u.accountStatus as AdminUserSummary["accountStatus"],
    carrierStatus: u.carrierStatus,
    createdAt: u.createdAt.toISOString(),
    matchedOn,
  };
}

export function makeAdminUsersService() {
  return {
    /* ── C-PR7a (D60 2A) — recherche poussée : filtres serveur, tri, curseur ── */
    async searchAdvanced(q: AdminUsersQuery): Promise<AdminUsersResponse> {
      const term = (q.q ?? "").trim();
      // Identifiant de deal ou ticket : les deux parties (comme la recherche simple), filtres ignorés
      if (OID.test(term) || TICKET.test(term)) return this.search(term, q.limit);
      const where = buildUsersWhere(q);
      const [rows, total] = await Promise.all([
        prisma.user.findMany({ where: where as never, orderBy: buildUsersOrderBy(q) as never, take: q.limit + 1, ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}), select: summarySelect }),
        prisma.user.count({ where: where as never }),
      ]);
      const hasNext = rows.length > q.limit;
      const page = hasNext ? rows.slice(0, q.limit) : rows;
      const lower = term.toLowerCase();
      return {
        items: page.map((r) => toSummary(r as SummaryRow, term ? (r.email.toLowerCase().includes(lower) ? "email" : "name") : null)),
        total,
        nextCursor: hasNext ? page[page.length - 1].id : null,
      };
    },

    /** Export CSV des utilisateurs (données personnelles) — SUPER_ADMIN seul, motif ≥ 20, journalisé par le contrôleur. Borné à 5 000 lignes. */
    async exportRows(q: AdminUsersQuery): Promise<Array<Record<(typeof USERS_CSV_COLUMNS)[number], unknown>>> {
      const rows = await prisma.user.findMany({
        where: buildUsersWhere(q) as never,
        orderBy: buildUsersOrderBy(q) as never,
        take: 5000,
        select: { ...summarySelect, suspendedAt: true, suspensionUntil: true, carrierPage: { select: { stripePayoutsEnabled: true } } },
      });
      return rows.map((u) => ({
        id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email, phoneE164: u.phoneE164, roles: u.roles,
        adminRoles: adminRolesOf(u as { adminRole?: string | null; adminRoles?: string[] | null }), accountStatus: u.accountStatus, carrierStatus: u.carrierStatus,
        stripeReady: !!u.carrierPage?.stripePayoutsEnabled, suspendedAt: u.suspendedAt, suspensionUntil: u.suspensionUntil, createdAt: u.createdAt,
      }));
    },

    /** Recherche (5A) : email, prénom, nom, téléphone, identifiant de deal, ticket YAM. */
    async search(q: string, limit = 50): Promise<AdminUsersResponse> {
      const term = q.trim();
      if (!term) {
        const [rows, total] = await Promise.all([
          prisma.user.findMany({ where: { isDeleted: false }, orderBy: { createdAt: "desc" }, take: limit, select: summarySelect }),
          prisma.user.count({ where: { isDeleted: false } }),
        ]);
        return { items: rows.map((r) => toSummary(r as SummaryRow, null)), total };
      }
      // Deal ou ticket : les deux parties.
      if (OID.test(term) || TICKET.test(term)) {
        const booking = await prisma.booking.findFirst({
          where: OID.test(term) ? { id: term } : { disputeTicket: term.toUpperCase() },
          select: { shipperId: true, carrierId: true },
        });
        if (!booking) return { items: [], total: 0 };
        const rows = await prisma.user.findMany({ where: { id: { in: [booking.shipperId, booking.carrierId] } }, select: summarySelect });
        return { items: rows.map((r) => toSummary(r as SummaryRow, OID.test(term) ? "dealId" : "ticket")), total: rows.length };
      }
      const digits = term.replace(/[^\d+]/g, "");
      const rows = await prisma.user.findMany({
        where: {
          OR: [
            { emailNormalized: { contains: term.toLowerCase() } },
            { firstName: { contains: term, mode: "insensitive" } },
            { lastName: { contains: term, mode: "insensitive" } },
            ...(digits.length >= 6 ? [{ phoneE164: { contains: digits } }] : []),
          ],
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: summarySelect,
      });
      const lower = term.toLowerCase();
      return {
        items: rows.map((r) =>
          toSummary(r as SummaryRow, r.email.toLowerCase().includes(lower) ? "email" : digits.length >= 6 && (r.phoneE164 ?? "").includes(digits) ? "phone" : "name")
        ),
        total: rows.length,
      };
    },

    async getFile(adminId: string, userId: string): Promise<AdminUserFile> {
      const u = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          carrierPage: {
            select: {
              stripeAccountId: true,
              stripeChargesEnabled: true,
              stripePayoutsEnabled: true,
              reputationLevel: true,
              ratingsAvg: true,
              ratingsCount: true,
              completedDealsCount: true,
              lateCancellationsCount: true,
              disputesLostCount: true,
            },
          },
        },
      });
      if (!u) throw new NotFoundError("User not found.");

      const [trips, bookings, actions, adminNames, activeSessionsCount] = await Promise.all([
        prisma.trip.findMany({
          where: { userId },
          orderBy: { departureAt: "desc" },
          take: 50,
          select: { id: true, status: true, originCity: true, destinationCity: true, departureAt: true },
        }),
        prisma.booking.findMany({
          where: { OR: [{ shipperId: userId }, { carrierId: userId }], isDeleted: false },
          orderBy: { requestedAt: "desc" },
          take: 100,
          select: { id: true, status: true, shipperId: true, trip: true, pricing: true, disputeTicket: true, requestedAt: true },
        }),
        prisma.adminAction.findMany({ where: { targetType: "USER", targetId: userId }, orderBy: { createdAt: "desc" }, take: 50 }),
        prisma.user.findMany({
          where: { id: { in: [u.suspendedByAdminId, u.suspensionProposedByAdminId].filter((x): x is string => !!x) } },
          select: { id: true, firstName: true, lastName: true },
        }),
        countActiveUserSessions(userId),
      ]);
      const actorIds = [...new Set(actions.map((a) => a.adminUserId))];
      const actors = actorIds.length ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, firstName: true, lastName: true } }) : [];
      const nameOf = (id: string | null | undefined) => {
        const a = [...adminNames, ...actors].find((x) => x.id === id);
        return a ? `${a.firstName} ${a.lastName.charAt(0)}.` : (id ?? "—");
      };

      return {
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        phoneE164: u.phoneE164,
        preferredLocale: u.preferredLocale,
        emailSuppression: u.emailSuppressedAt ? { at: u.emailSuppressedAt.toISOString(), reason: u.emailSuppressedReason ?? "UNKNOWN" } : null, // D35 4A
        roles: u.roles,
        adminRole: (u.adminRole as AdminUserFile["adminRole"]) ?? null,
        adminRoles: adminRolesOf(u as { adminRole?: string | null; adminRoles?: string[] | null }),
        accountStatus: u.accountStatus as AdminUserFile["accountStatus"],
        suspension:
          u.accountStatus !== "ACTIVE" && u.suspendedAt
            ? {
                level: u.accountStatus as AdminUserFile["accountStatus"],
                reason: u.suspensionReason ?? "",
                until: u.suspensionUntil ? u.suspensionUntil.toISOString() : null,
                at: u.suspendedAt.toISOString(),
                byAdmin: nameOf(u.suspendedByAdminId),
              }
            : null,
        suspensionProposal:
          u.suspensionProposedLevel && u.suspensionProposedAt
            ? { level: u.suspensionProposedLevel, reason: u.suspensionProposedReason ?? "", byAdmin: nameOf(u.suspensionProposedByAdminId), at: u.suspensionProposedAt.toISOString() }
            : null,
        createdAt: u.createdAt.toISOString(),
        isDeleted: u.isDeleted,
        isMe: u.id === adminId,
        carrier: u.carrierPage
          ? {
              status: u.carrierStatus,
              stripeAccountId: maskStripe(u.carrierPage.stripeAccountId),
              stripeChargesEnabled: !!u.carrierPage.stripeChargesEnabled,
              stripePayoutsEnabled: !!u.carrierPage.stripePayoutsEnabled,
              reputationLevel: u.carrierPage.reputationLevel ?? null,
              ratingsAvg: u.carrierPage.ratingsAvg,
              ratingsCount: u.carrierPage.ratingsCount,
              completedDealsCount: u.carrierPage.completedDealsCount,
              lateCancellationsCount: u.carrierPage.lateCancellationsCount,
              disputesLostCount: u.carrierPage.disputesLostCount ?? 0,
            }
          : null,
        shipper: {
          reputationLevel: u.shipperReputationLevel ?? null,
          ratingsAvg: u.shipperRatingsAvg,
          ratingsCount: u.shipperRatingsCount,
          completedDealsCount: u.shipperCompletedDealsCount,
          lateCancellationsCount: u.shipperLateCancellationsCount,
          disputesLostCount: u.shipperDisputesLostCount ?? 0,
        },
        activity: {
          trips: trips.map((t) => ({
            id: t.id,
            status: String(t.status),
            originCity: t.originCity ?? "—",
            destinationCity: t.destinationCity ?? "—",
            departureAt: (t.departureAt ?? new Date(0)).toISOString(),
          })),
          deals: bookings.map((b) => ({
            id: b.id,
            status: b.status,
            role: b.shipperId === userId ? ("SHIPPER" as const) : ("CARRIER" as const),
            originCity: b.trip.originCity,
            destinationCity: b.trip.destinationCity,
            totalShipperCents: b.pricing.totalShipperCents,
            transportCents: b.pricing.transportCents,
            currencyCode: b.pricing.currencyCode,
            disputeTicket: b.disputeTicket ?? null,
            requestedAt: b.requestedAt.toISOString(),
          })),
          activeDealsCount: bookings.filter((b) => ACTIVE_DEAL.includes(b.status)).length,
          activeSessionsCount,
        },
        adminActions: actions.map((a) => ({ id: a.id, at: a.createdAt.toISOString(), admin: nameOf(a.adminUserId), action: a.action, after: a.after ?? null })),
      };
    },

    /** Deals en cours d'un compte (pour prévenir le support à la suspension). */
    async activeDeals(userId: string) {
      return prisma.booking.findMany({
        where: { OR: [{ shipperId: userId }, { carrierId: userId }], status: { in: ACTIVE_DEAL as never }, isDeleted: false },
        select: { id: true, status: true, trip: true, disputeTicket: true },
      });
    },
  };
}
export type AdminUsersService = ReturnType<typeof makeAdminUsersService>;
