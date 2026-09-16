# YAMBA — Contexte projet pour Claude Code

## Le projet

Yamba est une marketplace P2P de transport de colis legers entre particuliers
(modele BlaBlaCar du colis). Un Voyageur ("Yamber"/"Tripper" en UI, `carrier`
en code/DB) publie un trajet et vend sa franchise bagage au kilo ; un
Expediteur ("Shipper") lui confie un colis. Vision universelle et globale ;
premiers corridors franco-africains (Paris-Brazzaville en seed), mais marque
neutre et mondiale des le lancement.

Fondateur solo : Telama. Docs internes en francais ; surfaces publiques
(OAS, messages d'erreur API, event keys) en anglais.

## Stack

Nx monorepo (Nx 22, Node 22) · Next.js 16 App Router · Express TypeScript ·
Prisma + MongoDB Atlas (replica set, transactions OK) · Redis/Upstash ·
Stripe Connect Express · Redpanda/Kafka (kafkajs via @packages/messaging) ·
Tailwind (mango #FF9900 + teal #0F766E, dark/light par classe) · React Query ·
next-intl FR/EN · Nodemailer+EJS · JWT + refresh tokens · Cloudflare R2.

Services : apps/user-ui · auth-service :6001 · trip-service :6002 ·
deal-service :6003 · notification-service :6004 · api-gateway :8080.
A naitre : payment-service :6008 · media-service :6009 (B2) ·
message-service :6005 (jalon 3) · admin-ui (jalon 2).
Ordre de demarrage : auth -> trip -> gateway.

## Sources de verite (a lire avant toute tache)

- context/YAMBA-REGISTRE-DECISIONS-ROADMAP-v1.3.md — arbitrages D1-D43 (A1-A42),
  roadmap 3 jalons, backlog maitre §7. TOUTE decision d'architecture y est
  gravee AVANT le code. C'est LE document maitre : si ce fichier-ci et le
  registre divergent, le registre gagne.
- context/YAMBA-REGLES-METIER-V2.md — regles PRC/CAT/COM/CAP/ANN/CNF/GAR/
  SES/REP (~50 regles). Appliquees cote serveur, le front est indicatif (D4).
- context/mockup-pricing-yamba.html — LA spec du formulaire pricing
  (D13-D16 sur piece).
- Le dernier handoff de session dans context/ (YAMBA-CONTEXT-HANDOFF-*.md)
  — l'etat exact du chantier en cours.

## Les 3 jalons (le mot "MVP" est banni du referentiel)

- Jalon 1 — Boucle transactionnelle : reserver, payer, livrer, noter.
- Jalon 2 — Plateforme operable : admin-ui et outillage. CONSTITUTIF du
  lancement public (le lancement = fin du jalon 2, pas du jalon 1).
- Jalon 3 — Expansion : chat, locales, reco (le mobile en sort : jalons 4 et 5).
- Jalon 4 — Application mobile, socle + Android : une seule base React Native /
  Expo (TypeScript) reutilisant @packages/pricing, @packages/api-contracts et
  le client genere depuis l'OpenAPI (D3) ; parcours Expediteur et Voyageur ;
  publication Google Play (D36 (gravée) : stack et perimetre).
- Jalon 5 — iOS : meme base, specificites Apple (Sign in with Apple, Apple Pay,
  review App Store, TestFlight), publication App Store.

## Ce qui est FAIT (aout 2026)

- CI GitHub Actions : 17 required checks sur dev (TypeScript x9 dont admin-ui et
  message-service, Tests unitaires x5 : auth, deal, notification, trip, message,
  Build des services (webpack, six services — 05/09), i18n (parse, miroir FR/EN,
  pas de point dans une cle), Anti-fuite, Contrats OpenAPI). A AJOUTER :
  `next build` user-ui (le build prod a casse sans que la CI le voie, #81).
- Session auth (D27) : inactivite serveur + duree absolue (solde au jalon 2).
- Chantier 0 OpenAPI : @packages/api-contracts (Zod), OAS trip-service
  99 paths x3, job CI de diff. (Conversion auth-service : au backlog.)
- B1 FERME : deal-service (modele Booking, state machine 12 transitions,
  GET par role DTOs whitelist, outbox + relay Redpanda, 218 tests),
  notification-service consumer (dedup event-id, 21 tests), dashboard et
  listes user-ui sur donnees reelles. PRs #70-#74, #76.
- Refonte pricing PR-A (#77) : schema Trip PER_KG (pricePerKgCents,
  capacityKg, checkedBag23PriceCents, cabinBag12PriceCents,
  familyConditions), contrats etendus, gate A28 bi-moteur (8 specs, branche
  sur publishTrip + updateTrip), seed trip bzv-perkg (matiere de QA).
- Refonte pricing PR-B (#82) : StepConditions « depot en 90 s » (prix +
  capacite pre-remplis par la suggestion D15, familles Accepte/Refuse +
  supplement, bagages suspendus si capacite insuffisante RG-B-29,
  accordeons, popovers), autocompletion villes/aeroports « Ville, Pays »,
  page trajet proprietaire (Modifier), prix au kilo affiche en recherche
  et detail ; serveur : POST /trips ecrivait 0 champ PER_KG (corrige, gate
  A28 sur les 3 chemins), checkBagCapacity, updates par paquets (limite
  Atlas 50 etapes). D31 et D32 (plancher 0,5 kg / 8 EUR) au registre.
- Recherche + page trajet PER_KG (#83) : D33 comparablePriceCents (colis
  de reference 2 kg, backfill), filtre par FAMILLE (le filtre categorie ne
  cache plus les PER_KG), poids du colis (prix par carte, tri, capacite),
  OfferCard sur la page trajet, CO2 pour le poids, annulation alignee
  ANN-01, suggestion de prix PAR CORRIDOR (15 zones + domestique, valeurs =
  hypotheses dans lib/pricing-corridors.ts), D32 annoncee a l'ecran.
- Chores : #78 next-intl/Nx, #79 context/ versionne + CLAUDE.md, #80
  ThemeProvider root, #81 build prod repare (Suspense).
- B2-PR1 (naissance du deal, D37/D38) : `POST /deals/payment-intents` +
  `POST /deals` (deal-service), `@packages/payments` (PaymentProvider D11 :
  Stripe capture manuelle + Fake), devis serveur = moteur unique (409
  QUOTE_DIVERGENCE), snapshot D17 enrichi (7 champs D34) + lieux de
  remise/retrait, reservedKg atomique + 2 events outbox EN TRANSACTION,
  wizard branche sur l'API (un seul Payment Element, A30), 24 tests.
  Prouve de bout en bout sur Atlas + Stripe test (29,57 EUR autorises,
  2 kg reserves, rejeu refuse).
- B2-PR2 (cycle de vie du deal, D39/D40) : `POST /deals/:id/accept`
  (charte + gate D31 DEPLACE ici — les 2 checks profil/Stripe retires des
  3 chemins de publication trip-service — puis CAPTURE a l'acceptation,
  D39), `POST /deals/:id/decline` (raison parmi 5, liberation de
  l'empreinte, kg restitues CAP-02), `POST /deals/:id/cancel` (ANN-01 :
  100 % jusqu'a J-2, retenue 50 % ensuite — CANCEL_LATE_RETENTION_PCT
  grave a 50), cron expiration 24 h (deal-service, toutes les 5 min,
  BOOKING_EXPIRY_CRON_ENABLED), webhook `POST /webhooks/stripe` (D40 :
  source de verite — payment_intent.canceled → SYSTEM cancel d'un PENDING,
  nouvelle transition machine), partout : argent d'abord (PaymentProvider)
  puis UNE transaction Mongo conditionnelle + outbox. +46 tests.
- B2-PR3 (front des transitions, A31–A33) : ecran Voyageur E2
  (`/carrier/deals/[dealId]`) branche sur les VRAIES API — GET /deals/:id
  via un adapter whitelist (`deal.adapter.ts`), accept/decline reels
  (hook partage desktop/mobile, mapping des 409 : onboarding D31 →
  redirection, TRANSITION_NOT_ALLOWED → relecture), raisons de refus
  alignees contrat (textarea supprime, A32), gains = net seul (A13),
  CTA pilotes par `allowedActions` (jamais par le statut). Annulation
  Expeditrice dans Mes envois : bouton si `cancel` permis, modale avec
  `cancellationPreview` SERVIE par la vue Shipper (A31 — ANN-01 jamais
  recalcule au front), POST /deals/:id/cancel puis relecture. Seed :
  CarrierPage COMPLETE/Stripe factice par Voyageur + intents
  `pi_fake_seed_*` adoptes par le FakePaymentProvider (A33) — parcours
  B2 jouables en dev sans cles. TanStack Query sur le module deal
  (invalidation, jamais de mutation locale du statut). +4 tests.
- B2-PR4 (emails transactionnels booking.*, D41/A35/A36) : le canal EMAIL de la
  matrice A15 dans le MEME consumer que l'in-app — `@packages/email` (3e clone
  evite, transport paresseux, provider D35 branchable derriere), `EMAIL_MATRIX`
  totale en data (7 cles actives : requested→carrier avec gains+deadline,
  payment_authorized→recu shipper, accepted/declined/expired→shipper,
  cancelled→shipper + carrier si wasAccepted, refund_issued→shipper ; les cles
  B3/B4/B5 arrivent avec leur writer), idempotence at-most-once par destinataire
  (modele `EmailDelivery` unique [eventId,userId], claim-first, echec = FAILED
  trace sans throw — best-effort), jointure User a l'envoi (RGPD : efface =
  saute), 8 gabarits EJS FR/EN (charte teal/mango/slate, jamais le code de
  livraison — teste sur le HTML rendu), +29 tests dont rendu EJS reel.
- B2-PR5 (tracker Expediteur, A37) : /bookings/[id] branche sur GET /deals/:id
  (vue Shipper) par un adapter CONSERVATIF qui produit le view-model existant
  (~40 fichiers de vues E3/E4b/E6/E8/E9 intacts ; vocabulaire absorbe a la
  frontiere : PENDING→AWAITING_CARRIER, COMPLETED→VERIFIED, cents→euros),
  TanStack Query, fin du fallback menteur (BookingStatusNotice pour attente/
  refuse/expire/annule/termine/litige), degradations honnetes (stats Voyageur
  B5, carte Stripe backlog, code AES B3 : lignes masquees, jamais inventees),
  mocks de donnees supprimes ; actions regenerer/confirmer/litige encore mock
  (basculent avec B3/B4). Preuve : tsc + build prod + script adapter 25
  assertions.
- B3-PR1 (transport serveur, D42/D43, A38-A42) : `POST /deals/:id/pickup`
  (checklist 5/5 + 1..5 photos ImageKit — D42 —, code de livraison GENERE
  par le serveur : bcrypt + AES-256-GCM `deliveryCodeEncrypted` — D43 —,
  revele a l'Expediteur SEUL sur GET /deals/:id en PICKED_UP, jamais en
  liste/event/email), `/pickup/refuse` (raison parmi 5, remboursement
  INTEGRAL reel puis CANCELLED + CAP-02, sans penalite — A40), `/events`
  (jalons optionnels, sequence stricte, undo client seul — A39),
  `/code/regenerate` (Expediteur, <= 5, essais remis a zero),
  `/deliver` (bcrypt, 3 essais puis verrou 15 min ET compteur a zero — A38,
  payoutDueAt = J+4). `@packages/delivery-code` (lib pure, aussi importee
  par le seed), `booking-write.ts` (socle transaction/chargement partage),
  4 emails B3 (A41 : picked_up / pickup_refused / code_regenerated /
  delivered → Expediteur, garde-fou « aucune suite de 6 chiffres »), seed
  avec vrai code `742891` + checklist. Annexe A42 : `CarrierPage.primaryAddressId`
  n'est plus @unique (collision sur null, db push fait). E2E Atlas :
  33 verifications vertes, outbox sans code, kg restitues. +60 tests.
- B3-PR2 (transport front, A43) : les 4 mocks Voyageur et la regeneration
  Expeditrice basculent sur les endpoints #95 — pickup avec upload ImageKit
  AVANT l'appel (sequentiel, premier echec = rien d'envoye), refus = raison
  seule (textarea supprime, miroir A32), jalons envoyes A LA FIN de la
  fenetre d'undo (`onEventCommittedAction`, rollback sur 409), saisie du
  code a compteur SERVEUR (vue Carrier + details des 409, plus de compteur
  client), regeneration puis invalidateQueries (le code vient toujours de
  GET /deals/:id), `deliveryCode.status` VALIDATED apres livraison.
  Preuve : tsc + build prod + i18n miroir (pas de Jest user-ui).
