# Yamba — PR4bis `feat/notification-service` : le guide technique complet
### Comprendre, lancer, vérifier, faire évoluer · Juillet 2026

Cette PR livre le **premier consommateur** du pattern outbox (décision D2), gouverné par les arbitrages **A25** (idempotence claim-first et wrapper consumer), **A26** (cohabitation avec les notifications trip existantes) et **A27** (périmètre in-app). Elle amende **A24** au passage. Documents amont : le registre v1.3 (D1–D30, A1–A24, §6 leçons), les guides PR3/PR4, le contrat `booking-events.schema.ts` (17 événements), la matrice A15 (handoff PR3 §4).

---

## 1. La carte du territoire

```
        PR4 (livré)                      CETTE PR                        PR5+ (à venir)
┌──────────────────────┐   ┌──────────────────────────────────┐   ┌─────────────────────┐
│  RELAY (deal-service) │   │  notification-service :6004       │   │  user-ui             │
│  poll 1 s, batch 50   │──▶│  consumer groupId dédié           │──▶│  écran notifications │
│  publie → Redpanda    │   │  claim-first → upsert → PROCESSED │   │  (NotificationsPreview│
└──────────────────────┘   │  GET /me/notifications (+unread)  │   │   comme cible)       │
   topic `booking-events`   │  PATCH /me/notifications/:id/read │   └─────────────────────┘
   12 partitions, clé=aggId └──────────────────────────────────┘
```

Les fichiers livrés (chemins prouvés, lignes comptées au `wc -l`) :

| Chemin | Lignes | Rôle |
|---|---|---|
| `apps/notification-service/package.json` | 68 | Workspace npm + clé `nx.targets` — **le vrai déclencheur de l'inférence Nx** (découverte de session : les plugins ne suffisent pas) |
| `apps/notification-service/{tsconfig,tsconfig.app,tsconfig.spec}.json`, `jest.config.ts`, `webpack.config.js` | 10/20/16/10/38 | Squelette cloné du deal-service ; le webpack déclare les alias `api-contracts` ET `messaging` dès la naissance (leçon §6.2 : TROIS résolveurs) |
| `packages/libs/messaging/src/event-consumer.ts` | 43 | L'interface `EventConsumer` — miroir d'`EventPublisher` (A24) |
| `packages/libs/messaging/src/kafka-consumer.ts` | 79 | Implémentation kafkajs — 2ᵉ et DERNIER fichier autorisé à importer kafkajs (A24 amendé) |
| `packages/libs/messaging/src/consumer-groups.ts` | 9 | Registre des groupId — un par service, JAMAIS renommé |
| `prisma/schema.prisma` (913 → 969) | +56 | `Notification` (unique `[eventId, userId]`) + `ConsumedEvent` (unique `[consumerGroup, eventId]`, statuts PENDING/PROCESSED/FAILED) |
| `apps/notification-service/src/consumer/booking-events.consumer.ts` | 171 | LE cœur : claim → parse → matérialisation → PROCESSED ; matrice A15 en data |
| `apps/notification-service/src/main.ts` | 183 | Câblage : consumer après le listen, retry 5 s (unref), `NOTIFICATION_CONSUMER_ENABLED`, arrêt propre gardé |
| `apps/notification-service/src/services/notification-view.mapper.ts` | 29 | DTO whitelist A13, parse strict final |
| `apps/notification-service/src/controllers/notification.controller.ts` | 77 | GET (take 50 desc + unreadCount) et PATCH read idempotent — sémantique A21 |
| `apps/notification-service/src/routes/notification.routes.ts` | 20 | Routes sans préfixe `/api`, `isAuthenticated` partout |
| `apps/notification-service/src/openapi/build-openapi.ts` + `openapi.json` | 120 / — | OAS 3.1 générée (D3) : 96 schémas (registre commun A22), 2 opérations sécurisées |
| `apps/api-gateway/src/main.ts` | ♻️ | Proxy `/api/me/notifications → :6004` inséré AVANT le catch-all auth (ordre critique) |
| `scripts/generate-openapi.ts` | 34 | 3ᵉ TARGET — les TROIS openapi.json se régénèrent et se diffent ensemble |
| `.github/workflows/ci.yml` | ♻️ | Matrice +2 entrées → **13 checks** ; le job contrats diffe 3 documents |
| Specs : `booking-events.consumer.spec.ts` + `notification-view.mapper.spec.ts` | 327 / 55 | **21 tests** (17 + 4) — plateforme à **239** |

