# Tarification et rentabilité

> Document produit, octobre 2026. Il décrit **la logique de calcul tarifaire telle
> qu'elle est codée aujourd'hui**, la compare aux transporteurs classiques, et pose des
> hypothèses de rentabilisation.
>
> Deux natures de contenu cohabitent, et elles ne se valent pas :
>
> - **Les sections 1 à 6 sont des constats.** Les formules, les paramètres et les
>   montants sont lus dans le code (`packages/libs/pricing`, le catalogue de paramètres
>   D62) et dans les règles métier. Ils sont vérifiables.
> - **Les sections 7 à 9 sont un modèle.** Elles reposent sur des hypothèses explicites
>   — taux de litige, taux de sinistre, coûts de paiement — qu'**aucune donnée réelle n'a
>   encore validées**, Yamba n'ayant pas ouvert son premier corridor. Chaque hypothèse est
>   nommée et chiffrée pour pouvoir être remplacée par la mesure.
>
> Ce document n'est ni un conseil financier, ni un conseil juridique. Les comparaisons
> tarifaires avec des transporteurs nommés relèvent de la publicité comparative et
> **doivent être revérifiées et datées** avant tout usage public (voir § 6.4).

---

## 1. Le principe : Yamba ne fixe pas le prix du transport

C'est le point de départ, et il commande tout le reste.

**Le Voyageur fixe un tarif unique en euros par kilo, pour son trajet** (PRC-01). Yamba
ne décide ni de ce tarif, ni d'un barème par destination. La plateforme prélève une
commission sur ce transport, et vend séparément une protection optionnelle.

Trois conséquences, souvent mal comprises :

1. **Il n'existe pas, et il ne doit pas exister, de « coefficient de distance » dans la
   formule.** Paris–Libreville coûte plus cher que Paris–Orléans parce que le Voyageur le
   tarife plus cher. Multiplier son prix par un facteur Yamba reviendrait à compter la
   distance deux fois — et surtout, la fiche du trajet annonce « 3,50 €/kg » : si le
   client payait ce tarif multiplié par un coefficient invisible, l'affichage mentirait.
2. **Le corridor entre dans le produit par la _suggestion_, pas par la facturation**
   (PRC-05, § 2.5).
3. **Le revenu de Yamba est un pourcentage d'un prix qu'elle ne contrôle pas.** Un
   Voyageur qui sous-tarife son trajet coûte à Yamba autant qu'à lui-même. C'est pour cette
   raison que la suggestion de prix n'est pas un confort d'interface mais un **levier
   économique** (§ 8.2).

---

## 2. La formule, en détail

### 2.1 Les quatre composantes

Le prix payé par l'Expéditeur se décompose ainsi :

```
poids facturé = max( poids déclaré , poids facturable minimum )

transport     = max( arrondi( €/kg × poids facturé × coef. taille × (1 + surcharge famille) ) ,
                     prix minimum par colis )

commission    = max( arrondi( transport × taux ) , plancher de commission )

prime         = protection étendue choisie ? montant de la prime : 0

TOTAL         = transport + commission + prime
net Voyageur  = transport          (il ne supporte aucune retenue)
```

La dernière ligne est une règle, pas une approximation : **le Voyageur touche le transport
intégralement** (COM-03). La commission est payée **en sus** par l'Expéditeur (COM-01).

### 2.2 Les paramètres et leurs valeurs

Tous sont administrables sans déploiement (catalogue de paramètres, D62), avec des bornes
et une journalisation de chaque modification. Aucun n'est rétroactif : une réservation
existante conserve sa photographie de calcul (PRC-08).

