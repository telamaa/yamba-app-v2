# Fiche métier — chore « chemin de config next-intl »

## Besoin
L'application front (`user-ui`) ne pouvait plus être lancée ni testée via l'outillage du monorepo : blocage total de l'équipe sur le front, sans lien avec une fonctionnalité.

## Règle de gestion
Aucune — correctif d'infrastructure de développement. Aucun impact utilisateur, aucun impact sur les traductions FR/EN (la configuration i18n est la même, seule la façon de la localiser change).

## Recette
| # | Cas | Attendu |
|---|---|---|
| R1 | `npm run user-ui` depuis la racine | Le front démarre sur http://localhost:3000 |
| R2 | Ouvrir `/fr/...` puis `/en/...` | Les deux langues s'affichent comme avant |
| R3 | CI : les 13 checks | Tous verts, comptés |
