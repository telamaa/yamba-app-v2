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
