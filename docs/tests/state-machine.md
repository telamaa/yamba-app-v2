# Yamba — Guide des tests de la trip state machine

> Public : dev junior rejoignant le projet. Objectif : comprendre POURQUOI ces tests existent, COMMENT ils sont construits, et comment les faire évoluer sans casser le contrat qu'ils protègent.
> Fichiers concernés : `apps/trip-service/src/services/trip-state-machine.ts` (le code) et `trip-state-machine.spec.ts` (les tests, 146 cas).

---

## 1. Le contexte métier : pourquoi une state machine, pourquoi la tester

### 1.1 Le problème métier

Un trajet (Trip) sur Yamba a un cycle de vie : un Yamber crée un brouillon (DRAFT), le publie (PUBLISHED), peut le mettre en pause (PAUSED), l'annuler (CANCELLED), etc. Chaque changement d'état a des conséquences réelles :

- **Argent** : un trip publié peut recevoir des réservations payées. Annuler un trip réservé déclenchera des remboursements Stripe (au chantier Booking).
- **Confiance** : les compteurs du profil carrier (`totalTripsPublished`, `totalTripsCancelled`) alimentent la réputation visible. Un compteur faux = un profil qui ment aux expéditeurs.
- **Visibilité** : seuls les trips PUBLISHED apparaissent dans la recherche publique. Une transition mal gérée = un trip fantôme visible ou un trip légitime invisible.

Avant la state machine, chaque endpoint faisait ses propres vérifications ad hoc ("si le statut est CANCELLED, refuser"). Résultat : des incohérences. L'exemple qui a motivé le refactoring : le chemin **publish → pause → cancel** ne décrémentait pas `totalTripsPublished`, parce que le code de cancel ne regardait que le statut courant (PAUSED) et pas la transition. Le compteur du carrier gonflait artificiellement.

### 1.2 La solution : une source de vérité unique

`trip-state-machine.ts` centralise TOUTES les règles du cycle de vie dans une table (`TRANSITIONS`) et trois fonctions :

- **`canPerform(trip, action, ctx)`** : "cette action est-elle légale ici et maintenant ?" Retourne soit `{allowed: true, to: <statut cible>}`, soit `{allowed: false, reason: <message>}`. Les controllers ne décident plus rien — ils demandent à la machine.
- **`getAllowedActions(trip, ctx)`** : la liste des actions légales, renvoyée dans les DTOs (`GET /trips/my`, `GET /trips/:id`). Le frontend affiche exactement les boutons que l'API acceptera — il ne duplique jamais la logique.
- **`getCarrierStatDeltas(from, to)`** : les compteurs à appliquer sur une TRANSITION (pas sur un statut). C'est ce qui corrige le bug PAUSED décrit plus haut.

Point de design crucial : la machine a **zéro dépendance** (ni Prisma, ni Express, ni horloge système imposée). C'est ce qui la rend testable unitairement — on peut l'exécuter des milliers de fois par seconde avec des données fabriquées, sans base de données.

### 1.3 Pourquoi 146 tests (décision D30)

La décision D30 du registre impose : tests unitaires sur la logique pure dès B1, dans la même PR que le code (Definition of Done). La state machine existait AVANT D30, d'où ce "rétrofit" (PR `test/trip-state-machine`). L'enjeu : le chantier Deal lifecycle (B1-B5) va brancher les réservations sur cette machine. Sans filet de tests, chaque modification risquerait de casser silencieusement une règle métier — et ici, "silencieusement" veut dire des remboursements ratés ou des compteurs faux en production.

---

## 2. L'architecture technique des tests

### 2.1 Les fichiers et leur rôle

| Fichier | Rôle |
|---|---|
| `apps/trip-service/jest.config.ts` | Config Jest du service. Sa simple existence fait que le plugin `@nx/jest` (déclaré dans `nx.json`) infère automatiquement la target `test` — aucune déclaration manuelle dans project.json. |
| `apps/trip-service/tsconfig.spec.json` | Le "projet TypeScript" des tests : mêmes `rootDir`/`include` que `tsconfig.app.json` + `types: ["jest"]` (pour que `describe`/`it`/`expect` soient connus) + `esModuleInterop` explicite. |
| `apps/trip-service/tsconfig.app.json` | Le projet de PROD. Il **exclut** `src/**/*.spec.ts` : le typecheck CI de production ne doit jamais voir les tests. |
| `src/services/trip-state-machine.spec.ts` | Les 146 tests. Vit à CÔTÉ du fichier testé (convention : `X.ts` → `X.spec.ts` dans le même dossier). |

Pourquoi deux tsconfig ? Parce que prod et tests ont des besoins contradictoires : la prod ne doit pas connaître les globals Jest (sinon un `describe` oublié dans du code métier compilerait), les tests doivent les connaître. Deux projets, deux mondes, un radar chacun.

### 2.2 Commandes essentielles

