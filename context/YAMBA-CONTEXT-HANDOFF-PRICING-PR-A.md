# YAMBA — CONTEXT HANDOFF · Refonte pricing PR-A « le socle » — MERGÉE (#77)
### Août 2026 · `70f060b` · Le backend du mockup est prêt, zéro pixel touché

---

## §1 — Vérifications d'ouverture de la PROCHAINE session

- [ ] **Le quatuor GitHub fugitif** (reporté N fois, 2 min chrono) : checks **#76 __/13** · checks **#77 __/13** · required checks de `dev` (ajouter TypeScript+Tests notification-service, confirmer TypeScript deal-service) · titre de la **PR #72**
- [ ] `npx nx test trip-service` (**157**) + deal (**218**) + notification (**21**) depuis `dev` post-#77 — plateforme attendue : **396**
- [ ] **RE-SYNCHRO GitHub du project knowledge** (copie pré-#77 : ni le gate ni les contrats PER_KG)
- [ ] Purge du project knowledge (note mémoire, reportée depuis PR4bis)
- [ ] `git status --short` propre (les scripts de preuve sont VERSIONNÉS désormais — acté)

## §2 — Livré et PROUVÉ (PR #77, 6 commits)

| Commit | Contenu | Preuve |
|---|---|---|
| `a497afb` | **Schéma** : Trip gagne `pricePerKgCents`, `checkedBag23PriceCents`, `cabinBag12PriceCents`, `familyConditions` (+ enums `ParcelFamily` ×8, `FamilyConditionMode`, type `TripFamilyCondition`) — `categoryConditions` legacy INTOUCHÉ (coexistence A28) | validate · generate · push in-sync · 149 tests trip |
| `e19d06d` | **Contrats** : `trip-pricing.schema.ts` (familles CAT-02, condition avec superRefine SURCHARGE⇒pct, spread `tripPerKgPricingFields`) étalé sur read/create/public + note `minPriceCents` (choix 4 : PER_KG exclu du tri lowestPrice, moteurs incomparables) — **registre 96→99 ×3** (A22) | tsc · generate ✅✅✅ |
| `4417a10` | `capacityKg` (saisie Voyageur, dans le spread) + `reservedKg` (compteur serveur, read/public SEULEMENT — jamais en entrée) | 99 ×3 stables |
| `a386a98` | **LE GATE (A28)** : `pricing-gate.ts` PUR (`resolvePricingEngine` : PER_KG si prix>0 ET capacité>0, prime sur legacy ; PER_CATEGORY si conditions ; null = refus, message unique) + **8 specs** + branché sur LES DEUX chemins (publishTrip l.883, updateTrip publish=true l.348, valeurs effectives `updateData ?? trip`) | **157 verts** · grep 6 lignes |
| `f50578d` | Le schéma de validation INTERNE du service (fichier historique, doublon assumé chantier 0) étendu : les 5 champs traversent create+update — **la serrure a sa clé** (sans ça, silencieusement filtrés) | tsc · 157 |
| `22ce8bb` | **Seed** : trip `bzv-perkg` (Thomas, Paris→Brazzaville J+15 : 11,50 €/kg · 23 kg · électronique +20 % · alimentaire REFUSÉ · bagage 23 kg 230 €) — la matière de QA de PR-B, vierge de bookings | rerun 8 trips · findFirst : 1150/23/23000 + 2 conditions exactes |

**Preuve API du gate — partielle et ELLE-MÊME instructive** : login Thomas ✓, unpublish ✓ (200), publish → **400 « Carrier profile must be completed »** — le gate PROFIL/Stripe historique intercepte AVANT le nôtre. Le gate pricing reste prouvé par ses 8 unitaires + le câblage ; et la démonstration involontaire (*une offre tarifaire complète ne peut pas se publier à cause du KYC*) est LA munition de D31. Effet de bord réparé : bzv-perkg re-PUBLISHED au rerun.

## §3 — DÉCISIONS gravées cette session

**D31 (NOUVEAU, à reporter au registre §2)** : **le gate Stripe/profil migre de la PUBLICATION vers l'ACCEPTATION.** Pourquoi : conversion supply — le KYC (~5 min, incompressible légalement) se demande au moment où l'argent est réel (« 66 € t'attendent, finalise pour accepter »), jamais avant la première preuve de valeur, jamais après la capture (on ne capture pas vers qui on ne sait pas payer). Étayé : pattern Airbnb/BlaBlaCar ; le RIB+virements manuels = exercice illégal de services de paiement (DSP2/ACPR) — Stripe Connect Express confirmé (D11), `PaymentProvider` abstrait en B2, KYC incompressible ⇒ seule variable : le MOMENT. Compromis : trajets publiés par Yambers non finalisés (mitigé : expiration 24 h + OnboardingBanner + cron relance + PostHog jalon 2 pour mesurer). **Implémentation : micro-PR dédiée (déplacer les 2 checks du controller) + l'accept B2 — HORS refonte pricing.**

**A28 (consolidé, →§2bis v1.3)** : bi-moteur tolérant (jamais invalider l'existant), 4 choix — champs plats nullables + gate « UN moteur complet » · `TripFamilyCondition` coexiste avec legacy · bagages = 2 champs plats · `minPriceCents` null pour PER_KG (exclu du tri, documenté ; comparabilité = PR search future). PER_KG prime quand les deux moteurs sont complets. S/M/L confirmé SANS XS (arbitré : le poids fait le travail du petit colis, un coef<1 réduirait le gain sur les colis les plus rentables au kilo ; libellé S enrichi « de l'enveloppe à la boîte à chaussures » en PR-B ; **« prix plancher par colis » au backlog** comme paramètre serveur §13 candidat).

**Candidat D32 (non gravé, noté)** : provider email transactionnel (Resend/Postmark/SES) derrière abstraction façon PaymentProvider, avant lancement. État actuel : Nodemailer+EJS en SMTP env, DEUX clones (auth, trip), 3ᵉ évité par la future lib `@packages/email` (au 1er email B2). MailHog local Yamba = micro-ajout docker-compose candidat.

## §4 — TODO nouveaux/priorisés

Micro-PR **D31** (déplacement du gate — débloque aussi la preuve API du gate pricing) · seed : carrierPage/Stripe factices pour les carriers seed (sinon AUCUN test de publication API possible) — à trancher avec D31 · le reste inchangé (§7 v1.3 + handoffs PR5/PR4bis).

## §5 — LEÇONS de session

1. **Une ancre à indentation faible est une SOUS-CHAÎNE de sa jumelle indentée** — le STOP du garde-fou l'a prouvé (update 2sp ⊂ create 4sp après premier replace) ; parade : comparaison par LIGNES ENTIÈRES (`l == line`), gravée dans le pattern d'édition.
2. **Mes attendus de grep étaient bâclés ×3** (comptes annoncés incluant des mots absents des descriptions) — les comptes RÉELS étaient corrects à chaque fois ; le garde reste utile, l'attendu doit être compté sur le texte réel, pas de tête.
3. **`curl -s` sans `-w` = silence ambigu** (port fermé invisible) — désormais TOUJOURS `-w "\nHTTP %{http_code}\n"` dans les preuves API.
4. **Pièce jointe « document » vide ×2** — le corps du message reste le seul canal fiable (leçon §6.8 confirmée).
5. **Une intention non écrite n'existe pas** — le gate Stripe « qu'on croyait acté » à l'acceptation était à la publication depuis toujours ; le code fait foi, le registre grave (d'où D31).

## §6 — Vélocité

Session PR-A ≈ **1** (estimée dans les 2/3 de la refonte complète — le socle est la plus grosse des 3). Consommé ≈ **15**. Restant jalon 1 : PR-B (1/1,5) · PR-C (1/1,5) · micro-PR D31 (0,5) · B2 (2/3) · B3 (2/3) · B4 (1,5/2,5) · B5 (1,5/2) · micro-PRs (1,5/2,5) → **optimiste ≈ 11,5 / réaliste ≈ 17**. Lancement : fourchette **5-8 semaines** tenue.

## §7 — PROCHAINE ACTION : ⭐ PR-B — le formulaire du mockup prend vie

Périmètre : refonte de **StepConditions** (create-trip) en 4 sections du mockup — suggestion+jauge « prix juste » (D15 V1 déterministe, valeurs statiques acceptables en attendant le signal SavedRoutes) · €/kg + capacité (curseurs) · 8 familles OK/+%/Non · bagages forfaitaires — + `TripLiveSummary` (le gain net), mappers create-trip (state→payload avec les 5 champs), i18n, libellé S enrichi. QA : le trip `bzv-perkg` du seed + création réelle de bout en bout (le gate A28 en conditions vraies dès que D31 ou le seed carrierPage débloque la publication).

### Prompt d'ouverture prêt-à-coller

```
On reprend le projet Yamba — lis d'abord dans le project knowledge :
YAMBA-REGISTRE-DECISIONS-ROADMAP-v1.3.md + le handoff PR-A pricing
(#77 mergée : schéma+contrats 99×3+gate A28+seed bzv-perkg, D31 gravé)
+ mockup-pricing-yamba.html (LA spec du formulaire) + le repo
RE-SYNCHRONISÉ. Cherche AVANT de demander.

Vérifications d'ouverture (§1) : [je colle — dont le QUATUOR GitHub :
checks #76 et #77 __/13, required checks, titre #72]

⭐ PR-B : refonte StepConditions (create-trip) selon le mockup.
Étape 1 : inventaire AVANT le code — StepConditions.tsx actuel,
create-trip.{state,types,mapper,config}, TripLiveSummary, comment le
formulaire poste (create-trip.mapper → POST /trips). Je colle les
ls/sed que tu demanderas.

Rituel git : checkout dev, fetch, merge, log -3 (#77 en tête),
checkout -b feat/pricing-front-2, branch --show-current. [je colle]

Disciplines : UN bloc par collage, corps du message (jamais de piece
jointe), wc immédiat, ni #/??/glob, curl avec -w, ancres par lignes
entières, preuves avant tout « go », attendus comptés sur texte réel,
npx nx, numéro de PR noté AU merge, handoff final.
```
