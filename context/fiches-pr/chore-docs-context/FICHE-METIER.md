# Fiche métier — chore « versionner la gouvernance »

## Besoin
Le produit se construit sur des décisions numérotées (registre D1–Dn), des règles métier et des spécifications. Tant qu'elles n'étaient pas dans le dépôt, le code pouvait diverger sans que personne ne le voie (exemple réel : la décision D31 « gate Stripe à l'acceptation » avait été prise en session mais jamais écrite au registre).

## Règle de gestion (gouvernance)
- **RG-G-01** — Toute décision d'architecture ou de règle métier est **écrite au registre avant le code**, dans la PR qui l'implémente.
- **RG-G-02** — En cas de divergence : le code et ses tests font foi, puis le registre, puis les règles métier, puis les synthèses.
- **RG-G-03** — Chaque PR livre une fiche technique (lisible par un développeur junior) et une fiche métier (besoin + règles de gestion + recette).

## Recette
| # | Cas | Attendu |
|---|---|---|
| R1 | Ouvrir `context/` sur n'importe quelle branche après merge | Les 6 documents + `fiches-pr/` + le mockup sont présents |
| R2 | Ouvrir `context/mockup-pricing-yamba.html` dans un navigateur | La maquette interactive fonctionne (curseurs, calculs) |
| R3 | CI « secrets anti-leak » | Vert |
