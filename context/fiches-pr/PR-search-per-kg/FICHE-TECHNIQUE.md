# Fiche technique — PR search « la recherche parle le moteur au kilo »

> Branche `feat/search-per-kg` (empilée sur `feat/pricing-front-2` — à merger APRÈS PR-B) · **PR #83** (mergée dans `dev`)
> Public : développeur junior.

## 0. Le problème

Après PR-B, un trajet au kilo existe en base et s'affiche dans la liste… mais la recherche raisonne encore avec l'ancien moteur :
- le **filtre « Catégories »** (`acceptedCategories hasSome`) fait **disparaître** tout trajet au kilo dès qu'on coche une case (il n'a pas de catégories : la famille les remplace, D14) ;
- le **tri « Prix le plus bas »** trie sur `minPriceCents`, `null` pour un trajet au kilo → il est **exclu** du tri ;
- l'Expéditeur ne peut pas comparer « 15 € le colis » et « 12 €/kg ».

## 1. La décision : D33 (registre)

Un **colis de référence de 2 kg** rend les deux moteurs comparables. On dénormalise sur le Trip :

```
comparablePriceCents = PER_KG  → max(2 × pricePerKgCents, 800)   // plancher D32
                       legacy  → minPriceCents
                       aucun   → null (absent du tri par prix)
```
et le filtre devient **par famille** : un trajet est exclu s'il **refuse** la famille demandée ; un trajet sans conditions (legacy compris) accepte tout.

## 2. Carte des changements

| Couche | Fichier | Quoi |
|---|---|---|
| Schéma | `prisma/schema.prisma` | `Trip.comparablePriceCents Int?` + index. `prisma db push` fait (index en sync) |
| Logique pure | `apps/trip-service/src/lib/comparable-price.ts` (+ **5 specs**) | `computeComparablePriceCents({ pricePerKgCents, minPriceCents })` — PER_KG prime (A28) |
| Écritures | `trip.controller.ts` → `computeDenormalizedFields` | Calculé à la création ; recalculé à l'update si `categoryConditions` **ou** `pricePerKgCents` change (le publish passe par update/create) |
| Backfill | `packages/libs/prisma/scripts/backfill-comparable-price.ts` | Une fois, idempotent : `npx tsx …` → « 36 trips lus, 24 mis à jour » |
| Query | `apps/trip-service/src/dto/trip-search.dto.ts` | `PARCEL_FAMILIES` + param CSV `families` (search ET facets) |
| Recherche | `trip-search.controller.ts` | ① `categories` ne s'applique qu'au legacy (`OR: [{pricePerKgCents > 0}, {acceptedCategories hasSome}]`) ② `families` → `familyConditions: { none: { familyKey, mode: REFUSE } }` par famille ③ tri `lowestPrice` sur `comparablePriceCents` (+ `where not null`) ④ facettes : `familyCounts` (8 counts en parallèle, base **sans** le filtre famille courant pour que chaque chip garde son compte) |
| DTO | `lib/trip-mappers.ts` | `YambaTripResult.familyConditions` (compact : positions ≠ ACCEPT) |
| Contrat | `packages/libs/api-contracts/src/trip/trip-search.schema.ts` + `openapi.json` ×3 | `familyConditions`, `familyCounts`, description du tri |
| Front types/API | `search-results.types.ts`, `services/trip.api.ts` | `SEARCH_FAMILIES`/`SearchFamily`, `families` param, `familyCounts` |
| Vue | `SearchResultsView.tsx` | état `selectedFamilies` remplace `selectedCategories` (params, clearAll, hasActiveFilters, props sidebar, cartes) |
| Sidebar | `SearchFiltersSidebar.tsx` | section **« Que voulez-vous envoyer ? »** : 8 chips famille (Lucide, compte, désactivée à 0) — le bloc catégories legacy et son « Voir tout » sont supprimés ; toggles confiance **masqués** quand leur compte est 0 ; tri « Prix le plus bas *pour un colis de 2 kg* » |
| Cartes | `SurchargePills.tsx` (nouveau), `TripResultCard(+Mobile)` | quand une famille filtrée est **surchargée** par le Voyageur → pill mango « Électronique : +20 % » sous le prix (transparence avant le clic) |
| i18n | `messages/{fr,en}/search.json` | `families.*`, `filters.families`, `filters.lowestPriceHint`, `card.surcharge` |

