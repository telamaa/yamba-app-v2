# YAMBA — CONTEXT HANDOFF · Refonte pricing PR-B « le formulaire du mockup prend vie » — POUSSÉE, PR À OUVRIR
### Août 2026 · branche `feat/pricing-front-2` (5 commits sur `70f060b`) · PR #__ (à noter au merge)

---

## §1 — Vérifications d'ouverture de la PROCHAINE session

- [ ] **Merger d'abord la chore** `chore/next-intl-config-path` (`3567d56`, 1 fichier) — PR #__ ; puis `git rebase dev` de `feat/pricing-front-2` (le cherry-pick `ddaa376` du même fix disparaît du diff)
- [ ] Ouvrir/compléter la PR-B : https://github.com/telamaa/yamba-app-v2/pull/new/feat/pricing-front-2 (base `dev`) — `gh` n'est pas authentifié en local (`gh auth login`)
- [ ] Checks PR-B **__/13** (COMPTER) · checks chore **__/13** · le quatuor reporté du handoff PR-A (checks #76/#77, required checks, titre #72)
- [ ] Plateforme attendue post-merge : **409** (trip **170** = 157 + 5 + 6 + 2 · deal 218 · notification 21) — toute déviation expliquée
- [ ] **QA visuelle** (non faite par la session, seul le typecheck + la compilation Next de `/fr/trips/create` sont prouvés) : desktop + mobile + dark ; créer un trajet PER_KG de bout en bout ; rouvrir `bzv-perkg` (seed, Thomas) en édition et vérifier la relecture (11,50 €/kg · 23 kg · électronique +20 % · alimentaire Non · soute 230 €)
- [ ] `CLAUDE.md` (enrichi) et `context/` sont MODIFIÉS/NON SUIVIS depuis avant la session — à commiter à part (chore/docs) ou à trancher

## §2 — Livré (branche `feat/pricing-front-2`)

| Commit | Contenu | Preuve |
|---|---|---|
| `ddaa376` | cherry-pick du fix Nx (`next.config.js` : chemin next-intl relatif au cwd — sans lui, `Failed to process project graph` sur toute commande Nx) | `nx show project user-ui` infère dev/build |
| `57406ec` | **Modèle Draft** : `pricePerKg`, `capacityKg`, `checkedBag23Price`, `cabinBag12Price` (euros côté Draft), `familyConditions: Record<ParcelFamily, {mode, surchargePct}>` (8 familles CAT-02, miroir de `trip-pricing.schema.ts`) · `PARCEL_FAMILIES` (icône + libellés FR/EN) · bornes curseurs du mockup (€/kg 5–20 pas 0,5 · capacité 2–30 · surcharge 5–50 pas 5) · **`suggestPricePerKg` D15 V1 pure** (base 11 €/kg × direct +5 % × départ ≤3 j +8 % / ≤7 j +4 %, fourchette −10 %/+15 %) + `getFairPriceVerdict` · `estimateNetGain` = €/kg × capacité (D16) · `validateStep2` : prix ET capacité obligatoires (miroir gate A28), surcharge 1–100, bagages > 0 si saisis, lieux inchangés · copy FR/EN dans `create-trip.copy.ts` (pas de messages JSON pour ce wizard) | tsc user-ui 0 erreur |
| `1d802ee` | **Mappers** aller (euros → cents `Math.round(×100)`, `familyConditions` = SEULES les familles ≠ ACCEPT, comme le seed ; null = tout accepté) et retour (cents → euros, familles absentes = ACCEPT, % conservé) | tsc |
| `d8b0909` | **UI** : `steps/StepConditions.tsx` réécrit = ① €/kg + jauge « prix juste » + ancre ② capacité + tolérance ±10 % ③ 8 familles OK / +% / Non (curseur % en mode surcharge) ④ bagages entiers forfait (soute 23 kg / cabine 12 kg, « consomme X kg ») + carte **gain net** puis lieux remise/livraison, options, message (inchangés). Nouveau kit `TripPricingUi.tsx` (SliderField, FairPriceGauge, FamilyConditionRow, BagFlatRateRow, NetGainCard, `formatEur`). `TripLiveSummary` (€/kg · kg · gain teal), `StepReview` (carte « Prix & capacité », legacy affiché seulement si catégories), `TripPublicPreview` (pills €/kg, kg dispo, familles refusées barrées), `CreateTripMobile` progression étape 2 = 4 jalons. Prop `toggleCategory` supprimée (Wizard + Mobile). **Charte §3.4 respectée** : ACCEPT = teal `#0F766E`/10, SURCHARGE = mango bordure + `rgba(255,153,0,.10)` + dark `#FFB84D`, REFUSE = slate barré ; jauge slate → teal → mango. Aucun rouge/ambre ajouté (les seuls restants — étoile note, badge vérifié — préexistaient) | tsc · `GET /fr/trips/create` 200 sans Build Error |
| `752280b` | **Serveur — complément A28** : `acceptedCategories` exigé à la publication SEULEMENT si le moteur effectif est PER_CATEGORY — `trip.schema.ts` superRefine (perKgComplete = prix > 0 ∧ capacité > 0) + `trip.controller.ts` `publishTrip` (le gate `resolvePricingEngine` tranche d'abord, puis les catégories si PER_CATEGORY). Chemin `updateTrip publish=true` ne vérifiait déjà pas les catégories. **+5 specs** `schemas/trip.schema.spec.ts` (PER_KG sans catégorie OK · legacy sans catégorie refusé · moteur à moitié → catégories exigées · brouillon jamais · SURCHARGE sans % refusé) | jest direct **162/162** · tsc app |

### §2bis — Révision UX « dépôt en 90 s » (revue captures 28/08, commits `b0ac39d` + `1587108`)

Revue d'expert sur 11 captures (desktop dark/light) → refonte de l'étape 2 : **prix et capacité pré-remplis** (médiane D15 arrondie 0,50 ; 12 kg), gain net sous l'offre, **familles = toggle Accepté/Refusé + « Ajouter un supplément »** (OK/+%/Non incompris), **accordéons fermés** avec résumé (familles, bagages, options), **popovers ⓘ** tap-friendly à la place du texte courant, **icônes Lucide** (plus d'emoji), jauge thème-aware + espace réservé (chevauchement dark corrigé), **suppléments visibles dans l'aperçu public**, **« Réservation instantanée » masquée (D20)**, escale pleine largeur. Facteur « délai » de la suggestion **inversé** (départ imminent = −5 %/−2 %, côté offre) + `factors` explicables. **Serveur : `checkBagCapacity` (RG-B-29)** dans le schéma create (brouillon compris) + les 2 chemins publish, **+6 specs → trip 168**. Perf/mobile : lignes famille `React.memo` + callbacks stables, contenu d'accordéon non monté fermé, cibles ≥ 44 px, `touch-pan-x` sur les curseurs. Captures de revue déposées localement dans `fiches-pr/PR-B-pricing-front/captures/` (dossier **ignoré par Git** — jamais versionné).

## §3 — DÉCISIONS / points registre

- **D31 et D32 GRAVÉES au registre (§2, après D30)** : D31 = gate Stripe à l'acceptation (reporté depuis PR-A) ; **D32 = plancher par colis : 0,5 kg facturable minimum ET 8 € minimum, le plus élevé** — à implémenter en PR-C (calcul Expéditeur + snapshot D17). Commit `8b8397c`+ : retours utilisateur appliqués (autocomplétion villes/aéroports + « Ville, Pays », brouillon v3, review sans legacy ni instantanée, payload pur PER_KG, popover ⓘ anti-débordement, référence & justificatif repliés).

- **Complément A28 (à entériner, D-next ou note sous A28)** : *la catégorie n'existe que pour le moteur legacy* ; un trajet PER_KG complet publie sans `acceptedCategories`. Angle mort de PR-A découvert à l'inventaire (deux verrous : schéma l.217 + controller l.877). Sans ce complément, PR-B était inpubliable.
- **D15 V1 statique assumé** : une base unique 11 €/kg (pas de table `base_corridor` seedée, pas de signal SavedRoutes) — le moteur est pur et isolé (`suggestPricePerKg`), remplaçable par un appel serveur sans toucher la jauge (elle ne connaît que `{low, median, high}`).
- **Migration douce** : le formulaire ne saisit plus le legacy ; un trajet PER_CATEGORY rouvert en édition doit fixer €/kg + capacité pour republier (l'existant publié n'est PAS invalidé — bi-moteur tolérant). Le legacy reste lisible (review/preview) tant que `pricePerKg` est vide.
- **RG-B-29/30/31 (nouveaux, fiche métier)** : forfait bagage ⇒ capacité ≥ franchise (serveur) · équivalent €/kg affiché · « Réservation instantanée » retirée du formulaire (D20 v1 — le champ reste en base, à supprimer en PR cleanup).
- **Layout desktop (avis donné, chantier à part)** : garder la colonne centrée (~768 px) ; sur ≥ 1280 px, aperçu public *sticky* à droite (pattern Airbnb) → `CreateTripWizard`, PR UX dédiée.
- **Step 1 (avis donné, PR dédiée `feat/create-trip-step1-ux`)** : « Ville, Pays » normalisé partout (Google omet le pays du domicile), autocomplétion filtrée (locality/airport) + drapeaux, arrivée repliée par défaut, justificatif déplacé en step 3 (« Boostez votre annonce »).
- **Suggestion V1.5 serveur (PR dédiée + précision D15)** : table `base_corridor` seedée, facteurs offre (trajets publiés ±7 j) / demande (SavedRoutes) / délai (sens offre) / réputation / vol direct, plafond ≤ 35 % du tarif express pour un colis type, `factors` renvoyés, endpoint `GET /trips/price-suggestion` + cache ; le front garde `suggestPricePerKg` en fallback.
- **Libellé S enrichi « de l'enveloppe à la boîte à chaussures »** : NON fait ici — il vit côté Expéditeur (booking wizard), pas dans ce formulaire Voyageur → reporté à PR-C.
- **Recherche** : `trip-search.controller.ts:94` filtre par `acceptedCategories hasSome` → les trajets PER_KG sont invisibles à un filtre catégorie (déjà backlog « PR search » ; à mapper famille ↔ filtre).

## §4 — TODO

- QA visuelle + création réelle (§1). La preuve API du gate reste bloquée par le gate Stripe/profil → **micro-PR D31** ou seed carrierPage/Stripe factice (inchangé depuis PR-A).
- Nettoyage post-refonte (PR cleanup A28) : `estimateRevenue`, `CategoryChip`, `PriceInput`, `RevenueBadge`, `CATEGORY_GROUPS`, `getCategoryOptions`, champs `@deprecated` du Draft.
- Charte : `text-amber-500` (étoile) et `emerald` (badge vérifié) préexistants dans `TripPublicPreview`/`StepReview` — hors périmètre, à harmoniser un jour.
- Tests front : aucun runner jest pour `user-ui` — `suggestPricePerKg`/mappers sont purs et testables le jour où un target `test` existe.

## §5 — LEÇONS de session

1. **Chemin relatif + Nx** : next-intl résout depuis `process.cwd()`, `@nx/next` évalue `next.config.js` depuis la racine, Turbopack refuse l'absolu → `path.relative(process.cwd(), path.join(__dirname, …))`.
2. **`AggregateError at internalConnectMultiple` sur la gateway = ECONNREFUSED** vers un service en cours de redémarrage (watcher) — pas un bug de code ; vérifier `lsof -iTCP:6002 -sTCP:LISTEN` + uptime avant de chercher ailleurs.
3. **Inventaire avant code, encore** : les 5 champs traversaient le serveur (PR-A) mais un verrou legacy en amont rendait le tout inpubliable — chercher TOUS les `ValidationError` du chemin publish, pas seulement le gate qu'on vient d'écrire.
4. **Le mockup pose la structure, la charte pose les couleurs** : reproduire les rouges/ambres du mockup HTML était une erreur — relire §3.4 avant tout nouveau composant.
5. `git stash push -- <paths>` n'embarque pas les fichiers non suivis (`-u`) ; `gh` non authentifié ⇒ URL `pull/new/<branche>`.

## §6 — Vélocité

PR-B ≈ **1** session (estimée 1/1,5). Restant jalon 1 : PR-C (1/1,5) · micro-PR D31 (0,5) · B2 (2/3) · B3 (2/3) · B4 (1,5/2,5) · B5 (1,5/2) · micro-PRs (1,5/2,5) → **optimiste ≈ 10,5 / réaliste ≈ 16**.

## §7 — PROCHAINE ACTION

1. Merger chore next-intl → rebase → ouvrir/merger PR-B (numéro AU merge, `YAMBA-CONTEXT.md` mis à jour).
2. ⭐ **PR-C — côté Expéditeur** : le booking wizard lit le moteur PER_KG (poids déclaré, taille S/M/L « pas besoin de mesurer », famille filtrée par les conditions du trajet, total en 2 lignes transport + service&protection, ancre DHL, protection D22) — lire `docs/YAMBA-DOC-TECHNIQUE-BOOKING-SHIPPER.md` + `mockup-pricing-yamba.html` colonne droite AVANT le code ; snapshot de prix immuable (D17) côté deal-service.

### Prompt d'ouverture prêt-à-coller

```
On reprend Yamba — lis d'abord context/YAMBA-REGISTRE-DECISIONS-ROADMAP-v1.3.md,
le handoff PR-B (context/YAMBA-CONTEXT-HANDOFF-PRICING-PR-B.md) et
mockup-pricing-yamba.html (colonne « Tu envoies un colis »).
Vérifications §1 du handoff PR-B (chore mergée ? PR-B checks __/13, plateforme 401).
⭐ PR-C : booking wizard Expéditeur sur le moteur PER_KG.
Étape 1 : inventaire AVANT le code (booking wizard steps, pricing snapshot
deal-service, docs technique booking shipper). Rituel git : dev à jour,
feat/pricing-front-3. Charte §3.4 : mango/teal/slate, rien d'autre.
```
