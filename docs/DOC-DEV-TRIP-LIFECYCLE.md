# 📘 Documentation développeur — Trip Lifecycle (State Machine)

> **Public visé** : tout développeur rejoignant le projet Yamba, y compris junior.
> **Périmètre** : chantier "Trip lifecycle hardening" — cycle de vie des trajets côté `trip-service`.
> **Document jumeau** : `DOC-METIER-TRIP-LIFECYCLE.md` (règles métier, workflow, règles de gestion).

---

## 1. Vue d'ensemble

Un **Trip** (trajet publié par un Yamber) passe par plusieurs états au cours de sa vie : brouillon, publié, en pause, terminé, annulé, archivé. Avant ce chantier, chaque endpoint vérifiait lui-même si l'action était permise avec des `if` dispersés — ce qui a produit des bugs réels (suppression fantôme, statistiques fausses, faille de sécurité).

Ce chantier centralise **toute la logique de transition** dans un seul module : la **state machine** (`trip-state-machine.ts`). Les endpoints ne décident plus rien — ils demandent à la machine.

```
┌──────────────┐     canPerform(trip, action, ctx)     ┌──────────────────────┐
│ trip.controller ├──────────────────────────────────────▶│ trip-state-machine   │
│  (Express)   │◀──────────────────────────────────────┤  (zéro dépendance)   │
└──────────────┘   { allowed: true, to: "PUBLISHED" }   └──────────────────────┘
        │              ou { allowed: false, reason }
        ▼
   prisma.trip.update(...)
```

**Règle d'or** : le frontend (`my-trips.config.ts`) ne fait que *refléter* ce que la machine autorise. Si les deux divergent, c'est la machine qui a raison — et c'est le front qu'on corrige.

---

## 2. Les fichiers du chantier

| Fichier | Rôle |
|---|---|
| `apps/trip-service/src/services/trip-state-machine.ts` | ⭐ Cœur : transitions, guards, actions autorisées, deltas de stats |
| `apps/trip-service/src/controllers/trip.controller.ts` | Endpoints Express — appellent la machine avant chaque écriture |
| `apps/trip-service/src/routes/trip.router.ts` | Déclaration des routes (`/cancel` et `/archive` ajoutés) |
| `apps/trip-service/src/cron/complete-trips.cron.ts` | Job quotidien qui termine les trajets dont le voyage est fini |
| `apps/trip-service/src/main.ts` | Démarre le cron après `app.listen` |
| `packages/libs/prisma/schema.prisma` | Champs `isDeleted`, `deletedAt` + index `[userId, isDeleted]` sur Trip |
| `apps/user-ui/src/components/trips/list/my-trips.mutations.ts` | Hooks React Query, dont `useArchiveTrip` |
| `apps/user-ui/src/components/trips/list/my-trips.config.ts` | Miroir frontend des actions par statut (affichage uniquement) |

---

## 3. Les notions à comprendre

### 3.1 State machine (machine à états)

