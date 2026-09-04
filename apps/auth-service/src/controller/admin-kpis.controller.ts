/**
 * admin-kpis.controller.ts — compteurs opérationnels de l'accueil (C-PR4, D57)
 * ===========================================================================
 * GET /admin/kpis (kpi.read). Chaque compteur n'est servi que si le profil a la
 * permission correspondante (null sinon) ; SUPER_ADMIN voit tout. Lectures
 * croisées (base partagée), aucune écriture. Le pilotage complet (courbes,
 * corridors, finances) est C-PR5 / C-PR6.
 */
import type { NextFunction, Response } from "express";
import prisma from "@packages/libs/prisma";
import type { AuthenticatedRequest } from "@packages/middleware/isAuthenticated";
import { adminRoleAllows, type AdminHomeKpis, type AdminRole } from "@packages/api-contracts";

const ACTIVE_DEAL = ["ACCEPTED", "PICKED_UP", "DELIVERED", "DISPUTED"];

export const getAdminKpis = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const role = (req.adminRole ?? null) as AdminRole | null;
    const can = (p: Parameters<typeof adminRoleAllows>[1]) => adminRoleAllows(role, p);
    const now = new Date();
    const since30 = new Date(now.getTime() - 30 * 86_400_000);
    const opt = async <T,>(allowed: boolean, q: () => Promise<T>): Promise<T | null> => (allowed ? q() : null);

    const [disputesToDecide, retentionsHeld, ticketsToVerify, hiddenTrips, hideProposals, suspensionProposals, restrictedUsers, suspendedUsers, publishedTrips, activeDeals, payoutsFailed, pendingAdminInvites, usersTotal, completedDeals30d, payoutsReversed] =
      await Promise.all([
        opt(can("disputes.read"), () => prisma.dispute.count({ where: { status: { in: ["OPEN", "CARRIER_RESPONDED"] } } })),
        opt(can("disputes.read"), () => prisma.booking.count({ where: { status: "CANCELLED", retentionDisposition: "HELD_FOR_MEDIATION", isDeleted: false } })),
        opt(can("tickets.review"), () => prisma.tripDocument.count({ where: { type: "TICKET_PROOF", status: "PENDING", trip: { is: { departureAt: { gte: now }, isDeleted: false } } } })),
        opt(can("trips.read"), () => prisma.trip.count({ where: { hiddenByAdminAt: { not: null }, isDeleted: false } })),
        opt(can("trips.read"), () => prisma.trip.count({ where: { hideProposedAt: { not: null }, OR: [{ hiddenByAdminAt: null }, { hiddenByAdminAt: { isSet: false } }], isDeleted: false } })),
        opt(can("users.read"), () => prisma.user.count({ where: { suspensionProposedAt: { not: null }, accountStatus: "ACTIVE", isDeleted: false } })),
        opt(can("users.read"), () => prisma.user.count({ where: { accountStatus: "RESTRICTED", isDeleted: false } })),
        opt(can("users.read"), () => prisma.user.count({ where: { accountStatus: "SUSPENDED", isDeleted: false } })),
        opt(can("trips.read"), () => prisma.trip.count({ where: { status: "PUBLISHED", isDeleted: false, departureAt: { gte: now } } })),
        opt(can("disputes.read"), () => prisma.booking.count({ where: { status: { in: ACTIVE_DEAL as never }, isDeleted: false } })),
        // C-PR5 (D58) — les files d'argent sont celles du profil FINANCE (finances.read)
        opt(can("finances.read"), () => prisma.booking.count({ where: { payoutStatus: "FAILED", isDeleted: false } })),
        opt(can("admins.manage"), () => prisma.user.count({ where: { adminRole: { not: null }, OR: [{ passwordHash: null }, { passwordHash: { isSet: false } }], isDeleted: false } })),
        opt(can("users.read"), () => prisma.user.count({ where: { isDeleted: false } })),
        opt(can("disputes.read"), () => prisma.booking.count({ where: { status: "COMPLETED", completedAt: { gte: since30 }, isDeleted: false } })),
        opt(can("finances.read"), () => prisma.booking.count({ where: { payoutStatus: "REVERSED", OR: [{ payoutReversalResolution: null }, { payoutReversalResolution: { isSet: false } }], isDeleted: false } })),
      ]);
    const kpis: AdminHomeKpis = { disputesToDecide, retentionsHeld, ticketsToVerify, hiddenTrips, hideProposals, suspensionProposals, restrictedUsers, suspendedUsers, publishedTrips, activeDeals, payoutsFailed, payoutsReversed, pendingAdminInvites, usersTotal, completedDeals30d, generatedAt: now.toISOString() };
    res.status(200).json(kpis);
  } catch (e) {
    next(e);
  }
};
