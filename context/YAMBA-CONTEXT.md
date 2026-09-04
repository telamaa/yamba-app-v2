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

- CI GitHub Actions : 13 required checks sur dev (TypeScript x6, Tests
  unitaires x3, i18n, Anti-fuite, Contrats OpenAPI, build). A AJOUTER :
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
- Plateforme de tests : 716 (trip 198, deal 440, notification 78) + auth 80.
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

## Ce qui RESTE — Jalon 1

- PR-C (#85) : FAIT cote front — D34
  @packages/pricing (moteur unique, 7 specs), wizard sur le vrai trajet,
  etape 1 PER_KG (produit/famille/poids/S-M-L), recap COM-03, Garantie
  Yamba (GAR-02). RESTE pour B2 : POST /deals + snapshot D17 via le meme
  moteur + reservedKg atomique ; migration enums deprecies
  (maxSlots/bookedSlots).
- PR « parametres serveur » : GET /pricing/params (commission, plancher,
  poids de reference, table corridors) — aujourd'hui dupliques en
  constantes front/serveur (pricing-example, comparable-price,
  price-for-weight, pricing-corridors).
- UX restantes : step 1 (aeroport -> ville de rattachement + lieu de
  pickup, arrivee repliee, justificatif en step 3), lieux en chips + apercu
  sticky (create-trip), cleanup legacy PER_CATEGORY + instantBooking.
- B2 (suite) : PR2 (cycle de vie), PR3 (front des transitions + seed),
  PR4 (emails transactionnels booking.*) et PR5 (tracker Expediteur)
  FAITES — voir « fait » ci-dessus. RESTE (avec B3) : photos du colis via
  media-service :6009, AES-256-GCM re-affichage code livraison, SiteConfig
  commissionRate (D16). payment-service :6008 : NON (D38).
- B3 transport : PR1 serveur (#95) et PR2 front FAITES (voir « fait »).
  Dettes rattachees : URLs signees / fichiers prives ImageKit et
  verification du domaine des URLs photo (D42), procedure de rotation de
  cle AES (format v1 pret), vue DELIVERED persistante cote Voyageur
  (spec §11, hors v1), actions tracker confirmer/litige (B4). Docker/Redpanda
  DOIT tourner pour les notifications et emails (relay outbox + consumer).
- B4 argent sortant : confirmation anticipee, cron J+4 -> COMPLETED +
  transfers.create(), dispute avec gel, matrice remboursements.
- B5 confiance : rating double-aveugle, relances J+5/J+7, stats de
  reputation visibles (D29-1). Attention review : unicite
  (bookingId, authorUserId) avec bookingId nullable = index partiel raw ou
  unicite service, jamais de @@unique naif sur Mongo.

## Ce qui RESTE — Jalon 2 (constitutif du lancement public)

- Chantier C admin-ui : mediation litiges (tickets YAM-XXXX), verification
  billets, file des Reports, gestion users, parametres plateforme audites
  (les curseurs du mockup), TrustScore interne + plafonds (D29-2), login
  separe, 2FA TOTP, audit log.
- Chantier E : profil public Voyageur (stats reelles, trajets, avis).
- Solde sessions auth : SES-03 sudo mode, SES-04 modal expiration,
  SES-05 liste des sessions, cleanup sessions legacy (30j post-prod).
- API : conversion OpenAPI auth-service (contrats Zod), page /docs Scalar
  auth, page /docs index gateway, audit anglais OAS trip-service.
- Micro-PRs confiance : wording statuts D28, bouton Signaler (trajet +
  membre), CTA alertes, page destinataire.
- Integrations : Sentry front+back, PostHog, verification backups Atlas.

## Ce qui RESTE — Jalon 3

- F message-service :6005 (chat Socket.io, coordination pickup).
- Fin i18n : PR feat/locale-es (critere de fin), puis PT.
- H recommandations ML (replay outbox + PostHog).

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
- viewsCount Redis (D5).

## Dettes techniques et TODO vivants (registre §7.2-7.3)

- chore/deps : 43 vulnerabilites npm dont 6 critiques (PR dediee, jamais
  npm audit fix --force en pleine PR) · Prisma 6->7.
- fix/error-semantics trip-service (400-partout -> 404/401/403).
- Cleanup post-pricing : maxSlots/bookedSlots, WITH_INTERMEDIATE_STOPS,
  handoffMoments/pickupMoments, dark:bg-slate-950 -> 900.
- Front haute priorite : Toaster (Sonner) au layout racine ·
  OnboardingBanner apres Header · cron onboarding-reminder (node-cron a
  installer, branchement main.ts auth) · page carrier settings (Stripe).
- Redaction pino-http (cookie + authorization) · getImageKit() paresseux ·
  AddDocumentsBody en Zod dedie · harmonisation noms projets Nx ·
  idempotence seed-deals · bug seed shipperId === carrierId a trancher ·
  git config user.email.
- Inscription : messages d'erreur explicites — FAIT le 03/09 (fix/auth-recette,
  A51) pour le mot de passe, l'email deja pris et les erreurs OTP ; reste :
  telephone et champs requis (memes codes, a faire quand le formulaire les aura).
- Backlog recette 03/09 (priorise, decisions utilisateur prises) : P1
  feat/email-locale (D44 : preferredLocale N langues, x-locale, gabarit partage,
  prenom reel D45, migration des 3 mailers) · P1 feat/booking-auth-modal (modale
  sur la page trajet + redirect header) · P2 feat/trip-favorites · P2
  feat/auth-pages-ux (tutoiement, faux chiffres, vocabulaire du role a trancher)
  · P2 feat/auth-google (ecran consentement CGU) · P3 chore/api-same-origin
  (rewrite Next /api → gateway, fin du piege localhost/LAN). Mode LAN conserve,
  boutons Google/Facebook laisses tels quels jusqu'a leur PR.
- Dette D44 : templates trip-service et notification-service encore en ternaires
  fr/en (.ejs) — a migrer sur le gabarit partage + dictionnaires quand une 3e langue
  arrive (ou avant lancement) ; trip-service garde son propre transport Nodemailer.
- Candidat D35 (ex-« D32 » avant que D32 = plancher par colis) : provider email transactionnel (Resend/Postmark/SES)
  derriere @packages/email, avant lancement. MailHog docker-compose local
  candidat.
- Backlog parametre serveur candidat : prix plancher par colis (note A28).

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
