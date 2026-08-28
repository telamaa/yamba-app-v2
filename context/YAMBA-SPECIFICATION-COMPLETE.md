# YAMBA — Spécification complète du projet (bout en bout)

> **Version** 1.0 · août 2026 · dérivée du registre de décisions v1.3 (D1–D31),
> des règles métier v1.2, de SPECIFICATIONS-WORKFLOW-BOOKING-YAMBA.md et de
> l'état réel du code (`dev` @ `70f060b`, post-PR #77).
>
> **Hiérarchie documentaire** : ce document est une **synthèse de présentation**.
> En cas de divergence, les sources de vérité priment dans cet ordre :
> 1. Le code et ses tests (le code fait foi)
> 2. `YAMBA-REGISTRE-DECISIONS-ROADMAP-v1.3.md` (le registre grave)
> 3. `YAMBA-REGLES-METIER-V2.md` (~50 règles)
> 4. `SPECIFICATIONS-WORKFLOW-BOOKING-YAMBA.md` (workflow deal)
> 5. `mockup-pricing-yamba.html` (spec visuelle pricing)

---

# 1. Vision produit

Yamba est une **marketplace P2P de transport de colis légers entre
particuliers** — le modèle BlaBlaCar appliqué au colis. Un voyageur qui prend
l'avion vend sa franchise bagage inutilisée, au kilo ; un particulier lui
confie un colis, paie en ligne, suit la livraison et note l'échange.

- **Vision universelle et globale** : ce n'est PAS une plateforme diaspora.
  Le positionnement de marque est neutre et mondial dès le lancement ;
  l'acquisition est corridor-spécifique par nature du ciblage, invisiblement.
- **Premiers corridors** : franco-africains (Paris→Brazzaville en seed).
  Le marché informel « GP » de ces corridors price au kilo (8–15 €/kg) :
  c'est le standard mental des utilisateurs, adopté comme modèle de prix.
- **Objectif qualité assumé** : solide, propre, pro, secure, long terme.
  Le mot « MVP » est banni du référentiel — le lancement public exige les
  jalons 1 ET 2 (voir §14).
