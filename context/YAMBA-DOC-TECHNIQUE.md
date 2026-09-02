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
