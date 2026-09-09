/**
 * requeue-parked-outbox.ts — remet en file les événements parqués redevenus valides
 * =================================================================================
 * ANO-CRON-02 (recette n° 4, 09/09/2026). Le relais parque un événement après
 * `MAX_RELAY_ATTEMPTS` échecs non rejouables, journalise « manual investigation required », et
 * l'alerte `OUTBOX_PARKED` se déclenche. Mais **rien ne permettait de le libérer** : le relais ne
 * sélectionne que `attempts < 10`, et aucune route, aucun script ne remettait le compteur à zéro.
 *
 * Or la cause d'un parcage est souvent TEMPORAIRE : un type d'événement pas encore déclaré au
 * contrat, un sujet du courtier absent, un champ ajouté depuis. Une fois la cause levée,
 * l'événement reste parqué **pour toujours**, et la notification qu'il portait ne part jamais.
 * Constaté : quatre événements de litige (`dispute_carrier_responded`, `dispute_resolved`) parqués
 * le 04/09, parfaitement VALIDES au contrat d'aujourd'hui — les parties n'ont jamais été
 * prévenues de la décision.
 *
 * Ce script ne force rien : il **revalide** chaque événement parqué au contrat courant, et ne
 * remet en file que ceux qui passent. Un événement réellement empoisonné reste parqué, ce qui est
 * le comportement voulu.
 *
 *   npx tsx --env-file=.env packages/libs/prisma/scripts/requeue-parked-outbox.ts [--dry-run] [--type=booking]
 */
import prisma from "../index";
import { BookingDomainEventSchema, MessagingDomainEventSchema } from "@packages/api-contracts";

const MAX_RELAY_ATTEMPTS = 10;

/** Le contrat qui gouverne un agrégat — le même que celui du relais correspondant. */
function contratDe(aggregateType: string) {
  if (aggregateType === "booking") return BookingDomainEventSchema;
  if (aggregateType === "conversation") return MessagingDomainEventSchema;
  return null;
}

async function main() {
  const sec = process.argv.includes("--dry-run");
  const filtreType = process.argv.find((a) => a.startsWith("--type="))?.slice(7);
  if (sec) console.log("— simulation, aucune écriture —\n");

  const parques = await prisma.outboxEvent.findMany({
    where: {
      OR: [{ publishedAt: null }, { publishedAt: { isSet: false } }],
      attempts: { gte: MAX_RELAY_ATTEMPTS },
      ...(filtreType ? { aggregateType: filtreType } : {}),
    } as never,
    select: { id: true, aggregateType: true, eventType: true, attempts: true, payload: true, occurredAt: true },
    orderBy: { occurredAt: "asc" },
  });

  console.log(`${parques.length} événement(s) parqué(s).\n`);
  let remis = 0;
  let laisses = 0;

  for (const e of parques as Array<{ id: string; aggregateType: string; eventType: string; attempts: number; payload: unknown; occurredAt: Date }>) {
    const contrat = contratDe(e.aggregateType);
    const etiquette = `${e.aggregateType}/${e.eventType} (${e.occurredAt.toISOString().slice(0, 10)})`;
    if (!contrat) {
      console.log(`· ${etiquette} — agrégat inconnu, laissé parqué`);
      laisses++;
      continue;
    }
    const verdict = contrat.safeParse(e.payload);
    if (!verdict.success) {
      console.log(`· ${etiquette} — TOUJOURS refusé par le contrat, laissé parqué`);
      laisses++;
      continue;
    }
    if (sec) {
      console.log(`· ${etiquette} — valide au contrat, serait remis en file`);
      remis++;
      continue;
    }
    await prisma.outboxEvent.update({ where: { id: e.id }, data: { attempts: 0, lastError: null, lastErrorAt: null } });
    console.log(`✓ ${etiquette} — remis en file`);
    remis++;
  }

  console.log(`\n${sec ? "à remettre" : "remis"} en file : ${remis} · laissé(s) parqué(s) : ${laisses}`);
  if (!sec && remis > 0) console.log("Le relais les republiera au prochain tick (une seconde).");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
