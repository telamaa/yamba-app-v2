# Couverture technique — Booking state machine (B1-PR2)

> **Emplacement** : `apps/deal-service/docs/COUVERTURE-TECHNIQUE-PR2.md`
> **Public** : l'équipe qui reprendra le deal-service. Ce document explique **comment exécuter les tests**, **pourquoi l'architecture est ainsi**, et **comment la faire évoluer sans la casser**.
> **Fichiers concernés** :
> - `apps/deal-service/src/services/booking-state-machine.ts` (483 l)
> - `apps/deal-service/src/services/booking-state-machine.spec.ts` (593 l, 188 tests)
> - `prisma/schema.prisma` (modèles `Booking`, `OutboxEvent`, `Report`, migration `Trip`)

---

## 1. Lancer les tests

### 1.1 Commandes

```bash
# Suite complète du service (référence — c'est ce que la CI exécute)
npx nx test @yamba-app/deal-service

# Mode watch pendant le développement (relance au moindre changement)
npx nx test @yamba-app/deal-service --watch

# Un seul describe / un seul test (filtre par nom, regex acceptée)
npx nx test @yamba-app/deal-service -t "S7"
npx nx test @yamba-app/deal-service -t "dispute est refusé"

# Couverture (rapport dans coverage/apps/deal-service)
npx nx test @yamba-app/deal-service --coverage
```

**Toujours `npx nx`, jamais un binaire global** (convention repo) : la version de Nx et de jest est celle du lockfile, identique pour tout le monde et pour la CI.

### 1.2 Ce qu'il faut savoir avant de lancer

