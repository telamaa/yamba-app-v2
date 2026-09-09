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

---

## Chapitre 4.8 — Purge des conversations (`conversation-retention`)

| Fiche | Ce qui est éprouvé | Verdict | Preuve |
|---|---|---|---|
| CRON-PURGEFIL-1 | La conversation d'un vieux deal disparaît | **Conforme** | `{examined:1, purged:1}` ; conversation, 2 messages, 1 rendez-vous supprimés — et le **signalement de modération conservé** |
| CRON-PURGEFIL-2 | Les trois cas de non-purge | **Conforme** | deal `ACCEPTED` → `purged:0` · deal `DISPUTED` → `purged:0` · activité d'hier sur un deal clos il y a deux ans → même pas examiné (`examined:0`) |
| CRON-PURGEFIL-3 | Rejouer ne casse rien | **Conforme** | `{examined:0, purged:0}` deux fois, sans erreur |

Le troisième cas de PURGEFIL-2 est celui que le cahier désigne comme le plus fragile — l'ancre est
la **plus tardive** des deux dates, pas la seule fin du deal. Il tient.

---

## Chapitre 4.9 — Purge des événements publiés (`outbox-retention`)

| Fiche | Ce qui est éprouvé | Verdict | Preuve |
|---|---|---|---|
| CRON-PURGEOUT-1 | La purge des publiés anciens | **Conforme** | horloge avancée de 200 j → 173 événements `booking` supprimés |
| CRON-PURGEOUT-2 | Un événement parqué n'est jamais purgé | **Non conforme** | **il a été supprimé** → `ANO-CRON-05`, bloquante |
| — | Chaque service ne purge que son agrégat | **Conforme** | la purge `booking` a laissé les **11** événements `conversation` intacts ; la purge `conversation` les a ensuite pris |

### Anomalie du chapitre 4.9

```
ANO-CRON-05
Fiche          : CRON-PURGEOUT-2 · Gravité : BLOQUANTE · ÉTAT : CLOSE
Appel exact    : créer un événement { publishedAt: null, attempts: 10 }, puis
                 npx tsx --env-file=.env scripts/recette/purgeout.ts booking
Attendu        : « Un événement jamais publié n'est jamais supprimé […] c'est la piste
                 d'audit, c'est intentionnel, et c'est une exigence de conformité » (cahier
                 §4.9). `CLAUDE.md` dit la même chose.
Obtenu         : l'événement parqué est **supprimé**.
Cause          : le cron décide dans la requête :
                   deleteMany({ where: { aggregateType, publishedAt: { lt: cutoff } } })
                 Or sur MongoDB, `null` précède les dates dans l'ordre des types BSON :
                 **`null < n'importe quelle date` est VRAI**. Mesuré séparément, sur deux
                 événements créés à l'instant :
                   publishedAt = null   → attrapé par `lt: (il y a 90 j)`
                   publishedAt ABSENT   → non attrapé
                 Et le writer pose `publishedAt: null` explicitement (règle A49 du dépôt) :
                 **tous** les événements non publiés sont donc concernés.
Impact         : la purge nocturne supprimait tout événement non encore publié, **à
                 n'importe quel âge**. Deux conséquences :
                 · un événement que le relais n'a pas eu le temps de publier (courtier
                   arrêté à 03:55) est détruit — la notification et l'email ne partiront
                   jamais, et il n'en reste aucune trace ;
                 · les événements PARQUÉS, que la conformité exige de conserver,
                   disparaissent — c'est la piste d'audit qui s'efface toute seule.
                 La règle pure `isOutboxEventPurgeable` disait pourtant la vérité
                 (`!!e.publishedAt && olderThan(...)`) : elle n'était simplement pas utilisée.
Correction     : filtre explicite dans les DEUX services (deal et message) —
                   AND: [{ publishedAt: { not: null } }, { publishedAt: { lt: cutoff } }]
                 vérifié CONTRE LA BASE avant d'être écrit : sur quatre événements témoins
                 (publié ancien, publié récent, null, champ absent), l'ancien filtre en prenait
                 deux, le nouveau n'en prend qu'un — le bon.
Contre-épreuve : un parqué (jamais publié) et un publié il y a 500 j → la purge supprime
                 **le publié seulement**, le parqué reste. Tests : `outbox-purge.spec.ts` (5 cas),
                 dont un garde-fou qui lit la source du cron et interdit le retour du filtre nu.