| Paramètre | Clé | Défaut | Bornes | Règle |
|---|---|---|---|---|
| Commission | `pricing.commissionPct` | 12 % | 5 – 20 % | D16 · COM-01 |
| Plancher de commission | `pricing.commissionFloorCents` | 3,00 € | 1 – 10 € | D16 · COM-02 |
| Poids facturable minimum | `pricing.minBillableKg` | 0,5 kg | 0,1 – 2 kg | D32 |
| Prix minimum par colis | `pricing.minTransportCents` | 8,00 € | 1 – 30 € | D32 |
| Colis de référence | `pricing.referenceKg` | 2 kg | 1 – 10 kg | D33 |
| Coefficient taille S | `pricing.sizeCoefS` | ×1,00 | 0,5 – 2 | PRC-03 |
| Coefficient taille M | `pricing.sizeCoefM` | ×1,10 | 0,5 – 2 | PRC-03 |
| Coefficient taille L | `pricing.sizeCoefL` | ×1,25 | 0,5 – 2 | PRC-03 |
| Prime protection étendue | `protection.extendedPremiumCents` | 6,00 € | — | D22 · GAR-03 |
| Plafond protection étendue | `protection.extendedCapCents` | 500,00 € | — | D22 · GAR-03 |

Une contrainte est vérifiée à l'enregistrement : **S ≤ M ≤ L**.

### 2.3 Ce que chaque mécanisme protège

| Mécanisme | Qui protège-t-il ? | Pourquoi |
|---|---|---|
| Poids facturable minimum (0,5 kg) | le Voyageur | Une bague pèse 20 g ; le dérangement, lui, ne dépend pas du poids. |
| Prix minimum par colis (8 €) | le Voyageur | Le coût réel d'un Voyageur est son **temps** — se déplacer au rendez-vous, attendre, remettre — pas les kilos. |
| Plancher de commission (3 €) | Yamba | Couvre les coûts incompressibles d'une transaction, frais de paiement compris (COM-02). |
| Coefficients de taille | le Voyageur | Le volume occupé dans son bagage est une ressource distincte du poids. |
| Surcharge par famille | le Voyageur | Il peut sur-tarifer ce qui l'expose (électronique) ou le refuser (CAT-03). |
| Tolérance ±10 % au pickup | les deux | Un écart de poids constaté déclenche une renégociation, pas un conflit (PRC-07). |

### 2.4 Le bagage entier : un produit forfaitaire

CHECKED_BAG_23KG et CABIN_BAG_12KG sortent de la logique au kilo : le Voyageur vend sa
franchise complète à prix fixe (PRC-04). Le poids et la taille ne jouent plus ; la
commission s'applique au forfait. **C'est, de loin, le produit le plus rentable** (§ 7.3).

### 2.5 La suggestion de prix : spécifiée, non implémentée

PRC-05 (D15) définit une suggestion déterministe :

```
prix suggéré (€/kg) = base_corridor × Π(modificateurs)
```

`base_corridor` est une table par corridor issue d'une étude du marché GP. Les
modificateurs : vol direct ou avec escales, proximité de la date, saisonnalité, réputation
du Voyageur, demande latente (routes sauvegardées sur le corridor). L'affichage prévu est
une fourchette basse–médiane–haute avec l'ancre « les trajets similaires partent à Y €/kg ».
Le Voyageur reste libre de son prix ; PRC-06 lui pose un badge « prix juste » s'il est dans
la fourchette, sans jamais le bloquer.

PRC-09 prévoit la même chose pour le forfait bagage :
`forfait suggéré = médiane_corridor × franchise × 0,9` (remise de gros).

> **Constat d'implémentation (octobre 2026).** Aucune de ces quatre règles n'a de code.
> Le mot « corridor » n'existe dans la base que dans les **compteurs de demande** (vues et
> recherches par corridor, en Redis), jamais comme base tarifaire. Le formulaire de
> création de trajet ne suggère aucun prix. C'est, économiquement, le manque le plus
> coûteux du produit (§ 8.2).

---

## 3. Lecture de la formule : ce qu'elle produit aujourd'hui

Trajet à **3,50 €/kg**, protection de base, sans surcharge de famille.