- **Fondateur solo** : Telama. Échéances de financement réelles
  (septembre 2026 : Station F, Paris&Co, Bourse French Tech, prêt d'honneur).

## 1.1 Principe des portes (cadre de toute décision)

- **Porte à sens unique** 🚪→ : chère/impossible à changer (schéma de données,
  contrats API/événements, sécurité, sémantique métier) → prise immédiatement
  au niveau d'exigence maximal.
- **Porte à double sens** 🚪↔ : substituable (broker, provider, lib,
  hébergement) → prise au plus simple qui respecte le contrat.
- **Corollaire opérationnel** : les arbitrages sont gravés au registre AVANT
  tout code — jamais l'inverse. Une intention non écrite n'existe pas.

---

# 2. Personas & terminologie

| Code / DB | UI / marketing | Rôle |
|---|---|---|
| `carrier` | **Yamber** / **Tripper** (Voyageur) | Publie un trajet, vend sa capacité en kg, transporte |
| `shipper` | **Shipper** (Expéditeur) | Réserve, paie, remet le colis, confirme la livraison |
| `ADMIN` | — | Médiation, conformité, paramètres (jalon 2, admin-ui) |
| `SYSTEM` | — | Crons (expiration 24 h, auto-complete J+4) |

Langues : **français** pour la communication et les documents internes ;
**anglais** pour toutes les surfaces publiques (OpenAPI, messages d'erreur
API, event keys).

---

# 3. Architecture technique

## 3.1 Monorepo

- **Nx 22** (targets inférés par plugins — pas de `project.json` dans les
  services), **Node 22**, TypeScript strict, `npx nx` exclusivement.
- Repo `yamba-app` (organisation GitHub `telamaa`), branche de base `dev`
  protégée par **12 required checks**.
- `prisma/schema.prisma` est **à la racine du repo**.
- Alias `@packages/*` déclarés dans `tsconfig.base.json` ;
  `@packages/api-contracts` déclaré AVANT le wildcard.

## 3.2 Services

| Service | Port | Rôle |
|---|---|---|
| `apps/user-ui` | — | Next.js 16 App Router, front public |
| `apps/auth-service` | 6001 | Comptes, JWT + refresh, sessions (D27), onboarding carrier |
| `apps/trip-service` | 6002 | Trajets : CRUD, lifecycle, pricing, documents, recherche |
| `apps/deal-service` | 6003 | Bookings/Deals : state machine, capacité, outbox |
| `apps/notification-service` | 6004 | Premier consumer Kafka : notifications in-app |
| `apps/api-gateway` | 8080 | Proxy unique, cookies, routing |
| `payment-service` (B2) | 6008 | Stripe : PaymentIntents, transfers, remboursements |
| `media-service` (B2) | 6009 | Uploads R2 (photos pickup, preuves) |
| `message-service` (jalon 3) | 6005 | Chat Socket.io |
| `admin-ui` (jalon 2) | — | Back-office (login séparé, 2FA TOTP, audit log) |

Ordre de démarrage local : auth → trip → gateway.

## 3.3 Infrastructure

- **MongoDB Atlas** (replica set — transactions multi-documents prouvées),
  via **Prisma 6+**.
- **Redpanda** en dev (100 % compatible Kafka, un binaire), broker managé
  compatible Kafka en prod (Upstash Kafka décommissionné — Confluent Cloud
  ou Redpanda self-host le moment venu). Transport `kafkajs`, isolé derrière
  `@packages/messaging` (interface `EventPublisher`).
- **Redis/Upstash** (rate limiting, viewsCount D5 à venir).
- **Stripe Connect Express** (API 2026-03-25.dahlia, MCC 4215).
- **Cloudflare R2** (photos/documents) · **ImageKit** (images optimisées).
- **Nodemailer + EJS** (SMTP env) — candidat D32 : provider transactionnel
  (Resend/Postmark/SES) derrière `@packages/email` avant lancement.
- Logging **pino** + correlation ID. Front : React Query (TanStack),
  Tailwind, next-intl FR/EN, Sonner, Lucide, Scalar (viewer OpenAPI).

## 3.4 Design system

Mango `#FF9900` + teal `#0F766E` · dark/light via class strategy · canvas
light `bg-slate-50` / cards `bg-white`, canvas dark `bg-slate-950` / cards
`bg-slate-900`.

---

# 4. Modèle de domaine

## 4.1 Trip (trip-service)

Un trajet publié par un carrier : origine/destination (Google Places),
dates, documents de preuve (billet, itinéraire… — enum
`TripDocumentType`, modération PENDING/VERIFIED/REJECTED), et son **offre
tarifaire** (voir §6). Champs pricing PER_KG depuis PR #77 :
`pricePerKgCents`, `capacityKg` (saisie carrier), `reservedKg` (compteur
serveur, JAMAIS en entrée), `checkedBag23PriceCents`, `cabinBag12PriceCents`,
`familyConditions` (type `TripFamilyCondition[]`, enums `ParcelFamily` ×8 +
`FamilyConditionMode`). Le legacy `categoryConditions` coexiste (A28).

## 4.2 Booking / Deal (deal-service)

Le contrat entre un shipper et un carrier pour UN colis sur UN trajet :

- **Snapshot de prix immuable (D17)** : photographie complète du breakdown
  (base, modificateurs, commission, prime de protection séparée, net) au
  moment de la réservation. Jamais recalculé depuis le Trip.
- **Pricing discriminé** `PER_CATEGORY` / `PER_KG` : un changement de moteur
  ne migre jamais les bookings existants.
- Capacité : les kg sont réservés **dès PENDING** (D19) et rendus par
  l'effet `RELEASE_CAPACITY` des transitions de sortie (CAP-02 : partition
  stricte statuts ACTIFS / TERMINAUX ; **DISPUTED est ACTIF** — il conserve
  les kg — mais ne bloque pas la complétion du trajet : deux flags
  contextuels séparés, fallback conservatif).
- Fuseaux, soft delete / RGPD, `protectionPlan` (provider, D22),
  code de livraison (bcrypt ; champ chiffré AES-256-GCM en B2 pour le
  ré-affichage), tracking séquentiel, compteurs (tentatives, régénérations).

## 4.3 Autres modèles

`User` + profil carrier (carrierPage, Stripe accountId) · `Report`
(signalements, file admin jalon 2) · `Notification` (in-app, dédup par
event-id) · `OutboxEvent` (D2) · `Review` (B5 — extension du modèle
existant ; unicité `(bookingId, authorUserId)` avec nullable = index partiel
raw ou unicité service, jamais de `@@unique` naïf sur Mongo) · `SiteConfig`
(paramètres serveur — commissionRate à corriger : 0,10 actuel ≠ D16).

