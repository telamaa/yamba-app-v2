# Handoff — session du 20→21/10/2026 : D82 gravée, l'APK Android existe, les paiements à redirection sont prêts

> Prend la suite de `YAMBA-CONTEXT-HANDOFF-2026-10-19.md`. **C'est ce fichier qu'il faut lire
> en premier à la reprise.**

## 1. L'état en une page

| Quoi | Où | État |
|---|---|---|
| `origin/dev` | — | `750d52f` — **n'a pas bougé de la session** |
| **PR #391** | `feat/booking-parcel-card` | Tunnel natif ① → ⑦ + jumeau web (A217→A220). **18/18**, MERGEABLE |
| **PR #390** | `chore/etat-389` | Report d'état des neuf lots #381→#389. **18/18** |
| **PR #392** | `chore/mobile-dev-build` | **D82 gravée** + build de développement (expo-dev-client, plugin Stripe, `eas.json`, `com.telama.yamba`, projet EAS lié). **18/18** |
| **PR #393** | `feat/payments-redirect-server` | **D82 7A/8A/9A en entier** (+40 tests). **18/18** |
| Décision gravée | registre v1.3 | **D82** (7A **corrigée** le 21/10) → la prochaine est **D83** |
| Tests | — | **1342** (deal **732**/51 suites, trip 409, notif 122, message 79) + auth **407** |

**Ordre de merge : #391 → #390 → #392 → #393.** Les trois dernières sont empilées : le diff de
chacune se réduit dès que la précédente est dans `dev`. C'est l'utilisateur qui merge.

## 2. Les décisions prises avec l'utilisateur (21/10)

1. **Mode TEST Stripe avec les VRAIES feuilles**, cadré pour que le live ne soit **qu'un
   changement de clés** (D82 1A : le code ne doit jamais savoir dans quel mode il tourne).
2. **Android d'abord, iOS ensuite** (D82 2A). Le web en dernier : Apple Pay web exige un
   domaine HTTPS vérifié, et rien n'est déployé.
3. **Identifiant applicatif `com.telama.yamba`** — **définitif** dès la première publication.
4. **Projet EAS sur le compte d'ORGANISATION `telamas-team`**
   (`projectId 78cf22fe-7ca9-4b1b-8d85-c24291659f45`).

## 3. L'APK Android existe

```
https://expo.dev/artifacts/eas/72ZmpoW-4uti4TPoUFJF2ujg3V-VJumTKvVCYMIClNs.apk
build edcaa60f-2ed8-41c1-8bc3-8143fb852ca7 · keystore créé par EAS · versionCode 1
```