| Poids déclaré | Taille S | Taille M | Taille L |
|---|---|---|---|
| 0,5 kg | 11,00 € | 11,00 € | 11,00 € |
| 1 kg | 11,00 € | 11,00 € | 11,00 € |
| 1,5 kg | 11,00 € | 11,00 € | 11,00 € |
| 2 kg | 11,00 € | 11,00 € | 11,75 € |
| 3 kg | 13,50 € | 14,55 € | 16,13 € |
| 5 kg | 20,50 € | 22,25 € | 24,88 € |
| 10 kg | 39,20 € | 43,12 € | 49,00 € |

---

## 4. Deux défauts constatés

Ils ont été relevés en recette produit le 17 octobre 2026, à partir de cette table.

### 4.1 La taille n'a aucun effet sur le colis le plus courant

Le coefficient de taille multiplie le transport **avant** le plancher de 8 €. Tant que le
produit `€/kg × poids × coefficient` reste sous ce plancher, la taille ne change rien.

Seuil à partir duquel la taille devient visible, à 3,50 €/kg :

| Taille | Seuil |
|---|---|
| L | 1,83 kg |
| M | 2,08 kg |
| S | 2,29 kg |

**En dessous de 1,83 kg, S, M et L donnent exactement le même prix.** Or le colis courant —
documents, vêtements, petite électronique — pèse moins de 2 kg. On pose donc à
l'Expéditeur une question dont la réponse ne change rien, ce qui a deux effets : la
question paraît décorative, et la crédibilité de l'ensemble du calcul en souffre.

Le cas limite est parlant : un colis d'**1 kg en taille L** — une demi-valise — coûte
**exactement le prix d'une enveloppe**, alors qu'il consomme la moitié de la place du
Voyageur.

### 4.2 Le volume n'est jamais décompté de la capacité

CAP-01 réserve des **kilos** dès la demande (`remainingKg`). Le volume n'entre nulle part.
Un Voyageur peut donc accepter trois colis « demi-valise » d'1 kg chacun : sa capacité en
kilos le permet, sa valise non. Le défaut ne se révèle qu'au rendez-vous, c'est-à-dire au
pire moment.

### 4.3 Le plancher ignore le corridor

Le prix minimum par colis est un **montant absolu** : 8 €. Il vaut la même chose pour
Paris–Orléans et pour Paris–Libreville. Conséquence : sur un long-courrier à 12 €/kg, un
Voyageur qui transporte une bague touche 8 € — les mêmes 8 € que pour un trajet d'une
heure. **Le tarif au kilo connaît la distance ; le plancher ne la connaît pas.**

---

## 5. L'évolution proposée

### 5.1 Le principe : le poids volumétrique, adapté

Les transporteurs express résolvent exactement le problème du § 4.1 avec le **poids
volumétrique** : on facture le plus grand des deux, le poids réel ou le volume converti en
kilos (§ 6.1). Yamba ne peut pas l'appliquer littéralement — sa règle produit est
« **pas besoin de mesurer** » (PRC-03), et demander trois dimensions à quelqu'un qui envoie
un pull n'est pas une option.

**L'adaptation consiste à pré-calculer le poids volumétrique par classe de taille.** C'est
le même calcul, fait une fois pour toutes au lieu d'être demandé au client.

Ce que l'express facturerait pour nos trois gabarits, avec le diviseur de référence 5000 :

| Classe | Gabarit annoncé | Dimensions typiques | Poids volumétrique |
|---|---|---|---|
| S | « une boîte à chaussures » | 33 × 23 × 14 cm | 2,1 kg |
| M | « un sac à dos » | 45 × 30 × 20 cm | 5,4 kg |
| L | « une demi-valise » | 55 × 40 × 20 cm | 8,8 kg |

### 5.2 La formule proposée

```
poids facturé = max( poids réel , plancher de facturation , minimum de la taille )
transport     = €/kg du Voyageur × poids facturé × (1 + surcharge famille)
```

Avec :

