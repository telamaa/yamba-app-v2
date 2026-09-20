# Handoff — 19/09/2026 · le chantier mobile roule : cinq lots livrés, la page trajet en prochain GO

*Ce document sert à REPRENDRE le chantier après une pause. Il dit où en est le dépôt, ce qui a été
décidé, ce qui reste, et les pièges payés qu'il ne faut pas repayer. Il remplace, comme point d'entrée,
le handoff du 18/09 — qui reste la mémoire de la passe cahiers et de la méthode de vérification des
écarts.*

---

## 1. L'état du dépôt, en une ligne

**Tout est dans `dev`. Zéro PR ouverte.** `dev` = `c6b4db9`, CI **verte** (18 checks COMPTÉS sur
chacune des dix PR du jour — le 18e est « TypeScript (fiches de test) », ajouté le 18/09).

| Repère | Valeur |
|---|---|
| PR mergées | #1 → **#377** (le 19/09 : dix PR — cinq lots mobile, chacun suivi de sa PR d'état) |
| Tests | trip **310** · deal 659 · notification 122 · message 79 · auth **406** — **1576** au total. Inchangés depuis A201 (#370) : les lots onglets et recherche n'ont touché que `apps/mobile` et les docs |
| Registre | D1 → **D79** · arbitrages A1 → **A204** (le jour : A201, A202, A203, A204) |
| Apprentissage | chapitres **201 → 205** (un par lot mobile) |
| Schéma Prisma | **inchangé** depuis le 16/09 |
| Jalon 4 mobile | **25 %** — socle, session, i18n, onglets, recherche |

---

## 2. Le chantier mobile — les cinq lots du 19/09, et où tout se trouve

| Lot | PR | Arbitrage | En une ligne |
|---|---|---|---|
| Socle Expo SDK 57 | #368 | — | scaffold pur puis identité Yamba, workspace Nx, `src/env.d.ts` suivi (TS2882) |
| Session par jetons | #370 | **A201** | `x-token-delivery: body` opt-in strict serveur ; client SecureStore, refresh vol unique + breaker 30 s |
| i18n | #372 | **A202** | use-intl (le moteur du web), ordre D44 compte > appareil, contrôle CI étendu au mobile ; PAS de `metro.config.js` (sticky resolution Expo 57) |
| Onglets natifs | #374 | **A203** | `NativeTabs` plein-app (5 onglets), porte d'identité A58/A63, badges serveur, session en contexte partagé |
| Recherche | #376 | **A204** | MÊME endpoint que le web (`GET /trips/search`), stats comptées serveur d'office, `x-correlation-id` émis par le client |

L'app (`apps/mobile/src/`) : `app/_layout.tsx` (pile racine : `(tabs)` + `login` en modale, providers
Intl + Session) · `app/(tabs)/` (les cinq écrans + `_layout.tsx` de la barre) · `lib/session-context.tsx`
(UN amorçage, état `loading`/`anonymous`/`authenticated`) · `lib/api/` (client Bearer + corrélation,
`auth.api.ts`, `search.api.ts`) · `hooks/use-tab-badges.ts` · `components/identity-gate.tsx`,
`trip-result-card.tsx` · `i18n/` + `messages/{fr,en}/{auth,home,tabs,search}.json`.

Règles métier mobiles : **RG-MOB-1 → 16** et fiches **MOB1 → MOB25** dans `YAMBA-DOC-METIER.md`.
Le détail de chaque lot : les cinq dernières sections de `YAMBA-DOC-TECHNIQUE.md`, les entrées
« 19/09 (suite…) » de `YAMBA-CONTEXT.md`, et les lignes A201-A204 du registre.

---

## 3. Ce qui reste

### (a) Le prochain GO — la page trajet (proposé, PAS encore accordé)

Périmètre proposé en fin de session : navigation depuis la carte de résultat (aujourd'hui NON cliquable
à dessein), fiche complète — photos, tarifs par catégorie ou €/kg, conditions par famille (D14), profil
du Voyageur — et s'arrêter AVANT le wizard de réservation. **À instruire à ce moment-là** (noté au
chapitre 205) : `recordTripView` et son dédoublonnage `viewerKey(userId, ip, user-agent)` — un visiteur
mobile anonyme derrière CGNAT comptera plus large que sur le web.

### (b) La recette téléphone — en attente, voulue par l'utilisateur