```

### Pourquoi la famille est saine ailleurs — l'observation qui vaut la correction

Le même piège pouvait exister partout où une **date nullable** est comparée avec `lt`. Quatre
autres endroits comparent des dates dans des opérations destructrices ou décisives :

| Endroit | Champ | Nullable ? | Verdict |
|---|---|---|---|
| `notification-service/retention.cron` | `createdAt`, `claimedAt` ×2 | **non** (`@default(now())`) | sans risque |
| `conversation-retention` | `updatedAt` | **non** (`@updatedAt`) | sans risque |
| `recipient-redaction` | `completedAt`, `closedAt` | **oui** | **sûr quand même** |
| `complete-trips` | `arrivalAt`, `departureAt` | **oui** | **sûr quand même** |

Les deux derniers sur-sélectionnent bel et bien — un `completedAt` à `null` passe le filtre — mais
**ils ne décident pas dans la requête** : chaque candidat repasse ensuite devant une règle pure
(`isRecipientRedactable`, `canPerform` avec `isPastArrival`) avant la moindre écriture.

C'est exactement ce qui manquait au cron de l'outbox : un `deleteMany` **décide et écrit d'un seul
geste**, sans rien derrière lui. La leçon générale, à retenir au-delà de cette anomalie :

> Une requête large est sans danger **tant qu'une règle pure tranche derrière**. Elle devient
> fatale le jour où la requête EST la décision.

---

## Chapitre 4.10 — Effacement du destinataire (`recipient-redaction`)

Tâche de conformité : le destinataire d'un colis est un **tiers sans compte**, qui n'a rien signé.

| Fiche | Ce qui est éprouvé | Verdict | Preuve |
|---|---|---|---|
| CRON-DESTINATAIRE-1 | Le tiers est effacé après la rétention | **Conforme** | `{"firstName":"—","lastName":"—","phoneE164":"+00000000000","email":null}` — le tiret est bien le cadratin U+2014, et l'email passe à `null`, pas à une chaîne vide |
| CRON-DESTINATAIRE-2 | Les trois cas de non-effacement | **Conforme** | deal `PICKED_UP` → `examined:0` · terminé il y a 10 j (délai 30) → `examined:0` · déjà effacé → `examined:0` |
| CRON-DESTINATAIRE-3 | Jamais deux effacements | **Conforme** | rejeu → `{examined:0, redacted:0}`, `recipientRedactedAt` **inchangé au milliseconde près** |
| CRON-DESTINATAIRE-4 | Le délai est lu dans les paramètres | **Conforme** | à 30 j, une réservation de 15 j n'est pas candidate ; le délai ramené à 7 j, la **même** réservation est effacée |

---

## Chapitre 4.11 — Conservation générale (`retention`, notification-service)

| Fiche | Ce qui est éprouvé | Verdict | Preuve |
|---|---|---|---|
| CRON-CONSERV-1 | Les trois collections sont purgées | **Conforme** | horloge +400 j → `{"notifications":135,"emailDeliveries":133,"consumedEvents":161}`, les trois à zéro |
| CRON-CONSERV-2 | Chaque durée est indépendante | **Conforme** | trois lignes de **100 jours** : seul `ConsumedEvent` (seuil 90 j) tombe ; `Notification` et `EmailDelivery` (365 j) restent |
| CRON-CONSERV-3 | La purge n'efface pas ce qui n'est pas à elle | **Conforme** | horloge +4000 j → boîte d'envoi, réservations, signalements et comptes **inchangés** au document près |
| CRON-CONSERV-4 | Le registre purgé rouvre le retraitement | **Conforme** | événements republiés **sans** purge → ignorés (2 emails, registre à 2) ; registre purgé puis republiés → **retraités** (2 → 4 emails) |

**La nuance de CONSERV-4, qui mérite d'être connue de l'exploitant.** Après purge du registre, les
événements republiés produisent bien de **nouveaux emails** — mais **pas** de nouvelles
notifications : leur matérialisation est un « insère ou met à jour » sur le couple (événement,
destinataire), qui absorbe le rejeu. Autrement dit, les deux canaux n'ont pas la même protection :
la notification est idempotente par construction, l'email l'est par le registre. Purger le registre
plus court que la rétention de la boîte d'envoi exposerait donc à des emails en double. Avec les
défauts (registre 90 j, boîte d'envoi 90 j), le cas ne peut pas se produire — c'est une contrainte
à garder en tête si l'un des deux réglages bouge.

---

## Chapitre 4.12 — Rappels d'inscription Voyageur (`onboarding-reminder`)

| Fiche | Ce qui est éprouvé | Verdict | Preuve |
|---|---|---|---|
| CRON-ONBOARD-1 | Les trois rappels partent dans l'ordre | **Conforme** | « Plus qu'une étape pour devenir Voyageur » → « Ton profil Voyageur t'attend » → « Dernière chance de finaliser ton profil », aux délais 24 h / 72 h / 168 h |
| CRON-ONBOARD-2 | Les cas de non-envoi | **Conforme** | matrice complète sur la règle pure : 11 cas, 11 verdicts justes |
| CRON-ONBOARD-3 | Jamais un quatrième rappel | **Conforme** | `reminderCount ≥ 3` → `sent: 0`, même sur une page très ancienne |
| CRON-ONBOARD-4 | Le compte abandonné n'est pas réveillé | **Conforme** | page de plus de **30 jours** → aucun rappel. C'est la garde ajoutée avec A148 : brancher le cron sans elle aurait envoyé « dernière chance » à des comptes abandonnés depuis des mois |
| CRON-ONBOARD-5 | L'intervalle minimum entre deux rappels | **Conforme** | un rappel il y a moins de **12 h** → aucun envoi, même si le délai du palier est atteint |

**Un piège de recette utile à noter.** Les rappels 2 et 3 ne partaient pas alors que la page était
suffisamment vieille : la cause n'était pas un défaut mais **l'intervalle minimum de 12 h** entre
deux rappels, que j'avais laissé à « il y a quelques secondes » en jouant le rappel 1 juste avant.
Le champ à vieillir est `CarrierPage.lastReminderSentAt` — et non un champ `onboardingLastReminderSentAt`,
qui n'existe pas. Vérifier les noms de champs **dans le schéma** avant d'accuser le code : la
première tentative écrivait dans le vide.

---

## Chapitre 5 — Relais d'événements

| Fiche | Ce qui est éprouvé | Verdict | Preuve |
|---|---|---|---|
| CRON-RELAIS-1 | L'événement de la transaction est publié | **Conforme** | les deux événements d'une expiration retrouvés dans `booking-events`, clé = `aggregateId` |
| CRON-RELAIS-2 | L'ordre par agrégat | **Conforme** | même agrégat = **même partition**, dans l'ordre : `requested` → `payment_authorized` → `cancelled` (partition 5), `rating_reminder` ×2 → `rating_revealed` (partition 1) |
| CRON-RELAIS-3 | Le bail d'exclusivité | **Conforme** | deux instances deal-service (6003 et 6903) : le bail a **un seul** propriétaire, et `Event published` n'apparaît que dans **un** journal (B : 2, A : 0) |
| CRON-RELAIS-4 | Chaque relais ne draine que son domaine | **Conforme** | `messaging-events` ne contient que des agrégats `conversation` ; `booking-events` que des `booking` |
| CRON-RELAIS-5 | L'empoisonné est parqué, jamais supprimé | **Conforme** | `seed-outbox --with-poison` : 6 sains publiés, 1 parqué à exactement 10 tentatives, toujours en base |
| CRON-RELAIS-6 | Le sujet absent | **Comportement modifié** | voir « la décision qui découle d'ANO-CRON-06 » ci-dessous |
| CRON-RELAIS-7 | Le courtier redémarre en cours de route | **Non conforme** | → `ANO-CRON-06`, majeure |
| CRON-RELAIS-8 | Le relais coupé, l'application vit | **Conforme** | `Outbox relay disabled` au démarrage, API à 200, expiration effectuée, événements **en attente** avec `attempts: 0` — rien n'est perdu, rien ne part |
| CRON-RELAIS-9 | Aucun secret dans un payload | **Conforme** | 36 messages, **52 clés distinctes** analysées : aucun code de livraison, aucun destinataire, aucune adresse email, aucun jeton. Seuls des identifiants, un corridor, des montants et des dates |

### Anomalie du chapitre 5

```
ANO-CRON-06
Fiche          : CRON-RELAIS-7 · Gravité : MAJEURE (échelle du cahier : « un événement sain
                 parqué ») · ÉTAT : CLOSE
