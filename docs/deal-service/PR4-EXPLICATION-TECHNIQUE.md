# Yamba — PR4 `feat/outbox-relay` : le guide technique complet
### Document technique · comprendre, lancer, vérifier, faire évoluer · Juillet 2026

Ce guide explique tout ce que la PR4 a construit : le **producteur** du pattern outbox (décision D2), gouverné par les arbitrages **A23** (topologie événementielle) et **A24** (architecture du relay). Chaque terme est expliqué à sa première apparition. Documents amont : `SPECIFICATIONS-WORKFLOW-YAMBA.md`, le registre (D1–D30, A1–A24), les guides PR3, et le contrat `booking-events.schema.ts` (les 17 événements, gravés en PR3).

---

## 1. La carte du territoire

```
   TRANSITION (B2, à venir)          CETTE PR                        PR4bis (à venir)
┌─────────────────────────┐   ┌──────────────────────┐   ┌──────────────────────────┐
│ booking ACCEPTED         │   │       RELAY          │   │  notification-service    │
│   + OutboxEvent          │──▶│  poll 1 s, batch 50  │──▶│  (consumer)              │
│   (MÊME transaction)     │   │  publie → Redpanda   │   │  dédup par event-id      │
└─────────────────────────┘   └──────────────────────┘   └──────────────────────────┘
        MongoDB Atlas            topic `booking-events`
     (l'outbox = audit)          12 partitions, clé=aggregateId
```

Les fichiers livrés, et le rôle de chacun :

| Chemin | Rôle |
|---|---|
| `prisma/schema.prisma` | `OutboxEvent` gagne `attempts/lastError/lastErrorAt` (suivi d'erreurs) ; nouveau modèle `RelayLease` (le bail d'exclusivité) |
| `docker-compose.yml` | Redpanda mono-nœud pour le développement local (port 9092) |
| `scripts/redpanda-bootstrap.sh` | Création EXPLICITE du topic (12 partitions, rétention 7 j) + interdiction de l'auto-création — relançable sans effet |
| `packages/libs/messaging/` | La bibliothèque partagée : registre des topics, interface `EventPublisher`, implémentation kafkajs |
| `apps/deal-service/src/relay/relay-lease.ts` | Acquisition/renouvellement/libération du bail |
| `apps/deal-service/src/relay/outbox-relay.ts` | La boucle du facteur : lecture, validation, publication, marquage, erreurs |
| `apps/deal-service/src/relay/outbox-relay.spec.ts` | 16 tests unitaires du relay |
| `apps/deal-service/src/main.ts` | Câblage : démarrage du relay après le serveur HTTP, arrêt propre |
| `packages/libs/prisma/scripts/seed-outbox.ts` | Jeu d'essai : injecte 6 événements réels dans l'outbox pour le smoke de bout en bout |

## 2. Le glossaire, au fil de l'architecture

**Le pattern outbox.** On ne peut pas garantir qu'une écriture en base ET un envoi de message réussissent ensemble (deux systèmes = pas de transaction commune). La solution : écrire le message *dans la base*, dans la **même transaction** (lot d'écritures « tout ou rien ») que le changement d'état. Un processus séparé — le **relay** — lit ensuite ces messages et les publie. La perte devient structurellement impossible : tant que `publishedAt` est `null`, le message attend son tour.

**Broker, topic, partition, offset.** Redpanda est un **broker** (courtier de messages) compatible **Kafka**, le standard des journaux d'événements. Un **topic** est un canal nommé (`booking-events`). Un topic est découpé en **partitions** : des sous-journaux indépendants, chacun strictement ordonné. Chaque message reçoit dans sa partition un **offset** : son numéro de séquence. Notre smoke l'a montré : les 5 événements du cycle de vie d'un même booking sont sortis sur la partition 3, offsets 0→4 — l'ordre exact d'insertion.

**Clé de partition.** Chaque message porte une **clé** ; tous les messages de même clé vont dans la même partition, donc restent ordonnés entre eux. Notre clé = `aggregateId` (l'identifiant du booking — l'**agrégat** est l'entité dont l'événement raconte la vie). C'est LE mécanisme qui garantit « ordre par deal » sans imposer d'ordre global. Corollaire d'A23 : on crée **12 partitions dès le départ**, car en augmenter le nombre plus tard changerait la répartition clé→partition et casserait transitoirement cet ordre — décision quasi irréversible, donc prise large.