## 3. Détails qui méritent une explication

- **Pourquoi un champ dénormalisé et pas un calcul au moment du tri ?** Mongo trie sur un champ indexé ; calculer « max(2 × prix, 800) » dans une requête Prisma n'est pas possible sans pipeline d'agrégation (et on vient de se cogner à la limite Atlas de 50 étapes). Un champ recalculé à l'écriture est simple, indexable, testable.
- **Pourquoi `familyConditions: { none: {...} }` par famille dans un AND**, plutôt qu'un `in` ? Les filtres Prisma sur types composites Mongo supportent `some/none/every` avec des égalités simples ; un AND de `none` par famille demandée est lisible et sûr.
- **Le filtre catégorie reste accepté par l'API** (compatibilité des clients / des URLs partagées) mais ne cache plus les trajets au kilo ; l'UI ne le propose plus.
- **Les facettes famille sont calculées sur la base SANS filtre famille** : sinon, cocher « Alimentaire » mettrait toutes les autres chips au compte des trajets-qui-acceptent-l'alimentaire — ce n'est pas ce qu'un utilisateur attend d'un compteur par chip.

## 3ter. D33 V2 — le poids de l'Expéditeur remplace la référence

« Pourquoi seulement pour 2 kg ? » — parce qu'un tri veut UN nombre et qu'un €/kg n'en est pas un sans poids. La référence reste le défaut, mais l'Expéditeur peut donner **le poids de son colis** (sidebar « Votre colis », curseur 0,5 → 30 kg, mémorisé en `localStorage`, clé `yamba.search.weightKg`) :

- **API** `weightKg` (search + facets) → ① exclusion des trajets au kilo dont la **capacité** < poids (approximation par `capacityKg` : Prisma/Mongo ne compare pas deux champs ; le front grise ceux dont `remainingKg` < poids, et CAP-01 vérifie à la réservation) ; ② chaque carte reçoit `transportForWeight` / `totalForWeight` (euros) calculés par `lib/price-for-weight.ts` (pur, **+5 specs** : plancher 0,5 kg / 8 €, service 12 % min 3 €, crossover legacy/PER_KG selon le poids) ; ③ tri « Prix le plus bas » **pour ce poids**.
- **Le tri pour un poids se fait en mémoire** : la clé dépend du poids (un legacy à 15 € passe devant 12 €/kg à partir de 1,25 kg), donc aucun index ne convient. Fenêtre bornée `WEIGHT_SORT_WINDOW = 200` trajets, curseur-offset `o:<n>`. Assumé v1 (volumes faibles) ; au-delà, pipeline d'agrégation `$max($multiply)` — sous les 50 étapes d'Atlas.
- **Front** : hint du tri « pour votre colis de 3 kg », carte « ≈ 40 € tout compris pour 3 kg » (chiffres serveur, plus le calcul local), badge « Plus assez de place » si `remainingKg` < poids. Sans poids saisi : comportement 2 kg inchangé, libellé explicite.
- Suite naturelle : le poids saisi **pré-remplit le wizard de réservation** (PR-C).

## 3bis. Régression vue en QA : « 5 comptés, 4 affichés »

Les facettes comptent avec un `where` Prisma ; la liste passe ensuite chaque trajet dans `mapTripToYambaResult`, qui **écartait** (try/catch + `console.warn`) tout trajet sans `arrivalAt`. Le trajet seed `bzv-perkg` n'en a pas → compté, jamais affiché. Le mapper n'exige plus que `departureAt` (le critère de recherche) ; sans arrivée : heure « — », pas de durée ni de « lendemain ». **+3 specs** (`trip-mappers.spec.ts`, première fixture du mapper). Règle : *ce que les facettes comptent, la liste doit pouvoir l'afficher* — un rejet dans un mapper de lecture est toujours suspect.

## 3quater. Page trajet (revue captures, même branche)

