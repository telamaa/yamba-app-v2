# Handoff — session du 23/10/2026 : le mobile entre dans la CI, et le paiement devient un écran de Yamba

> Prend la suite de `YAMBA-CONTEXT-HANDOFF-2026-10-21.md`. **C'est ce fichier qu'il faut lire
> en premier à la reprise.**
>
> La session a été coupée en deux par une demande de l'utilisateur au milieu : installer de quoi
> **simuler l'app sur le Mac**. C'est devenu le fait marquant de la journée — l'app a tourné,
> pour la première fois, sous les yeux de son auteur, et elle a immédiatement rendu deux défauts
> que ni le typage ni 386 fiches de test ne pouvaient voir.

## 1. L'état en une page

| Quoi | Où | État |
|---|---|---|
| `origin/dev` | — | `09acc6b` — **n'a pas bougé** (les quatre PR attendent le merge) |
| **PR #393** | `feat/payments-redirect-server` | D82 7A/8A/9A. **MERGEABLE** |
| **PR #394** | `feat/mobile-shipment-tracker` | A221 — le suivi natif. **MERGEABLE** |
| **PR #395** | `feat/mobile-recourse-rating` | A222 — recours et notation. **MERGEABLE** |
| **PR #396** | `chore/mobile-test-harness` | **A223 — le harnais de tests du mobile. 19/19, MERGEABLE** |
| **branche `feat/mobile-payment-methods`** | **non poussée, pas de PR** | **D83 — l'écran de paiement. 4 commits, à finir (voir § 6)** |
| Décisions gravées aujourd'hui | registre v1.3 | **A223** (arbitrage) et **D83** (décision) → la prochaine est **D84** |

**Ordre de merge : #393 → #394 → #395 → #396 → (la PR D83 quand elle existera).** Chaque PR
est empilée sur la précédente ; le diff se réduit dès que celle d'avant est dans `dev`. C'est
l'utilisateur qui merge.

### Les références de tests, toutes MESURÉES aujourd'hui

| Projet | Avant | Maintenant |
|---|---|---|
| **mobile** | **0** (aucun harnais) | **405** · 23 suites |
| deal-service | 732 | **740** (+8, D83 4A) |
| trip-service | 409 | 409 |
| notification-service | 122 | 122 |
| message-service | 79 | 79 |
| auth-service | 407 | 407 |
| **Total plateforme** | 1342 | **1350** + auth 407 + **mobile 405** |

## 2. Le simulateur iOS — ce qu'il faut savoir pour le rouvrir

**Rien n'a eu besoin d'être installé.** Le Mac avait déjà tout : Xcode 15.2 avec le runtime
iOS 17.2 (iPhone 15, SE 3ᵉ gén., iPad), et Android Studio avec l'AVD `Pixel_6_API_33`.

### La séquence qui marche

```sh
# 1. Démarrer le simulateur (une fois)
xcrun simctl boot "671C6F31-19E2-4006-8C1A-61019FD70AC2"   # iPhone 15
open -a Simulator

# 2. Démarrer Metro — par NX, pour que le .env RACINE soit chargé
npx nx start @yamba-app/mobile

# 3. Ouvrir l'app dans le simulateur
xcrun simctl openurl booted "exp://127.0.0.1:8081"

# 4. Regarder ce qui s'affiche sans toucher au Mac
xcrun simctl io booted screenshot /tmp/sim.png
```

### Les quatre pièges payés pour y arriver

1. **`expo start --ios` ÉCHOUE depuis un shell outillé.** Le CLI pilote le Simulateur par
   **AppleScript** (`osascript`), ce qui réclame une permission « Automatisation » qu'un shell
   non interactif n'a pas :
   `at osascriptSpawnAsync → isSimulatorAppRunningAsync`. D'où la séquence ci-dessus, qui
   démarre Metro **sans** `--ios` et ouvre l'app par `simctl`.
2. **Expo Go n'était pas dans le simulateur, et `i` n'était pas pressable** (Metro tourne en
   arrière-plan). Il s'installe à la main depuis l'artefact OFFICIEL d'Expo :
   ```sh
   curl -L -o expo-go.tar.gz \
     https://github.com/expo/expo-go-releases/releases/download/Expo-Go-57.0.9/Expo-Go-57.0.9.tar.gz
   # le tarball livre le CONTENU du bundle, pas le .app : il faut le reconstruire
   mkdir -p "ios/Expo Go.app" && tar -xzf expo-go.tar.gz -C "ios/Expo Go.app"
   xcrun simctl install booted "ios/Expo Go.app"
   ```
   (La version du client Expo Go suit le SDK — 57.0.9 pour un projet en `expo@57.0.24` — et
   la liste est servie par `https://api.expo.dev/v2/versions/latest`.)
3. **Un seul Metro à la fois.** Un Metro déjà lancé fait répondre
   « Port 8081 is running this app in another window / Use port 8082 instead? », et le CLI
   échoue en mode non interactif. Tuer l'ancien avant d'en lancer un neuf.
