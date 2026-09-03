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


---

## Chapitre 17 — B2-PR1 · L'interface avant l'implémentation (`PaymentProvider`)

**Théorie.** Une *interface* TypeScript décrit un contrat (« quiconque me donne `authorize`, `retrieve`, `capture`, `cancel`, `refund` me convient ») sans dire comment. Le code métier dépend du contrat, pas de Stripe : c'est l'**inversion de dépendance** (le D de SOLID). Bénéfices concrets : on remplace Stripe par Mobile Money sans toucher au deal-service, et on **teste** avec une implémentation mémoire.

**Pratique.** `packages/libs/payments/src/index.ts` : `interface PaymentProvider`, `StripePaymentProvider`, `FakePaymentProvider`, et une **factory** `createPaymentProviderFromEnv()` qui choisit selon l'environnement — et **refuse** le Fake en production (`throw` au boot : mieux vaut un serveur qui ne démarre pas qu'un serveur qui simule les paiements). Le service reçoit le provider par **injection** : `makeDealRequestService(provider)` ; les routes l'assemblent une fois.

**Statuts normalisés.** Stripe a 7 statuts ; notre contrat en expose 6 génériques (`AUTHORIZED` = `requires_capture`). Traduire à la frontière (`mapStripeStatus`) évite que le vocabulaire d'un fournisseur contamine le métier.

**Pour aller plus loin.** Lis « Ports & Adapters » (architecture hexagonale) : l'interface est le *port*, Stripe et Fake sont deux *adapters*.

---

## Chapitre 18 — B2-PR1 · Transactions MongoDB avec Prisma : « tout ou rien »

**Théorie.** Une transaction garantit que plusieurs écritures réussissent **ensemble** ou pas du tout (atomicité). MongoDB l'offre sur un *replica set* (Atlas en a un). Avec Prisma : `prisma.$transaction(async (tx) => { … })` — toutes les écritures passent par `tx`, une exception annule tout (**rollback**).

**Pratique.** `deal-request.service.ts` : dans la transaction, (a) `tx.trip.updateMany` avec la **condition dans le `where`** (`reservedKg ≤ capacité − kg`) — c'est la réservation **atomique** : si un concurrent a pris la place, `count === 0` et on lève `CAPACITY_EXCEEDED` ; (b) `tx.booking.create` ; (c) deux `tx.outboxEvent.create`. Si (c) échoue, (a) et (b) sont annulés : **jamais de deal sans événement**.

**Le pattern « compare-and-set »**. On ne lit pas puis on écrit (deux Expéditeurs liraient la même valeur) ; on écrit *à condition que* — la base arbitre. Même idée que `RelayLease` (A24) et que `SETNX` Redis (D5).

**Pièges.** Une transaction longue bloque ; ne jamais appeler Stripe *dedans* (réseau lent, non annulable). D'où l'ordre : vérifier l'autorisation **avant**, écrire **ensuite**, libérer l'empreinte **après** en cas d'échec.

---

## Chapitre 19 — B2-PR1 · Les erreurs typées traversent les couches

**Théorie.** Une erreur est une valeur comme une autre : elle porte un **code** stable (`QUOTE_DIVERGENCE`) et des **données** (`actualTotalCents`). Le message texte est pour les humains ; le code est pour le programme (le front traduit, teste, réagit).

**Pratique.** Serveur : `class BookingRequestError extends AppError` avec `details = { type: "booking", code, … }` ; le middleware n'expose `details` en production que pour les types « sûrs » — on ajoute `"booking"` à la liste (sans ça, le front ne recevrait qu'un message anglais). Front : `BookingApiError` reconstruit `code` depuis `response.data.details`, et `useBookingCheckout` fait `t(`step4.errors.${code}`)` avec repli `GENERIC`. Les tests unitaires vérifient **le code**, pas la phrase.

**Ce que tu retiens.** Un `catch {}` muet perd l'information ; un `catch` qui reconnaît `e instanceof BookingApiError && e.code === "QUOTE_DIVERGENCE"` peut agir (ici : recréer l'autorisation).

---

## Chapitre 20 — B2-PR1 · Idempotence et concurrence : penser au « deuxième clic »

**Théorie.** Sur le réseau, tout peut être rejoué : double-clic, retry du navigateur, onglet dupliqué. Une opération est **idempotente** si la rejouer ne change rien de plus. Côté argent, c'est vital.