Env : `KAFKA_BROKERS` (déf. `localhost:9092`) · `NOTIFICATION_CONSUMER_ENABLED` (déf. `true`) · `NOTIFICATION_SERVICE_PORT` (déf. `6004`).

## 2. Le glossaire, au fil de l'architecture

**Consumer group / groupId.** Kafka livre chaque message UNE fois par *groupe* de consommateurs. `notification-service` a son groupId ; demain `analytics` aura le sien — chacun reçoit SA copie complète du flux. À l'intérieur d'un même groupe, plusieurs instances se *partagent* les partitions (scaling horizontal gratuit). Règle gravée (registre `consumer-groups.ts`) : un groupId ne se renomme JAMAIS — le renommer, c'est perdre les offsets, donc tout retraiter.

**Offset & commit post-traitement.** L'offset est le signet du groupe dans chaque partition. Notre wrapper commite l'offset quand le handler **résout** ; s'il **jette**, pas de commit → le broker re-livre. C'est l'at-least-once côté consommation, symétrique du producteur (publishedAt post-ack). Corollaire assumé : **la re-livraison est un cas normal**, d'où l'idempotence ci-dessous.

**`fromBeginning: true`.** Au premier démarrage d'un groupe (aucun offset commité), on lit depuis le début du topic. Observé en session : le service néonatal a d'abord rattrapé 6 événements des smokes PR4 encore en rétention, puis consommé les 6 nouveaux en direct (~100 ms entre « published » et « materialized »). Dès le premier commit, ce flag n'a plus d'effet.

**`allowAutoTopicCreation: false`.** A23 étendu au consumer : un topic absent est une erreur d'infra, jamais une création silencieuse.

## 3. Le claim-first — l'idempotence qui ne perd rien

Un « insert-then-skip » naïf (insérer la clé, sauter sur doublon) a un trou mortel : claim posé → erreur *transitoire* pendant le traitement → re-livraison → doublon détecté → skip → **notification perdue à jamais**. D'où le protocole à trois statuts (`ConsumedEvent`) :

