# Handoff — reprise du 18/10/2026 (quatrième arrêt machine) et instruction PAIEMENTS

> Prend la suite de `YAMBA-CONTEXT-HANDOFF-2026-10-17.md`. Ce fichier remplace le précédent
> comme « état exact du chantier » : c'est lui qu'il faut lire en premier à la reprise.

## 1. L'état en une page

| Quoi | Où | État |
|---|---|---|
| Branche de travail | `feat/booking-parcel-card` | **24 commits** au-dessus de `origin/dev`, **poussée** (0 commit local en avance) |
| `origin/dev` | — | `750d52f` (merge de la PR #389) |
| **PR #391** | `feat/booking-parcel-card` → `dev` | **Ouverte, prête (pas brouillon), 18/18 contrôles verts COMPTÉS.** Le tunnel natif ① → ⑦ + le jumeau web (A217 → A220). **À merger — c'est toi qui merges** |
| **PR #390** | `chore/etat-389` → `dev` | **Ouverte, 18/18 vertes.** Report d'état des neuf lots #381 → #389. **À merger** |
| Dernière décision gravée | registre v1.3 | **D81** (poids facturé, 17/10) → la prochaine entrée est **D82** |

Aucune autre PR ouverte. Le tunnel de réservation est **complet de l'écran ① à l'écran ⑦**
(demande réelle au bout), la procédure « une page à la fois » du handoff précédent (§ 8) est
donc arrivée à son terme pour ce parcours.

## 2. Ce que le quatrième arrêt machine a laissé — et ce que j'ai réparé

Le Mac s'est arrêté dans la soirée du 18/10. **Rien n'a été perdu** : la branche était poussée
avant l'arrêt. Deux traces seulement, et une seule était un défaut :

1. **Frappe parasite dans un fichier source — CORRIGÉE.**
   `apps/notification-service/src/consumer/booking-events.consumer.ts` portait `});claud`
   ligne 128 (fichier modifié à 21 h 48 : cinq caractères tombés dans l'éditeur, pas du code).
   C'était une **erreur de syntaxe TypeScript** dans l'arbre de travail.
   Retirée ; `npx nx typecheck notification-service --skip-sync` → **vert**.
   *Note d'outillage* : `git checkout -- <fichier>` a été **refusé** par le garde-fou
   « destruction locale » du mode auto — la correction est passée par une édition ciblée.
   À savoir pour les prochaines reprises après crash : ne pas compter sur `checkout --`.

2. **`expo-dev-client` installé mais non commité — DÉCISION EN ATTENTE (voir § 4).**
   `apps/mobile/package.json` **+1 ligne** (`"expo-dev-client": "~57.0.20"`) et
   `package-lock.json` **+81 lignes**, écrits à 15 h 23 le 18/10. Le paquet est présent dans
   `node_modules/` **à la racine** (correctement dédupliqué, rien sous `apps/mobile/node_modules/`),
   et **référencé nulle part** : ni dans `app.json`, ni dans une source, ni dans un README.
   Ce n'est pas un accident — c'est le premier pas du chantier paiement (§ 3).

**Arbre de travail à la reprise** : ces deux fichiers modifiés, plus les non-suivis habituels
et VOULUS (`apps/*/AGENTS.md`, `apps/*/CLAUDE.md`, `apps/e2e/resultats-*/`, `.expo/`).
Rappel : **jamais de `git add apps/<app>` nu** (payé deux fois le 19/09) — pathspecs explicites.

## 3. L'instruction du 18/10 : les paiements en condition de production

**Demande, mot pour mot** : traiter les paiements **maintenant en condition de prod, pas du
fake** — **CB, Klarna, PayPal**, plus **Apple Pay sur iOS** et **Google Pay sur Android**.

### 3.1 Ce qui est déjà en place (mesuré dans le code, 18/10)

| Point | Référence | État |
|---|---|---|
| Autorisation en capture manuelle | `packages/libs/payments/src/index.ts:195` | `capture_method: "manual"` — débit à l'acceptation (D31) |
| Moyens de paiement ouverts | `packages/libs/payments/src/index.ts:196` | `automatic_payment_methods: { enabled: true }` — **c'est le Dashboard Stripe qui pilote la liste**, Stripe filtre seul les moyens incompatibles avec la capture manuelle |
| Version d'API Stripe | `packages/libs/payments/src/index.ts:187` | `2026-03-25.dahlia` |
| Reversement au Voyageur | `packages/libs/payments/src/index.ts:~239` | `transfers.create` + `destination` = **charges et transferts SÉPARÉS** |
| `on_behalf_of` | — | **absent du dépôt** (vérifié) |
| Payment Element (web) | `apps/user-ui/src/components/booking/steps/StepPayment.tsx` | `@stripe/react-stripe-js` ^6.3.0, `stripe` ^21.0.1 (racine) |
| PaymentSheet (mobile) | `apps/mobile/src/lib/stripe-sheet.ts` | `@stripe/stripe-react-native` 0.64.0, chargé en `require` paresseux derrière une porte `UNAVAILABLE` |
| Schéma d'URL de retour | `apps/mobile/app.json:8` + `stripe-sheet.ts` | `"scheme": "yamba"`, `returnURL: 'yamba://booking/payment'` **déjà posé** |
| Webhook Stripe | `apps/deal-service/src/controllers/stripe-webhook.controller.ts` (120 l.) | Traite `payment_intent.canceled`, `payment_intent.amount_capturable_updated`, `account.updated`, `transfer.reversed`, `payout.failed` |
| Création de l'intention | `apps/deal-service/src/routes/deal.routes.ts:75` | `POST /deals/payment-intents` |
| Fenêtre d'acceptation | `apps/deal-service/src/services/booking-request.ts:205` | **`ACCEPTANCE_WINDOW_HOURS = 24`** (DEA-01) |

**Deux de ces lignes décident de tout le chantier** :

- **Le modèle d'argent est le BON par chance autant que par design.** PayPal **ne prend pas en
  charge `on_behalf_of`** sur Connect. Yamba utilise les charges et transferts *séparés*
  (`transfers.create` avec `destination`), sans `on_behalf_of` : PayPal passe. Si le projet
  avait choisi les *destination charges*, **PayPal serait impossible**. À graver dans D82
  comme une contrainte, pas comme un détail d'implémentation.
- **La fenêtre de 24 h tient sous toutes les durées de rétention d'empreinte** : carte ~7 j,
  PayPal 3 j honorés, Klarna **28 j**. Aucun moyen ne se périme avant la capture.

### 3.2 Ce que la documentation Stripe confirme (vérifié le 18/10, pas de mémoire)

Table « Prise en charge de l'API » — colonnes *PaymentIntents | SetupIntents | **Capture
manuelle** | utilisation future | Redirection requise* :

| Moyen | Capture manuelle | Payment Element | Mobile Payment Element | Connect | Remboursements |
|---|---|---|---|---|---|
| Carte | ✓ | ✓ | ✓ | ✓ | ✓ |
| Apple Pay / Google Pay | ✓ (rails carte) | ✓ | ✓ | ✓ | ✓ |
| **Klarna** (`klarna`) | **✓** | ✓ | **✓** | ✓ | ✓ |
| **PayPal** (`paypal`) | **✓** | ✓ | **✓** | ✓ (**sans `on_behalf_of`**) | ✓ |

- **Klarna, pays d'entreprise éligibles** : AU, AT, BE, CA, FI, **FR**, DE, CH — la France y est,
  en EUR. Devises Klarna : AUD, CAD, CHF, CZK, DKK, **EUR**, GBP, NOK, NZD, PLN, RON, SEK, USD.
- **PayPal** : EUR ✓, pays d'entreprise européens dont FR.
- **Klarna ET PayPal exigent une REDIRECTION** (colonne « Redirection requise : Oui »).
- **Une autorisation Klarna meurt à 28 jours** si elle n'est pas capturée.

Sources : [Prise en charge des moyens de paiement](https://docs.stripe.com/payments/payment-methods/payment-method-support) ·
[Poser une empreinte](https://docs.stripe.com/payments/place-a-hold-on-a-payment-method) ·
[Accepter un paiement Klarna](https://docs.stripe.com/payments/klarna/accept-a-payment) ·
[Klarna](https://docs.stripe.com/payments/klarna)

### 3.3 Les quatre obstacles — **un seul est du code**

**① Les comptes. Je ne peux pas les faire à ta place.**
Activer Klarna et PayPal au Dashboard Stripe ; créer un **merchant ID Apple** + le certificat
Apple Pay (**compte développeur Apple requis, 99 $/an**) ; activer Google Pay. En mode *live* :
entreprise vérifiée chez Stripe, versements Connect ouverts, et validation Klarna/PayPal par
leurs équipes (compter plusieurs jours).

**② Expo Go ne saura jamais faire ça.**
PaymentSheet, Apple Pay et Google Pay sont **natifs**. Il faut un **build de développement** —
c'est précisément pourquoi `expo-dev-client` a été installé le 18/10 à 15 h 23. Le Mac est
bloqué pour les builds iOS locaux (mémoire du 19/09) → **EAS cloud**.
Manquent encore dans `stripe-sheet.ts` : `merchantIdentifier` (Apple Pay), les blocs de
configuration `applePay` et `googlePay` de `initPaymentSheet`, et le **plugin de configuration
Stripe dans `app.json`**. `allowsDelayedPaymentMethods: false` est à réexaminer.

**③ La redirection casse l'ordre actuel des gestes — LE seul vrai chantier d'architecture.**
Ordre d'aujourd'hui (imposé par A45 et D31) : photos chez ImageKit → **autorisation
synchrone** → `POST /deals`. Avec Klarna ou PayPal, **l'utilisateur quitte l'app ou la page
entre l'étape 2 et l'étape 3**. Conséquences mesurées :
- côté web, `redirect: "if_required"` (`StepPayment.tsx:139`) **échouera par construction** sur
  ces deux moyens, qui redirigent toujours ;
- côté mobile, le brouillon vit en **mémoire de processus** (`apps/mobile/src/lib/booking-draft.ts`,
  propriété VOULUE : « le brouillon meurt avec le processus ») ; côté web il vit en état React.
  Partir vers Klarna et revenir peut le perdre ;
- l'intention peut n'atteindre `requires_capture` **qu'après** le retour : la création de la
  réservation ne peut plus supposer la synchronicité. Le webhook
  `payment_intent.amount_capturable_updated` n'est aujourd'hui qu'un **accusé simple** — c'est
  lui qui devra porter « l'empreinte est réellement posée ». `payment_intent.payment_failed`
  n'est pas traité.

**④ Rien n'est déployé — ça bloque les wallets WEB, pas les wallets MOBILE.**
Apple Pay sur le web exige un **domaine HTTPS vérifié auprès d'Apple** : sur `localhost`, le
bouton **ne s'affichera jamais**. Apple Pay et Google Pay **dans l'app** n'exigent aucun
domaine. **Conclusion : le seul chemin réellement ouvert aujourd'hui est le mobile.**

### 3.4 Ce que je proposais — à graver en **D82** AVANT tout code

Le cœur de D82 est l'obstacle ③, et il a deux réponses :

- **(i) garder l'ordre, rendre le brouillon durable** — persister le brouillon et reprendre le
  tunnel au retour de redirection. Changement contenu, A45/D31 intacts. Risque assumé : un
  utilisateur qui ne revient jamais laisse une **empreinte orpheline sans réservation** — déjà
  rattrapée, puisque `payment_intent.canceled` est traité par le webhook.
- **(ii) créer le Booking en PENDING d'abord, autoriser ensuite, le webhook confirme** — plus
  propre, mais casse A45/D31 (« pas de réservation sans empreinte posée ») et touche la machine
  à états (16 transitions).

**Recommandation : (i)**, et **garder `automatic_payment_methods` tel quel** : le Dashboard
pilote la liste, Stripe filtre seul les moyens incompatibles avec la capture manuelle →
**zéro ligne de code** pour ajouter Klarna ou PayPal une fois activés au Dashboard.

**Challenge d'expert dû (non demandé)** : **Klarna sur Yamba, c'est du crédit fractionné pour un
colis à 11 €.** Le mécanisme fonctionne, mais la valeur est quasi nulle sous 30 € — elle
n'apparaît que sur le long-courrier (le Paris-Libreville à 80,64 € de D81). Ça ne change rien à
la faisabilité : c'est à savoir **avant** d'y mettre de l'effort de recette.

### 3.5 **Les deux questions restées SANS RÉPONSE** — à trancher à la reprise

Elles ont été posées le 18/10, **tu n'as répondu ni à l'une ni à l'autre** (pause demandée
avant) :

1. **« En condition de prod » = vrai argent, ou mode TEST Stripe avec les vraies feuilles ?**
   En mode test, les **vraies** feuilles Klarna / PayPal / Apple Pay / Google Pay s'ouvrent avec
   les comptes de démonstration Stripe : parcours intégralement réel, aucun euro ne bouge, et
   **ni entreprise vérifiée ni Connect ouvert ne sont exigés**. Le mode *live* demande tout ça,
   plus la validation Klarna/PayPal. *Troisième voie proposée : cadrer D82 pour que le passage
   en live ne soit QU'UN CHANGEMENT DE CLÉS.*
2. **Sur quel appareil on ouvre la première vraie feuille ?**
   **Android via EAS** (carte + Klarna + PayPal + Google Pay ; aucun compte Apple, aucun
   certificat, ~20 min de build ; et « Android publié d'abord » est déjà acté en D73) —
   **iOS via EAS** (ton iPhone, seul endroit où Apple Pay existe, mais compte développeur Apple
   + merchant ID + certificat d'abord) — **les deux, Android en premier** — ou **le web d'abord**
   (carte, Klarna et PayPal sur localhost ; Apple Pay et Google Pay **impossibles**, cf. ④).

## 4. La décision en attente sur `expo-dev-client`

Les deux fichiers modifiés (`apps/mobile/package.json`, `package-lock.json`) sont **laissés en
l'état dans l'arbre**, volontairement — ils n'ont été ni commités ni annulés. Trois issues :

- **le garder** → il va dans une PR **`chore/deps` DÉDIÉE**, jamais dans une PR de fonctionnalité
  (règle du dépôt), et on le câble (plugin Stripe dans `app.json`, profil EAS) ;
- **le retirer** → si la recette passe par le fournisseur Fake en Expo Go, il n'a rien à faire
  au manifeste tant qu'il n'est câblé nulle part ;
- **ne rien décider** → il reste modifié dans l'arbre, sans gêner (il n'est importé par rien).

L'issue dépend entièrement de la réponse à la question 2 du § 3.5.

## 5. L'ordre de reprise conseillé

1. **Merger #391 puis #390** (c'est toi qui merges) — après quoi `origin/dev` porte le tunnel
   complet ① → ⑦ et le report d'état des neuf lots.
2. **Répondre aux deux questions du § 3.5.**
3. **Rédiger D82 au registre** (`YAMBA-REGISTRE-DECISIONS-ROADMAP-v1.3.md`) — décision AVANT
   code, règle non négociable du dépôt.
4. Puis seulement : le code, dans l'ordre imposé par les réponses (plugin Stripe + `app.json`,
   `merchantIdentifier` / `applePay` / `googlePay`, la durabilité du brouillon, le `return_url`
   web et sa page de reprise, le webhook promu de l'accusé simple à la vérité d'empreinte).
5. Dette documentaire du lot paiement : les **trois cumulatifs**, en **AJOUT SEUL** (0 suppression,
   vérifié au `numstat` — jamais de `Write` sur `DOC-TECHNIQUE` / `DOC-METIER` / `APPRENTISSAGE-DEV`).

**Non fait volontairement** : `YAMBA-CONTEXT.md` et `YAMBA-SUIVI-PROJET.md` n'ont pas été
touchés — l'état *fait / reste à faire* n'a pas bougé cette session (aucune PR mergée), et le
report d'état est précisément l'objet de la **PR #390** déjà ouverte.

## 6. Le poste (inchangé depuis le 17/10)

- Metro : `npx nx start @yamba-app/mobile` — **jamais** un `expo start` nu.
- `apps/mobile/.expo/types/router.d.ts` est **généré** par Metro : un aller-retour de branche
  peut le régénérer sans les routes `booking/` → typecheck rouge sur un `router.push` pourtant
  juste. Réparation : lancer Metro une fois.
- **Machine contrainte** (MBP 2017, 16 Go) : ne pas lancer les six services par réflexe.
  Pour un parcours de réservation : gateway + auth + trip + deal.
- `.env` **RACINE uniquement**. `PAYMENT_PROVIDER=fake` est ce qui rend le tunnel essayable en
  Expo Go aujourd'hui (A220) ; le chantier du § 3 consiste précisément à ne plus en dépendre.
- Captures = canal design, `context/captures/` **non versionné**.

## 7. Journal de la session du 18→19/10

| # | Action | Résultat |
|---|---|---|
| 0 | Diagnostic de reprise après le quatrième arrêt machine | **Rien perdu** : branche poussée, 24 commits au-dessus de `dev`, #391 et #390 ouvertes et vertes |
| 1 | Frappe parasite `});claud` dans `booking-events.consumer.ts` | **Corrigée** ; `nx typecheck notification-service` **vert**. `git checkout --` refusé par le garde-fou « destruction locale » → édition ciblée |
| 2 | `gh pr checks 391` et `gh pr checks 390` | **18/18 vertes chacune, COMPTÉES** (pas seulement « vertes à l'œil ») |
| 3 | `expo-dev-client` trouvé installé, non commité, câblé nulle part | Laissé en l'état ; décision portée au § 4, suspendue à la question 2 du § 3.5 |
| 4 | **Instruction paiements** reçue (CB, Klarna, PayPal, Apple Pay iOS, Google Pay Android, en condition de prod) | Inventaire du code existant (§ 3.1) + **vérification en documentation Stripe** (§ 3.2), pas de mémoire |
| 5 | Analyse rendue : les quatre obstacles, dont **un seul de code** | **D82** proposée avec deux options et une recommandation (§ 3.4). **Aucun code écrit** — la décision précède le code |
| 6 | Pause demandée | Ce handoff. **Deux questions ouvertes** en attente (§ 3.5) |
