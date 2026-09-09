import { BASE_RETRY_MS, MAX_RETRY_MS, nextDelayMs, superviseConsumer } from "./supervisor";
import type { ConsumedEventHandler, ConsumerCrash, EventConsumer } from "@packages/messaging";

/**
 * ANO-CRON-08 (recette crons du 09/09/2026, fiche CRON-CONSO-3, bloquante) — un plantage
 * DÉFINITIF de la boucle de consommation n'était rattrapé nulle part : le processus restait
 * vivant, `/health` répondait `ok`, le groupe passait `Empty`, et plus une notification ni un
 * email ne sortait. Un `rpk topic produce` ordinaire (snappy par défaut) suffisait à le
 * déclencher.
 *
 * Ces tests éprouvent les deux promesses du superviseur : se relever, et dire la vérité.
 * Aucun courtier : le consommateur et l'ordonnanceur sont injectés.
 */
describe("superviseConsumer — un consommateur mort se relève ou se voit", () => {
  const journal = () => {
    const lignes: Array<{ niveau: "info" | "error"; msg?: string; obj: unknown }> = [];
    return {
      lignes,
      info: (obj: unknown, msg?: string) => lignes.push({ niveau: "info", msg, obj }),
      error: (obj: unknown, msg?: string) => lignes.push({ niveau: "error", msg, obj }),
    };
  };

  /** Un faux consommateur : on pilote ses échecs et on déclenche son CRASH à la main. */
  const faux = (opts: { echouerAuDemarrage?: number } = {}) => {
    let restants = opts.echouerAuDemarrage ?? 0;
    let crash: ((c: ConsumerCrash) => void) | null = null;
    const appels = { connect: 0, subscribe: 0, run: 0, onCrash: 0 };
    const consumer: EventConsumer = {
      async connect() {
        appels.connect += 1;
        if (restants > 0) {
          restants -= 1;
          throw new Error("courtier injoignable");
        }
      },
      async subscribe() {
        appels.subscribe += 1;
      },
      async run(_handler: ConsumedEventHandler) {
        appels.run += 1;
      },
      async disconnect() {
        /* rien */
      },
      onCrash(handler) {
        appels.onCrash += 1;
        crash = handler;
      },
    };
    return { consumer, appels, planter: (c: ConsumerCrash) => crash?.(c) };
  };

  /** Horloge pilotée : la fenêtre de stabilité se mesure, elle ne s'attend pas. */
  const horloge = () => {
    let t = 0;
    return { now: () => t, avancer: (ms: number) => (t += ms) };
  };

  const options = (
    f: ReturnType<typeof faux>,
    log: ReturnType<typeof journal>,
    plan: Array<{ ms: number; fn: () => void }>,
    h: ReturnType<typeof horloge> = horloge()
  ) => ({
    consumer: f.consumer,
    topic: "booking-events",
    groupId: "notification-service",
    handler: async () => undefined,
    logger: log,
    schedule: (fn: () => void, ms: number) => {
      plan.push({ ms, fn });
    },
    now: h.now,
  });

  it("le retrait double et plafonne", () => {
    expect(nextDelayMs(null)).toBe(BASE_RETRY_MS);
    expect(nextDelayMs(BASE_RETRY_MS)).toBe(2 * BASE_RETRY_MS);
    expect(nextDelayMs(MAX_RETRY_MS)).toBe(MAX_RETRY_MS);
    expect(nextDelayMs(MAX_RETRY_MS - 1)).toBe(MAX_RETRY_MS);
    expect(nextDelayMs(null, 1_000, 500)).toBe(500); // un plafond plus bas que la base gagne
  });

  it("un démarrage réussi rend le consommateur courant", async () => {
    const f = faux();
    const log = journal();
    const s = superviseConsumer(options(f, log, []));
    expect(s.running()).toBe(false);
    expect(s.everRan()).toBe(false); // « pas encore démarré » ≠ « tombé » : `/health` ne crie pas
    await s.start();
    expect(s.running()).toBe(true);
    expect(s.everRan()).toBe(true);
    expect(f.appels.run).toBe(1);
    expect(log.lignes.at(-1)).toMatchObject({ niveau: "info", msg: "Consumer running" });
  });

  it("le cas exact d'ANO-CRON-08 : un plantage définitif coupe l'état et replanifie", async () => {
    const f = faux();
    const log = journal();
    const plan: Array<{ ms: number; fn: () => void }> = [];
    const s = superviseConsumer(options(f, log, plan));
    await s.start();
    expect(s.running()).toBe(true);

    f.planter({ error: new Error("Snappy compression not implemented"), willRestart: false });

    expect(s.running()).toBe(false); // /health dira `degraded`
    expect(s.everRan()).toBe(true); // il a tourné : ce n'est pas un démarrage lent, c'est une chute
    expect(plan).toHaveLength(1);
    expect(plan[0].ms).toBe(BASE_RETRY_MS);
    expect(log.lignes.at(-1)).toMatchObject({ niveau: "error", msg: "Consumer down — restarting" });

    plan[0].fn(); // le redémarrage programmé
    await Promise.resolve();
    await Promise.resolve();
    expect(f.appels.connect).toBe(2);
  });

  it("un plantage que le client rattrape lui-même n'est pas doublé", async () => {
    const f = faux();
    const log = journal();
    const plan: Array<{ ms: number; fn: () => void }> = [];
    const s = superviseConsumer(options(f, log, plan));
    await s.start();

    f.planter({ error: new Error("KafkaJSNumberOfRetriesExceeded"), willRestart: true });

    expect(plan).toHaveLength(0); // kafkajs se relance seul : on ne relance pas par-dessus
    expect(log.lignes.at(-1)).toMatchObject({ msg: "Consumer crashed — client will restart it" });
  });

  it("un démarrage impossible réessaie, avec un délai qui grandit", async () => {
    const f = faux({ echouerAuDemarrage: 3 });
    const log = journal();
    const plan: Array<{ ms: number; fn: () => void }> = [];
    const s = superviseConsumer(options(f, log, plan));

    await s.start();
    expect(s.running()).toBe(false);
    expect(plan.map((p) => p.ms)).toEqual([BASE_RETRY_MS]);

    await (plan[0].fn() as unknown as Promise<void>);
    await new Promise((r) => setImmediate(r));
    expect(plan.map((p) => p.ms)).toEqual([BASE_RETRY_MS, 2 * BASE_RETRY_MS]);
  });

  it("un poison qui tue la boucle à chaque lecture fait GRANDIR le délai, il ne boucle pas à 5 s", async () => {
    // Le piège exact relevé en recette : le DÉMARRAGE réussit, la boucle meurt aussitôt après.
    // Sans fenêtre de stabilité, chaque cycle repartirait du délai de base — une ligne d'erreur
    // toutes les cinq secondes, indéfiniment.
    const f = faux();
    const log = journal();
    const plan: Array<{ ms: number; fn: () => void }> = [];
    const h = horloge();
    const s = superviseConsumer(options(f, log, plan, h));

    for (let i = 0; i < 3; i++) {
      await s.start();
      h.avancer(200); // la boucle ne tient que deux dixièmes de seconde
      f.planter({ error: new Error("Snappy compression not implemented"), willRestart: false });
    }
    expect(plan.map((p) => p.ms)).toEqual([BASE_RETRY_MS, 2 * BASE_RETRY_MS, 4 * BASE_RETRY_MS]);
  });

  it("une boucle qui a TENU repart du délai de base", async () => {
    const f = faux();
    const log = journal();
    const plan: Array<{ ms: number; fn: () => void }> = [];
    const h = horloge();
    const s = superviseConsumer(options(f, log, plan, h));

    await s.start();
    h.avancer(100);
    f.planter({ error: new Error("poison"), willRestart: false }); // 5 s

    await s.start();
    h.avancer(10 * 60_000); // dix minutes de service normal
    f.planter({ error: new Error("incident sans rapport"), willRestart: false });

    expect(plan.map((p) => p.ms)).toEqual([BASE_RETRY_MS, BASE_RETRY_MS]);
  });

  it("l'abonnement au CRASH n'est posé qu'une fois, même après plusieurs redémarrages", async () => {
    const f = faux();
    const log = journal();
    const plan: Array<{ ms: number; fn: () => void }> = [];
    const s = superviseConsumer(options(f, log, plan));
    await s.start();
    await s.start();
    await s.start();
    expect(f.appels.onCrash).toBe(1);
  });
});