- MERGE 02/09 : **#95** (B3-PR1 serveur) puis **#96** (B3-PR2 front) — 13 checks
  comptes a chaque fois, branches purgees.
- B3-PR3 (boite du Voyageur, A44) : recette a deux vrais comptes → le Voyageur
  n'avait AUCUN chemin vers ses demandes (Mes trajets sans deals, notifications
  non cliquables, `pendingDemandsCount` jamais servi). `GET /me/deals` (vue
  Carrier, tous trajets, gateway `/api/me/deals`), hook `useMyDeals` + adapter
  vers le view-model du mock, bande « A traiter » (repondre/prise en charge/
  livraison) dans Mes trajets ET a l'accueil, deals reels sous chaque trajet
  (`TripDealRow` extrait du mock), section sur la page trajet, notifications =
  liens (deal ou suivi selon le lecteur), badge partage sidebar + barre mobile
  (`useTripsBadge`). Preuve : tsc, build prod, i18n, GET /me/deals sur Atlas.
  MERGE **#98** (13 checks comptes, branche purgee).
- B3-PR4 (page demande Voyageur, A45) : recette reelle etape 4 → photos
  declarees JAMAIS envoyees depuis B2-PR1 (`photoUrls: []`) → le wizard les
  televerse (ImageKit `/bookings/declared`) AVANT la carte ; colonne
  Accepter/Refuser invisible entre 768 et 1023 px → dès `md` ; GAR-02
  (« Garantie Yamba », « Protection etendue », plus jamais « assurance »
  avant contrat — carrierDealRequest, tracker, wizard, home) ; RGP-02
  (telephone « a la prise en charge ») ; `BookingCounterpart.publicSlug`
  → « Voir profil » reel vers /u/[slug]. deal-service 355 tests. MERGE **#100**.
- Plateforme de tests : 601 (trip 187, deal 355, notification 59) — post-#100.
- 02/09 apres-midi (recette reelle a deux comptes, LAN) : #102 typographie Deal
  (A46), #104 fix SDK imagekit 1.5.0→6.0.0 (A47 — aucun upload ne marchait),
  #106 visionneuse photos partagee (A48), #109 fix relay outbox — aucun
  evenement reel n'etait relaye, pitfall null/absent 3e occurrence (A49),
  #111 allowedDevOrigins (Next 16 bloque /_next hors localhost), #113
  atterrissage post-OTP, #114 redirect conserve inscription→connexion.
  Recette OK jusqu'a F1 ; reste F4→F7, D1–D7, V1–V9 (utilisateur). dev = 3370efa.
- 03/09 matin (retours de recette auth, decisions utilisateur) : PR #116
  fix/auth-recette (A50–A54) — critere de mot de passe NOMME (codes serveur
  PASSWORD_* / EMAIL_ALREADY_USED traduits par le front), messages OTP construits
  des codes (plus d'anglais brut), bareme OTP par paliers de 5 avec code
  invalide, fenetre d'inscription 30 min prolongee au renvoi, "5 minutes" →
  duree injectee (10), sujets OTP en francais, oeil centre, photos manquantes
  retirees du pool ; D44 (langue des emails, N langues) et D45 (tutoiement,
  prenom reel) GRAVEES avant leur code. Backlog priorise P1→P3 dans
  YAMBA-SUIVI-PROJET.md §7.
- 03/09 midi : feat/email-locale (D44/D45 implementees, A55–A57) —
  User.preferredLocale, SUPPORTED_LOCALES unique (api-contracts/locale.ts,
  consommee par next-intl), x-locale sur chaque requete, PATCH /auth/me/locale
  a la bascule header, gabarit partage packages/libs/email (chaine EJS) + 7
  emails auth en dictionnaires fr/en (ancien mailer supprime),
  notification/trip dans la langue du destinataire, prenom reel de la
  contrepartie dans 5 gabarits. Plateforme 610 + auth 59.
- 03/09 apres-midi : feat/booking-auth-modal (A58) — porte « Connecte-toi pour
  reserver » en modale sur la page trajet (desktop + feuille mobile), retour
  dans le wizard ; « Connexion » / « Creer un compte » du header transmettent
  la page courante en redirect (hors pages auth et accueil).
- 03/09 : #116, #117, #118 fusionnees par l'utilisateur (dev = bb57c49), puis
  #119 → #124 dans l'ordre et #125 (dev = e698364, 13 checks comptes a chaque
  fois, branches purgees). Backlog recette 03/09 entierement dans dev.
  feat/trip-favorites (D46, A59) — TripFavorite, POST/DELETE /trips/:id/favorite,
  GET /trips/favorites, isFavorite sur recherche + fiche (authent optionnelle),
  coeur optimiste, page « Mes favoris » ; trip-service 198 tests. Plateforme 621.
- 03/09 : feat/auth-pages-ux (D45, A60) — tutoiement des six formulaires auth,
  promesses produit a la place des faux chiffres, champs 16 px mobile,
  AuthGateModal generique + porte « Partager un trajet » en modale (demande
  utilisateur). Reste ouvert : nom du role (Yamber / Tripper / Voyageur).
- 03/09 : feat/auth-google (D47, A61) — AuthIdentity, POST /auth/google (jeton
  verifie serveur, rattachement par email verifie, consentement obligatoire a la
  creation), bouton officiel GIS + ecran « Finalise ton compte ». Sans
  GOOGLE_CLIENT_ID / NEXT_PUBLIC_GOOGLE_CLIENT_ID : bouton inerte, API 503.
  A FAIRE par l'utilisateur : ID client OAuth Google Cloud (voir .env.example).
