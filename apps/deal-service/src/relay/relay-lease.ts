import os from "os";
import { randomUUID } from "crypto";
import prisma from "@packages/libs/prisma";

/**
 * relay-lease.ts — bail d'exclusivité du relay (A24, PR4)
 * =======================================================
 * L'ordre par aggregateId exige UN SEUL publieur actif. Ce bail à
 * expiration le garantit même à N instances du deal-service :
 * - acquisition/renouvellement par updateMany CONDITIONNEL — un
 *   compare-and-set atomique côté Mongo, pas de fenêtre de course ;
 * - heartbeat : le détenteur renouvelle à chaque tick (1 s), le TTL
 *   (30 s) laisse 30 marges d'erreur avant qu'une autre instance ne
 *   reprenne un bail d'un process mort ;
 * - libération douce à l'arrêt : expiresAt dans le passé = bail
 *   immédiatement reprenable. JAMAIS de delete (cohérence outbox).
 */

export const RELAY_LEASE_ID = "outbox-relay";
export const RELAY_LEASE_TTL_MS = 30_000;

/** Identité d'instance — lisible dans les logs ET unique par process. */
export function buildLeaseOwner(): string {
  return `${os.hostname()}#${process.pid}#${randomUUID().slice(0, 8)}`;
}

/**
 * Tente d'acquérir (ou de renouveler) le bail. true = cette instance
 * est LE publieur pour les RELAY_LEASE_TTL_MS à venir.
 */
export async function tryAcquireLease(owner: string, now = new Date()): Promise<boolean> {
  const expiresAt = new Date(now.getTime() + RELAY_LEASE_TTL_MS);

  // Cas 1 — le doc existe : on le prend si on le détient DÉJÀ (renouvellement)
  // ou s'il est EXPIRÉ (reprise). Conditionnel = atomique.
  const taken = await prisma.relayLease.updateMany({
    where: { id: RELAY_LEASE_ID, OR: [{ owner }, { expiresAt: { lt: now } }] },
    data: { owner, expiresAt },
  });
  if (taken.count === 1) return true;

  // Cas 2 — le doc n'existe pas encore (premier boot) : création. Si
  // deux instances courent, l'unicité de _id n'en laisse passer qu'une ;
  // la perdante reçoit un duplicat — un bail perdu, pas une panne.
  try {
    await prisma.relayLease.create({ data: { id: RELAY_LEASE_ID, owner, expiresAt } });
    return true;
  } catch {
    return false;
  }
}

/** Libère le bail SI on le détient encore (arrêt propre du service). */
export async function releaseLease(owner: string): Promise<void> {
  await prisma.relayLease.updateMany({
    where: { id: RELAY_LEASE_ID, owner },
    data: { expiresAt: new Date(0) },
  });
}