```bash
# Lancer tous les tests du service
npx nx test @yamba-app/trip-service

# Un seul fichier (plus rapide en développement)
npx nx test @yamba-app/trip-service --testFile=trip-state-machine.spec.ts

# Mode watch : relance à chaque sauvegarde (le réflexe en TDD)
npx nx test @yamba-app/trip-service --watch

# Vérifier que le projet de test compile (ce que voit l'IDE)
npx tsc --noEmit --project apps/trip-service/tsconfig.spec.json

# Vérifier que la prod ne voit AUCUN spec (doit renvoyer 0)
npx tsc --noEmit --project apps/trip-service/tsconfig.app.json --listFilesOnly | grep -c "spec.ts"
```

En CI, le job `Tests unitaires (trip-service)` exécute `npx nx test @yamba-app/trip-service --ci` sur chaque PR. Il est dans les required checks : une PR avec un test rouge ne peut pas merger.

### 2.3 Les trois outils du spec à connaître

**Les fixtures figées.** En tête du spec :

```typescript
const NOW = new Date("2026-07-20T12:00:00.000Z");
const FUTURE = new Date("2026-08-01T10:00:00.000Z");
const PAST = new Date("2026-07-01T10:00:00.000Z");
```

JAMAIS de `new Date()` dans un cas de test. Un test qui dépend de l'heure réelle passe aujourd'hui et échoue dans six mois (quand FUTURE sera devenu le passé) — c'est un test "flaky", le pire ennemi d'une CI. La machine accepte une horloge injectée (`ctx.now`) précisément pour ça : on lui dit "fais comme s'il était NOW" et le test devient déterministe pour l'éternité.

**Les factories `makeTrip()` et `ctx()`.** Elles fabriquent un trip/contexte par défaut valide, et chaque test n'exprime QUE ce qui le distingue :

```typescript
makeTrip({ status: "PUBLISHED", departureAt: PAST })
// = un trip publié dont le départ est passé, tout le reste aux défauts sains
```

Bénéfice : si demain `TripLike` gagne un champ obligatoire, on l'ajoute UNE fois dans la factory au lieu de corriger 146 tests.

**Les tests table-driven.** Le gros du spec est une boucle sur une table `MATRIX` qui déclare, pour chacune des 13 actions, ses statuts légaux et son statut cible. La boucle génère 78 tests (13 actions × 6 statuts). C'est le point le plus important à comprendre : **cette table est le miroir exécutable de la table `TRANSITIONS` de la machine**. Si quelqu'un modifie TRANSITIONS sans modifier MATRIX, des tests rougissent — c'est voulu. Le rouge dit : "tu as changé une règle métier, viens le graver ici consciemment ou reviens en arrière."

### 2.4 Ce que couvrent les blocs, et le raisonnement derrière chacun

1. **Matrice from × action** — la légalité brute par statut. Cas particulier : `complete` a des guards actifs même en contexte neutre, donc pour lui la matrice vérifie seulement que le REFUS ne vient PAS du statut (le message ne contient pas "is not allowed from status") — ses guards ont leur bloc dédié.

2. **Soft-deleted** — un trip `isDeleted: true` refuse TOUTES les actions avec "Trip not found.", y compris `view`. Métier : un trip supprimé ne doit même pas révéler son existence.