**Producer / consumer.** Le relay est un **producer** (il publie). Les services abonnés seront des **consumers** (ils lisent à leur rythme, chacun son curseur d'offsets). Un topic, N consumers indépendants : notifications demain, analytics après-demain — sans que le deal-service ne les connaisse.

**At-least-once, at-most-once, exactly-once.** Trois garanties de livraison possibles. *At-most-once* : jamais de doublon, mais des pertes possibles (inacceptable). *Exactly-once* : le graal, coûteux et fragile en distribué. *At-least-once* (notre choix) : jamais de perte, doublons rares possibles. Implémentation : le relay pose `publishedAt` **après** l'**ack** (accusé de réception) du broker, message par message. Crash entre l'ack et le marquage → le message repart au tick suivant. Les doublons sont neutralisés côté consumer par…

**L'idempotence.** Propriété d'une opération qu'on peut rejouer sans effet supplémentaire : f(f(x)) = f(x). Trois usages dans cette PR. (1) **Dédup consumer** : chaque message Kafka porte un header `event-id` (l'`_id` Mongo de la row outbox — le header voyage à côté du payload, sans toucher au contrat) ; un consumer mémorise les ids traités (index unique) et ignore les doublons — c'est ce qui transforme l'at-least-once du tuyau en « exactement un effet » pour l'utilisateur. (2) **Bootstrap idempotent** : relancer `redpanda-bootstrap.sh` détecte le topic existant et ne fait rien. (3) **Seed idempotent** : `seed-outbox.ts` efface d'abord SES propres rows (marquées `correlationId: "seed-outbox"`) — jamais celles de production.

**Le bail (lease) et le compare-and-set.** L'ordre par clé exige **un seul publieur actif**. Le bail est un document unique (`RelayLease`, `_id: "outbox-relay"`) avec un propriétaire et une expiration (**TTL** — time-to-live, 30 s). L'acquisition utilise un **compare-and-set** : « donne-moi le bail SI je le détiens déjà OU s'il est expiré », en une seule opération atomique Mongo (`updateMany` conditionnel) — deux instances qui courent ne peuvent pas gagner toutes les deux. Le détenteur renouvelle à chaque tick (**heartbeat**) ; s'il meurt, le bail expire et une autre instance reprend en ≤ 30 s. La variable `OUTBOX_RELAY_ENABLED=false` permet en plus de désigner des instances « API pures ».

**Polling et backoff exponentiel.** Le relay fonctionne en **polling** : il interroge la base toutes les secondes (« du nouveau ? »), par batch de 50, tri `occurredAt` croissant — l'index `[publishedAt, occurredAt]` sert exactement cette requête. La boucle est un `setTimeout` **chaîné** (le tick suivant n'est armé qu'à la fin du précédent : aucun chevauchement possible, contrairement à `setInterval`). En cas d'erreur, le délai **double** à chaque échec (1 s → 2 → 4 → … plafond 30 s) : c'est le **backoff exponentiel**, qui évite de marteler un système déjà en difficulté, et se réinitialise au premier tick sain.

**Poison message et parking.** Un « poison » est un message que retenter ne sauvera jamais : payload hors contrat (le relay valide chaque row avec `BookingDomainEventSchema.parse` AVANT le broker — une divergence writer/contrat est attrapée ici, jamais chez un consumer), ou erreur broker définitivement non-retriable (ex. message trop gros). Traitement : `attempts++`, trace dans `lastError/lastErrorAt`, et à **10 tentatives** la row est **parquée** — exclue de la requête du relay, JAMAIS supprimée (l'outbox est aussi le journal d'audit) — avec un log niveau erreur. Le batch continue : un poison ne bloque pas les événements sains. ⚠️ Piège découvert au smoke, en conditions réelles : kafkajs marque `retriable: false` une simple panne de connexion une fois ses retries internes épuisés (`KafkaJSNumberOfRetriesExceeded`). Sans garde-fou, une panne broker de quelques minutes aurait parqué des événements parfaitement valides. Les erreurs de connexion sont donc explicitement exclues du circuit poison : elles suivent la voie **transitoire** — `lastError` tracé mais **jamais** d'`attempts++`, arrêt du batch, backoff.