- **plancher de facturation ≈ 2,3 kg**, qui **remplace** le prix minimum absolu de 8 €. À
  3,50 €/kg il vaut 8,05 € — le comportement actuel à un centime près. À 12 €/kg il vaut
  27,60 €, sans aucun paramètre supplémentaire. Le plancher devient ainsi **automatiquement
  proportionnel au corridor**, puisqu'il multiplie le tarif du Voyageur.
- **minimums de taille : S aucun, M 3 kg, L 6 kg** — une grille volontairement plus douce
  que celle de l'express. S reste la référence et ne paie pas de volume ; M et L paient la
  place qu'ils occupent.
- **le coefficient de taille disparaît.** Il n'y a plus de multiplicateur à expliquer.

Une seule phrase suffit à l'Expéditeur :

> **On facture le plus grand des trois : ce que ça pèse, la place que ça prend, ou le
> minimum du trajet.**

### 5.3 Pourquoi S ne reçoit aucun minimum

C'est la correction d'une première version de cette proposition, qui donnait à S un
minimum d'1 kg. Sur un corridor cher, cela aurait renchéri **précisément les petits objets
de valeur** — téléphone, lunettes, bague, enveloppe — que le plancher est censé protéger
sans les surtaxer. S est le gabarit de référence : il ne paie que le poids et le plancher.

### 5.4 Ce que ça donne

| | Paris–Orléans (3,50 €/kg) | Paris–Libreville (12 €/kg) |
|---|---|---|
| bague, enveloppe, lunettes (S) | **11,05 €** | **30,91 €** |
| téléphone 0,3 kg (S) | 11,05 € | 30,91 € |
| 2 kg en S | 11,05 € | 30,91 € |
| 2 kg en M | 13,50 € | 40,32 € |
| 2 kg en L | 24,00 € | 80,64 € |
| 5 kg en S | 20,50 € | 67,20 € |
| *aujourd'hui, sous 1,83 kg* | *11,00 €, toutes tailles* | *11,00 €, toutes tailles* |

Sur le corridor court, rien ne change pour les petits colis : c'est la continuité. Sur le
long-courrier, le Voyageur touche enfin un prix qui ressemble à ce qu'il fait.

### 5.5 Les trois points à arbitrer

1. **Plancher de facturation : 2,3 kg ou 2 kg ?** 2 kg l'alignerait sur le colis de
   référence D33, qui sert déjà de base de comparabilité entre trajets — plus cohérent,
   mais 50 centimes moins cher qu'aujourd'hui sur un trajet court.
2. **Minimums de taille : la grille douce (M 3 / L 6) ou celle de l'express (M 5,4 /
   L 8,8) ?** Recommandation : la grille douce. Durcir un prix est facile ; le baisser
   après coup abîme la confiance.
3. **La capacité se décompte-t-elle sur le poids facturé ou le poids réel ?** Si elle
   reste sur le poids réel, le défaut du § 4.2 subsiste : on facture le volume sans jamais
   le réserver.

Ces trois points sont des décisions de prix (D13 · D32 · PRC-03) portant sur un moteur
partagé avec la photographie serveur immuable (PRC-08 · D17). Elles se consignent au
registre avant d'être codées.

---

## 6. Comparaison avec les transporteurs classiques

### 6.1 Famille 1 — l'express international

**DHL, FedEx, UPS, Chronopost.** Tous facturent le **poids volumétrique** : le plus grand
du poids réel et du volume converti, `L × l × h ÷ diviseur`, le diviseur de référence
européen étant 5000. Un colis léger et encombrant est facturé comme s'il était lourd.

C'est logique : ils vendent de la place dans une soute, pas du poids.

### 6.2 Famille 2 — le postal grand public

**La Poste / Colissimo, Mondial Relay.** Ils ne facturent **pas** le volume. Le prix est
donné par **tranches de poids** (0–250 g, 250–500 g, 500 g–1 kg, 1–2 kg, 2–5 kg, 5–10 kg,
10–30 kg), et la taille sert uniquement de **condition d'admission** : au-delà d'une somme
L+l+h et d'une longueur maximale, le colis est refusé ou traité en « hors normes ».