**Pratique.** (1) `POST /deals` rejoué avec le même `paymentIntentId` → `PAYMENT_ALREADY_USED` (vérifié **dans** la transaction, avant l'écriture). (2) L'intent porte des `metadata` (`tripId`, `shipperId`, `totalShipperCents`) : le serveur refuse une autorisation « recyclée » pour un autre trajet. (3) Le hook front garde `isSubmitting` et ignore les clics pendant l'envoi. Le smoke test a rejoué la requête : 409, `reservedKg` inchangé.

**Pour aller plus loin.** Stripe accepte un `Idempotency-Key` sur `create` : notre interface le prévoit (`idempotencyKey`), à brancher quand le front saura fournir une clé stable par tentative.

---

## Chapitre 21 — B2-PR1 · React : sortir la logique d'un hook partagé

**Théorie.** Deux arbres UI (desktop/mobile) qui dupliquent la même logique de soumission divergeront. Un **hook personnalisé** (`useXxx`) encapsule état + effets + callbacks et se réutilise partout. Un `useRef` garde une valeur **sans** re-rendu (idéal pour une fonction à appeler plus tard) ; `useCallback` stabilise les fonctions passées en props.

**Pratique.** `useBookingCheckout({ draft, trip, step, clear })` : crée l'intent en arrivant à l'étape 4 (`useEffect` sur `step`), expose `registerConfirm(fn)` (le Payment Element, rendu **dans** `<Elements>`, enregistre sa fonction `stripe.confirmPayment` dans un `ref`), et `submit()` qui enchaîne confirmation → `POST /deals` → redirection. `BookingWizard` et `BookingMobile` sont passés de 20 lignes de `handleSubmit` chacun à `const handleSubmit = checkout.submit`.

**Pourquoi `key={intent.paymentIntentId}` sur `<Elements>`** : un `clientSecret` ne peut pas changer sur une instance existante ; changer la `key` force React à **remonter** le composant proprement.

**Pièges.** `dynamic(() => import(...), { ssr: false })` pour Stripe : la lib touche `window` ; et le chargement paresseux garde l'étape 1 légère.

---

## Chapitre 22 — B2-PR1 · Prouver avec un smoke test réel

**Théorie.** Les tests unitaires prouvent la logique ; ils ne prouvent ni le câblage (gateway → service → Mongo → Stripe) ni les contrats réels. Un **smoke test** scripté joue le parcours réel sur l'environnement de dev et vérifie l'état final en base.

**Pratique.** Script `tsx` (non versionné) : login seed via le gateway (cookies — attention : le login pose `access_token` deux fois, il faut garder la **dernière** valeur), `POST /deals/payment-intents` avec un total faux (prouve la divergence), confirmation de l'intent avec `pm_card_visa` (ce que ferait le Payment Element), `POST /deals`, rejeu, puis lecture Prisma de `reservedKg`, du snapshot, de l'outbox. Et le **nettoyage** : annuler l'intent, supprimer le booking et ses événements, restituer les kg — un test qui salit la base est une dette.

**Ce que tu retiens.** Écris le scénario *négatif* d'abord (401, 409…) : c'est lui qui valide les garde-fous ; le chemin heureux ne teste que le câblage.

---

## Chapitre 23 — B2-PR2 · « L'argent d'abord, la base ensuite » : ordonner les effets externes

**Théorie.** Quand une opération touche DEUX systèmes (Stripe et Mongo) qui ne partagent pas de transaction, il faut choisir un ordre et assumer sa fenêtre d'échec. Règle retenue (D39) : agir d'abord sur le système **qui a l'argent**, puis écrire chez soi ; prévoir une **compensation** (action inverse best-effort) si la seconde étape échoue, et un **réconciliateur** (le webhook) pour les cas où même la compensation rate. C'est le début du monde des *sagas* — sans le framework.

**Pratique.** `deal-lifecycle.service.ts` : `accept` fait `provider.capture()` PUIS la transaction (`PENDING→ACCEPTED`) ; si la transaction perd (course rarissime), `provider.refund()` en compensation dans le `catch`, et on relance l'erreur. `cancel` d'un deal ACCEPTED fait le `refund` d'abord — s'il échoue, **aucune** écriture : 409 `PAYMENT_STATE_CONFLICT`, l'utilisateur réessaie. À l'inverse, le `cancel` d'une simple empreinte (decline/expire) est *best-effort* (`catch` silencieux) : elle expirerait seule, le webhook réconcilie.

**Ce que tu retiens.** Il n'y a pas d'ordre « parfait » : il y a un ordre choisi, documenté, avec sa compensation et son filet. Le pire est l'ordre implicite.

---

## Chapitre 24 — B2-PR2 · La machine à états comme SEULE autorité (et son extension contrôlée)

**Théorie.** Quand chaque endpoint décide lui-même « ai-je le droit ? », les règles divergent vite. Ici, TOUT passe par `canPerform(booking, action, acteur)` : le controller ne connaît ni les statuts ni les guards — il transmet le refus de la machine (409 avec SA raison). Ajouter un comportement = ajouter une **transition déclarée** (données), jamais un `if` dans un controller.

**Pratique.** Le webhook D40 a exigé une transition qui n'existait pas : `PENDING —cancel/SYSTEM→ CANCELLED` (l'empreinte meurt seule). On ne l'a PAS codée dans le handler : on l'a **gravée au registre (D40)**, ajoutée à la table `TRANSITIONS` avec ses effets (`RELEASE_CAPACITY`, `NOTIFY_SHIPPER` — pas de refund : rien n'a été capturé), répercutée dans la spec §2.2 et testée (S1/S5 : 196 tests). L'effet `CAPTURE_PAYMENT` sur accept suit la même idée : la machine DÉCLARE les effets, le service les EXÉCUTE (`effects.includes("REFUND_PER_CANCELLATION_POLICY")` pilote le barème).

**Ce que tu retiens.** Une machine à états ne vaut que si elle est le passage obligé. Le jour où une règle te tente « juste ici, dans le controller », c'est une transition qui manque.

---

## Chapitre 25 — B2-PR2 · Webhooks signés : le corps brut ou rien

**Théorie.** Un webhook est un endpoint PUBLIC : n'importe qui peut le POSTer. La seule preuve d'origine est la **signature HMAC** calculée par Stripe sur les octets exacts du corps. Or Express, avec `express.json()`, parse puis (si on re-sérialise) réordonne/reformate : les octets changent, la signature meurt. Il faut donc capter le corps **brut** (`express.raw`) AVANT tout parseur.

**Pratique.** `main.ts` : `app.post("/webhooks/stripe", express.raw({ type: "application/json" }), handler)` monté AVANT `app.use(express.json())`. En dev : `stripe listen --forward-to localhost:6003/webhooks/stripe` — DIRECT sur le service, jamais via le gateway (qui parse). La vérification vit dans `@packages/payments` (`constructStripeWebhookEvent`) : le SDK Stripe reste isolé dans la lib, comme kafkajs dans `@packages/messaging`. Codes de réponse choisis : 501 sans secret (refuser plutôt qu'accepter sans preuve), 400 signature invalide (retry inutile), **500 si la base échoue — exprès : Stripe réessaie**, c'est le filet.

**Ce que tu retiens.** Un webhook idempotent + des retries fournisseur = la réconciliation gratuite. Un webhook qui répond 200 avant d'avoir réussi = une perte silencieuse.

---

## Chapitre 26 — B2-PR2 · Tester les effets, pas les appels : le Fake avec un état

**Théorie.** Un `jest.fn()` vérifie qu'on a APPELÉ ; un **fake à état** (une vraie petite implémentation en mémoire) vérifie l'EFFET : après `accept`, l'intent EST `CAPTURED` ; après `decline`, il EST `CANCELED`. Les tests deviennent des scénarios lisibles, et le fake sert aussi en dev (D30 : « Stripe remplacé par un fake »).

**Pratique.** `deal-lifecycle.service.spec.ts` : le VRAI `FakePaymentProvider` porte l'argent (`expect((await provider.retrieve(intentId)).status).toBe("CAPTURED")`) ; Prisma est un mock virtuel dont `$transaction` exécute le callback avec le même objet — et `updateMany.mockResolvedValue({ count: 0 })` **simule une course perdue** en une ligne (on vérifie alors la compensation : `refund` appelé). Le gate D31 se teste avec un stub `name: "STRIPE"` puisque le Fake le saute par design. Et le contrat outbox est RÉEL : chaque événement passe `BookingDomainEventSchema.parse` dans le chemin testé — un payload invalide casse le test, c'est voulu.

**Ce que tu retiens.** Choisis le niveau de doublure par ce que tu veux prouver : l'état (fake), l'appel (spy), la course (retour piloté). Et garde toujours UN chemin où le contrat de prod s'exécute vraiment.

---

## Chapitre 27 — B2-PR2 · Un cron n'est pas une horloge de vérité

**Théorie.** Si l'expiration n'existait QUE dans le cron, une demande périmée resterait acceptable pendant 5 minutes (voire pendant une panne du cron). La vérité doit être dans la **donnée** (`expiresAt`) et vérifiée à CHAQUE décision ; le cron ne fait que **matérialiser** l'état (statut, argent, place) après coup.

**Pratique.** Le guard `notExpired` de la machine refuse déjà l'accept d'un PENDING périmé — testé « avant même le passage du cron ». Le cron (`expire-bookings.cron.ts`, node-cron `*/5 * * * *`) traite des fournées de 50 avec un booléen anti-chevauchement (un tick qui déborde saute le suivant), chaque booking isolément (`try/catch` par item : une course perdue n'arrête pas la fournée), et s'éteint par env (`BOOKING_EXPIRY_CRON_ENABLED=false`) pour les instances API pures — même patron que le relay outbox.

**Ce que tu retiens.** Demande-toi toujours : « si mon cron meurt une heure, qu'est-ce qui devient FAUX ? ». La bonne réponse : rien — juste du retard.

## Chapitre 28 — B2-PR3 · L'adapter comme frontière : brancher du réel sous une UI née mock
Quand une UI naît sur des mocks, ses types dérivent (enum réinventée, champs rêvés). Le branchement réel n'est PAS « remplacer l'URL » : c'est réconcilier deux vocabulaires. La technique : un **adapter pur** (`deal.adapter.ts`, miroir de `shipments.adapter.ts`) qui définit une *whitelist de lecture* structurelle (`CarrierBookingViewDto` — seuls les champs lus) et traduit vers le view-model. Les champs que le réel ne fournit pas deviennent **optionnels et documentés** (stats du profil → B5), ceux qu'il ne DOIT pas fournir disparaissent de l'UI (commission — A13). Piège évité : importer `@packages/api-contracts` dans user-ui aurait exigé un alias tsconfig (le tsconfig de l'app redéfinit `paths`) — le miroir structurel local suit la convention du module voisin et casse au premier appel réel si le contrat bouge.

## Chapitre 29 — B2-PR3 · `allowedActions` : l'UI pilotée par la machine, pas par le statut
Un `switch (status)` au front finit toujours par mentir (une demande expirée est encore « PENDING » en base jusqu'au cron). Le serveur expose `allowedActions` — la liste exacte des transitions permises À CE lecteur, MAINTENANT. Le front teste `allowedActions.includes("cancel")`, jamais `status === "PENDING"`. Corollaire côté serveur : tout ce qui accompagne une action doit suivre la même condition — la préviz d'annulation (`cancellationPreview`) est non nulle *exactement* quand `cancel` est permis, et le test du mapper vérifie cette équivalence.

## Chapitre 30 — B2-PR3 · Après une mutation : invalider, jamais muter
L'ancien code faisait `setDeal({...deal, status: "ACCEPTED"})` après l'appel — une vérité locale, fausse à la première course. Avec TanStack Query : la mutation réussit → `invalidateQueries(["deal", id])` → la page re-render depuis le SERVEUR. Même discipline sur les erreurs 409 : `TRANSITION_NOT_ALLOWED` ne se « gère » pas, il s'affiche et on RELIT (le serveur a déjà la bonne réponse). Le hook partagé `useDealRequestActions` centralise ce mapping pour les deux mises en page (desktop/mobile) — la logique n'existe qu'une fois.

## Chapitre 31 — B2-PR3 · Un Fake persistable : faire jouer les seeds sans casser les tests
Le `FakePaymentProvider` vit en mémoire ; les bookings seedés portent des intents que l'instance n'a jamais vus → tout accept seedé finissait en conflit. Ni « tolérer tous les ids » (les tests de conflit comptent sur l'erreur), ni « seeder la mémoire » (autre process). La solution : une **convention de nommage comme contrat** — seuls les ids `pi_fake_seed_*` sont adoptés (matérialisés AUTHORIZED à la première lecture), tout autre id inconnu jette toujours. Le préfixe encode l'intention ; les deux mondes (tests stricts, dev jouable) coexistent sans flag.

## Chapitre 32 — B2-PR3 · Diagnostiquer un toast générique : remonter la chaîne par les FAITS (A34)
Un « une erreur est survenue » n'est pas un point de départ, c'est un écran de fumée. La méthode qui a marché (premier paiement Stripe réel, 01/09) : (1) **chercher les traces d'écriture** — aucun booking, aucun outbox → l'échec est AVANT toute transaction ; (2) **interroger le fournisseur** — les PaymentIntents du jour sont `requires_capture` → la carte, elle, a réussi ; et ils ne sont PAS annulés → le chemin `CAPACITY_EXCEEDED` (qui annule) est exclu ; (3) **rejouer le parcours en script** (login seed → intent → `confirm` avec `pm_card_visa` + `return_url` → `POST /deals`) pour voir la réponse brute que le front avale. Verdict : deux contrats qui divergent du wizard (email exigé, description min 10 vs 5) → 400 Zod sans `details.code` → toast générique. **Leçons** : un code d'erreur non whitelisté doit tout de même être LOGGÉ côté front ; et chaque règle de validation doit exister à UN endroit ou être testée des deux côtés — ici le contrat gagne des tests qui verrouillent les seuils du wizard.

## Chapitre 33 — B2-PR3 · Quand Prisma ne peut PAS te défendre : le champ absent en Mongo (A34)
Ajout d'un champ `Int @default(0)` au schéma ≠ ajout du champ dans les documents EXISTANTS : Prisma n'applique le défaut qu'à la lecture/création. Dans un FILTRE, `reservedKg: { lte: X }` ne matche pas un document sans le champ → la réservation atomique refusait des trajets vides (faux `CAPACITY_EXCEEDED`). Trois défenses tentées, deux mortes prouvées par l'expérience : `isSet: false` → refusé par Prisma sur un champ NON-nullable (500 de validation) ; `NOT: { gt: X }` → ne matche pas non plus les champs absents (testé sur un document inséré brut, hors de tout a priori sur `$not`). La seule vraie solution est un **état de données garanti** : un backfill idempotent (`$runCommandRaw` + `$exists: false`), versionné dans `scripts/` à côté des seeds, documenté comme À REJOUER par environnement. **Ce que tu retiens** : quand l'outil ne peut pas exprimer la garde, ne la simule pas à moitié — garantis l'invariant sur les DONNÉES et documente-le là où le prochain dev tombera dessus (le helper `capacityReservationWhere` porte le commentaire).

## Chapitre 34 — B2-PR4 · Une lib partagée naît au DEUXIÈME clone évité, pas au premier écrit
La tentation permanente : extraire une lib « au cas où » (trop tôt : l'abstraction devine), ou copier-coller une troisième fois (trop tard : trois versions divergent). La règle appliquée ici, gravée dès le handoff PR-A : auth-service et trip-service portent chacun leur `sendMail` — on ne les touche pas, mais **le 3e usage n'a pas le droit de cloner**. `@packages/email` naît donc avec le chantier qui en a besoin, en copiant LE MEILLEUR des deux clones (gestion 465/587 de trip-service, pas le `catch → console.log` d'auth-service qui avale les erreurs), plus deux améliorations que l'usage impose : transport **paresseux** (un service qui n'envoie rien ne crée rien ; les tests mockent le module sans réseau) et `templatesDir` en paramètre (la lib transporte, les services possèdent leurs gabarits). La migration des vieux clones devient une dette listée — pas un prérequis.

## Chapitre 35 — B2-PR4 · At-most-once ou at-least-once : choisis TON erreur, puis assume-la en données
Un système de messages ne te donne jamais « exactement une fois » gratuitement : le consumer est at-least-once (un crash = re-livraison = re-traitement). Pour l'in-app, l'upsert `[eventId, userId]` rend le rejeu invisible. Pour un EMAIL, il n'y a pas d'upsert : envoyé, c'est envoyé. Il faut donc choisir quelle erreur tu préfères — renvoyer (at-least-once) ou parfois perdre (at-most-once) — et la réponse est MÉTIER, pas technique : un reçu en double sème le doute, un reçu perdu se rattrape dans l'app → at-most-once (A36). L'implémentation découle du choix : **claim AVANT envoi** (`EmailDelivery` unique `[eventId, userId]`, P2002 = silence), échec d'envoi = FAILED tracé sans throw. Le pattern inverse (marquer APRÈS envoi) aurait donné l'autre garantie. Retiens la symétrie : la position du marqueur PAR RAPPORT à l'effet irréversible EST la sémantique.

## Chapitre 36 — B2-PR4 · Ce que tes mocks ne rendent pas n'est pas prouvé : le test de rendu
Le spec du dispatcher mocke `sendTemplatedEmail` — indispensable (pas de réseau en test), mais du coup AUCUN test n'ouvre les fichiers `.ejs` : une variable renommée, une accolade cassée, et le premier rendu réel explose en production… en FAILED best-effort, donc SILENCIEUSEMENT (le piège du chapitre 35 : l'erreur choisie « perdre un email » cache aussi les bugs). Parade : un spec dédié qui rend RÉELLEMENT les 8 gabarits via `ejs.renderFile`, dans les deux locales, et vérifie trois invariants : les données injectées apparaissent, « undefined » n'apparaît jamais, et les mots interdits (« code de livraison ») non plus. Piège concret rencontré : `<%= %>` échappe le HTML — `n'était` sort `n&#39;était`, l'assertion doit viser une sous-chaîne sans apostrophe. Généralise : chaque frontière mockée mérite UN test qui exécute le vrai artefact (template, requête SQL, règle de conf) même si le transport reste faux.

## Chapitre 37 — B2-PR5 · L'adapter CONSERVATIF : brancher le réel sous 40 vues sans en toucher une
Le chapitre 28 posait l'adapter comme frontière ; ici s'ajoute une contrainte de coût : l'UI mock représente des semaines de travail (48 fichiers) — la réécrire pour « coller au contrat » serait un chantier pour rien. L'adapter devient alors CONSERVATIF : il produit le view-model EXISTANT (`toBooking(): Booking`), et TOUTE la dette de vocabulaire s'absorbe à la frontière — statuts renommés (`PENDING→AWAITING_CARRIER`), états dérivés (É6 = `PICKED_UP` + événements, pas un statut), unités converties (cents→euros), compteurs inversés (`codeRegenerationsLeft` serveur → `regeneratedCount` front). Le type du view-model n'évolue qu'en ADDITIF (champs optionnels nouveaux) : aucun fichier de vue ne change, sauf les deux qui consommaient des données devenues optionnelles. Sans Jest côté front, la preuve est un script `tsx` jetable de 25 assertions — mieux que rien, tracé dans la doc, et le VRAI filet reste tsc : passer `rating` d'obligatoire à optionnel a fait remonter à la compilation les 3 seuls endroits à durcir.

## Chapitre 38 — B2-PR5 · Un écran qui ne sait pas doit le DIRE (jamais faire semblant)
Deux mensonges d'UI tués dans cette PR, un par famille. ① Le fallback de statut : « statut inconnu → vue accepté » était confortable en mock et devient toxique en réel (un deal REFUSÉ affichait « ton Voyageur a accepté »). Remède : une vue d'état NEUTRE par défaut (titre, fait essentiel, sort de l'argent, porte de sortie) — sobre vaut toujours mieux que faux, et un écran d'information n'a pas besoin du double arbre desktop/mobile. ② Les données décoratives : le mock affichait « ⭐ 4.9 · 27 deals » et « Visa •••• 4242 » ; le réel ne les a pas ENCORE (B5, Stripe). La tentation est le placeholder plausible (« ⭐ 0.0 », « •••• ») — c'est une fausse information. La règle : rendre le champ OPTIONNEL, masquer la ligne, documenter QUAND il arrivera (le commentaire du type pointe le chantier). Généralise : à chaque champ d'un mock, demande-toi « qui me le fournira, et quand ? » — la réponse est soit un mapping, soit un champ optionnel documenté, jamais une invention.

## Chapitre 39 — B3-PR1 · Un secret qu'on doit relire : hacher ET chiffrer (D43)
Deux besoins contradictoires sur le même code : le VÉRIFIER (le Voyageur saisit, on compare) et le RÉ-AFFICHER (l'Expéditrice l'a perdu). Un hash bcrypt satisfait le premier et interdit le second ; le clair en base satisfait le second et expose tout dump. La réponse classique est de stocker LES DEUX : `deliveryCodeHash` (bcrypt, lu par un seul chemin : `deliver`) et `deliveryCodeEncrypted` (AES-256-GCM, lu par un seul chemin : la vue Shipper de `GET /deals/:id`). Ce qui rend le chiffré acceptable, c'est la SÉPARATION : la clé vit dans l'environnement (`DELIVERY_CODE_ENCRYPTION_KEY`), pas dans la base — une fuite de l'un sans l'autre ne révèle rien. Détails qui comptent dans `packages/libs/delivery-code/src/index.ts` : GCM (authentifié : un octet altéré → `null`, jamais un faux code), IV aléatoire par chiffrement (deux fois le même code ≠ deux fois le même chiffré), format versionné `v1.` (la rotation de clé ne cassera pas les anciens enregistrements : on saura lequel déchiffrer avec quoi), et un déchiffrement qui ne THROW jamais (un code indéchiffrable = « indisponible » à l'écran, le hash reste valide pour livrer). Miroir D38 : sans clé en production on refuse, hors production on dérive une clé de dev et on le DIT.

## Chapitre 40 — B3-PR1 · Le compteur qui vit sur le serveur, et l'écriture conditionnelle qui le protège (A38)
Le mock comptait les essais côté client (`attemptsSoFar` passé dans l'appel) : fermer l'onglet remettait le compteur à zéro. Règle D4 : toute limite est serveur. Mais un compteur serveur naïf (`lire, +1, écrire`) se trompe sous concurrence : deux saisies simultanées lisent 2, écrivent 3 chacune — un essai gratuit. `deal-transport.service.ts` écrit avec `updateMany({ where: { id, status: "PICKED_UP", deliveryAttempts: <valeur lue> } })` : la deuxième écriture ne matche plus (count 0) → 409 « relis ». C'est le même outil que la transition conditionnelle sur le statut (B2), appliqué à une DONNÉE : `applyBookingTransition` gagne un `where` optionnel pour que chaque writer ajoute SA garde (jalon absent, compteur de régénérations, compteur d'essais). Corollaire de design : au 3e échec, on pose le verrou ET on remet le compteur à zéro — sinon le guard machine (`deliveryAttempts >= 3`) bloquerait à vie après le verrou. Un guard et un compteur doivent être conçus ENSEMBLE.

## Chapitre 41 — B3-PR1 · L'undo n'est pas une fonctionnalité serveur (A39)
La spec demandait un « débounce serveur » pour les 5 secondes d'annulation d'un jalon. Question à se poser avant d'implémenter un état transitoire côté API : que se passe-t-il pour l'AUTRE partie ? Un jalon confirmé notifie l'Expéditrice ; l'annuler ensuite = un second message « finalement non ». Le bon endroit pour l'hésitation est le client : `TrackingSpotlight` marque l'événement, ouvre le toast, et l'appel `POST /deals/:id/events` ne part qu'à la FIN de la fenêtre. Le serveur reste sans état intermédiaire, idempotent (garde `trackingEvents.none({ step })`) et strict (séquence). Coût assumé et documenté : un onglet fermé pendant les 5 s perd la confirmation — d'un jalon optionnel. Quand une exigence de spec crée de la complexité serveur pour un confort client, vérifie d'abord si le client peut la porter seul.

## Chapitre 42 — B3-PR1 · Un alias TypeScript n'est pas un alias webpack (le service qui compile mais ne démarre pas)
`tsc ×6` vert, 354 tests verts, et `nx serve deal-service` : « Module not found: @packages/delivery-code ». Deux résolveurs, deux configurations : tsc lit `paths` de `tsconfig.base.json`, webpack lit `resolve.alias` de `apps/deal-service/webpack.config.js` — et ce dernier liste les alias explicitement (`@packages/payments`, `@packages/pricing`, …) avant un générique `@packages` → `packages/` qui ne connaît pas `packages/libs/`. Leçon en deux temps : (1) tout nouvel alias se déclare aux DEUX endroits (règle ajoutée à CLAUDE.md) ; (2) une preuve « ça compile » n'est pas une preuve « ça démarre » — le smoke test du service fait partie de la Definition of Done, comme pour le build de production (#81). Même famille de piège découverte dans la foulée : `nx serve` charge `.env` et ÉCRASE les variables passées en ligne de commande (impossible de forcer le fournisseur FAKE) ; `node --env-file=.env dist/main.js` laisse au contraire l'environnement du processus gagner — c'est ainsi que l'e2e a tourné.

## Chapitre 43 — B3-PR1 · L'index unique qui interdit le cas nominal (A42, 2e occurrence du piège)
Le seed refusait de créer une page Voyageur : P2002 sur `CarrierPage_primaryAddressId_key`. Diagnostic par les faits (probe Prisma + `listIndexes`) : 4 pages en base, UNE avec `primaryAddressId: null`, et un index unique NON sparse — sur Mongo, `null` est une valeur comme une autre, deux pages sans adresse sont « en doublon ». Conséquence réelle, au-delà du seed : le deuxième vrai Voyageur sans adresse aurait été bloqué à l'onboarding. Prisma ne sait pas déclarer un index partiel et EXIGE `@unique` pour une relation 1-1 ; la sortie est de reformuler la relation (liste déclarative côté `Address`) et de confier l'unicité au code qui crée l'adresse (elle n'est jamais partagée par construction). Règle CLAUDE.md déjà écrite (« Nullable unique fields on Mongo collide on null ») — payée une deuxième fois parce que l'index existait AVANT la règle : quand une leçon est gravée, cherche ses occurrences déjà en place (`grep "String? *@unique" prisma/schema.prisma`).

## Chapitre 44 — B3-PR2 · Débrancher un mock qui DÉCIDAIT : trois patrons (upload d'abord, commit après l'undo, compteur relu)
Un mock qui simule un délai se remplace par un appel ; un mock qui DÉCIDE (le code valide est `742891`, l'essai n° 3 verrouille, l'undo « annule ») se remplace par une inversion de responsabilité. ① `DealPickupClient` : le fichier local devient une URL AVANT l'appel métier — séquentiel, arrêt au premier échec, et l'appel au deal-service n'a lieu que si TOUT est monté (une transition à moitié faite est pire qu'une transition refusée). ② `TrackingSpotlight` : l'état optimiste et l'appel réseau sont deux moments distincts ; le composant expose deux callbacks (`onEventConfirmedAction` au clic, `onEventCommittedAction` à la fin du timer) et le parent ne parle au serveur que dans le second — l'undo n'a plus rien à « annuler ». ③ `DealDeliverClient` : le compteur n'est plus une variable locale incrémentée, c'est une PROJECTION de deux sources serveur (la vue au chargement, les `details` du 409 ensuite) ; le countdown local reste un affichage — à l'expiration on n'incrémente rien, on sait que le serveur a déjà remis à zéro (A38). Règle générale : quand un mock porte une règle, cherche d'abord OÙ la règle vit désormais (serveur), puis fais du composant un simple reflet — `invalidateQueries` après chaque mutation reste le filet qui remet l'écran d'accord avec la base.

## Chapitre 45 — B3-PR3 · Un champ que « tout le monde attend » et que personne ne sert : chercher le producteur avant de consommer
`pendingDemandsCount` était lu par trois composants (liste, accueil, sidebar) avec un `?? 0` rassurant — et n'était écrit NULLE PART côté serveur. Le `?? 0` a masqué le trou pendant des semaines : l'UI affichait « rien à traiter » avec aplomb. Méthode qui l'a révélé : partir de la question produit (« par où le Voyageur atteint-il sa demande ? ») et remonter chaque chemin jusqu'à sa source de données — `grep -rn pendingDemandsCount` dans les services renvoie zéro ligne, verdict immédiat. Remède de conception plutôt que de rustine : ne pas ajouter le champ au trip-service (qui devrait alors lire les bookings de l'autre service), mais exposer la source elle-même (`GET /me/deals`) et DÉRIVER tous les compteurs au front, en un seul hook (`useTripsBadge`) : une donnée, N vues, zéro compteur estimé. Règle à garder : quand un composant lit un champ optionnel avec un défaut, vérifier qu'un producteur existe — un `?? 0` sans producteur est un mensonge poli.

## Chapitre 46 — B3-PR4 · Deux points de rupture ≠ un point de rupture (le CTA invisible sur tablette)
`useIsMobile` bascule à 768 px, la grille desktop à 1024 px : entre les deux, la vue « desktop » s'affiche avec sa colonne d'action `hidden lg:block` — personne ne l'a vu parce que personne ne teste à 900 px. Règle : quand une décision de layout est prise en JS (quelle vue rendre) ET en CSS (quelle colonne montrer), les deux seuils doivent être le MÊME token ; sinon on obtient une zone morte. Corollaire de recette : toujours tester la largeur intermédiaire (768–1023), pas seulement « mobile » et « grand écran ». Deuxième leçon de la même PR : un `photoUrls: []` posé « en attendant » un service qui n'a jamais existé (media-service) est resté quatre PR — un placeholder doit porter une DATE ou un ticket, et le premier écran qui l'affiche doit le faire apparaître (la recette réelle l'a fait, pas les tests).

## Chapitre 47 — fix/auth-recette · Extraire le pur de l'impur pour pouvoir le tester (`otp-policy.ts`, `password-rules.ts`)
`auth.helper.ts` importe le singleton Redis à la première ligne : l'importer dans un test, c'est ouvrir une connexion. Les deux décisions à tester (« que fait-on au n-ième échec ? », « quelle règle ce mot de passe viole-t-il ? ») sont pourtant de la pure arithmétique. Patron : sortir la DÉCISION dans un module sans I/O qui renvoie une valeur (`{ lockSeconds, invalidateOtp, securityAlert, attemptsLeft }`, un `PasswordRuleCode | null`), garder l'EFFET (`redis.set`, `redis.del`, `sendEmail`) dans le helper qui lit cette valeur. Le test décrit le barème ligne à ligne, et une propriété (« jamais 24 h avant le 15e ») protège la décision de recette contre un futur réglage. Bonus : `auth.helper.ts` ré-exporte `validatePasswordStrength`, les contrôleurs n'ont pas bougé — un refactor qui ne touche pas ses appelants est un refactor qu'on peut relire en cinq minutes.

## Chapitre 48 — fix/auth-recette · L'API parle anglais, l'utilisateur lit du français : le code d'erreur est le contrat, pas le message
Le middleware d'erreurs expose `details` pour les types « safe » ; jusqu'ici seul `otp` (et `booking`) l'était et les formulaires OTP affichaient `data.message` — anglais — sur une interface française. Règle : un `message` d'API est pour les logs et Swagger ; ce que voit l'utilisateur vient TOUJOURS d'un `code` stable traduit côté client (`auth-error-codes.ts`). Trois retombées : ① la phrase se pose sur LE bon champ (`setError("password" | "email")`), ② le même code sert le submit local (`firstFailingCheck`) et l'erreur serveur (`passwordCodeMessage`) — une seule table de phrases, ③ ajouter une langue ne touche plus le serveur. Piège : deux listes de règles (front `password-strength.ts`, serveur `password-rules.ts`) doivent rester un miroir exact — l'ordre de vérification aussi, sinon le front et le serveur nomment des critères différents pour le même mot de passe.

## Chapitre 49 — fix/auth-recette · Deux TTL qui se chevauchent mal, et le `mt-1.5` qui décentre un bouton
Deux petites leçons de recette. ① Quand une ressource (le code OTP, 10 min) est renouvelable et qu'une autre (l'inscription en attente, 15 min) ne l'est pas, la seconde finit par mourir AVANT la première : « session expirée » avec un code valide en main. Règle : la ressource englobante doit être prolongée à chaque renouvellement de la ressource englobée (`EXPIRE` au renvoi), et vivre plus longtemps qu'un cycle complet. ② `absolute inset-y-0 my-auto` centre dans le CONTENEUR ; si le champ porte `mt-1.5` à l'intérieur de ce conteneur, le centre du conteneur n'est pas le centre du champ — 3 px trop haut, visibles sur une capture, invisibles dans le code. Règle : une marge appartient au conteneur positionné, ou le bouton compense (`top-1.5 bottom-0`). Et pour l'image cassée du panneau gauche : un tableau de chemins vers `/public` est une PROMESSE — la PR qui ajoute une entrée livre le fichier, sinon un chargement sur cinq affiche du texte alternatif.

## Chapitre 50 — feat/email-locale · Un email est une donnée, pas un fichier HTML (`EmailContent` + gabarit unique)
Sept templates de 100 lignes chacun, copiés-collés, avec une durée en dur : la duplication produisait chaque incohérence de recette. Patron : séparer LE CONTENU (un objet `EmailContent` : titre, salutation, paragraphes, bloc code, encadré, CTA, raison) de LA MISE EN PAGE (un seul gabarit EJS). Deux conséquences techniques : ① le gabarit est une CHAÎNE embarquée dans le bundle (`ejs.render`), plus un fichier lu avec `path.join(process.cwd(), …)` — le code marche identiquement sous nx serve, en `node dist/main.js` et sous jest ; ② une langue = un dictionnaire `Record<SupportedLocale, AuthEmailDictionary>` : TypeScript refuse de compiler si une langue oublie un email, et un test « miroir » le double pour les cas que tsc ne voit pas (clés vides, emoji dans un sujet). Ajouter le portugais demain = un fichier de dictionnaire, zéro HTML.

## Chapitre 51 — feat/email-locale · La locale du DESTINATAIRE, pas de l'acteur (et comment elle voyage)
Erreur classique : rendre l'email dans la langue de la requête qui l'a déclenché. Or c'est le Voyageur (EN) qui accepte, et c'est l'Expéditrice (FR) qui reçoit. Règle : la langue est une propriété du destinataire (`User.preferredLocale`), lue à l'envoi par la même jointure que son email (D41). Pour les flux sans compte, il n'y a pas de destinataire en base : la langue est celle de l'écran, transportée par un en-tête `x-locale` que le client API pose sur CHAQUE requête (intercepteur axios + `apiFetch`) à partir du premier segment d'URL — next-intl impose le préfixe, donc ce segment est fiable, et cela évite de passer la locale à la main dans 40 appels. Dernier maillon : la bascule FR/EN du header enregistre la préférence immédiatement (`PATCH /auth/me/locale`, best-effort) — sinon la donnée existe mais n'est jamais mise à jour, et l'utilisateur ne comprend pas pourquoi ses emails restent en français.

## Chapitre 52 — feat/email-locale · Une liste qui vit à un endroit (et l'alias qui n'embarque pas zod)
`["fr", "en"]` existait dans `routing.ts` (front), en type `"fr" | "en"` dans trois services, et en booléens `fr ? … : …` partout. Une liste unique dans `packages/libs/api-contracts/src/locale.ts`, consommée par next-intl ET par les services. Détail qui compte : ce fichier n'importe pas zod, et le front le référence par un alias DÉDIÉ (`@packages/api-contracts/locale`) — importer l'index des contrats depuis Next aurait tiré tous les schémas d'API dans le bundle client. Piège rappelé : `apps/user-ui/tsconfig.json` redéfinit `paths` et `include`, l'alias doit être ajouté LÀ, pas seulement dans `tsconfig.base.json` ; et chaque service consommateur déclare l'alias webpack explicite AVANT le générique `@packages` (trois résolveurs : tsc, webpack, jest).

## Chapitre 53 — feat/booking-auth-modal · Garder le contexte au moment de la décision (modale) et transporter l'intention (redirect)
Deux principes d'UX qui se traduisent en code. ① Au moment où l'utilisateur agit (« Réserver »), une interruption doit se poser AU-DESSUS de son contexte, pas le remplacer : la modale garde le trajet, le prix et la position de scroll ; la page pleine reste pour l'accès direct par URL, où il n'y a pas de contexte à garder. Techniquement, un dialogue accessible tient en cinq lignes d'effet (Échap, verrou du scroll, focus initial, nettoyage) et deux attributs ARIA — pas besoin d'une bibliothèque tant qu'il n'y a pas quatre dialogues à harmoniser. ② L'intention voyage dans l'URL : `?redirect=` porte « où revenir », calculé là où l'intention est connue (la carte du trajet sait que c'est `/book` ; le header sait la page courante), filtré par UNE fonction (`shouldCarryRedirect`) qui connaît les exceptions (pages auth, accueil), et validé à l'arrivée par `sanitizeRedirect` (jamais d'URL externe). Trois endroits produisent des liens de connexion : ils appellent la même fonction — sinon le jour où l'on ajoute une exception, l'un des trois l'oublie.

## Chapitre 54 — feat/trip-favorites · L'état personnel d'une ressource publique (authent optionnelle, enrichissement après mapping, optimisme multi-cache)
Un trajet est public ; « je l'ai mis en favori » est personnel. Trois patrons. ① L'authentification OPTIONNELLE : la même route sert le visiteur et le connecté, la réponse a la même forme (`isFavorite: false` pour tous chez le visiteur), et le middleware `isOptionallyAuthenticated` ne coûte rien à qui n'a pas de cookie — on ne duplique pas une route « /search-connecté ». ② L'enrichissement se fait DANS LE CONTRÔLEUR, après le mapper : `mapTripToYambaResult` reste une fonction pure du trajet (testée comme telle, réutilisée par la liste des favoris), `markFavorites` ajoute la seule chose qui dépend de l'utilisateur, en UNE requête `in` sur la page. ③ Côté client, une même donnée vit dans plusieurs caches (la fiche, les pages infinies de la recherche, la liste des favoris) : la bascule optimiste doit toucher les trois, se souvenir des trois états précédents et les restaurer tous en erreur — sinon le cœur est plein sur la carte et vide sur la fiche. Bonus appris : le registre Zod global du générateur OpenAPI est partagé entre services — un schéma ajouté pour trip-service apparaît dans les trois `openapi.json`, et la CI compare les trois.

## Chapitre 55 — feat/auth-pages-ux · Généraliser à la deuxième occurrence, et dire la vérité dans l'interface
Le composant de #118 s'appelait `BookingAuthGateModal` et lisait ses textes dans `booking.authGate`. À la deuxième action qui a besoin de la même porte (« Partager un trajet »), on extrait : le squelette (accessibilité, focus, verrou du scroll, deux formes desktop/mobile) devient `AuthGateModal` avec trois props (`title`, `subtitle`, `redirect`), et l'ancien composant devient un habillage de cinq lignes. Règle : une abstraction se paye à la deuxième occurrence, pas à la première (on ne sait pas encore ce qui varie) ni à la quatrième (on a déjà trois copies qui divergent). Deuxième leçon, produit : des chiffres inventés (« 12k+ Yambers, note 4.8 ») et un témoignage fictif sur une page d'inscription sont une dette de confiance et un risque juridique ; remplacer par ce que le code garantit (compte vérifié, capture manuelle, code de remise) coûte trois phrases et ne se dément jamais. Troisième, mobile : un champ à 14 px déclenche le zoom automatique d'iOS au focus ; `text-base sm:text-sm` règle le problème sans toucher au desktop.

## Chapitre 56 — feat/auth-google · OAuth sans faire confiance au navigateur (jeton d'identité, injection, consentement rejoué)
Trois idées. ① Le front ne « connecte » jamais personne : il obtient d'un tiers un JETON D'IDENTITÉ signé et le serveur le VÉRIFIE (signature, audience, expiration, email vérifié) avant de décider — le même patron que pour un mot de passe, où le hachage est comparé côté serveur. ② Un flux qui parle à un service externe se teste en isolant l'appel réseau dans un seul fichier (`google-token.verifier.ts`) et en INJECTANT ce vérificateur (et Prisma) dans la logique métier : six tests couvrent toutes les branches sans jamais toucher Google. ③ Le consentement RGPD ne se contourne pas parce que le canal change : quand le compte n'existe pas, le serveur répond « il manque ton accord » SANS rien créer, le front affiche la case, puis rejoue le même jeton (valable quelques minutes) avec les versions des documents — pas de brouillon serveur, pas d'état à nettoyer. Pièges : un identifiant externe optionnel et unique sur `User` se percute sur `null` sous Mongo (modèle `AuthIdentity` séparé) ; le bouton officiel GIS est le seul chemin fiable vers un `id_token` au clic (le One Tap a des cooldowns).
