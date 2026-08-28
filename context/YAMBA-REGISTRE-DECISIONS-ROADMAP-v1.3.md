# 📕 YAMBA — Registre des décisions & Roadmap maîtresse

> **Version** 1.3 · 21 juillet 2026 — *révisions : jalons reformulés (fin du vocable « MVP ») · registre des arbitrages A1–A24 consolidé (§2bis) · leçons capitalisées fusionnées (§6) · corrections factuelles (§0bis : chemins, CI 11 checks, ports, numéros de PR) · vélocité recalibrée post-B1 (§4) · backlog maître avec statuts ✅/🔄/🔲 (§7)*
> **Statut** : document de référence — toute divergence d'implémentation doit être arbitrée contre ce document, puis répercutée ici.
> **Document jumeau** : `YAMBA-REGLES-METIER-V2.md` (v1.2 — les règles métier issues de ces décisions).
> **Documents liés** : `SPECIFICATIONS-WORKFLOW-BOOKING-YAMBA.md` (workflow deal) · `DOC-METIER-TRIP-LIFECYCLE.md` (RG-01→RG-27) · `DOC-DEV-TRIP-LIFECYCLE.md` · handoff courant `YAMBA-CONTEXT-HANDOFF-B1-PR4.md` · guides `docs/deal-service/PR{3,4}-EXPLICATION-{METIER,TECHNIQUE}.md`.

---

# 0bis. Erratum & faits prouvés (v1.3 — prime sur tout document antérieur)

| Fait | Réalité PROUVÉE | Corrige |
|---|---|---|
| Schéma Prisma | `prisma/schema.prisma` (RACINE du repo, 913 l) | Toute mention de `packages/libs/prisma/schema.prisma` |
| Seeds | `packages/libs/prisma/scripts/` (seed-deals.ts, seed-outbox.ts) — import Prisma en RELATIF (`../index`), exécution `npx tsx` (ne lit pas les alias tsconfig → contrats en relatif aussi) | Handoffs antérieurs |
| Import Prisma (services) | `import prisma from "@packages/libs/prisma"` | — |
| Config Nx | **AUCUN `project.json` dans aucun service** — cibles inférées par plugins ; `npx nx` toujours, jamais global | Handoff PR3 (« joindre la config Nx ») |
| CI | **11 checks** ; required sur `dev` : 9 historiques + TypeScript (deal-service) + Tests unitaires (deal-service) — required PARTIELLEMENT confirmé (Tests ✓ vu Required le 21/07 ; TypeScript deal à confirmer dans Settings → Branches) | — |
| Ports (A18) | 6001 auth · 6002 trip · 6003 deal · **6004 notification (PR4bis)** · 6005 chatting · 6006 admin · 6007 recommendation · 6008 payment (B2) · 6009 media (B2) · 6010 search · 6011 analytics · 8080 gateway · 9092 Redpanda | — |
| Guides PR | `docs/deal-service/PR{3,4}-EXPLICATION-{METIER,TECHNIQUE}.md` | Handoff PR4 §2 (disait `docs/`) |
| Tests deal-service | **218 verts** = 188 machine + 14 mapper + **16 relay** (pas 15) | Notes de session intermédiaires |
| PRs B1 | PR1 = **#70** · PR2 = **#71** · PR3 = **#72\*** (à confirmer) · PR4 = **#73** (code, 5 commits) **+ #74** (guides docs, checks comptés 11/11) — leçon §6.1 : noter le numéro AU MERGE | Handoff PR4 §1 |
| kafkajs | `kafkajs@^2.2.4` épinglée ; env `KAFKA_BROKERS` (déf. `localhost:9092`), `OUTBOX_RELAY_ENABLED` (déf. `true`) | — |

---

# 1. Cadre de décision

Toutes les décisions de ce registre sont classées selon le principe des **portes** :

- **Porte à sens unique** 🚪→ : chère ou impossible à changer plus tard (schéma de données, contrats d'API, contrats d'événements, modèle de sécurité, sémantique métier). **Prise immédiatement au niveau d'exigence maximal.**
- **Porte à double sens** 🚪↔ : substituable sans toucher au métier (broker, provider, lib, hébergement). **Prise au plus simple qui respecte le contrat, remplacée quand la charge le justifie.**

Objectif produit assumé : **solide, propre, pro, secure, long terme** — les fondations irréversibles sont impeccables dès le jour 1 ; l'infrastructure grandit avec la charge.

**Principe des jalons (nouveau en v1.3).** La roadmap est découpée en trois jalons (§3.0). Leur ordre exprime des **dépendances techniques** (on ne peut pas opérer une boucle qui n'existe pas ; on ne peut pas étendre une plateforme qu'on ne sait pas opérer) — **jamais une hiérarchie de valeur**. Tout ce qui figure aux jalons 2 et 3 appartient à la vision produit au même titre que le jalon 1 ; rien n'y est « optionnel » ou « post-produit ». Le vocable « MVP » est retiré du référentiel : il laissait croire que le jalon 1 était un produit livrable seul, alors que le lancement public exige les jalons 1 **et** 2.
---

# 2. Registre des décisions

## 2.1 Architecture & plateforme

| ID | Décision | Pourquoi | Compromis assumé | Porte |
|---|---|---|---|---|
| **D1** | Le module Booking vit dans un **`deal-service` dédié (port 6003)** | Frontière de domaine claire ; chaque futur domaine (notifications, médiation) aura sa frontière ; cohérent avec la vision événementielle | Plus de plomberie (gateway, auth middleware, déploiement) qu'un module dans trip-service | 🚪→ |
| **D2** | **Architecture événementielle en protocole Kafka dès B1** : événements de domaine versionnés (miroir de la state machine), interface `EventBus`, **transactional outbox** (événement écrit dans MongoDB dans la même opération que la transition, puis relayé), transport `kafkajs`, **Redpanda** en dev (compatible Kafka 100 %, un binaire, sans ZooKeeper/JVM), broker managé compatible Kafka en prod le moment venu | Le découplage producteur/consommateur permet d'ajouter notifications, analytics, audit sans toucher au métier ; le journal persistant = **audit trail des deals** (précieux pour la médiation) ; l'outbox est le pattern impossible à retrofitter | Un conteneur de plus en dev ; discipline de versionnement des événements. Note : Upstash a décommissionné son offre Kafka — prod = Confluent Cloud ou Redpanda self-host | 🚪→ (contrats + outbox) / 🚪↔ (hébergement broker) |
| **D3** | **OpenAPI 3.1 généré depuis les schémas Zod** (`zod-openapi`) : le même objet Zod valide les requêtes à l'exécution ET génère la spec. Abandon de swagger-autogen. Clients mobiles **générés** depuis la spec (orval / openapi-generator) | La doc ne peut plus dériver du code (source de vérité unique) ; OAS 3.1 = meilleur support des générateurs TS/Kotlin/Swift ; prérequis industriel de la version mobile | Migration du doc auth curaté (Swagger 2.0) ; discipline : tout endpoint naît avec son schéma Zod | 🚪→ (contrat) |
| **D6** | **RBAC dans le schéma User dès B1** : champ `role` (`USER` / `ADMIN`, extensible `MEDIATOR`) | L'admin dashboard (chantier C) l'exige ; deux lignes de schéma maintenant, migration coûteuse après | Néant | 🚪→ |
| **D8** | **Template de service** : chaque service naît avec logs structurés **pino** + **correlation ID** propagé depuis le gateway, CORS, error middleware, auth, OpenAPI-from-Zod | Suivre une requête de bout en bout à travers les microservices ; impossible à retrofitter sur des logs passés | Néant | 🚪→ |
| **D10** | **CI GitHub Actions obligatoire** : chaque PR exécute `tsc --noEmit` (tous projets), JSON parse + diff structurel FR/EN des messages, grep anti-fuite. **Une PR rouge ne se merge pas** | Le ritual manuel saute le jour de fatigue ; la machine ne fatigue pas ; protection maximale pour un solo founder | Une demi-journée de setup | 🚪↔ (mais prioritaire) |

## 2.2 Paiements & argent

