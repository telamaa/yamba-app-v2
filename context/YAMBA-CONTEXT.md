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

- context/YAMBA-REGISTRE-DECISIONS-ROADMAP-v1.3.md — arbitrages D1-D31,
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
- Jalon 3 — Expansion : chat, mobile, locales, reco.

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
- Plateforme de tests : 433 (trip 187, deal 225, notification 21) — post-#85.

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
- Micro-PR D31 : gate Stripe/profil deplace de la publication vers
  l'acceptation + carrierPage/Stripe factices au seed.
- B2 argent entrant : creation deal depuis le wizard, PaymentIntent
  (autorisation -> capture a l'acceptation), accept/decline, cron expiration
  24h, remboursements, PaymentProvider abstrait, writers outbox EN
  TRANSACTION Mongo, payment-service :6008, media-service :6009,
  SiteConfig commissionRate 0.12 + plancher 300 centimes (D16),
  AES-256-GCM re-affichage code livraison, emails transactionnels.
- B3 transport : pickup (upload R2, code bcrypt, checklist conformite),
  refuse, tracking, deliver (compare + lock serveur), regeneration code.
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
- G mobile (client genere depuis l'OpenAPI, D3).
- H recommandations ML (replay outbox + PostHog).

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
