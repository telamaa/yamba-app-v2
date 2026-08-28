# Fiche métier — PR search « trouver un Voyageur pour MON colis »

## 1. Le besoin
L'Expéditeur cherche un trajet pour un colis précis. Avec le moteur au kilo (D13/D14), la bonne question n'est plus « quelle catégorie est acceptée ? » mais **« que voulez-vous envoyer ? »** (une famille) et **« combien ça coûte pour un colis comme le mien ? »**. La recherche doit montrer tous les trajets compatibles — anciens et nouveaux — et les rendre **comparables**.

## 2. Règles de gestion

### Comparabilité (D33)
- **RG-S-01** — Chaque trajet porte un **prix comparable** = coût de transport d'un colis de référence de **2 kg** : trajet au kilo → `max(2 × prix/kg, 8 €)` ; ancien trajet → son prix par catégorie le plus bas.
- **RG-S-02** — Le tri **« Prix le plus bas »** s'appuie sur ce prix comparable et mélange les deux types de trajets ; il est libellé « pour un colis de 2 kg ». Un trajet sans aucun prix n'y apparaît pas.

- **RG-S-02bis** — L'Expéditeur peut indiquer **le poids de son colis** (0,5 → 30 kg). Dès lors : chaque trajet affiche **son prix pour ce colis** (« ≈ 40 € tout compris pour 3 kg »), le tri par prix se fait **pour ce poids**, et les trajets au kilo qui n'ont pas assez de place sont exclus (capacité) ou signalés « Plus assez de place » (kilos restants). Le poids est mémorisé sur l'appareil et pré-remplira la réservation.

### Familles (D14)
- **RG-S-03** — Le filtre **« Que voulez-vous envoyer ? »** propose les 8 familles. Cocher une famille **exclut** les trajets dont le Voyageur **refuse** cette famille. Plusieurs familles cochées = le trajet doit accepter toutes.
- **RG-S-04** — Un trajet sans position sur les familles (ancien moteur, ou Voyageur qui accepte tout) est compatible avec toutes les familles.
- **RG-S-05** — Si le Voyageur applique un **supplément** sur une famille cochée, la carte l'annonce (« Électronique : +20 % ») **avant** le clic — jamais de surprise sur la page trajet.
- **RG-S-06** — Chaque chip affiche le **nombre de trajets compatibles** ; une chip à 0 est désactivée. Les comptes ne dépendent pas des familles déjà cochées.
- **RG-S-07** — L'ancien filtre par catégorie n'est plus proposé. S'il arrive par une URL ancienne, il ne s'applique qu'aux anciens trajets et ne cache jamais un trajet au kilo.

### Page trajet
- **RG-S-09** — La page d'un trajet au kilo affiche **l'offre complète** : prix au kilo, kilos disponibles, exemple de prix pour le colis de l'Expéditeur (poids mémorisé), les 8 familles avec leur statut, les forfaits bagage. Un visiteur ne réserve jamais sans avoir vu supplément ou refus.
- **RG-S-10** — Le propriétaire ne se voit pas proposer de discuter avec lui-même.
- **RG-S-11** — Le CO₂ évité est calculé **pour le poids du colis**, jamais présenté comme un chiffre par trajet.
- **RG-S-12** — La politique d'annulation affichée est **celle du registre (ANN-01)** : 100 % jusqu'à 48 h · partiel < 48 h · aucune après remise (litige). Toute autre formulation est une erreur.

- **RG-S-13** — Le **plancher par colis (D32 : 8 € minimum, 0,5 kg facturable minimum)** n'est pas seulement appliqué dans les calculs, il est **annoncé** partout où un prix au kilo est présenté : formulaire de création (« aucun envoi ne te rapporte moins de 8 € »), curseur de poids en recherche, bloc Offre et carte Réserver de la page trajet (« Colis léger (enveloppe, passeport, lunettes…) : 8 € minimum, quel que soit le poids »).

### Lisibilité
- **RG-S-08** — Un filtre de confiance (Super tripper, Profil vérifié, Billet vérifié) dont le compte est 0 est **masqué**, pas grisé.

## 3. Recette

| # | Cas | Attendu |
|---|---|---|
| R1 | Tri « Prix le plus bas » avec un trajet 12 €/kg et un trajet legacy 15 € | Ordre : legacy 15 € (comparable 15 €) puis 12 €/kg (comparable 24 €) ; libellé « pour un colis de 2 kg » |
| R2 | Tri « Prix le plus bas », trajet 3 €/kg | Comparable = 8 € (plancher) — classé comme un colis à 8 € |
| R3 | Cocher « Alimentaire sec & scellé » | Le trajet seed `bzv-perkg` (alimentaire refusé) disparaît ; le compteur de la chip = trajets non refusants |
| R4 | Cocher « Électronique & appareils » | `bzv-perkg` reste, sa carte affiche « Électronique & appareils : +20 % » |
| R5 | Cocher deux familles dont une refusée par un trajet | Ce trajet disparaît |
| R6 | Décocher tout | Tous les trajets reviennent, « Tout effacer » disparaît |
| R7 | Chips à 0 | Désactivées, non cliquables |
| R8 | Aucun Super tripper dans la base | La ligne « Super tripper » n'est pas affichée |
| R9 | Ancienne URL `?categories=clothes` | Les trajets au kilo restent visibles |
| R11 | « Votre colis » : 3 kg | Cartes « ≈ 40 € tout compris pour 3 kg » (12 €/kg : 36 + 4,32) ; tri « pour votre colis de 3 kg » ; hint « Prix et tri calculés pour 3 kg… » |
| R12 | « Votre colis » : 25 kg | Trajets au kilo de capacité < 25 kg absents ; un trajet à 12 kg restants sur 30 de capacité affiche « Plus assez de place » |
| R13 | Poids 1 kg, un legacy 15 € et un 12 €/kg, tri prix | 12 €/kg (12 €) avant legacy (15 €) ; à 2 kg l'ordre s'inverse |
| R14 | Recharger la page | Le poids saisi est conservé ; « Tout effacer » le remet à la référence 2 kg |
| R15 | Page trajet au kilo, poids 3 kg mémorisé | Bloc « Ce que vous pouvez envoyer » : 12,00 €/kg · 12 kg · « Votre colis de 3 kg ≈ 40,32 € tout compris » ; chips familles ; forfaits |
| R16 | Page trajet, propriétaire | Pas de bouton « Discuter » ; carte « C'est votre trajet » |
| R17 | CO₂ | « 0,6 kg de CO₂ évités vs fret express · pour 2 kg » (ordre de grandeur crédible) |
| R18 | Conditions | Texte ANN-01 (100 % / partiel < 48 h / litige après remise) |
| R19 | Desktop 1440×900 | Lieux + conditions à droite sous la carte ; page sans scroll ou presque |
| R10 | Mobile (feuille « Filtres ») | Mêmes chips famille, mêmes comptes ; carte mobile : pill supplément en 9 px sous « kg dispo » |
