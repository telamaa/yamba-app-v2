# Yamba — Cahier de résultats : recette n° 4 (tâches planifiées, relais, consommateurs)

> Document de campagne, rempli au fil des chapitres. Il complète le tableau de suivi du §9.1 de
> `docs/recette/RECETTE-04-CRONS.md` — celui-ci porte les verdicts, celui-là le raisonnement :
> pourquoi c'est conforme, pourquoi ça ne l'est pas, et ce qu'il faut en faire.
>
> Même méthode que la campagne API (`YAMBA-RECETTE-API-RESULTATS.md`, 146 fiches, 23 anomalies
> closes) : une anomalie = une fiche au format §9.2, une correction = une contre-épreuve mesurée,
> et rien n'est déclaré conforme sur la seule lecture du code.

## En-tête de campagne

| Champ | Valeur |
|---|---|
| Date | 9 septembre 2026 |
| Testeur | Gomab (assisté) |
| Branche / version | `dev` — 36d5987 |
| Base de données | Atlas, base `development` |
| Courtier | **Redpanda actif** — `booking-events` et `messaging-events`, 12 partitions chacun, auto-création **désactivée** |
| Boîte aux lettres | **Mailpit** (`localhost:1025`, interface `:8026`), `EMAIL_PROVIDER=smtp` |
| Fournisseur de paiement | Stripe **mode test** (clé `sk_test_…`) |
| Jeu d'essai | `seed-deals.ts` rejoué le 09/09 · paramètres remis aux défauts (`seed-settings.ts`) |
| Battements au départ | 6 sur 13 — les sept nocturnes n'ont pas encore eu leur première échéance (normal) |
| Fiches | **90** |

## Méthode

Les trois moyens de forcer un passage, prévus par le cahier (§2.7) :

- **A — la fonction exportée**, appelée depuis un script `tsx` lancé à la racine (`--env-file=.env`
  obligatoire, `process.exit(0)` obligatoire) ;
- **B — l'horloge injectée** : presque toutes les tâches acceptent un `now`, ce qui permet de
  simuler le futur **sans toucher aux données** — c'est la méthode préférée ;
- **C — les dates du jeu d'essai**, quand la fonction ne prend pas d'horloge.

Les scripts de recette vivent dans `scripts/recette/` et ne sont pas du code de production.

---

## Chapitre 4.1 — Complétion des trajets (`complete-trips`)

| Fiche | Ce qui est éprouvé | Verdict | Pourquoi |
|---|---|---|---|
| CRON-TRAJETS-1 | Le trajet terminé passe `COMPLETED` | **Non conforme** | le trajet passe bien `COMPLETED`, mais le compteur public du Voyageur descend à **-1** → `ANO-CRON-01` |
| CRON-TRAJETS-2 | Un deal en cours bloque la complétion | **Conforme** | `ACCEPTED` sur le trajet → `completed=0, skipped=4`, trajet resté `PUBLISHED` |
| CRON-TRAJETS-3 | Le litige ne bloque pas (A20) | **Conforme** | seule réservation non terminale en `DISPUTED` → trajet `COMPLETED`. Le litige gèle l'argent, pas la logistique |
| CRON-TRAJETS-4 | Un trajet en échec ne bloque pas la fournée | **Conforme (par lecture)** | le `try/catch` par trajet existe, incrémente `skipped` et journalise ; mais **la provocation proposée par le cahier est inopérante** — voir ci-dessous |

### La provocation du cahier ne provoque rien

Le cahier propose, pour CRON-TRAJETS-4, de « supprimer la `CarrierPage` du Voyageur pour que la
mise à jour des compteurs soit sans cible ». Joué : les **trois** trajets passent `COMPLETED`, aucun
n'est compté en échec. C'est normal — le code teste `if (carrierPage)` avant d'écrire : l'absence
est **tolérée par conception**, ce n'est pas une erreur.

Le `try/catch` par trajet existe bel et bien, avec `skipped++` et la ligne
`[complete-trips] Failed to complete trip <id>`. La propriété est donc vraie ; c'est le **moyen de
la démontrer** qui manque. Recommandation : rendre la boucle injectable (passer le client Prisma en
argument, comme le font `recipient-redaction` ou `unread-reminder`) pour qu'un test unitaire puisse
faire échouer un trajet sur trois. Écart **documentaire**, à corriger dans le cahier.

