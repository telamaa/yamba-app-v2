# YAMBA — DOCUMENTATION TECHNIQUE (cumulative)

> **Règle d'équipe (29/08/2026)** : ce document est **complété à chaque PR** (une section « PR #… » par livraison), jamais remplacé ni dupliqué. Lisible par un développeur junior : ce qui a été fait, **pourquoi**, comment le vérifier. Les fiches d'origine (`context/fiches-pr/`) sont conservées comme archive et ne sont plus alimentées.

## Sommaire

- [#78 — Nx / next-intl](#78-nx-next-intl)
- [#79 — context/ versionné + CLAUDE.md](#79-context-versionn-claude-md)
- [#80 — ThemeProvider au root layout](#80-themeprovider-au-root-layout)
- [#81 — Build de production réparé](#81-build-de-production-r-par)
- [#82 — PR-B : formulaire pricing Voyageur (PER_KG)](#82-pr-b-formulaire-pricing-voyageur-per-kg)
- [#83 — Recherche et page trajet au kilo](#83-recherche-et-page-trajet-au-kilo)
- [#85 — PR-C : wizard de réservation au kilo](#85-pr-c-wizard-de-r-servation-au-kilo)

---

## #78 — Nx / next-intl

### 1. Symptôme

`npm run user-ui` (et **toute** commande Nx : `nx serve`, `nx test`, `nx show projects`) échoue avant même de démarrer :

```
NX   Failed to process project graph.
[next-intl] Could not find i18n config at ./src/i18n/request.ts, please provide a valid path.
```

Le fichier `apps/user-ui/src/i18n/request.ts` existe pourtant.

### 2. Cause (trois acteurs qui ne s'accordent pas)

1. `apps/user-ui/next.config.js` passe à `next-intl` un chemin **relatif** : `createNextIntlPlugin("./src/i18n/request.ts")`.
2. `next-intl` résout ce chemin avec `path.resolve(pathname)` **sans base** → donc par rapport à **`process.cwd()`**, le dossier d'où le process Node a été lancé.
3. Le plugin `@nx/next` (déclaré dans `nx.json`) **évalue `next.config.js` depuis la racine du monorepo** pour inférer les cibles (`dev`, `build`…). Depuis la racine, `./src/i18n/request.ts` n'existe pas → erreur → le graphe entier tombe.

Quand `next dev` tourne réellement, il est lancé depuis `apps/user-ui`, où le chemin relatif est juste — d'où un bug qui n'apparaît que via Nx.

Un chemin **absolu** (`path.join(__dirname, …)`) semble la solution évidente, mais **Turbopack le refuse** : « Turbopack support for next-intl currently does not support absolute paths ».

### 3. Correctif

```js
const path = require("path");
const withNextIntl = createNextIntlPlugin(
  "./" + path.relative(process.cwd(), path.join(__dirname, "src/i18n/request.ts"))
);
```

On calcule le chemin **relatif au cwd courant**, quel qu'il soit :
- depuis la racine → `./apps/user-ui/src/i18n/request.ts` ;
- depuis `apps/user-ui` → `./src/i18n/request.ts`.

`__dirname` est le dossier du fichier `next.config.js` (stable), `process.cwd()` le dossier de lancement (variable) — `path.relative` fait le pont.

### 4. Vérification

```sh
npx nx show project user-ui --json | jq '.targets | keys'   # → build, dev, start… (le graphe se calcule)
cd apps/user-ui && node -e "require('./next.config.js')"   # → charge sans erreur depuis l'app
npm run user-ui                                               # → démarre
```

Aucun changement fonctionnel, aucune traduction touchée.

### 5. Pourquoi une PR séparée

Le fix est indépendant de PR-B (pricing) ; l'isoler permet de le merger tout de suite et de garder le diff de PR-B lisible. Il est cherry-pické sur `feat/pricing-front-2` uniquement pour que Nx y fonctionne ; le rebase post-merge le fait disparaître.


---

## #79 — context/ versionné + CLAUDE.md

### 1. Ce que la PR ajoute

| Chemin | Rôle |
|---|---|
| `context/YAMBA-REGISTRE-DECISIONS-ROADMAP-v1.3.md` | **Le document maître** : décisions D1–D30 (D31/D32 arrivent avec PR-B), roadmap, arbitrages A-xx |
| `context/YAMBA-SPECIFICATION-COMPLETE.md` | Spécification de bout en bout (domaine, machines à états, pricing, événements, sécurité) |
| `context/YAMBA-REGLES-METIER-V2.md` | ~50 règles métier (PRC, CAP, ANN, COM, GAR…) |
| `context/YAMBA-CONTEXT.md` | Fait / reste à faire / règles non négociables |
| `context/YAMBA-CONTEXT-HANDOFF-PRICING-PR-A.md`, `…-PR-B.md` | État exact du chantier à chaque passation |
| `context/mockup-pricing-yamba.html` | La maquette HTML du pricing (spec du formulaire Voyageur et du calcul Expéditeur) |
| `context/fiches-pr/<PR>/FICHE-TECHNIQUE.md` + `FICHE-METIER.md` | Une paire par PR (règle d'équipe depuis le 28/08/2026) |
| `CLAUDE.md` | Instructions de travail : ordre de lecture de la gouvernance, précédence en cas de divergence (code+tests > registre > règles > synthèses), commandes Nx, baseline de tests, Git & CI (12 checks requis, D30), architecture des 4 services, règles non négociables, pièges connus |

### 2. Pourquoi versionner

- **Une seule vérité** : jusqu'ici `context/` vivait hors Git (copie locale + « project knowledge » à resynchroniser à la main) — source d'écarts (ex. D31 jamais reporté au registre).
- **Présent sur toutes les branches** : c'est le canal de communication entre l'équipe et l'assistant ; un checkout ne doit jamais le faire disparaître.
- **Revue** : une décision d'architecture passe désormais par un diff relisible dans une PR, avant le code.

### 3. Conventions

- Français pour les docs, anglais pour les surfaces publiques (OpenAPI, messages d'erreur API).
- Les **captures d'écran** de revue se déposent dans `context/fiches-pr/<PR>/captures/` mais **ne sont jamais versionnées** (`.gitignore`) : c'est un canal d'échange local, pas de la documentation.
- Les évolutions de `context/` se commitent **sur la branche de la PR concernée**, jamais sur une branche à part.

### 4. Vérification

Aucun code touché : les checks TypeScript/tests sont triviaux ; le seul check à regarder est **« secrets anti-leak »** (aucun secret dans ces fichiers — vérifié par grep avant commit).


---

## #80 — ThemeProvider au root layout

### Symptôme
En dev, à chaque bascule FR ↔ EN : `Console Error — Encountered a script tag while rendering React component…` pointant `ThemeProvider` dans `app/[locale]/layout.tsx`.

### Cause
`next-themes` (0.4.6, dernière version) rend un `<script>` inline anti-flash. Il était monté dans le layout du segment **`[locale]`** : changer de locale = nouveau segment = **remontage côté client** du layout et de son provider → React 19 recrée le `<script>` pendant un rendu client et signale (à juste titre) qu'il ne sera pas exécuté. Sans effet fonctionnel (le script avait tourné au SSR), mais bruit permanent en dev et signal d'un provider mal placé.

### Correctif
Le `ThemeProvider` monte dans **`app/layout.tsx`** (root : `<html>`/`<body>`, jamais remonté) et entoure `{children}` ; retiré de `app/[locale]/layout.tsx`. Le thème n'a aucune dépendance à la locale ; tous les consommateurs (`UiPreferencesProvider`, `Header`, pages) restent sous lui.

### Vérification
`npx tsc --noEmit --project apps/user-ui/tsconfig.json` · ouvrir `/fr/search`, basculer EN puis FR : plus d'erreur console ; le thème (clair/sombre, système) est conservé à la bascule.


---

## #81 — Build de production réparé

### Symptôme
`npx nx build user-ui` (= `next build`) sortait en **échec** à l'étape « Generating static pages » :
`useSearchParams() should be wrapped in a suspense boundary at page "/[locale]/refresh"` → `Export encountered an error … exiting the build`. Aucun `prerender-manifest.json`, donc `next start` impossible : **l'app n'était pas déployable**. Invisible en CI (elle ne fait que `tsc`) et en dev (`next dev` ne pré-rend pas).

### Cause
Next.js pré-rend statiquement les pages sans données dynamiques. Un composant client qui appelle `useSearchParams()` force un rendu côté client (« CSR bailout ») ; Next exige alors une **frontière `<Suspense>`** au-dessus pour pouvoir livrer le reste de la page en statique. Quatre pages rendaient un tel composant sans frontière : `(auth)/refresh` (`RefreshGate`), `carrier/onboarding` (`CarrierOnboardingWizard`), `carrier/onboarding/stripe/callback` (`StripeCallbackPage`), `trips/create` (`useEditTrip` lit `?edit=`). Les pages auth (login, verify…) sont `force-dynamic` : non pré-rendues, non concernées.

### Correctif
`<Suspense fallback={null}>` autour du composant dans chacune des 4 `page.tsx` — aucun changement de comportement à l'exécution (le fallback ne s'affiche qu'au pré-rendu).

### Vérification (faite)
`npx nx build user-ui` → exit 0, 57 pages générées ; `next start -p 3001` démarre ; `/fr/search`, `/en/search`, `/fr` répondent en **6–11 ms**.

### À faire (registre / CI)
Ajouter **`next build` de user-ui aux checks requis** (un 14ᵉ check) : c'est le seul moyen d'attraper cette classe d'erreur avant un déploiement. Proposé comme D-next « la CI construit ce qu'elle déploie ».


---

## #82 — PR-B : formulaire pricing Voyageur (PER_KG)

---

### 0. Le contexte en 2 minutes

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

### 1. Ce qu'un utilisateur voit après PR-B

> **Révision « dépôt en 90 s » (revue UX du 28/08)** — après une première version qui reproduisait le mockup section par section, l'écran a été resserré : **3 champs obligatoires visibles** (prix, capacité, un lieu par contexte), tout le reste **replié** dans des accordéons avec résumé sur la ligne, les explications dans des **popovers ⓘ** (tap-friendly) au lieu de texte courant, **prix et capacité pré-remplis** (médiane suggérée arrondie au 0,50 ; 12 kg), **icônes Lucide** au lieu d'emojis, familles en **Accepté / Refusé + « Ajouter un supplément »** au lieu de OK / +% / Non. La description ci-dessous reflète cet état final.

Dans « Créer un trajet », étape 2 « Conditions », l'ancien bloc « Catégories acceptées + prix » est remplacé par :

1. **Ton offre — prix au kilo** (pré-rempli) : curseur 5 → 20 €/kg (pas 0,50) synchronisé avec un champ, **jauge « prix juste »** (basse / juste / haute, thème-aware), badge de verdict, phrase d'ancrage + popover **« Pourquoi ce prix ? »** listant les facteurs (base corridor, vol direct +5 %, départ imminent −5 %/−2 %).
2. **Ton offre — capacité** (pré-remplie à 12 kg) : curseur 2 → 30 kg + champ ; la tolérance ±10 % est dans le ⓘ.
3. **Carte gain net** juste dessous : « Si tes 12 kg partent · 138,00 € · net, versé à J+4 ».
4. **▸ Familles de colis** (accordéon fermé, résumé « Toutes les familles acceptées » ou « Électronique : +20 % · Alimentaire : refusé ») — à l'intérieur, 8 lignes : icône Lucide dans une pastille teal, nom, **toggle Accepté/Refusé**, lien **« + Ajouter un supplément »** qui révèle un curseur 5 → 50 % et un ✕.
5. **▸ Bagage entier — forfait** (accordéon fermé, « Aucun forfait proposé » / « 1 forfait proposé ») — deux lignes soute 23 kg / cabine 12 kg avec prix en €, **équivalent ≈ €/kg** affiché, ligne **désactivée** avec message si la capacité est inférieure à la franchise.
6. **Lieux de remise / livraison** — inchangés.
7. **▸ Options & message** (accordéon fermé) — « Main propre uniquement » + message ; « Réservation instantanée » **n'est plus proposée** (D20 v1) — remplacée par l'info « Chaque demande passe par ton accord — tu réponds sous 24 h ».

Étape 1 : le champ « ville d'escale » passe en pleine largeur sous le contrôle « Vol direct / Avec escale ».

Le bandeau résumé en haut (« Avion · Paris → Brazzaville · 12 sept. · 11,50 €/kg · 23 kg · 264,50 € »), l'étape 3 « Vérification » et l'aperçu public reflètent les nouvelles valeurs.

---

### 2. Carte des fichiers modifiés

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

### 3. Le modèle de données côté formulaire (le `Draft`)

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

### 4. La logique pure (`create-trip.config.ts`)

« Pure » = fonctions sans effet de bord, sans React, sans appel réseau : faciles à tester et à remplacer.

#### 4.1 Les 8 familles

```ts
export const PARCEL_FAMILIES = [
  { key: "DOCUMENTS_PAPERS", icon: "📄", labelFr: "Documents & papiers", labelEn: "Documents & papers" },
  ...
];
```
`icon` est une **clé Lucide** (`"file-text"`, `"shirt"`, `"smartphone"`…) rendue par `TripPricingUi` — jamais un emoji (rendu OS-dépendant, non colorable à la charte). Les `key` sont **exactement** celles de l'enum Prisma `ParcelFamily` et du contrat `packages/libs/api-contracts/src/trip/trip-pricing.schema.ts`. Si tu ajoutes une famille, il faut la faire dans les trois (Prisma, contrat, front) — la liste est dite « figée » (décision D14 / règle CAT-02).

#### 4.2 La suggestion de prix (D15, version 1 déterministe)

```ts
suggestPricePerKg(draft) → { low, median, high }
```
- `median = 11 €/kg` (base) × `1,05` si vol direct × `0,95` si départ ≤ 3 jours (ou `0,98` si ≤ 7 jours).
- `low = median × 0,90`, `high = median × 1,15`.
- Le résultat porte aussi `factors: [{ key, pct }]` — la liste des modificateurs appliqués, affichée dans le popover « Pourquoi ce prix ? » (explicabilité > précision).

**Pourquoi le départ imminent BAISSE la suggestion ?** On est côté *offre* : un Voyageur qui part dans 2 jours a moins de temps pour vendre ses kilos — il doit être compétitif. La prime d'urgence existe côté *demande* (l'Expéditeur pressé), pas ici. La première version avait le signe inversé ; corrigé à la revue.

**Pré-remplissage** : à l'arrivée sur l'étape 2, si `pricePerKg === ""`, on écrit `roundToHalf(median)` (arrondi commercial au 0,50) et `capacityKg = 12` (`DEFAULT_CAPACITY_KG`). Une seule fois (`useEffect` au montage) — l'utilisateur garde la main.

**Pourquoi des valeurs en dur ?** La décision D15 prévoit une V1 « déterministe » avec une table `base_corridor` par corridor (Paris→Brazzaville ≠ Paris→Abidjan) et un signal de demande (alertes SavedRoutes). Ces données n'existent pas encore. On a donc une base unique, **isolée dans une fonction** : le jour où le serveur fournit la suggestion, on remplace le corps de `suggestPricePerKg` (ou on l'alimente par un hook) **sans toucher la jauge**, qui ne connaît que `{ low, median, high }`.

`getFairPriceVerdict(price, suggestion)` renvoie `"low" | "ok" | "high"` selon la position par rapport à la fourchette.

#### 4.3 Le gain net (D16)

`estimateNetGain(draft) = pricePerKg × capacityKg`, arrondi à 2 décimales. C'est une **projection** (« si tous tes kilos sont réservés »). La commission Yamba est côté Expéditeur : le prix du Voyageur est son net, d'où le libellé. Les forfaits bagages ne sont pas ajoutés (ils consomment la même capacité, ce serait compter deux fois).

#### 4.4 La validation de l'étape 2 (`validateStep2`)

Elle renvoie un objet `{ champ: message }` ; vide = OK. Règles :

| Champ | Règle | Pourquoi |
|---|---|---|
| `pricePerKg` | requis, > 0 | Le serveur refuse de publier sans prix ET capacité (« gate » A28) — on prévient l'utilisateur avant |
| `capacityKg` | requis, > 0 | idem |
| `family_<KEY>` | si mode SURCHARGE, `surchargePct` entier entre 1 et 100 | Miroir exact du `superRefine` du contrat API |
| `checkedBag23Price`, `cabinBag12Price` | optionnels, > 0 si saisis, **et capacité ≥ 23 / ≥ 12 kg** | Un forfait à 0 € n'a pas de sens ; un bagage entier consomme sa franchise — impossible avec 5 kg de capacité (RG-B-29, miroir de `checkBagCapacity` serveur) |
| lieux | ≥ 1 remise et ≥ 1 livraison activés | inchangé |

**Règle du projet à retenir** : le front **reflète** les règles serveur pour l'ergonomie, mais c'est **toujours le serveur qui tranche** (règle « toute limite métier est appliquée côté serveur »). Si tu changes une règle, change-la d'abord côté serveur (+ test), puis reflète-la ici.

---

### 5. Les mappers (la frontière avec l'API)

#### 5.1 Draft → payload (`mapDraftToPayload`)

```ts
pricePerKgCents: toCentsOrNull(draft.pricePerKg),   // 11.5 → 1150 ; "" ou 0 → null
capacityKg: draft.capacityKg > 0 ? draft.capacityKg : null,
checkedBag23PriceCents: toCentsOrNull(draft.checkedBag23Price),
cabinBag12PriceCents: toCentsOrNull(draft.cabinBag12Price),
familyConditions: mapFamilyConditionsForApi(draft.familyConditions),
```
`mapFamilyConditionsForApi` ne garde **que les familles ≠ ACCEPT** : `[{ familyKey: "ELECTRONICS_DEVICES", mode: "SURCHARGE", surchargePct: 20 }, { familyKey: "FOOD_DRY_SEALED", mode: "REFUSE" }]`. Pourquoi ? Le contrat dit « null/vide = toutes les familles acceptées » ; envoyer 8 entrées dont 6 `ACCEPT` serait du bruit, et c'est exactement le format du trajet de démonstration du seed (`bzv-perkg`). Le `surchargePct` n'est envoyé qu'en mode SURCHARGE (le contrat le rendrait sinon incohérent).

Les champs legacy (`acceptedCategories`, `categoryConditions`) sont **toujours envoyés** (tableaux vides pour un trajet neuf) — voir §7 pour la coexistence.

#### 5.2 API → Draft (`mapTripToDraft`)

Utilisé quand on **édite** un trajet existant. Cents → euros (`/100`), `familyConditions` reconstruit à partir de `createDefaultFamilyConditions()` (tout ACCEPT) puis écrasé par les entrées reçues. Une valeur inconnue est ignorée (défensif : un `any` vient de l'API).

---

### 6. Les composants UI

#### 6.1 `TripPricingUi.tsx` — le kit

Chaque composant est « bête » : il reçoit des valeurs et des callbacks, aucune logique métier.

- **`InfoHint`** : le ⓘ. Popover ouvert au **clic/tap** (jamais hover-only : le mobile n'a pas de hover), fermé par Échap ou clic dehors, `aria-expanded`/`aria-controls`. Largeur `min(20rem, 100vw − 3rem)` pour ne jamais déborder en 375 px.
- **`Accordion`** : titre + résumé + action mango (« Ajuster » / « Ajouter ») ; **le contenu n'est monté qu'ouvert** (`open && children`) — DOM léger, pas de 8 lignes de familles rendues pour rien.
- **`IconBadge`** : pastille ronde `teal/10` avec l'icône Lucide en trait 1,75 px ; grisée quand la ligne est refusée/désactivée.
- **`SliderField`** : un `<input type="range">` + un `<input type="number">` liés à la même valeur. Le curseur affiche `min` quand la valeur est `""` (un range ne sait pas être vide), mais la valeur du Draft reste `""` tant que l'utilisateur n'a rien touché.
- **`FairPriceGauge`** : une barre en 3 zones (trois `div` absolus avec classes Tailwind `dark:` — alphas plus forts en dark, où la première version était illisible). Échelle `low − 45 % de l'écart` → `high + 45 %` (mockup), curseur borné 3–97 %. L'espace sous la barre (repères + badge) est **réservé en hauteur fixe** : plus de chevauchement quand le badge est absent.
- **`FamilyConditionRow`** (`React.memo`) : icône + nom + badge « +20 % » si supplément + **`Toggle`** Accepté/Refusé (le composant existant du projet, compris de tous) ; dessous, « + Ajouter un supplément » → curseur 5–50 % + ✕. Mémoïsée : le parent passe des callbacks **stables** (un par famille, créés une fois via `useMemo`), donc taper dans le prix ne re-rend pas les 8 lignes. Cibles ≥ 44 px.
- **`BagFlatRateRow`** : bordure pointillée, champ euros, « consomme X kg » + **« ≈ 4,35 €/kg »** (équivalent au kilo pour que le Voyageur voie s'il brade), et un état **désactivé** avec la raison (« Monte ta capacité à 23 kg… »).
- **`NetGainCard`** : la carte teal du gain.
- **`formatEur(n)`** : `toLocaleString("fr-FR", 2 décimales)` → « 11,50 ». Utilisée partout pour l'affichage monétaire du formulaire.

**Convention Next.js 16** : une prop fonction passée à un composant client se nomme `xxxAction` (`onChangeAction`), sinon TypeScript lève TS71007. Les composants existants (`Toggle`, `PriceInput`) ont encore `onChange` — ce sont des violations historiques catalogées dans `TODO-LEGACY-FIXES.md`, ne pas les imiter.

#### 6.2 La charte graphique (spec §3.4)

Deux couleurs de marque, **mango** `#FF9900` et **teal** `#0F766E`, des neutres **slate**, dark mode par classe. Traduction dans le formulaire :

| Sens | Rendu |
|---|---|
| Accepter / positif / argent gagné | teal (`#0F766E`, fond `rgba(15,118,110,.10)`, dark `text-teal-400`) |
| Actif / surcharge / attention | mango (bordure `#FF9900`, fond `rgba(255,153,0,.10)`, texte dark `#FFB84D`) |
| Refuser / neutre / sous le marché | slate (`bg-slate-100 text-slate-600`, texte barré pour un refus) |
| Jauge | slate (basse) → teal (juste) → mango (haute) |

Le mockup HTML utilisait du rouge et de l'ambre : **on ne les a pas repris**. Le mockup fixe la structure, la charte fixe les couleurs.

#### 6.3 `StepConditions.tsx`

Le composant assemble le kit. Points à connaître :
- `useMemo(() => suggestPricePerKg(draft), [draft])` : la suggestion dépend de la date et du type de vol saisis à l'étape 1.
- `setField(key, value)` : helper générique `setDraft(prev => ({ ...prev, [key]: value }))` — toujours passer par `prev` (mise à jour fonctionnelle) pour ne pas écraser une saisie concurrente.
- Le `useEffect` qui « seed » les lieux par défaut en mode édition est conservé tel quel.

#### 6.4 Les écrans qui suivent

- `TripLiveSummary` : ajoute deux items (« 11,50 €/kg · 23 kg » et le gain en teal). Le compteur legacy « N cat. » ne s'affiche que si aucun prix/kg n'est saisi.
- `StepReview` : nouvelle `ReviewCard` « Prix & capacité » (prix en mango, kg dispo, gain, pills des familles surchargées en mango / refusées en slate barré, bagages). La carte legacy « catégories » est conditionnée à `acceptedCategories.length > 0`.
- `TripPublicPreview` : ce que verra l'Expéditeur — pill « 11,50 €/kg » mango, « 23 kg dispo » teal, familles refusées barrées. Les pills legacy s'affichent seulement sans prix/kg.
- `CreateTripMobile` : la barre de progression de l'étape 2 compte désormais 4 jalons (prix, capacité, un lieu de remise, un lieu de livraison).

---

### 7. Côté serveur : le complément du « gate » A28

#### 7.1 Le problème découvert

PR-A avait ajouté le **gate de publication** (`apps/trip-service/src/services/pricing-gate.ts`) : on ne publie qu'avec UN moteur complet — PER_KG (prix > 0 ET capacité > 0) ou PER_CATEGORY (≥ 1 condition). Mais **deux vérifications plus anciennes** exigeaient encore `acceptedCategories` non vide à la publication :
- `trip.schema.ts` (validation Zod de `POST /trips` avec `publish: true`) ;
- `trip.controller.ts` → `publishTrip` (`POST /trips/:id/publish`).

Conséquence : un trajet PER_KG sans catégorie (le cas nominal après PR-B, la famille remplace la catégorie) aurait été refusé avec « At least one accepted category is required to publish ».

#### 7.2 Le correctif

- Dans le schéma : on calcule `perKgComplete` (prix > 0 ∧ capacité > 0) et on n'exige les catégories que si **ce n'est pas** le cas.
- Dans le controller : on appelle d'abord `resolvePricingEngine(...)` ; s'il renvoie `null` → refus (message du gate) ; s'il renvoie `"PER_CATEGORY"` et qu'il n'y a pas de catégories → refus historique ; `"PER_KG"` → on continue.

Le troisième chemin de publication (`PATCH /trips/:id` avec `publish: true`) ne vérifiait déjà pas les catégories : rien à changer.

#### 7.3 RG-B-29 — un forfait bagage exige sa franchise

`pricing-gate.ts` gagne `checkBagCapacity({ capacityKg, checkedBag23PriceCents, cabinBag12PriceCents })` (pure, renvoie un message ou `null`). Branchée à **trois** endroits : le `superRefine` de `createTripSchema` (**brouillon compris** — une offre impossible ne doit jamais être enregistrée), `publishTrip`, et `updateTrip publish=true` sur les valeurs effectives (`payload ?? trip`). Tests : 4 sur la fonction + 2 sur le schéma.

#### 7.4 Les tests (`trip.schema.spec.ts`)

| Test | Vérifie |
|---|---|
| PER_KG complet sans catégorie | aucune erreur sur `acceptedCategories` |
| legacy sans catégorie | l'erreur historique est conservée |
| €/kg sans capacité (moteur « à moitié ») | catégories toujours exigées |
| brouillon (`publish` absent/false) | jamais d'erreur (on peut sauvegarder un brouillon incomplet) |
| SURCHARGE sans `surchargePct` | refusé (miroir du contrat) |

Les tests ciblent `issues` par `path` plutôt que `success` global, pour ne pas dépendre des autres règles de publication.

---

### 7ter. Régression trouvée en QA : le trajet créé était publié SANS son offre

Symptôme réel : trajet créé à 11 €/kg, en base `pricePerKgCents: null`, `capacityKg: null`, `familyConditions: []`, statut PUBLISHED. Deux causes dans `createTrip` (`POST /trips`) :
1. le `data` de `prisma.trip.create` énumère chaque champ à la main — **les 5 champs PER_KG n'y étaient pas** (le schéma Zod les acceptait, le controller les jetait) ;
2. le **gate A28 n'était appliqué que sur `publishTrip` et `updateTrip`**, pas sur `POST /trips` + `publish: true` → un trajet sans aucun moteur a pu être publié.

Correctif : helper pur `pickPerKgFields(data)` dans `pricing-gate.ts` (typé pour Prisma, **+2 specs**) étalé dans le `create` ; le gate `resolvePricingEngine` + `checkBagCapacity` appliqué sur ce troisième chemin. Leçon : **un chemin d'écriture qui liste ses champs à la main doit passer par un helper testé pour tout groupe de champs ajouté** — sinon le schéma « accepte » et la base « oublie », silencieusement.

Réparation du trajet de test : le rouvrir (« Modifier ») et enregistrer — `updateTrip` copie tous les champs.

### 7quater. Régression n° 2 en QA : `PUT /trips/:id` → 500 « Pipeline length greater than 50 »

Symptôme : impossible d'enregistrer une modification (500 gateway ; trip-service : `P2010 … AtlasError: Pipeline length greater than 50 not supported`). Cause : MongoDB Atlas en **tier partagé** (M0/M2/M5) limite un pipeline d'agrégation à 50 étapes ; **Prisma + Mongo traduit un `update` contenant des types composites** (listes embarquées `pickupLocations`, `familyConditions`…) **en une étape `$set` par champ**. Le PUT du wizard envoie ~60 champs — les 5 champs PER_KG ont fait franchir la limite.

Correctif : `apps/trip-service/src/lib/mongo-update-chunks.ts` — `chunkUpdateData(data, 40)` (pur, **+4 specs**) découpe l'écriture en paquets ≤ 40 champs appliqués séquentiellement ; les champs de **transition** (`status`, `publishedAt`, `currentStep`, `carrierRatingSnapshot`) vont **toujours dans le dernier paquet** : un trajet ne devient PUBLISHED qu'une fois toutes ses données écrites. Non atomique entre paquets (assumé : pas de transaction multi-documents nécessaire pour un seul document ; le pire cas est un brouillon partiellement mis à jour, jamais un publié incomplet). Ajouté aux pièges connus de `CLAUDE.md`.

### 7bis. Recherche et page détail : afficher le prix au kilo (retour QA)

Symptôme : un trajet PER_KG fraîchement créé affichait **« 0 € »** dans les résultats de recherche et sur sa page détail. Cause : ces écrans lisent `minPriceCents` (dénormalisé depuis les prix par catégorie), qui est `null` pour un trajet au kilo → `0`.

Correctif, de l'API au pixel :
- **Contrat** `trip-search.schema.ts` : `YambaTripResult` gagne `pricePerKg` (euros, null = legacy) et `remainingKg` (capacité − réservé, dérivé) → `openapi.json` régénéré (`npm run generate:openapi`, check CI « contracts »).
- **Mapper** `apps/trip-service/src/lib/trip-mappers.ts` : les deux champs calculés depuis `pricePerKgCents`, `capacityKg`, `reservedKg`.
- **DTO public** `GET /trips/:id/public` (`trip.controller.ts`) : expose `pricePerKgCents`, `capacityKg`, `reservedKg`, `remainingKg`, les forfaits bagages et `familyConditions` (déjà prévus par `trip-public.schema.ts` en PR-A, jamais branchés).
- **Front** : `YambaTripResult` et `PublicTrip` étendus ; `getPricePerKgCents()` dans `public-trip.helpers.ts` ; `TripResultCard` / `TripResultCardMobile` affichent **« 12,00 €/kg »** + « N kg dispo » (teal) au lieu de « dès 0 € » et n'ouvrent plus le popover par catégorie ; `BookingSummaryCard` / `BookingMobileBar` idem avec le sous-titre « N kg encore disponibles · l'Expéditeur paie poids × prix » ; le dashboard (`TripDetails`) ajoute une ligne €/kg dans « Tarifs ».

**Le créateur sur sa propre page publique** : `TripDetailView` compare `user.id` (hook `useUser`) à `trip.tripper.id` ; s'ils coïncident, la carte « Réserver » est remplacée par une carte **« C'est votre trajet »** avec **Modifier le trajet** (→ `/trips/create?edit=<id>`, le même écran que depuis le dashboard) et « Gérer dans mon tableau de bord ». Même chose dans la barre mobile. Un Voyageur ne se réserve pas lui-même.

Note : la recherche triée par « prix le plus bas » exclut toujours les trajets sans `minPriceCents` (choix 4 de PR-A : moteurs incomparables) — les trajets PER_KG restent visibles dans les autres tris ; la comparabilité est le chantier « PR search ».

### 7quinquies. Revue de la page recherche (lot 1)

- `apps/user-ui/src/lib/pricing-example.ts` — `estimateShipperTotalCents(pricePerKgCents, kg = 2)` : projection pure en **cents** (D13 poids facturable 0,5 kg min, D32 plancher 8 €, D16 commission 12 % min 3 €). Affichée sous le €/kg sur la carte desktop (« ex. colis 2 kg ≈ 27 € ») et sur la carte de réservation. Les paramètres sont ceux du mockup §13 et seront servis par l'API avec le moteur Expéditeur (PR-C) — ne pas les dupliquer ailleurs.
- **D20** : badge « ⚡ Instant » retiré de `TripResultCard`, entrée « Réservation instantanée » retirée de `SearchFiltersSidebar` (props conservées pour ne pas toucher `SearchResultsView` ; nettoyage complet du champ = PR cleanup).
- Durée « 2H » → « 2 h » (`formatDuration` ×2, `formatTripTimes.ts`).

Reste pour la **PR search** (registre D33 candidat « comparabilité ») : filtre par **famille** (le filtre catégorie legacy rend invisibles les trajets au kilo), tri « prix au kilo » unifié, filtres à compte 0 masqués, ville de rattachement d'un aéroport.

### 8. Hors périmètre mais dans la branche : le fix `next.config.js`

Pendant la session, `npm run user-ui` échouait : `Failed to process project graph … Could not find i18n config at ./src/i18n/request.ts`. Cause : `next-intl` résout un chemin relatif depuis `process.cwd()`, mais le plugin `@nx/next` évalue `apps/user-ui/next.config.js` depuis la **racine** du monorepo ; et Turbopack refuse un chemin absolu. Solution : `"./" + path.relative(process.cwd(), path.join(__dirname, "src/i18n/request.ts"))`, valable depuis la racine ET depuis `apps/user-ui`.

Ce fix a sa propre PR (`chore/next-intl-config-path`). Il est cherry-pické ici uniquement pour que Nx fonctionne sur la branche ; après merge de la chore, un `git rebase dev` le fera disparaître du diff.

---

### 9. Comment vérifier soi-même

```sh
## typecheck front (exactement comme la CI)
npx tsc --noEmit --project apps/user-ui/tsconfig.json
## typecheck + tests trip-service
npx tsc --noEmit --project apps/trip-service/tsconfig.app.json
npx nx test trip-service            # attendu : 174 (157 avant + 5 catégories/PER_KG + 4 bagage + 2 schéma bagage + 2 pickPerKgFields + 4 chunks Atlas)
## lancer et ouvrir
npm run dev  →  http://localhost:3000/fr/trips/create  (compte Voyageur)
```
QA manuelle : créer un trajet PER_KG ; rouvrir en édition le trajet du seed `bzv-perkg` (Voyageur « Thomas ») et vérifier que le formulaire relit 11,50 €/kg, 23 kg, Électronique +20 %, Alimentaire Non, soute 230 €.

Attention : la **publication** échoue encore avec « Carrier profile must be completed » si le Voyageur n'a pas fini son onboarding Stripe — c'est le gate profil/Stripe historique, qui passe AVANT le gate pricing (décision D31 : il sera déplacé à l'acceptation, micro-PR dédiée).

---

### 10. Ce que cette PR ne fait PAS (et où c'est noté)

- Pas de nettoyage du legacy (`CategoryChip`, `PriceInput`, `RevenueBadge`, `CATEGORY_GROUPS`, champs `@deprecated`) → PR cleanup post-refonte.
- La recherche par catégorie (`trip-search.controller.ts`, `acceptedCategories hasSome`) ne voit pas les trajets PER_KG → backlog « PR search ».
- Pas de tests front : `user-ui` n'a pas de runner Jest. Les fonctions pures (`suggestPricePerKg`, mappers) sont prêtes à être testées le jour où un target `test` existe.
- Le libellé enrichi de la taille S (« de l'enveloppe à la boîte à chaussures ») est côté Expéditeur → PR-C.

---

### 11. Glossaire

- **Draft** : l'état du formulaire (objet React) avant envoi.
- **Mapper / reverse-mapper** : conversion Draft ↔ payload API.
- **Gate** : une vérification bloquante à la publication.
- **A28** : l'arbitrage « bi-moteur tolérant » (les deux moteurs coexistent, jamais invalider l'existant).
- **D13 / D14 / D15 / D16 / D19** : décisions du registre (prix au kilo / familles / suggestion / commission côté Expéditeur / capacité).
- **Cents Int** : tout montant stocké ou transmis est un entier en centimes + une devise. Jamais de flottant.


---

## #83 — Recherche et page trajet au kilo

### 0. Le problème

Après PR-B, un trajet au kilo existe en base et s'affiche dans la liste… mais la recherche raisonne encore avec l'ancien moteur :
- le **filtre « Catégories »** (`acceptedCategories hasSome`) fait **disparaître** tout trajet au kilo dès qu'on coche une case (il n'a pas de catégories : la famille les remplace, D14) ;
- le **tri « Prix le plus bas »** trie sur `minPriceCents`, `null` pour un trajet au kilo → il est **exclu** du tri ;
- l'Expéditeur ne peut pas comparer « 15 € le colis » et « 12 €/kg ».

### 1. La décision : D33 (registre)

Un **colis de référence de 2 kg** rend les deux moteurs comparables. On dénormalise sur le Trip :

```
comparablePriceCents = PER_KG  → max(2 × pricePerKgCents, 800)   // plancher D32
                       legacy  → minPriceCents
                       aucun   → null (absent du tri par prix)
```
et le filtre devient **par famille** : un trajet est exclu s'il **refuse** la famille demandée ; un trajet sans conditions (legacy compris) accepte tout.

### 2. Carte des changements

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

### 3. Détails qui méritent une explication

- **Pourquoi un champ dénormalisé et pas un calcul au moment du tri ?** Mongo trie sur un champ indexé ; calculer « max(2 × prix, 800) » dans une requête Prisma n'est pas possible sans pipeline d'agrégation (et on vient de se cogner à la limite Atlas de 50 étapes). Un champ recalculé à l'écriture est simple, indexable, testable.
- **Pourquoi `familyConditions: { none: {...} }` par famille dans un AND**, plutôt qu'un `in` ? Les filtres Prisma sur types composites Mongo supportent `some/none/every` avec des égalités simples ; un AND de `none` par famille demandée est lisible et sûr.
- **Le filtre catégorie reste accepté par l'API** (compatibilité des clients / des URLs partagées) mais ne cache plus les trajets au kilo ; l'UI ne le propose plus.
- **Les facettes famille sont calculées sur la base SANS filtre famille** : sinon, cocher « Alimentaire » mettrait toutes les autres chips au compte des trajets-qui-acceptent-l'alimentaire — ce n'est pas ce qu'un utilisateur attend d'un compteur par chip.

### 3ter. D33 V2 — le poids de l'Expéditeur remplace la référence

« Pourquoi seulement pour 2 kg ? » — parce qu'un tri veut UN nombre et qu'un €/kg n'en est pas un sans poids. La référence reste le défaut, mais l'Expéditeur peut donner **le poids de son colis** (sidebar « Votre colis », curseur 0,5 → 30 kg, mémorisé en `localStorage`, clé `yamba.search.weightKg`) :

- **API** `weightKg` (search + facets) → ① exclusion des trajets au kilo dont la **capacité** < poids (approximation par `capacityKg` : Prisma/Mongo ne compare pas deux champs ; le front grise ceux dont `remainingKg` < poids, et CAP-01 vérifie à la réservation) ; ② chaque carte reçoit `transportForWeight` / `totalForWeight` (euros) calculés par `lib/price-for-weight.ts` (pur, **+5 specs** : plancher 0,5 kg / 8 €, service 12 % min 3 €, crossover legacy/PER_KG selon le poids) ; ③ tri « Prix le plus bas » **pour ce poids**.
- **Le tri pour un poids se fait en mémoire** : la clé dépend du poids (un legacy à 15 € passe devant 12 €/kg à partir de 1,25 kg), donc aucun index ne convient. Fenêtre bornée `WEIGHT_SORT_WINDOW = 200` trajets, curseur-offset `o:<n>`. Assumé v1 (volumes faibles) ; au-delà, pipeline d'agrégation `$max($multiply)` — sous les 50 étapes d'Atlas.
- **Front** : hint du tri « pour votre colis de 3 kg », carte « ≈ 40 € tout compris pour 3 kg » (chiffres serveur, plus le calcul local), badge « Plus assez de place » si `remainingKg` < poids. Sans poids saisi : comportement 2 kg inchangé, libellé explicite.
- Suite naturelle : le poids saisi **pré-remplit le wizard de réservation** (PR-C).

### 3bis. Régression vue en QA : « 5 comptés, 4 affichés »

Les facettes comptent avec un `where` Prisma ; la liste passe ensuite chaque trajet dans `mapTripToYambaResult`, qui **écartait** (try/catch + `console.warn`) tout trajet sans `arrivalAt`. Le trajet seed `bzv-perkg` n'en a pas → compté, jamais affiché. Le mapper n'exige plus que `departureAt` (le critère de recherche) ; sans arrivée : heure « — », pas de durée ni de « lendemain ». **+3 specs** (`trip-mappers.spec.ts`, première fixture du mapper). Règle : *ce que les facettes comptent, la liste doit pouvoir l'afficher* — un rejet dans un mapper de lecture est toujours suspect.

### 3quater. Page trajet (revue captures, même branche)

- **`OfferCard.tsx`** (nouveau, sous l'itinéraire) : « Ce que vous pouvez envoyer avec {prénom} » — €/kg, kilos disponibles, **exemple pour le poids mémorisé** (`localStorage` `yamba.search.weightKg`, sinon 2 kg) via `pricing-example.ts`, 8 familles en chips (✓ acceptée teal / +% mango / refusée slate barrée), forfaits bagage. `null` pour un trajet legacy — `CategoriesCard` (qui ne connaît que l'ancien moteur et rendait la page **sans aucune offre** pour un trajet au kilo) reste pour eux.
- **`ItineraryCard`** : prop `isOwner` (le CTA « Discuter » n'est pas montré au propriétaire) ; CO₂ calculé **pour le poids** : `calculateCO2SavedKg(trip, weightKg)` multiplie enfin par le poids (le facteur est en g/kg/km — on annonçait l'émission d'un kilo comme celle du colis : 265 kg pour Paris–Amsterdam…) ; libellé « … pour 2 kg ».
- **`BookingSummaryCard`** : exemple pour le poids mémorisé.
- **Politique d'annulation alignée sur ANN-01** (registre prime, aucun code d'annulation n'existe encore) : 100 % jusqu'à 48 h · < 48 h partiel (retenue reversée au Voyageur) · après remise : litige seulement. L'ancien texte (50 % entre 48 et 24 h, 0 % < 24 h) était une promesse hors registre.
- **Mise en page desktop** : `LocationsCard` + `ConditionsCard` montent dans la colonne de droite sous la carte (sticky, scroll interne) ; sur < lg ils restent dans le flux (rendu conditionnel `lg:hidden` / `hidden lg:block`). Objectif : la page tient dans un écran 1440×900.

### 3quinquies. D32 annoncée à l'écran

`MIN_PARCEL_PRICE_EUR` / `MIN_BILLABLE_KG` exportés par `lib/pricing-example.ts` (même source que le calcul) et affichés dans `StepConditions` (Voyageur), `SearchFiltersSidebar` (sous le curseur poids), `OfferCard` et `BookingSummaryCard` (Expéditeur). Une règle qui n'est pas dite à l'écran est une surprise à la réservation.

### 3sexies. Suggestion de prix par corridor (D15 V1.5, front)

`lib/pricing-corridors.ts` : chaque pays (ISO alpha-2) est classé dans une **zone-marché** (Europe = UE + UK + CH + NO + Balkans + UA · Russie · Maghreb · Afrique de l'Ouest / centrale / Est-australe · Moyen-Orient · Asie du Sud / de l'Est / du Sud-Est / centrale · Amérique du Nord · Amérique latine-Caraïbes · DOM-TOM · Océanie) ; `corridorBasePerKg(from, to, km)` lit une base **zone × zone** (matrice depuis l'Europe + paires connues + repli moyenne), corrigée de ±10 % max par la distance (log autour de 5 000 km). `suggestPricePerKg` (création de trajet) l'utilise à la place de la base unique 11 € ; le popover « Pourquoi ce prix ? » affiche « Base du corridor Europe → Afrique centrale : 12,11 €/kg ». **Les valeurs sont des hypothèses** à valider par l'étude GP (D15) — un seul fichier à éditer. Le serveur reprendra la même table pour `GET /trips/price-suggestion`.

### 4. Vérifier

```sh
npx tsc --noEmit --project apps/trip-service/tsconfig.app.json && npx nx test trip-service   # 187
npx tsc --noEmit --project apps/user-ui/tsconfig.json
curl "localhost:6002/trips/search?sort=lowestPrice&locale=fr"          # PER_KG et legacy mélangés, triés
curl "localhost:6002/trips/search?families=FOOD_DRY_SEALED&locale=fr"  # bzv-perkg (alimentaire refusé) absent
curl "localhost:6002/trips/search/facets?locale=fr"                     # familyCounts
```

### 5. Ce que cette PR ne fait pas
- Aéroport choisi comme ville de départ (« Orly → Amsterdam ») → ville de rattachement + lieu de pickup : chantier step 1.
- Le poids de référence 2 kg est une constante (`REFERENCE_KG`) — paramètre serveur §13 candidat, comme le plancher.
- Suppression complète de `instantBooking` (champ, filtre API, facette) : PR cleanup.


---

## #85 — PR-C : wizard de réservation au kilo

### 0. Le contexte

Le wizard de réservation Expéditeur (`/trips/[id]/book`, 4 étapes) existait **en front seulement** : il tournait sur un trajet **mocké** (`mockTrip`), raisonnait en **catégories** (ancien moteur) et calculait un prix avec des constantes locales (15 % de service, 6 € d'assurance). La création du deal côté serveur (`POST /deals`, paiement) est le lot **B2** — pas cette PR.

PR-C fait trois choses : ① le wizard réserve sur le **vrai trajet** ; ② il parle le **moteur au kilo** (poids, taille S/M/L, famille, bagage entier, Garantie) ; ③ le prix vient d'**un moteur unique et pur, partagé front/serveur** (D34) — ce que l'Expéditeur voit est exactement ce que le serveur figera (D17).

### 1. La décision D34 : `@packages/pricing`

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

### 2. Carte des changements front (`apps/user-ui/src/components/booking/`)

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

### 3. Détails qui méritent une explication

- **Pourquoi le devis en cents traverse jusqu'à l'UI ?** Pour que le récap affiche exactement ce qui sera figé : la sidebar lit `quote.billableWeightKg`, `quote.minimumApplied`… et les euros ne servent qu'au `formatPrice`.
- **Pourquoi la validation « poids > kg restants » est en front alors que le serveur tranche ?** Ergonomie : dire « il ne reste que 12 kg » avant l'étape 4 ; CAP-01 reste la vérité à la réservation (concurrence).
- **Trajet legacy** : le wizard garde son ancien chemin (catégorie + prix par colis) — bi-moteur tolérant (A28) — mais la commission passe par `PRICING_PARAMS` (12 %/3 €), plus la constante locale 15 %.
- **GAR-02** : « Assurance optionnelle » → « Protection du colis », « Assurance jusqu'à 500 € » → « Garantie Yamba — jusqu'à 500 € », « Voir la fiche IPID » → « Voir les conditions ». Le mot « assurance » reviendra avec le nom du partenaire, pas avant.

### 3bis. Revue UX (captures) et performance

- **0 € partout** : le poids était vide (placeholder « 2,5 » ≠ valeur) → `QuoteError` → zéros. Fix : `buildInitialDraft` part du poids mémorisé sinon **2 kg** ; le récap affiche un **indice** (`summary.quoteHint.<code>`) quand le devis est impossible, jamais 0 €. Lieux pré-sélectionnés (1er choix).
- **Garde d'identité** (CNF-05) : `BookingClient` exige `useUser().user` ; sinon écran « Connecte-toi pour réserver » → `/login?redirect=/trips/<id>/book` (le `LoginForm` lit déjà `redirect`).
- Colonne droite : **récap + CTA d'abord**, protection ensuite. « 0.0 · 0 deals » → « Nouveau Tripper ». Titre/prix de la Garantie sur une ligne (« Garantie Yamba 500 € · +6 € », `whitespace-nowrap`). Règles d'or dans un `<details>` replié (le bloc bleu hors charte devient teal/slate — `TIP_BG/TIP_TITLE`). Grille photos : 1 case vide puis +1 à chaque ajout (au lieu de 5 cases béantes).
- **Perf** : `StepPayment` (Stripe Elements + stripe-js) chargé via `next/dynamic` à l'étape 4 → hors du bundle de l'étape 1. Le trajet est déjà en cache React Query (`["public-trip", id]`) depuis la page détail → ouverture du wizard sans requête. Mesures dev : HTML 110–320 ms, API trajet 120 ms, RSC 107 Ko (les 23 namespaces i18n — chantier global « messages par route », noté).

### 4. Vérifier

```sh
npx nx test deal-service                       # 225 (218 + 7)
npx tsc --noEmit --project apps/user-ui/tsconfig.json
## Parcours : recherche (poids 3 kg) → trajet Orly → Amsterdam → Réserver
##   étape 1 : poids pré-rempli 3, famille « Vêtements » sélectionnée, taille S
##   récap : « Transport · 3 kg × 12,00 €/kg × S 36,00 € · Service & protection 4,32 € · Total 40,32 € »
##   passer en L + Électronique (+20 % si le trajet le surcharge) → le total suit
##   poids 0,2 → « Minimum par colis appliqué : 8,00 € », total 11,00 €
##   famille refusée : chip grisée, non cliquable ; poids 40 → erreur kg restants
```

### 5. Ce que cette PR ne fait pas
- `POST /deals`, paiement, snapshot en base : **B2** (le moteur est prêt, le stub envoie déjà le devis).
- Photos horodatées R2, IPID/conditions de la Garantie : inchangés (stubs).
- `GET /pricing/params` : PR « paramètres serveur ».


---


---

# B2-PR1 — Naissance du deal : `POST /deals` + argent autorisé (D37, D38)

> Branche `feat/b2-deal-request` · 29/08/2026 · base `dev` (après #89 + jalons mobile + docs cumulatifs)

### 1. Le problème
Jusqu'ici le wizard de réservation s'arrêtait sur un **stub** : `createDeal` affichait un toast et redirigeait vers un identifiant inventé. Rien n'était écrit, rien n'était payé, le Voyageur ne recevait rien. B2 doit faire naître le deal **avec l'argent bloqué**, sans jamais faire confiance à un montant venu du navigateur.

### 2. La séquence (D37) — pourquoi deux appels
```
Étape 4 du wizard
  │ POST /deals/payment-intents {tripId, product, family, sizeClass, weightKg, protection, expectedTotalCents}
  │   serveur : trajet réservable ? devis recalculé (@packages/pricing) == expectedTotalCents ? place ?
  │   → PaymentProvider.authorize(total)  ⇒ { paymentIntentId, clientSecret, quote }
  │ (Stripe Payment Element : l'Expéditeur confirme sa carte → l'intent passe à requires_capture)
  │ POST /deals {…même saisie…, paymentIntentId, description, destinataire, lieux, charte}
  │   serveur : re-vérifie TOUT + retrieve(intent) = AUTHORIZED, montant/trajet/expéditeur identiques, intent jamais utilisé
  │   → transaction Mongo : reservedKg += kg (conditionnel) · booking.create PENDING · 2 outbox
  └ 201 { bookingId, status: PENDING, expiresAt (+24 h), total }
```
Un intent abandonné n'est jamais capturé : il expire seul chez Stripe. Une place perdue entre les deux appels annule la transaction **et** libère l'autorisation.

### 3. Où est le code
| Couche | Fichier | Rôle |
|---|---|---|
| Contrats | `packages/libs/api-contracts/src/booking/booking-request.schema.ts` | `CreatePaymentIntentRequest/Response`, `CreateBookingRequest/Response`, `BOOKING_REQUEST_ERROR_CODES` ; `ShipperPricing` + 7 champs D34 ; `BookingPlaceSnapshot` |
| Paiement | `packages/libs/payments/src/index.ts` | `PaymentProvider` (authorize / retrieve / capture / cancel / refund), `StripePaymentProvider` (`capture_method: "manual"`, `automatic_payment_methods`), `FakePaymentProvider`, `createPaymentProviderFromEnv` (Fake refusé en production) |
| Logique pure | `apps/deal-service/src/services/booking-request.ts` (+ `.spec.ts`, 18 tests) | `checkTripBookable`, `resolveFamilySurcharge`, `buildQuoteInput`/`quoteForTrip`, `assertQuoteMatches`, `checkCapacity`, `buildBookingSnapshots`, `BookingRequestError` (409 + `details.code`) |
| Orchestration | `apps/deal-service/src/services/deal-request.service.ts` | `makeDealRequestService(provider)` : les deux cas d'usage, la transaction, la libération de l'empreinte |
| HTTP | `controllers/deal-request.controller.ts`, `routes/deal.routes.ts`, `openapi/build-openapi.ts` | validation Zod → service → 201 ; OAS régénéré (3 fichiers `openapi.json`) |
| Schéma | `prisma/schema.prisma` | `BookingPricingSnapshot` + 7 champs optionnels, `BookingPlaceSnapshot`, `Booking.pickupPlace/deliveryPlace/paymentProvider` |
| Erreurs | `packages/error-handler/error-middleware.ts` | `details.type = "booking"` exposé même en production (le front a besoin du code) |
| Front | `services/booking.api.ts`, `components/booking/useBookingCheckout.ts`, `steps/StepPayment.tsx`, `BookingWizard/Mobile.tsx`, `booking.types/state.ts`, `messages/*/booking.json` (`step4.*`) | intent créé à l'arrivée en étape 4, un seul Payment Element, `confirmPayment` sans redirection (3-DS : `return_url`), traduction des codes 409 |
| Webpack | `apps/deal-service/webpack.config.js` | alias `@packages/payments` et `@packages/pricing` (le serve Nx ne lit pas `paths`) |

### 4. Les garde-fous serveur (le front ne décide jamais)
- **Devis** : recalculé deux fois (aux deux appels) par le même moteur que le front (D34). Divergence ⇒ 409 `QUOTE_DIVERGENCE` avec `actualTotalCents` : le front recrée une autorisation sur le nouveau total, rien n'est débité.
- **Autorisation** : `retrieve(intent)` doit être `AUTHORIZED`, au bon montant, avec `metadata.tripId/shipperId` identiques (`PAYMENT_MISMATCH` sinon), et jamais rattachée à un Booking (`PAYMENT_ALREADY_USED`).
- **Capacité (CAP-01)** : vérifiée en mémoire (refus précoce) **et** dans le `WHERE` de l'`updateMany` (garantie atomique face à la concurrence) — 0 ligne ⇒ `CAPACITY_EXCEEDED`.
- **Trajet** : PUBLISHED, non supprimé, départ futur, pas le sien (`OWN_TRIP`), famille non refusée (`FAMILY_REFUSED`).
- **Outbox** : les 2 événements passent par `BookingDomainEventSchema.parse` AVANT `create` — un payload invalide est un 500 du writer, jamais un message poison pour le relay.

### 5. Preuve (smoke test réel, 29/08)
Orly → Amsterdam 12 €/kg, colis 2 kg M : `expectedTotalCents: 1` → 409 QUOTE_DIVERGENCE (actual 2957) · PI Stripe test 29,57 € (`requires_capture` après `pm_card_visa`) · `POST /deals` avant confirmation → 409 PAYMENT_NOT_AUTHORIZED · après → 201 PENDING, `reservedKg 0 → 2`, snapshot `transport 2640 / commission 317 / service 317 / sizeCoef 1.1`, `pickupPlace AIRPORT CDG T2E`, 2 lignes outbox · rejeu → 409 PAYMENT_ALREADY_USED · `GET /deals/:id` → vue SHIPPER. Données de test nettoyées (PI annulé, kg restitués).

### 6. Ce que cette PR ne fait pas (B2 suite)
Accept/decline + capture/libération et gate D31, cron d'expiration 24 h, annulation ANN-01 / remboursements, **webhook Stripe** (aujourd'hui l'état est lu à la demande via `retrieve`), emails, upload des photos (`photoUrls: []`), chiffrement du code de livraison.

### 7. Pour tester en local
`STRIPE_SECRET_KEY` (sk_test) côté serveur **et** `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (pk_test) côté front, carte `4242 4242 4242 4242`. Sans aucune clé : fournisseur FAKE, l'étape 4 affiche « Mode test » et « Payer » envoie directement la demande.

---

# B2-PR2 — Cycle de vie du deal : accepter, refuser, annuler, expirer (D31, D39, D40)

> Branche `feat/b2-deal-lifecycle` · 31/08/2026 · base `feat/b2-deal-request` (B2-PR1)

### 1. Le problème
Après B2-PR1, un deal naissait PENDING avec l'argent bloqué… et restait PENDING pour toujours. Rien ne permettait au Voyageur d'accepter (donc de capturer), de refuser (donc de libérer l'empreinte), à l'Expéditeur d'annuler, ni au système de faire expirer les demandes sans réponse. Et personne n'écoutait Stripe : une empreinte qui mourait seule (expiration ~7 jours) laissait un deal « acceptable » sans argent derrière.

### 2. Les décisions gravées AVANT le code
- **D39 — capture à l'ACCEPTATION** (pas à J-1 du départ) : une empreinte carte expire ~7 jours chez Stripe ; capturer à J-1 casserait tout deal accepté plus d'une semaine avant le départ. Conséquence : toute annulation post-acceptation est un **remboursement**. Barème ANN-01 : 100 % jusqu'à J-2, sinon retenue **50 %** (`CANCEL_LATE_RETENTION_PCT`, destinée au Voyageur — versée avec l'infra payout B4, tracée dès maintenant dans `refundAmountCents` et `booking.refund_issued`).
- **D40 — le webhook Stripe est la source de vérité** : `payment_intent.canceled` → un Booking PENDING qui porte cet intent est annulé par SYSTEM (nouvelle transition machine `PENDING —cancel/SYSTEM→ CANCELLED`, répercutée dans la spec §2.2). Corps BRUT vérifié par signature, monté AVANT `express.json` ; en dev `stripe listen --forward-to localhost:6003/webhooks/stripe` (jamais via le gateway, qui re-sérialise le JSON).
- **D31 exécuté** : les 2 checks profil/Stripe sont RETIRÉS des 3 chemins de publication du trip-service (create+publish, update+publish, publish) et appliqués dans l'accept — au moment où l'argent est réel. Le gate est sauté avec le FakePaymentProvider (dev sans clés).

### 3. Le rituel commun à toutes les transitions
```
controller (Zod) → service :
  1. charger le booking, vérifier la PARTIE (403 : le deal existe, pas pour toi)
  2. canPerform(booking, action, acteur)  ← la MACHINE décide, jamais le controller
       refus ⇒ 409 TRANSITION_NOT_ALLOWED (avec la raison de la machine)
  3. L'ARGENT D'ABORD : capture / cancel / refund chez le PaymentProvider
  4. LA BASE ENSUITE : UNE transaction Mongo
       booking.updateMany { id, status: attendu }  ← conditionnel : 2 clics, 1 gagnant
       trip.updateMany reservedKg -= kg            ← CAP-02, si l'effet le déclare
       outboxEvent.create × N                      ← validés au contrat AVANT écriture
  5. compensation best-effort (capture réussie mais course perdue → refund)
```

### 4. Où est le code
| Couche | Fichier | Rôle |
|---|---|---|
| Machine | `apps/deal-service/src/services/booking-state-machine.ts` | effet `CAPTURE_PAYMENT` déclaré sur accept (D39) ; transition `PENDING —cancel/SYSTEM→ CANCELLED` (D40) — spec 196 tests |
| Contrats | `packages/libs/api-contracts/src/booking/booking-lifecycle.schema.ts` | `DeclineReason` (5 valeurs É2), `AcceptDealRequest` (charte littérale `true`), `DeclineDealRequest`, `CancelDealRequest`, `DealTransitionResponse`, `BOOKING_LIFECYCLE_ERROR_CODES` |
| Logique pure | `apps/deal-service/src/services/booking-lifecycle.ts` (+ `.spec.ts`) | `computeCancellationRefundCents` (barème ANN-01, bornes exactes), `kgReservedBySnapshot` (miroir CAP-02 de `kgToReserve`), `baseEventPayload` (depuis les snapshots D17, jamais relu du Trip), `BookingLifecycleError` |
| Orchestration | `apps/deal-service/src/services/deal-lifecycle.service.ts` (+ `.spec.ts`, 31 tests) | `accept` / `decline` / `cancel` / `expireDueBookings` / `cancelBookingForDeadPayment` — le rituel ci-dessus |
| HTTP | `controllers/deal-lifecycle.controller.ts`, `routes/deal.routes.ts` | `POST /deals/:id/accept · /decline · /cancel` ; le provider est UNE instance partagée (demande + cycle de vie + cron + webhook) |
| Webhook | `controllers/stripe-webhook.controller.ts`, `main.ts` | `POST /webhooks/stripe` en `express.raw` AVANT `express.json` ; 501 sans secret, 400 signature invalide, 500 ⇒ Stripe réessaie (filet voulu) |
| Vérif signature | `packages/libs/payments/src/index.ts` | `constructStripeWebhookEvent(rawBody, signature, secret)` — kafkajs-style : stripe reste isolé dans la lib |
| Cron | `apps/deal-service/src/cron/expire-bookings.cron.ts` | toutes les 5 min, fournées de 50, anti-chevauchement, `BOOKING_EXPIRY_CRON_ENABLED=false` pour une instance API pure |
| Trip-service | `controllers/trip.controller.ts` | gate profil/Stripe RETIRÉ des 3 chemins de publication (D31) — le `carrierPage` ne sert plus qu'au snapshot de note |
| Schéma | `prisma/schema.prisma` | `Booking.cancelReason` (l'annulation Expéditeur a sa raison, distincte de `declineReason`) |
| Env | `.env.example` | `STRIPE_WEBHOOK_SECRET`, `BOOKING_EXPIRY_CRON_ENABLED` |

### 5. Les cinq chemins, argent compris
| Chemin | Argent | Base (une transaction) | Outbox |
|---|---|---|---|
| accept (Voyageur) | `capture(intent)` — après gate D31 et `retrieve = AUTHORIZED` | PENDING→ACCEPTED, `acceptedAt`, `capturedAt` | `booking.accepted` |
| decline (Voyageur) | `cancel(intent)` best-effort (l'empreinte expirerait seule) | PENDING→DECLINED, `closedBy/At`, `declineReason` ; kg restitués | `booking.declined` + `booking.refund_issued` (total) |
| cancel PENDING (Expéditeur) | `cancel(intent)` | PENDING→CANCELLED, `cancelReason`, `refundAmountCents` = total ; kg | `booking.cancelled` (wasAccepted:false) + `booking.refund_issued` |
| cancel ACCEPTED (Expéditeur) | `refund(intent, montant ANN-01)` — échec ⇒ 409, AUCUNE écriture | ACCEPTED→CANCELLED, `refundedAt`, `refundAmountCents` ; kg | `booking.cancelled` (wasAccepted:true) + `booking.refund_issued` (montant) |
| expire (cron) / webhook (SYSTEM) | `cancel(intent)` / rien (déjà mort) | →EXPIRED / →CANCELLED `closedBy: SYSTEM` ; kg | `booking.expired` + `refund_issued` / `booking.cancelled` seul |

### 6. Les courses (deux clics, deux acteurs, un cron)
Tous les chemins écrivent avec `updateMany { id, status: attendu }` : le second perdant reçoit 409 « This deal changed in the meantime ». La course accept/decline se joue chez **Stripe** (on ne peut pas capturer un intent annulé, ni annuler un intent capturé) ; si la capture réussit mais que la transaction perd, l'accept rembourse (compensation) ; si un cancel échoue silencieusement, le webhook D40 réconcilie. Le webhook lui-même est idempotent : booking absent, non-PENDING ou course perdue ⇒ no-op 200.

### 7. Tests (+46 → plateforme 503)
Machine 188→196 (transition SYSTEM + effet CAPTURE_PAYMENT) · `booking-lifecycle.spec.ts` 7 (bornes EXACTES du barème : 48 h pile = 100 %, une minute sous = 50 % arrondi) · `deal-lifecycle.service.spec.ts` 31 : le VRAI FakePaymentProvider (les effets argent s'observent sur son état), prisma mock virtuel, contrat outbox RÉEL (`BookingDomainEventSchema.parse` dans le chemin testé). Gate D31 testé avec un stub STRIPE (le Fake le saute par design).

---

# B2-PR3 — Front des transitions : l'écran É2 réel, l'annulation Expéditeur (A31–A34)

> Branche `feat/b2-deal-front` · 01/09/2026 · base `feat/b2-deal-lifecycle` (B2-PR2)

### 1. Le problème
B2-PR2 avait donné au serveur les trois transitions (accept/decline/cancel) — mais aucun écran ne les appelait. L'écran Voyageur É2 (`/carrier/deals/[dealId]`) tournait sur des mocks (`sleep(800)` + code de livraison inventé), son vocabulaire de refus divergeait du contrat, sa décomposition des gains affichait la commission et le total Expéditeur (interdits par A13), et l'Expéditeur n'avait AUCUN moyen d'annuler. `allowedActions`, exposé par les deux vues depuis B1-PR3, n'était consommé nulle part.

### 2. Les décisions gravées AVANT le code (registre §2bis.5)
- **A31** — la préviz d'annulation (`cancellationPreview`) est SERVIE par la vue Shipper, calculée par le mapper avec le même `computeCancellationRefundCents` que le cancel réel. Le front ne connaît pas le barème ANN-01 : il affiche.
- **A32** — le refus = la raison seule (5 valeurs du contrat, optionnelle). Le textarea « détails » du mock n'existait pas côté serveur : supprimé de l'UI (jamais un champ qui ment).
- **A33** — le FakePaymentProvider adopte les intents `pi_fake_seed_*` inconnus (AUTHORIZED à la lecture) ; le seed pose `paymentProvider: FAKE`, un intent par booking et un `CarrierPage` COMPLETE/Stripe factice par Voyageur → les parcours accept/decline/cancel sont JOUABLES en dev sans clés.

### 3. Où est le code
| Couche | Fichier | Rôle |
|---|---|---|
| Contrat | `packages/libs/api-contracts/src/booking/booking.schema.ts` | `CancellationPreviewSchema` (`refundCents`, `retentionCents`, `retentionPct`, `fullRefundUntil`, `currencyCode`) ; `ShipperBookingView.cancellationPreview` non nul ⇔ `cancel` ∈ `allowedActions` |
| Mapper | `apps/deal-service/src/services/booking-view.mapper.ts` | `toCancellationPreview` — PENDING : total (l'empreinte n'est pas capturée) ; ACCEPTED : barème au moment de la lecture ; `now` injectable (tests) |
| Adapter carrier | `apps/user-ui/src/components/carrier/deal/deal.adapter.ts` | `toDealRequest(CarrierBookingView)` — SEULE frontière contrat→vue (pattern shipments.adapter) ; dégradations documentées : stats shipper absentes (B5), gains = net seul (A13), recipient révélé après pickup |
| API carrier | `.../carrier/deal/deal.api.ts` | `getDealRequest`/`acceptDeal`/`declineDeal` réels (`DealApiError` typée, 403 confondu en NOT_FOUND) ; pickup/deliver/tracking restent mock (B3) |
| Orchestrateur | `.../carrier/deal/DealClient.tsx` | TanStack Query `["deal", dealId]` ; après transition on INVALIDE (jamais de mutation locale du statut) ; statuts terminaux → écran `DealClosed` |
| Hook actions | `.../views/request/useDealRequestActions.ts` | accept/decline partagés desktop+mobile ; mapping des 409 : `CARRIER_ONBOARDING_REQUIRED` → `/carrier/onboarding`, `TRANSITION_NOT_ALLOWED`/`PAYMENT_STATE_CONFLICT` → toast + relecture |
| É2 | `DealRequestDesktop/Mobile.tsx`, `DealDeclineModal/Sheet.tsx`, `DealEarningsBreakdown.tsx`, `DealShipperCard.tsx` | footer gé par `allowedActions` ; raisons alignées contrat, textarea retiré ; gains = net + note J+4 (plus de commission/total — A13) ; bouton refus slate (charte §3.4, plus de rouge) ; stats shipper optionnelles masquées |
| Annulation | `.../dashboard/shipments/` : `CancelShipmentModal.tsx` (nouveau), `ShipmentRow.tsx`, `ShipmentsClient.tsx`, `shipments.{adapter,api,types}.ts` | bouton « Annuler » si `cancel` ∈ `allowedActions` ; modale = montant SERVI (A31) + retenue expliquée ; `POST /deals/:id/cancel` puis RELECTURE de la liste ; preview QA sans appel réel |
| Payments | `packages/libs/payments/src/index.ts` | `FakePaymentProvider.adoptSeeded` — ids `pi_fake_seed_*` matérialisés AUTHORIZED ; les autres ids inconnus jettent toujours |
| Seed | `packages/libs/prisma/scripts/seed-deals.ts` | `CarrierPage` upsert par Voyageur (COMPLETE, Stripe factice) ; `paymentProvider`/`paymentIntentId` sur chaque booking |
| i18n | `messages/{fr,en}/carrierDealRequest.json`, `shipments.json` | raisons renommées, `closed.*`, `errors.*`, `cancel.*` — miroir FR/EN |
| OpenAPI | `apps/*/openapi.json` | régénérés (`npm run generate:openapi`) — CancellationPreview publié |

### 4. Deux pièges évités
- **La row de liste est un `<Link>`** : le bouton Annuler fait `preventDefault + stopPropagation` — sinon chaque clic ouvrait la page du booking.
- **`deal.state.ts` supprimé** (mock devenu mort) et les 3 fichiers vides `booking-tracker/shared/*` nettoyés — un mock qui traîne à côté d'une API réelle finit toujours importé par erreur.

### 5. Tests (+4 → plateforme 507)
`booking-view.mapper.spec.ts` 14→18 : préviz PENDING = total même tardif ; ACCEPTED ≥ 48 h = 100 % ; < 48 h = 50 % ; null dès PICKED_UP et JAMAIS dans la vue Carrier (le champ n'y existe pas).

### 6. A34 — Le premier paiement Stripe RÉEL a cassé, deux fois (addendum 01/09)
Le premier essai carte réelle (test `4242…`) après l'alignement des clés pk/sk s'est soldé par le toast GENERIC — carte **autorisée** (`requires_capture`), aucun booking, aucune trace serveur. Diagnostic e2e (script scratchpad : login seed → intent → confirm `pm_card_visa` → `POST /deals`) — DEUX bugs indépendants :
1. **Contrat plus strict que le wizard** : `recipient.email` exigé (`.email()`) alors que l'UI le dit « (optionnel) » (spec É1) et `description` min 10 alors que le wizard valide min 5. Un corps accepté par l'UI partait en 400 Zod **sans `details.code`** → toast GENERIC, PI orphelin jamais annulé. Fix : contrat `email nullish` + `description min(5)` (`booking-request.schema.ts`), snapshot Prisma `email String?` (jamais de chaîne vide figée — normalisation dans `buildBookingSnapshots`), vue `BookingRecipientSnapshotSchema.email nullable`, le front envoie `null` (`booking.api.ts`), OAS régénérés.
2. **Faux `CAPACITY_EXCEEDED`** sur les Trips créés AVANT B2-PR1 : le champ `reservedKg` est ABSENT de leurs documents Mongo, or `reservedKg: { lte: X }` ne matche pas un champ absent (pitfall CLAUDE.md). Défense runtime IMPOSSIBLE : Prisma refuse `isSet` sur un champ non-nullable (500 `PrismaClientValidationError` — testé) et `NOT:{gt}` ne matche pas non plus les champs absents (testé sur doc brut). Fix : `backfill-reserved-kg.ts` (idempotent, 27 Trips corrigés en dev) **à rejouer sur tout environnement dont des Trips prédatent B2-PR1** ; le WHERE devient le helper pur `capacityReservationWhere` (testé) qui documente le piège.
Preuve finale : e2e rejoué → `201 PENDING` avec `email: null`, kg réservés puis restitués, PI annulé. Tests 507 → **511** (deal-service 299→303 : contrat aligné ×2, snapshot email ×1, WHERE ×1).

### 7. Hors périmètre (assumé)
Le tracker Expéditeur `/bookings/[id]` reste mock (chantier B3 : il basculera sur `GET /deals/:id` avec les vues É3→É9) ; les emails transactionnels booking.* restent à écrire (notification-service ne fait que l'in-app) — prochaine PR.

---

# B2-PR4 — Emails transactionnels `booking.*` : le canal email de la matrice A15 (D41, A35, A36)

### 1. Ce qui a été fait
Le notification-service ne savait produire que des notifications in-app (rows `Notification`). Cette PR ajoute le **deuxième canal** de la matrice A15 : les emails transactionnels des 7 événements que le deal-service émet aujourd'hui (`requested`, `payment_authorized`, `accepted`, `declined`, `expired`, `cancelled`, `refund_issued`) — dont les 3 « email seul » qui n'avaient AUCUNE matérialisation jusqu'ici (reçu de paiement, remboursement… le troisième, `code_regenerated`, attend son writer B3).

### 2. La lib `@packages/email` (D41)
`packages/libs/email/src/index.ts` — le 3e clone Nodemailer+EJS est évité : auth-service et trip-service en portent déjà un chacun, et le handoff PR-A avait gravé « la lib naît au 1er email B2 ». Contrat minimal : `isEmailConfigured()` (SMTP_HOST + SMTP_USER présents) et `sendTemplatedEmail({ to, subject, templatesDir, template, data })`. Différences avec les clones : transport **paresseux** (créé au premier envoi, jamais à l'import — les tests mockent le module sans toucher au réseau), gestion 465/587 reprise de trip-service (le plus propre des deux), `templatesDir` fourni par l'appelant (chaque service garde ses gabarits). Alias déclaré dans `tsconfig.base.json` AVANT le wildcard, comme les autres libs. La migration des 2 clones existants reste au backlog ; le provider transactionnel dédié (candidat D35) se branchera derrière la même interface.

### 3. La matrice email EN DATA (A35)
`apps/notification-service/src/emails/booking-emails.ts` : `EMAIL_MATRIX` est un `Record` TOTAL sur les 17 clés (comme `IN_APP_MATRIX` — tsc casse si une clé manque). Règles : `SHIPPER`, `CARRIER`, `SHIPPER_PLUS_CARRIER_IF_WAS_ACCEPTED` (cancelled seul), ou `null` (jamais — anti-spam/in-app seul — ou « à venir » avec le writer B3/B4/B5, miroir D30). `buildBookingEmail(event, role, firstName)` construit sujet + gabarit + données par événement ; frontière A13 respectée : un email Voyageur ne montre QUE son net (`transportCents`), jamais le total Expéditeur.

### 4. L'idempotence at-most-once (A36)
Le retraitement d'un `ConsumedEvent` PENDING/FAILED re-exécute tout le handler — sans marqueur, un crash renverrait les emails. Nouveau modèle Prisma **`EmailDelivery`** (unique `[eventId, userId]`) : claim-first (create PENDING) AVANT l'envoi, P2002 = déjà claimé → jamais de renvoi ; envoi OK → SENT + sentAt ; échec d'envoi → FAILED + lastError **sans throw** (best-effort : l'email ne bloque ni la partition, ni l'in-app, ni le PROCESSED). Une erreur transitoire de CLAIM (Mongo down), elle, remonte — la re-livraison Kafka retrouvera les claims posés. `npx prisma db push` exécuté (index unique créé) ; rien à rejouer par environnement (la collection naît vide).

### 5. Le branchement et les gabarits
`handleBookingEventMessage` gagne l'étape **3bis** : `dispatchBookingEmails(eventId, event, logger)` après la matérialisation in-app, avant le PROCESSED. Le dispatcher fait la jointure `User` (les événements ne portent ni email ni prénom — user effacé RGPD = envoi sauté, tracé `warn`), locale FR par défaut (pas de `preferredLocale` sur User, même repli que trip-notifications). 8 gabarits EJS sous `src/emails/templates/booking/` (cancelled a une variante par rôle), charte respectée : teal = argent (reçu, remboursement, accepté), mango = CTA avancer, slate = refus/expiration/annulation ; texte FR/EN inline par gabarit ; **le code de livraison n'apparaît nulle part** (re-vérifié sur les 17 payloads ET testé sur le HTML rendu).

### 6. Les preuves (D30)
Trois specs, 21 → **50 tests** (plateforme 511 → **540**) :
- `booking-events.consumer.spec.ts` (+4 assertions/test) : le dispatch est appelé APRÈS la matérialisation avec l'eventId du claim, jamais sur un doublon PROCESSED ni sur un parse FAILED ;
- `booking-emails.spec.ts` (18) : matrice totale, routage (dont cancelled ±wasAccepted), frontière A13 (le JSON construit d'un email carrier ne contient pas le total shipper), claim-first, P2002 = silence, ghost user, échec d'envoi = FAILED sans throw, transitoire = throw ;
- `booking-templates.spec.ts` (10) : **rendu EJS RÉEL** des 8 gabarits dans les 2 locales — un gabarit cassé ne doit pas attendre la prod pour exploser (les autres specs mockent l'envoi). Piège rencontré : `<%= %>` échappe le HTML, une assertion sur « n'était » doit viser la sous-chaîne sans apostrophe (`&#39;`).

### 7. Hors périmètre (assumé)
MailHog en docker-compose (candidat, avec D35) ; retry automatique des FAILED (rejeu manuel possible depuis la collection) ; `preferredLocale` utilisateur ; migration des clones email auth/trip ; les 8 gabarits B3/B4/B5 (chacun arrive avec le writer de son événement).

---

# B2-PR5 — Tracker Expéditeur : `/bookings/[id]` sur le réel (A37)

### 1. Ce qui a été fait
La page de suivi Expéditeur (48 fichiers, vues É3/É4b/É6/É8/É9 dessinées depuis des mois) tournait à 100 % sur des mocks : `getBooking()` choisissait un scénario selon l'URL (« annexe A » de la spec). Elle lit maintenant `GET /deals/:id` (vue Shipper — A13) via TanStack Query. Les mocks de données (`booking-tracker.state.ts`) sont SUPPRIMÉS.

### 2. L'adapter conservatif (`booking-tracker.adapter.ts`)
Patron du chapitre 28, avec une contrainte de plus : produire le **view-model EXISTANT** pour que les ~40 fichiers de vues ne bougent pas. Tout le vocabulaire s'absorbe à la frontière : statuts (`PENDING→AWAITING_CARRIER`, `COMPLETED→VERIFIED` ; `IN_TRANSIT` n'est PAS un statut serveur — le client dérive É6 de `PICKED_UP` + trackingEvents), cents→euros d'affichage, `TRAIN_STATION→STATION`, `codeRegenerationsLeft` (serveur) → `regeneratedCount` (front). Prouvé par un script `tsx` jetable (25 assertions : mapping des 9 statuts, dégradations, dérivés).

### 3. Les dégradations honnêtes (champs non servis)
Quatre familles de champs du view-model n'existent pas encore côté API — devenus **optionnels documentés** (jamais de valeur inventée) : stats Voyageur (rating/dealCount/isVerified — B5 : la ligne « ⭐ x.x · N deals » disparaît, on n'affiche pas un faux 0), métadonnées carte (cardBrand/cardLast4/statementDescriptor — Stripe, backlog : lignes Mode/Libellé relevé masquées dans `BookingPaymentBlock` et `DeliveredPaymentCard`), code de livraison (`deliveryCode.code` — AES B3 : `status` passe bien à AVAILABLE au pickup mais le code attend `deliveryCodeEncrypted`), ETA (durée de vol absente du snapshot — les vues la géraient déjà en optionnel).

### 4. La fin du fallback menteur
L'ancien client affichait la vue « accepté » pour tout statut inconnu — un deal REFUSÉ montrait « Ton Voyageur a accepté ». Nouvelle vue `BookingStatusNotice` (une seule colonne responsive, pas de double arbre pour un écran d'information) : AWAITING_CARRIER (paiement autorisé + deadline 24 h), DECLINED/EXPIRED (« tu n'es pas débité·e »), CANCELLED, VERIFIED (envoi terminé), DISPUTED (ticket YAM-XXXX + gel). CTA retour vers `/dashboard/shipments` (l'annulation Expéditrice vit LÀ — A31). Clés i18n `bookingTracker.statusNotice.*` FR/EN.

### 5. TanStack Query et les actions encore mock
`useQuery({ queryKey: ["booking", id], staleTime: 30 s, retry: 1 })` — même patron que `DealClient`. Les actions `regenerateDeliveryCode` / `confirmDeliveryEarly` / `submitDispute` restent des mocks MARQUÉS (B3/B4) : leurs handlers écrivent le cache local (`setQueryData`) et deviendront des `invalidateQueries` quand les endpoints réels existeront — le commentaire du client le dit explicitement. `BookingApiError` (NOT_FOUND avec 403 confondu, UNAUTHENTICATED, GENERIC) ; le client É9 (report) attrape désormais l'échec du fetch réel et revient au tracker.

### 6. Les preuves
tsc user-ui OK · build de production OK · script adapter 25 assertions OK · i18n FR/EN miroir. Pas de tests Jest côté user-ui (pas d'infra — même statut que l'adapter carrier de B2-PR3) : la plateforme reste à **540**.

### 7. Hors périmètre (assumé)
Le bouton Annuler sur le tracker (Mes envois le porte — A31) ; le rendu du code à 6 chiffres (AES B3) ; photos réelles (media-service B3) ; polling/temps réel (hors périmètre v1 de la spec).

---

# B3-PR1 — Transport côté serveur : pickup, refus, jalons, régénération, livraison (D42, D43, A38–A42)

### 1. Ce qui a été fait
Le deal-service gagne les cinq écritures du transport, toutes adossées à la machine d'états qui les déclarait déjà depuis B1 : `POST /deals/:id/pickup` (ACCEPTED → PICKED_UP, le code de livraison naît), `POST /deals/:id/pickup/refuse` (ACCEPTED → CANCELLED, remboursement intégral), `POST /deals/:id/events` (jalons optionnels dans PICKED_UP, sans transition), `POST /deals/:id/code/regenerate` (Expéditeur, ≤ 5) et `POST /deals/:id/deliver` (PICKED_UP → DELIVERED par comparaison bcrypt, 3 essais / verrou 15 min). La vue Shipper de `GET /deals/:id` révèle enfin le code (D43). Les 4 emails B3 de la matrice A35 arrivent avec leurs writers. Le front reste sur ses mocks jusqu'à B3-PR2.

### 2. Les contrats (`packages/libs/api-contracts/src/booking/booking-transport.schema.ts`)
`ConfirmPickupRequest` : `checklist` doit contenir LES 5 items (`PICKUP_CHECKLIST_ITEMS`, refine — un 4/5 est un 400, CNF-04), `photoUrls` 1..5 URLs (D42 : déjà téléversées vers ImageKit par le navigateur, le serveur ne voit jamais un octet d'image), `notes` ≤ 500. `RefusePickupRequest` : raison optionnelle parmi 5 (`PickupRefusalReason`, A40). `ConfirmTrackingStepRequest` : `step` parmi les 3. `DeliverDealRequest` : `code` = 6 chiffres (`DeliveryCode`). Réponses : `DealTransitionResponse` (pickup, refus), `TrackingStepResponse` (séquence complète), `RegenerateCodeResponse` (LE nouveau code — seule surface d'écriture qui le porte), `DeliverDealResponse` (`deliveredAt`, `payoutDueAt`). Les codes 409 rejoignent `BOOKING_LIFECYCLE_ERROR_CODES` (source unique) : `DELIVERY_CODE_INVALID`, `DELIVERY_LOCKED`, `DELIVERY_CODE_UNAVAILABLE`, `TRACKING_STEP_NOT_ALLOWED`, `CODE_REGENERATION_LIMIT`. Vues : `BookingPickupInfo.checklist` (figée) et `pickupRefusalReason` dans les jalons.

### 3. Le schéma (`prisma/schema.prisma`)
`Booking.deliveryCodeEncrypted String?` (AES, D43), `Booking.pickupRefusalReason String?` (A40), `BookingPickupInfo.checklist String[] @default([])`. Annexe A42 : `CarrierPage.primaryAddressId` perd son `@unique` (index simple, relation côté `Address` en liste) — `npx prisma db push` exécuté, l'index unique a été remplacé par `CarrierPage_primaryAddressId_idx`. À rejouer sur tout environnement.

### 4. `@packages/delivery-code` (D43) — `packages/libs/delivery-code/src/index.ts`
Zéro dépendance d'infrastructure (node:crypto + bcryptjs) : `generateDeliveryCode` (`randomInt(100000, 1000000)`), `hashDeliveryCode`/`verifyDeliveryCode` (bcrypt coût 10), `encryptDeliveryCode`/`decryptDeliveryCode` (AES-256-GCM, format `v1.<iv>.<tag>.<chiffré>` base64url — versionné pour la rotation ; déchiffrement défensif : tout défaut → `null`, jamais un throw ni un faux clair), `resolveDeliveryCodeKey` (32 octets base64 depuis `DELIVERY_CODE_ENCRYPTION_KEY` ; absente hors production → clé de dev dérivée + un avertissement ; absente en production → erreur), `issueDeliveryCode` (les deux formes d'un coup) et `revealDeliveryCode` (PICKED_UP + chiffré présent, sinon `null`). Alias déclaré dans `tsconfig.base.json` **et** dans `apps/deal-service/webpack.config.js` (piège : tsc résout le premier, `nx serve` ne lit que le second — le service a démarré avec « Module not found » avant l'ajout). Le seed l'importe en relatif.

### 5. Le socle d'écriture extrait (`booking-write.ts`)
`loadBookingForWrite` et `applyBookingTransition` sortent de `deal-lifecycle.service.ts` au moment où un deuxième service en a besoin (chap. 34 : jamais par clonage). `applyBookingTransition` gagne un `where` optionnel : chaque writer ajoute sa garde optimiste à la condition de statut — `trackingEvents.none({ step })` pour un jalon, `codeRegenerations: n` pour une régénération, `deliveryAttempts: n` pour une livraison. Le `select` s'élargit (pickup, jalons, hash, compteurs) ; `toBookingForWrite` normalise (les mocks de tests n'ont pas tous les champs). Les 303 tests B2 passent inchangés après l'extraction.

### 6. Le service (`deal-transport.service.ts`)
Même rituel que le cycle de vie : charger → partie (403) → machine (409 avec SA raison) → argent d'abord s'il bouge → UNE transaction. `confirmPickup` : `issueDeliveryCode()` puis transaction `{ status, pickedUpAt, pickup{confirmedAt, photoUrls, notes, checklist}, deliveryCodeHash, deliveryCodeEncrypted, compteurs à 0 }` + outbox `booking.picked_up` (`photoCount` — jamais le code). `refusePickup` : le paiement est CAPTURÉ (D39) → `provider.refund(intent, total)` AVANT la base (A40), puis `CANCELLED/closedBy CARRIER/pickupRefusalReason/refundAmountCents`, kg restitués, `pickup_refused` + `refund_issued`. `confirmTrackingStep` : `canConfirmTrackingStep` (séquence stricte) → push conditionnel → `tracking_event` ; pas d'undo serveur (A39). `regenerateCode` : Expéditeur seul, `canRegenerateCode` → nouveau code, compteur +1 par garde optimiste, essais et verrou remis à zéro, `code_regenerated` (compteurs seuls) ; le code n'est retourné qu'à l'appelant. `deliver` : guard machine (verrou puis plafond) AVANT toute comparaison ; sans hash → `DELIVERY_CODE_UNAVAILABLE` ; bcrypt faux → `updateMany` conditionnel sur le compteur lu (+1, ou verrou 15 min ET remise à 0 au 3e — A38), 409 `DELIVERY_CODE_INVALID`/`DELIVERY_LOCKED`, aucun événement (pas un changement d'état métier) ; bcrypt vrai → `DELIVERED`, `payoutDueAt = now + PAYOUT_DELAY_DAYS (4)`, `booking.delivered` (`attemptsUsed`).

### 7. Lecture : le code révélé à l'Expéditeur seul
`toShipperBookingView(booking, carrier, now, deliveryCode)` reçoit le clair en PARAMÈTRE : le mapper reste pur et ne lit jamais `deliveryCodeEncrypted`. `getDeal` appelle `revealDeliveryCode(booking)` pour le rôle SHIPPER seulement ; `getMyBookings` passe `null` (jamais en liste). Le test « leaky booking » du mapper injecte désormais aussi un chiffré : aucune vue ne le laisse passer, la vue Carrier n'a toujours ni code, ni hash, ni compteur.

### 8. Les emails (A41) — `apps/notification-service/src/emails/`
`EMAIL_MATRIX` : `picked_up`, `pickup_refused`, `code_regenerated`, `delivered` → SHIPPER (le Voyageur livré reste in-app : son email « versement » arrive avec `payout_sent`, B4). 4 gabarits EJS FR/EN (`booking-picked-up-shipper`, `pickup-refused-shipper` avec bloc raison conditionnel, `code-regenerated-shipper`, `booking-delivered-shipper` avec date J+4 et net du Voyageur). Garde-fou renforcé dans `booking-templates.spec.ts` : aucun gabarit rendu ne contient une suite de 6 chiffres (regex avec lookbehind `#` pour épargner les couleurs CSS `#334155` — le premier jet cassait les 8 gabarits existants sur leurs couleurs) ; méta-test : un prénom « 742891 » injecté est bien attrapé.

### 9. Le seed (`seed-deals.ts`)
Tout booking passé par le pickup porte un VRAI code `SEED_DELIVERY_CODE = "742891"` (haché + chiffré) et une checklist 5/5. Le Voyageur du seed peut livrer, l'Expéditrice voit son code. Exécution : `npx tsx --env-file=.env packages/libs/prisma/scripts/seed-deals.ts` (sourcer `.env` en zsh corrompt le mot de passe Mongo).

### 10. Les preuves (D30)
Tests : deal-service 303 → **354** (`delivery-code.spec` 14, `booking-transport.contract.spec` 9, `deal-transport.service.spec` 25, mapper +3), notification-service 50 → **59** (matrice, builders, rendu des 4 gabarits, méta-test) — plateforme **540 → 600** ; tsc ×6 ; OAS régénérés (5 opérations, `response409Transport`). **E2E sur Atlas** (script scratchpad, deal-service bundle lancé en FAKE avec `node --env-file` — `nx serve` écrase les variables passées en ligne de commande, voir CLAUDE.md) : 33 vérifications vertes — 4/5 → 400, Expéditrice → 403, pickup → PICKED_UP, code 6 chiffres côté Shipper et ABSENT côté Carrier et en liste, jalons (doublon/saut → 409), régénération (Voyageur → 403 ; nouveau code affiché), ancien code → INVALID attemptsLeft 2 → 1 → LOCKED lockedUntil, bon code sous verrou → refusé par le guard, régénération lève le verrou, livraison → DELIVERED payoutDueAt = J+4 exactement, code masqué après livraison, régénération après livraison → 409, accept puis refus au pickup → CANCELLED 2 800 c remboursés, `reservedKg` 8 → 5, seed `742891` livrable. Probe outbox : `picked_up, tracking_event ×2, code_regenerated ×2, delivered` / `accepted, pickup_refused, refund_issued`, **zéro suite de 6 chiffres dans les payloads**. Seed rejoué ensuite (état QA propre).

### 11. Hors périmètre (assumé)
Le front (B3-PR2 : bascule des 4 mocks Voyageur avec upload ImageKit, régénération Expéditeur réelle, code affiché) ; URLs signées / fichiers privés ImageKit (dette D42) ; vérification serveur que l'URL photo appartient à notre compte ImageKit ; `confirmEarly`/`dispute`/cron J+4 (B4) ; rotation de clé AES (format versionné, procédure à écrire).

---

# B3-PR2 — Transport côté front : les quatre mocks Voyageur et la régénération Expéditeur sur le réel (A43)

### 1. Ce qui a été fait
Les écrans É4a (prise en charge), É5 (tracking), É7 (saisie du code) du Voyageur et la carte « code » de l'Expéditrice (É4b/É6) appellent maintenant les endpoints de B3-PR1 (#95). Plus aucun `sleep(MOCK_DELAY_MS)`, plus de code aléatoire local, plus de compteur d'essais client. Les ~30 fichiers de vues ne bougent pas : seuls les orchestrateurs (`*Client.tsx`), la couche API, les types et l'adapter changent — même stratégie conservative que B2-PR3/PR5.

### 2. `deal.api.ts` (Voyageur)
`confirmPickup(dealId, { checklist, photoUrls, notes })` → `POST /deals/:id/pickup` ; `refusePickup(dealId, { reason })` → `POST …/pickup/refuse` ; `confirmTrackingEvent(dealId, step)` → `POST …/events` ; `validateDeliveryCode(dealId, code)` → `POST …/deliver`. `DealApiError` porte désormais `details` (les `attemptsLeft`/`lockedUntil` des 409) et connaît les 5 codes transport. `MAX_DELIVERY_ATTEMPTS`/`DELIVERY_LOCK_MINUTES` restent exportés comme MIROIRS d'affichage des constantes serveur.

### 3. Prise en charge : les photos partent d'abord (`DealPickupClient.tsx`)
Le formulaire garde ses `PickupPhotoDraft` (fichier + preview locale). À la confirmation : `useImageKitUpload("/deals/pickup")` téléverse chaque fichier — séquentiellement, le premier échec arrête tout avec `errors.uploadFailed` et RIEN n'est envoyé au deal-service (D42/A43) — puis `confirmPickup` reçoit les URLs. Succès → `invalidateQueries(["deal", id])` + retour sur `/carrier/deals/[dealId]` : `DealClient` relit PICKED_UP et bascule sur la vue tracking. 409 `TRANSITION_NOT_ALLOWED` (deal annulé entre-temps, ou déjà pris en charge) → `errors.dealChanged` + relecture. Le refus n'envoie plus que la raison : le textarea « détails » du `PickupRefuseDialog` est supprimé (le contrat ne le portait pas — miroir A32), clés i18n retirées dans les 2 locales.

### 4. Tracking : l'appel part à la FIN de la fenêtre (`TrackingSpotlight.tsx`, `DealTrackingClient.tsx`)
Avant : le parent appelait l'API DANS le toggle (donc immédiatement, l'undo ne rattrapait rien). Maintenant : le toggle ne touche que l'état optimiste ; `TrackingSpotlight` reçoit `onEventCommittedAction`, appelée par le timer des 5 s (l'undo annule le timer → aucun appel). `DealTrackingClient.handleEventCommitted` fait le `POST /deals/:id/events` ; succès → invalidation ; échec (séquence, doublon, deal changé, réseau) → rollback de l'événement + `spotlight.errorToast` + relecture. Desktop et Mobile ne font que passer la prop.

### 5. Saisie du code : le serveur compte (`DealDeliverClient.tsx`)
`attemptsUsed` et `lockedUntil` s'initialisent depuis la vue Carrier (`deliveryAttemptsLeft`, `deliveryLockedUntil` — nouveaux dans `deal.adapter.ts`/`deal.types.ts`) au chargement, puis suivent les `details` des 409 : `DELIVERY_CODE_INVALID.attemptsLeft` → compteur, `DELIVERY_LOCKED.lockedUntil` → verrou + countdown local (à l'expiration, le serveur a déjà remis le compteur à zéro — A38), `DELIVERY_CODE_UNAVAILABLE` → `error.codeUnavailable` (enregistrement antérieur à B3), `TRANSITION_NOT_ALLOWED` (verrou actif côté serveur, deal changé) → `error.dealChanged` + relecture de la vue. Succès → écran É7b + invalidation du cache deal (la page Deal relira DELIVERED).

### 6. Régénération Expéditrice (`booking-tracker.api.ts`, `BookingTrackerClient.tsx`)
`regenerateDeliveryCode(bookingId)` → `POST /deals/:id/code/regenerate` (la réponse porte `deliveryCode` + `codeRegenerationsLeft`, traduits en `newCode`/`regeneratedCount` pour la signature des cards). Le handler du client ne fait plus `setQueryData` : il INVALIDE — le code affiché vient toujours de `GET /deals/:id` (D43), jamais du cache local. `BookingApiError` connaît `CODE_REGENERATION_LIMIT` et `TRANSITION_NOT_ALLOWED`. Adapter : `deliveryCode.status` passe à `VALIDATED` après `deliveredAt`.

### 7. Les preuves
tsc user-ui OK · build de production OK · i18n FR/EN miroir parfait (script CI joué en local) · pas de Jest user-ui (même statut que B2-PR3/PR5). Parcours manuel sur seed : Voyageur `thomas.carrier@seed.yamba.dev`, deal `bzv-accepted` → prise en charge avec 1 photo → code visible côté `pauline.shipper@…` → jalons → saisie (mauvais code ×3 → verrou 15 min affiché) → régénération côté Expéditrice → bon code → livraison ; deal seed `bzv-picked` livrable avec `742891`.

### 8. Hors périmètre (assumé)
Vue DELIVERED persistante côté Voyageur (`DealClosed` « Livraison validée » — spec §11 hors v1) ; `confirmDeliveryEarly`/`submitDispute` restent des mocks marqués (B4) ; barre de progression des uploads (le hook l'expose, non affichée) ; compression HEIC côté client.

---

# B3-PR3 — La boîte du Voyageur : demandes dans « Mes trajets », notifications cliquables (A44)

### 1. Ce qui a été fait
Constat de recette (02/09, deux vrais comptes) : le Voyageur n'avait aucun chemin vers `/carrier/deals/:id`. La liste réelle « Mes trajets » ignorait les deals, la seule vitrine à deals était le mock `/dashboard/trips/preview`, la boîte de notifications n'était pas cliquable, et `pendingDemandsCount` (attendu par trois composants) n'était servi par personne. Cette PR ferme le chemin : un endpoint de lecture, une bande « À traiter », les deals sous chaque trajet, des notifications qui mènent au deal, un badge sur mobile.

### 2. Serveur : `GET /me/deals` (deal-service)
`getMyDeals` dans `deal.controller.ts`, miroir exact de `getMyBookings` : `carrierId = moi`, `isDeleted: false`, `?status` optionnel (même `MyBookingsQuerySchema`), tri `requestedAt desc`, jointure des Expéditeurs par `loadCounterparts`, vue **Carrier** stricte (A13). Contrat `MyDealsResponseSchema` (`deals`, `count`), OAS `/me/deals`, proxy gateway `/api/me/deals` (déclaré AVANT le catch-all auth, comme `/api/me/bookings`). Une seule lecture alimente la liste, l'accueil, la sidebar et la barre mobile — jamais un appel par trajet.

### 3. Le hook et l'adapter (`useMyDeals`, `my-deals.adapter.ts`)
`useMyDeals()` : TanStack Query, clé `["my-deals"]`, `staleTime` 30 s, désactivable (`enabled`) pour un compte sans rôle Voyageur. `my-deals.adapter.ts` traduit `CarrierBookingViewDto` vers le view-model du mock (`CarrierDealItem`) et `TripListItem` vers `CarrierTripItem` (le strict nécessaire pour `deriveCarrierActions`). Dégradations documentées : `hasRated: true` (B5 : jamais d'action « Noter » inventée), pas de `pickupMeetingAt` (aucun RDV dans le snapshot), destinataire révélé après pickup seulement. Les transitions du module carrier/deal (accept, decline, pickup, deliver) invalident `["my-deals"]` en plus de `["deal", id]`.

### 4. « Mes trajets » (`MyTripsList.tsx`)
- **Bande « À traiter »** en tête (trans-trajets) : `deriveCarrierActions` du mock sur données réelles, rendue par `TripActionRow` (répondre avec « expire dans 3 h », prise en charge, livraison après atterrissage). Tick 60 s pour les échéances.
- **Sous-titre** : « N actions à traiter · N trajets à venir » (`list.subtitle`, ICU plural FR/EN).
- **Deals sous chaque trajet** : `TripDealRow` (extrait de `TripCard.tsx` dans `TripDealRow.tsx` — le mock l'importe désormais, une seule ligne pour la vitrine et le réel), replié/déplié par un bouton « N colis » (ouvert par défaut quand un deal est vivant, replié sur l'historique). Le badge « +N demandes » est dérivé des deals réels ; le champ `pendingDemandsCount` disparaît du type.
- Mobile : badge + « N colis » passent sous le titre (`sm:hidden`), cibles ≥ 32 px, la liste des deals reste pleine largeur ; desktop : contrôles en ligne, liste décalée sous l'icône du trajet.

### 5. Accueil, sidebar, barre mobile, page trajet, notifications
- `HomeClient` (live) : la bande « À traiter » affiche d'abord les actions de deals (`TripActionRow`) puis brouillons/pauses ; l'ancien type `DEMANDS` (compteur jamais servi) disparaît.
- `useTripsBadge()` : hook partagé (demandes en attente + brouillons/pauses) pour `DashboardSidebar` ET `DashboardMobileNav` — pastille mango sur l'onglet Activité (« 9+ » au-delà).
- `TripDealsSection` sur `/dashboard/trips/[id]` (trajet publié ou terminé) : mêmes lignes, filtrées par `tripId`, en tête de colonne.
- `Notifications.tsx` : chaque ligne devient un `Link` (`/carrier/deals/:id` si `payload.carrierId === user.id`, sinon `/bookings/:id`) ; le clic marque lu ET navigue ; chevron à droite comme affordance ; sans `bookingId` la ligne reste un bouton.

### 6. Les preuves
tsc user-ui + deal-service + gateway · build de production user-ui · i18n miroir · OAS régénéré · `GET /me/deals` vérifié sur Atlas avec le Voyageur du seed (bundle deal-service en FAKE). Pas de Jest user-ui.

### 7. Hors périmètre (assumé)
Badge « Mes envois » côté Expéditeur (envois à suivre) ; « tout marquer lu » ; temps réel sur la boîte ; l'action « Noter » (B5) ; l'heure de RDV de pickup (absente du modèle).

---

# B3-PR4 — La page « demande » du Voyageur passe la recette réelle (A45)

### 1. Ce qui a été fait
Recette à deux vrais comptes, étape 4 : la page `/carrier/deals/[id]` n'affichait ni les photos du colis ni, sur un écran de 900 px, les boutons Accepter/Refuser. Quatre corrections, toutes côté vérité produit : les photos déclarées sont enfin envoyées, la colonne d'action existe dès 768 px, les libellés respectent GAR-02 et RGP-02, « Voir profil » mène au profil public.

### 2. Les photos déclarées (wizard → ImageKit → `parcel.photoUrls`)
Depuis B2-PR1, `createDeal` envoyait `photoUrls: []` « en attendant un media-service » — les photos du wizard (`ParcelPhoto.file`) restaient dans le navigateur. `useBookingCheckout.submit` téléverse maintenant chaque fichier via `useImageKitUpload("/bookings/declared")` **avant** la confirmation carte : un upload qui échoue arrête la soumission avec `step4.errors.UPLOAD_FAILED` (« ta carte n'a pas été débitée ») — aucune empreinte orpheline, leçon A34. Les URLs passent à `createDeal(draft, trip, paymentIntentId, photoUrls)` (contrat inchangé : `photoUrls` max 5). Côté Voyageur, `DealParcelPhotos` était déjà câblé sur `parcel.photoUrls` : il affiche désormais quelque chose.

### 3. La colonne d'action dès `md` (`DealRequestDesktop.tsx`)
`DealClient` bascule sur la vue mobile sous 768 px (`useIsMobile`), mais la grille desktop passait en deux colonnes à `lg` (1024 px) et l'`aside` était `hidden lg:block` : entre 768 et 1023 px, ni gains, ni couverture, ni CTA. Grille `md:grid-cols-[minmax(0,1fr)_300px] lg:…_340px]`, `aside hidden md:block`, sticky conservé.

### 4. Les mots (GAR-02, RGP-02)
« Assurance basique » → « Garantie Yamba incluse », « Assurance 500 € » → « Protection étendue 500 € », notes Expéditeur alignées (carrierDealRequest FR/EN) ; même chasse dans le tracker Expéditeur (`insuranceLabel`, `coverageTitle`), le wizard (`requiredBadge`) et la home. « Téléphone communiqué après acceptation » → « … à la prise en charge » (RGP-02 : le destinataire est révélé après PICKED_UP, ce que l'adapter faisait déjà).

### 5. « Voir profil » (`publicSlug`)
`BookingCounterpart.publicSlug` (contrat, nullable) : `loadCounterparts` le sélectionne, `toCounterpart` le propage, le contrat OAS est régénéré. Front : `DealShipper.publicSlug`, les deux vues (desktop, mobile) ouvrent `/[locale]/u/[slug]` dans un nouvel onglet ; sans slug, le bouton n'est pas rendu (jamais un lien mort). Test mapper : slug traverse, null sinon (355 tests deal-service).

### 6. Les preuves
tsc (user-ui, deal-service) · build de production · i18n miroir · deal-service 355 tests · OAS régénéré. Parcours manuel : refaire une réservation avec 2 photos (elles apparaissent dans « Photos du colis » côté Voyageur), redimensionner la fenêtre à 900 px (les boutons restent visibles à droite).

### 7. Hors périmètre (assumé)
Stats de confiance du Voyageur/Expéditeur (B5) ; galerie plein écran des photos ; compression HEIC ; la vitrine `/dashboard/trips/preview` (mock).

---

# B3-PR5 (chore) — Échelle typographique des pages Deal et grilles dès `md` (A46)

Recette utilisateur : « Mon Deal accepté » et « Et maintenant ? » trop grands, même remarque sur la page de prise en charge. Cause : les cinq vues desktop du module `carrier/deal` (`DealRequestDesktop`, `DealAcceptedHeader`/`Desktop`, `DealPickupDesktop`, `DealTrackingDesktop`, `DealDeliverDesktop`) portaient un H1 `text-2xl font-black sm:text-3xl` suivi d'un H2 `text-xl font-black sm:text-2xl`, et les vues mobiles un H2 `19px black`. Remplacement mécanique (script, 5 + 3 + 3 + 1 occurrences) par l'échelle du dashboard : H1 `text-[22px] font-semibold sm:text-2xl`, H2 `text-[17px] font-semibold sm:text-lg`, succès `22/26px bold`. Les montants (`DealEarningsHero`, `DealPaymentBlock`, sidebars) gardent `font-black` : c'est l'information qu'on veut voir. Dans la même passe, les quatre grilles restées en `lg:grid-cols` + `aside hidden lg:block` (accepté, pickup, tracking, deliver) et `DealSkeleton` passent en `md:` (300 px) puis `lg:` (320/340 px) — le correctif A45 s'applique à tout le module. Preuves : tsc, build de production.

---

# Fix ImageKit (annexe B3, A47) — le SDK fossile qui rendait tout upload impossible

Recette F1 : « Le téléversement d'une photo a échoué ». Diagnostic par les faits : `GET /api/uploads/imagekit-auth` → **500** ; reproduction hors serveur (`tsx` + `lib/imagekit.ts`) → « ImageKit Id, API Key and API secret are necessary » : le paquet `imagekit@1.5.0` installé est le SDK de 2016 (dépôt gitlab `imagekit-sdks`), pas le SDK Node moderne que le code appelle. La déclaration maison `apps/trip-service/src/types/imagekit.d.ts` décrivait l'API moderne et masquait l'écart à tsc. Aucun upload (justificatifs de trajet, photos déclarées, photos de pickup) n'a donc jamais pu aboutir sur cet environnement.

Fix : `imagekit@6.0.0` exact dans les deux `package.json` (racine, `apps/trip-service`), d.ts maison supprimée (le SDK livre ses types), `npm install` après alignement des deux fichiers — sinon une copie imbriquée `apps/trip-service/node_modules/imagekit` (ancienne version) masque la racine (`npm ls imagekit` doit dire « deduped »). Preuve : script `getAuthenticationParameters()` → token/signature/expire. trip-service 187 tests, tsc OK. **Le trip-service doit être relancé** (l'ancienne copie était chargée en mémoire).

Dans la même PR, le hook `useImageKitUpload` gagne des options (`maxSizeBytes`, `allowedMimeTypes`) et `uploadDetailed()` qui rend le CODE d'erreur à l'appelant (`INVALID_TYPE` / `TOO_LARGE` / `AUTH_FAILED` / `UPLOAD_FAILED`) : le pickup et le wizard affichent « une photo dépasse 10 Mo » ou « format non pris en charge » au lieu du message générique ; photos de colis à 10 Mo (spec §3.4), WebP accepté. Les justificatifs de trajet gardent 5 Mo + PDF.

---

# B3-PR6 — Visionneuse de photos partagée : les preuves se regardent (A48)

### 1. Ce qui a été fait
Recette F1 réussie (deux photos figées), mais la page de suivi du Voyageur montrait deux carrés amber à pictogramme — des restes de l'époque mock, présents dans dix composants des deux côtés. `PhotoThumbs` + `PhotoLightbox` (`components/shared/photos/`) les remplacent partout : vignettes réelles cliquables, visionneuse plein écran.

### 2. `PhotoThumbs`
`photos: { id, url, label?, context? }[]`, `tone` (`violet` déclarées · `amber` pickup · `red` litige — liseré `ring-2`, spec §3.4), `size` (`sm` 40 px · `md` 48/56 px · `lg` 64 px), `max` (les suivantes deviennent une case « +N » qui ouvre la visionneuse à la première cachée). Image `object-cover`, `loading="lazy"` ; `onError` → dégradé de la couleur + pictogramme (Package si le contexte finit par `PACKAGED`), jamais une case vide. Cibles ≥ 40 px.

### 3. `PhotoLightbox`
Extraite de `DealParcelPhotos` (qui l'utilise désormais ; son `Lightbox` privé et ses handlers clavier disparaissent). Contrat : `photos`, `index`, `onCloseAction`, `onIndexChangeAction`. Échap / ← → au clavier, balayage horizontal (> 40 px) au tactile, boutons 44 px, compteur « 2 / 3 », fermeture au clic hors image, `body.overflow` verrouillé pendant l'ouverture, `z-[60]` au-dessus des bottom-bars mobiles. Libellés `common.lightbox.{close,previous,next,counter}` FR/EN.

### 4. Les dix remplacements (script, un bloc = une ligne)
Voyageur : `TrackingTimeline` (sm), `TrackingSidebarCards` (md), `DealAcceptedRecap` (md, max 3), `PickupDeclaredCard` (lg), `DealDeliverDesktop` (md). Expéditrice : `BookingAcceptedRecap` (md, max 3), `SenderTrackingSideCards` (md), `SenderTrackingTimeline` (sm), `DeliveryRecapCard` (md), `BookingPickupPhotos` (lg), `BookingReportDesktop` (sm ×2, `PhotoMini` supprimé). Imports lucide élagués automatiquement (tsc `noUnusedLocals`).

### 5. Preuves
tsc user-ui, i18n miroir, aucun dégradé orphelin (`grep BA7517|534AB7` ne remonte plus que la visionneuse et les grilles d'upload).

---

# Fix relay outbox (annexe B3, A49) — le relay ne voyait aucun événement réel

Recette : aucun email ni notification à aucune étape, pour aucun des deux comptes. Probe Atlas : 44 événements outbox, 38 sans `publishedAt` avec `attempts: 0` (jamais tentés), Redpanda up, consumer group stable, lag 0. Cause : `OutboxRelay.drainBatch` filtre `publishedAt: null` ; `applyBookingTransition` et `createBooking` n'écrivaient pas le champ ; sur Mongo, Prisma ne matche pas un champ absent avec `null` (compté : `publishedAt: null` → 0, `OR isSet:false` → 38). Les preuves B1/B2 tenaient sur `seed-outbox.ts`, qui pose `null` explicitement. Fix : filtre `OR` dans le relay (spec mise à jour) + `publishedAt: null` explicite dans les deux writers ; 38 lignes orphelines (bookings effacés par les rejeux du seed) parquées par script (`publishedAt` posé, `lastError` PARKED) ; les 4 événements du deal réel partent au redémarrage du deal-service. Deuxième cause, indépendante : le `.env` racine n'a aucune variable `SMTP_*` (elles ne vivent que dans `apps/trip-service/.env`) — à copier (`SMTP_HOST/PORT/USER/PASS/SERVICE/FROM`) puis relancer notification-service. deal-service 355 tests.

# Fix recette auth (#116, 03/09, A50–A54) — le formulaire dit quoi corriger, l'OTP pardonne la faute de frappe

Retours de recette du 03/09 sur l'inscription, la connexion et les codes OTP. Sept corrections dans une PR, `fix/auth-recette`, toutes sans décision d'architecture nouvelle (D44 et D45 sont gravées dans la même PR mais implémentées dans les suivantes).

### Ce qui a été fait

1. **Deux modules purs extraits de `auth.helper.ts`** (qui importe Redis au chargement, donc intestable sans infra) :
   - `apps/auth-service/src/utils/otp-policy.ts` — `getOtpFailurePolicy(n)` renvoie `{ lockSeconds, invalidateOtp, securityAlert, attemptsLeft }` pour le n-ième échec cumulé. Paliers de 5 : 5e → 60 s, 10e → 1 800 s + alerte, 15e et suivants → 86 400 s ; à chaque palier le code courant est supprimé de Redis (`DEL otp:<scope>:<email>`). `formatLockDuration` a déménagé ici.
   - `apps/auth-service/src/utils/password-rules.ts` — `findPasswordRuleViolation(password, ctx)` renvoie le PREMIER code violé (`PASSWORD_TOO_SHORT` … `PASSWORD_CONTAINS_PERSONAL_INFO`) ; `validatePasswordStrength` lève une `ValidationError` avec `details: { type: "password", code, field: "password" }`. `auth.helper.ts` ré-exporte pour que les contrôleurs ne changent pas d'import.
   - 19 tests Jest (`otp-policy.spec.ts`, `password-rules.spec.ts`) : un par palier, un par règle, la propriété « jamais 24 h avant le 15e échec ».
2. **`verifyOtpScoped`** applique la politique : compteur cumulé 24 h inchangé, puis `policy.invalidateOtp` → `DEL`, `policy.lockSeconds` → `SET otp_lock EX`, `policy.securityAlert` → email « activité suspecte ». Les `details` portent désormais un `code` (`OTP_INCORRECT`, `OTP_INVALIDATED`, `OTP_LOCKED`, `OTP_EXPIRED`) et `otpInvalidated`.
3. **`error-middleware.ts`** : `password` et `register` rejoignent la liste des types « safe » exposés en production (le front en a besoin pour traduire).
4. **Contrôleur** : `resendRegistrationOtp` appelle `refreshPendingRegistration` (`EXPIRE pending_user:<email> 1800`) après l'envoi ; `PENDING_REG_TTL_SECONDS` 900 → 1 800. Les trois « User already exists » portent `details: { type: "register", code: "EMAIL_ALREADY_USED", field: "email" }`.
5. **Emails OTP** : `sendOtpScoped` passe `expiresInMinutes: OTP_TTL_MINUTES` (export dérivé de `OTP_TTL_SECONDS`) ; les deux templates remplacent « 5 minutes » par `<%= expiresInMinutes %> minutes`. Sujets : « Ton code d'activation Yamba » / « Ton code de réinitialisation Yamba ».
6. **Front** : nouveau `apps/user-ui/src/lib/auth/auth-error-codes.ts` — `firstFailingCheck(checks)` (ordre = ordre serveur), `passwordCheckMessage` / `passwordCodeMessage`, `registerCodeMessage`, `otpCodeMessage`, `readAuthErrorDetails`. `RegisterForm` nomme le critère au submit et pose l'erreur serveur sur le champ (`password` ou `email`) ; `ResetPasswordForm` idem ; `RegisterVerifyForm` / `ResetVerifyForm` construisent le message OTP à partir de `details.code` (le `message` anglais n'est plus jamais rendu) et disent « essais restants avant invalidation du code ».
7. **Pixel** : `LoginForm` / `RegisterForm` — bouton œil `absolute bottom-0 right-1.5 top-1.5 my-auto` (le champ a `mt-1.5` DANS le conteneur `relative` : `inset-y-0` centrait sur la marge) ; `hero-visuals.ts` — les entrées `photo-route` et `photo-package` (fichiers absents) sont retirées.

### Preuves
- `npx nx test auth-service` : 40 tests (21 existants + 19). tsc ×5 projets Nx OK, `tsc --project apps/user-ui/tsconfig.json` OK.
- Instance de test sur `PORT=6011` (bundle `dist/main.js`, l'instance de recette sur 6001 intacte) : `POST /api/auth/register` avec `Ab1!` → `PASSWORD_TOO_SHORT` ; avec le prénom dedans → `PASSWORD_CONTAINS_PERSONAL_INFO` ; email seed → `EMAIL_ALREADY_USED`. OTP planté dans Redis puis 5 mauvais codes → `attemptsLeft` 4, 3, 2, 1 puis `OTP_INVALIDATED` (`lockUntilSeconds: 60`), clé `otp:forgot:<email>` absente, 6e appel → `OTP_LOCKED` (TTL 60). Clés nettoyées.

### Pièges rencontrés
- `nx serve auth-service` ne recharge pas à chaud : le premier smoke test sur `:8080` a répondu avec l'ANCIEN code (aucun `details`). Preuve = bundle reconstruit lancé sur un autre port.
- Les routes du service sont montées sous `/api` même en direct (`app.use("/api", router)`) : `POST :6011/auth/register` → 404, `POST :6011/api/auth/register` → OK.

# feat/email-locale — la langue de l'utilisateur, un seul gabarit, des emails en données (D44, D45, A55–A57)

Implémentation de D44 (langue des emails = langue de l'utilisateur, conçue pour N langues) et de D45 dans les emails (prénom réel de la contrepartie). Une PR, cinq zones du monorepo.

### 1. La liste des langues, à un seul endroit
`packages/libs/api-contracts/src/locale.ts` : `SUPPORTED_LOCALES = ["fr", "en"]`, `DEFAULT_LOCALE`, `isSupportedLocale` (garde de type strict) et `resolveLocale` (tolérant : « fr-FR », « en-US,en;q=0.9 », vide, inconnu → repli). Le fichier n'importe pas zod : le front le consomme par l'alias `@packages/api-contracts/locale` (déclaré dans `apps/user-ui/tsconfig.json`, qui REDÉFINIT `paths` — piège connu) et `src/i18n/routing.ts` passe `SUPPORTED_LOCALES` à next-intl au lieu de redéclarer `["fr", "en"]`.

### 2. La donnée : `User.preferredLocale`
`prisma/schema.prisma` : `preferredLocale String @default("fr")` — `npx prisma generate` + `db push`. Écrite à l'inscription (`registerUser` → `PendingRegistration.preferredLocale` → `user.create`) depuis `resolveLocale(getClientLocale(req))`, mise à jour par `PATCH /auth/me/locale` (`updateMyLocale`, `isAuthenticated`, 400 `LOCALE_UNSUPPORTED` hors liste). `GET /auth/me` la renvoie déjà (spread du user).

### 3. Le front dit sa langue
- `apps/user-ui/src/lib/current-locale.ts` : `getCurrentLocale()` lit le premier segment de `window.location.pathname` (next-intl impose le préfixe) ; `null` côté serveur.
- `lib/api-client.ts` : intercepteur de requête → en-tête `x-locale`. `lib/api.ts` (`apiFetch`) : `...localeHeaders()`.
- `HeaderLocaleSwitcher` : après `router.replace`, si `useUser()` a un utilisateur → `apiClient.patch("/auth/me/locale")` puis `setQueryData(["user"])` ; échec silencieux (la navigation a déjà eu lieu).

### 4. Le gabarit partagé et les emails auth
- `packages/libs/email/src/layout.ts` : type `EmailContent` + `LAYOUT_EJS` (chaîne). `index.ts` : `renderTransactionalEmail` (pur, `ejs.render`), `sendTransactionalEmail`, `getFromAddress()` (`SMTP_FROM`, sinon `SMTP_FROM_NAME <SMTP_USER>` — enfin lu).
- `apps/auth-service/src/emails/auth-emails.ts` : `AUTH_EMAILS: Record<SupportedLocale, AuthEmailDictionary>` (7 fonctions par langue : `verifyEmail`, `resetPassword`, `passwordChanged`, `accountCreated`, `securityAlert`, `carrierOnboardingComplete`, `carrierOnboardingReminder`), `getAuthEmails(locale)` avec repli. `send-auth-email.ts` : best-effort (log, jamais de throw), saute si SMTP absent.
- `auth.helper.ts` : `sendOtpScoped(scope, firstName, emailKey, locale)`, `verifyOtpScoped(…, locale)` (l'alerte sécurité du 10e échec porte le VRAI verrou du palier), `sendPasswordChangedEmail` / `sendAccountCreatedEmail` avec `locale`, `localeFromHeaders(headers)`. `onboarding-email.service.ts` : `user.preferredLocale`. Supprimés : `utils/sendMail/` et les 7 `.ejs` de `utils/email-templates/`.
- `webpack.config.js` de l'auth-service : alias explicites `@packages/api-contracts` et `@packages/email` AVANT le générique (le chemin réel est `packages/libs/<lib>/src`).

### 5. notification-service et trip-service dans la langue du destinataire
- `booking-emails.ts` : `buildBookingEmail(event, role, firstName, { locale, counterpartFirstName })` ; le dispatcher charge `shipperId` + `carrierId` + destinataires en UNE `findMany` (`preferredLocale` sélectionnée) et passe le prénom de l'autre partie. Cinq gabarits (`accepted`, `payment-authorized`, `requested-carrier`, `picked-up`, `delivered`) remplacent « le Voyageur » / « l'Expéditeur » par `${counterpartFirstName || "ton Voyageur"}`.
- `trip-notifications.email.ts` : `recipient.preferredLocale` (sélectionné dans les deux requêtes de `trip-notifications.service.ts`) → `resolveLocale` ; les emails d'alerte de route acceptent `preferredLocale` en option.

### Preuves
- Tests : auth-service 59 (+19 : `locale.spec.ts`, `auth-emails.spec.ts` — miroir des dictionnaires, aucun emoji dans les sujets, OTP et durée rendus dans les deux langues, repli `de` → `fr`, verrou du palier dans l'alerte) ; notification-service 68 (+9 : prénom dans 5 gabrits × 2 langues, repli rôle sans « null », locale du destinataire dans le dispatch, deux parties chargées, contrepartie effacée) ; trip 187 ; deal 355 → plateforme 610. tsc ×5 Nx + user-ui.
- Smoke test sur `PORT=6011` : login seed avec `x-locale: en`, `GET /auth/me` → `preferredLocale`, `PATCH /auth/me/locale` `en` → 200 puis relu `en`, `de` → 400 `LOCALE_UNSUPPORTED`, retour `fr`.
- Le serveur Next en cours résout le nouvel alias (page login 200, aucun « Module not found »).

### Pièges rencontrés
- `verifyOtp` s'exécutait AVANT la lecture de `pending` : la langue de l'alerte sécurité vient donc de la requête, celle de l'email de bienvenue de l'inscription.
- `CarrierPage.onboardingStep` est un enum (`PROFILE`, `STRIPE`, `COMPLETE`), pas un nombre : le dictionnaire compare à `"PROFILE"`.

# feat/booking-auth-modal — la porte de réservation en modale, le header qui ramène (A58)

### Ce qui a été fait
1. **`components/trips/detail/BookingAuthGateModal.tsx`** — `open`, `tripId`, `onCloseAction`. `useIsMobile()` choisit la forme : dialogue centré (`max-w-md`, bouton ×) ou feuille du bas (poignée, `safe-area-inset-bottom`). `role="dialog"`, `aria-modal`, `aria-labelledby` / `aria-describedby` ; effet : Échap ferme, `body.overflow = hidden`, focus sur « Se connecter » au prochain frame ; fond cliquable (`<button aria-label="Plus tard">`). Les deux actions poussent `withRedirect("/login" | "/register", "/trips/:id/book")`. Textes : `booking.authGate.*` (clé `later` ajoutée fr/en).
2. **`BookingSummaryCard` / `BookingMobileBar`** — `useUser()` ; `handleReserve` : `!user && !userLoading` → ouvre la modale, sinon `router.push(/book)` (utilisateur inconnu pendant le chargement : la page `/book` tranche, comme avant). Chaque composant possède sa modale (un seul est visible à la fois : `lg:hidden` / carte desktop).
3. **`lib/auth/login-redirect.ts`** — `shouldCarryRedirect(pathname)` (faux pour `/`, `/login`, `/register`, `/password/*`), `loginHrefFor`, `registerHrefFor` (sur `withRedirect` de #114, donc anti open redirect), `bookingRedirectFor(tripId)`.
4. **Header** — `usePathname()` de `@/i18n/navigation` (chemin SANS locale) → `loginHref` pour le lien desktop ET l'entrée de la palette de commandes (dépendance du `useMemo`). **`HeaderMobileBottomSheet`** — dans `AnonymousContent` (le composant qui rend les deux liens), `registerHrefFor` / `loginHrefFor`.

### Preuves
- tsc user-ui OK ; miroir i18n fr/en (clé `later` des deux côtés) ; page trajet réelle en 200 sur le serveur de dev LAN. Pas de Jest user-ui : recette G1–G8 (`YAMBA-DOC-METIER.md`).

### Piège rencontré
- `HeaderMobileBottomSheet.tsx` contient DEUX composants : le hook `usePathname` inséré dans le premier (`const t = useTranslations` trouvé par regex) n'était pas visible du second, qui rend les liens. Règle : chercher le composant qui RENDU l'élément, pas le premier hook du fichier.

# feat/trip-favorites — mettre un trajet de côté (D46, A59)

### Serveur (trip-service)
1. **Prisma** — `TripFavorite { userId, tripId, createdAt, @@unique([userId, tripId]), @@index([userId, createdAt]), @@index([tripId]) }`, relations `User.tripFavorites` et `Trip.favorites` (cascade). `prisma generate` + `db push` (index créés).
2. **Contrats** — `packages/libs/api-contracts/src/trip/trip-favorite.schema.ts` : `TripFavoriteState { tripId, isFavorite }`, `FavoriteTripsResponse { trips: YambaTripResult[], totalCount }`, codes `TRIP_NOT_FAVORITABLE` / `OWN_TRIP`. `YambaTripResult` et `PublicTrip` gagnent `isFavorite?: boolean`.
3. **Service** — `services/trip-favorite.service.ts` : `addFavorite` (404 si absent/supprimé, 403 `OWN_TRIP`, 409 `TRIP_NOT_FAVORITABLE` hors PUBLISHED, `upsert` sur la clé composite → idempotent), `removeFavorite` (`deleteMany`, toujours possible), `favoriteTripIds` (une requête `in`, aucune pour un visiteur ou une liste vide), `markFavorites` (pose `isFavorite` sur des DTO), `listFavoriteTrips` (jointure `trip` + `TRIP_SEARCH_INCLUDE`, `mapTripToYambaResult`, `isFavorite = true`, trajets passés inclus, supprimés exclus).
4. **Routes** — `GET /trips/favorites` (AVANT `/:id`), `POST` / `DELETE /trips/:id/favorite` (`isAuthenticated`) ; `GET /trips/search` et `GET /trips/:id/public` passent sous `isOptionallyAuthenticated`. Contrôleur `controllers/trip-favorite.controller.ts` (validation ObjectId, locale depuis `?locale` ou `x-locale`).
5. **Enrichissement** — `trip-search.controller.ts` : `markFavorites(req.user?.id, mapped)` sur les DEUX chemins (tri par poids et pagination curseur) ; `getPublicTrip` : `isFavorite` via `favoriteTripIds`.
6. **OpenAPI** — trois chemins ajoutés dans `build-openapi.ts` (tag `trips-favorites`), `npm run generate:openapi` → les trois `openapi.json` bougent (registre Zod global partagé) et sont commités.
7. **Tests** — `trip-favorite.service.spec.ts` (mock Prisma virtuel, patron deal-service) : idempotence, 404 / 403 / 409 par statut, retrait sur trajet passé, `markFavorites` visiteur vs connecté, aucune requête sur liste vide → trip-service **198**.

### Front (user-ui)
- `services/favorite.api.ts` (axios, `requireAuth`), `hooks/useFavoriteTrips.ts` (clé `["favorites", locale]`), `hooks/useFavoriteMutations.ts` (`useToggleFavorite` : bascule optimiste des caches fiche / pages infinies de recherche / liste, rollback complet en erreur, invalidation à la fin).
- `components/favorites/FavoriteButton.tsx` — variantes `card` (rond 36 px, `stopPropagation` + `preventDefault` dans la carte-lien) et `detail` (pilule avec libellé), `aria-pressed`, visiteur → `loginHrefFor(pathname)` + toast, refus serveur traduits depuis `details.code` (sonner).
- Cœur posé dans `TripResultCard` (à la place de l'espace flexible de l'en-tête), `TripResultCardMobile` (en-tête, à côté de l'alerte capacité), `TripDetailView` (en-tête, masqué pour le créateur).
- Page `app/[locale]/dashboard/favorites/page.tsx` + `components/favorites/FavoriteTripsList.tsx` (squelette, erreur, état vide avec CTA recherche, cartes desktop/mobile réutilisées). Navigation : `dashboard.config.ts` (`SectionKey` `favorites`, groupe « Activité », onglet mobile), `menu-items.ts` (`myFavorites`), messages `dashboard.sections.favorites`, `common.userMenu.myFavorites`, nouveau namespace `favorites.json` fr/en enregistré aux trois endroits de `i18n/request.ts`.

### Preuves
- trip-service 198 tests, tsc ×5 Nx + user-ui, miroir i18n (24 namespaces), OpenAPI régénéré sans diff résiduel.
- Smoke test sur `PORT=6012` (bundle, instance de recette intacte), cookie du seed Marc : recherche connectée → `isFavorite: false` partout ; `POST` sur un trajet d'Enrique → `{ isFavorite: true }`, rejoué → identique ; `GET /trips/favorites` → 1 ; la recherche montre `true` sur ce seul trajet ; fiche publique connectée `true`, visiteur `false` ; `POST` sur son propre trajet → 403 `OWN_TRIP` ; `DELETE` → `false` ; id inconnu → 404. `favorite` (et `locale`) ajoutés aux types « safe » du middleware pour que `details.code` sorte aussi en production.

# feat/auth-pages-ux — tutoiement, promesses vraies, une porte d'identité pour toutes les actions (D45, A60)

### Ce qui a été fait
1. **Tutoiement** — les six formulaires de `components/auth/forms/` (copie inline `buildCopy`) et `messages/fr/auth.json` : « Connectez-vous » → « Connecte-toi », « Veuillez saisir » → « Saisis », « Réessayez » → « Réessaie », « Compte verrouillé temporairement » → « Saisie bloquée temporairement » (A50), placeholders `prenom@email.com`. Vérification : `grep -i "vous|votre|vos|veuillez"` vide sur `components/auth/`.
2. **Panneau gauche** (`AuthHeroVisual.tsx`) — le bloc statistiques et le témoignage sont supprimés (types `Stat` / `Testimonial` retirés) ; trois promesses produit avec icônes Lucide (`UserCheck`, `CreditCard`, `ShieldCheck`) : compte vérifié, débité seulement à l'acceptation, Garantie Yamba. Accroche « Le transport, c'est toi. ».
3. **Mobile** — `px-3.5 py-2.5 text-sm` → `text-base sm:text-sm` sur tous les champs des six formulaires : 16 px sous 640 px (iOS ne zoome plus au focus), 14 px au-dessus.
4. **`components/auth/shared/AuthGateModal.tsx`** — la modale de #118 devient générique (`title`, `subtitle`, `redirect`, boutons `common.authGate.login/register/later`) ; `BookingAuthGateModal` n'est plus qu'un habillage (`booking.authGate.title/subtitle`, retour wizard). Les clés `booking.authGate.login/register/later` sont retirées (fr/en).
5. **« Partager un trajet »** — `useShareTrip` expose `gateOpen` / `closeGate` / `shareRedirect` et n'envoie plus vers `/login` ; `HeaderShareTripCTA` rend `AuthGateModal` (texte `common.authGate.shareTrip`) dans ses trois variantes. Utilisateur en chargement → `/trips/create` (la page tranche).
6. **Cœur favori** — `FavoriteButton` ouvre `AuthGateModal` (`common.authGate.favorite`, retour sur la page courante) au lieu de pousser vers `/login` ; la clé `favorites.button.signInRequired` disparaît. `AuthGateModal` est rendue par `createPortal` dans `<body>` avec `stopPropagation` : déclenchée depuis une carte-lien, rendue dans l'ancre, chaque clic aurait navigué.

### Preuves
tsc user-ui, miroir i18n (24 namespaces), page login 200 sur le serveur de dev. Pas de Jest user-ui : recette I1–I8 (`YAMBA-DOC-METIER.md`).

# feat/auth-google — « Continuer avec Google » (D47, A61)

### Serveur (auth-service)
1. **Prisma** — `AuthIdentity { userId, provider (enum GOOGLE), providerSub, email?, createdAt, lastUsedAt, @@unique([provider, providerSub]) }` + `User.identities`. Modèle séparé : un `googleSub String? @unique` sur `User` aurait percuté les `null` sur Mongo (pitfall P2002).
2. **`services/google-auth.service.ts`** — `googleSignIn(deps, input)` pur : 503 `GOOGLE_NOT_CONFIGURED` (pas de vérificateur), 401 `GOOGLE_TOKEN_INVALID`, 403 `GOOGLE_EMAIL_UNVERIFIED` ; identité connue → `LOGGED_IN` (+ `lastUsedAt`) ; email normalisé connu → `authIdentity.create` puis `LOGGED_IN { linked: true }` ; sinon sans `consent` → `CONSENT_REQUIRED { profile }` ; avec → `$transaction` (User `passwordHash: null`, `publicSlug`, `preferredLocale` = `resolveLocale(locale)`, `identities.create`, `recordRegistrationConsents`).
3. **`services/google-token.verifier.ts`** — `buildGoogleTokenVerifier()` : `OAuth2Client.verifyIdToken({ audience: GOOGLE_CLIENT_ID })`, mappe `sub / email / email_verified / given_name / family_name / picture`, `null` si rejet.
4. **Contrôleur** — `issueSession(res, user, rememberMe)` extrait de `loginUser` (cookies + record Redis D27) ; `googleSignIn` (`POST /auth/google`) : `credential` requis, consentement passé seulement complet, locale / IP / user-agent depuis la requête, email de bienvenue à la création. `oauth` ajouté aux types safe du middleware.
5. **Dépendance** — `google-auth-library@10` (racine). `.env.example` : `GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (+ marche à suivre Google Cloud).
6. **Tests** — `google-auth.service.spec.ts` (6) → auth-service **65**.

### Front (user-ui)
- `hooks/useGoogleIdentity.ts` — chargement unique du script GIS, `initialize` (popup, ITP), `renderButton` (outline, pilule, largeur du conteneur, locale), `configured` / `ready` / `failed` ; typage global minimal de `window.google`.
- `components/auth/shared/GoogleSignInButton.tsx` — bouton officiel (squelette pendant le chargement, bouton inerte sans client ID ou si le script échoue) ; `POST /auth/google` ; `CONSENT_REQUIRED` → modale « Finalise ton compte » (case CGU + confidentialité, liens `/legal/terms`, `/legal/privacy`, `LEGAL_VERSIONS`) qui rejoue le même jeton ; succès → `resetAuthRefreshCircuitBreaker`, invalidation `["user"]`, toast (bienvenue / relié / content de te revoir), `router.push(redirectTo || "/")`.
- `LoginForm` (`text="signin_with"`) et `RegisterForm` (`text="signup_with"`) remplacent le bouton Google inerte ; Facebook reste tel quel. `auth.json` : namespace `google` fr/en.

### Preuves
auth-service 65 tests, tsc auth + user-ui, miroir i18n. Le flux réel exige un ID client Google (geste utilisateur) : recette J1–J8 (`YAMBA-DOC-METIER.md`) à jouer après configuration.

# fix/session-remember-default — la session expirait bien, la case cochée par défaut le cachait (A62)

Diagnostic avant code : `session-policy.ts` (60 min / 7 j standard, 7 j / 30 j rememberMe, 21 tests), `storeRefreshSession` (TTL Redis = min(inactivité, vie absolue restante)), `refreshAuthTokens` (rotation avec le MÊME `createdAt`, plafond revérifié), `setCookie` (refresh de session sans `maxAge` hors rememberMe) : conformes à D27. Cause : `LoginForm` initialisait `remember: true`. Correctif : `remember: false`, libellé « Rester connecté sur cet appareil », aide `rememberHint` (`aria-describedby`) qui énonce les deux durées. Rien côté serveur. Recette K1–K4 (`YAMBA-DOC-METIER.md`).

# feat/auth-gate-inline-login — se connecter dans la fenêtre, reprendre le geste (A63)

1. **`LoginForm`** gagne `variant: "page" | "modal"`, `redirectOverride`, `onSuccessAction`. Le JSX du formulaire (OAuth, séparateur, champs, bouton, lien inscription) devient `formBlock` ; la variante `page` l'enveloppe dans la grille visuel + carte (visuel optionnel), la variante `modal` le rend seul. En modal : pas de bandeau « compte activé », retour = `redirectOverride`, succès → `onSuccessAction` (après `invalidateQueries(["user"])`) au lieu de `router.push`.
2. **`GoogleSignInButton`** : `onSuccessAction` (même sémantique) — le bouton officiel Google fonctionne dans la modale.
3. **`AuthGateModal`** : rend `<LoginForm variant="modal" />` sous le titre de l'action ; `onSignedInAction` (reprise) sinon navigation vers `redirect` ; focus sur le premier champ ; panneau `max-h-[92vh] overflow-y-auto` (le formulaire est plus haut que deux boutons) ; les clés `common.authGate.login/register` disparaissent.
4. **`FavoriteButton`** : `onSignedInAction` → `toggle.mutate({ next: true })` : le favori est appliqué dans la foulée, `failWith` factorisé. Réservation et partage gardent la navigation (leur geste EST une page).

### Preuves
tsc user-ui, miroir i18n, pages login et trajet en 200 sur le serveur de dev. Recette M1–M6 (`YAMBA-DOC-METIER.md`).

# chore/api-same-origin — l'API en même origine que le front (D48)

- `apps/user-ui/next.config.js` : `async rewrites()` → `[{ source: "/api/:path*", destination: `${API_PROXY_TARGET}/api/:path*` }]` quand `API_PROXY_TARGET` est posé, `[]` sinon (vérifié en évaluant la config avec et sans variable).
- Clients API : `NEXT_PUBLIC_API_BASE_URL` peut être relatif (`/api`) — axios (`baseURL`) et `fetch` l'acceptent tels quels dans le navigateur ; aucun appel API depuis un Server Component (vérifié par grep), donc pas d'URL interne nécessaire aujourd'hui (la décision D48 fixe la règle si cela change).
- `.env.example` du front (`API_PROXY_TARGET`, `NEXT_PUBLIC_API_BASE_URL=/api`) et `CLAUDE.md` (pièges LAN) documentent les deux modes. Le `.env.local` de recette N'EST PAS modifié : bascule à la main (deux lignes) + redémarrage de user-ui.

### Preuves
Config évaluée en Node avec et sans variable ; tsc user-ui. Recette : avec le proxy, `http://localhost:3000` ET `http://192.168.1.155:3000` doivent permettre connexion + `/me` sans changer d'environnement.

# feat/follow-auth-gate — « Suivre » passe par la porte d'identité (A64)

1. **`FollowSidebar`** (`apps/user-ui/src/components/users/profile/FollowSidebar.tsx`) : `handleToggleFollow` ouvre `AuthGateModal` (`gateOpen`) quand `user.follow.isFollowedByMe === null` (l'API renvoie `null` pour un visiteur, `true`/`false` pour un connecté — c'est l'indicateur de session déjà utilisé par le composant) au lieu de `router.push("/login?redirect=…")`.
2. **Reprise du geste** : `onSignedInAction={() => follow({ slug, notifyNextTrip: true })}` — la mutation `useFollowUser` est optimiste (`isFollowedByMe: true`, `followersCount + 1`) puis `onSettled` invalide `["public-user", slug]` et `["following"]` : le profil se recharge avec la session (le bouton passe à « Suivi », le toggle de notification apparaît, et `isOwnProfile` devient vrai si le visiteur s'est connecté avec le compte du profil — la mutation est alors refusée par le serveur et le cache revient à son état précédent).
3. **`redirect`** = `usePathname()` (repli `/u/:slug`) : le lien « Inscris-toi » de la fenêtre ramène sur le profil après OTP et connexion (chaîne A54/A58).
4. La modale n'est rendue que si `!user.isOwnProfile` (le propre profil montre « Modifier mon profil », jamais « Suivre »).
5. i18n : `common.authGate.follow.{title,subtitle}` FR/EN avec la variable `{firstName}` (`tGate("title", { firstName })`).

### Preuves
tsc user-ui (`tsc -p apps/user-ui`), `node scripts/check-i18n-messages.mjs` (miroir parfait). Recette S1–S4 (`YAMBA-DOC-METIER.md`).

# B4-PR1 — `feat/b4-payout-server` : l'argent sortant côté serveur (D49–D52, A65–A70)

## Ce qui a été fait

1. **Machine à états** (`apps/deal-service/src/services/booking-state-machine.ts`) : nouvelle transition `PICKED_UP --dispute(SHIPPER)--> DISPUTED` (effets `CREATE_TICKET`, `NOTIFY_CARRIER`) gardée par `departureLongPast` (`trip.departureAt + 48 h <= now`, constante `DISPUTE_AFTER_DEPARTURE_HOURS`) ; `BookingLike.departureAt` alimente le guard (sans date : refus, conservatif). Les trois transitions B4 déclarées depuis B1 (`confirmEarly`, `autoComplete`, `dispute` depuis DELIVERED) ont maintenant leurs exécuteurs.
2. **Prisma** (`prisma/schema.prisma`) : Booking + `payoutStatus` (enum `PayoutStatus` PENDING/SENT/FAILED/FROZEN), `payoutAmountCents`, `payoutSentAt`, `payoutAttempts`, `payoutFailureReason`, `completedBy`, `chargeId` (A69), `verificationReminderSentAt` (A70) ; index `[status, payoutStatus]`. Nouveau modèle **`Dispute`** (`bookingId @unique`, `ticketNumber @unique`, catégorie, description, solution souhaitée, photos, `pledgeAcceptedAt`, `status OPEN`) + enums `DisputeCategory`, `DisputeDesiredOutcome`, `DisputeStatus`. `prisma db push` joué (index Atlas en place).
3. **`@packages/payments`** : `PaymentProvider.transfer(TransferInput)` → `TransferResult` ; Stripe = `transfers.create` (`destination`, `transfer_group`, `source_transaction`, clé d'idempotence) ; Fake = tableau `transfers` observable, clé d'idempotence honorée (même clé ⇒ même transfert). `PaymentAuthorization.chargeId` (Stripe `latest_charge`, Fake `ch_fake_<intent>` posé à la capture).
4. **Contrats** (`packages/libs/api-contracts/src/booking/`) : `booking-settlement.schema.ts` (`ConfirmDealResponse`, `DisputeDealRequest` — catégorie, description ≥ 50, `pledgeAccepted: literal(true)`, ≤ 5 URL, solution optionnelle —, `DisputeDealResponse`, `ShipperDisputeView`) ; enums `PayoutStatus`, `DisputeCategory`, `DisputeDesiredOutcome` ; vues : `payoutStatus` + `payoutSentAt` dans les jalons des deux rôles, `dispute` (Expéditeur seul), `disputeCategory` (Voyageur) ; événements : `booking.disputed.disputeCategory` (nullish), nouvelle clé **`booking.verification_reminder`** (18 clés).
5. **`deal-settlement.service.ts`** (nouveau) : `confirmEarly` (COMPLETED + `payoutStatus PENDING` + `booking.completed` en transaction, puis `executePayout` en ligne — A67), `dispute` (transaction : DISPUTED + ticket + `FROZEN` si DELIVERED + `Dispute` créé via le hook `within` de `applyBookingTransition` + `booking.disputed` ; collision P2002 sur `ticketNumber` → retirage ; `NOT_DELIVERED` imposé depuis PICKED_UP → 400), `executePayout` (compte Connect via `CarrierPage.stripeAccountId` + `stripePayoutsEnabled`, sinon `FAILED CARRIER_ACCOUNT_NOT_READY` ; erreur fournisseur → `FAILED PROVIDER_ERROR:…` ; succès → écriture conditionnelle `payoutStatus ∈ {PENDING, FAILED}` → SENT + `booking.payout_sent` ; course → considéré SENT), `autoCompleteDue`, `retryFailedPayouts` (< 10 essais), `sendVerificationReminders` (échéance ≤ 24 h, `OR null / isSet:false`, marquage dans la transaction de l'outbox).
6. **`booking-write.ts`** : `BOOKING_WRITE_SELECT` élargi (`deliveredAt`, `payoutDueAt`, `payoutStatus`, `payoutAttempts`, `chargeId`), hook `within(tx)` dans `applyBookingTransition` (écritures supplémentaires dans la même transaction).
7. **Acceptation** (`deal-lifecycle.service.ts`) : `chargeId` de la capture écrit avec `capturedAt` (A69).
8. **Routes / contrôleur** : `POST /deals/:id/confirm`, `POST /deals/:id/dispute` (`deal-settlement.controller.ts`, validation Zod = OAS). **Cron** `payout-bookings.cron.ts` (`*/5`, trois passes, `BOOKING_PAYOUT_CRON_ENABLED`), câblé dans `main.ts` (démarrage + arrêt propre). `GET /deals/:id` charge le `Dispute` en DISPUTED et le mapper ne sert que ce que le rôle peut voir (A68) ; `allowedActions` reçoit `departureAt` (le CTA « signaler » apparaît en PICKED_UP après 48 h).
9. **OpenAPI** : deux chemins, réponse 409 dédiée, schémas auto-enregistrés ; `npm run generate:openapi` rejoué (3 fichiers).
10. **notification-service** : `EMAIL_MATRIX` — `completed` → SHIPPER, `payout_sent` → CARRIER, `disputed` → BOTH (nouvelle règle), `verification_reminder` → SHIPPER ; `IN_APP_MATRIX` + `verification_reminder` → SHIPPER. **`settlement-emails.ts`** : dictionnaire `Record<SupportedLocale, …>` (fr, en) de 5 emails rendus par `sendTransactionalEmail` (D44) ; `buildBookingEmail` retourne `content` pour ces clés, le dispatcher branche `sendTransactionalEmail` quand `content` est présent (les 12 gabarits EJS historiques restent servis par `sendTemplatedEmail`). Front : présentation et libellés in-app de `booking.verification_reminder` (FR/EN).
11. **Seed** (`seed-deals.ts`) : wipe des `Dispute`, COMPLETED → `payoutStatus SENT` + montant + `transferId` seed, DISPUTED → `FROZEN` + dossier `Dispute` (`YAM-2041`, `CONTENT_MISSING`). Rejoué : 20 bookings, 2 dossiers.

## Pourquoi dans cet ordre (D49)
Capture et remboursement (D39) : l'argent d'abord, la base ensuite — l'échec de la base se compense. Versement : la base d'abord (COMPLETED est la condition légale, INV-2), l'argent ensuite, idempotent et rejouable — un transfert avant la transaction pourrait payer un deal qui vient de passer DISPUTED. L'échec est un ÉTAT (`payoutStatus FAILED` + raison), jamais une exception qui bloque la complétion.

## Preuves
tsc ×6 · deal-service **380** tests (355 + 22 `deal-settlement.service.spec.ts` + 2 `payment-provider.spec.ts` + 1 net machine) · notification-service **75** (68 + 7) · trip-service 198 inchangé · miroir i18n · OpenAPI régénéré · `prisma db push` + seed rejoués. Recette PAY/LIT dans `YAMBA-DOC-METIER.md`.

## Reste (B4 suite)
B4-PR2 front Expéditeur (bascule des mocks `confirmDeliveryEarly` / `submitDispute`, vues COMPLETED / DISPUTED, upload des photos de litige `deals/dispute/`), B4-PR3 front Voyageur (états de versement, échec avec CTA Stripe, catégorie du litige), `feat/b4-late-cancel-payout` (retenue ANN-01 au prorata, D50). Dette : migration des 12 gabarits EJS vers le dictionnaire D44 (§7.2).

# B4-PR2 — `feat/b4-shipper-front` : l'argent sortant vu par l'Expéditeur (A71–A74)

## Ce qui a été fait

1. **Serveur (A72)** : `ShipperBookingView.disputeOpensAt` (contrat + `booking-view.mapper.ts`) = `trip.departureAt + DISPUTE_AFTER_DEPARTURE_HOURS` en PICKED_UP, `null` sinon — la constante 48 h n'a qu'un propriétaire (la machine), le front affiche la date servie. Test mapper ajouté (22). OpenAPI régénéré.
2. **API du tracker** (`booking-tracker.api.ts`) : `confirmDeliveryEarly` → `POST /deals/:id/confirm` (retourne `completedAt`, `payoutStatus`), `submitDispute` → `POST /deals/:id/dispute` (URL de photos, `pledgeAccepted: true`) ; fin des deux derniers mocks du tracker (A37 soldé). Code d'erreur `VALIDATION` (400) ajouté au mapping.
3. **Types / adapter** : `Booking` gagne `payoutStatus`, `completedBy`, `completedAt`, `disputedAt`, `disputeOpensAt`, `dispute` (dossier `BookingDisputeFile`) ; `delivery.confirmedEarlyAt` disparaît (l'état vient du statut serveur) ; `DisputePhotoDraft` porte `url` / `uploading` / `error` ; `SubmitDisputePayload.photoUrls`.
4. **Routage** (`BookingTrackerClient.tsx`) : `VERIFIED` (COMPLETED) → `views/completed/` (desktop + mobile, cartes partagées `CompletedCards.tsx`) ; `DISPUTED` → `views/disputed/` (desktop + mobile, `DisputedCards.tsx`) ; la notice neutre ne sert plus qu'aux états sans écran. Après confirmation : `invalidateQueries` — la vue « Envoi terminé » vient de `GET /deals/:id`.
5. **Confirmation anticipée** (`ConfirmAllGoodCard.tsx`, A71) : bouton SECONDAIRE (contour émeraude, fond blanc), confirmation en ligne « définitif » conservée, conseil « demande à {prénom} d'ouvrir le colis », toast sans emoji ; rendu seulement si `confirmEarly ∈ allowedActions` ; `TRANSITION_NOT_ALLOWED` → relecture. La carte « Noter » (B5) est retirée des vues livré et terminé (décision 10).
6. **« Signaler » en transit** (`shared/DisputeInTransitLink.tsx`, A72) : actif si `dispute ∈ allowedActions`, sinon texte désactivé « possible à partir du {date servie} » ; posé sur les 4 vues PICKED_UP (code fraîchement révélé + voyage en cours, desktop + mobile). Sur l'écran livré, la carte « Signaler un problème » n'apparaît que si `dispute ∈ allowedActions`.
7. **Formulaire de signalement** (`views/report/`, A73) : garde 7A (`dispute ∉ allowedActions` → toast + `router.replace` vers le suivi) ; transit → motif verrouillé `NOT_DELIVERED` + bandeau (5A) ; photos envoyées à la sélection via `useImageKitUpload("/deals/dispute")` (vignette « envoi… », erreur rouge « retire-la et réessaye »), envoi possible seulement quand toutes sont en ligne (6A) ; barre latérale : fin de fenêtre lue dans `payoutDueAt` (servie — l'ancien calcul `deliveredAt + PAYOUT_DAY` côté front est supprimé), variante transit ; erreurs serveur traduites (`VALIDATION`, `TRANSITION_NOT_ALLOWED` → retour au suivi) ; succès → invalidation du deal.
8. **Vue « Envoi terminé »** : bannière teal (confirmé par toi le … / période terminée le …), carte « le paiement de {prénom} est libéré » + « transaction close », récap de livraison, carte paiement « Libéré », Voyageur, note « bientôt tu pourras noter » sans bouton. L'Expéditeur ne voit jamais `payoutStatus` FAILED (2A).
9. **Vue « Signalement en cours »** (A74) : bannière ticket + date, dossier (ticket, motif, description, solution, date, photos cliquables), les 4 étapes (`report.process.*` réutilisés), carte paiement « Gelé », support `mailto:` avec le numéro (`NEXT_PUBLIC_SUPPORT_EMAIL`, repli `support@yamba.app`), Voyageur.
10. **i18n** : `bookingTracker.json` FR/EN — `completed.*`, `disputed.*`, `senderTracking.reportNotDelivered/reportLocked`, `report.notAllowed`, `report.category.lockedText`, `report.photos.uploading/uploadError`, `report.sidebar.inTransitText`, `report.cta.toastConflict/toastValidation`, `delivered.confirmCard.tip/toastConflict`.

### Preuves
tsc user-ui + deal-service, miroir i18n, mapper 22 tests, suite deal-service complète, OpenAPI régénéré ; pages `/fr/bookings/:id` (DISPUTED, COMPLETED) et `/report` en 200 sur le serveur de dev. Recette E1–E12 (`YAMBA-DOC-METIER.md`).

# B4-PR3 — `feat/b4-carrier-front` : l'argent sortant vu du Voyageur (A75–A78)

## Ce qui a été fait

1. **Serveur** : `CarrierBookingView.payoutBlocker` (A75) dérivé dans `booking-view.mapper.ts` — `FAILED` + `payoutFailureReason = CARRIER_ACCOUNT_NOT_READY` → `ACCOUNT_NOT_READY`, `FAILED` + autre → `RETRYING`, sinon `null` ; le message Stripe ne sort jamais (test dédié). `POST /deals/:id/deliver` accepte `photoUrls` (≤ 2, `DELIVERY_PHOTOS_MAX`, défaut `[]`) écrites dans `Booking.deliveryPhotoUrls` avec la transition (A76) ; `deliveryPhotoUrls` servi aux deux vues (jalons). Mapper 25 tests (+2), transport 25 (+1). OpenAPI régénéré.
2. **Types / adapter Voyageur** (`deal.types.ts`, `deal.adapter.ts`) : `deliveredAt`, `payoutDueAt`, `deliveryPhotos`, `completedAt`, `completedBy`, `payoutStatus`, `payoutSentAt`, `payoutBlocker`, `disputeTicket`, `disputedAt`, `disputeCategory` ; `DeliveryPhotoDraft` (upload à la sélection) ; `validateDeliveryCode(dealId, code, photoUrls)`.
3. **Routage** (`DealClient.tsx`) : DELIVERED / COMPLETED / DISPUTED → `views/settled/DealSettledView.tsx` (un composant, trois états, `variant` desktop | mobile) ; l'écran de clôture d'une ligne ne sert plus qu'aux refus, expirations, annulations.
4. **`shared/DealPayoutStatusCard.tsx`** : l'état du versement au centre — programmé (DELIVERED : « après la vérification, le {date} »), en cours (PENDING), parti le … « 2 à 7 jours » (SENT), **en attente : finalise ton compte Stripe** + bouton `/carrier/onboarding` (FAILED + ACCOUNT_NOT_READY), en cours de traitement (FAILED + RETRYING), en attente (FROZEN).
5. **Litige vu du Voyageur** (A78) : ticket, catégorie seule (libellés dans `carrierDealAccepted.settled.disputed.categories.*`), « ce n'est pas une décision », 3 étapes, carte « Donner ma version » (`mailto:` support, ticket en objet, `NEXT_PUBLIC_SUPPORT_EMAIL`).
6. **Photo de remise** (A76) : `views/deliver/DeliverPhotosBlock.tsx` (optionnel, 2 max, `capture="environment"`, upload à la sélection vers `deals/delivery/` via `useImageKitUpload`, vignette « envoi… » / erreur) placé AVANT la saisie du code ; la validation est bloquée tant qu'une photo est en cours ou en échec ; les URL partent avec le code. Côté Expéditeur : `BookingDeliveryInfo.photos` + adapter + vignettes dans le récap de livraison (emplacement « À la livraison » qui existait).
7. **Écran de succès de livraison** : bouton « Noter » retiré (B5), texte du versement honnête (« partiront vers ton compte après la vérification, le {date} au plus tard, puis 2 à 7 jours »).
8. **« Mes trajets »** (A77) : `CarrierDealItem` + `payoutStatus`, `payoutSentAt`, `payoutBlocker`, `disputeTicket`, `payoutAt` (= `payoutDueAt` servi) ; `TripDealRow` — COMPLETED : « partis vers ton compte le … · 2 à 7 jours » / « en cours d'envoi » / « en attente : finalise ton compte Stripe » ; DISPUTED : « Signalement {ticket} · versement en attente · on te contacte ». `PayoutBlockedBanner.tsx` en tête de la liste (somme des nets bloqués, CTA onboarding) — seulement `ACCOUNT_NOT_READY`, jamais `RETRYING`.
9. **Copie** : `payment.payoutViaValue` / `payment.note`, `sidebar.payoutNote`, `success.payoutText` réécrits (fin de « virement Stripe automatique », « virés le … »). `.env.example` : `SUPPORT_EMAIL` (notification-service, oublié en PR1) et `NEXT_PUBLIC_SUPPORT_EMAIL`.

### Preuves
tsc user-ui + deal-service · miroir i18n · deal-service **384** (381 + 3) · OpenAPI régénéré · pages `/fr/carrier/deals/:id` (seed DELIVERED, COMPLETED, DISPUTED), `/deliver` et `/dashboard/trips` en 200 sur le serveur de dev. Recette V10–V19 (`YAMBA-DOC-METIER.md`, RG-VOY-01…07).

### Reste (B4)
`feat/b4-late-cancel-payout` (retenue ANN-01 au prorata, D50), portefeuille Voyageur (PR dédiée, A77), puis chantier C (admin, médiation). Photo de remise : le seed n'en crée pas (recette réelle).

# `feat/b4-late-cancel-payout` — la retenue ANN-01 revient au Voyageur (D50, A79–A82)

## Ce qui a été fait

1. **Calcul** (`booking-lifecycle.ts`) : `computeLateCancellationCompensationCents({ retentionCents, transportCents, totalShipperCents })` = `round(retenue × net / total)` (A79) ; 0 si rien n'est retenu.
2. **Annulation** (`deal-lifecycle.service.ts`, `cancel`) : après le remboursement ANN-01, retenue = total − remboursement ; si > 0 : avant le départ → `retentionDisposition = CARRIER`, `payoutStatus = PENDING`, `payoutAmountCents = compensation` dans la MÊME transaction que CANCELLED, puis **compensation immédiate** par l'exécuteur injecté (`PayoutExecutor`, 3e paramètre de `makeDealLifecycleService`, A80) — un échec ne casse jamais l'annulation (l'état FAILED est écrit par l'exécuteur, le cron reprend) ; après le départ → `retentionDisposition = HELD_FOR_MEDIATION`, aucune compensation (A81). Prisma : `retentionCents`, `retentionDisposition`.
3. **Exécuteur** (`deal-settlement.service.ts`) : accepte COMPLETED (montant = net) **et CANCELLED** (montant = `payoutAmountCents`, refus si 0) ; `reason` DELIVERY | LATE_CANCELLATION dans l'événement `booking.payout_sent` et les métadonnées du transfert ; écritures conditionnelles sur `status` du booking ; passe 2 du cron élargie à `status ∈ {COMPLETED, CANCELLED}` et `payoutStatus ∈ {PENDING, FAILED}` (couvre aussi un crash entre transition et transfert en ligne — idempotent). `BOOKING_WRITE_SELECT` + `payoutAmountCents`. Routes : le service de règlement est construit avant le cycle de vie et injecté.
4. **Contrats** : `BookingPayoutSentEvent.reason` (nullish), `CarrierBookingView.payoutAmountCents` + `retentionDisposition` (A82). OpenAPI régénéré.
5. **Emails** (A82) : `payoutSentCarrier` reçoit `reason` — variante « Ta compensation est partie » (FR/EN) ; `refund_issued` : donnée `retainedForCarrier` quand le remboursement est partiel → ligne conditionnelle dans le gabarit EJS « la retenue revient au Voyageur ».
6. **Front Voyageur** : `DealPayoutStatusCard` affiche la compensation (pas le net) sur un deal CANCELLED, titre « … de compensation partis » ; `DealClosed` (deal annulé) embarque la carte quand `retentionDisposition = CARRIER`, ou l'explication « retenue conservée, on te contacte » quand HELD_FOR_MEDIATION ; lignes « Mes trajets » CANCELLED : compensation partie / en cours / bloquée, ou retenue conservée ; le bandeau « finalise ton compte Stripe » couvre aussi ces deals (même filtre `payoutBlocker`).
7. **Front Expéditeur** : la note de retenue de la modale d'annulation dit « reversée au Voyageur ».

### Preuves
deal-service **390** (384 + 3 lifecycle + 2 settlement + 1 mapper) · notification-service **76** (+1) · tsc ×2 · miroir i18n · OpenAPI régénéré · page d'un deal annulé en 200. Recette ANN1–ANN8 (`YAMBA-DOC-METIER.md`, RG-ANN-01…06).

### Reste
Portefeuille Voyageur (A77, PR dédiée) · **chantier C** (admin-ui : médiation DISPUTED, arbitrage des retenues HELD_FOR_MEDIATION, remboursements partiels) · prime de protection remboursée à 100 % quand D22 sera réel (gravé A79).

# `feat/wallet` — Finances : portefeuille Voyageur et paiements Expéditeur (A83–A84)

## Ce qui a été fait

1. **Contrat** (`packages/libs/api-contracts/src/booking/booking-wallet.schema.ts`) : `WalletResponse { carrier: CarrierWallet, shipper: ShipperWallet, generatedAt }` — agrégats en cents (`upcomingCents`, `pendingCents`, `blockedCents`, `sentCents`, `sentThisMonthCents` / `heldCents`, `spentCents`, `refundedCents`) et lignes `WalletPayoutItem` (état `UPCOMING | PENDING | BLOCKED | FROZEN | SENT | HELD`, `kind DELIVERY | LATE_CANCELLATION`, `amountCents` nullable pour HELD) et `WalletPaymentItem` (état `AUTHORIZED | HELD | RELEASED | RELEASED_NO_CHARGE | REFUNDED | PARTIALLY_REFUNDED`, `refundAmountCents`, `retentionCents`).
2. **Service pur** (`apps/deal-service/src/services/wallet.service.ts`) : `toPayoutItem`, `buildCarrierWallet(bookings, counterparts, now)`, `toPaymentItem`, `buildShipperWallet` — chaque état découle des champs posés par les transitions (`payoutStatus`, `payoutFailureReason`, `retentionDisposition`, `capturedAt`, `refundAmountCents`…) ; « ce mois » en UTC ; tri par date décroissante. **Spec** : 8 tests (chaque état, totaux contre les lignes, contrat Zod).
3. **Contrôleur + route** : `GET /me/wallet` (`wallet.controller.ts`) — deux `findMany` (rôle Voyageur / Expéditeur, `select` whitelist), prénoms des contreparties par jointure explicite, délégation au service pur. Gateway : proxy `/api/me/wallet` → deal-service (déclaré avant le catch-all auth). OpenAPI : chemin `getMyWallet`, schémas auto-enregistrés.
4. **`ShipperBookingView`** : `capturedAt`, `refundedAt`, `refundAmountCents` (décision 1A) ; test mapper : servis à l'Expéditeur, absents de la vue Voyageur (A13).
5. **auth-service** (A84) : `POST /carrier/stripe/dashboard-link` (`createStripeDashboardLink`) — `stripe.accounts.createLoginLink(stripeAccountId)` → `{ url }` ; sans compte → 409 `STRIPE_ACCOUNT_MISSING`.
6. **Front** : espace `finances` (FR/EN, enregistré dans `i18n/request.ts`), `useWallet` (`GET /me/wallet`, clé `["wallet"]`), `finances/wallet.types.ts` (miroir de lecture du contrat), `finances/WalletRows.tsx` (`PayoutRow`, `PaymentRow`, `formatCents` — ligne cliquable vers le deal / le suivi, ton et icône par état), **`sections/FinancesSection.tsx` réécrite** : onglets Portefeuille / Paiements (onglet par défaut selon le rôle), 3 `StatCard` par onglet, `PayoutBlockedBanner` réutilisé, bloc « Voir mes virements sur Stripe » (ouvre le lien dans un nouvel onglet ; sans compte : toast « finalise d'abord »), états vides honnêtes, erreur avec « Réessayer ». Fin du `isFr` inline dans cette section. La route `/dashboard/finances/preview` (maquette) est conservée telle quelle.

### Preuves
deal-service **399** (390 + 8 wallet + 1 mapper) · auth-service 65 (inchangé — contrôleur mince, appel Stripe direct) · notification 76 · trip 198 · tsc user-ui + deal-service + auth-service + api-gateway · miroir i18n (25 espaces) · OpenAPI régénéré · `/fr/dashboard/finances` en 200. Recette FIN1–FIN8 (`YAMBA-DOC-METIER.md`, RG-FIN-01…05).

### Reste
Chantier C (admin-ui : médiation DISPUTED, arbitrage des retenues HELD_FOR_MEDIATION, remboursements partiels, Reports, paramètres) · pagination du portefeuille si les volumes l'exigent · solde Stripe (balance) dans le portefeuille (via le même endpoint).

# Fix recette 03/09 — jalons de voyage en 409 (pitfall Mongo, 4e occurrence — A85)

**Symptôme** (recette réelle, deal `6a983c…`) : côté Voyageur, « À l'aéroport », « Décollage »… → `POST /api/deals/:id/events` 409 « Erreur, réessaye », puis 409 « must be confirmed in order » (le premier jalon n'ayant jamais été écrit). Le seed passait : ses bookings portent `trackingEvents: []`, les bookings créés par l'API non.

**Cause** : `deal-transport.service.ts` gardait l'écriture par `where: { trackingEvents: { none: { step } } }`. Sur un document sans le champ, aucun filtre Prisma de liste (`none`, `some`, `isEmpty`, `equals: []`) ne matche (prouvé en base : `count` = 0 pour les quatre) → `updateMany` 0 → 409 « changé entre-temps ».

**Correctif** :
1. `booking-request.ts` : `trackingEvents: []` et `deliveryPhotoUrls: []` à la création (test snapshots).
2. `deal-transport.service.ts` : verrou optimiste `where: { updatedAt: booking.updatedAt }` (`BOOKING_WRITE_SELECT` + `updatedAt`) — la séquence et le doublon restent refusés par la machine sur la lecture ; le `where` ne sert qu'à la course entre deux clics. Spec : le `where` ne contient plus `trackingEvents`.
3. `packages/libs/prisma/scripts/repair-absent-lists.ts` : `$runCommandRaw` `update` avec `$exists: false` → `[]` ; joué : 3 bookings (`trackingEvents`), 23 (`deliveryPhotoUrls`). Vérifié : le filtre `none` matche désormais le deal réel.
4. `CLAUDE.md` : pitfall porté à 4 occurrences avec la règle des listes.

**Régénération du code (Expéditeur)** : signalée le même jour ; en base, aucun événement `booking.code_regenerated` sur le deal et les compteurs sont présents (`codeRegenerations: 0`) — la garde `codeRegenerations` matche. Cause non établie sans la ligne du gateway (`POST /api/deals/:id/code/regenerate <statut>`) : hypothèse principale = session Expéditeur expirée (60 min sans activité depuis A62 → 401 → toast générique). À confirmer en recette.

### Preuves
deal-service 399 (assertions renforcées, même total) · tsc · réparation jouée et vérifiée sur le deal réel.

# `chore/b4-hardening` — durcissement de l'argent sortant (A86–A89)

## Ce qui a été fait

1. **Plafond de rejeu** (`deal-settlement.service.ts`) : `PAYOUT_MAX_ATTEMPTS = 100` (A86). `retryPayoutsForCarrier(carrierId)` rejoue tous les FAILED d'un Voyageur sans plafond (appelé par le webhook). `markTransferReversed(transferId)` : SENT → REVERSED (`PROVIDER_REVERSED`), exclu de la passe de rejeu. `collectOpsDigest()` : trois requêtes bornées (FAILED > 24 h, REVERSED, HELD_FOR_MEDIATION). Prisma / contrat : `PayoutStatus.REVERSED`, `WalletPayoutState.REVERSED` (+ mapping wallet).
2. **Webhook Stripe** (`stripe-webhook.controller.ts`, A87) : vérification avec `STRIPE_WEBHOOK_SECRET` puis `STRIPE_CONNECT_WEBHOOK_SECRET` (`verifyWithAnySecret`) ; `PaymentWebhookEvent` enrichi (`account`, `objectType`, `objectId`, `accountFlags`, `failureMessage`) dans `@packages/payments`. Traitements : `account.updated` → `CarrierPage` (charges / payouts / details) + rejeu immédiat si `payouts_enabled` ; `transfer.reversed` → REVERSED ; `payout.failed` → `notifyCarrierPayoutFailed` (in-app `carrier.payout_failed` avec id d'événement synthétique + email D44 `OPS_EMAILS.payoutFailedCarrier`). `main.ts` passe le service de règlement au webhook.
3. **Récapitulatif support** (A88) : `emails/ops-emails.ts` (dictionnaire FR/EN : `payoutFailedCarrier`, `opsDigest`), `services/ops-notify.service.ts` (`sendOpsDigest`, `notifyCarrierPayoutFailed`), `cron/ops-digest.cron.ts` (`0 8 * * *`, `OPS_DIGEST_CRON_ENABLED`), câblé dans `main.ts`. Alias webpack `@packages/email` ajouté au deal-service (bundle vérifié : `nx build deal-service`).
4. **Session expirée** (A89) : `api-client.ts` émet `yamba:session-expired` sur échec de rafraîchissement ; `components/providers/SessionExpiredGate.tsx` (monté dans `app/[locale]/providers.tsx`) ouvre `AuthGateModal` « Ta session a expiré » ; après connexion : `resetAuthRefreshCircuitBreaker()` + `invalidateQueries()`. Copie `common.authGate.sessionExpired` FR/EN.
5. **Copie** : in-app `booking_payout_sent` → « Versement parti vers ton compte » ; `carrier_payout_failed` ; `payoutStatus.reversed.*` (carte Voyageur) ; `wallet.state.REVERSED`.
6. **Seed** : `bzv-completed-blocked` (COMPLETED, `FAILED` / `CARRIER_ACCOUNT_NOT_READY`, 4 essais) pour jouer V12–V13 et le bandeau sans compte Stripe réel — 21 bookings.
7. `.env.example` : `STRIPE_CONNECT_WEBHOOK_SECRET`, `OPS_DIGEST_CRON_ENABLED`. **Geste utilisateur** : dans Stripe → Développeurs → Webhooks, ajouter un SECOND endpoint sur la même URL `/api/webhooks/stripe` avec « Écouter les événements des comptes connectés » (`account.updated`, `transfer.reversed`, `payout.failed`) et poser son secret dans `STRIPE_CONNECT_WEBHOOK_SECRET`.

### Preuves
deal-service **402** (399 + 3 : rejeu par Voyageur, renversement, digest) · notification 76 · tsc user-ui + deal-service · miroir i18n · OpenAPI régénéré · `nx build deal-service` OK · seed rejoué (21) · pages Finances / Mes trajets en 200. Recette H1–H8 (`YAMBA-DOC-METIER.md`, RG-H-01…05).

# `feat/notifications-vivantes` — la cloche et les notifications parlent (A91)

## Ce qui a été fait

1. **Contrat** (`notification.schema.ts`) : `NotificationTypeSchema` = clé d'événement booking **ou** notification système (`carrier.payout_failed`) — le mapper strict rejetait la notification écrite par #139 (bug latent corrigé, test) ; `counterpartFirstName` ; `MarkAllNotificationsReadResponse`.
2. **notification-service** : `getMyNotifications` joint les prénoms des contreparties (une requête `user.findMany`, rôle du lecteur déduit du payload) ; `PATCH /me/notifications/read-all` (idempotent, `OR readAt null / isSet:false`), route déclarée AVANT `/:id/read` ; OpenAPI. Emails : règle `SHIPPER_IF_FLIGHT_ARRIVED` sur `booking.tracking_event` (4A) + builder D44 `flightArrivedShipper` ; spec (77).
3. **Front** : `useNotifications` — `refetchInterval` 30 s (onglet visible), `refetchOnWindowFocus` ; `useMarkAllNotificationsRead` ; `buildNotificationCopy(item, role, t, locale)` + `readerRole` dans `notifications.types.ts` (clés `copy.<event>.<ROLE>.title/line`, jalons par étape, variante `lateTitle` pour la compensation) ; section Notifications : copie contextuelle + bouton « Tout marquer lu » ; **`HeaderNotificationBell`** desktop = menu (5 dernières, lu au clic, « Tout marquer lu », « Voir tout », fermeture clic dehors / Échap), mobile = lien + badge ; invalidation de la clé notifications après confirmation anticipée et livraison. `notifications.json` FR/EN : bloc `copy` complet (18 événements × 2 rôles).

### Preuves
notification-service **77** (+1) · tsc user-ui + notification-service · miroir i18n · OpenAPI régénéré · `/fr/dashboard/notifications` en 200. Recette N1–N8 (`YAMBA-DOC-METIER.md`, RG-NOT-01…05).
