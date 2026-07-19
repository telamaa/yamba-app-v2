# Yamba — PR3 `feat/deal-read-endpoints` : le guide technique complet
### Document technique · comprendre, lancer, vérifier, faire évoluer · Juillet 2026

Ce guide explique tout ce que la PR3 (Pull Request — une proposition de modifications de code, relue puis fusionnée dans la branche commune `dev`) a construit. Il garde le vocabulaire du métier de développeur, mais **chaque terme est expliqué à sa première apparition**. Les documents amont sont `SPECIFICATIONS-WORKFLOW-YAMBA.md`, le registre de décisions (D1–D30 pour les décisions de fond, A1–A22 pour les arbitrages de chantier) et les règles métier v1.2.

---

## 1. La carte du territoire

Le dépôt est un **monorepo Nx** : un seul dépôt git contenant plusieurs applications et bibliothèques, orchestré par l'outil Nx (qui sait construire, tester et servir chaque morceau indépendamment). Les applications vivent dans `apps/`, les bibliothèques partagées dans `packages/libs/`.

Trois décisions d'architecture structurent tout :

**D1 — un service par domaine (microservices).** Un « service » est un petit serveur indépendant, responsable d'un seul domaine métier, joignable sur son **port** (le numéro de porte réseau d'une machine) : `auth-service` (:6001, comptes et connexion), `trip-service` (:6002, les trajets), `deal-service` (:6003, les réservations — le cœur transactionnel de cette PR). Devant eux, l'`api-gateway` (:8080) : un aiguilleur qui reçoit toutes les requêtes du front sur `/api/...` et les **proxifie** (retransmet) vers le bon service. Le front (l'interface Next.js, :3000) ne parle qu'au gateway. Les frontières entre services sont strictes : le trip-service ne connaît des bookings que des comptages, le deal-service lit le Trip en lecture seule pour vérifier une propriété (arbitrage A12) mais n'y écrit jamais.

**D2 — l'outbox et les événements.** Quand un booking changera d'état, le service écrira, dans la **même transaction MongoDB** (un lot d'écritures « tout ou rien » — soit tout est enregistré, soit rien), un document `OutboxEvent` : la trace de ce qui vient de se passer. C'est le **pattern outbox** : plutôt que d'envoyer directement une notification (et risquer de la perdre si l'envoi échoue), on la consigne d'abord dans la base, atomiquement avec le changement lui-même. Un **relay** (relais, PR4) lira ensuite ces traces et les publiera vers **Redpanda/Kafka** (un « journal d'événements » : un système où les messages sont conservés dans l'ordre et peuvent être relus indéfiniment). Des **consumers** (consommateurs abonnés au journal) réagiront : le notification-service en PR4bis, l'analytics plus tard. Prérequis technique : les transactions MongoDB exigent un cluster Atlas en **replica set** (plusieurs copies synchronisées de la base — c'est la configuration par défaut d'Atlas). Conséquence capitale : l'historique complet est capturé dès le premier jour, et tout futur service pourra le **rejouer** rétroactivement.

**D3 — les contrats Zod, source de vérité unique.** **Zod** est une bibliothèque qui décrit la forme des données en TypeScript (« ce champ est une chaîne de 24 caractères hexadécimaux »). Chaque schéma Zod du dossier `packages/libs/api-contracts` sert à trois choses à la fois : **valider** les requêtes à l'exécution (rejeter un `tripId` malformé), **typer** le code (via `z.infer`, TypeScript connaît la forme exacte), et **générer la documentation OpenAPI**. L'**OpenAPI Specification (OAS)** est le format standard de description d'une API : un gros JSON qui liste chaque route, ses paramètres, ses réponses possibles — c'est ce que lisent les outils de documentation et les générateurs de clients mobiles. Un seul objet Zod, trois usages : la doc ne peut pas mentir, elle est générée depuis le même code qui valide.

⚠️ Piège de débutant vécu dans cette session : l'**alias d'import** (le raccourci utilisé dans le code) est `@packages/api-contracts`, mais le chemin disque réel est `packages/libs/api-contracts/src/`. La correspondance est écrite dans `tsconfig.base.json` (section `paths`). Règle absolue : **ne jamais deviner un chemin — le lire** (`grep` dans le tsconfig, `ls` du dossier).

## 2. Démarrer, tester, vérifier — toutes les commandes