Une machine à états définit :
- un ensemble d'**états** possibles (ici : les 6 valeurs de `TripStatus`),
- des **transitions** autorisées entre ces états (ex. `DRAFT → PUBLISHED` via l'action `publish`),
- des **guards** : des conditions supplémentaires qui peuvent bloquer une transition pourtant "légale" au niveau des statuts.

Tout ce qui n'est pas explicitement autorisé est **interdit**. Exemple : il n'existe aucune transition `COMPLETED → DRAFT`, donc un trajet terminé ne peut jamais redevenir un brouillon, quel que soit le code qui essaie.

Concrètement, la machine est une simple map :

```ts
const TRANSITIONS: Record<TripAction, TransitionDef> = {
  publish: {
    from: ["DRAFT"],          // états de départ légaux
    to: "PUBLISHED",          // état d'arrivée
    guard: notPastDeparture,  // condition supplémentaire
  },
  // ...
};
```

### 3.2 Guard (garde)

Une fonction qui reçoit le trip + un contexte et retourne :
- `null` → la transition passe,
- un `string` → la transition est refusée, et ce string devient le message d'erreur renvoyé à l'utilisateur (via `ValidationError`).

Exemple : `notPastDeparture` refuse de publier/reprendre un trajet dont la date de départ est passée.

### 3.3 Contexte lifecycle (`TripLifecycleContext`)

Certaines règles dépendent de données extérieures au trip lui-même. Le contexte les transporte :

```ts
type TripLifecycleContext = {
  hasActiveBookings: boolean; // le trip a-t-il des réservations en cours ?
  now?: Date;                 // horloge injectable (pour les tests)
};
```

**Point important** : `hasActiveBookings` est aujourd'hui un **stub** (une fonction qui retourne toujours `false`) car le modèle `Booking` n'existe pas encore. Quand il existera, on remplacera **uniquement le corps du stub** dans `trip-state-machine.ts` par une vraie requête Prisma — aucun autre fichier ne bougera. C'est un exemple de *point de branchement unique* : on prépare une dépendance future sans la coder.

### 3.4 Horloge injectable (`now`)

Les guards de dates ne font jamais `new Date()` directement en dur : ils lisent `ctx.now`. Ça permet de tester "que se passe-t-il le 20 août ?" sans changer l'horloge de sa machine :

```ts
canPerform(trip, "resume", { hasActiveBookings: false, now: new Date("2026-08-20") });
```

### 3.5 Soft delete vs hard delete

- **Hard delete** : `prisma.trip.delete(...)` — la ligne disparaît de la base. Irréversible, casse les références (documents, messages, liens partagés).
- **Soft delete** : on pose `isDeleted: true` + `deletedAt: <date>` et **toutes les lectures filtrent** `isDeleted: false`. Le trip devient invisible mais les données restent cohérentes et auditables.

Chez Yamba, la suppression d'un brouillon est un soft delete. Conséquence pratique pour tout nouveau code : **toute requête de lecture sur Trip doit inclure le filtre `isDeleted: false`** (ou passer par les fonctions existantes qui le font). Un trip soft-deleted est traité comme *inexistant* — on renvoie "Trip not found.", jamais "ce trip est supprimé" (on ne révèle pas son existence).

> ℹ️ MongoDB + Prisma : les documents créés *avant* l'ajout du champ n'ont pas `isDeleted` en base. Le `@default(false)` du schéma fait que Prisma les traite comme `false` — le filtre `{ isDeleted: false }` les matche bien. Aucun script de migration nécessaire.

### 3.6 Pool public et deltas de stats

Le compteur `CarrierPage.totalTripsPublished` doit refléter les trajets *visibles ou en pause* — ce qu'on appelle le **pool public** = `{ PUBLISHED, PAUSED }`.

L'ancien code incrémentait/décrémentait en regardant le **statut courant**, ce qui créait un bug : `publish (+1) → pause → cancel` ne décrémentait jamais (au moment du cancel, le statut était PAUSED, pas PUBLISHED).

Le nouveau code calcule les deltas sur la **transition** `(from → to)` :

```ts
entersPublicPool(from, to)  // hors pool → dans le pool  ⇒ +1
leavesPublicPool(from, to)  // dans le pool → hors pool  ⇒ -1
```

`getCarrierStatDeltas(from, to)` retourne directement l'objet à passer à `prisma.carrierPage.update` (ou `null` si rien à faire). **Ne recodez jamais un `increment`/`decrement` de stats à la main dans un endpoint** — passez par cette fonction.

### 3.7 `allowedActions` dans les DTOs

`getTrip` et `getMyTrips` renvoient maintenant, pour chaque trip, un tableau `allowedActions` calculé par `getAllowedActions(trip, ctx)`. Objectif : à terme, le frontend affichera exactement ces actions au lieu de recalculer la logique dans `my-trips.config.ts`. Aujourd'hui les deux coexistent (le front n'a pas encore été branché sur le DTO).

### 3.8 Alias backward-compat sur `DELETE /trips/:id`

