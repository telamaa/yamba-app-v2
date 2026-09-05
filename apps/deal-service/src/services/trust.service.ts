/**
 * trust.service.ts — plafonds progressifs à la réservation (D71 2A, CNF-06)
 * =========================================================================
 * Avant tout devis payé : les signaux de l'Expéditeur (lib `@packages/libs/trust`, Prisma injecté),
 * le score, puis `checkCaps`. Un compte neuf ou à risque qui dépasse un plafond reçoit 409
 * NEW_ACCOUNT_CAP avec le plafond et la valeur : le front l'explique, rien n'est sanctionné.
 */
import prisma from "@packages/libs/prisma";
import { platformSettings } from "@packages/libs/settings/default";
import type { SettingsReader } from "@packages/libs/settings";
import { checkCaps, computeTrustScore, loadTrustSignals, trustParamsFromSettings, type CapViolation, type TrustDb } from "@packages/libs/trust";
import { BookingRequestError } from "./booking-request";

export function makeTrustService(deps: { db?: TrustDb; settings?: SettingsReader; clock?: () => Date } = {}) {
  const db = deps.db ?? (prisma as unknown as TrustDb);
  const settings = deps.settings ?? platformSettings();
  const clock = deps.clock ?? (() => new Date());
  return {
    /** Le dépassement de plafond de cette demande, ou null. Membre inconnu : aucun plafond (le 404 vient d'ailleurs). */
    async capViolation(userId: string, request: { declaredValueCents: number; weightKg: number | null }): Promise<CapViolation | null> {
      const now = clock();
      const signals = await loadTrustSignals(db, userId, now);
      if (!signals) return null;
      const assessment = computeTrustScore(signals, trustParamsFromSettings((await settings.get()) as unknown as Record<string, number>));
      return checkCaps(assessment, { ...request, bookingsThisMonth: signals.bookingsThisMonth });
    },
    /** 409 NEW_ACCOUNT_CAP si un plafond est dépassé. */
    async assertWithinCaps(userId: string, request: { declaredValueCents: number; weightKg: number | null }): Promise<void> {
      const v = await this.capViolation(userId, request);
      if (v) throw new BookingRequestError("NEW_ACCOUNT_CAP", "This request exceeds the limits of a new or at-risk account.", { cap: v.cap, limit: v.limit, value: v.value });
    },
  };
}
export type TrustService = ReturnType<typeof makeTrustService>;
