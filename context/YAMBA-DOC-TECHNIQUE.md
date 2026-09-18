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

# B5-PR1 — `feat/b5-rating-server` : notation double-aveugle et réputation (D53, A92–A94)

## Ce qui a été fait

1. **Prisma** : Booking + `ratingWindowEndsAt`, `shipperRatedAt`, `carrierRatedAt`, `ratingsRevealedAt`, `ratingRemindersSent`, index `[status, ratingWindowEndsAt]` ; Review + `criteria Json?`, `revealedAt`, index `bookingId` ; CarrierPage + `reputationLevel`, `completedDealsCount`, `lateCancellationsCount` ; User + `shipperReputationLevel`, `shipperCompletedDealsCount`, `shipperLateCancellationsCount`. `prisma db push` joué.
2. **Contrats** (`booking-rating.schema.ts`) : `SubmitRatingRequest` (rating 1–5 entier, `criteria` record, `comment` ≤ 280), `RatingContextResponse` (rôles, personne, `canRate` + raison, `myRating`, `counterpartHasRated`, `revealedAt`, `counterpartRating` nul tant que non révélé), `SubmitRatingResponse`, `ReputationLevel`, `REPUTATION_PARAMS`, `ReputationSummary`, constantes `RATING_WINDOW_DAYS`, `RATING_REMINDER_DAYS`, critères par rôle.
3. **Machine** : `canRate` (opération gardée, A92) + `BookingLike` étendu ; spec S12.
4. **`deal-rating.service.ts`** : `getContext`, `submit` (transaction Review + marquage, révélation immédiate si l'autre a noté + `booking.rating_revealed`, critères filtrés par rôle noté, unicité de service), `sendRatingReminders` (J+5/J+7, garde sur `ratingRemindersSent`), `revealElapsed` (14 j, WINDOW_ELAPSED, silencieux sans note). **`reputation.service.ts`** : `computeReputationLevel` / `averageOf` (purs), `recomputeReputation`, `recomputeBookingParties` (best-effort) — appelé à la révélation, à COMPLETED (settlement) et à l'annulation tardive (lifecycle). Contrôleur, routes `GET/POST /deals/:id/rating`, cron `rating.cron.ts` (horaire), `main.ts`, `.env.example` (`RATING_CRON_ENABLED`), OpenAPI.
5. **notification-service** : `rating_reminder` → email au rôle cible (règle `TARGET_ROLE`, dictionnaire `ratingReminder`, « dernier rappel » à J+7) ; l'email de fin de transaction porte le bouton « Noter {prénom} » (décision 4A) ; spec 78.
6. **auth-service** : profil public → `reputation.{carrier, shipper}` (niveau + faits) ; avis et compteurs limités aux avis révélés. `repair-legacy-reviews.ts` joué (0 avis historique en base).
7. **Seed** : `ratingWindowEndsAt` posé sur les COMPLETED (notation jouable en recette).

### Preuves
deal-service **417** (402 + 10 rating + 3 réputation + 2 machine) · notification **78** (+1) · auth 65 · tsc ×3 · OpenAPI régénéré · `prisma db push` + seed rejoués. Recette NOTE1–NOTE8 (`YAMBA-DOC-METIER.md`, RG-NOTE-01…07) — via API jusqu'à PR2.

### Reste
**B5-PR2 front** : `rating.api.ts` réel (`GET/POST /deals/:id/rating`), écrans de notation branchés (les deux rôles), boutons « Noter » (terminé, listes, accueil), état « note envoyée, révélée quand … », affichage des niveaux et faits sur le profil public et les cartes (« Top Voyageur » = `isSuperCarrier`, « Expéditeur fiable »), lien « Signaler cet avis » (mailto).

# B5-PR2 — `feat/b5-rating-front` : la notation et la réputation à l'écran (A95–A97)

## Ce qui a été fait

1. **Contrat + mapper** (`booking.schema.ts`, `booking-view.mapper.ts`) : `BookingRatingState` (`windowEndsAt`, `ratedByMe`, `counterpartHasRated`, `revealedAt`, `canRate`) servi sur les DEUX vues de deal, calculé par `toRatingState(booking, role, now)` à partir de `canRate` de la machine — le front n'a jamais à dériver « à noter ». `toCarrierBookingView` reçoit `now` (testabilité). Spec du mapper +1 (deal 418). OpenAPI régénéré.
2. **Profil public** (`user-public.controller.ts`) : chaque avis révélé porte `criteria` (pouces).
3. **Module de notation** (`components/rating/`) : `rating.types.ts` (contexte réel, sans moyenne ni nombre de deals — 2A), `rating.api.ts` réel (`GET/POST /deals/:id/rating`, `RatingApiError` avec le code serveur), `RatingClient.tsx` (charge le contexte ; `canRate` faux → `RatingDone` ; échec de chargement → `RatingUnavailable` ; 409 `TRANSITION_NOT_ALLOWED` → toast + rechargement), `RatingSuccess.tsx` (révélé tout de suite ou « révélée quand … ou le {date} », retour au deal), `RatingDone.tsx` (note envoyée / révélée côte à côte / fenêtre fermée), `RatingBlocks.tsx` (bannière sans montant, sans note moyenne, sans « attribué à »).
4. **Carte d'état partagée** `RatingStatusCard.tsx` (1A) : bouton « Noter {prénom} » + échéance ; « Note envoyée · révélée quand {prénom} aura noté, ou le {date} » ; révélé : les deux notes et le commentaire reçu (contexte chargé à la demande) ; fenêtre fermée sans note : une ligne. Posée sur l'écran terminé Expéditeur (`CompletedCards.tsx`, remplace la note « bientôt », desktop + mobile) et Voyageur (`DealSettledView.tsx`).
5. **Adapters** : booking-tracker et carrier `deal.adapter` transportent `rating` ; listes `shipments.adapter` / `my-deals.adapter` : `hasRated = !rating.canRate` (A95) → « à traiter » à l'accueil, ligne « Livré le … par {prénom} » sans étoiles inventées, ligne Voyageur « … · pense à noter {prénom} ».
6. **Profil public** : `public-user.types` (`reputation.{carrier,shipper}`, `PublicReview.criteria`), `UserHero` (badge de niveau coloré avec l'info-bulle des critères, à la place de « Super Voyageur » seul), `TripperBlock` / `ShipperBlock` (ligne de faits « N Deals terminés · ★ moy. sur N avis · N annulation tardive », « prochain niveau », pouces des critères par avis, « Signaler cet avis » mailto `NEXT_PUBLIC_SUPPORT_EMAIL`).
7. **i18n** FR/EN : `rating.json` (`status.*`, `done.*`, `success.*`, `cta.toastConflict`, bannière et visibilité réécrites), `shipments.sub.completedRatedNoStars`, `myTrips.deal.rateHint`, `user-profile.reputation.*` + `reviews.*`.

### Preuves
deal-service **418** (+1 mapper) · notification 78 · auth 65 · tsc user-ui · miroir i18n parfait (25 namespaces) · OpenAPI régénéré. Recette NOTE9–NOTE16 (`YAMBA-DOC-METIER.md`).

### Reste
Chantier C (admin-ui) : file « Signaler cet avis » réelle (remplace le mailto), masquage d'un avis sans suppression, paramètres `REPUTATION_PARAMS` servis au front (fin de la copie dupliquée A97).

# C-PR1 — `feat/c1-admin-socle` : le socle de l'admin (D54, A98–A101)

## Ce qui a été fait

1. **Prisma** : `User` + `totpSecretEncrypted`, `totpEnabledAt`, `totpLastUsedStep`, `totpBackupCodeHashes` (liste créée `[]`) ; modèle `AdminAction` (qui, quoi, cible, avant/après, ip, userAgent ; index `createdAt`, `[targetType, targetId]`, `[adminUserId, createdAt]`). `prisma generate` + `db push` joués.
2. **Libs** : `@packages/totp` (RFC 6238, base32, anti-rejeu, codes de secours, AES du secret — spec 8 tests sur les vecteurs officiels) ; `@packages/admin-audit` (`recordAdminAction(db, …)`, writer typé structurellement : client Prisma ou transaction). Alias ajoutés dans `tsconfig.base.json` ET les `webpack.config.js` d'auth-service et deal-service (leçon §6.2).
3. **auth-service** : `admin-session-policy.ts` (pur, 45 min d'inactivité, 12 h de vie, 5 min de pré-auth — spec 4), `admin-session.ts` (Redis `admin_jti:`, compteur d'échecs TOTP), `cookies/adminCookies.ts` (`admin_access_token`, `admin_refresh_token`, `admin_preauth`), `admin-auth.controller.ts` (`POST /auth/admin/login` → `{next: "TOTP"|"SETUP"}` · `totp/setup` · `totp/enable` (codes de secours montrés une fois + session) · `totp/verify` (TOTP ou code de secours, anti-rejeu, 5 échecs / 15 min) · `refresh` (rotation, même `createdAt`) · `logout` · `GET /admin/me` · `GET /admin/audit` paginé par curseur), `admin.router.ts` monté dans `main.ts`.
4. **packages/middleware** : `isAdminAuthenticated` (cookie `admin_access_token` ou Bearer, `adm` + `amr` totp, compte ADMIN non supprimé avec 2FA active).
5. **deal-service** : contrat `admin/admin-dispute.schema.ts` (`ArbitrationQueueItem`, `ArbitrationQueueResponse`, `AdminDisputeFile`), `admin-dispute.service.ts` (`arbitrationKindOf`, `toQueueItem`, `toDisputeFile` purs — spec 6 ; `listQueue`, `getFile` journalisé `DISPUTE_VIEWED`), contrôleur, routes `GET /admin/disputes`, `GET /admin/disputes/:id` sous `isAdminAuthenticated`, OpenAPI (tag `admin`).
6. **gateway** : `/api/admin/disputes/*` → deal-service ; le reste de `/api/admin/*` et `/api/auth/admin/*` → auth-service (catch-all).
7. **`apps/admin-ui`** (Next 16, port 3001, sans i18n ni thème, Tailwind, proxy `/api` D48) : `/login` (mot de passe → QR + secret + premier code + codes de secours, ou TOTP / code de secours), coquille avec garde `/admin/me` et déconnexion, `/disputes` (file : dossier, motif, corridor, parties, montant, ouvert J+n en rouge à partir de J+5), `/disputes/[id]` (chronologie, argent, deux parties avec faits de réputation, colis déclaré, prise en charge + checklist, jalons, remise, signalement — photos cliquables), `/audit`. Client fetch avec UN refresh sur 401 puis retour à `/login`. `nx sync` a ajouté la référence projet dans `tsconfig.json`.
8. **Script** `packages/libs/prisma/scripts/grant-admin.ts <email> [--revoke]` (le rôle ADMIN ne se pose que là). `.env.example` : `TOTP_ENCRYPTION_KEY`, `ADMIN_TOTP_ISSUER`, durées de session admin. CI : `TypeScript (admin-ui)` ajouté à la matrice (check non requis par la protection de branche — à ajouter dans les réglages GitHub). `npm run admin-ui`.

### Preuves
auth-service **80** (65 + 4 politique + 11 TOTP) · deal-service **424** (418 + 6 mapper) · notification 78 · trip 198 · tsc ×7 (admin-ui compris) · `nx build` auth, deal, admin-ui · OpenAPI régénéré · **smoke test réel sur les bundles construits** (ports 6091/6093, compte seed promu puis rétrogradé) : mauvais mot de passe 401 · `login → SETUP` · `/admin/me` sans session 401 · mauvais code 401 · `enable` → 8 codes + cookies `admin_*` · `/admin/me` 200 · cookie utilisateur seul 401 · file : 2 litiges du seed · dossier complet sans `deliveryCode` · refresh 200 · code de secours accepté puis rejoué 401 · même pas TOTP rejoué 401 · journal : `ADMIN_TOTP_ENABLED`, `ADMIN_LOGIN` ×3 (totp-setup, backup-code, totp), `ADMIN_BACKUP_CODE_USED`, `DISPUTE_VIEWED` · logout puis `/admin/me` 401.

### Reste
C-PR2 médiation (version du Voyageur, décisions rejet / partiel / total / compensation / restitution, argent par l'exécuteur D49, `booking.dispute_resolved`, écrans des deux rôles) → C-PR3 signalements → C-PR4 paramètres → C-PR5 billets. Rendre le check `TypeScript (admin-ui)` requis sur `dev`.

# C-PR2 — `feat/c2-mediation` : la médiation de bout en bout (D55, A102–A104)

## Ce qui a été fait

1. **Prisma** : `DisputeStatus` OPEN → CARRIER_RESPONDED → RESOLVED ; `Dispute` + version du Voyageur (`carrierStatement`, `carrierStatementPhotoUrls`, `carrierRespondedAt`) et résolution (`resolutionOutcome/RefundCents/CarrierPayoutCents/Reason`, `resolvedByAdminId`, `resolvedAt`) ; `Booking` + arbitrage de retenue (`retentionDecisionReason/DecidedAt/DecidedByAdminId`, `retentionDisposition` accepte `SHIPPER`) ; compteurs internes `CarrierPage.disputesLostCount`, `User.shipperDisputesLostCount`.
2. **Contrats** : `DISPUTE_RESPONSE_DELAY_HOURS` = 72, `DisputeResolutionOutcome`, `RetentionArbitrationOutcome`, `DisputeResolutionView`, `CarrierDisputeStatementRequest/Response`, `CarrierDisputeView` (ticket, catégorie, `canRespond`, échéance, `respondedAt`, résolution), `RetentionDecisionView` ; `ShipperDisputeView` + `carrierRespondedAt` + `resolution` ; les deux vues + `retentionDecision`, l'Expéditeur + `retentionCents` ; `BookingTransitionAction` + `resolveDisputeKeep` / `resolveDisputeRefund` ; événements `booking.dispute_carrier_responded`, `booking.dispute_resolved` ; admin : `AdminResolveDisputeRequest`, `AdminResolveRetentionRequest`, `AdminResolutionResponse`, `AdminDisputeFile` + version, échéance, `canDecide`, `decidableAt`, `proposedAmounts`, résolution, `disputesLostCount` par partie ; file + `carrierResponded`, `decidableAt`.
3. **Machine** : DISPUTED → COMPLETED (`resolveDisputeKeep`, ADMIN) et DISPUTED → CANCELLED (`resolveDisputeRefund`, ADMIN) ; `canRate` refuse `completedBy: "ADMIN"` ; spec S4 réécrite (13) + S12 (+1).
4. **`deal-mediation.service.ts`** : purs `computeResolutionMoney` (rejet / partiel borné / total ; les trois flux se somment au total), `disputeResponseDeadline`, `isDisputeDecidable`, `disputeLoser` (spec 12) ; `respond` (Voyageur, une fois, transaction dossier + outbox), `resolveDispute` (garde machine, décidable, remboursement d'abord, transaction, exécuteur, réputation), `resolveRetention` (compensation prorata ou restitution). Contrôleur + routes `POST /deals/:id/dispute/statement`, `POST /admin/disputes/:id/resolve`, `POST /admin/disputes/:id/retention`. `executePayout` lit `payoutAmountCents` d'abord ; `wallet.service` idem ; `getDeal` charge le dossier dès qu'un ticket existe ; mapper : `dispute` Voyageur, résolution des deux côtés, `retentionDecision`, `rating: null` après médiation ; `admin-dispute.service` enrichi (spec +3). OpenAPI régénéré (tag admin).
5. **notification-service** : matrices (in-app `dispute_resolved` BOTH, `dispute_carrier_responded` NONE ; email BOTH / null), dictionnaires `disputeResolvedShipper/Carrier` FR/EN (issue, montant du lecteur, motif, recours), email d'ouverture au Voyageur réécrit (« donne ta version dans l'app, 72 h », CTA « Donner ma version »).
6. **user-ui** : Voyageur — `DisputeStatementCard` (formulaire ≥ 50 caractères, ≤ 5 photos upload direct `deals/dispute/`, états envoyée / délai passé), types + adapter + `submitDisputeStatement` ; les deux rôles — `MediationDecisionCard` partagée (issue, montant qui concerne le lecteur, motif, date, recours mailto) posée sur les écrans COMPLETED et CANCELLED (tracker Expéditeur, `DealSettledView` et `DealClosed` Voyageur) ; Expéditeur — « {prénom} a donné sa version / version demandée (72 h) » dans le processus ; namespace `mediation` FR/EN + `bookingTracker.disputed.carrierSide` ; copie in-app `booking_dispute_resolved`.
7. **admin-ui** : file avec colonne « Décision » (version reçue / attend N h / sans réponse) ; dossier + bandeau d'échéance, version du Voyageur et ses photos, « litiges perdus » par partie, décision rendue ; `DecisionForm` (issue, montant partiel borné, motif ≥ 50, récapitulatif des flux, validation irréversible, retenue à deux issues aux montants serveur).
8. **Seed** : `bzv-held` (annulation après le départ, retenue 50 % « à arbitrer »).

### Preuves
deal-service **440** (+16) · notification 78 (fixture + matrices 20) · auth 80 · trip 198 · tsc ×7 · builds deal, auth, notification, admin-ui · miroir i18n (26 namespaces) · **smoke test réel sur bundles (fournisseur FAKE)** : Expéditeur refusé sur la version (403) · version trop courte 400 · version Voyageur 201 puis 409 · Expéditeur voit `carrierRespondedAt` sans le contenu · file : « version reçue » / échéance J+72 h · décision sans version avant l'échéance 409 (`decidableAt`) · partiel hors bornes 400 · **PARTIAL 1500** → COMPLETED, remboursé 1500, versé 1300 (SENT), seconde décision 409, dossier sorti de la file, `rating: null` des deux côtés, portefeuille 1300, outbox `dispute_carrier_responded` + `dispute_resolved` + `payout_sent`, `AdminAction DISPUTE_RESOLVED` · **REJECTED** sur le second litige → net entier 4000 SENT, compteur Expéditeur « litiges perdus » = 1. Bug attrapé par ce smoke : garde `resolvedAt: null` sur champ absent (5e occurrence du pitfall) et `increment` sur compteur absent → corrigés.

### Reste
C-PR3 signalements (endpoint `Report`, boutons in-app, file, masquage d'avis) → C-PR4 paramètres audités → C-PR5 billets. Relance du Voyageur muet (cron) si la recette le demande. Réparation manuelle documentée d'un remboursement parti sans transaction (journal).

# C-PR3 — `feat/c3-admin-users` : profils admin, utilisateurs, sanctions, sessions, Sentry (D56, A105–A107)

## Ce qui a été fait

1. **Prisma** : `AdminRole` (SUPER_ADMIN | MEDIATOR | SUPPORT | FINANCE) et `AccountStatus` (ACTIVE | RESTRICTED | SUSPENDED) ; `User` + `adminRole`, `invitedByAdminId`, `adminInvitedAt`, `accountStatus`, champs de sanction (`suspensionReason/Until`, `suspendedAt/ByAdminId`) et de proposition (`suspensionProposed*`) ; index `accountStatus`, `adminRole`.
2. **Contrats** (`admin/admin-users.schema.ts`) : `ADMIN_PERMISSIONS` + `adminRoleAllows` (source unique, spec 5), `AdminUserSummary/Response`, `AdminUserFile` (fiche complète), `ProposeSuspension/ApplySuspension/LiftSuspension`, `InviteAdmin/AcceptAdminInvite/UpdateAdminRole`, `AdminAccount`, `AdminSessionItem`.
3. **Middlewares** (`packages/middleware`) : `isAdminAuthenticated` pose `req.adminRole` ; `requireAdminPermission(permission)` (403 explicite) ; `requireActiveAccount` (RESTRICTED / SUSPENDED → 403 `ACCOUNT_RESTRICTED`) sur `POST /trips`, `/trips/:id/publish`, `/deals`, `/deals/payment-intents` ; `isAuthenticated` refuse un SUSPENDED (401 `ACCOUNT_SUSPENDED`) ; login utilisateur refusé (« Account suspended », copie dédiée dans `LoginForm`).
4. **auth-service** : `admin-emails.ts` (FR/EN : invitation, accès accordé, alerte de connexion, restreint, suspendu, rétabli) ; `admin-users.service.ts` (recherche 5A, fiche 4A avec lectures croisées trips / bookings / journal / sessions Redis, deals en cours) ; `admin-users.controller.ts` (propose / apply / lift : transaction + journal, révocation des sessions, emails membre et support) ; `admin-admins.controller.ts` (liste, invitation → compte sans rôle client + jeton Redis 48 h + email, profil, retrait avec gardes « dernier SUPER_ADMIN » et « soi-même », acceptation publique par jeton avec règles de mot de passe) ; sessions admin (liste, révocation) + alerte email à chaque session ; `adminRole` dans le JWT et `/admin/me` ; un compte sans profil ou sans mot de passe ne se connecte pas à l'admin. Routes sous permission.
5. **deal-service** : `assertNotParty` (conflit d'intérêts, spec 2) sur les deux décisions ; routes de décision sous `disputes.decide`. **trip-service** : recherche exclut les trajets des comptes SUSPENDED (`user.is.accountStatus not`).
6. **admin-ui** : `permissions.ts` (miroir), navigation par permission, `/users` (recherche), `/users/[id]` (fiche + carte Sanction : proposer / appliquer / modifier / lever selon le profil, jamais sur soi), `/admins` (liste, profil, retrait, invitation), `/sessions` (liste, révocation), `/invite` (mot de passe par jeton) ; le formulaire de décision est masqué sans `disputes.decide`.
7. **Sentry** (`@sentry/node` 10, `@sentry/nextjs` 10) : `packages/error-handler/sentry.ts` (`initSentry`, `captureServerError`), capture dans `error-middleware.ts`, `initSentry("<service>")` dans les quatre services, `instrumentation(-client).ts` dans user-ui et admin-ui, variables `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`.
8. **Script** `grant-admin.ts <email> --role <PROFIL>` ; `.env.example` : `ADMIN_UI_URL`, Sentry.

### Preuves
auth **85** (+5 matrice) · deal **442** (+2 conflit) · trip 198 · notification 78 · tsc ×7 · builds auth, deal, trip, notification, admin-ui · OpenAPI régénéré · **smoke test réel sur bundles (emails désactivés)** : super admin par script → invitation d'un compte Support (201, aucun rôle client, `publicSlug` généré — un `null` sur un unique nullable entre en collision P2002, pitfall connu, attrapé par ce smoke) → connexion admin refusée sans mot de passe → acceptation : mot de passe contenant le nom refusé, mot de passe fort accepté, jeton rejoué refusé → Support : 2FA, profil `SUPPORT`, journal 403, comptes admin 403, recherche par ticket 200, fiche 200, proposition 200, application 403, viser un admin 403 → super admin voit la proposition (« Sami D. »), applique RESTRICTED → membre : login 200 mais `POST /deals/payment-intents` 403 `ACCOUNT_RESTRICTED` → SUSPENDED → session existante 401, login « Account suspended », trajets Paris → Brazzaville passés de 2 à 0 dans la recherche → levée → login 200 → agir sur soi-même 403, rétrograder le dernier super admin 403 → sessions listées, retrait du Support → sa session tombe (403) → journal : `ADMIN_INVITED`, `ADMIN_INVITE_ACCEPTED`, `ADMIN_LOGIN`, `USER_VIEWED`, `USER_SUSPENSION_PROPOSED`, `USER_RESTRICTED`, `USER_SUSPENDED`, `USER_REINSTATED`, `ADMIN_REVOKED`.

### Reste
C-PR4 trajets et billets → C-PR5 finances → C-PR6 pilotage (KPI, alertes de seuil, « tout ce qui est arrivé à ce deal ») → C-PR7 signalements et anti-fraude → C-PR8 paramètres, RGPD, maintenance. Sentry sur le gateway (alias `@packages` à ajouter à son webpack), source maps front (`withSentryConfig`) quand un projet Sentry existera.

# C-PR4 — `feat/c4-admin-trips` : trajets, masquage, billets, KPI d'accueil (D57, A108–A110)

## Ce qui a été fait

1. **Prisma** : `Trip` + `hiddenByAdminAt`, `hiddenReason`, `hiddenByAdminId` (masquage), `hideProposedReason/ByAdminId/At` (proposition du Support), index `hiddenByAdminAt` ; `TripDocument` + `reviewedByAdminId`, `expiredAt`, `rejectionReason` désormais un motif fermé ; `TripDocumentStatus` + `EXPIRED`. `npx prisma db push` requis.
2. **Contrats** (`admin/admin-trips.schema.ts`) : `TicketRejectionReason` (ILLEGIBLE | DATES_MISMATCH | NAME_MISMATCH | SUSPICIOUS), `AdminTripSummary/Response`, `AdminTripFile`, `TicketQueueItem/Response`, `ReviewTicketRequest` (refine : un rejet exige un motif), `HideTripRequest` (motif ≥ 20), `AdminHomeKpis` (14 compteurs nullables). Permissions ajoutées à `ADMIN_PERMISSIONS` : `trips.read` (tous), `tickets.review` (SUPPORT, MEDIATOR), `trips.hide.propose` (SUPPORT, MEDIATOR), `trips.hide.apply` (MEDIATOR), `kpi.read` (tous) — SUPER_ADMIN partout. `TripDocumentStatusSchema` + `EXPIRED`. Journal : `TRIP_VIEWED`, `TRIP_HIDE_PROPOSED`, `TRIP_HIDDEN`, `TRIP_UNHIDDEN`, `DOCUMENT_VIEWED`, `TICKET_VERIFIED`, `TICKET_REJECTED`, cible `TRIP`.
3. **trip-service** (propriétaire du Trip) : `routes/admin.router.ts` monté sur `/admin` (`isAdminAuthenticated` + `requireAdminPermission`) ; `controllers/admin-trips.controller.ts` — liste filtrable (`q` ville ou id, `status`, `hidden`, `ticketPending`, `carrierId`, `from`, réservations actives par `groupBy`), fiche (Voyageur avec état du compte, réservations et montants, documents, journal du trajet ; lecture journalisée), `hide/propose`, `hide` (transaction : champs + journal ; puis email générique au Voyageur), `DELETE hide` (motif obligatoire, email « de nouveau visible »), file des billets (expire à la lecture, A109), ouverture d'un billet (journal `DOCUMENT_VIEWED`, 7A), décision (transaction document + `ticketVerificationStatus` + journal, verrou `status: PENDING`, email vérifié / rejeté avec le libellé du motif). Conflit d'intérêts : 403 sur son propre trajet ou son propre billet. `lib/admin-trips.rules.ts` (pur, testé) : `notHiddenFilter`, `ticketReviewOutcome`, `isTicketExpired`, libellés des motifs. `emails/admin-trip-emails.ts` (FR/EN, D44). Effets par lecture : recherche (`buildBaseWhere` + `notHiddenFilter()`), page publique (404 si masqué), `addDocuments` fait repasser un billet REJECTED en PENDING au redépôt. Webpack : alias `@packages/email`, `@packages/admin-audit`.
4. **deal-service** : `checkTripBookable` refuse un trajet masqué (`TRIP_NOT_BOOKABLE`), `TRIP_SELECT` lit `hiddenByAdminAt` (spec +1).
5. **auth-service** : `GET /admin/kpis` (`admin-kpis.controller.ts`, `kpi.read`) — 14 `count` en parallèle, chacun conditionné à la permission de sa file (litiges, retenues, billets, masqués, propositions de masquage, sanctions proposées, comptes restreints / suspendus, trajets publiés à venir, deals en cours, versements en échec, invitations admin en attente, comptes, deals terminés 30 j), `null` = non visible. Spec permissions +2.
6. **gateway** : `/api/admin/trips/*` et `/api/admin/tickets/*` → trip-service `:6002` (`/admin/…`).
7. **admin-ui** : `/home` (nouvelle page d'atterrissage : tuiles « À traiter » ambrées quand > 0, « État de la plateforme », chaque tuile ouvre sa file), `/tickets` (file : ouvrir, valider, rejeter avec motif), `/trips` (filtres, badges « masqué » / « masquage proposé », `carrierId` et `hideProposed` depuis l'URL), `/trips/[id]` (fiche + carte Masquage : proposer / masquer / rétablir selon le profil, jamais sur son propre trajet), lien « Ouvrir dans Trajets » sur la fiche utilisateur, navigation par permission, libellés du journal.
8. **user-ui** : bandeau « Trajet masqué par Yamba » sur le détail du trajet du Voyageur (`myTrips.detail.hiddenByAdmin`, FR/EN).
9. **OpenAPI** trip-service : tag `admin`, 7 chemins, schéma de sécurité `adminCookieAuth` ; régénéré (27 chemins, 193 schémas).
10. **Seed** `seed-deals.ts` : un billet PENDING sur le premier trajet à venir (`bzv-upcoming`) pour alimenter la file en recette (nettoyé par `fileId` `seed-ticket-*`).

### Preuves
trip **202** (+4 règles) · deal **443** (+1 masqué non réservable) · auth **87** (+2 matrice C-PR4) · notification 78 · tsc ×6 + admin-ui + user-ui · miroir i18n parfait · OpenAPI régénéré. Recette à jouer : ADM21–ADM30 (DOC-METIER).

### Reste
C-PR5 finances → C-PR6 pilotage (courbes, corridors, alertes de seuil, cache des KPI si besoin) → C-PR7 signalements et anti-fraude (détection de doublons de billets, identité forte) → C-PR8 paramètres, RGPD, maintenance. Backlog : `x-permission` par opération dans l'OpenAPI ; visionneuse de billet intégrée (aujourd'hui : nouvel onglet ImageKit).

# C-PR5a — `feat/c5a-admin-finances` : files d'exception, fiche argent, rapprochement, rejeu, renversements (D58, A111–A113)

## Ce qui a été fait

1. **Prisma** (`Booking`) : `refundId` ; `payoutNextRetryAt`, `payoutLastAttemptAt` (rejeux espacés, A111) ; `payoutIdempotencyKey` (re-versement après renversement, A113) ; `payoutReversalResolution / Reason / ResolvedAt / ResolvedByAdminId` (clôture d'un renversement). `npx prisma db push` requis.
2. **Contrats** (`admin/admin-finances.schema.ts`) : `FinanceQueueKind` (FAILED | REVERSED | HELD), `FinanceQueueItem/Response`, `PayoutFailureKind`, `AdminDealMoneyFile` (prix figé, paiement, versement, retenue, dates, chronologie `MoneyTimelineEvent`, journal, `allowedActions`), `PaymentReconciliation` + `ReconciliationDivergenceCode`, `RetryPayoutResponse`, `ResolveReversalRequest/Response` (motif ≥ 20). `AdminHomeKpis` + `payoutsReversed`. Permissions : `finances.read`, `payouts.retry`, `payouts.resolve` (FINANCE, MEDIATOR). Journal : `DEAL_MONEY_VIEWED`, `DEAL_RECONCILED`, `PAYOUT_RETRIED`, `PAYOUT_REVERSAL_RESOLVED` (cible `BOOKING`).
3. **`@packages/payments`** : `PaymentProvider.inspect` (`PaymentInspection` : statut, montants autorisé / encaissé, charge, remboursements, transfert avec `reversedCents`) — Stripe (`paymentIntents.retrieve`, `refunds.list`, `transfers.retrieve`) et Fake (mémoire : remboursements mémorisés, `_reverseTransferForTest`).
4. **deal-service** : `services/admin-finance.rules.ts` (pur, spec 10) — `payoutRetryDelayMs` / `nextPayoutRetryAt` / `payoutRetryDueFilter`, `payoutFailureKind` / `payoutFailureDetail` (message brut réservé à l'admin, A75), `buildMoneyTimeline`, `reconcile`, `maskAccountId` ; `services/admin-finance.service.ts` (spec 10) — files (lecture « absent OU null » pour la clôture), fiche (journalisée), rapprochement (journalisé, jamais d'écriture), `retryPayout` (conflit d'intérêts, état, exécuteur unique, journal), `resolveReversal` (transaction : garde optimiste `REVERSED` non clos + clôture + journal ; RESENT → nouvelle clé puis exécuteur) ; `controllers/admin-finance.controller.ts` ; routes `/admin/finances/queue`, `/admin/deals/:id/money`, `…/money/reconcile`, `…/payout/retry`, `…/payout/reversal`. **Exécuteur** (`deal-settlement.service.ts`) : plus de `PAYOUT_MAX_ATTEMPTS`, `markPayoutFailed(…, now)` pose le compteur (lu puis écrit), l'horodatage et la prochaine relance, `executePayout` honore `payoutIdempotencyKey` et efface `payoutNextRetryAt` à l'envoi, `retryFailedPayouts` filtre sur l'échéance, `markTransferReversed` remet la clôture à null, `collectOpsDigest` exclut les renversements clos. **`refundId`** écrit aux quatre sites (`deal-transport` refus au pickup, `deal-lifecycle` annulation, `deal-mediation` décision et restitution). **Digest** (`ops-notify.service.ts`) : lignes vers `ADMIN_UI_URL/deals/:id`, lien vers `/finances`.
5. **auth-service** : KPI `payoutsFailed` sous `finances.read`, nouveau `payoutsReversed` (renversements non clos). Spec permissions +1.
6. **gateway** : `/api/admin/finances/*`, `/api/admin/deals/*` → deal-service `:6003`.
7. **admin-ui** : `/finances` (trois onglets, « Relancer » sur les échecs si `payouts.retry` et non partie, « Décider » vers la fiche, « Arbitrer » vers la médiation), `/deals/[id]` (fiche argent : prix figé, parties et compte Stripe masqué, paiement avec identifiants, versement et geste « Relancer », formulaire de clôture d'un renversement « Re-verser » / « Abandonner », chronologie, bouton « Rapprocher maintenant » avec état réel et divergences libellées, dates, journal), entrée « Finances » sous `finances.read`, tuiles d'accueil « Versements en échec » → `/finances?kind=FAILED` et « Transferts renversés » → `/finances?kind=REVERSED`, liens « argent » depuis la fiche utilisateur, la fiche trajet et le dossier de médiation, libellés (`PAYOUT_STATUS_LABEL`, `PAYOUT_FAILURE_LABEL`, `TIMELINE_LABEL`, `DIVERGENCE_LABEL`).
8. **OpenAPI** deal-service : 5 chemins `admin`, `adminCookieAuth` ; régénéré. **Seed** : `bzv-reversed` (COMPLETED, transfert renversé), `bzv-completed-blocked` avec relance échue.

### Preuves
deal **464** (+10 règles, +10 service, +1 Fake `inspect`, 5 assertions adaptées : compteur lu-écrit, filtre d'échéance, clôture à null, `refundId`) · auth **88** (+1) · trip 202 · notification 78 · tsc ×6 + admin-ui · miroir i18n OK · OpenAPI régénéré. Recette : FIN01–FIN10 (DOC-METIER).

### Reste
C-PR5b : rapport mensuel par devise, export CSV journalisé (`finances.export`), remboursement manuel (`refunds.manual.propose` / `apply`, SUPER_ADMIN). Backlog : frais Stripe du `balance_transaction` (deals à marge négative), cache Redis des KPI, `x-permission` OpenAPI.

# C-PR5b — `feat/c5b-admin-finances-report` : rapport mensuel, export CSV, remboursement manuel (D58, A114–A116)

## Ce qui a été fait

1. **Prisma** (`Booking`) : `manualRefundProposedCents / Reason / ByAdminId / At` (proposition), `manualRefundCents / Reason / ByAdminId / At` (dernier appliqué ; le cumul reste `refundAmountCents`). `npx prisma db push` requis.
2. **Contrats** : `FinanceQueueKind` + `PROPOSED_REFUNDS` ; `AdminDealMoneyFile.manualRefund` (plafond, proposition, dernier) et `allowedActions.proposeRefund / applyRefund` ; `FinanceReportMonth`, `FinanceSnapshot`, `FinanceReport` ; `ManualRefundRequest` (montant ≥ 1, motif ≥ 50) / `ManualRefundResponse` ; `AdminHomeKpis.manualRefundProposals`. Permissions : `finances.export` (FINANCE), `refunds.manual.propose` (FINANCE, SUPPORT), `refunds.manual.apply` (aucun profil : SUPER_ADMIN seul). Journal : `FINANCE_EXPORTED`, `REFUND_MANUAL_PROPOSED`, `REFUND_MANUAL_APPLIED`.
3. **deal-service** — `admin-finance.rules.ts` (+5 tests) : `monthStartUtc`, `monthKey`, `buildFinanceReport` (A114), `buildFinanceSnapshot`, `csvCell` / `csvRowInRange` / `buildFinanceCsv` (A115), `manualRefundBounds` (A116). `admin-finance.service.ts` (+5 tests) : `getReport` (deux lectures : faits datés depuis le début de période, passifs du jour), `exportCsv` (borne 366 j, filtre par fait, journal), `proposeManualRefund` (transaction proposition + journal), `applyManualRefund` (D39 : `provider.refund` puis `applyBookingTransition` conditionnel sur le cumul, `refundId`, outbox `booking.refund_issued` acteur ADMIN, journal `within`) ; file `PROPOSED_REFUNDS`. Contrôleur : `getReport`, `exportCsv` (`text/csv`, BOM, `Content-Disposition`, `X-Row-Count`), `proposeRefund`, `applyRefund`. Routes `/admin/finances/report`, `/admin/finances/export`, `/admin/deals/:id/refund/propose`, `/admin/deals/:id/refund`. **Portefeuille** (`wallet.service.ts`, +1 test) : COMPLETED avec remboursement → `PARTIALLY_REFUNDED` / `REFUNDED` (médiation partielle C-PR2 et geste C-PR5b visibles par l'Expéditeur).
4. **auth-service** : KPI `manualRefundProposals` (`finances.read`). Spec permissions +1.
5. **admin-ui** : `/finances` + onglet « Remboursements proposés » et lien « Rapport mensuel et export » ; `/finances/report` (`FinanceReportView` : passifs du jour, tableau par mois et devise, export CSV par période sous `finances.export`, téléchargement direct via `/api`) ; fiche argent : carte « Remboursement manuel » (plafond, proposition, dernier ; « Proposer » sous `refunds.manual.propose`, « Rembourser maintenant » sous `refunds.manual.apply`) ; tuile « Remboursements proposés » ; libellés du journal.
6. **OpenAPI** deal-service : 4 chemins (24 au total, 210 schémas), régénéré.

### Preuves
deal **475** (+11 : 5 règles, 5 service, 1 portefeuille) · auth **89** (+1) · trip 202 · notification 78 · tsc ×6 + admin-ui · miroir i18n OK · OpenAPI régénéré. Recette : FIN11–FIN18 (DOC-METIER).

### Reste
C-PR6 pilotage (courbes, corridors, alertes de seuil, cache des KPI) → C-PR7 signalements et anti-fraude → C-PR8 paramètres, RGPD, maintenance. Backlog finances : frais Stripe du `balance_transaction` (marge par deal), filtres d'export (corridor, statut), grand livre quand l'expert-comptable le demandera.

# C-PR6a — `feat/c6a-admin-pilotage` : courbes, corridors, chronologie d'un deal, compteurs de demande (D59, A117–A119)

## Ce qui a été fait

1. **Contrats** (`admin/admin-pilotage.schema.ts`) : `PilotageGranularity`, `PilotageSeriesPoint/Response` (totaux : comptes, Voyageurs prêts, trajets à venir ; `cached`), `CorridorStat` / `CorridorsResponse` (trajets, demandes, taux d'acceptation, prix moyen au kilo, litiges, vues, recherches, sans résultat), `DealHistoryEvent/Response` (source, relais, whitelist). `viewsCount` optionnel sur `YambaTripResult` et `PublicTrip`. Permissions `pilotage.read` (FINANCE, MEDIATOR), `deals.history.read` (MEDIATOR, SUPPORT, FINANCE). Journal `DEAL_HISTORY_VIEWED`.
2. **`packages/libs/redis/trip-stats.ts`** (A118) : `normalizeCity`, `corridorKey`, `dayKey`, clés, `viewerKey` (empreinte), `recordTripView` (SET NX + INCR), `recordSearch` (+ SET des corridors), `tripViews` (MGET), `dayKeysBack`, `corridorStats` (un MGET), `searchedCorridors`. Spec dans le trip-service (`lib/trip-stats.spec.ts`, faux Redis en Map, 5 tests).
3. **trip-service** : `getPublicTrip` compte la vue (visiteur = utilisateur ou empreinte) et sert `viewsCount` ; la recherche pose `viewsCount` sur les cartes (MGET) et compte la recherche par corridor (`hadResults` = `totalCount > 0`). Toute erreur Redis avalée.
4. **user-ui** : `viewsCount` sur les cartes (desktop : icône œil + nombre ; mobile : « · 👁 n ») et sous le titre du détail public (« n vues »), clés `search.views` et `tripDetail.views` (FR/EN, pluriel ICU).
5. **auth-service** : `lib/pilotage.rules.ts` (pur, 4 tests) — semaine ISO (`isoWeekStart`, `isoWeekKey`), `periodsBetween` (périodes vides incluses), `buildSeries` (A117), `buildCorridors` (corridors des trajets + des deals + cherchés sans offre, taux, prix moyen au kilo depuis `pricePerKgCents` sinon `transportCents / weightKg`) ; `controller/admin-pilotage.controller.ts` — `GET /admin/pilotage/series?granularity&months`, `GET /admin/pilotage/corridors?days`, cache Redis 60 s (`cached` dans la réponse), lectures croisées (User, Trip, Booking, CarrierPage), compteurs Redis. Routes sous `pilotage.read`. Spec permissions +1.
6. **deal-service** : `services/admin-history.service.ts` (A119) — `whitelistPayload`, `mergeDealHistory` (pur, 2 tests), `getDealHistory` (outbox, journal, notifications, emails, noms d'admin, rôles, journal) ; contrôleur + route `GET /admin/deals/:id/history` (`deals.history.read`). OpenAPI : chemin `history` + **correction** des 10 chemins C-PR5a/5b mal placés (34 chemins, 14 admin, 218 schémas).
7. **admin-ui** : `/pilotage` (`PilotageView` : tuiles totaux, sélecteurs semaine / mois et durée, petits multiples SVG à une série avec survol et dernier point étiqueté, vue tableau, tableau des corridors avec badge « demande sans offre ») ; fiche argent : carte « Tout ce qui est arrivé à ce deal » chargée à la demande (sources colorées, état de relais, parqués en rouge) ; entrée « Pilotage » sous `pilotage.read`.

### Preuves
trip **207** (+5) · deal **477** (+2) · auth **94** (+5) · notification 78 · tsc ×6 + admin-ui + user-ui · miroir i18n OK · OpenAPI régénéré (deal 34 chemins). Recette : PIL01–PIL08 (DOC-METIER).

### Reste
C-PR6b : alertes de seuil (cron horaire deal-service, règles en constantes, accueil + digest). Puis C-PR7 signalements et anti-fraude, C-PR8 paramètres, RGPD, maintenance. Backlog : événements de trajet (outbox trip-service), réparation d'un événement parqué depuis l'écran, PostHog (D5), petits multiples alignés pour comparer deux mesures.

# C-PR6c — `feat/c6c-admin-pilotage-v2` : courbes agrandies, drill-down, finances du pilotage, popularité web (D60, A120–A122)

## Ce qui a été fait
1. **Contrats** : `PilotageSeriesPoint.finance[]` (par devise : encaissé, remboursé, versé, revenu, retenues), `PilotageMetric`, `PilotageDrilldownItem/Response` (200 max, `truncated`). Journal `PILOTAGE_DRILLDOWN_VIEWED`.
2. **auth-service** : `pilotage.rules.ts` — `periodBounds` (inverse de `periodKey`, mois 1..12 validé), `buildSeries` étendu aux finances (+2 tests) ; `admin-pilotage.controller.ts` — sélection élargie (remboursement, versement, retenue), `getPilotageDrilldown` (comptes / trajets / deals selon la mesure, champ de date par mesure, filtres de statut, montant par mesure, journal pour les inscriptions) ; route `GET /admin/pilotage/drilldown` (`pilotage.read`).
3. **admin-ui** `PilotageView` : onglets Activité / Finances (sélecteur de devise), deux courbes par ligne (220 px) avec « Agrandir », vue agrandie (360 px, tableau période / valeur / variation, panneau des éléments avec liens vers fiches), courbes avec libellés de période espacés, axe en unités monétaires sur l'onglet Finances.
4. **user-ui** : `lib/trip-signals.ts` (`POPULAR_VIEWS` = 20, `isPopular`), pastille « n vues » dans la rangée des badges (desktop, mobile) et barre de signaux du détail public (vues, « Populaire », billet vérifié), clés `badges.popular` (search, tripDetail, FR/EN).

### Preuves
auth **96** (+2) · deal 477 · trip 207 · notification 78 · tsc ×6 + admin-ui + user-ui · miroir i18n OK · OpenAPI régénéré. Recette : PIL09–PIL14 (DOC-METIER).

### Reste
C-PR3bis profils cumulés (D60 1A) → C-PR7a recherches et exports (D60 2A) → C-PR6b alertes → chantier F chat.

# C-PR3bis — `feat/c3bis-admin-roles` : profils admin cumulés (D60 1A, A123–A125)

## Ce qui a été fait
1. **Prisma** : `User.adminRoles AdminRole[] @default([])` + index ; `adminRole` conservé comme miroir du profil principal. `npx prisma db push` puis `backfill-admin-roles.ts` (idempotent) pour les comptes existants.
2. **Contrats** : `AdminRolesSchema` (1..4), `normalizeAdminRoles`, `adminRolesAllow` (union), `primaryAdminRole`, `adminRolesOf` (lecture tolérante) ; `adminRoles` sur `AdminUserSummary`, `AdminUserFile`, `AdminAccount` ; `InviteAdminRequest.adminRoles`, `UpdateAdminRoleRequest.adminRoles` (liste complète, remplace). Spec permissions +3.
3. **Middlewares** : `isAdminAuthenticated` pose `req.adminRoles` (liste vide → `[adminRole]`) ; `requireAdminPermission` lit la liste.
4. **auth-service** : `utils/admin-roles.ts` (`adminRolesData`, `NO_ADMIN_ROLES`, `superAdminCount` liste OU miroir, `isSuperAdmin`) ; `admin-admins.controller` (invitation à plusieurs profils, email « Médiateur + Finance », changement = liste complète, garde « dernier SUPER_ADMIN » sur la liste, retrait vide la liste, liste des comptes liste OU miroir) ; JWT et `/admin/me` avec `adminRoles` ; sanctions : un compte admin (n'importe quel profil) n'est visé que par un SUPER_ADMIN ; KPI par union ; `admin-users.service` sert `adminRoles`. Script `grant-admin.ts --roles MEDIATOR,FINANCE`.
5. **admin-ui** : `can(roles | role, permission)`, `isSuperAdmin`, `rolesLabel`, `ADMIN_ROLES` ; « Comptes admin » avec cases à cocher (invitation et modification par ligne, au moins un profil, indices par profil) ; libellés cumulés dans le menu, la fiche et la recherche utilisateurs ; garde super admin sur la fiche.

### Preuves
auth **99** (+3) · deal 477 · trip 207 · notification 78 · tsc ×6 + admin-ui · OpenAPI régénéré (A125). Recette : ADM31–ADM36 (DOC-METIER).

### Reste
C-PR7a recherches poussées et exports encadrés (D60 2A) → C-PR6b alertes de seuil → chantier F chat.

# C-PR7a — `feat/c7a-admin-search-exports` : recherches poussées et exports encadrés (D60 2A, A126–A128)

## Ce qui a été fait
1. **`packages/libs/csv`** (A127) : `csvCell`, `buildCsv(columns, rows)`, `CSV_BOM`, `csvFilename`. **Contrats** : `AdminUsersQuery` (q, role, accountStatus, carrierStatus, stripeReady, createdFrom/To, sort, dir, cursor, limit ≤ 100), `AdminTripsQuery` (+ to, originCity, destinationCity, hideProposed, sort createdAt/publishedAt/departureAt, cursor), `TicketQueueQuery` (villes, période de dépôt, olderThanDays), `ArbitrationQueueQuery` (kind, villes, olderThanDays, decidable) ; `nextCursor` sur les réponses listes ; permissions `exports.operational` (FINANCE, MEDIATOR), `exports.personal` (SUPER_ADMIN) ; journal `EXPORTED` ; `EXPORT_REASON_MIN_LENGTH` = 20.
2. **auth-service** : `lib/admin-users.query.ts` (`buildUsersWhere`, `buildUsersOrderBy`, `USERS_CSV_COLUMNS` ; spec 4) ; `searchAdvanced` (curseur, total) et `exportRows` (5 000, Stripe prêt via `carrierPage`) ; `GET /admin/users` filtré, `GET /admin/users/export` (motif, journal) déclaré avant `/:id`.
3. **trip-service** : `admin-trips.rules.ts` + `buildTripsWhere` / `buildTripsOrderBy` / `buildTicketsWhere` (spec +2) ; `listTrips` validé par contrat avec curseur ; `listTickets` filtré ; `exportTrips`, `exportTickets` (identifiants seulement) ; routes `/trips/export`, `/tickets/export` avant `/:id`.
4. **deal-service** : `filterQueueItems` (pur, spec +1) appliqué par `listQueue(q)` (compteurs de la file entière conservés) ; `exportRows` (ids des parties) ; `GET /admin/disputes/export` avant `/:id`.
5. **admin-ui** : `ExportButton` (opérationnel : téléchargement direct ; personnel : panneau avec motif ≥ 20, SUPER_ADMIN seul), `apiUrl` ; `UsersSearch` (rôle, état, Stripe prêt, période d'inscription, tri, « Charger la suite »), `TripsList` (origine, destination, période de départ, masquage proposé, tri, curseur), `TicketsQueue` (villes, âge), `QueueTable` (type, villes, âge, décidables), permissions miroir, libellé `EXPORTED`.
6. **user-ui** : plugin Tailwind `line-clamp` retiré (avertissement au démarrage).

### Preuves
auth **103** (+4) · trip **209** (+2) · deal **478** (+1) · notification 78 · tsc ×6 + admin-ui · miroir i18n OK · OpenAPI régénéré. Recette : ADM37–ADM44 (DOC-METIER).

### Reste
C-PR6b alertes de seuil (D59 3A / 4A) → chantier F chat (challenge) → C-PR8 paramètres, RGPD (export / effacement d'un compte), maintenance.

# F-PR1 — `feat/f1-message-service` : le message-service (D61, A132–A134)

## Ce qui a été fait
1. **Nouveau service** `apps/message-service` (port 6005, A18) : Express, Sentry en première ligne, identifiant de corrélation, middleware d'erreurs commun, `/health`, `/openapi.json`, arrêt propre. Configuration calquée sur le notification-service (package.json Nx, trois tsconfig, jest, webpack avec les alias explicites AVANT la générique).
2. **Prisma** : `Conversation` (une par deal, dates de lecture par rôle), `Message` (TEXT / SYSTEM / MEETUP, `photoUrls` toujours posé `[]`, `systemKey` + `systemData` pour l'i18n, `flaggedContact`), `Meetup` (kind, status, proposition, créneau), `PhoneReveal` (unique par conversation et lecteur) + trois enums. `npx prisma db push` requis.
3. **Contrats** (`messaging/messaging.schema.ts`) : `ConversationSummary`, `ConversationThreadResponse`, `Message`, `Meetup`, `ConversationAccess`, `PostMessageRequest`, `ProposeMeetupRequest`, `QuickReply`, `RevealPhoneResponse` ; (`messaging-events.schema.ts`) union discriminée des quatre événements de conversation, enveloppe identique à celle des deals.
4. **Règles pures + tests (14)** : `conversation.rules.ts` (fenêtre d'écriture, rôle, contrepartie), `message-guard.rules.ts` (groupes de six chiffres, coordonnées, normalisation), `meetup.rules.ts` (créneau, acceptation par l'autre partie, prochain rendez-vous), `phone-reveal.rules.ts` (ancre et fenêtre de deux heures), `quick-replies.ts` (catalogue FR/EN, mêmes clés).
5. **Service** `conversation.service.ts` : contexte (deal lu, conversation créée à la demande, 403 pour un tiers), `list`, `thread` / `threadByDeal` (pagination vers les messages plus anciens), `markRead`, `postMessage` (gardes A133 puis transaction message + horodatage + outbox), `proposeMeetup` (contre-proposition qui annule la précédente), `acceptMeetup` (verrou optimiste), `revealPhone` (fenêtre, trace, message système).
6. **Relais dédié** `messaging-relay.ts` (A132) : bail `messaging-relay`, drain filtré `aggregateType: "conversation"`, validation au contrat, publication sur `messaging-events`, parquage à dix tentatives, backoff. **Le relais du deal-service filtre désormais sur `booking`** (une ligne, plus son test).
7. **Gateway** : `/api/messages/*` → `:6005`. **OpenAPI** : quatrième document (9 chemins), ajouté au script de génération et au diff CI. **CI** : le service rejoint les matrices typecheck et tests. **Seed** : un fil vivant sur `bzv-accepted` (deux messages, un rendez-vous proposé).

### Preuves
message **14** · deal **478** (relais filtré, spec alignée) · trip 209 · auth 103 · notification 78 · tsc ×7 · OpenAPI ×4 régénérés. Recette : FCH01–FCH10 (DOC-METIER).

### Reste
F-PR2 front des deux rôles (liste des fils, conversation, rendez-vous, réponses rapides, numéro) et notifications (in-app immédiate, email de relance à 15 min) ; F-PR3 admin (lecture depuis un dossier, signalement d'un message) et purge à un an.
# C-PR6b — `feat/c6b-admin-alerts` : alertes de seuil (D59 3A / 4A, A129–A131)

## Ce qui a été fait
1. **Contrats** (`admin/admin-alerts.schema.ts`) : `OpsAlertRule` (9 règles), `OpsAlert` (règle, gravité, titre, détail, compteur, lien), `OpsAlertsResponse` (alertes, `evaluatedAt`, seuils).
2. **deal-service** : `services/ops-alerts.rules.ts` (`ALERT_THRESHOLDS`, `OpsSnapshot`, `evaluateAlerts` pur, `alertSentKey` ; spec 5) ; `services/ops-alerts.service.ts` (`collectOpsSnapshot` : dix comptages Prisma dont les litiges décidables via la règle D55, `evaluate`, `notifyNewAlerts(store)` dédoublonné par `SET NX` ; spec 2 avec un Map et un email mocké) ; `cron/ops-alerts.cron.ts` (« 5 * * * * », Redis injecté depuis `main.ts`, `OPS_ALERTS_CRON_ENABLED`) ; email `opsAlerts` FR/EN dans `ops-emails.ts` ; `GET /admin/alerts` (`kpi.read`) ; OpenAPI (+1 chemin).
3. **gateway** : `/api/admin/alerts` → deal-service. **`.env.example`** : `OPS_ALERTS_CRON_ENABLED`.
4. **admin-ui** : bandeau « Alertes de seuil » en tête de l'accueil (critique rouge / attention ambre, lien vers la file), état vert « aucune alerte », date d'évaluation.

### Preuves
deal **485** (+7) · auth 103 · trip 209 · notification 78 · tsc ×6 + admin-ui · OpenAPI régénéré. Recette : ALR01–ALR06 (DOC-METIER).

### Reste
Chantier F chat (challenge) → C-PR8 paramètres audités (seuils réglables), RGPD, maintenance.

# F-PR2 — `feat/f2-messaging-front` : la messagerie côté membres (D61, A135–A136)

## Ce qui a été fait
1. **Couche de données** (`components/dashboard/messages/`) : `messaging.types.ts` (miroir des contrats, aucune règle recalculée), `messaging.api.ts` (les neuf appels du message-service via le gateway), `hooks/useMessaging.ts` — sondage 3 s sur un fil ouvert, 20 s sur la liste, jamais en arrière-plan ; chaque mutation invalide le fil ET la liste (le dernier message et les non-lus vivent aux deux endroits).
2. **Écrans** : `ConversationsList.tsx` (fil le plus actif en haut, non-lus, prochain rendez-vous), `ConversationThread.tsx` (fil groupé par jour, bulles par rôle, messages système, réponses rapides, saisie fermée quand le serveur le dit avec le bon motif, bouton du numéro avec l'heure d'ouverture, avertissement sur le code de livraison), `MeetupPanel.tsx` (rendez-vous courant, accepter réservé à l'autre partie, proposer ou contre-proposer), `sections/Messages.tsx` (deux colonnes sur grand écran, une sur mobile) — le placeholder « la messagerie arrive bientôt » disparaît.
3. **Header** : la bulle lit `totalUnread` (elle était figée à 3 depuis le lot d'origine).
4. **i18n** : namespace `messaging` (FR/EN, 27 namespaces au total), branché dans `i18n/request.ts`.
5. **Notifications** (A136) : `messaging-events.consumer.ts` dans le notification-service, groupe et topic dédiés, notification in-app pour l'autre partie, 5 tests (claim, doublon, payload invalide, destinataire).
6. **Workspace** : référence du nouveau projet ajoutée au `tsconfig.json` racine (`nx sync`).

### Preuves
notification **83** (+5) · message 14 · deal 485 · trip 209 · auth 103 · tsc ×7 + les deux fronts · miroir i18n OK (27 namespaces). Recette : FCH11–FCH16 (DOC-METIER).

### Reste
F-PR3 : email de relance des messages non lus (15 min, un par heure et par conversation), lecture admin depuis un dossier de médiation, signalement d'un message, purge à un an. Boutons « Message » des écrans de deal : F-PR2b ci-dessous. Photos dans le fil : backlog.

---

# F-PR2b — `feat/f2b-deal-message-entry` : les écrans de deal mènent au fil (A137)

## Ce qui a été fait
1. **Un hook, sept boutons** : `useOpenDealThread()` (`apps/user-ui/src/hooks/useMessaging.ts`) expose `open(bookingId, focus?)`. Il appelle `getThreadByDeal` (le serveur crée le fil s'il manque), dépose la réponse dans le cache TanStack sous la clé du fil, puis navigue vers `/dashboard/messages?conversation=<id>` (`useRouter` de `@/i18n/navigation`, la locale est conservée). En cas d'erreur : toast, l'utilisateur reste sur sa page (403 → « la conversation s'ouvre une fois le deal accepté »).
2. **Les sept points d'appel** ne font plus un `console.info` : côté Expéditeur `BookingCarrierCard` (accepté, remis, livré, litige, terminé) et `SenderCarrierContact` (en transit) ; côté Voyageur `DealContactShipperCard` (accepté, Message + Appeler), `PickupContactCard` (remise, Message + Appeler), `TrackingShipperCard` (suivi), `DeliverHelpCard` (livraison, Écrire + Appeler — reçoit désormais `bookingId`). Les boutons se désactivent pendant l'appel.
3. **« Appeler » = le fil avec `?focus=phone`** : `Messages.tsx` lit le paramètre et `ConversationThread` affiche un bandeau ambre sous l'en-tête : numéro cliquable (`tel:`) s'il est révélé, bouton « Voir le numéro » si la fenêtre est ouverte, heure d'ouverture sinon, ou invitation à confirmer un rendez-vous s'il n'y a aucun ancrage (ni rendez-vous accepté, ni départ).
4. **i18n** : `messaging.open.*` et `messaging.phone.banner.*` (FR/EN, miroir vérifié).

### Preuves
tsc user-ui OK · miroir i18n OK (27 namespaces) · aucun test serveur touché (791 + 103 inchangés). Recette : FCH17–FCH19 (DOC-METIER).

### Reste
F-PR3 (email de relance, lecture admin depuis un dossier, signalement d'un message, purge à un an). Le numéro du destinataire dans le tracker en transit est encore un mock statique : à brancher quand le contrat Booking côté Expéditeur portera `recipient.phone`.

---

# F-PR3 — `feat/f3-messaging-admin` : relance email, lecture admin, signalement, purge (D61 6A/7A/8A, A138–A141)

## Ce qui a été fait
1. **Schéma** : `Conversation.lastMessageAuthorRole`, `shipperRemindedAt`, `carrierRemindedAt` (writers posent `null`) ; `ReportTargetType.MESSAGE`. Journal : `CONVERSATION_VIEWED`, `MESSAGE_REPORT_REVIEWED`. Permissions : `conversations.read` et `reports.review` (MEDIATOR + SUPPORT) dans la matrice et son miroir admin-ui.
2. **Règles pures + tests** (`apps/message-service/src/lib/`) : `unread-reminder.rules.ts` (6 tests), `conversation-retention.rules.ts` (4), `message-report.rules.ts` (4) — message-service passe de 14 à **28** tests.
3. **Relance email** : `services/unread-reminder.service.ts` (balayage 7 jours, verrou optimiste `updateMany`, email par locale du destinataire via `emails/messaging-emails.ts`, CTA `FRONTEND_URL/<locale>/dashboard/messages?conversation=<id>`), `cron/unread-reminder.cron.ts` (`*/5`), `MESSAGING_REMINDER_CRON_ENABLED`.
4. **Purge** : `services/conversation-retention.service.ts` (candidats `updatedAt < 1 an`, règle sur le statut du deal, transaction de suppression), `cron/conversation-retention.cron.ts` (03:30), `MESSAGING_RETENTION_CRON_ENABLED`.
5. **Signalement** : `conversation.service.reportMessage` (404 message hors fil, 400 message à soi / non texte, 409 doublon), route `POST /messages/conversations/:id/messages/:messageId/report`. Front : bouton drapeau sur les bulles de l'autre partie, `ReportMessageDialog.tsx`, hook `useReportMessage`, i18n `messaging.report.*`.
6. **Admin** : `services/admin-conversation.service.ts` (`viewByDeal` journalisé, `listReports`, `reviewReport` transactionnel), `routes/admin.router.ts` monté sur `/admin/conversations`, gateway `/api/admin/conversations` → 6005, KPI `messageReportsOpen` (auth-service). admin-ui : page `/reports` (`MessageReportsQueue.tsx`), page `/conversations/[bookingId]` (`ConversationView.tsx`), lien « Lire la conversation » sur la fiche litige, entrée « Signalements » du menu, tuile d'accueil.
7. **OpenAPI** : 4 chemins ajoutés au document du message-service (13 chemins) ; les 4 documents régénérés (schémas partagés). **Seed** : message du Voyageur signalé sur `bzv-accepted`.

### Preuves
message **28** (+14) · auth 103 · tsc ×7 + les deux fronts · miroir i18n OK · OpenAPI régénéré. Recette : FCH20–FCH26 (DOC-METIER).

### Reste
Préférence « ne plus me relancer par email » et seuils (15 min / 1 h) réglables : C-PR8 paramètres. Photos dans le fil : backlog. Notification du signalé : décision à prendre quand un premier cas réel se présentera.

---

# Fix recette messagerie — `fix/messaging-recette-i18n-assets` (#174)

## Ce qui a été fait
Première recette de la messagerie sur `dev` après le merge de F-PR3 (05/09) : deux pannes qui n'avaient rien à voir l'une avec l'autre, aucune ligne de code métier.
1. **next-intl refusait tout le namespace `messaging`** (`INVALID_KEY: Namespace keys cannot contain the character "."`) : les trois clés de `messaging.system` (`meetup.proposed`, `meetup.accepted`, `phone.revealed`) contenaient un point, réservé à l'imbrication. Elles sont imbriquées dans les deux JSON (`system.meetup.proposed`…). Le consommateur `ConversationThread` appelle déjà `t(\`system.${systemKey}\`)` : la notation pointée résout l'imbrication, donc aucun changement de code, et les valeurs `systemKey` du serveur restent telles quelles. Le script CI `scripts/check-i18n-messages.mjs` ne vérifie que le parse et le miroir FR/EN : il ne pouvait pas voir l'erreur (next-intl ne valide qu'au rendu).
2. **Le message-service ne démarrait pas** : `src/assets` n'existait pas (les autres services ont un `.gitkeep` versionné), la cible `build` du `project.json` (`assets: ["./src/assets"]`) échouait en `ENOENT`, Nx sautait le `serve` et le gateway répondait 500 (`AggregateError` ECONNREFUSED) sur `/api/messages/*`. Ajout du `.gitkeep`. La CI n'a rien vu non plus : elle fait `tsc` et `jest`, pas `nx build`.

### Preuves
`node scripts/check-i18n-messages.mjs` OK · `nx build message-service` OK · 16 checks. Recette : FCH31–FCH32 (DOC-METIER).

### Reste
Deux angles morts de la CI notés au backlog : un `nx build` des services (le webpack voit les `assets`), et une validation des catalogues par next-intl (`createTranslator` sur chaque namespace).

---

# F-PR3b — `fix/messaging-quick-reply-draft` : la réponse rapide remplit la saisie (A142)

## Ce qui a été fait
1. **Un seul composant touché** : `apps/user-ui/src/components/dashboard/messages/ConversationThread.tsx`. Les puces de réponse rapide appelaient `send(q.text)` (envoi immédiat). Elles font désormais `setBody(q.text)` puis `composerRef.current?.focus()` : le texte atterrit dans le `textarea` (nouveau `useRef<HTMLTextAreaElement>`), le membre relit et envoie par le bouton ou Entrée. Les puces portent `type="button"` pour ne pas soumettre le formulaire par accident. Le brouillon existant est remplacé, pas concaténé (une puce est une phrase entière, pas un fragment).
2. **Rien côté serveur** : `POST /messages/conversations/:id/messages` et `GET /messages/quick-replies` sont inchangés. Le serveur n'a jamais su qu'un message venait d'une puce, et c'est voulu : un message est un message.
3. **Suppression d'un message : non retenue** (A142, RG-FCH-24). Aucun champ, aucune route, aucun menu. La forme compatible avec la médiation est consignée au registre si le besoin revient.
4. **Bulles invisibles sur téléphone** (recette 05/09, reproduit en Chrome headless 390 × 844 avec une session seed) : dans `sections/Messages.tsx`, la grille n'avait de `grid-template-columns` qu'à partir de `lg` ; sur mobile la colonne implicite `auto` prend la largeur **min-content** de son contenu (titre du rendez-vous, rangée des puces), soit plus large que l'écran, et la carte `overflow-hidden` coupe tout ce qui est à droite — les bulles de l'auteur (`justify-end`) sortaient du cadre, seuls les libellés de jour restaient visibles. Fix : `grid-cols-[minmax(0,1fr)]` dès le mobile + `min-w-0` sur les deux cellules. Même mécanisme que `minmax(0,1fr)` déjà posé sur la colonne `lg`.

### Preuves
tsc user-ui OK · aucun test serveur touché (805 + 103 inchangés) · aucune clé i18n ajoutée · capture headless mobile avant / après (bulles hors cadre → dans le cadre). Recette : FCH27–FCH30 (DOC-METIER).

### Reste
Rien. Suite : C-PR8 paramètres / RGPD.

---

# CI — `chore/ci-build-i18n` : la CI construit les services et refuse les clés à point

## Ce qui a été fait
Les deux angles morts vus à la recette du 05/09 (#174) sont fermés avant C-PR8.
1. **Job « Build des services (webpack) »** (`.github/workflows/ci.yml`) : `nx run-many -t build` sur les six services (gateway, auth, trip, deal, notification, message), après `prisma generate`, sans cache Nx. Un seul check (pas une matrice) : 20 s en local, et l'échec dit quel projet. C'est ce que `nx serve` et le déploiement exécutent — un `src/assets` absent ou un alias `@packages/*` manquant dans `webpack.config.js` casse désormais la PR, pas la recette.
2. **Règle 4 du script i18n** (`scripts/check-i18n-messages.mjs`) : aucune clé ne contient de point ni n'est vide, à tous les niveaux (`invalidKeys`, récursif, zéro dépendance). C'est la règle que next-intl applique au rendu (`INVALID_KEY`) ; le script l'applique à la source, dans le job déjà existant. Test négatif joué à la main sur un catalogue temporaire : « Clé refusée par next-intl (point ou vide) : … → "a.b.c" », sortie 1.
3. **17 checks requis** au lieu de 16 (`CLAUDE.md`, `YAMBA-CONTEXT.md`), le nouveau contexte ajouté à la protection de `dev` par l'API GitHub.

### Preuves
Script vert sur les 54 fichiers actuels ; rouge sur le cas #174 reconstitué. Build des six services vert en local et en CI.

### Reste
`next build` des deux fronts en CI (« la CI construit ce qu'elle déploie », candidat au registre) : coûteux (plusieurs minutes), à décider avant le lancement.

---

# C-PR8a — `feat/c8a-platform-settings` : les paramètres de la plateforme (D62)

## Ce qui a été fait
1. **Le catalogue** (`packages/libs/api-contracts/src/admin/platform-settings.schema.ts`) : 40 clés de classe A (`SETTINGS_CATALOG`, `as const satisfies SettingDefinition[]`), chacune avec libellé, description, règle source, unité, défaut, bornes, pas, portée (`BUSINESS` / `OPERATIONS`), drapeau `contractual`, consommateurs, exemple. Dérivés : `SETTINGS_DEFAULTS`, `PlatformSettingsValuesSchema` (un `z.object` plat construit depuis les bornes — lisible en OpenAPI), `settingsCoherenceIssues` (S ≤ M ≤ L, plafond ≥ prime, top ≥ confirmé, intervalle ≥ délai), `mergeSettingsValues` (clé inconnue ignorée, valeur absente → défaut), et les **projections pures** vers les consommateurs (`pricingParamsFromSettings`, `alertThresholdsFromSettings`, `reputationParamsFromSettings`). Classe B `FIXED_PARAMETERS` (huit invariants de sécurité, affichés en lecture seule) et classe C `PLANNED_PARAMETERS` (huit clés du §13 sans consommateur, dont `WEIGHT_TOLERANCE_PCT` découverte sans lecteur au rebranchement). Contrats HTTP : `AdminSettingsResponse`, `UpdateSettingsRequest` (changes + motif ≥ 20 + `expectedVersion`), `ResetSettingsRequest`, `SettingsWriteResponse`, `PricingParamsResponse` (public).
2. **Schéma** : `PlatformSettings` (un document, `key` unique = « current », `values` Json, `version` Int, `updatedByAdminId`) ; `AdminRole.OPS` ; **`SiteConfig` supprimé** avec son initialisation dans le gateway (A11 soldé). `npx prisma db push` posé.
3. **La lib `@packages/libs/settings`** (résolue par l'alias générique `@packages/*`, aucun alias webpack à ajouter) : `loadPlatformSettings(db)` (repli sûr, jamais d'exception), `makeSettingsReader({ db, ttlMs = 30 s, clock })` avec cache mémoire, dédoublonnage des lectures concurrentes, dernière valeur connue en cas de panne, `peek()` synchrone, `invalidate()` ; `default.ts` = le singleton branché sur Prisma (`platformSettings()`).
4. **Rebranchement, service par service** — chaque fonction pure garde la constante comme **défaut d'argument**, les services lisent `await settings.get()` et passent la valeur ; les signatures des fabriques prennent `settings: SettingsReader = platformSettings()` en dernier, donc les routes n'ont pas bougé :
   - `@packages/pricing` : `PricingParams` devient un type structurel (les valeurs viennent du serveur), `PRICING_PARAMS` reste le défaut.
   - deal-service : `quoteForTrip(trip, input, params)` et `quoteOr400` (deal-request.service, deux appels) ; `computeCancellationRefundCents({ …, params })` + `cancellationParamsFromSettings` (booking-lifecycle) lus par le cycle de vie ET l'aperçu d'annulation ; `ViewParams` / `viewParamsFromSettings` (booking-view.mapper : annulation + délai de litige) passés par `deal.controller` à chaque vue ; `disputeResponseDeadline(disputedAt, hours)` / `isDisputeDecidable(d, now, hours)` (médiation) ; `responseDeadline` / `toQueueItem` / `toDisputeFile` avec `delayHours` (file d'arbitrage) ; `completeBooking` lit `rating.windowDays` ; `computeReputationLevel(role, f, params)` ; `evaluateAlerts(s, now, T)` + `collectOpsSnapshot(now, T)` + la réponse `thresholds` reflète les paramètres.
   - trip-service : `computeComparablePriceCents(input, p)` + `comparableParamsFromSettings` (création / mise à jour de trajet) ; `price-for-weight` (`WeightPricingParams` dans les quatre fonctions, `weightPricingFromSettings`, lu une fois par recherche) ; limites de documents depuis `documents.*` (ex-SiteConfig) ; **`GET /trips/pricing/params`** (public, `pricing-params.controller.ts`, déclaré avant `/:id`, `Cache-Control: max-age=30`, entrée OpenAPI).
   - message-service : `conversationAccess(b, now, writeDays)`, `phoneRevealWindow(a, now, leadHours)`, `isPurgeable(input, now, retentionDays)`, `unreadReminderDue(input, now, { delayMinutes, minIntervalMinutes })` ; les trois services lisent les paramètres à chaque passage.
5. **L'écriture** (auth-service, propriétaire de `/admin/*`) : `services/platform-settings.service.ts` (db injectée, structurel) — `read()` (frais, sans cache : valeurs, défauts, version, auteur, `lastChange` = les lignes de journal de la dernière `version`, catalogue, classes B et C), `update()` (400 hors bornes / clé inconnue / motif court / rien à changer, **403 par portée clé par clé avant toute écriture**, 400 cohérence, **409 version** via `updateMany({ where: { key, version } })` ou `create` si le document n'existe pas, **une ligne `SETTING_CHANGED` par clé** dans la même transaction avec `{ key, value, reason, version }`), `reset()` (clés données ou toutes, seules celles qui s'écartent du défaut, `SETTINGS_RESET`, 400 si rien). Après le commit : `invalidate()` du lecteur local et **email à tous les SUPER_ADMIN** (`settingsChanged` FR/EN dans `admin-emails.ts`, langue du destinataire, best effort). Contrôleur `admin-settings.controller.ts`, routes `GET /admin/settings`, `GET /admin/settings/history?key=` (le journal filtré sur `targetType: SETTINGS`), `PATCH /admin/settings`, `POST /admin/settings/reset` — toutes sous `settings.read`, la portée d'écriture se juge dans le service parce qu'une requête peut mêler métier et exploitation. Journal : `SETTING_CHANGED`, `SETTINGS_RESET`, `targetType: "SETTINGS"`.
6. **Profil OPS** (D62 3A) : enum Prisma, `AdminRoleSchema`, `ADMIN_ROLES_ORDER`, `AdminRolesSchema.max(5)`, permissions `settings.read` (tous), `settings.business.write` (SUPER_ADMIN seul), `settings.operations.write` (OPS), `kpi.read` étendu à OPS ; `grant-admin.ts --role OPS` ; libellés « Exploitation » / « Operations » dans les emails et l'admin-ui (`ROLE_LABEL`, `ROLE_HINT`).
7. **admin-ui** : page `/settings` (`PlatformSettingsEditor`) — groupes du catalogue, valeur en vigueur, badge « modifiée », info-bulle et panneau d'explication (bornes, consommateurs, avertissement CGU), saisie bornée (euros pour les cents, `toStored` / `toInput`), aperçu chiffré (`previewOf`), remise par défaut par clé, historique par clé, panneau « à valider » collant avec le diff et le motif, « Tout réinitialiser » qui montre son diff avant confirmation, 409 → rechargement ; page `/settings/docs` (`SettingsDocumentation`) rendue depuis la même réponse ; entrée « Paramètres » du menu sous `settings.read` ; accueil : « Paramètres modifiés le … par … : clés » (`lastChange`). Miroir des permissions et types (`lib/permissions.ts`, `lib/types.ts`, `lib/settings-format.ts`).
8. **user-ui** : `usePricingParams()` (TanStack, `GET /trips/pricing/params`, `staleTime` 60 s, défauts du moteur en attendant) ; `computeTotal(draft, trip, params)` ; `BookingWizard`, `BookingMobile`, `StepParcel` (coefficients affichés) ; `createPaymentIntent` / `createDeal` recalculent le total attendu avec les paramètres du serveur (`fetchPricingParams`, repli défauts).
9. **Scripts et document** : `packages/libs/prisma/scripts/seed-settings.ts` (`--show` : valeurs en vigueur et écarts ; sans option : supprime le document → défauts, le journal n'est jamais touché) ; `scripts/generate-settings-doc.ts` (`npm run settings-doc`) écrit **`context/YAMBA-PARAMETRES.md`** depuis le catalogue. §13 des règles métier complété (D32, D33, D22) et classé.
10. **OpenAPI** : les quatre documents régénérés (schémas partagés du registre global) ; `PricingParamsResponse` documenté sur le trip-service.

### Preuves
message **33** (+5 : la constante n'est plus lue, par règle) · deal **489** (+4 : défauts = constantes du code, annulation / réputation / alertes réagissent au paramètre) · trip 209 · notification 83 · auth **121** (+18 : service d'écriture — bornes, portée, cohérence, verrou, journal par clé, email, reset, read ; lecteur — fusion, cache, concurrence, repli ; catalogue — unicité, bornes, classes) · tsc ×9 · build webpack des six services · OpenAPI régénéré · miroir i18n · `prisma db push` · `seed-settings.ts --show` contre Mongo. Recette : PAR1–PAR12 (DOC-METIER).

### Reste
C-PR8b (RGPD : export et effacement d'un compte, profil PRIVACY, registre des demandes, tiers destinataire), C-PR8c (maintenance, état des services, durées de conservation). Le prix comparable des trajets déjà publiés se recalcule par `backfill-comparable-price.ts` après un changement de `pricing.referenceKg` / `minTransportCents` (documenté dans l'info-bulle). `WEIGHT_TOLERANCE_PCT` reviendra en classe A quand une règle le lira.

---

# C-PR8b — `feat/c8b-gdpr` : export, effacement, tiers destinataire, profil PRIVACY (D63, A143)

## Ce qui a été fait
1. **Schéma** : `User.messagingReminderEmails` (préférence A138), `Booking.recipientRedactedAt`, `DataRequest` (registre : type EXPORT / ERASURE, canal MEMBER / ADMIN, statut DONE / REFUSED avec `refusalReasons`, IP, user-agent, admin et motif), `ErasedAccount` (ce qui survit : `stripeAccountId`, canal, motif, date — jamais un nom), `AdminRole.PRIVACY`. `prisma db push` posé.
2. **Contrats** (`admin-privacy.schema.ts`) : `ERASURE_BLOCKERS` (liste fermée : `ACTIVE_DEAL`, `PENDING_REQUEST`, `PAYOUT_PENDING`, `RETENTION_HELD`, `PUBLISHED_TRIP`, `ADMIN_ACCOUNT` — traduits par le front, jamais rédigés par le serveur), `ErasureBlockedResponse` (409 typé), `SudoCodeRequest`, `EraseMyAccountRequest` (code + mot `SUPPRIMER`), `UpdateMyPreferencesRequest`, `AdminEraseUserRequest` (motif ≥ 20), `DataRequestItem` / `DataRequestsResponse`, `DataExport` (le format `yamba-data-export/1`). Permissions : `privacy.requests.read` et `users.erase` (PRIVACY), **`exports.personal` = SUPER_ADMIN ou PRIVACY (A143)**. Paramètre D62 ajouté : `privacy.recipientRetentionDays` (30 j, exploitation).
3. **Sudo par code email** (D63 1A) : la portée `sudo` du mécanisme OTP existant (`auth.helper.ts` : `sendSudoOtp`, `verifySudoOtp`, mêmes paliers de blocage, alerte de sécurité) avec un email dédié `sudoCode` FR/EN. Un seul mécanisme, qui marche pour les comptes Google sans mot de passe.
4. **`privacy.service.ts`** (auth-service, db injectée structurellement, specs sur un faux Prisma en mémoire) : `erasureBlockers` (six comptages parallèles) ; `eraseAccount` — si bloqué : `DataRequest` REFUSED avec les motifs puis 409 ; sinon UNE transaction : identité capturée avant, `anonymizedUserData` (prénom « Membre », nom « supprimé », email et slug uniques dérivés de l'id — **jamais null sur un unique nullable**, mot de passe / téléphones / genre / date de naissance / TOTP / rôles effacés, `isDeleted` + `deletedAt`), `CarrierPage` anonymisée et `stripeAccountId` déplacé dans `ErasedAccount`, suppressions (adresses, avatar, identités OAuth, abonnements des deux côtés, alertes route, favoris, notifications, `TripDocument` des trajets du membre), `ConsentLog` sans IP ni user-agent, `DataRequest` DONE, journal `ACCOUNT_ERASED` si canal admin ; après le commit (`afterErase`, best effort) : sessions `refresh_jti:<id>:*` révoquées, fichiers ImageKit des justificatifs supprimés (`@packages/libs/imagekit`, client déplacé depuis le trip-service, `deleteImageKitFile` tolère « n'existe pas »), email `accountErased` à l'ancienne adresse. `buildDataExport` : projections explicites (jamais un spread de document), réservations avec le rôle du membre et ses montants (le destinataire n'est exporté qu'à l'Expéditeur qui l'a saisi, le versement qu'au Voyageur), avis reçus seulement révélés, messages écrits, signalements faits, jamais ceux subis. `recordExport` / `lastExportAt` (une fois par 24 h).
5. **Routes** : membre `POST /auth/me/sudo/request`, `POST /auth/me/data-export` (JSON en pièce jointe), `GET /auth/me/erasure/blockers`, `POST /auth/me/erasure` (cookies effacés), `PATCH /auth/me/preferences` ; admin `POST /admin/users/:id/erase` (`users.erase`, jamais son propre compte, 404 si déjà effacé), `GET /admin/privacy/requests` (`privacy.requests.read`, journal `DATA_REQUESTS_VIEWED`). Toutes tombent dans le catch-all auth-service du gateway : aucun proxy à ajouter.
6. **Après effacement, plus rien ne part** : `isAuthenticated` refuse `isDeleted` (401 `ACCOUNT_DELETED`) ; le notification-service filtre `isDeleted` (il ne se fiait qu'à l'absence d'email, or l'adresse technique n'est pas vide) ; la relance messagerie respecte `isDeleted` et `messagingReminderEmails === false` (le verrou est posé, rien n'est envoyé — spec `unread-reminder.service.spec.ts`).
7. **Tiers destinataire** (deal-service, D63 5A) : `recipient-redaction.rules.ts` (`isRecipientRedactable` pure : deal terminal, fini depuis N jours, pas déjà effacé ; `REDACTED_RECIPIENT` avec un numéro invalide non ambigu), `recipient-redaction.service.ts` (candidats par `completedAt` / `closedAt`, un `$set` sur le composite `recipient` + `recipientRedactedAt`), cron 03:40 (`RECIPIENT_REDACTION_CRON_ENABLED`), N lu dans `privacy.recipientRetentionDays`.
8. **user-ui** : `services/privacy.api.ts` (téléchargement par `responseType: "blob"` et lien créé à la volée, `ErasureBlockedError` typée), `PrivacySection` dans l'écran Sécurité : bascule réelle « relance par email », « Télécharger mes données » et « Supprimer mon compte » derrière le code email, bloqueurs traduits, mot SUPPRIMER, puis retour à l'accueil avec le cache vidé ; copies FR/EN dans `dashboard.copy.ts` (`privacy.*`).
9. **admin-ui** : profil PRIVACY (libellés, indice, matrice), menu « Données personnelles » → `/privacy` (`DataRequestsList`, curseur), carte « Effacer ce compte (RGPD) » sur la fiche utilisateur (`users.erase`, motif ≥ 20, mot EFFACER, bloqueurs affichés sur 409), libellés du journal.
10. **Scripts** : `grant-admin.ts --role PRIVACY` ; `YAMBA-PARAMETRES.md` régénéré (41 clés).

### Preuves
auth **130** (+9 : bloqueurs, refus 409 + registre, anonymisation champ par champ, conservation, ErasedAccount, canal admin + journal, double effacement, uniques jamais null, export par rôle) · deal **494** (+5 : règle d'effacement du destinataire) · message **36** (+3 : opt-out, compte effacé, envoi normal) · trip 209 · notification 83 · tsc ×9 · build ×6 · OpenAPI ×4 régénérés · `prisma db push`. Recette : RGP1–RGP12 (DOC-METIER).

### Reste
C-PR8c (maintenance, état des services, durées de conservation : notifications, emails, outbox, photos hors `TripDocument`). Compte Stripe Connect : clôture manuelle par le membre depuis Stripe (aucune API ici, D63). Portes D63 : délai de rétractation, export CSV.

---

# C-PR8c — `feat/c8c-maintenance` : maintenance, état des services, conservation (D64)

## Ce qui a été fait
1. **Santé uniforme** (`@packages/libs/health`) : `healthHandler(service, { mongo: mongoCheck(prisma), redis: redisCheck(redis) })` — chaque vérification a 2 s (`runCheck`), le corps dit `ok` ou `degraded`, toujours HTTP 200, version (`APP_VERSION` / `GIT_SHA` / `dev`) et uptime. Posé sur les cinq services (`/health`, nouveau sur auth et trip) et sur le gateway (`/gateway-health`, même forme, sa « vérification » est l'état de maintenance).
2. **Battement des crons** (`packages/libs/redis/cron-heartbeat.ts`) : `withHeartbeat(redis, { service, name, schedule }, fn, summarize)` écrit `yamba:cron:<service>:<nom>` (JSON : dernière exécution, durée, ok, résumé, erreur, TTL 7 j), best effort, relance l'erreur à l'appelant ; `listCronRuns` lit tout par SCAN + MGET. Les onze crons existants sont enveloppés (auth onboarding, trip complete-trips, deal expire / payout / digest / rating / alerts / recipient-redaction, message retention / reminder) sans changer leur logique, avec un résumé lisible (« 3 relance(s), 0 échec »).
3. **Conservation** (D64 6A, `@packages/libs/retention` : règles pures, une spec) : quatre paramètres D62 `retention.*` (notifications 365 j, traces d'emails 365 j, événements consommés 90 j, outbox publié 90 j) ; crons nocturnes dans le service propriétaire — notification-service `retention.cron.ts` (03:50, `RETENTION_CRON_ENABLED`, trois `deleteMany` bornés par date), deal-service et message-service `outbox-retention.cron.ts` (03:55, chacun son `aggregateType`, `OUTBOX_RETENTION_CRON_ENABLED`) — **un événement parqué (jamais publié) n'est jamais supprimé**.
4. **Maintenance** (D64 1A/2A) : `@packages/libs/maintenance` (règles pures : `snapshotFrom`, `envOverride`, `isBlocked` — écritures seulement, hors `/api/auth/*`, `/api/admin/*`, `/api/maintenance`) ; auth-service `maintenance.service.ts` (document `PlatformSettings` clé `maintenance`, verrou `version`, journal `MAINTENANCE_CHANGED` avant / après dans la transaction, email `maintenanceChanged` FR/EN aux SUPER_ADMIN), routes `GET /admin/maintenance` (`status.read`) et `PUT /admin/maintenance` (`maintenance.write` : OPS ou SUPER_ADMIN, motif ≥ 20) ; gateway `libs/maintenance.ts` (sonde Mongo toutes les 10 s, repli dernière valeur connue, `MAINTENANCE_MODE=on` + `MAINTENANCE_MESSAGE_FR/EN` l'emportent), `GET /api/maintenance` public, middleware 503 `MAINTENANCE` + `Retry-After: 300` posé avant les proxies. Le gateway gagne l'alias générique `@packages` (webpack) et le `tsconfig` des services (`rootDir ../../`, `include packages/**`) : il lit enfin la base par la lib partagée.
5. **État des services** (D64 5A) : auth-service `GET /admin/status` (`status.read`, tous les profils) — sonde les six `/health` en parallèle (`fetch`, 2,5 s, URLs par défaut du poste surchargeables par `*_SERVICE_URL`), battements des crons, outbox (non publié, plus ancien, parqué ≥ `alerts.outboxParkedAttempts`), emails envoyés / en échec sur 24 h, état de maintenance. admin-ui `/status` (`StatusView` : sondage 30 s, cartes par service avec dépendances, tableau des crons avec « en retard ? » quand le dernier battement dépasse deux fois l'intervalle attendu, outbox, emails) et **l'éditeur de maintenance** sur la même page (activer / annoncer / lever, messages FR/EN, motif, 409 → rechargement) ; `MaintenanceBanner` dans la coquille admin ; menu « État des services ».
6. **user-ui** : `MaintenanceBanner` sous le header (lit `/api/maintenance` toutes les 60 s, rouge en lecture seule, ambre pour une annonce, message de l'admin dans la langue de la page), namespace `maintenance` FR/EN enregistré dans `i18n/request.ts`.
7. **Contrats** (`admin-status.schema.ts`) : `MaintenanceState`, `UpdateMaintenanceRequest`, `PublicMaintenance`, `HealthReport`, `CronRun`, `ServiceStatus`, `AdminStatusResponse` ; permissions `status.read`, `maintenance.write` ; journal `MAINTENANCE_CHANGED`. OpenAPI ×4 régénérés, `YAMBA-PARAMETRES.md` (45 clés).

### Preuves
auth **134** (+4 : règles pures de maintenance — bloqué / passe / exemptions / environnement) · notification **87** (+4 : règles de conservation, parqué jamais purgé) · deal 494 · message 36 · trip 209 · tsc ×9 (gateway compris) · build ×6 · miroir i18n (28 namespaces). Recette : MNT1–MNT10 (DOC-METIER).

### Reste
Moniteur externe de disponibilité avant le lancement (candidat au registre, D64 5A). `next build` des fronts en CI (candidat). Photos hors `TripDocument` chez ImageKit (pas de `fileId`) : à la purge des deals. Chantier C soldé : C-PR8a / 8b / 8c.

---

# D35 — `feat/d35-email-provider` : Resend derrière une abstraction, et le retour du monde réel

## Ce qui a été fait
1. **`EmailProvider`** (`packages/libs/email/src/provider.ts`, D35 2A) : interface `send(OutgoingEmail) → { provider, providerMessageId }` ; `ResendEmailProvider` (HTTP par `fetch` injecté, `POST /emails`, `Authorization: Bearer`, `Idempotency-Key`, destinataire en tableau, étiquettes assainies `[a-zA-Z0-9_-]`, `EmailSendError` retriable sur 429 / 5xx) ; `SmtpEmailProvider` (Nodemailer, auth optionnelle pour Mailpit) ; `FakeEmailProvider` (envois en mémoire, une ligne de log). `resolveEmailProviderName` (pur) : `EMAIL_PROVIDER` explicite, sinon déduit (`RESEND_API_KEY` → Resend, `SMTP_HOST` → SMTP, sinon faux), **faux refusé en production**, fournisseur explicite sans sa clé refusé. La lib expose `getEmailProvider()` (paresseux) et `setEmailProvider()` (tests) ; `sendTransactionalEmail` / `sendTemplatedEmail` gardent leur signature, acceptent `tags` et `idempotencyKey`, et renvoient le résultat ; `getFromAddress` lit d'abord `EMAIL_FROM` (indépendant du fournisseur) ; `isEmailConfigured` = un fournisseur se résout.
2. **Le retour du monde réel** (`webhook.ts`, D35 3A) : `verifySvixSignature` (HMAC-SHA256 sur `id.timestamp.corps`, secret `whsec_` base64, plusieurs signatures candidates lors d'une rotation, `timingSafeEqual`, tolérance 5 min → `MISSING_HEADERS` / `STALE` / `BAD_SIGNATURE`) et `interpretEmailEvent` (pur : `email.delivered` → DELIVERED, `email.bounced` → BOUNCED + suppression si non transitoire, `email.complained` → COMPLAINED + suppression, le reste ignoré). notification-service : `express.json({ verify })` conserve le corps brut, `POST /webhooks/email/resend` (`email-webhook.controller.ts`, hors session : 503 sans secret, 401 signature, 200 idempotent) met `EmailDelivery` à jour par `providerMessageId` (`updateMany`) et, sur rebond dur ou plainte, pose `User.emailSuppressedAt` + `emailSuppressedReason` (écriture sur `User` assumée : un fait de délivrabilité que seul ce service apprend) ; gateway `/api/webhooks/email/*` → notification-service.
3. **Schéma** : `EmailDeliveryStatus` + DELIVERED / BOUNCED / COMPLAINED ; `EmailDelivery.provider`, `providerMessageId` (index, jamais unique : nullable sur Mongo), `deliveredAt`, `bouncedAt`, `bounceType` ; `User.emailSuppressedAt` / `emailSuppressedReason`. Le dispatcher pose `provider` + `providerMessageId` à SENT, avec la clé d'idempotence `eventId:userId` (un rejeu ne renvoie jamais deux fois côté Resend).
4. **Liste de suppression respectée partout** (D35 4A) : notification-service (`booking-emails` : `!user?.email || user.isDeleted || user.emailSuppressedAt`), relance messagerie, alertes route et abonnements du trip-service, `payout.failed` du deal-service, sanctions et réintégration de l'auth-service. Alerte D59 « emails en échec » : FAILED + BOUNCED + COMPLAINED. Fiche admin : bandeau « adresse sur la liste de suppression » avec motif, bouton « Lever (adresse corrigée) » → `DELETE /admin/users/:id/email-suppression` (`users.email.unsuppress` : SUPPORT, MEDIATOR, PRIVACY ; journal `EMAIL_SUPPRESSION_LIFTED` avant / après, dans la transaction).
5. **trip-service** (D35 5A) : `utils/email/send-email.ts` délègue à `sendTemplatedEmail` (gabarits EJS inchangés, étiquette `service`), le transport Nodemailer dupliqué a disparu.
6. **Mailpit** (D35 6A) : service `docker-compose` (SMTP 1025 sans auth, interface 8025) ; `.env.example` : `EMAIL_PROVIDER`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `EMAIL_FROM`, recette locale en SMTP sur Mailpit.

### Preuves
notification **95** (+8 : fabrique, Resend — charge, en-têtes, idempotence, erreurs —, faux, signature Svix sur vecteurs — valide, rotation, fausse, en-têtes manquants, périmée —, interprétation des événements) · les specs existantes du dispatcher rendent désormais un résultat de fournisseur · auth 134 · deal 494 · message 36 · trip 209 · tsc ×7 · build ×6 · OpenAPI ×4. Recette : EML1–EML8 (DOC-METIER) — dans la recette globale de fin de chantier.

### Reste
Compte Resend, domaine (SPF, DKIM), `RESEND_API_KEY` et `RESEND_WEBHOOK_SECRET` en production : à ta main. Dette D44 (gabarits EJS FR/EN du trip-service et du notification-service) inchangée. Portes : file de retry côté Yamba, suivi des ouvertures (non retenus).

---

# D65 — `feat/d65-member-sessions` : sudo à fenêtre, appareils connectés, mot de passe et email (solde D27)

## Ce qui a été fait
1. **Sudo à fenêtre** (`apps/auth-service/src/utils/sudo.ts`, D65 1A) : `POST /auth/me/sudo/verify { code }` vérifie le code (portée OTP `sudo`, D63) et ouvre `sudo:<userId>:<jti>` en Redis pour 15 min (`SUDO_WINDOW_MINUTES`, contrats) ; `GET /auth/me/sudo` renvoie `{ active, expiresAt }` ; `requireSudo(req)` lit le jti du cookie refresh (`currentMemberJti`, même secret que la rotation) et lève un 403 `ForbiddenError` avec `details.code = "SUDO_REQUIRED"`. Store injectable (`SudoStore`), spec sur un faux Redis à horloge (fermée par défaut, une autre session du même membre n'en profite pas, expiration, fermeture explicite). **D63 migre** : export et effacement ne prennent plus de code dans le corps (`EraseMyAccountRequest` = confirmation seule), `assertSudo` = `requireSudo`.
2. **Sessions visibles** (D65 2A) : `SessionRecord` gagne `ip`, `userAgent` (tronqué à 200), `device` (`describeUserAgent`, pur : navigateur + système, « Appareil inconnu » sinon — spec sur cinq user-agents) ; `issueSession` reçoit `sessionMetaOf(req)` (connexion, Google), la rotation conserve l'appareil de la connexion et rafraîchit l'IP (`session === "legacy"` → méta du refresh). `account.controller.ts` : `GET /auth/me/sessions` (SCAN + MGET, la courante marquée, tri courante puis activité), `DELETE /auth/me/sessions/:jti` (une autre, ou la sienne → cookies effacés), `DELETE /auth/me/sessions` (toutes les autres, `revokeOtherSessions` garde le jti courant).
3. **Mot de passe** (3A) : `POST /auth/me/password { newPassword }` sous sudo — `validatePasswordStrength` avec le contexte (email, prénom, nom), refus du mot de passe actuel, hash bcrypt, **autres sessions révoquées**, fenêtre sudo fermée, email « mot de passe modifié » (existant) avec date, IP, navigateur, lien Sécurité. Un compte Google sans mot de passe en pose un.
4. **Email** (4A) : `POST /auth/me/email/request { newEmail }` sous sudo — même adresse refusée, unicité (409), portée OTP `email_change` clé = nouvelle adresse (mêmes paliers, alerte de sécurité), demande gardée 10 min en Redis (`email_change:<userId>`), email `verifyNewEmail` à la NOUVELLE adresse ; `POST /auth/me/email/confirm { code }` — vérifie, re-teste l'unicité, met `email` / `emailNormalized` à jour et lève une éventuelle suppression D35, révoque les autres sessions, ferme la fenêtre, prévient l'ANCIENNE adresse (`emailChanged`, adresse masquée `a***@…`, sans lien). Emails FR/EN + clés + spec.
5. **Stripe** : `POST /carrier/stripe/dashboard-link` sous sudo (l'IBAN vit chez Stripe, SES-03).
6. **user-ui** : `services/account.api.ts` (sudo, sessions, identifiants, `isSudoRequired`) ; `SudoGate` (un composant : envoyer, saisir, vérifier, puis rejouer le geste via `onVerifiedAction`) ; `Security.tsx` réel — mot de passe, email en deux temps, liste des appareils avec révocation unitaire et « Déconnecter les autres appareils », plus « Mes données » (D63) ; `PrivacySection` et `FinancesSection` (tableau de bord Stripe) rejouent le geste après la porte sur 403 `SUDO_REQUIRED` ; copies FR/EN `sudo.*` et `securityPage.*` dans `dashboard.copy.ts`.
7. **Contrats** (`member-sessions.schema.ts`) : `SudoStatus`, `SudoVerifyRequest`, `MemberSessionItem` / `MemberSessionsResponse`, `ChangePasswordRequest`, `RequestEmailChange`, `ConfirmEmailChange` ; OpenAPI ×4 régénérés.

### Preuves
auth **138** (+4 : libellé d'appareil sur cinq user-agents + inconnu + troncature ; fenêtre sudo — fermée, ouverte pour une session seulement, expirée, fermée explicitement) · les specs d'emails couvrent les deux nouveaux gabarits · tsc ×7 · build ×6 · OpenAPI ×4. Recette : SES1–SES10 (DOC-METIER) — dans la recette globale.

### Reste
SES-04 : compte à rebours avant expiration non retenu (la porte « session expirée » A89 suffit). Alerte email à chaque nouvelle connexion : porte. Le mobile réutilisera ces routes avec des jetons (D36).

---

# D66 — `feat/d66-posthog` : la mesure d'audience, avec consentement, sans donnée personnelle (met en œuvre D5)

## Ce qui a été fait
1. **Consentement** (D66 2A) : `User.analyticsOptIn Boolean?` (null = pas choisi) ; `PATCH /auth/me/preferences { analyticsOptIn }` écrit le champ et **trace** le choix dans `ConsentLog` (`recordCookiesConsent` : accepté → ligne COOKIES version `cookies-2026-09` avec IP / user-agent / locale ; refusé → `revokedAt` sur la dernière ligne non révoquée). Front : `lib/analytics.ts` — choix dans `localStorage` (`yamba.analytics.consent`, six mois), `ConsentBanner` (deux boutons de même poids, lien vers la politique de confidentialité, namespace `consent` FR/EN) ; un membre qui a déjà choisi sur un autre appareil ne revoit pas la bannière (son choix est repris depuis `/auth/me`). Bascule « Mesure d'audience » dans « Mes données » (`PrivacySection`).
2. **Navigateur** (3A) : `posthog-js` (dépendance ajoutée) chargé par `import()` **seulement** après acceptation et si `NEXT_PUBLIC_POSTHOG_KEY` est posée ; `autocapture: false`, `capture_pageview: false` (pages vues envoyées à la main par `AnalyticsProvider` sur `usePathname`), pas d'enregistrement de session, `person_profiles: "identified_only"`, `respect_dnt`. `identify(user.id)` quand le membre est chargé (id seul), `reset()` quand il disparaît, `disableAnalytics()` sur refus a posteriori. Événements du funnel : `search_performed` (première page : origine, destination, poids, nombre de résultats), `trip_viewed`, `booking_step_viewed`, `booking_payment_started`, `booking_created`, `trip_published` / `trip_drafted`.
3. **Serveur** (4A, `@packages/libs/analytics`, zéro dépendance) : `captureServerEvents` → `POST {POSTHOG_HOST}/batch` par `fetch`, inerte sans `POSTHOG_API_KEY`, **jamais d'exception** (un analytics qui casse un consumer serait une faute) ; `analyticsEventsFor(event, consentants)` pure : un événement produit par partie consentante, `distinct_id` = userId, `uuid` déterministe (SHA-1 de `eventId:userId`, forme v5) pour le dédoublonnage, propriétés sur **liste blanche** (`ALLOWED_EVENT_PROPERTIES` + corridor) — le destinataire, le code, les emails et téléphones du payload ne passent jamais (spec). `analytics-sink.ts` (notification-service) : après la matérialisation de chaque `booking.*` et `conversation.*`, charge les parties avec `analyticsOptIn: true` et envoie.
4. **Env** : `NEXT_PUBLIC_POSTHOG_KEY` / `_HOST` (front), `POSTHOG_API_KEY` / `POSTHOG_HOST` (serveur), défaut `https://eu.i.posthog.com` (Cloud EU, 1A).

### Preuves
notification **99** (+4 : liste blanche et parties consentantes, uuid stable, `/batch` avec `api_key`, inerte sans clé et jamais d'exception) · auth 138 · tsc user-ui + notification + auth · build ×6 · OpenAPI ×4 · miroir i18n (29 namespaces). Recette : ANA1–ANA8 (DOC-METIER) — dans la recette globale.

### Reste
Compte PostHog Cloud EU, projet, clés (front et serveur) : à ta main. Politique de confidentialité : ajouter le paragraphe « mesure d'audience » (texte légal, hors code). Portes : autocapture, session replay, feature flags, auto-hébergement.

---

# D67 — `feat/e-profile-editable` : le profil que le membre tient lui-même (chantier E)

## Ce qui a été fait
1. **Contrat** (`packages/libs/api-contracts/src/admin/member-profile.schema.ts`) : `UpdateMyProfileRequest` (prénom / nom 2–40, `displayName` 2–40, `bio` ≤ 300 nullable, `birthDate` `AAAA-MM-JJ` nullable, `profilePublic`, `showCity`, tous optionnels), `SetMyAvatarRequest { fileId, url }`, `MyProfileResponse` (identité, `publicSlug`, `avatarUrl`, `birthDate`, visibilités, bloc `carrier` nul pour un Expéditeur pur). Deux champs Prisma : `User.profilePublic` et `User.showCity` (défaut `true`).
2. **Règle pure** (`apps/auth-service/src/utils/profile.rules.ts`) : `normalizeProfileUpdate(input, { hasCarrierPage, now })` rend `{ errors, user, carrier }` — noms nettoyés (espaces réduits), `validateBirthDate` (`INVALID_DATE` / `IN_THE_FUTURE` / `TOO_YOUNG` sous 16 ans, calcul par `now` injecté), `displayName` / `bio` refusés (`NO_CARRIER_PAGE`) sans page Voyageur, `isImageKitUrl(url, endpoint)` pour n'accepter qu'un fichier de notre compte (D42). Spec : `profile.rules.spec.ts` (auth **142**, +4).
3. **Routes membre** (`profile.controller.ts`, montées dans `auth.router.ts`) : `GET /auth/me/profile`, `PATCH /auth/me/profile` (400 `VALIDATION_ERROR` avec `details.errors` par champ ; User + CarrierPage écrits dans **une** transaction), `POST /auth/me/avatar` (URL vérifiée contre `IMAGEKIT_URL_ENDPOINT`, `Image` upsert par `userId` avec `fileId`, l'ancien fichier supprimé chez ImageKit via `@packages/libs/imagekit`), `DELETE /auth/me/avatar`. Le `publicSlug` n'est jamais accepté en entrée (immuable, D28).
4. **Visibilité** (`user-public.controller.ts`) : `profilePublic: false` → **404** pour tout autre appelant (le propriétaire voit sa page avec `hidden: true` et `isMe: true`) sur la page publique et les deux listes ; `showCity: false` → `location.*` à null dans la réponse publique. L'effacement RGPD (D63) collecte désormais aussi le `fileId` de l'avatar pour le supprimer chez ImageKit.
5. **Front** (`apps/user-ui`) : `services/profile.api.ts` ; `components/dashboard/sections/Profile.tsx` remplace la maquette : avatar téléversé par `useImageKitUpload("/avatars", 2 Mo, JPEG/PNG/WebP)` puis déclaré au serveur, formulaire (prénom, nom, date de naissance, nom affiché et présentation pour un Voyageur) qui n'envoie que les champs modifiés, erreurs par champ traduites, deux bascules (page publique, ville), bouton « Voir mon profil public » vers `/u/<slug>` ; copies `profilePage.*` dans `dashboard.copy.ts`. Le bouton « Modifier mon profil » de la page publique menait déjà à `/dashboard/profile`.

### Preuves
auth **142** (+4 : noms, date de naissance, champs Voyageur refusés sans page, URL ImageKit) · tsc auth + user-ui · build ×6 · OpenAPI ×4 (auth-service reste hors OpenAPI — backlog). Recette : PRO1–PRO8 (DOC-METIER) — dans la recette globale.

### Reste
Non retenus (D67) : bio d'Expéditeur, bannière et réseaux sociaux (`coverUrl`, `socialLinks` restent vides), changement de slug. Recadrage de l'avatar côté navigateur : porte.

---

# D68 — `feat/trust-report-wording` : signaler un trajet ou un membre, wording D28 (micro-PR confiance, lot 1)

## Ce qui a été fait
1. **Contrat** (`packages/libs/api-contracts/src/admin/reports.schema.ts`) : `REPORT_TARGET_TYPES` (TRIP, USER), `REPORT_REASONS` et `REPORT_REASONS_BY_TARGET` (motifs fermés par cible, SIG-01), `REPORT_REVIEW_THRESHOLD = 3`, `CreateReportRequest { targetType, targetRef, reason, details? }` — `targetRef` est l'identifiant **public** de la cible (id du trajet, slug du membre : le DTO public d'un membre ne porte pas son id), `AdminReportItem` (cible lisible, propriétaire d'un trajet, auteur, `openCountOnTarget`, `priority`), `ReviewReportRequest`.
2. **Règles pures** (`apps/auth-service/src/utils/report.rules.ts`) : `canReport` (sa propre cible → `OWN_TARGET`, motif hors liste → `REASON_NOT_ALLOWED`, doublon ouvert → `ALREADY_REPORTED`), `needsPriorityReview(openCount, threshold = 3)` — la constante reste l'argument par défaut (classe C du catalogue D62).
3. **Service** (`services/report.service.ts`, Prisma injectable) : `createReport` résout la cible (trajet non supprimé ; membre non effacé **et** page publique, sinon 404), écrit le `Report` puis envoie l'accusé `reportReceived` à l'auteur (best effort, résolveur qui saute `isDeleted` et `emailSuppressedAt`) ; `listReports(status)` enrichit (corridor + propriétaire d'un trajet, prénom + nom d'un membre, auteur), compte les signalements ouverts par cible et pose `priority` ; `reviewReport` = `updateMany` conditionnel + `recordAdminAction("REPORT_REVIEWED")` dans une transaction, 409 si déjà traité, 404 pour un signalement de message (il reste dans message-service).
4. **Routes** : `POST /reports` (auth.router, `isAuthenticated`, 201), `GET /admin/reports?status=` et `PATCH /admin/reports/:id` (admin.router, `reports.review`) — aucune route gateway à ajouter (catch-all auth-service). KPI d'accueil `reportsOpen` (trajets et membres) à côté de `messageReportsOpen`. Email FR/EN `reportReceived` dans `auth-emails.ts` (miroir vérifié par la spec).
5. **admin-ui** : `ReportsQueue.tsx` (file trajets et membres, cible cliquable vers `/trips/:id` ou `/users/:id`, propriétaire du trajet, badge « Prioritaire · N ouverts », note + Traité / Sans suite) ; la page `/reports` devient « Signalements » avec les deux files ; libellés des motifs et cibles dans `lib/format.ts` ; carte d'accueil « Trajets et membres signalés ».
6. **user-ui** : `services/report.api.ts`, `components/shared/ReportDialog.tsx` (motifs par cible, porte de connexion `AuthGateModal` si visiteur, 409 → « déjà signalé », 400 → « ton propre contenu ») branché sur les deux boutons inertes de `TripDetailView.tsx` (masqués pour le propriétaire) et `FollowSidebar.tsx` ; namespace `common.report` FR/EN.
7. **Wording D28** : `myTrips.json` FR/EN — `PUBLISHED` « En ligne » / « Online », `PAUSED` « Masqué » / « Hidden », actions « Masquer » / « Remettre en ligne », toasts alignés. Le namespace `trips` (chargé dans `i18n/request.ts`, jamais consommé) est retiré avec ses deux JSON : 28 namespaces.
8. **CTA alertes** : constaté déjà en place (page Alertes vide et non vide, état vide de la recherche, bannière de fin de liste). La modale ne peut pas recevoir un lieu structuré : la barre de recherche ne manipule que des noms de villes → porte.

### Preuves
auth **153** (+11 : règles pures ×5, service ×6 — cible résolue, 404 page masquée, OWN_TARGET / motif / doublon, suppression email, file enrichie et priorité, décision journalisée + 409) · tsc auth + user-ui + admin-ui · miroir i18n 28 namespaces · build ×6 · OpenAPI ×4. Recette : SIG1–SIG8 (DOC-METIER) — dans la recette globale.

### Reste
Lot 2 : page destinataire (D69). Signalement d'un avis (bouton inerte conservé). Seuil de revue au catalogue D62 quand un second consommateur apparaît.

---

# D69 + A144 — `feat/recipient-page` : la page destinataire et le glossaire (micro-PR confiance, lot 2)

## Ce qui a été fait
1. **Modèle** `TrackingLink { bookingId @unique, token @unique, createdAt, revokedAt? }` (un lien par réservation ; `revokedAt` écrit à `null`, jamais absent). Jeton : 32 octets CSPRNG en base64url, non devinable.
2. **Contrat** (`packages/libs/api-contracts/src/booking/tracking-link.schema.ts`) : `TrackingLinkResponse { token, path, recipientFirstName, recipientPhoneE164 }` (le numéro est celui que l'Expéditeur a saisi lui-même), `PublicTrackingResponse` (jalon courant, jalons atteints avec date, prénoms, prénom + initiale du Voyageur, corridor, dates du trajet) — **jamais** l'adresse, un numéro, le code, des photos ou des montants.
3. **Règles pures** (`apps/deal-service/src/lib/tracking-link.rules.ts`) : `canIssueTrackingLink` (ACCEPTED, PICKED_UP, DELIVERED, COMPLETED, DISPUTED — rien à suivre avant l'acceptation, plus rien après une fin sans livraison), `isTrackingVisible` (un seul interrupteur : suppression, `recipientRedactedAt`, révocation), `publicMilestones` (statut + jalons de transit → accepté, récupéré, en route, arrivé, livré, ou clôturé). Spec : 4 tests.
4. **Service** (`services/tracking-link.service.ts`, Prisma injectable) : `issue(userId, bookingId)` — 404 réservation inconnue, 403 Voyageur ou tiers, 409 `TRACKING_NOT_AVAILABLE` (AppError 409 typé `{ type: "booking", code }` comme les autres conflits du service), get-or-create du lien ; `publicView(token)` — 404 uniforme (jeton inconnu, révoqué, tiers effacé, réservation supprimée). Spec : 4 tests sur faux Prisma (le même lien au second appel, aucune fuite de numéro dans la réponse publique).
5. **Routes** : `POST /deals/:id/tracking-link` (`isAuthenticated`), `GET /track/:token` (**sans session**, format du jeton vérifié, `Cache-Control: no-store`) ; gateway `/api/track` → deal-service (limiteur anonyme du gateway) ; OpenAPI : deux chemins documentés.
6. **user-ui** : page publique `/track/[token]` (`TrackingClient.tsx`, `robots: noindex`) — titre au prénom du destinataire, corridor et dates, jalon courant avec son conseil (« prépare le code que {Expéditeur} t'a donné » à l'arrivée), frise des cinq jalons, mention RGP-02 avec lien vers la politique de confidentialité, bloc d'acquisition (recherche, devenir Voyageur) ; page « lien plus valide » sur 404. Namespace `tracking` FR/EN (29 namespaces).
7. **Tracker Expéditeur** : `shared/BookingTrackingLinkCard.tsx` (« Partage le suivi à {destinataire} » : WhatsApp vers le numéro saisi, SMS natif, copie du message ; le lien est créé au premier clic et réutilisé ; événement `tracking_link_shared` avec le canal) placé dans les vues accepté, récupéré et en transit. La vue Shipper servait déjà `recipient.phoneE164` : le type et l'adaptateur le reprennent, **fin du numéro factice** de la carte destinataire (A137).
8. **Glossaire A144** : emails Voyageur d'auth-service (« Ton profil Voyageur est actif », EN « Traveler »), copie EN du parcours de réservation (14 « tripper » → « traveler »), orthographe EN unique « traveler », « espace / profil Voyageur » dans Mes trajets, « Voyageurs favoris », « colis confiés aux Voyageurs ». Identifiants de code inchangés (A90).

### Preuves
deal **502** (+8) · auth 153 (spec des emails : miroir et rendu inchangés) · tsc deal + user-ui · miroir i18n 29 namespaces · build ×6 · OpenAPI ×4. Recette : DES1–DES8 (DOC-METIER) — dans la recette globale.

### Reste
SMS sortant par Yamba (fournisseur, coût, consentement) : porte. Révocation du lien par l'Expéditeur (le champ existe, pas d'écran) : porte.

---

# D70 — `feat/d70-uptime-monitor` : le moniteur externe de disponibilité (Jalon 2)

## Ce qui a été fait
1. **Sonde publique** `GET /api/status` au gateway (`apps/api-gateway/src/main.ts`), déclarée **avant** le limiteur : sonde les cinq services par leur `/health` (2 s chacun) et lit l'état de maintenance, agrège, répond **200** pour `ok` et `maintenance`, **503** pour `degraded` et `down`. Cache mémoire de 10 s. Corps : `{ status, services: [{ name, reachable, status, ms }], at }` — jamais une URL interne ni une erreur brute.
2. **Lib partagée** `packages/libs/health/status.ts` : `serviceEntries(env)` (mêmes variables `*_SERVICE_URL` que la page d'état), `probeService(entry, timeout, fetch)` (jamais d'exception), `aggregateStatus(probes, maintenance)` (règle pure), `toPublicBody`. La page d'état admin (`admin-status.controller.ts`, D64 5A) réutilise `serviceEntries` et `probeService` : une seule façon de sonder.
3. **Fronts** : `GET /api/health` sur user-ui et admin-ui (`src/app/api/health/route.ts`, `force-dynamic`, `no-store`) → `{ status: "ok", app, at }`.
4. **Battement externe des crons** (`packages/libs/redis/cron-heartbeat.ts`) : `resolveHeartbeatPingUrl(raw, service, name)` (carte JSON `{ "<service>:<cron>": url }`, http(s) seulement, JSON invalide → aucune), `pingExternalHeartbeat` (GET best effort, 3 s, jamais d'exception), appelé sans attente par `withHeartbeat` après chaque tick réussi. Onze crons sont déjà enveloppés (auth `onboarding-reminder` ; deal `expire-bookings`, `payout-bookings`, `ops-alerts`, `ops-digest`, `rating`, `recipient-redaction` ; message `unread-reminder`, `conversation-retention` ; notification `retention` ; trip `complete-trips`).
5. **Env** : `CRON_HEARTBEAT_PING_URLS` documentée dans `.env.example` (vide = aucun envoi).

### Runbook — mettre en place le moniteur (à ta main)
| Étape | Quoi |
|---|---|
| 1 | Créer un compte **Better Stack** (Uptime, offre gratuite : 10 moniteurs, sondes à 3 min, battements, page de statut) — UptimeRobot convient aussi |
| 2 | Trois moniteurs HTTP : `https://api.<domaine>/api/status` (attendu 200 ; alerte sur 503 ou absence de réponse, 2 échecs consécutifs), `https://<domaine>/api/health`, `https://admin.<domaine>/api/health` |
| 3 | Quatre battements (heartbeats), période = fréquence du cron + marge : `deal-service:payout-bookings` (toutes les heures → 2 h), `deal-service:expire-bookings` (5 min → 15 min), `message-service:unread-reminder` (5 min → 15 min), `deal-service:ops-alerts` (1 h → 2 h). Coller les URLs dans `CRON_HEARTBEAT_PING_URLS` du `.env` de production, redémarrer les services |
| 4 | Contacts d'alerte : email + push de l'application mobile du fournisseur ; escalade SMS si tu le souhaites (payant) |
| 5 | Page de statut publique du fournisseur (optionnel) : `status.<domaine>` |
| 6 | Conduite à tenir : `503 down` → un service ne répond pas (redémarrage, logs) ; `503 degraded` → Mongo ou Redis manquent à un service (Atlas / Redis) ; battement manquant → le cron ne tourne plus (service arrêté ou `*_CRON_ENABLED=false`) ; `maintenance` → normal, planifié par l'admin |

### Preuves
auth **159** (+6 : agrégation, corps public sans URL ni erreur, lecture du `/health`, carte des battements, ping best effort) · tsc auth + gateway + user-ui + admin-ui · build ×6. Recette : MON1–MON6 (DOC-METIER) — dans la recette globale, et le vrai test est la première alerte reçue.

### Reste
Compte, moniteurs, battements et contacts : à ta main (runbook ci-dessus). Porte : battement « échec » (`/fail`) quand un tick échoue, pour distinguer « cron mort » de « cron en erreur ».

---

# A145 — `feat/auth-openapi` : auth-service entre dans l'OpenAPI 3.1 (Jalon 2)

## Ce qui a été fait
1. **Contrats de la surface membre** (`packages/libs/api-contracts/src/auth/member-auth.schema.ts`, exportés par l'index) : inscription OTP (`MemberRegisterRequest`, `RegistrationStartedResponse`, `VerifyRegistrationRequest`…), connexion (`MemberLoginRequest/Response`, `SessionUser`), Google (`GoogleSignInRequest/Response` avec `CONSENT_REQUIRED`), `MeResponse` (User sans `passwordHash`, champs supplémentaires admis), locale, mot de passe oublié (forgot / verify / reset), réponses du compte D63/D65 sans schéma dédié (`SudoWindowResponse`, `PasswordChangedResponse`, `EmailChange*Response`, `PreferencesResponse`, `ErasedResponse`), onboarding Voyageur (`CarrierProfileRequest`, `CarrierPageDto`, `StripeLinkResponse`, `StripeStatusResponse`), alertes de route (`SavedRouteRequest/Dto/Response(s)`), profil public (`PublicUserProfile` miroir du DTO servi — `hidden` / `isMe` de D67 —, `PublicReview`, `PublicTripPreview`, `PublicReputation`, listes paginées), abonnement (`Follow*`), connexion admin à deux étapes (`AdminLogin*`, `AdminTotp*`), journal (`AdminAuditResponse`), historique des paramètres, réponses de sanction. Tous `.meta({ id })` : ils entrent dans le registre global et donc dans les cinq documents.
2. **Document** (`apps/auth-service/src/openapi/build-openapi.ts`) : 75 chemins, **86 opérations**, 365 schémas ; trois schémas de sécurité (`cookieAuth`, `bearerAuth` pour le mobile, `adminCookieAuth`), `x-permission` sur chaque route admin (la matrice `ADMIN_PERMISSIONS`), sémantique d'erreurs au réel (403 `SUDO_REQUIRED`, 409 `ERASURE_BLOCKED` avec la liste fermée, 429 verrou OTP, 404 « page masquée »). Monté sur `:6001/openapi.json` et `:6001/docs` (Scalar) à la place du commentaire « Swagger legacy retiré ».
3. **Garde** (`build-openapi.spec.ts`) : lit les cinq routeurs au format source (`router.get("…")`), convertit `:param` en `{param}`, exige chaque paire méthode + chemin dans `paths` **et** refuse toute opération documentée sans route ; vérifie que chaque `$ref` résout et que les `operationId` sont uniques. Auth **162** (+3).
4. **Génération et CI** : `scripts/generate-openapi.ts` produit `apps/auth-service/openapi.json` (cinquième cible) ; le job « OpenAPI contracts generate+diff » le compare comme les quatre autres. Les quatre autres `openapi.json` bougent aussi : le registre est commun, leurs `components.schemas` gagnent les schémas auth.

### Preuves
auth 162 · tsc auth · `npm run generate:openapi` ×5 · build ×6. Le document se lit sur `http://localhost:6001/docs`.

### Reste
Porte A145 : brancher les schémas membre en `safeParse` dans les contrôleurs historiques au chantier mobile D36 (le client généré en dépendra) ; d'ici là un champ renommé côté contrôleur n'est pas attrapé par le test de couverture (qui attrape une route, pas un champ).

---

# D71 — `feat/d71-trust-score` : le TrustScore interne et les plafonds progressifs (Jalon 2)

## Ce qui a été fait
1. **Lib pure** `packages/libs/trust/index.ts` : `TrustSignals`, `computeTrustScore(signals, params)` → `{ score, level, factors, caps, capsReason }` (pondérations `TRUST_WEIGHTS`, seuils 30 / 60, statut neuf = âge < `newAccountDays` et < 3 deals), `checkCaps(assessment, { declaredValueCents, weightKg, bookingsThisMonth })` → violation ou null (envois du mois d'abord, puis valeur, puis poids), `trustParamsFromSettings(values)` (les constantes restent le défaut). `load.ts` : `loadTrustSignals(db, userId, now)` — User + CarrierPage (compteurs D29 ① et C-PR2 des deux rôles additionnés), trajets du membre, quatre `count` (demandes 24 h et mois civil UTC, signalements OPEN et REVIEWED visant le membre ou ses trajets), Prisma injecté par une interface minimale.
2. **Catalogue D62** : groupe `trust` (libellé, ordre, doc régénérée `YAMBA-PARAMETRES.md`) avec `trust.newAccountDays` (30, OPERATIONS), `trust.newAccount.maxDeclaredValueCents` (30 000, BUSINESS), `trust.newAccount.maxWeightKg` (10, BUSINESS), `trust.newAccount.maxShipmentsPerMonth` (5, OPERATIONS) ; CNF-06 sort de `PLANNED_PARAMETERS`.
3. **deal-service** : `services/trust.service.ts` (`assertWithinCaps` → 409 `NEW_ACCOUNT_CAP` typé `{ type: "booking", code, cap, limit, value }`), branché dans `deal-request.service.ts` **aux deux étapes** : `createPaymentIntent` (poids, envois du mois — avant d'autoriser l'argent) et `createBooking` (valeur déclarée comprise). Code ajouté à `BOOKING_REQUEST_ERROR_CODES` et à la description 409 de l'OpenAPI. Le service est injecté dans `makeDealRequestService` (défaut construit avec les mêmes `settings` et `clock`).
4. **Contrat** `admin/trust.schema.ts` (`TrustLevel`, `TrustAssessment` avec `signals`) ; `AdminUserFile.trust` ; `AdminReportItem.targetTrustLevel`, `priority` = seuil de 3 **ou** membre visé `HIGH_RISK`.
5. **auth-service** : `assessTrust(userId)` (dans `admin-users.service.ts`, réutilisé par la fiche et la file), `report.service.ts` reçoit `trustFor` injectable (spec mise à jour : un `HIGH_RISK` est prioritaire avec un seul signalement).
6. **admin-ui** : carte « Risque interne (D29 ②) — invisible du membre » sur la fiche (niveau, score, facteurs avec leurs points, plafonds et leur raison, activité du mois, rappel « un score ne sanctionne rien »), badge de niveau sur la file des signalements, groupe « Confiance » sur la page Paramètres.
7. **user-ui** : `NEW_ACCOUNT_CAP` dans les codes connus du parcours de réservation et le message FR/EN (« le plafond se lève avec tes premiers envois terminés »).

### Preuves
deal **513** (+11 : règle pure ×5, plafonds ×2, chargement des signaux ×2, service ×2) · auth 162 (spec des signalements mise à jour) · tsc deal + auth + admin-ui + user-ui · miroir i18n · `settings-doc` · OpenAPI ×5 · build ×6. Recette : TRU1–TRU7 (DOC-METIER) — dans la recette globale.

### Reste
Portes D71 : poids réel au pickup (PRC-07) quand la remise le saisira, identité vérifiée (KYC), instantané du score dans le journal d'une sanction. Les pondérations se revoient sur les chiffres réels (PostHog + pilotage).

---

# `chore/deps` — dépendances : 49 vulnérabilités → 0, Nx 23, TypeScript 6 (préparation de la recette globale)

## Ce qui a été fait
1. **Correctifs non cassants** (`npm audit fix`, jamais `--force`) : 49 → 33. Puis **migration Nx officielle** `npx nx migrate 23.2.0` + `npm install` + `nx migrate --run-migrations` (25 migrations, aucune n'a touché le code : elles ont posé `ignoreDeprecations: "6.0"` dans les tsconfig et `.nx/migrate-runs` dans `.gitignore`) ; le guide `tools/ai-migrations` généré est retiré. La migration monte **TypeScript à 6.0.3**, `webpack` 5.110 et `webpack-cli` 7.2. Résultat : 33 → 16.
2. **Directs** : `postcss` 8.4.38 → ^8.5.28 (XSS), `esbuild` ^0.28.2, `@pmmmwh/react-refresh-webpack-plugin` ^0.6.3.
3. **Overrides** (`package.json`) pour les transitives qu'aucun paquet direct ne peut monter sans majeure : `uuid ^11.1.1` (via `imagekit` 6.0.0 — que l'audit propose de « corriger » en le rétrogradant à 1.5.0, le fossile de 2016 de A47 : refusé), `deepmerge-ts ^8.0.0` (via `@prisma/config` — l'alternative était Prisma 7, une majeure avec son propre chantier de configuration : porte), `qs ^6.15.4` (via `express` 4 / `body-parser`). Résultat : **0 vulnérabilité**. `npx prisma validate` + `generate` passent avec l'override.
4. **Preuves** : tsc ×8 (six services, user-ui, admin-ui) sous TypeScript 6, tests ×5 (auth 162, trip 209, deal 513, notification 99, message 36), build webpack ×6, `next build` d'admin-ui sous l'exécuteur Nx 23, OpenAPI ×5 régénérés sans diff, miroir i18n. `npm ls imagekit` toujours dédupliqué ; les copies `pino` imbriquées des services sont à la même version (pas de dérive).

### Reste
Portes : Prisma 7 (majeure : `prisma.config.ts`, adaptateurs), Express 5 (majeure : routage asynchrone, `req.query` en lecture seule), Next 16.3 suivi par `^`. À relancer à chaque chantier : `npm audit` doit rester à 0 avant une recette.

### Correctif du 06/09 — `fix/ts6-esmoduleinterop` (régression de démarrage)
Les six services démarraient puis plantaient : `TypeError: (0, express_1.default) is not a function` dans `dist/main.js`. Cause : la migration TypeScript 6 a écrit `"esModuleInterop": false` dans `tsconfig.base.json` pour « conserver » l'ancien défaut — or sous `module: nodenext` la valeur effective de TS 5 était `true`. Le typecheck passait, les tests aussi (leurs `tsconfig.spec.json` posent `true`), les builds webpack aussi (bundler sans exécuter) : seul le boot révélait l'absence de l'aide `__importDefault`. Correctif : `esModuleInterop: true` dans `tsconfig.base.json` (57 `__importDefault` réapparaissent dans le bundle deal-service), bundle lancé à blanc et `/health` → `ok`. Au passage : Nx 23 (`@nx/js:node`) ouvre l'inspecteur Node sur 9229 pour chaque service (« address already in use » ×5, sans conséquence) → un `port` d'inspecteur par service dans `apps/*/package.json` (9230 → 9235). Leçon (CLAUDE.md) : après une montée d'outillage, un build vert n'est pas un service démarré — lancer un bundle et l'interroger. Outillé depuis : `scripts/smoke-services.sh` démarre les six bundles sur des ports décalés de +900 (aucun conflit avec `npm run dev`), coupe les crons et les relais, lit `/health` (ou `/gateway-health`) et sort en erreur si l'un d'eux ne répond pas. Piège au passage : la variable de port n'est pas la même partout (`PORT` pour le gateway, auth, trip et deal ; `NOTIFICATION_SERVICE_PORT` ; `MESSAGE_SERVICE_PORT`) — le premier essai a démarré notification-service sur le port réel et affiché `EADDRINUSE`.

---

# D72 + A146 → A148 — `fix/anomalies-documentation` : les quatre anomalies trouvées en écrivant la documentation

Écrire les quatre livrables de documentation a obligé à relire le code ligne à ligne. Quatre écarts en sont sortis, tous vérifiés avant correction.

## 1. Un trajet s'annulait en laissant ses deals derrière lui (D72)

**Symptôme.** `POST /trips/:id/cancel` n'avait aucune garde : le trajet passait à CANCELLED, les réservations restaient ACCEPTED ou PICKED_UP, personne n'était remboursé ni prévenu. Le code portait la trace de l'oubli depuis le début : « NOTE chantier Booking : si hasActiveBookings, déclencher ici les side-effects ». Conséquence sur l'argent : l'Expéditeur qui annulait ensuite lui-même subissait le barème ANN-01 (retenue) alors que la défaillance venait du Voyageur.

**Correctif.** La transition `cancel` reçoit le garde `noActiveBookings`, déjà porté par `edit` et `unpublish`. Le contrôleur distingue ce refus des autres : 409 typé `{ type: "trip", code: "TRIP_HAS_ACTIVE_DEALS", activeDeals }` (nouveau `countActiveBookings`), et « Mes trajets » affiche « annule-les d'abord », avec le nombre. Le Voyageur passe donc par `POST /deals/:id/cancel` deal par deal : chemin existant, testé, qui applique la vraie règle ANN-02 (remboursement intégral, annulation imputée au Voyageur, réputation). La cascade automatique a été écartée : elle exigerait que trip-service exécute la machine d'état qui vit dans deal-service avec l'argent.

**Fichiers.** `apps/trip-service/src/services/trip-state-machine.ts`, `services/booking-queries.ts`, `controllers/trip.controller.ts`, `openapi/build-openapi.ts` (409 documenté), `apps/user-ui/src/components/trips/list/MyTripsList.tsx`, `messages/{fr,en}/myTrips.json`. Deux tests de la machine mis à jour : `cancel` disparaît des actions offertes quand un deal est vivant.

## 2. Trois portes cassées en production par un code d'erreur muet (A146)

**Symptôme.** Le middleware d'erreurs n'exposait `details` en production que si `details.type` figurait dans une liste de sept types sûrs. Or plusieurs erreurs posent un `code` **sans** `type` : `SUDO_REQUIRED` (la porte du mode sensible, D65), `EXPORT_RATE_LIMITED` (D63), les refus de la messagerie (`DELIVERY_CODE_IN_MESSAGE`, `OWN_MESSAGE`, `NOT_A_TEXT`, D61) et de signalement (D68). En développement tout marchait ; en production le front recevait un 403 sans code, donc n'ouvrait jamais la porte sudo — une fonctionnalité entière morte sans erreur visible.

**Correctif.** Un `code` est public par contrat : c'est ce que le client lit et traduit. Le middleware expose désormais `details` dès que `details.code` est une chaîne, en production comme ailleurs. La liste des types sûrs reste pour les détails sans code (elle gagne `"trip"`). Quatre tests couvrent les quatre chemins, dont le cas « ni code ni type sûr reste caché en production ».

**Fichiers.** `packages/error-handler/error-middleware.ts`, `apps/auth-service/src/utils/error-details.spec.ts`.

## 3. Le limiteur du gateway ne voyait jamais personne (A147)

**Symptôme.** `max: (req) => (req.user ? 1000 : 100)` : aucune authentification ne tourne au gateway, `req.user` n'y existe jamais. La branche « membre connecté » était morte et **tout le monde** vivait avec 100 requêtes par quart d'heure — qu'une navigation normale atteint.

**Correctif.** Le gateway vérifie la **signature** du jeton (cookie membre, cookie admin, puis Bearer) avant d'accorder le plafond haut. Se fier à la présence d'un cookie aurait suffi à l'offrir à qui pose un cookie bidon ; une vérification HMAC coûte une empreinte et ne se contrefait pas. La règle vit dans `packages/middleware/rate-limit-tier.ts` (pure, vérificateur injecté) et se teste depuis auth-service, comme la bibliothèque TOTP.

## 4. Les rappels d'onboarding n'étaient jamais partis (A148)

**Symptôme.** `startOnboardingReminderCron()` était écrit, correct, enveloppé d'un battement — et appelé nulle part. Depuis la création du projet, aucun Voyageur bloqué en cours d'inscription n'a reçu de rappel.

**Correctif.** Démarré dans `main.ts` (`ONBOARDING_REMINDER_CRON_ENABLED=false` pour le couper), avec deux garde-fous absents : le destinataire saute `isDeleted` **et** `emailSuppressedAt` (règle générale D35 que ce cron ignorait), et un âge maximum de 30 jours évite de réveiller un compte abandonné depuis des mois avec un « dernière chance ». La sélection devient une règle pure testée (`utils/onboarding-reminder.rules.ts`, cinq tests). Les sujets disaient encore « Tripper » : corrigé (A144).

### Preuves
trip 209 · auth **175** (+13 : plafond du limiteur ×3, rappel d'onboarding ×5, exposition des codes ×4, plus l'existant) · deal 513 · notification 99 · message 36 · tsc ×8 · miroir i18n · OpenAPI ×5 · build ×6 · `scripts/smoke-services.sh` : six services démarrés.

### À surveiller à la mise en production
Le premier tour du cron de rappel enverra un email à chaque Voyageur bloqué depuis moins de 30 jours. Vérifier le volume avant de l'activer, ou le laisser coupé le temps d'un premier passage.

---

# `fix/divergences-documentation` — aligner les documents de gouvernance et les écrans sur le code

Les quatre livrables ont relevé 29 écarts entre ce que disent les documents et ce que fait le code. Le code fait foi (règle de précédence de `CLAUDE.md`) : ce lot corrige les documents, et les quelques écrans qui promettaient autre chose que le comportement réel.

## Documents corrigés
| Document | Correction |
|---|---|
| `CLAUDE.md` | « 9 statuts, 12 transitions » → **16 transitions** (annulation SYSTEM, litige depuis PICKED_UP, deux résolutions ADMIN de D55) ; export nominatif « SUPER_ADMIN seul » → SUPER_ADMIN **ou PRIVACY** (A143) |
| `YAMBA-REGLES-METIER-V2.md` | ANN-03 récrite (D72 : refus au lieu de cascade, avec la rédaction d'origine conservée) ; REP-03 : les niveaux sont informatifs, le modificateur réputation du prix n'a jamais été branché (D53 6A) ; RGP-02 : l'information du destinataire passe par la page de suivi (D69), le SMS reste une porte ; SES-01 : deux profils de session, plus un pour l'admin |
| `YAMBA-SPECIFICATION-COMPLETE.md` | Encadré de révision : pas de `payment-service` ni de `media-service` (D38, D42), 16 transitions dont deux ADMIN, DISPUTED non terminal, D72 |
| `YAMBA-DOC-METIER.md` | RG-ADM-09 « quatre profils » → six ; RG-ALR-01 et RG-ALR-04 : les seuils sont réglables depuis D62 |
| `docs/SPECIFICATIONS-WORKFLOW-BOOKING-YAMBA.md`, `docs/DOC-METIER-TRIP-LIFECYCLE.md`, les deux documents fonctionnels de mai 2026 | Avertissement en tête : ce qui a changé, où lire l'état réel. Documents conservés pour l'intention, jamais supprimés |

## Écrans corrigés
- Accueil, Finances : les sous-titres annonçaient encore des lots livrés depuis (« arrivent avec C-PR6 », « avec C-PR5b »).
- À arbitrer : « 72 h après l'ouverture » écrit en dur alors que le délai est réglable ; le texte renvoie au paramètre, la date exacte reste affichée par dossier. Même correction dans le formulaire de décision.
- **La file d'arbitrage lit enfin ses filtres depuis l'URL** : les tuiles d'accueil et les alertes pointent vers `/disputes?decidable=1` ou `?kind=RETENTION`, et ces liens ne filtraient rien. La page est enveloppée d'une frontière `Suspense`, comme Next 16 l'exige avec `useSearchParams`.
- Journal : `REPORT_REVIEWED` (D68) n'avait pas de libellé, le journal affichait le code brut.
- Le commentaire du bouton d'export disait « SUPER_ADMIN seul ».

### Écarts laissés tels quels, et pourquoi
Les paramètres de classe C (tolérance de poids, plafond de la protection de base, supplément de catégorie) restent nommés sans consommateur : c'est la règle de D62, un paramètre n'entre au catalogue que lorsqu'un code le lit. Les noms de règles d'alerte gardent leur seuil d'origine (`PAYOUT_FAILED_48H`) : les renommer casserait le dédoublonnage quotidien qui s'appuie sur la clé. RG-20 (filet de complétion à 7 jours) reste non implémenté : le cron d'arrivée plus 24 heures fait le travail.

---

# `fix/recette-affichage` — trois retours de recette et un seed qui ne passait plus

## 1. Pas de croix pour fermer la porte de connexion sur mobile
`AuthGateModal` affichait la croix **seulement** sur grand écran ; sur téléphone, la poignée de glissement seule n'indique pas comment fermer, et le lien « Plus tard » est au bas d'un panneau qui défile. La croix est désormais rendue dans les deux cas (plus petite et plus proche du bord sur mobile), la poignée reste. Fichier : `apps/user-ui/src/components/auth/shared/AuthGateModal.tsx`.

## 2. Le tiret sous la ville d'arrivée, dans les cartes de recherche
`mapTripToYambaResult` renvoyait **le caractère « — »** comme heure d'arrivée quand le trajet n'en a pas (`arrivalAt` absent) ; la carte l'affichait à la place d'une heure. Le champ est maintenant **absent** (`arrivalTime?: string` dans le contrat de recherche et dans le mapper) : la ligne disparaît, ce que la carte savait déjà faire. La carte mobile ne rend plus rien non plus. Le séparateur en pointillés au-dessus de l'exemple de prix devient un filet clair : c'est la même information, moins bruyante.

## 3. Ce que ces cartes révélaient vraiment : des trajets de seed incomplets
Les trajets créés par `seed-deals.ts` n'avaient **ni heure d'arrivée ni prix** : d'où le tiret et le « à partir de 0,00 € » sur des annonces pourtant publiées (un trajet sans prix n'est pas réservable ; en production la garde de publication l'interdit, le seed écrit en base et la contourne). Le seed pose désormais `arrivalAt` (départ + durée de vol déclarée par trajet, de 6 à 12 h) et un prix au kilo par défaut de 9,50 € quand le trajet n'en déclare pas.

## 4. Le seed ne passait plus du tout
Découvert en le rejouant : `seed-deals.ts` échouait sur `prisma.booking.create()` — `category: "COSMETICS"` n'existe pas dans `ParcelCategory` (c'est `COSMETICS_CARE`, et c'est une **famille**, pas une catégorie). Deux réservations concernées, corrigées en `OTHER_ACCESSORIES`. L'échec est antérieur à ce lot (vérifié en rejouant le seed sur `dev`) : la remise à zéro de recette était cassée, ce qui aurait bloqué l'étape P3 de la fiche de recette globale.

## 5. Connexion Google : le code est là, la configuration manque
`GOOGLE_CLIENT_ID` et `NEXT_PUBLIC_GOOGLE_CLIENT_ID` sont vides dans le `.env` racine et absents de `apps/user-ui/.env.local`. Sans identifiant public, le bouton affiche « Connexion Google bientôt disponible » — comportement voulu (D47), pas une régression. Il faut créer un identifiant OAuth dans la console Google, autoriser les origines de développement, renseigner les deux variables, puis redémarrer le front.

### Preuves
trip **209** (spec du mapper mise à jour : plus de tiret) · tsc user-ui + trip · build · miroir i18n · OpenAPI ×5 · seed rejoué de bout en bout (22 réservations) · recherche vérifiée en direct : heures d'arrivée servies, prix au kilo présents.

---

# A149 → A151 — `feat/admin-audit-filters-alerts` : le journal se fouille, les alertes ont leur page

## 1. Le journal d'audit devient consultable (A149)
`GET /admin/audit` ne prenait qu'un curseur : le seul moyen de retrouver une action était de dérouler. Il accepte maintenant six filtres, tous portés par ce que Mongo indexe.

| Filtre | Paramètre | Remarque |
|---|---|---|
| Période | `from`, `to` | Une date seule (`2026-09-12`) inclut la journée entière ; un instant ISO est pris tel quel |
| Auteur | `adminUserId` | Index `[adminUserId, createdAt]` |
| Action | `action` | Nouvel index `[action, createdAt]` |
| Type de cible | `targetType` | Index `[targetType, targetId]` |
| Identifiant de cible | `targetId` | |
| IP | `ip` | Égalité |

Règle pure `apps/auth-service/src/lib/admin-audit.query.ts` : **une valeur mal formée est ignorée, jamais une erreur** — un journal ne répond pas 400 parce qu'un identifiant a été mal collé. La réponse renvoie `appliedFilters`, la liste des filtres réellement retenus, pour que l'écran n'affiche pas un filtre sans effet. Cinq tests.

Côté écran (`AuditTable.tsx`) : les six filtres serveur, plus une recherche « contient » **sur les lignes chargées**, détail compris — le détail est du JSON, il ne s'indexe pas, et l'écran l'écrit sous les filtres plutôt que de faire croire à une recherche globale. Le détail est rendu lisible (`clé : valeur · clé : valeur`) au lieu du JSON brut, et chaque valeur du tableau est cliquable pour filtrer dessus.

## 2. Les alertes de seuil quittent l'accueil (A150)
Les neuf règles s'affichaient toutes sur l'accueil : à trois alertes ouvertes, il fallait dérouler avant d'atteindre les compteurs. L'accueil garde **une ligne** — nombre d'alertes, dont critiques, titre de la plus grave, lien. La page `/alerts` (permission `kpi.read`, entrée « Alertes » dans la navigation) affiche le détail groupé par gravité, avec le nombre d'éléments concernés, le lien d'action, et **les seuils qui ont servi au calcul** renvoyant vers la page Paramètres.

## 3. L'avertissement de clé React sur la page Paramètres (A151)
`PlatformSettingsEditor` rendait `<><tr key={…}>…</tr>{ligne d'historique}</>` : la clé était posée sur un enfant du fragment, jamais sur l'élément de la liste. React réclamait une clé à chaque rendu. Corrigé en `<Fragment key={def.key}>`.

### Preuves
auth **180** (+5 : filtres du journal) · tsc auth + admin-ui · `next build` admin-ui · OpenAPI ×5 (les six paramètres documentés) · index Prisma ajouté.

---

# `fix/booking-location-undefined` — l'écran de réservation plantait sur un trajet sans lieu

**Symptôme.** `Cannot read properties of undefined (reading 'kind')` dans `LocationDisplay`, à l'ouverture de l'étape 1 de la réservation : écran blanc, réservation impossible.

**Cause.** `StepParcel` traite deux cas seulement — plusieurs lieux (une liste de choix) ou **un** lieu (`trip.pickupOptions[0]`). Un trajet **sans aucun lieu** tombe dans le second et passe `undefined`. La garde de publication exige au moins un lieu de remise et un de livraison, mais le seed écrit en base et la contourne : les trajets de recette n'en avaient aucun. Même famille que le tiret d'heure d'arrivée et le prix à zéro corrigés la veille — trois symptômes, une seule cause : un jeu d'essai incomplet, et des écrans qui supposaient des données complètes.

**Correctif, en deux temps.**
1. **L'écran ne suppose plus.** `LocationDisplay` rend `null` sur une entrée absente ; `StepParcel` distingue désormais trois cas et affiche, quand la liste est vide, « le Voyageur n'a pas précisé de lieu : vous conviendrez du point de rendez-vous dans la conversation ». C'est exact : `pickupPlace` est facultatif dans la demande de réservation, le rendez-vous se convient dans le fil (D61). Nouveau composant `LocationMissing`, clé `step1.locationMissing` FR/EN.
2. **Le seed pose des lieux réalistes** : un terminal de départ et un hall d'arrivée sur chaque trajet, ce qui correspond au cas courant d'un vol.

### Preuves
tsc user-ui · miroir i18n 29 namespaces · seed rejoué · trajet public vérifié en direct : les deux lieux sont servis.

---

# A152 — `feat/error-pages` : les deux fronts ont des pages d'erreur

Constat de recette : un plantage affichait au membre `BookingFormUi.tsx (615:41)` et la trace de Next. Ni le site ni le back-office n'avaient de frontière d'erreur, de page « introuvable » ni de filet global.

## Ce qui est livré

| Fichier | Rôle |
|---|---|
| `apps/user-ui/src/app/[locale]/error.tsx` | Frontière de toutes les pages du site |
| `apps/user-ui/src/app/[locale]/not-found.tsx` | Page introuvable du site |
| `apps/user-ui/src/app/global-error.tsx` | Filet quand le layout racine casse |
| `apps/admin-ui/src/app/error.tsx`, `not-found.tsx`, `global-error.tsx` | Les mêmes pour le back-office |
| `messages/{fr,en}/errors.json` | Namespace `errors` (30 namespaces) |

## Les trois décisions de conception
1. **Jamais la trace au membre.** On affiche une **référence d'incident** de huit caractères, copiable, qui est l'identifiant de l'événement Sentry : le support la retrouve en une recherche. Un lien d'email au support la reprend en objet.
2. **Répondre à la question réelle.** Un plantage dans le tunnel de réservation ne pose qu'une question : « ai-je été débité ? ». La réponse arrive avant tout le reste, en vert, et elle est exacte — l'autorisation de paiement n'a lieu qu'à la création de la demande. La détection se fait sur le chemin (`/book`, `/bookings`).
3. **La bonne action.** « Réessayer » appelle `reset()` et relance le rendu. Mais si l'erreur est un `ChunkLoadError`, c'est qu'une version a été publiée pendant la navigation : réessayer ne peut pas marcher, seul un rechargement récupère le nouveau code. Le message et le bouton changent alors.

La page introuvable ne propose pas un lien d'accueil mais les deux gestes du produit — chercher un trajet, en publier un — et nomme les causes fréquentes : trajet supprimé, profil masqué (D67). Le membre comprend que le lien n'est pas cassé de son fait.

Côté back-office, le public change : un opérateur veut savoir quoi faire et quoi transmettre. La référence **et** le message technique court sont affichés. La page introuvable rappelle qu'un écran absent du menu peut simplement manquer à son profil.

`global-error` ne se déclenche que si le layout racine lui-même casse : ni traductions, ni thème, ni police. Il porte donc ses propres `<html><body>`, un texte court écrit en dur dans les deux langues, et un seul bouton.

### Preuves
tsc user-ui + admin-ui · `next build` des deux · miroir i18n 30 namespaces.

### Limite
Une référence d'incident n'a de valeur que si Sentry est configuré. Sans `NEXT_PUBLIC_SENTRY_DSN`, seul le `digest` de Next s'affiche, moins parlant. Voir le guide de configuration.

---

# `docs/cahiers-recette` — quatre cahiers de recette de bout en bout

La fiche `context/YAMBA-RECETTE-GLOBALE-2026-09.md` consignait 103 scénarios extraits des grilles par lot. Elle ne disait pas **comment** jouer un scénario. Ces quatre cahiers le disent : préconditions, étapes numérotées, résultat attendu mot pour mot, vérification complémentaire.

| Cahier | Scénarios | Mots | Particularité |
|---|---|---|---|
| `RECETTE-01-WEB.md` | 344 sur 32 domaines, 6 parcours longs, 12 non-régressions | 47 400 | Devis calculés d'avance (32,20 €, 40,25 €, 257,60 €…) : le testeur tranche sans interpréter |
| `RECETTE-02-ADMIN.md` | 125 | 36 100 | Chaque geste se vérifie **deux fois** : à l'écran et dans le journal, y compris les cas où aucune ligne ne doit être écrite |
| `RECETTE-03-API.md` | 146 | 27 300 | Entièrement en ligne de commande ; prouve que les gardes sont serveur, pas seulement d'interface |
| `RECETTE-04-CRONS.md` | 90 | 24 900 | Pour chaque tâche : comment rendre un élément éligible, comment forcer un passage, quelle preuve regarder |

## Trois défauts trouvés en les écrivant, corrigés ici

1. **`scripts/redpanda-bootstrap.sh` ne créait qu'un sujet sur deux.** `messaging-events` manquait alors que le relais du message-service en dépend, et l'auto-création est coupée au niveau du cluster. Sur une machine neuve, ce relais **parquait des événements pourtant sains** — panne silencieuse, difficile à relier à sa cause. Le script crée désormais les deux sujets, en restant relançable.
2. **L'en-tête du cron de versement annonçait un plafond de dix essais**, supprimé avec D58 : le rejeu est espacé, sans limite.
3. **Le sous-titre de la page Pilotage** annonçait encore l'arrivée des alertes de seuil, qui ont leur page depuis A150. Trois sous-titres périmés avaient été corrigés, celui-là avait échappé.

Le tableau transverse des tâches planifiées est également corrigé : le cron de purge des événements tourne dans deux services et non trois, et le rappel d'inscription n'est plus « jamais démarré » depuis A148.

## Ce que les cahiers signalent sans le corriger
Deux tâches — le récapitulatif quotidien et le rappel d'inscription — n'ont ni bail ni verrou : deux instances enverraient deux fois. Sans objet aujourd'hui, à traiter avant un déploiement multi-instances. Une carte de battements mal formée désarme la surveillance en silence. Enfin, plusieurs écrans portent encore des données de maquette (un nom, un IBAN partiel, un montant) et une seconde source de textes de réservation emploie un vocabulaire dépassé : chaque point est un scénario de contrôle, pas une correction de ce lot.

---

# C-PR6d (D74) — les quatre ratios qui manquaient au pilotage

## Le constat qui a déclenché le lot

Un audit du back-office, mené avant l'ouverture commerciale, a donné un résultat inconfortable : dix-huit tuiles d'accueil, neuf règles d'alerte, treize courbes de pilotage, neuf colonnes par corridor, un rapport financier mensuel — et **aucun des indicateurs qui disent si le modèle fonctionne**.

| Indicateur cherché | Ce qu'on a trouvé |
|---|---|
| Taux de demandes acceptées | Affiché par corridor. Au global, il n'existait que comme condition de l'alerte `ACCEPTANCE_RATE_LOW_7D`, donc invisible tant qu'il ne se dégradait pas sous 30 % |
| Ventilation refus / expiration | Aucune agrégation : `buildSeries` ne comptait `cancelled` que pour `status === "CANCELLED"` |
| Commission moyenne par colis | Le revenu du mois et le nombre de deals terminés sont affichés **sur la même ligne** du rapport, la division n'était faite nulle part |
| Litiges rapportés aux livraisons | Les deux courbes existaient, le ratio jamais |
| Sinistralité par catégorie | Catégorie et montant remboursé existaient **par dossier**, aucun regroupement |

Autrement dit : les numérateurs et les dénominateurs étaient déjà calculés. Il ne manquait que la division, et la discipline qui va avec.

## Ce qui est livré

**Côté auth-service, `apps/auth-service/src/lib/pilotage.rules.ts`.** Six champs de plus par point de série :

```ts
requestsAccepted   // demandes de la période finalement acceptées
requestsDeclined   // refusées par le Voyageur
requestsExpired    // expirées faute de réponse en 24 h
acceptanceRatePct  // acceptées / (acceptées + refusées + expirées), null si aucune décidée
deliveredDisputed  // livraisons de la période ayant fini en litige
disputeRatePct     // litiges / livraisons, null si aucune livraison
```

**Côté deal-service, `apps/deal-service/src/services/admin-finance.rules.ts`.** Un champ de plus par ligne mensuelle (`avgRevenuePerCompletedCents`) et une fonction nouvelle, `buildClaimsReport`, qui produit le registre de sinistralité par mois de décision, catégorie et devise.

**Côté back-office.** Une section « Taux » dans le pilotage, deux tuiles et un tableau par période ; une colonne « Revenu moyen / deal » et une section « Sinistralité » dans le rapport financier.

Aucune requête nouvelle n'a été ajoutée au pilotage : le `select` du contrôleur portait déjà `status`, `acceptedAt`, `deliveredAt` et `disputedAt`. Le rapport financier gagne une lecture des litiges tranchés, plus une lecture des deals concernés pour en reprendre la devise.

## Les trois décisions de conception

### 1. Le taux se calcule sur la cohorte, jamais sur la période de la réponse

C'est le cœur du lot, et c'est ce qui rendait l'ancien calcul faux.

L'alerte existante divisait les acceptations d'une fenêtre par les demandes de la même fenêtre. Ces deux nombres ne portent pas sur la même population : une demande faite le 30 août et acceptée le 2 septembre est au dénominateur d'août et au numérateur de septembre. Sur une fin de campagne, ce calcul peut dépasser 100 %.

La version retenue compte le **sort** d'une demande dans la période où elle a été *faite* :

```ts
let p = at(b.requestedAt);
if (p) {
  p.requests += 1;
  if (b.acceptedAt) p.requestsAccepted += 1;
  else if (b.status === "DECLINED") p.requestsDeclined += 1;
  else if (b.status === "EXPIRED") p.requestsExpired += 1;
}
```

La courbe « Acceptations », elle, ne bouge pas : elle continue de compter à la date de l'acceptation. Les deux lectures coexistent parce qu'elles répondent à deux questions différentes, et le test le vérifie explicitement.

Le `else if` en cascade porte une règle métier : une demande encore `PENDING`, ou annulée par l'Expéditeur avant réponse, **n'entre dans aucun des trois compteurs**. Elle n'a pas été décidée par le Voyageur, donc elle ne dit rien de son taux d'acceptation. C'est une exclusion volontaire, pas un oubli.

### 2. Un dénominateur vide donne `null`, jamais zéro

```ts
export function ratePct(numerator: number, denominator: number): number | null {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : null;
}
```

À dix colis par mois, afficher « 0 % de litiges » pour un mois sans aucune livraison ferait passer une absence de données pour un résultat, et personne ne s'en apercevrait. L'interface rend `null` par « — », et le texte de la page le dit : « — signifie pas de dénominateur, jamais zéro ».

C'est la même règle que celle déjà appliquée à `acceptanceRatePct` par corridor et à `avgPricePerKgCents`. Le lot l'étend, il ne l'invente pas.

### 3. La sinistralité se calcule côté serveur, pas dans la mesure d'audience

La tentation était de laisser la mesure d'audience produire ce registre, comme elle produit déjà les entonnoirs et la rétention (D66 5A).

Deux raisons l'interdisent, et elles ne se contournent pas.

La mesure d'audience **ne voit que les membres ayant consenti** : elle n'est jamais exhaustive, et une sinistralité partielle n'a aucune valeur devant un assureur. Et elle **ne porte pas les montants** : la liste blanche de propriétés qui protège les données personnelles exclut tout ce qui n'est pas un identifiant technique ou un montant déjà autorisé.

Le registre est donc bâti sur `Dispute`, groupé par **mois de décision** — la date à laquelle l'argent bouge, pas celle de l'ouverture :

```ts
if (r.resolutionOutcome === "PARTIAL_REFUND" || r.resolutionOutcome === "FULL_REFUND") {
  c.upheld += 1;
  c.refundedCents += r.resolutionRefundCents ?? 0;
} else if (r.resolutionOutcome === "REJECTED") {
  c.rejected += 1;
}
```

Un litige encore ouvert n'y figure pas : il n'est pas un sinistre tant qu'il n'est pas tranché.

## Deux pièges rencontrés

**La devise n'est pas sur le litige.** Un `Dispute` ne porte aucun montant en devise : il faut la reprendre du deal. Le service lit donc les réservations concernées après coup, et **ignore les litiges dont le deal a disparu** plutôt que d'inventer une devise par défaut. Le test couvre ce cas.

**Le faux Prisma des tests n'avait pas de modèle `dispute`.** Ajouter une lecture dans `getReport` a cassé un test qui passait depuis des mois, avec une erreur peu lisible. C'est le rappel habituel : un objet mimant Prisma ne signale jamais qu'il lui manque une table, il rend `undefined` et la pile d'appel se déroule ailleurs.

Sur le filtre lui-même, une précaution : `resolvedAt: { gte: from }` ne ramène que les dossiers réellement décidés, un champ absent ne satisfaisant pas un `gte`. Le `status: "RESOLVED"` est ajouté pour que l'intention soit lisible sans connaître ce détail de Mongo — `Dispute.resolvedAt` fait partie des champs qui ont déjà coûté cher sur ce point.

## Ce qui n'a délibérément pas été fait

**La rétention et les cohortes d'Expéditeurs restent à la mesure d'audience.** Un arbitrage a été rendu (D66 5A) ; le réimplémenter côté serveur créerait une seconde vérité pour la même question.

**Le délai entre une recherche et une demande acceptée n'est pas mesuré.** Les recherches ne sont qu'un compteur journalier, sans horodatage ni identifiant de visiteur. L'obtenir supposerait de journaliser chaque recherche, donc de créer un traitement de données personnelles pour un indicateur que la mesure d'audience donne déjà.

**Les ratios ne sont pas des courbes agrandissables.** Le drill-down n'a pas de sens sur un ratio, et une courbe dessinerait un zéro là où il n'y a pas de dénominateur. Un tableau rend « — » correctement, et il affiche au passage la ventilation refus / expiration.

## Une limite assumée

Le taux de litige a pour dénominateur les **livraisons**. Un litige ouvert depuis `PICKED_UP` sans livraison — le cas « colis jamais remis », soit le plus grave — n'est pas à son numérateur. Il apparaît dans la sinistralité, catégorie `NOT_DELIVERED`.

Élargir le dénominateur aux prises en charge supposerait d'ajouter `pickedUpAt` aux séries, ce qui est un vrai gain par ailleurs, la prise en charge étant aujourd'hui invisible du pilotage. À faire le jour où le volume le justifie.

# Recette API — correction des deux anomalies bloquantes du chapitre 4 (ANO-API-01, ANO-API-02)

La campagne de recette du cahier n° 3 (API) a démarré le 8 septembre 2026. Le chapitre 4, celui qui
se joue en premier parce que tous les autres héritent de ses défauts, a produit 22 verdicts : 17 OK,
2 PARTIEL, 3 KO. Deux des KO tombent sous un critère que le cahier qualifie de **bloquant**. Ils sont
corrigés ici, dans la campagne même, avant de dérouler le chapitre 5.

## ANO-API-01 — un paramètre de pagination est une entrée utilisateur

`GET /api/trips/search?cursor=null` répondait **500** avec la forme « Something went wrong, please
try again! », c'est-à-dire une exception non gérée. Au journal du trip-service : une
`PrismaClientKnownRequestError` **P2023**, « Malformed ObjectID: invalid character 'n' … "null" »,
levée dans `searchTrips`.

La cause tenait en une ligne de `apps/trip-service/src/dto/trip-search.dto.ts` :

```ts
cursor: z.string().optional(),                                   // avant
limit:  z.coerce.number().int().min(1).max(50).optional().default(10),
```

`limit` était borné, `cursor` ne l'était pas : n'importe quelle chaîne traversait le schéma et
atteignait Prisma. Le cas n'est pas théorique — c'est le comportement d'un client qui renvoie
littéralement son `nextCursor` alors qu'il vaut `null` (sérialisé en la chaîne `"null"`), l'erreur
d'intégration la plus banale sur une pagination par curseur.

Le curseur est désormais validé au format ObjectId, **et la chaîne vide vaut « pas de curseur »** :

```ts
cursor: z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Identifiant MongoDB invalide (24 hex attendus)")
  .optional()
  .or(z.literal("").transform(() => undefined)),
```

Cette dernière clause n'était pas dans la première rédaction du correctif, et elle a immédiatement
provoqué une régression détectée par la contre-épreuve : un client qui envoie toujours le paramètre
(`?cursor=`) demandait la première page et recevait un 400. Le cas est couvert par un test.

## ANO-API-02 — la visibilité vérifiée après coup se lit dans le chronomètre

Fiche API-GW-18. Un trajet **masqué par Yamba** et un trajet **inexistant** rendaient bien le même
404 avec le même corps — la règle de non-divulgation semblait tenue. Mais sur 25 mesures :

| Cible | Médiane | Min | Max |
|---|---|---|---|
| Trajet masqué (existe) | 32,8 ms | 30,2 | 64,7 |
| Trajet inexistant | 12,2 ms | 11,2 | 20,4 |
| Profil privé (existe) | 26,5 ms | 22,8 | 30,7 |
| Profil inexistant | 11,3 ms | 10,2 | 15,2 |

Les distributions sont **disjointes** : le minimum du cas « existe » dépasse le maximum du cas
« n'existe pas ». Un tiers peut donc énumérer ce que la modération a caché sans jamais lire une
donnée — exactement ce que la sémantique 403/404 cherche à empêcher.

La cause n'est pas le 404, c'est **l'ordre des opérations**. Dans `trip.controller.ts`, la requête
chargeait le trajet et trois jointures (`user`, `avatar`, `carrierPage`), puis seulement ensuite
testait `isDeleted`, `status` et `hiddenByAdminAt`. Le cas inexistant ne payait aucune jointure, le
cas masqué les payait toutes. Le profil public d'auth-service suivait le même schéma.

La visibilité descend donc dans la requête, dans deux règles pures :

```ts
// apps/trip-service/src/lib/public-visibility.rules.ts
export function publicTripWhere(id: string) {
  return { id, status: "PUBLISHED", isDeleted: { not: true }, AND: [notHiddenFilter()] };
}

// apps/auth-service/src/utils/public-visibility.ts
export function publicProfileWhere(slug: string, currentUserId: string | null) {
  const or = [{ profilePublic: { not: false } }];
  if (currentUserId) or.push({ id: currentUserId });        // D67 1A : le propriétaire se voit
  return { publicSlug: slug, isDeleted: { not: true }, OR: or };
}
```

Trois points méritent d'être notés.

1. **`findUnique` devient `findFirst`.** Prisma refuse un critère non unique dans `findUnique` : dès
   qu'on ajoute `status` ou `isDeleted` à côté de l'`id`, il faut `findFirst`.
2. **Le piège maison Prisma + Mongo est respecté.** `notHiddenFilter()` (déjà présent dans
   `admin-trips.rules.ts`) fait `OR: [{ hiddenByAdminAt: null }, { hiddenByAdminAt: { isSet: false } }]`,
   parce qu'un `field: null` ne matche pas un document où le champ est **absent**. Même raison pour
   `isDeleted: { not: true }` plutôt que `isDeleted: false`, et `profilePublic: { not: false }`
   plutôt que `profilePublic: true`.
3. **Le test applicatif est conservé** derrière la requête : il ne s'exécutera plus, mais il protège
   le jour où quelqu'un modifiera le `where`.

Après correction, les médianes sont indiscernables : 13,6 ms contre 13,5 ms pour le trajet, 12,5 ms
contre 12,3 ms pour le profil, distributions superposées, corps toujours identiques. Les
non-régressions sont vérifiées : un trajet publié répond 200, un profil masqué répond 404 à un tiers
et **200 à son propriétaire** (D67 1A intacte).

## Tests

`apps/trip-service/src/dto/trip-search.dto.spec.ts` (9 cas), `…/lib/public-visibility.rules.spec.ts`
(3 cas), `apps/auth-service/src/utils/public-visibility.spec.ts` (4 cas). Référence de plateforme :
trip-service 209 → **221**, auth-service 183 → **187**, total 860 → **872**.

# Recette API — `/auth/me` cesse de suivre le modèle Prisma (ANO-API-06)

Fiche API-AUTH-09, **bloquante**. `GET /auth/me` construisait sa réponse par soustraction :

```ts
const { passwordHash, ...safeUser } = fullUser;   // avant
```

C'est le `spread + delete` que les règles non négociables du projet interdisent. La réponse suivait
donc le modèle `User` : **tout champ ajouté au modèle partait vers le client**. C'est exactement ce
qui s'est produit avec D54, écrit bien après ce contrôleur — `totpSecretEncrypted` (le secret du
second facteur, chiffré), `totpBackupCodeHashes` (les hachages des codes de secours),
`totpLastUsedStep` — auxquels s'ajoutaient les champs de modération interne
`suspensionProposedReason`, `suspensionProposedLevel`, `suspensionProposedByAdminId`.

Sur un compte sans 2FA, ces champs valent `null` : la lecture seule pouvait faire conclure au faux
positif. Des valeurs factices posées en base ont levé le doute — le membre recevait bien
`"totpSecretEncrypted":"FAKE-AES-GCM:…"`, les deux hachages, et le motif de modération rédigé
contre lui par un administrateur.

## La correction : une liste blanche qui se défend toute seule

`apps/auth-service/src/utils/me-projection.ts` porte deux constantes :

- **`ME_USER_SELECT`** — ce que le membre reçoit, passé tel quel en `select` Prisma ;
- **`ME_EXCLUDED_FIELDS`** — ce qui est tenu dehors, **avec sa raison en clair** (`totpSecretEncrypted:
  "secret du second facteur (D54), même chiffré"`), pour qu'un lecteur n'ait pas à fouiller l'historique.

Trois arbitrages méritent d'être écrits. `totpEnabledAt` **reste** : dire « la 2FA est active » ne
livre rien d'exploitable et le front en a besoin. `suspendedAt` / `suspensionReason` /
`suspensionUntil` **restent** : une sanction prononcée est notifiée au membre. Mais tout
`suspensionProposed*` **part** : une proposition est un état interne d'avant décision (D56), et
`suspendedByAdminId` ne regarde pas le sanctionné.

## Le test qui refuse le silence

Vérifier l'absence de `totpSecretEncrypted` aurait raté le prochain champ sensible. Le test
(`me-projection.spec.ts`) **lit `prisma/schema.prisma`**, extrait les champs du modèle `User` et
exige que chacun soit classé — renvoyé ou explicitement exclu :

```ts
const nonClasses = champsDuModele().filter((c) => !connus.has(c));
expect(nonClasses).toEqual([]);   // un champ ajouté au modèle doit être classé ici
```

Le jour où quelqu'un ajoute un champ à `User`, la suite d'auth-service échoue et l'oblige à décider.
C'est la même technique que le test A145 qui lit les `*.router.ts` pour refuser une route non
documentée : faire lire le code source par le test plutôt qu'espérer la vigilance.

Vérifié aussi : aucun des champs retirés n'était utilisé par `user-ui` ni `admin-ui`, et plus aucun
`spread + delete` sur un `User` ne subsiste dans le dépôt. auth-service : 187 → **192** tests.

# Recette API — le lot « domaine auth » : cinq anomalies du chapitre 5.1 (ANO-API-03, 05, 07, 08, 09)

Le cahier demande des PR **groupées par domaine**. Le chapitre 5.1 ayant été joué en entier
(34 fiches), voici les cinq anomalies d'auth-service corrigées ensemble.

## ANO-API-09 (bloquante) — l'export RGPD ne fonctionnait pas du tout

`POST /auth/me/data-export` répondait 500 : `privacy.service.ts` demandait `ticketNumber` sur
`Booking`, un champ qui n'existe que sur `Dispute` (`Booking` porte `disputeTicket`). Le **droit
d'accès** du RGPD (D63) était donc entièrement inopérant — une obligation légale, un geste mis en
avant dans l'interface.

Le service a pourtant ses tests, et ils passaient : ils injectent un faux Prisma, qui ne valide
aucun nom de champ. C'est le piège déjà consigné au chapitre 100 de l'apprentissage, rencontré ici
dans l'autre sens — **le mock accepte un champ qui n'existe pas**.

Le correctif tient en deux mots. Le garde-fou, lui, est le vrai livrable :
`privacy-export-fields.spec.ts` ne mocke rien, il **lit le source** de l'export, en extrait chaque
`db.<modèle>… select: { … }` et confronte les champs au modèle de `prisma/schema.prisma`. Vérifié
en réintroduisant le bug : le test échoue sur `Booking.ticketNumber`.

Conséquence directe : **API-AUTH-24**, fiche bloquante restée sans verdict faute d'export, a enfin
pu être jouée — et elle passe (le code de livraison est absent, le Voyageur totalement absent).

## ANO-API-08 (bloquante) — « mot de passe oublié » se trahissait par le chronomètre

Corps et statut identiques pour un compte existant et un compte inconnu, mais **95,7 ms contre
18,8 ms** sur 15 mesures, distributions disjointes : un seul appel suffisait à savoir si une adresse
a un compte Yamba. L'envoi SMTP se faisait dans la requête.

Le travail (compteurs anti-abus **et** envoi) part désormais en arrière-plan : la réponse ne dépend
plus de rien de ce qui suit. Cela referme au passage une seconde fuite, non temporelle — un compte
existant en cooldown recevait une erreur là où un compte inconnu recevait 200. Le même traitement
est appliqué à `/auth/password/resend`, qui portait la même faille. Après correction : 21,6 ms
contre 19,3 ms, plages superposées.

## ANO-API-07 (majeure) — une révocation qui ne révoquait que la moitié

« Couper cet appareil », « se déconnecter » et « changer de mot de passe » supprimaient la clé de
session Redis — donc le rafraîchissement répondait 401 — mais le **jeton d'accès restait accepté
15 minutes**. `isAuthenticated` ne consultait aucune liste de révocation, et pour cause : le jeton
d'accès ne portait que `{ id, roles }`, sans le moindre `jti`. Rien ne permettait de savoir de
quelle session il venait.

Décision d'architecture, donc **proposée au registre en D75 (candidate)** avant le code, comme
l'exige la règle du projet. Le jeton d'accès porte le `jti` de sa session (émission et rotation) et
le middleware vérifie `refresh_jti:<userId>:<jti>` — la clé que auth-service posait déjà. La
décision est isolée dans `packages/middleware/session-revocation.ts`, sans Redis, donc testable :

```ts
export function isSessionRevoked(jti: string | undefined | null, exists: number | null): boolean {
  if (!jti) return false;        // jeton d'avant le déploiement : il expire de lui-même
  if (exists === null) return false; // Redis muet : fail-open, une panne de cache ne déconnecte pas
  return exists === 0;
}
```

## ANO-API-05 (majeure) — 400 là où le contrat promet 409, 401 et 429

L'OpenAPI d'auth-service documente `409` pour un email déjà pris et `401` / `429` pour les refus
d'OTP. Le service répondait 400 partout. Le front web s'en sortait — il lit `details.code` — mais un
client **généré depuis le contrat**, c'est-à-dire le client mobile de D36, aurait codé des branches
jamais atteintes.

La cause était en amont : `AuthError`, `RateLimitError` et `ConflictError` **n'acceptaient pas de
`details`**. Utiliser le bon statut aurait fait perdre le code métier, d'où le repli historique sur
`ValidationError`. Les trois classes acceptent désormais un `details` (paramètre optionnel, aucun
appelant existant ne change), puis les sites de refus ont été reclassés.

## ANO-API-03 (mineure) — l'inscription s'arrêtait au premier champ fautif

La règle sort du contrôleur : `registration-rules.ts` (`collectRegistrationErrors`) est pure, sans
Redis ni Prisma — c'est ce qui la rend testable, la première tentative important `auth.helper` ayant
fait tourner Jest sans fin (connexions ouvertes). Tous les champs sont examinés et l'erreur porte
`details.errors` { champ → code }. Le mot de passe garde ses règles propres : seul fautif, son
erreur typée est relayée telle quelle, aucun client ne casse.

## Tests

auth-service 192 → **209** (+17). deal-service inchangé à 516, ce qui vérifie que l'enrichissement
de `@packages/error-handler` ne casse aucun appelant. Les six bundles passent
`scripts/smoke-services.sh` — `isAuthenticated` étant partagé, un défaut de résolution de
`@packages/libs/redis` aurait mis six services à terre.

# Recette API — le tri par prix ne perd plus de trajets (ANO-API-11), et un filtre inconnu ne casse plus une recherche (ANO-API-10)

## ANO-API-11 — un tri qui amputait l'offre

Mesure faite en recette : `sort=earliest` renvoyait **3** trajets, `sort=lowestPrice` **1**, et
`totalCount` tombait de 3 à 1. Le tri par prix s'appuie sur `comparablePriceCents` (D33) et
**excluait** les trajets qui ne l'avaient pas :

```ts
if (params.sort === "lowestPrice") {
  where.comparablePriceCents = { not: null };   // avant
}
```

En base : **7 trajets cherchables, 5 sans la valeur**. Le code de création la calcule pourtant
correctement — le trajet créé pendant la campagne l'avait (2400 = 1200 × 2 kg de référence). Ce sont
les trajets **antérieurs à D33** qui manquaient, et le script `backfill-comparable-price.ts`, prévu
pour cela, n'avait jamais été joué sur cette base.

Un correctif de données aurait suffi ce jour-là. Il n'aurait pas empêché le prochain trajet mal
formé de redevenir invisible. La cause est donc traitée sur **trois** plans.

**1. Un invariant à la publication.** Les champs dénormalisés sont recalculés au moment où le
trajet devient visible :

```ts
const denormalized = computeDenormalizedFields({ … }, comparableParamsFromSettings(await platformSettings().get()));
// … puis écrits dans le même update que status: "PUBLISHED"
```

Un trajet créé avant D33, ou par un chemin qui aurait oublié le calcul, **se répare tout seul** en
étant publié. Vérifié : champ effacé à la main → `null` avant publication → `1800` après.

**2. L'exclusion est retirée du tri.** Un tri change l'**ordre**, jamais le **nombre**. Le tri
secondaire passe à `comparablePriceCents` puis `minPriceCents` puis `id` : si une valeur manquait
malgré tout, le trajet remonte en tête au lieu de disparaître — un défaut d'affichage vaut mieux
qu'une offre invisible, et `totalCount` cesse de mentir.

**3. Le seed pose le champ.** C'est ce qui manquait pour que le défaut soit visible en recette :
un jeu d'essai qui n'a pas la donnée rend le tri par prix intestable, et personne ne voyait que
les deux tiers des trajets manquaient.

**Contre-épreuve** : base volontairement privée du champ sur les 28 trajets publiés →
`earliest` 2, `lowestPrice` 2, `bestRated` 2. Avant correction, `lowestPrice` aurait renvoyé 0.

## ANO-API-10 — un filtre strict au milieu de filtres tolérants

`categories=inventee` et `departureBuckets=matin,morning` étaient ignorés silencieusement ;
`mode=teleportation` répondait **400**. Un lien partagé, un favori de navigateur ou une ancienne
version de l'application portant un mode retiré du catalogue affichait donc une erreur au lieu
d'une recherche.

`mode` était un `z.enum` strict là où les listes passent par `csvOf`, qui filtre. Un `.catch("all")`
sur les **deux** schémas (recherche et facettes) aligne le comportement : une recherche dégrade,
elle ne casse pas.

## Tests

`apps/trip-service/src/lib/search-sort.spec.ts` (10 cas) : modes inconnus ramenés à `all`, modes
valides conservés, défaut inchangé, et non-régression des filtres déjà tolérants. trip-service
221 → **231**.

# Recette API — le plafond de valeur déclarée arrive avant l'argent (ANO-API-12)

Fiche API-DEAL-02, **bloquante** — c'est le catalogue des refus que tout client doit savoir
traduire. Sept des huit codes répondaient exactement. Le huitième, `NEW_ACCOUNT_CAP`, ne se
déclenchait **jamais** à l'autorisation de paiement.

Un compte créé trente secondes plus tôt obtenait une intention de paiement pour un colis déclaré à
**5 000 €**. Le plafond existe pourtant et fonctionne : à la création du deal, le service répond
bien `409 NEW_ACCOUNT_CAP` avec `cap: "DECLARED_VALUE"`, `limit: 30000`, `value: 500000`.

Le défaut était l'**ordre**. Dans `deal-request.service.ts` :

```ts
await trust.assertWithinCaps(user.id, { declaredValueCents: 0, … }); // avant
```

La valeur déclarée était passée **à zéro en dur**, si bien que le plafond `DECLARED_VALUE` ne
pouvait rien détecter à ce stade — alors que le commentaire de cette même ligne annonce
« avant d'autoriser l'argent ». Le refus tombait donc à l'étape suivante, **une fois la carte de
l'Expéditeur déjà pré-autorisée** : en production, une empreinte reste plusieurs jours sur le compte
d'un client pour un deal qui ne se fera pas.

**Correction.** `CreatePaymentIntentRequest` accepte désormais `declaredValueCents`, **facultatif** —
un client qui ne l'envoie pas garde exactement le comportement d'avant — et le service le confronte
aux plafonds avant d'autoriser. L'assistant de réservation connaît cette valeur avant de payer : il
n'y a aucune raison de la lui cacher jusqu'après le débit.

**Contre-épreuve** : compte neuf + 5 000 € déclarés → **409 `NEW_ACCOUNT_CAP`** dès l'autorisation ·
sans valeur déclarée → 201 (inchangé) · valeur raisonnable (200 €) → 201 · **compte ancien** +
5 000 € → 201, le plafond ne visant que les comptes récents ou à risque.

Tests : `payment-intent-caps.spec.ts` (4 cas, dont la non-régression du champ absent).
deal-service 516 → **520**. Les cinq `openapi.json` sont régénérés : le contrat public porte
désormais ce champ.

# Recette API — la page du destinataire était entièrement cassée (ANO-API-13), et le garde-fou devient systémique

Fiche API-DEAL-22, **bloquante**. `GET /api/track/{token}` — la page que l'Expéditeur partage au
destinataire pour suivre son colis — répondait **500** :

```
Unknown field `cancelledAt` for select statement on model `Booking`
tracking-link.service.ts:51
```

`Booking` n'a pas de champ `cancelledAt` : le seul champ d'annulation est `cancelReason`. La
fonctionnalité était donc **totalement inopérante**, et rien ne l'avait signalé.

## Le vrai sujet : c'est le deuxième cas identique de la campagne

`ANO-API-09` avait cassé l'export RGPD exactement de la même façon, dans auth-service : un `select`
demandant un champ inexistant, un test qui passait parce qu'il injecte un faux Prisma — lequel ne
valide aucun nom de champ. Un garde-fou avait alors été écrit **pour ce service**. Le défaut est
réapparu ailleurs.

La leçon est donc de portée : quand la même erreur survient deux fois dans deux services, le
correctif n'est pas un test de plus au même endroit, c'est un test qui couvre **le service entier**.

`apps/deal-service/src/services/prisma-select-fields.spec.ts` lit **tous** les fichiers source du
service, extrait chaque `select: { … }` posé sur un modèle Prisma, et confronte les champs demandés
à `prisma/schema.prisma`. Aucune base ouverte, aucun mock.

Deux pièges rencontrés en l'écrivant, qui valent d'être notés parce qu'un test injuste est pire
qu'un test absent :

1. **Les sous-sélections appartiennent à un autre modèle.** `select: { avatar: { select: { url:
   true } } }` sur `Booking` ne demande pas `Booking.url`. Le test aplatit donc les blocs imbriqués
   avant d'analyser les clés de premier niveau.
2. **Un appel sans `select` empruntait celui de l'appel suivant.** Chercher `select:` après
   l'accesseur sans borne remontait 53 faux positifs. L'extraction est désormais **bornée à l'objet
   d'arguments de l'appel courant**, accolades équilibrées.

Vérifié en réintroduisant le bug : le test échoue bien sur
`services/tracking-link.service.ts → Booking.cancelledAt`.

## Ce que la fiche a par ailleurs confirmé

Une fois la page réparée, elle est **exemplaire** : elle ne porte que `milestone`, `steps`,
`corridor`, les dates, `recipientFirstName`, `shipperFirstName` et le Voyageur. Aucun code à six
chiffres, **aucun montant**, aucun email, aucun nom de famille, aucun téléphone — vérifié par
recherche sur tous les chemins scalaires. Un jeton inventé répond 404.

deal-service 520 → **523**.

# Recette API — la notation par critères était impossible (ANO-API-14) : le piège d'exhaustivité de Zod 4

Fiche API-DEAL-20. Un Expéditeur qui note un Voyageur envoie les trois critères de ce rôle —
`PUNCTUALITY`, `COMMUNICATION`, `PARCEL_CARE`. Le serveur répondait **400**, en réclamant
`DECLARATION_CLARITY` et `RESPONSIVENESS` : **les critères de l'autre rôle**.

```ts
criteria: z.record(RatingCriterionSchema, RatingVoteSchema).optional()   // avant
```

Depuis **Zod 4**, un `record` dont la clé est une énumération est **exhaustif** : toutes les valeurs
de l'énumération deviennent obligatoires. En Zod 3, le même code produisait un enregistrement
partiel. Preuve isolée, hors de tout contexte applicatif :

```js
z.record(z.enum(["A","B"]), z.string()).safeParse({ A: "x" }).success        // false
z.partialRecord(z.enum(["A","B"]), z.string()).safeParse({ A: "x" }).success // true
```

La notation par critères — le cœur de la réputation (D53) — était donc **inutilisable**, sauf à
envoyer les cinq critères des deux rôles, ce qu'aucun client ne fait. Seul le contournement
« ne pas envoyer de critères du tout » fonctionnait, le champ étant facultatif.

**Pourquoi personne ne l'a vu.** Le typecheck passe : le type inféré est correct, c'est la
*validation à l'exécution* qui change. Les tests unitaires du service passent aussi, parce qu'ils ne
transmettent pas de critères. Et la description du schéma affirmait exactement l'inverse du
comportement réel : « only the criteria of the rated role are kept ».

**Correction** : `z.partialRecord` sur les deux occurrences — la requête et la réponse, car une note
ne porte jamais que les critères de son rôle. Vérifié qu'aucun autre `z.record(<enum>, …)` n'existe
dans le dépôt : les autres enregistrements ont des clés `string`, non concernées par le piège.

**Contre-épreuve** : les trois critères du rôle passent désormais la validation ; un critère inconnu
et un vote invalide restent refusés ; le double aveugle est intact (`myRating` visible,
`counterpartRating: null` tant que l'autre n'a pas noté).

Le test `booking-rating-criteria.spec.ts` (5 cas) couvre les deux rôles, le cas d'un seul critère,
les refus — et **documente le piège lui-même** en comparant `z.record` et `z.partialRecord`, pour
que la prochaine migration de Zod ne le réintroduise pas en silence. deal-service 523 → **528**.

# Recette API — deux arbitrages tranchés : le destinataire est minimisé, le verrou dit son horizon (ANO-API-15)

Ces deux points étaient laissés à l'arbitrage à l'issue du chapitre 5.3 : dans les deux cas, le code
contredisait le cahier **et s'en expliquait**. Les deux explications étaient partiellement justes ;
voici où passe la ligne.

## Le destinataire côté Voyageur : ce qui sert à livrer, quand cela sert

La vue Voyageur portait le destinataire **complet** — prénom, nom, téléphone **et email** — dès le
statut `ACCEPTED`, donc avant même d'avoir le colis en main. Le commentaire du mapper l'assumait :
« il en a besoin pour livrer ».

C'est vrai du **nom** : on ne remet pas un colis à un inconnu. Ce n'est pas vrai de l'**email**, qui
ne sert à aucun moment de la remise. Et le **téléphone** ne sert qu'une fois le colis en transit.

Le destinataire est un **tiers** : il n'est pas membre, il n'a rien accepté, et ses coordonnées ont
été confiées par l'Expéditeur pour un usage unique. La minimisation n'est donc pas une précaution de
principe — c'est la limite de l'usage pour lequel la donnée a été donnée.

| Étape | Ce que le Voyageur voit |
|---|---|
| Avant `PICKED_UP` | prénom et nom |
| À partir de `PICKED_UP` | prénom, nom **et téléphone** |
| Jamais | l'**email** |

La règle vit dans `apps/deal-service/src/lib/recipient-minimisation.ts`, pure et testée (9 cas dont
« l'email n'est jamais servi, à aucun statut »). La vue **Expéditeur est inchangée** : il voit ce
qu'il a saisi.

## Le verrou de livraison : un refus typé, avec son horizon

Après trois codes faux, le quatrième essai — et tous les suivants — répondaient
`TRANSITION_NOT_ALLOWED`, sans horizon. La garde de la machine refusait bien la transition, mais son
motif remontait comme un simple conflit d'état : le Voyageur, **debout devant le destinataire**,
lisait « action impossible » sans savoir quand réessayer, et un client qui traduit `DELIVERY_LOCKED`
perdait le fil entre le troisième essai et les suivants.

Le service vérifie désormais le verrou explicitement, **avant** la machine, et lève
`DELIVERY_LOCKED` avec `lockedUntil` et `attemptsLeft: 0`. La machine reste la source de vérité —
elle refuserait de toute façon — mais le service traduit ce refus dans le code que le contrat
annonce déjà (`booking-lifecycle.schema.ts` documente `DELIVERY_LOCKED` avec `details.lockedUntil`).

**Contre-épreuve** :

```
111111 → 409 DELIVERY_CODE_INVALID  attemptsLeft 2
222222 → 409 DELIVERY_CODE_INVALID  attemptsLeft 1
333333 → 409 DELIVERY_LOCKED        lockedUntil 2026-09-08T16:40:59.255Z
444444 → 409 DELIVERY_LOCKED        lockedUntil (identique)
bon code → 409 DELIVERY_LOCKED      lockedUntil (identique)
```

## Deux tests existants mis à jour, pas contournés

Ils documentaient l'ancien contrat : « le destinataire est visible côté Carrier » et « refus par le
guard machine ». Ils ont été **réécrits pour dire la nouvelle règle** — le premier vérifie
maintenant que le téléphone n'ouvre qu'à la prise en charge et que l'email ne sort jamais, le second
que le refus est typé et porte son horizon. Un test qui échoue après un changement voulu se met à
jour en expliquant pourquoi ; il ne se supprime pas.

deal-service 528 → **538**.

# Recette API — la boîte de notifications tombait, et aucun email ne partait (ANO-API-16, ANO-API-17)

Le chapitre 5.5 ne compte que quatre fiches. La dernière en a révélé deux défauts qu'aucun test, ni
le typecheck, ni le smoke ne pouvaient voir.

## ANO-API-16 (bloquante) — une notification de messagerie rendait la boîte entière illisible

`GET /me/notifications` répondait **500** pour le Voyageur. En cause, une `ZodError` : le type de
notification était une union **fermée** de clés `booking.*` et d'une clé système, alors que
message-service produit aussi `conversation.message_posted` et `conversation.meetup_proposed`
(D61). Vérifié en base : huit notifications de ce genre existaient. **Une seule suffisait** à faire
tomber toute la liste.

Le premier réflexe — ouvrir complètement le type — a été écarté par un test existant :

```ts
it("type hors contrat = rejet strict (le mapper est un garde, pas un tuyau)", () => {
  expect(() => toNotificationView({ ...record, type: "booking.hacked" })).toThrow();
});
```

Ce test a raison : un type **inventé** doit être refusé. Le défaut n'était donc pas que l'énumération
soit fermée, c'était **qu'elle était incomplète**, et surtout qu'un élément illisible emportait la
réponse entière. La correction traite les deux séparément :

1. **L'union reste fermée, mais complète** : elle réutilise `MESSAGING_EVENT_TYPES`, la liste que
   message-service publie déjà — plutôt que d'y recopier deux clés qui divergeraient au prochain
   événement.
2. **La lecture devient robuste** : une notification que le mapper refuse est **ignorée et
   journalisée** (identifiant + type), au lieu de faire échouer la liste. Le membre garde ses autres
   notifications ; l'exploitation voit dans les journaux ce qu'il faut ajouter au contrat.

C'est la nuance qui compte : le garde reste un garde, mais il ne casse plus la vitrine.

## ANO-API-17 (majeure) — aucun email transactionnel ne partait

Le journal du service répétait, à chaque événement :

```
ENOENT: …/apps/notification-service/apps/notification-service/src/emails/templates/booking/booking-requested-carrier.ejs
Booking email send failed — marked FAILED
```

Le segment est **doublé**. Le dossier des gabarits était résolu depuis le répertoire de travail :

```ts
const TEMPLATES_DIR = path.join(process.cwd(), "apps/notification-service/src/emails/templates");
```

Ce chemin n'est juste que si le service est lancé **depuis la racine du dépôt**. Lancé depuis son
propre dossier — ce que fait `scripts/smoke-services.sh`, et ce que fera n'importe quel conteneur —
il se double, et **plus aucun email ne part**. Silencieusement : l'événement est marqué `FAILED`,
rien ne remonte à l'appelant ni au membre.

Les gabarits sont désormais **copiés dans le bundle** (webpack `assets`) et résolus depuis
`__dirname`, avec un repli sur les sources pour les tests unitaires qui s'exécutent hors bundle.

**Contre-épreuve** : après la création d'un deal, deux emails sont réellement arrivés dans Mailpit —
« Nouvelle demande de transport Paris → Brazzaville » au Voyageur, « Reçu : paiement autorisé » à
l'Expéditrice.

## Ce que cet épisode dit de la méthode

Aucun de ces deux défauts n'était détectable autrement. Le typecheck passe : les chemins sont des
chaînes, les types sont inférés correctement. Les tests unitaires passent : ils ne lisent pas le
disque et n'exercent pas la validation de sortie sur des données réelles. Le smoke passe : il
vérifie `/health`, pas l'envoi d'un email.

Il fallait **provoquer une transition réelle et aller regarder la boîte aux lettres** — c'est
exactement ce que la bascule Mailpit, décidée au tout début de la campagne, a rendu possible.

# Recette API — la connexion trahissait l'existence d'un compte (ANO-API-18)

Fiche API-SEC-14, **bloquante**. Les corps sont rigoureusement identiques — 401
« Invalid email or password » dans les deux cas. Mais sur vingt mesures :

| | Médiane | Min | Max |
|---|---|---|---|
| Compte existant | **168,6 ms** | 146,7 | 370,9 |
| Compte inexistant | **20,4 ms** | 14,1 | 31,1 |

Distributions **disjointes** : le minimum du cas « existe » dépasse de cinq fois le maximum du cas
« n'existe pas ». Un seul appel suffit à savoir si une adresse a un compte Yamba.

La cause est le cas d'école :

```ts
if (!user) return next(new AuthError("Invalid email or password"));   // avant
const isMatch = await bcrypt.compare(String(password), user.passwordHash ?? "");
```

Un compte inexistant **sort avant le hachage** ; un compte existant le paie toujours. Tout le soin
pris à rendre les corps identiques est annulé par un chronomètre.

La même faille existait sur la **connexion administrateur**, où l'enjeu est plus grand encore :
elle laissait deviner *qui* est administrateur.

## La correction : payer le même prix dans les deux cas

`apps/auth-service/src/utils/password-timing.ts` compare le mot de passe **dans tous les cas**,
contre un hachage leurre de même coût (bcrypt, 10 tours) calculé au chargement du module — jamais
écrit en dur, jamais dérivé d'un secret réel :

```ts
const hash = passwordHash && passwordHash.length > 0 ? passwordHash : DUMMY_HASH;
const ok = await bcrypt.compare(password, hash);
return Boolean(passwordHash) && ok;
```

**Contre-épreuve** : 179,0 ms contre 180,6 ms, distributions superposées. La connexion valide répond
toujours 200.

Le test (`password-timing.spec.ts`, 6 cas) mesure le rapport des durées entre les deux chemins et
**refuse un facteur supérieur à 3** — assez large pour ignorer le bruit d'une machine de
construction, assez strict pour rattraper un retour en arrière qui réintroduirait un ordre de
grandeur d'écart.

## Une leçon de méthode, notée parce qu'elle a failli coûter cher

Le balayage du code de livraison (API-SEC-08) a dû être écrit **trois fois**. Les deux premières
versions affichaient « code absent partout » — rassurant, et entièrement faux : l'une passait les
cookies dans un argument mal formé (tout répondait 401), l'autre utilisait `head -n -1`, qui
n'existe pas sur macOS (tous les corps étaient vides).

Ce qui a sauvé la troisième, c'est le **témoin positif** : exiger que le code soit **présent** là où
il est légitime. Un test de sécurité qui ne trouve rien doit être suspecté avant d'être cru.

auth-service 209 → **215**.

---

# Recette API, chapitre 7 — idempotence et concurrence (ANO-API-19, 20, 21)

Trois anomalies, deux causes. Toutes les gardes métier tenaient : aucune double capture, aucun
double décrément de capacité, aucun compteur faussé. Ce qui manquait, c'était **la réponse rendue
au perdant**.

## ANO-API-19 et ANO-API-21 (bloquante, majeure) — un conflit d'écriture n'est pas une réponse

### Ce qu'on observait

Deux Expéditeurs réservent en même temps les derniers kilos d'un trajet. Un reçoit **201**, l'autre
**500 « Something went wrong, please try again! »**. La capacité, elle, restait juste (17 → 5 kg,
une seule réservation comptée). Deux fiches plus loin, même symptôme sur un double clic de
régénération du code de livraison.

Dans le journal, la même ligne :

```
Transaction failed due to a write conflict or a deadlock. Please retry your transaction
code: 'P2034'
```

### Pourquoi

MongoDB, comme tout moteur transactionnel, refuse la transaction perdante quand deux écritures se
disputent le même document. Ce n'est pas une décision métier : c'est un accident d'infrastructure,
et la base **dit elle-même quoi en faire** — réessayer. Personne ne rattrapait ce code : l'erreur
traversait la pile jusqu'au middleware d'erreur, qui n'y voyait qu'une exception inconnue, donc un
500. Elle partait aussi dans Sentry comme une vraie panne serveur.

### La correction

`apps/deal-service/src/lib/write-conflict-retry.ts` :

```ts
const WRITE_CONFLICT = "P2034";

export async function withWriteConflictRetry<T>(
  operation: () => Promise<T>,
  { tentatives = 3, delaiBaseMs = 25 }: { tentatives?: number; delaiBaseMs?: number } = {}
): Promise<T> { /* … */ }
```

Trois points de conception :

1. **Seul P2034 est rattrapé.** Toute autre erreur remonte intacte — y compris
   `BookingLifecycleError`, qui est le refus métier légitime. Rejouer ce qu'on ne comprend pas est
   le meilleur moyen de doubler un effet de bord.
2. **Le délai est court et légèrement aléatoire** (25 ms × essai + jitter) : deux perdants
   simultanés ne doivent pas se retrouver au coude à coude au réessai.
3. **Le rejeu est sûr** parce que la transaction avortée n'a rien validé, et parce qu'aucune de ces
   transactions ne fait d'appel externe en son sein — le fournisseur de paiement est toujours
   sollicité **avant** la transaction (règle posée en C-PR5b : « l'argent d'abord, puis une seule
   transaction conditionnelle »).

**La leçon d'ANO-API-21 :** la première correction avait été posée là où le défaut avait été *vu*
(la création de deal). La même cause a resurgi deux fiches plus loin, sur un autre chemin. La
protection a donc été remontée au **writer central** — `applyBookingTransition` dans
`booking-write.ts`, par où passent accepter, refuser, remettre, annuler, régénérer — puis appliquée
aux transactions restantes du service (`deal-mediation`, `admin-finance` ×2). Cinq transactions,
une seule règle.

Après correction : `A:201` / `B:409 CAPACITY_EXCEEDED`, capacité 5 → 1 kg ; et pour la
régénération, `200` + `409 TRANSITION_NOT_ALLOWED`, compteur 4 → 3.

## ANO-API-20 (majeure) — un refus qui ne se laisse pas lire par un programme

### Ce qu'on observait

Deux acceptations simultanées du même rendez-vous : un **200**, un **400** — le bon comportement.
Mais le corps du 400 :

```json
{ "message": "This meeting was just changed. Reload the conversation.", "details": null }
```

Aucun code. Et ailleurs dans le même service :

```
"This conversation is read-only (DISPUTE_OPEN)."
"Invalid meeting slot (TOO_SOON)."
```

La raison lisible par la machine était **dans la phrase**. Le front ne peut ni la traduire, ni
brancher dessus, ni distinguer ce refus d'une erreur de saisie.

### Pourquoi

Deux conventions coexistaient dans le même fichier : certains refus portaient déjà un
`details.code` (`DELIVERY_CODE_IN_MESSAGE`, fenêtre de révélation du téléphone), d'autres non. Et
surtout, **deux des quatre classes d'erreur ne pouvaient pas en porter** :

```ts
export class NotFoundError extends AppError {
  constructor(message = "Resources not found") { super(message, 404, true); }   // pas de details
}
export class ForbiddenError extends AppError {
  constructor(message = "Forbidden access") { super(message, 403, true); }      // pas de details
}
```

Un 403 ou un 404 métier n'avait donc **aucun moyen** de dire pourquoi.

### La correction

1. `packages/error-handler/index.ts` — `NotFoundError` et `ForbiddenError` acceptent `details`,
   comme `ValidationError`, `AuthError` et `ConflictError` le faisaient déjà. Additif : aucun
   appelant existant n'est cassé (le paramètre est optionnel).
2. `apps/message-service` — les seize refus portent un code : `CONVERSATION_READ_ONLY` (+ `reason`),
   `MEETUP_CHANGED`, `MEETUP_NOT_ACCEPTABLE` (+ `reason`), `INVALID_MEETUP_SLOT` (+ `reason`),
   `EMPTY_MESSAGE`, `NOT_A_PARTY`, `CONVERSATION_NOT_OPEN`, `MEETUP_NOT_FOUND`,
   `CONVERSATION_NOT_FOUND`, `DEAL_NOT_FOUND`, `MESSAGE_NOT_FOUND`, `MISSING_IDENTIFIER`,
   `ALREADY_REPORTED`, `REPORT_ALREADY_REVIEWED`. La raison machine a quitté la phrase.
3. **Le garde-fou** — `apps/message-service/src/services/refusal-codes.spec.ts` lit les sources du
   service, extrait chaque `new ValidationError(…)` / `ForbiddenError` / `NotFoundError` /
   `ConflictError` / `AuthError`, et échoue si l'un d'eux part sans `code:` — ou si une raison est
   encore cachée entre parenthèses dans le message. Même famille que les tests qui lisent
   `prisma/schema.prisma` (ANO-API-09, ANO-API-13) : faire lire le code par le test plutôt
   qu'espérer la relecture.

Le middleware d'erreur expose déjà `details` en production dès que `details.code` est une chaîne
(A146) : le code atteint donc réellement le client.

## Tests

`write-conflict-retry.spec.ts` (4 cas) et `refusal-codes.spec.ts` (3 cas).
deal-service 538 → **542**, message-service 36 → **39**. Plateforme : 904 → **911**.

---

# Recette API, chapitre 8 — webhooks : aucune anomalie, deux specs de contrôleur ajoutés

Sept fiches sur huit jouées, **aucun écart**. Les deux webhooks — Stripe (`:6003/webhooks/stripe`,
hors passerelle) et email Resend (`/api/webhooks/email/resend`, via la passerelle) — se comportent
exactement comme le cahier l'annonce.

## Ce qui a été prouvé

| Chemin | Preuve |
|---|---|
| Stripe, secret absent | **501** — l'endpoint existe mais refuse plutôt que d'accepter sans signature |
| Stripe, en-tête absent / signature invalide | **400** ×2 |
| Stripe, `payment_intent.canceled` | deal `PENDING` → `CANCELLED`, `closedBy: SYSTEM`, `cancelReason: PAYMENT_AUTHORIZATION_LOST` |
| Stripe, rejeu du même événement | 200/200, **un seul** `booking.cancelled` en boîte d'envoi |
| Stripe, `account.updated` sur un compte réel | `chargesEnabled` / `payoutsEnabled` suivent Stripe dans les **deux** sens |
| Stripe via la passerelle | **404** — la route n'y est pas exposée, comme voulu |
| Email, secret absent | **503** |
| Email, signature absente / fausse / périmée | **401** avec `reason` |
| Email, `email.delivered` | trace `EmailDelivery` **SENT → DELIVERED** |
| Email, rebond dur | `HARD_BOUNCE` posé — **et plus aucune trace email écrite** pour cette adresse à la transition suivante |
| Email, rejeu et type inconnu | 200 sans second effet ; `{ ok: true, ignored: "email.opened" }` |

## Signer un événement Stripe à la main (la CLI n'était pas disponible)

Plutôt que de laisser deux fiches bloquantes en ⏭, les événements ont été signés comme Stripe les
signe : `HMAC-SHA256(secret, "<timestamp>.<corps brut>")` en hexadécimal, dans
`stripe-signature: t=<timestamp>,v1=<hex>`.

**Le piège, payé une fois :** `$(cat fichier)` retire le saut de ligne final, alors que
`curl --data-binary @fichier` l'envoie. La signature portait donc sur des octets différents de ceux
transmis — et le service répondait 400, **correctement**. La signature se calcule sur les octets
exacts, lus en binaire :

```js
createHmac("sha256", secret).update(Buffer.concat([Buffer.from(ts + "."), fs.readFileSync(f)]))
```

C'est la même exigence qui interdit de faire passer ce webhook par la passerelle : elle analyse
puis re-sérialise le JSON, ce qui déplacerait une espace et invaliderait la signature. La route est
donc montée **avant** `express.json`, sur un lecteur de corps brut.

## Les deux specs de contrôleur ajoutés

Les règles pures étaient testées (`verifySvixSignature` sur vecteurs, `interpretEmailEvent` type par
type, `constructStripeWebhookEvent`), mais **la glu ne l'était pas** — la couche où vivaient
ANO-API-16 et ANO-API-17.

- `apps/notification-service/src/controllers/email-webhook.controller.spec.ts` (8 cas). Un cas
  n'était couvert nulle part : **l'horodatage hors tolérance** (rejeu tardif d'un événement
  correctement signé) — refusé en 401 `STALE`.
- `apps/deal-service/src/controllers/stripe-webhook.controller.spec.ts` (10 cas). Le tableau des
  quatre réponses est verrouillé, y compris le **500 sur échec transitoire** : c'est le filet, et le
  rendre en 200 perdrait l'événement pour toujours puisque Stripe ne renverrait pas.

notification-service 99 → **107**, deal-service 542 → **552**. Plateforme **929**.

---

# Recette API, chapitre 9 — consignation, et fermeture d'ANO-API-04

Le chapitre 9 n'est pas un chapitre de test : c'est celui où l'on démontre que la campagne est
**consignée** et que ses critères de sortie sont tenus. Trois travaux réels en sont sortis.

## 1. Cinq fiches jamais jouées, dont une bloquante

Le tableau §9.1 montrait cinq lignes vides — `API-DEAL-03` (**bloquante**), `04`, `13`, `14`, `19`.
Elles ont été jouées :

| Fiche | Résultat |
|---|---|
| API-DEAL-03 | 409 `QUOTE_DIVERGENCE`, `paymentIntentId: null` — **aucune autorisation posée** chez le fournisseur |
| API-DEAL-04 | 201 `PENDING`, `expiresAt` +24 h, 21 → 18 kg, présent des deux côtés ; charte refusée → 400 |
| API-DEAL-13 | 200 `CANCELLED`, `refundAmountCents` intégral, aucune pénalité au Voyageur |
| API-DEAL-14 | 409 (saut d'étape, **le message nomme l'étape attendue**) · 409 (rejeu) · 200 avec la séquence · 409 (deal non `PICKED_UP`) |
| API-DEAL-19 | 201 · 409 au rejeu · 403 pour l'Expéditrice · 400 sous 50 caractères |

Deux fiches réputées « hors de portée d'une campagne API » ont également été jouées en levant
l'obstacle : `API-SEC-05` et `API-MSG-12` exigeaient une **session administrateur avec TOTP**. Un
profil SUPPORT a été posé sur un compte d'essai, la connexion en deux temps jouée, et le code TOTP
**calculé avec la bibliothèque du dépôt** (`packages/libs/totp`) :

```sh
npx tsx -e 'import { totpCode } from ".../packages/libs/totp/src/index"; console.log(totpCode(process.argv[1]))' "<secret>"
```

Le profil a été retiré après les fiches. Zéro bloquante reste en ⏭.

## 2. ANO-API-04 fermée — un 409 qui dit enfin depuis quel état

`409 TRANSITION_NOT_ALLOWED` ne portait qu'une phrase : « Action "accept" is not allowed from status
ACCEPTED. » La donnée utile — le statut réellement vu par le serveur — n'existait que dans du texte
anglais.

`BookingTransitionCheck` porte désormais un motif **structuré** :

```ts
export type BookingRefusal = {
  refusal: "DELETED" | "UNKNOWN_ACTION" | "WRONG_ROLE" | "WRONG_STATUS" | "GUARD";
  action: BookingTransitionAction;
  actor: BookingActor;
  from: BookingStatus | null;        // le statut au moment du refus
  allowedFrom: readonly BookingStatus[]; // d'où ce rôle peut encore le faire
};
```

Les cinq chemins de refus de `canPerform` le remplissent par une fabrique unique (`refus(...)`),
pour qu'aucun n'oublie. Les quatre services qui lèvent le 409 le font remonter dans `details` :

```json
{"type":"booking","code":"TRANSITION_NOT_ALLOWED","refusal":"WRONG_STATUS",
 "action":"accept","actor":"CARRIER","from":"ACCEPTED","allowedFrom":["PENDING"]}
```

Le front peut donc dire « ce deal a déjà été accepté » et recharger, sans analyser une phrase.

**Et, dans le même mouvement, les 41 refus métier de deal-service portent un code** :
`DEAL_NOT_FOUND`, `TRIP_NOT_FOUND`, `NOT_A_PARTY`, `NOT_TRIP_OWNER`, `CARRIER_ONLY`,
`SHIPPER_ONLY`, `ADMIN_IS_PARTY`, `TRACKING_LINK_NOT_FOUND`, `ARBITRATION_FILE_NOT_FOUND`,
`REFUND_NOT_ALLOWED`, `REFUND_ABOVE_MAX`, `PAYOUT_NOT_RETRYABLE`, `REVERSAL_NOT_OPEN`… Le
garde-fou `refusal-codes.spec.ts` (celui écrit pour message-service à ANO-API-20) a été porté au
service, avec un test dédié aux 403/404 — le cœur d'ANO-API-04.

Le refus de permission admin (`requireAdminPermission`) nommait déjà la permission manquante, mais
au **premier niveau** du corps, là où le reste de la plateforme lit `details.code`. Les deux formes
coexistent désormais (additif : l'admin-ui qui lit les champs de tête n'est pas cassé).

## 3. Le tableau de suivi comptait faux

Une rebase avait laissé **seize lignes en double** dans le §9.1 (les blocs `API-MSG-*` et
`API-NOTIF-*`, une version remplie et une version vide, dans un ordre mêlé) : 162 lignes annoncées
pour 146 fiches. Dédoublonné en gardant la version remplie, et remis dans l'ordre des chapitres.

Ce n'est pas un défaut de code, mais il méritait la même rigueur : un tableau de suivi qui compte
faux est exactement ce qui permet à une fiche de disparaître sans que personne s'en aperçoive.

## Tests

`refusal-codes.spec.ts` (3 cas) et `transition-refusal.spec.ts` (5 cas) ; le cas S8 de
`booking-state-machine.spec.ts` a été étendu au motif structuré.
deal-service 552 → **560**. Plateforme **937**.

---

# Recette API — rejeu des fiches Stripe avec la CLI (réserve n° 1 levée)

Le chapitre 8 avait joué les fiches Stripe en **signant les événements à la main**, faute de CLI sur
le poste, et le verdict de campagne portait la réserve « rejouer avec la CLI avant la production ».
C'est fait.

## Lancer la CLI sans connexion interactive

`stripe login` ouvre un navigateur. On peut s'en passer : la CLI accepte une clé d'API directement,
et le dépôt en a une **de test** dans son `.env`.

```sh
brew install stripe/stripe-cli/stripe
stripe listen --api-key "$STRIPE_SECRET_KEY" --forward-to localhost:6003/webhooks/stripe
# Ready! … Your webhook signing secret is whsec_…
```

Ce `whsec_…` va dans `STRIPE_WEBHOOK_SECRET`, puis on redémarre les services — **avec le vrai
fournisseur Stripe cette fois**, plus le FAKE de la campagne (`nx serve` recharge le `.env` racine).

## Ce que le rejeu a prouvé de plus que les événements fabriqués

Un événement fabriqué prouve la **vérification de signature** et l'aiguillage. Il ne prouve pas que
l'objet référencé existe vraiment chez Stripe ni que la chaîne complète tient. Le rejeu, lui, a
suivi le chemin réel :

1. devis puis intention par l'API → `pi_…` créé chez Stripe ;
2. `stripe payment_intents confirm <pi> --payment-method pm_card_visa --return-url …`
   → **`requires_capture`**, `amount_capturable: 1450`, `capture_method: manual` — le modèle exact
   de Yamba (autorisation posée, capture différée) ;
3. `POST /api/deals` → 201, deal `PENDING` **sur cette autorisation réelle** ;
4. `stripe payment_intents cancel <pi>` → **c'est Stripe qui émet** `payment_intent.canceled` ; la
   CLI le transmet signé ; le service répond 200 ;
5. le deal passe `CANCELLED`, `closedBy: SYSTEM`, `cancelReason: PAYMENT_AUTHORIZATION_LOST`.

Le principe « entre la base et Stripe, c'est Stripe qui a l'argent » est donc vérifié sur le vrai
fournisseur, pas seulement sur un corps JSON écrit par le testeur.

**Deux pièges à connaître pour rejouer :**

- `stripe payment_intents confirm` échoue avec « you must provide a `return_url` » sur une intention
  qui accepte les moyens de paiement du Dashboard : passer `--return-url` (n'importe quelle URL) ou
  créer l'intention avec `automatic_payment_methods[allow_redirects] = never`.
- `stripe events resend <evt> --webhook-endpoint we_…` échoue en `resource-missing` quand on n'a pas
  d'endpoint enregistré : **omettre l'option** pour que le rejeu parte vers l'écoute de la CLI.

## Résultats

| Fiche | Résultat |
|---|---|
| API-HOOK-01 | OK — secret affiché, chaque événement journalisé avec le code rendu |
| API-HOOK-02 | OK — 200 (types non traités), 400 (en-tête absent), 400 (signature invalide), 501 (sans secret) |
| API-HOOK-03 | OK — autorisation réelle annulée chez le fournisseur → deal `CANCELLED` par SYSTEM ; `account.updated` d'un compte connecté inconnu → 200 + avertissement |
| API-HOOK-04 | OK — `stripe events resend` ×2 : 200 aux trois livraisons, **un seul** `booking.cancelled` |

**Plus aucune fiche de la campagne n'est en ⏭ : 146 sur 146 jouées.**

**Un détail relevé au passage** (à arbitrer côté produit, pas un défaut) : la vue Expéditeur ne sert
pas `cancelReason` alors que la base porte `PAYMENT_AUTHORIZATION_LOST`. Ce n'est pas une fuite,
c'est l'inverse — une information utile que le membre ne voit pas (« votre autorisation bancaire a
expiré »).

---

# Dette D-4 soldée — la règle des codes de refus sur les quatre services

Le verdict de la recette API inscrivait au journal de dette : « un refus métier porte un
`details.code` » était tenue sur deal-service et message-service, pas sur trip-service ni
auth-service. **250 refus** y ont reçu leur code, et deux garde-fous les y maintiennent.

## Deux défauts de sémantique tombés avec la dette

Le vrai gain n'était pas dans l'énoncé. Neuf routes de trip-service faisaient ceci :

```ts
const { trip, error } = await findOwnedTrip(id, userId);
if (!trip) return next(new ValidationError(error));   // ← 400, toujours
```

`findOwnedTrip` renvoie « Trip not found. » **ou** « Unauthorized. » — deux situations que la règle
non négociable distingue par le statut (404 et 403), écrasées ici en un seul 400 sans code. C'était
la dette **D-2** sur ces neuf sites. Le helper renvoie maintenant un code, et l'appelant lève la
bonne classe :

```ts
function ownershipError(code: "TRIP_NOT_FOUND" | "NOT_TRIP_OWNER", message: string) {
  return code === "TRIP_NOT_FOUND"
    ? new NotFoundError(message, { code })
    : new ForbiddenError(message, { code });
}
```

**Vérifié avant de changer les statuts** : aucun écran du front ne branche sur le 400 de ces routes
(les `status === 40x` du front portent sur la notation, le suivi de deal, la messagerie, les profils
publics). Changer un statut public sans cette vérification serait un pari, pas une correction.

Dans la même passe, les `new ValidationError("Unauthorized")` défensifs des contrôleurs (14
occurrences) deviennent des `AuthError` 401 `UNAUTHENTICATED` : un défaut d'authentification n'a
jamais été une erreur de saisie.

## Les middlewares partagés

`isAuthenticated` écrit ses réponses lui-même. Trois de ses sept refus portaient un `code`, les
quatre autres rien — dont « jeton absent », le 401 le plus fréquent de la plateforme. Un helper
unique les rend tous uniformes :

```ts
function refus(res: Response, message: string, code: string) {
  return res.status(401).json({ message, code, details: { code } });
}
```

Les deux formes coexistent : `code` en tête (le front le lit déjà) et `details.code` (la règle
générale). Sept codes distincts — `TOKEN_MISSING`, `TOKEN_INVALID`, `TOKEN_EXPIRED`,
`USER_NOT_FOUND`, `ACCOUNT_DELETED`, `ACCOUNT_SUSPENDED`, `SESSION_REVOKED` — parce qu'un client
doit réagir différemment à chacun : se connecter, rafraîchir, ou contacter le support.
`authorizeRoles` reçoit `ROLE_NOT_ALLOWED`.

## Le garde-fou, et son faux positif

`refusal-codes.spec.ts` (trip-service et auth-service) lit les sources et refuse tout jet d'erreur
métier sans code. Sa première version cherchait littéralement `code:` — et criait au loup sur trois
sites corrects : un code peut s'écrire de **trois** façons légitimes.

```ts
const porteUnCode = (args: string) => /(^|[\s,{])code\s*[,:}]|,\s*details\s*$/.test(args.trim());
```

`{ code: "X" }`, le raccourci `{ code }`, et un objet `details` construit ailleurs. **Un garde-fou
trop littéral fabrique du faux positif, et le faux positif est ce qui fait désactiver les
garde-fous.**

Le test d'auth-service vérifie en plus que trois codes de 401 **différents** existent bien
(`INVALID_CREDENTIALS`, `SESSION_EXPIRED`, `ACCOUNT_SUSPENDED`) : sans cela, coder tous les refus
avec le même `UNAUTHORIZED` passerait le test sans rien apporter au client.

## Un piège Nx, payé une deuxième fois

La contre-épreuve montrait les **anciens** corps d'erreur alors que le bundle contenait le nouveau
code. `npm run dev` lance `nx serve`, qui construit la cible **`build:development`** — or
`nx build <service> --skip-nx-cache` ne réchauffe que `build`. Le serveur repartait sur un artefact
en cache.

Même leçon que le typecheck servi depuis le cache pendant la campagne : **un artefact Nx
« reconstruit » n'est pas forcément neuf.** Pour redémarrer sur du code frais :
`NX_SKIP_NX_CACHE=true npm run dev`.

## Tests

trip-service 231 → **235**, auth-service 215 → **219**. Plateforme **941**.

---

# Dette D-5 soldée, et ANO-API-23 (bloquante) trouvée en la soldant

## D-5 — une seule forme de corps d'erreur

Trois formes coexistaient : `{status:"error", message, details}` (le middleware d'erreur),
`{message, code}` (les middlewares qui répondaient eux-mêmes) et `{success:false, message}` (les
404 des pages publiques). Aucun client ne pouvait écrire UNE fonction pour les lire — et
court-circuiter le middleware d'erreur, c'est aussi perdre la décision centrale sur ce qui est
exposé en production, et la remontée Sentry.

**La clé de la migration** : le middleware d'erreur recopie désormais `code` au **premier niveau**
quand `details.code` existe.

```ts
if (hasPublicCode) payload.code = detailsObj.code as string;
```

Sans cette ligne, faire passer les middlewares par `next()` supprimait le `code` de tête que des
écrans lisent déjà. Avec elle, les deux formes disent la même chose et la migration ne casse rien.

Douze refus convertis : les sept de `isAuthenticated`, les quatre de `isAdminAuthenticated` (qui
n'avaient **aucun** code), `requireActiveAccount`, `requireAdminPermission`, les cinq 404
`{success:false}` des pages publiques, le 409 Stripe du Voyageur, un 400 de session admin.

**Deux exceptions écrites et justifiées** : les réponses du webhook Stripe (le destinataire est
Stripe, son contrat est le statut) et le 409 `ERASURE_BLOCKED` (réponse **documentée** avec son
schéma OpenAPI, pas un corps d'erreur ad hoc).

**Garde-fou** : `middleware-responses.spec.ts` interdit `res.status(4xx|5xx).json(...)` dans
`packages/middleware`.

## ANO-API-23 — les deux pages publiques répondaient 404

En vérifiant une réponse au passage, `GET /users/{slug}/public` a rendu 404 sur un compte
manifestement public. Mesuré ensuite sur toute la base :

- **profil public : 404 pour 22 comptes sur 26** ;
- **page d'un trajet : 404 pour 24 trajets publiés sur 37**.

### La cause

```ts
// ❌ ce que le code faisait, avec ce commentaire :
// « `{ not: true }` … pour matcher aussi les documents où le champ est ABSENT »
{ isDeleted: { not: true }, OR: [{ profilePublic: { not: false } }] }
```

Sur Prisma + Mongo, **aucun filtre ne matche un champ absent**, `not` compris. Or `profilePublic`
et `isDeleted` n'existent pas sur les documents créés avant leur ajout au schéma. Prisma **relit**
pourtant la valeur par défaut : le compte s'affiche `profilePublic: true` et reste introuvable.

### La limite du remède habituel

`isSet: false` est le réflexe du projet — **il ne s'applique pas ici**. Prisma ne l'offre que sur
les champs **optionnels** ; sur un champ requis à défaut, il lève `Unknown argument \`isSet\``.
C'est pourquoi `notHiddenFilter()` peut l'utiliser sur `hiddenByAdminAt` (`DateTime?`) mais pas
`isDeleted`.

Pour un champ REQUIS, « absent » n'est donc pas exprimable dans une requête : c'est un défaut de
**données**.

```ts
// ✅ l'écriture correcte, une fois les données saines
{ isDeleted: false, OR: [{ profilePublic: true }] }
```

### Le correctif, en deux temps

1. **Données** — `packages/libs/prisma/scripts/repair-absent-scalars.ts` pose le défaut du schéma
   là où le champ manque (90 champs sur `User`, 24 sur `Trip`). Idempotent, avec `--dry-run`, et
   il refuse deux champs volontairement : `emailVerified` (absent du modèle) et `adminRoles` (qui a
   son propre script, capable de recopier le rôle principal).
2. **Code** — les deux filtres reviennent à l'égalité simple, avec un commentaire qui dit ce qui a
   été **vérifié**, pas ce qu'on suppose.

Les documents créés ensuite sont sains d'office : Prisma écrit les défauts à la création. Le script
est à passer **après tout ajout d'un champ requis à défaut**.

### Ce que l'épisode apprend

**Un test peut protéger le défaut.** Les deux specs existants exigeaient littéralement l'erreur :

```ts
it("n'utilise jamais `isDeleted: false`, qui raterait les documents sans le champ", () => {
  expect(JSON.stringify(publicTripWhere(ID))).not.toContain('"isDeleted":false');
});
```

Ils passaient, la fonctionnalité était morte. Un test qui vérifie la **forme** d'une requête ne
vérifie pas qu'elle **trouve** quelque chose : il fige la croyance de son auteur.

**Et la première version de mon correctif a répété l'erreur** : elle posait `OR … isSet: false`, les
tests de forme passaient au vert, et le service répondait **500** au premier appel réel. Ce qui a
servi de garde-fou n'est pas un test, c'est d'avoir rejoué la requête contre la base avant de
conclure.

## Tests

auth-service 219 → **225**, trip-service **235**. Plateforme **941**.

---

# Dette D-3 soldée — une suppression rejouée n'est pas une erreur

## Le défaut

`DELETE /api/trips/{id}/documents/{documentId}` répondait **200** au premier appel et **400
« Document not found. »** au second. Deux défauts dans un seul refus : le geste n'était pas
idempotent (un double clic ressemblait à une erreur), et le statut annonçait une faute du client
là où il n'y en avait aucune.

La route **voisine**, `DELETE /uploads/imagekit/:fileId`, appliquait pourtant déjà la bonne
convention : « File was already deleted. » en 200. Deux suppressions côte à côte, deux
comportements — c'est ce genre d'écart qu'une campagne de recette rend visible.

## La correction

```ts
// Un document absent, ou appartenant à un AUTRE trajet, est traité comme déjà supprimé.
if (!doc || doc.tripId !== id) {
  return res.status(200).json({ success: true, message: "Document was already removed." });
}
```

Confondre « n'a jamais existé » et « déjà supprimé » n'est pas un pis-aller : c'est ce qui ferme la
porte à l'**énumération d'identifiants**. L'appelant ne peut rien déduire de la réponse, et rien
n'est touché.

**L'ordre des effets a été inversé** : la base — source de vérité — est écrite **avant** l'appel au
fournisseur de fichiers.

```ts
await prisma.tripDocument.delete({ where: { id: documentId } });   // d'abord
if (doc.fileId) { try { await imagekit.deleteFile(doc.fileId); } catch { /* best effort */ } }
```

Avant, un échec de l'écriture en base laissait une ligne pointant vers un fichier disparu.
Maintenant, au pire, un fichier orphelin chez le fournisseur — sans conséquence.

**La règle générale** : quand deux systèmes doivent être mis d'accord et qu'on ne peut pas les
écrire ensemble, on écrit **d'abord celui qui fait foi**, et on rend l'autre rattrapable.

## Trois statuts faux corrigés dans la même passe

La dette D-4 avait donné un code à tous les refus **sans toucher aux statuts**. Il restait des
`ValidationError` portant un code d'authentification :

| Cas | Avant | Après |
|---|---|---|
| garde défensive `!req.user` (16 sites) | 400 `UNAUTHENTICATED` | **401** `UNAUTHENTICATED` |
| alerte de trajet d'un autre membre (3 sites) | 400 `UNAUTHENTICATED` | **403** `NOT_OWNER` |

Le second était le plus trompeur : « non authentifié » sur un membre parfaitement authentifié, à
qui il manquait seulement la propriété de la ressource.

## Garde-fou

`apps/trip-service/src/lib/idempotent-delete.spec.ts` (5 cas) — il lit les sources et vérifie :
aucun refus sur l'absence, **une seule sortie** pour les deux cas d'absence (pas d'énumération), la
base supprimée **avant** le fichier, l'échec du fournisseur absorbé, et la route voisine inchangée.

## Tests

trip-service 235 → **240**. Plateforme **946**.

---

# Dette D-1 soldée — une seule règle pour la langue d'une réponse

## L'arbitrage était déjà rendu

Le journal présentait D-1 comme un choix à trancher. La décision **D44** le tranchait déjà : « flux
avec compte : `preferredLocale` […] une locale par **utilisateur**, pas par appareil », le front
tenant la valeur à jour (`PATCH /auth/me/locale` à chaque bascule, implémenté). Le code et le
registre étaient d'accord ; **l'attendu du cahier de recette était faux**, et la règle de précédence
du projet le dit : code + tests > registre > synthèses. Le cahier est corrigé.

## La vraie dette : la règle existait en trois exemplaires

| Endpoint | Règle appliquée | Manque |
|---|---|---|
| `GET /messages/quick-replies` | compte → appareil | — |
| `GET /trips/favorites` | `?locale` → appareil | le compte jamais consulté |
| `GET /trips/search` | `?locale` seul, défaut `fr` | ni compte, ni appareil |

Aucune fausse isolément ; ensemble, pas la même règle. Et la recherche répondait **toujours en
français** à qui ne passait pas `?locale=` : le front passe le paramètre, donc rien ne se voyait —
mais tout autre client de l'API recevait du français, quel que soit le lecteur.

## La règle, écrite une fois

```ts
export function resolveViewerLocale(sources: LocaleSources): SupportedLocale
// 1. ?locale= explicite   → surcharge délibérée, pour cet appel (liens partageables, clients API)
// 2. preferredLocale      → D44, la langue du COMPTE
// 3. x-locale             → l'appareil, pour un visiteur sans compte
// 4. Accept-Language, puis le défaut
```

Elle vit dans `@packages/api-contracts/locale`, là où vit déjà la liste des langues — le fichier
que le front importe par un alias dédié, sans embarquer les schémas.

**Un détail qui compte** : une valeur non supportée **ne consomme pas son tour**. `?locale=de` sur
un membre anglophone rend de l'anglais, pas le français par défaut — sinon un paramètre erroné
écraserait silencieusement la préférence du lecteur. C'est la différence entre boucler sur les
sources et enchaîner des `??`.

## Le cas de la recherche

Son schéma portait `locale: z.enum(LOCALES).optional().default("fr")` : le défaut **avalait
l'absence** avant qu'on puisse la voir. La locale est donc résolue **avant** l'analyse :

```ts
const parsed = searchTripsQuerySchema.safeParse({ ...req.query, locale: localeDeLaRequete(req) });
```

Le contrat du DTO ne bouge pas ; c'est l'entrée qui est complétée. `searchTrips` est
`isOptionallyAuthenticated` : `req.user` peut être absent, et c'est le cas nominal.

## Garde-fous

- `viewer-locale.spec.ts` (6 cas) — la règle, y compris le piège de la valeur inconnue ;
- `one-locale-rule.spec.ts` (4 cas) — **aucun contrôleur ne lit `x-locale` sans passer par la règle
  commune**. C'est lui qui empêche l'apparition d'une quatrième variante.

## Tests

trip-service 240 → **250**. Plateforme **956**. Contrats OpenAPI inchangés.

---

# Recette « tâches planifiées » — cahier n° 4 : neuf anomalies, deux bloquantes

*(PR `chore/recette-crons-campagne`, 09/09/2026 — 90 fiches jouées, 9 anomalies closes.
Décisions gravées : **D76**, **D77**.)*

## De quoi parle ce lot

La plateforme porte **quinze tâches planifiées**, **deux relais d'événements** et **deux
consommateurs**. Rien de tout cela n'a d'interface : aucune de ces mécaniques ne répond à un
utilisateur, aucune ne se voit dans un écran. Elles complètent des trajets, expirent des demandes,
versent de l'argent, envoient des relances, purgent des données et transforment des événements en
notifications — la nuit, toutes seules. Cette campagne les a **provoquées une par une**, avec de
vrais services, un vrai courtier et une vraie base.

Neuf anomalies, dont deux bloquantes. Les six premières ont été traitées au fil des chapitres et
sont détaillées dans `context/YAMBA-RECETTE-CRONS-RESULTATS.md` ; ce chapitre développe les trois
dernières et le principe commun aux deux bloquantes.

## ANO-CRON-05 (bloquante) — la purge qui vidait la file d'attente

```ts
// avant — apps/deal-service/src/cron/outbox-retention.cron.ts
where: { aggregateType, publishedAt: { lt: cutoff } }
```

Trois pièges de Prisma + MongoDB se cumulaient dans cette ligne :

1. `publishedAt` est **nullable**, donc absent des documents qui n'ont jamais été publiés ;
2. en BSON, **`null` précède toutes les dates** : `{ lt: <date> }` matche donc `null` ;
3. il n'y avait aucun garde-fou côté application, la requête faisant foi.

Résultat : chaque nuit à 3 h 30, la purge « des événements publiés depuis plus de 90 jours »
supprimait **tous les événements en attente de publication**, quel que soit leur âge — c'est-à-dire
exactement ceux qu'un incident de courtier venait de laisser en file. Un `docker stop` de dix
minutes suivi d'une nuit, et les notifications correspondantes n'existaient plus.

```ts
// après — l'appartenance à « publié » est explicite, l'âge vient ensuite
where: {
  aggregateType,
  AND: [{ publishedAt: { not: null } }, { publishedAt: { lt: cutoffFor(now, days) } }],
}
```

Corrigé dans les **deux** relais (deal-service et message-service), avec un test qui **lit la
source** et refuse un `deleteMany` sur `OutboxEvent` dont le `where` ne contient pas la condition
« publié ».

## ANO-CRON-06 (majeure) — classer par cause, jamais par nom

L'exclusion « une panne de courtier n'use pas les tentatives » était écrite avec une liste de
**noms** d'erreurs kafkajs. Mesuré, courtier éteint, sur un événement parfaitement sain :

```
2 → 5 → 7 → 10 tentatives en 100 secondes → PARQUÉ
```

`packages/libs/messaging/src/broker-errors.ts` remplace la liste de noms par une reconnaissance
**par cause** : la chaîne `cause` / `originalError` est parcourue (bornée à cinq niveaux,
résistante aux cycles) et l'on cherche la signature d'un courtier injoignable, par nom **ou** par
message. Le fichier n'importe **rien** — condition nécessaire pour survivre au `jest.mock` virtuel
de `@packages/messaging` posé par les tests de relais, qui l'importent donc par chemin relatif.

Conséquence assumée, gravée en **D76** : un **sujet absent** produit la même signature et n'est
donc plus parqué non plus. C'est le bon arbitrage — un sujet absent se répare en une commande,
le parcage est définitif — et le signal existe déjà, meilleur : l'alerte `OUTBOX_LAGGING_15MIN`.

## ANO-CRON-08 (bloquante) — un consommateur mort restait mort, en silence

Le déclencheur est presque comique : `rpk topic produce`, la commande écrite dans le cahier de
recette lui-même, **compresse en snappy par défaut**. kafkajs ne sait pas décompresser snappy et
lève `KafkaJSNotImplemented`, une erreur non retriable.

```
[Consumer] Crash: KafkaJSNotImplemented: Snappy compression not implemented
[Consumer] Stopped
```

Le consommateur des réservations s'arrêtait **définitivement**. Le processus restait vivant,
`/health` répondait `{"status":"ok"}`, le groupe passait `Empty`, et plus une notification ni un
email ne sortait — indéfiniment, y compris après un redémarrage du service (il retombait sur le
même message). Deux événements d'expiration parfaitement sains sont restés **neuf minutes** en
attente sur une autre partition.

La cause : `startConsumer()` ne traitait que l'échec **au démarrage**. kafkajs se relève seul sur
un crash *retriable* (vérifié au passage en CRON-CONSO-6 : « Restarting the consumer in 8206ms »),
mais s'arrête pour de bon sur un crash non retriable. `consumerRunning` restait à `true` et ne
servait qu'à l'arrêt du processus.

**Correction en trois pièces.**

1. `KafkaEventConsumer.onCrash(handler)` relaie l'événement `CRASH` de kafkajs, avec son drapeau
   `restart` (le client se relance-t-il lui-même ?). L'interface `EventConsumer` porte le type
   `ConsumerCrash` ; la méthode est **optionnelle**, donc aucun autre implémenteur n'est cassé.
2. `apps/notification-service/src/consumer/supervisor.ts` — un superviseur commun aux deux
   consommateurs : démarrage réessayé, plantage définitif rattrapé, **retrait exponentiel plafonné
   à cinq minutes**, et une **fenêtre de stabilité** de 60 secondes. Cette dernière est le point
   subtil : un poison de transport laisse le *démarrage* réussir et tue la boucle juste après ;
   sans fenêtre, chaque cycle repartirait du délai de base — une ligne d'erreur toutes les cinq
   secondes, pour toujours. Le retrait ne se remet à zéro que si la boucle a **tenu**.
3. `/health` porte une vérification `consumers` : un consommateur activé et non courant rend le
   service **`degraded`**, donc visible sur la page « État des services » et sur `GET /api/status`.
   Un **délai de grâce de 90 s** distingue « pas encore démarré » (rejoindre un groupe prend une
   dizaine de secondes) de « tombé » — sans quoi la sonde clignoterait à chaque déploiement.

**Contre-épreuve mesurée** : même message snappy, service corrigé →
`nextRetryMs: 5000 → 10000 → 20000 → 40000`, `/health` en `degraded` avec
`"consumer(s) not running: booking-events"`. Message empoisonné retiré du sujet → le service se
**remet seul** en `ok`, groupe `Stable`, retard 0, sans redémarrage du processus.

On ne saute jamais un message qu'on n'a pas su lire : sauter, c'est perdre. Le poison fait donc
une boucle **bruyante et espacée**, jamais un arrêt muet.

## ANO-CRON-09 (majeure) — le dossier de modération escamoté par la conservation

```ts
// avant — apps/message-service/src/services/admin-conversation.service.ts
if (!message || !conversation) continue; // message purgé : le signalement reste, sans corps — hors file
```

Le commentaire décrivait exactement le problème sans le voir : le `Report` restait bien en base,
mais **hors de la file**. Un signalement dont le message a été purgé par la conservation
disparaissait donc de l'écran de modération et restait `OPEN` pour toujours — invisible,
intraitable, et sans que le compteur (`total: items.length`) ne le trahisse.

Le contrat `AdminMessageReportItem` gagne `purged: boolean` ; tout ce qui vient du message ou de
son fil devient **nullable** — `author`, `conversationId`, `bookingId`, `corridor`, le corps et la
date du message — **ainsi que le rôle du signalant** : sans la conversation, on ne peut pas dire
s'il était Expéditeur ou Voyageur, et l'inventer serait pire que se taire. Le back-office rend le
dossier avec « Contenu purgé par la conservation », et les boutons « Traité » / « Sans suite »
restent actifs. Gravé en **D77**.

## ANO-CRON-07 (mineure) — un jeu d'essai qui viole sa propre règle

`seed-deals.ts` créait `gru-completed` avec `shipperKey: "ines"` sur le trajet `gru` dont le
Voyageur est `ines` : le membre était son propre Expéditeur, ce que l'API refuse (`OWN_TRIP`).
Coût réel : la relance de notation envoyait **deux** emails « Pense à noter Inês » à Inês, ce qui
ressemblait trait pour trait à un doublon d'idempotence et a coûté une investigation en pleine
campagne. `seed-integrity.spec.ts` lit la source du seed et refuse désormais ce cas.

## Outillage de recette ajouté

- `packages/libs/prisma/scripts/repair-negative-counters.ts` — remet à zéro les compteurs négatifs
  (`CarrierPage`, `User`), idempotent, `--dry-run` ;
- `packages/libs/prisma/scripts/requeue-parked-outbox.ts` — remet en file un événement parqué,
  **après l'avoir re-validé contre le contrat courant** : seuls les événements sains repartent ;
- `scripts/recette/` — une trentaine de scripts de provocation et de mesure (rendre une ligne
  éligible, forcer une passe, lire l'état des relais, des battements, des compteurs).

## Tests

trip-service 257, deal-service 575, notification-service 115, message-service 42 →
plateforme **989** (auth-service 225 inchangé). Contrats OpenAPI régénérés (`AdminMessageReportItem`).

---

# Harnais de recette navigateur (Playwright) — et les deux premières anomalies

*(PR `chore/e2e-playwright`, 09/09/2026.)*

## Pourquoi un harnais

Les cahiers 01-WEB (328 fiches) et 02-ADMIN (110) se jouent **au navigateur**. À la main, c'est
plusieurs jours — et surtout, cela ne se **rejoue** pas : un cahier joué une fois ne protège de
rien le mois suivant. `apps/e2e` exécute ces scénarios.

Trois choix structurants, tous justifiés par la campagne précédente :

1. **Contre l'environnement réel** (six services, Mongo, Redis, Redpanda, Mailpit), jamais
   contre des bouchons. Les défauts qui comptent sont ceux qu'aucun test unitaire ne voit.
2. **Pas branché à la CI**, délibérément : il faudrait toute l'infrastructure. La CI garde ses
   **17** vérifications ; le harnais se lance sur un poste où l'environnement tourne
   (`npx nx e2e e2e`).
3. **Trois navigateurs, comme le cahier les décrit** — A l'Expéditeur, B le Voyageur, C le
   visiteur — chacun dans son `BrowserContext`. La moitié des vérifications portent sur ce qu'un
   rôle **ne voit pas** : une session partagée les rendrait toutes vertes pour de mauvaises
   raisons. Et `workers: 1`, parce que les parcours partagent une base et un jeu d'essai.

```
apps/e2e/
  playwright.config.ts        adresse du front déduite, canal Chrome, rapport et traces
  src/fixtures/comptes.ts     les 12 comptes du seed (§ 2.3 du cahier)
  src/fixtures/jeu-essai.ts   remise à zéro (§ 3.6) + carte des repères → identifiants réels
  src/fixtures/mailpit.ts     attendre un email — et prouver qu'un autre n'en reçoit AUCUN
  src/fixtures/yamba.ts       les navigateurs A / B / C, la connexion par l'écran
  src/harnais.spec.ts         le harnais s'éprouve lui-même avant d'éprouver le produit
  src/chapitres/*.spec.ts     les scénarios, par chapitre du cahier
```

## Deux pièges de poste, désarmés dans la configuration

**Les cookies sont liés à l'hôte.** Le poste est configuré pour la recette mobile
(`NEXT_PUBLIC_API_BASE_URL=http://192.168.1.155:8080/api`). Ouvrir le front sur `localhost:3000`
donne alors une connexion **200 sans un seul cookie posé** — et tout échoue ensuite sans que rien
ne l'explique. Le harnais lit la configuration du front et en déduit l'adresse à ouvrir : base
absolue → son hôte ; base relative (`/api`, proxy Next, D48) → `localhost`.

**`networkidle` ne dit rien de React.** Sur une adresse de réseau local, Next 16 sert d'abord un
squelette SSR ; cliquer avant l'hydratation envoie le formulaire de connexion en **GET**, mot de
passe dans l'URL. Le signal fiable est un appel d'API fait par le **client** ; le helper l'attend,
puis réessaie une fois si la requête de connexion n'est jamais partie.

**Chromium n'est plus publié pour macOS 13** : le harnais pilote le **Chrome du poste**
(`channel: "chrome"`), `PLAYWRIGHT_CHANNEL=bundled` revenant au Chromium livré avec Playwright.

## ANO-WEB-01 (bloquante) — une session qui n'a jamais existé ne peut pas expirer

Trouvée avant le premier scénario du cahier, en tentant simplement de se connecter. Un visiteur
qui ouvre `/fr/login` recevait la fenêtre « Ta session a expiré », dont le fond opaque
**interceptait les clics** :

```
<button aria-label="Plus tard" class="absolute inset-0 bg-slate-900/50 …">
… subtree intercepts pointer events
```

Le formulaire de connexion était inutilisable tant que la fenêtre n'était pas fermée à la main.

Deux défauts cumulés. `api-client` traitait **tout** 401 suivi d'un rafraîchissement raté comme
une *expiration* — or un visiteur n'a rien à faire expirer. Et l'en-tête de `SessionExpiredGate`
affirmait « sur les pages publiques, la fenêtre reste fermée » : le code ne le faisait pas.

```ts
// apps/user-ui/src/lib/session-marker.ts — le marqueur, sans aucune donnée personnelle
export function marquerSessionActive(): void { try { window.localStorage.setItem("yamba:session", "1"); } catch {} }
```

Une requête authentifiée qui **réussit** pose le marqueur ; la déconnexion et l'expiration
l'effacent ; l'événement d'expiration n'est émis que s'il existait. Et l'écran refuse de s'ouvrir
sur `/login`, `/register`, `/password`, `/refresh`. Toute lecture du stockage est protégée : en
navigation privée, l'absence de marqueur fait retomber sur le comportement prudent — pas de
fenêtre plutôt qu'une fenêtre injustifiée.

## ANO-WEB-02 (majeure) — deux clés de traduction affichées à l'écran

La porte « Connecte-toi pour réserver » proposait deux boutons intitulés
**`booking.authGate.login`** et **`booking.authGate.register`** : les clés elles-mêmes, faute de
messages, **dans les deux langues**.

Le contrôle i18n de la CI compare les locales **entre elles**. Ici les deux étaient également
incomplètes : le miroir était parfait, et le défaut invisible. D'où une **cinquième règle** dans
`scripts/check-i18n-messages.mjs` — *toute clé littérale utilisée dans les sources existe*.

Elle ne juge que ce qui est certain, parce qu'un garde-fou qui crie sur du code juste finit
désactivé (leçon de la campagne API) :

- la **carte des espaces de noms** est lue dans `src/i18n/request.ts` — un fichier ne porte pas
  forcément le nom de son espace (`trip-detail.json` → `tripDetail`) ;
- une variable liée **deux fois** dans le même fichier est ignorée : on ne peut plus attribuer
  ses appels à coup sûr ;
- une liaison ne gouverne que ce qui la **suit** : un `t("…")` plus haut appartient à une autre
  fonction, qui reçoit souvent `t` en paramètre ;
- une clé finissant par un point est un **préfixe concaténé** (`t("cat." + x)`), pas une clé ;
- et un **garde-fou du garde-fou** échoue si moins de 200 clés littérales ont été analysées.

Passées de 213 faux positifs à **0**, tout en attrapant le cas réel : clé retirée → le contrôle
nomme `booking.authGate.login — BookingClient.tsx`.

## Tests

`apps/e2e` : **10 scénarios** verts sur le poste (harnais, WEB-CNX ×3, WEB-RSV ×3). Les suites
Jest et les 17 vérifications de CI sont inchangées.

---

# Parcours transactionnels : sessions mémorisées, fixture administrateur, WEB-E2E-1 en entier

*(PR `chore/e2e-parcours`, 09/09/2026.)*

## Ce qui a été fait

Le harnais jouait dix scénarios courts. Cette PR lui fait jouer le parcours **bloquant** du cahier
01-WEB — WEB-E2E-1, vingt-neuf étapes, trois navigateurs, d'une réservation à la révélation des
avis — et lui donne les deux fondations que la suite de la campagne exige : une **mémoire des
sessions** et un **navigateur du back-office**.

```
apps/e2e/
  src/fixtures/adresses.ts        front, API, back-office : trois adresses, une seule source (la config du front)
  src/fixtures/sessions.ts        la mémoire des sessions (storageState sur disque, .sessions/ ignoré)
  src/fixtures/photos.ts          un PNG en mémoire + ImageKit interposé (E2E_IMAGEKIT=real pour le vrai)
  src/fixtures/presse-papiers.ts  un presse-papiers en mémoire de page (navigator.clipboard n'existe pas en http://192.168…)
  src/fixtures/comptes.ts         + les sept comptes du back-office (COMPTES_ADMIN)
  src/fixtures/jeu-essai.ts       + rejouerAdmins() et admin(clé) → { secret TOTP, codes de secours }
  src/fixtures/yamba.ts           navigateurConnecte(clé, { parEcran }) · navigateurAdmin(clé) · connexionAdmin
  src/pages/fil-messagerie.ts     fil, rendez-vous (proposer / accepter), numéro trop tôt
  src/pages/transport-voyageur.ts prise en charge, jalons, remise contre le code
  src/pages/suivi-expediteur.ts   lien de suivi, code, message du code, vérification, confirmation
  src/pages/suivi-destinataire.ts la page /track/[token] : jalon courant, frise, « ne révèle rien »
  src/pages/notation.ts           étoiles (radios nommés), pouces, commentaire, révélation
  src/parcours/web-e2e-1.spec.ts  les 29 étapes
packages/libs/prisma/scripts/seed-admins.ts   les sept comptes admin, promus et enrôlés
```

## La mémoire des sessions (`storageState`)

Chaque navigateur ouvrait une vraie session par l'écran. À deux ou trois connexions par scénario
et plusieurs exécutions par heure, `POST /auth/login` finissait en **429**. Désormais :

1. la première connexion d'un compte passe par l'écran, puis `contexte.storageState()` est
   écrit dans `apps/e2e/.sessions/<clé>.json` ;
2. un contexte suivant repart de ce fichier — après l'avoir **sondé** avec les cookies du
   contexte (`contexte.request.get(…/auth/me)`, et `POST /auth/refresh` si le jeton d'accès de
   15 min a expiré : la rotation dépose les nouveaux cookies dans le contexte avant la première
   page) ; s'il ne répond plus, on repasse par l'écran et la mémoire est remplacée ;
3. à la fermeture, le contexte **rend** son état : le rafraîchissement révoque l'ancien `jti`
   et `isAuthenticated` le vérifie dans Redis — les cookies les plus récents doivent gagner.

`{ parEcran: true }` force l'écran ; `harnais.spec.ts` s'en sert pour garder un scénario qui
éprouve la porte d'entrée, et un autre prouve qu'un second navigateur du même compte n'émet
**aucune** requête de connexion.

## Le navigateur du back-office

`seed-admins.ts` fait ce que le cahier 02-ADMIN § 2.5 décrit à la main : sept membres ordinaires
(`super`, `mediateur`, `support`, `exploitation`, `finance`, `privacy`, `cumul` = SUPPORT + FINANCE)
avec l'écriture exacte de `grant-admin.ts`, puis l'enrôlement TOTP tel que `/auth/admin/totp/setup`
le fait (`encryptTotpSecret`, huit codes de secours hachés) — le secret et les codes en clair dans
`seed-admins-output.json` (ignoré par git). `navigateurAdmin("mediateur")` joue la connexion en
deux temps par l'écran : mot de passe, puis un code **calculé** par `totpCode(secret)` de
`packages/libs/totp` ; un pas de 30 s ne servant qu'une fois par compte (anti-rejeu), un code
refusé fait attendre le pas suivant. Les cookies `admin_*` ont leur propre mémoire
(`admin-<clé>.json`), sondée sur `/admin/me` et rafraîchie par `/auth/admin/refresh`.

## Le limiteur de débit, en deux temps

Les sessions mémorisées ont fait disparaître les 429 sur la connexion — et révélé le second
plafond : **100 requêtes anonymes réussies par quart d'heure et par adresse**, épuisées par les
seuls visiteurs des parcours (trajet, porte, `/track`, profil public) après trois exécutions.
`resolveRateLimits(env)` dans `packages/middleware/rate-limit-tier.ts` lit
`RATE_LIMIT_ANONYMOUS_MAX` / `RATE_LIMIT_AUTHENTICATED_MAX` (entier strictement positif, sinon
le défaut) ; le gateway le résout une fois au démarrage et le passe à `rateLimitMax`. Quatre tests
ajoutés à `rate-limit-tier.spec.ts` (auth-service **229**). La production ne pose pas ces
variables.

## ANO-WEB-03 (majeure) — le mauvais fil s'ouvrait sur grand écran

`Messages.tsx` : un effet lit `?conversation=<id>`, un autre ouvre le premier fil « pour ne pas
laisser une colonne vide » sur ≥ 1024 px. Quand la liste est déjà en cache (le badge de l'en-tête
la charge), les deux posent `selectedId` dans le **même** rendu et le dernier gagne. Le Voyageur
arrivait dans le fil d'un autre deal. Correction : l'ouverture automatique s'abstient dès que
l'URL a choisi (`if (searchParams?.get("conversation")) return;`).

## Deux corrections de jeu d'essai

- `seed-deals.ts` pose `publicSlug: seed-<clé>` aussi à la **mise à jour** : les comptes du seed
  sont antérieurs au profil public et `/u/seed-thomas` répondait « Profil introuvable ».
- Le parcours rejoue le seed dans un `beforeAll` : chaque exécution réserve 2,5 kg sur le trajet
  de démonstration.

## Trois choses que le harnais interpose, et pourquoi

| Interposé | Pourquoi | Ce qui reste traversé |
|---|---|---|
| Paiement → FAKE (D11/D38) | le Payment Element de Stripe ne se monte pas sur `http://192.168…` | tout le cycle du deal ; la carte est éprouvée par la campagne API |
| ImageKit (`page.route`) | ne pas déposer trois images en production à chaque exécution | le jeton demandé à trip-service, la validation client, les URL enregistrées sur le deal |
| `navigator.clipboard` (`addInitScript`) | absent hors contexte sécurisé ; Chrome refuse la permission | le code du produit appelle `writeText`, le test relit ce qui a été écrit |

## Tests

`apps/e2e` : **15 scénarios** verts sur le poste en 3 min 06 (harnais ×6, WEB-CNX ×3, WEB-RSV ×5, WEB-E2E-1).
auth-service **229** (+4, `resolveRateLimits`). Plateforme 989 inchangée.

---

# WEB-E2E-2 : le litige de bout en bout, et deux vérités rétablies (contrat, jeu d'essai)

*(PR `chore/e2e-parcours-2`, 09/09/2026.)*

## Ce qui a été fait

Le second parcours bloquant du cahier 01-WEB : un signalement, la version du Voyageur, une
décision de médiation prise dans le back-office, puis ce que chacun lit — et surtout ce que
chacun **ne lit pas**. Dix-neuf étapes, quatre navigateurs (João, Thomas, la médiatrice, plus
Mailpit), trente secondes.

```
apps/e2e/src/pages/signalement-expediteur.ts  l'assistant de signalement (4 blocs), le suivi en litige, la décision, Finances
apps/e2e/src/pages/litige-voyageur.ts         le dossier vu du Voyageur, sa version, sa décision
apps/e2e/src/pages/mediation-admin.ts         la file « À arbitrer », le dossier, « Trancher »
apps/e2e/src/pages/fil-messagerie.ts          + identifiantDuFil(contexte, dealId) par l'API, + ouvrirFermeParLeLitige
apps/e2e/src/parcours/web-e2e-2.spec.ts       les 19 étapes
```

Le parcours vérifie des **absences** autant que des présences : le récit et les photos de
l'Expéditeur n'atteignent jamais le Voyageur (A68) — ni l'écran, ni l'email ; le contenu de la
version du Voyageur n'atteint jamais l'Expéditeur (D55 5A) ; le code de livraison n'est jamais
servi au back-office ; l'email de décision de chacun ne porte que **son** montant. Chaque
absence est affirmée sur le texte entier de la page ou de l'email, pas sur un élément.

## ANO-WEB-04 — la vue Expéditeur ne disait pas qui avait clos le deal

Le bandeau « Envoi terminé » choisissait sa phrase sur `booking.completedBy`. Or la vue
Expéditeur de l'API ne sérialisait que `completedAt` : `completedBy` n'arrivait jamais, et
l'adaptateur front retombait sur la phrase « du système » — « Période de vérification terminée
le …, sans signalement de ta part » — y compris après une décision de médiation.

Correction en trois points, dans l'ordre de la vérité :

1. **le contrat** — `completedBy: BookingActorSchema.nullish()` dans les jalons de
   `booking.schema.ts` (whitelist explicite, jamais un spread) ; les cinq `openapi.json` sont
   régénérés (le registre de schémas est global) ;
2. **le mapper** — `toMilestones` sert `completedBy` ;
3. **le front** — l'adaptateur conserve `ADMIN`, et `CompletedCards` rend
   `completed.banner.byMediation` : « Clos par la médiation le {date} : la décision est
   ci-dessous. » (FR + EN, contrôle i18n vert).

Le reste de l'écran (« le paiement de ton Voyageur est libéré », « le montant convenu ») reste
à arbitrer côté copie — noté au rapport, pas tranché ici.

## ANO-WEB-05 — le jeu d'essai n'avait jamais capturé un paiement

`deal-lifecycle.service.ts` pose `capturedAt` et `chargeId` à l'acceptation (D31). Le seed ne le
faisait pas : ses deals acceptés, livrés, terminés vivaient sans capture. Conséquence : la règle
du portefeuille (`wallet.service.ts`, `if (b.capturedAt && refund > 0 …)`) lisait « Libéré »
là où un remboursement partiel venait d'être décidé. Le seed pose désormais
`capturedAt = acceptedAt` et un `chargeId` factice dès qu'un deal a été accepté — une ligne, et
tout le back-office finances lit enfin des deals cohérents.

## Ce que le back-office a exigé du harnais

- adresses **absolues** (`adresseDuBackOffice()`) : la `baseURL` du projet est le front membre ;
- « À arbitrer » existe deux fois (menu latéral, lien retour) : on scope sur `aside` ;
- les montants sont formatés avec une espace insécable étroite avant `€` : `normaliserEspaces`
  avant toute comparaison ;
- la décision est **unique** : un second `POST …/resolve` répond 409 — le seed est rejoué en
  `beforeAll`.

## Tests

`apps/e2e` : **16 scénarios** verts sur le poste (harnais ×6, WEB-CNX ×3, WEB-RSV ×5, WEB-E2E-1,
WEB-E2E-2). deal-service 575 inchangé (mapper), auth-service 229. OpenAPI régénéré.

---

# WEB-E2E-3 : l'annulation tardive, l'arithmétique lue à l'écran, et une notification qui manquait

*(PR `chore/e2e-parcours-3`, 09/09/2026.)*

## Ce qui a été fait

Le troisième parcours bloquant du cahier 01-WEB : un deal accepté puis annulé par l'Expéditrice
à moins de 48 h du départ (ANN-01, D50). Quinze étapes, 38 s, et l'arithmétique du cahier refaite
à partir des montants **lus** — le total du bouton « Payer », le net « TU GAGNES » du Voyageur —
jamais de constantes : remboursement = total ÷ 2, compensation = arrondi(retenue × net ÷ total),
confrontés à la réponse du serveur et aux lignes Finances des deux côtés, à un centime près.

```
apps/e2e/src/pages/mes-envois.ts     la liste, la fenêtre « Annuler cet envoi ? », « Garder » (zéro requête), « Confirmer »
apps/e2e/src/pages/finances.ts       Paiements / Portefeuille : la ligne d'un deal, visée par son lien
apps/e2e/src/pages/mes-trajets.ts    la ligne d'un deal sous son trajet, la tentative d'annulation du trajet (D72)
apps/e2e/src/pages/fil-messagerie.ts + envoyer(texte), + ouvrirEncoreOuvert
apps/e2e/src/pages/reservation.ts    payer() attend l'intention, puis la demande, et réessaie une fois
apps/e2e/src/parcours/web-e2e-3.spec.ts
```

## La manœuvre en base, consignée

Le seed fait partir `yul` à J+3 ; le cahier exige moins de 48 h et autorise la manœuvre. Elle
passe par `jeuEssai.manoeuvre(raison, script)` — un `tsx -e` avec le `.env`, la raison écrite dans
la sortie du test — et elle est jouée **avant** la réservation : le barème lit le départ figé dans
le deal (`booking.trip.departureAt`), pas le trajet.

## Trois lectures d'écran rendues sûres

- **Une ligne se vise par son lien**, jamais par son texte : Marie-Claire a deux deals sur
  Paris → Montréal (`a[href="/fr/bookings/<id>"]`, `a[href="/fr/carrier/deals/<id>"]`).
- **« Bloqué chez Yamba » est à la fois une carte et un état de ligne** : on lit dans la ligne.
- **Un message vit deux fois** (aperçu de la liste, bulle du fil) : `.last()`.

Et « Payer » : cliqué avant le retour de l'intention de paiement, il ne fait rien. `payer()`
attend le texte du mode test (il porte le montant de l'intention), clique, attend `POST /deals`,
réessaie une fois — et lève si la demande n'est jamais partie.

## ANO-WEB-06 — un message reçu s'appelait « Notification »

`conversation.message_posted` n'avait ni présentation ni copie : la cloche affichait le titre de
repli et un lien vers le deal. Présentation dédiée (`MessageSquare`, teal), copie « Nouveau
message » / « {route} · « {extrait} » » (FR + EN — l'extrait est celui de l'événement, jamais le
message entier), et `Notifications.tsx` envoie une notification de conversation vers le fil
(`/dashboard/messages?conversation=…`).

## ANO-WEB-07 — un conseil inapplicable (ouverte)

Le refus D72 dit « annule-les d'abord depuis « Mes deals » » : cet écran n'existe pas, et le
Voyageur **ne peut pas** annuler un deal — la machine d'états le prévoit (ANN-02), le service le
refuse (`SHIPPER_ONLY`). Proposition au rapport : corriger le message tout de suite, et graver
l'annulation par le Voyageur comme un lot à part. Décision attendue.

## Tests

`apps/e2e` : **17 scénarios** verts sur le poste (harnais ×6, WEB-CNX ×3, WEB-RSV ×5, WEB-E2E-1 à 3).
user-ui : typecheck et i18n verts. Aucun service modifié.

---

# WEB-E2E-4 : le compte neuf, deux plafonds qui tombaient trop tard, un export qui ne s'ouvrait pas

*(PR `chore/e2e-parcours-4`, 09/09/2026.)*

## Ce qui a été fait

Le quatrième parcours du cahier 01-WEB (gravité majeure) : un compte créé sur place, plafonné
pendant trente jours (CNF-06, D71), et la vie ordinaire du compte — export des données, session
qui expire, appareils, suppression bloquée. Quatorze étapes, 1 min 06.

```
apps/e2e/src/fixtures/compte-neuf.ts   une adresse unique par exécution, le mot de passe de recette
apps/e2e/src/pages/inscription.ts      formulaire, case des conditions, code à six chiffres, « Compte activé »
apps/e2e/src/pages/securite.ts         export par la porte (téléchargement réel), sessions actives, suppression bloquée, reconnexion dans la fenêtre
apps/e2e/src/pages/reservation.ts      + tenterDeReserver() : le refus à l'intention, le refus au clic, ou le deal
apps/e2e/src/parcours/web-e2e-4.spec.ts
```

## Deux anomalies produit, corrigées

**ANO-WEB-08** — l'intention de paiement partait sans la valeur déclarée : le plafond « valeur
déclarée » ne tombait qu'à la création du deal, après l'autorisation bancaire. Le contrat le
prévoyait depuis ANO-API-12 ; `booking.api.ts` l'envoie désormais (conversion factorisée).

**ANO-WEB-09** — l'export « Mes données » demande la réponse en `blob` : le 403 `SUDO_REQUIRED`
arrivait en blob, le code n'était jamais lu, la porte ne s'ouvrait jamais. Le corps d'erreur en
blob est relu en JSON avant d'être relancé. L'export RGPD était inutilisable pour tout membre.

## Ce que le harnais a appris

- **Un refus peut tomber à deux moments** : à l'intention (encadré dans la carte de paiement) ou
  au clic « Payer » (toast). `tenterDeReserver()` écoute la réponse de l'intention, puis celle
  du deal, et rend le refus tel qu'il est écrit, ou l'identifiant du deal.
- **L'assistant garde son brouillon en `sessionStorage`** : `ouvrir()` l'oublie et recharge.
- **Un téléchargement réel se capture** : `page.waitForEvent("download")` armé avant le clic qui
  déclenche l'ancre `download` sur un blob ; le fichier est relu sur le disque.
- **Une heure d'inactivité se simule fidèlement** : SES-01 fait du délai d'inactivité la durée de
  vie de la clé Redis `refresh_jti:<userId>:<jti>` ; la supprimer (manœuvre consignée) et
  retirer le cookie d'accès de quinze minutes, c'est exactement l'avoir laissée expirer.
- **La fenêtre « Ta session a expiré » embarque un formulaire complet** : on la vise par son
  `dialog`, jamais par `#email` seul.

## Tests

`apps/e2e` : **18 scénarios** verts sur le poste (harnais ×6, WEB-CNX ×3, WEB-RSV ×5, WEB-E2E-1 à 4).
user-ui : typecheck et i18n verts. Aucun service modifié.

---

# WEB-E2E-5 : le refus au pickup, et une annulation qui n'en était pas une

*(PR `chore/e2e-parcours-5`, 10/09/2026.)*

## Ce qui a été fait

Le cinquième parcours du cahier 01-WEB (gravité majeure) : un deal accepté et capturé, puis
refusé par le Voyageur à la prise en charge — remboursement intégral, kilos rendus, deux emails,
et une ligne de faits qui ne bouge pas. Huit étapes, 1 min 06.

```
apps/e2e/src/pages/transport-voyageur.ts   + refuserLeColis() : l'écran de prise en charge, la fenêtre, la raison, le toast, la réponse du serveur
apps/e2e/src/pages/profil-public.ts        la page publique d'un membre : le publicSlug (via /auth/me), la ligne de faits, le compte d'annulations tardives
apps/e2e/src/pages/mes-trajets.ts          + kilosRestants() partagé (sorti de web-e2e-3, qui l'importe désormais)
apps/e2e/src/parcours/web-e2e-5.spec.ts
```

## Une anomalie produit, corrigée — ANO-WEB-10

La machine d'états déclare le refus au pickup **sans pénalité** (`refusePickup` : `FULL_REFUND`,
`RELEASE_CAPACITY`, `NOTIFY_SHIPPER` — pas de `PENALIZE_CARRIER`). Mais la réputation (D29 ①)
est un **modèle de lecture** recalculé à part, dans `apps/deal-service/src/services/reputation.service.ts`,
et sa requête des « annulations tardives » du Voyageur disait : `status: CANCELLED, closedBy:
CARRIER, acceptedAt ≠ null`. Un refus au pickup coche les trois. Comme l'annulation ANN-02 par
le Voyageur n'existe pas encore côté service (ANO-WEB-07, lot à part), ce compteur ne comptait
en pratique **que** des refus au pickup — l'inverse exact de son intention.

Pourquoi personne ne l'avait vu : le refus ne déclenchait aucun recalcul. La page publique
restait juste jusqu'au prochain fait de réputation (un deal terminé, un avis révélé), où le refus
apparaissait rétroactivement comme une annulation fautive. La première version du parcours passait
donc « pour rien » (piège 7 du handoff : une assertion doit pouvoir échouer) ; la preuve a été
faite en base — l'ancien filtre comptait 1 sur le deal refusé, le nouveau 0.

Trois gestes, dans trois fichiers :

1. **Une marque en base.** `Booking.pickupRefusedAt DateTime?` (`prisma/schema.prisma`). La raison
   du refus est facultative (`pickupRefusalReason` peut être `null` sur un vrai refus), elle ne
   pouvait pas servir de discriminant. `refusePickup` pose la marque avec `now` dans la même
   transaction que le reste (`deal-transport.service.ts`).
2. **Une requête qui exclut la marque, champ absent compris.** Les deals antérieurs à la marque
   n'ont pas le champ ; sur Mongo, `pickupRefusedAt: null` ne les verrait pas (piège payé six
   fois). D'où `OR: [{ pickupRefusedAt: null }, { pickupRefusedAt: { isSet: false } }]`.
3. **Le refus recalcule la réputation des deux parties** (`recomputeBookingParties`, best effort,
   comme l'annulation tardive) : la page publique dit vrai tout de suite, et l'étape 7 du parcours
   devient une vraie relecture avant / après.

Aucun DTO n'expose la marque : elle sert la réputation, pas les écrans.

## Ce que le harnais a appris

- **Une relecture « inchangé » n'a de valeur que si le produit a eu l'occasion de changer.** La
  ligne de faits est lue avant la réservation et après le refus ; c'est le recalcul déclenché par
  le refus qui rend la comparaison probante. Sans lui, l'assertion passait par inertie.
- **Deux fenêtres pour un seul geste.** La modale (desktop) et le tiroir (mobile) portent toutes
  deux `role="dialog"` ; le tiroir fermé est `aria-hidden`, donc absent de l'arbre des rôles.
  On vise la fenêtre ouverte par son titre, et on confirme DANS la fenêtre — « Refuser le colis »
  est aussi le bouton du pied de page.
- **Le remboursement se prouve par la réponse du serveur ET par l'écran.** `refundAmountCents`
  de `POST /deals/:id/pickup/refuse` égale le total lu à l'étape 1 ; la ligne Finances écrit le
  même montant ; l'email de remboursement ne contient pas le mot « retenue ».

## Tests

deal-service : **576** tests (+1 : la requête des faits Voyageur exclut la marque, absent compris ;
la marque et le recalcul sont vérifiés dans le spec du transport). Plateforme : 990.
`apps/e2e` : **19 scénarios** verts sur le poste (harnais ×6, WEB-CNX ×3, WEB-RSV ×5, WEB-E2E-1 à 5).

---

# WEB-E2E-6 : le destinataire, et quatre liens qui menaient à un bouchon

*(PR `chore/e2e-parcours-6`, 10/09/2026.)*

## Ce qui a été fait

Le sixième et dernier parcours du chapitre 6 (gravité majeure) : la page publique de suivi
(D69) rechargée à chaque pas du colis, par un visiteur qui n'a qu'un lien. Neuf étapes, 1 min 00.
Le chapitre 6 est clos.

```
apps/e2e/src/pages/suivi-destinataire.ts   + aideCourante(), jalonsAtteints(), neReveleRien(secrets) (écran + source),
                                             clesServiesParLApi() (liste fermée), mentionDeConfidentialite(),
                                             suivreLeLienDAcquisition(), lienInvalide(), refusDeLApi()
apps/e2e/src/parcours/web-e2e-6.spec.ts
```

## Une anomalie produit, corrigée — ANO-WEB-11

`/become/carrier` et `/become/shipper` étaient deux bouchons de la migration next-intl —
« Become a carrier (UI only) » — jamais remplacés, et `/become-yamber` (pied de page, menu
visiteur) n'a jamais existé. Quatre entrées « Devenir Voyageur » menaient à du vide : la page
destinataire, l'appel final de l'accueil, le pied de page, le menu « Découvrir ».

La correction tient en six fichiers : les deux bouchons deviennent des **redirections
serveur** (`redirect` de `@/i18n/navigation`, qui garde la locale) vers l'écran réel —
`/carrier/onboarding` et `/search` — pour tout lien déjà partagé ; les quatre liens visent
directement l'onboarding. L'assistant d'onboarding envoie déjà un visiteur à
`/login?redirect=/carrier/onboarding` et le ramène après connexion : c'est l'écran attendu par
WEB-VOY-1.

## Ce que le harnais a appris

- **Une absence se prouve sur trois surfaces.** Le texte de l'écran, le code source
  (`page.content()` — une donnée peut être dans le HTML sans être visible), et la réponse de
  l'API dont les clés sont comparées à une liste FERMÉE : toute clé ajoutée au contrat fait
  échouer le parcours, ce qui est le but.
- **Les secrets connus se cherchent nommément.** Le harnais connaît le code de livraison, le
  numéro du destinataire, le montant payé et les lieux de remise du trajet : `neReveleRien()`
  les reçoit et les cherche, en plus des motifs génériques.
- **Un `Link` Next navigue côté client** : `networkidle` ne dit rien de la navigation, on attend
  l'URL attendue (`toHaveURL`). Et l'en-tête du site porte les mêmes libellés que le bloc
  d'acquisition : on vise le lien DANS le bloc.
- **Un 404 uniforme se prouve par comparaison** : le corps de la réponse pour un jeton altéré
  d'un caractère est identique, octet pour octet, à celui d'un jeton inventé.

## Tests

`apps/e2e` : **20 scénarios** verts sur le poste (harnais ×6, WEB-CNX ×3, WEB-RSV ×5, WEB-E2E-1 à 6).
user-ui : typecheck vert. Aucun service modifié.

---

# Chapitre 5.1 du cahier 01-WEB : l'accueil du visiteur, et six anomalies derrière la première recherche

*(PR `chore/recette-web-5-1`, 10/09/2026.)*

## Ce qui a été fait

Le premier des 32 chapitres « fiches » du cahier 01-WEB : `WEB-ACC` (découverte, accueil et
navigation), douze fiches jouées dans l'ordre du cahier, en desktop, par le harnais
(`apps/e2e/src/chapitres/web-acc.spec.ts`, 1 min 24). Dix passent sur le produit tel quel ; les
deux qui touchent la recherche depuis l'accueil ont fait tomber trois anomalies (deux bloquantes,
une majeure), et trois fiches d'apparence anodine (bascule de langue, textes légaux, réseaux
sociaux) trois anomalies mineures. Toutes closes dans la PR.

```
apps/e2e/src/chapitres/web-acc.spec.ts         NOUVEAU — 12 fiches WEB-ACC-1 à 12 ; aides : clesBrutesAffichees()
                                                 (balayage des nœuds de texte), ecouterLesErreurs(), lienVisible()
                                                 (le libellé VISIBLE d'un bloc qui en porte deux), choisirUneVille()
                                                 (frappe touche par touche + journal des réponses Google), ORIGINE_GOOGLE
apps/user-ui/src/components/home/HeroSection.tsx          « Rechercher » → router.push("/search")             (ANO-WEB-12)
apps/user-ui/src/components/search/TripSearchBar.tsx      exporte TRIP_SEARCH_STORAGE_KEY, initialSearchDraft, SEARCH_VERSION
apps/user-ui/src/components/search/SearchResultsView.tsx  interroge le brouillon mémorisé (même clé)          (ANO-WEB-12)
apps/trip-service/src/lib/place-text.ts (+ .spec.ts)      placeSearchTerm() : « Ville, Pays » → « Ville »       (ANO-WEB-13)
apps/trip-service/src/controllers/trip-search.controller.ts  buildBaseWhere() passe from/to par placeSearchTerm()
apps/user-ui/src/lib/googlePlaces.ts                      callback= de Google au lieu de onload ; prêt = importLibrary (ANO-WEB-14)
apps/user-ui/src/components/search/CityAutocomplete.tsx   le catch journalise (console.warn)                    (ANO-WEB-14)
apps/user-ui/src/components/layout/Footer.tsx             SOCIAL_LINKS_ENABLED = false                          (ANO-WEB-15)
apps/user-ui/src/app/layout.tsx                           <html lang={await getLocale()}>                       (ANO-WEB-16)
apps/user-ui/src/components/layout/HtmlLang.tsx           NOUVEAU — aligne document.documentElement.lang après une bascule
apps/user-ui/src/app/[locale]/layout.tsx                  monte <HtmlLang locale={locale} />
apps/user-ui/src/app/[locale]/(marketing)/legal/layout.tsx  <main> → <div> (plus de main imbriqué)              (ANO-WEB-17)
context/YAMBA-RECETTE-WEB-RESULTATS.md                    ANO-WEB-12 à 17, chapitre 5.1, observations
```

## Les six anomalies, et pourquoi elles tenaient ensemble

**ANO-WEB-12 (bloquante) — « Rechercher » ne cherchait pas.** `HeroSection` montait
`<TripSearchBar>` sans `onSearchAction` ; le composant documente lui-même ce cas comme
« comportement par défaut : log ». Le bouton faisait un `console.log` et rien d'autre. Deuxième
moitié du même défaut : `SearchResultsView` interrogeait un brouillon `useState` VIDE, alors que la
barre mémorise le sien en `sessionStorage` (`usePersistedFormState("trip-search")`). Correction en
deux gestes cohérents : l'accueil navigue vers `/search`, et la page de résultats lit le MÊME
brouillon (clé, brouillon initial et version désormais exportés par `TripSearchBar`). Une seule
source pour ce que le visiteur a saisi ; en arrivant, les résultats correspondent.

**ANO-WEB-13 (bloquante) — une ville choisie dans la liste ne trouvait rien.** L'autocomplétion
pose « Ville, Pays » dans le champ (`CityAutocomplete.select`, « on rétablit toujours le pays »).
La recherche comparait ce libellé ENTIER à `destinationCity` et `destinationCountry` par
`contains` : « Brazzaville, République du Congo » n'est contenu dans aucun des deux. Toute ville
étrangère donnait zéro résultat ; Paris passait par accident (Google omet le pays du domicile).
La règle est désormais dans `lib/place-text.ts` : le terme cherché est le premier segment avant
une virgule. Le pays n'est pas un critère — il est dans la langue de l'écran, la base le porte
dans la langue du Voyageur qui a publié. Fonction pure, trois tests. Le contrôleur ne change que
sur deux lignes.

**ANO-WEB-14 (majeure) — la première liste de suggestions était perdue.** `googlePlaces.ts`
chargeait l'API avec `loading=async` et se résolvait sur `script.onload` — qui arrive avant que
`google.maps.importLibrary` n'existe. La toute première requête (celle qui déclenche le
chargement) échouait sur « importLibrary is not a function » ; les suivantes trouvaient tout prêt.
D'où un symptôme qui dépend du RYTHME de frappe : « Paris » à 60 ms par touche → rien ; à
250 ms → la liste (chaque frappe relance, la deuxième arrive après le chargement). Le contrat de
Google pour `loading=async` est le paramètre `callback=` : c'est lui qui dit « prêt ». Et le
composant avalait l'erreur (`catch {}`) : il journalise maintenant.

**ANO-WEB-15, 16, 17 (mineures)** — les icônes sociales ouvraient `instagram.com/yamba` (pas à
nous) : `SOCIAL_LINKS_ENABLED = false`, l'état inactif était déjà écrit. `<html lang="fr">` sur
`/en` : le layout racine lit `getLocale()` (rendu serveur), `HtmlLang` aligne l'attribut après une
bascule côté client (le layout racine, partagé, ne se re-rend pas). Deux `<main>` imbriqués sur
les pages légales : le cadre devient un `<div>`.

## Ce que le harnais a appris

- **Le libellé visible d'un bloc qui en porte deux.** L'en-tête et le pied de page ont chacun un
  arbre mobile et un arbre desktop dans le DOM ; `first()` tombe souvent sur le mobile, caché.
  `filter({ visible: true })` avant `first()`, systématiquement.
- **Une porte se vise par son nom.** Quatre autres `role="dialog" aria-modal="true"` vivent en
  permanence dans la page (feuilles de la recherche mobile, fermées) ; un sélecteur par rôle seul
  en trouve cinq.
- **`fill()` n'est pas taper.** L'autocomplétion n'interroge Google qu'au fil des frappes ;
  `pressSequentially` — et l'échec journalise ce que Google a répondu (référent refusé, clé
  absente), pour que le rapport dise la cause.
- **La clé Google est restreinte par référent à `localhost`** : sur l'adresse LAN du poste,
  Places répond 403. Les fiches d'autocomplétion se jouent en visiteur, sans cookie : le harnais
  ouvre le même front par `localhost` (`ORIGINE_GOOGLE`, surchargeable).
- **Les 401 de la sonde de session sont rouges dans la console de tout visiteur.** Filtrés et
  consignés comme observation (le marqueur `yamba:session` permettrait de ne pas sonder).

## Tests

trip-service **257 → 260** (`lib/place-text.spec.ts`). `apps/e2e` : **32 scénarios** verts sur le
poste (20 + WEB-ACC ×12). user-ui et trip-service : typecheck vert.

---

# Chapitre 5.2 du cahier 01-WEB : l'inscription, seize fiches et une preuve en base

*(PR `chore/recette-web-5-2`, 10/09/2026.)*

## Ce qui a été fait

Le deuxième chapitre « fiches » du cahier 01-WEB : `WEB-INS` (inscription par code email,
consentement, Google). Seize fiches ; douze se jouent par le harnais
(`apps/e2e/src/chapitres/web-ins.spec.ts`), quatre (le parcours Google, 13 à 16) sont déclarées
`⏭` tant que `NEXT_PUBLIC_GOOGLE_CLIENT_ID` n'est pas posée — et resteront à jouer à la main
ensuite, la fenêtre de consentement Google ne se pilotant pas. Une anomalie mineure (ANO-WEB-18,
un « Connectez-vous » qui vouvoyait), close dans la PR ; trois écarts de cahier consignés (adresse
masquée sur l'écran du code, ordre des règles de mot de passe sur une date, titre « Deviens
Voyageur »).

```
apps/e2e/src/chapitres/web-ins.spec.ts            NOUVEAU — 16 fiches ; aides : formulaire() (le <form> de la PAGE, pas celui
                                                    d'une fenêtre de connexion), remplir(), erreurSous() (#<champ>-error),
                                                    creerMonCompte() (rend la réponse de POST /auth/register ou null),
                                                    jusquAuCode(), saisirLeCode() (six cases + « Valider mon code »),
                                                    collerLeCode() (un vrai événement paste), codeDe()
apps/e2e/src/fixtures/compte-neuf.ts              compteNeuf(prenom, nom) : un compte par exécution (neuf-<horodatage>@recette.yamba.dev)
apps/e2e/src/fixtures/jeu-essai.ts                inspecterCompte(email) → inspect-user.ts par execFileSync ; type CompteInspecte
packages/libs/prisma/scripts/inspect-user.ts      NOUVEAU — ce que la base sait d'un compte, en JSON, sans secret
                                                    (consentements, preferredLocale, hasPassword, identités)
apps/user-ui/src/lib/auth/auth-error-codes.ts     registerCodeMessage tutoie (ANO-WEB-18)
context/YAMBA-RECETTE-WEB-RESULTATS.md            ANO-WEB-18, chapitre 5.2, à trancher, pièges
```

## Comment le chapitre est construit

**Une histoire en quatre fiches.** Les fiches 6 à 9 décrivent le même compte — créé, bloqué
après cinq codes faux, code renvoyé, activé. Le barème de blocage (7) ne se comprend qu'après la
création (6) et avant le renvoi (8) : elles sont jouées dans UN scénario, chaque fiche en
`test.step`, pour que le rapport Playwright nomme l'étape qui tombe. Le blocage dure une vraie
minute et le scénario l'attend (`toBeEnabled({ timeout: 75_000 })`) ; le simuler reviendrait à ne
pas tester la règle. `test.setTimeout(8 * 60_000)`.

**Une adresse par exécution.** `compteNeuf()` fabrique `neuf-<horodatage>@recette.yamba.dev`.
Le cahier propose `recette+neuf@seed.yamba.dev` en dur ; un compte créé la veille ferait tomber la
fiche 6 sur « adresse déjà utilisée ». Mailpit accepte tout domaine, la base de développement
garde les comptes (sans conséquence).

**Le compteur qui ne repart pas.** Après cinq échecs et un renvoi de code, le sixième échec
annonce « 4 essais restants » — exactement ce qu'un PREMIER échec d'un nouveau lot dirait. La
preuve n'est pas dans le chiffre du 6e mais dans le 7e (« 3 ») et dans l'absence de nouveau
blocage entre les deux : le serveur compte 6 puis 7, pas 1 puis 2.

**La preuve en base.** Le cahier demande de vérifier `ConsentLog` et `preferredLocale` — ce que
l'écran ne montre pas. `inspect-user.ts` répond une ligne JSON sans rien de secret (jamais
l'empreinte, seulement `hasPassword`) ; le harnais l'appelle par `execFileSync` (`tsx`,
`--env-file=.env`) et lit la dernière ligne. Le premier passage a payé le prix d'un script non
exécuté seul : un `select` sur `isVerified`, champ que `User` n'a pas, ne casse qu'à
l'exécution — sur la dernière assertion du scénario, trois minutes après son début.

**Le collage.** « Le collage doit remplir les six cases d'un coup » : `collerLeCode()` construit
un `DataTransfer`, y pose le texte et dispatche un `ClipboardEvent("paste")` sur la première
case — un vrai événement, celui que le composant écoute ; six `fill()` prouveraient autre chose.

## ANO-WEB-18

`registerCodeMessage` est antérieur au passage au tutoiement (décision du 03/09) ; les phrases
voisines des règles de mot de passe sont impersonnelles (« Le mot de passe doit… ») et n'avaient
rien à changer — la seule qui s'adresse à la personne avait échappé. « Connecte-toi ou utilise
« Mot de passe oublié ». » ; la version anglaise ne bouge pas.

## Ce que le harnais a appris

- **Le `role="alert"` qui n'est pas le tien.** Next 16 monte en développement l'indicateur
  « Open Next.js Dev Tools » avec `role="alert"`, hors `<main>`. « Aucune alerte visible » se
  vérifie dans `page.locator("main")`, jamais sur la page entière.
- **Un formulaire se vise par la page.** Une fenêtre de connexion peut monter un second `<form>`
  avec les mêmes `id` (observation du chapitre 6) : `page.locator("main form").first()`.
- **Le libellé n'est pas la donnée, encore.** L'écran du code affiche `maskEmail(email)` ; le
  spec vérifie premier caractère, `@` et domaine — et le rapport consigne l'écart de cahier au
  lieu de plier l'assertion en silence.
- **Un script externe se lance seul avant d'être branché** (voir « la preuve en base »).

## Tests

Aucun test unitaire ajouté (une chaîne de message). `apps/e2e` : **45 scénarios** (41 joués,
4 `⏭` Google) — 32 + WEB-INS ×13. user-ui : typecheck vert.

---

# Chapitre 5.3 du cahier 01-WEB : connexion, sessions, porte sudo — treize fiches et une vraie faille

*(PR `chore/recette-web-5-3`, 11/09/2026.)*

## Ce qui a été fait

Le troisième chapitre « fiches » du cahier 01-WEB : `WEB-CNX` (connexion, « Rester connecté »,
session expirée, appareils connectés, porte de confirmation). Treize fiches, toutes jouées, plus
les trois vérifications historiques d'`ANO-WEB-01` conservées en tête du fichier
(`apps/e2e/src/chapitres/web-cnx.spec.ts`). Douze fiches conformes ; une anomalie **majeure
ouverte** (ANO-WEB-19 : aucune protection anti-force-brute sur la connexion) — décision et PR
dédiées, hors recette ; une anomalie **mineure close** (ANO-WEB-20 : pas de message après avoir
déconnecté un appareil) ; plusieurs écarts de cahier consignés.

```
apps/e2e/src/chapitres/web-cnx.spec.ts            13 fiches + ANO-WEB-01 ; aides : formulaire(), seConnecter(),
                                                    erreurDeConnexion(), sessionsParApi(), ouvrirLaSecurite(),
                                                    lignesAppareils()/ligneCetAppareil(), fenetreSessionExpiree(),
                                                    actionServeurSansRechargement(), ouvrirFenetreSudo() (tolérante au cooldown)
apps/e2e/src/fixtures/yamba.ts                     navigateurConnecte accepte { memoriser } → coche « Rester connecté » (implique parEcran)
apps/user-ui/src/app/[locale]/dashboard/dashboard.copy.ts  securityPage.sessionRevoked (« Appareil déconnecté. »)   (ANO-WEB-20)
apps/user-ui/src/components/dashboard/sections/Security.tsx  doRevoke pose le message                                (ANO-WEB-20)
packages/libs/prisma/scripts/clear-sudo-locks.ts  NOUVEAU — purge les verrous OTP sudo d'un compte (rerun propre)
context/YAMBA-RECETTE-WEB-RESULTATS.md            ANO-WEB-19, 20, chapitre 5.3, à trancher, pièges
```

## ANO-WEB-19 — la connexion par mot de passe n'a aucun verrou

C'est la trouvaille du chapitre, et elle était déjà écrite dans le cahier de recette API. L'OTP a
ses paliers de verrou (1 min → 30 min → 24 h) et un email d'alerte ; `loginUser`, lui, n'a rien.
Le seul rempart est le limiteur de la passerelle (100 requêtes / 15 min par IP), déclaré
`skipFailedRequests: true` : une tentative en échec n'est PAS comptée. Douze mauvais mots de passe
d'affilée donnent douze 401 et jamais un 429. La fiche WEB-CNX-4 est jouée et marquée `test.fail` :
le jour où le verrou existe, elle « passe » et Playwright le signale. Correctif proposé (PR
dédiée) : la mécanique OTP réutilisée, compteur par `emailNormalized`, email d'alerte, refus
indistinguable (même corps, même statut — ANO-API-08/18).

## Ce que la mécanique sudo a imposé au harnais

La porte de confirmation (D65) est un objet plus subtil qu'il n'y paraît, et trois de ses
propriétés ont façonné le test :

1. **Un changement de mot de passe FERME la fenêtre sudo** (`closeSudoWindow`), l'export ne la
   ferme pas. L'ordre littéral du cahier (WEB-CNX-11 : « suite immédiate » de WEB-CNX-10, donc
   export après un changement de mot de passe) redemanderait donc un code. C'est une bonne
   sécurité, pas un bug. Le harnais ouvre UNE fenêtre dédiée et y enchaîne les gestes qui ne la
   ferment pas (export, puis le rétablissement du mot de passe en dernier).
2. **Six codes sudo par heure, un par minute** (anti-spam OTP). Une première version du test
   sondait `/auth/me/sudo/request` toutes les trois secondes pour « attendre » le cooldown : elle
   a grillé le quota (verrou d'une heure). La règle : demander UNE fois, attendre le cooldown
   d'une minute, redemander UNE fois — et comme une fenêtre couvre plusieurs gestes, on n'en
   ouvre qu'une.
3. **La fenêtre est liée au `jti`** de la session (donc à l'appareil), pas au compte : `verifySudo`
   pose `sudo:<userId>:<jti>`, `requireSudo` lit le même `jti`. WEB-CNX-12 le prouve avec deux
   contextes.

## Deux profils de session, lus sur le cookie

Le cookie de rafraîchissement dit tout : session standard = cookie de **session** (`expires` = −1,
le « 60 min » d'inactivité vit côté serveur) ; « Rester connecté » = cookie **persistant**,
`expires` ≈ +30 jours — la vie ABSOLUE (D27/SES-02), pas l'inactivité de 7 jours. La première
version du test attendait « ≈ 7 jours » sur le cookie : faux, c'est 30. La mention « connexion
mémorisée » de la page Sécurité, elle, se lit sur la session (`rememberMe`), pas sur le cookie.

## Ce que le harnais a appris

- **Deux navigateurs, un compte.** A et B sont deux `BrowserContext` connectés à Aminata : c'est
  la seule façon de prouver qu'une session tuée depuis A meurt dans B (WEB-CNX-8, 9). Le harnais
  connecte toujours par l'écran (`parEcran`), jamais depuis la mémoire, puisque les fiches parlent
  de la naissance et de la mort des sessions.
- **Une action serveur sans rechargement**, c'est un lien de la barre latérale du tableau de bord
  (navigation côté client ; la section qui arrive interroge l'API) — pas un `reload`, qui ne
  prouverait pas « la page ne change pas ».
- **Rendre le mot de passe quoi qu'il arrive.** WEB-CNX-10 change le mot de passe d'Aminata ; un
  `finally` le rétablit, et si la fenêtre sudo a été fermée entre-temps, il en rouvre une. Un
  échec de rétablissement lève une erreur explicite (« rejouer seed-deals.ts »).

## Tests

Aucun test unitaire ajouté (un libellé). `apps/e2e` : le chapitre 5.3 fait passer le harnais à
**58 scénarios** (45 + WEB-CNX ×13). user-ui : typecheck vert.

---

# Chapitre 5.4 du cahier 01-WEB : mot de passe et adresse email — des comptes jetables

*(PR `chore/recette-web-5-4`, 11/09/2026.)*

## Ce qui a été fait

Le quatrième chapitre « fiches » du cahier 01-WEB : `WEB-MDP` (mot de passe oublié, changement de
mot de passe, changement d'adresse email). Six fiches, jouées en quatre scénarios
(`apps/e2e/src/chapitres/web-mdp.spec.ts`), toutes conformes — **aucune anomalie**.

```
apps/e2e/src/chapitres/web-mdp.spec.ts   NOUVEAU — 6 fiches ; aides : creerCompteActive() (register + activation par
                                           code), connecter(), ouvrirLaSecurite(), ouvrirFenetreSudo() (autonome, cooldown),
                                           sessionVivante(), codeDe()
context/YAMBA-RECETTE-WEB-RESULTATS.md   section chapitre 5.4 (aucune anomalie), pièges
```

## Le principe : des comptes qui ne survivent pas au test

Ce chapitre change des mots de passe ET une adresse email **définitivement**. Le faire sur un
compte du seed le laisserait cassé, et fausserait `seed-output.json`. Chaque scénario crée donc
son propre compte neuf (`compteNeuf()` → `neuf-<horodatage>@recette.yamba.dev`) et l'active par le
vrai parcours (registration + code email, `creerCompteActive`). Un compte par test, jeté ensuite ;
la base de développement les garde sans conséquence (piège 22). Bénéfice de bord : sur une adresse
neuve, tous les compteurs d'OTP (activation, réinitialisation, sudo, changement d'adresse) sont
vierges — aucun verrou hérité d'un run précédent.

## Ce que chaque flux impose

- **Mot de passe oublié (WEB-MDP-1/2/3)** — trois écrans : `/password/forgot` (adresse →
  `sessionStorage`, `/auth/password/forgot`), `/password/verify` (code, `/auth/password/verify`),
  `/password/reset` (nouveau mot de passe, `/auth/password/reset`). La réponse ne révèle jamais si
  le compte existe : une adresse inexistante fait avancer l'écran et n'envoie aucun email. Les
  règles de force valent aussi ici (`abc` → « au moins 8 caractères »).
- **Changer son mot de passe (WEB-MDP-4)** — derrière la porte sudo : le nouveau doit différer de
  l'actuel (`PASSWORD_SAME_AS_CURRENT`, un refus qui NE ferme PAS la fenêtre), puis un mot de
  passe valide déclenche l'email « Ton mot de passe Yamba a été modifié » et **ferme toutes les
  autres sessions** (le second navigateur meurt, la courante reste).
- **Changer son adresse (WEB-MDP-5/6)** — le code part **sur la nouvelle adresse** (jamais sur
  l'ancienne) ; une adresse déjà prise est refusée avant tout envoi (`EMAIL_ALREADY_USED`) ; après
  confirmation, l'adresse du compte change, l'**ancienne** reçoit une simple information « …a
  changé » **sans code**, les autres sessions tombent, et la connexion se fait avec la nouvelle
  adresse. `requestEmailChange` exige la fenêtre sudo mais ne la ferme pas ; `confirmEmailChange`
  la ferme.

## Un piège de mot de passe de test

Le premier jet du nouveau mot de passe, `Yamba-Recette-…`, contenait le prénom « Recette » du
compte neuf : refus `PASSWORD_CONTAINS_PERSONAL_INFO`. La règle de force compare le mot de passe au
prénom, au nom et à l'adresse — un mot de passe d'essai se choisit à l'écart de ces valeurs
(`Kola-Mangue-7x-Teal!`).

## Tests

Aucun test unitaire ajouté. `apps/e2e` : le chapitre 5.4 porte le harnais à **62 scénarios**
(58 + WEB-MDP ×4). Harnais : typecheck vert.

---

# Chapitre 5.5 du cahier 01-WEB : profil, avatar et page publique — le drapeau qu'on n'affichait pas

*(PR `chore/recette-web-5-5`, 11/09/2026.)*

## Ce qui a été fait

Le cinquième chapitre « fiches » du cahier 01-WEB : `WEB-PRO` (écran Profil, bornes des champs,
avatar, page publique `/u/<slug>` et sa visibilité). Dix fiches ; huit jouées et conformes, deux
`⏭` (avatar réel sur ImageKit, et « Afficher ma ville » que le seed ne peut pas alimenter). Une
anomalie mineure trouvée et **corrigée** : `ANO-WEB-21`.

```
apps/e2e/src/chapitres/web-pro.spec.ts                       NOUVEAU — 10 fiches ; instantané/restauration du profil,
                                                               garde-fou avatar (Buffer 2,05 Mo, aucune requête)
apps/user-ui/src/lib/public-user.types.ts                    PublicUser.hidden ajouté (déjà présent dans la réponse API)  (ANO-WEB-21)
apps/user-ui/src/components/users/profile/UserProfileView.tsx bannière « masquée » quand user.hidden                       (ANO-WEB-21)
apps/user-ui/messages/{fr,en}/user-profile.json              clé hiddenBanner                                              (ANO-WEB-21)
context/YAMBA-RECETTE-WEB-RESULTATS.md                       ANO-WEB-21, chapitre 5.5, à trancher, observations, pièges
```

## ANO-WEB-21 — un drapeau serveur que le front ignorait

Quand un membre masque sa page publique, l'API `getUserPublic` répond 404 à tout le monde SAUF au
propriétaire, à qui elle renvoie la page avec `hidden: true` (D67 1A). Le propriétaire voyait donc
sa page — mais sans aucune mention qu'elle était masquée, parce que le front ne portait même pas ce
drapeau : `hidden` était absent du type `PublicUser`, et rien ne le lisait. Encore une intention
écrite côté serveur qu'aucun rendu n'honorait (le même motif que ANO-WEB-01 et 16). Correctif
minimal : `hidden` déclaré au type (la valeur arrivait déjà), et une bannière en tête de
`UserProfileView`.

## Le garde-fou d'avatar, sans écriture externe

WEB-PRO-5 et 6 téléversent sur ImageKit (service externe réel) : le harnais joue le seul geste qui
n'écrit rien — le refus, côté navigateur, d'un fichier de plus de 2 Mo. `setInputFiles` avec un
`Buffer` de 2,05 Mo et un type `image/png` déclenche `validateFile` (`useImageKitUpload`,
`maxSizeBytes` = 2 Mo) AVANT tout appel réseau ; on écoute les requêtes vers `imagekit` / `upload`
/ `/auth/me/avatar` et on vérifie qu'aucune n'est partie. Le téléversement réel et le retrait (dont
la contre-épreuve « l'ancienne image répond introuvable ») restent `⏭`, joués à la main.

## Deux écarts, une observation

- **La page publique identifie par « Prénom N. »**, pas par le « nom affiché » du profil
  (`CarrierPage.name`). Le cahier attendait le nom affiché « à jour » sur la page publique. À
  trancher ; l'identité par prénom + initiale est cohérente avec la vie privée.
- **Le réseau et les actions vivent dans l'`<aside>`**, pas dans `<main>` : une assertion scopée à
  `main` sur « abonnés » ou « Signaler ce profil » échoue à tort.
- **Le seed ne pose pas de ville** sur l'adresse des Voyageurs : WEB-PRO-10 se saute proprement
  (lecture de la ville via `/auth/me`, `test.skip` si absente). À compléter dans `seed-deals.ts`.

## Tests

Aucun test unitaire ajouté (un champ de type, une bannière, une clé i18n). `apps/e2e` : le chapitre
5.5 porte le harnais à **72 scénarios** (62 + WEB-PRO ×10, dont 2 `⏭`). user-ui : typecheck vert,
miroir i18n FR/EN respecté.

---

# Chapitre 5.6 du cahier 01-WEB : devenir Voyageur — onboarding, et les limites de Stripe Express

*(PR `chore/recette-web-5-6`, 11/09/2026.)*

## Ce qui a été fait

Le sixième chapitre « fiches » du cahier 01-WEB : `WEB-VOY` (onboarding Voyageur en deux étapes,
et ce qu'il conditionne). Sept fiches ; quatre jouées et conformes (`web-voy.spec.ts`), trois `⏭`
motivées (complétion Stripe Express, refus d'accept, tableau de bord Stripe). Aucune anomalie.

```
apps/e2e/src/chapitres/web-voy.spec.ts   NOUVEAU — 4 fiches jouées + 3 ⏭ ; compte neuf créé+activé, profil via API,
                                           trajet PER_KG publiable, redirection réelle vers connect.stripe.com
context/YAMBA-RECETTE-WEB-RESULTATS.md   chapitre 5.6, automatisation Stripe (couvert / non couvert), pièges
```

## Ce que l'onboarding conditionne (et ce qu'il ne conditionne pas)

Le résultat marquant du chapitre : **publier un trajet n'exige pas Stripe**. Un compte neuf qui a
franchi la seule étape « Profil » (`POST /carrier/onboarding/profile` → `onboardingStep=STRIPE`)
publie un trajet (`POST /trips` avec `publish:true` → `PUBLISHED`). Le verrou D31 (profil + Stripe
prêts) est au moment d'**accepter** une demande, pas de publier — `createTrip` lit le `carrierPage`
mais ne le gate pas. La vieille doc `RG-01` disait l'inverse ; le code fait foi.

## La partie Stripe : jusqu'où on peut aller

La clé du poste est `sk_test_` et le produit crée de **vrais** comptes Connect **Express** de test.
Le harnais vérifie tout le côté Yamba : le clic « Connecter avec Stripe » crée le compte Express
et son lien, redirige vers `connect.stripe.com`, et aucun IBAN n'est demandé dans un formulaire
Yamba (WEB-VOY-4).

Ce qu'on ne peut **pas** automatiser proprement : la complétion de l'onboarding Express. Deux
tentatives ont tranché la question :
1. **Par l'API** — impossible : pour un compte Express (`controller[requirement_collection]=stripe`),
   la plateforme ne peut ni accepter les CGU ni soumettre les justificatifs
   (« You cannot accept the Terms of Service on behalf of Express accounts », erreur vérifiée en
   isolant un `accounts.update`). Stripe réserve cela à son flux hébergé.
2. **Par le flux hébergé** — un pilotage heuristique de `connect.stripe.com` a été écrit et
   essayé : il est lent (~7 min/exécution, vraie API Stripe) et se bloque à l'étape téléphone
   (raccourci « numéro de test » puis « Envoyer » qui ne fait pas avancer de façon stable). Ces
   pages changent souvent : les inclure rendrait la recette lente et fragile.

**Décision d'ingénierie** : ne pas mettre le flux hébergé Stripe dans la suite. VOY-4 prouve le
contrat Yamba ; VOY-5 (complétion → « Voyageur actif » + email) et la branche « tableau de bord »
de VOY-7 sont documentées comme **manuelles en mode test**, avec la procédure exacte dans le
rapport.

## VOY-6 : un verrou déjà couvert au bon endroit

Refuser l'acceptation d'un deal par un Voyageur non finalisé (D31) exige une demande de réservation
en attente — le parcours de réservation du chapitre 5.12. Plutôt que de le reconstruire ici, on
constate que la règle est **testée unitairement** : `deal-lifecycle.service.ts` répond
`CARRIER_ONBOARDING_REQUIRED` (profil incomplet OU Stripe non prêt), couvert par
`deal-lifecycle.service.spec.ts`. La fiche est `⏭`, à rejouer de bout en bout avec 5.12.

## Tests

Aucun test unitaire ajouté. `apps/e2e` : le chapitre 5.6 porte le harnais à **76 scénarios**
(72 + WEB-VOY ×4, dont 3 `⏭`). Harnais : typecheck vert.


---

# Chapitre 5.7 du cahier 01-WEB : publier un trajet et son cycle de vie — le wizard éprouvé en édition, et un mapper inverse qui ne relisait que sa propre écriture

*(PR `chore/recette-web-5-7` (#272), 11/09/2026.)*

## Ce qui a été fait

Le septième chapitre « fiches » du cahier 01-WEB : `WEB-TRJ` (assistant de création en trois
étapes, gardes de publication, six statuts, actions permises, D72, masquage administratif).
Vingt et une fiches ; vingt jouées et conformes, une `⏭` (l'étape 1 passe par Google Places).
Une anomalie mineure trouvée et corrigée (`ANO-WEB-22`), une mineure ouverte (`ANO-WEB-23`).

```
apps/e2e/src/chapitres/web-trj.spec.ts                        NOUVEAU — 14 scénarios (13 joués + 1 ⏭), 1 min 36
apps/e2e/src/pages/mes-trajets.ts                             ligne visée par l'id du trajet ; menu « … » rouvert si la liste s'est re-rendue
apps/user-ui/src/components/trips/create/create-trip.reverse-mapper.ts   ANO-WEB-22 — dates dérivées de departureAt / arrivalAt
context/YAMBA-RECETTE-WEB-RESULTATS.md                        chapitre 5.7, ANO-WEB-22, ANO-WEB-23, écarts à trancher, pièges
```

## Le choix de méthode : exercer, pas re-prouver

La machine à états du trajet est déjà couverte par un test unitaire de cinq cents lignes
(`apps/trip-service/src/services/trip-state-machine.spec.ts`). Rejouer ses tables de vérité au
navigateur n'apporterait rien ; ce que la recette doit prouver, c'est que **le système entier**
respecte la machine : le contrôleur applique la transition, l'outbox part, la recherche publique
voit ou ne voit plus le trajet, l'écran lit `allowedActions` et ne décide rien. D'où la forme du
chapitre : des brouillons créés par l'API (`POST /trips` avec `publish:false`), les gestes tentés
(`/publish`, `/pause`, `/resume`, `/cancel`, `/restore`, `/archive`, `PUT`), les statuts et les
codes lus, la visibilité vérifiée par `GET /trips/search?from&to`.

Pour l'assistant lui-même, le verrou était l'étape 1 : l'itinéraire passe par l'autocomplétion
Google Places, hors périmètre du harnais (décision prise en 5.2, tenue en 5.6). L'astuce du
chapitre : **ouvrir le wizard en édition** (`/fr/trips/create?edit=<id>`) sur un brouillon créé
par l'API. Les villes sont rendues depuis le trajet, l'étape 1 est valide, « Continuer » ouvre
l'étape « Conditions » — et tout ce que le cahier demande aux étapes 2 et 3 (prix, curseurs,
gain, familles, forfaits, lieux, aperçu) se vérifie sur l'interface réelle. Trois brouillons
suffisent : le complet (11,50 €/kg, 23 kg, une famille surchargée, une refusée), un à 5 kg (les
forfaits grisés), un à 23 kg avec un forfait soute (l'équivalent au kilo). Un brouillon `TRAIN`
prouve que la carte « À la gare » existe.

## ANO-WEB-22 : le mapper inverse ne savait relire que ce que le mapper avait écrit

Première ouverture du wizard en édition sur un brouillon de l'API : « 4 champs à compléter »,
« Date requise » ×2, « Heure requise » ×2. Les dates sont pourtant en base. La cause tient en
quatre lignes de `create-trip.reverse-mapper.ts` :

```ts
departureDate: toDate(trip.departureDateLocal),
arrivalDate: toDate(trip.arrivalDateLocal),
departureTime: trip.departureTimeLocal ?? "",
arrivalTime: trip.arrivalTimeLocal ?? "",
```

`departureDateLocal` et `departureTimeLocal` sont des chaînes (« 2026-10-01 », « 14:00 ») que le
mapper d'écriture du wizard ajoute à côté de l'instant `departureAt` — pour ré-afficher
exactement ce qui a été tapé. Le mapper inverse ne lisait **que** ces chaînes : un trajet venu
d'un autre canal (l'API, le seed, un futur client mobile) n'en a pas, et son édition s'ouvrait
avec les dates vides. Enregistrer aurait renvoyé `departureAt: null`.

Le correctif est un repli, pas un remplacement — les chaînes locales gardent la priorité :

```ts
function localDateTimeParts(iso, timeZone): { date?: Date; time: string } {
  const instant = iso instanceof Date ? iso : new Date(iso);
  const options: Intl.DateTimeFormatOptions = { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false };
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-CA", { ...options, timeZone: timeZone ?? undefined }).formatToParts(instant);
  } catch {
    parts = new Intl.DateTimeFormat("en-CA", options).formatToParts(instant); // fuseau inconnu → navigateur
  }
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return { date: toDate(`${get("year")}-${get("month")}-${get("day")}`), time: `${hour}:${get("minute")}` };
}
// …
departureDate: toDate(trip.departureDateLocal) ?? departureFallback.date,
departureTime: trip.departureTimeLocal || departureFallback.time,
```

Trois détails qui comptent : `formatToParts` (pas `toLocaleString` + découpage de chaîne) donne
chaque composant sans dépendre du format d'une locale ; le fuseau vient du lieu
(`originTimezone`) quand il est connu et sinon du **navigateur** — c'est le fuseau que le mapper
d'écriture utilise, donc la même convention dans les deux sens ; un fuseau que le moteur ne
connaît pas (`RangeError`) retombe sur le navigateur au lieu de casser l'écran. `hour12:false`
peut rendre « 24 » à minuit selon les moteurs : normalisé en « 00 ».

Aucun test unitaire n'est ajouté (user-ui n'a pas de jest) ; la contre-épreuve est la fiche
WEB-TRJ-3…9 elle-même, qui ouvre un brouillon de l'API et exige l'absence de « Date requise ».

## ANO-WEB-23 : le fuseau du navigateur n'est pas celui du lieu

En lisant le mapper d'écriture pour ANO-WEB-22, une seconde chose apparaît : le wizard n'envoie
**aucun** fuseau. `toDateTimeIso(date, "14:00")` fait `setHours(14)` sur une `Date` du navigateur
et sérialise en ISO : « 14:00 » est 14 h dans le fuseau du poste du Voyageur, pas à Bruxelles ni
à Kinshasa. Les chaînes locales sauvent l'affichage (tout le monde voit « 14:00 »), mais
l'instant absolu — celui que lisent les crons d'expiration et de complétion et la garde « départ
passé » — est décalé dès que le lieu et le navigateur ne partagent pas le fuseau. Côté serveur,
`computeDenormalizedFields` retombe sur `Europe/Paris` faute d'`originTimezone`. La fiche
WEB-TRJ-2 est `⏭` (Google), l'anomalie est consignée ouverte avec une proposition : dériver le
fuseau des coordonnées **côté serveur** (`originLat/Lng` existent déjà ; une table hors-ligne,
aucun appel réseau), calculer `departureAt` dans ce fuseau, remplir `originTimezone` /
`destinationTimezone` que les mappers d'affichage consomment déjà. Décision produit, PR dédiée.

## Le harnais : trois pièges de rendu

1. **`innerText` rend le texte après CSS** : « Aperçu public » est `uppercase` → « APERÇU
   PUBLIC ». Les comparaisons sur `innerText` sont insensibles à la casse ; `getByText` lit le DOM.
2. **Une infobulle qui se ferme au défilement** (`window.addEventListener("scroll", close, true)`)
   contre un `click()` qui fait défiler avant de cliquer : `scrollIntoViewIfNeeded()` d'abord,
   puis `expect.poll` qui re-clique tant que `aria-expanded` n'est pas `true`, et le contenu lu par
   l'`id` que donne `aria-controls` (un `useId` React contient des « : », d'où `[id="…"]`).
3. **Un menu qui se ferme parce que la liste se re-rend** (TanStack Query rafraîchit « Mes
   trajets » après les mutations des fiches précédentes — le scénario passait seul, échouait dans
   la suite) : la page-objet réessaie l'ouverture jusqu'à voir « Annuler ». Et comme Thomas a
   trois trajets Paris → Brazzaville, la ligne se vise par l'`href` du lien (`…/dashboard/trips/<id>`).

## Tests

Plateforme inchangée (993 + auth 229). `apps/e2e` : le chapitre 5.7 porte le harnais à
**88 scénarios** listés par `playwright --list` (74 avant, + WEB-TRJ ×14 dont 1 `⏭`).
Typecheck user-ui (`tsc -p apps/user-ui/tsconfig.json`) et harnais verts.


---

# Chapitre 5.8 du cahier 01-WEB : justificatifs et billet vérifié — deux refus muets, et un `.env` de projet qui parlait à Gmail

*(PR `chore/recette-web-5-8` (#273), 11/09/2026.)*

## Ce qui a été fait

Le huitième chapitre « fiches » du cahier 01-WEB : `WEB-DOC` (dépôt de justificatifs sur un
trajet, cycle de vérification du billet, emails du back-office, badge public). Six fiches, six
jouées et conformes — deux après correction (`ANO-WEB-25`, `ANO-WEB-26`), une anomalie ouverte
(`ANO-WEB-24`, décision produit), et un piège de poste sérieux consigné au rapport.

```
apps/e2e/src/chapitres/web-doc.spec.ts                          NOUVEAU — 6 scénarios, ImageKit intercepté, admin SUPPORT par l'API, Mailpit
apps/user-ui/src/components/trips/create/TripDocumentsManager.tsx  ANO-WEB-26 (plus de reset() après l'envoi) + ANO-WEB-25 (limite dite)
apps/user-ui/src/components/trips/create/DocumentUpload.tsx        idem, prop `limitHint`
apps/user-ui/src/components/trips/create/steps/StepTrip.tsx        passe `copy.docLimitReached(5)`
apps/user-ui/src/components/trips/create/create-trip.copy.ts       clé `docLimitReached` (FR/EN) ; `create-trip.types.ts` la déclare
apps/trip-service/src/controllers/admin-trips.controller.ts        l'échec d'un email de billet / masquage est journalisé, plus avalé
context/YAMBA-RECETTE-WEB-RESULTATS.md                           chapitre 5.8, ANO-WEB-24/25/26, piège `.env` de projet
```

## Le dépôt sans écrire chez le tiers

Le front téléverse chez ImageKit (XHR vers `upload.imagekit.io/api/v1/files/upload`, jeton signé
par `GET /uploads/imagekit-auth`), puis envoie au trip-service les références rendues
(`POST /trips/:id/documents` : `type`, `fileId`, `url`, nom, type MIME, taille). Le harnais pose
`intercepterImageKit(page)` — la même interception que pour les photos de colis — et le reste de
la chaîne est réel : le hook refuse un mauvais type ou plus de 5 Mo **avant tout réseau**, le
serveur borne à 5 documents (`documents.maxDocsPerTrip`, D62) et 5 Mo (`documents.maxDocSizeMb`),
et fait passer `ticketVerificationStatus` de `NOT_SUBMITTED` / `REJECTED` à `PENDING` dès qu'un
`TICKET_PROOF` arrive. Un PDF minimal (en-tête, `xref`, `%%EOF`) suffit ; pour la borne de
taille, `Buffer.concat([pdf, Buffer.alloc(5 Mo + 1 − pdf.length)])`.

## ANO-WEB-26 : le refus existait, il n'était jamais affiché

`useImageKitUpload.validateFile` pose bien `{ code: "TOO_LARGE", message: "Le fichier dépasse
5 Mo." }`. Mais les deux composants de dépôt faisaient :

```ts
for (const file of filesToUpload) { const uploaded = await upload(file); … }
reset();                       // ← setError(null) : l'erreur posée par `upload` disparaît ici
if (inputRef.current) inputRef.current.value = "";
```

`reset()` du hook remet progression, `isUploading` **et l'erreur** à zéro. L'erreur de validation
était donc effacée dans le même tour que sa pose : l'utilisateur choisissait un fichier trop
lourd et rien ne se passait. Le correctif retire l'appel : le hook remet déjà l'erreur à `null` au
**début** de chaque `upload` et `isUploading` à faux dans son `finally`, il n'y a rien à
réinitialiser après coup. Même correction aux deux endroits (détail du trajet, wizard étape 1).

## ANO-WEB-25 : une limite qui se dit

À cinq documents, `canAddMore` passait à faux et la zone de dépôt disparaissait sans un mot. Un
paragraphe la remplace : `TripDocumentsManager` a la locale (`isFr`) et rend la phrase
directement ; `DocumentUpload` n'en a pas et reçoit une prop `limitHint`, alimentée par
`copy.docLimitReached(5)` depuis `StepTrip`. Le type `CreateTripCopy` déclare la clé — TypeScript
strict refuse une clé de copy non déclarée (`TS2353`), c'est voulu : le copy FR/EN reste
exhaustif par construction.

## Le piège : `apps/trip-service/.env`

DOC-4 et DOC-5 attendaient un email dans Mailpit et n'en recevaient aucun — alors que la revue
répondait 200 et que le statut changeait. Rien dans les journaux : `emailCarrier` faisait
`sendTransactionalEmail(...).catch(() => undefined)`. Par élimination : la bibliothèque envoie
bien en processus isolé (sonde `tsx --env-file=.env`), le fournisseur est « configuré » et
l'utilisateur trouvé (sondes temporaires)… puis `ps eww` sur le processus trip-service :
`SMTP_HOST=smtp.gmail…`, `SMTP_USER=…`. Un `apps/trip-service/.env` du 13 mai — gitignoré,
oublié — portait un SMTP Gmail réel et des clés ImageKit. Nx fusionne l'env racine et celui du
projet ; trip-service, et lui seul, envoyait ses emails par Gmail pendant que les autres services
parlaient à Mailpit. C'est exactement le piège consigné dans CLAUDE.md pour ImageKit (upload OK
depuis trip-service, suppression KO depuis auth-service), rejoué avec l'email.

Deux remèdes : le fichier est **déplacé hors du dépôt** (`~/.yamba-leftovers/`), et le `catch`
journalise (`console.error("[admin-trips] email « … » non envoyé à … :", message)`) — un
best-effort se lit, il ne se tait pas. Subtilité de poste : après le déplacement, `kill` du
service ne suffit pas, le processus parent `nx run-many` avait lu l'env du projet au démarrage et
le réinjectait à chaque redémarrage ; il faut relancer `nx run-many` (ou `nx serve` du service).

## Le back-office par l'API

`POST /admin/tickets/:documentId/review` (permission `tickets.review` : SUPPORT, MEDIATOR) prend
`{ decision: "VERIFY" | "REJECT", reason? }` — un rejet sans motif est refusé par le schéma Zod
(`ReviewTicketRequestSchema.refine`), les motifs sont fermés (`ILLEGIBLE`, `DATES_MISMATCH`,
`NAME_MISMATCH`, `SUSPICIOUS`) et traduits en clair dans l'email (`TICKET_REJECTION_LABELS`,
FR/EN, langue du DESTINATAIRE). La transaction met à jour le document (`updateMany … status:
PENDING` = verrou optimiste, `TICKET_ALREADY_REVIEWED` sinon), le trajet, et écrit le journal
d'audit (`recordAdminAction`, D54) ; l'email part après. `ADMIN_IS_OWNER` interdit d'examiner son
propre billet.

## Tests

Plateforme inchangée (993 + auth 229 ; `admin-trips.controller.spec` 6/6). `apps/e2e` : **94
scénarios** (`playwright --list` ; 88 + WEB-DOC ×6). Typecheck user-ui, trip-service et harnais
verts.


---

# Chapitre 5.9 du cahier 01-WEB : recherche, filtres, tri, état vide — la page qui tombait pour un avatar, et l'index unique qui n'était pas épars

*(PR `chore/recette-web-5-9` (#274), 11/09/2026.)*

## Ce qui a été fait

Le neuvième chapitre « fiches » du cahier 01-WEB : `WEB-RCH` (l'écran `/search`, les cartes et
leurs prix, le poids du colis, les tris, les familles, les filtres de confiance, les états vide
et d'erreur, la page publique, le compteur de vues, un trajet disparu, un compte suspendu).
Quinze fiches, quinze jouées et conformes — trois après correction d'une anomalie **bloquante**
(`ANO-WEB-27`) — et une seconde anomalie bloquante trouvée en posant la contre-épreuve
(`ANO-WEB-28`, ouverte, `test.fail`). Le rapport porte, pour la première fois, une section
« regard d'expert » par fiche (consigne du 11/09).

```
apps/e2e/src/chapitres/web-rch.spec.ts   NOUVEAU — 16 scénarios (15 fiches + ANO-WEB-27 ; ANO-WEB-28 en test.fail), 2 min 06
apps/user-ui/next.config.js              ANO-WEB-27 — images.remotePatterns : ik.imagekit.io, lh3.googleusercontent.com
context/YAMBA-RECETTE-WEB-RESULTATS.md   chapitre 5.9, ANO-WEB-27/28, à trancher, regard d'expert, pièges
```

## Viser une recherche sans piloter Google

La barre de recherche interroge Google Places pour les villes. Le chapitre 5.1 l'avait pilotée
(frappe touche par touche, origine `localhost` pour le référent) ; ici il y a douze recherches
différentes, et chaque frappe Google est lente et fragile. L'observation qui change tout : ce que
`/search` lit en arrivant, c'est le **brouillon persistant** de la barre —
`usePersistedFormState("trip-search")`, en `sessionStorage`, clé `yamba:form:trip-search`,
enveloppe `{ version: 2, data: { from, to, dateValue } }`, les dates sérialisées avec un
marqueur (`{ __yamba_date__: iso }`, rétablies en `Date` par un `reviver`). Le harnais pose ce
brouillon par `page.addInitScript` **avant** la navigation :

```ts
await page.addInitScript(({ cle, valeur }) => { window.sessionStorage.setItem(cle, valeur); },
  { cle: "yamba:form:trip-search", valeur: JSON.stringify({ version: 2, data }) });
await page.goto("/fr/search");
```

et l'écran cherche exactement ce qu'il aurait cherché après une saisie. Douze recherches en
deux minutes, sans une requête Google. Même principe pour le poids (`localStorage`,
`yamba.search.weightKg`).

Seconde règle : **rien n'est codé en dur**. L'ordre des cartes est comparé à l'ordre que rend
`GET /trips/search?sort=…`, les comptes des puces à `GET /trips/search/facets`, le prix pour
3 kg au `totalForWeight` de l'API (38,64) — la carte n'en montre que l'arrondi (« ≈ 39 € »).

## ANO-WEB-27 : un composant qui jette tue la page

Trois fiches échouaient sur trois symptômes différents (onglet introuvable, zéro carte après
« Tout effacer », zéro carte après « Réessayer »). Le point commun n'était pas dans les
sélecteurs mais dans la **console** : « Invalid src prop (https://ik.imagekit.io/…) on
`next/image`, hostname "ik.imagekit.io" is not configured under images ». `next/image` refuse
tout hôte distant absent de `images.remotePatterns` — et il refuse en **jetant**, donc la page
entière bascule sur l'error boundary (`app/[locale]/error.tsx`, « Cette page n'a pas pu
s'afficher »). Il suffisait qu'un Voyageur listé ait un avatar ; le seed n'en a aucun, le poste
en avait un.

Correctif : la section `images` de `next.config.js` (ImageKit + `lh3.googleusercontent.com`,
l'hôte des avatars Google, `payload.picture`). La config n'est pas rechargée à chaud : redémarrer
le front. Contre-épreuve durable : un scénario pose un avatar ImageKit **en base** sur Thomas
(référence seule, aucun téléversement — `jeuEssai.manoeuvre`), ouvre la recherche et la page
publique, exige l'absence de la page d'incident et d'erreur `next/image`, et retire l'avatar dans
un `finally`.

## ANO-WEB-28 : trouvée en posant la contre-épreuve

La manœuvre `image.create({ userId })` a répondu `P2002 … Image_carrierPageId_key`. Le modèle
`Image` sert deux relations 1-1 (`userId? @unique` pour l'avatar d'un membre, `carrierPageId?
@unique` pour celui d'une page Voyageur) : sur MongoDB, Prisma crée pour `@unique` un index
unique **non épars** (`listIndexes` : `unique: true`, aucun `sparse`), donc deux documents à
`carrierPageId: null` — deux avatars de membres — sont interdits. Vérifié par l'API réelle :
`POST /auth/me/avatar` pour Joséphine, pendant qu'un autre compte a un avatar → **500**. Un seul
membre de la plateforme peut avoir un avatar ; c'est le piège « nullable unique fields collide on
null » de CLAUDE.md, jamais payé ici parce que 5.5 n'avait pas joué le téléversement réel.

Prisma ne sait pas déclarer un index épars ou partiel sur Mongo. La voie propre est de scinder
`Image` en deux modèles 1-1 dont la clé est **requise** (`UserAvatar`, `CarrierAvatar`) — une
migration d'un document, deux écrivains et les lecteurs à ajuster : candidat au registre, PR
dédiée. La fiche est en `test.fail` (elle attend 200) ; la contre-épreuve d'ANO-WEB-27 contourne
le piège en posant `carrierPageId` sur l'image de test.

## Le harnais : ce qui a coûté

- **Deux arbres** : chaque carte, chaque panneau de filtres existe deux fois (mobile masqué par
  CSS, desktop). `first()` tombe sur la copie `hidden` → `.filter({ visible: true })` partout.
- **Le tri par défaut** : cliquer « Départ le plus tôt » en premier ne déclenche rien.
- **Lire `pageerror` avant de corriger des sélecteurs** quand plusieurs fiches tombent sur une
  même page : un `test.only` de dix lignes qui imprime la console a donné la cause en quinze
  secondes.

## Tests

Plateforme inchangée (993 + auth 229). `apps/e2e` : **110 scénarios** (`playwright --list` ;
94 + WEB-RCH ×16, dont 1 `test.fail`). Typecheck harnais vert ; `next.config.js` est du
JavaScript (aucun typecheck), le front redémarré le sert.


---

# Chapitre 5.10 du cahier 01-WEB : alertes de route — l'effet d'une alerte prouvé par l'email, et le toast qu'un composant démonté ne peut plus afficher

*(PR `chore/recette-web-5-10` (#275), 11/09/2026.)*

## Ce qui a été fait

Le dixième chapitre « fiches » du cahier 01-WEB : `WEB-ALR` (création, gestion et EFFET des
alertes de route). Neuf fiches, neuf jouées et conformes, une après correction (`ANO-WEB-29`).

```
apps/e2e/src/chapitres/web-alr.spec.ts                 NOUVEAU — 9 scénarios en série, 1 min 45
apps/e2e/src/pages/recherche.ts                        NOUVEAU — « poser la recherche » (brouillon sessionStorage), partagé 5.9 / 5.10
apps/e2e/src/chapitres/web-rch.spec.ts                 importe la page-objet au lieu de ses aides locales
apps/user-ui/src/hooks/useSavedRouteMutations.ts       ANO-WEB-29 — `useDeleteSavedRoute({ onSuccess, onError })` : retours au niveau du hook
apps/user-ui/src/components/saved-routes/SavedRouteCard.tsx   les toasts de suppression passent par le hook
context/YAMBA-RECETTE-WEB-RESULTATS.md                 chapitre 5.10, ANO-WEB-29, à trancher, regard d'expert
```

## Prouver l'EFFET, pas seulement l'écran

Une alerte de route n'a de valeur que par l'email qu'elle déclenche. Le chapitre est donc bâti
autour de Mailpit : Aminata porte les alertes, Joséphine publie les trajets (par l'API du
trip-service, `publish: true`, coordonnées comprises), et chaque fiche dit ce que la boîte doit
contenir — ou ne pas contenir (`mailpit.aucunEmailPour(adresse, 10 s)` après un `vider()`).

Trois règles du serveur sont ainsi éprouvées telles qu'elles sont codées :

- **l'exclusion du Voyageur** — `baseWhere.userId = { not: trip.userId }` dans
  `dispatchTripPublishedNotifications` : Joséphine porte la même alerte que Aminata et ne reçoit
  rien ;
- **l'anti-spam de 24 h** — `lastNotifiedAt` filtré en JS (`NOTIFICATION_COOLDOWN_HOURS = 24`) :
  un second trajet dans la foulée ne produit aucun email ;
- **l'appariement à trois niveaux** (`saved-route-matching.helper.ts`) — placeId exact (100),
  ville + pays exacts (100), pays + haversine < 50 km (70, seulement si `includeNearby`) : Orly
  (≈ 15 km de Paris) ne déclenche rien sans l'option et déclenche avec ; Lille (≈ 204 km) jamais.
  Subtilité : le niveau 3 exige des coordonnées valides des DEUX côtés (alerte ET trajet), donc
  les corps d'API portent `originLat/Lng` et `destinationLat/Lng` — le seed n'en a pas.

Pour que l'anti-spam d'Aminata ne masque pas le troisième cas, Lille est testée sur une alerte
NEUVE (Pauline) : isoler la règle qu'on veut prouver de celle qui pourrait la cacher.

## Le formulaire sans Google

`CreateSavedRouteModal` choisit ses villes par `CityAutocomplete` (Google Places). Le harnais
éprouve le panneau (titres, quatre périodes dont « Personnalisé » qui révèle deux dates, deux
bascules `role="switch"` cochées avec leurs aides), le refus sans ville (le bouton « Créer
l'alerte » est `disabled` : aucune requête, même en forçant le clic), puis ferme le panneau et
crée l'alerte par `POST /saved-routes` avec exactement le corps que le formulaire enverrait
(`corpsAlerte()` : villes, pays ISO, coordonnées, `latestDate` = J+90 pour « 3 mois »,
`emailEnabled`, `includeNearby`). La carte, ses badges et le compteur sont ensuite lus à l'écran.

## ANO-WEB-29 : un callback qui meurt avec son composant

« Supprimer » puis « Confirmer » retirait la carte et décrémentait le compteur, mais le toast
« Alerte supprimée » ne venait jamais (deux exécutions). La cause est dans TanStack Query :

```ts
// SavedRouteCard — AVANT
deleteSavedRoute(savedRoute.id, { onSuccess: () => toast.success(t("deleteSuccess")) });
// useDeleteSavedRoute — la suppression est OPTIMISTE
onMutate: (id) => queryClient.setQueryData(["saved-routes", …], previous.filter((r) => r.id !== id)),
```

`onMutate` retire la carte de la liste avant la réponse → `SavedRouteCard` est démonté → son
observateur de mutation est détaché → les callbacks passés à `mutate(...)` (portés par
l'observateur) ne sont jamais appelés. Les callbacks déclarés dans `useMutation({ onSuccess })`,
eux, sont portés par la mutation et survivent au démontage. Correctif : le hook accepte ses
retours (`useDeleteSavedRoute({ onSuccess, onError })`) et les appelle depuis ses options ; la
carte lui passe ses toasts et appelle `deleteSavedRoute(id)` nu. « Prolonger » et « Email
activé » ne démontent pas la carte : leurs callbacks `mutate` restent valables.

## Tests

Plateforme inchangée (993 + auth 229). `apps/e2e` : **119 scénarios** (`playwright --list` ;
110 + WEB-ALR ×9). Typecheck user-ui et harnais verts.


---

# Chapitre 5.11 du cahier 01-WEB : favoris et Voyageurs suivis — une date que le client ne pouvait pas lire, un masquage que le favori ignorait, et le même toast perdu qu'en 5.10

*(PR `chore/recette-web-5-11` (#276), 11/09/2026.)*

## Ce qui a été fait

Le onzième chapitre « fiches » du cahier 01-WEB : `WEB-FAV` (le cœur, « Mes favoris », le suivi
d'un Voyageur et ses notifications). Douze fiches, douze jouées et conformes, trois après
correction (`ANO-WEB-30`, `31`, `32`).

```
apps/e2e/src/chapitres/web-fav.spec.ts                  NOUVEAU — 12 scénarios en série, 1 min 50
apps/e2e/src/chapitres/web-rch.spec.ts                  le cœur se vise DANS le lien de la carte
packages/libs/api-contracts/src/trip/trip-search.schema.ts   ANO-WEB-30 — `departureAt` (ISO) sur la carte de recherche
apps/*/openapi.json (×5)                                régénérés (registre de schémas partagé)
apps/trip-service/src/lib/trip-mappers.ts               renseigne `departureAt`
apps/user-ui/src/components/search/search-results.types.ts   le type front
apps/user-ui/src/components/favorites/FavoriteTripsList.tsx  badge « Trajet passé »
apps/user-ui/src/hooks/useFollowMutations.ts            ANO-WEB-31 — `useUnfollowUser({ onSuccess, onError })`
apps/user-ui/src/components/following/FollowedTripperCard.tsx   toasts via le hook
apps/trip-service/src/services/trip-favorite.service.ts ANO-WEB-32 — un trajet masqué par Yamba ne se met pas en favori
apps/trip-service/src/services/trip-favorite.service.spec.ts   +1 test (261)
```

## Le geste repris après connexion, prouvé de bout en bout

La porte d'identité du cœur (`AuthGateModal`, A63) monte un `LoginForm` dans la fenêtre et, à la
connexion, rappelle `onSignedInAction` — le bouton qui l'a ouverte rejoue `toggle.mutate({ tripId,
next: true })`. Le harnais le prouve sans rien supposer : un visiteur clique le cœur, remplit le
formulaire DE LA FENÊTRE (`form:has(#email)` visible — la page en monte d'autres, masqués), et
attend le `POST /trips/:id/favorite` qui part après la connexion ; l'URL reste `/fr/search`, le
cœur est `aria-pressed`, et `GET /trips/favorites` contient le trajet.

C'est là qu'un sélecteur a menti : le favori enregistré était `bzv-upcoming`, pas `bzv-perkg`.
Le cœur est rendu DANS le `<Link>` de la carte ; `carte.locator("xpath=..")` remontait au
conteneur de la liste et `.first()` prenait le premier cœur venu. `carte.getByRole("button")`
suffit — et la fiche 5.9 qui portait le même sélecteur (présence seulement) est corrigée avec.

## ANO-WEB-30 : une date formatée n'est pas une date

« Trajet passé » avait sa clé i18n et pas de rendu. La carte de recherche (`YambaTripResult`)
n'expose que `travelDate` (« 12 juin 2026 » / « June 12, 2026 ») : un client ne peut pas la
comparer à « maintenant » sans réinterpréter la chaîne selon la locale — l'erreur classique. Le
contrat gagne `departureAt` (ISO 8601, optionnel), le mapper le renseigne
(`new Date(trip.departureAt).toISOString()`), et `FavoriteTripsList` rend le badge quand
`new Date(item.departureAt) < new Date()`. Le schéma est dans le registre Zod partagé : les
cinq `openapi.json` bougent (`npm run generate:openapi`), la CI les diffe.

## ANO-WEB-32 : le masquage n'est pas un statut

Le masquage administratif (D57) laisse le trajet PUBLISHED — c'est ce qui le distingue de la
pause et préserve les réservations en cours — mais `addFavorite` ne testait que le statut.
`loadTripForFavorite` lit désormais `hiddenByAdminAt` et répond 409 `TRIP_NOT_FAVORITABLE`
(même code que « non publié », donc même message à l'écran : « Ce trajet n'est plus
disponible »). Le retrait reste idempotent et toujours possible. Un cas de test unitaire
(`hiddenByAdminAt: new Date()` → 409, aucun `upsert`) porte trip-service à 261.

## ANO-WEB-31 : troisième fois le même motif

Comme en 5.10 (`ANO-WEB-29`) : `useUnfollowUser.onMutate` retire la carte, la carte est démontée,
son callback `mutate(slug, { onSuccess })` n'est jamais appelé. Même correctif (retours au niveau
du hook). Ce motif est maintenant vu deux fois en deux chapitres : le regard d'expert demande une
revue de tous les `mutate(x, { onSuccess })` du front dont le hook a un `onMutate` qui retire
l'élément.

## Tests

trip-service **261** (+1, ANO-WEB-32) — plateforme **994** ; auth 229 inchangé. `apps/e2e` :
**131 scénarios** (119 + WEB-FAV ×12). Typecheck trip-service, user-ui et harnais verts ; OpenAPI
régénérés.


---

# Chapitre 5.12 du cahier 01-WEB : l'assistant de réservation — sept défauts sur l'écran cœur, tous des branchements

*(PR `chore/recette-web-5-12` (#277), 11/09/2026.)*

## Ce qui a été fait

Le douzième chapitre « fiches » du cahier 01-WEB : `WEB-RSV` (le tunnel de réservation en quatre
étapes et le devis). Vingt-deux fiches : vingt et une jouées et conformes (sept après correction),
une `⏭` (carte refusée : fournisseur FAKE). Sept anomalies closes (`ANO-WEB-33` à `39`).

```
apps/e2e/src/chapitres/web-rsv-devis.spec.ts                12 scénarios, 2 min 05 (complète web-rsv.spec.ts et web-rsv-assistant.spec.ts)
apps/user-ui/src/components/booking/booking.config.ts       ANO-WEB-33 (« Garantie Yamba », pas « assurance »)
apps/user-ui/src/components/booking/booking.copy.ts         ANO-WEB-33 (copy legacy)
apps/user-ui/src/components/booking/BookingWizard.tsx       ANO-WEB-34 (buildInitialDraft(trip))
apps/user-ui/src/components/booking/BookingMobile.tsx       ANO-WEB-34
apps/user-ui/src/app/[locale]/trips/[tripId]/book/BookingClient.tsx   ANO-WEB-35 / 38 (propre trajet, trajet parti : refus à l'ouverture)
apps/user-ui/src/components/booking/useBookingCheckout.ts   ANO-WEB-36 (trajet relu après QUOTE_DIVERGENCE)
apps/user-ui/src/components/booking/BookingSummarySidebar.tsx   ANO-WEB-37 (jamais « 0 € »)
apps/user-ui/src/components/booking/BookingBottomSheet.tsx  ANO-WEB-37
apps/user-ui/src/components/booking/steps/StepParcel.tsx    ANO-WEB-39 (photo > 10 Mo refusée à la sélection)
```

## Le devis au centime, contre la note de calcul

Le cahier donne la règle (`transport = max(€/kg × poids facturable × coefficient × (1 + supplément), 8 €)`,
`service = max(12 %, 3 €)`) et sept montants attendus. Le harnais les lit dans la colonne de droite
(« Total 32,20 € », le détail « × S · +20 % 34,50 € », « Minimum par colis appliqué : 8 € ») et sur
le bouton « Payer … » à l'étape 4 — tous exacts. Deux subtilités de lecture : les décimales nulles
tombent (« 8 € », « 42 € ») et les kilos s'écrivent avec un point (« 15.5 kg ») — consignés à
trancher, absorbés par le harnais (`eur()`, `[.,]`).

## Sept anomalies, une seule famille

Aucune règle de calcul n'était fausse ; les sept défauts sont des **branchements** :

1. **`buildInitialDraft(trip)` n'était appelée par personne** (ANO-WEB-34) : la fabrique du
   brouillon (poids 2 kg ou mémorisé, première famille acceptée, lieu unique pré-sélectionné)
   existait, testée nulle part, et les deux wizards partaient du brouillon vide. `useBookingDraft(useMemo(() => buildInitialDraft(trip), [trip]))`,
   la reprise `sessionStorage` gardant la priorité.
2. **Le récapitulatif rendait des zéros** quand le devis était indisponible (ANO-WEB-37) :
   `computeTotal` renvoie `{ transport: 0, …, quoteError }` et les deux composants affichaient les
   lignes avant l'indice. Quand `quote === null && quoteError`, l'indice seul.
3. **Le message « nouveau total affiché » mentait** (ANO-WEB-36) : le devis client se calcule sur
   le trajet en cache TanStack (`["public-trip", id]`) ; après `QUOTE_DIVERGENCE` on redemandait
   l'intention (bon montant) sans relire le trajet (ancien montant à l'écran).
   `invalidateQueries` avant `refreshIntent()`.
4. **Deux gardes serveur sans miroir à l'ouverture** (ANO-WEB-35, 38) : `checkTripBookable`
   refuse son propre trajet et un trajet parti — à l'intention de paiement. `BookingClient`
   applique les deux règles à l'ouverture (`user.id === trip.carrier.id`, `dates.departureAt`
   passé) avec les messages de l'étape 4. Le regard d'expert propose de servir `bookable: { ok,
   reason }` dans le DTO public pour ne pas dupliquer la règle.
5. **La borne de taille des photos se jouait au paiement** (ANO-WEB-39) : le hook la vérifie à
   l'envoi, et l'envoi part au clic « Payer ». `handleAddPhotos` filtre dès la sélection.
6. **Le mot « assurance »** (ANO-WEB-33) dans un message de validation et cinq chaînes mortes.

Leçon transversale (regard d'expert) : un test de composant sur le wizard avec un trajet fixture
aurait pris 1, 2 et 3 avant la recette.

## Le harnais

- Les deux Expéditeurs du « dernier kilo » (Aminata, João) sont menés chacun à l'étape 4 sur un
  trajet de Joséphine à **2 kg** ; A paie, B paie → `409 CAPACITY_EXCEEDED` et rien dans ses
  réservations (`GET /me/bookings`).
- Le devis divergent : Joséphine `PUT /trips/:id` (prix 15,00) pendant qu'Aminata est à l'étape 4.
- Les kilos restants se lisent dans le DTO **public** (`remainingKg`) : le DTO propriétaire répond
  403 à l'Expéditrice, et la valeur bouge à chaque tour (RSV-17 réserve 2,5 kg).
- ImageKit intercepté pour les photos ; Mailpit pour les deux emails (32,20 chez l'Expéditrice,
  28,75 chez le Voyageur, jamais l'inverse).

## Tests

Plateforme inchangée (994 + auth 229). `apps/e2e` : **143 scénarios** (131 + WEB-RSV ×12, dont
1 `⏭`). Typecheck user-ui et harnais verts.

---

# Chapitre 5.13 du cahier 01-WEB : les plafonds du compte neuf — le levier mesuré, l'écran qui ne se contredit plus

*(PR `chore/recette-web-5-13` (#278), 11/09/2026.)*

## Ce qui a été fait

Le treizième chapitre « fiches » du cahier 01-WEB : `WEB-TRU` (CNF-06 / D71 — les trois plafonds
d'un compte de moins de 30 jours sans trois envois terminés). Cinq fiches jouées et conformes (une
après correction), une anomalie mineure close (`ANO-WEB-40`, observée au chapitre 5.12 et réservée
à celui-ci).

```
apps/e2e/src/chapitres/web-tru.spec.ts                      5 scénarios en série, 2 min 00
apps/user-ui/src/components/booking/BookingWizard.tsx       ANO-WEB-40 (« Payer » grisé sans autorisation)
apps/user-ui/src/components/booking/BookingMobile.tsx       ANO-WEB-40
```

## Ce que le chapitre ajoute au parcours WEB-E2E-4

Le parcours prouvait les refus (450 €, 12 kg, la sixième) ; le chapitre prouve aussi **ce qui passe
juste sous le plafond** (250 €, 8 kg), le **compte ancien** sans plafond (Aminata, 12 kg à 450 €,
DTO relu : `weightKg: 12`, `declaredValueCents: 45000`), et trois preuves nouvelles :

1. **Le levier du back-office** (`[TRU7]`). L'OPS du seed (`navigateurAdmin("exploitation")`) écrit
   `trust.newAccount.maxShipmentsPerMonth` 5 → 6 par `PATCH /admin/settings` (`changes`, `reason`
   ≥ 20, `expectedVersion`). Puis le harnais clique **« Réessayer »** sur la carte de paiement toutes
   les cinq secondes (`expect.poll` + `waitForResponse` sur `POST /deals/payment-intents`) jusqu'à ce
   que l'intention soit acceptée : **6 s** après l'écriture (journal `AdminAction` `SETTING_CHANGED`
   12:48:24,3 → `Booking.createdAt` 12:48:29,9), sous la contrainte « < 30 s » du lecteur de
   paramètres (cache mémoire, D62). La remise à 5 est dans un `finally`, avec un `expectedVersion`
   relu (le verrou a bougé), et la valeur est relue après.
2. **Les réponses brutes de l'API au membre** : `/auth/me`, `/me/bookings`, `/deals/:id` ne contiennent
   ni `trustScore`, ni `riskLevel`, ni `caps`, ni `capsReason` — le score est calculé à la lecture et
   jamais servi (D71 ②), la whitelist des DTO le garantit, le harnais le vérifie.
3. **Le suivi d'un envoi** et « Mes envois » rejoignent la liste des écrans fouillés (tableau de bord,
   profil, page publique) ; l'export de données passe par la porte sudo comme au chapitre 6.

## ANO-WEB-40 : un bouton qui contredit l'encadré

À l'étape 4, le bouton principal du récapitulatif (`BookingSummarySidebar` / `BookingBottomSheet`)
n'était grisé que pendant l'envoi (`isSubmitting`). Après un refus de plafond, la carte affichait
l'encadré et « Réessayer » — et le bouton « Payer 32,20 € » restait actif à côté (sans danger : le
serveur refuse aussi la demande, et `submit` sort si `!intent` — mais l'écran se contredisait). Même
cause pour le « clic muet » avant le retour de l'intention (piège 18 du handoff). Une seule règle,
dans les deux wizards :

```ts
// ANO-WEB-40 (D71) : à l'étape 4, « Payer » attend l'autorisation de paiement — et reste grisé
// quand elle a été refusée (plafond du compte neuf) : le bouton ne contredit plus l'encadré.
const ctaDisabled = isSubmitting || (step === 4 && !checkout.intent);
```

Le page object `tenterDeReserver` n'a pas bougé : il lisait déjà le texte du mode test avant de
cliquer (Playwright attend un bouton actif), et la contre-épreuve est `toBeDisabled()` sur le bouton
**visible** (`getByRole("button", { name: /^Payer/ }).filter({ visible: true })` — la feuille mobile
est aussi dans le DOM sur écran large).

## Le harnais

- Mode **série** : la fiche 1 crée le compte par l'écran d'inscription (`Inscription.creer`, code
  Mailpit) et le garde en module ; chaque fiche suivante ouvre un navigateur neuf et se connecte par
  l'écran (`connexion`), le compte n'étant pas du seed.
- Les demandes sont réparties sur `bzv-perkg`, `fih`, `gru`, `yul`, `bzv-upcoming` (capacités
  restantes lues dans le seed : `gru` n'a que 7 kg libres) ; Aminata prend 12 kg sur `bzv-perkg`
  après les 4 kg du compte neuf.
- `mesReservations` (`GET /me/bookings`) compte avant et après chaque tentative : un refus qui
  aurait laissé une trace se verrait.
- Attention : `--reporter=list` sur la ligne de commande **remplace** le rapport HTML du
  `playwright.config.ts` ; les annotations ne sont alors écrites nulle part.

## Tests

Plateforme inchangée (994 + auth 229). `apps/e2e` : **148 scénarios** (143 + WEB-TRU ×5). Typecheck
user-ui et harnais verts.

---

# Chapitre 5.14 du cahier 01-WEB : la demande côté Voyageur — deux données servies par l'API que le front ne lisait pas

*(PR `chore/recette-web-5-14` (#279), 11/09/2026.)*

## Ce qui a été fait

Le quatorzième chapitre « fiches » du cahier 01-WEB : `WEB-DEA` (accepter, refuser, expirer, deux
onglets, états fermés, « Mon Deal accepté »). Neuf fiches jouées et conformes (trois après correction),
trois anomalies closes (`ANO-WEB-41` MAJEURE, `ANO-WEB-42` mineure, `ANO-WEB-44` MAJEURE), une ouverte
(`ANO-WEB-43`, DTO à enrichir).

```
apps/e2e/src/chapitres/web-dea.spec.ts                          9 scénarios en série, 2 min 20
apps/user-ui/src/components/trips/list/trip-local-dates.ts     ANO-WEB-41 (dates locales dérivées de departureAt, pure)
apps/user-ui/src/hooks/useTrip.ts                               ANO-WEB-41 (useMyTrips / useTrip normalisent à la lecture)
apps/user-ui/src/components/trips/list/my-trips.config.ts       ANO-WEB-41 (TripListItem : departureAt, arrivalAt, fuseaux)
apps/user-ui/src/components/carrier/deal/deal.adapter.ts        ANO-WEB-42 (un lieu, une ligne) + ANO-WEB-44 (recipientFirstName)
apps/user-ui/src/components/carrier/deal/deal.types.ts          ANO-WEB-44
apps/user-ui/src/components/carrier/deal/views/accepted/*.tsx   ANO-WEB-44 (Desktop, Mobile), ANO-WEB-42 (Recap : ville non répétée)
apps/user-ui/src/components/carrier/deal/views/settled/DealSettledView.tsx   ANO-WEB-44
```

## ANO-WEB-41 : le tableau de bord ne connaissait que les dates du wizard

`TripListItem` (accueil, « Mes trajets », badge de navigation, fiche du trajet) ne portait que
`departureDateLocal` / `departureTimeLocal` — des chaînes que SEUL le wizard de création écrit. Un
trajet créé par l'API, le seed ou un futur client mobile n'en a pas : l'adapter des actions repliait
sur `new Date(0)` (« jeu. 1 janv. » partout), `isTripPastDeparture(null)` répondait « pas parti » (un
trajet parti depuis six jours dans « à venir »), le tri par date était faux. Même famille qu'ANO-WEB-22
(le wizard en édition), côté lecture cette fois.

Le remède est UNE fonction pure appliquée UNE fois, à la source :

```ts
// apps/user-ui/src/components/trips/list/trip-local-dates.ts
export function withLocalDates<T extends TripDatesLike>(trip: T): T {
  const dep = localDateTime(trip.departureAt, trip.originTimezone);      // « 2026-09-26 » / « 14:00 » dans le fuseau du lieu
  const arr = localDateTime(trip.arrivalAt, trip.destinationTimezone);   // repli : fuseau du navigateur (celui du mapper d'écriture)
  …
  return { ...trip, departureDateLocal: trip.departureDateLocal || dep?.date || …, … }; // le wizard garde la priorité
}
```

Branchée dans `useMyTrips` (`withLocalDatesInList(res.data)`) et `useTrip` (`withLocalDates(res.data.trip)`) :
les sept consommateurs des chaînes locales n'ont pas bougé et sont tous corrigés. `Intl.DateTimeFormat("en-CA")`
donne directement `AAAA-MM-JJ` ; un fuseau inconnu (`RangeError`) retombe sur le navigateur.

## ANO-WEB-44 : un « TODO Phase backend » devenu un prénom

« Mon Deal accepté » écrivait « Aminata le révèle à **Hall** quand tu confirmes le pickup » : le prénom
du destinataire était `deliveryLocation.name.split(" ")[0]` (« Hall d'arrivée · Brazzaville »). L'API
sert pourtant `recipient.firstName` dès la création — `recipientForCarrier` ne retient que le téléphone
avant le pickup — mais l'adapter n'exposait `recipient` qu'après le pickup (philosophie É4, qui ne
vaut que pour le téléphone). `DealDetail.recipientFirstName` est désormais toujours posé ; `recipient`
(avec téléphone) attend toujours le pickup : les vues « livrer » et « suivi » n'ont pas changé.

## ANO-WEB-42 : un lieu, une ligne

`toLocation` posait `name = details || city` ET `detail = details` : la même ligne deux fois sous
« REMISE DU COLIS », et la ligne de repli de la livraison (« Téléphone du destinataire communiqué à la
prise en charge »), qui ne s'affiche que sans `detail`, n'apparaissait jamais. `detail` n'est gardé
que s'il diffère de `name`. Même motif sur le récapitulatif accepté (« … · Brazzaville · Brazzaville ») :
la ville n'est ajoutée que si le lieu ne la porte pas.

## Le harnais

- Les demandes vivantes sont créées par l'assistant (2,5 kg S 150 € : 32,20 / 28,75), avec photos
  (ImageKit intercepté) pour la fiche 2 ; `bzv-pending` sert au refus, `gru-pending` à l'expiration
  (manœuvre `scripts/recette/deal-eligible.ts <id> -1500`, puis passe forcée `scripts/recette/expire.ts`),
  les trois deals clos du seed aux états fermés.
- **Deux onglets « sans recharger »** : TanStack Query relit le deal au retour du focus — l'onglet 2
  rejoue sa première lecture (`page.route` → `fulfill`) jusqu'au clic « Refuser le Deal », puis `unroute` :
  le 409 `TRANSITION_NOT_ALLOWED`, le toast et la relecture sont ceux du produit.
- La puce d'expiration : `expiresAt` reculé à +90 min → classe `red-*` et `role="alert"`, remis à +23 h.
- « Aucune pénalité » : le profil public de Thomas (`GET /users/seed-thomas/public`) est comparé
  octet pour octet avant et après le refus ; les kilos par le DTO propriétaire.
- Ce qu'un membre ne doit pas voir se lit aussi dans les DTO : ni `totalShipperCents` / `commissionCents`
  chez le Voyageur, ni `deliveryCode`.

## Tests

Plateforme inchangée (994 + auth 229). `apps/e2e` : **157 scénarios** (148 + WEB-DEA ×9). Typecheck
user-ui (`tsc -p apps/user-ui`, comme la CI) et harnais verts. Poste : la cible inférée `nx typecheck`
des deux fronts Next a disparu en cours de session (les services l'ont encore) — `npx tsc --noEmit -p
apps/user-ui/tsconfig.json` est l'équivalent exact de la CI.

---

# Chapitre 5.15 du cahier 01-WEB : la messagerie — une garde de sécurité contournable par un espace, et trois écrans qui parlaient anglais ou se taisaient

*(PR `chore/recette-web-5-15` (#280), 11/09/2026.)*

## Ce qui a été fait

Le quinzième chapitre « fiches » du cahier 01-WEB : `WEB-MSG` (le fil par deal, D61). Vingt-deux fiches
jouées et conformes (quatre après correction), quatre anomalies closes — `ANO-WEB-46` **BLOQUANTE**,
`ANO-WEB-47` MAJEURE, `ANO-WEB-45` et `ANO-WEB-48` mineures. Plateforme de tests : message-service
42 → **44** (996 au total).

```
apps/e2e/src/chapitres/web-msg.spec.ts                             21 scénarios en série (22 fiches), 3 min 24
apps/e2e/src/pages/fil-messagerie.ts                               accepterRendezVous : la dernière ligne « confirmé »
apps/message-service/src/lib/message-guard.rules.ts               ANO-WEB-46 (séparateurs entre chiffres retirés)
apps/message-service/src/lib/message-guard.rules.spec.ts          +1
apps/message-service/src/lib/meetup.rules.ts                      ANO-WEB-47 (une re-proposition prime)
apps/message-service/src/lib/meetup.rules.spec.ts                 +1
apps/message-service/src/services/conversation.service.ts         ANO-WEB-47 (accepter remplace le confirmé du même type)
apps/user-ui/src/components/dashboard/messages/ConversationThread.tsx   ANO-WEB-45 (code → texte), ANO-WEB-48 (isError)
apps/user-ui/src/components/dashboard/messages/MeetupPanel.tsx    ANO-WEB-45 (bornes traduites)
apps/user-ui/messages/{fr,en}/messaging.json                       clés errors.*
```

## ANO-WEB-46 : « Le code : 742 891 » passait

La garde du code de livraison (D43 / D61 4A) extrayait les groupes de six chiffres avec `\b\d{6}\b`
et les comparait au hash bcrypt du deal. Six chiffres collés étaient refusés ; un espace, un tiret ou
un point entre les chiffres — la façon la plus naturelle d'écrire un code — passait. L'invariant
« le code ne circule jamais par écrit » était rompu par la forme la plus courante.

```ts
// apps/message-service/src/lib/message-guard.rules.ts
const DIGIT_SEPARATOR = /(?<=\d)[\s.\-–_'’/]+(?=\d)/g;
export function sixDigitCandidates(text: string): string[] {
  const isolated = text.match(SIX_DIGITS) ?? [];
  const collapsed = text.replace(DIGIT_SEPARATOR, "").match(SIX_DIGITS) ?? [];   // « 742 891 » → « 742891 »
  return [...new Set([...isolated, ...collapsed])].slice(0, MAX_CODE_CANDIDATES); // trois bcrypt au plus
}
```

Un téléphone (« 06 12 34 56 78 » → dix chiffres) et une date (« 11 09 2026 » → huit) ne forment
toujours pas un groupe de six isolé : les coordonnées restent repérées, pas bloquées (D61 5A). La
leçon de revue : **un filtre de sécurité se teste avec ses contournements évidents** — la règle avait
ses tests, aucun n'essayait la forme aérée.

## ANO-WEB-47 : une re-proposition invisible

Le panneau de rendez-vous n'affiche que « le rendez-vous qui compte » (`nextMeetupOf`) et la règle
préférait TOUJOURS le prochain accepté. Après une confirmation, une nouvelle proposition (changer
l'heure ou le lieu) n'apparaissait chez personne : impossible de replanifier. Deux changements :

1. `nextMeetupOf` fait primer une proposition **plus récente que l'acceptation**
   (`createdAt > acceptedAt ?? createdAt`) — c'est une re-proposition, elle doit être acceptable ;
2. `acceptMeetup` annule les autres rendez-vous ACCEPTÉS du même type : **un seul confirmé par type**,
   l'ancre du numéro (`revealPhone`, `thread`) et la liste ne balancent plus entre deux.

Candidat registre : compléter D61 1A avec cette règle.

## ANO-WEB-45 : le `message` anglais de l'API sous la saisie

Le fil (`send`) et le panneau (`submit`) affichaient `err.response.data.message` — la phrase ANGLAISE
de l'API — au membre. Les deux lisent désormais `details.code` (A146 : le code atteint le client) et
traduisent : `DELIVERY_CODE_IN_MESSAGE`, `INVALID_MEETUP_SLOT` + `reason` (`TOO_SOON` / `TOO_FAR` /
`WINDOW_TOO_LONG`), `MEETUP_CHANGED`, `CONVERSATION_READ_ONLY` — clés `messaging.errors.*` en FR et EN,
repli sur les messages génériques existants. Un `grep "response?.data?.message"` dans le front est le
prochain geste utile.

## ANO-WEB-48 : « Chargement… » sans fin

`ConversationThread` ne rendait que `isLoading || !data` : un fil refusé (403 `NOT_A_PARTY`) ou
introuvable restait sur « Chargement… ». `isError` → « La conversation n'a pas pu être ouverte. »
(clé déjà présente). L'API, elle, refusait proprement sans rien révéler.

## Le harnais

- Deux navigateurs (Pauline, Thomas) sur `bzv-accepted` ; le fil est demandé à l'API
  (`FilMessagerie.identifiantDuFil`) ; la bulle de l'en-tête se lit AVANT d'ouvrir la messagerie
  (sur écran large le premier fil s'ouvre seul et se marque lu).
- La langue des réponses rapides suit le COMPTE (D44) : la fiche bascule par le sélecteur de
  l'en-tête (qui enregistre la préférence), puis revient en français.
- Les refus sont lus sur la réponse (`400` + code) ET sous la saisie (le texte traduit) ; « le
  message n'apparaît pas dans le fil » se prouve par l'absence de BULLE (`getByText` compte la
  valeur de la zone de saisie).
- Les coordonnées repérées se prouvent côté équipe : `GET /admin/conversations/by-deal/:id`
  (session SUPPORT) → `flaggedContact: true` sur les deux messages.
- Le numéro « à l'heure » : Pauline propose à +40 min, Thomas accepte (ANO-WEB-47 nécessaire),
  « Voir le numéro » → 200, ligne système unique même après rechargement.
- La relance : `scripts/recette/relance-eligible.ts <fil> SHIPPER` (dernier message vieilli d'une
  heure) puis `relance.ts` deux fois (`sent: 1` puis `sent: 0`) ; l'email est vérifié SANS le texte.
- La fenêtre de 14 jours : `completedAt` / `closedAt` reculés à J−15 par une manœuvre consignée.
- Le limiteur de la passerelle a répondu 429 après treize passages : passerelle relancée en bundle.

## Tests

message-service **44** (+2 : ANO-WEB-46, ANO-WEB-47) → plateforme **996** (+ auth 229). `apps/e2e` :
**178 scénarios** (157 + WEB-MSG ×21). Typecheck user-ui (`tsc -p apps/user-ui`), message-service et
harnais verts ; miroir i18n vert.

---

# Chapitre 5.16 du cahier 01-WEB : la prise en charge et le transit — de la copie écrite mais jamais branchée

*(PR `chore/recette-web-5-16` (#281), 11/09/2026.)*

## Ce qui a été fait

Le seizième chapitre « fiches » du cahier 01-WEB : `WEB-PIC` (l'écran de prise en charge, ses refus, la
confirmation, le refus du colis, l'écran de transit et ses jalons). Dix fiches jouées et conformes (cinq
après correction), cinq anomalies closes (`ANO-WEB-51` MAJEURE, `49`, `50`, `52`, `54` mineures), une
ouverte (`ANO-WEB-53`, instantané du trajet sans heure d'arrivée).

```
apps/e2e/src/chapitres/web-pic.spec.ts                                      8 scénarios en série (10 fiches), 1 min 48
apps/user-ui/src/lib/elision.ts                                             ANO-WEB-49 (« que Pauline » / « qu'Aminata »)
apps/user-ui/messages/{fr,en}/carrierDealPickup.json, carrierDealDeliver.json   ANO-WEB-49 ({queShipper}, {deShipper})
apps/user-ui/src/components/carrier/deal/views/pickup/PickupDeclaredCard.tsx, PickupChecklist.tsx, DealPickupDesktop.tsx   ANO-WEB-49
apps/user-ui/src/components/carrier/deal/views/deliver/DeliverInfoBox.tsx   ANO-WEB-49
apps/user-ui/src/components/carrier/deal/views/pickup/DealPickupDesktop.tsx, DealPickupMobile.tsx   ANO-WEB-50 (recipientFirstName), ANO-WEB-51 (blockingHint)
apps/user-ui/src/components/carrier/deal/views/pickup/PickupConfirmCard.tsx, PickupFooter.tsx      ANO-WEB-51 (l'indice sous le bouton inactif)
apps/user-ui/src/components/carrier/deal/views/pickup/DealPickupClient.tsx  ANO-WEB-52 (taille et format à la sélection)
apps/user-ui/src/components/booking/booking-tracker/shared/BookingTrackingLinkCard.tsx   ANO-WEB-54 (variable manquante)
```

## ANO-WEB-51 : un bouton gris et muet

Les deux textes « Coche les 5 points de vérification avant de confirmer » et « Ajoute au moins 1 photo
avant de confirmer » existaient dans `carrierDealPickup.json` (`validation.*`) ; aucun composant ne les
rendait. Le bouton était simplement `disabled`. `PickupConfirmCard` (écran large) connaît
`checkedCount` / `photoCount` et rend l'indice sous le bouton ; `PickupFooter` (mobile) reçoit un
`blockingHint` calculé par `DealPickupMobile`. Même famille que la carte « demandes en attente » de
l'accueil (5.14) : de la copie écrite, jamais branchée — un `grep` des clés JSON absentes du code est
un contrôle qui vaut la peine (voir regard d'expert).

## ANO-WEB-49 : l'élision n'est pas une affaire de message

« Ce qu''{shipperFirstName} a déclaré » est juste devant Aminata et faux devant Pauline. ICU ne sait pas
élider ; le composant le fait :

```ts
// apps/user-ui/src/lib/elision.ts
export function elider(mot: "de" | "que" | "le" | "la", nom: string): string {
  const elide = /^[aeiouyàâäéèêëîïôöùûüÿæœh]/i.test(nom.trim());   // voyelle ou h (muet par défaut)
  if (mot === "le" || mot === "la") return elide ? `l'${nom}` : `${mot} ${nom}`;
  return elide ? `${mot.slice(0, -1)}'${nom}` : `${mot} ${nom}`;   // « qu'Aminata », « que Pauline », « d'Aminata », « de Pauline »
}
```

Les cinq messages reçoivent `{queShipper}` / `{deShipper}` ; l'anglais garde ses variables (ICU ignore
les variables en trop). Le cahier a la même faute et est à corriger.

## ANO-WEB-52 : la borne de taille au bon moment

Comme ANO-WEB-39 sur l'assistant : les photos de prise en charge ne partent qu'à la confirmation, la
borne de 10 Mo ne se voyait donc qu'au clic « Confirmer ». `addPhoto` filtre taille (`PHOTO_MAX_SIZE_BYTES`)
et format (`PHOTO_MIME_TYPES`) à la sélection, avec les textes `errors.uploadTooLarge` /
`errors.uploadInvalidType` — « rien n'a été envoyé » redevient vrai au moment où l'utilisateur agit.

## ANO-WEB-50, ANO-WEB-54, ANO-WEB-53

- `split(" ")[0]` sur le lieu de livraison pour nommer le destinataire — le dernier survivant de la
  maquette (ANO-WEB-44 avait corrigé « Mon Deal accepté ») : `deal.recipientFirstName`.
- `t("subtitle")` sans `{recipientFirstName}` : next-intl rend alors le chemin de la clé
  (« bookingTracker.trackingLink.subtitle ») ; la variable est passée. En développement, faire échouer
  `onError` de next-intl rendrait ce défaut impossible à manquer.
- « arrivée prévue à — » : `BookingTripSnapshot` fige `departureAt` mais pas `arrivalAt` ; le DTO
  Expéditeur ne peut rien dériver. Évolution de schéma + contrat, PR dédiée (ANO-WEB-53 ouverte).

## Le harnais

- Les fiches 1 à 4 rejouent l'écran sans confirmer (points, photo, > 10 Mo, ImageKit abandonné par
  `page.route`) et prouvent « rien n'est enregistré » par l'absence d'appel `POST /pickup` ET le statut
  relu (`ACCEPTED`).
- La fiche 5 lit le code dans le suivi de Pauline (`SuiviExpediteur.lireLeCode`) et vérifie qu'il n'est
  ni dans l'email ni dans le texte de l'écran Voyageur.
- La fiche 6 lit le total payé dans le DTO de Marie-Claire (le DTO Voyageur ne le porte pas, 5.14) et le
  compare au `refundAmountCents` du refus ; kilos et profil public avant / après.
- Les fiches 8, 9, 10 sont un seul scénario à deux navigateurs : l'annulation dans les cinq secondes
  (aucune requête), puis les trois jalons, chacun observé côté Expéditrice (bannière, cloche, Mailpit).

## Tests

Plateforme inchangée (996 + auth 229). `apps/e2e` : **186 scénarios** (178 + WEB-PIC ×8). Typecheck
user-ui (`tsc -p apps/user-ui`) et harnais verts ; miroir i18n vert.

---

# Chapitre 5.17 du cahier 01-WEB : le code de livraison — le retour d'action qui n'existe que dans un état transitoire

*(PR `chore/recette-web-5-17` (#282), 11/09/2026.)*

## Ce qui a été fait

Le dix-septième chapitre « fiches » du cahier 01-WEB : `WEB-COD` (l'apparition du code, sa copie, son
partage, sa régénération et son plafond, ce que le Voyageur ne voit jamais, l'après-remise). Huit fiches
jouées et conformes (quatre après correction), cinq anomalies closes (`ANO-WEB-56` MAJEURE, `55`, `57`,
`58`, `59` mineures). Aucune correction côté service : le serveur était juste partout (code chez
l'Expéditrice seule, 409 `CODE_REGENERATION_LIMIT`, email sans le code).

```
apps/e2e/src/chapitres/web-cod.spec.ts                                            8 scénarios en série, 1 min 48
apps/user-ui/src/components/booking/booking-tracker/views/picked-up/BookingCodeCard.tsx     ANO-WEB-55 (toast + aria-label), 57 (compteur permanent), 58 (409 traduit), 59 (échec de copie)
apps/user-ui/src/components/booking/booking-tracker/views/picked-up/BookingShareCode.tsx    ANO-WEB-56 (wa.me/<numéro>, sms:<numéro>), 55 (toast), 59
apps/user-ui/src/components/booking/booking-tracker/views/in-transit/SenderCodeCard.tsx     ANO-WEB-56 (repartager), 57, 58
apps/user-ui/messages/{fr,en}/bookingTracker.json                                 `pickedUp.code.copyFailed` (ANO-WEB-59)
```

## ANO-WEB-56 : le numéro était là, le lien ne le prenait pas

`BookingShareCode` ouvrait `https://wa.me/?text=…` et `sms:?&body=…` : message pré-rempli, destinataire à
chercher. Or le DTO Expéditeur porte `recipient.phoneE164` depuis D69, et la carte du lien de suivi
(`BookingTrackingLinkCard`) construisait déjà `wa.me/<chiffres>` et `sms:<numéro>`. Les deux cartes du code
(phase pickup et phase voyage) font maintenant pareil :

```ts
// apps/user-ui/src/components/booking/booking-tracker/views/picked-up/BookingShareCode.tsx
const phone = booking.recipient.phoneE164 ?? "";
const whatsappTarget = phone.replace(/[^\d]/g, "");            // wa.me veut les chiffres, sans « + »
window.open(`https://wa.me/${whatsappTarget}?text=${encodeURIComponent(message)}`, "_blank");
window.location.href = `sms:${phone}?&body=${encodeURIComponent(message)}`;   // « ?& » : iOS et Android
```

Sans numéro, le lien reste ouvert : l'utilisatrice choisit le contact, comme avant.

## ANO-WEB-57 et ANO-WEB-58 : un compteur enfermé, une erreur traduite puis ignorée

Le compteur « {n} régénérations restantes » n'était rendu QUE dans la boîte de confirmation : après le
geste, plus de compteur ; après la cinquième, le bouton inactif n'ouvre plus la boîte, donc « Aucune
régénération restante » (la forme `=0` du message ICU) était inatteignable. Le compteur vit maintenant sous
l'avertissement de confidentialité, en permanence.

Le serveur refuse la sixième par un 409 `CODE_REGENERATION_LIMIT` ; `booking-tracker.api.ts` le
traduisait déjà en `BookingApiError.code` — et les cartes faisaient `catch {}` sans le lire :

```ts
} catch (e) {
  const plafond = e instanceof BookingApiError && e.code === "CODE_REGENERATION_LIMIT";
  toast.error(t(plafond ? "pickedUp.code.toastMaxReached" : "pickedUp.code.toastError"));
  if (plafond) setConfirmingRegen(false);
}
```

Le cas qui le déclenche est réel : un second onglet resté sur « 1 régénération restante ». Règle à
retenir : **un `details.code` traduit par la couche API doit avoir un lecteur dans la vue**, sinon la
traduction est du code mort.

## ANO-WEB-55 et ANO-WEB-59 : dire ce qui vient de se passer, et dire juste

« Code copié ! » existait au catalogue et n'était jamais rendu (seule l'icône changeait, l'`aria-label`
restait « Copier le code ») ; le message n'avait qu'un libellé de bouton. Les deux ont un toast, et
l'`aria-label` bascule. À l'échec (pas de `navigator.clipboard` hors contexte sécurisé — le LAN en http),
le bouton du code affichait « Erreur lors de la régénération. Réessaye. » — le `toastError` d'une autre
action — et celui du message se taisait : nouvelle clé `pickedUp.code.copyFailed`, FR et EN.

## Le harnais

- Le presse-papiers est observé en mémoire de page (`fixtures/presse-papiers.ts`) ; `window.open` est
  capturé par un `addInitScript` (`__ouverturesYamba`) et l'URL WhatsApp est relue avec `new URL()` —
  hôte, chemin (le numéro), paramètre `text`.
- `sms:` et `mailto:` ne sont pas cliqués (Messages / Mail du poste s'ouvriraient) : l'objet de l'email
  est lu au catalogue FR.
- La fiche 2 fouille neuf sources côté Voyageur (texte ET source HTML de trois pages, le fil, deux
  réponses d'API) ; la fiche 7 constate que la source porte tout le catalogue `bookingTracker` — l'assertion
  vise l'interface rendue et le chemin d'API, pas un libellé.
- La fiche 6 ouvre un second onglet avant la dernière régénération : c'est lui l'« essai forcé »
  (React ré-applique `disabled` à un bouton dé-grisé à la main).
- `waitForResponse` ignore le 401 : la session mémorisée expire, `api-client` rafraîchit et rejoue.
- Les toasts s'empilent cinq secondes : `.last()`.
- L'identifiant du deal est posé paresseusement (`dealPicked(jeuEssai)`) : chaque fiche reste jouable seule
  (`--grep`), le seed étant rejoué par `beforeAll`.

## Tests

Plateforme inchangée (996 + auth 229). `apps/e2e` : **194 scénarios** (186 + WEB-COD ×8). Typecheck
user-ui (`tsc -p apps/user-ui`) et harnais verts ; miroir i18n vert (nouvelle clé `copyFailed` FR / EN).

---

# Chapitre 5.18 du cahier 01-WEB : la remise du colis — l'étape optionnelle qui verrouillait le chemin, et l'erreur qui ne se libérait pas

*(PR `chore/recette-web-5-18` (#283), 12/09/2026.)*

## Ce qui a été fait

Le dix-huitième chapitre « fiches » du cahier 01-WEB : `WEB-REM` (l'écran de saisie du code, le barème
d'essais, le verrou, sa levée par une régénération, la photo facultative, la livraison, l'absence
d'annulation). Sept fiches jouées et conformes (deux après correction), deux anomalies closes
(`ANO-WEB-60` MAJEURE, `ANO-WEB-61` mineure). Le serveur était juste partout (essais comptés côté serveur,
verrou qui survit au rechargement, bon code refusé sous verrou, régénération qui remet à zéro, notifications
et email de remise sans le code).

```
apps/e2e/src/chapitres/web-rem.spec.ts                                            7 scénarios en série, 55 s
apps/e2e/src/pages/suivi-expediteur.ts                                            `regenerer()` (partagé 5.17 / 5.18), `lireLeCode()` sur les deux formes de carte
apps/user-ui/src/components/carrier/deal/views/tracking/TrackingSpotlight.tsx     ANO-WEB-60 (chemin direct vers la remise)
apps/user-ui/messages/{fr,en}/carrierDealTracking.json                            `spotlight.deliverEarly`
apps/user-ui/src/components/carrier/deal/views/deliver/DeliverOtpInput.tsx        ANO-WEB-61 (compteur rendu, erreur effacée à la ressaisie, effet rearmé par le compteur)
```

## ANO-WEB-60 : « Optionnel » ne doit pas verrouiller le chemin principal

La carte-projecteur du suivi de transit calcule le prochain geste (`getNextEvent`) : aéroport, décollage,
atterrissage, puis `DELIVER`. « Valider la livraison » n'existait que dans cette dernière variante. Les trois
jalons portent le badge « Optionnel » et l'API livre depuis `PICKED_UP` sans condition — mais l'interface,
elle, exigeait les trois clics. La variante « jalon optionnel » offre désormais le chemin direct sous le bouton
du jalon :

```tsx
// apps/user-ui/src/components/carrier/deal/views/tracking/TrackingSpotlight.tsx
<span>{t("spotlight.deliverEarly", { recipientFirstName })}</span>   // « Đức est déjà devant toi ? … »
<button type="button" onClick={onDeliverAction}>{t("spotlight.DELIVER.button")}</button>
```

Règle : un état qui masque l'action principale doit avoir une sortie explicite.

## ANO-WEB-61 : trois défauts dans une seule ligne d'état

`DeliverOtpInput` rendait, sous les cases, SOIT l'erreur, SOIT « Tentative n sur 3 ». Conséquences :
`otp.attemptsLeft` (« {n} tentatives restantes » / « Dernière tentative ») n'était jamais rendu ; l'erreur
restait pendant la ressaisie (« Tentative 2 sur 3 » ne revenait pas) ; et l'effet « secousse + cases vidées »
dépendait du texte de l'erreur — identique d'un essai à l'autre — donc muet au deuxième échec :

```ts
// avant : useEffect(() => { … }, [errorMessage]);   — même texte, pas de nouvel effet
useEffect(() => { … }, [errorMessage, attemptsUsed]); // le compteur signale l'échec, pas le texte
const [erreurMasquee, setErreurMasquee] = useState(false);          // effacée au premier chiffre ressaisi
const erreurVisible = !!errorMessage && !erreurMasquee;
```

La ligne d'état rend l'erreur + le compteur, ou « Tentative n sur 3 · n tentatives restantes ».

## Le harnais

- `tenter(page, code)` saisit chiffre par chiffre (`getByLabel("Chiffre n")`) et attend la réponse
  DÉFINITIVE du `POST /deliver` (le client rejoue après un 401 de session expirée) ; le statut et le corps
  sont relus (`DELIVERY_CODE_INVALID`, `DELIVERY_LOCKED`, `lockedUntil`).
- Le verrou de 15 minutes n'est jamais attendu : la fiche 4 le lève par une régénération côté Mai
  (`SuiviExpediteur.regenerer()`, désormais dans le page object et partagé avec 5.17). Le suivi de Mai est
  la forme « phase voyage » (un jalon confirmé) : `lireLeCode()` lit la carte monumentale (aria-label) ou la
  carte compacte (texte « 742 891 »), et `regenerer()` attend que le code affiché CHANGE (`expect.poll`) —
  la carte relit le serveur après le toast.
- « Un essai raté n'est pas un événement » se prouve par `GET /me/notifications` identique avant / après
  (le chemin exact — la fiche COD-2 utilisait `/notifications` derrière un `if (ok)`, corrigée).
- L'absence d'annulation vise la LIGNE du deal dans « Mes envois » (les autres envois gardent leur bouton)
  et double la preuve par l'API : 409 `TRANSITION_NOT_ALLOWED` (Expéditrice), 403 (Voyageur).

## Tests

Plateforme inchangée (996 + auth 229). `apps/e2e` : **201 scénarios** (194 + WEB-REM ×7). Typecheck
user-ui et harnais verts ; miroir i18n vert (`spotlight.deliverEarly` FR / EN).

---

# Chapitre 5.19 du cahier 01-WEB : confirmation, complétion et versement — les textes qui ne suivaient pas la donnée, et le bandeau orphelin

*(PR `chore/recette-web-5-19` (#284), 12/09/2026.)*

## Ce qui a été fait

Le dix-neuvième chapitre « fiches » du cahier 01-WEB : `WEB-CNF` (la période de vérification, la
confirmation anticipée, le rappel de la veille, la complétion automatique, l'après-J+4, l'étanchéité de
l'état du versement côté Expéditeur, les trois états du versement côté Voyageur, le portefeuille, les
paiements, le bloc « TON PAIEMENT »). Onze fiches jouées et conformes (quatre après correction, une avec
réserve), six anomalies : quatre closes (`ANO-WEB-66` MAJEURE, `ANO-WEB-64`, `65`, `67` mineures) et deux
ouvertes qui touchent le contrat et la machine (`ANO-WEB-62` MAJEURE, `ANO-WEB-63` mineure) — proposées au
registre, jamais tranchées dans un contrôleur.

```
apps/e2e/src/chapitres/web-cnf.spec.ts                                            13 scénarios en série (11 fiches + 2 `test.fail`), 2 min 54
apps/e2e/src/pages/mes-trajets.ts                                                 `ligneDuDeal()` déplie chaque trajet (« n colis ») jusqu'à la ligne
scripts/recette/livraison-ancienne.ts                                             recule `deliveredAt` ET `payoutDueAt` (rappel, après-J+4, cron)
scripts/recette/versement-bloque.ts                                               refige FAILED / ACCOUNT_NOT_READY, rejeu repoussé d'un jour
apps/user-ui/src/components/trips/list/MyTripsList.tsx                            ANO-WEB-66 (le bandeau des versements bloqués sur la vraie page)
apps/user-ui/src/components/dashboard/trips/TripsClient.tsx                       ANO-WEB-66 (page pleine aussi, pas seulement la page vide)
apps/user-ui/src/components/booking/booking-tracker/views/delivered/DeliveredSideCards.tsx   ANO-WEB-64 (note du paiement selon `completedBy`)
apps/user-ui/src/components/rating/RatingStatusCard.tsx                           ANO-WEB-65 (invitation sans échéance)
apps/user-ui/messages/{fr,en}/bookingTracker.json · rating.json                   `delivered.payment.noteReleasedAuto`, `status.promptTextNoDate`
apps/deal-service/src/services/wallet.service.ts (+ .spec)                         ANO-WEB-67 (date de remboursement, repli sur `updatedAt`) — deal 577
packages/libs/prisma/scripts/seed-deals.ts                                        `ratingWindowEndsAt` sur les deals -blocked / -reversed
```

## Deux crons forcés, sur le fournisseur FAKE

Le chapitre dépend de `payout-bookings` (passes `reminder` et `due`, toutes les 5 minutes). Le harnais ne
les attend jamais : `scripts/recette/payout.ts <passe>` appelle directement le service de règlement, avec
l'environnement du processus qui l'emporte sur le `.env` (`STRIPE_SECRET_KEY=""` → FAKE, comme le bundle) :

```ts
// apps/e2e/src/chapitres/web-cnf.spec.ts
function scriptDeRecette(nom: string, ...args: string[]): string {
  const sortie = execFileSync("npx", ["tsx", "--env-file=.env", `scripts/recette/${nom}.ts`, ...args], {
    cwd: RACINE, encoding: "utf-8", timeout: 120_000,
    env: { ...process.env, STRIPE_SECRET_KEY: "", FORCE_COLOR: "0", NO_COLOR: "1" },
  });
  return sortie.replace(/\[[0-9;]*m/g, ""); // Playwright pose FORCE_COLOR : « 0 » sortait « [33m0[39m »
}
```

La manœuvre de date recule `deliveredAt` ET `payoutDueAt` (le compte à rebours de l'écran est calculé dans
le navigateur à partir de `deliveredAt` : ne bouger que l'échéance ferait mentir l'écran). Le FAKE a un
effet de bord : le cron REJOUE le versement « bloqué » du seed et le fait partir — `versement-bloque.ts`
refige l'échec et repousse `payoutNextRetryAt` d'un jour, juste après le seed puis avant les fiches 6 / 7.

## ANO-WEB-66 : un bandeau posé dans le mauvais composant

`PayoutBlockedBanner` (A75) était rendu par `TripsClient` — et seulement dans sa branche « aucun trajet ».
Or `/dashboard/trips` rend `MyTripsList` (`components/trips/list/`), qui ne le posait pas. Un Voyageur au
versement bloqué (le cas nominal : il A des trajets) ne voyait jamais « {montant} en attente : finalise ton
compte Stripe ». Le bandeau est posé par la page réelle, avant « À traiter », et sur la page pleine de
`TripsClient`. Leçon : un composant transversal se pose au niveau de la page, et deux listes de trajets pour
une même route sont une dette (`TripsClient` ne sert plus que la prévisualisation et la section du tableau
de bord).

## ANO-WEB-64, 65, 67 : trois textes qui ne suivaient pas la donnée

- **64** — `DeliveredPaymentCard` (réutilisée par la vue « terminé ») disait « Tu as confirmé la livraison »
  à tout deal clos, même clos par le SYSTÈME (« sans signalement de ta part » deux cartes plus haut). La
  note suit `booking.completedBy` : `noteReleased` (SHIPPER) ou `noteReleasedAuto` (le reste).
- **65** — `RatingStatusCard` rendait `promptText` avec `date: ""` quand `windowEndsAt` était `null` :
  « Tu as jusqu'au . ». Sans date, `promptTextNoDate`. La cause de la donnée absente est dans le seed (les
  deals `-blocked` / `-reversed` n'écrivaient pas `ratingWindowEndsAt`) — corrigé aussi, mais le composant
  ne doit jamais dépendre d'un seed.
- **67** — `wallet.service` rendait `date: iso(b.refundedAt)` pour REFUNDED / PARTIALLY_REFUNDED ; sans
  `refundedAt` la ligne disait « Remboursé 33,60 € le ». Repli sur `updatedAt` (comme RELEASED_NO_CHARGE),
  un test qui pose `refundedAt: null`.

```ts
// apps/deal-service/src/services/wallet.service.ts
const refundDate = iso(b.refundedAt ?? b.updatedAt);
```

## Les deux anomalies ouvertes — au registre, pas dans le code

- **ANO-WEB-62** — la vue Expéditeur porte `payoutStatus` / `payoutSentAt` et `ConfirmDealResponse` rend
  `payoutStatus` ; le contrat le dit voulu (A68 « both roles read it »). Les écrans n'en montrent rien, mais
  la réponse brute sert `"payoutStatus":"FAILED"` à l'Expéditrice d'un deal au versement bloqué. Retirer
  ces champs de la vue Expéditeur est un changement de contrat (OpenAPI, D-next) : scénario 6 bis en
  `test.fail`, il passera au vert quand la décision sera prise et codée.
- **ANO-WEB-63** — la machine retire `dispute` après `payoutDueAt` (`beforePayoutDue`) mais pas
  `confirmEarly` ; « Confirmer la livraison » reste proposé jusqu'au passage du cron. La garde jumelle
  coûte trois lignes et un test de machine, mais une transition est une règle du registre : scénario 5 bis
  en `test.fail`.

## Le harnais

- L'ordre de jeu n'est pas celui du cahier : un seul deal livré par rôle. `bzv-delivered` sert la lecture
  (1, 11) puis la confirmation (2) ; `yul-delivered` sert le rappel (4, échéance dans 18 h), l'après-J+4
  (5, échéance passée de 2 h, joué tout de suite car le vrai cron passe dans les 5 minutes) puis la
  complétion (3, passe `due` forcée — et si le vrai cron a devancé, `expect.poll` sur `COMPLETED` suffit).
- Les preuves d'étanchéité (6, 7) lisent `body` (les pages de suivi n'ont pas de `<main>`) après avoir
  retiré la description du colis du seed, qui dit elle-même « compte Stripe incomplet ».
- Les totaux des cartes Finances sont comparés à `GET /me/wallet` (jamais recalculés) et chaque ligne servie
  est visée par son lien (`/bookings/<id>`, `/carrier/deals/<id>`) et confrontée à son état exact.
- Les notifications survivent au seed : « une seule fois » se compte par lien du deal. Les montants portent
  une espace fine insécable avant « € » (cloches, objets d'email) : `[\s  ]?€`.

## Tests

Plateforme **997** (deal 577, +1 ANO-WEB-67) + auth 229. `apps/e2e` : **214 scénarios** (201 + WEB-CNF ×13).
Typecheck user-ui, deal-service et harnais verts ; miroir i18n vert (`noteReleasedAuto`, `promptTextNoDate`
FR / EN).

---

# Chapitre 5.20 du cahier 01-WEB : les annulations — la transition sans route ni écran, l'instantané que le barème lit, et deux restes de maquette

*(PR `chore/recette-web-5-20` (#285), 12/09/2026.)*

## Ce qui a été fait

Le vingtième chapitre « fiches » du cahier 01-WEB : `WEB-ANN` (le barème ANN-01 en quatre moments, le montant
servi, l'annulation Voyageur, rien après la prise en charge, le suivi sans doublon, deux onglets). Neuf fiches
jouées, sept conformes (deux après correction, une avec réserve), une NON CONFORME (`ANO-WEB-68`, majeure,
ouverte : l'annulation par le Voyageur n'existe ni au service ni à l'écran), une réserve (`ANO-WEB-69`, la
retenue conservée dite « reversée »), deux anomalies closes (`ANO-WEB-70`, `ANO-WEB-71`).

```
apps/e2e/src/chapitres/web-ann.spec.ts                                            9 scénarios en série (1 `test.fail`), 3 min 18
apps/e2e/src/pages/mes-envois.ts                                                  toast « Envoi annulé. » avec ou sans remboursement
apps/user-ui/src/components/booking/booking-tracker/views/accepted/BookingAcceptedDesktop.tsx   ANO-WEB-70 (lien vers « Mes envois »)
apps/user-ui/src/components/carrier/deal/views/accepted/DealAcceptedDesktop.tsx   ANO-WEB-70 (lien vers « Mes trajets »)
apps/user-ui/src/components/dashboard/shipments/ShipmentsClient.tsx               ANO-WEB-71 (toast sans « remboursement » pour une demande en attente)
```

## Un deal fabriqué par l'API, en deux appels

Le chapitre a besoin de quatre deals acceptés et le seed n'en a que deux. Plutôt que l'assistant (une minute
par réservation), le harnais réserve par l'API : le premier `POST /deals/payment-intents` porte un total
délibérément faux, le serveur répond 409 `QUOTE_DIVERGENCE` avec `actualTotalCents` (D17), le second porte le
vrai total, puis `POST /deals` (FAKE : `clientSecret` null) et `POST /deals/:id/accept` par le Voyageur :

```ts
// apps/e2e/src/chapitres/web-ann.spec.ts
const sonde = await contexte.request.post(`${api()}/deals/payment-intents`, { data: { ...devis, expectedTotalCents: 1 } });
const totalCents = ((await sonde.json()) as { details: { actualTotalCents: number } }).details.actualTotalCents;
```

## Le barème lit l'instantané du deal

`toCancellationPreview` et `cancel` calculent le remboursement à partir de `booking.trip.departureAt` — l'instantané
figé à la réservation, pas le trajet. Déplacer `trip.departureAt` (WEB-E2E-3) ne change rien à un deal déjà
créé : la manœuvre du chapitre déplace le trajet ET chaque deal (`data: { trip: { update: { departureAt } } }`
sur le composite). Conséquence produit, à trancher : un vol repoussé après l'acceptation ne déplace pas la
fenêtre des 48 h de l'Expéditrice.

## ANO-WEB-68 : trois couches en désaccord

La machine déclare `ACCEPTED --cancel(CARRIER)--> CANCELLED` (effets `FULL_REFUND`, `RELEASE_CAPACITY`,
`PENALIZE_CARRIER`, `NOTIFY_SHIPPER`) ; le service refuse tout autre acteur que l'Expéditeur (403
`SHIPPER_ONLY`) ; aucun écran Voyageur ne propose le geste — et le refus D72 (« annule-les d'abord depuis
« Mes trajets » ») renvoie vers une action qui n'existe pas. Le scénario 6 est en `test.fail` (il attend 200) ;
la correction est un chantier : branche CARRIER du service (remboursement intégral par le fournisseur, kilos,
`closedBy`, événement, emails), écran, tests, registre.

## ANO-WEB-70 et 71 : deux restes de maquette

- **70** — « Voir le Deal dans mon dashboard → » était un `<button onClick={() => console.info(…)}>` dans les
  deux vues « accepté » (Expéditeur, Voyageur) : `Link` de `@/i18n/navigation` vers `/dashboard/shipments` et
  `/dashboard/trips`.
- **71** — le toast choisissait « Remboursement de {montant} en cours » dès que la réponse portait
  `refundAmountCents` ; une demande en attente n'a jamais été débitée (D40 : l'empreinte est levée, Paiements dit
  « Jamais débité ») : le remboursement ne se dit que si `item.status !== "PENDING"`.

## Le harnais

- Les kilos restants se lisent par `GET /trips/:id` avec la session du VOYAGEUR (403 `NOT_TRIP_OWNER` sinon),
  avant et après chaque annulation.
- ANN-4 prouve « servi par le serveur » par l'absence : la liste est lue une fois (`cancellationPreview` dans
  `GET /me/bookings`), et l'ouverture de la fenêtre ne déclenche aucune requête `/deals` ni `/bookings`.
- ANN-3 refait l'arithmétique à partir des montants servis (`totalShipperCents`, `transportCents`) et
  confronte `payoutAmountCents` à `arrondi(retenue × net ÷ total)` ; l'exemple du cahier (32,20 / 28,75 →
  16,10 / 14,38) est vérifié par la même formule.
- ANN-9 fige `GET /me/bookings*` de l'onglet 2 (`page.route` avec la réponse lue), libère avant le clic, et
  prouve « aucun double remboursement » par `refundAmountCents` et les kilos.

## Tests

Plateforme inchangée (997 + auth 229). `apps/e2e` : **223 scénarios** (214 + WEB-ANN ×9). Typecheck user-ui et
harnais verts ; miroir i18n vert (aucune clé ajoutée).

---

# Chapitre 5.21 du cahier 01-WEB : litige et médiation, vue membre — la table de présentation en retard sur le catalogue, et les textes qui ignorent la cause de la clôture

*(PR `chore/recette-web-5-21` (#286), 12/09/2026.)*

## Ce qui a été fait

Le vingt-et-unième chapitre « fiches » du cahier 01-WEB : `WEB-LIT` (le signalement en transit, l'écran de
signalement, ses refus, l'envoi, le dossier vu des deux côtés, la version du Voyageur, les trois décisions du
back-office, la notation interdite, deux onglets, l'accès sans droit). Treize fiches jouées et conformes (trois
après correction), quatre anomalies : trois closes (`ANO-WEB-75` MAJEURE, `ANO-WEB-72`, `ANO-WEB-73` mineures) et une
ouverte au contrat (`ANO-WEB-74`, MAJEURE : le payload de notification aux deux rôles).

```
apps/e2e/src/chapitres/web-lit.spec.ts                                            14 scénarios en série (1 `test.fail`), 4 min 42
apps/user-ui/src/components/dashboard/notifications/notifications.types.ts        ANO-WEB-75 (quatre entrées de présentation)
apps/user-ui/src/components/booking/booking-tracker/views/status/BookingStatusNotice.tsx   ANO-WEB-73 (« Clos par la médiation »)
apps/user-ui/src/components/booking/booking-tracker/views/delivered/DeliveredSideCards.tsx  ANO-WEB-72 (note du paiement sur completedBy ADMIN)
apps/user-ui/messages/{fr,en}/bookingTracker.json                                 `statusNotice.cancelledByMediation.*`, `delivered.payment.noteReleasedMediation`
```

## ANO-WEB-75 : la porte du texte

La boîte de notifications ne rend le texte d'un événement (`copy.<type>.<rôle>.title`) que si son type a une entrée
dans `PRESENTATION` (`isKnownNotificationType`) ; sinon, le titre neutre « Notification ». Quatre événements avaient
leur texte et pas leur entrée : « Décision rendue · YAM-… » (la fiche 10 attend cette cloche), « Code de livraison
renouvelé », « Remboursement émis », « Paiement autorisé ». Les entrées sont ajoutées ; le regard d'expert propose
le test qui aligne les deux listes en CI (`Object.keys(copy)` ⊆ `PRESENTATION`).

## ANO-WEB-72 et 73 : deux textes qui ignoraient la cause de la clôture

- **73** — un remboursement total tranché par la médiation clôt le deal en `CANCELLED` (D55). `BookingStatusNotice`
  titrait donc « Demande annulée · Cette demande est close. Si un remboursement s'applique… Annulée le … » au-dessus
  de « Décision rendue » — sur un colis livré. Quand `dispute.resolution` (ou `retentionDecision`) existe, la
  clôture a son propre texte (`statusNotice.cancelledByMediation`).
- **72** — la note du bloc « TON PAIEMENT » suivait déjà `completedBy` (ANO-WEB-64) mais ne connaissait que
  SHIPPER / autre ; `ADMIN` recevait « la période de vérification est terminée — les fonds sont en cours de
  versement à … », faux après un rejet ou un partiel. Troisième variante : « Clos par la médiation — le sort des
  fonds est celui de la décision ci-dessus. »

## ANO-WEB-74 : un payload servi tel quel

`GET /me/notifications` renvoie, pour chaque notification, le payload de l'événement d'outbox. Pour
`booking.dispute_resolved`, il porte `refundCents` ET `carrierPayoutCents` ; l'Expéditrice lit donc le montant versé
au Voyageur, et réciproquement. L'écran n'affiche aucun montant (la ligne dit « lis la décision et le motif sur ton
envoi »), mais la règle « chaque partie voit uniquement le montant qui la concerne » vaut pour la réponse brute.
Correction proposée (contrat, registre) : une projection par rôle du payload à la lecture — liste blanche par
événement, comme `analyticsEventsFor` (D66) — jamais un spread. Scénario 10 bis en `test.fail`.

## Le harnais

- Une décision n'est possible qu'après la version du Voyageur (ou 72 h) : `POST /deals/:id/dispute/statement`
  (201) par l'API sur `los-disputed` (Adebayo) et sur le dossier de João (Thomas) avant de trancher ;
  `bzv-disputed` reçoit la version par l'écran (fiche 9).
- Les trois décisions passent par le back-office réel (`navigateurAdmin("mediateur")`, `MediationAdmin` :
  file → dossier → trancher) ; chaque partie est ensuite lue à l'écran (texte, montant, motif) puis par sa cloche
  (`a[href*=id]` + « Décision rendue · YAM-… ») et son email — Thomas en reçoit deux sur le même corridor, chacun
  visé par son ticket dans le corps.
- LIT-4 simule les trois cas réseau : ImageKit ralenti (route qui attend 4 s), ImageKit en échec (500), et un
  400 sur le `POST /dispute` (le serveur réel n'est jamais atteint avec un dossier incomplet : le bouton est
  inactif).
- LIT-13 prouve l'étanchéité par l'absence : aucune donnée du deal, aucun code HTTP ni JSON à l'écran, l'API à 403.

## Tests

Plateforme inchangée (997 + auth 229). `apps/e2e` : **237 scénarios** (223 + WEB-LIT ×14). Typecheck user-ui et
harnais verts ; miroir i18n vert (`cancelledByMediation`, `noteReleasedMediation` FR / EN).

---

# Chapitre 5.22 du cahier 01-WEB : la notation croisée — l'accueil réel en retard sur sa prévisualisation, deux états sans nom, et les avis qui survivaient au seed

*(PR `chore/recette-web-5-22` (#287), 12/09/2026.)*

## Ce qui a été fait

Le vingt-deuxième chapitre « fiches » du cahier 01-WEB : `WEB-NOT` (où noter, l'écran, les critères par rôle, la
note seule requise, la limite du commentaire, le double-aveugle, l'intermédiaire, une seule fois, les relances, la
révélation à 14 jours, l'avis public). Onze fiches jouées et conformes (trois après correction), trois anomalies
closes (`ANO-WEB-76` MAJEURE, `ANO-WEB-77`, `ANO-WEB-78` mineures) et une purge du jeu d'essai.

```
apps/e2e/src/chapitres/web-not.spec.ts                                            11 scénarios en série, 3 min 18
apps/user-ui/src/components/dashboard/home/HomeClient.tsx                         ANO-WEB-76 (les envois réels dans « À traiter »)
apps/user-ui/src/components/rating/RatingDone.tsx                                 ANO-WEB-77 (« indisponible » ≠ « fermée »)
apps/user-ui/src/components/users/profile/{TripperBlock,ShipperBlock}.tsx        ANO-WEB-78 (note d'un avis nommée)
apps/user-ui/messages/{fr,en}/rating.json                                         `done.unavailableTitle`
packages/libs/prisma/scripts/seed-deals.ts                                        purge des Review des comptes du seed
```

## ANO-WEB-76 : deux accueils, une seule logique

`HomeClient` a deux rendus : `HomePreview` (vitrine, données fictives) qui appelle `deriveHomeActions(shipments,
carrierTrips)`, et `HomeLive` (réel) qui ne lisait que `useMyTrips` + `useMyDeals` — les actions du VOYAGEUR
(répondre, prise en charge, livraison, noter) et les trajets en brouillon / en pause. Les envois de l'Expéditeur
n'étaient jamais lus : un Expéditeur pur lisait « Tout est à jour, rien à traiter. » avec un deal à noter, un code
à transmettre ou une livraison à vérifier. `HomeLive` lit désormais `getMyShipments` (TanStack, 30 s) et rend les
actions Expéditeur (`ShipmentRow` + chip de rôle, comme la vitrine) en tête de « À traiter ».

```tsx
// apps/user-ui/src/components/dashboard/home/HomeClient.tsx
const shipperActions = useMemo(
  () => deriveHomeActions(shipments ?? [], []).filter((a): a is Extract<HomeAction, { role: "SHIPPER" }> => a.role === "SHIPPER"),
  [shipments]
);
```

## ANO-WEB-77 et 78 : deux états sans nom

- **77** — `RatingDone` n'avait que trois branches (révélé / ma note existe / sinon « fermée »). Un deal en litige
  (fenêtre jamais ouverte, `windowEndsAt` null) tombait dans « La fenêtre de 14 jours est passée ». La branche
  « indisponible » (échéance absente ou future) rend `done.unavailableTitle` + `done.unavailable`.
- **78** — les cinq `<Star>` d'un avis public n'avaient ni texte ni nom : `role="img"` + `aria-label="{n}/5"` sur
  le groupe, `aria-hidden` sur les icônes — la même forme que `RatingStatusCard`.

## Les avis survivaient au seed

`seed-deals.ts` efface les bookings des comptes du seed mais pas leurs `Review` : chaque passage laissait des avis
révélés sur les profils publics (25 orphelins après une matinée), et « l'avis n'est pas public avant la
réciprocité » (NOT-6) échouait sur l'avis du passage précédent. Le seed purge les avis dont l'auteur OU le sujet est
un compte du seed, avant les bookings, et le journalise (« n avis »).

## Le harnais

- Le double-aveugle se joue en deux navigateurs (A Mai, B Thomas) : après la première note, la page publique du
  noté est lue par A (rien), `revealedAt` par l'API (null) ; après la seconde, l'écran de B dit la révélation et A
  relit « Vos avis » ; la cloche « Les notes sont révélées » est visée par le lien du deal ; l'absence d'email se
  prouve par `mailpit.compter` après un délai.
- Le cron `rating` se force en deux temps (`notation-eligible.ts` pose `completedAt` / `ratingWindowEndsAt` /
  `ratingRemindersSent`, `notation.ts` joue la passe) ; « une seule fois » = deux emails à Inês, zéro à João, et une
  troisième passe silencieuse.
- La page publique se lit dans un contexte neuf (`browser.newContext()`), la note par `[aria-label="5/5"]`, le
  signalement par le `mailto:` décodé (« Signalement d'un avis (#id) »).

## Tests

Plateforme inchangée (997 + auth 229). `apps/e2e` : **248 scénarios** (237 + WEB-NOT ×11). Typecheck user-ui et
harnais verts ; miroir i18n vert (`done.unavailableTitle` FR / EN).

---

# Chapitre 5.23 du cahier 01-WEB : la page destinataire — un chapitre sans anomalie, et comment prouver une absence

*(PR `chore/recette-web-5-23`, 12/09/2026.)*

## Ce qui a été fait

Le vingt-troisième chapitre « fiches » du cahier 01-WEB : `WEB-DES` (le lien de suivi, ses canaux, la page publique,
ce qu'elle ne montre jamais, sa progression, l'absence côté Voyageur et avant l'acceptation, le lien invalide, le
vrai numéro côté Voyageur). Neuf fiches jouées, neuf conformes, aucune anomalie — le contrat fermé de D69 tient.

```
apps/e2e/src/chapitres/web-des.spec.ts                                            9 scénarios en série, 2 min 24
```

## Prouver une absence

La moitié du chapitre affirme que quelque chose n'existe pas. Trois techniques :

- **Les valeurs, pas les symboles.** Le code source d'une page next-intl embarque tout le catalogue de messages :
  « € » y figure dans des textes génériques. Le harnais cherche les VALEURS du deal (le code `742891`, le numéro
  E.164 et local, le nom, le montant formaté), à l'écran ET dans `page.content()`.
- **La liste fermée.** `GET /track/:token` sert exactement huit clés (`CLES_PUBLIQUES_DU_SUIVI`) ; le test compare les
  clés triées, pas la présence de quelques-unes.
- **Le 404 uniforme.** Un jeton altéré et un jeton dont le destinataire a été effacé reçoivent le même corps de
  réponse ; l'écran, le même texte ; le bloc d'acquisition reste.

## Un canal qu'on ne peut pas cliquer

WhatsApp ouvre une fenêtre (`window.open`, capturé par `addInitScript`) ; le SMS assigne `window.location.href =
"sms:…"`, un schéma externe que le navigateur du poste ne journalise pas et que le harnais ne doit pas déclencher
(il ouvrirait Messages). La preuve passe par la donnée : le lien est (re)demandé par la page et sa réponse porte
`recipientPhoneE164`, le numéro que les DEUX canaux utilisent — comparé à celui de la réservation.

```ts
// apps/e2e/src/chapitres/web-des.spec.ts
const reponse = page.waitForResponse((r) => r.url().includes("/tracking-link") && r.request().method() === "POST");
await carte.getByRole("button", { name: "WhatsApp" }).click();
const lienServi = (await (await reponse).json()) as { path: string; recipientPhoneE164: string | null };
```

## Un jeton, une fois

« Le même lien est produit au second clic » se prouve à deux niveaux : dans la page, le second clic n'émet aucun
`POST /tracking-link` (la carte garde le lien en mémoire) ; après rechargement, un nouveau POST rend le même jeton
(le service réutilise le lien vivant du deal). L'effacement du destinataire (fiche 8) enchaîne la confirmation par
l'API, `destinataire-eligible.ts <id> 40` (deal clos il y a 40 jours) et `destinataire.ts` (la passe de rétention).

## Tests

Plateforme inchangée (997 + auth 229). `apps/e2e` : **257 scénarios** (248 + WEB-DES ×9). Typecheck harnais vert ;
aucune clé i18n ni code produit touché.

---

# Chapitre 5.24 du cahier 01-WEB : signaler un trajet, un profil, un message — la règle de visibilité dupliquée, et le 404 traduit à la hache

*(PR `chore/recette-web-5-24`, 12/09/2026.)*

## Ce qui a été fait

Le vingt-quatrième chapitre « fiches » du cahier 01-WEB : `WEB-SIG` (la porte d'identité, la fenêtre de signalement
d'une annonce, le doublon, soi-même, le profil, la cible invisible, trois signalements, l'avis). Huit fiches jouées et
conformes (deux après correction), deux anomalies closes (`ANO-WEB-79` MAJEURE, `ANO-WEB-80` mineure) et une purge du
jeu d'essai.

```
apps/e2e/src/chapitres/web-sig.spec.ts                                            8 scénarios en série, 2 min 54
apps/auth-service/src/services/report.service.ts (+ .spec)                         ANO-WEB-79 (annonce masquée = introuvable) — auth 230
apps/user-ui/src/components/shared/ReportDialog.tsx                               ANO-WEB-80 (404 → « introuvable »)
apps/user-ui/messages/{fr,en}/common.json                                         `report.notFound`
packages/libs/prisma/scripts/seed-deals.ts                                        purge des Report des comptes du seed
```

## ANO-WEB-79 : trois causes d'invisibilité, une seule connue

`resolveTarget` chargeait un trajet par `{ id, isDeleted: false }` : une annonce MASQUÉE par Yamba (`hiddenByAdminAt`,
C-PR4 — la recherche, la page publique et la réservation la connaissent déjà) restait signalable, `POST /reports`
répondait 201 et l'accusé partait — l'existence de la cible était révélée par le seul succès. Le service exige
désormais un champ null OU absent (pitfall Mongo : `null` ne voit pas un champ absent, d'où `OR isSet`) :

```ts
// apps/auth-service/src/services/report.service.ts
const trip = await db.trip.findFirst({
  where: { id: targetRef, isDeleted: false, OR: [{ hiddenByAdminAt: null }, { hiddenByAdminAt: { isSet: false } }] },
  select: { id: true, userId: true },
});
```

Le test unitaire pose un trajet masqué (404) et un trajet sans le champ (accepté). Le regard d'expert propose une règle
de visibilité unique, partagée par les trois services qui la réinventent.

## ANO-WEB-80 : traduire par le code, pas par le statut

`ReportDialog` mappait 409 → « déjà signalé », 400 → « ton propre contenu », le reste → « n'a pas pu être envoyé.
Réessaie. » Un 404 (cible disparue entre l'ouverture et l'envoi, ou masquée) invitait donc à réessayer. La branche
404 rend `report.notFound` ; la vraie correction (à trancher) est de mapper `details.code` — `OWN_TARGET` est un refus
de droit, pas une requête mal formée.

## Le harnais

- La porte d'identité se joue en fenêtre privée, puis la connexion DANS la fenêtre (le formulaire visible qui porte
  `#email`, comme en 5.11) ; on vérifie le 200 du `POST /auth/login`, la porte fermée et l'annonce toujours ouverte.
- « Le membre signalé n'apprend rien » se prouve sur les cloches NOUVELLES qui parlent de signalement ou de la cible
  (le cron FAKE écrit d'autres cloches au même compte pendant la fiche) et sur les emails par sujet.
- La cible invisible est fabriquée par l'API admin (`POST …/admin/trips/:id/hide`, contexte `navigateurAdmin`) et par
  une manœuvre (`profilePublic: false`), toutes deux défaites dans un `finally`.
- La file du back-office (« Prioritaire · 3 ouverts ») est lue par `GET /admin/reports?status=OPEN` avec un contexte
  SUPPORT : trois lignes sur la cible, `openCountOnTarget = 3`, `priority = true`.
- SIG-8 fabrique un avis révélé par l'API (`POST /deals/:id/rating` des deux côtés) et lit le `mailto:` décodé.

## Tests

Plateforme 997 + auth **230** (+1, ANO-WEB-79). `apps/e2e` : **265 scénarios** (257 + WEB-SIG ×8). Typecheck
auth-service, user-ui et harnais verts ; miroir i18n vert (`report.notFound` FR / EN).

---

# Chapitre 5.25 du cahier 01-WEB : données personnelles — la préférence lue au mauvais endroit, et l'en-tête que CORS cachait

*(PR `chore/recette-web-5-25` (#290), 12/09/2026.)*

## Ce qui a été fait

Le vingt-cinquième chapitre « fiches » du cahier 01-WEB : `WEB-RGP` (l'écran « Mes données », l'export derrière la
porte par code, son contenu, la règle des 24 h, les bloqueurs de suppression, l'avertissement, la suppression réelle,
« Membre supprimé », l'effacement du tiers destinataire). Neuf fiches jouées et conformes (cinq après correction),
cinq anomalies closes (`ANO-WEB-81` MAJEURE, `82`, `83`, `84`, `85`) et une purge de plus au jeu d'essai.

```
apps/e2e/src/chapitres/web-rgp.spec.ts                                            9 scénarios en série, 1 min 24
apps/user-ui/src/components/dashboard/sections/PrivacySection.tsx                 ANO-WEB-81 (bascule servie par le compte), ANO-WEB-84 (refus par son code)
apps/user-ui/src/hooks/useUser.ts                                                 les deux préférences dans le type `User`
apps/user-ui/src/app/[locale]/dashboard/dashboard.copy.ts                         `privacy.exportRateLimited`
apps/api-gateway/src/main.ts                                                      ANO-WEB-82 (`exposedHeaders: Content-Disposition`)
apps/message-service/src/lib/counterpart-label.ts (+ .spec)                        ANO-WEB-83 (« Membre supprimé ») — message 47
apps/message-service/src/services/conversation.service.ts                         le libellé dans les deux vues (liste, fil)
apps/user-ui/src/components/dashboard/messages/ConversationThread.tsx             ANO-WEB-85 (le refus de révélation est dit)
packages/libs/prisma/scripts/seed-deals.ts                                        purge du journal `DataRequest`
scripts/recette/otp-debloquer.ts                                                  lève le quota de codes (rejeu du chapitre dans l'heure)
```

## ANO-WEB-81 : une préférence a une seule source

La bascule « Mesure d'audience » n'était rendue que si le FRONT portait une clé PostHog, et son état venait de
`readConsent()` — le `localStorage` du navigateur. Or `analyticsOptIn` est une préférence **du compte** (servie par
`/auth/me`) qui gouverne aussi la capture **serveur** (D66, `analyticsEventsFor` n'émet que pour les consentants) :

- sur un déploiement où seul le serveur mesure, le membre n'avait aucun moyen de se retirer ;
- sur un second appareil, la bascule affichait « non » alors que le compte disait « oui ».

La ligne est désormais toujours rendue, son état vient du compte, l'écriture est confirmée (et revient en arrière si
le serveur refuse) ; seule l'initialisation du PostHog navigateur reste conditionnée à la clé.

## ANO-WEB-82 : ce que CORS ne donne pas

Le fichier se téléchargeait sous `yamba-mes-donnees.json` au lieu de `yamba-mes-donnees-2026-09-12.json`. Le serveur
posait pourtant le bon `Content-Disposition` : **le navigateur le cachait**. Une réponse cross-origin n'expose que six
en-têtes ; tout le reste doit être déclaré. La passerelle expose maintenant `Content-Disposition` et `x-correlation-id`.

```ts
// apps/api-gateway/src/main.ts
credentials: true,
exposedHeaders: ["Content-Disposition", "x-correlation-id"],
```

## ANO-WEB-83 : nommer, pas recomposer

L'effacement anonymise `firstName = "Membre"` / `lastName = "supprimé"`. La messagerie n'affiche que le prénom : le fil
disait « Membre », qui se lit comme un prénom ordinaire. Une règle pure nomme la contrepartie, et les deux vues
(liste et fil) l'utilisent :

```ts
// apps/message-service/src/lib/counterpart-label.ts
export function nomDeLaContrepartie(user: { firstName?: string | null; isDeleted?: boolean | null } | null | undefined): string {
  if (!user) return "—";
  if (user.isDeleted) return LIBELLE_MEMBRE_SUPPRIME; // « Membre supprimé », comme le back-office
  return user.firstName ?? "—";
}
```

## ANO-WEB-84 et 85 : un refus se dit

Le refus « un export par 24 h » arrivait en anglais (le `message` brut du serveur, affiché tel quel) : il se dit
maintenant par son `details.code` (A146). Et dans un fil, « Voir le numéro » refusé (400 `TOO_EARLY`) ne produisait
**rien** : le motif ne vivait que dans l'attribut `title` du bouton, le bandeau n'apparaissant qu'en arrivant par
« Appeler » (`?focus=phone`). Un refus affiche désormais la même phrase, en ligne.

## Le harnais

- La suppression réelle se joue sur un compte **créé par l'écran** dans la fiche 6, qui réserve par l'API, se fait
  accepter, écrit un message puis annule (remboursement intégral) : la fiche 7 le supprime, la fiche 8 lit son fil
  côté Thomas. Aucun compte du jeu d'essai n'est jamais supprimé.
- L'export du VOYAGEUR est obtenu par l'API (porte sudo + `POST /auth/me/data-export`) : c'est la seule façon de
  prouver « aucune coordonnée du destinataire quand le membre est le Voyageur ».
- Le quota de codes (6 par heure) est levé au démarrage du chapitre (`otp-debloquer.ts`) : sans cela, un rejeu dans
  l'heure n'envoie aucun code **et rien ne le dit à l'écran**.

## Tests

Plateforme **1000** (message 47, +3) + auth 230. `apps/e2e` : **274 scénarios** (265 + WEB-RGP ×9). Typecheck
user-ui, message-service, api-gateway et harnais verts ; miroir i18n vert.

---

# Chapitre 5.26 du cahier 01-WEB : préférences et langue — trois conventions qui n'allaient pas jusqu'au bout

*(PR `chore/recette-web-5-26`, 12/09/2026.)*

## Ce qui a été fait

Le vingt-sixième chapitre « fiches » du cahier 01-WEB : `WEB-PRF` (la bascule de langue qui écrit le compte, la langue
d'un email qui est celle de son destinataire, les emails sans compte qui suivent la langue de l'écran, la relance des
messages non lus qu'on peut couper, l'écran « Paramètres », une langue non prise en charge). Six fiches jouées et
conformes (trois après correction), trois anomalies closes (`ANO-WEB-87` MAJEURE, `86`, `88`).

```
apps/e2e/src/chapitres/web-prf.spec.ts                                            6 scénarios en série, 1 min 24
apps/user-ui/src/services/auth.api.ts                                             ANO-WEB-87 (`x-locale` sur le client des flux sans compte)
apps/user-ui/src/components/dashboard/sections/SettingsSection.tsx                 ANO-WEB-86 (l'écran « Paramètres » porte les vrais réglages)
apps/user-ui/src/components/dashboard/DashboardUI.tsx                             `ToggleRow` contrôlée + `role="switch"` ; `SettingRow` sans bouton décoratif
apps/user-ui/src/app/[locale]/dashboard/dashboard.copy.ts                         libellés des trois thèmes, vérité des deux lignes de notifications
apps/user-ui/src/app/[locale]/[...rest]/page.tsx                                  ANO-WEB-88 (route attrape-tout → `[locale]/not-found.tsx`)
docs/recette/RECETTE-01-WEB.md                                                    § 5.26 amendé (l'écran attendu n'est plus celui de la maquette)
```

## ANO-WEB-87 : un second client HTTP qui avait oublié une convention du premier

D44 dit que la langue d'un email est celle de son **destinataire**, et que les flux **sans compte** (il n'y a pas
encore de `User.preferredLocale` à lire) suivent la langue de la requête — portée par l'en-tête `x-locale` que le
front pose sur chaque appel. `apiClient` (axios, `withCredentials`, refresh automatique) le faisait. Mais les écrans
d'inscription, de mot de passe oublié et de renvoi de code n'utilisent pas `apiClient` : ils passent par `authApi`, un
second client axios créé pour ne pas déclencher la mécanique de refresh sur des routes publiques. Ce client, lui, ne
posait pas l'en-tête.

Deux conséquences, dont la seconde est durable :

1. l'email de code d'activation partait **toujours en français**, même pour une inscription menée entièrement en
   anglais ;
2. le compte naissait avec `preferredLocale: "fr"` — donc **tous** ses emails suivants aussi, jusqu'à ce que le membre
   trouve la bascule de langue.

```ts
// apps/user-ui/src/services/auth.api.ts
authApi.interceptors.request.use((config) => {
  const locale = getCurrentLocale();
  if (locale) config.headers.set("x-locale", locale);
  return config;
});
```

La correction est de trois lignes ; la leçon ne l'est pas. Deux clients HTTP, c'est deux endroits où une convention
doit être répétée — et une convention répétée est une convention qui se perd. `authApi` n'existe que pour éviter le
refresh : un simple `requireAuth: false` sur `apiClient` (l'option existe déjà) rendrait le second client inutile.
Consigné comme axe dans le rapport de recette.

## ANO-WEB-86 : un composant de maquette pris pour un composant de produit

L'écran « Paramètres » affichait quatre lignes. Deux portaient un bouton « Changer » — `SettingRow` accepte un
`onAction` **optionnel**, et personne ne le passait : le bouton était donc dessiné, cliquable, et sans effet. Les deux
autres étaient des `ToggleRow`, dont l'état vivait dans un `useState` **local au composant** :

```tsx
// avant — la bascule bougeait, et rien n'était enregistré
export function ToggleRow({ label, description, defaultOn = false }) {
  const [on, setOn] = useState(defaultOn);
  …
}
```

Un membre pouvait donc « couper ses notifications email », voir la bascule basculer, et recevoir ses emails comme
avant — l'état repartant à `defaultOn` au rechargement suivant. C'est exactement la classe d'anomalie d'`ANO-WEB-81`
(la bascule d'audience lue dans le navigateur), en pire : ici, il n'y avait aucune écriture du tout.

La correction pose une règle simple : **chaque réglage vit là où il a un effet**, et un contrôle qui n'écrit nulle
part n'existe pas.

| Ligne | Où vit le réglage | Pourquoi |
|---|---|---|
| Langue | le **compte** (`PATCH /auth/me/locale`) | c'est elle qui décide la langue des emails (D44) — le sélecteur de l'en-tête est réutilisé tel quel |
| Thème | le **navigateur** (next-themes) | préférence d'affichage, aucun effet serveur ; trois choix, dont l'« Automatique » que le libellé annonçait déjà |
| Notifications email | le **compte** (`messagingReminderEmails`, D61) | la seule préférence email qui existe ; le libellé dit aussi ce qu'elle ne couvre pas — les emails d'un Deal en cours sont contractuels |
| Notifications push | nulle part | rien n'est branché : la ligne informe, sans contrôle |

Et les deux composants partagés sont durcis pour que le défaut ne puisse pas revenir : `ToggleRow` est **contrôlée**
(`checked` + `onChangeAction`, avec `role="switch"` et `aria-checked` — elle n'était pas annonçable à un lecteur
d'écran), et `SettingRow` n'affiche son bouton que si un gestionnaire **et** un libellé existent ; sans eux, la ligne
est en lecture. Un « Changer » sans effet n'est plus exprimable.

## ANO-WEB-88 : une page d'erreur écrite mais jamais atteinte

`/es` n'est pas une langue prise en charge. Le middleware next-intl (`localePrefix: "always"`) réécrit l'adresse sous
une langue connue — `/fr/es` — ce qui est le bon comportement. Mais `/fr/es` ne correspond à **aucune route** : aucun
`page.tsx` n'est rendu, donc personne n'appelle `notFound()`, et Next sert son 404 **interne** :
« This page could not be found. » — en anglais quelle que soit la langue de l'URL, sans en-tête, sans pied de page et
sans un lien pour revenir au site.

La page introuvable du produit existait pourtant déjà (`[locale]/not-found.tsx`, soignée au chapitre 5.3 : elle
propose de chercher un trajet, d'en publier un, ou de rentrer à l'accueil). Elle n'était simplement jamais atteinte
pour ce cas. La façon documentée par next-intl de lui rendre la main est une route attrape-tout :

```tsx
// apps/user-ui/src/app/[locale]/[...rest]/page.tsx
import { notFound } from "next/navigation";
export default function PageInconnue() {
  notFound();
}
```

Les routes réelles, plus spécifiques, gagnent toujours contre un segment `[...rest]` : elle n'attrape que ce qui
n'existe pas. `/es` répond maintenant 404 avec la page du produit en français, `/en/es` la même traduite.

## Ce que le harnais a appris ici

- **Les préférences d'un compte survivent au seed** (`seed-deals.ts` recrée trajets et deals, pas les réglages) :
  Aminata arrivait avec sa relance déjà coupée par un passage précédent. Un chapitre qui éprouve des réglages **pose
  son état de départ** et le remet ensuite (`beforeAll` / `afterAll`). Ici, c'est même un outil : Aminata arrive avec
  la relance **coupée**, donc l'écran doit l'afficher coupée — ce qui prouve d'un coup que la bascule lit le serveur,
  et que le profil est chargé avant que la fiche ne touche aux contrôles.
- **Un seul processus pour toutes les préconditions** : trois `npx tsx --env-file=.env -e …` de suite dépassaient les
  60 s sur un poste qui recompile le front en même temps (`spawnSync npx ETIMEDOUT`).
- La bascule de langue de l'en-tête écrit le compte **en best-effort et seulement si le profil est chargé**
  (`if (user)`) : cliquer trop tôt navigue sans rien enregistrer. Le harnais attend donc un signal de chargement ; le
  rapport en fait un axe (rejouer l'écriture après le chargement).

## Tests

Aucun code de service touché : plateforme inchangée (**1000** + auth 230). `apps/e2e` : **280 scénarios**
(274 + WEB-PRF ×6). Typecheck user-ui et harnais verts ; aucune clé i18n ajoutée (les libellés de l'écran vivent dans
`dashboard.copy.ts`), miroir i18n donc inchangé.

---

# Chapitre 5.27 du cahier 01-WEB : la mesure d'audience — une bannière qui condamnait un bouton, et un corridor jamais mesuré

*(PR `chore/recette-web-5-27`, 12/09/2026.)*

## Ce qui a été fait

Le vingt-septième chapitre « fiches » du cahier 01-WEB : `WEB-ANA` (la bannière de consentement, ses deux issues, ce
qui part quand on accepte, la reprise du choix du compte sur un autre appareil, le retrait de l'accord, l'absence de
clé). Six fiches jouées et conformes (deux après correction) **plus une contre-épreuve**, deux anomalies closes
(`ANO-WEB-89`, `ANO-WEB-90`).

```
apps/e2e/src/chapitres/web-ana.spec.ts                                            7 scénarios, DEUX passes (avec clé / sans clé)
scripts/recette/collecteur-audience.ts                                            un faux PostHog local qui journalise ce qui part
apps/user-ui/src/components/layout/ConsentBanner.tsx                              ANO-WEB-89 (la bannière publie sa hauteur)
apps/user-ui/src/app/global.css                                                   `--yamba-consent-space`, `--yamba-viewport`
apps/user-ui/src/app/[locale]/layout.tsx                                          la place réservée en bas de page
apps/user-ui/src/app/[locale]/(marketing)/layout.tsx, dashboard/layout.tsx        `100vh` → `var(--yamba-viewport)`
apps/user-ui/src/components/auth/forms/*.tsx, auth/skeleton/*.tsx                 idem (onze écrans d'authentification)
apps/user-ui/src/hooks/useTripsSearch.ts                                          ANO-WEB-90 (`from` / `to`, pas `origin` / `destination`)
```

## Le montage : un faux PostHog, local, qui dit la vérité

Le cahier déclare ce chapitre `⏭` sans clé PostHog. S'en contenter aurait laissé sans preuve la promesse la plus
sensible du produit : « aucune donnée personnelle ne part à la mesure ». On a donc posé une clé de recette et un hôte
local dans `apps/user-ui/.env.local`, et écrit un **collecteur** :

```
npx tsx scripts/recette/collecteur-audience.ts --out <fichier> --clear
```

Il écoute sur `127.0.0.1:9977` et répond comme PostHog : `404` sur `/array/<clé>/config.js` (le SDK retombe alors sur
la variante JSON), une configuration minimale où tout ce qui capture de lui-même est coupé, des drapeaux vides, des
« extensions » inertes mais bien formées, et `{"status":1}` sur les points d'entrée d'événements — dont il écrit le
contenu, **une ligne de JSON par événement**, dans un fichier que la fiche relit. Le corps est décodé quelle que soit
sa forme (JSON nu, `data=` encodé en base64, gzip).

Pourquoi un vrai serveur plutôt qu'une interception Playwright ? Parce qu'un collecteur qui répond mal **casse le SDK
en silence** : sans configuration crédible — ou avec les extensions servies vides — la fin de `init()` échoue,
`capture()` est appelé et rien ne part. On aurait « prouvé » qu'aucune donnée ne fuit… en ayant cassé la mesure
soi-même. Mesuré, puis corrigé.

Deuxième piège, plus vicieux : **posthog-js refuse de capturer depuis un navigateur automatisé**. Dans le `dist` du
SDK (1.427.2) :

```js
var ol = function (t, i) { … return !!t.webdriver };   // _is_bot()
…
if (this.is_capturing()) { var c = !this.config.opt_out_useragent_filter && this._is_bot(); if (!c || …) { … } }
```

`navigator.webdriver` vaut `true` sous Playwright : `capture()` s'arrête là, sans un mot. Le harnais masque donc ce
**seul** drapeau (`Object.defineProperty(navigator, "webdriver", { get: () => false })`) — l'application n'est pas
touchée. Sans cela, les fiches « rien ne part » seraient vertes pour la mauvaise raison.

## ANO-WEB-89 : une bannière `fixed` qui ne réservait pas sa place

`ConsentBanner` est `fixed inset-x-3 bottom-3 z-50`. Rien ne réservait sa hauteur : sur les pages calées sur la
hauteur de la fenêtre — les onze écrans d'authentification (`lg:min-h-[calc(100vh-64px)]`), la vitrine, le tableau de
bord — elle **recouvrait** le bas de la carte. Mesuré sur `/fr/login` en 1280×720 : « Se connecter » et
« Inscris-toi » sous le dialogue, le clic intercepté (`… intercepts pointer events`), et aucun défilement possible
puisque le document tenait dans la fenêtre. Il fallait répondre à la bannière pour pouvoir se connecter.

La correction ne déplace pas la bannière : elle lui fait **annoncer sa taille**.

```tsx
// ConsentBanner.tsx — tant qu'elle est là, elle publie sa hauteur
const hauteur = boite.current?.offsetHeight ?? 0;
racine.style.setProperty("--yamba-consent-space", `${hauteur + 24}px`);
```

```css
/* global.css — la hauteur d'écran UTILE */
:root {
  --yamba-consent-space: 0px;
  --yamba-viewport: calc(100vh - var(--yamba-consent-space));
}
```

Les quatorze mises en page qui raisonnaient en `calc(100vh-…)` utilisent désormais `calc(var(--yamba-viewport)-…)`,
et le conteneur de page réserve la même hauteur (`pb-[var(--yamba-consent-space,0px)]`). Effet mesuré : la bannière
fait 163 px, la variable vaut 187 px, la page peut défiler d'autant, un défilement libère le bouton
(`document.elementFromPoint` renvoie bien le bouton), et **tout est rendu** dès qu'on a répondu.

La leçon est générale : un élément `fixed` qui recouvre du contenu doit publier sa taille, et la mise en page doit la
retirer de la hauteur utile. Le bandeau de maintenance (D64), lui, est en flux — il n'a jamais eu ce défaut.

## ANO-WEB-90 : un cast qui mentait, et un corridor jamais mesuré

`search_performed` est le premier événement du funnel (D66 3A). Il partait ainsi :

```ts
void track("search_performed", {
  origin: (params as { origin?: string }).origin ?? null,        // ← n'existe pas
  destination: (params as { destination?: string }).destination ?? null,
  …
});
```

`SearchTripsParams` n'a pas de `origin` ni de `destination` : les critères s'appellent **`from`** et **`to`**. Les deux
propriétés partaient donc **toujours à `null`** — la mesure n'a jamais pu dire quel corridor était cherché, alors que
c'est exactement le signal dont le pilotage (D59, D74) et la « demande visible » ont besoin. Le typage ne pouvait rien
dire : les deux lectures étaient **castées**. Une ligne corrigée, un cast supprimé, et les noms de propriétés — le
contrat de la mesure, en anglais — inchangés.

À retenir : `as { … }` sur un objet dont le type est connu ne convertit rien, il **fait taire** le compilateur. C'est
la deuxième anomalie de cette campagne née d'un accès de champ jamais vérifié.

## Ce que le harnais a appris ici

- **`storageState` mémorise aussi le `localStorage`.** Dès qu'une fiche a accepté, la session enregistrée d'Aminata
  porte `yamba.analytics.consent` : la bannière ne se présente plus, ni dans ce chapitre au passage suivant, ni dans
  les chapitres d'après. Chaque fiche repart donc « sans choix » (`partirSansChoix` : on efface la clé sur l'origine
  puis on recharge) et l'`afterAll` oublie la session mémorisée.
- **`networkidle` n'arrive jamais quand le SDK tourne** (le collecteur est sollicité en continu) : `page.goto` en
  délai d'attente de 120 s. Tout le chapitre navigue en `domcontentloaded`.
- **Un événement se rate en naviguant trop vite.** Chaque étape attend SON événement (`expect.poll` sur le journal du
  collecteur) au lieu d'un `waitForTimeout` global.
- **Deux passes valent mieux qu'un `⏭`.** Les fiches 1 à 5 se sautent sans clé, la fiche 6 se saute avec : le fichier
  est rejouable dans les deux états du poste, et chaque passe dit ce qu'elle prouve.

## Tests

Aucun code de service touché : plateforme inchangée (**1000** + auth 230). `apps/e2e` : **287 scénarios**
(280 + WEB-ANA ×6 + la contre-épreuve ANO-WEB-89). Typecheck user-ui et harnais verts ; aucune clé i18n ajoutée.

---

# Chapitre 5.28 du cahier 01-WEB : la maintenance — un refus que personne ne disait

*(PR `chore/recette-web-5-28`, 13/09/2026.)*

## Ce qui a été fait

Le vingt-huitième chapitre « fiches » du cahier 01-WEB : `WEB-MNT` (le bandeau d'annonce, la lecture seule, sa levée,
et la maintenance qui tombe pendant une réservation). Quatre fiches jouées et conformes (une après correction), une
anomalie close (`ANO-WEB-91`).

```
apps/e2e/src/chapitres/web-mnt.spec.ts                                            4 scénarios en série, 1 min 42
apps/user-ui/src/lib/api-client.ts                                                ANO-WEB-91 (signal `yamba:maintenance-refused`)
apps/user-ui/src/components/layout/MaintenanceBanner.tsx                          il dit le refus et relit son état aussitôt
```

## Le montage : deux interrupteurs, trois horloges

L'état de maintenance vit dans **un** document `PlatformSettings` (clé `maintenance`, D64 1A), écrit par un OPS ou un
super administrateur avec un motif d'au moins 20 caractères, journalisé et annoncé par email. Trois horloges le
propagent, et il faut les connaître pour lire ce chapitre :

| Qui | Quoi | Rythme |
|---|---|---|
| Passerelle | relit le document, refuse les écritures (`503 MAINTENANCE`, `Retry-After: 300`) sauf `/api/auth/*`, `/api/admin/*`, `/api/maintenance` | **10 s** |
| Front membre | `GET /api/maintenance` → bandeau ambre (annonce) ou rouge (lecture seule) | **60 s** |
| Back-office | page « État des services » → l'éditeur se remonte à chaque sondage | **30 s** |

Le chapitre pose l'annonce **par l'écran du back-office** (le geste du cahier) et bascule ensuite par l'API
d'administration. Filet indispensable : `beforeAll` et `afterAll` remettent le document à plat **directement en
base** — sans passer par une session d'administration qui pourrait, elle aussi, avoir échoué. Une maintenance
oubliée condamnerait tous les chapitres suivants.

## ANO-WEB-91 : le serveur refusait bien, l'écran ne le disait pas

La passerelle fait exactement ce que D64 demande :

```ts
res.setHeader("Retry-After", String(MAINTENANCE_RETRY_AFTER_SECONDS));
return res.status(503).json({ code: "MAINTENANCE", message: state.message.fr || "Maintenance en cours.", … });
```

Mais côté membre, chaque écran traduit **son** échec : le fil de messagerie affichait « Le message n'a pas pu être
envoyé. », l'assistant de réservation son erreur générique. La phrase prévue pour ce cas —
`maintenance.writeRefused`, « La plateforme est en maintenance : réessaie dans quelques minutes. », présente en FR et
en EN depuis D64 — n'était rendue **nulle part** : une clé morte.

Deux raisons de ne pas corriger écran par écran : il y en a une dizaine, et la cause n'est pas métier (elle ne dépend
ni du geste ni de l'écran). Le projet a déjà le bon patron, celui de la session expirée (A89) : **un signal global,
une surface qui l'écoute**.

```ts
// api-client.ts — la passerelle refuse une écriture : on le dit UNE fois, pour tout le monde
const donnees = error.response?.data as { code?: string; details?: { code?: string } } | undefined;
if (error.response?.status === 503 && (donnees?.code === "MAINTENANCE" || donnees?.details?.code === "MAINTENANCE")) {
  window.dispatchEvent(new CustomEvent(MAINTENANCE_REFUSED_EVENT));
}
```

```tsx
// MaintenanceBanner.tsx — la surface « maintenance » écoute, dit la raison, et relit son état
const surRefus = () => { toast.error(t("writeRefused")); void relire(); };
```

Le `relire()` n'est pas décoratif : un membre déjà sur sa page voyait le bandeau rouge jusqu'à **60 s** après la
bascule (le sondage du front). Désormais, son premier geste refusé le lui apprend dans la seconde — la phrase **et**
le bandeau.

À noter au passage, et consigné comme axe : la passerelle rend son code à la **racine** (`code`), alors que toute la
plateforme lit `details.code` (A146). C'est précisément pourquoi aucun écran ne le reconnaissait. Le correctif
accepte les deux formes ; aligner la passerelle serait plus propre.

## Ce que le harnais a appris ici

- **Une fixture de navigateur vit le temps d'UNE fiche.** Ouvrir le navigateur d'administration dans un `beforeAll`
  donne « Target page, context or browser has been closed » dès la fiche suivante : chaque fiche ouvre le sien (la
  session est mémorisée, donc c'est peu coûteux).
- **Un formulaire qui se remonte périodiquement se remplit… puis s'oublie.** L'éditeur du back-office se remonte à
  chaque sondage (30 s) : la première version de la fiche enregistrait une annonce **sans date**, et le PUT
  répondait 200. On attend la phrase qui n'apparaît qu'avec les données, on remplit, et l'on **vérifie la valeur**
  (`inputValue`) avant de cliquer.
- **`input[type="text"]` ne matche pas un `<input>` sans `type`** — les champs « Message FR / EN » du back-office.
- **Attendre la propagation avant d'observer** : la passerelle garde son état 10 s ; chaque fiche attend que
  `GET /api/maintenance` ait basculé avant d'ouvrir l'écran du membre, sinon on conclut « pas de bandeau » dans la
  fenêtre de cache.
- **Le bon compte pour le bon fil** : `bzv-accepted` est le deal de Pauline — c'est son écran qui doit tenter
  l'écriture refusée.

## Tests

Aucun code de service touché : plateforme inchangée (**1000** + auth 230). `apps/e2e` : **291 scénarios**
(287 + WEB-MNT ×4). Typecheck user-ui et harnais verts ; aucune clé i18n ajoutée (`maintenance.writeRefused` existait
déjà — c'est bien le problème qu'elle ne servait pas).


---

# Chapitre 5.29 du cahier 01-WEB : les pages d'erreur — et comment faire tomber une application qui ne tombe pas

*(PR `chore/recette-web-5-29`, 13/09/2026.)*

## Ce qui a été fait

Le vingt-neuvième chapitre « fiches » du cahier 01-WEB : `WEB-ERR` (page introuvable, ressources inexistantes, page
d'erreur générale dedans et hors du tunnel de réservation, variante « nouvelle version publiée », et la règle qui a
motivé ces écrans — un membre ne voit jamais de code). Cinq fiches jouées et conformes (une après correction), une
anomalie close (`ANO-WEB-92`).

```
apps/e2e/src/chapitres/web-err.spec.ts                                            5 scénarios en série, 2 min 06
apps/user-ui/src/app/[locale]/dev/panne.ts                                        le déclencheur de panne, inerte en production
apps/user-ui/src/app/[locale]/dev/erreur/page.tsx                                 panne HORS tunnel
apps/user-ui/src/app/[locale]/bookings/dev-erreur/page.tsx                        panne DANS le tunnel (la phrase du paiement)
apps/user-ui/src/app/[locale]/error.tsx                                           ANO-WEB-92 (l'échec de copie est dit)
apps/user-ui/messages/{fr,en}/errors.json                                         `boundary.copyFailed`
```

## Faire tomber une application qui ne tombe pas

La page d'erreur (`[locale]/error.tsx`) est une **frontière React** : elle ne s'affiche que si un rendu lève une
exception. Encore faut-il en provoquer une. Quatre méthodes ont été essayées, mesurées, et **aucune n'a produit la
frontière** :

| Méthode | Résultat |
|---|---|
| Couper la passerelle (suggestion du cahier) | les écrans se chargent **côté navigateur** : chacun affiche son propre état d'erreur, la frontière ne bouge pas |
| Réponse d'API malformée (`{"notifications": 42}`, `{"booking": null}`, `{"bookings": 42}`) | les composants sont gardés (`?? []`, états vides) : aucun rendu ne lève |
| Charge RSC d'une navigation client en 500 | le routeur ne casse pas |
| Morceau de code (chunk) coupé | rien tant que la page n'en charge pas ; l'unique import dynamique du produit est l'étape de paiement |

**C'est une bonne nouvelle déguisée en difficulté** : les gardes tiennent. Restait donc la porte que le cahier
prévoit explicitement — « demander à un développeur un moyen sûr de déclencher l'erreur » :

```ts
// apps/user-ui/src/app/[locale]/dev/panne.ts
export function declencherLaPanneDeRecette(type?: string): never {
  if (process.env.NODE_ENV === "production") notFound();
  if (type === "chunk") { const e = new Error("Loading chunk 4229 failed (panne simulée, recette 5.29)"); e.name = "ChunkLoadError"; throw e; }
  throw new Error("Panne simulée (recette 5.29) : cette page n'existe que hors production.");
}
```

Deux routes l'appellent : `/[locale]/dev/erreur` et `/[locale]/bookings/dev-erreur`. La seconde n'est pas un
doublon — la frontière n'ajoute la phrase « aucun paiement n'a été effectué » que si le chemin est sous `/book` ou
`/bookings`, et c'est **précisément** ce comportement qu'il faut éprouver. En production, les deux répondent « page
introuvable ». Comme la panne est levée **côté serveur**, Next fournit un `digest` : la référence d'incident existe
même sans Sentry, ce qui permet d'éprouver tout le bloc (référence, copie, aide, lien support) sur ce poste.

## ANO-WEB-92 : le bouton qui ne répond rien, au pire moment

La référence d'incident se copie par `navigator.clipboard.writeText` — qui **n'existe pas hors contexte sécurisé**.
Le code attrapait l'échec et ne faisait rien :

```ts
} catch {
  /* presse-papiers indisponible : la référence reste lisible à l'écran */
}
```

Le commentaire dit vrai — la référence reste affichée — mais le membre, lui, a cliqué sur « Référence de
l'incident » et n'a rien vu se passer. Au moment où il essaie de transmettre une panne au support, un bouton muet
est une seconde panne. Le chapitre 5.17 avait tranché exactement la même question pour le code de livraison
(`ANO-WEB-59`) : **un échec se dit**. La page d'erreur affiche donc `errors.boundary.copyFailed`, ajoutée en FR et
en EN (le miroir i18n de la CI est vert).

Le harnais, lui, interpose un presse-papiers en mémoire de page (`observerLePressePapiers`, déjà utilisé aux
chapitres 5.17 et 5.23) : le chemin nominal est éprouvé **et** le contenu copié est vérifié (`lirePressePapiers`),
pas seulement le libellé qui change.

## Ce que le harnais a appris ici

- **`innerText` sur un `body` cloné (donc détaché) retombe sur `textContent`** : on récupère le contenu des
  `<script>`, charge RSC comprise — des milliers de caractères qui ressemblent à une fuite technique et font échouer
  une garde « aucune trace ». Le `body` **vivant** ne rend que ce qui est affiché, et la fenêtre d'erreur de Next
  (un `nextjs-portal` à racine fantôme) n'en fait pas partie : c'est exactement la lecture qu'il faut.
- **`domcontentloaded` rend la main avant le rendu** : lire le corps aussitôt donne une chaîne vide. On attend le
  titre visé, puis on lit.
- **Quatre échecs de provocation valent une ligne de rapport** : quand une application refuse de tomber, on ne
  s'acharne pas — on consigne que les gardes tiennent, et on demande la porte.

## Tests

Aucun code de service touché : plateforme inchangée (**1000** + auth 230). `apps/e2e` : **296 scénarios**
(291 + WEB-ERR ×5). Typecheck user-ui et harnais verts ; miroir i18n vert (`errors.boundary.copyFailed` FR/EN).


---

# Chapitre 5.30 du cahier 01-WEB : le mobile — émuler un téléphone, et prouver qu'une page ne déborde pas

*(PR `chore/recette-web-5-30`, 13/09/2026.)*

## Ce qui a été fait

Le trentième chapitre « fiches » du cahier 01-WEB : `WEB-MOB` (accueil et menu, filtres en feuille du bas, barre de
réservation collante, assistant, bulles de messagerie, croix de la porte d'identité, zone 768–1024 px, six cases du
code, listes du tableau de bord, page destinataire). Dix fiches jouées et conformes (une après correction), une
anomalie close (`ANO-WEB-93`).

```
apps/e2e/src/chapitres/web-mob.spec.ts                                            10 scénarios, iPhone 14 émulé
apps/e2e/src/fixtures/yamba.ts                                                    `{ mobile: true }` sur les deux fabriques de navigateur
apps/user-ui/src/components/search/SearchResultsView.tsx                          ANO-WEB-93 (le panneau des filtres est une fenêtre)
```

## Émuler un téléphone, ce n'est pas rétrécir une fenêtre

Le produit ne se contente pas de changer de style sous 768 px : il rend des **arbres différents**
(`useIsMobile`, feuilles du bas, barres collantes, double arbre `BookingStepperDesktop` /
`BookingStepperMobile`). Un `viewport: { width: 390 }` seul aurait donc éprouvé l'interface desktop dans une fenêtre
étroite — et validé la mauvaise chose. La fabrique de contexte du harnais pose les trois marqueurs :

```ts
{ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3, userAgent: "…iPhone…" }
```

`{ mobile: { width: 800 } }` sert la fiche 7, qui vise la zone intermédiaire où la colonne de droite du Voyageur
avait disparu — le point aveugle classique d'une grille qui ne déclare ses colonnes qu'à partir de `lg:`.

## Prouver qu'une page ne déborde pas (sans interdire ce qui doit défiler)

La règle du cahier est « la page ne défile jamais horizontalement ; un contenu large défile **dans son propre
cadre** ». Deux garde-fous, partagés par toutes les fiches :

1. `aucunDebordement()` compare `scrollWidth` et `clientWidth` **et**, en cas d'échec, parcourt le DOM pour nommer
   l'élément le plus à droite : « `div.flex.gap-2` (bord droit 612 px pour 390 px d'écran) ». Un échec anonyme ne se
   corrige pas ; un échec nommé se corrige en une minute.
2. `rienNeSortDuCadre()` cherche les éléments dont le bord droit sort de l'écran, **sauf** ceux qu'un ancêtre fait
   défiler horizontalement (`overflow-x: auto|scroll` avec `scrollWidth > clientWidth`). Sans cette exemption, la
   rangée de réponses rapides de la messagerie — qui défile volontairement — ferait échouer la fiche alors qu'elle
   respecte exactement la règle.

## ANO-WEB-93 : une feuille sur trois n'était pas une fenêtre

Le panneau des filtres de recherche occupe tout l'écran (`fixed inset-0 z-[150]`) mais n'était qu'un `div` : ni
`role="dialog"`, ni `aria-modal`, ni nom accessible — et Échap ne le fermait pas. Les deux autres feuilles de la
recherche le faisaient déjà. Conséquences concrètes : un lecteur d'écran continue de parcourir la page **en
dessous**, et un membre au clavier n'a aucune porte de sortie.

```tsx
<div role="dialog" aria-modal="true" aria-label={t("filters.title")} className="fixed inset-0 z-[150] …">
```

```tsx
useEffect(() => {
  if (!mobileFiltersOpen) return;
  const surEchap = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileFiltersOpen(false); };
  window.addEventListener("keydown", surEchap);
  return () => window.removeEventListener("keydown", surEchap);
}, [mobileFiltersOpen]);
```

Le piège de focus reste à poser (tabulation qui sort vers la page) : c'est le sujet du chapitre 5.31, et il est
consigné comme tel.

## Ce que le harnais a appris ici

- **« Fermer le menu » est le voile plein écran** : son centre est couvert par la feuille, le clic doit viser le
  haut — le geste réel d'un doigt qui tape à côté.
- **La croix de la porte d'identité s'appelle « Plus tard »** (comme le lien du bas et le voile) : on la reconnaît à
  sa position, et l'on consigne le problème de nom.
- **Le titre d'une page de résultats s'affiche avant les cartes** : attendre le nom de la ville ne prouve rien, il
  faut attendre un prix.
- **`POST /deals/:id/tracking-link` rend un chemin relatif** : `new URL(...)` lève « Invalid URL ».
- **Le clavier virtuel n'existe pas en émulation** : « le clavier ne masque pas le bouton » (fiche 4) ne peut être
  vérifié que sur un vrai téléphone — consigné, pas simulé.

## Tests

Aucun code de service touché : plateforme inchangée (**1000** + auth 230). `apps/e2e` : **306 scénarios**
(296 + WEB-MOB ×10). Typecheck user-ui et harnais verts ; aucune clé i18n ajoutée.

---

# Chapitre 5.31 du cahier 01-WEB : l'accessibilité clavier — un crochet pour toutes les fenêtres

*(PR `chore/recette-web-5-31`, 13/09/2026.)*

## Ce qui a été fait

Le trente et unième chapitre « fiches » du cahier 01-WEB : `WEB-A11Y` (parcours de l'accueil au clavier, connexion
au clavier, fermeture par Échap avec retour du focus, piège de focus, libellés des contrôles sans texte, champs en
erreur, contraste en mode sombre, zoom à 200 %). Huit fiches jouées et conformes (quatre après correction), quatre
anomalies closes (`ANO-WEB-94` à `97`), et le constat du 5.30 sur la croix « Plus tard » réglé.

```
apps/e2e/src/chapitres/web-a11y.spec.ts                                   8 scénarios, au clavier réel
apps/e2e/src/pages/mes-envois.ts                                          `ligne()` devient publique (viser l'ouvreur)
apps/e2e/src/chapitres/web-acc.spec.ts, web-mob.spec.ts                   la croix s'appelle « Fermer » (+ ACC-5 stabilisé)
apps/e2e/src/chapitres/web-dea.spec.ts, web-pic.spec.ts                   fiches anciennes remises d'aplomb (date, assertion périmée)
apps/user-ui/src/hooks/useDialogFocus.ts                                  NOUVEAU — entrée, boucle, restitution, Échap
apps/user-ui/src/components/**  (14 fenêtres modales)                     ANO-WEB-94 / 95 — le crochet, et `inert` sur 4 feuilles
apps/user-ui/src/components/shared/photos/PhotoThumbs.tsx                 ANO-WEB-96 — vignettes nommées par leur rang
apps/user-ui/src/components/{dashboard,trips}/…  (4 listes)               ANO-WEB-97 — en-têtes de groupe lisibles
apps/user-ui/messages/{fr,en}/common.json                                 lightbox.open / lightbox.more / authGate.close
```

## Ce qu'une fenêtre modale promet

`role="dialog"` + `aria-modal="true"` disent à un lecteur d'écran « tout le reste est inerte ». Pour que ce soit
vrai au clavier, trois gestes sont nécessaires (WCAG 2.4.3, *focus order*) — et **aucun** n'existait dans le
produit : 19 `role="dialog"`, zéro lecture de `document.activeElement`.

1. **Entrer** : à l'ouverture, le focus va dans la fenêtre (sinon `Tab` continue sur la page du dessous).
2. **Boucler** : `Tab` sur le dernier élément revient au premier, `Maj+Tab` sur le premier va au dernier.
3. **Rendre** : à la fermeture, le focus revient sur l'élément qui a ouvert la fenêtre (sinon il tombe sur
   `<body>`, et le membre repart du haut de la page).

## Le crochet `useDialogFocus`

```ts
export function useDialogFocus(ref: RefObject<HTMLElement | null>, active = true, onEscape?: () => void): void {
  const surEchap = useRef(onEscape);
  useEffect(() => { surEchap.current = onEscape; });

  useEffect(() => {
    if (!active) return;
    const conteneur = ref.current;
    if (!conteneur) return;
    const origine = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    pile.push(conteneur);
    const raf = requestAnimationFrame(() => {
      if (conteneur.contains(document.activeElement)) return;   // un enfant a posé son propre focus : priorité
      focalisables(conteneur)[0]?.focus();
    });
    const onKeyDown = (e: KeyboardEvent) => {
      if (pile[pile.length - 1] !== conteneur) return;          // seule la fenêtre du DESSUS réagit
      if (e.key === "Escape" && surEchap.current) return surEchap.current();
      if (e.key !== "Tab") return;
      /* … boucle premier ↔ dernier … */
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      /* … retirer l'écoute, dépiler … */
      const actif = document.activeElement;
      const perdu = !actif || actif === document.body || conteneur.contains(actif);
      if (perdu && origine?.isConnected) origine.focus({ preventScroll: true });
    };
  }, [ref, active]);
}
```

Quatre décisions dans ces lignes :

- **La pile de module.** Une confirmation peut s'ouvrir au-dessus d'un formulaire. Sans pile, les deux écoutes
  `keydown` se battraient pour le focus, et un Échap fermerait les deux fenêtres d'un coup.
- **`onEscape` passe par une référence.** Les appelants écrivent `onCloseAction={() => setOpen(false)}` : une
  fonction **nouvelle à chaque rendu**. Mise en dépendance de l'effet, elle le relancerait à chaque frappe — et le
  nettoyage rendrait le focus à l'ouvreur **en pleine saisie** dans la fenêtre. La première version l'avait ; elle
  a été corrigée avant d'être jouée.
- **On ne vole pas un focus posé ailleurs.** Si le membre a navigué ou cliqué un autre champ pendant la fermeture,
  le crochet ne ramène rien : il ne rend la main que si le focus est perdu (`<body>`) ou encore dans la fenêtre.
- **« Focalisable » veut dire « a une boîte ».** Un bouton dans un bloc replié (`display: none`) ou sous `[inert]`
  est exclu de la boucle (`getClientRects().length > 0`).

## `inert` : une feuille fermée n'est pas une feuille absente

Quatre feuilles restent **montées** pour animer leur fondu ou leur glissement (`opacity-0`, `translateY(100%)`).
`aria-hidden` les retire de l'arbre d'accessibilité, mais **pas de la tabulation** : fermées, leurs boutons
restaient atteignables, invisibles ou hors écran. L'attribut HTML `inert` fait les deux (ni focus, ni clic, ni
lecteur d'écran) ; React 19 le prend comme booléen :

```tsx
<div ref={dialogRef} role="dialog" aria-modal="true" aria-hidden={!isOpen} inert={!isOpen} className={…}>
```

## Le voile et la croix de la porte d'identité

Le voile était un `<button aria-label="Plus tard">` : le **premier** arrêt de la boucle, et un troisième contrôle
du même nom que la croix et le lien. Il garde son clic (souris, doigt) mais sort de la tabulation et de l'arbre :
`aria-hidden="true" tabIndex={-1}`. La croix s'appelle « Fermer » (`common.authGate.close`).

## Les vignettes de photo et les compteurs

```tsx
ariaLabel={[photo.label, t("open", { current: i + 1, total: photos.length })].filter(Boolean).join(" — ")}
// « Agrandir la photo 1 sur 2 » ; le « +N » devient t("more", { count }) → « Voir 2 photos de plus »
```

Les en-têtes de groupe des listes (« À traiter · 3 ») passent de `text-slate-400` / `slate-300` (clair) et
`slate-500` / `slate-600` (sombre) à `text-slate-500 dark:text-slate-400` : ≥ 4,5:1 dans les deux thèmes.

## Ce que le harnais a appris ici

- **Mesurer un contraste, c'est composer les fonds.** `getComputedStyle().backgroundColor` d'une puce
  `bg-[#FF9900]/15` rend `rgba(255, 153, 0, 0.15)` : la traiter comme opaque donnait des faux positifs à 1,25:1. La
  mesure empile les couches jusqu'au premier fond opaque et les compose de bas en haut.
- **Vérifier le retour du focus sur l'ÉLÉMENT.** On pose `data-recette-ouvreur` sur l'ouvreur avant `Entrée`, et
  l'on regarde si `document.activeElement` le porte après `Échap` — deux « Annuler » cohabitent sur « Mes envois ».
- **Désigner la fenêtre par le focus**, pas par « le dialog visible » : les feuilles hors écran ont une boîte.
- **Taper avant l'hydratation perd des frappes**, et un formulaire validé avant l'hydratation part en natif sans
  aucune validation (`aria-invalid` absent partout) : attendre le premier appel d'API du client.
- **Une fiche qui écrit `if (await bouton.count())` peut passer sans rien jouer** : la feuille des filtres est
  `md:hidden`, il faut un écran de téléphone (`{ mobile: true }`).

## Trois fiches anciennes remises d'aplomb

La non-régression a fait tomber trois fiches ; rejouées sur le produit SANS les correctifs, elles tombaient aussi.
C'est la méthode à retenir : **avant d'accuser son changement, rejouer sans lui** (`git stash push -- apps/user-ui`).

- `web-dea.spec.ts` (DEA-1) : une date en dur contre un jeu d'essai relatif (`days(15)`) → `Intl.DateTimeFormat("fr-FR",
  { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Paris" })` sur `Date.now() + 15 j`.
- `web-pic.spec.ts` (PIC-7) : assertion périmée par ANO-WEB-60 (le raccourci « Valider la livraison » est voulu) ;
  (PIC-8) lecture du suivi par `expect.poll` au lieu d'un `innerText` immédiat qui rendait `""`.
- `web-acc.spec.ts` (ACC-5) : clic après `goBack` enveloppé dans `expect(async () => …).toPass({ timeout })`.

## Tests

Aucun code de service touché : plateforme inchangée (**1000** + auth 230). `apps/e2e` : **314 scénarios**
(306 + WEB-A11Y ×8) ; non-régression rejouée sur les chapitres qui ouvrent les fenêtres modifiées (signalement,
annulation, mobile, recherche, prise en charge, deal Voyageur, messagerie, favoris, porte d'accès). Typecheck
user-ui vert ; i18n : trois clés ajoutées (`common.lightbox.open`, `common.lightbox.more`, `common.authGate.close`),
miroir FR/EN parfait.


---

# Chapitre 5.32 du cahier 01-WEB : le vocabulaire — relire 62 écrans, et garder le lexique à la source

*(PR `chore/recette-web-5-32`, 13/09/2026.)*

## Ce qui a été fait

Le dernier chapitre du § 5 du cahier 01-WEB : `WEB-VOC` (mots de rôle, « assurance », noms de catégories,
tutoiement, textes de démonstration, libellés vides ou clés techniques). Six fiches conformes (quatre après
correction), cinq anomalies closes (`ANO-WEB-98` à `102`), une règle de CI ajoutée.

```
apps/e2e/src/chapitres/web-voc.spec.ts                          relevé commun (62 écrans FR/EN) + 6 fiches
apps/e2e/src/chapitres/web-{rch,msg,rsv-devis,rem,dea,trj,voy}   20 citations d'anciens textes mises à jour
apps/e2e/src/pages/fil-messagerie.ts                            idem
scripts/check-i18n-messages.mjs                                 RÈGLE 6 — le vocabulaire des messages
apps/user-ui/messages/{fr,en}/*.json                            ANO-WEB-98/99/100/101 — ~90 valeurs réécrites
apps/user-ui/src/**  (≈ 20 fichiers)                            textes en dur : tutoiement, rôles, étiquettes traduites
apps/user-ui/src/components/trips/detail/ReviewsCard.tsx        ANO-WEB-102 — le lien des avis
apps/user-ui/src/app/[locale]/dashboard/*/preview/page.tsx      vitrines de démo introuvables en production
apps/notification-service/src/emails/**                         emails anglais : « Traveler »
apps/trip-service/src/utils/templates/trip-notifications/*.ejs  emails d'alerte : tutoiement
```

## Relire, pas refaire : un relevé commun

Le cahier dit « en relisant les écrans déjà parcourus ». Une fiche par écran aurait rejoué 62 navigations six
fois. Le harnais fait donc UN relevé (`WEB-VOC-0`) et six requêtes dessus :

```ts
async function texteVisible(page: Page): Promise<string> {
  // innerText (ce qui est rendu) + ce qu'entend un lecteur d'écran, sur les éléments qui ont une boîte
  document.querySelectorAll("[aria-label], [placeholder], [title], img[alt]") …
}
function occurrences(motif: RegExp, filtre = (e: Ecran) => true, exclure?: RegExp): string[]
  // → « [en] finances (aminata) : « …retention passed on to the carrier + €14.56… » »
```

Le relevé est écrit sur disque (`resultats/releve-web-voc.json`) : après l'échec d'une fiche, Playwright remplace
le processus de travail, et un relevé gardé en mémoire serait perdu pour les suivantes. Le chapitre n'est donc
**pas en série** — une fiche qui échoue n'empêche pas les autres de rendre leur inventaire.

Trois garde-fous d'instrument, tous payés : un écran « introuvable » est refusé (sinon il passe le seuil de
longueur) ; la stabilité exige trois lectures identiques et zéro `.animate-pulse` ; les adresses (`…shipper@…`) et
les chemins d'URL (`/carrier/deals/`) ne sont pas des mots.

## VOC-3 : créer la donnée que la fiche doit relire

Le jeu d'essai n'a aucun envoi « bagage en soute » VIVANT (le seul est refusé, et un envoi refusé n'apparaît dans
aucune liste). Une fiche « verte » sur des écrans qui ne montrent pas l'objet ne prouve rien — c'est ce qu'a fait la
première version. La fiche réserve donc un bagage en soute sur `bzv-perkg` (assistant, paiement FAKE) et exige que
chaque écran **nomme** l'objet avant de comparer les formulations.

## La règle 6 du contrôle i18n

```js
const VOCABULAIRE = {
  fr: [
    { motif: /\b(trippers?|yambers?|transporteurs?|travell?ers?|carriers?|shippers?)\b/i, raison: "mot de rôle refusé" },
    { motif: /\b(assurances?|IPID)\b/i, raison: "« assurance »" },
    { motif: /(?<![-\p{L}])(vous|votre|vos)(?![-\p{L}])/iu, raison: "vouvoiement",
      sauf: /tous les deux|ensemble|vos deux|vos avis|vos profils|vous organiser|vous devez convenir/i },
  ],
  en: [ /\b(carriers?|trippers?|yambers?|travellers?)\b/i, /\b(insurance|insured|IPID)\b/i ],
};
// + toute valeur vide ou « — » ; + garde du garde : moins de 1000 textes lus → erreur
```

`(?<![-\p{L}])vous(?![-\p{L}])` : un `\b` ASCII ne suffit pas en français (« rendez-vous » contient « vous » entre
deux frontières de mot, et `\b` ne connaît pas les lettres accentuées) ; les assertions arrière/avant avec `\p{L}`
(drapeau `u`) excluent le trait d'union et toute lettre Unicode.

## La non-régression, et ce qu'un inventaire de citations ne voit pas

Avant de jouer, un script liste chaque chaîne RETIRÉE par le diff (`git diff -U0 | grep "^-"`, littéraux entre
guillemets ou accents graves) et la cherche dans le harnais (`grep -rnF`) : vingt citations trouvées et mises à
jour. Il en a manqué deux, dans `web-alr.spec.ts` : le texte d'un gabarit EJS (« Un nouveau trajet correspond à
votre alerte ») n'est pas un littéral, le script ne pouvait pas l'extraire. La non-régression les a trouvées — la
preuve qu'un inventaire aide mais ne remplace pas le rejeu.

WEB-ACC-8 est tombée sur un `POST /auth/refresh` intermittent ; rejouée sans les correctifs (`git stash push --
apps/user-ui/src apps/user-ui/messages`), elle tombait aussi. La requête est la sonde de session du visiteur ; la
fiche l'exclut avec sa raison.

## Améliorations au GO : un lexique, une règle 7, et des fiches qui nettoient derrière elles

- **`scripts/lexique-yamba.json`** : les motifs (source + drapeaux) et leurs exceptions de sens, lus par
  `check-i18n-messages.mjs` (`new RegExp(r.motif, r.drapeaux)`) et par `web-voc.spec.ts` (`regle("fr", "vouvoiement")`).
  Avant, la liste des « vous » pluriels existait en deux copies — la première divergence aurait donné une CI verte et
  une recette rouge.
- **Règle 7** : `BOOKING_EVENT_TYPES` est lu dans le contrat (`api-contracts`) par expression régulière, et chaque type
  doit avoir `copy.<type_avec_underscores>.<SHIPPER|CARRIER>.{title,line}` (ou des sous-étapes pour
  `tracking_event`). Garde du garde : moins de 10 types lus → erreur.
- **VOC-3** crée une réservation puis l'annule dans un `finally` (`POST /deals/:id/cancel`) : une fiche qui
  consomme la capacité d'un trajet du jeu d'essai fausse silencieusement les chapitres joués après elle.
- **Relevé parallèle** : `await Promise.all([lireVisiteur(), lireExpeditrice(), lireVoyageur()])`, un onglet par
  compte ; `LANGUES = SUPPORTED_LOCALES` importé en relatif depuis `api-contracts/src/locale.ts` (fichier sans zod).
- **Refresh du visiteur : non fait**, voir le rapport — le marqueur localStorage n'est pas une preuve d'absence de
  session.

## Ce qui n'a PAS été touché, volontairement

Les messages d'erreur de l'API (deal-service) et l'OpenAPI disent « carrier » : c'est la surface publique en
anglais et le vocabulaire du code (CLAUDE.md). Le client ne les affiche jamais bruts (A146 : il traduit
`details.code`).

## Tests

Plateforme inchangée en nombre (**1000** + auth 230) ; notification-service 115 et trip-service 261 rejoués verts
après la réécriture des emails. `apps/e2e` : **321 scénarios** (314 + WEB-VOC ×7). Typecheck user-ui et harnais
verts ; i18n : règle 6 verte, contre-épreuve rouge comme attendu.


---

# Chapitre 7 du cahier 01-WEB : la non-régression — douze gardes, et deux fonctions mortes retrouvées

*(PR `chore/recette-web-7`, 13/09/2026.)*

## Ce qui a été fait

Le chapitre « Non-régression » du cahier 01-WEB : douze points qui ont déjà cassé, joués en un fichier
(`web-nrg.spec.ts`, 11 scénarios — NRG-6 et 12 partagent un relevé). Tous conformes, trois après correction ; trois
anomalies closes (`ANO-WEB-103` à `105`).

```
apps/e2e/src/chapitres/web-nrg.spec.ts                                   11 scénarios, non séquentiels
apps/e2e/src/pages/ecran.ts                                              NOUVEAU — gardes d'écran + écoute de console
apps/e2e/src/chapitres/web-mob.spec.ts                                   importe les gardes au lieu de les définir
apps/e2e/src/fixtures/jeu-essai.ts                                       tousLesTrajets()
apps/e2e/src/pages/mes-trajets.ts, fil-messagerie.ts                     actionDuMenu() ; « Proposer un autre »
apps/user-ui/src/components/dashboard/sections/FinancesSection.tsx       ANO-WEB-103 (onglet dérivé) + ANO-WEB-104 (le serveur décide)
apps/user-ui/src/components/layout/header/HeaderShareTripCTA.tsx         ANO-WEB-105 (nom accessible complet)
```

## ANO-WEB-104 : un front qui décidait à la place du serveur

```tsx
// Avant
const stripeAccountReady = Boolean(user?.carrierPage?.stripeAccountId);
<button onClick={stripeAccountReady ? openStripe : () => toast.info(t("stripeMissing"))}>
```

`/auth/me` sert `carrierPage` par une **liste blanche** (règle non négociable des DTO) : `stripeOnboardingComplete`,
`stripeChargesEnabled`… jamais `stripeAccountId`. La condition était donc toujours fausse — pour tous les
Voyageurs, et sans aucune erreur : un toast d'information poli, un serveur jamais appelé. Le serveur, lui, fait déjà
le bon contrôle, dans le bon ordre :

```ts
await requireSudo(req);                       // 403 SUDO_REQUIRED → la porte par code
if (!carrierPage?.stripeAccountId) return next(new ConflictError("…", { type: "carrier", code: "STRIPE_ACCOUNT_MISSING" }));
```

Correction : `onClick={openStripe}` toujours, et le front traduit les deux codes (`SUDO_REQUIRED` → la porte,
`STRIPE_ACCOUNT_MISSING` → « Finalise d'abord ton compte Stripe »). C'est A146 appliquée : le code de refus arrive au
client, le client ne devine pas.

## ANO-WEB-103 : `useState` n'est pas réactif

```tsx
// Avant : évalué UNE fois, au montage — `user` n'est pas encore chargé, isCarrier vaut false
const [tab, setTab] = useState<FinancesTab>(isCarrier ? "wallet" : "payments");
// Après : dérivé tant que le membre n'a pas choisi
const [choix, setTab] = useState<FinancesTab | null>(null);
const tab: FinancesTab = choix ?? (isCarrier ? "wallet" : "payments");
```

L'argument de `useState` est une valeur **initiale** : ce qui change ensuite (ici, l'arrivée du membre) ne la met pas
à jour. En navigation interne, le cache de TanStack Query sert `user` dès le premier rendu et le défaut disparaît ;
à l'ouverture directe de `/dashboard/finances`, il est systématique.

## NRG-10 : mesurer contre la production, pas contre le poste

Le poste relève les plafonds du limiteur (`RATE_LIMIT_ANONYMOUS_MAX=2000`, `RATE_LIMIT_AUTHENTICATED_MAX=5000`) pour
que la recette ne se bloque pas elle-même. « Aucun 429 sur le poste » ne dit donc rien de la production. La fiche
importe les défauts du code (`RATE_LIMIT_ANONYMOUS`, `RATE_LIMIT_AUTHENTICATED` de
`packages/middleware/rate-limit-tier.ts`), mesure le coût d'une page (6,2 appels) et projette à un rythme humain.
La répartition par route est publiée : `GET /api/maintenance` à 1,99 par page — un seul composant qui lit au montage,
doublé par `page.goto` (rechargement) et le StrictMode de `next dev`. La mesure est donc pessimiste, et écrite comme
telle.

## Les gestes sensibles sans griller le quota, ni un compte

NRG-7 attend la réponse (`403` + `details.code === "SUDO_REQUIRED"`) et la porte à l'écran, puis s'arrête : aucun
« M'envoyer le code ». La suppression se joue sur un compte neuf créé par la fiche : confirmer « SUPPRIMER » sur un
compte du jeu d'essai qui aurait une fenêtre sudo ouverte l'effacerait pour de bon.

## Améliorations au GO : refuser franchement, et un type qui ne ment plus

- **CORS** (`apps/api-gateway/src/libs/origins.ts`) : `origineAutorisee(origin)` (pure), et un middleware AVANT `cors()`
  qui répond `403 { details: { code: "ORIGIN_NOT_ALLOWED" } }`. Pourquoi pas simplement `callback(null, false)` ? Parce
  que CORS protège la LECTURE de la réponse par le navigateur, pas l'EXÉCUTION de la requête : un formulaire d'un site
  tiers enverrait son POST, et le service l'exécuterait. Le refus doit couper la requête avant le proxy — NRG-11 le
  vérifie par un `POST /auth/login` d'une origine étrangère, refusé en 403.
- **`useUser`** : `stripeAccountId?` retiré du type `CarrierPage`. Un champ « optionnel » dans le type d'une réponse
  est une promesse que le compilateur ne peut pas vérifier ; retiré, toute lecture future échoue au typecheck.
- **NRG-10** mesure en deux phases : 6,0 appels par page par rechargement, **0,8 par liens** — la seconde est celle
  d'un membre réel.

## Tests

Plateforme inchangée (**1000** + auth 230) : aucun code de service touché. `apps/e2e` : **332 scénarios** (321 + 11).
web-mob 10/10 et web-msg 21/21 rejoués après l'extraction des gardes et l'assouplissement du page object. Typecheck
user-ui et harnais verts.

---

# Décision du 13/09 : le rôle prend la majuscule — « Voyageur », « Traveler », partout

*(PR `chore/recette-voyageur-majuscule`, 13/09/2026 — le point « à trancher » du chapitre 5.32.)*

Le produit écrivait tantôt « Voyageur » (le rôle), tantôt « le voyageur » (souvent le même rôle) ; en anglais,
« Traveler » et « the traveler ». Décision : **le rôle prend toujours la majuscule**, dans les deux langues.

- **Messages** : 71 valeurs réécrites par une expression qui ne touche QUE la valeur (le texte après `"clé": `) —
  aucune clé ne change, le miroir FR/EN reste parfait.
- **Code** : 33 lignes, uniquement dans les littéraux de chaîne et le texte JSX ; les commentaires (`// le voyageur a
  refusé`) ne sont pas du texte affiché et restent tels quels.
- **Emails** : une phrase de l'email d'accueil anglais (auth-service).
- **Garde** : règle `role-majuscule` dans `scripts/lexique-yamba.json`, avec des frontières Unicode
  (`(?<![\p{L}-])voyageu(r|rs|se|ses)(?![\p{L}])`, drapeau `u`, SANS `i` : c'est la minuscule qui est refusée). Contre-épreuve :
  « Lieu convenu avec le voyageur » réintroduit → refusé, clé nommée.
- **Harnais** : 12 citations mises à jour (web-fav, web-rch, web-rsv-devis, web-lit).



---

# Cahier 02-ADMIN, § 4.1 : la connexion en deux étapes — et un outil pour relire le journal

*(PR `chore/recette-admin-4-1`, 13/09/2026.)*

## Ce qui a été fait

Le premier chapitre du cahier du back-office : six fiches (ADM-SEC-1 à 6), conformes, une après correction
(`ANO-ADM-01`).

```
apps/e2e/src/admin/adm-sec-connexion.spec.ts        7 scénarios en série (compte admin jetable, attentes réelles)
apps/e2e/src/pages/journal-admin.ts                 NOUVEAU — lireLeJournal / actionsDuJournal (API de /audit)
apps/admin-ui/src/components/LoginFlow.tsx          ANO-ADM-01 — le code du refus d'abord
```

## Relire le journal comme un administrateur

`GET /admin/audit` (permission `audit.read`) est l'API de l'écran `/audit`. L'outil pagine par `nextCursor`, borne par
`from` (le journal n'est jamais purgé : sans borne, il rend les exécutions précédentes) et retourne la liste dans l'ordre
**chronologique** — le serveur la sert du plus récent au plus ancien. Piège payé : une borne « maintenant moins une
seconde » a ramassé la dernière connexion de la fiche précédente ; la borne se pose après deux secondes de silence
quand la fiche d'avant a agi sur le même compte.

## Un compte admin jetable

```ts
await new Inscription(page).creer(neuf, mailpit);                        // un membre normal
grantAdmin(neuf.email, "--role", "OPS");                                 // § 2.5, sortie du script vérifiée
// … enrôlement : le secret lu à l'écran, totpCode(secret) calculé …
// afterAll : grantAdmin(email, "--revoke") puis suppression du compte
```

Le blocage de SEC-5 dure quinze minutes et SEC-4 consomme six codes de secours : sur un compte de recette, les
chapitres suivants seraient bloqués.

## ANO-ADM-01 : un 401 n'est pas une explication

```tsx
const code = codeDuRefus(err);                // (err.data as { details?: { code } }).details.code
if (code === "TOO_MANY_ATTEMPTS") setError("Trop de tentatives : ce compte est bloqué pendant 15 minutes. …");
else if (code === "ADMIN_PREAUTH_EXPIRED" || code === "ADMIN_PREAUTH_REQUIRED" || /expired|required/i.test(err.message)) …
else setError(err.status === 401 ? "Code invalide." : …);
```

Le serveur servait déjà le bon code (A146) ; l'écran ne le lisait pas et rangeait tout 401 sous « Code invalide. ».

## Tests

`apps/e2e` : **339 scénarios** (332 + 7). Plateforme inchangée (1000 + auth 230). Typecheck admin-ui et harnais verts.


---

# Cahier 02-ADMIN, § 4.2, § 4.3 et § 5.1 : sessions, permissions, accueil — et trois gardes serveur resserrées

*(PR `chore/recette-admin-4-2`, empilée sur #301, 13/09/2026.)*

## Ce qui a été fait

Trois chapitres du back-office, 17 scénarios : les sessions (ADM-SEC-7 à 10), la matrice des permissions profil par
profil (ADM-PRM-0 à 9) et l'accueil (ADM-ACC-1 à 3). Trois anomalies trouvées, trois closes (`ANO-ADM-02`, `03`, `04`).

```
apps/e2e/src/admin/adm-sec-sessions.spec.ts         § 4.2 — deux vraies sessions, TTL Redis lus, 46 min d'attente réelle
apps/e2e/src/admin/adm-prm-profils.spec.ts          § 4.3 — menu = contrat = cahier, un geste réussi, des refus serveur
apps/e2e/src/admin/adm-prm-garde-serveur.spec.ts    § 4.3 — chaque route admin × chaque compte (routeurs LUS)
apps/e2e/src/admin/adm-acc-accueil.spec.ts          § 5.1 — écran = API = cahier, et base pour les tuiles polluées
apps/e2e/src/pages/ecran-admin.ts                   NOUVEAU — tuilesDeLaSection, attendreLeChargement, lireCoteServeur
apps/e2e/src/fixtures/yamba.ts                      la sonde de session admin renouvelle un jeton à < 5 min de sa fin
packages/middleware/session-revocation.ts           ANO-ADM-04 — adminSessionKey, isAdminSessionRevoked (échec fermé)
packages/middleware/isAdminAuthenticated.ts         ANO-ADM-04 — la session du jeton existe-t-elle encore ?
apps/auth-service/src/controller/admin-auth.controller.ts   ANO-ADM-04 — le jeton d'accès porte le jti
apps/auth-service/src/services/platform-settings.service.ts ANO-ADM-02 — « rien à remettre » ne masque plus un refus
packages/libs/api-contracts/src/admin/admin-users.schema.ts ANO-ADM-03 / A153 — users.read ouvert à PRIVACY
apps/admin-ui/src/lib/permissions.ts                        miroir front de la même matrice
packages/libs/prisma/scripts/seed-deals.ts          la relance du versement en échec posée à +23 h
nx.json                                             packages/**, schéma Prisma et tsconfig.base.json en sharedGlobals
```

## ANO-ADM-04 : révoquer une session admin doit couper l'accès, pas seulement le renouvellement

Avant : « Révoquer » (page Mes sessions) supprimait l'enregistrement `admin_jti:<userId>:<jti>` dans Redis. Le
**renouvellement** échouait donc bien, mais le **jeton d'accès** (un JWT signé, valable 15 minutes) ne portait aucun
identifiant de session : `isAdminAuthenticated` le vérifiait par sa signature seule. Un navigateur volé gardait la main
jusqu'à un quart d'heure après la révocation. La fiche ADM-SEC-10 le prouve : `GET /admin/kpis` avec le jeton de la
session révoquée répondait **200**.

Correction en trois points :

```ts
// admin-auth.controller.ts — à l'ouverture ET au renouvellement, le jeton d'accès porte le jti de sa session
jwt.sign({ id: user.id, jti, roles: user.roles, adm: true, amr: ["pwd", "totp"], … }, ACCESS_TOKEN_SECRET, { expiresIn: "15m" });

// session-revocation.ts — UNE seule définition de la clé, importée par l'écrivain (auth-service) ET le lecteur (middleware)
export const adminSessionKey = (userId: string, jti: string): string => `admin_jti:${userId}:${jti}`;

export function isAdminSessionRevoked(jti: string | undefined | null, exists: number | null): boolean {
  if (!jti) return false;          // jeton émis avant la correction : il expire seul en 15 min
  if (exists === null) return true; // Redis muet → REFUS (échec fermé)
  return exists === 0;
}
```

Pourquoi l'échec **fermé**, alors que la plateforme membre (`isSessionRevoked`) échoue **ouvert** ? Côté membre, une
panne de Redis déconnecterait des milliers d'utilisateurs. Côté back-office, il y a une poignée de comptes à fort
pouvoir, et leur renouvellement dépend déjà de Redis : refuser l'accès pendant la panne coûte peu, laisser passer une
session révoquée coûterait beaucoup. La fonction de décision est **pure** (elle reçoit le résultat de `redis.exists`,
ou `null` si l'appel a levé) : on la teste sans Redis.

## ANO-ADM-02 : « rien à remettre » ne doit pas masquer « tu n'as pas le droit »

`POST /admin/settings/reset` n'est gardé que par `settings.read` (tous les profils lisent les paramètres) ; la portée
d'écriture se vérifie ensuite, clé par clé, **sur les clés qui changent**. Or, si toutes les clés visées valaient déjà
leur défaut, la liste des changements était vide et le service répondait `400 NOTHING_TO_RESET` **avant** de
vérifier la portée. Un Médiateur recevait donc « rien à faire » là où il devait recevoir « refusé ». Ce n'est pas une
faille (rien n'est écrit), mais un refus qui se déguise en succès vide trompe l'écran et le testeur.

```ts
if (changes.length === 0) {
  const peutEcrire = keys.some((key) => adminRolesAllow(actor.roles, settingDefinition(key)!.scope === "BUSINESS" ? "settings.business.write" : "settings.operations.write"));
  if (!peutEcrire) assertScopes(actor, keys);   // 403 : aucune des clés visées n'est à sa portée
  throw new ValidationError("Nothing to reset: …", { code: "NOTHING_TO_RESET" });
}
```

La fiche ADM-PRM-2 le prouve aussi par la voie forte : le super administrateur **modifie** réellement la commission, le
Médiateur tente de la remettre par défaut (403) et la valeur **reste** ; le super administrateur la rétablit dans un
`finally`.

## ANO-ADM-03 / A153 : le profil PRIVACY ne pouvait pas atteindre ses propres gestes

L'export nominatif et l'effacement RGPD vivent sur `/users` et `/users/:id`, tous deux gardés par `users.read`, que
PRIVACY n'avait pas. La décision A153 ouvre la **lecture** (le contrat et son miroir front), rien d'autre. La matrice
vit en deux exemplaires (`admin-users.schema.ts` côté serveur, `apps/admin-ui/src/lib/permissions.ts` côté écran) :
la fiche **ADM-PRM-0** lit les deux fichiers et exige qu'ils soient identiques. Une divergence cacherait un bouton
autorisé ou montrerait un bouton refusé, sans qu'aucun test unitaire ne le voie.

## ADM-PRM-9 : la matrice générée depuis le code

Plutôt qu'une dizaine de routes choisies à la main, la fiche **lit les quatre routeurs** avec une expression
régulière (`router.<verbe>("/admin/…", …, requireAdminPermission("…"))`), puis appelle chaque route avec chacun des
sept comptes :

- permission absente → exige `403` **et** `details.code = "ADMIN_PERMISSION_DENIED"` **et** la permission nommée ;
- permission présente → interdit ce 403-là (un 400 ou un 404 sur un identifiant inexistant est normal).

Deux sécurités : tous les identifiants sont un ObjectId valide que rien ne porte, et une **écriture sans identifiant**
(réinitialiser, poser la maintenance, inviter) n'est appelée que par un compte à qui elle est refusée. Une route
ajoutée demain est éprouvée sans toucher la fiche. Garde du garde : moins de 50 routes lues = la lecture a cassé.

## ADM-SEC-8 et 9 : la durée de vie d'une session, prouvée par Redis

- **SEC-8** (45 min d'inactivité) se joue en vrai : la fiche lit le TTL de `admin_jti:…`, ferme l'onglet
  (`about:blank`, une page qui se rafraîchit seule fausserait l'inactivité), attend 46 minutes, constate que la clé
  a expiré d'elle-même, puis que l'écran renvoie à `/login` et que le journal n'a **rien** écrit.
- **SEC-9** (12 h de vie absolue) ne tient pas dans une journée. Ses deux substituts sont prouvés : le TTL d'une
  session neuve vaut 45 min, le renouvellement fait tourner le `jti` en conservant `createdAt`. Puis une **manœuvre
  consignée** vieillit la session à 11 h 59 dans Redis : le renouvellement suivant ne pose plus qu'un TTL ≤ 60 s ; à
  12 h 01, il répond 401.

## ADM-ACC : trois sources à comparer, pas deux

Chaque tuile de l'accueil est comparée à `GET /admin/kpis` (l'écran dit ce que l'API dit), puis au cahier sur les files
que le jeu d'essai pose exactement (litiges, billets, versements…). Les tuiles que la campagne pollue (comptes créés
par les inscriptions des chapitres web, trajets publiés) sont comptées **à part, en base** (`lireCoteServeur`, un
script `tsx` qui imprime une ligne `@@<json>`) : un écart au cahier y est une donnée, pas un défaut. Pour ACC-2, la
liste des tuiles attendues par profil se **déduit** du contrat des permissions, et les compteurs d'un profil sans la
permission doivent être servis à `null` (pas seulement cachés).

**Piège payé sur la fiche ACC-3** : `locator.isVisible({ timeout })` **n'attend pas** — Playwright ignore ce
paramètre et répond immédiatement. Dans une boucle `expect.poll` qui recharge l'accueil, la lecture tombait avant la
réponse de `/admin/alerts` (chargée côté client, après `domcontentloaded`) : la fiche échouait alors que le résumé vert
était bien affiché (capture de l'échec). Remplacé par `locator.waitFor({ state: "visible", timeout })`.

**Second piège, au deuxième passage (PRM-2)** : `navigateurAdmin` rouvre une session mémorisée (`apps/e2e/.sessions/`)
après une sonde `GET /admin/me`. La sonde a répondu 200 ; le cookie `admin_access_token` (`maxAge` 15 min) a expiré
quelques secondes plus tard ; l'appel suivant est parti **sans cookie** — auth-service : « Admin token missing ». Rien à
voir avec ANO-ADM-04 : la sonde acceptait une session à l'agonie. `sessionAdminVivante` (`apps/e2e/src/fixtures/yamba.ts`)
renouvelle désormais la session si le jeton d'accès expire dans moins de cinq minutes :

```ts
const acces = (await contexte.cookies()).find((c) => c.name === "admin_access_token");
if (acces && acces.expires > 0 && acces.expires - Date.now() / 1000 < MARGE_JETON_ADMIN_S) {
  return (await contexte.request.post(`${api}/auth/admin/refresh`, { timeout: 15_000 })).ok();
}
```

La sonde membre (`sessionMembreVivante`) a la même forme et le même risque ; elle n'a pas été touchée faute d'échec
mesuré.

## Le versement en échec du jeu d'essai partait tout seul

`seed-deals.ts` posait la relance du versement en échec **échue** (`payoutNextRetryAt` = hier). Avec le fournisseur
FAKE et le compte de Thomas prêt, le cron des 5 minutes le relançait… et réussissait : la file « Versements en échec »
se vidait entre le seed et la fiche. La relance est posée à +23 h ; le bouton « Relancer » de l'admin n'attend pas
l'échéance, le chapitre finances garde donc son geste.

## nx.json : un test « vert » en cache après un changement dans `packages/`

`packages/` n'est pas un projet Nx : l'empreinte d'`auth-service:test` ne couvre que `{projectRoot}/**` et les
`sharedGlobals`, si bien qu'une modification de `packages/middleware/session-revocation.ts` risquait de laisser Nx
rejouer le résultat **en cache** d'avant la modification. `packages/**/*`,
`prisma/schema.prisma` et `tsconfig.base.json` rejoignent `sharedGlobals` : toute modification invalide le cache de
tous les projets. Plus de recalculs, mais plus jamais un vert fantôme.

## Tests

- auth-service **235** (230 + 5) : `isAdminSessionRevoked` (clé, présente / absente, sans `jti`, Redis muet) et le
  refus de la remise à zéro par un profil sans portée ; l'assertion PRIVACY rejoint `admin-permissions.spec.ts`.
- `apps/e2e` : **356 scénarios** (339 + 17), les 17 verts sur la pile réelle (deal-service en FAKE) ; les 16 hors
  SEC-8 rejoués une seconde fois, verts, après la correction de la sonde de session.
- Typecheck des six projets vert.


---

# Cahier 02-ADMIN, § 5.2 : les alertes de seuil — piloter une alerte par son seuil

*(PR `chore/recette-admin-5-2`, empilée sur #302, 13/09/2026.)*

## Ce qui a été fait

Quatre fiches (ADM-ALR-1 à 4), conformes, aucun code produit modifié.

```
apps/e2e/src/admin/adm-alr-alertes.spec.ts    4 scénarios en série — seuils posés puis rétablis (finally)
```

## Une alerte sans état se teste par son seuil

`GET /admin/alerts` (deal-service) recalcule neuf règles pures (`ops-alerts.rules.ts`) sur un instantané de la base
(`collectOpsSnapshot`), avec des seuils lus dans `PlatformSettings` à travers un cache de 30 s. Rien n'est stocké : pour
faire apparaître ou disparaître une alerte, on **change son seuil**. Trois outils dans la spec :

```ts
poserSeuils(ctx, { "alerts.payoutFailedHours": 336 }, motif);   // PATCH /admin/settings, seules les clés qui changent
alertesQuand(ctx, (a) => a.length === 0, "…");                  // expect.poll sur /admin/alerts : absorbe le cache de 30 s
retablir(ctx, cles, motif);                                     // dans le finally : défauts lus dans la réponse GET
```

## Mesurer le jeu d'essai AVANT d'écrire la fiche

Une sonde en base (litiges, retenues, renversements, versements en échec, outbox, emails, demandes, dernier trajet) a
montré, avant la première ligne de spec :

- le versement en échec de `bzv-completed-blocked` est **terminé à J−3** : la requête compte les deals dont
  `completedAt` (ou `closedAt`) dépasse le seuil — il franchit donc déjà les 48 h par défaut. Le cahier le croit « en
  échec depuis 24 h » et suppose l'état vide ; `YAMBA-DOC-METIER` (ALR01) attend bien l'alerte au seed. **Le code et la
  doc métier font foi** : l'état vide d'ALR-1 et l'« apparition » d'ALR-2 se jouent en relevant d'abord le seuil à 336 h ;
- les deux litiges sont créés **au moment du seed** et un litige n'est décidable qu'à `createdAt + 72 h` (ou à la réponse
  du Voyageur) : `DISPUTE_UNDECIDED_72H` est infranchissable juste après le seed, même seuil à 1 h ;
- le renversement a `updatedAt` = l'heure du seed : `REVERSAL_OPEN_48H` ne franchit 1 h qu'une heure après le seed ;
- aucune ligne d'outbox non publiée, aucun email en échec, un trajet publié le jour même.

ALR-4 abaisse donc toutes les clés au minimum de leurs bornes et **constate** les règles franchies
(`PAYOUT_FAILED_48H`, `RETENTION_HELD_7D`, `ACCEPTANCE_RATE_LOW_7D` avec taux minimum 100 % sur 90 jours) ; pour les
autres, elle ouvre l'URL de destination du cahier et vérifie le filtre présélectionné (le point de non-régression de
`QueueTable`, qui lit `kind` et `decidable` dans l'URL).

## ALR-2 : la valeur en vigueur, prouvée par un écart volontaire

Le tableau « Seuils utilisés » doit montrer les seuils **en vigueur**, pas les constantes du code. Une valeur par défaut
ne permet pas de distinguer les deux : ALR-1 lit le tableau **pendant que** `payoutFailedHours` vaut 336 et exige
« 336 » (la constante `ALERT_THRESHOLDS.payoutFailedHours` vaut 48).

## ALR-3 : forcer le cron sans le simuler

Le cron horaire (`ops-alerts.cron.ts`, minute 5) appelle `opsAlertsService.notifyNewAlerts(redis)`. La fiche appelle
**la même méthode avec le vrai Redis**, par un script `tsx` (`lireCoteServeur`), après trois précautions :

1. s'écarter de la fenêtre du cron réel (minutes 3 à 7) pour ne pas se disputer la clé ;
2. purger les verrous `yamba:alerts:sent:*:<jour UTC>` du jour — manœuvre consignée dans la sortie ;
3. compter les emails de `support@yamba.app` avant, pour prouver « un » puis « aucun second ».

« Le lendemain » ne s'attend pas : la fiche instancie `makeOpsAlertsService(() => demain)` avec un **magasin en mémoire**
qui contient déjà la clé d'aujourd'hui, et coupe l'envoi réel (`EMAIL_PROVIDER=fake` avant le premier envoi : le
fournisseur est créé paresseusement par `getEmailProvider`). La règle repart ; Mailpit n'a rien reçu de plus.

## Tests

`apps/e2e` : **360 scénarios** (356 + 4), les 4 verts deux fois de suite. Plateforme inchangée (auth 235).


---

# Cahier 02-ADMIN, § 5.3 : utilisateurs — une recherche qui n'échappait pas son terme, un jeu d'essai qui oubliait des compteurs

*(PR `chore/recette-admin-5-3`, empilée sur #303, 13/09/2026.)*

## Ce qui a été fait

Trois fiches (ADM-USR-1 à 3), conformes après deux corrections (`ANO-ADM-05`, `ANO-ADM-06`).

```
apps/e2e/src/admin/adm-usr-utilisateurs.spec.ts        3 scénarios en série — jeu d'essai rejoué avant ET après
apps/auth-service/src/lib/admin-users.query.ts         ANO-ADM-05 — escapeRegex, phoneNeedle, matchedOnFor, textSearchOr
apps/auth-service/src/lib/admin-users.query.spec.ts    +3 tests
apps/auth-service/src/services/admin-users.service.ts  les deux recherches passent par les mêmes fonctions
packages/libs/prisma/scripts/seed-deals.ts             ANO-ADM-06 — compteurs internes remis à zéro au rejeu
```

## ANO-ADM-05 : `contains` est une expression régulière sur MongoDB

Avec le connecteur MongoDB, Prisma traduit `{ contains: t }` en `{ $regex: t }` **sans échapper `t`**. Mesuré en base :

| Terme | Résultat |
|---|---|
| `+33612345601` | 0 compte — le `+` initial est un quantificateur |
| `33612345601` | 1 compte (Thomas) |
| `a.b` | 52 comptes — le `.` vaut n'importe quel caractère |
| `(` | erreur Mongo 51111 → 500 |

Le placeholder de l'écran propose lui-même `+33…` : la recherche par téléphone ne marchait donc jamais sous sa forme
naturelle. Correction : trois fonctions pures, testées sans base.

```ts
export function escapeRegex(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** « +33 6 12 34 56 01 », « 0033612345601 », « 06 12 34 56 01 » → un morceau contenu dans « +33612345601 ». */
export function phoneNeedle(term: string): string | null {
  const digits = term.replace(/[^\d+]/g, "");
  if (digits.length < 6) return null;              // règle C-PR7a inchangée
  const bare = digits.replace(/\+/g, "");
  if (bare.startsWith("00")) return bare.slice(2);
  if (bare.startsWith("0")) return bare.slice(1);  // « 0 » national : « 612345601 » est contenu dans le E.164
  return bare;
}
```

`textSearchOr(term)` construit le `OR` (email, prénom, nom échappés ; téléphone par `phoneNeedle`) pour les **deux**
recherches du service — `searchAdvanced`, appelée par l'écran, et `search`, l'ancienne. Second défaut corrigé au passage :
`searchAdvanced` calculait la mention « via … » avec « email sinon name », jamais « phone » ; `matchedOnFor(row, term)`
est désormais la seule définition.

**Même défaut ailleurs, non corrigé ici** : `apps/trip-service/src/lib/admin-trips.rules.ts` et
`trip-search.controller.ts` (recherche publique). Hors périmètre du chapitre, consigné au rapport pour le § 5.7.

## ANO-ADM-06 : un rejeu qui n'efface que la moitié de l'histoire

`seed-deals.ts` supprime et recrée litiges, deals et avis des comptes du seed, mais les **compteurs dénormalisés** du
document utilisateur (`shipperDisputesLostCount`…) et de la page Voyageur (`disputesLostCount`…) survivaient. Chaque
litige tranché en recette ajoutait donc un litige perdu « pour toujours » : mesuré 2 puis 3 pour Chinwe en trois
passages d'USR-3, score 46 → 56. Au suivant, elle devenait « À risque » et ses réservations étaient plafonnées : les
chapitres web de réservation auraient échoué pour une raison sans rapport. Les deux `upsert` remettent à zéro
litiges perdus et annulations tardives (Expéditeur et Voyageur). Deals terminés et avis ne sont pas touchés : des
écrans des chapitres web les affichent, et le seed ne les a jamais posés.

## USR-2 : deux lignes de journal par ouverture, en développement

La fiche charge `GET /admin/users/:id` dans un `useEffect` ; le contrôleur journalise `USER_VIEWED` à chaque `GET`. En
développement, React 18+ en mode strict **monte deux fois** les effets : deux `GET` (vus dans les logs du gateway, par
paires), deux lignes. La fiche accepte « au moins une par ouverture, rien d'autre » et consigne le chiffre ; le
dédoublonnage serveur est proposé (rapport, « à trancher »).

## USR-3 : le score est une somme bornée

`computeTrustScore` additionne les facteurs puis borne à 0..100. Un crédit (−4 par deal terminé) masqué par le plancher
absorbe une partie des 25 points d'un litige perdu : 0 → 21. La fiche vérifie l'invariant réel — `score =
clamp(Σ facteurs)` et `Δ Σ = Δ facteur litiges` — plutôt que « +25 ».

## Redémarrer un service sous `nx run-many` : piège de poste

Modifier `auth-service` pendant que `nx run-many --target=serve` tourne a déclenché « Recursive task invocation
detected » : la reconstruction a échoué, **l'ancien processus a continué de répondre 200 sur `/health`**. Seul un
compteur (`grep -c escapeRegex dist/main.js`) et le rejeu de la fiche le montraient. Remède utilisé : `nx build
auth-service`, arrêt du processus sur 6001, `node --env-file=../../.env dist/main.js`.

## Tests

- auth-service **238** (235 + 3).
- `apps/e2e` : **363 scénarios** (360 + 3), les 3 verts deux fois de suite après corrections, identiques.
- Typecheck auth-service et harnais verts.


---

# Cahier 02-ADMIN, § 5.4 : sanctions — le statut effectif, un filtre de plus, et un piège de comparaison à null

*(PR `chore/recette-admin-5-4`, empilée sur #304, 14/09/2026.)*

## Ce qui a été fait

Cinq fiches du cahier et deux fiches d'anomalie (7 scénarios), trois anomalies closes (`ANO-ADM-07`, `08`, `09`), cinq
améliorations d'expert implémentées.

```
apps/e2e/src/admin/adm-snc-sanctions.spec.ts                 7 scénarios en série, afterAll = membres remis actifs
packages/middleware/account-status.ts                        NOUVEAU — effectiveAccountStatus, notSuspendedOwnerFilter, activeSanctionFilter
packages/middleware/isAuthenticated.ts                       ANO-ADM-07 — statut effectif
packages/middleware/requireActiveAccount.ts                  ANO-ADM-07 — statut effectif
apps/auth-service/src/controller/auth.controller.ts          ANO-ADM-07 connexion ; ANO-ADM-09 Google + renouvellement
apps/auth-service/src/controller/admin-kpis.controller.ts    ANO-ADM-07 tuiles ; amélioration : escalades comptées
apps/trip-service/src/controllers/trip-search.controller.ts  ANO-ADM-07 — suspension échue = trajets visibles
apps/trip-service/src/lib/public-visibility.rules.ts         ANO-ADM-08 — page publique d'un suspendu : 404
apps/deal-service/src/services/booking-request.ts            ANO-ADM-08 — TRIP_NOT_BOOKABLE si Voyageur suspendu
apps/deal-service/src/services/deal-request.service.ts       ANO-ADM-08 — le trajet charge l'état du Voyageur
apps/admin-ui/src/components/UserFileView.tsx                statut effectif, messages, refus par code, fin de journée, min
apps/auth-service/src/utils/account-status.spec.ts           NOUVEAU — 4 tests
apps/trip-service/src/lib/public-visibility.rules.spec.ts    +1 test ; apps/deal-service/src/services/booking-request.spec.ts +1 test
```

## ANO-ADM-07 : une donnée écrite que personne ne lit

`suspensionUntil` était écrit par `POST /admin/users/:id/suspension`, affiché et envoyé au membre — et lu par l'export
CSV seulement. La méthode de diagnostic tient en une commande : chercher **tous les lecteurs** d'un champ (`grep -rn
suspensionUntil apps packages`) avant de jouer la fiche. Le correctif respecte D56 (« une sanction agit par lecture,
jamais par écriture croisée ») : pas de cron qui remettrait `ACTIVE`, une **règle pure** que chaque garde lit.

```ts
// packages/middleware/account-status.ts
export function effectiveAccountStatus(u: SanctionState, now: Date = new Date()): AccountStatus {
  const status = (u.accountStatus ?? "ACTIVE") as AccountStatus;
  if (status === "ACTIVE" || sanctionExpired(u, now)) return "ACTIVE";
  return status;
}
```

Les gardes (`isAuthenticated`, `requireActiveAccount`, connexion) lisent `effectiveAccountStatus(user)`. Les **requêtes**
ne peuvent pas appeler une fonction : elles reçoivent son équivalent en filtre Prisma, écrit à côté et testé contre la
même intention (`notSuspendedOwnerFilter` pour la recherche et la page publique, `activeSanctionFilter` pour les tuiles).

## Le piège : `lte` sur une date nulle, dans un filtre de relation

Premier rejeu après correction : les trajets de Thomas, suspendu **sans** date de fin, revenaient dans la recherche. Une
sonde sur la base a isolé la cause :

```
user: { is: { accountStatus: { not: "SUSPENDED" } } }                                   → 0 trajet (attendu)
user: { is: { OR: [{ accountStatus: { not: "SUSPENDED" } }, { suspensionUntil: { lte: now } }] } } → 3 trajets
user: { is: { suspensionUntil: { lte: now } } }  (suspensionUntil = null)                → 3 trajets
```

Un filtre de relation Prisma sur Mongo s'exécute dans un pipeline d'agrégation (`$lookup` puis `$expr`), où la comparaison
suit l'**ordre BSON** : `null` est inférieur à toute date, donc `null <= now` est vrai. Remède mesuré sur les quatre cas :

```ts
{ suspensionUntil: { lte: now, gt: EPOCH } }   // null : 0 · absent : 0 · fin à venir : 0 · fin passée : visibles
```

C'est le cousin des pièges déjà gravés au CLAUDE.md (`field: null` ne matche pas un champ absent) : ici, c'est l'inverse,
une borne supérieure matche un `null`. Toute comparaison de date optionnelle dans un filtre de relation doit porter sa
borne basse.

## ANO-ADM-08 : un filtre de lecture doit couvrir toutes les portes

La suspension retirait les trajets de la **recherche** (`buildBaseWhere`), mais la **page publique** (`publicTripWhere`)
et la **réservation** (`checkTripBookable`) ne connaissaient que « publié, non supprimé, non masqué ». Deux corrections :

```ts
// trip-service — public-visibility.rules.ts
return { id, status: "PUBLISHED", isDeleted: false, AND: [notHiddenFilter()], user: { is: notSuspendedOwnerFilter(now) } };

// deal-service — booking-request.ts (TRIP_SELECT charge user.accountStatus / suspensionUntil)
if (trip.user && effectiveAccountStatus(trip.user, now) === "SUSPENDED") {
  throw new BookingRequestError("TRIP_NOT_BOOKABLE", "This trip is not open to requests.");
}
```

Même code, même message qu'un trajet fermé : l'Expéditeur n'apprend pas que le Voyageur est sanctionné (403 vs 404, règle
non négociable).

## ANO-ADM-09 : trois portes d'entrée, une seule vérifiée

`login` refusait un compte suspendu ; `googleSignIn` et `refreshAuthTokens` non. Les deux lisent maintenant
`effectiveAccountStatus` ; la connexion Google refuse **avant** `issueSession` (aucun cookie posé).

## Améliorations faites (UserFileView.tsx, admin-kpis.controller.ts)

- `refusDeSanction(e)` lit `details.code` (A146) : cinq codes traduits, message anglais en repli.
- Messages de résultat nommant le geste, la date et l'email envoyé.
- `finDeJournee(jour)` : `new Date("2026-09-20T23:59:59")` (heure locale de l'écran) au lieu de `new Date("2026-09-20")`
  (minuit **UTC** — une chaîne date seule est lue en UTC par la spécification ECMAScript, une chaîne date-heure sans
  fuseau en heure locale) ; `min` = demain sur le champ.
- Badge « Actif (sanction échue) » calculé depuis `suspension.until`.
- Tuile « Sanctions proposées » : `suspensionProposedAt: { not: null }` sans condition sur le statut.

## Poste

auth-service, trip-service et deal-service tournent **en bundle, détachés** (`nohup … node --env-file=../../.env
dist/main.js`, deal-service avec `STRIPE_SECRET_KEY=` pour le fournisseur FAKE). Piège vécu : après `nx build`, un
bundle déjà lancé garde l'ancien code en mémoire (`grep -c EPOCH dist/main.js` = 4, mais le processus ne l'avait pas) —
toujours relancer le processus après la reconstruction ; et la reconstruction sous `nx run-many serve` a fait tomber
trip-service sur 6002.

## Tests

- auth-service **242** (238 + 4) · trip-service **262** (261 + 1) · deal-service **578** (577 + 1).
- `apps/e2e` : **370 scénarios** (363 + 7), les 7 verts deux fois de suite.
- Typecheck auth-service, trip-service, deal-service, admin-ui et harnais verts.


---

# Cahier 02-ADMIN, § 5.5 : la liste de suppression d'adresses — une règle partagée, une levée motivée, une concurrence sans 500

*(PR `chore/recette-admin-5-5`, empilée sur #305, 14/09/2026.)*

## Ce qui a été fait

```
packages/libs/email/src/recipient.ts                 NOUVEAU — canReceiveEmail, reachableRecipientWhere, suppressionReasonLabel
packages/libs/email/src/index.ts                     export de recipient
packages/libs/prisma/write-conflict-retry.ts         NOUVEAU (remonté de deal-service) — withWriteConflictRetry
apps/deal-service/src/lib/write-conflict-retry.ts    ré-export (imports et tests inchangés)
apps/trip-service/src/lib/carrier-mailer.ts          NOUVEAU — ANO-ADM-10 : makeCarrierMailer (+ spec, 5 tests)
apps/trip-service/src/controllers/admin-trips.controller.ts   emailCarrier = makeCarrierMailer(…)
apps/auth-service/src/services/email-suppression.service.ts   NOUVEAU — A155 : levée motivée, conditionnelle, rejouée (+ spec, 5 tests)
apps/auth-service/src/controller/admin-users.controller.ts    unsuppressEmail délègue au service
apps/auth-service/src/services/platform-settings.service.ts   ANO-ADM-11 : destinataires joignables (+ 1 test)
apps/auth-service/src/controller/admin-status.controller.ts   ANO-ADM-11 : idem (email de maintenance)
packages/libs/api-contracts/src/admin/admin-users.schema.ts   UnsuppressEmailRequestSchema (≥ 20)
apps/auth-service/src/openapi/build-openapi.ts + apps/*/openapi.json   corps et 400 documentés, contrats régénérés
apps/admin-ui/src/components/UserFileView.tsx        formulaire de levée, plainte, refus par code, message nommé
apps/notification-service/src/lib/email-recipient.spec.ts    4 tests de la règle partagée
apps/e2e/src/admin/adm-eml-suppression.spec.ts       4 scénarios en série
```

## Une règle écrite six fois finit par être oubliée deux fois

D35 4A dit : « chaque résolveur de destinataire respecte `emailSuppressedAt` comme `isDeleted` ». Avant ce chapitre,
chaque service réécrivait son test (`if (!u?.email || u.isDeleted || u.emailSuppressedAt)` dans notification-service,
message-service, trip-service, deal-service, auth-service…). Un audit des appelants de `sendTransactionalEmail` /
`sendAuthEmail` en a trouvé deux qui l'avaient oublié : `emailCarrier` (trip-service, ANO-ADM-10) et les destinataires
super administrateurs (auth-service, ANO-ADM-11). La règle devient une fonction pure de `@packages/email` :

```ts
export function canReceiveEmail(u: EmailRecipientCandidate | null | undefined): boolean {
  if (!u || !u.email || !u.email.trim()) return false;
  if (u.isDeleted) return false;
  return !u.emailSuppressedAt;
}
/** À combiner sous AND : un OR de l'appelant n'est jamais écrasé. */
export function reachableRecipientWhere() {
  return { isDeleted: false, OR: [{ emailSuppressedAt: null }, { emailSuppressedAt: { isSet: false } }] };
}
```

Pourquoi `AND: [reachableRecipientWhere()]` plutôt qu'un étalement (`...reachableRecipientWhere()`) ? Parce que le
fragment contient un `OR` (piège Mongo : `null` ne voit pas un champ absent) ; étalé dans une requête qui a déjà son
`OR`, l'un écraserait l'autre en silence. Les anciens résolveurs corrects n'ont pas été réécrits (aucune valeur ajoutée,
risque réel) : la règle sert aux nouveaux et aux corrigés.

## `emailCarrier` testable : injecter ce qui touche le monde

L'ancienne fonction lisait Prisma, testait `isEmailConfigured` et envoyait, dans un contrôleur non testé. Elle devient une
fabrique à dépendances injectées qui rend un **résultat nommé** (`SENT`, `NOT_CONFIGURED`, `NO_ACCOUNT`,
`UNREACHABLE`, `FAILED`) et journalise les deux cas silencieux :

```ts
const emailCarrier = makeCarrierMailer({
  isConfigured: isEmailConfigured,
  findUser: (userId) => prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, email: true, preferredLocale: true, isDeleted: true, emailSuppressedAt: true } }),
  send: (mail) => sendTransactionalEmail(mail),
  log: (message) => console.error(message),
});
```

## A155 : lever une suppression, motivé, conditionnel, rejoué

Trois défauts de la levée, mesurés en recette : aucun motif (une plainte levée sans raison écrite), une erreur avalée par
le bouton (`try { … } finally`), et **un 500** quand deux administrateurs lèvent en même temps — MongoDB rejette la
transaction perdante (`P2034`, « Transaction failed due to a write conflict »). Le service :

```ts
const parsed = UnsuppressEmailRequestSchema.safeParse(body ?? {});          // 400 REASON_REQUIRED
await withWriteConflictRetry(() => db.$transaction(async (tx) => {
  const r = await tx.user.updateMany({ where: { id: user.id, emailSuppressedAt: suppressedAt }, data: { emailSuppressedAt: null, emailSuppressedReason: null } });
  if (r.count === 0) throw new ValidationError("This address is not suppressed.", { code: "EMAIL_NOT_SUPPRESSED" });
  await record(tx, { action: "EMAIL_SUPPRESSION_LIFTED", before: { emailSuppressedAt, reason }, after: { emailSuppressedAt: null, liftReason }, … });
}));
```

L'`updateMany` conditionnel sur la date **lue** est la garde ; le réessai transforme le conflit d'infrastructure en
réponse métier : au second essai, l'autre a levé, `count` vaut 0, le perdant reçoit 400 et le journal n'a qu'une ligne.
`withWriteConflictRetry` existait déjà dans deal-service (ANO-API-19) ; il est remonté dans `packages/libs/prisma` —
deal-service garde un ré-export d'une ligne pour ne toucher à aucun import.

`after.liftReason` (et non `after.reason`) : `before.reason` est déjà le motif **du fournisseur** (`HARD_BOUNCE`,
`COMPLAINT`) ; réutiliser le nom mélangerait deux informations dans le journal.

## L'écran : le message doit survivre au rechargement

Le formulaire de levée vit **dans** le bandeau ; quand la levée réussit — ou qu'un autre onglet l'a déjà faite — la fiche
se recharge et le bandeau disparaît, emportant tout message local. Le message passe donc au niveau de la fiche
(`flash`, déclaré avec les autres `useState` **avant** les `return` anticipés : l'ordre des hooks ne doit pas dépendre du
chargement).

## Le harnais : signer un webhook comme le fournisseur

```ts
const corps = JSON.stringify(evenement);                 // compact : ce qui est signé est ce qui est envoyé
const s = signer(corps);                                 // svixSign(RESEND_WEBHOOK_SECRET, id, ts, corps) côté serveur (tsx --env-file)
await ctx.request.post(`${adresseDeLApi()}/webhooks/email/resend`, { headers: { "svix-id": s.id, "svix-timestamp": s.ts, "svix-signature": s.signature }, data: corps });
```

Le secret n'entre jamais dans le processus Playwright : la signature est calculée par un script `tsx` qui lit le `.env`.

## Tests

- auth-service **248** (242 + 6), trip-service **267** (262 + 5), notification-service **119** (115 + 4), deal-service
  **578** (inchangé ; un passage parallèle a expiré sur `deal-transport.service.spec.ts` sous charge, vert isolé et au
  passage complet suivant).
- `apps/e2e` : **374 scénarios** (370 + 4), les 4 verts deux fois de suite.
- Typecheck auth, trip, deal, notification, message, gateway, admin-ui et harnais verts ; contrats OpenAPI régénérés.


---

# Cahier 02-ADMIN, § 5.6 : les exports CSV — prouver le fichier, pas le bouton

*(PR `chore/recette-admin-5-6`, empilée sur #306, 14/09/2026.)*

## Ce qui a été fait

Quatre fiches (ADM-EXP-1 à 4), conformes, trois anomalies closes (`ANO-ADM-12` bloquante, `13`, `14`), une décision
(A156).

```
packages/libs/csv/index.ts                              csvCell (nombres non neutralisés), EXPORT_MAX_ROWS, capExportRows, csvResponseHeaders
apps/trip-service/src/lib/csv-export.spec.ts            NOUVEAU — 5 tests de la bibliothèque (packages/ n'a pas de projet de test)
apps/trip-service/src/lib/admin-trips.rules.ts          ANO-ADM-12 — TICKETS_CSV_COLUMNS sans originalName, fileExtensionOf (+ 2 tests)
apps/trip-service/src/controllers/admin-trips.controller.ts   exports trajets et billets : plafond + troncature dite
apps/auth-service/src/services/admin-users.service.ts   exportRows rend { rows, truncated }
apps/auth-service/src/controller/admin-users.controller.ts    journal truncated, en-têtes communs
apps/deal-service/src/controllers/admin-dispute.controller.ts  idem + INVALID_QUERY porte son code (A146)
apps/deal-service/src/services/admin-finance.rules.ts   ANO-ADM-14 — réexporte csvCell (test étendu)
apps/admin-ui/src/lib/api.ts                            ANO-ADM-13 — downloadFile (fetch + rafraîchissement + lien download)
apps/admin-ui/src/components/ExportButton.tsx           refus par code, compteur du motif, lignes / troncature annoncées
apps/e2e/src/admin/adm-csv-exports.spec.ts              4 scénarios
```

## ANO-ADM-12 : un champ libre n'est pas un identifiant

D60 2A promettait des exports opérationnels « identifiants seulement ». La colonne `originalName` de l'export des
billets était pourtant le nom du fichier **tel que le membre l'a déposé**. Une sonde en base a trouvé
« sfr-facture-0752426937-0.pdf » : un numéro de téléphone dans un export qu'un Médiateur ou un profil Finance télécharge
sans motif. La colonne devient `fileExtension` :

```ts
export function fileExtensionOf(name: string | null | undefined): string {
  const m = /\.([A-Za-z0-9]{1,5})$/.exec((name ?? "").trim());
  return m ? m[1].toLowerCase() : "";   // « nom.0612345678 » → "" : dix chiffres ne sont pas une extension
}
```

A156 généralise : une colonne d'export opérationnel est un identifiant, une énumération, une date, un montant ou une
ville du référentiel — jamais un champ libre.

## ANO-ADM-13 : un onglet ouvert sur une URL ne sait pas rafraîchir une session

`ExportButton` faisait `window.open(apiUrl(path))`. Le cookie `admin_access_token` vit 15 minutes ; passé ce délai,
l'onglet partait avec le seul cookie de renouvellement, recevait **401** et affichait le JSON brut. Aucun code client
ne tournait dans cet onglet pour appeler `/auth/admin/refresh`. Même chose pour un 400 ou un 403. `downloadFile` :

```ts
let res = await attempt();
if (res.status === 401 && (await tryRefresh())) res = await attempt();   // le même rafraîchissement qu'apiFetch
if (!res.ok) throw new ApiError(message, res.status, data);             // ExportButton le traduit par details.code
const url = URL.createObjectURL(await res.blob());                       // puis un <a download> cliqué
```

Le nom vient de `Content-Disposition`, le nombre de lignes de `X-Row-Count`, la troncature de `X-Truncated`
(`Access-Control-Expose-Headers` les rend lisibles même hors du proxy de même origine).

## Une seule bibliothèque, et une troncature qui se dit

- **ANO-ADM-14** : `admin-finance.rules.ts` avait sa propre `csvCell`, sans `\t` ni `\r` dans les préfixes neutralisés.
  Elle réexporte désormais `@packages/libs/csv`.
- **Un nombre n'est pas une formule** : l'ancienne `csvCell` convertissait tout en chaîne avant de tester le premier
  caractère, `-500` devenait `'-500`, un texte dans le tableur. Seules les chaînes sont neutralisées.
- **La troncature** : chaque export lit `EXPORT_MAX_ROWS + 1` lignes et passe par `capExportRows`, qui sait s'il en
  restait sans compter la collection. `truncated` va au journal et dans `X-Truncated` ; l'écran affiche « Export
  tronqué à 5 000 lignes : affine les filtres ».

## La spec : prouver le fichier

- **Téléchargé par l'écran**, puis relu : `dl.path()` → `Buffer` (les trois octets du BOM), puis un parseur RFC 4180
  de trente lignes dans la spec (guillemets doublés, virgules et retours ligne encadrés).
- **Filtres écran = fichier** : la fiche capture l'URL de la requête que la page envoie à la liste
  (`page.waitForResponse`), retire le curseur, relit toutes les pages à `limit=100`, et compare les ensembles
  d'identifiants.
- **Fouille** : expressions email et téléphone (`\b0[1-9](?:[ .-]?\d{2}){4}\b`, `(?:\+|\b00)\d{8,14}\b`) vérifiées
  d'abord sur le nom mesuré (détecté) et sur un ObjectId et une date ISO (ignorés).
- **Contre-épreuves** : formule posée en base sur le nom de Thomas, nom piégé sur le billet en attente, cookie
  `admin_access_token` retiré (`contexte.clearCookies({ name })`) avec la preuve du 401 que montrait l'onglet ; toutes
  défaites en `finally`.
- **Refus simulé** (EXP-4) : `page.route("**/admin/disputes/export**", …)` rend un 403 à la frontière réseau ; la fiche
  vérifie le message, et qu'aucun `download` ni aucune page ne s'est ouvert.

## Tests

- trip-service **274** (+7 : bibliothèque CSV ×5, `fileExtensionOf` et colonnes ×2) ; deal-service 578 (test Finances
  étendu) ; auth-service 248.
- `apps/e2e` : **378 scénarios** (374 + 4), les 4 verts deux fois de suite.
- Typecheck auth, trip, deal, admin-ui (tsc) et harnais verts.


---

# Cahier 02-ADMIN, § 5.7 : les trajets — une regex qu'on n'avait pas écrite, un état que le temps change, deux clics en même temps

*(PR `chore/recette-admin-5-7`, empilée sur #307, 14/09/2026.)*

## Ce qui a été fait

Sept scénarios (ADM-TRJ-1 à 5, plus deux fiches de preuve), quatre anomalies closes (`ANO-ADM-15` à `18`), un défaut de
concurrence clos, une décision au registre (**A157**).

```
packages/libs/prisma/text-search.ts                         NOUVEAU — escapeRegex, containsText, equalsText
apps/trip-service/src/lib/admin-trips.rules.ts              filtres échappés ; effectiveTicketStatus ; borne ticketPending
apps/trip-service/src/controllers/trip-search.controller.ts recherche publique et facettes échappées
apps/trip-service/src/controllers/admin-trips.controller.ts statut effectif ; masquer / rétablir / proposer conditionnels + réessai
apps/trip-service/src/emails/admin-trip-emails.ts           bouton « Voir mon trajet » dans l'email de masquage
apps/auth-service/src/controller/saved-route.controller.ts  contrôle de doublon des alertes route échappé
apps/auth-service/src/lib/admin-users.query.ts              réexporte escapeRegex partagé
apps/admin-ui/src/lib/format.ts                             libellés statut / mode / réservation / billet expiré
apps/admin-ui/src/components/TripsList.tsx                  q et villes lus dans l'URL, statuts en français
apps/admin-ui/src/components/TripFileView.tsx               carte Masquage : messages nommés, refus par code, conflit d'intérêts
apps/trip-service/src/lib/text-search.spec.ts               NOUVEAU (5 tests) · admin-trips.rules.spec.ts (+3)
apps/e2e/src/admin/adm-trj-trajets.spec.ts                  7 scénarios
```

## ANO-ADM-15 : Prisma n'échappe pas ce qu'il transforme en regex

Le connecteur MongoDB de Prisma n'a pas d'opérateur « contient » natif : il construit un `$regex` avec la valeur telle
quelle. Une sonde de sept requêtes l'a établi avant d'écrire la moindre ligne :

```
equals "(" insensible      → erreur « Kind: … Raw query failed »     (Mongo refuse la regex)
equals "P.ris" insensible  → 20                                        (« . » = n'importe quel caractère)
contains "."               → 41 sur 41
contains "\\."             → 0                                         (échappé : pris à la lettre)
```

La recherche publique (`trip-search.controller.ts`) passait la saisie du champ « Départ » directement dans `contains` :
un visiteur qui tapait « ( » recevait **500**, et ses facettes aussi. La même construction existait dans la liste admin
des trajets, la file des billets (villes, par la relation) et le contrôle de doublon des alertes route (`equals`
insensible = regex ancrée). Au § 5.3, auth-service avait déjà corrigé sa recherche d'utilisateurs avec une fonction
locale ; elle devient le module partagé, sans aucune dépendance :

```ts
// packages/libs/prisma/text-search.ts
export function escapeRegex(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
export function containsText(term: string) { return { contains: escapeRegex(term), mode: "insensitive" as const }; }
export function equalsText(term: string)   { return { equals: escapeRegex(term), mode: "insensitive" as const }; }
```

Il vit sous `packages/libs/prisma` parce que c'est un contrat **du connecteur Prisma-Mongo**, pas d'un domaine ; l'alias
générique `@packages` des `webpack.config.js` le résout déjà, aucun alias à ajouter. Au-delà du 500, une regex fournie
par un visiteur est une attaque par retour arrière catastrophique en puissance (`(a+)+$` sur une chaîne longue) : le test
unitaire le prouve inerte une fois échappé.

## ANO-ADM-16 : un état que le temps a changé se calcule à la lecture

Un trajet porte `ticketVerificationStatus`, une pièce porte `status`. Quand la file des billets voit une pièce en attente
d'un trajet déjà parti, elle la passe `EXPIRED` (8A) — mais personne ne réécrit le trajet. Résultat mesuré : 5 trajets
partis depuis avril à juin, toutes pièces `EXPIRED`, toujours « à vérifier ». Plutôt qu'un cron ou qu'une écriture de
plus dans la file, la lecture calcule l'état effectif, comme pour la sanction échue (A154) :

```ts
export function effectiveTicketStatus(trip, now) {
  return trip.ticketVerificationStatus === "PENDING" && isTicketExpired(trip, now) ? "EXPIRED" : trip.ticketVerificationStatus;
}
// buildTripsWhere(q, now) — ticketPending=1 : départ >= maintenant, sans écraser une borne `from` plus tardive
departure.gte = new Date(Math.max(departure.gte?.getTime() ?? 0, now.getTime()));
```

`buildTripsWhere` reçoit désormais `now` en paramètre (valeur par défaut `new Date()`) : la règle reste pure et testable
à date fixe.

## Masquer, rétablir, proposer : écrire sous condition

La garde « déjà masqué ? » était une **lecture** avant l'écriture : deux administrateurs qui cliquent en même temps la
passent tous les deux. Mesuré (fiche ADM-TRJ-4 bis, `Promise.all`) : un 200 et un **500** — MongoDB a rejeté la seconde
transaction (P2034) ; sans ce rejet, on aurait eu deux lignes `TRIP_HIDDEN` et deux emails. Correction, dans les trois
gestes :

```ts
await withWriteConflictRetry(() => prisma.$transaction(async (tx) => {
  const r = await tx.trip.updateMany({ where: { id, ...notHiddenFilter() }, data: { hiddenByAdminAt: now, … } });
  if (r.count !== 1) throw new ValidationError("This trip is already hidden.", { code: "TRIP_ALREADY_HIDDEN" });
  await recordAdminAction(tx, { action: "TRIP_HIDDEN", … });
}));
```

`updateMany` renvoie le nombre de documents modifiés : c'est lui qui dit si l'état attendu était encore vrai au moment
de l'écriture. `notHiddenFilter()` couvre `null` ET champ absent (piège Mongo). `withWriteConflictRetry`
(`packages/libs/prisma`, § 5.5) rejoue la transaction rejetée : au second essai, `count` vaut 0 et le perdant reçoit un
400 lisible. Le même garde ferme **ANO-ADM-17** : proposer un masquage sur un trajet masqué est refusé, sinon la
proposition, invisible pendant le masquage, ressurgissait au rétablissement. Une proposition qui en remplace une autre
écrit l'ancienne en `before` au journal.

## Carte « Masquage » : ce que l'écran dit après le geste

- Le motif part **vide** : pré-rempli avec la proposition du Support, il était journalisé comme motif de rétablissement
  par un Médiateur qui ne l'avait pas écrit.
- Les messages nomment le geste et ses suites (« Trajet masqué : retiré de la recherche et de sa page publique, Voyageur
  prévenu par email. 1 réservation(s) en cours continue(nt). ») ; les refus sont lus par `details.code` (A146) et, sur un
  conflit, la fiche est rechargée.
- Sur son propre trajet, la carte dit le conflit d'intérêts au lieu de « Ton profil ne propose ni n'exécute de masquage ».

## Tests

- trip-service **282** (+8 : `text-search.spec.ts` ×5 dont email de masquage FR/EN, `admin-trips.rules.spec.ts` ×3) ;
  auth-service 248 (inchangé, sa suite `admin-users.query.spec.ts` passe sur la fonction partagée).
- `apps/e2e` : **385 scénarios** (378 + 7), les 7 verts deux fois de suite.
- Typecheck trip, auth (tsc), admin-ui, harnais verts ; contrats OpenAPI inchangés.


---

# Cahier 02-ADMIN, § 5.8 : les billets à vérifier — un badge qui se déduit au lieu de s'écrire

*(PR `chore/recette-admin-5-8`, empilée sur #308, 14/09/2026.)*

## Ce qui a été fait

Huit fiches (ADM-BIL-1 à 4 du cahier, 5 à 8 ajoutées), trois anomalies closes (`ANO-ADM-19`, `20`, `21`), une décision
(A158), et des améliorations d'écran.

```
apps/trip-service/src/lib/ticket-status.rules.ts        NOUVEAU — synthèse du statut, faits vérifiés, trajet décidable
apps/trip-service/src/lib/ticket-status.rules.spec.ts   NOUVEAU — 8 tests
apps/trip-service/src/lib/admin-trips.rules.ts          buildTicketsWhere (décidables), departedTicketsWhere (+ 2 tests)
apps/trip-service/src/controllers/admin-trips.controller.ts   file, décision (ordre des gardes, synthèse, retry)
apps/trip-service/src/controllers/trip.controller.ts    syncTripTicketStatus au dépôt / à la suppression, faits changés
apps/admin-ui/src/components/TicketsQueue.tsx           refus par code, sa propre carte, occupé, mode et type de fichier
apps/admin-ui/src/components/TripFileView.tsx, lib/format.ts   documents en français
apps/e2e/src/admin/adm-bil-billets.spec.ts              8 scénarios en série
```

## Un champ dérivé ne s'écrit pas, il se recalcule

`Trip.ticketVerificationStatus` est **dénormalisé** : la recherche publique filtre dessus (`verifiedTicket`) et le DTO
public en tire `ticketVerified`. Tant qu'il était **écrit** par chaque geste (« la décision vaut VERIFIED », « le dépôt
vaut PENDING si le trajet était NOT_SUBMITTED ou REJECTED », « la suppression vaut NOT_SUBMITTED s'il ne reste aucun
billet »), il divergeait dès qu'un trajet avait plusieurs billets. La règle devient une fonction pure de ses sources :

```ts
export function tripTicketStatusFromDocuments(documents: ReadonlyArray<{ type: string; status: string }>): TripTicketStatus {
  const billets = documents.filter((d) => d.type === "TICKET_PROOF");
  if (billets.some((d) => d.status === "VERIFIED")) return "VERIFIED";
  if (billets.some((d) => d.status === "PENDING" || d.status === "EXPIRED")) return "PENDING";
  if (billets.some((d) => d.status === "REJECTED")) return "REJECTED";
  return "NOT_SUBMITTED";
}
```

Côté admin, elle est appelée **dans la transaction** de décision, après l'`updateMany` conditionnel : la synthèse lit
l'état que la transaction vient d'écrire. Côté membre, `syncTripTicketStatus` écrit par `updateMany` conditionnel
(`NOT: { ticketVerificationStatus: synthese }`) : aucune écriture quand rien ne change.

## Les faits vérifiés (A158)

```ts
const factsChanged = changedTicketFacts({ departureAt: trip.departureAt, originCity: trip.originCity, destinationCity: trip.destinationCity }, updateData);
if (factsChanged.length > 0) {
  const reopened = await prisma.tripDocument.updateMany({ where: { tripId: id, type: "TICKET_PROOF", status: "VERIFIED" }, data: { status: "PENDING", verifiedAt: null, reviewedByAdminId: null } });
  if (reopened.count > 0) await syncTripTicketStatus(id);
}
```

`changedTicketFacts` compare des **valeurs** : un champ absent du patch est inchangé, une date se compare par instant
(chaîne ISO ou `Date`), une ville sans casse ni espaces. Renvoyer le même payload que l'écran d'édition ne rouvre donc rien.

## La file ne lit que des billets décidables

Avant, `listTickets` lisait les 200 premiers billets `PENDING`, puis écartait ceux des trajets partis en mémoire. Deux
défauts : l'export (même `where`) sortait ces billets partis ; et 200 billets partis masquaient un billet à venir. Les
deux requêtes sont désormais séparées :

```ts
const expired = await prisma.tripDocument.findMany({ where: departedTicketsWhere(now), select: { id: true } });  // à expirer
const pending = await prisma.tripDocument.findMany({ where: buildTicketsWhere(q, now), orderBy: { createdAt: "asc" }, take: 200 });
```

`buildTicketsWhere` porte le filtre de relation `trip.is = { isDeleted: false, status ∈ {DRAFT, PUBLISHED, PAUSED},
OR: [departureAt ≥ now, departureAt null, departureAt absent] }` ; `departedTicketsWhere` borne `departureAt` par
`gt: new Date(0)` : dans un filtre de relation Prisma + Mongo, `lt` matche une date nulle (piège payé au § 5.4).

## L'ordre des gardes

La décision vérifie maintenant : billet introuvable (404) → **son propre billet (403)** → déjà traité (400) → trajet parti
ou fermé (400). Un propriétaire qui rejouait sur un billet déjà traité recevait 400 : un refus qui en masquait un autre,
comme ANO-ADM-02.

## Écran : un refus dit la suite

`TicketsQueue` associe chaque `details.code` à un texte ET à un rechargement (`reload`) : « déjà traité », « billet
supprimé », « trajet parti / annulé » rechargent la file, puisqu'elle est périmée ; « c'est ton propre trajet » ne recharge
rien. Le message est rendu hors du bloc « Chargement… » : un refus au tout premier appel n'était jamais visible.

## Tests

- trip-service **292** (+10 : `ticket-status.rules.spec.ts` ×8, `admin-trips.rules.spec.ts` ×2) ; autres services inchangés.
- `apps/e2e` : **393 scénarios** (385 + 8) ; chaque fiche jouée seule AVANT correction (BIL-1, 5, 6, 7, 8 en échec sur
  leur défaut), puis 8/8 verts deux fois.
- Typecheck trip-service, admin-ui, harnais verts ; contrats OpenAPI inchangés.


---

# Cahier 02-ADMIN, § 5.9 : la médiation — un verrou avant l'argent, un dossier qui se relit, un email qui ne ment plus

*(PR `chore/recette-admin-5-9`, empilée sur #309, 14/09/2026.)*

## Ce qui a été fait

Neuf scénarios (ADM-MED-1 à 6 du cahier, 7 à 9 ajoutés), trois anomalies closes dont une **bloquante**, deux décisions
au registre (A159, A160).

```
apps/e2e/src/admin/adm-med-mediation.spec.ts                 9 scénarios, 5 sources de preuve par décision
apps/deal-service/src/lib/decision-lock.ts (+ spec)          NOUVEAU — ANO-ADM-22 / A159, verrou Redis par deal
apps/deal-service/src/services/deal-mediation.service.ts     gestes de médiation sous verrou (échec fermé sans magasin)
apps/deal-service/src/routes/deal.routes.ts                  câblage du Redis partagé
packages/libs/api-contracts/src/booking/booking-lifecycle.schema.ts   code 409 DECISION_IN_PROGRESS
apps/deal-service/src/services/admin-dispute.service.ts (+ spec)      A160 — fileKindOf : un dossier tranché se relit
apps/deal-service/src/services/ops-alerts.rules.ts (+ spec)  ANO-ADM-24 — countUndecidedDisputes, délai = paramètre
apps/deal-service/src/services/ops-alerts.service.ts         branchement du paramètre dispute.responseDelayHours
apps/notification-service/src/emails/settlement-emails.ts (+ spec)    ANO-ADM-23 — partiel au-delà du net
apps/admin-ui/src/components/DecisionForm.tsx                refus par code, montant « 1 234,50 », rechargement, « déjà tranché »
apps/admin-ui/src/components/DisputeFileView.tsx, QueueTable.tsx, lib/format.ts, app/(back)/disputes/page.tsx
```

## ANO-ADM-22 : le verrou optimiste protège la base, pas l'argent

`resolveDispute` suit D39 : **l'argent d'abord**. L'ordre était :

```
loadBookingForWrite → canPerform → dispute.resolvedAt ? → isDisputeDecidable → provider.refund(…) → applyBookingTransition (updateMany conditionnel)
```

Deux administrateurs qui valident au même instant lisent tous deux un dossier non tranché, passent toutes les
vérifications, et appellent tous deux `provider.refund`. Le verrou optimiste (`updateMany` sur `from: "DISPUTED"`) fait
échouer la seconde **transaction** — mais son **remboursement** est déjà parti. Mesuré avec le fournisseur FAKE, dont les
remboursements sont relus par la fiche argent (`POST /admin/deals/:id/money/reconcile` → `provider.inspect`) : `[784, 1568]`
pour un deal, 784 en base.

Correction : réserver le geste **avant toute lecture**.

```ts
// apps/deal-service/src/lib/decision-lock.ts
export async function withDecisionLock<T>(store: DecisionLockStore, dealId: string, fn: () => Promise<T>, ttlMs = 60_000): Promise<T> {
  const key = `yamba:deal:decision:${dealId}`;
  const token = randomUUID();
  if ((await store.set(key, token, "PX", ttlMs, "NX")) !== "OK") {
    throw new BookingLifecycleError("DECISION_IN_PROGRESS", "Another decision is being recorded on this deal: reload it in a few seconds.");
  }
  try { return await fn(); }
  finally { await store.eval(RELEASE, 1, key, token).catch(() => undefined); } // compare-and-delete : jamais le verrou d'un autre
}

// deal-mediation.service.ts — le gagnant RELIT le deal sous verrou
resolveDispute: (admin, dealId, input) => withDecisionLock(requireLock(), dealId, () => gestures.resolveDisputeUnlocked(admin, dealId, input)),
```

Trois choix : (1) **verrou avant lecture**, sinon le perdant qui obtient le verrou après la libération agirait sur une
lecture périmée ; (2) **jeton + compare-and-delete** (script Lua), pour qu'un geste plus long que le TTL ne libère pas le
verrou d'un autre ; (3) **échec fermé** : le magasin est injecté (`deal.routes.ts` passe le Redis partagé), et un service
construit sans magasin lève une erreur plutôt que de trancher sans verrou. Le module ne charge pas Redis lui-même : ses
tests unitaires utilisent une `Map`.

Ce que le verrou ne couvre pas : une **panne** entre le remboursement et la transaction (le deal reste DISPUTED, un nouvel
essai rembourserait à nouveau). La défense est une clé d'idempotence du fournisseur (`refunds.create(…, { idempotencyKey })`),
proposée. Le même risque de concurrence existe sur le remboursement manuel appliqué (§ 5.15).

## A160 : un dossier tranché se relit

`getFile` refusait tout deal que `arbitrationKindOf` ne rangeait pas dans la file (DISPUTED, ou CANCELLED +
HELD_FOR_MEDIATION). Après une décision, le dossier répondait 404 et le bloc « Décision rendue » de `DisputeFileView` — déjà
écrit — n'était jamais atteint pour un litige. `fileKindOf(booking, dispute)` ajoute deux cas : une fiche `Dispute` existe
(litige tranché), ou une retenue a été arbitrée (`retentionDecidedAt` + disposition CARRIER/SHIPPER). La file garde
`arbitrationKindOf` ; `canDecide` exige désormais aussi `status === "DISPUTED"`.

## ANO-ADM-24 : deux définitions de « décidable »

L'écran de médiation : `isDisputeDecidable({ disputedAt, carrierRespondedAt }, now, settings["dispute.responseDelayHours"])`.
L'alerte : `carrierRespondedAt ?? createdAt + 72 h`. Deux sources de date et une constante là où il y a un paramètre. La
règle pure `countUndecidedDisputes(disputes, now, responseDelayHours, thresholdHours)` reprend la définition de l'écran ;
le service charge `Booking.disputedAt` des litiges ouverts et passe le paramètre.

## Le harnais : cinq preuves, et deux pièges

- **Le fournisseur FAKE indexe par intent**, et l'intent d'un deal du jeu d'essai (`pi_fake_seed_bzv-disputed`) est le même
  d'un rejeu à l'autre : sa liste de remboursements cumule les fiches précédentes. La fiche relève la liste avant le geste
  et compare la **différence**.
- **`nx serve` recharge un service modifié pendant un passage** : notification-service a pris la correction d'ANO-ADM-23
  au milieu du passage « avant correction ». La preuve « avant » d'un défaut dans un service sous `nx serve` doit être
  unitaire (ou le service lancé en bundle).
- Le cache de 30 s des paramètres côté deal-service impose d'attendre `canDecide` (sonde sur l'API du dossier) après chaque
  changement de délai — y compris le retour à 72 h de la fiche précédente.

## Tests

- deal-service **586** (+8 : `decision-lock.spec.ts` ×4, `ops-alerts.rules.spec.ts` ×3, `admin-dispute.service.spec.ts` ×1)
  ; notification-service **120** (+1) ; autres services inchangés.
- `apps/e2e` : **402 scénarios** (393 + 9) ; passage contre le code non corrigé (MED-1/2/3 sur l'écran, MED-7 double
  remboursement, MED-8 404), puis 9/9 verts deux fois.
- Typecheck deal, notification, auth, trip, message, admin-ui, harnais verts ; contrats OpenAPI inchangés (le code d'erreur
  n'est pas exposé en énumération).


---

# Cahier 02-ADMIN, § 5.10 : la retenue d'annulation tardive — ce qu'un email affirme doit être vrai

*(PR `chore/recette-admin-5-10`, empilée sur #310, 14/09/2026.)*

## Ce qui a été fait

Quatre scénarios (ADM-RET-1 et 2 du cahier, 3 et 4 ajoutés), une anomalie close, trois améliorations d'écran.

```
apps/e2e/src/admin/adm-ret-retenue.spec.ts                  NOUVEAU — 6 preuves par arbitrage, jeu d'essai rejoué avant chaque fiche
apps/notification-service/src/emails/settlement-emails.ts   ANO-ADM-25 — part Yamba, plus de justification inventée ; ANO-ADM-26 — jamais le montant de l'autre partie
apps/notification-service/src/emails/booking-emails.spec.ts +1 test
apps/admin-ui/src/lib/format.ts                             RETENTION_DISPOSITION_LABEL
apps/admin-ui/src/components/DecisionForm.tsx               indices (part Yamba, total remboursé), panneau en français
apps/admin-ui/src/components/DisputeFileView.tsx            disposition lisible
apps/admin-ui/src/components/DealMoneyView.tsx              disposition lisible
apps/e2e/src/admin/adm-med-mediation.spec.ts, apps/e2e/src/parcours/web-e2e-2.spec.ts   « statut final : Terminée »
```

## Le verrou A159 couvrait déjà la retenue

`makeDealMediationService` expose `resolveRetention` à travers `withDecisionLock(requireLock(), dealId, …)` (ligne 430) :
la fiche ADM-RET-3, jouée contre le code non corrigé, envoie deux restitutions simultanées et compte les remboursements
**émis chez le fournisseur** (rapprochement, en différence) : 200 + 409 `DECISION_IN_PROGRESS`, un seul remboursement.
Aucune correction : un soupçon hérité d'un chapitre voisin se mesure avant de se corriger.

## Le calcul, du serveur à l'écran

```ts
// booking-lifecycle.ts — la compensation est la part NETTE de la retenue (ANN-01, A80)
Math.round((retentionCents * transportCents) / totalShipperCents)   // 1456 × 2600 / 2912 = 1300
```

`admin-dispute.service.ts` sert ce montant dans `proposedAmounts.compensateCarrierCents` ; `DecisionForm` n'en calcule
aucun autre : l'indice et le récapitulatif lisent la même valeur, la part de Yamba est la différence
`retentionCents − compensateCarrierCents`. La fiche vérifie les trois : formule, API, écran.

## ANO-ADM-25 : un modèle d'email ne justifie pas une décision à la place du décideur

La branche `COMPENSATE_CARRIER` de `disputeResolvedShipper` portait une phrase figée : « personne n'a pu attester de la
prise en charge, et il s'était déplacé ». Le Médiateur écrit son motif (≥ 50 caractères), déjà repris dans l'email ; la
phrase ajoutait un fait qu'il n'avait pas établi — contredit par le jeu d'essai (« Le Voyageur ne s'est pas présenté ») —
et un montant faux (« la retenue est versée au Voyageur » : 13,00 € sur 14,56 €). Le modèle dit maintenant ce qui est
vrai par construction :

```ts
"La retenue d'annulation ne t'est pas restituée : le Voyageur en reçoit une part en compensation, le reste correspond à la commission Yamba."
```

## ANO-ADM-26 : « chacun son montant », une règle que seul un parcours de bout en bout gardait

La première rédaction de la correction nommait « 13,00 € sont versés au Voyageur ». Rejouer WEB-E2E-2 (le parcours du
litige, qui lit aussi le gabarit `disputeResolvedShipper`) a échoué à l'étape 18 : **l'email de l'Expéditeur ne contient
jamais le montant du Voyageur, et inversement** (A13 étendu aux décisions). Le parcours a révélé que la correction
d'ANO-ADM-23 (§ 5.9) avait déjà franchi cette règle (« Le Voyageur reçoit 40,00 € »). Les deux phrases disent désormais
le fait sans le montant ; les tests unitaires portent la règle (`not.toMatch(/20,00/)`, `/13,00/`, `/14,56/`) pour
qu'elle ne dépende plus d'un parcours de 19 étapes. Leçon : un gabarit partagé se corrige contre la liste de ses
lecteurs (`grep -rn disputeResolvedShipper`, puis les specs e2e qui lisent son sujet).

## Lire l'outbox : l'enveloppe, puis le contenu

`applyBookingTransition` écrit dans `OutboxEvent.payload` l'**enveloppe** validée par `BookingDomainEventSchema`
(`eventId`, `occurredAt`, `schemaVersion`, `aggregateId`…) ; le contenu métier est sous `payload.payload`. Une assertion
`toMatchObject` sur le premier niveau échoue en listant 28 champs « reçus en plus » : c'est le signe qu'on lit une couche
trop haut.

## Tests

- notification-service **121** (+1 test, ANO-ADM-25 ; ANO-ADM-23 renforcé pour ANO-ADM-26) ; autres services inchangés.
- `apps/e2e` : **406 scénarios** (402 + 4), 4/4 verts deux fois sur le code final ; WEB-E2E-2, ADM-MED-4 et ADM-MED-9 rejoués verts.
- Typecheck admin-ui, notification-service, harnais verts ; contrats OpenAPI inchangés.


---

# Cahier 02-ADMIN, § 5.11 : les files d'exception de /finances — un filtre, un compte, une erreur qui reste JSON

*(PR `chore/recette-admin-5-11`, empilée sur #311, 14/09/2026.)*

## Ce qui a été fait

Cinq scénarios (ADM-FIN-1 à 5), deux anomalies closes (ANO-ADM-27, 28), décision A161.

```
apps/e2e/src/admin/adm-fin-files.spec.ts                         5 scénarios en série
packages/error-handler/error-middleware.ts                       notFoundHandler (ANO-ADM-27)
apps/{auth,trip,deal,message,notification}-service/src/main.ts   app.use(notFoundHandler) avant errorMiddleware
packages/libs/api-contracts/src/admin/admin-finances.schema.ts   financeQueueWhere, FINANCE_QUEUE_PAGE, counts, truncated
apps/deal-service/src/services/admin-finance.service.ts          file = filtre partagé + comptes des quatre files
apps/deal-service/src/controllers/admin-finance.controller.ts    INVALID_QUEUE_KIND
apps/auth-service/src/controller/admin-kpis.controller.ts         tuiles = filtre partagé
apps/admin-ui/src/components/FinanceQueues.tsx                   compteurs, adresse, libellés, refus, Relancer
apps/admin-ui/src/components/AlertsView.tsx                      lien d'alerte selon la permission (ANO-ADM-28)
apps/*/openapi.json                                              régénérés (FinanceQueueResponse)
```

## ANO-ADM-27 : la page HTML d'Express

Express termine toute requête qu'aucune route n'a prise par son gestionnaire par défaut, qui écrit une page HTML
`Cannot GET <chemin>`. Un middleware d'erreur (`(err, req, res, next)`) ne l'intercepte pas : il n'y a pas d'erreur, il
n'y a juste personne. La correction est un middleware ORDINAIRE, placé après toutes les routes, qui fabrique l'erreur :

```ts
export const notFoundHandler = (req: Request, _res: Response, next: NextFunction) => {
  next(new NotFoundError("Route not found.", { code: "ROUTE_NOT_FOUND" }));
};
// main.ts de chaque service
app.use(notFoundHandler);
app.use(errorMiddleware);
```

L'ordre est tout : placé avant un routeur, il répondrait 404 à des routes existantes. Le script de revue du chapitre
vérifie qu'aucun `app.use` / `app.get` ne suit `notFoundHandler` dans les cinq `main.ts`. La passerelle n'a pas eu besoin
d'être touchée : son proxy de repli transmet à auth-service, qui répond désormais en JSON.

## Un filtre partagé entre deux services

Les tuiles de l'accueil (auth-service) et la file (deal-service) comptaient les mêmes choses avec deux filtres écrits
séparément. `financeQueueWhere(kind)` vit dans `api-contracts`, que les deux services importent déjà : c'est un objet
Prisma en JSON (`isSet`, `in`, `gt`), sans dépendance à Prisma. La file sert en plus le compte des quatre files
(`prisma.booking.count` en parallèle de la page) et `truncated` (`counts[kind] > items.length`) :

```ts
const [rows, ...sizes] = await Promise.all([
  prisma.booking.findMany({ where: financeQueueWhere(kind), take: FINANCE_QUEUE_PAGE, … }),
  ...FinanceQueueKindSchema.options.map((k) => prisma.booking.count({ where: financeQueueWhere(k) })),
]);
```

Le test unitaire reconnaît chaque appel `count` à son filtre sérialisé, ce qui prouve que les QUATRE comptes utilisent
bien la fonction partagée.

## admin-ui : un nom accessible stable, une adresse qui suit l'onglet

Le compteur est un `<span data-count>` dans le bouton ; `aria-label={label}` garde le nom accessible « Versements en
échec » intact, et les fiches qui cliquent le bouton par son nom exact (ADM-ALR-2, ALR-4) n'ont pas bougé. L'onglet
s'écrit dans l'adresse par `router.replace(`${pathname}?kind=${k}`, { scroll: false })` — `replace` et non `push` :
changer d'onglet ne remplit pas l'historique. Piège de test payé : `router.replace` est asynchrone ; recharger
immédiatement après le clic recharge l'ANCIENNE adresse. La fiche attend `toHaveURL(…?kind=HELD)` avant `reload()`.

## ANO-ADM-28 : un lien vers un 403

`AlertsView` associe chaque destination à sa permission (`/finances` → `finances.read`, `/disputes` → `disputes.read`,
`/pilotage` → `pilotage.read`) et lit `/admin/me` ; la carte n'est un `<Link>` que si `can(adminRoles, permission)`.
Tant que `/admin/me` n'a pas répondu, la carte reste un lien (état d'avant, jamais pire).

## Tests

- auth-service **249** (+1, `notFoundHandler`), deal-service **587** (+1, comptes et troncature). Un passage parallèle de
  deal-service a expiré deux fois sous charge ; vert en isolé (même constat qu'au § 5.5).
- `apps/e2e` : **411 scénarios** (406 + 5), 5/5 verts deux fois ; ADM-ALR et ADM-ACC rejouées (7/7).
- Typecheck des cinq services, d'admin-ui et du harnais verts ; OpenAPI régénérés.


---

# Cahier 02-ADMIN, § 5.12 : la fiche argent — un bilan qui dit où est chaque centime

*(PR `chore/recette-admin-5-12`, empilée sur #312, 14/09/2026.)*

## Ce qui a été fait

Deux fiches du cahier (ADM-ARG-1, 2) et trois ajoutées (ARG-3 invariants comptables, ARG-4 bilan et libellés, ARG-5
le Support et la chronologie). Deux anomalies closes (`ANO-ADM-29`, `ANO-ADM-30`), neuf améliorations.

```
apps/deal-service/src/services/admin-finance.rules.ts        moneyBalance (règle pure) ; AUTHORIZATION_RELEASED dans la chronologie
apps/deal-service/src/services/admin-finance.service.ts      la fiche sert `balance`
apps/deal-service/src/services/admin-history.service.ts      redactContacts : erreurs techniques sans adresse ni numéro
packages/libs/api-contracts/src/admin/admin-finances.schema.ts  MoneyBalanceSchema, MoneyPendingKind ; 5 openapi.json régénérés
apps/admin-ui/src/components/DealMoneyView.tsx               carte Bilan ; vue réduite sur 403 (ANO-ADM-29) ; libellés ; erreurs nommées
apps/admin-ui/src/components/DisputeFileView.tsx             le lien dit ce qu'il ouvre selon le profil
apps/admin-ui/src/lib/format.ts + types.ts                   libellés (attentes, anomalies, acteurs, modèle, états), adminAfterSummary
packages/libs/prisma/scripts/seed-deals.ts                   ANO-ADM-30 : un deal accepté puis annulé est remboursé
apps/e2e/src/admin/adm-arg-fiche-argent.spec.ts              5 scénarios en série (jeu d'essai rejoué avant et après)
```

## Sonder le terrain avant d'écrire

Un script de sonde (lu puis supprimé) a relevé, pour les 23 deals du jeu d'essai : prix figé (et `net + commission +
prime = payé`), débit, remboursement, retenue, versement, transfert. Tout additionnait, sauf un fait : `bzv-cancelled`
était **capturé** (accepté) puis **annulé**, sans aucun remboursement. Le produit rembourse en entier une annulation plus
de 48 h avant le départ (`deal-lifecycle.service.ts`, `computeCancellationRefundCents`) : c'est le jeu d'essai qui mentait
(`ANO-ADM-30`). La leçon technique n'est pas la correction du seed, c'est la question qu'elle pose : **qui aurait vu ce
deal en production ?** Personne — aucune file ne montre un deal clos dont l'argent n'a pas de destination. D'où le bilan.

## `moneyBalance` : une règle pure, testée cas par cas

```ts
export function moneyBalance(b: MoneyBalanceInput): MoneyBalance {
  const capturedCents = b.capturedAt ? b.pricing.totalShipperCents : 0;
  const refundedCents = b.refundAmountCents ?? 0;
  const paidOutCents = b.payoutStatus === "SENT" ? (b.payoutAmountCents ?? 0) : 0;
  const platformHoldsCents = capturedCents - refundedCents - paidOutCents;
  // pending : AUTHORIZATION_OPEN, DEAL_IN_PROGRESS, PAYOUT_FROZEN, PAYOUT_DUE, PAYOUT_FAILED, REVERSAL_OPEN, RETENTION_HELD, REFUND_PROPOSED
  …
  if (settled && CLOSED.has(b.status)) {
    const writtenOff = b.payoutStatus === "REVERSED" && b.payoutReversalResolution === "WRITTEN_OFF";
    if (!writtenOff && platformHoldsCents > b.pricing.commissionCents) anomaly = "UNALLOCATED_FUNDS";
    else if (platformHoldsCents < 0 && !(b.manualRefundCents ?? 0)) anomaly = "OVERSPENT";
  }
}
```

Pourquoi « plus que sa commission » et pas « différent de sa commission » ? Parce que plusieurs issues légitimes laissent
à la plateforme **moins** que sa commission : une retenue compensée au prorata (la plateforme garde la part de commission
de la retenue — 1,56 € au § 5.10), une retenue restituée (0), un geste commercial (négatif, expliqué par
`manualRefundCents`). Seul le cas « la plateforme détient plus que ce qu'elle facture, et rien n'attend » est sans
explication. Un renversement **abandonné** (`WRITTEN_OFF`) garde la part du Voyageur par décision tracée : exclu.
L'écran n'additionne rien ; il affiche ce que le serveur calcule.

## ANO-ADM-29 : une permission sans écran

Les permissions sont justes (`deals.history.read` au Support, `finances.read` non) mais la seule carte qui sert la
première vit sur une page qui charge d'abord la seconde. Plutôt que d'ouvrir `finances.read` (le Support lirait alors
tout l'argent), l'écran traite le 403 comme une information :

```tsx
.catch((e) => {
  if (e instanceof ApiError && e.status === 403) setDenied(true);          // vue réduite, pas une erreur
  else if (e instanceof ApiError && e.status === 404) setError("Deal introuvable. …");
  …
});
if (denied) { if (!me) return <Chargement/>; return can(me.adminRoles, "deals.history.read") ? <DealHistoryCard/> : <raison/>; }
```

On attend `/admin/me` avant de choisir le message : sans cela, la vue affichait un instant « ton profil n'ouvre rien »
avant de se reprendre.

## `redactContacts` : ce qu'une erreur technique révèle

Une erreur SMTP typique est `550 5.1.1 <aminata.diallo@…>: mailbox unavailable`. La chronologie servait `lastError`
tel quel à des profils qui n'ont pas la lecture des coordonnées. La fonction masque les adresses, puis les suites de
chiffres **d'au moins neuf chiffres** — piège payé en écrivant le test : une première version à « 9 caractères chiffres,
espaces, points » masquait `550 5.1.1`, le code SMTP lui-même.

## Chronologie de l'argent : dire aussi ce qui n'a pas eu lieu

`buildMoneyTimeline` ne pose qu'une ligne par fait écrit en base. Un deal refusé n'a qu'un fait : l'empreinte
(`AUTHORIZED` à `requestedAt`) — sa chronologie se terminait sur « Empreinte posée 67,20 € », ce qu'un lecteur prend pour
un débit. La libération de l'empreinte n'est pas un champ, mais elle se **déduit** sans ambiguïté : statut fermé
(`DECLINED`, `EXPIRED`, `CANCELLED`) et jamais `capturedAt`. Nouveau fait `AUTHORIZATION_RELEASED` à `closedAt`, avec
l'acteur en détail.

## La contre-épreuve d'un invariant

ARG-3 vérifie « aucune anomalie » sur les 23 deals. Vert, cela peut vouloir dire que le calcul est juste… ou qu'il ne
lève jamais rien. La fiche remet donc le défaut d'origine en base (manœuvre consignée : `refundAmountCents: null` sur
`bzv-cancelled`), exige `UNALLOCATED_FUNDS` à l'API et le message rouge à l'écran, et le jeu d'essai est rejoué en
`afterAll`.

## Tests

- deal-service **595** (+8) : `moneyBalance` (6), `AUTHORIZATION_RELEASED` (1), `redactContacts` (1).
- `apps/e2e` : **416 scénarios** (411 + 5), 5/5 verts deux fois ; ADM-RET et ADM-FIN rejouées.
- Typecheck deal-service, admin-ui et harnais verts ; les cinq `openapi.json` régénérés (nouveau schéma `MoneyBalance`).


---

# Cahier 02-ADMIN, § 5.13 : le rapprochement avec le fournisseur — une lecture qui ne crée rien, une panne qui ne ment pas

*(PR `chore/recette-admin-5-13`, empilée sur #313, 14/09/2026.)*

## Ce qui a été fait

Trois fiches (ADM-RAP-1 à 3), deux anomalies closes (`ANO-ADM-31`, `ANO-ADM-32`), décision **A163**.

```
packages/libs/payments/src/index.ts                     PaymentIntentNotFoundError, isStripeResourceMissing ; Fake.inspect sans adoption ;
                                                        Stripe.inspect : seule l'absence vaut « introuvable »
apps/deal-service/src/services/admin-finance.service.ts reconcileDeal : introuvable → INTENT_NOT_FOUND ; panne → 503 PROVIDER_UNAVAILABLE journalisé
apps/deal-service/src/openapi/build-openapi.ts          503 documenté (+ les cinq openapi.json régénérés)
apps/admin-ui/src/components/DealMoneyView.tsx          carte : fournisseur nommé, refus par code, aide par divergence, statuts FR
apps/admin-ui/src/lib/format.ts                         DIVERGENCE_HELP, INTENT_STATUS_LABEL, REFUND_STATUS_LABEL, PROVIDER_LABEL
apps/e2e/src/admin/adm-rap-rapprochement.spec.ts        NOUVEAU — 3 scénarios
apps/e2e/src/admin/adm-ret-retenue.spec.ts              RET-1 : transfert lu en base quand l'intent seedé est inconnu du Fake
```

## ANO-ADM-31 : une lecture qui écrit

Le Fake est en mémoire. Pour que les gestes du développeur (accepter, annuler) marchent sur les deals du jeu d'essai,
`retrieve` **adopte** tout id `pi_fake_seed_…` inconnu : il le matérialise AUTHORIZED à 0 €. `inspect` passait par
`retrieve` : le premier rapprochement créait donc un paiement « autorisé, rien encaissé », puis le comparait à une base
qui dit « capturé » — `CAPTURE_RECORDED_NOT_LIVE`, `TRANSFER_MISSING`. Deux défauts en un : une divergence inventée, et
une lecture qui modifie l'état du fournisseur.

```ts
async inspect(input) {
  const known = this.intents.get(input.intentId);          // pas d'adoptSeeded ici
  if (!known) throw new PaymentIntentNotFoundError(input.intentId);
  …
}
```

Conséquence assumée (A163) : un intent seedé qu'aucun geste d'argent n'a touché dans ce processus est illisible par le
rapprochement — exactement comme un intent inconnu de Stripe. ADM-RET-1 (compensation sans remboursement) lit donc le
transfert en base ; ADM-RAP-2 prouve la lecture du transfert chez le fournisseur après un vrai geste.

## ANO-ADM-32 : « introuvable » est une réponse, « injoignable » n'en est pas une

```ts
export function isStripeResourceMissing(err: unknown): boolean {
  const e = err as { code?: unknown; statusCode?: unknown; type?: unknown } | null;
  return !!e && (e.code === "resource_missing" || (e.statusCode === 404 && e.type === "StripeInvalidRequestError"));
}
```

`StripePaymentProvider.inspect` ne traduit en `PaymentIntentNotFoundError` que cette erreur-là, et la lecture du transfert
ne met `null` (→ `TRANSFER_MISSING`) que sur une absence. Le service :

```ts
} catch (err) {
  if (!(err instanceof PaymentIntentNotFoundError) && err?.name !== "PaymentIntentNotFoundError") {
    await recordAdminAction(prisma, audit(admin, "DEAL_RECONCILED", id, { provider: provider.name, divergences: [], providerError: "PROVIDER_UNAVAILABLE" }));
    throw new AppError("The payment provider could not be reached: nothing was compared, try again later.", 503, true, { code: "PROVIDER_UNAVAILABLE" });
  }
  divergences = [{ code: "INTENT_NOT_FOUND", message: "The payment provider does not know this payment intent.", dbCents: null, liveCents: null }];
}
```

Le double test (`instanceof` ET `name`) protège d'un bundle qui chargerait deux copies de la bibliothèque. La tentative est
journalisée : un administrateur a bien demandé à lire l'argent chez le fournisseur.

## La fiche : prouver « rien n'est modifié » sans se mentir

- **Base** : le document Mongo du deal relu avant / après, comparé en entier.
- **Fiche argent** : identique, **sauf** `adminActions` (le journal du deal, qui gagne des lignes par construction) — et
  la fiche vérifie que les lignes ajoutées ne sont QUE `DEAL_MONEY_VIEWED` et `DEAL_RECONCILED`.
- **Fournisseur** : deux rapprochements successifs répondent la même chose.
- **Divergences réelles en local** : un geste d'argent réel (relance du versement, remboursement manuel de 1 €) fait
  connaître l'intent au Fake ; la base est ensuite décalée champ par champ (manœuvres consignées), chaque écart est exigé
  avec ses deux montants. Le Fake **cumule** ses remboursements d'un rejeu à l'autre : la fiche part de ce qu'il montre
  (`L`) et pose la base à `L`, `L−100`, `L+400`.
- **Rejouabilité** : la mémoire du Fake survit au rejeu du jeu d'essai ; RAP-1 choisit le premier deal dont l'intent est
  encore inconnu (le sonder ne change rien : c'est le sujet même de la fiche).

## Tests

- deal-service **598** (+3) : Fake sans adoption, `isStripeResourceMissing`, 503 journalisé.
- `apps/e2e` : **419 scénarios** (416 + 3), 3/3 verts deux fois ; ADM-ARG, FIN, RET (adaptée), MED rejouées (27/27).
- Typecheck deal-service, admin-ui, harnais verts ; les cinq `openapi.json` régénérés (503 du rapprochement).


---

# Cahier 02-ADMIN, § 5.14 : versements — rejeu et renversement, et l'argent qui ne part jamais deux fois

*(PR `chore/recette-admin-5-14`, empilée sur #314, 14/09/2026.)*

## Ce qui a été fait

Sept scénarios (ADM-VER-1, 2, 3 du cahier ; VER-1 bis, VER-1 ter, VER-2 bis, VER-4 ajoutées), une anomalie bloquante
close (`ANO-ADM-33`), une décision (`A164`), sept améliorations.

```
apps/e2e/src/admin/adm-ver-versements.spec.ts                 7 scénarios — jeu d'essai rejoué avant chacun
packages/libs/payments/src/index.ts                           A164 — findTransfers (Stripe transfers.list, Fake) ; aide _forgetIdempotencyKeysForTest
apps/deal-service/src/services/deal-settlement.service.ts     ANO-ADM-33 — échec conditionnel + relecture ; A164 — adopter le transfert vivant
apps/deal-service/src/services/admin-finance.rules.ts         A164 — payoutNeedsTransferLookup, adoptableTransfer (purs)
apps/deal-service/src/services/admin-finance.service.ts       journal PAYOUT_REVERSAL_RESOLVED : previousTransferId
apps/admin-ui/src/lib/format.ts                               payoutReasonLabel, payoutRefusalMessage, libellé « transfert renversé »
apps/admin-ui/src/components/DealMoneyView.tsx                garde de double clic (ref), messages, formulaire de renversement
apps/admin-ui/src/components/FinanceQueues.tsx                même lecteur de refus, motif d'échec lisible
```

## Ce que la recette a mesuré d'abord

Les six premiers scénarios ont été joués contre le code non corrigé : **tous verts**. Quatre `POST /payout/retry` lancés
ensemble rendaient quatre fois `200 SENT` avec le **même** `transferId`, un seul événement `booking.payout_sent`, un
compteur à +1 ; deux « Re-verser » simultanés, `200 + 400`. La protection locale est réelle : la clé d'idempotence
(`payout:<id>`) fait rendre au fournisseur le transfert existant, et l'écriture `SENT` est conditionnelle
(`payoutStatus ∈ {PENDING, FAILED}`). Le défaut n'était pas là où la fiche regardait.

## ANO-ADM-33 : l'échec écrasait le succès

```ts
// avant — markPayoutFailed
await prisma.booking.updateMany({ where: { id: booking.id, status: booking.status }, data: { payoutStatus: "FAILED", … } });
```

Deux exécuteurs sur le même versement (un admin qui relance pendant le passage du cron, ou deux admins) : A obtient le
transfert et écrit `SENT` ; B, dont la requête arrive pendant que la clé est « en cours », reçoit de Stripe une erreur 409
(`idempotency_error`) et écrit `FAILED` **par-dessus** — `transferId` compris, alors que l'argent est parti. Au rejeu
suivant, si la clé a expiré (24 h chez Stripe ; le rejeu passe à une tentative par jour après 24 essais), un second
transfert part. Correction :

```ts
const written = await prisma.booking.updateMany({
  where: { id: booking.id, status: booking.status, payoutStatus: { in: ["PENDING", "FAILED"] } },
  data: { payoutStatus: "FAILED", … },
});
if (written.count === 0) {
  const current = await prisma.booking.findUnique({ where: { id: booking.id }, select: { payoutStatus: true, transferId: true } });
  if (current?.payoutStatus === "SENT") return { payoutStatus: "SENT", transferId: current.transferId ?? null, reason: null };
}
```

Le Fake ne sait pas répondre « clé en cours » : la preuve est unitaire (`deal-settlement.service.spec.ts`, « ANO-ADM-33 :
course… »).

## A164 : demander au fournisseur avant de réémettre

```ts
if (provider.findTransfers && payoutNeedsTransferLookup(booking)) {        // une tentative a déjà eu lieu
  try { adopted = adoptableTransfer(await provider.findTransfers(booking.id), { bookingId: booking.id, amountCents, reason }); }
  catch (err) { return markPayoutFailed(booking, `PROVIDER_ERROR:transfer lookup failed — ${message}`, now); }
}
if (adopted) transferId = adopted.id;                                       // aucun nouvel appel à transfer()
else { … provider.transfer({ …, transferGroup: booking.id, idempotencyKey }) … }
```

- `findTransfers` est **optionnel** dans l'interface : un fournisseur (ou une doublure de test) qui ne l'offre pas n'est
  pas consulté.
- `adoptableTransfer` n'adopte qu'un transfert **vivant** : même montant, même motif (`DELIVERY` / `LATE_CANCELLATION`),
  même deal si les métadonnées le disent, `reversedCents === 0`. C'est ce qui laisse « Re-verser » émettre un nouveau
  transfert après un renversement : l'ancien est renversé, donc ignoré.
- Première tentative : pas de recherche (rien n'a pu partir ; on évite un appel sur chaque versement).
- Recherche en panne : on écrit l'échec et on **n'émet rien** — le rejeu repassera.

## Les améliorations

- **Refus lus par leur code** (`payoutRefusalMessage`) : `PAYOUT_NOT_RETRYABLE` et `REVERSAL_NOT_OPEN` disent « traité
  entre-temps » et **rechargent** la fiche ; `ADMIN_IS_PARTY`, `NO_PAYOUT_FOR_STATUS`, permission, motif. Plus jamais
  `400 : This payout is not an open reversal.`. Pour une erreur réseau, le message ne promet pas que rien n'est parti : il
  demande de recharger la fiche.
- **Motif d'échec lisible** (`payoutReasonLabel`) : « compte Stripe du Voyageur non prêt », « refus du fournisseur
  (…message…) », et le nouveau cas « le fournisseur n'a pas pu dire si un transfert était déjà parti ».
- **Garde de double clic synchrone** (`useRef`) sur « Relancer le versement » et le formulaire de renversement.
- **Message de succès** qui nomme montant, Voyageur et identifiant de transfert.
- **Formulaire de renversement** : le fournisseur réel (« le fournisseur de test (Fake) » en local, comme le rapprochement
  du § 5.13), compteur `n / 20`, conséquence de chaque bouton écrite sous les boutons.
- **Journal** : `PAYOUT_REVERSAL_RESOLVED.after.previousTransferId` — « Re-verser » remplace `transferId` en base, l'identifiant
  du transfert renversé (à retrouver dans le tableau de bord Stripe) ne survivait nulle part.

## Tests

- deal-service **607** (+9) : ANO-ADM-33 (course), A164 (adoption, exclusions, pas de recherche à la première tentative,
  recherche en panne, bout en bout sur le Fake avec clé oubliée), règles pures, `findTransfers` du Fake, journal
  `previousTransferId`. Un passage parallèle a échoué une fois sous charge (`admin-finance.service.spec.ts`), vert en
  isolé et sur deux passages complets suivants (parallèle et `--runInBand`).
- `apps/e2e` : **426 scénarios** (419 + 7).
- Typecheck deal-service, admin-ui, harnais verts ; aucun contrat OpenAPI modifié.

# Cahier 02-ADMIN, § 5.15 : remboursement manuel en deux gestes — le verrou protégeait la base, pas l'argent

*(PR `chore/recette-admin-5-15`, empilée sur #315, 14/09/2026.)*

## Ce qui a été fait

Six scénarios (ADM-REM-1, 2, 3 du cahier ; REM-4, 5, 6 ajoutées), trois anomalies closes (`ANO-ADM-34` bloquante,
`ANO-ADM-35`, `ANO-ADM-36`), une décision (`A165`), neuf améliorations.

```
apps/e2e/src/admin/adm-rmb-remboursement.spec.ts                    6 scénarios — jeu d'essai rejoué avant chacun
apps/e2e/src/chapitres/web-cnf.spec.ts                              WEB-CNF-10 : libellé AFTER_COMPLETION dans la table miroir
packages/libs/payments/src/index.ts                                 A165 — refund(…, { idempotencyKey }) : Stripe + Fake qui honore la clé
apps/deal-service/src/lib/refund-idempotency.ts (+ spec)            A165 — refundIdempotencyKey(geste, deal, montant, cumulAvant?)
apps/deal-service/src/services/admin-finance.service.ts             ANO-ADM-34 — verrou de décision ; A165 — clé ; caducité (fiche, file)
apps/deal-service/src/services/admin-finance.rules.ts               A165 — manualRefundProposalStaleness (pure)
apps/deal-service/src/routes/deal.routes.ts                         Redis câblé comme magasin de verrou du service finances
apps/deal-service/src/services/deal-lifecycle|transport|mediation   A165 — clé sur annulation, retour de capture, refus au pickup, décision, retenue
apps/deal-service/src/services/wallet.service.ts                    ANO-ADM-36 — partialKind, keptCents ; « Dépensé » compte la part gardée
packages/libs/api-contracts/src/booking/booking-wallet.schema.ts    keptCents, partialKind ; retentionCents réservé à l'annulation tardive
packages/libs/api-contracts/src/admin/admin-finances.schema.ts      proposal.stale / staleReason ; FinanceQueueItem.proposalStale
apps/notification-service/src/emails/booking-emails.ts (+ .ejs)     ANO-ADM-35 — commercialGesture, pas de retenue pour un acteur ADMIN
apps/user-ui/…/finances/WalletRows.tsx + messages fr/en             libellé PARTIALLY_REFUNDED_AFTER_COMPLETION
apps/admin-ui/src/components/DealMoneyView.tsx                      carte de remboursement : saisie FR, garde ref, refus par code, caducité
apps/admin-ui/src/lib/format.ts                                     parseEurosToCents (partagé), manualRefundRefusal, REFUND_PROPOSAL_STALE_LABEL
apps/admin-ui/src/components/FinanceQueues.tsx, DecisionForm.tsx    badge « caduque » ; parseur de montant déplacé dans format.ts
```

## Ce que la recette a mesuré d'abord — la contre-épreuve

Le § 5.14 l'avait appris : une fiche verte ne prouve rien tant qu'elle n'a pas été jouée contre le code non corrigé. Ici,
écraser les sources du répertoire de travail étant refusé, la contre-épreuve passe par un **worktree** :

```sh
git worktree add --detach <scratchpad>/wt-5-14 5b35ef9
ln -sfn $PWD/node_modules <scratchpad>/wt-5-14/node_modules
(cd <scratchpad>/wt-5-14 && NX_DAEMON=false npx nx run-many -t build -p deal-service,notification-service)
# on arrête les processus des ports 6003 / 6004, on lance les bundles du worktree avec le .env racine
```

L'écran reste celui de la branche (seul le serveur change). Résultats :

- **ADM-REM-4** : `200 · 409 TRANSITION_NOT_ALLOWED · 409 TRANSITION_NOT_ALLOWED` et **3 remboursements chez le
  fournisseur** pour un seul enregistré ;
- **ADM-REM-2** : portefeuille « Remboursé 5,00 € le 14 sept. · retenue 34,20 € reversée au Voyageur » ; email « Annulation à
  moins de 48 h du départ : une retenue de 34,20 € s'applique… ».

## ANO-ADM-34 : l'argent part avant la base, le verrou doit donc venir avant l'argent

```ts
// avant — applyManualRefund
const raw = await loadMoney(id);                  // trois requêtes lisent refundAmountCents = null
const bounds = manualRefundBounds(raw);           // toutes passent
refundId = (await provider.refund(intent, amount)).refundId;   // trois remboursements réels
await prisma.booking.updateMany({ where: { id, refundAmountCents: raw.refundAmountCents }, … }); // un seul count: 1
```

La condition sur le cumul est un verrou **optimiste** : parfait pour une écriture en base, inutile quand l'effet
irréversible (l'appel au fournisseur, D39) a lieu **avant** l'écriture. Le remède est celui de la médiation (A159) : un
verrou **pessimiste** court, pris avant la lecture.

```ts
async applyManualRefund(admin, id, input) {
  if (!decisionLocks) throw new Error("admin-finance: no decision lock store wired (ANO-ADM-34)");
  return withDecisionLock(decisionLocks, id, () => applyManualRefundUnlocked(admin, id, input));
}
```

- `withDecisionLock` (`apps/deal-service/src/lib/decision-lock.ts`) : `SET key token PX 60000 NX`, puis suppression
  conditionnelle par script Lua (on ne libère que son propre jeton). Clé `yamba:deal:decision:<id>` — **la même que la
  médiation** : un remboursement manuel et une décision de litige sur le même deal s'excluent.
- Le perdant reçoit `409 DECISION_IN_PROGRESS` **sans** appel fournisseur.
- Sans magasin câblé, le service jette : **échec fermé**. Une doublure oubliée dans un test ou une route ne dégrade pas
  silencieusement en « pas de verrou ».

## A165 : une clé d'idempotence qui décrit le geste, pas l'instant

Le verrou couvre la course ; il ne couvre pas la **reprise** : un processus qui meurt entre `provider.refund` et la
transaction, puis un admin qui reclique. La clé fournisseur le couvre, à condition d'être **stable** pour le même geste
et **différente** pour un geste nouveau :

```ts
export function refundIdempotencyKey(gesture, dealId, amountCents, previousRefundedCents?) {
  const parts = ["yamba", "refund", gesture, dealId];
  if (gesture === "manual") parts.push(`after-${previousRefundedCents ?? 0}`);
  parts.push(String(amountCents));
  return parts.join(":");
}
```

- Annulation, refus au pickup, décision de litige, restitution de retenue, retour de capture : **une fois par deal** — le
  montant suffit.
- Remboursement manuel : répétable (deux gestes de 5 € à une semaine d'écart sont légitimes) → la clé porte le **cumul lu
  avant le geste**. Rejoué sur le même état (rien écrit) : même clé, même remboursement. Après écriture : cumul changé,
  nouvelle clé.
- Le montant est dans chaque clé : Stripe refuse une clé réutilisée avec d'autres paramètres.
- `FakePaymentProvider.refund` honore la clé (`refundsByKey`) ; `_forgetIdempotencyKeysForTest` l'oublie, comme Stripe au
  bout de 24 h.

## Proposition caduque

```ts
export function manualRefundProposalStaleness(proposedCents, bounds) {
  if (!bounds.allowed) return { stale: true, staleReason: "NOT_REFUNDABLE" };
  if (proposedCents > bounds.maxRefundableCents) return { stale: true, staleReason: "ABOVE_REMAINING" };
  return { stale: false, staleReason: null };
}
```

Calculée à la lecture (fiche argent, file `PROPOSED_REFUNDS`), jamais stockée. La fiche peint le bandeau en rouge et dit
combien il reste ; la file porte un badge. Appliquer tel quel reste refusé par `manualRefundBounds` (`REFUND_ABOVE_MAX`).

## ANO-ADM-35 et ANO-ADM-36 : un remboursement partiel n'est pas toujours une retenue

Deux lecteurs du même fait avaient hérité du seul cas connu au moment de leur écriture (l'annulation tardive, ANN-01) :

```ts
// notification-service — avant
retainedForCarrier: event.payload.amountCents < p.totalShipperCents ? formatMoney(total - amount) : null,
// après
commercialGesture: event.payload.actor === "ADMIN",
retainedForCarrier: event.payload.actor !== "ADMIN" && event.payload.amountCents < p.totalShipperCents ? … : null,
```

```ts
// deal-service, wallet — branche COMPLETED, avant
return { ...base, state: "PARTIALLY_REFUNDED", refundAmountCents: refund, retentionCents: total - refund, … };
// après
return { ...base, state: "PARTIALLY_REFUNDED", refundAmountCents: refund, keptCents: total - refund, partialKind: "AFTER_COMPLETION", … };
```

Le contrat gagne `keptCents` (ce que l'Expéditeur a finalement payé, quel que soit le motif) et `partialKind` ;
`retentionCents` ne vaut plus que pour `LATE_CANCELLATION`. `spentCents` somme `keptCents`. Le front choisit la clé
`PARTIALLY_REFUNDED_AFTER_COMPLETION` (« {kept} ont réglé ton envoi »). Aujourd'hui seul le remboursement manuel émet
`booking.refund_issued` en acteur `ADMIN` (la médiation n'émet pas cet événement) : c'est ce qui rend `actor === "ADMIN"`
suffisant — un champ explicite est proposé si un autre geste admin devait l'émettre.

## Les améliorations (admin-ui)

- **Saisie à la française** : `parseEurosToCents` (« 12,50 », « 1 234,50 », espaces insécables) déplacé de
  `DecisionForm.tsx` vers `lib/format.ts`, partagé ; message sous le champ (« Montant illisible… », « Au-dessus du
  plafond : … au plus. »).
- **Garde de double clic synchrone** (`inFlight` en `useRef`).
- **Refus par code** (`manualRefundRefusal`) : `DECISION_IN_PROGRESS`, `REFUND_ABOVE_MAX`, `REFUND_NOT_ALLOWED`,
  `TRANSITION_NOT_ALLOWED` rechargent la fiche et disent si de l'argent a pu partir ; `REFUND_PROVIDER_FAILED`,
  `ADMIN_IS_PARTY`, permission, 400 restent dans la carte ; une erreur inconnue demande de recharger avant de réessayer.
- **Caducité** affichée (bandeau rouge, badge de file), formulaire non prérempli par une proposition caduque.
- **Compteur de motif** `n / 50` et rappel « l'Expéditeur reçoit l'email… ; le motif reste au journal ».
- **Remplacement signalé** : « Une proposition existe déjà : en proposer une autre la remplace. »
- **Identifiant du remboursement** dans le message de succès.
- La carte est remontée (`key` = cumul + date de proposition) après chaque rechargement : l'état local ne survit pas à un
  changement de fond.

## Tests

- deal-service **615** (+8) : ANO-ADM-34 (deux applications simultanées → un remboursement, `DECISION_IN_PROGRESS` ;
  échec fermé sans verrou), A165 (reprise après base non écrite → même remboursement ; clés de chaque geste ; Fake qui
  honore et oublie), caducité (règle pure, fiche, file), ANO-ADM-36 (portefeuille). Specs lifecycle / transport ajustées à
  la nouvelle signature de `refund`.
- notification-service **122** (+1) : ANO-ADM-35, rendu EJS FR et EN.
- `apps/e2e` : **432 scénarios** (426 + 6) ; WEB-CNF-10 ajusté.
- Typecheck des huit projets de la CI vert ; les cinq `openapi.json` régénérés (schémas partagés `FinanceQueueItem`,
  `AdminDealMoneyFile`, `WalletPaymentItem`) ; miroir i18n FR/EN parfait.

# Cahier 02-ADMIN, § 5.16 : rapport mensuel et export — un deal garde la liste de ses remboursements

*(PR `chore/recette-admin-5-16`, empilée sur #316, 14/09/2026.)*

## Ce qui a été fait

Cinq scénarios (ADM-RPT-1, 2, 3 du cahier ; RPT-4, 5 ajoutées), trois anomalies closes (`ANO-ADM-37`, `ANO-ADM-38`
majeures, `ANO-ADM-39` mineure), une décision (`A166`), sept améliorations.

```
prisma/schema.prisma                                               A166 — type BookingRefund, Booking.refunds
apps/deal-service/src/lib/booking-refunds.ts (+ spec)              withRefund (écrire), refundEntries / refundedTotalCents (lire)
apps/deal-service/src/services/booking-write.ts                    sélection : refunds, capturedAt, refundedAt, refundId
apps/deal-service/src/services/deal-lifecycle.service.ts           annulation capturée → CANCELLATION (pas l'empreinte libérée)
apps/deal-service/src/services/deal-transport.service.ts           refus au pickup → PICKUP_REFUSED
apps/deal-service/src/services/deal-mediation.service.ts           décision → DISPUTE ; restitution → RETENTION_RESTITUTION
apps/deal-service/src/services/admin-finance.service.ts            geste → MANUAL ; fiche argent payment.refunds ; nom de fichier
apps/deal-service/src/services/admin-finance.rules.ts              rapport, CSV (+ 2 colonnes), chronologie, bilan lisent la liste
apps/deal-service/src/services/booking-request.ts                  refunds: [] à la naissance
packages/libs/api-contracts/src/admin/admin-finances.schema.ts     AdminDealMoneyFile.payment.refunds
packages/libs/prisma/scripts/repair-absent-lists.ts, seed-deals.ts refunds (et deliveryPhotoUrls oubliée par le seed)
apps/admin-ui/src/components/FinanceReportView.tsx                 ANO-ADM-39 — downloadFile, période vérifiée, pied en UTC
apps/admin-ui/src/components/DealMoneyView.tsx, lib/format.ts      liste des remboursements, libellés de nature
apps/e2e/src/admin/adm-rpt-rapport.spec.ts                         5 scénarios
```

## Ce que la recette a mesuré d'abord

La pile tournait encore sur le serveur de la branche précédente (sans A166) : la contre-épreuve s'est jouée avant d'écrire
le code, sans worktree. Deux fiches ajoutées, deux rouges :

- **RPT-4** : 10 € remboursés le 15 août, 5 € remboursés aujourd'hui → août passe de `10,00 € ×1` à `0,00 € ×0`.
- **RPT-5** : une demande en attente annulée → « Remboursé » du mois `+28,00 € ×1`, fiche argent `anomaly: OVERSPENT`.

## ANO-ADM-37 : un cumul n'est pas un historique

```ts
// avant — buildFinanceReport
if (inRange(r.refundedAt, from, to) && (r.refundAmountCents ?? 0) > 0) {
  const m = get(r.refundedAt!, cur);
  m.refundedCents += r.refundAmountCents ?? 0;   // le cumul, daté du DERNIER remboursement
  m.refundCount += 1;
}
```

Chaque chemin de remboursement écrit `refundedAt: now, refundAmountCents: previous + montant, refundId`. Le passé est
écrasé. Tant qu'un deal ne recevait qu'un remboursement, c'était invisible ; le remboursement manuel (répétable, § 5.15) et
la médiation après une annulation l'ont rendu courant.

### Le modèle

```prisma
type BookingRefund {
  refundId    String?
  amountCents Int
  refundedAt  DateTime
  kind        String // CANCELLATION | PICKUP_REFUSED | DISPUTE | RETENTION_RESTITUTION | MANUAL
}
model Booking { … refunds BookingRefund[] … }
```

Les champs du dernier état restent : les écrans, le portefeuille, le rapprochement (§ 5.13) et les bornes du remboursement
manuel les lisent déjà et n'ont pas besoin de l'historique.

### Écrire

```ts
export function withRefund(before: RefundHistorySource, entry) {
  return [...refundEntries(before).map(…), entry];
}
// deal-transport.service.ts
refunds: withRefund(booking, { refundId, amountCents: total, refundedAt: now, kind: "PICKUP_REFUSED" }),
```

- La liste est **lue puis réécrite en entier** dans la même transaction que le cumul. Pas de `{ push }` : son comportement
  sur un document où la liste est ABSENTE n'a pas été mesuré, et Prisma+Mongo a déjà trahi deux fois sur un champ absent
  (`{ increment }` → null, filtres de liste) — une réécriture complète ne dépend pas de l'état du document. La garde
  conditionnelle de chaque transition (statut, cumul, `retentionDisposition`) empêche deux écritures concurrentes.
- `withRefund` part de `refundEntries(before)`, pas de `before.refunds` : sur un document antérieur (cumul sans liste), le
  remboursement ancien est **matérialisé en entrée `LEGACY` à sa date** au moment précis où `refundedAt` va être écrasé.
  Sans cela, la part ancienne aurait été datée du nouveau remboursement — ANO-ADM-37 reproduite sur toutes les données
  existantes. RPT-4 joue exactement ce cas.
- L'annulation d'une demande en attente n'ajoute rien (`wasAccepted` faux) : libérer une empreinte n'est pas rembourser.
- Création : `booking-request.ts` et le seed posent `refunds: []` ; `repair-absent-lists.ts` le pose sur l'existant
  (3 documents en local).

### Lire

```ts
export function refundEntries(b) {
  if (!b.capturedAt) return [];                                       // ANO-ADM-38
  const listed = (b.refunds ?? []).map(…);
  const unexplained = (b.refundAmountCents ?? 0) - Σ listed;
  if (unexplained > 0) listed.push({ …, amountCents: unexplained, refundedAt: b.refundedAt ?? b.capturedAt, kind: "LEGACY" });
  return listed.sort(par date);
}
```

- **Rapport** : une entrée = un remboursement dans SON mois. La requête ne change pas : `refundedAt >= from` reste un
  sur-ensemble (le dernier remboursement est postérieur à tous les autres).
- **Export CSV** : un deal entre dans la période si l'un de ses remboursements y tombe ; `refundCount` et
  `refundedInPeriodCents` ajoutés en fin de ligne (les 29 colonnes du cahier gardent leur ordre ; `refundAmountCents` reste
  le cumul, `refundId` le dernier).
- **Chronologie** (§ 5.12) : une ligne `REFUNDED` par remboursement, `detail` = la nature.
- **Bilan** (§ 5.12) : `refundedCents = refundedTotalCents(b)` — plus d'`OVERSPENT` sur une empreinte libérée.
- **Fiche argent** : `payment.refunds` servi (contrat `AdminDealMoneyFile`), affiché ligne par ligne avec nature et
  identifiant.

### L'invariant Σ liste = cumul

```ts
export function refundListExcessCents(b) {
  const listed = Σ (b.refunds ?? []).amountCents;
  if (!b.capturedAt) return listed;                       // aucun remboursement ne peut exister sans débit
  return Math.max(0, listed - (b.refundAmountCents ?? 0)); // moins que le cumul = part LEGACY, normal ; plus = défaut
}
// moneyBalance — après les autres anomalies, prioritaire et à tout moment
if (refundListExcessCents(b) > 0) anomaly = "REFUND_RECORDS_MISMATCH";
```

Deux sources pour un même fait finissent par diverger si rien ne les compare : le bilan de la fiche argent le dit
(« Remboursements incohérents… »), ADM-ARG-3 l'exige sur chaque deal du jeu d'essai et le contre-éprouve en remettant le
cumul de `bzv-held` à zéro. Asymétrie voulue : une liste plus courte que le cumul est l'état normal d'un document antérieur.

## ANO-ADM-39 : l'export oublié

Le § 5.6 avait remplacé `window.open` par `downloadFile` (`apps/admin-ui/src/lib/api.ts`) sur les exports utilisateurs,
trajets, billets, arbitrage. `FinanceReportView.tsx` ouvrait encore un onglet. Désormais :

```ts
const periodProblem = exportPeriodProblem(from, to);                 // jours inclus, 366 au plus, fin ≥ début
const out = await downloadFile(`/admin/finances/export?from=…&to=…`);
setExportMsg({ ok: true, text: `${out.rows} lignes exportées (${out.filename}). L'export est inscrit au journal.` });
// refus : financeExportRefusal(e) — PERIOD_TOO_LONG, INVALID_PERIOD, 403
```

Le serveur nomme le fichier avec le **dernier jour inclus** (`to` est exclu : `new Date(to.getTime() - 1)`), et le pied du
rapport passe par `reportPeriodLabel` (UTC, borne de fin moins un jour) au lieu de `dateTime` en heure locale.

## Ce que la non-régression a appris au harnais

- **Jeu d'essai et réputation** : `seed-deals.ts` remettait à zéro annulations et litiges perdus, pas `completedDealsCount`
  ni les notes. Un deal terminé par une fiche précédente laissait un compteur rémanent ; WEB-PIC-6 échouait selon l'ordre
  des fichiers. Étape « 4bis » du seed : mêmes `count` que `carrierFacts` / `shipperFacts`, seuils `REPUTATION_PARAMS`
  importés du contrat en relatif, notes à 0 (le seed ne crée aucun avis).
- **`Finances.ouvrir`** (`apps/e2e/src/pages/finances.ts`) attend la disparition de « Chargement de tes finances… ».
- **Fiches qui lisaient l'ancien modèle** : ADM-ARG-3 (manœuvre « jamais remboursé » qui efface aussi la liste) et
  ADM-REM-2 (la carte liste les remboursements au lieu d'une ligne « Remboursement »).

## Tests

- deal-service **635** (+20) : invariant Σ liste = cumul (3 : cohérent, incohérent, anomalie de bilan) ; `booking-refunds.spec.ts` (9 : écriture sur liste absente, matérialisation LEGACY à sa
  date, lecture, empreinte libérée, cumul sans date), règles (6 : rapport deux mois, annulation avant capture, document
  antérieur, CSV par période, chronologie, bilan), annulation capturée / en attente (1), geste manuel qui s'ajoute (1) ;
  spec du refus au pickup ajustée. Les écrivains de la médiation n'ont pas de test unitaire (aucun n'existait) : RPT-3 lit
  la liste en base après une décision réelle.
- `apps/e2e` : **437 scénarios** (432 + 5) ; ADM-ARG-3 porte l'invariant et sa contre-épreuve.
- Typecheck des huit projets CI et du harnais ; cinq `openapi.json` régénérés (`AdminDealMoneyFile`, `MoneyBalance`).

# Cahier 02-ADMIN, § 5.17 : pilotage et drilldown — une règle d'argent, une implémentation

*(PR `chore/recette-admin-5-17`, empilée sur #317, 15/09/2026.)*

## Ce qui a été fait

Six scénarios (ADM-PIL-1 à 4 du cahier ; PIL-5, 6 ajoutées), deux anomalies closes (`ANO-ADM-40` majeure, `ANO-ADM-41`
mineure), une décision (`A167`), cinq améliorations.

```
packages/libs/api-contracts/src/booking/booking-refunds.ts   A167 — la règle de A166 déménage (git mv), exportée par l'index
apps/deal-service/src/lib/booking-refunds.ts                 réexportation (les imports de deal-service ne changent pas)
apps/auth-service/src/lib/pilotage.rules.ts                  buildSeries lit refundEntries ; refundDrilldownItems ; corridors filtrés
apps/auth-service/src/controller/admin-pilotage.controller.ts  select refunds ; branche « refunded » du drilldown
apps/admin-ui/src/components/PilotageView.tsx                pied du drilldown en UTC, erreurs en français
apps/admin-ui/src/lib/format.ts                              utcPeriodLabel (reportPeriodLabel s'appuie dessus)
apps/e2e/src/admin/adm-pil-pilotage.spec.ts                  6 scénarios
```

## Ce que la recette a mesuré d'abord

Chaque fiche jouée seule contre le code du § 5.16 (le mode série arrête le fichier au premier rouge) :
- PIL-1, 2, 4 conformes — sur le jeu d'essai neuf, aucun deal n'a deux remboursements : pilotage et rapport concordent ;
- PIL-5 : août pilotage **0 €** / rapport 10 € ; septembre **91,16 €** / 53,16 € ;
- PIL-6 : un corridor du registre sans compteur ressort sur 7 jours, tout à zéro ;
- PIL-3 : pied « du 14 sept. 2026, 02:00 au 21 sept. 2026, 02:00 ».

## ANO-ADM-40 : la copie qui n'a pas suivi

Le pilotage (auth-service) et le rapport (deal-service) calculent le même « Remboursé » dans deux services. Au § 5.16, le
rapport a appris à lire `Booking.refunds` ; le pilotage avait sa propre ligne :

```ts
// avant — buildSeries
if ((b.refundAmountCents ?? 0) > 0) { p = at(b.refundedAt); if (p) fin(p, cur).refundedCents += b.refundAmountCents ?? 0; }
// après
for (const refund of refundEntries(b)) { p = at(refund.refundedAt); if (p) fin(p, cur).refundedCents += refund.amountCents; }
```

`refundEntries` n'était pas importable par auth-service (fichier de deal-service). A167 la déplace dans
`@packages/api-contracts`, déjà résolu par tous les services (tsconfig + alias webpack) :

```sh
git mv apps/deal-service/src/lib/booking-refunds.ts packages/libs/api-contracts/src/booking/booking-refunds.ts
```

et laisse à sa place une réexportation d'une ligne, pour ne toucher aucun import de deal-service. La spec
`booking-refunds.spec.ts` reste dans deal-service (api-contracts n'a pas de projet de tests) et passe par la réexportation.

### Le drilldown « Remboursé »

```ts
export function refundDrilldownItems(bookings, start, end): PilotageDrilldownItem[] {
  for (const b of bookings) for (const r of refundEntries(b))
    if (r.refundedAt in [start, end)) items.push({ kind: "DEAL", id: b.id, at: r.refundedAt, amountCents: r.amountCents, … });
  return items.sort(par date);
}
```

La requête prend `refundedAt >= start` (sur-ensemble : le dernier remboursement d'un deal est postérieur aux autres), le
tri et la borne de 200 se font après. Un deal remboursé deux fois dans la période apparaît deux fois : chaque ligne est un
fait, et Σ lignes = point.

## ANO-ADM-41 : un registre permanent, des compteurs datés

`searchedCorridors(redis)` rend l'ensemble `yamba:stats:search:corridors`, qui ne se vide jamais ; les compteurs
(`…:search:corridor:<corridor>:<jour>`) vivent 400 jours et sont lus sur la fenêtre. `buildCorridors` gardait toute clé du
registre. Désormais :

```ts
if (r.tripsPublished + r.requests + (s?.views ?? 0) + (s?.searches ?? 0) === 0) continue;
```

Redis absent → `stats` vide → un corridor seulement cherché n'apparaît pas (rien d'inventé), les corridors à trajets ou
demandes restent.

## Tests

- auth-service **252** (+3) : courbe « Remboursé » par remboursement et sans empreinte libérée, drilldown un élément par
  remboursement (Σ = point, deux remboursements du même deal), corridors sans activité exclus et Redis absent.
- deal-service **635** (inchangé : la règle est la même, importée autrement).
- `apps/e2e` : **443 scénarios** (437 + 6).
- Typecheck des huit projets CI et du harnais ; OpenAPI inchangé (fonctions pures, aucun schéma).

# Cahier 02-ADMIN, § 5.18 : conversations — ce que la page promet, le serveur le tient

*(PR `chore/recette-admin-5-18`, empilée sur #318, 15/09/2026.)*

## Ce qui a été fait

Cinq scénarios (ADM-CNV-1, 2, 3 du cahier ; CNV-4, 5 ajoutées), quatre anomalies closes (`ANO-ADM-42`, `ANO-ADM-44`
majeures ; `ANO-ADM-43`, `ANO-ADM-45` mineures), une décision (`A168`), quatre améliorations.

```
packages/libs/admin-audit/src/index.ts                        A168 — recordAdminRead, ReadCoalescer, readCoalesceKey
apps/auth-service/src/controller/admin-users.controller.ts    USER_VIEWED coalescé
apps/trip-service/src/controllers/admin-trips.controller.ts   TRIP_VIEWED coalescé
apps/deal-service/src/services/admin-dispute.service.ts       DISPUTE_VIEWED coalescé (coalesceur injecté)
apps/deal-service/src/services/admin-finance.service.ts       DEAL_MONEY_VIEWED coalescé (coalesceur injecté)
apps/deal-service/src/routes/deal.routes.ts                   Redis câblé comme coalesceur des deux services
packages/libs/api-contracts/src/admin/redact-contacts.ts      redactContacts déplacée (surcharges string → string)
apps/deal-service/src/services/admin-history.service.ts       importe et réexporte redactContacts
apps/message-service/src/services/admin-conversation.service.ts  ANO-ADM-42 masquage ; mediationFile ; CONVERSATION_VIEWED coalescé
apps/message-service/src/routes/admin.router.ts               Redis câblé comme coalesceur
packages/libs/api-contracts/src/messaging/messaging.schema.ts AdminConversationResponse.mediationFile
apps/admin-ui/src/components/ConversationView.tsx             « ← Fiche du deal », « ← Dossier de médiation », refus en français
apps/message-service/src/services/admin-conversation-view.spec.ts  4 tests
apps/e2e/src/admin/adm-cnv-conversations.spec.ts              5 scénarios
```

## Ce que la recette a mesuré d'abord

Les cinq fiches, jouées seules contre le code du § 5.17, étaient rouges. Une première série l'était pour une mauvaise
raison — le harnais relisait le journal avec le compte Médiateur, qui n'a pas `audit.read` (403) ; corrigée (relecture par
le super administrateur, cahier § 2.7), la contre-épreuve a mesuré :
- « ← Dossier du deal » → « Ce deal n'est jamais passé en médiation. » ;
- `CONVERSATION_VIEWED` en **deux** exemplaires par ouverture, puis 6 lignes pour 3 ouvertures sur **cinq** écrans ;
- « Appelle-moi plutôt au 06 12 34 56 78 ou écris à thomas.perso@exemple.fr » lu par le Médiateur ;
- la Finance ouvrant l'écran directement : message anglais du serveur.

## ANO-ADM-44 / A168 : une lecture n'est pas un geste

Les écrans admin chargent leur fiche dans un `useEffect` au montage ; le serveur journalise la lecture. En développement,
React (StrictMode) monte, démonte et remonte chaque composant : l'effet part deux fois, deux requêtes, deux lignes. Garder
chaque écran (un `useRef`) ne protégerait pas d'un rechargement réflexe ni d'un futur client. La garde va donc au serveur,
dans la bibliothèque d'audit :

```ts
export async function recordAdminRead(db, coalescer, input, windowSeconds = READ_COALESCE_SECONDS /* 10 */) {
  if (coalescer) {
    let first = true;
    try { first = (await coalescer.set(readCoalesceKey(input), "1", "EX", windowSeconds, "NX")) !== null; }
    catch { first = true; }                  // Redis en panne : un doublon plutôt qu'une lecture perdue
    if (!first) return false;
  }
  await recordAdminAction(db, input);
  return true;
}
// clé : yamba:audit:read:<admin>:<action>:<type>:<cible>
```

- `ReadCoalescer` est un type structurel (`set(key, value, "EX", s, "NX")`) : la bibliothèque reste sans dépendance ;
  ioredis convient tel quel.
- Seules les cinq lectures déclenchées par l'**ouverture** d'un écran l'utilisent. Les lectures déclenchées par un clic
  (document, chronologie, drilldown, exports) et tous les gestes gardent `recordAdminAction`, écrit à chaque fois.
- Dans deal-service et message-service, le coalesceur est **injecté** (argument optionnel du service, Redis câblé par les
  routes) : les specs qui importent ces services n'ouvrent aucune connexion Redis. La spec de la fiche argent, qui simule
  `@packages/admin-audit`, expose `recordAdminRead` délégué au `recordAdminAction` observé.

## ANO-ADM-42 : masquer ce qu'un membre a tapé

```ts
body: m.kind === "TEXT" ? redactContacts(m.body) : m.body,       // messages système : une clé, pas un texte libre
details: redactContacts(r.details),                             // précisions d'un signalement (fil ET file de modération)
message: { id, body: redactContacts(message.body), createdAt }, // file des messages signalés
```

`redactContacts` existait dans deal-service (§ 5.12, erreurs SMTP de la chronologie). Même principe qu'A167 : elle part
dans `@packages/api-contracts` (`admin/redact-contacts.ts`), deal-service l'importe et la réexporte (sa spec ne change pas).
Deux surcharges TypeScript (`string → string`, `string | null → string | null`) évitent un `?? ""` à chaque appel sur un
champ non nullable du contrat.

## ANO-ADM-43 : un lien qui dépend de l'état du deal

Le contrat gagne `mediationFile` : `!!disputedAt || retentionDisposition === "HELD_FOR_MEDIATION" || !!retentionDecidedAt`
— la définition du dossier d'arbitrage d'A160 (`fileKindOf`). L'écran affiche toujours « ← Fiche du deal » et, seulement
si le dossier existe, « ← Dossier de médiation ».

## Tests

- message-service **51** (+4) : masquage (message, précisions, messages système intacts), `mediationFile`, coalescence
  (deux lectures → une ligne, autre admin → sa ligne), `recordAdminRead` Redis en panne et sans coalesceur.
- deal-service 635, auth-service 252, trip-service 292 — inchangés en nombre ; spec de la fiche argent ajustée.
- `apps/e2e` : **448 scénarios** (443 + 5).
- Typecheck des huit projets CI et du harnais ; cinq `openapi.json` régénérés (`AdminConversationResponse`).

# Cahier 02-ADMIN, § 5.19 : signalements — rien de perdu, une décision une fois

*(PR `chore/recette-admin-5-19`, empilée sur #319, 15/09/2026.)*

## Ce qui a été fait

Neuf scénarios (ADM-SIG-1 à 5 du cahier ; SIG-6 à 9 ajoutées), cinq anomalies closes (`ANO-ADM-46`, `ANO-ADM-47`
majeures ; `ANO-ADM-48`, `49`, `50` mineures), aucune décision nouvelle : le rejeu du conflit d'écriture existant
(ANO-API-19, remonté dans `packages/libs/prisma` au § 5.5) est réemployé.

```
apps/auth-service/src/services/report.service.ts                 ANO-ADM-46 rejeu P2034 ; ANO-ADM-47 cible disparue gardée (targetMissing)
apps/message-service/src/services/admin-conversation.service.ts  ANO-ADM-46 rejeu P2034 (file des messages)
packages/libs/api-contracts/src/admin/reports.schema.ts          AdminReportItem.targetMissing
apps/admin-ui/src/lib/format.ts                                  reportRefusalMessage, isAlertTrustLevel
apps/admin-ui/src/components/ReportsQueue.tsx                    bouton occupé, refus par code, « Trajet introuvable » sans lien, badge WATCH / HIGH_RISK seuls
apps/admin-ui/src/components/MessageReportsQueue.tsx             bouton occupé, refus par code (chargement et décision)
apps/admin-ui/src/lib/types.ts                                   targetMissing
apps/auth-service/src/services/report.service.spec.ts            +2 tests
apps/message-service/src/services/admin-report-review.spec.ts    3 tests (nouveau)
apps/e2e/src/admin/adm-sig-signalements.spec.ts                  9 scénarios
apps/*/openapi.json                                              régénérés (targetMissing)
```

## Ce que la recette a mesuré d'abord

Fiche par fiche, sur le code du § 5.18 (corrections mises de côté, bundles auth-service et message-service rebâtis) :
- trois `PATCH` simultanés d'une décision : `[200, 500, 500]` dans les deux files ;
- un signalement OPEN sur un trajet qui n'existe plus : absent de `GET /admin/reports?status=OPEN` ;
- un double clic sur « Traité » : deux `PATCH` au réseau ;
- un compte créé le jour même : badge « Compte neuf » sur la carte ;
- la Finance sur `/reports` : « Your admin profile does not allow this action. » puis « Chargement… » sans fin, deux fois.

## Pourquoi un 500 sur une décision concurrente

La décision s'écrit dans une transaction : `updateMany({ where: { id, status: "OPEN" } })` puis la ligne de journal. La
garde conditionnelle est juste — elle garantit une seule décision. Mais MongoDB ne laisse pas deux transactions modifier
le même document : la seconde est ANNULÉE avec « write conflict » (Prisma `P2034`) avant même d'avoir lu `count: 0`. Le
middleware d'erreur ne connaît pas `P2034` → 500. `withWriteConflictRetry(fn)` rejoue la transaction sur ce seul code ;
au second essai la première décision est validée, la garde lit `count !== 1` et lève `ConflictError`
(`REPORT_ALREADY_REVIEWED`, 409). Toute autre erreur remonte sans rejeu (spec « une autre erreur n'est jamais rejouée »).

```ts
await withWriteConflictRetry(() => db.$transaction(async (tx) => {
  const updated = await tx.report.updateMany({ where: { id: report.id, status: "OPEN" }, data: { status: input.decision } });
  if (updated.count !== 1) throw new ConflictError("This report has already been reviewed.", { code: "REPORT_ALREADY_REVIEWED" });
  await recordAdminAction(tx as never, { … });
}));
```

## Pourquoi un signalement disparaissait

`listReports` joignait chaque signalement à sa cible (trajets et membres lus en lot) et faisait `continue` si la cible
manquait. Or la conservation purge des trajets (et un document membre peut manquer — l'effacement RGPD, lui, anonymise
sans supprimer) : le
signalement restait OPEN en base, hors de toute file. Désormais la carte est rendue avec `targetMissing: true`, un
libellé explicite et `targetOwner: null` ; le compteur `total` et les onglets le comptent ; « Traité » / « Sans suite »
le clôt (la décision ne lit pas la cible). L'écran n'affiche pas de lien vers une fiche qui répondrait 404.

## Côté écran

- `busy` (id de la carte en cours) : le handler sort si une décision est en vol, les deux boutons sont `disabled` — un
  double clic natif n'envoie qu'une requête (React applique l'état avant le second clic, événement discret).
- `reportRefusalMessage(e)` lit `details.code` (A146) : `REPORT_ALREADY_REVIEWED` et `REPORT_NOT_FOUND` → texte français +
  `reload: true` ; `ADMIN_PERMISSION_DENIED` → « Ton profil ne traite pas les signalements. ». Le chargement de la file
  l'utilise aussi et pose `failed` pour ne plus afficher « Chargement… » après un refus.
- `isAlertTrustLevel(level)` : garde de type (`level is "WATCH" | "HIGH_RISK"`) — le badge d'une file n'affiche que ce qui
  appelle la vigilance (D71 : un compte neuf a des plafonds, pas un soupçon).

## Tests

- auth-service **254** (+2) : cible disparue (trajet, membre) gardée et close ; conflit P2034 rejoué → 409, aucune ligne.
- message-service **54** (+3) : P2034 puis garde → 409 ; P2034 puis voie libre → décision, une ligne ; autre erreur non
  rejouée.
- `apps/e2e` : **457 scénarios** (448 + 9). Voisins rejoués : ADM-CNV (5) et WEB-SIG (8) verts.
- Typecheck auth-service, message-service, admin-ui ; cinq `openapi.json` régénérés.


# Cahier 02-ADMIN, § 5.20 : paramètres de la plateforme — un gagnant, un délai tenu, un refus lisible

*(PR `chore/recette-admin-5-20`, empilée sur #320, 15/09/2026.)*

## Ce qui a été fait

Douze scénarios ADM-PAR (1 à 7 du cahier ; 8 à 12 ajoutées), six anomalies closes (`ANO-ADM-51`, `52` majeures ;
`53`, `54`, `55`, `56` mineures), trois arbitrages (A169 échéance de litige figée, A170 refus de page unique, A171 décision de
signalement lue au journal) et trois décisions de l'utilisateur du 15/09 intégrées comme lots à part : libellé `SCAM`
unique, décision visible sous « traité / sans suite », refus de page unique.

```
apps/auth-service/src/services/platform-settings.service.ts     ANO-ADM-51 rejeu P2034 + P2002 → 409 STALE_VERSION ; ANO-ADM-54 codes SETTING_OUT_OF_BOUNDS / SETTINGS_INCOHERENT
apps/auth-service/src/controller/admin-settings.controller.ts   ANO-ADM-53 valeurs de l'email par formatSettingValue ; code INVALID_SETTINGS_REQUEST
apps/auth-service/src/emails/admin-emails.ts                    formatSettingValue(locale, unit, value)
apps/auth-service/src/services/platform-settings.service.ts     ANO-ADM-56 « dernière modification » = même version, même auteur, même transaction
prisma/schema.prisma                                            Dispute.responseDueAt (A169)
apps/deal-service/src/services/deal-settlement.service.ts       responseDueAt écrit à l'ouverture
apps/deal-service/src/services/deal-mediation.service.ts        disputeResponseDeadline / isDisputeDecidable préfèrent responseDueAt
apps/deal-service/src/services/admin-dispute.service.ts         file et dossier : responseDueAt
apps/deal-service/src/services/booking-view.mapper.ts           vue Voyageur : responseDeadlineAt = responseDueAt
apps/deal-service/src/services/ops-alerts.{rules,service}.ts    alerte « litige décidable » : responseDueAt
apps/deal-service/src/controllers/deal.controller.ts            select responseDueAt
packages/libs/prisma/scripts/seed-deals.ts                      responseDueAt sur les litiges du jeu d'essai
apps/admin-ui/src/lib/settings-format.ts                        settingsRefusalMessage ; aperçu « 3,00 € »
apps/admin-ui/src/components/PlatformSettingsEditor.tsx         envoi unique (useRef), refus par code, réinitialisation périmée rechargée
apps/admin-ui/src/components/HomeKpis.tsx                       bandeau « Paramètres modifiés » : libellés, pas les clés
apps/trip-service/src/controllers/pricing-params.controller.ts   Cache-Control « public, no-cache » (le max-age=30 navigateur s'ajoutait au cache 30 s du lecteur)
--- décisions du 15/09 ---
packages/libs/api-contracts/src/admin/report-decision.schema.ts ReportDecisionSchema + reportDecisionsFrom (A171)
packages/libs/api-contracts/src/admin/reports.schema.ts         AdminReportItem.decision
packages/libs/api-contracts/src/messaging/messaging.schema.ts   AdminMessageReportItem.decision
apps/auth-service/src/services/report.service.ts                décision lue au journal (REPORT_REVIEWED)
apps/message-service/src/services/admin-conversation.service.ts décision lue au journal (MESSAGE_REPORT_REVIEWED)
apps/admin-ui/src/lib/format.ts                                 reportDecisionLine ; SCAM « Arnaque suspectée »
apps/admin-ui/src/components/{Reports,MessageReports}Queue.tsx  ligne de décision ; refus de page
apps/admin-ui/src/components/PageAccess.tsx                     refus de page unique (A170)
apps/admin-ui/src/app/(back)/<14 pages>/page.tsx                enveloppées de <PageAccess>
apps/admin-ui/src/components/<12 écrans>.tsx                    lecture principale : 403 → useDenyPage()
apps/user-ui/messages/{fr,en}/messaging.json                    SCAM « Arnaque suspectée » / « Suspected scam »
docs/recette, docs/livrables                                     libellé SCAM aligné
tests : platform-settings.service.spec (+3), admin-emails.spec (4, nouveau), report.service.spec (+1),
        deal-mediation.service.spec (+1), ops-alerts.rules.spec (+1), deal-settlement.service.spec (ajusté),
        admin-report-decision.spec (3, nouveau), admin-report-queue.spec (mock adminAction), pricing-params.controller.spec (1, nouveau)
e2e   : adm-par-parametres.spec.ts (12), adm-sig-signalements.spec.ts (SIG-5 renforcée, SIG-10, SIG-11), web-msg (libellé),
        pages/ecran-admin.ts reouvrirLesLitigesSousUnDelai (ADM-MED, ADM-RPT), adm-acc-accueil (libellé du bandeau), adm-med-mediation (MED-9 attend son email)
```

## Ce que la recette a mesuré d'abord

Premier passage, sur le code du § 5.19 :
- trois `PATCH /admin/settings` simultanés sur un document ABSENT : `[200, 500, 500]` ;
- trois seuils modifiés par l'Exploitation : l'email français dit « 48 hours → 50 hours », « 7 days → 8 days » ;
- une commission de 50 % saisie à l'écran : « 400 : Some values are out of bounds. — pricing.commissionPct : Must be
  between 5 and 20 (percent). » ;
- en lisant le code avant d'écrire la fiche PAR-9 : l'échéance d'un litige ouvert (`disputedAt + delayHours`) était
  recalculée à chaque lecture avec le paramètre COURANT — la vue Voyageur, le dossier, la garde de décision et l'alerte.

Contre-épreuve (corrections mises de côté, bundles auth / deal / message / trip rebâtis) : document absent `[200, 409, 500]`,
présent `[200, 500, 500]` ; PAR-9 : délai ramené à 12 h → échéance du 17/09 10:25 affichée au 14/09 22:25, dans le dossier
d'arbitrage ET dans la vue du Voyageur ; PAR-12, SIG-5, SIG-11 : aucune des quatorze pages ne rendait un bloc de refus ;
SIG-10 : aucune décision servie.

## Pourquoi un 500 quand deux administrateurs enregistrent

Le verrou de version était déjà juste (`updateMany({ where: { key, version } })`, 409 si `count !== 1`). Deux accidents
passaient à côté : (1) sur un document présent, MongoDB annule la transaction perdante (`P2034`) avant la garde — même
cause qu'ANO-ADM-46 ; (2) sur un document ABSENT (après `seed-settings.ts`, ou au premier réglage en production), les
trois transactions voient « pas de document » et font `create` : la clé unique `key` refuse les deux dernières (`P2002`).
Correction : `withWriteConflictRetry` autour de la transaction (au réessai, la version a bougé → 409), et `P2002` sur
cette écriture traduit en `ConflictError(STALE_VERSION)` — la collision de création EST le verrou.

```ts
const nextVersion = await withWriteConflictRetry(() => deps.db.$transaction(async (tx) => { … })).catch((e: unknown) => {
  if ((e as { code?: string } | null)?.code === "P2002") throw new ConflictError("The settings changed meanwhile: reload and try again.", { code: "STALE_VERSION" });
  throw e;
});
```

## Pourquoi figer l'échéance d'un litige (A169)

« Jamais rétroactif » (D62) était tenu pour le prix — snapshot dans le deal — mais pas pour le délai de réponse : il
n'était stocké nulle part. Le Voyageur lit « tu as jusqu'au … » ; si l'on raccourcit le paramètre, la date qu'il a lue
recule et le médiateur peut trancher sans sa version. `Dispute.responseDueAt` est écrit à l'ouverture ; les lecteurs font
`dispute.responseDueAt ?? disputedAt + délai courant`. Champ optionnel : aucune migration, aucun rattrapage — un dossier
antérieur garde le comportement d'avant jusqu'à sa clôture (lecture seulement, cf. le piège Prisma + Mongo sur les champs
absents : ici on ne FILTRE jamais sur `responseDueAt`, on le lit).

## Côté écran

- `settingsRefusalMessage(e, catalog)` lit `details.code` (A146) : pour que la clé fautive atteigne l'écran en production,
  le serveur pose désormais un code sur ses 400 (`SETTING_OUT_OF_BOUNDS`, `SETTINGS_INCOHERENT`,
  `INVALID_SETTINGS_REQUEST`) — sans code, le middleware masque `details` en production.
- Envoi unique : `sending = useRef(false)` testé et posé AVANT le premier `await` ; un `useState` seul ne suffit pas si
  deux clics arrivent avant le rendu.
- `resetAll` : même lecture du refus ; un 409 ferme le panneau, vide les saisies et recharge.
- `PageAccess` (A170) : un contexte React fournit `deny(texte)` ; la page enveloppée se remplace par titre + refus.
- La ligne de décision d'un signalement (`reportDecisionLine`) : « Traité par Nadia le … · note : « … » ».

## Tests

- auth-service **263** (+9), deal-service **637** (+2), message-service **57** (+3), trip-service **293** (+1).
- Harnais aligné sur A169 : ADM-MED et ADM-RPT abaissaient le délai de réponse APRÈS l'ouverture pour rendre un litige
  décidable — c'est précisément ce qui ne marche plus ; `reouvrirLesLitigesSousUnDelai(heures)` pose l'échéance en base
  (manœuvre consignée). ADM-ACC-3, en rejouant, a révélé ANO-ADM-56 : le bandeau d'accueil groupait la dernière écriture
  par sa seule version, réutilisée après une remise à zéro du document.
- `apps/e2e` : **471 scénarios** (457 + 12 ADM-PAR + 2 ADM-SIG).
- Typecheck auth, deal, message, admin-ui, user-ui, harnais ; cinq `openapi.json` régénérés (`ReportDecision`).


# Cahier 02-ADMIN, § 5.21 : données personnelles — une preuve par demande, un effacement par compte, des conditions acceptées qui tiennent

Six scénarios ADM-RGP (1 à 4 du cahier ; 5 et 6 ajoutés), deux ADM-PAR ajoutés (13, 14), quatre anomalies closes
(`ANO-ADM-57`, `58` majeures ; `59`, `60`), et les six arbitrages délégués du 15/09 sur les points ouverts du § 5.20
(A172 → A175). Branche `chore/recette-admin-5-21`, empilée sur `chore/recette-admin-5-20`.

## Ce qui a été corrigé, et pourquoi

- **Registre RGPD journalisé une fois** (`apps/auth-service/src/controller/privacy.controller.ts`, `listDataRequests`) :
  la première page passe par `recordAdminRead(prisma, redis, …)` (A168) ; une page suivante (curseur) reste écrite par
  `recordAdminAction`. Test : `privacy-requests.controller.spec.ts` (le contrôleur est chargé par `require` APRÈS les
  mocks : il construit son service au chargement, un `import` serait remonté avant les constantes des mocks).
- **Effacement concurrent** (`apps/auth-service/src/services/privacy.service.ts`) : la transaction est enveloppée par
  `withWriteConflictRetry` ; un compte absent ou déjà effacé lève `AccountNotFoundError`, que les deux contrôleurs
  (membre, admin) traduisent en 404 `USER_NOT_FOUND`. Tests : conflit puis compte déjà effacé → 404, rien en double,
  pas d'`afterErase` ; conflit puis voie libre → effacé une fois.
- **Carte d'effacement** (`apps/admin-ui/src/components/UserFileView.tsx`) : l'issue (succès, ou « effacé par un autre
  administrateur ») remonte dans la fiche via `onOutcome` — la carte est démontée quand le compte devient `isDeleted` ;
  refus en français par statut ; rechargement sur 404.

## A172 — les conditions d'annulation figées à la création

- Schéma (`prisma/schema.prisma`) : type composite `BookingCancellationTerms { fullRefundUntilHours Int, lateRetentionPct
  Int }`, champ **optionnel** `Booking.cancellationTerms` (les réservations existantes ne l'ont pas : c'est voulu, pas de
  rattrapage).
- Writer unique : `deal-request.service.ts` `createBooking` lit les paramètres UNE fois (`settingsNow`) pour le devis ET
  pour `cancellationParamsFromSettings`, écrit `cancellationTerms` dans le même `booking.create`.
- Lecture : `cancellationParamsForBooking(booking, courants)` (`booking-lifecycle.ts`) — snapshot complet sinon
  courants ; utilisée par `cancel` (`deal-lifecycle.service.ts`) et `toCancellationPreview` (`booking-view.mapper.ts`) ;
  `BOOKING_WRITE_SELECT` sélectionne le champ.
- Tests : `settings-defaults.spec.ts` (règle pure), `booking-view.mapper.spec.ts` (aperçu figé / ancien),
  `deal-lifecycle.service.spec.ts` (barème changé après création → snapshot appliqué ; sans snapshot → courants). Preuve
  navigateur du writer : ADM-PAR-13.
- Déploiement : `npx prisma generate` + `npx prisma db push` + rebâtir deal-service.

## A173 · A174 · A175 — les paramètres

- `platform-settings.service.ts` : `canWrite(actor, key)` factorisé ; `update` refuse les clés inconnues (400), puis la
  PORTÉE (403 `ADMIN_ROLE_CHANGE_DENIED`, détails = le code seul), puis les bornes (400 avec la clé) ; `reset` sans liste
  ne garde que les clés de la portée et renvoie `skipped` (contrat `SettingsWriteResponse.skipped`, optionnel ; aussi
  dans les détails de `NOTHING_TO_RESET`). L'écran envoie toujours une liste explicite : inchangé.
- `seed-settings.ts` : `update` du document avec `values: {}` et `version + 1` au lieu de `delete`. Le harnais ADM-PAR lit
  la version laissée (`base`) ; PAR-7 (repli sûr) et PAR-8 (création concurrente) suppriment le document par manœuvre.
- `settingsCoherenceIssues` : commentaire d'invariant défensif + test direct.

## Chiffres

- auth-service **270** (+7 : ANO-ADM-57 ×2, 58 ×2, A173, A174, invariant) ; deal-service **641** (+4, A172) ; message 57,
  trip 293 inchangés.
- `apps/e2e` : **479 scénarios** (471 + 6 ADM-RGP + 2 ADM-PAR).
- Typecheck auth, deal, admin-ui, harnais ; cinq `openapi.json` régénérés (`SettingsWriteResponse.skipped`).

# Cahier 02-ADMIN, § 5.22 : état des services — dire vrai sur ce qui tourne, ce qui manque et ce qui attend

Sept scénarios ADM-ETA (1 à 3 du cahier ; 4 à 7 ajoutés), ADM-RGP-2 réalignée et ADM-RGP-7 ajoutée, deux anomalies
majeures closes (`ANO-ADM-61`, `62`), cinq arbitrages délégués (A176 → A180) dont les trois lots RGPD proposés au § 5.21.
Branche `chore/recette-admin-5-22`, empilée sur `chore/recette-admin-5-21`.

## Ce qui a été corrigé, et pourquoi

- **Compteurs d'emails (A177, ANO-ADM-61)** — `apps/auth-service/src/controller/admin-status.controller.ts` lisait deux
  `count` (`FAILED`, `SENT`). Le webhook Resend (D35, `notification-service/src/controllers/email-webhook.controller.ts`)
  réécrit le statut en `DELIVERED` / `BOUNCED` / `COMPLAINED` : l'email sortait des deux compteurs. Désormais un seul
  `groupBy({ by: ["status"] })` et une règle pure `emailCounters` (`apps/auth-service/src/utils/status.rules.ts`) ; le
  contrat `AdminStatusResponse.emails` gagne `deliveredLast24h` et `bouncedLast24h`.
- **Seuil « parqué » (A176, ANO-ADM-62)** — `OUTBOX_MAX_RELAY_ATTEMPTS = 10` naît dans
  `packages/libs/api-contracts/src/admin/cron-catalogue.ts` ; `outbox-relay.ts` (deal) et `messaging-relay.ts` (message)
  exportent toujours `MAX_RELAY_ATTEMPTS`, mais égal à la constante partagée ; `requeue-parked-outbox.ts` aussi. Le
  catalogue des paramètres borne `alerts.outboxParkedAttempts` à `[1, OUTBOX_MAX_RELAY_ATTEMPTS]`, et
  `mergeSettingsValues` ramène toute valeur stockée dans les bornes de sa clé (`Math.min(max, Math.max(min, raw))`) — une
  valeur écrite avant le resserrement ne fuit jamais vers un consommateur.
- **Catalogue des crons (A178)** — `CRON_CATALOGUE` (service, nom, expression, `intervalMs`), `missingCrons(runs)` et
  `isCronLate(run, now)` purs. `GET /admin/status` sert `missingCrons` et `crons[].late` (calculé côté serveur, le front ne
  lit plus l'expression cron par expression régulière). Garde-fou : `status.rules.spec.ts` lit
  `apps/*/src/cron/*.cron.ts`, extrait `name: "…"` de l'appel `withHeartbeat` et `SCHEDULE = "…"`, et exige l'égalité
  des deux ensembles — un cron ajouté sans sa ligne au catalogue (ou sans battement) casse la CI.
- **Écran** (`apps/admin-ui/src/components/StatusView.tsx`) — un minuteur de 5 s fait vivre « Relu il y a {n} s » et les
  âges ; `reloadFailure(e)` dit l'échec en français (`role="alert"` quand rien n'a jamais été lu) ; la vérification
  `maintenance` de la passerelle s'affiche « ⏸ » en ambre et le bandeau mentionne la lecture seule ; « démarré » passe
  par `ago()` ; bandeau ambre des crons absents ; bloc emails à trois lignes.
- **Battement de `payout-bookings`** — `runPayoutPasses` rend `{ completed, retried, reminded }` et `payoutPassesSummary`
  le résume (le battement disait « ok » seul).

## A179 — l'effacement et la réservation ne se croisent plus

- **Recompter dans la transaction** (`apps/auth-service/src/services/privacy.service.ts`) : la pré-vérification hors
  transaction reste (elle inscrit le refus au registre sans ouvrir de transaction) ; DANS la transaction, après la relecture
  du `User`, `erasureBlockers(tx, userId)` recompte. Un bloqueur découvert là lève `ErasureBlockedError` ; le `catch`
  autour de `withWriteConflictRetry` inscrit le refus au registre HORS de la transaction annulée (`refuse(check)`).
- **Clôture par la réservation** (`apps/deal-service/src/services/booking-request.ts`, `fenceShipperAccount`) : dans la
  transaction de `createBooking`, `tx.user.updateMany({ where: { id, isDeleted: false }, data: { updatedAt: now } })`.
  Pourquoi écrire ? Une transaction MongoDB lit un instantané : elle ne voit pas ce qu'une autre transaction valide après
  son début, et deux transactions qui écrivent des documents DIFFÉRENTS ne se gênent jamais. En écrivant le même `User`
  que l'effacement, les deux transactions entrent en conflit ; MongoDB en rejette une (P2034), `withWriteConflictRetry`
  la rejoue et le rejeu voit l'autre. `count === 0` (compte effacé) → 409 `ACCOUNT_DELETED` (nouveau code de
  `BOOKING_REQUEST_ERROR_CODES`, traduit FR/EN dans `messages/*/booking.json`, décrit dans l'OpenAPI de deal-service).
- **Avant le clic** : `GET /admin/users/:id/erasure-blockers` (`adminErasureBlockers`, permission `users.erase`, contrat
  `ErasureCheckResponse`, non journalisé) ; `EraseCard` le lit au montage, affiche les libellés et garde le bouton inactif.
- **Registre d'un membre** : `listDataRequests` accepte `?userId=` (ObjectId sinon 400 `INVALID_ID`), la ligne
  `DATA_REQUESTS_VIEWED` porte le membre en `targetId` ; `DataRequestsList` lit `useSearchParams()` — d'où la frontière
  `<Suspense>` ajoutée dans `app/(back)/privacy/page.tsx` (Next refuse `useSearchParams` sans elle au rendu statique).
- **A180** : aucun code — alternative écartée au registre.

## Harnais

- `adm-eta-etat-services.spec.ts` : `pidDuPort` (`lsof`), `relancerMessageService` (spawn détaché, log dans `tmpdir()`),
  `redis(script)` via `lireCoteServeur` ; relectures « espacées » (StrictMode double la première) ; stabilisation des
  compteurs d'emails avant ETA-4.
- `adm-rgp-donnees-personnelles.spec.ts` : RGP-2 lit les bloqueurs avant le clic et prouve le refus serveur par appel
  direct ; RGP-7 ajoutée.

## Chiffres

- auth-service **282** (+12 : `status.rules.spec.ts` ×7, `privacy.service.spec.ts` ×2 A179, `privacy-requests.controller.spec.ts` ×3) ;
  deal-service **643** (+2, `booking-request-fence.spec.ts`) ; message 57, trip 293, notification 122 inchangés.
- `apps/e2e` : **487 scénarios** (479 + 7 ADM-ETA + ADM-RGP-7).
- Typecheck auth, deal, message, admin-ui, user-ui, harnais ; cinq `openapi.json` régénérés ; `YAMBA-PARAMETRES.md`
  régénéré (borne de `alerts.outboxParkedAttempts`).
- Déploiement : rebâtir auth, deal, message (aucun changement de schéma Prisma).

# Cahier 02-ADMIN, § 5.23 : maintenance — des transitions, pas des valeurs, et l'interrupteur lu là où il s'applique

Six scénarios ADM-MNT (1 à 4 du cahier ; 5, 6 ajoutés), ADM-ETA-8, 9 et ADM-RGP-8 ajoutées, ADM-RGP-2 réalignée, quatre
anomalies majeures et une mineure closes (`ANO-ADM-63` à `67`), deux arbitrages délégués (A181, A182) et les trois lots
proposés au § 5.22. Branche `chore/recette-admin-5-23`, empilée sur `chore/recette-admin-5-22`.

## Ce qui a été corrigé, et pourquoi

- **Transitions de la maintenance (A181, ANO-ADM-63, 67)** — `apps/auth-service/src/services/maintenance.service.ts`
  gagne deux fonctions pures. `resolveMaintenanceWrite(before, body, now)` calcule ce qui est réellement écrit : lever
  (`before.enabled && !body.enabled`) remet `scheduledAt` à `null` ; une date d'annonce NOUVELLE (différente de celle
  stockée) et passée, hors lecture seule, lève `ValidationError` `MAINTENANCE_SCHEDULE_IN_PAST` — une date devenue passée
  mais déjà enregistrée ne bloque pas une autre modification. Elle est appelée DANS la transaction, sur l'état relu.
  `maintenanceChangeKind(before, after)` rend `ENABLED | LIFTED | SCHEDULED | UNSCHEDULED | UPDATED` ; la notification
  la reçoit (`kind`) et `apps/auth-service/src/emails/admin-emails.ts` choisit sujet, titre et phrase par transition, FR
  et EN.
- **Conflits (ANO-ADM-65)** — la transaction est enveloppée dans `withWriteConflictRetry`
  (`packages/libs/prisma/write-conflict-retry.ts`) : au rejeu, le verrou `expectedVersion` répond 409 `STALE_VERSION`.
  Document absent : deux `create` concurrents butent sur la clé unique `key` (`P2002`) — ce n'est pas un conflit à
  rejouer, c'est déjà la réponse, traduite en 409 `STALE_VERSION` dans le `catch`.
- **Interrupteur d'environnement (A182, ANO-ADM-64)** — `packages/libs/maintenance/index.ts` exporte
  `MAINTENANCE_ENV_CHECK_ERROR = "maintenance (env)"`, `maintenanceCheckError(state)` (utilisé par `/gateway-health` dans
  `apps/api-gateway/src/main.ts`) et `isForcedByEnvironment(report)`. Le service reçoit `forcedByEnvironment()` :
  `admin-status.controller.ts` sonde `/gateway-health` (repli : `process.env.MAINTENANCE_MODE` local si le gateway ne
  répond pas) ; `GET /admin/status` réutilise la santé du gateway déjà sondée (`read({ envOverride })`, pas de seconde
  sonde). `update()` refuse d'emblée 409 `MAINTENANCE_FORCED_BY_ENVIRONMENT` : ni écriture, ni journal, ni email.
- **Écran** (`apps/admin-ui/src/components/StatusView.tsx`, `MaintenanceEditor`) — `toLocalDateTimeInput(iso)`
  (`lib/format.ts`) remplace `iso.slice(0, 16)` (ANO-ADM-66) ; l'effet qui recopie l'état dans le formulaire dépend de
  `state.version` et non plus de l'objet `state` recréé à chaque sondage ; `maintenanceRefusal(e)` lit `details.code` ;
  `envOverride` → paragraphe explicatif à la place du formulaire.
- **Gateway** (`apps/api-gateway/src/libs/maintenance.ts`) — le 503 porte aussi `details: { code: "MAINTENANCE" }`.

## Les lots du § 5.22

- **a, retard du relais** — `outboxLagMinutes(oldest, now)` et `isOutboxLagging(oldest, now, seuil)` dans
  `packages/libs/api-contracts/src/admin/cron-catalogue.ts` (à côté de `OUTBOX_MAX_RELAY_ATTEMPTS`). `evaluateAlerts`
  (`apps/deal-service/src/services/ops-alerts.rules.ts`) les utilise ; `getStatus` sert `outbox.lagMinutes`,
  `lagThresholdMinutes` (`alerts.outboxLagMinutes`), `lagging`. L'écran ne compare rien : il colore selon `lagging`. Test
  « l'alerte et la page tranchent pareil » dans `ops-alerts.rules.spec.ts`.
- **b, bloqueurs comptés** — `GET /admin/users/:id/erasure-blockers` renvoyait déjà `counts` ; `EraseCard`
  (`UserFileView.tsx`) les garde (lecture et refus 409) et `erasureBlockerLabel(blocker, count)` accorde le pluriel.
- **c, service injoignable** — middleware d'erreur Express à quatre paramètres placé après le proxy fourre-tout : codes
  `ECONNREFUSED`, `ECONNRESET`, `ETIMEDOUT`, `EHOSTUNREACH`, `ENOTFOUND` → 502 JSON `UPSTREAM_UNREACHABLE` (jamais
  l'adresse interne) ; les autres erreurs suivent leur cours. `StatusView` retient l'heure de la dernière relecture
  réussie et affiche le bandeau quand le code est `UPSTREAM_UNREACHABLE`.

## Harnais

- `adm-mnt-maintenance.spec.ts` : `relancerLeGateway(forcer)` tue le processus du port 8080 (`lsof -t`) et relance
  `dist/main.js` détaché avec `env` explicite ; `remettreAPlat()` en base avant / après ; journal lu par une session
  super administrateur (l'Exploitation n'a pas `audit.read`).
- `adm-eta-etat-services.spec.ts` : ETA-8 (événement d'un agrégat sans relais, vieilli), ETA-9 (auth-service tué puis
  relancé en `finally`). `adm-rgp-donnees-personnelles.spec.ts` : RGP-8, RGP-2 réalignée.

## Vérifications

- Tests : auth-service **293** (+11), deal-service **644** (+1) ; harnais **496 scénarios** (487 + MNT 6 + ETA-8, 9 +
  RGP-8).
- Typecheck auth, deal, message, trip, notification, gateway, admin-ui, harnais ; cinq `openapi.json` régénérés ;
  `YAMBA-PARAMETRES.md` régénéré (consommateur auth-service de `alerts.outboxLagMinutes`).
- Déploiement : rebâtir auth-service, deal-service et api-gateway ; aucun changement de schéma Prisma.

# Cahier 02-ADMIN, § 5.24 : journal d'audit — un filtre qui ment invalide la preuve de tout le cahier

Sept scénarios ADM-JRN (1 à 4 du cahier ; 5 à 7 ajoutés), ADM-ETA-10 et ADM-MNT-7, 8 ajoutées (lots du § 5.23), quatre
anomalies majeures et trois mineures closes (`ANO-ADM-68` à `74`), deux décisions inscrites au registre avant le code
(A183, A184). Branche `chore/recette-admin-5-24`, empilée sur `chore/recette-admin-5-23`.

## Ce qui a été corrigé, et pourquoi

- **Auteur filtré côté serveur (ANO-ADM-68)** — « Filtrer sur cet auteur » écrivait le nom dans la recherche libre, qui ne
  porte que sur les 50 lignes chargées : le geste ADM-JRN-3 « filtrer sur le Médiateur, dérouler » ne montrait jamais les
  lignes au-delà de la première page. `listAdminAudit` (`apps/auth-service/src/controller/admin-auth.controller.ts`) sert
  désormais `adminUserId` dans chaque ligne (`AdminAuditItemSchema`, `packages/libs/api-contracts/src/auth/member-auth.schema.ts`) ;
  `AuditTable.tsx` pose le filtre serveur et affiche une pastille « Auteur : {nom} ✕ » (le filtre existait côté serveur
  depuis A149, aucun écran ne s'en servait).
- **Journées locales (ANO-ADM-69)** — le champ `<input type="date">` rend `2026-09-15` ; envoyé tel quel, le serveur le lit
  `new Date("2026-09-15")` = minuit **UTC**. À Paris l'été, « du 15 au 15 » commençait à 02:00 et débordait sur le 16
  jusqu'à 01:59. `localBound(day, end)` construit `new Date("2026-09-15T00:00:00.000")` (sans `Z` : heure locale) et envoie
  `toISOString()` ; le serveur, qui accepte déjà un instant ISO, n'a pas changé.
- **Catalogues fermés (A183, ANO-ADM-70, 71)** — `packages/libs/admin-audit/src/index.ts` exporte `ADMIN_TARGET_TYPES`
  (`USER`, `BOOKING`, `TRIP`, `CONVERSATION`, `REPORT`, `SESSION`, `SETTINGS`) et type `AdminActionInput.action` /
  `targetType` sur les deux catalogues (plus de `| (string & {})`). Le typage a débusqué deux écrivains qui élargissaient la
  valeur en `string` (`privacy.controller.ts` : `as const` ; `admin-finance.service.ts` : paramètre `AdminActionType`).
  L'écran : `ACTIONS` = toutes les clés de `ACTION_LABEL` triées par libellé (le select se construisait sur les lignes
  chargées : un filtre posé cachait toutes les autres actions) ; `TARGET_TYPE_LABEL` en français (le select proposait
  `DISPUTE`, `MAINTENANCE`, `EXPORT`, jamais écrits, et oubliait `CONVERSATION`). admin-ui n'importe pas `@packages/*` : les
  listes sont des miroirs, et c'est le harnais (ADM-JRN-2) qui compare les deux côtés, plus la base (`groupBy`).
- **Panne lisible (ANO-ADM-72)** — une lecture en échec laissait `items` vide et affichait « Aucune action journalisée. ».
  État `error` + bloc `role="alert"` + « Réessayer » ; « Charger la suite » en échec ne jette plus une promesse rejetée.
  Un compteur `seq` (`useRef`) ignore la réponse d'une lecture dépassée : taper vite dans un filtre ne laisse plus une
  réponse ancienne écraser la dernière.
- **Détail lisible (ANO-ADM-73)** — `auditDetail(after)` (`apps/admin-ui/src/lib/format.ts`) aplatit listes (`, `), objets
  imbriqués et objets vides (« aucun ») ; utilisé par le journal ET les cartes « Actions admin sur ce compte / ce trajet »
  (`UserFileView.tsx`, `TripFileView.tsx`), qui faisaient `JSON.stringify(a.after)`.
- **Identifiant de cible non ObjectId (ANO-ADM-74)** — `buildAuditWhere` (`apps/auth-service/src/lib/admin-audit.query.ts`)
  n'acceptait qu'un ObjectId : une clé de paramètre (`pricing.commissionPct`), `maintenance` ou l'identifiant d'une session
  (32 hex) étaient IGNORÉS, et l'écran affichait le champ rempli au-dessus de toutes les lignes `SETTINGS`. Jeu de
  caractères sûr `^[A-Za-z0-9._:-]{1,100}$` ; l'écran signale « Ignoré (format non reconnu) : … » pour tout champ rempli
  que `appliedFilters` ne reprend pas. OpenAPI documente le motif.
- **Index** — `@@index([ip, createdAt])` sur `AdminAction` (`prisma/schema.prisma`) : le filtre IP parcourait la collection.
  `prisma db push` au déploiement.

## Les lots du § 5.23 (A184)

- **a, garde de session** — `AdminShell.tsx` : `ApiError.status === 401` → `/login` ; toute autre erreur → écran
  « Back-office momentanément injoignable » + « Réessayer » (compteur `attempt` dans les dépendances de l'effet). Le
  rafraîchissement d'`apiFetch` ne se déclenche que sur 401 : un 502 ne passe jamais par lui.
- **b, rythme du bandeau** — `maintenancePollMs(state, now)` (`packages/libs/maintenance/index.ts`) : 15 s si active ou
  annoncée, 60 s sinon. `MaintenanceBanner.tsx` (user-ui) sépare la lecture d'ouverture du minuteur, dont l'effet dépend de
  `pollMs`. user-ui gagne l'alias `@packages/libs/maintenance` dans `paths` ET `include` de `tsconfig.json` (sinon TS6307).
- **c, exemptions par segment** — `isExemptPath(path)` : `p === prefix || p.startsWith(prefix + "/")`, en minuscules.
  Avant, `"/api/maintenance"` sans barre finale exemptait `/api/maintenanceX`.

## Harnais

- `adm-jrn-journal.spec.ts` : lit ce que l'écran demande (URL de la requête `/api/admin/audit`, `appliedFilters`) plutôt
  que de supposer ; importe `ADMIN_ACTIONS` / `ADMIN_TARGET_TYPES` et `ACTION_LABEL` / `TARGET_TYPE_LABEL` pour comparer les
  catalogues ; `alerte(page)` exclut l'annonceur de route de Next (`#__next-route-announcer__`, lui aussi `role="alert"`) ;
  ADM-JRN-5 simule la panne par `page.route` (502 JSON).
- `adm-eta-etat-services.spec.ts` : ETA-10 tue auth-service, navigue (« Mes sessions »), vérifie l'absence de `/login`,
  relance en `finally`. `adm-mnt-maintenance.spec.ts` : MNT-7 horodate les requêtes `/api/maintenance` du navigateur
  membre ; MNT-8 poste sur des chemins voisins des préfixes en lecture seule.

## Vérifications

- Tests : auth-service **296** (+3 : `admin-audit.query.spec.ts` 1, `maintenance-rules.spec.ts` 2), deal-service **644**,
  message-service **57** (inchangés, typage seulement) ; harnais **506 scénarios** (496 + JRN 7, ETA-10, MNT-7, 8).
- Contre-épreuve : écran et garde d'origine remis (admin-ui rechargé à chaud) → JRN-1, 2, 3, 5, 6, 7 rouges (JRN-4 ne
  touche aucun code corrigé) ; `AdminShell`, bandeau et règle d'exemption d'origine (gateway rebâti) → ETA-10, MNT-7, 8
  rouges ; `buildAuditWhere` d'origine (auth-service rebâti) → JRN-3 rouge (clé de paramètre ignorée).
- Typecheck auth, deal, trip, message, notification, gateway, admin-ui, user-ui, harnais ; cinq `openapi.json`
  régénérés.
- Déploiement : `prisma generate` + `prisma db push` (index), rebâtir auth-service, deal-service (types seulement) et
  api-gateway.

# Cahier 02-ADMIN, § 5.25 : comptes admin — la porte du back-office sous gestes simultanés

Onze scénarios ADM-CPT (1 à 5 du cahier ; 6 à 9 ajoutés ; 10 et 11 pour les lots décidés au § 5.24), cinq anomalies
majeures et une mineure closes (`ANO-ADM-75` à `80`), trois décisions inscrites au registre avant le code (A185, A186,
A187). Branche `chore/recette-admin-5-25`, empilée sur `chore/recette-admin-5-24`.

## Ce qui a été corrigé, et pourquoi

- **Règles pures (`apps/auth-service/src/utils/admin-accounts.rules.ts`)** — `inviteMode(existing)` rend `NEW`,
  `GRANT_ACCESS` (compte avec mot de passe), `PASSWORD_LINK` (compte sans mot de passe) ou `REFUSED`
  (`ADMIN_ALREADY_GRANTED`, `ACCOUNT_DELETED`) ; `removesSuperAdmin(before, after)` ; `inServiceSuperAdminsWhere(cible)` ;
  les clés Redis `inviteKey` / `inviteUserKey` ; `isUniqueViolation`. Le contrôleur ne décide plus rien lui-même.
- **Compte sans mot de passe réinvité (ANO-ADM-75)** — la branche « compte existant » envoyait toujours
  `adminAccessGranted` (lien vers `/login`). Un invité retiré avant d'avoir accepté n'a pas de `passwordHash` : il ne
  pouvait plus jamais entrer. `PASSWORD_LINK` émet un jeton et `adminInvite` ; la réponse porte `passwordRequired`
  (`InviteAdminResponseSchema`, `packages/libs/api-contracts/src/auth/member-auth.schema.ts`).
- **Un lien vivant par compte (ANO-ADM-76, A185 a)** — `issueInviteToken(userId)` lit `admin_invite_user:<id>`, efface
  l'ancien `admin_invite:<jeton>`, pose le nouveau (48 h) ; `dropInviteToken(userId)` est appelé par `revokeAdmin`. Avant :
  le jeton de la première invitation, inoffensif tant que le compte n'avait pas de profil, redevenait valide à la
  réinvitation.
- **Lien à usage unique sous clics simultanés (ANO-ADM-77, A185 b)** — `acceptAdminInvite` valide le mot de passe, puis
  RÉCLAME le jeton (`redis.del(key) !== 1` → 400 `INVITATION_INVALID`) avant la transaction ; en cas d'échec de la
  transaction, le jeton est reposé pour son TTL restant. Avant : `get` → écriture → `del`, trois clics = trois mots de passe
  et trois lignes `ADMIN_INVITE_ACCEPTED`.
- **Dernier super administrateur sous gestes croisés (ANO-ADM-78, A186)** — `updateAdminRole` et `revokeAdmin` comptaient
  `superAdminCount()` HORS transaction : deux super administrateurs qui se rétrogradent au même instant voyaient chacun
  « 2 », les deux passaient. Désormais, dans une transaction rejouée (`withWriteConflictRetry`) : relire la cible, puis, si
  le geste retire `SUPER_ADMIN`, `assertAnotherSuperAdminInService(tx, cible)` écrit le document de garde
  `PlatformSettings { key: "admin-accounts" }` (`version` + 1) et compte `inServiceSuperAdminsWhere(cible)` (non supprimé,
  mot de passe, 2FA). L'écriture commune transforme le « write skew » en conflit d'écriture (`P2034`) ; la transaction
  rejouée recompte et répond 403 `LAST_SUPER_ADMIN`. `ensureGuardDocument()` crée la garde hors transaction (une création
  concurrente lève `P2002`, ignorée). `superAdminCount` (`utils/admin-roles.ts`) est supprimé : il comptait une invitation
  en attente comme un filet. La garde `ADMIN_IS_SELF` passe avant toute lecture.
- **Invitations simultanées (ANO-ADM-79, A185 d)** — adresse inconnue : `P2002` (unicité `emailNormalized`) → 400
  `ADMIN_ALREADY_GRANTED` au lieu de 500 ; compte existant : la transaction relit le compte (`inviteMode(fresh)`) et
  l'écriture concurrente du même document est rejouée → le perdant lit le profil posé → 400, ni ligne ni email. Un compte
  `isDeleted` n'est jamais promu (400 `ACCOUNT_DELETED`).
- **Écran en français (ANO-ADM-80, mineure)** — `AdminsManager.tsx` affichait `403 : You cannot change your own profile.`,
  `InviteAccept.tsx` le message anglais du serveur. `adminAccountRefusalMessage(err)` (`apps/admin-ui/src/lib/format.ts`) lit
  `details.code` et dit s'il faut recharger la liste ; la ligne de l'administrateur connecté affiche « (toi) », des cases
  désactivées et « ton accès » à la place de « Retirer » ; le message porte `data-testid="admins-message"` et `role="status"`.
  OpenAPI : les 403 `ADMIN_IS_SELF` / `LAST_SUPER_ADMIN` étaient documentés en 409 sur `DELETE`, absents sur `PATCH`.

## Lots décidés au § 5.24 (A187)

- **a. Auteur choisi dans une liste** — `GET /admin/audit/authors` (`audit.read`, `listAdminAuditAuthors`) : `groupBy`
  des `adminUserId` du journal, noms lus en base, `auditAuthors(ids, users)` (pur, `apps/auth-service/src/lib/admin-audit.query.ts`)
  trie par nom et marque `active: false` un admin retiré. `AuditTable.tsx` : select « Auteur » (option « (accès retiré) »),
  la pastille reste. Pas `/admin/admins` : réservé à `admins.manage`, et il oublie les admins retirés.
- **b. « avant → après »** — `auditChange(before, after)` et `auditChangeKeys(before)` (`format.ts`) : champ par champ,
  profils et statut traduits, forme `{ key, value }` des paramètres, clés sensibles jamais lues ; la cellule « Détail »
  affiche la ligne de changement (`data-testid="audit-change"`) puis le reste de `after` sans répéter les champs dits.
  `auditDetail(after, omit)` gagne un second paramètre.
- **c. Export du journal filtré** — `GET /admin/audit/export` (`exportAdminAudit`) : `auditQueryFrom(req.query)` →
  `buildAuditWhere` → `take: EXPORT_MAX_ROWS + 1` → `capExportRows` → `auditCsvRow` (JSON fidèle de `before` / `after`) →
  `buildCsv(AUDIT_CSV_COLUMNS, …)` ; ligne `EXPORTED` `{ domain: "audit", personal: true, reason, filters:
  appliedAuditFilterValues(q), rows, truncated }`. Route gardée par `requireAdminPermission("audit.read")` PUIS
  `requireAdminPermission("exports.personal")`. À l'écran, `ExportButton` (`personal`) reçoit `query(filters)` : il ne
  s'affiche que pour qui a `exports.personal`, et la page n'est lisible qu'avec `audit.read`.

## Harnais

`apps/e2e/src/admin/adm-cpt-comptes-admin.spec.ts`. Les administrateurs « jetables » sont posés en base par
`creerAdminEnrole` (mot de passe du seed, secret TOTP connu, manœuvre consignée) et connectés par l'API
(`connecterParApi` : `/auth/admin/login` puis `/auth/admin/totp/verify`) ; chaque fiche retire ce qu'elle a ouvert.
ADM-CPT-8 mesure d'abord les AUTRES super administrateurs en service : sur le poste, le compte du propriétaire en est un,
la course ne peut donc pas fermer la porte et l'attendu devient « les deux passent, la garde est écrite deux fois » ; sans
lui, « un 200, un 403 `LAST_SUPER_ADMIN` ». `restaurerLeSuperAdministrateur()` remet le super administrateur du seed en
`finally`. ADM-JRN-3 est réalignée : un paramètre se lit « clé : avant → après », puis le motif.

## Vérifications

- Tests : auth-service (+23 : `admin-accounts.rules.spec.ts` 8, `admin-admins.controller.spec.ts` 12,
  `admin-audit.query.spec.ts` 3) ; harnais **517 scénarios** (506 + CPT 11).
- Typecheck auth-service, admin-ui, harnais ; cinq `openapi.json` régénérés.
- Déploiement : rebâtir auth-service ; aucun changement de schéma (le document de garde est créé à la première écriture).

---

# Cahier 02-ADMIN, § 5.26 : mes sessions — une session qu'on reconnaît, une déconnexion qui ne ment pas

Cinq scénarios ADM-SES (1 du cahier ; 2 à 5 ajoutés) et deux fiches ADM-CPT (12, 13) pour les lots décidés au § 5.25 ;
deux anomalies majeures et deux mineures closes (`ANO-ADM-81` à `84`) ; deux décisions inscrites au registre avant le code
(A188, A189). Branche `chore/recette-admin-5-26`, empilée sur `chore/recette-admin-5-25`. Dernier chapitre du § 5.

## Ce qui a été corrigé, et pourquoi

- **Une session se reconnaît (ANO-ADM-81, A188 a)** — `AdminSessionRecord` (`apps/auth-service/src/utils/admin-session.ts`)
  ne portait que `createdAt` / `lastActivityAt`. Il porte désormais, en option, `ip`, `userAgent` (tronqué par
  `shortUserAgent`, 200 caractères) et `device` (`describeUserAgent`, le libellé « Chrome · macOS » de D65) :
  `adminSessionClient(req)` les lit, `storeAdminSession(userId, jti, createdAt, now, client)` les écrit.
  `issueAdminSession(req, res, user)` (dans `admin-auth.controller.ts`) les pose à l'ouverture ; `adminRefresh` les RECOPIE
  depuis l'ancien enregistrement (`session.device ? session : adminSessionClient(req)`) — l'appareil d'ouverture suit la
  session à travers les rotations du jti, et une session d'avant la correction devient reconnaissable à son premier
  renouvellement. `listAdminSessions` sert `device` (« Appareil inconnu » si absent) et `ip` ; l'user-agent brut ne
  quitte pas Redis. Contrat : `AdminSessionItemSchema` gagne `device` et `ip` (`admin-users.schema.ts`).
- **Le journal ne compte que ce qui a eu lieu (ANO-ADM-83, A188 b)** — `revokeAdminSession` rend
  `(await redis.del(clé)) === 1`. `adminLogout` n'écrit `ADMIN_LOGOUT` que si la session existait (un rejeu du même jeton
  répond 200, sans ligne) ; `revokeAdminSessionById` répond 404 `ADMIN_SESSION_NOT_FOUND` sans ligne pour une session
  absente. `DEL` sert ici deux fois : c'est l'effacement ET la preuve qu'il a eu lieu, sans lecture préalable (pas de
  fenêtre entre « existe-t-elle ? » et « efface-la »).
- **« Se déconnecter » ne ment plus (ANO-ADM-82, A188 c)** — `AdminShell.tsx` faisait
  `await post("/auth/admin/logout").catch(() => undefined); router.replace("/login")`. Les cookies `admin_*` sont
  `httpOnly` : seul le serveur peut les effacer ; un 502 laissait la session ouverte derrière un écran de connexion.
  Désormais `/login` après un 200 ou un 401 (session déjà close), sinon un `role="alert"` « Déconnexion impossible : le
  service ne répond pas, ta session est toujours ouverte. » ; le bouton passe « Déconnexion… » et ne part qu'une fois.
  `SessionsList.tsx` applique la même règle à « Révoquer » sa propre session.
- **L'écran parle juste (ANO-ADM-84)** — `backupCodesWarning(n)` (`apps/admin-ui/src/lib/format.ts`) accorde le pluriel et,
  à zéro, dit le recours (un super administrateur réinitialise la double authentification) ; `SessionsList` distingue
  « chargement », « panne » (`role="alert"` + « Réessayer ») et « liste vide », verrouille « Révoquer » pendant l'envoi et
  lit un 404 comme « Cette session était déjà fermée. ».

## Lots décidés au § 5.25 (A189)

- **a. Renvoyer une invitation** — `POST /admin/admins/:id/invite/resend` (`resendAdminInvite`, `admins.manage`) :
  `isPendingInvitation(user)` (règle pure, `admin-accounts.rules.ts` : profil admin, pas de mot de passe, non supprimé),
  sinon 409 `ADMIN_INVITE_NOT_PENDING` ; `issueInviteToken` (A185 : l'ancien lien meurt), email `adminInvite`, ligne
  `ADMIN_INVITE_RESENT` (ajoutée à `ADMIN_ACTIONS`, `packages/libs/admin-audit`, et à son libellé `format.ts` — la liste
  fermée d'A183 fait échouer la compilation si l'un manque). `listAdmins` ajoute `inviteExpiresAt` (TTL Redis de
  `admin_invite_user:<id>`, `null` sans lien vivant) ; `AdminsManager` affiche « lien valable jusqu'au … » ou « lien
  expiré » et le bouton « Renvoyer l'invitation ».
- **b. Motif facultatif du retrait** — `RevokeAdminRequestSchema` (`{ reason?: string }`, trim, ≤ 500) ; `revokeAdmin` écrit
  `after: { reason }` seulement s'il est non vide. Pas de `.transform()` dans un schéma du registre Zod : le générateur
  OpenAPI refuse (« Transforms cannot be represented in JSON Schema ») — la chaîne vide est ramenée à `undefined` dans le
  contrôleur. À l'écran, `window.confirm` devient `window.prompt` (Annuler renonce, champ vide = sans motif).
- **c. Emails de sécurité** — `adminRolesChanged` et `adminAccessRevoked` (`apps/auth-service/src/emails/admin-emails.ts`,
  FR/EN, `notice` de ton `warning`), SANS `cta` ni motif. `notifyAccessChange(userId, build)` relit le compte APRÈS la
  transaction, saute `isDeleted` / `emailSuppressedAt` (`canReceiveAccountEmail`), n'échoue jamais. `updateAdminRole`
  n'écrit que si `rolesChanged(before, next)` (l'ordre ne compte pas).

## Harnais

`apps/e2e/src/admin/adm-ses-mes-sessions.spec.ts` : administrateurs jetables enrôlés en base (`creerAdminEnrole`, avec un
nombre de codes de secours réglable), connectés par l'écran dans un contexte au user-agent choisi (`navigateurDe`) ;
`retirerLAcces` en `finally`. SES-3 et 5 simulent la panne par `page.route(…, fulfill 502)`. ADM-CPT-12 et 13 dans
`adm-cpt-comptes-admin.spec.ts` ; CPT-4 réalignée sur l'invite du motif. Piège de poste : `npx nx build auth-service` sans
`--skip-sync` s'est arrêté sur la question « sync generators » en mode non interactif, sans rebâtir — le bundle relancé
était l'ancien ; toujours vérifier une chaîne attendue dans `dist/main.js` (`grep -c`).

## Vérifications

- Tests : auth-service **334** (+15 : `admin-auth-sessions.controller.spec.ts` 5, `admin-admins.controller.spec.ts` +4,
  `admin-emails.spec.ts` +3, `admin-accounts.rules.spec.ts` +3) ; harnais **524 scénarios** (517 + SES 5 + CPT 2).
- Typecheck auth, deal, trip, message, notification, admin-ui, harnais ; cinq `openapi.json` régénérés.
- Déploiement : rebâtir auth-service ; aucun changement de schéma ; les sessions admin ouvertes avant le déploiement
  affichent « Appareil inconnu » jusqu'à leur premier renouvellement.

# Cahier 02-ADMIN, § 6 : cas de bout en bout — la cohérence entre écrans, services, emails et journal

Branche `chore/recette-admin-6`, empilée sur `chore/recette-admin-5-26`. Huit parcours du cahier joués d'une traite avec les
vrais profils, plus les lots décidés au § 5.26 (A190) et une correction de fond sur les emails de sanction (A191).

## Ce qui a été corrigé

- **ANO-ADM-87 — motif interne dans l'email de sanction** (`apps/auth-service/src/emails/admin-emails.ts`,
  `controller/admin-users.controller.ts`). `AccountStatusParams` perd son champ `reason` : le contrôleur ne peut plus le
  passer (erreur de compilation), et `accountRestricted` / `accountSuspended` disent un motif générique en FR et EN. Pourquoi
  par le TYPE plutôt qu'en retirant une interpolation : l'en-tête du fichier promettait déjà « motif GÉNÉRIQUE » et le code
  passait `p.reason` quand même ; une promesse en commentaire ne protège rien, un type si. Test :
  `admin-emails.spec.ts` (texte générique, adresse de recours, `@ts-expect-error` sur un appel avec `reason`).
- **ANO-ADM-85** — `DisputeFileView.tsx` : « rapprochement fournisseur ».
- **ANO-ADM-86** — `ConversationView.tsx` : un 404 « pas de conversation » est un état normal, texte explicatif en gris ;
  `adm-cnv-conversations.spec.ts` réaligné.
- **Jeu d'essai** — `packages/libs/prisma/scripts/seed-deals.ts` : conversation de deux messages sur `bzv-disputed`
  (Thomas, puis Chinwe avec un numéro tapé), supprimée comme les autres fils du seed au rejeu.
  Piège payé : un fil posé NON LU change les compteurs de la bulle « Messages » que d'autres chapitres lisent (WEB-MSG-1
  attend un seul non lu chez Thomas) — `shipperLastReadAt` et `carrierLastReadAt` sont posés après le dernier message.

## Lots décidés au § 5.26 (A190)

- **a. Régénérer ses codes de secours** — `POST /admin/me/backup-codes` (`regenerateAdminBackupCodes`). Code TOTP à six
  chiffres vérifié avec `totpLastUsedStep` (anti-rejeu) et le compteur d'échecs de la connexion (`registerTotpFailure`,
  `totpFailuresExceeded`). Un code de secours est refusé : la régénération remplace la clé de secours, elle ne peut pas être
  autorisée par elle. `prisma.$transaction` : `user.update({ totpLastUsedStep, totpBackupCodeHashes })` + ligne
  `ADMIN_BACKUP_CODES_REGENERATED { before: { remaining }, after: { remaining } }`. Erreurs : 400 `OTP_INCORRECT`, 403
  `TOO_MANY_ATTEMPTS` / `TOTP_NOT_ENABLED` — **jamais 401** : le client `apps/admin-ui/src/lib/api.ts` traite un 401 comme
  une session expirée (renouvellement puis rejeu de la requête, donc second échec compté, puis `/login`). Écran
  (`SessionsList.tsx`) : champ « Code à 6 chiffres », bouton actif sur six chiffres, codes affichés une fois, « Je les ai
  notés » les efface de la mémoire du composant.
- **b. Révoquer toutes mes autres sessions** — `DELETE /admin/me/sessions` (`revokeOtherAdminSessions`) : `SCAN
  admin_jti:<user>:*`, `revokeAdminSession` sur chaque jti ≠ celui du jeton présenté (`currentJti`), une ligne
  `ADMIN_SESSIONS_REVOKED { count }` si au moins une session a été fermée. Le bouton n'apparaît que s'il existe une autre
  session. Route déclarée AVANT `DELETE /admin/me/sessions/:jti` (lisibilité ; Express ne confond pas les deux chemins).
- **c. Jeton renouvelé complet** — `adminAccessClaims(user, jti)` : une seule fonction pour `issueAdminSession` et
  `adminRefresh` (le renouvellement signait `{ id, jti, roles, adm, amr }` sans `adminRole` / `adminRoles`).
- **d. Rotation réclamée** — dans `adminRefresh`, avant toute écriture :
  `redis.set("admin_rotated:<user>:<ancien jti>", candidat, "EX", 30, "NX")`. Le gagnant (`"OK"`) relit l'ancienne session,
  écrit la nouvelle (`storeAdminSession`), efface l'ancienne. Un perdant (`null`) relit le successeur, attend au plus
  10 × 50 ms que sa session existe, et signe des jetons pour CE jti. Pourquoi `SET NX` et pas « `DEL` = 1 gagne » : avec
  `DEL`, le gagnant efface puis écrit la clé de rotation ; un perdant qui lit entre les deux ne trouve rien et perd sa session
  (le test unitaire de la course l'a montré). `SET NX` fait de la clé de rotation elle-même le verrou.
- `ADMIN_ACTIONS` (`packages/libs/admin-audit`) et `ACTION_LABEL` (`apps/admin-ui/src/lib/format.ts`) : deux actions
  ajoutées (liste fermée A183 : la compilation échoue si l'une manque). `backupCodesWarning` dit le nouveau recours. OpenAPI
  (`build-openapi.ts`) : les deux routes documentées.

## Harnais

- `adm-e2e-bout-en-bout-1-4.spec.ts` (litige, sanction, signalements, paramètre) et `adm-e2e-bout-en-bout-5-8.spec.ts`
  (maintenance, effacement, versements, billet et masquage) : `mode: "default"` (un échec n'arrête pas les autres cas),
  `beforeEach` rejoue le jeu d'essai (et remet la maintenance à plat dans le second fichier). Chaque cas se termine par
  `lireLeJournal` filtré (cible, type, auteur) avec un compte `finance` (le Support et le Médiateur n'ont pas `audit.read`).
- Pièges payés : le rapport `/admin/finances/report` agrège par mois (pas d'identifiant de deal) — comparer un relevé avant /
  après ; `/api/conversations` n'existe pas, le préfixe est `/api/messages/…` ; un colis de 2 kg ne montre pas un passage de
  commission de 12 à 15 % (plancher de 3 €) ; l'`<input>` de note des signalements n'a pas d'attribut `type` (viser par
  placeholder) ; « Prioritaire » disparaît dès que les ouverts passent sous trois.
- `adm-ses-mes-sessions.spec.ts` : SES-6 (lots a, b, écran + API + journal) et SES-7 (trois renouvellements simultanés du
  même cookie par trois contextes API) ; SES-1 et SES-5 réalignés (bouton de régénération présent, nouveau texte).

## Vérifications

- Tests : auth-service **342** (+8 : `admin-auth-sessions.controller.spec.ts` +6, `admin-emails.spec.ts` +2) ; deal 644,
  message 57, trip 293, notification 122 inchangés ; harnais **534 scénarios** (524 + E2E 8 + SES 2).
- Typecheck auth-service, admin-ui, harnais ; `npm run generate:openapi` (seul `apps/auth-service/openapi.json` change).
- Déploiement : rebâtir auth-service (vérifier `grep -c admin_rotated dist/main.js`) et admin-ui ; aucun changement de
  schéma ; rejouer `seed-deals.ts` sur les environnements de recette pour le fil de YAM-2041.

# Cahier 02-ADMIN, § 7 : non-régression — l'engagement « jamais 500 sous deux clics » tenu, et la sanction enfin expliquée au membre

Branche `chore/recette-admin-7`, empilée sur `chore/recette-admin-6`. Le § 7 rejoue sept défauts déjà payés une fois. Deux
fiches lui ont été ajoutées, et ce sont elles qui portent le travail : **ADM-NRG-8** solde l'engagement pris au § 5.19 (plus
aucun geste admin « lu puis écrit » ne rend 500 sous des clics simultanés) et **ADM-NRG-9** livre la catégorie de sanction en
liste fermée proposée au § 6.

## Ce qui a été corrigé

- **ANO-ADM-89 (majeure) — proposer, appliquer, lever une sanction : trois clics, trois emails, ou 500**
  (`apps/auth-service/src/controller/admin-users.controller.ts`). Les trois gestes lisaient le compte (`loadTarget`) puis
  l'écrivaient sans condition : deux administrateurs qui tranchaient au même instant écrivaient chacun leur ligne de journal
  et envoyaient chacun leur email au membre — ou, quand Mongo détectait le conflit, rendaient un 500 `P2034` brut.
  Correction : `user.updateMany({ where: { id, updatedAt: <valeur LUE> }, … })` — un verrou optimiste sur un champ REQUIS,
  toujours présent (le piège Prisma+Mongo des champs absents ne s'y applique pas) — enveloppé dans
  `withWriteConflictRetry` ; `written.count !== 1` lève 409 `ACCOUNT_STATE_CHANGED`. L'écran (`UserFileView.tsx`) traduit ce
  code (« Un autre administrateur vient d'agir sur ce compte… ») et **recharge la fiche** pour montrer la décision gagnante.
- **ANO-ADM-88 (majeure) — le même code TOTP servait trois fois** (`controller/admin-auth.controller.ts`). `totpVerify`,
  `totpEnable` et la régénération des codes de secours (A190 a) vérifiaient l'anti-rejeu sur une valeur LUE avant la
  transaction : trois requêtes simultanées portant le même code passaient toutes, ouvraient trois sessions, et l'activation
  rendait trois jeux de codes de secours dont deux étaient déjà morts à l'affichage. Correction : la garde entre DANS
  l'écriture — `updateMany({ where: { id, OR: [{ totpLastUsedStep: null }, { totpLastUsedStep: { isSet: false } },
  { totpLastUsedStep: { lt: step } }] } })` pour le pas TOTP (les trois branches sont obligatoires : `null` ET absent ET
  antérieur), `{ totpEnabledAt: null | isSet: false }` pour l'activation, `updatedAt` pour la consommation d'un code de
  secours. Un perdant lit le refus d'un code rejoué (401 / 400 `OTP_INCORRECT`), jamais un 500.
- **ANO-ADM-90 (majeure) — `GET /auth/me` servait le motif interne au membre sanctionné**
  (`apps/auth-service/src/utils/me-projection.ts`). La liste blanche gardait `suspensionReason` « pour que le membre puisse
  lire sa sanction » : depuis A191, ce champ est le texte rédigé par l'administrateur, souvent recopié d'un signalement (qui,
  quoi, parfois le nom du signalant). Correction : `suspensionReason` passe dans `ME_EXCLUDED_FIELDS` (avec son pourquoi) et
  la projection sert `suspensionCategory` — la liste fermée d'A193, la seule chose que le membre doit lire.
- **ANO-ADM-91 (cosmétique) — la note du journal mentait** (`AuditTable.tsx`) : « le détail est du JSON, il ne s'indexe
  pas » était faux depuis ANO-ADM-73 (le détail est rendu lisible et la recherche « contient » le parcourt). Nouveau texte :
  « … ne porte que sur les lignes déjà chargées, détail compris : pour chercher dans tout le journal, pose un filtre serveur ».
- **ANO-ADM-92 (mineure) — le formulaire de décision récitait « 72 h »** (`DecisionForm.tsx`) : le délai est un paramètre
  (`disputes.responseHours`) figé à l'ouverture du litige. Le texte renvoie au paramètre et garde la date calculée.

## Lots décidés au § 7 (A192, A193, A194)

- **A192 — la règle, et son inventaire.** Un geste admin qui lit un document puis l'écrit conditionne son `updateMany` à
  l'état LU et passe par `withWriteConflictRetry` ; au réessai, la garde répond le refus métier (409 / 403 / 401), jamais
  500, une seule ligne de journal, un seul email. Après grep, il ne reste AUCUN `$transaction` admin sans rejeu. Hors
  périmètre admin, listés pour une passe membre : `auth.controller`, `profile.controller`, `google-auth.service`,
  `conversation.service`, `conversation-retention.service`.
- **A193 — catégorie de sanction en liste FERMÉE.** `SANCTION_CATEGORIES` / `SanctionCategorySchema` /
  `sanctionCategoryOf` (`packages/libs/api-contracts/src/admin/admin-users.schema.ts`) : six valeurs, requises pour
  proposer et pour appliquer, écrites dans `User.suspensionCategory` / `suspensionProposedCategory` et dans le journal
  (`after.category`). `SANCTION_CATEGORY_LABELS` (FR/EN, `admin-emails.ts`) porte l'exposé des motifs dans la langue du
  membre ; `AccountStatusParams` n'a toujours pas de champ `reason` (A191). Lecture TOLÉRANTE : un compte sanctionné avant
  A193 n'a pas de catégorie et se lit `OTHER` (`sanctionCategoryOf`) — aucun back-fill, aucune erreur. L'écran nomme les
  deux textes : « Catégorie envoyée au membre » (select) et « Motif interne (jamais envoyé au membre) » (le placeholder
  disait l'inverse, et c'est l'erreur qui poussait à écrire ce qu'il ne faut pas envoyer).
- **A194 — une tuile qui compte n objets mène à une liste qui montre ces n objets.** Filtre serveur `proposal=1`
  (`buildUsersWhere` : `suspensionProposedAt: { not: null }`, le MÊME critère que le compteur), `UsersSearch` initialise ses
  filtres depuis l'URL (`q`, `role`, `accountStatus`, `proposal`) sous un `<Suspense>` (exigence Next 16 pour
  `useSearchParams`), et les tuiles « Sanctions proposées », « Comptes restreints », « Comptes suspendus » emportent leur
  filtre.
- **Lecture d'argent** — `platformHoldsRow` (`DealMoneyView.tsx`) : un solde plateforme négatif après un geste commercial se
  lit « Avancé par Yamba 0,80 € » au lieu de « Détenu par la plateforme −0,80 € » (proposition du § 6, faite ici).

## Harnais

`apps/e2e/src/admin/adm-nrg-non-regression.spec.ts` — neuf fiches, `mode: "default"` (un rouge ne masque pas les huit
autres). NRG-8 joue les courses réelles : trois `POST /admin/users/:id/suspension` simultanés depuis deux navigateurs admin,
trois `DELETE` de levée, trois `POST /auth/admin/totp/verify` du même code (une seule session Redis), trois
`POST /admin/me/backup-codes` du même code — sur un administrateur JETABLE enrôlé en base, dont l'accès est retiré en
`finally`. NRG-9 lit l'email du membre dans Mailpit, puis `GET /auth/me` avec la session du membre, puis la fiche admin, et
efface la catégorie en base pour prouver la lecture tolérante. Pièges payés : le menu latéral porte le même `href="/alerts"`
que le résumé d'accueil (viser `main`) ; le pas TOTP qui vient de servir à la connexion est brûlé — une fiche qui enchaîne
deux gestes TOTP doit attendre le pas SUIVANT ; depuis ANO-ADM-74 un identifiant de cible COURT est une valeur légitime (une
clé de paramètre), seul un caractère interdit fait un filtre « ignoré ».

## Vérifications

- Tests : auth-service **356** (+14 : `admin-users-concurrency.controller.spec.ts` 6, `admin-auth-totp-concurrency.controller.spec.ts` 4,
  `admin-emails.spec.ts` +1, `me-projection.spec.ts` +1, `admin-users.query.spec.ts` +1, `admin-auth-sessions.controller.spec.ts` +1) ;
  deal 644, trip 293, notification 122, message 57 inchangés ; harnais **543 scénarios** (534 + 9).
- Contre-épreuve : les quatre fichiers corrigés remis dans leur état d'origine → **16 rouges sur 356** dans cinq suites
  (concurrence sanctions, concurrence TOTP, sessions admin, emails, projection `/me`) ; corrections remises : 356/356.
- Typecheck des huit projets de la CI + harnais ; `npm run generate:openapi` (aucun écart après régénération).
- Déploiement : rebâtir auth-service et admin-ui ; `prisma db push` non requis (deux champs optionnels ajoutés sans index).

# Sécurité de la connexion : throttling + email de nouvelle connexion (D78)

*(PR `feat/login-security`, 11/09/2026 — suite d'ANO-WEB-19.)*

## Le problème

La connexion par mot de passe n'avait aucun rempart : le limiteur du gateway est déclaré
`skipFailedRequests`, donc une tentative en échec n'est pas comptée — un attaquant disposait de
centaines d'essais par heure sur un compte, sans que le titulaire ne soit prévenu. Relevé en
recette (ANO-WEB-19), déjà noté en recette API.

## Le choix : ralentir, pas exiger un code

On n'ajoute PAS d'OTP à chaque connexion (friction inutile, non standard : ni Airbnb ni BlaBlaCar
ne le font). On ajoute le standard grand public : un **throttling des échecs** par compte, et une
**alerte de nouvelle connexion**. La 2FA reste optionnelle (déjà là pour les admins, TOTP).

## Ce qui a été ajouté

```
apps/auth-service/src/utils/login-policy.ts (+ .spec)   barème pur des échecs (paliers 5/10/15 → 1min/15min/1h)
apps/auth-service/src/utils/login-guard.ts              Redis : assertLoginNotLocked / registerLoginFailure / clearLoginFailures
apps/auth-service/src/utils/geoip.ts (+ .spec)          isPrivateIp + resolveApproxLocation (provider inerte par défaut, RGPD)
apps/auth-service/src/utils/session-device.ts (+ .spec) isDeviceKnown (nouvel appareil ?)
apps/auth-service/src/utils/notify-sign-in.ts (+ .spec) email de nouvelle connexion (mode new-device/every/off)
apps/auth-service/src/emails/auth-emails.ts             newSignIn (FR/EN) ; securityAlert étendu au scope "login"
apps/auth-service/src/controller/auth.controller.ts     loginUser recâblé ; issueSession rend le jti
.env.example                                            LOGIN_ALERT_MODE, GEOIP_PROVIDER
```

## Le throttling, en détail

Barème pur (`login-policy.ts`) par paliers de 5 échecs cumulés (compteur 24 h, remis à zéro à la
première réussite) : 5e échec → verrou 1 min ; 10e → 15 min + email d'alerte au titulaire ; 15e et
au-delà → 1 h. Choix de **verrous courts** : un verrou par compte est un vecteur de déni de service
(un tiers pourrait verrouiller la victime en tapant de faux mots de passe) ; des locks courts qui
expirent seuls ralentissent massivement le brute-force sans jamais bloquer durablement le vrai
titulaire. Le compteur est indexé par adresse **existante ou non** : le verrou (429
`TOO_MANY_ATTEMPTS`, avec `lockUntilSeconds`) ne révèle jamais l'existence d'un compte. L'email
d'alerte n'est envoyé qu'au 10e échec (2e palier) et seulement si le compte existe — jamais
d'email à une adresse inconnue.

## L'email de nouvelle connexion

`newSignIn` (FR/EN) : quand, appareil (dérivé du user-agent, jamais une empreinte), IP,
localisation approximative, et « si ce n'était pas toi → sécurise ton compte ». Envoyé en
fire-and-forget après une connexion réussie (aucune latence sur la réponse ; un échec SMTP ou géo
n'empêche jamais la connexion). Mode `LOGIN_ALERT_MODE` : **new-device** par défaut (email
seulement depuis un appareil non déjà vu parmi les sessions actives — le standard, pour prévenir
sans fatiguer), `every` (à chaque connexion), `off`.

## La localisation, côté RGPD

Résoudre une IP en ville/pays suppose de l'envoyer à un tiers ou d'embarquer une base. Par défaut,
**aucune géoloc** (`GEOIP_PROVIDER=none`) : l'email montre l'IP seule, et rien ne fuit. Le provider
`ipapi` (ip-api.com, sans clé) est activable en connaissance de cause (l'IP transite hors UE) ; la
voie recommandée à terme est une base MaxMind GeoLite2 hors-ligne, branchable dans `geoip.ts`.
L'appel géo vit dans le chemin asynchrone de l'email, jamais sur la connexion.

## Déconnexion globale : « les autres » ET « tous »

Compagnon de l'alerte de nouvelle connexion : quand l'email dit « si ce n'était pas toi, sécurise
ton compte », il faut pouvoir couper. Deux gestes, deux intentions (on garde les deux, l'utilisateur
choisit) :

- **« Déconnecter les autres appareils »** (existait déjà, `DELETE /auth/me/sessions`) — garde la
  session courante. Le cas courant : j'ai oublié de me déconnecter ailleurs.
- **« Déconnecter tous les appareils »** (nouveau, `DELETE /auth/me/sessions/all`,
  `revokeMyAllSessions`) — révoque tout, la session courante comprise, ferme la fenêtre sudo et
  efface les cookies : l'appareil qui a cliqué est déconnecté lui aussi, et rebascule vers l'accueil
  visiteur. Le cas « je crois mon compte compromis ». Une confirmation navigateur garde le clic.
  La route est déclarée AVANT `/:jti` (sinon « all » y tomberait) et documentée dans l'OpenAPI.

## Tests

auth-service **229 → 249** : `login-policy.spec` (barème), `geoip.spec` (IP privées, provider,
best-effort), `session-device.spec` (isDeviceKnown), `notify-sign-in.spec` (mode d'alerte), plus
le miroir des emails (newSignIn FR/EN). Build webpack et typecheck verts.

---

# PR — Passe concurrence MEMBRE (A195) · `feat/concurrence-membre`

## Pourquoi

A192 avait soldé le périmètre ADMIN : tout geste qui lit un document puis l'écrit conditionne son écriture à
l'état LU et se rejoue sur conflit. L'inventaire de cette PR-là nommait cinq fichiers restés hors périmètre,
côté MEMBRE. Ils sont traités ici. Laisser l'asymétrie aurait été le pire des deux mondes : un back-office
durci, et les gestes que font des milliers de membres (poster, proposer un rendez-vous, changer d'avatar,
s'inscrire) toujours exposés.

Ce que la passe a réellement trouvé, par ordre de gravité :

| Geste | Course | Conséquence AVANT |
|---|---|---|
| Purge des fils à un an (cron) | un membre écrit entre la lecture et la purge | **le fil part avec son message tout neuf** — perte de données sèche |
| Proposer un rendez-vous | deux propositions simultanées | **deux rendez-vous PROPOSED du même type** (invariant cassé, invisible) |
| Proposer / accepter un rendez-vous, révéler un numéro | — | changement d'état commité **hors de la transaction de son événement** (violation D2) |
| Ouvrir un fil, révéler un numéro, s'inscrire, changer d'avatar | deux requêtes simultanées | **500** sur un index unique (P2002) |
| Modifier le profil, supprimer l'avatar | le document lu a disparu | **500** (P2025) |
| Réinitialiser le mot de passe | mot de passe changé entre-temps | écrasement **silencieux** |
| Marquer un fil comme lu | deux clients du même membre | marqueur de lecture qui **recule** |

## Les trois règles appliquées

**1. L'écriture se conditionne à l'état LU.** `updateMany` / `deleteMany` COMPTENT ce qu'ils ont écrit ;
`update` / `delete` LÈVENT (P2025) quand le document a bougé. Un compte à zéro est une réponse métier
(409 `PROFILE_STATE_CHANGED`, `PASSWORD_STATE_CHANGED`), pas une panne. La condition porte sur ce dont la
décision dépend vraiment : l'empreinte du mot de passe pour une réinitialisation (et non `updatedAt`, qui
bouge pour n'importe quelle autre écriture et produirait des refus faux alors que le jeton est déjà consommé),
le `fileId` lu pour un avatar, l'`updatedAt` du fil pour la purge.

**2. Une collision d'unicité (P2002) porte une réponse métier.** Une lecture d'unicité ne RÉSERVE rien :
entre « cet email est libre » et l'écriture, l'autre requête est passée. La base est le seul juge, et sa
collision dit exactement ce que la lecture disait — `EMAIL_ALREADY_USED` à l'inscription, « le fil existe
déjà, relis-le », « le numéro est déjà révélé, rends la même trace ». Le champ visé se lit dans `meta.target`
(comparaison souple : Mongo y met un nom d'index). Un slug public est un TIRAGE, pas une réponse au membre :
sa collision se rejoue avec un second tirage.

**3. Un geste = une transaction, rejouée sur conflit.** Trois gestes du fil écrivaient leur changement
d'état, puis — dans une SECONDE transaction — le message et l'événement outbox. C'était une violation de la
règle non négociable D2 restée invisible parce que rien ne la teste en production. Tout tient désormais dans
`prisma.$transaction`, enveloppé de `withWriteConflictRetry`.

Le point fin, celui qui fait toute la différence sur MongoDB : **deux transactions qui créent chacune leur
propre document ne se voient pas**. Rien ne les met en conflit, elles passent toutes les deux, et l'invariant
« une seule proposition ouverte » tombe sans un seul message d'erreur. Ce qui rend le conflit détectable,
c'est le document PARTAGÉ que les deux touchent : ici la `Conversation` (son `lastMessageAt` bouge à chaque
message). MongoDB rejette alors la perdante (P2034), le rejeu repart d'une lecture fraîche, et la seconde
proposition annule proprement la première — une contre-proposition, ce qui est exactement la règle métier.

## Fichiers

- `apps/message-service/src/services/conversation.service.ts` — `writeMessageIn(tx, …)` (rejoint la
  transaction de l'appelant) / `writeMessage(…)` (ouvre la sienne) ; `loadContext` tolère P2002 ;
  `markRead` monotone ; `proposeMeetup`, `acceptMeetup`, `revealPhone` en une transaction rejouée.
- `apps/message-service/src/services/conversation-retention.service.ts` — suppression du fil conditionnée à
  son `updatedAt` et jouée D'ABORD ; les enfants ne partent que si le fil est parti.
- `apps/auth-service/src/controller/profile.controller.ts` — profil, avatar posé, avatar supprimé.
- `apps/auth-service/src/controller/auth.controller.ts` — `collisionSur(e, champ)`, inscription, réinitialisation.
- `apps/auth-service/src/services/google-auth.service.ts` — `lierIdentite` idempotent, création rattrapée.

## Tests

message-service **57 → 68**, auth-service **376 → 393**. Totaux mesurés après la passe : trip 293, deal 644,
notification 122, message 68 — soit **1116 → 1127** dans la base annoncée par `CLAUDE.md` (qui exclut auth) — et
auth 393, soit **1492 → 1520** toutes suites confondues. Quatre nouvelles
fiches : `conversation-concurrency.service.spec.ts`, `conversation-retention-concurrency.spec.ts`,
`profile-concurrency.controller.spec.ts`, `auth-concurrency.controller.spec.ts`, plus trois scénarios ajoutés
à `google-auth.service.spec.ts`. Aucune horloge, aucun hasard : les courses se jouent en faisant échouer la
transaction la première fois (P2034) ou l'écriture (P2002 / `count: 0`). Typecheck et builds verts,
`scripts/smoke-services.sh` : les six bundles bootent.

**Piège payé au passage** : un fichier de test sans `import` ni `export` est un SCRIPT pour TypeScript — ses
constantes de tête tombent dans la portée globale partagée par toutes les fiches du projet, et `prismaMock`
s'y heurte à celui d'une autre (TS2451 au `nx typecheck`, jamais vu par `nx test`). D'où le `export {};` en
pied des deux fiches qui chargent leur module par `require`.

---

# PR — Cahier 02-ADMIN remis à l'état du code (réserve documentaire levée) · `chore/cahier-admin-a-jour`

## Pourquoi

La recette admin avait été prononcée « **conforme avec réserves documentaires** » : les 92 anomalies étaient closes,
mais `docs/recette/RECETTE-02-ADMIN.md` décrivait encore des états d'avant correction. Une réserve documentaire n'a l'air
de rien — jusqu'au passage suivant, où le testeur consigne comme anomalie ce qui est en réalité la correction, et où
personne ne sait plus qui a raison du cahier ou du code.

Le handoff du 16/09 nommait trois points. Il y en avait **quatorze** : la source exacte, ce sont les sections « Écarts
avec le cahier » que chaque chapitre des résultats a consignées au fil de la campagne (`YAMBA-RECETTE-WEB-RESULTATS.md`).
C'est là qu'il fallait aller les chercher, pas dans le résumé.

## Ce qui a changé dans le cahier

| Où | Avant | Maintenant |
|---|---|---|
| En-tête | référence `feat/f3-messaging-admin` au 06/09 | `dev` au 17/09 ; **le `.md` fait foi**, le `.pdf` du 06/09 n'est plus régénéré à chaque passe |
| § 1.2 et pied de page | renvois vers `RECETTE-01-MEMBRE.md` / `RECETTE-04-EXPLOITATION.md` — **fichiers inexistants** | `RECETTE-01-WEB.md` / `RECETTE-04-CRONS.md` |
| Prérequis, `ADM-CPT-5`, `ADM-SES-1`, § 7 écart 5 | « aucun écran pour régénérer des codes de secours ni réinitialiser la 2FA » | régénérer **ses propres** codes existe (A190 a) ; seule la 2FA d'un **autre** admin reste sans écran |
| § 5.26 | un seul scénario | **`ADM-SES-2` ajouté** : régénérer ses codes, fermer ses autres sessions (A190 a, b), avec le piège du pas TOTP brûlé et les refus 400 / 403 (jamais 401) |
| `ADM-SEC-4`, `ADM-SES-1` | « Il te reste {n} code(s) de secours. » | texte réel : pluriel accordé, renvoi à « Mes sessions », et à zéro le recours |
| `ADM-ACC-1` | tuile « Sanctions proposées » → `/users` | → `/users?proposal=1` (A194) |
| `ADM-JRN-1` | six filtres ; select proposant `DISPUTE`, `MAINTENANCE`, `EXPORT` | six filtres saisissables **+ l'auteur par clic** ; les sept types réellement écrits (A183), en français |
| `ADM-JRN-2` | « Rapprochement Stripe » | « Rapprochement fournisseur » |
| `ADM-MNT-4` étape 4 | « impossible » sans dire comment | le formulaire est remplacé par l'explication (A182) ; le 409 se prouve par l'API |
| `ADM-CPT-3` étape 5 | 400 sur réinvitation | 400 aussi pour le **perdant de deux invitations simultanées** |
| `ADM-CPT-4` étapes 3, 4 | « tenter » → 403 | l'écran **ne propose plus** le geste ; le 403 reste la réponse de l'API |
| `ADM-E2E-1` étapes 2, 3, 15, 16 | délai 1 h, tuile = 2, « toutes les lignes » | minimum **12 h**, tuile = 1 (A169), et le filtre « cible = deal » montre **quatre** lignes — une conversation et un paramètre visent autre chose |
| `ADM-E2E-2` étape 17 | cinq lignes | **quatre** gestes + les consultations |
| `ADM-E2E-3` étape 11 | — | dès le **premier** « Traité », la ligne n'est plus « Prioritaire » |
| `ADM-E2E-6` étapes 4, 10 | 409 au clic ; `ACCOUNT_DELETED` | bouton **inactif** (A179 b) ; **`INVALID_CREDENTIALS`** — dire « compte effacé » révélerait qu'il a existé |
| `ADM-E2E-7` étape 2 | « 1 critique » | le jeu d'essai franchit d'autres seuils : lire le bandeau, ne pas exiger un chiffre |
| `ADM-NRG-6` étape 3 | « identifiant trop court → ignoré » | **faux** depuis ANO-ADM-74 : un identifiant court est légitime (`maintenance`, clé de paramètre, session 32 hex) et rend « 0 ligne » ; seul un caractère interdit fait un filtre ignoré |
| `ADM-NRG-7` | « les cinq écarts documentaires » | 4 **LEVÉ** (A194), 5 **RÉDUIT** (A190 a) ; les numéros sont conservés, les résultats y renvoient |
| § 5.21 | connexion d'un compte effacé → `ACCOUNT_DELETED` | `INVALID_CREDENTIALS` (le code `ACCOUNT_DELETED` existe, mais pour refuser un **profil admin** à un compte effacé) |
| Renvois | `ADM-ETA-5` et `ADM-CPT-8` n'existent pas dans ce cahier | `ADM-ETA-3` ; le harnais nommé par son fichier |

## Vérifications faites, pas supposées

- Chaque correction est **vérifiée dans le code**, pas seulement recopiée des résultats : `ADMIN_TARGET_TYPES` et
  `TARGET_TYPE_LABEL` pour les types de cible, `backupCodesWarning` pour le texte exact, `HomeKpis` pour les liens des
  tuiles, `admin-audit.query.ts` pour la règle du filtre, `ops-alerts.rules.ts` pour les seuils par défaut.
- **Les délais « 72 h » / « 48 h » n'étaient PAS un écart** (la réserve les citait) : ce sont les valeurs par défaut de
  `alerts.disputeUndecidedHours` et `alerts.payoutFailedHours`, et le cahier les présentait déjà comme des paramètres.
  Rien corrigé de ce côté — une correction inutile est une régression documentaire de plus.
- **Aucun renvoi mort** : tout `ADM-XXX-n` cité dans le cahier existe dans son tableau de suivi (vérifié par `comm`).
- Compte de scénarios : 125 → **126** (`ADM-SES-2`), reporté dans `docs/recette/README.md`.

## Le PDF

Les `.pdf` datent du 06/09 et ont divergé dès le 09/09 — la question « régénérer ou pas » était déjà tranchée par les
faits. C'est désormais écrit noir sur blanc dans l'en-tête du cahier et dans `docs/recette/README.md` : **le `.md` fait
foi**, le code et ses tests au-dessus de lui (précédence du dépôt). `python3 scripts/build-doc-pdf.py <fichier.md>` reste
disponible pour une remise à niveau ponctuelle, avant une transmission externe par exemple.

---

# PR — Transitions du trajet : écrire sur l'état lu (A196) · `feat/concurrence-transitions-trajet`

## Pourquoi

A195 avait soldé les cinq fichiers MEMBRE de l'inventaire d'A192. L'axe proposé en fin de chantier était de vérifier
trip-service et deal-service, jamais balayés côté membre. Résultat de l'inventaire :

- **deal-service : rien à faire.** Toutes ses écritures transactionnelles passent par `booking-write.ts`,
  `deal-request.service.ts`, `deal-mediation.service.ts` ou `admin-finance.service.ts` — tous déjà sous
  `withWriteConflictRetry` (A192). Les services de cycle de vie (`deal-lifecycle`, `deal-transport`, `deal-rating`,
  `deal-settlement`) n'ouvrent pas de transaction eux-mêmes : ils passent par l'écrivain commun. C'est une bonne
  architecture, et elle a tenu.
- **trip-service : les huit transitions du trajet étaient à découvert.**

## Le défaut

```ts
const ctx = await buildLifecycleCtx(trip.id);
const check = canPerform(trip, "cancel", ctx);      // juge l'état LU
if (!check.allowed) return next(/* … */);
await prisma.trip.update({ where: { id }, data: { status: "CANCELLED", … } });  // écrit quoi qu'il arrive
```

La machine à états est la source de vérité — mais seulement jusqu'à la ligne suivante. Entre la garde et l'écriture,
l'état peut avoir changé, et rien ne le rappelait. Trois conséquences, toutes silencieuses :

| Course | Ce qui arrivait |
|---|---|
| Pause dans un onglet, annulation dans l'autre | les deux passent la garde ; **une transition jouée depuis un état qui n'existait plus** |
| Double clic sur « Publier » | deux incréments du compteur public **et deux vagues de notifications** aux abonnés du corridor |
| Un deal naît entre la garde et l'écriture de l'annulation | **D72 tombe** : trajet annulé avec un deal vivant |

## Le correctif

`ecrireTransition(trip, data, options)` conditionne l'écriture au **statut lu** et à `isDeleted: false`, sous
`withWriteConflictRetry`. `count !== 1` → **409 `TRIP_STATE_CHANGED`** : le front recharge le trajet et ses
`allowedActions` (il ne décide jamais lui-même — règle non négociable).

Pour l'annulation, la condition porte **aussi sur `reservedKg` lu**. C'est le même raisonnement qu'en A195, appliqué à
l'envers : la réservation d'un deal passe déjà par un `updateMany` conditionnel sur le **même document Trip** (CAP-01,
`capacityReservationWhere`). Ce document partagé est donc le témoin dont l'annulation avait besoin — un deal né
entre-temps a bougé `reservedKg`, la condition ne matche plus, et le refus redevient celui de D72, avec son décompte :

```ts
const ecrit = await ecrireTransition(trip, { status: "CANCELLED", cancelledAt: new Date() }, { surReservation: true });
if (ecrit !== 1) {
  const vivants = await countActiveBookings(trip.id);
  if (vivants > 0) return next(new AppError("…", 409, true, { type: "trip", code: "TRIP_HAS_ACTIVE_DEALS", activeDeals: vivants }));
  return next(trajetChange());
}
```

**Pitfall A34 respecté** : `reservedKg` peut être ABSENT sur un trajet d'avant B2-PR1, et aucun filtre Prisma ne matche
un champ absent sur un scalaire requis. La condition est donc **omise** dans ce cas — la refuser pour toujours serait
pire que la course qu'on corrige. Le remède reste `backfill-reserved-kg.ts`.

Les compteurs publics du Voyageur (`applyCarrierStatDeltas`) lisaient les valeurs puis écrivaient une valeur absolue :
deux transitions simultanées en perdaient une. L'écriture est conditionnée aux valeurs lues, relue et rejouée **trois
fois au plus** — puis abandonnée. C'est un arbitrage assumé : un compteur d'affichage ne fait pas échouer une transition
déjà écrite, et le cron de cohérence repasse derrière.

## Tests

trip-service **293 → 305** (12 scénarios : conditions posées, 409 du perdant, publication jouée deux fois sans double
notification, D72 sous concurrence, trajet legacy sans `reservedKg`, compteurs relus puis abandonnés).
`scripts/smoke-services.sh` : les six bundles bootent.

---

# PR — D2 rendue exécutable (A197) · `feat/d2-executable`

## Pourquoi

En A195, trois gestes du fil violaient la règle non négociable « aucun changement d'état sans événement
outbox dans la MÊME transaction » : ils écrivaient l'état, puis l'événement dans une **seconde** transaction.
Si la seconde échoue, l'état est commité et personne n'est prévenu — un rendez-vous accepté dont l'autre
partie n'entendra jamais parler.

La vraie question n'est pas « comment ont-ils échappé à la revue », mais **pourquoi aucun test ne l'a vu**,
alors que message-service en comptait 57. La réponse est dans le patron de mock du dépôt :

```ts
$transaction: jest.fn(async (fn) => fn(prismaMock))   // le MÊME client à l'intérieur
```

Dedans et dehors deviennent indiscernables. Une écriture sortie de la transaction ne fait tomber aucune
assertion. Les fiches vérifiaient **quels** événements partent — jamais **où** ils sont écrits.

## Ce qui est livré

Deux fiches structurelles, avec un client de transaction **distinct** et un journal des appels portant leur
provenance (`transaction: null` = hors transaction) :

**`d2-une-transaction-par-geste.spec.ts`** (message-service). Pour chaque geste du tableau `GESTES` — poster,
proposer, accepter, révéler — trois propriétés :
1. aucun `outboxEvent.create` hors transaction ;
2. toute écriture d'état est dans **la même** transaction que l'événement ;
3. une **seule** transaction est ouverte.

Elle est écrite comme une règle, pas comme un scénario : un geste ajouté demain au tableau est couvert sans
qu'on y pense. Deux fiches de contrôle l'accompagnent : le marqueur de lecture n'est pas un changement d'état
de domaine (aucune transaction, aucun événement — et c'est voulu), et une fiche qui vérifie que **le mock
lui-même distingue bien dedans et dehors**, sans quoi toutes les autres assertions seraient creuses.

**`d2-booking-write.spec.ts`** (deal-service) verrouille `applyBookingTransition`, passage obligé de toute
transition d'un deal : statut, reprise des kilos (CAP-02), écritures annexes (`within`, par exemple le dossier
de litige) et événements dans une transaction unique ; aucun événement quand la transition est refusée ;
condition sur le statut de départ ; rejeu du conflit portant sur la transaction **entière**.

## La contre-épreuve

Un test structurel qui passe ne prouve rien tant qu'on n'a pas vu ce qui le fait tomber. Le défaut d'avant
A195 a donc été **réintroduit volontairement** (l'événement du rendez-vous proposé rendu à une seconde
transaction), la fiche est passée au rouge sur le scénario « proposer un rendez-vous », puis le code correct a
été restauré. Un test qui ne mord pas est pire qu'aucun test : il rassure.

## Portée

Volontairement limitée aux deux écrivains qui portent les invariants — la messagerie et l'argent. Les
écritures de deal-service hors écrivain commun ont été inventoriées une à une : compteur d'essais de code de
livraison, statuts de versement venus du fournisseur, rédaction RGPD d'un destinataire. Ce sont des faits
d'exécution, déjà écrits sous condition, sans événement de domaine attendu.

## Tests

message-service **68 → 74**, deal-service **644 → 649**.

---

# PR — Suite de tests déterministe (A199) · `chore/tests-deterministes`

## Le symptôme

En livrant A198, la suite deal-service est tombée sur `reputation.service.spec.ts` — une fiche que je n'avais
pas touchée. Relancée seule : verte. Relancée en entier : rouge, mais **sur un autre fichier**. En
`--runInBand` : verte à tous les coups.

C'est la signature d'une interférence entre workers, pas d'un bug métier.

## La cause

```ts
jest.mock("@packages/libs/prisma", () => ({ __esModule: true, default: prismaMock }), { virtual: true });
```

`virtual: true` déclare « ce module n'existe pas sur le disque ». C'est **faux** : le resolver Nx
(`@nx/jest/plugins/resolver`, posé par le préset) résout les alias `@packages/*` par les chemins du
`tsconfig`. Sous workers parallèles, un mock virtuel posé sur un module réellement résolu s'applique **par
intermittence** — et quand il manque, le VRAI `PrismaClient` part en base au milieu d'un test unitaire
(`PrismaClientValidationError`), ou les compteurs d'appels restent vides.

Le drapeau venait d'une précaution honnête, écrite noir sur blanc dans `outbox-relay.spec.ts` : « le préset
résout `@packages/api-contracts`… mais rien ne prouve qu'il résout les autres alias ; `virtual: true`
court-circuite toute résolution. » La preuve est maintenant faite — il les résout — et la précaution coûtait
la reproductibilité.

## Le correctif

`virtual: true` retiré des **30 fiches** concernées dans les cinq services, uniquement sur les modules
`@packages/*` (les mocks relatifs et les modules réellement absents ne sont pas touchés), plus un `require`
après les doubles là où l'import ES du module testé passait avant eux.

**Vérification** : trois passages **parallèles** verts sur deal-service (649) et trip-service (305), plus les
cinq suites au complet. Avant le correctif, deux passages sur trois tombaient — sur un fichier différent.

## Pourquoi ça compte plus qu'il n'y paraît

Un test qui échoue au hasard finit par être relancé sans être lu. C'est la porte d'entrée de la « CI rouge
tolérée », et le dépôt en dépend pour 17 checks obligatoires. Le défaut était **latent** : il existait avant
mes fiches, et le prochain fichier ajouté l'aurait réveillé ailleurs.

---

# PR — Arbitrages (c) et (d) : le libellé qui ment, le Voyageur qu'on ne prévient pas (A198) · `feat/arbitrages-argent`

## (c) Une alerte doit dire ce qu'elle mesure

La requête n'a pas changé d'un caractère — elle était juste :

```ts
prisma.booking.count({ where: { payoutStatus: "FAILED", status: { in: ["COMPLETED", "CANCELLED"] },
  OR: [{ completedAt: { lt: il_y_a_48h } }, { closedAt: { lt: il_y_a_48h } }] } })
```

Elle compte des **deals terminés depuis 48 h dont l'argent n'est pas parti**. Le titre, lui, annonçait
« Versements en échec depuis plus de 48 h » — soit une panne qui dure. Un opérateur qui cherche une panne
durable et trouve un incident de la minute cesse de croire l'alerte ; c'est ainsi qu'on apprend à ignorer un
bandeau rouge.

Corrigé partout où la phrase se lit : l'alerte (titre + détail), le récapitulatif quotidien au support (dont
la requête porte sur `updatedAt` → « sans mouvement depuis plus de 24 h »), le catalogue de paramètres
(`alerts.payoutFailedHours`), donc l'OpenAPI et `YAMBA-PARAMETRES.md` régénérés, la documentation admin livrée
et les deux assertions du harnais.

**Ce qui ne bouge pas** : `PAYOUT_FAILED_48H`. Un nom de règle est un identifiant — les journaux le citent,
des emails déjà partis le portent, des tests s'y réfèrent. Renommer un identifiant pour suivre un libellé,
c'est casser l'historique pour une question de style.

**L'alternative écartée** : mesurer depuis le premier échec. Le champ n'existe pas, et surtout les rejeux sont
**espacés** (`payoutNextRetryAt`) : une mesure « depuis la dernière tentative » repousserait l'alerte à chaque
rejeu — une alerte qui ne sonne jamais.

## (d) Aucune décision d'argent ne reste muette

`WRITTEN_OFF` — la plateforme renonce à refaire un virement repris par le prestataire — écrivait la décision
et sa ligne de journal. Le Voyageur, lui, n'apprenait rien : il avait vu passer un virement, puis son
renversement, et le silence.

`notifyCarrierReversalWrittenOff` est la **troisième exception assumée** au patron « outbox →
notification-service », pour la même raison que les deux autres : ce n'est pas une transition du deal, c'est
une décision humaine du back-office. Elle écrit la notification in-app et envoie l'email FR/EN.

Trois précautions, toutes déjà des règles du dépôt :
- **identifiant déterministe** `reversal-written-off:<bookingId>` → deux clics, une notification ;
- **best effort, hors transaction** → un email qui ne part pas ne fait pas échouer une décision déjà écrite et
  journalisée ;
- **`isDeleted` et `emailSuppressedAt` sautés** (D35 4A / D63 4A), comme tout résolveur de destinataire.

Et la règle d'A191 est reprise telle quelle : le message porte le montant, la référence du deal et une voie de
recours — **jamais** le motif interne saisi par l'administrateur, qui peut nommer un signalant ou un collègue.
Le test le vérifie explicitement (le mot « fraude » ne doit apparaître dans aucune langue).

**L'alternative écartée** : un événement outbox. Il n'y a aucun autre consommateur à prévenir ; ajouter un
type au contrat pour une décision rare aurait coûté une migration de schéma d'événement pour rien.

## Tests

deal-service **649 → 659** (10 scénarios : libellés, seuil qui suit le paramètre, nom de règle stable,
notification + email, idempotence du double clic, compte effacé, adresse supprimée, deal disparu, et le motif
interne qui ne fuit dans aucune des deux langues).

---

# PR — Arbitrages (a), (f), (g) : tracer, montrer, ne pas compter deux fois (A198 bis) · `feat/arbitrages-moderation`

## (a) Le refus d'effacement au journal

Le registre `DataRequest` et le journal admin ne répondent pas à la même question. Le premier prouve à un
régulateur qu'une demande a été traitée et pourquoi elle a été refusée ; le second raconte ce qu'un opérateur
a fait ce jour-là. Un refus n'existait que dans le premier — le seul geste sensible dans ce cas.

Nouvelle action de la liste fermée : `ACCOUNT_ERASURE_REFUSED`, écrite **dans la même transaction** que
l'inscription au registre. Détail d'implémentation qui vaut d'être noté : la transaction n'est ouverte que
lorsqu'il y a **deux** écritures à lier (refus venu d'un admin). Un refus opposé à la demande du membre
lui-même n'a qu'une écriture : pas de transaction pour rien — et la fiche existante qui comptait les
transactions reste juste.

## (f) Les signalements sur la fiche membre

`AdminUserFile.openReports` sert les signalements ouverts visant le membre. Trois précautions :

1. **Permission-aware, décidé par le contrôleur.** Le service ne connaît pas les permissions de l'appelant ;
   le contrôleur, oui. `getFile(adminId, userId, avecSignalements)` — et `avecSignalements` vaut
   `adminRolesAllow(roles, "reports.review")`.
2. **`null` ≠ tableau vide.** `null` veut dire « pas le droit de lire » ; l'écran n'affiche alors **rien**,
   plutôt qu'un « aucun signalement » qui serait faux.
3. **Montrer, pas pré-remplir.** La catégorie de sanction part au membre (A193) : une case pré-cochée est une
   case acceptée sans réfléchir. L'encart porte d'ailleurs l'avertissement « écrit par un membre : à recouper,
   jamais à recopier dans un message au membre visé ».

## (g) Le doublon de signalement — et pourquoi le même remède ne convient pas des deux côtés

**message-service : conflit matérialisé.** La création du dossier écrit aussi le **message visé** dans la même
transaction. Deux clics simultanés se disputent ce document, MongoDB en rejette un (P2034), le rejeu relit et
rend 409 `ALREADY_REPORTED`. `flaggedContact` est réécrit **à sa valeur** : c'est une écriture, pas un
changement — signaler ne modifie pas le message.

**auth-service : le même remède est refusé.** La cible y est un `Trip` ou un `User` — documents **chauds** (la
réservation d'un deal écrit `reservedKg` sur le Trip). Matérialiser un conflit dessus ferait payer des
réessais à des gestes qui n'ont rien à voir avec un signalement. On corrige donc la **conséquence** : le
badge « prioritaire dès 3 ouverts » compte des **signalants distincts**. Trois personnes, c'est un signal ;
une personne qui clique trois fois, non.

> La leçon générale : matérialiser un conflit est un bon outil **sur un document froid**. Sur un document
> chaud, c'est un générateur de contention — et le bon réflexe devient de supprimer le préjudice plutôt que la
> course.

**L'index unique, écarté deux fois.** `(cible, signalant)` serait faux : re-signaler une cible dont le dossier
a été **clos** est légitime, et un index simple l'interdirait. Un index **partiel** (`status: "OPEN"`) le
dirait exactement — mais il vivrait hors de la gestion Prisma, à recréer et re-vérifier à la main après chaque
`db push`. Le coût de maintenance dépasse le préjudice.

## Tests

auth-service **393 → 395**, message-service **74 → 79**. La fiche `privacy.service.spec.ts` est **mise à jour**
(et non contournée) : elle affirmait « un refus n'écrit aucune ligne de journal », ce que l'arbitrage change.

---

# PR — (e) Les justificatifs servis par une URL signée (A198 ter)

Un billet d'avion porte un nom, un numéro de vol, parfois un numéro de réservation. Servi par une URL ImageKit
ordinaire, il restait lisible **pour toujours** par quiconque a l'URL.

Le risque n'est pas l'énumération — le chemin est aléatoire — c'est le **partage** : une URL se recopie dans un
message, un ticket de support, un journal. Et une fois recopiée, rien ne permettait de la **révoquer**.

```ts
export function signedImageKitUrl(url: string, expireSeconds = 300): string {
  if (!url || !process.env.IMAGEKIT_PRIVATE_KEY) return url;
  try { return imagekit.url({ src: url, signed: true, expireSeconds }); } catch { return url; }
}
```

Trois choix à noter :

- **Signer à la LECTURE**, pas à l'écriture : rien n'est stocké, rien à migrer, et l'échéance court à partir du
  moment où l'opérateur ouvre le document — pas depuis le téléversement.
- **Dégradation choisie** : sans clé privée (dev, tests), l'URL est rendue telle quelle. Un justificatif
  illisible en développement coûterait plus cher que le risque qu'on couvre ici.
- **Périmètre étroit** : seuls les justificatifs. Tout signer casserait le cache des images publiques (avatars,
  photos de trajet) pour un gain nul.

## La moitié qui n'est pas dans le dépôt

La signature ne **protège** que si le compte ImageKit **refuse les URL non signées** (« Restrict unsigned
URLs »). Sans ce réglage, l'URL signée fonctionne… et l'URL nue aussi. C'est écrit dans
`docs/livrables/05-YAMBA-CONFIGURATION.md`, avec la mention « à vérifier à chaque nouvel environnement » — une
mesure de sécurité à moitié déployée est une mesure qui rassure sans protéger.

**Écarté** : proxifier les fichiers par le service. Le trip-service deviendrait un serveur de fichiers, avec sa
bande passante et son cache à tenir, pour un bénéfice que la signature obtient sans code.

## Tests

trip-service **305 → 308** : l'URL rendue est signée (jamais celle de la base), l'ouverture reste journalisée,
et un document introuvable ne signe ni ne journalise rien.

---

# PR — Cahier 04-CRONS remis à l'état du code · `chore/cahier-crons-a-jour`

## Pourquoi

Le handoff du 17/09 proposait, parmi les pistes non engagées, de « rejouer sur 01-WEB, 03-API et 04-CRONS
l'exercice qui a levé la réserve du 02-ADMIN ». Le raisonnement était le même : une campagne de recette laisse
derrière elle deux documents qui vieillissent à des vitesses différentes — le cahier, écrit **avant**, et les
résultats, écrits **pendant**. Chaque correction livrée après la campagne creuse l'écart, silencieusement.

Et comme sur le 02-ADMIN, l'estimation était basse : le handoff annonçait **un** écart pour ce cahier (la
divergence `DIV-3`). Il y en avait **douze**, dont un qui casse la CI et un qui a réellement provoqué une
anomalie bloquante pendant la campagne.

La méthode est identique : la source n'est pas le résumé, ce sont les constats consignés **au fil des
chapitres** dans `context/YAMBA-RECETTE-CRONS-RESULTATS.md`. Et chaque correction est vérifiée **dans le code**,
jamais recopiée d'un document vers un autre.

## Les douze écarts

| # | Où | Avant | Maintenant |
|---|---|---|---|
| 1 | En-tête | référence `feat/f3-messaging-admin` au 06/09/2026 | `dev` au 18/09/2026 ; **le `.md` fait foi**, le `.pdf` du 06/09 n'est plus régénéré à chaque passe |
| 2 | § 1.3 | renvoi vers `docs/recette/RECETTE-01-MEMBRE.md` — **fichier inexistant** | `RECETTE-01-WEB.md` |
| 3 | § 1.5 `DIV-3` | « l'en-tête de `payout-bookings.cron.ts` annonce un rejeu < 10 essais » | **refermée** — l'en-tête dit aujourd'hui l'inverse, mot pour mot |
| 4 | § 1.5 `DIV-2` | « la ligne `outbox-retention` porte trip / deal / message » | **refermée** — le tableau transverse du livrable dit « deal / message » |
| 5 | § 1.5 `DIV-1` | « défini mais jamais démarré » | **encore vraie à moitié** : le livrable se contredit — « n'est appelé nulle part » au § 4.1 et au § 9.4, « Démarré depuis A148 » dans le tableau des crons du même § 9.4 |
| 6 | § 2.7 et 36 renvois | scripts annoncés `scripts/recette-<nom>.ts`, à créer un par un | ils **existent, versionnés**, dans `scripts/recette/` (45 fichiers) ; les blocs de code deviennent la documentation de ce que fait chaque script |
| 7 | 36 blocs de code | imports en `../packages/…` et `../apps/…` | `../../packages/…` et `../../apps/…` — les scripts vivent un niveau plus bas |
| 8 | § 2.7 | `scripts/recette-secret-audit.ts` | `scripts/recette/audit-code-livraison.ts` — **le nom d'origine fait tomber la CI** |
| 9 | § 2.7 | « un script `tsx` résout les alias `@packages/*` » | vrai **transitivement** seulement : les 43 scripts TS importent en relatif, aucun n'emploie l'alias |
| 10 | `CRON-TRAJETS-4` | « supprimer la `CarrierPage` pour provoquer un échec » | la provocation **ne provoque rien** : `if (carrierPage)` tolère l'absence par conception. La fiche se vérifie désormais par la **forme** de la garde |
| 11 | `CRON-CONSO-3` et `CRON-CONSO-4` | `rpk topic produce …` | `rpk topic produce -z none …` — **la commande d'origine a provoqué `ANO-CRON-08`** (bloquante) |
| 12 | `CRON-SEC-3` | « l'administrateur voit un dossier sans contenu » | le dossier apparaît dans la file, marqué `purged: true`, **et reste traitable** (`ANO-CRON-09`) |

## Les deux écarts qui valent plus qu'une correction de texte

**Le nom de fichier qui casse la branche.** Le cahier demandait de créer `scripts/recette-secret-audit.ts`. Le
contrôle CI `Anti-fuite (fichiers sensibles)` refuse **tout fichier suivi** dont le chemin contient `secret` :

```sh
git ls-files | grep -iE '(^|/)\.env($|\.)|secret|\.pem$|\.key$' | grep -vE '\.(example|template)$'
```

Un testeur qui suit le cahier à la lettre **et versionne son script** casse la branche, avec un message d'erreur
qui parle de fuite de secrets alors qu'il n'y en a aucune. La campagne l'avait contourné en nommant le fichier
`audit-code-livraison.ts` — et en écrivant la raison dans son en-tête, ce qui est exactement ce qu'il fallait
faire. Le cahier le dit maintenant aussi, parce qu'un contournement connu d'un seul développeur n'est pas un
contournement.

**L'outil de recette qui fabrique la panne qu'il doit observer.** `CRON-CONSO-3` veut éprouver un poison de
**contrat** : un message hors schéma doit être classé `FAILED` sans bloquer la partition. La commande du cahier,
sans `-z none`, publiait en **snappy** — compression par défaut de `rpk` — que kafkajs ne sait pas décompresser.
Résultat : `KafkaJSNotImplemented`, erreur **non retriable**, consommateur arrêté définitivement, processus
toujours vivant et `/health` toujours vert. C'est `ANO-CRON-08`, bloquante.

Le défaut trouvé était réel et il est corrigé (relance à retrait exponentiel, vérification `consumers` dans
`/health`). Mais les deux choses doivent être distinguées : un poison de **transport** et un poison de
**contrat** ne s'éprouvent pas avec la même fiche. Le cahier porte maintenant les deux : `-z none` dans la
commande, et l'avertissement qui explique pourquoi.

## La fiche qui ne peut pas être mesurée, et qu'on cesse de prétendre mesurer

`CRON-TRAJETS-4` demandait de faire échouer un trajet sur trois pour prouver que la fournée continue. Les trois
moyens envisageables échouent, et pour des raisons différentes :

| Moyen | Pourquoi il ne marche pas |
|---|---|
| Supprimer la `CarrierPage` | le code teste `if (carrierPage)` avant d'écrire : l'absence est **tolérée par conception** |
| Pointer `userId` sur un identifiant inexistant | même résultat — `findUnique` rend `null`, pas une erreur |
| Écrire un `userId` malformé en Mongo brut | Prisma refuse la valeur **au scan**, avant la boucle : on casse un autre endroit que celui qu'on veut éprouver |

La fiche demande donc maintenant de vérifier la **forme** de la garde — `try/catch` autour du corps d'**un seul**
trajet, `skipped++`, la ligne de journal, aucun `throw` qui remonte — et de consigner que la propriété est
**structurelle**, pas mesurée. L'amélioration qui la rendrait mesurable (passer le client Prisma en argument,
comme le font déjà `recipient-redaction` et `unread-reminder`) est écrite dans la fiche, et reste **non faite**.

Dire « vérifié par lecture » est honnête ; laisser une étape qui ne prouve rien ne l'est pas.

## Ce qui a aussi été corrigé dans les résultats

Le fichier de campagne n'était pas exempt :

- `ANO-CRON-07`, `ANO-CRON-08` et `ANO-CRON-09` portaient **`ÉTAT : OUVERTE`** dans leur fiche, et **`close`**
  dans le tableau de verdict final. Les trois corrections sont bien **dans le code** (vérifié : `shipperKey:
  "joao"` plus le garde-fou `seed-integrity.spec.ts` ; la vérification `consumers` du `/health` du
  notification-service ; le `purged: true` d'`admin-conversation.service.ts`). Les fiches disent maintenant
  `CLOSE`.
- Le tableau final nommait **cinq fiches qui ne sont pas celles des chapitres**, dont `CRON-TRAJ-5`, qui
  n'existe dans aucun cahier. Les chapitres, écrits au fil de la campagne, font foi.
- Il comptait « quatre majeures » pour trois, et classait `ANO-CRON-03` en mineure quand sa fiche la dit
  cosmétique.

## Vérifications faites, pas supposées

- Les **13 crons** annoncés existent et sont **tous démarrés** (`ls apps/*/src/cron/*.cron.ts` croisé avec les
  `start…Cron(` des six `main.ts`) — le chiffre du périmètre tient.
- Les **45 scripts** de `scripts/recette/` sont bien versionnés (`git ls-files`), et chacun des 28 chemins
  réécrits pointe sur un fichier **qui existe**. Les trois qui n'ont pas été versionnés
  (`conservation-eligible.ts`, `payload-audit.ts`, `purgeout-eligible.ts`) sont signalés **sur place** comme
  restant à créer.
- La règle CI a été lue dans `.github/workflows/ci.yml`, pas supposée.
- `DIV-1`, `DIV-2` et `DIV-3` ont été confrontées une à une au livrable technique **et** au code.
- `ANO-CRON-08` et `ANO-CRON-09` ont été vérifiées dans les sources, pas dans leur fiche de correction.

---

# PR — Cahier 03-API remis à l'état du code · `chore/cahier-api-a-jour`

## Pourquoi

Deuxième volet de la passe cahiers ouverte par `chore/cahier-crons-a-jour`. Même méthode, même
précaution : la source, ce sont les sections « Écarts du cahier » consignées chapitre par chapitre
dans `context/YAMBA-RECETTE-API-RESULTATS.md` — et **chaque écart est confronté au code avant
d'être reporté**, jamais recopié.

Cette précaution a payé immédiatement : sur les onze écarts listés, **un ne tient pas** et **un
était déjà corrigé**. En revanche la relecture en a trouvé **deux que la campagne n'avait pas vus**.

## Les onze écarts, et ce qu'ils sont devenus

| # | Fiche | L'écart consigné | Verdict après vérification |
|---|---|---|---|
| 1 | `API-GW-13` (c) | vise `bzv-accepted`, sans code de livraison | **reporté** — cible `bzv-picked` + `shipper.txt` |
| 2 | `API-GW-10` | `x-locale` contre `preferredLocale` | **déjà reporté** le 09/09 (dette D-1) |
| 3 | `API-GW-20` | « le jeu d'essai ne publie que deux trajets futurs » | **ne tient pas** — il en publie **cinq** |
| 4 | `API-AUTH-11` | `{sessions:[]}` contre `{items:[]}` | **reporté** + la route `/sessions/all` (D78) |
| 5 | `API-AUTH-01` | message de retour inexact | **reporté** |
| 6 | `API-AUTH-12` | `sudo/verify` attendrait `otp` | **sans objet** — mais **un autre écart trouvé** |
| 7 | `API-AUTH-15` | `displayName`/`bio` sur une Expéditrice | **reporté** — 400 `NO_CARRIER_PAGE` |
| 8 | `API-AUTH-33` | `CARRIER` visible après renouvellement | **reporté**, avec la cause |
| 9 | — | doublon du n° 4 | fondu dans le 4 |
| 10 | `API-TRIP-13` | capacité « immuable après publication » | **reporté** — la vraie garde est meilleure |
| 11 | `API-TRIP-01` | `rating`/`reviewCount` inconditionnels | **reporté** — ils sont **conditionnels** |
| 12 | `API-TRIP-18` | *(hors liste)* ne visait pas la route de la dette D-3 | **ajouté** |

Plus l'en-tête (« Version 1.0 — branche `docs/recette` » → `dev` au 18/09, le `.md` fait foi) et les
trois renvois croisés par joker (`RECETTE-01-*.md`) ramenés aux noms exacts.

## L'écart qui ne tenait pas, et pourquoi il faut le dire

Le constat du 08/09 était : « `API-GW-20` suppose plus de deux trajets cherchables ; le jeu d'essai
n'en publie que deux dans le futur ». Vérifié contre le code et le seed :

```ts
// apps/trip-service/src/controllers/trip-search.controller.ts
const where = { status: "PUBLISHED", user: { is: notSuspendedOwnerFilter() }, ...notHiddenFilter() };
where.departureAt = { gte: effectiveFrom };     // effectiveFrom = now, sauf dateFrom futur
```

Le jeu d'essai publie **huit** trajets, dont **cinq** à départ futur (`yul` J+3, `gru` J+5, `fih`
J+7, `bzv-upcoming` J+10, `bzv-perkg` J+15) ; trois sont partis. Et `git log` sur `seed-deals.ts`
montre qu'**aucun trajet n'a été ajouté depuis la campagne**.

La mesure du 08/09 portait donc sur une base **usée par les fiches précédentes**, pas sur le jeu
d'essai. Corriger le cahier aurait propagé une fausse contrainte. Ce qui y est ajouté à la place est
un **prérequis de données** : cette fiche a besoin d'au moins trois trajets cherchables, un seed
frais en fournit cinq, et une première page qui rend déjà `nextCursor: null` veut dire « rejouer le
seed », pas « anomalie ».

> Un journal de campagne est une source primaire, mais il date d'un **état de base** qu'il ne décrit
> pas toujours. Vérifier même ce qu'on est venu chercher.

## L'écart que la campagne n'avait pas vu — un contrat enseigné faux

`API-AUTH-12` envoyait :

```bash
-d '{"currentPassword":"Yamba-Dev-2026!","newPassword":"Yamba-Recette-2026!"}'
```

Le contrat ne porte pas `currentPassword` :

```ts
export const ChangePasswordRequestSchema = z.object({ newPassword: z.string().min(1).max(200) })
  .meta({ description: "Under sudo (D65 3A); every other session is revoked" });
```

C'est **la fenêtre sensible qui remplace le mot de passe actuel** — c'est tout l'intérêt de D65, et
c'est ce qui permet de changer son mot de passe quand on ne s'en souvient plus, sans passer par une
réinitialisation.

Le champ en trop ne faisait rien tomber : **Zod n'est pas strict par défaut**, les clés inconnues
sont retirées silencieusement. La fiche répondait donc 200, le testeur cochait « conforme », et le
cahier continuait d'enseigner un contrat qui n'existe pas. Un intégrateur qui lit ce cahier construit
son client sur une supposition fausse — et ne s'en aperçoit jamais, puisque le serveur ne s'en plaint
pas.

## Deux fiches qui décrivaient une garde moins bonne que la vraie

**`API-TRIP-13`** annonçait « la capacité est immuable après publication ». Elle ne l'est pas. La
règle réelle, dans la machine :

```ts
edit: {
  from: ["DRAFT", "PUBLISHED", "PAUSED"],
  guard: (trip, ctx) => trip.status !== "DRAFT" && ctx.hasActiveBookings
    ? "Cannot edit a trip with active bookings. Cancel the trip instead." : null,
}
```

C'est **plus fin et plus juste** : le cas dangereux (réduire la capacité sous les kilos déjà
réservés) est impossible, et le cas inoffensif (corriger sa capacité avant la première réservation)
reste permis. Une immuabilité champ par champ aurait interdit le second sans mieux protéger du
premier. La fiche prouve désormais la vraie garde, sur `bzv-upcoming` — le seul trajet du seed qui
porte des réservations actives (`bzv-perkg`, que le premier jet de cette correction visait, n'en a
**aucune** : vérifié avant d'écrire).

**`API-TRIP-01`** listait `rating` et `reviewCount` parmi les champs d'une carte. Ils sont
**conditionnels** :

```ts
const rating = cp && cp.ratingsCount > 0 ? cp.ratingsAvg : undefined;
```

`undefined` ne se sérialise pas : sur un jeu d'essai sans avis, les deux champs sont **absents du
JSON**. Leur absence est le comportement correct, et la fiche le dit maintenant.

## Le rôle qui vient du jeton, pas de la base

`API-AUTH-33` annonçait « après (4), `GET /auth/me` porte `CARRIER` dans `roles` ». En réalité :

```ts
req.roles = decoded.roles ?? user.roles ?? [];        // packages/middleware/isAuthenticated.ts
return res.status(200).json({ …, roles: req.roles ?? fullUser.roles ?? [] });   // getMe
```

Les rôles viennent du **jeton d'accès**. Accorder un rôle en base ne réécrit pas un jeton déjà signé.
`POST /auth/refresh` relit `user.roles` et resigne — c'est ce que fait le front, et c'est ce que la
fiche demande maintenant de faire avant de constater le rôle. Ce n'est pas un défaut : c'est le prix,
assumé, d'un jeton qu'on n'a pas à revalider en base à chaque requête.

## Vérifications faites, pas supposées

- Les enveloppes lues dans les **schémas de contrat** (`MemberSessionsResponseSchema`,
  `ChangePasswordRequestSchema`, `SudoVerifyRequestSchema`), pas dans les fiches.
- Le seed compté **trajet par trajet** et **réservation par réservation** — c'est ce qui a rattrapé
  une cible fausse dans la correction elle-même.
- `refreshAuthTokens` lu en entier pour confirmer que le renouvellement relit bien `user.roles`.
- La garde `edit` lue dans la machine à états, la garde du code de livraison dans
  `conversation.service.ts`, la condition de `rating` dans `trip-mappers.ts`.
- L'écart n° 6 déclaré « sans objet » après vérification : le cahier écrit déjà `{"code":…}`.

---

# PR — Cahier 01-WEB remis à l'état du code · `chore/cahier-web-a-jour`

## Pourquoi

Troisième et dernier volet de la passe cahiers (après #345 pour le 04-CRONS et #346 pour le 03-API).
C'est le plus gros des quatre cahiers — ~330 scénarios — et le seul dont les écarts ne sont **pas**
consignés en sections : ils sont **en ligne**, au fil des tableaux de résultats, en gras
(`**Écart** : …`), une phrase perdue au milieu d'un verdict de quinze lignes.

```sh
# Sur le 02-ADMIN et le 03-API, les écarts avaient leur section :
grep -n -i '^#\{2,4\}.*écart' context/YAMBA-RECETTE-*-RESULTATS.md
# Sur le 01-WEB, il faut les cueillir dans les cellules :
sed -n '1151,4249p' context/YAMBA-RECETTE-WEB-RESULTATS.md | grep -o '\*\*Écarts\?\*\*[^|]*'
```

**Dix-sept fiches** portaient un attendu que le code ne tient pas, plus **onze étapes** des six
parcours du chapitre 6 que le journal de campagne décrivait déjà comme « écarts assumés ».

## La distinction qui structure toute la correction

Un écart de cahier n'a pas toujours le même remède. Deux familles, et le testeur doit pouvoir les
distinguer **au premier coup d'œil** — sinon il rouvre à chaque passe une question déjà tranchée :

| Mention portée par l'encadré | Ce que ça veut dire | Quoi faire |
|---|---|---|
| **le code a raison** | l'attendu du cahier était faux, ou trop littéral | corriger sa lecture, **ne rien consigner** |
| **décision de produit en attente** | l'écart est réel, la question a été posée le 09/09, **rien n'a été changé** | **ne rien consigner non plus** — c'est déjà tranché *comme question ouverte* |

C'est la leçon du 02-ADMIN, où les écarts `NRG-7` avaient été marqués `LEVÉ` / `RÉDUIT` **en gardant
leurs numéros** : un écart qu'on efface revient ; un écart qu'on date et qu'on qualifie ne revient
pas.

## Les dix-sept fiches

| Fiche | L'attendu du cahier | Ce que fait le code | Famille |
|---|---|---|---|
| `WEB-ACC-1` | « Rechercher un trajet » + « Créer un compte » dans l'en-tête desktop | absents sur desktop, présents en mobile | produit |
| `WEB-ACC-2` | info-bulle « Changer de langue » | segment « FR \| EN », pas d'info-bulle ; la clé est **morte** | code |
| `WEB-ACC-10` | l'inversion recalcule les résultats | recalcul au clic « Rechercher » | code |
| `WEB-ACC-11` | « Aide » + sections du menu | « **Centre d'aide** » ; sections en mobile seulement | code |
| `WEB-INS-1` | clic « Créer un compte » depuis l'accueil | passer par « Connexion » ; titre « Deviens Voyageur » conservé | code + produit |
| `WEB-INS-5` | `01/01/2000!` → « pas une date valable » | → « minuscule » (`CHECK_ORDER`) | code |
| `WEB-INS-6` | l'adresse saisie, en clair | adresse **masquée** (`maskEmail`) | produit |
| `WEB-CNX-3` | atterrissage « espace membre » | `router.push(redirectTo \|\| "/")` | code |
| `WEB-CNX-7` | « Appareils connectés », « Chrome sur macOS » | « **Sessions actives** », « Chrome · macOS » | code |
| `WEB-CNX-10` | porte **avant** le formulaire, code qui l'ouvre | porte **au geste**, code qui **rejoue** le geste | code |
| `WEB-CNX-11` | mot de passe puis export, même fenêtre | le mot de passe **ferme** la fenêtre (`closeSudoWindow`) | code |
| `WEB-PRO-8` | « le nom affiché est à jour » sur la page publique | **« Prénom N. »**, jamais `CarrierPage.name` | code |
| `WEB-TRJ-3` | mention « Ton prix = ton net » | chaîne **morte** (`netGainSub`) | copie |
| `WEB-DEA-1` | carte « {n} demandes en attente » | copie **morte**, une ligne par demande | copie |
| `WEB-DEA-2` | 4 attendus | 1 anomalie (`ANO-WEB-43`) + 3 textes non rendus | mixte |
| `WEB-MSG-3` | un bouton qui explique | aucun bouton ; garde serveur 403 en place | produit |
| `WEB-MSG-21` | la bulle compte les conversations | elle compte les **messages** (`reduce` des `unreadCount`) | produit |

## Trois découvertes de la passe

**1. Quatre chaînes sont mortes.** Elles existent en traduction, la CI les voit bien miroitées FR/EN
— et **aucun composant ne les rend** : `header.toggleLanguage`, `dashboardHome.demandsTitle` /
`ctaRespond`, `carrierDealRequest.coverage.title`, plus `create-trip.copy.ts → netGainSub` hors
`messages/`.

C'est exactement le mécanisme qui fabrique un cahier faux : quelqu'un lit la traduction, en déduit
l'écran, et l'écran a changé depuis. Le contrôle CI vérifie le **miroir** et l'**absence de point**
dans les clés ; il ne détecte pas une clé que plus personne ne lit.

> **Piste, non engagée** : un contrôle « clé orpheline » (chaque clé de `messages/**` apparaît-elle
> dans une source ?) attraperait cette famille pour un coût proche de zéro. À arbitrer — les clés
> composées dynamiquement demanderaient une liste d'exceptions, et une liste d'exceptions qui grossit
> est un contrôle qui meurt.

**2. Un écart où le code disait mieux que le cahier.** `WEB-DEA-2` attendait « Versement à J+4 après
livraison validée · sur ton compte Stripe ». L'écran dit « Versé {n} jours après livraison validée
**par code confidentiel** ». Le texte réel nomme **ce qui déclenche** le versement, là où le cahier
nommait seulement où l'argent arrive. C'est le cahier qui est aligné sur le code, pas l'inverse.

**3. Une étape de parcours ne mesurait rien.** `WEB-E2E-6` étape 9 : « vérifie qu'aucun SMS n'a été
envoyé ». Vérifié : **aucune dépendance SMS** dans `package.json`, **aucun appel** dans les sources.
Ce n'est pas une observation de recette, c'est un **fait de plateforme** — il n'y a rien à mesurer,
et une étape qui ne peut pas échouer occupe la place d'une vraie preuve. L'étape porte maintenant ce
qui se mesure : l'absence d'email au tiers, et l'adressage exclusif aux membres.

## Les onze étapes des parcours du chapitre 6

`WEB-E2E-2` (11, 12 : pas de bouton « Donner ma version », l'endpoint nommé) · `WEB-E2E-3` (12 : les
kilos ne sont pas à l'écran ; 15 : la branche « sinon, l'annulation passe » n'est pas atteignable sur
le jeu d'essai) · `WEB-E2E-4` (12 : le geste n'est **pas** rejoué, la page est rafraîchie ; 13 :
« Sessions actives ») · `WEB-E2E-5` (6 : le sujet réel de l'email ; 8 : mêmes kilos) · `WEB-E2E-6`
(3 : `IN_TRANSIT` au décollage, `ARRIVED` à l'atterrissage — l'aéroport n'est pas un jalon public ;
9 : le SMS).

## Vérifications faites, pas supposées

Chaque écart ouvert dans le code avant d'être écrit : `CHECK_ORDER` (`auth-error-codes.ts`),
`router.push(redirectTo || "/")` (`LoginForm.tsx`), `closeSudoWindow` (`account.controller.ts`),
`activeSessions` (`dashboard.copy.ts`), `maskEmail` (`email-mask.ts`), `totalUnread` (`reduce` des
`unreadCount`, `conversation.service.ts`), `netGainSub` et `coverage.title` (présents, non rendus),
`edit` de la machine à états, et l'absence de SMS (`package.json` + balayage des sources).

## Ce qui reste ouvert

`ANO-WEB-43` (mineure) : le bloc « DE LA PART DE » ne porte ni « {n} envois » ni « Membre depuis » —
le DTO ne transporte pas ces compteurs. C'est la **seule** anomalie des dix-sept fiches ; les seize
autres étaient des attendus de cahier ou des questions de produit.

## Périmètre

Documentation seule. `YAMBA-DOC-METIER.md` n'est pas touché : aucune règle métier ne bouge.

**La passe cahiers est close** : les quatre cahiers (01-WEB, 02-ADMIN, 03-API, 04-CRONS) sont à
l'état du code.

---

---

# PR — Trois fiches de test redeviennent des modules · `chore/specs-export-vide`

## Pourquoi

Trouvé en vérifiant que `dev` était propre avant d'ouvrir un nouveau chantier, pas en le cherchant.
`npx nx typecheck auth-service` échoue sur **53 erreurs**. La CI, elle, est verte — et les deux ont
raison, parce qu'elles ne regardent pas les mêmes fichiers :

| | Ce qui est typechecké | Les fiches de test ? |
|---|---|---|
| **CI** (`npx tsc --noEmit --project apps/auth-service/tsconfig.app.json`) | le code applicatif | **exclues** (`"exclude": ["src/**/*.spec.ts", …]`) |
| **Cible Nx** (`tsc --build tsconfig.json --emitDeclarationOnly`) | tout le projet | **incluses** |

Un défaut qui ne vit que dans les fiches de test est donc **structurellement invisible pour les 17
checks**. Ce n'est pas un oubli de configuration : exclure les specs du typecheck applicatif est le
bon choix (on ne veut pas qu'une fiche bloque un build). Mais il faut savoir que la conséquence est
un angle mort, et que la seule chose qui le couvre est la cible Nx — qu'il faut donc faire tourner.

## Le défaut, qui était déjà écrit

C'est le piège consigné le 17/09 et enseigné au chapitre 188 de `YAMBA-APPRENTISSAGE-DEV.md` :

> Une fiche de test qui n'a ni `import` ni `export` est un **script** pour TypeScript : ses
> constantes de tête tombent dans la portée globale partagée et se heurtent à celles des autres
> fiches (TS2451, rapporté sur le **fichier voisin**, invisible pour `nx test`).

**Quatre** fiches étaient encore dans ce cas — trois trouvées par l'échec du typecheck, la quatrième
par le balayage (voir plus bas) :

```
apps/auth-service/src/controller/admin-admins.controller.spec.ts
apps/auth-service/src/controller/admin-users-concurrency.controller.spec.ts
apps/auth-service/src/controller/privacy-requests.controller.spec.ts
apps/message-service/src/services/report-doublon.service.spec.ts     ← latente
```

La quatrième ne faisait **rien tomber aujourd'hui** : `nx typecheck message-service` était à **0
erreur**. C'est une bombe à retardement, pas une panne — elle expose `prismaMock`, `T0`, `CONV`,
`BOOKING`, `SHIPPER`, `CARRIER`, `MESSAGE` à la portée globale du projet, et la première fiche
voisine qui déclarera l'un de ces noms fera tomber le typecheck **sur elle**, pas sur celle-ci.
C'est tout l'intérêt de balayer plutôt que d'attendre le symptôme.

Elles déclarent toutes `prismaMock`, `tx`, `conflit`, `ctrl`… dans la portée globale. D'où les
collisions — et, en cascade, des `TS7022` / `TS7024` sur des fiches **voisines** parfaitement
correctes, dont l'inférence devenait circulaire.

## Ce qui a été fait

`export {};` en pied des trois fichiers, avec le commentaire qui dit pourquoi — pour que personne ne
le retire en croyant nettoyer une ligne inutile.

**53 erreurs → 4.** Les 22 erreurs restantes du premier décompte étaient des dommages collatéraux :
elles ont disparu sans qu'on touche aux fichiers qui les portaient.

## Les quatre erreurs qui restent, et pourquoi on n'y touche pas

```
admin-auth-sessions.controller.spec.ts:25         TS7022 / TS7024
admin-auth-totp-concurrency.controller.spec.ts:52 TS7022 / TS7024
```

Ces deux fiches **sont** de vrais modules : le défaut est ailleurs.

```ts
const prismaMock = { …, $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prismaMock)) };
//    ^^^^^^^^^^                                                                                 ^^^^^^^^^^
//    se référence dans son propre initialiseur → TypeScript ne peut pas inférer son type
```

C'est **exactement le patron `$transaction: (fn) => fn(prismaMock)`** qu'A197 a corrigé sur les deux
écrivains qui portent les invariants, et dont le handoff du 17/09 dit qu'il « traîne encore
ailleurs ; il ment partout où il subsiste ». L'annoter `: any` ferait taire le compilateur **en
gardant le mock menteur** — un plâtre sur ce que le dépôt a justement décidé de retirer.

**Ces deux fiches appartiennent donc au ménage des mocks `$transaction`, pas à cette PR.** Le
corriger ici, c'est-à-dire écrire un client de transaction **distinct** du client de base, ferait
tomber l'erreur de type comme effet secondaire — et pour la bonne raison.

## Tests

auth-service **395** (52 suites) et message-service **79**, tous **inchangés**. Le typecheck de la CI
(`tsconfig.app.json`) reste vert, et `nx typecheck message-service` passe. Aucun comportement
modifié : `export {};` ne change que la **nature du fichier** pour TypeScript, pas ce que Jest
exécute.

## Ce que ça apprend, au-delà des trois lignes

Le piège était **écrit** — dans le handoff, dans le chapitre 188 — et il était **toujours là**. Une
leçon consignée n'est pas une leçon appliquée : il manquait le balayage.

```sh
# Le balayage, en une ligne — il a trouvé la quatrième fiche, celle qui ne faisait encore rien tomber
for f in $(git ls-files '*.spec.ts' '*.test.ts'); do
  grep -qE '^\s*(import|export) ' "$f" || echo "$f"
done
```

Rejoué après correction : **plus aucune fiche-script** dans le dépôt. Ce balayage est le candidat
évident à un contrôle de CI — il coûte une seconde et n'a aucune exception à maintenir, contrairement
à la piste « clé i18n orpheline » du 18/09. **Non engagé** : à arbitrer.

`YAMBA-DOC-METIER.md` n'est pas touché : aucune règle métier ne bouge.

---

---

# PR — Le mock de transaction devient un outil partagé (A200) · `feat/menage-mocks-transaction`

## Pourquoi

Dernier reste du handoff du 17/09 : « le patron `$transaction: (fn) => fn(prismaMock)` traîne encore
ailleurs ; A197 l'a corrigé sur les deux écrivains qui portent les invariants, il ment partout où il
subsiste, simplement sans conséquence connue ».

L'inventaire a déplacé la question. Le patron est dans une vingtaine de fiches, mais **le risque
n'est pas là** : il est dans les écrivains qui portent un invariant et n'ont aucune fiche exécutable.

| Invariant | Écrivains | Couverts avant ce lot |
|---|---|---|
| **D2** — l'événement outbox dans la MÊME transaction que l'état | `booking-write.ts`, `conversation.service.ts`, **`deal-request.service.ts`**, **`deal-mediation.service.ts`** | **2 sur 4** |
| **Journal admin** — la ligne d'audit dans la même transaction que le geste | 8 fichiers, ~50 appels | **0** |

Les deux écrivains non couverts respectent D2 aujourd'hui — vérifié en lisant leur code. Ce qui
manquait, c'est ce qui les empêchera de cesser de le faire.

Sur le journal admin, les ~15 appels `recordAdminAction(prisma, …)` ont été ouverts **un par un** :
**aucune violation**. Ceux qui n'ont pas de transaction n'en ont pas besoin — déconnexion, export,
consultation, ou (pour `resendAdminInvite`) un geste qui n'écrit que dans **Redis**. La règle du
dépôt le prévoit explicitement : « dans la MÊME transaction que le geste **quand il en a une** ».

## Les trois gestes du lot

### 1. Le patron devient une lib, et la lib se teste elle-même

`packages/libs/test-prisma` — `creerPrismaJournalise({ modeles, retours })` rend un client dont chaque
méthode **journalise sa provenance** :

```ts
const j = creerPrismaJournalise({ modeles: ["booking", "outboxEvent"] });
jest.mock("@packages/libs/prisma", () => ({ __esModule: true, default: j.prisma }));
…
expect(j.horsTransaction("outboxEvent", "create")).toHaveLength(0);
```

`$transaction` incrémente un compteur avant d'appeler la fonction et le restaure après, **y compris
si elle lève**. Tout appel fait pendant porte ce numéro ; tout appel fait avant ou après porte
`null`. C'est cette seule différence qui rend « dedans » et « dehors » distinguables.

`manquementsD2(appels, { modelesDEtat })` est la règle sous forme de fonction pure. Sa fiche
(`apps/deal-service/src/services/test-prisma.spec.ts`, **17 cas**) la met au **ROUGE** sur cinq
violations réelles avant de la voir verte : l'événement écrit dehors, l'état écrit dehors, l'état et
l'événement dans **deux** transactions… Une garde qu'on n'a jamais vue échouer n'est pas une garde.

**Deux décisions de conception, payées sur place :**

- **Les méthodes sont de vrais espions jest.** Sans ça, adopter l'outil casserait chaque
  `toHaveBeenCalledWith` des fiches existantes — et personne ne l'adopterait.
- **`reinitialiser()` RÉINSTALLE l'implémentation journalisante**, il ne se contente pas de vider les
  compteurs. J'ai introduit le défaut inverse et il m'a coûté deux tests rouges : un test posait
  `findUnique.mockReset().mockImplementation(…)` sur une fermeture locale, l'écrasement survivait au
  `beforeEach`, et **le test suivant héritait d'un secret périmé** → 401 au lieu de 200. C'est la
  famille A199 : ce qui fuit **entre** les fiches, pas dans l'une d'elles. Deux cas le couvrent.

Un troisième piège, payé aussi : `jest` est injecté par Jest dans la portée de **chaque module**,
comme `require` — ce n'est **pas** une propriété de `globalThis`. Un contournement qui passait par
`globalThis.jest` a fait tomber 16 tests d'un coup. La lib le déclare donc localement, au strict
nécessaire, ce qui la rend typecheckable depuis un projet qui n'a pas chargé `@types/jest`.

### 2. Le filet à mailles larges : une garde qui lit la source

`apps/deal-service/src/services/d2-ecrivains-outbox.spec.ts` n'ouvre aucune base et ne pilote aucun
service : il **balaie les sources des cinq services** et refuse tout `outboxEvent.create` posé sur le
client **global**.

C'est une propriété syntaxique, plus faible qu'un comportement mesuré. Elle a deux qualités que
l'autre n'a pas : elle couvre **tout le dépôt**, et elle couvre **ce qui n'est pas encore écrit**.
Même famille que les gardes déjà en place (`seed-integrity` lit le seed, `outbox-purge` lit la source
du cron, `refusal-codes` lit les contrôleurs).

**Resserrée après l'avoir vue trop large.** Écrite d'abord sur toutes les écritures, elle levait
**dix signalements, tous légitimes** : le relais marque `publishedAt` et `attempts` sur le client
global, le cron de conservation purge les lignes publiées. Ces écritures portent sur le **cycle de
vie** d'un événement déjà produit, pas sur sa **naissance** — et n'accompagnent aucun changement
d'état. D2 dit « aucun changement d'état sans son événement » : c'est la naissance qui doit être
atomique. La règle ne retient donc que `create` / `createMany`.

> **Un garde-fou qui crie à tort est un garde-fou qu'on désarme.** Le resserrement n'est pas une
> concession, c'est la règle enfin dite juste.

**Contre-épreuve, exigée par le dépôt** : le défaut réintroduit dans `deal-mediation.service.ts`
(`tx.outboxEvent.create` → `prisma.outboxEvent.create`) fait tomber la fiche, qui **nomme le
fichier** ; code restauré à l'identique (`git diff` vide).

### 3. Les deux mocks auto-référents, et les 53 erreurs qu'ils cachaient

`const prismaMock = { …, $transaction: jest.fn(async (fn) => fn(prismaMock)) }` se référence dans son
propre initialiseur : TypeScript ne peut plus inférer son type (`TS7022` / `TS7024`).

Les deux fiches concernées adoptent la lib. **`nx typecheck auth-service` : 53 erreurs → 0.**

## Ce qui n'est pas fait, et pourquoi c'est écrit ici

- **Les ~18 autres fiches qui portent le patron.** Coût mécanique élevé, risque de régression réel,
  et l'invariant qu'elles pourraient cacher est désormais gardé **ailleurs**, globalement. Elles sont
  consignées, pas oubliées — la lib existe pour que la prochaine fiche n'en ajoute pas une
  dix-neuvième.
- **Les fiches pilotées pour `deal-request` et `deal-mediation`.** Le filet à mailles larges ne
  prouve pas qu'un `tx` passé en argument soit bien celui d'une transaction ouverte : c'est le
  travail d'une fiche qui pilote le code réel, comme les deux d'A197. Ces services demandent un
  échafaudage lourd (fournisseur de paiement, devis, plafonds) — à faire dans son propre lot.
- **Le journal admin rendu exécutable.** Aucune violation trouvée par lecture ; la garde reste à
  écrire. Sa forme syntaxique est plus difficile que celle de D2 : il faut savoir si le geste
  englobant ouvre une transaction.

## Tests

deal-service **659 → 680** (+17 la lib, +4 le garde-fou). auth **395**, trip **308**, notification
**122**, message **79** — inchangés. **1584 au total.** `nx typecheck` des **cinq** services à
**0 erreur**, et le typecheck de la CI vert sur les huit projets.

`YAMBA-DOC-METIER.md` n'est pas touché : aucune règle métier ne bouge. Arbitrage **A200** au registre.

---