Historiquement, `DELETE /trips/:id` servait à *annuler*. On ne casse pas les clients existants : la route est conservée et **dispatche** selon le query param :

- `DELETE /trips/:id?hard=true` → soft delete (brouillons uniquement),
- `DELETE /trips/:id` (sans param) → alias de cancel.

Le "vrai" endpoint d'annulation est désormais `POST /trips/:id/cancel`. Même philosophie que `resolveSectionKey` côté dashboard : on ajoute le chemin propre, on garde l'ancien en alias.

### 3.9 Cron (tâche planifiée)

`complete-trips.cron.ts` utilise `node-cron` avec l'expression `15 3 * * *` (tous les jours à 03h15, heure serveur). La logique est isolée dans `runCompleteTripsOnce(now?)`, exportée séparément — c'est elle qu'on teste, jamais le scheduler lui-même. Le démarrage (`startCompleteTripsCron`) est **idempotent** : un flag interne empêche un double enregistrement en cas de hot-reload.

---

## 4. Parcours d'une requête (exemple complet)

Prenons `POST /trips/:id/pause` :

1. **Router** (`trip.router.ts`) : la route passe par le middleware `isAuthenticated` qui pose `req.user`.
2. **Controller** (`pauseTrip`) :
   - `findOwnedTrip(id, userId)` → vérifie que le trip existe, n'est pas soft-deleted, et appartient bien à l'utilisateur. Sinon → `ValidationError`.
   - `buildLifecycleCtx(trip.id)` → construit le contexte (booking stub).
   - `canPerform(trip, "pause", ctx)` → la machine vérifie `from: ["PUBLISHED"]` + guards. Si refus → `ValidationError(check.reason)`.
   - `prisma.trip.update({ status: "PAUSED" })`.
   - Deltas de stats : `PUBLISHED → PAUSED` reste dans le pool public → `getCarrierStatDeltas` retourne `null`, rien à faire.
3. **Réponse** : `{ success: true, message: "Trip paused." }`.

Tous les endpoints lifecycle suivent exactement ce squelette. Pour en ajouter un, copiez-le.

---

## 5. Guide : ajouter une action ou un statut

### Ajouter une action (ex. futur `feature`)

1. Ajouter la clé dans le type `TripTransitionAction` (ou `TripReadAction`).
2. Ajouter l'entrée dans `TRANSITIONS` : `from`, `to`, `guard` éventuel.
3. Créer le handler dans `trip.controller.ts` en copiant le squelette du §4.
4. Déclarer la route dans `trip.router.ts`.
5. Si la transition entre/sort du pool public, **rien à faire** côté stats : `getCarrierStatDeltas` le gère automatiquement.
6. Côté front : ajouter la mutation dans `my-trips.mutations.ts` et l'entrée dans `getActionsForStatus`.
7. `npx tsc --noEmit` sur les deux projets.

### Ajouter un statut

Beaucoup plus lourd — à valider en architecture d'abord. Il faut toucher : l'enum Prisma `TripStatus`, le type de la machine, chaque `from` concerné, `PUBLIC_POOL` si pertinent, le `STATUS_CONFIG` frontend, et vérifier tous les `includes(status)` du front.

---

## 6. Tester — en détail

### 6.0 Prérequis

```bash
# Dépendances du cron
npm install node-cron
npm install -D @types/node-cron

# Client Prisma à jour (OBLIGATOIRE après toute modif du schéma)
npx prisma generate --schema=packages/libs/prisma/schema.prisma
npx prisma db push --schema=packages/libs/prisma/schema.prisma
```

**Ritual de vérification systématique** (avant tout test fonctionnel) :

```bash
# 1. Anti-fichier-vide après collage
wc -l apps/trip-service/src/services/trip-state-machine.ts   # ~350 lignes attendues
wc -l apps/trip-service/src/cron/complete-trips.cron.ts       # ~160

# 2. Compilation — SEULE source de vérité (ignorer les erreurs IDE)
npx tsc --noEmit --project apps/trip-service
npx tsc --noEmit --project apps/user-ui
```

