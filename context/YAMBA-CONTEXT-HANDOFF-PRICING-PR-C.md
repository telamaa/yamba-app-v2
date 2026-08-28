# YAMBA — CONTEXT HANDOFF · PR-C « le wizard de réservation parle le moteur au kilo » — POUSSÉE, PR À OUVRIR
### Août 2026 · branche `feat/pricing-front-3` (base `dev` post-#84) · PR #__

## §1 — Vérifications d'ouverture
- [ ] Ouvrir la PR (base `dev`), COMPTER 13 checks · plateforme attendue : **433** (trip 187 · deal **225** = 218 + 7 · notification 21)
- [ ] QA : fiche métier R1–R12 (desktop + mobile ; dark/light)
- [ ] `context/` présent sur la branche (règle) ✓

## §2 — Livré
Voir `context/fiches-pr/PR-C-booking-per-kg/`. **D34 gravée** : `@packages/pricing`, moteur unique pur (cents), 7 specs (deal-service), paramètres §13 centralisés, seed aligné D16. Wizard sur le **vrai trajet** (`usePublicTrip` + mapper), étape 1 PER_KG (produit, famille, poids pré-rempli, S/M/L), récap COM-03 (2 lignes + Garantie + minimum D32), « Garantie Yamba » (GAR-02), brouillon v3.

## §3 — Décisions / backlog
- **B2 (argent entrant)** peut démarrer : `POST /deals` reçoit `draft + quote` ; le serveur recalcule avec `quoteShipperPrice` et **refuse toute divergence** (D17/D34), écrit `BookingPricingSnapshot` (contrat à enrichir des champs du devis : `billableWeightKg`, `sizeCoef`, `familySurchargePct`, `minimumApplied`, `serviceCents`), incrémente `reservedKg` (CAP-01) dans la même transaction que l'outbox.
- Front : `pricing-example.ts` / `price-for-weight.ts` / `comparable-price.ts` (recherche) dupliquent encore les paramètres → migrer vers `PRICING_PARAMS` dans la PR « paramètres serveur » (`GET /pricing/params`).
- `computeComparablePriceCents` (D33) devrait appeler `quoteShipperPrice` pour le colis de référence — même PR.

- **B2 — étape 4 (revue captures)** : le front affiche AUJOURD'HUI deux systèmes de choix de paiement (nos radios Carte / Apple Pay / Google Pay **et** les onglets du Payment Element Stripe : Klarna, Bancontact, Amazon Pay, eps). À la création du PaymentIntent : **restreindre `payment_method_types` à `card`** (+ wallets via le Payment Element lui-même) et **supprimer nos radios** — un seul système, celui de Stripe. Exigence B2, pas un bricolage front.
- Téléphone destinataire : le stub envoie déjà `recipientPhone` en E.164 (`recipientPhoneE164(draft)`) — B2 le stocke tel quel dans `BookingRecipientSnapshot`.

## §4 — Leçons
1. `apps/user-ui/tsconfig.json` **redéfinit `paths`** : un alias ajouté à `tsconfig.base.json` n'y arrive pas ; l'ajouter aussi + `include` du fichier.
2. Un remplacement de bloc multi-lignes échoue silencieusement sur une ligne vide de plus — vérifier au `grep` après chaque patch.

## §5 — Prochaine action
⭐ **B2 — argent entrant** : `POST /deals` (deal-service) avec snapshot D17 par `@packages/pricing`, `reservedKg` atomique, PaymentIntent (autorisation → capture à l'acceptation), accept/decline, expiration 24 h, `PaymentProvider` abstrait (D11). Lire `docs/SPECIFICATIONS-WORKFLOW-BOOKING-YAMBA.md` §2.2 + le handoff PR-C.
