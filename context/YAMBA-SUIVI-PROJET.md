# YAMBA — SUIVI DE PROJET DE BOUT EN BOUT
### État au 3 septembre 2026 (après-midi) · `dev` = `c3033d6` (#116 recette auth · #117 email-locale D44/D45 · #118 modale de réservation A58 · #119 favoris D46/A59 · #120 pages auth D45/A60 · #121 Google D47/A61 · #122 « Rester connecté » A62 · #123 connexion dans la fenêtre A63 · #124 API même origine D48 · #125 « Suivre » en modale A64 — backlog recette 03/09 SOLDÉ · #127 B4-PR1 serveur D49–D52 · #129 B4-PR2 tracker Expéditeur A71–A74 · #131 B4-PR3 côté Voyageur A75–A78 · #133 retenue ANN-01 D50 · #135 Finances A83–A84 — B4 SOLDÉ) · 621 tests plateforme (trip 198 · deal 355 · notification 68) + 65 auth-service · `main` = `9c6e155` (#88)
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
| **Fix relay outbox (A49)** : filtre `publishedAt` null/absent + writers explicites — aucun événement réel n'avait jamais été relayé ; 38 orphelins parqués ; SMTP à copier dans le `.env` racine | ✅ #109 | A49 |
| **Recette réelle 02/09** (2 vrais comptes, LAN) : OK 1→3 + F1, emails/in-app à chaque étape ; **reste F4→F7, D1–D7, V1–V9** (l'utilisateur) | 🟡 en cours | — |
| **Auth (recette)** : atterrissage post-OTP expliqué (#113), redirect conservé inscription → OTP → connexion + anti open redirect (#114) | ✅ | — |
| ⬜ **B3 — dettes** : URLs signées / fichiers privés ImageKit, vérification du domaine des URLs photo, procédure de rotation de clé AES (format `v1.` prêt), actions tracker confirmer/litige (B4) | ⬜ avec B4 | D42, D43 |
| 🔄 **B4 — argent sortant** : **PR1 serveur FAITE** (`feat/b4-payout-server`, D49–D52, A65–A70 : confirm, dispute — aussi depuis PICKED_UP après 48 h —, cron J+4 + rejeu + rappel J+3, `PaymentProvider.transfer` avec `source_transaction`, `Dispute`, 5 emails D44) → **PR2 front Expéditeur FAITE** (`feat/b4-shipper-front`, A71–A74 : mocks basculés, vues terminé / litige, « Signaler » gardé par `allowedActions` + `disputeOpensAt`, photos de litige) → **PR3 front Voyageur FAITE** (`feat/b4-carrier-front`, A75–A78 : vues livré / terminé / litige, `payoutBlocker` + CTA Stripe + bandeau, photo de remise optionnelle, « donner ma version ») → **retenue ANN-01 FAITE** (`feat/b4-late-cancel-payout`, A79–A82 : compensation immédiate au prorata, HELD_FOR_MEDIATION après le départ, emails, écrans) → **portefeuille FAIT** (`feat/wallet`, A83–A84) → chantier C | ✅ B4 SOLDÉ (PR1 #127 · PR2 #129 · PR3 #131 · retenue #133 · portefeuille #135) | D49–D52, INV-2…5 |
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
| **Recette auth 03/09 — `fix/auth-recette`** (A50–A54) : critère de mot de passe NOMMÉ (front + codes serveur `PASSWORD_*`, `EMAIL_ALREADY_USED`), messages OTP construits des codes (plus d'anglais brut), barème OTP par paliers de 5 avec invalidation du code, fenêtre d'inscription 30 min prolongée au renvoi, « 5 minutes » → durée injectée, sujets OTP en français, œil centré, visuels manquants retirés ; +19 tests auth-service | ✅ #116 |
| **Backlog recette 03/09 — PRIORISÉ** (décisions utilisateur : mode LAN conservé, boutons Google/Facebook laissés tels quels, tutoiement partout, prénom réel dans les emails, N langues) | | |
| P1 · `feat/email-locale` — **D44** (A55–A57) : `User.preferredLocale` (liste unique `SUPPORTED_LOCALES` dans api-contracts, consommée par next-intl), `x-locale` sur chaque requête (axios + apiFetch), `PATCH /auth/me/locale` à la bascule header, gabarit partagé `packages/libs/email` (chaîne EJS) + 7 emails auth en dictionnaires fr/en (ancien mailer et templates supprimés), notification-service et trip-service dans la langue du DESTINATAIRE, prénom réel de la contrepartie (D45) dans 5 gabarits, sujets sans emoji, `SMTP_FROM_NAME` lu ; +9 tests notification, +19 tests auth | ✅ mergée #117 |
| P1 · `feat/booking-auth-modal` — **A58** : « Connecte-toi pour réserver » en MODALE sur la page trajet (`BookingAuthGateModal`, dialogue desktop / feuille du bas mobile, ESC / fond / « Plus tard »), la page `/book` garde sa porte pour l'accès direct ; « Connexion » et « Créer un compte » du header (desktop, palette, feuille mobile) transmettent la page courante en `redirect` (hors pages auth et accueil) ; retour dans le wizard après connexion | ✅ mergée #118 |
| P2 · `feat/trip-favorites` — **D46 / A59** : modèle `TripFavorite`, `POST`/`DELETE /trips/:id/favorite` idempotents, `GET /trips/favorites`, `isFavorite` sur recherche + fiche publique (authent optionnelle), cœur optimiste sur les cartes (desktop, mobile) et la fiche, page « Mes favoris » (sidebar, onglet mobile, menu utilisateur), règles serveur 404 / 403 `OWN_TRIP` / 409 `TRIP_NOT_FAVORITABLE`, trajets passés conservés ; +11 tests trip-service, OpenAPI régénéré | ✅ mergée #119 |
| P2 · `feat/auth-pages-ux` — **D45 / A60** : tutoiement sur les six formulaires auth + `auth.json`, « saisie bloquée » (A50), trois promesses produit à la place des chiffres inventés et du témoignage fictif, champs 16 px sur mobile ; `AuthGateModal` générique (portail) + portes « Connecte-toi pour partager un trajet » (CTA header) et « Connecte-toi pour enregistrer un favori » (cœur, cartes + fiche) — demandes utilisateur 03/09 ; vocabulaire du rôle toujours ouvert, CTA collant non fait | ✅ mergée #120 |
| P2 · `feat/auth-google` — **D47 / A61** : `AuthIdentity`, `POST /auth/google` (jeton vérifié serveur, identité connue → connexion, email vérifié → rattachement, nouveau → `CONSENT_REQUIRED` puis création avec `ConsentLog`), `issueSession` partagé, bouton officiel GIS + écran « Finalise ton compte » sur login et inscription, inerte sans client ID ; 6 tests (auth 65). **À faire par l'utilisateur** : créer l'ID client OAuth dans Google Cloud et poser `GOOGLE_CLIENT_ID` + `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (`.env.example`). Facebook non branché | ✅ mergée #121 |
| Fix · `fix/session-remember-default` — **A62** : « Rester connecté » décoché par défaut + aide sur les durées (D27 inchangé : 60 min / 7 j, coché 7 j / 30 j) ; bug de recette « connecté indéfiniment » | ✅ mergée #122 |
| UX · `feat/auth-gate-inline-login` — **A63** : la fenêtre de connexion embarque le formulaire complet (e-mail, Google, Facebook, lien inscription), reprise du geste après connexion (favori appliqué, réservation → wizard, partage → création) — demande utilisateur 03/09 | ✅ mergée #123 |
| P3 · `chore/api-same-origin` — **D48** : rewrite Next `/api/*` → gateway (opt-in `API_PROXY_TARGET`), `NEXT_PUBLIC_API_BASE_URL=/api` relatif accepté par les clients API, cookies first-party sur tout hôte (fin du piège localhost ↔ LAN du 03/09) ; `.env.example` + `CLAUDE.md` mis à jour, aucun appel API serveur Next à ce jour | ✅ mergée #124 |
| UX · `feat/follow-auth-gate` — **A64** : bouton « Suivre » du profil public → porte d'identité en modale (« Connecte-toi pour suivre {prénom} »), suivi appliqué après connexion sans quitter le profil ; fin de la dernière redirection `/login` sur un geste — demande utilisateur 03/09 | ✅ mergée #125 |
| B4 · `feat/b4-payout-server` — **D49–D52 / A65–A70** : `POST /deals/:id/confirm` (COMPLETED puis transfert en ligne), `POST /deals/:id/dispute` (DELIVERED avant J+4, PICKED_UP « non livré » après 48 h, ticket YAM-XXXX, `Dispute`, gel), cron `*/5` (J+4 → COMPLETED + versement, rejeu FAILED, rappel J+3), `PaymentProvider.transfer` (Stripe `source_transaction`, Fake idempotent), `chargeId` à la capture, 5 emails en dictionnaire D44, in-app `verification_reminder` ; deal 380 · notification 75 | ✅ mergée #127 |
| B4 · `feat/b4-shipper-front` — **A71–A74** : `confirmDeliveryEarly` / `submitDispute` réels (fin des mocks du tracker), confirmation en bouton secondaire + conseil, vues « Envoi terminé » et « Signalement en cours » (dossier, 4 étapes, support), « Signaler un colis non livré » en transit (désactivé avant `disputeOpensAt` servi), formulaire : garde 7A, motif verrouillé en transit, photos envoyées à la sélection vers `deals/dispute/` ; carte « Noter » retirée (B5) | ✅ PR ouverte |
| B4 · `feat/b4-carrier-front` — **A75–A78** : `CarrierBookingView.payoutBlocker` (cause grossière, jamais le message Stripe), `deliver` avec `photoUrls` optionnelles (`deliveryPhotoUrls` servi aux deux vues), vue Voyageur DELIVERED / COMPLETED / DISPUTED (`DealSettledView`), `DealPayoutStatusCard` (programmé / en cours / parti 2–7 j / finalise ton compte Stripe + CTA / gelé), litige calme + « Donner ma version », `DeliverPhotosBlock`, succès sans « Noter » et copie honnête, lignes « Mes trajets » à l'état réel + `PayoutBlockedBanner` ; deal 384 | ✅ mergée #131 |
| B4 · `feat/b4-late-cancel-payout` — **D50 / A79–A82** : `computeLateCancellationCompensationCents` (retenue × net ÷ total), transition CANCELLED avec `retentionCents` / `retentionDisposition` (CARRIER avant le départ → `payoutStatus PENDING` + compensation immédiate par l'exécuteur injecté ; HELD_FOR_MEDIATION après), exécuteur élargi aux CANCELLED (`reason` LATE_CANCELLATION), cron passe 2 sur PENDING/FAILED, email Voyageur en variante + ligne « la retenue revient au Voyageur » dans le remboursement, carte et lignes Voyageur, copie modale Expéditeur ; deal 390 · notification 76 | ✅ mergée #133 |
| Finances · `feat/wallet` — **A83–A84** : `GET /me/wallet` (deal-service, service pur testé, totaux serveur, deux rôles, proxy gateway), `ShipperBookingView` + `capturedAt` / `refundedAt` / `refundAmountCents`, `POST /carrier/stripe/dashboard-link` (auth-service, login link Express), section Finances réelle (onglets, 3 cartes, lignes cliquables, bandeau Stripe, bouton tableau de bord, next-intl `finances`) | ✅ mergée #135 |
| Fix · `fix/tracking-absent-composite` — **A85** : jalons de voyage en 409 sur les deals réels (liste composite absente, 4e occurrence du pitfall Mongo) — writer crée les listes, garde optimiste `updatedAt`, script `repair-absent-lists.ts` joué (3 + 23 documents), `CLAUDE.md` mis à jour | ✅ mergée #137 |
| B4 · `chore/b4-hardening` — **A86–A89** : plafond de rejeu 100, webhooks Connect (`account.updated` → drapeaux + rejeu immédiat, `transfer.reversed` → REVERSED, `payout.failed` → Voyageur prévenu), récapitulatif quotidien support (`OPS_DIGEST_CRON_ENABLED`), fenêtre « Ta session a expiré » (client API + `SessionExpiredGate`), copie « Versement parti », seed deal bloqué ; deal 402 | ✅ mergée #139 |
| UX · `feat/notifications-vivantes` — **A91** : polling 30 s + focus, copie par événement et rôle avec prénom servi (`counterpartFirstName`), cloche desktop = menu 5 dernières + « Tout marquer lu » (`PATCH /me/notifications/read-all`), email d'atterrissage (matrice A35 amendée), contrat notification accepte les types système ; notification 77 | ✅ PR ouverte |
| Décisions candidates à graver : « la CI construit ce qu'elle déploie » (`next build`), règle de couleur des CTA (mango = avancer, teal = engager), D35 email provider | ⬜ |

## 8. Chiffres de suivi

| Indicateur | Valeur |
|---|---|
| Tests (plateforme) | 677 = trip 198 · deal 402 · notification 77 (+ auth-service 65, check CI « Tests unitaires (auth-service) ») |
| Décisions au registre | D1 → D52 (+ arbitrages A1 → A89) |
| Règles métier | ~50 (V2) + RG-B-01…35, RG-S-01…13, RG-C-01…16, RG-G-01…03, RG-D-01…16, RG-V-01…09, RG-F-01…06, RG-N-01…08, RG-T-01…06, RG-P-01…27, RG-A-01…08, RG-C-17…19, RG-FAV-01…06, RG-A-09…12, RG-C-21, RG-PAY-01…11, RG-LIT-01…07, RG-E-01…08, RG-VOY-01…07, RG-ANN-01…06, RG-FIN-01…05, RG-P-14, RG-H-01…05, RG-NOT-01…05 |
| PR mergées | #1 → #139 (#90 = pile B2-PR1/2/3 · #91 = docs post-merge · #92 = B2-PR4 emails · #93 = B2-PR5 tracker · #94 = docs post-merge · #95 = B3-PR1 serveur · #96 = B3-PR2 front · #97 = docs · #98 = B3-PR3 boîte du Voyageur · #99 = docs · #100 = B3-PR4 page demande · #101 = docs · #102 = typographie Deal · #103 = docs · #104 = fix ImageKit · #105 = docs · #106 = visionneuse photos · #108 = docs · #109 = fix relay outbox · #111 = allowedDevOrigins LAN · #112 = backlog inscription · #113 = atterrissage post-OTP · #114 = redirect inscription→connexion · #116 = fix recette auth · #117 = email-locale D44/D45 · #118 = modale de réservation A58 · #119 = favoris D46/A59 · #120 = pages auth D45/A60 · #121 = Google D47/A61 · #122 = « Rester connecté » A62 · #123 = connexion dans la fenêtre A63 · #124 = API même origine D48 · #125 = « Suivre » en modale A64 · #126 = docs suivi · #127 = B4-PR1 serveur D49–D52 · #128 = docs suivi · #129 = B4-PR2 tracker Expéditeur A71–A74 · #130 = docs suivi · #131 = B4-PR3 côté Voyageur A75–A78 · #132 = docs suivi · #133 = retenue ANN-01 D50/A79–A82 · #134 = docs suivi · #135 = Finances A83–A84 · #136 = docs suivi · #137 = fix jalons A85 · #138 = docs suivi · #139 = durcissement B4 A86–A89 — 13 checks comptés à chaque fois) |
| Documents | registre, spec, règles, 5 handoffs (dernier : SESSION-2026-08-28 + addendum 29/08), fiches PR (archive), 3 docs cumulatifs (technique, métier, apprentissage), `YAMBA-MOTEUR-PRIX.md/.pdf`, ce suivi |

## 9. Ordre recommandé des prochaines sessions

1. **B2 : SOLDÉ** (PR1 naissance, PR2 cycle de vie, PR3 front É2, PR4 emails, PR5 tracker). Restes rattachés à B3 : photos, AES code, actions tracker réelles.
2. **B3 transport** : PR1 serveur (#95) et PR2 front faites le 02/09 → **B4 argent sortant** (1,5–2,5) puis **B5 confiance** (1,5–2).
3. PR « paramètres serveur » (0,5) + cleanup legacy (0,5) + seeds (0,25) — entre deux lots.
4. Jalon 2 : admin-ui (C), Sentry/PostHog, provider email, sessions — **constitutif du lancement**.
5. UX différées (step 1, chips lieux, messages par route) — quand le funnel réel donne des chiffres (PostHog).
6. **Jalon 4 mobile** : graver D36 (stack + périmètre) dès que B2 est en route, pour que le client OpenAPI et les contrats soient conçus « mobile-ready » (tokens, pagination, erreurs typées) ; puis Jalon 5 iOS.