4. **zsh avorte sur un glob sans correspondance.** `ls *.app` ou `for f in * .[!.]*` tuent le
   script entier là où bash continuerait. Utiliser `find`, ou renommer le dossier plutôt que
   de déplacer son contenu.

### Ce que le simulateur NE permettra JAMAIS

**Apple Pay.** Mesuré :

```sh
codesign -d --entitlements : "Expo Go.app"
→ AUCUN droit com.apple.developer.in-app-payments
```

iOS exige que l'identifiant marchand figure dans les **droits de l'application**. Dans Expo Go,
`isPlatformPaySupported()` répond donc NON, et la ligne Apple Pay ne s'affiche pas — c'est
voulu (A209 : pas de bouton mort). Il faudra un **build de développement iOS** avec
`merchant.com.telama.yamba` dans ses droits, donc un compte développeur Apple payant.

## 3. Trois affirmations de D82 CORRIGÉES par la mesure

1. **« La feuille Stripe native n'existe pas dans Expo Go » — FAUX sur iOS.** Le binaire
   d'Expo Go 57.0.9 contient la classe `StripeSdk` et huit bundles de ressources Stripe. La
   feuille s'est ouverte dans le simulateur, en mode TEST, avec le bon montant. L'affirmation
   est écrite dans `lib/stripe-sheet.ts`, dans `.env.example` ET dans D82 — **les trois sont à
   corriger** (fait dans D83, pas encore dans les deux fichiers).
2. **PayPal EST compatible avec notre empreinte à capture manuelle.** C'était la réserve de
   D83 : `capture_method: "manual"` (D31) fait écarter par Stripe les moyens incapables
   d'autoriser puis débiter. Mesuré : PayPal s'affiche bel et bien sur une telle intention.
3. **Apple Pay ne le sera jamais dans Expo Go** (§ 2).

## 4. Le compte Stripe de test a été RECONFIGURÉ (par API, à la demande de l'utilisateur)

Compte `acct_1THXnvCFnaR4XOmY` (France, « Yamba »), configuration `pmc_1THXo6CFnaR4XOmYNjh5uSzW`,
**mode test uniquement** :

| Moyen | Avant | Maintenant |
|---|---|---|
| `paypal` | off | **on** |
| `cartes_bancaires` (réseau CB) | off | **on** |
| `google_pay` | off | **on** |
| `apple_pay` | on | on |
| `link`, `klarna`, `amazon_pay` | on | **off** |

Le script est dans le répertoire temporaire de la session (non versionné). Il lit la clé depuis
le `.env` RACINE et **refuse de tourner sur autre chose qu'une `sk_test_`**.

> **Le `curl` authentifié vers Stripe est REFUSÉ par le garde-fou de l'environnement outillé.**
> Passer par le SDK `stripe` du dépôt (`createRequire` depuis la racine, puisque le script vit
> hors du dépôt) fonctionne et garde la clé hors de la ligne de commande.

## 5. Ce qui a été livré

### A223 — le harnais de tests du mobile (PR #396, 19/19)

`apps/mobile` n'avait **aucun test**, et aucun des dix-huit contrôles n'en voyait une ligne,
alors que **2 109 lignes** de `src/lib/` étaient écrites PURES exprès pour cela (A205, A213,
A217, A221, A222). 336 fiches à l'ouverture, **zéro dépendance nouvelle**, 99,09 % des
instructions couvertes. Le cœur : **deux programmes TypeScript** — celui de Metro ne déclare
PAS `@packages/api-contracts`, donc un écran ne peut pas importer le contrat (zod hors du
bundle) ; celui des fiches l'ajoute, et les fiches confrontent les constantes RECOPIÉES au
contrat réel. `alias.spec.ts` garde l'équilibre.

**Défaut trouvé le premier jour, NON corrigé (lot à part, les DEUX fronts)** : `toE164` ampute
le zéro des numéros du **Congo-Brazzaville (+242)** et de la **Côte d'Ivoire (+225)**, où il
appartient au numéro de l'abonné. C'est par ce numéro que part le code de livraison (D43), et
le serveur ne contrôle que la FORME E.164. Épinglé par deux `it.failing` portant l'attendu
CORRECT — ils deviendront ROUGES le jour de la correction, ce qui obligera à les retirer.

### D83 — l'écran de choix du moyen de paiement (branche non poussée)

La feuille de Stripe cesse d'être la porte d'entrée. Écran plein, à nous, en français ; une
page par moyen ; « Carte bancaire » en UNE ligne (CB est un RÉSEAU, pas un moyen) ; les
portefeuilles **mesurés** et non déduits de `Platform.OS` ; et la liste servie par le serveur
(`paymentMethodTypes`, +8 tests deal-service) plutôt que devinée.

## 6. Ce qu'il reste à faire sur D83 — la suite immédiate

