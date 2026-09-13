/**
 * email-suppression.service.ts — lever une suppression d'adresse (D35 4A, A155)
 * ============================================================================
 * `DELETE /admin/users/:id/email-suppression` : le webhook du fournisseur a posé `emailSuppressedAt`
 * (rebond dur, plainte) ; un administrateur le lève quand l'adresse est corrigée ou que le membre le
 * demande. Recette 02-ADMIN § 5.5 :
 *  - **motif obligatoire** (≥ 20 caractères, A155), écrit au journal — comme la levée d'une sanction ;
 *  - **écriture conditionnelle** : deux administrateurs qui lèvent en même temps n'écrivent qu'UNE
 *    ligne `EMAIL_SUPPRESSION_LIFTED` (le second reçoit 400 `EMAIL_NOT_SUPPRESSED`) ;
 *  - la base est injectée : testable sans Mongo.
 */
import { UnsuppressEmailRequestSchema } from "@packages/api-contracts";
import { ValidationError } from "@packages/error-handler";
import { withWriteConflictRetry } from "@packages/libs/prisma/write-conflict-retry";

type Suppressed = { id: string; emailSuppressedAt: Date | null; emailSuppressedReason: string | null };

export type EmailSuppressionDb = {
  user: {
    updateMany(args: { where: { id: string; emailSuppressedAt: Date }; data: { emailSuppressedAt: null; emailSuppressedReason: null } }): Promise<{ count: number }>;
  };
  adminAction: { create(args: { data: Record<string, unknown> }): Promise<unknown> };
  $transaction<T>(fn: (tx: EmailSuppressionDb) => Promise<T>): Promise<T>;
};

export type LiftSuppressionResult = { ok: true; emailSuppression: null; liftedFrom: { at: string; reason: string | null } };

function zodErrors(issues: Array<{ path: PropertyKey[]; message: string }>) {
  const errors: Record<string, string> = {};
  for (const i of issues) errors[i.path.map(String).join(".") || "_"] = i.message;
  return errors;
}

export function makeEmailSuppressionService(deps: {
  db: EmailSuppressionDb;
  retry?: <T>(operation: () => Promise<T>) => Promise<T>;
  record: (tx: EmailSuppressionDb, entry: { adminUserId: string; action: "EMAIL_SUPPRESSION_LIFTED"; targetType: "USER"; targetId: string; before: unknown; after: unknown; ip: string | null; userAgent: string | null }) => Promise<unknown>;
}) {
  return {
    async lift(actorId: string, user: Suppressed, body: unknown, meta: { ip: string | null; userAgent: string | null }): Promise<LiftSuppressionResult> {
      const suppressedAt = user.emailSuppressedAt;
      if (!suppressedAt) throw new ValidationError("This address is not suppressed.", { code: "EMAIL_NOT_SUPPRESSED" });
      const parsed = UnsuppressEmailRequestSchema.safeParse(body ?? {});
      if (!parsed.success) throw new ValidationError("A reason of at least 20 characters is required.", { code: "REASON_REQUIRED", errors: zodErrors(parsed.error.issues) });
      const reason = parsed.data.reason;
      // Deux levées simultanées : MongoDB rejette la transaction perdante (P2034) — on la rejoue, et au second essai
      // l'écriture conditionnelle ne trouve plus rien à lever → 400 EMAIL_NOT_SUPPRESSED, jamais un 500.
      await (deps.retry ?? withWriteConflictRetry)(() => deps.db.$transaction(async (tx) => {
        // Conditionnelle : la suppression lue doit être TOUJOURS là (un autre onglet a pu lever entre-temps).
        const r = await tx.user.updateMany({ where: { id: user.id, emailSuppressedAt: suppressedAt }, data: { emailSuppressedAt: null, emailSuppressedReason: null } });
        if (r.count === 0) throw new ValidationError("This address is not suppressed.", { code: "EMAIL_NOT_SUPPRESSED" });
        await deps.record(tx, {
          adminUserId: actorId,
          action: "EMAIL_SUPPRESSION_LIFTED",
          targetType: "USER",
          targetId: user.id,
          before: { emailSuppressedAt: suppressedAt.toISOString(), reason: user.emailSuppressedReason },
          after: { emailSuppressedAt: null, liftReason: reason },
          ...meta,
        });
      }));
      return { ok: true, emailSuppression: null, liftedFrom: { at: suppressedAt.toISOString(), reason: user.emailSuppressedReason } };
    },
  };
}
