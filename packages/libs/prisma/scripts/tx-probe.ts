/**
 * tx-probe.ts — preuve des transactions multi-documents Atlas (registre v1.3 §7.2)
 * =================================================================================
 * Exécution : npx tsx packages/libs/prisma/scripts/tx-probe.ts
 *
 * Écrit DEUX OutboxEvent neutres dans UNE transaction Prisma, vérifie, nettoie.
 * Neutralité vis-à-vis du relay : publishedAt POSÉ + attempts=10 → la row est
 * invisible de la requête du relay (publishedAt:null ET attempts<10). Le delete
 * final ne viole pas « jamais de delete » (A23) : ce sont des artefacts de test,
 * pas des événements de domaine.
 * Verdict attendu : COMMIT OK · 2 · 2. Toute erreur « Transaction numbers are
 * only allowed on a replica set » = cluster inapte aux writers B2 → STOP.
 */
import prisma from "../index";

const MARKER = "tx-probe";
const ZERO_OID = "000000000000000000000000";

function probeRow(n: number, at: Date) {
  return {
    aggregateType: MARKER,
    aggregateId: ZERO_OID,
    eventType: "tx.probe",
    payload: { probe: n },
    correlationId: MARKER,
    occurredAt: at,
    publishedAt: at,
    attempts: 10,
  };
}

async function main() {
  const at = new Date();
  const ids = await prisma.$transaction(async (tx) => {
    const a = await tx.outboxEvent.create({ data: probeRow(1, at) });
    const b = await tx.outboxEvent.create({ data: probeRow(2, at) });
    return [a.id, b.id];
  });
  console.log("COMMIT OK — ids:", ids.join(", "));

  const count = await prisma.outboxEvent.count({ where: { correlationId: MARKER } });
  console.log(`Visibles après commit : ${count} (attendu 2)`);

  const del = await prisma.outboxEvent.deleteMany({ where: { correlationId: MARKER } });
  console.log(`Nettoyage : ${del.count} supprimés (attendu 2)`);
}

main()
  .catch((e) => {
    console.error("ÉCHEC TRANSACTION :", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
