# Handoff — 21/09/2026 (écrit à l'arrêt de la session du 20/09 au soir) · le chantier bienvenue/recherche-first est OUVERT, PR #381 en itération design

*Ce document sert à REPRENDRE le chantier après une pause. Il remplace, comme point d'entrée, le
handoff du 19/09. ATTENTION : la session du 20/09 a connu un REDÉMARRAGE du Mac en cours de route —
la conversation a été perdue, le périmètre a été reconstitué puis largement réorienté par
l'utilisateur sur captures Blablacar. Lire le § 2 avant tout.*

---

## 1. L'état du dépôt, en une ligne

`dev` = `2d941a3` (#380, page trajet A205, jalon 4 à 30 %). **La PR #381 est OUVERTE** sur
`feat/mobile-welcome` — six commits, dont un lot mergeable (A206) DÉPASSÉ le soir même par la
refonte recherche-first (§ 2). **NE PAS merger #381 en l'état** : docs et registre décrivent un
écran qui n'existe plus (§ 3 a). Tests plateforme **inchangés : 1576** (aucun service touché,
tout le chantier est dans `apps/mobile`). Le merge m'est REFUSÉ par le classifieur de permissions :
c'est l'utilisateur qui merge (ou autorise `gh pr merge`).

| Commit | Contenu |
|---|---|
| `8b2d296` | A206 : l'onglet Accueil transposé de l'accueil web #357 (corridors, préremplissage par graine) + registre |
| `092b249` | docs cumulatifs A206 (RG-MOB-21→24, MOB32→38, chapitre 207) |
| `5936cc3` | splash + écran de bienvenue (captures IMG_0666/0668), échelle typo resserrée (title 48→30, subtitle 32→20) |
| `25fe567` | itération design : pastilles sur le visuel, contraste CTA (libellé sombre sur mangue), tenue du splash 1,5 s + fondu |
| `a0ebef8` | **recherche-first** : onglet Accueil SUPPRIMÉ, Rechercher = atterrissage, onglet Publier (porte + coquille), formulaire natif (villes Google plein écran, date native @expo/ui), corridors au repos, villes en entier |

## 2. Ce qui s'est passé le 20/09 (résumé pour ne pas se perdre)

1. Reprise post-redémarrage : la branche `feat/mobile-welcome` existait, VIDE. Périmètre reconstitué
   (à tort mais utilement) comme « transposer l'accueil web » → lot A206 livré, PR #381 ouverte,
   CI 18/18 verte à ce moment-là.
2. L'utilisateur a alors montré le VRAI sens du lot perdu : les captures Blablacar dans
   **`context/captures/`** (NON versionnées, sur le disque) — IMG_0666 (splash), IMG_0668
   (bienvenue), 23.30.00 (recherche-first + Publier), 23.37.56 (résultats) + les équivalents web.
3. Livré sur ces captures, en itérations validées au téléphone (Expo Go, iPhone) : splash mangue
   (wordmark + arcs, tenue 1,5 s), bienvenue (illustration du site, pastilles modes, feuille sombre,
   « Se connecter » primaire — PAS d'« Inscription » : l'écran n'existe pas dans l'app, consigner),
   typo générale resserrée, puis la refonte recherche-first du § 1.
4. **Décisions utilisateur explicites** : police plus petite partout ; X de bienvenue → atterrit sur
   Rechercher ; Accueil supprimé (« on a déjà Rechercher ») ; + Publier dans la barre ; villes en
   entier dans les résultats ; autocomplétion Google NATIVE (plein écran, pas un dropdown web) ;
   date par le sélecteur natif de chaque OS.

## 3. Ce qui reste AVANT de merger #381

### (a) Réconcilier registre et docs cumulatifs (ajout seul, jamais de réécriture)
- Écrire **A207** au registre : recherche-first (suppression de l'onglet Accueil, Publier, le canal
  Google Places REST miroir du web, la date @expo/ui, la pilule récap, « Se connecter » primaire
  faute d'écran d'inscription, la tenue de splash plancher-jamais-plafond).
- Compléter les TROIS docs cumulatifs d'une section qui raconte la SUPERSESSION : A206 reste
  l'histoire, mais RG-MOB-21→24 et MOB32→38 décrivent un onglet mort — les remplacer PAR AJOUT
  (nouvelles règles/fiches recherche-first, note de caducité sur les anciennes).
