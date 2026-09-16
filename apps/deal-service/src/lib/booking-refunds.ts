/**
 * booking-refunds.ts — la liste des remboursements d'un deal (recette 02-ADMIN § 5.16, ANO-ADM-37, A166)
 * ====================================================================================================
 * Avant : un deal ne gardait que le cumul (`refundAmountCents`) et le DERNIER remboursement (`refundedAt`, `refundId`).
 * Un remboursement d'annulation en mars suivi d'un geste manuel en avril disparaissait du rapport de mars : un mois clos
 * changeait après coup, et le premier identifiant fournisseur était perdu.
 *
 * Écrire : chaque chemin qui émet un remboursement chez le fournisseur ajoute UNE entrée, dans la même transaction que
 * le cumul. La liste est lue puis réécrite en entier (`withRefund`) : un `push` Prisma sur une liste ABSENTE d'un vieux
 * document ne se comporte pas comme sur `[]` (piège des listes composites, voir CLAUDE.md), et la garde conditionnelle
 * de chaque transition empêche deux écritures concurrentes.
 *
 * Lire : `refundEntries` rend la liste, complétée d'une entrée `LEGACY` pour la part du cumul qu'elle n'explique pas sur
 * un deal CAPTURÉ (documents antérieurs à A166). Une annulation avant capture pose un cumul sans argent débité : elle
 * n'est pas un remboursement et n'apparaît jamais.
 */
export type RefundKind = "CANCELLATION" | "PICKUP_REFUSED" | "DISPUTE" | "RETENTION_RESTITUTION" | "MANUAL";
export type BookingRefundEntry = { refundId: string | null; amountCents: number; refundedAt: Date; kind: RefundKind | "LEGACY" };

type StoredRefund = { refundId?: string | null; amountCents: number; refundedAt: Date; kind: string };

export type RefundHistorySource = {
  refunds?: StoredRefund[] | null;
  capturedAt?: Date | null;
  refundAmountCents?: number | null;
  refundedAt?: Date | null;
  refundId?: string | null;
};

/**
 * La liste à écrire : les remboursements connus AVANT ce geste, suivis du nouveau. Lue sur le deal tel qu'il est avant
 * l'écriture — c'est le dernier moment où `refundedAt` et `refundId` décrivent encore l'ancien remboursement : sur un
 * document antérieur à A166, la part ancienne du cumul est matérialisée en entrée `LEGACY` À SA DATE, au lieu d'être
 * datée demain du remboursement qui l'écrase.
 */
export function withRefund(before: RefundHistorySource, entry: { refundId: string | null; amountCents: number; refundedAt: Date; kind: RefundKind }): StoredRefund[] {
  return [...refundEntries(before).map((r) => ({ refundId: r.refundId, amountCents: r.amountCents, refundedAt: r.refundedAt, kind: r.kind })), entry];
}

/** Chaque remboursement réel du deal, dans l'ordre chronologique. */
export function refundEntries(b: RefundHistorySource): BookingRefundEntry[] {
  if (!b.capturedAt) return [];
  const listed: BookingRefundEntry[] = (b.refunds ?? []).map((r) => ({ refundId: r.refundId ?? null, amountCents: r.amountCents, refundedAt: r.refundedAt, kind: r.kind as RefundKind }));
  const explained = listed.reduce((s, r) => s + r.amountCents, 0);
  const unexplained = (b.refundAmountCents ?? 0) - explained;
  if (unexplained > 0) {
    // Document antérieur à A166 : la seule date connue est celle du dernier remboursement (à défaut, la capture — un
    // montant n'est jamais perdu faute de date) ; l'identifiant n'est sûr que si la liste est vide.
    listed.push({ refundId: listed.length === 0 ? (b.refundId ?? null) : null, amountCents: unexplained, refundedAt: b.refundedAt ?? b.capturedAt, kind: "LEGACY" });
  }
  return listed.sort((x, y) => x.refundedAt.getTime() - y.refundedAt.getTime());
}

/**
 * Invariant Σ liste = cumul (recette § 5.16). La liste peut EXPLIQUER MOINS que le cumul (document antérieur à A166 : la
 * part manquante se lit en LEGACY) ; elle ne doit jamais en enregistrer PLUS. Rend l'excédent en centimes (0 = cohérent) :
 * une liste qui dépasse le cumul, ou des entrées sur un deal jamais capturé, disent qu'une écriture a manqué quelque part
 * (cumul remis à zéro à la main, remboursement écrit hors des cinq chemins) — à rapprocher avant tout geste.
 */
export function refundListExcessCents(b: RefundHistorySource): number {
  const listed = (b.refunds ?? []).reduce((s, r) => s + r.amountCents, 0);
  if (!b.capturedAt) return listed;
  return Math.max(0, listed - (b.refundAmountCents ?? 0));
}

/** Somme des remboursements réels (0 sur un deal jamais capturé, quel que soit le cumul posé à l'annulation). */
export function refundedTotalCents(b: RefundHistorySource): number {
  return refundEntries(b).reduce((s, r) => s + r.amountCents, 0);
}
