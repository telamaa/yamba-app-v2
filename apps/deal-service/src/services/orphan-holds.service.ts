/**
 * orphan-holds.service.ts — libérer l'argent qu'on retient pour rien (D82 9A)
 * ===========================================================================
 * Une passe : on demande au fournisseur les empreintes POSÉES et plus vieilles que le délai
 * de grâce, on regarde lesquelles aucune réservation ne porte, et on annule celles-là.
 *
 * Trois choix de conception, et leurs raisons :
 *
 *   • **Le fournisseur est la source**, pas notre base — parce que la création d'une
 *     intention n'écrit rien chez nous (D37) : une empreinte posée sans réservation n'existe
 *     QUE chez lui. C'est aussi la doctrine D40 : entre notre base et lui, c'est lui qui a
 *     l'argent.
 *   • **La lecture est bornée** (`BATCH`) et le tri est pur (`orphan-holds.rules`) : une
 *     passe ne peut ni s'emballer ni décider seule.
 *   • **Un échec d'annulation ne fait pas échouer la passe** : la suivante réessaiera. Une
 *     empreinte qu'on n'arrive pas à libérer à 3 h du matin n'a pas à réveiller un cron
 *     entier — elle a juste à être retentée.
 *
 * Le fournisseur qui n'offre pas la lecture (`listAuthorizedHolds` est optionnel, comme
 * `findTransfers`) rend une passe vide : la chasse se tait, elle ne jette pas.
 */
import prisma from "@packages/libs/prisma";
import type { PaymentProvider } from "@packages/payments";
import { ORPHAN_HOLD_GRACE_MINUTES, selectOrphanHolds } from "../lib/orphan-holds.rules";

/** Fenêtre d'une passe — le plafond de l'API du fournisseur est de 100. */
const BATCH = 100;

const MINUTE = 60_000;

export type OrphanHoldsPass = {
  /** empreintes lues chez le fournisseur */
  examined: number;
  /** empreintes réellement annulées */
  canceled: number;
  /** empreintes épargnées (pas à nous, ou une réservation les porte) */
  kept: number;
  /** annulations tentées et refusées — la passe suivante réessaiera */
  failed: number;
};

export function makeOrphanHoldsService(
  provider: PaymentProvider,
  clock: () => Date = () => new Date(),
  graceMinutes: number = ORPHAN_HOLD_GRACE_MINUTES
) {
  return {
    async runOnce(now: Date = clock()): Promise<OrphanHoldsPass> {
      const vide: OrphanHoldsPass = { examined: 0, canceled: 0, kept: 0, failed: 0 };
      if (!provider.listAuthorizedHolds) return vide;

      const createdBefore = new Date(now.getTime() - graceMinutes * MINUTE);
      const holds = await provider.listAuthorizedHolds({ createdBefore, limit: BATCH });
      if (!holds.length) return vide;

      // Une seule lecture en base pour toute la fenêtre. `paymentIntentId` est le lien :
      // une réservation de n'importe quel statut compte comme « connue » (son sort est
      // l'affaire de la machine à états, jamais de ce ménage).
      const portees = await prisma.booking.findMany({
        where: { paymentIntentId: { in: holds.map((h) => h.intentId) } },
        select: { paymentIntentId: true },
      });
      const knownIntentIds = new Set(portees.map((b) => b.paymentIntentId).filter((id): id is string => !!id));

      const orphelines = selectOrphanHolds(holds, { now, knownIntentIds, graceMinutes });

      let canceled = 0;
      let failed = 0;
      for (const o of orphelines) {
        try {
          // `abandoned` est le motif exact : le membre est parti payer et n'est pas revenu.
          // L'annulation déclenche `payment_intent.canceled` ; le webhook cherche une
          // réservation à annuler, n'en trouve aucune, et ne fait rien — c'est voulu.
          await provider.cancel(o.intentId, "abandoned");
          canceled += 1;
        } catch {
          failed += 1;
        }
      }
      return { examined: holds.length, canceled, kept: holds.length - orphelines.length, failed };
    },
  };
}

export type OrphanHoldsService = ReturnType<typeof makeOrphanHoldsService>;