| ID | Décision | Pourquoi | Compromis assumé | Porte |
|---|---|---|---|---|
| **D11** | **Interface `PaymentProvider` abstraite dès B2** — implémentation n°1 Stripe | Stripe ne verse pas au Congo ; l'infrastructure de paiement du marché cible est **Mobile Money** (MTN MoMo / Airtel Money) ; l'abstraction maintenant rend l'ajout indolore | Une couche d'indirection | 🚪→ |
| **D16** | **Commission unique en % prélevée côté Expéditeur**, frais Stripe **absorbés** dedans, **plancher** de commission, affichage en 2 lignes max (« Transport X € » + « Service & protection Y € »). Le Voyageur voit son **net**, point | Aucune marketplace pro n'expose les coûts de son prestataire (invite à la contestation) ; simplicité de lecture = confiance | Marge légèrement variable selon les frais Stripe réels | 🚪→ (affiché = promis) — **✅ acté au mockup : 12 %, plancher 3,00 €** (paramètres serveur, révisables) |
| **D17** | **Snapshot de prix immuable dans le Booking** : photographie complète du breakdown (base, modificateurs, commission, **prime de protection séparée**, net) au moment de la réservation. Jamais de prix recalculé depuis le Trip | Si le Voyageur change son €/kg, les deals existants ne bougent pas ; contestations impossibles ; comptabilité auditable — et la prime d'assurance (D22) doit être un flux distinct dès le jour 1 | Duplication contrôlée de données | 🚪→ |
| **D18** | **Tous les montants en centimes entiers + champ `currency`** partout, même en mono-devise EUR | Jamais de float pour l'argent ; le jour du XAF/Mobile Money, le schéma est prêt | Néant | 🚪→ |
| **D25** | **Devise de transaction ≠ devise d'affichage** : transaction 100 % EUR en v1 (un seul monde comptable), affichage localisé via `Intl.NumberFormat(locale)` | La vraie multi-devise (conversion, taux) n'arrive qu'avec Mobile Money ; le formatage localisé est gratuit | Les utilisateurs hors zone euro voient des EUR | 🚪↔ |

## 2.3 Pricing & catégories