---

# 5. Machines d'états

## 5.1 Deal — 9 statuts, 12 transitions (source : booking-state-machine.ts)

```
   création ───────▶ PENDING ──── decline (CARRIER) ─────▶ DECLINED
   (paiement            │    ──── expire 24h (SYSTEM) ───▶ EXPIRED
    autorisé)           │    ──── cancel (SHIPPER) ──────▶ CANCELLED
                        │ accept (CARRIER, charte)
                    ACCEPTED ──── refusePickup (CARRIER) ▶ CANCELLED (sans pénalité)
                        │    ──── cancel (SHIPPER, ANN-01 barème J-2) ▶ CANCELLED
                        │    ──── cancel (CARRIER, ANN-02 défaut) ────▶ CANCELLED
                        │ pickup (checklist 5/5 + ≥1 photo → GENERATE_CODE)
                    PICKED_UP    (tracking optionnel : AT_AIRPORT →
                        │         FLIGHT_DEPARTED → FLIGHT_ARRIVED)
                        │ deliver (code 6 chiffres, bcrypt, 3 essais, lock 15 min)
                    DELIVERED ─── dispute (SHIPPER, avant J+4) ▶ DISPUTED (payout gelé)
                        │ confirmEarly (SHIPPER) OU autoComplete (SYSTEM, J+4)
                    COMPLETED → transfers.create() Stripe → notation mutuelle
```

Principes gravés dans le code (188 tests dédiés) :
- **L'acteur fait partie de la transition** : `cancel` depuis ACCEPTED n'a
  pas les mêmes effets selon SHIPPER (barème ANN-01) ou CARRIER (défaut
  ANN-02 : remboursement intégral + `PENALIZE_CARRIER`).
- **Les effets de bord sont déclarés en data** (`FULL_REFUND`,
  `RELEASE_CAPACITY`, `NOTIFY_*`, `GENERATE_CODE`, `TRANSFER_PAYOUT`,
  `FREEZE_PAYOUT`…) — les exécuteurs arrivent par chantier (B2 paiement,
  B4 transfers) sans toucher à la machine.
- **Guards à horloge injectée** (jamais `new Date()` dans un guard) : un
  PENDING expiré se comporte comme EXPIRED avant le passage du cron.
- **Interdictions structurelles testées par assertions nommées** : aucune
  annulation après remise du colis (seule voie : dispute) ; DISPUTED
  terminal v1 (résolutions ADMIN = chantier C) ; ADMIN réservé dans les
  types mais AUCUNE transition ; 4 terminaux sans issue (87 tests de
  matrice générés).
- Opérations gardées hors transitions : `canRegenerateCode` (max 5),
  `canConfirmTrackingStep` (séquence stricte). Constantes §5.4 verrouillées
  par tests : 3 tentatives code, lock 15 min, 5 régénérations.
- `getAllowedActions` = **le contrat des CTAs front** : le front reflète ce
  que l'API accepte, il ne le décide jamais.

## 5.2 Trip — lifecycle (trip-service)

State machine propre (draft → published → paused/… , 7 transitions
exposées en API), cron de complétion, `hasActiveBookings()` branché (un
trajet avec deals actifs ne se supprime pas). Gate de publication : voir
§6.4 (pricing) et §11 (Stripe/profil, D31).

---

# 6. Pricing (D13–D16, A28)

## 6.1 Le modèle (D13)

**Prix = €/kg × poids.** Le carrier fixe UN nombre (son €/kg) + sa capacité
en kg. L'Expéditeur qualifie le volume par une **classe visuelle S/M/L**
(jamais de dimensions) : S ×1,0 « de l'enveloppe à la boîte à chaussures » ·
M ×1,1 (sac cabine) · L ×1,25 (demi-valise). Pas de classe XS : le poids
fait le travail du petit colis. **Bagages entiers = produits forfaitaires**
(CHECKED_BAG_23KG / CABIN_BAG_12KG, prix fixe, consomment leur franchise
nominale de la capacité — PRC-04).

## 6.2 Familles de risque (D14, CAT-02)

La catégorie ne pilote **plus jamais le prix** — elle porte conformité,
risque, protection. **8 familles** : DOCUMENTS_PAPERS, CLOTHES_TEXTILE,
FOOD_DRY_SEALED (encadrée CNF), ELECTRONICS_DEVICES, COSMETICS_CARE,
PARTS_TOOLS, TOYS_CHILDCARE, MISC_ACCESSORIES. Par famille, le carrier
choisit : **OK / surcharge +% / refus**.