*(Tentative d'une provocation de remplacement — écrire un `userId` malformé pour faire lever P2023 —
abandonnée : elle a écrit les dates en TEXTE au lieu de dates BSON, ce qui casse le **scan** avant
la boucle, donc à un autre endroit que celui qu'on cherche à éprouver. Document réparé, jeu d'essai
rejoué.)*

### Anomalie du chapitre 4.1

```
ANO-CRON-01
Fiche          : CRON-TRAJETS-1 · Gravité : MINEURE (échelle du cahier : « compteur inexact »)
                 — mais visible sur une page PUBLIQUE · ÉTAT : CLOSE
Appel exact    : npx tsx --env-file=.env scripts/recette/complete-trips.ts
                 puis  curl -s "$BASE/users/evrard-p-lhbeo/public" | jq '.user.stats'
Attendu        : le trajet passe COMPLETED, `totalTripsPublished` diminue de 1
Obtenu         : le trajet passe COMPLETED (correct) et le compteur passe de 0 à **-1**.
                 Mesuré après UN passage : 2 pages Voyageur sur 11 à -1, et le nombre
                 sort tel quel sur l'API publique :
                   {"tripsPublishedCount":-1,"parcelsCarriedCount":0,"parcelsSentCount":0}
Cause          : `getCarrierStatDeltas` rend `{ decrement: 1 }` — ce qui est juste — et les
                 DEUX appelants (le contrôleur de trajets et le cron) le passaient tel quel à
                 Prisma, sans plancher. Il suffit d'une dérive pour produire un nombre
                 impossible : un trajet publié avant que le compteur existe, une
                 incrémentation ratée, une correction manuelle en base.
Impact         : « -1 trajet publié » sur la vitrine d'un Voyageur. Ce n'est pas seulement
                 inexact, c'est absurde : un décompte ne peut pas être négatif, et c'est un
                 signal de confiance affiché à des inconnus.
Correction     : `clampedCarrierStats` (pur, dans la machine à états) applique les deltas et
                 borne à zéro ; les deux appelants écrivent désormais une VALEUR, plus un
                 delta. Bénéfice secondaire connu du dépôt : sur Mongo, `{ increment: 1 }`
                 sur un champ ABSENT rend `null`, pas `1` — écrire la valeur ferme aussi ce
                 piège. Réparation des documents déjà abîmés :
                 `packages/libs/prisma/scripts/repair-negative-counters.ts` (idempotent,
                 `--dry-run`), qui couvre aussi `totalTripsCancelled`, `totalParcelsCarried`,
                 `parcelsSentCount` et `disputesLostCount`.
Contre-épreuve : compteur forcé à 0, un trajet éligible terminé → compteur **0** (et non -1) ;
                 un décrément normal reste un décrément (2 → 1) ; profil public repassé à
                 `tripsPublishedCount: 0`. Tests : `carrier-stats.spec.ts` (7 cas).
```

## Chapitre 4.2 — Expiration des demandes à 24 h (`expire-bookings`)

| Fiche | Ce qui est éprouvé | Verdict | Preuve |
|---|---|---|---|
| CRON-EXPIRE-1 | La demande dépassée expire et libère tout | **Conforme** | `EXPIRED`, `closedBy: SYSTEM`, `reservedKg` 8 → 5 (= `weightKg` 3), deux événements, battement « 1 expirée(s) », deux emails à l'Expéditrice |
| CRON-EXPIRE-2 | La borne, et le filtre sur `PENDING` | **Conforme** | échéance à +10 min → intacte ; `ACCEPTED` à échéance dépassée de 10 h → **reste ACCEPTED** |
| CRON-EXPIRE-3 | Pas de double expiration ni double restitution | **Conforme** | deux rejeux → `0`, `reservedKg` inchangé, toujours 2 événements |
| CRON-EXPIRE-4 | La garde de chevauchement / la fournée | **Conforme (adapté)** | la base n'a pas 50 `PENDING` : éprouvé avec une fournée de **1** — `1`, `1`, `0`. Le retard se résorbe, rien n'est traité deux fois |
| CRON-EXPIRE-5 | La coupure par variable d'environnement | **Conforme** | `Booking expiry cron disabled (BOOKING_EXPIRY_CRON_ENABLED=false)` au démarrage ; demande périmée **restée `PENDING`** au-delà d'un tick ; battement figé à 6 min |