- À installer sur un **appareil Android physique** (Google Pay n'existe pas sur émulateur).
- Puis Metro en mode natif : `cd apps/mobile && npm run start-dev-client`.
- `npx nx start @yamba-app/mobile` reste **Expo Go** (le `--go` est explicite exprès : installer
  `expo-dev-client` fait basculer `expo start` en mode natif par défaut, sans rien dire).
- Un build de développement **n'embarque pas le JS** : les `EXPO_PUBLIC_*` sont lues par Metro,
  donc dans le `.env` **RACINE** via `nx start` (mesuré le 21/10).

## 4. Ce qui reste à faire, et par qui

### Côté utilisateur (je ne peux pas le faire)

| Geste | Pourquoi |
|---|---|
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` + `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` dans le `.env` **racine** | Sans elles, aucune feuille réelle. `pk_test_…` du même compte que la `sk_test_…` déjà présente |
| `STRIPE_WEBHOOK_SECRET` (via `stripe listen --forward-to localhost:6003/webhooks/stripe`) | Il n'est qu'un **commentaire** aujourd'hui → `POST /webhooks/stripe` répond **501** |
| Activer **Klarna** et **PayPal** au Dashboard Stripe (mode test) | **Zéro ligne de code** (D82 4A) |
| Nettoyer `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` du `.env` | `.env.example` la déclare **RETIRÉE** (clé facturable extractible d'un bundle) |
| `PAYMENT_PROVIDER=fake` si la recette Expo Go doit continuer | **Il n'y est pas** : la `sk_test_` présente fait résoudre **STRIPE**, donc `UNAVAILABLE` en Expo Go |
| Compte développeur Apple + merchant ID + certificat | Préalable à Apple Pay (iOS), D82 2A |

### Côté code (prochaine session)

- **Reprise du tunnel mobile à FROID** : si le système tue l'app pendant une redirection, elle
  repart à la racine et il n'y a plus de tunnel. L'argent est protégé (cron d'orphelines), le
  brouillon non. **Fonctionnalité à part**, à décider (D83 ?).
- **Permission micro sur Android** : `RECORD_AUDIO` est injectée par le plugin
  `expo-image-picker` (vérifié : manifeste identique avant/après `eas init`). Yamba ne capte
  jamais de son. `blockedPermissions` **non posé sans mesure** — un blocage mal placé casserait
  l'appareil photo des photos de colis (RG-MOB-85). À vérifier sur appareil réel au premier
  build, puis à graver.
- **Axe 1** : les codes de refus métier sont **absents des cinq `openapi.json`** (ajouter
  `PAYMENT_PROCESSING` n'a produit aucun diff). Un client tiers ne peut les découvrir qu'en
  lisant notre code.
- **Axe 2** : **les deux fronts n'ont aucun test automatisé** dans cette CI.
  `pending-payment.ts` est écrit en fonctions pures pour être testable — rien ne les exécute.

## 5. Les trois corrections de faits de la session (à ne pas re-croire)

1. **Le handoff du 19/10 affirmait `PAYMENT_PROVIDER=fake` dans le `.env` racine : FAUX.** La
   clé n'y est pas ; `STRIPE_SECRET_KEY=sk_test_…` étant présente, la factory résout **STRIPE**.
2. **D82 7A ① « rendre le brouillon web durable » : il l'était déjà** (`usePersistedFormState`).
   Ce qui manquait : l'identifiant de l'autorisation et les URL des photos téléversées.
3. **D82 7A ② « `redirect: "if_required"` échoue par construction » : FAUX.** Stripe.js :
   « will only redirect **if** your user chooses a redirect-based payment method ». Il reste —
   le retirer aurait basculé tous les paiements par carte dans un rechargement de page.

Et **D82 8A était déjà tenue** : `createBooking` relit l'état chez le fournisseur et refuse
tout ce qui n'est pas `AUTHORIZED`. L'entrée D82 7A du registre porte ces corrections en
toutes lettres.

## 6. Un défaut introduit puis corrigé dans la même session (pour mémoire)

Le garde de reprise web (`resumeStarted`) empêche la création d'une seconde autorisation. Il
restait levé si la reprise **échouait** : bouton inerte **définitivement**, c'est-à-dire pire
que l'échec annoncé. Rouvert sur les deux chemins d'erreur. Leçon : *tout verrou posé pour
empêcher un effet de bord doit avoir son chemin de libération dans le cas d'erreur.*

## 7. Le poste (inchangé, plus deux précisions)

- Metro : `npx nx start @yamba-app/mobile` (Expo Go) · `npm run start-dev-client` (build natif).
- `.env` **RACINE** uniquement. Nx le charge pour **toutes** ses cibles, y compris le mobile
  (mesuré) ; un `npm start` lancé à la main depuis `apps/mobile` ne le voit **pas**.
- **Machine contrainte** (MBP 2017, 16 Go) : ne pas lancer les six services par réflexe.
  `scripts/smoke-services.sh` passe sans problème (les six démarrent, cron compris).
- Captures = canal design, `context/captures/` non versionné.
- `apps/mobile/AGENTS.md` : **lire la doc Expo versionnée** (`/versions/v57.0.0/`) avant tout
  code Expo. Il a payé dès la première fois : `useURL` est **déprécié** au profit de
  `useLinkingURL`.

## 8. Journal de la session

| # | Action | Résultat |
|---|---|---|
| 0 | Diagnostic de reprise | Rien perdu ; les deux questions du 18/10 toujours sans réponse |
| 1 | Les deux questions tranchées | Mode test + Android d'abord |
| 2 | **D82 gravée** (9 points) avant toute ligne de code | +1 ligne au registre, 0 suppression |
| 3 | Outillage du build de développement | PR **#392**, 18/18. Piège `expo start` évité, plugin Stripe **prouvé** par `expo config --type introspect` |
| 4 | Projet EAS créé + build Android | **APK livré** ; `RECORD_AUDIO` diagnostiquée (pré-existante, pas introduite par `eas init`) |
| 5 | Lot serveur : refus réessayable, empreinte orpheline, 2 webhooks | PR **#393**, +40 tests, 18/18. **A178** a attrapé le cron absent du catalogue |
| 6 | Lot front : dossier d'attente, reprise, portefeuilles, relais de lien | Ajouté à #393, 18/18. **Deux affirmations de D82 corrigées** |
| 7 | Les trois cumulatifs, trois fois | Ajout seul, 0 suppression, vérifié au `numstat` à chaque passe |

**Non fait volontairement** : `YAMBA-CONTEXT.md` et `YAMBA-SUIVI-PROJET.md` — la PR **#390**
est précisément le report d'état et les modifie ; les toucher ici créerait un conflit. Ils
suivront après les merges.

---

# Mise à jour — fin de journée du 21/10 : trois PR mergées, le suivi natif ouvert

> **Cette section SUPERSÈDE le § 1 ci-dessus**, dont le tableau décrit l'état du matin.

## 1bis. L'état en une page

| Quoi | Où | État |
|---|---|---|
| `origin/dev` | — | `09acc6b` — **#390, #391 et #392 sont mergées** (report d'état, tunnel natif ①→⑦ + jumeau web, build de développement + D82 gravée) |
| **PR #393** | `feat/payments-redirect-server` | D82 7A/8A/9A en entier (+40 tests). **18/18, MERGEABLE, CLEAN** — il ne manque que le merge |
| **PR #394** | `feat/mobile-shipment-tracker` | **A221 — « Mon envoi » : le suivi natif, ses quatre gestes, le jumeau web aligné.** Empilée sur #393 |
| Décision gravée | registre v1.3 | **A221** (arbitrage). La prochaine DÉCISION reste **D83** |
| Tests | — | **1342** + auth **407** — **inchangés** : A221 ne touche aucun code serveur |

**Ordre de merge : #393 → #394.** Le diff de #394 se réduit dès que #393 est dans `dev`.
C'est l'utilisateur qui merge.

## 2bis. Ce que fait A221, en cinq lignes

Le tunnel natif se terminait sur une impasse : sa confirmation menait à l'onglet **Activité**,
qui est une coquille. `app/shipment/[id]` donne enfin la fiche de suivi — dix vues pour neuf
statuts, le code de livraison en carte unique, la frise, les étapes du voyage, les preuves
photo, l'argent (autorisé / débité / gelé / rendu / retenu), et **quatre gestes** : annuler
(préviz ANN-01 servie), régénérer le code, partager le code par la feuille de l'OS, confirmer
la réception. L'écran reflète `allowedActions` et relit après chaque geste.

Le site, lui, gagne ce que le natif a rendu visible : le **montant réellement remboursé** et
les **motifs de refus**, qui étaient servis par le contrat et que `BookingStatusNotice` ne
lisait pas (il renvoyait l'Expéditeur à sa boîte mail).

## 3bis. Ce qui reste à faire, et par qui

### Côté utilisateur — INCHANGÉ, et toujours non fait (vérifié dans le `.env` racine)

Aucun des six gestes du § 4 ci-dessus n'a été posé. Mesuré : ni
`EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`, ni `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, ni
`STRIPE_WEBHOOK_SECRET`, ni `PAYMENT_PROVIDER` ; et `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` est
toujours là alors que `.env.example` la déclare **RETIRÉE**. Conséquences inchangées : aucune
feuille réelle, `POST /webhooks/stripe` répond **501**, et la recette Expo Go répond
`UNAVAILABLE` faute de `PAYMENT_PROVIDER=fake`.

### Côté code — la suite immédiate, dans cet ordre

1. **Signaler un problème** et **noter le Voyageur** en natif : deux formulaires, deux écrans,
   comme sur le site (`/bookings/:id/report`, `/bookings/:id/rate`). Aujourd'hui **rien ne les
   annonce** à l'écran (A203) — mais un Expéditeur dont le colis arrive abîmé n'a donc aucun
   recours dans l'app pendant les trois jours de vérification. C'est le trou le plus urgent.
2. **La liste « Mes envois »** dans l'onglet Activité (`GET /me/bookings`, déjà servi ; le
   module web `components/dashboard/shipments/` est le jumeau et il est complet). La fiche
   ayant été livrée d'abord, chaque ligne aura une destination.
