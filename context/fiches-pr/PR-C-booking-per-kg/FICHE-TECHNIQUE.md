# Fiche technique — PR-C « le wizard de réservation parle le moteur au kilo »

> Branche `feat/pricing-front-3` · base `dev` (post-#84) · PR #__ (noté au merge)
> Public : développeur junior.

## 0. Le contexte

Le wizard de réservation Expéditeur (`/trips/[id]/book`, 4 étapes) existait **en front seulement** : il tournait sur un trajet **mocké** (`mockTrip`), raisonnait en **catégories** (ancien moteur) et calculait un prix avec des constantes locales (15 % de service, 6 € d'assurance). La création du deal côté serveur (`POST /deals`, paiement) est le lot **B2** — pas cette PR.

PR-C fait trois choses : ① le wizard réserve sur le **vrai trajet** ; ② il parle le **moteur au kilo** (poids, taille S/M/L, famille, bagage entier, Garantie) ; ③ le prix vient d'**un moteur unique et pur, partagé front/serveur** (D34) — ce que l'Expéditeur voit est exactement ce que le serveur figera (D17).

## 1. La décision D34 : `@packages/pricing`

`packages/libs/pricing/src/index.ts` — zéro dépendance, cents entiers :

```
billable   = max(poids, 0,5 kg)                                   (D32)
transport  = max(round(€/kg × billable × coef S/M/L × (1 + supplément %)), 8 €)
commission = max(round(transport × 12 %), 3 €)                    (D16)
prime      = 6 € si Garantie 500, sinon 0                          (D22)
service    = commission + prime        → « Service & protection » (COM-03)
total      = transport + service       ; net Voyageur = transport
bagage entier (PRC-04) : transport = forfait du Voyageur, consomme 23 / 12 kg
```
`quoteShipperPrice(input)` renvoie un `ShipperQuote` dont **chaque champ est conçu pour être figé tel quel** dans `BookingPricingSnapshot` (D17) : `billableWeightKg`, `sizeCoef`, `familySurchargePct`, `rawTransportCents`, `minimumApplied`, `commissionFloorApplied`, `serviceCents`, `carrierNetCents`, `capacityKgConsumed`. Erreurs typées (`QuoteError`) : pas de €/kg, pas de poids, pas de taille, bagage non proposé.

`PRICING_PARAMS` = le tableau §13 des règles métier en une seule constante (coefs S/M/L, 12 %/3 €, 0,5 kg/8 €, prime 6 €, tolérance 10 %, référence 2 kg). L'endpoint `GET /pricing/params` les servira plus tard sans changer les formules.

**Résolution** : alias `@packages/pricing` dans `tsconfig.base.json` (services, Jest via le preset Nx) et dans `apps/user-ui/tsconfig.json` (qui redéfinit ses `paths` — il fallait l'y ajouter, plus l'`include` du fichier). Next/Turbopack résout l'alias ; la page `/book` compile.

**Tests** : `apps/deal-service/src/services/shipper-quote.spec.ts` (**+7**) — chiffres du mockup (2,5 kg × 11,50 € × S = 28,75 + 3,45 = 32,20 €), taille L + supplément, plancher D32 (passeport 0,1 kg → 8 € + 3 €), Garantie dans le service, bagage soute, erreurs, paramètres. Le spec vit dans deal-service parce que c'est lui qui figera le snapshot en B2.

Le seed (`seed-deals.ts`) passait 15 %/2 € : aligné sur D16 (12 %/3 €).

## 2. Carte des changements front (`apps/user-ui/src/components/booking/`)

| Fichier | Quoi |
|---|---|
| `booking.types.ts` | `ParcelFamily` (8), `FamilyStance`, `SizeClass`, `ParcelProduct` ; `TripContext` gagne `pricePerKgCents`, `remainingKg`, `familyStances`, forfaits bagage (legacy `acceptedCategories`/`categoryPrices` conservés, `@deprecated`) ; `Draft` gagne `product`, `family`, `sizeClass` ; `PriceBreakdown` porte le `quote` complet + `quoteError` ; `ValidationErrors` : `family`, `product`, `sizeClass` |
| `trip-context.mapper.ts` (nouveau) | `PublicTrip` (API `GET /trips/:id/public`) → `TripContext` : lieux, Tripper, familles, €/kg, kg restants, forfaits |
| `booking.config.ts` | `computeTotal` = `quoteShipperPrice` (legacy : prix par catégorie + D16) ; `parseWeight` (« 2,5 ») ; validation : famille refusée, bagage non proposé, poids > 30 kg, **poids > kg restants** (CAP-01, revérifié serveur), bagage > kg restants ; `getFirstAcceptedFamily` |
| `booking.state.ts` | `buildInitialDraft(trip)` : première famille acceptée, **poids mémorisé en recherche** (`yamba.search.weightKg`), taille S ; `DRAFT_VERSION` 3 (les brouillons v2 en `sessionStorage` sont abandonnés) ; mock complété (utile aux tests visuels, plus utilisé par la page) |
| `hooks/useBookingDraft.ts` | accepte un brouillon initial |
| `app/[locale]/trips/[tripId]/book/BookingClient.tsx` | `usePublicTrip(tripId)` + mapper ; états chargement / introuvable ; plus de mock |
| `steps/StepParcel.tsx` | Trajet au kilo : **produit** (colis / bagage soute / cabine si proposés, avec forfait), **famille** en chips (refusée = grisée + motif, supplément affiché), **poids** (tooltip D32, kg restants), valeur déclarée, **taille S/M/L** en 3 cartes Lucide avec coef ; trajet legacy : l'ancien sélecteur de catégorie |
| `BookingSummarySidebar.tsx`, `BookingBottomSheet.tsx` | ligne transport détaillée « 2,5 kg × 11,50 €/kg × S · +20 % », note « Minimum par colis appliqué : 8,00 € », ligne **« Service & protection »** (COM-03) |
| `services/booking.api.ts` | le stub `createDeal` embarque le `quote` (B2 recalculera avec le même moteur et refusera toute divergence) |
| `messages/{fr,en}/booking.json` | familles, produit, taille (S = « de l'enveloppe à la boîte à chaussures »), tooltips, `locationKinds`, **« Garantie Yamba »** partout où il y avait « assurance » (GAR-02 : le mot est réservé au contrat assureur signé) |

## 3. Détails qui méritent une explication

- **Pourquoi le devis en cents traverse jusqu'à l'UI ?** Pour que le récap affiche exactement ce qui sera figé : la sidebar lit `quote.billableWeightKg`, `quote.minimumApplied`… et les euros ne servent qu'au `formatPrice`.
- **Pourquoi la validation « poids > kg restants » est en front alors que le serveur tranche ?** Ergonomie : dire « il ne reste que 12 kg » avant l'étape 4 ; CAP-01 reste la vérité à la réservation (concurrence).
- **Trajet legacy** : le wizard garde son ancien chemin (catégorie + prix par colis) — bi-moteur tolérant (A28) — mais la commission passe par `PRICING_PARAMS` (12 %/3 €), plus la constante locale 15 %.
- **GAR-02** : « Assurance optionnelle » → « Protection du colis », « Assurance jusqu'à 500 € » → « Garantie Yamba — jusqu'à 500 € », « Voir la fiche IPID » → « Voir les conditions ». Le mot « assurance » reviendra avec le nom du partenaire, pas avant.

## 3bis. Revue UX (captures) et performance

- **0 € partout** : le poids était vide (placeholder « 2,5 » ≠ valeur) → `QuoteError` → zéros. Fix : `buildInitialDraft` part du poids mémorisé sinon **2 kg** ; le récap affiche un **indice** (`summary.quoteHint.<code>`) quand le devis est impossible, jamais 0 €. Lieux pré-sélectionnés (1er choix).
- **Garde d'identité** (CNF-05) : `BookingClient` exige `useUser().user` ; sinon écran « Connecte-toi pour réserver » → `/login?redirect=/trips/<id>/book` (le `LoginForm` lit déjà `redirect`).
- Colonne droite : **récap + CTA d'abord**, protection ensuite. « 0.0 · 0 deals » → « Nouveau Tripper ». Titre/prix de la Garantie sur une ligne (« Garantie Yamba 500 € · +6 € », `whitespace-nowrap`). Règles d'or dans un `<details>` replié (le bloc bleu hors charte devient teal/slate — `TIP_BG/TIP_TITLE`). Grille photos : 1 case vide puis +1 à chaque ajout (au lieu de 5 cases béantes).
- **Perf** : `StepPayment` (Stripe Elements + stripe-js) chargé via `next/dynamic` à l'étape 4 → hors du bundle de l'étape 1. Le trajet est déjà en cache React Query (`["public-trip", id]`) depuis la page détail → ouverture du wizard sans requête. Mesures dev : HTML 110–320 ms, API trajet 120 ms, RSC 107 Ko (les 23 namespaces i18n — chantier global « messages par route », noté).

## 4. Vérifier

```sh
npx nx test deal-service                       # 225 (218 + 7)
npx tsc --noEmit --project apps/user-ui/tsconfig.json
# Parcours : recherche (poids 3 kg) → trajet Orly → Amsterdam → Réserver
#   étape 1 : poids pré-rempli 3, famille « Vêtements » sélectionnée, taille S
#   récap : « Transport · 3 kg × 12,00 €/kg × S 36,00 € · Service & protection 4,32 € · Total 40,32 € »
#   passer en L + Électronique (+20 % si le trajet le surcharge) → le total suit
#   poids 0,2 → « Minimum par colis appliqué : 8,00 € », total 11,00 €
#   famille refusée : chip grisée, non cliquable ; poids 40 → erreur kg restants
```

## 5. Ce que cette PR ne fait pas
- `POST /deals`, paiement, snapshot en base : **B2** (le moteur est prêt, le stub envoie déjà le devis).
- Photos horodatées R2, IPID/conditions de la Garantie : inchangés (stubs).
- `GET /pricing/params` : PR « paramètres serveur ».