### 6.3 Lequel pour Yamba ?

| Critère | Modèle postal | Modèle express | Yamba |
|---|---|---|---|
| Qui fixe le prix | le transporteur | le transporteur | **le Voyageur** |
| Structure | tranches de poids | poids ou volume, au plus grand | au kilo, prix du Voyageur |
| Le volume est… | une condition d'admission | **tarifé** | *ignoré en pratique* (§ 4.1) |
| Ressource vendue | une place dans un camion | une place en soute | **une place dans une valise** |

Le modèle postal est à écarter pour deux raisons. D'abord, les tranches écraseraient le
tarif au kilo que le Voyageur fixe lui-même, qui est le cœur du produit. Ensuite et
surtout, le modèle postal **ne compense jamais le volume : il le refuse**. La Poste peut se
le permettre, elle a un camion. Le Voyageur Yamba a une valise, et la place qu'il cède est
exactement ce qu'il vend.

**C'est donc la logique express qu'il faut retenir** — avec l'adaptation du § 5.1, puisque
l'Expéditeur ne mesure rien.

Une chose mérite cependant d'être empruntée au modèle postal : **la porte d'admission**. Le
Voyageur déclare aujourd'hui les *familles* qu'il accepte (CAT-03), jamais les *tailles*.
Il devrait pouvoir refuser l'encombrant à n'importe quel prix. Cela complète la
tarification au volume, cela ne la remplace pas.

### 6.4 L'express comme ancre, jamais comme entrée

PRC-10 (D15) pose déjà la doctrine : les tarifs express **n'entrent pas** dans le calcul de
la suggestion — le marché de référence de Yamba est le GP, pas DHL. Ils servent à deux
choses : une **ancre comparative** affichée à l'Expéditeur, et un **plafond de sécurité**
au-delà duquel la suggestion ne monte jamais.

> **Précaution obligatoire.** Les diviseurs, tranches et tarifs cités ici décrivent des
> **structures**, stables dans le temps. Les **montants**, eux, changent plusieurs fois par
> an et varient par pays, par service et par contrat. Toute comparaison chiffrée affichée
> à un utilisateur doit être **sourcée, datée et revérifiée** : la publicité comparative est
> encadrée, et une comparaison périmée engage la responsabilité de celui qui l'affiche.

---

## 7. Ce que Yamba facture

### 7.1 Ce qui est, et ce qui n'est pas, du revenu Yamba

**Le « Service Yamba » affiché à l'Expéditeur est la commission, et elle seule.**

La prime de protection étendue (6 €) n'en fait pas partie. GAR-04 impose qu'elle soit un
**flux comptable distinct**, dès le premier jour : une prime destinée à un assureur et une
commission de plateforme ne se mélangent jamais — la règle précise que leur fusion serait
« l'erreur irréversible ». Aujourd'hui, faute de contrat signé, la Garantie Yamba est un
engagement commercial porté par la plateforme (GAR-01) ; demain, le même champ change de
titulaire sans changer de schéma (GAR-03).

### 7.2 La commission par cas

Trajet Paris–Orléans à 3,50 €/kg.

| Cas | Transport (Voyageur) | Commission | % du transport | Total Expéditeur |
|---|---|---|---|---|
| bague, enveloppe, lunettes | 8,00 € | 3,00 € | 38 % | 11,00 € |
| 2 kg, taille S | 8,00 € | 3,00 € | 38 % | 11,00 € |
| 2 kg, taille L | 8,75 € | 3,00 € | 34 % | 11,75 € |
| 5 kg | 17,50 € | 3,00 € | 17 % | 20,50 € |
| 10 kg | 35,00 € | 4,20 € | 12 % | 39,20 € |
| bagage soute 23 kg (forfait 90 €) | 90,00 € | 10,80 € | 12 % | 100,80 € |
| 2 kg + Garantie 500 € | 8,00 € | 3,00 € + 6 € de prime | 38 % | 17,00 € |