**Le détail qui vaut d'être noté.** L'événement `booking.refund_issued` porte
`amountCents: 2800`, exactement `pricing.totalShipperCents` — le remboursement est le **total
Expéditeur**, pas la rémunération du Voyageur. Et l'expiration a été **matérialisée par le vrai
cron** avant même que le script de recette ne s'exécute (`expirées : 0`, mais les effets étaient
là) : c'est une meilleure preuve que le forçage, puisqu'elle éprouve le chemin réel.

*Artefact de recette, sans rapport avec un défaut :* remettre une réservation déjà expirée en
`PENDING` ne **re-réserve pas** les kilos ; la ré-expirer les libère une seconde fois et fait
descendre `reservedKg`. Jeu d'essai rejoué.

---

## Chapitre 4.3 — Versement à J+4, rejeu, rappel (`payout-bookings`)

C'est la tâche qui déplace de l'argent : toute anomalie y est bloquante par défaut. **Aucune.**

| Fiche | Ce qui est éprouvé | Verdict | Preuve |
|---|---|---|---|
| CRON-PAYOUT-1 | Le versement à échéance part | **Conforme** | `COMPLETED` / `completedBy: SYSTEM`, `payoutAmountCents: 5500` = `transportCents`, `ratingWindowEndsAt` = +14 j, `ratingRemindersSent: 0`, événement `booking.completed` ; puis `payoutStatus: SENT`, `transferId`, `payoutSentAt`, `payoutFailureReason: null`, `payoutNextRetryAt: null` |
| CRON-PAYOUT-2 | La remise non échue n'est pas versée | **Conforme** | échéance à +48 h → `autoCompleteDue → 0`, aucun transfert |
| CRON-PAYOUT-3 | Le rappel de vérification à J+3 | **Conforme** | `verificationReminderSentAt` posé, événement `booking.verification_reminder` |
| CRON-PAYOUT-4 | Jamais deux rappels | **Conforme** | second passage → `0`, toujours **un** événement |
| CRON-PAYOUT-5 | Le rejeu espacé d'un versement en échec | **Conforme** | table vérifiée sur 8 points : < 6 → 5 min · < 12 → 30 min · < 24 → 2 h · ≥ 24 → 24 h |
| CRON-PAYOUT-6 | Jamais deux transferts | **Conforme** | rejeu et complétion relancés → `0` et `0`, `transferId` et `payoutAttempts` inchangés |
| CRON-PAYOUT-7 | L'ordre des trois passes | **Conforme** | `autoCompleteDue → 1`, `retryFailedPayouts → **2**`, `sendVerificationReminders → 1` |

### Deux observations qui valent mieux qu'un verdict

**1. L'ordre des passes se prouve par les nombres.** La passe de rejeu a traité **2**
réservations : celle préparée pour elle, **plus celle que la passe 1 venait de compléter**. C'est
exactement la raison d'être de l'ordre, écrite dans le cahier : « une réservation complétée au
premier passage doit pouvoir être rejouée au même tick si son transfert a échoué ». La propriété
n'est pas seulement respectée, elle est *observable*.

**2. Le chemin d'échec a été éprouvé gratuitement, et contre le vrai Stripe.** Le premier passage
a tourné avec le fournisseur **réel en mode test**, et le compte connecté du jeu d'essai
(`acct_fake_seed_thomas`) n'existe évidemment pas chez Stripe. Résultat :

```
payoutStatus: "FAILED"
payoutFailureReason: "PROVIDER_ERROR:No such destination: 'acct_fake_seed_thomas'"
payoutNextRetryAt: +5 minutes        ← 1 tentative → < 6 → 5 min, la table s'applique
transferId: null                     ← aucun argent n'a bougé
```

Un vrai refus de fournisseur, classé, horodaté, replanifié — et **aucun argent déplacé**. Le
chemin de succès a ensuite été rejoué avec le fournisseur factice
(`STRIPE_SECRET_KEY= npx tsx …`), qui rend `tr_fake_…`. Les deux moitiés de la fiche sont donc
prouvées, chacune avec le fournisseur qui convient.

