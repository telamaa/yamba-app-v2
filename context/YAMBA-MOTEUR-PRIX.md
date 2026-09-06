# YAMBA — Le moteur de prix : logique métier
### Suggestion de prix (Voyageur) · Calcul du prix (Expéditeur) · Comparabilité (recherche) · Snapshot (réservation)
*Version du 28 août 2026 — décisions D13, D14, D15, D16, D17, D22, D32, D33, D34 · règles PRC, COM, GAR, CAT, CAP*

---

## 1. Le principe en une phrase

**Le Voyageur vend des kilos : il fixe UN prix au kilo et une capacité ; l'Expéditeur paie son poids, ajusté d'une taille visuelle et d'un éventuel supplément de famille, plus un service Yamba en une seule ligne.** Le prix vu à l'écran est calculé par le même code que celui qui le fige à la réservation : il n'y a qu'un moteur (D34), et un devis figé ne bouge plus jamais (D17).

Ce qui a été volontairement écarté : le prix par catégorie (incohérent : un livre et un téléphone de même poids coûtent pareil à transporter), les dimensions L×l×H (personne ne mesure un colis), les frais de paiement affichés à part (invite à la contestation).

---

## 2. Les acteurs et leurs nombres

| Acteur | Ce qu'il décide | Ce qu'il voit |
|---|---|---|
| **Voyageur** (Yamber/Tripper) | son **€/kg**, sa **capacité** (kg), sa position sur **8 familles** (accepte / supplément % / refuse), des **forfaits bagage entier** optionnels | une suggestion « prix juste » par corridor, son **gain net** (= le transport, point) |
| **Expéditeur** | le **poids** déclaré, la **famille** du colis, la **taille S/M/L**, la **protection** | un total en **2 lignes** : Transport + Service & protection |
| **Yamba** (paramètres serveur §13) | commission, planchers, coefficients, prime de Garantie, poids de référence | — |

---

## 3. Paramètres serveur (§13 des règles métier — valeurs initiales, révisables sans redéploiement)

| Paramètre | Valeur | Décision |
|---|---|---|
| Coefficient taille S / M / L | ×1,00 / ×1,10 / ×1,25 | D13, PRC-03 |
| Commission Expéditeur | **12 %** du transport | D16, COM-01 |
| Plancher de commission | **3,00 €** | D16, COM-02 |
| Poids facturable minimum | **0,5 kg** | D32 |
| Prix minimum par colis (transport) | **8,00 €** | D32 |
| Prime « Garantie Yamba 500 € » | **6,00 €** | D22, GAR |
| Tolérance de poids au pickup | ± 10 % | PRC-07 |
| Colis de référence (comparabilité) | **2 kg** | D33 |
| Supplément de famille max suggéré | 30 % | CAT-03 |

Une seule source dans le code : `PRICING_PARAMS` (`packages/libs/pricing`). Ils seront servis par l'API (`GET /pricing/params`) sans changer les formules.

---

## 4. Le calcul du prix Expéditeur (D34 — `quoteShipperPrice`)

Tout est en **centimes entiers** ; les euros n'existent qu'à l'affichage.

```
poids facturable  = max(poids déclaré, 0,5 kg)                                       (D32)
transport brut    = round(€/kg × poids facturable × coef taille × (1 + supplément %))  (D13, PRC-01/03, CAT-03)
transport         = max(transport brut, 8,00 €)                                      (D32 — « minimum par colis »)
commission        = max(round(transport × 12 %), 3,00 €)                             (D16, COM-01/02)
prime             = 6,00 € si Garantie 500, sinon 0                                  (D22)
service & protection = commission + prime                                            (COM-03 : une seule ligne)
TOTAL Expéditeur  = transport + service & protection
NET Voyageur      = transport                                                        (COM-03 : « ton prix = ton net »)
```

**Bagage entier** (PRC-04, soute 23 kg / cabine 12 kg) : `transport = forfait fixé par le Voyageur` — ni poids, ni taille, ni supplément ; il **consomme sa franchise** (23 ou 12 kg) sur la capacité. Commission et prime s'appliquent pareil.

### 4.1 Exemples

| Cas | Calcul | Transport | Service | Total | Net Voyageur |
|---|---|---|---|---|---|
| Mockup : 2,5 kg · S · 11,50 €/kg | 11,50 × 2,5 × 1 | 28,75 € | max(3,45 ; 3) = 3,45 € | **32,20 €** | 28,75 € |
| Même colis, taille **L** | × 1,25 | 35,94 € | 4,31 € | 40,25 € | 35,94 € |
| Même colis, **électronique +20 %**, S | × 1,20 | 34,50 € | 4,14 € | 38,64 € | 34,50 € |
| **Passeport 0,1 kg** · S · 11,50 €/kg | 0,5 kg facturable → 5,75 € → plancher | **8,00 €** | plancher **3,00 €** | **11,00 €** | 8,00 € |
| 2,5 kg · S + **Garantie 500** | idem + prime | 28,75 € | 3,45 + 6,00 = 9,45 € | 38,20 € | 28,75 € |
| **Bagage soute 23 kg** à 230 € | forfait | 230,00 € | 27,60 € | 257,60 € | 230,00 € |
| Recherche « 2 kg ≈ 27 € » à 12 €/kg | 12 × 2 = 24 ; 12 % = 2,88 → 3 | 24,00 € | 3,00 € | **27,00 €** | 24,00 € |

