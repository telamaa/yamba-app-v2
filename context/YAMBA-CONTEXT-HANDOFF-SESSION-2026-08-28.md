# YAMBA — HANDOFF DE SESSION · 28–29 août 2026
### De PR-B (formulaire pricing) à la release `main` — 9 PR mergées, historique réécrit, moteur de prix unifié

> À lire avec : `YAMBA-REGISTRE-DECISIONS-ROADMAP-v1.3.md` (D1–D38), `YAMBA-MOTEUR-PRIX.md` (logique métier du prix, .md + .pdf), les fiches `context/fiches-pr/*/` (technique + métier par PR), `YAMBA-CONTEXT.md` (fait / reste).

---

## 1. État à la fin de la session

- **`main` = `dev` = `9c6e155`** — release des PR #48 → #88 (workflow livraison, B1, OpenAPI/CI, pricing PER_KG A/B/C, recherche au kilo).
- **Historique réécrit** (filter-branch, exécuté par l'utilisateur) : 101 emails `egoiomab.com` → `egoiomab@gmail.com`, 2 trailers `Co-Authored-By: Claude` supprimés. Contenu identique, SHA changés. Tout autre clone : `git fetch && git reset --hard origin/dev`. À faire par l'utilisateur : remettre les protections (`dev`, `main`), supprimer les ~60 anciennes branches distantes mergées (commande dans le message de fin de session).
- **Plateforme de tests : 433** (trip-service 187 · deal-service 225 · notification-service 21) · tsc ×6 · i18n FR/EN miroir · **build de production OK** (57 pages).
- Branche locale : `dev`. Une PR docs ouverte à merger : `chore/docs-release-2026-08-28` (ce handoff + `YAMBA-MOTEUR-PRIX.md/.pdf` + note release dans `YAMBA-CONTEXT.md`).

## 2. Les PR de la journée (ordre de merge)

| PR | Branche | Contenu |
|---|---|---|
| #78 | `chore/next-intl-config-path` | Nx ne calculait plus le graphe : chemin next-intl résolu depuis `process.cwd()` (Turbopack refuse l'absolu) → chemin relatif au cwd |
| #79 | `chore/docs-context` | `context/` versionné (registre, spec, règles métier, handoffs, mockup, fiches PR) + `CLAUDE.md` gouvernance/CI/architecture. Règle : `context/` est le canal de communication, présent sur toutes les branches ; captures d'écran jamais versionnées (`context/**/captures/` ignoré) |
| #80 | `chore/theme-provider-root` | Erreur React 19 « script tag » à chaque bascule FR/EN : `ThemeProvider` (next-themes) monté dans le layout `[locale]` remonté côté client → déplacé dans le root layout |
| #81 | `chore/prod-build-suspense` | **Le build prod échouait** (`useSearchParams` sans `<Suspense>` sur 4 pages) — invisible en dev et en CI. Proposition : `next build` en check requis |
| #82 | `feat/pricing-front-2` = **PR-B** | Formulaire Voyageur « dépôt en 90 s » : prix/capacité pré-remplis (D15 explicable, délai inversé côté offre), familles Accepté/Refusé + supplément (Lucide, accordéons, popovers en portal), bagages suspendus si capacité insuffisante (RG-B-29), D20 (plus d'« instantané »), autocomplétion villes/aéroports « Ville, Pays », page trajet propriétaire (Modifier), prix au kilo affiché en recherche/détail. Serveur : `POST /trips` **perdait les 5 champs PER_KG** (trajet publié à 0 €) → `pickPerKgFields` + gate A28 sur les 3 chemins ; `acceptedCategories` = legacy seulement ; `checkBagCapacity` ; updates par paquets ≤ 40 champs (**Atlas : pipeline > 50 étapes**). **D31** (gate Stripe à l'acceptation) et **D32** (plancher 0,5 kg / 8 €) gravés |
| #83 | `feat/search-per-kg` | **D33** comparabilité (colis de référence 2 kg, `comparablePriceCents` + backfill), filtre par **famille** (le filtre catégorie cachait les trajets au kilo), poids du colis (prix par carte, tri en mémoire, exclusion capacité), sidebar sticky CSS (plus de retard au scroll), page trajet `OfferCard` (l'offre était invisible), CO₂ pour le poids (était l'émission d'1 kg), annulation alignée **ANN-01** (l'ancien texte promettait 50 %/0 % hors registre), suggestion par **corridor** (15 zones + domestique), D32 annoncée à l'écran, régression « 5 comptés / 4 affichés » (mapper qui rejetait un trajet sans `arrivalAt`) |
| #84 | `chore/docs-post-merge-83` | numéros de PR, baseline 396 → 426 |
| #85 | `feat/pricing-front-3` = **PR-C** | **D34 `@packages/pricing`** : moteur de prix Expéditeur unique, pur, partagé front/serveur (7 specs) ; wizard sur le **vrai trajet**, garde d'identité CNF-05, étape 1 (produit, famille, poids pré-rempli, S/M/L), récap COM-03 avec minimum D32 et indice au lieu de 0 €, téléphone destinataire en premier avec indicatif → E.164, « Garantie Yamba » (GAR-02), titre + stepper sur une ligne, Stripe chargé à l'étape 4 seulement, mobile (libellés, dégagement barre basse) |
| #86 | `chore/docs-post-merge-85` | #85 reporté, baseline 433 |
| #87 / #88 | `release/dev-to-main` | Release : `main` portait #46 + revert partiel #47 → merge « ours » (arbre = dev) ; puis remplacement de `main` par `dev` après réécriture |

## 3. Décisions gravées aujourd'hui (registre)

- **D31** — gate Stripe/profil de la publication → l'acceptation (reporté depuis PR-A, jamais écrit).
- **D32** — plancher par colis : poids facturable min 0,5 kg ET 8 € (le plus élevé), paramètres §13, affiché partout.
- **D33** — comparabilité : colis de référence 2 kg ; V2 : le poids saisi remplace la référence.
- **D34** — un seul moteur de prix Expéditeur (`@packages/pricing`), devis conçu pour être figé tel quel (D17).
- Compléments A28 : catégories = legacy seulement ; RG-B-29 forfait ⇒ capacité.
- Candidats notés (non gravés) : « la CI construit ce qu'elle déploie » (`next build` requis) ; règle de couleur des CTA (mango = avancer, teal = engager) ; PR « paramètres serveur » (`GET /pricing/params`).

## 4. Règles de travail apprises (mémoire persistante)

1. **Aucune attribution Claude** : jamais de trailer, `git log --format=%b | grep -i co-authored` vide avant toute PR. Emails valides : `telamaa.root@gmail.com`, `egoiomab@gmail.com`.
2. **Deux fiches par PR** dans `context/fiches-pr/<PR>/` : technique (niveau junior, le pourquoi) + métier (besoin, règles de gestion numérotées, recette).
3. **`context/` toujours présent** sur le disque et toutes les branches ; les captures ne se commitent jamais.
4. Charte §3.4 : mango = actif/avancer, teal = accepter/argent, slate = neutre/refus ; jamais de rouge/ambre/bleu « info » ; icônes Lucide, jamais d'emoji.
5. Mobile-first à chaque écran (cibles ≥ 44 px, popovers au tap, accordéons non montés fermés).
6. Le mockup fixe la structure, la charte fixe les couleurs ; « une règle qu'on ne dit pas à l'écran est une surprise à la réservation ».

## 5. Pièges techniques rencontrés (déjà dans `CLAUDE.md` ou les fiches)

- next-intl résout depuis `process.cwd()` ; `@nx/next` évalue la config depuis la racine ; Turbopack refuse l'absolu.
- `apps/user-ui/tsconfig.json` **redéfinit `paths`** : un alias ajouté à `tsconfig.base.json` n'y arrive pas (ajouter + `include`).
- Atlas tiers partagés : pipeline ≤ 50 étapes ; Prisma émet un `$set` par champ avec des types composites → écrire par paquets.
- `space-y-*` + enfant masqué par classe `hidden` = marge fantôme sur le suivant.
- Un `{/* commentaire */}` entre `(` et le premier élément d'une expression `&&` casse le build.
- Tailwind ne génère pas les classes dynamiques (`w-${n}`) — chaînes littérales.
- `AggregateError at internalConnectMultiple` sur la gateway = ECONNREFUSED vers un service en redémarrage ; Docker/Redpanda éteint = bruit Kafka attendu, pas une panne.
- `git cherry-pick -q` n'existe pas ; `git stash push -- <paths>` ignore les fichiers non suivis ; `-X ours` ne protège pas des suppressions non conflictuelles → `-s ours` quand l'arbre cible doit être gardé tel quel.
- Ce que les facettes comptent, la liste doit pouvoir l'afficher (mapper tolérant).

## 6. Avis d'expert donnés et non encore implémentés (backlog UX)

- **Step 1 création de trajet** : aéroport choisi comme ville → ville de rattachement + lieu de pickup (« Orly → Amsterdam » doit dire « Paris (Orly) »), arrivée repliée par défaut, justificatif déplacé en étape 3 (« Boostez votre annonce »), autocomplétion avec drapeaux.
- **Création de trajet, lieux** : 4 grosses cartes → chips (Aéroport / Gare / En ville) + aperçu public *sticky* à droite sur ≥ 1 280 px (colonne centrée 768 px, jamais pleine largeur).
- **Recherche** : filtres « Horaires de départ » toujours commentés ; i18n « messages par route » (100 Ko de payload RSC à chaque navigation).
- **Page trajet** : carte propriétaire avec vues / demandes reçues.
- **Réservation** (B2) : un seul système de paiement (Payment Element, `payment_method_types: card`, nos radios disparaissent) ; ligne « Minimum par colis appliqué » dans le récapitulatif final ; IPID/conditions de la Garantie.
- Cleanup post-refonte : legacy PER_CATEGORY (`CategoryChip`, `PriceInput`, `RevenueBadge`, `CATEGORY_GROUPS`, champs `@deprecated`), `instantBooking` (champ, filtre API, facette).

## 7. Prochaine étape — B2 « argent entrant »

`POST /deals` (deal-service) : valider `draft + quote` en recalculant avec `quoteShipperPrice` et **refuser toute divergence** (D17/D34) ; écrire `BookingPricingSnapshot` (contrat à enrichir des champs du devis : `billableWeightKg`, `sizeCoef`, `familySurchargePct`, `minimumApplied`, `serviceCents`), `BookingRecipientSnapshot` (téléphone E.164 déjà normalisé par le front) ; **`reservedKg` incrémenté atomiquement dans la même transaction Mongo que l'outbox** (CAP-01) ; PaymentIntent (autorisation → capture à l'acceptation) via `PaymentProvider` abstrait (D11) ; accept/decline (gate Stripe/profil à l'acceptation — D31) ; cron expiration 24 h ; remboursements ANN-04 ; emails transactionnels. Lire `docs/SPECIFICATIONS-WORKFLOW-BOOKING-YAMBA.md` §2.2, le handoff PR-C §5 et `YAMBA-MOTEUR-PRIX.md`.

### Prompt d'ouverture prêt-à-coller
```
On reprend Yamba — lis d'abord context/YAMBA-CONTEXT-HANDOFF-SESSION-2026-08-28.md,
context/YAMBA-MOTEUR-PRIX.md, le registre (D1–D34) et docs/SPECIFICATIONS-WORKFLOW-BOOKING-YAMBA.md §2.2.
Vérifications : dev = main = 9c6e155, plateforme 433, context/ présent, aucun trailer Claude.
⭐ B2 — argent entrant : POST /deals avec snapshot D17 par @packages/pricing (refus de divergence),
reservedKg atomique + outbox en transaction, PaymentIntent autorisation→capture, PaymentProvider (D11),
accept/decline avec gate Stripe à l'acceptation (D31), expiration 24 h. Un seul système de paiement Stripe.
Rituel : inventaire AVANT le code, décisions au registre AVANT le code, deux fiches par PR, mobile-first,
aucune attribution Claude, charte mango/teal/slate.
```


---

# ADDENDUM · 29 août 2026 — docs cumulatifs, jalons mobile, B2-PR1

## A. État à la fin de la session du 29/08

- `origin/dev` = `8519296` (inchangé depuis #89). **Trois branches à merger, dans cet ordre** :
  1. `chore/docs-jalons-mobile` — D36 (Expo/RN natif exigeant), jalons 4/5 dans `YAMBA-CONTEXT.md` + `YAMBA-SUIVI-PROJET.md`. *N'était pas mergée* contrairement à ce qui avait été compris.
  2. `chore/docs-cumulatifs` (contient 1 par merge) — `YAMBA-DOC-TECHNIQUE.md`, `YAMBA-DOC-METIER.md`, **`YAMBA-APPRENTISSAGE-DEV.md`** (16 chapitres) + règle dans `CLAUDE.md`.
  3. `feat/b2-deal-request` (basée sur 2) — **B2-PR1**, commit `db8bf24`.
- **Plateforme de tests : 457** (trip 187 · deal 249 · notification 21) · tsc ×7 · i18n miroir · build prod OK · aucun trailer.
- Nouvelle règle d'équipe (mémoire + `CLAUDE.md`) : à chaque PR, **compléter** les 3 docs cumulatifs — jamais de nouveau fichier ; `fiches-pr/` est une archive gelée.

## B. B2-PR1 — ce qui existe maintenant

- **D37** : demande en deux appels — `POST /deals/payment-intents` (devis serveur = `@packages/pricing`, 409 `QUOTE_DIVERGENCE` si ≠ total vu, autorisation capture manuelle) puis `POST /deals` (re-vérification totale, transaction Mongo : `reservedKg` conditionnel + Booking PENDING + 2 outbox). **D38** : `@packages/payments` (`PaymentProvider` Stripe + Fake, factory env, Fake refusé en production) — pas de payment-service :6008. A29 (catégorie legacy ← famille), A30 (un seul Payment Element).
- Schéma : `BookingPricingSnapshot` + 7 champs D34 (optionnels), `BookingPlaceSnapshot` (`pickupPlace`/`deliveryPlace`), `Booking.paymentProvider`. Contrats : `booking-request.schema.ts`. Mapper : vues Shipper/Carrier exposent les nouveaux champs.
- Front : `services/booking.api.ts` (réel), `components/booking/useBookingCheckout.ts` (hook partagé desktop/mobile), `steps/StepPayment.tsx` (Payment Element seul, mode test FAKE), `DRAFT_VERSION` 5 (plus de `paymentMethod`), `step4.errors.*` FR/EN.
- Prouvé de bout en bout sur Atlas + Stripe test (script non versionné) : 409 divergence → PI 29,57 € → 409 avant confirmation → 201 PENDING, `reservedKg 0 → 2`, 2 outbox → rejeu 409 `PAYMENT_ALREADY_USED`. Nettoyé ensuite.
- Docs complétées : registre (D37, D38, §2bis.4 A29–A30), `YAMBA-CONTEXT.md`, `YAMBA-SUIVI-PROJET.md`, les 3 cumulatifs (RG-D-01…14, chapitres 17–22).

## C. À faire par l'utilisateur

- `.env` : `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_…` (le serveur a déjà `STRIPE_SECRET_KEY` → provider STRIPE ; sans clé publiable l'étape 4 affiche « paiement indisponible »). Carte test `4242 4242 4242 4242`.
- Merger les 3 branches dans l'ordre ci-dessus (13 checks à compter). Protections `dev`/`main` et purge des anciennes branches toujours en attente.

## D. Prochaine étape — B2-PR2 « accepter, refuser, expirer »

`POST /deals/:id/accept` (charte cochée ; **gate Stripe/profil déplacé ici — D31**, retirer les 2 checks des 3 chemins de publication trip-service ; `provider.capture` ; `acceptedAt` ; outbox `booking.accepted`) · `POST /deals/:id/decline` (raison parmi 5 ; `provider.cancel` ; kg restitués CAP-02 ; `booking.declined` + `booking.refund_issued`) · cron expiration 24 h (deal-service, `status: PENDING, expiresAt < now` → EXPIRED, cancel, kg) · annulation Expéditeur ANN-01 (matrice) · **webhook Stripe** (`payment_intent.canceled/amount_capturable_updated`) comme source de vérité · tests : state machine déjà couverte, ajouter les effets (capture/cancel via Fake). Toutes les transitions passent par `booking-state-machine.ts` (jamais dans un controller). Décisions à graver avant le code : moment exact de la capture (à l'acceptation vs J-1 départ), politique d'annulation post-acceptation (`CANCEL_LATE_RETENTION_PCT`).

### Prompt d'ouverture prêt-à-coller
```
On reprend Yamba — lis context/YAMBA-CONTEXT-HANDOFF-SESSION-2026-08-28.md (addendum 29/08),
context/YAMBA-CONTEXT.md, le registre (D1–D38, §2bis.4) et docs/SPECIFICATIONS-WORKFLOW-BOOKING-YAMBA.md §2.2.
Vérifications : origin/dev contient jalons mobile + docs cumulatifs + B2-PR1 ; plateforme 457 ; aucun trailer.
⭐ B2-PR2 : accept (capture + gate D31 déplacé) / decline (cancel + CAP-02) / cron expiration 24 h /
annulation ANN-01 / webhook Stripe — via booking-state-machine, outbox en transaction, PaymentProvider Fake en tests.
Rituel : inventaire AVANT le code, décisions au registre AVANT le code, compléter les 3 docs cumulatifs
(technique, métier, apprentissage), mobile-first, aucune attribution Claude, charte mango/teal/slate.
```

---

# ADDENDUM · 1er septembre 2026 — pause en cours de session (clés Stripe à aligner, 5 lots à merger)

## A. État exact au moment de la pause

- **`origin/dev` = `8519296` (#89) — RIEN n'a été mergé depuis.** Tout le travail B2 est empilé sur des branches poussées, arbre propre partout.
- Branche courante : **`feat/b2-deal-front` = `53cb0f4`**, synchronisée avec origin.
- **Pile de merge, dans cet ordre (5 PR à ouvrir/merger)** :
  1. `chore/docs-jalons-mobile` — D36, jalons 4/5.
  2. `chore/docs-cumulatifs` (`daa3551`) — les 3 docs cumulatifs + règle CLAUDE.md.
  3. `feat/b2-deal-request` (`33393f1`) — **B2-PR1** (D37/D38, POST /deals + payment-intents, @packages/payments).
  4. `feat/b2-deal-lifecycle` (`21379a3`) — **B2-PR2** (`396dec9` : accept/decline/cancel, capture à l'acceptation D39, gate D31 déplacé, cron 24 h, webhook Stripe D40) + 2 fix front (timeline étape 4, erreurs Payment Element).
  5. `feat/b2-deal-front` (`53cb0f4`) — **B2-PR3** (É2 branché accept/decline réels A32/A13, CTA par `allowedActions`, annulation Expéditrice + préviz ANN-01 servie A31, seed CarrierPage + `pi_fake_seed_*` A33).
- **Plateforme de tests : 507** (457 baseline → +46 B2-PR2 → +4 B2-PR3). Docs cumulatifs, registre (jusqu'à D40), `YAMBA-CONTEXT.md` et `YAMBA-SUIVI-PROJET.md` à jour dans les branches.
- ⚠️ `gh` n'est pas authentifié dans le terminal (`gh auth login` requis) — les PR peuvent aussi être ouvertes via l'interface GitHub.

## B. 🔴 Problème en cours — Payment Element ne charge pas (clés Stripe de DEUX comptes)

**Symptôme** (étape 4 du wizard) : `The client_secret provided does not match any associated PaymentIntent on this account…` — le front affiche le message générique + Réessayer (comportement du fix `21379a3`), la vraie cause est dans la console.

**Cause diagnostiquée** : les deux clés Stripe appartiennent à des comptes différents (le préfixe après `51` identifie le compte) :
- `.env` racine (serveur) : `STRIPE_SECRET_KEY = sk_test_51THXnv…` → le PaymentIntent est créé sur CE compte.
- `apps/user-ui/.env.local` (front) : `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = pk_test_51SMmbN…` → le Payment Element cherche le PI sur CET autre compte.

**Fix (à faire par l'utilisateur, non encore appliqué)** :
1. Dashboard Stripe du compte de la clé secrète (`51THXnv…`, celui qui porte l'onboarding Connect) → Developers → API keys (mode test).
2. Copier la **Publishable key** `pk_test_51THXnv…` dans `apps/user-ui/.env.local`.
3. **Redémarrer `user-ui`** (les `NEXT_PUBLIC_*` sont inlinées au démarrage — un refresh ne suffit pas).
4. Alternative si c'est le compte `51SMmbN…` qu'on veut garder : remplacer la clé secrète racine et redémarrer deal-service — mais les PI et comptes Connect de test du compte `51THXnv…` deviennent invisibles.

## C. Prochaine étape à la reprise

1. Corriger les clés Stripe (B) et re-tester le paiement de bout en bout (carte `4242 4242 4242 4242`).
2. Merger les 5 lots dans l'ordre (A) — 13 checks à COMPTER par PR ; protections `dev`/`main` et purge des vieilles branches toujours en attente.
3. **B2 reste** (🔴 suivi §) : emails transactionnels `booking.*` (notification-service, colonne email de la matrice A15), tracker Expéditeur `/bookings/[id]` → `GET /deals/:id` (vues É3→É9, avec B3), photos (media-service :6009), code livraison chiffré AES-256-GCM.

### Prompt d'ouverture prêt-à-coller
```
On reprend Yamba — lis context/YAMBA-CONTEXT-HANDOFF-SESSION-2026-08-28.md (addendum 01/09),
context/YAMBA-CONTEXT.md, le registre (D1–D40) et context/YAMBA-SUIVI-PROJET.md.
État : origin/dev = #89, 5 lots poussés à merger dans l'ordre (jalons mobile, docs cumulatifs,
B2-PR1 feat/b2-deal-request, B2-PR2 feat/b2-deal-lifecycle, B2-PR3 feat/b2-deal-front) ; plateforme 507.
D'abord : vérifier le fix des clés Stripe (pk/sk du même compte, addendum §B) et tester le paiement ;
puis les merges ; puis ⭐ B2 reste : emails transactionnels booking.* (matrice A15) + tracker Expéditeur.
Rituel : inventaire AVANT le code, décisions au registre AVANT le code, compléter les 3 docs cumulatifs,
mobile-first, aucune attribution Claude, charte mango/teal/slate.
```

---

# ADDENDUM · 1er septembre 2026 (soir) — session soldée : A34 + merge #90

## A. Ce qui s'est passé à la reprise

1. **Clés Stripe alignées** (pk/sk du même compte `51THXnv…`) — mais le premier
   paiement réel a alors révélé DEUX bugs (toast GENERIC après carte autorisée,
   PI `requires_capture` orphelin, aucune écriture) :
   - contrat plus strict que le wizard (`recipient.email` exigé vs « (optionnel) »
     spec É1 ; `description` min 10 vs min 5) → 400 Zod sans `details.code` ;
   - faux `CAPACITY_EXCEEDED` sur les Trips pré-B2-PR1 (champ `reservedKg` ABSENT
     des documents Mongo — le `updateMany` conditionnel CAP-01 ne matche pas ;
     `isSet` refusé sur champ non-nullable et `NOT:{gt}` inopérant, tous deux prouvés).
2. **Fix A34** (commit `f973499`) : contrat aligné (email nullish, min 5), snapshot
   Prisma `email String?`, front envoie null, `backfill-reserved-kg.ts` (27 trajets,
   idempotent, À REJOUER par environnement), helper `capacityReservationWhere`,
   OAS régénérés, +4 tests → **plateforme 511** (trip 187 · deal 303 · notif 21).
   Preuve e2e : 201 PENDING avec email vide, kg restitués, PI annulé.
3. **Merge** : la pile ENTIÈRE est passée en UNE PR — **#90**
   (`feat/b2-deal-front` → `dev`, 13 checks verts comptés). `dev` = `800edb9`.
   Les 5 branches de la pile sont mergées → purge possible.

## B. État exact à la pause (01/09 soir) et reprise

- Branche courante : **`chore/docs-post-merge-90`** (= `dev` + le commit docs
  post-merge), poussée, arbre propre. `gh` toujours non authentifié.
- **1. À merger d'abord — la mini-PR docs post-merge** (ce fichier + suivi + contexte) :
  https://github.com/telamaa/yamba-app-v2/compare/dev...chore/docs-post-merge-90
  (13 checks à compter, comme toujours).
- **2. Purge des branches mergées** (contenu PROUVÉ dans dev, `git merge-base
  --is-ancestor` vérifié) : `chore/docs-jalons-mobile`, `chore/docs-cumulatifs`,
  `feat/b2-deal-request`, `feat/b2-deal-lifecycle`, `feat/b2-deal-front` —
  décision en suspens : étendre ou non aux vieilles branches pré-release 28/08
  (`backup-carrier-onboarding*`, `feat/auth-pages-redesign`, …).
- **3. ⭐ B2 reste** : emails transactionnels `booking.*` (notification-service,
  colonne email de la matrice A15), tracker Expéditeur `/bookings/[id]` →
  `GET /deals/:id` (vues É3→É9, avec B3), photos (media-service :6009),
  code livraison AES-256-GCM. Toujours en attente : protections `dev`/`main`.
- Rappel A34 : `backfill-reserved-kg.ts` est à REJOUER sur tout nouvel
  environnement dont des Trips prédatent B2-PR1 (déjà fait sur le dev Atlas).

### Prompt d'ouverture prêt-à-coller
```
On reprend Yamba — lis context/YAMBA-CONTEXT-HANDOFF-SESSION-2026-08-28.md (addendum 01/09 soir, §B),
context/YAMBA-CONTEXT.md, le registre (D1–D40, A1–A34) et context/YAMBA-SUIVI-PROJET.md.
État : dev = 800edb9 (#90, toute la pile B2 mergée, 13 checks comptés), plateforme 511,
paiement Stripe réel prouvé e2e ; branche chore/docs-post-merge-90 poussée, PR docs À OUVRIR/MERGER.
D'abord : merger la mini-PR docs post-merge-90, puis purge des 5 branches de la pile ;
puis ⭐ B2 reste : emails transactionnels booking.* (matrice A15, notification-service) + tracker
Expéditeur /bookings/[id] → GET /deals/:id. Rituel : inventaire AVANT le code, décisions au
registre AVANT le code, compléter les 3 docs cumulatifs, mobile-first, aucune attribution Claude.
```

---

# ADDENDUM · 1er septembre 2026 (nuit) — B2 SOLDÉ (#91 → #93)

## A. Ce qui s'est passé dans la session

1. **#91 mergée** — la mini-PR docs post-merge-90 (13 checks comptés) ; `gh` ré-authentifié (device flow).
2. **Purge exécutée** : les 5 branches de la pile B2 supprimées (origin + local), ancrage `git merge-base --is-ancestor` vérifié AVANT. Les vieilles branches pré-release 28/08 (`backup-carrier-onboarding*`, …) sont toujours là — décision d'étendre la purge toujours en suspens.
3. **#92 — B2-PR4 emails transactionnels `booking.*`** : D41 (canal email du MÊME consumer + `@packages/email`, 3e clone évité), A35 (matrice email reconstituée et gravée EN DATA — le « handoff PR3 §4 » qui la portait n'était pas versionné), A36 (at-most-once par destinataire, `EmailDelivery` claim-first, best-effort). 8 gabarits EJS FR/EN testés en RENDU réel. `npx prisma db push` fait (collection + index uniques). Plateforme **511 → 540** (notification 21 → 50).
4. **#93 — B2-PR5 tracker Expéditeur** : `/bookings/[id]` → `GET /deals/:id` par un adapter CONSERVATIF (A37 — view-model existant produit, ~40 fichiers de vues intacts), TanStack Query, fin du fallback menteur (`BookingStatusNotice`), dégradations honnêtes (stats B5 / carte Stripe / code AES : lignes masquées, jamais inventées), mocks de données supprimés. Preuves : tsc + build prod + script adapter 25 assertions (pas de Jest user-ui).

## B. État exact et reprise

- `dev` = `33a6889` (#93) · plateforme **540** (trip 187 · deal 303 · notification 50) · registre D1→D41, A1→A37 · aucun trailer.
- **B2 EST SOLDÉ.** Restes rattachés à B3 : photos du colis (media-service :6009), ré-affichage code AES-256-GCM (`deliveryCodeEncrypted`), bascule des 3 actions mock du tracker (régénérer/confirmer/litige) et des 4 actions mock carrier (pickup/refuse/tracking/deliver), gabarits emails des événements B3+ (chacun avec son writer — A35), `SiteConfig.commissionRate` (A11/D16).
- Toujours en attente (hors code) : protections `dev`/`main` ; purge des vieilles branches pré-release ; check requis `next build` (candidat).
- ⭐ **Prochaine étape — B3 transport** : pickup serveur (upload R2, code bcrypt + AES, checklist conformité), refuse, tracking events, deliver (compare + lock), régénération de code — writers outbox EN TRANSACTION, transitions par la machine, emails `picked_up`/`pickup_refused`/`code_regenerated`/`delivered` dans les MÊMES PR que leurs writers (A35), bascule des mocks front des deux côtés (tracker É4b→É9 déjà branché en lecture).

### Prompt d'ouverture prêt-à-coller
```
On reprend Yamba — lis context/YAMBA-CONTEXT-HANDOFF-SESSION-2026-08-28.md (addendum 01/09 nuit),
context/YAMBA-CONTEXT.md, le registre (D1–D41, A1–A37) et context/YAMBA-SUIVI-PROJET.md.
État : dev = 33a6889 (#93), B2 SOLDÉ (#90 pile + #92 emails + #93 tracker), plateforme 540.
⭐ B3 transport : pickup serveur (R2, code bcrypt + AES deliveryCodeEncrypted, checklist), refuse,
tracking, deliver (compare + lock), régénération — machine d'état seule autorité, outbox en
transaction, emails B3 avec leurs writers (A35), bascule des mocks front (carrier + tracker).
Rituel : inventaire AVANT le code, décisions au registre AVANT le code, compléter les 3 docs
cumulatifs, mobile-first, aucune attribution Claude.
```

---

# ADDENDUM · 2 septembre 2026 — B3-PR1 transport serveur (D42/D43, A38–A42)

## A. Ce qui s'est passé dans la session

1. **Inventaire complet** avant code : la machine d'états portait déjà `pickup/refusePickup/deliver` + `canRegenerateCode/canConfirmTrackingStep`, les 17 événements du contrat existaient, `EMAIL_MATRIX`/`IN_APP_MATRIX` connaissaient les clés B3 ; l'infra d'upload existante est **ImageKit** (signature courte `GET /api/uploads/imagekit-auth` + upload direct navigateur, hook `useImageKitUpload`) — aucun R2 ni media-service n'existe.
2. **Décisions gravées AVANT le code** : D42 (photos via ImageKit, URLs seules côté serveur, checklist figée), D43 (bcrypt + AES-256-GCM `deliveryCodeEncrypted`, clé d'env, lib `@packages/delivery-code`), A38 (compteur serveur, verrou 15 min + remise à zéro, écriture conditionnelle), A39 (undo client seul), A40 (refus = remboursement intégral sans pénalité), A41 (4 emails B3 → Expéditeur, garde-fou 6 chiffres), A42 (annexe : `CarrierPage.primaryAddressId` plus @unique — bloquait le seed ET tout 2e Voyageur sans adresse).
3. **Code** : contrats `booking-transport.schema.ts`, schéma (3 champs + A42, `prisma db push` fait), `packages/libs/delivery-code`, `booking-write.ts` (extrait de deal-lifecycle, `where` optionnel), `deal-transport.service.ts` (5 writers), controller + routes + OAS (5 opérations), mapper (`deliveryCode` en paramètre, checklist, `pickupRefusalReason`), `getDeal` révèle via `revealDeliveryCode` (Shipper, PICKED_UP, jamais en liste), 4 gabarits EJS, seed avec `742891`.
4. **Preuves** : plateforme **540 → 600** (deal 354, notif 59) ; tsc ×6 ; OAS régénérés ; **e2e Atlas 33 vérifications vertes** (script scratchpad, deal-service bundle en FAKE via `node --env-file`) ; probe outbox : bons événements, zéro code dans les payloads, `reservedKg` 8 → 5 ; seed rejoué ensuite.
5. **Pièges payés** : alias `@packages/*` à déclarer AUSSI dans `webpack.config.js` (tsc vert, `nx serve` « Module not found ») ; `nx serve` écrase les variables de la ligne de commande (impossible de forcer FAKE) → lancer `dist/main.js` avec `node --env-file` ; sourcer `.env` en zsh corrompt `DATABASE_URL` → `npx tsx --env-file=.env` ; garde-fou « 6 chiffres » : exclure les couleurs CSS (`#334155`) par lookbehind.

## B. État exact et reprise

- Branche **`feat/b3-transport-server`** (base `dev` = `407cfa5`, #94). PR à ouvrir/merger (13 checks à COMPTER). Docs complétées : registre (D42, D43, §2bis.8 A38–A42, §7.1), `YAMBA-CONTEXT.md`, `YAMBA-SUIVI-PROJET.md`, les 3 cumulatifs (B3-PR1 : technique §1–11, métier RG-P-01…12 + recette P1–P14, chapitres 39–43), `CLAUDE.md` (baseline 600, lib, pièges), `.env.example` (`DELIVERY_CODE_ENCRYPTION_KEY`).
- **À faire par l'utilisateur** : générer une clé (`openssl rand -base64 32`) dans `.env` racine `DELIVERY_CODE_ENCRYPTION_KEY` (sinon clé de dev + avertissement — les codes seedés ont été chiffrés avec la clé de dev : après pose d'une vraie clé, REJOUER le seed) ; `npx prisma db push` sur tout autre environnement (A42) ; rejouer `seed-deals.ts` là où les bookings PICKED_UP prédatent B3 (sinon `DELIVERY_CODE_UNAVAILABLE` à la livraison).
- Le deal-service de l'utilisateur (:6003) n'était PAS lancé pendant la session (auth/trip/notif/gateway l'étaient) ; les événements outbox de l'e2e ont été rejoués par le seed (wipe), rien ne reste à relayer.
- ⭐ **Prochaine étape — B3-PR2 front** : `deal.api.ts` (confirmPickup → upload ImageKit des `PickupPhotoDraft.file` via `useImageKitUpload("/deals/pickup")` puis `POST /deals/:id/pickup` avec les URLs ; refusePickup → `POST …/pickup/refuse` raison seule ; confirmTrackingEvent → `POST …/events` appelé À LA FIN de la fenêtre d'undo (déplacer l'appel du toggle vers le timer de `TrackingSpotlight`) ; validateDeliveryCode → `POST …/deliver`, plus de compteur client : lire `attemptsLeft`/`lockedUntil` des 409 et `deliveryAttemptsLeft`/`deliveryLockedUntil` de la vue), `DealClient` (DELIVERED = vue de succès persistante É7b plutôt que `DealClosed`), `booking-tracker.api.ts` (regenerateDeliveryCode → `POST …/code/regenerate`, puis `invalidateQueries` — le code vient de GET /deals/:id), adapter tracker (`deliveryCode.code` réel, `regeneratedCount` déjà mappé), i18n des nouveaux codes 409 FR/EN, mobile-first. Pas de Jest user-ui : preuve = tsc + build prod + parcours manuel sur seed (`742891`).

### Prompt d'ouverture prêt-à-coller
```
On reprend Yamba — lis context/YAMBA-CONTEXT-HANDOFF-SESSION-2026-08-28.md (addendum 02/09),
context/YAMBA-CONTEXT.md, le registre (D1–D43, A1–A42, §2bis.8) et context/YAMBA-SUIVI-PROJET.md.
État : feat/b3-transport-server = B3-PR1 (serveur transport complet, e2e prouvé, plateforme 600) —
vérifier son merge (13 checks comptés) ; DELIVERY_CODE_ENCRYPTION_KEY à poser + seed à rejouer.
⭐ B3-PR2 front : bascule des 4 mocks Voyageur (pickup avec upload ImageKit, refus, jalons après
undo, livraison à compteur serveur) + régénération Expéditeur réelle + code affiché, vue DELIVERED
Voyageur persistante. Rituel : inventaire AVANT le code, décisions au registre AVANT le code,
compléter les 3 docs cumulatifs, mobile-first, aucune attribution Claude, charte mango/teal/slate.
```

---

# ADDENDUM · 2 septembre 2026 (suite) — #95 mergée, B3-PR2 front (A43)

## A. Ce qui s'est passé

1. **#95 mergée** (`feat/b3-transport-server` → `dev` = `390eb57`, 13 checks comptés) — B3-PR1 serveur.
2. **B3-PR2 front** sur `feat/b3-transport-front` (A43 gravé AVANT le code) : `deal.api.ts` tout réel (+ `details` sur `DealApiError`, 5 codes transport), `DealPickupClient` (upload ImageKit séquentiel AVANT `POST …/pickup`, `errors.uploadFailed`/`dealChanged`), `PickupRefuseDialog` sans textarea (raison seule), `TrackingSpotlight.onEventCommittedAction` (appel à la fin de l'undo, rollback + toast sur échec), `DealDeliverClient` à compteur serveur (init depuis `deliveryAttemptsLeft`/`deliveryLockedUntil`, mise à jour depuis les `details` des 409, `error.codeUnavailable`/`dealChanged`), tracker : `regenerateDeliveryCode(bookingId)` réel + `invalidateQueries`, `deliveryCode.status` VALIDATED après livraison. Preuves : tsc user-ui, build prod, i18n miroir.
3. Docs complétées : registre (A43, §7.1 #95), contexte, suivi, 3 cumulatifs (B3-PR2 : technique, RG-P-13…17 + recette F1–F8, chapitre 44), ce handoff.

## B. Reprise

- **FAIT dans la session** : #96 mergée (13 checks comptés), `feat/b3-transport-server` et `feat/b3-transport-front` purgées (origin + local, ancrage vérifié) ; `dev` = `896faac`. **B3 SOLDÉ.**
- Toujours à faire par l'utilisateur : `DELIVERY_CODE_ENCRYPTION_KEY` dans `.env` + rejeu du seed ; `npx prisma db push` sur les autres environnements (A42) ; relancer son deal-service local (`npx nx serve deal-service` — il était éteint pendant la session) ; parcours manuel recette F1–F8 sur le seed (`742891`).
- ⭐ **Prochaine étape — B4 argent sortant** : `POST /deals/:id/confirm` (confirmation anticipée, définitive), cron J+4 (`status: DELIVERED, payoutDueAt <= now` → COMPLETED), `transfers.create()` vers le compte Connect du Voyageur (PaymentProvider : ajouter `transfer`), `POST /deals/:id/dispute` (DISPUTED, gel, ticket YAM-XXXX, photos ImageKit comme D42), matrice remboursements médiation (à graver), emails `completed`/`payout_sent`/`disputed` avec leurs writers (A35), bascule des mocks tracker `confirmDeliveryEarly`/`submitDispute`. Décisions à graver avant le code : moment du transfert (à COMPLETED — INV-2), retenue ANN-01 versée au Voyageur (D39), format et unicité du ticket, qui reçoit quoi quand un litige est ouvert.

### Prompt d'ouverture prêt-à-coller
```
On reprend Yamba — lis context/YAMBA-CONTEXT-HANDOFF-SESSION-2026-08-28.md (addenda 02/09),
context/YAMBA-CONTEXT.md, le registre (D1–D43, A1–A43, §2bis.8) et context/YAMBA-SUIVI-PROJET.md.
État : dev = 896faac (#96, B3 SOLDÉ : #95 serveur + #96 front), plateforme 600, branches purgées.
DELIVERY_CODE_ENCRYPTION_KEY à poser + seed à rejouer ; deal-service local à relancer.
⭐ B4 argent sortant : confirm anticipé, cron J+4 → COMPLETED + transfers.create() (PaymentProvider.transfer),
dispute (gel, ticket YAM-XXXX, photos ImageKit D42), emails completed/payout_sent/disputed (A35),
bascule des mocks tracker confirmer/litige. Rituel : inventaire AVANT le code, décisions au registre
AVANT le code, compléter les 3 docs cumulatifs, mobile-first, aucune attribution Claude.
```

---

# ADDENDUM · 2 septembre 2026 (soir) — recette à deux vrais comptes → B3-PR3 boîte du Voyageur (A44)

## A. Ce qui s'est passé
1. Recette utilisateur avec deux vrais comptes : étapes 1–3 OK (trajet, réservation Stripe test, acceptation). Étape 4 bloquée : **aucun chemin front vers `/carrier/deals/:id`** pour le Voyageur ; **aucun email** reçu ; bruit `KafkaJSNumberOfRetriesExceeded` dans deal/notification-service.
2. Diagnostic : (a) Docker n'était pas lancé → Redpanda absent → relay outbox et consumer down → ni in-app ni email (les événements attendent en base) ; (b) « Mes trajets » réel sans deals, vitrine à deals en mock, notifications non cliquables, `pendingDemandsCount` attendu par 3 composants et servi par personne.
3. **A44 gravé** puis B3-PR3 sur `feat/b3-carrier-inbox` : `GET /me/deals` + gateway + OAS ; `useMyDeals`, `my-deals.adapter.ts`, `TripDealRow` extrait du mock ; bande « À traiter » + deals sous chaque trajet + sous-titre dans `MyTripsList` ; accueil ; `useTripsBadge` (sidebar + barre mobile) ; `Notifications` = liens ; `TripDealsSection` sur la page trajet ; invalidation `["my-deals"]` après accept/decline/pickup/deliver ; i18n `list.subtitle`, `list.deals.*`. Docs : registre (A44, §7.1), contexte, suivi, 3 cumulatifs (B3-PR3, RG-P-18…22, chapitre 45).

## B. Reprise
- **FAIT** : #98 mergée (13 checks comptés), `feat/b3-carrier-inbox` purgée ; `dev` = `14dc301`. Le deal-service local de l'utilisateur doit être RELANCÉ (arrêté pendant la session — il porte maintenant `GET /me/deals`).
- **Utilisateur** : lancer Docker puis `docker compose up -d` (+ `./scripts/redpanda-bootstrap.sh` une fois) AVANT de reprendre la recette — les emails et notifications en dépendent ; puis recette V1–V9 (`YAMBA-DOC-METIER.md`) et F1–F8.
- Pistes UX notées, non faites : badge « Mes envois » (Expéditeur), « tout marquer lu », temps réel sur la boîte, RDV de pickup dans le modèle (heure sur la bande « prise en charge »).
- ⭐ Ensuite : B4 argent sortant (prompt de l'addendum précédent inchangé).

---

# ADDENDUM · 2 septembre 2026 (suite 2) — recette étape 4 → B3-PR4 page demande (A45)

## A. Ce qui s'est passé
Captures utilisateur sur `/carrier/deals/[id]` : (1) à ~900 px, aucune colonne Accepter/Refuser (`aside hidden lg:block` vs bascule mobile à 768) ; (2) pas de photos du colis — `createDeal` envoyait `photoUrls: []` depuis B2-PR1 ; (3) « Assurance basique » (GAR-02) et « téléphone après acceptation » (RGP-02) ; (4) « Voir profil » loguait en console. A45 gravé, B3-PR4 sur `feat/b3-deal-request-page` : upload ImageKit des photos déclarées AVANT la carte (`useBookingCheckout`), `createDeal(…, photoUrls)`, grille/aside dès `md`, libellés GAR-02/RGP-02 FR/EN (carrierDealRequest, bookingTracker, booking, home), `BookingCounterpart.publicSlug` + lien `/u/[slug]`, test mapper (+1 → deal 355, plateforme 601).

## B. Reprise
- **FAIT** : #100 mergée (13 checks comptés), branche purgée. Recette D1–D7 puis F/V à jouer par l'utilisateur.
- **Fix relay (A49)** : aucun email/notification en recette → relay `publishedAt: null` ne voit pas les champs ABSENTS (3e occurrence du pitfall) ; filtre OR + writers explicites, 38 orphelins parqués, **#109 mergée**. **À faire utilisateur** : copier `SMTP_*` de `apps/trip-service/.env` dans `.env` racine, relancer deal-service ET notification-service.
- **B3-PR6 (A48)** : recette F1 OK (2 photos) mais vignettes = pictogrammes → `components/shared/photos/{PhotoThumbs,PhotoLightbox}`, 10 vues remplacées (Voyageur + Expéditrice), `common.lightbox.*`. **#106 mergée**, branche purgée.
- **Fix ImageKit (A47)** : recette F1 → 500 sur `imagekit-auth` → paquet `imagekit@1.5.0` = SDK 2016 ; → 6.0.0 exact (racine + trip-service), d.ts maison supprimée, copie imbriquée dédupliquée, `uploadDetailed` + erreurs explicites, photos 10 Mo. **#104 mergée** — trip-service à relancer.
- **B3-PR5 (chore, A46)** : titres des 5 pages Deal ramenés à l'échelle du dashboard (22/17 px semibold), colonne d'action dès `md` sur accepté/pickup/tracking/deliver + squelette. **#102 mergée**, branche purgée.
- Pistes UX restantes sur É2 : stats de confiance (B5), galerie photos plein écran.
- Ensuite : B4 (prompt inchangé).

---

# ADDENDUM · 2 septembre 2026 (fin de journée) — SYNTHÈSE DE REPRISE (prime sur les addenda précédents du 02/09)

## A. État exact

- **`dev` = `3370efa` (#114)**, arbre propre, toutes les branches du jour purgées. `main` = `9c6e155` (#88) — release à faire un jour (pas urgent).
- **Plateforme de tests : 601** (trip 187 · deal 355 · notification 59) · tsc ×6 · i18n miroir · aucun trailer.
- Registre : D1→D43, arbitrages A1→A49 (§2bis.8). Docs cumulatifs à jour jusqu'à B3-PR6 + fixes (A47 ImageKit, A49 relay).
- **PR mergées aujourd'hui (13 checks comptés à chaque fois)** : #95 B3-PR1 serveur · #96 B3-PR2 front · #98 B3-PR3 boîte du Voyageur (A44) · #100 B3-PR4 page demande (A45) · #102 typographie Deal (A46) · #104 fix ImageKit SDK (A47) · #106 visionneuse photos (A48) · #109 fix relay outbox (A49) · #111 `allowedDevOrigins` (recette LAN) · #112 backlog messages d'inscription · #113 atterrissage post-OTP · #114 redirect conservé inscription → connexion · + les mini-PR docs (#97, #99, #101, #103, #105, #108, #110). **B3 SOLDÉ.**

## B. Recette réelle (deux vrais comptes, plusieurs postes en LAN) — où on en est

- **OK** : 1 → 3 (trajet, réservation Stripe test avec photos, acceptation), **F1** (prise en charge : 5/5 + 2 photos, upload ImageKit réel, code généré), photos visibles des deux côtés (visionneuse), emails reçus à chaque étape (nouvelle demande → Voyageur ; reçu, acceptation, « colis en route » → Expéditrice), notifications in-app cliquables, bande « À traiter » et deals dans Mes trajets, badge mobile.
- **À faire (l'utilisateur reprend ici)** : **F4** (jalon + Annuler sous 5 s : rien ne part) · **F5** (jalon confirmé : timeline Expéditrice + in-app, pas d'email) · **F6** (3 codes faux → verrou 15 min, persiste au rechargement) · **F7** (régénération Expéditrice → email « nouveau code », verrou levé ; ancien code refusé ; bon code → succès J+4, email « colis livré ») · puis D1–D7 (page demande, dont le test à 900 px) et V1–V9 (boîte du Voyageur). Grilles de recette : `YAMBA-DOC-METIER.md` (P, F, V, D).
- Deals réels en base au moment de la pause : `6a983c1899b9b5457e01f251` (PICKED_UP, 2 photos), `6a97da7083072671f271b057` (PICKED_UP, 2 photos), `6a97090dc356f11ec8493ac5` (ACCEPTED — matière pour un 2e parcours ou un refus au pickup F3, avec vrai remboursement Stripe).

## C. Environnement local — ce qui a changé aujourd'hui (à connaître avant de relancer quoi que ce soit)

- **Recette LAN** : `apps/user-ui/.env.local` pointe sur `http://192.168.1.155:8080/api` (lignes localhost commentées) → utiliser `http://192.168.1.155:3000` sur TOUS les postes, y compris le Mac (cookies liés à l'hôte). Pour revenir en local : réinverser les commentaires et relancer user-ui. `allowedDevOrigins` (réseaux privés) dans `next.config.js` (#111).
- **`.env` racine** : fins de ligne converties CR → LF (contenu identique) ; il contient bien les 6 `SMTP_*` (Gmail, mot de passe d'application avec espaces — toléré ; `SMTP_FROM_NAME` non lu, la lib prend son défaut). **`DELIVERY_CODE_ENCRYPTION_KEY` toujours absente** → clé de dev dérivée + avertissement : à poser (`openssl rand -base64 32`) puis rejouer le seed.
- **Docker** doit tourner (`docker compose up -d`) : sans Redpanda, ni in-app ni email. Le relay ne voyait AUCUN événement réel avant #109 (pitfall `null`/absent, 3e occurrence) : 31 événements orphelins parqués, tout est vert depuis.
- `imagekit@6.0.0` épinglé (le 1.5.0 était un SDK 2016) : `npm ls imagekit` doit dire « deduped ».
- Seed : `npx tsx --env-file=.env packages/libs/prisma/scripts/seed-deals.ts` (jamais `source .env`).
- Ne PAS lancer `nx build user-ui` pendant qu'un `nx dev user-ui` tourne (même dossier `.next`).

## D. Backlog ouvert aujourd'hui (non fait, volontairement)

- **Messages d'erreur explicites à l'inscription** (#112, suivi §7, mémoire) : nommer le critère fautif (prénom/nom/email dans le mot de passe…), codes serveur par règle, revue email déjà pris / téléphone / champs requis.
- Dettes D42 : URLs signées / fichiers privés ImageKit ; vérification du domaine des URLs photo. Rotation clé AES (format `v1.` prêt). Vue DELIVERED persistante Voyageur (spec §11). Badge « Mes envois », « tout marquer lu », temps réel boîte.
- Compression HEIC/photos côté client ; galerie plein écran = faite (A48).
- Toujours en attente hors code : protections `dev`/`main`, purge des vieilles branches pré-release, check requis `next build`, release `main`.

## E. ⭐ Prochaine étape — B4 argent sortant

`POST /deals/:id/confirm` (confirmation anticipée, définitive — INV-3), cron J+4 (`status: DELIVERED, payoutDueAt <= now` → COMPLETED), `transfers.create()` vers le compte Connect du Voyageur (`PaymentProvider.transfer` à ajouter, Fake inclus), `POST /deals/:id/dispute` (DISPUTED, gel du payout, ticket `YAM-XXXX`, photos ImageKit comme D42, description ≥ 50, pledge), matrice remboursements médiation (à graver), emails `completed` / `payout_sent` / `disputed` avec leurs writers (A35), bascule des mocks tracker `confirmDeliveryEarly` / `submitDispute`, vue COMPLETED des deux côtés. Décisions à graver AVANT le code : moment du transfert (à COMPLETED — INV-2), retenue ANN-01 versée au Voyageur (D39), unicité du ticket, destinataires des notifications de litige.

### Prompt d'ouverture prêt-à-coller
```
On reprend Yamba — lis context/YAMBA-CONTEXT-HANDOFF-SESSION-2026-08-28.md (addendum « fin de journée » 02/09,
il prime), context/YAMBA-CONTEXT.md, le registre (D1–D43, A1–A49, §2bis.8) et context/YAMBA-SUIVI-PROJET.md.
État : dev = 3370efa (#114), B3 SOLDÉ, plateforme 601, recette réelle OK jusqu'à F1 ; l'utilisateur joue F4→F7
puis D1–D7 et V1–V9 (remonter les écarts avant B4). Env : front en LAN (192.168.1.155), Docker requis,
DELIVERY_CODE_ENCRYPTION_KEY à poser + seed à rejouer.
⭐ B4 argent sortant : confirm anticipé, cron J+4 → COMPLETED + PaymentProvider.transfer, dispute (gel, ticket
YAM-XXXX, photos ImageKit D42), emails completed/payout_sent/disputed (A35), bascule des mocks tracker.
Rituel : inventaire AVANT le code, décisions au registre AVANT le code, compléter les 3 docs cumulatifs,
mobile-first, aucune attribution Claude, charte mango/teal/slate.
```

---

# ADDENDUM · 3 septembre 2026 (matin) — RETOURS DE RECETTE AUTH ET DÉCISIONS (prime sur l'addendum du 02/09 soir pour le backlog)

## A. Ce qui s'est passé

- L'utilisateur a remonté 12 retours de recette (inscription, connexion, OTP, emails, favoris, popup de réservation, Google). Diagnostic livré AVANT tout code, puis décisions utilisateur :
  **mode LAN conservé** (le « impossible de se reconnecter » = front sur `localhost:3000` avec l'API sur l'IP LAN → cookies `SameSite=Lax` jamais renvoyés, pas un bug de code) · **boutons Google / Facebook laissés tels quels** jusqu'à leur PR · **langue des emails** selon D44 en prévoyant **N langues** · **délais OTP** selon A50 · **tutoiement partout** et **prénom réel** dans les emails (D45) · backlog à prioriser, GO pour développer.
- PR **#116** `fix/auth-recette` (A50–A54, RG-A-01…05) : voir `YAMBA-DOC-TECHNIQUE.md` / `YAMBA-DOC-METIER.md` (sections « Fix recette auth »). 40 tests auth-service (dont 19 nouveaux), tsc ×5 Nx + user-ui OK, smoke test sur une instance `PORT=6011`.
- D44 (langue des emails, N langues, gabarit partagé) et D45 (tutoiement, prénom réel ; vocabulaire du rôle OUVERT) gravées au registre AVANT leur code.

## B. Ordre des PR suivantes (validé)
1. `fix/auth-recette` — **#116** (cette PR).
2. `feat/email-locale` — **FAIT, en PR** (D44 + D45 dans les emails, A55–A57 ; plateforme 610 + auth 59).
3. `feat/booking-auth-modal` — **FAIT, en PR** (A58 ; branchée sur `feat/email-locale`).
4. `feat/trip-favorites` — **FAIT, en PR** (D46, A59 ; trip-service 198).
5. `feat/auth-pages-ux` — **FAIT, en PR** (D45 pages auth, A60 : porte « Partager un trajet » en modale, demande utilisateur 03/09). Vocabulaire du rôle toujours ouvert.
6. `feat/auth-google` — **FAIT, en PR** (D47, A61). **Geste utilisateur** : créer l'ID client OAuth (Google Cloud → Identifiants → « Application Web », origines `http://localhost:3000` + IP LAN) et poser `GOOGLE_CLIENT_ID` + `NEXT_PUBLIC_GOOGLE_CLIENT_ID` dans `.env` / `apps/user-ui/.env.local`, puis recette J1–J8.
7. `feat/auth-gate-inline-login` — **FAIT, en PR** (A63 : formulaire de connexion dans la fenêtre, reprise du geste — demande utilisateur 03/09).
8. `chore/api-same-origin` — **FAIT, en PR** (D48, opt-in). **Backlog recette 03/09 SOLDÉ.**
9. `feat/follow-auth-gate` — **FAIT, mergée #125** (A64). Suivi #126.
10. **B4-PR1 `feat/b4-payout-server` — FAIT, mergée #127 (dev = 17a8d94)** (D49–D52, A65–A70). Décisions utilisateur du 03/09 après challenge métier/UX : 1A (litige « non livré » depuis PICKED_UP, **48 h** après le départ) · 2B (DISPUTED terminal, **chantier C lancé juste après B4**, pas de route admin jetable) · 3 (`source_transaction`) · 4A (retenue ANN-01 au prorata de la part nette, PR dédiée `feat/b4-late-cancel-payout`) · 5 à 10 oui (rappel J+3, confirmation en bouton secondaire, copie honnête 2–7 jours, état « versement en attente : finalise ton compte Stripe », catégorie du litige au Voyageur, aucun CTA « Noter » avant B5). **Méthode exigée par l'utilisateur : challenger chaque lot en expert métier et UX/UI et soumettre les points AVANT de coder.** `prisma db push` et seed rejoués (2 dossiers `Dispute`). Suite : PR2 puis PR3.
11. **B4-PR2 `feat/b4-shipper-front` — FAIT, mergée #129 (dev = 0878dd0)** (A71–A74). Décisions utilisateur 03/09 : 1A à 7A (confirmation secondaire + conseil · vraie vue « Envoi terminé », jamais d'échec de versement montré à l'Expéditeur · vue DISPUTED = dossier + 4 étapes + support · « Signaler » en transit visible mais désactivé avec la date SERVIE (`disputeOpensAt`) · même formulaire, motif « non livré » verrouillé · photos envoyées à la sélection · accès direct sans droit → retour au suivi). Question utilisateur « photos à la livraison ? » : le code prouve la remise, pas l'état → photo OPTIONNELLE côté Voyageur, à prévoir en PR3. Suite : **B4-PR3 front Voyageur** (boîte du Voyageur + page demande : états `payoutStatus` — en attente / parti le … 2–7 j / en échec avec CTA « finalise ton compte Stripe » / gelé —, `disputeCategory` calme, photo optionnelle à la remise dans le parcours de livraison, catégorie du litige) → `feat/b4-late-cancel-payout` (D50) → chantier C (admin, médiation).
12. **B4-PR3 `feat/b4-carrier-front` — FAIT, mergée #131 (dev = c8abbc9)** (A75–A78). Décisions utilisateur 03/09 : 1A vraies vues · 2A `payoutBlocker` servi (ACCOUNT_NOT_READY → CTA onboarding + bandeau « Mes trajets » ; RETRYING → rien à faire) · 3A photo optionnelle à la remise (2 max, `deals/delivery/`, `deliveryPhotoUrls` visible Expéditeur + médiation) · 4B portefeuille = PR dédiée · 5A « Donner ma version » (mailto). Copie honnête partout, « Noter » retiré du succès de livraison. **B4 front SOLDÉ.** Suite : `feat/b4-late-cancel-payout` (retenue ANN-01 au prorata, D50 — challenger avant : montant exact, moment du versement, deal CANCELLED sans `chargeId` ?) → portefeuille Voyageur (A77) → **chantier C** (admin-ui, médiation, résolutions DISPUTED — décisions à graver AVANT : rôles admin, matrice de résolution, remboursements partiels). Recette : V10–V19 (Voyageur) + E1–E12 (Expéditeur) + PAY/LIT (API).
13. **`feat/b4-late-cancel-payout` — FAIT, mergée #133 (dev = faf6c9b)** (D50, A79–A82). Décisions utilisateur 03/09 : 1A prorata sur le total (prime = 0 ; à 100 % remboursée quand D22 sera réel) · 2A compensation immédiate · 3A **pas de compensation après le départ** (HELD_FOR_MEDIATION) · 4A rien de rétroactif · 5A arrondi au centime sans minimum · 6A même événement avec motif, email variante, écrans. **B4 SOLDÉ** hors portefeuille (A77). Suite : portefeuille Voyageur (PR dédiée : à venir / en attente / envoyés / compensations, depuis `/me/deals`) puis **chantier C** (admin-ui : rôles, médiation DISPUTED → COMPLETED / remboursement partiel ou total, arbitrage des retenues HELD_FOR_MEDIATION, file des Reports, paramètres). **Challenger chaque lot en expert métier/UX et soumettre les points AVANT de coder.** Recette : ANN1–ANN8.
14. **`feat/wallet` — FAIT, mergée #135 (dev = fe995cc)** (A83–A84). Décisions utilisateur 03/09 : 1A les deux onglets · 2A totaux serveur (`GET /me/wallet`) · 3A lien tableau de bord Stripe Express · 4A trois cartes + liste unique · 5A next-intl. **B4 SOLDÉ.** Suite : **chantier C** (admin-ui). À challenger AVANT de coder : rôles admin (`authorizeRoles` existe), login séparé + 2FA (D26 ?), matrice de résolution DISPUTED (COMPLETED = payer le Voyageur · remboursement total / partiel à l'Expéditeur · arbitrage des retenues HELD_FOR_MEDIATION), file des Reports, paramètres plateforme audités (curseurs du mockup), TrustScore (D29②). Recette : FIN1–FIN8.
15. **`fix/tracking-absent-composite` — FAIT, mergée #137 (dev = d4babf6)** (A85) : jalons 409 en recette réelle (liste absente, 4e pitfall), réparation jouée. **Régénération du code** : erreur signalée, cause non établie — demander la ligne gateway `POST /api/deals/:id/code/regenerate`. Ordre validé le 03/09 pour la suite : (1) recette B4 réelle, (2) mini-PR « durcissement B4 » (rejeu des versements ACCOUNT_NOT_READY sans plafond de 10 essais + backoff, webhook `account.updated`, webhooks `transfer.*`, copie « Versement parti », vocabulaire Voyageur), (3) **B5 Confiance** (notation double-aveugle, relances J+5/J+7, stats de réputation), (4) chantier C.
16. **`chore/b4-hardening` — FAIT, mergée #139 (dev = c3033d6)** (A86–A89). Décisions utilisateur 03/09 : 1B plafond 100 · 2A un URL, deux endpoints Stripe · 3A récapitulatif support · 4A fenêtre « session expirée » · 5A vocabulaire Voyageur en PR séparée (57 occurrences, 11 fichiers). **Geste utilisateur** : créer le second endpoint webhook (comptes connectés) et poser `STRIPE_CONNECT_WEBHOOK_SECRET`. Suite : PR copie « Voyageur » → **B5 Confiance** (challenger avant : double-aveugle 14 j, critères, relances J+5/J+7, stats publiques D29①, où placer les boutons « Noter » retirés) → chantier C. Recette : H1–H8.
17. **`chore/vocabulaire-voyageur` — FAIT, mergée #141** (A90). Question utilisateur 03/09 : emails du suivi (les jalons n'envoient pas d'email — RG-P-09, voulu) ; « les notifs sont statiques » → diagnostic : liste réelle mais sans rafraîchissement (staleTime 30 s, pas de polling), cloche sans menu, titres génériques sans prénom ni contexte, pas de « tout marquer lu ». Points à trancher soumis (voir dernier message de session) avant une PR « notifications vivantes ». Puis B5.
18. **`feat/notifications-vivantes` — FAIT, mergée #142 (dev = 77795a5)**
19. **B5-PR1 `feat/b5-rating-server` — FAIT, mergée #144 (dev = 70f73eb)** (D53, A92–A94 ; décisions 1A–6A du 03/09). Suite : **B5-PR2 front** (challenger AVANT : où placer « Noter » sans harceler, écran « note envoyée / révélée quand… », affichage des niveaux sur profils et cartes, « Signaler cet avis »), puis chantier C. (A91, décisions 1A–4A du 03/09). Puis **B5 Confiance** : challenger AVANT de coder (double-aveugle 14 j, critères optionnels, relances J+5/J+7 déjà prévues dans les crons/clés, stats publiques D29①, retour des boutons « Noter » retirés en B4, notation par les deux rôles).
20. **B5-PR2 `feat/b5-rating-front` — FAIT, mergée #146 (dev = fa03de3)** (A95–A97 ; décisions 1A–6A du 03/09 : carte « Noter » sur les écrans terminé + listes + accueil, jamais de fenêtre bloquante · pas de moyenne avant de noter · « Plus tard » sans question · badge + faits + prochain niveau sur le profil · cartes de recherche inchangées · pouces des critères + « Signaler cet avis » mailto). Serveur : `rating` sur les deux vues de deal (deal 418), `criteria` sur les avis publics. **Geste utilisateur** : fusionner, relancer `deal-service` + `auth-service` + `user-ui`, jouer NOTE9–NOTE16. Suite : **chantier C** (admin-ui : médiation YAM-XXXX, file Reports dont « Signaler cet avis », paramètres audités) — challenger AVANT de coder.
21. **C-PR1 `feat/c1-admin-socle` — FAIT, mergée #148** (+ #150 message de connexion explicite, #151 CORS port 3001 : recette admin en cours sur `http://192.168.1.155:3001`, compte `telamaa.root@gmail.com` promu ADMIN) (D54, A98–A101 ; « Go pour tes recommandations » du 03/09 = 1A 2A 3A 4B 5A 6A 7A 8A). Socle : `apps/admin-ui` (3001), connexion admin en deux temps + TOTP obligatoire + codes de secours, cookies `admin_*`, `isAdminAuthenticated`, journal `AdminAction`, file « à arbitrer » + dossier (lecture). **Gestes utilisateur** : `npx tsx --env-file=.env packages/libs/prisma/scripts/grant-admin.ts <email>` sur SON compte, poser `TOTP_ENCRYPTION_KEY` (openssl rand -base64 32) dans `.env`, créer `apps/admin-ui/.env.local` (copie de `.env.example`), relancer auth-service, deal-service, gateway, `npm run admin-ui`, jouer ADM1–ADM10 ; rendre le check `TypeScript (admin-ui)` requis sur `dev`. Suite : **C-PR2 médiation** (challenger AVANT : formulaire de décision, montant partiel, ordre remboursement → transfert par l'exécuteur D49, version du Voyageur, écrans des deux rôles, emails).
22. **C-PR2 `feat/c2-mediation` — FAIT, mergée #153** (D55, A102–A104 ; décisions 1A–7A du 03/09). **Gestes utilisateur** : rejouer `seed-deals.ts` (les deux litiges du seed ont été tranchés par le smoke test ; le seed porte maintenant `bzv-held`), relancer deal-service, auth-service, notification-service, gateway, user-ui, admin-ui ; jouer MED1–MED10. Suite : **C-PR3 signalements** (challenger AVANT : endpoint `Report` réel, boutons in-app profil / trajet / avis, file admin, masquage d'un avis sans suppression, seuil `REPORT_REVIEW_THRESHOLD`).
23. **C-PR3 `feat/c3-admin-users` — FAIT, mergée #155** (D56, A105–A107 ; décisions 1A–7A du 04/09 + « le super admin crée un compte admin par invitation »). Réponse donnée : un compte admin PEUT utiliser le côté client (même compte), mais un compte invité naît sans rôle client et un admin n'agit jamais sur un deal ou un compte où il est partie. **Gestes utilisateur** : `grant-admin.ts <email> --role SUPER_ADMIN` sur son compte (les admins existants sans `adminRole` ne se connectent plus à l'admin tant que le profil n'est pas posé), `ADMIN_UI_URL` et `SENTRY_DSN` dans `.env` (vide = inactif), relancer tous les services et les deux fronts, jouer ADM11–ADM20. Retenu : à chaque lot, challenger ET proposer des axes non demandés (mémoire). Suite : **C-PR4 trajets et billets** (challenger AVANT : masquage d'un trajet, vérification des billets, effets sur les réservations en cours).
24. **C-PR4 `feat/c4-admin-trips` — FAIT, mergée #157 (14 checks comptés)** (D57, A108–A110 ; décisions 1A–8A du 04/09 + « KPI d'accueil par profil »). Livré : file « billets à vérifier » (`/admin/tickets`, motifs fermés, ouverture journalisée, EXPIRED à la lecture, redépôt → PENDING), « masqué par Yamba » (`Trip.hiddenByAdminAt`, lu par la recherche / la page publique / `checkTripBookable` du deal-service ; Support propose, Médiateur masque et rétablit ; email GÉNÉRIQUE au Voyageur, motif interne au journal ; bandeau sur le détail du trajet côté Voyageur), liste et fiche trajet admin (`/admin/trips`, `carrierId` depuis la fiche utilisateur), `GET /admin/kpis` + page `/home` (tuiles par permission, atterrissage après connexion), OpenAPI trip-service (tag admin, `adminCookieAuth`), seed : billet PENDING sur `bzv-upcoming`. **Gestes utilisateur** : `npx prisma db push` (champs Trip / TripDocument, enum EXPIRED), relancer trip-service, deal-service, auth-service, gateway et les deux fronts, rejouer `seed-deals.ts` pour le billet, jouer ADM21–ADM30. Non fait (backlog, D57) : détection de doublons de billets, identité forte, visionneuse intégrée, cache des KPI. Suite : **C-PR5 finances** (challenger AVANT : versements en échec, remboursements manuels, exports).
25. **C-PR5a `feat/c5a-admin-finances` — FAIT, mergée #159 (14 checks comptés)** (D58, A111–A113 ; « Go avec tes recommandations » = 1A–8A le 04/09). Livré : files d'exception (`GET /admin/finances/queue?kind=FAILED|REVERSED|HELD`), fiche argent de tout deal (`GET /admin/deals/:id/money`, journalisée), rapprochement lecture seule (`POST …/money/reconcile`, `PaymentProvider.inspect` Stripe + Fake, divergences codées, `refundId` stocké aux 4 sites de remboursement), rejeu manuel (`POST …/payout/retry`, exécuteur unique, 403 partie), clôture d'un renversement (`POST …/payout/reversal`, RESENT = PENDING + nouvelle clé `payoutIdempotencyKey` puis exécuteur ; WRITTEN_OFF), rejeux espacés sans plafond (`payoutNextRetryAt`, 5 min → 1 j), digest email vers l'admin, KPI `payoutsReversed`, admin-ui `/finances` + `/deals/[id]` + liens « argent », seed `bzv-reversed`. **Gestes utilisateur** : `npx prisma db push` (champs Booking), relancer deal-service, auth-service, gateway et admin-ui, rejouer `seed-deals.ts`, jouer FIN01–FIN10. **Reste C-PR5b** : rapport mensuel par devise, export CSV (`finances.export`), remboursement manuel (`refunds.manual.propose` / `apply` SUPER_ADMIN) — décisions déjà prises (5A, 3A-c), pas de nouveau challenge nécessaire. Puis C-PR6 pilotage.
26. **C-PR5b `feat/c5b-admin-finances-report` — FAIT, mergée #160 (14 checks comptés)** (D58 5A / 3A-c, A114–A116 ; « Tout est ok, on poursuit » le 04/09, aucune décision nouvelle). Livré : `GET /admin/finances/report?months` (chaque fait daté par son champ, mois UTC, par devise ; passifs du jour), `GET /admin/finances/export?from&to` (CSV par deal, FINANCE seul, ≤ 366 j, BOM, formules neutralisées, journal `FINANCE_EXPORTED`), `POST /admin/deals/:id/refund/propose` (FINANCE / SUPPORT) et `POST /admin/deals/:id/refund` (SUPER_ADMIN seul : `provider.refund` d'abord, transaction conditionnelle sur le cumul, `refundId`, outbox `booking.refund_issued` acteur ADMIN → email standard, journal), file `PROPOSED_REFUNDS`, KPI `manualRefundProposals`, portefeuille Expéditeur : remboursement après COMPLETED lu comme annulation partielle (corrige aussi le partiel de médiation), admin-ui `/finances/report` + carte « Remboursement manuel ». **Gestes utilisateur** : `npx prisma db push` (champs `manualRefund*`), relancer deal-service, auth-service et admin-ui, jouer FIN11–FIN18 (second compte admin nécessaire : Support ou Finance propose, super admin applique). Suite : **C-PR6 pilotage** (challenger AVANT : courbes, corridors, alertes de seuil, cache des KPI, « tout ce qui est arrivé à ce deal »).
27. **C-PR6a `feat/c6a-admin-pilotage` — FAIT, mergée #162 (14 checks comptés)** (D59, A117–A119 ; « Oui pour toutes les recommandations » + vues affichées dans la recherche et le détail, le 04/09). Livré : `GET /admin/pilotage/series` (semaine ISO / mois UTC, périodes vides, totaux, cache Redis 60 s) et `GET /admin/pilotage/corridors` (auth-service, `pilotage.read`), `GET /admin/deals/:id/history` (deal-service, `deals.history.read`, whitelist, journalisé), `packages/libs/redis/trip-stats.ts` (vues dédoublonnées par visiteur et par jour, recherches et sans-résultat par corridor, corridors cherchés), `viewsCount` sur les cartes et le détail public (trip-service + user-ui FR/EN), admin-ui `/pilotage` (petits multiples SVG, tableau, corridors avec « demande sans offre ») et carte « Tout ce qui est arrivé à ce deal ». Correction : chemins admin C-PR5a/5b replacés dans `paths` de l'OpenAPI deal-service. **Gestes utilisateur** : relancer trip-service, auth-service, deal-service, gateway et les deux fronts (pas de changement de schéma Prisma), Redis requis pour les compteurs, jouer PIL01–PIL08. Suite : **C-PR6b alertes de seuil** (décisions 3A / 4A déjà prises : cron horaire deal-service, seuils en constantes, accueil + digest, sans état) ; puis **chantier F chat** à challenger (message-service :6005, modération, rétention, mobile).
28. **Retours de recette du 04/09 → D60 gravée** (« OK pour toutes les recommandations GO ») : profils cumulés (1A, C-PR3bis), recherches poussées + exports encadrés RGPD (2A, C-PR7a, `exports.personal` SUPER_ADMIN + motif), pilotage agrandissable + drill-down (3A), finances du pilotage (4A). **Fix #163** `fix/session-expired-gate-provider` (fenêtre « session expirée » sous les providers, `turbopack.root`) — mergée. **C-PR6c `feat/c6c-admin-pilotage-v2` — FAIT, mergée #164** (A120–A122) : `GET /admin/pilotage/drilldown` (auth-service, `periodBounds`, 200 max, journal pour les inscriptions), `finance[]` dans la série, admin-ui onglets Activité / Finances + vue agrandie (tableau, éléments), user-ui pastille « n vues » + « Populaire » (20 vues, `lib/trip-signals.ts`) sur cartes et détail. **Gestes utilisateur** : relancer auth-service et les deux fronts, jouer PIL09–PIL14. Suite : **C-PR3bis profils cumulés** (D60 1A : `User.adminRoles` liste, union des permissions, script de reprise, invitation à cases), puis C-PR7a recherches / exports, C-PR6b alertes, chantier F chat.
29. **C-PR3bis `feat/c3bis-admin-roles` — FAIT, mergée #165** (+ #166 périodes en dates, RG-PIL-11) (D60 1A, A123–A125 ; « go » le 04/09). Livré : `User.adminRoles` (liste) + `adminRole` miroir (`adminRolesData`, `adminRolesOf`, `primaryAdminRole`, `normalizeAdminRoles` — pas de `transform` Zod, A125), `adminRolesAllow` (union) dans `requireAdminPermission`, KPI, JWT, `/admin/me`, invitation / modification à plusieurs profils (`InviteAdminRequest.adminRoles`, `UpdateAdminRoleRequest.adminRoles`), gardes inchangées (dernier SUPER_ADMIN sur liste OU miroir, sanction d'un admin par SUPER_ADMIN seul), admin-ui `can(roles)` + cases à cocher dans « Comptes admin » + libellés cumulés, `grant-admin.ts --roles A,B`, `backfill-admin-roles.ts`. **Gestes utilisateur** : `npx prisma db push`, `npx tsx --env-file=.env packages/libs/prisma/scripts/backfill-admin-roles.ts`, relancer auth-service et admin-ui (les autres services relisent le middleware : relancer trip / deal aussi), se reconnecter à l'admin (le JWT porte la liste), jouer ADM31–ADM36. Suite : **C-PR7a recherches poussées et exports encadrés** (D60 2A), puis C-PR6b alertes, chantier F chat.
30. **C-PR7a `feat/c7a-admin-search-exports` — PR ouverte** (D60 2A, A126–A128 ; « Go pour la suite » le 04/09). Livré : contrats de requête (`AdminUsersQuery`, `AdminTripsQuery`, `TicketQueueQuery`, `ArbitrationQueueQuery`), fonctions pures de `where` (auth `lib/admin-users.query.ts`, trip `admin-trips.rules.ts`, deal `filterQueueItems`), curseur + `nextCursor`, exports CSV (`@packages/libs/csv`, 5 000 lignes, journal `EXPORTED`) : `/admin/users/export` (SUPER_ADMIN, `exports.personal`, motif ≥ 20), `/admin/trips/export`, `/admin/tickets/export`, `/admin/disputes/export` (`exports.operational`, ids seulement) — routes déclarées AVANT `/:id` (A128) ; admin-ui `ExportButton` + filtres sur les quatre listes ; plugin Tailwind `line-clamp` retiré. **Gestes utilisateur** : relancer auth / trip / deal / gateway et l'admin-ui (aucun schéma), jouer ADM37–ADM44. Suite : **C-PR6b alertes de seuil** (D59 3A / 4A décidées), puis **challenge chantier F chat**, puis C-PR8 paramètres / RGPD (export et effacement d'un compte).
31. **F-PR1 `feat/f1-message-service` — PR ouverte** (D61, A132–A134 ; challenge du chat requalifié en « coordination » le 04/09, puis « service dédié dès maintenant » décidé par l'utilisateur). Livré : nouveau **message-service (6005)** — `Conversation` par deal ouverte à l'acceptation, **`Meetup` objet** (propose / accepte / contre-propose, verrou optimiste), fil avec deux gardes (**code de livraison refusé** par comparaison bcrypt sur les groupes de six chiffres, **coordonnées signalées sans blocage**), **numéro révélé au plus tôt 2 h avant le rendez-vous** et tracé, réponses rapides FR/EN, `GET/POST /messages/*` sous `isAuthenticated`, **relais outbox dédié** (topic `messaging-events`, bail propre) et **filtre `aggregateType: "booking"` ajouté au relais du deal-service** (A132 — sans lui, les événements de conversation auraient été parqués), OpenAPI **4e document** (script + diff CI), service ajouté aux matrices CI (typecheck et tests), seed d'un fil sur `bzv-accepted`. **Gestes utilisateur** : `npx prisma db push`, relancer le gateway et lancer `npx nx serve message-service`, rejouer `seed-deals.ts`, jouer FCH01–FCH10. **Attention ordre de fusion** : #168 (C-PR6b alertes) est verte et non fusionnée ; cette branche a été pré-fusionnée avec elle. Suite : **F-PR2** front des deux rôles + notifications (in-app immédiate, email de relance à 15 min), **F-PR3** admin (lecture depuis un dossier, signalement) et purge à un an ; puis C-PR8 paramètres / RGPD.
30. **C-PR7a `feat/c7a-admin-search-exports` — FAIT, mergée #167** (D60 2A, A126–A128 ; « Go pour la suite » le 04/09). Livré : contrats de requête (`AdminUsersQuery`, `AdminTripsQuery`, `TicketQueueQuery`, `ArbitrationQueueQuery`), fonctions pures de `where` (auth `lib/admin-users.query.ts`, trip `admin-trips.rules.ts`, deal `filterQueueItems`), curseur + `nextCursor`, exports CSV (`@packages/libs/csv`, 5 000 lignes, journal `EXPORTED`) : `/admin/users/export` (SUPER_ADMIN, `exports.personal`, motif ≥ 20), `/admin/trips/export`, `/admin/tickets/export`, `/admin/disputes/export` (`exports.operational`, ids seulement) — routes déclarées AVANT `/:id` (A128) ; admin-ui `ExportButton` + filtres sur les quatre listes ; plugin Tailwind `line-clamp` retiré. **Gestes utilisateur** : relancer auth / trip / deal / gateway et l'admin-ui (aucun schéma), jouer ADM37–ADM44. Suite : **C-PR6b alertes de seuil** (D59 3A / 4A décidées), puis **challenge chantier F chat**, puis C-PR8 paramètres / RGPD (export et effacement d'un compte).
31. **C-PR6b `feat/c6b-admin-alerts` — PR ouverte** (D59 3A / 4A, A129–A131 ; « Go pour la suite » le 04/09). Livré : `ops-alerts.rules.ts` (neuf règles, `ALERT_THRESHOLDS`, `evaluateAlerts` pur), `ops-alerts.service.ts` (`collectOpsSnapshot`, `evaluate`, `notifyNewAlerts` dédoublonné `SET NX`), `cron/ops-alerts.cron.ts` (h+5, Redis injecté), email `opsAlerts`, `GET /admin/alerts` (`kpi.read`, gateway → deal-service), bandeau d'accueil admin. **Gestes utilisateur** : `OPS_ALERTS_CRON_ENABLED` dans `.env` (vide = actif), relancer deal-service, gateway, admin-ui ; jouer ALR01–ALR06. **Chantier C : socle complet** (C-PR1 → C-PR7a, C-PR6b). Suite : **challenge chantier F chat** (message-service :6005 — modération, rétention, pièces jointes, mobile, notifications), puis **C-PR8** paramètres audités (seuils, commission), RGPD (export / effacement d'un compte), maintenance.

## C. Questions encore ouvertes pour l'utilisateur
- Nom du rôle transporteur : Yamber / Tripper / Voyageur (une seule réponse, appliquée partout).
- Facebook : garder le bouton inerte ou le retirer (toujours inerte après la PR Google).
- Session : « connecté indéfiniment » = case « Rester connecté » cochée par défaut (7 j d'inactivité, D27) — **corrigé** (`fix/session-remember-default`, A62 : décochée par défaut + aide sur les durées).

## C bis. Fusions
- Les fusions sont faites PAR L'UTILISATEUR (le classificateur de permissions de la session refuse `gh pr merge`) : #116, #117, #118 fusionnées le 03/09 (`dev` = `bb57c49`), puis #119 → #124 dans l'ordre (merge commits, `dev` = `bba3562`, branches purgées). Chaque PR suivante part de `dev` à jour.

## D. Environnement (inchangé)
Front en LAN (`192.168.1.155`), Docker requis, `DELIVERY_CODE_ENCRYPTION_KEY` toujours à poser. Le `nx serve auth-service` en cours ne recharge PAS le code : relancer le service pour voir les correctifs de cette PR en recette.