### Un écart du cahier, pas du code

Le §1 du cahier liste une divergence **DIV-3** : « l'en-tête de `payout-bookings.cron.ts` annonce
un rejeu des versements *< 10 essais* ». Vérifié : l'en-tête dit exactement le contraire —
« Le plafond de 10 essais a disparu avec D58 : le rejeu est espacé (`payoutNextRetryAt`), sans
limite ». Le commentaire est à jour ; c'est **la liste de divergences du cahier** qui ne l'est
plus. Écart documentaire, à corriger dans le cahier.

---

## Chapitre 4.4 — Alertes de seuil (`ops-alerts`)

| Fiche | Ce qui est éprouvé | Verdict | Preuve |
|---|---|---|---|
| CRON-ALERTES-1 | Une alerte nouvelle déclenche un email | **Conforme** | verrous purgés → `emails envoyés : [EMAILS_FAILED_24H, NO_TRIP_PUBLISHED_7D]`, **un seul** email au support récapitulant les deux |
| CRON-ALERTES-2 | Rien sous le seuil, rien à envoyer | **Conforme** | `PAYOUT_FAILED_48H` absente tant que l'échec date de 10 h et que le seuil est à 48 h |
| CRON-ALERTES-3 | Une alerte, un email par jour | **Conforme** | second passage → `emails envoyés : []`, boîte toujours à 1 |
| CRON-ALERTES-4 | Le seuil est lu dans les paramètres | **Conforme** | seuil ramené à 1 h → l'alerte apparaît ; le cache de 30 s se comporte comme documenté |
| CRON-ALERTES-5 | Le verrou est posé, avec son TTL | **Conforme** | `yamba:alerts:sent:<RÈGLE>:2026-09-09`, TTL 172 789 s (48 h), date en UTC |

**Un piège de recette, noté pour la prochaine campagne.** Une première mesure de CRON-ALERTES-4 a
échoué : le versement mis en échec à la main avait été **rejoué avec succès par le vrai cron**
(tick de 5 min, fournisseur factice) avant l'évaluation. Ce n'est pas un défaut — c'est le système
qui fonctionne. Fabriquer un état fautif et l'évaluer sont à faire **dans le même souffle**, ou
avec le cron coupé.

### Ce que la campagne a trouvé en regardant les alertes

Trois alertes étaient **déjà vraies** au premier appel, dont une critique :

```
critical  OUTBOX_PARKED   4 événement(s) jamais publié(s) après 10 tentatives :
                          notifications et emails de ces deals ne partent pas.
```

C'est le point de départ d'`ANO-CRON-02`.

### Anomalies du chapitre 4.4

```
ANO-CRON-02
Fiche          : CRON-ALERTES-1 (trouvée en lisant l'alerte) · Gravité : MAJEURE
                 (échelle du cahier : « un événement sain parqué ») · ÉTAT : CLOSE
Appel exact    : npx tsx --env-file=.env scripts/recette/alertes.ts evaluate
                 npx tsx --env-file=.env scripts/recette/outbox-etat.ts
Attendu        : aucun événement parqué, ou un moyen de les libérer
Obtenu         : 4 événements parqués depuis le **4 septembre**, tous refusés à l'époque
                 par le contrat (« No matching discriminator » sur `eventType`) :
                   booking.dispute_carrier_responded  ×2
                   booking.dispute_resolved           ×2
                 Or, relus au contrat d'AUJOURD'HUI, les quatre sont **VALIDES** : les deux
                 types ont été déclarés depuis. La cause du parcage est levée — et les
                 événements restent parqués pour toujours.
Cause          : le relais ne sélectionne que `attempts < MAX_RELAY_ATTEMPTS`. Un événement
                 parqué sort donc définitivement de la file, et **aucune route, aucun script,
                 aucune action d'administration** ne remet le compteur à zéro. Le journal dit
                 « manual investigation required » et l'alerte se déclenche — mais l'exploitant
                 n'a rien pour agir. Le parcage est conçu comme définitif alors que sa cause la
                 plus fréquente est temporaire : un type pas encore au contrat, un sujet du
                 courtier absent, un champ ajouté depuis.
Impact         : les deux parties de DEUX litiges n'ont jamais été informées de la décision
                 rendue. L'argent a bougé (la transaction était committée), la notification
                 non — le membre découvre la décision par surprise, ou pas du tout.
Correction     : `packages/libs/prisma/scripts/requeue-parked-outbox.ts`. Il ne force rien :
                 il **revalide chaque événement parqué au contrat courant** et ne remet en file
                 que ceux qui passent (`attempts: 0`, `lastError: null`). Un événement réellement
                 empoisonné reste parqué — c'est le comportement voulu. `--dry-run` et
                 `--type=<agrégat>` disponibles.
Contre-épreuve : 4 remis en file → publiés au tick suivant → **4 emails « Décision rendue »**
                 sont partis, aux quatre membres concernés (deux Voyageurs, deux Expéditeurs),
                 et l'alerte OUTBOX_PARKED est retombée.
```

