# YAMBA — PARAMÈTRES DE LA PLATEFORME (généré, D62)

> Fichier GÉNÉRÉ par `npx tsx scripts/generate-settings-doc.ts` depuis le catalogue
> `packages/libs/api-contracts/src/admin/platform-settings.schema.ts`. Ne pas éditer à la main :
> la page admin « Paramètres », ses info-bulles, l'OpenAPI et ce document lisent la même source.
> Les valeurs ci-dessous sont les **défauts** (= le code au moment de la gravure) ; les valeurs
> en vigueur se lisent dans l'admin ou par `seed-settings.ts --show`.

## Trois classes (D62 2A)

- **A — réglable en ligne** : 40 clés ci-dessous. Portée **métier** = super administrateur seul ; portée **exploitation** = profil Exploitation (OPS) ou super administrateur. Lecture ouverte à tous les profils.
- **B — modifiable par déploiement seulement** : les invariants de sécurité (liste en fin de document).
- **C — prévue, pas encore lue par le code** : nommée au §13 des règles métier, absente de la page tant qu'aucun consommateur n'existe.

Règles communes : motif ≥ 20 caractères, une ligne de journal par clé (avant / après), email à tous les super administrateurs, effet dans les 30 s, **jamais rétroactif** (snapshot de réservation, COM-04 / PRC-08). Bornes et cohérence (S ≤ M ≤ L, intervalle de relance ≥ délai, plafond de Garantie ≥ prime, top ≥ confirmé) refusées côté serveur quel que soit le rôle.

## Prix et commission

| Clé | Libellé | Défaut | Bornes | Portée | Règle | Lu par |
|---|---|---|---|---|---|---|
| `pricing.commissionPct` | Commission Yamba *(CGU)* | **12 %** | 5 % → 20 % | métier | D16 · COM-01 | deal-service, trip-service, user-ui |
| `pricing.commissionFloorCents` | Plancher de commission *(CGU)* | **3,00 €** | 1,00 € → 10,00 € | métier | D16 · COM-02 | deal-service, trip-service, user-ui |
| `pricing.minBillableKg` | Poids facturable minimum | **0.5 kg** | 0.1 kg → 2 kg | métier | D32 · PRC-06 | deal-service, trip-service, user-ui |
| `pricing.minTransportCents` | Prix minimum par colis *(CGU)* | **8,00 €** | 1,00 € → 30,00 € | métier | D32 · PRC-06 | deal-service, trip-service, user-ui |
| `pricing.referenceKg` | Colis de référence (comparabilité) | **2 kg** | 1 kg → 10 kg | métier | D33 | trip-service |
| `pricing.sizeCoefS` | Coefficient taille S | **× 1** | × 0.5 → × 2 | métier | PRC-03 | deal-service, user-ui |
| `pricing.sizeCoefM` | Coefficient taille M | **× 1.1** | × 0.5 → × 2 | métier | PRC-03 | deal-service, user-ui |
| `pricing.sizeCoefL` | Coefficient taille L | **× 1.25** | × 0.5 → × 2 | métier | PRC-03 | deal-service, user-ui |