1. **CLAIM** : `create { consumerGroup, eventId, status: PENDING }`. Sur P2002 (l'unique composite est le verrou), on lit le statut existant : `PROCESSED` = doublon, skip total ; `PENDING` ou `FAILED` = retraitement autorisé (crash antérieur ou rejeu manuel).
2. **PARSE** au contrat réel (`BookingDomainEventSchema.parse`). Échec = **définitif** : `FAILED` + `lastError`, on rend la main SANS jeter — un message malformé ne bloque jamais la partition (l'outbox Mongo permet le rejeu après correction).
3. **MATÉRIALISATION** par `upsert` sur `[eventId, userId]` : rejouable à l'infini sans doublon, et un événement → N notifications (jamais d'unique sur `eventId` seul — `cancelled` et `completed` notifient les deux parties).
4. **PROCESSED**. Toute erreur transitoire (Mongo down, etc.) n'importe où JETTE → re-livraison → le protocole reprend au point exact où il peut.

L'identifiant d'idempotence est le header **`event-id`** posé par le relay (= `_id` de la row outbox) — la clé voyage de bout en bout.

**Pourquoi `Notification.eventId` est REQUIS** : l'unique composite `[eventId, userId]` ne tolère pas de nullable sur Mongo (leçon §6.5, P2002 sur null — publicSlug). Un futur type de notification hors-événement demandera une réflexion dédiée, pas un contournement.

## 4. La matrice A15 en data — et le cas `targetRole`

`IN_APP_MATRIX` est un `Record<BookingEventKey, RecipientRule>` : SHIPPER, CARRIER, BOTH, NONE (les 3 événements email-only : reçu, remboursement, code régénéré), TARGET_ROLE. Deux bénéfices :

- **Un 18ᵉ événement = une ligne, jamais du code** — même philosophie que la table de transitions de la state machine (A8).
- **tsc est le garde-fou** : le `Record` étant total sur l'union du contrat, un événement ajouté au contrat SANS sa ligne de matrice casse la compilation ici. Volontaire.

`TARGET_ROLE` (rappel de notation J+5/J+7) : le contrat porte `targetRole` — « la partie qui n'a pas encore noté » — et le routeur le suit. La donnée décide, jamais une heuristique.

## 5. La boîte exposée : DTO, erreurs, OAS, gateway

**Whitelist A13** : `toNotificationView` CONSTRUIT chaque champ (id, type, bookingId, payload, readAt, createdAt) — `userId` et `eventId` (plomberie interne) ne sortent JAMAIS ; le parse strict final rejette toute divergence côté serveur. Prouvé par le test d'intrusion `makeLeakyRecord` (pattern makeLeakyBooking, PR3).

**Sémantique A21, dans l'ordre** : 400 (id malformé) → 404 (inexistant) → 403 (pas destinataire). On ne révèle l'existence d'une ressource qu'après l'avoir vérifiée, et « pas à toi » n'est pas « n'existe pas ».

**Marquage lu idempotent** : re-marquer une notification lue ne change pas `readAt` (le premier horodatage fait foi).

**OAS générée (D3, A22)** : les MÊMES schémas Zod valident à l'exécution et génèrent le document. Registre commun assumé : les TROIS `openapi.json` (trip, deal, notification) embarquent les 96 schémas de la plateforme et bougent ensemble — le job CI « Contrats OpenAPI » diffe désormais les trois.

**Gateway** : `/api/me/notifications → :6004/me/notifications`, déclaré AVANT le catch-all auth (`/` → :6001) — sinon la route serait avalée. Vérifiable : `grep -n "6004\|catch-all" apps/api-gateway/src/main.ts` → le bloc 6004 doit précéder la ligne catch-all.

## 6. Les tests : lancer, comprendre, faire évoluer

```bash
npx nx test notification-service   # attendu : 21 tests (17 consumer + 4 mapper), 2 suites
npx nx test deal-service           # attendu : 218 — la non-régression du producteur
npx tsc --noEmit --project apps/notification-service/tsconfig.app.json   # LE verdict de typage
```

Stratégie (miroir du spec relay) : **mocks virtuels** pour `@packages/libs/prisma` et `@packages/messaging` (`{ virtual: true }` — seul `api-contracts` est prouvé résolu par le préset jest) ; **contrat RÉEL** dans les fixtures, verrouillé par le méta-test « sinon tous les tests mentent » ; le routage testé à part avec des événements minimaux castés (on teste la TABLE, pas le parse). Les 17 tests consumer couvrent : matrice complète (17 clés), routes par règle, pipeline nominal aux clés composites exactes, message sans `event-id`, doublon PROCESSED, retraitement PENDING/FAILED, JSON cassé et ZodError → FAILED sans throw, transitoires → throw (claim jamais PROCESSED).

## 7. Procédure de smoke E2E (la preuve de bout en bout)

Prérequis : Docker Desktop allumé (leçon §6.4 — un mur d'ECONNREFUSED = daemon éteint, pas un bug).

```bash
# 1. Infra
docker compose up -d && ./scripts/redpanda-bootstrap.sh

# 2. Producteur (terminal A) et consommateur (terminal B)
npx nx serve deal-service
npx nx serve notification-service      # attendu : "Consumer running", groupId notification-service

# 3. Injection (terminal C)
npx tsx packages/libs/prisma/scripts/seed-outbox.ts     # wipe de ses propres rows, puis 6 événements

# 4. Lecture des journaux
#    A : 6 × "Event published" (5 sur le même aggregateId = le cycle de vie, ordre garanti)
#    B : 6 × "Event materialized" avec recipients 1 ou 2 selon la matrice, ~100 ms après

# 5. Comptage en base (script de contrôle, non commité)
npx tsx packages/libs/prisma/scripts/check-notifications.ts
#    attendu : ConsumedEvent 100 % PROCESSED, zéro FAILED/PENDING résiduel

# 6. Test de re-livraison : couper B (attendre "Consumer disconnected"), relancer,
#    re-compter → totaux INCHANGÉS ; d'éventuels "Duplicate delivery — skipped"
#    sont le claim-first en action.

# 7. La boîte fermée à clé
curl -s localhost:6004/health              # {"status":"ok",...}
curl -s localhost:6004/me/notifications    # {"message":"Unauthorized! Token missing."}
```

Résultat de session : **12/12 PROCESSED, zéro FAILED**. Et une enquête réussie : le total de notifications (12 au lieu des 16 naïfs) a révélé que le booking `gru-completed` du seed est une **auto-expédition** (`shipperId === carrierId`, prouvé : `…c0e7` des deux côtés) — la dédup `[eventId, userId]` a fusionné, comme conçu. La curiosité seed (§7.2 du registre) monte en priorité.

## 8. Faire évoluer

**Ajouter un 18ᵉ événement** : contrat d'abord (schéma + union dans `booking-events.schema.ts`), puis SA ligne dans `IN_APP_MATRIX` (tsc casse tant qu'elle manque), puis `npm run generate:openapi` (les 3 documents bougent), puis le writer. Le wrapper, le claim-first et le mapper ne changent pas.

**Ajouter un consumer (analytics, search…)** : une entrée dans `CONSUMER_GROUPS`, un handler qui suit le protocole claim-first avec SON consumerGroup (la table `ConsumedEvent` est déjà multi-groupes), les 2 entrées de matrice CI. Rien à toucher côté producteur ni côté notification.

**Changer de client Kafka** : réécrire `kafka-publisher.ts` et `kafka-consumer.ts` — les deux seuls fichiers de la plateforme qui importent kafkajs. Zéro service, zéro test à toucher.

**Brancher les emails (B2+)** : chaque writer livrera ses templates ; le handler gagnera un dispatcher de canaux à côté de la matrice in-app — la prise existe, pas les 13 gabarits à vide (A27).

## 9. Ce que cette PR ne fait pas (et où ça se fera)

Les emails de la matrice (avec leurs writers, B2/B3/B4/B5) · le push mobile (G) · l'écran front (PR5+, cible NotificationsPreview) · la migration des notifications trip (A26 : cohabitation ; absorption quand un topic `trip-events` naîtra) · la purge/TTL de `ConsumedEvent` et des vieilles `Notification` (question post-lancement, notée) · la correction du seed auto-expédition (backlog priorisé).

## 10. Les leçons de cette session (gravées, avec leurs incidents)

1. **Un heredoc se termine par `EOF` EXACT en début de ligne** — un espace après (`EOF ␠`) et le shell avale le bloc suivant DANS le fichier (vécu : le controller entier dans le mapper). Discipline adoptée : **UN bloc par collage, `wc -l` immédiat avant le suivant**.
2. **`npx tsx -e` compile en CJS : pas de top-level await** — les one-liners utilisent `.then()` ; les fichiers `.ts` y ont droit.
3. **L'inférence Nx exige le `package.json` d'app** (clé `nx.targets`, workspace `apps/*`) — les plugins seuls ne créent pas le projet ; `nx reset` ne peut pas inventer ce qui manque.
4. **`prisma generate` n'est pas optionnel après un append au schéma** — un client non régénéré = TS2339 sur les nouveaux modèles, découvert deux lots plus loin quand les preuves n'ont pas été collées. Corollaire de méthode : **un « ok, go » sans sorties collées = des commandes non exécutées** ; le rituel des preuves n'est pas décoratif.
5. **tsx ne typecheck pas** : un import inexistant vaut `undefined` et explose loin de sa cause (le crash `_zod` du générateur n'était que l'écho du TS2724). tsc d'abord, toujours.
6. **Le `wc -l` juge le volume, tsc juge la substance** — un fichier au bon compte peut porter un chevron mangé au collage.
7. **`npx run` ≠ `npx nx run`** — le premier installe un paquet tiers inconnu. `npx nx`, toujours.
8. **Les attendus vivent dans le texte, jamais en commentaire inline** — zsh interactif ne traite ni `#` ni `??` comme le script l'espère.

## 11. La suite (pour situer vos contributions)

**PR5** : le front consomme — listes réelles (Mes envois, deals) via `seed-output.json`, et l'écran notifications peut se brancher sur `GET /me/notifications`. **B2** : les writers écrivent les OutboxEvent EN TRANSACTION (prérequis Atlas PROUVÉ cette session via `tx-probe.ts`) — et le flux cesse d'être du seed pour devenir la vie réelle de la plateforme ; les premiers emails de la matrice naissent avec lui. Le mantra ne change pas : **les contrats d'abord, la plomberie ensuite** — cette PR a montré le bénéfice des deux : le consumer a parsé du premier coup des événements gravés trois PRs plus tôt.
