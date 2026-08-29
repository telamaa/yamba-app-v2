# YAMBA — APPRENTISSAGE DÉVELOPPEUR (cumulatif, format tutoriel)

> **Règle d'équipe (29/08/2026)** : à chaque PR, une section « Ce que tu apprends avec cette PR » est **ajoutée** ici : les techniques et notions des langages/outils utilisés, **le pourquoi**, de la théorie à la pratique **telle qu'implémentée dans Yamba** (chemins réels, extraits), les pièges, et « pour aller plus loin ». Jamais de nouveau fichier. Lire dans l'ordre : chaque chapitre s'appuie sur les précédents.

---

## Chapitre 0 — La carte du territoire (à relire quand tu es perdu)

**Théorie.** Un *monorepo* regroupe plusieurs applications et bibliothèques dans un seul dépôt Git, avec un outil (ici **Nx**) qui sait quel projet dépend de quel autre. Avantage : un changement dans une lib partagée est vu par tous ses consommateurs *dans la même PR* ; inconvénient : il faut de la discipline (alias, frontières).

**Pratique Yamba.** `apps/` = ce qui s'exécute (user-ui Next.js, api-gateway, auth/trip/deal/notification-service Express) ; `packages/` = ce qui est partagé (`api-contracts` Zod, `pricing`, `prisma`, `messaging`, `middleware`). Un import `@packages/pricing` est résolu par **`tsconfig.base.json` → `paths`** : ce n'est pas un paquet npm, c'est un chemin. Piège vu en PR-C : `apps/user-ui/tsconfig.json` **redéfinit `paths`** et perd donc ceux de la base — il faut ajouter l'alias aux deux endroits (et le fichier à `include`).

**Pour aller plus loin.** Lis `nx graph` (`npx nx graph`) : tu verras pourquoi modifier `api-contracts` relance les tests de trois services.

---

## Chapitre 1 — PR #78 · Un chemin relatif n'est relatif qu'à *quelque chose*

**Théorie.** En Node, `path.resolve("./x")` résout depuis `process.cwd()` — le dossier où le **processus** a été lancé, pas le dossier du fichier. `__dirname`, lui, est toujours le dossier du fichier courant.

**Pratique.** `apps/user-ui/next.config.js` passait `./src/i18n/request.ts` à next-intl. Lancé par Next depuis `apps/user-ui`, ça marche ; évalué par le plugin Nx depuis la racine, ça casse — et Turbopack refuse un chemin absolu. Solution : `"./" + path.relative(process.cwd(), path.join(__dirname, "src/i18n/request.ts"))` — on **calcule** un relatif correct quel que soit le cwd.

**Ce que tu retiens.** Quand un outil dit « fichier introuvable » alors que le fichier existe : demande-toi *depuis où* il cherche.

---

## Chapitre 2 — PR #80 · React 19, le rendu client et les layouts Next

**Théorie.** Dans l'App Router de Next, chaque segment d'URL (`[locale]`, `trips`, `[tripId]`) peut avoir un `layout.tsx`. Quand un segment **change** (FR → EN), son layout est **remonté** côté client ; le layout racine (`app/layout.tsx`), lui, ne bouge jamais. React 19 refuse d'exécuter un `<script>` créé pendant un rendu client (sécurité et prévisibilité) et prévient.

**Pratique.** `next-themes` injecte un `<script>` anti-flash. Placé dans le layout `[locale]`, il était recréé à chaque bascule de langue → erreur console. Déplacé dans le layout racine → plus jamais remonté. Règle dérivée : *les providers indépendants de la langue vivent au-dessus de `[locale]`*.

**Pour aller plus loin.** Distingue *hydratation* (React relie le HTML serveur au DOM une fois) et *rendu client* (React crée des nœuds après coup) : le warning ne concerne que le second.

---

## Chapitre 3 — PR #81 · Pré-rendu statique et `Suspense`

**Théorie.** `next build` pré-rend en HTML toutes les pages qui n'ont pas besoin de la requête. `useSearchParams()` a besoin de l'URL réelle → impossible au build. Next exige alors une **frontière `<Suspense>`** : la partie statique est servie tout de suite, la partie dynamique arrive après. Sans frontière, le build échoue… et la CI qui ne fait que `tsc` ne le voit pas.

**Pratique.** 4 pages (`refresh`, `carrier/onboarding`, `stripe/callback`, `trips/create`) enveloppées : `<Suspense fallback={null}><RefreshGate /></Suspense>`. Le fallback ne s'affiche qu'au pré-rendu.