3. **Guards de date** (`publish`/`resume`/`restore`) — on ne remet pas en circulation un trajet dont le départ est passé. Trois subtilités gravées exprès :
  - *frontière stricte* : un départ exactement à `now` est autorisé (`dep < now`, pas `<=`) ;
  - *departureAt absent* : autorisé (un brouillon incomplet doit pouvoir être publié — c'est le gate de publication du controller qui exigera la date, pas la machine) ;
  - *string de date invalide* : traitée comme absente → autorisé. Ce n'est pas forcément le comportement "idéal", mais c'est le comportement RÉEL, et le test le grave. Si on décide un jour de le durcir, ce test rougira et forcera la discussion.

4. **Guards booking** — les décisions métier les plus sensibles, chacune avec sa justification dans le NOM du test :
  - `edit` refusé sur PUBLISHED/PAUSED avec réservations ("pattern BlaBlaCar strict : trajet réservé = intouchable") mais autorisé sur DRAFT ;
  - `unpublish` refusé avec réservations (un expéditeur a payé pour un trajet qui existe, on ne le fait pas disparaître) ;
  - `pause` et `cancel` AUTORISÉS avec réservations (pause = juste masquer de la recherche ; cancel = légitime, mais déclenchera des remboursements au chantier Booking).

5. **`complete` v2** — action réservée au cron (jamais un endpoint user). Le cas critique : le *fallback sur departureAt quand arrivalAt est absent*. Historique : `publishTrip` n'exige que la date de départ, donc un trip publié sans date d'arrivée ne se serait JAMAIS terminé via le cron — c'est le fix "v2" et son test empêche toute régression.

6. **`getAllowedActions`** — un snapshot des actions par statut, ET la règle absolue : `complete` n'est jamais exposé au front, même quand la transition serait légale.

7. **`getCarrierStatDeltas`** — le test vedette est en premier : `PAUSED → CANCELLED` doit produire `decrement + totalTripsCancelled`. C'est LE bug d'origine ; ce test est sa pierre tombale.

---

## 3. Faire évoluer les tests : les scénarios que tu vas rencontrer

### Scénario A — Un test rougit après ta modification de la machine

C'est le fonctionnement NORMAL, pas un problème. Démarche :

1. Lis le nom du test rouge : il contient la règle métier violée.
2. Demande-toi : "ai-je VOULU changer cette règle ?"
  - **Non** → ton code a une régression, corrige la machine.
  - **Oui** → mets à jour le test (MATRIX et/ou le bloc concerné) pour graver la NOUVELLE règle, et documente le changement dans le message de commit. Si la règle est une décision produit, elle doit aussi être actée au registre des décisions avant de merger.
3. Ne supprime JAMAIS un test rouge "pour faire passer la CI" sans comprendre ce qu'il protégeait.

### Scénario B — Ajouter une action à la machine (ex: "boost")

1. Ajoute l'action dans `TRANSITIONS` (from, to, guard éventuel) et dans le type `TripAction`.
2. Dans le spec, ajoute UNE ligne à `MATRIX` : `{ action: "boost", legalFrom: [...], to: ... }`. La boucle génère automatiquement les 6 tests de statut.
3. Si l'action a un guard, ajoute un bloc `describe` dédié (modèle : les blocs date ou booking existants), avec l'horloge/contexte injectés.
4. Mets à jour les snapshots de `getAllowedActions` pour les statuts où l'action apparaît.
5. Si l'action change le statut vers/depuis le pool public {PUBLISHED, PAUSED}, ajoute les cas `getCarrierStatDeltas`.
6. `npx nx test ... --watch` pendant tout le développement, puis les deux tsc de vérification.

### Scénario C — Le chantier Booking arrive (le prochain gros impact)

`hasActiveBookings` est aujourd'hui un stub qui retourne `false`. Au chantier Deal lifecycle, son corps sera remplacé par une vraie requête Prisma (count des bookings non terminaux). Conséquences pour les tests :

- Les tests de la MACHINE ne bougent pas : ils injectent déjà `ctx.hasActiveBookings` à la main (true/false), indépendamment de qui le calcule. C'est le bénéfice de l'injection de contexte.
- Le test du stub (`retourne toujours false...`) devra être REMPLACÉ par un test d'intégration de la vraie requête (supertest + mongodb-memory-server, comme prévu en D30 pour les endpoints critiques). Ce sera un fichier séparé — la machine reste testée unitairement, la requête Prisma s'intègre à part.
- Attention à `BOOKING_TERMINAL_STATUSES` : quand cette constante existera, écrire des tests qui gravent quels statuts de booking sont "terminaux" (même logique de miroir exécutable que MATRIX).

### Scénario D — Écrire des tests pour un NOUVEAU module (ex: deal-state-machine)

Réutilise la recette complète, dans cet ordre :

1. **Écris le module en logique pure** : pas d'import Prisma/Express dans le fichier de logique, horloge et données injectables. Si tu ne peux pas tester sans base de données, c'est un signal que la logique et l'accès aux données sont mélangés — sépare-les d'abord.
2. Copie la structure du spec : fixtures de dates figées, factories, table MATRIX si le module a une table de règles.
3. Grave les décisions métier dans les NOMS des tests (avec leur justification entre parenthèses) — le spec sert aussi de documentation vivante.
4. Grave les comportements limites même imparfaits (le cas "string invalide" ci-dessus) : un comportement non testé est un comportement qui changera par accident.
5. Même PR que le code (DoD D30), infra si besoin : si le service n'a pas encore de jest.config.ts, réplique les 3 fichiers d'infra de trip-service en adaptant les chemins.

### Les pièges connus (payés une fois, à ne pas repayer)

- **tsconfig.spec.json doit répliquer la géométrie de tsconfig.app.json** (`rootDir: "../../"` + include des `packages/**`) : sans ça, TS6059/TS6307 en cascade dès qu'un fichier importé touche `@packages/*`.
- **Re-déclarer `esModuleInterop: true` dès qu'on override `module`** dans un tsconfig enfant : sinon les imports default (`express`, `cors`, `jwt`) rougissent (TS1259/TS1192) alors qu'ils passaient dans le projet app.
- **Après tout changement de tsconfig, re-vérifier le radar** : `--listFilesOnly | grep -c src` doit rester au même compte côté app (22 fichiers aujourd'hui), et `grep -c "spec.ts"` doit rester à 0 côté app. Un tsc "vert" qui ne vérifie rien est pire qu'un tsc rouge.
- **Jamais de `new Date()` nu dans un cas de test** — toujours les fixtures + `ctx.now`.
- **`tail -N` sur la sortie nx peut avaler le résumé Jest** (le bruit Nx Cloud passe après) : pour vérifier le compte, `| grep -E "Tests:|Suites:"`.

---

## 4. En une phrase

La table TRANSITIONS est le contrat métier du cycle de vie des trips ; le spec en est la copie exécutable ; toute divergence entre les deux est soit un bug, soit une décision produit à graver consciemment — et jamais un test à supprimer pour faire passer la CI.