- **Commission Yamba** (`pricing.commissionPct`) — Pourcentage prélevé sur le transport, payé par l'Expéditeur ; les frais Stripe sont absorbés dedans. Ne change rien aux réservations déjà faites : leur prix est figé (COM-04, PRC-08). *Exemple : Transport 20 € → commission 2,40 € (12 %).*
- **Plancher de commission** (`pricing.commissionFloorCents`) — La commission ne descend jamais sous ce montant, même sur un petit colis. Ne change rien aux réservations déjà faites : leur prix est figé (COM-04, PRC-08). *Exemple : Transport 8 € → 12 % = 0,96 €, plancher 3 € appliqué.*
- **Poids facturable minimum** (`pricing.minBillableKg`) — Un colis plus léger est facturé comme s'il pesait ce poids (standard courrier / express). *Exemple : Colis de 0,2 kg à 10 €/kg → facturé 0,5 kg = 5 €.*
- **Prix minimum par colis** (`pricing.minTransportCents`) — Le transport d'un colis ne descend jamais sous ce montant : le coût réel du Voyageur est le temps, pas le poids. Ne change rien aux réservations déjà faites : leur prix est figé (COM-04, PRC-08). *Exemple : 0,5 kg à 10 €/kg = 5 € → 8 € appliqués.*
- **Colis de référence (comparabilité)** (`pricing.referenceKg`) — Poids du colis de référence qui rend les offres comparables dans la recherche (tri par prix). Les trajets déjà publiés gardent leur valeur jusqu'au script de recalcul. *Exemple : 12 €/kg → prix comparable 24 €.*
- **Coefficient taille S** (`pricing.sizeCoefS`) — Multiplicateur du transport pour un petit colis. Doit rester ≤ M ≤ L.
- **Coefficient taille M** (`pricing.sizeCoefM`) — Multiplicateur du transport pour un colis moyen.
- **Coefficient taille L** (`pricing.sizeCoefL`) — Multiplicateur du transport pour un grand colis. *Exemple : Transport 20 € en L → 25 €.*

## Garantie Yamba

| Clé | Libellé | Défaut | Bornes | Portée | Règle | Lu par |
|---|---|---|---|---|---|---|
| `protection.extendedPremiumCents` | Prime Garantie étendue *(CGU)* | **6,00 €** | 0,00 € → 50,00 € | métier | D22 · GAR-06 | deal-service, user-ui |
| `protection.extendedCapCents` | Plafond Garantie étendue *(CGU)* | **500,00 €** | 100,00 € → 2000,00 € | métier | D22 · GAR-03 | deal-service, user-ui |

- **Prime Garantie étendue** (`protection.extendedPremiumCents`) — Prix payé par l'Expéditeur pour la Garantie étendue, ajouté au total. Ne change rien aux réservations déjà faites : leur prix est figé (COM-04, PRC-08).
- **Plafond Garantie étendue** (`protection.extendedCapCents`) — Valeur maximale couverte par la Garantie étendue. Figure dans les CGU.

## Annulation

| Clé | Libellé | Défaut | Bornes | Portée | Règle | Lu par |
|---|---|---|---|---|---|---|
| `cancellation.fullRefundUntilHours` | Remboursement intégral jusqu'à *(CGU)* | **48 h** | 0 h → 168 h | métier | ANN-01 · D21 | deal-service |
| `cancellation.lateRetentionPct` | Retenue d'annulation tardive *(CGU)* | **50 %** | 0 % → 100 % | métier | ANN-01 · D39 · D50 | deal-service |

- **Remboursement intégral jusqu'à** (`cancellation.fullRefundUntilHours`) — Nombre d'heures avant le départ jusqu'auquel une annulation après acceptation est remboursée à 100 %. En deçà, la retenue s'applique. *Exemple : Départ samedi 10 h : intégral jusqu'à jeudi 10 h.*
- **Retenue d'annulation tardive** (`cancellation.lateRetentionPct`) — Part du total retenue quand l'Expéditeur annule après la fenêtre ; le Voyageur en reçoit sa part nette au prorata. *Exemple : Total 30 € annulé la veille → 15 € rendus.*

## Notation

| Clé | Libellé | Défaut | Bornes | Portée | Règle | Lu par |
|---|---|---|---|---|---|---|
| `rating.windowDays` | Fenêtre de notation *(CGU)* | **14 j** | 1 j → 60 j | métier | D53 · RG-NOTE-01 | deal-service |

- **Fenêtre de notation** (`rating.windowDays`) — Jours pendant lesquels les deux parties peuvent se noter après la fin du deal ; les notes se révèlent à la fin de la fenêtre ou quand les deux ont noté.

## Litiges