- Les fiches recette MOB14→25 (onglets, recherche) sont partiellement caduques aussi : l'écran
  recherche a changé (formulaire à sélecteurs, plus de puces de dates).

### (b) Preuves à refaire sur l'état final
- Bundle Hermes `expo export --clear` (marqueurs FR accentués + EN, DEUX encodages, témoin faux à 0)
  — non refait après `5936cc3`/`a0ebef8`.
- CI #381 : recomptée à 18 sur le DERNIER commit (elle a été relancée trois fois).
- Typecheck 10/10 + i18n : verts au moment de l'arrêt.

### (c) Validation visuelle restante (utilisateur)
- **Redémarrer Metro d'abord** : `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` a été AJOUTÉE au `.env` racine
  (copie de la clé web) et Expo n'inline les env qu'au démarrage.
- **Vérifier la clé Google** : si elle est restreinte « referrer HTTP » (réglage web), l'API REST
  Places refusera les appels de l'app → suggestions muettes (dégradation silencieuse voulue). Il
  faudra une clé « application » dans la console Google.
- Android non testé (D73 : Android publié d'abord !) : la boîte de date Material et le fallback
  emoji des symboles n'ont jamais été vus.

### (d) L'inchangé (hors chantier)
ImageKit « Restrict unsigned URLs » (hors dépôt, depuis le 17/09) ; sauvegardes Atlas ;
`chore/deps` (audit à 18) ; mocks `$transaction` ; contrôle « clé i18n orpheline » (à arbitrer).

## 4. Le poste, tel qu'il est à l'arrêt

- Docker : `yamba-redpanda` + `yamba-mailpit` UP. Les six services UP (bundles reconstruits le
  20/09 au soir — auth inclut A201). Relance : procédure inchangée du handoff 18/09 § 4.
- Metro : côté utilisateur (`npx nx start @yamba-app/mobile` — jamais un `expo start` nu).
- Base : 10 trajets publiés du seed (5 corridors, Paris → Brazzaville 6×).
- `context/captures/` : les références design du lot, NON versionnées, à conserver sur le disque.

## 5. Pièges payés le 20/09 — ne pas les repayer

- **Un redémarrage machine efface la conversation, pas le disque** : la branche vide a suffi à
  retrouver le fil, mais le périmètre du GO était perdu → depuis, CHAQUE itération est commitée et
  poussée immédiatement. Continuer ainsi.
- **`StyleSheet.absoluteFillObject` n'existe plus dans les types RN du SDK 57** (TS2551) — poser
  `position:'absolute'` + les quatre bords explicitement.
- **`EXPO_PUBLIC_*` est inliné au DÉMARRAGE de Metro** : ajouter une variable exige un restart,
  le reload ne suffit pas.
- **`@expo/ui` s'importe PARESSEUSEMENT et par plateforme** (`require` dans la branche
  `Platform.OS`) : importer le paquet jetpack-compose sur iOS enregistrerait des vues de l'autre OS.
- **Un onglet à la fois** : `router.navigate` + graine (A206) était le bon motif ENTRE onglets ;
  dès que corridors et recherche vivent sur le MÊME écran, le motif disparaît — vérifier où l'on est
  avant de transposer un mécanisme.
- Le classifieur de permissions refuse `gh pr merge` (et a bloqué une fois `nx run-many` + un `sed`
  par erreur — refaire la commande par projet / via l'outil de lecture passe).
- Toujours valides : Hermes UTF-16 (A204), `.expo/types` régénéré par `expo start` seul (A205).

## 6. Par où reprendre demain

1. `git checkout feat/mobile-welcome && git pull` — lire CE fichier, puis regarder les captures de
   `context/captures/`.
2. Demander à l'utilisateur son verdict visuel sur `a0ebef8` (recherche-first + autocomplétion —
   Metro redémarré, clé Google vérifiée § 3 c). Itérer s'il reste des retouches.
3. Une fois validé : § 3 a (A207 + docs par ajout), § 3 b (preuve bundle, CI recomptée), puis
   l'utilisateur merge #381 et on enchaîne la PR d'état (`chore/etat-381` : CONTEXT + SUIVI,
   jalon 4 à réestimer — l'app a maintenant splash, bienvenue, recherche-first, mais l'onglet
   Accueil de A203/A206 n'existe plus).
