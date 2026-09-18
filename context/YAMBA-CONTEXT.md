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
- 13/09 : **CAHIER 02-ADMIN — § 4.1 CONNEXION EN DEUX ETAPES (branche `chore/recette-admin-4-1`, empilee sur #300)** —
  premier chapitre du back-office : 6 fiches CONFORMES (1 apres correction), 7 scenarios en serie, 17 min
  (`apps/e2e/src/admin/adm-sec-connexion.spec.ts`). OUTIL : `pages/journal-admin.ts` relit le journal par l'API de
  /audit (session super admin, borne `from`, ordre chronologique) — la double verification du cahier (§ 3.4). COMPTE
  ADMIN JETABLE (inscription + grant-admin.ts, revoque et efface en afterAll) pour SEC-2/4/5 ; codes TOTP CALCULES ;
  attentes reelles 5 et 15 min emboitees. ANO-ADM-01 close : un compte bloque (TOO_MANY_ATTEMPTS) affichait « Code
  invalide. » meme avec le bon code → LoginFlow lit `details.code`. ECART DOCUMENTAIRE : `ADMIN_LOGIN` cible `SESSION`
  sans identifiant (le cahier dit USER · id) → le filtre par cible de /audit ne retrouve pas les connexions. A
  TRANCHER : cible de ADMIN_LOGIN, regeneration des codes de secours. Deja ecrit pour § 4.3 : ADM-PRM-9 genere la
  matrice routes × 7 comptes depuis les routeurs et ADMIN_PERMISSIONS — CONFORME (aucune garde absente). Harnais : 339
  scenarios. PR a ouvrir. Reste : § 4.2, § 4.3 (PRM-1 a 8), § 5 a 7.
- 13/09 : **CAHIER 02-ADMIN — § 4.2 SESSIONS, § 4.3 PERMISSIONS, § 5.1 ACCUEIL (branche `chore/recette-admin-4-2`,
  empilee sur #301)** — 17 scenarios verts sur la pile reelle : ADM-SEC-7 a 10 (SEC-8 = 46 min d'attente reelle, SEC-9 =
  substituts + session vieillie a 11 h 59 dans Redis), ADM-PRM-0 a 9 (PRM-0 = miroir front de la matrice identique au
  contrat ; PRM-9 = chaque route admin des quatre routeurs × les sept comptes), ADM-ACC-1 a 3 (ecran = API = cahier,
  tuiles polluees comptees en base). TROIS ANOMALIES CLOSES : ANO-ADM-04 (MAJEURE — revoquer une session admin ne
  coupait que le renouvellement, le jeton d'acces restait accepte 15 min → le jeton porte le `jti`, `isAdminAuthenticated`
  verifie `admin_jti:<id>:<jti>` a chaque requete, echec FERME si Redis est muet), ANO-ADM-02 (un Mediateur recevait
  400 « Nothing to reset » au lieu de 403 sur une remise a zero de cles deja par defaut), ANO-ADM-03 (PRIVACY ne pouvait
  pas ouvrir la fiche ou vivent export et effacement → A153, `users.read` ouvert a PRIVACY). Aussi : seed-deals pose la
  relance du versement en echec a +23 h (le cron FAKE vidait la file), `nx.json` sharedGlobals += `packages/**`, schema
  Prisma, tsconfig.base (cache de test perime). Pieges harnais : `isVisible({ timeout })` n'attend pas → `waitFor` ; la sonde de
  session admin acceptait un cookie a quelques secondes de son expiration → renouvellement a < 5 min.
  auth-service 235, harnais 356. A mettre a jour dans le cahier : menu PRIVACY, formulaire « Trancher » avant 72 h,
  message « dernier super administrateur » inatteignable, tuiles non listees, « aucune alerte » sur jeu d'essai neuf.
  Reste : § 5.2 a 7.
- 13/09 : **CAHIER 02-ADMIN — § 5.2 ALERTES DE SEUIL (branche `chore/recette-admin-5-2`, empilee sur #302)** — 4 fiches
  CONFORMES (ALR-3 et ALR-4 partielles), aucune anomalie, aucun code produit, jouees deux fois vertes
  (`apps/e2e/src/admin/adm-alr-alertes.spec.ts`). Methode : une alerte sans etat se PILOTE PAR SON SEUIL (PATCH
  /admin/settings, sonde /admin/alerts pour le cache 30 s, seuils retablis en finally) ; jeu d'essai MESURE avant la
  fiche. ALR-3 : `notifyNewAlerts` appele avec le vrai Redis hors fenetre du cron, verrous du jour purges (consigne), un
  email puis aucun ; lendemain simule (horloge injectee + magasin memoire + EMAIL_PROVIDER=fake). ECARTS DOC : le
  versement du seed (termine J-3) franchit deja 48 h (le cahier dit « en echec depuis 24 h ») ; litiges et renversement
  infranchissables juste apres le seed ; DOC-METIER ALR01 perime sur le renversement. A TRANCHER : « Versements en echec
  depuis plus de 48 h » mesure l'age de la FIN DU DEAL, pas de l'echec (libelle ou requete) ; un seed « alertes vieillies ».
  Harnais 360. Reste : § 5.3 a 7.
- 13/09 : **CAHIER 02-ADMIN — § 5.3 UTILISATEURS (branche `chore/recette-admin-5-3`, empilee sur #303)** — 3 fiches
  CONFORMES (USR-1 et USR-3 apres correction), jouees deux fois identiques (`apps/e2e/src/admin/adm-usr-utilisateurs.spec.ts`).
  ANO-ADM-05 (MAJEURE, close) : Prisma+Mongo `contains` = `$regex` NON echappe → `+33612345601` = 0 resultat, `a.b` = 52,
  `(` = erreur 500 ; et `searchAdvanced` n'annoncait jamais « via phone » → `escapeRegex` / `phoneNeedle` / `matchedOnFor` /
  `textSearchOr` dans `apps/auth-service/src/lib/admin-users.query.ts` (+3 tests, auth 238). ANO-ADM-06 (mineure,
  outillage, close) : `seed-deals.ts` ne remettait pas a zero litiges perdus / annulations tardives (User + CarrierPage) →
  Chinwe 0→2→3 litiges perdus, score vers « A risque ». MEME DEFAUT regex dans trip-service (`admin-trips.rules.ts`,
  `trip-search.controller.ts`) : a traiter au § 5.7. PIEGE DE POSTE : sous `nx run-many serve`, la reconstruction
  d'auth-service echoue (« Recursive task invocation ») et l'ANCIEN process repond 200 → auth-service tourne desormais en
  bundle (`node --env-file=../../.env dist/main.js`). En dev, USER_VIEWED x2 par ouverture (React StrictMode). A
  TRANCHER : dedoublonner USER_VIEWED, recherche sans accents, libelles FR des roles. Harnais 363. Reste : § 5.4 a 7.
- 14/09 : **CAHIER 02-ADMIN — § 5.4 SANCTIONS (branche `chore/recette-admin-5-4`, empilee sur #304)** — 5 fiches ADM-SNC
  + 2 fiches d'anomalie, CONFORMES, jouees deux fois vertes (`apps/e2e/src/admin/adm-snc-sanctions.spec.ts`, afterAll
  remet Pauline et Thomas actifs). TROIS ANOMALIES CLOSES : ANO-ADM-07 (MAJEURE) la date « Jusqu'au » d'une sanction
  n'etait lue par PERSONNE (403 une minute apres l'echeance) → regle pure `packages/middleware/account-status.ts`
  (`effectiveAccountStatus`, `notSuspendedOwnerFilter`, `activeSanctionFilter`) lue par isAuthenticated,
  requireActiveAccount, login, recherche, tuiles, fiche admin — par LECTURE (D56), sans cron ; ANO-ADM-08 (MAJEURE) le
  trajet d'un Voyageur suspendu restait ouvert (page publique 200) et reservable par son lien → `publicTripWhere` +
  `checkTripBookable` (TRIP_NOT_BOOKABLE) ; ANO-ADM-09 (mineure) connexion Google et renouvellement ne verifiaient pas
  la suspension. PIEGE : dans un filtre de RELATION Prisma+Mongo, `date: { lte: now }` MATCHE null (ordre BSON) →
  borne basse `gt: new Date(0)`. AMELIORATIONS FAITES : messages de resultat nommant le geste, refus lus par code,
  « jusqu'au » inclus (23:59:59 locale, etait minuit UTC) + min=demain, tuile « Sanctions proposees » compte les
  escalades, badge « Actif (sanction echue) ». A TRANCHER : motif libre envoye au membre (motifs types ?), aucun email ni
  journal a l'echeance (acteur SYSTEM au journal), trajets d'un Voyageur restreint reservables. Tests : auth 242, trip
  262, deal 578, harnais 370. Poste : auth, trip, deal en bundles detaches (nohup). Reste : § 5.5 a 7.
- 14/09 : **CAHIER 02-ADMIN — § 5.5 SUPPRESSION D'ADRESSE EMAIL (branche `chore/recette-admin-5-5`, empilee sur #305)** —
  ADM-EML-1 + 3 fiches de preuve (EML-0 webhook signe, EML-2 plainte/concurrence/droits, EML-3 emails super admin),
  CONFORMES, jouees deux fois vertes (`apps/e2e/src/admin/adm-eml-suppression.spec.ts`). La suppression nait du VRAI
  webhook Svix signe (secret du poste, via la passerelle) ; « aucun email » prouve par deux envois reels attendus puis
  absents, « repartent » par un envoi recu. DEUX ANOMALIES CLOSES : ANO-ADM-10 (MAJEURE) `emailCarrier` de trip-service
  (billet, masquage) ignorait `emailSuppressedAt` ET `isDeleted` → `lib/carrier-mailer.ts` ; ANO-ADM-11 (mineure) emails
  aux super admins (parametres, maintenance) → filtre joignable. + 500 sur deux levees simultanees (P2034). A155 : levee
  MOTIVEE (>= 20, `after.liftReason`), ecriture conditionnelle + `withWriteConflictRetry` (remonte dans
  `packages/libs/prisma`, re-export deal-service) ; regle partagee `canReceiveEmail` / `reachableRecipientWhere` dans
  `@packages/email` (fragment a combiner sous AND). AMELIORATIONS FAITES : formulaire de levee, avertissement plainte,
  refus par code, message qui survit au rechargement, bouton aligne sur SUPER_ADMIN_ONLY, « motif non renseigne »,
  contre-epreuve systematique dans le harnais. OpenAPI regenere. A TRANCHER : codes de connexion / notifications de
  securite envoyes a une adresse supprimee ; seuil de rebonds temporaires ; derniers emails en echec sur la fiche.
  Tests : auth 248, trip 267, notification 119, deal 578, harnais 374. Reste : § 5.6 a 7.
- 14/09 : **CAHIER 02-ADMIN — § 5.6 EXPORTS CSV (branche `chore/recette-admin-5-6`, empilee sur #306)** — 4 fiches
  CONFORMES (EXP-4 ajoutee), jouees deux fois vertes (`apps/e2e/src/admin/adm-csv-exports.spec.ts`) : fichier TELECHARGE
  par l'ecran, BOM relu, CSV PARSE, identifiants = liste de l'ecran (requete capturee, relue page par page), fouille
  email/telephone, journal. TROIS ANOMALIES CLOSES : ANO-ADM-12 BLOQUANTE (l'export operationnel des billets livrait
  `originalName`, texte libre du membre — mesure : « sfr-facture-0752426937-0.pdf » → colonne `fileExtension`, A156 :
  jamais un champ libre dans un export operationnel), ANO-ADM-13 MAJEURE (export = onglet sur l'URL : jeton expire → JSON
  401 brut, aucun rafraichissement → `downloadFile` par fetch dans `admin-ui/src/lib/api.ts`), ANO-ADM-14 (copie
  divergente de `csvCell` en Finances). AMELIORATIONS FAITES : bibliotheque unique `@packages/libs/csv` (nombre non
  neutralise, `EXPORT_MAX_ROWS`, `capExportRows`, en-tetes `X-Truncated` / `no-store`), troncature dite au journal et a
  l'ecran, compteur du motif, refus par code, `INVALID_QUERY` avec code sur l'arbitrage. A TRANCHER : motif de l'export
  nominatif dans l'URL (journaux techniques), export Finances sans plafond (§ 5.16), noms de fichiers en UTC.
  Tests : trip 274, deal 578, auth 248, harnais 378. Reste : § 5.7 a 8.
- 14/09 : **CAHIER 02-ADMIN — § 5.7 TRAJETS : LISTE, FICHE, MASQUAGE (branche `chore/recette-admin-5-7`, empilee sur #307)**
  — 7 scenarios CONFORMES (TRJ-1 a 5 + ANO-ADM-15 + TRJ-4 bis), joues deux fois verts (`adm-trj-trajets.spec.ts`) :
  effet reel du masquage cote public (recherche, page publique 404) et membre (bandeau, TRIP_NOT_BOOKABLE, deal accepte
  lisible), emails, journal. QUATRE ANOMALIES CLOSES : ANO-ADM-15 MAJEURE (Prisma+Mongo traduit contains/startsWith/
  equals insensible en `$regex` SANS echapper : « ( » → 500 sur la recherche PUBLIQUE et ses facettes, « . » → 41/41,
  « P.ris » = doublon d'alerte route → module partage `packages/libs/prisma/text-search.ts` `escapeRegex`/`containsText`/
  `equalsText`, A157, branche dans admin-trips.rules, trip-search, saved-route ; auth `admin-users.query` le reexporte),
  ANO-ADM-16 (billet « a verifier » sur 5 trajets partis → `effectiveTicketStatus` EXPIRED a la lecture + borne de
  depart du filtre), ANO-ADM-17 (proposer sur un trajet masque accepte, ressurgissait au retablissement → 400),
  ANO-ADM-18 (email de masquage sans lien vers le trajet). CONCURRENCE : deux « Masquer » simultanes → 200 + 500 P2034 →
  `updateMany` garde par l'etat + `withWriteConflictRetry` (200 + 400, une ligne, un email). AMELIORATIONS FAITES : motif
  vide au depart (le retablissement journalisait le motif de la proposition), messages nommes, refus par code, compteur
  n/20, remplacement de proposition garde l'ancienne en `before`, « c'est ton propre trajet », statuts/mode/reservations
  en francais, q et villes lus dans l'URL. A TRANCHER : accepter une demande PENDING sur un trajet masque ; recherche
  insensible aux accents. Tests : trip 282, auth 248, harnais 385. Reste : § 5.8 a 8.
- 14/09 : **CAHIER 02-ADMIN — § 5.8 BILLETS A VERIFIER (branche `chore/recette-admin-5-8`, empilee sur #308)** — 8
  scenarios CONFORMES (BIL-1 a 4 du cahier + 5 a 8 ajoutees), CHAQUE fiche jouee AVANT correction (BIL-1, 5, 6, 7, 8
  rouges sur leur defaut) puis 8/8 verts deux fois (`adm-bil-billets.spec.ts`). TROIS ANOMALIES CLOSES : ANO-ADM-19
  MAJEURE (le badge public « Billet vérifié » etait ECRIT geste par geste : un 2e billet rejete passait en REJECTED un
  trajet dont le 1er restait verifie ; supprimer le billet verifie gardait le badge → statut DEDUIT des billets,
  `apps/trip-service/src/lib/ticket-status.rules.ts` `tripTicketStatusFromDocuments`, recalcule dans la transaction de
  decision et au depot/suppression `syncTripTicketStatus`), ANO-ADM-20 (file et export pas alignes, trajet annule « a
  verifier », 200 billets partis masquaient un billet a venir, decision acceptee sur trajet parti → `buildTicketsWhere`
  decidables + `departedTicketsWhere` a part, 400 TICKET_TRIP_DEPARTED/CLOSED), ANO-ADM-21 MAJEURE (A158 : changer la
  date ou une ville gardait le badge → `changedTicketFacts` rouvre les billets verifies). AMELIORATIONS FAITES : sa propre
  carte sans boutons, refus par code + rechargement, motif nomme, anti double clic, message hors chargement, mode et type
  de fichier ; documents en francais sur la fiche trajet ; conflit d'interets avant « deja traite » ; retry P2034. A
  TRANCHER : URL ImageKit publiques et permanentes (fichiers prives + URL signees) ; prevenir le Voyageur que modifier
  date/ville retire le badge ; rouvrir un rejet « dates » quand les dates sont corrigees. Tests : trip 292, harnais 393.
  Reste : § 5.9 a 8.
- 14/09 : **CAHIER 02-ADMIN — § 5.9 MEDIATION (branche `chore/recette-admin-5-9`, empilee sur #309)** — 9 scenarios
  CONFORMES (MED-1 a 6 du cahier + 7 a 9 ajoutees), joues contre le code non corrige puis 9/9 verts deux fois
  (`adm-med-mediation.spec.ts`, 5 preuves par decision dont les remboursements REELLEMENT emis, lus par la fiche argent).
  Manoeuvres : `dispute.responseDelayHours` a 12 h (min du catalogue) et version du Voyageur deposee par Adebayo.
  TROIS ANOMALIES CLOSES : ANO-ADM-22 BLOQUANTE (deux decisions simultanees remboursaient DEUX FOIS — mesure : 7,84 € et
  15,68 € emis, un seul en base ; l'argent part avant la transaction, le verrou optimiste ne protege que la base → A159
  verrou Redis par deal pris AVANT toute lecture, `apps/deal-service/src/lib/decision-lock.ts`, 409 DECISION_IN_PROGRESS,
  echec ferme sans magasin), ANO-ADM-23 (email « le reste est verse au Voyageur » quand il ne recoit rien), ANO-ADM-24
  (alerte « litiges decidables » : 72 h en dur au lieu du parametre → `countUndecidedDisputes`). AMELIORATIONS : A160
  dossier tranche relisible (`fileKindOf`) ; refus par code et traduits, montant « 1 234,50 », rechargement apres
  decision, statut du versement et categorie en francais, compteurs de file toujours visibles, libelle reel du parametre.
  A TRANCHER : meme verrou pour le remboursement manuel (§ 5.15) et les annulations ; cle d'idempotence Stripe ;
  coordonnees du destinataire au dossier. PIEGES : FAKE indexe par intent reutilise d'un seed a l'autre (comparer en
  difference) ; `nx serve` recharge le code pendant un passage « avant ». Tests : deal 586, notification 120, harnais 402.
  Reste : § 5.10 a 8.
- 14/09 : **CAHIER 02-ADMIN — § 5.10 RETENUE D'ANNULATION TARDIVE (branche `chore/recette-admin-5-10`, empilee sur #310)**
  — 4 scenarios CONFORMES (RET-1 compensation, RET-2 restitution, + RET-3 gardes, RET-4 ce que lisent les parties),
  joues contre le code non corrige (RET-3 vert d'emblee : l'arbitrage de retenue etait DEJA sous le verrou A159 ; deux
  restitutions simultanees → 200 + 409 DECISION_IN_PROGRESS, un seul remboursement emis), puis 4/4 verts deux fois
  (`adm-ret-retenue.spec.ts`). Terrain : bzv-held paye 29,12 €, rembourse 14,56 €, retenue 14,56 € → compensation
  13,00 € (prorata serveur), Yamba 1,56 €. ANO-ADM-25 CLOSE (mineure) : l'email a l'Expediteur d'une compensation
  inventait une justification (« personne n'a pu attester… il s'etait deplace ») et disait la retenue « versee au
  Voyageur » alors que Yamba en garde la commission → part Yamba dite (FR/EN, `settlement-emails.ts`, test). ANO-ADM-26
  CLOSE (majeure, REGRESSION de ANO-ADM-23 § 5.9) : l'Expediteur lisait « Le Voyageur recoit 40,00 € » — WEB-E2E-2
  etape 18 « chacun son montant » rejoue et rouge → plus aucun montant de l'autre partie, regle portee par les tests
  unitaires. LECON : un gabarit partage se corrige contre TOUS ses lecteurs (parcours e2e compris). AMELIORATIONS : `RETENTION_DISPOSITION_LABEL` (dossier, fiche argent), indices qui disent la part de Yamba et le
  total rembourse, message de decision en francais (« statut final : Annulée », « le deal reste annule »). A TRANCHER :
  le portefeuille de l'Expediteur ne dit pas qu'une retenue attend un arbitrage ; cle d'idempotence Stripe. Tests :
  notification 121, harnais 406. Reste : § 5.11 a 8.
- 14/09 : **CAHIER 02-ADMIN — § 5.11 FINANCES, LES FILES D'EXCEPTION (branche `chore/recette-admin-5-11`, empilee sur
  #311)** — 5 scenarios CONFORMES (FIN-1 quatre onglets, FIN-2 Support, + FIN-3 message brut du fournisseur, FIN-4 tuiles
  = files, FIN-5 erreurs de l'API), joues contre le code non corrige (FIN-3 vert d'emblee : le motif du fournisseur ne
  sort jamais de l'admin), puis 5/5 verts deux fois (`adm-fin-files.spec.ts`). Terrain : 1 · 1 · 1 · 0 ; le versement
  en echec porte « compte non pret » alors que le compte de Thomas est pret. Le rejeu « Relancer » ne double pas
  l'argent (cle d'idempotence de l'executeur, respectee par FAKE comme par Stripe) — preuve de concurrence laissee au
  § 5.14. ANO-ADM-27 CLOSE (mineure, A161) : toute route inconnue des cinq services (et donc de la passerelle) servait
  la page HTML d'Express « Cannot GET … » → `notFoundHandler` 404 JSON `ROUTE_NOT_FOUND`. ANO-ADM-28 CLOSE (mineure) :
  le Support (kpi.read) lisait l'alerte « Versements en echec… » dont la carte menait a /finances, qui lui repond 403
  → carte sans lien, « transmets a Finance ou Mediateur ». AMELIORATIONS : `financeQueueWhere` partage file + tuiles
  (A161), compte de chaque file sur son onglet, `truncated`, onglet ecrit dans l'adresse, statut du deal en francais,
  « Depuis » qui dit quelle date (fin du deal / annule le / propose le), indice « le compte est pret depuis : Relancer
  peut aboutir », refus en francais (« Ton profil ne donne pas acces aux finances. »), « Relancer » sans double envoi et
  message qui nomme le montant, `INVALID_QUEUE_KIND`, sous-titre exact. Tests : auth 249, deal 587, harnais 411.
  Reste : § 5.12 a 8.
- 14/09 : **CAHIER 02-ADMIN — § 5.12 FICHE ARGENT D'UN DEAL (branche `chore/recette-admin-5-12`, empilee sur #312)** —
  5 scenarios CONFORMES (ARG-1 fiche, ARG-2 chronologie, + ARG-3 invariants comptables sur les 23 deals avec
  contre-epreuve, ARG-4 bilan et libelles, ARG-5 Support), joues contre le code non corrige (ARG-1 vert d'emblee), puis
  verts trois fois (`adm-arg-fiche-argent.spec.ts`) ; ADM-RET et ADM-FIN rejouees (14/14). Terrain SONDE en base avant
  la spec. ANO-ADM-29 CLOSE (majeure) : le Support (deals.history.read sans finances.read) ne voyait que « 403 : Your
  admin profile… » sur /deals/:id → vue reduite « Chronologie du deal », lien du dossier qui dit ce qu'il ouvre.
  ANO-ADM-30 CLOSE (jeu d'essai) : bzv-cancelled debite puis annule, jamais rembourse → seed rembourse. A162 : bilan de
  l'argent serveur (`moneyBalance`, anomalie `UNALLOCATED_FUNDS` / `OVERSPENT`), `AUTHORIZATION_RELEASED` dans la
  chronologie de l'argent. AMELIORATIONS : `redactContacts` (erreurs techniques de la chronologie sans adresse ni
  numero), statut / modele / acteurs / etats de relais en francais, actions admin resumees en clair, erreurs nommees
  (« Deal introuvable. »). PIEGE DE PILE : un `nx run-many --target=serve --all` (lance le 13/09 22:33) a repris le port
  6003 avec le fournisseur STRIPE pendant le redemarrage du bundle FAKE → PAYMENT_STATE_CONFLICT au rejeu de RET-2 ;
  verifier `lsof -iTCP:6003` + `ps` apres chaque relance. Tests : deal 595, harnais 416. Reste : § 5.13 a 8.
- 14/09 : **CAHIER 02-ADMIN — § 5.13 RAPPROCHEMENT AVEC LE FOURNISSEUR (branche `chore/recette-admin-5-13`, empilee sur
  #313)** — 3 scenarios CONFORMES (RAP-1, RAP-2 partielle Stripe reel, + RAP-3 gardes), joues contre le code non corrige
  (RAP-1 rouge), puis verts deux fois (`adm-rap-rapprochement.spec.ts`) ; ARG, FIN, RET (adaptee), MED rejouees (27/27).
  Terrain SONDE : 26 deals rapproches par l'API. ANO-ADM-31 CLOSE (majeure) : `FakePaymentProvider.inspect` passait par
  `retrieve` → adoptait les intents seedes (AUTHORIZED 0 EUR) → fausses divergences CAPTURE_RECORDED_NOT_LIVE /
  TRANSFER_MISSING et une lecture qui ecrit. ANO-ADM-32 CLOSE (majeure) : toute erreur fournisseur lue « paiement
  introuvable », `transfers.retrieve` avalait toute erreur → `PaymentIntentNotFoundError` + `isStripeResourceMissing`,
  panne = 503 PROVIDER_UNAVAILABLE journalise. A163. RAP-2 prouve en local REFUND_NOT_RECORDED (le code bloquant du
  cahier), REFUND_RECORDED_NOT_LIVE, TRANSFER_AMOUNT_MISMATCH, TRANSFER_MARKED_REVERSED_BUT_LIVE_OK (geste d'argent reel
  sur le Fake + manoeuvres base). AMELIORATIONS : carte qui nomme le fournisseur, aide FR par divergence, statuts FR,
  refus par code, journal « Rapprochement fournisseur ». PIEGE : la memoire du Fake survit au rejeu du jeu d'essai (une
  fiche constate l'etat initial, ne l'exige pas). Tests : deal 598, harnais 419. Reste : § 5.14 a 8.
- 18/09 (fin d'apres-midi) : **L'ACCUEIL REFONDU — UNE PAGE QUI NE DIT QUE DU VRAI (#357, 12 commits de revue iterative sur poste).**
  SUPPRIMES : statistiques inventees (12k+ utilisateurs, 1200+ avis 4,8/5, 2,4T CO2, 45 trajets actifs), quatre
  temoignages fictifs (risque juridique : avis fictifs = pratique commerciale trompeuse), carte Leaflet decorative aux
  compteurs factices, photo iStock FILIGRANEE plein hero, grille de commission 85/15, trois repetitions du trio
  24h/-73%/0CO2, cinq etapes melant tutoiement/vouvoiement dont une etape « Signez » inexistante dans le produit.
  STRUCTURE FINALE (6 blocs, tous vrais) : hero CLAIR compact (degrade chaud, illustration SVG maison en bloc arrondi
  facon Blablacar, moitie -> bord droit, pied au-dessus de la barre) -> barre de recherche STICKY PLEINE TAILLE sous le
  header sur toute la page (enfant DIRECT du flux : sticky ne colle que dans les bornes de son parent — c'est pourquoi
  elle n'avait jamais colle depuis le hero ; disableCompact au scroll) -> ligne de confiance par MECANISMES (sequestre
  Stripe, code, verifications) -> corridors REELS derives des trajets PUBLISHED (puce -> /search preremplie via
  seedPersistedFormState, section absente si zero trajet) -> comment ca marche a DEUX onglets (la face Voyageur enfin
  visible, etapes du vrai parcours, tutoiement) -> confiance par les mecanismes + « le prix affiche est le prix paye »
  -> CTA final CLAIR (meme degrade que le hero, cartes blanches, icones lucide, boutons ancres mt-auto).
  LA VOIX : accroche definitive choisie parmi six candidates — « Il y a toujours quelqu'un qui part vers ta
  destination. Confie-lui ton colis. » (l'hypothetique « Et si... ? » decrivait le mecanisme sans le benefice) ;
  confiance « Ton colis est entre de bonnes mains. » ; CTA « Le prochain depart t'attend. » (les deux personas).
  MECANIQUE ATTRAPEE EN ROUTE : seedPersistedFormState (l'enveloppe {version, data} reste chez son proprietaire — la
  cle nue ne remplissait rien) ; CityAutocomplete n'ouvre plus ses suggestions sur une valeur HYDRATEE (focus/saisie
  seulement) ; l'enveloppe mobile de TripSearchBar porte relative z-10 (le hero relative peignait dessus) ; un pt-0
  residuel ecrasait le py-3 d'un bouton (ordre des utilitaires Tailwind). Diff net : ~-900 lignes, Leaflet ne charge
  plus sur l'accueil. i18n home.json reecrits FR/EN (miroir verifie, zero cle morte, le controle refuse les valeurs
  VIDES -> cle inutile SUPPRIMEE, jamais laissee a ""). RG-WEB-317 a 321, chapitre d'apprentissage 199. Tests
  INCHANGES (1565 — front seul). 18 checks comptes sur CHACUN des huit runs de CI de la journee. AUCUNE attribution
  Claude.
- 18/09 (apres-midi) : **LE PAYS S'AFFICHE PARTOUT, DERIVE DU CODE ISO — ET LA HIERARCHIE MOBILE REMISE A L'ENDROIT (#355).**
  Constat de recette visuelle : la carte resultat de `/search` n'affichait pas le pays (l'autocompletion #353 dit
  pourtant « Ville, Pays »), et en mobile heures et prix criaient tous deux en 18px quand la ville (l'info de decision)
  etait la plus petite de la carte. DIAGNOSTIC : la ligne pays existait deja sur la carte desktop mais la donnee
  n'arrivait pas — le jeu d'essai ne remplit que `originCountryCode`, jamais le texte `originCountry`, et ce texte est
  de toute facon FIGE dans la locale du createur. SOLUTION : le code ISO voyage (`fromCountryCode`/`toCountryCode` au
  contrat `YambaTripResult`, mapper trip-service, cinq openapi.json regeneres), le front derive le nom localise via
  `Intl.DisplayNames` (`apps/user-ui/src/lib/country-name.ts`, cache par locale, fallbacks nom -> texte stocke -> code ;
  CLDR desambiguise CG/CD en « Congo-Brazzaville »/« Congo-Kinshasa »). Branche sur les deux cartes de recherche, la
  page trajet publique (les DEUX rendus de l'itineraire) et la page dashboard (la garde `originRegion &&` masquait le
  pays seul). REGLE UX retenue apres revue sur poste (2 commits) : **le pays touche toujours la ville** — meme ligne en
  desktop (« Paris, France », pays en gris leger), ligne adjacente en mobile (en ligne, « Congo-Brazzaville » tronquerait
  sur ~120px) ; l'heure ne s'intercale JAMAIS dans un nom de lieu. Mobile : ville 14px semibold, pays 10px, heure 12px,
  le prix redevient l'UNIQUE element en 18px ; la parenthese (code IATA) disparait ; deux `toLocaleString("fr-FR")` en
  dur suivent desormais `useLocale()`. Tests : trip-service **308 -> 310** (codes presents ; absents -> cles ABSENTES du
  JSON, jamais null), plateforme **1565**. RG-WEB-313 a 316, chapitre d'apprentissage 198. 18 checks comptes deux fois
  (les deux runs). AUCUNE attribution Claude.
- 18/09 : **LA PASSE CAHIERS EST CLOSE — les quatre cahiers de recette sont a l'etat du code (#345, #346, #347).**
  Piste laissee ouverte par le handoff du 17/09 : rejouer sur 01-WEB, 03-API et 04-CRONS l'exercice qui avait leve la
  reserve documentaire du 02-ADMIN (#334). Meme methode : la source n'est PAS le resume mais les ecarts consignes AU FIL
  DES CHAPITRES dans les fichiers de resultats, et chaque ecart est VERIFIE DANS LE CODE avant d'etre reporte.
  Meme surprise, trois fois : **04-CRONS** — 1 ecart annonce, **12** trouves ; **03-API** — 11 listes, dont **un qui ne
  tient pas** et un deja corrige, plus **deux que la campagne n'avait pas vus** ; **01-WEB** — les ecarts ne sont pas en
  sections mais EN LIGNE dans les cellules de resultats : **17 fiches + 11 etapes** des six parcours du chapitre 6.
  QUATRE TROUVAILLES QUI VALENT PLUS QU'UNE CORRECTION DE TEXTE. (1) `scripts/recette-secret-audit.ts`, nom demande par
  le cahier 04-CRONS, **fait tomber la CI** : le controle Anti-fuite refuse tout fichier suivi dont le chemin contient
  `secret`. Le fichier reel s'appelle `audit-code-livraison.ts` pour cette raison, ecrite jusqu'ici dans son seul
  en-tete — un contournement connu d'un seul developpeur n'en est pas un. (2) La commande `rpk topic produce` du cahier,
  sans `-z none`, publie en **snappy** que kafkajs ne sait pas lire : c'est **elle** qui a provoque ANO-CRON-08
  (bloquante, consommateur mort en silence, `/health` vert). Un poison de TRANSPORT et un poison de CONTRAT ne
  s'eprouvent pas avec la meme fiche. (3) `API-AUTH-12` envoyait `currentPassword`, que le contrat ne porte pas (D65 :
  la fenetre sensible le remplace) — Zod n'etant pas strict par defaut, le champ etait retire en silence : **la fiche
  PASSAIT en enseignant un contrat faux**. (4) **Quatre chaines de traduction sont mortes** (`header.toggleLanguage`,
  `dashboardHome.demandsTitle`/`ctaRespond`, `carrierDealRequest.coverage.title`, plus `netGainSub` hors `messages/`) :
  presentes, miroitees FR/EN, jamais rendues — c'est le mecanisme meme qui fabrique un cahier faux.
  DEUX FOIS OU LA SOURCE N'A PAS ETE SUIVIE. L'ecart API n° 3 (« le jeu d'essai ne publie que deux trajets dans le
  futur ») **ne tient pas** : il en publie CINQ et `git log` montre qu'aucun n'a ete ajoute depuis — la mesure du 08/09
  portait sur une base usee par les fiches precedentes. Le cahier recoit un PREREQUIS DE DONNEES, pas une fausse
  contrainte. Et la correction d'`API-TRIP-13` visait d'abord `bzv-perkg` pour prouver la garde « trajet reserve =
  intouchable » : ce trajet porte ZERO reservation, rattrape avant commit (c'est `bzv-upcoming`).
  CLASSEMENT DES ECARTS (la partie reutilisable). Deux familles, jamais a confondre : **« le code a raison »** (attendu
  faux ou trop litteral -> corriger sa lecture) et **« decision de produit en attente »** (ecart reel, question posee,
  rien change -> ne rien consigner NON PLUS : c'est deja tranche COMME QUESTION OUVERTE). Sur les 17 fiches du 01-WEB,
  une seule cachait une anomalie (ANO-WEB-43, mineure, le DTO ne porte ni « {n} envois » ni « Membre depuis »).
  Corrige aussi dans les RESULTATS : ANO-CRON-07/08/09 portaient « ETAT : OUVERTE » en fiche et « close » au tableau
  final (les trois corrections sont bien dans le code) ; ce tableau nommait **cinq fiches qui ne sont pas celles des
  chapitres**, dont `CRON-TRAJ-5` qui n'existe nulle part, et comptait quatre majeures pour trois.
  PIEGE DE MERGE PAYE : les trois branches ajoutaient en fin des MEMES documents cumulatifs. Le script de resolution
  exigeait un saut de ligne avant `>>>>>>>` et ne voyait donc pas un bloc dont le cote distant est VIDE — il a declare
  « 1 conflit, traite » en en laissant un. Rattrape par le `grep` des marqueurs fait derriere. **Aucun des 17 checks de
  CI ne relit les `.md`** : un marqueur de conflit dans un cahier partirait sur `dev` en silence.
  Documentation seule : aucun code touche, **1563 tests inchanges**. DOC-METIER non touche (aucune regle metier ne
  bouge). Chapitres d'apprentissage **192, 193, 194**. PR **#345** (04-CRONS), **#346** (03-API), **#347** (01-WEB),
  17 checks comptes sur chacune. La passe cahiers est CLOSE. AUCUNE attribution Claude.
- 17/09 (soir) : **LES SIX « OUI » DU DOSSIER D'ARBITRAGES SONT LIVRES (A198, A198 bis, A198 ter) + A199.**
  (c) L'alerte « Versements en echec depuis plus de 48 h » mesurait autre chose que son libelle (des deals
  TERMINES depuis 48 h dont l'argent n'est pas parti) : la mesure est gardee, le LIBELLE corrige partout —
  alerte, recapitulatif quotidien (« sans mouvement depuis 24 h », sa requete porte sur `updatedAt`), catalogue
  de parametres, OpenAPI, doc admin livree, harnais. Le NOM de la regle ne bouge pas : c'est un identifiant.
  (d) « Abandonner » un renversement etait la SEULE decision d'argent muette pour la personne concernee :
  notification + email FR/EN (montant, reference, recours), JAMAIS le motif interne (A191), best effort, hors
  transaction, identifiant de notification DETERMINISTE. (a) Un effacement RGPD refuse etait le seul geste admin
  sensible absent du journal : `ACCOUNT_ERASURE_REFUSED` dans la MEME transaction que le registre — et pas de
  transaction quand il n'y a qu'une ecriture (refus oppose au membre lui-meme). (f) La fiche membre porte les
  signalements OUVERTS, servis UNIQUEMENT a qui a `reports.review` (le controleur est seul a connaitre les
  permissions) ; `null` = pas le droit de lire, JAMAIS « aucun signalement » ; on MONTRE, on ne PRE-COCHE pas.
  (g) Doublon de signalement : conflit MATERIALISE cote message-service (le message vise est un document FROID),
  REFUSE cote auth-service (Trip et User sont CHAUDS — materialiser un conflit dessus ferait payer des reessais
  a des gestes sans rapport) ou l'on corrige la CONSEQUENCE : « prioritaire des 3 ouverts » compte des
  SIGNALANTS DISTINCTS. L'index unique est ecarte deux fois : re-signaler une cible dont le dossier est CLOS est
  legitime. (e) Justificatifs servis par URL SIGNEE a duree courte, posee A LA LECTURE — la moitie du dispositif
  est HORS du depot (« Restrict unsigned URLs » chez ImageKit), consignee dans 05-YAMBA-CONFIGURATION.
  SEUL « NON » : (b) l'ecran de reinitialisation de la 2FA d'un AUTRE admin — il creerait exactement le pouvoir
  qu'un attaquant cherche, et le detour est devenu rare depuis A190 a.
  **A199, trouve en livrant A198** : `jest.mock(@packages/…, …, { virtual: true })` declare « ce module n'existe
  pas », ce qui est FAUX (le resolver Nx resout les alias) ; sous workers PARALLELES la substitution s'appliquait
  par INTERMITTENCE et le VRAI PrismaClient partait en base. Symptome : une fiche passe seule, echoue dans la
  suite, et le fichier qui tombe CHANGE d'un passage a l'autre. Retire des 30 fiches concernees ; trois passages
  paralleles verts. Tests : trip 308, deal 659, message 79, auth 395 (1563 au total).
- 17/09 : **QUATRE LIVRAISONS — cahier admin a jour (#334), A196 (#335), A197 (#336), arbitrages instruits (#337).**
  (1) **Cahier 02-ADMIN remis a l'etat du code** : la reserve documentaire du § 8 est LEVEE. Le handoff nommait trois
  ecarts ; il y en avait QUATORZE — la source exacte etant les sections « Ecarts avec le cahier » de chaque chapitre des
  resultats, pas le resume. Corriges aussi : deux renvois vers des fichiers INEXISTANTS (`RECETTE-01-MEMBRE`,
  `RECETTE-04-EXPLOITATION`), deux renvois vers des scenarios absents (`ADM-ETA-5`, `ADM-CPT-8`). Ajoute : `ADM-SES-2`
  (125 -> 126 scenarios). Tranche : **le `.md` fait foi**, le `.pdf` du 06/09 n'est plus regenere a chaque passe.
  (2) **A196 — une transition s'ecrit sur l'etat qu'elle a LU** (trip-service). Les huit transitions du trajet lisaient,
  jugeaient par la machine a etats, puis ecrivaient SANS CONDITION : deux gestes simultanes passaient tous deux la garde.
  Consequences : un double clic sur « Publier » = deux increments du compteur public ET DEUX vagues de notifications ;
  surtout, **D72 tombait** (un deal ne entre la garde et l'ecriture laissait le trajet annule avec un deal vivant). La
  condition porte sur le statut LU ; l'annulation y ajoute `reservedKg` LU — la reservation d'un deal ecrit sur le MEME
  document Trip (CAP-01), c'etait le temoin qui manquait pour qu'un service voie l'ecriture d'un autre. Pitfall A34 :
  `reservedKg` ABSENT -> condition OMISE (une garde qui peut se bloquer elle-meme est pire que la course qu'elle corrige).
  INVENTAIRE : deal-service n'avait RIEN a corriger (toutes ses ecritures passent par booking-write, deja sous rejeu).
  (3) **A197 — D2 devient executable**. Cause racine de la violation trouvee en A195 : le patron de mock du depot
  `$transaction: (fn) => fn(prismaMock)` passe LE MEME client dedans, donc dedans et dehors sont INDISCERNABLES et une
  ecriture sortie de sa transaction ne fait tomber aucune assertion. Deux fiches structurelles (client de transaction
  DISTINCT + journal des appels avec leur provenance) verrouillent la messagerie et l'ecrivain commun des deals.
  CONTRE-EPREUVE faite : defaut reintroduit volontairement -> fiche ROUGE sur le bon scenario -> code restaure.
  (4) **Les sept points a trancher sont INSTRUITS** (§ 8 des resultats) : etat reel verifie dans le code, enjeu, options
  chiffrees, recommandation. Recommandations : journaliser le refus d'effacement RGPD (oui) · ecran de reinitialisation
  2FA d'un autre admin (NON — cree le pouvoir que cherche un attaquant) · « versements en echec 48 h » = corriger le
  LIBELLE, la mesure est bonne · email au Voyageur sur un renversement abandonne (oui, motif generique, sans evenement) ·
  URL signees pour les justificatifs avant l'ouverture publique (oui) · montrer le motif du signalement sans pre-cocher
  la categorie (oui) · doublon de signalement : conflit materialise, PAS d'index unique (re-signaler une cible dont le
  dossier est clos est legitime). ~1,75 jour de « oui » immediats. Tests : trip 305, deal 649, message 74 (1150 + auth 393).
- 16/09 : **PASSE CONCURRENCE MEMBRE (A195, PR #332 MERGEE, branche `feat/concurrence-membre`)** — suite directe d'A192, qui avait
  solde le perimetre ADMIN et laisse l'inventaire des cinq fichiers MEMBRE. Trois regles etendues : (1) l'ecriture se
  conditionne a l'etat LU (`updateMany`/`deleteMany` qui COMPTENT, jamais `update`/`delete` qui levent P2025 -> 500) —
  profil, avatar pose, avatar supprime, reinitialisation du mot de passe (garde sur l'empreinte LUE, pas sur `updatedAt` :
  le jeton est deja consomme, un refus faux couterait tout le parcours email), marqueur de lecture (n'AVANCE que), purge
  des fils a un an ; (2) une collision d'unicite P2002 porte une REPONSE METIER, jamais un 500 — une lecture d'unicite ne
  reserve rien : inscription -> 409 EMAIL_ALREADY_USED, Google -> rattachement, ouverture d'un fil et revelation d'un
  numero -> idempotents (champ visé lu dans `meta.target` : un slug public est un TIRAGE, on retire) ; (3) un geste = UNE
  transaction rejouee par `withWriteConflictRetry` — proposer/accepter un rendez-vous et reveler un numero ecrivaient leur
  changement d'etat PUIS, dans une seconde transaction, le message et l'evenement (violation D2 restee invisible).
  DEUX COURSES QUI NE SE RATTRAPAIENT PAS : la purge nocturne effacait un fil redevenu actif avec son message tout neuf ;
  deux propositions simultanees laissaient DEUX rendez-vous PROPOSED du meme type. PIEGE STRUCTURANT : deux transactions
  qui creent chacune LEUR document ne se voient pas (Mongo detecte le conflit PAR DOCUMENT, jamais par predicat) — c'est
  la `Conversation`, document PARTAGE (`lastMessageAt` bouge a chaque message), qui rend le conflit detectable ; la
  perdante rejouee annule alors la proposition de la gagnante, ce qui EST la regle metier (contre-proposition).
  PIEGE D'OUTILLAGE : un fichier de test sans `import` ni `export` est un SCRIPT pour TypeScript — ses constantes de tete
  tombent dans la portee globale partagee et se heurtent a celles des autres fiches (TS2451 au `nx typecheck`, rapporte
  sur le FICHIER VOISIN, jamais vu par `nx test`) -> `export {};` en pied. Tests : message 57 -> 68, auth 376 -> 393
  (plateforme 1144). Docs : A195, DOC-TECHNIQUE, DOC-METIER (RG-CNC-04 a 09, CNC5 a CNC13), APPRENTISSAGE ch. 188.
- 16/09 : **TOUTE LA CAMPAGNE DE RECETTE EST DANS `dev`** — les 59 PR empilees (#270 -> #329, cahiers 01-WEB et 02-ADMIN,
  200 commits) plus #271 (D78 securite de la connexion) mergees ; **zero PR ouverte**. La pile etait strictement lineaire
  (`dev` en etait un ancetre) : aucun conflit sur les 59. Les dix dernieres (#320 -> #329) n'avaient jamais eu de CI — le
  workflow ne se declenche que sur les PR qui ciblent `dev`, et un simple retarget n'emet pas d'evenement : il faut
  fermer/rouvrir la PR. Retargetees puis relancees : **17/17 chacune**, et la CI de `dev` est verte sur les deux merges.
  Seule #271, hors pile, a demande une resolution : 4 fichiers, tous des ajouts en fin de fichier (CLAUDE.md et les trois
  docs cumulatifs), plus le chapitre d'apprentissage D78 renumerote **131 -> 187** (131 etait pris par WEB-TRJ). Reference
  des tests remise a la MESURE dans CLAUDE.md : trip 293, deal 644, notification 122, message 57, auth **376** (+20 D78).
- 16/09 : **CAHIER 02-ADMIN — § 7 NON-REGRESSION + § 8 CONSIGNATION (branche `chore/recette-admin-7`, empilee sur `chore/recette-admin-6`) — FIN DU CAHIER ADMIN** —
  9 scenarios ADM-NRG (`adm-nrg-non-regression.spec.ts` : sous-titres perimes, filtres d'URL de la file d'arbitrage,
  libelle « Signalement traite », cle React des parametres, alertes hors accueil, journal filtrable, cinq ecarts
  documentaires + **NRG-8 gestes simultanes** et **NRG-9 categorie de sanction**). ENGAGEMENT P2034 SOLDE.
  ANO-ADM-89 CLOSE (majeure) : proposer / appliquer / lever une sanction lisaient puis ecrivaient sans condition → 500
  P2034 ou deux decisions, deux lignes, deux emails ; verrou optimiste `updatedAt` + `withWriteConflictRetry`, perdant 409
  ACCOUNT_STATE_CHANGED, fiche rechargee. ANO-ADM-88 CLOSE (majeure) : le meme code TOTP servait trois fois (anti-rejeu lu
  avant la transaction) → garde dans l'ecriture (`totpLastUsedStep` null / isSet:false / lt, `totpEnabledAt` absent).
  ANO-ADM-90 CLOSE (majeure) : `GET /auth/me` servait `suspensionReason` (motif INTERNE) au membre sanctionne → le membre
  lit `suspensionCategory`. ANO-ADM-92 (mineure) : « 72 h » en dur dans le formulaire de decision. ANO-ADM-91
  (cosmetique) : note du journal fausse depuis ANO-ADM-73. DECISIONS : A192 (ecriture conditionnelle + rejeu du conflit,
  partout ; inventaire : plus aucun `$transaction` admin sans rejeu ; 5 fichiers MEMBRE listes pour une passe ulterieure),
  A193 (categorie de sanction en liste FERMEE communiquee au membre, motif libre interne, lecture tolerante `OTHER`),
  A194 (une tuile qui compte n objets mene a une liste qui montre ces n objets : filtre serveur `proposal=1`,
  `UsersSearch` initialise depuis l'URL sous `<Suspense>`). CONTRE-EPREUVE : quatre fichiers d'origine remis → **16 rouges
  sur 356** (5 suites) ; NRG 9/9 vert deux fois ; voisins ADM-ACC 3, ADM-JRN 7, ADM-MED 9, ADM-SNC 7 (SNC-1 et 2 realignees
  sur `after.category` et le bandeau de la fiche). § 8 : tableau de suivi (31 chapitres, 196 scenarios du cahier, 211 au
  harnais), 92 anomalies closes (5 bloquantes, 48 majeures, 38 mineures, 1 cosmetique), 12 criteres de sortie — **recette
  admin conforme AVEC RESERVES DOCUMENTAIRES** (le cahier `RECETTE-02-ADMIN.md` decrit encore des etats d'avant
  correction). Un seul scenario non joue : ADM-RAP-2 (Stripe reel ; substitution unitaire + FAKE livree). Tests : auth
  **356**, deal 644, message 57, trip 293, notification 122, harnais **543**. Reste : mise a jour du cahier 02-ADMIN sur
  les ecarts documentaires ; arbitrages accumules (refus d'effacement au journal, reinitialisation 2FA, passe concurrence
  MEMBRE).
- 15/09 : **CAHIER 02-ADMIN — § 6 CAS DE BOUT EN BOUT (branche `chore/recette-admin-6`, empilee sur `chore/recette-admin-5-26`)** —
  8 scenarios ADM-E2E (`adm-e2e-bout-en-bout-1-4.spec.ts` : litige → argent, sanction proposee → appliquee → levee, trois
  signalements, parametre < 30 s ; `adm-e2e-bout-en-bout-5-8.spec.ts` : lecture seule et levee, effacement RGPD, versement
  en echec → cloture, billet + masquage) + ADM-SES-6, 7 (lots du § 5.26), SES-1 et 5 realignees. ANO-ADM-87 CLOSE
  (majeure) : l'email « compte restreint / suspendu » citait le motif interne (souvent repris de la proposition du Support)
  → `reason` retire du type `AccountStatusParams`, motif generique (A191). ANO-ADM-85 (lien « rapprochement Stripe »),
  ANO-ADM-86 (deal sans fil affiche comme une erreur) closes ; jeu d'essai : fil de deux messages sur YAM-2041. DECISIONS :
  A190 (`POST /admin/me/backup-codes` sur code TOTP, jamais 401 ; `DELETE /admin/me/sessions` ; `adminAccessClaims` unique ;
  renouvellement reclame par `SET admin_rotated:<user>:<jti> NX EX 30`), A191 (email de sanction generique ; categorie de
  motif en liste fermee PROPOSEE). CONTRE-EPREUVE : rouges vus en recette (E2E-1 libelle et fil, E2E-2 motif) ; unitaires
  sur le code d'origine 6/20 rouges. Tests : auth 342, deal 644, message 57, trip 293, notification 122, harnais 534.
  Reste : § 7 (ADM-NRG-1 a 7 + P2034 admin-users / admin-auth), § 8.
- 15/09 : **CAHIER 02-ADMIN — § 5.26 MES SESSIONS (branche `chore/recette-admin-5-26`, empilee sur #326) — FIN DU § 5** —
  5 scenarios ADM-SES (1 du cahier + SES-2 reconnaitre une session, SES-3 serveur injoignable, SES-4 journal des sessions
  fermees, SES-5 codes de secours et panne de lecture) + ADM-CPT-12, 13 (lots du § 5.25), CPT-4 realignee (invite du
  motif). CONTRE-EPREUVE : SES-1 a 5 ROUGES sur le code d'origine ; CPT-12, 13, SES-2, 4 ROUGES backend d'origine.
  ANO-ADM-81 CLOSE (majeure) : sessions sans appareil ni IP (« Revoque ce que tu ne reconnais pas » impossible).
  ANO-ADM-82 CLOSE (majeure) : « Se deconnecter » affichait /login sur une panne, session toujours ouverte. ANO-ADM-83
  (mineure) : deconnexion rejouee / session deja fermee journalisees. ANO-ADM-84 (mineure) : « code(s) », rien a zero code,
  panne affichee « Aucune session. ». DECISIONS : A188 (enregistrement de session : ip, userAgent, device recopies a la
  rotation ; `revokeAdminSession` → booleen, 404 `ADMIN_SESSION_NOT_FOUND` ; /login apres 200/401 seulement), A189 (lots :
  `POST /admin/admins/:id/invite/resend` + `inviteExpiresAt`, motif facultatif du retrait au journal, emails
  `adminRolesChanged` / `adminAccessRevoked` sans lien ni motif). SYNTHESE § 5 : 26 chapitres conformes, 80 anomalies
  closes (4 bloquantes, 42 majeures, 34 mineures), A155 → A189. PIEGE : `nx build` sans `--skip-sync` peut ne rien rebatir
  en non interactif — verifier une chaine nouvelle dans `dist/main.js`. Tests : auth 334, deal 644, message 57, trip 293,
  notification 122, harnais 524. Reste : § 6 (ADM-E2E-1 a 8), § 7 (+ P2034 admin-users / admin-auth), § 8.
- 15/09 : **CAHIER 02-ADMIN — § 5.25 COMPTES ADMIN (branche `chore/recette-admin-5-25`, empilee sur #325)** — 11
  scenarios ADM-CPT (1 a 5 du cahier + CPT-6 compte sans mot de passe / ancien lien, CPT-7 clics simultanes, CPT-8
  retrogradations croisees, CPT-9 refus francais, CPT-10 et 11 pour les lots du § 5.24). CONTRE-EPREUVE : CPT-2, 3, 4, 6, 7,
  8, 9, 10, 11 ROUGES (CPT-1 et 5 ne touchent aucun code corrige). ANO-ADM-75 CLOSE (majeure) : compte sans mot de passe
  reinvite → « acces accorde » vers un /login impossible. ANO-ADM-76 CLOSE (majeure) : ancien lien d'invitation revivant a
  la reinvitation. ANO-ADM-77 CLOSE (majeure) : lien a usage multiple sous clics simultanes. ANO-ADM-78 CLOSE (majeure) :
  deux retrogradations croisees → zero super administrateur (write skew). ANO-ADM-79 CLOSE (majeure) : invitations
  simultanees `[201, 500, 500]`. ANO-ADM-80 (mineure) : ecran en anglais, propre ligne modifiable, OpenAPI 409 au lieu de
  403. ARBITRAGES : A185 (un lien vivant par compte, reclame, lien de mot de passe pour un compte sans mot de passe), A186
  (un super administrateur EN SERVICE, garde `PlatformSettings admin-accounts` + rejeu — ENGAGEMENT § 7 tenu pour
  admin-admins, restent admin-users et admin-auth), A187 (auteurs du journal, avant → apres, export du journal filtre
  `audit.read` ET `exports.personal`). POSTE : un troisieme super administrateur en service existe (compte du proprietaire)
  — CPT-8 le mesure. Tests : auth 319, deal 644, message 57, trip 293, notification 122, harnais 517. Reste : § 5.26 a 8.
- 15/09 : **CAHIER 02-ADMIN — § 5.24 JOURNAL D'AUDIT (branche `chore/recette-admin-5-24`, empilee sur #324)** — 7
  scenarios ADM-JRN (1 a 4 du cahier + JRN-5 panne, JRN-6 journees locales, JRN-7 pagination filtree) + ADM-ETA-10,
  ADM-MNT-7, 8 (lots du § 5.23) ; JRN 14/14 sur deux passages, voisins ETA, MNT, USR, TRJ 34/35 au premier passage (seule
  JRN-1 rouge : ANO-ADM-74, corrigee). CONTRE-EPREUVE : JRN-1, 2, 3, 5, 6, 7, ETA-10, MNT-7, 8 ROUGES. ANO-ADM-68 CLOSE
  (majeure) : « Filtrer sur cet auteur » = recherche locale sur 50 lignes. ANO-ADM-69 CLOSE (majeure) : « Du / Au » lus en
  UTC (journee de Paris decalee de 2 h). ANO-ADM-70 CLOSE (majeure) : « Type de cible » proposait DISPUTE, MAINTENANCE,
  EXPORT jamais ecrits et oubliait CONVERSATION. ANO-ADM-74 CLOSE (majeure) : identifiant de cible non ObjectId (cle de
  parametre, `maintenance`, session) ignore sans le dire. ANO-ADM-71, 72, 73 (mineures) : select « Action » reduit aux
  lignes chargees, panne affichee « Aucune action journalisee. », detail en JSON brut (journal et cartes). DECISIONS : A183
  (catalogues `ADMIN_ACTIONS` / `ADMIN_TARGET_TYPES` fermes et types, filtres = ceux du serveur, index `[ip, createdAt]`),
  A184 (lots : `AdminShell` → /login sur 401 seulement, bandeau membre 15 s / 60 s, `isExemptPath` par segment). Schema :
  un index (`prisma db push`). Tests : auth 296, deal 644, message 57, trip 293, notification 122, harnais 506. Reste :
  § 5.25 a 8.
- 15/09 : **CAHIER 02-ADMIN — § 5.23 MAINTENANCE (branche `chore/recette-admin-5-23`, empilee sur #323)** — 6 scenarios
  ADM-MNT (1 a 4 du cahier + MNT-5 salve d'enregistrements, MNT-6 date passee / saisie longue) + ADM-ETA-8, 9 et ADM-RGP-8
  (lots du § 5.22), RGP-2 realignee ; 10/10 verts, MNT deux fois (avec voisins ETA, RGP, ALR, WEB-MNT : 30/31, RGP-2
  realignee). CONTRE-EPREUVE : les neuf fiches nouvelles ROUGES. ANO-ADM-63 CLOSE (majeure) : lever gardait l'annonce
  (bandeau ambre, email « planifiee »). ANO-ADM-64 CLOSE (majeure) : `envOverride` lu dans l'auth-service au lieu du
  gateway, « lever » possible pendant un forcage. ANO-ADM-65 CLOSE (majeure) : `[200, 500, 500]`. ANO-ADM-66 CLOSE
  (majeure) : date d'annonce relue -2 h (`slice(0, 16)` UTC). ANO-ADM-67 (mineure) : date passee acceptee, saisie effacee
  par le sondage, refus en anglais. ARBITRAGES : A181 (transitions : lever clot l'annonce, annonce a venir, email par
  transition, 409), A182 (interrupteur lu dans la sante du gateway, ecran ferme, 409). LOTS § 5.22 : retard du relais
  (regle `isOutboxLagging` partagee avec l'alerte), bloqueurs comptes, gateway 502 `UPSTREAM_UNREACHABLE` + bandeau
  « Service d'authentification injoignable ». POSTE : gateway desormais en bundle detache (plus `nx serve`). Tests : auth
  293, deal 644, message 57, trip 293, notification 122, harnais 496. Reste : § 5.24 a 8.
- 15/09 : **CAHIER 02-ADMIN — § 5.22 ETAT DES SERVICES (branche `chore/recette-admin-5-22`, empilee sur #322)** —
  7 scenarios ADM-ETA CONFORMES (ETA-1 a 3 du cahier : service REELLEMENT tue puis relance, Redpanda REELLEMENT arrete
  puis relance, poison parque ; + ETA-4 email remis, ETA-5 seuil parque, ETA-6 maintenance, ETA-7 profils / relecture en
  echec) + ADM-RGP-2 realignee + ADM-RGP-7. CONTRE-EPREUVE : ETA-2, 4, 5 ROUGES sur les anciens bundles ; ETA-1, 2, 6, 7
  ROUGES avec l'ancien StatusView ; tests A179 rouges sans le recomptage. ANO-ADM-61 CLOSE (majeure) : « Emails (24 h) »
  ne comptait que SENT (le webhook D35 passe l'email a DELIVERED / BOUNCED) → A177. ANO-ADM-62 CLOSE (majeure) : seuil
  « parque » reglable jusqu'a 100, relais a 10 en dur → A176 constante partagee `OUTBOX_MAX_RELAY_ATTEMPTS`, borne 10,
  valeurs hors bornes ramenees a la lecture (`mergeSettingsValues`, toutes les cles). A178 : `CRON_CATALOGUE` (13 crons),
  `missingCrons` + `late` calcules cote serveur, test qui lit les `*.cron.ts`. A179 (lots du § 5.21) : bloqueurs
  recomptes DANS la transaction d'effacement + `fenceShipperAccount` (la reservation ecrit le User → P2034 → rejeu ;
  409 `ACCOUNT_DELETED`), `GET /admin/users/:id/erasure-blockers`, registre `?userId=`. A180 : purge manuelle ECARTEE.
  AMELIORATIONS : age « Relu il y a » vivant, refus en francais, maintenance en ambre, uptime lisible, resume du battement
  payout-bookings. Tests : auth 282, deal 643, message 57, trip 293, notification 122, harnais 487. Reste : § 5.23 a 8.
- 15/09 : **CAHIER 02-ADMIN — § 5.21 DONNEES PERSONNELLES / RGPD (branche `chore/recette-admin-5-21`, empilee sur #321)** —
  6 scenarios ADM-RGP (RGP-1 a 4 du cahier + RGP-5 salve d'effacements, RGP-6 profil refuse) + ADM-PAR-13 (A172) et
  ADM-PAR-14 (A173/A174), verts ; RGP deux fois. CONTRE-EPREUVE : RGP-1, 3, 5 ROUGES. ANO-ADM-57 CLOSE (majeure) : une
  ouverture du registre = deux `DATA_REQUESTS_VIEWED` → recordAdminRead (A168). ANO-ADM-58 CLOSE (majeure) : trois
  effacements simultanes `[200, 500, 500]` → rejeu P2034 + AccountNotFoundError 404. ANO-ADM-59 (mineure) : message de
  succes demonte avec la carte. ANO-ADM-60 (mineure) : « 404 : User not found. ». RGP-4 JOUE (service du cron appele par
  le harnais). ARBITRAGES DELEGUES DU 15/09 LIVRES : A172 conditions d'annulation figees a la creation
  (`Booking.cancellationTerms`, prisma generate + db push) ; A173 reset OPS dans sa portee (`skipped`) ; A174 portee avant
  bornes ; A175 seed-settings version monotone ; invariant plafond ≥ prime garde ; recopie decideur sur Report rejetee.
  ECARTS : connexion apres effacement = INVALID_CREDENTIALS (pas ACCOUNT_DELETED) ; retention min 7 (cahier : 0).
  Tests : auth 270, deal 641, message 57, trip 293, harnais 479. Reste : § 5.22 a 8.
- 15/09 : **CAHIER 02-ADMIN — § 5.20 PARAMETRES DE LA PLATEFORME (branche `chore/recette-admin-5-20`, empilee sur #320)** —
  12 scenarios CONFORMES (PAR-1 a 7 du cahier + PAR-8 salve simultanee document absent / present, PAR-9 echeance de
  litige, PAR-10 refus a l'ecran, PAR-11 document illisible, PAR-12 page refusee), verts deux fois. CONTRE-EPREUVE : PAR-2,
  3, 8, 9, 10, 12 ROUGES (PAR-1, 4, 5, 6, 7, 11 hors code corrige). ANO-ADM-51 CLOSE (majeure) : ecritures simultanees →
  500 (P2002 a la creation, P2034 a la mise a jour) → rejeu + P2002 = 409 STALE_VERSION. ANO-ADM-52 CLOSE (majeure) :
  l'echeance d'un litige OUVERT suivait le parametre courant (72 h → 12 h : date annoncee au Voyageur reculee, dossier
  decidable) → A169 `Dispute.responseDueAt` fige a l'ouverture. ANO-ADM-53 (mineure) : email « 48 hours » → formatSettingValue.
  ANO-ADM-54 (mineure) : refus « 400 : anglais » et 400 sans code (cle fautive masquee en production) → codes +
  settingsRefusalMessage. ANO-ADM-55 (mineure) : reinitialisation perimee sans rechargement. ANO-ADM-56 (mineure, voisin ACC-3) : bandeau d'accueil
  additionnant des ecritures de meme version (document remis a zero). HARNAIS : MED / RPT reouvrent les litiges sous un
  delai (A169). AMELIORATIONS : apercu « 3,00 € »,
  envoi unique, bandeau d'accueil en libelles, pricing params `no-cache` (le cache navigateur s'ajoutait au cache 30 s).
  DECISIONS DU 15/09 INTEGREES : SCAM = « Arnaque suspectee » partout ; A171 decision de signalement (qui, quand, note)
  lue au journal sous « traite / sans suite », deux files ; A170 un seul refus par page refusee (`PageAccess`, 14 pages,
  refus du SERVEUR). ENGAGEMENT § 7 : rejeu P2034 sur admin-admins / admin-users / admin-auth. A TRANCHER : conditions
  d'annulation figees a l'acceptation ? version monotone apres seed-settings ; reset API de l'Exploitation ; regle
  plafond ≥ prime inatteignable. Tests : auth 263, deal 637, message 57, trip 293, harnais 471. Reste : § 5.21 a 8.
- 15/09 : **CAHIER 02-ADMIN — § 5.19 SIGNALEMENTS (branche `chore/recette-admin-5-19`, empilee sur #319)** — 9 scenarios
  CONFORMES (SIG-1 a 5 du cahier + SIG-6 cible disparue, SIG-7 double clic / deux admins, SIG-8 salve simultanee dans les
  deux files, SIG-9 « Compte neuf »), verts deux fois. CONTRE-EPREUVE : SIG-5 a 9 ROUGES, SIG-1 a 4 hors code corrige.
  ANO-ADM-46 CLOSE (majeure) : trois decisions simultanees → `[200, 500, 500]` (P2034) dans les DEUX files →
  `withWriteConflictRetry` autour de la transaction, au reessai la garde repond 409. ANO-ADM-47 CLOSE (majeure) : cible
  disparue (trajet purge, membre introuvable) → signalement SORTI de la file, OPEN pour toujours → reste, `targetMissing`,
  « Trajet introuvable », se clot. ANO-ADM-48 (mineure) : badge « Compte neuf » affiche → `isAlertTrustLevel` (WATCH /
  HIGH_RISK seuls). ANO-ADM-49 (mineure) : double clic = deux PATCH, refus « 409 : anglais » sans rechargement →
  bouton occupe + `reportRefusalMessage`. ANO-ADM-50 (mineure) : profil refuse → message anglais + « Chargement… » sans
  fin. ECART : motif SCAM « Arnaque suspectee » au front, « Tentative d'arnaque » au back-office. A TRANCHER : aligner le
  libelle ; note et auteur de la decision visibles sous « traite ». Tests : auth 254, message 54, harnais 457. Reste :
  § 5.20 a 8.
- 15/09 : **CAHIER 02-ADMIN — § 5.18 CONVERSATIONS (branche `chore/recette-admin-5-18`, empilee sur #318)** — 5 scenarios
  CONFORMES (CNV-1, 2, 3 du cahier + CNV-4 numero tape, CNV-5 une ouverture = une ligne sur cinq ecrans), verts deux fois.
  CONTRE-EPREUVE : les cinq ROUGES. ANO-ADM-42 CLOSE (majeure) : numero et adresse TAPES par un membre lisibles au
  back-office sous « Le numero de telephone n'apparait jamais ici » (fil, precisions, file de moderation) → `redactContacts`
  (deplacee dans `@packages/api-contracts`). ANO-ADM-44 CLOSE (majeure) : chaque ouverture de CINQ ecrans sensibles
  (CONVERSATION/USER/DISPUTE/DEAL_MONEY/TRIP_VIEWED) ecrivait DEUX lignes (effet de montage rejoue par React StrictMode,
  serveur non idempotent) → A168 `recordAdminRead` (`@packages/admin-audit`) : SET NX EX 10 par admin/action/cible, Redis
  en panne → ligne ecrite (fail-open). ANO-ADM-43 CLOSE (mineure) : « ← Dossier du deal » → « jamais passe en mediation »
  → « ← Fiche du deal » + « ← Dossier de mediation » si `mediationFile`. ANO-ADM-45 CLOSE (mineure) : refus d'ecran en
  anglais pour la Finance. ECART : la route du cahier `/api/admin/conversations/<id>` n'existe pas (by-deal). HARNAIS : le
  journal se relit avec le super admin (Mediateur / Support sans audit.read). A TRANCHER : demasquer a la demande. Tests :
  message 51, harnais 448. Reste : § 5.19 a 8.
- 15/09 : **CAHIER 02-ADMIN — § 5.17 PILOTAGE ET DRILLDOWN (branche `chore/recette-admin-5-17`, empilee sur #317)** — 6
  scenarios CONFORMES (PIL-1 a 4 du cahier + PIL-5 « point = drilldown, remboursement date comme au rapport », PIL-6 fenetre
  des corridors), verts deux fois. CONTRE-EPREUVE fiche par fiche sur le code du § 5.16 : PIL-1, 2, 4 conformes ; PIL-3, 5,
  6 ROUGES. ANO-ADM-40 CLOSE (majeure) : le pilotage (auth-service `pilotage.rules.ts`) lisait le « Rembourse » comme le
  rapport d'AVANT A166 → aout 0 € au pilotage / 10 € au rapport, septembre 91,16 € / 53,16 € ; drilldown « refunded » par
  cumul. ANO-ADM-41 CLOSE (mineure) : un corridor du registre permanent des recherches ressortait dans toute fenetre, tout a
  zero. A167 : la regle A166 (`refundEntries`…) DEMENAGE dans `@packages/api-contracts` (git mv + reexportation deal-service),
  le pilotage l'emprunte ; drilldown « refunded » = un element par remboursement (`refundDrilldownItems`) ; corridors sans
  activite dans la fenetre exclus. AMELIORATIONS : pied du drilldown en jours UTC (`utcPeriodLabel`, partage avec le
  rapport), erreurs du pilotage en francais, fiche PIL-3 sur la periode la plus remplie. POSTE : coupure Redis non jouable
  (Upstash), repli en tests unitaires. Tests : auth 252, deal 635, harnais 443. Reste : § 5.18 a 8.
- 14/09 : **CAHIER 02-ADMIN — § 5.16 RAPPORT MENSUEL ET EXPORT FINANCES (branche `chore/recette-admin-5-16`, empilee sur
  #316)** — 5 scenarios CONFORMES (RPT-1, 2, 3 du cahier + RPT-4 « un mois clos ne change pas », RPT-5 annulation avant
  capture), verts deux fois. CONTRE-EPREUVE avant le code (pile encore sur le serveur du § 5.15) : RPT-4 et RPT-5 ROUGES.
  ANO-ADM-37 CLOSE (majeure) : chaque remboursement ecrasait `refundedAt` / `refundId` → 10 € rembourses le 15 aout puis
  5 € aujourd'hui : aout 10,00 € x1 → 0,00 € x0 (mois clos modifie, export non reproductible, premier refundId perdu).
  ANO-ADM-38 CLOSE (majeure) : une annulation AVANT capture (cumul = total, rien debite) comptait 28 € en « Rembourse » et
  levait OVERSPENT sur la fiche argent. A166 (valide par le fondateur) : `Booking.refunds: BookingRefund[]` (refundId,
  amountCents, refundedAt, kind CANCELLATION / PICKUP_REFUSED / DISPUTE / RETENTION_RESTITUTION / MANUAL), ecrite en
  entier par les cinq chemins dans la transaction du cumul (`withRefund`, qui materialise l'ancien remboursement d'un
  document anterieur en LEGACY A SA DATE avant de l'ecraser), lue par `refundEntries` (vide sans capture) : rapport,
  CSV (+ `refundCount`, `refundedInPeriodCents`), chronologie, bilan, fiche argent `payment.refunds`. ANO-ADM-39 CLOSE
  (mineure) : l'export finances ouvrait encore un onglet (`window.open`, echappe au correctif ANO-ADM-13 du § 5.6) →
  `downloadFile`, periode verifiee a l'ecran, refus par code, nombre de lignes. AMELIORATIONS : pied du rapport en UTC au
  dernier jour inclus, fichier nomme au dernier jour inclus, liste des remboursements sur la fiche argent, seed
  `deliveryPhotoUrls: []` (23 documents sans la liste). INVARIANT Σ liste = cumul (demande du fondateur) :
  `refundListExcessCents`, anomalie de bilan REFUND_RECORDS_MISMATCH, verifie et contre-eprouve par ADM-ARG-3. A TRANCHER : mois UTC ou Paris ; geste commercial = charge ou
  moins-revenu ; historique des VERSEMENTS (re-verser ecrase payoutSentAt). Tests : deal 635, harnais 437. Reste : § 5.17 a 8.
- 14/09 : **CAHIER 02-ADMIN — § 5.15 REMBOURSEMENT MANUEL EN DEUX GESTES (branche `chore/recette-admin-5-15`, empilee
  sur #315)** — reprise du WIP `b5b6f31` interrompu a l'arret du poste : relu, verifie (typecheck CI x8, tests, OpenAPI,
  i18n), rejoue. 6 scenarios CONFORMES (REM-1, 2, 3 du cahier + REM-4 trois applications simultanees, REM-5 proposition
  caduque, REM-6 saisie FR et ecran perime), verts deux fois. CONTRE-EPREUVE par worktree a `5b35ef9` (deal +
  notification non corriges, ecran de la branche) : REM-2 et REM-4 ROUGES. ANO-ADM-34 CLOSE (BLOQUANTE) : trois
  « Rembourser maintenant » simultanes → 3 remboursements chez le fournisseur, 1 en base, deux 409 TRANSITION_NOT_ALLOWED
  (le verrou conditionnel du cumul protegeait la base, pas l'argent parti avant, D39). A165 : verrou de decision du deal
  (meme cle que la mediation, A159) avant toute lecture, 409 DECISION_IN_PROGRESS, echec ferme sans verrou ; cle
  d'idempotence fournisseur `refundIdempotencyKey` sur TOUS les remboursements (manuel avec cumul lu, annulation, refus au
  pickup, mediation, retenue, retour de capture) ; proposition caduque servie (`stale`, `staleReason`, `proposalStale`).
  ANO-ADM-35 CLOSE (majeure) : l'email d'un geste commercial annoncait « Annulation a moins de 48 h : une retenue de
  34,20 € » → `commercialGesture` (acteur ADMIN), paragraphe FR/EN. ANO-ADM-36 CLOSE (majeure) : portefeuille « retenue
  reversee au Voyageur » pour tout remboursement partiel apres la fin du deal (geste, mediation) → `partialKind`,
  `keptCents` au contrat, libelle « {garde} ont regle ton envoi ». AMELIORATIONS : saisie FR partagee (`parseEurosToCents`),
  garde ref, refus par code (`manualRefundRefusal`, recharge), caducite a l'ecran et en file, compteur de motif,
  remplacement signale, refundId dans le message. Harnais : WEB-CNF-10 (libelle AFTER_COMPLETION). Tests : deal 615,
  notification 122, harnais 432. Reste : § 5.16 a 8.
- 14/09 : **CAHIER 02-ADMIN — § 5.14 VERSEMENTS : REJEU ET RENVERSEMENT (branche `chore/recette-admin-5-14`, empilee sur
  #314)** — 7 scenarios CONFORMES (VER-1, 2, 3 du cahier + VER-1 bis double clic, VER-1 ter quatre relances simultanees,
  VER-2 bis deux re-versements simultanes, VER-4 ecran perime), joues contre le code non corrige (6/6 verts : le parcours
  et la concurrence LOCALE tenaient), puis verts deux fois ; ARG, FIN, RET, RAP, MED rejouees (33/33). Quatre relances simultanees
  → 4 × 200 SENT, MEME transfert, UN `booking.payout_sent`, compteur +1 ; deux re-versements → 200 + 400. ANO-ADM-33 CLOSE
  (bloquante, trouvee a la lecture du code, prouvee en tests unitaires : le Fake ne simule pas la course fournisseur) :
  `markPayoutFailed` ecrivait FAILED sur `{id, status}` seulement → un executeur concurrent recevant le 409 Stripe « cle en
  cours » ecrasait le SENT de l'autre, transfert reel compris ; le rejeu suivant, cle expiree (24 h), aurait verse DEUX
  fois. A164 : ecriture conditionnelle `payoutStatus ∈ {PENDING, FAILED}` + relecture ; apres une tentative,
  `PaymentProvider.findTransfers` (optionnel, Stripe `transfers.list` + Fake) → le transfert vivant du deal est ADOPTE
  (`adoptableTransfer`) ; recherche en panne → rien n'est emis. AMELIORATIONS : refus des gestes de versement en
  francais par code (`payoutRefusalMessage`, recharge sur ecran perime), motif d'echec lisible (`payoutReasonLabel`),
  garde de double clic par ref, message qui nomme montant / Voyageur / transfert, formulaire de renversement qui nomme le
  fournisseur reel (Fake en local) + compteur n/20 + consequence de chaque bouton, journal `previousTransferId`.
  Tests : deal 607, harnais 426. Reste : § 5.15 a 8.
- 13/09 : **DECISION : LE ROLE PREND LA MAJUSCULE** (branche `chore/recette-voyageur-majuscule`, empilee sur #299) —
  « Voyageur » / « Traveler » partout : 71 valeurs de messages, 33 textes du code, 1 email ; regle `role-majuscule` au
  lexique partage (CI + recette) ; 12 citations du harnais ; web-fav, web-rch, web-rsv-devis, web-lit verts.
- 13/09 : **CHAPITRE 7 DU CAHIER 01-WEB — WEB-NRG, NON-REGRESSION (branche `chore/recette-web-7`, empilee sur #297)**
  — 12 fiches CONFORMES (3 apres correction), 11 scenarios NON sequentiels (`apps/e2e/src/chapitres/web-nrg.spec.ts`,
  NRG-6 et 12 partagent un releve console + textes). 3 ANOMALIES CLOSES. ANO-WEB-104 (MAJEURE) : « Voir mes
  virements sur Stripe » testait `carrierPage.stripeAccountId`, que `/auth/me` ne sert JAMAIS (liste blanche) → TOUS
  les Voyageurs voyaient « Finalise d'abord ton compte Stripe », serveur jamais appele, porte sudo jamais atteinte ;
  le bouton appelle maintenant toujours le serveur (SUDO_REQUIRED puis STRIPE_ACCOUNT_MISSING traduits). ANO-WEB-103
  (mineure) : Finances s'ouvrait sur « Paiements » chez un Voyageur (`useState(isCarrier ? …)` fige au montage, avant
  le chargement du membre) → onglet derive. ANO-WEB-105 (mineure) : bouton mobile « Partager » sans nom complet →
  aria-label « Partager un trajet ». NRG-10 MESURE : 6,2 appels d'API par page ; projete sur les plafonds de
  PRODUCTION (le poste les releve a 5000/2000) : membre actif ≈ 56 % de 1000, visiteur ≈ 16 pages / 15 min —
  mesure pessimiste (`page.goto` recharge + StrictMode double `GET /api/maintenance`) → a remesurer sur build de
  production. NRG-7 : cinq portes sudo verifiees SANS demander de code ; la suppression sur un COMPTE NEUF JETABLE
  (destructif si une fenetre sudo etait ouverte). HARNAIS : `pages/ecran.ts` (gardes d'ecran extraites de web-mob +
  `ecouterLaConsole`), `JeuEssai.tousLesTrajets()`, `MesTrajets.actionDuMenu()`, « Proposer un autre ». Pieges
  repayes : `\b` et « é », « 230,00 € » contient « 0,00 € », `count()` avant hydratation. A TRANCHER : plafond
  visiteurs ; origine refusee en 500 au lieu de 403 ; `BecomeYamber` lit aussi `stripeAccountId`. web-mob 10/10,
  web-msg 21/21 rejoues. Plateforme inchangee (1000 + auth 230), harnais : 332 scenarios. PR #298 (empilee sur #297). **Le cahier 01-WEB est entierement joue** (§ 5, § 6, § 7). Reste : cahier 02-ADMIN. AUCUNE attribution
  Claude.
  AMELIORATIONS AU GO (branche `chore/recette-web-7-ameliorations`) : gateway 403 ORIGIN_NOT_ALLOWED avant
  cors() (refus FRANC : un POST etranger n'atteint pas les services), BecomeYamber (libelle Stripe + `isFr = true` fige),
  `stripeAccountId` retire du type useUser, « Chercher un autre trajet » sur un trajet ferme, « Voir ses deals » dans le
  refus d'annulation ; tests : NRG-1 compare a l'API, NRG-2 mobile, NRG-3 desktop+mobile, NRG-7 purge son compte
  jetable, NRG-10 par liens (0,8 appel par page, membre ≈ 7 % du plafond), NRG-11 exige 403, MOB-5 allegee.
- 13/09 : **CHAPITRE 5.32 DU CAHIER 01-WEB — WEB-VOC, VOCABULAIRE ET COHERENCE DE LANGUE (branche
  `chore/recette-web-5-32`, empilee sur #296) — DERNIER CHAPITRE DU § 5 DU CAHIER 01-WEB** — 6 fiches CONFORMES
  (4 apres correction), 7 scenarios, 16 min (`apps/e2e/src/chapitres/web-voc.spec.ts`). METHODE : un RELEVE commun
  (WEB-VOC-0) de 31 ecrans x FR/EN (visiteur, Aminata, Thomas) = 62 textes visibles + libelles d'accessibilite, ecrit
  sur disque (les fiches ne sont PAS en serie) ; emails Mailpit dont deux provoques en anglais. 5 ANOMALIES CLOSES.
  ANO-WEB-98 (MAJEURE) : vocabulaire des roles — l'assistant disait encore « Devenir transporteur » / « Creez votre
  espace transporteur » (point connu du cahier), toast « profil transporteur », « carrier » dans 23 messages EN et 22
  phrases d'emails EN de notification, « Shipper » en dur sur l'accueil FR et « Voyageur » en dur sur l'accueil EN,
  badge d'avatar et alt de l'image d'accueil en francais sur les ecrans anglais, « tripper » dans l'assistant.
  ANO-WEB-99 (MAJEURE) : « ton assurance » / « your insurance » sur l'ecran de remise. ANO-WEB-100 (mineure) : SIX
  libelles du bagage en soute → « Bagage en soute 23 kg » / « Checked bag 23 kg » (idem cabine). ANO-WEB-101
  (mineure) : vouvoiement — 41 messages, ~70 textes en dur (creation de trajet, assistant Voyageur, dashboard, Stripe
  callback, aide — reecrits par un agent sur 12 fichiers) et emails d'alerte de trajet (trip-service). ANO-WEB-102
  (mineure, trouvee en relisant) : « Voir les avis » menait a `/tripper/<id>` (404) → `/u/<slug>`. VOC-5 conforme, mais
  les vitrines `/dashboard/*/preview` (donnees de demo) etaient atteignables en production → `notFound()` hors dev.
  VOC-6 conforme ; la notification `booking_dispute_carrier_responded` redigee « — » est DORMANTE (NONE, D55) —
  redigee quand meme. CI : REGLE 6 dans `scripts/check-i18n-messages.mjs` (lexique par locale sur les VALEURS des
  messages : roles refuses, assurance, vouvoiement hors pluriel, texte vide ou « — » ; garde du garde < 1000 textes)
  — contre-epreuve jouee. NON TOUCHE : messages d'erreur de l'API et OpenAPI (« carrier » = vocabulaire du code).
  Harnais : 22 citations d'anciens textes mises a jour (rch, msg, fil-messagerie, rsv-devis, rem, dea, trj, voy, alr —
  les 2 d'alr invisibles a l'inventaire : texte EJS non litteral). NON-REGRESSION : rch, msg, rsv-devis, rsv, rem,
  dea, trj, voy, cnf, alr, not, mob, a11y, acc verts ; WEB-ACC-8 intermittente sur `POST /auth/refresh` (sonde de
  session du visiteur, echoue aussi SANS les correctifs) → exclue avec sa raison ; axe : pas de refresh pour un
  visiteur sans session.
  FAUX VERTS PAYES : VOC-3 vert sans avoir vu l'objet (aucun envoi soute vivant → la fiche en cree un) ; ecran
  « introuvable » > 200 car. ; squelette stable 1 s. A TRANCHER : minuscule generique « expediteurs/voyageurs » ;
  migrer les textes en dur vers messages/ (seule garantie durable) ; carte de recherche muette sur le forfait soute.
  AMELIORATIONS AU GO (regard d'expert) : lexique en source unique `scripts/lexique-yamba.json` (CI regle 6 + recette) ;
  REGLE 7 du check i18n (chaque BOOKING_EVENT_TYPES a son texte de notification, 2 roles) ; VOC-3 annule sa
  reservation (finally) ; VOC-4 relit les emails FR ; VOC-6 detecte les cles a un seul point ; releve parallele +
  SUPPORTED_LOCALES + 4 ecrans (70 ecrans en 8 min, gain ~40 % seulement : next dev compile page par page) ; garde
  DEA-1 `1 janv.` bornee (aurait echoue chaque janvier). NON FAIT : refresh du visiteur conditionne au marqueur
  localStorage = regression pour de vrais membres → D-next a proposer (indice serveur « a une session »).
  Plateforme inchangee (1000 + auth 230 ; notification 115 et trip 261 rejoues), harnais : 321 scenarios. PR #297 (empilee sur #296). Reste : chapitre 7 WEB-NRG (12 fiches), cahier 02-ADMIN. AUCUNE attribution Claude.
- 13/09 : **CHAPITRE 5.31 DU CAHIER 01-WEB — WEB-A11Y, ACCESSIBILITE CLAVIER DE BASE (branche
  `chore/recette-web-5-31`, empilee sur #295)** — 8 fiches jouees CONFORMES (4 apres correction), 8 scenarios en
  serie, 2 min (`apps/e2e/src/chapitres/web-a11y.spec.ts`, au CLAVIER REEL : Tab / Maj+Tab / Echap / Espace /
  Entree). 4 ANOMALIES CLOSES. ANO-WEB-94 (MAJEURE) : AUCUNE fenetre modale ne gerait le focus (19 `role="dialog"`,
  zero lecture de `document.activeElement`) — ni entree, ni boucle, ni restitution (retour sur `<body>`) ; et 4
  feuilles toujours montees (DealDeclineSheet, PickupRefuseDialog tiroir, MobileSearchExperience,
  MobileFieldFullScreen) restaient atteignables a la tabulation une fois fermees. Correction : crochet partage
  `apps/user-ui/src/hooks/useDialogFocus.ts` (`useDialogFocus(ref, active, onEscape?)` : entree, boucle Tab/Maj+Tab,
  restitution si le focus est perdu, PILE de module pour les fenetres empilees, `onEscape` lu par REFERENCE — une
  fleche en ligne en dependance relancerait l'effet a chaque frappe et rendrait le focus a l'ouvreur en pleine
  saisie) pose sur les 14 fenetres modales, + `inert={!isOpen}` sur les 4 feuilles. ANO-WEB-95 (MAJEURE) : les
  fenetres de SIGNALEMENT (annonce/profil, message) ne se fermaient pas avec Echap. ANO-WEB-96 (mineure) : chaque
  vignette de photo s'annoncait « photo » (en dur, non traduit, identique) → « Agrandir la photo 1 sur 2 », « +N »
  → « Voir N photos de plus ». ANO-WEB-97 (mineure) : compteurs des en-tetes de groupe a 2,36:1 en sombre ET 1,5:1
  en clair (4 listes) → `text-slate-500 dark:text-slate-400`. Constat du 5.30 REGLE : la croix de la porte
  d'identite s'appelle « Fermer » (elle s'appelait « Plus tard » comme le voile et le lien) ; le voile sort de la
  tabulation (`aria-hidden` + `tabIndex=-1`, clic conserve) — web-acc et web-mob mis a jour. La spec initiale
  sous-jouait le cahier (1 fenetre sur 4 en A11Y-3, filtres sautes sur grand ecran via `if (count())`, pas de croix
  ni de visionneuse en A11Y-5, pas de suivi en A11Y-7) : completee. Deux FAUX POSITIFS de l'instrument corriges
  avant de conclure (fond semi-transparent pris pour opaque ; frappes perdues avant hydratation). A TRANCHER :
  selecteur de langue nomme par langue (« Francais ») et non « Changer de langue » (meilleur, a acter) ; croix du
  signalement « Annuler » vs « Fermer » ailleurs ; contraste en THEME CLAIR non couvert par le cahier. Regard
  d'expert : lien « Aller au contenu », focus sur le premier champ en erreur, garde de source « tout aria-modal
  appelle useDialogFocus », jouer 400 %. PIEGES : composer les fonds `…/15` avant un contraste ; viser la fenetre qui
  CONTIENT le focus (feuilles hors ecran « visibles ») ; `activeElement.textContent` = du JS → focus sur `<body>` ;
  la feuille des filtres est `md:hidden`. NON-REGRESSION : sig, ann, mob, rch, msg, fav, not, dea, acc, pic
  rejoues verts ; trois fiches ANCIENNES remises d'aplomb (echouaient aussi SANS les correctifs, prouve par stash) :
  DEA-1 date en dur contre un jeu d'essai relatif, PIC-7 assertion perimee par ANO-WEB-60 (+ PIC-8 lecture avant
  rendu), ACC-5 clic apres goBack intermittent. Plateforme inchangee (1000 + auth 230), harnais : 314 scenarios. i18n :
  `common.lightbox.open/more`, `common.authGate.close`. PR #296 (empilee sur #295). Reste : 5.32, 02-ADMIN.
  AUCUNE attribution Claude.
- 13/09 : **CHAPITRE 5.30 DU CAHIER 01-WEB — WEB-MOB, RESPONSIVE MOBILE (branche `chore/recette-web-5-30`,
  empilee sur #294)** — 10 fiches jouees CONFORMES (1 apres correction), 10 scenarios en serie, 1 min 06
  (`apps/e2e/src/chapitres/web-mob.spec.ts`, emulation iPhone 14 390x844 tactile ; WEB-MOB-7 a 800 px).
  HARNAIS : `navigateurConnecte` et `navigateurVisiteur` acceptent `{ mobile: true }` (ou `{ mobile: { width } }`) —
  ce n'est PAS un simple `viewport` etroit : `isMobile` + `hasTouch` + agent utilisateur changent ce que le produit
  REND (feuilles du bas, barres collantes, `useIsMobile`, doubles arbres Desktop/Mobile) ; sans eux le chapitre
  aurait eprouve l'arbre desktop dans une fenetre etroite. DEUX GARDE-FOUS PARTAGES portent la regle generale du
  cahier (la page ne defile jamais horizontalement) : `aucunDebordement()` NOMME l'element fautif (selecteur, bord
  droit, largeur d'ecran) et `rienNeSortDuCadre()` EXEMPTE ce qui defile dans son propre cadre
  (`overflow-x: auto|scroll`) — une rangee de reponses rapides a le droit de depasser, pas de pousser la page.
  ANO-WEB-93 close (mineure) : le panneau PLEIN ECRAN des filtres de recherche n'etait pas annonce comme une
  fenetre (ni `role="dialog"`, ni `aria-modal`, ni nom) et Echap ne le fermait pas — un lecteur d'ecran continuait de
  parcourir la page EN DESSOUS et le clavier n'avait aucune porte de sortie ; les deux autres feuilles de la
  recherche le faisaient deja (convention non portee jusqu'au bout). Prouve : accueil et menu (le bouton « Fermer le
  menu » est le VOILE plein ecran) ; filtres appliques par « Voir N trajets » et fermes par Echap ; barre de
  reservation collante qui survit au defilement ; assistant (total permanent, « Detail » / « Masquer », aucun champ
  coupe) ; bulles de messagerie qui tiennent dans l'ecran (regression #175 / WEB-NRG-5 morte, et le harnais la
  garde) ; croix de la porte d'identite visible sur telephone (regression WEB-NRG-3) ; colonne de droite du Voyageur
  presente a 800 px (point aveugle des grilles `md:`/`lg:`) ; six cases du code sur une ligne avec
  `inputmode=numeric` et collage qui remplit les six ; listes du tableau de bord sans debordement ; page
  destinataire lisible sans session. A TRANCHER : dans la porte d'identite, TROIS controles portent le meme nom
  accessible (« Plus tard » : croix, voile, lien) ; le piege de focus des feuilles mobiles n'est pas pose (sujet du
  5.31) ; « le clavier ne masque pas le bouton » ne se verifie QUE sur un vrai telephone (consigne, pas simule) ;
  la rangee de reponses rapides ne montre pas qu'elle defile. Regard d'expert : compteur de filtres actifs sur le
  bouton « Filtres », prix POUR LE POIDS saisi dans la barre du bas, `autocomplete="one-time-code"` sur les six
  cases, et surtout une garde automatique « tout conteneur `fixed inset-0` porte `role=dialog` » — meilleur candidat
  d'outillage de la campagne. PIEGES : un `viewport` etroit ne suffit pas ; « Fermer le menu » est le voile (cliquer
  en haut) ; un element peut depasser sans defaut s'il defile dans son cadre ; le titre d'une page de resultats
  s'affiche AVANT les cartes (attendre un prix, pas une ville) ; la croix de la porte s'appelle « Plus tard » ;
  `POST /deals/:id/tracking-link` rend un chemin RELATIF (`new URL(...)` leve « Invalid URL »). Plateforme inchangee
  (1000 + auth 230), harnais : 306 scenarios. PR a ouvrir (empilee sur #294). Reste : 5.31, 5.32, 02-ADMIN.
  AUCUNE attribution Claude.
- 13/09 : **CHAPITRE 5.29 DU CAHIER 01-WEB — WEB-ERR, PAGES D'ERREUR ET PAGE INTROUVABLE (branche
  `chore/recette-web-5-29`, empilee sur #293)** — 5 fiches jouees CONFORMES (1 apres correction), 5 scenarios en
  serie, 2 min 06 (`apps/e2e/src/chapitres/web-err.spec.ts`). COMMENT ON DECLENCHE UN INCIDENT : le cahier prevoit
  « demander a un developpeur un moyen sur de declencher l'erreur » — deux routes de recette le font,
  `/[locale]/dev/erreur` (hors tunnel) et `/[locale]/bookings/dev-erreur` (dedans, car la frontiere n'ajoute la
  phrase sur le paiement que sous `/book` ou `/bookings`), toutes deux INTROUVABLES EN PRODUCTION (`notFound()` des
  que `NODE_ENV === "production"`) ; `?type=chunk` porte la signature d'un morceau de code manquant (version publiee
  pendant la navigation). QUATRE METHODES ESSAYEES ET ECARTEES, et c'est un resultat : couper la passerelle ne fait
  PAS tomber la frontiere (les ecrans chargent cote navigateur et affichent leurs propres etats d'erreur), pas plus
  qu'une charge d'API malformee, qu'une charge RSC en 500, ou qu'un chunk coupe sur une page qui n'en charge pas —
  L'APPLICATION EST GARDEE PARTOUT OU ON L'A POUSSEE. ANO-WEB-92 close (mineure) : la copie de la reference
  d'incident echouait EN SILENCE (`navigator.clipboard` n'existe pas hors contexte securise, le `catch` ne faisait
  rien) — le bouton restait muet au moment precis ou le membre veut transmettre la panne au support ; meme regle
  qu'ANO-WEB-59 : un echec se dit (`errors.boundary.copyFailed`, FR + EN, miroir i18n vert). Prouve : page
  introuvable (404, titre, texte exact, trois actions, aucune trace, plus jamais le 404 interne de Next — acquis
  d'ANO-WEB-88) ; « Trajet introuvable » et « Profil introuvable » avec leurs phrases exactes et aucun indice sur
  l'existence reelle ; page d'erreur generale avec sa reference (le `digest` de Next suffit, meme sans Sentry),
  copiable — CONTENU DU PRESSE-PAPIERS VERIFIE — son aide et le lien support ; la reassurance paiement EN TETE dans
  le tunnel et absente ailleurs ; la variante « nouvelle version » qui remplace le message ET le bouton
  (« Recharger la page », « Reessayer » disparait) ; et cinq situations d'erreur (trajet inexistant, service muet,
  session expiree, formulaire refuse, refus metier CODE) sans un seul chemin de fichier, trace, identifiant brut
  (QUOTE_DIVERGENCE, SUDO_REQUIRED, P2002, PrismaClient) ni anglais non traduit. A TRANCHER : « Ecrire au support »
  vit DANS le bloc de reference (sans reference, l'action disparait — trou fonctionnel) ; le cahier attend un toast
  « Reference copiee » alors que le produit change le libelle du bouton (amender le cahier) ; la longueur de la
  reference varie selon son origine (Sentry 8 caracteres / `digest` variable) ; les deux routes de panne restent
  livrees (inertes en production) — a retirer le jour ou une preproduction permet de couper une dependance pour de
  vrai. Regard d'expert : sortir le lien support du bloc, joindre le chemin de la page au courriel pre-rempli,
  recharger automatiquement apres trois secondes sur « nouvelle version », rendre la garde « aucun code technique »
  automatique. PIEGES : **`innerText` sur un `body` CLONE (detache) retombe sur `textContent`** et rend le contenu
  des `<script>` — charge RSC comprise, ce qui ressemble a une fuite technique ; le `body` VIVANT ne rend que ce qui
  est affiche et exclut la fenetre d'erreur de Next (`nextjs-portal` a racine fantome) ; `domcontentloaded` rend la
  main AVANT le rendu (lire le corps aussitot donne une chaine vide) ; le presse-papiers doit etre interpose en
  memoire de page sur l'adresse LAN. Plateforme inchangee (1000 + auth 230), harnais : 296 scenarios. PR a ouvrir
  (empilee sur #293). Reste : 5.30 a 5.32, 02-ADMIN. AUCUNE attribution Claude.
- 13/09 : **CHAPITRE 5.28 DU CAHIER 01-WEB — WEB-MNT, LE MODE MAINTENANCE VU DU MEMBRE (branche
  `chore/recette-web-5-28`, empilee sur #292)** — 4 fiches jouees CONFORMES (1 apres correction), 4 scenarios en
  serie, 1 min 42 (`apps/e2e/src/chapitres/web-mnt.spec.ts` ; l'annonce est posee PAR L'ECRAN du back-office
  « Etat des services » avec le profil OPS, les bascules suivantes par l'API d'administration). TROIS HORLOGES a
  connaitre : la passerelle relit le document `maintenance` toutes les 10 s, le front membre sonde
  `GET /api/maintenance` toutes les 60 s, l'editeur du back-office se remonte toutes les 30 s. FILET : le
  `beforeAll` et l'`afterAll` remettent le document a plat DIRECTEMENT EN BASE — une maintenance oubliee
  condamnerait tous les chapitres suivants. ANO-WEB-91 close (mineure) : la passerelle refusait bien les ecritures
  (503 `MAINTENANCE` + `Retry-After`, D64 2A) mais LE MEMBRE NE L'APPRENAIT PAS — chaque ecran affichait son erreur
  generique (mesure dans un fil : « Le message n'a pas pu etre envoye. ») et la phrase prevue,
  `maintenance.writeRefused`, n'etait rendue NULLE PART (cle morte dans les deux dictionnaires depuis D64) ; cause
  racine : la passerelle pose son code A LA RACINE de la reponse alors que toute la plateforme lit `details.code`
  (A146). Corrige comme la session expiree (A89) : `api-client` emet `yamba:maintenance-refused` (code a la racine
  OU dans `details`), le bandeau de maintenance l'ecoute, DIT la raison et relit son etat sans attendre son sondage
  — effet secondaire heureux, le bandeau rouge arrive dans la seconde au lieu d'une minute. Prouve : bandeau AMBRE
  date sur une annonce (et rien n'est bloque, un message part) ; bandeau ROUGE au texte exact ; toutes les LECTURES
  passent (recherche avec resultats, page d'un trajet, fil, « Mes envois ») ; reserver / ecrire / publier repondent
  503 et le refus est DIT ; connexion et rafraichissement intacts (routes d'authentification exemptees) ; levee
  appliquee par la passerelle en MOINS DE 15 s avec reprise immediate des ecritures ; et « Payer » sous maintenance
  a l'etape 4 d'une reservation ne cree RIEN (aucune autorisation, aucun deal), puis aboutit normalement apres la
  levee. A TRANCHER : aligner le code de refus de la passerelle sur `details.code` ; le retard de 60 s du bandeau
  pour un membre deja sur sa page (desormais rattrape par le premier refus) ; le message personnalise de l'admin qui
  ne suit pas jusqu'au refus d'ecriture ; une annonce sans date de FIN. Regard d'expert : deux occurrences font un
  patron (signal global + surface qui l'ecoute) a documenter ; exposer l'instant du dernier rafraichissement dans
  `GET /api/maintenance` ; afficher au back-office le nombre de reservations en cours d'autorisation avant de
  basculer. PIEGES : **une fixture de navigateur vit le temps d'UNE fiche** (le navigateur d'administration ouvert
  dans un `beforeAll` donne « browser has been closed » a la fiche suivante) ; **un formulaire qui se remonte
  periodiquement se remplit puis s'oublie** (l'annonce partait SANS DATE et le PUT repondait 200 — verifier
  `inputValue` avant de cliquer) ; `input[type="text"]` ne matche pas un `<input>` sans attribut `type` ; attendre
  que la passerelle ait bascule avant d'observer l'ecran du membre ; le fil de `bzv-accepted` appartient a PAULINE ;
  les resultats de recherche arrivent apres le titre. Plateforme inchangee (1000 + auth 230), harnais : 291
  scenarios. PR a ouvrir (empilee sur #292). Reste : 5.29 a 5.32, 02-ADMIN. AUCUNE attribution Claude.
- 12/09 : **CHAPITRE 5.27 DU CAHIER 01-WEB — WEB-ANA, LE CONSENTEMENT A LA MESURE D'AUDIENCE (branche
  `chore/recette-web-5-27`, empilee sur #291)** — 6 fiches jouees CONFORMES (2 apres correction) + 1
  CONTRE-EPREUVE, 7 scenarios en DEUX passes, 1 min 36 + 19 s (`apps/e2e/src/chapitres/web-ana.spec.ts`).
  LE CAHIER DECLARE CE CHAPITRE ⏭ SANS CLE POSTHOG : on ne s'en est pas contente. Cle de recette
  (`phc_recette_web_5_27`) + hote local `127.0.0.1:9977` dans `apps/user-ui/.env.local`, et un FAUX POSTHOG ecrit
  pour l'occasion — `scripts/recette/collecteur-audience.ts` — qui repond comme le vrai (404 sur `config.js` pour
  que le SDK retombe sur la variante JSON, configuration ou tout ce qui capture de lui-meme est coupe, drapeaux
  vides, extensions INERTES mais bien formees) et journalise chaque evenement recu, une ligne de JSON par
  evenement, en decodant les trois formes de corps (JSON nu, `data=` base64, gzip). Rien ne sort du poste, et la
  fiche 3 lit EXACTEMENT ce que le navigateur aurait envoye. Les fiches 1 a 5 se sautent sans cle, la fiche 6
  (« sans cle ») se saute avec : deux passes, chacune honnete sur sa precondition. ETAT LAISSE AU POSTE : les deux
  lignes sont COMMENTEES dans `.env.local` (aucune banniere pour les chapitres suivants ni pour les parcours) — les
  decommenter + redemarrer le front pour rejouer 1 a 5. DEUX ANOMALIES CLOSES : ANO-WEB-89 (la banniere de
  consentement est `fixed` et ne RESERVAIT AUCUNE PLACE : sur les pages calees sur la hauteur de la fenetre — onze
  ecrans d'authentification, vitrine, tableau de bord — elle recouvrait le bas de la carte ; mesure sur /fr/login en
  1280x720 : « Se connecter » et « Inscris-toi » sous le dialogue, clic INTERCEPTE, aucun defilement possible, il
  fallait repondre a la banniere pour se connecter → elle publie desormais sa hauteur dans `--yamba-consent-space`,
  `global.css` en deduit `--yamba-viewport` = calc(100vh - cet espace), et les QUATORZE mises en page en
  `calc(100vh-…)` s'en servent ; le contenu se recentre, la page defile, tout est rendu a la reponse),
  ANO-WEB-90 (`search_performed`, le premier evenement du funnel D66 3A, lisait `params.origin` /
  `params.destination` — deux cles qui N'EXISTENT PAS dans `SearchTripsParams`, ou les criteres s'appellent `from`
  et `to` : la mesure partait TOUJOURS avec `origin: null, destination: null` et aucun corridor cherche n'etait
  observable, alors que c'est le signal du pilotage D59/D74 ; les deux lectures etaient CASTEES, le typage ne
  pouvait rien dire). Prouve : texte de la banniere mot pour mot + trois elements + deux boutons de MEME POIDS
  (hauteur, largeur, police, vrai <button>) ; refus = aucune requete, aucun evenement, aucune cle `ph_…` (le SDK
  n'a jamais demarre), banniere qui ne revient pas ; accord = `$pageview`, `search_performed` (origin « Paris »,
  destination « Brazzaville », resultsCount numerique), `trip_viewed` (tripId), `booking_step_viewed`, `$identify`
  (l'IDENTIFIANT seul) et AUCUNE donnee personnelle (ni prenom/nom/email du membre, ni code de livraison, ni
  prenom/nom/numero du destinataire) ; choix repris dans un second navigateur neuf sans redemander ; retrait dans
  « Mes donnees » enregistre sur le compte et plus rien de mesure ensuite ; sans cle, aucune banniere, aucun envoi,
  aucune erreur de console (hors les deux 401 du sondage de session, ANO-WEB-01). A TRANCHER : la page ou l'on
  ACCEPTE n'est jamais comptee (l'effet des pages vues ne depend que du chemin) → taux d'entree faux ; le retrait ne
  jette pas ce qui est deja en file (un lot part apres le retrait) ; en developpement chaque page vue part en DOUBLE
  (effets rejoues par React en StrictMode) — a verifier sur le build de production avant de lire les chiffres ; et
  surtout **le `$pageview` porte l'URL COMPLETE** : la page publique du destinataire vit sous `/fr/track/<jeton>`,
  donc un destinataire qui accepte la mesure enverrait LE JETON du lien de suivi au collecteur — normaliser le
  chemin (`/fr/track/:jeton`) avant capture, CANDIDAT AU REGISTRE, a trancher avant toute activation en production.
  Regard d'expert : banniere sans piege de focus, liste blanche des proprietes a proteger par un test comme
  `analyticsEventsFor` cote serveur (D66), ecriture du consentement en best-effort a rejouer, jeter la file du SDK
  au retrait + journaliser le retrait dans `ConsentLog`, interdire les `as { … }` sur un type connu (regle de revue).
  PIEGES : un faux collecteur qui repond mal CASSE la fin de `init()` et rend la mesure muette (on prouverait une
  absence fabriquee) ; **posthog-js REFUSE de capturer depuis un navigateur automatise** (`_is_bot()` =
  `!!navigator.webdriver`, en silence — diagnostic obtenu en lisant le `dist` du SDK apres trois impasses), le
  harnais masque CE seul drapeau ; **`storageState` memorise AUSSI le `localStorage`** (un consentement accepte se
  propage aux chapitres suivants → chaque fiche repart « sans choix », l'afterAll oublie la session) ;
  `networkidle` n'arrive jamais quand le SDK tourne (goto en delai d'attente de 120 s → `domcontentloaded`) ; un
  evenement se rate en naviguant trop vite (attendre SON evenement par `expect.poll` sur le journal) ; Atlas a
  lache une fois de plus (seed en echec a 180 s) et la charge du poste montait a 10 avec les dix-sept conteneurs
  Docker etrangers relances par Docker Desktop — le back-office (3001) a ete arrete, il ne sert pas a ce chapitre.
  Plateforme inchangee (1000 + auth 230), harnais : 287 scenarios. PR a ouvrir (empilee sur #291). Reste : 5.28 a
  5.32, 02-ADMIN. AUCUNE attribution Claude.
- 12/09 : **CHAPITRE 5.26 DU CAHIER 01-WEB — WEB-PRF, PREFERENCES, LANGUE ET RELANCES (branche
  `chore/recette-web-5-26`, empilee sur #290)** — 6 fiches jouees CONFORMES (3 apres correction), 6 scenarios en
  serie, 1 min 24 (`apps/e2e/src/chapitres/web-prf.spec.ts` ; Aminata pour la langue, les emails et l'ecran
  « Parametres », Thomas le Voyageur francophone qui accepte, Pauline + bzv-accepted pour la relance des messages
  non lus, une adresse libre pour l'inscription en anglais). TROIS ANOMALIES CLOSES : ANO-WEB-87 MAJEURE (`authApi`,
  le SECOND client axios des flux SANS compte — activation, mot de passe oublie, renvoi — ne posait pas l'en-tete
  `x-locale` : ces emails partaient toujours en francais ET le compte naissait `preferredLocale: "fr"` meme pour une
  inscription en anglais, donc tous ses emails suivants aussi ; meme interception que `apiClient`, D44),
  ANO-WEB-86 (l'ecran « Parametres » etait un reste de MAQUETTE : « Changer » sans gestionnaire sur la langue et le
  theme, et deux bascules a `useState` local — elles bougeaient, rien n'etait enregistre, l'etat repartait a zero au
  rechargement, un membre pouvait croire avoir coupe ses emails ; chaque ligne porte desormais le vrai reglage LA OU
  IL A UN EFFET : langue → le COMPTE (PATCH /auth/me/locale, selecteur de l'en-tete reutilise), theme → le
  NAVIGATEUR (next-themes, trois choix Automatique/Clair/Sombre), « Notifications email » → `messagingReminderEmails`
  (D61, la seule preference email qui existe) avec un libelle qui dit aussi ce qu'elle NE couvre pas (les emails d'un
  Deal en cours sont contractuels), « Notifications push » → ligne en LECTURE, rien n'est branche ; `ToggleRow` est
  desormais CONTROLEE (`checked` + `onChangeAction`, `role="switch"`, `aria-checked`) et `SettingRow` n'affiche son
  bouton que si un gestionnaire existe — une bascule decorative n'est plus exprimable), ANO-WEB-88 (une adresse qui
  ne correspond a AUCUNE route — `/es`, reecrit `/fr/es` par le middleware next-intl — ne declenche jamais
  `notFound()` : Next servait son 404 INTERNE « This page could not be found. », en anglais, sans en-tete ni lien de
  retour, alors que `[locale]/not-found.tsx` existait depuis 5.3 ; route attrape-tout `[locale]/[...rest]`).
  Prouve : langue enregistree sur le compte et tenue apres reconnexion dans un contexte neuf ; email TOUJOURS dans la
  langue du DESTINATAIRE (Thomas « Nouvelle demande de transport Paris → Brazzaville », Aminata « Your request
  Paris → Brazzaville was accepted » — le geste vient pourtant de l'autre partie) ; inscription en /en → « Your Yamba
  activation code » ; relance coupee → AUCUN email et notification in-app presente ; ecran « Parametres » (les quatre
  entrees, bascule servie par le SERVEUR, PATCH dans les deux sens, classe `dark` de <html>, etat conserve apres
  rechargement, aucun controle sur le push) ; /es et /en/es → 404 avec la page introuvable de Yamba dans la langue de
  l'URL. A trancher : le CAHIER decrit l'ancien ecran (§ 5.26 amende), preferences email par FAMILLE d'evenement +
  push = candidats au registre (liste fermee des familles coupables, les emails d'un Deal en cours ne le sont pas),
  le theme ne suit pas le compte. Regard d'expert : la bascule de langue n'ecrit `if (user)` (cliquer trop tot navigue
  sans rien enregistrer), UN SEUL client HTTP au lieu de deux, `List-Unsubscribe` dans l'email de relance, dire la
  portee des reglages a l'ecran, fiche transversale « aucune page decorative / aucune adresse inconnue servie par un
  404 d'outil ». PIEGES : les PREFERENCES survivent au seed (Aminata arrivait avec sa relance deja coupee — le
  chapitre pose son etat de depart dans son beforeAll et le remet dans son afterAll) ; trois `npx tsx` de suite
  depassent 60 s (`spawnSync npx ETIMEDOUT`) → un seul processus ; Atlas a coupe en cours de session (replique sans
  primaire) et `GET /api/status` reste « down » 10 s (son cache) ; le front Next finit par ne plus hydrater apres une
  longue serie (relancer `nx dev user-ui`) ; Docker Desktop relance les 17 conteneurs etrangers a chaque demarrage
  (deux Elasticsearch = 4 Gio, charge 6-7). Plateforme inchangee (1000 + auth 230), harnais : 280 scenarios.
  PR a ouvrir (empilee sur #290). Reste : 5.27 a 5.32, 02-ADMIN. AUCUNE attribution Claude.
- 12/09 : **CHAPITRE 5.25 DU CAHIER 01-WEB — WEB-RGP, DONNEES PERSONNELLES : EXPORT ET EFFACEMENT (branche
  `chore/recette-web-5-25`, empilee sur #289)** — 9 fiches jouees CONFORMES (5 apres correction), 9 scenarios en
  serie, 1 min 24 (`apps/e2e/src/chapitres/web-rgp.spec.ts` ; Aminata et Thomas pour l'ecran, l'export et les
  bloqueurs ; un compte NEUF cree par l'ecran pour l'avertissement, la SUPPRESSION REELLE et « Membre supprime » —
  jamais un compte du seed ; gru-completed et bzv-disputed pour l'effacement du destinataire). CINQ ANOMALIES
  CLOSES : ANO-WEB-81 MAJEURE (la bascule « Mesure d'audience » n'existait qu'avec une cle PostHog cote FRONT et
  lisait le localStorage, alors qu'`analyticsOptIn` est une preference du COMPTE qui gouverne aussi la capture
  serveur D66 — ligne toujours rendue, etat servi par /auth/me, ecriture confirmee), ANO-WEB-82 (le fichier
  d'export se telechargeait sans sa date : CORS cachait `Content-Disposition` — la passerelle l'expose),
  ANO-WEB-83 (la messagerie affichait « Membre » pour un compte efface → `nomDeLaContrepartie` rend « Membre
  supprime », +3 tests message = 47), ANO-WEB-84 (refus « un export par 24 h » en ANGLAIS → dit par son
  details.code), ANO-WEB-85 (« Voir le numero » refuse ne disait rien : le motif ne vivait que dans le `title`) ;
  JEU D'ESSAI : le journal des demandes RGPD survivait au seed (un export bloquait le suivant 24 h) → purge.
  Prouve : ecran complet et bascules servies par le compte ; export derriere la porte (403 SUDO_REQUIRED, code,
  fichier date) ; contenu (20 sections, role + SES montants, aucun code de livraison, aucun signalement subi,
  avis reveles seulement, export VOYAGEUR sans aucune cle recipient) ; 24 h (400 EXPORT_RATE_LIMITED avant la
  porte, aucun fichier, aucun code) ; bloqueurs (liste fermee, motifs servis seulement, aucun code) ; texte
  d'avertissement mot pour mot ; suppression reelle (403 puis 200, deconnexion immediate, reconnexion 401, email
  sans lien) ; fil intact avec « Membre supprime » et aucun chiffre de telephone ; destinataire efface a 30 jours
  (— / +00000000000 / null, lien de suivi invalide) et deal en litige intact. A trancher : « SUPPRIMER » accepte
  en minuscules (le champ majuscule a la frappe), quota OTP muet a l'ecran, TOO_EARLY sur un deal annule, ordre
  des cles de l'export. Regard d'expert : date du consentement, export asynchrone pour un gros compte, borner les
  notifications, `nextAt` a l'ecran, compte par motif de blocage, libelle « Membre supprime » partout, revoquer le
  lien de suivi a l'effacement. PIEGES : quota OTP (6/h) qui grille au troisieme rejeu, sans message (script
  `otp-debloquer.ts`) ; fenetre sudo liee au jti (parEcran) ; Playwright efface le telechargement a la fin de SA
  fiche ; `nx serve` a lache message-service (relance en bundle). Harnais : 274 scenarios. PR **#290** (empilee sur #289). Reste : 5.26 a 5.32,
  02-ADMIN. AUCUNE attribution Claude.
- 12/09 : **CHAPITRE 5.24 DU CAHIER 01-WEB — WEB-SIG, SIGNALER UN TRAJET, UN PROFIL, UN MESSAGE (branche
  `chore/recette-web-5-24`, empilee sur #288)** — 8 fiches jouees CONFORMES (2 apres correction), 8 scenarios en
  serie, 2 min 54 (`apps/e2e/src/chapitres/web-sig.spec.ts` ; bzv-upcoming et bzv-perkg de Thomas, profil
  seed-thomas, fih masque par l'API admin et seed-josephine rendu prive par manoeuvre — remis en l'etat en finally ;
  file admin lue par GET /admin/reports). DEUX ANOMALIES CLOSES : ANO-WEB-79 MAJEURE (une annonce masquee par
  Yamba se signalait — 201 — et revelait son existence : report.service exige hiddenByAdminAt null/absent, +1 test
  auth = 230), ANO-WEB-80 (404 traduit « Reessaie » → « Cet element est introuvable… ») ; JEU D'ESSAI : les
  Report survivaient au seed (409 au premier clic sur un profil) → purges avec les bookings et les avis. Prouve :
  porte d'identite du visiteur avec connexion dans la fenetre ; fenetre d'annonce (titre, intro, quatre motifs sans
  « Usurpation », precisions, accuse, email dans la langue de l'auteur, annonce toujours en ligne) ; doublon 409 ;
  soi-meme (aucun bouton, 400 OWN_TARGET) ; profil (cinq motifs, membre signale jamais prevenu) ; cible invisible
  (annonce masquee 404, profil masque 404) ; trois signalements = trois accuses, rien cote proprietaire, file
  admin « 3 ouverts, prioritaire », annonce toujours publique ; avis = mailto au support avec l'id. A trancher :
  400 pour un refus de droit, annonce en pause/annulee signalable, doublon apres traitement. Regard d'expert :
  reprendre le geste apres connexion, compteur des precisions, 403 pour OWN_TARGET, regle de visibilite unique
  partagee, seuil au catalogue, corps du mailto pre-rempli. PIEGES : Report survivants au seed, cron FAKE qui ecrit
  au proprietaire (prouver par cloches nouvelles / sujet), GET /trips/:id reserve au proprietaire, masquage par
  l'API admin + profil prive par manoeuvre en finally, session request qui expire. Harnais : 265 scenarios.
  Reste : 5.25 a 5.32, 02-ADMIN. AUCUNE attribution Claude.
- 12/09 : **CHAPITRE 5.23 DU CAHIER 01-WEB — WEB-DES, LA PAGE DESTINATAIRE (branche `chore/recette-web-5-23`,
  empilee sur #287)** — 9 fiches jouees CONFORMES, AUCUNE ANOMALIE, 9 scenarios en serie, 2 min 24
  (`apps/e2e/src/chapitres/web-des.spec.ts` ; bzv-picked Aminata ↔ Thomas, destinataire Clarisse +242061234567,
  code 742891 ; bzv-pending pour « pas de lien avant l'acceptation » ; page publique lue sans session,
  presse-papiers et window.open observes, `sms:` jamais clique — numero prouve par `recipientPhoneE164` de la
  reponse partagee par les deux canaux ; effacement du destinataire par `destinataire-eligible.ts` +
  `destinataire.ts`). Prouve : lien cree une fois (un seul POST pour deux clics, meme jeton apres
  rechargement), message et « Copie ! » ; WhatsApp wa.me/242061234567 avec le message ; page publique complete
  (titre, sous-titre avec initiale, dates, frise de cinq jalons, confidentialite + lien, acquisition) ; rien de
  revele (ecran, code source — valeurs du deal, jamais « € » qui vit dans le catalogue —, `noindex`, 8 cles
  fermees de GET /track/:token) ; progression en deux navigateurs (aeroport prive, decollage, atterrissage, remise) ;
  aucune carte cote Voyageur (403) ni avant l'acceptation (409) ; lien invalide = jeton altere OU destinataire
  efface → meme message, meme 404 ; vrai numero cote Voyageur (bouton nomme par le numero). A trancher : « Colis
  pris en charge » = acceptation sur la page publique, bouton d'appel nomme par le numero, SMS par assignation de
  location plutot qu'un lien. Regard d'expert : revocation du lien par l'Expeditrice, SMS en href, fermer
  ANO-WEB-53 (arrivalAt), test de contrat sur la liste fermee, polling doux de la page, mention « le lien
  apparaitra a l'acceptation », revoquer le lien a l'effacement, « Appeler {numero} ». PIEGES : source next-intl =
  tout le catalogue, `sms:` non observable, bouton nomme par le numero, page sans session, effacement en deux
  temps. Harnais : 257 scenarios. Reste : 5.24 a 5.32, 02-ADMIN. AUCUNE attribution Claude.
- 12/09 : **CHAPITRE 5.22 DU CAHIER 01-WEB — WEB-NOT, LA NOTATION CROISEE (branche `chore/recette-web-5-22`,
  empilee sur #286)** — 11 fiches jouees CONFORMES (3 apres correction), 11 scenarios en serie, 3 min 18
  (`apps/e2e/src/chapitres/web-not.spec.ts` ; bzv-completed Mai ↔ Thomas pour le double-aveugle et la page
  publique en fenetre privee, gru-completed Joao ↔ Ines pour la note seule, l'intermediaire, les relances et la
  revelation a 14 j ; cron `rating` force par `notation-eligible.ts r1|r2|reveal` + `notation.ts`). TROIS
  ANOMALIES CLOSES : ANO-WEB-76 MAJEURE (l'accueil reel HomeLive ne derivait que les actions Voyageur — un
  Expediteur n'avait jamais « A traiter » : noter, code, verification ; envois reels lus et fusionnes),
  ANO-WEB-77 (deal en litige sur /rate → « La fenetre de 14 jours est passee » : RatingDone distingue
  « indisponible » de « fermee »), ANO-WEB-78 (note d'un avis public = cinq icones sans nom → role=img
  aria-label « 5/5 ») ; JEU D'ESSAI : les avis survivaient au seed (25 orphelins reveles sur les profils du
  seed) → purge des Review des comptes du seed avec les bookings. Prouve : « Noter » a l'accueil / Mes envois /
  le deal sans fenetre bloquante ; ecran sans moyenne ni volume ; criteres par role note ; note seule requise ;
  limite 280 ; double-aveugle (rien de public avant la reciprocite, revelation au second, « Vos avis », cloche
  sans email) ; intermediaire ; une seule fois (deja note, litige, etranger 403 traduit) ; relances J+5 / J+7 au
  seul role muet puis silence ; revelation a 14 j sans reciprocite ; avis public (auteur, note, pouces, faits,
  « Signaler cet avis » mailto avec l'id). A trancher : en-tete bureau sans « Donne ton avis » ni bandeau, cote
  muet apres revelation (« Vos avis » plutot que « fenetre fermee »), etranger → « indisponible ». Regard
  d'expert : une seule derivation d'actions pour les deux accueils, un en-tete partage, accord du feminin,
  « Plus tard (jusqu'au …) », seuil d'alerte nomme, note recue dans la cloche, `cannotRateReason` en cle,
  J+5/J+7 au catalogue, test « aucune note → aucune revelation », test du seed « zero avis orphelin ». PIEGES :
  avis survivants au seed, page publique sans session, etoiles = aria-label, HomeLive ≠ HomePreview, cron en
  deux temps, 403 → « indisponible ». Harnais : 248 scenarios. PR **#287** (empilee sur #286). Reste : 5.23 a 5.32, 02-ADMIN. AUCUNE
  attribution Claude.
- 12/09 : **CHAPITRE 5.21 DU CAHIER 01-WEB — WEB-LIT, LITIGE ET MEDIATION, VUE MEMBRE (branche
  `chore/recette-web-5-21`, empilee sur #285)** — 13 fiches jouees CONFORMES (3 apres correction), 14 scenarios en
  serie dont 1 `test.fail`, 4 min 42 (`apps/e2e/src/chapitres/web-lit.spec.ts` ; sgn-picked / los-picked pour le
  transit, bzv-delivered signale puis REMBOURSEMENT TOTAL, bzv-disputed YAM-2041 version puis PARTIEL 10 €,
  los-disputed YAM-2042 REJET, yul-delivered deux onglets, bzv-completed acces sans droit ; trois decisions par
  la mediatrice dans le back-office (3001), versions manquantes donnees par l'API). QUATRE ANOMALIES :
  ANO-WEB-75 MAJEURE close (quatre evenements avec texte mais sans presentation → « Notification » sans titre :
  Decision rendue, Code renouvele, Remboursement emis, Paiement autorise — table PRESENTATION completee),
  ANO-WEB-73 close (remboursement total = CANCELLED : « Demande annulee · Cette demande est close » titrait la
  decision → « Clos par la mediation »), ANO-WEB-72 close (note « TON PAIEMENT » d'un deal clos par la mediation
  disait « periode de verification terminee » → `noteReleasedMediation` sur completedBy ADMIN) ; OUVERTE :
  ANO-WEB-74 MAJEURE (GET /me/notifications sert refundCents ET carrierPayoutCents aux deux parties dans le
  payload brut de dispute_resolved — projection par role a faire, registre, PR dediee ; 10 bis en test.fail).
  Prouve : lien de transit ferme (date servie) puis ouvert ; motif verrouille (un seul radio) ; ecran de
  signalement complet ; refus (bouton inactif, photo en cours / en echec, refus serveur simule) ; envoi (ticket
  serveur, FROZEN, fil ferme, emails — categorie seule au Voyageur) ; ni modifiable ni retirable (409, toast) ;
  dossier des deux cotes sans fuite ; version une seule fois ; trois decisions, chacun SON montant a l'ecran et
  par email, cloche « Decision rendue · YAM-… » ; aucune notation ; deux onglets (409, retour au suivi) ; acces
  sans droit (403 traduit, aucune fuite). A trancher : bouton « Donner ma version », manques « nommes sur leur
  bloc », CANCELLED pour un remboursement total, 200 vs 201, capitales. Regard d'expert : compte a rebours
  d'ouverture, renvoi vers le fil avant de signaler, borne du partiel, test de composant des quatre etats,
  « ajouter une preuve plus tard », cause du refus, echeance des 72 h, projection par role des notifications,
  test copy ↔ PRESENTATION en CI, dire pourquoi pas de note, relire au focus. PIEGES : version par l'API avant
  de trancher, admin-ui requis, « Autre probleme » sous-texte (exact), un seul radio en transit, capitales,
  total dans la vue du bon role, deux emails de decision visees par ticket, 200/201. Harnais : 237 scenarios.
  PR **#286** (empilee sur #285). Reste : 5.22 a 5.32, 02-ADMIN. AUCUNE attribution Claude.
- 12/09 : **CHAPITRE 5.20 DU CAHIER 01-WEB — WEB-ANN, LES ANNULATIONS (branche `chore/recette-web-5-20`,
  empilee sur #284)** — 9 fiches jouees (2 apres correction, 1 avec reserve, 1 NON CONFORME), 9 scenarios en
  serie dont 1 `test.fail`, 3 min 18 (`apps/e2e/src/chapitres/web-ann.spec.ts` ; bzv-pending, bzv-accepted,
  yul-accepted avec yul ramene a +24 h, un deal CREE PAR L'API sur bzv-perkg puis trajet ramene a −24 h,
  bzv-picked / bzv-delivered, gru-pending deux onglets ; les manoeuvres deplacent le trajet ET l'instantane
  `booking.trip.departureAt` que le bareme lit). QUATRE ANOMALIES : ANO-WEB-68 MAJEURE OUVERTE (aucune
  annulation par le Voyageur : service 403 SHIPPER_ONLY alors que la machine declare cancel(CARRIER) avec
  PENALIZE_CARRIER, aucun ecran — D72 renvoie pourtant vers « Mes trajets » pour annuler ses deals ;
  chantier dedie + registre), ANO-WEB-69 mineure OUVERTE (apres le depart, fenetre et Paiements disent
  « reversee au Voyageur » alors que la retenue est conservee a arbitrer : `retentionDisposition` a porter
  par cancellationPreview et la ligne de paiement, contrat, PR dediee), ANO-WEB-70 close (« Voir le Deal
  dans mon dashboard → » = bouton console.info des deux cotes → liens /dashboard/shipments et
  /dashboard/trips), ANO-WEB-71 close (« Remboursement de 28,00 € en cours » sur une demande jamais debitee →
  « Envoi annule. » seul). Prouve : demande en attente (fenetre exacte, montant servi, kilos rendus, email
  Expeditrice, cloche seule cote Voyageur) ; accepte a > 48 h (total, deux emails + un, Paiements) ; < 48 h
  (47,04 € → 23,52 € / 23,52 €, compensation 21,00 € = arrondi(retenue × net ÷ total), cloche + portefeuille
  Marc) ; montant servi dans GET /me/bookings, 0 appel a l'ouverture ; apres le depart (19,32 € rembourse,
  HELD_FOR_MEDIATION, aucun versement, trois ecrans Voyageur « conservee ») ; aucune annulation apres la
  prise en charge (PICKED_UP et DELIVERED, ecran + API 409) ; suivi sans doublon ; deux onglets (409,
  toast, liste relue, un seul remboursement). A trancher : bareme sur l'instantane du depart, objets
  d'email, « lien discret », perimetre d'ANN-02. Regard d'expert : email d'annulation utile, un seul email
  de remboursement, « dont 21,00 € pour Marc », apercu horodate, delai promis sur la retenue, test
  « toute transition a une route et un ecran », allowedActions au Voyageur, composant de retour partage,
  refetch au focus. PIEGES : GET /trips/:id proprietaire seul, instantane du depart, deal par l'API en
  deux appels (QUOTE_DIVERGENCE → actualTotalCents), toast prefixe, route figee des deux onglets.
  Harnais : 223 scenarios. PR **#285** (empilee sur #284). Reste : 5.21 a 5.32, 02-ADMIN. AUCUNE attribution Claude.
- 12/09 : **CHAPITRE 5.19 DU CAHIER 01-WEB — WEB-CNF, CONFIRMATION, COMPLETION ET VERSEMENT (branche
  `chore/recette-web-5-19`, empilee sur #283)** — 11 fiches jouees CONFORMES (4 apres correction, 1 avec
  reserve), 13 scenarios en serie dont 2 `test.fail`, 2 min 54 (`apps/e2e/src/chapitres/web-cnf.spec.ts` ;
  bzv-delivered Joao ↔ Thomas, yul-delivered Aminata ↔ Marc, bzv-completed-blocked, bzv-reversed ; crons
  FORCES par `scripts/recette/payout.ts reminder|due` sur le FAKE apres `livraison-ancienne.ts <id> <jours>`
  qui recule deliveredAt ET payoutDueAt ; `versement-bloque.ts` refige l'echec que le cron FAKE ferait
  partir). SIX ANOMALIES : ANO-WEB-66 MAJEURE close (le bandeau « {montant} en attente : finalise ton compte
  Stripe » n'etait pose que par l'ancien TripsClient, jamais par MyTripsList = la vraie page « Mes
  trajets »), ANO-WEB-64 close (note « Tu as confirme la livraison » sur une completion SYSTEME →
  `noteReleasedAuto` suit `completedBy`), ANO-WEB-65 close (« Tu as jusqu'au . » : RatingStatusCard sans
  echeance → `promptTextNoDate`, seed avec `ratingWindowEndsAt` sur -blocked / -reversed), ANO-WEB-67 close
  (« Rembourse 33,60 € le » sans date → wallet.service replie sur updatedAt, +1 test deal = 577) ;
  OUVERTES : ANO-WEB-62 MAJEURE (l'API sert `payoutStatus` / `payoutSentAt` a l'Expeditrice et
  `ConfirmDealResponse.payoutStatus` — A68 « both roles read it » contre le cahier « aucune fuite » : registre,
  PR dediee), ANO-WEB-63 mineure (apres payoutDueAt la machine retire `dispute` mais laisse `confirmEarly` :
  « Confirmer la livraison » reste propose ≤ 5 min ; garde `beforePayoutDue` proposee, registre). Prouve :
  ecran livre complet, bouton de confirmation SECONDAIRE, compte a rebours jamais rouge ; confirmation
  definitive (signalement disparu, emails et cloche « 55,00 € partis vers ton compte ») ; rappel J+3 une
  seule fois (1 puis 0) ; apres J+4 sans cron : « Signaler » absent, 0h, dispute force 409 ; completion
  SYSTEME (« sans signalement de ta part », Marc « 18,00 € partis ») ; ecrans Expeditrice etanches (suivi +
  Paiements) ; versement bloque (deal, bandeau, ligne, portefeuille — aucune chaine technique) ; renverse
  (sous examen, aucun renvoi) ; portefeuille et paiements = serveur, 7 + 6 etats de ligne, aucune maquette ;
  « TON PAIEMENT » sans fausse carte. A trancher : A68, confirmer apres J+4, deux horloges (compte a rebours
  client), objets d'email, cle morte `booking_payout_sent.SHIPPER`. Regard d'expert : `payoutDueAt` servi,
  retirer payoutStatus de la reponse de confirmation, journaliser le passage du cron, rappel date a l'heure
  exacte, garde symetrique, liste blanche Expediteur, une seule liste de trajets, delai dit sur « sous
  examen », montant retenu affiche, sous-titres des cartes, test « jamais 4242 ». PIEGES : cron FAKE qui
  rejoue / complete, FORCE_COLOR, `tsx --env-file` et l'env du processus, notifications qui survivent au
  seed, U+202F avant €, pas de <main>, TripsClient ≠ MyTripsList, deals replies par trajet. Harnais : 214
  scenarios. PR **#284** (empilee sur #283). Reste : 5.20 a 5.32, 02-ADMIN. AUCUNE attribution Claude.
- 12/09 : **CHAPITRE 5.18 DU CAHIER 01-WEB — WEB-REM, LA REMISE DU COLIS (branche `chore/recette-web-5-18`,
  empilee sur #282)** — 7 fiches jouees CONFORMES (2 apres correction), 7 scenarios en serie, 55 s
  (`apps/e2e/src/chapitres/web-rem.spec.ts`, sgn-picked Mai ↔ Linh, bzv-picked pour l'annulation). DEUX
  ANOMALIES CLOSES, toutes front : ANO-WEB-60 MAJEURE (« Valider la livraison » n'existait qu'APRES les trois
  jalons « Optionnel » — la carte-projecteur offre le chemin direct, `spotlight.deliverEarly` FR/EN),
  ANO-WEB-61 mineure (« n tentatives restantes » / « Derniere tentative » jamais rendu ; erreur persistante a la
  ressaisie ; effet secousse declenche par le TEXTE de l'erreur, identique d'un essai a l'autre → muet au
  deuxieme echec ; DeliverOtpInput rearme par `attemptsUsed`, `erreurMasquee`). Prouve : ecran complet (six
  cases 3·3, encart, aide, « Tentative 1 sur 3 ») ; 000000 / 111111 → 409 DELIVERY_CODE_INVALID, compteur,
  aucune notification cote Mai (`GET /me/notifications` identique) ; troisieme faux → 409 DELIVERY_LOCKED,
  « Reessaye dans 14:5x », verrou apres rechargement, BON code refuse par l'API ; regeneration de Mai (carte
  compacte de la phase voyage) → verrou leve, essais a zero, ancien code refuse ; photos : optionnel, deux au
  plus, envoyees a la selection ; bon code + photo → DELIVERED, succes (« 28 € … le mercredi 16 septembre »),
  aucun « Noter », Mai cloche + email « a ete livre » (« 3 jours », sans le code), Linh cloche sans email ;
  aucune annulation (ligne de « Mes envois », suivi, Voyageur ; API 409 / 403). A trancher : destinataire
  toujours « elle », objet de l'email, photos a la selection vs confirmation, 409/403. Regard d'expert :
  essais rates dans l'historique admin, plafond/verrou au catalogue des reglages, dire que regenerer
  debloque, un composant photos pour les deux ecrans, `payoutDueAt` servi, test unitaire de l'OTP. PIEGES :
  `/me/notifications` (COD-2 corrigee, plus de `if (ok)`), deux formes du suivi Expeditrice, `expect.poll` sur
  le code apres regeneration, date « le mercredi 16 septembre », « Annuler » des autres lignes, input cache
  apres le plafond, statut hors racine. Harnais : 201 scenarios. PR **#283** (empilee sur #282). Reste : 5.19 a 5.32, 02-ADMIN. AUCUNE
  attribution Claude.
- 11/09 : **CHAPITRE 5.17 DU CAHIER 01-WEB — WEB-COD, LE CODE DE LIVRAISON (branche `chore/recette-web-5-17`,
  empilee sur #281)** — 8 fiches jouees CONFORMES (4 apres correction), 8 scenarios en serie, 1 min 48
  (`apps/e2e/src/chapitres/web-cod.spec.ts`). CINQ ANOMALIES CLOSES, toutes front, le serveur juste partout :
  ANO-WEB-56 MAJEURE (WhatsApp et SMS s'ouvraient SANS le numero du destinataire — `wa.me/?text=` — alors que
  `recipient.phoneE164` est servi depuis D69 et que la carte du lien de suivi le prenait deja ; BookingShareCode +
  SenderCodeCard), ANO-WEB-55 mineure (« Code copie ! » au catalogue, jamais rendu ; « Message copie ! » en toast
  aussi), ANO-WEB-57 mineure (compteur de regenerations enferme dans la boite de confirmation : « Aucune
  regeneration restante » inatteignable), ANO-WEB-58 mineure (409 CODE_REGENERATION_LIMIT traduit par la couche
  API puis ignore par les cartes → « Erreur lors de la regeneration » ; cas reel : second onglet en retard),
  ANO-WEB-59 mineure (echec de copie hors HTTPS = message de la regeneration ; cle `copyFailed` FR/EN). Prouve :
  aucun chiffre avant la prise en charge ; code chez Aminata seule, NEUF sources fouillees cote Thomas (pages,
  sources HTML, fil, API) ; presse-papiers = 742891 ; message pre-rempli exact, WhatsApp sur 242061234567 ;
  regeneration (confirmation, toast, 4 restantes, relecture serveur, email « Nouveau code… » sans aucun code,
  Thomas rien) ; plafond 5 (409 par l'API, message du cahier par l'onglet en retard, code inchange) ; aucun
  bouton sur quatre ecrans Voyageur ; apres remise « saisi par Thomas et valide ». A trancher : toasts vs
  libelles, sms:/mailto: non cliques, badge « Code valide » = nom accessible seulement, « Livraison estimee — »
  (ANO-WEB-53). Regard d'expert : liens `<a href>` pour les quatre canaux, plafond au catalogue des reglages +
  DTO, cloche sur la regeneration, espaces next-intl par route, test des `details.code` sans lecteur. PIEGES :
  toasts empiles (`.last()`), 401 rejoue par api-client (filtrer dans waitForResponse), bouton de-grise a la
  main ≠ essai force, source next-intl = catalogue entier, jamais cliquer sms:/mailto:. Harnais : 194
  scenarios. PR **#282** (empilee sur #281). Reste : 5.18 a 5.32, 02-ADMIN. AUCUNE attribution Claude.
- 11/09 : **CHAPITRE 5.16 DU CAHIER 01-WEB — WEB-PIC, PRISE EN CHARGE ET JALONS DE TRANSIT (branche
  `chore/recette-web-5-16`, empilee sur #280)** — 10 fiches jouees CONFORMES (5 apres correction), 8 scenarios
  en serie, 1 min 48 (`apps/e2e/src/chapitres/web-pic.spec.ts`). CINQ ANOMALIES CLOSES : ANO-WEB-51 MAJEURE
  (le bouton « Confirmer » inactif etait muet — les textes « Coche les 5 points… » / « Ajoute au moins 1
  photo… » existaient en JSON, jamais rendus ; indice sous le bouton, desktop + mobile), ANO-WEB-49 mineure
  (elision ecrite dans le message : « qu'Pauline », « d'Pauline » — `apps/user-ui/src/lib/elision.ts`, cinq
  textes reecrits en {queShipper}/{deShipper}), ANO-WEB-50 mineure (« la remise a Brazzaville » : dernier
  `split(" ")[0]` de la maquette sur les vues pickup), ANO-WEB-52 mineure (photo > 10 Mo acceptee a la
  selection, comme ANO-WEB-39), ANO-WEB-54 mineure (cle brute « bookingTracker.trackingLink.subtitle » :
  variable manquante). ANO-WEB-53 mineure OUVERTE (« arrivee prevue a — » : BookingTripSnapshot sans
  arrivalAt — schema + contrat, PR dediee). Prouve : declaration a comparer, 5 points, photo obligatoire,
  echec reseau = rien d'enregistre (aucun POST /pickup, statut relu), confirmation (code chez Pauline seule,
  email sans le code, numero du destinataire cote Voyageur), refus (5 raisons, remboursement integral =
  totalShipperCents, kilos +7, profil public de Marc identique), transit (une seule carte d'action, jalons
  ordonnes / non repetables, 5 s de repentir sans requete, bannieres + cloche + UN email a l'atterrissage).
  A trancher : « paye 3 jours apres » vs « J+4 » (deux formules), sous-titre mobile vs desktop, bouton
  d'appel = le numero, photos envoyees a la confirmation, le cahier elide lui-meme. Regard d'expert : script
  « cles JSON absentes du code », `onError` next-intl en echec dur en dev, test de rendu des vues Voyageur.
  Harnais : 186 scenarios. PR **#281** (empilee sur #280). Reste : 5.17 a 5.32, 02-ADMIN. AUCUNE attribution Claude.
- 11/09 : **CHAPITRE 5.15 DU CAHIER 01-WEB — WEB-MSG, MESSAGERIE, RENDEZ-VOUS ET NUMERO (branche
  `chore/recette-web-5-15`, empilee sur #279)** — 22 fiches jouees CONFORMES (4 apres correction), 21 scenarios
  en serie, 3 min 24 (`apps/e2e/src/chapitres/web-msg.spec.ts`, deux navigateurs Pauline / Thomas sur
  bzv-accepted). QUATRE ANOMALIES CLOSES : **ANO-WEB-46 BLOQUANTE** (« Le code : 742 891 » PASSAIT — la garde
  ne lisait que six chiffres colles ; separateurs retires avant lecture, message-guard.rules + test),
  **ANO-WEB-47 MAJEURE** (apres un rendez-vous confirme, une nouvelle proposition etait invisible donc jamais
  acceptable — `nextMeetupOf` fait primer une proposition plus recente que l'acceptation, accepter remplace
  le confirme du meme type ; candidat registre D61 1A), ANO-WEB-45 mineure (le `message` ANGLAIS de l'API
  affiche sous la saisie et dans le panneau — `details.code` traduit, cles messaging.errors.* FR/EN),
  ANO-WEB-48 mineure (fil refuse a un tiers = « Chargement… » sans fin — `isError`). Prouve : bulle a
  droite + fil groupe par jour + arrivee sans rechargement + notification ; 9 reponses rapides qui remplissent
  sans envoyer, langue du COMPTE (D44, bascule par le selecteur) ; coordonnees reperees (flaggedContact vu par
  le SUPPORT) ; rendez-vous (bornes 30 min / 90 j / 12 h en francais, une seule proposition, confirme) ;
  numero : 400 TOO_EARLY puis 200 a moins de 2 h, une ligne systeme unique ; « Appeler » ouvre le fil ; sept
  boutons -> le meme fil ; signalement (4 motifs, 409 la seconde fois, l'auteur pas prevenu) ; litige et 14 j
  en lecture seule ; relance (un email sans le texte, pas deux par heure). A trancher : la bulle compte les
  MESSAGES (cahier : conversations) ; pas de bouton message sur une demande en attente ; role absent de la
  liste ; sans rendez-vous l'ancre du numero est le depart. Plateforme de tests **996** (message 44). Harnais :
  178 scenarios. Poste : passerelle relancee en bundle (429 apres treize passages). PR **#280** (empilee sur #279). Reste : 5.16 a 5.32,
  02-ADMIN. AUCUNE attribution Claude.
- 11/09 : **CHAPITRE 5.14 DU CAHIER 01-WEB — WEB-DEA, LA DEMANDE COTE VOYAGEUR (branche
  `chore/recette-web-5-14`, empilee sur #278)** — 9 fiches jouees CONFORMES (3 apres correction), 9 scenarios
  en serie, 2 min 20 (`apps/e2e/src/chapitres/web-dea.spec.ts`). Demandes creees par l'assistant (32,20 /
  28,75, photos interceptees) ; accueil / Mes trajets / cloche ; ecran de la demande bloc par bloc (net seul,
  jamais 32,20 ni « commission », ni a l'ecran ni dans le DTO ; puce ambre puis ROUGE + role=alert sous 2 h
  par manoeuvre) ; Charte obligatoire ; acceptation (capture « Bloque chez Yamba », notification, email, fil
  ouvert des deux cotes) ; refus (5 raisons fermees, aucun texte libre, kilos rendus, profil public identique,
  email avec la raison reformulee) ; expiration (409 TRANSITION_NOT_ALLOWED avant le cron, passe forcee
  scripts/recette/expire.ts -> bandeau + email) ; deux onglets (409, toast, relecture, un seul debit) ; etats
  fermes ; « Mon Deal accepte » (code secret, aucun code nulle part). TROIS ANOMALIES CLOSES : ANO-WEB-41
  MAJEURE (« jeu. 1 janv. » partout : TripListItem ignorait departureAt — `trip-local-dates.ts` pur,
  applique dans useMyTrips/useTrip), ANO-WEB-42 mineure (lieu ecrit deux fois, mention du telephone jamais
  affichee ; ville repetee sur le recap accepte), ANO-WEB-44 MAJEURE (destinataire nomme « Hall » = premier
  mot du lieu ; `recipientFirstName` servi a toute etape). ANO-WEB-43 mineure OUVERTE (« {n} envois »,
  « Membre depuis » absents : DTO toCounterpart a enrichir, PR dediee). A trancher : accueil en lignes vs carte
  « {n} demandes en attente » (copie morte), trois textes du cahier non rendus (stateLabel, COUVERTURE DU COLIS,
  note du gain), raison reformulee dans l'email. Regard d'expert : `grep "TODO Phase"` (survivants de
  maquette), `isExpired` dans le DTO Expediteur, ordre capture/transaction a relire. Harnais : 157 scenarios.
  Poste : la cible `nx typecheck` des deux fronts Next a disparu (CI = tsc -p apps/user-ui, equivalent
  `npx tsc --noEmit -p apps/user-ui/tsconfig.json`). PR **#279** (empilee sur #278). Reste : 5.15 a 5.32, 02-ADMIN. AUCUNE attribution Claude.
- 11/09 : **CHAPITRE 5.13 DU CAHIER 01-WEB — WEB-TRU, LES PLAFONDS DU COMPTE NEUF (branche
  `chore/recette-web-5-13`, empilee sur #277)** — 5 fiches jouees CONFORMES (1 apres correction), 5 scenarios
  en serie, 2 min 00 (`apps/e2e/src/chapitres/web-tru.spec.ts`). Compte neuf cree par l'ecran en fiche 1 ;
  450 € et 12 kg refuses A L'INTENTION (avant tout argent, rien nulle part), 250 € et 8 kg PASSENT, cinq
  demandes puis la sixieme refusee des l'autorisation ; LEVIER DU BACK-OFFICE prouve ([TRU7]) : l'OPS releve
  `trust.newAccount.maxShipmentsPerMonth` 5 -> 6 par PATCH /admin/settings, « Reessayer » toutes les 5 s,
  la sixieme passe 6 s apres l'ecriture (journal SETTING_CHANGED -> Booking.createdAt), remise a 5 dans un
  finally ; Aminata (90 j) reserve 12 kg a 450 € sans refus ; AUCUNE fuite du score sur cinq ecrans, trois
  reponses d'API brutes (/auth/me, /me/bookings, /deals/:id) et l'export. ANO-WEB-40 mineure close (« Payer »
  actif a cote de l'encadre de refus et avant le retour de l'intention : `ctaDisabled = isSubmitting ||
  (step === 4 && !intent)` dans BookingWizard et BookingMobile). A trancher : message de plafond generique
  (cahier) vs cible (catalogue D62 « le membre lit le plafond dans le message »), compteur mensuel qui compte
  aussi les demandes declinees/expirees, levier joue en relevant (pas en abaissant), compte de travail
  `neuf-<horodatage>@`. Regard d'expert : servir les PLAFONDS (pas le score) dans /auth/me pour borner des
  l'etape 1 (decision de registre), test de contrat « le DTO Expediteur ne porte aucune cle de
  TrustAssessment », cache 60 s des signaux par membre. Harnais : 148 scenarios. Reste : 5.14 a 5.32,
  02-ADMIN. PR **#278** (empilee sur #277). AUCUNE attribution Claude.
- 11/09 : **CHAPITRE 5.12 DU CAHIER 01-WEB — WEB-RSV, L'ASSISTANT EN QUATRE ETAPES ET LE DEVIS (branche
  `chore/recette-web-5-12`, empilee sur #276)** — 22 fiches : 21 jouees CONFORMES (7 apres correction), 1 skip
  (carte refusee, fournisseur FAKE), 12 scenarios en 2 min 05 (`apps/e2e/src/chapitres/web-rsv-devis.spec.ts`,
  complete web-rsv.spec.ts et web-rsv-assistant.spec.ts). Devis verifie AU CENTIME (32,20 · 40,25 · 38,64 ·
  11 · 38,20 · 257,60 · 42 apres divergence), kilos −2,5, emails (32,20 Expeditrice / 28,75 Voyageur),
  dernier kilo (CAPACITY_EXCEEDED), propre trajet / parti / masque, reprise apres rechargement. SEPT
  ANOMALIES CORRIGEES, toutes des branchements : ANO-WEB-33 MAJEURE (mot « assurance » dans un message +
  copy mort), ANO-WEB-34 MAJEURE (poids vide : `buildInitialDraft(trip)` existait sans appelant — branchee
  dans BookingWizard et BookingMobile), ANO-WEB-35 mineure (propre trajet refuse a l'ouverture), ANO-WEB-36
  MAJEURE (apres QUOTE_DIVERGENCE le recap gardait l'ancien total — trajet relu via invalidateQueries),
  ANO-WEB-37 MAJEURE (« 0 € » sous l'indice quand le devis est indisponible — indice seul), ANO-WEB-38
  mineure (trajet parti refuse a l'ouverture), ANO-WEB-39 mineure (photo > 10 Mo refusee des la selection).
  A trancher : decimales nulles omises (« 8 € ») et POINT decimal (« 15.5 kg », « 0.5 kg »), protection
  ventilee (3,45 + 6) vs cumulee (9,45), 5 photos vs 6, erreurs a la tentative, indicateur « etape 1 sur 4 »
  mobile seulement. Regard d'expert : partager le calcul du devis client/serveur, servir `bookable` dans le
  DTO public, test de composant du wizard (aurait pris 3 anomalies sur 7). Harnais : 143 scenarios. PR
  **#277** (empilee sur #276). Reste : 5.13 a 5.32, 02-ADMIN. AUCUNE attribution Claude.
- 11/09 : **CHAPITRE 5.11 DU CAHIER 01-WEB — WEB-FAV, FAVORIS ET VOYAGEURS SUIVIS (branche
  `chore/recette-web-5-11`, empilee sur #275)** — 12 fiches, 12 jouees CONFORMES (3 apres correction), 12
  scenarios en serie, 1 min 50 (`apps/e2e/src/chapitres/web-fav.spec.ts`). Porte d'identite du coeur avec
  geste repris apres connexion DANS la fenetre (prouve par l'API), ajout/retrait optimistes, propre trajet
  refuse, trajet annule/masque, favori d'un trajet passe, suivi (Suivre → Suivi, abonnes, bascule),
  email « Thomas N. vient de publier un nouveau trajet » (Mailpit), silence si notification coupee,
  desabonnement, soi-meme refuse, etats vides. Trois anomalies MINEURES corrigees : ANO-WEB-30 (badge
  « Trajet passe » jamais rendu — `departureAt` ISO ajoute au contrat `YambaTripResult`, OpenAPI x5
  regeneres, badge dans `FavoriteTripsList`), ANO-WEB-31 (toast de desabonnement perdu — meme motif
  qu'ANO-WEB-29, retours au niveau du hook `useUnfollowUser`), ANO-WEB-32 (un trajet MASQUE par Yamba
  s'ajoutait en favori — `addFavorite` lit `hiddenByAdminAt`, +1 test unitaire : trip-service 261,
  plateforme 994). A trancher : note « 5.0 » vs « 5,0 », refus « propre trajet » en toast. Regard
  d'expert : revue systematique des `mutate(x, { onSuccess })` avec `onMutate` qui retire l'element
  (troisieme occurrence) ; dispatch email sans outbox (comme 5.10). Piege : le coeur est DANS le lien de
  la carte (selecteur corrige, aussi en 5.9) ; `nx serve trip-service` retombe sur « Recursive task
  invocation » apres deux modifications rapprochees. Harnais : 131 scenarios. PR **#276** (empilee sur
  #275). Reste : 5.12 a 5.32, 02-ADMIN. AUCUNE attribution Claude.
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
