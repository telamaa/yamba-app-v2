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
