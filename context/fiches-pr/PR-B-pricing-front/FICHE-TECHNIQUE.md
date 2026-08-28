# Fiche technique — PR-B « Le formulaire de prix du Voyageur (moteur PER_KG) »

> Branche `feat/pricing-front-2` · base `dev` (`70f060b`, post-#77) · PR #__ (noté au merge)
> Public : développeur junior. Objectif : comprendre CE qui a changé, POURQUOI, et comment le vérifier soi-même.

---

## 0. Le contexte en 2 minutes

Yamba met en relation des **Voyageurs** (ils publient un trajet, ex. Paris → Brazzaville) et des **Expéditeurs** (ils veulent envoyer un colis sur ce trajet).

Historiquement, un Voyageur fixait **un prix par catégorie de colis** (« vêtements 15 €, téléphone 25 €… »). C'est le moteur **PER_CATEGORY** (dit *legacy*). La refonte pricing (décisions D13 à D22 du registre) remplace cela par un moteur **PER_KG** : le Voyageur fixe **UN prix au kilo** et **une capacité en kilos**, puis dit pour chaque *famille* de colis s'il accepte, surcharge (+ X %) ou refuse.

La refonte est découpée en 3 PR :

| PR | Rôle | État |
|---|---|---|
| PR-A (#77) | Le socle backend : schéma Prisma, contrats API, « gate » de publication, seed | mergée |
| **PR-B (celle-ci)** | **Le formulaire du Voyageur** : l'étape « Conditions » du wizard de création de trajet | poussée |
| PR-C | Le côté Expéditeur : le wizard de réservation calcule le prix à partir du moteur PER_KG | à faire |

La maquette de référence est `context/mockup-pricing-yamba.html` (ouvre-la dans un navigateur : colonne de gauche = ce que PR-B implémente).

---

## 1. Ce qu'un utilisateur voit après PR-B

Dans « Créer un trajet », étape 2 « Conditions », l'ancien bloc « Catégories acceptées + prix » est remplacé par 4 sections + 1 carte :

1. **Ton prix au kilo** — un curseur (5 → 20 €/kg, pas de 0,50) synchronisé avec un champ numérique, une **jauge « prix juste »** (zone basse / juste / haute) avec la position du prix du Voyageur, un badge (« ✓ Prix juste », « ↓ Sous le marché… », « ↑ Au-dessus… ») et une phrase d'ancrage « Les trajets similaires partent à 11,55 €/kg en médiane… ».
2. **Ta capacité** — curseur 2 → 30 kg + champ, et un rappel de la tolérance de poids au pickup (± 10 %).
3. **Familles de colis** — 8 lignes (Documents, Vêtements, Alimentaire sec, Électronique, Cosmétiques, Pièces & outillage, Jouets, Accessoires). Chaque ligne a 3 boutons **OK / +% / Non**. En mode +%, un petit curseur (5 → 50 %) apparaît.
4. **Bagages entiers — forfait** — deux lignes optionnelles : « Bagage soute 23 kg » et « Bagage cabine 12 kg », chacune avec un prix forfaitaire en euros.
5. **Carte « Tu gagnes »** — apparaît dès que prix ET capacité sont saisis : `prix × capacité` (ex. 11,50 × 23 = 264,50 €), avec la mention « versé à J+4… ton prix = ton net ».

Les sections suivantes (lieux de remise, lieux de livraison, options, message) sont **inchangées**.

Le bandeau résumé en haut (« Avion · Paris → Brazzaville · 12 sept. · 11,50 €/kg · 23 kg · 264,50 € »), l'étape 3 « Vérification » et l'aperçu public reflètent les nouvelles valeurs.

---

## 2. Carte des fichiers modifiés

Tout le formulaire vit dans `apps/user-ui/src/components/trips/create/`. Convention du dossier : `*.types.ts` (types), `*.state.ts` (valeur initiale), `*.config.ts` (constantes + logique pure + validation), `*.copy.ts` (textes FR/EN), `*.mapper.ts` (Draft → payload API), `*.reverse-mapper.ts` (API → Draft, pour l'édition), `steps/` (les écrans).

| Fichier | Rôle | Ce qui a changé |
|---|---|---|
| `create-trip.types.ts` | Types du formulaire | + `ParcelFamily` (8 valeurs), `FamilyConditionMode`, `FamilyConditionDraft` ; le `Draft` gagne 5 champs ; les champs legacy sont marqués `@deprecated` ; + ~30 clés de texte dans `CreateTripCopy` |
| `create-trip.state.ts` | `initialDraft` | Les 5 champs initialisés (vides ; familles toutes en `ACCEPT`) |
| `create-trip.config.ts` | Logique pure | + `PARCEL_FAMILIES`, bornes des curseurs, `suggestPricePerKg`, `getFairPriceVerdict`, `estimateNetGain`, `createDefaultFamilyConditions` ; `validateStep2` réécrite |
| `create-trip.copy.ts` | Textes FR/EN | + les textes du pricing |
| `create-trip.mapper.ts` | Draft → API | + 5 champs dans le payload (euros → cents) |
| `create-trip.reverse-mapper.ts` | API → Draft | + relecture des 5 champs (cents → euros) |
| `TripPricingUi.tsx` | **NOUVEAU** kit de composants | `SliderField`, `FairPriceGauge`, `FamilyConditionRow`, `BagFlatRateRow`, `NetGainCard`, `formatEur` |
| `steps/StepConditions.tsx` | L'écran de l'étape 2 | Réécrit |
| `TripLiveSummary.tsx` | Bandeau résumé | + prix/kg, capacité, gain |
| `steps/StepReview.tsx` | Étape 3 | + carte « Prix & capacité » ; carte legacy affichée seulement s'il y a des catégories |
| `TripPublicPreview.tsx` | Aperçu public | + pills €/kg, kg dispo, familles refusées |
| `CreateTripWizard.tsx`, `CreateTripMobile.tsx` | Conteneurs desktop/mobile | Prop `toggleCategory` retirée ; progression mobile étape 2 recalculée |
| `apps/trip-service/src/schemas/trip.schema.ts` | Validation serveur (Zod) | Catégories exigées à la publication seulement pour le legacy |
| `apps/trip-service/src/controllers/trip.controller.ts` | `publishTrip` | Idem |
| `apps/trip-service/src/schemas/trip.schema.spec.ts` | **NOUVEAU** tests | 5 tests |
| `apps/user-ui/next.config.js` | Config Next | Fix du chemin next-intl (cherry-pick de la chore, voir §8) |

---

## 3. Le modèle de données côté formulaire (le `Draft`)

Le `Draft` est l'objet React (`useState`) qui contient tout ce que l'utilisateur saisit. Nouveaux champs :

```ts
pricePerKg: number | "";          // en EUROS (11.5), "" = pas encore saisi
capacityKg: number | "";          // en kilos (23)
checkedBag23Price: number | "";   // forfait bagage soute, euros, "" = non proposé
cabinBag12Price: number | "";     // forfait bagage cabine
familyConditions: Record<ParcelFamily, { mode: "ACCEPT" | "SURCHARGE" | "REFUSE"; surchargePct: number }>;
```

**Pourquoi `number | ""` et pas `number | null` ?** C'est la convention déjà utilisée par les champs prix du dossier (`globalPrice`) : un `<input type="number">` vide renvoie `""`, on le garde tel quel pour ne pas afficher « 0 » quand l'utilisateur n'a rien tapé.

**Pourquoi des euros dans le Draft alors que la règle non négociable dit « cents en Int » ?** La règle s'applique au **stockage et aux échanges API**. Le Draft est un état d'interface : l'utilisateur tape « 11,5 ». La conversion euros → cents se fait dans **un seul endroit**, le mapper (`Math.round(x * 100)`), et cents → euros dans le reverse-mapper. Ne jamais faire de calcul monétaire ailleurs.

**Pourquoi `familyConditions` est un `Record` (objet indexé par famille) et pas un tableau ?** Pour l'UI : afficher 8 lignes fixes et modifier l'une d'elles en O(1) (`draft.familyConditions[key]`). L'API, elle, attend un tableau — le mapper convertit. Le `surchargePct` est **conservé même en mode OK/Non** : si l'utilisateur passe de +20 % à Non puis revient à +%, il retrouve 20 %. Seul le mapper décide ce qui part.

---

## 4. La logique pure (`create-trip.config.ts`)

« Pure » = fonctions sans effet de bord, sans React, sans appel réseau : faciles à tester et à remplacer.

### 4.1 Les 8 familles

```ts
export const PARCEL_FAMILIES = [
  { key: "DOCUMENTS_PAPERS", icon: "📄", labelFr: "Documents & papiers", labelEn: "Documents & papers" },
  ...
];
```
Les `key` sont **exactement** celles de l'enum Prisma `ParcelFamily` et du contrat `packages/libs/api-contracts/src/trip/trip-pricing.schema.ts`. Si tu ajoutes une famille, il faut la faire dans les trois (Prisma, contrat, front) — la liste est dite « figée » (décision D14 / règle CAT-02).

### 4.2 La suggestion de prix (D15, version 1 déterministe)

```ts
suggestPricePerKg(draft) → { low, median, high }
```
- `median = 11 €/kg` (base) × `1,05` si vol direct × `1,08` si départ ≤ 3 jours (ou `1,04` si ≤ 7 jours).
- `low = median × 0,90`, `high = median × 1,15`.

**Pourquoi des valeurs en dur ?** La décision D15 prévoit une V1 « déterministe » avec une table `base_corridor` par corridor (Paris→Brazzaville ≠ Paris→Abidjan) et un signal de demande (alertes SavedRoutes). Ces données n'existent pas encore. On a donc une base unique, **isolée dans une fonction** : le jour où le serveur fournit la suggestion, on remplace le corps de `suggestPricePerKg` (ou on l'alimente par un hook) **sans toucher la jauge**, qui ne connaît que `{ low, median, high }`.

`getFairPriceVerdict(price, suggestion)` renvoie `"low" | "ok" | "high"` selon la position par rapport à la fourchette.

### 4.3 Le gain net (D16)

`estimateNetGain(draft) = pricePerKg × capacityKg`, arrondi à 2 décimales. C'est une **projection** (« si tous tes kilos sont réservés »). La commission Yamba est côté Expéditeur : le prix du Voyageur est son net, d'où le libellé. Les forfaits bagages ne sont pas ajoutés (ils consomment la même capacité, ce serait compter deux fois).

### 4.4 La validation de l'étape 2 (`validateStep2`)

Elle renvoie un objet `{ champ: message }` ; vide = OK. Règles :

| Champ | Règle | Pourquoi |
|---|---|---|
| `pricePerKg` | requis, > 0 | Le serveur refuse de publier sans prix ET capacité (« gate » A28) — on prévient l'utilisateur avant |
| `capacityKg` | requis, > 0 | idem |
| `family_<KEY>` | si mode SURCHARGE, `surchargePct` entier entre 1 et 100 | Miroir exact du `superRefine` du contrat API |
| `checkedBag23Price`, `cabinBag12Price` | optionnels, mais > 0 si saisis | Un forfait à 0 € n'a pas de sens ; le contrat dit `positive()` |
| lieux | ≥ 1 remise et ≥ 1 livraison activés | inchangé |

**Règle du projet à retenir** : le front **reflète** les règles serveur pour l'ergonomie, mais c'est **toujours le serveur qui tranche** (règle « toute limite métier est appliquée côté serveur »). Si tu changes une règle, change-la d'abord côté serveur (+ test), puis reflète-la ici.

---

## 5. Les mappers (la frontière avec l'API)

### 5.1 Draft → payload (`mapDraftToPayload`)

```ts
pricePerKgCents: toCentsOrNull(draft.pricePerKg),   // 11.5 → 1150 ; "" ou 0 → null
capacityKg: draft.capacityKg > 0 ? draft.capacityKg : null,
checkedBag23PriceCents: toCentsOrNull(draft.checkedBag23Price),
cabinBag12PriceCents: toCentsOrNull(draft.cabinBag12Price),
familyConditions: mapFamilyConditionsForApi(draft.familyConditions),
```
`mapFamilyConditionsForApi` ne garde **que les familles ≠ ACCEPT** : `[{ familyKey: "ELECTRONICS_DEVICES", mode: "SURCHARGE", surchargePct: 20 }, { familyKey: "FOOD_DRY_SEALED", mode: "REFUSE" }]`. Pourquoi ? Le contrat dit « null/vide = toutes les familles acceptées » ; envoyer 8 entrées dont 6 `ACCEPT` serait du bruit, et c'est exactement le format du trajet de démonstration du seed (`bzv-perkg`). Le `surchargePct` n'est envoyé qu'en mode SURCHARGE (le contrat le rendrait sinon incohérent).

Les champs legacy (`acceptedCategories`, `categoryConditions`) sont **toujours envoyés** (tableaux vides pour un trajet neuf) — voir §7 pour la coexistence.

### 5.2 API → Draft (`mapTripToDraft`)

Utilisé quand on **édite** un trajet existant. Cents → euros (`/100`), `familyConditions` reconstruit à partir de `createDefaultFamilyConditions()` (tout ACCEPT) puis écrasé par les entrées reçues. Une valeur inconnue est ignorée (défensif : un `any` vient de l'API).

---

## 6. Les composants UI

### 6.1 `TripPricingUi.tsx` — le kit

Chaque composant est « bête » : il reçoit des valeurs et des callbacks, aucune logique métier.

- **`SliderField`** : un `<input type="range">` + un `<input type="number">` liés à la même valeur. Le curseur affiche `min` quand la valeur est `""` (un range ne sait pas être vide), mais la valeur du Draft reste `""` tant que l'utilisateur n'a rien touché.
- **`FairPriceGauge`** : une barre en 3 zones. L'échelle va de `low − 45 % de l'écart` à `high + 45 %` (repris du mockup) pour que la zone verte soit centrée. La position du curseur est bornée entre 3 % et 97 % pour rester visible. La barre est un `linear-gradient` calculé en JS (`pct(low)`, `pct(high)`).
- **`FamilyConditionRow`** : la ligne icône + nom + [curseur % si SURCHARGE] + 3 boutons `role="radio"`.
- **`BagFlatRateRow`** : bordure pointillée (comme le mockup), champ euros, sous-titre « consomme X kg de ta capacité ».
- **`NetGainCard`** : la carte teal du gain.
- **`formatEur(n)`** : `toLocaleString("fr-FR", 2 décimales)` → « 11,50 ». Utilisée partout pour l'affichage monétaire du formulaire.

**Convention Next.js 16** : une prop fonction passée à un composant client se nomme `xxxAction` (`onChangeAction`), sinon TypeScript lève TS71007. Les composants existants (`Toggle`, `PriceInput`) ont encore `onChange` — ce sont des violations historiques catalogées dans `TODO-LEGACY-FIXES.md`, ne pas les imiter.

### 6.2 La charte graphique (spec §3.4)

Deux couleurs de marque, **mango** `#FF9900` et **teal** `#0F766E`, des neutres **slate**, dark mode par classe. Traduction dans le formulaire :

| Sens | Rendu |
|---|---|
| Accepter / positif / argent gagné | teal (`#0F766E`, fond `rgba(15,118,110,.10)`, dark `text-teal-400`) |
| Actif / surcharge / attention | mango (bordure `#FF9900`, fond `rgba(255,153,0,.10)`, texte dark `#FFB84D`) |
| Refuser / neutre / sous le marché | slate (`bg-slate-100 text-slate-600`, texte barré pour un refus) |
| Jauge | slate (basse) → teal (juste) → mango (haute) |

Le mockup HTML utilisait du rouge et de l'ambre : **on ne les a pas repris**. Le mockup fixe la structure, la charte fixe les couleurs.

### 6.3 `StepConditions.tsx`

Le composant assemble le kit. Points à connaître :
- `useMemo(() => suggestPricePerKg(draft), [draft])` : la suggestion dépend de la date et du type de vol saisis à l'étape 1.
- `setField(key, value)` : helper générique `setDraft(prev => ({ ...prev, [key]: value }))` — toujours passer par `prev` (mise à jour fonctionnelle) pour ne pas écraser une saisie concurrente.
- Le `useEffect` qui « seed » les lieux par défaut en mode édition est conservé tel quel.

### 6.4 Les écrans qui suivent

- `TripLiveSummary` : ajoute deux items (« 11,50 €/kg · 23 kg » et le gain en teal). Le compteur legacy « N cat. » ne s'affiche que si aucun prix/kg n'est saisi.
- `StepReview` : nouvelle `ReviewCard` « Prix & capacité » (prix en mango, kg dispo, gain, pills des familles surchargées en mango / refusées en slate barré, bagages). La carte legacy « catégories » est conditionnée à `acceptedCategories.length > 0`.
- `TripPublicPreview` : ce que verra l'Expéditeur — pill « 11,50 €/kg » mango, « 23 kg dispo » teal, familles refusées barrées. Les pills legacy s'affichent seulement sans prix/kg.
- `CreateTripMobile` : la barre de progression de l'étape 2 compte désormais 4 jalons (prix, capacité, un lieu de remise, un lieu de livraison).

---

## 7. Côté serveur : le complément du « gate » A28

### 7.1 Le problème découvert

PR-A avait ajouté le **gate de publication** (`apps/trip-service/src/services/pricing-gate.ts`) : on ne publie qu'avec UN moteur complet — PER_KG (prix > 0 ET capacité > 0) ou PER_CATEGORY (≥ 1 condition). Mais **deux vérifications plus anciennes** exigeaient encore `acceptedCategories` non vide à la publication :
- `trip.schema.ts` (validation Zod de `POST /trips` avec `publish: true`) ;
- `trip.controller.ts` → `publishTrip` (`POST /trips/:id/publish`).

Conséquence : un trajet PER_KG sans catégorie (le cas nominal après PR-B, la famille remplace la catégorie) aurait été refusé avec « At least one accepted category is required to publish ».

### 7.2 Le correctif

- Dans le schéma : on calcule `perKgComplete` (prix > 0 ∧ capacité > 0) et on n'exige les catégories que si **ce n'est pas** le cas.
- Dans le controller : on appelle d'abord `resolvePricingEngine(...)` ; s'il renvoie `null` → refus (message du gate) ; s'il renvoie `"PER_CATEGORY"` et qu'il n'y a pas de catégories → refus historique ; `"PER_KG"` → on continue.

Le troisième chemin de publication (`PATCH /trips/:id` avec `publish: true`) ne vérifiait déjà pas les catégories : rien à changer.

### 7.3 Les tests (`trip.schema.spec.ts`)

| Test | Vérifie |
|---|---|
| PER_KG complet sans catégorie | aucune erreur sur `acceptedCategories` |
| legacy sans catégorie | l'erreur historique est conservée |
| €/kg sans capacité (moteur « à moitié ») | catégories toujours exigées |
| brouillon (`publish` absent/false) | jamais d'erreur (on peut sauvegarder un brouillon incomplet) |
| SURCHARGE sans `surchargePct` | refusé (miroir du contrat) |

Les tests ciblent `issues` par `path` plutôt que `success` global, pour ne pas dépendre des autres règles de publication.

---

## 8. Hors périmètre mais dans la branche : le fix `next.config.js`

Pendant la session, `npm run user-ui` échouait : `Failed to process project graph … Could not find i18n config at ./src/i18n/request.ts`. Cause : `next-intl` résout un chemin relatif depuis `process.cwd()`, mais le plugin `@nx/next` évalue `apps/user-ui/next.config.js` depuis la **racine** du monorepo ; et Turbopack refuse un chemin absolu. Solution : `"./" + path.relative(process.cwd(), path.join(__dirname, "src/i18n/request.ts"))`, valable depuis la racine ET depuis `apps/user-ui`.

Ce fix a sa propre PR (`chore/next-intl-config-path`). Il est cherry-pické ici uniquement pour que Nx fonctionne sur la branche ; après merge de la chore, un `git rebase dev` le fera disparaître du diff.

---

## 9. Comment vérifier soi-même

```sh
# typecheck front (exactement comme la CI)
npx tsc --noEmit --project apps/user-ui/tsconfig.json
# typecheck + tests trip-service
npx tsc --noEmit --project apps/trip-service/tsconfig.app.json
npx nx test trip-service            # attendu : 162 (157 avant + 5)
# lancer et ouvrir
npm run dev  →  http://localhost:3000/fr/trips/create  (compte Voyageur)
```
QA manuelle : créer un trajet PER_KG ; rouvrir en édition le trajet du seed `bzv-perkg` (Voyageur « Thomas ») et vérifier que le formulaire relit 11,50 €/kg, 23 kg, Électronique +20 %, Alimentaire Non, soute 230 €.

Attention : la **publication** échoue encore avec « Carrier profile must be completed » si le Voyageur n'a pas fini son onboarding Stripe — c'est le gate profil/Stripe historique, qui passe AVANT le gate pricing (décision D31 : il sera déplacé à l'acceptation, micro-PR dédiée).

---

## 10. Ce que cette PR ne fait PAS (et où c'est noté)

- Pas de nettoyage du legacy (`CategoryChip`, `PriceInput`, `RevenueBadge`, `CATEGORY_GROUPS`, champs `@deprecated`) → PR cleanup post-refonte.
- La recherche par catégorie (`trip-search.controller.ts`, `acceptedCategories hasSome`) ne voit pas les trajets PER_KG → backlog « PR search ».
- Pas de tests front : `user-ui` n'a pas de runner Jest. Les fonctions pures (`suggestPricePerKg`, mappers) sont prêtes à être testées le jour où un target `test` existe.
- Le libellé enrichi de la taille S (« de l'enveloppe à la boîte à chaussures ») est côté Expéditeur → PR-C.

---

## 11. Glossaire

- **Draft** : l'état du formulaire (objet React) avant envoi.
- **Mapper / reverse-mapper** : conversion Draft ↔ payload API.
- **Gate** : une vérification bloquante à la publication.
- **A28** : l'arbitrage « bi-moteur tolérant » (les deux moteurs coexistent, jamais invalider l'existant).
- **D13 / D14 / D15 / D16 / D19** : décisions du registre (prix au kilo / familles / suggestion / commission côté Expéditeur / capacité).
- **Cents Int** : tout montant stocké ou transmis est un entier en centimes + une devise. Jamais de flottant.
