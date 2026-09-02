# YAMBA — SUIVI DE PROJET DE BOUT EN BOUT
### État au 2 septembre 2026 · `dev` = #106 (B3 SOLDÉ, uploads + visionneuse) · 601 tests · `main` = `9c6e155` (#88)
*Légende : ✅ fait (PR) · 🟡 en cours / partiel · ⬜ à faire · 🔴 bloquant lancement. Vélocité = « sessions » (unité des handoffs). Mis à jour à chaque merge (règle : ce fichier + `YAMBA-CONTEXT.md`).*

---

## 0. Vue d'ensemble

| Jalon | Contenu | Avancement |
|---|---|---|
| **Jalon 1 — Boucle transactionnelle** (réserver, payer, livrer, noter) | socle + pricing + B1 faits ; B2 → B5 restent | **~55 %** |
| **Jalon 2 — Plateforme opérable** (admin, sessions, intégrations) — *constitutif du lancement* | non commencé (sauf CI/OpenAPI) | ~10 % |
| **Jalon 3 — Expansion** (chat, locales, reco) | non commencé | 0 % |
| **Jalon 4 — Application mobile : socle + Android** (React Native/Expo, code partagé, Play Store) | non commencé — D36 gravée (Expo) | 0 % |
| **Jalon 5 — iOS** (même base, spécificités Apple, App Store) | non commencé | 0 % |