Attendu        : garantie n° 6 du cahier — « Une panne de courtier n'incrémente JAMAIS
                 `attempts` […] sans cette exclusion, une panne de dix minutes parquerait des
                 dizaines d'événements parfaitement sains. »
Obtenu         : courtier arrêté (`docker stop yamba-redpanda`), puis mesure directe.
                 · relais des RÉSERVATIONS : `attempts` passe à 1 puis se stabilise, avec
                   `KafkaJSNonRetriableError: Connection error`. L'exclusion ne couvrait que
                   `KafkaJSNumberOfRetriesExceeded` et `KafkaJSConnectionError` — kafkajs lève
                   ici un TROISIÈME nom. Dix pannes successives suffisent à parquer.
                 · relais de la MESSAGERIE : aucune classification du tout. Mesuré, sur un
                   événement parfaitement sain, courtier éteint :
                       2 → 5 → 7 → 10 tentatives en 100 secondes → **PARQUÉ**
                   et il l'est resté après le retour du courtier.
Impact         : une panne de courtier d'une minute et demie suffisait à perdre définitivement
                 les notifications et emails de toute la messagerie en attente. Avant la
                 correction d'`ANO-CRON-02`, ces événements étaient irrécupérables.
Cause          : la classification se faisait par NOM d'erreur. Énumérer les noms est une course
                 perdue : kafkajs en ajoute, et il enveloppe volontiers une panne de connexion
                 dans un nom générique.