| Clé | Libellé | Défaut | Bornes | Portée | Règle | Lu par |
|---|---|---|---|---|---|---|
| `dispute.responseDelayHours` | Délai de réponse au litige | **72 h** | 12 h → 336 h | métier | D55 1A · RG-MED-02 | deal-service |

- **Délai de réponse au litige** (`dispute.responseDelayHours`) — Heures laissées au Voyageur pour donner sa version avant que le litige devienne décidable sans elle. *Exemple : Litige ouvert lundi 9 h → décidable jeudi 9 h.*

## Réputation

| Clé | Libellé | Défaut | Bornes | Portée | Règle | Lu par |
|---|---|---|---|---|---|---|
| `reputation.carrier.confirmedMinDeals` | Voyageur confirmé : deals minimum | **3** | 1 → 50 | métier | D29① · REP-03 | deal-service |
| `reputation.carrier.topMinDeals` | Voyageur top : deals minimum | **10** | 1 → 200 | métier | REP-03 | deal-service |
| `reputation.carrier.topMinRating` | Voyageur top : note minimale | **4.8 / 5** | 3 / 5 → 5 / 5 | métier | REP-03 | deal-service |
| `reputation.carrier.topMaxLateCancellations` | Voyageur top : annulations tolérées | **0** | 0 → 10 | métier | REP-03 | deal-service |
| `reputation.shipper.confirmedMinDeals` | Expéditeur fiable : deals minimum | **3** | 1 → 50 | métier | REP-03 | deal-service |
| `reputation.shipper.topMinDeals` | Expéditeur top : deals minimum | **5** | 1 → 200 | métier | REP-03 | deal-service |
| `reputation.shipper.topMinRating` | Expéditeur top : note minimale | **4.8 / 5** | 3 / 5 → 5 / 5 | métier | REP-03 | deal-service |
| `reputation.shipper.topMaxLateCancellations` | Expéditeur top : annulations tardives tolérées | **0** | 0 → 10 | métier | REP-03 | deal-service |

- **Voyageur confirmé : deals minimum** (`reputation.carrier.confirmedMinDeals`) — Nombre de deals terminés à partir duquel un Voyageur passe de « nouveau » à « confirmé ».
- **Voyageur top : deals minimum** (`reputation.carrier.topMinDeals`) — Deals terminés nécessaires au niveau « top » (avec la note et les annulations ci-dessous).
- **Voyageur top : note minimale** (`reputation.carrier.topMinRating`) — Moyenne révélée minimale pour le niveau « top ».
- **Voyageur top : annulations tolérées** (`reputation.carrier.topMaxLateCancellations`) — Annulations après acceptation tolérées pour rester « top ».
- **Expéditeur fiable : deals minimum** (`reputation.shipper.confirmedMinDeals`) — Deals terminés à partir desquels un Expéditeur est « confirmé ».
- **Expéditeur top : deals minimum** (`reputation.shipper.topMinDeals`) — Deals terminés nécessaires au niveau « top » côté Expéditeur.
- **Expéditeur top : note minimale** (`reputation.shipper.topMinRating`) — Moyenne révélée minimale pour le niveau « top » côté Expéditeur.
- **Expéditeur top : annulations tardives tolérées** (`reputation.shipper.topMaxLateCancellations`) — Annulations tardives tolérées pour rester « top » côté Expéditeur.

## Messagerie

| Clé | Libellé | Défaut | Bornes | Portée | Règle | Lu par |
|---|---|---|---|---|---|---|
| `messaging.writeDaysAfterEnd` | Fil ouvert après la fin du deal | **14 j** | 0 j → 90 j | métier | D61 2A · RG-FCH-07 | message-service |
| `messaging.phoneRevealLeadHours` | Numéro révélé avant le rendez-vous | **2 h** | 0 h → 72 h | métier | D61 4A | message-service |
| `messaging.retentionDays` | Conservation des conversations | **365 j** | 30 j → 1095 j | exploitation | D61 8A · RG-FCH-22 | message-service |
| `messaging.reminderDelayMinutes` | Relance email après | **15 min** | 1 min → 1440 min | exploitation | D61 6A · RG-FCH-17 | message-service |
| `messaging.reminderMinIntervalMinutes` | Au plus une relance toutes les | **60 min** | 5 min → 1440 min | exploitation | D61 6A · RG-FCH-17 | message-service |