**Connexion lazy et arrêt propre (graceful shutdown).** Le relay ne se connecte au broker qu'au premier tick où il détient le bail : si Redpanda est absent au démarrage, **l'API vit quand même** (prouvé pendant la panne Docker de la session). À l'arrêt (SIGTERM/SIGINT — les signaux système « termine-toi »), l'ordre est strict : fin du message en cours, libération du bail, déconnexion du producer, fermeture du serveur HTTP — avec une ceinture de 5 s qui force la sortie si quelque chose traîne, et un garde anti-réentrance (un Ctrl+C répété ne relance pas N arrêts). Détail : le timer du relay est `unref()` — il ne retient pas le processus à lui seul (c'est le serveur HTTP qui porte la vie du service), ce qui permet aussi à jest de sortir proprement.

**Dénormalisation.** La row `OutboxEvent` duplique en colonnes (`aggregateId`, `eventType`, `occurredAt`…) des faits déjà présents dans `payload`. C'est voulu : `payload` est la **source publiée** (l'événement complet, verbatim), les colonnes sont des copies pour l'indexation et l'audit. Décision A24 : jamais de reconstruction du payload par le relay.

## 3. Lancer la machine — toutes les commandes

```bash
# 0. Prérequis : Docker Desktop DÉMARRÉ (leçon vécue), .env avec DATABASE_URL.

# 1. Le broker local
docker compose up -d
docker ps --format '{{.Names}}\t{{.Status}}' | grep redpanda   # attendu : (healthy)
./scripts/redpanda-bootstrap.sh    # crée booking-events (12 part., 7 j) — relançable

# 2. Alimenter l'outbox (les writers réels = B2 ; en attendant, le jeu d'essai)
npx tsx packages/libs/prisma/scripts/seed-outbox.ts                 # 6 événements valides
npx tsx packages/libs/prisma/scripts/seed-outbox.ts --with-poison   # + 1 poison (démo parking)

# 3. Le service (le relay démarre avec lui)
npx nx serve deal-service          # ou : npx nx run @yamba-app/deal-service:build && node apps/deal-service/dist/main.js
# logs attendus : "Outbox relay starting" → "Broker connection established" → N× "Event published"

# 4. Vérifier côté broker (terminal 2)
docker exec yamba-redpanda rpk topic consume booking-events -n 6
docker exec yamba-redpanda rpk topic describe booking-events

# 5. Vérifier côté base (mongosh/Compass)
# db.OutboxEvent.find({ publishedAt: null })      → rows en attente (ou parquées : attempts >= 10)
# db.RelayLease.findOne()                          → qui tient le bail, jusqu'à quand

# Variables d'environnement du relay :
#   KAFKA_BROKERS=localhost:9092   (CSV si plusieurs)
#   OUTBOX_RELAY_ENABLED=true|false
```

