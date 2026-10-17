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
| 8 | 17/10 | Découpe du parcours de réservation tranchée | **7 pages, une décision par page** (recommandation retenue) : ① le colis ② valeur/photos/description ③ lieux de RDV ④ garantie ⑤ destinataire ⑥ engagement ⑦ paiement + confirmation |
| 9 | 17/10 | **Page ① « Le colis » — premier jet** (`feat/mobile-booking-colis`, `225dbc2`) | Pile `booking/`, `BookingStepFrame` (barre du bas définitive), produit/familles/taille/poids, prix VIVANT par `@packages/pricing` + paramètres D62, brouillon en mémoire de processus. La fiche trajet passe au CTA mangue « Réserver ». Web jumeau : lien mort des objets interdits réparé, `toLocaleString("fr-FR")` en dur supprimé, kilos restants visibles pour les bagages, raccourcis de poids. Typecheck mobile + web verts, i18n miroir parfait |
| 10 | 17/10 | **Méthode révisée (demande du 17/10)** | Plus de code à l'aveugle : j'ANNONCE la page, tu fournis les **captures web**, on optimise le web sur captures, PUIS on fait la page mobile. La page ① est donc un premier jet à repasser sur captures |
| 11 | 17/10 | **Deuxième arrêt machine (mémoire)** — reprise | Le crash avait ramené la moitié WEB du lot (`StepParcel.tsx` + les deux `booking.json` de `user-ui`) à la version de `dev` ; le mobile avait survécu. Les deux commits étaient POUSSÉS : `git reset --hard origin/feat/mobile-booking-colis` restaure tout (index local sauvegardé avant). Typecheck mobile **vert** (cache), `tsc --noEmit` user-ui **vert**. Rien de perdu |
| 12 | 17/10 | Captures de la page ① retrouvées | `context/captures/mobile/booking/1-web/` (4, viewport téléphone) + `1-mob/` (2, desktop), déposées à 08 h 00–08 h 05 juste avant le crash. Revue d'expert de la page web jumelle produite — en attente de GO |
| 13 | 17/10 | **Page ① repassée sur captures** (web ET mobile) | Web : ordre refait (colis → garantie → description → photos → lieux → règles d'or), la garantie passe AVANT les photos (c'est elle qui les rend obligatoires), taille en **euros** au lieu de « ×1,1 », familles acceptées d'abord + refus comptés et repliés, pastille non choisie désormais transparente, lieux en **liste à plat** (plus de cartes encadrées, sélection mangue), `— €` fantôme supprimé, « Débité à acceptation » ajouté sur téléphone, en-tête **réduit dans le tunnel** (ni cloche, ni messagerie, ni « Partager un trajet »), lien IPID mort réparé, `formatEur` enfin localisé. Mobile : même vérité — poids AVANT taille, taille en euros, refus repliés. Typecheck user-ui + mobile verts, miroir i18n parfait |
| 14 | 17/10 | **Retours web sur `1-mob/back1`** (3 captures) | Taille : trois rectangles → **segmenté d'un seul tenant**, sans icônes, et SEULE la taille qui coûte plus cher est marquée. Libellé « Taille : pas besoin de mesurer ». Règles d'or : titre qui s'écrivait **deux fois** à l'ouverture, « Voir » qui disparaissait sans rien pour replier, encadré dans un encadré → un titre, un **chevron qui tourne**, une liste à plat. Trouvés en plus : l'indice de famille tombait **sous** la ligne des refus (il la commentait), « Description courte » était **obligatoire sans le dire** (5 caractères), le récapitulatif disait encore « × M » (la mécanique qu'on venait de retirer des cartes), le bloc photos ne disait pas « jusqu'à 5 », les champs Poids/Valeur occupaient la demi-colonne, et la pastille de dev Next se posait sur la page (`devIndicators: false`) |
| 15 | 17/10 | **Deuxième passe de retours web** (taille, textes, 4 points challengés acceptés) | La taille abandonne TOUT rectangle : les mêmes pastilles que la question du dessus, seule celle qui coûte plus cher porte son prix. Textes refaits en français naturel et court (« Qu'est-ce que tu envoies ? », « Le Voyageur choisit ce qu'il accepte de transporter. », « Ton argent est bloqué jusqu'à la livraison. Colis non remis, tu es remboursé. », « Perte, vol ou casse en route : tu es remboursé jusqu'à 500 € » + « Ce qui n'est pas couvert »). Les 4 points challengés sont appliqués : **la garantie quitte la colonne de droite** pour le formulaire (une décision à +6 € n'est pas un récapitulatif), **le trajet n'est plus écrit trois fois**, **les lieux passent à l'étape 2** (`MeetingPoints.tsx`, validation déplacée, l'étape 2 devient « Livraison » / « Où, et à qui ? »), **photos en 3 colonnes**. Au passage : « +6 € » et « 500 € » étaient écrits EN DUR dans les traductions alors que D62 les rend paramétrables — ils viennent du moteur |
| 16 | 17/10 | **Troisième passe de retours web** (`back-2`) | **GAR-04** : la ligne « Service & protection » portait la SEULE commission, juste au-dessus d'une ligne « Garantie Yamba » — deux protections facturées à la lecture, alors que la règle dit que prime et commission « ne se mélangent jamais ». Elle devient **« Frais de service Yamba »** (le total, lui, était juste). **GAR-05** : les exclusions (dont la saisie douanière d'un colis non conforme) doivent être « présentées AVANT le choix » — un lien à cliquer ne présente rien : choisir la Garantie les ouvre d'office. **Infobulle tronquée** : elle s'ouvrait vers le haut et sortait de la carte (`overflow-hidden`) → vers le bas, et la carte ne rogne plus. **Photos** : grille plafonnée, cinq vignettes sur une ligne. **En attente de GO** : la sortie du tunnel (confirmation + brouillon gardé + favori), proposée comme entrée de registre |
| 17 | 17/10 | **Sortie du tunnel** (arbitrage : toujours repartir de zéro) | Confirmation (« Reprendre » par défaut, Échap = reprendre), brouillon effacé, **favori proposé coché** (D46, déjà livré). Rien n'est demandé quand rien n'a été saisi (`hasUserInput`). Les deux portes sont unifiées : flèche desktop et croix mobile font la même chose. **Défaut latent trouvé** : le brouillon de session n'était pas porté par le trajet — un brouillon du trajet A était restauré sur le trajet B dans le même onglet, `pickupLocationId` compris (identifiants = des RANGS, donc « correspondants » sans erreur visible). Registre : **A214** + nouveau **§ 7.6 « Évolutions proposées »** (reprise de brouillon, brouillon serveur, web à 7 étapes) — parkées avec leur motif de refus, plutôt qu'un 29ᵉ fichier dans `context/` |