- **Fil ouvert après la fin du deal** (`messaging.writeDaysAfterEnd`) — Jours pendant lesquels on peut encore écrire dans la conversation après la fin du deal ; ensuite lecture seule.
- **Numéro révélé avant le rendez-vous** (`messaging.phoneRevealLeadHours`) — Heures avant le rendez-vous de remise (à défaut le départ) à partir desquelles le numéro de l'autre partie peut être affiché. *Exemple : Remise à 14 h → numéro disponible dès 12 h.*
- **Conservation des conversations** (`messaging.retentionDays`) — Jours après la fin du deal (ou la dernière activité) au bout desquels la conversation est purgée ; les signalements survivent.
- **Relance email après** (`messaging.reminderDelayMinutes`) — Minutes pendant lesquelles un message doit rester non lu avant l'email de relance (le cron passe toutes les 5 min).
- **Au plus une relance toutes les** (`messaging.reminderMinIntervalMinutes`) — Intervalle minimal entre deux emails de relance pour une même conversation et un même destinataire. Doit rester ≥ le délai de relance.

## Alertes d'exploitation

| Clé | Libellé | Défaut | Bornes | Portée | Règle | Lu par |
|---|---|---|---|---|---|---|
| `alerts.payoutFailedHours` | Versement en échec depuis | **48 h** | 1 h → 336 h | exploitation | D59 3A | deal-service |
| `alerts.disputeUndecidedHours` | Litige décidable sans décision depuis | **72 h** | 1 h → 336 h | exploitation | D59 3A · A131 | deal-service |
| `alerts.retentionHeldDays` | Retenue non arbitrée depuis | **7 j** | 1 j → 60 j | exploitation | D59 3A | deal-service |
| `alerts.reversalOpenHours` | Renversement ouvert depuis | **48 h** | 1 h → 336 h | exploitation | D59 3A | deal-service |
| `alerts.outboxParkedAttempts` | Événement parqué après | **10** | 1 → 100 | exploitation | D59 3A | deal-service |
| `alerts.outboxLagMinutes` | Relais en retard depuis | **15 min** | 1 min → 1440 min | exploitation | D59 3A | deal-service |
| `alerts.emailsFailedWindowHours` | Emails en échec : fenêtre | **24 h** | 1 h → 168 h | exploitation | D59 3A | deal-service |
| `alerts.noTripPublishedDays` | Aucun trajet publié depuis | **7 j** | 1 j → 90 j | exploitation | D59 3A | deal-service |
| `alerts.acceptanceRateWindowDays` | Taux d'acceptation : fenêtre | **7 j** | 1 j → 90 j | exploitation | D59 3A | deal-service |
| `alerts.acceptanceRateMinPct` | Taux d'acceptation minimum | **30 %** | 0 % → 100 % | exploitation | D59 3A | deal-service |
| `alerts.acceptanceRateMinRequests` | Taux d'acceptation : demandes minimum | **5** | 1 → 1000 | exploitation | D59 3A | deal-service |