Lancement public = fin du Jalon 2. Fourchette tenue au dernier handoff : **5–8 semaines** de sessions (optimiste ≈ 10,5 / réaliste ≈ 16 sessions restantes sur le Jalon 1 avant cette journée ; aujourd'hui ≈ 3 sessions consommées : PR-B, search, PR-C).

---

## 1. Socle et outillage — ✅

| Élément | Statut | Réf. |
|---|---|---|
| Monorepo Nx, 4 services Express + gateway + Next 16, Prisma/Mongo partagé, Redis | ✅ | — |
| Auth (register/login/refresh, cookies JWT, circuit breaker front), onboarding Voyageur + Stripe Connect, saved routes, profils publics, crons | ✅ | — |
| Politique de session D27 (inactivité + durée absolue) | ✅ #68 | SES-01/02 |
| Chantier 0 OpenAPI : `@packages/api-contracts` (Zod), OAS 3.1 trip-service 99 paths ×3, viewer Scalar, diff CI | ✅ #64–#66, #69 | D3 |
| CI : 13 checks requis (TypeScript ×6, tests ×3, i18n FR/EN, secrets, OpenAPI, build) | ✅ #63 | D30 |
| Build de production réparé (Suspense) — **`next build` à ajouter aux checks requis** | ✅ #81 / ⬜ check | candidat D-next |
| `context/` versionné (registre, spec, règles, handoffs, fiches par PR), `CLAUDE.md` gouvernance | ✅ #79, #84, #86 | règle d'équipe |
| Historique Git réécrit (emails corrigés, aucune attribution externe), `main` = `dev` | ✅ 28/08 | — |

## 2. Trajets (trip-service + front Voyageur)

| Élément | Statut | Réf. |
|---|---|---|
| CRUD trajets, wizard 3 étapes, lieux de remise/livraison, documents ImageKit, recherche + facettes | ✅ | — |
| State machine de cycle de vie (exécutable = spec) + tests | ✅ #60, #67 | — |
| **Pricing PR-A** : schéma PER_KG, contrats, gate bi-moteur A28, seed | ✅ #77 | D13/D14/D19 |
| **Pricing PR-B** : formulaire « dépôt en 90 s », suggestion D15 explicable, familles, bagages, gate serveur sur les 3 chemins d'écriture, updates par paquets (Atlas) | ✅ #82 | D15, D20, D31, D32, RG-B-01…35 |
| Suggestion par corridor (15 zones + domestique) — **valeurs = hypothèses à valider (étude GP)** | ✅ code #83 / ⬜ étude | D15 |
| Page trajet propriétaire (Modifier sans dashboard) | ✅ #82 | — |
| Step 1 UX : aéroport → ville de rattachement, arrivée repliée, justificatif en step 3, drapeaux | ⬜ | avis 28/08 |
| Lieux en chips + aperçu public sticky (create-trip) | ⬜ | avis 28/08 |
| Cleanup legacy PER_CATEGORY (`CategoryChip`, `PriceInput`, `CATEGORY_GROUPS`, champs `@deprecated`), `maxSlots/bookedSlots`, `instantBooking` | ⬜ | PR cleanup post-refonte |
| Micro-PR D31 : gate Stripe/profil → acceptation (checks retirés des 3 chemins de publication, appliqués dans `POST /deals/:id/accept`) | ✅ #90 · seed factice ✅ #90 | D31 |

## 3. Recherche et page trajet (Expéditeur)

| Élément | Statut | Réf. |
|---|---|---|
| Recherche backend + UI desktop/mobile, facettes, cursor pagination | ✅ | — |
| Prix au kilo affiché partout (plus de 0 €), exemple « 2 kg ≈ 27 € » | ✅ #82 | — |
| **D33** comparabilité (colis de référence 2 kg), filtre par famille, poids du colis (prix/tri/capacité), filtres à 0 masqués, sidebar sticky CSS | ✅ #83 | D33, RG-S-01…13 |
| Page trajet : `OfferCard` (offre complète), CO₂ pour le poids, annulation alignée ANN-01, lieux + conditions à droite | ✅ #83 | — |
| Tri « prix » en mémoire pour un poids (fenêtre 200) → pipeline d'agrégation quand le volume l'exige | 🟡 assumé v1 | — |
| Filtres « Horaires de départ » (commentés) | ⬜ | — |
| Carte propriétaire : vues / demandes reçues | ⬜ | — |

## 4. Réservation (Expéditeur) et deals (Voyageur)

| Élément | Statut | Réf. |
|---|---|---|
| Wizard 4 étapes (colis, destinataire, charte, paiement Stripe Elements) — front | ✅ (front) | docs booking shipper |
| **PR-C** : D34 `@packages/pricing` (moteur unique), vrai trajet, garde CNF-05, produit/famille/poids/S-M-L, récap COM-03, Garantie Yamba (GAR-02), téléphone E.164, Stripe chargé à l'étape 4 | ✅ #85 | D34, RG-C-01…16 |
| Deal-service B1 : Booking (snapshots), state machine 9 statuts / 12 transitions, DTO par rôle, outbox + relay Redpanda, 218 tests | ✅ #70–#74 | D17, §2.2 workflow |
| notification-service : consumer Kafka, dédup event-id | ✅ #75 | — |
| Dashboards : Mes envois, Mes trajets & deals, inbox, listes réelles | ✅ #56–#59, #76 | — |
| Écrans post-acceptation (front) : pickup + checklist, code de livraison, tracking, vérification J+4, litige, notation | ✅ (front) #48–#54 | — |
| **B2-PR1 — naissance du deal** : `POST /deals/payment-intents` + `POST /deals`, `@packages/payments` (PaymentProvider D11 : Stripe capture manuelle + Fake), devis serveur = moteur unique (409 `QUOTE_DIVERGENCE`), snapshot D17 enrichi + lieux, `reservedKg` atomique + outbox en transaction, wizard branché (un seul Payment Element — A30), 24 tests, prouvé de bout en bout (Atlas + Stripe test) | ✅ #90 | D37, D38, A29, A30, RG-D-01…14 |
| **B2-PR2 — cycle de vie du deal** : `POST /deals/:id/accept` (charte + gate D31 déplacé + **capture à l'acceptation D39**), `/decline` (5 raisons, libération, CAP-02), `/cancel` (ANN-01 : 100 % ≥ J-2, retenue **50 %** ensuite), cron expiration 24 h, webhook Stripe D40 (`payment_intent.canceled` → SYSTEM cancel, nouvelle transition machine), argent d'abord → transaction Mongo conditionnelle + outbox, +46 tests | ✅ #90 | D31, D39, D40, ANN-01/04 |
| **B2-PR3 — front des transitions** : écran É2 branché (adapter whitelist, accept/decline réels, 409 mappés, raisons contrat — A32), gains nets seuls (A13), CTA par `allowedActions`, annulation Expéditrice dans Mes envois (préviz ANN-01 servie — A31), seed CarrierPage/intents FAKE adoptés (A33), +4 tests | ✅ #90 (+A34) | A31–A33, RG-F-01…06 |
| **B2-PR4 — emails transactionnels booking.*** : canal email du MÊME consumer (D41), `@packages/email` (3e clone évité, provider D35 branchable derrière), `EMAIL_MATRIX` totale en data (A35 — 7 clés actives, les 10 autres avec leur writer B3/B4/B5), idempotence at-most-once par destinataire (`EmailDelivery` claim-first, best-effort — A36), 8 gabarits EJS FR/EN testés en rendu réel, +29 tests | ✅ #92 | D41, A35, A36, RG-N-01…08 |
| **B2-PR5 — tracker Expéditeur réel** : `/bookings/[id]` → `GET /deals/:id` par un adapter CONSERVATIF (view-model existant produit, ~40 vues intactes — A37), TanStack Query, fin du fallback menteur (`BookingStatusNotice` : attente/refusé/expiré/annulé/terminé/litige), dégradations honnêtes (stats B5, carte Stripe, code AES : lignes masquées), mocks de données supprimés | ✅ #93 | A37, RG-T-01…06 |
| **B3-PR1 — transport serveur** : `POST /deals/:id/pickup` (checklist 5/5 figée + 1..5 photos ImageKit — D42 — + code GÉNÉRÉ bcrypt + AES — D43), `/pickup/refuse` (remboursement intégral, CAP-02, sans pénalité — A40), `/events` (séquence stricte, undo client — A39), `/code/regenerate` (Expéditeur ≤ 5), `/deliver` (bcrypt, 3 essais / verrou 15 min + remise à zéro — A38, J+4) ; code révélé dans la vue Shipper seule ; `@packages/delivery-code`, `booking-write.ts` ; 4 emails B3 (A41) ; seed avec vrai code ; annexe A42 (`primaryAddressId` plus @unique) ; e2e Atlas 33 vérifications ; +60 tests | ✅ #95 | D42, D43, A38–A42, RG-P-01…12 |
| **B3-PR2 — transport front** : bascule des 4 mocks Voyageur (pickup + upload `useImageKitUpload` AVANT l'appel, refus = raison seule, jalons envoyés après la fenêtre d'undo, livraison à compteur serveur) et du mock régénération Expéditeur (code relu de l'API) ; tsc + build prod + i18n | ✅ #96 | A43, RG-P-13…17 |
| **B3-PR3 — boîte du Voyageur** : `GET /me/deals`, bande « À traiter » (Mes trajets + accueil), deals réels sous chaque trajet, section page trajet, notifications cliquables, badge sidebar + barre mobile (`useTripsBadge`) — A44 | ✅ #98 | A44, RG-P-18…22 |
| **B3-PR4 — page demande Voyageur** : photos déclarées envoyées par le wizard (avant la carte), colonne d'action dès 768 px, GAR-02/RGP-02 dans les libellés, « Voir profil » réel (`publicSlug`) — A45 | ✅ #100 | A45, RG-P-23…27 |
| **B3-PR5 (chore) — typographie des pages Deal** : H1/H2 alignés sur le dashboard (22/17 px semibold), grilles et colonne d'action dès 768 px sur les 5 pages + squelette — A46 | ✅ #102 | A46 |
| **Fix ImageKit (A47)** : `imagekit@1.5.0` (fossile 2016) → 6.0.0, d.ts maison supprimée, copie imbriquée dédupliquée ; `uploadDetailed` + erreurs explicites, photos 10 Mo/WebP | ✅ #104 | A47 |
| **B3-PR6 — visionneuse de photos** : `PhotoThumbs` + `PhotoLightbox` partagés, vignettes réelles cliquables dans les 10 vues (Voyageur + Expéditrice), plein écran clavier/tactile — A48 | ✅ #106 | A48 |
| ⬜ **B3 — dettes** : URLs signées / fichiers privés ImageKit, vérification du domaine des URLs photo, procédure de rotation de clé AES (format `v1.` prêt), actions tracker confirmer/litige (B4) | ⬜ avec B4 | D42, D43 |
| 🔴 **B4 — argent sortant** : confirmation anticipée, cron J+4 → COMPLETED + `transfers.create()`, dispute avec gel, versement de la retenue ANN-01 au Voyageur (`CANCEL_LATE_RETENTION_PCT` = 50, gravé D39) | ⬜ (1,5/2,5) | ANN-01…04, D39 |
| 🔴 **B5 — confiance** : rating double-aveugle serveur, relances J+5/J+7, stats de réputation (D29-1) — unicité (bookingId, authorUserId) sans `@@unique` naïf Mongo | ⬜ (1,5/2) | D29 |
| PR « paramètres serveur » : `GET /pricing/params` (`PRICING_PARAMS` unique : commission, planchers, coefs, référence, corridors) — dédoublonner `comparable-price`, `price-for-weight`, `pricing-example` | ⬜ (0,5) | D34 |

## 5. Jalon 2 — plateforme opérable (⬜ sauf mention)

| Élément | Statut |
|---|---|
| Chantier C admin-ui : médiation litiges (tickets YAM-XXXX), vérification billets, file des signalements, gestion users, **paramètres plateforme audités** (les curseurs du mockup §13), TrustScore + plafonds (D29-2), login séparé, 2FA TOTP, audit log | ⬜ |
| Chantier E : profil public Voyageur (stats réelles, trajets, avis) | ⬜ |
| Sessions : SES-03 sudo mode, SES-04 modal d'expiration, SES-05 liste des sessions, cleanup legacy | ⬜ |
| API : conversion OpenAPI auth-service (Zod), `/docs` Scalar auth, index gateway, audit anglais OAS | ⬜ |
| Micro-PRs confiance : wording statuts D28, bouton Signaler (trajet + membre), CTA alertes, page destinataire | ⬜ |
| Intégrations : Sentry front + back, PostHog, vérification des backups Atlas | ⬜ |
| Provider email transactionnel (Resend/Postmark/SES) derrière `@packages/email` — candidat D35 | ⬜ |

## 6. Jalon 3 — expansion (⬜)

message-service :6005 (chat Socket.io, coordination pickup) · fin i18n (ES puis PT) · H recommandations ML (replay outbox + PostHog, D15-V2). *(Le mobile sort du Jalon 3 → jalons 4 et 5.)*

## 6bis. Jalon 4 — application mobile : socle + Android (⬜)

| Élément | Statut | Réf. |
|---|---|---|
| **D36 gravée (Expo)** : stack React Native + Expo (TypeScript, Expo Router), une base pour les deux OS ; réutilisation de `@packages/pricing`, `@packages/api-contracts`, client généré depuis l'OpenAPI (D3), messages i18n JSON | ⬜ décision | D3, D34 |
| Fondations : RN nouvelle architecture (Hermes, Fabric), Expo Router + `react-native-screens`, Reanimated/Gesture Handler, FlashList, `expo-dev-client` + EAS Build ; auth par tokens (refresh sans cookies), stockage sécurisé, push (Expo Notifications ↔ notification-service), deep links, thème mango/teal **idiomatique par OS** | ⬜ | D36 |
| Budgets de performance en CI (Maestro + Flashlight) : démarrage à froid < 1,5 s (Android milieu de gamme), 60 fps listes, aucune frame > 100 ms sur les 2 parcours critiques, < 40 Mo | ⬜ | D36 |
| Parcours Expéditeur : recherche (poids, familles), page trajet, réservation 4 étapes (Stripe Payment Sheet), suivi, code de livraison, notation | ⬜ | RG-S/RG-C |
| Parcours Voyageur : création de trajet PER_KG, deals reçus, accept/decline, pickup (checklist, photos caméra), livraison (code) | ⬜ | RG-B |
| Qualité : Jest/RNTL sur la logique partagée, E2E Maestro/Detox sur les 2 parcours critiques, CI EAS Build | ⬜ | D30 |
| Google Play : internal testing → production, data safety, politique de confidentialité | ⬜ | — |

Prérequis : Jalon 1 clos (B2–B5) et Jalon 2 lancé (le mobile consomme les mêmes API et les mêmes règles). Estimation à affiner après D36 : **6–10 sessions** pour un premier Android complet.

## 6ter. Jalon 5 — iOS (⬜)

| Élément | Statut |
|---|---|
| Même base ; Sign in with Apple (obligatoire si login social), Apple Pay via Stripe, textes d'usage des permissions (caméra, photos, notifications) | ⬜ |
| TestFlight, review App Store — note de review : marketplace de services physiques, paiement hors achat intégré (conforme aux guidelines 3.1.3) | ⬜ |
| Publication App Store, parité fonctionnelle et visuelle avec Android | ⬜ |

Estimation : **2–4 sessions** au-dessus du Jalon 4 (l'essentiel du travail est partagé).

## 7. En continu / dettes techniques

| Élément | Statut |
|---|---|
| i18n : dissolution `dashboard.copy.ts`, booking, trips/create, page publique → namespaces ; suppression `UiPreferencesProvider` déprécié ; **messages par route** (payload RSC 100 Ko) | ⬜ |
| `chore/deps` : 43 vulnérabilités npm (6 critiques), Prisma 6 → 7 — PR dédiée, jamais `npm audit fix --force` en pleine PR | ⬜ |
| `fix/error-semantics` trip-service (400 partout → 404/401/403) | ⬜ |
| Front : OnboardingBanner après Header, cron onboarding-reminder (node-cron), page carrier settings (Stripe), `viewsCount` Redis (D5) | ⬜ |
| Sécurité/robustesse : redaction pino-http (cookie + authorization), `getImageKit()` paresseux, `AddDocumentsBody` en Zod, harmonisation noms Nx, idempotence seed-deals, bug seed shipperId === carrierId | ⬜ |
| Seeds : `arrivalAt`/heures locales manquants sur `bzv-perkg` ; carrierPage/Stripe factices pour tester la publication | ⬜ |
| Décisions candidates à graver : « la CI construit ce qu'elle déploie » (`next build`), règle de couleur des CTA (mango = avancer, teal = engager), D35 email provider | ⬜ |

## 8. Chiffres de suivi

| Indicateur | Valeur |
|---|---|
| Tests (plateforme) | 601 = trip 187 · deal 355 · notification 59 |
| Décisions au registre | D1 → D43 (+ arbitrages A1 → A48) |
| Règles métier | ~50 (V2) + RG-B-01…35, RG-S-01…13, RG-C-01…16, RG-G-01…03, RG-D-01…16, RG-V-01…09, RG-F-01…06, RG-N-01…08, RG-T-01…06, RG-P-01…27 |
| PR mergées | #1 → #95 (#90 = pile B2-PR1/2/3 · #91 = docs post-merge · #92 = B2-PR4 emails · #93 = B2-PR5 tracker · #94 = docs post-merge · #95 = B3-PR1 serveur · #96 = B3-PR2 front · #97 = docs · #98 = B3-PR3 boîte du Voyageur · #99 = docs · #100 = B3-PR4 page demande · #101 = docs · #102 = typographie Deal · #103 = docs · #104 = fix ImageKit · #105 = docs · #106 = visionneuse photos — 13 checks comptés à chaque fois) |
| Documents | registre, spec, règles, 5 handoffs (dernier : SESSION-2026-08-28 + addendum 29/08), fiches PR (archive), 3 docs cumulatifs (technique, métier, apprentissage), `YAMBA-MOTEUR-PRIX.md/.pdf`, ce suivi |

## 9. Ordre recommandé des prochaines sessions

1. **B2 : SOLDÉ** (PR1 naissance, PR2 cycle de vie, PR3 front É2, PR4 emails, PR5 tracker). Restes rattachés à B3 : photos, AES code, actions tracker réelles.
2. **B3 transport** : PR1 serveur (#95) et PR2 front faites le 02/09 → **B4 argent sortant** (1,5–2,5) puis **B5 confiance** (1,5–2).
3. PR « paramètres serveur » (0,5) + cleanup legacy (0,5) + seeds (0,25) — entre deux lots.
4. Jalon 2 : admin-ui (C), Sentry/PostHog, provider email, sessions — **constitutif du lancement**.
5. UX différées (step 1, chips lieux, messages par route) — quand le funnel réel donne des chiffres (PostHog).
6. **Jalon 4 mobile** : graver D36 (stack + périmètre) dès que B2 est en route, pour que le client OpenAPI et les contrats soient conçus « mobile-ready » (tokens, pagination, erreurs typées) ; puis Jalon 5 iOS.