**Ce que tu retiens.** *La CI doit construire ce qu'elle déploie.* `tsc` prouve les types, pas le déploiement.

---

## Chapitre 4 — PR #82 (PR-B) · Le modèle de données côté formulaire : le `Draft`

**Théorie.** Un formulaire complexe est un **état** (objet) + des **transitions** pures (`setDraft(prev => ({...prev, x}))`). Toujours passer par `prev` (mise à jour fonctionnelle) : deux saisies rapides ne s'écrasent pas. Les champs numériques d'un `<input>` renvoient `""` quand ils sont vides — on le garde tel quel (`number | ""`) pour ne pas afficher « 0 ».

**Pratique.** `create-trip.types.ts` → `Draft` gagne `pricePerKg`, `capacityKg`, `familyConditions: Record<ParcelFamily, {mode, surchargePct}>`. Un `Record` (objet indexé) plutôt qu'un tableau : lecture/écriture d'une famille en O(1). Les **euros** vivent dans le Draft, les **cents** dans le payload : la conversion n'existe qu'au mapper (`Math.round(x * 100)`).

**Pièges.** `Math.round` sur des euros × 100 évite `0.1 + 0.2 ≠ 0.3` ; ne jamais faire d'arithmétique monétaire en flottant côté serveur (règle non négociable : cents `Int`).

**Pour aller plus loin.** Les *types utilitaires* TypeScript : `Record<K, V>`, `Partial<T>`, `Pick<T, K>` (`suggestPricePerKg(draft: Pick<Draft, "transportMode" | ...>)` = la fonction déclare *exactement* ce dont elle a besoin → testable sans construire un Draft entier).

---

## Chapitre 5 — PR #82 · Fonctions pures et tests : le gate de publication

**Théorie.** Une fonction **pure** ne dépend que de ses arguments et n'a aucun effet de bord. Elle se teste sans base, sans mock, en une ligne. La logique métier critique (prix, règles, transitions d'état) doit être pure ; les controllers ne font que l'appeler.

**Pratique.** `apps/trip-service/src/services/pricing-gate.ts` : `resolvePricingEngine`, `checkBagCapacity`, `pickPerKgFields` — trois fonctions pures, 15 specs Jest. Le controller (`createTrip`, `updateTrip`, `publishTrip`) les appelle sur ses trois chemins. Leçon payée : `POST /trips` **listait ses champs à la main** et avait oublié les 5 champs PER_KG (trajet publié à 0 €) → un helper pur `pickPerKgFields(data)` « étalé » (`...`) dans l'écriture, testé.

**Jest en 5 lignes.** `describe("…", () => { it("cas", () => { expect(f(x)).toBe(y); }); });` — un `it` = un comportement, nommé en français métier (« PER_KG complet SANS catégorie → aucune issue »). Lance `npx nx test trip-service -- --testPathPatterns=pricing-gate`.

**Pour aller plus loin.** Le pattern *table de vérité* : quand une fonction combine 2–3 booléens, écris un test par ligne de la table.

---

## Chapitre 6 — PR #82 · Zod : un schéma qui valide ET documente

**Théorie.** Zod décrit une forme de données (`z.object({...})`) et sait **valider** à l'exécution (`safeParse`) **et** produire des types TypeScript (`z.infer`) **et**, chez nous, l'OpenAPI. Une seule source pour trois usages.

**Pratique.** `trip.schema.ts` : `superRefine((data, ctx) => …)` ajoute des règles inter-champs (« si `publish`, alors… »). PR-B y a mis : *catégories exigées seulement si le moteur effectif est legacy* et *forfait bagage ⇒ capacité suffisante*. Les tests visent `result.error.issues` filtrées par `path` plutôt que `success` global : un test ne doit dépendre que de **sa** règle.

**Pièges.** `.optional()` vs `.nullish()` (accepte aussi `null`) ; `z.coerce.number()` pour une query string.

---

## Chapitre 7 — PR #82 · Prisma sur MongoDB : les pièges qui coûtent une journée

**Théorie.** Prisma génère un client typé à partir de `schema.prisma`. Sur Mongo, pas de migrations : `prisma db push`. Les **types composites** (`type TripFamilyCondition {…}` embarqué dans `Trip`) sont des sous-documents.