- **Versement en échec depuis** (`alerts.payoutFailedHours`) — Heures après lesquelles un versement en échec devient une alerte.
- **Litige décidable sans décision depuis** (`alerts.disputeUndecidedHours`) — Heures après lesquelles un litige décidable et non décidé devient une alerte.
- **Retenue non arbitrée depuis** (`alerts.retentionHeldDays`) — Jours après lesquels une retenue d'annulation non arbitrée devient une alerte.
- **Renversement ouvert depuis** (`alerts.reversalOpenHours`) — Heures après lesquelles un renversement de versement ouvert devient une alerte.
- **Événement parqué après** (`alerts.outboxParkedAttempts`) — Nombre de tentatives de relais à partir duquel un événement de l'outbox est considéré parqué.
- **Relais en retard depuis** (`alerts.outboxLagMinutes`) — Minutes de retard du relais d'événements à partir desquelles une alerte est levée.
- **Emails en échec : fenêtre** (`alerts.emailsFailedWindowHours`) — Fenêtre glissante (heures) dans laquelle un email en échec déclenche l'alerte.
- **Aucun trajet publié depuis** (`alerts.noTripPublishedDays`) — Jours sans nouvelle publication de trajet avant l'alerte de liquidité.
- **Taux d'acceptation : fenêtre** (`alerts.acceptanceRateWindowDays`) — Jours sur lesquels le taux d'acceptation des demandes est calculé.
- **Taux d'acceptation minimum** (`alerts.acceptanceRateMinPct`) — En dessous de ce pourcentage sur la fenêtre, alerte.
- **Taux d'acceptation : demandes minimum** (`alerts.acceptanceRateMinRequests`) — Nombre minimal de demandes sur la fenêtre pour que le taux soit significatif.

## Documents

| Clé | Libellé | Défaut | Bornes | Portée | Règle | Lu par |
|---|---|---|---|---|---|---|
| `documents.maxDocsPerTrip` | Documents par trajet | **5** | 1 → 20 | exploitation | ex-SiteConfig | trip-service |
| `documents.maxDocSizeMb` | Taille maximale d'un document | **5 Mo** | 1 Mo → 25 Mo | exploitation | ex-SiteConfig | trip-service |

- **Documents par trajet** (`documents.maxDocsPerTrip`) — Nombre maximal de justificatifs (billets…) attachés à un trajet.
- **Taille maximale d'un document** (`documents.maxDocSizeMb`) — Taille maximale (Mo) d'un justificatif de trajet, vérifiée côté serveur.

## Classe B — modifiables par déploiement seulement

| Paramètre | Valeur | Règle |
|---|---|---|
| Session membre : inactivité | 60 min (7 j avec « rester connecté ») | D27 · RG-A-13 |
| Session membre : durée maximale | 7 j (30 j avec « rester connecté ») | D27 · RG-A-14 |
| Session admin | accès 15 min · inactivité 45 min · 12 h de vie | D54 8A · RG-ADM-05 |
| Code OTP : validité | 10 min | RG-A-01 |
| 2FA admin : blocage | 5 échecs → 15 min | RG-ADM-04 |
| Code de livraison : blocage | 3 codes faux → 15 min | D4 · RG-P-06 |
| Motifs au journal | 20 caractères (sanction, masquage, export) · 50 (décision de médiation, remboursement manuel) | D54 6A · D56 2A · D58 3A |
| Invitation admin : validité | 48 h | D56 · RG-ADM-10 |

## Classe C — prévues, pas encore lues par le code

| Clé (§13) | Règle |
|---|---|
| `WEIGHT_TOLERANCE_PCT` | PRC-07 · RG-B-11 |
| `SUGGESTION_EXPRESS_CAP_PCT` | PRC-10 |
| `NEW_ACCOUNT_MAX_DECLARED_VALUE / MAX_WEIGHT / MAX_SHIPMENTS_PER_MONTH` | CNF-06 |
| `IDENTITY_REQUIRED_FROM` | CNF-05 |
| `PROTECTION_BASIC_CAP / PROTECTION_PROVIDER` | GAR-01/03 |
| `REPORT_REVIEW_THRESHOLD` | SIG-03 |
| `BAG_FORFAIT_DISCOUNT` | PRC-09 |
| `CATEGORY_SURCHARGE_MAX_PCT` | CAT-03 |