3. **Un report d'état** `chore/etat-394` : `YAMBA-CONTEXT.md` et `YAMBA-SUIVI-PROJET.md` sont
   en retard de **quatre lots** (#391, #392, #393, #394) — la ligne du jalon 4 s'arrête à
   #388 et annonce encore « restent les écrans ② à ⑦ », qui sont faits. **Volontairement pas
   fait ici** : un report d'état sur du travail non mergé est un report faux.

## 4bis. Axes non demandés, nés de ce lot

1. **Le contrat ne sert plus la raison du poids facturé.** D81 (17/10) a cessé d'écrire
   `sizeCoef` et `minimumApplied` ; ils restent au `ShipperPricingSchema` et valent donc
   `null` sur toute réservation récente. Ce qui les remplace — `billingFloorKg`, `sizeMinKg`,
   `billableReason` — **n'est servi par aucune des deux vues**. Le tunnel explique « facturé
   2 kg, le minimum de ce trajet » ; la fiche de suivi, elle, ne peut que constater l'écart.
   Correction au mappeur + au contrat + `npm run generate:openapi`.
2. **Le lien de suivi du destinataire (D69) rend un CHEMIN, pas une URL.**
   `POST /deals/:id/tracking-link` répond `path: "/track/{token}"` : seul un navigateur peut
   le compléter. Le geste est donc absent de l'app, et aucune variable ne porte l'origine
   publique du site. **Candidat D83** : que le serveur serve une URL absolue.
3. **Le mobile n'a aucun client de requêtes.** La fiche relit à la main (`load()`), sans cache
   partagé ni invalidation croisée avec les badges d'onglets. Dès que la liste « Mes envois »
   existera, deux écrans liront le même deal sans se synchroniser. À trancher **avant** la
   liste, pas après.
4. **Rien ne se rafraîchit tout seul.** Un colis qui bouge pendant qu'on regarde l'écran exige
   un appui sur « Actualiser ». Un rafraîchissement au retour au premier plan et à la reprise
   de focus coûterait peu. Et le vrai canal pour « ton Voyageur a accepté » reste la
   **notification push**, toujours à ⬜ au jalon 4.
5. **L'axe 2 du matin a pris du poids** : `apps/mobile` n'a toujours aucun test, et ce lot
   vient d'ajouter **267 lignes de logique pure** (`shipment-view.ts`) écrites exprès pour être
   exécutables. Phase, frise, décomptes, clôture, état de l'argent : tout y est à entrée
   unique. Le harnais manquant coûte maintenant plus cher que son installation.

## 5bis. Deux pièges d'outillage à ne pas repayer

1. **Le lexique i18n refuse le mot `carrier` dans une VALEUR de message — nom de variable ICU
   compris.** `{carrier}` échoue sur la règle 6 (`scripts/lexique-yamba.json`), `{carrierFirstName}`
   passe. C'est la raison d'être de cette verbosité côté web depuis A144.
2. **`.expo/types/router.d.ts` est généré et non suivi** : une route neuve y est absente
   jusqu'à ce que Metro tourne, donc le typecheck **local** est rouge là où la CI — qui n'a
   jamais ce fichier — passe. `cd apps/mobile && npx expo customize tsconfig.json` régénère les
   types **sans démarrer Metro** (vérifié : le `tsconfig.json` suivi n'est pas modifié).
   Vérifié aussi dans l'autre sens : le code de ce lot passe **avec et sans** les types générés.

## 6bis. Ce qui n'a pas été essayé

**La fiche n'a pas tourné sur appareil** : la machine (MBP 2017, 16 Go) ne peut pas lancer
Metro et la pile de services en même temps. Les contrôles passés sont les typechecks (mobile
et user-ui, exit 0), le miroir i18n, et une vérification clé par clé des **60 chemins i18n
construits à l'exécution**. La recette se fait avec `seed-deals.ts`, qui donne un envoi dans
chaque état et pose le code réel `742891` sur chaque réservation post-pickup.