| ID | Décision | Pourquoi | Compromis assumé | Porte |
|---|---|---|---|---|
| **D13** | **Le prix = €/kg × poids** : le Voyageur fixe UN nombre (son €/kg) + sa capacité en kg. **Classes de taille visuelles** S/M/L (boîte à chaussures / sac cabine / demi-valise) avec léger modificateur — jamais de dimensions L×l×H demandées. **Bagages entiers (23 kg soute / 12 kg cabine) = produits à part, prix forfaitaire** | La catégorie ne reflète pas le coût du transport (poids + volume + risque) ; le marché informel « GP » du corridor price au kilo (8-15 €/kg) = standard mental des utilisateurs ; personne ne mesure un colis (adaptation UX du poids volumétrique DHL sans la règle) | Refonte des étapes « Catégories & tarifs » (create-trip) et « Colis » (booking wizard) | 🚪→ (schéma Booking) — **✅ acté au mockup** : coefs S/M/L ×1,0 / ×1,1 / ×1,25 ; forfait bagage suggéré = médiane_corridor × franchise × 0,9 (remise de gros) |
| **D14** | **La catégorie garde ses vrais métiers : conformité, risque, protection** — plus jamais le prix. **✅ Acté : 8 familles de risque** (liste finale et mapping en CAT-02 v1.2), dont **Alimentaire sec & scellé** — le volume réel du corridor GP — strictement encadrée par les règles CNF. Surcharges/exclusions optionnelles par famille (« électronique : +20 % ou refusé ») | Deux taxonomies incompatibles cohabitaient (types d'objets + formats de contenants) ; la catégorie répond à « qu'est-ce que c'est ? », pas « combien ça coûte ? » | Migration de l'enum fraîchement aligné (mapping ancien→nouveau, JSON i18n, front) — PR mécanique rendue facile par les fondations propres | 🚪→ |
| **D15** | **Moteur de suggestion de prix — deux temps.** V1 **déterministe** : `prixSuggéré(€/kg) = base_corridor × modificateurs` (vol direct/escales, proximité départ, saison, réputation, **demande latente = SavedRoutes actives sur le corridor**). Affichage en fourchette basse-médiane-haute + ancre « les trajets similaires partent à Y €/kg » ; badge « prix juste » côté Expéditeur. **Ajouts actés (v1.2)** : les tarifs express (DHL/La Poste) ne sont PAS une entrée de l'algo (le marché de référence est le GP) mais servent ① d'**ancre marketing** côté Expéditeur (« Total 28 € — vs ~85 € chez DHL ») et ② de **plafond de sécurité** de la suggestion. V2 **apprenante** post-launch (taux d'acceptation/expiration par niveau de prix, données collectées par Kafka + PostHog) | Livrable sans données historiques ; la table base_corridor est seedée depuis l'étude du marché GP ; le signal SavedRoutes est un avantage propriétaire | La V1 sera imparfaite — c'est son rôle | 🚪↔ (l'algo) / 🚪→ (l'existence de la suggestion dans l'UX) |

## 2.4 Modèle du deal

| ID | Décision | Pourquoi | Compromis assumé | Porte |
|---|---|---|---|---|
| **D19** | **La capacité (kg) est réservée dès PENDING** et **libérée** sur DECLINED / EXPIRED / CANCELLED — transaction MongoDB pour la concurrence | Sinon le Voyageur accepte un deal devenu physiquement impossible (3 demandes de 5 kg sur 8 kg restants) ; chaque transition de la state machine a désormais un effet capacité | Des kg « gelés » pendant la fenêtre 24 h d'une demande qui sera peut-être refusée | 🚪→ |
| **D20** | **v1 : tout deal passe par PENDING** — `instantBooking` ne court-circuite pas l'acceptation. Le flag devient un badge « réponse rapide » ou est retiré du wizard | L'acceptation EST le mécanisme de confiance ET d'inspection du colis (conformité D9) ; court-circuiter PENDING changerait états, paiement, notifications | Pas de réservation instantanée v1 | 🚪→ — **✅ acté** : badge informatif « Réponse sous 24 h », toute demande passe par l'acceptation |
| **D21** | **Matrice d'annulation/remboursement** (détail dans RG métier) : PENDING → 100 % ; ACCEPTED jusqu'à J-2 → 100 % ; ACCEPTED < 48 h du départ → retenue partielle ; après PICKED_UP → litige uniquement. Annulation par le **Voyageur** après acceptation → remboursement intégral + impact réputation | La spec disait « politique à préciser » — chaque case = un flux d'argent en B2/B4, il faut la figer avant | Les seuils (J-2, % de retenue) sont des curseurs ajustables | 🚪→ (l'existence des cases) / 🚪↔ (les seuils) |
| **D22** *(révisée v1.1)* | **Protection du colis — stratégie à deux étages.** **Cible : une véritable assurance en partenariat avec un assureur**, via le modèle *embedded insurance* (acteurs type Wakam, Owen, Qover, bsurance : ils portent l'agrément et fournissent le produit en API — Yamba distribue, ne devient pas assureur). **Transitoire au lancement : « Garantie Yamba »** (engagement commercial de remboursement plafonné, légal immédiatement) si le contrat n'est pas signé à temps. **Le schéma naît prêt pour la bascule** : champ `protectionPlan` avec `provider` (`YAMBA_GUARANTEE` → demain l'assureur), et la **prime est un flux comptable séparé de la commission dès le jour 1** (cf. D17). L'UI n'emploie le mot « assurance » qu'après signature du contrat | Une vraie assurance portée par un assureur reconnu est un actif de confiance supérieur — et la confiance est LE sujet du marché. Le montage (négociation produit, exclusions, sinistres, obligations de distribution DIC/IPID) prend des semaines à mois hors de notre contrôle : il ne doit bloquer ni le mockup ni B1. Bonus : le questionnaire de souscription de l'assureur muscle mécaniquement la conformité D9 | Double vocabulaire transitoire ; démarches partenaire à mener en parallèle (flux « Telama seul », §3.2) | 🚪→ (séparation prime/commission dans le schéma, `protectionPlan.provider`) / 🚪↔ (le partenaire choisi) |
| **D23** | **Un booking = un colis** en v1. Deux colis = deux réservations | Simplifie code de livraison, litige, notation ; extensible plus tard sans casse si le schéma nomme bien les choses | Friction pour l'Expéditeur multi-colis | 🚪↔ |
| **D24** | **Fuseaux horaires** : chaque horaire est **local à son aéroport** (convention aérienne). Schéma : + `originTimezone` / `destinationTimezone` (IANA, dérivés des lat/lng via Google Time Zone API) + `departureAtUtc` / `arrivalAtUtc` calculés. **Tout ce qui compare au temps réel (crons, countdowns, isTripPastDeparture) utilise l'UTC** ; tout affichage utilise le local + mention du fuseau | Sans ça, le cron complete-trips ferme un trajet Paris→New York avec 6 h d'erreur ; les countdowns 24 h / J+4 seraient faux | Deux champs de plus, un appel API à la création | 🚪→ |

## 2.5 Sécurité, conformité, confiance

| ID | Décision | Pourquoi | Compromis assumé | Porte |
|---|---|---|---|---|
| **D4** | **Sécurité by design (B1)** : toutes les limites revalidées **côté serveur** (tentatives, régénérations, fenêtres — le front n'est qu'indicatif) ; code bcrypt jamais dans les payloads carrier ; autorisations **par rôle et par champ** dans les DTOs ; idempotence des transitions ; horodatage serveur | De l'argent séquestré + un code de livraison = surface d'attaque réelle | Néant — c'est le métier | 🚪→ |
| **D7** | **Admin de niveau pro dès le chantier C** : app séparée (`apps/admin-ui`), **2FA TOTP obligatoire**, sessions courtes, **audit log de chaque action admin** (consommateur Kafka) | La surface la plus sensible du système (qui tranche les litiges, qui voit tout) ; « qui a fait quoi » est exigible en cas de contestation | Friction de login pour l'admin | 🚪→ |
| **D9** | **Politique de conformité colis illicite** — le risque existentiel du métier : inspection au pickup érigée en rituel (« j'ai vu le contenu ouvert, il correspond » ; colis non scellé jusqu'au pickup, scellé devant le Voyageur) ; **liste des interdits en dur dans le wizard** (stupéfiants, batteries lithium seules, liquides, espèces, médicaments — règles IATA) + attestation Expéditeur horodatée ; **Stripe Identity pour l'Expéditeur** (pas seulement le KYC Connect du Voyageur) ; **plafonds** (valeur déclarée, poids, envois/mois compte neuf). Document dédié : `POLITIQUE-CONFORMITE-YAMBA.md` (à rédiger, tâche de fond) | Un colis de stupéfiants transporté par un Voyageur de bonne foi = prison pour lui, une du journal pour Yamba. Aucun tuto e-commerce ne couvre ce risque ; il est propre au métier. L'assureur (D22) exigera ces contrôles | Friction à l'inscription Expéditeur (Identity) ; à doser | 🚪→ |
| **D12** | **RGPD by design (schéma B1)** : rétention définie par type de donnée, champ de consentement, procédure d'effacement. Attention particulière : le téléphone du **destinataire** (personne qui n'a jamais consenti), les photos, les CNI via Stripe Identity | Rattraper le RGPD après coup = refonte de schéma ; le destinataire est un tiers, cas juridiquement sensible | Un peu de modélisation en plus | 🚪→ |
| **D26** | **Modèle `Report` générique dès B1** : `targetType` (TRIP / USER / futur MESSAGE), `reason` (enum), description, reporter, statut de traitement. Front : bouton discret + modal sur page trajet publique et profil membre. File de traitement dans l'admin | Brique modération manquante ; alimente l'admin (C) et la conformité (D9) ; un seul endpoint pour tous les signalements | Néant | 🚪→ (modèle) |
| **D27** | **Politique de session** : (a) timeout d'**inactivité** côté serveur — `lastActivityAt` en Redis, `/auth/refresh` refuse au-delà du seuil (configurable par env, cible 30-60 min) ; (b) **durée de vie absolue** de session (30 jours max) ; (c) **ré-authentification pour les actions sensibles** (« sudo mode » : IBAN/Stripe, email, mot de passe). Front : déconnexion propre + modal d'avertissement avant expiration | Bug actuel : rotation du refresh token = session infinie. Le curseur inactivité est un arbitrage sécurité/conversion réglable | Reconnexions plus fréquentes | 🚪→ (le mécanisme) / 🚪↔ (les seuils) |

## 2.6 Produit & expérience

| ID | Décision | Pourquoi | Compromis assumé | Porte |
|---|---|---|---|---|
| **D5** | **Analytics = PostHog** (self-hostable, souveraineté des données) + **`viewsCount` réel via Redis `SETNX`** (dédup user/IP + jour) dans GET /trips/:id public | Kafka n'est pas l'outil de l'analytics produit ; PostHog donne funnels/conversion sans backend ; viewsCount = micro-PR d'une demi-journée | Un outil de plus | 🚪↔ |
| **D28** | **Wording des statuts trajet** : `PUBLISHED` → **« En ligne »** (EN « Online »), `PAUSED` → **« Masqué »** (EN « Hidden »). Les enums DB ne bougent pas | Les statuts doivent décrire l'effet pour l'utilisateur (« visible des Expéditeurs »), pas la mécanique. Grâce au chantier i18n : **éditer 2 JSON, zéro code** — premier dividende concret de la migration | Néant | 🚪↔ |
| **D29** | **Réputation & score — deux objets séparés.** ① **Réputation visible** : faits explicables que l'utilisateur contrôle (note B5, deals complétés, taux d'annulation post-acceptation, délai de réponse, ancienneté, identité vérifiée), présentés en **badges + statistiques** — jamais de note globale opaque. Niveaux publics : Nouveau / Confirmé / Top Yamber (critères affichés) ; miroir Expéditeur (« Expéditeur fiable »). ② **TrustScore interne** (invisible) : litiges perdus, écarts de poids répétés (PRC-07 = signal fraude), annulations tardives, vélocité anormale, signalements — usages : plafonds progressifs CNF-06, priorisation de la file de revue, aide à la décision admin. **Garde-fous** : humain dans la boucle pour toute sanction (SIG-03 + RGPD décisions automatisées), traçabilité par événements Kafka. **Signaux exclus des deux objets** : fréquence de connexion, volume brut de trajets (présence ≠ fiabilité ; ne récompenser que des issues coûteuses à falsifier) | Le score opaque à la Uber génère anxiété et contestation ; le signal comportemental doit servir le contrôle du risque, pas l'engagement artificiel. Matière première gratuite via D2 dès B1 | Deux systèmes à maintenir au lieu d'un | 🚪→ (la séparation) / 🚪↔ (les pondérations) |
| **D30** | **Stratégie de tests proportionnée, dès B1.** ① **Unitaires sur la logique pure** (Jest via @nx/jest, déjà configuré) : state machines (la table §2.2 = le plan de test), moteur de pricing (PRC), matrice d'annulation (ANN-01), compteurs/fenêtres. ② **Intégration sur les endpoints critiques** (supertest + mongodb-memory-server ; Stripe remplacé par un fake via l'interface PaymentProvider — dividende D11) : accept/decline, deliver (bcrypt + verrou), vues par rôle, concurrence capacité (CAP-01). ③ **Exclusions assumées v1** : tests de composants React (couverts par tsc + i18n CI), E2E Playwright (jalon pré-launch uniquement). ④ **Definition of Done** : toute PR touchant state machine / argent / règles ANN-CAP-PRC livre ses tests dans la même PR. ⑤ Job `tests` ajouté à la CI (checks requis). Rétrofit minimal : PR `test/trip-state-machine` (logique pure existante, ~1 session courte) | De l'argent séquestré sans tests = roulette ; les tests naissent avec le code (coût minimal) au lieu d'être rétrofités (coût maximal) | +10-15 % sur les chantiers B (absorbé dans les fourchettes réalistes) | 🚪↔ (l'outillage) / 🚪→ (la DoD) |
| **D31** | **Le gate Stripe/profil migre de la PUBLICATION vers l'ACCEPTATION.** Le KYC (~5 min, incompressible légalement) se demande au moment où l'argent est réel (« 66 € t'attendent, finalise pour accepter »), jamais avant la première preuve de valeur, jamais après la capture (on ne capture pas vers qui on ne sait pas payer). Pattern Airbnb/BlaBlaCar ; RIB + virements manuels = exercice illégal de services de paiement (DSP2/ACPR) → Stripe Connect Express confirmé (D11), `PaymentProvider` abstrait en B2 ; seule variable : le MOMENT. Compromis : trajets publiés par des Yambers non finalisés (mitigé : expiration 24 h + OnboardingBanner + cron relance + PostHog jalon 2). Implémentation : micro-PR dédiée (déplacer les 2 checks du controller) + l'accept B2 — HORS refonte pricing | Conversion supply : la démonstration involontaire de PR-A (une offre tarifaire complète refusée à la publication pour cause de KYC) est la munition | Fenêtre de trajets « non finalisés » à surveiller | 🚪→ |
| **D32** | **Plancher de facturation par colis (PRC-06).** Le coût réel du Voyageur pour un colis léger n'est pas le poids mais le **temps** (rendez-vous de remise, remise à l'arrivée, responsabilité). Deux paramètres serveur (§13) : **poids facturable minimum = 0,5 kg** (standard courrier/express) et **prix minimum par colis = 8 €** ; le plus élevé s'applique : `transport = max(max(poidsDéclaré, 0,5) × €/kg, plancher)`. Ex. à 12 €/kg : passeport 0,1 kg → 0,5 × 12 = 6 € → **8 €** ; livre 1,2 kg → 14,40 €. Affiché honnêtement : Expéditeur « Colis léger : minimum 8 € », Voyageur « Aucun colis ne te rapporte moins de 8 € ». Le plancher est du **transport** (net Voyageur) — la commission D16 s'applique dessus, pas à la place. Implémentation : **PR-C** (calcul côté Expéditeur) + snapshot de prix deal-service (D17) ; valeurs ajustables sans redéploiement | Sans plancher, une enveloppe à 12 €/kg vaut 1,20 € : aucun Yamber ne se déplace, l'offre se vide sur les petits objets — pourtant les plus rentables au kilo (arbitrage S/M/L sans XS, A28) | Un colis très léger paie « plus que son poids » : assumé, expliqué à l'écran | 🚪→ (existence du plancher) / 🚪↔ (les valeurs) |
| **D33** | **Comparabilité des offres en recherche (colis de référence 2 kg).** Deux moteurs coexistent (A28) et sont incomparables tels quels (15 € le colis vs 12 €/kg). On dénormalise sur le Trip `comparablePriceCents` = **coût de transport d'un colis de référence de 2 kg** : PER_KG → `max(2 × pricePerKgCents, plancher D32 800)` ; legacy → `minPriceCents`. Le tri « Prix le plus bas » trie sur ce champ (libellé « pour un colis de 2 kg ») et n'exclut plus les trajets au kilo. Le **filtre catégorie legacy est remplacé par un filtre FAMILLE** (D14) : un trajet est exclu s'il **refuse** la famille demandée ; les trajets legacy (sans familles) passent. Les facettes exposent le compte par famille ; les filtres à compte 0 sont masqués. Recalcul à chaque écriture (create/update/publish) via un helper pur ; backfill unique des trajets existants | Sans ça, la recherche cache les trajets au kilo dès qu'on filtre ou trie par prix — le nouveau moteur serait invisible | Le « 2 kg » est un choix d'ancre (mockup : colis 2,5 kg S) — paramètre serveur §13 candidat | 🚪↔ (le poids de référence) / 🚪→ (l'existence d'un prix comparable) |
| **—** | **Espagnol (3e langue)** : l'ajout devient le **critère de fin** du chantier i18n. Une fois toutes les migrations faites : PR `feat/locale-es` = 22 namespaces traduits + `"es"` dans routing.locales, zéro code. (À mûrir : le portugais — Angola, diaspora lusophone — pourrait servir le corridor avant l'espagnol) | Ajouter l'espagnol maintenant produirait une expérience trouée (clusters non migrés en FR) ; l'objectif force à finir la dette | L'espagnol attend la fin des migrations | 🚪↔ |
| **—** | **SavedRoutes = arme anti-liquidité** : CTA « Créer une alerte » sur la page Alertes route ET sur l'état vide de la recherche (« Aucun trajet ? Sois prévenu dès qu'un Yamber en publie un »). **Page destinataire** (lien SMS sans compte, suivi + « vous aussi, envoyez ou transportez ») = canal d'acquisition dormant des deux côtés du corridor | Une marketplace meurt du frigo vide ; l'Expéditeur qui trouve zéro trajet ne revient jamais ; le destinataire vit l'expérience sans être converti | Petites PRs front | 🚪↔ |
| **—** | **Supply-seeding au lancement** (ops, pas code) : recruter à la main 20-30 voyageurs réguliers du corridor avant d'ouvrir la demande | La liquidité avant les features | Effort terrain | — |