```
ANO-CRON-03
Fiche          : CRON-ALERTES-4 · Gravité : COSMÉTIQUE · ÉTAT : CLOSE
Attendu        : le libellé d'une alerte reflète le seuil réellement appliqué
Obtenu         : le seuil ramené à 1 h, le DÉTAIL suit (« depuis plus de 1 h ») mais le TITRE
                 reste figé : « Versements en échec depuis plus de 48 h ».
Impact         : l'exploitant lit un titre qui contredit le seuil qu'il vient de régler. Faible,
                 mais c'est précisément l'écran où l'on vérifie qu'un réglage a pris.
Correction     : titre construit avec `T.payoutFailedHours`, comme le détail. Les autres titres
                 ne portent aucun nombre et restent inchangés ; les CODES de règle
                 (`PAYOUT_FAILED_48H`…) gardent leur nom, ce sont des identifiants stables.
Contre-épreuve : seuil 1 h → « Versements en échec depuis plus de 1 h » ·
                 seuil 48 h → « Versements en échec depuis plus de 48 h ».
```

---

## Chapitre 4.5 — Notation : relances et révélation (`rating`)

| Fiche | Ce qui est éprouvé | Verdict | Preuve |
|---|---|---|---|
| CRON-NOTATION-1 | La première relance part à J+5 | **Conforme** | 2 événements `booking.rating_reminder`, `reminderNumber: 1`, un par rôle non notant ; `ratingRemindersSent` 0 → 1 |
| CRON-NOTATION-2 | La révélation à la fin de la fenêtre | **Conforme** | sans note : `ratingsRevealedAt` posé, **aucun** événement ; avec une note : `Review.revealedAt` posé **dans la même transaction** et `booking.rating_revealed` émis |
| CRON-NOTATION-3 | Ce que la tâche ne doit pas faire | **Conforme** | fenêtre ouverte → `revealElapsed → 0` ; `ratingRemindersSent: 1` à J+5 (indice attendu 0) → `sendRatingReminders → 0` |
| CRON-NOTATION-4 | Jamais deux relances ni deux révélations | **Conforme** | rejeu → `0`, compteur figé, `ratingsRevealedAt` inchangé, aucun événement de plus |
| CRON-NOTATION-5 | Le compteur avance même sans cible | **Conforme** | les deux parties ont noté → `sendRatingReminders → 0` (aucun événement) **et** `ratingRemindersSent` 0 → 1 |

La seconde relance (J+7) a été jouée aussi : `reminderNumber: 2`, un par rôle, compteur à 2. Les
quatre événements de relance portent bien `reminderNumber` et `targetRole`, ce qui permet au
consommateur de choisir le destinataire sans relire la réservation.

---

## Chapitre 4.6 — Récapitulatif quotidien (`ops-digest`)

| Fiche | Ce qui est éprouvé | Verdict | Preuve |
|---|---|---|---|
| CRON-DIGEST-1 | Le récapitulatif part avec ses listes | **Conforme** | un email au support, en français, daté, avec corridor, statut, identifiant, montant en euros et lien **vers le back-office** (`:3001/deals/<id>`), jamais vers l'application membre |
| CRON-DIGEST-2 | Rien à signaler, rien à envoyer | **Conforme** | trois listes vidées → `envoyé : false`, **aucun** email |
| CRON-DIGEST-3 | Aucun dédoublonnage : un email par passage | **Conforme** | deux passages de plus → 3 emails en boîte. C'est voulu : la protection de cette tâche est son horaire (une fois par jour), pas un verrou |
| CRON-DIGEST-4 | L'erreur d'envoi remonte | **Conforme** | Mailpit arrêté → le passage lève, et le battement porte **`ok: false`** avec `connect ECONNREFUSED ::1:1025`. La panne est visible, elle n'est pas avalée |

