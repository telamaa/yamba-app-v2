# Fiche métier — chore « build de production »

## Besoin
L'application ne pouvait plus être construite pour la production (échec silencieux au pré-rendu de 4 pages). Sans build, pas de mise en ligne — bloquant absolu pour le lancement.

## Règle de gestion
Aucune règle produit. Invariant : **ce qui est mergé doit se construire** — la CI doit exécuter le build de production du front (proposition de check requis).

## Recette
| # | Cas | Attendu |
|---|---|---|
| R1 | `npx nx build user-ui` | Succès, « Generating static pages (57/57) » |
| R2 | `/fr/refresh`, `/fr/carrier/onboarding`, `/fr/carrier/onboarding/stripe/callback`, `/fr/trips/create?edit=<id>` en prod | Pages fonctionnelles, comportement identique au dev |