### 4.2 Ce que l'écran doit dire (transparence — RG-C)
- La ligne transport est **détaillée** : « 1 kg × 12 €/kg × S · +20 % ».
- Quand le plancher joue : « Minimum par colis appliqué : 8,00 € ».
- Le colis léger est **annoncé** partout où un €/kg apparaît : « Colis léger (enveloppe, passeport, lunettes…) : 8 € minimum ».
- Jamais de frais de paiement à part ; jamais le mot « assurance » avant la signature du contrat assureur (GAR-02) — « Garantie Yamba ».

### 4.3 Ce que le devis fige (D17 — `ShipperQuote` → `BookingPricingSnapshot`)
`pricingModel` (PER_KG / FLAT_BAG) · `weightKg` · `billableWeightKg` · `sizeClass` · `sizeCoef` · `pricePerKgCents` · `familySurchargePct` · `rawTransportCents` · `minimumApplied` · `transportCents` · `commissionPct` · `commissionCents` · `commissionFloorApplied` · `protectionTier` · `premiumCents` · `serviceCents` · `totalShipperCents` · `carrierNetCents` · `capacityKgConsumed` · `currencyCode`.
Règle : **un Booking ne recalcule jamais depuis le Trip**. Si le Voyageur change son €/kg, les deals existants ne bougent pas. Le serveur (lot B2) recalcule le devis reçu du front avec le même moteur et **refuse toute divergence**.

---

## 5. Les familles de colis (D14, CAT-02/03)

La **famille** répond à « qu'est-ce que c'est ? » (risque, conformité, protection) — **jamais** au prix. Liste figée : Documents & papiers · Vêtements & textile · Alimentaire sec & scellé · Électronique & appareils · Cosmétiques & soins · Pièces & outillage · Jouets & puériculture · Accessoires & divers.

Pour chaque famille, le Voyageur choisit : **Accepté** (défaut) · **Supplément** (+ N %, appliqué au transport — suggéré ≤ 30 %) · **Refusé**. Le supplément est **visible avant le choix** (recherche, page trajet, wizard) ; une famille refusée est non sélectionnable avec le motif. La famille est figée dans le snapshot du Booking.

---

## 6. La capacité (D19, CAP-01/02)

