# YAMBA — HANDOFF DE SESSION · 28 août 2026
### De PR-B (formulaire pricing) à la release `main` — 9 PR mergées, historique réécrit, moteur de prix unifié

> À lire avec : `YAMBA-REGISTRE-DECISIONS-ROADMAP-v1.3.md` (D1–D34), `YAMBA-MOTEUR-PRIX.md` (logique métier du prix, .md + .pdf), les fiches `context/fiches-pr/*/` (technique + métier par PR), `YAMBA-CONTEXT.md` (fait / reste).

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