## 6.3 Commission (D16) & suggestion (D15)

- Commission **12 %, plancher 3,00 €, côté Expéditeur**, affichage 2 lignes
  (transport + « service & protection »). Le net du carrier = son prix.
  Le carrier voit son net, point (jamais les coûts de la plateforme).
- Suggestion V1 **déterministe** (PRC-05) :
  `prixSuggéré = base_corridor × Π(modificateurs)` (vol direct, proximité
  date, saisonnalité, réputation, demande SavedRoutes). Affichage :
  fourchette basse–médiane–haute + jauge « prix juste » (PRC-06 : badge de
  confiance, jamais bloquant). DHL/La Poste = ancre marketing + plafond de
  sécurité, jamais entrée d'algo (PRC-10).
- Tolérance poids au pickup : ±10 % (PRC-07). Forfait bagage suggéré =
  médiane_corridor × franchise × 0,9 (PRC-09).

## 6.4 Bi-moteur & gate A28 (état actuel du code)

Coexistence tolérante PER_CATEGORY (legacy) / PER_KG (cible) — jamais
invalider l'existant :
- Champs plats nullables + gate « UN moteur complet » à la publication :
  `resolvePricingEngine` → PER_KG si prix>0 ET capacité>0 (prime sur
  legacy) ; PER_CATEGORY si conditions ; sinon refus (message unique).
  Branché sur les DEUX chemins (publishTrip, updateTrip publish=true,
  valeurs effectives `updateData ?? trip`). 8 specs.
- `minPriceCents` = null pour PER_KG (exclu du tri lowestPrice, moteurs
  incomparables — documenté ; comparabilité = PR search future).
- Backlog paramètre serveur candidat : « prix plancher par colis ».

## 6.5 Le formulaire (mockup — spec visuelle de PR-B/PR-C)

Face carrier (create-trip / StepConditions) : 4 sections — suggestion +
jauge « prix juste » · €/kg + capacité (curseurs) · 8 familles OK/+%/Non ·
bagages forfaitaires — + `TripLiveSummary` (gain net en direct, « versé à
J+4 après livraison confirmée »). Face shipper (wizard) : poids + classes
S/M/L + protection + récap 2 lignes.

---

# 7. Règles métier (index — détail dans YAMBA-REGLES-METIER-V2.md)

Principe transverse : **toute règle est appliquée côté serveur** — le front
n'est qu'indicatif (D4).

- **PRC** pricing (§6) · **CAT** catégories/familles · **COM** commission.
- **CAP** capacité : réservation dès PENDING (D19), partition ACTIVE/
  TERMINAL, partition des kg.
- **ANN** annulation : ANN-01 barème shipper (100 % si ≥ J-2, partiel
  ensuite — calculé par le module remboursement B2, la machine déclare
  `REFUND_PER_CANCELLATION_POLICY`) · ANN-02 défaut carrier (remboursement
  intégral + réputation) · plus d'annulation après remise.
- **CNF** conformité : checklist pickup, encadrement FOOD_DRY_SEALED,
  refus de conformité légitime sans pénalité, plafonds progressifs.
- **GAR** protection : transitoire « Garantie Yamba », cible embedded
  insurance (Wakam/Owen/Qover — D22), **prime = flux séparé** (GAR-04).
- **SES** sessions (D27) : inactivité serveur + durée absolue livrées ;
  SES-03 sudo mode, SES-04 modal expiration, SES-05 liste des sessions au
  jalon 2.
- **REP** réputation (D29) : ① stats visibles explicables (badges,
  niveaux publics) ≠ ② TrustScore interne (plafonds CNF-06, priorisation
  revue, humain dans la boucle, traçabilité Kafka). Signaux exclus :
  fréquence de connexion, volume brut.
- **FUS** fuseaux · **SIG** signalement · **DEV** devises (D18 : centimes
  Int + currency partout ; D25 : transaction 100 % EUR v1, affichage
  localisé Intl.NumberFormat) · **RGP** données personnelles (soft delete,
  purge).
- **D20** : tout passe par PENDING (badge « Réponse sous 24 h ») — jamais
  de deal sans acceptation du carrier.
- **D28** wording statuts orienté action.

---