**Le taux de 12 % ne s'applique jamais en dessous de 25 € de transport.** En pratique, sur
le colis courant, Yamba prélève un forfait de 3 €.

### 7.3 Le revenu net, après frais de paiement

COM-01 précise que les frais du prestataire de paiement sont **absorbés dans la
commission**. En retirant une estimation de ces frais (1,4 % + 0,25 € pour une carte de la
zone euro) :

| Cas | Total | Commission | − frais | **Net Yamba** |
|---|---|---|---|---|
| Orléans, 2 kg S | 11,00 € | 3,00 € | 0,40 € | **2,60 €** |
| Orléans, 2 kg L *(proposé)* | 24,00 € | 3,00 € | 0,59 € | **2,41 €** |
| Orléans, 5 kg | 20,50 € | 3,00 € | 0,54 € | **2,46 €** |
| Orléans, 10 kg | 39,20 € | 4,20 € | 0,80 € | **3,40 €** |
| Libreville, 2 kg L *(proposé)* | 80,64 € | 8,64 € | 1,38 € | **7,26 €** |
| Bagage entier 23 kg | 100,80 € | 10,80 € | 1,66 € | **9,14 €** |

Trois lectures :

1. **Le net est quasiment plat autour de 2,50 €** sur toute la gamme des petits et moyens
   colis. Le modèle proposé double le prix d'un colis encombrant (11 € → 24 €) et Yamba
   gagne **19 centimes de moins**. Tout le surplus va au Voyageur. C'est défendable — c'est
   sa place qu'on vend — mais il faut le voir en face : **tarifer le volume rééquilibre le
   Voyageur, cela n'enrichit pas la plateforme.**
2. **La distance, elle, profite aux deux** : 2,60 € → 7,26 €.
3. **Le bagage entier est le produit rentable** : 9,14 €, soit 3,5 fois un colis courant.

---

## 8. Hypothèses de rentabilisation

> Tout ce qui suit est un **modèle**. Les hypothèses sont nommées pour être contestées et
> remplacées par la mesure. Aucune donnée réelle n'existe à ce jour.

### 8.1 Hypothèses retenues

| Hypothèse | Valeur retenue | Pourquoi c'est incertain |
|---|---|---|
| Taux de litige | 5 % des réservations | Aucune mesure ; dépend du corridor, du filtrage des Voyageurs et de la qualité des photos. |
| Coût d'une médiation | 30 min à 25 €/h chargés = 12,50 € | Dépend de l'outillage back-office et de la complexité des dossiers. |
| Taux de sinistre indemnisé | 0,5 % | La Garantie de base est financée par la commission (GAR-01). |
| Sinistre moyen | 60 € | Plafonné par GAR-06 au minimum entre valeur déclarée, plafond et valeur justifiée. |
| Frais de paiement | 1,4 % + 0,25 € | Varie selon le contrat et l'origine de la carte (§ 8.5). |
| Frais fixes mensuels | 300 € (infra) / 2 800 € (infra + une personne) | Ordre de grandeur. |

Coûts variables par réservation, hors frais de paiement : **0,93 €** pour un colis
domestique, **1,07 €** pour un long-courrier (exposition sinistre plus élevée).

### 8.2 Marge de contribution

| | Net après frais | Coûts variables | **Contribution** |
|---|---|---|---|
| Colis courant Paris–Orléans | 2,50 € | 0,93 € | **1,57 €** |
| Colis encombrant Orléans *(proposé)* | 2,41 € | 0,93 € | **1,49 €** |
| Colis Paris–Libreville | 7,26 € | 1,07 € | **6,18 €** |
| Bagage entier 23 kg | 9,14 € | 1,07 € | **8,07 €** |

Toutes positives. Mais le rapport va **de 1 à 5**.

### 8.3 Volume nécessaire à l'équilibre

| Pour couvrir… | en colis Orléans | en colis Libreville | en bagages entiers |
|---|---|---|---|
| l'infrastructure seule (300 €/mois) | 191 | 49 | 38 |
| l'infrastructure + une personne (2 800 €/mois) | **1 778** | **453** | **348** |