Correction     : `isBrokerUnavailable` dans `@packages/messaging` — pure, testée, partagée par
                 les deux relais. Elle classe par **cause** : elle suit la chaîne
                 `cause` / `originalError` (bornée à 5 niveaux, résistante aux cycles) et cherche
                 la signature d'un courtier injoignable, par nom **ou** par message.
                 `KafkaJSNonRetriableError` n'est **pas** exclu en bloc — il enveloppe aussi de
                 vrais poisons (message trop gros) — seulement quand sa cause parle de connexion.
                 Le relais de la messagerie trace désormais l'erreur **sans compter** et sort du
                 lot : inutile d'insister quand le courtier est injoignable.
Contre-épreuve : la MÊME panne de 100 secondes qui portait l'événement de 0 à 10 tentatives le
                 laisse maintenant à **0**, l'erreur restant tracée dans `lastError` pour
                 l'exploitant. Courtier relancé → publié. Tests : `broker-unavailable.spec.ts`
                 (6 cas, dont la forme exactement relevée en recette et un vrai poison qui doit
                 rester un poison).
```

### La décision qui découle d'ANO-CRON-06 — à porter au registre

En rejouant CRON-RELAIS-6 (**sujet supprimé du courtier**), l'erreur remontée est
`This server does not host this topic-partition`, que kafkajs finit par présenter sous le nom
`KafkaJSNumberOfRetriesExceeded` — **le même nom qu'une panne**. Conséquence directe :

| | Avant | Après |
|---|---|---|
| Relais réservations, sujet absent | rejeu sans fin (le nom était déjà exclu) | rejeu sans fin |
| Relais messagerie, sujet absent | **parqué au bout de 10 tentatives** | rejeu sans fin |

Les deux relais se comportent donc désormais **de la même façon**, ce qui n'était pas le cas
avant. Et le cahier, qui décrit le parcage comme le résultat attendu de CRON-RELAIS-6, décrit en
réalité l'ancien comportement du seul message-service.

**Ce changement est-il souhaitable ?** Oui, et c'est un choix, pas un effet de bord :

- un sujet absent est un défaut d'**infrastructure**, réparable en une commande — le parcage, lui,
  fait sortir l'événement de la file **définitivement** ;
- le signal existe déjà et il est meilleur : `OUTBOX_LAGGING_15MIN` s'est déclenchée dès que
  l'événement a dépassé 15 minutes d'attente — *« Le plus ancien événement non publié attend
  depuis 20 min (seuil 15). Redpanda ou le relais est arrêté ? »* ;
- **contre-épreuve** : sujet recréé → l'événement est publié **tout seul**, `attempts: 0`, jamais
  perdu.

À porter au registre comme décision (« un défaut d'infrastructure se signale par le retard, il ne
se solde pas par un parcage »), et à corriger dans le cahier, fiche CRON-RELAIS-6.

### Un incident de recette qui vaut une observation

Une première mesure de CRON-RELAIS-8 a montré les événements **publiés** alors que le relais était
coupé. Cause : un deal-service **fantôme** d'un `npm run dev` antérieur tournait encore, sans
détenir le port 6003, mais avec son relais actif — c'est lui qui publiait. Deux leçons :

1. sur un poste de recette, vérifier **qui détient le bail** (`RelayLease.owner` porte le PID)
   avant de conclure qu'un composant est coupé ;
2. le bail a parfaitement joué son rôle — c'est même ainsi que CRON-RELAIS-3 s'est vérifié : deux
   instances, **une seule** publie.

---

# Point d'étape de la campagne (chapitres 4 et 5)

**53 fiches sur 90 jouées.** Chapitres 4 (les treize tâches planifiées) et 5 (les relais)
terminés ; restent les chapitres 6 (consommateurs, 8 fiches), 7 (battements et moniteur externe,
7 fiches) et 8 (sécurité et conformité, 9 fiches), plus la consignation du §9.

## Anomalies

| Anomalie | Fiche | Gravité | État | En une phrase |
|---|---|---|---|---|
| ANO-CRON-01 | CRON-TRAJETS-1 | mineure | **close** | le compteur public d'un Voyageur descendait à **-1**, et le nombre sortait tel quel sur l'API publique |
| ANO-CRON-02 | CRON-ALERTES-1 | **majeure** | **close** | quatre événements de litige **parqués depuis le 4 septembre**, redevenus valides, sans aucun moyen de les libérer — deux litiges dont les parties n'ont jamais su la décision |
| ANO-CRON-03 | CRON-ALERTES-4 | cosmétique | **close** | le titre d'une alerte annonçait « plus de 48 h » quel que soit le seuil réglé |
| ANO-CRON-04 | CRON-RELANCE-5 | mineure | **close** | le battement annonçait « 1 relance(s) » pour zéro email envoyé |
| ANO-CRON-05 | CRON-PURGEOUT-2 | **BLOQUANTE** | **close** | la purge nocturne supprimait **tout événement non publié**, à n'importe quel âge — parqués compris |
| ANO-CRON-06 | CRON-RELAIS-7 | **majeure** | **close** | une panne de courtier de **100 secondes** parquait définitivement les événements sains de la messagerie |

**Six anomalies, six closes**, toutes contre-éprouvées sur les services réels.

## Ce que cette moitié de campagne apprend

**1. Les deux anomalies les plus graves sont des pertes silencieuses.** `ANO-CRON-05` et
`ANO-CRON-06` détruisent ou immobilisent des événements *sans que rien ne réponde en erreur* :
l'API dit 200, la transaction est committée, et la notification ne part jamais. C'est la signature
d'un défaut de tâche de fond, et c'est précisément pourquoi ce cahier existe.

**2. Une requête large est sans danger tant qu'une règle pure tranche derrière.** Quatre endroits
comparent une date nullable avec `lt` ; trois sont sûrs parce qu'ils repassent chaque candidat
devant une règle pure. Le quatrième — le `deleteMany` de la boîte d'envoi — **décidait et écrivait
d'un seul geste**. C'est la différence entre sur-sélectionner et se tromper.

**3. Énumérer les noms d'erreur d'une bibliothèque est une course perdue.** Le commentaire du
relais racontait déjà un piège payé une fois, et deux noms avaient été ajoutés. kafkajs en a sorti
un troisième. La classification par **cause** est la seule qui vieillisse bien.

**4. Un test peut asserter le défaut.** `ANO-CRON-04` était couverte par un test qui exigeait le
comptage inexact, commentaire à l'appui. Le défaut n'était pas le comptage mais le fait que deux
issues différentes portaient le même nom. Quand un test et un symptôme se contredisent, relire le
test d'abord.

**5. Une preuve d'absence se construit.** « Aucun secret ne circule » ne se lit pas : les 36
messages du courtier ont été analysés champ par champ — **52 clés distinctes**, aucun code de
livraison, aucun destinataire, aucune adresse.