- **`OfferCard.tsx`** (nouveau, sous l'itinéraire) : « Ce que vous pouvez envoyer avec {prénom} » — €/kg, kilos disponibles, **exemple pour le poids mémorisé** (`localStorage` `yamba.search.weightKg`, sinon 2 kg) via `pricing-example.ts`, 8 familles en chips (✓ acceptée teal / +% mango / refusée slate barrée), forfaits bagage. `null` pour un trajet legacy — `CategoriesCard` (qui ne connaît que l'ancien moteur et rendait la page **sans aucune offre** pour un trajet au kilo) reste pour eux.
- **`ItineraryCard`** : prop `isOwner` (le CTA « Discuter » n'est pas montré au propriétaire) ; CO₂ calculé **pour le poids** : `calculateCO2SavedKg(trip, weightKg)` multiplie enfin par le poids (le facteur est en g/kg/km — on annonçait l'émission d'un kilo comme celle du colis : 265 kg pour Paris–Amsterdam…) ; libellé « … pour 2 kg ».
- **`BookingSummaryCard`** : exemple pour le poids mémorisé.
- **Politique d'annulation alignée sur ANN-01** (registre prime, aucun code d'annulation n'existe encore) : 100 % jusqu'à 48 h · < 48 h partiel (retenue reversée au Voyageur) · après remise : litige seulement. L'ancien texte (50 % entre 48 et 24 h, 0 % < 24 h) était une promesse hors registre.
- **Mise en page desktop** : `LocationsCard` + `ConditionsCard` montent dans la colonne de droite sous la carte (sticky, scroll interne) ; sur < lg ils restent dans le flux (rendu conditionnel `lg:hidden` / `hidden lg:block`). Objectif : la page tient dans un écran 1440×900.

## 3quinquies. D32 annoncée à l'écran

`MIN_PARCEL_PRICE_EUR` / `MIN_BILLABLE_KG` exportés par `lib/pricing-example.ts` (même source que le calcul) et affichés dans `StepConditions` (Voyageur), `SearchFiltersSidebar` (sous le curseur poids), `OfferCard` et `BookingSummaryCard` (Expéditeur). Une règle qui n'est pas dite à l'écran est une surprise à la réservation.

## 3sexies. Suggestion de prix par corridor (D15 V1.5, front)

`lib/pricing-corridors.ts` : chaque pays (ISO alpha-2) est classé dans une **zone-marché** (Europe = UE + UK + CH + NO + Balkans + UA · Russie · Maghreb · Afrique de l'Ouest / centrale / Est-australe · Moyen-Orient · Asie du Sud / de l'Est / du Sud-Est / centrale · Amérique du Nord · Amérique latine-Caraïbes · DOM-TOM · Océanie) ; `corridorBasePerKg(from, to, km)` lit une base **zone × zone** (matrice depuis l'Europe + paires connues + repli moyenne), corrigée de ±10 % max par la distance (log autour de 5 000 km). `suggestPricePerKg` (création de trajet) l'utilise à la place de la base unique 11 € ; le popover « Pourquoi ce prix ? » affiche « Base du corridor Europe → Afrique centrale : 12,11 €/kg ». **Les valeurs sont des hypothèses** à valider par l'étude GP (D15) — un seul fichier à éditer. Le serveur reprendra la même table pour `GET /trips/price-suggestion`.

## 4. Vérifier

```sh
npx tsc --noEmit --project apps/trip-service/tsconfig.app.json && npx nx test trip-service   # 187
npx tsc --noEmit --project apps/user-ui/tsconfig.json
curl "localhost:6002/trips/search?sort=lowestPrice&locale=fr"          # PER_KG et legacy mélangés, triés
curl "localhost:6002/trips/search?families=FOOD_DRY_SEALED&locale=fr"  # bzv-perkg (alimentaire refusé) absent
curl "localhost:6002/trips/search/facets?locale=fr"                     # familyCounts
```

## 5. Ce que cette PR ne fait pas
- Aéroport choisi comme ville de départ (« Orly → Amsterdam ») → ville de rattachement + lieu de pickup : chantier step 1.
- Le poids de référence 2 kg est une constante (`REFERENCE_KG`) — paramètre serveur §13 candidat, comme le plancher.
- Suppression complète de `instantBooking` (champ, filtre API, facette) : PR cleanup.