**Pratique et pièges (tous vécus).**
- Un `update` avec des composites devient un **pipeline d'agrégation** avec une étape `$set` **par champ** ; Atlas en tier partagé refuse > 50 étapes (`P2010`). Solution : `chunkUpdateData()` (`lib/mongo-update-chunks.ts`) écrit par paquets ≤ 40, les champs de **transition** (`status`, `publishedAt`) en dernier.
- Prisma/Mongo ne compare pas deux champs entre eux dans un `where` → on filtre sur `capacityKg ≥ poids` (approximation) et on vérifie l'exact ailleurs.
- `readAt: null` rate les champs absents → `OR: [{readAt: null}, {readAt: {isSet: false}}]` (CLAUDE.md).

**Pour aller plus loin.** Lis le SQL/Mongo généré avec `DEBUG=prisma:query` : tu comprendras pourquoi « une ligne de Prisma » peut coûter cher.

---

## Chapitre 8 — PR #82 · UI : accordéons non montés, popovers en portal, mémoïsation

**Théorie.** React re-rend un composant quand ses props ou son état changent. Trois outils pour rester fluide : ne pas **monter** ce qui est fermé (`open && children`), `React.memo` + callbacks **stables** (`useCallback`/`useMemo`) pour que 8 lignes ne se re-rendent pas à chaque frappe, et `createPortal` pour sortir un popover du flux (un `overflow: hidden` parent ne peut plus le rogner).

**Pratique.** `TripPricingUi.tsx` : `Accordion` (contenu non monté), `FamilyConditionRow = memo(...)` avec un handler par famille créé une fois, `InfoHint` rendu dans `document.body` en `position: fixed`, borné aux bords de l'écran, fermé au scroll/Échap/tap dehors.

**Mobile.** Cibles ≥ 44 px, `touch-pan-x` sur les curseurs, `inputMode="decimal"` (clavier numérique), jamais de hover-only.

**Pour aller plus loin.** Le React Profiler (DevTools) : mesure avant d'optimiser ; `memo` sur tout est une erreur classique.

---

## Chapitre 9 — PR #82 · Tailwind, thème et charte

**Théorie.** Tailwind génère uniquement les classes qu'il **voit** dans le code : `w-${n}` dynamique ne produit rien → chaînes littérales. Le dark mode « class » applique `dark:` quand `<html class="dark">`.

**Pratique.** Jauge « prix juste » : trois `div` absolus avec `bg-[#0F766E]/10 dark:bg-[#0F766E]/35` — alphas plus forts en dark (les zones étaient invisibles). Charte : mango = actif/avancer, teal = accepter/argent, slate = neutre/refus ; les couleurs du mockup (rouge/ambre) **ne sont pas** reprises : le mockup fixe la structure, la charte les couleurs.

**Piège.** `space-y-3` + enfant masqué par la classe `hidden` = marge fantôme sur le suivant (le sélecteur Tailwind ignore `[hidden]` l'attribut, pas la classe).

---

## Chapitre 10 — PR #83 · Dénormaliser pour trier : `comparablePriceCents`

**Théorie.** Une base trie vite sur un **champ indexé**, jamais sur une formule. Quand un tri dépend d'un calcul (`max(2 × €/kg, 800)`), on **dénormalise** : on stocke le résultat, recalculé à chaque écriture, et un **backfill** l'initialise pour l'existant.

**Pratique.** `lib/comparable-price.ts` (pur, 5 specs) ; recalcul dans `computeDenormalizedFields` (create/update) ; `scripts/backfill-comparable-price.ts` idempotent. Quand le calcul dépend d'une entrée utilisateur (le poids), plus d'index possible → tri **en mémoire** sur une fenêtre bornée (200) avec un curseur-offset `o:<n>` : compromis assumé et documenté.

**Ce que tu retiens.** Toute dénormalisation a deux obligations : *qui la recalcule* et *comment on rattrape l'existant*.

---

## Chapitre 11 — PR #83 · Filtres, facettes et « ce qu'on compte, on doit pouvoir l'afficher »

**Théorie.** Une facette = un compteur par valeur de filtre. Elle se calcule sur la base **sans** le filtre qu'elle représente, sinon chaque chip se compte elle-même.

**Pratique.** `familyCounts` : 8 `count` en parallèle (`Promise.all`) sur `baseWhereNoFamily` ; filtre `familyConditions: { none: { familyKey, mode: "REFUSE" } }` en AND par famille. Bug trouvé : les facettes comptaient 5, la liste affichait 4 — le mapper **rejetait** un trajet sans `arrivalAt`. Un mapper de lecture ne doit jamais jeter ce que la requête a compté.

---

## Chapitre 12 — PR #83 · CSS `position: sticky` vs JavaScript

**Théorie.** `sticky` est géré par le moteur de rendu : zéro JavaScript, zéro retard. Conditions : un parent `display: grid/flex` avec `align-items: start`, et **aucun ancêtre en `overflow: hidden`** (clip). Un hook JS qui mesure au scroll et bascule deux copies sera toujours en retard d'une frame.

**Pratique.** Sidebar de recherche : hook supprimé, `<aside className="md:sticky" style={{ top, maxHeight }}>`, scroll interne sans barre visible (`scrollbar-width: none`).

---

## Chapitre 13 — PR #85 (PR-C) · Une bibliothèque partagée front/serveur : `@packages/pricing`

**Théorie.** Si deux implémentations d'une même règle existent (front pour l'affichage, serveur pour la vérité), elles divergeront. Une **lib pure** importée des deux côtés supprime la classe de bug. Elle doit être sans dépendance (pas de React, pas de Prisma) et travailler en **cents entiers**.

