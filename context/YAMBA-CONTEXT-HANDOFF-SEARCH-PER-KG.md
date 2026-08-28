# YAMBA — CONTEXT HANDOFF · PR search « la recherche parle le moteur au kilo » — POUSSÉE, PR À OUVRIR
### Août 2026 · branche `feat/search-per-kg` (empilée sur `feat/pricing-front-2`) · PR #__

## §1 — Ordre de merge et vérifications
- [ ] `chore/next-intl-config-path` → `chore/docs-context` → `feat/pricing-front-2` (PR-B) → **`feat/search-per-kg`** (rebase sur `dev` après chaque merge ; les cherry-picks disparaissent)
- [ ] Checks à COMPTER (13) sur chaque PR · plateforme attendue post-search : **426** (trip **187** = 174 + 5 comparable + 3 mapper + 5 poids · deal 218 · notification 21)
- [ ] `prisma db push` est fait en local (index `comparablePriceCents`) ; **en environnement partagé : `npx prisma db push` puis `npx tsx packages/libs/prisma/scripts/backfill-comparable-price.ts`** (idempotent)
- [ ] QA visuelle recherche (desktop dark/light + mobile 375) : fiche métier R1–R10

## §2 — Livré
Voir `context/fiches-pr/PR-search-per-kg/` (technique + métier). Résumé : **D33 gravé** (colis de référence 2 kg → `comparablePriceCents` dénormalisé, recalcul à chaque écriture, backfill 24 trajets) · filtre **famille** (`families` CSV, `familyConditions none REFUSE`) remplace le filtre catégorie legacy (qui ne cache plus les PER_KG) · tri « Prix le plus bas (colis 2 kg) » · facettes `familyCounts` · DTO `familyConditions` compact · sidebar « Que voulez-vous envoyer ? » (8 chips Lucide + comptes), toggles à 0 masqués · pills « Famille : +20 % » sur les cartes quand une famille filtrée est surchargée · contrats + openapi ×3 régénérés · i18n miroir OK.

### §2bis — D33 V2 : le poids de l'Expéditeur
Sidebar « Votre colis » (0,5–30 kg, mémorisé) → API `weightKg` : prix par carte pour ce poids (`price-for-weight.ts`, +5 specs), tri en mémoire pour ce poids (fenêtre 200, curseur `o:<n>`), exclusion par capacité + badge « Plus assez de place ». Le poids doit **pré-remplir le booking wizard** en PR-C.

### §2ter — Page trajet
`OfferCard` (offre PER_KG complète, exemple pour le poids mémorisé), chat masqué pour le propriétaire, CO₂ pour le poids, **texte d'annulation aligné ANN-01** (divergence trouvée : l'ancien texte promettait 50 %/0 % hors registre), lieux + conditions dans la colonne droite sur desktop. RG-S-09…12, recette R15–R19.

## §3 — Décisions / backlog
- **D33** au registre (poids de référence = 🚪↔, existence = 🚪→). `REFERENCE_KG` et le plancher sont des constantes serveur → paramètres §13 candidats (avec commission/plancher D16/D32) : une **PR « paramètres serveur »** (table + endpoint `GET /pricing/params`) alimenterait à la fois la suggestion V1.5, l'exemple de prix front (`pricing-example.ts`) et le comparable.
- Reste : ville de rattachement d'un aéroport (step 1) · cleanup `instantBooking` · filtres « Horaires de départ » toujours commentés.

## §4 — Leçons
1. Un filtre `hasSome` sur un champ que le nouveau moteur ne remplit plus = **invisibilité silencieuse** : à chaque nouveau moteur, relire TOUS les `where` de la recherche.
2. Compter les facettes sur la base **sans** le filtre qu'elles représentent, sinon les chips se comptent elles-mêmes.

## §5 — Prochaine action
⭐ **PR-C — côté Expéditeur** (booking wizard : poids, S/M/L, famille filtrée par les positions du Voyageur, total 2 lignes avec D32, ancre express, protection D22, snapshot D17) — lire `docs/YAMBA-DOC-TECHNIQUE-BOOKING-SHIPPER.md` + mockup colonne droite. Prompt d'ouverture : celui du handoff PR-B §7, en ajoutant « lis aussi le handoff SEARCH-PER-KG ».