**Ordre de démarrage des services** : `auth-service` (6001) → `trip-service` (6002) → `api-gateway` (8080). Le front appelle toujours le gateway (8080).

### 6.1 Obtenir un token pour les tests API

Connectez-vous via le front (`http://localhost:3000`) puis récupérez le cookie/access token, **ou** appelez directement :

```bash
curl -s -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"votre@email.test","password":"..."}' 
```

Dans les exemples suivants, `$TOKEN` désigne l'access token et `$TRIP` l'id d'un trip (24 caractères hexadécimaux).

### 6.2 Scénario 1 — Le soft delete des brouillons (le bug corrigé)

**Contexte** : avant ce chantier, "Supprimer le brouillon" passait le trip en CANCELLED → il réapparaissait dans l'Historique comme un trajet "Annulé". C'était un mensonge à l'utilisateur.

1. Créer un brouillon via le wizard front (ou `POST /trips` sans `publish`).
2. Vérifier qu'il apparaît dans **Mes trajets → À finaliser**.
3. Menu ⋮ → **Supprimer** → confirmer.
4. ✅ **Attendu** : toast "Brouillon supprimé", le trip disparaît de *toutes* les sections, **y compris Historique**. Recharger la page : toujours absent.
5. Vérification base (mongosh ou Compass) : le document existe encore avec `isDeleted: true`, `deletedAt` renseigné, `status: "DRAFT"` inchangé.
6. Vérification API : `GET /trips/$TRIP` avec le token du propriétaire → `"Trip not found."` (un trip supprimé est *inexistant*, même pour son propriétaire).

**Contre-test** : tenter le soft delete sur un trip PUBLISHED :

```bash
curl -s -X DELETE "http://localhost:8080/api/trips/$TRIP?hard=true" \
  -H "Authorization: Bearer $TOKEN"
```

✅ Attendu : erreur `Action "delete" is not allowed from status PUBLISHED.` — le message vient directement de la machine.

### 6.3 Scénario 2 — Le fix sécurité `getTrip`

**Contexte** : avant, n'importe quel utilisateur authentifié pouvait lire le détail privé du trip d'autrui.

1. Compte A : créer/publier un trip, noter son id.
2. Compte B (navigation privée) : se connecter, puis :

```bash
curl -s "http://localhost:8080/api/trips/$TRIP_DE_A" \
  -H "Authorization: Bearer $TOKEN_DE_B"
```

3. ✅ Attendu : `"Unauthorized."` — plus jamais le DTO complet.
4. La page **publique** doit continuer de fonctionner pour B : `GET /trips/$TRIP_DE_A/public` → 200 avec le DTO filtré (pas de nom complet, etc.).

### 6.4 Scénario 3 — La matrice complète des transitions

Pour chaque ligne, l'appel se fait avec le token du **propriétaire**. "✅" = 200, "❌" = ValidationError avec le message de la machine.