Extrait de l'email réel, qui montre les quatre exigences de la fiche en une ligne :

```
Transferts renversés par Stripe (1)
 • Paris → Brazzaville · COMPLETED · 6aa0a47a…f656 — 30,00 € — depuis le 09/09/2026
   — http://localhost:3001/deals/6aa0a47a…f656
```

---

## Chapitre 4.7 — Relance des messages non lus (`unread-reminder`)

| Fiche | Ce qui est éprouvé | Verdict | Preuve |
|---|---|---|---|
| CRON-RELANCE-1 | Le message non lu déclenche une relance | **Conforme** | email « X t'a écrit à propos de Paris → New York », **sans le texte du message**, avec le rappel « le code de livraison se donne en main propre » |
| CRON-RELANCE-2 | Les six cas où la relance ne part pas | **Conforme** | matrice complète jouée sur la règle pure : `NO_MESSAGE`, `NOT_FROM_COUNTERPART` (moi auteur **et** message SYSTEM), `TOO_RECENT`, `ALREADY_READ`, `ALREADY_REMINDED`, `RATE_LIMITED` — 8 cas, 8 verdicts justes |
| CRON-RELANCE-3 | Le verrou optimiste empêche le double envoi | **Conforme** | second passage → `sent: 0`, `shipperRemindedAt` inchangé |
| CRON-RELANCE-4 | Les délais sont lus dans les paramètres | **Conforme** | `{"delayMinutes":15,"minIntervalMinutes":60}` viennent bien des paramètres, pas de constantes |
| CRON-RELANCE-5 | Le destinataire qui a coupé les relances | **Conforme** | aucun email, **et le verrou est quand même posé** — c'est ce que la fiche exige |

### Anomalie du chapitre 4.7

```
ANO-CRON-04
Fiche          : CRON-RELANCE-5 (observé en marge de la fiche) · Gravité : MINEURE
                 (échelle du cahier : « un battement dont le summary ne compte pas ce qu'il
                 annonce ») · ÉTAT : CLOSE
Attendu        : le résumé du battement dit ce qui s'est réellement passé
Obtenu         : destinataire ayant coupé les relances → `{"scanned":2,"sent":1,"failed":0}`
                 et **zéro email** dans Mailpit. Le battement annonçait donc
                 « 1 relance(s), 0 échec(s) » pour aucune relance envoyée.
Nuance impor-  Ce n'était PAS un oubli : un test existant l'assertait, commentaire à l'appui
tante          (« remind() a "réussi" sans envoyer : pas une erreur »). L'intention était de
                 distinguer le succès de l'échec — ce qui est juste. Le défaut n'est donc pas
                 le comptage en soi mais le fait que **deux issues différentes portent le même
                 nom** : « relance envoyée » recouvrait « email parti » et « envoi
                 volontairement omis ».
Impact         : le battement est la seule fenêtre de l'exploitant sur cette tâche. Un chiffre
                 qui ne compte pas ce qu'il annonce est pire qu'un chiffre absent : il rassure
                 à tort, et il masque une éventuelle vraie panne d'envoi.
Correction     : `remind()` rend `"SENT" | "SKIPPED"` ; `runOnce` rend
                 `{ scanned, sent, skipped, failed }` et le résumé devient
                 « N relance(s), M ignorée(s), K échec(s) ». Le verrou reste réclamé AVANT
                 l'envoi (exigence de la fiche) et une omission volontaire reste distincte
                 d'une erreur. Le test d'origine est conservé dans son intention, avec le
                 contrat précisé.
Contre-épreuve : membre ayant coupé → `{"sent":0,"skipped":1,"failed":0}` et 0 email ;
                 membre normal → `{"sent":1,"skipped":0,"failed":0}` et 1 email.
```