- **Aucun prérequis d'environnement** : ni base de données, ni `.env`, ni service démarré. Si un test exige un jour l'un de ces éléments, c'est un signal d'alerte architectural (voir §2.1).
- **Vitesse attendue : < 2 s** pour les 188 tests. Une suite qui ralentit fortement indique qu'une dépendance I/O s'est glissée dans la machine.
- La config jest du service est `apps/deal-service/jest.config.ts` (géométrie `rootDir`/tsconfig héritée de trip-service — **ne pas la "simplifier"**, elle est le fruit d'un débogage documenté, cf. PR #67).

### 1.3 Dans la CI

Le job `Tests unitaires (deal-service)` (`.github/workflows/ci.yml`, matrice du job `tests`) exécute `npx nx test @yamba-app/deal-service --ci` sur chaque PR vers `dev`/`main`. Il est **required check** sur `dev` : un test rouge bloque le merge. Le `npx prisma generate` en amont du job est nécessaire (le typecheck du spec importe les types du client Prisma via le schéma partagé).

---

## 2. Pourquoi cette architecture

### 2.1 Une machine pure, zéro dépendance

`booking-state-machine.ts` n'importe **ni Prisma, ni Express, ni aucune lib**. Conséquences voulues :

- **Testable unitairement** sans mock : les 188 tests s'exécutent en mémoire.
- **Portable** : la même machine pourrait servir un worker, un cron, un CLI d'admin.
- **Le service applique, la machine décide** : les controllers/services appellent `canPerform()`, puis exécutent la transition retournée + ses effets. Aucun `if (booking.status === ...)` ad hoc n'est toléré dans un controller — c'est la règle héritée de `trip-state-machine.ts`, qui a éliminé une classe entière de bugs.

### 2.2 L'acteur fait partie de la transition

Contrairement à la machine trip (un seul propriétaire), un deal a trois acteurs actifs (SHIPPER, CARRIER, SYSTEM) + un réservé (ADMIN). La même action depuis le même statut peut avoir des **effets opposés** selon l'acteur — `cancel` depuis ACCEPTED : barème ANN-01 (Expéditeur) vs remboursement intégral + pénalité ANN-02 (Voyageur). C'est pourquoi `TRANSITIONS` est un **tableau** de tuples `{from, action, actor, to, effects, guard}` et non un dictionnaire par action : `(action)` n'est pas une clé unique.

Le lookup en cascade de `canPerform` (action → acteur → statut → guard) produit des messages d'erreur précis à chaque étage — le front peut les afficher tels quels (surface publique = anglais).

### 2.3 Les effets de bord sont des données, pas du code

Chaque transition **déclare** ses effets (`FULL_REFUND`, `RELEASE_CAPACITY`, `GENERATE_CODE`, …) ; elle ne les **exécute pas**. Généralisation du pattern `getCarrierStatDeltas` de trip-service. Bénéfices :

- Les matrices métier (ANN, CAP) sont **testées dès aujourd'hui** (S1 vérifie les effets par égalité stricte), alors que leurs exécuteurs arrivent en B2-B5.
- Brancher un exécuteur (module remboursement, Stripe, notifications) **ne modifie jamais la machine** — donc ne peut pas casser les 188 tests.
- L'écriture `OutboxEvent` se fait au moment de l'application de la transition, dans la même transaction Mongo : la liste d'effets EST le payload naturel de l'événement.

### 2.4 L'horloge est injectée

Tous les guards temporels lisent `ctx.now` (défaut `new Date()`). Les tests fixent `NOW` et testent les bornes **à la milliseconde** : c'est ce qui permet de garantir que les fenêtres `dispute` / `autoComplete` sont des miroirs parfaits à `payoutDueAt` (jamais de trou, jamais de chevauchement). **Ne jamais appeler `new Date()` dans un guard** — toujours passer par le contexte.

### 2.5 Deux familles d'opérations, deux APIs

- **Transitions** (changement de statut) → `canPerform` / `getAllowedActions`.
- **Opérations gardées sans transition** (régénérer le code, confirmer un jalon de tracking) → `canRegenerateCode` / `canConfirmTrackingStep`. Elles ne polluent pas la table principale : le tracking est une séquence *dans* PICKED_UP, pas un changement d'état.

### 2.6 `getAllowedActions` est le contrat des CTAs front

Les DTOs (PR3) exposeront `allowedActions` calculé par ce helper : le front **reflète** ce que l'API accepte, il ne le décide jamais (même principe que `my-trips.config.ts` côté trip). Les guards y sont intégrés : un PENDING expiré ne propose plus `accept` au Voyageur avant même le passage du cron.

---

## 3. Faire évoluer la machine (checklist pour l'équipe)

### 3.1 Ajouter une transition

1. **La spec d'abord** : la transition doit exister dans `SPECIFICATIONS-WORKFLOW-YAMBA.md` §2.2 (ou y être ajoutée et validée). La machine est un miroir, pas une source.
2. Ajouter le tuple dans `TRANSITIONS` (avec acteur, effets, guard éventuel).
3. Mettre à jour les tests — **dans la même PR** (règle D30) :
   - S1 : une ligne nominale avec les effets **exacts** ;
   - S5 : ajuster la liste `legal` de la paire (action, acteur) concernée — le nombre de tests générés change mécaniquement ;
   - S10 : ajuster les `allowedActions` attendues des statuts touchés ;
   - si nouvel effet : l'ajouter au type `BookingEffect` avec un commentaire indiquant **quel chantier l'exécute**.
4. Mettre à jour le décompte en tête du spec et `COUVERTURE-FONCTIONNELLE-PR2.md`.
5. `npx nx test @yamba-app/deal-service` : tout doit être vert, y compris les tests que vous n'avez pas touchés — s'ils cassent, votre transition contredit une interdiction structurelle (S6) : c'est un débat de spec, pas un test à "corriger".

### 3.2 Ouvrir les transitions ADMIN (chantier C)

L'acteur existe déjà dans les types. Le jour venu : ajouter les tuples `DISPUTED → ...` avec acteur ADMIN, retirer DISPUTED de l'assertion "terminal v1" de S6, redéfinir S4 (qui verrouille aujourd'hui qu'ADMIN n'a **rien**), et statuer sur la partition : si une résolution rend les kg, l'effet `RELEASE_CAPACITY` doit figurer et S13 être réexaminé.

### 3.3 Modifier un guard ou une constante

Les constantes §5.4 (`MAX_CODE_REGENERATIONS`, `MAX_DELIVERY_ATTEMPTS`, `DELIVERY_LOCK_MINUTES`) sont exportées par la machine et **verrouillées par S13** : les changer exige de changer le test — c'est voulu, une constante métier ne bouge pas par accident. À terme (B2), elles pourront migrer vers la table de paramètres serveur (`SiteConfig`), auquel cas la machine devra les recevoir par le contexte, comme l'horloge.

### 3.4 Brancher un exécuteur d'effet (B2-B5)

Ne touchez **ni** à la machine **ni** à ses tests. Le service qui applique une transition itère sur `check.effects` et dispatche vers les exécuteurs. Testez l'exécuteur séparément (avec ses mocks Stripe/notifications) et l'intégration service à part. Si vous ressentez le besoin de modifier la machine pour brancher un effet, l'architecture est en train d'être contournée — en discuter avant.

### 3.5 Consommer la machine depuis un autre service

`hasActiveBookings()` (trip-service, PR3) importera `BOOKING_ACTIVE_STATUSES` — jamais une liste locale re-codée. Règle générale : **toute connaissance du cycle de vie booking hors du deal-service doit être importée de ce fichier**, pour qu'un changement de partition se propage par le compilateur.

---

## 4. Pièges connus & décisions gravées

| Piège / décision | Détail |
|---|---|
| Bornes temporelles | `isExpired` est **strict** (`exp < now`) ; `isPayoutDue` est **large** (`due <= now`). Ce n'est pas une incohérence : c'est ce qui rend accept/expire cohérents entre eux, et dispute/autoComplete complémentaires sans trou. Testé à la borne exacte dans S7. |
| Ordre des vérifications dans `deliver` | Lock **avant** plafond de tentatives (message du lock prioritaire) — testé. |
| `deliveryCodeHash` | bcrypt, **jamais** dans un payload à destination du Voyageur. La machine ne compare pas le code : c'est un acte de service (B3) qui incrémente `deliveryAttempts`. |
| Argent | **Centimes `Int` partout.** Tout `Float` monétaire en revue est un défaut bloquant. |
| Snapshot pricing | Discriminé `PER_CATEGORY`/`PER_KG` : ne **jamais** migrer les snapshots existants lors d'un changement de moteur de prix. |
| `maxSlots`/`bookedSlots` (Trip) | Dépréciés, conservés pour le wizard actuel. Suppression : PR cleanup post-refonte pricing (D13). Ne pas s'en servir pour du code neuf. |
| Nom UI vs code | "Tripper"/“Yamber” en UI/marketing, **`carrier`** dans le code et la DB, `CARRIER` dans la machine. |
| tsconfig/jest | Géométrie clonée de trip-service (PR #67). Toute "simplification" a déjà été payée une fois — ne pas recommencer. |