⚠️ Deux pièges d'outillage vécus : le `rpk` embarqué dans l'image Redpanda a des **flags réduits** (`--format json` et `--set` au démarrage n'existent pas — toujours parser la sortie texte) ; et tout nouvel alias `@packages/*` doit être déclaré à **DEUX endroits** : `tsconfig.base.json` (pour tsc/IDE) **ET** le `webpack.config.js` de chaque service consommateur (pour le build Nx) — deux résolveurs, deux configs.

## 4. Les tests : lancer, comprendre, faire évoluer

### Lancer

```bash
npx nx test deal-service     # attendu : 218 tests (188 machine + 14 mapper + 16 relay), 3 suites
npx tsc --noEmit --project apps/deal-service/tsconfig.app.json   # le typage — TOUJOURS ce chemin exact
```

### Comprendre l'anatomie du spec (`outbox-relay.spec.ts`)

La stratégie de test repose sur quatre choix, chacun avec sa raison :

**On mocke l'interface, jamais kafkajs.** Un **mock** est un faux objet qui enregistre comment on l'appelle. Le publisher testé est un simple `{ connect, publish, disconnect }` conforme à `EventPublisher` : les tests survivront à un changement de client Kafka, et ils vérifient le **contrat** du relay (quoi publier, quand marquer), pas la plomberie réseau.

**Prisma et `@packages/messaging` sont des mocks *virtuels*.** `jest.mock(..., { virtual: true })` court-circuite la résolution de module : jest n'essaie même pas de trouver le fichier réel. Pourquoi : seul l'alias `@packages/api-contracts` est *prouvé* résolu par le préset jest (les 202 tests PR3 en attestent) ; pour les autres, on ne parie pas.

**Le contrat est RÉEL.** Les fixtures (données d'exemple) passent le vrai `BookingDomainEventSchema` — et un méta-test le vérifie (« sinon tous les tests mentent ») : si le contrat évolue, ces tests cassent, et c'est exactement ce qu'on veut.

**Chaque tick est une unité testable.** `tick()` est public (JSDoc d'avertissement : seule la boucle l'appelle en production) et le getter `currentBackoffMs` permet d'asserter le backoff sans attendre de vraies secondes.

Les 16 tests, par famille : *publication nominale* (topic/clé/header corrects ; `publishedAt` après CHAQUE ack, dans l'ordre ; requête triée-bornée-hors-parquées ; bail refusé = zéro activité) · *connexion lazy* (un seul `connect` ; échec = backoff puis nouvelle tentative) · *poison* (Zod → attempts++ et le batch continue ; parking à 10 avec log PARKED ; `retriable:false` non-connexion = poison) · *transitoire* (jamais d'attempts++ ; batch stoppé ; backoff qui double jusqu'au plafond puis reset ; erreur de connexion `retriable:false` = transitoire — la non-régression du piège) · *arrêt propre* (bail libéré au bon owner ; disconnect conditionnel ; arrêt en plein batch) · *méta-test fixture*.

### Ajouter un test : la recette

1. Choisir la famille (`describe`) ou en créer une.
2. Construire l'état de départ avec les usines existantes : `outboxRow({ ... })` accepte des surcharges (`id`, `aggregateId`, `occurredAt`, `attempts`, `payload`) ; `buildRelay()` renvoie `{ relay, publisher, logger }` déjà câblés.
3. Programmer les mocks : `findManyMock.mockResolvedValue([row])`, `publisher.publish.mockRejectedValue(...)`, etc. **Règle d'or : tout mock de fonction async doit retourner une promesse** (`mockResolvedValue`/`mockRejectedValue`) — un `jest.fn()` nu retourne `undefined` et `.catch` explosera (bug vécu dans cette session).
4. `await relay.tick()` — et si le scénario appelle `stop()` en cours de route, **capturer et attendre sa promesse** (un `stop()` flottant = rejet non géré = crash du worker jest, également vécu).
5. Asserter sur les appels (`publisher.publish.mock.calls`, `updateMock`) et sur `relay.currentBackoffMs`.

Exemple complet — « une row parquée ne repart jamais » se teste en vérifiant la *requête*, pas la row :
```ts
it("n'interroge jamais les rows parquées", async () => {
  const { relay } = buildRelay();
  await relay.tick();
  expect(findManyMock).toHaveBeenCalledWith(
    expect.objectContaining({ where: expect.objectContaining({ attempts: { lt: MAX_RELAY_ATTEMPTS } }) })
  );
});
```

### Faire évoluer

**Nouveau type d'événement** (ex. un 18e event en B3) : d'abord le contrat (`booking-events.schema.ts` — nouveau schéma + ajout à l'union), puis la fixture du spec si le socle change, puis le writer. Le relay, lui, **ne change pas** : il publie l'union, il n'énumère jamais les types — c'est le bénéfice direct d'A24.

**Nouveau comportement du relay** (ex. métrique, nouvelle politique de retry) : écrire le test ROUGE d'abord (D30 : les tests voyagent dans la même PR que leur logique), puis le code, puis vérifier le compte total attendu (`grep -c "  it(" ...spec.ts`).

**Changement de client Kafka** : réécrire `kafka-publisher.ts` (seul fichier de la plateforme autorisé à importer kafkajs), zéro test du relay à toucher — ils mockent l'interface.

**Futur consumer (PR4bis)** : son spec suivra le motif miroir — mock du consumer wrapper, dédup vérifiée sur le header `event-id`, parsing via le même `BookingDomainEventSchema`.

## 5. Ce que cette PR ne fait pas (et où ça se fera)

Les transitions n'écrivent pas encore d'`OutboxEvent` — les **writers** arrivent en B2, dans la transaction Mongo de chaque transition (prérequis prouvé : Atlas en replica set). Personne ne consomme le topic — le **notification-service** (PR4bis) sera le premier abonné, avec la cohabitation `trip-notifications.service.ts` à arbitrer. Le **replay** analytique (post-MVP) se fera depuis l'outbox Mongo — source de vérité éternelle — jamais en rembobinant Kafka (rétention 7 j, choix A23). Backlog gravé par ailleurs : redaction des cookies dans les logs pino-http, et la curiosité `shipperId === carrierId` du seed-deals.