**Installer et démarrer** (ordre de démarrage : auth → trip → gateway, + deal) :
```bash
npm ci                          # installe les dépendances exactes du lockfile
npx nx serve auth-service       # :6001  (npx nx = la version locale de Nx, jamais l'install globale)
npx nx serve trip-service       # :6002
npx nx serve deal-service       # :6003
npx nx serve api-gateway        # :8080
```

**Les documentations vivantes** (Scalar, un visualiseur d'OAS chargé depuis un CDN — un serveur public de fichiers — donc zéro dépendance npm) :
`http://localhost:6002/docs` (trips) · `http://localhost:6003/docs` (deals) · le JSON brut sur `/openapi.json` de chaque service.

**Lancer les tests** (Jest, le lanceur de tests — chaque `it(...)` est un cas vérifié automatiquement) :
```bash
npx nx test deal-service        # attendu : 202 tests (188 machine + 14 mapper), 2 suites
npx nx test trip-service        # attendu : 149 tests
```
Rituel maison : on **compte** les tests annoncés, on ne se contente pas de la couleur verte — une suite qui ne se lance pas est verte aussi.

**Vérifier la compilation TypeScript** (le seul verdict qui compte — les soulignés rouges de l'IDE sont ignorés) :
```bash
npx tsc --noEmit --project apps/deal-service/tsconfig.app.json
npx tsc --noEmit --project apps/trip-service/tsconfig.app.json
```
`--noEmit` = vérifier sans produire de fichiers ; `--project` pointe le tsconfig de l'app (sa configuration de compilation).

**Régénérer les OAS commitées** (après TOUTE modification de contrat) :
```bash
npm run generate:openapi        # écrit apps/trip-service/openapi.json ET apps/deal-service/openapi.json
```

**Lancer le seed** (jeu de données de démonstration — §8) :
```bash
# DATABASE_URL doit être présent dans l'environnement (chargez votre .env)
npx tsx packages/libs/prisma/scripts/seed-deals.ts
```
`tsx` exécute directement du TypeScript sans étape de compilation séparée.

**Tester à la main (smoke test — le test « est-ce que ça fume ? », minimal mais réel)** avec `curl` (un client HTTP en ligne de commande) :
```bash
curl -s localhost:6003/health                       # {"status":"ok","service":"deal-service"}
curl -s localhost:8080/api/me/bookings              # sans être connecté → {"message":"Unauthorized! Token missing."}
curl -s "localhost:8080/api/deals?tripId=<id>" \
     -H "Cookie: access_token=<votre JWT>"          # avec un id de seed-output.json
```

## 3. Les contrats livrés (`packages/libs/api-contracts/src/booking/`)

### 3.1 `booking.enums.ts` — vocabulaires et ensembles partagés (A19)

Les **enums** (listes fermées de valeurs possibles) miroirs de Prisma — **Prisma** étant l'ORM du projet, la couche qui traduit les objets TypeScript en documents MongoDB et dont le fichier `schema.prisma` décrit tous les modèles. On y trouve `BookingStatus` (les 9 états), `BookingActor` (qui agit : SHIPPER, CARRIER, SYSTEM, ADMIN), `PricingModel`, `TrackingStep`, `BookingTransitionAction` (les 10 actions de la machine).

Et surtout trois **constantes partagées**, unique source de vérité de la plateforme : `BOOKING_ACTIVE_STATUSES` (les statuts qui conservent les kilos réservés — invariant CAP-02 — et bloquent l'édition d'un trip ; **DISPUTED inclus**), `BOOKING_TERMINAL_STATUSES` (ceux qui libèrent les kilos), et `BOOKING_COMPLETION_BLOCKING_STATUSES` (A20 : les actifs **moins DISPUTED**, car un litige gèle le versement mais n'empêche pas le voyage d'être fini).

Choix motivé : pourquoi ces constantes vivent dans les contrats et pas dans la machine du deal-service ? Parce que le trip-service en a besoin aussi, et qu'un import entre deux dossiers `apps/` est un anti-pattern Nx (couplage entre applications). La machine les **importe et les ré-exporte** — les imports existants (dont les 188 tests) continuent de fonctionner.

**Recette — ajouter un statut** : valeur dans `schema.prisma`, dans `BookingStatusSchema`, classement ACTIF ou TERMINAL (le test S13 vérifie que la partition couvre exactement tous les statuts, sans chevauchement), décision « bloque-t-il la complétion ? », puis `npm run generate:openapi` et les tests.

### 3.2 `booking.schema.ts` — les DTOs par rôle (A13)

Un **DTO** (Data Transfer Object) est la forme exacte des données envoyées au client — distincte du document en base, qui contient des champs qu'on ne veut pas exposer. Principe cardinal ici : **deux vues distinctes selon le rôle**, construites en **liste blanche** (whitelist : on énumère ce qui sort ; tout le reste est bloqué par défaut).

`ShipperBookingView` : pricing complet (dont `totalShipperCents` — tous les montants sont en **centimes entiers**, arbitrage A2, car les nombres à virgule flottante produisent des erreurs d'arrondi sur l'argent), surface du code de livraison, `codeRegenerationsLeft`. `CarrierBookingView` : pricing réduit aux **gains** (`transportCents`), le destinataire (nécessaire pour livrer), `deliveryAttemptsLeft` et `deliveryLockedUntil` — et **aucune trace** du code, de son hash, ou du compteur de régénérations. Les compteurs exposés sont **dérivés** (MAX − utilisé, jamais négatif) : le client ne connaît ni les valeurs brutes ni les plafonds — « le serveur est seul juge ».

Chaque vue embarque `allowedActions` : la liste des actions que la machine d'états autorise pour ce rôle, maintenant. Le front **reflète, ne décide jamais** — impossible qu'un écran propose un bouton que les règles interdisent.

Les sous-objets (`BookingTripSnapshot`, `BookingPricingSnapshot`…) sont des **snapshots** : des photographies figées à la création du deal. Le trip peut changer ensuite, le booking garde sa vérité d'origine (esprit D17).

Convention de langue : les `.meta({ description })` (surface publique, visible dans l'OAS) sont en **anglais** ; les commentaires internes en français.

**Recette — ajouter un champ visible** : (1) modèle Prisma si besoin, (2) schéma Zod de la ou des vues — en se posant explicitement la question « le Carrier doit-il le voir ? », (3) `BookingRecord` + mapper (§5), (4) régénération OAS, (5) si sensible, une assertion dans le spec du mapper. Filet de sécurité : un champ ajouté au contrat mais oublié au mapper = **erreur de compilation** (les vues sont typées par les contrats).

### 3.3 `booking-events.schema.ts` — les 17 événements de domaine (A15)

Un **événement de domaine** est un fait passé, nommé au passé (« booking.accepted »), publié pour que d'autres briques réagissent sans être couplées à celle qui l'émet. Chaque événement porte une **enveloppe** (`aggregateType`, `aggregateId` — l'objet concerné —, `occurredAt`, `correlationId` — un identifiant qui suit une requête de bout en bout à travers tous les services, pour le débogage —, `schemaVersion`) et un **payload** (le contenu utile) volontairement **riche** : le socle commun embarque corridor, catégorie, poids, montants et acteur — pour que l'historique rejoué nourrisse les futurs consommateurs (analytics par destination, recommandation) sans rien retrofitter. Les extras par événement portent le fait spécifique : `reason` sur `declined`, `wasAccepted` sur `cancelled`, `completedBy` sur `completed`…

L'ensemble est exposé en `discriminatedUnion` sur `eventType` : Zod sait, en lisant la clé, quel schéma précis appliquer — c'est le contrat de parsing de tous les consommateurs. Règle de versionnement : un payload publié ne se **mute jamais** ; évolution incompatible = nouvelle version. Règle de sécurité : `booking.picked_up` documente que le code de livraison ne voyage **jamais** dans un événement (ni dans un email).

### 3.4 `index.ts` — le barrel à effet de bord

Un **barrel** est un fichier qui ré-exporte tout un module (un seul point d'entrée). Celui-ci a un effet de bord voulu : l'importer **enregistre** chaque schéma portant `.meta({ id })` dans `z.globalRegistry`, le registre global que la génération OAS sérialise. D'où l'import « nu » (`import "@packages/api-contracts"`) en tête des `build-openapi.ts` : sans lui, zéro schéma dans le document. Arbitrage A22 : le registre est **commun** — les deux specs (trip et deal) embarquent les 93 mêmes schémas. Choix assumé : quelques composants inutilisés dans chaque spec, contre un espace de noms unique pour toute la plateforme.

## 4. Les endpoints (`apps/deal-service/src/`)

Un **endpoint** est une adresse d'API : un verbe HTTP + un chemin (`GET /deals/:id`). Trois endpoints de lecture, tous protégés par le **middleware** `isAuthenticated` (un middleware est une fonction qui s'exécute avant le traitement de la requête — ici, elle vérifie le **JWT**, un jeton signé prouvant l'identité, lu dans le cookie `access_token` ou l'en-tête `Authorization: Bearer`).

`GET /deals/:id` → `{ success, viewerRole, deal }` : la **forme** du deal dépend du rôle de l'appelant dans ce deal précis. `GET /me/bookings` → « Mes envois » (vues Shipper, plus récent d'abord, filtre `?status=`). `GET /deals?tripId=` → les deals d'un trip **appartenant** à l'appelant (vues Carrier) ; la propriété est vérifiée par une lecture Prisma directe et minimale (`select { id, userId, isDeleted }`, A12 — on lit trois champs, pas le document entier).

Sémantique d'erreurs (A21) — un choix de naissance, sans hériter de la dette du trip-service (qui renvoie 400 pour tout, correction prévue) : **400** requête malformée uniquement (`ValidationError` — la validation utilise les **mêmes schémas Zod** que l'OAS, via `safeParse` qui renvoie un résultat au lieu de lever une exception), **401** identité manquante/invalide (le middleware répond directement, format `{ message }`), **403** `ForbiddenError` (identifié mais pas autorisé), **404** `NotFoundError` (inexistant ou soft-deleted — « suppression douce » : le document reste en base avec un marqueur `isDeleted`, pour l'historique), **500** erreur non gérée. Nuance délibérée : « ce deal existe mais vous n'y êtes pas partie » est un **403, pas un 404** — on ne cache pas l'existence, on refuse l'accès.

Le modèle `Booking` n'a volontairement **aucune relation Prisma** (pas de jointure automatique → pas de suppression en cascade accidentelle sur l'historique transactionnel). La contrepartie (prénom, initiale, avatar) est donc chargée par une **jointure explicite** (`loadCounterparts` : un seul `findMany` par requête, ids dédupliqués), avec un `GHOST_COUNTERPART` neutre si le compte a été purgé (**RGPD** — le droit à l'effacement) : un deal reste lisible même si l'autre partie a disparu.

## 5. Le mapper — la frontière de sécurité (`services/booking-view.mapper.ts`)

Le **mapper** est la fonction qui transforme un document de base en DTO. C'est le fichier le plus important de la PR, car c'est LA frontière : tout ce qui sort passe par lui. Il construit chaque vue **champ par champ** — jamais de `{ ...booking }` (le **spread**, qui copie tout) suivi de suppressions : un filtre par soustraction laisse passer par défaut tout champ futur ; une liste blanche bloque par défaut.

Design : le mapper est **pur** (aucun import Prisma ni Express — comme les machines d'états), typé par un `BookingRecord` **structurel** (TypeScript compare les formes, pas les noms de classes : tout objet ayant ces champs convient, donc les documents Prisma passent naturellement et les tests fabriquent des objets nus). Il convertit les `Date` en chaînes **ISO** (le format standard `2026-07-19T10:00:00.000Z`), dérive les compteurs, appelle `getAllowedActions(booking, role)`, applique la privacy des contreparties (initiale du nom seulement).

La preuve : `booking-view.mapper.spec.ts` (un fichier `.spec.ts` est un fichier de tests), 14 tests, dont le test cardinal : `makeLeakyBooking()` **injecte volontairement** un hash bcrypt et un code en clair dans le record d'entrée — exactement ce qu'un document Prisma complet contiendra en B2/B3 — puis vérifie par `JSON.stringify` (la sérialisation intégrale) qu'aucun des deux ne traverse la vue Carrier. Si un refactor futur remplace la construction explicite par un spread, ce test casse immédiatement. C'est un test de **propriété de sécurité**, pas un test de valeur.

## 6. Les machines d'états et le branchement des guards

Une **machine d'états** (state machine) est la table qui dit : depuis quel état, quelle action, par quel acteur, vers quel état — et sous quelles conditions (**guards**, les gardes : des vérifications qui peuvent refuser avec un message). Les deux machines du projet sont pures, testables à nu, à **horloge injectable** (les tests passent une date fixe au lieu de `new Date()` — sinon un test « la demande expire après 24 h » devrait attendre 24 h).

`booking-state-machine.ts` (deal-service) : 9 statuts, 10 actions, **l'acteur fait partie de la transition** (un `cancel` de SHIPPER n'a pas les effets d'un `cancel` de CARRIER), les effets de bord déclarés en data. Seul changement PR3 : les constantes de statuts viennent désormais des contrats (A19).

`trip-state-machine.ts` (trip-service) : la PR3 remplace le **stub** (une fausse implémentation temporaire qui renvoyait toujours `false`) par le réel. Le contexte gagne `hasBookingsInProgress?` (A20), utilisé uniquement par le guard `complete` du **cron** (une tâche planifiée qui tourne toute seule à intervalle régulier — ici, celle qui clôture les trips arrivés) ; `hasActiveBookings` reste le juge de `edit`/`unpublish`. Subtilité : le champ optionnel a un **repli conservateur** (`?? hasActiveBookings`) — un appelant non recâblé retrouve l'ancien comportement (DISPUTED bloquant) plutôt que de clôturer un trip à tort. Principe : sans information, choisir l'erreur la moins grave.

Les requêtes réelles vivent dans `apps/trip-service/src/services/booking-queries.ts` : deux `prisma.booking.count` sur les ensembles partagés. Détail TypeScript qui piège : les constantes sont `readonly`, Prisma veut un tableau mutable → `{ in: [...BOOKING_ACTIVE_STATUSES] }` (le spread crée une copie mutable). Les appelants (controller, cron) exécutent ces requêtes et passent les booléens au contexte : **la machine ne fait jamais de requête elle-même**.

## 7. La chaîne OpenAPI, de Zod au contrôle CI

La chaîne complète : schémas Zod avec `.meta({ id })` → registre global à l'import du barrel → `buildOpenApiDocument()` (`apps/deal-service/src/openapi/build-openapi.ts`, pattern répliqué du trip : `z.toJSONSchema(z.globalRegistry, ...)`, nettoyage des champs `$id`/`$schema` qui font du bruit dans les générateurs de clients, puis les `paths` écrits à la main avec des `$ref` — des pointeurs vers les composants) → servi **vivant** sur `/openapi.json` et visualisé sur `/docs` → **écrit sur disque et commité** (`apps/deal-service/openapi.json`, 7657 lignes, l'artefact que consommeront les générateurs de clients mobiles) par `npm run generate:openapi` — le script racine est désormais une boucle `TARGETS`, chaque futur service ajoutera sa ligne → **gardé par la CI**.

La **CI** (Continuous Integration — les vérifications automatiques que GitHub lance sur chaque PR) compte ici 11 **checks** ; celui qui nous concerne, « Contrats OpenAPI », régénère les documents et fait `git diff --exit-code` sur les deux fichiers : s'ils diffèrent de ce qui est commité, le check échoue avec le message d'action.

**Recette — le check « Contrats OpenAPI » est rouge** : vous avez modifié un contrat sans régénérer. `npm run generate:openapi`, vérifier le diff (les **deux** fichiers peuvent bouger ensemble — registre commun A22, c'est normal), commiter. **Recette — ajouter un endpoint** : schémas requête/réponse dans les contrats → handler dans le controller (validé par ces mêmes schémas) → route → entrée `paths` dans `build-openapi.ts` avec les bons codes d'erreur → régénération → tests.

## 8. Le code de livraison : ce qui existe, ce qui manque

En base : `deliveryCodeHash` en **bcrypt** — une fonction de hachage à sens unique : on peut vérifier qu'une saisie correspond, on ne peut **pas** retrouver le code depuis le hash. Il servira à valider la saisie du Voyageur en B3. Problème résolu par l'arbitrage A13/option A : l'Expéditeur doit pouvoir **ré-afficher** son code (l'UX validée), or bcrypt est irréversible → B2 ajoutera `deliveryCodeEncrypted` en **AES-256-GCM** (un chiffrement réversible avec une clé serveur : la base seule, sans la clé, ne révèle rien). En attendant, `ShipperBookingView.deliveryCode` vaut `null`, documenté dans le contrat : la surface est prête, le stockage arrive. Le seed laisse les hashes à `null` (rien ne les lit en B1) plutôt que de fabriquer de fausses paires code/hash qui mentiraient.

## 9. Le seed international (`packages/libs/prisma/scripts/seed-deals.ts`)

Un **seed** est un script qui remplit la base de données de démonstration réalistes. Celui-ci crée 12 users, 7 trips, 20 bookings sur 6 corridors, tous les états représentés, les deux moteurs de pricing, des fuseaux à offsets négatifs (Montréal) et +7 h (Hô Chi Minh-Ville) — les fuseaux exotiques débusquent les bugs de dates. Le corridor Paris→Brazzaville est doublé : un trip à J+10 (états pré-départ) et un parti à J−6 (picked/delivered/disputed/completed), pour des dates plausibles.

Trois mécanismes à comprendre :

**Idempotence hybride.** **Idempotent** = relançable sans dégât : deux exécutions donnent le même résultat qu'une. Les users sont **upsertés** (update-or-insert : mis à jour s'ils existent, créés sinon) par `emailNormalized` (champ `@unique`) → leurs ids restent **stables** entre les runs. Les trips/bookings sont en **wipe & recreate** (on supprime le périmètre du seed, on recrée) → ids **neufs** à chaque run, republiés dans `seed-output.json` (gitignoré — exclu de git car il change à chaque exécution). Ce fichier est le successeur des « magic IDs » du mock front : la PR5 le consommera.

**Invariant CAP-02 calculé.** Le `reservedKg` de chaque trip = somme des poids des bookings actifs, **calculée par le script** et imprimée au run pour contrôle visuel — jamais posée à la main. Un invariant qu'on saisit manuellement finit toujours par être faux.

**Le piège Mongo du unique nullable** (vécu au premier run) : `publicSlug String? @unique` — sur MongoDB, deux documents à `null` **collisionnent** sur l'index unique (erreur P2002). Solution : un slug déterministe `seed-<key>` par user. Règle générale : tout champ `@unique` optionnel doit recevoir une valeur déterministe dans un seed.

**Recette — ajouter un corridor** : un carrier dans `USERS`, un trip dans `TRIPS` (fuseaux **IANA** canoniques — la nomenclature standard des fuseaux : `America/Toronto`, pas l'alias déprécié `America/Montreal`), des bookings dans `BOOKINGS` avec des jalons cohérents avec le statut. Le `reservedKg` se recalcule tout seul.

## 10. Les rituels de vérification — et les incidents qui les justifient

Chaque livraison de cette PR a suivi le même rituel, et chacun a payé en direct : `wc -l` avec **attendus comptés à l'avance** (a détecté un fichier non collé — l'erreur de compilation qui a suivi n'en était que la conséquence) ; `npx tsc --noEmit --project ...` comme seul verdict ; tests **comptés** (202, 149), pas « verts » ; `git status --short` avant tout `git add` (un `git add` sans chemin ne stage **rien** — vu en direct : le commit est parti à vide) ; `git log --oneline -1` après chaque commit ; `git ls-files | grep -iE "\.env|secret"` avant tout push (le réflexe anti-fuite de secrets) ; et la leçon durcie de la session : **jamais de chemin affirmé sans preuve** — `tsconfig.base.json` et `ls` font foi, et se lisent **avant** d'écrire.

## 11. La suite (pour situer vos contributions)

PR4 : le relay outbox → Redpanda (le producteur). PR4bis : le **notification-service** (:6004), consumer des 17 événements — modèle `Notification`, `GET /me/notifications`, emails **Nodemailer** (la bibliothèque d'envoi d'emails du projet) + templates **EJS** (des gabarits HTML à trous), à articuler avec les services de notification trip existants (`apps/trip-service/src/services/trip-notifications.service.ts`). B2 : les écritures (demande/acceptation/refus) avec **Stripe Connect** (le système de paiement : séquestre, remboursements, versements), les champs différés (`cancelReason`, `pickupRefusalReason`, `deliveryCodeEncrypted`, correction du `commissionRate` 0.10→0.15 dans SiteConfig), le payment-service (:6008) et le media-service (:6009, uploads **R2** — le stockage de fichiers Cloudflare). B3 : pickup, code, livraison, tracking. B4 : litiges, versements, admin-service (:6006). Ports réservés ensuite : 6005 chatting, 6007 recommendation, 6010 search, 6011 analytics.

Le mantra qui résume tout : **les contrats d'abord** (ils sont irréversibles — un payload pauvre publié, c'est de la donnée perdue à jamais), **la plomberie ensuite** (elle est remplaçable).
