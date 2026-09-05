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
- Plateforme de tests : 838 (trip 209, deal 494, notification 99, message 36) + auth 138.
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
  Reste hors chantier : ~~TrustScore interne + plafonds progressifs (D29-2)~~ FAIT (D71),
  moniteur externe de disponibilite (candidat D64).
- D35 email, D65 sessions, D66 PostHog, D67 profil editable (chantier E), D68 signalement +
  wording D28, D69 page destinataire + glossaire A144, D70 moniteur externe, A145 OpenAPI auth,
  D71 TrustScore interne : FAITS le 05/09. Reste Jalon 2 : sauvegardes Atlas (a ta main), puis deps
  + recette globale, puis le chantier mobile (D36).
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
  overrides uuid / deepmerge-ts / qs → 0 vulnerabilite. Portes : Prisma 7, Express 5.
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