- 03/09 : fix/session-remember-default (A62) — « Rester connecte » decoche par
  defaut + aide sur les durees ; D27 inchange (le serveur expirait bien, la case
  cochee par defaut donnait 7 j d'inactivite a chaque connexion de recette).
- 03/09 : feat/auth-gate-inline-login (A63) — la porte d'identite embarque le
  formulaire de connexion (LoginForm variante modal, Google inclus), reprise du
  geste apres connexion ; plus aucune redirection vers /login depuis un geste.
- 03/09 : chore/api-same-origin (D48) — proxy Next /api/* → gateway (opt-in
  API_PROXY_TARGET + NEXT_PUBLIC_API_BASE_URL=/api) : cookies first-party sur
  tout hote, fin du piege localhost/LAN. Backlog recette 03/09 : SOLDE (P1→P3).
- 03/09 : feat/follow-auth-gate (A64) — bouton « Suivre » du profil public
  /u/:slug → porte d'identite en modale (formulaire embarque), suivi applique
  apres connexion sans quitter le profil ; derniere redirection /login sur un
  geste supprimee.
- 03/09 : B4-PR1 feat/b4-payout-server (D49–D52, A65–A70) — confirm anticipe,
  dispute (DELIVERED avant J+4 ; PICKED_UP « non livre » 48 h apres le depart),
  cron J+4 + rejeu des versements + rappel J+3, PaymentProvider.transfer
  (Stripe source_transaction, chargeId stocke a la capture), modele Dispute,
  5 emails en dictionnaire D44. Decisions utilisateur 03/09 : DISPUTED reste
  terminal, chantier C (admin) juste apres B4 ; retenue ANN-01 au prorata
  (PR dediee). Reste : PR2 front Expediteur, PR3 front Voyageur.
- 03/09 : B4-PR2 feat/b4-shipper-front (A71–A74) — tracker Expediteur reel :
  confirm (bouton secondaire) et dispute branches sur l'API, vues COMPLETED et
  DISPUTED, « Signaler un colis non livre » en transit garde par allowedActions
  + disputeOpensAt (servi), photos de litige uploadees a la selection. Reste :
  PR3 front Voyageur (payoutStatus, echec + CTA Stripe, disputeCategory, photo
  optionnelle a la remise), puis retenue ANN-01, puis chantier C.
- 03/09 : B4-PR3 feat/b4-carrier-front (A75–A78) — cote Voyageur : vues
  DELIVERED / COMPLETED / DISPUTED, etat du versement (payoutBlocker servi :
  ACCOUNT_NOT_READY → CTA onboarding Stripe + bandeau Mes trajets ; RETRYING →
  rien a faire), photo optionnelle a la remise (deliveryPhotoUrls, visible
  Expediteur + mediation), litige calme + « Donner ma version » (mailto).
  Reste B4 : retenue ANN-01 (D50), portefeuille (A77) ; puis chantier C.
- 03/09 : feat/b4-late-cancel-payout (D50, A79–A82) — la retenue ANN-01 revient
  au Voyageur au prorata de sa part nette, IMMEDIATEMENT a l'annulation (executeur
  injecte), sauf annulation apres le depart (HELD_FOR_MEDIATION, chantier C) ;
  rien de retroactif ; email variante + ecrans. B4 SOLDE hors portefeuille (A77).
- 03/09 : feat/wallet (A83–A84) — Finances reelle : GET /me/wallet (totaux
  serveur, deux roles, service pur teste), lien tableau de bord Stripe Express,
  section a onglets sous next-intl. B4 SOLDE. Suite : chantier C (admin).
- 03/09 : fix/tracking-absent-composite (A85) — jalons de voyage en 409 sur
  les deals reels : liste composite ABSENTE (pitfall Mongo, 4e fois) ; writer
  cree les listes, verrou optimiste updatedAt, script repair-absent-lists joue.
  Regeneration du code signalee en recette : cause non etablie (ligne gateway
  a fournir), hypothese session expiree (A62, 60 min).
- 03/09 : chore/b4-hardening (A86–A89) — plafond de rejeu 100, webhooks Connect
  (account.updated → rejeu immediat, transfer.reversed → REVERSED, payout.failed
  → Voyageur prevenu), recap quotidien support, fenetre « session expiree ».
  GESTE UTILISATEUR : second endpoint webhook Stripe (comptes connectes) +
  STRIPE_CONNECT_WEBHOOK_SECRET. Suite : vocabulaire Voyageur (PR copie), B5.
- 03/09 : chore/vocabulaire-voyageur (A90) — « Voyageur » / « Traveler » partout dans
  l'UI, identifiants inchanges. D45 (nom du role) CLOS.
- 03/09 : feat/notifications-vivantes (A91) — polling 30 s, copie par evenement
  et role avec prenom servi, cloche = menu + tout marquer lu, email d'atterrissage.
  Suite : B5 Confiance (points a trancher).
- 03/09 : B5-PR1 feat/b5-rating-server (D53, A92–A94) — notation double-aveugle
  (14 j, une fois par role), relances J+5/J+7, reputation denormalisee (D29①),
  profil public sur avis reveles. Reste PR2 front (ecrans, boutons, niveaux).
- 03/09 : B5-PR2 feat/b5-rating-front (A95–A97, decisions 1A–6A) — etat de
  notation servi avec le deal (canRate machine), ecrans reels sans ancrage,
  carte « Noter » partagee, listes/accueil sur canRate, profil : niveau + faits
  + pouces + « Signaler cet avis » (mailto). Mergee #146. Suite : chantier C
  (admin-ui, points a trancher avant code).
- 03/09 : C-PR1 feat/c1-admin-socle (D54, A98–A101, decisions 1A 2A 3A 4B 5A 6A
  7A 8A) — admin-ui separee (3001), 2FA TOTP obligatoire (lib maison, codes de
  secours, anti-rejeu), cookies admin_* separes, journal AdminAction en
  transaction, file « a arbitrer » + dossier en lecture, grant-admin.ts.
  Mergee #148. Suite : C-PR2 mediation (decisions + argent), C-PR3 signalements, C-PR4
  parametres, C-PR5 billets.
- 04/09 : C-PR2 feat/c2-mediation (D55, A102–A104, decisions 1A–7A) — version du
  Voyageur dans l'app (72 h), decisions rejet/partiel/total + retenue, argent
  remboursement puis executeur, pas de note apres mediation, ecrans des deux roles,
  admin-ui decision, seed bzv-held. Mergee #153. Suite : C-PR3 (a trancher :
  users / trajets / finances / KPI demandes par l'utilisateur le 04/09).
- 04/09 : C-PR3 feat/c3-admin-users (D56, A105–A107, decisions 1A–7A + invitation)
  — profils admin, invitation sans role client, conflit d'interets, fiche + recherche,
  sanctions RESTRICTED/SUSPENDED (propose/applique/leve), sessions admin + alerte,
  Sentry. Mergee #155. Suite : C-PR4 trajets/billets, C-PR5 finances, C-PR6 pilotage.
- 04/09 : C-PR4 feat/c4-admin-trips (D57, A108–A110, decisions 1A–8A + KPI par profil)
  — file « billets a verifier » (motifs fermes, expiration a la lecture, redepot),
  « masque par Yamba » (Trip.hiddenByAdminAt lu par recherche / page publique /
  reservation, proposition Support, email generique), fiche et liste trajets admin,
  KPI d'accueil par permission (/admin/kpis, /home), bandeau Voyageur, seed billet.
  Mergee #157. Suite : C-PR5 finances.
- 04/09 : C-PR5a feat/c5a-admin-finances (D58, A111–A113, decisions 1A–8A « go avec tes
  recommandations ») — files d'exception (echecs, renverses, retenues), fiche argent de
  tout deal, rapprochement fournisseur lecture seule (PaymentProvider.inspect, refundId
  stocke), rejeu manuel, cloture d'un renversement (RESENT nouvelle cle / WRITTEN_OFF),
  rejeux espaces sans plafond (payoutNextRetryAt), KPI payoutsReversed, admin-ui
  /finances + /deals/[id], seed bzv-reversed. Mergee #159.
- 04/09 : C-PR5b feat/c5b-admin-finances-report (D58 5A / 3A-c, A114–A116) — rapport
  mensuel par devise (chaque fait a sa date, passifs du jour), export CSV journalise
  (FINANCE, <= 366 j, formules neutralisees), remboursement manuel propose (FINANCE /
  SUPPORT) et applique par SUPER_ADMIN (argent d'abord, verrou sur le cumul, outbox
  refund_issued ADMIN), portefeuille Expediteur : remboursement apres COMPLETED visible,
  file PROPOSED_REFUNDS, KPI, admin-ui /finances/report. Mergee #160.
- 04/09 : C-PR6a feat/c6a-admin-pilotage (D59, A117–A119, « oui pour toutes les
  recommandations » + vues affichees sur le web) — courbes serveur par semaine ISO / mois
  (petits multiples, cache Redis 60 s), corridors (trajets, demandes, taux, €/kg, litiges,
  vues, recherches, sans resultat, « demande sans offre »), chronologie complete d'un deal
  (outbox + journal + notifications + emails, whitelist, journalisee), compteur de vues D5
  (Redis, dedoublonne, affiche recherche + detail), recherches par corridor. Suite :
  C-PR6b alertes de seuil, C-PR7 signalements / anti-fraude, C-PR8 parametres / RGPD ;
  chantier F chat a challenger apres C.
- 04/09 : C-PR6c feat/c6c-admin-pilotage-v2 (D60 3A / 4A, A120–A122 ; retours recette
  « OK pour toutes les recommandations GO ») — courbes deux par ligne et agrandissables
  (tableau + drill-down par point vers comptes / trajets / deals, borne 200, inscriptions
  journalisees), onglet Finances du pilotage (meme buildSeries), pastille « n vues » et
  badge « Populaire » (20 vues) sur cartes et detail public. D60 grave aussi : profils
  cumules (C-PR3bis), recherches + exports encadres RGPD (C-PR7a). Suite : C-PR3bis,
  C-PR7a, C-PR6b alertes, chantier F chat.
- 04/09 : C-PR3bis feat/c3bis-admin-roles (D60 1A, A123–A125) — User.adminRoles (liste) +
  adminRole miroir, adminRolesAllow (union), middleware / JWT / me, invitation et modification
  a cases (Comptes admin), garde dernier SUPER_ADMIN sur la liste, grant-admin --roles,
  backfill-admin-roles.ts ; sans transform Zod (OpenAPI). Suite : C-PR7a recherches / exports.
- 04/09 : C-PR7a feat/c7a-admin-search-exports (D60 2A, A126–A128) — filtres serveur
  (contrats + fonctions pures), tri, curseur sur utilisateurs / trajets / billets /
  a arbitrer ; exports CSV journalises : operationnels (FINANCE, MEDIATOR, ids seulement)
  et nominatif (SUPER_ADMIN, motif >= 20) ; lib @packages/libs/csv ; routes /export
  avant /:id. Suite : C-PR6b alertes, chantier F chat (challenge), C-PR8 RGPD.
- 04/09 : F-PR1 feat/f1-message-service (D61, A132–A134) — nouveau message-service (6005) :
  conversation par deal ouverte a l'acceptation, RENDEZ-VOUS objet (propose / accepte /
  contre-propose), fil avec gardes (code de livraison refuse par comparaison bcrypt,
  coordonnees signalees), numero revele 2 h avant le rendez-vous et trace, reponses rapides
  FR/EN, relais outbox dedie (topic messaging-events ; le relais deal-service filtre desormais
  aggregateType booking), OpenAPI 4e document, seed d'un fil. Suite : F-PR2 front + notifications,
  F-PR3 admin et purge.
- 04/09 : F-PR2 feat/f2-messaging-front (D61, A135–A136) — messagerie du tableau de bord
  (liste, fil, rendez-vous, reponses rapides, numero), bulle du header sur le vrai compteur,
  namespace i18n messaging FR/EN, sondage adaptatif 3 s / 20 s (pas de temps reel), second
  consumer notification (topic et groupe dedies) pour la notification in-app. Reste F-PR3 :
  email de relance, admin, purge.
- 04/09 : F-PR2b feat/f2b-deal-message-entry (A137) — les sept boutons « Message » / « Appeler »
  des ecrans de deal (tracker Expediteur, deal Voyageur) ouvrent le fil du deal via by-deal +
  ?conversation=<id> ; « Appeler » = fil avec ?focus=phone (numero ou heure d'ouverture), jamais
  un tel: direct. Aucun test serveur touche.
- 04/09 : F-PR3 feat/f3-messaging-admin (D61 6A/7A/8A, A138–A141) — relance email des messages
  non lus (15 min, une par heure, verrou optimiste, email sans le texte), lecture admin d'un fil
  journalisee (conversations.read), signalement d'un message (Report MESSAGE, file /reports,
  reports.review, KPI d'accueil, decision + journal en transaction), purge a un an (regle pure,
  cron nocturne). message-service 28 tests. MERGE 05/09 : **#171** (F-PR2b) puis
  **#172** (F-PR3) — 16 checks comptes a chaque fois. Chantier F : lots 1 a 3 SOLDES.
- 05/09 : recette dev post-merge — **#174** fix/messaging-recette-i18n-assets (cles systeme
  i18n imbriquees : next-intl refuse les points dans une cle ; src/assets/.gitkeep du
  message-service, sans lui le build webpack echouait et le service ne demarrait pas → 500
  gateway). Puis fix/messaging-quick-reply-draft (A142) : la reponse rapide remplit la saisie
  sans envoyer (RG-FCH-23) ; suppression d'un message NON retenue (RG-FCH-24, forme acceptable
  consignee) ; bulles invisibles sur telephone (grille sans minmax(0,1fr) sous lg → colonne
  plus large que l'ecran, reproduit en Chrome headless). Email de relance des non-lus confirme a 15 min (decision utilisateur 05/09).
  Suite : C-PR8 parametres / RGPD.
- 05/09 : chore/ci-build-i18n (#177) — job « Build des services (webpack) » + regle « pas de
  point dans une cle » du script i18n ; 17 checks requis.
- 05/09 : C-PR8a feat/c8a-platform-settings (D62) — catalogue de 40 parametres (classes A/B/C,
  portees metier / exploitation), document PlatformSettings versionne, lib @packages/libs/settings
  (cache 30 s, repli sur les defauts), rebranchement de deal / trip / message (la constante n'est
  que le defaut d'argument), ecriture auth-service /admin/settings (bornes, coherence, 403 par
  portee, 409 version, journal SETTING_CHANGED par cle, email aux SUPER_ADMIN, reset avec diff),
  profil OPS, GET /trips/pricing/params + wizard sur les valeurs serveur, admin-ui /settings +
  /settings/docs, seed-settings.ts, npm run settings-doc → context/YAMBA-PARAMETRES.md,
  SiteConfig supprime. MERGE 05/09 : **#178** (17 checks comptes). Suite : C-PR8b RGPD (PRIVACY),
  C-PR8c maintenance / etat des services.
- 05/09 : C-PR8b feat/c8b-gdpr (D63, A143) — sudo par code email (portee OTP « sudo »), export JSON
  de ce qui appartient au membre (une fois par 24 h), effacement immediat bloque par tout deal vivant
  (409 typee, liste fermee de motifs), anonymisation champ par champ en UNE transaction auth-service
  (exception assumee a D54 2A), ErasedAccount (Stripe id), DataRequest (registre), isAuthenticated et
  emails filtrent isDeleted, tiers destinataire efface a 30 j (cron deal-service, parametre
  privacy.recipientRetentionDays), profil PRIVACY (registre, users.erase, exports.personal A143),
  preference messagingReminderEmails (A138), user-ui « Mes donnees », admin-ui /privacy + carte
  d'effacement, @packages/libs/imagekit partage. MERGE 05/09 : **#180** (17 checks comptes).
  Suite : C-PR8c maintenance / etat des services / conservation.
- 05/09 : C-PR8c feat/c8c-maintenance (D64) — sante uniforme (@packages/libs/health, /health sur les
  cinq services + gateway), battement des crons dans Redis (withHeartbeat, onze crons), conservation
  chiffree (retention.* : notifications, emails, evenements consommes, outbox publie ; crons
  nocturnes par proprietaire, un parque n'est jamais purge), maintenance a deux interrupteurs
  (base journalisee + MAINTENANCE_MODE au gateway, 503 sur les ecritures hors auth / admin,
  GET /api/maintenance public, bandeaux sur les deux fronts), page admin « Etat des services »
  (GET /admin/status, sondage 30 s, editeur de maintenance). Gateway aligne (alias @packages,
  tsconfig). Chantier C : SOLDE (C-PR1 → C-PR8c). Candidat registre : moniteur externe de
  disponibilite avant le lancement. MERGE 05/09 : **#182** (17 checks comptes).
- Plateforme de tests : **990** (trip 257, deal 576, notification 115, message 42) + auth 225
  (09/09, post-campagne de recette « taches planifiees »).
- 08/09 : **CAMPAGNE DE RECETTE API (cahier n° 3) — TERMINEE ET ACCEPTEE**. 146 fiches, 145
  jouees, 1 en ⏭ justifie (CLI Stripe absente du poste, objet atteint par des evenements
  signes a la main). **54 fiches bloquantes, toutes jouees et fermees.** 22 anomalies
  trouvees, **22 closes** — aucune acceptee avec contournement. Les onze bloquantes :
  curseur en 500 (ANO-01), 404/400 discriminables au temps (02), secret TOTP servi par
  /auth/me (06), « mot de passe oublie » qui trahit l'existence d'un compte (08), export
  RGPD en 500 (09), plafonds non confrontes a la valeur declaree (12), page de suivi du
  destinataire en 500 (13), destinataire trop expose (15), boite de notifications illisible
  (16), **connexion enumerable par le temps, membre ET admin** (18), course aux derniers
  kilos rendue en 500 (19). Deux garde-fous systemiques en sont sortis : des tests qui
  **lisent les sources** et les confrontent a prisma/schema.prisma (7 aujourd'hui), et la
  regle « tout refus metier porte un details.code » tenue par un test sur deal-service et
  message-service. Deux reserves ecrites avant production : rejouer les fiches Stripe avec
  la CLI (API-HOOK-01), passer trip-service et auth-service au meme garde-fou (dette D-4).
  Rapport complet : `context/YAMBA-RECETTE-API-RESULTATS.md`. MERGES 08/09 : **#232 → #248**
  (17 checks comptes a chaque fois).
- 08/09 (soir) : **reserve n° 1 levee** — les fiches Stripe rejouees avec la VRAIE CLI
  (`brew install stripe/stripe-cli/stripe`, puis `stripe listen --api-key "$STRIPE_SECRET_KEY"`
  : pas de `stripe login` interactif necessaire). Chemin complet sur le vrai fournisseur en
  mode test : intention creee par l'API, confirmee en `requires_capture` avec `pm_card_visa`,
  deal cree dessus, puis `stripe payment_intents cancel` → Stripe emet l'evenement, le service
  le verifie et le deal passe CANCELLED / SYSTEM / PAYMENT_AUTHORIZATION_LOST. Rejeu
  (`stripe events resend` ×2) : 200 aux trois livraisons, UN SEUL booking.cancelled.
  **146 fiches sur 146 jouees, plus aucune en ⏭.**
- 08/09 (soir) : **dette D-4 soldee** — la regle « tout refus metier porte un details.code »
  est desormais tenue sur les QUATRE services : 250 refus codes (trip 81, auth 169) et deux
  garde-fous `refusal-codes.spec.ts` de plus. Deux defauts de SEMANTIQUE sont tombes avec
  (dette D-2 sur ces sites) : `findOwnedTrip` ecrasait « trajet introuvable » et « trajet
  d'autrui » en un seul 400 sans code, sur neuf routes → 404 TRIP_NOT_FOUND / 403
  NOT_TRIP_OWNER (verifie avant : aucun ecran du front ne branche sur ce 400). Les sept refus
  de `isAuthenticated` ont sept codes distincts (TOKEN_MISSING, TOKEN_INVALID, TOKEN_EXPIRED,
  USER_NOT_FOUND, ACCOUNT_DELETED, ACCOUNT_SUSPENDED, SESSION_REVOKED), `authorizeRoles` a
  ROLE_NOT_ALLOWED. **Plus aucune reserve au verdict de campagne.** Plateforme 941 tests.
  PIEGE NX paye une 2e fois : `npm run dev` sert la cible `build:development`, que
  `nx build --skip-nx-cache` ne rechauffe PAS → utiliser `NX_SKIP_NX_CACHE=true npm run dev`.
- 08/09 (soir) : **dette D-5 soldee** — douze refus passent par le middleware d'erreur commun
  (une seule forme de corps), qui recopie desormais `code` au premier niveau pour ne casser
  aucun client ; garde-fou `middleware-responses.spec.ts`. Deux exceptions ecrites : webhook
  Stripe et la reponse documentee ERASURE_BLOCKED.
- 08/09 (soir) : **ANO-API-23, BLOQUANTE, trouvee en soldant D-5** — les DEUX pages publiques
  (profil d'un membre, page d'un trajet) repondaient 404 : `profilePublic` / `isDeleted` sont
  ABSENTS des documents crees avant leur ajout au schema, et aucun filtre Prisma+Mongo ne
  matche un champ absent (`not` compris). Mesure : 404 pour 22 comptes sur 26 et 24 trajets
  publies sur 37. Deux tests PROTEGEAIENT le defaut (ils exigeaient l'ecriture fautive).
  Correction en deux temps : `repair-absent-scalars.ts` (donnees, idempotent, --dry-run) puis
  filtres remis en EGALITE SIMPLE. Limite decouverte : `isSet` n'existe que sur les champs
  OPTIONNELS — sur un champ requis a defaut, « absent » n'est pas exprimable en requete, c'est
  un defaut de donnees. Plateforme 941 tests.
- 09/09 : **dette D-3 soldee** — `DELETE /trips/{id}/documents/{documentId}` rendait 400
  « Document not found. » au rejeu ; elle rend 200 « deja supprime », comme la route voisine
  des fichiers. Un document d'un AUTRE trajet donne la meme reponse : pas d'enumeration
  d'identifiants. L'ordre des effets est inverse (base d'abord, fichier ensuite) : au pire un
  fichier orphelin, jamais une ligne qui pointe vers un fichier disparu. Corriges dans la
  meme passe, des statuts que D-4 avait laisses : 16 gardes `!req.user` en 400 → **401**, et
  3 refus de propriete en 400 `UNAUTHENTICATED` → **403 NOT_OWNER**. Garde-fou
  `idempotent-delete.spec.ts`. Plateforme **946 tests**.
- 09/09 : **dette D-1 soldee — le JOURNAL DE DETTE EST VIDE**. L'arbitrage n'etait pas a
  rendre : D44 le tranchait deja (« une locale par utilisateur, pas par appareil ») et le
  front tient `preferredLocale` a jour — c'est l'ATTENDU DU CAHIER qui etait faux (corrige).
  La vraie dette : la regle existait en TROIS exemplaires — les favoris ignoraient le compte,
  la recherche repondait toujours en francais sans `?locale=` (invisible depuis le front, qui
  passe le parametre ; visible pour tout autre client de l'API). Une seule fonction
  `resolveViewerLocale` (@packages/api-contracts) : `?locale` > compte > appareil >
  Accept-Language > defaut, une valeur non supportee ne consommant PAS son tour. Garde-fou
  `one-locale-rule.spec.ts` : aucun controleur ne lit `x-locale` sans passer par la regle.
  Plateforme **956 tests**. Bilan campagne : 23 anomalies closes, 5 dettes soldees.
- 09/09 : **CAMPAGNE DE RECETTE « TACHES PLANIFIEES » (cahier n° 4) — TERMINEE**. 90 fiches sur
  90 jouees, aucune reportee. **9 anomalies, 9 closes** (2 bloquantes, 4 majeures, 3 mineures).
  Les deux bloquantes : (a) **ANO-CRON-05** — la purge nocturne supprimait CHAQUE NUIT tous les
  evenements d'outbox NON publies (`{ publishedAt: { lt: cutoff } }` : en BSON `null` precede
  les dates), c'est-a-dire exactement ceux qu'une panne de courtier venait de laisser en file ;
  (b) **ANO-CRON-08** — un consommateur qui plante APRES son demarrage restait mort en silence,
  `/health` repondant `ok`, groupe `Empty`, plus une notification ni un email (declencheur :
  `rpk topic produce` compresse en snappy par defaut, que kafkajs ne sait pas lire). Les
  majeures : ANO-CRON-02 (aucun outil pour remettre un evenement parque en file), ANO-CRON-06
  (une panne de courtier de 100 s parquait des evenements sains — classification par NOM
  d'erreur), ANO-CRON-09 (un signalement dont le message est purge disparaissait de la file de
  moderation et restait OPEN pour toujours). Deux decisions gravees : **D76** (« un defaut
  d'infrastructure se signale par le retard ; il ne se solde ni par un parcage, ni par un
  silence » — classement par CAUSE, superviseur de consommateur avec retrait exponentiel et
  fenetre de stabilite, etat des consommateurs dans `/health`) et **D77** (« la conservation
  efface le propos, jamais le dossier de moderation »). Sept des neuf anomalies etaient
  INVISIBLES : ni test unitaire, ni tableau de bord, ni utilisateur ne les aurait trouvees — il
  a fallu provoquer la panne. Precaution de recette a retenir : `rpk topic produce -z none`,
  toujours. Rapport complet : `context/YAMBA-RECETTE-CRONS-RESULTATS.md`. Plateforme **989
  tests**. MERGE 09/09 : **#256** (17 checks comptes).
- 09/09 : **HARNAIS DE RECETTE NAVIGATEUR (Playwright, `apps/e2e`)** — les cahiers 01-WEB (328
  fiches) et 02-ADMIN (110) se jouent au navigateur ; a la main c'est plusieurs jours et cela ne
  se rejoue pas. Le harnais tourne contre l'environnement REEL (six services + Mailpit), avec
  trois navigateurs comme le cahier les decrit (Expediteur / Voyageur / visiteur), `workers: 1`,
  et il n'est PAS branche a la CI (elle garde ses 17 verifications). Lancement : `npx nx e2e e2e`.
  Deux pieges de poste desarmes dans la configuration : les cookies sont LIES A L'HOTE (front sur
  localhost + API sur une IP de reseau local = connexion 200 et AUCUN cookie), et `networkidle`
  ne dit rien de React (clic avant hydratation = formulaire envoye en GET). Chromium n'etant plus
  publie pour macOS 13, le harnais pilote le Chrome du poste.
  Deux anomalies des le montage : **ANO-WEB-01 (BLOQUANTE)** — un visiteur sans aucune session
  recevait la fenetre « Ta session a expire » sur `/fr/login`, dont le fond opaque BLOQUAIT le
  formulaire (correction : un marqueur de session, et le refus d'ouverture sur les ecrans de
  session) ; **ANO-WEB-02 (majeure)** — la porte « Connecte-toi pour reserver » affichait ses
  deux boutons sous les noms `booking.authGate.login` et `booking.authGate.register`, dans les
  DEUX langues (le miroir FR/EN ne voit pas une absence symetrique). Cinquieme regle ajoutee a
  `scripts/check-i18n-messages.mjs` : toute cle LITTERALE utilisee dans les sources existe
  (213 faux positifs ramenes a 0). Rapport : `context/YAMBA-RECETTE-WEB-RESULTATS.md`.
- 09/09 : **PARCOURS TRANSACTIONNELS DU HARNAIS (branche `chore/e2e-parcours`)** — WEB-E2E-1, le
  parcours BLOQUANT du cahier 01-WEB, passe en ENTIER : 29 etapes, trois navigateurs, 1 min 24
  (reservation 32,20 €, acceptation, rendez-vous propose/accepte, numero refuse avant 2 h
  (400 `TOO_EARLY`), lien de suivi et page destinataire qui ne revele RIEN, prise en charge 5/5
  + 2 photos, code lu par l'Expeditrice et JAMAIS dans l'email, trois jalons et UN seul email
  (atterrissage), remise contre le code (J+4), verification, confirmation anticipee, notation
  croisee secrete puis revelee, avis public signe). Deux fondations posees : les SESSIONS
  MEMORISEES (`storageState` sur disque, sondees avant reutilisation, rendues a la fermeture —
  le refresh fait une rotation du jti) et le NAVIGATEUR DU BACK-OFFICE (`seed-admins.ts` : sept
  comptes du cahier 02-ADMIN promus et enroles, code TOTP CALCULE par `packages/libs/totp`).
  **ANO-WEB-03 (majeure)** : sur grand ecran, un bouton de deal ouvrait le PREMIER fil de la
  liste au lieu du sien (deux effets React, le dernier gagnait) — corrige. Deux corrections de
  jeu d'essai (`publicSlug` a la mise a jour ; seed rejoue par le parcours). Le plafond du
  limiteur est surchargeable par l'environnement (`RATE_LIMIT_ANONYMOUS_MAX`, defaut inchange) :
  100 requetes anonymes / 15 min / IP etaient epuisees par les seuls visiteurs des parcours —
  point d'attention produit (NAT partage) note au rapport. Interposes et ecrits noir sur blanc :
  paiement FAKE, ImageKit, presse-papiers. auth-service **229** tests (+4). 15 scenarios e2e verts.
  MERGE 09/09 : **#259** (17 checks comptes). Reste : E2E-2 a E2E-6, les 32 chapitres 5.x, le cahier 02-ADMIN.
- 09/09 : **WEB-E2E-2, LE LITIGE (branche `chore/e2e-parcours-2`)** — le second parcours BLOQUANT
  passe en entier : 19 etapes, 30 s, quatre navigateurs (Joao, Thomas, la mediatrice du
  back-office). Signalement en quatre blocs (refus sous 50 caracteres, deux photos, engagement,
  numero YAM-XXXX), fil ferme, accuse et email calme (categorie seule, JAMAIS le recit ni les
  photos — A68), version du Voyageur (une fois, aucun email), decision de mediation dans
  admin-ui (partiel 15,00 € : recapitulatif 15,00 / 40,00 / 6,60 €, code de livraison absent du
  dossier), decision relue par chacun avec SON montant seul, aucun « Noter », ligne Finances.
  **ANO-WEB-04 (majeure)** : la vue Expediteur ne servait pas `completedBy` → « sans signalement
  de ta part » apres une mediation — contrat (whitelist, OpenAPI regenere) + mapper + front
  (« Clos par la mediation le … »). **ANO-WEB-05 (mineure, jeu d'essai)** : le seed ne capturait
  jamais le paiement a l'acceptation (`capturedAt`/`chargeId`) → le portefeuille lisait
  « Libere » au lieu de « Rembourse 15,00 € » ; corrige a la source. Reste a arbitrer (copie) :
  l'ecran « Transaction close » ignore encore la mediation ; la ligne Finances parle de
  « retenue reversee ». 16 scenarios e2e verts. MERGE 09/09 : **#260** (17 checks comptes). Reste : E2E-3 a E2E-6, les 32
  chapitres 5.x, le cahier 02-ADMIN.
- 09/09 : **WEB-E2E-3, L'ANNULATION TARDIVE (branche `chore/e2e-parcours-3`)** — troisieme parcours
  BLOQUANT vert : 15 etapes, 38 s (reservation 31,92 €, acceptation et capture, deux messages
  avec notification, fenetre « Annuler cet envoi ? » avec l'arithmetique ANN-01 refaite a partir
  des montants LUS a l'ecran (15,96 € rembourses, 15,96 € retenus, 14,25 € de compensation,
  ecart 0), « Garder » sans requete, Finances des deux cotes, kilos rendus (API), quatre emails,
  fil encore ouvert, refus D72 a l'annulation du trajet). Manoeuvre consignee : `yul` ramene a
  +24 h AVANT la reservation (le bareme lit le depart fige dans le deal). **ANO-WEB-06 (mineure)**
  corrigee : un message recu s'affichait « Notification » (copie + lien vers le fil).
  **ANO-WEB-07 (majeure, OUVERTE)** : le refus D72 renvoie vers « Mes deals » (n'existe pas) et
  le Voyageur ne peut pas annuler un deal (403 SHIPPER_ONLY malgre ANN-02) — arbitrage demande.
  Harnais : `payer()` attend l'intention de paiement (clic muet sinon). Poste : `nx serve` tombe
  sur un changement de lib partagee (recursion Nx) → trip/notification/message en bundle.
  17 scenarios e2e verts. MERGE 09/09 : **#261** (17 checks comptes). ANO-WEB-07, decision du
  09/09 : le message D72 renvoie vers « Mes trajets » (corrige dans la PR suivante) ; l'annulation
  d'un deal par le Voyageur reste un lot a part. Reste : E2E-4 a E2E-6, les 32 chapitres 5.x, 02-ADMIN.
- 09/09 : **WEB-E2E-4, LE COMPTE NEUF PLAFONNE (branche `chore/e2e-parcours-4`)** — quatrieme
  parcours vert : 14 etapes, 1 min 06 (inscription avec code, connexion sans « Rester connecte »,
  450 € et 12 kg refuses A L'INTENTION, cinq demandes puis la sixieme refusee, aucun score nulle
  part, export des donnees par la porte avec telechargement reel, acceptation, session expiree
  simulee (SES-01 : la cle Redis EST le delai d'inactivite), sessions actives, suppression
  bloquee sans porte). **ANO-WEB-08 (majeure)** : l'intention de paiement partait sans la valeur
  declaree — le plafond tombait apres l'autorisation bancaire (regression d'ANO-API-12) ;
  corrige. **ANO-WEB-09 (majeure)** : l'export « Mes donnees » demandait un blob, le 403
  SUDO_REQUIRED arrivait en blob, la porte ne s'ouvrait JAMAIS — export RGPD inutilisable ;
  corrige. ANO-WEB-07 : message D72 corrige (« Mes trajets »). Ecarts cahier : « le geste
  reprend » (le produit rafraichit, ne rejoue pas), « Appareils connectes » = « Sessions
  actives ». 18 scenarios e2e verts. PR **#262** (17 checks comptes). Reste : E2E-5, E2E-6, les 32
  chapitres 5.x, 02-ADMIN.
- 10/09 : **WEB-E2E-5, LE REFUS AU PICKUP (branche `chore/e2e-parcours-5`)** — cinquieme parcours
  vert : 8 etapes, 1 min 06 (reservation 22,00 € sur `fih`, acceptation et capture, « Refuser le
  colis » avec le rappel « ne penalise jamais ta reputation », raison « contenu non conforme »,
  toast, remboursement INTEGRAL prouve par la reponse du serveur ET la ligne Finances, deux emails
  dans l'ordre sans le mot « retenue », ligne de faits identique avant / apres, kilos rendus).
  **ANO-WEB-10 (majeure)** : la reputation comptait tout deal CANCELLED clos par le Voyageur apres
  acceptation comme « annulation tardive » — donc chaque refus au pickup, au prochain recalcul
  (la machine dit « sans penalite ») ; corrige : marque `Booking.pickupRefusedAt` posee par le
  refus, requete des faits Voyageur qui l'exclut (absent compris, `isSet`), refus qui recalcule
  les deux parties. deal-service **576** tests (+1), plateforme 990. Ecarts cahier : sujet de
  l'email « n'a pas pu etre pris en charge », kilos lus a l'API. 19 scenarios e2e verts.
  PR **#263** (empilee sur #262). Reste : E2E-6, les 32 chapitres 5.x, 02-ADMIN.
- 10/09 : **WEB-E2E-6, LE DESTINATAIRE (branche `chore/e2e-parcours-6`)** — sixieme et dernier
  parcours du chapitre 6, vert : 9 etapes, 1 min 00 (le tronc de E2E-1 rejoue, la page publique
  rechargee a chaque jalon : titre, corridor, dates, frise, aide qui change ; rien de plus a
  l'ecran NI dans le code source NI dans l'API — liste de cles FERMEE du contrat ; mention de
  confidentialite et son lien ; bloc d'acquisition ; jeton altere = 404 uniforme ; aucun email
  au destinataire, dont l'adresse a ete declaree expres). **ANO-WEB-11 (majeure)** : « Devenir
  Voyageur » menait a un bouchon de la migration i18n (« Become a carrier (UI only) ») depuis la
  page destinataire et l'accueil, et a un 404 (`/become-yamber`) depuis le pied de page et le
  menu visiteur ; corrige : redirections serveur des bouchons, quatre liens vers
  `/carrier/onboarding`. Ecarts cahier : l'aeroport n'est pas un jalon public ; « aucun SMS »
  est un fait de plateforme. 20 scenarios e2e verts. **Chapitre 6 clos** (6 parcours, 100
  etapes, ANO-WEB-08 a 11). PR **#264**. Reste : les 32 chapitres 5.x, 02-ADMIN.
- 10/09 : **CHAPITRE 5.1 DU CAHIER 01-WEB — WEB-ACC, L'ACCUEIL DU VISITEUR (branche
  `chore/recette-web-5-1`)** — premier des 32 chapitres « fiches », 12 fiches conformes en 1 min 24
  (`apps/e2e/src/chapitres/web-acc.spec.ts`). Six anomalies trouvees et closes : ANO-WEB-12
  (BLOQUANTE : « Rechercher » de l'accueil ne faisait qu'un console.log, et /search interrogeait un
  brouillon vide), ANO-WEB-13 (BLOQUANTE : le libelle « Ville, Pays » de l'autocompletion compare
  entier par `contains` → zero resultat pour toute ville etrangere ; `lib/place-text.ts`,
  `placeSearchTerm`, trip-service 257 → 260), ANO-WEB-14 (MAJEURE : `loading=async` + `onload` →
  la premiere requete de suggestions echouait sur « importLibrary is not a function », symptome
  dependant du rythme de frappe ; `callback=` de Google), ANO-WEB-15 (icones sociales actives vers
  des comptes qui ne sont pas les notres), ANO-WEB-16 (`<html lang="fr">` sur /en : `getLocale()`
  + `HtmlLang`), ANO-WEB-17 (deux `<main>` imbriques sur les pages legales). A trancher : l'en-tete
  desktop du visiteur sans « Creer un compte » ni « Rechercher un trajet ». Piege de poste : la cle
  Google Maps n'accepte que `localhost` comme referent. Harnais : 32 scenarios verts. PR **#265**
  (empilee sur #264). Reste : 5.2 a 5.32, 02-ADMIN.
- 11/09 : **CHAPITRE 5.10 DU CAHIER 01-WEB — WEB-ALR, ALERTES DE ROUTE (branche `chore/recette-web-5-10`,
  empilee sur #274)** — 9 fiches, 9 jouees CONFORMES (1 apres correction), 9 scenarios en serie, 1 min 45
  (`apps/e2e/src/chapitres/web-alr.spec.ts`). Ecran eprouve sans Google (panneau, periodes, bascules,
  bouton desactive, cartes, prolonger, supprimer, plafond, banniere) ; alertes creees par l'API avec le
  contrat du formulaire ; EFFET prouve par Mailpit : email FR a Aminata a la publication de Josephine,
  jamais au Voyageur lui-meme, jamais deux fois en 24 h, villes proches < 50 km selon l'option (Orly ≈ 15 km
  oui / non, Lille ≈ 204 km jamais, coordonnees consignees), 21e alerte refusee (ROUTE_ALERT_LIMIT).
  Une anomalie MINEURE corrigee : ANO-WEB-29 (toast « Alerte supprimee » jamais affiche — suppression
  optimiste, carte demontee avant la reponse, callbacks `mutate` perdus ; retours passes au niveau du hook
  `useDeleteSavedRoute({ onSuccess, onError })`). A trancher : « Prolonger » seulement sous 7 jours,
  « Selectionne les deux villes » inatteignable (bouton desactive), l'email d'alerte VOUVOIE (gabarit
  `trip-published.ejs` anterieur au tutoiement), message du plafond en anglais. Regard d'expert par fiche
  (dispatch sans outbox → a passer par l'outbox ; anti-spam par alerte et non par membre ; rayon et
  plafond en reglages D62). Nouvelle page-objet `pages/recherche.ts` (brouillon sessionStorage) partagee
  5.9 / 5.10. Harnais : 119 scenarios. PR **#275** (empilee sur #274). Reste : 5.11 a 5.32, 02-ADMIN.
  AUCUNE attribution Claude.
- 11/09 : **CHAPITRE 5.9 DU CAHIER 01-WEB — WEB-RCH, RECHERCHE / FILTRES / TRI / ETAT VIDE (branche
  `chore/recette-web-5-9`, empilee sur #273)** — 15 fiches, 15 jouees CONFORMES (3 apres correction), 16
  scenarios en 2 min 06 (`apps/e2e/src/chapitres/web-rch.spec.ts`) ; recherches posees par le brouillon
  persistant de la barre (`sessionStorage` `yamba:form:trip-search`, sans Google), ordres / prix /
  facettes confrontes a l'API. **ANO-WEB-27 BLOQUANTE CORRIGEE** : `next.config.js` sans
  `images.remotePatterns` → `next/image` jetait sur le premier avatar ImageKit et TOUTE la page /search
  (et la page publique) basculait sur « Cette page n'a pas pu s'afficher » (hotes ImageKit + Google
  ajoutes ; contre-epreuve : avatar pose en base sur Thomas). **ANO-WEB-28 BLOQUANTE OUVERTE** (trouvee
  en posant la contre-epreuve) : `Image.carrierPageId? @unique` = index unique NON epars sur Mongo → le
  SECOND membre qui pose un avatar recoit 500 P2002 (un seul avatar possible sur la plateforme) ;
  proposition : scinder `Image` en `UserAvatar` / `CarrierAvatar` a cle requise (candidat registre,
  PR dediee) ; fiche en `test.fail`. Contexte donne par l'utilisateur : la RECHERCHE et l'ACCUEIL sont
  des chantiers NON TERMINES — les ecarts consignes « a trancher » (compteur « Resultats disponibles »
  absent, etat vide remplace par le bloc alerte, statuts des familles en infobulle, vestige « Discuter
  avec Thomas · Bientot disponible », double arbre mobile/desktop, seed sans flightType ni coordonnees)
  alimentent ce chantier. NOUVEAU : section « Regard d'expert — optimisations et ameliorations » par
  fiche dans le rapport (consigne 11/09, a reconduire a chaque chapitre). Harnais : 110 scenarios. PR
  **#274** (empilee sur #273). Reste : 5.10 a 5.32, 02-ADMIN. AUCUNE attribution Claude.
- 11/09 : **CHAPITRE 5.8 DU CAHIER 01-WEB — WEB-DOC, JUSTIFICATIFS ET BILLET VERIFIE (branche
  `chore/recette-web-5-8`, empilee sur #272)** — 6 fiches, 6 jouees CONFORMES (2 apres correction), 6
  scenarios en 1 min (`apps/e2e/src/chapitres/web-doc.spec.ts`) ; ImageKit intercepte, admin SUPPORT
  par l'API, emails lus dans Mailpit, seed rejoue en tete de fichier (DOC-4 consomme le billet en
  attente de bzv-upcoming). Deux anomalies MINEURES corrigees : ANO-WEB-26 (le refus > 5 Mo etait
  MUET : `reset()` effacait l'erreur juste apres la validation — retire dans TripDocumentsManager et
  DocumentUpload) et ANO-WEB-25 (a 5 documents la zone de depot disparaissait sans un mot — message
  FR/EN, prop `limitHint`, cle `docLimitReached`). Une anomalie MINEURE OUVERTE : ANO-WEB-24 (aucun
  selecteur de TYPE de document, tout depot = TICKET_PROOF ; decision produit). PIEGE DE POSTE MAJEUR :
  `apps/trip-service/.env` (reliquat du 13/05) portait un SMTP GMAIL REEL et ecrasait l'env racine
  pour trip-service seul — ses emails (billet, masquage, alertes) partaient par Gmail, pas Mailpit, et
  l'echec etait avale (`.catch(() => undefined)`). Fichier deplace dans `~/.yamba-leftovers/`, le
  catch journalise (`admin-trips.controller.ts`), `nx run-many` relance (le parent reinjectait l'env).
  Harnais : 94 scenarios. PR **#273** (empilee sur #272). Reste : 5.9 a 5.32, 02-ADMIN. AUCUNE
  attribution Claude.
- 11/09 : **CHAPITRE 5.7 DU CAHIER 01-WEB — WEB-TRJ, PUBLIER UN TRAJET ET SON CYCLE DE VIE (branche
  `chore/recette-web-5-7`, empilee sur #270)** — 21 fiches : 20 jouees CONFORMES, 1 skip (TRJ-2, Google
  Places), 14 scenarios en 1 min 36 (`apps/e2e/src/chapitres/web-trj.spec.ts`). Methode : la machine a
  etats est deja unit-testee (500 lignes), la recette l'EXERCE (brouillons crees par l'API, gestes,
  `allowedActions`, recherche publique) ; le wizard est ouvert EN EDITION (`?edit=<id>`) pour eprouver
  les etapes 2 et 3 sans Google. Une anomalie MINEURE trouvee et CORRIGEE : ANO-WEB-22 (le mapper inverse
  du wizard ne lisait que `departureDateLocal`/`TimeLocal`, ecrits par lui seul : un trajet cree par
  l'API ou le seed s'ouvrait en edition avec « 4 champs a completer » — repli sur `departureAt` via
  `Intl.DateTimeFormat.formatToParts` dans le fuseau du lieu sinon du navigateur,
  `create-trip.reverse-mapper.ts`). Une anomalie MINEURE OUVERTE : ANO-WEB-23 (le wizard n'envoie
  aucun fuseau, `departureAt` est calcule dans le fuseau du NAVIGATEUR, le serveur retombe sur
  Europe/Paris ; proposition : fuseau derive des coordonnees cote serveur, PR dediee, decision produit).
  Ecarts a trancher : « Ton prix = ton net » absent de l'ecran, « Lieu exact » = « Exact », cartes de
  lieu par mode de transport, justificatifs a l'etape 1. D72 verifie A L'ECRAN (toast « Ce trajet porte
  encore N deals en cours ») et par l'API. Harnais : 88 scenarios (`playwright --list`). PR **#272**
  (empilee sur #270). Reste : 5.8 a 5.32, 02-ADMIN. AUCUNE attribution Claude.
- 11/09 : **CHAPITRE 5.6 DU CAHIER 01-WEB — WEB-VOY, DEVENIR VOYAGEUR / ONBOARDING / STRIPE (branche
  `chore/recette-web-5-6`, empilee sur #269)** — 7 fiches : 4 jouees CONFORMES, 3 skip motives, AUCUNE
  anomalie (`apps/e2e/src/chapitres/web-voy.spec.ts`). Compte NEUF (l'onboarding transforme le compte ;
  le seed porte des `acct_fake_*`). Couvre : entree « Devenir Voyageur » -> wizard 2 etapes ; etape
  Profil (telephone mal forme refuse, badge « Profil a completer », passage par l'API) ; PUBLIER SANS
  STRIPE (POST /trips publish -> PUBLISHED : le verrou D31 est a l'ACCEPT, pas au publish ; confirme la
  divergence RG-01, code fait foi) ; etape Paiement (« Connecter avec Stripe », AUCUN IBAN Yamba, vrai
  lien Connect Express test -> redirection connect.stripe.com). Skips : VOY-5 (completer un compte
  EXPRESS impossible par l'API — « cannot accept ToS on behalf of Express » verifie — et flux heberge
  Stripe lent/instable, procedure MANUELLE documentee), VOY-6 (demande en attente = parcours 5.12 ;
  verrou D31 unit-teste `deal-lifecycle.service.spec.ts` `CARRIER_ONBOARDING_REQUIRED`), VOY-7 (dashboard
  Stripe = compte complet requis). Harnais : 76 scenarios. PR **#270** (empilee sur #269). Reste : 5.7 a
  5.32, 02-ADMIN. AUCUNE attribution Claude contributeur (Co-Authored-By) ni pied « Generated with Claude ».
- 11/09 : **CHAPITRE 5.5 DU CAHIER 01-WEB — WEB-PRO, PROFIL / AVATAR / PAGE PUBLIQUE (branche
  `chore/recette-web-5-5`, empilee sur #268)** — 10 fiches : 8 jouees CONFORMES, 2 skip (avatar
  reel ImageKit ; « Afficher ma ville » que le seed ne peut alimenter). Une anomalie MINEURE
  trouvee et CORRIGEE : ANO-WEB-21 (page masquee : le proprietaire la voyait sans mention
  « masquee » ; l'API renvoyait `hidden` mais le front ne le portait pas — champ ajoute a
  `PublicUser` + banniere `UserProfileView` + cle i18n `userProfile.hiddenBanner`). Ecart a
  trancher : la page publique montre « Prenom N. », jamais le « nom affiche ». Garde-fou avatar
  > 2 Mo teste sans ecriture externe. Observation : `seed-deals.ts` ne pose pas de ville Voyageur.
  Harnais : 72 scenarios. PR **#269** (empilee sur #268). Reste : 5.6 a 5.32, 02-ADMIN. AUCUNE
  attribution Claude.
- 11/09 : **CHAPITRE 5.4 DU CAHIER 01-WEB — WEB-MDP, MOT DE PASSE ET ADRESSE EMAIL (branche
  `chore/recette-web-5-4`, empilee sur #267)** — 6 fiches en 4 scenarios, toutes CONFORMES,
  AUCUNE anomalie (`apps/e2e/src/chapitres/web-mdp.spec.ts`). Comptes NEUFS crees + actives par le
  harnais (`creerCompteActive`), jamais le seed (le chapitre change mot de passe ET adresse de
  facon definitive). Couvre : mot de passe oublie qui ne revele rien (aucun email pour une adresse
  inconnue), reinitialisation par code 10 min (nouveau OK / ancien KO), changement de mot de passe
  (refus PASSWORD_SAME_AS_CURRENT, email, autres sessions fermees), changement d'adresse (code sur
  la NOUVELLE adresse, ancienne seulement informee sans code, EMAIL_ALREADY_USED, autres sessions
  fermees). Piege : un mot de passe de test ne doit contenir ni prenom ni nom du compte
  (PASSWORD_CONTAINS_PERSONAL_INFO). Harnais : 62 scenarios. PR **#268** (empilee sur #267). Reste :
  5.5 a 5.32, 02-ADMIN. AUCUNE attribution Claude.
- 11/09 : **CHAPITRE 5.3 DU CAHIER 01-WEB — WEB-CNX, CONNEXION ET SESSIONS (branche
  `chore/recette-web-5-3`, empilee sur #266)** — 13 fiches + les 3 verifications historiques
  d'ANO-WEB-01, `apps/e2e/src/chapitres/web-cnx.spec.ts`, 14 attendus / 0 inattendu (3 min 20).
  Deux navigateurs A/B sur le MEME compte (Aminata) pour prouver qu'une session tuee depuis A
  meurt dans B. Une anomalie MAJEURE OUVERTE : ANO-WEB-19 (la connexion par mot de passe n'a AUCUN
  verrou anti-force-brute — douze 401 d'affilee, jamais un 429 ; le limiteur passerelle ignore les
  echecs, `skipFailedRequests` ; deja releve en recette API ; fiche WEB-CNX-4 en `test.fail` ;
  correctif = mecanique OTP, PR dediee). Une anomalie MINEURE close : ANO-WEB-20 (« Deconnecter un
  appareil » sans message de confirmation). Ecarts consignes : atterrissage sur /fr (pas le
  dashboard), rubrique « Sessions actives » (cahier : « Appareils connectes »), porte sudo au
  moment du geste + code qui rejoue. Pieges : le changement de mot de passe FERME la fenetre sudo
  (`closeSudoWindow`) — l'ordre litteral de WEB-CNX-11 est impossible ; six codes sudo/heure, un
  par minute (nouveau `clear-sudo-locks.ts`) ; refresh standard = cookie de session, memorise = 30
  jours (vie absolue). Harnais : 58 scenarios. PR **#267** (empilee sur #266). Reste : 5.4 a 5.32,
  02-ADMIN. AUCUNE attribution Claude.
- 10/09 (soir) : **CHAPITRE 5.2 DU CAHIER 01-WEB — WEB-INS, L'INSCRIPTION (branche
  `chore/recette-web-5-2`, empilee sur #265)** — 16 fiches : 12 jouees CONFORMES, 4 ⏭ (parcours
  Google 13-16, sans `NEXT_PUBLIC_GOOGLE_CLIENT_ID` et non pilotable : a la main le jour venu),
  `apps/e2e/src/chapitres/web-ins.spec.ts`. Les fiches 6-9 = UN scenario (compte cree, bloque
  cinq codes faux, code renvoye, active) avec une vraie minute de blocage. Une anomalie mineure
  close : ANO-WEB-18 (« Connectez-vous ou utilisez » vouvoyait dans `registerCodeMessage`).
  Trois ecarts de cahier a trancher : l'ecran du code MASQUE l'adresse (`maskEmail`, recommande :
  garder), cas e du mot de passe (« minuscule » avant « date », ordre `CHECK_ORDER`), titre
  « Deviens Voyageur » sur un ecran generique. Preuves en base par le nouveau
  `packages/libs/prisma/scripts/inspect-user.ts` (ConsentLog TERMS + PRIVACY @2026-04-26,
  preferredLocale fr, hasPassword). Pieges : le `role="alert"` de l'indicateur Next Dev Tools
  (viser `main`) ; un script lance par `execFileSync` se verifie seul d'abord (`isVerified`
  inexistant, casse a la derniere assertion). Harnais : 45 scenarios (41 joues, 4 ⏭). PR
  **#266** (empilee sur #265). Reste : 5.3 a 5.32, 02-ADMIN. AUCUNE attribution Claude.
- 04/09 : C-PR6b feat/c6b-admin-alerts (D59 3A / 4A, A129–A131) — neuf regles de seuil
  (evaluateAlerts pur, instantane de dix compteurs), GET /admin/alerts sans etat (accueil
  admin), cron horaire avec dedoublonnage Redis SET NX (un email par regle et par jour, Redis
  injecte), OPS_ALERTS_CRON_ENABLED. Suite : chantier F chat (challenge), C-PR8 parametres /
  RGPD.
- (historique) Plateforme de tests : 600 (trip 187, deal 354, notification 59) — post-B3 (#96).
- MERGE 01/09 : toute la pile B2 est dans `dev` via la SEULE **PR #90**
  (`feat/b2-deal-front` portait la chaîne complète : jalons mobile D36,
  docs cumulatifs, B2-PR1, B2-PR2, B2-PR3 + fix A34) — 13 checks verts
  comptés. Puis dans la même journée : **#91** (docs post-merge, les 5
  branches de la pile PURGÉES origin+local), **#92** (B2-PR4 emails),
  **#93** (B2-PR5 tracker) — 13 checks comptés à chaque fois. **B2 SOLDÉ.**

## Release et historique (28 aout 2026)

- `main` = `dev` (`9c6e155`) : release des PR #48 -> #88 (workflow livraison,
  B1, OpenAPI/CI, refonte pricing PER_KG A/B/C, recherche au kilo).
- HISTORIQUE REECRIT le 28/08 : emails `egoiomab.com` (sans @) -> `egoiomab@gmail.com`
  (101 commits) et suppression de 2 trailers Co-Authored-By Claude (regle : aucun
  contributeur autre que l'auteur). Contenu strictement identique, SHA changes.
  Tout autre clone : `git fetch && git reset --hard origin/dev`. Les anciennes
  branches distantes mergees peuvent etre supprimees (contenu dans dev).

## Ce qui RESTE — Jalon 1 (boucle transactionnelle) — SOLDE

- B1 → B5 SOLDES (voir « fait ») ; PR « parametres serveur » FAITE dans C-PR8a (D62) ;
  commission SiteConfig soldee (SiteConfig supprime, D62 8A) ; code de livraison AES
  re-affiche (D43) ; photos par URLs ImageKit (D42, pas de media-service) ;
  payment-service : NON (D38).
- Reste rattache, hors lancement : table des corridors (pricing-corridors) en constante
  (sa page admin plus tard), URLs signees / fichiers prives ImageKit et verification du
  domaine des URLs photo (D42), rotation de la cle AES (format v1 pret), vue DELIVERED
  persistante cote Voyageur (spec §11, hors v1).
- UX differees (quand le funnel reel donne des chiffres) : step 1 (aeroport -> ville de
  rattachement + lieu de pickup, arrivee repliee, justificatif en step 3), lieux en chips +
  apercu sticky (create-trip), cleanup legacy PER_CATEGORY + instantBooking.
- Docker/Redpanda DOIT tourner pour les notifications et emails (relay outbox + consumer).

## Ce qui RESTE — Jalon 2 (constitutif du lancement public)

- Chantier C admin-ui : SOLDE le 05/09 (C-PR1 #148 → C-PR8c #182 : mediation,
  billets, signalements, users, finances, pilotage, alertes, recherches / exports,
  parametres D62, RGPD D63, maintenance / etat des services / conservation D64).
  Complete le 07/09 par C-PR6d (D74, #227) : les quatre indicateurs de sante du modele
  (acceptation par cohorte, litige, revenu moyen par deal, sinistralite par categorie).
  Reste hors chantier : ~~TrustScore interne + plafonds progressifs (D29-2)~~ FAIT (D71),
  ~~moniteur externe de disponibilite~~ FAIT (D70).
- D35 email, D65 sessions, D66 PostHog, D67 profil editable (chantier E), D68 signalement +
  wording D28, D69 page destinataire + glossaire A144, D70 moniteur externe, A145 OpenAPI auth,
  D71 TrustScore interne : FAITS le 05/09 ; D72 + A146-A148 (#212), D73 approche mobile (#224) et
  D74 indicateurs (#227) FAITS les 06 et 07/09. Reste Jalon 2 : sauvegardes Atlas (a ta main), puis
  la recette globale a passer avec les quatre cahiers (docs/recette/), puis le chantier mobile (D36,
  precise par D73). Les cles a ta main avant la recette : ImageKit (absentes du .env — tout
  televersement echoue), PostHog, identifiant Google, Sentry, webhooks Stripe.
- Solde sessions auth : FAIT (D65) — reste le cleanup des sessions legacy (30 j post-prod).
- API : conversion OpenAPI auth-service (contrats Zod), page /docs Scalar
  auth, page /docs index gateway, audit anglais OAS trip-service.
- Micro-PRs confiance : wording statuts D28, bouton Signaler (trajet +
  membre), CTA alertes, page destinataire.
- Integrations : Sentry front+back FAIT (D56 7A), PostHog FAIT (D66) ; reste la verification
  des backups Atlas.

## Ce qui RESTE — Jalon 3

- F messagerie : FAITE en sondage (D61, F-PR1 → F-PR3) ; bascule evenements serveur puis
  Socket.io aux seuils graves (10 000 messages / jour, 300 conversations simultanees,
  p95 degrade de 20 %).
- Fin i18n : PR feat/locale-es (critere de fin), puis PT — declenche la dette D44 (gabarits
  trip-service et notification-service encore en ternaires FR/EN).
- H recommandations ML (replay outbox + PostHog) — apres PostHog.

## Ce qui RESTE — Jalon 4 (mobile : socle + Android)

- D36 a graver : stack (React Native + Expo, TypeScript, Expo Router), code
  partage (pricing, contrats, client OpenAPI genere, i18n JSON reutilises),
  auth par tokens (refresh) au lieu des cookies web, push notifications
  (Expo Notifications, branchees sur notification-service), deep links.
- Parcours Expediteur : recherche (poids, familles), page trajet, reservation
  4 etapes (Stripe Payment Sheet), suivi, code de livraison, notation.
- Parcours Voyageur : creation de trajet (formulaire PER_KG), deals recus,
  accept/decline, pickup + checklist + photos (camera), livraison (code).
- Qualite : tests Jest/RNTL sur la logique partagee, Detox ou Maestro E2E sur
  les 2 parcours critiques, CI EAS Build, Play Console (internal testing ->
  production), politique de confidentialite / data safety.

## Ce qui RESTE — Jalon 5 (iOS)

- Meme base ; Sign in with Apple (obligatoire si login social), Apple Pay
  via Stripe, permissions camera/photos/notifications avec textes d'usage,
  TestFlight, review App Store (guidelines marketplace : paiement de
  services physiques hors IAP = OK, a documenter dans la note de review).
- Publication App Store, parite fonctionnelle et visuelle avec Android.

## En continu (entre les lots)

- PRs i18n restantes : dissolution dashboard.copy.ts (sections dashboard),
  booking, trips/create, page publique (LocationsCard -> namespace
  tripDetail), divers, puis suppression du UiPreferencesProvider deprecie.
- Recette des lots livres sans recette : C-PR8a (PAR1–PAR12), C-PR8b (RGP1–RGP12),
  C-PR8c (MNT1–MNT10).

## Dettes techniques et TODO vivants (registre §7.2-7.3)

- chore/deps : 49 vulnerabilites npm dont 40 hautes au 05/09 (PR dediee, jamais
  npm audit fix --force en pleine PR) · Prisma 6->7.
- fix/error-semantics trip-service (400-partout -> 404/401/403).
- Cleanup post-pricing : maxSlots/bookedSlots, WITH_INTERMEDIATE_STOPS,
  handoffMoments/pickupMoments, dark:bg-slate-950 -> 900.
- CI : `next build` des deux fronts (« la CI construit ce qu'elle deploie »), candidat.
- Redaction pino-http (cookie + authorization) · AddDocumentsBody en Zod dedie ·
  harmonisation noms projets Nx · idempotence seed-deals · bug seed
  shipperId === carrierId a trancher.
- Inscription : reste telephone et champs requis (memes codes que A51, quand le
  formulaire les aura).
- Dette D44 : templates trip-service et notification-service encore en ternaires
  fr/en (.ejs) — a migrer sur le gabarit partage + dictionnaires quand une 3e langue
  arrive (ou avant lancement) ; trip-service garde son propre transport Nodemailer.
- D35 FAIT le 05/09 (feat/d35-email-provider) : EmailProvider (Resend par fetch, SMTP, faux
  refuse en production), webhook Svix (livre / rebond / plainte), liste de suppression
  respectee par tous les resolveurs, trip-service sur la lib partagee, Mailpit en local.
  Reste a ta main : compte Resend, domaine (SPF, DKIM), cles en production. MERGE 05/09 :
  **#185** (17 checks comptes).
- D65 FAIT le 05/09 (feat/d65-member-sessions, solde D27 SES-03/04/05) : sudo a fenetre de 15 min
  liee a la session (403 SUDO_REQUIRED, D63 migre), appareils connectes (libelle, IP, revocation
  unitaire et des autres), changement de mot de passe (autres sessions revoquees) et d'email
  (code a la nouvelle adresse, ancienne prevenue), tableau de bord Stripe sous sudo, ecran
  Securite reel. MERGE 05/09 : **#187** (17 checks comptes).
- D66 FAIT le 05/09 (feat/d66-posthog, met en oeuvre D5) : PostHog Cloud EU, banniere opt-in
  (choix navigateur 6 mois + User.analyticsOptIn + ConsentLog COOKIES), SDK charge seulement apres
  accord, pages vues et funnel (search, trip, etapes, paiement, publication), identify par id,
  serveur par les evenements outbox (lib @packages/libs/analytics, liste blanche, uuid stable,
  fire-and-forget) pour les parties consentantes. A ta main : compte PostHog, cles, paragraphe
  de la politique de confidentialite. MERGE 05/09 : **#189** (17 checks comptes).
- D67 FAIT le 05/09 (feat/e-profile-editable, chantier E) : GET/PATCH /auth/me/profile,
  POST/DELETE /auth/me/avatar (ImageKit /avatars, fileId garde, ancien fichier supprime, URL
  verifiee), regle pure profile.rules.ts (noms 2-40, date de naissance >= 16 ans, displayName /
  bio reserves au Voyageur), User.profilePublic (404 aux autres, hidden pour soi) et showCity,
  ecran Profil reel du tableau de bord + « Voir mon profil public ». Slug immuable. Non retenus :
  bio Expediteur, coverUrl / socialLinks, changement de slug. MERGE 05/09 : **#191** (17 checks comptes).
- D68 FAIT le 05/09 (feat/trust-report-wording, micro-PR confiance lot 1) : POST /reports (TRIP /
  USER par identifiant public, motifs fermes par cible, OWN_TARGET / doublon 409 / cible invisible
  404), accuse de reception email, file admin /admin/reports (reports.review, decision + journal
  REPORT_REVIEWED, prioritaire a 3 ouverts, jamais de sanction automatique), page /reports a deux
  files, KPI reportsOpen, modale generique branchee sur les deux boutons inertes (porte de connexion
  pour un visiteur), wording D28 applique, namespace i18n `trips` mort retire. CTA alertes : deja en
  place, constate. MERGE 05/09 : **#193** (17 checks comptes).
- D69 + A144 FAITS le 05/09 (feat/recipient-page, micro-PR confiance lot 2) : TrackingLink (un
  jeton CSPRNG par reservation), POST /deals/:id/tracking-link (Expediteur seul, 409 avant
  acceptation), GET /track/:token SANS session (contenu minimal : jalons, prenoms, corridor, dates ;
  404 uniforme aligne sur recipientRedactedAt), page /track/[token] (RGP-02, bloc acquisition,
  noindex), carte « Partage le suivi » (WhatsApp / SMS / copie, Yamba n'envoie rien — SMS sortant en
  porte), vrai numero du destinataire dans le tracker (fin du mock A137), glossaire un mot par role
  (Voyageur / Traveler partout, emails compris). MERGE 05/09 : **#195** (17 checks comptes).
- D70 FAIT le 05/09 (feat/d70-uptime-monitor) : sonde publique GET /api/status au gateway (avant le
  limiteur, cache 10 s, 200 ok|maintenance / 503 degraded|down, corps minimal), lib partagee
  packages/libs/health/status.ts (serviceEntries, probeService, aggregateStatus — la page d'etat admin
  la reutilise), GET /api/health sur user-ui et admin-ui, battement externe des crons
  (CRON_HEARTBEAT_PING_URLS, GET best effort dans withHeartbeat). A TA MAIN : compte Better Stack,
  3 moniteurs HTTP, 4 battements (payout, expire, unread-reminder, ops-alerts), contacts d'alerte —
  runbook dans DOC-TECHNIQUE. MERGE 05/09 : **#197** (17 checks comptes).
- A145 FAIT le 05/09 (feat/auth-openapi) : auth-service dans l'OpenAPI 3.1 (D3, dernier service) —
  86 operations, contrats de la surface membre decrits au reel (member-auth.schema.ts), x-permission
  sur les routes admin, /openapi.json + /docs sur :6001, cinquieme cible de generate:openapi diffee
  en CI, test qui exige chaque route montee et refuse toute route inventee. Porte : safeParse dans
  les controleurs historiques au chantier mobile D36. MERGE 05/09 : **#199** (17 checks comptes).
- D71 FAIT le 05/09 (feat/d71-trust-score, met en oeuvre D29 (2), REP-04, CNF-06) : lib pure
  packages/libs/trust (score 0..100 sur lecture, niveaux NEW / STANDARD / WATCH / HIGH_RISK, facteurs
  lisibles, Prisma injecte), plafonds progressifs a la reservation (409 NEW_ACCOUNT_CAP, aux deux
  etapes), quatre cles au catalogue (groupe trust, CNF-06 sort de la classe C), fiche membre admin
  (carte Risque interne), file des signalements (niveau du membre vise, HIGH_RISK prioritaire).
  Jamais servi a un membre, jamais une sanction automatique. Portes : poids reel au pickup, KYC,
  instantane dans le journal. MERGE 05/09 : **#201** (17 checks comptes).
- chore/deps FAIT le 05/09 : npm audit fix, migration Nx 23.2 (TypeScript 6.0.3), postcss / esbuild,
  overrides uuid / deepmerge-ts / qs → 0 vulnerabilite. Portes : Prisma 7, Express 5. MERGE 05/09 :
  **#203** (17 checks comptes) — `npm ci` obligatoire apres pull.
- Recette globale : fiche context/YAMBA-RECETTE-GLOBALE-2026-09.md (103 scenarios + 8 E2E + Atlas +
  moniteur), seed-deals date les membres de 90 jours (plafonds D71). MERGE 05/09 : **#204**. Le plan
  de session se fait avec l'utilisateur, puis la recette, puis le chantier mobile (D36).
- D72 + A146/A147/A148 FAITS le 06/09 (fix/anomalies-documentation) : les quatre anomalies trouvees
  en ecrivant la documentation. (1) L'annulation d'un trajet est REFUSEE tant qu'un deal est vivant
  (409 TRIP_HAS_ACTIVE_DEALS) : le Voyageur annule ses deals d'abord (ANN-02, remboursement integral).
  (2) Un details porteur d'un code passe desormais en production (SUDO_REQUIRED, messagerie,
  signalement etaient muets). (3) Le limiteur du gateway verifie la signature du jeton : la branche
  « connecte » etait morte, tout le monde subissait 100 req / 15 min. (4) Le cron de rappel
  d'onboarding est enfin demarre, avec filtre isDeleted / emailSuppressedAt et age max 30 j.
  A surveiller en production : volume du premier tour du cron de rappel. MERGE 06/09 : **#212**
  (17 checks comptes).
- Divergences documents / code (06/09, fix/divergences-documentation, MERGE **#214**) : les 29 ecarts releves par
  les livrables sont corriges dans les documents (le code fait foi) — 16 transitions dans CLAUDE.md,
  ANN-03 recrite (D72), REP-03 informatif, RGP-02 par la page de suivi, six profils admin, seuils
  d'alerte reglables — plus un avertissement en tete des quatre specifications historiques et les
  ecrans admin perimes. La file d'arbitrage lit enfin ses filtres d'URL.
- Preparation mobile (MERGE 06/09 : **#225**) : docs/livrables/06-YAMBA-PREPARATION-MOBILE.md (outils + commandes, gratuit vs
  payant pour tester sur telephone, blocage depot App Store en local, individuel vs organisation,
  compte d'un tiers, calendrier des depenses).
- Cahiers de recette (06/09, docs/recette/, .md + .pdf, MERGE **#223**) : 01-WEB (344 scenarios), 02-ADMIN (125),
  03-API (146), 04-CRONS (90) + README (ordre conseille : API, web, admin, crons). Ecrits depuis les
  livrables et le code. Trois defauts corriges au passage, dont redpanda-bootstrap.sh qui ne creait
  pas le sujet messaging-events.
- Guide de configuration (MERGE 06/09 : **#218**, precedence des .env par projet **#222**) : docs/livrables/05-YAMBA-CONFIGURATION.md (toutes les variables, les dix
  services externes, secrets, diagnostic, etat reel de l'installation). A TA MAIN : cles ImageKit
  (absentes du .env — tout televersement echoue), PostHog, identifiant Google, Sentry, webhooks Stripe.
- Livrables de documentation FAITS le 06/09 (une PR par document, .md + .pdf dans docs/livrables/,
  ~121 000 mots) : lot 1 metier / fonctionnel membres (36 135), lot 2 Admin (26 925), lot 3 API de
  bout en bout (16 134 + reference generee des 173 endpoints), lot 4 technique de transmission
  (41 578). Outillage : scripts/build-doc-pdf.py (python-markdown + Chrome headless),
  scripts/build-api-reference.py. MERGES 06/09 : **#208 a #211**.
- Recette 06/09 (fix/recette-affichage, **#215**) : croix de fermeture absente sur la porte de
  connexion mobile, tiret « — » servi comme heure d'arrivee par le mapper de recherche, pointilles
  adoucis ; le seed publiait des trajets sans heure d'arrivee ni prix et echouait sur une categorie
  de colis inexistante. Puis **#217** (journal d'audit filtrable, page des alertes, cle React des
  parametres), **#219** (l'etape 1 de reservation plantait sur un trajet sans lieu de remise),
  **#220** (pages d'erreur et pages introuvables sur les deux fronts).
- D73 GRAVEE le 06/09 (feat/d73-mobile-approche, **#224**) : Android et iOS distingues dans le
  chantier mobile — construire pour les deux des le socle, publier sequentiellement (Android
  d'abord), « Se connecter avec Apple » comme prerequis SERVEUR, commission d'achat integre ecartee
  (le transport est un service reel, hors achat in-app), manifeste de confidentialite Apple. Le
  guide de configuration gagne son chapitre « Preparer le poste » (outils manquants, blocage du
  depot App Store en local).
- Dossiers d'ouverture commerciale FAITS le 06/09 (docs/livrables/, .md + .pdf) : 07 strategie de
  financement et de lancement, 08 dossier assureurs, 09 dossier juristes, 10 dossier aides
  publiques. Ecrits pour le flux « Telama seul » ci-dessous (Station F, Bourse French Tech, prets
  d'honneur, embedded insurance). MERGE 07/09 : **#227**.
- D74 FAIT le 07/09 (C-PR6d, meme PR **#227**, complete D59 et D66) — les quatre indicateurs qui
  manquaient, reveles par l'audit des dossiers commerciaux : taux d'acceptation par COHORTE
  (`accepted / (accepted + declined + expired)`, le sort d'une demande compte dans la periode ou
  elle a ete FAITE) avec sa ventilation refus / expiration, taux de litige sur les livraisons,
  revenu moyen par deal termine, registre de sinistralite par categorie (mois de DECISION,
  categorie, devise, litiges tranches / retenus / somme remboursee — la piece qu'un assureur
  exigera, D22). Regle transverse : un denominateur vide donne `null`, rendu « — », jamais « 0 % ».
  Retention, cohortes d'Expediteurs et entonnoirs restent a la mesure d'audience (D66 5A) : pas de
  seconde verite. Limite assumee : le numerateur du taux de litige ne compte que les colis livres.
  17 checks comptes ; plateforme a 860 tests (+ auth 183).
- Releases vers `main` : **#216** (jalon 2 + documentation de transmission), **#221** (correctifs de
  recette, guide de configuration, pages d'erreur), **#226** (cahiers de recette, approche mobile,
  preparation du poste).
- Backlog parametre serveur : classe C du catalogue D62 (tolerance de poids,
  plafonds comptes neufs, plafond express, seuil de trois signalements…).
- Photos hors TripDocument chez ImageKit sans fileId (colis, pickup, livraison, litige,
  message) : non effacables — a traiter avec la conservation des deals.

## Flux "Telama seul" (hors code — chemin critique potentiel)

- Septembre 2026, LE PLUS URGENT : dossiers Station F et Paris&Co, dossier
  Bourse French Tech, pret d'honneur (Reseau Entreprendre / Initiative
  France).
- POLITIQUE-CONFORMITE-YAMBA.md (D9), alimente par questionnaires assureurs.
- Contact 2-3 acteurs embedded insurance (Wakam, Owen, Qover, bsurance).
- Etude tarifs corridor GP (seed base_corridor D15).
- Supply-seeding : 20-30 voyageurs reguliers avant d'ouvrir la demande.

## Regles de code NON NEGOCIABLES

- Montants monetaires en centimes Int, jamais Float. Champ currency partout.
- DTOs par role = whitelists strictes (jamais spread+delete).
- Le code de livraison ne voyage jamais dans les events ni les emails.
- Aucun changement d'etat sans event outbox dans la meme transaction Mongo.
- Snapshot pricing immuable dans le Booking (D17) — jamais recalcule.
- Semantique 403 vs 404 respectee.
- Tests dans la MEME PR que leur logique (D30).
- prisma/schema.prisma est A LA RACINE du repo.
- Prisma+Mongo : readAt null -> OR [{readAt: null}, {readAt: {isSet: false}}].
- Prisma+Mongo : jamais de `String? @unique` (null collisionne — A42) ;
  unicite par construction ou index partiel raw.
- Nouvel alias @packages/* : tsconfig.base.json ET webpack.config.js du
  service (nx serve ne lit pas tsconfig paths).
- Nouveaux alias @packages/* : declares dans tsconfig.base.json, et
  @packages/api-contracts AVANT le wildcard.
- Props callback des composants "use client" : suffixe *Action (TS71007).
- params des pages Next.js 15+ est une Promise -> await requis.

## Commandes et verifications

- Toujours npx nx (jamais global). Tests : npx nx test <service>.
- tsc : npx tsc --noEmit --project apps/<service>/tsconfig.app.json
  (JAMAIS --project apps/<service> — resout vers le tsconfig solution-style).
- Avant tout commit : git status --short, puis git add AVEC pathspec.
- Anti-fuite avant push : git ls-files avec grep sur env/secret.
- Apres chaque commit : git log --oneline -1.
- curl de preuve : toujours -w "HTTP %{http_code}".
- Branche de base : dev, protegee par 12 required checks. PRs depuis des
  branches feat/*. Numero de PR note au merge.
