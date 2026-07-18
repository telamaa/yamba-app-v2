# Couverture fonctionnelle — Booking model & state machine (B1-PR2)

> **Emplacement** : `apps/deal-service/docs/COUVERTURE-FONCTIONNELLE-PR2.md`
> **Sources de vérité** : `SPECIFICATIONS-WORKFLOW-YAMBA.md` §2.2, §5.4, §9 · Règles métier v1.2 (ANN, CAP, COM, GAR) · Registre des décisions (D2, D13, D14, D16, D17, D19, D22, D24)
> **Principe** : tout ce qui est décrit ici est **exécutable** — chaque règle citée correspond à une transition, un guard ou un test nommé. Toute divergence future entre ce document, la spec et le code doit se traduire par un test rouge, jamais par une interprétation dans un controller.

---

## 1. Ce que couvre cette PR

### 1.1 Le cycle de vie complet d'un deal (§2.2)

Les **9 statuts** d'un Booking et les **12 transitions légales**, chacune attachée à un **acteur** précis :

| # | De | Action | Acteur | Vers | Règle métier portée |
|---|---|---|---|---|---|
| 1 | PENDING | accept | Voyageur | ACCEPTED | Fenêtre de réponse 24 h |
| 2 | PENDING | decline | Voyageur | DECLINED | Remboursement intégral |
| 3 | PENDING | expire | Système | EXPIRED | Cron 24 h — remboursement intégral |
| 4 | PENDING | cancel | Expéditeur | CANCELLED | Annulation libre avant acceptation |
| 5 | ACCEPTED | cancel | Expéditeur | CANCELLED | **ANN-01** : barème J-2 (calculé en B2) |
| 6 | ACCEPTED | cancel | Voyageur | CANCELLED | **ANN-02** : défaut Voyageur — remboursement intégral + impact réputation |
| 7 | ACCEPTED | pickup | Voyageur | PICKED_UP | Checklist 5/5 + ≥1 photo (payload B3) · génération du code |
| 8 | ACCEPTED | refusePickup | Voyageur | CANCELLED | Refus de conformité **légitime, sans pénalité** |
| 9 | PICKED_UP | deliver | Voyageur | DELIVERED | Code 6 chiffres (bcrypt, 3 tentatives, lock 15 min) |
| 10 | DELIVERED | confirmEarly | Expéditeur | COMPLETED | Confirmation anticipée → versement immédiat |
| 11 | DELIVERED | autoComplete | Système | COMPLETED | Cron J+4 → versement automatique |
| 12 | DELIVERED | dispute | Expéditeur | DISPUTED | Litige **avant** J+4 → gel du versement |

### 1.2 Les interdictions structurelles (aussi importantes que les permissions)

Testées par **assertions nommées** (spec S6), pas seulement par absence :

- **Plus aucune annulation après la remise du colis** (PICKED_UP, DELIVERED) — la seule voie de sortie est le litige. C'est la dernière ligne de la matrice ANN-01.
- **DISPUTED est terminal en v1** : les résolutions de litige (→ versement ou → remboursement) sont des actions ADMIN du chantier C, dont la matrice de remboursement de médiation n'est pas encore spécifiée. L'acteur ADMIN est **réservé dans les types mais n'a aucune transition** — 10 tests le verrouillent.
- **Les 4 statuts terminaux** (COMPLETED, DECLINED, EXPIRED, CANCELLED) sont sans issue — 87 tests de matrice générés le garantissent pour chaque paire action×acteur.

### 1.3 Les fenêtres temporelles, aux bornes exactes

| Règle | Comportement testé à la borne |
|---|---|
| Expiration 24 h | À l'instant exact `expiresAt` : accept/decline **encore permis**, expire **encore refusé**. 1 ms après : inversés. Un PENDING périmé se comporte comme EXPIRED **avant même le passage du cron**. |
| Vérification J+4 | À l'instant exact `payoutDueAt` : `autoComplete` **devient permis** et `dispute` **se ferme** — miroirs parfaits, **jamais de trou ni de chevauchement** entre les deux fenêtres. |
| Lock livraison | 15 min (`DELIVERY_LOCK_MINUTES`) ; à l'échéance du lock, la livraison redevient tentable. Le message du lock prime sur celui du plafond. |

### 1.4 Les compteurs serveur (spec §5.4)