**Pratique.** `packages/libs/pricing/src/index.ts` : `quoteShipperPrice(input, params)` renvoie un `ShipperQuote` dont chaque champ est conçu pour être figé tel quel dans le snapshot du Booking (D17). Erreurs **typées** (`class QuoteError extends Error { code }`) : le front traduit `code` en message, le serveur en 400. Tests dans deal-service (c'est lui qui figera). Alias ajouté dans `tsconfig.base.json` **et** `apps/user-ui/tsconfig.json` (+ `include`).

**Pour aller plus loin.** *Discriminated unions* : `pricingModel: "PER_KG" | "FLAT_BAG"` permet à TypeScript de savoir quels champs existent selon le cas.

---

## Chapitre 14 — PR #85 · Normaliser une donnée utilisateur : le téléphone E.164

**Théorie.** Une donnée saisie a mille formes (« 06 42… », « +33 6… », « 0033… ») ; le système n'en stocke qu'**une** (E.164 : `+` + indicatif + numéro national sans le 0). Normaliser **avant** valider : la validation porte sur la forme canonique.

**Pratique.** `toE164(prefix, national)` dans `booking.config.ts` : retire tout sauf les chiffres, tolère `00` et l'indicatif retapé, enlève le zéro national, valide `^\+[1-9]\d{6,14}$`. Testé à la main sur 6 cas avant commit.

---

## Chapitre 15 — Git au quotidien (tout ce qui a servi le 28/08)

- **Branche par PR**, base `dev` protégée : `feat/*`, `chore/*` ; jamais de commit direct sur `dev`.
- **Rebase** pour intégrer `dev` dans ta branche (`git rebase origin/dev`) : historique linéaire, cherry-picks dupliqués sautés automatiquement (« skipped previously applied commit »).
- **Cherry-pick** pour prendre un commit précis d'une autre branche (`git cherry-pick <sha>` — sans `-q`, l'option n'existe pas).
- **`git cherry origin/dev <branche>`** : compare **par contenu**, pas par SHA — indispensable après une réécriture d'historique.
- **Stratégies de merge** : `-X ours` ne protège que les *conflits* ; `-s ours` garde **tout l'arbre** courant (utilisé pour la release : `main` n'apportait rien).
- **`filter-branch`** réécrit l'historique (emails, trailers) : toujours une branche de sauvegarde, vérifier « diff de contenu = 0 », force-push avec `--force-with-lease` seulement.
- **`git stash push -u -- <chemins>`** : sans `-u`, les fichiers non suivis restent.

---

## Chapitre 16 — Méthode (ce qui a le plus fait gagner de temps)

1. **Inventaire avant le code** : `grep` tous les endroits qui écrivent/lisent la donnée (les 3 chemins de publication, le mapper de lecture, les facettes). La moitié des bugs du 28/08 étaient « un endroit oublié ».
2. **Décision au registre avant le code** (D31–D36) : une phrase de pourquoi vaut une heure de relecture.
3. **Prouver avec des chiffres** : `curl -w "%{time_total}"`, un build prod, `git diff --stat` = zéro, un test qui échoue avant le fix.
4. **Une règle qu'on ne dit pas à l'écran est une surprise à la réservation** (D32 était appliquée mais invisible).