# 8. Architecture événementielle (D2)

- **Transactional outbox dès B1** : aucun changement d'état sans événement
  écrit dans la MÊME transaction Mongo. Pattern impossible à retrofitter —
  d'où sa présence jour 1. Le journal = audit trail des deals (médiation).
- **17 événements de domaine versionnés** (miroir de la state machine),
  relay polling → Redpanda (`OUTBOX_RELAY_ENABLED`, `localhost:9092` dev).
- **notification-service = premier consumer** : groupId dédié, commit
  d'offsets post-traitement, **dédup par event-id** (idempotence de bout en
  bout), gestion poison. Chaîne prouvée E2E : seed-outbox → relay →
  Redpanda → consumer → lignes Notification en ~100 ms.
- Le **code de livraison ne voyage JAMAIS dans les events ni les emails**.
- kafkajs marque les erreurs de connexion `retriable: false` → interceptées
  explicitement.

---

# 9. Sécurité & auth

- **JWT + refresh tokens**, cookie `access_token` prioritaire puis Bearer
  (miroir exact dans l'OAS : cookieAuth + bearerAuth, sémantique OR).
- Sessions D27 : inactivité + durée absolue côté serveur.
- **DTOs par rôle = whitelists strictes** (jamais spread+delete) — prouvé
  par test d'injection (`makeLeakyBooking`). Le shipper et le carrier ne
  voient pas les mêmes champs d'un même booking.
- **Sémantique 403 vs 404** : ne pas révéler l'existence d'une ressource à
  qui n'y a pas droit. (fix/error-semantics trip-service au backlog :
  400-partout → 404/401/403.)
- Code de livraison : bcrypt en base, 3 tentatives, lock 15 min, 5
  régénérations max ; AES-256-GCM pour le ré-affichage (B2).
- Anti-fuite : hook pre-commit + job CI « Anti-fuite (fichiers sensibles) » ;
  redaction pino-http (cookie, authorization) au backlog.
- Admin-ui : login séparé, 2FA TOTP, audit log (jalon 2).

---

# 10. API & contrats (D3)

- **OpenAPI 3.1 généré depuis Zod** (`zod-openapi`) : le même schéma valide
  à l'exécution ET génère la spec. `@packages/api-contracts` = source
  unique (statuts partagés A19, enveloppes, enums).
- OAS trip-service : **99 paths ×3 registres**, viewer Scalar sur
  `localhost:6002/docs`. Job CI « Contrats OpenAPI (generate + diff) » :
  toute désynchronisation contrats/spec casse la CI.
- Enveloppes réelles documentées (detail `{success, trip+allowedActions}`,
  listes `{success, trips, count}`, mutations `TripMutationResponse`,
  transitions `ActionResponse`, search sans `success`…).
- Conversion OpenAPI auth-service + `/docs` gateway : backlog jalon 2.
- Le client mobile (jalon 3, G) sera **généré depuis l'OpenAPI**.

---

# 11. Paiements (D11, D16, D21, D31)

- **Stripe Connect Express** (D11). Jamais de RIB/virement manuel (exercice
  illégal de services de paiement — DSP2/ACPR). `PaymentProvider` abstrait
  dès B2 (porte à double sens sur le provider, à sens unique sur le flux).
- Flux : **autorisation** du PaymentIntent à la création (PENDING) →
  **capture à l'acceptation** → **transfers.create() à COMPLETED** (J+4 ou
  confirmation anticipée) → gel du payout si DISPUTED.
- **D31 (gravé, micro-PR à venir)** : le gate Stripe/profil migre de la
  PUBLICATION vers l'ACCEPTATION — le KYC (~5 min, incompressible) se
  demande quand l'argent est réel (« 66 € t'attendent »), jamais avant la
  première preuve de valeur, jamais après la capture. Mitigation des
  trajets non finalisables : expiration 24 h + OnboardingBanner + cron de
  relance + PostHog.
- Prime de protection = flux séparé du transport (GAR-04) dès le jour 1.

---

# 12. i18n

next-intl FR/EN. Frontière : `isFr = locale === "fr"` uniquement à la
frontière, maps statiques enum→clé, jamais de ternaire de locale dans les
composants. Job CI « i18n messages (parse + miroir FR/EN) ». Restant :
dissolution `dashboard.copy.ts`, booking, trips/create, LocationsCard →
namespace tripDetail, suppression du `UiPreferencesProvider` déprécié.
**Critère de fin : PR `feat/locale-es`** (jalon 3), puis PT.

