/**
 * supervisor.ts — un consommateur mort doit se relever, ou crier (ANO-CRON-08)
 * ============================================================================
 * Recette « tâches planifiées », fiche CRON-CONSO-3 du 09/09/2026, bloquante.
 *
 * Le service ne gérait que l'échec **au démarrage** (réessai toutes les 5 s). Un plantage
 * APRÈS démarrage n'était traité nulle part. kafkajs se relève seul sur une erreur retriable
 * (« Restarting the consumer in 8206ms »), mais s'arrête **définitivement** sur une erreur
 * non retriable. Un simple `rpk topic produce` — qui compresse en snappy par défaut — a suffi :
 *
 *     [Consumer] Crash: KafkaJSNotImplemented: Snappy compression not implemented
 *     [Consumer] Stopped
 *
 * …et à partir de là, plus une notification, plus un email, pendant que `/health` répondait
 * `{"status":"ok"}` et que le groupe passait `Empty`. Une mort silencieuse.
 *
 * Ce module tient donc DEUX promesses :
 *
 * 1. **Se relever.** Après un plantage définitif, on reconnecte, avec un retrait exponentiel
 *    plafonné : un message que le transport ne sait pas décoder fait une boucle **bruyante**
 *    (une ligne d'erreur par tentative, de plus en plus espacée) au lieu d'un arrêt muet.
 *    On ne saute jamais un message qu'on n'a pas su lire — sauter, ce serait perdre.
 * 2. **Dire la vérité.** `running()` alimente `/health` : un consommateur activé mais non
 *    courant rend le service `degraded`, donc visible sur la page « État des services » et
 *    sur la sonde publique `GET /api/status`.
 *
 * Le module est testable sans courtier : le consommateur et l'horloge sont injectés.
 */
import type { ConsumedEventHandler, ConsumerCrash, EventConsumer } from "@packages/messaging";

/** Le journal minimal attendu (compatible pino). */
export interface SupervisorLogger {
  info(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
}

export const BASE_RETRY_MS = 5_000;
export const MAX_RETRY_MS = 5 * 60_000;
/**
 * Durée au-delà de laquelle une boucle est jugée « repartie pour de bon ».
 * Sans cette fenêtre, le retrait ne grandirait jamais dans le cas qui nous occupe : un poison
 * de transport laisse le DÉMARRAGE réussir, puis tue la boucle à la première lecture. Chaque
 * cycle repartirait donc du délai de base — une ligne d'erreur toutes les cinq secondes, pour
 * toujours. Le redémarrage ne compte que s'il a tenu.
 */
export const STABLE_AFTER_MS = 60_000;

/**
 * Retrait exponentiel plafonné — PUR, donc éprouvable seul.
 * `null` (aucune tentative encore) donne le délai de base ; ensuite on double, sans jamais
 * dépasser le plafond. Le plafond compte autant que le doublement : une panne d'une nuit ne
 * doit pas produire des dizaines de milliers de lignes de journal.
 */
export function nextDelayMs(previous: number | null, base = BASE_RETRY_MS, max = MAX_RETRY_MS): number {
  if (previous === null) return Math.min(base, max);
  return Math.min(previous * 2, max);
}

export interface SupervisedConsumerOptions {
  consumer: EventConsumer;
  topic: string;
  groupId: string;
  handler: ConsumedEventHandler;
  logger: SupervisorLogger;
  baseDelayMs?: number;
  maxDelayMs?: number;
  stableAfterMs?: number;
  /** Injecté par les tests pour ne pas attendre réellement. */
  schedule?: (fn: () => void, ms: number) => void;
  /** Horloge injectable — les tests n'attendent pas une minute. */
  now?: () => number;
}

export interface SupervisedConsumer {
  /** Vrai tant que la boucle de consommation tourne — la source de `/health`. */
  running(): boolean;
  /**
   * Vrai dès que la boucle a tourné au moins une fois. Distingue « pas ENCORE démarré »
   * (les dix premières secondes, le temps de rejoindre le groupe) de « tombé » : sans cette
   * nuance, `/health` répondrait `degraded` à chaque démarrage, et la sonde publique
   * clignoterait à chaque déploiement.
   */
  everRan(): boolean;
  /** Démarre (ou redémarre) la boucle. Ne jette jamais : elle réessaie. */
  start(): Promise<void>;
}

export function superviseConsumer(options: SupervisedConsumerOptions): SupervisedConsumer {
  const { consumer, topic, groupId, handler, logger } = options;
  const base = options.baseDelayMs ?? BASE_RETRY_MS;
  const max = options.maxDelayMs ?? MAX_RETRY_MS;
  const stableAfter = options.stableAfterMs ?? STABLE_AFTER_MS;
  const now = options.now ?? (() => Date.now());
  const schedule =
    options.schedule ??
    ((fn: () => void, ms: number) => {
      const timer = setTimeout(fn, ms);
      // Le serveur HTTP porte la vie du process : ce minuteur ne doit pas la prolonger.
      timer.unref?.();
    });

  let running = false;
  let everRan = false;
  let delay: number | null = null;
  let crashHooked = false;
  let startedAt: number | null = null;

  const replanifier = (raison: string, err: unknown): void => {
    // Une boucle qui a tenu assez longtemps repart du délai de base : l'incident précédent
    // est considéré comme soldé. Une boucle qui meurt aussitôt, elle, s'espace.
    if (startedAt !== null && now() - startedAt >= stableAfter) delay = null;
    running = false;
    startedAt = null;
    delay = nextDelayMs(delay, base, max);
    logger.error({ err, topic, groupId, nextRetryMs: delay, raison }, "Consumer down — restarting");
    schedule(() => {
      void start();
    }, delay);
  };

  async function start(): Promise<void> {
    try {
      await consumer.connect();
      await consumer.subscribe(topic);
      // L'abonnement au CRASH ne se fait qu'UNE fois : le client kafkajs est le même objet
      // d'un redémarrage à l'autre, et un abonnement par tentative multiplierait les rappels.
      if (!crashHooked && typeof consumer.onCrash === "function") {
        consumer.onCrash((crash: ConsumerCrash) => {
          // kafkajs se relève tout seul sur une erreur retriable : on ne double pas son travail,
          // on note simplement que la boucle est momentanément à l'arrêt.
          if (crash.willRestart) {
            logger.error({ err: crash.error, topic, groupId }, "Consumer crashed — client will restart it");
            return;
          }
          replanifier("crash définitif", crash.error);
        });
        crashHooked = true;
      }
      await consumer.run(handler);
      running = true;
      everRan = true;
      startedAt = now(); // le retrait ne se remet à zéro que si la boucle TIENT (cf. STABLE_AFTER_MS)
      logger.info({ topic, groupId }, "Consumer running");
    } catch (err) {
      replanifier("démarrage impossible", err);
    }
  }

  return { running: () => running, everRan: () => everRan, start };
}