---

# 2bis. Registre des arbitrages de chantier (A-series)

> Les décisions **D** fixent le cap (§2) ; les arbitrages **A** sont les choix d'implémentation gravés en cours de chantier, validés par Telama en session. Même règle : toute divergence future s'arbitre contre ce tableau, puis s'y répercute. Colonne « PR » = où l'arbitrage est né. Sources consolidées : handoffs B1-PR1-PR2 §3 (A1–A11), B1-PR3 §3 (A12–A22), B1-PR4 §3 (A23–A24) — exhaustivité vérifiée (11+11+2 = 24, sans trou).

## 2bis.1 — Session B1-PR1/PR2 (modèle & machine) — A1→A11

| # | Arbitrage | Pourquoi | Compromis | PR |
|---|---|---|---|---|
| A1 | Capacité kg : `Trip.capacityKg` + `reservedKg` compteur atomique ; `remainingKg` toujours DÉRIVÉ, jamais stocké | Invariant vérifiable (`reservedKg === Σ kg des bookings actifs`) ; un champ stocké de plus = une désynchronisation de plus | Un calcul à chaque lecture | #71 |
| A2 | Montants monétaires : `Int` centimes, JAMAIS de Float | Le flottant monétaire produit des erreurs d'arrondi ; les centimes entiers sont exacts par construction | Conversions d'affichage côté front | #71 |
| A3 | `PricingSnapshot` agnostique au moteur (discriminé PER_CATEGORY / PER_KG) | Un changement de moteur de prix (D13) ne migrera JAMAIS les snapshots existants — l'immuabilité D17 tient dans le temps | Deux formes à savoir afficher | #71 |
| A4 | **B1 sans création de deal** (aucun POST) | L'invariant « PENDING ⇒ paiement autorisé » ne doit jamais être violé, même en dev ; la création naît en B2 avec le PaymentIntent | Le front s'appuie sur le seed (A14) en attendant | #71 |
| A5 | Découpage B1 : 4 PRs backend + 1 PR front (PR5) | Chaque PR reste relisible et mergeable seule ; livraison = PR mergée | Plus de rituel git | — |
| A6 | Nom Nx scopé `@yamba-app/deal-service` | Cohérence de nommage du monorepo | Harmonisation des anciens noms au backlog | #70 |
| A7 | Tracking HORS state machine (séquenceur dédié `canConfirmTrackingStep`) | Les jalons AT_AIRPORT→FLIGHT_DEPARTED→FLIGHT_ARRIVED sont une séquence, pas des états du deal : les mélanger gonflerait la machine | Deux mécanismes à documenter | #71 |
| A8 | Machine à ACTEURS (from×action×acteur) + effets déclarés EN DATA | Un `cancel` SHIPPER ≠ un `cancel` CARRIER (ANN-01 vs ANN-02) ; les effets en data sont testables et exécutables par les writers B2 sans réécriture | Table de transitions plus grande (188 tests l'encadrent) | #71 |
| A9 | Réputation = EXTENSION du modèle `Review` existant (B5), pas de modèle parallèle | Une seule source d'avis ; D29 s'appuie dessus | Piège noté : index unique sur `bookingId` nullable (Mongo P2002) — index partiel ou unicité service | #71 |
| A10 | `Dispute` modèle en B4 ; `Report` livré dès B1 | Le signalement (SIG) est transverse et immédiat ; le litige exige la matrice de médiation (chantier C) | DISPUTED terminal en v1 | #71 |
| A11 | Divergence CONSTATÉE : `SiteConfig.commissionRate` 0.10 ≠ D16 (12 % + plancher 300 cents) → correction gravée pour B2 | On ne corrige pas un paramètre monétaire en passant ; la correction voyage avec les writers B2 qui le consomment | Divergence vivante jusqu'à B2 — documentée ici pour ne pas devenir invisible | #71 |

## 2bis.2 — Session B1-PR3 (lecture & contrats) — A12→A22

| # | Arbitrage | Pourquoi | Compromis | PR |
|---|---|---|---|---|
| A12 | Route carrier = `GET /deals?tripId=` côté deal-service ; ownership par lecture Prisma READ-ONLY du Trip (select minimal) | Le domaine deal reste chez le deal-service ; enrichir `GET /trips/:id` aurait fait écrire du deal dans le trip-service | Une frontière de lecture croisée (jamais d'écriture) | #72\* |
| A13 | DTOs par rôle en LISTE BLANCHE stricte (jamais spread+delete). Carrier : jamais code/hash/régénérations ; pricing = gains seulement. Code : bcrypt (validation) + AES-256-GCM `deliveryCodeEncrypted` (ré-affichage shipper, champ B2) ; d'ici là `deliveryCode = null` documenté au contrat | Un spread oublie d'exclure le champ ajouté demain ; la whitelist est spread-résistante (prouvé par test makeLeakyBooking) | Chaque nouveau champ exige un ajout explicite aux DTOs | #72\* |
| A14 | Seed international 6 corridors, idempotence hybride (users upsert / trips+bookings wipe&recreate), reservedKg CALCULÉ (CAP-02), `seed-output.json` gitignoré | Outil de démo/QA permanent + prérequis du branchement front PR5 ; l'international dès le seed = le positionnement universel dans les données de dev | Wipe destructif assumé sur trips/bookings de seed | #72\* |
| A15 | Matrice des 17 notifications GRAVÉE dès PR3 (handoff PR3 §4) ; event keys + payloads Zod dans les contrats | Les contrats d'événements sont une porte 🚪→ : un payload pauvre publié = donnée perdue à jamais | Contrats écrits avant leur premier consumer | #72\* |
| A16 | notification-service DÉDIÉ :6004, livré PR4bis | Premier consumer = frontière de domaine propre (D1), pas un module du deal-service | Un service de plus à opérer | #72\* |
| A17 | PAS de « kafka-service » : le broker est de l'infra ; ce qui s'écrit = le relay (deal-service) + un consumer par service | Un service-bus central recréerait le couplage que D2 supprime | La lib partagée (A24) porte le code commun | #72\* |
| A18 | Roadmap ports gravée (voir §0bis). REFUSÉ : créer des services vides en avance | Réserver les numéros coûte zéro ; des squelettes vides coûtent de la maintenance (pushback accepté) | — | #72\* |
| A19 | BOOKING_ACTIVE/TERMINAL/COMPLETION_BLOCKING_STATUSES vivent dans `@packages/api-contracts` (source unique) ; la machine importe + ré-exporte | trip-service et deal-service consomment les MÊMES ensembles — la recopie aurait divergé | Dépendance contrats ← machine | #72\* |
| A20 | DISPUTED conserve les kg (bloque edit/unpublish) mais NE bloque PAS la complétion du trip → 2e flag ctx `hasBookingsInProgress?` avec REPLI CONSERVATEUR (`?? hasActiveBookings`) | Le voyage physique est fini même en litige ; le repli fait qu'un appelant non recâblé retrouve l'ancien comportement — sans information, choisir l'erreur la moins grave | Deux flags proches à ne pas confondre (4 tests les gardent) | #72\* |
| A21 | Sémantique d'erreurs propre dès le jour 1 au deal-service : 400 validation seule, 403 ForbiddenError, 404 NotFoundError — « pas partie au deal » = 403, pas 404 | Le trip-service traîne un legacy 400-partout (PR `fix/error-semantics` au backlog §7.2) ; le nouveau service ne l'hérite pas | Incohérence temporaire entre services, documentée dans les deux OAS | #72\* |
| A22 | Registre OAS COMMUN assumé : les 2 specs embarquent les 93 mêmes schémas (un seul espace de noms plateforme) | `z.globalRegistry` est global par nature ; un espace de noms unique évite les collisions de `$id` et sert le client mobile généré (G) | Les deux openapi.json bougent ensemble (le diff CI le sait) | #72\* |

## 2bis.3 — Session B1-PR4 (le producteur) — A23→A24

| # | Arbitrage | Pourquoi | Compromis | PR |
|---|---|---|---|---|
| A23 | **Topologie événementielle** : UN topic par domaine (`booking-events`), jamais par eventType · clé = `aggregateId` · **12 partitions à la création** · rétention 7 j · replay depuis l'outbox MONGO (source de vérité, jamais de delete), jamais depuis Kafka · auto-création interdite côté cluster ET producer | Même clé = même partition = ordre par deal sans ordre global ; augmenter les partitions plus tard changerait le mapping clé→partition (quasi irréversible → pris large d'emblée) ; l'outbox éternel rend la rétention courte sans risque | Kafka n'est pas la source de replay (assumé) ; 12 partitions surdimensionnées au départ | #73 |
| A24 | **Architecture du relay** : lib `@packages/messaging` (interface `EventPublisher`, kafkajs isolé dans UN fichier) · un seul relay actif (RelayLease : CAS atomique, TTL 30 s, heartbeat 1 s) + `OUTBOX_RELAY_ENABLED` · payload = événement COMPLET validé au contrat AVANT publication · header unique `event-id` (= _id row) = clé d'idempotence consumers · at-least-once (publishedAt post-ack, par message) · poison (ZodError ou kafkajs non-retriable HORS connexion) : attempts++, parking à 10, jamais de delete · transitoire : JAMAIS d'attempts++, backoff 1→30 s · boucle setTimeout chaîné, connexion lazy, arrêt propre, timers unref | Le relay publie l'union sans énumérer les types (un 18e event ne le touche pas) ; changer de client Kafka = réécrire un seul fichier, zéro test à toucher ; une panne broker ne doit jamais parquer des événements sains (bug attrapé au smoke réel : kafkajs marque `retriable:false` ses pannes de connexion épuisées) | Polling 1 s (latence acceptée vs CDC/change streams) ; une table de bail de plus | #73 |

*\* #72 : numéro de la PR3 à confirmer (§7.2).*

---

# 3. Roadmap maîtresse

## 3.0 Les trois jalons

| Jalon | Nom | Critère de sortie | Contenu |
|---|---|---|---|
| **1** | **Boucle transactionnelle** | Un Expéditeur réserve, paie, fait livrer, note — de bout en bout, en conditions réelles Stripe test | B1 ✅ (fondations) → PR4bis (notification-service) → PR5 front (listes réelles) → refonte pricing front → B2 (argent entrant) → B3 (transport) → B4 (argent sortant) → B5 (confiance) |
| **2** | **Plateforme opérable** — *constitutif du lancement public* | Telama peut opérer seul : arbitrer un litige, vérifier un billet, ajuster un paramètre, voir une erreur avant l'utilisateur | **C admin-ui** (médiation YAM-XXXX, file Reports, paramètres audités, TrustScore D29②, 2FA TOTP) · E profil public Voyageur · solde session auth (SES-03/04/05) · micro-PRs confiance (Signaler, wording D28, CTA alertes, page destinataire) · Sentry front+back · PostHog · vérification backups Atlas |
| **3** | **Expansion** | Le playbook corridor est réplicable et l'expérience s'étend | F chat (message-service :6005) · locales ES puis PT (critère de fin i18n) · G mobile (client généré depuis l'OpenAPI, D3) · H recommandations (l'outbox D2 capture l'historique depuis B1 précisément pour ce replay) |

Le lancement public = **fin du jalon 2**. L'admin-ui n'est pas un confort d'après-lancement : c'est l'organe de conformité (D9), de médiation (D21/D26) et de pilotage sans lequel le jalon 1 est une boucle qu'on ne sait pas tenir.

## 3.1 Chantiers séquencés

| # | Jalon | Chantier | Contenu | Dépend de | Décisions consommées |
|---|---|---|---|---|---|
| **-1** ✅ | — | **CI** (PR #63) | GitHub Actions : tsc, JSON parse + miroir FR/EN, anti-fuite — devenue 11 checks (tests, contrats OAS) | — | D10 |
| **-1bis** ✅ | — | **PR session auth** | Inactivité serveur + durée absolue livrées ; solde SES-03/04/05 au jalon 2 | — | D27 |
| **0** ✅ | — | **OpenAPI** | OAS 3.1 depuis Zod — trip-service fait ; conversion auth-service au backlog (§7.4) | — | D3 |
| **0bis** ✅ | — | **Mockup pricing** | Arbitrages D13/D14/D16/D20 rendus sur pièce | — | D13-D16, D20-D22 |
| **B1** ✅ | 1 | **deal-service — fondations** (PR #70, #71, #72\*, #73+#74) | Modèle Prisma Booking (snapshots, fuseaux, RGPD, capacité, protectionPlan), state machine (188 tests), GET par rôle (DTOs whitelist A13), `hasActiveBookings()` branché (A20), contrats + 17 événements (A15), outbox + relay Redpanda (A23/A24, 218 tests), modèle Report, template service complet | 0, 0bis | D1-D4, D6, D8, D12, D17-D19, D22-D24, D26 |
| **B1-solde** | 1 | **PR4bis notification-service :6004 + PR5 front** | Premier consumer (dédup event-id, matrice des 17), listes réelles Mes envois / deals Mes trajets (seed A14) | B1 | D2, D8 (A15, A16) |
| **B2** | 1 | **Naissance du deal + argent entrant** | Création depuis wizard, PaymentIntent (autorisation → capture à l'acceptation), accept/decline, cron expiration 24h, remboursements, `PaymentProvider` abstrait, writers outbox EN TRANSACTION, payment-service :6008, media-service :6009 | B1-solde + transactions Atlas prouvées (§7.2) | D11, D16, D20, D21 |
| **B3** | 1 | **Transport** | Pickup (upload R2 + code bcrypt + checklist conformité), refuse, tracking events, deliver (compare + lock serveur), régénération | B2 | D4, D9 |
| **B4** | 1 | **Argent sortant** | Confirmation anticipée, cron J+4 → COMPLETED + `transfers.create()`, dispute avec gel, matrice remboursements | B3 | D21, D22 |
| **B5** | 1 | **Confiance** | Rating double-aveugle, relances J+5/J+7, **stats de réputation visibles** (D29①) — le notification-service est déjà né en PR4bis | B4 | D2, D29 |
| **C** | 2 | **admin-ui** | Médiation litiges (tickets YAM-XXXX), vérification billets, file des Reports, gestion users, **paramètres plateforme** (curseurs du mockup, audités), **TrustScore interne + plafonds progressifs** (D29②). Login séparé, 2FA TOTP, audit log | B4 | D6, D7, D26, D29 |
| **E** | 2 | **Profil public Voyageur** | Page publique (stats réelles, trajets, avis) + Shop-preview équivalent | B1 (stats), B5 (avis) | — |
| **F** | 3 | **message-service** (chat) | Socket.io + persistance Mongo + événements → notifications. Coordination pickup Expéditeur↔Voyageur | B (utile dès ACCEPTED) | D2 |
| **G** | 3 | **Mobile** | App consommant le gateway, client généré depuis OpenAPI | B, D3 | D3 |
| **H** | 3 | **Recommandations ML** | « Trajets pour toi », matching SavedRoutes intelligent — sur les données collectées (Kafka + PostHog = collecte gratuite) | post-lancement, volume | D2, D5, D15-V2 |

## 3.2 En continu (au fil de l'eau, entre les lots)

- **PRs i18n restantes** : dashboard sections (dissolution dashboard.copy.ts), booking, trips/create, page publique (LocationsCard → namespace tripDetail), divers, suppression UiPreferencesProvider → **critère de fin : PR `feat/locale-es`** (jalon 3), puis PT.
- **Micro-PRs front (jalon 2)** : wording statuts (D28 — 2 JSON), bouton Signaler (trajet + membre), CTA alertes (page + empty state recherche), page destinataire.
- **Micro-PR backend** : viewsCount Redis (D5).
- **Intégrations (jalon 2, constitutives du lancement)** : PostHog, Sentry (front + back), vérification backups MongoDB Atlas.

## 3.3 Flux « Telama seul » (chemin critique potentiel — échéances réelles)

- 📅 **Septembre 2026 — le plus urgent** : dossiers **Station F** et **Paris&Co** · dossier **Bourse French Tech** · prêt d'honneur (Réseau Entreprendre / Initiative France).
- `POLITIQUE-CONFORMITE-YAMBA.md` (D9) — alimenté par les questionnaires assureurs.
- Prise de contact avec 2-3 acteurs d'embedded insurance (Wakam, Owen, Qover, bsurance — D22).
- Étude tarifs corridor GP (seed base_corridor D15).
- Préparation supply-seeding (20-30 voyageurs réguliers avant d'ouvrir la demande).

## 3.4 Prochaines actions immédiates (ordre d'exécution)

1. Solder §7.2 lignes bloquantes : **transactions Atlas** (prérequis B2, reporté deux fois) + idempotence seed + required checks + user.email.
2. **⭐ PR4bis `feat/notification-service`** — session dédiée, prompt prêt (handoff PR4 §7) ; architecture consumer à trancher AVANT le code (A25 pressenti : cohabitation trip-notifications.service.ts).
3. **PR5 front** — listes réelles (ferme B1).
4. Refonte pricing front (create-trip, wizard) puis **B2**.

---

# 4. Estimation & vélocité

## 4.1 Méthode (inchangée)

- **Unité : la session de travail** (un bloc Telama + Claude livrant 1 à 3 PRs mergées) — pas le jour-homme, pas le story point.
- **On estime des PRs, pas des chantiers** : un chantier = somme de PRs nommées ; ce qu'on ne sait pas découper, on ne sait pas l'estimer.
- **Fourchette optimiste / réaliste** (réaliste ≈ optimiste × 1,5 — absorbe webhooks Stripe récalcitrants, surprises Mongo).
- **Ré-estimation à chaque handoff** : suivi PRs prévues vs livrées + recalibrage du restant. Le cône d'incertitude se resserre à mesure qu'on avance.

## 4.2 Vélocité mesurée (historique consommé au 21 juillet 2026)

| Période | Chantier | Estimé (réaliste) | Réel |
|---|---|---|---|
| Pré-roadmap | Trip lifecycle, i18n trips, dashboard, hotfixes, gouvernance v1.1 | — | **≈ 5 sessions** (hors décompte roadmap) |
| Roadmap | CI (D10) | 0,5 | ≈ 1 (dette d'installation npm soldée, non récurrente) |
| Roadmap | Mockup pricing + arbitrages (0bis) | 1,5 | ≈ 1 |
| Roadmap | OpenAPI (0) complet | 2,5 | ≈ 2 |
| Roadmap | D30 (test/trip-state-machine) + D27 (session auth) | 2,5 | ≈ 1 (session double) |
| Roadmap | **B1** fondations (PR1→PR4 + clôture/consolidation) | 3 – 4,5 | **≈ 4** ✓ dans la fourchette |
| | **Total consommé depuis la roadmap** | | **≈ 9–10 sessions** |

**Recalibrage** : B1 réel ≈ 0,9× de l'estimation réaliste — le premier setup Kafka/outbox (zone de risque identifiée en v1.1) a coûté ce qui était prévu. Les fourchettes réalistes sont MAINTENUES pour B2–B5 ; B2 garde son statut de zone de risque n°1 (Stripe en conditions réelles).

## 4.3 Estimation du restant (hors mobile)

| Chantier restant | PRs | Optimiste | Réaliste |
|---|---|---|---|
| PR4bis notification-service | 1-2 | 1 | 1,5 |
| PR5 front (listes réelles) | 1 | 0,5 | 1 |
| Refonte pricing front (create-trip, wizard, migration enum, i18n) | 3 | 2 | 3 |
| **B2** argent entrant | 2-3 | 2 | 3 |
| **B3** transport | 2-3 | 2 | 3 |
| **B4** argent sortant | 2 | 1,5 | 2,5 |
| **B5** confiance (sans notification-service) | 2 | 1,5 | 2 |
| Micro-PRs continu | ~5 petites | 1,5 | 2,5 |
| **→ Fin jalon 1 (boucle transactionnelle)** | **~15 PRs** | **≈ 12** | **≈ 18,5** |
| C admin-ui | 3-4 | 3 | 4,5 |
| E profil public Voyageur | 1-2 | 1 | 2 |
| Solde session auth (SES-03/04/05) | 1 | 0,5 | 1 |
| Sentry + PostHog + micro-PRs confiance | 2-3 | 1 | 1,5 |
| **→ Fin jalon 2 = LANCEMENT PUBLIC** | **~23 PRs** | **≈ 17,5** | **≈ 27,5** |
| F chat · i18n restant + ES · PT | 8-9 | 6,5 | 10 |
| **→ Jalon 3 web (hors mobile G, estimé après B5)** | | **≈ 24** | **≈ 37,5** |

**Traduction calendaire** (à 3-4 sessions/semaine) : fin du jalon 1 ≈ **3 à 6 semaines** · **lancement public (fin jalon 2) ≈ 5 à 9 semaines** — compatible avec les échéances de septembre du flux « Telama seul » (§3.3) à cadence tenue. Le mobile (G) est un chantier d'ampleur comparable à lui seul — estimation sérieuse après B5, quand l'OpenAPI sera stable.

## 4.4 Limites et risques de l'estimation

1. **Ne couvre que le code.** Les flux « Telama seul » (§3.3) courent en parallèle et peuvent devenir le chemin critique — les échéances de septembre sont fixes, elles.
2. **Zones de risque planning** : **B2** (Stripe en conditions réelles — webhooks, échecs de capture, comptes de test Connect) et la **dette bloquante des transactions Atlas** (§7.2 — reportée deux fois, à prouver AVANT d'écrire le premier writer).
3. **Auto-correction** : la vélocité B1 (≈ 0,9×) valide la méthode ; chaque handoff recalibre.

---

# 5. Conventions de travail

Français · pédagogie **Quoi/Pourquoi/Vérification** à chaque tâche · architecture discutée et validée avant le code · mockup HTML interactif avant l'implémentation pour les décisions UX · livraison = PR **mergée** dans `dev`, numéro NOTÉ au handoff · fichiers complets, lots de 4-6 avec « ok » (volumineux : téléchargeables) · attendus COMPTÉS (`wc -l`, checks CI, opérations OAS) · rituel automatisé par la CI (D10), localement `npm ci` si les deps ont bougé · `npx nx` jamais global · tsc via `apps/<app>/tsconfig.app.json` · tests dans la même PR (D30) · surfaces publiques en anglais, docs internes en français · chaque décision livrée avec son pourquoi et son compromis · chaque session se termine par un handoff incluant le suivi de vélocité (§4) et le prompt prêt-à-coller de la session suivante.

---

# 6. Leçons capitalisées (fusion de tous les handoffs — v1.3)

> Une leçon entre ici quand un incident RÉEL l'a produite. Elle n'en sort jamais ; elle se durcit. Classement par domaine, source entre parenthèses quand l'incident mérite mémoire.

## 6.1 Git & workflow

- **Prouver la branche AVANT d'écrire** (`git branch --show-current`) ; ne jamais brancher depuis une feature branch — toujours depuis `dev` APRÈS merge (brancher d'un état non mergé = cause de régression vécue).
- **`git status --short` AVANT tout `git add -A`** : un fichier collé en avance s'embarque clandestinement (schema.prisma, PR1). Corollaire amend : `--amend` embarque TOUT ce qui est stagé — vérifier le tree d'abord.
- **`git add` sans pathspec ne stage RIEN** — un commit est parti à vide (PR3). Toujours `git add <chemins explicites>` puis `git log --oneline -1` après CHAQUE commit, puis `git log -1 --stat`.
- **`--amend` uniquement sur du non-poussé** ; exception unique : branche non encore en PR, seul dessus, avec `--force-with-lease` (clôture PR4).
- **PRs mergées IMMÉDIATEMENT après push — et le numéro NOTÉ au handoff** (l'oubli a coûté une anomalie « merged 1 commit » à élucider en session suivante : #73 mergée sans trace, clôture PR4).
- **`M` vs `??` dans git status** : M = fichier suivi modifié (un openapi.json régénéré = comportement VOULU du registre commun A22) ; ?? = nouveau.
- **`git config user.email`** se vérifie une fois par machine (un email sans @ a signé des commits).

## 6.2 TypeScript, alias & build

- **`npx tsc --noEmit --project apps/<app>/tsconfig.app.json` = LA source de vérité** — jamais le tsc de l'IDE ; `--project apps/<app>` SANS suffixe résout le tsconfig solution-style (zéro fichier vérifié : un faux vert).
- **TROIS résolveurs d'alias, TROIS configs** (leçon durcie PR4) : tsc (`tsconfig.base.json` paths) ≠ webpack (`webpack.config.js` alias, PAR service consommateur) ≠ jest (préset ; seul `@packages/api-contracts` y est prouvé → mocks `{ virtual: true }` pour les autres dans les specs). Tout nouvel alias = déclaration tsconfig + webpack de CHAQUE consommateur, PROUVÉE avant d'écrire le code qui l'importe.
- **Chemins prouvés, jamais devinés** : `grep tsconfig.base.json` + `ls` en OUVERTURE de session (2 échecs consécutifs sur le layout d'api-contracts, PR3). Réel : `@packages/api-contracts` → `packages/libs/api-contracts/src/`.
- **`npx tsx` ne lit PAS les alias tsconfig** → les scripts (seeds) importent en RELATIF (`../index`, `../../api-contracts/src`).
- **Clonage manuel > générateur Nx** pour l'homogénéité des services (cibles inférées par plugins — AUCUN project.json nulle part) ; `npx nx reset` = premier réflexe sur graphe/serve incohérent ; `npx nx` toujours, jamais global. **Nx Cloud** : la clé `nxCloudId` dans nx.json rend Nx Cloud fatal (exit 1) en CI — supprimée.

## 6.3 Tests & vérifications comptées

- **Tests dans la même PR que leur logique (D30)** — test ROUGE d'abord pour tout nouveau comportement.
- **`wc -l` avec attendu COMPTÉ (jamais estimé) après chaque collage** + `grep -c "^import"` anti-double-collage. Le rituel a attrapé en direct : un fichier non collé (PR3), un 204≠214 (PR4). Compter les opérations d'un OAS au `node -e` sur le JSON, pas de tête.
- **Un « CI Ok » ne vaut que si le check attendu EXISTE : COMPTER les checks** (11 aujourd'hui), pas leur couleur — une CI verte à 10 checks ne testait pas la machine (PR2).
- **Mocks jest de fonctions async = TOUJOURS `mockResolvedValue`** (un `jest.fn()` nu retourne undefined → `.catch` explose → crash des workers) ; toute promesse lancée dans un mock (`stop()`) se capture et s'attend (PR4).
- **Smoke test `nx serve` en fin de lot backend** : attrape les dettes de résolution webpack que tsc ne voit pas.

## 6.4 Infra & runtime

- **`unref()` les timers des boucles de fond** : le serveur HTTP porte la vie du process, jest sort proprement (PR4).
- **`nx serve` avale le SIGINT** : prouver un graceful shutdown via `node apps/<app>/dist/main.js` (PR4).
- **Le rpk embarqué dans l'image Redpanda a des flags RÉDUITS** : pas de `--format json`, pas de `--set` au démarrage — parser la sortie TEXTE ; configs cluster via `rpk cluster config set` (persistées) après démarrage (PR4).
- **kafkajs marque `retriable: false` ses pannes de CONNEXION** une fois ses retries épuisés (`KafkaJSNumberOfRetriesExceeded`) — sans exclusion explicite, une panne broker parquerait des événements sains (attrapé au smoke réel PR4, test de non-régression posé).
- **Docker Desktop doit tourner** : un mur d'ECONNREFUSED = daemon éteint, pas un bug (PR4). **Redis** : clé par session `refresh_jti:{userId}:{jti}`, jamais par user.

## 6.5 Prisma & MongoDB

- **Champ `@unique` nullable Mongo = P2002 sur null** (publicSlug, PR3) : tout @unique optionnel reçoit une valeur déterministe en seed (`seed-<key>`) ; jamais de `@@unique` naïf sur champ nullable (index partiel raw ou unicité service — noté pour Review B5, A9).
- **Prisma `in:` exige un tableau mutable** → `[...READONLY_CONST]`.
- **Import Prisma des services** : `import prisma from "@packages/libs/prisma"` (les seeds : relatif, cf. §6.2/tsx). Schéma : `prisma/schema.prisma` (RACINE).
- **Transactions multi-documents ≠ writes** : un seed qui tourne prouve les writes, JAMAIS les transactions (`session.startTransaction()` en mongosh = la preuve) — reporté deux fois, bloquant B2.

## 6.6 Sécurité

- **Anti-fuite avant chaque push** : `git ls-files | grep -iE "\.env|secret"` — JAMAIS `--others` (liste les ignorés → faux positifs effrayants).
- **DTOs par rôle = listes blanches spread-résistantes** (A13) — jamais spread+delete ; prouvé par test d'intrusion (makeLeakyBooking).
- Backlog vivant : redaction pino-http (`req.headers.cookie`, `req.headers.authorization` via option `redact`).

## 6.7 Front & Next.js

- **Props callback des composants `"use client"` : suffixe `*Action`** (convention App Router, évite TS71007).
- **`overflow-x: clip` (pas `hidden`)** pour préserver `position: sticky`.
- Frontière i18n : `isFr={locale==="fr"}` uniquement à la frontière, maps statiques enum→clé, jamais de ternaire de locale dans les composants.

## 6.8 Méthode de session

- **Architecture validée AVANT le code** ; maquette HTML interactive avant toute décision visuelle ; lots de 4-6 avec « ok » ; fichiers complets (éditions chirurgicales UNIQUEMENT pour les fichiers non transmis, avec before/after exacts + grep de vérification — zéro incident depuis PR3).
- **Les corrections de Telama font foi** (paths réels, schéma réel, comportement observé) — le handoff suivant les grave (§4 « corrections » du handoff PR4 = le modèle, désormais §0bis de ce registre).
- **Transfert de fichiers** : coller dans le message ou upload classique (pièces jointes « document » parfois vides) ; renommer les homonymes.
- Handoff + vélocité en fin de session, prompt prêt-à-coller pour la suivante.

---

# 7. Backlog maître (statuts au 21 juillet 2026)

> ✅ livré/prouvé · 🔄 en cours ou partiellement prouvé · 🔲 à faire · ⚠️ = bloquant pour le chantier indiqué. Le flux « Telama seul » vit en §3.3.

## 7.1 Chemin principal (jalon 1)

| Statut | Item | Note |
|---|---|---|
| ✅ | B1-PR1 squelette (#70) · PR2 modèle+machine (#71) · PR3 lecture+contrats (#72\*) · PR4 relay (#73+#74) | 218 tests, chaîne prouvée jusqu'à Redpanda |
| 🔲 | **⭐ PR4bis notification-service :6004** — premier consumer (A16) | Session dédiée, prompt prêt (handoff PR4 §7) |
| 🔲 | PR5 front — listes réelles (Mes envois, deals Mes trajets) consommant le seed A14 (`seed-output.json`) | Ferme B1 |
| 🔲 | B2 argent entrant — writers outbox EN TRANSACTION, PaymentIntent, accept/decline, cron 24 h, payment-service :6008, media-service :6009, champs différés (`cancelReason`, `pickupRefusalReason`, `deliveryCodeEncrypted` A13), **commissionRate 0.12 + plancher 300 (A11/D16)**, emails transactionnels Stripe (#2, #7, #14 de la matrice A15) | ⚠️ prérequis §7.2 ligne 1 |
| 🔲 | B3 transport · B4 argent sortant · B5 confiance (rating, relances, stats D29①) | Séquence gravée §3.1 |

## 7.2 Dettes techniques (aucune ne doit devenir invisible)

| Statut | Item | Note |
|---|---|---|
| 🔄 | **⚠️ B2 — Transactions multi-documents Atlas : REPORTÉ DEUX FOIS.** Preuve exigée : `session.startTransaction()` en mongosh (le seed ne prouve que les writes) | Prérequis ABSOLU des writers B2 |
| 🔄 | Idempotence seed-deals au 2e run (wipe attendu : 20 bookings, 7 trips) | Reporté, 5 min |
| 🔲 | Redaction pino-http : `req.headers.cookie` + `req.headers.authorization` (option `redact`) | Sécurité, micro-PR |
| 🔲 | seed-deals : booking …ef45 a `shipperId === carrierId` (auto-expédition) — bug de seed si la règle métier l'interdit (à trancher) | Curiosité gravée PR4 |
| 🔲 | `chore/deps` : **43 vulnérabilités npm** (dont 6 critiques) — PR dédiée, JAMAIS `npm audit fix --force` en pleine PR · Prisma 6→7 idem | Chantier hygiène |
| 🔄 | `git config user.email` (`egoiomab.com`, @ manquant) | 10 secondes |
| 🔲 | Required checks : confirmer TypeScript (deal-service) dans Settings → Branches ; confirmer le numéro de la PR3 (#72 ?) dans Pull requests → Closed | Cf. §0bis |
| 🔲 | PR `fix/error-semantics` trip-service (400-partout → 404/401/403, impact front) — le deal-service est déjà propre (A21) | Porté au registre ✓ |
| 🔲 | Cleanup post-pricing : `maxSlots`/`bookedSlots` dépréciés, `WITH_INTERMEDIATE_STOPS`, types `handoffMoments`/`pickupMoments`, harmonisation `dark:bg-slate-950`→`900` | PR mécanique |
| 🔲 | Micro-PR `getImageKit()` paresseux (bloque `nx serve trip-service` sans env) · `AddDocumentsBody` en Zod dédié · harmonisation noms projets Nx · audit anglais OAS trip | — |

## 7.3 Front user-ui (haute priorité, hors B-chantiers)

| Statut | Item |
|---|---|
| 🔲 | `<Toaster />` (Sonner) au layout racine · `OnboardingBanner` après Header · cron onboarding-reminder démarré (branchement main.ts auth + `node-cron` à installer) · page carrier settings (Stripe) · test du flow complet |
| 🔲 | Priorité moyenne : page profil carrier public · formulaire création trajet (refonte pricing D13-D16, 3 PRs estimées) |

## 7.4 Auth & sessions (D27, solde — jalon 2)

🔲 SES-03 sudo mode · SES-04 modal front expiration · SES-05 liste des sessions (record prêt) · PR cleanup sessions legacy (≤30 j post-prod) · conversion OpenAPI auth-service (contrats Zod, swagger retiré) + `/docs` Scalar · page `/docs` d'index gateway (basse)

## 7.5 En continu (repris §3.2)

🔲 PRs i18n restantes (critère de fin : `feat/locale-es`, puis PT — jalon 3) · micro-PRs confiance (wording D28, Signaler, CTA alertes, page destinataire — jalon 2) · viewsCount Redis (D5) · PostHog + Sentry + vérif backups Atlas (jalon 2, constitutifs du lancement)
