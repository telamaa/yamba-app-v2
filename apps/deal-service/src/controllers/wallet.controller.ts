/**
 * wallet.controller.ts — GET /me/wallet (A83)
 * ===========================================
 * Charge les deals de l'utilisateur dans SES deux rôles, les prénoms des
 * contreparties (jointure explicite — Booking n'a pas de relation Prisma),
 * puis délègue le calcul à wallet.service (pur, testé).
 */

import type { NextFunction, Response } from "express";
import prisma from "@packages/libs/prisma";
import type { AuthenticatedRequest } from "@packages/middleware/isAuthenticated";
import type { WalletResponse } from "@packages/api-contracts";
import { buildCarrierWallet, buildShipperWallet, type WalletBookingRecord, type WalletCounterparts } from "../services/wallet.service";

const WALLET_SELECT = {
  id: true,
  tripId: true,
  shipperId: true,
  carrierId: true,
  status: true,
  trip: true,
  pricing: true,
  requestedAt: true,
  updatedAt: true,
  capturedAt: true,
  payoutDueAt: true,
  completedAt: true,
  refundedAt: true,
  refundAmountCents: true,
  retentionCents: true,
  retentionDisposition: true,
  payoutStatus: true,
  payoutSentAt: true,
  payoutAmountCents: true,
  payoutFailureReason: true,
} as const;

export async function getMyWallet(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user.id;
    const now = new Date();
    const [asCarrier, asShipper] = await Promise.all([
      prisma.booking.findMany({ where: { carrierId: userId, isDeleted: false }, select: WALLET_SELECT, orderBy: { requestedAt: "desc" } }),
      prisma.booking.findMany({ where: { shipperId: userId, isDeleted: false }, select: WALLET_SELECT, orderBy: { requestedAt: "desc" } }),
    ]);
    const ids = [...new Set([...asCarrier.map((b) => b.shipperId), ...asShipper.map((b) => b.carrierId)])];
    const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true } }) : [];
    const counterparts: WalletCounterparts = new Map(users.map((u) => [u.id, { firstName: u.firstName ?? null }]));

    const body: WalletResponse = {
      success: true,
      carrier: buildCarrierWallet(asCarrier as unknown as WalletBookingRecord[], counterparts, now),
      shipper: buildShipperWallet(asShipper as unknown as WalletBookingRecord[], counterparts),
      generatedAt: now.toISOString(),
    };
    return res.status(200).json(body);
  } catch (error) {
    return next(error);
  }
}
