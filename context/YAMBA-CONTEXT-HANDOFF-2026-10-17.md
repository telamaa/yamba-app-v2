# Handoff — 17/10/2026 · reprise après arrêt machine · `feat/mobile-results` (19 commits, AUCUNE PR)

*Point d'entrée de reprise — remplace le handoff du 28/09. Le Mac s'est arrêté dans la nuit
du 16 au 17/10, juste après le commit `0a4e4b1` (00 h 21). Ce document est **vivant** : il est
mis à jour à CHAQUE action de la session (§ 7, journal). État établi par mesure, pas de
mémoire : `git log`, `gh pr`, `git status`, lecture des documents cumulatifs.*

---

## 1. L'état, en une ligne

`origin/dev` = `4280947` (merge #382, 29/09 — l'auth mobile EST dans `dev`). La branche de
travail **`feat/mobile-results` porte 19 commits non mergés** (29/09 → 17/10), **aucune PR
ouverte**, le dernier commit n'était **pas poussé** au moment de l'arrêt. Dette documentaire
réelle : le registre s'arrête à **A210**, les trois cumulatifs s'arrêtent à **A209**.

> `dev` LOCAL est resté à `2d941a3` (#380) — périmé de deux merges. Toujours raisonner
> contre `origin/dev`.

## 2. Ce que la branche contient (par lot, du plus ancien au plus récent)

| Date | Lot | Commits |
|---|---|---|
| 28/09 | **Carte de résultat** — ICU pluriels (polyfills Hermes), réf. SNCF Connect, pays localisé (`Intl.DisplayNames`), carte web à l'identique, **V2 épurée à drapeaux** (maquette validée) | `4c00409` `849481d` `ed79ef0` `839cfcd` `70707df` |
| 28/09 | **Haut de page résultats** — barre récap + titre/sous-titre + pastilles transport avec facettes serveur + feuille Filtres ; **en-tête COLLANT sur fond flouté** (expo-blur) | `ad55689` `3ca045b` `7045e6e` |
| 11/10 | **A210 — barre cible** `Explorer · Favoris · [ + ] · Activité · Messages`, Favoris à trois segments, Profil en pastille (**seul lot déjà au registre**) | `47146da` |
| 13/10 | **Parcours de recherche natif** — départ/destination/date en pages poussées, date intelligente, feuille « Modifier la recherche », flou dosé | `8cb90da` `f9da355` `ddfa65e` `81488d7` |
| 13/10 | **A211 — autocomplétion par NOTRE API** (la clé Google ne quitte plus le serveur) : `GET /places/autocomplete` en trip-service + contrat + gateway + 5 `openapi.json` + **2 fichiers de tests** | `b0bfabd` `117b563` |
| 13/10 | **Fiche trajet native** — la page publique du site en natif, puis **allégée** (page à plat, une seule carte) | `63700d5` `4c25152` |
| 17/10 00 h 21 | **Revue UX du 16/10** — « le haut arrête de bavarder, la carte dit le VRAI prix » (capture `context/captures/mobile/… 23.51.45.png`) | `0a4e4b1` |

## 3. Ce qui N'EST PAS fait (la dette, à solder avant d'annoncer une PR)

1. **Documents cumulatifs** : rien depuis A209/chapitre 210. À compléter (ajout SEUL, jamais
   de `Write` qui écrase) pour les lots carte/en-tête, A211 et la fiche trajet.
2. **Registre** : A211 (relais Places) et les lots carte/en-tête/fiche trajet n'ont pas
   d'entrée. A210 y est déjà.
3. **Référence de tests** : A211 ajoute `places.controller.spec.ts` (+) et `places.rules.spec.ts`
   (+) à trip-service → la ligne « trip-service 310 » de `CLAUDE.md` bouge. À MESURER, pas à
   déduire.
4. **PR** : aucune. Les 19 commits valent au moins deux PR empilées par nature (mobile pur /
   lot serveur A211), à trancher au moment de les ouvrir.
5. **Validation device** du commit de 00 h 21 (la revue UX du 16/10 n'a pas été revue sur
   iPhone après correction — le Mac s'est arrêté).

## 4. Le lot PRÉPARÉ mais pas commencé (ce qui était « en cours »)

Les seules modifications non committées, horodatées **13/10 23 h 25** (juste après la fiche
trajet), sont des **préparatifs de lot**, pas un travail interrompu :

- `apps/mobile/package.json` + `package-lock.json` : ajout de **`expo-image-picker@~57.0.20`**
  (photos du colis).
- `apps/mobile/tsconfig.json` : alias **`@packages/pricing`** → `packages/libs/pricing/src/index.ts`
  (LE moteur de prix, pur, en cents — D13/D14/D16/D22/D32).

Lecture : le lot suivant est le **wizard de réservation natif** (Expéditeur), qui a besoin du
devis en direct et des photos. Il fermera la phrase laissée dans `trip/[id].tsx:990` (« au lot
réservation, cette pastille devient le CTA mangue »).

> Rappel de doctrine (A210 b, mémoire 11/10) : **full natif**, aucune WebView, aucune
> redirection, aucun renvoi textuel au site pour un parcours absent.

## 5. L'app mobile aujourd'hui (jalon 4)

| Écran | État |
|---|---|
| Explorer (résultats + recherche) | **Réel** — recherche, facettes, filtres, tri, en-tête collant |
| Fiche trajet `trip/[id]` | **Réel** — la page publique du site, allégée ; pas de CTA Réserver |
| `(auth)` (6 écrans) | **Réel** (A208/A209, dans `dev`) |
| Favoris (3 segments) | **Réel** (A210) |
| Profil (poussé) | **Réel** (pastille d'angle) |
| Activité | **Coquille honnête** — chiffres vrais + porte unique vers Publier |
| Messages | **Coquille honnête** |
| Publier | **Coquille honnête**, hors barre, atteignable par `router.push('/publish')` |

## 6. Le poste

- Metro : `npx nx start @yamba-app/mobile` — **jamais** un `expo start` nu (le `NODE_PATH`
  du target, sinon `MODULE_NOT_FOUND` sur `expo-router/_ctx-shared`).
- Pour un parcours réel : gateway + auth + trip (+ deal au lot réservation). **Machine
  contrainte** (MBP 2017, 16 Go) : ne pas lancer les six services par réflexe.
- Captures = canal design, `context/captures/` **non versionné** (la dernière : `mobile/… 2026-10-16 à 23.51.45.png`).
- `.env` RACINE uniquement ; `GOOGLE_MAPS_SERVER_API_KEY` pour A211 (sans elle,
  `/places/autocomplete` répond 503 `PLACES_UNAVAILABLE`, ce qui est le comportement VOULU).

## 7. Journal de la session (mis à jour à chaque action)

| # | Heure | Action | Résultat |
|---|---|---|---|
| 0 | 17/10 | Diagnostic de reprise (git, PR, docs, horodatages) | État du § 1 établi ; le « travail en cours » était des préparatifs de lot, pas un chantier à moitié écrit |
| 1 | 17/10 | `nx typecheck @yamba-app/mobile --skip-sync` | **Vert** (4,7 s) — la branche est saine après l'arrêt machine |
| 2 | 17/10 | `git push origin feat/mobile-results` | `4c25152..0a4e4b1` poussé — la branche distante est à jour, rien n'a été perdu |
| 3 | 17/10 | `nx test trip-service` | **326 tests / 28 suites** (était 310) — A211 vaut **+16**. `CLAUDE.md` mis à jour : référence plateforme **1186** + auth 406 |
| 4 | 17/10 | **PR #385 ouverte en BROUILLON** (`feat/mobile-results` → `dev`) | Les 18 contrôles tournent enfin sur ces 19 commits. Brouillon assumé : les cumulatifs sont complétés AVANT le passage en « prête » |

## 8. La procédure décidée le 17/10 (pour tout le process de réservation)

**Une PAGE à la fois.** Pour chaque page du parcours de réservation :

1. la **page mobile native**, traitée en **expert UX/UI** (pas un portage mécanique) ;
2. puis l'**optimisation de la page web jumelle** (le mobile force à trancher ce que le web
   laisse flou — la divergence reste assumée quand le contexte diffère, A203/A209/A210) ;
3. puis **la PR et les documents** de CETTE page (registre + les trois cumulatifs) ;
4. seulement ensuite, la page suivante.

Pas de gros lot réservation monolithique, pas de rattrapage documentaire global.
| 5 | 17/10 | Dette documentaire soldée | Registre **A211 / A212 / A213** ; DOC-TECHNIQUE +230 ; DOC-MÉTIER +45 (**RG-MOB-41→49**, fiches **MOB67→82**) ; APPRENTISSAGE +160 (**chapitre 211**). Ajout seul : 0 suppression |
| 6 | 17/10 | CI de #385 | **18/18 vertes**, comptées |
| 7 | 17/10 | `a683186` poussé, **PR #385 passée en « prête »** | Il reste à la merger (c'est toi qui merges), puis une PR d'état `chore/etat-385` (CONTEXT + SUIVI) |
| 8 | 17/10 | **PR #385 mergée** dans `dev` (`c439979`, 12 h 10) | `origin/dev` = `c439979`. La PR d'état `chore/etat-385` reste à ouvrir |
| 9 | 17/10 | **Reprise après un second arrêt machine** — diagnostic | Le Mac s'est arrêté PENDANT un `git merge origin/dev` sur `feat/feed-relevance-server` (PR **#383**, D80 serveur, ouverte depuis le 29/09) : `MERGE_HEAD` présent, **3 conflits** dans les cumulatifs. Aucune perte : les 5 commits D80 étaient poussés |
| 10 | 17/10 | Conflits résolus — **ajout contre ajout** | Les deux côtés sont des ajouts PURS à la base (vérifié ligne à ligne contre `:1:`) : gardés tous les deux, `dev` d'abord (mergé), D80 ensuite (mergera après). **0 suppression face à `dev`** (+114 / +34 / +70). Le chapitre d'apprentissage de D80 passe de **211 à 212** (211 est pris par #385) |
| 11 | 17/10 | `maxmind` absent de `node_modules` | Déclaré au manifeste ET au lock côté branche, jamais installé : `npm install` (3 paquets, aucune dérive du lock). Sans lui, `nx typecheck trip-service` ET `api-gateway` échouaient — la brique `packages/libs/geoip` ne compilait pas |
| 12 | 17/10 | `nx run-many --target=typecheck --all --skip-sync` | **10/10 vertes** (32 s) — le merge est sain |
| 13 | 17/10 | `f464b30` — **merge committé** | Le rattrapage de 18 jours est dans la branche de #383 |
| 14 | 17/10 | `nx test trip-service` **MESURÉ** | **408 tests / 30 suites** (326 côté `dev` + **82** de D80). `CLAUDE.md` : référence plateforme **1186 → 1268**, trip **326 → 408**. La branche n'avait JAMAIS mis `CLAUDE.md` à jour (le « trip 310 → 392 » n'existait que dans le message de `a774e3a`) |
| 15 | 17/10 | `npm run generate:openapi` | **Aucune dérive** : les 5 `openapi.json` sont en phase après le merge (le contrôle CI de diff passera) |
| 16 | 17/10 | `f464b30` + `87d8401` poussés | `59d5d62..87d8401` sur `origin/feat/feed-relevance-server` |
| 17 | 17/10 | **CI de #383** | **18/18 vertes, comptées par bucket** (0 fail). La PR est passée de bloquée-sur-conflit à `MERGEABLE` / `CLEAN`. Le dernier contrôle tombé est « TypeScript (fiches de test) » — celui qui voit les `*.spec.ts` |
| 18 | 17/10 | Merge contrôlé SÉMANTIQUEMENT, pas seulement textuellement | Aux deux points où `dev` et D80 se croisent : `trip-service/src/main.ts` (le routeur Places d'A211 monté à côté de `/trips`, `/uploads`, `/admin`) et `apps/api-gateway/src/main.ts` (le `x-client-ip` de D80 sur `/api/trips` ET le proxy `/api/places` d'A211) |

## 9. L'état après la reprise du 17/10 — ce qui reste

| PR | Branche | État |
|---|---|---|
| **#383** | `feat/feed-relevance-server` | **Ouverte et PRÊTE** (jamais en brouillon), D80 serveur, **à jour de `dev`** depuis `f464b30`, **18/18 CI vertes**, `MERGEABLE` / `CLEAN`. Il ne reste QUE le merge — c'est toi qui merges |
| **#384** | `feat/feed-relevance-web` | **Ouverte**, basée sur `feat/feed-relevance-server` (empilement correct), 2 commits. Deux choses l'attendent : rejouer la MÊME résolution d'ajout contre ajout dans les trois cumulatifs, et renuméroter son chapitre d'apprentissage **212 → 213** (212 est désormais pris par le chapitre serveur de D80) |
| — | `chore/etat-385` | **À ouvrir** : `YAMBA-CONTEXT.md` + `YAMBA-SUIVI-PROJET.md` pour le lot mobile mergé |

> Ordre acté : #383 (serveur) → #384 (web) → le mobile du flux localisé. Puis la procédure
> « une page à la fois » du § 8 reprend sur le wizard de réservation natif (§ 4).
