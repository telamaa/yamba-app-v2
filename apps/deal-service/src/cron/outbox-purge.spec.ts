import { cutoffFor, isOutboxEventPurgeable } from "@packages/libs/retention";

/**
 * ANO-CRON-05 (recette n° 4, CRON-PURGEOUT-2, BLOQUANTE) — la règle pure disait la vérité, la
 * requête disait autre chose.
 *
 *   isOutboxEventPurgeable = !!e.publishedAt && olderThan(e.publishedAt, now, days)
 *   deleteMany({ where: { aggregateType, publishedAt: { lt: cutoffFor(now, days) } } })
 *
 * Sur MongoDB, `null` précède les dates dans l'ordre des types BSON : `null < n'importe quelle
 * date` est **vrai**. La requête attrapait donc tous les événements dont `publishedAt` vaut
 * `null` — c'est-à-dire **tous les événements jamais publiés**, à n'importe quel âge : ceux qu'un
 * relais arrêté n'avait pas encore publiés, et les événements PARQUÉS que la piste d'audit doit
 * conserver indéfiniment.
 *
 * Ce spec fige la règle pure, qui est la référence. La requête lui est désormais alignée
 * (`not: null` explicite), et cette équivalence a été vérifiée CONTRE LA BASE avant d'être écrite.
 */
describe("rétention de la boîte d'envoi — publié ET ancien, jamais l'un sans l'autre", () => {
  const maintenant = new Date("2026-09-09T00:00:00.000Z");
  const jours = 90;
  const vieux = new Date(maintenant.getTime() - 200 * 86_400_000);
  const recent = new Date(maintenant.getTime() - 3 * 86_400_000);

  it("purge un événement publié il y a plus longtemps que la rétention", () => {
    expect(isOutboxEventPurgeable({ publishedAt: vieux, occurredAt: vieux }, maintenant, jours)).toBe(true);
  });

  it("garde un événement publié récemment", () => {
    expect(isOutboxEventPurgeable({ publishedAt: recent, occurredAt: vieux }, maintenant, jours)).toBe(false);
  });

  it("garde un événement JAMAIS publié, si vieux soit-il — c'est le cœur d'ANO-CRON-05", () => {
    expect(isOutboxEventPurgeable({ publishedAt: null, occurredAt: vieux }, maintenant, jours)).toBe(false);
    const tresVieux = new Date(maintenant.getTime() - 5000 * 86_400_000);
    expect(isOutboxEventPurgeable({ publishedAt: null, occurredAt: tresVieux }, maintenant, jours)).toBe(false);
  });

  it("la borne de date reste celle qu'annonce le paramètre", () => {
    expect(cutoffFor(maintenant, jours).toISOString()).toBe("2026-06-11T00:00:00.000Z");
  });

  it("le filtre de la requête doit porter `not: null` — la comparaison de date ne suffit PAS", () => {
    // Garde-fou documentaire : sur Mongo, `{ publishedAt: { lt: date } }` matche `null`.
    // Le seul filtre correct est « publié » ET « ancien », exprimés séparément.
    const source = require("node:fs").readFileSync(
      require("node:path").join(__dirname, "outbox-retention.cron.ts"),
      "utf-8"
    ) as string;
    expect(source).toContain("publishedAt: { not: null }");
    expect(source).not.toMatch(/where:\s*\{\s*aggregateType,\s*publishedAt:\s*\{\s*lt:/);
  });
});