**Le même salaire demande 1 778 colis domestiques ou 348 bagages entiers.** Ce n'est donc
pas le taux de commission qui décide de la rentabilité de Yamba : c'est **le mix** — ce
qu'on vend, et sur quel corridor.

### 8.4 Les leviers, par ordre de rendement

**① Pousser le bagage entier (PRC-09).** 8,07 € de contribution contre 1,57 €, à prix
inchangé pour tout le monde. La règle de suggestion existe, elle n'a aucune ligne de code.
C'est l'optimisation la moins chère qui existe : elle est déjà écrite.

**② Concentrer l'acquisition sur les corridors longs (PRC-05 · PRC-06).** 6,18 € contre
1,57 €. C'est littéralement le marché visé — la diaspora. Tant que la suggestion par
corridor n'existe pas, les Voyageurs tarifent à l'aveugle et sous-évaluent probablement les
longs-courriers, ce qui coûte **aux deux parties** puisque la commission est un pourcentage.

**③ Empêcher les litiges plutôt que les traiter.** Dans ce modèle, la médiation pèse
0,62 € par réservation, soit **40 % de la contribution d'un colis domestique**. Un litige
évité vaut huit réservations saines. Le code de livraison, les photos obligatoires avec la
Garantie et la vérification visuelle au pickup travaillent déjà dans ce sens. C'est l'euro
le plus facile à gagner, et il ne se voit pas dans le prix.

**④ Réduire les frais de paiement.** Regrouper les versements aux Voyageurs plutôt que de
verser à chaque réservation ; vérifier le coût réel des versements sortants (§ 8.5).

**⑤ Tarifer la Garantie au risque.** 6 € forfaitaires pour un plafond de 500 €, quelle que
soit la valeur déclarée. Un pourcentage de la valeur, avec un plancher, alignerait la prime
sur l'exposition. Ce n'est pas une hausse de prix, c'est une tarification du risque — et
GAR-06 plafonne déjà l'indemnité.

### 8.5 Sensibilités

**Au plancher de commission** (colis domestique, transport 8,05 €) :

| Plancher | Total client | Contribution | Équilibre à 2 800 €/mois |
|---|---|---|---|
| 3,00 € *(actuel)* | 11,05 € | 1,68 € | 1 672 |
| 3,50 € | 11,55 € | 2,17 € | 1 294 |
| **4,00 €** | **12,05 €** | **2,65 €** | **1 055** |
| 4,50 € | 12,55 € | 3,15 € | 891 |
| 5,00 € | 13,05 € | 3,65 € | 769 |

**Un euro sur le plancher supprime 37 % du volume nécessaire.** Et mis en regard de l'ancre
de PRC-10 — un envoi équivalent se chiffre en dizaines d'euros chez un express —, passer de
11 € à 12 € reste invisible pour le client. C'est le seul levier de prix qui ne relève pas
de l'excès.

**Au taux de litige** (plancher 3 €, colis domestique) :

| Taux de litige | Contribution | Équilibre à 2 800 €/mois |
|---|---|---|
| 2 % | 2,05 € | 1 366 |
| 5 % *(hypothèse)* | 1,68 € | 1 672 |
| 10 % | 1,05 € | 2 667 |
| 15 % | 0,43 € | 6 589 |

**C'est la variable la plus dangereuse du modèle.** À 15 % de litiges, l'équilibre devient
hors d'atteinte. La maîtrise du taux de litige n'est pas un sujet de support : c'est une
condition de viabilité.

**À l'origine des cartes.** Une carte hors zone euro coûte environ le double en
pourcentage. Sur un petit panier, l'effet est marginal — la part fixe de 0,25 € domine :
la contribution passe de 1,68 € à 1,50 € même si **toutes** les cartes sont hors zone.
Sur un panier de 80 €, en revanche, le net tombe de 7,26 € à 6,05 €, soit **−17 %**.
L'origine des cartes est donc un sujet **sur les gros paniers**, pas sur les petits.