« Je ferai le test plus tard » (19/09). Le cahier : **MOB14-19** (onglets, portes, badges, thème) et
**MOB20-25** (recherche — elle marche SANS compte, c'est le cas nominal). Procédure au § 4.

### (c) La suite du jalon 4, après la page trajet

Réservation (Stripe Payment Sheet), push (`expo-notifications` ↔ notification-service — lot
majoritairement serveur), deep links, `expo-dev-client` + EAS Build, budgets de perf (Maestro).
D73 : Android publié d'abord, iOS testé tôt via Expo Go (mémoire du 19/09).

### (d) L'inchangé (hors chantier mobile)

1. **Hors dépôt** : « Restrict unsigned URLs » chez ImageKit (en attente depuis le 17/09) ; sauvegardes
   Atlas. Derniers restes du Jalon 2.
2. **`chore/deps` dédiée** : `npm audit` est à **18** (mesuré 18/09) — les vrais fixes non-majeurs :
   `nodemailer` 9.0.3 → 9.1.1, `morgan` → 1.12, `svgo` transitif. JAMAIS `npm audit fix --force`
   (le « fix » Nx est une rétrogradation, même piège qu'`imagekit`).
3. Le ménage des mocks `$transaction` restants (A200 garde l'essentiel) ; le contrôle CI « clé i18n
   orpheline » (à arbitrer AVANT d'écrire une ligne) ; `ANO-WEB-43` (mineure, ouverte).

---

## 4. Le poste — tester l'app sur un téléphone

Rien n'a tourné aujourd'hui : la journée était code + preuves de bundle, les services n'ont pas été
démarrés. Pour la recette téléphone :

```sh
open -a Docker && docker start yamba-redpanda yamba-mailpit   # Mailpit sur 8026, PAS 8025
# les six services (bundles détachés — reconstruire d'abord si les sources ont bougé) :
#   procédure complète dans le handoff du 18/09, § 4 — inchangée
npx nx start @yamba-app/mobile     # Metro ; scanner le QR avec Expo Go (iPhone OK, D73)
```

- Le téléphone et le Mac sur le MÊME Wi-Fi ; la base URL API est DÉRIVÉE du `hostUri` de Metro
  (`http://<ip-du-mac>:8080/api`) — **le gateway :8080 doit tourner**, aucune config à écrire.
- La recherche est publique : elle marche sans compte. Pour les portes/badges : un compte du
  `seed-deals.ts` (QA reset) — les demandes PENDING et non-lus du seed nourrissent les pastilles.
- Les scripts npm mobile portent `NODE_PATH=./node_modules` (fix `df3191d`) : `expo start` mort à
  froid sans lui — passer par `npx nx start @yamba-app/mobile` ou les scripts, pas un `expo start` nu.

---

## 5. Pièges payés le 19/09 — ne pas les repayer

- **Hermes stocke les chaînes ACCENTUÉES en UTF-16** : un `grep` UTF-8 sur le `.hbc` les compte **0**
  (« Ville de départ » : 0, « kg dispo » : 1 — même bundle). Les preuves du lot A203 étaient justes
  PAR CHANCE (marqueurs sans accent). Toute preuve de bundle sur du texte FR cherche LES DEUX
  encodages : `data.count(s.encode('utf-16-le')) + data.count(s.encode('utf-8'))` — et garde un
  témoin FAUX attendu à 0.
- **`git checkout -- <fichier>` ne restaure pas un fichier jamais commité.** Une contre-épreuve CI qui
  mute un fichier NON SUIVI s'engage à le réécrire à la main. Le réflexe : `git add` AVANT de muter
  (la restauration lit l'index).
- **L'API `NativeTabs` se vérifie dans le paquet INSTALLÉ** (`node_modules/expo-router/build/
  native-tabs/*.d.ts`) : le chemin d'import dit `unstable-`, la doc en ligne décrit un autre SDK.
  Même réflexe que le chapitre 201.
- **Le narrowing TS ne traverse pas une constante booléenne** : `const ok = x != null` puis `f(x)`
  garde `x` nullable — capturer la VALEUR (`const v = x != null ? x : null`), pas le verdict.
- **`ReactNode` s'importe de `react`**, pas de `react-native` (TS2305).
- **`expo export` sert son CACHE** même quand la config change : toute contre-épreuve de bundle passe
  par `--clear` (payé le 18/09 au lot i18n, revérifié aujourd'hui).
- **Un axe « à brancher » peut être déjà branché** : l'axe stats du lot recherche s'est réglé en ZÉRO
  ligne — `recordSearch` était déjà dans le contrôleur. Vérifier dans le code AVANT de coder : la
  bonne livraison était un constat consigné (RG-MOB-14), pas du code.

---

## 6. Par où reprendre

1. `git checkout dev && git pull` — puis lire ce fichier ; au besoin, les entrées « 19/09 » de
   `context/YAMBA-CONTEXT.md` et le § 6bis de `context/YAMBA-SUIVI-PROJET.md`.
2. **Deux chemins, au choix de l'utilisateur** (les deux étaient sur la table en fin de session) :
   la **recette téléphone** (§ 4 — MOB14-25) d'abord, ou le **GO page trajet** (§ 3 a). Le lot page
   trajet n'attend que le GO : périmètre proposé, pièges instruits, l'API publique existe.
3. La minute hors dépôt (ImageKit « Restrict unsigned URLs ») est TOUJOURS en attente — § 3 d.