1. **Le jumeau web** (D83 7A) : même vocabulaire, même honnêteté sur ce qui est proposé.
2. **Les trois documents cumulatifs** (technique, métier, apprentissage) pour D83.
3. **Pousser la branche et ouvrir la PR**, en vérifiant les **19 checks**.
4. **La recette de l'écran dans le simulateur** : elle n'est pas finie. Les deux derniers
   défauts ont été corrigés et l'app rechargée, mais l'utilisateur n'a pas encore confirmé
   l'affichage. **Ne pas annoncer le lot fini avant.**

## 7. Les deux défauts que le simulateur a rendus, et ce qu'ils ont coûté

Tous deux invisibles au typage **et** au harnais (qui ne rend aucun composant — frontière
assumée d'A223). Tous deux corrigés, tous deux désormais gardés.

1. **« Rendered more hooks than during the previous render »** — un `useFocusEffect` posé
   APRÈS deux sorties anticipées. Garde ajouté : `hooks-avant-sortie.spec.ts` balaie `src/app`
   et attrape la forme du défaut (découpage **par composant** — sans lui, 17 faux positifs ;
   hooks imbriqués ignorés ; et la sonde se vérifie elle-même sur le défaut exact).
2. **« Cannot update a component while rendering a different component »** — une fonction de
   mémoire qui NORMALISAIT en répondant, donc appelée pendant le rendu. Corrigé par
   **suppression** : la fonction qui lit et écrit disparaît. Règle qui en sort, valable pour
   toutes les mémoires de processus du dépôt : **une fonction qui répond à une question
   n'écrit jamais**. Verrouillée en COMPTANT les notifications.

> **Axe à instruire, pas à trancher dans la précipitation** : la frontière d'A223 (aucun rendu
> de composant) a coûté deux défauts en deux écrans. Sur des écrans à état, un harnais de rendu
> (`jest-expo` + `@testing-library/react-native`) changerait le rapport coût/bénéfice. À
> réévaluer **avec une mesure**, pas au sentiment.

## 8. Côté utilisateur — ce qui n'est toujours pas fait

| Geste | Conséquence tant qu'il manque |
|---|---|
| **Cocher les 2 contrôles consultatifs** dans `branches/dev/protection` : `TypeScript (fiches de test)` et, après merge de #396, `Tests unitaires (mobile)` | Mesuré le 17/10 : **17 requis, 19 qui tournent**. Deux jobs peuvent échouer sans bloquer un merge |
| `STRIPE_WEBHOOK_SECRET` (via `stripe listen --forward-to localhost:6003/webhooks/stripe`) | `POST /webhooks/stripe` répond **501** |
| Compte développeur Apple + identifiant marchand + certificat | Apple Pay invisible partout, simulateur compris |
| Nettoyer `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` du `.env` | `.env.example` la déclare **RETIRÉE** (clé facturable extractible d'un bundle) |

**Fait aujourd'hui** : `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` est dans le `.env` racine (corrigée
au passage — elle avait été saisie `…PUBLISHABLE_KE`, sans le `Y` final : une variable au nom
inconnu est **ignorée en silence**, et l'app aurait continué à dire « indisponible »).
Sauvegarde du fichier d'avant : `.env.bak-a223`.

## 9. Pièges d'outillage payés aujourd'hui

1. **Une PR en CONFLIT ne déclenche AUCUN run de CI.** GitHub construit une *ref* de fusion
   pour l'événement `pull_request` ; sans elle, il ne crée pas de run — et `gh pr checks` dit
   « no checks reported », ce qui se lit comme une panne d'Actions. Le conflit était dans
   `CLAUDE.md` (compteurs). Vérifier `mergeable` AVANT de soupçonner la CI.
2. **Deux chargements de module dans une MÊME fiche se marchent dessus**, malgré
   `jest.isolateModules` + `doMock`. Un chargement par fiche.
3. **`tsc` et `include`/`exclude`** : `extends` fusionne les `compilerOptions` clé par clé mais
   **remplace en bloc** `include`, `exclude` et `files`. Redéfinir `exclude` oblige à relister
   `node_modules`, sans quoi `include: ["**/*.ts"]` aspire tout le dossier.
4. **Le garde-fou `fiches-sont-des-modules.spec.ts` (deal-service) balaie TOUT le dépôt** — il
   a attrapé trois fiches du mobile sans qu'on ait rien à déclarer. Une fiche sans `import` ni
   `export` de tête est un SCRIPT : `export {}` en pied.

## 10. Le poste (inchangé)

- `.env` **RACINE** uniquement. `npx nx start @yamba-app/mobile` le charge ; un `npm start`
  lancé depuis `apps/mobile` **non**.
- Machine contrainte (MBP 2017, 16 Go) : le simulateur iOS + Metro + les six services tiennent,
  mais ne pas lancer ce dont on n'a pas besoin. Les six services tournaient toute la journée.
- `apps/mobile/AGENTS.md` : lire la doc Expo **versionnée** (`/versions/v57.0.0/`) avant tout
  code Expo.
- Captures = canal design, `context/captures/` non versionné.