- Régénération du code : **≤ 5** (`MAX_CODE_REGENERATIONS`), réservée à l'Expéditeur, uniquement en PICKED_UP. Bornes testées à 4 (permis) et 5 (refusé).
- Tentatives de code : **≤ 3** (`MAX_DELIVERY_ATTEMPTS`). Bornes testées à 2 et 3.
- Jalons de tracking : séquence **stricte** AT_AIRPORT → FLIGHT_DEPARTED → FLIGHT_ARRIVED, sans saut ni doublon (7 tests).

### 1.5 La capacité en kilos (CAP-01 / CAP-02 / D19)

- **Modèle Prisma** : `Trip.capacityKg` (déclaration du Voyageur) + `Trip.reservedKg` (compteur atomique). `remainingKg` est **dérivé**, jamais stocké. Invariant vérifiable : `reservedKg === Σ poids des bookings actifs`.
- **Partition des statuts** (testée) : les statuts **actifs** {PENDING, ACCEPTED, PICKED_UP, DELIVERED, **DISPUTED**} conservent les kg ; les terminaux les libèrent (`RELEASE_CAPACITY`).
- **Arbitrage gravé** : DISPUTED conserve les kg **mais ne bloquera pas** la complétion du trip (le voyage physique est fini) — distinction appliquée côté trip-service en PR3.

### 1.6 Le snapshot immuable (D17 étendu)

Le Booking est **auto-suffisant** : pricing, trajet (2 fuseaux IANA — D24), colis (famille D14 **figée à la création**) et destinataire sont photographiés à la création. Si le Trip est modifié, annulé ou purgé (RGPD), le deal reste lisible et affichable seul.

- **Tout montant en centimes** (`Int`), jamais de flottant monétaire.
- **Pricing discriminé** `PER_CATEGORY` (moteur actuel) / `PER_KG` (cible D13) : un changement de moteur de prix ne migrera **jamais** les bookings existants.
- **Prime de protection séparée** du transport (GAR-04, D22).

### 1.7 L'outbox (D2)

La table `OutboxEvent` naît dans cette PR. Contrat : **aucun changement d'état sans événement écrit dans la même transaction Mongo** (appliqué dès les premiers endpoints en PR3 ; relay Redpanda en PR4). Les effets `NOTIFY_*` transiteront par ces événements.

---

## 2. Ce que cette PR ne couvre PAS (et où ça vit)

| Hors périmètre | Chantier | Note |
|---|---|---|
| Création du deal + PaymentIntent | **B2** | L'invariant "PENDING ⇒ paiement autorisé" impose de ne jamais créer de deal sans argent autorisé — d'où l'absence volontaire de POST en B1 |
| Barème ANN-01 (100 % / partiel J-2) | B2 | La machine déclare `REFUND_PER_CANCELLATION_POLICY`, le module remboursement calcule |
| Cron expiration 24 h | B2 | La transition `expire` existe et est gardée ; le cron ne fera que l'invoquer |
| Génération/comparaison bcrypt du code | B3 | Le guard vérifie lock + compteur ; la comparaison est un acte de service |
| Checklist pickup 5/5 + photos R2 | B3 | Validation de payload, pas une transition |
| Stripe transfers, gel, remboursements | B4 | Effets déclarés `TRANSFER_PAYOUT` / `FREEZE_PAYOUT`, exécuteurs B4 |
| Notation double-aveugle, stats | B5 | Extension du modèle `Review` existant (décision : pas de modèle parallèle) |
| Résolutions ADMIN des litiges | Chantier C | DISPUTED terminal v1 |
| Endpoints GET par rôle, `hasActiveBookings()` | **PR3 (B1)** | Consommeront `getAllowedActions` et `BOOKING_ACTIVE_STATUSES` |

---

## 3. Traçabilité règles → tests

| Règle | Section(s) de tests |
|---|---|
| §2.2 — 12 transitions | S1 (nominaux, effets exacts) + S5 (87 refus de statut) |
| Rôles (acteur ∈ transition) | S3 (13) + S4 (ADMIN, 10) |
| ANN-01 / ANN-02 | S1 (lignes 5-6) + S6 (interdictions post-remise) |
| CAP-02 (partition kg) | S13 |
| §5.4 (constantes) | S7 (bornes) + S11 + S13 |
| §9 (code, lock, tentatives) | S7 + S11 |
| Tracking séquentiel | S12 |
| Soft delete / RGPD | S8 |

**Total : 188 tests — `npx nx test @yamba-app/deal-service` (détails d'exécution : voir COUVERTURE-TECHNIQUE-PR2.md).**