| Depuis | Action / endpoint | Attendu |
|---|---|---|
| DRAFT | `POST /:id/publish` (profil + Stripe OK, date future) | ✅ → PUBLISHED |
| DRAFT | `POST /:id/publish` (date de départ passée) | ❌ "departure date has passed" |
| DRAFT | `POST /:id/pause` | ❌ "not allowed from status DRAFT" |
| PUBLISHED | `POST /:id/pause` | ✅ → PAUSED |
| PAUSED | `POST /:id/resume` (date future) | ✅ → PUBLISHED |
| PAUSED | `POST /:id/resume` (date passée) | ❌ |
| PUBLISHED ou PAUSED | `POST /:id/unpublish` | ✅ → DRAFT (`publishedAt` remis à null) |
| PUBLISHED ou PAUSED | `POST /:id/cancel` | ✅ → CANCELLED (`cancelledAt` posé) |
| DRAFT | `POST /:id/cancel` | ❌ (avant le chantier : ✅ — c'est un durcissement volontaire, cf. doc métier RG-08) |
| CANCELLED | `POST /:id/restore` (date future) | ✅ → DRAFT |
| CANCELLED ou COMPLETED | `POST /:id/archive` | ✅ → ARCHIVED (`archivedAt` posé) |
| ARCHIVED | `POST /:id/archive` (re-clic) | ❌ "not allowed from status ARCHIVED" |
| ARCHIVED | `PUT /:id` (édition) | ❌ |
| COMPLETED | `PUT /:id` | ❌ (avant : ✅ — trou corrigé) |

Astuce : pour fabriquer un trip "date passée" sans attendre, modifiez `departureAt`/`arrivalAt` directement en base sur un trip de test.

### 6.5 Scénario 4 — Les stats carrier (le bug du chemin PAUSED)

1. Noter `totalTripsPublished` du carrier (visible en base sur `CarrierPage`).
2. Publier un trip → compteur **+1**.
3. Mettre en pause → compteur **inchangé** (PAUSED reste dans le pool public).
4. Annuler depuis PAUSED → compteur **-1** et `totalTripsCancelled` **+1**. *(Avant le chantier : aucun des deux ne bougeait.)*
5. Refaire le cycle avec `unpublish` depuis PAUSED → **-1** également.
6. `resume` (PAUSED → PUBLISHED) → **inchangé** (on reste dans le pool).

### 6.6 Scénario 5 — L'archive (le toast fake remplacé)

1. Sur un trip **Annulé** ou **Terminé** : menu ⋮ → **Archiver**.
2. ✅ Attendu : le badge passe à "Archivé", et — la différence avec avant — **ça survit à un rechargement de page** (l'ancien code n'affichait qu'un toast sans rien persister).
3. Le menu de l'archivé ne propose plus que Voir le détail et Dupliquer.

### 6.7 Scénario 6 — Le cron `complete-trips`

**Test manuel sans attendre 03h15** — plusieurs options :

*Option A — script one-shot* : créer temporairement `apps/trip-service/src/scripts/run-complete-once.ts` :

```ts
import { runCompleteTripsOnce } from "../cron/complete-trips.cron";

runCompleteTripsOnce()
  .then((r) => { console.log(r); process.exit(0); })
  .catch((e) => { console.error(e); process.exit(1); });
```

et l'exécuter avec `npx ts-node` (ou l'outillage Nx équivalent). Supprimer le script après.

*Option B — modifier temporairement `SCHEDULE`* en `"* * * * *"` (chaque minute), redémarrer le service, observer les logs, **puis remettre `"15 3 * * *"` avant commit**.

**Jeu de données** : un trip PUBLISHED avec `arrivalAt` > 24h dans le passé (le Paris→Abidjan du 4 juillet des données de test convient parfaitement).

✅ Attendu dans les logs :

```
[complete-trips] scanned=1 completed=1 skipped=0
```

Puis en front : le trip affiche "Terminé", et `totalTripsPublished` a décrémenté de 1.

**Cas limites à vérifier** :
- Trip PUBLISHED, `arrivalAt` il y a 2h seulement → **non** complété (grâce de 24h).
- Trip PUBLISHED **sans** `arrivalAt` mais `departureAt` passé de plus de 24h → complété (fallback v2 de `isPastArrival`).
- Trip PAUSED avec arrivée passée → complété aussi (PAUSED est dans le périmètre).
- Relancer la passe une 2e fois → `scanned=0` (idempotence : les COMPLETED ne sont plus candidats).

### 6.8 Tests unitaires de la machine (recommandé)

La machine n'a **aucune dépendance** : elle se teste sans base, sans serveur, sans mock. Exemple avec Jest :

```ts
import { canPerform, getAllowedActions, getCarrierStatDeltas } from "./trip-state-machine";

const ctx = { hasActiveBookings: false, now: new Date("2026-07-14T12:00:00Z") };

describe("trip-state-machine", () => {
  it("refuse de publier un DRAFT dont le départ est passé", () => {
    const trip = { status: "DRAFT" as const, departureAt: "2026-07-01T08:00:00Z" };
    const check = canPerform(trip, "publish", ctx);
    expect(check.allowed).toBe(false);
  });

  it("traite un trip soft-deleted comme inexistant", () => {
    const trip = { status: "DRAFT" as const, isDeleted: true };
    expect(canPerform(trip, "view", ctx)).toEqual({
      allowed: false,
      reason: "Trip not found.",
    });
  });

  it("interdit unpublish avec réservations actives", () => {
    const trip = { status: "PUBLISHED" as const };
    const busy = { ...ctx, hasActiveBookings: true };
    expect(canPerform(trip, "unpublish", busy).allowed).toBe(false);
  });

  it("décrémente le pool public sur PAUSED → CANCELLED", () => {
    expect(getCarrierStatDeltas("PAUSED", "CANCELLED")).toEqual({
      totalTripsPublished: { decrement: 1 },
      totalTripsCancelled: { increment: 1 },
    });
  });

  it("n'expose jamais 'complete' dans allowedActions", () => {
    const trip = { status: "PUBLISHED" as const, arrivalAt: "2026-07-01T08:00:00Z" };
    expect(getAllowedActions(trip, ctx)).not.toContain("complete");
  });
});
```

Point clé pédagogique : grâce à l'horloge injectable (`ctx.now`) et au booléen injecté (`hasActiveBookings`), on teste des scénarios "futurs" de façon déterministe. **N'écrivez jamais `new Date()` dans un guard.**

### 6.9 Erreurs fréquentes et diagnostic

| Symptôme | Cause probable | Fix |
|---|---|---|
| `TS2339: Property 'isDeleted' does not exist` | Client Prisma pas régénéré, ou généré depuis le mauvais `schema.prisma` | `npx prisma generate --schema=packages/libs/prisma/schema.prisma`, puis `npx tsc`. Vérifier avec `find . -name "schema.prisma" -not -path "*/node_modules/*"` qu'il n'y a pas de schéma fantôme |
| L'IDE souligne en rouge mais `tsc` passe | Cache TypeScript d'IntelliJ | Invalidate Caches / Restart. `tsc --noEmit` reste la seule source de vérité |
| `Cannot find module 'node-cron'` | Dépendance non installée | `npm install node-cron && npm install -D @types/node-cron` |
| `Cannot find module '../services/trip-state-machine'` | Le fichier machine n'a pas été créé (c'est un **nouveau** fichier) | Le créer, puis `wc -l` pour vérifier qu'il n'est pas vide |
| Un brouillon "supprimé" réapparaît dans une liste | Une requête de lecture oublie le filtre `isDeleted: false` | Ajouter le filtre, ou passer par `findOwnedTrip` |
| Le cron ne se lance pas | `startCompleteTripsCron()` absent du callback `app.listen` de `main.ts` | Vérifier le log `[cron] complete-trips scheduled` au démarrage |
| `zsh: event not found` en testant avec curl | Le `!` dans une chaîne déclenche l'historique zsh | Guillemets simples, ou heredoc `<< 'EOF'` |

---

## 7. Ce qui arrive ensuite (contexte pour ne pas être surpris)

Le prochain chantier est le **backend Deal lifecycle** (modèle `Booking` + sa propre state machine, spec `SPECIFICATIONS-WORKFLOW-YAMBA.md §6`). Il viendra :

1. remplacer le corps du stub `hasActiveBookings` par un vrai `prisma.booking.count(...)` — activant *automatiquement* tous les guards booking déjà en place (edit verrouillé, unpublish interdit, cron qui attend les deals) ;
2. ajouter les side-effects du cancel avec réservations (remboursements Stripe, notifications expéditeurs) à l'endroit marqué `NOTE chantier Booking` dans `performCancel` ;
3. enrichir la règle de complétion (règle 2 : tous les deals en état terminal logistique).

Si vous travaillez sur ce chantier : **ne dupliquez pas la logique de la machine Trip** — créez une machine Booking sur le même modèle.