### 8.6 Un coût promis mais pas encore payé

Le parcours annonce à l'Expéditeur que le code de livraison sera transmis au destinataire
« par SMS / WhatsApp ». **Aucun fournisseur SMS n'existe dans le code.** Le jour où cette
promesse sera tenue, elle deviendra un coût par réservation — et un SMS vers l'Afrique
centrale coûte dix à trente fois un SMS métropolitain. Sur une contribution de 1,57 €, ce
n'est pas neutre.

Trois options à arbitrer tôt : SMS payant, WhatsApp Business, ou courriel assorti d'un
relais par l'Expéditeur lui-même.

---

## 9. Ce qu'il faut mesurer

Le modèle du § 8 repose sur six hypothèses dont trois peuvent être fausses d'un facteur
deux. La mesure d'audience est déjà en place (D66) ; il suffit que ces grandeurs soient
instrumentées dès les premières réservations réelles.

| À mesurer | Pourquoi | Impact |
|---|---|---|
| **Taux de litige** | Variable la plus dangereuse | De 1 366 à 6 589 réservations à l'équilibre |
| **Taux et montant de sinistre** | La Garantie de base est financée par la commission | Détermine si la Garantie est une marge ou un trou |
| **Part des longs-courriers dans le mix** | Contribution ×4 | Détermine la stratégie d'acquisition |
| **Part des bagages entiers** | Contribution ×5 | Justifie, ou non, PRC-09 en priorité |
| **Origine des cartes** | Frais de paiement doublés | −17 % de net sur les gros paniers |
| **Écart entre prix pratiqué et prix suggéré** | Mesure le manque à gagner de PRC-05 | Chiffre le coût de la suggestion absente |

---

## 10. Synthèse

1. **Yamba ne fixe pas le prix du transport**, et ne doit pas le faire. Le corridor entre
   par la suggestion, jamais par la facturation.
2. **La formule actuelle a un défaut réel** : sous 1,83 kg, la taille n'a aucun effet, et
   le volume n'est jamais décompté de la capacité du Voyageur.
3. **La correction est le poids volumétrique par classe de taille**, la logique de
   l'express adaptée à un produit où personne ne mesure, accompagnée d'un plancher exprimé
   en kilos plutôt qu'en euros — ce qui le rend proportionnel au corridor.
4. **Cette correction profite au Voyageur, pas à la plateforme.** Yamba gagne même
   légèrement moins sur un colis encombrant.
5. **La rentabilité se joue sur le mix, pas sur le taux** : un bagage entier vaut cinq
   colis domestiques, un long-courrier en vaut quatre.
6. **Les deux leviers décisifs sont déjà spécifiés et non codés** : la suggestion de prix
   par corridor (PRC-05) et le forfait bagage suggéré (PRC-09).
7. **Le seul ajustement de prix raisonnable** est le plancher de commission, de 3 € à 4 € :
   invisible pour le client face à l'ancre express, il supprime plus d'un tiers du volume
   nécessaire à l'équilibre.
8. **La variable à surveiller avant toutes les autres est le taux de litige.**

---

## Annexe — où vivent ces règles

| Sujet | Référence |
|---|---|
| Moteur de calcul (pur, en centimes) | `packages/libs/pricing/src/index.ts` |
| Catalogue des paramètres et bornes | `packages/libs/api-contracts/src/admin/platform-settings.schema.ts` |
| Paramètres en vigueur, générés | `context/YAMBA-PARAMETRES.md` |
| Règles de prix | PRC-01 à PRC-10 |
| Règles de commission | COM-01 à COM-04 |
| Règles de garantie | GAR-01 à GAR-06 |
| Règles de capacité | CAP-01 à CAP-04 |
| Décisions d'architecture | D13 · D15 · D16 · D22 · D32 · D33 · D34 · D62 |
| Photographie immuable de la réservation | PRC-08 · D17 |