---

# 13. Qualité, CI & conventions

- **12 required checks** sur `dev` : TypeScript ×6 (user-ui, trip, auth,
  gateway, deal, notification) · Tests unitaires ×3 (deal, notification,
  trip) · i18n · Anti-fuite · Contrats OpenAPI.
- **Plateforme de tests : 396** (trip 157 dont gate pricing 8, deal 218,
  notification 21). **D30 : les tests vivent dans la MÊME PR que leur
  logique.** Livraison = PR **mergée** dans `dev`, numéro noté au merge.
- tsc de référence : `npx tsc --noEmit --project apps/<svc>/tsconfig.app.json`
  (jamais `--project apps/<svc>` : résout le tsconfig solution-style).
- Pièges gravés : Prisma+Mongo `readAt: null` → `OR [{readAt: null},
  {readAt: {isSet: false}}]` · uniques nullable Mongo (collisions sur null)
  · filesystem macOS insensible à la casse vs Turbopack/Linux sensible ·
  `overflow-x: clip` (pas hidden) pour `position: sticky` · props callback
  `"use client"` suffixées `*Action` · `params` des pages Next 15+ =
  Promise → await · `nxCloudId` fatal en CI (retiré).

---

# 14. Roadmap — 3 jalons

**Jalon 1 — Boucle transactionnelle** (critère : un Expéditeur réserve,
paie, fait livrer, note, en conditions réelles Stripe test) :
- ✅ B1 fondations + notification-service + listes réelles (PRs #70–#74, #76)
- ✅ Refonte pricing PR-A (#77) : schéma + contrats + gate A28 + seed
- 🔄 **PR-B (en cours)** : StepConditions selon le mockup + TripLiveSummary
  + mappers 5 champs + i18n · PR-C : wizard shipper + migration enums ·
  micro-PR D31
- 🔲 B2 argent entrant (PaymentIntent, writers EN TRANSACTION, cron 24 h,
  payment-service, media-service, commission 12 %/300c, AES-256-GCM) ·
  B3 transport · B4 argent sortant · B5 confiance

**Jalon 2 — Plateforme opérable = LANCEMENT PUBLIC** : admin-ui
(médiation YAM-XXXX, Reports, paramètres audités, TrustScore, 2FA) ·
profil public carrier (E) · solde sessions · micro-PRs confiance ·
Sentry + PostHog + vérification backups Atlas · conversion OpenAPI auth.

**Jalon 3 — Expansion** : chat (F, :6005) · locales ES puis PT · mobile
(G, client généré OpenAPI) · recommandations (H, replay outbox).

**Méthode d'estimation** : l'unité est la session (1–3 PRs mergées) ; on
estime des PRs, pas des chantiers ; fourchette optimiste/réaliste (×1,5) ;
ré-estimation à chaque handoff. État : ~15 sessions consommées ; restant
jalon 1 ≈ 11,5–17 ; lancement ≈ 5–8 semaines à cadence tenue.

---

# 15. Règles de code NON NÉGOCIABLES (rappel exécutif)

1. Montants en **centimes Int** + `currency`, jamais Float.
2. DTOs par rôle = whitelists strictes.
3. Le code de livraison ne voyage jamais (events, emails).
4. Aucun changement d'état sans event outbox dans la même transaction.
5. Snapshot pricing immuable (D17).
6. 403 vs 404 respectés.
7. Tests dans la même PR (D30) ; la machine d'états est un miroir de la
   spec — toute divergence est un bug, jamais une interprétation.
8. Toute limite métier est serveur ; le front reflète `allowedActions`.
9. Arbitrage gravé au registre AVANT le code.
10. Surfaces publiques en anglais, docs internes en français.

---

# 16. Glossaire

**Deal/Booking** : contrat shipper↔carrier pour un colis · **GP** : marché
informel « gratuité partielle » des corridors, référence de prix au kilo ·
**Gate A28** : validation « un moteur de prix complet » à la publication ·
**Outbox** : table d'événements écrite en transaction avec l'état ·
**Snapshot pricing** : breakdown figé dans le booking (D17) · **SavedRoutes** :
alertes corridor des shippers (signal de demande D15) · **YAM-XXXX** :
format des tickets de médiation (jalon 2) · **Jalon** : palier de roadmap à
dépendances techniques, jamais hiérarchie de valeur.