- `capacityKg` : déclarée par le Voyageur, **immuable après publication**.
- `reservedKg` : compteur serveur, incrémenté atomiquement à chaque réservation acceptée (jamais saisi). `remainingKg = capacityKg − reservedKg` (dérivé, jamais stocké).
- Un colis > kilos restants est refusé (front pour l'ergonomie, serveur pour la vérité). Un bagage entier exige `capacityKg ≥ 23 / 12` (RG-B-29) — sinon le forfait est **suspendu** (mémorisé, non envoyé).
- Au pickup : écart de poids ≤ 10 % toléré ; au-delà, renégociation ou refus sans pénalité (PRC-07).

---

## 7. La suggestion de prix au Voyageur (D15, PRC-05/06)

Indicative : elle **ne bloque jamais** la saisie ni la publication. Affichée en fourchette basse / médiane / haute + ancre « les trajets similaires partent à Y €/kg », et un badge : « Prix juste » dans la fourchette, « Sous le marché — tu laisses de l'argent » en dessous, « Au-dessus — moins de demandes probables » au-delà. Le prix est **pré-rempli à la médiane** (arrondie au 0,50 €), la capacité à 12 kg.

### 7.1 Formule (V1.5, déterministe, côté front en attendant l'endpoint)
```
base        = base du CORRIDOR (zone origine × zone destination) corrigée de la distance (±10 % max, log autour de 5 000 km)
médiane     = base × (1,05 si vol direct) × (0,95 si départ ≤ 3 j | 0,98 si ≤ 7 j)
basse/haute = médiane × 0,90 / × 1,15
```
Le **délai** joue à la baisse côté offre : un départ imminent laisse moins de temps pour vendre ses kilos (la prime d'urgence existe côté Expéditeur, pas ici). Chaque facteur appliqué est **expliqué** au Voyageur (« Pourquoi ce prix ? »).

### 7.2 La table des corridors (hypothèses de marché, un seul fichier éditable)
15 **zones-marché** (pas des blocs politiques) : Europe (UE + Royaume-Uni, Suisse, Norvège, Balkans, Ukraine) · Russie · Maghreb · Afrique de l'Ouest · Afrique centrale · Afrique de l'Est/australe · Moyen-Orient · Asie du Sud · Asie de l'Est · Asie du Sud-Est · Asie centrale · Amérique du Nord · Amérique latine/Caraïbes · DOM-TOM · Océanie.

| Depuis l'Europe vers… | Base €/kg | | Depuis l'Europe vers… | Base €/kg |
|---|---|---|---|---|
| Europe | 6,5 | | Asie du Sud | 11 |
| Maghreb | 8 | | Asie de l'Est | 12 |
| Afrique de l'Ouest | 11 | | Asie du Sud-Est | 12 |
| Afrique centrale | 12 | | Asie centrale | 10 |
| Afrique Est/australe | 12 | | Amérique du Nord | 10 |
| Moyen-Orient | 9 | | Amérique latine/Caraïbes | 12 |
| Russie | 10 | | DOM-TOM | 9 |
| | | | Océanie | 13 |

Hors Europe : paires connues (Chine → Congo 14, USA → Mexique 9, Russie → Asie centrale 7…) sinon moyenne des deux bases. **Trajet intérieur (même pays)** : 55 % de la base de la zone, borné 3–6 €/kg — la référence de l'Expéditeur y est le colis postal, et le plancher de 8 € protège les petits envois. Corridor inconnu : 11 €.

Exemples : Paris → Amsterdam **5,85** · → Londres 5,85 · → Casablanca 7,66 · → Dakar 10,92 · → Brazzaville **12,11** · → New York 10,07 · → Delhi 11,13 · → Pékin 12,26 · Paris → Bordeaux **3,22** (intérieur).

Ce que la V2 ajoutera (post-lancement, données Kafka + PostHog) : offre observée sur le corridor, demande latente (alertes SavedRoutes — signal propriétaire), réputation du Voyageur, saisonnalité, plafond ≤ 35 % du tarif express, apprentissage sur les taux d'acceptation par niveau de prix.

---

## 8. La comparabilité en recherche (D33)

Deux moteurs coexistent (trajets anciens au prix par catégorie, trajets au kilo — A28). Pour trier et comparer : chaque trajet porte un **prix comparable** = transport d'un **colis de référence de 2 kg** (`max(2 × €/kg, 8 €)` ; ancien moteur : son prix le plus bas). Dénormalisé sur le Trip, recalculé à chaque écriture.

Si l'Expéditeur indique **le poids de son colis** dans la recherche, tout se calcule **pour ce poids** : prix sur chaque carte (« ≈ 40 € tout compris pour 3 kg »), tri « Prix le plus bas pour votre colis de 3 kg », exclusion des trajets sans assez de capacité. Le poids saisi suit l'Expéditeur jusqu'à la réservation (pré-rempli).

Le crossover est réel : à 1 kg, 12 €/kg (12 €) passe devant un ancien trajet à 15 € ; à 2 kg (24 €) l'ordre s'inverse — d'où le tri en mémoire pour un poids donné.

---

## 9. La protection (D22, GAR)

- **Protection de base** — incluse : non-livraison couverte, le paiement est bloqué jusqu'à la remise au destinataire.
- **Garantie Yamba — jusqu'à 500 €** — +6 € (prime dans « Service & protection », flux séparé du transport) : perte, vol, casse pendant le transport ; exclusions affichées avant validation (dont saisie douanière d'un colis non conforme) ; photos obligatoires.
- Le mot « assurance » n'apparaît qu'après signature du contrat avec un assureur (embedded insurance) — d'ici là, « Garantie Yamba ».

---

## 10. Où vit chaque brique

| Brique | Emplacement | Testée |
|---|---|---|
| Moteur de prix Expéditeur `quoteShipperPrice` + `PRICING_PARAMS` | `packages/libs/pricing/src/index.ts` (partagé front/serveur, alias `@packages/pricing`) | 7 specs (deal-service) |
| Suggestion Voyageur `suggestPricePerKg` | `apps/user-ui/src/components/trips/create/create-trip.config.ts` | — (front) |
| Table des corridors | `apps/user-ui/src/lib/pricing-corridors.ts` | — (valeurs éditables) |
| Comparable D33 `computeComparablePriceCents` | `apps/trip-service/src/lib/comparable-price.ts` | 5 specs |
| Prix pour un poids (recherche) `price-for-weight.ts` | `apps/trip-service/src/lib/` | 5 specs |
| Gate de publication A28 `resolvePricingEngine`, `checkBagCapacity`, `pickPerKgFields` | `apps/trip-service/src/services/pricing-gate.ts` | 15 specs |
| Exemple « ≈ 27 € » (cartes) `pricing-example.ts` | `apps/user-ui/src/lib/` | — |

Dette connue : les paramètres sont encore dupliqués dans `comparable-price`, `price-for-weight` et `pricing-example` → PR « paramètres serveur » (`GET /pricing/params`, `PRICING_PARAMS` unique).

---

## 11. Ce qui reste à décider ou à mesurer
- Valider la **table des corridors** par l'étude de marché GP (D15) — aujourd'hui des hypothèses.
- Fixer `CANCEL_LATE_RETENTION_PCT` (ANN-01) et les plafonds de protection de base (GAR-03/06).
- Mesurer après lancement : taux d'acceptation par niveau de prix, écart médiane suggérée / prix réellement fixés, part des colis au plancher.
